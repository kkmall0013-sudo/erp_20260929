import type {
  PurchaseOrder,
  Quotation,
  QuotationBillingMilestone,
  QuotationItem,
  QuotationRevision,
  Subcontract,
  Valuation
} from '../../types/erp';
import {
  getDbInstance,
  notifyListeners,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { recordAuditLog } from './auditRepository';

// 讀取報價單 (含 CPQ 議價模式與影子協議)
export function getAllQuotations(): Quotation[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const res = dbInstance.exec(`
    SELECT id, quoteNumber, projectId, customerId, customerName, companyId,
           currency, netAmount, taxAmount, totalAmount, discountAmount,
           currentRevision, status, validityDate, isDeleted, version,
           createdAt, updatedAt, pricingMode, customDiscountText, agreedTotalAmount, parentQuotationId
    FROM quotations
    WHERE isDeleted = 0
    ORDER BY quoteNumber DESC;
  `);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    quoteNumber: String(v[1]),
    projectId: String(v[2]),
    customerId: String(v[3]),
    customerName: String(v[4] || ''),
    companyId: String(v[5]),
    currency: String(v[6] || 'TWD'),
    netAmount: Number(v[7] || 0),
    taxAmount: Number(v[8] || 0),
    totalAmount: Number(v[9] || 0),
    discountAmount: Number(v[10] || 0),
    currentRevision: String(v[11] || 'REV-A'),
    status: v[12] as Quotation['status'],
    validityDate: String(v[13] || ''),
    isDeleted: Boolean(v[14]),
    version: Number(v[15] || 1),
    createdAt: String(v[16] || ''),
    updatedAt: String(v[17] || ''),
    pricingMode: (v[18] ? String(v[18]) : 'HEADER_DISCOUNT') as any,
    customDiscountText: v[19] ? String(v[19]) : undefined,
    agreedTotalAmount: v[20] !== null && v[20] !== undefined ? Number(v[20]) : undefined,
    parentQuotationId: v[21] ? String(v[21]) : undefined,
  }));
}

// 讀取特定報價單明細項目 (支援粉紅扣款折讓、影子有效單價、部分得標)
export function getQuotationItems(quotationId: string, revisionCode?: string): QuotationItem[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const query = revisionCode
    ? `SELECT id, quotationId, revisionCode, itemType, itemName, spec, quantity, unit, unitPrice, lineTotal, remark, estimatedUnitCost, effectiveUnitPrice, isAwarded, lostReason
       FROM quotation_items WHERE quotationId = '${quotationId}' AND revisionCode = '${revisionCode}';`
    : `SELECT id, quotationId, revisionCode, itemType, itemName, spec, quantity, unit, unitPrice, lineTotal, remark, estimatedUnitCost, effectiveUnitPrice, isAwarded, lostReason
       FROM quotation_items WHERE quotationId = '${quotationId}';`;
  const res = dbInstance.exec(query);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    quotationId: String(v[1]),
    revisionCode: String(v[2]),
    itemType: (v[3] === 'DEDUCTION' ? 'DEDUCTION' : 'NORMAL') as any,
    itemName: String(v[4]),
    spec: String(v[5] || ''),
    quantity: Number(v[6] || 1),
    unit: String(v[7] || '式'),
    unitPrice: Number(v[8] || 0),
    lineTotal: Number(v[9] || 0),
    remark: v[10] ? String(v[10]) : '',
    estimatedUnitCost: Number(v[11] || 0),
    effectiveUnitPrice: Number(v[12] || 0),
    isAwarded: v[13] !== null && v[13] !== undefined ? Boolean(v[13]) : true,
    lostReason: v[14] ? String(v[14]) : '',
  }));
}

// 讀取報價單請款里程碑 (總和必為 100%)
export function getQuotationMilestones(quotationId: string): QuotationBillingMilestone[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const res = dbInstance.exec(`
    SELECT id, quotationId, stageIndex, stageName, percentage, estimatedDate, amount
    FROM quotation_billing_milestones
    WHERE quotationId = '${quotationId}'
    ORDER BY stageIndex ASC;
  `);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    quotationId: String(v[1]),
    stageIndex: Number(v[2]),
    stageName: String(v[3]),
    percentage: Number(v[4]),
    estimatedDate: v[5] ? String(v[5]) : '',
    amount: Number(v[6] || 0),
  }));
}

// 讀取報價單版次歷程
export function getQuotationRevisions(quotationId: string): QuotationRevision[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const res = dbInstance.exec(`
    SELECT id, quotationId, revisionCode, netAmount, taxAmount, totalAmount, isWinning, lostReason, createdAt, pricingMode, discountAmount
    FROM quotation_revisions
    WHERE quotationId = '${quotationId}'
    ORDER BY createdAt ASC;
  `);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    quotationId: String(v[1]),
    revisionCode: String(v[2]),
    netAmount: Number(v[3] || 0),
    taxAmount: Number(v[4] || 0),
    totalAmount: Number(v[5] || 0),
    isWinning: Boolean(v[6]),
    lostReason: v[7] ? String(v[7]) : '',
    createdAt: String(v[8]),
    pricingMode: v[9] ? (String(v[9]) as any) : 'HEADER_DISCOUNT',
    discountAmount: Number(v[10] || 0),
  }));
}

// 儲存/建立報價單 (含主單、明細、里程碑與版次歷程，遵循幽靈小數洗滌與有效影子單價)
export function saveQuotation(
  quotation: Quotation,
  items: QuotationItem[],
  milestones: QuotationBillingMilestone[],
  operatorName: string = '系統操作員'
): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const now = new Date().toISOString();
  const existing = getAllQuotations().find(q => q.id === quotation.id);

  const awardedStandardItems = items.filter(i => (i.isAwarded !== false) && i.itemType !== 'DEDUCTION');
  const sumAwardedNet = awardedStandardItems.reduce((acc, it) => acc + Math.round(it.quantity * it.unitPrice), 0);
  const targetNet = quotation.netAmount;
  const allocationRatio = sumAwardedNet > 0 ? (targetNet / sumAwardedNet) : 1;

  if (existing) {
    dbInstance.run(`
      UPDATE quotations
      SET quoteNumber = '${quotation.quoteNumber.replace(/'/g, "''")}',
          projectId = '${quotation.projectId}',
          customerId = '${quotation.customerId}',
          customerName = '${(quotation.customerName || '').replace(/'/g, "''")}',
          companyId = '${quotation.companyId}',
          currency = '${quotation.currency || 'TWD'}',
          pricingMode = '${quotation.pricingMode || 'HEADER_DISCOUNT'}',
          customDiscountText = ${quotation.customDiscountText ? `'${quotation.customDiscountText.replace(/'/g, "''")}'` : 'NULL'},
          agreedTotalAmount = ${quotation.agreedTotalAmount !== undefined ? quotation.agreedTotalAmount : 'NULL'},
          netAmount = ${Math.round(quotation.netAmount)},
          taxAmount = ${Math.round(quotation.taxAmount)},
          totalAmount = ${Math.round(quotation.totalAmount)},
          discountAmount = ${Math.round(quotation.discountAmount || 0)},
          currentRevision = '${quotation.currentRevision || 'REV-A'}',
          status = '${quotation.status}',
          validityDate = '${quotation.validityDate || ''}',
          version = version + 1,
          updatedAt = '${now}'
      WHERE id = '${quotation.id}';
    `);
  } else {
    dbInstance.run(`
      INSERT INTO quotations (
        id, quoteNumber, projectId, customerId, customerName, companyId,
        currency, netAmount, taxAmount, totalAmount, discountAmount,
        currentRevision, status, validityDate, isDeleted, version,
        createdAt, updatedAt, pricingMode, customDiscountText, agreedTotalAmount, parentQuotationId
      ) VALUES (
        '${quotation.id}', '${quotation.quoteNumber.replace(/'/g, "''")}', '${quotation.projectId}',
        '${quotation.customerId}', '${(quotation.customerName || '').replace(/'/g, "''")}', '${quotation.companyId}',
        '${quotation.currency || 'TWD'}', ${Math.round(quotation.netAmount)}, ${Math.round(quotation.taxAmount)},
        ${Math.round(quotation.totalAmount)}, ${Math.round(quotation.discountAmount || 0)},
        '${quotation.currentRevision || 'REV-A'}', '${quotation.status}', '${quotation.validityDate || ''}',
        0, 1, '${now}', '${now}',
        '${quotation.pricingMode || 'HEADER_DISCOUNT'}',
        ${quotation.customDiscountText ? `'${quotation.customDiscountText.replace(/'/g, "''")}'` : 'NULL'},
        ${quotation.agreedTotalAmount !== undefined ? quotation.agreedTotalAmount : 'NULL'},
        ${quotation.parentQuotationId ? `'${quotation.parentQuotationId}'` : 'NULL'}
      );
    `);
  }

  dbInstance.run(`DELETE FROM quotation_items WHERE quotationId = '${quotation.id}' AND revisionCode = '${quotation.currentRevision}';`);
  for (const item of items) {
    const itemId = item.id || crypto.randomUUID();
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unitPrice) || 0;
    const lineTotal = Math.round(qty * price);
    const effectivePrice = Number((price * allocationRatio).toFixed(4));

    dbInstance.run(`
      INSERT INTO quotation_items (
        id, quotationId, revisionCode, itemType, itemName, spec,
        quantity, unit, unitPrice, lineTotal, remark,
        estimatedUnitCost, effectiveUnitPrice, isAwarded, lostReason
      ) VALUES (
        '${itemId}', '${quotation.id}', '${quotation.currentRevision}',
        '${item.itemType === 'DEDUCTION' ? 'DEDUCTION' : 'NORMAL'}',
        '${item.itemName.replace(/'/g, "''")}',
        '${(item.spec || '').replace(/'/g, "''")}',
        ${qty}, '${(item.unit || '式').replace(/'/g, "''")}',
        ${price}, ${lineTotal},
        '${(item.remark || '').replace(/'/g, "''")}',
        ${item.estimatedUnitCost || 0}, ${effectivePrice},
        ${item.isAwarded !== false ? 1 : 0},
        ${item.lostReason ? `'${item.lostReason.replace(/'/g, "''")}'` : 'NULL'}
      );
    `);
  }

  dbInstance.run(`DELETE FROM quotation_billing_milestones WHERE quotationId = '${quotation.id}';`);
  for (const ms of milestones) {
    const msId = ms.id || crypto.randomUUID();
    dbInstance.run(`
      INSERT INTO quotation_billing_milestones (
        id, quotationId, stageIndex, stageName, percentage, estimatedDate, amount
      ) VALUES (
        '${msId}', '${quotation.id}', ${ms.stageIndex},
        '${ms.stageName.replace(/'/g, "''")}', ${ms.percentage},
        '${ms.estimatedDate || ''}', ${Math.round(ms.amount || 0)}
      );
    `);
  }

  const existingRev = dbInstance.exec(`
    SELECT id FROM quotation_revisions WHERE quotationId = '${quotation.id}' AND revisionCode = '${quotation.currentRevision}';
  `);
  if (!existingRev.length || !existingRev[0].values.length) {
    dbInstance.run(`
      INSERT INTO quotation_revisions (
        id, quotationId, revisionCode, netAmount, taxAmount, totalAmount,
        isWinning, lostReason, createdAt, pricingMode, discountAmount
      ) VALUES (
        '${crypto.randomUUID()}', '${quotation.id}', '${quotation.currentRevision}',
        ${Math.round(quotation.netAmount)}, ${Math.round(quotation.taxAmount)}, ${Math.round(quotation.totalAmount)},
        ${quotation.status === 'ACCEPTED' ? 1 : 0}, NULL, '${now}',
        '${quotation.pricingMode || 'HEADER_DISCOUNT'}', ${Math.round(quotation.discountAmount || 0)}
      );
    `);
  } else {
    dbInstance.run(`
      UPDATE quotation_revisions
      SET netAmount = ${Math.round(quotation.netAmount)},
          taxAmount = ${Math.round(quotation.taxAmount)},
          totalAmount = ${Math.round(quotation.totalAmount)},
          pricingMode = '${quotation.pricingMode || 'HEADER_DISCOUNT'}',
          discountAmount = ${Math.round(quotation.discountAmount || 0)},
          isWinning = ${quotation.status === 'ACCEPTED' ? 1 : 0}
      WHERE quotationId = '${quotation.id}' AND revisionCode = '${quotation.currentRevision}';
    `);
  }

  try {
    recordAuditLog(
      operatorName,
      existing ? '編輯報價單' : '建立報價單',
      '報價與銷售模組 (CPQ)',
      quotation.quoteNumber,
      {
        '報價單號': quotation.quoteNumber,
        '版本號': quotation.currentRevision,
        '議價軌道': quotation.pricingMode,
        '未稅淨額': `NT$ ${Math.round(quotation.netAmount).toLocaleString()}`,
        '營業稅額': `NT$ ${Math.round(quotation.taxAmount).toLocaleString()}`,
        '總報價額': `NT$ ${Math.round(quotation.totalAmount).toLocaleString()}`,
        '單況': quotation.status
      }
    );
  } catch (_) {}

  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 深拷貝產出新版次 (Rule 4.1：REV-A ➔ REV-B ➔ V_FINAL 決選版)
export function createQuotationRevisionDeepCopy(
  sourceQuotationId: string,
  newRevisionCode: string,
  operatorName: string = '系統操作員'
): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const quote = getAllQuotations().find(q => q.id === sourceQuotationId);
  if (!quote) return false;

  const items = getQuotationItems(sourceQuotationId, quote.currentRevision);
  getQuotationMilestones(sourceQuotationId);
  const now = new Date().toISOString();

  dbInstance.run(`
    UPDATE quotations
    SET currentRevision = '${newRevisionCode}',
        version = version + 1,
        updatedAt = '${now}'
    WHERE id = '${sourceQuotationId}';
  `);

  for (const item of items) {
    dbInstance.run(`
      INSERT INTO quotation_items (
        id, quotationId, revisionCode, itemType, itemName, spec,
        quantity, unit, unitPrice, lineTotal, remark,
        estimatedUnitCost, effectiveUnitPrice, isAwarded, lostReason
      ) VALUES (
        '${crypto.randomUUID()}', '${sourceQuotationId}', '${newRevisionCode}',
        '${item.itemType}', '${item.itemName.replace(/'/g, "''")}',
        '${(item.spec || '').replace(/'/g, "''")}',
        ${item.quantity}, '${(item.unit || '式').replace(/'/g, "''")}',
        ${item.unitPrice}, ${item.lineTotal},
        '${(item.remark || '').replace(/'/g, "''")}',
        ${item.estimatedUnitCost || 0}, ${item.effectiveUnitPrice || 0},
        ${item.isAwarded !== false ? 1 : 0},
        ${item.lostReason ? `'${item.lostReason.replace(/'/g, "''")}'` : 'NULL'}
      );
    `);
  }

  dbInstance.run(`
    INSERT INTO quotation_revisions (
      id, quotationId, revisionCode, netAmount, taxAmount, totalAmount,
      isWinning, lostReason, createdAt, pricingMode, discountAmount
    ) VALUES (
      '${crypto.randomUUID()}', '${sourceQuotationId}', '${newRevisionCode}',
      ${Math.round(quote.netAmount)}, ${Math.round(quote.taxAmount)}, ${Math.round(quote.totalAmount)},
      0, NULL, '${now}',
      '${quote.pricingMode || 'HEADER_DISCOUNT'}', ${Math.round(quote.discountAmount || 0)}
    );
  `);

  try {
    recordAuditLog(
      operatorName,
      '產生報價新版次',
      '報價與銷售模組 (CPQ)',
      quote.quoteNumber,
      {
        '報價單號': quote.quoteNumber,
        '舊版代號': quote.currentRevision,
        '新版代號': newRevisionCode,
        '操作機制': '深拷貝版次隔離 (Deep Copy)'
      }
    );
  } catch (_) {}

  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 讀取採購單
export function getAllPurchaseOrders(): PurchaseOrder[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT * FROM purchase_orders WHERE isDeleted = 0 ORDER BY poNumber DESC;`);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    poNumber: String(v[1]),
    companyId: String(v[2]),
    projectId: String(v[3]),
    vendorId: String(v[4]),
    currency: String(v[5] || 'TWD'),
    netAmount: Number(v[6] || 0),
    taxAmount: Number(v[7] || 0),
    totalAmount: Number(v[8] || 0),
    discountAmount: Number(v[9] || 0),
    retentionDeductionAmount: Number(v[10] || 0),
    postedTaxRate: Number(v[11] || 0.05),
    counterpartyNameSnapshot: String(v[12] || ''),
    counterpartyTaxIdSnapshot: String(v[13] || ''),
    projectNameSnapshot: String(v[14] || ''),
    isPrepaidDeduction: Boolean(v[15]),
    prepaidDeductionAmount: Number(v[16] || 0),
    status: v[17] as PurchaseOrder['status'],
    isDeleted: Boolean(v[18]),
    version: Number(v[19]),
    createdAt: String(v[20]),
    updatedAt: String(v[21]),
  }));
}

// 讀取下包合約
export function getAllSubcontracts(): Subcontract[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT * FROM subcontracts ORDER BY contractCode DESC;`);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    contractCode: String(v[1]),
    projectId: String(v[2]),
    subcontractorId: String(v[3]),
    companyId: String(v[4]),
    subcontractorName: String(v[5]),
    projectName: String(v[6]),
    contractName: String(v[7]),
    totalAmount: Number(v[8] || 0),
    retentionRate: Number(v[9] || 10),
    prepaidAmount: Number(v[10] || 0),
    prepaidRemaining: Number(v[11] || 0),
    startDate: String(v[12]),
    endDate: String(v[13]),
    status: v[14] as Subcontract['status'],
  }));
}

// 讀取估驗單
export function getAllValuations(): Valuation[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT * FROM valuations WHERE isDeleted = 0 ORDER BY valuationNumber DESC;`);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    valuationNumber: String(v[1]),
    subcontractId: String(v[2]),
    projectId: String(v[3]),
    subcontractorId: String(v[4]),
    companyId: String(v[5]),
    periodIndex: Number(v[6]),
    periodName: String(v[7]),
    cumulativeProgressPct: Number(v[8] || 0),
    grossAmount: Number(v[9] || 0),
    retentionDeductionAmount: Number(v[10] || 0),
    prepaidDeductionAmount: Number(v[11] || 0),
    otherDeductionAmount: Number(v[12] || 0),
    netPayableAmount: Number(v[13] || 0),
    taxAmount: Number(v[14] || 0),
    totalAmount: Number(v[15] || 0),
    status: v[16] as Valuation['status'],
    counterpartyNameSnapshot: String(v[17] || ''),
    projectNameSnapshot: String(v[18] || ''),
    isDeleted: Boolean(v[19]),
    version: Number(v[20]),
    createdAt: String(v[21]),
    updatedAt: String(v[22]),
  }));
}
