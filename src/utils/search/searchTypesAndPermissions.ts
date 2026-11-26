import {
  BusinessPartner,
  Company,
  CompanyBankAccount,
  ModuleKey,
  ProjectSite,
  User
} from '../../types/erp';

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

export function createSearchDatasetLookup(params: {
  companies?: Company[];
  sites?: ProjectSite[];
  partners?: BusinessPartner[];
  bankAccounts?: CompanyBankAccount[];
}): SearchDatasetLookup {
  return {
    companiesById: new Map((params.companies || []).map(c => [c.id, c])),
    sitesByProjectId: new Map((params.sites || []).map(s => [s.projectId, s])),
    partnersById: new Map((params.partners || []).map(p => [p.id, p])),
    bankAccountsById: new Map((params.bankAccounts || []).map(b => [b.id, b]))
  };
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

export function isCompanyAllowed(companyId: string | undefined, ctx: SearchPermissionContext): boolean {
  if (!companyId || companyId === 'COMP-ALL') return true;
  if (ctx.allowedCompanyIds === 'ALL') return true;
  return ctx.allowedCompanyIds.includes(companyId);
}

export function isRecordCompanyModuleAllowed(
  companyId: string | undefined,
  moduleKey: ModuleKey,
  ctx: SearchPermissionContext
): boolean {
  if (!companyId || companyId === 'COMP-ALL') return true;
  if (!isCompanyAllowed(companyId, ctx)) return false;
  if (ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin) return true;
  return ctx.can(moduleKey, 'read', companyId);
}

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

export const normKeyword = (val: unknown): string =>
  String(val ?? '')
    .trim()
    .replace(/臺/g, '台')
    .toLowerCase();

export const toValuesArray = (raw: string | string[] | number | boolean | null | undefined): unknown[] => {
  if (raw === null || raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
};
