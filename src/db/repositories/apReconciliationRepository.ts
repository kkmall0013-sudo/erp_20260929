import type {
  AccountPayable,
  AccountsPayableReconciliation
} from '../../types/erp';
import {
  formatLocalDateIso,
  getDbInstance,
  notifyListeners,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { ensureDatabaseIntegrity } from '../core/dbIntegrity';
import { recordAuditLog } from './auditRepository';
import { syncDocumentInvoice } from './invoiceAndTaxRepository';

// 讀取應付帳款 AP
export function getAllAccountsPayable(): AccountPayable[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT * FROM accounts_payable ORDER BY dueDate;`);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    apNumber: String(v[1]),
    sourceTable: v[2] as AccountPayable['sourceTable'],
    sourceId: String(v[3]),
    companyId: String(v[4]),
    vendorId: String(v[5]),
    vendorName: String(v[6]),
    originalAmount: Number(v[7] || 0),
    appliedAmount: Number(v[8] || 0),
    remainingAmount: Number(v[9] || 0),
    dueDate: String(v[10]),
    invoiceNumber: v[11] ? String(v[11]) : undefined,
    taxReportingCompanyId: v[12] ? String(v[12]) : undefined,
    status: v[13] as AccountPayable['status'],
    createdAt: String(v[14]),
  }));
}

// -------------------------------------------------------------
// 🏛️ 會計應付對帳大水池 (AP Reconciliation) 核心 CRUD
// -------------------------------------------------------------

export function getAllApReconciliations(): AccountsPayableReconciliation[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureDatabaseIntegrity(dbInstance);
  try {
    try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN designatedPaymentMethod TEXT DEFAULT 'CHECK';`); } catch (_) {}
    try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN designatedBankAccountId TEXT;`); } catch (_) {}
    try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN designatedBankAccountName TEXT;`); } catch (_) {}
    try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN paymentTermNotes TEXT;`); } catch (_) {}
    try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN isBossAdvance INTEGER DEFAULT 0;`); } catch (_) {}
    try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN bouncedCheckNumber TEXT;`); } catch (_) {}
    try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN bouncedReason TEXT;`); } catch (_) {}
    try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN bouncedAt TEXT;`); } catch (_) {}
    try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN designatedCheckNumber TEXT;`); } catch (_) {}
    try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN returnedReason TEXT;`); } catch (_) {}
    try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN returnedBy TEXT;`); } catch (_) {}
    try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN returnedAt TEXT;`); } catch (_) {}

    const res = dbInstance.exec(`
      SELECT 
        id, reconciliationNumber, companyId, vendorId, vendorName, billingPeriod,
        inboundTotalAmount, discountAmount, taxType, taxAmount, netPayableAmount,
        invoiceNumber, hasInvoice, paymentDueDate, status, reconciledBy, approvedBy,
        disbursedAt, notes, receiptIds, isDeleted, version, createdAt, updatedAt,
        designatedPaymentMethod, designatedBankAccountId, designatedBankAccountName, paymentTermNotes,
        isBossAdvance, bouncedCheckNumber, bouncedReason, bouncedAt, designatedCheckNumber,
        returnedReason, returnedBy, returnedAt
      FROM ap_reconciliations 
      WHERE isDeleted = 0 
      ORDER BY paymentDueDate ASC, reconciliationNumber DESC;
    `);
    if (!res.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      reconciliationNumber: String(v[1]),
      companyId: String(v[2]),
      vendorId: String(v[3]),
      vendorName: v[4] ? String(v[4]) : undefined,
      billingPeriod: String(v[5]),
      inboundTotalAmount: Number(v[6] || 0),
      discountAmount: Number(v[7] || 0),
      taxType: (v[8] || 'TAX_EXCLUSIVE') as AccountsPayableReconciliation['taxType'],
      taxAmount: Number(v[9] || 0),
      netPayableAmount: Number(v[10] || 0),
      invoiceNumber: v[11] ? String(v[11]) : undefined,
      hasInvoice: Boolean(v[12]),
      paymentDueDate: String(v[13]),
      status: (v[14] || 'APPROVED') as AccountsPayableReconciliation['status'],
      reconciledBy: v[15] ? String(v[15]) : undefined,
      approvedBy: v[16] ? String(v[16]) : undefined,
      disbursedAt: v[17] ? String(v[17]) : undefined,
      notes: v[18] ? String(v[18]) : undefined,
      receiptIds: v[19] ? JSON.parse(String(v[19])) : [],
      isDeleted: Boolean(v[20]),
      version: Number(v[21] || 1),
      createdAt: v[22] ? String(v[22]) : undefined,
      updatedAt: v[23] ? String(v[23]) : undefined,
      designatedPaymentMethod: v[24] ? (String(v[24]) as AccountsPayableReconciliation['designatedPaymentMethod']) : undefined,
      designatedBankAccountId: v[25] ? String(v[25]) : undefined,
      designatedBankAccountName: v[26] ? String(v[26]) : undefined,
      paymentTermNotes: v[27] ? String(v[27]) : undefined,
      isBossAdvance: Boolean(v[28]),
      bouncedCheckNumber: v[29] ? String(v[29]) : undefined,
      bouncedReason: v[30] ? String(v[30]) : undefined,
      bouncedAt: v[31] ? String(v[31]) : undefined,
      designatedCheckNumber: v[32] ? String(v[32]) : undefined,
      returnedReason: v[33] ? String(v[33]) : undefined,
      returnedBy: v[34] ? String(v[34]) : undefined,
      returnedAt: v[35] ? String(v[35]) : undefined,
    }));
  } catch (e) {
    console.error('getAllApReconciliations error', e);
    return [];
  }
}

// 檢查指定進貨單是否已被其他未作廢對帳單占用（防止同一進貨單重複請款）
function assertReceiptsAvailableForReconciliation(receiptIds: string[], excludeRecId?: string): void {
  const dbInstance = getDbInstance();
  if (!dbInstance || !receiptIds || receiptIds.length === 0) return;

  const targetSet = new Set(receiptIds);
  const excludeSql = excludeRecId ? `AND id != '${excludeRecId.replace(/'/g, "''")}'` : '';
  const activeRes = dbInstance.exec(`
    SELECT id, reconciliationNumber, status, receiptIds
    FROM ap_reconciliations
    WHERE isDeleted = 0 AND status != 'VOIDED' ${excludeSql};
  `);

  const statusLabels: Record<string, string> = {
    DRAFT: '草稿暫存',
    RETURNED: '退回重算中',
    APPROVED: '已核准待放款',
    PAID: '已出金結清',
  };

  if (activeRes.length && activeRes[0].values.length) {
    for (const row of activeRes[0].values) {
      const conflictRecNo = String(row[1]);
      const conflictStatus = String(row[2] || 'APPROVED');
      let existingIds: string[] = [];
      try {
        existingIds = row[3] ? JSON.parse(String(row[3])) : [];
      } catch (_) {}

      const overlapId = existingIds.find(rid => targetSet.has(rid));
      if (overlapId) {
        let receiptNo = overlapId;
        try {
          const rRes = dbInstance.exec(`SELECT receiptNumber FROM inbound_receipts WHERE id = '${overlapId.replace(/'/g, "''")}';`);
          if (rRes.length && rRes[0].values.length) {
            receiptNo = String(rRes[0].values[0][0]);
          }
        } catch (_) {}
        throw new Error(
          `進貨單【${receiptNo}】已掛載於對帳單【${conflictRecNo}】（狀態：${statusLabels[conflictStatus] || conflictStatus}），禁止重複建立請款！`
        );
      }
    }
  }
}

export function createApReconciliation(
  data: Omit<AccountsPayableReconciliation, 'id' | 'createdAt' | 'updatedAt' | 'version'> & { id?: string },
  operatorName: string = '張會計長'
): AccountsPayableReconciliation {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const uniqueReceiptIds = Array.from(new Set(data.receiptIds || []));
  assertReceiptsAvailableForReconciliation(uniqueReceiptIds);

  const now = new Date().toISOString();
  const id = data.id || `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const receiptIdsJson = JSON.stringify(uniqueReceiptIds);

  try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN isBossAdvance INTEGER DEFAULT 0;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN designatedCheckNumber TEXT;`); } catch (_) {}

  const designatedMethodSql = data.designatedPaymentMethod ? `'${data.designatedPaymentMethod}'` : 'NULL';
  const designatedBankId = data.designatedBankAccountId ? `'${data.designatedBankAccountId.replace(/'/g, "''")}'` : 'NULL';
  const designatedBankName = data.designatedBankAccountName ? `'${data.designatedBankAccountName.replace(/'/g, "''")}'` : 'NULL';
  const designatedCheckNo = data.designatedCheckNumber ? `'${data.designatedCheckNumber.replace(/'/g, "''")}'` : 'NULL';
  const paymentNotes = data.paymentTermNotes ? `'${data.paymentTermNotes.replace(/'/g, "''")}'` : 'NULL';
  const bossAdvVal = data.isBossAdvance ? 1 : 0;

  dbInstance.run(`
    INSERT INTO ap_reconciliations (
      id, reconciliationNumber, companyId, vendorId, vendorName, billingPeriod,
      inboundTotalAmount, discountAmount, taxType, taxAmount, netPayableAmount,
      invoiceNumber, hasInvoice, paymentDueDate, status, reconciledBy, approvedBy,
      disbursedAt, notes, receiptIds, isDeleted, version, createdAt, updatedAt,
      designatedPaymentMethod, designatedBankAccountId, designatedBankAccountName, paymentTermNotes,
      isBossAdvance, designatedCheckNumber
    ) VALUES (
      '${id}', '${data.reconciliationNumber}', '${data.companyId}', '${data.vendorId}',
      '${(data.vendorName || '').replace(/'/g, "''")}', '${data.billingPeriod}',
      ${data.inboundTotalAmount}, ${data.discountAmount}, '${data.taxType}', ${data.taxAmount},
      ${data.netPayableAmount}, ${data.invoiceNumber ? `'${data.invoiceNumber.replace(/'/g, "''")}'` : 'NULL'},
      ${data.hasInvoice ? 1 : 0}, '${data.paymentDueDate}', '${data.status}',
      '${operatorName}', ${data.status === 'APPROVED' ? `'${operatorName}'` : 'NULL'},
      NULL, '${(data.notes || '').replace(/'/g, "''")}', '${receiptIdsJson}',
      0, 1, '${now}', '${now}',
      ${designatedMethodSql}, ${designatedBankId}, ${designatedBankName}, ${paymentNotes},
      ${bossAdvVal}, ${designatedCheckNo}
    );
  `);

  if (data.status !== 'VOIDED' && uniqueReceiptIds.length > 0) {
    const inList = uniqueReceiptIds.map((rid: string) => `'${rid}'`).join(',');
    dbInstance.run(`
      UPDATE inbound_receipts
      SET billingStatus = 'BILLED',
          reconciliationId = '${id}',
          reconciliationNumber = '${data.reconciliationNumber}',
          updatedAt = '${now}'
      WHERE id IN (${inList});
    `);
  }

  if (data.status === 'APPROVED') {
    try {
      dbInstance.run(`
        INSERT OR REPLACE INTO accounts_payable (
          id, apNumber, sourceTable, sourceId, companyId, vendorId, vendorName,
          originalAmount, appliedAmount, remainingAmount, dueDate, invoiceNumber,
          taxReportingCompanyId, status, createdAt
        ) VALUES (
          'AP-${id}', '${data.reconciliationNumber}', 'INBOUND_RECONCILIATION', '${id}',
          '${data.companyId}', '${data.vendorId}', '${(data.vendorName || '').replace(/'/g, "''")}',
          ${data.netPayableAmount}, 0, ${data.netPayableAmount}, '${data.paymentDueDate}',
          ${data.invoiceNumber ? `'${data.invoiceNumber.replace(/'/g, "''")}'` : 'NULL'},
          '${data.companyId}', 'OPEN', '${now}'
        );
      `);
    } catch (_) {}

    if (data.hasInvoice && data.invoiceNumber?.trim()) {
      try {
        syncDocumentInvoice(dbInstance, {
          invoiceType: 'INPUT',
          invoiceNumber: data.invoiceNumber.trim(),
          invoiceDate: data.paymentDueDate || formatLocalDateIso(),
          companyId: data.companyId,
          partnerId: data.vendorId,
          partnerName: data.vendorName || '',
          netAmount: Math.max(0, data.netPayableAmount - data.taxAmount),
          taxAmount: data.taxAmount,
          totalAmount: data.netPayableAmount,
          sourceDocumentType: 'AP',
          sourceDocumentId: id,
        });
      } catch (_) {}
    }
  }

  recordAuditLog(
    operatorName,
    '建立廠商應付對帳單',
    '會計應付對帳大水池',
    data.reconciliationNumber,
    {
      '對帳單號': data.reconciliationNumber,
      '廠商名稱': data.vendorName || data.vendorId,
      '期別': data.billingPeriod,
      '進貨總額': `NT$ ${data.inboundTotalAmount.toLocaleString()}`,
      '折讓扣除': `NT$ ${data.discountAmount.toLocaleString()}`,
      '營業稅': `NT$ ${data.taxAmount.toLocaleString()}`,
      '應付淨額': `NT$ ${data.netPayableAmount.toLocaleString()}`,
      '勾稽進貨單筆數': `${uniqueReceiptIds.length} 筆`,
      '預計付款日': data.paymentDueDate,
      '發票字軌': data.invoiceNumber || (data.hasInvoice ? '待補票' : '免用統一發票'),
      '老闆私帳代墊': data.isBossAdvance ? '是 (特例)' : '否'
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    ...data,
    receiptIds: uniqueReceiptIds,
    id,
    createdAt: now,
    updatedAt: now,
    version: 1
  };
}

export function voidApReconciliation(
  id: string,
  reason: string,
  operatorName: string = '張會計長'
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();

  const res = dbInstance.exec(`SELECT reconciliationNumber, receiptIds FROM ap_reconciliations WHERE id = '${id}';`);
  if (!res.length || !res[0].values.length) throw new Error('找不到該應付對帳單');
  const recNumber = String(res[0].values[0][0]);
  const receiptIdsRaw = res[0].values[0][1];
  let receiptIds: string[] = [];
  try {
    receiptIds = receiptIdsRaw ? JSON.parse(String(receiptIdsRaw)) : [];
  } catch (_) {}

  dbInstance.run(`
    UPDATE ap_reconciliations
    SET status = 'VOIDED', notes = COALESCE(notes, '') || ' [作廢原因: ${reason.replace(/'/g, "''")}]', updatedAt = '${now}'
    WHERE id = '${id}';
  `);

  dbInstance.run(`
    UPDATE inbound_receipts
    SET billingStatus = 'PENDING_BILLING',
        reconciliationId = NULL,
        reconciliationNumber = NULL,
        updatedAt = '${now}'
    WHERE reconciliationId = '${id}';
  `);

  if (receiptIds.length > 0) {
    const otherActiveRes = dbInstance.exec(`
      SELECT id, reconciliationNumber, receiptIds
      FROM ap_reconciliations
      WHERE isDeleted = 0 AND status != 'VOIDED' AND id != '${id}';
    `);
    if (otherActiveRes.length && otherActiveRes[0].values.length) {
      for (const row of otherActiveRes[0].values) {
        const otherId = String(row[0]);
        const otherNo = String(row[1]);
        let otherRids: string[] = [];
        try {
          otherRids = row[2] ? JSON.parse(String(row[2])) : [];
        } catch (_) {}
        const overlap = otherRids.filter(rid => receiptIds.includes(rid));
        if (overlap.length > 0) {
          const inList = overlap.map(rid => `'${rid}'`).join(',');
          dbInstance.run(`
            UPDATE inbound_receipts
            SET billingStatus = 'BILLED',
                reconciliationId = '${otherId}',
                reconciliationNumber = '${otherNo}',
                updatedAt = '${now}'
            WHERE id IN (${inList});
          `);
        }
      }
    }
  }

  try {
    dbInstance.run(`UPDATE accounts_payable SET status = 'VOIDED' WHERE sourceId = '${id}';`);
  } catch (_) {}

  recordAuditLog(
    operatorName,
    '作廢應付對帳單 (水池回滾釋放)',
    '會計應付對帳大水池',
    recNumber,
    {
      '對帳單號': recNumber,
      '作廢原因': reason,
      '受回滾進貨單筆數': `${receiptIds.length} 筆已重返待對帳水池`
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();
}

export function returnApReconciliationToAccounting(
  id: string,
  reason: string,
  operatorName: string = '出納專員'
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error('請填寫退回會計重算的原因');

  try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN returnedReason TEXT;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN returnedBy TEXT;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN returnedAt TEXT;`); } catch (_) {}

  const res = dbInstance.exec(`SELECT reconciliationNumber, status, vendorName, netPayableAmount FROM ap_reconciliations WHERE id = '${id}' AND isDeleted = 0;`);
  if (!res.length || !res[0].values.length) throw new Error('找不到該應付對帳單');
  const recNumber = String(res[0].values[0][0]);
  const currentStatus = String(res[0].values[0][1]);
  const vendorName = String(res[0].values[0][2] || '');
  const netPayable = Number(res[0].values[0][3] || 0);

  if (currentStatus !== 'APPROVED') {
    throw new Error('僅「待出金放款」狀態的對帳單可退回會計重算');
  }

  const now = new Date().toISOString();
  const safeReason = trimmedReason.replace(/'/g, "''");
  const safeOp = operatorName.replace(/'/g, "''");

  dbInstance.run(`
    UPDATE ap_reconciliations
    SET status = 'RETURNED',
        returnedReason = '${safeReason}',
        returnedBy = '${safeOp}',
        returnedAt = '${now}',
        updatedAt = '${now}',
        version = version + 1
    WHERE id = '${id}';
  `);

  try {
    dbInstance.run(`UPDATE accounts_payable SET status = 'RETURNED' WHERE sourceId = '${id}';`);
  } catch (_) {}

  recordAuditLog(
    operatorName,
    '出納退回對帳單請會計重算',
    '出納放款與收納工作台',
    recNumber,
    {
      '對帳單號': recNumber,
      '廠商': vendorName,
      '原核定金額': `NT$ ${netPayable.toLocaleString()}`,
      '退回原因': trimmedReason,
      '退回人員': operatorName
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();
}

export function updateApReconciliation(
  id: string,
  data: Partial<Omit<AccountsPayableReconciliation, 'id' | 'createdAt' | 'version'>>,
  operatorName: string = '會計專員'
): AccountsPayableReconciliation {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const existingRes = dbInstance.exec(`
    SELECT reconciliationNumber, companyId, vendorId, vendorName, billingPeriod, status, receiptIds, createdAt
    FROM ap_reconciliations WHERE id = '${id}' AND isDeleted = 0;
  `);
  if (!existingRes.length || !existingRes[0].values.length) {
    throw new Error('找不到要編輯重算的應付對帳單');
  }
  const row = existingRes[0].values[0];
  const recNumber = String(row[0]);
  const existingStatus = String(row[5]);
  if (existingStatus === 'PAID' || existingStatus === 'VOIDED') {
    throw new Error('已出金結清或已作廢之對帳單不可直接重算修改');
  }

  const now = new Date().toISOString();
  const nextStatus = (data.status || 'APPROVED') as AccountsPayableReconciliation['status'];
  const nextCompanyId = data.companyId || String(row[1]);
  const vendorId = data.vendorId || String(row[2]);
  const vendorName = data.vendorName || String(row[3] || '');
  const billingPeriod = data.billingPeriod || String(row[4]);
  const rawReceiptIds: string[] = data.receiptIds || (row[6] ? JSON.parse(String(row[6])) : []);
  const nextReceiptIds: string[] = Array.from(new Set(rawReceiptIds));
  assertReceiptsAvailableForReconciliation(nextReceiptIds, id);

  const receiptIdsJson = JSON.stringify(nextReceiptIds);
  const createdAt = row[7] ? String(row[7]) : now;

  const inboundTotal = Number(data.inboundTotalAmount ?? 0);
  const discountAmt = Number(data.discountAmount ?? 0);
  const taxType = data.taxType || 'TAX_EXCLUSIVE';
  const taxAmt = Number(data.taxAmount ?? 0);
  const netPayable = Number(data.netPayableAmount ?? 0);
  const hasInvoice = data.hasInvoice !== false;
  const invoiceNumSql = data.invoiceNumber ? `'${data.invoiceNumber.replace(/'/g, "''")}'` : 'NULL';
  const paymentDueDate = data.paymentDueDate || formatLocalDateIso();
  const paymentNotesSql = data.paymentTermNotes ? `'${data.paymentTermNotes.replace(/'/g, "''")}'` : 'NULL';
  const notesSql = `'${(data.notes || '').replace(/'/g, "''")}'`;
  const bossAdvVal = data.isBossAdvance ? 1 : 0;
  const clearReturnedSql = nextStatus === 'APPROVED'
    ? `, returnedReason = NULL, returnedBy = NULL, returnedAt = NULL`
    : '';

  dbInstance.run(`
    UPDATE inbound_receipts
    SET billingStatus = 'PENDING_BILLING',
        reconciliationId = NULL,
        reconciliationNumber = NULL,
        updatedAt = '${now}'
    WHERE reconciliationId = '${id}';
  `);

  dbInstance.run(`
    UPDATE ap_reconciliations
    SET companyId = '${nextCompanyId}',
        vendorName = '${vendorName.replace(/'/g, "''")}',
        billingPeriod = '${billingPeriod}',
        inboundTotalAmount = ${inboundTotal},
        discountAmount = ${discountAmt},
        taxType = '${taxType}',
        taxAmount = ${taxAmt},
        netPayableAmount = ${netPayable},
        invoiceNumber = ${invoiceNumSql},
        hasInvoice = ${hasInvoice ? 1 : 0},
        paymentDueDate = '${paymentDueDate}',
        status = '${nextStatus}',
        reconciledBy = '${operatorName.replace(/'/g, "''")}',
        approvedBy = ${nextStatus === 'APPROVED' ? `'${operatorName.replace(/'/g, "''")}'` : 'NULL'},
        notes = ${notesSql},
        receiptIds = '${receiptIdsJson}',
        paymentTermNotes = ${paymentNotesSql},
        isBossAdvance = ${bossAdvVal},
        updatedAt = '${now}',
        version = version + 1
        ${clearReturnedSql}
    WHERE id = '${id}';
  `);

  if (nextStatus !== 'VOIDED' && nextReceiptIds.length > 0) {
    const inList = nextReceiptIds.map((rid: string) => `'${rid}'`).join(',');
    dbInstance.run(`
      UPDATE inbound_receipts
      SET billingStatus = 'BILLED',
          reconciliationId = '${id}',
          reconciliationNumber = '${recNumber}',
          updatedAt = '${now}'
      WHERE id IN (${inList});
    `);
  }

  if (nextStatus === 'APPROVED') {
    try {
      dbInstance.run(`
        INSERT OR REPLACE INTO accounts_payable (
          id, apNumber, sourceTable, sourceId, companyId, vendorId, vendorName,
          originalAmount, appliedAmount, remainingAmount, dueDate, invoiceNumber,
          taxReportingCompanyId, status, createdAt
        ) VALUES (
          'AP-${id}', '${recNumber}', 'INBOUND_RECONCILIATION', '${id}',
          '${nextCompanyId}', '${vendorId}', '${vendorName.replace(/'/g, "''")}',
          ${netPayable}, 0, ${netPayable}, '${paymentDueDate}',
          ${invoiceNumSql},
          '${nextCompanyId}', 'OPEN', '${now}'
        );
      `);
    } catch (_) {}

    if (hasInvoice && data.invoiceNumber?.trim()) {
      try {
        syncDocumentInvoice(dbInstance, {
          invoiceType: 'INPUT',
          invoiceNumber: data.invoiceNumber.trim(),
          invoiceDate: paymentDueDate || formatLocalDateIso(),
          companyId: nextCompanyId,
          partnerId: vendorId,
          partnerName: vendorName,
          netAmount: Math.max(0, netPayable - taxAmt),
          taxAmount: taxAmt,
          totalAmount: netPayable,
          sourceDocumentType: 'AP',
          sourceDocumentId: id,
        });
      } catch (_) {}
    }
  } else {
    try {
      dbInstance.run(`UPDATE accounts_payable SET status = '${nextStatus}' WHERE sourceId = '${id}';`);
    } catch (_) {}
  }

  recordAuditLog(
    operatorName,
    nextStatus === 'APPROVED' ? '會計重算並重新核准對帳單' : '更新對帳單草稿',
    '會計應付對帳大水池',
    recNumber,
    {
      '對帳單號': recNumber,
      '廠商名稱': vendorName,
      '稅別': taxType,
      '重算營業稅額': `NT$ ${taxAmt.toLocaleString()}`,
      '重算應付淨額': `NT$ ${netPayable.toLocaleString()}`,
      '狀態': nextStatus
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();

  const updatedList = getAllApReconciliations();
  const matched = updatedList.find(r => r.id === id);
  if (matched) return matched;

  return {
    id,
    reconciliationNumber: recNumber,
    companyId: nextCompanyId,
    vendorId,
    vendorName,
    billingPeriod,
    inboundTotalAmount: inboundTotal,
    discountAmount: discountAmt,
    taxType,
    taxAmount: taxAmt,
    netPayableAmount: netPayable,
    invoiceNumber: data.invoiceNumber,
    hasInvoice,
    paymentDueDate,
    status: nextStatus,
    receiptIds: nextReceiptIds,
    paymentTermNotes: data.paymentTermNotes,
    isBossAdvance: Boolean(data.isBossAdvance),
    notes: data.notes,
    createdAt,
    updatedAt: now,
    version: 2,
  };
}

export interface DuplicateApGroup {
  receiptId: string;
  receiptNumber: string;
  keepRecId: string;
  duplicateRecs: { id: string; reconciliationNumber: string; status: string; netPayableAmount: number }[];
}

export function getDuplicateApReconciliationGroups(): DuplicateApGroup[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const allRecs = getAllApReconciliations().filter(r => r.status !== 'VOIDED');
  const byReceipt: Record<string, AccountsPayableReconciliation[]> = {};
  for (const r of allRecs) {
    for (const rid of r.receiptIds || []) {
      if (!byReceipt[rid]) byReceipt[rid] = [];
      byReceipt[rid].push(r);
    }
  }

  const priorityRank: Record<string, number> = { PAID: 4, APPROVED: 3, RETURNED: 2, DRAFT: 1 };
  const groups: DuplicateApGroup[] = [];

  for (const [rid, recs] of Object.entries(byReceipt)) {
    if (recs.length <= 1) continue;
    const sorted = [...recs].sort((a, b) => {
      const rankDiff = (priorityRank[b.status] || 0) - (priorityRank[a.status] || 0);
      if (rankDiff !== 0) return rankDiff;
      return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
    });
    const keep = sorted[0];
    const dupes = sorted.slice(1).filter(d => d.status !== 'PAID');
    if (dupes.length === 0) continue;

    let receiptNo = rid;
    try {
      const rRes = dbInstance.exec(`SELECT receiptNumber FROM inbound_receipts WHERE id = '${rid.replace(/'/g, "''")}';`);
      if (rRes.length && rRes[0].values.length) {
        receiptNo = String(rRes[0].values[0][0]);
      }
    } catch (_) {}

    groups.push({
      receiptId: rid,
      receiptNumber: receiptNo,
      keepRecId: keep.id,
      duplicateRecs: dupes.map(d => ({
        id: d.id,
        reconciliationNumber: d.reconciliationNumber,
        status: d.status,
        netPayableAmount: d.netPayableAmount,
      })),
    });
  }
  return groups;
}

export function cleanupDuplicateApReconciliations(operatorName: string = '會計專員'): number {
  const dbInstance = getDbInstance();
  if (!dbInstance) return 0;
  const groups = getDuplicateApReconciliationGroups();
  if (groups.length === 0) return 0;

  const now = new Date().toISOString();
  const toVoid = new Map<string, string>();
  const keepMap = new Map<string, { recId: string; receiptIds: Set<string> }>();

  for (const g of groups) {
    if (!keepMap.has(g.keepRecId)) {
      keepMap.set(g.keepRecId, { recId: g.keepRecId, receiptIds: new Set() });
    }
    keepMap.get(g.keepRecId)!.receiptIds.add(g.receiptId);
    for (const d of g.duplicateRecs) {
      toVoid.set(d.id, d.reconciliationNumber);
    }
  }

  for (const [dupId, dupNo] of toVoid.entries()) {
    dbInstance.run(`
      UPDATE ap_reconciliations
      SET status = 'VOIDED',
          notes = COALESCE(notes, '') || ' [系統去重作廢: 與既有有效對帳單重複請款]',
          updatedAt = '${now}'
      WHERE id = '${dupId}' AND status != 'PAID';
    `);
    try {
      dbInstance.run(`UPDATE accounts_payable SET status = 'VOIDED' WHERE sourceId = '${dupId}';`);
    } catch (_) {}
    recordAuditLog(operatorName, '清理重複請款對帳單', '會計應付對帳大水池', dupNo, {
      '作廢對帳單號': dupNo,
      '處理原因': '重複占用同一進貨單之異常對帳單自動作廢清理',
    });
  }

  const allRecs = getAllApReconciliations().filter(r => r.status !== 'VOIDED');
  for (const r of allRecs) {
    if (r.receiptIds && r.receiptIds.length > 0) {
      const inList = r.receiptIds.map(rid => `'${rid}'`).join(',');
      dbInstance.run(`
        UPDATE inbound_receipts
        SET billingStatus = 'BILLED',
            reconciliationId = '${r.id}',
            reconciliationNumber = '${r.reconciliationNumber}',
            updatedAt = '${now}'
        WHERE id IN (${inList});
      `);
    }
  }

  saveDatabaseSnapshot();
  notifyListeners();
  return toVoid.size;
}
