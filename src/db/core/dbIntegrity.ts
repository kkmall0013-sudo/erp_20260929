import type { Database } from 'sql.js';
import { DEFAULT_BUILDING_CATEGORY_TREE } from './dbConstants';
import { ensureCompanyExtendedColumns } from './schemaCore';
import { initializeTables } from './schemaOperations';
import { ensureUsersAndFinanceIntegrity } from './dbIntegrityUsersAndFinance';
import { ensurePostalCatalogSeeded, syncPostalCatalogToUtility } from '../repositories/postalCatalogRepository';
import { reseedDocumentSequences } from '../repositories/sequenceRepository';

// 平滑資料庫完整性修復器 (保證現有快照升級時表結構與種子資料齊全)
export function ensureDatabaseIntegrity(db: Database): void {
  // 🛡️ 現場進貨簽收單主表與明細表 (InboundReceipts)
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS inbound_receipts (
        id TEXT PRIMARY KEY,
        receiptNumber TEXT UNIQUE NOT NULL,
        companyId TEXT NOT NULL,
        projectId TEXT NOT NULL,
        projectNameSnapshot TEXT,
        projectCodeSnapshot TEXT,
        vendorId TEXT NOT NULL,
        vendorNameSnapshot TEXT,
        vendorTaxIdSnapshot TEXT,
        deliveryNoteNumber TEXT NOT NULL,
        orderNumber TEXT,
        receivedDate TEXT NOT NULL,
        receivedBy TEXT NOT NULL,
        totalAmount REAL DEFAULT 0,
        billingStatus TEXT DEFAULT 'PENDING_BILLING',
        reconciliationId TEXT,
        reconciliationNumber TEXT,
        purchaseOrderId TEXT,
        status TEXT DEFAULT 'DRAFT',
        attachmentFileId TEXT,
        attachmentFileName TEXT,
        notes TEXT,
        isDeleted INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        createdAt TEXT,
        updatedAt TEXT
      );
      CREATE TABLE IF NOT EXISTS inbound_receipt_items (
        id TEXT PRIMARY KEY,
        receiptId TEXT NOT NULL,
        itemCode TEXT,
        itemName TEXT NOT NULL,
        spec TEXT,
        unit TEXT NOT NULL,
        quantity REAL DEFAULT 1,
        unitPrice REAL DEFAULT 0,
        lineTotal REAL DEFAULT 0,
        notes TEXT
      );
    `);
  } catch (_) {}

  // 🛡️ 保證現有快照平滑升級 inbound_receipts 擁有 projectCodeSnapshot 與 orderNumber 欄位
  try { db.run(`ALTER TABLE inbound_receipts ADD COLUMN projectCodeSnapshot TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE inbound_receipts ADD COLUMN orderNumber TEXT;`); } catch (e) {}

  initializeTables(db);

  // 升級檢測：確保 users、user_groups、group_module_permissions、system_configs 擁有最新欄位與三柱版本控制
  try { db.run(`ALTER TABLE users ADD COLUMN groupIds TEXT DEFAULT '[]';`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN companyGroupAssignments TEXT DEFAULT '[]';`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN canManageUsers INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN canManageSystemConfigs INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN canManageAdmins INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN canManageAllCompanies INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN passwordHash TEXT DEFAULT '888888';`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN isPasswordReset INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN version INTEGER DEFAULT 1;`); } catch (e) {}
  try { db.run(`ALTER TABLE user_groups ADD COLUMN version INTEGER DEFAULT 1;`); } catch (e) {}
  try { db.run(`ALTER TABLE group_module_permissions ADD COLUMN version INTEGER DEFAULT 1;`); } catch (e) {}
  try { db.run(`ALTER TABLE group_module_permissions ADD COLUMN updatedAt TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE system_configs ADD COLUMN description TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE system_configs ADD COLUMN updatedBy TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE system_configs ADD COLUMN createdAt TEXT DEFAULT '2026-01-01';`); } catch (e) {}
  try { db.run(`ALTER TABLE system_configs ADD COLUMN updatedAt TEXT DEFAULT '2026-01-01';`); } catch (e) {}

  // 升級檢測：確保 app_configs 表存在並填入初始值
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS app_configs (
        id TEXT PRIMARY KEY,
        configKey TEXT UNIQUE NOT NULL,
        configValue TEXT NOT NULL,
        description TEXT,
        valueType TEXT DEFAULT 'STRING',
        isDeleted INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        updatedBy TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );
    `);
    const countRes = db.exec(`SELECT COUNT(*) FROM app_configs WHERE isDeleted = 0;`);
    const count = Number(countRes[0]?.values[0]?.[0] || 0);
    if (count === 0) {
      db.run(`
        INSERT INTO app_configs (id, configKey, configValue, description, valueType, isDeleted, version, updatedBy, createdAt, updatedAt)
        VALUES
          ('APP-CFG-01', 'APP_BRAND_NAME', '田頭', '軟體品牌主名稱 (頂部主識別)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-02', 'APP_SUB_TITLE', '營造工程管理雲', '軟體副標題與產品代號', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-03', 'APP_VERSION', 'v2.5.0-PRO', '系統版本號標記', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-04', 'APP_HTML_TITLE', '田頭 | 營造工程雲端 ERP 整合系統', '瀏覽器頁籤分頁標題', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-05', 'APP_WELCOME_BANNER', '歡迎登入營造工程 ERP 整合系統，請透過左側選單操作業務功能。', '儀表板首頁歡迎標語', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-06', 'APP_FOOTER_COPYRIGHT', '© 2026 營造工程雲端 ERP 整合系統 · 保留所有權利', '全系統頁腳版權聲明', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-07', 'APP_GLOBAL_ANNOUNCEMENT', '【系統公告】系統固定於每週日 02:00 ~ 04:00 進行資料庫異地冷備份，期間請勿執行巨量批次寫入。', '全域頂欄緊急廣播/公告內容', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-08', 'APP_ANNOUNCEMENT_ENABLED', 'false', '全域頂欄廣播跑馬燈啟用開關', 'BOOLEAN', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-09', 'APP_ENABLED_MODULES', '["PROJECTS","PARTNERS","QUOTATIONS","PURCHASE_ORDERS","SUBCONTRACTS","VALUATIONS","FINANCE_AP","FINANCE_AR","BANK_CHECKS","VAULT","MINI_APPS"]', '全系統開放業務模組授權清單 (Feature Flags)', 'JSON', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-10', 'APP_MAINTENANCE_MODE', 'false', '全系統維護唯讀模式開關', 'BOOLEAN', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-11', 'APP_LOGO_MODE', 'DEFAULT', '標誌顯示模式 (DEFAULT 內建圖示 / IMAGE 自訂圖片網址 / TEXT 自訂字首徽章)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-12', 'APP_PRIMARY_COLOR', '#2d3a4b', '頂欄主視覺識別色碼', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-13', 'APP_LOGO_IMAGE_URL', '', '自訂 Logo 圖片網址 (可貼圖檔 URL 或 Base64 Data URI)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-14', 'APP_LOGO_TEXT', '田', '自訂 Logo 字首徽章文字 (1~2 個中英文字元)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-15', 'APP_LOGO_BG', '#4f46e5', '自訂 Logo 徽章底色色碼', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-16', 'APP_SYSTEM_NAME', '田頭營造工程雲端 ERP 整合系統', '軟體系統完整中文全稱 (全域自訂品牌)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
          ('APP-CFG-17', 'APP_CUSTOMER_BILLING_MODE', 'FINANCE_ONLY', '對外客戶請款／對帳明細表權限流程模式 (FINANCE_ONLY 會計統一 / PROJECT_AND_FINANCE 雙軌授權 / PROJECT_FIRST_HANDOFF 工務送交會計)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01');
      `);
    } else {
      db.run(`UPDATE app_configs SET configValue = '營造工程管理雲' WHERE configKey = 'APP_SUB_TITLE' AND (configValue LIKE '%A1%' OR configValue LIKE '%鼎新%');`);
      db.run(`UPDATE app_configs SET configValue = '田頭 | 營造工程雲端 ERP 整合系統' WHERE configKey = 'APP_HTML_TITLE' AND (configValue LIKE '%A1%' OR configValue LIKE '%鼎新%');`);

      const logoModeExists = db.exec(`SELECT id FROM app_configs WHERE configKey = 'APP_LOGO_IMAGE_URL';`);
      if (!logoModeExists.length || !logoModeExists[0].values.length) {
        db.run(`INSERT INTO app_configs (id, configKey, configValue, description, valueType, isDeleted, version, updatedBy, createdAt, updatedAt)
          VALUES ('APP-CFG-13', 'APP_LOGO_IMAGE_URL', '', '自訂 Logo 圖片網址 (可貼圖檔 URL 或 Base64 Data URI)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01');`);
      }
      const logoTextExists = db.exec(`SELECT id FROM app_configs WHERE configKey = 'APP_LOGO_TEXT';`);
      if (!logoTextExists.length || !logoTextExists[0].values.length) {
        db.run(`INSERT INTO app_configs (id, configKey, configValue, description, valueType, isDeleted, version, updatedBy, createdAt, updatedAt)
          VALUES ('APP-CFG-14', 'APP_LOGO_TEXT', '田', '自訂 Logo 字首徽章文字 (1~2 個中英文字元)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01');`);
      }
      const logoBgExists = db.exec(`SELECT id FROM app_configs WHERE configKey = 'APP_LOGO_BG';`);
      if (!logoBgExists.length || !logoBgExists[0].values.length) {
        db.run(`INSERT INTO app_configs (id, configKey, configValue, description, valueType, isDeleted, version, updatedBy, createdAt, updatedAt)
          VALUES ('APP-CFG-15', 'APP_LOGO_BG', '#4f46e5', '自訂 Logo 徽章底色色碼', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01');`);
      }
      const sysNameExists = db.exec(`SELECT id FROM app_configs WHERE configKey = 'APP_SYSTEM_NAME';`);
      if (!sysNameExists.length || !sysNameExists[0].values.length) {
        db.run(`INSERT INTO app_configs (id, configKey, configValue, description, valueType, isDeleted, version, updatedBy, createdAt, updatedAt)
          VALUES ('APP-CFG-16', 'APP_SYSTEM_NAME', '田頭營造工程雲端 ERP 整合系統', '軟體系統完整中文全稱 (全域自訂品牌)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01');`);
      }
      const billingModeExists = db.exec(`SELECT id FROM app_configs WHERE configKey = 'APP_CUSTOMER_BILLING_MODE';`);
      if (!billingModeExists.length || !billingModeExists[0].values.length) {
        db.run(`INSERT INTO app_configs (id, configKey, configValue, description, valueType, isDeleted, version, updatedBy, createdAt, updatedAt)
          VALUES ('APP-CFG-17', 'APP_CUSTOMER_BILLING_MODE', 'FINANCE_ONLY', '對外客戶請款／對帳明細表權限流程模式 (FINANCE_ONLY 會計統一 / PROJECT_AND_FINANCE 雙軌授權 / PROJECT_FIRST_HANDOFF 工務送交會計)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01');`);
      }
      const sandboxPublicExists = db.exec(`SELECT id FROM app_configs WHERE configKey = 'APP_TEST_SANDBOX_PUBLIC';`);
      if (!sandboxPublicExists.length || !sandboxPublicExists[0].values.length) {
        db.run(`INSERT INTO app_configs (id, configKey, configValue, description, valueType, isDeleted, version, updatedBy, createdAt, updatedAt)
          VALUES ('APP-CFG-18', 'APP_TEST_SANDBOX_PUBLIC', 'false', '對全體帳號開放左側「測試區」開關（僅 Superadmin 可切換；關閉時僅 Superadmin 可見）', 'BOOLEAN', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01');`);
      }
    }
  } catch (e) {}

  // 自動補齊既有 system_configs 之中文用途說明與新法規參數
  try {
    db.run(`UPDATE system_configs SET description = '法定營業稅率 (預設 5%)' WHERE configKey = 'TAX_RATE' AND (description IS NULL OR description = '');`);
    db.run(`UPDATE system_configs SET description = '發票稅額尾差容許值 (新台幣元)' WHERE configKey = 'FIN_TAX_TOLERANCE' AND (description IS NULL OR description = '');`);
    db.run(`UPDATE system_configs SET description = '工程估驗預設保留款扣留比例 (%)' WHERE configKey = 'DEFAULT_RETENTION_RATE' AND (description IS NULL OR description = '');`);
    db.run(`UPDATE system_configs SET description = '案場超支預算防呆鎖定模式 (STRICT 嚴格阻擋 / WARN 警示放行)' WHERE configKey = 'PROJECT_LOCK_MODE' AND (description IS NULL OR description = '');`);
    db.run(`UPDATE system_configs SET description = '二代健保補充保費法定扣繳費率' WHERE configKey = 'NHI_RATE' AND (description IS NULL OR description = '');`);

    const termExists = db.exec(`SELECT id FROM system_configs WHERE configKey = 'PAYMENT_TERM_DAYS';`);
    if (!termExists.length || !termExists[0].values.length) {
      db.run(`INSERT INTO system_configs (id, configKey, configValue, description, valueType, validFrom, isDeleted, version, updatedBy, createdAt, updatedAt)
        VALUES ('CFG-06', 'PAYMENT_TERM_DAYS', '30', '預設請款票期 / 付款天數 (天)', 'NUMBER', '2026-01-01', 0, 1, '系統初始', '2026-01-01', '2026-01-01');`);
    }
    const minWageExists = db.exec(`SELECT id FROM system_configs WHERE configKey = 'MINIMUM_WAGE';`);
    if (!minWageExists.length || !minWageExists[0].values.length) {
      db.run(`INSERT INTO system_configs (id, configKey, configValue, description, valueType, validFrom, isDeleted, version, updatedBy, createdAt, updatedAt)
        VALUES ('CFG-08', 'MINIMUM_WAGE', '28590', '法定最低月薪基本工資 (新台幣元)', 'NUMBER', '2026-01-01', 0, 1, '系統初始', '2026-01-01', '2026-01-01');`);
    }
    const schedDaysExists = db.exec(`SELECT id FROM system_configs WHERE configKey = 'PAYMENT_SCHEDULE_DAYS';`);
    if (!schedDaysExists.length || !schedDaysExists[0].values.length) {
      db.run(`INSERT INTO system_configs (id, configKey, configValue, description, valueType, validFrom, isDeleted, version, updatedBy, createdAt, updatedAt)
        VALUES ('CFG-09', 'PAYMENT_SCHEDULE_DAYS', '7,17,27', '預設每月固定付款日規則 (多日以逗號分隔，如 7,17,27)', 'STRING', '2026-01-01', 0, 1, '系統初始', '2026-01-01', '2026-01-01');`);
    }
    const bossPolicyExists = db.exec(`SELECT id FROM system_configs WHERE configKey = 'BOSS_ACCOUNT_INVOICE_POLICY';`);
    if (!bossPolicyExists.length || !bossPolicyExists[0].values.length) {
      db.run(`INSERT INTO system_configs (id, configKey, configValue, description, valueType, validFrom, isDeleted, version, updatedBy, createdAt, updatedAt)
        VALUES ('CFG-10', 'BOSS_ACCOUNT_INVOICE_POLICY', 'STRICT_INVOICE_MATCH', '有發票單據是否允許老闆私帳代墊政策 (STRICT_INVOICE_MATCH 做法1嚴格防呆 / ALLOW_BOSS_ADVANCE 做法2可勾選特例代墊)', 'STRING', '2026-01-01', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01');`);
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS regulatory_schedules (
        id TEXT PRIMARY KEY,
        configKey TEXT NOT NULL,
        configLabel TEXT NOT NULL,
        scheduledValue TEXT NOT NULL,
        effectiveDate TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'SCHEDULED',
        createdBy TEXT,
        createdAt TEXT,
        appliedAt TEXT,
        notes TEXT
      );
    `);

    const schedCount = db.exec(`SELECT count(*) FROM regulatory_schedules;`);
    if (!schedCount.length || !schedCount[0].values.length || Number(schedCount[0].values[0][0]) === 0) {
      db.run(`
        INSERT INTO regulatory_schedules (id, configKey, configLabel, scheduledValue, effectiveDate, status, createdBy, createdAt, notes)
        VALUES ('SCHED-01', 'MINIMUM_WAGE', '法定最低月薪基本工資', '29500', '2027-01-01 00:00:00', 'SCHEDULED', '系統預排', '2026-01-01 00:00:00', '2027/01/01 法定最低基本工資調整預排 (由 28,590 調升至 29,500 元)');
      `);
    }
  } catch (e) {}

  // 確保唯一最高 SUPERADMIN 具有帳號專人、全域參數與同階管理最高權限
  try {
    db.run(`UPDATE users SET canManageUsers = 1, canManageSystemConfigs = 1, canManageAdmins = 1 WHERE role = 'SUPERADMIN';`);
  } catch (e) {}

  // 升級檢測：確保 companies 表具備集團、個人實體、電話列表、代表與地址欄位
  const companyAlterColumns = [
    { name: 'shortName', type: 'TEXT' },
    { name: 'entityType', type: "TEXT DEFAULT 'CORPORATION'" },
    { name: 'parentId', type: 'TEXT' },
    { name: 'taxId', type: 'TEXT' },
    { name: 'nationalId', type: 'TEXT' },
    { name: 'representative', type: 'TEXT' },
    { name: 'keyPersonnel', type: "TEXT DEFAULT '[]'" },
    { name: 'documentPrefix', type: 'TEXT' },
    { name: 'phones', type: "TEXT DEFAULT '[]'" },
    { name: 'email', type: 'TEXT' },
    { name: 'registeredAddress', type: 'TEXT' },
    { name: 'registeredPostalCode', type: 'TEXT' },
    { name: 'registeredCity', type: 'TEXT' },
    { name: 'registeredDistrict', type: 'TEXT' },
    { name: 'registeredStreetAddress', type: 'TEXT' },
    { name: 'contactAddress', type: 'TEXT' },
    { name: 'contactPostalCode', type: 'TEXT' },
    { name: 'contactCity', type: 'TEXT' },
    { name: 'contactDistrict', type: 'TEXT' },
    { name: 'contactStreetAddress', type: 'TEXT' },
    { name: 'capitalAmount', type: 'REAL DEFAULT 0' }
  ];
  for (const c of companyAlterColumns) {
    try {
      db.run(`ALTER TABLE companies ADD COLUMN ${c.name} ${c.type};`);
    } catch (e) {
      // 欄位已存在
    }
  }

  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_companies_parent_type ON companies (parentId, entityType, isDeleted);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_companies_code ON companies (companyCode);`);
  } catch (e) {
    // 索引已存在
  }

  // 升級檢測：確保 business_partners 擁有 Phase 3 完整商業夥伴欄位
  const bpAlterColumns = [
    { name: 'entityType', type: "TEXT DEFAULT 'CORPORATION'" },
    { name: 'isCustomer', type: 'INTEGER DEFAULT 0' },
    { name: 'isVendor', type: 'INTEGER DEFAULT 1' },
    { name: 'convertedFromVendorId', type: 'TEXT' },
    { name: 'serviceCategoryMain', type: 'TEXT' },
    { name: 'serviceCategorySub', type: 'TEXT' },
    { name: 'serviceCategories', type: 'TEXT' },
    { name: 'ownerIdNumber', type: 'TEXT' },
    { name: 'representative', type: 'TEXT' },
    { name: 'bankAccountName', type: 'TEXT' },
    { name: 'bankFeePayer', type: "TEXT DEFAULT 'COMPANY'" },
    { name: 'hasInvoice', type: 'INTEGER DEFAULT 1' },
    { name: 'paymentMethodNotes', type: 'TEXT' },
    { name: 'currentScore', type: 'REAL DEFAULT 85' },
    { name: 'status', type: "TEXT DEFAULT 'ACTIVE'" },
    { name: 'createdAt', type: "TEXT DEFAULT '2026-01-01'" },
    { name: 'updatedAt', type: "TEXT DEFAULT '2026-01-01'" },
  ];
  for (const c of bpAlterColumns) {
    try {
      db.run(`ALTER TABLE business_partners ADD COLUMN ${c.name} ${c.type};`);
    } catch (e) {}
  }

  try {
    db.run(`UPDATE business_partners SET isCustomer = 1, isVendor = 0 WHERE type = 'CUSTOMER';`);
    db.run(`UPDATE business_partners SET isCustomer = 0, isVendor = 1 WHERE type IN ('VENDOR', 'SUBCONTRACTOR');`);
    db.run(`UPDATE business_partners SET isCustomer = 1, isVendor = 1 WHERE type = 'BOTH';`);
    db.run(`UPDATE business_partners SET bankFeePayer = 'COMPANY' WHERE bankFeePayer IS NULL OR bankFeePayer = '';`);
  } catch (e) {}

  // 確保子關聯資料表健全
  db.run(`
    CREATE TABLE IF NOT EXISTS bp_bank_accounts (
      id TEXT PRIMARY KEY,
      bpId TEXT NOT NULL,
      bankCode TEXT NOT NULL,
      bankName TEXT NOT NULL,
      branchCode TEXT,
      branchName TEXT,
      accountNumber TEXT NOT NULL,
      accountName TEXT NOT NULL,
      isPrimary INTEGER DEFAULT 1,
      passbookFileId TEXT,
      passbookFileData TEXT,
      passbookFiles TEXT,
      isDeleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS partner_addresses (
      id TEXT PRIMARY KEY,
      partnerId TEXT NOT NULL,
      addressType TEXT DEFAULT 'COMMUNICATION',
      label TEXT,
      postalCode TEXT,
      city TEXT,
      district TEXT,
      fullAddress TEXT NOT NULL,
      isDeleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS partner_contacts (
      id TEXT PRIMARY KEY,
      partnerId TEXT NOT NULL,
      contactType TEXT DEFAULT 'PRIMARY',
      name TEXT NOT NULL,
      title TEXT,
      phone TEXT,
      mobile TEXT,
      extension TEXT,
      email TEXT,
      notes TEXT,
      isDeleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS partner_business_cards (
      id TEXT PRIMARY KEY,
      partnerId TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT,
      companyName TEXT,
      phone TEXT,
      mobile TEXT,
      email TEXT,
      address TEXT,
      exchangeDate TEXT,
      cardFrontUrl TEXT,
      cardBackUrl TEXT,
      cardFileType TEXT DEFAULT 'IMAGE',
      notes TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS partner_cheque_records (
      id TEXT PRIMARY KEY,
      partnerId TEXT NOT NULL,
      direction TEXT NOT NULL,
      bankCode TEXT NOT NULL,
      bankName TEXT NOT NULL,
      branchName TEXT,
      accountNumber TEXT NOT NULL,
      checkNumber TEXT NOT NULL,
      receivedDate TEXT,
      issueDate TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      statutoryExpiryDate TEXT,
      amount REAL NOT NULL,
      payeeName TEXT NOT NULL,
      isNonNegotiable INTEGER DEFAULT 1,
      chequeFileId TEXT,
      chequeFileData TEXT,
      chequeFiles TEXT,
      status TEXT DEFAULT 'RECEIVED',
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );
  `);

  try { db.run(`ALTER TABLE business_partners ADD COLUMN serviceCategories TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE bp_bank_accounts ADD COLUMN passbookFiles TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE partner_addresses ADD COLUMN postalCode TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE partner_addresses ADD COLUMN city TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE partner_addresses ADD COLUMN district TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE partner_addresses ADD COLUMN streetAddress TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE partner_addresses ADD COLUMN isHistorical INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE partner_addresses ADD COLUMN archivedAt TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE partner_addresses ADD COLUMN archiveNote TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE partner_cheque_records ADD COLUMN branchName TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE partner_cheque_records ADD COLUMN receivedDate TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE partner_cheque_records ADD COLUMN statutoryExpiryDate TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE partner_cheque_records ADD COLUMN chequeFiles TEXT;`); } catch (e) {}

  try { db.run(`ALTER TABLE business_partners ADD COLUMN isIndividual INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE business_partners ADD COLUMN categoryMain TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE business_partners ADD COLUMN categorySub TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE business_partners ADD COLUMN categoryTags TEXT DEFAULT '[]';`); } catch (e) {}

  try { db.run(`ALTER TABLE project_sites ADD COLUMN postalCode TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN city TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN district TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN streetAddress TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN addressHistory TEXT DEFAULT '[]';`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN developerName TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN architect TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN constructor TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN shopDrawingVendorId TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN shopDrawingVendorName TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN landNumber TEXT;`); } catch (e) {}

  try { db.run(`ALTER TABLE projects ADD COLUMN buildingType TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE projects ADD COLUMN workScope TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE projects ADD COLUMN contractAmount REAL DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE projects ADD COLUMN budgetAmount REAL DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE projects ADD COLUMN committedCost REAL DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE projects ADD COLUMN actualCost REAL DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE projects ADD COLUMN isLocked INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE projects ADD COLUMN companyId TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE projects ADD COLUMN isDeleted INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE projects ADD COLUMN version INTEGER DEFAULT 1;`); } catch (e) {}
  try {
    db.run(`UPDATE projects SET buildingType = '鐵皮倉庫', workScope = '統包新建工程' WHERE id = 'PRJ-01' AND (buildingType IS NULL OR buildingType = '' OR buildingType = '商辦金融大樓');`);
    db.run(`UPDATE projects SET buildingType = '鋼構建築', workScope = '室內裝修與機電消防工程' WHERE id = 'PRJ-02' AND (buildingType IS NULL OR buildingType = '' OR buildingType = '廠辦與工業廠房');`);
    db.run(`UPDATE projects SET buildingType = '農業設施', workScope = '連續壁與擋土排樁工程' WHERE id = 'PRJ-03' AND (buildingType IS NULL OR buildingType = '' OR buildingType = '集合住宅大樓');`);
  } catch (e) {}

  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS project_budget_partners (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        partnerId TEXT NOT NULL,
        partnerName TEXT NOT NULL,
        workScope TEXT NOT NULL,
        estimatedAmount REAL DEFAULT 0,
        notes TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_budget_partners_prj ON project_budget_partners (projectId);
    `);
  } catch (e) {}

  try {
    const cfgRes = db.exec(`SELECT configValue FROM system_configs WHERE configKey = 'BUILDING_CATEGORY_TREE';`);
    if (!cfgRes.length || !cfgRes[0].values.length) {
      const defaultTreeJson = JSON.stringify(DEFAULT_BUILDING_CATEGORY_TREE);
      db.run(`
        INSERT INTO system_configs (id, configKey, configValue, description, valueType, validFrom, isDeleted, version, updatedBy, createdAt, updatedAt)
        VALUES ('CFG-BLD-TREE', 'BUILDING_CATEGORY_TREE', '${defaultTreeJson.replace(/'/g, "''")}', '建造物與業務項目階層分類字典 (大項/小項)', 'JSON', '2026-01-01', 0, 1, '系統初始', '2026-01-01', '2026-01-01');
      `);
    }
  } catch (e) {}

  try {
    const bpCount = db.exec(`SELECT count(*) FROM project_budget_partners;`);
    if (!bpCount.length || Number(bpCount[0].values[0][0]) === 0) {
      db.run(`
        INSERT INTO project_budget_partners (id, projectId, partnerId, partnerName, workScope, estimatedAmount, notes, createdAt, updatedAt)
        VALUES
          ('PBP-01', 'PRJ-01', 'BP-01', '宏國實業有限公司', '鋼構加工與主構件供料', 3000000, '主結構柱樑鋼構與吊裝 (甲廠商)', '2026-01-01', '2026-01-01'),
          ('PBP-02', 'PRJ-01', 'BP-04', '台灣水泥預拌股份有限公司', '預拌混凝土 (4000psi/5000psi)', 500000, '基礎筏基與各層灌漿供料 (乙廠商)', '2026-01-01', '2026-01-01'),
          ('PBP-03', 'PRJ-01', 'BP-07', '宏聯結構工程拆圖顧問有限公司', '施工大樣圖與構件拆圖', 800000, '施工製造詳圖繪製送審 (丙廠商)', '2026-01-01', '2026-01-01'),
          ('PBP-04', 'PRJ-02', 'BP-08', '大有營建工程施工拆圖事務所有限公司', '無塵室結構拆圖', 650000, '特殊管線穿樑檢討', '2026-01-01', '2026-01-01');
      `);
    }
  } catch (e) {}

  try {
    const bp07Check = db.exec(`SELECT count(*) FROM business_partners WHERE id = 'BP-07';`);
    if (!bp07Check.length || Number(bp07Check[0].values[0][0]) === 0) {
      db.run(`
        INSERT INTO business_partners (id, bpCode, name, taxId, entityType, type, isCustomer, isVendor, serviceCategoryMain, serviceCategorySub, ownerIdNumber, representative, contactPerson, phone, email, address, bankName, bankCode, bankAccount, bankAccountName, bankFeePayer, hasInvoice, paymentTermsDays, isHighRisk, currentScore, status, companyId, isDeleted, version, createdAt, updatedAt)
        VALUES ('BP-07', 'SUB-003', '宏聯結構工程拆圖顧問有限公司', '54321678', 'CORPORATION', 'SUBCONTRACTOR', 0, 1, '專業技術顧問與測量設計', '拆圖廠商 / 施工大樣圖拆圖', 'G123456789', '黃宏達 技師', '黃宏達', '02-2345-6789', 'detail@honglian.com.tw', '台北市中山區南京東路三段28號', '台北富邦銀行', '012', '012001998877', '宏聯結構工程拆圖顧問有限公司', 'COMPANY', 1, 30, 0, 95, 'ACTIVE', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01')
        ON CONFLICT(id) DO NOTHING;
      `);
    }
    const bp08Check = db.exec(`SELECT count(*) FROM business_partners WHERE id = 'BP-08';`);
    if (!bp08Check.length || Number(bp08Check[0].values[0][0]) === 0) {
      db.run(`
        INSERT INTO business_partners (id, bpCode, name, taxId, entityType, type, isCustomer, isVendor, serviceCategoryMain, serviceCategorySub, ownerIdNumber, representative, contactPerson, phone, email, address, bankName, bankCode, bankAccount, bankAccountName, bankFeePayer, hasInvoice, paymentTermsDays, isHighRisk, currentScore, status, companyId, isDeleted, version, createdAt, updatedAt)
        VALUES ('BP-08', 'SUB-004', '大有營建工程施工拆圖事務所有限公司', '67891234', 'CORPORATION', 'SUBCONTRACTOR', 0, 1, '專業技術顧問與測量設計', '拆圖廠商 / 施工大樣圖拆圖', 'H123456789', '林大有 技師', '林大有', '02-8765-4321', 'cad@dayou-draw.com.tw', '新北市板橋區文化路二段100號', '國泰世華銀行', '013', '013009988112', '大有營建工程施工拆圖事務所有限公司', 'COMPANY', 1, 30, 0, 93, 'ACTIVE', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01')
        ON CONFLICT(id) DO NOTHING;
      `);
    }
    const bp09Check = db.exec(`SELECT count(*) FROM business_partners WHERE id = 'BP-09';`);
    if (!bp09Check.length || Number(bp09Check[0].values[0][0]) === 0) {
      db.run(`
        INSERT INTO business_partners (id, bpCode, name, taxId, entityType, type, isCustomer, isVendor, serviceCategoryMain, serviceCategorySub, ownerIdNumber, representative, contactPerson, phone, email, address, bankName, bankCode, bankAccount, bankAccountName, bankFeePayer, hasInvoice, paymentTermsDays, isHighRisk, currentScore, status, companyId, isDeleted, version, createdAt, updatedAt)
        VALUES ('BP-09', 'SUB-005', '誠業結構技師事務所 (拆圖部)', '43218765', 'CORPORATION', 'SUBCONTRACTOR', 0, 1, '專業技術顧問與測量設計', '拆圖廠商 / 建築結構大樣拆圖', 'A129876543', '陳誠業 技師', '陳誠業', '02-2700-1122', 'chen@chengye-str.com.tw', '台北市大安區信義路四段88號', '玉山商業銀行', '808', '808001122334', '誠業結構技師事務所', 'COMPANY', 1, 30, 0, 94, 'ACTIVE', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01')
        ON CONFLICT(id) DO NOTHING;
      `);
    }
  } catch (e) {}

  try {
    const accCountRes = db.exec(`SELECT count(*) FROM bp_bank_accounts;`);
    if (Number(accCountRes[0]?.values[0]?.[0] || 0) === 0) {
      const bpRows = db.exec(`SELECT id, name, contactPerson, phone, email, address, bankName, bankCode, bankAccount FROM business_partners WHERE isDeleted = 0;`);
      if (bpRows.length && bpRows[0].values.length) {
        for (const r of bpRows[0].values) {
          const bpId = String(r[0]);
          const bpName = String(r[1]);
          const cPerson = String(r[2] || '');
          const cPhone = String(r[3] || '');
          const cEmail = String(r[4] || '');
          const addr = String(r[5] || '');
          const bName = String(r[6] || '');
          const bCode = String(r[7] || '');
          const bAcc = String(r[8] || '');

          if (addr) {
            db.run(`INSERT INTO partner_addresses (id, partnerId, addressType, label, fullAddress, isDeleted) VALUES ('PADDR-${bpId}', '${bpId}', 'COMMUNICATION', '主要通訊地址', '${addr.replace(/'/g, "''")}', 0);`);
          }
          if (cPerson) {
            db.run(`INSERT INTO partner_contacts (id, partnerId, contactType, name, title, phone, mobile, extension, email, notes, isDeleted) VALUES ('PCON-${bpId}', '${bpId}', 'PRIMARY', '${cPerson.replace(/'/g, "''")}', '業務窗口', '${cPhone.replace(/'/g, "''")}', '${cPhone.replace(/'/g, "''")}', '', '${cEmail.replace(/'/g, "''")}', '', 0);`);
          }
          if (bAcc) {
            db.run(`INSERT INTO bp_bank_accounts (id, bpId, bankCode, bankName, branchCode, branchName, accountNumber, accountName, isPrimary, isDeleted) VALUES ('BACC-${bpId}', '${bpId}', '${bCode}', '${bName.replace(/'/g, "''")}', '', '', '${bAcc.replace(/'/g, "''")}', '${bpName.replace(/'/g, "''")}', 1, 0);`);
          }
        }
      }
    }
  } catch (e) {}

  ensureUsersAndFinanceIntegrity(db);

  // 確保企業實體擁有歷史地址留存與完整地址擴充欄位
  ensureCompanyExtendedColumns(db);

  // 確保郵局牆上表微型資料庫已初始化並同步至共用地址工具
  ensurePostalCatalogSeeded(db);
  syncPostalCatalogToUtility(db);

  // 自動校準單據流水號計數器
  try {
    reseedDocumentSequences(db);
  } catch (e) {
    console.error('Sequence reseed error', e);
  }
}
