// 財務收支、AP 對帳、AR 請款、銀行支票、401 營業稅與資金池型別定義

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

export type InvoiceFormat = 'THREE_PART' | 'TWO_PART'; // 三聯式 (B2B附統編) / 二聯式 (B2C含稅免統編)
export type InvoiceIssueMode = 'DELIVERED' | 'SELF_RETAINED'; // 交付業主 / 自主開立留存報稅(未交業主·稅金公司自理)

export type InvoiceCategory401 =
  | 'SALES_THREE_PART' // 銷貨發票-三聯式
  | 'SALES_TWO_PART' // 銷貨發票-二聯式
  | 'SALES_ALLOWANCE' // 銷貨折讓明細 (-)
  | 'PURCHASE_GOODS' // 進貨發票明細
  | 'FUEL_EXPENSE' // 油單+三聯單發票明細
  | 'TELECOM_EXPENSE' // 電話費明細
  | 'ELECTRICITY_EXPENSE' // 台灣電力公司電費
  | 'OTHER_EXPENSE_INV' // 費用發票明細
  | 'FIXED_ASSET' // 固定資產費用
  | 'PURCHASE_RETURN' // 進貨退出明細 (-)
  | 'PURCHASE_ALLOWANCE' // 進貨折讓明細 (-)
  | 'NON_DEDUCTIBLE_INV' // 不列入401申報發票
  | 'RECEIPT_EXEMPT' // 收據明細 (郵資/免用發票)
  | 'PERSONAL_VOUCHER'; // 個人憑證 (非公司營業稅帳)

export interface ArLineItem {
  id: string;
  itemName: string;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  taxMode: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT';
}

export interface AccountReceivable {
  id: string;
  arNumber: string;
  projectId: string;
  projectName?: string;
  customerId: string;
  customerName: string;
  companyId: string;
  title?: string; // 請款期別/摘要說明
  lineItems?: ArLineItem[]; // 多工項對外請款明細 (可各列分別含稅/免稅)
  netAmount?: number; // 未稅請款額
  taxType?: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT';
  taxAmount?: number; // 營業稅額
  amount: number; // 應收含稅總額
  appliedAmount: number;
  remainingAmount: number;
  hasInvoice?: boolean; // 是否需開立銷項發票 (true 嚴格僅能入開票公司戶; false 可入老闆私帳或現金)
  invoiceFormat?: InvoiceFormat; // 發票聯式：三聯式 (B2B) / 二聯式 (B2C含稅免統編)
  invoiceIssueMode?: InvoiceIssueMode; // 發票交付方式：交付業主 / 自主留存報稅
  invoiceNumber?: string; // 銷項發票字軌號碼
  invoiceDate?: string; // 發票開立日期
  dueDate: string;
  status: 'OPEN' | 'PARTIAL' | 'COLLECTED' | 'VOIDED';
  notes?: string;
  bouncedCheckNumber?: string; // 業主支票退票警訊號碼
  bouncedReason?: string;
  bouncedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ArCollectionRecord {
  id: string;
  arId: string;
  arNumber?: string;
  companyId: string;
  collectionMethod: 'TT' | 'CHECK' | 'CASH' | 'SUSPENSE';
  bankAccountId: string;
  bankAccountName?: string;
  amount: number; // 沖銷應收帳款金額
  feeAmount: number; // 銀行手續費/匯費/少收折讓扣款
  overpaymentAmount?: number; // 超付溢收金額 (實際收款 > 沖銷應收)
  netReceivedAmount: number; // 實際入帳金額 (amount - feeAmount + overpaymentAmount)
  checkNumber?: string;
  checkDueDate?: string;
  drawerBank?: string;
  receivedDate: string;
  suspenseId?: string;
  status: 'POSTED' | 'PENDING_CLEARANCE' | 'BOUNCED' | 'VOIDED';
  notes?: string;
  createdBy?: string;
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
  drawerBank?: string;
  paymentId?: string;
  expectedClearanceDate?: string;
  actualClearanceDate?: string;
  status: 'ISSUED' | 'DEPOSITED' | 'CLEARED' | 'VOIDED' | 'BOUNCED';
  voidReason?: string;
  notes?: string;
  replacesCheckNumber?: string; // 換票替代之原支票號碼 (退票/作廢後重開關聯)
  reconciledApId?: string; // 關聯之應付對帳單 ID
  reconciledArId?: string; // 關聯之應收帳款 ID
}

export type ReconciliationStatus = 'DRAFT' | 'APPROVED' | 'RETURNED' | 'PAID' | 'VOIDED';

export interface AccountsPayableReconciliation {
  id: string;
  reconciliationNumber: string; // REC-YYYYMM-0001
  companyId: string; // 申報法人
  vendorId: string; // 廠商夥伴 ID
  vendorName?: string; // 廠商名稱快照
  billingPeriod: string; // 對帳期別 YYYY-MM
  inboundTotalAmount: number; // 本期勾選進貨原始金額
  discountAmount: number; // 折讓抹零 (正數存儲，粉紅視覺)
  taxType: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT'; // 外加 / 內含 / 免稅
  taxAmount: number; // 本期營業稅額
  netPayableAmount: number; // 本期應付淨額
  invoiceNumber?: string; // 發票字軌
  hasInvoice: boolean; // 是否具備發票
  paymentDueDate: string; // 預計付款日
  designatedPaymentMethod?: PaymentMethod; // 付款方式快照 (CHECK / TT / CASH)
  designatedBankAccountId?: string; // 出款銀行帳戶 ID
  designatedBankAccountName?: string; // 出款銀行帳戶快照
  designatedCheckNumber?: string; // 預定支票號碼
  paymentTermNotes?: string; // 會計付款條件與出款說明備註
  isBossAdvance?: boolean; // 特例：有發票時由老闆私帳代墊 (股東往來)
  bouncedCheckNumber?: string; // 退票原支票號碼 (待重付警訊)
  bouncedReason?: string; // 退票原因
  bouncedAt?: string; // 退票記錄時間
  returnedReason?: string; // 出納退回會計重算原因
  returnedBy?: string; // 退回之出納人員
  returnedAt?: string; // 退回時間
  status: ReconciliationStatus;
  reconciledBy?: string; // 對帳人員
  approvedBy?: string; // 覆核主管
  disbursedAt?: string; // 實際放款日
  notes?: string;
  receiptIds?: string[]; // 勾選之進貨單 ID 清冊
  isDeleted?: boolean;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type PaymentStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'VOIDED' | 'DISPUTED';
export type PaymentMethod = 'TT' | 'CHECK' | 'CASH';

export interface PaymentRecord {
  id: string;
  paymentNo: string; // PAY-YYYYMM-0001
  companyId: string; // 集團法人
  currency: string; // TWD
  bankAccountId: string; // 出款帳戶 (含 BOSS_POCKET 老闆口袋)
  bankAccountName?: string;
  targetBankAccountId?: string; // 供內部資金調撥 FUND_TRANSFER
  partnerId?: string; // 受款夥伴
  partnerName?: string;
  customVendorName?: string; // 零星手打廠商
  paymentMethod: PaymentMethod;
  isReversal: boolean; // 全紅迴轉單標記
  documentDate: string; // 原始發生日/發票真實日
  postingDate: string; // 會計入帳日 (受關帳鎖定)
  totalAmount: number; // 實付總額期望值
  status: PaymentStatus;
  isReconciled: boolean; // 是否完成銀行存摺調節
  reconciledAt?: string;
  voidReason?: string;
  notes?: string;
  isBossAdvance?: boolean; // 是否由老闆私帳特例代墊 (股東往來)
  isDeleted?: boolean;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  lineItems?: PaymentLineItem[];
  checkDetail?: BankCheck;
}

export interface PaymentLineItem {
  id: string;
  paymentId: string;
  sourceType: 'AP' | 'PO' | 'SUB' | 'EXP'; // 應付對帳單 / 採購 / 估驗 / 雜支
  sourceId: string; // 對應來源單據 ID
  sourceNumber?: string; // 來源單號快照
  itemType: 'STANDARD' | 'DEDUCTION'; // 常規加項 vs 粉紅代扣減項
  appliedAmount: number; // 本次實付沖抵額 (正數)
  feeAmount: number; // 銀行手續費 (預設 30)
  isFeeAbsorbedByCompany: boolean; // 跨行匯費是否由公司吸收
  discountAmount: number; // 尾數折讓
  offsetExpenseId?: string; // 專案代墊費用 ID (專案成本還原)
  withholdingTaxAmt?: number; // 代扣所得稅
  nhiAmt?: number; // 二代健保補充保費
  projectId?: string; // 實際費用歸屬專案
  notes?: string;
}

export interface Invoice {
  id: string;
  invoiceType: 'INPUT' | 'OUTPUT'; // 進項 / 銷項
  invoiceFormat?: InvoiceFormat; // 三聯式 / 二聯式
  invoiceIssueMode?: InvoiceIssueMode; // 交付業主 / 自主留存報稅
  invoiceCategory?: InvoiceCategory401; // 401 憑證細分類別 (進貨/油單/電話/電費/收據/個人/折讓...)
  taxPeriod?: string; // 雙月申報期別 e.g. '2026-01-02'
  presetLabel?: string; // 常用門號或電費棟別地址標籤
  notes?: string;
  invoiceNumber: string; // 發票字軌
  invoiceDate: string; // 開立日
  taxReportingCompanyId: string; // 申報法人
  issuerTaxId: string; // 開立方統編
  issuerName?: string;
  buyerTaxId: string; // 買受方統編
  buyerName?: string;
  netAmount: number; // 未稅銷售額
  taxAmount: number; // 營業稅額
  totalAmount: number; // 含稅總額
  linkedProjectId?: string;
  linkedArId?: string;
  status: 'VALID' | 'VOIDED' | 'CREDITED';
  createdAt?: string;
  updatedAt?: string;
}

export interface PlannedInvoice {
  id: string;
  companyId: string;
  taxPeriod: string; // 模擬歸屬雙月期別 e.g. '2026-03-04'
  invoiceType: 'INPUT' | 'OUTPUT';
  invoiceCategory: InvoiceCategory401;
  invoiceFormat: InvoiceFormat;
  invoiceIssueMode: InvoiceIssueMode;
  partnerName: string;
  partnerTaxId?: string;
  linkedProjectId?: string;
  linkedArId?: string;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  status: 'PLANNED' | 'CONVERTED' | 'CANCELLED';
  convertedInvoiceId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyTaxSetting {
  id: string;
  companyId: string;
  taxYear: number;
  priorYearCreditTax: number; // 上年度結轉留抵稅額 (該年 1-2月 Code 8 起始值)
  phonePresets: string[]; // 本公司常用電話門號清單
  electricityPresets: string[]; // 本公司常用台電電表/地址清單
  personalVoucherLabel?: string; // 個人憑證抬頭標籤 (選填)
  updatedAt?: string;
}

export interface ProjectAdvanceReceipt {
  id: string;
  projectId: string;
  projectName?: string;
  customerId?: string;
  customerName: string;
  companyId: string;
  bankAccountId: string;
  bankAccountName?: string;
  collectionMethod: 'TT' | 'CHECK' | 'CASH';
  amount: number;
  receivedDate: string;
  sourceType: 'EARLY_LOAN' | 'OVERPAYMENT' | 'DEPOSIT';
  sourceArId?: string;
  sourceCheckNumber?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface BillingInvoiceMapping {
  id: string;
  invoiceId: string;
  sourceDocumentType: 'AP' | 'AR' | 'INBOUND' | 'PROGRESS_BILLING';
  sourceDocumentId: string;
  mappedAmount: number;
  createdAt?: string;
}

export interface SuspenseReceipt {
  id: string;
  companyId: string;
  bankAccountId: string;
  bankAccountName?: string;
  amount: number;
  allocatedAmount?: number; // 已分批認領金額
  remainingAmount?: number; // 尚餘可認領金額
  receivedDate: string;
  payerInfo: string; // 匯入來源戶名/附言
  isAllocated: boolean; // 是否已全數認領沖銷 (認領時才申報營業稅)
  allocatedToArId?: string;
  notes?: string;
  createdAt?: string;
}

export interface OverpaymentPoolRecord {
  id: string;
  companyId: string;
  partnerId: string;
  partnerName?: string;
  amount: number;
  resolvedBy?: 'CREDIT_MEMO' | 'REFUND';
  isResolved: boolean;
  notes?: string;
  createdAt?: string;
}

export interface CompanyBankAccount {
  id: string;
  companyId: string;
  bankCode: string;
  bankName: string;
  branchName?: string;
  accountNumber: string;
  accountName: string;
  isVirtualAccount: boolean; // 是否為虛擬專戶 (如 BOSS_POCKET 老闆口袋)
  initialBalance: number;
  currentBalance: number;
  currency: string;
  status: 'ACTIVE' | 'DISABLED';
  checkPrefix?: string; // 支票簿字軌代碼 (例如 CQ, CT, BOT)
  nextCheckNumber?: number; // 下一張支票連續號碼 (例如 882201)
  checkDigits?: number; // 支票位數 (例如 6 或 7 碼)
  supportsCheck?: boolean; // 是否支援開立支票 (預設 true)
  supportsTransfer?: boolean; // 是否支援銀行轉帳/電匯 (預設 true)
  paymentScheduleDays?: string; // 帳戶專屬固定每月付款日規則 (如 "7,17,27"，留空繼承系統預設)
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
