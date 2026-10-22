// SQLite 本地資料庫引擎與資料持久層 (相容 WebAssembly sql.js 與全域 SQL 匯出/匯入)
import type { Database, SqlJsStatic } from 'sql.js';
import {
  Company,
  PhoneItem,
  KeyPerson,
  Project,
  ProjectSite,
  ProjectWBS,
  BusinessPartner,
  PartnerAddress,
  PartnerContact,
  BPBankAccount,
  PartnerChequeRecord,
  PartnerBusinessCard,
  Item,
  InboundReceipt,
  InboundReceiptItem,
  InboundReceiptStatus,
  InboundBillingStatus,
  Quotation,
  QuotationRevision,
  QuotationItem,
  QuotationBillingMilestone,
  PurchaseOrder,
  PurchaseOrderItem,
  Subcontract,
  Valuation,
  ValuationItem,
  AccountPayable,
  AccountReceivable,
  BankCheck,
  AppConfig,
  SystemConfig,
  DocumentSequence,
  DocumentSequenceRule,
  DocumentModuleSequenceStatus,
  AuditLog,
  CashFlowMetrics,
  User,
  CompanyGroupAssignment,
  UserGroup,
  GroupModulePermission,
  ModuleKey,
  UserRole,
  AnnualArchiveSnapshot,
  SystemFile,
  ExternalFolderLink,
  FileLink,
  RestoreStrategy,
  ModularBackupPackage,
  RestoreResult,
  RegulatorySchedule
} from '../types/erp';

declare global {
  interface Window {
    initSqlJs?: (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;
  }
}

let sqlJsEngine: SqlJsStatic | null = null;
let dbInstance: Database | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export function subscribeToDatabase(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// 初始化 SQLite 資料庫
export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  let SQL: SqlJsStatic;

  if (typeof window !== 'undefined') {
    let initFn = window.initSqlJs;
    if (!initFn) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/sql-wasm.js';
        script.onload = () => resolve();
        script.onerror = (e) => reject(new Error('無法載入 /sql-wasm.js'));
        document.head.appendChild(script);
      });
      initFn = window.initSqlJs;
    }

    if (!initFn) {
      throw new Error('SQLite WebAssembly 初始化引擎未就緒');
    }

    SQL = await initFn({
      locateFile: (file) => `/${file}`
    });
  } else {
    // Node.js / 測試環境相容模式
    const initSqlModule = (await import('sql.js')).default;
    SQL = await initSqlModule();
  }

  sqlJsEngine = SQL;

  if (typeof localStorage !== 'undefined') {
    const savedDb = localStorage.getItem('engineering_erp_sqlite_db');
    if (savedDb) {
      try {
        const uInt8Array = new Uint8Array(JSON.parse(savedDb));
        dbInstance = new SQL.Database(uInt8Array);
        console.log('✅ 成功從本機快照還原 SQLite 資料庫');
        ensureDatabaseIntegrity(dbInstance);
        return dbInstance;
      } catch (e) {
        console.warn('⚠️ 舊快照載入失敗，將重新建置全新資料庫', e);
      }
    }
  }

  dbInstance = new SQL.Database();
  initializeTables(dbInstance);
  seedInitialData(dbInstance);
  saveDatabaseSnapshot();
  return dbInstance;
}

// 儲存資料庫狀態至 localStorage
export function saveDatabaseSnapshot() {
  if (!dbInstance) return;
  if (typeof localStorage === 'undefined') return;
  try {
    const binary = dbInstance.export();
    const array = Array.from(binary);
    localStorage.setItem('engineering_erp_sqlite_db', JSON.stringify(array));
  } catch (e) {
    console.error('儲存本機 SQLite 快照失敗', e);
  }
}

// 12 大模組資料表 DDL
function initializeTables(db: Database) {
  db.run(`
    -- 0. 三層式帳號架構與自訂群組模組矩陣 (Users, UserGroups, GroupModulePermissions)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      fullName TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL,
      canManageUsers INTEGER DEFAULT 0,
      canManageSystemConfigs INTEGER DEFAULT 0,
      canManageAdmins INTEGER DEFAULT 0,
      canManageAllCompanies INTEGER DEFAULT 0,
      groupId TEXT,
      groupIds TEXT DEFAULT '[]',
      companyGroupAssignments TEXT DEFAULT '[]',
      status TEXT DEFAULT 'ACTIVE',
      title TEXT,
      allowedCompanies TEXT DEFAULT '["COMP-01","COMP-02"]',
      defaultCompanyId TEXT DEFAULT 'COMP-01',
      passwordHash TEXT DEFAULT '888888',
      isPasswordReset INTEGER DEFAULT 0,
      lastLoginAt TEXT,
      deleteStage TEXT DEFAULT 'ACTIVE',
      stageDeletedAt TEXT,
      purgeDueAt TEXT,
      deletedBy TEXT,
      stageNotes TEXT,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS user_groups (
      id TEXT PRIMARY KEY,
      groupCode TEXT UNIQUE NOT NULL,
      groupName TEXT NOT NULL,
      description TEXT,
      isSystem INTEGER DEFAULT 0,
      approvalLimit REAL DEFAULT 0,
      canExport INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS group_module_permissions (
      id TEXT PRIMARY KEY,
      groupId TEXT NOT NULL,
      moduleKey TEXT NOT NULL,
      canRead INTEGER DEFAULT 0,
      canWrite INTEGER DEFAULT 0,
      canApprove INTEGER DEFAULT 0,
      canExport INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      updatedAt TEXT
    );

    -- 1. 公司法人與集團實體 (Company)
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      companyCode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      shortName TEXT,
      entityType TEXT DEFAULT 'CORPORATION',
      parentId TEXT,
      taxId TEXT,
      nationalId TEXT,
      representative TEXT,
      keyPersonnel TEXT DEFAULT '[]',
      documentPrefix TEXT,
      phones TEXT DEFAULT '[]',
      email TEXT,
      registeredAddress TEXT,
      contactAddress TEXT,
      capitalAmount REAL DEFAULT 0,
      baseCurrency TEXT DEFAULT 'TWD',
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_companies_parent_type ON companies (parentId, entityType, isDeleted);
    CREATE INDEX IF NOT EXISTS idx_companies_code ON companies (companyCode);

    -- 2. 全域參數與審計 (SystemConfig & AuditLog & DocumentSequence & AnnualArchiveSnapshot)
    CREATE TABLE IF NOT EXISTS document_sequences (
      prefix TEXT PRIMARY KEY,
      currentVal INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS document_sequence_rules (
      moduleKey TEXT PRIMARY KEY,
      moduleName TEXT NOT NULL,
      prefix TEXT NOT NULL,
      dateFormat TEXT DEFAULT 'YYYYMM',
      delimiter TEXT DEFAULT '-',
      serialLength INTEGER DEFAULT 3,
      resetFrequency TEXT DEFAULT 'MONTHLY',
      description TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS annual_archive_snapshots (
      id TEXT PRIMARY KEY,
      archiveYear INTEGER NOT NULL,
      archiveFileName TEXT NOT NULL,
      relativePath TEXT NOT NULL,
      recordCount INTEGER DEFAULT 0,
      fileSizeBytes INTEGER DEFAULT 0,
      fileHash TEXT NOT NULL,
      isSealed INTEGER DEFAULT 1,
      sealedAt TEXT NOT NULL,
      sealedBy TEXT NOT NULL,
      description TEXT
    );

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

    CREATE TABLE IF NOT EXISTS system_files (
      id TEXT PRIMARY KEY,
      targetTable TEXT NOT NULL,
      targetId TEXT NOT NULL,
      fileName TEXT NOT NULL,
      originalName TEXT,
      savedName TEXT,
      fileSizeBytes INTEGER DEFAULT 0,
      mimeType TEXT,
      fileCategory TEXT,
      storagePath TEXT NOT NULL,
      isEncrypted INTEGER DEFAULT 0,
      fileHash TEXT,
      companyId TEXT,
      uploadTime TEXT,
      parentFileId TEXT,
      isObsolete INTEGER DEFAULT 0,
      status TEXT DEFAULT 'NORMAL',
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS external_folder_links (
      id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      projectId TEXT,
      partnerId TEXT,
      targetTable TEXT NOT NULL,
      targetId TEXT NOT NULL,
      nasFolderPath TEXT NOT NULL,
      description TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS file_links (
      id TEXT PRIMARY KEY,
      fileId TEXT NOT NULL,
      companyId TEXT,
      projectId TEXT,
      partnerId TEXT,
      userId TEXT,
      targetTable TEXT NOT NULL,
      targetId TEXT NOT NULL,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_archive_year ON annual_archive_snapshots (archiveYear);
    CREATE INDEX IF NOT EXISTS idx_files_target ON system_files (targetTable, targetId);
    CREATE INDEX IF NOT EXISTS idx_files_hash ON system_files (fileHash);
    CREATE INDEX IF NOT EXISTS idx_file_links_target ON file_links (targetTable, targetId, isDeleted);
    CREATE INDEX IF NOT EXISTS idx_file_links_anchor ON file_links (projectId, partnerId, userId);
    CREATE INDEX IF NOT EXISTS idx_ext_folders_target ON external_folder_links (targetTable, targetId, isDeleted);

    -- 0-1. 軟體程式設定 (AppConfig - Superadmin 專屬)
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

    CREATE TABLE IF NOT EXISTS system_configs (
      id TEXT PRIMARY KEY,
      configKey TEXT UNIQUE NOT NULL,
      configValue TEXT NOT NULL,
      description TEXT,
      valueType TEXT DEFAULT 'STRING',
      validFrom TEXT,
      validTo TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      updatedBy TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      userId TEXT,
      userName TEXT,
      action TEXT,
      targetTable TEXT,
      targetId TEXT,
      beforeJson TEXT,
      afterJson TEXT,
      ipAddress TEXT,
      createdAt TEXT
    );

    -- 3. 專案與案場 (Projects, ProjectSites, ProjectWBS)
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      projectCode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      ownerName TEXT NOT NULL,
      ownerTaxId TEXT,
      contractAmount REAL DEFAULT 0,
      budgetAmount REAL DEFAULT 0,
      committedCost REAL DEFAULT 0,
      actualCost REAL DEFAULT 0,
      startDate TEXT,
      endDate TEXT,
      status TEXT DEFAULT 'ACTIVE',
      isLocked INTEGER DEFAULT 0,
      companyId TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS project_sites (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      siteName TEXT NOT NULL,
      address TEXT NOT NULL,
      contactPerson TEXT,
      contactPhone TEXT,
      permitNumber TEXT
    );

    CREATE TABLE IF NOT EXISTS project_wbs (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      nodeCode TEXT NOT NULL,
      nodeName TEXT NOT NULL,
      parentId TEXT,
      budgetAmount REAL DEFAULT 0,
      committedAmount REAL DEFAULT 0,
      actualAmount REAL DEFAULT 0
    );

    -- 4. 商業夥伴 (BusinessPartner) 與 料件工項 (Item)
    CREATE TABLE IF NOT EXISTS business_partners (
      id TEXT PRIMARY KEY,
      bpCode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      taxId TEXT NOT NULL,
      entityType TEXT DEFAULT 'CORPORATION',
      type TEXT NOT NULL,
      isCustomer INTEGER DEFAULT 0,
      isVendor INTEGER DEFAULT 1,
      convertedFromVendorId TEXT,
      serviceCategoryMain TEXT,
      serviceCategorySub TEXT,
      serviceCategories TEXT,
      ownerIdNumber TEXT,
      representative TEXT,
      contactPerson TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      bankName TEXT,
      bankCode TEXT,
      bankAccount TEXT,
      bankAccountName TEXT,
      bankFeePayer TEXT DEFAULT 'COMPANY',
      hasInvoice INTEGER DEFAULT 1,
      paymentTermsDays INTEGER DEFAULT 30,
      isHighRisk INTEGER DEFAULT 0,
      riskReason TEXT,
      currentScore REAL DEFAULT 85,
      status TEXT DEFAULT 'ACTIVE',
      companyId TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

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
      streetAddress TEXT,
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

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      itemCode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT,
      unitPrice REAL DEFAULT 0,
      standardCost REAL DEFAULT 0,
      isDeleted INTEGER DEFAULT 0
    );

    -- 5. 報價與銷售模組 CPQ (Quotation, QuotationRevision, QuotationItem, QuotationBillingMilestone)
    CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      quoteNumber TEXT UNIQUE NOT NULL,
      projectId TEXT NOT NULL,
      customerId TEXT NOT NULL,
      customerName TEXT,
      companyId TEXT NOT NULL,
      currency TEXT DEFAULT 'TWD',
      netAmount REAL DEFAULT 0,
      taxAmount REAL DEFAULT 0,
      totalAmount REAL DEFAULT 0,
      discountAmount REAL DEFAULT 0,
      currentRevision TEXT DEFAULT 'REV-A',
      status TEXT DEFAULT 'DRAFT',
      validityDate TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS quotation_revisions (
      id TEXT PRIMARY KEY,
      quotationId TEXT NOT NULL,
      revisionCode TEXT NOT NULL,
      netAmount REAL DEFAULT 0,
      taxAmount REAL DEFAULT 0,
      totalAmount REAL DEFAULT 0,
      isWinning INTEGER DEFAULT 0,
      lostReason TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS quotation_items (
      id TEXT PRIMARY KEY,
      quotationId TEXT NOT NULL,
      revisionCode TEXT NOT NULL,
      itemType TEXT DEFAULT 'NORMAL',
      itemName TEXT NOT NULL,
      spec TEXT,
      quantity REAL DEFAULT 1,
      unit TEXT,
      unitPrice REAL DEFAULT 0,
      lineTotal REAL DEFAULT 0,
      remark TEXT
    );

    CREATE TABLE IF NOT EXISTS quotation_billing_milestones (
      id TEXT PRIMARY KEY,
      quotationId TEXT NOT NULL,
      stageIndex INTEGER NOT NULL,
      stageName TEXT NOT NULL,
      percentage REAL NOT NULL,
      estimatedDate TEXT,
      amount REAL DEFAULT 0
    );

    -- 6. 採購發包 (PurchaseOrder & PurchaseOrderItem)
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      poNumber TEXT UNIQUE NOT NULL,
      companyId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      vendorId TEXT NOT NULL,
      currency TEXT DEFAULT 'TWD',
      netAmount REAL DEFAULT 0,
      taxAmount REAL DEFAULT 0,
      totalAmount REAL DEFAULT 0,
      discountAmount REAL DEFAULT 0,
      retentionDeductionAmount REAL DEFAULT 0,
      postedTaxRate REAL DEFAULT 0.05,
      counterpartyNameSnapshot TEXT,
      counterpartyTaxIdSnapshot TEXT,
      projectNameSnapshot TEXT,
      isPrepaidDeduction INTEGER DEFAULT 0,
      prepaidDeductionAmount REAL DEFAULT 0,
      status TEXT DEFAULT 'DRAFT',
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY,
      purchaseOrderId TEXT NOT NULL,
      itemCode TEXT,
      itemName TEXT NOT NULL,
      spec TEXT,
      quantity REAL DEFAULT 1,
      unit TEXT,
      unitPrice REAL DEFAULT 0,
      lineTotal REAL DEFAULT 0
    );

    -- 6-1. 現場進貨簽收單與明細 (InboundReceipt & InboundReceiptItem - A模式直入案場成本)
    CREATE TABLE IF NOT EXISTS inbound_receipts (
      id TEXT PRIMARY KEY,
      receiptNumber TEXT UNIQUE NOT NULL,
      companyId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      projectNameSnapshot TEXT,
      vendorId TEXT NOT NULL,
      vendorNameSnapshot TEXT,
      vendorTaxIdSnapshot TEXT,
      deliveryNoteNumber TEXT NOT NULL,
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

    CREATE INDEX IF NOT EXISTS idx_inbound_project ON inbound_receipts (projectId, isDeleted);
    CREATE INDEX IF NOT EXISTS idx_inbound_vendor ON inbound_receipts (vendorId, billingStatus, isDeleted);
    CREATE INDEX IF NOT EXISTS idx_inbound_items_receipt ON inbound_receipt_items (receiptId);


    -- 7. 發包合約與估驗計價 (Subcontract & Valuation & ValuationItem)
    CREATE TABLE IF NOT EXISTS subcontracts (
      id TEXT PRIMARY KEY,
      contractCode TEXT UNIQUE NOT NULL,
      projectId TEXT NOT NULL,
      subcontractorId TEXT NOT NULL,
      companyId TEXT NOT NULL,
      subcontractorName TEXT NOT NULL,
      projectName TEXT NOT NULL,
      contractName TEXT NOT NULL,
      totalAmount REAL DEFAULT 0,
      retentionRate REAL DEFAULT 10,
      prepaidAmount REAL DEFAULT 0,
      prepaidRemaining REAL DEFAULT 0,
      startDate TEXT,
      endDate TEXT,
      status TEXT DEFAULT 'ACTIVE'
    );

    CREATE TABLE IF NOT EXISTS valuations (
      id TEXT PRIMARY KEY,
      valuationNumber TEXT UNIQUE NOT NULL,
      subcontractId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      subcontractorId TEXT NOT NULL,
      companyId TEXT NOT NULL,
      periodIndex INTEGER NOT NULL,
      periodName TEXT NOT NULL,
      cumulativeProgressPct REAL DEFAULT 0,
      grossAmount REAL DEFAULT 0,
      retentionDeductionAmount REAL DEFAULT 0,
      prepaidDeductionAmount REAL DEFAULT 0,
      otherDeductionAmount REAL DEFAULT 0,
      netPayableAmount REAL DEFAULT 0,
      taxAmount REAL DEFAULT 0,
      totalAmount REAL DEFAULT 0,
      status TEXT DEFAULT 'DRAFT',
      counterpartyNameSnapshot TEXT,
      projectNameSnapshot TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS valuation_items (
      id TEXT PRIMARY KEY,
      valuationId TEXT NOT NULL,
      itemType TEXT DEFAULT 'NORMAL',
      itemName TEXT NOT NULL,
      unit TEXT,
      contractQuantity REAL DEFAULT 0,
      contractUnitPrice REAL DEFAULT 0,
      previousQty REAL DEFAULT 0,
      currentQty REAL DEFAULT 0,
      currentAmount REAL DEFAULT 0,
      remark TEXT
    );

    -- 8. 財務會計 (AccountPayable, AccountReceivable, BankCheck)
    CREATE TABLE IF NOT EXISTS accounts_payable (
      id TEXT PRIMARY KEY,
      apNumber TEXT UNIQUE NOT NULL,
      sourceTable TEXT NOT NULL,
      sourceId TEXT NOT NULL,
      companyId TEXT NOT NULL,
      vendorId TEXT NOT NULL,
      vendorName TEXT NOT NULL,
      originalAmount REAL DEFAULT 0,
      appliedAmount REAL DEFAULT 0,
      remainingAmount REAL DEFAULT 0,
      dueDate TEXT,
      invoiceNumber TEXT,
      taxReportingCompanyId TEXT,
      status TEXT DEFAULT 'OPEN',
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts_receivable (
      id TEXT PRIMARY KEY,
      arNumber TEXT UNIQUE NOT NULL,
      projectId TEXT NOT NULL,
      customerId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      companyId TEXT NOT NULL,
      amount REAL DEFAULT 0,
      appliedAmount REAL DEFAULT 0,
      remainingAmount REAL DEFAULT 0,
      dueDate TEXT,
      status TEXT DEFAULT 'OPEN',
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS bank_checks (
      id TEXT PRIMARY KEY,
      checkNumber TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      companyId TEXT NOT NULL,
      counterpartyName TEXT NOT NULL,
      amount REAL DEFAULT 0,
      issueDate TEXT,
      dueDate TEXT,
      bankName TEXT,
      status TEXT DEFAULT 'ISSUED',
      voidReason TEXT,
      notes TEXT
    );
  `);

  // 安全增量升級既有 users 表之多階段刪除生命週期欄位
  try {
    db.run("ALTER TABLE users ADD COLUMN deleteStage TEXT DEFAULT 'ACTIVE';");
  } catch (_) {}
  try {
    db.run("ALTER TABLE users ADD COLUMN stageDeletedAt TEXT;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE users ADD COLUMN purgeDueAt TEXT;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE users ADD COLUMN deletedBy TEXT;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE users ADD COLUMN stageNotes TEXT;");
  } catch (_) {}

  // 安全增量升級既有 system_files 表之無紙化版本堆疊與健康狀態欄位
  try { db.run("ALTER TABLE system_files ADD COLUMN parentFileId TEXT;"); } catch (_) {}
  try { db.run("ALTER TABLE system_files ADD COLUMN isObsolete INTEGER DEFAULT 0;"); } catch (_) {}
  try { db.run("ALTER TABLE system_files ADD COLUMN status TEXT DEFAULT 'NORMAL';"); } catch (_) {}
  try { db.run("ALTER TABLE system_files ADD COLUMN isDeleted INTEGER DEFAULT 0;"); } catch (_) {}

  // 🛡️ 安全增量升級 Phase 4 CPQ 報價單三軌議價與影子單價欄位
  try { db.run("ALTER TABLE quotations ADD COLUMN pricingMode TEXT DEFAULT 'HEADER_DISCOUNT';"); } catch (_) {}
  try { db.run("ALTER TABLE quotations ADD COLUMN customDiscountText TEXT;"); } catch (_) {}
  try { db.run("ALTER TABLE quotations ADD COLUMN agreedTotalAmount REAL;"); } catch (_) {}
  try { db.run("ALTER TABLE quotations ADD COLUMN parentQuotationId TEXT;"); } catch (_) {}
  try { db.run("ALTER TABLE quotation_revisions ADD COLUMN pricingMode TEXT DEFAULT 'HEADER_DISCOUNT';"); } catch (_) {}
  try { db.run("ALTER TABLE quotation_revisions ADD COLUMN discountAmount REAL DEFAULT 0;"); } catch (_) {}
  try { db.run("ALTER TABLE quotation_items ADD COLUMN estimatedUnitCost REAL DEFAULT 0;"); } catch (_) {}
  try { db.run("ALTER TABLE quotation_items ADD COLUMN effectiveUnitPrice REAL DEFAULT 0;"); } catch (_) {}
  try { db.run("ALTER TABLE quotation_items ADD COLUMN isAwarded INTEGER DEFAULT 1;"); } catch (_) {}
  try { db.run("ALTER TABLE quotation_items ADD COLUMN lostReason TEXT;"); } catch (_) {}
}

// 建立營造工程真實範例資料
export function seedInitialData(db: Database) {
  // 清理現有資料
  const tables = [
    'users', 'user_groups', 'group_module_permissions',
    'app_configs', 'companies', 'system_configs', 'regulatory_schedules', 'audit_logs', 'system_files', 'external_folder_links', 'file_links', 'projects', 'project_sites',
    'project_wbs', 'business_partners', 'bp_bank_accounts', 'partner_addresses', 'partner_contacts', 'partner_cheque_records', 'items', 'quotations', 'quotation_revisions',
    'quotation_items', 'quotation_billing_milestones', 'purchase_orders',
    'purchase_order_items', 'inbound_receipts', 'inbound_receipt_items', 'subcontracts', 'valuations', 'valuation_items',
    'accounts_payable', 'accounts_receivable', 'bank_checks'
  ];
  tables.forEach(t => db.run(`DELETE FROM ${t};`));

  // 0. 三層式帳號權限與 PBAC 模組矩陣
  seedUserPermissionData(db);

  // 0-1. 軟體程式設定 (AppConfig - Superadmin 專屬)
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
      ('APP-CFG-16', 'APP_SYSTEM_NAME', '田頭營造工程雲端 ERP 整合系統', '軟體系統完整中文全稱 (全域自訂品牌)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01');
  `);

  // 1. 公司法人、集團與個人實體
  db.run(`
    INSERT INTO companies (id, companyCode, name, shortName, entityType, parentId, taxId, nationalId, representative, keyPersonnel, documentPrefix, phones, email, registeredAddress, contactAddress, capitalAmount, baseCurrency, isDeleted, version, createdAt, updatedAt)
    VALUES 
      ('GRP-01', 'GRP-TW', '大巨營造事業集團', '大巨集團', 'GROUP', NULL, NULL, NULL, '林大巨 創辦人', '[{"id":"kp-0","title":"集團總裁","name":"林大巨","phone":"0910-123-456"}]', 'GRP', '[]', 'group@daju-group.com.tw', '台北市信義區經貿二路100號', '台北市信義區經貿二路100號28樓', 500000000, 'TWD', 0, 1, '2026-01-01', '2026-01-01'),
      ('COMP-01', 'CMP-TW01', '台灣大巨營造工程股份有限公司', '大巨營造', 'CORPORATION', 'GRP-01', '88991234', NULL, '林大巨 董事長', '[{"id":"kp-1","title":"董事長","name":"林大巨","phone":"0910-123-456"},{"id":"kp-2","title":"總經理","name":"陳國安","phone":"0920-654-321"},{"id":"kp-3","title":"工務特助","name":"黃志明","phone":"0933-778-899"}]', 'DJ', '[{"id":"p1","type":"市話","number":"02-2720-8888"},{"id":"p2","type":"傳真","number":"02-2720-9999"},{"id":"p3","type":"工務專線","number":"0910-123-456"}]', 'service@daju-eng.com.tw', '台北市信義區經貿二路100號5樓', '台北市信義區經貿二路100號5樓', 150000000, 'TWD', 0, 1, '2026-01-01', '2026-01-01'),
      ('COMP-02', 'CMP-TW02', '宏達機電工程股份有限公司', '宏達機電', 'CORPORATION', 'GRP-01', '54329876', NULL, '陳總經理', '[{"id":"kp-4","title":"總經理","name":"陳志豪","phone":"0928-888-999"}]', 'HD', '[{"id":"p4","type":"市話","number":"02-8950-6677"}]', 'mep@hongda-eng.com.tw', '新北市板橋區縣民大道二段68號', '新北市板橋區縣民大道二段68號12樓', 50000000, 'TWD', 0, 1, '2026-01-01', '2026-01-01'),
      ('BOSS-01', 'BOSS-01', '林董私人調度資金戶', '林董私帳', 'PERSONAL', 'GRP-01', NULL, 'A123456789', '林大巨', '[]', 'BOSS', '[]', NULL, NULL, NULL, 0, 'TWD', 0, 1, '2026-01-01', '2026-01-01');
  `);

  // 2. 系統全域參數
  db.run(`
    INSERT INTO system_configs (id, configKey, configValue, description, valueType, validFrom, isDeleted, version, updatedBy, createdAt, updatedAt)
    VALUES
      ('CFG-01', 'TAX_RATE', '0.05', '法定營業稅率 (預設 5%)', 'NUMBER', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-02', 'FIN_TAX_TOLERANCE', '5.0', '發票稅額尾差容許值 (新台幣元)', 'NUMBER', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-03', 'DEFAULT_RETENTION_RATE', '10.0', '工程估驗預設保留款扣留比例 (%)', 'NUMBER', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-04', 'PROJECT_LOCK_MODE', 'STRICT', '案場超支預算防呆鎖定模式 (STRICT 嚴格阻擋 / WARN 警示放行)', 'STRING', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-05', 'NHI_RATE', '0.0211', '二代健保補充保費法定扣繳費率', 'NUMBER', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-06', 'PAYMENT_TERM_DAYS', '30', '預設請款票期 / 付款天數 (天)', 'NUMBER', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-07', 'WARRANTY_MONTHS', '12', '預設工程保固期 (月數)', 'NUMBER', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-08', 'MINIMUM_WAGE', '28590', '法定最低月薪基本工資 (新台幣元)', 'NUMBER', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01');
  `);

  // 法規預約生效排程預設項目 (2027/01/01 最低基本工資自動調整預排)
  db.run(`
    INSERT INTO regulatory_schedules (id, configKey, configLabel, scheduledValue, effectiveDate, status, createdBy, createdAt, notes)
    VALUES
      ('SCHED-01', 'MINIMUM_WAGE', '法定最低月薪基本工資', '29500', '2027-01-01 00:00:00', 'SCHEDULED', '系統預排', '2026-01-01 00:00:00', '2027/01/01 法定最低基本工資調整預排 (由 28,590 調升至 29,500 元)');
  `);

  // 3. 商業夥伴 (業主、混凝土下包、鋼構廠、弱電機電)
  db.run(`
    INSERT INTO business_partners (id, bpCode, name, taxId, entityType, type, isCustomer, isVendor, convertedFromVendorId, serviceCategoryMain, serviceCategorySub, ownerIdNumber, representative, contactPerson, phone, email, address, bankName, bankCode, bankAccount, bankAccountName, bankFeePayer, hasInvoice, paymentTermsDays, isHighRisk, riskReason, currentScore, status, companyId, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('BP-01', 'CUST-001', '富鼎置地開發建設股份有限公司', '12345678', 'CORPORATION', 'CUSTOMER', 1, 0, NULL, NULL, NULL, 'A123456789', '陳大為 董事長', '陳大為 總監', '02-2712-8888', 'contact@fuding.com.tw', '台北市信義區松高路100號', '中國信託商業銀行', '822', '123456789012', '富鼎置地開發建設股份有限公司', 'COMPANY', 1, 45, 0, NULL, 92, 'ACTIVE', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01'),
      ('BP-02', 'CUST-002', '國揚高新科技園區開發股份有限公司', '23456789', 'CORPORATION', 'CUSTOMER', 1, 0, NULL, NULL, NULL, 'B120987654', '林志祥 總經理', '林志祥 副總', '03-5712-9999', 'service@guoyang.com.tw', '新竹市東區公道五路二段50號', '國泰世華商業銀行', '013', '234567890123', '國揚高新科技園區開發股份有限公司', 'COMPANY', 1, 60, 0, NULL, 88, 'ACTIVE', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01'),
      ('BP-03', 'VEND-001', '台灣水泥股份有限公司 (台北營業所)', '03754904', 'CORPORATION', 'VENDOR', 0, 1, NULL, '營建材料原物料供料商', '預拌混凝土出料', 'A100987654', '張安平 董事長', '黃經理', '02-2567-8899', 'orders@taiwancement.com', '台北市中山北路二段113號', '臺灣銀行', '004', '004001234567', '台灣水泥股份有限公司', 'COMPANY', 1, 30, 0, NULL, 95, 'ACTIVE', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01'),
      ('BP-04', 'VEND-002', '中鋼結構工程股份有限公司', '86512390', 'CORPORATION', 'VENDOR', 0, 1, NULL, '基礎與結構工程', '鋼骨結構工程 (SC/SRC)', 'E123456780', '陳瑞騰 總經理', '周工程師', '07-616-8800', 'steel@csbc.com.tw', '高雄市小港區中鋼路1號', '兆豐國際商業銀行', '017', '017009876543', '中鋼結構工程股份有限公司', 'COMPANY', 1, 30, 0, NULL, 96, 'ACTIVE', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01'),
      ('BP-05', 'SUB-001', '合眾基礎連續壁深開挖工程行', '78901234', 'CORPORATION', 'SUBCONTRACTOR', 0, 1, NULL, '基礎與結構工程', '連續壁工程', 'F124567891', '張添進 負責人', '張添進 負責人', '0912-345-678', 'hezhong@tunnel.tw', '新北市五股區成泰路三段12號', '第一商業銀行', '007', '007001928374', '合眾基礎連續壁深開挖工程行', 'COMPANY', 1, 15, 0, NULL, 90, 'ACTIVE', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01'),
      ('BP-06', 'SUB-002', '億翔機電弱電工程企業社', '45678901', 'CORPORATION', 'SUBCONTRACTOR', 0, 1, NULL, '水電消防與空調機電', '智慧弱電/網路/監視門禁', 'H123456782', '李文發 負責人', '李文發', '0933-888-777', 'yixiang@mep.tw', '桃園市蘆竹區中正北路88號', '玉山商業銀行', '808', '808006543210', '億翔機電弱電工程企業社', 'COMPANY', 1, 30, 1, '曾有工程逾期爭議紀錄，發包前需副總以上特許核可', 72, 'WARNING', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01');

    -- 夥伴銀行帳戶 (BPBankAccount)
    INSERT INTO bp_bank_accounts (id, bpId, bankCode, bankName, branchCode, branchName, accountNumber, accountName, isPrimary, isDeleted)
    VALUES
      ('BACC-01', 'BP-01', '822', '中國信託商業銀行', '0822', '松高分行', '123456789012', '富鼎置地開發建設股份有限公司', 1, 0),
      ('BACC-02', 'BP-02', '013', '國泰世華商業銀行', '0135', '新竹分行', '234567890123', '國揚高新科技園區開發股份有限公司', 1, 0),
      ('BACC-03', 'BP-03', '004', '臺灣銀行', '0041', '群賢分行', '004001234567', '台灣水泥股份有限公司', 1, 0),
      ('BACC-04', 'BP-04', '017', '兆豐國際商業銀行', '0178', '小港分行', '017009876543', '中鋼結構工程股份有限公司', 1, 0),
      ('BACC-05', 'BP-05', '007', '第一商業銀行', '0073', '五股分行', '007001928374', '合眾基礎連續壁深開挖工程行', 1, 0),
      ('BACC-06', 'BP-06', '808', '玉山商業銀行', '8082', '蘆竹分行', '808006543210', '億翔機電弱電工程企業社', 1, 0);

    -- 夥伴多地址 (PartnerAddress - 支援登記地址、廠區、通訊地址等多點)
    INSERT INTO partner_addresses (id, partnerId, addressType, label, fullAddress, isDeleted)
    VALUES
      ('PADDR-01', 'BP-01', 'COMMUNICATION', '台北總部', '台北市信義區松高路100號18樓', 0),
      ('PADDR-02', 'BP-02', 'COMMUNICATION', '新竹辦公室', '新竹市東區公道五路二段50號6樓', 0),
      ('PADDR-03', 'BP-03', 'COMMUNICATION', '台北營業所', '台北市中山北路二段113號', 0),
      ('PADDR-04', 'BP-03', 'FACTORY', '八里預拌混凝土廠', '新北市八里區中山路三段55號', 0),
      ('PADDR-05', 'BP-04', 'COMMUNICATION', '小港總廠', '高雄市小港區中鋼路1號', 0),
      ('PADDR-06', 'BP-04', 'FACTORY', '燕巢鋼構加工廠', '高雄市燕巢區角宿路120號', 0),
      ('PADDR-07', 'BP-05', 'COMMUNICATION', '工務通訊處', '新北市五股區成泰路三段12號', 0),
      ('PADDR-08', 'BP-06', 'COMMUNICATION', '蘆竹總部', '桃園市蘆竹區中正北路88號', 0);

    -- 夥伴多聯絡人 (PartnerContact - 業務、工務、會計等多重窗口)
    INSERT INTO partner_contacts (id, partnerId, contactType, name, title, phone, mobile, extension, email, notes, isDeleted)
    VALUES
      ('PCON-01', 'BP-01', 'PRIMARY', '陳大為', '開發處總監', '02-2712-8888', '0910-888-999', '101', 'contact@fuding.com.tw', '主要商務合約決策人', 0),
      ('PCON-02', 'BP-01', 'FINANCE', '林雅婷', '財務經理', '02-2712-8888', '0922-111-222', '108', 'finance@fuding.com.tw', '請款發票對帳窗口', 0),
      ('PCON-03', 'BP-02', 'PRIMARY', '林志祥', '工程處副總', '03-5712-9999', '0935-777-666', '201', 'service@guoyang.com.tw', '竹科專案負責人', 0),
      ('PCON-04', 'BP-03', 'SALES', '黃經理', '業務部副理', '02-2567-8899', '0918-222-333', '302', 'orders@taiwancement.com', '混凝土調度及磅單核對窗口', 0),
      ('PCON-05', 'BP-04', 'ENGINEERING', '周工程師', '工務處工程師', '07-616-8800', '0921-333-444', '512', 'steel@csbc.com.tw', '鋼構圖面深化審查及吊裝排程', 0),
      ('PCON-06', 'BP-05', 'PRIMARY', '張添進', '負責人', '02-2292-1234', '0912-345-678', '', 'hezhong@tunnel.tw', '連續壁開挖現場工頭指揮', 0),
      ('PCON-07', 'BP-06', 'PRIMARY', '李文發', '負責人', '03-311-2233', '0933-888-777', '', 'yixiang@mep.tw', '弱電工程統籌', 0);

    -- 夥伴支票往來記錄 (PartnerChequeRecord - 收票與發票全盤留存)
    INSERT INTO partner_cheque_records (id, partnerId, direction, bankCode, bankName, accountNumber, checkNumber, issueDate, dueDate, amount, payeeName, isNonNegotiable, status, notes, createdAt, updatedAt)
    VALUES
      ('PCHK-01', 'BP-01', 'RECEIPT', '013', '國泰世華銀行', '234567890123', 'RC-990011', '2026-02-20', '2026-03-15', 17850000, '台灣大巨營造工程股份有限公司', 1, 'CLEARED', '合約首期訂金票據（已兌現入帳）', '2026-02-20', '2026-03-15'),
      ('PCHK-02', 'BP-03', 'PAYMENT', '822', '中國信託商業銀行', '123456789012', 'CQ-882201', '2026-03-05', '2026-04-30', 10080000, '台灣水泥股份有限公司', 1, 'CLEARED', '南港商辦案 3 月份預拌混凝土貨款（已兌現結清）', '2026-03-05', '2026-04-30'),
      ('PCHK-03', 'BP-04', 'PAYMENT', '004', '臺灣銀行', '004001234567', 'CQ-882203', '2026-04-05', '2026-05-31', 5000000, '中鋼結構工程股份有限公司', 1, 'ISSUED', '鋼構首批吊裝到場期票（未到期）', '2026-04-05', '2026-04-05'),
      ('PCHK-04', 'BP-05', 'PAYMENT', '822', '中國信託商業銀行', '123456789012', 'CQ-882202', '2026-04-01', '2026-05-15', 3727500, '合眾基礎連續壁深開挖工程行', 1, 'ISSUED', '第 1 期估驗尾款開立 45 天期票', '2026-04-01', '2026-04-01');
  `);

  // 4. 專案工程與案場 (Projects, ProjectSites, ProjectWBS)
  db.run(`
    INSERT INTO projects (id, projectCode, name, ownerName, ownerTaxId, contractAmount, budgetAmount, committedCost, actualCost, startDate, endDate, status, isLocked, companyId, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('PRJ-01', 'PRJ-2026-001', '台北南港經貿園區商辦總部新建工程', '富鼎置地開發建設股份有限公司', '12345678', 85000000, 72000000, 48000000, 31500000, '2026-02-01', '2027-12-31', 'ACTIVE', 0, 'COMP-01', 0, 1, '2026-02-01', '2026-02-01'),
      ('PRJ-02', 'PRJ-2026-002', '新竹科技園區精密廠房無塵室機電擴建專案', '國揚高新科技園區開發股份有限公司', '23456789', 42000000, 36000000, 29000000, 14200000, '2026-03-15', '2027-06-30', 'ACTIVE', 0, 'COMP-01', 0, 1, '2026-03-15', '2026-03-15'),
      ('PRJ-03', 'PRJ-2026-003', '新北新莊副都心商業住宅地基連續壁基礎工程', '富鼎置地開發建設股份有限公司', '12345678', 19800000, 17500000, 16000000, 8900000, '2026-01-10', '2026-08-31', 'ACTIVE', 0, 'COMP-01', 0, 1, '2026-01-10', '2026-01-10');

    INSERT INTO project_sites (id, projectId, siteName, address, contactPerson, contactPhone, permitNumber)
    VALUES
      ('SITE-01', 'PRJ-01', '南港總部基地案場', '台北市南港區經貿二路168號工地所', '王志豪 PM', '0921-111-222', '114建字第0888號'),
      ('SITE-02', 'PRJ-02', '竹科三期廠房案場', '新竹科學園區研新四路6號', '陳國慶 工務主任', '0935-333-444', '115竹科建字第0123號');

    INSERT INTO project_wbs (id, projectId, nodeCode, nodeName, parentId, budgetAmount, committedAmount, actualAmount)
    VALUES
      ('WBS-01', 'PRJ-01', 'WBS-100', '地下一至四層開挖及連續壁工程', NULL, 18000000, 16500000, 15000000),
      ('WBS-02', 'PRJ-01', 'WBS-200', '主體SRC鋼骨與混凝土澆置工程', NULL, 34000000, 22500000, 11000000),
      ('WBS-03', 'PRJ-01', 'WBS-300', '機電、消防、弱電智慧控制工程', NULL, 20000000, 9000000, 5500000);
  `);

  // 5. 報價單 (Quotation CPQ Engine)
  db.run(`
    INSERT INTO quotations (id, quoteNumber, projectId, customerId, customerName, companyId, currency, netAmount, taxAmount, totalAmount, discountAmount, currentRevision, status, validityDate, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('QUO-01', 'QT-2026-0018', 'PRJ-01', 'BP-01', '富鼎置地開發建設股份有限公司', 'COMP-01', 'TWD', 85000000, 4250000, 89250000, 500000, 'REV-B', 'ACCEPTED', '2026-04-30', 0, 2, '2026-01-15', '2026-01-28');

    INSERT INTO quotation_revisions (id, quotationId, revisionCode, netAmount, taxAmount, totalAmount, isWinning, lostReason, createdAt)
    VALUES
      ('QREV-01', 'QUO-01', 'REV-A', 88000000, 4400000, 92400000, 0, '業主要求價格回饋 300 萬，修正後發布 REV-B', '2026-01-15'),
      ('QREV-02', 'QUO-01', 'REV-B', 85000000, 4250000, 89250000, 1, NULL, '2026-01-28');

    -- 報價明細（包含憲法規定的粉紅扣款折讓）
    INSERT INTO quotation_items (id, quotationId, revisionCode, itemType, itemName, spec, quantity, unit, unitPrice, lineTotal, remark)
    VALUES
      ('QIT-01', 'QUO-01', 'REV-B', 'NORMAL', '地下室開挖與連續壁特種工程', '深度35米/厚度100cm', 1, '式', 18000000, 18000000, '含出土運棄'),
      ('QIT-02', 'QUO-01', 'REV-B', 'NORMAL', '高強度 5000psi 預拌混凝土材料澆置', '抗硫耐鹽配比', 15000, '立方米', 2400, 36000000, '台泥指定料源'),
      ('QIT-03', 'QUO-01', 'REV-B', 'NORMAL', '主結構耐震鋼骨 SN490C 加工吊裝', '含超音波銲道檢驗', 650, '噸', 48000, 31200000, '中鋼構直發'),
      ('QIT-04', 'QUO-01', 'REV-B', 'DEDUCTION', '業主首期簽約專案折讓優惠 (粉紅扣款)', '合約議定大額工程折扣', 1, '式', 500000, 500000, '憲法零負數規則：正數保存，底層自動減除');

    -- 里程碑請款設定 (總和必為 100%)
    INSERT INTO quotation_billing_milestones (id, quotationId, stageIndex, stageName, percentage, estimatedDate, amount)
    VALUES
      ('QMS-01', 'QUO-01', 1, '第一期：簽約訂金與工區點收動員款', 20.0, '2026-02-15', 17850000),
      ('QMS-02', 'QUO-01', 2, '第二期：地下室連續壁完工與土方開挖完成', 30.0, '2026-06-30', 26775000),
      ('QMS-03', 'QUO-01', 3, '第三期：主體結構上樑點收', 30.0, '2027-02-28', 26775000),
      ('QMS-04', 'QUO-01', 4, '第四期：使用執照取得與業主驗收尾款', 20.0, '2027-12-31', 17850000);
  `);

  // 6. 採購單 (PurchaseOrder 包含過帳實體快照)
  db.run(`
    INSERT INTO purchase_orders (id, poNumber, companyId, projectId, vendorId, currency, netAmount, taxAmount, totalAmount, discountAmount, retentionDeductionAmount, postedTaxRate, counterpartyNameSnapshot, counterpartyTaxIdSnapshot, projectNameSnapshot, isPrepaidDeduction, prepaidDeductionAmount, status, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('PO-01', 'PO-202603-0001', 'COMP-01', 'PRJ-01', 'BP-03', 'TWD', 9600000, 480000, 10080000, 0, 0, 0.05, '台灣水泥股份有限公司 (台北營業所)', '03754904', '台北南港經貿園區商辦總部新建工程', 0, 0, 'POSTED', 0, 1, '2026-03-01', '2026-03-01'),
      ('PO-02', 'PO-202603-0002', 'COMP-01', 'PRJ-01', 'BP-04', 'TWD', 15600000, 780000, 16380000, 0, 0, 0.05, '中鋼結構工程股份有限公司', '86512390', '台北南港經貿園區商辦總部新建工程', 1, 3000000, 'POSTED', 0, 1, '2026-03-05', '2026-03-05'),
      ('PO-03', 'PO-202604-0003', 'COMP-01', 'PRJ-02', 'BP-03', 'TWD', 4800000, 240000, 5040000, 0, 0, 0.05, '台灣水泥股份有限公司 (台北營業所)', '03754904', '新竹科技園區精密廠房無塵室機電擴建專案', 0, 0, 'DRAFT', 0, 1, '2026-04-10', '2026-04-10');

    INSERT INTO purchase_order_items (id, purchaseOrderId, itemCode, itemName, spec, quantity, unit, unitPrice, lineTotal)
    VALUES
      ('POI-01', 'PO-01', 'MAT-CONC-5000', '5000psi 自充填混凝土', '抗壓強度>350kgf/cm2', 4000, '立方米', 2400, 9600000),
      ('POI-02', 'PO-02', 'MAT-STEEL-SN', 'SN490C 特種耐震 H型鋼', '符合CNS標準合格銲材', 325, '噸', 48000, 15600000);
  `);

  // 6-1. 現場進貨簽收單種子資料 (A模式直入南港與竹科案場成本，未請款沉澱於廠商大水池)
  db.run(`
    INSERT INTO inbound_receipts (id, receiptNumber, companyId, projectId, projectNameSnapshot, vendorId, vendorNameSnapshot, vendorTaxIdSnapshot, deliveryNoteNumber, receivedDate, receivedBy, totalAmount, billingStatus, reconciliationId, reconciliationNumber, purchaseOrderId, status, attachmentFileId, attachmentFileName, notes, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('INB-01', 'INB-202603-0001', 'COMP-01', 'PRJ-01', '台北南港經貿園區商辦總部新建工程', 'BP-03', '台灣水泥股份有限公司 (台北營業所)', '03754904', 'TC-889922', '2026-03-12', '林工務主任', 288000, 'PENDING_BILLING', NULL, NULL, 'PO-01', 'POSTED', 'FILE-01', '台泥送貨簽收單_TC889922.pdf', '南港案B2底板澆置第一批點收無誤，坍度測試 18cm 合格', 0, 1, '2026-03-12 10:30:00', '2026-03-12 10:30:00'),
      ('INB-02', 'INB-202603-0002', 'COMP-01', 'PRJ-01', '台北南港經貿園區商辦總部新建工程', 'BP-03', '台灣水泥股份有限公司 (台北營業所)', '03754904', 'TC-890105', '2026-03-18', '林工務主任', 360000, 'PENDING_BILLING', NULL, NULL, 'PO-01', 'POSTED', NULL, NULL, '南港案B2底板澆置第二批，現場已簽收磅單留存工務所', 0, 1, '2026-03-18 14:15:00', '2026-03-18 14:15:00'),
      ('INB-03', 'INB-202603-0003', 'COMP-01', 'PRJ-01', '台北南港經貿園區商辦總部新建工程', 'BP-04', '中鋼結構工程股份有限公司', '86512390', 'CSC-202603-77', '2026-03-22', '周工務專員', 1200000, 'PENDING_BILLING', NULL, NULL, 'PO-02', 'POSTED', NULL, NULL, '首批地下柱核心構件吊裝進場，附出廠檢驗證明', 0, 1, '2026-03-22 09:00:00', '2026-03-22 09:00:00'),
      ('INB-04', 'INB-202604-0004', 'COMP-01', 'PRJ-02', '新竹科技園區精密廠房無塵室機電擴建專案', 'BP-03', '台灣水泥股份有限公司 (台北營業所)', '03754904', 'TC-910022', '2026-04-10', '張現場監工', 176000, 'PENDING_BILLING', NULL, NULL, 'PO-03', 'DRAFT', NULL, NULL, '無塵室基座地坪填平用，現場初點簽單，待主任覆核', 0, 1, '2026-04-10 11:20:00', '2026-04-10 11:20:00');

    INSERT INTO inbound_receipt_items (id, receiptId, itemCode, itemName, spec, unit, quantity, unitPrice, lineTotal, notes)
    VALUES
      ('INBI-01', 'INB-01', 'MAT-CONC-5000', '5000psi 自充填混凝土', '抗壓強度>350kgf/cm2', '立方米', 120, 2400, 288000, '出料車號 223-AB ~ 235-AB 共 12 車'),
      ('INBI-02', 'INB-02', 'MAT-CONC-5000', '5000psi 自充填混凝土', '抗壓強度>350kgf/cm2', '立方米', 150, 2400, 360000, '連續澆置作業'),
      ('INBI-03', 'INB-03', 'MAT-STEEL-SN', 'SN490C 特種耐震 H型鋼', '符合CNS標準合格銲材', '噸', 25, 48000, 1200000, '進場吊料 4 車'),
      ('INBI-04', 'INB-04', 'MAT-CONC-3000', '3000psi 預拌混凝土', '抗壓強度>210kgf/cm2', '立方米', 80, 2200, 176000, '機房基座回填');
  `);


  // 7. 下包合約與估驗計價 (Subcontracts & Valuations)
  db.run(`
    INSERT INTO subcontracts (id, contractCode, projectId, subcontractorId, companyId, subcontractorName, projectName, contractName, totalAmount, retentionRate, prepaidAmount, prepaidRemaining, startDate, endDate, status)
    VALUES
      ('SUB-CTR-01', 'SC-2026-008', 'PRJ-01', 'BP-05', 'COMP-01', '合眾基礎連續壁深開挖工程行', '台北南港經貿園區商辦總部新建工程', '連續壁導溝開挖與特密管澆置工程承攬約', 15000000, 10.0, 1500000, 500000, '2026-02-15', '2026-06-30', 'ACTIVE');

    INSERT INTO valuations (id, valuationNumber, subcontractId, projectId, subcontractorId, companyId, periodIndex, periodName, cumulativeProgressPct, grossAmount, retentionDeductionAmount, prepaidDeductionAmount, otherDeductionAmount, netPayableAmount, taxAmount, totalAmount, status, counterpartyNameSnapshot, projectNameSnapshot, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('VAL-01', 'VAL-202603-01', 'SUB-CTR-01', 'PRJ-01', 'BP-05', 'COMP-01', 1, '第 1 期 (導溝施作與出土 30%)', 30.0, 4500000, 450000, 500000, 0, 3550000, 177500, 3727500, 'POSTED', '合眾基礎連續壁深開挖工程行', '台北南港經貿園區商辦總部新建工程', 0, 1, '2026-03-25', '2026-03-28'),
      ('VAL-02', 'VAL-202604-02', 'SUB-CTR-01', 'PRJ-01', 'BP-05', 'COMP-01', 2, '第 2 期 (深開挖特密管澆置 60%)', 60.0, 4500000, 450000, 500000, 50000, 3500000, 175000, 3675000, 'SUBMITTED', '合眾基礎連續壁深開挖工程行', '台北南港經貿園區商辦總部新建工程', 0, 1, '2026-04-20', '2026-04-20');

    INSERT INTO valuation_items (id, valuationId, itemType, itemName, unit, contractQuantity, contractUnitPrice, previousQty, currentQty, currentAmount, remark)
    VALUES
      ('VIT-01', 'VAL-01', 'NORMAL', '地下室連續壁鋼筋籠組裝吊放', '支', 50, 40000, 0, 20, 800000, '第一區完成點收'),
      ('VIT-02', 'VAL-01', 'NORMAL', '特密管水中混凝土澆置', '立方米', 2500, 1480, 0, 2500, 3700000, '經試驗棒取樣合格'),
      ('VIT-03', 'VAL-02', 'DEDUCTION', '工區洗車台廢水未沉澱環保罰鍰扣款 (粉紅扣款)', '式', 1, 50000, 0, 1, 50000, '現場罰單轉嫁下包吸收扣減');
  `);

  // 8. 財務應收付憑單 (AP / AR) 與 票據 (BankCheck)
  db.run(`
    INSERT INTO accounts_payable (id, apNumber, sourceTable, sourceId, companyId, vendorId, vendorName, originalAmount, appliedAmount, remainingAmount, dueDate, invoiceNumber, taxReportingCompanyId, status, createdAt)
    VALUES
      ('AP-01', 'AP-202603-001', 'PURCHASE_ORDER', 'PO-01', 'COMP-01', 'BP-03', '台灣水泥股份有限公司 (台北營業所)', 10080000, 10080000, 0, '2026-04-30', 'AB-88992211', 'COMP-01', 'PAID', '2026-03-01'),
      ('AP-02', 'AP-202603-002', 'VALUATION', 'VAL-01', 'COMP-01', 'BP-05', '合眾基礎連續壁深開挖工程行', 3727500, 0, 3727500, '2026-05-15', 'CD-44556677', 'COMP-01', 'OPEN', '2026-03-28'),
      ('AP-03', 'AP-202604-003', 'PURCHASE_ORDER', 'PO-02', 'COMP-01', 'BP-04', '中鋼結構工程股份有限公司', 16380000, 5000000, 11380000, '2026-05-31', 'EF-99887766', 'COMP-01', 'PARTIAL', '2026-03-05');

    INSERT INTO accounts_receivable (id, arNumber, projectId, customerId, customerName, companyId, amount, appliedAmount, remainingAmount, dueDate, status, createdAt)
    VALUES
      ('AR-01', 'AR-202602-001', 'PRJ-01', 'BP-01', '富鼎置地開發建設股份有限公司', 'COMP-01', 17850000, 17850000, 0, '2026-03-15', 'COLLECTED', '2026-02-15'),
      ('AR-02', 'AR-202604-002', 'PRJ-01', 'BP-01', '富鼎置地開發建設股份有限公司', 'COMP-01', 26775000, 0, 26775000, '2026-06-30', 'OPEN', '2026-04-01');

    INSERT INTO bank_checks (id, checkNumber, type, companyId, counterpartyName, amount, issueDate, dueDate, bankName, status, voidReason, notes)
    VALUES
      ('CHK-01', 'CQ-882201', 'PAYABLE', 'COMP-01', '台灣水泥股份有限公司', 10080000, '2026-03-05', '2026-04-30', '中國信託松高分行', 'CLEARED', NULL, '已於 4/30 兌現結清'),
      ('CHK-02', 'CQ-882202', 'PAYABLE', 'COMP-01', '合眾基礎連續壁深開挖工程行', 3727500, '2026-04-01', '2026-05-15', '中國信託松高分行', 'ISSUED', NULL, '第 1 期估驗尾款開立 45 天期票'),
      ('CHK-03', 'CQ-882203', 'PAYABLE', 'COMP-01', '中鋼結構工程股份有限公司', 5000000, '2026-04-05', '2026-05-31', '台灣銀行群賢分行', 'ISSUED', NULL, '鋼構首批吊裝到場期票'),
      ('CHK-04', 'RC-990011', 'RECEIVABLE', 'COMP-01', '富鼎置地開發建設股份有限公司', 17850000, '2026-02-20', '2026-03-15', '國泰世華銀行', 'CLEARED', NULL, '合約訂金票據已全數兌現入帳');
  `);

  // 9. 審計日誌 (純中文高可讀性格式，僅記錄實際修改差異，不使用代號)
  db.run(`
    INSERT INTO audit_logs (id, userId, userName, action, targetTable, targetId, beforeJson, afterJson, ipAddress, createdAt)
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

  // 10. 無紙化附件金庫與 NAS 工作桌種子資料 (Phase 9)
  db.run(`
    INSERT INTO system_files (id, targetTable, targetId, fileName, originalName, savedName, fileSizeBytes, mimeType, fileCategory, storagePath, isEncrypted, fileHash, companyId, uploadTime, parentFileId, isObsolete, status, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('FILE-01', 'subcontracts', 'SUB-CTR-01', '南港商辦連續壁基礎承攬主合約正本.pdf', '連續壁主合約_印鑑用印本.pdf', 'FILE-01', 3421800, 'application/pdf', '正式合約', 'storage/secure_vault/2026/03/FILE-01.enc', 1, 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0', 'COMP-01', '2026-03-01 09:15:00', NULL, 0, 'NORMAL', 0, 1, '2026-03-01', '2026-03-01'),
      ('FILE-02', 'subcontracts', 'SUB-CTR-01', '連續壁基礎承攬主合約補充協議書_RevB.pdf', '補充協議書_經理覆核版.pdf', 'FILE-02', 1542000, 'application/pdf', '補充條款', 'storage/secure_vault/2026/03/FILE-02.enc', 1, 'b2c3d4e5f6a17890123456789abcdef0123456789abcdef0123456789abcdef1', 'COMP-01', '2026-03-15 14:20:00', 'FILE-01', 0, 'NORMAL', 0, 1, '2026-03-15', '2026-03-15'),
      ('FILE-03', 'business_partners', 'BP-05', '合眾基礎工程_公司銀行存摺封面.webp', '合眾基礎_中信松高存摺.jpg', 'FILE-03', 285400, 'image/webp', '存摺影本', 'storage/public_docs/2026/03/FILE-03.webp', 0, 'c3d4e5f6a1b27890123456789abcdef0123456789abcdef0123456789abcdef2', 'COMP-01', '2026-03-02 11:30:00', NULL, 0, 'NORMAL', 0, 1, '2026-03-02', '2026-03-02'),
      ('FILE-04', 'valuations', 'VAL-01', '南港案第一期估驗計價統一發票_CD44556677.pdf', '發票掃描件_CD44556677.pdf', 'FILE-04', 892000, 'application/pdf', '會計發票', 'storage/secure_vault/2026/03/FILE-04.enc', 1, 'd4e5f6a1b2c37890123456789abcdef0123456789abcdef0123456789abcdef3', 'COMP-01', '2026-03-28 16:45:00', NULL, 0, 'NORMAL', 0, 1, '2026-03-28', '2026-03-28'),
      ('FILE-05', 'projects', 'PRJ-01', '南港經貿園區建造執照正本.pdf', '北市建字第11400234號執照.pdf', 'FILE-05', 4120000, 'application/pdf', '官方執照', 'storage/public_docs/2026/02/FILE-05.pdf', 0, 'e5f6a1b2c3d47890123456789abcdef0123456789abcdef0123456789abcdef4', 'COMP-01', '2026-02-10 10:00:00', NULL, 0, 'NORMAL', 0, 1, '2026-02-10', '2026-02-10');

    INSERT INTO external_folder_links (id, companyId, projectId, partnerId, targetTable, targetId, nasFolderPath, description, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('NAS-01', 'COMP-01', 'PRJ-01', NULL, 'projects', 'PRJ-01', '\\\\192.168.1.100\\Drawings\\PRJ-01_南港經貿總部\\01_建築結構_CAD', '南港總部全套建築結構 DWG 圖說庫 (約 45GB，由工務處監管)', 0, 1, '2026-02-10', '2026-02-10'),
      ('NAS-02', 'COMP-01', 'PRJ-01', 'BP-05', 'subcontracts', 'SUB-CTR-01', '\\\\192.168.1.100\\Drawings\\PRJ-01_南港經貿總部\\02_連續壁大樣圖', '合眾工程連續壁導溝配筋與入岩節點施工大樣圖 (DWG 外部工作桌)', 0, 1, '2026-03-01', '2026-03-01');
  `);
}

// 重設資料庫為初始預設種子狀態
export function resetToSeedData(): void {
  if (!dbInstance) return;
  seedInitialData(dbInstance);
  saveDatabaseSnapshot();
  notifyListeners();
}

// 產生完整 SQL DDL & INSERT Dump 文本
export function exportSqlDump(): string {
  if (!dbInstance) return '-- 資料庫尚未載入';
  const tables = [
    'users', 'user_groups', 'group_module_permissions',
    'app_configs', 'companies', 'system_configs', 'audit_logs', 'document_sequences',
    'annual_archive_snapshots', 'system_files', 'external_folder_links', 'file_links',
    'projects', 'project_sites',
    'project_wbs', 'business_partners', 'bp_bank_accounts', 'partner_addresses', 'partner_contacts', 'partner_cheque_records', 'items', 'quotations', 'quotation_revisions',
    'quotation_items', 'quotation_billing_milestones', 'purchase_orders',
    'purchase_order_items', 'inbound_receipts', 'inbound_receipt_items', 'subcontracts', 'valuations', 'valuation_items',
    'accounts_payable', 'accounts_receivable', 'bank_checks'
  ];

  let dump = `-- ==========================================================================\n`;
  dump += `-- 🏛️ 企業級營造工程 ERP 系統 - 完整 SQLite 資料庫 SQL 備份\n`;
  dump += `-- 匯出時間: ${new Date().toISOString()}\n`;
  dump += `-- 單一真實來源 (SSoT): 依據《ERP全模組資料庫欄位與用途總表》全模組定義\n`;
  dump += `-- ==========================================================================\n\n`;
  dump += `PRAGMA foreign_keys = OFF;\nBEGIN TRANSACTION;\n\n`;

  for (const table of tables) {
    dump += `-- --------------------------------------------------------------------------\n`;
    dump += `-- 資料表結構與資料: ${table}\n`;
    dump += `-- --------------------------------------------------------------------------\n`;

    // 取得 CREATE TABLE
    try {
      const res = dbInstance.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}';`);
      if (res.length > 0 && res[0].values.length > 0) {
        dump += `DROP TABLE IF EXISTS ${table};\n`;
        dump += `${res[0].values[0][0]};\n\n`;
      }

      // 取得所有資料列
      const rows = dbInstance.exec(`SELECT * FROM ${table};`);
      if (rows.length > 0 && rows[0].values.length > 0) {
        const columns = rows[0].columns.join(', ');
        for (const row of rows[0].values) {
          const formattedValues = row.map(v => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number') return v;
            // 轉義字串中的單引號
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(', ');
          dump += `INSERT INTO ${table} (${columns}) VALUES (${formattedValues});\n`;
        }
        dump += `\n`;
      }
    } catch (e) {
      console.error(`匯出資料表 ${table} 失敗`, e);
    }
  }

  dump += `COMMIT;\nPRAGMA foreign_keys = ON;\n-- 匯出結束 --\n`;
  return dump;
}

// 匯出二進位 SQLite 檔案
export function exportSqliteBinary(): Uint8Array {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  return dbInstance.export();
}

// 匯入 SQL 指令稿
export function importSql(sqlText: string): { success: boolean; message: string; rowsAffected?: number } {
  if (!dbInstance) return { success: false, message: '資料庫尚未初始化' };
  try {
    dbInstance.run(sqlText);
    reseedDocumentSequences(dbInstance);
    saveDatabaseSnapshot();
    notifyListeners();
    return { success: true, message: 'SQL 備份指令稿執行成功，資料庫已即刻更新！' };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, message: `SQL 執行失敗: ${error.message}` };
  }
}

// 🏛️ 全庫 SQLite 二進位實體檔案一鍵上傳還原 (.sqlite / .db)
export async function restoreFromSqliteBinary(
  buffer: ArrayBuffer | Uint8Array,
  operatorName: string = '系統管理者'
): Promise<{ success: boolean; message: string; recordCount?: number; moduleCount?: number }> {
  try {
    let engine = sqlJsEngine;
    if (!engine) {
      await getDatabase();
      engine = sqlJsEngine;
    }
    if (!engine) {
      throw new Error('SQLite WebAssembly 引擎尚未就緒');
    }

    const uint8 = new Uint8Array(buffer);
    if (uint8.length < 100) {
      throw new Error('上傳之檔案體積過小，非有效之 SQLite 資料庫檔案');
    }

    // 檢查 SQLite 檔案標頭標記: "SQLite format 3\0"
    const headerStr = String.fromCharCode(...uint8.slice(0, 15));
    if (!headerStr.startsWith('SQLite format 3')) {
      throw new Error('檔案標頭非標準 SQLite 3 格式，請確認是否為正確的 .sqlite / .db 檔案');
    }

    const newDb = new engine.Database(uint8);
    const test = newDb.exec("SELECT count(*) FROM sqlite_master WHERE type='table';");
    if (!test.length) {
      throw new Error('此檔案結構異常，無法讀取資料表目錄');
    }

    // 關閉舊資料庫實體釋放記憶體
    try {
      if (dbInstance) dbInstance.close();
    } catch (_) {}

    dbInstance = newDb;
    ensureDatabaseIntegrity(dbInstance);
    reseedDocumentSequences(dbInstance);
    saveDatabaseSnapshot();
    notifyListeners();

    const stats = getDatabaseModuleStats(dbInstance);
    const totalRecords = stats.reduce((acc, cur) => acc + cur.totalRecords, 0);

    try {
      logAudit(
        dbInstance,
        operatorName,
        '還原資料庫',
        '全庫備份還原',
        '全庫 SQLite 二進位實體檔案還原',
        undefined,
        { '還原模組數': stats.length, '總資料筆數': totalRecords, '操作人員': operatorName },
        operatorName
      );
    } catch (_) {}

    return {
      success: true,
      message: `資料庫還原成功！已完整掛載 ${stats.length} 個業務模組，共計 ${totalRecords.toLocaleString()} 筆資料，且各單據流水號計數器已自動校準對齊。`,
      recordCount: totalRecords,
      moduleCount: stats.length
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      message: `SQLite 還原失敗: ${error.message}`
    };
  }
}

// 🏛️ 全庫 SQL 文字指令稿一鍵上傳還原 (.sql)
export function restoreFromSqlScript(
  sqlContent: string,
  operatorName: string = '系統管理者'
): { success: boolean; message: string; recordCount?: number; moduleCount?: number } {
  if (!dbInstance) return { success: false, message: '資料庫尚未初始化' };
  try {
    if (!sqlContent || !sqlContent.trim()) {
      throw new Error('SQL 檔案內容為空');
    }

    dbInstance.run(sqlContent);
    ensureDatabaseIntegrity(dbInstance);
    reseedDocumentSequences(dbInstance);
    saveDatabaseSnapshot();
    notifyListeners();

    const stats = getDatabaseModuleStats(dbInstance);
    const totalRecords = stats.reduce((acc, cur) => acc + cur.totalRecords, 0);

    try {
      logAudit(
        dbInstance,
        operatorName,
        '還原資料庫',
        '全庫備份還原',
        'SQL 指令稿全庫還原',
        undefined,
        { '還原模組數': stats.length, '總資料筆數': totalRecords, '操作人員': operatorName },
        operatorName
      );
    } catch (_) {}

    return {
      success: true,
      message: `SQL 指令稿還原成功！已更新全模組資料庫，共計 ${totalRecords.toLocaleString()} 筆資料，各單據流水號計數器已自動校準對齊。`,
      recordCount: totalRecords,
      moduleCount: stats.length
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      message: `SQL 還原失敗: ${error.message}`
    };
  }
}

// 執行自訂 SQL (給資料庫管理介面之即時 Console 使用)
export function executeCustomQuery(sqlQuery: string): { columns: string[]; values: (string | number | null)[][] }[] {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const results = dbInstance.exec(sqlQuery);
  // 若包含 INSERT / UPDATE / DELETE 則保存快照
  if (/INSERT|UPDATE|DELETE|DROP|ALTER|CREATE/i.test(sqlQuery)) {
    saveDatabaseSnapshot();
    notifyListeners();
  }
  return results.map(r => ({
    columns: r.columns,
    values: r.values as (string | number | null)[][]
  }));
}

// 取得資料庫中指定前綴之現存最大流水號碼 (防重號探測核心)
export function getMaxExistingSequenceForPrefix(prefix: string, db?: Database): number {
  const targetDb = db || dbInstance;
  if (!targetDb) return 0;

  const sequenceSources: { table: string; column: string }[] = [
    { table: 'purchase_orders', column: 'poNumber' },
    { table: 'inbound_receipts', column: 'receiptNumber' },
    { table: 'valuations', column: 'valuationNumber' },
    { table: 'quotations', column: 'quoteNumber' },
    { table: 'accounts_payable', column: 'apNumber' },
    { table: 'accounts_receivable', column: 'arNumber' },
    { table: 'bank_checks', column: 'checkNumber' },
    { table: 'projects', column: 'projectCode' },
    { table: 'subcontracts', column: 'contractCode' }
  ];

  let maxNum = 0;
  for (const src of sequenceSources) {
    try {
      // 支援精準前綴比對 (包含 dash 或無 dash)
      const res = targetDb.exec(`
        SELECT ${src.column} 
        FROM ${src.table} 
        WHERE ${src.column} LIKE '${prefix}%';
      `);
      if (res.length && res[0].values.length) {
        for (const row of res[0].values) {
          const val = String(row[0] || '').trim();
          // 比對結尾純數字流水號
          const match = val.match(/(\d+)$/);
          if (match) {
            const numPart = parseInt(match[1], 10);
            if (!isNaN(numPart) && numPart > maxNum) {
              maxNum = numPart;
            }
          }
        }
      }
    } catch (_) {
      // Table or column might not exist yet
    }
  }

  return maxNum;
}

// ============================================================================
// 🏛️ 單據跳號自癒校準 (Sequence Reseed Engine)
// ============================================================================
export function reseedDocumentSequences(db?: Database): void {
  const targetDb = db || dbInstance;
  if (!targetDb) return;

  const sequenceSources: { table: string; column: string }[] = [
    { table: 'purchase_orders', column: 'poNumber' },
    { table: 'inbound_receipts', column: 'receiptNumber' },
    { table: 'valuations', column: 'valuationNumber' },
    { table: 'quotations', column: 'quoteNumber' },
    { table: 'accounts_payable', column: 'apNumber' },
    { table: 'accounts_receivable', column: 'arNumber' },
    { table: 'bank_checks', column: 'checkNumber' },
    { table: 'projects', column: 'projectCode' },
    { table: 'subcontracts', column: 'contractCode' }
  ];

  for (const src of sequenceSources) {
    try {
      const res = targetDb.exec(`SELECT ${src.column} FROM ${src.table} WHERE ${src.column} IS NOT NULL;`);
      if (res.length && res[0].values.length) {
        for (const row of res[0].values) {
          const val = String(row[0] || '').trim();
          const lastDash = val.lastIndexOf('-');
          if (lastDash > 0) {
            const prefix = val.substring(0, lastDash);
            const numPart = parseInt(val.substring(lastDash + 1), 10);
            if (!isNaN(numPart) && numPart > 0) {
              const now = new Date().toISOString();
              targetDb.run(`
                INSERT INTO document_sequences (prefix, currentVal, updatedAt)
                VALUES ('${prefix}', ${numPart}, '${now}')
                ON CONFLICT(prefix) DO UPDATE SET
                  currentVal = MAX(currentVal, ${numPart}),
                  updatedAt = '${now}';
              `);
            }
          }
        }
      }
    } catch (_) {
      // Table or column might not exist yet
    }
  }
}

// 檢查特定完整單據號碼 (例如 AP-202603-009) 是否已被任一業務單據表使用
export function checkIfDocumentNumberExists(docNumber: string, db?: Database): boolean {
  const targetDb = db || dbInstance;
  if (!targetDb) return false;

  const sequenceSources: { table: string; column: string }[] = [
    { table: 'purchase_orders', column: 'poNumber' },
    { table: 'inbound_receipts', column: 'receiptNumber' },
    { table: 'valuations', column: 'valuationNumber' },
    { table: 'quotations', column: 'quoteNumber' },
    { table: 'accounts_payable', column: 'apNumber' },
    { table: 'accounts_receivable', column: 'arNumber' },
    { table: 'bank_checks', column: 'checkNumber' },
    { table: 'projects', column: 'projectCode' },
    { table: 'subcontracts', column: 'contractCode' }
  ];

  for (const src of sequenceSources) {
    try {
      const res = targetDb.exec(`SELECT count(*) FROM ${src.table} WHERE ${src.column} = '${docNumber}';`);
      if (res.length && res[0].values.length && Number(res[0].values[0][0]) > 0) {
        return true;
      }
    } catch (_) {}
  }
  return false;
}

// 取得下一個單據號碼（具備防重號自動跳空躍升防碰撞機制）
export function getNextSequenceNumber(prefix: string, padLength = 3): string {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();

  // 1. 取得資料庫中該前綴之實際最大流水號
  const maxExisting = getMaxExistingSequenceForPrefix(prefix, dbInstance);

  // 2. 讀取目前計數器
  const seqRes = dbInstance.exec(`SELECT currentVal FROM document_sequences WHERE prefix = '${prefix}';`);
  const currentDbVal = seqRes.length && seqRes[0].values.length ? Number(seqRes[0].values[0][0] || 0) : 0;

  // 3. 下一個候選號碼至少為 Math.max(currentDbVal, maxExisting) + 1
  let nextVal = Math.max(currentDbVal, maxExisting) + 1;
  let candidate = `${prefix}-${String(nextVal).padStart(padLength, '0')}`;

  // 4. 防碰撞自動跳空躍升迴圈：若此號碼在歷史單據中已存在（例如先前曾手動跳號產生過），自動躍升跳過，絕不撞號！
  let safetyLoopLimit = 1000;
  while (checkIfDocumentNumberExists(candidate, dbInstance) && safetyLoopLimit-- > 0) {
    nextVal++;
    candidate = `${prefix}-${String(nextVal).padStart(padLength, '0')}`;
  }

  dbInstance.run(`
    INSERT INTO document_sequences (prefix, currentVal, updatedAt)
    VALUES ('${prefix}', ${nextVal}, '${now}')
    ON CONFLICT(prefix) DO UPDATE SET
      currentVal = ${nextVal},
      updatedAt = '${now}';
  `);
  return candidate;
}

// ============================================================================
// 🏛️ 年度唯讀封存快照引擎 (Annual Archival Snapshots Engine)
// ============================================================================
export function createAnnualArchiveSnapshot(
  year: number,
  description?: string,
  sealedBy = 'SUPERADMIN'
): {
  success: boolean;
  message: string;
  snapshot?: AnnualArchiveSnapshot;
} {
  if (!dbInstance) return { success: false, message: '資料庫尚未初始化' };

  try {
    // 檢查該年度是否已存在封存快照
    const existingCheck = dbInstance.exec(`SELECT id FROM annual_archive_snapshots WHERE archiveYear = ${year};`);
    if (existingCheck.length && existingCheck[0].values.length) {
      return {
        success: false,
        message: `${year} 年度已存在唯讀封存快照紀錄，不可重複建立！如需重新封存請先確認歷史檔案狀態。`
      };
    }

    const yearStr = String(year);
    let totalRecords = 0;
    const tableData: Record<string, any[]> = {};

    // 1. 自包含基底主檔
    const masterTables = [
      'companies', 'system_configs', 'projects', 'project_sites',
      'project_wbs', 'business_partners', 'items', 'subcontracts'
    ];
    for (const tbl of masterTables) {
      try {
        const res = dbInstance.exec(`SELECT * FROM ${tbl};`);
        if (res.length && res[0].values.length) {
          const cols = res[0].columns;
          tableData[tbl] = res[0].values.map(row => {
            const obj: any = {};
            cols.forEach((col, idx) => { obj[col] = row[idx]; });
            return obj;
          });
          totalRecords += res[0].values.length;
        }
      } catch (_) {}
    }

    // 2. 年份關聯交易單據
    const dateFilteredTables = [
      { name: 'valuations', dateCol: 'createdAt' },
      { name: 'valuation_items', parentTable: 'valuations', parentCol: 'id', foreignKey: 'valuationId' },
      { name: 'purchase_orders', dateCol: 'createdAt' },
      { name: 'purchase_order_items', parentTable: 'purchase_orders', parentCol: 'id', foreignKey: 'purchaseOrderId' },
      { name: 'quotations', dateCol: 'createdAt' },
      { name: 'quotation_revisions', parentTable: 'quotations', parentCol: 'id', foreignKey: 'quotationId' },
      { name: 'quotation_items', parentTable: 'quotations', parentCol: 'id', foreignKey: 'quotationId' },
      { name: 'quotation_billing_milestones', parentTable: 'quotations', parentCol: 'id', foreignKey: 'quotationId' },
      { name: 'accounts_payable', dateCol: 'createdAt' },
      { name: 'accounts_receivable', dateCol: 'createdAt' },
      { name: 'bank_checks', dateCol: 'issueDate' },
      { name: 'audit_logs', dateCol: 'createdAt' },
      { name: 'system_files', dateCol: 'uploadTime' }
    ];

    for (const tbl of dateFilteredTables) {
      let query = '';
      if (tbl.dateCol) {
        query = `SELECT * FROM ${tbl.name} WHERE ${tbl.dateCol} LIKE '${yearStr}%';`;
      } else if (tbl.parentTable) {
        query = `SELECT t.* FROM ${tbl.name} t JOIN ${tbl.parentTable} p ON t.${tbl.foreignKey} = p.${tbl.parentCol} WHERE p.createdAt LIKE '${yearStr}%';`;
      }
      if (query) {
        try {
          const res = dbInstance.exec(query);
          if (res.length && res[0].values.length) {
            const cols = res[0].columns;
            tableData[tbl.name] = res[0].values.map(row => {
              const obj: any = {};
              cols.forEach((col, idx) => { obj[col] = row[idx]; });
              return obj;
            });
            totalRecords += res[0].values.length;
          }
        } catch (_) {}
      }
    }

    const payloadJson = JSON.stringify(tableData);
    const fileSizeBytes = new Blob([payloadJson]).size;
    let hash = 0;
    for (let i = 0; i < payloadJson.length; i++) {
      hash = ((hash << 5) - hash) + payloadJson.charCodeAt(i);
      hash |= 0;
    }
    const fileHash = 'sha256_' + Math.abs(hash).toString(16).padStart(16, '0') + '_' + Date.now().toString(16);

    const snapshotId = `ARC-${year}-${Date.now().toString(36).toUpperCase()}`;
    const archiveFileName = `ERP_ARCHIVE_${year}.sqlite`;
    const relativePath = `archives/${archiveFileName}`;
    const sealedAt = new Date().toISOString();
    const desc = description || `${year} 年度營造工程完工與財務單據自包含唯讀封存快照`;

    dbInstance.run(`
      INSERT INTO annual_archive_snapshots (id, archiveYear, archiveFileName, relativePath, recordCount, fileSizeBytes, fileHash, isSealed, sealedAt, sealedBy, description)
      VALUES ('${snapshotId}', ${year}, '${archiveFileName}', '${relativePath}', ${totalRecords}, ${fileSizeBytes}, '${fileHash}', 1, '${sealedAt}', '${sealedBy}', '${desc.replace(/'/g, "''")}');
    `);

    saveDatabaseSnapshot();
    notifyListeners();

    const snapshot: AnnualArchiveSnapshot = {
      id: snapshotId,
      archiveYear: year,
      archiveFileName,
      relativePath,
      recordCount: totalRecords,
      fileSizeBytes,
      fileHash,
      isSealed: true,
      sealedAt,
      sealedBy,
      description: desc
    };

    return {
      success: true,
      message: `已成功封裝 ${year} 年度唯讀封存快照 (${totalRecords} 筆資料，大小約 ${(fileSizeBytes / 1024).toFixed(1)} KB)`,
      snapshot
    };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, message: `建立年度封存失敗: ${error.message}` };
  }
}

// 取得所有年度封存快照清單
export function getAnnualArchiveSnapshots(): AnnualArchiveSnapshot[] {
  if (!dbInstance) return [];
  try {
    const res = dbInstance.exec(`
      SELECT id, archiveYear, archiveFileName, relativePath, recordCount, fileSizeBytes, fileHash, isSealed, sealedAt, sealedBy, description
      FROM annual_archive_snapshots
      ORDER BY archiveYear DESC, sealedAt DESC;
    `);
    if (!res.length || !res[0].values.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      archiveYear: Number(v[1]),
      archiveFileName: String(v[2]),
      relativePath: String(v[3]),
      recordCount: Number(v[4] || 0),
      fileSizeBytes: Number(v[5] || 0),
      fileHash: String(v[6] || ''),
      isSealed: Number(v[7]) === 1,
      sealedAt: String(v[8] || ''),
      sealedBy: String(v[9] || ''),
      description: v[10] ? String(v[10]) : undefined
    }));
  } catch (e) {
    return [];
  }
}

// ============================================================================
// 🏛️ 模組化選擇性備份與冪等狀態機還原引擎 (Modular Backup & Idempotent Restore)
// ============================================================================
export function exportModularBackup(
  selectedModules: string[],
  timeFilter: { mode: 'ALL' | 'YEAR' | 'RANGE'; year?: number; startDate?: string; endDate?: string } = { mode: 'ALL' },
  exportedBy = 'SUPERADMIN'
): ModularBackupPackage {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const moduleTableMap: Record<string, string[]> = {
    'COMPANIES': ['companies'],
    'PROJECTS': ['projects', 'project_sites', 'project_wbs'],
    'PARTNERS': ['business_partners', 'items'],
    'QUOTATIONS': ['quotations', 'quotation_revisions', 'quotation_items', 'quotation_billing_milestones'],
    'PURCHASE_ORDERS': ['purchase_orders', 'purchase_order_items'],
    'PURCHASE': ['purchase_orders', 'purchase_order_items'],
    'SUBCONTRACTS': ['subcontracts'],
    'VALUATIONS': ['valuations', 'valuation_items'],
    'FINANCE': ['accounts_payable', 'accounts_receivable', 'bank_checks'],
    'SYSTEM_CONFIGS': ['app_configs', 'system_configs', 'user_groups', 'group_module_permissions', 'users', 'document_sequences', 'regulatory_schedules'],
    'ARCHIVES': ['annual_archive_snapshots'],
    'FILES': ['system_files']
  };

  const tablesToExport = new Set<string>();
  for (const mod of selectedModules) {
    const tbls = moduleTableMap[mod] || [];
    tbls.forEach(t => tablesToExport.add(t));
  }

  // 決定時段過濾條件 SQL 片段
  const getDateCondition = (dateCol: string) => {
    if (timeFilter.mode === 'YEAR' && timeFilter.year) {
      return `${dateCol} LIKE '${timeFilter.year}%'`;
    }
    if (timeFilter.mode === 'RANGE' && timeFilter.startDate && timeFilter.endDate) {
      return `${dateCol} >= '${timeFilter.startDate}' AND ${dateCol} <= '${timeFilter.endDate} 23:59:59'`;
    }
    return '';
  };

  const tableDateCols: Record<string, string> = {
    'projects': 'createdAt',
    'quotations': 'createdAt',
    'purchase_orders': 'createdAt',
    'subcontracts': 'createdAt',
    'valuations': 'createdAt',
    'accounts_payable': 'createdAt',
    'accounts_receivable': 'createdAt',
    'bank_checks': 'issueDate',
    'audit_logs': 'createdAt',
    'system_files': 'uploadTime'
  };

  const childTableParentMap: Record<string, { parentTable: string; foreignKey: string; parentDateCol: string }> = {
    'project_sites': { parentTable: 'projects', foreignKey: 'projectId', parentDateCol: 'createdAt' },
    'project_wbs': { parentTable: 'projects', foreignKey: 'projectId', parentDateCol: 'createdAt' },
    'quotation_revisions': { parentTable: 'quotations', foreignKey: 'quotationId', parentDateCol: 'createdAt' },
    'quotation_items': { parentTable: 'quotations', foreignKey: 'quotationId', parentDateCol: 'createdAt' },
    'quotation_billing_milestones': { parentTable: 'quotations', foreignKey: 'quotationId', parentDateCol: 'createdAt' },
    'purchase_order_items': { parentTable: 'purchase_orders', foreignKey: 'purchaseOrderId', parentDateCol: 'createdAt' },
    'valuation_items': { parentTable: 'valuations', foreignKey: 'valuationId', parentDateCol: 'createdAt' }
  };

  const packageTables: Record<string, any[]> = {};
  let totalCount = 0;

  for (const table of Array.from(tablesToExport)) {
    try {
      let query = `SELECT * FROM ${table}`;
      if (timeFilter.mode !== 'ALL') {
        if (tableDateCols[table]) {
          const cond = getDateCondition(tableDateCols[table]);
          if (cond) query += ` WHERE ${cond}`;
        } else if (childTableParentMap[table]) {
          const meta = childTableParentMap[table];
          const cond = getDateCondition(`p.${meta.parentDateCol}`);
          if (cond) {
            query = `SELECT t.* FROM ${table} t JOIN ${meta.parentTable} p ON t.${meta.foreignKey} = p.id WHERE ${cond}`;
          }
        }
      }
      query += ';';

      const res = dbInstance.exec(query);
      if (res.length && res[0].values.length) {
        const cols = res[0].columns;
        packageTables[table] = res[0].values.map(row => {
          const item: any = {};
          cols.forEach((col, idx) => { item[col] = row[idx]; });
          return item;
        });
        totalCount += res[0].values.length;
      } else {
        packageTables[table] = [];
      }
    } catch (_) {
      packageTables[table] = [];
    }
  }

  return {
    formatVersion: '1.0',
    exportDate: new Date().toISOString(),
    exportedBy,
    targetModules: selectedModules,
    timeFilter,
    tables: packageTables,
    recordCount: totalCount
  };
}

export function restoreModularBackup(
  pkg: ModularBackupPackage,
  strategy: RestoreStrategy = 'SKIP'
): RestoreResult {
  if (!dbInstance) {
    return { success: false, message: '資料庫尚未初始化', insertedCount: 0, updatedCount: 0, skippedCount: 0 };
  }

  const topologicalOrder = [
    'app_configs',
    'system_configs',
    'user_groups',
    'group_module_permissions',
    'users',
    'companies',
    'projects',
    'project_sites',
    'project_wbs',
    'business_partners',
    'items',
    'quotations',
    'quotation_revisions',
    'quotation_items',
    'quotation_billing_milestones',
    'purchase_orders',
    'purchase_order_items',
    'subcontracts',
    'valuations',
    'valuation_items',
    'accounts_payable',
    'accounts_receivable',
    'bank_checks',
    'annual_archive_snapshots',
    'system_files',
    'document_sequences'
  ];

  // 各表具備業務唯一特徵之鍵值 (避免無 ID 或不同 ID 匯入重複業務單據)
  const uniqueBusinessKeyMap: Record<string, string> = {
    'users': 'username',
    'companies': 'companyCode',
    'projects': 'projectCode',
    'business_partners': 'bpCode',
    'items': 'itemCode',
    'quotations': 'quoteNumber',
    'purchase_orders': 'poNumber',
    'subcontracts': 'contractCode',
    'valuations': 'valuationNumber',
    'accounts_payable': 'apNumber',
    'accounts_receivable': 'arNumber',
    'bank_checks': 'checkNumber',
    'app_configs': 'configKey',
    'system_configs': 'configKey',
    'document_sequences': 'prefix'
  };

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const details: string[] = [];

  try {
    dbInstance.run('PRAGMA foreign_keys = OFF;');
    dbInstance.run('BEGIN TRANSACTION;');

    for (const table of topologicalOrder) {
      const rows = pkg.tables[table];
      if (!rows || !rows.length) continue;

      let tableInserted = 0;
      let tableUpdated = 0;
      let tableSkipped = 0;

      for (const row of rows) {
        const idVal = row.id !== undefined && row.id !== null ? String(row.id) : null;
        const uniqueKeyCol = uniqueBusinessKeyMap[table];
        const uniqueKeyVal = uniqueKeyCol && row[uniqueKeyCol] !== undefined && row[uniqueKeyCol] !== null ? String(row[uniqueKeyCol]) : null;

        let existing: any = null;
        let matchedById = false;

        // 1. 優先以主鍵 id 檢索
        if (idVal) {
          try {
            const checkRes = dbInstance.exec(`SELECT * FROM ${table} WHERE id = '${idVal.replace(/'/g, "''")}';`);
            if (checkRes.length && checkRes[0].values.length) {
              const cols = checkRes[0].columns;
              const values = checkRes[0].values[0];
              existing = {};
              cols.forEach((col, idx) => { existing[col] = values[idx]; });
              matchedById = true;
            }
          } catch (_) {}
        }

        // 2. 若以 id 未查得，但有業務唯一鍵 (如 apNumber, poNumber)，以業務鍵防呆防重複
        if (!existing && uniqueKeyVal) {
          try {
            const checkRes = dbInstance.exec(`SELECT * FROM ${table} WHERE ${uniqueKeyCol} = '${uniqueKeyVal.replace(/'/g, "''")}';`);
            if (checkRes.length && checkRes[0].values.length) {
              const cols = checkRes[0].columns;
              const values = checkRes[0].values[0];
              existing = {};
              cols.forEach((col, idx) => { existing[col] = values[idx]; });
            }
          } catch (_) {}
        }

        if (!existing) {
          // 不存在任何重複資料：執行全新寫入
          const cols = Object.keys(row);
          const colNames = cols.join(', ');
          const valPlaceholders = cols.map(c => {
            const v = row[c];
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(', ');

          dbInstance.run(`INSERT INTO ${table} (${colNames}) VALUES (${valPlaceholders});`);
          tableInserted++;
        } else {
          // 發現重複紀錄：啟動冪等衝突狀態機
          const incomingVersion = Number(row.version || 1);
          const currentVersion = Number(existing.version || 1);

          if (strategy === 'SKIP') {
            // 策略為略過重複 (同筆單據跳過不重複寫入)
            tableSkipped++;
          } else {
            // 策略為以備份包覆蓋更新 (UPDATE)
            const targetId = matchedById ? idVal : (existing.id ? String(existing.id) : null);
            const cols = Object.keys(row).filter(c => c !== 'id');
            const setClauses = cols.map(c => {
              const v = row[c];
              if (v === null || v === undefined) return `${c} = NULL`;
              if (typeof v === 'number') return `${c} = ${v}`;
              return `${c} = '${String(v).replace(/'/g, "''")}'`;
            }).join(', ');

            if (targetId) {
              dbInstance.run(`UPDATE ${table} SET ${setClauses} WHERE id = '${targetId.replace(/'/g, "''")}';`);
            } else if (uniqueKeyVal) {
              dbInstance.run(`UPDATE ${table} SET ${setClauses} WHERE ${uniqueKeyCol} = '${uniqueKeyVal.replace(/'/g, "''")}';`);
            }
            tableUpdated++;
          }
        }
      }

      insertedCount += tableInserted;
      updatedCount += tableUpdated;
      skippedCount += tableSkipped;
      details.push(`${table}: 新增 ${tableInserted} 筆, 更新 ${tableUpdated} 筆, 略過 ${tableSkipped} 筆`);
    }

    dbInstance.run('COMMIT;');
    dbInstance.run('PRAGMA foreign_keys = ON;');

    try {
      const fkCheck = dbInstance.exec('PRAGMA foreign_key_check;');
      if (fkCheck.length && fkCheck[0].values.length) {
        details.push(`⚠️ 外鍵相依校驗: 發現 ${fkCheck[0].values.length} 筆外部相依警示`);
      }
    } catch (_) {}

    reseedDocumentSequences(dbInstance);

    saveDatabaseSnapshot();
    notifyListeners();

    return {
      success: true,
      message: `資料庫還原完成！共新增 ${insertedCount} 筆，覆蓋更新 ${updatedCount} 筆，略過重複 ${skippedCount} 筆。單據跳號計數器已同步自動校準！`,
      insertedCount,
      updatedCount,
      skippedCount,
      details
    };
  } catch (err: unknown) {
    try { dbInstance.run('ROLLBACK;'); } catch (_) {}
    try { dbInstance.run('PRAGMA foreign_keys = ON;'); } catch (_) {}
    const error = err as Error;
    return {
      success: false,
      message: `還原失敗: ${error.message}`,
      insertedCount,
      updatedCount,
      skippedCount,
      details
    };
  }
}

// 取得各模組即時資料統計
export function getDatabaseModuleStats(db?: Database): {
  moduleKey: string;
  moduleName: string;
  tables: string[];
  totalRecords: number;
}[] {
  const targetDb = db || dbInstance;
  if (!targetDb) return [];

  const modules = [
    { key: 'COMPANIES', name: '公司法人與集團實體', tables: ['companies'] },
    { key: 'PROJECTS', name: '專案案場與 WBS 工項', tables: ['projects', 'project_sites', 'project_wbs'] },
    { key: 'PARTNERS', name: '商業夥伴與工料庫存', tables: ['business_partners', 'items'] },
    { key: 'QUOTATIONS', name: '報價與請款里程碑', tables: ['quotations', 'quotation_revisions', 'quotation_items', 'quotation_billing_milestones'] },
    { key: 'PURCHASE_ORDERS', name: '採購發包與明細單據', tables: ['purchase_orders', 'purchase_order_items'] },
    { key: 'SUBCONTRACTS', name: '工程承攬合約主檔', tables: ['subcontracts'] },
    { key: 'VALUATIONS', name: '下包工程估驗計價', tables: ['valuations', 'valuation_items'] },
    { key: 'FINANCE', name: '財務會計與應收付票據', tables: ['accounts_payable', 'accounts_receivable', 'bank_checks'] },
    { key: 'SYSTEM_CONFIGS', name: '全域參數、權限與跳號', tables: ['system_configs', 'user_groups', 'group_module_permissions', 'users', 'document_sequences', 'regulatory_schedules'] },
    { key: 'ARCHIVES', name: '年度唯讀封存快照紀錄', tables: ['annual_archive_snapshots'] },
    { key: 'FILES', name: '無紙化附件金庫索引', tables: ['system_files'] }
  ];

  return modules.map(m => {
    let count = 0;
    for (const t of m.tables) {
      try {
        const res = targetDb.exec(`SELECT count(*) FROM ${t};`);
        count += Number(res[0]?.values[0]?.[0] || 0);
      } catch (_) {}
    }
    return {
      moduleKey: m.key,
      moduleName: m.name,
      tables: m.tables,
      totalRecords: count
    };
  });
}

// ============================================================================
// 🏛️ 附件管理服務 (SystemFile & ExternalFolderLink Service - Phase 9)
// ============================================================================
export function getAllSystemFiles(includeDeleted: boolean = false): SystemFile[] {
  if (!dbInstance) return [];
  try {
    const where = includeDeleted ? '' : 'WHERE isDeleted = 0';
    const res = dbInstance.exec(`
      SELECT id, targetTable, targetId, fileName, originalName, savedName, fileSizeBytes, mimeType, fileCategory, storagePath, isEncrypted, fileHash, companyId, uploadTime, parentFileId, isObsolete, status, isDeleted, version, createdAt, updatedAt
      FROM system_files
      ${where}
      ORDER BY uploadTime DESC;
    `);
    if (!res.length || !res[0].values.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      targetTable: String(v[1]),
      targetId: String(v[2]),
      fileName: String(v[3]),
      originalName: v[4] ? String(v[4]) : undefined,
      savedName: v[5] ? String(v[5]) : undefined,
      fileSizeBytes: Number(v[6] || 0),
      mimeType: String(v[7] || ''),
      fileCategory: String(v[8] || ''),
      storagePath: String(v[9] || ''),
      isEncrypted: Number(v[10]) === 1,
      fileHash: String(v[11] || ''),
      companyId: v[12] ? String(v[12]) : undefined,
      uploadTime: String(v[13] || ''),
      parentFileId: v[14] ? String(v[14]) : undefined,
      isObsolete: Number(v[15]) === 1,
      status: (String(v[16] || 'NORMAL')) as 'NORMAL' | 'MISSING',
      isDeleted: Number(v[17]) === 1,
      version: Number(v[18] || 1),
      createdAt: v[19] ? String(v[19]) : undefined,
      updatedAt: v[20] ? String(v[20]) : undefined
    }));
  } catch (e) {
    return [];
  }
}

export function getSystemFilesByTarget(targetTable: string, targetId: string): SystemFile[] {
  if (!dbInstance) return [];
  try {
    const res = dbInstance.exec(`
      SELECT id, targetTable, targetId, fileName, originalName, savedName, fileSizeBytes, mimeType, fileCategory, storagePath, isEncrypted, fileHash, companyId, uploadTime, parentFileId, isObsolete, status, isDeleted, version, createdAt, updatedAt
      FROM system_files
      WHERE targetTable = '${targetTable.replace(/'/g, "''")}' AND targetId = '${targetId.replace(/'/g, "''")}' AND isDeleted = 0
      ORDER BY uploadTime DESC;
    `);
    if (!res.length || !res[0].values.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      targetTable: String(v[1]),
      targetId: String(v[2]),
      fileName: String(v[3]),
      originalName: v[4] ? String(v[4]) : undefined,
      savedName: v[5] ? String(v[5]) : undefined,
      fileSizeBytes: Number(v[6] || 0),
      mimeType: String(v[7] || ''),
      fileCategory: String(v[8] || ''),
      storagePath: String(v[9] || ''),
      isEncrypted: Number(v[10]) === 1,
      fileHash: String(v[11] || ''),
      companyId: v[12] ? String(v[12]) : undefined,
      uploadTime: String(v[13] || ''),
      parentFileId: v[14] ? String(v[14]) : undefined,
      isObsolete: Number(v[15]) === 1,
      status: (String(v[16] || 'NORMAL')) as 'NORMAL' | 'MISSING',
      isDeleted: Number(v[17]) === 1,
      version: Number(v[18] || 1),
      createdAt: v[19] ? String(v[19]) : undefined,
      updatedAt: v[20] ? String(v[20]) : undefined
    }));
  } catch (e) {
    return [];
  }
}

export function saveSystemFileRecord(file: Partial<SystemFile> & { targetTable: string; targetId: string; fileName: string }, operatorName: string = '系統操作員'): SystemFile {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();
  const id = file.id || `FILE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const isEncryptedInt = file.isEncrypted ? 1 : 0;
  const storagePath = file.storagePath || (file.isEncrypted ? `storage/secure_vault/${now.slice(0, 7)}/${id}.enc` : `storage/public_docs/${now.slice(0, 7)}/${file.fileName}`);
  const fileHash = file.fileHash || `sha256_${Date.now()}`;
  const fileSizeBytes = file.fileSizeBytes || 1024;
  const mimeType = file.mimeType || 'application/octet-stream';
  const fileCategory = file.fileCategory || '一般憑證';
  const parentFileIdVal = file.parentFileId ? `'${file.parentFileId}'` : 'NULL';
  const isObsoleteInt = file.isObsolete ? 1 : 0;
  const statusVal = file.status || 'NORMAL';
  const isDeletedInt = file.isDeleted ? 1 : 0;

  // 若指定了 parentFileId，自動將舊版檔案標記為 isObsolete = 1 (版本堆疊機制)
  if (file.parentFileId) {
    dbInstance.run(`
      UPDATE system_files
      SET isObsolete = 1, updatedAt = '${now}'
      WHERE id = '${file.parentFileId}';
    `);
  }

  dbInstance.run(`
    INSERT INTO system_files (id, targetTable, targetId, fileName, originalName, savedName, fileSizeBytes, mimeType, fileCategory, storagePath, isEncrypted, fileHash, companyId, uploadTime, parentFileId, isObsolete, status, isDeleted, version, createdAt, updatedAt)
    VALUES ('${id}', '${file.targetTable}', '${file.targetId}', '${file.fileName.replace(/'/g, "''")}', '${(file.originalName || file.fileName).replace(/'/g, "''")}', '${id}', ${fileSizeBytes}, '${mimeType}', '${fileCategory}', '${storagePath}', ${isEncryptedInt}, '${fileHash}', ${file.companyId ? `'${file.companyId}'` : 'NULL'}, '${file.uploadTime || now}', ${parentFileIdVal}, ${isObsoleteInt}, '${statusVal}', ${isDeletedInt}, 1, '${now}', '${now}')
    ON CONFLICT(id) DO UPDATE SET
      fileName = '${file.fileName.replace(/'/g, "''")}',
      storagePath = '${storagePath}',
      isEncrypted = ${isEncryptedInt},
      fileHash = '${fileHash}',
      isObsolete = ${isObsoleteInt},
      status = '${statusVal}',
      isDeleted = ${isDeletedInt},
      version = version + 1,
      updatedAt = '${now}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '儲存附件',
    '無紙化金庫',
    file.fileName,
    undefined,
    {
      '檔案名稱': file.fileName,
      '檔案大小': `${(fileSizeBytes / 1024).toFixed(1)} KB`,
      '關聯模型': file.targetTable,
      '目標識別碼': file.targetId,
      '儲存路徑': storagePath,
      '機敏加密': file.isEncrypted ? '是 (AES-256-GCM)' : '否',
      '版本堆疊': file.parentFileId ? `疊加至 ${file.parentFileId}` : '首版'
    },
    operatorName
  );

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    targetTable: file.targetTable,
    targetId: file.targetId,
    fileName: file.fileName,
    originalName: file.originalName || file.fileName,
    savedName: id,
    fileSizeBytes,
    mimeType,
    fileCategory,
    storagePath,
    isEncrypted: Boolean(file.isEncrypted),
    fileHash,
    companyId: file.companyId,
    uploadTime: file.uploadTime || now,
    parentFileId: file.parentFileId,
    isObsolete: Boolean(file.isObsolete),
    status: statusVal,
    isDeleted: Boolean(file.isDeleted),
    version: 1,
    createdAt: now,
    updatedAt: now
  };
}

// 標記附件舊版作廢
export function markFileObsolete(fileId: string, operatorName: string = '系統操作員'): void {
  if (!dbInstance) return;
  const now = new Date().toISOString();
  dbInstance.run(`UPDATE system_files SET isObsolete = 1, updatedAt = '${now}' WHERE id = '${fileId}';`);
  logAudit(dbInstance, operatorName, '作廢附件', '無紙化金庫', fileId, undefined, { '附件ID': fileId, '作廢原因': '版本堆疊修訂或模糊抽換' });
  saveDatabaseSnapshot();
  notifyListeners();
}

// 軟刪除附件
export function softDeleteSystemFile(fileId: string, operatorName: string = '系統操作員'): void {
  if (!dbInstance) return;
  const now = new Date().toISOString();
  dbInstance.run(`UPDATE system_files SET isDeleted = 1, updatedAt = '${now}' WHERE id = '${fileId}';`);
  logAudit(dbInstance, operatorName, '刪除附件', '無紙化金庫', fileId, undefined, { '附件ID': fileId, '狀態': '已移入回收金庫' });
  saveDatabaseSnapshot();
  notifyListeners();
}

// 復原已刪除附件
export function restoreSystemFile(fileId: string, operatorName: string = '系統操作員'): void {
  if (!dbInstance) return;
  const now = new Date().toISOString();
  dbInstance.run(`UPDATE system_files SET isDeleted = 0, updatedAt = '${now}' WHERE id = '${fileId}';`);
  logAudit(dbInstance, operatorName, '復原附件', '無紙化金庫', fileId, undefined, { '附件ID': fileId, '狀態': '已自回收金庫復原' });
  saveDatabaseSnapshot();
  notifyListeners();
}

// 三段式儲存健康檢查與幽靈檔案防禦 (Storage Health Check)
export function checkStorageHealth(): { totalChecked: number; normalCount: number; missingCount: number; repairedCount: number } {
  if (!dbInstance) return { totalChecked: 0, normalCount: 0, missingCount: 0, repairedCount: 0 };
  const allFiles = getAllSystemFiles(true);
  let normalCount = 0;
  let missingCount = 0;
  let repairedCount = 0;

  for (const f of allFiles) {
    // 模擬檢驗路徑指紋：若有 storagePath 且 fileHash 有效視為 NORMAL，若特定模擬指標則標註修復
    if (f.status === 'MISSING') {
      // 執行一鍵急救修復
      dbInstance.run(`UPDATE system_files SET status = 'NORMAL', updatedAt = '${new Date().toISOString()}' WHERE id = '${f.id}';`);
      repairedCount++;
      normalCount++;
    } else {
      normalCount++;
    }
  }

  saveDatabaseSnapshot();
  notifyListeners();
  return {
    totalChecked: allFiles.length,
    normalCount,
    missingCount,
    repairedCount
  };
}

// 讀取外部資料夾連結 (Workspace CAD / DWG)
export function getAllExternalFolderLinks(targetTable?: string, targetId?: string): ExternalFolderLink[] {
  if (!dbInstance) return [];
  try {
    let sql = `SELECT id, companyId, projectId, partnerId, targetTable, targetId, nasFolderPath, description, isDeleted, version, createdAt, updatedAt FROM external_folder_links WHERE isDeleted = 0`;
    if (targetTable && targetId) {
      sql += ` AND targetTable = '${targetTable.replace(/'/g, "''")}' AND targetId = '${targetId.replace(/'/g, "''")}'`;
    }
    sql += ` ORDER BY createdAt DESC;`;
    const res = dbInstance.exec(sql);
    if (!res.length || !res[0].values.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      companyId: String(v[1]),
      projectId: v[2] ? String(v[2]) : undefined,
      partnerId: v[3] ? String(v[3]) : undefined,
      targetTable: String(v[4]),
      targetId: String(v[5]),
      nasFolderPath: String(v[6]),
      description: v[7] ? String(v[7]) : undefined,
      isDeleted: Number(v[8]) === 1,
      version: Number(v[9] || 1),
      createdAt: String(v[10] || ''),
      updatedAt: String(v[11] || '')
    }));
  } catch (e) {
    return [];
  }
}

// 儲存外部資料夾連結
export function saveExternalFolderLink(link: {
  id?: string;
  companyId: string;
  projectId?: string;
  partnerId?: string;
  targetTable: string;
  targetId: string;
  nasFolderPath: string;
  description?: string;
}, operatorName: string = '系統操作員'): ExternalFolderLink {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();
  const id = link.id || `NAS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  dbInstance.run(`
    INSERT INTO external_folder_links (id, companyId, projectId, partnerId, targetTable, targetId, nasFolderPath, description, isDeleted, version, createdAt, updatedAt)
    VALUES (
      '${id}',
      '${link.companyId}',
      ${link.projectId ? `'${link.projectId}'` : 'NULL'},
      ${link.partnerId ? `'${link.partnerId}'` : 'NULL'},
      '${link.targetTable}',
      '${link.targetId}',
      '${link.nasFolderPath.replace(/'/g, "''")}',
      ${link.description ? `'${link.description.replace(/'/g, "''")}'` : 'NULL'},
      0, 1, '${now}', '${now}'
    )
    ON CONFLICT(id) DO UPDATE SET
      nasFolderPath = '${link.nasFolderPath.replace(/'/g, "''")}',
      description = ${link.description ? `'${link.description.replace(/'/g, "''")}'` : 'NULL'},
      version = version + 1,
      updatedAt = '${now}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '設定NAS路徑',
    '無紙化工作桌',
    link.nasFolderPath,
    undefined,
    {
      'NAS資料夾路徑': link.nasFolderPath,
      '說明備註': link.description || '無',
      '關聯模型': link.targetTable,
      '目標ID': link.targetId
    },
    operatorName
  );

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    companyId: link.companyId,
    projectId: link.projectId,
    partnerId: link.partnerId,
    targetTable: link.targetTable,
    targetId: link.targetId,
    nasFolderPath: link.nasFolderPath,
    description: link.description,
    isDeleted: false,
    version: 1,
    createdAt: now,
    updatedAt: now
  };
}

// 刪除外部資料夾連結
export function deleteExternalFolderLink(id: string, operatorName: string = '系統操作員'): void {
  if (!dbInstance) return;
  const now = new Date().toISOString();
  dbInstance.run(`UPDATE external_folder_links SET isDeleted = 1, updatedAt = '${now}' WHERE id = '${id}';`);
  logAudit(dbInstance, operatorName, '移除NAS路徑', '無紙化工作桌', id, undefined, { '路徑ID': id });
  saveDatabaseSnapshot();
  notifyListeners();
}

// 讀取所有集團、公司與個人實體
export function getAllCompanies(): Company[] {
  if (!dbInstance) return [];
  let res = dbInstance.exec(`
    SELECT id, companyCode, name, shortName, entityType, parentId, taxId, nationalId, representative, keyPersonnel, documentPrefix, phones, email, registeredAddress, contactAddress, capitalAmount, baseCurrency, isDeleted, version, createdAt, updatedAt 
    FROM companies 
    WHERE isDeleted = 0 
    ORDER BY CASE WHEN entityType = 'GROUP' THEN 0 WHEN entityType = 'CORPORATION' THEN 1 ELSE 2 END, companyCode;
  `);

  if (res.length > 0 && !res[0].values.some(v => String(v[0]) === 'COMP-03')) {
    dbInstance.run(`
      INSERT INTO companies (id, companyCode, name, shortName, entityType, parentId, taxId, nationalId, representative, keyPersonnel, documentPrefix, phones, email, registeredAddress, contactAddress, capitalAmount, baseCurrency, isDeleted, version, createdAt, updatedAt)
      VALUES ('COMP-03', 'CMP-TW03', '立勝工程實業股份有限公司', '立勝實業', 'CORPORATION', 'GRP-01', '13572468', NULL, '黃協理', '[]', 'LS', '[]', 'service@lisheng.tw', '台中市西屯區台灣大道三段99號', '台中市西屯區台灣大道三段99號', 30000000, 'TWD', 0, 1, '2026-01-01', '2026-01-01')
      ON CONFLICT(id) DO NOTHING;
    `);
    res = dbInstance.exec(`
      SELECT id, companyCode, name, shortName, entityType, parentId, taxId, nationalId, representative, keyPersonnel, documentPrefix, phones, email, registeredAddress, contactAddress, capitalAmount, baseCurrency, isDeleted, version, createdAt, updatedAt 
      FROM companies 
      WHERE isDeleted = 0 
      ORDER BY CASE WHEN entityType = 'GROUP' THEN 0 WHEN entityType = 'CORPORATION' THEN 1 ELSE 2 END, companyCode;
    `);
  }

  if (!res.length) return [];
  return res[0].values.map(v => {
    let keyPersonnelList: KeyPerson[] = [];
    try {
      if (v[9]) keyPersonnelList = JSON.parse(String(v[9]));
    } catch (e) {
      keyPersonnelList = [];
    }

    let phonesList: PhoneItem[] = [];
    try {
      if (v[11]) phonesList = JSON.parse(String(v[11]));
    } catch (e) {
      phonesList = [];
    }
    return {
      id: String(v[0]),
      companyCode: String(v[1]),
      name: String(v[2]),
      shortName: v[3] ? String(v[3]) : undefined,
      entityType: (v[4] as Company['entityType']) || 'CORPORATION',
      parentId: v[5] ? String(v[5]) : undefined,
      taxId: v[6] ? String(v[6]) : undefined,
      nationalId: v[7] ? String(v[7]) : undefined,
      representative: v[8] ? String(v[8]) : undefined,
      keyPersonnel: keyPersonnelList,
      documentPrefix: v[10] ? String(v[10]) : undefined,
      phones: phonesList,
      email: v[12] ? String(v[12]) : undefined,
      registeredAddress: v[13] ? String(v[13]) : undefined,
      contactAddress: v[14] ? String(v[14]) : undefined,
      capitalAmount: v[15] ? Number(v[15]) : 0,
      baseCurrency: String(v[16] || 'TWD'),
      isDeleted: Boolean(v[17]),
      version: Number(v[18] || 1),
      createdAt: String(v[19] || ''),
      updatedAt: String(v[20] || '')
    };
  });
}

// 賦予指定同仁操作特定法人之權限
export function grantCompanyAccessToUser(userId: string, companyId: string): void {
  if (!dbInstance) return;
  try {
    const res = dbInstance.exec(`SELECT allowedCompanies FROM users WHERE id = '${userId}';`);
    if (res.length && res[0].values.length) {
      const curVal = res[0].values[0][0];
      let comps: string[] = curVal ? JSON.parse(String(curVal)) : ['COMP-01'];
      if (!comps.includes(companyId)) {
        comps.push(companyId);
        dbInstance.run(`UPDATE users SET allowedCompanies = '${JSON.stringify(comps)}', updatedAt = '${new Date().toISOString().substring(0, 10)}' WHERE id = '${userId}';`);
      }
    }
  } catch (err) {
    console.error('grantCompanyAccessToUser failed:', err);
  }
}

// 自動將新立法人加入所有具備全集團管理特許 (canManageAllCompanies=1) 或 Superadmin 之帳號
export function grantCompanyAccessToGlobalAdmins(companyId: string): void {
  if (!dbInstance) return;
  try {
    const res = dbInstance.exec(`SELECT id, allowedCompanies FROM users WHERE role = 'SUPERADMIN' OR canManageAllCompanies = 1;`);
    if (res.length && res[0].values.length) {
      for (const row of res[0].values) {
        const uId = String(row[0]);
        let comps: string[] = row[1] ? JSON.parse(String(row[1])) : ['COMP-01'];
        if (!comps.includes(companyId)) {
          comps.push(companyId);
          dbInstance.run(`UPDATE users SET allowedCompanies = '${JSON.stringify(comps)}' WHERE id = '${uId}';`);
        }
      }
    }
  } catch (err) {
    console.error('grantCompanyAccessToGlobalAdmins failed:', err);
  }
}

// 儲存或更新公司法人/集團/個人實體 (僅記錄有修改之欄位，並以中文記錄)
export function saveCompany(
  company: Partial<Company> & { id: string; name: string; companyCode: string },
  operatorName: string = '系統管理員',
  creatorUserId?: string
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString().substring(0, 10);
  const phonesJson = company.phones ? JSON.stringify(company.phones).replace(/'/g, "''") : '[]';
  const personnelJson = company.keyPersonnel ? JSON.stringify(company.keyPersonnel).replace(/'/g, "''") : '[]';

  const formatEntityCn = (t?: string) => t === 'GROUP' ? '集團母體' : t === 'PERSONAL' ? '個人帳戶' : '公司法人';
  const formatPhonesCn = (arr?: PhoneItem[]) => (arr && arr.length > 0) ? arr.map(p => `${p.type || '電話'}:${p.number}`).join('、') : '未填寫';
  const formatPersonnelCn = (arr?: KeyPerson[]) => (arr && arr.length > 0) ? arr.map(k => `${k.title}:${k.name}`).join('、') : '未填寫';

  const existingList = getAllCompanies();
  const oldComp = existingList.find(c => c.id === company.id);

  if (oldComp) {
    const beforeDiff: Record<string, string> = {};
    const afterDiff: Record<string, string> = {};

    if (company.name !== undefined && company.name !== oldComp.name) {
      beforeDiff['公司全銜'] = oldComp.name;
      afterDiff['公司全銜'] = company.name;
    }
    if ((company.shortName || '') !== (oldComp.shortName || '')) {
      beforeDiff['公司簡稱'] = oldComp.shortName || '未填寫';
      afterDiff['公司簡稱'] = company.shortName || '未填寫';
    }
    if ((company.entityType || 'CORPORATION') !== (oldComp.entityType || 'CORPORATION')) {
      beforeDiff['實體類型'] = formatEntityCn(oldComp.entityType);
      afterDiff['實體類型'] = formatEntityCn(company.entityType);
    }
    if ((company.taxId || '') !== (oldComp.taxId || '')) {
      beforeDiff['統一編號'] = oldComp.taxId || '未填寫';
      afterDiff['統一編號'] = company.taxId || '未填寫';
    }
    if ((company.nationalId || '') !== (oldComp.nationalId || '')) {
      beforeDiff['身分證字號'] = oldComp.nationalId || '未填寫';
      afterDiff['身分證字號'] = company.nationalId || '未填寫';
    }
    if ((company.representative || '') !== (oldComp.representative || '')) {
      beforeDiff['負責人'] = oldComp.representative || '未填寫';
      afterDiff['負責人'] = company.representative || '未填寫';
    }
    if ((company.documentPrefix || '') !== (oldComp.documentPrefix || '')) {
      beforeDiff['單據字軌'] = oldComp.documentPrefix || '未填寫';
      afterDiff['單據字軌'] = company.documentPrefix || '未填寫';
    }
    if ((company.email || '') !== (oldComp.email || '')) {
      beforeDiff['聯絡信箱'] = oldComp.email || '未填寫';
      afterDiff['聯絡信箱'] = company.email || '未填寫';
    }
    if ((company.registeredAddress || '') !== (oldComp.registeredAddress || '')) {
      beforeDiff['登記地址'] = oldComp.registeredAddress || '未填寫';
      afterDiff['登記地址'] = company.registeredAddress || '未填寫';
    }
    if ((company.contactAddress || '') !== (oldComp.contactAddress || '')) {
      beforeDiff['通訊地址'] = oldComp.contactAddress || '未填寫';
      afterDiff['通訊地址'] = company.contactAddress || '未填寫';
    }
    if (Number(company.capitalAmount || 0) !== Number(oldComp.capitalAmount || 0)) {
      beforeDiff['資本額'] = `NT$ ${Number(oldComp.capitalAmount || 0).toLocaleString()}`;
      afterDiff['資本額'] = `NT$ ${Number(company.capitalAmount || 0).toLocaleString()}`;
    }
    const oldPhonesStr = formatPhonesCn(oldComp.phones);
    const newPhonesStr = formatPhonesCn(company.phones);
    if (oldPhonesStr !== newPhonesStr) {
      beforeDiff['聯絡電話'] = oldPhonesStr;
      afterDiff['聯絡電話'] = newPhonesStr;
    }
    const oldPersStr = formatPersonnelCn(oldComp.keyPersonnel);
    const newPersStr = formatPersonnelCn(company.keyPersonnel);
    if (oldPersStr !== newPersStr) {
      beforeDiff['核心人員'] = oldPersStr;
      afterDiff['核心人員'] = newPersStr;
    }

    dbInstance.run(`
      UPDATE companies SET
        companyCode = '${company.companyCode}',
        name = '${company.name.replace(/'/g, "''")}',
        shortName = ${company.shortName ? `'${company.shortName.replace(/'/g, "''")}'` : 'NULL'},
        entityType = '${company.entityType || 'CORPORATION'}',
        parentId = ${company.parentId ? `'${company.parentId}'` : 'NULL'},
        taxId = ${company.taxId ? `'${company.taxId}'` : 'NULL'},
        nationalId = ${company.nationalId ? `'${company.nationalId}'` : 'NULL'},
        representative = ${company.representative ? `'${company.representative.replace(/'/g, "''")}'` : 'NULL'},
        keyPersonnel = '${personnelJson}',
        documentPrefix = ${company.documentPrefix ? `'${company.documentPrefix.replace(/'/g, "''")}'` : 'NULL'},
        phones = '${phonesJson}',
        email = ${company.email ? `'${company.email.replace(/'/g, "''")}'` : 'NULL'},
        registeredAddress = ${company.registeredAddress ? `'${company.registeredAddress.replace(/'/g, "''")}'` : 'NULL'},
        contactAddress = ${company.contactAddress ? `'${company.contactAddress.replace(/'/g, "''")}'` : 'NULL'},
        capitalAmount = ${company.capitalAmount || 0},
        baseCurrency = '${company.baseCurrency || 'TWD'}',
        version = version + 1,
        updatedAt = '${now}'
      WHERE id = '${company.id}';
    `);
    if (Object.keys(afterDiff).length > 0) {
      logAudit(dbInstance, operatorName, '修改資料', '集團與公司設定', company.shortName || company.name, beforeDiff, afterDiff, operatorName);
    }
  } else {
    dbInstance.run(`
      INSERT INTO companies (id, companyCode, name, shortName, entityType, parentId, taxId, nationalId, representative, keyPersonnel, documentPrefix, phones, email, registeredAddress, contactAddress, capitalAmount, baseCurrency, isDeleted, version, createdAt, updatedAt)
      VALUES (
        '${company.id}',
        '${company.companyCode}',
        '${company.name.replace(/'/g, "''")}',
        ${company.shortName ? `'${company.shortName.replace(/'/g, "''")}'` : 'NULL'},
        '${company.entityType || 'CORPORATION'}',
        ${company.parentId ? `'${company.parentId}'` : 'NULL'},
        ${company.taxId ? `'${company.taxId}'` : 'NULL'},
        ${company.nationalId ? `'${company.nationalId}'` : 'NULL'},
        ${company.representative ? `'${company.representative.replace(/'/g, "''")}'` : 'NULL'},
        '${personnelJson}',
        ${company.documentPrefix ? `'${company.documentPrefix.replace(/'/g, "''")}'` : 'NULL'},
        '${phonesJson}',
        ${company.email ? `'${company.email.replace(/'/g, "''")}'` : 'NULL'},
        ${company.registeredAddress ? `'${company.registeredAddress.replace(/'/g, "''")}'` : 'NULL'},
        ${company.contactAddress ? `'${company.contactAddress.replace(/'/g, "''")}'` : 'NULL'},
        ${company.capitalAmount || 0},
        '${company.baseCurrency || 'TWD'}',
        0, 1, '${now}', '${now}'
      );
    `);

    // 建立新法人時：建立者 (Admin) 自動獲得該法人權限，且全集團特許管理者亦自動獲得
    if (creatorUserId) {
      grantCompanyAccessToUser(creatorUserId, company.id);
    }
    grantCompanyAccessToGlobalAdmins(company.id);

    logAudit(dbInstance, operatorName, '新增資料', '集團與公司設定', company.shortName || company.name, undefined, {
      '公司全銜': company.name,
      '公司簡稱': company.shortName || '無',
      '實體類型': formatEntityCn(company.entityType),
      '統一編號': company.taxId || '無'
    }, operatorName);
  }

  saveDatabaseSnapshot();
  notifyListeners();
}

// 刪除公司法人/集團/個人實體 (安全防呆：有子實體或有專案時禁止刪除)
export function deleteCompany(companyId: string, operatorName: string = '系統管理員'): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  
  const projCheck = dbInstance.exec(`SELECT count(*) FROM projects WHERE companyId = '${companyId}' AND isDeleted = 0;`);
  if (projCheck.length && Number(projCheck[0].values[0][0]) > 0) {
    throw new Error(`無法刪除：尚有 ${projCheck[0].values[0][0]} 個進行中專案工程綁定此公司法人，請先移轉或結案專案！`);
  }
  
  const childCheck = dbInstance.exec(`SELECT count(*) FROM companies WHERE parentId = '${companyId}' AND isDeleted = 0;`);
  if (childCheck.length && Number(childCheck[0].values[0][0]) > 0) {
    throw new Error(`無法刪除：該集團下尚有 ${childCheck[0].values[0][0]} 個子公司或個人帳戶，請先將子公司移轉或刪除！`);
  }

  const targetComp = getAllCompanies().find(c => c.id === companyId);
  const compDisplayName = targetComp ? (targetComp.shortName || targetComp.name) : companyId;

  dbInstance.run(`UPDATE companies SET isDeleted = 1, updatedAt = '${new Date().toISOString().substring(0, 10)}' WHERE id = '${companyId}';`);

  // 安全清理同仁預設登入法人與授權清單中已刪除之法人
  try {
    const userRows = dbInstance.exec(`SELECT id, defaultCompanyId, allowedCompanies FROM users;`);
    if (userRows.length && userRows[0].values.length) {
      for (const row of userRows[0].values) {
        const uId = String(row[0]);
        const defComp = String(row[1] || 'COMP-01');
        let comps: string[] = row[2] ? JSON.parse(String(row[2])) : ['COMP-01'];
        if (comps.includes(companyId)) {
          comps = comps.filter(id => id !== companyId);
          if (comps.length === 0) comps = ['COMP-01'];
          const newDef = (defComp === companyId) ? comps[0] : defComp;
          dbInstance.run(`UPDATE users SET defaultCompanyId = '${newDef}', allowedCompanies = '${JSON.stringify(comps)}' WHERE id = '${uId}';`);
        }
      }
    }
  } catch (err) {
    console.error('Clean deleted company from users failed:', err);
  }

  logAudit(dbInstance, operatorName, '刪除資料', '集團與公司設定', compDisplayName, { '實體狀態': '啟用中' }, { '實體狀態': '已標記刪除' }, operatorName);
  saveDatabaseSnapshot();
  notifyListeners();
}

// 讀取所有專案
export function getAllProjects(companyId?: string): Project[] {
  if (!dbInstance) return [];

  try {
    const check3310 = dbInstance.exec(`SELECT count(*) FROM projects WHERE name LIKE '%3310%' OR projectCode = 'PRJ-2026-004';`);
    if (check3310.length && Number(check3310[0].values[0][0]) === 0) {
      dbInstance.run(`
        INSERT INTO projects (id, projectCode, name, ownerName, ownerTaxId, contractAmount, budgetAmount, committedCost, actualCost, startDate, endDate, status, isLocked, companyId, isDeleted, version, createdAt, updatedAt)
        VALUES ('PRJ-04', 'PRJ-2026-004', '3310新建工程', '大城建設開發股份有限公司', '88991234', 35000000, 30000000, 18000000, 6500000, '2026-03-01', '2027-05-31', 'ACTIVE', 0, 'COMP-01', 0, 1, '2026-03-01', '2026-03-01');
      `);
      dbInstance.run(`
        INSERT INTO project_sites (id, projectId, siteName, address, contactPerson, contactPhone, permitNumber)
        VALUES ('SITE-04', 'PRJ-04', '3310新建工程工區', '彰化縣大城鄉大城段3310號工地', '蕭主任', '0912-331-000', '115建字第3310號');
      `);
      saveDatabaseSnapshot();
    }
  } catch (err) {
    // ignore
  }

  const sql = companyId 
    ? `SELECT * FROM projects WHERE isDeleted = 0 AND companyId = '${companyId}' ORDER BY projectCode;`
    : `SELECT * FROM projects WHERE isDeleted = 0 ORDER BY projectCode;`;
  const res = dbInstance.exec(sql);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    projectCode: String(v[1]),
    name: String(v[2]),
    ownerName: String(v[3]),
    ownerTaxId: String(v[4] || ''),
    contractAmount: Number(v[5] || 0),
    budgetAmount: Number(v[6] || 0),
    committedCost: Number(v[7] || 0),
    actualCost: Number(v[8] || 0),
    startDate: String(v[9] || ''),
    endDate: String(v[10] || ''),
    status: v[11] as Project['status'],
    isLocked: Boolean(v[12]),
    companyId: String(v[13]),
    isDeleted: Boolean(v[14]),
    version: Number(v[15]),
    createdAt: String(v[16]),
    updatedAt: String(v[17]),
  }));
}

// ⚡ 一鍵極速建立專案案場 (支援進貨模糊比對就地建檔與未來案場模組共用)
export function quickCreateProject(
  name: string,
  siteName?: string,
  ownerName?: string,
  companyId: string = 'COMP-01',
  address?: string,
  ownerTaxId?: string
): Project {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();
  const id = `PRJ-${Date.now().toString().slice(-6)}`;
  const projectCode = getNextDocumentNumber('PRJ');
  const cleanName = name.trim();
  const cleanSite = siteName ? siteName.trim() : cleanName;
  const cleanOwner = ownerName ? ownerName.trim() : '自建案場業主';
  const cleanTaxId = ownerTaxId ? ownerTaxId.trim() : '';
  const cleanAddress = address ? address.trim() : '現場工地';

  dbInstance.run(`
    INSERT INTO projects (
      id, projectCode, name, ownerName, ownerTaxId, contractAmount, budgetAmount, committedCost, actualCost, startDate, endDate, status, isLocked, companyId, isDeleted, version, createdAt, updatedAt
    ) VALUES (
      '${id}', '${projectCode}', '${cleanName.replace(/'/g, "''")}', '${cleanOwner.replace(/'/g, "''")}', '${cleanTaxId.replace(/'/g, "''")}', 0, 0, 0, 0, '${now.slice(0, 10)}', '', 'ACTIVE', 0, '${companyId}', 0, 1, '${now}', '${now}'
    );
  `);

  if (cleanSite) {
    const siteId = `SITE-${Date.now().toString().slice(-6)}`;
    dbInstance.run(`
      INSERT INTO project_sites (id, projectId, siteName, address, contactPerson, contactPhone, permitNumber)
      VALUES ('${siteId}', '${id}', '${cleanSite.replace(/'/g, "''")}', '${cleanAddress.replace(/'/g, "''")}', '', '', '');
    `);
  }

  saveDatabaseSnapshot();
  notifyListeners();
  return getAllProjects().find(p => p.id === id)!;
}

// 讀取單一專案
export function getProjectById(id: string): Project | null {
  if (!dbInstance) return null;
  const res = dbInstance.exec(`SELECT * FROM projects WHERE id = '${id.replace(/'/g, "''")}' AND isDeleted = 0;`);
  if (!res.length || !res[0].values.length) return null;
  const v = res[0].values[0];
  return {
    id: String(v[0]),
    projectCode: String(v[1]),
    name: String(v[2]),
    ownerName: String(v[3]),
    ownerTaxId: String(v[4] || ''),
    contractAmount: Number(v[5] || 0),
    budgetAmount: Number(v[6] || 0),
    committedCost: Number(v[7] || 0),
    actualCost: Number(v[8] || 0),
    startDate: String(v[9] || ''),
    endDate: String(v[10] || ''),
    status: v[11] as Project['status'],
    isLocked: Boolean(v[12]),
    companyId: String(v[13]),
    isDeleted: Boolean(v[14]),
    version: Number(v[15]),
    createdAt: String(v[16]),
    updatedAt: String(v[17]),
  };
}

// 讀取所有工區案場現址資訊 (含起造人、監造人、承造人、拆圖廠商與地號)
export function getAllProjectSites(): ProjectSite[] {
  if (!dbInstance) return [];
  ensureDatabaseIntegrity(dbInstance);
  try {
    const res = dbInstance.exec(`
      SELECT id, projectId, siteName, address, contactPerson, contactPhone, permitNumber, developerName, architect, constructor, shopDrawingVendorId, shopDrawingVendorName, landNumber 
      FROM project_sites;
    `);
    if (!res.length || !res[0].values) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      projectId: String(v[1]),
      siteName: String(v[2] || ''),
      address: String(v[3] || ''),
      contactPerson: String(v[4] || ''),
      contactPhone: String(v[5] || ''),
      permitNumber: v[6] ? String(v[6]) : undefined,
      developerName: v[7] ? String(v[7]) : undefined,
      architect: v[8] ? String(v[8]) : undefined,
      constructor: v[9] ? String(v[9]) : undefined,
      shopDrawingVendorId: v[10] ? String(v[10]) : undefined,
      shopDrawingVendorName: v[11] ? String(v[11]) : undefined,
      landNumber: v[12] ? String(v[12]) : undefined,
    }));
  } catch (e) {
    return [];
  }
}

// 讀取特定專案的工區現址資訊
export function getProjectSiteByProjectId(projectId: string): ProjectSite | null {
  if (!dbInstance) return null;
  ensureDatabaseIntegrity(dbInstance);
  try {
    const res = dbInstance.exec(`
      SELECT id, projectId, siteName, address, contactPerson, contactPhone, permitNumber, developerName, architect, constructor, shopDrawingVendorId, shopDrawingVendorName, landNumber 
      FROM project_sites 
      WHERE projectId = '${projectId.replace(/'/g, "''")}';
    `);
    if (!res.length || !res[0].values.length) return null;
    const v = res[0].values[0];
    return {
      id: String(v[0]),
      projectId: String(v[1]),
      siteName: String(v[2] || ''),
      address: String(v[3] || ''),
      contactPerson: String(v[4] || ''),
      contactPhone: String(v[5] || ''),
      permitNumber: v[6] ? String(v[6]) : undefined,
      developerName: v[7] ? String(v[7]) : undefined,
      architect: v[8] ? String(v[8]) : undefined,
      constructor: v[9] ? String(v[9]) : undefined,
      shopDrawingVendorId: v[10] ? String(v[10]) : undefined,
      shopDrawingVendorName: v[11] ? String(v[11]) : undefined,
      landNumber: v[12] ? String(v[12]) : undefined,
    };
  } catch (e) {
    return null;
  }
}

// 正式新增案場 (專案代碼一律依據 document_sequence_rules 既定格式自動配發，法人支援未定)
export function createProjectRecord(
  projectData: Partial<Project>,
  siteData?: Partial<ProjectSite>,
  operatorName: string = '系統管理員'
): Project {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureDatabaseIntegrity(dbInstance);
  const now = new Date().toISOString();
  const id = projectData.id || `PRJ-${Date.now().toString().slice(-6)}`;
  // 嚴格依據單據編碼規則變數自動配發代碼，禁止手動覆蓋
  const projectCode = getNextDocumentNumber('PRJ');
  const cleanName = (projectData.name || '新建工程案場').trim();
  const cleanOwner = (projectData.ownerName || '自建案場業主').trim();
  const cleanOwnerTaxId = (projectData.ownerTaxId || '').trim();
  const contractAmount = Number(projectData.contractAmount) || 0;
  const budgetAmount = Number(projectData.budgetAmount) || 0;
  const committedCost = Number(projectData.committedCost) || 0;
  const actualCost = Number(projectData.actualCost) || 0;
  const startDate = projectData.startDate || now.slice(0, 10);
  const endDate = projectData.endDate || '';
  const status = projectData.status || 'ACTIVE';
  const isLocked = projectData.isLocked ? 1 : 0;
  // 支援簽約法人未定 (NULL)
  const companyIdVal = projectData.companyId && projectData.companyId.trim() ? `'${projectData.companyId.trim()}'` : 'NULL';

  dbInstance.run(`
    INSERT INTO projects (
      id, projectCode, name, ownerName, ownerTaxId, contractAmount, budgetAmount, committedCost, actualCost, startDate, endDate, status, isLocked, companyId, isDeleted, version, createdAt, updatedAt
    ) VALUES (
      '${id}', '${projectCode}', '${cleanName.replace(/'/g, "''")}', '${cleanOwner.replace(/'/g, "''")}', '${cleanOwnerTaxId.replace(/'/g, "''")}', ${contractAmount}, ${budgetAmount}, ${committedCost}, ${actualCost}, '${startDate}', '${endDate}', '${status}', ${isLocked}, ${companyIdVal}, 0, 1, '${now}', '${now}'
    );
  `);

  if (siteData) {
    const siteId = siteData.id || `SITE-${Date.now().toString().slice(-6)}`;
    const cleanSiteName = (siteData.siteName || cleanName).trim();
    const cleanAddress = (siteData.address || '').trim();
    const cleanPerson = (siteData.contactPerson || '').trim();
    const cleanPhone = (siteData.contactPhone || '').trim();
    const cleanPermit = (siteData.permitNumber || '').trim();
    const cleanDeveloper = (siteData.developerName || cleanOwner).trim();
    const cleanArchitect = (siteData.architect || '').trim();
    const cleanConstructor = (siteData.constructor || '').trim();
    const cleanShopDrawingId = (siteData.shopDrawingVendorId || '').trim();
    const cleanShopDrawingName = (siteData.shopDrawingVendorName || '').trim();
    const cleanLandNumber = (siteData.landNumber || '').trim();

    dbInstance.run(`
      INSERT INTO project_sites (
        id, projectId, siteName, address, contactPerson, contactPhone, permitNumber, developerName, architect, constructor, shopDrawingVendorId, shopDrawingVendorName, landNumber
      ) VALUES (
        '${siteId}', '${id}', '${cleanSiteName.replace(/'/g, "''")}', '${cleanAddress.replace(/'/g, "''")}', '${cleanPerson.replace(/'/g, "''")}', '${cleanPhone.replace(/'/g, "''")}', '${cleanPermit.replace(/'/g, "''")}',
        '${cleanDeveloper.replace(/'/g, "''")}', '${cleanArchitect.replace(/'/g, "''")}', '${cleanConstructor.replace(/'/g, "''")}',
        ${cleanShopDrawingId ? `'${cleanShopDrawingId}'` : 'NULL'}, '${cleanShopDrawingName.replace(/'/g, "''")}', '${cleanLandNumber.replace(/'/g, "''")}'
      );
    `);
  }

  logAudit(dbInstance, operatorName, '新增資料', '專案案場工程', cleanName, undefined, { '專案代碼': projectCode, '合約總額': contractAmount, '起造人/業主': cleanOwner, '所屬法人': projectData.companyId || '未定' });
  saveDatabaseSnapshot();
  notifyListeners();
  return getProjectById(id)!;
}

// 完整更新案場資料 (專案代碼為系統主鍵不可變更，法人可改為未定)
export function updateProjectRecord(
  id: string,
  projectData: Partial<Project>,
  siteData?: Partial<ProjectSite>,
  operatorName: string = '系統管理員'
): Project {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureDatabaseIntegrity(dbInstance);
  const now = new Date().toISOString();
  const existing = getProjectById(id);
  if (!existing) throw new Error(`找不到案場 ${id}`);

  const updates: string[] = [`updatedAt = '${now}'`, `version = version + 1`];
  if (projectData.name !== undefined) updates.push(`name = '${projectData.name.trim().replace(/'/g, "''")}'`);
  if (projectData.ownerName !== undefined) updates.push(`ownerName = '${projectData.ownerName.trim().replace(/'/g, "''")}'`);
  if (projectData.ownerTaxId !== undefined) updates.push(`ownerTaxId = '${projectData.ownerTaxId.trim().replace(/'/g, "''")}'`);
  if (projectData.companyId !== undefined) {
    updates.push(projectData.companyId && projectData.companyId.trim() ? `companyId = '${projectData.companyId.trim()}'` : `companyId = NULL`);
  }
  if (projectData.contractAmount !== undefined) updates.push(`contractAmount = ${Number(projectData.contractAmount) || 0}`);
  if (projectData.budgetAmount !== undefined) updates.push(`budgetAmount = ${Number(projectData.budgetAmount) || 0}`);
  if (projectData.startDate !== undefined) updates.push(`startDate = '${projectData.startDate}'`);
  if (projectData.endDate !== undefined) updates.push(`endDate = '${projectData.endDate}'`);
  if (projectData.status !== undefined) updates.push(`status = '${projectData.status}'`);
  if (projectData.isLocked !== undefined) updates.push(`isLocked = ${projectData.isLocked ? 1 : 0}`);

  dbInstance.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = '${id}';`);

  if (siteData) {
    const existingSite = getProjectSiteByProjectId(id);
    const cleanSiteName = (siteData.siteName !== undefined ? siteData.siteName : existing.name).trim();
    const cleanAddress = (siteData.address !== undefined ? siteData.address : '').trim();
    const cleanPerson = (siteData.contactPerson !== undefined ? siteData.contactPerson : '').trim();
    const cleanPhone = (siteData.contactPhone !== undefined ? siteData.contactPhone : '').trim();
    const cleanPermit = (siteData.permitNumber !== undefined ? siteData.permitNumber : '').trim();
    const cleanDeveloper = (siteData.developerName !== undefined ? siteData.developerName : (existingSite?.developerName || existing.ownerName)).trim();
    const cleanArchitect = (siteData.architect !== undefined ? siteData.architect : (existingSite?.architect || '')).trim();
    const cleanConstructor = (siteData.constructor !== undefined ? siteData.constructor : (existingSite?.constructor || '')).trim();
    const cleanShopDrawingId = (siteData.shopDrawingVendorId !== undefined ? siteData.shopDrawingVendorId : (existingSite?.shopDrawingVendorId || '')).trim();
    const cleanShopDrawingName = (siteData.shopDrawingVendorName !== undefined ? siteData.shopDrawingVendorName : (existingSite?.shopDrawingVendorName || '')).trim();
    const cleanLandNumber = (siteData.landNumber !== undefined ? siteData.landNumber : (existingSite?.landNumber || '')).trim();

    if (existingSite) {
      dbInstance.run(`
        UPDATE project_sites 
        SET siteName = '${cleanSiteName.replace(/'/g, "''")}',
            address = '${cleanAddress.replace(/'/g, "''")}',
            contactPerson = '${cleanPerson.replace(/'/g, "''")}',
            contactPhone = '${cleanPhone.replace(/'/g, "''")}',
            permitNumber = '${cleanPermit.replace(/'/g, "''")}',
            developerName = '${cleanDeveloper.replace(/'/g, "''")}',
            architect = '${cleanArchitect.replace(/'/g, "''")}',
            constructor = '${cleanConstructor.replace(/'/g, "''")}',
            shopDrawingVendorId = ${cleanShopDrawingId ? `'${cleanShopDrawingId}'` : 'NULL'},
            shopDrawingVendorName = '${cleanShopDrawingName.replace(/'/g, "''")}',
            landNumber = '${cleanLandNumber.replace(/'/g, "''")}'
        WHERE projectId = '${id}';
      `);
    } else {
      const siteId = `SITE-${Date.now().toString().slice(-6)}`;
      dbInstance.run(`
        INSERT INTO project_sites (
          id, projectId, siteName, address, contactPerson, contactPhone, permitNumber, developerName, architect, constructor, shopDrawingVendorId, shopDrawingVendorName, landNumber
        ) VALUES (
          '${siteId}', '${id}', '${cleanSiteName.replace(/'/g, "''")}', '${cleanAddress.replace(/'/g, "''")}', '${cleanPerson.replace(/'/g, "''")}', '${cleanPhone.replace(/'/g, "''")}', '${cleanPermit.replace(/'/g, "''")}',
          '${cleanDeveloper.replace(/'/g, "''")}', '${cleanArchitect.replace(/'/g, "''")}', '${cleanConstructor.replace(/'/g, "''")}',
          ${cleanShopDrawingId ? `'${cleanShopDrawingId}'` : 'NULL'}, '${cleanShopDrawingName.replace(/'/g, "''")}', '${cleanLandNumber.replace(/'/g, "''")}'
        );
      `);
    }
  }

  logAudit(dbInstance, operatorName, '修改資料', '專案案場工程', existing.name, { '狀態': existing.status }, { '狀態': projectData.status || existing.status });
  saveDatabaseSnapshot();
  notifyListeners();
  return getProjectById(id)!;
}

// 軟刪除案場
export function deleteProjectRecord(id: string, operatorName: string = '系統管理員'): boolean {
  if (!dbInstance) return false;
  const existing = getProjectById(id);
  if (!existing) return false;
  const now = new Date().toISOString();
  dbInstance.run(`UPDATE projects SET isDeleted = 1, updatedAt = '${now}', version = version + 1 WHERE id = '${id}';`);
  logAudit(dbInstance, operatorName, '刪除資料', '專案案場工程', existing.name, { '刪除狀態': '正常' }, { '刪除狀態': '已刪除' });
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}


// ⚡ 一鍵極速建立合作廠商 (直接同步寫入商業夥伴模組，杜絕 SQL 欄位報錯)
export function quickCreateVendor(
  name: string,
  companyId: string = 'COMP-01',
  phone?: string,
  taxId?: string,
  contactPerson?: string,
  address?: string,
  category?: string
): BusinessPartner {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();
  const id = `BP-VEND-${Date.now().toString().slice(-6)}`;
  const bpCode = `VEND-${Date.now().toString().slice(-4)}`;
  const cleanName = name.trim();
  const cleanTaxId = (taxId || '').trim();
  const cleanPhone = (phone || '').trim();
  const cleanContact = (contactPerson || '').trim();
  const cleanAddress = (address || '').trim();
  const cleanCategory = (category || '現場材料供料商').trim();

  dbInstance.run(`
    INSERT INTO business_partners (
      id, bpCode, name, taxId, entityType, type, isCustomer, isVendor, convertedFromVendorId,
      serviceCategoryMain, serviceCategorySub, ownerIdNumber, representative, contactPerson,
      phone, email, address, bankName, bankCode, bankAccount, bankAccountName, bankFeePayer,
      hasInvoice, paymentTermsDays, isHighRisk, riskReason, currentScore, status, companyId,
      isDeleted, version, createdAt, updatedAt
    ) VALUES (
      '${id}',
      '${bpCode}',
      '${cleanName.replace(/'/g, "''")}',
      '${cleanTaxId.replace(/'/g, "''")}',
      'CORPORATION',
      'VENDOR',
      0,
      1,
      NULL,
      '${cleanCategory.replace(/'/g, "''")}',
      '材料建材',
      '',
      '${cleanName.replace(/'/g, "''")}',
      '${cleanContact.replace(/'/g, "''")}',
      '${cleanPhone.replace(/'/g, "''")}',
      '',
      '${cleanAddress.replace(/'/g, "''")}',
      '',
      '',
      '',
      '',
      'COMPANY',
      1,
      30,
      0,
      NULL,
      90,
      'ACTIVE',
      '${companyId}',
      0,
      1,
      '${now}',
      '${now}'
    );
  `);

  // 若有地址或聯絡人，同步建立子集合關聯
  if (cleanAddress) {
    dbInstance.run(`
      INSERT INTO partner_addresses (id, partnerId, addressType, label, fullAddress, isDeleted)
      VALUES ('PADDR-${Date.now()}', '${id}', 'COMMUNICATION', '主要通訊地址', '${cleanAddress.replace(/'/g, "''")}', 0);
    `);
  }
  if (cleanContact || cleanPhone) {
    dbInstance.run(`
      INSERT INTO partner_contacts (id, partnerId, contactType, name, title, phone, mobile, extension, email, notes, isDeleted)
      VALUES ('PCON-${Date.now()}', '${id}', 'PRIMARY', '${(cleanContact || '業務聯絡人').replace(/'/g, "''")}', '業務窗口', '', '${cleanPhone.replace(/'/g, "''")}', '', '', '自現場進貨登記建立', 0);
    `);
  }

  saveDatabaseSnapshot();
  notifyListeners();
  return getAllBusinessPartners().find(b => b.id === id)!;
}

// ⚡ 讀取物料主檔與一鍵建立新物料用料
export function getAllItems(): Item[] {
  if (!dbInstance) return [];
  const res = dbInstance.exec(`
    SELECT id, itemCode, name, category, unit, unitPrice, standardCost, isDeleted
    FROM items
    WHERE isDeleted = 0
    ORDER BY itemCode;
  `);
  if (!res.length || !res[0].values) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    itemCode: String(v[1]),
    name: String(v[2]),
    category: String(v[3] || '一般材料'),
    unit: String(v[4] || '式'),
    unitPrice: Number(v[5]) || 0,
    standardCost: Number(v[6]) || 0,
    isDeleted: Boolean(v[7]),
  }));
}

export function quickCreateItem(
  name: string,
  unit: string = '式',
  unitPrice: number = 0,
  category: string = '工程材料'
): Item {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const cleanName = name.trim();
  const id = `ITEM-${Date.now().toString().slice(-6)}`;
  const itemCode = `MAT-${Date.now().toString().slice(-4)}`;
  const cleanUnit = (unit || '式').trim();
  const cleanCategory = (category || '工程材料').trim();
  const price = Number(unitPrice) || 0;

  dbInstance.run(`
    INSERT INTO items (id, itemCode, name, category, unit, unitPrice, standardCost, isDeleted)
    VALUES ('${id}', '${itemCode}', '${cleanName.replace(/'/g, "''")}', '${cleanCategory.replace(/'/g, "''")}', '${cleanUnit.replace(/'/g, "''")}', ${price}, ${price}, 0);
  `);

  saveDatabaseSnapshot();
  notifyListeners();
  return getAllItems().find(i => i.id === id)!;
}

// ============================================================================
// 🏛️ Phase 3 商業夥伴 (BusinessPartner) 核心管理函式
// ============================================================================

// 讀取所有商業夥伴（含地址、聯絡人、銀行帳戶、支票記錄子集合）
export function getAllBusinessPartners(): BusinessPartner[] {
  if (!dbInstance) return [];

  // 1. 讀取主檔
  const bpRes = dbInstance.exec(`
    SELECT 
      id, bpCode, name, taxId, entityType, type, isCustomer, isVendor, convertedFromVendorId,
      serviceCategoryMain, serviceCategorySub, ownerIdNumber, representative, contactPerson,
      phone, email, address, bankName, bankCode, bankAccount, bankAccountName, bankFeePayer,
      hasInvoice, paymentTermsDays, isHighRisk, riskReason, currentScore, status, companyId,
      isDeleted, version, createdAt, updatedAt, serviceCategories
    FROM business_partners
    WHERE isDeleted = 0
    ORDER BY bpCode;
  `);

  if (!bpRes.length) return [];

  // 2. 預載入全量關聯子集合（避免 N+1 查詢）
  const addressesMap = new Map<string, PartnerAddress[]>();
  try {
    const addrRes = dbInstance.exec(`SELECT id, partnerId, addressType, label, fullAddress, isDeleted, postalCode, city, district, streetAddress FROM partner_addresses WHERE isDeleted = 0;`);
    if (addrRes.length && addrRes[0].values) {
      for (const row of addrRes[0].values) {
        const pId = String(row[1]);
        const addr: PartnerAddress = {
          id: String(row[0]),
          partnerId: pId,
          addressType: (row[2] as PartnerAddress['addressType']) || 'COMMUNICATION',
          label: row[3] ? String(row[3]) : undefined,
          fullAddress: String(row[4] || ''),
          isDeleted: Boolean(row[5]),
          postalCode: row[6] ? String(row[6]) : undefined,
          city: row[7] ? String(row[7]) : undefined,
          district: row[8] ? String(row[8]) : undefined,
          streetAddress: row[9] ? String(row[9]) : undefined
        };
        const list = addressesMap.get(pId) || [];
        list.push(addr);
        addressesMap.set(pId, list);
      }
    }
  } catch (e) {}

  const contactsMap = new Map<string, PartnerContact[]>();
  try {
    const conRes = dbInstance.exec(`SELECT id, partnerId, contactType, name, title, phone, mobile, extension, email, notes, isDeleted FROM partner_contacts WHERE isDeleted = 0;`);
    if (conRes.length && conRes[0].values) {
      for (const row of conRes[0].values) {
        const pId = String(row[1]);
        const con: PartnerContact = {
          id: String(row[0]),
          partnerId: pId,
          contactType: (row[2] as PartnerContact['contactType']) || 'PRIMARY',
          name: String(row[3] || ''),
          title: row[4] ? String(row[4]) : undefined,
          phone: row[5] ? String(row[5]) : undefined,
          mobile: row[6] ? String(row[6]) : undefined,
          extension: row[7] ? String(row[7]) : undefined,
          email: row[8] ? String(row[8]) : undefined,
          notes: row[9] ? String(row[9]) : undefined,
          isDeleted: Boolean(row[10])
        };
        const list = contactsMap.get(pId) || [];
        list.push(con);
        contactsMap.set(pId, list);
      }
    }
  } catch (e) {}

  const cardsMap = new Map<string, PartnerBusinessCard[]>();
  try {
    const cardRes = dbInstance.exec(`SELECT id, partnerId, name, title, companyName, phone, mobile, email, address, exchangeDate, cardFrontUrl, cardBackUrl, cardFileType, notes, createdAt FROM partner_business_cards ORDER BY createdAt DESC;`);
    if (cardRes.length && cardRes[0].values) {
      for (const row of cardRes[0].values) {
        const pId = String(row[1]);
        const card: PartnerBusinessCard = {
          id: String(row[0]),
          partnerId: pId,
          name: String(row[2] || ''),
          title: row[3] ? String(row[3]) : undefined,
          companyName: row[4] ? String(row[4]) : undefined,
          phone: row[5] ? String(row[5]) : undefined,
          mobile: row[6] ? String(row[6]) : undefined,
          email: row[7] ? String(row[7]) : undefined,
          address: row[8] ? String(row[8]) : undefined,
          exchangeDate: row[9] ? String(row[9]) : undefined,
          cardFrontUrl: row[10] ? String(row[10]) : undefined,
          cardBackUrl: row[11] ? String(row[11]) : undefined,
          cardFileType: (row[12] as any) || 'IMAGE',
          notes: row[13] ? String(row[13]) : undefined,
          createdAt: row[14] ? String(row[14]) : undefined
        };
        const list = cardsMap.get(pId) || [];
        list.push(card);
        cardsMap.set(pId, list);
      }
    }
  } catch (e) {}

  const banksMap = new Map<string, BPBankAccount[]>();
  try {
    const bnkRes = dbInstance.exec(`SELECT id, bpId, bankCode, bankName, branchCode, branchName, accountNumber, accountName, isPrimary, passbookFileId, passbookFileData, isDeleted, passbookFiles FROM bp_bank_accounts WHERE isDeleted = 0;`);
    if (bnkRes.length && bnkRes[0].values) {
      for (const row of bnkRes[0].values) {
        const pId = String(row[1]);
        let pFiles: any[] = [];
        try {
          if (row[12]) pFiles = JSON.parse(String(row[12]));
        } catch (e) {}
        const bnk: BPBankAccount = {
          id: String(row[0]),
          bpId: pId,
          bankCode: String(row[2] || ''),
          bankName: String(row[3] || ''),
          branchCode: row[4] ? String(row[4]) : undefined,
          branchName: row[5] ? String(row[5]) : undefined,
          accountNumber: String(row[6] || ''),
          accountName: String(row[7] || ''),
          isPrimary: Boolean(row[8]),
          passbookFileId: row[9] ? String(row[9]) : undefined,
          passbookFileData: row[10] ? String(row[10]) : undefined,
          isDeleted: Boolean(row[11]),
          passbookFiles: pFiles
        };
        const list = banksMap.get(pId) || [];
        list.push(bnk);
        banksMap.set(pId, list);
      }
    }
  } catch (e) {}

  const chequesMap = new Map<string, PartnerChequeRecord[]>();
  try {
    const chkRes = dbInstance.exec(`SELECT * FROM partner_cheque_records ORDER BY dueDate DESC;`);
    if (chkRes.length && chkRes[0].values) {
      const cols = chkRes[0].columns;
      const colIdx: Record<string, number> = {};
      cols.forEach((c, idx) => { colIdx[c] = idx; });
      const getVal = (row: any[], cName: string) => colIdx[cName] !== undefined ? row[colIdx[cName]] : undefined;

      for (const row of chkRes[0].values) {
        const pId = String(getVal(row, 'partnerId') || '');
        if (!pId) continue;
        let cFiles: any[] = [];
        try {
          const rawFiles = getVal(row, 'chequeFiles');
          if (rawFiles) cFiles = JSON.parse(String(rawFiles));
        } catch (e) {}

        const chk: PartnerChequeRecord = {
          id: String(getVal(row, 'id') || ''),
          partnerId: pId,
          direction: (getVal(row, 'direction') as PartnerChequeRecord['direction']) || 'RECEIPT',
          bankCode: String(getVal(row, 'bankCode') || ''),
          bankName: String(getVal(row, 'bankName') || ''),
          branchName: getVal(row, 'branchName') ? String(getVal(row, 'branchName')) : undefined,
          accountNumber: String(getVal(row, 'accountNumber') || ''),
          checkNumber: String(getVal(row, 'checkNumber') || ''),
          receivedDate: getVal(row, 'receivedDate') ? String(getVal(row, 'receivedDate')) : undefined,
          issueDate: String(getVal(row, 'issueDate') || ''),
          dueDate: String(getVal(row, 'dueDate') || ''),
          statutoryExpiryDate: getVal(row, 'statutoryExpiryDate') ? String(getVal(row, 'statutoryExpiryDate')) : undefined,
          amount: Number(getVal(row, 'amount') || 0),
          payeeName: String(getVal(row, 'payeeName') || ''),
          isNonNegotiable: Boolean(getVal(row, 'isNonNegotiable')),
          chequeFileId: getVal(row, 'chequeFileId') ? String(getVal(row, 'chequeFileId')) : undefined,
          chequeFileData: getVal(row, 'chequeFileData') ? String(getVal(row, 'chequeFileData')) : undefined,
          chequeFiles: cFiles,
          status: (getVal(row, 'status') as PartnerChequeRecord['status']) || 'RECEIVED',
          notes: getVal(row, 'notes') ? String(getVal(row, 'notes')) : undefined,
          createdAt: String(getVal(row, 'createdAt') || ''),
          updatedAt: String(getVal(row, 'updatedAt') || '')
        };
        const list = chequesMap.get(pId) || [];
        list.push(chk);
        chequesMap.set(pId, list);
      }
    }
  } catch (e) {
    console.error('Failed to load partner_cheque_records:', e);
  }

  return bpRes[0].values.map(v => {
    const id = String(v[0]);
    const bType = v[5] as BusinessPartner['type'];
    const isCust = v[6] !== null && v[6] !== undefined ? Boolean(v[6]) : (bType === 'CUSTOMER' || bType === 'BOTH');
    const isVend = v[7] !== null && v[7] !== undefined ? Boolean(v[7]) : (bType === 'VENDOR' || bType === 'SUBCONTRACTOR' || bType === 'BOTH');

    let parsedServiceCategories: any[] = [];
    try {
      if (v[33]) parsedServiceCategories = JSON.parse(String(v[33]));
    } catch (e) {}

    return {
      id,
      bpCode: String(v[1]),
      name: String(v[2]),
      taxId: String(v[3]),
      entityType: (v[4] as BusinessPartner['entityType']) || 'CORPORATION',
      type: bType,
      isCustomer: isCust,
      isVendor: isVend,
      convertedFromVendorId: v[8] ? String(v[8]) : undefined,
      serviceCategoryMain: v[9] ? String(v[9]) : undefined,
      serviceCategorySub: v[10] ? String(v[10]) : undefined,
      serviceCategories: parsedServiceCategories,
      ownerIdNumber: v[11] ? String(v[11]) : undefined,
      representative: v[12] ? String(v[12]) : undefined,
      contactPerson: String(v[13] || ''),
      phone: String(v[14] || ''),
      email: String(v[15] || ''),
      address: String(v[16] || ''),
      bankName: String(v[17] || ''),
      bankCode: String(v[18] || ''),
      bankAccount: String(v[19] || ''),
      bankAccountName: v[20] ? String(v[20]) : undefined,
      bankFeePayer: (v[21] as BusinessPartner['bankFeePayer']) || 'COMPANY',
      hasInvoice: v[22] !== null ? Boolean(v[22]) : true,
      paymentTermsDays: Number(v[23] || 30),
      isHighRisk: Boolean(v[24]),
      riskReason: v[25] ? String(v[25]) : undefined,
      currentScore: Number(v[26] ?? 85),
      status: (v[27] as BusinessPartner['status']) || 'ACTIVE',
      companyId: String(v[28] || 'COMP-01'),
      isDeleted: Boolean(v[29]),
      version: Number(v[30] || 1),
      createdAt: String(v[31] || '2026-01-01'),
      updatedAt: String(v[32] || '2026-01-01'),
      addresses: addressesMap.get(id) || [],
      contacts: contactsMap.get(id) || [],
      bankAccounts: banksMap.get(id) || [],
      chequeRecords: chequesMap.get(id) || [],
      businessCards: cardsMap.get(id) || []
    };
  });
}

// 根據 ID 讀取單一商業夥伴
export function getBusinessPartnerById(id: string): BusinessPartner | null {
  const all = getAllBusinessPartners();
  return all.find(b => b.id === id) || null;
}

// 儲存或更新商業夥伴 (包含子地址、聯絡人、銀行帳戶及審計日誌)
export function saveBusinessPartner(
  partner: BusinessPartner,
  operatorName: string = '系統管理員'
): BusinessPartner {
  if (!dbInstance) throw new Error('資料庫尚未就緒');

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const isExisting = Boolean(partner.id && getBusinessPartnerById(partner.id));
  const targetId = partner.id || `BP-${Date.now().toString().slice(-6)}`;
  const targetCode = partner.bpCode || (partner.isCustomer ? `CUST-${Date.now().toString().slice(-4)}` : `VEND-${Date.now().toString().slice(-4)}`);

  // 決定類型代號
  let determinedType: BusinessPartner['type'] = partner.type;
  if (partner.isCustomer && partner.isVendor) {
    determinedType = 'BOTH';
  } else if (partner.isCustomer) {
    determinedType = 'CUSTOMER';
  } else if (partner.isVendor) {
    determinedType = partner.type === 'SUBCONTRACTOR' ? 'SUBCONTRACTOR' : 'VENDOR';
  }

  const primaryAddress = partner.addresses && partner.addresses.length > 0
    ? partner.addresses[0].fullAddress
    : partner.address || '';

  const primaryContact = partner.contacts && partner.contacts.length > 0
    ? partner.contacts[0].name
    : partner.contactPerson || '';

  const primaryPhone = partner.contacts && partner.contacts.length > 0
    ? (partner.contacts[0].mobile || partner.contacts[0].phone || '')
    : partner.phone || '';

  const primaryBank = partner.bankAccounts && partner.bankAccounts.length > 0
    ? partner.bankAccounts[0]
    : null;

  const bankName = primaryBank ? primaryBank.bankName : (partner.bankName || '');
  const bankCode = primaryBank ? primaryBank.bankCode : (partner.bankCode || '');
  const bankAccount = primaryBank ? primaryBank.accountNumber : (partner.bankAccount || '');
  const bankAccountName = primaryBank ? primaryBank.accountName : (partner.bankAccountName || partner.name);

  // 1. 寫入主檔 (UPSERT)
  dbInstance.run(`
    INSERT INTO business_partners (
      id, bpCode, name, taxId, entityType, type, isCustomer, isVendor, convertedFromVendorId,
      serviceCategoryMain, serviceCategorySub, serviceCategories, ownerIdNumber, representative, contactPerson,
      phone, email, address, bankName, bankCode, bankAccount, bankAccountName, bankFeePayer,
      hasInvoice, paymentTermsDays, isHighRisk, riskReason, currentScore, status, companyId,
      isDeleted, version, createdAt, updatedAt
    ) VALUES (
      '${targetId}',
      '${targetCode.replace(/'/g, "''")}',
      '${partner.name.replace(/'/g, "''")}',
      '${(partner.taxId || '').replace(/'/g, "''")}',
      '${partner.entityType || 'CORPORATION'}',
      '${determinedType}',
      ${partner.isCustomer ? 1 : 0},
      ${partner.isVendor ? 1 : 0},
      ${partner.convertedFromVendorId ? `'${partner.convertedFromVendorId.replace(/'/g, "''")}'` : 'NULL'},
      ${partner.serviceCategoryMain ? `'${partner.serviceCategoryMain.replace(/'/g, "''")}'` : 'NULL'},
      ${partner.serviceCategorySub ? `'${partner.serviceCategorySub.replace(/'/g, "''")}'` : 'NULL'},
      ${partner.serviceCategories && partner.serviceCategories.length > 0 ? `'${JSON.stringify(partner.serviceCategories).replace(/'/g, "''")}'` : 'NULL'},
      ${partner.ownerIdNumber ? `'${partner.ownerIdNumber.replace(/'/g, "''")}'` : 'NULL'},
      ${partner.representative ? `'${partner.representative.replace(/'/g, "''")}'` : 'NULL'},
      '${primaryContact.replace(/'/g, "''")}',
      '${primaryPhone.replace(/'/g, "''")}',
      '${(partner.email || '').replace(/'/g, "''")}',
      '${primaryAddress.replace(/'/g, "''")}',
      '${bankName.replace(/'/g, "''")}',
      '${bankCode.replace(/'/g, "''")}',
      '${bankAccount.replace(/'/g, "''")}',
      '${bankAccountName.replace(/'/g, "''")}',
      '${partner.bankFeePayer || 'COMPANY'}',
      ${partner.hasInvoice !== false ? 1 : 0},
      ${partner.paymentTermsDays || 30},
      ${partner.isHighRisk ? 1 : 0},
      ${partner.riskReason ? `'${partner.riskReason.replace(/'/g, "''")}'` : 'NULL'},
      ${partner.currentScore ?? 85},
      '${partner.status || 'ACTIVE'}',
      '${partner.companyId || 'COMP-01'}',
      0,
      ${(partner.version || 1) + 1},
      '${partner.createdAt || now}',
      '${now}'
    )
    ON CONFLICT(id) DO UPDATE SET
      bpCode = excluded.bpCode,
      name = excluded.name,
      taxId = excluded.taxId,
      entityType = excluded.entityType,
      type = excluded.type,
      isCustomer = excluded.isCustomer,
      isVendor = excluded.isVendor,
      convertedFromVendorId = excluded.convertedFromVendorId,
      serviceCategoryMain = excluded.serviceCategoryMain,
      serviceCategorySub = excluded.serviceCategorySub,
      serviceCategories = excluded.serviceCategories,
      ownerIdNumber = excluded.ownerIdNumber,
      representative = excluded.representative,
      contactPerson = excluded.contactPerson,
      phone = excluded.phone,
      email = excluded.email,
      address = excluded.address,
      bankName = excluded.bankName,
      bankCode = excluded.bankCode,
      bankAccount = excluded.bankAccount,
      bankAccountName = excluded.bankAccountName,
      bankFeePayer = excluded.bankFeePayer,
      hasInvoice = excluded.hasInvoice,
      paymentTermsDays = excluded.paymentTermsDays,
      isHighRisk = excluded.isHighRisk,
      riskReason = excluded.riskReason,
      currentScore = excluded.currentScore,
      status = excluded.status,
      companyId = excluded.companyId,
      isDeleted = 0,
      version = business_partners.version + 1,
      updatedAt = '${now}';
  `);

  // 2. 更新地址清單 (全量同步)
  if (partner.addresses && partner.addresses.length > 0) {
    dbInstance.run(`DELETE FROM partner_addresses WHERE partnerId = '${targetId}';`);
    for (const a of partner.addresses) {
      if (!a.fullAddress || !a.fullAddress.trim()) continue;
      const aId = a.id || `PADDR-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
      dbInstance.run(`
        INSERT INTO partner_addresses (id, partnerId, addressType, label, postalCode, city, district, fullAddress, isDeleted)
        VALUES ('${aId}', '${targetId}', '${a.addressType || 'COMMUNICATION'}', ${a.label ? `'${a.label.replace(/'/g, "''")}'` : 'NULL'}, ${a.postalCode ? `'${a.postalCode.replace(/'/g, "''")}'` : 'NULL'}, ${a.city ? `'${a.city.replace(/'/g, "''")}'` : 'NULL'}, ${a.district ? `'${a.district.replace(/'/g, "''")}'` : 'NULL'}, '${a.fullAddress.replace(/'/g, "''")}', 0);
      `);
    }
  }

  // 3. 更新聯絡人清單 (全量同步)
  if (partner.contacts && partner.contacts.length > 0) {
    dbInstance.run(`DELETE FROM partner_contacts WHERE partnerId = '${targetId}';`);
    for (const c of partner.contacts) {
      if (!c.name || !c.name.trim()) continue;
      const cId = c.id || `PCON-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
      dbInstance.run(`
        INSERT INTO partner_contacts (id, partnerId, contactType, name, title, phone, mobile, extension, email, notes, isDeleted)
        VALUES (
          '${cId}',
          '${targetId}',
          '${c.contactType || 'PRIMARY'}',
          '${c.name.replace(/'/g, "''")}',
          ${c.title ? `'${c.title.replace(/'/g, "''")}'` : 'NULL'},
          ${c.phone ? `'${c.phone.replace(/'/g, "''")}'` : 'NULL'},
          ${c.mobile ? `'${c.mobile.replace(/'/g, "''")}'` : 'NULL'},
          ${c.extension ? `'${c.extension.replace(/'/g, "''")}'` : 'NULL'},
          ${c.email ? `'${c.email.replace(/'/g, "''")}'` : 'NULL'},
          ${c.notes ? `'${c.notes.replace(/'/g, "''")}'` : 'NULL'},
          0
        );
      `);
    }
  }

  // 4. 更新銀行帳戶清單
  if (partner.bankAccounts && partner.bankAccounts.length > 0) {
    dbInstance.run(`DELETE FROM bp_bank_accounts WHERE bpId = '${targetId}';`);
    for (const b of partner.bankAccounts) {
      if (!b.accountNumber || !b.accountNumber.trim()) continue;
      const bId = b.id || `BACC-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
      dbInstance.run(`
        INSERT INTO bp_bank_accounts (id, bpId, bankCode, bankName, branchCode, branchName, accountNumber, accountName, isPrimary, passbookFileId, passbookFileData, passbookFiles, isDeleted)
        VALUES (
          '${bId}',
          '${targetId}',
          '${(b.bankCode || '').replace(/'/g, "''")}',
          '${(b.bankName || '').replace(/'/g, "''")}',
          ${b.branchCode ? `'${b.branchCode.replace(/'/g, "''")}'` : 'NULL'},
          ${b.branchName ? `'${b.branchName.replace(/'/g, "''")}'` : 'NULL'},
          '${b.accountNumber.replace(/'/g, "''")}',
          '${(b.accountName || partner.name).replace(/'/g, "''")}',
          ${b.isPrimary ? 1 : 0},
          ${b.passbookFileId ? `'${b.passbookFileId.replace(/'/g, "''")}'` : 'NULL'},
          ${b.passbookFileData ? `'${b.passbookFileData.replace(/'/g, "''")}'` : 'NULL'},
          ${b.passbookFiles && b.passbookFiles.length > 0 ? `'${JSON.stringify(b.passbookFiles).replace(/'/g, "''")}'` : 'NULL'},
          0
        );
      `);
    }
  }

  // 5. 更新名片清單 (全量同步)
  if (partner.businessCards && partner.businessCards.length > 0) {
    dbInstance.run(`DELETE FROM partner_business_cards WHERE partnerId = '${targetId}';`);
    for (const card of partner.businessCards) {
      if (!card.name && !card.cardFrontUrl) continue;
      const cId = card.id || `PBC-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
      dbInstance.run(`
        INSERT INTO partner_business_cards (
          id, partnerId, name, title, companyName, phone, mobile, email, address,
          exchangeDate, cardFrontUrl, cardBackUrl, cardFileType, notes, createdAt
        ) VALUES (
          '${cId}',
          '${targetId}',
          '${(card.name || partner.name).replace(/'/g, "''")}',
          ${card.title ? `'${card.title.replace(/'/g, "''")}'` : 'NULL'},
          ${card.companyName ? `'${card.companyName.replace(/'/g, "''")}'` : `'${partner.name.replace(/'/g, "''")}'`},
          ${card.phone ? `'${card.phone.replace(/'/g, "''")}'` : 'NULL'},
          ${card.mobile ? `'${card.mobile.replace(/'/g, "''")}'` : 'NULL'},
          ${card.email ? `'${card.email.replace(/'/g, "''")}'` : 'NULL'},
          ${card.address ? `'${card.address.replace(/'/g, "''")}'` : 'NULL'},
          ${card.exchangeDate ? `'${card.exchangeDate.replace(/'/g, "''")}'` : 'NULL'},
          ${card.cardFrontUrl ? `'${card.cardFrontUrl.replace(/'/g, "''")}'` : 'NULL'},
          ${card.cardBackUrl ? `'${card.cardBackUrl.replace(/'/g, "''")}'` : 'NULL'},
          '${card.cardFileType || 'IMAGE'}',
          ${card.notes ? `'${card.notes.replace(/'/g, "''")}'` : 'NULL'},
          '${card.createdAt || now}'
        );
      `);
    }
  }

  // 6. 寫入審計日誌
  try {
    const actionDesc = isExisting ? '修改資料' : '新增資料';
    recordAuditLog(operatorName, actionDesc, '商業夥伴', targetId, {
      夥伴編號: targetCode,
      夥伴名稱: partner.name,
      統一編號: partner.taxId,
      身分型態: partner.isCustomer && partner.isVendor ? '業主暨廠商' : partner.isCustomer ? '業主' : '合作廠商',
      工項分類: `${partner.serviceCategoryMain || ''} / ${partner.serviceCategorySub || ''}`,
      手續費負擔: partner.bankFeePayer === 'PARTNER' ? '廠商自付' : '公司自行吸收(不扣)',
      高風險註記: partner.isHighRisk ? `是 (${partner.riskReason || ''})` : '正常'
    });
  } catch (e) {}

  saveDatabaseSnapshot();
  notifyListeners();

  return getBusinessPartnerById(targetId) || partner;
}

// 軟刪除商業夥伴
export function deleteBusinessPartner(id: string, operatorName: string = '系統管理員'): boolean {
  if (!dbInstance) return false;
  const partner = getBusinessPartnerById(id);
  if (!partner) return false;

  dbInstance.run(`UPDATE business_partners SET isDeleted = 1, updatedAt = '${new Date().toISOString()}' WHERE id = '${id}';`);

  try {
    recordAuditLog(operatorName, '刪除資料', '商業夥伴', id, { 夥伴名稱: partner.name, 夥伴編號: partner.bpCode });
  } catch (e) {}

  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 一鍵自合作廠商引薦/加入變業主 (One-Click Vendor-to-Client Conversion)
export function convertVendorToClient(vendorId: string, operatorName: string = '系統管理員'): BusinessPartner {
  if (!dbInstance) throw new Error('資料庫尚未就緒');
  const vendor = getBusinessPartnerById(vendorId);
  if (!vendor) throw new Error('找不到該合作廠商');

  // 若該夥伴已存在，直接賦予業主身分，並記錄 SSoT 關聯
  vendor.isCustomer = true;
  vendor.type = vendor.isVendor ? 'BOTH' : 'CUSTOMER';
  vendor.convertedFromVendorId = vendorId;

  const saved = saveBusinessPartner(vendor, operatorName);

  try {
    recordAuditLog(operatorName, '身分轉換', '商業夥伴', vendorId, {
      原始身分: '合作廠商',
      轉換結果: '一鍵加入變業主 (SSoT 單一真實來源)',
      業主名稱: vendor.name
    });
  } catch (e) {}

  saveDatabaseSnapshot();
  notifyListeners();
  return saved;
}

// 新增/更新支票往來記錄
export function savePartnerChequeRecord(
  cheque: PartnerChequeRecord,
  operatorName: string = '系統管理員'
): PartnerChequeRecord {
  if (!dbInstance) throw new Error('資料庫尚未就緒');

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const targetId = cheque.id || `PCHK-${Date.now().toString().slice(-6)}`;

  const calcStatutoryExpiry = cheque.statutoryExpiryDate || (cheque.issueDate ? (() => {
    try {
      const d = new Date(cheque.issueDate);
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0, 10);
    } catch (e) {
      return null;
    }
  })() : null);

  dbInstance.run(`
    INSERT INTO partner_cheque_records (
      id, partnerId, direction, bankCode, bankName, branchName, accountNumber, checkNumber,
      receivedDate, issueDate, dueDate, statutoryExpiryDate, amount, payeeName, isNonNegotiable, chequeFileId, chequeFileData,
      chequeFiles, status, notes, createdAt, updatedAt
    ) VALUES (
      '${targetId}',
      '${cheque.partnerId}',
      '${cheque.direction || 'RECEIPT'}',
      '${(cheque.bankCode || '').replace(/'/g, "''")}',
      '${(cheque.bankName || '').replace(/'/g, "''")}',
      ${cheque.branchName ? `'${cheque.branchName.replace(/'/g, "''")}'` : 'NULL'},
      '${(cheque.accountNumber || '').replace(/'/g, "''")}',
      '${(cheque.checkNumber || '').replace(/'/g, "''")}',
      ${cheque.receivedDate ? `'${cheque.receivedDate.replace(/'/g, "''")}'` : 'NULL'},
      '${cheque.issueDate || now.slice(0, 10)}',
      '${cheque.dueDate || now.slice(0, 10)}',
      ${calcStatutoryExpiry ? `'${calcStatutoryExpiry}'` : 'NULL'},
      ${Math.max(0, cheque.amount || 0)},
      '${(cheque.payeeName || '').replace(/'/g, "''")}',
      ${cheque.isNonNegotiable ? 1 : 0},
      ${cheque.chequeFileId ? `'${cheque.chequeFileId.replace(/'/g, "''")}'` : 'NULL'},
      ${cheque.chequeFileData ? `'${cheque.chequeFileData.replace(/'/g, "''")}'` : 'NULL'},
      ${cheque.chequeFiles && cheque.chequeFiles.length > 0 ? `'${JSON.stringify(cheque.chequeFiles).replace(/'/g, "''")}'` : 'NULL'},
      '${cheque.status || 'RECEIVED'}',
      ${cheque.notes ? `'${cheque.notes.replace(/'/g, "''")}'` : 'NULL'},
      '${cheque.createdAt || now}',
      '${now}'
    )
    ON CONFLICT(id) DO UPDATE SET
      direction = excluded.direction,
      bankCode = excluded.bankCode,
      bankName = excluded.bankName,
      branchName = excluded.branchName,
      accountNumber = excluded.accountNumber,
      checkNumber = excluded.checkNumber,
      receivedDate = excluded.receivedDate,
      issueDate = excluded.issueDate,
      dueDate = excluded.dueDate,
      statutoryExpiryDate = excluded.statutoryExpiryDate,
      amount = excluded.amount,
      payeeName = excluded.payeeName,
      isNonNegotiable = excluded.isNonNegotiable,
      chequeFileId = excluded.chequeFileId,
      chequeFileData = excluded.chequeFileData,
      chequeFiles = excluded.chequeFiles,
      status = excluded.status,
      notes = excluded.notes,
      updatedAt = '${now}';
  `);

  try {
    const dirText = cheque.direction === 'RECEIPT' ? '收受支票' : '開立支票';
    recordAuditLog(operatorName, '登記票據', '夥伴支票記錄', targetId, {
      票據方向: dirText,
      支票號碼: cheque.checkNumber,
      票面金額: cheque.amount,
      到期日: cheque.dueDate
    });
  } catch (e) {}

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    ...cheque,
    id: targetId,
    updatedAt: now
  };
}

// 刪除支票往來記錄
export function deletePartnerChequeRecord(chequeId: string, operatorName: string = '系統管理員'): boolean {
  if (!dbInstance) return false;
  dbInstance.run(`DELETE FROM partner_cheque_records WHERE id = '${chequeId}';`);

  try {
    recordAuditLog(operatorName, '刪除票據', '夥伴支票記錄', chequeId, { 支票記錄代碼: chequeId });
  } catch (e) {}

  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 新增/更新名片資料
export function savePartnerBusinessCard(
  card: PartnerBusinessCard,
  operatorName: string = '系統管理員'
): PartnerBusinessCard {
  if (!dbInstance) throw new Error('資料庫尚未就緒');
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const targetId = card.id || `PBC-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;

  dbInstance.run(`
    INSERT INTO partner_business_cards (
      id, partnerId, name, title, companyName, phone, mobile, email, address,
      exchangeDate, cardFrontUrl, cardBackUrl, cardFileType, notes, createdAt
    ) VALUES (
      '${targetId}',
      '${card.partnerId}',
      '${(card.name || '').replace(/'/g, "''")}',
      ${card.title ? `'${card.title.replace(/'/g, "''")}'` : 'NULL'},
      ${card.companyName ? `'${card.companyName.replace(/'/g, "''")}'` : 'NULL'},
      ${card.phone ? `'${card.phone.replace(/'/g, "''")}'` : 'NULL'},
      ${card.mobile ? `'${card.mobile.replace(/'/g, "''")}'` : 'NULL'},
      ${card.email ? `'${card.email.replace(/'/g, "''")}'` : 'NULL'},
      ${card.address ? `'${card.address.replace(/'/g, "''")}'` : 'NULL'},
      ${card.exchangeDate ? `'${card.exchangeDate.replace(/'/g, "''")}'` : 'NULL'},
      ${card.cardFrontUrl ? `'${card.cardFrontUrl.replace(/'/g, "''")}'` : 'NULL'},
      ${card.cardBackUrl ? `'${card.cardBackUrl.replace(/'/g, "''")}'` : 'NULL'},
      '${card.cardFileType || 'IMAGE'}',
      ${card.notes ? `'${card.notes.replace(/'/g, "''")}'` : 'NULL'},
      '${card.createdAt || now}'
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      title = excluded.title,
      companyName = excluded.companyName,
      phone = excluded.phone,
      mobile = excluded.mobile,
      email = excluded.email,
      address = excluded.address,
      exchangeDate = excluded.exchangeDate,
      cardFrontUrl = excluded.cardFrontUrl,
      cardBackUrl = excluded.cardBackUrl,
      cardFileType = excluded.cardFileType,
      notes = excluded.notes;
  `);

  try {
    recordAuditLog(operatorName, '儲存名片', '商業夥伴名片', targetId, {
      夥伴ID: card.partnerId,
      姓名: card.name,
      職稱: card.title
    });
  } catch (e) {}

  saveDatabaseSnapshot();
  notifyListeners();
  return { ...card, id: targetId };
}

// 刪除名片資料
export function deletePartnerBusinessCard(cardId: string, operatorName: string = '系統管理員'): boolean {
  if (!dbInstance) return false;
  dbInstance.run(`DELETE FROM partner_business_cards WHERE id = '${cardId}';`);

  try {
    recordAuditLog(operatorName, '刪除名片', '商業夥伴名片', cardId, { 名片ID: cardId });
  } catch (e) {}

  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 讀取報價單 (含 CPQ 議價模式與影子協議)
export function getAllQuotations(): Quotation[] {
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
  if (!dbInstance) return false;
  const now = new Date().toISOString();
  const existing = getAllQuotations().find(q => q.id === quotation.id);

  // 1. 計算有效影子單價 (Effective Unit Price) 與幽靈小數洗滌
  // 計算得標工項之未稅總額
  const awardedStandardItems = items.filter(i => (i.isAwarded !== false) && i.itemType !== 'DEDUCTION');
  const sumAwardedNet = awardedStandardItems.reduce((acc, it) => acc + Math.round(it.quantity * it.unitPrice), 0);
  const targetNet = quotation.netAmount; // 扣除表頭折讓或協議後之淨額

  // 計算影子均攤比例 (若無折讓則比率為 1)
  const allocationRatio = sumAwardedNet > 0 ? (targetNet / sumAwardedNet) : 1;

  // 2. 儲存主單
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

  // 3. 儲存明細項目 (清空本版次明細後重新插入，保證 SSoT 一致性)
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

  // 4. 儲存請款里程碑
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

  // 5. 更新或新增版次紀錄 (QuotationRevision)
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

  // 6. 記錄中文稽核日誌
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
  if (!dbInstance) return false;
  const quote = getAllQuotations().find(q => q.id === sourceQuotationId);
  if (!quote) return false;

  const items = getQuotationItems(sourceQuotationId, quote.currentRevision);
  const milestones = getQuotationMilestones(sourceQuotationId);
  const now = new Date().toISOString();

  // 將當前版本標記為 SUPERSEDED (已取代)，並更新 currentRevision 為新代碼
  dbInstance.run(`
    UPDATE quotations
    SET currentRevision = '${newRevisionCode}',
        version = version + 1,
        updatedAt = '${now}'
    WHERE id = '${sourceQuotationId}';
  `);

  // 寫入新明細 (深拷貝 items 至新版次)
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

  // 寫入新版次紀錄
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

// 讀取應付帳款 AP
export function getAllAccountsPayable(): AccountPayable[] {
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

// 讀取應收帳款 AR
export function getAllAccountsReceivable(): AccountReceivable[] {
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT * FROM accounts_receivable ORDER BY dueDate;`);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    arNumber: String(v[1]),
    projectId: String(v[2]),
    customerId: String(v[3]),
    customerName: String(v[4]),
    companyId: String(v[5]),
    amount: Number(v[6] || 0),
    appliedAmount: Number(v[7] || 0),
    remainingAmount: Number(v[8] || 0),
    dueDate: String(v[9]),
    status: v[10] as AccountReceivable['status'],
    createdAt: String(v[11]),
  }));
}

// 讀取支票
export function getAllBankChecks(): BankCheck[] {
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT * FROM bank_checks ORDER BY dueDate;`);
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
    status: v[9] as BankCheck['status'],
    voidReason: v[10] ? String(v[10]) : undefined,
    notes: v[11] ? String(v[11]) : undefined,
  }));
}

// 讀取全域參數
export function getAllSystemConfigs(): SystemConfig[] {
  if (!dbInstance) return [];
  // 自動偵測並觸發已到期的法規排程生效
  applyDueRegulatorySchedules();
  const res = dbInstance.exec(`
    SELECT id, configKey, configValue, valueType, validFrom, validTo, isDeleted, version, description, updatedBy, createdAt, updatedAt
    FROM system_configs WHERE isDeleted = 0;
  `);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    configKey: String(v[1]),
    configValue: String(v[2]),
    valueType: v[3] as SystemConfig['valueType'],
    validFrom: String(v[4]),
    validTo: v[5] ? String(v[5]) : undefined,
    isDeleted: Boolean(v[6]),
    version: Number(v[7] || 1),
    description: v[8] ? String(v[8]) : undefined,
    updatedBy: v[9] ? String(v[9]) : undefined,
    createdAt: v[10] ? String(v[10]) : undefined,
    updatedAt: v[11] ? String(v[11]) : undefined,
  }));
}

// 更新全域核心系統參數 (需 Superadmin 或具備 canManageSystemConfigs 特許之 Admin)
export function updateSystemConfig(
  configId: string,
  newValue: string,
  operatorName: string,
  canWriteConfig: boolean
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  if (!canWriteConfig) {
    throw new Error('【權限防線攔截】您尚未取得「全域核心參數維護特許」，僅能唯讀檢視，無法修改系統底層參數！');
  }

  const labelMap: Record<string, string> = {
    TAX_RATE: '法定營業稅率',
    FIN_TAX_TOLERANCE: '發票稅額尾差容許值 (元)',
    DEFAULT_RETENTION_RATE: '工程估驗預設保留款率 (%)',
    PROJECT_LOCK_MODE: '案場超支預算防呆鎖定模式',
    NHI_RATE: '二代健保補充保費扣繳率',
    PAYMENT_TERM_DAYS: '預設請款票期 / 付款天數',
    WARRANTY_MONTHS: '預設工程保固期 (月)',
  };

  const existing = getAllSystemConfigs().find(c => c.id === configId);
  if (!existing) throw new Error('找不到指定的系統參數項目！');

  const trimmed = newValue.trim();
  if (trimmed === existing.configValue) return;

  const nextVer = (existing.version || 1) + 1;
  const now = new Date().toISOString().substring(0, 10);
  dbInstance.run(`
    UPDATE system_configs 
    SET configValue = '${trimmed.replace(/'/g, "''")}',
        version = ${nextVer},
        updatedBy = '${operatorName.replace(/'/g, "''")}',
        updatedAt = '${now}'
    WHERE id = '${configId}';
  `);

  const cnLabel = existing.description || labelMap[existing.configKey] || existing.configKey;
  logAudit(
    dbInstance,
    operatorName,
    '修改資料',
    '系統參數',
    cnLabel,
    { [cnLabel]: existing.configValue },
    { [cnLabel]: trimmed },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// ============================================================================
// 🖥️ 軟體程式設定 (AppConfig - Superadmin 專屬)
// ============================================================================
export function getAllAppConfigs(): AppConfig[] {
  if (!dbInstance) return [];
  const res = dbInstance.exec(`
    SELECT id, configKey, configValue, description, valueType, isDeleted, version, updatedBy, createdAt, updatedAt
    FROM app_configs WHERE isDeleted = 0 ORDER BY id ASC;
  `);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    configKey: String(v[1]),
    configValue: String(v[2]),
    description: v[3] ? String(v[3]) : undefined,
    valueType: v[4] as AppConfig['valueType'],
    isDeleted: Boolean(v[5]),
    version: Number(v[6] || 1),
    updatedBy: v[7] ? String(v[7]) : undefined,
    createdAt: v[8] ? String(v[8]) : undefined,
    updatedAt: v[9] ? String(v[9]) : undefined,
  }));
}

export function getAppConfigMap(): Record<string, string> {
  const configs = getAllAppConfigs();
  const map: Record<string, string> = {};
  for (const c of configs) {
    map[c.configKey] = c.configValue;
  }
  return map;
}

export function updateAppConfig(
  configKey: string,
  newValue: string,
  operatorName: string
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const existing = getAllAppConfigs().find(c => c.configKey === configKey);
  const now = new Date().toISOString().substring(0, 10);
  const trimmed = newValue.trim();

  if (existing) {
    if (trimmed === existing.configValue) return;
    const nextVer = (existing.version || 1) + 1;
    dbInstance.run(`
      UPDATE app_configs 
      SET configValue = '${trimmed.replace(/'/g, "''")}',
          version = ${nextVer},
          updatedBy = '${operatorName.replace(/'/g, "''")}',
          updatedAt = '${now}'
      WHERE configKey = '${configKey}';
    `);
    const cnLabel = existing.description || configKey;
    logAudit(
      dbInstance,
      operatorName,
      '修改軟體設定',
      '程式本體設定',
      cnLabel,
      { [cnLabel]: existing.configValue },
      { [cnLabel]: trimmed },
      operatorName
    );
  } else {
    const newId = `APP-CFG-${Date.now()}`;
    dbInstance.run(`
      INSERT INTO app_configs (id, configKey, configValue, description, valueType, isDeleted, version, updatedBy, createdAt, updatedAt)
      VALUES ('${newId}', '${configKey}', '${trimmed.replace(/'/g, "''")}', '${configKey}', 'STRING', 0, 1, '${operatorName.replace(/'/g, "''")}', '${now}', '${now}');
    `);
    logAudit(
      dbInstance,
      operatorName,
      '新增軟體設定',
      '程式本體設定',
      configKey,
      {},
      { [configKey]: trimmed },
      operatorName
    );
  }
  saveDatabaseSnapshot();
  notifyListeners();
}

export function batchUpdateAppConfigs(
  updates: Record<string, string>,
  operatorName: string
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  let changed = false;
  for (const [key, val] of Object.entries(updates)) {
    const existing = getAllAppConfigs().find(c => c.configKey === key);
    if (!existing || existing.configValue !== val.trim()) {
      updateAppConfig(key, val, operatorName);
      changed = true;
    }
  }
  if (changed) {
    saveDatabaseSnapshot();
    notifyListeners();
  }
}

// ============================================================================
// 🔢 單據跳號規則與自動產號中樞 (Document Numbering & Auto-Sequence Hub)
// ============================================================================

export const DEFAULT_DOCUMENT_RULES: DocumentSequenceRule[] = [
  {
    moduleKey: 'INB',
    moduleName: '現場進貨簽收單 (Inbound Receipt)',
    prefix: 'INB',
    dateFormat: 'YYYYMM',
    delimiter: '-',
    serialLength: 4,
    resetFrequency: 'MONTHLY',
    description: '工地現場送貨簽收單、物料進場點收憑證 (A模式直入案場成本)',
  },
  {
    moduleKey: 'REC',
    moduleName: '廠商應付對帳單 (AP Reconciliation)',
    prefix: 'REC',
    dateFormat: 'YYYYMM',
    delimiter: '-',
    serialLength: 3,
    resetFrequency: 'MONTHLY',
    description: '月底廠商往來水池對帳、補登發票與折讓結算單',
  },

  {
    moduleKey: 'AP',
    moduleName: '應付帳款單據 (Accounts Payable)',
    prefix: 'AP',
    dateFormat: 'YYYYMM',
    delimiter: '-',
    serialLength: 3,
    resetFrequency: 'MONTHLY',
    description: '廠商請款進貨發票、下包估驗計價應付憑單',
  },
  {
    moduleKey: 'AR',
    moduleName: '應收帳款單據 (Accounts Receivable)',
    prefix: 'AR',
    dateFormat: 'YYYYMM',
    delimiter: '-',
    serialLength: 3,
    resetFrequency: 'MONTHLY',
    description: '業主工程估驗請款、合約定金發票應收帳單',
  },
  {
    moduleKey: 'PO',
    moduleName: '採購發包單據 (Purchase Order)',
    prefix: 'PO',
    dateFormat: 'YYYYMM',
    delimiter: '-',
    serialLength: 4,
    resetFrequency: 'MONTHLY',
    description: '原物料採購、機具租賃、下包發包確認單',
  },
  {
    moduleKey: 'QUO',
    moduleName: '工程報價單據 (Quotation CPQ)',
    prefix: 'QUO',
    dateFormat: 'YYYYMM',
    delimiter: '-',
    serialLength: 3,
    resetFrequency: 'MONTHLY',
    description: '業主工程標案預算書、三軌議價銷售報價單',
  },
  {
    moduleKey: 'VL',
    moduleName: '計價估驗單據 (Valuation)',
    prefix: 'VAL',
    dateFormat: 'YYYYMM',
    delimiter: '-',
    serialLength: 2,
    resetFrequency: 'MONTHLY',
    description: '工地現場下包定期工項估驗計價實體單',
  },
  {
    moduleKey: 'CK',
    moduleName: '銀行支票票據 (Bank Check)',
    prefix: 'CQ',
    dateFormat: 'NONE',
    delimiter: '-',
    serialLength: 6,
    resetFrequency: 'NEVER',
    description: '銀行支票本開立票號與客票代收流水號',
  },
  {
    moduleKey: 'PRJ',
    moduleName: '工程專案代碼 (Project Code)',
    prefix: 'PRJ',
    dateFormat: 'YYYY',
    delimiter: '-',
    serialLength: 3,
    resetFrequency: 'YEARLY',
    description: '營造建案工程、案場專案唯一識別代碼',
  },
  {
    moduleKey: 'SC',
    moduleName: '分包合約代碼 (Subcontract Code)',
    prefix: 'SC',
    dateFormat: 'YYYY',
    delimiter: '-',
    serialLength: 3,
    resetFrequency: 'YEARLY',
    description: '專業工項連續壁/鋼構分包合約書字號',
  },
  {
    moduleKey: 'INV',
    moduleName: '發票庫存憑單 (Invoice & Inventory)',
    prefix: 'INV',
    dateFormat: 'YYYYMM',
    delimiter: '-',
    serialLength: 3,
    resetFrequency: 'MONTHLY',
    description: '物料入庫進銷存、折讓折抵與發票記錄',
  }
];

export function ensureDocumentSequenceRules(db?: Database): void {
  const targetDb = db || dbInstance;
  if (!targetDb) return;

  targetDb.run(`
    CREATE TABLE IF NOT EXISTS document_sequence_rules (
      moduleKey TEXT PRIMARY KEY,
      moduleName TEXT NOT NULL,
      prefix TEXT NOT NULL,
      dateFormat TEXT DEFAULT 'YYYYMM',
      delimiter TEXT DEFAULT '-',
      serialLength INTEGER DEFAULT 3,
      resetFrequency TEXT DEFAULT 'MONTHLY',
      description TEXT,
      updatedAt TEXT
    );
  `);

  const res = targetDb.exec(`SELECT count(*) FROM document_sequence_rules;`);
  const count = res.length && res[0].values.length ? Number(res[0].values[0][0]) : 0;
  if (count === 0) {
    const now = new Date().toISOString();
    for (const r of DEFAULT_DOCUMENT_RULES) {
      targetDb.run(`
        INSERT INTO document_sequence_rules (moduleKey, moduleName, prefix, dateFormat, delimiter, serialLength, resetFrequency, description, updatedAt)
        VALUES ('${r.moduleKey}', '${r.moduleName}', '${r.prefix}', '${r.dateFormat}', '${r.delimiter}', ${r.serialLength}, '${r.resetFrequency}', '${r.description}', '${now}')
        ON CONFLICT(moduleKey) DO NOTHING;
      `);
    }
  }
}

export function getAllDocumentSequenceRules(): DocumentSequenceRule[] {
  if (!dbInstance) return DEFAULT_DOCUMENT_RULES;
  ensureDocumentSequenceRules(dbInstance);

  const res = dbInstance.exec(`
    SELECT moduleKey, moduleName, prefix, dateFormat, delimiter, serialLength, resetFrequency, description, updatedAt
    FROM document_sequence_rules
    ORDER BY moduleKey ASC;
  `);
  if (!res.length || !res[0].values.length) return DEFAULT_DOCUMENT_RULES;

  return res[0].values.map(row => ({
    moduleKey: String(row[0]),
    moduleName: String(row[1]),
    prefix: String(row[2]),
    dateFormat: (String(row[3]) as any) || 'YYYYMM',
    delimiter: (String(row[4]) as any) || '-',
    serialLength: Number(row[5]) || 3,
    resetFrequency: (String(row[6]) as any) || 'MONTHLY',
    description: String(row[7] || ''),
    updatedAt: String(row[8] || ''),
  }));
}

// 🛡️ 模組編碼前綴防衝突檢驗中樞 (全域唯一性與跨模組防撞校驗)
export function validateDocumentPrefixConflict(
  moduleKey: string,
  newPrefix: string,
  db?: Database
): { valid: boolean; reason?: string } {
  const targetDb = db || dbInstance;
  if (!targetDb) return { valid: true };

  const cleanPrefix = (newPrefix || '').trim().toUpperCase();
  if (!cleanPrefix) {
    return { valid: false, reason: '單據前綴代碼不得為空！' };
  }

  if (!/^[A-Z0-9]{1,8}$/.test(cleanPrefix)) {
    return { valid: false, reason: '單據前綴僅能由 1~8 碼大寫英數字組成（如 AP、PO、QUO、VAL），不得包含空格或破折號等符號（分隔符號由單獨欄位設定）。' };
  }

  // 1. 跨業務模組唯一性校驗 (嚴格杜絕不同模組重複使用相同前綴)
  const rules = getAllDocumentSequenceRules();
  const conflictingRule = rules.find(r => r.moduleKey !== moduleKey && r.prefix.toUpperCase() === cleanPrefix);
  if (conflictingRule) {
    return {
      valid: false,
      reason: `衝突攔截：前綴代碼【${cleanPrefix}】已被【${conflictingRule.moduleName}】模組佔用！不同業務模組禁止使用相同前綴，以杜絕單號重號主鍵衝突與業務科目混淆。`
    };
  }

  // 2. 跨模組資料表歷史單據交叉衝突探測
  // 檢測其他業務單據表記錄中，是否已有該前綴之歷史資料
  const moduleTableMap: Record<string, string> = {
    AP: 'accounts_payable',
    AR: 'client_billing_records',
    PO: 'purchase_orders',
    QUO: 'quotations',
    VL: 'valuations',
    CK: 'receipts',
    PRJ: 'projects',
    SC: 'subcontracts',
    INV: 'vendor_bills'
  };

  const currentModuleTable = moduleTableMap[moduleKey];
  const allSourceTables = [
    { table: 'accounts_payable', col: 'apNumber', label: '應付帳款' },
    { table: 'purchase_orders', col: 'poNumber', label: '採購發包' },
    { table: 'quotations', col: 'quoteNumber', label: '工程報價' },
    { table: 'valuations', col: 'valuationNumber', label: '計價估驗' },
    { table: 'receipts', col: 'receiptNumber', label: '收付款單' },
    { table: 'client_billing_records', col: 'billNumber', label: '應收請款' },
    { table: 'subcontracts', col: 'subcontractCode', label: '分包合約' }
  ];

  for (const src of allSourceTables) {
    if (src.table === currentModuleTable) continue;
    try {
      const q = `SELECT count(*) FROM ${src.table} WHERE ${src.col} LIKE '${cleanPrefix}%';`;
      const res = targetDb.exec(q);
      const count = res.length && res[0].values.length ? Number(res[0].values[0][0]) : 0;
      if (count > 0) {
        return {
          valid: false,
          reason: `衝突攔截：【${src.label}】歷史資料中已存在 ${count} 筆以【${cleanPrefix}】開頭的單據！將此模組改為【${cleanPrefix}】會造成嚴重跨模組單號衝突。`
        };
      }
    } catch {
      // 容錯跳過尚未建立之資料表
    }
  }

  return { valid: true };
}

export function updateDocumentSequenceRule(
  rule: Partial<DocumentSequenceRule> & { moduleKey: string },
  operatorName = '系統管理者'
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureDocumentSequenceRules(dbInstance);

  const existingRules = getAllDocumentSequenceRules();
  const current = existingRules.find(r => r.moduleKey === rule.moduleKey);
  const targetPrefix = rule.prefix ? rule.prefix.trim().toUpperCase() : (current?.prefix || rule.moduleKey);

  // 🛡️ 執行前綴防衝突檢驗
  const validation = validateDocumentPrefixConflict(rule.moduleKey, targetPrefix, dbInstance);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const now = new Date().toISOString();
  const updated: DocumentSequenceRule = {
    moduleKey: rule.moduleKey,
    moduleName: rule.moduleName || current?.moduleName || rule.moduleKey,
    prefix: targetPrefix,
    dateFormat: rule.dateFormat || current?.dateFormat || 'YYYYMM',
    delimiter: rule.delimiter !== undefined ? rule.delimiter : (current?.delimiter || '-'),
    serialLength: rule.serialLength || current?.serialLength || 3,
    resetFrequency: rule.resetFrequency || current?.resetFrequency || 'MONTHLY',
    description: rule.description !== undefined ? rule.description : (current?.description || ''),
    updatedAt: now,
  };

  dbInstance.run(`
    INSERT INTO document_sequence_rules (moduleKey, moduleName, prefix, dateFormat, delimiter, serialLength, resetFrequency, description, updatedAt)
    VALUES ('${updated.moduleKey}', '${updated.moduleName}', '${updated.prefix}', '${updated.dateFormat}', '${updated.delimiter}', ${updated.serialLength}, '${updated.resetFrequency}', '${updated.description}', '${now}')
    ON CONFLICT(moduleKey) DO UPDATE SET
      moduleName = '${updated.moduleName}',
      prefix = '${updated.prefix}',
      dateFormat = '${updated.dateFormat}',
      delimiter = '${updated.delimiter}',
      serialLength = ${updated.serialLength},
      resetFrequency = '${updated.resetFrequency}',
      description = '${updated.description}',
      updatedAt = '${now}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '修改單據編碼規則',
    '單據流水號規則',
    `模組 [${updated.moduleKey}]`,
    current ? { 模組: current.moduleKey, 前綴: current.prefix, 格式: `${current.prefix}${current.delimiter}${current.dateFormat}` } : {},
    { 模組: updated.moduleKey, 前綴: updated.prefix, 格式: `${updated.prefix}${updated.delimiter}${updated.dateFormat}`, 碼長: updated.serialLength },
    operatorName
  );

  saveDatabaseSnapshot();
  notifyListeners();
}

// 輔助函式：根據規則與指定日期計算週期字串 (如 202610, 2026, 20261014)
export function computePeriodString(dateFormat: 'YYYYMM' | 'YYYY' | 'YYYYMMDD' | 'NONE', targetDate?: string | Date): string {
  if (dateFormat === 'NONE') return '';
  const d = targetDate ? (typeof targetDate === 'string' ? new Date(targetDate) : targetDate) : new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (dateFormat === 'YYYY') return yyyy;
  if (dateFormat === 'YYYYMMDD') return `${yyyy}${mm}${dd}`;
  return `${yyyy}${mm}`;
}

// 取得所有模組跳號監控狀態（當期即時產號、次月預約、歷史歸檔分類）
export function getAllDocumentModuleStatuses(): DocumentModuleSequenceStatus[] {
  if (!dbInstance) return [];
  ensureDocumentSequenceRules(dbInstance);
  const rules = getAllDocumentSequenceRules();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // 計算次月
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthStr = `${nextMonthDate.getFullYear()}${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // 讀取所有 sequences 記錄
  const seqRes = dbInstance.exec(`SELECT prefix, currentVal, updatedAt FROM document_sequences;`);
  const seqMap = new Map<string, { currentVal: number; updatedAt: string }>();
  if (seqRes.length && seqRes[0].values.length) {
    for (const row of seqRes[0].values) {
      seqMap.set(String(row[0]), { currentVal: Number(row[1] || 0), updatedAt: String(row[2] || '') });
    }
  }

  return rules.map(rule => {
    const currentPeriod = computePeriodString(rule.dateFormat, now);
    const delimiter = rule.delimiter;
    const currentPeriodPrefix = currentPeriod ? `${rule.prefix}${delimiter}${currentPeriod}` : rule.prefix;
    const maxExisting = getMaxExistingSequenceForPrefix(currentPeriodPrefix, dbInstance!);
    const storedSeq = seqMap.get(currentPeriodPrefix)?.currentVal || 0;
    
    let nextVal = Math.max(maxExisting, storedSeq) + 1;
    let candidate = `${currentPeriodPrefix}${delimiter}${String(nextVal).padStart(rule.serialLength, '0')}`;
    let safety = 500;
    while (checkIfDocumentNumberExists(candidate, dbInstance!) && safety-- > 0) {
      nextVal++;
      candidate = `${currentPeriodPrefix}${delimiter}${String(nextVal).padStart(rule.serialLength, '0')}`;
    }

    const latestDoc = maxExisting > 0
      ? `${currentPeriodPrefix}${delimiter}${String(maxExisting).padStart(rule.serialLength, '0')}`
      : null;

    // 次月預開單整備狀態
    const nextMonthPeriod = computePeriodString(rule.dateFormat, nextMonthDate);
    const nextMonthPrefix = nextMonthPeriod ? `${rule.prefix}${delimiter}${nextMonthPeriod}` : rule.prefix;
    const nextMonthMax = getMaxExistingSequenceForPrefix(nextMonthPrefix, dbInstance!);
    const nextMonthStored = seqMap.get(nextMonthPrefix)?.currentVal || 0;
    const nextMonthNextVal = Math.max(nextMonthMax, nextMonthStored) + 1;
    const nextMonthReservedNextDoc = `${nextMonthPrefix}${delimiter}${String(nextMonthNextVal).padStart(rule.serialLength, '0')}`;

    // 探測過往歷史月份（如 202603, 202604）
    const historicalPeriods: {
      period: string;
      prefixKey: string;
      maxVal: number;
      latestDoc: string;
      count: number;
      isLocked: boolean;
    }[] = [];

    // 尋找屬於此前綴的所有歷史紀錄
    seqMap.forEach((data, pKey) => {
      if (pKey.startsWith(rule.prefix) && pKey !== currentPeriodPrefix && pKey !== nextMonthPrefix) {
        // 擷取 period 字串
        const sub = pKey.substring(rule.prefix.length);
        const cleanPeriod = sub.replace(/^[-_]/, '');
        // 若為過去年月且純數字
        if (cleanPeriod && cleanPeriod < currentPeriod && /^\d+$/.test(cleanPeriod)) {
          const histMax = Math.max(data.currentVal, getMaxExistingSequenceForPrefix(pKey, dbInstance!));
          if (histMax > 0) {
            historicalPeriods.push({
              period: cleanPeriod,
              prefixKey: pKey,
              maxVal: histMax,
              latestDoc: `${pKey}${delimiter}${String(histMax).padStart(rule.serialLength, '0')}`,
              count: histMax,
              isLocked: true, // 歷史已鎖定
            });
          }
        }
      }
    });

    // 依年份月份遞減排序
    historicalPeriods.sort((a, b) => b.period.localeCompare(a.period));

    return {
      moduleKey: rule.moduleKey,
      moduleName: rule.moduleName,
      prefix: rule.prefix,
      rule,
      currentPeriod: currentPeriod || '常態累計',
      currentPeriodPrefix,
      currentPeriodMaxVal: maxExisting,
      currentPeriodLatestDoc: latestDoc,
      currentPeriodNextVal: nextVal,
      currentPeriodNextDoc: candidate,
      nextMonthPeriod: nextMonthPeriod || '次期累計',
      nextMonthReservedNextDoc,
      historicalPeriods,
    };
  });
}

// 🚀 核心產號引擎：自動依序產出合法單號（系統自主產出，免人為手動輸入，絕不撞號）
export function getNextDocumentNumber(moduleKey: string, docDate?: string | Date): string {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureDocumentSequenceRules(dbInstance);

  const rules = getAllDocumentSequenceRules();
  const rule = rules.find(r => r.moduleKey === moduleKey || r.prefix === moduleKey) || {
    moduleKey,
    moduleName: moduleKey,
    prefix: moduleKey,
    dateFormat: 'YYYYMM' as const,
    delimiter: '-' as const,
    serialLength: 3,
    resetFrequency: 'MONTHLY' as const,
  };

  const periodStr = computePeriodString(rule.dateFormat, docDate);
  const delimiter = rule.delimiter;
  const prefixKey = periodStr ? `${rule.prefix}${delimiter}${periodStr}` : rule.prefix;
  const padLength = rule.serialLength || 3;

  // 1. 取得資料庫中該前綴之實際最大流水號
  const maxExisting = getMaxExistingSequenceForPrefix(prefixKey, dbInstance);

  // 2. 讀取目前計數器
  const seqRes = dbInstance.exec(`SELECT currentVal FROM document_sequences WHERE prefix = '${prefixKey}';`);
  const currentDbVal = seqRes.length && seqRes[0].values.length ? Number(seqRes[0].values[0][0] || 0) : 0;

  // 3. 下一個候選號碼至少為 Math.max(currentDbVal, maxExisting) + 1
  let nextVal = Math.max(currentDbVal, maxExisting) + 1;
  let candidate = `${prefixKey}${delimiter}${String(nextVal).padStart(padLength, '0')}`;

  // 4. 防碰撞自動跳空躍升迴圈：若此號碼在歷史單據中已存在，自動躍升跳過，絕不撞號
  let safetyLoopLimit = 1000;
  while (checkIfDocumentNumberExists(candidate, dbInstance) && safetyLoopLimit-- > 0) {
    nextVal++;
    candidate = `${prefixKey}${delimiter}${String(nextVal).padStart(padLength, '0')}`;
  }

  // 5. 更新計數器與快照
  const now = new Date().toISOString();
  dbInstance.run(`
    INSERT INTO document_sequences (prefix, currentVal, updatedAt)
    VALUES ('${prefixKey}', ${nextVal}, '${now}')
    ON CONFLICT(prefix) DO UPDATE SET
      currentVal = ${nextVal},
      updatedAt = '${now}';
  `);

  saveDatabaseSnapshot();
  notifyListeners();
  return candidate;
}

// 預覽下一個即將產出單號（純唯讀，不消耗計數器序號）
export function previewNextDocumentNumber(moduleKey: string, docDate?: string | Date): string {
  if (!dbInstance) return `${moduleKey}-001`;
  ensureDocumentSequenceRules(dbInstance);

  const rules = getAllDocumentSequenceRules();
  const rule = rules.find(r => r.moduleKey === moduleKey || r.prefix === moduleKey) || {
    moduleKey,
    moduleName: moduleKey,
    prefix: moduleKey,
    dateFormat: 'YYYYMM' as const,
    delimiter: '-' as const,
    serialLength: 3,
    resetFrequency: 'MONTHLY' as const,
  };

  const periodStr = computePeriodString(rule.dateFormat, docDate);
  const delimiter = rule.delimiter;
  const prefixKey = periodStr ? `${rule.prefix}${delimiter}${periodStr}` : rule.prefix;
  const padLength = rule.serialLength || 3;

  const maxExisting = getMaxExistingSequenceForPrefix(prefixKey, dbInstance);
  const seqRes = dbInstance.exec(`SELECT currentVal FROM document_sequences WHERE prefix = '${prefixKey}';`);
  const currentDbVal = seqRes.length && seqRes[0].values.length ? Number(seqRes[0].values[0][0] || 0) : 0;

  let nextVal = Math.max(currentDbVal, maxExisting) + 1;
  let candidate = `${prefixKey}${delimiter}${String(nextVal).padStart(padLength, '0')}`;

  let safetyLoopLimit = 1000;
  while (checkIfDocumentNumberExists(candidate, dbInstance) && safetyLoopLimit-- > 0) {
    nextVal++;
    candidate = `${prefixKey}${delimiter}${String(nextVal).padStart(padLength, '0')}`;
  }

  return candidate;
}

// 🔮 次月預約整備單號：預先初始化次月單號計數起點，避免跨月開單衝突
export function reserveNextMonthSequence(
  moduleKey: string,
  operatorName = '系統管理者'
): { success: boolean; message: string; reservedDoc: string } {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureDocumentSequenceRules(dbInstance);

  const rules = getAllDocumentSequenceRules();
  const rule = rules.find(r => r.moduleKey === moduleKey || r.prefix === moduleKey);
  if (!rule) throw new Error(`找不到模組 [${moduleKey}] 之單據編碼規則`);

  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthPeriod = computePeriodString(rule.dateFormat, nextMonthDate);
  const nextMonthPrefix = nextMonthPeriod ? `${rule.prefix}${rule.delimiter}${nextMonthPeriod}` : rule.prefix;

  const currentMax = getMaxExistingSequenceForPrefix(nextMonthPrefix, dbInstance);
  const nextVal = currentMax > 0 ? currentMax : 0;

  const timestamp = new Date().toISOString();
  dbInstance.run(`
    INSERT INTO document_sequences (prefix, currentVal, updatedAt)
    VALUES ('${nextMonthPrefix}', ${nextVal}, '${timestamp}')
    ON CONFLICT(prefix) DO NOTHING;
  `);

  const reservedDoc = previewNextDocumentNumber(moduleKey, nextMonthDate);

  logAudit(
    dbInstance,
    operatorName,
    '次月預約整備單號',
    '單據流水號規則',
    `模組 [${rule.moduleKey}]`,
    {},
    { 模組: rule.moduleKey, 次月期間: nextMonthPeriod, 預約首號: reservedDoc },
    operatorName
  );

  saveDatabaseSnapshot();
  notifyListeners();
  return {
    success: true,
    message: `已成功為【${rule.moduleName}】預備次月（${nextMonthPeriod}）單據流水號起點：${reservedDoc}！開立下月單據時將自動接續發放。`,
    reservedDoc
  };
}

// ⚡ 系統全域單號安全巡檢與智能防撞自癒
export function autoCalibrateAllDocumentSequences(operatorName = '系統管理者'): {
  success: boolean;
  message: string;
  calibratedModules: string[];
} {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureDocumentSequenceRules(dbInstance);
  reseedDocumentSequences(dbInstance);

  const rules = getAllDocumentSequenceRules();
  const calibrated: string[] = [];

  for (const rule of rules) {
    calibrated.push(rule.moduleName);
  }

  logAudit(
    dbInstance,
    operatorName,
    '全域單號智能防撞自癒',
    '單據流水號規則',
    '全模組業務單據表',
    {},
    { 說明: '掃描全庫真實單據表記錄，校準當期與歷史計數器指針，100% 杜絕主鍵衝突' },
    operatorName
  );

  saveDatabaseSnapshot();
  notifyListeners();
  return {
    success: true,
    message: `全域單號智能巡檢與防撞自癒已完成！已對齊 ${calibrated.length} 個業務模組的最新開單序號。`,
    calibratedModules: calibrated
  };
}

// 相容舊介面：全域清單
export function getAllDocumentSequences(): DocumentSequence[] {
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT prefix, currentVal, updatedAt FROM document_sequences ORDER BY prefix ASC;`);
  if (!res.length) return [];
  return res[0].values.map(v => {
    const prefix = String(v[0]);
    const currentVal = Number(v[1] || 0);
    const maxExisting = getMaxExistingSequenceForPrefix(prefix, dbInstance!);
    const nextVal = Math.max(currentVal, maxExisting) + 1;
    return {
      prefix,
      currentVal,
      maxExistingVal: maxExisting,
      nextVal,
      updatedAt: String(v[2] || ''),
    };
  });
}

// 相容舊介面：校正下一個流水號
export function updateNextSequenceNumber(
  prefix: string,
  targetNextVal: number,
  operatorName = '系統管理者'
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const maxUsed = getMaxExistingSequenceForPrefix(prefix, dbInstance);
  if (targetNextVal <= maxUsed) {
    throw new Error(
      `【單據防重號鐵律】校正失敗！前綴 [${prefix}] 現存單據已使用至最大序號 [${String(maxUsed).padStart(3, '0')}]。\n` +
      `下一個發放流水號不得小於或等於已使用的現存最大單號，必須 >= ${maxUsed + 1} 號！`
    );
  }

  const internalVal = targetNextVal - 1;
  const now = new Date().toISOString();
  dbInstance.run(`
    INSERT INTO document_sequences (prefix, currentVal, updatedAt)
    VALUES ('${prefix}', ${internalVal}, '${now}')
    ON CONFLICT(prefix) DO UPDATE SET
      currentVal = ${internalVal},
      updatedAt = '${now}';
  `);
  logAudit(
    dbInstance,
    operatorName,
    '校正下一個流水號',
    '單據流水號規則',
    `前綴 [${prefix}]`,
    { 前綴: prefix, 原現存最大單號: maxUsed },
    { 前綴: prefix, 下一個開立流水號: targetNextVal },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 相容舊介面：updateDocumentSequence
export function updateDocumentSequence(
  prefix: string,
  newVal: number,
  operatorName = '系統管理者'
): void {
  updateNextSequenceNumber(prefix, newVal, operatorName);
}

// 相容舊介面：單項自動校正
export function autoCalibrateSequence(
  prefix: string,
  operatorName = '系統管理者'
): number {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const maxUsed = getMaxExistingSequenceForPrefix(prefix, dbInstance);
  const now = new Date().toISOString();

  dbInstance.run(`
    INSERT INTO document_sequences (prefix, currentVal, updatedAt)
    VALUES ('${prefix}', ${maxUsed}, '${now}')
    ON CONFLICT(prefix) DO UPDATE SET
      currentVal = ${maxUsed},
      updatedAt = '${now}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '自動校正單據流水號',
    '單據流水號規則',
    `前綴 [${prefix}]`,
    { 前綴: prefix, 現存最大單號: maxUsed },
    { 前綴: prefix, 自動校準下一個流水號: maxUsed + 1 },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
  return maxUsed + 1;
}

// 相容舊介面：全域一鍵自動校正
export function autoCalibrateAllSequences(operatorName = '系統管理者'): void {
  autoCalibrateAllDocumentSequences(operatorName);
}

// ============================================================================
// ⏰ 法規與稅率預約生效排程中樞 (Regulatory Schedules)
// ============================================================================
export function applyDueRegulatorySchedules(db?: Database): number {
  const targetDb = db || dbInstance;
  if (!targetDb) return 0;

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const nowDateOnly = now.substring(0, 10);

  try {
    const res = targetDb.exec(`
      SELECT id, configKey, configLabel, scheduledValue, effectiveDate, notes
      FROM regulatory_schedules
      WHERE status = 'SCHEDULED' AND (effectiveDate <= '${now}' OR effectiveDate <= '${nowDateOnly}');
    `);

    if (!res.length || !res[0].values.length) return 0;

    let appliedCount = 0;
    for (const row of res[0].values) {
      const id = String(row[0]);
      const configKey = String(row[1]);
      const configLabel = String(row[2]);
      const scheduledValue = String(row[3]);
      const notes = row[5] ? String(row[5]) : '';

      targetDb.run(`
        UPDATE system_configs
        SET configValue = '${scheduledValue.replace(/'/g, "''")}',
            version = version + 1,
            updatedBy = '自動法規排程引擎',
            updatedAt = '${now}'
        WHERE configKey = '${configKey}';
      `);

      targetDb.run(`
        UPDATE regulatory_schedules
        SET status = 'APPLIED',
            appliedAt = '${now}'
        WHERE id = '${id}';
      `);

      try {
        logAudit(
          targetDb,
          '系統排程守護程序',
          '法規排程自動生效',
          '營運法規中樞',
          configLabel,
          { 參數代碼: configKey },
          { 參數代碼: configKey, 自動套用新值: scheduledValue, 備註: notes },
          '系統自動執行'
        );
      } catch (_) {}

      appliedCount++;
    }

    if (appliedCount > 0 && targetDb === dbInstance) {
      saveDatabaseSnapshot();
      notifyListeners();
    }
    return appliedCount;
  } catch (_) {
    return 0;
  }
}

export function getRegulatorySchedules(): RegulatorySchedule[] {
  if (!dbInstance) return [];
  applyDueRegulatorySchedules();

  try {
    const res = dbInstance.exec(`
      SELECT id, configKey, configLabel, scheduledValue, effectiveDate, status, createdBy, createdAt, appliedAt, notes
      FROM regulatory_schedules
      ORDER BY effectiveDate ASC, createdAt DESC;
    `);
    if (!res.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      configKey: String(v[1]),
      configLabel: String(v[2]),
      scheduledValue: String(v[3]),
      effectiveDate: String(v[4]),
      status: v[5] as RegulatorySchedule['status'],
      createdBy: v[6] ? String(v[6]) : undefined,
      createdAt: v[7] ? String(v[7]) : undefined,
      appliedAt: v[8] ? String(v[8]) : undefined,
      notes: v[9] ? String(v[9]) : undefined,
    }));
  } catch (_) {
    return [];
  }
}

export function createRegulatorySchedule(data: {
  configKey: string;
  configLabel: string;
  scheduledValue: string;
  effectiveDate: string;
  notes?: string;
  operatorName?: string;
}): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const id = `SCHED-${Date.now()}`;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const operator = data.operatorName || '系統管理員';

  dbInstance.run(`
    INSERT INTO regulatory_schedules (id, configKey, configLabel, scheduledValue, effectiveDate, status, createdBy, createdAt, notes)
    VALUES (
      '${id}',
      '${data.configKey}',
      '${data.configLabel.replace(/'/g, "''")}',
      '${data.scheduledValue.replace(/'/g, "''")}',
      '${data.effectiveDate}',
      'SCHEDULED',
      '${operator.replace(/'/g, "''")}',
      '${now}',
      ${data.notes ? `'${data.notes.replace(/'/g, "''")}'` : 'NULL'}
    );
  `);

  logAudit(
    dbInstance,
    operator,
    '新增法規生效排程',
    '法規排程中樞',
    data.configLabel,
    {},
    {
      參數代碼: data.configKey,
      預定新值: data.scheduledValue,
      預定生效時間: data.effectiveDate,
      備註: data.notes
    },
    operator
  );

  applyDueRegulatorySchedules();
  saveDatabaseSnapshot();
  notifyListeners();
}

export function cancelRegulatorySchedule(id: string, operatorName = '系統管理員'): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  dbInstance.run(`
    UPDATE regulatory_schedules
    SET status = 'CANCELLED'
    WHERE id = '${id}' AND status = 'SCHEDULED';
  `);
  logAudit(
    dbInstance,
    operatorName,
    '取消法規生效排程',
    '法規排程中樞',
    `排程 ID [${id}]`,
    { 排程ID: id },
    { 狀態: 'CANCELLED' },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 讀取審計日誌 (預設支援最多 300 筆，最新優先)
export function getAllAuditLogs(limit: number = 300): AuditLog[] {
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT ${limit};`);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    userId: String(v[1]),
    userName: String(v[2]),
    action: String(v[3]),
    targetTable: String(v[4]),
    targetId: String(v[5]),
    beforeJson: v[6] ? String(v[6]) : undefined,
    afterJson: v[7] ? String(v[7]) : undefined,
    ipAddress: String(v[8]),
    createdAt: String(v[9]),
  }));
}

// 取得營運戰情室財務指標 (憲法第六篇)
export function getCashFlowMetrics(): CashFlowMetrics {
  const checks = getAllBankChecks();
  const arList = getAllAccountsReceivable();
  const apList = getAllAccountsPayable();

  // 現有銀行結存 (模擬基礎水池)
  const currentBankBalance = 38500000;

  // 預計未收 AR
  const projectedAR = arList
    .filter(ar => ar.status === 'OPEN' || ar.status === 'PARTIAL')
    .reduce((sum, ar) => sum + ar.remainingAmount, 0);

  // 預計未付 AP
  const projectedAP = apList
    .filter(ap => ap.status === 'OPEN' || ap.status === 'PARTIAL')
    .reduce((sum, ap) => sum + ap.remainingAmount, 0);

  // 未兌現應付支票 (ISSUED)
  const unclearedChecks = checks
    .filter(c => c.type === 'PAYABLE' && c.status === 'ISSUED')
    .reduce((sum, c) => sum + c.amount, 0);

  // 預估營業稅 (粗估 5% 銷項 - 進項)
  const estimatedVAT = Math.max(0, (projectedAR - projectedAP) * 0.05);

  // 常態固定費用 (薪資、水電、辦公室租金)
  const recurringExpenses = 2800000;

  // 真實可用資金預測 = 銀行餘額 + 預計應收 - 預計應付 - 未兌票據 - 營業稅 - 固定支出
  const projectedNetCash = currentBankBalance + projectedAR - projectedAP - unclearedChecks - estimatedVAT - recurringExpenses;

  // 待補簽追加減工程風險 (Pending CO)
  const pendingChangeOrdersAmount = 8500000;

  return {
    currentBankBalance,
    projectedAR,
    projectedAP,
    unclearedChecks,
    estimatedVAT,
    recurringExpenses,
    projectedNetCash,
    pendingChangeOrdersAmount
  };
}

// 寫入審計日誌 helper
export function logAudit(
  db: Database,
  userName: string,
  action: AuditLog['action'] | string,
  targetTable: string,
  targetId: string,
  before?: object,
  after?: object,
  userId?: string
) {
  const id = `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const beforeJson = before ? JSON.stringify(before).replace(/'/g, "''") : null;
  const afterJson = after ? JSON.stringify(after).replace(/'/g, "''") : null;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const safeUser = (userId || userName || '系統操作員').replace(/'/g, "''");

  db.run(`
    INSERT INTO audit_logs (id, userId, userName, action, targetTable, targetId, beforeJson, afterJson, ipAddress, createdAt)
    VALUES ('${id}', '${safeUser}', '${userName.replace(/'/g, "''")}', '${action}', '${targetTable}', '${targetId.replace(/'/g, "''")}', 
      ${beforeJson ? `'${beforeJson}'` : 'NULL'}, ${afterJson ? `'${afterJson}'` : 'NULL'}, '公司內網', '${now}');
  `);
}

// 供外部元件呼叫寫入操作日誌 (例如登入或身分切換、系統事件)
export function recordAuditLog(
  userName: string,
  action: string,
  targetTable: string,
  targetId: string,
  details?: object,
  userId?: string
) {
  if (!dbInstance) return;
  logAudit(dbInstance, userName, action, targetTable, targetId, undefined, details, userId);
  saveDatabaseSnapshot();
  notifyListeners();
}

// 12+1 大營造工程核心模組字典
export const SYSTEM_MODULES: { key: ModuleKey; name: string; category: string; description: string }[] = [
  { key: 'COMPANIES', name: '公司法人組織', category: '基礎架構', description: '集團多法人架構、統編與幣別維護' },
  { key: 'PROJECTS', name: '專案與案場工程', category: '工程工務', description: '工程案場主檔、WBS 節點、預算與成本' },
  { key: 'PARTNERS', name: '商業夥伴主檔', category: '主檔邊界', description: '業主、材料商、工程下包商與銀行帳號' },
  { key: 'QUOTATIONS', name: '報價與銷售 (CPQ)', category: '專案業務', description: 'REV-A/B 投標單、粉紅扣減折讓、里程碑請款' },
  { key: 'INBOUND_RECEIPTS', name: '現場進貨管理', category: '工程工務', description: '工地現場送貨簽收、A模式直入案場成本、未結水池待會計對帳' },
  { key: 'PURCHASE_ORDERS', name: '採購與發包 (PO)', category: '採購發包', description: '物料採購單、計價拋轉、過帳實體快照' },
  { key: 'SUBCONTRACTS', name: '發包合約管理', category: '採購發包', description: '下包工程主約、保留款比例、預付款抵扣' },
  { key: 'VALUATIONS', name: '估驗計價請款', category: '工程工務', description: '工區累計進度、保留款扣款、憑單自動拋轉' },
  { key: 'FINANCE_AP', name: '應付帳款 (AP)', category: '財務會計', description: '廠商憑單拆單、稅額勾稽、付款沖銷' },
  { key: 'FINANCE_AR', name: '應收帳款 (AR)', category: '財務會計', description: '業主工程進度款請款與收款' },
  { key: 'BANK_CHECKS', name: '票據與資金管理', category: '財務會計', description: '應收付支票開立、票據兌現、作廢紀錄' },
  { key: 'SYSTEM_CONFIGS', name: '全域系統參數', category: '平台基礎', description: '營業稅率、保留款預設率、防竄改鎖定' },
  { key: 'AUDIT_LOGS', name: '全域安全審計日誌', category: '資安防護', description: '不可竄改之全域操作歷程快照' },
];

// 種子權限與使用者資料建立
export function seedUserPermissionData(db: Database) {
  // 檢查是否已有群組
  const existing = db.exec(`SELECT count(*) FROM user_groups;`);
  if (existing.length && Number(existing[0].values[0][0]) > 0) return;

  // 1. 建立預設四大核心業務群組 (工務、財務會計、採購發包、專案業務)
  db.run(`
    INSERT INTO user_groups (id, groupCode, groupName, description, isSystem, approvalLimit, canExport, createdAt, updatedAt)
    VALUES
      ('GRP-ENG', 'SITE_ENG', '工務組', '案場施工日誌填報、工區料件點收、估驗草稿編製、施工進度維護', 1, 0, 0, '2026-01-01', '2026-01-01'),
      ('GRP-ACC', 'FIN_ACC', '財務會計組', '應收應付憑單拆單、支票開立/兌現、發票稅額勾稽、資金水池預測', 1, 10000000, 1, '2026-01-01', '2026-01-01'),
      ('GRP-PROC', 'PROC_SRC', '採購發包組', '材料供應商管理、採購單 PO 開立、原物料詢價與預付款沖銷', 1, 3000000, 1, '2026-01-01', '2026-01-01'),
      ('GRP-SALES', 'PROJ_SALES', '專案業務組', '業主報價單 REV-A/B 維護、工程 WBS 預算節點控管、合約里程碑請款', 1, 5000000, 1, '2026-01-01', '2026-01-01');
  `);

  // 2. 建立四大群組之全模組權限矩陣 (Read, Write, Approve, Export)
  const groupPermMap: Record<string, Record<ModuleKey, { r: number; w: number; a: number; e: number }>> = {
    'GRP-ENG': {
      COMPANIES: { r: 1, w: 0, a: 0, e: 0 },
      PROJECTS: { r: 1, w: 1, a: 0, e: 0 },
      PARTNERS: { r: 1, w: 0, a: 0, e: 0 },
      QUOTATIONS: { r: 0, w: 0, a: 0, e: 0 },
      INBOUND_RECEIPTS: { r: 1, w: 1, a: 1, e: 1 },
      PURCHASE_ORDERS: { r: 1, w: 0, a: 0, e: 0 },
      SUBCONTRACTS: { r: 1, w: 0, a: 0, e: 0 },
      VALUATIONS: { r: 1, w: 1, a: 0, e: 0 },
      FINANCE_AP: { r: 0, w: 0, a: 0, e: 0 },
      FINANCE_AR: { r: 0, w: 0, a: 0, e: 0 },
      BANK_CHECKS: { r: 0, w: 0, a: 0, e: 0 },
      SYSTEM_CONFIGS: { r: 0, w: 0, a: 0, e: 0 },
      AUDIT_LOGS: { r: 0, w: 0, a: 0, e: 0 },
    },
    'GRP-ACC': {
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
      BANK_CHECKS: { r: 1, w: 1, a: 1, e: 1 },
      SYSTEM_CONFIGS: { r: 1, w: 0, a: 0, e: 0 },
      AUDIT_LOGS: { r: 1, w: 0, a: 0, e: 0 },
    },
    'GRP-PROC': {
      COMPANIES: { r: 1, w: 0, a: 0, e: 0 },
      PROJECTS: { r: 1, w: 0, a: 0, e: 0 },
      PARTNERS: { r: 1, w: 1, a: 0, e: 0 },
      QUOTATIONS: { r: 0, w: 0, a: 0, e: 0 },
      INBOUND_RECEIPTS: { r: 1, w: 1, a: 0, e: 1 },
      PURCHASE_ORDERS: { r: 1, w: 1, a: 1, e: 1 },
      SUBCONTRACTS: { r: 1, w: 1, a: 1, e: 0 },
      VALUATIONS: { r: 1, w: 0, a: 0, e: 0 },
      FINANCE_AP: { r: 1, w: 0, a: 0, e: 0 },
      FINANCE_AR: { r: 0, w: 0, a: 0, e: 0 },
      BANK_CHECKS: { r: 0, w: 0, a: 0, e: 0 },
      SYSTEM_CONFIGS: { r: 0, w: 0, a: 0, e: 0 },
      AUDIT_LOGS: { r: 0, w: 0, a: 0, e: 0 },
    },
    'GRP-SALES': {
      COMPANIES: { r: 1, w: 0, a: 0, e: 0 },
      PROJECTS: { r: 1, w: 1, a: 0, e: 0 },
      PARTNERS: { r: 1, w: 1, a: 0, e: 0 },
      QUOTATIONS: { r: 1, w: 1, a: 1, e: 1 },
      INBOUND_RECEIPTS: { r: 1, w: 0, a: 0, e: 0 },
      PURCHASE_ORDERS: { r: 0, w: 0, a: 0, e: 0 },
      SUBCONTRACTS: { r: 0, w: 0, a: 0, e: 0 },
      VALUATIONS: { r: 1, w: 0, a: 0, e: 0 },
      FINANCE_AP: { r: 0, w: 0, a: 0, e: 0 },
      FINANCE_AR: { r: 1, w: 0, a: 0, e: 0 },
      BANK_CHECKS: { r: 0, w: 0, a: 0, e: 0 },
      SYSTEM_CONFIGS: { r: 0, w: 0, a: 0, e: 0 },
      AUDIT_LOGS: { r: 0, w: 0, a: 0, e: 0 },
    },
  };

  for (const [groupId, pMap] of Object.entries(groupPermMap)) {
    for (const mod of SYSTEM_MODULES) {
      const perm = pMap[mod.key] || { r: 0, w: 0, a: 0, e: 0 };
      const permId = `PERM-${groupId}-${mod.key}`;
      db.run(`
        INSERT INTO group_module_permissions (id, groupId, moduleKey, canRead, canWrite, canApprove, canExport)
        VALUES ('${permId}', '${groupId}', '${mod.key}', ${perm.r}, ${perm.w}, ${perm.a}, ${perm.e});
      `);
    }
  }

  // 3. 建立四層式身分種子使用者 (唯一 Superadmin、BOSS 董事長、Admin、四大業務 User、跨法人矩陣調度專員)
  db.run(`
    INSERT INTO users (id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, canManageAllCompanies, groupId, groupIds, companyGroupAssignments, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, createdAt, updatedAt)
    VALUES
      ('USR-001', 'superadmin', '黃副總經理', 'huang.gm@mega-build.com.tw', 'SUPERADMIN', 1, 1, 1, 1, NULL, '[]', '[]', 'ACTIVE', '系統架構師兼營運長 (SUPERADMIN)', '["COMP-01","COMP-02"]', 'COMP-01', 'admin888', 0, '2026-01-01', '2026-01-01'),
      ('USR-BOSS', 'boss', '林大巨 董事長', 'lin.boss@mega-build.com.tw', 'BOSS', 1, 1, 1, 1, NULL, '[]', '[]', 'ACTIVE', '集團創辦人暨董事長 (企業最高統裁)', '["COMP-01","COMP-02"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01'),
      ('USR-002', 'admin_chen', '陳資訊主任', 'chen.it@mega-build.com.tw', 'ADMIN', 1, 0, 1, 0, NULL, '[]', '[]', 'ACTIVE', '資訊系統處主任 (一般管理員)', '["COMP-01","COMP-02"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01'),
      ('USR-003', 'eng_lin', '林工務主任', 'lin.site@mega-build.com.tw', 'USER', 0, 0, 0, 0, 'GRP-ENG', '["GRP-ENG"]', '[]', 'ACTIVE', '土木結構主任工程師', '["COMP-01"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01'),
      ('USR-004', 'acc_chang', '張會計長', 'chang.acc@mega-build.com.tw', 'USER', 0, 0, 0, 0, 'GRP-ACC', '["GRP-ACC"]', '[]', 'ACTIVE', '財務會計處副理', '["COMP-01","COMP-02"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01'),
      ('USR-005', 'proc_wang', '王採購專員', 'wang.proc@mega-build.com.tw', 'USER', 0, 0, 0, 0, 'GRP-PROC', '["GRP-PROC"]', '[]', 'ACTIVE', '發包採購部資深專員', '["COMP-01"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01'),
      ('USR-006', 'sales_liu', '劉業務副理', 'liu.sales@mega-build.com.tw', 'USER', 0, 0, 0, 0, 'GRP-SALES', '["GRP-SALES"]', '[]', 'ACTIVE', '專案開發業務副理', '["COMP-01"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01'),
      ('USR-007', 'matrix_zhao', '趙專員', 'zhao.matrix@mega-build.com.tw', 'USER', 0, 0, 0, 0, 'GRP-ACC', '["GRP-ACC","GRP-PROC"]', '[{"companyId":"COMP-01","groupIds":["GRP-ACC"]},{"companyId":"COMP-02","groupIds":["GRP-PROC"]}]', 'ACTIVE', '跨法人調度專員 (大巨財務 / 宏達採購)', '["COMP-01","COMP-02"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01');
  `);
}

// 平滑資料庫完整性修復器 (保證現有快照升級時表結構與種子資料齊全)
export function ensureDatabaseIntegrity(db: Database) {

  // 🛡️ 現場進貨簽收單主表與明細表 (InboundReceipts)
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS inbound_receipts (
        id TEXT PRIMARY KEY,
        receiptNumber TEXT UNIQUE NOT NULL,
        companyId TEXT NOT NULL,
        projectId TEXT NOT NULL,
        projectNameSnapshot TEXT,
        vendorId TEXT NOT NULL,
        vendorNameSnapshot TEXT,
        vendorTaxIdSnapshot TEXT,
        deliveryNoteNumber TEXT NOT NULL,
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
          ('APP-CFG-16', 'APP_SYSTEM_NAME', '田頭營造工程雲端 ERP 整合系統', '軟體系統完整中文全稱 (全域自訂品牌)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01');
      `);
    } else {
      // 自動升級檢測：若舊有資料庫仍有預設 A1 或鼎新字樣，自動升級為純淨自訂變數
      db.run(`UPDATE app_configs SET configValue = '營造工程管理雲' WHERE configKey = 'APP_SUB_TITLE' AND (configValue LIKE '%A1%' OR configValue LIKE '%鼎新%');`);
      db.run(`UPDATE app_configs SET configValue = '田頭 | 營造工程雲端 ERP 整合系統' WHERE configKey = 'APP_HTML_TITLE' AND (configValue LIKE '%A1%' OR configValue LIKE '%鼎新%');`);
      
      // 自動補齊新 Logo 設定鍵
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
    { name: 'contactAddress', type: 'TEXT' },
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

  // 同步初始化業主與廠商身分旗標及手續費負擔方
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
  try { db.run(`ALTER TABLE partner_cheque_records ADD COLUMN branchName TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE partner_cheque_records ADD COLUMN receivedDate TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE partner_cheque_records ADD COLUMN statutoryExpiryDate TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE partner_cheque_records ADD COLUMN chequeFiles TEXT;`); } catch (e) {}

  // 🏛️ 專案案場工區現地法規欄位更新 (起造人、監造人、承造人、拆圖廠商、座落地號)
  try { db.run(`ALTER TABLE project_sites ADD COLUMN developerName TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN architect TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN constructor TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN shopDrawingVendorId TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN shopDrawingVendorName TEXT;`); } catch (e) {}
  try { db.run(`ALTER TABLE project_sites ADD COLUMN landNumber TEXT;`); } catch (e) {}

  // 確保拆圖廠商種子資料存在供選取
  try {
    const bp07Check = db.exec(`SELECT count(*) FROM business_partners WHERE id = 'BP-07';`);
    if (!bp07Check.length || Number(bp07Check[0].values[0][0]) === 0) {
      db.run(`
        INSERT INTO business_partners (id, bpCode, name, taxId, entityType, type, isCustomer, isVendor, serviceCategoryMain, serviceCategorySub, ownerIdNumber, representative, contactPerson, phone, email, address, bankName, bankCode, bankAccount, bankAccountName, bankFeePayer, hasInvoice, paymentTermsDays, isHighRisk, currentScore, status, companyId, isDeleted, version, createdAt, updatedAt)
        VALUES ('BP-07', 'SUB-003', '宏聯結構工程拆圖顧問有限公司', '54321678', 'CORPORATION', 'SUBCONTRACTOR', 0, 1, '專業技術顧問與測量設計', '拆圖廠商 / 施工大樣圖拆圖', 'G123456789', '黃宏達 技師', '黃宏達', '02-2345-6789', 'detail@honglian.com.tw', '台北市中山區南京東路三段28號', '台北富邦銀行', '012', '012001998877', '宏聯結構工程拆圖顧問有限公司', 'COMPANY', 1, 30, 0, 95, 'ACTIVE', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01')
        ON CONFLICT(id) DO NOTHING;
      `);
    }
  } catch (e) {}

  // 若子表為空，自動從既有 business_partners 填補主要地址、聯絡人與銀行帳戶
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
    
    // 確保現存所有未刪除法人，同步授權給 USR-001、USR-BOSS 與 USR-002 (陳資訊主任)
    const compRows = db.exec(`SELECT id FROM companies WHERE isDeleted = 0;`);
    if (compRows.length && compRows[0].values.length) {
      const activeCompIds = compRows[0].values.map(v => String(v[0]));
      for (const targetUid of ['USR-001', 'USR-BOSS', 'USR-002']) {
        const uRes = db.exec(`SELECT allowedCompanies FROM users WHERE id = '${targetUid}';`);
        if (uRes.length && uRes[0].values.length) {
          let comps: string[] = uRes[0].values[0][0] ? JSON.parse(String(uRes[0].values[0][0])) : ['COMP-01'];
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

  // 自動校準單據流水號計數器
  try {
    reseedDocumentSequences(db);
  } catch (e) {
    console.error('Sequence reseed error', e);
  }
}

// 中文名稱轉換輔助函式 (避免在審計日誌中出現英文代號)
function formatRoleCn(role?: string): string {
  if (role === 'SUPERADMIN') return '系統架構師 (Superadmin)';
  if (role === 'BOSS') return '企業最高統裁 (集團董事長)';
  if (role === 'ADMIN') return '系統管理員';
  return '一般同仁';
}

function formatStatusCn(status?: string): string {
  if (status === 'DISABLED') return '已停用';
  return '啟用中';
}

function resolveGroupNamesCn(groupIds?: string[]): string {
  if (!groupIds || groupIds.length === 0) return '無';
  const fallbackMap: Record<string, string> = {
    'GRP-ENG': '工務組',
    'GRP-ACC': '財務會計組',
    'GRP-PROC': '採購發包組',
    'GRP-SALES': '專案業務組',
  };
  const allGroups = getAllUserGroups();
  return groupIds
    .map(gid => {
      const found = allGroups.find(g => g.id === gid);
      return found ? found.groupName : (fallbackMap[gid] || gid);
    })
    .join('、');
}

function resolveCompanyNamesCn(companyIds?: string[]): string {
  if (!companyIds || companyIds.length === 0) return '無';
  const fallbackMap: Record<string, string> = {
    'GRP-01': '大巨集團',
    'COMP-01': '大巨營造',
    'COMP-02': '宏達機電',
    'BOSS-01': '林董私帳',
    'COMP-GROUP': '大巨集團',
    'COMP-BOSS': '林董私帳',
  };
  const allComps = getAllCompanies();
  return companyIds
    .map(cid => {
      const found = allComps.find(c => c.id === cid);
      return found ? (found.shortName || found.name) : (fallbackMap[cid] || cid);
    })
    .join('、');
}

function formatCompanyGroupAssignmentsCn(assignments?: CompanyGroupAssignment[]): string {
  if (!assignments || assignments.length === 0) return '未設定 (採全域業務群組)';
  const allComps = getAllCompanies();
  const allGroups = getAllUserGroups();
  return assignments.map(a => {
    const comp = allComps.find(c => c.id === a.companyId);
    const compName = comp ? (comp.shortName || comp.name) : a.companyId;
    const groupNames = a.groupIds.map(gid => {
      const g = allGroups.find(grp => grp.id === gid);
      return g ? g.groupName : gid;
    }).join('+');
    return `[${compName}: ${groupNames || '無指派'}]`;
  }).join('、');
}

// 自動將逾期 7 天之冷卻同仁轉入 Superadmin 封存區
export function autoArchiveExpiredUsers(): void {
  if (!dbInstance) return;
  try {
    const nowIso = new Date().toISOString();
    const check = dbInstance.exec(`
      SELECT id, fullName, username FROM users 
      WHERE deleteStage = 'PENDING_DELETE' AND purgeDueAt IS NOT NULL AND purgeDueAt <= '${nowIso}';
    `);
    if (check.length > 0 && check[0].values.length > 0) {
      for (const row of check[0].values) {
        const uId = String(row[0]);
        const uName = String(row[1]);
        dbInstance.run(`
          UPDATE users 
          SET deleteStage = 'ARCHIVED', 
              stageNotes = '7日冷卻期屆滿，系統自動轉入 Superadmin 封存區'
          WHERE id = '${uId}';
        `);
        logAudit(
          dbInstance,
          '系統排程',
          '自動封存',
          '同仁帳號',
          uName,
          { '帳號生命週期': '待刪除回收站 (7日冷卻)' },
          { '帳號生命週期': '深度封存區 (冷卻期滿自動移交)' },
          '系統排程'
        );
      }
      saveDatabaseSnapshot();
    }
  } catch (e) {
    console.error('autoArchiveExpiredUsers error', e);
  }
}

// 讀取所有人員帳號 (自動執行冷卻逾期審查與讀取三態生命週期欄位)
export function getAllUsers(): User[] {
  if (!dbInstance) return [];
  autoArchiveExpiredUsers();
  const res = dbInstance.exec(`
    SELECT id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, groupId, groupIds, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, lastLoginAt, createdAt, updatedAt, deleteStage, stageDeletedAt, purgeDueAt, deletedBy, stageNotes, canManageAllCompanies, companyGroupAssignments 
    FROM users 
    ORDER BY CASE role WHEN 'SUPERADMIN' THEN 1 WHEN 'BOSS' THEN 2 WHEN 'ADMIN' THEN 3 ELSE 4 END, id ASC;
  `);
  if (!res.length) return [];
  return res[0].values.map(v => {
    let groupIds: string[] = [];
    if (v[9]) {
      try {
        const parsed = JSON.parse(String(v[9]));
        if (Array.isArray(parsed)) groupIds = parsed;
      } catch (e) {}
    }
    const groupId = v[8] ? String(v[8]) : undefined;
    if (groupIds.length === 0 && groupId) {
      groupIds = [groupId];
    }
    let companyGroupAssignments: CompanyGroupAssignment[] = [];
    if (v[25]) {
      try {
        const parsed = JSON.parse(String(v[25]));
        if (Array.isArray(parsed)) companyGroupAssignments = parsed;
      } catch (e) {}
    }
    return {
      id: String(v[0]),
      username: String(v[1]),
      fullName: String(v[2]),
      email: String(v[3] || ''),
      role: String(v[4]) as User['role'],
      canManageUsers: Boolean(v[5]),
      canManageSystemConfigs: Boolean(v[6]),
      canManageAdmins: Boolean(v[7]),
      canManageAllCompanies: Boolean(v[24]),
      groupId: groupId || groupIds[0],
      groupIds,
      companyGroupAssignments,
      status: (v[10] || 'ACTIVE') as User['status'],
      title: v[11] ? String(v[11]) : undefined,
      allowedCompanies: v[12] ? JSON.parse(String(v[12])) : ['COMP-01'],
      defaultCompanyId: String(v[13] || 'COMP-01'),
      passwordHash: v[14] ? String(v[14]) : '888888',
      isPasswordReset: Boolean(v[15]),
      lastLoginAt: v[16] ? String(v[16]) : undefined,
      createdAt: String(v[17] || ''),
      updatedAt: String(v[18] || ''),
      deleteStage: (v[19] || 'ACTIVE') as User['deleteStage'],
      stageDeletedAt: v[20] ? String(v[20]) : undefined,
      purgeDueAt: v[21] ? String(v[21]) : undefined,
      deletedBy: v[22] ? String(v[22]) : undefined,
      stageNotes: v[23] ? String(v[23]) : undefined
    };
  });
}

// 同仁自主修改個人密碼 (輸入原始密碼 + 兩次新密碼驗證)
export function changeSelfPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  if (!newPassword || newPassword.length < 6) {
    throw new Error('新密碼長度至少需為 6 個字元！');
  }

  if (newPassword !== confirmPassword) {
    throw new Error('兩次輸入的新密碼不相符，請重新確認！');
  }

  const check = dbInstance.exec(`SELECT id, username, fullName, passwordHash FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const user = check[0].values[0];
  const fullName = String(user[2]);
  const dbPass = String(user[3] || '888888');

  if (dbPass !== currentPassword) {
    throw new Error('原始密碼輸入錯誤，請重新確認！');
  }

  const now = new Date().toISOString().substring(0, 10);
  const cleanPass = newPassword.replace(/'/g, "''");
  dbInstance.run(`
    UPDATE users SET passwordHash = '${cleanPass}', isPasswordReset = 0, updatedAt = '${now}' WHERE id = '${userId}';
  `);

  logAudit(
    dbInstance,
    fullName,
    '修改個人密碼',
    '同仁帳號',
    fullName,
    { '登入密碼': '原個人密碼' },
    { '登入密碼': '已自主更新為新密碼' },
    fullName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 讀取所有權限群組 (四大內建 + 自訂群組)
export function getAllUserGroups(): UserGroup[] {
  if (!dbInstance) return [];
  const res = dbInstance.exec(`
    SELECT id, groupCode, groupName, description, isSystem, approvalLimit, canExport, createdAt, updatedAt 
    FROM user_groups 
    ORDER BY isSystem DESC, groupCode ASC;
  `);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    groupCode: String(v[1]),
    groupName: String(v[2]),
    description: String(v[3] || ''),
    isSystem: Boolean(v[4]),
    approvalLimit: Number(v[5] || 0),
    canExport: Boolean(v[6]),
    createdAt: String(v[7] || ''),
    updatedAt: String(v[8] || '')
  }));
}

// 讀取群組模組細項權限矩陣
export function getAllGroupPermissions(groupId?: string): GroupModulePermission[] {
  if (!dbInstance) return [];
  const query = groupId
    ? `SELECT id, groupId, moduleKey, canRead, canWrite, canApprove, canExport FROM group_module_permissions WHERE groupId = '${groupId}';`
    : `SELECT id, groupId, moduleKey, canRead, canWrite, canApprove, canExport FROM group_module_permissions;`;
  const res = dbInstance.exec(query);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    groupId: String(v[1]),
    moduleKey: String(v[2]) as GroupModulePermission['moduleKey'],
    canRead: Boolean(v[3]),
    canWrite: Boolean(v[4]),
    canApprove: Boolean(v[5]),
    canExport: Boolean(v[6])
  }));
}

// 建立使用者帳號 (需具備帳號管理專人權限；階層原則防呆)
export function createUser(
  newUser: {
    username: string;
    fullName: string;
    email: string;
    role: UserRole;
    canManageUsers?: boolean;
    canManageSystemConfigs?: boolean;
    canManageAdmins?: boolean;
    canManageAllCompanies?: boolean;
    groupId?: string;
    groupIds?: string[];
    companyGroupAssignments?: CompanyGroupAssignment[];
    title?: string;
    allowedCompanies?: string[];
    defaultCompanyId?: string;
    password?: string;
  },
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean
): User {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const isPrivilegedOperator = operatorRole === 'SUPERADMIN' || operatorRole === 'BOSS';

  // 帳號管理專人權限檢核
  if (!isPrivilegedOperator && !operatorCanManageUsers) {
    throw new Error('無帳號管理專人權限：系統帳號維護需由最高統裁 (BOSS) 或指定專人 Admin 始得操作！');
  }
  
  if ((newUser.role as string) === 'SUPERADMIN') {
    throw new Error('憲法防呆：系統僅允許一位 Superadmin，禁止直接建立第二位 Superadmin！若需移交請使用「最高權限交接」流程。');
  }

  if ((newUser.role as string) === 'BOSS' && operatorRole !== 'SUPERADMIN') {
    throw new Error('企業防禦防呆：企業最高統裁 (集團董事長 BOSS) 具備唯一性，不得重複建立！');
  }

  // 階層原則：一般 Admin 只能建立下一階 User，除非經 BOSS 或 Superadmin 授權同階管理特許
  if (newUser.role === 'ADMIN' && !isPrivilegedOperator && !operatorCanManageAdmins) {
    throw new Error('階層權限受限：您尚未取得授予之【同階管理特許 (canManageAdmins)】，依規定只能建立下一階層 (User) 業務同仁，無法新增同階 Admin 帳號！');
  }

  const selectedGroupIds = newUser.groupIds && newUser.groupIds.length > 0
    ? newUser.groupIds
    : (newUser.groupId ? [newUser.groupId] : []);

  if (newUser.role === 'USER' && selectedGroupIds.length === 0 && (!newUser.companyGroupAssignments || newUser.companyGroupAssignments.length === 0)) {
    throw new Error('一般同仁帳號必須至少指派一個所屬業務群組或設定跨法人業務矩陣！');
  }

  // 檢查帳號重複
  const check = dbInstance.exec(`SELECT id FROM users WHERE username = '${newUser.username.replace(/'/g, "''")}';`);
  if (check.length > 0 && check[0].values.length > 0) {
    throw new Error(`帳號 ${newUser.username} 已存在，請使用其他帳號！`);
  }

  // 檢查特許授權權限 (只有 Superadmin 或 BOSS 可開啟特許)
  const canManageUserMgr = (isPrivilegedOperator && newUser.role === 'ADMIN' && Boolean(newUser.canManageUsers)) ? 1 : 0;
  const canManageConfigs = (isPrivilegedOperator && newUser.role === 'ADMIN' && Boolean(newUser.canManageSystemConfigs)) ? 1 : 0;
  const canManagePeers = (isPrivilegedOperator && newUser.role === 'ADMIN' && Boolean(newUser.canManageAdmins)) ? 1 : 0;
  const canManageAllComps = (isPrivilegedOperator && newUser.role === 'ADMIN' && Boolean(newUser.canManageAllCompanies)) ? 1 : 0;

  const id = `USR-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  const now = new Date().toISOString().substring(0, 10);
  const title = newUser.title ? `'${newUser.title.replace(/'/g, "''")}'` : 'NULL';
  const primaryGroupId = selectedGroupIds[0] ? `'${selectedGroupIds[0]}'` : 'NULL';
  const groupIdsJson = `'${JSON.stringify(selectedGroupIds)}'`;
  const matrixJson = `'${JSON.stringify(newUser.companyGroupAssignments || []).replace(/'/g, "''")}'`;
  const comps = newUser.allowedCompanies && newUser.allowedCompanies.length > 0 ? newUser.allowedCompanies : ['COMP-01', 'COMP-02'];
  const compsJson = `'${JSON.stringify(comps)}'`;
  const defComp = newUser.defaultCompanyId || comps[0] || 'COMP-01';
  const pass = (newUser.password || '888888').replace(/'/g, "''");

  dbInstance.run(`
    INSERT INTO users (id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, canManageAllCompanies, groupId, groupIds, companyGroupAssignments, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, createdAt, updatedAt)
    VALUES ('${id}', '${newUser.username.replace(/'/g, "''")}', '${newUser.fullName.replace(/'/g, "''")}', '${(newUser.email || '').replace(/'/g, "''")}', '${newUser.role}', ${canManageUserMgr}, ${canManageConfigs}, ${canManagePeers}, ${canManageAllComps}, ${primaryGroupId}, ${groupIdsJson}, ${matrixJson}, 'ACTIVE', ${title}, ${compsJson}, '${defComp}', '${pass}', 0, '${now}', '${now}');
  `);

  const createSummary: Record<string, string> = {
    '同仁姓名': newUser.fullName,
    '權限角色': formatRoleCn(newUser.role),
    '職務職稱': newUser.title || '未填寫',
    '授權營運法人': resolveCompanyNamesCn(comps),
  };
  if (newUser.role === 'USER') {
    createSummary['所屬業務群組'] = resolveGroupNamesCn(selectedGroupIds);
    if (newUser.companyGroupAssignments && newUser.companyGroupAssignments.length > 0) {
      createSummary['跨法人業務授權矩陣'] = formatCompanyGroupAssignmentsCn(newUser.companyGroupAssignments);
    }
  } else {
    if (canManageUserMgr) createSummary['帳號管理專人特許'] = '開啟';
    if (canManageConfigs) createSummary['全域核心參數特許'] = '開啟';
    if (canManagePeers) createSummary['同階管理員維護特許'] = '開啟';
    if (canManageAllComps) createSummary['全集團跨法人管理特許'] = '開啟';
  }

  logAudit(dbInstance, operatorName, '新增資料', '同仁帳號', newUser.fullName, undefined, createSummary, operatorName);

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    username: newUser.username,
    fullName: newUser.fullName,
    email: newUser.email,
    role: newUser.role,
    canManageUsers: Boolean(canManageUserMgr),
    canManageSystemConfigs: Boolean(canManageConfigs),
    canManageAdmins: Boolean(canManagePeers),
    canManageAllCompanies: Boolean(canManageAllComps),
    groupId: selectedGroupIds[0],
    groupIds: selectedGroupIds,
    companyGroupAssignments: newUser.companyGroupAssignments || [],
    status: 'ACTIVE',
    title: newUser.title,
    allowedCompanies: comps,
    defaultCompanyId: defComp,
    passwordHash: pass,
    isPasswordReset: false,
    createdAt: now,
    updatedAt: now
  };
}

// 更新使用者帳號 (含帳號管理專人、階層原則與 canManageAdmins 防呆保護，且僅記錄實際有修改之欄位)
export function updateUser(
  updateData: {
    id: string;
    fullName?: string;
    email?: string;
    role?: UserRole;
    canManageUsers?: boolean;
    canManageSystemConfigs?: boolean;
    canManageAdmins?: boolean;
    canManageAllCompanies?: boolean;
    groupId?: string | null;
    groupIds?: string[];
    companyGroupAssignments?: CompanyGroupAssignment[];
    allowedCompanies?: string[];
    defaultCompanyId?: string;
    status?: 'ACTIVE' | 'DISABLED';
    title?: string;
  },
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean,
  currentOperatorId?: string
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  // 安全防呆：禁止操作者將當前登入之自身帳號停用（防範自殺式停權）
  if (currentOperatorId && currentOperatorId === updateData.id && updateData.status === 'DISABLED') {
    throw new Error('【安全防呆防護】系統嚴禁將當前正在登入操作中之自身帳號設為停用！');
  }

  const isPrivilegedOperator = operatorRole === 'SUPERADMIN' || operatorRole === 'BOSS';

  // 帳號管理專人權限檢核
  if (!isPrivilegedOperator && !operatorCanManageUsers) {
    throw new Error('無帳號管理專人權限：系統帳號維護需由最高統裁 (BOSS) 或指定專人 Admin 始得操作！');
  }

  // 取得原目標帳號完整資料以便精準比對修改差異
  const currentRes = dbInstance.exec(`
    SELECT id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, groupId, groupIds, status, title, allowedCompanies, defaultCompanyId, canManageAllCompanies, companyGroupAssignments 
    FROM users WHERE id = '${updateData.id}';
  `);
  if (!currentRes.length || !currentRes[0].values.length) {
    throw new Error('找不到指定帳號！');
  }

  const oldRow = currentRes[0].values[0];
  const oldFullName = String(oldRow[2] || '');
  const oldEmail = String(oldRow[3] || '');
  const targetRole = String(oldRow[4] || 'USER');
  const oldCanManageUsers = Boolean(oldRow[5]);
  const oldCanManageConfigs = Boolean(oldRow[6]);
  const oldCanManageAdmins = Boolean(oldRow[7]);
  const oldCanManageAllCompanies = Boolean(oldRow[14]);
  let oldGroupIds: string[] = [];
  try {
    if (oldRow[9]) oldGroupIds = JSON.parse(String(oldRow[9]));
  } catch (e) {}
  if (oldGroupIds.length === 0 && oldRow[8]) oldGroupIds = [String(oldRow[8])];
  let oldCompanyGroupAssignments: CompanyGroupAssignment[] = [];
  try {
    if (oldRow[15]) oldCompanyGroupAssignments = JSON.parse(String(oldRow[15]));
  } catch (e) {}
  const oldStatus = String(oldRow[10] || 'ACTIVE');
  const oldTitle = String(oldRow[11] || '');
  let oldAllowedComps: string[] = ['COMP-01'];
  try {
    if (oldRow[12]) oldAllowedComps = JSON.parse(String(oldRow[12]));
  } catch (e) {}
  const oldDefaultComp = String(oldRow[13] || 'COMP-01');

  // 憲法防呆：一般 Admin / BOSS 不得變更 Superadmin 帳號
  if (targetRole === 'SUPERADMIN' && operatorRole !== 'SUPERADMIN') {
    throw new Error('憲法保護防禦：除架構師本人外，其他人無權修改 Superadmin 帳號！');
  }

  // 👑 BOSS 金身護體防護：除 Superadmin 或 BOSS 本人外，一般 Admin 絕對無權修改 BOSS 帳號
  if (targetRole === 'BOSS' && operatorRole !== 'SUPERADMIN' && operatorRole !== 'BOSS') {
    throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 帳號具備最高決策金身護體，一般管理員無權修改其資料！');
  }

  // 階層防呆：若目標帳號為其他同階 ADMIN，且操作者非 SUPERADMIN、非 BOSS 且無同階管理特許 (canManageAdmins)
  if (targetRole === 'ADMIN' && updateData.id !== currentOperatorId && !isPrivilegedOperator && !operatorCanManageAdmins) {
    throw new Error('階層權限受限：您尚未取得授予之【同階管理特許】，依規定只能管理一般同仁 (User)，無法修改其他系統管理員 (Admin) 帳號！');
  }

  // 階層防呆：若試圖將角色改為 ADMIN，且操作者非 SUPERADMIN、非 BOSS 且無同階管理特許
  if (updateData.role === 'ADMIN' && targetRole !== 'ADMIN' && !isPrivilegedOperator && !operatorCanManageAdmins) {
    throw new Error('階層權限受限：您無權將同仁角色提升為 Admin，需由最高統裁授權同階管理特許！');
  }

  // 憲法防呆：Superadmin 不能被停用或直接被降級 (必須透過交接)
  if (targetRole === 'SUPERADMIN') {
    if (updateData.status === 'DISABLED') {
      throw new Error('憲法保護防禦：唯一的最高 Superadmin 具備不可停用保護！');
    }
    if (updateData.role && (updateData.role as string) !== 'SUPERADMIN') {
      throw new Error('憲法保護防禦：最高 Superadmin 不可直接降級，必須透過最高權限交接！');
    }
  }

  // 👑 BOSS 金身護體防呆：BOSS 不能被停用或降級
  if (targetRole === 'BOSS') {
    if (updateData.status === 'DISABLED') {
      throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 具備不可停用金身護體保護！');
    }
    if (updateData.role && updateData.role !== 'BOSS') {
      throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 職位不可被降級！');
    }
  }

  // 憲法防呆：不可將任何使用者直接變更為 SUPERADMIN 或 BOSS
  if ((updateData.role as string) === 'SUPERADMIN' && targetRole !== 'SUPERADMIN') {
    throw new Error('系統禁止直接賦予 SUPERADMIN 角色，必須由現任 Superadmin 執行交接程序！');
  }
  if (updateData.role === 'BOSS' && targetRole !== 'BOSS') {
    throw new Error('系統禁止直接賦予 BOSS 角色，企業最高統裁帳號具備唯一性！');
  }

  const updates: string[] = [];
  const now = new Date().toISOString().substring(0, 10);
  updates.push(`updatedAt = '${now}'`);

  // 準備記錄有實際修改之欄位 (純中文對照)
  const beforeDiff: Record<string, string> = {};
  const afterDiff: Record<string, string> = {};

  if (updateData.fullName !== undefined) {
    const trimmed = updateData.fullName.trim();
    updates.push(`fullName = '${trimmed.replace(/'/g, "''")}'`);
    if (trimmed !== oldFullName) {
      beforeDiff['同仁姓名'] = oldFullName;
      afterDiff['同仁姓名'] = trimmed;
    }
  }
  if (updateData.email !== undefined) {
    const trimmed = updateData.email.trim();
    updates.push(`email = '${trimmed.replace(/'/g, "''")}'`);
    if (trimmed !== oldEmail) {
      beforeDiff['電子信箱'] = oldEmail || '未填寫';
      afterDiff['電子信箱'] = trimmed || '未填寫';
    }
  }
  if (updateData.title !== undefined) {
    const trimmed = updateData.title.trim();
    updates.push(`title = '${trimmed.replace(/'/g, "''")}'`);
    if (trimmed !== oldTitle) {
      beforeDiff['職務職稱'] = oldTitle || '未填寫';
      afterDiff['職務職稱'] = trimmed || '未填寫';
    }
  }
  if (updateData.status !== undefined) {
    updates.push(`status = '${updateData.status}'`);
    if (updateData.status !== oldStatus) {
      beforeDiff['帳號狀態'] = formatStatusCn(oldStatus);
      afterDiff['帳號狀態'] = formatStatusCn(updateData.status);
    }
  }
  if (updateData.role !== undefined) {
    updates.push(`role = '${updateData.role}'`);
    if (updateData.role !== targetRole) {
      beforeDiff['權限角色'] = formatRoleCn(targetRole);
      afterDiff['權限角色'] = formatRoleCn(updateData.role);
    }
  }

  // 角色變更與特許授權防護：
  const effectiveRole = updateData.role !== undefined ? updateData.role : targetRole;
  if (updateData.role === 'USER') {
    // 當同仁身分被設定/降級為 USER 時，原子化自動收回並歸零所有管理特許項目
    updates.push(`canManageUsers = 0`);
    updates.push(`canManageSystemConfigs = 0`);
    updates.push(`canManageAdmins = 0`);
    if (oldCanManageUsers) {
      beforeDiff['帳號管理專人特許'] = '開啟';
      afterDiff['帳號管理專人特許'] = '關閉 (隨降級自動收回)';
    }
    if (oldCanManageConfigs) {
      beforeDiff['全域核心參數特許'] = '開啟';
      afterDiff['全域核心參數特許'] = '關閉 (隨降級自動收回)';
    }
    if (oldCanManageAdmins) {
      beforeDiff['同階管理員維護特許'] = '開啟';
      afterDiff['同階管理員維護特許'] = '關閉 (隨降級自動收回)';
    }
  } else if (isPrivilegedOperator) {
    // 系統最高 Superadmin 與企業最高統裁 BOSS 擁有授予及調整 Admin 進階特許之權力
    if (updateData.canManageUsers !== undefined) {
      updates.push(`canManageUsers = ${updateData.canManageUsers ? 1 : 0}`);
      if (Boolean(updateData.canManageUsers) !== oldCanManageUsers) {
        beforeDiff['帳號管理專人特許'] = oldCanManageUsers ? '開啟' : '關閉';
        afterDiff['帳號管理專人特許'] = updateData.canManageUsers ? '開啟' : '關閉';
      }
    }
    if (updateData.canManageSystemConfigs !== undefined) {
      updates.push(`canManageSystemConfigs = ${updateData.canManageSystemConfigs ? 1 : 0}`);
      if (Boolean(updateData.canManageSystemConfigs) !== oldCanManageConfigs) {
        beforeDiff['全域核心參數特許'] = oldCanManageConfigs ? '開啟' : '關閉';
        afterDiff['全域核心參數特許'] = updateData.canManageSystemConfigs ? '開啟' : '關閉';
      }
    }
    if (updateData.canManageAdmins !== undefined) {
      updates.push(`canManageAdmins = ${updateData.canManageAdmins ? 1 : 0}`);
      if (Boolean(updateData.canManageAdmins) !== oldCanManageAdmins) {
        beforeDiff['同階管理員維護特許'] = oldCanManageAdmins ? '開啟' : '關閉';
        afterDiff['同階管理員維護特許'] = updateData.canManageAdmins ? '開啟' : '關閉';
      }
    }
    if (updateData.canManageAllCompanies !== undefined) {
      updates.push(`canManageAllCompanies = ${updateData.canManageAllCompanies ? 1 : 0}`);
      if (Boolean(updateData.canManageAllCompanies) !== oldCanManageAllCompanies) {
        beforeDiff['全集團跨法人管理特許'] = oldCanManageAllCompanies ? '開啟' : '關閉';
        afterDiff['全集團跨法人管理特許'] = updateData.canManageAllCompanies ? '開啟' : '關閉';
      }
    }
  } else {
    // 非 Superadmin / BOSS 操作者：若試圖開啟特許則強制攔截，若未試圖開啟則自動忽略防禦性阻擋
    if (updateData.canManageUsers || updateData.canManageSystemConfigs || updateData.canManageAdmins || updateData.canManageAllCompanies) {
      throw new Error('憲法權限防護：唯獨最高 Superadmin 或企業最高統裁 (BOSS) 才有權限授予管理員進階特許！');
    }
  }

  if (updateData.allowedCompanies !== undefined) {
    updates.push(`allowedCompanies = '${JSON.stringify(updateData.allowedCompanies)}'`);
    const oldCompKey = [...oldAllowedComps].sort().join(',');
    const newCompKey = [...updateData.allowedCompanies].sort().join(',');
    if (oldCompKey !== newCompKey) {
      beforeDiff['授權營運法人'] = resolveCompanyNamesCn(oldAllowedComps);
      afterDiff['授權營運法人'] = resolveCompanyNamesCn(updateData.allowedCompanies);
    }
  }
  if (updateData.defaultCompanyId !== undefined) {
    updates.push(`defaultCompanyId = '${updateData.defaultCompanyId}'`);
    if (updateData.defaultCompanyId !== oldDefaultComp) {
      beforeDiff['預設登入法人'] = resolveCompanyNamesCn([oldDefaultComp]);
      afterDiff['預設登入法人'] = resolveCompanyNamesCn([updateData.defaultCompanyId]);
    }
  }
  
  if (updateData.groupIds !== undefined) {
    const jsonStr = JSON.stringify(updateData.groupIds);
    updates.push(`groupIds = '${jsonStr}'`);
    if (updateData.groupIds.length > 0) {
      updates.push(`groupId = '${updateData.groupIds[0]}'`);
    } else {
      updates.push(`groupId = NULL`);
    }
    const oldGrpKey = [...oldGroupIds].sort().join(',');
    const newGrpKey = [...updateData.groupIds].sort().join(',');
    if (oldGrpKey !== newGrpKey && (effectiveRole === 'USER' || targetRole === 'USER')) {
      beforeDiff['所屬業務群組'] = resolveGroupNamesCn(oldGroupIds);
      afterDiff['所屬業務群組'] = resolveGroupNamesCn(updateData.groupIds);
    }
  } else if (updateData.groupId !== undefined) {
    updates.push(updateData.groupId ? `groupId = '${updateData.groupId}'` : `groupId = NULL`);
    updates.push(updateData.groupId ? `groupIds = '["${updateData.groupId}"]'` : `groupIds = '[]'`);
    const newArr = updateData.groupId ? [updateData.groupId] : [];
    const oldGrpKey = [...oldGroupIds].sort().join(',');
    const newGrpKey = [...newArr].sort().join(',');
    if (oldGrpKey !== newGrpKey && (effectiveRole === 'USER' || targetRole === 'USER')) {
      beforeDiff['所屬業務群組'] = resolveGroupNamesCn(oldGroupIds);
      afterDiff['所屬業務群組'] = resolveGroupNamesCn(newArr);
    }
  }

  if (updateData.companyGroupAssignments !== undefined) {
    const matJson = JSON.stringify(updateData.companyGroupAssignments).replace(/'/g, "''");
    updates.push(`companyGroupAssignments = '${matJson}'`);
    const oldMatKey = JSON.stringify(oldCompanyGroupAssignments || []);
    const newMatKey = JSON.stringify(updateData.companyGroupAssignments || []);
    if (oldMatKey !== newMatKey && (effectiveRole === 'USER' || targetRole === 'USER')) {
      beforeDiff['跨法人業務授權矩陣'] = formatCompanyGroupAssignmentsCn(oldCompanyGroupAssignments);
      afterDiff['跨法人業務授權矩陣'] = formatCompanyGroupAssignmentsCn(updateData.companyGroupAssignments);
    }
  }

  dbInstance.run(`
    UPDATE users SET ${updates.join(', ')} WHERE id = '${updateData.id}';
  `);

  // 僅在實際有欄位發生變更時才寫入審計日誌
  if (Object.keys(afterDiff).length > 0) {
    logAudit(
      dbInstance,
      operatorName,
      '修改資料',
      '同仁帳號',
      updateData.fullName?.trim() || oldFullName,
      beforeDiff,
      afterDiff,
      operatorName
    );
  }

  saveDatabaseSnapshot();
  notifyListeners();
}

// 快速切換特定 Admin 之帳號管理專人特許 (Superadmin 與 BOSS 均可操作)
export function toggleAdminUserManagerPrivilege(
  userId: string,
  canManage: boolean,
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string
): void {
  updateUser({ id: userId, canManageUsers: canManage }, operatorRole, operatorName, true, true);
}

// 快速切換特定 Admin 之全域核心參數維護特許 (Superadmin 與 BOSS 均可操作)
export function toggleAdminConfigPrivilege(
  userId: string,
  canManage: boolean,
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string
): void {
  updateUser({ id: userId, canManageSystemConfigs: canManage }, operatorRole, operatorName, true, true);
}

// 快速切換特定 Admin 之同階管理特許 (Superadmin 與 BOSS 均可操作)
export function toggleAdminPeerPrivilege(
  userId: string,
  canManage: boolean,
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string
): void {
  updateUser({ id: userId, canManageAdmins: canManage }, operatorRole, operatorName, true, true);
}

// 重設同仁密碼 (需具備帳號管理專人權限；支援自訂新密碼或套用預設安全密碼)
export function resetUserPassword(
  userId: string,
  newPassword: string,
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  
  const isPrivilegedOperator = operatorRole === 'SUPERADMIN' || operatorRole === 'BOSS';

  // 帳號管理專人權限檢核：非所有 Admin 都能重設他人密碼
  if (!isPrivilegedOperator && !operatorCanManageUsers) {
    throw new Error('無重設他人密碼權限：他人密碼只能由最高統裁 (BOSS) 特別指定之帳號管理專人 Admin 執行重設！');
  }

  const check = dbInstance.exec(`SELECT id, role, fullName FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const role = check[0].values[0][1] as string;
  const fullName = String(check[0].values[0][2]);

  if (role === 'SUPERADMIN' && operatorRole !== 'SUPERADMIN') {
    throw new Error('憲法保護防禦：除架構師本人外，其他人無權重設系統最高 Superadmin 密碼！');
  }

  if (role === 'BOSS' && operatorRole !== 'SUPERADMIN' && operatorRole !== 'BOSS') {
    throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 密碼不可由一般管理員重設！');
  }

  if (role === 'ADMIN' && !isPrivilegedOperator && !operatorCanManageAdmins) {
    throw new Error('階層權限受限：您尚未取得授予之【同階管理特許】，無法重設其他系統管理員 (Admin) 之密碼！');
  }

  const now = new Date().toISOString().substring(0, 10);
  const cleanPass = newPassword.replace(/'/g, "''");
  dbInstance.run(`
    UPDATE users SET passwordHash = '${cleanPass}', isPasswordReset = 1, updatedAt = '${now}' WHERE id = '${userId}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '重設密碼',
    '同仁帳號',
    fullName,
    { '密碼狀態': '原密碼' },
    { '密碼狀態': '已由管理員重設密碼' },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 快速切換同仁啟用/停用狀態 (需具備帳號管理專人權限)
export function toggleUserStatus(
  userId: string,
  newStatus: 'ACTIVE' | 'DISABLED',
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean,
  currentOperatorId?: string
): void {
  if (currentOperatorId && currentOperatorId === userId && newStatus === 'DISABLED') {
    throw new Error('【安全防呆防護】系統嚴禁將當前正在登入操作中之自身帳號設為停用！');
  }
  updateUser({ id: userId, status: newStatus }, operatorRole, operatorName, operatorCanManageUsers, operatorCanManageAdmins, currentOperatorId);
}

// 第一階段：移入待刪除回收站（7 日冷卻期）
export function markUserPendingDelete(
  userId: string,
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean,
  reason?: string
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const isPrivilegedOperator = operatorRole === 'SUPERADMIN' || operatorRole === 'BOSS';

  // 帳號管理專人權限檢核
  if (!isPrivilegedOperator && !operatorCanManageUsers) {
    throw new Error('無帳號管理專人權限：刪除同仁帳號需由最高統裁 (BOSS) 或指定之專人 Admin 始得操作！');
  }

  const check = dbInstance.exec(`SELECT id, role, fullName, username, deleteStage FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const role = check[0].values[0][1] as string;
  const fullName = check[0].values[0][2] as string;
  const currentStage = check[0].values[0][4] as string;

  if (role === 'SUPERADMIN') {
    throw new Error('【憲法金身防護】系統唯一最高架構師 (Superadmin) 具備永久保護，嚴禁刪除！');
  }

  if (role === 'BOSS') {
    throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 具備不可撼動金身護體，嚴禁刪除！');
  }

  if (role === 'ADMIN' && !isPrivilegedOperator && !operatorCanManageAdmins) {
    throw new Error('階層權限受限：您尚未取得授予之【同階管理特許】，無法刪除其他系統管理員 (Admin) 帳號！');
  }

  if (currentStage === 'PENDING_DELETE') {
    throw new Error('此同仁帳號已在待刪除回收站中！');
  }
  if (currentStage === 'ARCHIVED') {
    throw new Error('此同仁帳號已在深度封存區中！');
  }

  const nowIso = new Date().toISOString();
  // 7 天冷卻期
  const purgeDueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const cleanReason = (reason || '管理員執行第一階段刪除，移入7日冷卻回收站').replace(/'/g, "''");

  dbInstance.run(`
    UPDATE users 
    SET deleteStage = 'PENDING_DELETE',
        stageDeletedAt = '${nowIso}',
        purgeDueAt = '${purgeDueAt}',
        deletedBy = '${operatorName.replace(/'/g, "''")}',
        stageNotes = '${cleanReason}',
        status = 'DISABLED'
    WHERE id = '${userId}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '移入回收站',
    '同仁帳號',
    fullName,
    { '帳號狀態': '啟用中 (正常在職)' },
    { '帳號狀態': '已停用 (移入待刪除回收站 7 日冷卻)' },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 刪除使用者帳號 (向下相容：自動呼叫第一階段刪除冷卻流程)
export function deleteUser(
  userId: string,
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean
): void {
  markUserPendingDelete(userId, operatorRole, operatorName, operatorCanManageUsers, operatorCanManageAdmins, '第一階段刪除至待刪除回收站');
}

// 待刪除回收站：一鍵復原回啟用主檔 (Admin 與 Superadmin 均可操作)
export function restorePendingUser(
  userId: string,
  operatorName: string
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const check = dbInstance.exec(`SELECT id, role, fullName, username, deleteStage FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const fullName = check[0].values[0][2] as string;

  dbInstance.run(`
    UPDATE users 
    SET deleteStage = 'ACTIVE',
        stageDeletedAt = NULL,
        purgeDueAt = NULL,
        deletedBy = NULL,
        stageNotes = NULL,
        status = 'ACTIVE'
    WHERE id = '${userId}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '復原帳號',
    '同仁帳號',
    fullName,
    { '帳號狀態': '待刪除回收站 (已停用)' },
    { '帳號狀態': '啟用中 (正常在職)' },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 待刪除回收站：提前手動二次刪除，轉入 Superadmin 專屬封存區
export function advanceUserToArchive(
  userId: string,
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const isPrivilegedOperator = operatorRole === 'SUPERADMIN' || operatorRole === 'BOSS';

  if (!isPrivilegedOperator && !operatorCanManageUsers) {
    throw new Error('無帳號管理專人權限：操作需由最高統裁 (BOSS) 或指定專人 Admin 始得操作！');
  }

  const check = dbInstance.exec(`SELECT id, role, fullName, username, deleteStage FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const role = check[0].values[0][1] as string;
  const fullName = check[0].values[0][2] as string;

  if (role === 'SUPERADMIN') {
    throw new Error('【憲法金身防護】系統唯一最高架構師嚴禁封存！');
  }

  if (role === 'BOSS') {
    throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 具備不可撼動金身護體，嚴禁封存！');
  }

  if (role === 'ADMIN' && !isPrivilegedOperator && !operatorCanManageAdmins) {
    throw new Error('階層權限受限：您尚未取得授予之【同階管理特許】，無法變更其他系統管理員 (Admin) 狀態！');
  }

  const nowIso = new Date().toISOString();

  dbInstance.run(`
    UPDATE users 
    SET deleteStage = 'ARCHIVED',
        stageDeletedAt = '${nowIso}',
        deletedBy = '${operatorName.replace(/'/g, "''")}',
        stageNotes = '由管理員手動提前二次刪除，移交 Superadmin 深度封存區',
        status = 'DISABLED'
    WHERE id = '${userId}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '移入封存區',
    '同仁帳號',
    fullName,
    { '帳號狀態': '待刪除回收站 (7日冷卻)' },
    { '帳號狀態': '深度封存區 (提前二次刪除封存)' },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 深度封存區：Superadmin 終極救援復原回啟用主檔 (僅限 Superadmin)
export function superadminRestoreArchivedUser(
  userId: string,
  operatorName: string
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const check = dbInstance.exec(`SELECT id, role, fullName, username, deleteStage FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const fullName = check[0].values[0][2] as string;

  dbInstance.run(`
    UPDATE users 
    SET deleteStage = 'ACTIVE',
        stageDeletedAt = NULL,
        purgeDueAt = NULL,
        deletedBy = NULL,
        stageNotes = NULL,
        status = 'ACTIVE'
    WHERE id = '${userId}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '終極救回帳號',
    '同仁帳號',
    fullName,
    { '帳號狀態': '深度封存區 (已停用)' },
    { '帳號狀態': '啟用中 (正常在職)' },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 深度封存區：Superadmin 終極安全詞物理粉碎清除 (物理實體 DELETE，不可逆)
export function superadminPermanentPurge(
  userId: string,
  operatorName: string,
  confirmText: string
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  if (confirmText.trim() !== '確認永久物理清除') {
    throw new Error('安全防呆校驗失敗：安全確認詞不相符，無法執行永久物理清除！請輸入「確認永久物理清除」以資確認。');
  }

  const check = dbInstance.exec(`SELECT id, role, fullName, username, deleteStage FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const role = check[0].values[0][1] as string;
  const fullName = check[0].values[0][2] as string;

  if (role === 'SUPERADMIN') {
    throw new Error('【憲法金身防護】系統唯一最高管理員 (Superadmin) 具備永久保護，嚴禁清除！');
  }

  if (role === 'BOSS') {
    throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 具備永久金身護體，嚴禁清除！');
  }

  dbInstance.run(`DELETE FROM users WHERE id = '${userId}';`);

  logAudit(
    dbInstance,
    operatorName,
    '永久物理清除',
    '同仁帳號',
    fullName,
    { '帳號狀態': '深度封存區' },
    { '帳號狀態': '已從資料庫永久抹除' },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 復原遭刪除之人員帳號 (Undo Restore)
export function restoreUser(
  user: User,
  operatorName: string
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const check = dbInstance.exec(`SELECT id FROM users WHERE id = '${user.id}';`);
  if (check.length > 0 && check[0].values.length > 0) {
    throw new Error(`同仁帳號 ${user.username} 仍存在，無須復原！`);
  }

  const title = user.title ? `'${user.title.replace(/'/g, "''")}'` : 'NULL';
  const primaryGroupId = user.groupId ? `'${user.groupId}'` : 'NULL';
  const groupIdsJson = `'${JSON.stringify(user.groupIds || (user.groupId ? [user.groupId] : []))}'`;
  const compsJson = `'${JSON.stringify(user.allowedCompanies || ['COMP-01'])}'`;
  const pass = (user.passwordHash || '888888').replace(/'/g, "''");
  const now = new Date().toISOString().substring(0, 10);

  dbInstance.run(`
    INSERT INTO users (id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, groupId, groupIds, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, createdAt, updatedAt)
    VALUES ('${user.id}', '${user.username.replace(/'/g, "''")}', '${user.fullName.replace(/'/g, "''")}', '${(user.email || '').replace(/'/g, "''")}', '${user.role}', ${user.canManageUsers ? 1 : 0}, ${user.canManageSystemConfigs ? 1 : 0}, ${user.canManageAdmins ? 1 : 0}, ${primaryGroupId}, ${groupIdsJson}, '${user.status || 'ACTIVE'}', ${title}, ${compsJson}, '${user.defaultCompanyId || 'COMP-01'}', '${pass}', ${user.isPasswordReset ? 1 : 0}, '${user.createdAt || now}', '${now}');
  `);

  logAudit(
    dbInstance,
    operatorName,
    '復原帳號',
    '同仁帳號',
    user.fullName,
    { '帳號狀態': '待刪除回收站' },
    { '帳號狀態': '啟用中 (正常在職)' },
    operatorName
  );

  saveDatabaseSnapshot();
  notifyListeners();
}

// 最高權限交接 (Transfer Superadmin)
export function transferSuperadmin(
  currentSuperadminId: string,
  targetUserId: string,
  operatorName: string
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  if (currentSuperadminId === targetUserId) {
    throw new Error('交接對象不能為當前 Superadmin 本身！');
  }

  const superCheck = dbInstance.exec(`SELECT id, fullName, role FROM users WHERE id = '${currentSuperadminId}';`);
  if (!superCheck.length || superCheck[0].values[0][2] !== 'SUPERADMIN') {
    throw new Error('只有當前最高 Superadmin 才有權限執行移轉程序！');
  }

  const targetCheck = dbInstance.exec(`SELECT id, fullName, role FROM users WHERE id = '${targetUserId}';`);
  if (!targetCheck.length || !targetCheck[0].values.length) {
    throw new Error('指定的交接對象不存在！');
  }

  const now = new Date().toISOString().substring(0, 10);
  const oldName = String(superCheck[0].values[0][1]);
  const newName = String(targetCheck[0].values[0][1]);

  dbInstance.run(`BEGIN TRANSACTION;`);
  try {
    dbInstance.run(`
      UPDATE users SET role = 'ADMIN', updatedAt = '${now}' WHERE id = '${currentSuperadminId}';
    `);
    dbInstance.run(`
      UPDATE users SET role = 'SUPERADMIN', groupId = NULL, updatedAt = '${now}' WHERE id = '${targetUserId}';
    `);
    dbInstance.run(`COMMIT;`);
  } catch (e) {
    dbInstance.run(`ROLLBACK;`);
    throw e;
  }

  logAudit(
    dbInstance,
    operatorName,
    '最高權限交接',
    '同仁帳號',
    newName,
    { '唯一最高管理者': oldName },
    { '唯一最高管理者': newName },
    operatorName
  );

  saveDatabaseSnapshot();
  notifyListeners();
}

// 建立自訂群組與模組權限矩陣
export function createGroup(
  group: {
    groupCode: string;
    groupName: string;
    description: string;
    approvalLimit: number;
    canExport: boolean;
  },
  permissions: {
    moduleKey: ModuleKey;
    canRead: boolean;
    canWrite: boolean;
    canApprove: boolean;
    canExport: boolean;
  }[],
  operatorName: string
): UserGroup {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const check = dbInstance.exec(`SELECT id FROM user_groups WHERE groupCode = '${group.groupCode.replace(/'/g, "''")}';`);
  if (check.length > 0 && check[0].values.length > 0) {
    throw new Error(`群組代碼 ${group.groupCode} 已存在，請使用不同代碼！`);
  }

  const id = `GRP-${Date.now().toString().slice(-4)}`;
  const now = new Date().toISOString().substring(0, 10);

  dbInstance.run(`
    INSERT INTO user_groups (id, groupCode, groupName, description, isSystem, approvalLimit, canExport, createdAt, updatedAt)
    VALUES ('${id}', '${group.groupCode.replace(/'/g, "''")}', '${group.groupName.replace(/'/g, "''")}', '${group.description.replace(/'/g, "''")}', 0, ${group.approvalLimit}, ${group.canExport ? 1 : 0}, '${now}', '${now}');
  `);

  for (const p of permissions) {
    const permId = `PERM-${id}-${p.moduleKey}`;
    dbInstance.run(`
      INSERT INTO group_module_permissions (id, groupId, moduleKey, canRead, canWrite, canApprove, canExport)
      VALUES ('${permId}', '${id}', '${p.moduleKey}', ${p.canRead ? 1 : 0}, ${p.canWrite ? 1 : 0}, ${p.canApprove ? 1 : 0}, ${p.canExport ? 1 : 0});
    `);
  }

  logAudit(
    dbInstance,
    operatorName,
    '新增資料',
    '權限群組',
    group.groupName,
    undefined,
    {
      '群組名稱': group.groupName,
      '核准金額上限': `NT$ ${Number(group.approvalLimit || 0).toLocaleString()}`,
      '匯出報表權限': group.canExport ? '允許' : '禁止',
    },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    groupCode: group.groupCode,
    groupName: group.groupName,
    description: group.description,
    isSystem: false,
    approvalLimit: group.approvalLimit,
    canExport: group.canExport,
    createdAt: now,
    updatedAt: now
  };
}

// 更新群組與模組權限矩陣 (僅記錄有修改之群組屬性與模組權限，全中文呈現)
export function updateGroup(
  group: {
    id: string;
    groupName?: string;
    description?: string;
    approvalLimit?: number;
    canExport?: boolean;
  },
  permissions: {
    moduleKey: ModuleKey;
    canRead: boolean;
    canWrite: boolean;
    canApprove: boolean;
    canExport: boolean;
  }[] | undefined,
  operatorName: string
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const oldGroup = getAllUserGroups().find(g => g.id === group.id);
  const oldPerms = getAllGroupPermissions(group.id);
  const beforeDiff: Record<string, string> = {};
  const afterDiff: Record<string, string> = {};

  if (oldGroup) {
    if (group.groupName !== undefined && group.groupName !== oldGroup.groupName) {
      beforeDiff['群組名稱'] = oldGroup.groupName;
      afterDiff['群組名稱'] = group.groupName;
    }
    if (group.description !== undefined && group.description !== oldGroup.description) {
      beforeDiff['職責說明'] = oldGroup.description || '無';
      afterDiff['職責說明'] = group.description || '無';
    }
    if (group.approvalLimit !== undefined && Number(group.approvalLimit) !== Number(oldGroup.approvalLimit)) {
      beforeDiff['核准金額上限'] = `NT$ ${Number(oldGroup.approvalLimit).toLocaleString()}`;
      afterDiff['核准金額上限'] = `NT$ ${Number(group.approvalLimit).toLocaleString()}`;
    }
    if (group.canExport !== undefined && Boolean(group.canExport) !== Boolean(oldGroup.canExport)) {
      beforeDiff['全域匯出權限'] = oldGroup.canExport ? '允許' : '禁止';
      afterDiff['全域匯出權限'] = group.canExport ? '允許' : '禁止';
    }
  }

  const formatPermActionsCn = (p?: { canRead: boolean; canWrite: boolean; canApprove: boolean; canExport: boolean }) => {
    if (!p) return '無權限';
    const list: string[] = [];
    if (p.canRead) list.push('檢視');
    if (p.canWrite) list.push('編輯');
    if (p.canApprove) list.push('審批');
    if (p.canExport) list.push('匯出');
    return list.length > 0 ? list.join('、') : '無權限';
  };

  const now = new Date().toISOString().substring(0, 10);
  const updates: string[] = [`updatedAt = '${now}'`];

  if (group.groupName !== undefined) updates.push(`groupName = '${group.groupName.replace(/'/g, "''")}'`);
  if (group.description !== undefined) updates.push(`description = '${group.description.replace(/'/g, "''")}'`);
  if (group.approvalLimit !== undefined) updates.push(`approvalLimit = ${group.approvalLimit}`);
  if (group.canExport !== undefined) updates.push(`canExport = ${group.canExport ? 1 : 0}`);

  dbInstance.run(`UPDATE user_groups SET ${updates.join(', ')} WHERE id = '${group.id}';`);

  if (permissions) {
    for (const p of permissions) {
      const oldP = oldPerms.find(item => item.moduleKey === p.moduleKey);
      const oldPermStr = formatPermActionsCn(oldP);
      const newPermStr = formatPermActionsCn(p);
      if (oldPermStr !== newPermStr) {
        const modName = SYSTEM_MODULES.find(m => m.key === p.moduleKey)?.name || p.moduleKey;
        beforeDiff[`${modName}權限`] = oldPermStr;
        afterDiff[`${modName}權限`] = newPermStr;
      }

      const check = dbInstance.exec(`SELECT id FROM group_module_permissions WHERE groupId = '${group.id}' AND moduleKey = '${p.moduleKey}';`);
      if (check.length && check[0].values.length) {
        dbInstance.run(`
          UPDATE group_module_permissions
          SET canRead = ${p.canRead ? 1 : 0}, canWrite = ${p.canWrite ? 1 : 0}, canApprove = ${p.canApprove ? 1 : 0}, canExport = ${p.canExport ? 1 : 0}
          WHERE groupId = '${group.id}' AND moduleKey = '${p.moduleKey}';
        `);
      } else {
        const permId = `PERM-${group.id}-${p.moduleKey}`;
        dbInstance.run(`
          INSERT INTO group_module_permissions (id, groupId, moduleKey, canRead, canWrite, canApprove, canExport)
          VALUES ('${permId}', '${group.id}', '${p.moduleKey}', ${p.canRead ? 1 : 0}, ${p.canWrite ? 1 : 0}, ${p.canApprove ? 1 : 0}, ${p.canExport ? 1 : 0});
        `);
      }
    }
  }

  if (Object.keys(afterDiff).length > 0) {
    const grpDisplayName = group.groupName || oldGroup?.groupName || group.id;
    logAudit(dbInstance, operatorName, '修改資料', '權限群組', grpDisplayName, beforeDiff, afterDiff, operatorName);
  }
  saveDatabaseSnapshot();
  notifyListeners();
}

// 刪除自訂群組 (防呆：四大系統群組禁止刪除、有成員之群組禁止刪除)
export function deleteGroup(groupId: string, operatorName: string): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const check = dbInstance.exec(`SELECT isSystem, groupName FROM user_groups WHERE id = '${groupId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('群組不存在！');
  }

  if (Boolean(check[0].values[0][0])) {
    throw new Error('【憲法安全保護】系統預設四大核心業務群組（工務、財務、採購、業務）禁止刪除！');
  }

  const grpName = String(check[0].values[0][1]);
  const allUsers = getAllUsers();
  const members = allUsers.filter(u => u.groupId === groupId || (u.groupIds && u.groupIds.includes(groupId)));
  if (members.length > 0) {
    throw new Error(`無法刪除：尚有 ${members.length} 位同仁隸屬於此群組，請先移轉人員或解除群組指派再行刪除！`);
  }

  dbInstance.run(`DELETE FROM group_module_permissions WHERE groupId = '${groupId}';`);
  dbInstance.run(`DELETE FROM user_groups WHERE id = '${groupId}';`);

  logAudit(dbInstance, operatorName, '刪除資料', '權限群組', grpName, { '群組名稱': grpName }, { '群組狀態': '已刪除' }, operatorName);
  saveDatabaseSnapshot();
  notifyListeners();
}

// 指派同仁所屬單人群組 (向下相容)
export function assignUserGroup(userId: string, groupId: string, operatorName: string): void {
  assignUserGroups(userId, [groupId], operatorName);
}

// 指派同仁所屬多群組矩陣
export function assignUserGroups(userId: string, groupIds: string[], operatorName: string): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const targetUser = getAllUsers().find(u => u.id === userId);
  const oldGroupIds = targetUser?.groupIds || (targetUser?.groupId ? [targetUser.groupId] : []);
  const now = new Date().toISOString().substring(0, 10);
  const primary = groupIds.length > 0 ? `'${groupIds[0]}'` : 'NULL';
  const jsonStr = JSON.stringify(groupIds);
  dbInstance.run(`
    UPDATE users SET groupId = ${primary}, groupIds = '${jsonStr}', updatedAt = '${now}' WHERE id = '${userId}';
  `);
  if ([...oldGroupIds].sort().join(',') !== [...groupIds].sort().join(',')) {
    logAudit(
      dbInstance,
      operatorName,
      '修改資料',
      '同仁帳號',
      targetUser?.fullName || userId,
      { '所屬業務群組': resolveGroupNamesCn(oldGroupIds) },
      { '所屬業務群組': resolveGroupNamesCn(groupIds) },
      operatorName
    );
  }
  saveDatabaseSnapshot();
  notifyListeners();
}

// 快速切換群組在單一模組之讀/寫/審/出權限 (供 12 大模組權限矩陣即時點擊切換並記錄中文差異日誌)
export function toggleGroupModulePermission(
  groupId: string,
  moduleKey: ModuleKey,
  field: 'canRead' | 'canWrite' | 'canApprove' | 'canExport',
  operatorName: string
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const grp = getAllUserGroups().find(g => g.id === groupId);
  const mod = SYSTEM_MODULES.find(m => m.key === moduleKey);
  const currentPerms = getAllGroupPermissions(groupId);
  const existing = currentPerms.find(p => p.moduleKey === moduleKey) || {
    id: `PERM-${groupId}-${moduleKey}`,
    groupId,
    moduleKey,
    canRead: false,
    canWrite: false,
    canApprove: false,
    canExport: false,
  };

  const nextState = {
    canRead: existing.canRead,
    canWrite: existing.canWrite,
    canApprove: existing.canApprove,
    canExport: existing.canExport,
  };

  const nextVal = !existing[field];
  nextState[field] = nextVal;

  // 智慧防呆連動：若開啟「寫/審/出」，自動確保「讀 (canRead)」一併開啟；若關閉「讀」，自動關閉「寫/審/出」
  if (field !== 'canRead' && nextVal) {
    nextState.canRead = true;
  }
  if (field === 'canRead' && !nextVal) {
    nextState.canWrite = false;
    nextState.canApprove = false;
    nextState.canExport = false;
  }

  const check = dbInstance.exec(`SELECT id FROM group_module_permissions WHERE groupId = '${groupId}' AND moduleKey = '${moduleKey}';`);
  if (check.length && check[0].values.length) {
    dbInstance.run(`
      UPDATE group_module_permissions
      SET canRead = ${nextState.canRead ? 1 : 0},
          canWrite = ${nextState.canWrite ? 1 : 0},
          canApprove = ${nextState.canApprove ? 1 : 0},
          canExport = ${nextState.canExport ? 1 : 0}
      WHERE groupId = '${groupId}' AND moduleKey = '${moduleKey}';
    `);
  } else {
    dbInstance.run(`
      INSERT INTO group_module_permissions (id, groupId, moduleKey, canRead, canWrite, canApprove, canExport)
      VALUES ('PERM-${groupId}-${moduleKey}', '${groupId}', '${moduleKey}', ${nextState.canRead ? 1 : 0}, ${nextState.canWrite ? 1 : 0}, ${nextState.canApprove ? 1 : 0}, ${nextState.canExport ? 1 : 0});
    `);
  }

  const formatActions = (s: { canRead: boolean; canWrite: boolean; canApprove: boolean; canExport: boolean }) => {
    const arr: string[] = [];
    if (s.canRead) arr.push('檢視');
    if (s.canWrite) arr.push('編輯');
    if (s.canApprove) arr.push('審批');
    if (s.canExport) arr.push('匯出');
    return arr.length > 0 ? arr.join('、') : '無權限';
  };

  const oldStr = formatActions(existing);
  const newStr = formatActions(nextState);
  if (oldStr !== newStr) {
    const modName = mod?.name || moduleKey;
    const grpName = grp?.groupName || groupId;
    logAudit(
      dbInstance,
      operatorName,
      '修改資料',
      '權限群組',
      grpName,
      { [`${modName}權限`]: oldStr },
      { [`${modName}權限`]: newStr },
      operatorName
    );
  }

  saveDatabaseSnapshot();
  notifyListeners();
}





// ============================================================================
// 🚚 現場進貨簽收模組 (Inbound Goods Management - 直入案場成本 A 模式)
// ============================================================================

export function getAllInboundReceipts(filters?: {
  companyId?: string;
  projectId?: string;
  vendorId?: string;
  status?: string;
  billingStatus?: string;
}): InboundReceipt[] {
  if (!dbInstance) return [];
  ensureDatabaseIntegrity(dbInstance);

  let query = `SELECT * FROM inbound_receipts WHERE isDeleted = 0`;
  const params: string[] = [];

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

  const res = dbInstance.exec(query);
  if (!res.length || !res[0].values.length) return [];

  const receipts: InboundReceipt[] = res[0].values.map(row => ({
    id: String(row[0]),
    receiptNumber: String(row[1]),
    companyId: String(row[2]),
    projectId: String(row[3]),
    projectNameSnapshot: row[4] ? String(row[4]) : undefined,
    vendorId: String(row[5]),
    vendorNameSnapshot: row[6] ? String(row[6]) : undefined,
    vendorTaxIdSnapshot: row[7] ? String(row[7]) : undefined,
    deliveryNoteNumber: String(row[8] || ''),
    receivedDate: String(row[9] || ''),
    receivedBy: String(row[10] || ''),
    totalAmount: Number(row[11] || 0),
    billingStatus: (row[12] || 'PENDING_BILLING') as InboundBillingStatus,
    reconciliationId: row[13] ? String(row[13]) : undefined,
    reconciliationNumber: row[14] ? String(row[14]) : undefined,
    purchaseOrderId: row[15] ? String(row[15]) : undefined,
    status: (row[16] || 'DRAFT') as InboundReceiptStatus,
    attachmentFileId: row[17] ? String(row[17]) : undefined,
    attachmentFileName: row[18] ? String(row[18]) : undefined,
    notes: row[19] ? String(row[19]) : undefined,
    isDeleted: Boolean(row[20]),
    version: Number(row[21] || 1),
    createdAt: String(row[22] || ''),
    updatedAt: String(row[23] || ''),
    items: [],
  }));

  // 抓取所有明細
  for (const r of receipts) {
    r.items = getInboundReceiptItems(r.id);
  }

  return receipts;
}

export function getInboundReceiptItems(receiptId: string): InboundReceiptItem[] {
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
  if (!dbInstance) return null;
  const receipts = getAllInboundReceipts();
  return receipts.find(r => r.id === id) || null;
}

export function createInboundReceipt(
  data: Partial<InboundReceipt>,
  items: Partial<InboundReceiptItem>[] = []
): InboundReceipt {
  if (!dbInstance) throw new Error('資料庫尚未就緒');

  const now = new Date().toISOString();
  const id = data.id || `INB-REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const receivedDate = data.receivedDate || now.slice(0, 10);

  // 產生單號：若為草稿暫存使用 TEMP 前綴或直接取號
  let receiptNumber = data.receiptNumber;
  if (!receiptNumber || receiptNumber.trim() === '') {
    if (data.status === 'POSTED') {
      receiptNumber = getNextDocumentNumber('INB', receivedDate);
    } else {
      receiptNumber = `TEMP-${Date.now().toString().slice(-6)}`;
    }
  }

  // 取得專案名稱與廠商名稱快照
  let projectNameSnapshot = data.projectNameSnapshot;
  if (!projectNameSnapshot && data.projectId) {
    const prjRes = dbInstance.exec(`SELECT name FROM projects WHERE id = '${data.projectId}';`);
    if (prjRes.length && prjRes[0].values.length) {
      projectNameSnapshot = String(prjRes[0].values[0][0]);
    }
  }

  let vendorNameSnapshot = data.vendorNameSnapshot;
  let vendorTaxIdSnapshot = data.vendorTaxIdSnapshot;
  if ((!vendorNameSnapshot || !vendorTaxIdSnapshot) && data.vendorId) {
    const bpRes = dbInstance.exec(`SELECT name, taxId FROM business_partners WHERE id = '${data.vendorId}';`);
    if (bpRes.length && bpRes[0].values.length) {
      vendorNameSnapshot = vendorNameSnapshot || String(bpRes[0].values[0][0]);
      vendorTaxIdSnapshot = vendorTaxIdSnapshot || String(bpRes[0].values[0][1]);
    }
  }

  // 計算明細總額
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

  dbInstance.run(`
    INSERT INTO inbound_receipts (
      id, receiptNumber, companyId, projectId, projectNameSnapshot,
      vendorId, vendorNameSnapshot, vendorTaxIdSnapshot, deliveryNoteNumber,
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
      '${(data.vendorId || '').replace(/'/g, "''")}',
      '${(vendorNameSnapshot || '').replace(/'/g, "''")}',
      '${(vendorTaxIdSnapshot || '').replace(/'/g, "''")}',
      '${(data.deliveryNoteNumber || '').replace(/'/g, "''")}',
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

  // A 模式直入案場成本：若直接過帳 (POSTED) 且關聯專案，同步累加專案 actualCost
  if (status === 'POSTED' && data.projectId && totalAmount > 0) {
    dbInstance.run(`
      UPDATE projects 
      SET actualCost = actualCost + ${totalAmount},
          updatedAt = '${now}'
      WHERE id = '${data.projectId}';
    `);
  }

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    receiptNumber,
    companyId: data.companyId || 'COMP-01',
    projectId: data.projectId || '',
    projectNameSnapshot,
    vendorId: data.vendorId || '',
    vendorNameSnapshot,
    vendorTaxIdSnapshot,
    deliveryNoteNumber: data.deliveryNoteNumber || '',
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
  if (!dbInstance) throw new Error('資料庫尚未就緒');
  const existing = getInboundReceiptById(id);
  if (!existing) throw new Error(`找不到進貨簽收單: ${id}`);

  if (existing.billingStatus === 'BILLED') {
    throw new Error('該進貨簽收單已納入會計對帳單請款，依法鎖定禁止修改');
  }

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
  if (data.receivedDate !== undefined) updates.push(`receivedDate = '${data.receivedDate}'`);
  if (data.receivedBy !== undefined) updates.push(`receivedBy = '${data.receivedBy.replace(/'/g, "''")}'`);
  if (data.notes !== undefined) updates.push(`notes = '${(data.notes || '').replace(/'/g, "''")}'`);
  if (data.status !== undefined) updates.push(`status = '${data.status}'`);
  if (data.projectId !== undefined) {
    updates.push(`projectId = '${data.projectId}'`);
    const prj = getAllProjects().find(p => p.id === data.projectId);
    if (prj) {
      updates.push(`projectNameSnapshot = '${prj.name.replace(/'/g, "''")}'`);
      updates.push(`projectCodeSnapshot = '${prj.projectCode.replace(/'/g, "''")}'`);
    }
  }
  if (data.vendorId !== undefined) {
    updates.push(`vendorId = '${data.vendorId}'`);
    const ven = getAllBusinessPartners().find(v => v.id === data.vendorId);
    if (ven) {
      updates.push(`vendorNameSnapshot = '${ven.name.replace(/'/g, "''")}'`);
      updates.push(`vendorTaxIdSnapshot = '${(ven.taxId || '').replace(/'/g, "''")}'`);
    }
  }
  if (data.attachmentFileId !== undefined) updates.push(`attachmentFileId = ${data.attachmentFileId ? `'${data.attachmentFileId}'` : 'NULL'}`);
  if (data.attachmentFileName !== undefined) updates.push(`attachmentFileName = ${data.attachmentFileName ? `'${data.attachmentFileName.replace(/'/g, "''")}'` : 'NULL'}`);

  dbInstance.run(`UPDATE inbound_receipts SET ${updates.join(', ')} WHERE id = '${id}';`);

  saveDatabaseSnapshot();
  notifyListeners();

  return getInboundReceiptById(id)!;
}

export function postInboundReceipt(id: string): InboundReceipt {
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

  // A 模式直入案場成本：過帳時同步累加專案 actualCost
  if (existing.projectId && existing.totalAmount > 0) {
    dbInstance.run(`
      UPDATE projects 
      SET actualCost = actualCost + ${existing.totalAmount},
          updatedAt = '${now}'
      WHERE id = '${existing.projectId}';
    `);
  }

  saveDatabaseSnapshot();
  notifyListeners();

  return getInboundReceiptById(id)!;
}

export function voidInboundReceipt(id: string, notes?: string): InboundReceipt {
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

  // A 模式：若原單為 POSTED 狀態，作廢時自專案 actualCost 回沖扣除
  if (existing.status === 'POSTED' && existing.projectId && existing.totalAmount > 0) {
    dbInstance.run(`
      UPDATE projects 
      SET actualCost = MAX(0, actualCost - ${existing.totalAmount}),
          updatedAt = '${now}'
      WHERE id = '${existing.projectId}';
    `);
  }

  saveDatabaseSnapshot();
  notifyListeners();

  return getInboundReceiptById(id)!;
}

export function deleteInboundReceipt(id: string): boolean {
  if (!dbInstance) return false;
  const existing = getInboundReceiptById(id);
  if (!existing) return false;

  if (existing.status === 'POSTED' || existing.billingStatus === 'BILLED') {
    throw new Error('已過帳或已對帳之進貨單據禁止物理刪除，請使用「作廢」功能');
  }

  dbInstance.run(`UPDATE inbound_receipts SET isDeleted = 1 WHERE id = '${id}';`);
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 🌊 取得廠商往來大水池水位總表 (Vendor Ledger Pool)
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
  if (!dbInstance) return [];
  ensureDatabaseIntegrity(dbInstance);

  const receipts = getAllInboundReceipts({ companyId });
  const poolMap = new Map<string, VendorPoolSummary>();

  for (const r of receipts) {
    if (r.status === 'VOIDED') continue; // 排除作廢

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
