import type {
  AccountReceivable,
  ProjectAdvanceReceipt,
  SuspenseReceipt
} from '../../types/erp';
import {
  getDbInstance,
  notifyListeners,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { ensureArTablesAndColumns } from '../core/schemaOperations';
import { createAccountsReceivable } from './arRepository';
import { recordAuditLog } from './auditRepository';
import { syncDocumentInvoice } from './invoiceAndTaxRepository';

// -------------------------------------------------------------
// 🏛️ 未知款項暫收池 (Suspense Receipts - 支援分批認領拆沖)
// -------------------------------------------------------------

export function getAllSuspenseReceipts(): SuspenseReceipt[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureArTablesAndColumns(dbInstance);
  try {
    const res = dbInstance.exec(`
      SELECT id, companyId, bankAccountId, bankAccountName, amount, receivedDate,
             payerInfo, isAllocated, allocatedToArId, notes, createdAt,
             COALESCE(allocatedAmount, CASE WHEN isAllocated = 1 THEN amount ELSE 0 END),
             COALESCE(remainingAmount, CASE WHEN isAllocated = 1 THEN 0 ELSE amount END)
      FROM fin_suspense_receipts
      ORDER BY isAllocated ASC, receivedDate DESC;
    `);
    if (!res.length) return [];
    return res[0].values.map(v => {
      const total = Number(v[4] || 0);
      const isAlloc = Boolean(Number(v[7] || 0));
      const alloc = Number(v[11] ?? (isAlloc ? total : 0));
      const rem = Number(v[12] ?? (isAlloc ? 0 : Math.max(0, total - alloc)));
      return {
        id: String(v[0]),
        companyId: String(v[1]),
        bankAccountId: String(v[2]),
        bankAccountName: v[3] ? String(v[3]) : undefined,
        amount: total,
        allocatedAmount: alloc,
        remainingAmount: rem,
        receivedDate: String(v[5]),
        payerInfo: String(v[6]),
        isAllocated: isAlloc,
        allocatedToArId: v[8] ? String(v[8]) : undefined,
        notes: v[9] ? String(v[9]) : undefined,
        createdAt: v[10] ? String(v[10]) : undefined,
      };
    });
  } catch (e) {
    return [];
  }
}

export function createSuspenseReceipt(
  data: {
    companyId: string;
    bankAccountId: string;
    amount: number;
    receivedDate: string;
    payerInfo: string;
    notes?: string;
  },
  operatorName: string = 'B出納'
): SuspenseReceipt {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureArTablesAndColumns(dbInstance);
  if (data.amount <= 0) throw new Error('暫收金額必須大於 0');
  if (!data.payerInfo?.trim()) throw new Error('請填寫銀行存摺匯入來源或附言摘要');

  const now = new Date().toISOString();
  const id = `SUSP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  let bankAccName = '公司現金櫃台';
  if (data.bankAccountId && data.bankAccountId !== 'CASH') {
    const bRes = dbInstance.exec(`SELECT bankName, accountName FROM company_bank_accounts WHERE id = '${data.bankAccountId}';`);
    if (!bRes.length || !bRes[0].values.length) {
      throw new Error('找不到指定的收款帳戶');
    }
    bankAccName = `${String(bRes[0].values[0][0])} (${String(bRes[0].values[0][1])})`;
    // 銀行帳戶立即入庫加計餘額（確保帳實相符，但暫不認列營業收入與稅額）
    dbInstance.run(`
      UPDATE company_bank_accounts
      SET currentBalance = currentBalance + ${data.amount}
      WHERE id = '${data.bankAccountId}';
    `);
  }

  dbInstance.run(`
    INSERT INTO fin_suspense_receipts (
      id, companyId, bankAccountId, bankAccountName, amount, allocatedAmount, remainingAmount,
      receivedDate, payerInfo, isAllocated, allocatedToArId, notes, createdAt
    ) VALUES (
      '${id}', '${data.companyId}', '${data.bankAccountId}', '${bankAccName.replace(/'/g, "''")}',
      ${data.amount}, 0, ${data.amount}, '${data.receivedDate}', '${data.payerInfo.trim().replace(/'/g, "''")}',
      0, NULL, ${data.notes ? `'${data.notes.replace(/'/g, "''")}'` : 'NULL'}, '${now}'
    );
  `);

  recordAuditLog(
    operatorName,
    '出納登錄未知款項暫收池',
    '未知款項暫收池',
    id,
    {
      '入帳公司/帳戶': bankAccName,
      '入帳日期': data.receivedDate,
      '暫收金額': `NT$ ${data.amount.toLocaleString()}`,
      '存摺來源附言': data.payerInfo.trim(),
      '稅務狀態': '暫不認列營收與營業稅 (待會計查明認領)',
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    companyId: data.companyId,
    bankAccountId: data.bankAccountId,
    bankAccountName: bankAccName,
    amount: data.amount,
    allocatedAmount: 0,
    remainingAmount: data.amount,
    receivedDate: data.receivedDate,
    payerInfo: data.payerInfo.trim(),
    isAllocated: false,
    notes: data.notes,
    createdAt: now,
  };
}

export function allocateSuspenseReceipt(
  suspenseId: string,
  targetArId: string,
  operatorName: string = '張會計長',
  requestedAllocateAmount?: number
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureArTablesAndColumns(dbInstance);
  const now = new Date().toISOString();

  const suspRes = dbInstance.exec(`
    SELECT companyId, bankAccountId, bankAccountName, amount, receivedDate, isAllocated,
           COALESCE(allocatedAmount, CASE WHEN isAllocated = 1 THEN amount ELSE 0 END),
           COALESCE(remainingAmount, CASE WHEN isAllocated = 1 THEN 0 ELSE amount END)
    FROM fin_suspense_receipts WHERE id = '${suspenseId}';
  `);
  if (!suspRes.length || !suspRes[0].values.length) throw new Error('找不到該筆暫收紀錄');
  const suspCompanyId = String(suspRes[0].values[0][0]);
  const suspBankId = String(suspRes[0].values[0][1]);
  const suspBankName = String(suspRes[0].values[0][2] || '');
  const suspTotalAmt = Number(suspRes[0].values[0][3] || 0);
  const suspDate = String(suspRes[0].values[0][4] || now.slice(0, 10));
  const alreadyAllocated = Boolean(Number(suspRes[0].values[0][5] || 0));
  const prevSuspAllocated = Number(suspRes[0].values[0][6] || 0);
  const suspRemaining = Number(suspRes[0].values[0][7] ?? (alreadyAllocated ? 0 : suspTotalAmt));
  if (alreadyAllocated || suspRemaining <= 0.01) {
    throw new Error('該筆暫收款已全數認領結清，不可重複沖銷');
  }

  const arRes = dbInstance.exec(`
    SELECT arNumber, companyId, amount, appliedAmount, remainingAmount, hasInvoice, status, COALESCE(invoiceIssueMode, 'DELIVERED')
    FROM accounts_receivable WHERE id = '${targetArId}';
  `);
  if (!arRes.length || !arRes[0].values.length) throw new Error('找不到目標應收帳款');
  const arNumber = String(arRes[0].values[0][0]);
  const arCompanyId = String(arRes[0].values[0][1]);
  const totalAmt = Number(arRes[0].values[0][2] || 0);
  const prevApplied = Number(arRes[0].values[0][3] || 0);
  const prevRemaining = Number(arRes[0].values[0][4] || 0);
  const arHasInvoice = arRes[0].values[0][5] === null || arRes[0].values[0][5] === undefined ? true : Boolean(Number(arRes[0].values[0][5]));
  const arStatus = String(arRes[0].values[0][6]);
  const arIssueMode = String(arRes[0].values[0][7] || 'DELIVERED');
  const strictCorpBankLock = arHasInvoice && arIssueMode !== 'SELF_RETAINED';

  if (arStatus === 'VOIDED' || arStatus === 'COLLECTED' || prevRemaining <= 0.01) {
    throw new Error('目標應收單已作廢或已收齊，請改選其他待收款應收單');
  }

  // 校驗入帳公司／老闆私帳規則
  let suspIsVirtual = suspCompanyId === 'BOSS-01';
  if (suspBankId && suspBankId !== 'CASH') {
    const bRes = dbInstance.exec(`SELECT companyId, isVirtualAccount FROM company_bank_accounts WHERE id = '${suspBankId}';`);
    if (bRes.length && bRes[0].values.length) {
      const realComp = String(bRes[0].values[0][0]);
      const isVirt = Boolean(Number(bRes[0].values[0][1] || 0)) || realComp === 'BOSS-01';
      suspIsVirtual = isVirt;
      if (strictCorpBankLock && (isVirt || realComp !== arCompanyId)) {
        throw new Error('規則攔截：該應收單已開立發票，不可認領入「老闆私帳」或其他公司帳戶的暫收款！');
      }
      if (!strictCorpBankLock && !isVirt && realComp !== arCompanyId) {
        throw new Error('規則攔截：暫收款收款法人與目標應收請款單所屬公司不符！');
      }
    }
  } else if (strictCorpBankLock && suspIsVirtual) {
    throw new Error('規則攔截：該應收單已開立發票，不可認領進老闆私帳之暫收款！');
  }

  const maxAllow = Math.min(suspRemaining, prevRemaining);
  const applyAmt = requestedAllocateAmount && requestedAllocateAmount > 0
    ? Math.min(requestedAllocateAmount, maxAllow)
    : maxAllow;

  if (applyAmt <= 0) throw new Error('認領沖銷金額必須大於 0');

  const nextApplied = prevApplied + applyAmt;
  const nextRemaining = Math.max(0, totalAmt - nextApplied);
  const nextArStatus = nextRemaining <= 0.01 ? 'COLLECTED' : 'PARTIAL';

  const nextSuspAllocated = prevSuspAllocated + applyAmt;
  const nextSuspRemaining = Math.max(0, suspTotalAmt - nextSuspAllocated);
  const nextSuspIsAllocated = nextSuspRemaining <= 0.01 ? 1 : 0;

  dbInstance.run(`
    UPDATE fin_suspense_receipts
    SET isAllocated = ${nextSuspIsAllocated},
        allocatedAmount = ${nextSuspAllocated},
        remainingAmount = ${nextSuspRemaining},
        allocatedToArId = '${targetArId}',
        notes = COALESCE(notes, '') || ' [${now.slice(0, 10)} 認領 NT$ ${applyAmt.toLocaleString()} ➔ ${arNumber}]'
    WHERE id = '${suspenseId}';
  `);

  dbInstance.run(`
    UPDATE accounts_receivable
    SET appliedAmount = ${nextApplied},
        remainingAmount = ${nextRemaining},
        status = '${nextArStatus}',
        updatedAt = '${now}'
    WHERE id = '${targetArId}';
  `);

  // 記錄於 AR 收款歷程 (不重複加計銀行餘額，因暫收登錄時已計入存摺)
  const colId = `ARC-SUSP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  dbInstance.run(`
    INSERT INTO fin_ar_collections (
      id, arId, arNumber, companyId, collectionMethod, bankAccountId, bankAccountName,
      amount, feeAmount, overpaymentAmount, netReceivedAmount, receivedDate, suspenseId, status,
      notes, createdBy, createdAt
    ) VALUES (
      '${colId}', '${targetArId}', '${arNumber}', '${arCompanyId}', 'SUSPENSE',
      '${suspBankId}', '${suspBankName.replace(/'/g, "''")}',
      ${applyAmt}, 0, 0, ${applyAmt}, '${suspDate}', '${suspenseId}', 'POSTED',
      '由暫收池 [${suspenseId}] 分批認領沖銷（${nextSuspRemaining > 0.01 ? `池內仍餘 NT$ ${nextSuspRemaining.toLocaleString()}` : '暫收款已全額認領完畢'}，不重複加計銀行餘額）',
      '${operatorName.replace(/'/g, "''")}', '${now}'
    );
  `);

  recordAuditLog(
    operatorName,
    '暫收款認領轉拋 AR (觸發營收核對)',
    '未知款項暫收池',
    arNumber,
    {
      '暫收紀錄 ID': suspenseId,
      '沖銷應收單號': arNumber,
      '本次認領金額': `NT$ ${applyAmt.toLocaleString()}`,
      '暫收池剩餘餘額': `NT$ ${nextSuspRemaining.toLocaleString()}`,
      'AR沖銷後狀態': nextArStatus === 'COLLECTED' ? '已收齊結清' : `部分收款 (餘 NT$ ${nextRemaining.toLocaleString()})`,
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();
}

// -------------------------------------------------------------
// 🏛️ 案場預收款／貸款先撥款直入案場帳 (Project Advances)
// -------------------------------------------------------------

export function getAllProjectAdvances(): ProjectAdvanceReceipt[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureArTablesAndColumns(dbInstance);
  try {
    const res = dbInstance.exec(`
      SELECT id, projectId, projectName, customerId, customerName, companyId,
             bankAccountId, bankAccountName, collectionMethod, amount, receivedDate,
             sourceType, sourceArId, sourceCheckNumber, notes, createdBy, createdAt
      FROM fin_project_advances
      ORDER BY receivedDate DESC, createdAt DESC;
    `);
    if (!res.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      projectId: String(v[1]),
      projectName: v[2] ? String(v[2]) : undefined,
      customerId: v[3] ? String(v[3]) : undefined,
      customerName: String(v[4]),
      companyId: String(v[5]),
      bankAccountId: String(v[6]),
      bankAccountName: v[7] ? String(v[7]) : undefined,
      collectionMethod: (v[8] || 'TT') as ProjectAdvanceReceipt['collectionMethod'],
      amount: Number(v[9] || 0),
      receivedDate: String(v[10]),
      sourceType: (v[11] || 'EARLY_LOAN') as ProjectAdvanceReceipt['sourceType'],
      sourceArId: v[12] ? String(v[12]) : undefined,
      sourceCheckNumber: v[13] ? String(v[13]) : undefined,
      notes: v[14] ? String(v[14]) : undefined,
      createdBy: v[15] ? String(v[15]) : undefined,
      createdAt: v[16] ? String(v[16]) : undefined,
    }));
  } catch (_) {
    return [];
  }
}

export function createProjectAdvance(
  data: {
    projectId: string;
    projectName?: string;
    customerId?: string;
    customerName: string;
    companyId: string;
    bankAccountId: string;
    collectionMethod: 'TT' | 'CHECK' | 'CASH';
    amount: number;
    receivedDate: string;
    sourceType?: 'EARLY_LOAN' | 'OVERPAYMENT' | 'DEPOSIT';
    checkNumber?: string;
    checkDueDate?: string;
    drawerBank?: string;
    notes?: string;
  },
  operatorName: string = 'B出納'
): ProjectAdvanceReceipt {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureArTablesAndColumns(dbInstance);
  if (!data.projectId) throw new Error('請選擇預收款歸屬的工程案場');
  if (data.amount <= 0) throw new Error('預收金額必須大於 0');

  const now = new Date().toISOString();
  const id = `PADV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  let bankAccName = '公司現金櫃台';
  let resolvedBankCompId = data.companyId;

  if (data.collectionMethod !== 'CASH') {
    const bRes = dbInstance.exec(`SELECT companyId, bankName, accountName FROM company_bank_accounts WHERE id = '${data.bankAccountId}';`);
    if (!bRes.length || !bRes[0].values.length) throw new Error('找不到指定的入帳銀行帳戶');
    resolvedBankCompId = String(bRes[0].values[0][0]);
    bankAccName = `${String(bRes[0].values[0][1])} (${String(bRes[0].values[0][2])})`;
    if (data.collectionMethod === 'TT') {
      dbInstance.run(`
        UPDATE company_bank_accounts
        SET currentBalance = currentBalance + ${data.amount}
        WHERE id = '${data.bankAccountId}';
      `);
    }
  }

  let checkNoClean = '';
  if (data.collectionMethod === 'CHECK') {
    checkNoClean = (data.checkNumber || '').trim();
    if (!checkNoClean) throw new Error('收受預付支票請填入支票號碼');
    const dueDate = data.checkDueDate || data.receivedDate;
    const chkId = `CHK-ADV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    dbInstance.run(`
      INSERT INTO bank_checks (
        id, checkNumber, type, companyId, counterpartyName, amount,
        issueDate, dueDate, bankName, drawerBank, paymentId,
        expectedClearanceDate, status, notes
      ) VALUES (
        '${chkId}', '${checkNoClean.replace(/'/g, "''")}', 'RECEIVABLE',
        '${resolvedBankCompId}', '${data.customerName.replace(/'/g, "''")}', ${data.amount},
        '${data.receivedDate}', '${dueDate}', '${bankAccName.replace(/'/g, "''")}',
        ${data.drawerBank ? `'${data.drawerBank.replace(/'/g, "''")}'` : 'NULL'},
        '${id}', '${dueDate}', 'ISSUED',
        '案場 [${data.projectName || data.projectId}] 預收工程款支票 (待兌現)'
      );
    `);
  }

  const srcType = data.sourceType || 'EARLY_LOAN';
  dbInstance.run(`
    INSERT INTO fin_project_advances (
      id, projectId, projectName, customerId, customerName, companyId,
      bankAccountId, bankAccountName, collectionMethod, amount, receivedDate,
      sourceType, sourceCheckNumber, notes, createdBy, createdAt
    ) VALUES (
      '${id}', '${data.projectId}',
      ${data.projectName ? `'${data.projectName.replace(/'/g, "''")}'` : 'NULL'},
      ${data.customerId ? `'${data.customerId}'` : 'NULL'},
      '${data.customerName.replace(/'/g, "''")}', '${resolvedBankCompId}',
      '${data.collectionMethod === 'CASH' ? 'CASH' : data.bankAccountId}',
      '${bankAccName.replace(/'/g, "''")}', '${data.collectionMethod}',
      ${data.amount}, '${data.receivedDate}', '${srcType}',
      ${checkNoClean ? `'${checkNoClean.replace(/'/g, "''")}'` : 'NULL'},
      ${data.notes ? `'${data.notes.replace(/'/g, "''")}'` : 'NULL'},
      '${operatorName.replace(/'/g, "''")}', '${now}'
    );
  `);

  recordAuditLog(
    operatorName,
    '出納登錄案場預收款／貸款先撥款 (直入案場)',
    '工程案場借貸總帳',
    data.projectName || data.projectId,
    {
      '案場': data.projectName || data.projectId,
      '業主': data.customerName,
      '入帳帳戶': bankAccName,
      '預收金額': `NT$ ${data.amount.toLocaleString()}`,
      '類型': srcType === 'EARLY_LOAN' ? '銀行貸款先撥入' : srcType === 'DEPOSIT' ? '預付訂金' : '超付溢收',
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    projectId: data.projectId,
    projectName: data.projectName,
    customerId: data.customerId,
    customerName: data.customerName,
    companyId: resolvedBankCompId,
    bankAccountId: data.collectionMethod === 'CASH' ? 'CASH' : data.bankAccountId,
    bankAccountName: bankAccName,
    collectionMethod: data.collectionMethod,
    amount: data.amount,
    receivedDate: data.receivedDate,
    sourceType: srcType,
    sourceCheckNumber: checkNoClean || undefined,
    notes: data.notes,
    createdBy: operatorName,
    createdAt: now,
  };
}

// 直接針對工程案場分批補開／自主開立銷項發票 (不強制綁單一 AR)
export function issueInvoiceForProject(
  params: {
    projectId: string;
    companyId: string;
    customerId?: string;
    customerName: string;
    customerTaxId?: string;
    invoiceFormat: 'THREE_PART' | 'TWO_PART';
    invoiceIssueMode: 'DELIVERED' | 'SELF_RETAINED';
    invoiceNumber: string;
    invoiceDate: string;
    netAmount: number;
    taxAmount: number;
    totalAmount: number;
    createExtraTaxReceivable?: boolean;
    notes?: string;
  },
  operatorName: string = '會計專員'
): AccountReceivable | null {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureArTablesAndColumns(dbInstance);
  const cleanNo = params.invoiceNumber.trim().toUpperCase();
  if (!cleanNo) throw new Error('請填入發票字軌號碼');

  let resolvedTaxId = params.customerTaxId?.trim() || '';
  let resolvedProjName = '';
  if (params.projectId) {
    const pRes = dbInstance.exec(`SELECT name, ownerTaxId FROM projects WHERE id = '${params.projectId}';`);
    if (pRes.length && pRes[0].values.length) {
      resolvedProjName = pRes[0].values[0][0] ? String(pRes[0].values[0][0]) : '';
      if (!resolvedTaxId && pRes[0].values[0][1]) resolvedTaxId = String(pRes[0].values[0][1]);
    }
  }

  syncDocumentInvoice(dbInstance, {
    invoiceType: 'OUTPUT',
    invoiceFormat: params.invoiceFormat,
    invoiceIssueMode: params.invoiceIssueMode,
    invoiceNumber: cleanNo,
    invoiceDate: params.invoiceDate,
    companyId: params.companyId,
    partnerId: params.customerId || `PROJ-OWNER-${params.projectId}`,
    partnerName: params.customerName,
    partnerTaxId: resolvedTaxId || undefined,
    netAmount: params.netAmount,
    taxAmount: params.taxAmount,
    totalAmount: params.totalAmount,
    linkedProjectId: params.projectId,
    notes: params.notes,
    sourceDocumentType: 'AR',
    sourceDocumentId: `PRJ-${params.projectId}-${cleanNo}`,
  });

  let createdTaxAr: AccountReceivable | null = null;
  if (params.invoiceIssueMode === 'DELIVERED' && params.createExtraTaxReceivable && params.taxAmount > 0) {
    createdTaxAr = createAccountsReceivable(
      {
        projectId: params.projectId,
        projectName: resolvedProjName,
        customerId: params.customerId || `PROJ-OWNER-${params.projectId}`,
        customerName: params.customerName,
        customerTaxId: resolvedTaxId || undefined,
        companyId: params.companyId,
        title: `補開發票 [${cleanNo}] 5% 稅金補收`,
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
        notes: `案場已收款後續補開發票 [${cleanNo}] 銷售額 NT$ ${params.netAmount.toLocaleString()} 之稅金補收（限入公司戶）`,
      },
      operatorName
    );
  }

  recordAuditLog(
    operatorName,
    params.invoiceIssueMode === 'SELF_RETAINED' ? '案場自主分批開立報稅發票' : '案場補開銷項發票',
    '工程案場借貸總帳',
    resolvedProjName || params.projectId,
    {
      '發票號碼': cleanNo,
      '開票法人': params.companyId,
      '交付模式': params.invoiceIssueMode === 'SELF_RETAINED' ? '自主留存報稅(未給業主·稅金自理)' : '交付業主',
      '含稅金額': `NT$ ${params.totalAmount.toLocaleString()}`,
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();
  return createdTaxAr;
}
