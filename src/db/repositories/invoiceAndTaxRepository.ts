import type { Database } from 'sql.js';
import type {
  CompanyTaxSetting,
  Invoice,
  InvoiceCategory401,
  PlannedInvoice
} from '../../types/erp';
import {
  getDbInstance,
  notifyListeners,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { ensureArTablesAndColumns } from '../core/schemaOperations';
import { recordAuditLog } from './auditRepository';

export function deriveBiMonthlyTaxPeriod(dateStr?: string): string {
  const clean = (dateStr || new Date().toISOString().slice(0, 10)).trim();
  const y = clean.slice(0, 4);
  const m = Number(clean.slice(5, 7));
  if (!/^\d{4}$/.test(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    const now = new Date();
    const curY = now.getFullYear();
    const startM = Math.floor(now.getMonth() / 2) * 2 + 1;
    return `${curY}-${String(startM).padStart(2, '0')}-${String(startM + 1).padStart(2, '0')}`;
  }
  const startM = Math.floor((m - 1) / 2) * 2 + 1;
  return `${y}-${String(startM).padStart(2, '0')}-${String(startM + 1).padStart(2, '0')}`;
}

export function defaultInvoiceCategory(
  invoiceType: string,
  invoiceFormat?: string,
  explicitCategory?: string
): InvoiceCategory401 {
  if (explicitCategory) return explicitCategory as InvoiceCategory401;
  if (invoiceType === 'OUTPUT') {
    return invoiceFormat === 'TWO_PART' ? 'SALES_TWO_PART' : 'SALES_THREE_PART';
  }
  return 'PURCHASE_GOODS';
}

export function getAllInvoices(): Invoice[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureArTablesAndColumns(dbInstance);
  try {
    const res = dbInstance.exec(`
      SELECT id, invoiceType, invoiceNumber, invoiceDate, taxReportingCompanyId,
             issuerTaxId, issuerName, buyerTaxId, buyerName, netAmount, taxAmount,
             totalAmount, status, createdAt, updatedAt,
             COALESCE(invoiceFormat, 'THREE_PART'),
             COALESCE(invoiceIssueMode, 'DELIVERED'),
             linkedProjectId, linkedArId,
             invoiceCategory, taxPeriod, presetLabel, notes
      FROM fin_invoices
      ORDER BY invoiceDate DESC, createdAt DESC;
    `);
    if (!res.length) return [];
    return res[0].values.map(v => {
      const invType = (v[1] || 'INPUT') as Invoice['invoiceType'];
      const invFmt = (v[15] === 'TWO_PART' ? 'TWO_PART' : 'THREE_PART') as Invoice['invoiceFormat'];
      const invDate = String(v[3] || '');
      return {
        id: String(v[0]),
        invoiceType: invType,
        invoiceNumber: String(v[2]),
        invoiceDate: invDate,
        taxReportingCompanyId: String(v[4]),
        issuerTaxId: String(v[5]),
        issuerName: v[6] ? String(v[6]) : undefined,
        buyerTaxId: String(v[7]),
        buyerName: v[8] ? String(v[8]) : undefined,
        netAmount: Number(v[9] || 0),
        taxAmount: Number(v[10] || 0),
        totalAmount: Number(v[11] || 0),
        status: (v[12] || 'VALID') as Invoice['status'],
        createdAt: v[13] ? String(v[13]) : undefined,
        updatedAt: v[14] ? String(v[14]) : undefined,
        invoiceFormat: invFmt,
        invoiceIssueMode: (v[16] === 'SELF_RETAINED' ? 'SELF_RETAINED' : 'DELIVERED') as Invoice['invoiceIssueMode'],
        linkedProjectId: v[17] ? String(v[17]) : undefined,
        linkedArId: v[18] ? String(v[18]) : undefined,
        invoiceCategory: defaultInvoiceCategory(invType, invFmt, v[19] ? String(v[19]) : undefined),
        taxPeriod: v[20] ? String(v[20]) : deriveBiMonthlyTaxPeriod(invDate),
        presetLabel: v[21] ? String(v[21]) : undefined,
        notes: v[22] ? String(v[22]) : undefined,
      };
    });
  } catch (e) {
    return [];
  }
}

export function createInvoice(
  inv: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  operatorName: string = '張會計長'
): Invoice {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureArTablesAndColumns(dbInstance);
  const now = new Date().toISOString();
  const id = inv.id || `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const invFormat = inv.invoiceFormat === 'TWO_PART' ? 'TWO_PART' : 'THREE_PART';
  const issueMode = inv.invoiceIssueMode === 'SELF_RETAINED' ? 'SELF_RETAINED' : 'DELIVERED';
  const resolvedCategory = defaultInvoiceCategory(inv.invoiceType, invFormat, inv.invoiceCategory);
  const resolvedPeriod = inv.taxPeriod || deriveBiMonthlyTaxPeriod(inv.invoiceDate);
  const resolvedBuyerTaxId = inv.buyerTaxId?.trim() || (invFormat === 'TWO_PART' ? '免統編(二聯)' : '00000000');

  dbInstance.run(`
    INSERT INTO fin_invoices (
      id, invoiceType, invoiceFormat, invoiceIssueMode, invoiceCategory, taxPeriod, presetLabel, notes,
      invoiceNumber, invoiceDate, taxReportingCompanyId,
      issuerTaxId, issuerName, buyerTaxId, buyerName, netAmount, taxAmount,
      totalAmount, linkedProjectId, linkedArId, status, createdAt, updatedAt
    ) VALUES (
      '${id}', '${inv.invoiceType}', '${invFormat}', '${issueMode}', '${resolvedCategory}', '${resolvedPeriod}',
      ${inv.presetLabel ? `'${inv.presetLabel.replace(/'/g, "''")}'` : 'NULL'},
      ${inv.notes ? `'${inv.notes.replace(/'/g, "''")}'` : 'NULL'},
      '${inv.invoiceNumber.replace(/'/g, "''")}',
      '${inv.invoiceDate}', '${inv.taxReportingCompanyId}', '${inv.issuerTaxId}',
      '${(inv.issuerName || '').replace(/'/g, "''")}', '${resolvedBuyerTaxId.replace(/'/g, "''")}',
      '${(inv.buyerName || '').replace(/'/g, "''")}', ${inv.netAmount}, ${inv.taxAmount},
      ${inv.totalAmount},
      ${inv.linkedProjectId ? `'${inv.linkedProjectId.replace(/'/g, "''")}'` : 'NULL'},
      ${inv.linkedArId ? `'${inv.linkedArId.replace(/'/g, "''")}'` : 'NULL'},
      '${inv.status || 'VALID'}', '${now}', '${now}'
    )
    ON CONFLICT(taxReportingCompanyId, issuerTaxId, invoiceNumber) DO UPDATE SET
      invoiceFormat = excluded.invoiceFormat,
      invoiceIssueMode = excluded.invoiceIssueMode,
      invoiceCategory = excluded.invoiceCategory,
      taxPeriod = excluded.taxPeriod,
      presetLabel = COALESCE(excluded.presetLabel, fin_invoices.presetLabel),
      notes = COALESCE(excluded.notes, fin_invoices.notes),
      buyerTaxId = excluded.buyerTaxId,
      netAmount = excluded.netAmount,
      taxAmount = excluded.taxAmount,
      totalAmount = excluded.totalAmount,
      linkedProjectId = COALESCE(excluded.linkedProjectId, fin_invoices.linkedProjectId),
      linkedArId = COALESCE(excluded.linkedArId, fin_invoices.linkedArId),
      updatedAt = '${now}';
  `);

  recordAuditLog(
    operatorName,
    issueMode === 'SELF_RETAINED' ? '自主開立統一發票繳稅 (自留)' : '登記統一發票',
    '發票管理主檔',
    inv.invoiceNumber,
    {
      '發票號碼': inv.invoiceNumber,
      '申報期別': resolvedPeriod,
      '憑證類別': resolvedCategory,
      '發票格式': `${invFormat === 'TWO_PART' ? '二聯式（個人/含稅）' : '三聯式（營業人/附統編）'}${issueMode === 'SELF_RETAINED' ? ' · 自主留存報稅(未給業主)' : ''}`,
      '發票方向': inv.invoiceType === 'INPUT' ? '進項發票' : '銷項發票',
      '開立方': inv.issuerName || inv.issuerTaxId,
      '買受方': inv.buyerName || resolvedBuyerTaxId,
      '含稅總額': `NT$ ${inv.totalAmount.toLocaleString()}`
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    ...inv,
    id,
    buyerTaxId: resolvedBuyerTaxId,
    invoiceFormat: invFormat,
    invoiceIssueMode: issueMode,
    invoiceCategory: resolvedCategory,
    taxPeriod: resolvedPeriod,
    createdAt: now,
    updatedAt: now
  };
}

// 共用同步發票工具 (供 AP / AR / TreasuryPool 呼叫)
export function syncDocumentInvoice(
  db: Database,
  params: {
    invoiceType: 'INPUT' | 'OUTPUT';
    invoiceFormat?: 'THREE_PART' | 'TWO_PART';
    invoiceIssueMode?: 'DELIVERED' | 'SELF_RETAINED';
    invoiceCategory?: InvoiceCategory401;
    taxPeriod?: string;
    notes?: string;
    invoiceNumber: string;
    invoiceDate: string;
    companyId: string;
    partnerId: string;
    partnerName: string;
    partnerTaxId?: string;
    netAmount: number;
    taxAmount: number;
    totalAmount: number;
    linkedProjectId?: string;
    linkedArId?: string;
    sourceDocumentType: 'AP' | 'AR';
    sourceDocumentId: string;
  }
): void {
  const cleanNo = params.invoiceNumber.trim().toUpperCase();
  if (!cleanNo) return;

  const now = new Date().toISOString();
  const compRes = db.exec(`SELECT name, taxId FROM companies WHERE id = '${params.companyId}';`);
  const companyName = compRes.length && compRes[0].values.length ? String(compRes[0].values[0][0] || '') : params.companyId;
  const companyTaxId = compRes.length && compRes[0].values.length ? String(compRes[0].values[0][1] || params.companyId) : params.companyId;

  let partnerTaxId = params.partnerTaxId ? params.partnerTaxId.trim() : '';
  if (!partnerTaxId && params.partnerId) {
    const bpRes = db.exec(`SELECT taxId FROM business_partners WHERE id = '${params.partnerId}';`);
    if (bpRes.length && bpRes[0].values.length && bpRes[0].values[0][0]) {
      partnerTaxId = String(bpRes[0].values[0][0]);
    }
  }
  const hasValidTaxId = /^\d{8}$/.test(partnerTaxId);
  const resolvedFormat: 'THREE_PART' | 'TWO_PART' =
    params.invoiceFormat === 'TWO_PART' || (params.invoiceType === 'OUTPUT' && !hasValidTaxId && !params.invoiceFormat)
      ? 'TWO_PART'
      : 'THREE_PART';
  const issueMode = params.invoiceIssueMode === 'SELF_RETAINED' ? 'SELF_RETAINED' : 'DELIVERED';
  const resolvedCategory = defaultInvoiceCategory(params.invoiceType, resolvedFormat, params.invoiceCategory);
  const resolvedPeriod = params.taxPeriod || deriveBiMonthlyTaxPeriod(params.invoiceDate);
  if (!partnerTaxId) {
    partnerTaxId = resolvedFormat === 'TWO_PART' ? '免統編(二聯)' : (params.partnerName.slice(0, 8) || '00000000');
  }

  const issuerTaxId = params.invoiceType === 'INPUT' ? partnerTaxId : companyTaxId;
  const issuerName = params.invoiceType === 'INPUT' ? params.partnerName : companyName;
  const buyerTaxId = params.invoiceType === 'INPUT' ? companyTaxId : partnerTaxId;
  const buyerName = params.invoiceType === 'INPUT' ? companyName : params.partnerName;

  const invId = `INV-${params.invoiceType}-${params.companyId}-${cleanNo.replace(/[^A-Z0-9]/g, '')}`;
  db.run(`
    INSERT INTO fin_invoices (
      id, invoiceType, invoiceFormat, invoiceIssueMode, invoiceCategory, taxPeriod, notes,
      invoiceNumber, invoiceDate, taxReportingCompanyId,
      issuerTaxId, issuerName, buyerTaxId, buyerName, netAmount, taxAmount,
      totalAmount, linkedProjectId, linkedArId, status, createdAt, updatedAt
    ) VALUES (
      '${invId}', '${params.invoiceType}', '${resolvedFormat}', '${issueMode}', '${resolvedCategory}', '${resolvedPeriod}',
      ${params.notes ? `'${params.notes.replace(/'/g, "''")}'` : 'NULL'},
      '${cleanNo.replace(/'/g, "''")}',
      '${params.invoiceDate}', '${params.companyId}', '${issuerTaxId.replace(/'/g, "''")}',
      '${issuerName.replace(/'/g, "''")}', '${buyerTaxId.replace(/'/g, "''")}',
      '${buyerName.replace(/'/g, "''")}', ${params.netAmount}, ${params.taxAmount},
      ${params.totalAmount},
      ${params.linkedProjectId ? `'${params.linkedProjectId.replace(/'/g, "''")}'` : 'NULL'},
      ${params.linkedArId ? `'${params.linkedArId.replace(/'/g, "''")}'` : 'NULL'},
      'VALID', '${now}', '${now}'
    )
    ON CONFLICT(taxReportingCompanyId, issuerTaxId, invoiceNumber) DO UPDATE SET
      invoiceFormat = excluded.invoiceFormat,
      invoiceIssueMode = excluded.invoiceIssueMode,
      invoiceCategory = excluded.invoiceCategory,
      taxPeriod = excluded.taxPeriod,
      notes = COALESCE(excluded.notes, fin_invoices.notes),
      invoiceDate = excluded.invoiceDate,
      buyerTaxId = excluded.buyerTaxId,
      netAmount = excluded.netAmount,
      taxAmount = excluded.taxAmount,
      totalAmount = excluded.totalAmount,
      linkedProjectId = COALESCE(excluded.linkedProjectId, fin_invoices.linkedProjectId),
      linkedArId = COALESCE(excluded.linkedArId, fin_invoices.linkedArId),
      status = 'VALID',
      updatedAt = '${now}';
  `);

  try {
    const invRow = db.exec(`
      SELECT id FROM fin_invoices
      WHERE taxReportingCompanyId = '${params.companyId}'
        AND issuerTaxId = '${issuerTaxId.replace(/'/g, "''")}'
        AND invoiceNumber = '${cleanNo.replace(/'/g, "''")}';
    `);
    const resolvedInvId = invRow.length && invRow[0].values.length ? String(invRow[0].values[0][0]) : invId;
    const mapId = `MAP-${params.sourceDocumentType}-${params.sourceDocumentId}-${resolvedInvId}`;
    db.run(`
      INSERT OR REPLACE INTO fin_billing_invoice_mappings (
        id, invoiceId, sourceDocumentType, sourceDocumentId, mappedAmount, createdAt
      ) VALUES (
        '${mapId}', '${resolvedInvId}', '${params.sourceDocumentType}', '${params.sourceDocumentId}',
        ${params.totalAmount}, '${now}'
      );
    `);
  } catch (_) {}
}

export function voidInvoice(
  invoiceId: string,
  reason: string = '會計人工標記作廢',
  operatorName: string = '會計專員'
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();
  const res = dbInstance.exec(`SELECT invoiceNumber, taxReportingCompanyId FROM fin_invoices WHERE id = '${invoiceId}';`);
  if (!res.length || !res[0].values.length) throw new Error('找不到該筆發票紀錄');
  const invNo = String(res[0].values[0][0]);

  dbInstance.run(`
    UPDATE fin_invoices
    SET status = 'VOIDED', updatedAt = '${now}'
    WHERE id = '${invoiceId}';
  `);

  recordAuditLog(
    operatorName,
    '作廢統一發票',
    '各公司統一發票主檔',
    invNo,
    { '發票號碼': invNo, '作廢原因': reason }
  );

  saveDatabaseSnapshot();
  notifyListeners();
}

export function getAllPlannedInvoices(): PlannedInvoice[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureArTablesAndColumns(dbInstance);
  try {
    const res = dbInstance.exec(`
      SELECT id, companyId, taxPeriod, invoiceType, invoiceCategory, invoiceFormat,
             invoiceIssueMode, partnerName, partnerTaxId, linkedProjectId, linkedArId,
             netAmount, taxAmount, totalAmount, notes, status, convertedInvoiceId,
             createdBy, createdAt, updatedAt
      FROM fin_planned_invoices
      ORDER BY taxPeriod ASC, createdAt DESC;
    `);
    if (!res.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      companyId: String(v[1]),
      taxPeriod: String(v[2]),
      invoiceType: (v[3] || 'OUTPUT') as PlannedInvoice['invoiceType'],
      invoiceCategory: (v[4] || 'SALES_THREE_PART') as InvoiceCategory401,
      invoiceFormat: (v[5] === 'TWO_PART' ? 'TWO_PART' : 'THREE_PART') as PlannedInvoice['invoiceFormat'],
      invoiceIssueMode: (v[6] === 'SELF_RETAINED' ? 'SELF_RETAINED' : 'DELIVERED') as PlannedInvoice['invoiceIssueMode'],
      partnerName: String(v[7] || ''),
      partnerTaxId: v[8] ? String(v[8]) : undefined,
      linkedProjectId: v[9] ? String(v[9]) : undefined,
      linkedArId: v[10] ? String(v[10]) : undefined,
      netAmount: Number(v[11] || 0),
      taxAmount: Number(v[12] || 0),
      totalAmount: Number(v[13] || 0),
      notes: v[14] ? String(v[14]) : undefined,
      status: (v[15] || 'PLANNED') as PlannedInvoice['status'],
      convertedInvoiceId: v[16] ? String(v[16]) : undefined,
      createdBy: v[17] ? String(v[17]) : undefined,
      createdAt: v[18] ? String(v[18]) : undefined,
      updatedAt: v[19] ? String(v[19]) : undefined,
    }));
  } catch (_) {
    return [];
  }
}

export function createPlannedInvoice(
  data: Omit<PlannedInvoice, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  operatorName: string = '會計專員'
): PlannedInvoice {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureArTablesAndColumns(dbInstance);
  const now = new Date().toISOString();
  const id = `PLAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  dbInstance.run(`
    INSERT INTO fin_planned_invoices (
      id, companyId, taxPeriod, invoiceType, invoiceCategory, invoiceFormat, invoiceIssueMode,
      partnerName, partnerTaxId, linkedProjectId, linkedArId,
      netAmount, taxAmount, totalAmount, notes, status, createdBy, createdAt, updatedAt
    ) VALUES (
      '${id}', '${data.companyId}', '${data.taxPeriod}', '${data.invoiceType}', '${data.invoiceCategory}',
      '${data.invoiceFormat}', '${data.invoiceIssueMode}',
      '${data.partnerName.replace(/'/g, "''")}',
      ${data.partnerTaxId ? `'${data.partnerTaxId.replace(/'/g, "''")}'` : 'NULL'},
      ${data.linkedProjectId ? `'${data.linkedProjectId}'` : 'NULL'},
      ${data.linkedArId ? `'${data.linkedArId}'` : 'NULL'},
      ${data.netAmount}, ${data.taxAmount}, ${data.totalAmount},
      ${data.notes ? `'${data.notes.replace(/'/g, "''")}'` : 'NULL'},
      'PLANNED', '${operatorName.replace(/'/g, "''")}', '${now}', '${now}'
    );
  `);

  saveDatabaseSnapshot();
  notifyListeners();
  return { ...data, id, status: 'PLANNED', createdBy: operatorName, createdAt: now, updatedAt: now };
}

export function updatePlannedInvoice(
  id: string,
  patch: Partial<Pick<PlannedInvoice, 'companyId' | 'taxPeriod' | 'partnerName' | 'netAmount' | 'taxAmount' | 'totalAmount' | 'notes' | 'invoiceCategory' | 'invoiceType'>>
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureArTablesAndColumns(dbInstance);
  const now = new Date().toISOString();
  const updates: string[] = [`updatedAt = '${now}'`];
  if (patch.companyId !== undefined) updates.push(`companyId = '${patch.companyId}'`);
  if (patch.taxPeriod !== undefined) updates.push(`taxPeriod = '${patch.taxPeriod}'`);
  if (patch.invoiceType !== undefined) updates.push(`invoiceType = '${patch.invoiceType}'`);
  if (patch.invoiceCategory !== undefined) updates.push(`invoiceCategory = '${patch.invoiceCategory}'`);
  if (patch.partnerName !== undefined) updates.push(`partnerName = '${patch.partnerName.replace(/'/g, "''")}'`);
  if (patch.netAmount !== undefined) updates.push(`netAmount = ${patch.netAmount}`);
  if (patch.taxAmount !== undefined) updates.push(`taxAmount = ${patch.taxAmount}`);
  if (patch.totalAmount !== undefined) updates.push(`totalAmount = ${patch.totalAmount}`);
  if (patch.notes !== undefined) updates.push(`notes = '${(patch.notes || '').replace(/'/g, "''")}'`);

  dbInstance.run(`UPDATE fin_planned_invoices SET ${updates.join(', ')} WHERE id = '${id}';`);
  saveDatabaseSnapshot();
  notifyListeners();
}

export function convertPlannedInvoiceToOfficial(
  plannedId: string,
  invoiceNumber: string,
  invoiceDate: string,
  operatorName: string = '會計專員'
): Invoice {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureArTablesAndColumns(dbInstance);
  const cleanNo = invoiceNumber.trim().toUpperCase();
  if (!cleanNo) throw new Error('請填入正式發票號碼');

  const p = getAllPlannedInvoices().find(x => x.id === plannedId);
  if (!p) throw new Error('找不到該筆預計項目');

  const compRes = dbInstance.exec(`SELECT name, taxId FROM companies WHERE id = '${p.companyId}';`);
  const ourName = compRes.length && compRes[0].values.length ? String(compRes[0].values[0][0] || '') : p.companyId;
  const ourTaxId = compRes.length && compRes[0].values.length ? String(compRes[0].values[0][1] || p.companyId) : p.companyId;
  const otherTax = p.partnerTaxId?.trim() || (p.invoiceFormat === 'TWO_PART' ? '免統編(二聯)' : '未建統編');

  const created = createInvoice(
    {
      invoiceType: p.invoiceType,
      invoiceFormat: p.invoiceFormat,
      invoiceIssueMode: p.invoiceIssueMode,
      invoiceCategory: p.invoiceCategory,
      taxPeriod: deriveBiMonthlyTaxPeriod(invoiceDate),
      notes: p.notes,
      invoiceNumber: cleanNo,
      invoiceDate,
      taxReportingCompanyId: p.companyId,
      issuerTaxId: p.invoiceType === 'INPUT' ? otherTax : ourTaxId,
      issuerName: p.invoiceType === 'INPUT' ? p.partnerName : ourName,
      buyerTaxId: p.invoiceType === 'INPUT' ? ourTaxId : otherTax,
      buyerName: p.invoiceType === 'INPUT' ? ourName : p.partnerName,
      netAmount: p.netAmount,
      taxAmount: p.taxAmount,
      totalAmount: p.totalAmount,
      linkedProjectId: p.linkedProjectId,
      linkedArId: p.linkedArId,
      status: 'VALID',
    },
    operatorName
  );

  const now = new Date().toISOString();
  dbInstance.run(`
    UPDATE fin_planned_invoices
    SET status = 'CONVERTED', convertedInvoiceId = '${created.id}', updatedAt = '${now}'
    WHERE id = '${plannedId}';
  `);
  saveDatabaseSnapshot();
  notifyListeners();
  return created;
}

export function deletePlannedInvoice(plannedId: string): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  dbInstance.run(`DELETE FROM fin_planned_invoices WHERE id = '${plannedId}';`);
  saveDatabaseSnapshot();
  notifyListeners();
}

export function getAllCompanyTaxSettings(): CompanyTaxSetting[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureArTablesAndColumns(dbInstance);
  try {
    const res = dbInstance.exec(`
      SELECT id, companyId, taxYear, priorYearCreditTax, phonePresetsJson, electricityPresetsJson, personalVoucherLabel, updatedAt
      FROM fin_company_tax_settings;
    `);
    if (!res.length) return [];
    return res[0].values.map(v => {
      let phones: string[] = [];
      let elecs: string[] = [];
      try { if (v[4]) phones = JSON.parse(String(v[4])); } catch (_) {}
      try { if (v[5]) elecs = JSON.parse(String(v[5])); } catch (_) {}
      return {
        id: String(v[0]),
        companyId: String(v[1]),
        taxYear: Number(v[2]),
        priorYearCreditTax: Number(v[3] || 0),
        phonePresets: Array.isArray(phones) ? phones : [],
        electricityPresets: Array.isArray(elecs) ? elecs : [],
        personalVoucherLabel: v[6] ? String(v[6]) : undefined,
        updatedAt: v[7] ? String(v[7]) : undefined,
      };
    });
  } catch (_) {
    return [];
  }
}

export function saveCompanyTaxSetting(setting: {
  companyId: string;
  taxYear: number;
  priorYearCreditTax: number;
  phonePresets: string[];
  electricityPresets: string[];
  personalVoucherLabel?: string;
}): CompanyTaxSetting {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureArTablesAndColumns(dbInstance);
  const now = new Date().toISOString();
  const id = `TAXSET-${setting.companyId}-${setting.taxYear}`;
  const phonesJson = JSON.stringify(setting.phonePresets || []);
  const elecsJson = JSON.stringify(setting.electricityPresets || []);

  dbInstance.run(`
    INSERT INTO fin_company_tax_settings (
      id, companyId, taxYear, priorYearCreditTax, phonePresetsJson, electricityPresetsJson, personalVoucherLabel, updatedAt
    ) VALUES (
      '${id}', '${setting.companyId}', ${setting.taxYear}, ${Number(setting.priorYearCreditTax || 0)},
      '${phonesJson.replace(/'/g, "''")}', '${elecsJson.replace(/'/g, "''")}',
      ${setting.personalVoucherLabel ? `'${setting.personalVoucherLabel.replace(/'/g, "''")}'` : 'NULL'},
      '${now}'
    )
    ON CONFLICT(companyId, taxYear) DO UPDATE SET
      priorYearCreditTax = excluded.priorYearCreditTax,
      phonePresetsJson = excluded.phonePresetsJson,
      electricityPresetsJson = excluded.electricityPresetsJson,
      personalVoucherLabel = excluded.personalVoucherLabel,
      updatedAt = '${now}';
  `);

  saveDatabaseSnapshot();
  notifyListeners();
  return { ...setting, id, updatedAt: now };
}
