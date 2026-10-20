import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Users2,
  Building2,
  HardHat,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CreditCard,
  Receipt,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  ArrowRightLeft,
  X,
  Upload,
  Eye,
  Trash2,
  FolderLock,
  Edit,
  Save,
  HelpCircle,
  Sparkles,
  Layers,
  Landmark,
  UserCheck,
  Ban,
  FileCheck,
  Tag,
  Download,
  ZoomIn,
  RefreshCw,
  Info,
  Table as TableIcon,
  LayoutGrid,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  Contact,
  Scale
} from 'lucide-react';

import {
  BusinessPartner,
  PartnerAddress,
  PartnerContact,
  BPBankAccount,
  PartnerChequeRecord,
  PartnerServiceCategoryItem,
  StoredMediaFile,
  PartnerBusinessCard
} from '../types/erp';

import {
  TAIWAN_BANKS,
  getBankByCode,
  searchTaiwanBanks,
  BankInfo
} from '../utils/taiwanBanks';

import {
  ENGINEERING_CATEGORIES
} from '../utils/engineeringCategories';

import {
  validateTaiwanTaxId,
  validateTaiwanNationalId
} from '../utils/taiwanValidation';

import {
  TAIWAN_CITIES,
  getDistrictsByCity,
  getPostalCode,
  lookupPostalCode
} from '../utils/taiwanPostalCodes';

import {
  getAllBusinessPartners,
  getBusinessPartnerById,
  saveBusinessPartner,
  deleteBusinessPartner,
  convertVendorToClient,
  savePartnerChequeRecord,
  deletePartnerChequeRecord,
  savePartnerBusinessCard,
  deletePartnerBusinessCard
} from '../db/sqlite';

import { useAuth } from '../context/AuthContext';
import { TaiwanAddressPicker, TaiwanAddressValue } from './widgets/TaiwanAddressPicker';
import { TaiwanIdTaxValidatorWidget } from './widgets/TaiwanIdTaxValidatorWidget';
import { TaiwanBankPickerWidget } from './widgets/TaiwanBankPickerWidget';
import { MediaPreviewLightbox, MediaPreviewItem } from './widgets/MediaPreviewLightbox';
import { ChequeDetailModal } from './widgets/ChequeDetailModal';
import { MiniAppsWorkspace } from './MiniAppsWorkspace';
import { AttachmentUploader } from './attachments/AttachmentUploader';

interface BusinessPartnerWorkspaceProps {
  onNotify?: (message: string) => void;
}

// 圖片壓縮輔助工具 (將上傳圖片壓縮至 1200px 寬以內，避免 localStorage 爆量)
function compressImageFile(file: File, maxWidth = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 讀取檔案為 Data URL (支援 PDF 與圖片)
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const BusinessPartnerWorkspace: React.FC<BusinessPartnerWorkspaceProps> = ({
  onNotify
}) => {
  const { currentUser, isSuperadmin, can } = useAuth();
  const canWrite = isSuperadmin || can('PARTNERS', 'write');

  // 資料列表狀態
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [activeTab, setActiveTab] = useState<'CLIENTS' | 'VENDORS'>('CLIENTS');

  // 雙視圖切換：預設以 500 筆海量資料首選的「緊湊表格模式 (TABLE)」
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // 篩選狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'NORMAL' | 'HIGH_RISK'>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [hasChequeFilter, setHasChequeFilter] = useState<'ALL' | 'HAS' | 'NONE'>('ALL');
  const [hasCardFilter, setHasCardFilter] = useState<'ALL' | 'HAS' | 'NONE'>('ALL');

  // 彈窗狀態
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<BusinessPartner | null>(null);
  const [activeEditorTab, setActiveEditorTab] = useState<
    'BASIC' | 'CATEGORY' | 'ADDRESSES' | 'CONTACTS' | 'BANK' | 'CHEQUES' | 'CARDS' | 'VAULT'
  >('BASIC');

  // 快速新增名片彈窗
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Partial<PartnerBusinessCard>>({});
  const [cardTargetPartner, setCardTargetPartner] = useState<BusinessPartner | null>(null);

  // 支票登記彈窗
  const [isChequeModalOpen, setIsChequeModalOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<Partial<PartnerChequeRecord>>({});

  // 支票詳細資訊點開彈窗 (解決備註無法查看之痛點)
  const [selectedChequeForDetail, setSelectedChequeForDetail] = useState<PartnerChequeRecord | null>(null);

  // 一鍵廠商轉業主彈窗
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');

  // 刪除確認彈窗 (In-App 自訂對話框，100% 杜絕 iframe window.confirm 攔截)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'PARTNER' | 'CHEQUE' | 'CARD';
    id: string;
    partnerId?: string;
    name: string;
    isBoth?: boolean;
    extraNotice?: string;
  } | null>(null);

  // 全螢幕高解析度 Lightbox (支援圖片與 PDF 完整預覽)
  const [lightboxMedia, setLightboxMedia] = useState<MediaPreviewItem | null>(null);

  // 浮動大圖預覽 (Hover Popover)
  const [hoverPreview, setHoverPreview] = useState<{
    url: string;
    title: string;
    isPdf: boolean;
    x: number;
    y: number;
  } | null>(null);

  // 通用小程式專區彈窗
  const [isMiniAppsModalOpen, setIsMiniAppsModalOpen] = useState(false);

  // 載入資料庫
  const reloadData = () => {
    const list = getAllBusinessPartners();
    setPartners(list);
  };

  useEffect(() => {
    reloadData();
  }, []);

  const showToast = (msg: string) => {
    if (onNotify) {
      onNotify(msg);
    }
  };

  // 統計數量
  const clientsCount = useMemo(() => partners.filter(p => p.isCustomer).length, [partners]);
  const vendorsCount = useMemo(() => partners.filter(p => p.isVendor).length, [partners]);

  // 工項大類細項連動
  const currentSubCategories = useMemo(() => {
    if (!selectedMainCategory || selectedMainCategory === 'ALL') return [];
    const group = ENGINEERING_CATEGORIES.find(g => g.mainCategory === selectedMainCategory);
    return group ? group.subCategories : [];
  }, [selectedMainCategory]);

  // 縣市行政區連動
  const currentDistricts = useMemo(() => {
    if (!selectedCity || selectedCity === 'ALL') return [];
    return getDistrictsByCity(selectedCity);
  }, [selectedCity]);

  // 篩選夥伴清單
  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      // 雙頁籤身分分流
      if (activeTab === 'CLIENTS' && !p.isCustomer) return false;
      if (activeTab === 'VENDORS' && !p.isVendor) return false;

      // 風險條件
      if (riskFilter === 'NORMAL' && p.isHighRisk) return false;
      if (riskFilter === 'HIGH_RISK' && !p.isHighRisk) return false;

      // 工項大類篩選 (業主曾接案工項 vs 廠商服務工項)
      if (selectedMainCategory !== 'ALL') {
        const hasMain =
          p.serviceCategoryMain === selectedMainCategory ||
          (p.serviceCategories || []).some(c => c.main === selectedMainCategory);
        if (!hasMain) return false;
      }

      // 細項工種篩選
      if (selectedSubCategory !== 'ALL') {
        const hasSub =
          p.serviceCategorySub === selectedSubCategory ||
          (p.serviceCategories || []).some(c => c.sub === selectedSubCategory);
        if (!hasSub) return false;
      }

      // 縣市篩選 (地址拆分)
      if (selectedCity !== 'ALL') {
        const matchCity =
          (p.address || '').includes(selectedCity) ||
          (p.addresses || []).some(
            a => a.city === selectedCity || (a.fullAddress || '').includes(selectedCity)
          );
        if (!matchCity) return false;
      }

      // 鄉鎮市區篩選
      if (selectedDistrict !== 'ALL') {
        const matchDist =
          (p.address || '').includes(selectedDistrict) ||
          (p.addresses || []).some(
            a => a.district === selectedDistrict || (a.fullAddress || '').includes(selectedDistrict)
          );
        if (!matchDist) return false;
      }

      // 票據過濾
      if (hasChequeFilter === 'HAS') {
        if (!p.chequeRecords || p.chequeRecords.length === 0) return false;
      } else if (hasChequeFilter === 'NONE') {
        if (p.chequeRecords && p.chequeRecords.length > 0) return false;
      }

      // 名片過濾
      if (hasCardFilter === 'HAS') {
        if (!p.businessCards || p.businessCards.length === 0) return false;
      } else if (hasCardFilter === 'NONE') {
        if (p.businessCards && p.businessCards.length > 0) return false;
      }

      // 關鍵字搜尋 (全欄位深層比對)
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const inCode = p.bpCode.toLowerCase().includes(q);
        const inName = p.name.toLowerCase().includes(q);
        const inTaxId = p.taxId.toLowerCase().includes(q);
        const inContact = p.contactPerson.toLowerCase().includes(q);
        const inPhone = p.phone.toLowerCase().includes(q);
        const inAddress = p.address.toLowerCase().includes(q);
        const inOwner = (p.representative || '').toLowerCase().includes(q);
        const inBank = (p.bankName || '').toLowerCase().includes(q);
        const inCategories = (p.serviceCategories || []).some(
          c => c.main.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q)
        );
        const inCheque = (p.chequeRecords || []).some(
          chk =>
            chk.checkNumber.toLowerCase().includes(q) ||
            (chk.notes || '').toLowerCase().includes(q) ||
            chk.bankName.toLowerCase().includes(q)
        );
        const inCards = (p.businessCards || []).some(
          card =>
            card.name.toLowerCase().includes(q) ||
            (card.title || '').toLowerCase().includes(q) ||
            (card.notes || '').toLowerCase().includes(q)
        );

        if (
          !inCode &&
          !inName &&
          !inTaxId &&
          !inContact &&
          !inPhone &&
          !inAddress &&
          !inOwner &&
          !inBank &&
          !inCategories &&
          !inCheque &&
          !inCards
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    partners,
    activeTab,
    searchTerm,
    selectedMainCategory,
    selectedSubCategory,
    riskFilter,
    selectedCity,
    selectedDistrict,
    hasChequeFilter,
    hasCardFilter
  ]);

  // 分頁計算
  const totalPages = useMemo(() => {
    if (pageSize >= 9999) return 1;
    return Math.max(1, Math.ceil(filteredPartners.length / pageSize));
  }, [filteredPartners.length, pageSize]);

  const pagedPartners = useMemo(() => {
    if (pageSize >= 9999) return filteredPartners;
    const start = (currentPage - 1) * pageSize;
    return filteredPartners.slice(start, start + pageSize);
  }, [filteredPartners, currentPage, pageSize]);

  // 當篩選改變時自動回到第 1 頁
  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeTab,
    searchTerm,
    selectedMainCategory,
    selectedSubCategory,
    riskFilter,
    selectedCity,
    selectedDistrict,
    hasChequeFilter,
    hasCardFilter
  ]);

  // 開啟新增夥伴主檔
  const handleOpenCreatePartner = () => {
    const isClientMode = activeTab === 'CLIENTS';
    const newId = `BP-${Date.now().toString().slice(-6)}`;
    const newCode = isClientMode
      ? `CUST-${(clientsCount + 1).toString().padStart(4, '0')}`
      : `VEND-${(vendorsCount + 1).toString().padStart(4, '0')}`;

    const newPartner: BusinessPartner = {
      id: newId,
      bpCode: newCode,
      name: '',
      taxId: '',
      entityType: 'CORPORATION',
      type: isClientMode ? 'CUSTOMER' : 'VENDOR',
      isCustomer: isClientMode,
      isVendor: !isClientMode,
      serviceCategoryMain: '泥作裝修工程',
      serviceCategorySub: '粉刷打底工',
      serviceCategories: [
        { id: `CAT-${Date.now()}-1`, main: '泥作裝修工程', sub: '粉刷打底工' }
      ],
      representative: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '100 臺北市中正區重慶南路一段122號',
      bankName: '臺灣銀行',
      bankCode: '004',
      bankAccount: '',
      bankAccountName: '',
      bankFeePayer: 'COMPANY',
      hasInvoice: true,
      paymentTermsDays: 30,
      isHighRisk: false,
      currentScore: 85,
      status: 'ACTIVE',
      companyId: 'COMP-01',
      isDeleted: false,
      version: 1,
      addresses: [
        {
          id: `PADDR-${Date.now()}-1`,
          partnerId: newId,
          addressType: 'COMMUNICATION',
          label: '主要營業地址',
          postalCode: '100',
          city: '臺北市',
          district: '中正區',
          fullAddress: '100 臺北市中正區重慶南路一段122號',
          isDeleted: false
        }
      ],
      contacts: [
        {
          id: `PCON-${Date.now()}-1`,
          partnerId: newId,
          contactType: 'PRIMARY',
          name: '',
          title: '業務聯絡人',
          phone: '',
          mobile: '',
          extension: '',
          email: '',
          notes: '',
          isDeleted: false
        }
      ],
      bankAccounts: [
        {
          id: `BACC-${Date.now()}-1`,
          bpId: newId,
          bankCode: '004',
          bankName: '臺灣銀行',
          accountNumber: '',
          accountName: '',
          isPrimary: true,
          passbookFiles: [],
          isDeleted: false
        }
      ],
      chequeRecords: [],
      businessCards: []
    };

    setEditingPartner(newPartner);
    setActiveEditorTab('BASIC');
    setIsEditorOpen(true);
  };

  // 開啟編輯夥伴主檔
  const handleEditPartner = (p: BusinessPartner) => {
    // 確保各陣列不為空
    setEditingPartner({
      ...p,
      serviceCategories: p.serviceCategories || [
        {
          id: `CAT-${Date.now()}-1`,
          main: p.serviceCategoryMain || '泥作裝修工程',
          sub: p.serviceCategorySub || '粉刷打底工'
        }
      ],
      addresses: p.addresses && p.addresses.length > 0 ? p.addresses : [
        {
          id: `PADDR-${Date.now()}-1`,
          partnerId: p.id,
          addressType: 'COMMUNICATION',
          label: '通訊地址',
          postalCode: '100',
          city: '臺北市',
          district: '中正區',
          fullAddress: p.address || '',
          isDeleted: false
        }
      ],
      contacts: p.contacts && p.contacts.length > 0 ? p.contacts : [
        {
          id: `PCON-${Date.now()}-1`,
          partnerId: p.id,
          contactType: 'PRIMARY',
          name: p.contactPerson || '',
          title: '主要聯絡人',
          phone: p.phone || '',
          mobile: '',
          extension: '',
          email: p.email || '',
          isDeleted: false
        }
      ],
      bankAccounts: p.bankAccounts && p.bankAccounts.length > 0 ? p.bankAccounts : [
        {
          id: `BACC-${Date.now()}-1`,
          bpId: p.id,
          bankCode: p.bankCode || '004',
          bankName: p.bankName || '臺灣銀行',
          accountNumber: p.bankAccount || '',
          accountName: p.bankAccountName || p.name,
          isPrimary: true,
          passbookFiles: [],
          isDeleted: false
        }
      ],
      chequeRecords: p.chequeRecords || [],
      businessCards: p.businessCards || []
    });
    setActiveEditorTab('BASIC');
    setIsEditorOpen(true);
  };

  // 儲存商業夥伴主檔
  const handleSavePartner = () => {
    if (!editingPartner) return;

    if (!editingPartner.name.trim()) {
      showToast('⚠️ 請填寫夥伴名稱 / 公司全稱！');
      return;
    }

    if (!editingPartner.taxId.trim()) {
      showToast('⚠️ 請填寫公司統一編號或身分證字號！');
      return;
    }

    // 檢核統編/身分證防呆
    if (editingPartner.entityType === 'NATURAL_PERSON') {
      const v = validateTaiwanNationalId(editingPartner.taxId);
      if (!v.isValid) {
        showToast(`⚠️ 身分證字號格式不符：${v.message}`);
        return;
      }
    } else {
      const v = validateTaiwanTaxId(editingPartner.taxId);
      if (!v.isValid) {
        showToast(`⚠️ 公司統一編號檢核不符：${v.message}`);
        return;
      }
    }

    try {
      const operator = currentUser?.fullName || '系統管理員';
      // 同步主要地址
      const primaryAddr = editingPartner.addresses?.[0];
      const partnerToSave = {
        ...editingPartner,
        address: primaryAddr?.fullAddress || editingPartner.address
      };

      saveBusinessPartner(partnerToSave, operator);
      reloadData();
      setIsEditorOpen(false);
      showToast(`🎉 成功儲存商業夥伴主檔：${editingPartner.name}`);
    } catch (err: any) {
      showToast('❌ 儲存失敗：' + (err.message || '未知錯誤'));
    }
  };

  // 執行刪除商業夥伴 (軟刪除或僅移除業主身分)
  const handleExecuteDeletePartner = (id: string, name: string, onlyRemoveCustomer: boolean = false) => {
    try {
      const operator = currentUser?.fullName || '系統管理員';
      const targetPartner = partners.find(p => p.id === id);

      if (onlyRemoveCustomer && targetPartner) {
        targetPartner.isCustomer = false;
        targetPartner.type = targetPartner.isVendor ? 'VENDOR' : 'CUSTOMER';
        saveBusinessPartner(targetPartner, operator);
        showToast(`✅ 已自業主名冊中移除「${name}」（已保留其合作廠商身分）`);
      } else {
        deleteBusinessPartner(id, operator);
        showToast(`🗑️ 已成功刪除商業夥伴：「${name}」`);
      }

      // 直接自當前 React state 移除，確保畫面 100% 即時刷新，杜絕延遲
      setPartners(prev =>
        prev.filter(p => (onlyRemoveCustomer ? p.id !== id || p.isVendor : p.id !== id))
      );
      reloadData();
      setDeleteConfirmTarget(null);
    } catch (err: any) {
      showToast('❌ 刪除失敗：' + (err.message || '未知錯誤'));
    }
  };

  // 執行「一鍵自合作廠商引薦變業主」
  const handleExecuteConvert = (vendor: BusinessPartner) => {
    try {
      const operator = currentUser?.fullName || '系統管理員';
      const converted = convertVendorToClient(vendor.id, operator);
      reloadData();
      setIsConvertModalOpen(false);
      showToast(`🎉 成功！已將合作廠商「${converted.name}」一鍵加入業主名冊！`);
    } catch (err: any) {
      showToast('❌ 轉換失敗：' + (err.message || '未知錯誤'));
    }
  };

  // 開啟登記支票往來
  const handleOpenAddCheque = (partnerId: string) => {
    const p = partners.find(item => item.id === partnerId) || editingPartner;
    const defaultDirection = activeTab === 'CLIENTS' ? 'RECEIPT' : 'PAYMENT';
    const bCode = p?.bankCode || '004';
    const bInfo = getBankByCode(bCode);
    const today = new Date().toISOString().slice(0, 10);

    setEditingCheque({
      direction: defaultDirection,
      partnerId,
      bankCode: bCode,
      bankName: bInfo?.name || p?.bankName || '臺灣銀行',
      branchName: '',
      accountNumber: p?.bankAccount || '',
      checkNumber: '',
      amount: 0,
      payeeName: defaultDirection === 'RECEIPT' ? '本公司' : p?.name || '',
      receivedDate: today,
      issueDate: today,
      dueDate: today,
      isNonNegotiable: true,
      status: 'RECEIVED',
      notes: '',
      chequeFiles: []
    });
    setIsChequeModalOpen(true);
  };

  // 儲存支票往來
  const handleSaveCheque = () => {
    if (!editingCheque.partnerId) {
      showToast('⚠️ 未指定商業夥伴！');
      return;
    }
    if (!editingCheque.checkNumber?.trim()) {
      showToast('⚠️ 請填寫支票號碼！');
      return;
    }
    if (!editingCheque.amount || editingCheque.amount <= 0) {
      showToast('⚠️ 支票金額必須為大於 0 之正數！');
      return;
    }

    try {
      const operator = currentUser?.fullName || '系統管理員';
      const recordToSave: PartnerChequeRecord = {
        id: editingCheque.id || `PCHK-${Date.now().toString().slice(-6)}`,
        partnerId: editingCheque.partnerId,
        direction: editingCheque.direction || 'RECEIPT',
        bankCode: editingCheque.bankCode || '004',
        bankName: editingCheque.bankName || '臺灣銀行',
        branchName: editingCheque.branchName || '',
        accountNumber: editingCheque.accountNumber || '',
        checkNumber: editingCheque.checkNumber.trim().toUpperCase(),
        receivedDate: editingCheque.receivedDate || new Date().toISOString().slice(0, 10),
        issueDate: editingCheque.issueDate || new Date().toISOString().slice(0, 10),
        dueDate: editingCheque.dueDate || new Date().toISOString().slice(0, 10),
        amount: Number(editingCheque.amount),
        payeeName: editingCheque.payeeName || '',
        isNonNegotiable: Boolean(editingCheque.isNonNegotiable),
        status: editingCheque.status || 'RECEIVED',
        notes: editingCheque.notes || '',
        chequeFileData: editingCheque.chequeFiles?.[0]?.dataUrl || editingCheque.chequeFileData,
        chequeFiles: editingCheque.chequeFiles || [],
        createdAt: editingCheque.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      savePartnerChequeRecord(recordToSave, operator);
      reloadData();

      // 同步更新當前正在編輯的夥伴狀態，確保編輯器內「6. 支票往來歷程」頁籤即時顯示
      if (editingPartner && editingPartner.id === editingCheque.partnerId) {
        const freshPartner = getBusinessPartnerById(editingCheque.partnerId);
        if (freshPartner) {
          setEditingPartner(freshPartner);
        }
      }

      setIsChequeModalOpen(false);
      showToast(`💳 已成功記錄支票往來：${editingCheque.checkNumber}`);
    } catch (err: any) {
      showToast('❌ 支票記錄儲存失敗：' + (err.message || '未知錯誤'));
    }
  };

  // 執行刪除支票往來
  const handleExecuteDeleteCheque = (chequeId: string, partnerId?: string) => {
    try {
      const operator = currentUser?.fullName || '系統管理員';
      deletePartnerChequeRecord(chequeId, operator);
      reloadData();
      if (partnerId && editingPartner && editingPartner.id === partnerId) {
        const fresh = getBusinessPartnerById(partnerId);
        if (fresh) setEditingPartner(fresh);
      }
      setDeleteConfirmTarget(null);
      if (selectedChequeForDetail?.id === chequeId) {
        setSelectedChequeForDetail(null);
      }
      showToast('🗑️ 已成功刪除支票記錄');
    } catch (err: any) {
      showToast('❌ 刪除失敗：' + (err.message || '未知錯誤'));
    }
  };

  // 開啟快速交換/上傳名片彈窗
  const handleOpenAddCard = (partner: BusinessPartner) => {
    setCardTargetPartner(partner);
    setEditingCard({
      partnerId: partner.id,
      name: partner.contactPerson || partner.name,
      title: '專案聯絡窗口',
      companyName: partner.name,
      phone: partner.phone || '',
      mobile: '',
      email: partner.email || '',
      address: partner.address || '',
      exchangeDate: new Date().toISOString().slice(0, 10),
      notes: '',
      cardFileType: 'IMAGE'
    });
    setIsCardModalOpen(true);
  };

  // 儲存名片
  const handleSaveCard = () => {
    if (!cardTargetPartner || !editingCard.partnerId) return;
    if (!editingCard.name?.trim()) {
      showToast('⚠️ 請填寫名片姓名！');
      return;
    }

    try {
      const operator = currentUser?.fullName || '系統管理員';
      const cardToSave: PartnerBusinessCard = {
        id: editingCard.id || `PBC-${Date.now().toString().slice(-6)}`,
        partnerId: editingCard.partnerId,
        name: editingCard.name.trim(),
        title: editingCard.title?.trim() || '',
        companyName: editingCard.companyName?.trim() || cardTargetPartner.name,
        phone: editingCard.phone?.trim() || '',
        mobile: editingCard.mobile?.trim() || '',
        email: editingCard.email?.trim() || '',
        address: editingCard.address?.trim() || '',
        exchangeDate: editingCard.exchangeDate || new Date().toISOString().slice(0, 10),
        cardFrontUrl: editingCard.cardFrontUrl,
        cardBackUrl: editingCard.cardBackUrl,
        cardFileType: editingCard.cardFileType || 'IMAGE',
        notes: editingCard.notes?.trim() || '',
        createdAt: editingCard.createdAt || new Date().toISOString()
      };

      savePartnerBusinessCard(cardToSave, operator);
      reloadData();

      // 若同時正在編輯該夥伴主檔，同步更新名片清單
      if (editingPartner && editingPartner.id === cardTargetPartner.id) {
        const fresh = getBusinessPartnerById(cardTargetPartner.id);
        if (fresh) setEditingPartner(fresh);
      }

      setIsCardModalOpen(false);
      showToast(`📇 已成功收存名片：「${cardToSave.name}」！`);
    } catch (err: any) {
      showToast('❌ 儲存名片失敗：' + (err.message || '未知錯誤'));
    }
  };

  // 刪除名片
  const handleExecuteDeleteCard = (cardId: string, partnerId?: string) => {
    try {
      const operator = currentUser?.fullName || '系統管理員';
      deletePartnerBusinessCard(cardId, operator);
      reloadData();
      if (partnerId && editingPartner && editingPartner.id === partnerId) {
        const fresh = getBusinessPartnerById(partnerId);
        if (fresh) setEditingPartner(fresh);
      }
      setDeleteConfirmTarget(null);
      showToast('🗑️ 已成功刪除名片');
    } catch (err: any) {
      showToast('❌ 刪除名片失敗：' + (err.message || '未知錯誤'));
    }
  };

  // 處理上傳多個檔案 (支援壓縮圖片與 PDF)
  const handleProcessUploadedFiles = async (
    files: FileList | null,
    onSuccess: (newFiles: StoredMediaFile[]) => void
  ) => {
    if (!files || files.length === 0) return;
    const uploadedList: StoredMediaFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      try {
        let dataUrl = '';
        if (isPdf) {
          dataUrl = await readFileAsDataUrl(f);
        } else {
          dataUrl = await compressImageFile(f);
        }
        uploadedList.push({
          id: `FILE-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          name: f.name,
          dataUrl,
          fileType: isPdf ? 'PDF' : 'IMAGE',
          sizeBytes: f.size,
          uploadedAt: new Date().toISOString()
        });
      } catch (err) {
        showToast(`❌ 讀取檔案 ${f.name} 失敗`);
      }
    }

    if (uploadedList.length > 0) {
      onSuccess(uploadedList);
      showToast(`📎 成功上傳 ${uploadedList.length} 個檔案憑證`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ======================================================== */}
      {/* 頂部操作工具列 */}
      {/* ======================================================== */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4 shrink-0 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <Users2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>商業夥伴主檔管理</span>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    CRM & SRM 雙軌主檔
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  整合業主客戶、協力發包廠商、多地址郵遞區號選單、支票往來票期時效、名片交換管理
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 開啟小程式專區按鈕 */}
            <button
              type="button"
              onClick={() => setIsMiniAppsModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
              title="查看及測試通用小程式（地址選單、統編身分證檢核、金融機構速查器）"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>🛠️ 通用小程式專區</span>
            </button>

            {/* 一鍵引薦變業主按鈕 (僅在業主名冊頁籤顯示) */}
            {activeTab === 'CLIENTS' && canWrite && (
              <button
                type="button"
                onClick={() => {
                  setVendorSearchTerm('');
                  setIsConvertModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50/80 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
                title="從既有合作廠商快速轉換或引薦為業主"
              >
                <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                <span>一鍵從廠商引薦加入業主</span>
              </button>
            )}

            {/* 新增夥伴主檔按鈕 */}
            {canWrite && (
              <button
                type="button"
                onClick={handleOpenCreatePartner}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>{activeTab === 'CLIENTS' ? '新增業主資料' : '新增合作廠商'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 雙頁籤切換：業主名冊 (客戶) vs 合作廠商 (工班/材料) */}
        <div className="flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => {
                setActiveTab('CLIENTS');
                setSelectedMainCategory('ALL');
                setSelectedSubCategory('ALL');
              }}
              className={`pb-3 px-5 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'CLIENTS'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users2 className="w-4 h-4" />
              <span>業主名冊 (客戶 / 發包方)</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                  activeTab === 'CLIENTS'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {clientsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('VENDORS');
                setSelectedMainCategory('ALL');
                setSelectedSubCategory('ALL');
              }}
              className={`pb-3 px-5 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'VENDORS'
                  ? 'border-amber-600 text-amber-600 bg-amber-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <HardHat className="w-4 h-4" />
              <span>合作廠商名冊 (協力包商 / 材料商)</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                  activeTab === 'VENDORS'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {vendorsCount}
              </span>
            </button>
          </div>

          {/* 視圖切換器：緊湊表格 (500+首選) vs 名片卡片 */}
          <div className="flex items-center gap-2 pb-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'TABLE'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="清單表格模式：高密度展示，適合 500+ 筆資料極速瀏覽"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>緊湊表格 (推薦)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('CARDS')}
                className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'CARDS'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="名片網格模式：卡片視覺化展示"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>名片卡片</span>
              </button>
            </div>
          </div>
        </div>

        {/* 篩選與搜尋工具列 (地址拆分、工項篩選、關鍵字、風控) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-1">
          {/* 關鍵字搜尋 */}
          <div className="relative sm:col-span-2">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜尋名稱、統編、電話、地址、支票、名片..."
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* 工項大類篩選 (業主接案工項 vs 廠商工種) */}
          <div>
            <select
              value={selectedMainCategory}
              onChange={e => {
                setSelectedMainCategory(e.target.value);
                setSelectedSubCategory('ALL');
              }}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700"
            >
              <option value="ALL">全部工項 (不限)</option>
              {ENGINEERING_CATEGORIES.map(g => (
                <option key={g.mainCategory} value={g.mainCategory}>
                  {g.mainCategory}
                </option>
              ))}
            </select>
          </div>

          {/* 縣市篩選 (地址拆分) */}
          <div>
            <select
              value={selectedCity}
              onChange={e => {
                setSelectedCity(e.target.value);
                setSelectedDistrict('ALL');
              }}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700"
            >
              <option value="ALL">全部縣市</option>
              {TAIWAN_CITIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* 鄉鎮市區篩選 (連動選定縣市) */}
          <div>
            <select
              value={selectedDistrict}
              onChange={e => setSelectedDistrict(e.target.value)}
              disabled={selectedCity === 'ALL'}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 disabled:opacity-50"
            >
              <option value="ALL">全部行政區</option>
              {currentDistricts.map(d => (
                <option key={d.district} value={d.district}>
                  {d.district} ({d.postalCode})
                </option>
              ))}
            </select>
          </div>

          {/* 票據與名片條件篩選 */}
          <div>
            <select
              value={hasChequeFilter}
              onChange={e => setHasChequeFilter(e.target.value as any)}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700"
            >
              <option value="ALL">全部票據狀態</option>
              <option value="HAS">💳 有登記支票記錄</option>
              <option value="NONE">無支票記錄</option>
            </select>
          </div>
        </div>

        {/* 筆數與狀態小工具列 */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              符合條件：<strong className="text-slate-900 font-mono">{filteredPartners.length}</strong> 筆
            </span>
            {selectedMainCategory !== 'ALL' && (
              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[11px] font-bold">
                工項：{selectedMainCategory}
              </span>
            )}
            {selectedCity !== 'ALL' && (
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-bold">
                地區：{selectedCity} {selectedDistrict !== 'ALL' ? selectedDistrict : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">每頁顯示：</span>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono font-bold"
            >
              <option value={25}>25 筆</option>
              <option value={50}>50 筆</option>
              <option value={100}>100 筆</option>
              <option value={9999}>全部顯示</option>
            </select>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 主要展示區：緊湊表格模式 (TABLE) vs 名片卡片模式 (CARDS) */}
      {/* ======================================================== */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {filteredPartners.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300 space-y-3">
            <Building2 className="w-12 h-12 mx-auto text-slate-300" />
            <h4 className="text-sm font-bold text-slate-700">查無符合條件之商業夥伴</h4>
            <p className="text-xs text-slate-400">
              請嘗試放寬搜尋關鍵字、工項類別或縣市區域篩選
            </p>
          </div>
        ) : viewMode === 'TABLE' ? (
          /* ======================================================== */
          /* 1. 高密度緊湊資料表格模式 (專為 500+ 筆資料打造) */
          /* ======================================================== */
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold select-none">
                    <th className="py-2.5 px-3 w-24">夥伴編號</th>
                    <th className="py-2.5 px-3 min-w-[180px]">夥伴名稱 / 身分</th>
                    <th className="py-2.5 px-3 w-32">統一編號</th>
                    <th className="py-2.5 px-3 min-w-[150px]">服務工種 / 接案項目</th>
                    <th className="py-2.5 px-3 w-28">負責人 / 窗口</th>
                    <th className="py-2.5 px-3 w-32">主要電話</th>
                    <th className="py-2.5 px-3 min-w-[200px]">通訊地址 (拆分)</th>
                    <th className="py-2.5 px-3 w-24 text-center">手續費</th>
                    <th className="py-2.5 px-3 w-28 text-center">票據往來</th>
                    <th className="py-2.5 px-3 w-20 text-center">名片</th>
                    <th className="py-2.5 px-3 w-20 text-center">風控</th>
                    <th className="py-2.5 px-3 w-36 text-right">操作功能</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedPartners.map(p => {
                    const isTaxValid = validateTaiwanTaxId(p.taxId).isValid;
                    const chkCount = p.chequeRecords?.length || 0;
                    const cardCount = p.businessCards?.length || 0;
                    const primaryCard = p.businessCards?.[0];

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-indigo-50/30 transition-colors group"
                      >
                        {/* 編號 */}
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                          {p.bpCode}
                        </td>

                        {/* 名稱與身分徽章 */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span className="truncate max-w-[180px]" title={p.name}>
                              {p.name}
                            </span>
                            {p.isCustomer && p.isVendor ? (
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-purple-100 text-purple-800 shrink-0">
                                雙重身分
                              </span>
                            ) : p.isCustomer ? (
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-indigo-100 text-indigo-800 shrink-0">
                                業主
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800 shrink-0">
                                廠商
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 統一編號 (附合法檢核徽章) */}
                        <td className="py-2.5 px-3 font-mono">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-800 font-bold">{p.taxId}</span>
                            {isTaxValid ? (
                              <span
                                className="w-3.5 h-3.5 text-emerald-600 inline-flex items-center justify-center shrink-0"
                                title="統一編號邏輯檢核正確"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span
                                className="w-3.5 h-3.5 text-amber-500 inline-flex items-center justify-center shrink-0"
                                title="統編待驗證或為非標準自然人"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 多工種標籤 */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
                            {(p.serviceCategories && p.serviceCategories.length > 0
                              ? p.serviceCategories
                              : [{ id: '1', main: p.serviceCategoryMain || '一般工項', sub: p.serviceCategorySub || '' }]
                            )
                              .slice(0, 2)
                              .map((c, i) => (
                                <span
                                  key={c.id || i}
                                  className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-medium truncate max-w-[120px]"
                                  title={`${c.main} ${c.sub ? `› ${c.sub}` : ''}`}
                                >
                                  {c.sub || c.main}
                                </span>
                              ))}
                            {(p.serviceCategories?.length || 0) > 2 && (
                              <span className="text-[10px] text-indigo-600 font-bold">
                                +{(p.serviceCategories?.length || 0) - 2}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 負責人與窗口 */}
                        <td className="py-2.5 px-3 text-slate-700">
                          <div className="truncate font-medium" title={p.representative || p.contactPerson}>
                            {p.representative ? `${p.representative}` : p.contactPerson || '-'}
                          </div>
                          {p.representative && p.contactPerson && p.representative !== p.contactPerson && (
                            <div className="text-[10px] text-slate-400 truncate">
                              窗: {p.contactPerson}
                            </div>
                          )}
                        </td>

                        {/* 電話 */}
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {p.phone || '-'}
                        </td>

                        {/* 地址 (拆分) */}
                        <td className="py-2.5 px-3 text-slate-600">
                          <div className="truncate max-w-[220px]" title={p.address}>
                            {p.address || '-'}
                          </div>
                        </td>

                        {/* 手續費負擔 */}
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              p.bankFeePayer === 'PARTNER'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {p.bankFeePayer === 'PARTNER' ? '自付' : '公司吸收'}
                          </span>
                        </td>

                        {/* 支票往來記錄 (點擊查看清單) */}
                        <td className="py-2.5 px-3 text-center">
                          {chkCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                const chk = p.chequeRecords?.[0];
                                if (chk) {
                                  setSelectedChequeForDetail(chk);
                                }
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 transition-colors"
                              title="點擊查看支票明細與備註"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>{chkCount} 張</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 text-[11px]">-</span>
                          )}
                        </td>

                        {/* 名片圖示與懸浮預覽 */}
                        <td className="py-2.5 px-3 text-center">
                          {cardCount > 0 ? (
                            <div className="inline-flex items-center">
                              <button
                                type="button"
                                onClick={() => {
                                  if (primaryCard?.cardFrontUrl) {
                                    setLightboxMedia({
                                      url: primaryCard.cardFrontUrl,
                                      title: `名片：${p.name} - ${primaryCard.name}`,
                                      isPdf: primaryCard.cardFileType === 'PDF'
                                    });
                                  } else {
                                    handleOpenAddCard(p);
                                  }
                                }}
                                onMouseEnter={e => {
                                  if (!primaryCard?.cardFrontUrl) return;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoverPreview({
                                    url: primaryCard.cardFrontUrl,
                                    title: `名片：${primaryCard.name} (${primaryCard.title || ''})`,
                                    isPdf: primaryCard.cardFileType === 'PDF',
                                    x: rect.left - 400,
                                    y: rect.top - 80
                                  });
                                }}
                                onMouseLeave={() => setHoverPreview(null)}
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                title="移入看名片大圖，點擊全螢幕預覽"
                              >
                                <Contact className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenAddCard(p)}
                              className="text-slate-300 hover:text-indigo-600 p-1 rounded"
                              title="上傳名片圖檔/PDF"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>

                        {/* 風控標籤 */}
                        <td className="py-2.5 px-3 text-center">
                          {p.isHighRisk ? (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                              高風險
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {p.currentScore || 85}分
                            </span>
                          )}
                        </td>

                        {/* 操作功能組 */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* 登記支票 */}
                            {canWrite && (
                              <button
                                type="button"
                                onClick={() => handleOpenAddCheque(p.id)}
                                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="登記支票"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* 交換名片 */}
                            {canWrite && (
                              <button
                                type="button"
                                onClick={() => handleOpenAddCard(p)}
                                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="交換/上傳名片"
                              >
                                <Contact className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* 編輯 */}
                            {canWrite && (
                              <button
                                type="button"
                                onClick={() => handleEditPartner(p)}
                                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="編輯夥伴主檔"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* 刪除夥伴 (自訂 In-App Modal) */}
                            {canWrite && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteConfirmTarget({
                                    type: 'PARTNER',
                                    id: p.id,
                                    name: p.name,
                                    isBoth: Boolean(p.isCustomer && p.isVendor),
                                    extraNotice:
                                      p.isCustomer && p.isVendor
                                        ? '此夥伴同時具備業主與合作廠商雙重身分。您可以選擇僅移除業主身分，或完全刪除。'
                                        : '執行刪除後將對商業夥伴執行軟刪除，相關歷史估驗與報價單據仍完整保留備查。'
                                  })
                                }
                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="刪除夥伴"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 表格底部翻頁控制列 */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div>
                顯示第 <strong className="font-mono">{(currentPage - 1) * pageSize + 1}</strong> 至{' '}
                <strong className="font-mono">{Math.min(currentPage * pageSize, filteredPartners.length)}</strong> 筆，共{' '}
                <strong className="font-mono text-slate-900">{filteredPartners.length}</strong> 筆夥伴
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30"
                    title="第一頁"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30"
                    title="上一頁"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="px-3 py-1 font-mono font-bold text-slate-800">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30"
                    title="下一頁"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30"
                    title="最後一頁"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* 2. 名片卡片網格模式 (CARDS) */
          /* ======================================================== */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagedPartners.map(p => {
              const isTaxValid = validateTaiwanTaxId(p.taxId).isValid;
              const chequeCount = p.chequeRecords?.length || 0;
              const cardCount = p.businessCards?.length || 0;

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* 卡片標題 */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-400">
                            {p.bpCode}
                          </span>
                          {p.isCustomer && p.isVendor ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-purple-100 text-purple-800">
                              業主暨廠商
                            </span>
                          ) : p.isCustomer ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-indigo-100 text-indigo-800">
                              業主 (發包方)
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800">
                              合作廠商
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 truncate mt-0.5" title={p.name}>
                          {p.name}
                        </h3>
                      </div>

                      {p.isHighRisk && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 shrink-0">
                          高風險
                        </span>
                      )}
                    </div>

                    {/* 統編與多工種 */}
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[11px]">統編：</span>
                        <span className="font-mono font-bold text-slate-800">{p.taxId}</span>
                        {isTaxValid && (
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>驗證通過</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-400 text-[11px]">工項：</span>
                        {(p.serviceCategories && p.serviceCategories.length > 0
                          ? p.serviceCategories
                          : [{ id: '1', main: p.serviceCategoryMain || '一般工項', sub: p.serviceCategorySub || '' }]
                        ).map((c, i) => (
                          <span
                            key={c.id || i}
                            className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-medium"
                          >
                            {c.sub || c.main}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono">{p.phone || '未登記電話'}</span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{p.address || '未登記通訊地址'}</span>
                      </div>
                    </div>

                    {/* 支票往來摘要列 */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="font-semibold text-slate-700">支票往來：</span>
                        <strong className="text-indigo-700 font-mono font-bold">
                          {chequeCount} 筆
                        </strong>
                      </div>
                      {chequeCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const chk = p.chequeRecords?.[0];
                            if (chk) setSelectedChequeForDetail(chk);
                          }}
                          className="text-[11px] text-indigo-600 hover:underline font-bold"
                        >
                          查看明細
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 卡片底部操作列 */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      {cardCount > 0 && (
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                          📇 名片 {cardCount}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => handleOpenAddCheque(p.id)}
                          className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold"
                          title="登記支票"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => handleOpenAddCard(p)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                          title="交換名片"
                        >
                          <Contact className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => handleEditPartner(p)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                        >
                          編輯
                        </button>
                      )}
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirmTarget({
                              type: 'PARTNER',
                              id: p.id,
                              name: p.name,
                              isBoth: Boolean(p.isCustomer && p.isVendor)
                            })
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 彈窗 1：商業夥伴主檔編輯器 Modal (7 大分頁) */}
      {/* ======================================================== */}
      {isEditorOpen && editingPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingPartner.id.startsWith('BP-') ? '新增商業夥伴主檔' : '編輯商業夥伴主檔'}：{editingPartner.name || '未命名'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    夥伴編號：{editingPartner.bpCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Bar */}
            <div className="px-6 bg-slate-50 border-b border-slate-200 flex items-center gap-1 overflow-x-auto shrink-0">
              {[
                { key: 'BASIC', label: '1. 基本身分與風控', icon: Building2 },
                { key: 'CATEGORY', label: '2. 多元工種服務', icon: Layers },
                { key: 'ADDRESSES', label: '3. 多地址管理 (郵政)', icon: MapPin },
                { key: 'CONTACTS', label: '4. 聯絡人名冊', icon: Users2 },
                { key: 'BANK', label: '5. 金融帳戶與存摺', icon: Landmark },
                { key: 'CHEQUES', label: `6. 支票往來 (${editingPartner.chequeRecords?.length || 0})`, icon: Receipt },
                { key: 'CARDS', label: `7. 名片管理 (${editingPartner.businessCards?.length || 0})`, icon: Contact },
                { key: 'VAULT', label: '8. 無紙化金庫與圖說', icon: FolderLock }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeEditorTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveEditorTab(tab.key as any)}
                    className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* TAB 1: 基本身分與風控 */}
              {activeEditorTab === 'BASIC' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        實體組織型態 (法人別)
                      </label>
                      <div className="flex items-center gap-4 mt-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="entityType"
                            checked={editingPartner.entityType !== 'NATURAL_PERSON'}
                            onChange={() =>
                              setEditingPartner({ ...editingPartner, entityType: 'CORPORATION' })
                            }
                            className="text-indigo-600"
                          />
                          <span>公司法人 (營利事業)</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="entityType"
                            checked={editingPartner.entityType === 'NATURAL_PERSON'}
                            onChange={() =>
                              setEditingPartner({ ...editingPartner, entityType: 'NATURAL_PERSON' })
                            }
                            className="text-indigo-600"
                          />
                          <span>自然人 (工班師傅/地主)</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        業務身分定義
                      </label>
                      <div className="flex items-center gap-4 mt-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(editingPartner.isCustomer)}
                            onChange={e =>
                              setEditingPartner({ ...editingPartner, isCustomer: e.target.checked })
                            }
                            className="rounded text-indigo-600"
                          />
                          <span>業主 (客戶 / 發包方)</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(editingPartner.isVendor)}
                            onChange={e =>
                              setEditingPartner({ ...editingPartner, isVendor: e.target.checked })
                            }
                            className="rounded text-indigo-600"
                          />
                          <span>合作廠商 (協力包商 / 材料商)</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* 名稱與統編驗證機小程式 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        夥伴名稱 / 公司全稱 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editingPartner.name}
                        onChange={e => setEditingPartner({ ...editingPartner, name: e.target.value })}
                        placeholder="例：國產建材實業股份有限公司"
                        className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 font-bold"
                      />
                    </div>

                    <div>
                      {/* 直接調用統編/身分證字號檢核小程式 */}
                      <TaiwanIdTaxValidatorWidget
                        type={editingPartner.entityType === 'NATURAL_PERSON' ? 'NATIONAL_ID' : 'TAX_ID'}
                        value={editingPartner.taxId}
                        onChange={val => setEditingPartner({ ...editingPartner, taxId: val })}
                        label={editingPartner.entityType === 'NATURAL_PERSON' ? '身分證字號 (10 碼)' : '公司統一編號 (8 碼)'}
                        required
                      />
                    </div>
                  </div>

                  {/* 負責人身分與手續費負擔 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        負責人姓名
                      </label>
                      <input
                        type="text"
                        value={editingPartner.representative || ''}
                        onChange={e =>
                          setEditingPartner({ ...editingPartner, representative: e.target.value })
                        }
                        placeholder="公司代表人"
                        className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        手續費/匯費負擔方 (營造內控)
                      </label>
                      <select
                        value={editingPartner.bankFeePayer || 'COMPANY'}
                        onChange={e =>
                          setEditingPartner({
                            ...editingPartner,
                            bankFeePayer: e.target.value as any
                          })
                        }
                        className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-bold"
                      >
                        <option value="COMPANY">🏢 公司自行吸收 (請款 100 全額匯 100)</option>
                        <option value="PARTNER">👤 廠商自付 (匯款時內扣 30 元手續費)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        付款條件天數 (票期)
                      </label>
                      <select
                        value={editingPartner.paymentTermsDays || 30}
                        onChange={e =>
                          setEditingPartner({
                            ...editingPartner,
                            paymentTermsDays: Number(e.target.value)
                          })
                        }
                        className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-bold"
                      >
                        <option value={0}>0 天 (即期給付)</option>
                        <option value={30}>30 天 (次月付款)</option>
                        <option value={45}>45 天</option>
                        <option value={60}>60 天 (二個月票期)</option>
                        <option value={90}>90 天 (三個月票期)</option>
                      </select>
                    </div>
                  </div>

                  {/* 風險控管 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingPartner.isHighRisk)}
                        onChange={e =>
                          setEditingPartner({ ...editingPartner, isHighRisk: e.target.checked })
                        }
                        className="rounded text-red-600 focus:ring-red-500"
                      />
                      <span className="text-xs font-bold text-red-700">
                        列為高風險管制夥伴 (停權 / 警示 / 請款凍結)
                      </span>
                    </label>
                    {editingPartner.isHighRisk && (
                      <input
                        type="text"
                        value={editingPartner.riskReason || ''}
                        onChange={e =>
                          setEditingPartner({ ...editingPartner, riskReason: e.target.value })
                        }
                        placeholder="請述明風險原因（例：曾有工程逾期爭議紀錄，發包或計價前需副總核准）..."
                        className="w-full text-xs p-2 bg-white border border-red-300 rounded-lg text-red-900"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: 多元工種服務類別 */}
              {activeEditorTab === 'CATEGORY' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-1 text-xs">
                    <h4 className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>多元工項服務專業類別 (支援加入多項多元工種)</span>
                    </h4>
                    <p className="text-indigo-700 text-[11px]">
                      廠商工作多元，可從下方選單選取標準工種，或自訂名稱加入多元清單中！
                    </p>
                  </div>

                  {/* 工種選取列 */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="md:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        第一階：主要專業工項大類
                      </label>
                      <select
                        value={editingPartner.serviceCategoryMain || '泥作裝修工程'}
                        onChange={e => {
                          const main = e.target.value;
                          const group = ENGINEERING_CATEGORIES.find(g => g.mainCategory === main);
                          setEditingPartner({
                            ...editingPartner,
                            serviceCategoryMain: main,
                            serviceCategorySub: group?.subCategories[0] || ''
                          });
                        }}
                        className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
                      >
                        {ENGINEERING_CATEGORIES.map(g => (
                          <option key={g.mainCategory} value={g.mainCategory}>
                            {g.mainCategory}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        第二階：細部專門工種
                      </label>
                      <select
                        value={editingPartner.serviceCategorySub || ''}
                        onChange={e =>
                          setEditingPartner({ ...editingPartner, serviceCategorySub: e.target.value })
                        }
                        className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
                      >
                        {(
                          ENGINEERING_CATEGORIES.find(
                            g => g.mainCategory === (editingPartner.serviceCategoryMain || '泥作裝修工程')
                          )?.subCategories || []
                        ).map(sub => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={() => {
                          const main = editingPartner.serviceCategoryMain || '泥作裝修工程';
                          const sub = editingPartner.serviceCategorySub || '';
                          const list = editingPartner.serviceCategories ? [...editingPartner.serviceCategories] : [];
                          if (list.some(c => c.main === main && c.sub === sub)) {
                            showToast('⚠️ 該工項已經在清單中');
                            return;
                          }
                          list.push({
                            id: `CAT-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                            main,
                            sub
                          });
                          setEditingPartner({
                            ...editingPartner,
                            serviceCategories: list
                          });
                          showToast(`✅ 已加入工種：${main} › ${sub}`);
                        }}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>加入工種</span>
                      </button>
                    </div>
                  </div>

                  {/* 標籤徽章清單 */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700">已登錄之工種標籤清單：</span>
                    {editingPartner.serviceCategories && editingPartner.serviceCategories.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {editingPartner.serviceCategories.map((c, idx) => (
                          <div
                            key={c.id || idx}
                            className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Tag className="w-3 h-3 text-indigo-500" />
                            <span>
                              {c.main} {c.sub ? `› ${c.sub}` : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const list = editingPartner.serviceCategories!.filter((_, i) => i !== idx);
                                setEditingPartner({
                                  ...editingPartner,
                                  serviceCategories: list,
                                  serviceCategoryMain: list[0]?.main,
                                  serviceCategorySub: list[0]?.sub
                                });
                              }}
                              className="text-slate-400 hover:text-red-600 ml-1 p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        尚未加入任何工項分類
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: 多地址動態管理 (直接調用 TaiwanAddressPicker 小程式) */}
              {activeEditorTab === 'ADDRESSES' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        多地址管理 (中華郵政標準郵遞區號選單小程式)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        排列順序：郵遞區號 ➔ 縣市 ➔ 鄉鎮 ➔ 住址。選擇縣市及鄉鎮自動改變郵遞區號，或輸入郵遞區號自動改變縣市鄉鎮，剩餘住址由人工輸入。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const list = editingPartner.addresses ? [...editingPartner.addresses] : [];
                        list.push({
                          id: `PADDR-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                          partnerId: editingPartner.id,
                          addressType: 'COMMUNICATION',
                          label: '通訊地址',
                          postalCode: '100',
                          city: '臺北市',
                          district: '中正區',
                          streetAddress: '',
                          fullAddress: '',
                          isDeleted: false
                        });
                        setEditingPartner({ ...editingPartner, addresses: list });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新增地址</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(editingPartner.addresses || []).map((addr, idx) => (
                      <div
                        key={addr.id || idx}
                        className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700">地址類別：</span>
                            <input
                              type="text"
                              value={addr.label || '營業登記地址'}
                              onChange={e => {
                                const list = [...editingPartner.addresses!];
                                list[idx].label = e.target.value;
                                setEditingPartner({ ...editingPartner, addresses: list });
                              }}
                              className="text-xs p-1.5 bg-white border border-slate-300 rounded font-bold w-36"
                            />
                          </div>
                          {(editingPartner.addresses || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const list = editingPartner.addresses!.filter((_, i) => i !== idx);
                                setEditingPartner({ ...editingPartner, addresses: list });
                              }}
                              className="text-slate-400 hover:text-red-600 text-xs flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>刪除地址</span>
                            </button>
                          )}
                        </div>

                        {/* 調用 TaiwanAddressPicker 小程式 */}
                        <TaiwanAddressPicker
                          value={{
                            postalCode: addr.postalCode,
                            city: addr.city,
                            district: addr.district,
                            streetAddress: addr.streetAddress,
                            fullAddress: addr.fullAddress
                          }}
                          onChange={val => {
                            const list = [...editingPartner.addresses!];
                            list[idx] = {
                              ...list[idx],
                              postalCode: val.postalCode,
                              city: val.city,
                              district: val.district,
                              streetAddress: val.streetAddress,
                              fullAddress: val.fullAddress || ''
                            };
                            setEditingPartner({
                              ...editingPartner,
                              addresses: list,
                              address: idx === 0 ? val.fullAddress || '' : editingPartner.address
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: 聯絡人名冊 */}
              {activeEditorTab === 'CONTACTS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">商業夥伴多元聯絡人</h4>
                      <p className="text-[11px] text-slate-500">
                        記錄主要負責人、工務所工地主任、業務代表與會計對帳窗口
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const list = editingPartner.contacts ? [...editingPartner.contacts] : [];
                        list.push({
                          id: `PCON-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                          partnerId: editingPartner.id,
                          contactType: 'ENGINEERING',
                          name: '',
                          title: '工務窗口',
                          phone: '',
                          mobile: '',
                          extension: '',
                          email: '',
                          isDeleted: false
                        });
                        setEditingPartner({ ...editingPartner, contacts: list });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新增聯絡人</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(editingPartner.contacts || []).map((con, idx) => (
                      <div
                        key={con.id || idx}
                        className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">姓名</label>
                            <input
                              type="text"
                              value={con.name}
                              onChange={e => {
                                const list = [...editingPartner.contacts!];
                                list[idx].name = e.target.value;
                                setEditingPartner({ ...editingPartner, contacts: list });
                              }}
                              placeholder="聯絡人姓名"
                              className="w-full text-xs p-2 bg-white border border-slate-300 rounded font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">職稱</label>
                            <input
                              type="text"
                              value={con.title || ''}
                              onChange={e => {
                                const list = [...editingPartner.contacts!];
                                list[idx].title = e.target.value;
                                setEditingPartner({ ...editingPartner, contacts: list });
                              }}
                              placeholder="例：工務主任"
                              className="w-full text-xs p-2 bg-white border border-slate-300 rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">行動電話</label>
                            <input
                              type="text"
                              value={con.mobile || ''}
                              onChange={e => {
                                const list = [...editingPartner.contacts!];
                                list[idx].mobile = e.target.value;
                                setEditingPartner({ ...editingPartner, contacts: list });
                              }}
                              placeholder="09xx-xxx-xxx"
                              className="w-full text-xs p-2 font-mono bg-white border border-slate-300 rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">電話/分機</label>
                            <input
                              type="text"
                              value={con.phone || ''}
                              onChange={e => {
                                const list = [...editingPartner.contacts!];
                                list[idx].phone = e.target.value;
                                setEditingPartner({ ...editingPartner, contacts: list });
                              }}
                              placeholder="02-xxxx-xxxx"
                              className="w-full text-xs p-2 font-mono bg-white border border-slate-300 rounded"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: 全國金融帳戶與存摺封面 */}
              {activeEditorTab === 'BANK' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-indigo-600" />
                      <span>主要收款/扣款金融機構帳號 (出納匯款標的)</span>
                    </h4>

                    {/* 調用 TaiwanBankPickerWidget 小程式 */}
                    <TaiwanBankPickerWidget
                      bankCode={editingPartner.bankCode || '004'}
                      bankName={editingPartner.bankName || '臺灣銀行'}
                      onChange={({ bankCode, bankName }) => {
                        setEditingPartner({
                          ...editingPartner,
                          bankCode,
                          bankName
                        });
                      }}
                      label="全國金融機構代碼與機構名稱 (支援 400+ 銀行農漁會信用部)"
                      required
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          銀行帳戶戶名
                        </label>
                        <input
                          type="text"
                          value={editingPartner.bankAccountName || editingPartner.name}
                          onChange={e =>
                            setEditingPartner({ ...editingPartner, bankAccountName: e.target.value })
                          }
                          placeholder="戶名 (通常同公司全稱)"
                          className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          銀行帳號 (10 ~ 16 碼純數字)
                        </label>
                        <input
                          type="text"
                          value={editingPartner.bankAccount || ''}
                          onChange={e =>
                            setEditingPartner({ ...editingPartner, bankAccount: e.target.value.trim() })
                          }
                          placeholder="請輸入無破折號之帳號"
                          className="w-full text-xs p-2.5 font-mono font-bold bg-white border border-slate-300 rounded-lg tracking-wider"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 存摺封面照片多檔案上傳與預覽 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-emerald-600" />
                          <span>存摺封面 / 印鑑卡 / 匯款同意書 (多檔案支援)</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          支援上傳多個圖檔或 PDF。滑鼠懸停放大預覽，點擊燈箱檢視與下載。
                        </p>
                      </div>
                      <label className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>上傳存摺</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={e =>
                            handleProcessUploadedFiles(e.target.files, newFiles => {
                              const bList = [...(editingPartner.bankAccounts || [])];
                              if (bList.length === 0) {
                                bList.push({
                                  id: `BACC-${Date.now()}-1`,
                                  bpId: editingPartner.id,
                                  bankCode: editingPartner.bankCode || '004',
                                  bankName: editingPartner.bankName || '臺灣銀行',
                                  accountNumber: editingPartner.bankAccount || '',
                                  accountName: editingPartner.bankAccountName || editingPartner.name,
                                  isPrimary: true,
                                  passbookFiles: newFiles
                                });
                              } else {
                                bList[0].passbookFiles = [...(bList[0].passbookFiles || []), ...newFiles];
                              }
                              setEditingPartner({ ...editingPartner, bankAccounts: bList });
                            })
                          }
                        />
                      </label>
                    </div>

                    {/* 已上傳檔案縮圖 */}
                    {editingPartner.bankAccounts?.[0]?.passbookFiles &&
                    editingPartner.bankAccounts[0].passbookFiles.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {editingPartner.bankAccounts[0].passbookFiles.map((f, idx) => (
                          <div
                            key={f.id || idx}
                            className="bg-white p-2 rounded-xl border border-slate-200 space-y-1.5"
                          >
                            <div
                              className="aspect-4/3 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer relative"
                              onClick={() =>
                                setLightboxMedia({
                                  url: f.dataUrl,
                                  title: f.name,
                                  isPdf: f.fileType === 'PDF'
                                })
                              }
                              onMouseEnter={e => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoverPreview({
                                  url: f.dataUrl,
                                  title: f.name,
                                  isPdf: f.fileType === 'PDF',
                                  x: rect.left - 420,
                                  y: rect.top - 80
                                });
                              }}
                              onMouseLeave={() => setHoverPreview(null)}
                            >
                              {f.fileType === 'PDF' ? (
                                <div className="text-red-600 flex flex-col items-center">
                                  <FileText className="w-8 h-8" />
                                  <span className="text-[10px] font-bold">PDF 憑據</span>
                                </div>
                              ) : (
                                <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="truncate max-w-[100px] text-slate-700 font-medium" title={f.name}>
                                {f.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const bList = [...(editingPartner.bankAccounts || [])];
                                  bList[0].passbookFiles = bList[0].passbookFiles!.filter((_, i) => i !== idx);
                                  setEditingPartner({ ...editingPartner, bankAccounts: bList });
                                }}
                                className="text-slate-400 hover:text-red-600 p-0.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-xs text-slate-400 italic">
                        尚未上傳存摺影本照片或 PDF 掃描檔
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: 支票往來歷程 (即時同步) */}
              {activeEditorTab === 'CHEQUES' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        支票收付往來歷程紀錄 ({editingPartner.chequeRecords?.length || 0})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        收受業主期票或開立廠商工程支票。點擊任何一筆可查看完整票面與備註！
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAddCheque(editingPartner.id)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>登記新支票</span>
                    </button>
                  </div>

                  {editingPartner.chequeRecords && editingPartner.chequeRecords.length > 0 ? (
                    <div className="space-y-2">
                      {editingPartner.chequeRecords.map(chk => (
                        <div
                          key={chk.id}
                          onClick={() => setSelectedChequeForDetail(chk)}
                          className="p-3 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200 flex items-center justify-between text-xs cursor-pointer transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                  chk.direction === 'RECEIPT'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {chk.direction === 'RECEIPT' ? '收受支票' : '開立支票'}
                              </span>
                              <span className="font-mono font-bold text-slate-900">
                                {chk.checkNumber}
                              </span>
                              <span className="font-mono font-extrabold text-indigo-700">
                                NT$ {chk.amount.toLocaleString()}
                              </span>
                              {chk.isNonNegotiable && (
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-1 rounded font-semibold">
                                  禁背
                                </span>
                              )}
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-bold">
                                {chk.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-3">
                              <span>銀行：[{chk.bankCode}] {chk.bankName}</span>
                              <span>發票日：{chk.issueDate}</span>
                              <span className="font-bold text-indigo-700">兌現日：{chk.dueDate}</span>
                              {chk.notes && (
                                <span className="text-amber-800 bg-amber-50 px-1 rounded truncate max-w-[150px]">
                                  註: {chk.notes}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedChequeForDetail(chk)}
                              className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded"
                            >
                              查看明細
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteConfirmTarget({
                                  type: 'CHEQUE',
                                  id: chk.id,
                                  partnerId: editingPartner.id,
                                  name: `支票 ${chk.checkNumber}`
                                })
                              }
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">
                      尚未登記任何支票收發紀錄
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: 名片管理 (Business Cards) */}
              {activeEditorTab === 'CARDS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        交換名片存查庫 ({editingPartner.businessCards?.length || 0})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        廠商或業主拜訪交換名片時，上傳正反面圖檔或 PDF 掃描件，亦可一鍵同步為主要聯絡人。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAddCard(editingPartner)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>上傳/新增名片</span>
                    </button>
                  </div>

                  {editingPartner.businessCards && editingPartner.businessCards.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {editingPartner.businessCards.map(card => (
                        <div
                          key={card.id}
                          className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 text-sm">{card.name}</span>
                                {card.title && (
                                  <span className="text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                                    {card.title}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 space-y-0.5">
                                {card.phone && <div>總機: {card.phone}</div>}
                                {card.mobile && <div className="font-mono">手機: {card.mobile}</div>}
                                {card.email && <div className="font-mono">信箱: {card.email}</div>}
                                {card.exchangeDate && <div className="text-[10px] text-slate-400">交換日期: {card.exchangeDate}</div>}
                              </div>
                            </div>

                            {card.cardFrontUrl && (
                              <div
                                className="w-20 h-14 bg-slate-200 rounded-lg overflow-hidden shrink-0 cursor-pointer border border-slate-300 relative group"
                                onClick={() =>
                                  setLightboxMedia({
                                    url: card.cardFrontUrl!,
                                    title: `名片：${card.name}`,
                                    isPdf: card.cardFileType === 'PDF'
                                  })
                                }
                                onMouseEnter={e => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoverPreview({
                                    url: card.cardFrontUrl!,
                                    title: `名片：${card.name}`,
                                    isPdf: card.cardFileType === 'PDF',
                                    x: rect.left - 420,
                                    y: rect.top - 80
                                  });
                                }}
                                onMouseLeave={() => setHoverPreview(null)}
                              >
                                {card.cardFileType === 'PDF' ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-red-600 bg-red-50">
                                    <FileText className="w-5 h-5" />
                                    <span className="text-[8px] font-bold">PDF</span>
                                  </div>
                                ) : (
                                  <img src={card.cardFrontUrl} alt="名片" className="w-full h-full object-cover" />
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPartner({
                                  ...editingPartner,
                                  contactPerson: card.name,
                                  phone: card.phone || card.mobile || editingPartner.phone,
                                  email: card.email || editingPartner.email
                                });
                                showToast(`✅ 已將「${card.name}」設為主要聯絡人`);
                              }}
                              className="text-[11px] text-indigo-600 hover:underline font-bold"
                            >
                              帶入為主要聯絡人
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteConfirmTarget({
                                  type: 'CARD',
                                  id: card.id,
                                  partnerId: editingPartner.id,
                                  name: `名片：${card.name}`
                                })
                              }
                              className="p-1 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">
                      尚未收存任何名片
                    </div>
                  )}
                </div>
              )}

              {/* TAB 8: 無紙化金庫與圖說 (直接調用全系統通用 AttachmentUploader 元件) */}
              {activeEditorTab === 'VAULT' && (
                <div className="space-y-4">
                  <AttachmentUploader
                    targetTable="business_partners"
                    targetId={editingPartner.id}
                    partnerId={editingPartner.id}
                    title={`【${editingPartner.name}】專屬無紙化金庫與合約圖說`}
                    defaultCategory="正式合約"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400 font-mono">
                最後更新：{editingPartner.updatedAt || '即時同步'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSavePartner}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>儲存此夥伴主檔</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 彈窗 2：登記支票往來資訊 Modal */}
      {/* ======================================================== */}
      {isChequeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    登記支票往來資訊 (收票 / 開票)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    票面金融機構代碼、扣款帳戶、發票日、約定兌現日與附件
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChequeModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* 收發方向與狀態 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">支票收發方向</label>
                  <select
                    value={editingCheque.direction || 'RECEIPT'}
                    onChange={e =>
                      setEditingCheque({ ...editingCheque, direction: e.target.value as any })
                    }
                    className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="RECEIPT">📥 收受支票 (業主款 / 存入)</option>
                    <option value="PAYMENT">📤 開立支票 (付廠商款 / 支出)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">支票狀態</label>
                  <select
                    value={editingCheque.status || 'RECEIVED'}
                    onChange={e =>
                      setEditingCheque({ ...editingCheque, status: e.target.value as any })
                    }
                    className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="RECEIVED">已收受 (未到期)</option>
                    <option value="ISSUED">已開立 (未到期)</option>
                    <option value="DEPOSITED">已存入託收</option>
                    <option value="CLEARED">已兌現入帳</option>
                    <option value="BOUNCED">退票拒付</option>
                    <option value="VOIDED">作廢無效</option>
                  </select>
                </div>
              </div>

              {/* 調用 TaiwanBankPickerWidget 小程式選取付款金融機構 */}
              <TaiwanBankPickerWidget
                bankCode={editingCheque.bankCode || '004'}
                bankName={editingCheque.bankName || '臺灣銀行'}
                onChange={({ bankCode, bankName }) => {
                  setEditingCheque({ ...editingCheque, bankCode, bankName });
                }}
                label="付款銀行金融機構 (全國 400+ 金融資料庫速查)"
                required
              />

              {/* 分行與扣款帳號 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">付款分行名稱</label>
                  <input
                    type="text"
                    value={editingCheque.branchName || ''}
                    onChange={e => setEditingCheque({ ...editingCheque, branchName: e.target.value })}
                    placeholder="例：城中分行、營業部"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">支票扣款帳號</label>
                  <input
                    type="text"
                    value={editingCheque.accountNumber || ''}
                    onChange={e =>
                      setEditingCheque({ ...editingCheque, accountNumber: e.target.value.trim() })
                    }
                    placeholder="支存帳號"
                    className="w-full text-xs p-2 font-mono font-bold bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* 支票號碼與金額 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    支票號碼 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingCheque.checkNumber || ''}
                    onChange={e =>
                      setEditingCheque({
                        ...editingCheque,
                        checkNumber: e.target.value.trim().toUpperCase()
                      })
                    }
                    placeholder="票面號碼 (例：CQ-882201)"
                    className="w-full text-xs font-mono font-bold p-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    票面金額 (新臺幣) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingCheque.amount || ''}
                    onChange={e =>
                      setEditingCheque({
                        ...editingCheque,
                        amount: Math.max(0, Number(e.target.value))
                      })
                    }
                    placeholder="請輸入金額"
                    className="w-full text-xs font-mono font-bold p-2 bg-white border border-slate-300 rounded-lg text-indigo-700"
                  />
                </div>
              </div>

              {/* 受款人抬頭與禁止背書轉讓 */}
              <div className="grid grid-cols-3 gap-3 items-center">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">受款人抬頭</label>
                  <input
                    type="text"
                    value={editingCheque.payeeName || ''}
                    onChange={e => setEditingCheque({ ...editingCheque, payeeName: e.target.value })}
                    placeholder="受款人全稱"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="pt-5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingCheque.isNonNegotiable)}
                      onChange={e =>
                        setEditingCheque({ ...editingCheque, isNonNegotiable: e.target.checked })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span>禁止背書轉讓</span>
                  </label>
                </div>
              </div>

              {/* 日期管理與票據法快捷計算連動 */}
              <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>票期時間節點與快捷連動</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      收票日 / 寄發日
                    </label>
                    <input
                      type="date"
                      value={editingCheque.receivedDate || ''}
                      onChange={e => setEditingCheque({ ...editingCheque, receivedDate: e.target.value })}
                      className="w-full text-xs font-mono p-1.5 bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      發票日 (開票日)
                    </label>
                    <input
                      type="date"
                      value={editingCheque.issueDate || ''}
                      onChange={e => setEditingCheque({ ...editingCheque, issueDate: e.target.value })}
                      className="w-full text-xs font-mono p-1.5 bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-700 mb-0.5">
                      約定兌現日 (到期日)
                    </label>
                    <input
                      type="date"
                      value={editingCheque.dueDate || ''}
                      onChange={e => setEditingCheque({ ...editingCheque, dueDate: e.target.value })}
                      className="w-full text-xs font-mono font-bold p-1.5 bg-white border border-indigo-300 rounded text-indigo-800"
                    />
                  </div>
                </div>

                {/* 快捷填入按鈕組 */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                  <span className="text-slate-500 font-semibold">⚡ 快捷計算兌現日：</span>
                  <button
                    type="button"
                    onClick={() => {
                      const base = editingCheque.issueDate || new Date().toISOString().slice(0, 10);
                      setEditingCheque({ ...editingCheque, dueDate: base });
                    }}
                    className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-bold"
                  >
                    見票即付 (同開票日)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const base = new Date(editingCheque.issueDate || new Date());
                      base.setDate(base.getDate() + 30);
                      setEditingCheque({ ...editingCheque, dueDate: base.toISOString().slice(0, 10) });
                    }}
                    className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-bold"
                  >
                    30 天期
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const base = new Date(editingCheque.issueDate || new Date());
                      base.setDate(base.getDate() + 60);
                      setEditingCheque({ ...editingCheque, dueDate: base.toISOString().slice(0, 10) });
                    }}
                    className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-bold"
                  >
                    60 天期
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const base = new Date(editingCheque.issueDate || new Date());
                      base.setFullYear(base.getFullYear() + 1);
                      setEditingCheque({ ...editingCheque, dueDate: base.toISOString().slice(0, 10) });
                    }}
                    className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-bold"
                  >
                    法定一年時效 (+1年)
                  </button>
                </div>
              </div>

              {/* 支票影本多檔案上傳 */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    支票正反面影本 / PDF 掃描檔
                  </span>
                  <label className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded cursor-pointer flex items-center gap-1 shadow-2xs">
                    <Upload className="w-3 h-3" />
                    <span>上傳影本</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={e =>
                        handleProcessUploadedFiles(e.target.files, newFiles => {
                          setEditingCheque({
                            ...editingCheque,
                            chequeFiles: [...(editingCheque.chequeFiles || []), ...newFiles]
                          });
                        })
                      }
                    />
                  </label>
                </div>

                {editingCheque.chequeFiles && editingCheque.chequeFiles.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {editingCheque.chequeFiles.map((f, i) => (
                      <div key={f.id || i} className="bg-white p-1.5 rounded border border-slate-200">
                        <div
                          className="aspect-video bg-slate-100 rounded overflow-hidden flex items-center justify-center cursor-pointer"
                          onClick={() =>
                            setLightboxMedia({
                              url: f.dataUrl,
                              title: f.name,
                              isPdf: f.fileType === 'PDF'
                            })
                          }
                        >
                          {f.fileType === 'PDF' ? (
                            <FileText className="w-6 h-6 text-red-600" />
                          ) : (
                            <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-1 text-[10px]">
                          <span className="truncate max-w-[80px]" title={f.name}>{f.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const list = editingCheque.chequeFiles!.filter((_, idx) => idx !== i);
                              setEditingCheque({ ...editingCheque, chequeFiles: list });
                            }}
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">尚未上傳支票照片或 PDF</div>
                )}
              </div>

              {/* 🌟 備註說明 (改為多行 TextArea，杜絕備註被截斷) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  支票備註與用途說明 (Notes)
                </label>
                <textarea
                  rows={2}
                  value={editingCheque.notes || ''}
                  onChange={e => setEditingCheque({ ...editingCheque, notes: e.target.value })}
                  placeholder="例：南港住宅大樓案第 2 期合約估驗訂金，約定次月 5 日提示兌領..."
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsChequeModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveCheque}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>儲存支票記錄</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 彈窗 3：已開立/已收受支票詳細資訊點開彈窗 (ChequeDetailModal) */}
      {/* ======================================================== */}
      {selectedChequeForDetail && (
        <ChequeDetailModal
          cheque={selectedChequeForDetail}
          partnerName={partners.find(p => p.id === selectedChequeForDetail.partnerId)?.name}
          onClose={() => setSelectedChequeForDetail(null)}
          onEdit={chk => {
            setEditingCheque(chk);
            setSelectedChequeForDetail(null);
            setIsChequeModalOpen(true);
          }}
          onDelete={id => {
            setDeleteConfirmTarget({
              type: 'CHEQUE',
              id,
              partnerId: selectedChequeForDetail.partnerId,
              name: `支票 ${selectedChequeForDetail.checkNumber}`
            });
          }}
          onPreviewMedia={media => setLightboxMedia(media)}
          onStatusChange={(id, newStatus) => {
            const updated = { ...selectedChequeForDetail, status: newStatus };
            savePartnerChequeRecord(updated, currentUser?.fullName || '系統管理員');
            setSelectedChequeForDetail(updated);
            reloadData();
            showToast(`✅ 支票狀態已更新為：${newStatus}`);
          }}
          canWrite={canWrite}
        />
      )}

      {/* ======================================================== */}
      {/* 彈窗 4：快速交換/上傳名片 Modal */}
      {/* ======================================================== */}
      {isCardModalOpen && cardTargetPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Contact className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    交換/上傳商業名片 ({cardTargetPartner.name})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    建檔拜訪名片聯絡人資訊與名片圖檔/PDF
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCardModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3.5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    姓名 (名片稱謂) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingCard.name || ''}
                    onChange={e => setEditingCard({ ...editingCard, name: e.target.value })}
                    placeholder="姓名"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">職稱</label>
                  <input
                    type="text"
                    value={editingCard.title || ''}
                    onChange={e => setEditingCard({ ...editingCard, title: e.target.value })}
                    placeholder="例：業務處協理、工地主任"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">手機號碼</label>
                  <input
                    type="text"
                    value={editingCard.mobile || ''}
                    onChange={e => setEditingCard({ ...editingCard, mobile: e.target.value })}
                    placeholder="09xx-xxx-xxx"
                    className="w-full text-xs p-2 font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">總機/公司電話</label>
                  <input
                    type="text"
                    value={editingCard.phone || ''}
                    onChange={e => setEditingCard({ ...editingCard, phone: e.target.value })}
                    placeholder="02-xxxx-xxxx"
                    className="w-full text-xs p-2 font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">電子郵件信箱</label>
                <input
                  type="email"
                  value={editingCard.email || ''}
                  onChange={e => setEditingCard({ ...editingCard, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              {/* 上傳名片正面圖檔或 PDF */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    名片正面圖檔 / PDF 掃描檔
                  </span>
                  <label className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded cursor-pointer flex items-center gap-1 shadow-2xs">
                    <Upload className="w-3 h-3" />
                    <span>選取圖檔/PDF</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={e =>
                        handleProcessUploadedFiles(e.target.files, files => {
                          if (files[0]) {
                            setEditingCard({
                              ...editingCard,
                              cardFrontUrl: files[0].dataUrl,
                              cardFileType: files[0].fileType
                            });
                          }
                        })
                      }
                    />
                  </label>
                </div>

                {editingCard.cardFrontUrl ? (
                  <div className="relative aspect-16/9 bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                    {editingCard.cardFileType === 'PDF' ? (
                      <div className="text-red-600 flex flex-col items-center">
                        <FileText className="w-10 h-10" />
                        <span className="text-xs font-bold">PDF 名片掃描文件</span>
                      </div>
                    ) : (
                      <img
                        src={editingCard.cardFrontUrl}
                        alt="名片正面"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingCard({ ...editingCard, cardFrontUrl: undefined })}
                      className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic text-center py-4">
                    尚未選取名片圖檔 (拍照上傳或選取 PDF)
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">名片備註</label>
                <input
                  type="text"
                  value={editingCard.notes || ''}
                  onChange={e => setEditingCard({ ...editingCard, notes: e.target.value })}
                  placeholder="例：於南港展覽館建材展交換，主要接洽泥作工程"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsCardModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveCard}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>收存名片</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 彈窗 5：一鍵從合作廠商引薦變業主 Modal */}
      {/* ======================================================== */}
      {isConvertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-amber-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    一鍵自合作廠商加入變業主 (SSoT 單一真實來源)
                  </h3>
                  <p className="text-xs text-slate-500">
                    從既有合作廠商中選取，賦予其業主客戶身分，無需重複鍵檔
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConvertModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={vendorSearchTerm}
                onChange={e => setVendorSearchTerm(e.target.value)}
                placeholder="搜尋合作廠商名稱、統一編號..."
                className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
              {partners
                .filter(p => p.isVendor && !p.isCustomer)
                .filter(p =>
                  vendorSearchTerm.trim()
                    ? p.name.includes(vendorSearchTerm) || p.taxId.includes(vendorSearchTerm)
                    : true
                )
                .map(v => (
                  <div
                    key={v.id}
                    className="pt-2 flex items-center justify-between hover:bg-slate-50 p-2 rounded-lg"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-800">{v.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">統編：{v.taxId}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExecuteConvert(v)}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                    >
                      加入業主名冊
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 彈窗 6：自訂 In-App 刪除確認 Modal (100% 杜絕 iframe 攔截) */}
      {/* ======================================================== */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-red-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  確定要刪除「{deleteConfirmTarget.name}」嗎？
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {deleteConfirmTarget.type === 'PARTNER'
                    ? '此操作將對商業夥伴執行軟刪除，相關報價、估驗與歷史合約紀錄仍完整保留。'
                    : deleteConfirmTarget.type === 'CARD'
                    ? '此操作將自該商業夥伴檔案中移除此張名片。'
                    : '此操作將自該商業夥伴檔案中移除此筆支票交易記錄。'}
                </p>
              </div>
            </div>

            {deleteConfirmTarget.extraNotice && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                {deleteConfirmTarget.extraNotice}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                取消
              </button>

              {deleteConfirmTarget.type === 'PARTNER' && deleteConfirmTarget.isBoth && (
                <button
                  type="button"
                  onClick={() =>
                    handleExecuteDeletePartner(deleteConfirmTarget.id, deleteConfirmTarget.name, true)
                  }
                  className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  僅自業主移除 (保留廠商)
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (deleteConfirmTarget.type === 'PARTNER') {
                    handleExecuteDeletePartner(deleteConfirmTarget.id, deleteConfirmTarget.name, false);
                  } else if (deleteConfirmTarget.type === 'CARD') {
                    handleExecuteDeleteCard(deleteConfirmTarget.id, deleteConfirmTarget.partnerId);
                  } else {
                    handleExecuteDeleteCheque(deleteConfirmTarget.id, deleteConfirmTarget.partnerId);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-2xs"
              >
                確認徹底刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 彈窗 7：通用小程式專區全螢幕展示視窗 */}
      {/* ======================================================== */}
      {isMiniAppsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col h-[90vh] overflow-hidden">
            <div className="px-6 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold text-white">
                  通用小程式專區與元件庫 (Mini-Apps Hub)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMiniAppsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <MiniAppsWorkspace onNotify={onNotify} />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 彈窗 8：全螢幕高解析度 Lightbox (呼叫 MediaPreviewLightbox 小程式) */}
      {/* ======================================================== */}
      {lightboxMedia && (
        <MediaPreviewLightbox
          media={lightboxMedia}
          onClose={() => setLightboxMedia(null)}
        />
      )}

      {/* ======================================================== */}
      {/* 浮動大圖預覽 Popover (滑鼠移過即時清晰大圖) */}
      {/* ======================================================== */}
      {hoverPreview && (
        <div
          style={{
            position: 'fixed',
            left: Math.max(10, Math.min(window.innerWidth - 420, hoverPreview.x)),
            top: Math.max(10, Math.min(window.innerHeight - 320, hoverPreview.y)),
            zIndex: 9999
          }}
          className="w-96 bg-white p-2.5 rounded-2xl shadow-2xl border-2 border-indigo-500/30 pointer-events-none animate-in fade-in zoom-in-95"
        >
          <div className="text-[11px] font-bold text-slate-800 truncate mb-1">
            {hoverPreview.title}
          </div>
          {hoverPreview.isPdf ? (
            <div className="h-56 bg-red-50 rounded-xl flex flex-col items-center justify-center text-red-600 gap-2 border border-red-200">
              <FileText className="w-12 h-12" />
              <span className="text-xs font-bold">PDF 文件憑證 (點擊開燈箱檢視)</span>
            </div>
          ) : (
            <img
              src={hoverPreview.url}
              alt="Preview"
              className="w-full h-56 object-contain rounded-xl bg-slate-900/5 border border-slate-200"
            />
          )}
          <div className="text-[10px] text-slate-400 text-center mt-1">
            點擊可放大全螢幕檢視與下載
          </div>
        </div>
      )}
    </div>
  );
};
