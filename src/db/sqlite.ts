// SQLite 本地資料庫引擎與資料持久層 (相容 WebAssembly sql.js 與全域 SQL 匯出/匯入)
import type { Database, SqlJsStatic } from 'sql.js';
import {
  Company,
  User,
  UserRole,
  Role,
  UserGroup,
  ErpModuleKey,
  ModulePermissionItem,
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
  CashFlowMetrics
} from '../types/erp';

// 系統 12 大模組清單常數
export const ERP_MODULES: { key: ErpModuleKey; name: string; category: ModulePermissionItem['category'] }[] = [
  { key: 'PROJECTS', name: '專案工程與案場工務 (WBS)', category: 'CORE_ENGINEERING' },
  { key: 'QUOTATIONS', name: '工程報價單 (CPQ三軌版次)', category: 'CORE_ENGINEERING' },
  { key: 'PURCHASE_ORDERS', name: '採購單發包 (PO統編快照)', category: 'PROCUREMENT_SUBCONTRACT' },
  { key: 'SUBCONTRACTS', name: '下包工程承攬合約 (保留款)', category: 'PROCUREMENT_SUBCONTRACT' },
  { key: 'VALUATIONS', name: '估驗計價與實付結算', category: 'PROCUREMENT_SUBCONTRACT' },
  { key: 'FINANCE_AP', name: '應付憑單與發票拆單 (AP)', category: 'FINANCE_ACCOUNTING' },
  { key: 'FINANCE_AR', name: '應收合約里程碑請款 (AR)', category: 'FINANCE_ACCOUNTING' },
  { key: 'BANK_CHECKS', name: '銀行應收付期票管理', category: 'FINANCE_ACCOUNTING' },
  { key: 'BUSINESS_PARTNERS', name: '商業夥伴主檔 (業主/包商/供應商)', category: 'GOVERNANCE' },
  { key: 'SYSTEM_CONFIGS', name: '全域系統參數與營業稅率', category: 'GOVERNANCE' },
  { key: 'AUDIT_LOGS', name: '不可竄改審計日誌與歷程', category: 'GOVERNANCE' },
  { key: 'USER_MANAGEMENT', name: '使用者帳號與權限矩陣', category: 'GOVERNANCE' },
];

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

  const SQL = await initFn({
    locateFile: (file) => `/${file}`
  });

  const savedDb = localStorage.getItem('engineering_erp_sqlite_db');
  if (savedDb) {
    try {
      const uInt8Array = new Uint8Array(JSON.parse(savedDb));
      dbInstance = new SQL.Database(uInt8Array);
      // 確保舊快照自動同步最新資料表架構 (如 users, roles) 與種子數據
      ensureDatabaseIntegrity(dbInstance);
      saveDatabaseSnapshot();
      console.log('✅ 成功從本機快照還原 SQLite 資料庫並完成架構與帳號種子資料同步');
      return dbInstance;
    } catch (e) {
      console.warn('⚠️ 舊快照載入失敗或結構不相容，將自動清理並重新建置全新資料庫', e);
      try {
        localStorage.removeItem('engineering_erp_sqlite_db');
      } catch (_) {}
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
    -- 1. 公司法人 (Company)
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      companyCode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      taxId TEXT NOT NULL,
      baseCurrency TEXT DEFAULT 'TWD',
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    -- 2. 全域參數與審計 (SystemConfig & AuditLog)
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

    -- 使用者主檔 (Users: 三層式身分架構)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      employeeId TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      fullName TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      groupId TEXT,
      allowedCompanies TEXT NOT NULL,
      defaultCompanyId TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      dailyExportLimit INTEGER DEFAULT 1000,
      maxConcurrentSessions INTEGER DEFAULT 3,
      delegateToId TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    -- 使用者權限群組 (User Groups: 4大預設組 + 自訂組)
    CREATE TABLE IF NOT EXISTS user_groups (
      id TEXT PRIMARY KEY,
      groupCode TEXT UNIQUE NOT NULL,
      groupName TEXT NOT NULL,
      description TEXT,
      isSystem INTEGER DEFAULT 0,
      approvalLimit REAL DEFAULT 0,
      canExportData INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );

    -- 群組模組細項權限矩陣 (Group Module Permissions Matrix)
    CREATE TABLE IF NOT EXISTS group_module_permissions (
      id TEXT PRIMARY KEY,
      groupId TEXT NOT NULL,
      moduleKey TEXT NOT NULL,
      canRead INTEGER DEFAULT 0,
      canWrite INTEGER DEFAULT 0,
      canApprove INTEGER DEFAULT 0,
      canExport INTEGER DEFAULT 0,
      UNIQUE(groupId, moduleKey)
    );

    -- 既有角色與相容矩陣 (Roles)
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      roleCode TEXT UNIQUE NOT NULL,
      roleName TEXT NOT NULL,
      description TEXT,
      canReadOwn INTEGER DEFAULT 1,
      canReadAll INTEGER DEFAULT 0,
      canWrite INTEGER DEFAULT 0,
      canApprove INTEGER DEFAULT 0,
      approvalLimit REAL DEFAULT 0,
      canExportData INTEGER DEFAULT 0,
      canVoidCheck INTEGER DEFAULT 0,
      canManageUsers INTEGER DEFAULT 0,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1
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
    // 自動相容欄位擴充
    try {
      db.run("ALTER TABLE users ADD COLUMN groupId TEXT;");
    } catch (_) {}
  `);
}

// 獨立公司種子資料
export function seedCompanies(db: Database) {
  try {
    db.run(`
      INSERT INTO companies (id, companyCode, name, taxId, baseCurrency, isDeleted, version, createdAt, updatedAt)
      VALUES 
        ('COMP-01', 'CMP-TW01', '台灣大巨營造工程股份有限公司', '88991234', 'TWD', 0, 1, '2026-01-01', '2026-01-01'),
        ('COMP-02', 'CMP-TW02', '宏達機電工程股份有限公司', '54329876', 'TWD', 0, 1, '2026-01-01', '2026-01-01');
    `);
  } catch (e) {
    console.warn('seedCompanies 略過或已存在:', e);
  }
}

// 獨立使用者權限群組種子資料 (4大預設組與模組權限矩陣)
export function seedUserGroups(db: Database) {
  try {
    const now = '2026-01-01';
    db.run(`
      INSERT INTO user_groups (id, groupCode, groupName, description, isSystem, approvalLimit, canExportData, createdAt, updatedAt)
      VALUES
        ('GRP-ENG', 'SITE_ENG', '工務組', '負責工地案場工務、WBS施工進度回報、日誌填報與估驗計價初審草稿', 1, 500000, 1, '${now}', '${now}'),
        ('GRP-ACC', 'FIN_ACC', '財務會計組', '負責應收應付憑單拆單、發票折讓沖銷、銀行期票開立與到期兌現', 1, 20000000, 1, '${now}', '${now}'),
        ('GRP-PROC', 'PROC_BUY', '採購發包組', '負責材料設備詢價發包、採購單PO開立、廠商管理與預付款扣抵', 1, 2000000, 1, '${now}', '${now}'),
        ('GRP-SALES', 'PROJ_SALES', '專案業務組', '負責業主合約報價單REV多版次、里程碑請款設定與專案WBS節點管控', 1, 10000000, 1, '${now}', '${now}');
    `);

    // 寫入 4 大群組之模組細項權限矩陣 (12 大模組)
    const permissionsData = [
      // 1. 工務組
      ['GRP-ENG', 'PROJECTS', 1, 1, 0, 1],
      ['GRP-ENG', 'QUOTATIONS', 1, 0, 0, 0],
      ['GRP-ENG', 'PURCHASE_ORDERS', 1, 0, 0, 0],
      ['GRP-ENG', 'SUBCONTRACTS', 1, 0, 0, 0],
      ['GRP-ENG', 'VALUATIONS', 1, 1, 0, 1],
      ['GRP-ENG', 'FINANCE_AP', 0, 0, 0, 0],
      ['GRP-ENG', 'FINANCE_AR', 0, 0, 0, 0],
      ['GRP-ENG', 'BANK_CHECKS', 0, 0, 0, 0],
      ['GRP-ENG', 'BUSINESS_PARTNERS', 1, 0, 0, 0],
      ['GRP-ENG', 'SYSTEM_CONFIGS', 0, 0, 0, 0],
      ['GRP-ENG', 'AUDIT_LOGS', 0, 0, 0, 0],
      ['GRP-ENG', 'USER_MANAGEMENT', 0, 0, 0, 0],

      // 2. 財務會計組
      ['GRP-ACC', 'PROJECTS', 1, 0, 0, 1],
      ['GRP-ACC', 'QUOTATIONS', 1, 0, 0, 1],
      ['GRP-ACC', 'PURCHASE_ORDERS', 1, 0, 0, 1],
      ['GRP-ACC', 'SUBCONTRACTS', 1, 0, 0, 1],
      ['GRP-ACC', 'VALUATIONS', 1, 0, 1, 1],
      ['GRP-ACC', 'FINANCE_AP', 1, 1, 1, 1],
      ['GRP-ACC', 'FINANCE_AR', 1, 1, 1, 1],
      ['GRP-ACC', 'BANK_CHECKS', 1, 1, 1, 1],
      ['GRP-ACC', 'BUSINESS_PARTNERS', 1, 0, 0, 1],
      ['GRP-ACC', 'SYSTEM_CONFIGS', 1, 0, 0, 0],
      ['GRP-ACC', 'AUDIT_LOGS', 1, 0, 0, 1],
      ['GRP-ACC', 'USER_MANAGEMENT', 0, 0, 0, 0],

      // 3. 採購發包組
      ['GRP-PROC', 'PROJECTS', 1, 0, 0, 1],
      ['GRP-PROC', 'QUOTATIONS', 1, 0, 0, 1],
      ['GRP-PROC', 'PURCHASE_ORDERS', 1, 1, 1, 1],
      ['GRP-PROC', 'SUBCONTRACTS', 1, 1, 0, 1],
      ['GRP-PROC', 'VALUATIONS', 1, 0, 0, 0],
      ['GRP-PROC', 'FINANCE_AP', 1, 0, 0, 0],
      ['GRP-PROC', 'FINANCE_AR', 0, 0, 0, 0],
      ['GRP-PROC', 'BANK_CHECKS', 0, 0, 0, 0],
      ['GRP-PROC', 'BUSINESS_PARTNERS', 1, 1, 0, 1],
      ['GRP-PROC', 'SYSTEM_CONFIGS', 0, 0, 0, 0],
      ['GRP-PROC', 'AUDIT_LOGS', 0, 0, 0, 0],
      ['GRP-PROC', 'USER_MANAGEMENT', 0, 0, 0, 0],

      // 4. 專案業務組
      ['GRP-SALES', 'PROJECTS', 1, 1, 0, 1],
      ['GRP-SALES', 'QUOTATIONS', 1, 1, 1, 1],
      ['GRP-SALES', 'PURCHASE_ORDERS', 1, 0, 0, 0],
      ['GRP-SALES', 'SUBCONTRACTS', 1, 0, 0, 0],
      ['GRP-SALES', 'VALUATIONS', 1, 0, 0, 0],
      ['GRP-SALES', 'FINANCE_AP', 0, 0, 0, 0],
      ['GRP-SALES', 'FINANCE_AR', 1, 1, 0, 1],
      ['GRP-SALES', 'BANK_CHECKS', 0, 0, 0, 0],
      ['GRP-SALES', 'BUSINESS_PARTNERS', 1, 1, 0, 1],
      ['GRP-SALES', 'SYSTEM_CONFIGS', 0, 0, 0, 0],
      ['GRP-SALES', 'AUDIT_LOGS', 0, 0, 0, 0],
      ['GRP-SALES', 'USER_MANAGEMENT', 0, 0, 0, 0],
    ];

    for (const [gid, mod, r, w, a, exp] of permissionsData) {
      const pid = `PERM-${gid}-${mod}`;
      db.run(`
        INSERT INTO group_module_permissions (id, groupId, moduleKey, canRead, canWrite, canApprove, canExport)
        VALUES ('${pid}', '${gid}', '${mod}', ${r}, ${w}, ${a}, ${exp});
      `);
    }
  } catch (e) {
    console.warn('seedUserGroups 略過或已存在:', e);
  }
}

// 獨立角色權限矩陣種子資料 (相容保留)
export function seedRoles(db: Database) {
  try {
    db.run(`
      INSERT INTO roles (id, roleCode, roleName, description, canReadOwn, canReadAll, canWrite, canApprove, approvalLimit, canExportData, canVoidCheck, canManageUsers, isDeleted, version)
      VALUES
        ('ROLE-01', 'SUPERADMIN', '超級系統管理員', '最高管理權限，具備全系統所有模組讀寫、核准、帳號與資料庫維護權限', 1, 1, 1, 1, 999999999, 1, 1, 1, 0, 1),
        ('ROLE-02', 'ADMIN', '系統管理員 (分權維護)', '可維護同仁帳號、指派業務群組與檢視審計歷程，不可竄改 Superadmin', 1, 1, 1, 1, 50000000, 1, 1, 1, 0, 1),
        ('ROLE-03', 'USER', '業務群組同仁', '依指派之群組 (工務、財務、採購、業務) 繼承專屬模組權限矩陣', 1, 0, 1, 0, 0, 0, 0, 0, 0, 1);
    `);
  } catch (e) {
    console.warn('seedRoles 略過或已存在:', e);
  }
}

// 獨立使用者帳號種子資料 (三層架構：1 位 Superadmin、若干位 Admin、User 各自對應群組)
export function seedUsers(db: Database) {
  try {
    db.run(`
      INSERT INTO users (id, employeeId, username, fullName, email, passwordHash, role, groupId, allowedCompanies, defaultCompanyId, status, dailyExportLimit, maxConcurrentSessions, delegateToId, isDeleted, version, createdAt, updatedAt)
      VALUES
        ('USR-01', 'EMP-001', 'admin', '黃副總經理 (最高稽核)', 'huang.vp@greatgiant.com.tw', '123456', 'SUPERADMIN', NULL, 'COMP-01,COMP-02', 'COMP-01', 'ACTIVE', 5000, 5, NULL, 0, 1, '2026-01-01', '2026-01-01'),
        ('USR-02', 'EMP-002', 'lin.admin', '林大為 系統主任', 'lin.admin@greatgiant.com.tw', '123456', 'ADMIN', NULL, 'COMP-01,COMP-02', 'COMP-01', 'ACTIVE', 5000, 5, NULL, 0, 1, '2026-01-01', '2026-01-01'),
        ('USR-03', 'EMP-003', 'chang.eng', '張添盛 工務主任', 'chang.eng@greatgiant.com.tw', '123456', 'USER', 'GRP-ENG', 'COMP-01', 'COMP-01', 'ACTIVE', 500, 2, NULL, 0, 1, '2026-02-01', '2026-02-01'),
        ('USR-04', 'EMP-004', 'chen.acc', '陳美玲 主辦會計', 'chen.acc@greatgiant.com.tw', '123456', 'USER', 'GRP-ACC', 'COMP-01,COMP-02', 'COMP-01', 'ACTIVE', 2000, 3, NULL, 0, 1, '2026-01-10', '2026-01-10'),
        ('USR-05', 'EMP-005', 'lee.buyer', '李文成 採購主管', 'lee.buyer@greatgiant.com.tw', '123456', 'USER', 'GRP-PROC', 'COMP-01', 'COMP-01', 'ACTIVE', 1000, 3, NULL, 0, 1, '2026-01-15', '2026-01-15'),
        ('USR-06', 'EMP-006', 'wang.pm', '王志豪 專案業務經理', 'wang.pm@greatgiant.com.tw', '123456', 'USER', 'GRP-SALES', 'COMP-01', 'COMP-01', 'ACTIVE', 1000, 3, NULL, 0, 1, '2026-01-10', '2026-01-10');
    `);
  } catch (e) {
    console.warn('seedUsers 略過或已存在:', e);
  }
}

// 自動檢測並修復資料庫結構與核心種子資料完整性 (平滑相容既有資料庫)
export function ensureDatabaseIntegrity(db: Database) {
  // 1. 確保所有資料表已存在 (CREATE TABLE IF NOT EXISTS)
  initializeTables(db);

  // 2. 檢測 user_groups 表
  try {
    const grpRes = db.exec("SELECT COUNT(*) FROM user_groups;");
    const count = (grpRes.length && grpRes[0].values.length) ? Number(grpRes[0].values[0][0]) : 0;
    if (count === 0) {
      seedUserGroups(db);
    }
  } catch {
    seedUserGroups(db);
  }

  // 3. 檢測 roles 表
  try {
    const rolesRes = db.exec("SELECT COUNT(*) FROM roles WHERE isDeleted = 0;");
    const count = (rolesRes.length && rolesRes[0].values.length) ? Number(rolesRes[0].values[0][0]) : 0;
    if (count === 0) {
      seedRoles(db);
    }
  } catch {
    seedRoles(db);
  }

  // 4. 檢測 users 表
  try {
    const usersRes = db.exec("SELECT COUNT(*) FROM users WHERE isDeleted = 0;");
    const count = (usersRes.length && usersRes[0].values.length) ? Number(usersRes[0].values[0][0]) : 0;
    if (count === 0) {
      seedUsers(db);
    } else {
      // 平滑遷移既有 users：確保有且僅有 1 位 SUPERADMIN，其他映射到對應群組
      try {
        db.run(`UPDATE users SET role = 'USER', groupId = 'GRP-ENG' WHERE role = 'ENGINEER';`);
        db.run(`UPDATE users SET role = 'USER', groupId = 'GRP-ACC' WHERE role = 'ACCOUNTANT';`);
        db.run(`UPDATE users SET role = 'USER', groupId = 'GRP-PROC' WHERE role = 'BUYER';`);
        db.run(`UPDATE users SET role = 'USER', groupId = 'GRP-SALES' WHERE role = 'PM';`);
        db.run(`UPDATE users SET role = 'ADMIN' WHERE role = 'EXECUTIVE';`);
        db.run(`UPDATE users SET role = 'SUPERADMIN', groupId = NULL WHERE id = 'USR-01' OR username = 'admin';`);
      } catch (_) {}
    }
  } catch {
    seedUsers(db);
  }

  // 5. 檢測 companies 表
  try {
    const compRes = db.exec("SELECT COUNT(*) FROM companies WHERE isDeleted = 0;");
    const count = (compRes.length && compRes[0].values.length) ? Number(compRes[0].values[0][0]) : 0;
    if (count === 0) {
      seedCompanies(db);
    }
  } catch {
    seedCompanies(db);
  }
}

// 建立營造工程真實範例資料
export function seedInitialData(db: Database) {
  // 確保結構完整
  initializeTables(db);

  // 清理現有資料
  const tables = [
    'companies', 'roles', 'group_module_permissions', 'user_groups', 'users', 'system_configs', 'audit_logs', 'projects', 'project_sites',
    'project_wbs', 'business_partners', 'items', 'quotations', 'quotation_revisions',
    'quotation_items', 'quotation_billing_milestones', 'purchase_orders',
    'purchase_order_items', 'subcontracts', 'valuations', 'valuation_items',
    'accounts_payable', 'accounts_receivable', 'bank_checks'
  ];
  tables.forEach(t => {
    try {
      db.run(`DELETE FROM ${t};`);
    } catch (_) {}
  });

  // 1. 公司法人
  seedCompanies(db);

  // 1.1 權限群組 (User Groups & Permissions Matrix)
  seedUserGroups(db);

  // 1.2 權限角色 (Roles)
  seedRoles(db);

  // 1.3 使用者帳號 (Users)
  seedUsers(db);

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

  // 9. 審計日誌
  db.run(`
    INSERT INTO audit_logs (id, userId, userName, action, targetTable, targetId, beforeJson, afterJson, ipAddress, createdAt)
    VALUES
      ('LOG-01', 'USR-01', '系統管理員 (黃副總)', 'POST', 'purchase_orders', 'PO-01', '{"status":"APPROVED"}', '{"status":"POSTED","counterpartyNameSnapshot":"台灣水泥股份有限公司 (台北營業所)"}', '192.168.1.100', '2026-03-01 10:15:00'),
      ('LOG-02', 'USR-02', '財務主管 (陳會計)', 'POST', 'valuations', 'VAL-01', '{"status":"SUBMITTED"}', '{"status":"POSTED","netPayableAmount":3550000}', '192.168.1.108', '2026-03-28 16:40:00');
  `);
}

// 產生完整 SQL DDL & INSERT Dump 文本
export function exportSqlDump(): string {
  if (!dbInstance) return '-- 資料庫尚未載入';
  const tables = [
    'companies', 'roles', 'users', 'system_configs', 'audit_logs', 'projects', 'project_sites',
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

// 讀取所有公司
export function getAllCompanies(): Company[] {
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT * FROM companies WHERE isDeleted = 0 ORDER BY companyCode;`);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    companyCode: String(v[1]),
    name: String(v[2]),
    taxId: String(v[3]),
    baseCurrency: String(v[4]),
    isDeleted: Boolean(v[5]),
    version: Number(v[6]),
    createdAt: String(v[7]),
    updatedAt: String(v[8]),
  }));
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

// 讀取審計日誌
export function getAllAuditLogs(): AuditLog[] {
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT 50;`);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    userId: String(v[1]),
    userName: String(v[2]),
    action: v[3] as AuditLog['action'],
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
  action: AuditLog['action'],
  targetTable: string,
  targetId: string,
  before?: object,
  after?: object
) {
  const id = `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const beforeJson = before ? JSON.stringify(before).replace(/'/g, "''") : null;
  const afterJson = after ? JSON.stringify(after).replace(/'/g, "''") : null;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  db.run(`
    INSERT INTO audit_logs (id, userId, userName, action, targetTable, targetId, beforeJson, afterJson, ipAddress, createdAt)
    VALUES ('${id}', 'USR-ACTIVE', '${userName}', '${action}', '${targetTable}', '${targetId}', 
      ${beforeJson ? `'${beforeJson}'` : 'NULL'}, ${afterJson ? `'${afterJson}'` : 'NULL'}, '127.0.0.1', '${now}');
  `);
}

// --------------------------------------------------------------------------
// 使用者與帳號權限管理 (Phase 1: Auth, Identity & PBAC)
// --------------------------------------------------------------------------

// 讀取所有使用者
export function getAllUsers(): User[] {
  if (!dbInstance) return [];
  try {
    const res = dbInstance.exec(`SELECT * FROM users WHERE isDeleted = 0 ORDER BY employeeId;`);
    if (!res.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      employeeId: String(v[1]),
      username: String(v[2]),
      fullName: String(v[3]),
      email: String(v[4]),
      role: v[6] as User['role'],
      allowedCompanies: String(v[7] || '').split(',').filter(Boolean),
      defaultCompanyId: String(v[8] || 'COMP-01'),
      status: v[9] as User['status'],
      dailyExportLimit: Number(v[10] || 1000),
      maxConcurrentSessions: Number(v[11] || 3),
      delegateToId: v[12] ? String(v[12]) : undefined,
// 讀取所有使用者 (包含所屬群組名稱)
export function getAllUsers(): User[] {
  if (!dbInstance) return [];
  const querySql = `
    SELECT 
      u.id, u.employeeId, u.username, u.fullName, u.email, u.passwordHash, 
      u.role, u.groupId, u.allowedCompanies, u.defaultCompanyId, u.status, 
      u.dailyExportLimit, u.maxConcurrentSessions, u.delegateToId, u.isDeleted, 
      u.version, u.createdAt, u.updatedAt, g.groupName
    FROM users u
    LEFT JOIN user_groups g ON u.groupId = g.id
    WHERE u.isDeleted = 0
    ORDER BY u.employeeId ASC;
  `;

  try {
    const res = dbInstance.exec(querySql);
    if (!res.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      employeeId: String(v[1]),
      username: String(v[2]),
      fullName: String(v[3]),
      email: String(v[4]),
      role: v[6] as UserRole,
      groupId: v[7] ? String(v[7]) : undefined,
      groupName: v[18] ? String(v[18]) : undefined,
      allowedCompanies: String(v[8] || '').split(',').filter(Boolean),
      defaultCompanyId: String(v[9] || 'COMP-01'),
      status: v[10] as User['status'],
      dailyExportLimit: Number(v[11] || 1000),
      maxConcurrentSessions: Number(v[12] || 3),
      delegateToId: v[13] ? String(v[13]) : undefined,
      isDeleted: Boolean(v[14]),
      version: Number(v[15]),
      createdAt: String(v[16]),
      updatedAt: String(v[17]),
    }));
  } catch (err) {
    console.warn('⚠️ getAllUsers 發生異常，啟動資料庫完整性修復:', err);
    try {
      ensureDatabaseIntegrity(dbInstance);
      saveDatabaseSnapshot();
      const res = dbInstance.exec(querySql);
      if (!res.length) return [];
      return res[0].values.map(v => ({
        id: String(v[0]),
        employeeId: String(v[1]),
        username: String(v[2]),
        fullName: String(v[3]),
        email: String(v[4]),
        role: v[6] as UserRole,
        groupId: v[7] ? String(v[7]) : undefined,
        groupName: v[18] ? String(v[18]) : undefined,
        allowedCompanies: String(v[8] || '').split(',').filter(Boolean),
        defaultCompanyId: String(v[9] || 'COMP-01'),
        status: v[10] as User['status'],
        dailyExportLimit: Number(v[11] || 1000),
        maxConcurrentSessions: Number(v[12] || 3),
        delegateToId: v[13] ? String(v[13]) : undefined,
        isDeleted: Boolean(v[14]),
        version: Number(v[15]),
        createdAt: String(v[16]),
        updatedAt: String(v[17]),
      }));
    } catch (retryErr) {
      console.error('users 表自動修復失敗:', retryErr);
      return [];
    }
  }
}

// --------------------------------------------------------------------------
// 使用者權限群組 (User Groups & Module PBAC Permissions)
// --------------------------------------------------------------------------

// 讀取所有群組與其模組權限矩陣
export function getAllUserGroups(): UserGroup[] {
  if (!dbInstance) return [];
  try {
    const res = dbInstance.exec(`
      SELECT id, groupCode, groupName, description, isSystem, approvalLimit, canExportData, createdAt, updatedAt
      FROM user_groups
      ORDER BY isSystem DESC, createdAt ASC;
    `);
    if (!res.length) return [];

    // 取得所有群組的成員人數
    const memberCounts: Record<string, number> = {};
    try {
      const countsRes = dbInstance.exec(`
        SELECT groupId, COUNT(*) FROM users WHERE isDeleted = 0 AND groupId IS NOT NULL GROUP BY groupId;
      `);
      if (countsRes.length) {
        countsRes[0].values.forEach(row => {
          memberCounts[String(row[0])] = Number(row[1]);
        });
      }
    } catch (_) {}

    // 取得所有群組之細部權限
    const permissionsByGroup: Record<string, Record<string, { canRead: boolean; canWrite: boolean; canApprove: boolean; canExport: boolean }>> = {};
    try {
      const permRes = dbInstance.exec(`SELECT groupId, moduleKey, canRead, canWrite, canApprove, canExport FROM group_module_permissions;`);
      if (permRes.length) {
        permRes[0].values.forEach(row => {
          const gid = String(row[0]);
          const mod = String(row[1]);
          if (!permissionsByGroup[gid]) permissionsByGroup[gid] = {};
          permissionsByGroup[gid][mod] = {
            canRead: Boolean(row[2]),
            canWrite: Boolean(row[3]),
            canApprove: Boolean(row[4]),
            canExport: Boolean(row[5]),
          };
        });
      }
    } catch (_) {}

    return res[0].values.map(v => {
      const id = String(v[0]);
      const groupPermMap = permissionsByGroup[id] || {};

      // 組合 12 大模組完整清單 (確保不存在時填入預設 false)
      const permissions: ModulePermissionItem[] = ERP_MODULES.map(m => {
        const existing = groupPermMap[m.key];
        return {
          moduleKey: m.key,
          moduleName: m.name,
          category: m.category,
          canRead: existing ? existing.canRead : false,
          canWrite: existing ? existing.canWrite : false,
          canApprove: existing ? existing.canApprove : false,
          canExport: existing ? existing.canExport : false,
        };
      });

      return {
        id,
        groupCode: String(v[1]),
        groupName: String(v[2]),
        description: String(v[3] || ''),
        isSystem: Boolean(v[4]),
        approvalLimit: Number(v[5] || 0),
        canExportData: Boolean(v[6]),
        permissions,
        memberCount: memberCounts[id] || 0,
        createdAt: String(v[7]),
        updatedAt: String(v[8]),
      };
    });
  } catch (err) {
    console.warn('getAllUserGroups 異常，自動重建群組:', err);
    if (dbInstance) {
      ensureDatabaseIntegrity(dbInstance);
      saveDatabaseSnapshot();
    }
    return [];
  }
}

// 建立新自訂群組
export function createUserGroup(
  group: {
    groupCode: string;
    groupName: string;
    description: string;
    approvalLimit: number;
    canExportData: boolean;
    permissions?: ModulePermissionItem[];
  },
  operator: string
): UserGroup {
  if (!dbInstance) throw new Error('資料庫未就緒');
  const id = `GRP-${Date.now().toString().slice(-4)}`;
  const now = new Date().toISOString().substring(0, 10);
  const code = group.groupCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '') || `GRP_${Date.now().toString().slice(-4)}`;

  dbInstance.run(`
    INSERT INTO user_groups (id, groupCode, groupName, description, isSystem, approvalLimit, canExportData, createdAt, updatedAt)
    VALUES ('${id}', '${code}', '${group.groupName.replace(/'/g, "''")}', '${group.description.replace(/'/g, "''")}', 0, ${group.approvalLimit}, ${group.canExportData ? 1 : 0}, '${now}', '${now}');
  `);

  // 初始化該群組的 12 模組權限
  const permsToInsert = group.permissions && group.permissions.length === ERP_MODULES.length
    ? group.permissions
    : ERP_MODULES.map(m => ({
        moduleKey: m.key,
        moduleName: m.name,
        category: m.category,
        canRead: false,
        canWrite: false,
        canApprove: false,
        canExport: false,
      }));

  for (const p of permsToInsert) {
    const pid = `PERM-${id}-${p.moduleKey}`;
    dbInstance.run(`
      INSERT INTO group_module_permissions (id, groupId, moduleKey, canRead, canWrite, canApprove, canExport)
      VALUES ('${pid}', '${id}', '${p.moduleKey}', ${p.canRead ? 1 : 0}, ${p.canWrite ? 1 : 0}, ${p.canApprove ? 1 : 0}, ${p.canExport ? 1 : 0});
    `);
  }

  logAudit(dbInstance, operator, 'CREATE', 'user_groups', id, undefined, { groupName: group.groupName, groupCode: code });
  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    groupCode: code,
    groupName: group.groupName,
    description: group.description,
    isSystem: false,
    approvalLimit: group.approvalLimit,
    canExportData: group.canExportData,
    permissions: permsToInsert,
    memberCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

// 更新群組基本資訊
export function updateUserGroup(
  id: string,
  updates: Partial<UserGroup>,
  operator: string
) {
  if (!dbInstance) throw new Error('資料庫未就緒');
  const now = new Date().toISOString().substring(0, 10);
  const setClauses: string[] = [`updatedAt = '${now}'`];

  if (updates.groupName) setClauses.push(`groupName = '${updates.groupName.replace(/'/g, "''")}'`);
  if (updates.description !== undefined) setClauses.push(`description = '${updates.description.replace(/'/g, "''")}'`);
  if (updates.approvalLimit !== undefined) setClauses.push(`approvalLimit = ${updates.approvalLimit}`);
  if (updates.canExportData !== undefined) setClauses.push(`canExportData = ${updates.canExportData ? 1 : 0}`);

  dbInstance.run(`UPDATE user_groups SET ${setClauses.join(', ')} WHERE id = '${id}';`);
  logAudit(dbInstance, operator, 'UPDATE', 'user_groups', id, undefined, updates);
  saveDatabaseSnapshot();
  notifyListeners();
}

// 批次更新群組之 12 大模組權限矩陣
export function updateGroupModulePermissions(
  groupId: string,
  permissions: ModulePermissionItem[],
  operator: string
) {
  if (!dbInstance) throw new Error('資料庫未就緒');
  const now = new Date().toISOString().substring(0, 10);

  for (const p of permissions) {
    const pid = `PERM-${groupId}-${p.moduleKey}`;
    dbInstance.run(`
      INSERT INTO group_module_permissions (id, groupId, moduleKey, canRead, canWrite, canApprove, canExport)
      VALUES ('${pid}', '${groupId}', '${p.moduleKey}', ${p.canRead ? 1 : 0}, ${p.canWrite ? 1 : 0}, ${p.canApprove ? 1 : 0}, ${p.canExport ? 1 : 0})
      ON CONFLICT(groupId, moduleKey) DO UPDATE SET
        canRead = ${p.canRead ? 1 : 0},
        canWrite = ${p.canWrite ? 1 : 0},
        canApprove = ${p.canApprove ? 1 : 0},
        canExport = ${p.canExport ? 1 : 0};
    `);
  }

  dbInstance.run(`UPDATE user_groups SET updatedAt = '${now}' WHERE id = '${groupId}';`);
  logAudit(dbInstance, operator, 'UPDATE', 'group_module_permissions', groupId, undefined, { updatedModulesCount: permissions.length });
  saveDatabaseSnapshot();
  notifyListeners();
}

// 刪除自訂群組 (系統內建群組防刪保護、包含成員之群組防刪保護)
export function deleteUserGroup(id: string, operator: string) {
  if (!dbInstance) throw new Error('資料庫未就緒');

  // 1. 檢查是否為系統群組
  const grpRes = dbInstance.exec(`SELECT groupName, isSystem FROM user_groups WHERE id = '${id}';`);
  if (!grpRes.length || !grpRes[0].values.length) throw new Error('找不到該權限群組');
  if (Boolean(grpRes[0].values[0][1])) {
    throw new Error('系統預設核心業務群組（工務、財務、採購、業務）受憲法保護，禁止刪除！');
  }

  // 2. 檢查群組內是否仍有成員
  const countRes = dbInstance.exec(`SELECT COUNT(*) FROM users WHERE groupId = '${id}' AND isDeleted = 0;`);
  const memberCount = countRes.length && countRes[0].values.length ? Number(countRes[0].values[0][0]) : 0;
  if (memberCount > 0) {
    throw new Error(`該群組目前仍有 ${memberCount} 位成員，請先將成員移至其他群組後再刪除。`);
  }

  dbInstance.run(`DELETE FROM group_module_permissions WHERE groupId = '${id}';`);
  dbInstance.run(`DELETE FROM user_groups WHERE id = '${id}';`);

  logAudit(dbInstance, operator, 'DELETE', 'user_groups', id);
  saveDatabaseSnapshot();
  notifyListeners();
}

// 轉移唯一最高 Superadmin 權限 (確保系統永遠恰好有且僅有一位 Superadmin)
export function transferSuperadmin(currentSuperadminId: string, targetUserId: string, operator: string) {
  if (!dbInstance) throw new Error('資料庫未就緒');
  if (currentSuperadminId === targetUserId) return;

  const now = new Date().toISOString().substring(0, 10);
  // 將目標使用者升為 SUPERADMIN，並將原 Superadmin 降為一般 ADMIN
  dbInstance.run(`UPDATE users SET role = 'SUPERADMIN', groupId = NULL, updatedAt = '${now}', version = version + 1 WHERE id = '${targetUserId}';`);
  dbInstance.run(`UPDATE users SET role = 'ADMIN', groupId = NULL, updatedAt = '${now}', version = version + 1 WHERE id = '${currentSuperadminId}';`);

  logAudit(dbInstance, operator, 'UPDATE', 'users', targetUserId, { role: 'USER' }, { role: 'SUPERADMIN', note: '最高權限交接移轉' });
  saveDatabaseSnapshot();
  notifyListeners();
}

// 取得同仁實質有效權限 (PBAC 合成結果)
export function getUserEffectivePermissions(user: User | null): {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  canManageUsers: boolean;
  approvalLimit: number;
  canExportData: boolean;
  modules: Record<ErpModuleKey, { canRead: boolean; canWrite: boolean; canApprove: boolean; canExport: boolean }>;
} {
  const defaultModules = ERP_MODULES.reduce((acc, m) => {
    acc[m.key] = { canRead: false, canWrite: false, canApprove: false, canExport: false };
    return acc;
  }, {} as Record<ErpModuleKey, { canRead: boolean; canWrite: boolean; canApprove: boolean; canExport: boolean }>);

  if (!user || user.status !== 'ACTIVE') {
    return {
      isSuperAdmin: false,
      isAdmin: false,
      canManageUsers: false,
      approvalLimit: 0,
      canExportData: false,
      modules: defaultModules,
    };
  }

  // 1. Superadmin: 上帝視角，全開
  if (user.role === 'SUPERADMIN') {
    const fullModules = ERP_MODULES.reduce((acc, m) => {
      acc[m.key] = { canRead: true, canWrite: true, canApprove: true, canExport: true };
      return acc;
    }, {} as Record<ErpModuleKey, { canRead: boolean; canWrite: boolean; canApprove: boolean; canExport: boolean }>);

    return {
      isSuperAdmin: true,
      isAdmin: true,
      canManageUsers: true,
      approvalLimit: 999999999,
      canExportData: true,
      modules: fullModules,
    };
  }

  // 2. Admin: 管理員，具備使用者與所有業務模組讀寫核准，但不可變更 Superadmin
  if (user.role === 'ADMIN') {
    const adminModules = ERP_MODULES.reduce((acc, m) => {
      acc[m.key] = { canRead: true, canWrite: true, canApprove: true, canExport: true };
      return acc;
    }, {} as Record<ErpModuleKey, { canRead: boolean; canWrite: boolean; canApprove: boolean; canExport: boolean }>);

    return {
      isSuperAdmin: false,
      isAdmin: true,
      canManageUsers: true,
      approvalLimit: 50000000,
      canExportData: true,
      modules: adminModules,
    };
  }

  // 3. 一般 User: 依指派群組動態解析
  if (user.groupId && dbInstance) {
    try {
      const grpRes = dbInstance.exec(`SELECT approvalLimit, canExportData FROM user_groups WHERE id = '${user.groupId}';`);
      const approvalLimit = grpRes.length && grpRes[0].values.length ? Number(grpRes[0].values[0][0]) : 0;
      const canExportData = grpRes.length && grpRes[0].values.length ? Boolean(grpRes[0].values[0][1]) : false;

      const permRes = dbInstance.exec(`SELECT moduleKey, canRead, canWrite, canApprove, canExport FROM group_module_permissions WHERE groupId = '${user.groupId}';`);
      if (permRes.length) {
        permRes[0].values.forEach(row => {
          const mod = String(row[0]) as ErpModuleKey;
          if (defaultModules[mod]) {
            defaultModules[mod] = {
              canRead: Boolean(row[1]),
              canWrite: Boolean(row[2]),
              canApprove: Boolean(row[3]),
              canExport: Boolean(row[4]),
            };
          }
        });
      }

      return {
        isSuperAdmin: false,
        isAdmin: false,
        canManageUsers: false,
        approvalLimit,
        canExportData,
        modules: defaultModules,
      };
    } catch (_) {}
  }

  return {
    isSuperAdmin: false,
    isAdmin: false,
    canManageUsers: false,
    approvalLimit: 0,
    canExportData: false,
    modules: defaultModules,
  };
}

// 讀取所有角色與權限矩陣 (相容保留)
export function getAllRoles(): Role[] {
  if (!dbInstance) return [];
  try {
    const res = dbInstance.exec(`SELECT * FROM roles WHERE isDeleted = 0 ORDER BY id;`);
    if (!res.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      roleCode: String(v[1]),
      roleName: String(v[2]),
      description: String(v[3] || ''),
      canReadOwn: Boolean(v[4]),
      canReadAll: Boolean(v[5]),
      canWrite: Boolean(v[6]),
      canApprove: Boolean(v[7]),
      approvalLimit: Number(v[8] || 0),
      canExportData: Boolean(v[9]),
      canVoidCheck: Boolean(v[10]),
      canManageUsers: Boolean(v[11]),
    }));
  } catch (err) {
    console.warn('getAllRoles 異常，自動修復:', err);
    return [];
  }
}

// 驗證登入
export function verifyLogin(usernameOrEmail: string, passwordPlain: string): User | null {
  if (!dbInstance) return null;
  const sanitized = usernameOrEmail.trim().replace(/'/g, "''");
  const res = dbInstance.exec(`
    SELECT 
      u.id, u.employeeId, u.username, u.fullName, u.email, u.passwordHash, 
      u.role, u.groupId, u.allowedCompanies, u.defaultCompanyId, u.status, 
      u.dailyExportLimit, u.maxConcurrentSessions, u.delegateToId, u.isDeleted, 
      u.version, u.createdAt, u.updatedAt, g.groupName
    FROM users u
    LEFT JOIN user_groups g ON u.groupId = g.id
    WHERE (u.username = '${sanitized}' OR u.email = '${sanitized}')
      AND u.isDeleted = 0
    LIMIT 1;
  `);
  if (!res.length || !res[0].values.length) return null;
  const row = res[0].values[0];
  const dbPassword = String(row[5]);
  // 示範環境密碼比對 (支援任意密碼或預設密碼 123456 / admin123)
  if (passwordPlain && passwordPlain !== dbPassword && passwordPlain !== '123456') {
    return null;
  }
  return {
    id: String(row[0]),
    employeeId: String(row[1]),
    username: String(row[2]),
    fullName: String(row[3]),
    email: String(row[4]),
    role: row[6] as UserRole,
    groupId: row[7] ? String(row[7]) : undefined,
    groupName: row[18] ? String(row[18]) : undefined,
    allowedCompanies: String(row[8] || '').split(',').filter(Boolean),
    defaultCompanyId: String(row[9] || 'COMP-01'),
    status: row[10] as User['status'],
    dailyExportLimit: Number(row[11] || 1000),
    maxConcurrentSessions: Number(row[12] || 3),
    delegateToId: row[13] ? String(row[13]) : undefined,
    isDeleted: Boolean(row[14]),
    version: Number(row[15]),
    createdAt: String(row[16]),
    updatedAt: String(row[17]),
  };
}

// 建立使用者
export function createUser(
  user: {
    employeeId: string;
    username: string;
    fullName: string;
    email: string;
    passwordPlain?: string;
    role: UserRole;
    groupId?: string;
    allowedCompanies: string[];
    defaultCompanyId: string;
    status: User['status'];
    dailyExportLimit: number;
    delegateToId?: string;
  },
  operator: string
): User {
  if (!dbInstance) throw new Error('資料庫未就緒');

  // 防呆：Superadmin 只能有一位，不可透過一般介面新建第二位 Superadmin
  if (user.role === 'SUPERADMIN') {
    throw new Error('系統唯一最高 Superadmin 僅限 1 位，無法額外新建！若欲更換請使用「最高權限交接」功能。');
  }

  const id = `USR-${Date.now().toString().slice(-4)}`;
  const now = new Date().toISOString().substring(0, 10);
  const password = user.passwordPlain || '123456';
  const companiesStr = user.allowedCompanies.join(',');
  const groupIdVal = user.role === 'USER' && user.groupId ? `'${user.groupId}'` : 'NULL';

  dbInstance.run(`
    INSERT INTO users (id, employeeId, username, fullName, email, passwordHash, role, groupId, allowedCompanies, defaultCompanyId, status, dailyExportLimit, maxConcurrentSessions, delegateToId, isDeleted, version, createdAt, updatedAt)
    VALUES ('${id}', '${user.employeeId}', '${user.username.replace(/'/g, "''")}', '${user.fullName.replace(/'/g, "''")}', '${user.email.replace(/'/g, "''")}', '${password}', '${user.role}', ${groupIdVal}, '${companiesStr}', '${user.defaultCompanyId}', '${user.status}', ${user.dailyExportLimit}, 3, ${user.delegateToId ? `'${user.delegateToId}'` : 'NULL'}, 0, 1, '${now}', '${now}');
  `);

  logAudit(dbInstance, operator, 'CREATE', 'users', id, undefined, { username: user.username, role: user.role, groupId: user.groupId });
  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    employeeId: user.employeeId,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    groupId: user.role === 'USER' ? user.groupId : undefined,
    allowedCompanies: user.allowedCompanies,
    defaultCompanyId: user.defaultCompanyId,
    status: user.status,
    dailyExportLimit: user.dailyExportLimit,
    maxConcurrentSessions: 3,
    delegateToId: user.delegateToId,
    isDeleted: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

// 更新使用者
export function updateUser(
  id: string,
  updates: Partial<User> & { passwordPlain?: string },
  operator: string
) {
  if (!dbInstance) throw new Error('資料庫未就緒');

  // 取得目標原資料進行 Superadmin 防呆保護
  const targetRes = dbInstance.exec(`SELECT role, username FROM users WHERE id = '${id}';`);
  if (!targetRes.length || !targetRes[0].values.length) throw new Error('找不到該使用者');
  const currentRole = String(targetRes[0].values[0][0]);

  if (currentRole === 'SUPERADMIN') {
    if (updates.role && updates.role !== 'SUPERADMIN') {
      throw new Error('最高 Superadmin 不可被降級！若欲移交最高權限請點選「轉移 Superadmin」按鈕。');
    }
    if (updates.status && updates.status !== 'ACTIVE') {
      throw new Error('最高 Superadmin 不可被停用或離職！');
    }
  }

  // 防呆：不可將一般帳號直接升為 SUPERADMIN
  if (currentRole !== 'SUPERADMIN' && updates.role === 'SUPERADMIN') {
    throw new Error('系統只允許存在 1 位 Superadmin，請使用最高權限轉移功能。');
  }

  const now = new Date().toISOString().substring(0, 10);
  const setClauses: string[] = [`updatedAt = '${now}'`, `version = version + 1`];

  if (updates.employeeId) setClauses.push(`employeeId = '${updates.employeeId.replace(/'/g, "''")}'`);
  if (updates.username) setClauses.push(`username = '${updates.username.replace(/'/g, "''")}'`);
  if (updates.fullName) setClauses.push(`fullName = '${updates.fullName.replace(/'/g, "''")}'`);
  if (updates.email) setClauses.push(`email = '${updates.email.replace(/'/g, "''")}'`);
  if (updates.role) setClauses.push(`role = '${updates.role}'`);
  if (updates.role === 'ADMIN' || updates.role === 'SUPERADMIN') {
    setClauses.push(`groupId = NULL`);
  } else if (updates.groupId !== undefined) {
    setClauses.push(`groupId = ${updates.groupId ? `'${updates.groupId}'` : 'NULL'}`);
  }
  if (updates.status) setClauses.push(`status = '${updates.status}'`);
  if (updates.dailyExportLimit !== undefined) setClauses.push(`dailyExportLimit = ${updates.dailyExportLimit}`);
  if (updates.passwordPlain) setClauses.push(`passwordHash = '${updates.passwordPlain.replace(/'/g, "''")}'`);
  if (updates.allowedCompanies) setClauses.push(`allowedCompanies = '${updates.allowedCompanies.join(',')}'`);
  if (updates.defaultCompanyId) setClauses.push(`defaultCompanyId = '${updates.defaultCompanyId}'`);
  if (updates.delegateToId !== undefined) {
    setClauses.push(`delegateToId = ${updates.delegateToId ? `'${updates.delegateToId}'` : 'NULL'}`);
  }

  dbInstance.run(`UPDATE users SET ${setClauses.join(', ')} WHERE id = '${id}';`);
  logAudit(dbInstance, operator, 'UPDATE', 'users', id, undefined, updates);
  saveDatabaseSnapshot();
  notifyListeners();
}

// 軟刪除使用者 (Superadmin 絕對防刪)
export function deleteUser(id: string, operator: string) {
  if (!dbInstance) throw new Error('資料庫未就緒');

  const checkRes = dbInstance.exec(`SELECT role, username FROM users WHERE id = '${id}';`);
  if (checkRes.length && checkRes[0].values.length) {
    const role = String(checkRes[0].values[0][0]);
    if (role === 'SUPERADMIN') {
      throw new Error('系統唯一最高 Superadmin 受核心憲法絕對保護，嚴禁刪除！');
    }
  }

  dbInstance.run(`UPDATE users SET isDeleted = 1, version = version + 1 WHERE id = '${id}';`);
  logAudit(dbInstance, operator, 'DELETE', 'users', id);
  saveDatabaseSnapshot();
  notifyListeners();
}

// 更新角色權限 (相容保留)
export function updateRole(id: string, updates: Partial<Role>, operator: string) {
  if (!dbInstance) throw new Error('資料庫未就緒');
  const setClauses: string[] = [`version = version + 1`];
  if (updates.canReadOwn !== undefined) setClauses.push(`canReadOwn = ${updates.canReadOwn ? 1 : 0}`);
  if (updates.canReadAll !== undefined) setClauses.push(`canReadAll = ${updates.canReadAll ? 1 : 0}`);
  if (updates.canWrite !== undefined) setClauses.push(`canWrite = ${updates.canWrite ? 1 : 0}`);
  if (updates.canApprove !== undefined) setClauses.push(`canApprove = ${updates.canApprove ? 1 : 0}`);
  if (updates.approvalLimit !== undefined) setClauses.push(`approvalLimit = ${updates.approvalLimit}`);
  if (updates.canExportData !== undefined) setClauses.push(`canExportData = ${updates.canExportData ? 1 : 0}`);
  if (updates.canVoidCheck !== undefined) setClauses.push(`canVoidCheck = ${updates.canVoidCheck ? 1 : 0}`);
  if (updates.canManageUsers !== undefined) setClauses.push(`canManageUsers = ${updates.canManageUsers ? 1 : 0}`);

  dbInstance.run(`UPDATE roles SET ${setClauses.join(', ')} WHERE id = '${id}';`);
  logAudit(dbInstance, operator, 'UPDATE', 'roles', id, undefined, updates);
  saveDatabaseSnapshot();
  notifyListeners();
}
