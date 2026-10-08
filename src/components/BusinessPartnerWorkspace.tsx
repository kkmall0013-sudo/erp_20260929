import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Info
} from 'lucide-react';

import {
  BusinessPartner,
  PartnerAddress,
  PartnerContact,
  BPBankAccount,
  PartnerChequeRecord,
  PartnerServiceCategoryItem,
  StoredMediaFile
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
  TAIWAN_POSTAL_CODES,
  getTaiwanCities,
  getDistrictsByCity,
  getPostalCode,
  parseTaiwanAddress
} from '../utils/taiwanPostalCodes';

import {
  getAllBusinessPartners,
  getBusinessPartnerById,
  saveBusinessPartner,
  deleteBusinessPartner,
  convertVendorToClient,
  savePartnerChequeRecord,
  deletePartnerChequeRecord
} from '../db/sqlite';

import { useAuth } from '../context/AuthContext';

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
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });
}

// 讀取 PDF 檔案為 Data URL
function readPdfFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });
}

export const BusinessPartnerWorkspace: React.FC<BusinessPartnerWorkspaceProps> = ({
  onNotify
}) => {
  const { currentUser, isSuperadmin, can } = useAuth();
  const canWrite = isSuperadmin || can('PARTNERS', 'write');

  // 主視圖雙頁籤：業主名冊 (CLIENTS) vs 合作廠商 (VENDORS)
  const [activeTab, setActiveTab] = useState<'CLIENTS' | 'VENDORS'>('CLIENTS');

  // 資料列表狀態
  const [partners, setPartners] = useState<BusinessPartner[]>(() => getAllBusinessPartners());

  // 搜尋與篩選條件
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'NORMAL' | 'HIGH_RISK'>('ALL');

  // 卡片展開查看支票往來歷程之夥伴 ID 集合
  const [expandedChequePartnerIds, setExpandedChequePartnerIds] = useState<Record<string, boolean>>({});

  // 彈窗狀態：夥伴編輯器
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<BusinessPartner | null>(null);
  const [activeEditorTab, setActiveEditorTab] = useState<'BASIC' | 'CATEGORY' | 'ADDRESSES' | 'CONTACTS' | 'BANK' | 'CHEQUES'>('BASIC');

  // 彈窗狀態：一鍵自廠商引薦加入變業主 (Vendor to Client)
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');

  // 彈窗狀態：新增/編輯支票往來記錄
  const [isChequeModalOpen, setIsChequeModalOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<Partial<PartnerChequeRecord>>({
    direction: 'RECEIPT',
    isNonNegotiable: true,
    status: 'RECEIVED',
    amount: 0,
    receivedDate: new Date().toISOString().slice(0, 10),
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    bankCode: '004',
    bankName: '臺灣銀行',
    chequeFiles: []
  });

  // 支票彈窗中的金融機構即時搜尋下拉選單狀態
  const [chequeBankSearch, setChequeBankSearch] = useState('');
  const [isChequeBankDropdownOpen, setIsChequeBankDropdownOpen] = useState(false);

  // 夥伴編輯器金融機構即時搜尋下拉選單狀態
  const [partnerBankSearch, setPartnerBankSearch] = useState('');
  const [isPartnerBankDropdownOpen, setIsPartnerBankDropdownOpen] = useState(false);

  // 自訂工項即時輸入
  const [customTradeInput, setCustomTradeInput] = useState('');

  // 自訂 In-App 刪除確認彈窗 (替代被 iframe 攔截的 window.confirm)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'PARTNER' | 'CHEQUE';
    id: string;
    partnerId?: string;
    name: string;
    extraNotice?: string;
  } | null>(null);

  // 全螢幕高解析度 Lightbox 預覽視窗 (支援大圖與 PDF 嵌入)
  const [lightboxMedia, setLightboxMedia] = useState<{
    url: string;
    title: string;
    isPdf: boolean;
  } | null>(null);

  // 浮動大圖預覽 (Hover Popover)
  const [hoverPreview, setHoverPreview] = useState<{
    url: string;
    title: string;
    isPdf: boolean;
    x: number;
    y: number;
  } | null>(null);

  const reloadData = () => {
    const list = getAllBusinessPartners();
    setPartners(list);
  };

  const showToast = (msg: string) => {
    if (onNotify) {
      onNotify(msg);
    }
  };

  // 統計數量
  const clientsCount = useMemo(() => partners.filter(p => p.isCustomer).length, [partners]);
  const vendorsCount = useMemo(() => partners.filter(p => p.isVendor).length, [partners]);

  // 工項大類次分類連動
  const currentSubCategories = useMemo(() => {
    if (!selectedMainCategory || selectedMainCategory === 'ALL') return [];
    const group = ENGINEERING_CATEGORIES.find(g => g.mainCategory === selectedMainCategory);
    return group ? group.subCategories : [];
  }, [selectedMainCategory]);

  // 依條件過濾後的夥伴清單
  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      // 雙頁籤身分分流
      if (activeTab === 'CLIENTS' && !p.isCustomer) return false;
      if (activeTab === 'VENDORS' && !p.isVendor) return false;

      // 風險條件
      if (riskFilter === 'NORMAL' && p.isHighRisk) return false;
      if (riskFilter === 'HIGH_RISK' && !p.isHighRisk) return false;

      // 工項大類篩選
      if (selectedMainCategory !== 'ALL') {
        const hasMain =
          p.serviceCategoryMain === selectedMainCategory ||
          (p.serviceCategories || []).some(c => c.main === selectedMainCategory);
        if (!hasMain) return false;
      }

      // 工項細類篩選
      if (selectedSubCategory !== 'ALL') {
        const hasSub =
          p.serviceCategorySub === selectedSubCategory ||
          (p.serviceCategories || []).some(c => c.sub === selectedSubCategory);
        if (!hasSub) return false;
      }

      // 關鍵字搜尋 (支援編號、名稱、統編、電話、聯絡人、地址、銀行、支票號碼)
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const inCode = p.bpCode.toLowerCase().includes(q);
        const inName = p.name.toLowerCase().includes(q);
        const inTaxId = p.taxId.toLowerCase().includes(q);
        const inContact = p.contactPerson.toLowerCase().includes(q);
        const inPhone = p.phone.toLowerCase().includes(q);
        const inAddress = p.address.toLowerCase().includes(q);
        const inBank = (p.bankName || '').toLowerCase().includes(q);
        const inCheque = (p.chequeRecords || []).some(
          c => c.checkNumber.toLowerCase().includes(q) || (c.payeeName || '').toLowerCase().includes(q)
        );
        const inMultiCategory = (p.serviceCategories || []).some(
          c => c.main.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q)
        );

        return inCode || inName || inTaxId || inContact || inPhone || inAddress || inBank || inCheque || inMultiCategory;
      }

      return true;
    });
  }, [partners, activeTab, searchTerm, selectedMainCategory, selectedSubCategory, riskFilter]);

  // 可供「一鍵加入變業主」的現存合格廠商清單 (尚未成為業主者)
  const nonClientVendors = useMemo(() => {
    return partners.filter(p => {
      if (!p.isVendor) return false;
      if (p.isCustomer) return false; // 已經是業主的不重複引薦
      if (!vendorSearchTerm.trim()) return true;
      const q = vendorSearchTerm.trim().toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.taxId.toLowerCase().includes(q) ||
        p.bpCode.toLowerCase().includes(q) ||
        p.contactPerson.toLowerCase().includes(q)
      );
    });
  }, [partners, vendorSearchTerm]);

  // 開啟「新增商業夥伴」
  const handleOpenCreatePartner = () => {
    const isClientMode = activeTab === 'CLIENTS';
    const newBp: BusinessPartner = {
      id: '',
      bpCode: '',
      name: '',
      taxId: '',
      entityType: 'CORPORATION',
      type: isClientMode ? 'CUSTOMER' : 'VENDOR',
      isCustomer: isClientMode,
      isVendor: !isClientMode,
      serviceCategoryMain: isClientMode ? undefined : '泥作裝修工程',
      serviceCategorySub: isClientMode ? undefined : '泥作粉刷工程',
      serviceCategories: isClientMode
        ? []
        : [{ id: `CAT-${Date.now()}`, main: '泥作裝修工程', sub: '泥作粉刷工程' }],
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
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
          id: `PADDR-${Date.now()}`,
          partnerId: '',
          addressType: 'COMMUNICATION',
          label: '通訊地址',
          postalCode: '100',
          city: '臺北市',
          district: '中正區',
          fullAddress: '',
          isDeleted: false
        }
      ],
      contacts: [
        {
          id: `PCON-${Date.now()}`,
          partnerId: '',
          contactType: 'PRIMARY',
          name: '',
          title: '負責窗口',
          phone: '',
          mobile: '',
          extension: '',
          email: '',
          isDeleted: false
        }
      ],
      bankAccounts: [
        {
          id: `BACC-${Date.now()}`,
          bpId: '',
          bankCode: '004',
          bankName: '臺灣銀行',
          accountNumber: '',
          accountName: '',
          isPrimary: true,
          passbookFiles: []
        }
      ],
      chequeRecords: []
    };
    setEditingPartner(newBp);
    setActiveEditorTab('BASIC');
    setIsEditorOpen(true);
  };

  // 開啟「編輯商業夥伴」
  const handleEditPartner = (p: BusinessPartner) => {
    const partnerCopy = JSON.parse(JSON.stringify(p)) as BusinessPartner;
    if (!partnerCopy.addresses || partnerCopy.addresses.length === 0) {
      partnerCopy.addresses = [
        {
          id: `PADDR-${Date.now()}`,
          partnerId: p.id,
          addressType: 'COMMUNICATION',
          label: '主要地址',
          fullAddress: p.address || '',
          postalCode: '100',
          city: '臺北市',
          district: '中正區',
          isDeleted: false
        }
      ];
    }
    if (!partnerCopy.contacts || partnerCopy.contacts.length === 0) {
      partnerCopy.contacts = [
        {
          id: `PCON-${Date.now()}`,
          partnerId: p.id,
          contactType: 'PRIMARY',
          name: p.contactPerson || '',
          title: '主要聯絡人',
          phone: p.phone || '',
          mobile: p.phone || '',
          extension: '',
          email: p.email || '',
          isDeleted: false
        }
      ];
    }
    if (!partnerCopy.bankAccounts || partnerCopy.bankAccounts.length === 0) {
      partnerCopy.bankAccounts = [
        {
          id: `BACC-${Date.now()}`,
          bpId: p.id,
          bankCode: p.bankCode || '004',
          bankName: p.bankName || '臺灣銀行',
          accountNumber: p.bankAccount || '',
          accountName: p.bankAccountName || p.name,
          isPrimary: true,
          passbookFiles: []
        }
      ];
    }
    if (!partnerCopy.serviceCategories) {
      partnerCopy.serviceCategories = [];
      if (partnerCopy.serviceCategoryMain) {
        partnerCopy.serviceCategories.push({
          id: `CAT-${Date.now()}`,
          main: partnerCopy.serviceCategoryMain,
          sub: partnerCopy.serviceCategorySub || ''
        });
      }
    }

    setEditingPartner(partnerCopy);
    setActiveEditorTab('BASIC');
    setIsEditorOpen(true);
  };

  // 儲存夥伴
  const handleSavePartner = () => {
    if (!editingPartner) return;
    if (!editingPartner.name.trim()) {
      showToast('⚠️ 請填寫商業夥伴全稱！');
      return;
    }
    if (!editingPartner.taxId.trim()) {
      showToast('⚠️ 請填寫統一編號或身分證號！');
      return;
    }

    // 檢查統編有效性
    if (editingPartner.entityType === 'NATURAL_PERSON') {
      const valNat = validateTaiwanNationalId(editingPartner.taxId);
      if (!valNat.isValid) {
        showToast(`⚠️ 身分證檢核警示：${valNat.message}`);
      }
    } else {
      const valTax = validateTaiwanTaxId(editingPartner.taxId);
      if (!valTax.isValid) {
        showToast(`⚠️ 統一編號檢核警示：${valTax.message}`);
      }
    }

    try {
      const operator = currentUser?.fullName || '系統管理員';
      const saved = saveBusinessPartner(editingPartner, operator);
      reloadData();
      setIsEditorOpen(false);
      setEditingPartner(null);
      showToast(`✅ 已成功儲存商業夥伴：${saved.name}`);
    } catch (err: any) {
      showToast('❌ 儲存失敗：' + (err.message || '未知錯誤'));
    }
  };

  // 執行刪除商業夥伴
  const handleExecuteDeletePartner = (id: string, name: string) => {
    try {
      const operator = currentUser?.fullName || '系統管理員';
      deleteBusinessPartner(id, operator);
      reloadData();
      setDeleteConfirmTarget(null);
      showToast(`🗑️ 已成功刪除商業夥伴：${name}`);
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

    setEditingCheque({
      direction: defaultDirection,
      partnerId,
      bankCode: bCode,
      bankName: bInfo ? bInfo.name : (p?.bankName || '臺灣銀行'),
      branchName: '',
      accountNumber: p?.bankAccount || '',
      checkNumber: '',
      receivedDate: new Date().toISOString().slice(0, 10),
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      amount: 0,
      payeeName: defaultDirection === 'RECEIPT' ? '台灣大巨營造工程股份有限公司' : (p?.name || ''),
      isNonNegotiable: true,
      status: defaultDirection === 'RECEIPT' ? 'RECEIVED' : 'ISSUED',
      notes: '',
      chequeFiles: []
    });
    setChequeBankSearch('');
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

      // 同步更新當前正在編輯的夥伴狀態，確保編輯器內「6. 支票往來記錄」頁籤即時顯示
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
      showToast('🗑️ 已成功刪除支票記錄');
    } catch (err: any) {
      showToast('❌ 刪除失敗：' + (err.message || '未知錯誤'));
    }
  };

  // 處理上傳檔案 (支援多檔案、圖片壓縮、PDF 解析)
  const handleProcessUploadedFiles = async (
    files: FileList | null,
    onSuccess: (newFiles: StoredMediaFile[]) => void
  ) => {
    if (!files || files.length === 0) return;
    const resultFiles: StoredMediaFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      try {
        let dataUrl = '';
        if (isPdf) {
          dataUrl = await readPdfFile(file);
        } else {
          dataUrl = await compressImageFile(file);
        }

        resultFiles.push({
          id: `FILE-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          dataUrl,
          fileType: isPdf ? 'PDF' : 'IMAGE',
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('File read error:', err);
      }
    }

    if (resultFiles.length > 0) {
      onSuccess(resultFiles);
      showToast(`📁 已成功載入 ${resultFiles.length} 個附件憑證！`);
    }
  };

  // 統編即時檢核狀態計算
  const taxIdValidationInfo = useMemo(() => {
    if (!editingPartner || !editingPartner.taxId?.trim()) {
      return { status: 'EMPTY', text: '請輸入 8 碼公司統一編號或 10 碼自然人身分證' };
    }
    const val = editingPartner.taxId.trim().toUpperCase();
    if (editingPartner.entityType === 'NATURAL_PERSON') {
      const res = validateTaiwanNationalId(val);
      return {
        status: res.isValid ? 'VALID' : 'INVALID',
        text: res.message
      };
    } else {
      const res = validateTaiwanTaxId(val);
      return {
        status: res.isValid ? 'VALID' : 'INVALID',
        text: res.message
      };
    }
  }, [editingPartner?.taxId, editingPartner?.entityType]);

  // 金融機構搜尋結果 (夥伴編輯器)
  const filteredPartnerBanks = useMemo(() => {
    return searchTaiwanBanks(partnerBankSearch);
  }, [partnerBankSearch]);

  // 金融機構搜尋結果 (支票彈窗)
  const filteredChequeBanks = useMemo(() => {
    return searchTaiwanBanks(chequeBankSearch);
  }, [chequeBankSearch]);

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* 頂部主控看板 Header & 雙頁籤切換 */}
      {/* ======================================================== */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">
              <Building2 className="w-4 h-4" />
              <span>CRM & SRM 雙軌夥伴管理中心</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>商業夥伴名冊</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                SSoT 單一真實來源架構
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              整合業主客戶 (CRM) 與協力發包廠商 (SRM) 之雙向主檔、多地址通訊、全國金融金流、出納存摺影本與支票收發歷程。
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* 一鍵引薦變業主按鈕 (僅在業主名冊頁籤顯示) */}
            {activeTab === 'CLIENTS' && canWrite && (
              <button
                onClick={() => {
                  setVendorSearchTerm('');
                  setIsConvertModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50/70 hover:bg-amber-100/70 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs hover:shadow-xs active:scale-95"
                title="從既有合作廠商快速轉換或引薦為業主"
              >
                <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                <span>一鍵從廠商引薦加入業主</span>
              </button>
            )}

            {/* 新增夥伴主檔按鈕 */}
            {canWrite && (
              <button
                onClick={handleOpenCreatePartner}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>{activeTab === 'CLIENTS' ? '新增業主資料' : '新增合作廠商'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 雙頁籤切換：業主名冊 (客戶) vs 合作廠商 (工班/材料) */}
        <div className="flex items-center border-b border-slate-200">
          <button
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
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'CLIENTS'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {clientsCount}
            </span>
          </button>

          <button
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
            <span>合作廠商名冊 (材料商 / 專業工班)</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'VENDORS'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {vendorsCount}
            </span>
          </button>
        </div>

        {/* 篩選與搜尋工具列 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
          {/* 關鍵字搜尋 */}
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜尋編號、名稱、統編、電話、支票..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* 第一階：主要工項大類篩選 */}
          <div>
            <select
              value={selectedMainCategory}
              onChange={e => {
                setSelectedMainCategory(e.target.value);
                setSelectedSubCategory('ALL');
              }}
              className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700"
            >
              <option value="ALL">全部工項大類 (不限)</option>
              {ENGINEERING_CATEGORIES.map(g => (
                <option key={g.mainCategory} value={g.mainCategory}>
                  {g.mainCategory}
                </option>
              ))}
            </select>
          </div>

          {/* 第二階：細項工種篩選 */}
          <div>
            <select
              value={selectedSubCategory}
              onChange={e => setSelectedSubCategory(e.target.value)}
              disabled={selectedMainCategory === 'ALL'}
              className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 disabled:opacity-50"
            >
              <option value="ALL">全部細項工種 (不限)</option>
              {currentSubCategories.map(sub => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* 風控與黑名單篩選 */}
          <div>
            <select
              value={riskFilter}
              onChange={e => setRiskFilter(e.target.value as any)}
              className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700"
            >
              <option value="ALL">全部風險等級</option>
              <option value="NORMAL">✅ 正常優良夥伴</option>
              <option value="HIGH_RISK">⚠️ 高風險管制/黑名單</option>
            </select>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 商業夥伴卡片列表 Card Grid */}
      {/* ======================================================== */}
      <div className="space-y-4">
        {filteredPartners.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300 space-y-3">
            <Building2 className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700">查無符合條件之商業夥伴</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              目前搜尋條件下無任何記錄，您可以清除關鍵字或點擊上方「新增」按鈕快速建檔。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPartners.map(p => {
              const isHighRisk = Boolean(p.isHighRisk);
              const chequeCount = p.chequeRecords?.length || 0;
              const isChequeExpanded = Boolean(expandedChequePartnerIds[p.id]);

              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between overflow-hidden ${
                    isHighRisk
                      ? 'border-red-300 ring-1 ring-red-400/30'
                      : 'border-slate-200/80 hover:border-indigo-300'
                  }`}
                >
                  <div className="p-5 space-y-4">
                    {/* 卡片標題：名稱、統編、編號 */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {p.bpCode}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              p.entityType === 'NATURAL_PERSON'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {p.entityType === 'NATURAL_PERSON' ? '自然人' : '公司法人'}
                          </span>

                          {p.isCustomer && p.isVendor && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-indigo-500" />
                              <span>業主暨廠商</span>
                            </span>
                          )}

                          {isHighRisk && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" />
                              <span>風控管制</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-black text-slate-900 truncate tracking-tight">
                          {p.name}
                        </h3>

                        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                          <span>
                            {p.entityType === 'NATURAL_PERSON' ? '身分證' : '統一編號'}：
                            <strong className="text-slate-800 ml-1">{p.taxId}</strong>
                          </span>
                          {p.representative && (
                            <span>
                              負責人：<strong className="text-slate-800">{p.representative}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 工種標籤 (支援多項工種展示) */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Tag className="w-3 h-3" />
                        <span>工項服務類別：</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {p.serviceCategories && p.serviceCategories.length > 0 ? (
                          p.serviceCategories.map((c, idx) => (
                            <span
                              key={c.id || idx}
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100"
                            >
                              {c.main} {c.sub ? `› ${c.sub}` : ''}
                            </span>
                          ))
                        ) : p.serviceCategoryMain ? (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {p.serviceCategoryMain} {p.serviceCategorySub ? `› ${p.serviceCategorySub}` : ''}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">無特定工項分類</span>
                        )}
                      </div>
                    </div>

                    {/* 聯絡窗口與通訊地址 */}
                    <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800">
                          {p.contactPerson || '未設主要聯絡人'}
                        </span>
                        <span className="font-mono text-slate-500">{p.phone || '無電話'}</span>
                      </div>

                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-slate-600 line-clamp-1">
                          {p.addresses?.[0]?.postalCode && `[${p.addresses[0].postalCode}] `}
                          {p.addresses?.[0]?.fullAddress || p.address || '尚未登記通訊地址'}
                        </span>
                      </div>
                    </div>

                    {/* 金融機構與出納資訊 */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                          <span>
                            [{p.bankCode || '004'}] {p.bankName || '臺灣銀行'}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {p.bankFeePayer === 'PARTNER' ? '手續費廠商自付' : '手續費公司吸收'}
                        </span>
                      </div>
                      <div className="font-mono font-bold text-indigo-950 tracking-wider text-[11px]">
                        帳號：{p.bankAccount || '尚未登記匯款帳號'}
                      </div>

                      {/* 存摺封面照片預覽 */}
                      {p.bankAccounts?.[0]?.passbookFiles && p.bankAccounts[0].passbookFiles.length > 0 && (
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                          <span className="text-[10px] text-slate-400">存摺憑據 ({p.bankAccounts[0].passbookFiles.length})：</span>
                          <div className="flex items-center gap-1.5">
                            {p.bankAccounts[0].passbookFiles.map((file, fIdx) => (
                              <div
                                key={file.id || fIdx}
                                className="relative group cursor-pointer"
                                onClick={() =>
                                  setLightboxMedia({
                                    url: file.dataUrl,
                                    title: `${p.name} - ${file.name}`,
                                    isPdf: file.fileType === 'PDF'
                                  })
                                }
                                onMouseEnter={e => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoverPreview({
                                    url: file.dataUrl,
                                    title: file.name,
                                    isPdf: file.fileType === 'PDF',
                                    x: rect.right + 10,
                                    y: rect.top
                                  });
                                }}
                                onMouseLeave={() => setHoverPreview(null)}
                              >
                                {file.fileType === 'PDF' ? (
                                  <div className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-bold border border-red-200 flex items-center gap-0.5">
                                    <FileText className="w-3 h-3 text-red-500" />
                                    <span>PDF</span>
                                  </div>
                                ) : (
                                  <img
                                    src={file.dataUrl}
                                    alt={file.name}
                                    className="w-6 h-6 object-cover rounded border border-slate-300 group-hover:scale-105 transition-transform"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 支票歷程展開區域 (Accordion) */}
                  {isChequeExpanded && (
                    <div className="bg-slate-50/80 border-t border-slate-200 p-4 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                          <span>支票往來歷程明細 ({chequeCount} 筆)</span>
                        </h4>
                        <button
                          onClick={() => handleOpenAddCheque(p.id)}
                          className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>登記支票</span>
                        </button>
                      </div>

                      {chequeCount === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400 bg-white rounded-lg border border-dashed border-slate-300">
                          尚未登記任何支票記錄
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {p.chequeRecords?.map(chk => (
                            <div
                              key={chk.id}
                              className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs gap-3 shadow-2xs"
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
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
                                  <span className="font-mono font-extrabold text-indigo-600">
                                    NT$ {chk.amount.toLocaleString()}
                                  </span>
                                  {chk.isNonNegotiable && (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1 rounded font-semibold">
                                      禁背
                                    </span>
                                  )}
                                  <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold">
                                    {chk.status === 'CLEARED'
                                      ? '已兌現'
                                      : chk.status === 'DEPOSITED'
                                      ? '已存入'
                                      : chk.status === 'BOUNCED'
                                      ? '退票'
                                      : '未到期'}
                                  </span>
                                </div>

                                <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                                  <span>銀行：[{chk.bankCode}] {chk.bankName} {chk.branchName ? `(${chk.branchName})` : ''}</span>
                                  {chk.accountNumber && <span>帳號：{chk.accountNumber}</span>}
                                  <span>發票日：{chk.issueDate}</span>
                                  <span className="font-bold text-indigo-700">兌現日：{chk.dueDate}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {/* 預覽影本 */}
                                {(chk.chequeFileData || (chk.chequeFiles && chk.chequeFiles.length > 0)) && (
                                  <button
                                    onClick={() => {
                                      const primaryFile = chk.chequeFiles?.[0];
                                      setLightboxMedia({
                                        url: primaryFile?.dataUrl || chk.chequeFileData!,
                                        title: `支票影本：${chk.checkNumber}`,
                                        isPdf: primaryFile?.fileType === 'PDF'
                                      });
                                    }}
                                    onMouseEnter={e => {
                                      const url = chk.chequeFiles?.[0]?.dataUrl || chk.chequeFileData;
                                      if (!url) return;
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setHoverPreview({
                                        url,
                                        title: `支票：${chk.checkNumber}`,
                                        isPdf: chk.chequeFiles?.[0]?.fileType === 'PDF',
                                        x: rect.left - 430,
                                        y: rect.top - 80
                                      });
                                    }}
                                    onMouseLeave={() => setHoverPreview(null)}
                                    className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                    title="預覽支票影本 (移入浮動放大，點擊彈窗)"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* 刪除支票 */}
                                {canWrite && (
                                  <button
                                    onClick={() =>
                                      setDeleteConfirmTarget({
                                        type: 'CHEQUE',
                                        id: chk.id,
                                        partnerId: p.id,
                                        name: `支票號碼 ${chk.checkNumber} (NT$ ${chk.amount.toLocaleString()})`
                                      })
                                    }
                                    className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                                    title="刪除此筆支票"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 卡片底端操作按鈕列 */}
                  <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() =>
                        setExpandedChequePartnerIds(prev => ({
                          ...prev,
                          [p.id]: !prev[p.id]
                        }))
                      }
                      className="text-xs font-bold text-slate-600 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                    >
                      <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                      <span>支票往來歷程 ({chequeCount})</span>
                      {isChequeExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      {/* 登記新支票按鈕 */}
                      {canWrite && (
                        <button
                          onClick={() => handleOpenAddCheque(p.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors"
                          title="登記新收受或開立支票"
                        >
                          <Plus className="w-3 h-3 text-indigo-600" />
                          <span>登記支票</span>
                        </button>
                      )}

                      {/* 編輯按鈕 */}
                      {canWrite && (
                        <button
                          onClick={() => handleEditPartner(p)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>編輯</span>
                        </button>
                      )}

                      {/* 軟刪除按鈕 (彈出自訂 Modal，杜絕 iframe 攔截) */}
                      {canWrite && (
                        <button
                          onClick={() =>
                            setDeleteConfirmTarget({
                              type: 'PARTNER',
                              id: p.id,
                              name: p.name,
                              extraNotice: '執行軟刪除後，相關報價單、估驗單與歷史單據仍將完整保留以供稽核。'
                            })
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="刪除此夥伴"
                        >
                          <Trash2 className="w-4 h-4" />
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
      {/* 彈窗 1：商業夥伴全功能編輯器 (Detail & Master Modal) */}
      {/* ======================================================== */}
      {isEditorOpen && editingPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingPartner.id ? `編輯商業夥伴主檔：${editingPartner.name}` : '建立新商業夥伴主檔'}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                    <span>編號：{editingPartner.bpCode || '系統自動編號'}</span>
                    <span>•</span>
                    <span>身分：{editingPartner.isCustomer && editingPartner.isVendor ? '業主暨廠商' : editingPartner.isCustomer ? '業主 (發包方)' : '合作廠商 (協力包商)'}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 子頁籤導航 */}
            <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-1 overflow-x-auto shrink-0">
              <button
                onClick={() => setActiveEditorTab('BASIC')}
                className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeEditorTab === 'BASIC'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>1. 基本身分與風控</span>
              </button>

              <button
                onClick={() => setActiveEditorTab('CATEGORY')}
                className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeEditorTab === 'CATEGORY'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>2. 工項服務類別 ({editingPartner.serviceCategories?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveEditorTab('ADDRESSES')}
                className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeEditorTab === 'ADDRESSES'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>3. 多地址管理 ({editingPartner.addresses?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveEditorTab('CONTACTS')}
                className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeEditorTab === 'CONTACTS'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users2 className="w-3.5 h-3.5" />
                <span>4. 多聯絡人管理 ({editingPartner.contacts?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveEditorTab('BANK')}
                className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeEditorTab === 'BANK'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>5. 全國金融帳戶與存摺封面</span>
              </button>

              <button
                onClick={() => setActiveEditorTab('CHEQUES')}
                className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeEditorTab === 'CHEQUES'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>6. 支票往來歷程 ({editingPartner.chequeRecords?.length || 0})</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* ======================================================== */}
              {/* TAB 1: 基本身分與風控 */}
              {/* ======================================================== */}
              {activeEditorTab === 'BASIC' && (
                <div className="space-y-4">
                  {/* 法人別與業務身分 */}
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
                              setEditingPartner({
                                ...editingPartner,
                                entityType: 'CORPORATION'
                              })
                            }
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>公司法人 (具統一編號)</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="entityType"
                            checked={editingPartner.entityType === 'NATURAL_PERSON'}
                            onChange={() =>
                              setEditingPartner({
                                ...editingPartner,
                                entityType: 'NATURAL_PERSON'
                              })
                            }
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>自然人個人 (身分證號 / 點工師傅)</span>
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
                              setEditingPartner({
                                ...editingPartner,
                                isCustomer: e.target.checked
                              })
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>業主 (客戶 / 發包方)</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(editingPartner.isVendor)}
                            onChange={e =>
                              setEditingPartner({
                                ...editingPartner,
                                isVendor: e.target.checked
                              })
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>合作廠商 (協力包商 / 材料商)</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* 名稱與統編/身分證 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        夥伴名稱 / 公司全稱 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editingPartner.name}
                        onChange={e =>
                          setEditingPartner({
                            ...editingPartner,
                            name: e.target.value
                          })
                        }
                        placeholder="例：台灣水泥股份有限公司 (台北營業所)"
                        className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {editingPartner.entityType === 'NATURAL_PERSON'
                          ? '國民身分證字號 (10 碼)'
                          : '公司統一編號 (8 碼)'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editingPartner.taxId}
                        onChange={e =>
                          setEditingPartner({
                            ...editingPartner,
                            taxId: e.target.value.trim().toUpperCase()
                          })
                        }
                        placeholder={
                          editingPartner.entityType === 'NATURAL_PERSON'
                            ? '例：A123456789'
                            : '例：03754904'
                        }
                        className={`w-full text-xs p-2.5 font-mono bg-white border rounded-lg focus:ring-2 ${
                          taxIdValidationInfo.status === 'VALID'
                            ? 'border-emerald-500 focus:ring-emerald-500/20'
                            : taxIdValidationInfo.status === 'INVALID'
                            ? 'border-red-400 focus:ring-red-500/20'
                            : 'border-slate-300 focus:ring-indigo-500/20'
                        }`}
                      />
                      {/* 即時統編檢核回饋標籤 */}
                      <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                        {taxIdValidationInfo.status === 'VALID' ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{taxIdValidationInfo.text}</span>
                          </span>
                        ) : taxIdValidationInfo.status === 'INVALID' ? (
                          <span className="text-red-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{taxIdValidationInfo.text}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 flex items-center gap-1">
                            <Info className="w-3.5 h-3.5" />
                            <span>{taxIdValidationInfo.text}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 負責人與票期條件 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        法定代表人 / 負責人姓名
                      </label>
                      <input
                        type="text"
                        value={editingPartner.representative || ''}
                        onChange={e =>
                          setEditingPartner({
                            ...editingPartner,
                            representative: e.target.value
                          })
                        }
                        placeholder="例：張董事長"
                        className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        負責人身分證號 (防換殼防弊)
                      </label>
                      <input
                        type="text"
                        value={editingPartner.ownerIdNumber || ''}
                        onChange={e =>
                          setEditingPartner({
                            ...editingPartner,
                            ownerIdNumber: e.target.value.trim().toUpperCase()
                          })
                        }
                        placeholder="例：A100987654"
                        className="w-full text-xs p-2.5 font-mono bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        付款條件天數 (期票票期)
                      </label>
                      <select
                        value={editingPartner.paymentTermsDays || 30}
                        onChange={e =>
                          setEditingPartner({
                            ...editingPartner,
                            paymentTermsDays: Number(e.target.value)
                          })
                        }
                        className="w-full text-xs font-bold p-2.5 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value={0}>當月結清 (即期現金/匯款)</option>
                        <option value={15}>月結 15 天</option>
                        <option value={30}>月結 30 天 (標準慣例)</option>
                        <option value={45}>月結 45 天期票</option>
                        <option value={60}>月結 60 天期票</option>
                        <option value={90}>月結 90 天期票</option>
                      </select>
                    </div>
                  </div>

                  {/* 手續費負擔約定 */}
                  <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-emerald-900">
                          跨行匯款手續費約定負擔方 (工程實務慣例)
                        </h4>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                        預設：本公司全額吸收
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-emerald-200 cursor-pointer">
                        <input
                          type="radio"
                          name="bankFeePayer"
                          checked={editingPartner.bankFeePayer !== 'PARTNER'}
                          onChange={() =>
                            setEditingPartner({
                              ...editingPartner,
                              bankFeePayer: 'COMPANY'
                            })
                          }
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-semibold text-slate-800">
                          由本公司自行吸收 (請款100萬實匯100萬，不內扣)
                        </span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-emerald-200 cursor-pointer">
                        <input
                          type="radio"
                          name="bankFeePayer"
                          checked={editingPartner.bankFeePayer === 'PARTNER'}
                          onChange={() =>
                            setEditingPartner({
                              ...editingPartner,
                              bankFeePayer: 'PARTNER'
                            })
                          }
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-slate-700">由廠商自行吸收 (出納放款自款項內扣 30 元)</span>
                      </label>
                    </div>
                  </div>

                  {/* 風控與黑名單管制 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        <h4 className="text-xs font-bold text-slate-800">
                          防弊風控與黑名單管制
                        </h4>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(editingPartner.isHighRisk)}
                          onChange={e =>
                            setEditingPartner({
                              ...editingPartner,
                              isHighRisk: e.target.checked
                            })
                          }
                          className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-xs font-bold text-red-600">列入高風險管制黑名單</span>
                      </label>
                    </div>

                    {editingPartner.isHighRisk && (
                      <div className="space-y-1 animate-in fade-in">
                        <label className="block text-[11px] font-semibold text-red-700">
                          管制理由 / 爭議事件紀錄說明：
                        </label>
                        <textarea
                          rows={2}
                          value={editingPartner.riskReason || ''}
                          onChange={e =>
                            setEditingPartner({
                              ...editingPartner,
                              riskReason: e.target.value
                            })
                          }
                          placeholder="例如：曾有工程逾期爭議紀錄，發包或計價前需副總以上特許核可..."
                          className="w-full text-xs p-2 bg-white border border-red-300 rounded-lg text-red-900 focus:ring-2 focus:ring-red-500/20"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 2: 工項服務類別 (支援加入多項多元工種清單) */}
              {/* ======================================================== */}
              {activeEditorTab === 'CATEGORY' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2">
                    <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      多元工項服務專業類別 (支援複選多項多元工種)
                    </h4>
                    <p className="text-[11px] text-indigo-700 leading-relaxed">
                      工程廠商實務上常承攬多種多元工項（例如既做泥作亦做防水、磁磚），
                      您可以利用下方兩階層下拉選單挑選，或直接手動自訂輸入，點擊「加入此工種」即可多選加入清單！
                    </p>
                  </div>

                  {/* 選擇加入工種區塊 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="text-xs font-bold text-slate-800">
                      從工程標準分類選取工項：
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-5">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          第一階：主要專業工項大類
                        </label>
                        <select
                          value={editingPartner.serviceCategoryMain || '泥作裝修工程'}
                          onChange={e => {
                            const mainCat = e.target.value;
                            const group = ENGINEERING_CATEGORIES.find(g => g.mainCategory === mainCat);
                            setEditingPartner({
                              ...editingPartner,
                              serviceCategoryMain: mainCat,
                              serviceCategorySub: group?.subCategories[0] || ''
                            });
                          }}
                          className="w-full text-xs font-bold p-2.5 bg-white border border-slate-300 rounded-lg"
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
                            setEditingPartner({
                              ...editingPartner,
                              serviceCategorySub: e.target.value
                            })
                          }
                          className="w-full text-xs font-bold p-2.5 bg-white border border-slate-300 rounded-lg"
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
                            showToast(`➕ 已加入工項：${main} - ${sub}`);
                          }}
                          className="w-full py-2.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>加入工種</span>
                        </button>
                      </div>
                    </div>

                    {/* 自訂工種輸入 */}
                    <div className="pt-2 border-t border-slate-200/80 flex items-center gap-2">
                      <input
                        type="text"
                        value={customTradeInput}
                        onChange={e => setCustomTradeInput(e.target.value)}
                        placeholder="或輸入其他特殊工項名稱 (如：水下打撈、古蹟修復、大跨距鋼構...)"
                        className="flex-1 text-xs p-2 bg-white border border-slate-300 rounded-lg"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && customTradeInput.trim()) {
                            e.preventDefault();
                            const list = editingPartner.serviceCategories ? [...editingPartner.serviceCategories] : [];
                            list.push({
                              id: `CAT-${Date.now()}`,
                              main: '特殊專案工項',
                              sub: customTradeInput.trim()
                            });
                            setEditingPartner({ ...editingPartner, serviceCategories: list });
                            setCustomTradeInput('');
                            showToast(`➕ 已加入自訂工項：${customTradeInput.trim()}`);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!customTradeInput.trim()) return;
                          const list = editingPartner.serviceCategories ? [...editingPartner.serviceCategories] : [];
                          list.push({
                            id: `CAT-${Date.now()}`,
                            main: '特殊專案工項',
                            sub: customTradeInput.trim()
                          });
                          setEditingPartner({ ...editingPartner, serviceCategories: list });
                          setCustomTradeInput('');
                          showToast(`➕ 已加入自訂工項：${customTradeInput.trim()}`);
                        }}
                        className="py-2 px-3 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold"
                      >
                        新增自訂標籤
                      </button>
                    </div>
                  </div>

                  {/* 目前已加入的工種標籤管理列表 */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-700">
                      該廠商已加入之服務工種標籤 ({editingPartner.serviceCategories?.length || 0})：
                    </div>

                    {editingPartner.serviceCategories && editingPartner.serviceCategories.length > 0 ? (
                      <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        {editingPartner.serviceCategories.map((c, idx) => (
                          <div
                            key={c.id || idx}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-900 text-xs font-bold shadow-2xs group"
                          >
                            <Tag className="w-3.5 h-3.5 text-indigo-500" />
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
                              className="ml-1 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 p-0.5 transition-colors"
                              title="移除此工種"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        尚未加入任何工項分類，請從上方選取後點擊「加入工種」
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 3: 多地址動態管理 (含中華郵政 3 碼自動查找) */}
              {/* ======================================================== */}
              {activeEditorTab === 'ADDRESSES' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        多地址管理 (公司登記、工廠廠區、工地工務所等)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        內建中華郵政全國郵遞區號資料庫。直接輸入地址會即時自動查找郵遞區號，亦可選擇縣市與鄉鎮市區。
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
                    {(editingPartner.addresses || []).map((addr, idx) => {
                      const allCities = getTaiwanCities();
                      const currentCity = addr.city || '臺北市';
                      const districts = getDistrictsByCity(currentCity);

                      return (
                        <div
                          key={addr.id || idx}
                          className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-700">地址別稱：</span>
                              <input
                                type="text"
                                value={addr.label || '地址'}
                                onChange={e => {
                                  const list = [...editingPartner.addresses!];
                                  list[idx].label = e.target.value;
                                  setEditingPartner({ ...editingPartner, addresses: list });
                                }}
                                placeholder="例：總部登記、林口一廠、工務所"
                                className="text-xs p-1.5 bg-white border border-slate-300 rounded-lg font-bold w-40"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              {/* 智慧比對按鈕 */}
                              <button
                                type="button"
                                onClick={() => {
                                  const parsed = parseTaiwanAddress(addr.fullAddress);
                                  if (parsed.postalCode) {
                                    const list = [...editingPartner.addresses!];
                                    list[idx].postalCode = parsed.postalCode;
                                    list[idx].city = parsed.city;
                                    list[idx].district = parsed.district;
                                    setEditingPartner({ ...editingPartner, addresses: list });
                                    showToast(`📍 智慧比對成功！郵遞區號：${parsed.postalCode} (${parsed.city} ${parsed.district})`);
                                  } else {
                                    showToast('⚠️ 無法自動從地址辨識出郵遞區號，請確認包含縣市鄉鎮區');
                                  }
                                }}
                                className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center gap-1"
                                title="一鍵智慧比對郵遞區號"
                              >
                                <Sparkles className="w-3 h-3 text-indigo-500" />
                                <span>自動查找郵遞區號</span>
                              </button>

                              {editingPartner.addresses!.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const list = editingPartner.addresses!.filter((_, i) => i !== idx);
                                    setEditingPartner({ ...editingPartner, addresses: list });
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                                  title="移除此地址"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                            {/* 郵遞區號 */}
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                郵遞區號 (3 碼)
                              </label>
                              <input
                                type="text"
                                value={addr.postalCode || ''}
                                onChange={e => {
                                  const list = [...editingPartner.addresses!];
                                  list[idx].postalCode = e.target.value.trim();
                                  setEditingPartner({ ...editingPartner, addresses: list });
                                }}
                                placeholder="郵遞區號"
                                className="w-full text-xs font-mono font-bold p-2 bg-white border border-slate-300 rounded-lg text-center"
                              />
                            </div>

                            {/* 縣市下拉 */}
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                縣市
                              </label>
                              <select
                                value={addr.city || '臺北市'}
                                onChange={e => {
                                  const city = e.target.value;
                                  const dists = getDistrictsByCity(city);
                                  const firstDist = dists[0];
                                  const list = [...editingPartner.addresses!];
                                  list[idx].city = city;
                                  list[idx].district = firstDist?.district || '';
                                  list[idx].postalCode = firstDist?.postalCode || '';
                                  setEditingPartner({ ...editingPartner, addresses: list });
                                }}
                                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-semibold"
                              >
                                {allCities.map(c => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* 鄉鎮市區下拉 */}
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                鄉鎮市區
                              </label>
                              <select
                                value={addr.district || (districts[0]?.district || '')}
                                onChange={e => {
                                  const district = e.target.value;
                                  const pCode = getPostalCode(addr.city || '臺北市', district);
                                  const list = [...editingPartner.addresses!];
                                  list[idx].district = district;
                                  if (pCode) list[idx].postalCode = pCode;
                                  setEditingPartner({ ...editingPartner, addresses: list });
                                }}
                                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-semibold"
                              >
                                {districts.map(d => (
                                  <option key={d.district} value={d.district}>
                                    {d.district} ({d.postalCode})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* 完整路段與號樓 */}
                            <div className="md:col-span-6">
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                街道巷弄門牌樓層
                              </label>
                              <input
                                type="text"
                                value={addr.fullAddress}
                                onChange={e => {
                                  const text = e.target.value;
                                  const list = [...editingPartner.addresses!];
                                  list[idx].fullAddress = text;
                                  // 即時智慧解析
                                  const parsed = parseTaiwanAddress(text);
                                  if (parsed.postalCode) {
                                    list[idx].postalCode = parsed.postalCode;
                                    if (parsed.city) list[idx].city = parsed.city;
                                    if (parsed.district) list[idx].district = parsed.district;
                                  }
                                  setEditingPartner({ ...editingPartner, addresses: list });
                                }}
                                placeholder="例：信義路五段7號89樓 (輸入時自動解析郵遞區號)"
                                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 4: 多聯絡人管理 */}
              {/* ======================================================== */}
              {activeEditorTab === 'CONTACTS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        多聯絡人管理 (業務窗口、工務窗口、會計出納)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        記錄多組電話、分機、手機與業務備註，防止工地現場找不到對應工程師。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const list = editingPartner.contacts ? [...editingPartner.contacts] : [];
                        list.push({
                          id: `PCON-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                          partnerId: editingPartner.id,
                          contactType: 'PRIMARY',
                          name: '',
                          title: '聯絡人',
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
                        className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              姓名 <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={con.name}
                              onChange={e => {
                                const list = [...editingPartner.contacts!];
                                list[idx].name = e.target.value;
                                setEditingPartner({ ...editingPartner, contacts: list });
                              }}
                              placeholder="聯絡人姓名"
                              className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              職稱 / 業務角色
                            </label>
                            <input
                              type="text"
                              value={con.title || ''}
                              onChange={e => {
                                const list = [...editingPartner.contacts!];
                                list[idx].title = e.target.value;
                                setEditingPartner({ ...editingPartner, contacts: list });
                              }}
                              placeholder="例：工務所主任、業務副理"
                              className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              行動電話 (手機)
                            </label>
                            <input
                              type="text"
                              value={con.mobile || ''}
                              onChange={e => {
                                const list = [...editingPartner.contacts!];
                                list[idx].mobile = e.target.value;
                                setEditingPartner({ ...editingPartner, contacts: list });
                              }}
                              placeholder="例：0912-345-678"
                              className="w-full text-xs font-mono p-2 bg-white border border-slate-300 rounded-lg"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              總機電話 / 分機
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={con.phone || ''}
                                onChange={e => {
                                  const list = [...editingPartner.contacts!];
                                  list[idx].phone = e.target.value;
                                  setEditingPartner({ ...editingPartner, contacts: list });
                                }}
                                placeholder="例：02-23456789"
                                className="flex-1 text-xs font-mono p-2 bg-white border border-slate-300 rounded-lg"
                              />
                              <input
                                type="text"
                                value={con.extension || ''}
                                onChange={e => {
                                  const list = [...editingPartner.contacts!];
                                  list[idx].extension = e.target.value;
                                  setEditingPartner({ ...editingPartner, contacts: list });
                                }}
                                placeholder="分機"
                                className="w-16 text-xs font-mono p-2 bg-white border border-slate-300 rounded-lg text-center"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-200/60">
                          <input
                            type="email"
                            value={con.email || ''}
                            onChange={e => {
                              const list = [...editingPartner.contacts!];
                              list[idx].email = e.target.value;
                              setEditingPartner({ ...editingPartner, contacts: list });
                            }}
                            placeholder="電子郵件信箱 (Email)"
                            className="text-xs p-1.5 bg-white border border-slate-300 rounded-lg w-72"
                          />

                          {editingPartner.contacts!.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const list = editingPartner.contacts!.filter((_, i) => i !== idx);
                                setEditingPartner({ ...editingPartner, contacts: list });
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 5: 全國金融帳戶與存摺封面 (支援輸入搜尋代碼與名稱，多檔案上傳與高清預覽) */}
              {/* ======================================================== */}
              {activeEditorTab === 'BANK' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-indigo-600" />
                      全國金融機構匯款帳號 (支援輸入代碼或名稱即時查詢)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 金融機構搜尋選取器 */}
                      <div className="relative">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          金融機構 (輸入 3 碼代號或名稱搜尋)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={
                              isPartnerBankDropdownOpen
                                ? partnerBankSearch
                                : `[${editingPartner.bankCode || '004'}] ${editingPartner.bankName || '臺灣銀行'}`
                            }
                            onChange={e => {
                              setPartnerBankSearch(e.target.value);
                              setIsPartnerBankDropdownOpen(true);
                            }}
                            onFocus={() => {
                              setPartnerBankSearch('');
                              setIsPartnerBankDropdownOpen(true);
                            }}
                            placeholder="輸入代碼如 004 或關鍵字如 國泰、郵局、農會..."
                            className="w-full text-xs font-bold p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => setIsPartnerBankDropdownOpen(!isPartnerBankDropdownOpen)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>

                        {/* 下拉搜尋清單 */}
                        {isPartnerBankDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
                            {filteredPartnerBanks.slice(0, 30).map(b => (
                              <div
                                key={b.code}
                                onClick={() => {
                                  setEditingPartner({
                                    ...editingPartner,
                                    bankCode: b.code,
                                    bankName: b.name
                                  });
                                  setIsPartnerBankDropdownOpen(false);
                                }}
                                className="px-3 py-2 text-xs hover:bg-indigo-50 cursor-pointer flex items-center justify-between border-b border-slate-100 last:border-0"
                              >
                                <div>
                                  <span className="font-mono font-bold text-indigo-600 mr-2">[{b.code}]</span>
                                  <span className="font-bold text-slate-800">{b.name}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-semibold">{b.category}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 帳戶戶名 */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          銀行帳戶戶名
                        </label>
                        <input
                          type="text"
                          value={editingPartner.bankAccountName || editingPartner.name}
                          onChange={e =>
                            setEditingPartner({
                              ...editingPartner,
                              bankAccountName: e.target.value
                            })
                          }
                          placeholder="戶名 (通常同公司全稱)"
                          className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg"
                        />
                      </div>

                      {/* 銀行帳號 */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          銀行帳號 (10 ~ 16 碼純數字)
                        </label>
                        <input
                          type="text"
                          value={editingPartner.bankAccount}
                          onChange={e =>
                            setEditingPartner({
                              ...editingPartner,
                              bankAccount: e.target.value.trim()
                            })
                          }
                          placeholder="請輸入無破折號之純數字銀行帳號"
                          className="w-full text-xs p-2.5 font-mono font-bold bg-white border border-slate-300 rounded-lg tracking-wider"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 存摺封面照片多檔案上傳 (支援多檔案、PDF 與高清預覽) */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-emerald-600" />
                          存摺封面 / 帳戶印鑑卡 / 匯款同意書憑據留存 (出納核撥依據)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          支援同時上傳多個圖檔或 PDF 檔案。滑鼠懸停即可浮動放大預覽，點擊可開啟全螢幕檢視與下載。
                        </p>
                      </div>

                      <label className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>上傳檔案 (多選)</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*,application/pdf"
                          onChange={e =>
                            handleProcessUploadedFiles(e.target.files, newFiles => {
                              const banks = editingPartner.bankAccounts ? [...editingPartner.bankAccounts] : [];
                              if (banks.length > 0) {
                                const currentFiles = banks[0].passbookFiles || [];
                                banks[0].passbookFiles = [...currentFiles, ...newFiles];
                                banks[0].passbookFileData = banks[0].passbookFiles[0]?.dataUrl;
                              } else {
                                banks.push({
                                  id: `BACC-${Date.now()}`,
                                  bpId: editingPartner.id,
                                  bankCode: editingPartner.bankCode || '004',
                                  bankName: editingPartner.bankName || '臺灣銀行',
                                  accountNumber: editingPartner.bankAccount || '',
                                  accountName: editingPartner.name,
                                  isPrimary: true,
                                  passbookFiles: newFiles,
                                  passbookFileData: newFiles[0]?.dataUrl
                                });
                              }
                              setEditingPartner({ ...editingPartner, bankAccounts: banks });
                            })
                          }
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* 已上傳存摺檔案清單 (多檔案清單與縮圖) */}
                    {editingPartner.bankAccounts?.[0]?.passbookFiles &&
                    editingPartner.bankAccounts[0].passbookFiles.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                        {editingPartner.bankAccounts[0].passbookFiles.map((file, fIdx) => (
                          <div
                            key={file.id || fIdx}
                            className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between group relative"
                          >
                            <div
                              className="cursor-pointer space-y-1.5"
                              onClick={() =>
                                setLightboxMedia({
                                  url: file.dataUrl,
                                  title: `${editingPartner.name} - ${file.name}`,
                                  isPdf: file.fileType === 'PDF'
                                })
                              }
                              onMouseEnter={e => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoverPreview({
                                  url: file.dataUrl,
                                  title: file.name,
                                  isPdf: file.fileType === 'PDF',
                                  x: rect.right + 12,
                                  y: rect.top
                                });
                              }}
                              onMouseLeave={() => setHoverPreview(null)}
                            >
                              {file.fileType === 'PDF' ? (
                                <div className="h-28 bg-red-50 rounded-lg flex flex-col items-center justify-center text-red-600 gap-1 border border-red-200">
                                  <FileText className="w-8 h-8" />
                                  <span className="text-[11px] font-bold">PDF 檔案憑證</span>
                                </div>
                              ) : (
                                <img
                                  src={file.dataUrl}
                                  alt={file.name}
                                  className="h-28 w-full object-cover rounded-lg border border-slate-200 group-hover:opacity-90"
                                />
                              )}
                              <div className="text-[11px] font-bold text-slate-800 truncate" title={file.name}>
                                {file.name}
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                              <span className="text-[10px] text-slate-400">
                                {file.fileType === 'PDF' ? 'PDF 文件' : '圖片檔案'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const banks = [...editingPartner.bankAccounts!];
                                  banks[0].passbookFiles = banks[0].passbookFiles!.filter((_, i) => i !== fIdx);
                                  banks[0].passbookFileData = banks[0].passbookFiles[0]?.dataUrl;
                                  setEditingPartner({ ...editingPartner, bankAccounts: banks });
                                }}
                                className="text-slate-400 hover:text-red-600 p-1 rounded"
                                title="移除此檔案"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">
                        尚未上傳任何存摺封面或帳戶印鑑卡照片
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 6: 支票往來記錄 (即時同步顯示) */}
              {/* ======================================================== */}
              {activeEditorTab === 'CHEQUES' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        支票往來歷程 (收受客戶支票 / 開立廠商期票)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        每一張收發支票皆記錄銀行、分行、扣款帳號、支票號碼、金額、開票日、到期日與掃描影本。
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
                    <div className="space-y-2.5">
                      {editingPartner.chequeRecords.map(chk => (
                        <div
                          key={chk.id}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
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
                              <span className="font-mono font-bold text-slate-800">
                                號碼：{chk.checkNumber}
                              </span>
                              <span className="font-mono font-extrabold text-indigo-600">
                                NT$ {chk.amount.toLocaleString()}
                              </span>
                              {chk.isNonNegotiable && (
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-1 rounded font-semibold">
                                  禁背
                                </span>
                              )}
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1 rounded font-bold">
                                {chk.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-3">
                              <span>付款金融：[{chk.bankCode}] {chk.bankName} {chk.branchName ? `(${chk.branchName})` : ''}</span>
                              {chk.accountNumber && <span>扣款帳號：{chk.accountNumber}</span>}
                              <span>發票日：{chk.issueDate}</span>
                              <span className="font-bold text-indigo-700">兌現日：{chk.dueDate}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {(chk.chequeFileData || (chk.chequeFiles && chk.chequeFiles.length > 0)) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const pFile = chk.chequeFiles?.[0];
                                  setLightboxMedia({
                                    url: pFile?.dataUrl || chk.chequeFileData!,
                                    title: `支票影本：${chk.checkNumber}`,
                                    isPdf: pFile?.fileType === 'PDF'
                                  });
                                }}
                                onMouseEnter={e => {
                                  const url = chk.chequeFiles?.[0]?.dataUrl || chk.chequeFileData;
                                  if (!url) return;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoverPreview({
                                    url,
                                    title: `支票影本：${chk.checkNumber}`,
                                    isPdf: chk.chequeFiles?.[0]?.fileType === 'PDF',
                                    x: rect.left - 430,
                                    y: rect.top - 80
                                  });
                                }}
                                onMouseLeave={() => setHoverPreview(null)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                                title="預覽支票影本"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteConfirmTarget({
                                  type: 'CHEQUE',
                                  id: chk.id,
                                  partnerId: editingPartner.id,
                                  name: `支票號碼 ${chk.checkNumber} (NT$ ${chk.amount.toLocaleString()})`
                                })
                              }
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
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
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400">
                更新時間：{editingPartner.updatedAt || '即時同步'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSavePartner}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>儲存夥伴主檔</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 彈窗 2：一鍵自合作廠商引薦變業主 (Vendor to Client Modal) */}
      {/* ======================================================== */}
      {isConvertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-200 bg-amber-50/70 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-950">
                    一鍵自合作廠商引薦 / 加入變業主
                  </h3>
                  <p className="text-[11px] text-amber-800">
                    在業主名冊中直接搜索既有廠商，一鍵晉升為業主，完美遵循 SSoT 關聯架構。
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

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={vendorSearchTerm}
                  onChange={e => setVendorSearchTerm(e.target.value)}
                  placeholder="即時搜尋合作廠商全稱、統編或代碼..."
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {nonClientVendors.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">
                    查無可轉換之合作廠商 (或所有符合廠商已具備業主身分)
                  </div>
                ) : (
                  nonClientVendors.map(v => (
                    <div
                      key={v.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 hover:border-amber-400 flex items-center justify-between transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {v.bpCode}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{v.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          統編：{v.taxId} • 窗口：{v.contactPerson || '無'} • 電話：{v.phone || '無'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleExecuteConvert(v)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1 shadow-2xs transition-all active:scale-95"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>一鍵加入變業主</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsConvertModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 彈窗 3：登記收受 / 開出支票往來資訊 (完整票面欄位與多檔案預覽) */}
      {/* ======================================================== */}
      {isChequeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  登記支票往來資訊 (收票 / 發票)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsChequeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* 方向與狀態 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    支票收發方向
                  </label>
                  <select
                    value={editingCheque.direction || 'RECEIPT'}
                    onChange={e =>
                      setEditingCheque({
                        ...editingCheque,
                        direction: e.target.value as any
                      })
                    }
                    className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="RECEIPT">🟢 收受支票 (業主付款給本公司)</option>
                    <option value="PAYMENT">🔵 開立支票 (本公司支付給廠商)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    支票狀態
                  </label>
                  <select
                    value={editingCheque.status || 'RECEIVED'}
                    onChange={e =>
                      setEditingCheque({
                        ...editingCheque,
                        status: e.target.value as any
                      })
                    }
                    className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="RECEIVED">已收受 (未到期)</option>
                    <option value="ISSUED">已開立 (未到期)</option>
                    <option value="DEPOSITED">已存入託收 (託收提示中)</option>
                    <option value="CLEARED">已兌現入帳</option>
                    <option value="BOUNCED">退票</option>
                    <option value="VOIDED">作廢</option>
                  </select>
                </div>
              </div>

              {/* 付款金融機構搜尋與分行 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    付款銀行 (金融機構代碼/名稱) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={
                        isChequeBankDropdownOpen
                          ? chequeBankSearch
                          : `[${editingCheque.bankCode || '004'}] ${editingCheque.bankName || '臺灣銀行'}`
                      }
                      onChange={e => {
                        setChequeBankSearch(e.target.value);
                        setIsChequeBankDropdownOpen(true);
                      }}
                      onFocus={() => {
                        setChequeBankSearch('');
                        setIsChequeBankDropdownOpen(true);
                      }}
                      placeholder="輸入代碼或銀行名稱..."
                      className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setIsChequeBankDropdownOpen(!isChequeBankDropdownOpen)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isChequeBankDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                      {filteredChequeBanks.slice(0, 30).map(b => (
                        <div
                          key={b.code}
                          onClick={() => {
                            setEditingCheque({
                              ...editingCheque,
                              bankCode: b.code,
                              bankName: b.name
                            });
                            setIsChequeBankDropdownOpen(false);
                          }}
                          className="px-3 py-1.5 text-xs hover:bg-indigo-50 cursor-pointer flex items-center justify-between border-b border-slate-100 last:border-0"
                        >
                          <div>
                            <span className="font-mono font-bold text-indigo-600 mr-1.5">[{b.code}]</span>
                            <span className="font-bold text-slate-800">{b.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{b.category}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    付款分行 (分行名稱或分行代號)
                  </label>
                  <input
                    type="text"
                    value={editingCheque.branchName || ''}
                    onChange={e =>
                      setEditingCheque({ ...editingCheque, branchName: e.target.value })
                    }
                    placeholder="例：營業部、城中分行、板橋分行"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-semibold"
                  />
                </div>
              </div>

              {/* 扣款帳號與支票號碼 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    扣款帳戶 (票面支存帳號)
                  </label>
                  <input
                    type="text"
                    value={editingCheque.accountNumber || ''}
                    onChange={e =>
                      setEditingCheque({ ...editingCheque, accountNumber: e.target.value.trim() })
                    }
                    placeholder="支票存款帳號"
                    className="w-full text-xs font-mono font-bold p-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    支票號碼 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingCheque.checkNumber || ''}
                    onChange={e =>
                      setEditingCheque({ ...editingCheque, checkNumber: e.target.value.trim().toUpperCase() })
                    }
                    placeholder="票面右上方 7~9 碼號碼 (如 CQ-882201)"
                    className="w-full text-xs font-mono font-bold p-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* 金額與受款人抬頭 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    票面金額 (新台幣) <span className="text-red-500">*</span>
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
                    placeholder="嚴格正數"
                    className="w-full text-xs font-mono font-bold p-2 bg-white border border-slate-300 rounded-lg text-indigo-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    受款人抬頭全稱
                  </label>
                  <input
                    type="text"
                    value={editingCheque.payeeName || ''}
                    onChange={e =>
                      setEditingCheque({ ...editingCheque, payeeName: e.target.value })
                    }
                    placeholder="抬頭全稱"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-semibold"
                  />
                </div>
              </div>

              {/* 票面日期詳細規劃 (收票時間、開票日、可兌換時間) */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-2">
                <div className="text-xs font-bold text-indigo-900">
                  票面日期及時程管理 (收到時間 vs 法定發票日 vs 可兌現日)：
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                      收到支票時間 (收票日)
                    </label>
                    <input
                      type="date"
                      value={editingCheque.receivedDate || ''}
                      onChange={e =>
                        setEditingCheque({ ...editingCheque, receivedDate: e.target.value })
                      }
                      className="w-full text-xs font-mono p-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                    <span className="text-[10px] text-slate-400">拿到或交付支票的當日</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                      支票開票日 (法定發票日)
                    </label>
                    <input
                      type="date"
                      value={editingCheque.issueDate || ''}
                      onChange={e =>
                        setEditingCheque({ ...editingCheque, issueDate: e.target.value })
                      }
                      className="w-full text-xs font-mono p-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                    <span className="text-[10px] text-slate-400">票面上印製之發票基準日</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-indigo-700 mb-0.5">
                      支票到期日 (可兌領時間)
                    </label>
                    <input
                      type="date"
                      value={editingCheque.dueDate || ''}
                      onChange={e =>
                        setEditingCheque({ ...editingCheque, dueDate: e.target.value })
                      }
                      className="w-full text-xs font-mono p-1.5 bg-white border border-indigo-300 text-indigo-700 rounded-lg font-bold"
                    />
                    <span className="text-[10px] text-indigo-600">到期可存入兌換的時間</span>
                  </div>
                </div>
              </div>

              {/* 禁止背書轉讓 */}
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
                <label className="flex items-center gap-1.5 cursor-pointer">
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

              {/* 支票正反面影本 / PDF 掃描檔上傳 (支援多檔案、Hover 與 Lightbox 預覽) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      支票正反面影本 / PDF 掃描憑據
                    </span>
                    <p className="text-[10px] text-slate-500">
                      滑鼠移過縮圖即可浮動放大，點擊彈出全螢幕燈箱大圖。支援 PDF 檔案！
                    </p>
                  </div>
                  <label className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1 shadow-2xs">
                    <Upload className="w-3 h-3" />
                    <span>上傳影本</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={e =>
                        handleProcessUploadedFiles(e.target.files, newFiles => {
                          const current = editingCheque.chequeFiles || [];
                          const merged = [...current, ...newFiles];
                          setEditingCheque({
                            ...editingCheque,
                            chequeFiles: merged,
                            chequeFileData: merged[0]?.dataUrl
                          });
                        })
                      }
                      className="hidden"
                    />
                  </label>
                </div>

                {editingCheque.chequeFiles && editingCheque.chequeFiles.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {editingCheque.chequeFiles.map((file, idx) => (
                      <div
                        key={file.id || idx}
                        className="p-1.5 bg-white border border-slate-200 rounded-lg relative group flex flex-col justify-between"
                      >
                        <div
                          className="cursor-pointer space-y-1"
                          onClick={() =>
                            setLightboxMedia({
                              url: file.dataUrl,
                              title: `支票影本：${file.name}`,
                              isPdf: file.fileType === 'PDF'
                            })
                          }
                          onMouseEnter={e => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoverPreview({
                              url: file.dataUrl,
                              title: file.name,
                              isPdf: file.fileType === 'PDF',
                              x: rect.right + 10,
                              y: rect.top - 50
                            });
                          }}
                          onMouseLeave={() => setHoverPreview(null)}
                        >
                          {file.fileType === 'PDF' ? (
                            <div className="h-20 bg-red-50 rounded flex flex-col items-center justify-center text-red-600 gap-1 border border-red-200">
                              <FileText className="w-6 h-6" />
                              <span className="text-[10px] font-bold">PDF</span>
                            </div>
                          ) : (
                            <img
                              src={file.dataUrl}
                              alt={file.name}
                              className="h-20 w-full object-cover rounded border border-slate-200"
                            />
                          )}
                          <div className="text-[10px] text-slate-700 truncate font-semibold" title={file.name}>
                            {file.name}
                          </div>
                        </div>

                        <div className="flex items-center justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              const files = editingCheque.chequeFiles!.filter((_, i) => i !== idx);
                              setEditingCheque({
                                ...editingCheque,
                                chequeFiles: files,
                                chequeFileData: files[0]?.dataUrl
                              });
                            }}
                            className="text-slate-400 hover:text-red-600 p-0.5 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">尚未上傳支票照片或 PDF 掃描檔</div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  備註說明
                </label>
                <input
                  type="text"
                  value={editingCheque.notes || ''}
                  onChange={e =>
                    setEditingCheque({ ...editingCheque, notes: e.target.value })
                  }
                  placeholder="例：南港案第 1 期合約訂金票據..."
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsChequeModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveCheque}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <Save className="w-4 h-4" />
                <span>儲存支票記錄</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 彈窗 4：自訂 In-App 刪除確認彈窗 (100% 杜絕 iframe 攔截) */}
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
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirmTarget.type === 'PARTNER') {
                    handleExecuteDeletePartner(deleteConfirmTarget.id, deleteConfirmTarget.name);
                  } else {
                    handleExecuteDeleteCheque(deleteConfirmTarget.id, deleteConfirmTarget.partnerId);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-2xs"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 彈窗 5：全螢幕高解析度 Lightbox 預覽視窗 (圖片與 PDF 完整嵌入) */}
      {/* ======================================================== */}
      {lightboxMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold tracking-tight">{lightboxMedia.title}</h4>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxMedia.url}
                  download={lightboxMedia.title}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下載檔案</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxMedia(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-100 flex-1 overflow-auto flex items-center justify-center min-h-[500px]">
              {lightboxMedia.isPdf ? (
                <iframe
                  src={lightboxMedia.url}
                  title="PDF Preview"
                  className="w-full h-[70vh] rounded-lg border border-slate-300 bg-white"
                />
              ) : (
                <img
                  src={lightboxMedia.url}
                  alt={lightboxMedia.title}
                  className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-lg border border-slate-300 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 浮動大圖預覽 Popover (滑鼠移過去即時清晰大圖) */}
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
