import type {
  AccountReceivable,
  ArCollectionRecord,
  ArLineItem
} from '../../types/erp';
import {
  getDbInstance,
  notifyListeners,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { ensureArTablesAndColumns } from '../core/schemaOperations';
import { recordAuditLog } from './auditRepository';
import { syncDocumentInvoice } from './invoiceAndTaxRepository';
import { getNextDocumentNumber } from './sequenceRepository';

// 讀取應收帳款 AR
export function getAllAccountsReceivable(): AccountReceivable[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureArTablesAndColumns(dbInstance);
  const res = dbInstance.exec(`
    SELECT id, arNumber, projectId, projectName, customerId, customerName, companyId,
           title, lineItemsJson, netAmount, taxType, taxAmount, amount, appliedAmount, remainingAmount,
           hasInvoice, invoiceFormat, COALESCE(invoiceIssueMode, 'DELIVERED'),
           invoiceNumber, invoiceDate, dueDate, status, notes,
           bouncedCheckNumber, bouncedReason, bouncedAt, createdBy, createdAt, updatedAt
    FROM accounts_receivable
    ORDER BY createdAt DESC, dueDate ASC;
  `);
  if (!res.length) return [];
  return res[0].values.map(v => {
    let parsedLines: ArLineItem[] | undefined;
    if (v[8]) {
      try {
        const raw = JSON.parse(String(v[8]));
        if (Array.isArray(raw)) parsedLines = raw;
      } catch (_) {}
    }
    return {
      id: String(v[0]),
      arNumber: String(v[1]),
      projectId: String(v[2]),
      projectName: v[3] ? String(v[3]) : undefined,
      customerId: String(v[4]),
      customerName: String(v[5]),
      companyId: String(v[6]),
      title: v[7] ? String(v[7]) : undefined,
      lineItems: parsedLines,
      netAmount: v[9] !== null && v[9] !== undefined ? Number(v[9]) : undefined,
      taxType: (v[10] ? String(v[10]) : 'TAX_EXCLUSIVE') as AccountReceivable['taxType'],
      taxAmount: v[11] !== null && v[11] !== undefined ? Number(v[11]) : undefined,
      amount: Number(v[12] || 0),
      appliedAmount: Number(v[13] || 0),
      remainingAmount: Number(v[14] || 0),
      hasInvoice: v[15] === null || v[15] === undefined ? true : Boolean(Number(v[15])),
      invoiceFormat: (v[16] === 'TWO_PART' ? 'TWO_PART' : 'THREE_PART') as AccountReceivable['invoiceFormat'],
      invoiceIssueMode: (v[17] === 'SELF_RETAINED' ? 'SELF_RETAINED' : 'DELIVERED') as AccountReceivable['invoiceIssueMode'],
      invoiceNumber: v[18] ? String(v[18]) : undefined,
      invoiceDate: v[19] ? String(v[19]) : undefined,
      dueDate: String(v[20] || ''),
      status: v[21] as AccountReceivable['status'],
      notes: v[22] ? String(v[22]) : undefined,
      bouncedCheckNumber: v[23] ? String(v[23]) : undefined,
      bouncedReason: v[24] ? String(v[24]) : undefined,
      bouncedAt: v[25] ? String(v[25]) : undefined,
      createdBy: v[26] ? String(v[26]) : undefined,
      createdAt: String(v[27] || ''),
      updatedAt: v[28] ? String(v[28]) : undefined,
    };
  });
}

// -------------------------------------------------------------
// 🏛️ 業主應收請款與出納收款沖銷 (AR Billing & Collection)
// -------------------------------------------------------------

export function getAllArCollections(): ArCollectionRecord[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureArTablesAndColumns(dbInstance);
  try {
    const res = dbInstance.exec(`
      SELECT id, arId, arNumber, companyId, collectionMethod, bankAccountId, bankAccountName,
             amount, feeAmount, COALESCE(overpaymentAmount, 0), netReceivedAmount,
             checkNumber, checkDueDate, drawerBank,
             receivedDate, suspenseId, status, notes, createdBy, createdAt
      FROM fin_ar_collections
      ORDER BY receivedDate DESC, createdAt DESC;
    `);
    if (!res.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      arId: String(v[1]),
      arNumber: v[2] ? String(v[2]) : undefined,
      companyId: String(v[3]),
      collectionMethod: String(v[4]) as ArCollectionRecord['collectionMethod'],
      bankAccountId: String(v[5]),
      bankAccountName: v[6] ? String(v[6]) : undefined,
      amount: Number(v[7] || 0),
      feeAmount: Number(v[8] || 0),
      overpaymentAmount: Number(v[9] || 0),
      netReceivedAmount: Number(v[10] || 0),
      checkNumber: v[11] ? String(v[11]) : undefined,
      checkDueDate: v[12] ? String(v[12]) : undefined,
      drawerBank: v[13] ? String(v[13]) : undefined,
      receivedDate: String(v[14]),
      suspenseId: v[15] ? String(v[15]) : undefined,
      status: String(v[16]) as ArCollectionRecord['status'],
      notes: v[17] ? String(v[17]) : undefined,
      createdBy: v[18] ? String(v[18]) : undefined,
      createdAt: String(v[19]),
    }));
  } catch (_) {
    return [];
  }
}

export function createAccountsReceivable(
  data: {
    projectId: string;
    projectName?: string;
    customerId: string;
    customerName: string;
    customerTaxId?: string;
    companyId: string;
    title?: string;
    lineItems?: ArLineItem[];
    netAmount: number;
    taxType: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT';
    taxAmount: number;
    amount: number;
    hasInvoice: boolean;
    invoiceFormat?: 'THREE_PART' | 'TWO_PART';
    invoiceIssueMode?: 'DELIVERED' | 'SELF_RETAINED';
    invoiceNumber?: string;
    invoiceDate?: string;
    dueDate: string;
    notes?: string;
  },
  operatorName: string = '會計專員'
): AccountReceivable {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureArTablesAndColumns(dbInstance);

  // 🔒 若案場已指定承攬公司，強制由工程專案案場鎖定承攬公司與合約業主；若案場未指定簽約公司，允許依本次請款選擇公司
  let resolvedCompanyId = data.companyId;
  let resolvedProjectName = data.projectName || '';
  let resolvedCustomerName = data.customerName;
  let resolvedCustomerTaxId = data.customerTaxId || '';
  let resolvedCustomerId = data.customerId;

  if (data.projectId) {
    const projRes = dbInstance.exec(`
      SELECT companyId, name, ownerName, ownerTaxId FROM projects WHERE id = '${data.projectId.replace(/'/g, "''")}' AND isDeleted = 0;
    `);
    if (projRes.length && projRes[0].values.length) {
      const pCompany = projRes[0].values[0][0] ? String(projRes[0].values[0][0]) : '';
      const pName = projRes[0].values[0][1] ? String(projRes[0].values[0][1]) : '';
      const pOwnerName = projRes[0].values[0][2] ? String(projRes[0].values[0][2]) : '';
      const pOwnerTax = projRes[0].values[0][3] ? String(projRes[0].values[0][3]) : '';
      if (pCompany && pCompany !== 'UNASSIGNED') resolvedCompanyId = pCompany;
      if (pName) resolvedProjectName = pName;
      if (pOwnerName) resolvedCustomerName = pOwnerName;
      if (pOwnerTax) resolvedCustomerTaxId = pOwnerTax;
      if (!resolvedCustomerId || resolvedCustomerId.startsWith('PROJ-OWNER-')) {
        const bpMatch = dbInstance.exec(`
          SELECT id FROM business_partners
          WHERE isDeleted = 0 AND (isCustomer = 1 OR type IN ('CUSTOMER', 'BOTH'))
            AND ((taxId IS NOT NULL AND taxId != '' AND taxId = '${resolvedCustomerTaxId.replace(/'/g, "''")}')
              OR name = '${resolvedCustomerName.replace(/'/g, "''")}')
          LIMIT 1;
        `);
        if (bpMatch.length && bpMatch[0].values.length) {
          resolvedCustomerId = String(bpMatch[0].values[0][0]);
        } else {
          resolvedCustomerId = `PROJ-OWNER-${data.projectId}`;
        }
      }
    }
  }

  const now = new Date().toISOString();
  const id = `AR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  let arNumber = getNextDocumentNumber('AR', data.dueDate || now.slice(0, 10));
  const dupCheck = dbInstance.exec(`SELECT id FROM accounts_receivable WHERE arNumber = '${arNumber}';`);
  if (dupCheck.length && dupCheck[0].values.length) {
    arNumber = `AR-${now.slice(0, 7).replace('-', '')}-${String(Date.now()).slice(-4)}`;
  }

  const invNoClean = data.hasInvoice && data.invoiceNumber ? data.invoiceNumber.trim().toUpperCase() : '';
  const invDateVal = data.hasInvoice ? (data.invoiceDate || now.slice(0, 10)) : '';
  const invFormat: 'THREE_PART' | 'TWO_PART' =
    data.invoiceFormat === 'TWO_PART' ? 'TWO_PART' : 'THREE_PART';
  const issueMode: 'DELIVERED' | 'SELF_RETAINED' =
    data.invoiceIssueMode === 'SELF_RETAINED' ? 'SELF_RETAINED' : 'DELIVERED';
  const lineItemsJson = data.lineItems && data.lineItems.length > 0 ? JSON.stringify(data.lineItems) : null;

  dbInstance.run(`
    INSERT INTO accounts_receivable (
      id, arNumber, projectId, projectName, customerId, customerName, companyId,
      title, lineItemsJson, netAmount, taxType, taxAmount, amount, appliedAmount, remainingAmount,
      hasInvoice, invoiceFormat, invoiceIssueMode, invoiceNumber, invoiceDate, dueDate, status, notes,
      createdBy, createdAt, updatedAt
    ) VALUES (
      '${id}', '${arNumber}', '${data.projectId}',
      ${resolvedProjectName ? `'${resolvedProjectName.replace(/'/g, "''")}'` : 'NULL'},
      '${resolvedCustomerId}', '${resolvedCustomerName.replace(/'/g, "''")}', '${resolvedCompanyId}',
      ${data.title ? `'${data.title.replace(/'/g, "''")}'` : 'NULL'},
      ${lineItemsJson ? `'${lineItemsJson.replace(/'/g, "''")}'` : 'NULL'},
      ${data.netAmount}, '${data.taxType}', ${data.taxAmount},
      ${data.amount}, 0, ${data.amount},
      ${data.hasInvoice ? 1 : 0},
      '${invFormat}',
      '${issueMode}',
      ${invNoClean ? `'${invNoClean.replace(/'/g, "''")}'` : 'NULL'},
      ${invDateVal ? `'${invDateVal}'` : 'NULL'},
      '${data.dueDate}', 'OPEN',
      ${data.notes ? `'${data.notes.replace(/'/g, "''")}'` : 'NULL'},
      '${operatorName.replace(/'/g, "''")}', '${now}', '${now}'
    );
  `);

  // 有開發票者：同步將銷項發票寫入該開票法人之統一發票主檔 (taxReportingCompanyId = resolvedCompanyId)
  if (data.hasInvoice && invNoClean) {
    syncDocumentInvoice(dbInstance, {
      invoiceType: 'OUTPUT',
      invoiceFormat: invFormat,
      invoiceIssueMode: issueMode,
      invoiceNumber: invNoClean,
      invoiceDate: invDateVal || now.slice(0, 10),
      companyId: resolvedCompanyId,
      partnerId: resolvedCustomerId,
      partnerName: resolvedCustomerName,
      partnerTaxId: resolvedCustomerTaxId || undefined,
      netAmount: data.netAmount,
      taxAmount: data.taxAmount,
      totalAmount: data.amount,
      linkedProjectId: data.projectId,
      linkedArId: id,
      sourceDocumentType: 'AR',
      sourceDocumentId: id,
    });
  }

  recordAuditLog(
    operatorName,
    '會計開立應收請款單 (AR)',
    '業主應收請款管理',
    arNumber,
    {
      '請款單號': arNumber,
      '開發票/入帳公司': resolvedCompanyId,
      '業主客戶': resolvedCustomerName,
      '案場專案': resolvedProjectName || data.projectId,
      '是否開立發票': data.hasInvoice
        ? `是 [${invFormat === 'TWO_PART' ? '二聯式' : '三聯式'}] (${invNoClean || '待補號'}) · 限入開票公司戶`
        : '免開發票 · 可入老闆私帳/現金',
      '應收含稅總額': `NT$ ${data.amount.toLocaleString()}`,
      '預計收款日': data.dueDate,
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    arNumber,
    projectId: data.projectId,
    projectName: resolvedProjectName,
    customerId: resolvedCustomerId,
    customerName: resolvedCustomerName,
    companyId: resolvedCompanyId,
    title: data.title,
    lineItems: data.lineItems,
    netAmount: data.netAmount,
    taxType: data.taxType,
    taxAmount: data.taxAmount,
    amount: data.amount,
    appliedAmount: 0,
    remainingAmount: data.amount,
    hasInvoice: data.hasInvoice,
    invoiceFormat: invFormat,
    invoiceIssueMode: issueMode,
    invoiceNumber: invNoClean || undefined,
    invoiceDate: invDateVal || undefined,
    dueDate: data.dueDate,
    status: 'OPEN',
    notes: data.notes,
    createdBy: operatorName,
    createdAt: now,
    updatedAt: now,
  };
}

// 針對原「免開發票請款單」或「已收完之案場/AR」分批多次補開銷項發票（交付業主含稅補收/吸收 OR 自主報稅留存）
export function issueInvoiceForExistingAr(
  params: {
    arId: string;
    invoiceFormat: 'THREE_PART' | 'TWO_PART';
    invoiceIssueMode: 'DELIVERED' | 'SELF_RETAINED';
    invoiceNumber: string;
    invoiceDate: string;
    netAmount: number;
    taxAmount: number;
    totalAmount: number;
    updateArTotalIfUncollected?: boolean;
    createExtraTaxReceivable?: boolean; // 已付完本金後，業主事後要求補開發票且須向業主補收稅金差額
    companyId?: string;
    customerTaxId?: string;
    notes?: string;
  },
  operatorName: string = '會計專員'
): AccountReceivable | null {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureArTablesAndColumns(dbInstance);
  const cleanNo = params.invoiceNumber.trim().toUpperCase();
  if (!cleanNo) throw new Error('請填入銷項發票字軌號碼');

  const res = dbInstance.exec(`
    SELECT arNumber, projectId, projectName, customerId, customerName, companyId, amount, appliedAmount, remainingAmount, status, invoiceNumber
    FROM accounts_receivable WHERE id = '${params.arId}';
  `);
  if (!res.length || !res[0].values.length) throw new Error('找不到該應收請款單');
  const r = res[0].values[0];
  const arNumber = String(r[0]);
  const projectId = String(r[1]);
  const projectName = r[2] ? String(r[2]) : '';
  const customerId = String(r[3]);
  const customerName = String(r[4]);
  const companyId = (params.companyId && params.companyId.trim()) ? params.companyId.trim() : String(r[5]);
  const prevAmount = Number(r[6] || 0);
  const applied = Number(r[7] || 0);
  const status = String(r[9]);
  const existingInvNo = r[10] ? String(r[10]) : '';

  if (status === 'VOIDED') throw new Error('已作廢之應收請款單不可補開發票');

  let resolvedTaxId = params.customerTaxId?.trim() || '';
  if (!resolvedTaxId && projectId) {
    const pRes = dbInstance.exec(`SELECT ownerTaxId FROM projects WHERE id = '${projectId}';`);
    if (pRes.length && pRes[0].values.length && pRes[0].values[0][0]) {
      resolvedTaxId = String(pRes[0].values[0][0]);
    }
  }

  const now = new Date().toISOString();
  const isSelfRetained = params.invoiceIssueMode === 'SELF_RETAINED';
  const nextAmount =
    !isSelfRetained && !existingInvNo && params.updateArTotalIfUncollected && applied === 0
      ? params.totalAmount
      : prevAmount;
  const nextRemaining = Math.max(0, nextAmount - applied);
  const appendNote = isSelfRetained
    ? ` [分批自主補開報稅 ${cleanNo}: NT$ ${params.totalAmount.toLocaleString()} (自留未交業主·稅金公司自理)]`
    : ` [分批補開銷項發票 ${cleanNo}: 未稅 ${params.netAmount.toLocaleString()} / 稅 ${params.taxAmount.toLocaleString()}]`;

  // 若已經有主發票號碼，保留既有發票列表摘要，不覆寫掉第一張；若無主發票則寫入主發票號
  const nextInvNoDisplay = existingInvNo
    ? (existingInvNo.includes(cleanNo) ? existingInvNo : `${existingInvNo}, ${cleanNo}`)
    : cleanNo;

  // 若為自主留存或分批部分補開且仍有未收款，維持原本剩餘收款帳戶彈性，不強迫鎖死尚未收款部分
  const nextHasInvoice = isSelfRetained && nextRemaining > 0.01 ? 0 : 1;

  dbInstance.run(`
    UPDATE accounts_receivable
    SET hasInvoice = ${nextHasInvoice},
        invoiceFormat = '${params.invoiceFormat}',
        invoiceIssueMode = '${params.invoiceIssueMode}',
        invoiceNumber = '${nextInvNoDisplay.replace(/'/g, "''")}',
        invoiceDate = COALESCE(invoiceDate, '${params.invoiceDate}'),
        companyId = '${companyId}',
        amount = ${nextAmount},
        remainingAmount = ${nextRemaining},
        notes = COALESCE(notes, '') || '${appendNote.replace(/'/g, "''")}',
        updatedAt = '${now}'
    WHERE id = '${params.arId}';
  `);

  syncDocumentInvoice(dbInstance, {
    invoiceType: 'OUTPUT',
    invoiceFormat: params.invoiceFormat,
    invoiceIssueMode: params.invoiceIssueMode,
    invoiceNumber: cleanNo,
    invoiceDate: params.invoiceDate,
    companyId,
    partnerId: customerId,
    partnerName: customerName,
    partnerTaxId: resolvedTaxId || undefined,
    netAmount: params.netAmount,
    taxAmount: params.taxAmount,
    totalAmount: params.totalAmount,
    linkedProjectId: projectId,
    linkedArId: params.arId,
    notes: params.notes,
    sourceDocumentType: 'AR',
    sourceDocumentId: params.arId,
  });

  let createdTaxAr: AccountReceivable | null = null;
  if (!isSelfRetained && params.createExtraTaxReceivable && params.taxAmount > 0 && applied > 0) {
    createdTaxAr = createAccountsReceivable(
      {
        projectId,
        projectName,
        customerId,
        customerName,
        customerTaxId: resolvedTaxId || undefined,
        companyId,
        title: `補開發票 [${cleanNo}] 營業稅金補收 (${arNumber})`,
        netAmount: 0,
        taxType: 'TAX_EXCLUSIVE',
        taxAmount: params.taxAmount,
        amount: params.taxAmount,
        hasInvoice: true,
        invoiceFormat: params.invoiceFormat,
        invoiceIssueMode: 'DELIVERED',
        invoiceNumber: undefined,
        invoiceDate: params.invoiceDate,
        dueDate: params.invoiceDate,
        notes: `對應 [${arNumber}] 事後補開銷售額 NT$ ${params.netAmount.toLocaleString()} 之 5% 稅金補收（限入公司戶）`,
      },
      operatorName
    );
  }

  recordAuditLog(
    operatorName,
    isSelfRetained ? '應收單自主分批開立發票繳稅 (公司自留)' : '免開票應收單補開銷項發票',
    '業主應收請款管理',
    arNumber,
    {
      '請款單號': arNumber,
      '開票法人': companyId,
      '發票號碼': cleanNo,
      '發票聯式': params.invoiceFormat === 'TWO_PART' ? '二聯式' : '三聯式',
      '交付模式': isSelfRetained ? '公司自主留存報稅（未交付業主・稅金自理）' : '交付業主',
      '含稅金額': `NT$ ${params.totalAmount.toLocaleString()}`,
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();
  return createdTaxAr;
}

export function voidAccountsReceivable(
  arId: string,
  reason: string,
  operatorName: string = '會計專員'
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureArTablesAndColumns(dbInstance);
  const now = new Date().toISOString();

  const res = dbInstance.exec(`SELECT arNumber, appliedAmount, status, companyId, invoiceNumber FROM accounts_receivable WHERE id = '${arId}';`);
  if (!res.length || !res[0].values.length) throw new Error('找不到該應收請款單');
  const arNumber = String(res[0].values[0][0]);
  const applied = Number(res[0].values[0][1] || 0);
  const status = String(res[0].values[0][2]);
  const arCompanyId = String(res[0].values[0][3] || '');
  const arInvoiceNumber = res[0].values[0][4] ? String(res[0].values[0][4]) : '';
  if (applied > 0 || status === 'COLLECTED' || status === 'PARTIAL') {
    throw new Error('該應收單已有收款或沖銷紀錄，禁止直接作廢');
  }

  dbInstance.run(`
    UPDATE accounts_receivable
    SET status = 'VOIDED',
        notes = COALESCE(notes, '') || ' [作廢原因: ${reason.replace(/'/g, "''")}]',
        updatedAt = '${now}'
    WHERE id = '${arId}';
  `);

  // 若原應收單曾產生銷項發票，作廢時一併同步作廢該張關聯發票（方便改開為免開發票或重開發票）
  try {
    dbInstance.run(`
      UPDATE fin_invoices
      SET status = 'VOIDED', updatedAt = '${now}'
      WHERE id IN (
        SELECT invoiceId FROM fin_billing_invoice_mappings
        WHERE sourceDocumentType = 'AR' AND sourceDocumentId = '${arId}'
      );
    `);
    if (arInvoiceNumber && arCompanyId) {
      dbInstance.run(`
        UPDATE fin_invoices
        SET status = 'VOIDED', updatedAt = '${now}'
        WHERE taxReportingCompanyId = '${arCompanyId}'
          AND invoiceType = 'OUTPUT'
          AND invoiceNumber = '${arInvoiceNumber.replace(/'/g, "''")}';
      `);
    }
  } catch (_) {}

  recordAuditLog(
    operatorName,
    '作廢應收請款單',
    '業主應收請款管理',
    arNumber,
    { '請款單號': arNumber, '作廢原因': reason }
  );

  saveDatabaseSnapshot();
  notifyListeners();
}

export function collectAccountsReceivable(
  payload: {
    arId: string;
    collectionMethod: 'TT' | 'CHECK' | 'CASH';
    bankAccountId: string; // 'CASH' 或 company_bank_accounts.id
    amount: number; // 沖銷應收帳款金額 (一般 <= remainingAmount)
    feeAmount?: number; // 銀行扣匯費 / 少收折讓 (實收 = amount - feeAmount)
    overpaymentAmount?: number; // 超付溢收金額 (實收 = amount + overpaymentAmount)
    overpaymentHandling?: 'TO_PROJECT_ADVANCE' | 'TO_SUSPENSE' | 'DIRECT_OVERPAY'; // 溢收直入案場預收 / 轉暫收池 / 直接認列
    receivedDate: string;
    checkNumber?: string;
    checkDueDate?: string;
    drawerBank?: string;
    notes?: string;
  },
  operatorName: string = 'B出納'
): ArCollectionRecord {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureArTablesAndColumns(dbInstance);

  const now = new Date().toISOString();
  const arRes = dbInstance.exec(`
    SELECT arNumber, companyId, customerName, amount, appliedAmount, remainingAmount, hasInvoice, status,
           COALESCE(invoiceIssueMode, 'DELIVERED'), projectId, projectName, customerId
    FROM accounts_receivable WHERE id = '${payload.arId}';
  `);
  if (!arRes.length || !arRes[0].values.length) throw new Error('找不到目標應收請款單');
  const row = arRes[0].values[0];
  const arNumber = String(row[0]);
  const arCompanyId = String(row[1]);
  const customerName = String(row[2]);
  const totalAmount = Number(row[3] || 0);
  const prevApplied = Number(row[4] || 0);
  const prevRemaining = Number(row[5] || 0);
  const hasInvoice = row[6] === null || row[6] === undefined ? true : Boolean(Number(row[6]));
  const status = String(row[7]);
  const issueMode = String(row[8] || 'DELIVERED');
  const arProjectId = row[9] ? String(row[9]) : '';
  const arProjectName = row[10] ? String(row[10]) : '';
  const arCustomerId = row[11] ? String(row[11]) : '';
  const strictCorpBankLock = hasInvoice && issueMode !== 'SELF_RETAINED';

  if (status === 'VOIDED' || status === 'COLLECTED' || prevRemaining <= 0) {
    throw new Error('該應收請款單已結清或已作廢，無須重複收款');
  }
  if (payload.amount <= 0) throw new Error('收款沖銷金額必須大於 0');
  if (payload.amount > prevRemaining + 0.01) {
    throw new Error(`沖銷應收本金 (NT$ ${payload.amount.toLocaleString()}) 不可超過未收餘額；溢收部分請填入超付欄位或直入案場預收`);
  }

  const feeAmt = Math.max(0, Number(payload.feeAmount || 0));
  const overpayAmt = Math.max(0, Number(payload.overpaymentAmount || 0));
  const netReceived = Math.max(0, payload.amount - feeAmt + overpayAmt);

  let bankAccName = '公司現金櫃台';
  let actualBankCompanyId = arCompanyId;
  if (payload.collectionMethod !== 'CASH') {
    const bRes = dbInstance.exec(`
      SELECT companyId, bankName, accountName, isVirtualAccount, status
      FROM company_bank_accounts WHERE id = '${payload.bankAccountId}';
    `);
    if (!bRes.length || !bRes[0].values.length) {
      throw new Error('找不到指定的收款銀行帳戶');
    }
    const bCompanyId = String(bRes[0].values[0][0]);
    actualBankCompanyId = bCompanyId;
    const bBankName = String(bRes[0].values[0][1]);
    const bAccName = String(bRes[0].values[0][2]);
    const isVirtual = Boolean(Number(bRes[0].values[0][3] || 0)) || bCompanyId === 'BOSS-01';
    const bStatus = String(bRes[0].values[0][4] || 'ACTIVE');
    if (bStatus !== 'ACTIVE') throw new Error('該銀行帳戶已停用');

    // 🛡️ 鐵律防呆：
    if (strictCorpBankLock) {
      if (isVirtual || bCompanyId !== arCompanyId) {
        throw new Error('防呆攔截：已開立發票之應收款項，資金嚴格只能入「開票公司」實體銀行戶或現金，禁止入老闆私帳或其他公司帳戶！');
      }
    } else {
      if (!isVirtual && bCompanyId !== arCompanyId) {
        throw new Error('防呆攔截：收款帳戶不可跨入其他無關法人公司之銀行專戶！');
      }
    }
    bankAccName = `${bBankName} (${bAccName})`;
  } else if (!strictCorpBankLock) {
    bankAccName = '現金收訖 (免開發票)';
  }

  const colId = `ARC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  let colStatus: ArCollectionRecord['status'] = 'POSTED';
  let checkNoClean = '';

  if (payload.collectionMethod === 'CHECK') {
    checkNoClean = (payload.checkNumber || '').trim();
    if (!checkNoClean) throw new Error('收取業主支票必須填入支票號碼');
    const dueDate = payload.checkDueDate || payload.receivedDate;
    colStatus = 'PENDING_CLEARANCE';

    const chkId = `CHK-AR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    dbInstance.run(`
      INSERT INTO bank_checks (
        id, checkNumber, type, companyId, counterpartyName, amount,
        issueDate, dueDate, bankName, drawerBank, paymentId,
        expectedClearanceDate, status, notes, reconciledArId
      ) VALUES (
        '${chkId}', '${checkNoClean.replace(/'/g, "''")}', 'RECEIVABLE',
        '${arCompanyId}', '${customerName.replace(/'/g, "''")}', ${netReceived},
        '${payload.receivedDate}', '${dueDate}',
        '${bankAccName.replace(/'/g, "''")}',
        ${payload.drawerBank ? `'${payload.drawerBank.replace(/'/g, "''")}'` : 'NULL'},
        '${colId}', '${dueDate}', 'ISSUED',
        '業主應收單 [${arNumber}] 收受支票 (待兌現入帳)', '${payload.arId}'
      );
    `);
  } else {
    if (payload.bankAccountId && payload.bankAccountId !== 'CASH') {
      dbInstance.run(`
        UPDATE company_bank_accounts
        SET currentBalance = currentBalance + ${netReceived}
        WHERE id = '${payload.bankAccountId}';
      `);
    }
  }

  // 若業主多給錢 (overpayAmt > 0)：預設直接掛入「該案場預收款（貸方）」，不再丟進未知大水池！
  let overpaySuspenseNote = '';
  const overMode = payload.overpaymentHandling || 'TO_PROJECT_ADVANCE';
  if (overpayAmt > 0.01 && overMode === 'TO_PROJECT_ADVANCE' && arProjectId) {
    const advId = `PADV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const advBankId = payload.collectionMethod === 'CASH' ? 'CASH' : payload.bankAccountId;
    dbInstance.run(`
      INSERT INTO fin_project_advances (
        id, projectId, projectName, customerId, customerName, companyId,
        bankAccountId, bankAccountName, collectionMethod, amount, receivedDate,
        sourceType, sourceArId, sourceCheckNumber, notes, createdBy, createdAt
      ) VALUES (
        '${advId}', '${arProjectId}',
        ${arProjectName ? `'${arProjectName.replace(/'/g, "''")}'` : 'NULL'},
        '${arCustomerId}', '${customerName.replace(/'/g, "''")}', '${actualBankCompanyId}',
        '${advBankId}', '${bankAccName.replace(/'/g, "''")}', '${payload.collectionMethod}',
        ${overpayAmt}, '${payload.receivedDate}', 'OVERPAYMENT', '${payload.arId}',
        ${checkNoClean ? `'${checkNoClean.replace(/'/g, "''")}'` : 'NULL'},
        '由應收單 [${arNumber}] 超付溢收直入案場借貸總帳（銀行實收 NT$ ${netReceived.toLocaleString()} 已同步入庫）',
        '${operatorName.replace(/'/g, "''")}', '${now}'
      );
    `);
    overpaySuspenseNote = ` · 溢收 NT$ ${overpayAmt.toLocaleString()} 直入案場預收 [${advId}]`;
  } else if (overpayAmt > 0.01 && overMode === 'TO_SUSPENSE') {
    const suspId = `SUSP-OVER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const suspPayer = `業主超付溢收 (${arNumber} · ${customerName})`;
    const suspBankId = payload.collectionMethod === 'CASH' ? 'CASH' : payload.bankAccountId;
    dbInstance.run(`
      INSERT INTO fin_suspense_receipts (
        id, companyId, bankAccountId, bankAccountName, amount, allocatedAmount, remainingAmount,
        receivedDate, payerInfo, isAllocated, allocatedToArId, notes, createdAt
      ) VALUES (
        '${suspId}', '${actualBankCompanyId}', '${suspBankId}', '${bankAccName.replace(/'/g, "''")}',
        ${overpayAmt}, 0, ${overpayAmt}, '${payload.receivedDate}',
        '${suspPayer.replace(/'/g, "''")}', 0, NULL,
        '由應收單 [${arNumber}] 超付溢收轉入暫收池',
        '${now}'
      );
    `);
    overpaySuspenseNote = ` · 溢收 NT$ ${overpayAmt.toLocaleString()} 已轉暫收池 [${suspId}]`;
  } else if (overpayAmt > 0.01) {
    overpaySuspenseNote = ` · 溢收 NT$ ${overpayAmt.toLocaleString()} 直接認列結清`;
  }

  const finalColNotes = `${payload.notes ? payload.notes.trim() : ''}${overpaySuspenseNote}`.trim();

  dbInstance.run(`
    INSERT INTO fin_ar_collections (
      id, arId, arNumber, companyId, collectionMethod, bankAccountId, bankAccountName,
      amount, feeAmount, overpaymentAmount, netReceivedAmount, checkNumber, checkDueDate, drawerBank,
      receivedDate, status, notes, createdBy, createdAt
    ) VALUES (
      '${colId}', '${payload.arId}', '${arNumber}', '${arCompanyId}',
      '${payload.collectionMethod}', '${payload.bankAccountId}', '${bankAccName.replace(/'/g, "''")}',
      ${payload.amount}, ${feeAmt}, ${overpayAmt}, ${netReceived},
      ${checkNoClean ? `'${checkNoClean.replace(/'/g, "''")}'` : 'NULL'},
      ${payload.checkDueDate ? `'${payload.checkDueDate}'` : 'NULL'},
      ${payload.drawerBank ? `'${payload.drawerBank.replace(/'/g, "''")}'` : 'NULL'},
      '${payload.receivedDate}', '${colStatus}',
      ${finalColNotes ? `'${finalColNotes.replace(/'/g, "''")}'` : 'NULL'},
      '${operatorName.replace(/'/g, "''")}', '${now}'
    );
  `);

  const nextApplied = prevApplied + payload.amount;
  const nextRemaining = Math.max(0, totalAmount - nextApplied);
  const nextStatus = nextRemaining <= 0.01 ? 'COLLECTED' : 'PARTIAL';

  dbInstance.run(`
    UPDATE accounts_receivable
    SET appliedAmount = ${nextApplied},
        remainingAmount = ${nextRemaining},
        status = '${nextStatus}',
        bouncedCheckNumber = NULL,
        bouncedReason = NULL,
        bouncedAt = NULL,
        updatedAt = '${now}'
    WHERE id = '${payload.arId}';
  `);

  recordAuditLog(
    operatorName,
    payload.collectionMethod === 'CHECK' ? '出納收受業主支票 (AR)' : '出納收款入帳 (AR)',
    '出納資金收付工作台',
    arNumber,
    {
      '請款單號': arNumber,
      '業主客戶': customerName,
      '收款方式': payload.collectionMethod === 'CHECK' ? `支票 (${checkNoClean} · 待兌現)` : payload.collectionMethod === 'TT' ? '銀行轉帳' : '現金收訖',
      '入帳帳戶': bankAccName,
      '沖銷應收': `NT$ ${payload.amount.toLocaleString()}`,
      '少收折讓/匯費': feeAmt > 0 ? `NT$ ${feeAmt.toLocaleString()}` : '0',
      '超付溢收': overpayAmt > 0 ? `NT$ ${overpayAmt.toLocaleString()} (${overMode === 'TO_PROJECT_ADVANCE' ? '直入案場預收' : overMode === 'TO_SUSPENSE' ? '轉暫收池' : '直接認列'})` : '0',
      '實際入庫金額': `NT$ ${netReceived.toLocaleString()}`,
      '收款後狀態': nextStatus === 'COLLECTED' ? '已收齊結清' : `部分收款 (餘 NT$ ${nextRemaining.toLocaleString()})`,
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id: colId,
    arId: payload.arId,
    arNumber,
    companyId: arCompanyId,
    collectionMethod: payload.collectionMethod,
    bankAccountId: payload.bankAccountId,
    bankAccountName: bankAccName,
    amount: payload.amount,
    feeAmount: feeAmt,
    overpaymentAmount: overpayAmt,
    netReceivedAmount: netReceived,
    checkNumber: checkNoClean || undefined,
    checkDueDate: payload.checkDueDate,
    drawerBank: payload.drawerBank,
    receivedDate: payload.receivedDate,
    status: colStatus,
    notes: finalColNotes || undefined,
    createdBy: operatorName,
    createdAt: now,
  };
}
