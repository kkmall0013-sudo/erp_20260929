import type { Database } from 'sql.js';
import type { ModuleKey } from '../../types/erp';
import { SYSTEM_MODULES, seedUserPermissionData } from './dbConstants';
import { ensureArTablesAndColumns } from './schemaOperations';

// 資料庫完整性修復器 (Part 2: 使用者群組權限、財務會計核心表與預設測試帳號)
export function ensureUsersAndFinanceIntegrity(db: Database): void {
  // 自動為既有帳號將 groupId 移轉填補至 groupIds 陣列
  try {
    const uRes = db.exec(`SELECT id, groupId, groupIds FROM users;`);
    if (uRes.length && uRes[0].values.length) {
      for (const row of uRes[0].values) {
        const uid = String(row[0]);
        const gId = row[1] ? String(row[1]) : null;
        const gIds = row[2] ? String(row[2]) : null;
        if (gId && (!gIds || gIds === '[]' || gIds === 'null')) {
          const jsonVal = JSON.stringify([gId]);
          db.run(`UPDATE users SET groupIds = '${jsonVal}' WHERE id = '${uid}';`);
        }
      }
    }
  } catch (e) {
    // ignore
  }

  try {
    const res = db.exec(`SELECT count(*) FROM user_groups;`);
    const count = Number(res[0]?.values[0]?.[0] || 0);
    if (count === 0) {
      seedUserPermissionData(db);
    }
  } catch (e) {
    seedUserPermissionData(db);
  }

  // 確保唯一最高 SUPERADMIN 存在
  try {
    const superCheck = db.exec(`SELECT count(*) FROM users WHERE role = 'SUPERADMIN';`);
    const superCount = Number(superCheck[0]?.values[0]?.[0] || 0);
    if (superCount === 0) {
      db.run(`
        INSERT OR REPLACE INTO users (id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, canManageAllCompanies, groupId, groupIds, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, createdAt, updatedAt)
        VALUES ('USR-001', 'superadmin', '黃副總經理', 'huang.gm@mega-build.com.tw', 'SUPERADMIN', 1, 1, 1, 1, NULL, '[]', 'ACTIVE', '系統架構師兼營運長 (SUPERADMIN)', '["COMP-01","COMP-02"]', 'COMP-01', 'admin888', 0, '2026-01-01', '2026-01-01');
      `);
    }
  } catch (e) {
    console.error('Superadmin integrity check failed', e);
  }

  // 確保企業最高統裁 (集團董事長 BOSS) 帳號存在與全特許齊備
  try {
    const bossCheck = db.exec(`SELECT count(*) FROM users WHERE role = 'BOSS' OR id = 'USR-BOSS';`);
    const bossCount = Number(bossCheck[0]?.values[0]?.[0] || 0);
    if (bossCount === 0) {
      db.run(`
        INSERT OR REPLACE INTO users (id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, canManageAllCompanies, groupId, groupIds, companyGroupAssignments, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, createdAt, updatedAt)
        VALUES ('USR-BOSS', 'boss', '林大巨 董事長', 'lin.boss@mega-build.com.tw', 'BOSS', 1, 1, 1, 1, NULL, '[]', '[]', 'ACTIVE', '集團創辦人暨董事長 (企業最高統裁)', '["COMP-01","COMP-02"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01');
      `);
    } else {
      db.run(`UPDATE users SET canManageUsers = 1, canManageSystemConfigs = 1, canManageAdmins = 1, canManageAllCompanies = 1 WHERE role = 'BOSS';`);
    }
  } catch (e) {
    console.error('Boss integrity check failed', e);
  }

  // 升級檢測：為最高管理者與董事長賦予全集團法人管理特許，為資訊主任確保帳號管理特許與當前法人授權
  try {
    db.run(`UPDATE users SET canManageAllCompanies = 1 WHERE role IN ('SUPERADMIN', 'BOSS') OR id IN ('USR-001', 'USR-BOSS');`);
    db.run(`UPDATE users SET canManageUsers = 1, canManageAdmins = 1 WHERE id = 'USR-002';`);

    const compRows = db.exec(`SELECT id FROM companies WHERE isDeleted = 0;`);
    if (compRows.length && compRows[0].values.length) {
      const activeCompIds = compRows[0].values.map(v => String(v[0]));
      for (const targetUid of ['USR-001', 'USR-BOSS', 'USR-002']) {
        const uRes = db.exec(`SELECT allowedCompanies FROM users WHERE id = '${targetUid}';`);
        if (uRes.length && uRes[0].values.length) {
          const comps: string[] = uRes[0].values[0][0] ? JSON.parse(String(uRes[0].values[0][0])) : ['COMP-01'];
          let changed = false;
          for (const cId of activeCompIds) {
            if (!comps.includes(cId)) {
              comps.push(cId);
              changed = true;
            }
          }
          if (changed) {
            db.run(`UPDATE users SET allowedCompanies = '${JSON.stringify(comps)}' WHERE id = '${targetUid}';`);
          }
        }
      }
    }
  } catch (e) {
    console.error('Integrity sync for admin company access failed', e);
  }

  // 升級檢測：確保跨法人業務授權示範專員 USR-007 (趙專員 - 大巨財務 / 宏達採購) 存在
  try {
    const zhaoCheck = db.exec(`SELECT count(*) FROM users WHERE id = 'USR-007';`);
    if (!zhaoCheck.length || Number(zhaoCheck[0].values[0][0]) === 0) {
      db.run(`
        INSERT INTO users (id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, groupId, groupIds, companyGroupAssignments, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, createdAt, updatedAt)
        VALUES ('USR-007', 'matrix_zhao', '趙專員', 'zhao.matrix@mega-build.com.tw', 'USER', 0, 0, 0, 'GRP-ACC', '["GRP-ACC","GRP-PROC"]', '[{"companyId":"COMP-01","groupIds":["GRP-ACC"]},{"companyId":"COMP-02","groupIds":["GRP-PROC"]}]', 'ACTIVE', '跨法人調度專員 (大巨財務 / 宏達採購)', '["COMP-01","COMP-02"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01');
      `);
    }
  } catch (e) {
    console.error('USR-007 integrity check failed', e);
  }

  // 自動清理舊版含英文代號之日誌，並將既有種子審計日誌升級為高可讀性純中文差異格式
  try {
    db.run(`
      DELETE FROM audit_logs 
      WHERE action IN ('LOGIN','CREATE','UPDATE','DELETE','POST','VOID','PASSWORD_RESET','SELF_PASSWORD_CHANGE','STAGE_PENDING_DELETE','STAGE_ARCHIVE','RESTORE_USER','SUPERADMIN_RESTORE','PERMANENT_PURGE','AUTO_ARCHIVE','TRANSFER_SUPERADMIN')
         OR targetTable IN ('users','companies','user_groups','purchase_orders','valuations');
    `);
    db.run(`
      INSERT OR REPLACE INTO audit_logs (id, userId, userName, action, targetTable, targetId, beforeJson, afterJson, ipAddress, createdAt)
      VALUES
        ('LOG-01', '最高管理者', '黃副總經理', '登入系統', '同仁帳號', '黃副總經理', NULL, '{"權限身分":"最高管理者","登入設備":"工務處電腦"}', '公司內網', '2026-03-31 08:30:15'),
        ('LOG-02', '系統管理員', '陳資訊主任', '登入系統', '同仁帳號', '陳資訊主任', NULL, '{"權限身分":"系統管理員","登入設備":"資訊處電腦"}', '公司內網', '2026-03-31 09:05:22'),
        ('LOG-03', '系統管理員', '陳資訊主任', '新增資料', '同仁帳號', '王採購專員', NULL, '{"同仁姓名":"王採購專員","權限角色":"一般同仁","所屬業務群組":"採購發包組"}', '公司內網', '2026-03-31 09:30:00'),
        ('LOG-04', '一般同仁', '林工務主任', '登入系統', '同仁帳號', '林工務主任', NULL, '{"權限身分":"一般同仁","登入設備":"南港工地現場平板"}', '工地內網', '2026-03-31 10:12:00'),
        ('LOG-05', '最高管理者', '黃副總經理', '單據過帳', '採購單', '南港案預拌混凝土採購單', '{"單據狀態":"已核准"}', '{"單據狀態":"已過帳"}', '公司內網', '2026-03-31 10:15:00'),
        ('LOG-06', '一般同仁', '張會計長', '登入系統', '同仁帳號', '張會計長', NULL, '{"權限身分":"一般同仁","登入設備":"財務室電腦"}', '公司內網', '2026-03-31 11:20:00'),
        ('LOG-07', '一般同仁', '張會計長', '單據過帳', '估驗計價單', '連續壁工程第一期估驗單', '{"單據狀態":"已送審"}', '{"單據狀態":"已過帳"}', '公司內網', '2026-03-31 14:40:00'),
        ('LOG-08', '最高管理者', '黃副總經理', '修改資料', '同仁帳號', '陳資訊主任', '{"帳號管理專人特許":"關閉"}', '{"帳號管理專人特許":"開啟"}', '公司內網', '2026-03-31 15:10:00');
    `);
  } catch (e) {}

  // 🏛️ 確保財務會計與收納核心資料表存在
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS ap_reconciliations (
        id TEXT PRIMARY KEY,
        reconciliationNumber TEXT UNIQUE NOT NULL,
        companyId TEXT NOT NULL,
        vendorId TEXT NOT NULL,
        vendorName TEXT,
        billingPeriod TEXT NOT NULL,
        inboundTotalAmount REAL DEFAULT 0,
        discountAmount REAL DEFAULT 0,
        taxType TEXT DEFAULT 'TAX_EXCLUSIVE',
        taxAmount REAL DEFAULT 0,
        netPayableAmount REAL DEFAULT 0,
        invoiceNumber TEXT,
        hasInvoice INTEGER DEFAULT 1,
        paymentDueDate TEXT NOT NULL,
        status TEXT DEFAULT 'APPROVED',
        reconciledBy TEXT,
        approvedBy TEXT,
        disbursedAt TEXT,
        notes TEXT,
        receiptIds TEXT,
        isDeleted INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS fin_payment_records (
        id TEXT PRIMARY KEY,
        paymentNo TEXT UNIQUE NOT NULL,
        companyId TEXT NOT NULL,
        currency TEXT DEFAULT 'TWD',
        bankAccountId TEXT NOT NULL,
        bankAccountName TEXT,
        targetBankAccountId TEXT,
        partnerId TEXT,
        partnerName TEXT,
        customVendorName TEXT,
        paymentMethod TEXT DEFAULT 'TT',
        isReversal INTEGER DEFAULT 0,
        documentDate TEXT NOT NULL,
        postingDate TEXT NOT NULL,
        totalAmount REAL DEFAULT 0,
        status TEXT DEFAULT 'POSTED',
        isReconciled INTEGER DEFAULT 0,
        reconciledAt TEXT,
        voidReason TEXT,
        notes TEXT,
        isDeleted INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS fin_payment_line_items (
        id TEXT PRIMARY KEY,
        paymentId TEXT NOT NULL,
        sourceType TEXT NOT NULL,
        sourceId TEXT NOT NULL,
        sourceNumber TEXT,
        itemType TEXT DEFAULT 'STANDARD',
        appliedAmount REAL DEFAULT 0,
        feeAmount REAL DEFAULT 0,
        isFeeAbsorbedByCompany INTEGER DEFAULT 1,
        discountAmount REAL DEFAULT 0,
        offsetExpenseId TEXT,
        withholdingTaxAmt REAL DEFAULT 0,
        nhiAmt REAL DEFAULT 0,
        projectId TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS fin_invoices (
        id TEXT PRIMARY KEY,
        invoiceType TEXT DEFAULT 'INPUT',
        invoiceNumber TEXT NOT NULL,
        invoiceDate TEXT NOT NULL,
        taxReportingCompanyId TEXT NOT NULL,
        issuerTaxId TEXT NOT NULL,
        issuerName TEXT,
        buyerTaxId TEXT NOT NULL,
        buyerName TEXT,
        netAmount REAL DEFAULT 0,
        taxAmount REAL DEFAULT 0,
        totalAmount REAL DEFAULT 0,
        status TEXT DEFAULT 'VALID',
        createdAt TEXT,
        updatedAt TEXT,
        UNIQUE(taxReportingCompanyId, issuerTaxId, invoiceNumber)
      );

      CREATE TABLE IF NOT EXISTS fin_billing_invoice_mappings (
        id TEXT PRIMARY KEY,
        invoiceId TEXT NOT NULL,
        sourceDocumentType TEXT NOT NULL,
        sourceDocumentId TEXT NOT NULL,
        mappedAmount REAL DEFAULT 0,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS fin_suspense_receipts (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        bankAccountId TEXT NOT NULL,
        bankAccountName TEXT,
        amount REAL DEFAULT 0,
        receivedDate TEXT NOT NULL,
        payerInfo TEXT NOT NULL,
        isAllocated INTEGER DEFAULT 0,
        allocatedToArId TEXT,
        notes TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS fin_overpayment_pools (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        partnerId TEXT NOT NULL,
        partnerName TEXT,
        amount REAL DEFAULT 0,
        resolvedBy TEXT,
        isResolved INTEGER DEFAULT 0,
        notes TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS company_bank_accounts (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        bankCode TEXT NOT NULL,
        bankName TEXT NOT NULL,
        branchName TEXT,
        accountNumber TEXT NOT NULL,
        accountName TEXT NOT NULL,
        isVirtualAccount INTEGER DEFAULT 0,
        initialBalance REAL DEFAULT 0,
        currentBalance REAL DEFAULT 0,
        currency TEXT DEFAULT 'TWD',
        status TEXT DEFAULT 'ACTIVE'
      );
    `);
  } catch (e) {}

  // 補齊 companies / bank_checks / company_bank_accounts / ap_reconciliations 欄位
  try { db.run(`ALTER TABLE companies ADD COLUMN paymentScheduleDays TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE bank_checks ADD COLUMN drawerBank TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE bank_checks ADD COLUMN paymentId TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE bank_checks ADD COLUMN expectedClearanceDate TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE bank_checks ADD COLUMN actualClearanceDate TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE bank_checks ADD COLUMN replacesCheckNumber TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE bank_checks ADD COLUMN reconciledApId TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE bank_checks ADD COLUMN reconciledArId TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE company_bank_accounts ADD COLUMN supportsCheck INTEGER DEFAULT 1;`); } catch (e) {}
  try { db.run(`ALTER TABLE company_bank_accounts ADD COLUMN supportsTransfer INTEGER DEFAULT 1;`); } catch (e) {}
  try { db.run(`ALTER TABLE company_bank_accounts ADD COLUMN paymentScheduleDays TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE ap_reconciliations ADD COLUMN isBossAdvance INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE ap_reconciliations ADD COLUMN bouncedCheckNumber TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE ap_reconciliations ADD COLUMN bouncedReason TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE ap_reconciliations ADD COLUMN bouncedAt TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE ap_reconciliations ADD COLUMN designatedCheckNumber TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE ap_reconciliations ADD COLUMN returnedReason TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE ap_reconciliations ADD COLUMN returnedBy TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE ap_reconciliations ADD COLUMN returnedAt TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE fin_payment_records ADD COLUMN isBossAdvance INTEGER DEFAULT 0;`); } catch (e) {}
  ensureArTablesAndColumns(db);

  // 補齊 company_bank_accounts 種子資料
  try {
    const bCount = db.exec(`SELECT count(*) FROM company_bank_accounts;`);
    if (!bCount.length || Number(bCount[0].values[0][0]) === 0) {
      db.run(`
        INSERT INTO company_bank_accounts (id, companyId, bankCode, bankName, branchName, accountNumber, accountName, isVirtualAccount, initialBalance, currentBalance, currency, status)
        VALUES
          ('BANK-01', 'COMP-01', '822', '中國信託商業銀行', '松高分行 (營運主要出納戶)', '123456789012', '台灣大巨營造工程股份有限公司', 0, 38500000, 38500000, 'TWD', 'ACTIVE'),
          ('BANK-02', 'COMP-01', '004', '台灣銀行', '群賢分行 (公共工程押標專戶)', '004987654321', '台灣大巨營造工程股份有限公司', 0, 22000000, 22000000, 'TWD', 'ACTIVE'),
          ('BANK-03', 'COMP-02', '808', '玉山商業銀行', '復興分行 (宏達機電甲存專戶)', '808003445566', '宏達機電工程股份有限公司', 0, 8500000, 8500000, 'TWD', 'ACTIVE'),
          ('BANK-BOSS', 'BOSS-01', '999', '林董私人代墊專戶', '虛擬帳戶 (老闆口袋)', 'BOSS-POCKET-01', '林大巨 創辦人', 1, 500000, 500000, 'TWD', 'ACTIVE');
      `);
    }
  } catch (e) {}

  // 補齊 fin_invoices 種子發票
  try {
    const invCount = db.exec(`SELECT count(*) FROM fin_invoices;`);
    if (!invCount.length || Number(invCount[0].values[0][0]) === 0) {
      db.run(`
        INSERT INTO fin_invoices (id, invoiceType, invoiceNumber, invoiceDate, taxReportingCompanyId, issuerTaxId, issuerName, buyerTaxId, buyerName, netAmount, taxAmount, totalAmount, status, createdAt, updatedAt)
        VALUES
          ('INV-01', 'INPUT', 'TC-88992211', '2026-03-12', 'COMP-01', '03754904', '台灣水泥股份有限公司', '88991234', '台灣大巨營造工程股份有限公司', 288000, 14400, 302400, 'VALID', '2026-03-12', '2026-03-12'),
          ('INV-02', 'INPUT', 'CSC-86512390', '2026-03-22', 'COMP-01', '86512390', '中鋼結構工程股份有限公司', '88991234', '台灣大巨營造工程股份有限公司', 1200000, 60000, 1260000, 'VALID', '2026-03-22', '2026-03-22');
      `);
    }
  } catch (e) {}

  // 補齊 fin_suspense_receipts 種子未明暫收款
  try {
    const suspCount = db.exec(`SELECT count(*) FROM fin_suspense_receipts;`);
    if (!suspCount.length || Number(suspCount[0].values[0][0]) === 0) {
      db.run(`
        INSERT INTO fin_suspense_receipts (id, companyId, bankAccountId, bankAccountName, amount, receivedDate, payerInfo, isAllocated, notes, createdAt)
        VALUES
          ('SUSP-01', 'COMP-01', 'BANK-01', '中國信託松高分行', 350000, '2026-04-15', '國泰世華銀行 轉入 附言: 台北工程款 (未明業主)', 0, '待工務主任確認歸屬案場後認領轉拋 AR', '2026-04-15');
      `);
    }
  } catch (e) {}

  // 補齊「專職會計組」與「專職出納組」預設權限範本
  try {
    const pureAccExists = db.exec(`SELECT id FROM user_groups WHERE id = 'GRP-PURE-ACC';`);
    if (!pureAccExists.length || !pureAccExists[0].values.length) {
      db.run(`
        INSERT INTO user_groups (id, groupCode, groupName, description, isSystem, approvalLimit, canExport, createdAt, updatedAt)
        VALUES ('GRP-PURE-ACC', 'FIN_ACC_ONLY', '專職會計組（僅管帳：對帳／發票）', '只管帳不管錢：進貨對帳單、發票稅額核對、應收付立帳；核准後自動拋轉出納放款，無出金與開票權限', 1, 10000000, 1, '2026-01-01', '2026-01-01');
      `);
      const pureAccPerms: Record<ModuleKey, { r: number; w: number; a: number; e: number }> = {
        COMPANIES: { r: 1, w: 0, a: 0, e: 0 },
        PROJECTS: { r: 1, w: 0, a: 0, e: 0 },
        PARTNERS: { r: 1, w: 1, a: 0, e: 0 },
        QUOTATIONS: { r: 1, w: 0, a: 0, e: 0 },
        INBOUND_RECEIPTS: { r: 1, w: 0, a: 0, e: 1 },
        PURCHASE_ORDERS: { r: 1, w: 0, a: 0, e: 0 },
        SUBCONTRACTS: { r: 1, w: 0, a: 0, e: 0 },
        VALUATIONS: { r: 1, w: 0, a: 0, e: 0 },
        FINANCE_AP: { r: 1, w: 1, a: 1, e: 1 },
        FINANCE_AR: { r: 1, w: 1, a: 1, e: 1 },
        BANK_CHECKS: { r: 0, w: 0, a: 0, e: 0 },
        SYSTEM_CONFIGS: { r: 1, w: 0, a: 0, e: 0 },
        AUDIT_LOGS: { r: 0, w: 0, a: 0, e: 0 },
      };
      for (const mod of SYSTEM_MODULES) {
        const perm = pureAccPerms[mod.key] || { r: 0, w: 0, a: 0, e: 0 };
        db.run(`
          INSERT OR IGNORE INTO group_module_permissions (id, groupId, moduleKey, canRead, canWrite, canApprove, canExport)
          VALUES ('PERM-GRP-PURE-ACC-${mod.key}', 'GRP-PURE-ACC', '${mod.key}', ${perm.r}, ${perm.w}, ${perm.a}, ${perm.e});
        `);
      }
    }

    const cashierExists = db.exec(`SELECT id FROM user_groups WHERE id = 'GRP-CASHIER';`);
    if (!cashierExists.length || !cashierExists[0].values.length) {
      db.run(`
        INSERT INTO user_groups (id, groupCode, groupName, description, isSystem, approvalLimit, canExport, createdAt, updatedAt)
        VALUES ('GRP-CASHIER', 'FIN_CASHIER', '專職出納組（僅管錢：放款／支票）', '只管錢不管帳：依會計核准之對帳單選取付款方式與專戶執行放款、開立支票、管理銀行收付與兌現跳票', 1, 10000000, 1, '2026-01-01', '2026-01-01');
      `);
      const cashierPerms: Record<ModuleKey, { r: number; w: number; a: number; e: number }> = {
        COMPANIES: { r: 1, w: 0, a: 0, e: 0 },
        PROJECTS: { r: 1, w: 0, a: 0, e: 0 },
        PARTNERS: { r: 1, w: 0, a: 0, e: 0 },
        QUOTATIONS: { r: 0, w: 0, a: 0, e: 0 },
        INBOUND_RECEIPTS: { r: 0, w: 0, a: 0, e: 0 },
        PURCHASE_ORDERS: { r: 0, w: 0, a: 0, e: 0 },
        SUBCONTRACTS: { r: 0, w: 0, a: 0, e: 0 },
        VALUATIONS: { r: 0, w: 0, a: 0, e: 0 },
        FINANCE_AP: { r: 0, w: 0, a: 0, e: 0 },
        FINANCE_AR: { r: 0, w: 0, a: 0, e: 0 },
        BANK_CHECKS: { r: 1, w: 1, a: 1, e: 1 },
        SYSTEM_CONFIGS: { r: 0, w: 0, a: 0, e: 0 },
        AUDIT_LOGS: { r: 0, w: 0, a: 0, e: 0 },
      };
      for (const mod of SYSTEM_MODULES) {
        const perm = cashierPerms[mod.key] || { r: 0, w: 0, a: 0, e: 0 };
        db.run(`
          INSERT OR IGNORE INTO group_module_permissions (id, groupId, moduleKey, canRead, canWrite, canApprove, canExport)
          VALUES ('PERM-GRP-CASHIER-${mod.key}', 'GRP-CASHIER', '${mod.key}', ${perm.r}, ${perm.w}, ${perm.a}, ${perm.e});
        `);
      }
    }
  } catch (e) {
    console.error('ensure split finance groups error', e);
  }

  // 補齊三組財務視角測試帳號：A會計 (純會計)、B出納 (純出納)、C會計出納 (會計兼出納)
  try {
    const compRows = db.exec(`SELECT id FROM companies WHERE isDeleted = 0;`);
    const activeCompIds = compRows.length && compRows[0].values.length
      ? compRows[0].values.map(v => String(v[0]))
      : ['COMP-01', 'COMP-02'];
    const allowedCompsJson = JSON.stringify(activeCompIds);
    const defaultCompId = activeCompIds[0] || 'COMP-01';

    const testFinanceUsers = [
      {
        id: 'USR-ACC-A',
        username: 'acc_a',
        fullName: 'A會計',
        email: 'acc.a@mega-build.com.tw',
        groupId: 'GRP-PURE-ACC',
        groupIds: '["GRP-PURE-ACC"]',
        title: '專職會計（僅管帳：對帳／發票／退回重算）',
      },
      {
        id: 'USR-CASHIER-B',
        username: 'cashier_b',
        fullName: 'B出納',
        email: 'cashier.b@mega-build.com.tw',
        groupId: 'GRP-CASHIER',
        groupIds: '["GRP-CASHIER"]',
        title: '專職出納（僅管錢：放款／支票／退回重算）',
      },
      {
        id: 'USR-FIN-C',
        username: 'fin_c',
        fullName: 'C會計出納',
        email: 'fin.c@mega-build.com.tw',
        groupId: 'GRP-ACC',
        groupIds: '["GRP-ACC"]',
        title: '會計兼出納（一人兼任全流程：對帳＋立即放款）',
      },
    ];

    for (const u of testFinanceUsers) {
      const exists = db.exec(`SELECT id FROM users WHERE id = '${u.id}' OR username = '${u.username}';`);
      if (!exists.length || !exists[0].values.length) {
        db.run(`
          INSERT INTO users (
            id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, canManageAllCompanies,
            groupId, groupIds, companyGroupAssignments, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, createdAt, updatedAt
          ) VALUES (
            '${u.id}', '${u.username}', '${u.fullName}', '${u.email}', 'USER', 0, 0, 0, 0,
            '${u.groupId}', '${u.groupIds}', '[]', 'ACTIVE', '${u.title}', '${allowedCompsJson}', '${defaultCompId}', '888888', 0, '2026-01-01', '2026-01-01'
          );
        `);
      }
    }
  } catch (e) {
    console.error('ensure test finance users error', e);
  }
}
