import React, { useState, useEffect, useRef } from 'react';
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
  Save
} from 'lucide-react';
import {
  BusinessPartner,
  PartnerBusinessCard,
  PartnerChequeRecord,
  StoredMediaFile
} from '../../types/erp';
import { useAuth } from '../../context/AuthContext';
import {
  saveBusinessPartner,
  getSubcontractorCategoryTree,
  addVendorToSubcontractorCategory
} from '../../db/sqlite';
import { ENGINEERING_CATEGORIES } from '../../utils/engineeringCategories';
import { validateTaiwanTaxId, validateTaiwanNationalId } from '../../utils/taiwanValidation';
import { processUploadedMediaFiles } from '../../utils/mediaUtils';
import { AttachmentUploader } from '../attachments/AttachmentUploader';
import { HoverMediaPopover, HoverMediaPreviewData } from '../widgets/HoverMediaPopover';
import { MediaPreviewLightbox, MediaPreviewItem } from '../widgets/MediaPreviewLightbox';
import { PartnerBasicInfoTab, MappedCategoryItem } from './tabs/PartnerBasicInfoTab';
import { PartnerAddressesTab, PartnerContactsTab } from './tabs/PartnerAddressesContactsTab';
import { normalizePartnerForEditor } from './partnerWorkspaceUtils';
import {
  PartnerCategoryServiceTab,
  PartnerBankTab,
  PartnerChequesTab,
  PartnerCardsTab
} from './tabs/PartnerBankCardsTab';

export interface PartnerEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner?: BusinessPartner | null;
  initialName?: string;
  defaultType?: 'CUSTOMER' | 'VENDOR' | 'BOTH';
  onSaved?: (partner: BusinessPartner) => void;
  title?: string;
  onOpenAddCheque?: (partnerId: string) => void;
  onSelectChequeDetail?: (cheque: PartnerChequeRecord) => void;
  onRequestDeleteCheque?: (cheque: PartnerChequeRecord) => void;
  onOpenAddCard?: (partner: BusinessPartner) => void;
  onRequestDeleteCard?: (card: PartnerBusinessCard) => void;
  onNotify?: (msg: string) => void;
}

function loadMappedCategoryTree(): MappedCategoryItem[] {
  try {
    const tree = getSubcontractorCategoryTree();
    if (tree && tree.length > 0) {
      return tree.map(cg => ({
        mainCategory: cg.category,
        subCategories: (cg.vendors || []).filter(v => v.isActive !== false).map(v => v.name)
      }));
    }
  } catch {
    // 保留預設樹狀分類
  }
  return ENGINEERING_CATEGORIES;
}

function createDefaultPartner(
  initialName: string,
  defaultType: 'CUSTOMER' | 'VENDOR' | 'BOTH',
  categoryTree: MappedCategoryItem[]
): BusinessPartner {
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
    entityType: 'CORPORATION',
    isIndividual: false,
    type: defaultType,
    isCustomer: defaultType === 'CUSTOMER' || defaultType === 'BOTH',
    isVendor: defaultType === 'VENDOR' || defaultType === 'BOTH',
    categoryMain: !isClientMode ? defaultVendorCategory : undefined,
    categorySub: '',
    serviceCategoryMain: !isClientMode ? defaultVendorCategory : '泥作裝修工程',
    serviceCategorySub: '',
    serviceCategories: !isClientMode
      ? [{ id: `CAT-${Date.now()}-1`, main: defaultVendorCategory, sub: '' }]
      : [],
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
        postalCode: '',
        city: '',
        district: '',
        streetAddress: '',
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
}

export const PartnerEditorModal: React.FC<PartnerEditorModalProps> = ({
  isOpen,
  onClose,
  partner,
  initialName = '',
  defaultType = 'CUSTOMER',
  onSaved,
  title,
  onOpenAddCheque,
  onSelectChequeDetail,
  onRequestDeleteCheque,
  onOpenAddCard,
  onRequestDeleteCard,
  onNotify
}) => {
  const { currentUser } = useAuth();
  const [activeEditorTab, setActiveEditorTab] = useState<string>('BASIC');
  const [categoryTree, setCategoryTree] = useState<MappedCategoryItem[]>(() => loadMappedCategoryTree());

  const [isTagEditMode, setIsTagEditMode] = useState<boolean>(false);
  const [pendingDeleteTag, setPendingDeleteTag] = useState<string | null>(null);
  const [lastRemovedTag, setLastRemovedTag] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [hoverPreview, setHoverPreview] = useState<HoverMediaPreviewData | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<MediaPreviewItem | null>(null);

  const [editingPartner, setEditingPartner] = useState<BusinessPartner>(() =>
    partner ? normalizePartnerForEditor(partner) : createDefaultPartner(initialName, defaultType, categoryTree)
  );

  const prevOpenRef = useRef<boolean>(false);
  const prevPartnerIdRef = useRef<string | undefined>(partner?.id);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    onNotify?.(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (!isOpen) {
      prevOpenRef.current = false;
      return;
    }

    const freshTree = loadMappedCategoryTree();
    setCategoryTree(freshTree);

    const justOpened = !prevOpenRef.current;
    const partnerChanged = partner?.id !== prevPartnerIdRef.current;

    if (justOpened || partnerChanged) {
      setActiveEditorTab('BASIC');
      setIsTagEditMode(false);
      setPendingDeleteTag(null);
      setLastRemovedTag(null);
      setEditingPartner(
        partner ? normalizePartnerForEditor(partner) : createDefaultPartner(initialName, defaultType, freshTree)
      );
    } else if (partner) {
      // 同夥伴在編輯器開啟期間新增/刪除支票或名片時，僅同步即時子陣列，保留未儲存表單欄位與當前頁籤
      setEditingPartner(prev => ({
        ...prev,
        chequeRecords: partner.chequeRecords || prev.chequeRecords,
        businessCards: partner.businessCards || prev.businessCards
      }));
    } else if (initialName) {
      setEditingPartner(prev => (prev.name ? prev : { ...prev, name: initialName.trim() }));
    }

    prevOpenRef.current = true;
    prevPartnerIdRef.current = partner?.id;
  }, [isOpen, partner, initialName, defaultType]);

  if (!isOpen) return null;

  const isClientOnly = Boolean(editingPartner.isCustomer && !editingPartner.isVendor);
  const isPerson = Boolean(editingPartner.entityType === 'NATURAL_PERSON' || editingPartner.isIndividual);
  const isTaxRequired = !(editingPartner.isCustomer && isPerson);

  const handleProcessUploadedFiles = async (
    files: FileList | null,
    onSuccess: (newFiles: StoredMediaFile[]) => void
  ) => {
    const uploadedList = await processUploadedMediaFiles(files, fileName => {
      showToast(`❌ 讀取檔案 ${fileName} 失敗`);
    });
    if (uploadedList.length > 0) {
      onSuccess(uploadedList);
      showToast(`📎 成功上傳 ${uploadedList.length} 個檔案憑證`);
    }
  };

  const handleSavePartner = () => {
    if (!editingPartner.name.trim()) {
      showToast('⚠️ 請填寫夥伴名稱 / 業主姓名！');
      return;
    }
    if (!editingPartner.isCustomer && !editingPartner.isVendor) {
      showToast('⚠️ 業務身分至少須勾選一項（業主或合作廠商），不可全部取消！');
      return;
    }
    if (!isClientOnly && !editingPartner.taxId.trim()) {
      showToast('⚠️ 合作廠商必須填寫公司統一編號或負責人身分證字號！');
      return;
    }

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
      const primaryAddr =
        editingPartner.addresses?.find(a => !a.isHistorical) || editingPartner.addresses?.[0];
      const tags =
        editingPartner.categoryTags && editingPartner.categoryTags.length > 0
          ? editingPartner.categoryTags
          : editingPartner.categoryMain
          ? [editingPartner.categoryMain]
          : [categoryTree[0]?.mainCategory || '鋼材'];
      const fallbackCat = tags[0];

      const partnerToSave: BusinessPartner = {
        ...editingPartner,
        name: editingPartner.name.trim(),
        taxId: editingPartner.taxId.trim(),
        representative: editingPartner.representative?.trim() || '',
        contactPerson:
          editingPartner.contactPerson?.trim() || editingPartner.contacts?.[0]?.name?.trim() || '',
        phone:
          editingPartner.phone?.trim() ||
          editingPartner.contacts?.[0]?.phone?.trim() ||
          editingPartner.contacts?.[0]?.mobile?.trim() ||
          '',
        isIndividual: isPerson,
        categoryTags: editingPartner.isVendor ? tags : editingPartner.categoryTags,
        categoryMain: editingPartner.isVendor ? fallbackCat : editingPartner.categoryMain,
        serviceCategoryMain: editingPartner.isVendor ? fallbackCat : editingPartner.serviceCategoryMain,
        address: primaryAddr ? (primaryAddr.fullAddress || '') : (editingPartner.address || '')
      };

      const saved = saveBusinessPartner(partnerToSave, operator);

      if (partnerToSave.isVendor && partnerToSave.name) {
        for (const tag of tags) {
          try {
            addVendorToSubcontractorCategory(tag, partnerToSave.name, operator);
          } catch {
            // ignore non-critical sync failure
          }
        }
      }

      onSaved?.(saved);
      onClose();
    } catch (err: any) {
      showToast('❌ 儲存失敗：' + (err.message || '未知錯誤'));
    }
  };

  const modalTabs = [
    { key: 'BASIC', label: isClientOnly ? '1. 基本身分與業主資料' : '1. 基本身分與風控', icon: Building2 },
    ...(isClientOnly ? [] : [{ key: 'CATEGORY', label: '2. 多元工種服務', icon: Layers }]),
    { key: 'ADDRESSES', label: isClientOnly ? '2. 通訊與案場地址' : '3. 多地址管理 (郵政)', icon: MapPin },
    { key: 'CONTACTS', label: isClientOnly ? '3. 聯絡人名冊' : '4. 聯絡人名冊', icon: Users2 },
    ...(isClientOnly
      ? []
      : [
          { key: 'BANK', label: '5. 金融帳戶與存摺', icon: Landmark },
          {
            key: 'CHEQUES',
            label: `6. 支票往來 (${editingPartner.chequeRecords?.length || 0})`,
            icon: Receipt
          }
        ]),
    {
      key: 'CARDS',
      label: isClientOnly
        ? `4. 名片管理 (${editingPartner.businessCards?.length || 0})`
        : `7. 名片管理 (${editingPartner.businessCards?.length || 0})`,
      icon: Contact
    },
    { key: 'VAULT', label: isClientOnly ? '5. 無紙化金庫與圖說' : '8. 無紙化金庫與圖說', icon: FolderLock }
  ];

  return createPortal(
    <>
      <div
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in"
      >
        <div
          onClick={e => e.stopPropagation()}
          className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150 relative"
        >
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
                  {title || (isClientOnly ? '商業夥伴與業主主檔編輯（聯絡明細規格）' : '商業夥伴主檔編輯器（聯絡明細規格）')}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  夥伴編號：{editingPartner.bpCode} · {isClientOnly ? '合約甲方業主名冊' : '商業夥伴主庫'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={e => {
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
            {activeEditorTab === 'BASIC' && (
              <PartnerBasicInfoTab
                editingPartner={editingPartner}
                setEditingPartner={setEditingPartner}
                categoryTree={categoryTree}
                isClientOnly={isClientOnly}
                isPerson={isPerson}
                isTaxRequired={isTaxRequired}
                isTagEditMode={isTagEditMode}
                setIsTagEditMode={setIsTagEditMode}
                pendingDeleteTag={pendingDeleteTag}
                setPendingDeleteTag={setPendingDeleteTag}
                lastRemovedTag={lastRemovedTag}
                setLastRemovedTag={setLastRemovedTag}
                showToast={showToast}
              />
            )}

            {activeEditorTab === 'CATEGORY' && (
              <PartnerCategoryServiceTab
                editingPartner={editingPartner}
                setEditingPartner={setEditingPartner}
                categoryTree={categoryTree}
                showToast={showToast}
              />
            )}

            {activeEditorTab === 'ADDRESSES' && (
              <PartnerAddressesTab
                editingPartner={editingPartner}
                setEditingPartner={setEditingPartner}
                isClientOnly={isClientOnly}
              />
            )}

            {activeEditorTab === 'CONTACTS' && (
              <PartnerContactsTab
                editingPartner={editingPartner}
                setEditingPartner={setEditingPartner}
                isClientOnly={isClientOnly}
              />
            )}

            {activeEditorTab === 'BANK' && (
              <PartnerBankTab
                editingPartner={editingPartner}
                setEditingPartner={setEditingPartner}
                handleProcessFiles={handleProcessUploadedFiles}
                setLightboxMedia={setLightboxMedia}
                setHoverPreview={setHoverPreview}
              />
            )}

            {activeEditorTab === 'CHEQUES' && (
              <PartnerChequesTab
                editingPartner={editingPartner}
                onOpenAddCheque={onOpenAddCheque}
                onSelectChequeDetail={onSelectChequeDetail}
                onRequestDeleteCheque={onRequestDeleteCheque}
              />
            )}

            {activeEditorTab === 'CARDS' && (
              <PartnerCardsTab
                editingPartner={editingPartner}
                setEditingPartner={setEditingPartner}
                handleProcessFiles={handleProcessUploadedFiles}
                setLightboxMedia={setLightboxMedia}
                setHoverPreview={setHoverPreview}
                onOpenAddCard={onOpenAddCard}
                onRequestDeleteCard={onRequestDeleteCard}
                showToast={showToast}
              />
            )}

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
                onClick={e => {
                  e.stopPropagation();
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleSavePartner();
                }}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isClientOnly ? '儲存業主主檔' : '儲存此夥伴主檔'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <HoverMediaPopover preview={hoverPreview} />
      {lightboxMedia && (
        <MediaPreviewLightbox media={lightboxMedia} onClose={() => setLightboxMedia(null)} />
      )}
    </>,
    document.body
  );
};
