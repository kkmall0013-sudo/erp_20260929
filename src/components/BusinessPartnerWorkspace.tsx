import React, { useState, useMemo, useEffect } from 'react';
import {
  Users2,
  Building2,
  HardHat,
  Plus,
  ArrowRightLeft,
  Upload,
  Layers,
  Download
} from 'lucide-react';
import {
  BusinessPartner,
  PartnerChequeRecord,
  StoredMediaFile,
  PartnerBusinessCard
} from '../types/erp';
import { getBankByCode } from '../utils/taiwanBanks';
import { ENGINEERING_CATEGORIES } from '../utils/engineeringCategories';
import { processUploadedMediaFiles } from '../utils/mediaUtils';
import {
  getAllBusinessPartners,
  getBusinessPartnerById,
  getAllCompanies,
  saveBusinessPartner,
  deleteBusinessPartner,
  convertVendorToClient,
  savePartnerChequeRecord,
  deletePartnerChequeRecord,
  savePartnerBusinessCard,
  deletePartnerBusinessCard,
  getSubcontractorCategoryTree
} from '../db/sqlite';
import { useAuth } from '../context/AuthContext';
import { WorkspaceHeaderShell } from './widgets/WorkspaceHeaderShell';
import { UniversalSearchBar } from './widgets/UniversalSearchBar';
import { TagQuickFilterBar } from './widgets/TagQuickFilterBar';
import { createSearchDatasetLookup } from '../utils/universalSearchEngine';
import { ConfirmDialogModal } from './widgets/ConfirmDialogModal';
import { HoverMediaPopover, HoverMediaPreviewData } from './widgets/HoverMediaPopover';
import { MediaPreviewLightbox, MediaPreviewItem } from './widgets/MediaPreviewLightbox';
import { ChequeDetailModal } from './widgets/ChequeDetailModal';
import { SubcontractorCategoryManagerModal } from './partners/SubcontractorCategoryManagerModal';
import { ClientUpgradeVendorModal } from './partners/ClientUpgradeVendorModal';
import { PartnerImportModal } from './partners/PartnerImportModal';
import { PartnerEditorModal } from './partners/PartnerEditorModal';
import {
  PartnerDirectoryTableView,
  DeletePartnerRequest
} from './partners/PartnerDirectoryTableView';
import { PartnerDirectoryCardView } from './partners/PartnerDirectoryCardView';
import { PartnerChequeModal } from './partners/PartnerChequeModal';
import { PartnerBusinessCardModal } from './partners/PartnerBusinessCardModal';
import { PartnerVendorToClientModal } from './partners/PartnerVendorToClientModal';
import {
  buildNewPartnerDraft,
  exportPartnersToCsv,
  normalizePartnerForEditor
} from './partners/partnerWorkspaceUtils';

interface BusinessPartnerWorkspaceProps {
  onNotify?: (message: string) => void;
}

type DeleteConfirmTarget =
  | DeletePartnerRequest
  | {
      type: 'CHEQUE' | 'CARD';
      id: string;
      partnerId?: string;
      name: string;
      isBoth?: false;
      extraNotice?: string;
    };

export const BusinessPartnerWorkspace: React.FC<BusinessPartnerWorkspaceProps> = ({
  onNotify
}) => {
  const { currentUser, isSuperadmin, can } = useAuth();
  const canWrite = isSuperadmin || can('PARTNERS', 'write');
  const canManageCategories =
    isSuperadmin ||
    currentUser?.role === 'BOSS' ||
    Boolean(currentUser?.canManageSystemConfigs) ||
    currentUser?.role === 'ADMIN';

  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [activeTab, setActiveTab] = useState<'CLIENTS' | 'VENDORS'>('CLIENTS');
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // 篩選條件（主分類標籤 + UniversalSearchBar 多欄位權限過濾結果）
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('ALL');
  const [searchFilteredPartners, setSearchFilteredPartners] = useState<BusinessPartner[] | null>(null);
  const [searchActiveCount, setSearchActiveCount] = useState<number>(0);

  // 子彈窗狀態
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<BusinessPartner | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Partial<PartnerBusinessCard>>({});
  const [cardTargetPartner, setCardTargetPartner] = useState<BusinessPartner | null>(null);
  const [isChequeModalOpen, setIsChequeModalOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<Partial<PartnerChequeRecord>>({});
  const [selectedChequeForDetail, setSelectedChequeForDetail] = useState<PartnerChequeRecord | null>(null);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<DeleteConfirmTarget | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<MediaPreviewItem | null>(null);
  const [hoverPreview, setHoverPreview] = useState<HoverMediaPreviewData | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [upgradeClientTarget, setUpgradeClientTarget] = useState<BusinessPartner | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [categoryTree, setCategoryTree] = useState(ENGINEERING_CATEGORIES);

  const reloadData = () => {
    const list = getAllBusinessPartners();
    setPartners(list);
    try {
      const tree = getSubcontractorCategoryTree();
      if (tree && tree.length > 0) {
        const mapped = tree.map(cg => ({
          mainCategory: cg.category,
          subCategories: (cg.vendors || []).filter(v => v.isActive !== false).map(v => v.name)
        }));
        if (mapped.length > 0) setCategoryTree(mapped);
      }
    } catch {
      // 保留預設分類
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  const showToast = (msg: string) => {
    onNotify?.(msg);
  };

  const clientsCount = useMemo(() => partners.filter(p => p.isCustomer).length, [partners]);
  const vendorsCount = useMemo(() => partners.filter(p => p.isVendor).length, [partners]);

  const searchLookup = useMemo(() => {
    return createSearchDatasetLookup({
      companies: getAllCompanies(),
      partners
    });
  }, [partners]);

  const tabAndCategoryPartners = useMemo(() => {
    return partners.filter(p => {
      if (activeTab === 'CLIENTS' && !p.isCustomer) return false;
      if (activeTab === 'VENDORS' && !p.isVendor) return false;
      if (selectedMainCategory !== 'ALL') {
        const hasMain =
          (p.categoryTags || []).includes(selectedMainCategory) ||
          p.categoryMain === selectedMainCategory ||
          p.serviceCategoryMain === selectedMainCategory ||
          (p.serviceCategories || []).some(c => c.main === selectedMainCategory);
        if (!hasMain) return false;
      }
      return true;
    });
  }, [partners, activeTab, selectedMainCategory]);

  const filteredPartners = useMemo(
    () => searchFilteredPartners ?? tabAndCategoryPartners,
    [searchFilteredPartners, tabAndCategoryPartners]
  );

  const totalPages = useMemo(
    () => (pageSize >= 9999 ? 1 : Math.max(1, Math.ceil(filteredPartners.length / pageSize))),
    [filteredPartners.length, pageSize]
  );

  const pagedPartners = useMemo(() => {
    if (pageSize >= 9999) return filteredPartners;
    const start = (currentPage - 1) * pageSize;
    return filteredPartners.slice(start, start + pageSize);
  }, [filteredPartners, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedMainCategory, filteredPartners.length]);

  const tagQuickItems = useMemo(() => {
    return categoryTree.map(cat => {
      const count = partners.filter(
        p =>
          p.isVendor &&
          ((p.categoryTags || []).includes(cat.mainCategory) ||
            p.categoryMain === cat.mainCategory ||
            p.serviceCategoryMain === cat.mainCategory)
      ).length;
      return {
        key: cat.mainCategory,
        label: cat.mainCategory,
        count,
        title: `點選快速檢視標記有「${cat.mainCategory}」之廠商 (${count}家)`
      };
    });
  }, [categoryTree, partners]);

  const handleOpenCreatePartner = () => {
    setEditingPartner(buildNewPartnerDraft(activeTab, clientsCount, vendorsCount, categoryTree));
    setIsEditorOpen(true);
  };

  const handleEditPartner = (p: BusinessPartner) => {
    setEditingPartner(normalizePartnerForEditor(p));
    setIsEditorOpen(true);
  };

  const handleExportCsv = () => {
    if (filteredPartners.length === 0) {
      showToast('⚠️ 目前清單無資料可供匯出');
      return;
    }
    exportPartnersToCsv(filteredPartners, activeTab);
    showToast(`✓ 已成功匯出 ${filteredPartners.length} 筆資料為 CSV！`);
  };

  const handleExecuteDeletePartner = (id: string, name: string, onlyRemoveCustomer = false) => {
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

      setPartners(prev =>
        prev.filter(p => (onlyRemoveCustomer ? p.id !== id || p.isVendor : p.id !== id))
      );
      reloadData();
      setDeleteConfirmTarget(null);
    } catch (err: any) {
      showToast('❌ 刪除失敗：' + (err.message || '未知錯誤'));
    }
  };

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

  const handleSaveCheque = () => {
    if (!editingCheque.partnerId) return showToast('⚠️ 未指定商業夥伴！');
    if (!editingCheque.checkNumber?.trim()) return showToast('⚠️ 請填寫支票號碼！');
    if (!editingCheque.amount || editingCheque.amount <= 0) {
      return showToast('⚠️ 支票金額必須為大於 0 之正數！');
    }

    try {
      const operator = currentUser?.fullName || '系統管理員';
      const today = new Date().toISOString().slice(0, 10);
      const recordToSave: PartnerChequeRecord = {
        id: editingCheque.id || `PCHK-${Date.now().toString().slice(-6)}`,
        partnerId: editingCheque.partnerId,
        direction: editingCheque.direction || 'RECEIPT',
        bankCode: editingCheque.bankCode || '004',
        bankName: editingCheque.bankName || '臺灣銀行',
        branchName: editingCheque.branchName || '',
        accountNumber: editingCheque.accountNumber || '',
        checkNumber: editingCheque.checkNumber.trim().toUpperCase(),
        receivedDate: editingCheque.receivedDate || today,
        issueDate: editingCheque.issueDate || today,
        dueDate: editingCheque.dueDate || today,
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

      if (editingPartner && editingPartner.id === editingCheque.partnerId) {
        const fresh = getBusinessPartnerById(editingCheque.partnerId);
        if (fresh) setEditingPartner(fresh);
      }

      setIsChequeModalOpen(false);
      showToast(`💳 已成功記錄支票往來：${editingCheque.checkNumber}`);
    } catch (err: any) {
      showToast('❌ 支票記錄儲存失敗：' + (err.message || '未知錯誤'));
    }
  };

  const handleExecuteDeleteCheque = (chequeId: string, partnerId?: string) => {
    try {
      deletePartnerChequeRecord(chequeId, currentUser?.fullName || '系統管理員');
      reloadData();
      if (partnerId && editingPartner && editingPartner.id === partnerId) {
        const fresh = getBusinessPartnerById(partnerId);
        if (fresh) setEditingPartner(fresh);
      }
      setDeleteConfirmTarget(null);
      if (selectedChequeForDetail?.id === chequeId) setSelectedChequeForDetail(null);
      showToast('🗑️ 已成功刪除支票記錄');
    } catch (err: any) {
      showToast('❌ 刪除失敗：' + (err.message || '未知錯誤'));
    }
  };

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

  const handleSaveCard = () => {
    if (!cardTargetPartner || !editingCard.partnerId) return;
    if (!editingCard.name?.trim()) return showToast('⚠️ 請填寫名片姓名！');

    try {
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

      savePartnerBusinessCard(cardToSave, currentUser?.fullName || '系統管理員');
      reloadData();

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

  const handleExecuteDeleteCard = (cardId: string, partnerId?: string) => {
    try {
      deletePartnerBusinessCard(cardId, currentUser?.fullName || '系統管理員');
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

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <WorkspaceHeaderShell
        icon={<Users2 className="w-5 h-5" />}
        title="聯絡明細 (商業夥伴)"
        badgeText="業主 · 廠商 · 工班 · 技師通訊錄"
        subtitle="整合個人與法人業主、協力發包廠商、二階工料分類、郵遞區號選單與匯入匯出"
        rightActions={
          <>
            {canManageCategories && (
              <button
                type="button"
                onClick={() => setIsCategoryManagerOpen(true)}
                className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                title="維護廠商第一階工料大類與第二階專業細項字典 (管理員專屬)"
              >
                <Layers className="w-4 h-4 text-amber-600" />
                <span>專業分類管理</span>
              </button>
            )}
            {canWrite && (
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                title="批次自 CSV 試算表匯入業主或廠商通訊名冊"
              >
                <Upload className="w-4 h-4 text-slate-600" />
                <span>批次匯入</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="將目前名單匯出為 CSV 試算表 (含 UTF-8 with BOM)"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>匯出 CSV</span>
            </button>
            {activeTab === 'CLIENTS' && canWrite && (
              <button
                type="button"
                onClick={() => setIsConvertModalOpen(true)}
                className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50/80 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                title="從既有合作廠商快速轉換或引薦為業主"
              >
                <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                <span>一鍵從廠商引薦加入業主</span>
              </button>
            )}
            {canWrite && (
              <button
                type="button"
                onClick={handleOpenCreatePartner}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-transform active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{activeTab === 'CLIENTS' ? '新增業主資料' : '新增合作廠商'}</span>
              </button>
            )}
          </>
        }
        tabs={[
          {
            key: 'CLIENTS',
            label: '業主名冊 (客戶 / 發包方)',
            icon: <Users2 className="w-4 h-4" />,
            count: clientsCount,
            activeTabClass: 'border-indigo-600 text-indigo-600 bg-indigo-50/30',
            activeBadgeClass: 'bg-indigo-600 text-white'
          },
          {
            key: 'VENDORS',
            label: '合作廠商名冊 (協力包商 / 材料商)',
            icon: <HardHat className="w-4 h-4" />,
            count: vendorsCount,
            activeTabClass: 'border-amber-600 text-amber-600 bg-amber-50/30',
            activeBadgeClass: 'bg-amber-600 text-white'
          }
        ]}
        activeTab={activeTab}
        onTabChange={tab => {
          setActiveTab(tab as 'CLIENTS' | 'VENDORS');
          setSelectedMainCategory('ALL');
          setSearchFilteredPartners(null);
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      >
        <div className="space-y-2.5 pt-1">
          <UniversalSearchBar<BusinessPartner>
            datasetKey="PARTNERS"
            records={tabAndCategoryPartners}
            lookup={searchLookup}
            placeholder={
              activeTab === 'CLIENTS'
                ? '輸入關鍵字快速搜尋業主（名稱、統編、窗口、電話、地址／台臺別名、名片...）'
                : '輸入關鍵字快速搜尋合作廠商（名稱、統編、工種分類、地區／台臺別名、名片...）'
            }
            onResultsChange={(results, meta) => {
              setSearchFilteredPartners(results.map(r => r.record));
              setSearchActiveCount(meta.activeConditionCount);
            }}
          />

          {activeTab === 'VENDORS' && (
            <TagQuickFilterBar
              allLabel="全部廠商"
              allCount={vendorsCount}
              items={tagQuickItems}
              selectedKey={selectedMainCategory}
              onSelect={setSelectedMainCategory}
            />
          )}

          <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                符合條件：<strong className="text-slate-900 font-mono tabular-nums">{filteredPartners.length}</strong> 筆
              </span>
              {selectedMainCategory !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedMainCategory('ALL')}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer"
                  title="點擊取消分類標籤過濾"
                >
                  工項：{selectedMainCategory} ×
                </button>
              )}
              {searchActiveCount > 0 && (
                <span className="text-[11px] text-slate-500">
                  （已啟用進階篩選 {searchActiveCount} 項）
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
                {[
                  { value: 25, label: '25 筆' },
                  { value: 50, label: '50 筆' },
                  { value: 100, label: '100 筆' },
                  { value: 9999, label: '全部顯示' }
                ].map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </WorkspaceHeaderShell>

      {/* 主要展示區 */}
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
          <PartnerDirectoryTableView
            pagedPartners={pagedPartners}
            totalFilteredCount={filteredPartners.length}
            activeTab={activeTab}
            selectedMainCategory={selectedMainCategory}
            onSelectMainCategory={setSelectedMainCategory}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            canWrite={canWrite}
            onEditPartner={handleEditPartner}
            onOpenAddCheque={handleOpenAddCheque}
            onSelectChequeDetail={setSelectedChequeForDetail}
            onOpenAddCard={handleOpenAddCard}
            onUpgradeClient={setUpgradeClientTarget}
            onRequestDeletePartner={setDeleteConfirmTarget}
            onOpenLightbox={setLightboxMedia}
            onHoverPreview={setHoverPreview}
          />
        ) : (
          <PartnerDirectoryCardView
            pagedPartners={pagedPartners}
            activeTab={activeTab}
            selectedMainCategory={selectedMainCategory}
            onSelectMainCategory={setSelectedMainCategory}
            canWrite={canWrite}
            onEditPartner={handleEditPartner}
            onOpenAddCheque={handleOpenAddCheque}
            onSelectChequeDetail={setSelectedChequeForDetail}
            onOpenAddCard={handleOpenAddCard}
            onUpgradeClient={setUpgradeClientTarget}
            onRequestDeletePartner={setDeleteConfirmTarget}
          />
        )}
      </div>

      {/* 唯一商業夥伴主檔編輯器 (已整併消滅重複實作) */}
      <PartnerEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        partner={editingPartner}
        defaultType={activeTab === 'CLIENTS' ? 'CUSTOMER' : 'VENDOR'}
        onSaved={saved => {
          reloadData();
          showToast(`🎉 成功儲存商業夥伴主檔：${saved.name}`);
        }}
        onOpenAddCheque={handleOpenAddCheque}
        onSelectChequeDetail={setSelectedChequeForDetail}
        onRequestDeleteCheque={chk =>
          setDeleteConfirmTarget({
            type: 'CHEQUE',
            id: chk.id,
            partnerId: editingPartner?.id,
            name: `支票 ${chk.checkNumber}`
          })
        }
        onOpenAddCard={handleOpenAddCard}
        onRequestDeleteCard={card =>
          setDeleteConfirmTarget({
            type: 'CARD',
            id: card.id,
            partnerId: editingPartner?.id,
            name: `名片 ${card.name}`
          })
        }
        onNotify={showToast}
      />

      <PartnerChequeModal
        isOpen={isChequeModalOpen}
        editingCheque={editingCheque}
        setEditingCheque={setEditingCheque}
        onClose={() => setIsChequeModalOpen(false)}
        onSave={handleSaveCheque}
        onProcessFiles={handleProcessUploadedFiles}
        onOpenLightbox={setLightboxMedia}
      />

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

      <PartnerBusinessCardModal
        isOpen={isCardModalOpen}
        cardTargetPartner={cardTargetPartner}
        editingCard={editingCard}
        setEditingCard={setEditingCard}
        onClose={() => setIsCardModalOpen(false)}
        onSave={handleSaveCard}
        onProcessFiles={handleProcessUploadedFiles}
      />

      <PartnerVendorToClientModal
        isOpen={isConvertModalOpen}
        partners={partners}
        onClose={() => setIsConvertModalOpen(false)}
        onExecuteConvert={handleExecuteConvert}
      />

      <ConfirmDialogModal
        isOpen={Boolean(deleteConfirmTarget)}
        title={deleteConfirmTarget ? `確定要刪除「${deleteConfirmTarget.name}」嗎？` : ''}
        message={
          deleteConfirmTarget?.type === 'PARTNER'
            ? '此操作將對商業夥伴執行軟刪除，相關報價、估驗與歷史合約紀錄仍完整保留。'
            : deleteConfirmTarget?.type === 'CARD'
            ? '此操作將自該商業夥伴檔案中移除此張名片。'
            : '此操作將自該商業夥伴檔案中移除此筆支票交易記錄。'
        }
        variant="danger"
        extraNotice={deleteConfirmTarget?.extraNotice}
        confirmText="確認徹底刪除"
        secondaryAction={
          deleteConfirmTarget?.type === 'PARTNER' && deleteConfirmTarget.isBoth
            ? {
                text: '僅自業主移除 (保留廠商)',
                variant: 'amber',
                onClick: () =>
                  handleExecuteDeletePartner(deleteConfirmTarget.id, deleteConfirmTarget.name, true)
              }
            : undefined
        }
        onConfirm={() => {
          if (!deleteConfirmTarget) return;
          if (deleteConfirmTarget.type === 'PARTNER') {
            handleExecuteDeletePartner(deleteConfirmTarget.id, deleteConfirmTarget.name, false);
          } else if (deleteConfirmTarget.type === 'CARD') {
            handleExecuteDeleteCard(deleteConfirmTarget.id, deleteConfirmTarget.partnerId);
          } else {
            handleExecuteDeleteCheque(deleteConfirmTarget.id, deleteConfirmTarget.partnerId);
          }
        }}
        onCancel={() => setDeleteConfirmTarget(null)}
      />

      <SubcontractorCategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        onSaved={() => {
          reloadData();
          showToast('✓ 廠商專業分類字典已更新！');
        }}
        currentUser={currentUser}
      />

      <ClientUpgradeVendorModal
        isOpen={Boolean(upgradeClientTarget)}
        client={upgradeClientTarget}
        onClose={() => setUpgradeClientTarget(null)}
        onSuccess={updated => {
          reloadData();
          showToast(`✓ 已成功將「${updated.name}」升級為合作廠商！`);
        }}
        currentUser={currentUser}
      />

      <PartnerImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          reloadData();
          showToast('✓ 批次名冊資料已成功匯入！');
        }}
        currentUser={currentUser}
      />

      {lightboxMedia && (
        <MediaPreviewLightbox media={lightboxMedia} onClose={() => setLightboxMedia(null)} />
      )}

      <HoverMediaPopover preview={hoverPreview} />
    </div>
  );
};
