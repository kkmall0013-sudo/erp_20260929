import type { Database } from 'sql.js';
import type {
  BuildingCategoryGroup,
  DocumentSequenceRule,
  ModuleKey,
  SubcontractorCategoryGroup
} from '../../types/erp';

// ============================================================================
// 🏗️ 建造物與業務項目階層分類字典 (大項 -> 小項) 預設常數
// ============================================================================
export const DEFAULT_BUILDING_CATEGORY_TREE: BuildingCategoryGroup[] = [
  {
    id: 'GRP-BLD',
    name: '建物類',
    sortOrder: 1,
    items: [
      { id: 'ITM-01', name: '鐵皮倉庫', isActive: true, sortOrder: 1 },
      { id: 'ITM-02', name: '鋼構建築', isActive: true, sortOrder: 2 },
      { id: 'ITM-03', name: '農業設施', isActive: true, sortOrder: 3 },
      { id: 'ITM-04', name: '風雨球場', isActive: true, sortOrder: 4 },
    ]
  },
  {
    id: 'GRP-OTH',
    name: '其他',
    sortOrder: 2,
    items: [
      { id: 'ITM-05', name: '鋼梯', isActive: true, sortOrder: 1 },
      { id: 'ITM-06', name: '屋頂浪板', isActive: true, sortOrder: 2 },
    ]
  }
];

// ============================================================================
// 🏗️ 協力廠商二階段階層分類字典預設常數
// ============================================================================
export const DEFAULT_SUBCONTRACTOR_CATEGORY_TREE: SubcontractorCategoryGroup[] = [
  { id: 'CAT-STEEL', category: '鋼材', vendors: [] },
  { id: 'CAT-SHEET', category: '屋頂浪板', vendors: [] },
  { id: 'CAT-HARDWARE', category: '螺絲五金', vendors: [] },
  { id: 'CAT-CONCRETE', category: '混凝土', vendors: [] },
  { id: 'CAT-DRAWING', category: '拆圖', vendors: [] },
  { id: 'CAT-STRUCTURE', category: '鋼構吊裝', vendors: [] },
  { id: 'CAT-WINDOWS', category: '門窗五金', vendors: [] },
  { id: 'CAT-MEP', category: '機電消防', vendors: [] },
  { id: 'CAT-MASONRY', category: '泥作裝修', vendors: [] },
  { id: 'CAT-OTH', category: '其他協力', vendors: [] }
];

// ============================================================================
// 🔢 單據流水號編碼規則預設常數
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
export function seedUserPermissionData(db: Database): void {
  const existing = db.exec(`SELECT count(*) FROM user_groups;`);
  if (existing.length && Number(existing[0].values[0][0]) > 0) return;

  db.run(`
    INSERT INTO user_groups (id, groupCode, groupName, description, isSystem, approvalLimit, canExport, createdAt, updatedAt)
    VALUES
      ('GRP-ENG', 'SITE_ENG', '工務組', '案場施工日誌填報、工區料件點收、估驗草稿編製、施工進度維護', 1, 0, 0, '2026-01-01', '2026-01-01'),
      ('GRP-ACC', 'FIN_ACC', '財務會計組', '應收應付憑單拆單、支票開立/兌現、發票稅額勾稽、資金水池預測', 1, 10000000, 1, '2026-01-01', '2026-01-01'),
      ('GRP-PROC', 'PROC_SRC', '採購發包組', '材料供應商管理、採購單 PO 開立、原物料詢價與預付款沖銷', 1, 3000000, 1, '2026-01-01', '2026-01-01'),
      ('GRP-SALES', 'PROJ_SALES', '專案業務組', '業主報價單 REV-A/B 維護、工程 WBS 預算節點控管、合約里程碑請款', 1, 5000000, 1, '2026-01-01', '2026-01-01');
  `);

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
      ('USR-007', 'matrix_zhao', '趙專員', 'zhao.matrix@mega-build.com.tw', 'USER', 0, 0, 0, 0, 'GRP-ACC', '["GRP-ACC","GRP-PROC"]', '[{"companyId":"COMP-01","groupIds":["GRP-ACC"]},{"companyId":"COMP-02","groupIds":["GRP-PROC"]}]', 'ACTIVE', '跨法人調度專員 (大巨財務 / 宏達採購)', '["COMP-01","COMP-02"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01'),
      ('USR-ACC-A', 'acc_a', 'A會計', 'acc.a@mega-build.com.tw', 'USER', 0, 0, 0, 0, 'GRP-PURE-ACC', '["GRP-PURE-ACC"]', '[]', 'ACTIVE', '專職會計（僅管帳：對帳／發票／退回重算）', '["COMP-01","COMP-02"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01'),
      ('USR-CASHIER-B', 'cashier_b', 'B出納', 'cashier.b@mega-build.com.tw', 'USER', 0, 0, 0, 0, 'GRP-CASHIER', '["GRP-CASHIER"]', '[]', 'ACTIVE', '專職出納（僅管錢：放款／支票／退回重算）', '["COMP-01","COMP-02"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01'),
      ('USR-FIN-C', 'fin_c', 'C會計出納', 'fin.c@mega-build.com.tw', 'USER', 0, 0, 0, 0, 'GRP-ACC', '["GRP-ACC"]', '[]', 'ACTIVE', '會計兼出納（一人兼任全流程：對帳＋立即放款）', '["COMP-01","COMP-02"]', 'COMP-01', '888888', 0, '2026-01-01', '2026-01-01');
  `);
}
