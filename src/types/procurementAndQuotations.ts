// 報價預算、採購訂購、現場進貨簽收、分包發包與工程估驗型別定義

export type QuotationPricingMode = 'HEADER_DISCOUNT' | 'UNIT_PRICE_ADJUSTMENT' | 'SHADOW_ALLOCATION';

export interface Quotation {
  id: string;
  quoteNumber: string;
  projectId: string;
  customerId: string;
  customerName: string;
  companyId: string;
  currency: string;
  pricingMode?: QuotationPricingMode; // 🛡️ 三軌並行議價模式：表頭折讓 / 單價微調 / 影子均攤備註
  customDiscountText?: string; // 軌道三專用自訂協議文字 (例如：「經雙方協議同意以 150,000 承製」)
  agreedTotalAmount?: number; // 軌道三約定成交總價
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  discountAmount: number;
  currentRevision: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED' | 'CONVERTED';
  validityDate: string;
  parentQuotationId?: string; // 歷史血緣追蹤 (Rule 4.1 深拷貝版本鏈)
  isDeleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationRevision {
  id: string;
  quotationId: string;
  revisionCode: string; // REV-A, REV-B, V_FINAL
  pricingMode?: QuotationPricingMode;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  discountAmount?: number;
  isWinning: boolean;
  lostReason?: string;
  createdAt: string;
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  revisionCode: string;
  itemType: 'NORMAL' | 'DEDUCTION'; // 憲法規範：粉紅扣款折讓 (DEDUCTION 嚴格存正數)
  itemName: string;
  spec: string;
  quantity: number;
  unit: string;
  unitPrice: number; // 對外報價單價 (最多 2 位小數)
  lineTotal: number; // 明細小計
  estimatedUnitCost?: number; // 預估單位成本
  effectiveUnitPrice?: number; // 歸一化影子有效單價 (折讓後有效退款基準，防止追加減溢退)
  isAwarded?: boolean; // 🛡️ 部分得標開關 (Rule 4.1，V_FINAL 決選版未得標不刪除)
  lostReason?: string; // 失標原因 (如：業主預算不足砍項、非關鍵次要項目等)
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

// 現場進貨簽收模組 (Inbound Goods Management - 直入案場成本 A 模式)
export type InboundReceiptStatus = 'DRAFT' | 'POSTED' | 'VOIDED';
export type InboundBillingStatus = 'PENDING_BILLING' | 'BILLED';

export interface InboundReceipt {
  id: string;
  receiptNumber: string; // INB-202610-0001
  companyId: string;
  projectId: string; // A 模式：直入案場成本
  projectNameSnapshot?: string;
  projectCodeSnapshot?: string;
  vendorId: string; // 供應商夥伴 ID
  vendorNameSnapshot?: string;
  vendorTaxIdSnapshot?: string;
  deliveryNoteNumber: string; // 廠商送貨單號 / 現場簽收單號 (選填)
  orderNumber?: string; // 訂貨單號 / 採購單號 (選填，不強制要求輸入)
  receivedDate: string; // 簽收日期 YYYY-MM-DD
  receivedBy: string; // 現場點收同仁姓名
  totalAmount: number; // 未稅合計金額（明細小計加總）
  billingStatus: InboundBillingStatus; // PENDING_BILLING | BILLED
  reconciliationId?: string; // 會計對帳單勾稽外鍵錨點 (未請款為空)
  reconciliationNumber?: string; // 對帳單號快照
  purchaseOrderId?: string; // 預留未來採購單關聯
  status: InboundReceiptStatus; // DRAFT | POSTED | VOIDED
  attachmentFileId?: string; // 現場紙本簽收單照片/PDF附件 ID
  attachmentFileName?: string;
  notes?: string;
  isDeleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  items?: InboundReceiptItem[];
}

export interface InboundReceiptItem {
  id: string;
  receiptId: string;
  itemCode?: string;
  itemName: string;
  spec?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string;
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
