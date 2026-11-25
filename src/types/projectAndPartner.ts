// 案場工程、協力廠商字典與商業夥伴（業主/廠商）型別定義
import type { AddressHistoryEntry } from './commonAndOrg';

export interface Project {
  id: string;
  projectCode: string;
  name: string;
  ownerName: string;
  ownerTaxId: string;
  buildingType?: string; // 建造建物類型 (如: 集合住宅大樓, 商辦金融大樓, 廠辦與工業廠房...)
  workScope?: string; // 工作內容 / 承攬性質 (如: 統包新建工程, 建築結構主體工程, 連續壁與擋土排樁工程...)
  contractAmount: number;
  budgetAmount: number;
  committedCost: number;
  actualCost: number;
  startDate: string;
  endDate: string;
  status: 'PLANNING' | 'ACTIVE' | 'LOCKED' | 'COMPLETED';
  isLocked: boolean;
  companyId: string;
  budgetPartners?: ProjectBudgetPartner[]; // 預計協力廠商列表 (支援多筆、預估金額與進貨請款連動)
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
  postalCode?: string;
  city?: string;
  district?: string;
  streetAddress?: string;
  addressHistory?: AddressHistoryEntry[];
  contactPerson: string;
  contactPhone: string;
  permitNumber?: string; // 建造執照字號
  developerName?: string; // 起造人全銜 (業主/起造人代表人)
  architect?: string; // 設計監造人 (建築師事務所 / 結構技師)
  constructor?: string; // 承造人 (營造廠全銜 / 專任工程人員)
  shopDrawingVendorId?: string; // 拆圖廠商 ID (商業夥伴 - 向下相容保留)
  shopDrawingVendorName?: string; // 拆圖廠商全銜快照
  landNumber?: string; // 基地座落地號
}

export interface BuildingCategoryItem {
  id: string;
  name: string; // 第二階層小項名稱 (如: 鐵皮倉庫, 鋼構建築, 農業設施, 鋼梯, 屋頂浪板...)
  isActive: boolean;
  sortOrder: number;
}

export interface BuildingCategoryGroup {
  id: string;
  name: string; // 第一階層大項名稱 (如: 建物類, 其他...)
  sortOrder: number;
  items: BuildingCategoryItem[];
}

// 🏛️ 協力廠商二階段階層字典 (第一階層: 工料類別 ➔ 第二階層: 已建檔廠商公司名稱)
export interface SubcontractorVendorItem {
  id: string; // 廠商 ID (對應 business_partners)
  name: string; // 公司名稱
  bpCode?: string; // 廠商編號 (如: VEND-001)
  categorySub?: string; // 叫料項目 / 供應料件規格備註 (例如: 專供 H 型鋼、C 型鋼、板材裁切加工)
  categoryTags?: string[]; // 此廠商擁有的所有工料分類標籤 (支援多角化)
  contactPerson?: string; // 聯絡窗口
  phone?: string; // 電話
  mobile?: string; // 行動電話
  isActive?: boolean;
}

export interface SubcontractorCategoryGroup {
  id: string;
  category: string; // 第一階層: 工料類別 (例如: 鋼材, 屋頂浪板, 螺絲五金, 混凝土, 拆圖, 鋼構吊裝, 門窗五金, 機電消防, 泥作裝修, 其他...)
  vendors: SubcontractorVendorItem[];
}

export interface ProjectBudgetPartner {
  id: string;
  projectId: string;
  partnerId: string;
  partnerName: string;
  workScope: string; // 預計承攬工項 / 供應料別 (如: 鋼構加工, 鋼筋供料, 模板工程, 施工拆圖...)
  estimatedAmount: number; // 案場預估發包/採購金額 (NT$)
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface PartnerAddress {
  id: string;
  partnerId: string;
  addressType: 'COMMUNICATION' | 'REGISTERED' | 'FACTORY' | 'SITE_OFFICE' | 'OTHER';
  label?: string; // 自訂標籤如: "總部通訊", "林口一廠", "工務所" (預設一般寫「地址」)
  postalCode?: string; // 3 碼中華郵政郵遞區號 (如 100, 248)
  city?: string; // 縣市 (如 臺北市, 新北市)
  district?: string; // 鄉鎮市區 (如 中正區, 五股區)
  streetAddress?: string; // 街道巷弄號樓等詳細路段 (拆分輸入)
  fullAddress: string;
  isHistorical?: boolean; // 是否封存為歷史靜態參考地址
  archivedAt?: string; // 封存日期時間
  archiveNote?: string; // 封存備註
  isDeleted: boolean;
}

export interface PartnerContact {
  id: string;
  partnerId: string;
  contactType: 'PRIMARY' | 'FINANCE' | 'ENGINEERING' | 'SALES' | 'PURCHASE' | 'OTHER';
  name: string;
  title?: string; // 職稱如: 負責人、工務主任、會計主管、業務窗口
  phone?: string; // 總機/座機
  mobile?: string; // 行動電話
  extension?: string; // 分機號碼
  email?: string;
  notes?: string;
  isDeleted: boolean;
}

export interface PartnerBusinessCard {
  id: string;
  partnerId: string;
  name: string; // 姓名 (名片上稱謂)
  title?: string; // 職稱
  companyName?: string; // 名片公司全稱
  phone?: string; // 總機電話
  mobile?: string; // 行動電話
  email?: string; // 電子信箱
  address?: string; // 名片地址
  exchangeDate?: string; // 交換名片日期 (YYYY-MM-DD)
  cardFrontUrl?: string; // 名片正面圖檔或 PDF
  cardBackUrl?: string; // 名片背面圖檔
  cardFileType?: 'IMAGE' | 'PDF';
  notes?: string; // 備註
  createdAt?: string;
}

export interface StoredMediaFile {
  id: string;
  name: string;
  dataUrl: string; // Base64 或 Data URL (圖片或 PDF)
  fileType: 'IMAGE' | 'PDF';
  sizeBytes?: number;
  uploadedAt: string;
}

export interface BPBankAccount {
  id: string;
  bpId: string;
  bankCode: string; // 3 碼銀行機構代碼 (如 004, 013, 822)
  bankName: string; // 銀行名稱
  branchCode?: string; // 4 碼分行代碼
  branchName?: string; // 分行名稱
  accountNumber: string; // 帳號
  accountName: string; // 戶名
  isPrimary: boolean;
  passbookFileId?: string; // 存摺封面照片附件 ID
  passbookFileData?: string; // 存摺封面預覽資料 (Base64 / Data URL)
  passbookFiles?: StoredMediaFile[]; // 支援多張存摺封面、內頁或印鑑卡檔案
  isDeleted?: boolean;
}

export interface PartnerChequeRecord {
  id: string;
  partnerId: string;
  direction: 'RECEIPT' | 'PAYMENT'; // RECEIPT: 收受支票, PAYMENT: 開出支票
  bankCode: string; // 付款金融機構代碼 (3 碼)
  bankName: string; // 付款銀行名稱
  branchName?: string; // 付款分行名稱
  accountNumber: string; // 支票扣款帳號
  checkNumber: string; // 支票號碼
  receivedDate?: string; // 收到支票時間 (收票時) 或 寄出給付時間 (開票時)
  issueDate: string; // 支票票面發票日 (約定可兌換提示日 YYYY-MM-DD)
  dueDate: string; // 支票到期日 / 票期 (可兌換時間 / 提示兌現日 YYYY-MM-DD)
  statutoryExpiryDate?: string; // 票據法法定消滅時效日 (發票日+1年，系統自動計算提示)
  cashableDate?: string; // 支票可兌換時間 (同到期提示日)
  amount: number; // 支票金額 (嚴格正數)
  payeeName: string; // 受款人抬頭
  isNonNegotiable: boolean; // 是否禁止背書轉讓 (true / false)
  chequeFileId?: string; // 支票影本 / PDF 掃描檔附件 ID
  chequeFileData?: string; // 支票影本縮圖或預覽 Data URL
  chequeFiles?: StoredMediaFile[]; // 支援正反面多影本或 PDF 掃描檔
  status: 'ISSUED' | 'RECEIVED' | 'DEPOSITED' | 'CLEARED' | 'BOUNCED' | 'VOIDED'; // 已開立/已收受/已託收/已兌現/退票/作廢
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerServiceCategoryItem {
  id: string;
  main: string;
  sub: string;
}

export interface BusinessPartner {
  id: string;
  bpCode: string;
  name: string;
  taxId: string; // 8 碼公司統編 或 10 碼自然人身分證號
  entityType?: 'CORPORATION' | 'NATURAL_PERSON'; // 公司法人 vs 自然人 (地主/工班師傅)
  isIndividual?: boolean; // 是否為個人自然人 (個人業主不強制填身分證)
  type: 'CUSTOMER' | 'VENDOR' | 'SUBCONTRACTOR' | 'BOTH';
  isCustomer?: boolean; // 具備業主 (客戶/發包方) 身分
  isVendor?: boolean; // 具備合作廠商 (協力包商/材料商) 身分
  convertedFromVendorId?: string; // 若此業主由合作廠商「一鍵引薦轉換加入變業主」，記錄來源廠商 ID (SSoT)
  serviceCategoryMain?: string; // 合作廠商主要工項大類 (主要)
  serviceCategorySub?: string; // 合作廠商主要工項子類 (主要)
  categoryMain?: string; // 第一階工料大類 (主要)
  categorySub?: string; // 第二階專業工項 / 叫料規格備註 (對接案場工程發包字典)
  categoryTags?: string[]; // 支援加入 2 種以上工料分類標籤 (例如: ['鋼材', '螺絲五金', '屋頂浪板'])
  serviceCategories?: PartnerServiceCategoryItem[]; // 支援加入多項多元工種清單！
  ownerIdNumber?: string; // 負責人身分證字號 (防弊/防換殼)
  representative?: string; // 負責人姓名
  contactPerson: string; // 主要聯絡人
  phone: string; // 主要聯絡電話
  email: string;
  address: string; // 主要通訊地址
  bankName: string;
  bankCode: string;
  bankAccount: string;
  bankAccountName?: string;
  bankFeePayer?: 'COMPANY' | 'PARTNER'; // 手續費/匯費負擔方：預設 COMPANY (公司自行吸收，請款100全額匯100不內扣)
  hasInvoice?: boolean; // 是否可開立三聯式統一發票 (自然人工班可為否)
  paymentTermsDays: number; // 付款條件天數 (如 30 天, 45 天, 60 天)
  paymentMethodNotes?: string; // 付款方式純文字備註 (如: 固定匯台銀帳戶、只收公司票)
  isHighRisk: boolean;
  riskReason?: string;
  currentScore?: number; // 廠商評鑑分數 (0 ~ 100)
  status?: 'ACTIVE' | 'PENDING' | 'WARNING' | 'SUSPENDED' | 'PAYMENT_LOCKED';
  companyId: string;
  isDeleted: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;

  // 關聯子集合 (前端多分頁或展開檢視)
  addresses?: PartnerAddress[];
  contacts?: PartnerContact[];
  bankAccounts?: BPBankAccount[];
  chequeRecords?: PartnerChequeRecord[];
  businessCards?: PartnerBusinessCard[];
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
