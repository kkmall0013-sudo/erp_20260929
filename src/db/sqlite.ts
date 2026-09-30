// SQLite 本地資料庫引擎與資料持久層 (相容 WebAssembly sql.js 與全域 SQL 匯出/匯入)
import type { Database, SqlJsStatic } from 'sql.js';
import {
  Company,
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
      console.log('✅ 成功從本機快照還原 SQLite 資料庫');
      return dbInstance;
    } catch (e) {
      console.warn('⚠️ 舊快照載入失敗，將重新建置全新資料庫', e);
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
}

// 建立營造工程真實範例資料
export function seedInitialData(db: Database) {
  // 清理現有資料
  const tables = [
    'companies', 'system_configs', 'audit_logs', 'projects', 'project_sites',
    'project_wbs', 'business_partners', 'items', 'quotations', 'quotation_revisions',
    'quotation_items', 'quotation_billing_milestones', 'purchase_orders',
    'purchase_order_items', 'subcontracts', 'valuations', 'valuation_items',
    'accounts_payable', 'accounts_receivable', 'bank_checks'
  ];
  tables.forEach(t => db.run(`DELETE FROM ${t};`));

  // 1. 公司法人
  db.run(`
    INSERT INTO companies (id, companyCode, name, taxId, baseCurrency, isDeleted, version, createdAt, updatedAt)
    VALUES 
      ('COMP-01', 'CMP-TW01', '台灣大巨營造工程股份有限公司', '88991234', 'TWD', 0, 1, '2026-01-01', '2026-01-01'),
      ('COMP-02', 'CMP-TW02', '宏達機電工程股份有限公司', '54329876', 'TWD', 0, 1, '2026-01-01', '2026-01-01');
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
    'companies', 'system_configs', 'audit_logs', 'projects', 'project_sites',
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
