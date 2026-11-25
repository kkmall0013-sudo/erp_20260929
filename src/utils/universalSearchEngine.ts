import {
  AccountsPayableReconciliation,
  AccountReceivable,
  BankCheck,
  BusinessPartner,
  Company,
  CompanyBankAccount,
  InboundReceipt,
  Invoice,
  ModuleKey,
  PaymentRecord,
  Project,
  ProjectSite,
  User
} from '../types/erp';
import { matchesTaiwanRegion } from './taiwanPostalCodes';

export type SearchDatasetKey =
  | 'PARTNERS'
  | 'PROJECTS'
  | 'INBOUND_RECEIPTS'
  | 'FINANCE_LEDGER'
  | 'TAX_401_INVOICES';

export type SearchFieldDataType =
  | 'TEXT'
  | 'REGION'
  | 'SELECT'
  | 'NUMBER'
  | 'DATE'
  | 'BOOLEAN';

export type SearchFieldSensitivity =
  | 'PUBLIC'
  | 'COMMERCIAL_AMOUNT'
  | 'FINANCE_PRIVATE'
  | 'TAX_401';

export type SearchOperator =
  | 'CONTAINS'
  | 'EQUALS'
  | 'REGION_ALIAS'
  | 'IN'
  | 'BETWEEN'
  | 'DATE_RANGE'
  | 'IS_TRUE'
  | 'IS_FALSE';

export interface SearchPermissionContext {
  user: User | null;
  activeCompanyId?: string;
  isSuperadmin: boolean;
  isBoss: boolean;
  isAdmin: boolean;
  can: (
    moduleKey: ModuleKey,
    action: 'read' | 'write' | 'approve' | 'export',
    targetCompanyId?: string
  ) => boolean;
  canSeeBossPrivate: boolean;
  canSee401TaxData: boolean;
  canSeeFull401SelfRetained: boolean;
  canSeeCommercialAmounts: boolean;
  allowedCompanyIds: string[] | 'ALL';
}

export interface SearchFieldOption {
  value: string;
  label: string;
}

export interface SearchFieldDescriptor<T = any> {
  key: string;
  label: string;
  dataType: SearchFieldDataType;
  sensitivity: SearchFieldSensitivity;
  placeholder?: string;
  options?: SearchFieldOption[];
  /** 若回傳 false，代表當前登入身分無權限搜尋或檢視此欄位 */
  allowFn?: (ctx: SearchPermissionContext) => boolean;
  blockedReason?: string;
  /** 支援回傳單值或陣列（如多地址、多工種、明細品項） */
  extract: (row: T, lookup: SearchDatasetLookup) => string | string[] | number | boolean | null | undefined;
  formatDisplay?: (row: T, lookup: SearchDatasetLookup) => string;
}

export interface SearchDatasetLookup {
  companiesById: Map<string, Company>;
  sitesByProjectId: Map<string, ProjectSite>;
  partnersById: Map<string, BusinessPartner>;
  bankAccountsById: Map<string, CompanyBankAccount>;
}

export interface SearchDatasetSchema<T = any> {
  key: SearchDatasetKey;
  label: string;
  subtitle: string;
  primaryModule: ModuleKey;
  /** 檢查當前身分是否具備進入此搜尋對象的基礎權限 */
  canAccessDataset: (ctx: SearchPermissionContext) => { allowed: boolean; reason?: string };
  /** 在進入欄位篩選前，強制先依法人範圍／私帳／401機密濾除無權限資料列 */
  filterAuthorizedRecords: (rows: T[], ctx: SearchPermissionContext, lookup: SearchDatasetLookup) => T[];
  getRowId: (row: T) => string;
  getRowTitle: (row: T, lookup: SearchDatasetLookup) => string;
  getRowSubtitle: (row: T, lookup: SearchDatasetLookup) => string;
  getCompanyLabel: (row: T, lookup: SearchDatasetLookup) => string;
  fields: SearchFieldDescriptor<T>[];
}

export interface SearchCondition {
  id: string;
  fieldKey: string;
  operator: SearchOperator;
  value: any;
}

export interface SearchFilterLayer {
  id: string;
  label: string;
  combinator: 'AND' | 'OR';
  keyword: string;
  conditions: SearchCondition[];
}

export interface BlockedFieldNotice {
  key: string;
  label: string;
  sensitivity: SearchFieldSensitivity;
  reason: string;
}

export interface FilterLayerSnapshot {
  layerId: string;
  label: string;
  beforeCount: number;
  afterCount: number;
  droppedUnauthorizedCount: number;
}

export interface SearchResultItem<T = any> {
  id: string;
  title: string;
  subtitle: string;
  companyLabel: string;
  record: T;
  displayColumns: { key: string; label: string; value: string }[];
  matchedFields: { fieldLabel: string; matchedText: string }[];
}

export interface LayeredSearchExecutionResult<T = any> {
  hasDatasetAccess: boolean;
  datasetDeniedReason?: string;
  accessibleFields: SearchFieldDescriptor<T>[];
  blockedFields: BlockedFieldNotice[];
  totalAuthorizedPoolCount: number;
  droppedUnauthorizedConditionsTotal: number;
  layerSnapshots: FilterLayerSnapshot[];
  results: SearchResultItem<T>[];
}

/** Unified finance ledger item for cross-document finance search */
export interface FinanceLedgerUnifiedRow {
  id: string;
  ledgerKind: 'AP_RECON' | 'PAYMENT' | 'AR' | 'BANK_CHECK';
  ledgerKindLabel: string;
  docNo: string;
  companyId: string;
  counterpartyName: string;
  docDate: string;
  amount: number;
  status: string;
  bankAccountId?: string;
  bankAccountLabel: string;
  invoiceNumber?: string;
  invoiceIssueMode?: 'DELIVERED' | 'SELF_RETAINED';
  isBossPrivate: boolean;
  notes?: string;
}

// ============================================================================
// 1. 權限上下文建構（直接銜接 AuthContext 真實權限與私帳/401規範）
// ============================================================================
export function buildSearchPermissionContext(params: {
  user: User | null;
  activeCompanyId?: string;
  isSuperadmin: boolean;
  isBoss: boolean;
  isAdmin: boolean;
  can: (
    moduleKey: ModuleKey,
    action: 'read' | 'write' | 'approve' | 'export',
    targetCompanyId?: string
  ) => boolean;
}): SearchPermissionContext {
  const { user, activeCompanyId, isSuperadmin, isBoss, isAdmin, can } = params;

  let allowedCompanyIds: string[] | 'ALL' = [];
  if (isSuperadmin || isBoss || user?.canManageAllCompanies) {
    allowedCompanyIds = 'ALL';
  } else if (user) {
    const matrixIds = (user.companyGroupAssignments || [])
      .filter(a => a.groupIds && a.groupIds.length > 0)
      .map(a => a.companyId);
    const listIds = user.allowedCompanies || [];
    allowedCompanyIds = Array.from(new Set([...matrixIds, ...listIds].filter(Boolean)));
  }

  const canSeeBossPrivate = Boolean(isSuperadmin || isBoss);
  const hasArRead = can('FINANCE_AR', 'read');
  const hasApRead = can('FINANCE_AP', 'read');
  const hasArTaxAuthority = can('FINANCE_AR', 'write') || can('FINANCE_AR', 'approve');
  const hasApTaxAuthority = can('FINANCE_AP', 'write') || can('FINANCE_AP', 'approve');
  const canSee401TaxData = Boolean(
    isSuperadmin || isBoss || isAdmin || hasArTaxAuthority || hasApTaxAuthority
  );
  const canSeeFull401SelfRetained = Boolean(
    isSuperadmin || isBoss || (hasArTaxAuthority && hasApTaxAuthority)
  );
  const canSeeCommercialAmounts = Boolean(
    isSuperadmin ||
      isBoss ||
      isAdmin ||
      hasArRead ||
      hasApRead ||
      can('BANK_CHECKS', 'read') ||
      can('QUOTATIONS', 'read') ||
      can('PURCHASE_ORDERS', 'write')
  );

  return {
    user,
    activeCompanyId,
    isSuperadmin,
    isBoss,
    isAdmin,
    can,
    canSeeBossPrivate,
    canSee401TaxData,
    canSeeFull401SelfRetained,
    canSeeCommercialAmounts,
    allowedCompanyIds
  };
}

function isCompanyAllowed(companyId: string | undefined, ctx: SearchPermissionContext): boolean {
  if (!companyId || companyId === 'COMP-ALL') return true;
  if (ctx.allowedCompanyIds === 'ALL') return true;
  return ctx.allowedCompanyIds.includes(companyId);
}

function isRecordCompanyModuleAllowed(
  companyId: string | undefined,
  moduleKey: ModuleKey,
  ctx: SearchPermissionContext
): boolean {
  if (!companyId || companyId === 'COMP-ALL') return true;
  if (!isCompanyAllowed(companyId, ctx)) return false;
  if (ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin) return true;
  return ctx.can(moduleKey, 'read', companyId);
}

// ============================================================================
// 2. 各欄位型別預設運算子與標籤
// ============================================================================
export function getDefaultOperatorForField(dataType: SearchFieldDataType): SearchOperator {
  switch (dataType) {
    case 'REGION':
      return 'REGION_ALIAS';
    case 'SELECT':
      return 'IN';
    case 'NUMBER':
      return 'BETWEEN';
    case 'DATE':
      return 'DATE_RANGE';
    case 'BOOLEAN':
      return 'IS_TRUE';
    default:
      return 'CONTAINS';
  }
}

export function getOperatorsForDataType(dataType: SearchFieldDataType): { value: SearchOperator; label: string }[] {
  switch (dataType) {
    case 'REGION':
      return [
        { value: 'REGION_ALIAS', label: '地區／舊名別名互通' },
        { value: 'CONTAINS', label: '文字包含' }
      ];
    case 'SELECT':
      return [
        { value: 'IN', label: '符合所選任一項' },
        { value: 'EQUALS', label: '精準等於' }
      ];
    case 'NUMBER':
      return [{ value: 'BETWEEN', label: '數值區間 (起～迄)' }];
    case 'DATE':
      return [{ value: 'DATE_RANGE', label: '日期區間 (起～迄)' }];
    case 'BOOLEAN':
      return [
        { value: 'IS_TRUE', label: '是 (True)' },
        { value: 'IS_FALSE', label: '否 (False)' }
      ];
    default:
      return [
        { value: 'CONTAINS', label: '關鍵字包含（相容台/臺）' },
        { value: 'EQUALS', label: '完全相同' }
      ];
  }
}

// ============================================================================
// 3. 常見 ERP 資料對象規格註冊表（Schema Registry）
// ============================================================================
const normKeyword = (val: unknown): string =>
  String(val ?? '')
    .trim()
    .replace(/臺/g, '台')
    .toLowerCase();

const toValuesArray = (raw: string | string[] | number | boolean | null | undefined): unknown[] => {
  if (raw === null || raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
};

export const UNIVERSAL_SEARCH_SCHEMAS: Record<SearchDatasetKey, SearchDatasetSchema<any>> = {
  PARTNERS: {
    key: 'PARTNERS',
    label: '商業夥伴（業主／廠商／下包）',
    subtitle: '含多組地址（相容台/臺與舊縣市別名）、多元工種、聯絡人；財務與稅籍欄位依權限隔離',
    primaryModule: 'PARTNERS',
    canAccessDataset: ctx =>
      ctx.can('PARTNERS', 'read')
        ? { allowed: true }
        : { allowed: false, reason: '您所屬群組未具備「商業夥伴 (PARTNERS)」讀取權限' },
    filterAuthorizedRecords: (rows: BusinessPartner[], ctx) =>
      rows.filter(r => !r.isDeleted && isRecordCompanyModuleAllowed(r.companyId, 'PARTNERS', ctx)),
    getRowId: (r: BusinessPartner) => r.id,
    getRowTitle: (r: BusinessPartner) => `${r.name} (${r.bpCode})`,
    getRowSubtitle: (r: BusinessPartner) => {
      const role =
        r.isCustomer && r.isVendor
          ? '業主兼廠商'
          : r.isCustomer
          ? '業主客戶'
          : r.type === 'SUBCONTRACTOR'
          ? '下包工班'
          : '材料/合作廠商';
      const tags = (r.categoryTags || []).slice(0, 3).join('、') || r.categoryMain || r.serviceCategoryMain || '未分類';
      return `${role} · ${tags} · ${r.taxId || '無統編'}`;
    },
    getCompanyLabel: (r: BusinessPartner, lookup) =>
      lookup.companiesById.get(r.companyId)?.shortName ||
      lookup.companiesById.get(r.companyId)?.name ||
      r.companyId ||
      '共用',
    fields: [
      {
        key: 'nameOrCode',
        label: '夥伴名稱 / 代號',
        dataType: 'TEXT',
        sensitivity: 'PUBLIC',
        placeholder: '如：台泥、富鼎、宏達、BP-...',
        extract: (r: BusinessPartner) => [r.name, r.bpCode, r.representative || '']
      },
      {
        key: 'taxId',
        label: '統一編號 / 身分證',
        dataType: 'TEXT',
        sensitivity: 'PUBLIC',
        placeholder: '輸入 8 碼統編或部分號碼',
        extract: (r: BusinessPartner) => [r.taxId || '', r.ownerIdNumber || '']
      },
      {
        key: 'roleType',
        label: '夥伴身分角色',
        dataType: 'SELECT',
        sensitivity: 'PUBLIC',
        options: [
          { value: 'CUSTOMER', label: '業主 / 客戶' },
          { value: 'VENDOR', label: '材料 / 合作廠商' },
          { value: 'SUBCONTRACTOR', label: '工程下包工班' },
          { value: 'BOTH', label: '業主兼廠商' }
        ],
        extract: (r: BusinessPartner) => {
          const roles: string[] = [];
          if (r.isCustomer || r.type === 'CUSTOMER' || r.type === 'BOTH') roles.push('CUSTOMER');
          if (r.isVendor || r.type === 'VENDOR' || r.type === 'BOTH') roles.push('VENDOR');
          if (r.type === 'SUBCONTRACTOR') roles.push('SUBCONTRACTOR');
          if ((r.isCustomer && r.isVendor) || r.type === 'BOTH') roles.push('BOTH');
          return roles;
        },
        formatDisplay: (r: BusinessPartner) =>
          r.isCustomer && r.isVendor
            ? '業主兼廠商'
            : r.isCustomer
            ? '業主/客戶'
            : r.type === 'SUBCONTRACTOR'
            ? '工程下包'
            : '合作廠商'
      },
      {
        key: 'region',
        label: '所在縣市／鄉鎮（含舊名別名）',
        dataType: 'REGION',
        sensitivity: 'PUBLIC',
        placeholder: '如：新北市、台北縣、台灣市、斗南鎮',
        extract: (r: BusinessPartner) => {
          const pool: string[] = [];
          if (r.address) pool.push(r.address);
          for (const a of r.addresses || []) {
            if (!a.isHistorical) {
              pool.push(`${a.postalCode || ''} ${a.city || ''}${a.district || ''}${a.streetAddress || ''} ${a.fullAddress || ''}`);
            }
          }
          return pool;
        },
        formatDisplay: (r: BusinessPartner) => {
          const primary = r.addresses?.find(a => !a.isHistorical);
          if (primary) return `${primary.postalCode ? `[${primary.postalCode}] ` : ''}${primary.city || ''}${primary.district || ''}`;
          return r.address || '未填寫';
        }
      },
      {
        key: 'tradeCategories',
        label: '工種 / 供料分類標籤',
        dataType: 'TEXT',
        sensitivity: 'PUBLIC',
        placeholder: '如：混凝土、鋼筋、水電、拆圖',
        extract: (r: BusinessPartner) => [
          r.serviceCategoryMain || '',
          r.serviceCategorySub || '',
          r.categoryMain || '',
          r.categorySub || '',
          ...(r.categoryTags || []),
          ...(r.serviceCategories || []).map(sc => `${sc.main} ${sc.sub}`)
        ],
        formatDisplay: (r: BusinessPartner) =>
          Array.from(new Set([...(r.categoryTags || []), r.categoryMain || '', r.serviceCategoryMain || ''].filter(Boolean))).join('、') || '未設定'
      },
      {
        key: 'contactInfo',
        label: '聯絡窗口 / 電話',
        dataType: 'TEXT',
        sensitivity: 'PUBLIC',
        placeholder: '姓名或電話號碼',
        extract: (r: BusinessPartner) => [
          r.contactPerson || '',
          r.phone || '',
          ...(r.contacts || []).map(c => `${c.name} ${c.title || ''} ${c.phone || ''} ${c.mobile || ''}`)
        ]
      },
      {
        key: 'status',
        label: '往來狀態',
        dataType: 'SELECT',
        sensitivity: 'PUBLIC',
        options: [
          { value: 'ACTIVE', label: '正常往來' },
          { value: 'WARNING', label: '觀察警示' },
          { value: 'PAYMENT_LOCKED', label: '暫停付款' },
          { value: 'SUSPENDED', label: '停權停用' }
        ],
        extract: (r: BusinessPartner) => r.status || 'ACTIVE'
      },
      {
        key: 'paymentTermsDays',
        label: '月結付款天數（商業條件）',
        dataType: 'NUMBER',
        sensitivity: 'COMMERCIAL_AMOUNT',
        allowFn: ctx => ctx.canSeeCommercialAmounts,
        blockedReason: '需具備採購／報價或財務讀取權限才可搜尋付款條件天數',
        extract: (r: BusinessPartner) => Number(r.paymentTermsDays || 0),
        formatDisplay: (r: BusinessPartner) => `${r.paymentTermsDays || 30} 天`
      },
      {
        key: 'bankAccount',
        label: '匯款銀行 / 帳戶資料（財務機密）',
        dataType: 'TEXT',
        sensitivity: 'FINANCE_PRIVATE',
        placeholder: '銀行名稱、代碼或帳號末碼',
        allowFn: ctx =>
          ctx.isSuperadmin ||
          ctx.isBoss ||
          ctx.isAdmin ||
          ctx.can('FINANCE_AP', 'read') ||
          ctx.can('FINANCE_AR', 'read') ||
          ctx.can('BANK_CHECKS', 'read'),
        blockedReason: '需具備會計／出納財務權限才可搜尋夥伴銀行帳戶',
        extract: (r: BusinessPartner) => [
          r.bankCode || '',
          r.bankName || '',
          r.bankAccount || '',
          r.bankAccountName || '',
          ...(r.bankAccounts || []).map(b => `${b.bankCode} ${b.bankName} ${b.accountNumber} ${b.accountName}`)
        ],
        formatDisplay: (r: BusinessPartner) =>
          r.bankAccount ? `${r.bankCode || ''} ${r.bankName || ''} (${r.bankAccount})` : '未建檔'
      },
      {
        key: 'hasInvoice',
        label: '是否開立三聯式發票（401 稅籍）',
        dataType: 'BOOLEAN',
        sensitivity: 'TAX_401',
        allowFn: ctx => ctx.canSee401TaxData,
        blockedReason: '需具備會計 / 401 稅務檢視權限才可依發票開立屬性篩選',
        extract: (r: BusinessPartner) => r.hasInvoice !== false,
        formatDisplay: (r: BusinessPartner) => (r.hasInvoice !== false ? '可開立統一發票' : '免用發票／個人領據')
      }
    ]
  },

  PROJECTS: {
    key: 'PROJECTS',
    label: '工程案場主檔（含工地位置）',
    subtitle: '跨表整合 projects 與 project_sites；金額欄位依報價／會計權限隔離',
    primaryModule: 'PROJECTS',
    canAccessDataset: ctx =>
      ctx.can('PROJECTS', 'read')
        ? { allowed: true }
        : { allowed: false, reason: '您所屬群組未具備「工程案場 (PROJECTS)」讀取權限' },
    filterAuthorizedRecords: (rows: Project[], ctx) =>
      rows.filter(r => !r.isDeleted && isRecordCompanyModuleAllowed(r.companyId, 'PROJECTS', ctx)),
    getRowId: (r: Project) => r.id,
    getRowTitle: (r: Project) => `${r.name} (${r.projectCode})`,
    getRowSubtitle: (r: Project, lookup) => {
      const site = lookup.sitesByProjectId.get(r.id);
      const addr = site
        ? `${site.postalCode ? `[${site.postalCode}] ` : ''}${site.city || ''}${site.district || ''}${site.streetAddress || ''}`
        : '尚未登記工地地址';
      return `業主：${r.ownerName} · 工地：${addr}`;
    },
    getCompanyLabel: (r: Project, lookup) =>
      lookup.companiesById.get(r.companyId)?.shortName ||
      lookup.companiesById.get(r.companyId)?.name ||
      r.companyId ||
      '未定',
    fields: [
      {
        key: 'nameOrCode',
        label: '案場名稱 / 專案代號',
        dataType: 'TEXT',
        sensitivity: 'PUBLIC',
        placeholder: '如：帝寶、廠房、PRJ-...',
        extract: (r: Project) => [r.name, r.projectCode, r.buildingType || '', r.workScope || '']
      },
      {
        key: 'ownerName',
        label: '業主名稱 / 統編',
        dataType: 'TEXT',
        sensitivity: 'PUBLIC',
        placeholder: '業主姓名、公司或統編',
        extract: (r: Project) => [r.ownerName, r.ownerTaxId || '']
      },
      {
        key: 'siteRegion',
        label: '工地縣市／鄉鎮（含舊名別名）',
        dataType: 'REGION',
        sensitivity: 'PUBLIC',
        placeholder: '如：雲林縣、斗南鎮、台灣市、台北縣',
        extract: (r: Project, lookup) => {
          const site = lookup.sitesByProjectId.get(r.id);
          if (!site) return '';
          return `${site.postalCode || ''} ${site.city || ''}${site.district || ''}${site.streetAddress || ''} ${site.address || ''}`;
        },
        formatDisplay: (r: Project, lookup) => {
          const site = lookup.sitesByProjectId.get(r.id);
          if (!site) return '未登記';
          return `${site.postalCode ? `[${site.postalCode}] ` : ''}${site.city || ''}${site.district || ''}`;
        }
      },
      {
        key: 'status',
        label: '工程執行狀態',
        dataType: 'SELECT',
        sensitivity: 'PUBLIC',
        options: [
          { value: 'PLANNING', label: '規劃評估中' },
          { value: 'ACTIVE', label: '施工進行中' },
          { value: 'LOCKED', label: '鎖定凍結' },
          { value: 'COMPLETED', label: '已完工結案' }
        ],
        extract: (r: Project) => r.status
      },
      {
        key: 'startDate',
        label: '開工日期區間',
        dataType: 'DATE',
        sensitivity: 'PUBLIC',
        extract: (r: Project) => r.startDate || ''
      },
      {
        key: 'contractAmount',
        label: '合約總價（商業金額機密）',
        dataType: 'NUMBER',
        sensitivity: 'COMMERCIAL_AMOUNT',
        allowFn: ctx => ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('QUOTATIONS', 'read') || ctx.can('FINANCE_AR', 'read'),
        blockedReason: '工務／一般採購無報價或應收檢視權限時，不得搜尋案場承攬合約總價',
        extract: (r: Project) => Number(r.contractAmount || 0),
        formatDisplay: (r: Project) => `NT$ ${Number(r.contractAmount || 0).toLocaleString()}`
      },
      {
        key: 'actualCost',
        label: '已認列實際成本（財務機密）',
        dataType: 'NUMBER',
        sensitivity: 'FINANCE_PRIVATE',
        allowFn: ctx => ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('FINANCE_AP', 'read'),
        blockedReason: '需具備應付財務權限才可搜尋案場實際成本（工務無權查看）',
        extract: (r: Project) => Number(r.actualCost || 0),
        formatDisplay: (r: Project) => `NT$ ${Number(r.actualCost || 0).toLocaleString()}`
      }
    ]
  },

  INBOUND_RECEIPTS: {
    key: 'INBOUND_RECEIPTS',
    label: '現場進貨與叫料簽收明細',
    subtitle: '可直接依材料品名、規格、工地地區或點收日查詢；進貨金額與會計對帳單號依權限隔離',
    primaryModule: 'INBOUND_RECEIPTS',
    canAccessDataset: ctx =>
      ctx.can('INBOUND_RECEIPTS', 'read')
        ? { allowed: true }
        : { allowed: false, reason: '您所屬群組未具備「進貨簽收 (INBOUND_RECEIPTS)」讀取權限' },
    filterAuthorizedRecords: (rows: InboundReceipt[], ctx) =>
      rows.filter(r => !r.isDeleted && isRecordCompanyModuleAllowed(r.companyId, 'INBOUND_RECEIPTS', ctx)),
    getRowId: (r: InboundReceipt) => r.id,
    getRowTitle: (r: InboundReceipt) => `${r.receiptNumber} · ${r.vendorNameSnapshot || r.vendorId}`,
    getRowSubtitle: (r: InboundReceipt) => {
      const itemsSummary = (r.items || []).map(i => `${i.itemName}${i.spec ? `(${i.spec})` : ''}`).slice(0, 3).join('、');
      return `${r.projectNameSnapshot || r.projectId} · 點收日 ${r.receivedDate} · ${itemsSummary || '無品項明細'}`;
    },
    getCompanyLabel: (r: InboundReceipt, lookup) =>
      lookup.companiesById.get(r.companyId)?.shortName || r.companyId,
    fields: [
      {
        key: 'docNumbers',
        label: '進貨單號 / 送貨單 / 訂貨單號',
        dataType: 'TEXT',
        sensitivity: 'PUBLIC',
        placeholder: '如：INB-2026、送貨單號',
        extract: (r: InboundReceipt) => [r.receiptNumber, r.deliveryNoteNumber || '', r.orderNumber || '']
      },
      {
        key: 'projectAndVendor',
        label: '案場名稱 / 供應廠商',
        dataType: 'TEXT',
        sensitivity: 'PUBLIC',
        placeholder: '案場或廠商關鍵字',
        extract: (r: InboundReceipt) => [
          r.projectNameSnapshot || '',
          r.projectCodeSnapshot || '',
          r.vendorNameSnapshot || '',
          r.vendorTaxIdSnapshot || ''
        ]
      },
      {
        key: 'siteRegion',
        label: '進貨案場地區（含舊名別名）',
        dataType: 'REGION',
        sensitivity: 'PUBLIC',
        placeholder: '如：台中市、雲林縣、台灣市',
        extract: (r: InboundReceipt, lookup) => {
          const site = lookup.sitesByProjectId.get(r.projectId);
          return site ? `${site.postalCode || ''} ${site.city || ''}${site.district || ''}${site.address || ''}` : '';
        }
      },
      {
        key: 'itemDetails',
        label: '進貨品名 / 規格明細',
        dataType: 'TEXT',
        sensitivity: 'PUBLIC',
        placeholder: '如：混凝土、鋼筋、模板、PVC管',
        extract: (r: InboundReceipt) =>
          (r.items || []).map(it => `${it.itemName} ${it.spec || ''} ${it.notes || ''}`),
        formatDisplay: (r: InboundReceipt) =>
          (r.items || []).map(it => `${it.itemName}×${it.quantity}${it.unit}`).slice(0, 2).join('、') || '-'
      },
      {
        key: 'receivedDate',
        label: '現場點收日期區間',
        dataType: 'DATE',
        sensitivity: 'PUBLIC',
        extract: (r: InboundReceipt) => r.receivedDate
      },
      {
        key: 'billingStatus',
        label: '請款狀態',
        dataType: 'SELECT',
        sensitivity: 'PUBLIC',
        options: [
          { value: 'PENDING_BILLING', label: '尚未對帳請款' },
          { value: 'BILLED', label: '已納入對帳請款' }
        ],
        extract: (r: InboundReceipt) => r.billingStatus
      },
      {
        key: 'totalAmount',
        label: '進貨未稅合計金額（商業機密）',
        dataType: 'NUMBER',
        sensitivity: 'COMMERCIAL_AMOUNT',
        allowFn: ctx => ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('PURCHASE_ORDERS', 'write') || ctx.can('FINANCE_AP', 'read'),
        blockedReason: '一般工務或無採購發包／財務權限人員無法搜尋進貨計價金額',
        extract: (r: InboundReceipt) => Number(r.totalAmount || 0),
        formatDisplay: (r: InboundReceipt) => `NT$ ${Number(r.totalAmount || 0).toLocaleString()}`
      },
      {
        key: 'reconciliationNumber',
        label: '會計對帳單號（財務欄位）',
        dataType: 'TEXT',
        sensitivity: 'FINANCE_PRIVATE',
        placeholder: 'REC-...',
        allowFn: ctx => ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('FINANCE_AP', 'read'),
        blockedReason: '需具備應付財務讀取權限才可搜尋對帳單號',
        extract: (r: InboundReceipt) => r.reconciliationNumber || ''
      }
    ]
  },

  FINANCE_LEDGER: {
    key: 'FINANCE_LEDGER',
    label: '帳款與票據往來（含老闆私帳隔離）',
    subtitle: '整合 AP 對帳、出納付款、AR 應收與支票；無權限者徹底隔離老闆私帳與 401 發票欄位',
    primaryModule: 'FINANCE_AP',
    canAccessDataset: ctx => {
      const ok =
        ctx.isSuperadmin ||
        ctx.isBoss ||
        ctx.isAdmin ||
        ctx.can('FINANCE_AP', 'read') ||
        ctx.can('FINANCE_AR', 'read') ||
        ctx.can('BANK_CHECKS', 'read');
      return ok
        ? { allowed: true }
        : { allowed: false, reason: '您未具備應付 (AP)、應收 (AR) 或支票 (BANK_CHECKS) 任一財務模組讀取權限' };
    },
    filterAuthorizedRecords: (rows: FinanceLedgerUnifiedRow[], ctx) => {
      return rows.filter(row => {
        // 1. 老闆私帳紀錄嚴格隔離：無私帳權限者直接濾除，連筆數都不可得知
        if (row.isBossPrivate && !ctx.canSeeBossPrivate) return false;
        // 2. 公司法人隔離（BOSS-01 專屬私帳前面已檢查）
        if (row.companyId !== 'BOSS-01' && !isCompanyAllowed(row.companyId, ctx)) {
          return false;
        }
        const targetCid = row.companyId && row.companyId !== 'BOSS-01' ? row.companyId : undefined;
        // 3. 子模組權限隔離（同時檢查該筆資料所屬法人之授權矩陣）
        if ((row.ledgerKind === 'AP_RECON' || row.ledgerKind === 'PAYMENT') && !(ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('FINANCE_AP', 'read', targetCid))) {
          return false;
        }
        if (row.ledgerKind === 'AR' && !(ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('FINANCE_AR', 'read', targetCid))) {
          return false;
        }
        if (row.ledgerKind === 'BANK_CHECK' && !(ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('BANK_CHECKS', 'read', targetCid))) {
          return false;
        }
        return true;
      });
    },
    getRowId: (r: FinanceLedgerUnifiedRow) => `${r.ledgerKind}:${r.id}`,
    getRowTitle: (r: FinanceLedgerUnifiedRow) => `[${r.ledgerKindLabel}] ${r.docNo} · ${r.counterpartyName}`,
    getRowSubtitle: (r: FinanceLedgerUnifiedRow) =>
      `日期 ${r.docDate || '-'} · 狀態 ${r.status} · 帳戶：${r.bankAccountLabel}`,
    getCompanyLabel: (r: FinanceLedgerUnifiedRow, lookup) =>
      r.companyId === 'BOSS-01'
        ? '林董私帳專戶'
        : lookup.companiesById.get(r.companyId)?.shortName || r.companyId,
    fields: [
      {
        key: 'docNo',
        label: '單據 / 支票號碼',
        dataType: 'TEXT',
        sensitivity: 'PUBLIC',
        placeholder: 'REC-、PAY-、AR- 或支票號碼',
        extract: (r: FinanceLedgerUnifiedRow) => r.docNo
      },
      {
        key: 'ledgerKind',
        label: '帳務類型',
        dataType: 'SELECT',
        sensitivity: 'PUBLIC',
        options: [
          { value: 'AP_RECON', label: '應付對帳單' },
          { value: 'PAYMENT', label: '出納付款單' },
          { value: 'AR', label: '應收請款單' },
          { value: 'BANK_CHECK', label: '支票票據' }
        ],
        extract: (r: FinanceLedgerUnifiedRow) => r.ledgerKind
      },
      {
        key: 'counterpartyName',
        label: '往來對象（廠商／業主）',
        dataType: 'TEXT',
        sensitivity: 'PUBLIC',
        placeholder: '公司名稱或抬頭',
        extract: (r: FinanceLedgerUnifiedRow) => r.counterpartyName
      },
      {
        key: 'docDate',
        label: '帳務 / 到期日期區間',
        dataType: 'DATE',
        sensitivity: 'PUBLIC',
        extract: (r: FinanceLedgerUnifiedRow) => r.docDate
      },
      {
        key: 'amount',
        label: '帳款 / 票面金額區間',
        dataType: 'NUMBER',
        sensitivity: 'COMMERCIAL_AMOUNT',
        allowFn: ctx => ctx.canSeeCommercialAmounts,
        extract: (r: FinanceLedgerUnifiedRow) => r.amount,
        formatDisplay: (r: FinanceLedgerUnifiedRow) => `NT$ ${Number(r.amount || 0).toLocaleString()}`
      },
      {
        key: 'bankAccountLabel',
        label: '往來銀行帳戶名稱',
        dataType: 'TEXT',
        sensitivity: 'FINANCE_PRIVATE',
        placeholder: '如：合庫、台銀',
        allowFn: ctx =>
          ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('FINANCE_AP', 'read') || ctx.can('FINANCE_AR', 'read') || ctx.can('BANK_CHECKS', 'read'),
        blockedReason: '需具備財務收付或票據權限才可依往來銀行帳戶篩選',
        extract: (r: FinanceLedgerUnifiedRow) => r.bankAccountLabel
      },
      {
        key: 'invoiceNumber',
        label: '關聯發票字軌號碼（401 欄位）',
        dataType: 'TEXT',
        sensitivity: 'TAX_401',
        placeholder: '如：AB-12345678',
        allowFn: ctx => ctx.canSee401TaxData,
        blockedReason: '純出納／非會計人員未具備 401 稅務發票讀取權限，此欄位已隔離隱藏',
        extract: (r: FinanceLedgerUnifiedRow) => r.invoiceNumber || ''
      },
      {
        key: 'isBossPrivate',
        label: '老闆私帳／私人代墊交易（最高機密）',
        dataType: 'BOOLEAN',
        sensitivity: 'FINANCE_PRIVATE',
        allowFn: ctx => ctx.canSeeBossPrivate,
        blockedReason: '「老闆私帳」屬最高機密（僅董事長／Superadmin 可搜），一般管理員／會計／業務皆不可搜尋此欄位',
        extract: (r: FinanceLedgerUnifiedRow) => r.isBossPrivate,
        formatDisplay: (r: FinanceLedgerUnifiedRow) => (r.isBossPrivate ? '🔒 老闆私帳／代墊' : '公司正式戶')
      }
    ]
  },

  TAX_401_INVOICES: {
    key: 'TAX_401_INVOICES',
    label: '401 營業稅發票與自主留存憑證',
    subtitle: '專供會計／BOSS 搜尋進銷項字軌、雙月期別與稅額；嚴格隔離無 401 權限角色與自主留存機密',
    primaryModule: 'FINANCE_AR',
    canAccessDataset: ctx =>
      ctx.canSee401TaxData
        ? { allowed: true }
        : { allowed: false, reason: '您不具備「401 稅務／會計發票」檢視權限（工務／採購／純出納不可搜尋此資料表）' },
    filterAuthorizedRecords: (rows: Invoice[], ctx) =>
      rows.filter(inv => {
        const cid = inv.taxReportingCompanyId;
        if (!isCompanyAllowed(cid, ctx)) return false;
        const hasComp401 =
          ctx.isSuperadmin ||
          ctx.isBoss ||
          ctx.isAdmin ||
          ctx.can('FINANCE_AR', 'write', cid) ||
          ctx.can('FINANCE_AR', 'approve', cid) ||
          ctx.can('FINANCE_AP', 'write', cid) ||
          ctx.can('FINANCE_AP', 'approve', cid);
        if (!hasComp401) return false;
        // 自主開立留存報稅 (SELF_RETAINED) / 個人憑證 (PERSONAL_VOUCHER) 須完整雙邊會計權限或 BOSS
        const isConfidential401 =
          inv.invoiceIssueMode === 'SELF_RETAINED' ||
          inv.invoiceCategory === 'PERSONAL_VOUCHER' ||
          inv.invoiceCategory === 'NON_DEDUCTIBLE_INV';
        if (isConfidential401 && !ctx.canSeeFull401SelfRetained) return false;
        return true;
      }),
    getRowId: (r: Invoice) => r.id,
    getRowTitle: (r: Invoice) => `${r.invoiceNumber || '(免用字軌)'} · ${r.invoiceType === 'OUTPUT' ? '銷項' : '進項'}`,
    getRowSubtitle: (r: Invoice) =>
      `期別 ${r.taxPeriod || r.invoiceDate.slice(0, 7)} · ${r.invoiceType === 'OUTPUT' ? (r.buyerName || r.buyerTaxId) : (r.issuerName || r.issuerTaxId)} · 含稅 NT$ ${Number(r.totalAmount || 0).toLocaleString()}`,
    getCompanyLabel: (r: Invoice, lookup) =>
      lookup.companiesById.get(r.taxReportingCompanyId)?.shortName || r.taxReportingCompanyId,
    fields: [
      {
        key: 'invoiceNumber',
        label: '發票字軌號碼',
        dataType: 'TEXT',
        sensitivity: 'TAX_401',
        placeholder: '如：AA-、YZ-...',
        extract: (r: Invoice) => r.invoiceNumber || ''
      },
      {
        key: 'invoiceType',
        label: '進銷項別',
        dataType: 'SELECT',
        sensitivity: 'TAX_401',
        options: [
          { value: 'OUTPUT', label: '銷項發票（開出）' },
          { value: 'INPUT', label: '進項發票（取得）' }
        ],
        extract: (r: Invoice) => r.invoiceType
      },
      {
        key: 'taxPeriod',
        label: '401 雙月申報期別',
        dataType: 'TEXT',
        sensitivity: 'TAX_401',
        placeholder: '如：2026-03-04',
        extract: (r: Invoice) => r.taxPeriod || ''
      },
      {
        key: 'counterpartyInfo',
        label: '買受／開立方名稱與統編',
        dataType: 'TEXT',
        sensitivity: 'TAX_401',
        placeholder: '對象名稱或 8 碼統編',
        extract: (r: Invoice) => [r.buyerName || '', r.buyerTaxId || '', r.issuerName || '', r.issuerTaxId || '']
      },
      {
        key: 'invoiceDate',
        label: '發票開立日期區間',
        dataType: 'DATE',
        sensitivity: 'TAX_401',
        extract: (r: Invoice) => r.invoiceDate
      },
      {
        key: 'totalAmount',
        label: '含稅總金額區間',
        dataType: 'NUMBER',
        sensitivity: 'TAX_401',
        extract: (r: Invoice) => Number(r.totalAmount || 0),
        formatDisplay: (r: Invoice) => `NT$ ${Number(r.totalAmount || 0).toLocaleString()}`
      },
      {
        key: 'taxAmount',
        label: '營業稅額區間',
        dataType: 'NUMBER',
        sensitivity: 'TAX_401',
        extract: (r: Invoice) => Number(r.taxAmount || 0),
        formatDisplay: (r: Invoice) => `NT$ ${Number(r.taxAmount || 0).toLocaleString()}`
      },
      {
        key: 'invoiceIssueMode',
        label: '交付／自主留存模式（401 機密欄位）',
        dataType: 'SELECT',
        sensitivity: 'TAX_401',
        options: [
          { value: 'DELIVERED', label: '交付業主 / 一般憑證' },
          { value: 'SELF_RETAINED', label: '自主開立留存報稅（未交業主）' }
        ],
        allowFn: ctx => ctx.canSeeFull401SelfRetained,
        blockedReason: '「自主留存報稅模式」須同時具備進項與銷項雙邊會計權限（或 BOSS/Superadmin）才可查詢',
        extract: (r: Invoice) => r.invoiceIssueMode || 'DELIVERED',
        formatDisplay: (r: Invoice) => (r.invoiceIssueMode === 'SELF_RETAINED' ? '自主留存報稅' : '一般交付')
      }
    ]
  }
};

// ============================================================================
// 4. 單一條件與單層條件評估函式
// ============================================================================
function isFieldAccessible(field: SearchFieldDescriptor<any>, ctx: SearchPermissionContext): boolean {
  if (field.allowFn) return field.allowFn(ctx);
  if (field.sensitivity === 'COMMERCIAL_AMOUNT') return ctx.canSeeCommercialAmounts;
  if (field.sensitivity === 'TAX_401') return ctx.canSee401TaxData;
  return true;
}

function getFieldBlockedReason(field: SearchFieldDescriptor<any>): string {
  if (field.blockedReason) return field.blockedReason;
  if (field.sensitivity === 'TAX_401') return '缺少 401 稅務／會計檢視權限';
  if (field.sensitivity === 'FINANCE_PRIVATE') return '缺少財務或私帳機密檢視權限';
  if (field.sensitivity === 'COMMERCIAL_AMOUNT') return '缺少商業金額檢視權限';
  return '無欄位存取權限';
}

function conditionHasInput(cond: SearchCondition): boolean {
  if (cond.operator === 'IS_TRUE' || cond.operator === 'IS_FALSE') return true;
  if (cond.operator === 'IN') return Array.isArray(cond.value) && cond.value.length > 0;
  if (cond.operator === 'BETWEEN') {
    const min = cond.value?.min;
    const max = cond.value?.max;
    return (min !== undefined && min !== '') || (max !== undefined && max !== '');
  }
  if (cond.operator === 'DATE_RANGE') {
    const from = cond.value?.from;
    const to = cond.value?.to;
    return Boolean(from || to);
  }
  return String(cond.value ?? '').trim().length > 0;
}

function evaluateSingleCondition<T>(
  row: T,
  field: SearchFieldDescriptor<T>,
  cond: SearchCondition,
  lookup: SearchDatasetLookup
): { matched: boolean; matchedText?: string } {
  const raw = field.extract(row, lookup);
  const values = toValuesArray(raw);

  if (cond.operator === 'IS_TRUE') {
    const ok = values.some(v => v === true || String(v) === 'true' || v === 1);
    return ok ? { matched: true, matchedText: '是' } : { matched: false };
  }
  if (cond.operator === 'IS_FALSE') {
    const ok = values.length > 0 && values.every(v => v === false || String(v) === 'false' || v === 0);
    return ok ? { matched: true, matchedText: '否' } : { matched: false };
  }
  if (cond.operator === 'BETWEEN') {
    const minRaw = cond.value?.min;
    const maxRaw = cond.value?.max;
    const minVal = minRaw !== undefined && minRaw !== '' ? Number(minRaw) : -Infinity;
    const maxVal = maxRaw !== undefined && maxRaw !== '' ? Number(maxRaw) : Infinity;
    for (const v of values) {
      const num = Number(v);
      if (Number.isFinite(num) && num >= minVal && num <= maxVal) {
        return { matched: true, matchedText: num.toLocaleString() };
      }
    }
    return { matched: false };
  }
  if (cond.operator === 'DATE_RANGE') {
    const from = String(cond.value?.from || '').trim();
    const to = String(cond.value?.to || '').trim();
    for (const v of values) {
      const d = String(v || '').slice(0, 10);
      if (!d) continue;
      if (from && d < from) continue;
      if (to && d > to) continue;
      return { matched: true, matchedText: d };
    }
    return { matched: false };
  }
  if (cond.operator === 'IN') {
    const selected: string[] = Array.isArray(cond.value) ? cond.value.map(String) : [];
    if (selected.length === 0) return { matched: true };
    const matchedVal = values.find(v => selected.includes(String(v)));
    return matchedVal !== undefined
      ? { matched: true, matchedText: String(matchedVal) }
      : { matched: false };
  }

  const query = String(cond.value ?? '').trim();
  if (!query) return { matched: true };

  if (cond.operator === 'REGION_ALIAS') {
    for (const v of values) {
      const text = String(v || '');
      if (text && matchesTaiwanRegion(text, query)) {
        return { matched: true, matchedText: text.trim() };
      }
    }
    return { matched: false };
  }

  const normQ = normKeyword(query);
  if (cond.operator === 'EQUALS') {
    const hit = values.find(v => normKeyword(v) === normQ);
    return hit !== undefined ? { matched: true, matchedText: String(hit) } : { matched: false };
  }

  // CONTAINS (預設相容台/臺)
  const hit = values.find(v => normKeyword(v).includes(normQ));
  return hit !== undefined ? { matched: true, matchedText: String(hit) } : { matched: false };
}

// ============================================================================
// 5. 核心過濾堆疊引擎（Filter Stack + 嚴格欄位權限裁切）
// ============================================================================
export function executeLayeredSearch<T>(
  rawRecords: T[],
  schema: SearchDatasetSchema<T>,
  filterStack: SearchFilterLayer[],
  permCtx: SearchPermissionContext,
  lookup: SearchDatasetLookup
): LayeredSearchExecutionResult<T> {
  const datasetAccess = schema.canAccessDataset(permCtx);
  if (!datasetAccess.allowed) {
    return {
      hasDatasetAccess: false,
      datasetDeniedReason: datasetAccess.reason || '無存取權限',
      accessibleFields: [],
      blockedFields: schema.fields.map(f => ({
        key: f.key,
        label: f.label,
        sensitivity: f.sensitivity,
        reason: getFieldBlockedReason(f)
      })),
      totalAuthorizedPoolCount: 0,
      droppedUnauthorizedConditionsTotal: 0,
      layerSnapshots: [],
      results: []
    };
  }

  // A. 依權限裁切欄位清單：無權限欄位絕不進入可選清單、關鍵字比對池與回傳欄位
  const accessibleFields: SearchFieldDescriptor<T>[] = [];
  const blockedFields: BlockedFieldNotice[] = [];
  for (const field of schema.fields) {
    if (isFieldAccessible(field, permCtx)) {
      accessibleFields.push(field);
    } else {
      blockedFields.push({
        key: field.key,
        label: field.label,
        sensitivity: field.sensitivity,
        reason: getFieldBlockedReason(field)
      });
    }
  }
  const accessibleFieldMap = new Map(accessibleFields.map(f => [f.key, f]));

  // B. 依法人授權與私帳/401規範過濾資料列池
  const authorizedPool = schema.filterAuthorizedRecords(rawRecords, permCtx, lookup);

  // C. 逐層執行 Filter Stack（第 1 層初篩 -> 第 2 層於結果內再篩 -> 第 N 層...）
  let currentRows = authorizedPool;
  let droppedUnauthorizedConditionsTotal = 0;
  const layerSnapshots: FilterLayerSnapshot[] = [];
  const matchedMetaByRowId = new Map<string, Map<string, string>>();

  for (const layer of filterStack) {
    const beforeCount = currentRows.length;
    const validConditions: { cond: SearchCondition; field: SearchFieldDescriptor<T> }[] = [];
    let droppedInLayer = 0;

    for (const cond of layer.conditions) {
      const targetField = accessibleFieldMap.get(cond.fieldKey);
      if (!targetField) {
        droppedInLayer += 1;
        droppedUnauthorizedConditionsTotal += 1;
        continue;
      }
      if (conditionHasInput(cond)) {
        validConditions.push({ cond, field: targetField });
      }
    }

    const kw = layer.keyword.trim();
    const normKw = normKeyword(kw);

    // 若本層沒有任何關鍵字與有效條件，則保留上層結果不縮小
    if (!kw && validConditions.length === 0) {
      layerSnapshots.push({
        layerId: layer.id,
        label: layer.label,
        beforeCount,
        afterCount: currentRows.length,
        droppedUnauthorizedCount: droppedInLayer
      });
      continue;
    }

    const nextRows: T[] = [];
    for (const row of currentRows) {
      const rowId = schema.getRowId(row);
      if (!matchedMetaByRowId.has(rowId)) {
        matchedMetaByRowId.set(rowId, new Map());
      }
      const rowMatchedMap = matchedMetaByRowId.get(rowId)!;

      // 1. 若有關鍵字：僅比對「目前有權限的 accessibleFields」，絕對不搜尋已被隔離隱藏的機密欄位！
      let keywordPass = true;
      if (kw) {
        keywordPass = false;
        for (const f of accessibleFields) {
          const vals = toValuesArray(f.extract(row, lookup));
          let hitText: string | undefined;
          if (f.dataType === 'REGION') {
            const found = vals.find(v => v && matchesTaiwanRegion(String(v), kw));
            if (found) hitText = String(found).trim();
          } else {
            const found = vals.find(v => normKeyword(v).includes(normKw));
            if (found !== undefined) hitText = String(found).trim();
          }
          if (hitText) {
            keywordPass = true;
            if (!rowMatchedMap.has(f.label)) {
              rowMatchedMap.set(f.label, hitText.slice(0, 48));
            }
          }
        }
      }

      // 2. 複數欄位條件評估 (AND / OR)
      let conditionsPass = true;
      if (validConditions.length > 0) {
        if (layer.combinator === 'AND') {
          conditionsPass = true;
          for (const { cond, field } of validConditions) {
            const res = evaluateSingleCondition(row, field, cond, lookup);
            if (!res.matched) {
              conditionsPass = false;
              break;
            }
            if (res.matchedText) {
              rowMatchedMap.set(field.label, res.matchedText.slice(0, 48));
            }
          }
        } else {
          conditionsPass = false;
          for (const { cond, field } of validConditions) {
            const res = evaluateSingleCondition(row, field, cond, lookup);
            if (res.matched) {
              conditionsPass = true;
              if (res.matchedText) {
                rowMatchedMap.set(field.label, res.matchedText.slice(0, 48));
              }
            }
          }
        }
      }

      if (keywordPass && conditionsPass) {
        nextRows.push(row);
      }
    }

    currentRows = nextRows;
    layerSnapshots.push({
      layerId: layer.id,
      label: layer.label,
      beforeCount,
      afterCount: currentRows.length,
      droppedUnauthorizedCount: droppedInLayer
    });
  }

  // D. 僅擷取「當前身分有權限檢視的欄位摘要」回傳給展示 UI
  const results: SearchResultItem<T>[] = currentRows.map(row => {
    const id = schema.getRowId(row);
    const matchedMap = matchedMetaByRowId.get(id);
    const displayColumns = accessibleFields
      .slice(0, 6)
      .map(f => {
        let valText = '';
        if (f.formatDisplay) {
          valText = f.formatDisplay(row, lookup);
        } else {
          const vals = toValuesArray(f.extract(row, lookup))
            .map(v => String(v ?? '').trim())
            .filter(Boolean);
          valText = Array.from(new Set(vals)).slice(0, 2).join('、') || '-';
        }
        return { key: f.key, label: f.label, value: valText };
      });

    return {
      id,
      title: schema.getRowTitle(row, lookup),
      subtitle: schema.getRowSubtitle(row, lookup),
      companyLabel: schema.getCompanyLabel(row, lookup),
      record: row,
      displayColumns,
      matchedFields: matchedMap
        ? Array.from(matchedMap.entries()).map(([fieldLabel, matchedText]) => ({
            fieldLabel,
            matchedText
          }))
        : []
    };
  });

  return {
    hasDatasetAccess: true,
    accessibleFields,
    blockedFields,
    totalAuthorizedPoolCount: authorizedPool.length,
    droppedUnauthorizedConditionsTotal,
    layerSnapshots,
    results
  };
}

// ============================================================================
// 6. 輔助函式：整合財務單據與私帳標記供樣板實測
// ============================================================================
export function buildUnifiedFinanceRows(params: {
  reconciliations: AccountsPayableReconciliation[];
  payments: PaymentRecord[];
  arList: AccountReceivable[];
  checks: BankCheck[];
  bankAccountsById: Map<string, CompanyBankAccount>;
}): FinanceLedgerUnifiedRow[] {
  const { reconciliations, payments, arList, checks, bankAccountsById } = params;
  const rows: FinanceLedgerUnifiedRow[] = [];

  for (const r of reconciliations) {
    if (r.isDeleted) continue;
    const bank = r.designatedBankAccountId ? bankAccountsById.get(r.designatedBankAccountId) : undefined;
    const isBossPrivate = Boolean(
      r.isBossAdvance ||
        bank?.isVirtualAccount ||
        bank?.companyId === 'BOSS-01' ||
        r.designatedBankAccountId === 'BANK-BOSS'
    );
    rows.push({
      id: r.id,
      ledgerKind: 'AP_RECON',
      ledgerKindLabel: '應付對帳',
      docNo: r.reconciliationNumber,
      companyId: r.companyId,
      counterpartyName: r.vendorName || r.vendorId,
      docDate: r.paymentDueDate || r.billingPeriod || '',
      amount: Number(r.netPayableAmount || 0),
      status: r.status,
      bankAccountId: r.designatedBankAccountId,
      bankAccountLabel: isBossPrivate
        ? '🔒 老闆私帳代墊專戶'
        : r.designatedBankAccountName || bank?.bankName || '未指定專戶',
      invoiceNumber: r.invoiceNumber || '',
      isBossPrivate,
      notes: r.notes
    });
  }

  for (const p of payments) {
    if (p.isDeleted) continue;
    const bank = p.bankAccountId ? bankAccountsById.get(p.bankAccountId) : undefined;
    const isBossPrivate = Boolean(
      p.isBossAdvance ||
        bank?.isVirtualAccount ||
        bank?.companyId === 'BOSS-01' ||
        p.bankAccountId === 'BANK-BOSS' ||
        p.bankAccountId === 'BOSS_POCKET'
    );
    rows.push({
      id: p.id,
      ledgerKind: 'PAYMENT',
      ledgerKindLabel: '出納付款',
      docNo: p.paymentNo,
      companyId: isBossPrivate ? 'BOSS-01' : p.companyId,
      counterpartyName: p.partnerName || p.customVendorName || '-',
      docDate: p.postingDate || p.documentDate || '',
      amount: Number(p.totalAmount || 0),
      status: p.status,
      bankAccountId: p.bankAccountId,
      bankAccountLabel: isBossPrivate
        ? '🔒 老闆私帳／虛擬口袋'
        : p.bankAccountName || bank?.bankName || p.bankAccountId,
      isBossPrivate,
      notes: p.notes
    });
  }

  for (const ar of arList) {
    const isBossPrivate = false;
    rows.push({
      id: ar.id,
      ledgerKind: 'AR',
      ledgerKindLabel: '應收請款',
      docNo: ar.arNumber,
      companyId: ar.companyId,
      counterpartyName: ar.customerName,
      docDate: ar.invoiceDate || ar.dueDate || '',
      amount: Number(ar.amount || 0),
      status: ar.status,
      bankAccountLabel: ar.hasInvoice
        ? ar.invoiceIssueMode === 'SELF_RETAINED'
          ? '公司戶／自留開票'
          : '開票法人專戶'
        : '免開發票（可入私帳／現金）',
      invoiceNumber: ar.invoiceNumber || '',
      invoiceIssueMode: ar.invoiceIssueMode,
      isBossPrivate,
      notes: ar.notes
    });
  }

  for (const c of checks) {
    const isBossPrivate = Boolean(
      c.companyId === 'BOSS-01' ||
        (c.bankName || '').includes('私帳') ||
        (c.bankName || '').includes('老闆')
    );
    rows.push({
      id: c.id,
      ledgerKind: 'BANK_CHECK',
      ledgerKindLabel: c.type === 'RECEIVABLE' ? '應收支票' : '應付支票',
      docNo: c.checkNumber,
      companyId: c.companyId,
      counterpartyName: c.counterpartyName,
      docDate: c.dueDate || c.issueDate || '',
      amount: Number(c.amount || 0),
      status: c.status,
      bankAccountLabel: isBossPrivate ? '🔒 老闆私帳支票簿' : c.bankName || '-',
      isBossPrivate,
      notes: c.notes
    });
  }

  return rows;
}
