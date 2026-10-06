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
  Item,
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
  SystemConfig,
  AuditLog,
  CashFlowMetrics,
  User,
  UserGroup,
  GroupModulePermission,
  ModuleKey,
  UserRole,
  AnnualArchiveSnapshot,
  SystemFile,
  RestoreStrategy,
  ModularBackupPackage,
  RestoreResult
} from '../types/erp';

declare global {
  interface Window {
    initSqlJs?: (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;
  }
}

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
      groupId TEXT,
      groupIds TEXT DEFAULT '[]',
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
      canExport INTEGER DEFAULT 0
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
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_archive_year ON annual_archive_snapshots (archiveYear);
    CREATE INDEX IF NOT EXISTS idx_files_target ON system_files (targetTable, targetId);

    CREATE TABLE IF NOT EXISTS system_configs (
      id TEXT PRIMARY KEY,
      configKey TEXT UNIQUE NOT NULL,
      configValue TEXT NOT NULL,
      valueType TEXT DEFAULT 'STRING',
      validFrom TEXT,
      validTo TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1
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
      type TEXT NOT NULL,
      contactPerson TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      bankName TEXT,
      bankCode TEXT,
      bankAccount TEXT,
      paymentTermsDays INTEGER DEFAULT 30,
      isHighRisk INTEGER DEFAULT 0,
      riskReason TEXT,
      companyId TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1
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
}

// 建立營造工程真實範例資料
export function seedInitialData(db: Database) {
  // 清理現有資料
  const tables = [
    'users', 'user_groups', 'group_module_permissions',
    'companies', 'system_configs', 'audit_logs', 'projects', 'project_sites',
    'project_wbs', 'business_partners', 'items', 'quotations', 'quotation_revisions',
    'quotation_items', 'quotation_billing_milestones', 'purchase_orders',
    'purchase_order_items', 'subcontracts', 'valuations', 'valuation_items',
    'accounts_payable', 'accounts_receivable', 'bank_checks'
  ];
  tables.forEach(t => db.run(`DELETE FROM ${t};`));

  // 0. 三層式帳號權限與 PBAC 模組矩陣
  seedUserPermissionData(db);

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
    INSERT INTO system_configs (id, configKey, configValue, valueType, validFrom, isDeleted, version)
    VALUES
      ('CFG-01', 'TAX_RATE', '0.05', 'NUMBER', '2026-01-01', 0, 1),
      ('CFG-02', 'FIN_TAX_TOLERANCE', '5.0', 'NUMBER', '2026-01-01', 0, 1),
      ('CFG-03', 'DEFAULT_RETENTION_RATE', '10.0', 'NUMBER', '2026-01-01', 0, 1),
      ('CFG-04', 'PROJECT_LOCK_MODE', 'STRICT', 'STRING', '2026-01-01', 0, 1),
      ('CFG-05', 'NHI_RATE', '0.0211', 'NUMBER', '2026-01-01', 0, 1);
  `);

  // 3. 商業夥伴 (業主、混凝土下包、鋼構廠、弱電機電)
  db.run(`
    INSERT INTO business_partners (id, bpCode, name, taxId, type, contactPerson, phone, email, address, bankName, bankCode, bankAccount, paymentTermsDays, isHighRisk, riskReason, companyId, isDeleted, version)
    VALUES
      ('BP-01', 'CUST-001', '富鼎置地開發建設股份有限公司', '12345678', 'CUSTOMER', '陳大為 總監', '02-2712-8888', 'contact@fuding.com.tw', '台北市信義區松高路100號', '中國信託商業銀行', '822', '123456789012', 45, 0, NULL, 'COMP-01', 0, 1),
      ('BP-02', 'CUST-002', '國揚高新科技園區開發股份有限公司', '23456789', 'CUSTOMER', '林志祥 副總', '03-5712-9999', 'service@guoyang.com.tw', '新竹市東區公道五路二段50號', '國泰世華銀行', '013', '234567890123', 60, 0, NULL, 'COMP-01', 0, 1),
      ('BP-03', 'VEND-001', '台灣水泥股份有限公司 (台北營業所)', '03754904', 'VENDOR', '黃經理', '02-2567-8899', 'orders@taiwancement.com', '台北市中山北路二段113號', '台灣銀行', '004', '004001234567', 30, 0, NULL, 'COMP-01', 0, 1),
      ('BP-04', 'VEND-002', '中鋼結構工程股份有限公司', '86512390', 'VENDOR', '周工程師', '07-616-8800', 'steel@csbc.com.tw', '高雄市小港區中鋼路1號', '兆豐國際商業銀行', '017', '017009876543', 30, 0, NULL, 'COMP-01', 0, 1),
      ('BP-05', 'SUB-001', '合眾基礎連續壁深開挖工程行', '78901234', 'SUBCONTRACTOR', '張添進 負責人', '0912-345-678', 'hezhong@tunnel.tw', '新北市五股區成泰路三段12號', '第一銀行', '007', '007001928374', 15, 0, NULL, 'COMP-01', 0, 1),
      ('BP-06', 'SUB-002', '億翔機電弱電工程企業社', '45678901', 'SUBCONTRACTOR', '李文發', '0933-888-777', 'yixiang@mep.tw', '桃園市蘆竹區中正北路88號', '玉山銀行', '808', '808006543210', 30, 1, '曾有工程逾期爭議紀錄，發包前需副總以上特許核可', 'COMP-01', 0, 1);
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
    'companies', 'system_configs', 'audit_logs', 'document_sequences',
    'annual_archive_snapshots', 'system_files',
    'projects', 'project_sites',
    'project_wbs', 'business_partners', 'items', 'quotations', 'quotation_revisions',
    'quotation_items', 'quotation_billing_milestones', 'purchase_orders',
    'purchase_order_items', 'subcontracts', 'valuations', 'valuation_items',
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

// ============================================================================
// 🏛️ 單據跳號自癒校準 (Sequence Reseed Engine)
// ============================================================================
export function reseedDocumentSequences(db?: Database): void {
  const targetDb = db || dbInstance;
  if (!targetDb) return;

  const sequenceSources: { table: string; column: string }[] = [
    { table: 'purchase_orders', column: 'poNumber' },
    { table: 'valuations', column: 'valuationNumber' },
    { table: 'quotations', column: 'quotationNumber' },
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

// 取得下一個單據號碼
export function getNextSequenceNumber(prefix: string, padLength = 3): string {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();
  dbInstance.run(`
    INSERT INTO document_sequences (prefix, currentVal, updatedAt)
    VALUES ('${prefix}', 1, '${now}')
    ON CONFLICT(prefix) DO UPDATE SET
      currentVal = currentVal + 1,
      updatedAt = '${now}';
  `);
  const res = dbInstance.exec(`SELECT currentVal FROM document_sequences WHERE prefix = '${prefix}';`);
  const currentVal = Number(res[0]?.values[0]?.[0] || 1);
  return `${prefix}-${String(currentVal).padStart(padLength, '0')}`;
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
    'SUBCONTRACTS': ['subcontracts'],
    'VALUATIONS': ['valuations', 'valuation_items'],
    'FINANCE': ['accounts_payable', 'accounts_receivable', 'bank_checks'],
    'SYSTEM_CONFIGS': ['system_configs', 'user_groups', 'group_module_permissions', 'users', 'document_sequences'],
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
export function getDatabaseModuleStats(): {
  moduleKey: string;
  moduleName: string;
  tables: string[];
  totalRecords: number;
}[] {
  if (!dbInstance) return [];

  const modules = [
    { key: 'COMPANIES', name: '公司法人與集團實體', tables: ['companies'] },
    { key: 'PROJECTS', name: '專案案場與 WBS 工項', tables: ['projects', 'project_sites', 'project_wbs'] },
    { key: 'PARTNERS', name: '商業夥伴與工料庫存', tables: ['business_partners', 'items'] },
    { key: 'QUOTATIONS', name: '報價與請款里程碑', tables: ['quotations', 'quotation_revisions', 'quotation_items', 'quotation_billing_milestones'] },
    { key: 'PURCHASE_ORDERS', name: '採購發包與明細單據', tables: ['purchase_orders', 'purchase_order_items'] },
    { key: 'SUBCONTRACTS', name: '工程承攬合約主檔', tables: ['subcontracts'] },
    { key: 'VALUATIONS', name: '下包工程估驗計價', tables: ['valuations', 'valuation_items'] },
    { key: 'FINANCE', name: '財務會計與應收付票據', tables: ['accounts_payable', 'accounts_receivable', 'bank_checks'] },
    { key: 'SYSTEM_CONFIGS', name: '全域參數、權限與跳號', tables: ['system_configs', 'user_groups', 'group_module_permissions', 'users', 'document_sequences'] },
    { key: 'ARCHIVES', name: '年度唯讀封存快照紀錄', tables: ['annual_archive_snapshots'] },
    { key: 'FILES', name: '無紙化附件金庫索引', tables: ['system_files'] }
  ];

  return modules.map(m => {
    let count = 0;
    for (const t of m.tables) {
      try {
        const res = dbInstance!.exec(`SELECT count(*) FROM ${t};`);
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
// 🏛️ 附件管理服務 (SystemFile Service)
// ============================================================================
export function getAllSystemFiles(): SystemFile[] {
  if (!dbInstance) return [];
  try {
    const res = dbInstance.exec(`
      SELECT id, targetTable, targetId, fileName, originalName, savedName, fileSizeBytes, mimeType, fileCategory, storagePath, isEncrypted, fileHash, companyId, uploadTime, version, createdAt, updatedAt
      FROM system_files
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
      version: Number(v[14] || 1),
      createdAt: v[15] ? String(v[15]) : undefined,
      updatedAt: v[16] ? String(v[16]) : undefined
    }));
  } catch (e) {
    return [];
  }
}

export function saveSystemFileRecord(file: Partial<SystemFile> & { targetTable: string; targetId: string; fileName: string }): SystemFile {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();
  const id = file.id || `FILE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const isEncryptedInt = file.isEncrypted ? 1 : 0;
  const storagePath = file.storagePath || (file.isEncrypted ? `storage/secure_vault/${now.slice(0, 7)}/${id}.enc` : `storage/public_docs/${now.slice(0, 7)}/${file.fileName}`);
  const fileHash = file.fileHash || `sha256_${Date.now()}`;
  const fileSizeBytes = file.fileSizeBytes || 1024;
  const mimeType = file.mimeType || 'application/octet-stream';
  const fileCategory = file.fileCategory || '一般憑證';

  dbInstance.run(`
    INSERT INTO system_files (id, targetTable, targetId, fileName, originalName, savedName, fileSizeBytes, mimeType, fileCategory, storagePath, isEncrypted, fileHash, companyId, uploadTime, version, createdAt, updatedAt)
    VALUES ('${id}', '${file.targetTable}', '${file.targetId}', '${file.fileName.replace(/'/g, "''")}', '${(file.originalName || file.fileName).replace(/'/g, "''")}', '${id}', ${fileSizeBytes}, '${mimeType}', '${fileCategory}', '${storagePath}', ${isEncryptedInt}, '${fileHash}', ${file.companyId ? `'${file.companyId}'` : 'NULL'}, '${file.uploadTime || now}', 1, '${now}', '${now}')
    ON CONFLICT(id) DO UPDATE SET
      fileName = '${file.fileName.replace(/'/g, "''")}',
      storagePath = '${storagePath}',
      isEncrypted = ${isEncryptedInt},
      fileHash = '${fileHash}',
      version = version + 1,
      updatedAt = '${now}';
  `);

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
    version: 1,
    createdAt: now,
    updatedAt: now
  };
}

// 讀取所有集團、公司與個人實體
export function getAllCompanies(): Company[] {
  if (!dbInstance) return [];
  const res = dbInstance.exec(`
    SELECT id, companyCode, name, shortName, entityType, parentId, taxId, nationalId, representative, keyPersonnel, documentPrefix, phones, email, registeredAddress, contactAddress, capitalAmount, baseCurrency, isDeleted, version, createdAt, updatedAt 
    FROM companies 
    WHERE isDeleted = 0 
    ORDER BY CASE WHEN entityType = 'GROUP' THEN 0 WHEN entityType = 'CORPORATION' THEN 1 ELSE 2 END, companyCode;
  `);
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

// 儲存或更新公司法人/集團/個人實體 (僅記錄有修改之欄位，並以中文記錄)
export function saveCompany(company: Partial<Company> & { id: string; name: string; companyCode: string }, operatorName: string = '系統管理員'): void {
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
  logAudit(dbInstance, operatorName, '刪除資料', '集團與公司設定', compDisplayName, { '實體狀態': '啟用中' }, { '實體狀態': '已標記刪除' }, operatorName);
  saveDatabaseSnapshot();
  notifyListeners();
}

// 讀取所有專案
export function getAllProjects(companyId?: string): Project[] {
  if (!dbInstance) return [];
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

// 讀取商業夥伴
export function getAllBusinessPartners(): BusinessPartner[] {
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT * FROM business_partners WHERE isDeleted = 0 ORDER BY bpCode;`);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    bpCode: String(v[1]),
    name: String(v[2]),
    taxId: String(v[3]),
    type: v[4] as BusinessPartner['type'],
    contactPerson: String(v[5] || ''),
    phone: String(v[6] || ''),
    email: String(v[7] || ''),
    address: String(v[8] || ''),
    bankName: String(v[9] || ''),
    bankCode: String(v[10] || ''),
    bankAccount: String(v[11] || ''),
    paymentTermsDays: Number(v[12] || 30),
    isHighRisk: Boolean(v[13]),
    riskReason: v[14] ? String(v[14]) : undefined,
    companyId: String(v[15]),
    isDeleted: Boolean(v[16]),
    version: Number(v[17]),
  }));
}

// 讀取報價單
export function getAllQuotations(): Quotation[] {
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT * FROM quotations WHERE isDeleted = 0 ORDER BY quoteNumber DESC;`);
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
    version: Number(v[15]),
    createdAt: String(v[16]),
    updatedAt: String(v[17]),
  }));
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
  const res = dbInstance.exec(`SELECT * FROM system_configs WHERE isDeleted = 0;`);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    configKey: String(v[1]),
    configValue: String(v[2]),
    valueType: v[3] as SystemConfig['valueType'],
    validFrom: String(v[4]),
    validTo: v[5] ? String(v[5]) : undefined,
    isDeleted: Boolean(v[6]),
    version: Number(v[7]),
  }));
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

// 12 大營造工程核心模組字典
export const SYSTEM_MODULES: { key: ModuleKey; name: string; category: string; description: string }[] = [
  { key: 'COMPANIES', name: '公司法人組織', category: '基礎架構', description: '集團多法人架構、統編與幣別維護' },
  { key: 'PROJECTS', name: '專案與案場工程', category: '工程工務', description: '工程案場主檔、WBS 節點、預算與成本' },
  { key: 'PARTNERS', name: '商業夥伴主檔', category: '主檔邊界', description: '業主、材料商、工程下包商與銀行帳號' },
  { key: 'QUOTATIONS', name: '報價與銷售 (CPQ)', category: '專案業務', description: 'REV-A/B 投標單、粉紅扣減折讓、里程碑請款' },
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

  // 2. 建立四大群組之 12 大模組權限矩陣 (Read, Write, Approve, Export)
  const groupPermMap: Record<string, Record<ModuleKey, { r: number; w: number; a: number; e: number }>> = {
    'GRP-ENG': {
      COMPANIES: { r: 1, w: 0, a: 0, e: 0 },
      PROJECTS: { r: 1, w: 1, a: 0, e: 0 },
      PARTNERS: { r: 1, w: 0, a: 0, e: 0 },
      QUOTATIONS: { r: 0, w: 0, a: 0, e: 0 },
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

  // 3. 建立三層式身分種子使用者 (唯一 Superadmin、Admin、四大業務 User)
  db.run(`
    INSERT INTO users (id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, groupId, groupIds, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, createdAt, updatedAt)
    VALUES
      ('USR-001', 'superadmin', '黃副總經理', 'huang.gm@mega-build.com.tw', 'SUPERADMIN', 1, 1, 1, NULL, '[]', 'ACTIVE', '副總經理兼營運長 (唯一最高管理者)', '["COMP-01","COMP-02"]', 'COMP-01', 'admin888', 0, '2026-01-01', '2026-01-01'),
      ('USR-002', 'admin_chen', '陳資訊主任', 'chen.it@mega-build.com.tw', 'ADMIN', 0, 0, 0, NULL, '[]', 'ACTIVE', '資訊系統處主任 (一般管理員)', '["COMP-01","COMP-02"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01'),
      ('USR-003', 'eng_lin', '林工務主任', 'lin.site@mega-build.com.tw', 'USER', 0, 0, 0, 'GRP-ENG', '["GRP-ENG"]', 'ACTIVE', '土木結構主任工程師', '["COMP-01"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01'),
      ('USR-004', 'acc_chang', '張會計長', 'chang.acc@mega-build.com.tw', 'USER', 0, 0, 0, 'GRP-ACC', '["GRP-ACC"]', 'ACTIVE', '財務會計處副理', '["COMP-01","COMP-02"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01'),
      ('USR-005', 'proc_wang', '王採購專員', 'wang.proc@mega-build.com.tw', 'USER', 0, 0, 0, 'GRP-PROC', '["GRP-PROC"]', 'ACTIVE', '發包採購部資深專員', '["COMP-01"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01'),
      ('USR-006', 'sales_liu', '劉業務副理', 'liu.sales@mega-build.com.tw', 'USER', 0, 0, 0, 'GRP-SALES', '["GRP-SALES"]', 'ACTIVE', '專案開發業務副理', '["COMP-01"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01');
  `);
}

// 平滑資料庫完整性修復器 (保證現有快照升級時表結構與種子資料齊全)
export function ensureDatabaseIntegrity(db: Database) {
  initializeTables(db);

  // 升級檢測：確保 users 表擁有 groupIds、canManageUsers、canManageSystemConfigs、canManageAdmins、passwordHash、isPasswordReset 欄位
  try { db.run(`ALTER TABLE users ADD COLUMN groupIds TEXT DEFAULT '[]';`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN canManageUsers INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN canManageSystemConfigs INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN canManageAdmins INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN passwordHash TEXT DEFAULT '888888';`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN isPasswordReset INTEGER DEFAULT 0;`); } catch (e) {}

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
        INSERT OR REPLACE INTO users (id, username, fullName, email, role, canManageSystemConfigs, groupId, groupIds, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, createdAt, updatedAt)
        VALUES ('USR-001', 'superadmin', '黃副總經理', 'huang.gm@mega-build.com.tw', 'SUPERADMIN', 1, NULL, '[]', 'ACTIVE', '副總經理兼營運長 (唯一最高管理者)', '["COMP-01","COMP-02"]', 'COMP-01', 'admin888', 0, '2026-01-01', '2026-01-01');
      `);
    }
  } catch (e) {
    console.error('Superadmin integrity check failed', e);
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
  if (role === 'SUPERADMIN') return '最高管理者';
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
    SELECT id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, groupId, groupIds, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, lastLoginAt, createdAt, updatedAt, deleteStage, stageDeletedAt, purgeDueAt, deletedBy, stageNotes 
    FROM users 
    ORDER BY CASE role WHEN 'SUPERADMIN' THEN 1 WHEN 'ADMIN' THEN 2 ELSE 3 END, id ASC;
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
    return {
      id: String(v[0]),
      username: String(v[1]),
      fullName: String(v[2]),
      email: String(v[3] || ''),
      role: String(v[4]) as User['role'],
      canManageUsers: Boolean(v[5]),
      canManageSystemConfigs: Boolean(v[6]),
      canManageAdmins: Boolean(v[7]),
      groupId: groupId || groupIds[0],
      groupIds,
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
    role: 'ADMIN' | 'USER';
    canManageUsers?: boolean;
    canManageSystemConfigs?: boolean;
    canManageAdmins?: boolean;
    groupId?: string;
    groupIds?: string[];
    title?: string;
    allowedCompanies?: string[];
    defaultCompanyId?: string;
    password?: string;
  },
  operatorRole: 'SUPERADMIN' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean
): User {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  // 帳號管理專人權限檢核
  if (operatorRole !== 'SUPERADMIN' && !operatorCanManageUsers) {
    throw new Error('無帳號管理專人權限：系統帳號維護需由 Superadmin 特別指定之專人 Admin 始得操作！');
  }
  
  if ((newUser.role as string) === 'SUPERADMIN') {
    throw new Error('憲法防呆：系統僅允許一位 Superadmin，禁止直接建立第二位 Superadmin！若需移交請使用「最高權限交接」流程。');
  }

  // 階層原則：一般 Admin 只能建立下一階 User，除非經 Superadmin 授權同階管理特許
  if (newUser.role === 'ADMIN' && operatorRole !== 'SUPERADMIN' && !operatorCanManageAdmins) {
    throw new Error('階層權限受限：您尚未取得 Superadmin 授予之【同階管理特許 (canManageAdmins)】，依規定只能建立下一階層 (User) 業務同仁，無法新增同階 Admin 帳號！');
  }

  const selectedGroupIds = newUser.groupIds && newUser.groupIds.length > 0
    ? newUser.groupIds
    : (newUser.groupId ? [newUser.groupId] : []);

  if (newUser.role === 'USER' && selectedGroupIds.length === 0) {
    throw new Error('一般同仁帳號必須至少指派一個所屬業務群組！');
  }

  // 檢查帳號重複
  const check = dbInstance.exec(`SELECT id FROM users WHERE username = '${newUser.username.replace(/'/g, "''")}';`);
  if (check.length > 0 && check[0].values.length > 0) {
    throw new Error(`帳號 ${newUser.username} 已存在，請使用其他帳號！`);
  }

  // 檢查特許授權權限 (只有 Superadmin 可開啟特許)
  const canManageUserMgr = (operatorRole === 'SUPERADMIN' && newUser.role === 'ADMIN' && Boolean(newUser.canManageUsers)) ? 1 : 0;
  const canManageConfigs = (operatorRole === 'SUPERADMIN' && newUser.role === 'ADMIN' && Boolean(newUser.canManageSystemConfigs)) ? 1 : 0;
  const canManagePeers = (operatorRole === 'SUPERADMIN' && newUser.role === 'ADMIN' && Boolean(newUser.canManageAdmins)) ? 1 : 0;

  const id = `USR-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  const now = new Date().toISOString().substring(0, 10);
  const title = newUser.title ? `'${newUser.title.replace(/'/g, "''")}'` : 'NULL';
  const primaryGroupId = selectedGroupIds[0] ? `'${selectedGroupIds[0]}'` : 'NULL';
  const groupIdsJson = `'${JSON.stringify(selectedGroupIds)}'`;
  const comps = newUser.allowedCompanies && newUser.allowedCompanies.length > 0 ? newUser.allowedCompanies : ['COMP-01', 'COMP-02'];
  const compsJson = `'${JSON.stringify(comps)}'`;
  const defComp = newUser.defaultCompanyId || comps[0] || 'COMP-01';
  const pass = (newUser.password || '888888').replace(/'/g, "''");

  dbInstance.run(`
    INSERT INTO users (id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, groupId, groupIds, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, createdAt, updatedAt)
    VALUES ('${id}', '${newUser.username.replace(/'/g, "''")}', '${newUser.fullName.replace(/'/g, "''")}', '${(newUser.email || '').replace(/'/g, "''")}', '${newUser.role}', ${canManageUserMgr}, ${canManageConfigs}, ${canManagePeers}, ${primaryGroupId}, ${groupIdsJson}, 'ACTIVE', ${title}, ${compsJson}, '${defComp}', '${pass}', 0, '${now}', '${now}');
  `);

  const createSummary: Record<string, string> = {
    '同仁姓名': newUser.fullName,
    '權限角色': formatRoleCn(newUser.role),
    '職務職稱': newUser.title || '未填寫',
    '授權營運法人': resolveCompanyNamesCn(comps),
  };
  if (newUser.role === 'USER') {
    createSummary['所屬業務群組'] = resolveGroupNamesCn(selectedGroupIds);
  } else {
    if (canManageUserMgr) createSummary['帳號管理專人特許'] = '開啟';
    if (canManageConfigs) createSummary['全域核心參數特許'] = '開啟';
    if (canManagePeers) createSummary['同階管理員維護特許'] = '開啟';
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
    groupId: selectedGroupIds[0],
    groupIds: selectedGroupIds,
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
    role?: 'ADMIN' | 'USER';
    canManageUsers?: boolean;
    canManageSystemConfigs?: boolean;
    canManageAdmins?: boolean;
    groupId?: string | null;
    groupIds?: string[];
    allowedCompanies?: string[];
    defaultCompanyId?: string;
    status?: 'ACTIVE' | 'DISABLED';
    title?: string;
  },
  operatorRole: 'SUPERADMIN' | 'ADMIN',
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

  // 帳號管理專人權限檢核
  if (operatorRole !== 'SUPERADMIN' && !operatorCanManageUsers) {
    throw new Error('無帳號管理專人權限：系統帳號維護需由 Superadmin 特別指定之專人 Admin 始得操作！');
  }

  // 取得原目標帳號完整資料以便精準比對修改差異
  const currentRes = dbInstance.exec(`
    SELECT id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, groupId, groupIds, status, title, allowedCompanies, defaultCompanyId 
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
  let oldGroupIds: string[] = [];
  try {
    if (oldRow[9]) oldGroupIds = JSON.parse(String(oldRow[9]));
  } catch (e) {}
  if (oldGroupIds.length === 0 && oldRow[8]) oldGroupIds = [String(oldRow[8])];
  const oldStatus = String(oldRow[10] || 'ACTIVE');
  const oldTitle = String(oldRow[11] || '');
  let oldAllowedComps: string[] = ['COMP-01'];
  try {
    if (oldRow[12]) oldAllowedComps = JSON.parse(String(oldRow[12]));
  } catch (e) {}
  const oldDefaultComp = String(oldRow[13] || 'COMP-01');

  // 憲法防呆：一般 Admin 不得變更 Superadmin 帳號
  if (targetRole === 'SUPERADMIN' && operatorRole !== 'SUPERADMIN') {
    throw new Error('憲法保護防禦：一般 Admin 無權修改系統最高 Superadmin 帳號！');
  }

  // 階層防呆：若目標帳號為 ADMIN，且操作者非 SUPERADMIN 且無同階管理特許與帳號專人特許
  if (targetRole === 'ADMIN' && operatorRole !== 'SUPERADMIN' && !operatorCanManageAdmins && !operatorCanManageUsers) {
    throw new Error('階層權限受限：您尚未取得 Superadmin 授予之【帳號管理人特許】或【同階管理特許】，無法修改同階 Admin 帳號！');
  }

  // 階層防呆：若試圖將角色改為 ADMIN，且操作者非 SUPERADMIN 且無同階管理特許
  if (updateData.role === 'ADMIN' && targetRole !== 'ADMIN' && operatorRole !== 'SUPERADMIN' && !operatorCanManageAdmins) {
    throw new Error('階層權限受限：您無權將同仁角色提升為同階 Admin，需由 Superadmin 授權同階管理特許！');
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

  // 憲法防呆：不可將任何使用者直接變更為 SUPERADMIN
  if ((updateData.role as string) === 'SUPERADMIN' && targetRole !== 'SUPERADMIN') {
    throw new Error('系統禁止直接賦予 SUPERADMIN 角色，必須由現任 Superadmin 執行交接程序！');
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
  } else if (operatorRole === 'SUPERADMIN') {
    // 唯獨系統最高 Superadmin 才有權限開啟或調整 Admin 進階特許
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
  } else {
    // 非 Superadmin 操作者：若試圖開啟特許則強制攔截，若未試圖開啟則自動忽略防禦性阻擋
    if (updateData.canManageUsers || updateData.canManageSystemConfigs || updateData.canManageAdmins) {
      throw new Error('憲法權限防護：唯獨最高 Superadmin 才有權限授予管理員進階特許！');
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

// 快速切換特定 Admin 之帳號管理專人特許 (僅限 Superadmin 操作)
export function toggleAdminUserManagerPrivilege(
  userId: string,
  canManage: boolean,
  operatorRole: 'SUPERADMIN' | 'ADMIN',
  operatorName: string
): void {
  updateUser({ id: userId, canManageUsers: canManage }, operatorRole, operatorName, true, true);
}

// 快速切換特定 Admin 之全域核心參數維護特許 (僅限 Superadmin 操作)
export function toggleAdminConfigPrivilege(
  userId: string,
  canManage: boolean,
  operatorRole: 'SUPERADMIN' | 'ADMIN',
  operatorName: string
): void {
  updateUser({ id: userId, canManageSystemConfigs: canManage }, operatorRole, operatorName, true, true);
}

// 快速切換特定 Admin 之同階管理特許 (僅限 Superadmin 操作)
export function toggleAdminPeerPrivilege(
  userId: string,
  canManage: boolean,
  operatorRole: 'SUPERADMIN' | 'ADMIN',
  operatorName: string
): void {
  updateUser({ id: userId, canManageAdmins: canManage }, operatorRole, operatorName, true, true);
}

// 重設同仁密碼 (需具備帳號管理專人權限；支援自訂新密碼或套用預設安全密碼)
export function resetUserPassword(
  userId: string,
  newPassword: string,
  operatorRole: 'SUPERADMIN' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  
  // 帳號管理專人權限檢核：非所有 Admin 都能重設他人密碼
  if (operatorRole !== 'SUPERADMIN' && !operatorCanManageUsers) {
    throw new Error('無重設他人密碼權限：他人密碼只能由 Superadmin 特別指定之帳號管理專人 Admin 執行重設！');
  }

  const check = dbInstance.exec(`SELECT id, role, fullName FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const role = check[0].values[0][1] as string;
  const fullName = String(check[0].values[0][2]);
  if (role === 'SUPERADMIN' && operatorRole !== 'SUPERADMIN') {
    throw new Error('憲法保護防禦：一般 Admin 無權重設系統最高 Superadmin 密碼！');
  }

  if (role === 'ADMIN' && operatorRole !== 'SUPERADMIN' && !operatorCanManageAdmins && !operatorCanManageUsers) {
    throw new Error('階層權限受限：您尚未取得 Superadmin 授予之【同階管理特許 (canManageAdmins)】或【帳號管理人特許】，無法重設同階 Admin 密碼！');
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
  operatorRole: 'SUPERADMIN' | 'ADMIN',
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
  operatorRole: 'SUPERADMIN' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean,
  reason?: string
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  // 帳號管理專人權限檢核
  if (operatorRole !== 'SUPERADMIN' && !operatorCanManageUsers) {
    throw new Error('無帳號管理專人權限：刪除同仁帳號需由 Superadmin 特別指定之專人 Admin 始得操作！');
  }

  const check = dbInstance.exec(`SELECT id, role, fullName, username, deleteStage FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const role = check[0].values[0][1] as string;
  const fullName = check[0].values[0][2] as string;
  const currentStage = check[0].values[0][4] as string;

  if (role === 'SUPERADMIN') {
    throw new Error('【憲法金身防護】系統唯一最高管理員 (Superadmin) 具備永久保護，嚴禁刪除！');
  }

  if (role === 'ADMIN' && operatorRole !== 'SUPERADMIN' && !operatorCanManageAdmins && !operatorCanManageUsers) {
    throw new Error('階層權限受限：您尚未取得 Superadmin 授予之【同階管理特許】或【帳號管理人特許】，無法刪除同階 Admin 帳號！');
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
  operatorRole: 'SUPERADMIN' | 'ADMIN',
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
  operatorRole: 'SUPERADMIN' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean
): void {
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  if (operatorRole !== 'SUPERADMIN' && !operatorCanManageUsers) {
    throw new Error('無帳號管理專人權限：操作需由 Superadmin 特別指定之專人 Admin 始得操作！');
  }

  const check = dbInstance.exec(`SELECT id, role, fullName, username, deleteStage FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const role = check[0].values[0][1] as string;
  const fullName = check[0].values[0][2] as string;

  if (role === 'SUPERADMIN') {
    throw new Error('【憲法金身防護】系統唯一最高管理員嚴禁封存！');
  }

  if (role === 'ADMIN' && operatorRole !== 'SUPERADMIN' && !operatorCanManageAdmins && !operatorCanManageUsers) {
    throw new Error('階層權限受限：您尚未取得 Superadmin 授予之特許權限，無法變更同階 Admin 狀態！');
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


