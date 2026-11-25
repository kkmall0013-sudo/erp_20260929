import type {
  InboundBillingStatus,
  InboundReceipt,
  InboundReceiptItem,
  InboundReceiptStatus
} from '../../types/erp';
import {
  getDbInstance,
  notifyListeners,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { ensureDatabaseIntegrity } from '../core/dbIntegrity';
import { logAudit } from './auditRepository';
import { getNextDocumentNumber } from './sequenceRepository';

// ============================================================================
// 🚚 現場進貨簽收模組 (Inbound Goods Management - 直入案場成本 A 模式)
// ============================================================================

export function getAllInboundReceipts(filters?: {
  companyId?: string;
  projectId?: string;
  vendorId?: string;
  status?: string;
  billingStatus?: string;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
}): InboundReceipt[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureDatabaseIntegrity(dbInstance);

  let query = filters?.onlyDeleted
    ? `SELECT * FROM inbound_receipts WHERE isDeleted = 1`
    : filters?.includeDeleted
    ? `SELECT * FROM inbound_receipts WHERE 1=1`
    : `SELECT * FROM inbound_receipts WHERE isDeleted = 0`;

  if (filters?.companyId) {
    query += ` AND companyId = '${filters.companyId}'`;
  }
  if (filters?.projectId) {
    query += ` AND projectId = '${filters.projectId}'`;
  }
  if (filters?.vendorId) {
    query += ` AND vendorId = '${filters.vendorId}'`;
  }
  if (filters?.status) {
    query += ` AND status = '${filters.status}'`;
  }
  if (filters?.billingStatus) {
    query += ` AND billingStatus = '${filters.billingStatus}'`;
  }

  query += ` ORDER BY receivedDate DESC, receiptNumber DESC;`;

  try {
    dbInstance.run('ALTER TABLE inbound_receipts ADD COLUMN projectCodeSnapshot TEXT;');
  } catch (_) {}
  try {
    dbInstance.run('ALTER TABLE inbound_receipts ADD COLUMN orderNumber TEXT;');
  } catch (_) {}

  const res = dbInstance.exec(query);
  if (!res.length || !res[0].values.length) return [];

  const cols = res[0].columns;
  const colIdx = (name: string) => cols.indexOf(name);
  const idIdx = colIdx('id');
  const receiptNumberIdx = colIdx('receiptNumber');
  const companyIdIdx = colIdx('companyId');
  const projectIdIdx = colIdx('projectId');
  const projectNameSnapshotIdx = colIdx('projectNameSnapshot');
  const projectCodeSnapshotIdx = colIdx('projectCodeSnapshot');
  const vendorIdIdx = colIdx('vendorId');
  const vendorNameSnapshotIdx = colIdx('vendorNameSnapshot');
  const vendorTaxIdSnapshotIdx = colIdx('vendorTaxIdSnapshot');
  const deliveryNoteNumberIdx = colIdx('deliveryNoteNumber');
  const orderNumberIdx = colIdx('orderNumber');
  const receivedDateIdx = colIdx('receivedDate');
  const receivedByIdx = colIdx('receivedBy');
  const totalAmountIdx = colIdx('totalAmount');
  const billingStatusIdx = colIdx('billingStatus');
  const reconciliationIdIdx = colIdx('reconciliationId');
  const reconciliationNumberIdx = colIdx('reconciliationNumber');
  const purchaseOrderIdIdx = colIdx('purchaseOrderId');
  const statusIdx = colIdx('status');
  const attachmentFileIdIdx = colIdx('attachmentFileId');
  const attachmentFileNameIdx = colIdx('attachmentFileName');
  const notesIdx = colIdx('notes');
  const isDeletedIdx = colIdx('isDeleted');
  const versionIdx = colIdx('version');
  const createdAtIdx = colIdx('createdAt');
  const updatedAtIdx = colIdx('updatedAt');

  const receipts: InboundReceipt[] = res[0].values.map(row => ({
    id: String(row[idIdx !== -1 ? idIdx : 0]),
    receiptNumber: String(row[receiptNumberIdx !== -1 ? receiptNumberIdx : 1]),
    companyId: String(row[companyIdIdx !== -1 ? companyIdIdx : 2]),
    projectId: String(row[projectIdIdx !== -1 ? projectIdIdx : 3]),
    projectNameSnapshot: projectNameSnapshotIdx !== -1 && row[projectNameSnapshotIdx] ? String(row[projectNameSnapshotIdx]) : undefined,
    projectCodeSnapshot: projectCodeSnapshotIdx !== -1 && row[projectCodeSnapshotIdx] ? String(row[projectCodeSnapshotIdx]) : undefined,
    vendorId: String(row[vendorIdIdx !== -1 ? vendorIdIdx : 5]),
    vendorNameSnapshot: vendorNameSnapshotIdx !== -1 && row[vendorNameSnapshotIdx] ? String(row[vendorNameSnapshotIdx]) : undefined,
    vendorTaxIdSnapshot: vendorTaxIdSnapshotIdx !== -1 && row[vendorTaxIdSnapshotIdx] ? String(row[vendorTaxIdSnapshotIdx]) : undefined,
    deliveryNoteNumber: deliveryNoteNumberIdx !== -1 && row[deliveryNoteNumberIdx] ? String(row[deliveryNoteNumberIdx]) : '',
    orderNumber: orderNumberIdx !== -1 && row[orderNumberIdx] ? String(row[orderNumberIdx]) : undefined,
    receivedDate: receivedDateIdx !== -1 && row[receivedDateIdx] ? String(row[receivedDateIdx]) : '',
    receivedBy: receivedByIdx !== -1 && row[receivedByIdx] ? String(row[receivedByIdx]) : '',
    totalAmount: Number(totalAmountIdx !== -1 ? row[totalAmountIdx] : 0),
    billingStatus: ((billingStatusIdx !== -1 && row[billingStatusIdx]) || 'PENDING_BILLING') as InboundBillingStatus,
    reconciliationId: reconciliationIdIdx !== -1 && row[reconciliationIdIdx] ? String(row[reconciliationIdIdx]) : undefined,
    reconciliationNumber: reconciliationNumberIdx !== -1 && row[reconciliationNumberIdx] ? String(row[reconciliationNumberIdx]) : undefined,
    purchaseOrderId: purchaseOrderIdIdx !== -1 && row[purchaseOrderIdIdx] ? String(row[purchaseOrderIdIdx]) : undefined,
    status: ((statusIdx !== -1 && row[statusIdx]) || 'DRAFT') as InboundReceiptStatus,
    attachmentFileId: attachmentFileIdIdx !== -1 && row[attachmentFileIdIdx] ? String(row[attachmentFileIdIdx]) : undefined,
    attachmentFileName: attachmentFileNameIdx !== -1 && row[attachmentFileNameIdx] ? String(row[attachmentFileNameIdx]) : undefined,
    notes: notesIdx !== -1 && row[notesIdx] ? String(row[notesIdx]) : undefined,
    isDeleted: isDeletedIdx !== -1 ? Boolean(row[isDeletedIdx]) : false,
    version: versionIdx !== -1 ? Number(row[versionIdx] || 1) : 1,
    createdAt: createdAtIdx !== -1 && row[createdAtIdx] ? String(row[createdAtIdx]) : '',
    updatedAt: updatedAtIdx !== -1 && row[updatedAtIdx] ? String(row[updatedAtIdx]) : '',
    items: [],
  }));

  for (const r of receipts) {
    r.items = getInboundReceiptItems(r.id);
  }

  return receipts;
}

export function getInboundReceiptItems(receiptId: string): InboundReceiptItem[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT * FROM inbound_receipt_items WHERE receiptId = '${receiptId}' ORDER BY id ASC;`);
  if (!res.length || !res[0].values.length) return [];

  return res[0].values.map(row => ({
    id: String(row[0]),
    receiptId: String(row[1]),
    itemCode: row[2] ? String(row[2]) : undefined,
    itemName: String(row[3] || ''),
    spec: row[4] ? String(row[4]) : undefined,
    unit: String(row[5] || '式'),
    quantity: Number(row[6] || 0),
    unitPrice: Number(row[7] || 0),
    lineTotal: Number(row[8] || 0),
    notes: row[9] ? String(row[9]) : undefined,
  }));
}

export function getInboundReceiptById(id: string): InboundReceipt | null {
  const dbInstance = getDbInstance();
  if (!dbInstance) return null;
  const receipts = getAllInboundReceipts();
  return receipts.find(r => r.id === id) || null;
}

export function createInboundReceipt(
  data: Partial<InboundReceipt>,
  items: Partial<InboundReceiptItem>[] = []
): InboundReceipt {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未就緒');

  const now = new Date().toISOString();
  const id = data.id || `INB-REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const receivedDate = data.receivedDate || now.slice(0, 10);

  let receiptNumber = data.receiptNumber;
  if (!receiptNumber || receiptNumber.trim() === '') {
    if (data.status === 'POSTED') {
      receiptNumber = getNextDocumentNumber('INB', receivedDate);
    } else {
      receiptNumber = `TEMP-${Date.now().toString().slice(-6)}`;
    }
  }

  // 直接以 SQL 查詢專案與夥伴快照，維持 DAG 無環依賴
  let projectNameSnapshot = data.projectNameSnapshot;
  let projectCodeSnapshot = data.projectCodeSnapshot;
  if ((!projectNameSnapshot || !projectCodeSnapshot) && data.projectId) {
    const prjRes = dbInstance.exec(`SELECT name, projectCode FROM projects WHERE id = '${data.projectId.replace(/'/g, "''")}' AND isDeleted = 0;`);
    if (prjRes.length && prjRes[0].values.length) {
      if (!projectNameSnapshot && prjRes[0].values[0][0]) projectNameSnapshot = String(prjRes[0].values[0][0]);
      if (!projectCodeSnapshot && prjRes[0].values[0][1]) projectCodeSnapshot = String(prjRes[0].values[0][1]);
    }
  }

  let vendorNameSnapshot = data.vendorNameSnapshot;
  let vendorTaxIdSnapshot = data.vendorTaxIdSnapshot;
  if ((!vendorNameSnapshot || !vendorTaxIdSnapshot) && data.vendorId) {
    const bpRes = dbInstance.exec(`SELECT name, taxId FROM business_partners WHERE id = '${data.vendorId.replace(/'/g, "''")}';`);
    if (bpRes.length && bpRes[0].values.length) {
      vendorNameSnapshot = vendorNameSnapshot || String(bpRes[0].values[0][0]);
      vendorTaxIdSnapshot = vendorTaxIdSnapshot || String(bpRes[0].values[0][1]);
    }
  }

  let totalAmount = 0;
  const processedItems: InboundReceiptItem[] = items.map((it, idx) => {
    const qty = Number(it.quantity || 0);
    const price = Number(it.unitPrice || 0);
    const lineTotal = Number(it.lineTotal !== undefined ? it.lineTotal : (qty * price));
    totalAmount += lineTotal;

    return {
      id: it.id || `INBI-${Date.now()}-${idx + 1}`,
      receiptId: id,
      itemCode: it.itemCode || '',
      itemName: it.itemName || '未命名材料',
      spec: it.spec || '',
      unit: it.unit || '式',
      quantity: qty,
      unitPrice: price,
      lineTotal,
      notes: it.notes || '',
    };
  });

  const status = data.status || 'DRAFT';
  const billingStatus = data.billingStatus || 'PENDING_BILLING';

  try {
    dbInstance.run('ALTER TABLE inbound_receipts ADD COLUMN projectCodeSnapshot TEXT;');
  } catch (_) {}
  try {
    dbInstance.run('ALTER TABLE inbound_receipts ADD COLUMN orderNumber TEXT;');
  } catch (_) {}

  dbInstance.run(`
    INSERT INTO inbound_receipts (
      id, receiptNumber, companyId, projectId, projectNameSnapshot, projectCodeSnapshot,
      vendorId, vendorNameSnapshot, vendorTaxIdSnapshot, deliveryNoteNumber, orderNumber,
      receivedDate, receivedBy, totalAmount, billingStatus,
      reconciliationId, reconciliationNumber, purchaseOrderId,
      status, attachmentFileId, attachmentFileName, notes,
      isDeleted, version, createdAt, updatedAt
    ) VALUES (
      '${id}',
      '${receiptNumber.replace(/'/g, "''")}',
      '${(data.companyId || 'COMP-01').replace(/'/g, "''")}',
      '${(data.projectId || '').replace(/'/g, "''")}',
      '${(projectNameSnapshot || '').replace(/'/g, "''")}',
      '${(projectCodeSnapshot || '').replace(/'/g, "''")}',
      '${(data.vendorId || '').replace(/'/g, "''")}',
      '${(vendorNameSnapshot || '').replace(/'/g, "''")}',
      '${(vendorTaxIdSnapshot || '').replace(/'/g, "''")}',
      '${(data.deliveryNoteNumber || '').replace(/'/g, "''")}',
      ${data.orderNumber ? `'${data.orderNumber.replace(/'/g, "''")}'` : 'NULL'},
      '${receivedDate}',
      '${(data.receivedBy || '點收人').replace(/'/g, "''")}',
      ${totalAmount},
      '${billingStatus}',
      ${data.reconciliationId ? `'${data.reconciliationId}'` : 'NULL'},
      ${data.reconciliationNumber ? `'${data.reconciliationNumber}'` : 'NULL'},
      ${data.purchaseOrderId ? `'${data.purchaseOrderId}'` : 'NULL'},
      '${status}',
      ${data.attachmentFileId ? `'${data.attachmentFileId}'` : 'NULL'},
      ${data.attachmentFileName ? `'${data.attachmentFileName.replace(/'/g, "''")}'` : 'NULL'},
      ${data.notes ? `'${data.notes.replace(/'/g, "''")}'` : 'NULL'},
      0, 1, '${now}', '${now}'
    );
  `);

  for (const item of processedItems) {
    dbInstance.run(`
      INSERT INTO inbound_receipt_items (id, receiptId, itemCode, itemName, spec, unit, quantity, unitPrice, lineTotal, notes)
      VALUES (
        '${item.id}',
        '${id}',
        '${(item.itemCode || '').replace(/'/g, "''")}',
        '${item.itemName.replace(/'/g, "''")}',
        '${(item.spec || '').replace(/'/g, "''")}',
        '${item.unit.replace(/'/g, "''")}',
        ${item.quantity},
        ${item.unitPrice},
        ${item.lineTotal},
        '${(item.notes || '').replace(/'/g, "''")}'
      );
    `);
  }

  if (status === 'POSTED' && data.projectId && totalAmount > 0) {
    try {
      dbInstance.run(`
        UPDATE projects 
        SET actualCost = actualCost + ${totalAmount},
            updatedAt = '${now}'
        WHERE id = '${data.projectId}';
      `);
    } catch (_) {}
  }

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    receiptNumber,
    companyId: data.companyId || 'COMP-01',
    projectId: data.projectId || '',
    projectNameSnapshot,
    projectCodeSnapshot,
    vendorId: data.vendorId || '',
    vendorNameSnapshot,
    vendorTaxIdSnapshot,
    deliveryNoteNumber: data.deliveryNoteNumber || '',
    orderNumber: data.orderNumber,
    receivedDate,
    receivedBy: data.receivedBy || '點收人',
    totalAmount,
    billingStatus,
    reconciliationId: data.reconciliationId,
    reconciliationNumber: data.reconciliationNumber,
    purchaseOrderId: data.purchaseOrderId,
    status,
    attachmentFileId: data.attachmentFileId,
    attachmentFileName: data.attachmentFileName,
    notes: data.notes,
    isDeleted: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
    items: processedItems,
  };
}

export function updateInboundReceipt(
  id: string,
  data: Partial<InboundReceipt>,
  items?: Partial<InboundReceiptItem>[]
): InboundReceipt {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未就緒');
  const existing = getInboundReceiptById(id);
  if (!existing) throw new Error(`找不到進貨簽收單: ${id}`);

  if (existing.billingStatus === 'BILLED') {
    throw new Error('該進貨簽收單已納入會計對帳單請款，依法鎖定禁止修改');
  }

  try {
    dbInstance.run('ALTER TABLE inbound_receipts ADD COLUMN projectCodeSnapshot TEXT;');
  } catch (_) {}
  try {
    dbInstance.run('ALTER TABLE inbound_receipts ADD COLUMN orderNumber TEXT;');
  } catch (_) {}

  const now = new Date().toISOString();
  const newVersion = (existing.version || 1) + 1;

  let totalAmount = existing.totalAmount;

  if (items && items.length > 0) {
    dbInstance.run(`DELETE FROM inbound_receipt_items WHERE receiptId = '${id}';`);
    totalAmount = 0;
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const qty = Number(it.quantity || 0);
      const price = Number(it.unitPrice || 0);
      const lineTotal = Number(it.lineTotal !== undefined ? it.lineTotal : (qty * price));
      totalAmount += lineTotal;

      const itemId = it.id || `INBI-${Date.now()}-${idx + 1}`;
      dbInstance.run(`
        INSERT INTO inbound_receipt_items (id, receiptId, itemCode, itemName, spec, unit, quantity, unitPrice, lineTotal, notes)
        VALUES (
          '${itemId}',
          '${id}',
          '${(it.itemCode || '').replace(/'/g, "''")}',
          '${(it.itemName || '材料').replace(/'/g, "''")}',
          '${(it.spec || '').replace(/'/g, "''")}',
          '${(it.unit || '式').replace(/'/g, "''")}',
          ${qty},
          ${price},
          ${lineTotal},
          '${(it.notes || '').replace(/'/g, "''")}'
        );
      `);
    }
  }

  const updates: string[] = [
    `version = ${newVersion}`,
    `updatedAt = '${now}'`,
    `totalAmount = ${totalAmount}`,
  ];

  if (data.deliveryNoteNumber !== undefined) updates.push(`deliveryNoteNumber = '${data.deliveryNoteNumber.replace(/'/g, "''")}'`);
  if (data.orderNumber !== undefined) updates.push(`orderNumber = ${data.orderNumber ? `'${data.orderNumber.replace(/'/g, "''")}'` : 'NULL'}`);
  if (data.receivedDate !== undefined) updates.push(`receivedDate = '${data.receivedDate}'`);
  if (data.receivedBy !== undefined) updates.push(`receivedBy = '${data.receivedBy.replace(/'/g, "''")}'`);
  if (data.notes !== undefined) updates.push(`notes = '${(data.notes || '').replace(/'/g, "''")}'`);
  if (data.status !== undefined) updates.push(`status = '${data.status}'`);
  if (data.purchaseOrderId !== undefined) updates.push(`purchaseOrderId = ${data.purchaseOrderId ? `'${data.purchaseOrderId}'` : 'NULL'}`);

  if (data.projectId !== undefined) {
    updates.push(`projectId = '${data.projectId}'`);
  }

  let queriedProject: { name: string; projectCode: string } | null = null;
  if ((data.projectNameSnapshot === undefined || data.projectCodeSnapshot === undefined) && data.projectId !== undefined) {
    const prjRes = dbInstance.exec(`SELECT name, projectCode FROM projects WHERE id = '${data.projectId.replace(/'/g, "''")}' AND isDeleted = 0;`);
    if (prjRes.length && prjRes[0].values.length) {
      queriedProject = {
        name: String(prjRes[0].values[0][0] || ''),
        projectCode: String(prjRes[0].values[0][1] || ''),
      };
    }
  }

  if (data.projectNameSnapshot !== undefined) {
    updates.push(`projectNameSnapshot = '${data.projectNameSnapshot.replace(/'/g, "''")}'`);
  } else if (queriedProject) {
    updates.push(`projectNameSnapshot = '${queriedProject.name.replace(/'/g, "''")}'`);
  }

  if (data.projectCodeSnapshot !== undefined) {
    updates.push(`projectCodeSnapshot = '${data.projectCodeSnapshot.replace(/'/g, "''")}'`);
  } else if (queriedProject) {
    updates.push(`projectCodeSnapshot = '${queriedProject.projectCode.replace(/'/g, "''")}'`);
  }

  if (data.vendorId !== undefined) {
    updates.push(`vendorId = '${data.vendorId}'`);
    const venRes = dbInstance.exec(`SELECT name, taxId FROM business_partners WHERE id = '${data.vendorId.replace(/'/g, "''")}' AND isDeleted = 0;`);
    if (venRes.length && venRes[0].values.length) {
      const venName = String(venRes[0].values[0][0] || '');
      const venTax = String(venRes[0].values[0][1] || '');
      updates.push(`vendorNameSnapshot = '${venName.replace(/'/g, "''")}'`);
      updates.push(`vendorTaxIdSnapshot = '${venTax.replace(/'/g, "''")}'`);
    }
  }
  if (data.attachmentFileId !== undefined) updates.push(`attachmentFileId = ${data.attachmentFileId ? `'${data.attachmentFileId}'` : 'NULL'}`);
  if (data.attachmentFileName !== undefined) updates.push(`attachmentFileName = ${data.attachmentFileName ? `'${data.attachmentFileName.replace(/'/g, "''")}'` : 'NULL'}`);

  dbInstance.run(`UPDATE inbound_receipts SET ${updates.join(', ')} WHERE id = '${id}';`);

  if (existing.status === 'POSTED') {
    const oldPrjId = existing.projectId;
    const newPrjId = data.projectId !== undefined ? data.projectId : oldPrjId;
    const oldAmount = existing.totalAmount;
    const newAmount = totalAmount;

    if (oldPrjId !== newPrjId) {
      if (oldPrjId && oldAmount > 0) {
        try {
          dbInstance.run(`UPDATE projects SET actualCost = MAX(0, actualCost - ${oldAmount}), updatedAt = '${now}' WHERE id = '${oldPrjId}';`);
        } catch (_) {}
      }
      if (newPrjId && newAmount > 0) {
        try {
          dbInstance.run(`UPDATE projects SET actualCost = actualCost + ${newAmount}, updatedAt = '${now}' WHERE id = '${newPrjId}';`);
        } catch (_) {}
      }
    } else if (oldAmount !== newAmount && newPrjId) {
      const delta = newAmount - oldAmount;
      try {
        dbInstance.run(`UPDATE projects SET actualCost = MAX(0, actualCost + ${delta}), updatedAt = '${now}' WHERE id = '${newPrjId}';`);
      } catch (_) {}
    }
  }

  saveDatabaseSnapshot();
  notifyListeners();

  return getInboundReceiptById(id)!;
}

export function postInboundReceipt(id: string): InboundReceipt {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未就緒');
  const existing = getInboundReceiptById(id);
  if (!existing) throw new Error(`找不到進貨簽收單: ${id}`);

  let receiptNumber = existing.receiptNumber;
  if (receiptNumber.startsWith('TEMP-') || !receiptNumber) {
    receiptNumber = getNextDocumentNumber('INB', existing.receivedDate);
  }

  const now = new Date().toISOString();
  dbInstance.run(`
    UPDATE inbound_receipts 
    SET status = 'POSTED',
        billingStatus = 'PENDING_BILLING',
        receiptNumber = '${receiptNumber}',
        updatedAt = '${now}'
    WHERE id = '${id}';
  `);

  if (existing.projectId && existing.totalAmount > 0) {
    try {
      dbInstance.run(`
        UPDATE projects 
        SET actualCost = actualCost + ${existing.totalAmount},
            updatedAt = '${now}'
        WHERE id = '${existing.projectId}';
      `);
    } catch (_) {}
  }

  saveDatabaseSnapshot();
  notifyListeners();

  return getInboundReceiptById(id)!;
}

export function voidInboundReceipt(id: string, notes?: string): InboundReceipt {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未就緒');
  const existing = getInboundReceiptById(id);
  if (!existing) throw new Error(`找不到進貨簽收單: ${id}`);

  if (existing.billingStatus === 'BILLED') {
    throw new Error('此進貨單已由會計完成請款對帳，禁止逕行作廢；須先由會計取消對帳');
  }

  const now = new Date().toISOString();
  const updatedNotes = notes ? `${existing.notes || ''} [作廢原因: ${notes}]` : existing.notes;

  dbInstance.run(`
    UPDATE inbound_receipts 
    SET status = 'VOIDED',
        notes = '${(updatedNotes || '').replace(/'/g, "''")}',
        updatedAt = '${now}'
    WHERE id = '${id}';
  `);

  if (existing.status === 'POSTED' && existing.projectId && existing.totalAmount > 0) {
    try {
      dbInstance.run(`
        UPDATE projects 
        SET actualCost = MAX(0, actualCost - ${existing.totalAmount}),
            updatedAt = '${now}'
        WHERE id = '${existing.projectId}';
      `);
    } catch (_) {}
  }

  saveDatabaseSnapshot();
  notifyListeners();

  return getInboundReceiptById(id)!;
}

export function deleteInboundReceipt(
  id: string,
  operatorName: string = '系統操作員',
  reason: string = '現場日常管理刪除'
): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const existing = getInboundReceiptById(id);
  if (!existing) return false;

  if (existing.status === 'POSTED' || existing.billingStatus === 'BILLED') {
    throw new Error('已過帳或已對帳之進貨單據禁止物理刪除，請使用「作廢」功能');
  }

  const now = new Date().toISOString();
  dbInstance.run(`UPDATE inbound_receipts SET isDeleted = 1, updatedAt = '${now}' WHERE id = '${id}';`);
  logAudit(dbInstance, operatorName, '軟刪除', '現場進貨簽收單', id, {
    '單據編號': existing.receiptNumber,
    '廠商送貨單號': existing.deliveryNoteNumber,
    '進貨廠商': existing.vendorNameSnapshot,
    '總金額': existing.totalAmount,
    '原狀態': '正常有效'
  }, {
    '刪除狀態': '已軟刪除 (一般用戶與Admin均隱蔽，Superadmin 可在救援中心檢視並救回)',
    '刪除人': operatorName,
    '刪除原因': reason,
    '刪除時間': now
  });
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

export function restoreInboundReceipt(id: string, operatorName: string = 'Superadmin'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const res = dbInstance.exec(`SELECT receiptNumber, vendorNameSnapshot, deliveryNoteNumber FROM inbound_receipts WHERE id = '${id}';`);
  const receiptNumber = res[0]?.values[0]?.[0] ? String(res[0].values[0][0]) : id;
  const vendorName = res[0]?.values[0]?.[1] ? String(res[0].values[0][1]) : '';
  const now = new Date().toISOString();
  dbInstance.run(`UPDATE inbound_receipts SET isDeleted = 0, updatedAt = '${now}' WHERE id = '${id}';`);
  logAudit(dbInstance, operatorName, '救援還原', '現場進貨簽收單', id, {
    '單據編號': receiptNumber,
    '刪除狀態': '已軟刪除'
  }, {
    '單據編號': receiptNumber,
    '廠商': vendorName,
    '刪除狀態': '已救援還原服役 (所有同仁立即可見)',
    '救援人': operatorName,
    '救援時間': now
  });
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

export function purgeInboundReceipt(id: string, operatorName: string = 'Superadmin'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const res = dbInstance.exec(`SELECT receiptNumber, vendorNameSnapshot FROM inbound_receipts WHERE id = '${id}';`);
  const receiptNumber = res[0]?.values[0]?.[0] ? String(res[0].values[0][0]) : id;
  const now = new Date().toISOString();
  dbInstance.run(`DELETE FROM inbound_receipt_items WHERE receiptId = '${id}';`);
  dbInstance.run(`DELETE FROM inbound_receipts WHERE id = '${id}';`);
  logAudit(dbInstance, operatorName, '永久抹除', '現場進貨簽收單', id, {
    '單據編號': receiptNumber,
    '狀態': '已軟刪除'
  }, {
    '狀態': '已自資料庫永久抹除物理清除',
    '執行人': operatorName,
    '抹除時間': now
  });
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

export function getDeletedInboundReceipts(): InboundReceipt[] {
  return getAllInboundReceipts({ onlyDeleted: true });
}

export interface VendorPoolSummary {
  vendorId: string;
  vendorName: string;
  vendorTaxId: string;
  pendingCount: number;
  pendingTotalAmount: number;
  billedCount: number;
  billedTotalAmount: number;
  earliestDate: string;
  latestDate: string;
}

export function getVendorLedgerPoolSummary(companyId?: string): VendorPoolSummary[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureDatabaseIntegrity(dbInstance);

  const receipts = getAllInboundReceipts({ companyId });
  const poolMap = new Map<string, VendorPoolSummary>();

  for (const r of receipts) {
    if (r.status === 'VOIDED') continue;

    let item = poolMap.get(r.vendorId);
    if (!item) {
      item = {
        vendorId: r.vendorId,
        vendorName: r.vendorNameSnapshot || '廠商',
        vendorTaxId: r.vendorTaxIdSnapshot || '',
        pendingCount: 0,
        pendingTotalAmount: 0,
        billedCount: 0,
        billedTotalAmount: 0,
        earliestDate: r.receivedDate,
        latestDate: r.receivedDate,
      };
      poolMap.set(r.vendorId, item);
    }

    if (r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED') {
      item.pendingCount++;
      item.pendingTotalAmount += r.totalAmount;
    } else if (r.billingStatus === 'BILLED') {
      item.billedCount++;
      item.billedTotalAmount += r.totalAmount;
    }

    if (r.receivedDate < item.earliestDate) item.earliestDate = r.receivedDate;
    if (r.receivedDate > item.latestDate) item.latestDate = r.receivedDate;
  }

  return Array.from(poolMap.values()).sort((a, b) => b.pendingTotalAmount - a.pendingTotalAmount);
}
