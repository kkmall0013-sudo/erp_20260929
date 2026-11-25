// 基礎組織、使用者權限、系統參數與行政區劃型別定義

export type CompanyId = string;

export interface PhoneItem {
  id: string;
  type: '市話' | '傳真' | '工務專線' | '行動電話' | '緊急聯絡';
  number: string;
}

export interface KeyPerson {
  id: string;
  title: string; // 職稱如: 董事長, 總經理, 財務長, 營造特助
  name: string;
  phone?: string;
}

export interface AddressHistoryEntry {
  id: string;
  postalCode?: string;
  city?: string;
  district?: string;
  streetAddress?: string;
  fullAddress: string;
  archivedAt: string;
  note?: string;
}

export interface TaiwanPostalCityRecord {
  id: string;
  cityName: string;
  aliases: string[];
  isActive: boolean;
  note?: string;
  updatedAt?: string;
}

export interface TaiwanPostalCodeRecord {
  id: string;
  cityId?: string;
  city: string;
  district: string;
  postalCode: string;
  isActive: boolean;
  aliases: string[];
  replacedByCity?: string;
  replacedByDistrict?: string;
  note?: string;
  sortOrder: number;
  updatedAt?: string;
}

export interface Company {
  id: string;
  companyCode: string;
  name: string;
  shortName?: string;
  entityType: 'GROUP' | 'CORPORATION' | 'PERSONAL';
  parentId?: string;
  taxId?: string; // 公司法人 8 碼統編
  nationalId?: string; // 個人實體台灣身分證字號 (1 碼英文字母 + 9 碼數字加權防呆)
  representative?: string; // 法定代表人 / 負責人
  keyPersonnel?: KeyPerson[]; // 公司重要人物清單
  documentPrefix?: string;
  paymentScheduleDays?: string; // 本法人公司預設每月開票/付款日 (如 "7,17,27"，留空繼承系統中樞預設)
  phones?: PhoneItem[];
  email?: string;
  registeredAddress?: string;
  registeredPostalCode?: string;
  registeredCity?: string;
  registeredDistrict?: string;
  registeredStreetAddress?: string;
  registeredAddressHistory?: AddressHistoryEntry[];
  contactAddress?: string;
  contactPostalCode?: string;
  contactCity?: string;
  contactDistrict?: string;
  contactStreetAddress?: string;
  contactAddressHistory?: AddressHistoryEntry[];
  capitalAmount?: number;
  baseCurrency: string;
  isDeleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'SUPERADMIN' | 'BOSS' | 'ADMIN' | 'USER';

export interface CompanyGroupAssignment {
  companyId: string; // 營運法人 ID (如 COMP-01, COMP-02)
  groupIds: string[]; // 該法人專屬指派之業務群組 (如 GRP-ACC 財務, GRP-PROC 採購)
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  canManageUsers?: boolean; // 【Superadmin 特許帳號管理專人】可進帳號管理模組與重設他人密碼
  canManageSystemConfigs?: boolean; // 【Superadmin 特許授權】開放此 Admin 修改全域核心參數
  canManageAdmins?: boolean; // 【Superadmin 特許同階管理】開放此 Admin 新增、編輯、重設密碼與刪除同階 Admin
  canManageAllCompanies?: boolean; // 【全集團跨法人管理特許】代替Superadmin統籌管理全集團所有公司法人（不受限於特定子公司，如老闆/營運長）
  groupId?: string; // 當 role === 'USER' 時主要群組 ID
  groupIds?: string[]; // 支援同仁同時隸屬多個業務群組矩陣 (PBAC 多重群組)
  companyGroupAssignments?: CompanyGroupAssignment[]; // 【跨法人業務授權矩陣】針對不同法人個別指派不同業務職能 (如 A公司管財務，B公司管採購)
  status: 'ACTIVE' | 'DISABLED';
  title?: string;
  allowedCompanies: string[];
  defaultCompanyId: string;
  passwordHash?: string; // 密碼字串或雜湊
  isPasswordReset?: boolean; // 是否為重設後之初始預設密碼標記
  lastLoginAt?: string;
  deleteStage?: 'ACTIVE' | 'PENDING_DELETE' | 'ARCHIVED'; // 帳號生命週期三態：正常啟用、待刪除冷卻中、深度封存中
  stageDeletedAt?: string; // 進入待刪除/封存狀態時間戳 (ISO)
  purgeDueAt?: string; // 7日冷卻截止時間 (ISO)
  deletedBy?: string; // 執行刪除或移交操作者姓名
  stageNotes?: string; // 刪除或封存備註
  createdAt: string;
  updatedAt: string;
}

export interface UserGroup {
  id: string;
  groupCode: string;
  groupName: string;
  description: string;
  isSystem: boolean; // 系統內建預設群組防誤刪
  approvalLimit: number; // 單筆核准金額上限 ($0 ~ 無限制)
  canExport: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ModuleKey =
  | 'COMPANIES'
  | 'PROJECTS'
  | 'PARTNERS'
  | 'QUOTATIONS'
  | 'INBOUND_RECEIPTS'
  | 'PURCHASE_ORDERS'
  | 'SUBCONTRACTS'
  | 'VALUATIONS'
  | 'FINANCE_AP'
  | 'FINANCE_AR'
  | 'BANK_CHECKS'
  | 'SYSTEM_CONFIGS'
  | 'AUDIT_LOGS';

export interface GroupModulePermission {
  id: string;
  groupId: string;
  moduleKey: ModuleKey;
  canRead: boolean;
  canWrite: boolean;
  canApprove: boolean;
  canExport: boolean;
}

export interface AppConfig {
  id: string;
  configKey: string;
  configValue: string;
  description?: string;
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  isDeleted: boolean;
  version: number;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SystemConfig {
  id: string;
  configKey: string;
  configValue: string;
  description?: string;
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  validFrom: string;
  validTo?: string;
  isDeleted: boolean;
  version: number;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string; // 'CREATE' | 'UPDATE' | 'DELETE' | 'POST' | 'VOID' | 'LOGIN' | 'SWITCH_USER' | 'PASSWORD_RESET' 等全模組事件
  targetTable: string;
  targetId: string;
  beforeJson?: string;
  afterJson?: string;
  ipAddress: string;
  createdAt: string;
}

export interface DocumentSequence {
  prefix: string;
  currentVal: number;
  maxExistingVal?: number;
  nextVal: number;
  updatedAt: string;
}

export interface DocumentSequenceRule {
  moduleKey: string;
  moduleName: string;
  prefix: string;
  dateFormat: 'YYYYMM' | 'YYYY' | 'YYYYMMDD' | 'NONE';
  delimiter: '-' | '' | '_';
  serialLength: number;
  resetFrequency: 'MONTHLY' | 'YEARLY' | 'NEVER';
  description?: string;
  updatedAt?: string;
}

export interface DocumentModuleSequenceStatus {
  moduleKey: string;
  moduleName: string;
  prefix: string;
  rule: DocumentSequenceRule;
  currentPeriod: string;
  currentPeriodPrefix: string;
  currentPeriodMaxVal: number;
  currentPeriodLatestDoc: string | null;
  currentPeriodNextVal: number;
  currentPeriodNextDoc: string;
  nextMonthPeriod: string;
  nextMonthReservedNextDoc: string;
  historicalPeriods: {
    period: string;
    prefixKey: string;
    maxVal: number;
    latestDoc: string;
    count: number;
    isLocked: boolean;
  }[];
}

export interface RegulatorySchedule {
  id: string;
  configKey: string;
  configLabel: string;
  scheduledValue: string;
  effectiveDate: string;
  status: 'SCHEDULED' | 'APPLIED' | 'CANCELLED';
  createdBy?: string;
  createdAt?: string;
  appliedAt?: string;
  notes?: string;
}
