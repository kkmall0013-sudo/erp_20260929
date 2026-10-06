// ERP 系統全模組型別定義 (依據《ERP全模組資料庫欄位與用途總表》及《系統憲法》)

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
  phones?: PhoneItem[];
  email?: string;
  registeredAddress?: string;
  contactAddress?: string;
  capitalAmount?: number;
  baseCurrency: string;
  isDeleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'USER';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  canManageUsers?: boolean; // 【Superadmin 特許帳號管理專人】可進帳號管理模組與重設他人密碼
  canManageSystemConfigs?: boolean; // 【Superadmin 特許授權】開放此 Admin 修改全域核心參數
  canManageAdmins?: boolean; // 【Superadmin 特許同階管理】開放此 Admin 新增、編輯、重設密碼與刪除同階 Admin
  groupId?: string; // 當 role === 'USER' 時主要群組 ID
  groupIds?: string[]; // 支援同仁同時隸屬多個業務群組矩陣 (PBAC 多重群組)
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
  updatedAt: string;
}

export interface Project {
  id: string;
  projectCode: string;
  name: string;
  ownerName: string;
  ownerTaxId: string;
  contractAmount: number;
  budgetAmount: number;
  committedCost: number;
  actualCost: number;
  startDate: string;
  endDate: string;
  status: 'PLANNING' | 'ACTIVE' | 'LOCKED' | 'COMPLETED';
  isLocked: boolean;
  companyId: string;
  isDeleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSite {
  id: string;
  projectId: string;
  siteName: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  permitNumber?: string;
}

export interface ProjectWBS {
  id: string;
  projectId: string;
  nodeCode: string;
  nodeName: string;
  parentId?: string;
  budgetAmount: number;
  committedAmount: number;
  actualAmount: number;
}

export interface BusinessPartner {
  id: string;
  bpCode: string;
  name: string;
  taxId: string;
  type: 'CUSTOMER' | 'VENDOR' | 'SUBCONTRACTOR' | 'BOTH';
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  bankName: string;
  bankCode: string;
  bankAccount: string;
  paymentTermsDays: number;
  isHighRisk: boolean;
  riskReason?: string;
  companyId: string;
  isDeleted: boolean;
  version: number;
}

export interface Item {
  id: string;
  itemCode: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  standardCost: number;
  isDeleted: boolean;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  projectId: string;
  customerId: string;
  customerName: string;
  companyId: string;
  currency: string;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  discountAmount: number;
  currentRevision: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
  validityDate: string;
  isDeleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationRevision {
  id: string;
  quotationId: string;
  revisionCode: string; // REV-A, REV-B
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  isWinning: boolean;
  lostReason?: string;
  createdAt: string;
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  revisionCode: string;
  itemType: 'NORMAL' | 'DEDUCTION'; // 憲法規範：粉紅扣款折讓
  itemName: string;
  spec: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  remark?: string;
}

export interface QuotationBillingMilestone {
  id: string;
  quotationId: string;
  stageIndex: number;
  stageName: string;
  percentage: number; // 請款比例總和為 100
  estimatedDate?: string;
  amount: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  companyId: string;
  projectId: string;
  vendorId: string;
  currency: string;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  discountAmount: number;
  retentionDeductionAmount: number;
  postedTaxRate: number;
  counterpartyNameSnapshot: string;
  counterpartyTaxIdSnapshot: string;
  projectNameSnapshot: string;
  isPrepaidDeduction: boolean;
  prepaidDeductionAmount: number;
  status: 'DRAFT' | 'APPROVED' | 'POSTED' | 'VOIDED';
  isDeleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  itemCode: string;
  itemName: string;
  spec: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export interface Subcontract {
  id: string;
  contractCode: string;
  projectId: string;
  subcontractorId: string;
  companyId: string;
  subcontractorName: string;
  projectName: string;
  contractName: string;
  totalAmount: number;
  retentionRate: number; // e.g. 10 (%)
  prepaidAmount: number;
  prepaidRemaining: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'CLOSED' | 'TERMINATED';
}

export interface Valuation {
  id: string;
  valuationNumber: string;
  subcontractId: string;
  projectId: string;
  subcontractorId: string;
  companyId: string;
  periodIndex: number; // 第幾期估驗
  periodName: string;
  cumulativeProgressPct: number;
  grossAmount: number;
  retentionDeductionAmount: number;
  prepaidDeductionAmount: number;
  otherDeductionAmount: number;
  netPayableAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'VOIDED';
  counterpartyNameSnapshot: string;
  projectNameSnapshot: string;
  isDeleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ValuationItem {
  id: string;
  valuationId: string;
  itemType: 'NORMAL' | 'DEDUCTION'; // 粉紅扣款
  itemName: string;
  unit: string;
  contractQuantity: number;
  contractUnitPrice: number;
  previousQty: number;
  currentQty: number;
  currentAmount: number;
  remark?: string;
}

export interface AccountPayable {
  id: string;
  apNumber: string;
  sourceTable: 'PURCHASE_ORDER' | 'VALUATION';
  sourceId: string;
  companyId: string;
  vendorId: string;
  vendorName: string;
  originalAmount: number;
  appliedAmount: number;
  remainingAmount: number;
  dueDate: string;
  invoiceNumber?: string;
  taxReportingCompanyId?: string;
  status: 'OPEN' | 'PARTIAL' | 'PAID' | 'VOIDED';
  createdAt: string;
}

export interface AccountReceivable {
  id: string;
  arNumber: string;
  projectId: string;
  customerId: string;
  customerName: string;
  companyId: string;
  amount: number;
  appliedAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: 'OPEN' | 'PARTIAL' | 'COLLECTED' | 'VOIDED';
  createdAt: string;
}

export interface BankCheck {
  id: string;
  checkNumber: string;
  type: 'PAYABLE' | 'RECEIVABLE'; // 應付票據 / 應收票據
  companyId: string;
  counterpartyName: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  bankName: string;
  status: 'ISSUED' | 'DEPOSITED' | 'CLEARED' | 'VOIDED' | 'BOUNCED';
  voidReason?: string;
  notes?: string;
}

export interface OwnerContract {
  id: string;
  contractNumber: string;
  projectId: string;
  projectName: string;
  ownerName: string;
  ownerTaxId: string;
  totalAmount: number;
  retentionRate: number;
  signDate: string;
  status: 'ACTIVE' | 'COMPLETED' | 'TERMINATED';
}

export interface SystemFile {
  id: string;
  targetTable: string;
  targetId: string;
  fileName: string;
  originalName?: string;
  savedName?: string;
  fileSizeBytes: number;
  mimeType: string;
  fileCategory: string;
  storagePath: string; // POSIX 相對路徑如 'storage/public_docs/2026/10/uuid.pdf'
  isEncrypted: boolean; // 是否為敏感文件採 AES-256-GCM 加密存放
  fileHash: string; // SHA-256 指紋
  companyId?: string;
  uploadTime: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnualArchiveSnapshot {
  id: string;
  archiveYear: number;
  archiveFileName: string;
  relativePath: string;
  recordCount: number;
  fileSizeBytes: number;
  fileHash: string;
  isSealed: boolean;
  sealedAt: string;
  sealedBy: string;
  description?: string;
}

export type RestoreStrategy = 'SKIP' | 'UPDATE';

export interface BackupTimeFilter {
  mode: 'ALL' | 'YEAR' | 'RANGE';
  year?: number;
  startDate?: string;
  endDate?: string;
}

export interface ModularBackupPackage {
  formatVersion: '1.0';
  exportDate: string;
  exportedBy: string;
  targetModules: string[];
  timeFilter?: BackupTimeFilter;
  tables: Record<string, any[]>;
  recordCount: number;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  details?: string[];
}

// 營運戰情室財務指標模型 (Phase 10 & 憲法第六篇)
export interface CashFlowMetrics {
  currentBankBalance: number;
  projectedAR: number;
  projectedAP: number;
  unclearedChecks: number;
  estimatedVAT: number;
  recurringExpenses: number;
  projectedNetCash: number;
  pendingChangeOrdersAmount: number; // 待補簽追加減工程風險金額
}
