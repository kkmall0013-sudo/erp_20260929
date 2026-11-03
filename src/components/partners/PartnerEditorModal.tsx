import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Users2,
  MapPin,
  Landmark,
  Receipt,
  Contact,
  FolderLock,
  Layers,
  X,
  Save,
  Plus,
  Trash2,
  Tag,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Upload,
  RotateCcw,
  Lock,
  Unlock,
  FileText
} from 'lucide-react';
import {
  BusinessPartner,
  PartnerAddress,
  PartnerContact,
  BPBankAccount,
  PartnerChequeRecord,
  PartnerBusinessCard,
  StoredMediaFile
} from '../../types/erp';
import { useAuth } from '../../context/AuthContext';
import {
  saveBusinessPartner,
  getSubcontractorCategoryTree,
  addVendorToSubcontractorCategory,
  savePartnerBusinessCard,
  deletePartnerBusinessCard,
  getBusinessPartnerById
} from '../../db/sqlite';
import { TaiwanAddressPicker } from '../widgets/TaiwanAddressPicker';
import { TaiwanIdTaxValidatorWidget } from '../widgets/TaiwanIdTaxValidatorWidget';
import { TaiwanBankPickerWidget } from '../widgets/TaiwanBankPickerWidget';
import { AttachmentUploader } from '../attachments/AttachmentUploader';
import { validateTaiwanTaxId, validateTaiwanNationalId } from '../../utils/taiwanValidation';

// 圖片壓縮輔助工具
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

export interface PartnerEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner?: BusinessPartner | null;
  initialName?: string;
  defaultType?: 'CUSTOMER' | 'VENDOR' | 'BOTH';
  onSaved?: (partner: BusinessPartner) => void;
  title?: string;
}

export const PartnerEditorModal: React.FC<PartnerEditorModalProps> = ({
  isOpen,
  onClose,
  partner,
  initialName = '',
  defaultType = 'CUSTOMER',
  onSaved,
  title
}) => {
  const { currentUser } = useAuth();
  const [activeEditorTab, setActiveEditorTab] = useState<string>('BASIC');
  const [categoryTree, setCategoryTree] = useState<any[]>(() => {
    try {
      return getSubcontractorCategoryTree();
    } catch (_) {
      return [];
    }
  });

  // 廠商分類多標籤防呆與雙重確認機制狀態
  const [pendingDeleteTag, setPendingDeleteTag] = useState<string | null>(null);
  const [lastRemovedTag, setLastRemovedTag] = useState<string | null>(null);
  const [isTagEditMode, setIsTagEditMode] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 預覽與燈箱
  const [hoverPreview, setHoverPreview] = useState<{
    url: string;
    title: string;
    isPdf: boolean;
    x: number;
    y: number;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 初始夥伴主檔
  const [editingPartner, setEditingPartner] = useState<BusinessPartner>(() => {
    if (partner) return partner;

    const isClientMode = defaultType === 'CUSTOMER';
    const newId = `BP-${Date.now().toString().slice(-6)}`;
    const newCode = isClientMode
      ? `CUST-${Date.now().toString().slice(-4)}`
      : `VEND-${Date.now().toString().slice(-4)}`;
    const defaultVendorCategory = categoryTree[0]?.mainCategory || '鋼材';

    return {
      id: newId,
      bpCode: newCode,
      name: initialName.trim(),
      taxId: '',
      entityType: isClientMode ? 'CORPORATION' : 'CORPORATION',
      isIndividual: false,
      type: defaultType,
      isCustomer: defaultType === 'CUSTOMER' || defaultType === 'BOTH',
      isVendor: defaultType === 'VENDOR' || defaultType === 'BOTH',
      categoryMain: !isClientMode ? defaultVendorCategory : undefined,
      categorySub: '',
      serviceCategoryMain: !isClientMode ? defaultVendorCategory : '泥作裝修工程',
      serviceCategorySub: '',
      serviceCategories: !isClientMode ? [
        { id: `CAT-${Date.now()}-1`, main: defaultVendorCategory, sub: '' }
      ] : [],
      representative: '',
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
          id: `PADDR-${Date.now()}-1`,
          partnerId: newId,
          addressType: 'COMMUNICATION',
          label: '通訊/營業地址',
          postalCode: '100',
          city: '臺北市',
          district: '中正區',
          fullAddress: '',
          isDeleted: false
        }
      ],
      contacts: [
        {
          id: `PCON-${Date.now()}-1`,
          partnerId: newId,
          contactType: 'PRIMARY',
          name: '',
          title: isClientMode ? '業務窗口 / 負責人' : '業務聯絡人',
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
  });

  useEffect(() => {
    if (partner) {
      setEditingPartner(partner);
    } else if (initialName && !editingPartner.name) {
      setEditingPartner(prev => ({ ...prev, name: initialName.trim() }));
    }
  }, [partner, initialName]);

  if (!isOpen) return null;

  const isClientOnly = Boolean(editingPartner.isCustomer && !editingPartner.isVendor);
  const isPerson = Boolean(editingPartner.entityType === 'NATURAL_PERSON' || editingPartner.isIndividual);
  const isTaxRequired = !(editingPartner.isCustomer && isPerson);

  // 處理上傳多個檔案 (存摺/附件)
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

  // 儲存商業夥伴主檔
  const handleSavePartner = () => {
    if (!editingPartner.name.trim()) {
      showToast('⚠️ 請填寫夥伴名稱 / 業主姓名！');
      return;
    }

    // 業務身分強制約束：至少須勾選一項（業主或合作廠商）
    if (!editingPartner.isCustomer && !editingPartner.isVendor) {
      showToast('⚠️ 業務身分至少須勾選一項（業主或合作廠商），不可全部取消！');
      return;
    }

    // 合作廠商強制填寫統編或負責人身分證；個人業主免強制填寫身分證
    if (!isClientOnly && !editingPartner.taxId.trim()) {
      showToast('⚠️ 合作廠商必須填寫公司統一編號或負責人身分證字號！');
      return;
    }

    // 若有填寫，則執行校驗
    if (editingPartner.taxId.trim()) {
      if (isPerson) {
        const v = validateTaiwanNationalId(editingPartner.taxId.trim());
        if (!v.isValid) {
          showToast(`⚠️ 身分證字號格式不符：${v.message}`);
          return;
        }
      } else {
        const v = validateTaiwanTaxId(editingPartner.taxId.trim());
        if (!v.isValid) {
          showToast(`⚠️ 公司統一編號檢核不符：${v.message}`);
          return;
        }
      }
    }

    try {
      const operator = currentUser?.fullName || '系統操作員';
      const primaryAddr = editingPartner.addresses?.[0];
      const tags = (editingPartner.categoryTags && editingPartner.categoryTags.length > 0)
        ? editingPartner.categoryTags
        : (editingPartner.categoryMain ? [editingPartner.categoryMain] : [categoryTree[0]?.mainCategory || '鋼材']);
      const fallbackCat = tags[0];

      const partnerToSave: BusinessPartner = {
        ...editingPartner,
        name: editingPartner.name.trim(),
        taxId: editingPartner.taxId.trim(),
        representative: editingPartner.representative?.trim() || '',
        contactPerson: editingPartner.contactPerson?.trim() || editingPartner.contacts?.[0]?.name?.trim() || '',
        phone: editingPartner.phone?.trim() || editingPartner.contacts?.[0]?.phone?.trim() || editingPartner.contacts?.[0]?.mobile?.trim() || '',
        isIndividual: isPerson,
        categoryTags: editingPartner.isVendor ? tags : editingPartner.categoryTags,
        categoryMain: editingPartner.isVendor ? fallbackCat : editingPartner.categoryMain,
        serviceCategoryMain: editingPartner.isVendor ? fallbackCat : editingPartner.serviceCategoryMain,
        address: primaryAddr?.fullAddress || editingPartner.address || ''
      };

      const saved = saveBusinessPartner(partnerToSave, operator);

      // 二階段廠商分類聯動：若為合作廠商，將其自動登錄至所有對應工料分類標籤字典
      if (partnerToSave.isVendor && partnerToSave.name) {
        for (const tag of tags) {
          try {
            addVendorToSubcontractorCategory(tag, partnerToSave.name, operator);
          } catch (_) {}
        }
      }

      onSaved?.(saved);
      onClose();
    } catch (err: any) {
      showToast('❌ 儲存失敗：' + (err.message || '未知錯誤'));
    }
  };

  // 頁籤定義
  const modalTabs = [
    { key: 'BASIC', label: isClientOnly ? '1. 基本身分與業主資料' : '1. 基本身分與風控', icon: Building2 },
    ...(isClientOnly ? [] : [{ key: 'CATEGORY', label: '2. 多元工種服務', icon: Layers }]),
    { key: 'ADDRESSES', label: isClientOnly ? '2. 通訊與案場地址' : '3. 多地址管理 (郵政)', icon: MapPin },
    { key: 'CONTACTS', label: isClientOnly ? '3. 聯絡人名冊' : '4. 聯絡人名冊', icon: Users2 },
    ...(isClientOnly ? [] : [
      { key: 'BANK', label: '5. 金融帳戶與存摺', icon: Landmark },
      { key: 'CHEQUES', label: `6. 支票往來 (${editingPartner.chequeRecords?.length || 0})`, icon: Receipt },
    ]),
    { key: 'CARDS', label: isClientOnly ? `4. 名片管理 (${editingPartner.businessCards?.length || 0})` : `7. 名片管理 (${editingPartner.businessCards?.length || 0})`, icon: Contact },
    { key: 'VAULT', label: isClientOnly ? '5. 無紙化金庫與圖說' : '8. 無紙化金庫與圖說', icon: FolderLock }
  ];

  return createPortal(
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-4 right-4 z-[1000000] px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {title || (isClientOnly ? '建立新業主資料（聯絡明細規格）' : '建立商業夥伴主檔（聯絡明細規格）')}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                夥伴編號：{editingPartner.bpCode} · {isClientOnly ? '合約甲方業主名冊' : '商業夥伴主庫'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs Bar */}
        <div className="px-6 bg-slate-50 border-b border-slate-200 flex items-center gap-1 overflow-x-auto shrink-0">
          {modalTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeEditorTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveEditorTab(tab.key)}
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* TAB 1: 基本身分與風控 */}
          {activeEditorTab === 'BASIC' && (
            <div className="space-y-4">
              {/* 業主名冊專屬說明橫幅 */}
              {isClientOnly && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2">
                    <Users2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <span className="font-bold text-indigo-950">業主名冊專屬建檔版面</span>
                      <span className="text-[11px] text-indigo-700 block">
                        直接調用聯絡明細主檔格式，建檔後將同步歸入客戶主庫；個人自住業主免強制身分證，公司法人則自動連動統編驗證。
                      </span>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg shadow-2xs cursor-pointer font-bold text-indigo-900 shrink-0">
                    <input
                      type="checkbox"
                      checked={Boolean(editingPartner.isIndividual)}
                      onChange={e => {
                        const checked = e.target.checked;
                        setEditingPartner({
                          ...editingPartner,
                          isIndividual: checked,
                          entityType: checked ? 'NATURAL_PERSON' : editingPartner.entityType
                        });
                      }}
                      className="rounded text-indigo-600"
                    />
                    <span>個人自建/自住業主 (免身分證)</span>
                  </label>
                </div>
              )}

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
                        name="modalEntityType"
                        checked={editingPartner.entityType !== 'NATURAL_PERSON' && !editingPartner.isIndividual}
                        onChange={() =>
                          setEditingPartner({
                            ...editingPartner,
                            entityType: 'CORPORATION',
                            isIndividual: false
                          })
                        }
                        className="text-indigo-600"
                      />
                      <span>公司法人 (營利事業)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="modalEntityType"
                        checked={editingPartner.entityType === 'NATURAL_PERSON' || Boolean(editingPartner.isIndividual)}
                        onChange={() =>
                          setEditingPartner({
                            ...editingPartner,
                            entityType: 'NATURAL_PERSON',
                            isIndividual: Boolean(editingPartner.isCustomer)
                          })
                        }
                        className="text-indigo-600"
                      />
                      <span>自然人 (個人業主/工班師傅)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    業務身分定義 <span className="text-red-500">* (至少須勾選一項)</span>
                  </label>
                  <div className="flex items-center gap-4 mt-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingPartner.isCustomer)}
                        onChange={e => {
                          const newChecked = e.target.checked;
                          if (!newChecked && !editingPartner.isVendor) {
                            showToast('⚠️ 業務身分至少須勾選一項（業主或合作廠商）');
                            return;
                          }
                          const nextIsCust = newChecked;
                          const nextIsVend = Boolean(editingPartner.isVendor);
                          const nextType = (nextIsCust && nextIsVend) ? 'BOTH' : (nextIsCust ? 'CUSTOMER' : 'VENDOR');
                          setEditingPartner({
                            ...editingPartner,
                            isCustomer: nextIsCust,
                            type: nextType
                          });
                        }}
                        className="rounded text-indigo-600"
                      />
                      <span>業主 (客戶 / 發包方)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingPartner.isVendor)}
                        onChange={e => {
                          const newChecked = e.target.checked;
                          if (!newChecked && !editingPartner.isCustomer) {
                            showToast('⚠️ 業務身分至少須勾選一項（業主或合作廠商）');
                            return;
                          }
                          const nextIsVend = newChecked;
                          const nextIsCust = Boolean(editingPartner.isCustomer);
                          const nextType = (nextIsCust && nextIsVend) ? 'BOTH' : (nextIsCust ? 'CUSTOMER' : 'VENDOR');
                          setEditingPartner({
                            ...editingPartner,
                            isVendor: nextIsVend,
                            type: nextType,
                            categoryMain: nextIsVend ? (editingPartner.categoryMain || categoryTree[0]?.mainCategory || '鋼材') : editingPartner.categoryMain
                          });
                        }}
                        className="rounded text-indigo-600"
                      />
                      <span>合作廠商 (協力包商 / 材料商)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 廠商多角化分類標籤 (若勾選廠商) */}
              {editingPartner.isVendor && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="block text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-amber-700" />
                      <span>廠商工料分類標籤 (多角化多標籤)</span>
                      <span className="text-red-500">* (至少保留 1 項)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTagEditMode(!isTagEditMode);
                        setPendingDeleteTag(null);
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                        isTagEditMode
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {isTagEditMode ? (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-rose-600" />
                          <span>標籤解鎖編輯中 (點此鎖定)</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                          <span>🔒 標籤安全鎖定中 (防誤刪)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 標籤清單 */}
                  {(() => {
                    const currentTags = (editingPartner.categoryTags && editingPartner.categoryTags.length > 0)
                      ? editingPartner.categoryTags
                      : [editingPartner.categoryMain || categoryTree[0]?.mainCategory || '鋼材'];

                    return (
                      <div className="flex items-center gap-2 flex-wrap p-2.5 bg-white border border-amber-300 rounded-xl min-h-[48px]">
                        {currentTags.map((tag, tIdx) => {
                          const isPendingDelete = pendingDeleteTag === tag;
                          if (isPendingDelete) {
                            return (
                              <span
                                key={tIdx}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 border-2 border-rose-500 text-rose-950 text-xs font-bold"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>確定移除【{tag}】？</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (currentTags.length <= 1) {
                                      showToast('⚠️ 至少須保留 1 個分類標籤！');
                                      setPendingDeleteTag(null);
                                      return;
                                    }
                                    const newTags = currentTags.filter((_, idx) => idx !== tIdx);
                                    setEditingPartner({
                                      ...editingPartner,
                                      categoryTags: newTags,
                                      categoryMain: newTags[0] || '',
                                      serviceCategoryMain: newTags[0] || ''
                                    });
                                    setPendingDeleteTag(null);
                                    setLastRemovedTag(tag);
                                    showToast(`✓ 已成功移除標籤「${tag}」`);
                                  }}
                                  className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-xs"
                                >
                                  確認移除
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingDeleteTag(null)}
                                  className="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-300 font-medium text-xs"
                                >
                                  取消
                                </button>
                              </span>
                            );
                          }

                          return (
                            <span
                              key={tIdx}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs ${
                                isTagEditMode
                                  ? 'bg-amber-100 text-amber-950 border border-amber-400'
                                  : 'bg-amber-50 text-amber-900 border border-amber-300'
                              }`}
                            >
                              <span>🏷️ {tag}</span>
                              {isTagEditMode && currentTags.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setPendingDeleteTag(tag)}
                                  className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-200 hover:bg-rose-100 hover:text-rose-700 text-amber-800 border border-amber-300"
                                >
                                  移除
                                </button>
                              )}
                            </span>
                          );
                        })}

                        {/* 下拉添加 */}
                        <select
                          value=""
                          onChange={e => {
                            const selected = e.target.value;
                            if (!selected) return;
                            if (!currentTags.includes(selected)) {
                              const updated = [...currentTags, selected];
                              setEditingPartner({
                                ...editingPartner,
                                categoryTags: updated,
                                categoryMain: updated[0],
                                serviceCategoryMain: updated[0]
                              });
                              showToast(`✓ 已加入產品標籤「${selected}」`);
                            }
                          }}
                          className="text-xs py-1.5 px-2 bg-amber-50 border border-dashed border-amber-400 rounded-lg text-amber-900 font-semibold cursor-pointer"
                        >
                          <option value="">＋ 新增字典標籤...</option>
                          {categoryTree
                            .filter(g => !currentTags.includes(g.mainCategory))
                            .map(g => (
                              <option key={g.mainCategory} value={g.mainCategory}>
                                🏷️ {g.mainCategory}
                              </option>
                            ))}
                        </select>
                      </div>
                    );
                  })()}

                  {/* 一鍵復原標籤 */}
                  {lastRemovedTag && (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs">
                      <span>剛才移除了標籤：🏷️ {lastRemovedTag}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const currentTags = editingPartner.categoryTags || [];
                          setEditingPartner({
                            ...editingPartner,
                            categoryTags: [...currentTags, lastRemovedTag]
                          });
                          setLastRemovedTag(null);
                        }}
                        className="px-2.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-xs flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>復原</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 名稱與統編驗證機小程式 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isClientOnly ? '業主全銜 / 客戶名稱' : '夥伴名稱 / 公司全稱'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingPartner.name}
                    onChange={e => setEditingPartner({ ...editingPartner, name: e.target.value })}
                    placeholder={isPerson ? "例：林建國 (個人業主/地主代表)" : "例：宏聯資產開發股份有限公司"}
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 font-bold"
                  />
                </div>

                <div>
                  <TaiwanIdTaxValidatorWidget
                    type={isPerson ? 'NATIONAL_ID' : 'TAX_ID'}
                    value={editingPartner.taxId || ''}
                    onChange={val => setEditingPartner({ ...editingPartner, taxId: val })}
                    label={
                      isPerson
                        ? isTaxRequired
                          ? '身分證字號 (10 碼)'
                          : '身分證字號 (個人業主選填，免強制)'
                        : '公司統一編號 (8 碼)'
                    }
                    required={isTaxRequired}
                  />
                </div>
              </div>

              {/* 負責人身分與收付款約定 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isPerson ? '業主/聯絡代表姓名' : '負責人姓名'}
                  </label>
                  <input
                    type="text"
                    value={editingPartner.representative || ''}
                    onChange={e =>
                      setEditingPartner({ ...editingPartner, representative: e.target.value })
                    }
                    placeholder={isPerson ? '填寫聯絡代表' : '公司代表人'}
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isClientOnly ? '付款方式約定' : '手續費/匯費負擔方'}
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
                    <option value="COMPANY">🏦 銀行匯款轉帳 (公庫入帳)</option>
                    <option value="PARTNER">💵 支票或現金交付</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isClientOnly ? '請款收款天數' : '付款條件天數 (票期)'}
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
                    <option value={30}>30 天 (月結 30 天)</option>
                    <option value={45}>45 天</option>
                    <option value={60}>60 天 (二個月票期)</option>
                    <option value={90}>90 天 (三個月票期)</option>
                  </select>
                </div>
              </div>

              {/* 統一發票開立與風控 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={editingPartner.hasInvoice !== false}
                      onChange={e =>
                        setEditingPartner({ ...editingPartner, hasInvoice: e.target.checked })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span>提供合法統一發票 (電子/三聯式發票)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 多元工種服務 (廠商模式) */}
          {activeEditorTab === 'CATEGORY' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-900">工程專門工種與專業技術分類</h4>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-600">
                  此處可為廠商登錄特定工程細項。目前已設定之主要分類標籤為：
                  <strong className="text-indigo-600 ml-1">
                    {editingPartner.categoryTags?.join('、') || editingPartner.categoryMain || '一般工程'}
                  </strong>
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: 多地址管理 (TaiwanAddressPicker) */}
          {activeEditorTab === 'ADDRESSES' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {isClientOnly ? '通訊與案場現勘地址' : '多地址管理 (中華郵政標準郵遞區號選單小程式)'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    依中華郵政標準規格自動切換郵遞區號與縣市行政區
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
                      label: isClientOnly ? '案場現勘地址' : '通訊地址',
                      postalCode: '100',
                      city: '臺北市',
                      district: '中正區',
                      streetAddress: '',
                      fullAddress: '',
                      isDeleted: false
                    });
                    setEditingPartner({ ...editingPartner, addresses: list });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
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
                          value={addr.label || (isClientOnly ? '通訊地址' : '主要營業地址')}
                          onChange={e => {
                            const list = [...(editingPartner.addresses || [])];
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
                          className="text-slate-400 hover:text-red-600 text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>刪除地址</span>
                        </button>
                      )}
                    </div>

                    <TaiwanAddressPicker
                      value={{
                        postalCode: addr.postalCode,
                        city: addr.city,
                        district: addr.district,
                        streetAddress: addr.streetAddress,
                        fullAddress: addr.fullAddress
                      }}
                      onChange={val => {
                        const list = [...(editingPartner.addresses || [])];
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
                  <h4 className="text-xs font-bold text-slate-900">
                    {isClientOnly ? '業主窗口名冊' : '商業夥伴多元聯絡人'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    記錄主要負責人、工務窗口、業務代表與會計對帳窗口
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
                      title: isClientOnly ? '現勘工地窗口' : '工務窗口',
                      phone: '',
                      mobile: '',
                      extension: '',
                      email: '',
                      isDeleted: false
                    });
                    setEditingPartner({ ...editingPartner, contacts: list });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
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
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 text-xs">
                        {idx === 0 ? '主要業務窗口' : `聯絡人 #${idx + 1}`}
                      </span>
                      {(editingPartner.contacts || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const list = editingPartner.contacts!.filter((_, i) => i !== idx);
                            setEditingPartner({ ...editingPartner, contacts: list });
                          }}
                          className="text-slate-400 hover:text-red-600 text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>刪除</span>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">姓名</label>
                        <input
                          type="text"
                          value={con.name}
                          onChange={e => {
                            const list = [...editingPartner.contacts!];
                            list[idx].name = e.target.value;
                            setEditingPartner({
                              ...editingPartner,
                              contacts: list,
                              contactPerson: idx === 0 ? e.target.value : editingPartner.contactPerson
                            });
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
                          placeholder="例：專案經理"
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
                            setEditingPartner({
                              ...editingPartner,
                              contacts: list,
                              phone: idx === 0 && !editingPartner.phone ? e.target.value : editingPartner.phone
                            });
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

          {/* TAB 5: 金融帳戶 (非純業主或自願填寫時) */}
          {activeEditorTab === 'BANK' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-indigo-600" />
                  <span>主要往來金融機構帳號</span>
                </h4>

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
                  label="全國金融機構代碼與機構名稱"
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
                      placeholder="戶名"
                      className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      銀行帳號
                    </label>
                    <input
                      type="text"
                      value={editingPartner.bankAccount || ''}
                      onChange={e =>
                        setEditingPartner({ ...editingPartner, bankAccount: e.target.value.trim() })
                      }
                      placeholder="帳號"
                      className="w-full text-xs p-2.5 font-mono font-bold bg-white border border-slate-300 rounded-lg tracking-wider"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: 支票往來 */}
          {activeEditorTab === 'CHEQUES' && (
            <div className="space-y-4">
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500">
                主檔建立後，可隨時自【聯絡明細】總覽介面記錄收受或開立支票！
              </div>
            </div>
          )}

          {/* TAB 7: 名片管理 */}
          {activeEditorTab === 'CARDS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Contact className="w-4 h-4 text-indigo-600" />
                    <span>名片收存與主要聯絡人連動</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    可在此上傳或拍攝名片，並隨時一鍵帶入主要聯絡人
                  </p>
                </div>
                <label className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>上傳名片照片</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={e =>
                      handleProcessUploadedFiles(e.target.files, newFiles => {
                        if (newFiles.length > 0) {
                          const f = newFiles[0];
                          const newCard: PartnerBusinessCard = {
                            id: `PBC-${Date.now()}`,
                            partnerId: editingPartner.id,
                            name: editingPartner.contactPerson || editingPartner.name,
                            title: '窗口代表',
                            companyName: editingPartner.name,
                            phone: editingPartner.phone || '',
                            exchangeDate: new Date().toISOString().slice(0, 10),
                            cardFrontUrl: f.dataUrl,
                            cardFileType: f.fileType === 'PDF' ? 'PDF' : 'IMAGE',
                            notes: '案場建檔建立'
                          };
                          setEditingPartner({
                            ...editingPartner,
                            businessCards: [...(editingPartner.businessCards || []), newCard]
                          });
                        }
                      })
                    }
                  />
                </label>
              </div>

              {editingPartner.businessCards && editingPartner.businessCards.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {editingPartner.businessCards.map((card, idx) => (
                    <div
                      key={card.id || idx}
                      className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800">{card.name || '名片'}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{card.exchangeDate}</span>
                      </div>
                      {card.cardFrontUrl && (
                        <div className="aspect-16/9 bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                          <img src={card.cardFrontUrl} alt="名片" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPartner({
                              ...editingPartner,
                              contactPerson: card.name,
                              phone: card.phone || card.mobile || editingPartner.phone
                            });
                            showToast(`✅ 已將「${card.name}」帶入為主要聯絡人`);
                          }}
                          className="text-[11px] text-indigo-600 hover:underline font-bold cursor-pointer"
                        >
                          帶入為主要聯絡人
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const list = editingPartner.businessCards!.filter((_, i) => i !== idx);
                            setEditingPartner({ ...editingPartner, businessCards: list });
                          }}
                          className="text-slate-400 hover:text-red-600 text-xs p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400">
                  尚未收存任何名片
                </div>
              )}
            </div>
          )}

          {/* TAB 8: 無紙化金庫與合約圖說 */}
          {activeEditorTab === 'VAULT' && (
            <div className="space-y-4">
              <AttachmentUploader
                targetTable="business_partners"
                targetId={editingPartner.id}
                partnerId={editingPartner.id}
                title={`【${editingPartner.name || '此夥伴'}】專屬無紙化金庫與合約證件`}
                defaultCategory="正式合約"
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">
            {isClientOnly ? '✓ 聯絡明細規格業主主檔' : '✓ 商業夥伴全功能規格'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSavePartner();
              }}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isClientOnly ? '儲存業主主檔並直接帶入' : '儲存此夥伴主檔'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
