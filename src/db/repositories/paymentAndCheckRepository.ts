import type {
  BankCheck,
  PaymentLineItem,
  PaymentMethod,
  PaymentRecord,
  PaymentStatus
} from '../../types/erp';
import {
  getDbInstance,
  notifyListeners,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { ensureArTablesAndColumns } from '../core/schemaOperations';
import { voidApReconciliation } from './apReconciliationRepository';
import { recordAuditLog } from './auditRepository';

// 讀取支票 (含三燈號、雙日期、開票行與換票重新關聯欄位)
export function getAllBankChecks(): BankCheck[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  try {
    try { dbInstance.run(`ALTER TABLE bank_checks ADD COLUMN replacesCheckNumber TEXT;`); } catch (_) {}
    try { dbInstance.run(`ALTER TABLE bank_checks ADD COLUMN reconciledApId TEXT;`); } catch (_) {}
    try { dbInstance.run(`ALTER TABLE bank_checks ADD COLUMN reconciledArId TEXT;`); } catch (_) {}

    const res = dbInstance.exec(`SELECT id, checkNumber, type, companyId, counterpartyName, amount, issueDate, dueDate, bankName, drawerBank, paymentId, expectedClearanceDate, actualClearanceDate, status, voidReason, notes, replacesCheckNumber, reconciledApId, reconciledArId FROM bank_checks ORDER BY dueDate;`);
    if (!res.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      checkNumber: String(v[1]),
      type: v[2] as BankCheck['type'],
      companyId: String(v[3]),
      counterpartyName: String(v[4]),
      amount: Number(v[5] || 0),
      issueDate: String(v[6]),
      dueDate: String(v[7]),
      bankName: String(v[8]),
      drawerBank: v[9] ? String(v[9]) : undefined,
      paymentId: v[10] ? String(v[10]) : undefined,
      expectedClearanceDate: v[11] ? String(v[11]) : String(v[7]),
      actualClearanceDate: v[12] ? String(v[12]) : undefined,
      status: v[13] as BankCheck['status'],
      voidReason: v[14] ? String(v[14]) : undefined,
      notes: v[15] ? String(v[15]) : undefined,
      replacesCheckNumber: v[16] ? String(v[16]) : undefined,
      reconciledApId: v[17] ? String(v[17]) : undefined,
      reconciledArId: v[18] ? String(v[18]) : undefined,
    }));
  } catch (e) {
    const fallbackRes = dbInstance.exec(`SELECT * FROM bank_checks ORDER BY dueDate;`);
    if (!fallbackRes.length) return [];
    return fallbackRes[0].values.map(v => ({
      id: String(v[0]),
      checkNumber: String(v[1]),
      type: v[2] as BankCheck['type'],
      companyId: String(v[3]),
      counterpartyName: String(v[4]),
      amount: Number(v[5] || 0),
      issueDate: String(v[6]),
      dueDate: String(v[7]),
      bankName: String(v[8]),
      status: v[9] as BankCheck['status'],
      voidReason: v[10] ? String(v[10]) : undefined,
      notes: v[11] ? String(v[11]) : undefined,
    }));
  }
}

export function getAllPaymentRecords(): PaymentRecord[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  try {
    try { dbInstance.run(`ALTER TABLE fin_payment_records ADD COLUMN isBossAdvance INTEGER DEFAULT 0;`); } catch (_) {}

    const res = dbInstance.exec(`
      SELECT id, paymentNo, companyId, currency, bankAccountId, bankAccountName,
        targetBankAccountId, partnerId, partnerName, customVendorName, paymentMethod,
        isReversal, documentDate, postingDate, totalAmount, status, isReconciled,
        reconciledAt, voidReason, notes, isDeleted, version, createdAt, updatedAt,
        isBossAdvance
      FROM fin_payment_records
      WHERE isDeleted = 0
      ORDER BY postingDate DESC, paymentNo DESC;
    `);
    if (!res.length) return [];
    return res[0].values.map(v => {
      const pId = String(v[0]);
      // 載入明細
      const itemsRes = dbInstance.exec(`SELECT * FROM fin_payment_line_items WHERE paymentId = '${pId}';`);
      const lineItems: PaymentLineItem[] = (itemsRes && itemsRes.length && itemsRes[0].values)
        ? itemsRes[0].values.map(iv => ({
            id: String(iv[0]),
            paymentId: String(iv[1]),
            sourceType: iv[2] as PaymentLineItem['sourceType'],
            sourceId: String(iv[3]),
            sourceNumber: iv[4] ? String(iv[4]) : undefined,
            itemType: (iv[5] || 'STANDARD') as PaymentLineItem['itemType'],
            appliedAmount: Number(iv[6] || 0),
            feeAmount: Number(iv[7] || 0),
            isFeeAbsorbedByCompany: Boolean(iv[8]),
            discountAmount: Number(iv[9] || 0),
            offsetExpenseId: iv[10] ? String(iv[10]) : undefined,
            withholdingTaxAmt: Number(iv[11] || 0),
            nhiAmt: Number(iv[12] || 0),
            projectId: iv[13] ? String(iv[13]) : undefined,
            notes: iv[14] ? String(iv[14]) : undefined,
          }))
        : [];

      return {
        id: pId,
        paymentNo: String(v[1]),
        companyId: String(v[2]),
        currency: String(v[3] || 'TWD'),
        bankAccountId: String(v[4]),
        bankAccountName: v[5] ? String(v[5]) : undefined,
        targetBankAccountId: v[6] ? String(v[6]) : undefined,
        partnerId: v[7] ? String(v[7]) : undefined,
        partnerName: v[8] ? String(v[8]) : undefined,
        customVendorName: v[9] ? String(v[9]) : undefined,
        paymentMethod: (v[10] || 'TT') as PaymentMethod,
        isReversal: Boolean(v[11]),
        documentDate: String(v[12]),
        postingDate: String(v[13]),
        totalAmount: Number(v[14] || 0),
        status: (v[15] || 'POSTED') as PaymentStatus,
        isReconciled: Boolean(v[16]),
        reconciledAt: v[17] ? String(v[17]) : undefined,
        voidReason: v[18] ? String(v[18]) : undefined,
        notes: v[19] ? String(v[19]) : undefined,
        isDeleted: Boolean(v[20]),
        version: Number(v[21] || 1),
        createdAt: v[22] ? String(v[22]) : undefined,
        updatedAt: v[23] ? String(v[23]) : undefined,
        isBossAdvance: Boolean(v[24]),
        lineItems,
      };
    });
  } catch (e) {
    console.error('getAllPaymentRecords error', e);
    return [];
  }
}

export function createPaymentRecord(
  data: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
    id?: string;
    checkNumber?: string;
    checkDueDate?: string;
    drawerBank?: string;
    replacesCheckNumber?: string;
    reconciledApId?: string;
  },
  operatorName: string = '李出納專員'
): PaymentRecord {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  // 防止同一張應付對帳單重複放款（雙擊或舊視窗殘留送出）
  if (data.lineItems && data.lineItems.length > 0 && data.status === 'POSTED') {
    for (const item of data.lineItems) {
      if (item.sourceType === 'AP' && item.sourceId) {
        const apCheck = dbInstance.exec(`
          SELECT reconciliationNumber, status FROM ap_reconciliations
          WHERE id = '${item.sourceId.replace(/'/g, "''")}' AND isDeleted = 0;
        `);
        if (apCheck.length && apCheck[0].values.length) {
          const apStatus = String(apCheck[0].values[0][1] || '');
          const apNo = String(apCheck[0].values[0][0] || item.sourceId);
          if (apStatus === 'PAID') {
            throw new Error(`應付對帳單【${apNo}】已完成出金結清，禁止重複放款！`);
          }
          if (apStatus !== 'APPROVED') {
            throw new Error(`應付對帳單【${apNo}】目前狀態為 ${apStatus}，須先由會計核准立帳才能放款！`);
          }
        }
      }
    }
  }

  const now = new Date().toISOString();
  const id = data.id || `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try { dbInstance.run(`ALTER TABLE fin_payment_records ADD COLUMN isBossAdvance INTEGER DEFAULT 0;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE bank_checks ADD COLUMN replacesCheckNumber TEXT;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE bank_checks ADD COLUMN reconciledApId TEXT;`); } catch (_) {}

  dbInstance.run(`
    INSERT INTO fin_payment_records (
      id, paymentNo, companyId, currency, bankAccountId, bankAccountName,
      targetBankAccountId, partnerId, partnerName, customVendorName, paymentMethod,
      isReversal, documentDate, postingDate, totalAmount, status, isReconciled,
      reconciledAt, voidReason, notes, isDeleted, version, createdAt, updatedAt,
      isBossAdvance
    ) VALUES (
      '${id}', '${data.paymentNo}', '${data.companyId}', '${data.currency || 'TWD'}',
      '${data.bankAccountId}', '${(data.bankAccountName || '').replace(/'/g, "''")}',
      ${data.targetBankAccountId ? `'${data.targetBankAccountId}'` : 'NULL'},
      ${data.partnerId ? `'${data.partnerId}'` : 'NULL'},
      '${(data.partnerName || '').replace(/'/g, "''")}',
      ${data.customVendorName ? `'${data.customVendorName.replace(/'/g, "''")}'` : 'NULL'},
      '${data.paymentMethod}', ${data.isReversal ? 1 : 0}, '${data.documentDate}',
      '${data.postingDate}', ${data.totalAmount}, '${data.status}', 0, NULL,
      NULL, '${(data.notes || '').replace(/'/g, "''")}', 0, 1, '${now}', '${now}',
      ${data.isBossAdvance ? 1 : 0}
    );
  `);

  let primaryApId: string | undefined = data.reconciledApId;

  // 寫入明細
  if (data.lineItems && data.lineItems.length > 0) {
    for (const item of data.lineItems) {
      const itemId = item.id || `PLI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      dbInstance.run(`
        INSERT INTO fin_payment_line_items (
          id, paymentId, sourceType, sourceId, sourceNumber, itemType,
          appliedAmount, feeAmount, isFeeAbsorbedByCompany, discountAmount,
          offsetExpenseId, withholdingTaxAmt, nhiAmt, projectId, notes
        ) VALUES (
          '${itemId}', '${id}', '${item.sourceType}', '${item.sourceId}',
          '${(item.sourceNumber || '').replace(/'/g, "''")}', '${item.itemType || 'STANDARD'}',
          ${item.appliedAmount}, ${item.feeAmount || 0}, ${item.isFeeAbsorbedByCompany ? 1 : 0},
          ${item.discountAmount || 0}, ${item.offsetExpenseId ? `'${item.offsetExpenseId}'` : 'NULL'},
          ${item.withholdingTaxAmt || 0}, ${item.nhiAmt || 0},
          ${item.projectId ? `'${item.projectId}'` : 'NULL'},
          '${(item.notes || '').replace(/'/g, "''")}'
        );
      `);

      // 若沖抵來源為 AP 對帳單，更新對帳單為 PAID
      if (item.sourceType === 'AP' && data.status === 'POSTED') {
        if (!primaryApId) primaryApId = item.sourceId;
        dbInstance.run(`
          UPDATE ap_reconciliations
          SET status = 'PAID', disbursedAt = '${data.postingDate}', updatedAt = '${now}'
          WHERE id = '${item.sourceId}';
        `);
        try {
          dbInstance.run(`
            UPDATE accounts_payable
            SET status = 'PAID', remainingAmount = 0, appliedAmount = originalAmount
            WHERE sourceId = '${item.sourceId}';
          `);
        } catch (_) {}
      }
    }
  }

  // 若支付方式為支票，自動在 bank_checks 產生黃燈支票 (ISSUED，不扣實體存款)
  if (data.paymentMethod === 'CHECK' && data.checkNumber) {
    const chkId = `CHK-P-${Date.now()}`;
    const chkDueDate = data.checkDueDate || data.postingDate;
    const replacesSql = data.replacesCheckNumber ? `'${data.replacesCheckNumber.replace(/'/g, "''")}'` : 'NULL';
    const apIdSql = primaryApId ? `'${primaryApId.replace(/'/g, "''")}'` : 'NULL';
    const noteText = data.replacesCheckNumber
      ? `換補退票 [${data.replacesCheckNumber}] 自動關聯新期票 (黃燈未兌現)`
      : '付款單自動關聯期票 (黃燈未兌現)';

    dbInstance.run(`
      INSERT OR REPLACE INTO bank_checks (
        id, checkNumber, type, companyId, counterpartyName, amount,
        issueDate, dueDate, bankName, drawerBank, paymentId,
        expectedClearanceDate, actualClearanceDate, status, voidReason, notes,
        replacesCheckNumber, reconciledApId
      ) VALUES (
        '${chkId}', '${data.checkNumber.replace(/'/g, "''")}', 'PAYABLE', '${data.companyId}',
        '${(data.partnerName || data.customVendorName || '廠商').replace(/'/g, "''")}',
        ${data.totalAmount}, '${data.documentDate}', '${chkDueDate}',
        '${(data.bankAccountName || '公司帳戶').replace(/'/g, "''")}',
        '${(data.drawerBank || data.bankAccountName || '公司帳戶').replace(/'/g, "''")}',
        '${id}', '${chkDueDate}', NULL, 'ISSUED', NULL, '${noteText}',
        ${replacesSql}, ${apIdSql}
      );
    `);

    if (data.bankAccountId && data.bankAccountId !== 'CASH') {
      dbInstance.run(`
        UPDATE company_bank_accounts
        SET nextCheckNumber = COALESCE(nextCheckNumber, 1000) + 1
        WHERE id = '${data.bankAccountId}';
      `);
    }
  } else if ((data.paymentMethod === 'TT' || data.paymentMethod === 'CASH') && data.status === 'POSTED') {
    // 電匯放款或指定實體帳戶扣款：僅當具有實體/虛擬帳戶 ID（非 CASH 無帳戶現金櫃檯）時扣除餘額
    if (data.bankAccountId && data.bankAccountId !== 'CASH') {
      dbInstance.run(`
        UPDATE company_bank_accounts
        SET currentBalance = currentBalance - ${data.totalAmount}
        WHERE id = '${data.bankAccountId}';
      `);
    }
  }

  recordAuditLog(
    operatorName,
    '開立出納付款單',
    '出納放款與收納工作台',
    data.paymentNo,
    {
      '付款單號': data.paymentNo,
      '受款對象': data.partnerName || data.customVendorName,
      '出款帳戶': data.bankAccountName,
      '支付方式': data.paymentMethod === 'CHECK' ? `期票支票 [${data.checkNumber}]` : data.paymentMethod,
      '實付總額': `NT$ ${data.totalAmount.toLocaleString()}`,
      '入帳日期': data.postingDate,
      ...(data.replacesCheckNumber ? { '換補退票號': data.replacesCheckNumber } : {}),
      ...(data.isBossAdvance ? { '老闆私帳代墊': '是 (特例)' } : {})
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
    version: 1
  };
}

// -------------------------------------------------------------
// 🏛️ 支票三燈號生命週期流轉 (Check Lifecycle: ISSUED -> CLEARED / BOUNCED / VOIDED)
// -------------------------------------------------------------

export function updateBankCheckStatus(
  checkId: string,
  newStatus: BankCheck['status'],
  actualClearanceDate?: string,
  voidReason?: string,
  operatorName: string = '李出納專員',
  options?: { rollbackMode?: 'REPAY' | 'REBILL' }
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();

  try { dbInstance.run(`ALTER TABLE bank_checks ADD COLUMN replacesCheckNumber TEXT;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE bank_checks ADD COLUMN reconciledApId TEXT;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE bank_checks ADD COLUMN reconciledArId TEXT;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN bouncedCheckNumber TEXT;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN bouncedReason TEXT;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE ap_reconciliations ADD COLUMN bouncedAt TEXT;`); } catch (_) {}
  ensureArTablesAndColumns(dbInstance);

  const res = dbInstance.exec(`SELECT checkNumber, amount, companyId, bankName, paymentId, status, type, reconciledApId, reconciledArId FROM bank_checks WHERE id = '${checkId}';`);
  if (!res.length || !res[0].values.length) throw new Error('找不到該支票');
  const row = res[0].values[0];
  const checkNumber = String(row[0]);
  const amount = Number(row[1] || 0);
  const companyId = String(row[2]);
  const bankName = String(row[3]);
  const paymentId = row[4] ? String(row[4]) : null;
  const oldStatus = String(row[5]);
  const checkType = String(row[6]);
  const directApId = row[7] ? String(row[7]) : null;
  const directArId = row[8] ? String(row[8]) : null;

  const actualDateVal = actualClearanceDate ? `'${actualClearanceDate}'` : 'NULL';
  const reasonVal = voidReason ? `'${voidReason.replace(/'/g, "''")}'` : 'NULL';

  dbInstance.run(`
    UPDATE bank_checks
    SET status = '${newStatus}',
        actualClearanceDate = ${actualDateVal},
        voidReason = ${reasonVal}
    WHERE id = '${checkId}';
  `);

  // 🟢 綠燈：存摺兌現增減額（應付扣款 - / 應收兌現入庫 +）
  if (newStatus === 'CLEARED' && oldStatus !== 'CLEARED') {
    let targetBankAccId: string | null = null;
    let effectiveClearAmount = amount;
    if (checkType === 'PAYABLE' && paymentId) {
      const pRes = dbInstance.exec(`SELECT bankAccountId FROM fin_payment_records WHERE id = '${paymentId}';`);
      if (pRes.length && pRes[0].values.length && pRes[0].values[0][0]) {
        targetBankAccId = String(pRes[0].values[0][0]);
      }
    } else if (checkType === 'RECEIVABLE') {
      try {
        const arcRes = dbInstance.exec(`
          SELECT id, bankAccountId, netReceivedAmount FROM fin_ar_collections
          WHERE checkNumber = '${checkNumber.replace(/'/g, "''")}' AND status = 'PENDING_CLEARANCE'
          LIMIT 1;
        `);
        if (arcRes.length && arcRes[0].values.length) {
          const arcId = String(arcRes[0].values[0][0]);
          targetBankAccId = arcRes[0].values[0][1] ? String(arcRes[0].values[0][1]) : null;
          const netRecAmt = Number(arcRes[0].values[0][2] || 0);
          if (netRecAmt > 0) effectiveClearAmount = netRecAmt;
          dbInstance.run(`UPDATE fin_ar_collections SET status = 'POSTED' WHERE id = '${arcId}';`);
        }
      } catch (_) {}
    }

    const deltaSign = checkType === 'PAYABLE' ? '-' : checkType === 'RECEIVABLE' ? '+' : '';
    if (deltaSign && targetBankAccId !== 'CASH') {
      if (targetBankAccId) {
        dbInstance.run(`
          UPDATE company_bank_accounts
          SET currentBalance = currentBalance ${deltaSign} ${effectiveClearAmount}
          WHERE id = '${targetBankAccId}';
        `);
      } else {
        dbInstance.run(`
          UPDATE company_bank_accounts
          SET currentBalance = currentBalance ${deltaSign} ${effectiveClearAmount}
          WHERE companyId = '${companyId}' AND bankName LIKE '%${bankName.slice(0, 4).replace(/'/g, "''")}%';
        `);
      }
    }
  }

  // 🔴 退票或作廢：🛡️ 觸發應付回滾 (AP) 或應收跳票回滾 (AR)
  const rollbackMode = options?.rollbackMode || 'REPAY';
  if (newStatus === 'BOUNCED' || newStatus === 'VOIDED') {
    if (checkType === 'RECEIVABLE') {
      // 業主支票跳票／作廢：回滾應收帳款餘額並亮起跳票警訊
      try {
        const colRes = dbInstance.exec(`
          SELECT id, arId, amount FROM fin_ar_collections
          WHERE checkNumber = '${checkNumber.replace(/'/g, "''")}' AND status IN ('PENDING_CLEARANCE', 'POSTED');
        `);
        if (colRes.length && colRes[0].values.length) {
          for (const cRow of colRes[0].values) {
            const colId = String(cRow[0]);
            const arId = String(cRow[1]);
            const colAmt = Number(cRow[2] || 0);
            dbInstance.run(`
              UPDATE fin_ar_collections
              SET status = '${newStatus === 'BOUNCED' ? 'BOUNCED' : 'VOIDED'}'
              WHERE id = '${colId}';
            `);
            const arRes = dbInstance.exec(`SELECT amount, appliedAmount FROM accounts_receivable WHERE id = '${arId}';`);
            if (arRes.length && arRes[0].values.length) {
              const totalAmt = Number(arRes[0].values[0][0] || 0);
              const prevApplied = Number(arRes[0].values[0][1] || 0);
              const nextApplied = Math.max(0, prevApplied - colAmt);
              const nextRemaining = Math.max(0, totalAmt - nextApplied);
              const nextArStatus = nextApplied > 0 ? 'PARTIAL' : 'OPEN';
              dbInstance.run(`
                UPDATE accounts_receivable
                SET appliedAmount = ${nextApplied},
                    remainingAmount = ${nextRemaining},
                    status = '${nextArStatus}',
                    bouncedCheckNumber = '${checkNumber.replace(/'/g, "''")}',
                    bouncedReason = ${reasonVal},
                    bouncedAt = '${now}',
                    updatedAt = '${now}'
                WHERE id = '${arId}';
              `);
            }
          }
        } else if (directArId) {
          const arRes = dbInstance.exec(`SELECT amount, appliedAmount FROM accounts_receivable WHERE id = '${directArId}';`);
          if (arRes.length && arRes[0].values.length) {
            const totalAmt = Number(arRes[0].values[0][0] || 0);
            const prevApplied = Number(arRes[0].values[0][1] || 0);
            const nextApplied = Math.max(0, prevApplied - amount);
            const nextRemaining = Math.max(0, totalAmt - nextApplied);
            const nextArStatus = nextApplied > 0 ? 'PARTIAL' : 'OPEN';
            dbInstance.run(`
              UPDATE accounts_receivable
              SET appliedAmount = ${nextApplied},
                  remainingAmount = ${nextRemaining},
                  status = '${nextArStatus}',
                  bouncedCheckNumber = '${checkNumber.replace(/'/g, "''")}',
                  bouncedReason = ${reasonVal},
                  bouncedAt = '${now}',
                  updatedAt = '${now}'
              WHERE id = '${directArId}';
            `);
          }
        }
      } catch (_) {}
    } else {
      const affectedApIds = new Set<string>();
      if (directApId) affectedApIds.add(directApId);

      if (paymentId) {
        const pliRes = dbInstance.exec(`SELECT sourceId, sourceType FROM fin_payment_line_items WHERE paymentId = '${paymentId}';`);
        if (pliRes.length && pliRes[0].values.length) {
          for (const pli of pliRes[0].values) {
            const sId = String(pli[0]);
            const sType = String(pli[1]);
            if (sType === 'AP') affectedApIds.add(sId);
          }
        }

        // 將該付款單標記為 VOIDED
        const voidNote = newStatus === 'BOUNCED'
          ? `支票【${checkNumber}】退票 (${rollbackMode === 'REBILL' ? '整筆退回重新請款' : '退回重新付款'}): ${voidReason || '退票'}`
          : `支票【${checkNumber}】作廢: ${voidReason || '作廢'}`;

        dbInstance.run(`
          UPDATE fin_payment_records
          SET status = 'VOIDED', voidReason = '${voidNote.replace(/'/g, "''")}', updatedAt = '${now}'
          WHERE id = '${paymentId}';
        `);
      }

      for (const apId of affectedApIds) {
        if (newStatus === 'BOUNCED' && rollbackMode === 'REBILL') {
          // 整筆交易退回重來：作廢對帳單並將所有進貨簽收單釋放回待對帳水池
          try {
            voidApReconciliation(apId, `支票【${checkNumber}】退票退回重新請款: ${voidReason || ''}`, operatorName);
          } catch (_) {}
        } else {
          // 退回重新付款：對帳單退回 APPROVED，保留退票紀錄警訊
          dbInstance.run(`
            UPDATE ap_reconciliations
            SET status = 'APPROVED',
                disbursedAt = NULL,
                bouncedCheckNumber = '${checkNumber.replace(/'/g, "''")}',
                bouncedReason = ${reasonVal},
                bouncedAt = '${now}',
                updatedAt = '${now}'
            WHERE id = '${apId}';
          `);
          try {
            dbInstance.run(`UPDATE accounts_payable SET status = 'OPEN', remainingAmount = originalAmount, appliedAmount = 0 WHERE sourceId = '${apId}';`);
          } catch (_) {}
        }
      }
    }
  }

  recordAuditLog(
    operatorName,
    `支票狀態變更為 [${newStatus}]`,
    '票據管理與資金雷達',
    checkNumber,
    {
      '支票號碼': checkNumber,
      '原狀態': oldStatus,
      '新狀態': newStatus,
      '票面金額': `NT$ ${amount.toLocaleString()}`,
      '實際兌現日': actualClearanceDate || '未填',
      '退回處置模式': newStatus === 'BOUNCED' ? (rollbackMode === 'REBILL' ? '退回重新請款(整筆重來)' : '退回重新付款') : '無',
      '作廢/退票原因': voidReason || '無'
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();
}

// 重新關聯支票與應付對帳單 / 換補原退票號
export function relinkCheckToAp(
  checkId: string,
  apId: string | null,
  replacesCheckNumber?: string,
  operatorName: string = '李出納專員'
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  try { dbInstance.run(`ALTER TABLE bank_checks ADD COLUMN replacesCheckNumber TEXT;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE bank_checks ADD COLUMN reconciledApId TEXT;`); } catch (_) {}

  const res = dbInstance.exec(`SELECT checkNumber, paymentId FROM bank_checks WHERE id = '${checkId}';`);
  if (!res.length || !res[0].values.length) throw new Error('找不到該支票');
  const checkNumber = String(res[0].values[0][0]);
  const paymentId = res[0].values[0][1] ? String(res[0].values[0][1]) : null;

  const apSql = apId ? `'${apId.replace(/'/g, "''")}'` : 'NULL';
  const repSql = replacesCheckNumber?.trim() ? `'${replacesCheckNumber.trim().replace(/'/g, "''")}'` : 'NULL';

  let noteSuffix = '';
  let apNumberSnapshot = '';
  if (apId) {
    const apRes = dbInstance.exec(`SELECT reconciliationNumber FROM ap_reconciliations WHERE id = '${apId}';`);
    if (apRes.length && apRes[0].values.length) {
      apNumberSnapshot = String(apRes[0].values[0][0]);
      noteSuffix = `已手動關聯對帳單 [${apNumberSnapshot}]`;
    }
  }
  if (replacesCheckNumber?.trim()) {
    noteSuffix += `${noteSuffix ? ' · ' : ''}換補原退票 [${replacesCheckNumber.trim()}]`;
  }

  dbInstance.run(`
    UPDATE bank_checks
    SET reconciledApId = ${apSql},
        replacesCheckNumber = ${repSql},
        notes = '${(noteSuffix || '手動更新票據關聯').replace(/'/g, "''")}'
    WHERE id = '${checkId}';
  `);

  // 若為有效支票且有關聯之付款單與對帳單，同步補齊明細與對帳單狀態
  if (apId && paymentId) {
    const existingPli = dbInstance.exec(`SELECT id FROM fin_payment_line_items WHERE paymentId = '${paymentId}' AND sourceType = 'AP' AND sourceId = '${apId}';`);
    if (!existingPli.length || !existingPli[0].values.length) {
      const pInfo = dbInstance.exec(`SELECT totalAmount FROM fin_payment_records WHERE id = '${paymentId}';`);
      const pAmt = pInfo.length && pInfo[0].values.length ? Number(pInfo[0].values[0][0] || 0) : 0;
      dbInstance.run(`
        INSERT INTO fin_payment_line_items (
          id, paymentId, sourceType, sourceId, sourceNumber, itemType,
          appliedAmount, feeAmount, isFeeAbsorbedByCompany, discountAmount
        ) VALUES (
          'PLI-RELINK-${Date.now()}', '${paymentId}', 'AP', '${apId}',
          '${apNumberSnapshot.replace(/'/g, "''")}', 'STANDARD', ${pAmt}, 0, 1, 0
        );
      `);
    }
  }

  recordAuditLog(
    operatorName,
    '重新關聯支票對帳單/換補票號',
    '票據管理與資金雷達',
    checkNumber,
    {
      '支票號碼': checkNumber,
      '關聯對帳單': apNumberSnapshot || apId || '解除關聯',
      '換補原票號': replacesCheckNumber?.trim() || '無'
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();
}
