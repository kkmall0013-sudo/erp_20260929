// src/components/InboundWorkspace.tsx
// 🏛️ 現場進貨簽收管理工作台 (Inbound Goods / Material Receiving Management)
// 專責現場物料送達簽收點收 · A 模式直入案場成本 · 清冊支援「清單」與「廠商階層目錄」切換 · 動態日期與進貨廠商關聯篩選 · 支援單據獨立編輯修改與草稿功能

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { ExcelInboundGridModal } from './inbound/ExcelInboundGridModal';
import { InternalAssetManagerModal } from './widgets/InternalAssetManagerModal';
import { ConfirmDialogModal } from './widgets/ConfirmDialogModal';
import { UniversalSearchBar } from './widgets/UniversalSearchBar';
import { createSearchDatasetLookup } from '../utils/universalSearchEngine';
import { ProjectEditorModal } from './projects/ProjectEditorModal';
import { PartnerEditorModal } from './partners/PartnerEditorModal';
import { InboundFilterToolbar } from './inbound/InboundFilterToolbar';
import { InboundHierarchyView } from './inbound/InboundHierarchyView';
import { InboundListView } from './inbound/InboundListView';
import { InboundReceiptEditorModal } from './inbound/InboundReceiptEditorModal';
import { InboundReceiptDetailModal } from './inbound/InboundReceiptDetailModal';
import { InternalAsset, loadStoredInternalAssets } from '../utils/internalAssetStore';
import {
  DateFilterMode,
  computeInboundDateRange,
  resolveReceiptProjectInfo,
  computeActiveVendorsInRange,
  computeActiveProjectsInRange,
  filterInboundReceipts,
  groupReceiptsByVendor,
  computeInboundStats,
  exportInboundReceiptsCsv,
} from './inbound/inboundWorkspaceUtils';
import {
  InboundReceipt,
  InboundReceiptItem,
  InboundReceiptStatus,
  Project,
  ProjectSite,
  BusinessPartner,
} from '../types/erp';
import {
  getAllInboundReceipts,
  getInboundReceiptById,
  createInboundReceipt,
  updateInboundReceipt,
  postInboundReceipt,
  voidInboundReceipt,
  deleteInboundReceipt,
  getAllProjects,
  getAllProjectSites,
  getAllCompanies,
  getAllBusinessPartners,
  createProjectRecord,
  subscribeToDatabase,
  recordAuditLog,
} from '../db/sqlite';
import { useAuth } from '../context/AuthContext';

interface InboundWorkspaceProps {
  onDataChanged?: () => void;
  triggerToast?: (msg: string, type?: 'success' | 'warn' | 'error') => void;
}

// 模擬現場角色權限
type DemoRole = 'ALL_PERMS' | 'SITE_CLERK' | 'SITE_CHIEF' | 'ACCOUNTANT';

export const InboundWorkspace: React.FC<InboundWorkspaceProps> = ({
  onDataChanged,
  triggerToast = () => {},
}) => {
  const { currentUser, can } = useAuth();

  // 職責分離模擬身份
  const [demoRole] = useState<DemoRole>('ALL_PERMS');

  const canWrite = useMemo(() => {
    if (demoRole === 'SITE_CLERK' || demoRole === 'SITE_CHIEF' || demoRole === 'ALL_PERMS') return true;
    if (demoRole === 'ACCOUNTANT') return false;
    return can('INBOUND_RECEIPTS', 'write') || can('PURCHASE_ORDERS', 'write');
  }, [demoRole, can]);

  const canApprove = useMemo(() => {
    if (demoRole === 'SITE_CHIEF' || demoRole === 'ALL_PERMS') return true;
    if (demoRole === 'SITE_CLERK' || demoRole === 'ACCOUNTANT') return false;
    return can('INBOUND_RECEIPTS', 'approve') || can('PURCHASE_ORDERS', 'approve');
  }, [demoRole, can]);

  // 資料庫主檔與進貨單
  const [receipts, setReceipts] = useState<InboundReceipt[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<BusinessPartner[]>([]);
  const [internalAssets, setInternalAssets] = useState<InternalAsset[]>(() => loadStoredInternalAssets());

  // 顯示模式：清單檢視 (LIST) vs 廠商階層目錄檢視 (HIERARCHY)
  const [viewMode, setViewMode] = useState<'LIST' | 'HIERARCHY'>('LIST');
  const [expandedVendorIds, setExpandedVendorIds] = useState<Set<string>>(new Set());

  // 日期區間過濾控制
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // 案場與廠商篩選 + UniversalSearchBar 多欄位權限過濾結果
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchFilteredReceipts, setSearchFilteredReceipts] = useState<InboundReceipt[] | null>(null);

  // 展開檢視特定清單列明細之 ID
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // 📊 Excel 試算表極速打單工作台 Modal
  const [isExcelGridModalOpen, setIsExcelGridModalOpen] = useState<boolean>(false);
  const [initialDraftToLoad, setInitialDraftToLoad] = useState<InboundReceipt | null>(null);

  // 📝 單筆進貨簽收單 建立 / 編輯 / 詳情 / 列印 Modal 控制
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedReceipt, setSelectedReceipt] = useState<InboundReceipt | null>(null);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState<boolean>(false);

  // 🚚 廠內自用資產與車輛維護中心、案場工程小程式、聯絡明細廠商小程式
  const [isAssetManagerModalOpen, setIsAssetManagerModalOpen] = useState<boolean>(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState<boolean>(false);
  const [isNewVendorModalOpen, setIsNewVendorModalOpen] = useState<boolean>(false);
  const [showCompletedProjectsInForm, setShowCompletedProjectsInForm] = useState<boolean>(false);

  // 防呆確認 Modal
  const [voidModalTarget, setVoidModalTarget] = useState<InboundReceipt | null>(null);
  const [voidReasonText, setVoidReasonText] = useState<string>('規格不符現場退貨重送');
  const [deleteModalTarget, setDeleteModalTarget] = useState<InboundReceipt | null>(null);

  // 單筆表單資料狀態
  const [formData, setFormData] = useState<Partial<InboundReceipt>>({
    companyId: 'COMP-01',
    projectId: '',
    vendorId: '',
    deliveryNoteNumber: '',
    receivedDate: new Date().toISOString().slice(0, 10),
    receivedBy: currentUser?.fullName || '現場工程師',
    notes: '',
    status: 'DRAFT',
  });

  const [formItems, setFormItems] = useState<Partial<InboundReceiptItem>[]>([
    {
      id: 'temp-1',
      itemName: '',
      spec: '',
      unit: '包',
      quantity: 10,
      unitPrice: 200,
      lineTotal: 2000,
      notes: '',
    },
  ]);

  // 載入資料
  const loadData = useCallback(() => {
    try {
      setReceipts(getAllInboundReceipts());
      setProjects(getAllProjects());
      setVendors(
        getAllBusinessPartners().filter(b => b.isVendor || b.type === 'VENDOR' || b.type === 'BOTH')
      );
      setInternalAssets(loadStoredInternalAssets());
    } catch (e) {
      console.error('載入進貨資料失敗', e);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDatabase(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [loadData]);

  // 🚚 廠內資產與公務車更新回調
  const handleAssetsUpdated = () => {
    setInternalAssets(loadStoredInternalAssets());
    triggerToast('✅ 廠內資產與公務車輛資料已同步更新！', 'success');
  };

  // 🏗️ 案場工程小程式新建回調 (SSoT 直接調用 ProjectEditorModal 產出之成果)
  const handleProjectCreated = (projectData: Partial<Project>, siteData: Partial<ProjectSite>) => {
    try {
      const newProj = createProjectRecord(projectData, siteData, currentUser?.fullName || '現場工程師');
      triggerToast(`✅ 案場【${newProj.name}】已成功建檔！專案代碼：${newProj.projectCode}`, 'success');
      loadData();
      setFormData(prev => ({
        ...prev,
        projectId: newProj.id,
        projectNameSnapshot: newProj.name,
        projectCodeSnapshot: newProj.projectCode,
      }));
      setIsNewProjectModalOpen(false);
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      triggerToast(`❌ 建立案場失敗：${err.message || String(err)}`, 'error');
    }
  };

  // 🏢 商業夥伴模組新建回調 (SSoT 直接調用 PartnerEditorModal 產出之成果)
  const handleVendorCreated = (savedPartner: BusinessPartner) => {
    try {
      triggerToast(`✅ 合作供料商【${savedPartner.name}】已成功建檔！`, 'success');
      loadData();
      setFormData(prev => ({
        ...prev,
        vendorId: savedPartner.id,
        vendorNameSnapshot: savedPartner.name,
        vendorTaxIdSnapshot: savedPartner.taxId || '',
      }));
      setIsNewVendorModalOpen(false);
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      triggerToast(`❌ 建立廠商失敗：${err.message || String(err)}`, 'error');
    }
  };

  // 計算有效日期區間與動態關聯篩選
  const activeDateRange = useMemo(
    () => computeInboundDateRange(dateFilterMode, customStartDate, customEndDate),
    [dateFilterMode, customStartDate, customEndDate]
  );

  const getReceiptProjectInfo = useCallback(
    (r: InboundReceipt) => resolveReceiptProjectInfo(r, projects, internalAssets),
    [projects, internalAssets]
  );

  const activeVendorsInDateRange = useMemo(
    () => computeActiveVendorsInRange(receipts, activeDateRange, vendors),
    [receipts, activeDateRange, vendors]
  );

  useEffect(() => {
    if (selectedVendorId !== 'ALL' && activeVendorsInDateRange.length > 0) {
      if (!activeVendorsInDateRange.some(v => v.id === selectedVendorId)) {
        setSelectedVendorId('ALL');
      }
    }
  }, [activeVendorsInDateRange, selectedVendorId]);

  const activeProjectsInDateRange = useMemo(
    () => computeActiveProjectsInRange(receipts, activeDateRange, getReceiptProjectInfo),
    [receipts, activeDateRange, getReceiptProjectInfo]
  );

  useEffect(() => {
    if (selectedProjectId !== 'ALL' && activeProjectsInDateRange.length > 0) {
      if (!activeProjectsInDateRange.some(p => p.id === selectedProjectId)) {
        setSelectedProjectId('ALL');
      }
    }
  }, [activeProjectsInDateRange, selectedProjectId]);

  const searchLookup = useMemo(() => {
    return createSearchDatasetLookup({
      companies: getAllCompanies(),
      sites: getAllProjectSites(),
      partners: vendors
    });
  }, [vendors, projects]);

  const baseScopedReceipts = useMemo(
    () =>
      filterInboundReceipts({
        receipts,
        dateRange: activeDateRange,
        selectedProjectId,
        selectedVendorId,
        statusFilter,
        searchKeyword: '',
        getProjectInfo: getReceiptProjectInfo,
      }),
    [receipts, activeDateRange, selectedProjectId, selectedVendorId, statusFilter, getReceiptProjectInfo]
  );

  const filteredReceipts = useMemo(
    () => searchFilteredReceipts ?? baseScopedReceipts,
    [searchFilteredReceipts, baseScopedReceipts]
  );

  const vendorHierarchyGroups = useMemo(
    () => groupReceiptsByVendor(filteredReceipts, vendors),
    [filteredReceipts, vendors]
  );

  const stats = useMemo(() => computeInboundStats(filteredReceipts), [filteredReceipts]);

  const handleSwitchViewMode = (mode: 'LIST' | 'HIERARCHY') => {
    setViewMode(mode);
    if (mode === 'HIERARCHY' && expandedVendorIds.size === 0 && vendorHierarchyGroups.length > 0) {
      setExpandedVendorIds(new Set(vendorHierarchyGroups.map(g => g.vendorId)));
    }
  };

  const handleToggleAllVendors = () => {
    if (expandedVendorIds.size === vendorHierarchyGroups.length) {
      setExpandedVendorIds(new Set());
    } else {
      setExpandedVendorIds(new Set(vendorHierarchyGroups.map(g => g.vendorId)));
    }
  };

  const handleToggleVendor = (vendorId: string) => {
    setExpandedVendorIds(prev => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else next.add(vendorId);
      return next;
    });
  };

  const handleToggleRowExpand = (id: string) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 📝 新增 / 修改單筆進貨單
  const handleOpenCreateModal = () => {
    if (!canWrite) {
      triggerToast('⛔ 權限攔截：當前角色無進貨單填寫權限', 'warn');
      return;
    }

    setFormData({
      id: undefined,
      receiptNumber: '',
      companyId: 'COMP-01',
      projectId: projects.length > 0 ? projects[0].id : '',
      vendorId: vendors.length > 0 ? vendors[0].id : '',
      deliveryNoteNumber: `DN-${Date.now().toString().slice(-4)}`,
      receivedDate: new Date().toISOString().slice(0, 10),
      receivedBy: currentUser?.fullName || '現場工程師',
      notes: '',
      status: 'DRAFT',
      billingStatus: 'PENDING_BILLING',
      attachmentFileName: '',
    });

    setFormItems([
      {
        id: `temp-${Date.now()}-1`,
        itemName: '4000psi 預拌混凝土',
        spec: '符合CNS規範抗壓試驗棒取樣',
        unit: '立方米',
        quantity: 25,
        unitPrice: 2200,
        lineTotal: 55000,
        notes: '進場第一批澆置',
      },
    ]);

    setIsEditorOpen(true);
  };

  const handleOpenEditModal = (r: InboundReceipt) => {
    if (!canWrite) {
      triggerToast('⛔ 權限攔截：當前角色無進貨單修改權限', 'warn');
      return;
    }
    if (r.billingStatus === 'BILLED') {
      triggerToast('⚠️ 此進貨單已由會計完成對帳請款，已依法鎖定禁止修改', 'warn');
      return;
    }

    const prjInfo = getReceiptProjectInfo(r);
    let initialProjectId = r.projectId;
    let initialProjectName = r.projectNameSnapshot;
    let initialProjectCode = (r as any).projectCodeSnapshot;

    const hasProjectMatch = projects.some(p => p.id === r.projectId);
    const hasAssetMatch = internalAssets.some(a => a.id === r.projectId);

    if (!hasProjectMatch && !hasAssetMatch && prjInfo.id && prjInfo.id !== 'UNKNOWN') {
      initialProjectId = prjInfo.id;
      initialProjectName = prjInfo.name;
      initialProjectCode = prjInfo.code;
    }

    setFormData({
      ...r,
      projectId: initialProjectId,
      projectNameSnapshot: initialProjectName,
      projectCodeSnapshot: initialProjectCode,
      orderNumber: r.orderNumber || '',
    });
    const fullReceipt = getInboundReceiptById(r.id) || r;
    setFormItems(
      (fullReceipt.items && fullReceipt.items.length > 0
        ? fullReceipt.items
        : [
            {
              id: `item-${Date.now()}`,
              itemName: '現場物料',
              spec: '',
              unit: '式',
              quantity: 1,
              unitPrice: r.totalAmount,
              lineTotal: r.totalAmount,
              notes: '',
            },
          ]
      ).map(it => ({ ...it }))
    );
    setIsEditorOpen(true);
  };

  const handleItemChange = (index: number, field: keyof InboundReceiptItem, value: any) => {
    setFormItems(prev => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = Number(field === 'quantity' ? value : item.quantity || 0);
        const price = Number(field === 'unitPrice' ? value : item.unitPrice || 0);
        item.lineTotal = qty * price;
      }
      next[index] = item;
      return next;
    });
  };

  const handleAddItemRow = () => {
    setFormItems(prev => [
      ...prev,
      {
        id: `temp-${Date.now()}-${prev.length + 1}`,
        itemName: '',
        spec: '',
        unit: '包',
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0,
        notes: '',
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length <= 1) {
      triggerToast('進貨簽收單至少需保留一筆物料明細', 'warn');
      return;
    }
    setFormItems(prev => prev.filter((_, i) => i !== index));
  };

  // 💾 儲存進貨單 (草稿或正式確認簽收)
  const handleSaveReceipt = (asPosted: boolean = false) => {
    if (asPosted && !canApprove) {
      triggerToast('⛔ 現場人員僅能存為「草稿」，須由工務主任或具備覆核權限者點收簽收！', 'warn');
      return;
    }
    if (!formData.projectId) {
      triggerToast('請選擇進貨歸屬案場', 'warn');
      return;
    }
    if (!formData.vendorId) {
      triggerToast('請選擇供貨合作廠商', 'warn');
      return;
    }
    if (!formData.deliveryNoteNumber || formData.deliveryNoteNumber.trim() === '') {
      triggerToast('請輸入現場紙本送貨簽收單號', 'warn');
      return;
    }
    if (!formData.receivedDate) {
      triggerToast('請選擇現場實收日期', 'warn');
      return;
    }
    if (formItems.length === 0 || formItems.some(it => !it.itemName || it.itemName.trim() === '')) {
      triggerToast('請完整填寫物料名稱與數量單價', 'warn');
      return;
    }

    const totalAmt = formItems.reduce((acc, it) => acc + (Number(it.lineTotal) || 0), 0);

    try {
      const statusToSave: InboundReceiptStatus = asPosted ? 'POSTED' : 'DRAFT';

      if (formData.id) {
        updateInboundReceipt(formData.id, { ...formData, status: statusToSave }, formItems);
        if (asPosted && formData.status === 'DRAFT') {
          postInboundReceipt(formData.id);
        }
        recordAuditLog(
          currentUser?.fullName || '系統操作員',
          asPosted ? '修改並簽收進貨單' : '修改進貨單草稿',
          '進貨管理',
          formData.id,
          { '送貨單號': formData.deliveryNoteNumber, '金額': totalAmt }
        );
        triggerToast(
          asPosted
            ? '✅ 進貨簽收單修改完成並確認簽收，等待會計核對！'
            : '✅ 進貨簽收單草稿已更新儲存，可隨時繼續修改',
          'success'
        );
      } else {
        const newReceipt = createInboundReceipt({ ...formData, status: statusToSave }, formItems);
        recordAuditLog(
          currentUser?.fullName || '系統操作員',
          asPosted ? '新增並簽收進貨單' : '新增進貨單草稿',
          '進貨管理',
          newReceipt.receiptNumber,
          { '送貨單號': formData.deliveryNoteNumber, '金額': totalAmt }
        );
        triggerToast(
          asPosted
            ? `✅ 進貨單 ${newReceipt.receiptNumber} 已正式簽收歸檔，等待會計審核過帳！`
            : `✅ 進貨單草稿 ${newReceipt.receiptNumber} 已暫存，可隨時修改`,
          'success'
        );
      }

      setIsEditorOpen(false);
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (e: any) {
      triggerToast(e.message || '儲存失敗', 'error');
    }
  };

  // 確認簽收過單
  const handlePostReceipt = (receipt: InboundReceipt) => {
    if (!canApprove) {
      triggerToast('⛔ 當前身分無覆核簽收權限，請由工務主任確認簽收！', 'warn');
      return;
    }
    try {
      const posted = postInboundReceipt(receipt.id);
      recordAuditLog(
        currentUser?.fullName || '工務主任',
        '確認現場點收簽收',
        '進貨管理',
        posted.receiptNumber,
        { '金額': posted.totalAmount }
      );
      triggerToast(`✅ 進貨簽收單 ${posted.receiptNumber} 現場已確認點收！等待會計核對`, 'success');
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (e: any) {
      triggerToast(e.message || '點收簽收失敗', 'error');
    }
  };

  // 作廢與刪除草稿處理
  const handleOpenVoidModal = (receipt: InboundReceipt) => {
    if (!canWrite) {
      triggerToast('⛔ 無作廢權限', 'warn');
      return;
    }
    if (receipt.billingStatus === 'BILLED') {
      triggerToast('⚠️ 該進貨單已由會計完成請款對帳，禁止作廢；須先由會計解除對帳關聯', 'warn');
      return;
    }
    setVoidModalTarget(receipt);
    setVoidReasonText('廠商送貨規格不符現場退貨重送');
  };

  const handleConfirmVoid = () => {
    if (!voidModalTarget) return;
    try {
      voidInboundReceipt(voidModalTarget.id, voidReasonText || '手動點選作廢');
      recordAuditLog(
        currentUser?.fullName || '系統操作員',
        '作廢進貨單',
        '進貨管理',
        voidModalTarget.receiptNumber,
        { '作廢原因': voidReasonText }
      );
      triggerToast(`✅ 進貨單 ${voidModalTarget.receiptNumber} 已標記作廢`, 'success');
      setVoidModalTarget(null);
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (e: any) {
      triggerToast(e.message || '作廢失敗', 'error');
    }
  };

  const handleOpenDeleteModal = (receipt: InboundReceipt) => {
    if (!canWrite) {
      triggerToast('⛔ 無刪除草稿權限', 'warn');
      return;
    }
    if (receipt.status !== 'DRAFT') {
      triggerToast('已點收單據禁止刪除，如需取消請使用「作廢」功能', 'warn');
      return;
    }
    setDeleteModalTarget(receipt);
  };

  const handleConfirmDelete = () => {
    if (!deleteModalTarget) return;
    try {
      const operator = currentUser?.fullName || '系統操作員';
      deleteInboundReceipt(deleteModalTarget.id, operator, '現場操作員刪除草稿進貨單');
      triggerToast('✅ 草稿進貨單已軟刪除（一般同仁已隱蔽，Superadmin 可於救援中心救回）', 'success');
      setDeleteModalTarget(null);
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (e: any) {
      triggerToast(e.message || '刪除失敗', 'error');
    }
  };

  const handleOpenDetailModal = (receipt: InboundReceipt) => {
    setSelectedReceipt(getInboundReceiptById(receipt.id) || receipt);
    setIsDetailModalOpen(true);
  };

  const selectedDetailIndex = useMemo(() => {
    if (!selectedReceipt) return -1;
    return filteredReceipts.findIndex(r => r.id === selectedReceipt.id);
  }, [filteredReceipts, selectedReceipt]);

  const handleNavigateDetail = (offset: -1 | 1) => {
    if (selectedDetailIndex < 0) return;
    const target = filteredReceipts[selectedDetailIndex + offset];
    if (!target) return;
    setSelectedReceipt(getInboundReceiptById(target.id) || target);
  };

  const handlePrint = (receipt: InboundReceipt) => {
    setSelectedReceipt(getInboundReceiptById(receipt.id) || receipt);
    setIsPrintViewOpen(true);
  };

  const handleLoadDraftToExcelGrid = (r: InboundReceipt) => {
    setInitialDraftToLoad(r);
    setIsExcelGridModalOpen(true);
  };

  const handleExportCsv = () => {
    try {
      exportInboundReceiptsCsv(filteredReceipts, projects, activeDateRange);
      triggerToast('🖨️ 已成功匯出現場進貨標準 CSV 試算表（Excel 直接開不亂碼）！', 'success');
    } catch (err: any) {
      triggerToast('匯出失敗: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <InboundFilterToolbar
        stats={stats}
        activeDateRange={activeDateRange}
        activeVendorsInDateRange={activeVendorsInDateRange}
        activeProjectsInDateRange={activeProjectsInDateRange}
        filteredCount={filteredReceipts.length}
        dateFilterMode={dateFilterMode}
        onDateFilterModeChange={setDateFilterMode}
        customStartDate={customStartDate}
        onCustomStartDateChange={setCustomStartDate}
        customEndDate={customEndDate}
        onCustomEndDateChange={setCustomEndDate}
        selectedVendorId={selectedVendorId}
        onSelectedVendorIdChange={setSelectedVendorId}
        selectedProjectId={selectedProjectId}
        onSelectedProjectIdChange={setSelectedProjectId}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        searchSlot={
          <UniversalSearchBar<InboundReceipt>
            datasetKey="INBOUND_RECEIPTS"
            records={baseScopedReceipts}
            lookup={searchLookup}
            placeholder="輸入關鍵字快速搜尋進貨單號、送貨單號、品名規格、廠商、工地地區（支援台／臺別名）..."
            onResultsChange={(results) => {
              setSearchFilteredReceipts(results.map(r => r.record));
            }}
          />
        }
        viewMode={viewMode}
        onSwitchViewMode={handleSwitchViewMode}
        onOpenExcelGrid={() => {
          setInitialDraftToLoad(null);
          setIsExcelGridModalOpen(true);
        }}
        onOpenAssetManager={() => setIsAssetManagerModalOpen(true)}
        onOpenCreateModal={handleOpenCreateModal}
        onExportCsv={handleExportCsv}
      />

      {viewMode === 'HIERARCHY' && (
        <InboundHierarchyView
          vendorHierarchyGroups={vendorHierarchyGroups}
          filteredReceiptsCount={filteredReceipts.length}
          expandedVendorIds={expandedVendorIds}
          canWrite={canWrite}
          getReceiptProjectInfo={getReceiptProjectInfo}
          onToggleAllVendors={handleToggleAllVendors}
          onToggleVendor={handleToggleVendor}
          onLoadDraftToExcelGrid={handleLoadDraftToExcelGrid}
          onOpenEditModal={handleOpenEditModal}
          onOpenDetailModal={handleOpenDetailModal}
          onPrintReceipt={handlePrint}
          onOpenVoidModal={handleOpenVoidModal}
        />
      )}

      {viewMode === 'LIST' && (
        <InboundListView
          filteredReceipts={filteredReceipts}
          expandedRowIds={expandedRowIds}
          canWrite={canWrite}
          canApprove={canApprove}
          getReceiptProjectInfo={getReceiptProjectInfo}
          onToggleRowExpand={handleToggleRowExpand}
          onLoadDraftToExcelGrid={handleLoadDraftToExcelGrid}
          onOpenEditModal={handleOpenEditModal}
          onOpenDetailModal={handleOpenDetailModal}
          onPrintReceipt={handlePrint}
          onPostReceipt={handlePostReceipt}
          onOpenDeleteModal={handleOpenDeleteModal}
          onOpenVoidModal={handleOpenVoidModal}
        />
      )}

      <InboundReceiptEditorModal
        isOpen={isEditorOpen}
        formData={formData}
        onChangeFormData={setFormData}
        formItems={formItems}
        projects={projects}
        vendors={vendors}
        internalAssets={internalAssets}
        showCompletedProjectsInForm={showCompletedProjectsInForm}
        onToggleCompletedProjectsInForm={() => setShowCompletedProjectsInForm(prev => !prev)}
        onItemChange={handleItemChange}
        onAddItemRow={handleAddItemRow}
        onRemoveItemRow={handleRemoveItemRow}
        onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
        onOpenAssetManager={() => setIsAssetManagerModalOpen(true)}
        onOpenNewVendorModal={() => setIsNewVendorModalOpen(true)}
        onSaveReceipt={handleSaveReceipt}
        onClose={() => setIsEditorOpen(false)}
      />

      <InboundReceiptDetailModal
        selectedReceipt={selectedReceipt}
        isDetailOpen={isDetailModalOpen}
        isPrintOpen={isPrintViewOpen}
        canWrite={canWrite}
        hasPrev={selectedDetailIndex > 0}
        hasNext={selectedDetailIndex >= 0 && selectedDetailIndex < filteredReceipts.length - 1}
        positionLabel={
          selectedDetailIndex >= 0 && filteredReceipts.length > 0
            ? `${selectedDetailIndex + 1} / ${filteredReceipts.length}`
            : undefined
        }
        onPrev={() => handleNavigateDetail(-1)}
        onNext={() => handleNavigateDetail(1)}
        onCloseDetail={() => setIsDetailModalOpen(false)}
        onClosePrint={() => setIsPrintViewOpen(false)}
        onEditFromDetail={receipt => {
          setIsDetailModalOpen(false);
          handleOpenEditModal(receipt);
        }}
        onPrintFromDetail={receipt => {
          setIsDetailModalOpen(false);
          handlePrint(receipt);
        }}
      />

      {/* ⚠️ 作廢確認 Modal (含作廢原因輸入框) */}
      {voidModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">確認作廢現場進貨單</h3>
            </div>
            <p className="text-xs text-slate-600">
              作廢單號：<strong className="font-mono text-slate-900">{voidModalTarget.receiptNumber}</strong>
              <br />
              （若只是數量或規格打錯，建議使用「修改」按鈕直接編輯，無需作廢）
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">請輸入作廢原因說明：</label>
              <input
                type="text"
                value={voidReasonText}
                onChange={e => setVoidReasonText(e.target.value)}
                placeholder="例如: 廠商送錯工區退回重開"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVoidModalTarget(null)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                確認作廢
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ 刪除草稿確認 Modal (複用共用 ConfirmDialogModal) */}
      <ConfirmDialogModal
        isOpen={Boolean(deleteModalTarget)}
        title="確認刪除草稿進貨單"
        message={
          <span>
            草稿單號：<strong className="font-mono text-slate-900">{deleteModalTarget?.receiptNumber}</strong>
            <br />
            此草稿單尚未點收簽收，確定要自資料庫軟刪除移除嗎？（Superadmin 可於救援中心救回）
          </span>
        }
        variant="danger"
        confirmText="確認刪除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalTarget(null)}
      />

      {/* 📊 Excel 試算表極速打單工作台 Modal */}
      <ExcelInboundGridModal
        isOpen={isExcelGridModalOpen}
        onClose={() => {
          setIsExcelGridModalOpen(false);
          setInitialDraftToLoad(null);
        }}
        onSaved={() => {
          loadData();
          if (onDataChanged) onDataChanged();
        }}
        triggerToast={triggerToast}
        currentUserFullName={currentUser?.fullName || '現場工程師'}
        canApprove={canApprove}
        initialDraftToLoad={initialDraftToLoad}
        onClearInitialDraft={() => setInitialDraftToLoad(null)}
      />

      {/* 🚚 廠內自用公務車輛與廠務資產維護中心 Modal */}
      <InternalAssetManagerModal
        isOpen={isAssetManagerModalOpen}
        onClose={() => setIsAssetManagerModalOpen(false)}
        onAssetsUpdated={handleAssetsUpdated}
        triggerToast={triggerToast}
      />

      {/* 🏗️ 案場工程小程式 Modal */}
      <ProjectEditorModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onSave={handleProjectCreated}
      />

      {/* 🏢 商業夥伴/供料廠商小程式 Modal */}
      <PartnerEditorModal
        isOpen={isNewVendorModalOpen}
        defaultType="VENDOR"
        title="現場進貨快捷新增合作供料廠商"
        onClose={() => setIsNewVendorModalOpen(false)}
        onSaved={handleVendorCreated}
      />
    </div>
  );
};
