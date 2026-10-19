// src/components/InboundWorkspace.tsx
// 🏛️ 現場進貨管理工作台 (Inbound Goods / Material Receiving Management)
// 專責現場物料送達簽收點收 · A 模式直入案場成本 · 與會計月底廠商大水池無縫對接 · 雙重確認權責分離

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  PackageCheck,
  Truck,
  Plus,
  Search,
  Filter,
  FileText,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Eye,
  Trash2,
  Edit,
  Save,
  X,
  Upload,
  Layers,
  ChevronRight,
  TrendingUp,
  Download,
  Printer,
  ShieldCheck,
  Sparkles,
  Info,
  DollarSign,
  Paperclip,
  Check,
  RotateCcw,
  Boxes,
  Zap,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Lock,
  UserCheck,
  Image as ImageIcon
} from 'lucide-react';
import {
  InboundReceipt,
  InboundReceiptItem,
  InboundReceiptStatus,
  InboundBillingStatus,
  Project,
  BusinessPartner
} from '../types/erp';
import {
  getAllInboundReceipts,
  getInboundReceiptById,
  createInboundReceipt,
  updateInboundReceipt,
  postInboundReceipt,
  voidInboundReceipt,
  deleteInboundReceipt,
  getVendorLedgerPoolSummary,
  VendorPoolSummary,
  getAllProjects,
  getAllBusinessPartners,
  getNextDocumentNumber,
  subscribeToDatabase,
  recordAuditLog
} from '../db/sqlite';
import { useAuth } from '../context/AuthContext';

interface InboundWorkspaceProps {
  onDataChanged?: () => void;
  triggerToast?: (msg: string, type?: 'success' | 'warn' | 'error') => void;
}

// 模擬內控職責分離預設角色
type DemoRole = 'ALL_PERMS' | 'SITE_CLERK' | 'SITE_CHIEF' | 'ACCOUNTANT' | 'FINANCE_DIRECTOR';

export const InboundWorkspace: React.FC<InboundWorkspaceProps> = ({
  onDataChanged,
  triggerToast = () => {},
}) => {
  const { currentUser, isSuperadmin, isAdmin, can } = useAuth();

  // 職責分離模擬身份切換器 (供使用者直覺實測「打單 / 覆核 / 對帳 / 放款」分立憲法)
  const [demoRole, setDemoRole] = useState<DemoRole>('ALL_PERMS');

  // 計算當前權限 (依據登入身分與模擬身分疊加)
  const canWrite = useMemo(() => {
    if (demoRole === 'SITE_CLERK' || demoRole === 'SITE_CHIEF' || demoRole === 'ALL_PERMS') return true;
    if (demoRole === 'ACCOUNTANT' || demoRole === 'FINANCE_DIRECTOR') return false;
    return can('INBOUND_RECEIPTS', 'write') || can('PURCHASE_ORDERS', 'write');
  }, [demoRole, can]);

  const canApprove = useMemo(() => {
    if (demoRole === 'SITE_CHIEF' || demoRole === 'ALL_PERMS') return true;
    if (demoRole === 'SITE_CLERK' || demoRole === 'ACCOUNTANT' || demoRole === 'FINANCE_DIRECTOR') return false;
    return can('INBOUND_RECEIPTS', 'approve') || can('PURCHASE_ORDERS', 'approve');
  }, [demoRole, can]);

  // 資料狀態
  const [receipts, setReceipts] = useState<InboundReceipt[]>([]);
  const [poolSummaries, setPoolSummaries] = useState<VendorPoolSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<BusinessPartner[]>([]);

  // 篩選與過濾
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [billingFilter, setBillingFilter] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [activeVendorPoolTab, setActiveVendorPoolTab] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  // 檢視與編輯 Modal 控制
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedReceipt, setSelectedReceipt] = useState<InboundReceipt | null>(null);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState<boolean>(false);

  // 月底批次快速打單 Modal (Rapid Batch Mode)
  const [isBatchModeOpen, setIsBatchModeOpen] = useState<boolean>(false);

  // 自訂 React 防呆確認 Modal 狀態 (全面取代原生 prompt / confirm)
  const [voidModalTarget, setVoidModalTarget] = useState<InboundReceipt | null>(null);
  const [voidReasonText, setVoidReasonText] = useState<string>('規格不符現場退貨重送');
  const [deleteModalTarget, setDeleteModalTarget] = useState<InboundReceipt | null>(null);
  const [attachmentModalTarget, setAttachmentModalTarget] = useState<{ isEditing: boolean; currentName: string } | null>(null);

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

  // 批次打單表單狀態 (用於月底集中輸入一整疊簽收單)
  const [batchProjectId, setBatchProjectId] = useState<string>('');
  const [batchVendorId, setBatchVendorId] = useState<string>('');
  const [batchAutoPost, setBatchAutoPost] = useState<boolean>(true);
  const [batchDraftList, setBatchDraftList] = useState<Array<{
    tempId: string;
    deliveryNoteNumber: string;
    receivedDate: string;
    receivedBy: string;
    itemName: string;
    spec: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    notes: string;
  }>>([]);

  const [batchCurrentRow, setBatchCurrentRow] = useState({
    deliveryNoteNumber: '',
    receivedDate: new Date().toISOString().slice(0, 10),
    receivedBy: currentUser?.fullName || '現場打單員',
    itemName: '5000psi 混凝土',
    spec: '特密抗壓>350',
    unit: '立方米',
    quantity: 20,
    unitPrice: 2400,
    notes: '連續澆置第一車',
  });

  // 載入資料
  const loadData = () => {
    try {
      const allReceipts = getAllInboundReceipts();
      setReceipts(allReceipts);
      setPoolSummaries(getVendorLedgerPoolSummary());
      const prjs = getAllProjects();
      setProjects(prjs);
      const vends = getAllBusinessPartners().filter(b => b.isVendor);
      setVendors(vends);

      if (prjs.length > 0 && !batchProjectId) {
        setBatchProjectId(prjs[0].id);
      }
      if (vends.length > 0 && !batchVendorId) {
        setBatchVendorId(vends[0].id);
      }
    } catch (e) {
      console.error('載入進貨資料失敗', e);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDatabase(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  // 統計數值
  const stats = useMemo(() => {
    const validReceipts = receipts.filter(r => !r.isDeleted);
    const totalReceiptsCount = validReceipts.length;
    const pendingReceipts = validReceipts.filter(r => r.status === 'POSTED' && r.billingStatus === 'PENDING_BILLING');
    const pendingPoolTotalAmount = pendingReceipts.reduce((acc, r) => acc + r.totalAmount, 0);
    const draftCount = validReceipts.filter(r => r.status === 'DRAFT').length;
    const billedReceipts = validReceipts.filter(r => r.billingStatus === 'BILLED');
    const billedCount = billedReceipts.length;
    const billedTotalAmount = billedReceipts.reduce((acc, r) => acc + r.totalAmount, 0);

    return {
      totalReceiptsCount,
      pendingCount: pendingReceipts.length,
      pendingPoolTotalAmount,
      draftCount,
      billedCount,
      billedTotalAmount,
    };
  }, [receipts]);

  // 可選月份清單
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    receipts.forEach(r => {
      if (r.receivedDate && r.receivedDate.length >= 7) {
        set.add(r.receivedDate.slice(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [receipts]);

  // 篩選後之進貨單清單
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      if (r.isDeleted) return false;
      if (selectedProjectId !== 'ALL' && r.projectId !== selectedProjectId) return false;
      if (selectedVendorId !== 'ALL' && r.vendorId !== selectedVendorId) return false;
      if (activeVendorPoolTab && r.vendorId !== activeVendorPoolTab) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (billingFilter !== 'ALL' && r.billingStatus !== billingFilter) return false;
      if (selectedMonth !== 'ALL' && (!r.receivedDate || !r.receivedDate.startsWith(selectedMonth))) return false;

      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const matchNo = r.receiptNumber.toLowerCase().includes(kw);
        const matchDn = r.deliveryNoteNumber.toLowerCase().includes(kw);
        const matchVendor = (r.vendorNameSnapshot || '').toLowerCase().includes(kw);
        const matchProject = (r.projectNameSnapshot || '').toLowerCase().includes(kw);
        const matchItem = (r.items || []).some(it =>
          it.itemName.toLowerCase().includes(kw) || (it.spec || '').toLowerCase().includes(kw)
        );
        return matchNo || matchDn || matchVendor || matchProject || matchItem;
      }
      return true;
    });
  }, [receipts, selectedProjectId, selectedVendorId, activeVendorPoolTab, statusFilter, billingFilter, selectedMonth, searchKeyword]);

  // 開啟新增進貨單
  const handleOpenCreateModal = () => {
    if (!canWrite) {
      triggerToast('⛔ 權限攔截：當前角色無進貨單寫入權限 (w:0)！', 'warn');
      return;
    }

    const defaultProject = projects.length > 0 ? projects[0].id : '';
    const defaultVendor = vendors.length > 0 ? vendors[0].id : '';

    setFormData({
      id: undefined,
      receiptNumber: '',
      companyId: 'COMP-01',
      projectId: defaultProject,
      vendorId: defaultVendor,
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
        itemName: '4000psi 混凝土',
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

  // 開啟編輯進貨單 (僅限草稿)
  const handleOpenEditModal = (r: InboundReceipt) => {
    if (!canWrite) {
      triggerToast('⛔ 權限攔截：當前角色無進貨單編輯權限 (w:0)！', 'warn');
      return;
    }
    if (r.status === 'POSTED') {
      triggerToast('⚠️ 此進貨單已過帳生效，為維護審計快照禁止直接修改；如需變更請作廢後重開', 'warn');
      return;
    }
    if (r.billingStatus === 'BILLED') {
      triggerToast('⚠️ 此進貨單已完成會計對帳請款，禁止修改', 'warn');
      return;
    }

    setFormData({ ...r });
    setFormItems(
      (r.items || []).map(it => ({
        ...it,
      }))
    );
    setIsEditorOpen(true);
  };

  // 明細列項目變更
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

  // 新增明細列
  const handleAddItemRow = () => {
    setFormItems(prev => [
      ...prev,
      {
        id: `temp-${Date.now()}-${prev.length + 1}`,
        itemName: '',
        spec: '',
        unit: '式',
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0,
        notes: '',
      },
    ]);
  };

  // 刪除明細列
  const handleRemoveItemRow = (index: number) => {
    if (formItems.length <= 1) {
      triggerToast('進貨單至少需保留一筆物料明細', 'warn');
      return;
    }
    setFormItems(prev => prev.filter((_, i) => i !== index));
  };

  // 計算表單總金額
  const calculatedFormTotal = useMemo(() => {
    return formItems.reduce((acc, it) => acc + (Number(it.lineTotal) || 0), 0);
  }, [formItems]);

  // 儲存進貨單 (草稿或直接過帳)
  const handleSaveReceipt = (asPosted: boolean = false) => {
    if (asPosted && !canApprove) {
      triggerToast('⛔ 覆核攔截：現場打單人員僅能存為「草稿」，須由工務主任或具備簽核權限者覆核過帳！', 'warn');
      return;
    }

    if (!formData.projectId) {
      triggerToast('請選擇進貨歸屬案場 (直入成本工區)', 'warn');
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

    try {
      const statusToSave: InboundReceiptStatus = asPosted ? 'POSTED' : 'DRAFT';

      if (formData.id) {
        // 更新現有單據
        updateInboundReceipt(
          formData.id,
          {
            ...formData,
            status: statusToSave,
          },
          formItems
        );

        if (asPosted && formData.status === 'DRAFT') {
          postInboundReceipt(formData.id);
        }

        recordAuditLog(
          currentUser?.fullName || '系統操作員',
          asPosted ? '過帳進貨單' : '更新進貨單草稿',
          '進貨管理',
          formData.id,
          { '送貨單號': formData.deliveryNoteNumber, '金額': calculatedFormTotal }
        );

        triggerToast(
          asPosted
            ? '✅ 進貨簽收單已正式過帳，沉澱至廠商大水池待會計對帳！'
            : '✅ 進貨單草稿已更新儲存',
          'success'
        );
      } else {
        // 新增單據
        const newReceipt = createInboundReceipt(
          {
            ...formData,
            status: statusToSave,
          },
          formItems
        );

        recordAuditLog(
          currentUser?.fullName || '系統操作員',
          asPosted ? '新增並過帳進貨單' : '新增進貨單草稿',
          '進貨管理',
          newReceipt.receiptNumber,
          { '送貨單號': formData.deliveryNoteNumber, '金額': calculatedFormTotal }
        );

        triggerToast(
          asPosted
            ? `✅ 進貨單 ${newReceipt.receiptNumber} 已正式過帳並直入案場成本！已沉澱至廠商大水池。`
            : `✅ 進貨單草稿 ${newReceipt.receiptNumber} 已建立`,
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

  // 單據過帳
  const handlePostReceipt = (receipt: InboundReceipt) => {
    if (!canApprove) {
      triggerToast('⛔ 權限攔截：當前身分無覆核過帳權限 (a:0)，請由工務主任或主管進行過帳！', 'warn');
      return;
    }
    try {
      const posted = postInboundReceipt(receipt.id);
      recordAuditLog(
        currentUser?.fullName || '工務主任',
        '覆核過帳進貨單',
        '進貨管理',
        posted.receiptNumber,
        { '案場': posted.projectNameSnapshot, '廠商': posted.vendorNameSnapshot, '金額': posted.totalAmount }
      );
      triggerToast(`✅ 進貨單 ${posted.receiptNumber} 已過帳！已入庫並計入案場材料成本，沉澱至大水池待會計月底對帳。`, 'success');
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (e: any) {
      triggerToast(e.message || '過帳失敗', 'error');
    }
  };

  // 開啟作廢 Modal (取代 prompt)
  const handleOpenVoidModal = (receipt: InboundReceipt) => {
    if (!canWrite) {
      triggerToast('⛔ 權限攔截：無作廢單據權限', 'warn');
      return;
    }
    if (receipt.billingStatus === 'BILLED') {
      triggerToast('⚠️ 該進貨單已由會計完成請款對帳，禁止作廢；須先由會計取消對帳單關聯', 'warn');
      return;
    }
    setVoidModalTarget(receipt);
    setVoidReasonText('廠商送貨規格不符現場退貨重送');
  };

  // 確認作廢
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
      triggerToast(`✅ 進貨單 ${voidModalTarget.receiptNumber} 已標記為作廢`, 'success');
      setVoidModalTarget(null);
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (e: any) {
      triggerToast(e.message || '作廢失敗', 'error');
    }
  };

  // 開啟刪除草稿 Modal (取代 confirm)
  const handleOpenDeleteModal = (receipt: InboundReceipt) => {
    if (!canWrite) {
      triggerToast('⛔ 權限攔截：無刪除草稿權限', 'warn');
      return;
    }
    if (receipt.status !== 'DRAFT') {
      triggerToast('非草稿狀態單據禁止直接刪除，請使用「作廢」功能', 'warn');
      return;
    }
    setDeleteModalTarget(receipt);
  };

  // 確認刪除草稿
  const handleConfirmDelete = () => {
    if (!deleteModalTarget) return;
    try {
      deleteInboundReceipt(deleteModalTarget.id);
      recordAuditLog(
        currentUser?.fullName || '系統操作員',
        '刪除草稿進貨單',
        '進貨管理',
        deleteModalTarget.id,
        { '送貨單號': deleteModalTarget.deliveryNoteNumber }
      );
      triggerToast('✅ 草稿進貨單已移除', 'success');
      setDeleteModalTarget(null);
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (e: any) {
      triggerToast(e.message || '刪除失敗', 'error');
    }
  };

  // 查看詳情
  const handleOpenDetailModal = (receipt: InboundReceipt) => {
    const fullReceipt = getInboundReceiptById(receipt.id) || receipt;
    setSelectedReceipt(fullReceipt);
    setIsDetailModalOpen(true);
  };

  // 列印進貨簽收單
  const handlePrint = (receipt: InboundReceipt) => {
    const fullReceipt = getInboundReceiptById(receipt.id) || receipt;
    setSelectedReceipt(fullReceipt);
    setIsPrintViewOpen(true);
  };

  // 匯出 CSV 報表
  const handleExportCsv = () => {
    try {
      const headers = ['系統單號', '送貨單號', '簽收日期', '合作廠商', '統編', '歸屬案場', '未稅總金額', '單據狀態', '對帳水池狀態', '點收人', '物料明細'];
      const rows = filteredReceipts.map(r => {
        const itemText = (r.items || []).map(it => `${it.itemName}*${it.quantity}${it.unit}`).join('; ');
        return [
          r.receiptNumber,
          r.deliveryNoteNumber,
          r.receivedDate,
          r.vendorNameSnapshot || '',
          r.vendorTaxIdSnapshot || '',
          r.projectNameSnapshot || '',
          r.totalAmount,
          r.status,
          r.billingStatus,
          r.receivedBy,
          `"${itemText}"`
        ];
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `進貨簽收單清冊_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      triggerToast('🖨️ 已成功匯出進貨簽收單 CSV 報表！', 'success');
    } catch (err: any) {
      triggerToast('匯出失敗: ' + err.message, 'error');
    }
  };

  // -------------------------------------------------------------
  // ⚡ 月底批次快速打單邏輯 (Continuous Batch Entry Mode)
  // -------------------------------------------------------------
  const handleAddBatchRow = () => {
    if (!batchCurrentRow.deliveryNoteNumber.trim()) {
      triggerToast('請填寫送貨單號', 'warn');
      return;
    }
    if (!batchCurrentRow.itemName.trim()) {
      triggerToast('請填寫料件品名', 'warn');
      return;
    }
    const qty = Number(batchCurrentRow.quantity) || 0;
    const price = Number(batchCurrentRow.unitPrice) || 0;
    const lineTotal = qty * price;

    setBatchDraftList(prev => [
      ...prev,
      {
        tempId: `batch-${Date.now()}-${prev.length + 1}`,
        deliveryNoteNumber: batchCurrentRow.deliveryNoteNumber,
        receivedDate: batchCurrentRow.receivedDate,
        receivedBy: batchCurrentRow.receivedBy,
        itemName: batchCurrentRow.itemName,
        spec: batchCurrentRow.spec,
        unit: batchCurrentRow.unit,
        quantity: qty,
        unitPrice: price,
        lineTotal,
        notes: batchCurrentRow.notes,
      }
    ]);

    // 重設單號與車次供下一筆輸入
    const nextSeq = Date.now().toString().slice(-4);
    setBatchCurrentRow(prev => ({
      ...prev,
      deliveryNoteNumber: `DN-${nextSeq}`,
      notes: '',
    }));

    triggerToast('已暫存至本次登打清單，可繼續輸入下一張簽收單', 'success');
  };

  const handleSaveAllBatchReceipts = () => {
    if (batchDraftList.length === 0) {
      triggerToast('目前尚無待儲存的簽收單項目', 'warn');
      return;
    }

    try {
      let createdCount = 0;
      for (const item of batchDraftList) {
        createInboundReceipt(
          {
            companyId: 'COMP-01',
            projectId: batchProjectId,
            vendorId: batchVendorId,
            deliveryNoteNumber: item.deliveryNoteNumber,
            receivedDate: item.receivedDate,
            receivedBy: item.receivedBy,
            status: batchAutoPost && canApprove ? 'POSTED' : 'DRAFT',
            billingStatus: 'PENDING_BILLING',
            notes: item.notes,
          },
          [
            {
              itemName: item.itemName,
              spec: item.spec,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
              notes: item.notes,
            }
          ]
        );
        createdCount++;
      }

      triggerToast(`✅ 批次登打完成！已成功登錄 ${createdCount} 筆簽收單入庫${batchAutoPost ? '（已正式過帳入廠商水池）' : '（草稿狀態）'}！`, 'success');
      setBatchDraftList([]);
      setIsBatchModeOpen(false);
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (e: any) {
      triggerToast('批次儲存失敗: ' + e.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* 頂部標題與操作列 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
                <Truck className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">進貨管理工作台</h2>
                  <span className="bg-emerald-50 text-emerald-700 font-mono text-xs px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                    A 模式直入案場成本
                  </span>
                  <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded border border-blue-200 font-medium">
                    職責分離 · 大水池對接
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  現場簽收點收計量 · 直入案場成本 · 月底沉澱至廠商大水池無縫對接會計請款
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 月底連續批次打單模式按鈕 */}
            <button
              onClick={() => {
                if (!canWrite) {
                  triggerToast('⛔ 權限攔截：當前角色無寫入權限', 'warn');
                  return;
                }
                setIsBatchModeOpen(true);
              }}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="專為月底收到整疊簽收單對帳前連續鍵入設計"
            >
              <Zap className="w-4 h-4" />
              <span>⚡ 月底批次快速打單</span>
            </button>

            {/* 新增單筆進貨單 */}
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>新增進貨簽收單</span>
            </button>

            {/* 匯出報表 */}
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs transition-colors border border-slate-300 flex items-center gap-1 cursor-pointer"
              title="匯出 CSV 試算表"
            >
              <Download className="w-3.5 h-3.5" />
              <span>匯出</span>
            </button>
          </div>
        </div>

        {/* 雙重確認與職責分離 PBAC 實測切換列 */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="font-bold text-slate-800">
              【PBAC 雙重確認與職責分離實測沙盒】
            </span>
            <span className="text-slate-500 hidden sm:inline">
              現場打單 (A) ⇄ 主任覆核 (B) ⇄ 會計對帳 (C) ⇄ 財務放款 (D)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px]">模擬角色：</span>
            <select
              value={demoRole}
              onChange={e => {
                const r = e.target.value as DemoRole;
                setDemoRole(r);
                triggerToast(`已切換至「${e.target.options[e.target.selectedIndex].text}」身份進行權限驗證！`, 'success');
              }}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded font-medium text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL_PERMS">全功能管理員 (打單 + 覆核 + 查帳)</option>
              <option value="SITE_CLERK">現場打單同仁 (僅限新增草稿，禁過帳)</option>
              <option value="SITE_CHIEF">工務所長 / 主任 (打單 + 覆核過帳入水池)</option>
              <option value="ACCOUNTANT">會計對帳專員 (僅查水池與出帳，禁改現場單)</option>
              <option value="FINANCE_DIRECTOR">財務長 / 出納 (放款與簽發票據)</option>
            </select>

            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
              canWrite ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {canWrite ? '✓ 可打單' : '🔒 禁打單'}
            </span>

            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
              canApprove ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {canApprove ? '✓ 可覆核' : '🔒 禁覆核'}
            </span>
          </div>
        </div>

        {/* 職責分離憲法提醒橫幅 */}
        <div className="mt-3 p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-start gap-3 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-blue-950">【營造 ERP 內控憲法 · 職責分離鐵律】</span>：
            本進貨模組專責記錄「工區物料送達之簽收事實與品名數量單價」。
            <span className="text-blue-700 font-semibold ml-1">
              發票號碼補登、營業稅外加/內含計算、現領折讓扣款與付款排程，交由會計於「月底對帳大水池」處理
            </span>
            ，確保現場打單最快速純粹、財務結算與金流精準無漏！
          </div>
        </div>

        {/* 四大 KPI 核心統計指標 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
            <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
              <span>進貨總單數</span>
              <Boxes className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-slate-800">
                {stats.totalReceiptsCount}
              </span>
              <span className="text-xs text-slate-400">筆</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              現場全部簽單紀錄
            </div>
          </div>

          <div className="p-3.5 bg-amber-50/70 rounded-lg border border-amber-200">
            <div className="text-xs text-amber-800 font-medium flex items-center justify-between">
              <span>待對帳水池水位 (未結貨款)</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xs font-bold text-amber-800">NT$</span>
              <span className="font-mono text-2xl font-bold text-amber-900 tabular-nums">
                {stats.pendingPoolTotalAmount.toLocaleString()}
              </span>
              <span className="text-xs text-amber-700 font-medium ml-1">({stats.pendingCount} 筆待對)</span>
            </div>
            <div className="text-[11px] text-amber-700 mt-1">
              🌊 沉澱大水池 · 等待會計月底對帳
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50/70 rounded-lg border border-emerald-200">
            <div className="text-xs text-emerald-800 font-medium flex items-center justify-between">
              <span>已會計對帳請款</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xs font-bold text-emerald-800">NT$</span>
              <span className="font-mono text-2xl font-bold text-emerald-900 tabular-nums">
                {stats.billedTotalAmount.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-700 font-medium ml-1">({stats.billedCount} 筆放水結算)</span>
            </div>
            <div className="text-[11px] text-emerald-700 mt-1">
              已出具對帳請款單 · 排定付款放款
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
            <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
              <span>現場草稿暫存單</span>
              <Edit className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-slate-700">
                {stats.draftCount}
              </span>
              <span className="text-xs text-slate-400">筆待過帳</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              打單人員隨時可修訂
            </div>
          </div>
        </div>
      </div>

      {/* 🌊 廠商往來大水池水位看板 (Vendor Ledger Pool) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">
              廠商往來大水池水位總覽 (Vendor Pool Balance)
            </h3>
            <span className="text-xs text-slate-500">
              點選廠商可一鍵聚焦過濾該公司待對帳簽收單
            </span>
          </div>

          {activeVendorPoolTab && (
            <button
              onClick={() => setActiveVendorPoolTab(null)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>清除廠商聚焦 (查看全廠商)</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {poolSummaries.map(p => {
            const isSelected = activeVendorPoolTab === p.vendorId;
            return (
              <div
                key={p.vendorId}
                onClick={() => setActiveVendorPoolTab(isSelected ? null : p.vendorId)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-200'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="truncate" title={p.vendorName}>{p.vendorName}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                </div>
                <div className="mt-2 flex items-baseline justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">未結水池水位：</span>
                  <span className="font-mono font-bold text-amber-700 tabular-nums">
                    ${p.pendingTotalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>待對帳單數</span>
                  <span className="font-mono font-semibold text-slate-700">{p.pendingCount} 筆</span>
                </div>
                <div className="mt-1 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
                  <span>進貨區間</span>
                  <span>{p.earliestDate} ~ {p.latestDate}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 搜尋與多維過濾工具列 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* 搜尋關鍵字 */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="搜尋單號 / 送貨單號 / 材料品名..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
          </div>

          {/* 案場篩選 (A模式直入案場) */}
          <div>
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700"
            >
              <option value="ALL">全部工區案場 (直入成本)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* 廠商篩選 */}
          <div>
            <select
              value={selectedVendorId}
              onChange={e => setSelectedVendorId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700"
            >
              <option value="ALL">全部合作供應商</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* 單據月份快速篩選 */}
          <div>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700"
            >
              <option value="ALL">全部簽收月份</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>
                  {m} 月進貨單
                </option>
              ))}
            </select>
          </div>

          {/* 請款對帳狀態篩選 */}
          <div>
            <select
              value={billingFilter}
              onChange={e => setBillingFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700"
            >
              <option value="ALL">全部水池狀態</option>
              <option value="PENDING_BILLING">待對帳請款 (沉澱水池中)</option>
              <option value="BILLED">已會計對帳請款</option>
            </select>
          </div>
        </div>
      </div>

      {/* 進貨簽收主清單 (Sticky Table Header, 鼎新 A1 標準資料手感) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">進貨簽收單清冊</span>
            <span className="text-xs text-slate-400 font-mono">({filteredReceipts.length} 筆)</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 已過帳入水池
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> 草稿中
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span> 已作廢
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-3 px-4 whitespace-nowrap">系統單號</th>
                <th className="py-3 px-4 whitespace-nowrap">廠商送貨單號</th>
                <th className="py-3 px-4 whitespace-nowrap">簽收日期</th>
                <th className="py-3 px-4 whitespace-nowrap">合作廠商</th>
                <th className="py-3 px-4 whitespace-nowrap">歸屬案場 (直入成本)</th>
                <th className="py-3 px-4 whitespace-nowrap">物料明細摘要</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">未稅金額 (NT$)</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">單據狀態</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">會計對帳水池狀態</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-medium">查無符合條件的進貨簽收單據</p>
                    <p className="text-xs text-slate-400 mt-1">
                      可點選右上角「新增進貨簽收單」或「⚡ 月底批次快速打單」開始登打
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReceipts.map(r => {
                  const itemsCount = (r.items || []).length;
                  const itemSummary =
                    (r.items || []).length > 0
                      ? `${r.items![0].itemName} ${r.items![0].quantity}${r.items![0].unit}${
                          itemsCount > 1 ? ` 等共 ${itemsCount} 項` : ''
                        }`
                      : '無明細';

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => handleOpenDetailModal(r)}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {r.receiptNumber}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
                          {r.deliveryNoteNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {r.receivedDate}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate max-w-[140px]">{r.vendorNameSnapshot || '廠商'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        <span className="text-indigo-700 font-medium truncate max-w-[150px] inline-block">
                          {r.projectNameSnapshot || '案場'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate" title={itemSummary}>
                        {itemSummary}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        ${r.totalAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {r.status === 'POSTED' && (
                          <span className="bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded border border-emerald-200">
                            已過帳
                          </span>
                        )}
                        {r.status === 'DRAFT' && (
                          <span className="bg-amber-50 text-amber-700 font-medium px-2 py-0.5 rounded border border-amber-200">
                            草稿中
                          </span>
                        )}
                        {r.status === 'VOIDED' && (
                          <span className="bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded border border-slate-300">
                            已作廢
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED' && (
                          <span className="bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded border border-blue-200" title="沉澱於廠商未結水池中，等待會計月底對帳請款">
                            🌊 待對帳請款
                          </span>
                        )}
                        {r.billingStatus === 'BILLED' && (
                          <span className="bg-purple-50 text-purple-700 font-medium px-2 py-0.5 rounded border border-purple-200" title={`會計已請款: ${r.reconciliationNumber || '已結算'}`}>
                            ✅ 會計已請款
                          </span>
                        )}
                        {r.status === 'DRAFT' && (
                          <span className="text-slate-400">待過帳</span>
                        )}
                        {r.status === 'VOIDED' && (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetailModal(r)}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                            title="檢視詳情"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handlePrint(r)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                            title="列印進貨單"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {r.status === 'DRAFT' && canWrite && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(r)}
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
                                title="編輯草稿"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              {canApprove && (
                                <button
                                  onClick={() => handlePostReceipt(r)}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium transition-colors"
                                  title="主任覆核正式過帳"
                                >
                                  過帳
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenDeleteModal(r)}
                                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors"
                                title="刪除草稿"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {r.status === 'POSTED' && r.billingStatus === 'PENDING_BILLING' && canWrite && (
                            <button
                              onClick={() => handleOpenVoidModal(r)}
                              className="px-1.5 py-0.5 text-rose-600 hover:bg-rose-50 rounded text-[11px] border border-rose-200"
                              title="作廢單據"
                            >
                              作廢
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ⚡ 月底批次快速打單 Modal (Rapid Continuous Batch Mode) */}
      {isBatchModeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl my-6 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 bg-amber-500/20 text-amber-300 rounded border border-amber-400/30">
                  <Zap className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    ⚡ 月底簽收單批次連續打單模式 (Batch Fast-Entry Mode)
                  </h3>
                  <p className="text-xs text-slate-400">
                    專為工務月底收到一整疊送貨簽單設計 · 鎖定廠商與案場後連續輸入 · 支援快速過帳入水池
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsBatchModeOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs">
              {/* 頂部共用參數鎖定區 */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    1. 鎖定歸屬工區案場 (A 模式直入成本) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={batchProjectId}
                    onChange={e => setBatchProjectId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-800"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. 鎖定合作供應廠商 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={batchVendorId}
                    onChange={e => setBatchVendorId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-800"
                  >
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.taxId})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    3. 單據儲存狀態
                  </label>
                  <div className="flex items-center gap-3 mt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={batchAutoPost}
                        onChange={e => setBatchAutoPost(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span className="font-bold text-slate-800">登打完直接覆核過帳 (沉澱入水池)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 快速鍵入卡片 */}
              <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 text-xs">
                    鍵入單張簽收單資料 (填寫完按「＋加入本次清單」續打下一張)
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    現場簽收單 ➔ 點驗 ➔ 鍵入系統 ➔ 月底與對帳單核對
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  <div className="col-span-2">
                    <span className="block text-[11px] text-slate-500 mb-1">送貨簽收單號 *</span>
                    <input
                      type="text"
                      placeholder="例: TC-889955"
                      value={batchCurrentRow.deliveryNoteNumber}
                      onChange={e => setBatchCurrentRow({ ...batchCurrentRow, deliveryNoteNumber: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] text-slate-500 mb-1">簽收日期</span>
                    <input
                      type="date"
                      value={batchCurrentRow.receivedDate}
                      onChange={e => setBatchCurrentRow({ ...batchCurrentRow, receivedDate: e.target.value })}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono text-[11px]"
                    />
                  </div>

                  <div className="col-span-2">
                    <span className="block text-[11px] text-slate-500 mb-1">物料品名全銜 *</span>
                    <input
                      type="text"
                      placeholder="如: 4000psi 預拌混凝土"
                      value={batchCurrentRow.itemName}
                      onChange={e => setBatchCurrentRow({ ...batchCurrentRow, itemName: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-bold"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] text-slate-500 mb-1">進貨數量</span>
                    <input
                      type="number"
                      min="1"
                      value={batchCurrentRow.quantity}
                      onChange={e => setBatchCurrentRow({ ...batchCurrentRow, quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-right"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] text-slate-500 mb-1">約定單價</span>
                    <input
                      type="number"
                      min="0"
                      value={batchCurrentRow.unitPrice}
                      onChange={e => setBatchCurrentRow({ ...batchCurrentRow, unitPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono text-right"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] text-slate-500 mb-1">小計金額</span>
                    <div className="px-2 py-1.5 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-indigo-700 text-right">
                      ${(batchCurrentRow.quantity * batchCurrentRow.unitPrice).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">現場點收人:</span>
                    <input
                      type="text"
                      value={batchCurrentRow.receivedBy}
                      onChange={e => setBatchCurrentRow({ ...batchCurrentRow, receivedBy: e.target.value })}
                      className="px-2 py-1 bg-white border border-slate-300 rounded text-xs w-28"
                    />
                    <span className="text-[11px] text-slate-500 ml-2">備註:</span>
                    <input
                      type="text"
                      placeholder="卸料點 / 車次 / 磅單備忘"
                      value={batchCurrentRow.notes}
                      onChange={e => setBatchCurrentRow({ ...batchCurrentRow, notes: e.target.value })}
                      className="px-2 py-1 bg-white border border-slate-300 rounded text-xs w-60"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddBatchRow}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>＋ 加入本次清單 (續打)</span>
                  </button>
                </div>
              </div>

              {/* 本次批次待存清單 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">本次批次登打待提交明細</span>
                    <span className="text-slate-500">({batchDraftList.length} 筆簽收單)</span>
                  </div>
                  <div className="font-mono text-xs font-bold text-indigo-700">
                    累計總額：NT$ {batchDraftList.reduce((acc, it) => acc + it.lineTotal, 0).toLocaleString()}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2 px-3 text-center w-8">#</th>
                        <th className="py-2 px-3">送貨簽收單號</th>
                        <th className="py-2 px-3">日期</th>
                        <th className="py-2 px-3">品名</th>
                        <th className="py-2 px-3 text-right">數量</th>
                        <th className="py-2 px-3 text-right">單價</th>
                        <th className="py-2 px-3 text-right">小計</th>
                        <th className="py-2 px-3">點收人/備註</th>
                        <th className="py-2 px-3 text-center w-10">移</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batchDraftList.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-slate-400">
                            尚未加入任何項目，請填寫上方表單並點選「＋加入本次清單」
                          </td>
                        </tr>
                      ) : (
                        batchDraftList.map((item, idx) => (
                          <tr key={item.tempId} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">{item.deliveryNoteNumber}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{item.receivedDate}</td>
                            <td className="py-2 px-3 font-medium text-slate-800">{item.itemName}</td>
                            <td className="py-2 px-3 text-right font-mono">{item.quantity} {item.unit}</td>
                            <td className="py-2 px-3 text-right font-mono">${item.unitPrice.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">${item.lineTotal.toLocaleString()}</td>
                            <td className="py-2 px-3 text-slate-500">{item.receivedBy} {item.notes ? `(${item.notes})` : ''}</td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={() => setBatchDraftList(prev => prev.filter((_, i) => i !== idx))}
                                className="text-slate-400 hover:text-rose-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                點選確認將全數寫入 SQLite 資料庫並自動指派系統流水單號
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsBatchModeOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg"
                >
                  取消
                </button>

                <button
                  type="button"
                  onClick={handleSaveAllBatchReceipts}
                  disabled={batchDraftList.length === 0}
                  className={`px-5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs ${
                    batchDraftList.length > 0
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>批次寫入資料庫 ({batchDraftList.length} 筆)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📝 新增 / 編輯單筆進貨簽收單 Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal 頂部 Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-400/30">
                  <PackageCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {formData.id ? '編輯進貨簽收單 (草稿)' : '新增現場進貨簽收單'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    A 模式直入案場成本 · 單據過帳後將流入廠商大水池待會計對帳
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal 表單內容 */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* 基本歸屬欄位 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    歸屬工區案場 (A模式直入成本) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.projectId}
                    onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">請選擇專案案場</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    合作供貨廠商 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.vendorId}
                    onChange={e => setFormData({ ...formData, vendorId: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">請選擇供應商</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.taxId})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    廠商送貨單號 / 簽收單號 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="例如: TC-889922、CSC-003"
                    value={formData.deliveryNoteNumber || ''}
                    onChange={e => setFormData({ ...formData, deliveryNoteNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    實收簽收日期 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.receivedDate || ''}
                    onChange={e => setFormData({ ...formData, receivedDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    現場點收人 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="點收同仁姓名"
                    value={formData.receivedBy || ''}
                    onChange={e => setFormData({ ...formData, receivedBy: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    簽收單紙本照片/附件 (選填)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="紙本照片或檔案名稱"
                      value={formData.attachmentFileName || ''}
                      onChange={e => setFormData({ ...formData, attachmentFileName: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentModalTarget({
                          isEditing: true,
                          currentName: formData.attachmentFileName || '現場紙本簽收單_照片存證.jpg'
                        });
                      }}
                      className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>拍照/選取</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 物料明細動態表格 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">物料進貨明細清單</span>
                    <span className="text-xs text-slate-400">
                      (共 {formItems.length} 項 · 合計未稅 NT${calculatedFormTotal.toLocaleString()})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>增加一列材料</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                        <th className="py-2.5 px-3 w-8 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[160px]">材料品名 <span className="text-rose-500">*</span></th>
                        <th className="py-2.5 px-3 min-w-[120px]">規格型號</th>
                        <th className="py-2.5 px-3 w-20">單位</th>
                        <th className="py-2.5 px-3 w-24 text-right">進貨數量</th>
                        <th className="py-2.5 px-3 w-28 text-right">約定單價</th>
                        <th className="py-2.5 px-3 w-28 text-right">小計金額</th>
                        <th className="py-2.5 px-3 min-w-[100px]">備註</th>
                        <th className="py-2.5 px-3 w-10 text-center">刪</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formItems.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">
                            {index + 1}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="如: 4000psi 預拌混凝土"
                              value={item.itemName || ''}
                              onChange={e => handleItemChange(index, 'itemName', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="規格/型號"
                              value={item.spec || ''}
                              onChange={e => handleItemChange(index, 'spec', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="包/m³/噸"
                              value={item.unit || '式'}
                              onChange={e => handleItemChange(index, 'unit', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.quantity || 0}
                              onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right font-mono font-bold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.unitPrice || 0}
                              onChange={e => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right font-mono"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 tabular-nums">
                            ${(Number(item.lineTotal) || 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="車號/卸料點"
                              value={item.notes || ''}
                              onChange={e => handleItemChange(index, 'notes', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(index)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/80 font-bold border-t border-slate-200">
                        <td colSpan={6} className="py-2.5 px-3 text-right text-slate-700">
                          進貨未稅金額總計 (NT$)：
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-indigo-700 text-sm tabular-nums">
                          ${calculatedFormTotal.toLocaleString()}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 現場簽收備註 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  現場簽收備註 / 驗收紀錄
                </label>
                <textarea
                  rows={2}
                  placeholder="可記錄卸料地點、抗壓試驗棒取樣、出廠檢驗報告編號等現場備忘..."
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Modal 底部按鈕 */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                點選「正式過帳」將指派正式流水單號並流入廠商未結水池
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  取消
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveReceipt(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>暫存草稿</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveReceipt(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>正式簽收過帳 (入水池)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 單據詳情 Modal */}
      {isDetailModalOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-white">
                  進貨簽收單詳情: {selectedReceipt.receiptNumber}
                </span>
                {selectedReceipt.status === 'POSTED' && (
                  <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-medium px-2 py-0.5 rounded border border-emerald-400/30">
                    已過帳
                  </span>
                )}
                {selectedReceipt.status === 'DRAFT' && (
                  <span className="bg-amber-500/20 text-amber-300 text-[11px] font-medium px-2 py-0.5 rounded border border-amber-400/30">
                    草稿中
                  </span>
                )}
                {selectedReceipt.status === 'VOIDED' && (
                  <span className="bg-slate-500/20 text-slate-300 text-[11px] font-medium px-2 py-0.5 rounded border border-slate-400/30">
                    已作廢
                  </span>
                )}
              </div>

              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto text-xs">
              {/* 基本資訊摘要 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block mb-0.5">廠商送貨單號</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {selectedReceipt.deliveryNoteNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">實收日期</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {selectedReceipt.receivedDate}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">點收人員</span>
                  <span className="font-semibold text-slate-700">
                    {selectedReceipt.receivedBy}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">未稅合計金額</span>
                  <span className="font-mono font-bold text-indigo-700 text-sm tabular-nums">
                    ${selectedReceipt.totalAmount.toLocaleString()}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className="text-slate-400 block mb-0.5">合作廠商</span>
                  <span className="font-medium text-slate-800">
                    {selectedReceipt.vendorNameSnapshot} ({selectedReceipt.vendorTaxIdSnapshot})
                  </span>
                </div>

                <div className="col-span-2">
                  <span className="text-slate-400 block mb-0.5">歸屬案場 (直入成本)</span>
                  <span className="font-medium text-indigo-700">
                    {selectedReceipt.projectNameSnapshot}
                  </span>
                </div>
              </div>

              {/* 會計大水池狀態卡 */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-blue-900 block">會計大水池勾稽狀態</span>
                  <span className="text-blue-700">
                    {selectedReceipt.billingStatus === 'PENDING_BILLING'
                      ? '🌊 沉澱於廠商未結水池中（等待會計月底對帳請款放水）'
                      : `✅ 已完成對帳請款 (對帳單號: ${selectedReceipt.reconciliationNumber || '已結算'})`}
                  </span>
                </div>
                {selectedReceipt.attachmentFileName && (
                  <div className="flex items-center gap-1.5 text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{selectedReceipt.attachmentFileName}</span>
                  </div>
                )}
              </div>

              {/* 明細清冊 */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">物料簽收明細</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2 px-3 text-center w-8">#</th>
                        <th className="py-2 px-3">品名</th>
                        <th className="py-2 px-3">規格</th>
                        <th className="py-2 px-3 text-center">單位</th>
                        <th className="py-2 px-3 text-right">數量</th>
                        <th className="py-2 px-3 text-right">單價</th>
                        <th className="py-2 px-3 text-right">小計</th>
                        <th className="py-2 px-3">備註</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedReceipt.items || []).map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{it.itemName}</td>
                          <td className="py-2 px-3 text-slate-600">{it.spec || '—'}</td>
                          <td className="py-2 px-3 text-center text-slate-600">{it.unit}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{it.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">${it.unitPrice.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">${it.lineTotal.toLocaleString()}</td>
                          <td className="py-2 px-3 text-slate-500">{it.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedReceipt.notes && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block mb-0.5">簽收備註</span>
                  <p className="text-slate-700">{selectedReceipt.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                建立時間: {selectedReceipt.createdAt}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handlePrint(selectedReceipt);
                  }}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>列印簽單</span>
                </button>

                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🖨️ 列印預覽 Modal (台灣工程營造標準驗收簽認單) */}
      {isPrintViewOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-3xl overflow-hidden p-8 animate-in fade-in zoom-in-95">
            {/* 列印用單據表頭 */}
            <div className="border-b-2 border-slate-800 pb-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    台灣大巨營造股份有限公司
                  </h1>
                  <h2 className="text-base font-bold text-slate-700 mt-1">
                    工地物料現場進貨簽收單 (Inbound Material Receipt)
                  </h2>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-slate-900">
                    單號: {selectedReceipt.receiptNumber}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    送貨單號: {selectedReceipt.deliveryNoteNumber}
                  </div>
                </div>
              </div>
            </div>

            {/* 基本資料 */}
            <div className="grid grid-cols-2 gap-y-2 text-xs border border-slate-300 p-4 rounded mb-6">
              <div>
                <span className="font-bold text-slate-600">歸屬工區案場：</span>
                <span className="font-semibold text-slate-900">{selectedReceipt.projectNameSnapshot}</span>
              </div>
              <div>
                <span className="font-bold text-slate-600">簽收點收日期：</span>
                <span className="font-mono text-slate-900">{selectedReceipt.receivedDate}</span>
              </div>
              <div>
                <span className="font-bold text-slate-600">材料供應商：</span>
                <span className="text-slate-900">{selectedReceipt.vendorNameSnapshot}</span>
              </div>
              <div>
                <span className="font-bold text-slate-600">現場點收人：</span>
                <span className="text-slate-900">{selectedReceipt.receivedBy}</span>
              </div>
            </div>

            {/* 物料明細 */}
            <table className="w-full text-xs border border-slate-300 mb-6">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                  <th className="py-2 px-3 text-center border-r border-slate-300 w-10">項次</th>
                  <th className="py-2 px-3 border-r border-slate-300">材料品名全銜</th>
                  <th className="py-2 px-3 border-r border-slate-300">規格說明</th>
                  <th className="py-2 px-3 text-center border-r border-slate-300 w-16">單位</th>
                  <th className="py-2 px-3 text-right border-r border-slate-300 w-20">點收數量</th>
                  <th className="py-2 px-3 text-right border-r border-slate-300 w-24">約定單價</th>
                  <th className="py-2 px-3 text-right w-28">小計金額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(selectedReceipt.items || []).map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td className="py-2 px-3 text-center border-r border-slate-300 font-mono">{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-300">{it.itemName}</td>
                    <td className="py-2 px-3 text-slate-600 border-r border-slate-300">{it.spec || '—'}</td>
                    <td className="py-2 px-3 text-center text-slate-700 border-r border-slate-300">{it.unit}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold border-r border-slate-300">{it.quantity}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700 border-r border-slate-300">${it.unitPrice.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">${it.lineTotal.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t border-slate-300">
                  <td colSpan={6} className="py-2 px-3 text-right text-slate-700">
                    進貨未稅總金額：
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm text-slate-900">
                    ${selectedReceipt.totalAmount.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* 簽名覆核區塊 (四大職責分離簽核欄) */}
            <div className="grid grid-cols-4 gap-4 pt-6 border-t border-slate-300 text-xs">
              <div className="space-y-8">
                <span className="font-bold text-slate-700 block">供料廠商司機簽章：</span>
                <div className="border-b border-slate-400 h-6"></div>
              </div>
              <div className="space-y-8">
                <span className="font-bold text-slate-700 block">現場點收同仁：</span>
                <div className="border-b border-slate-400 h-6"></div>
              </div>
              <div className="space-y-8">
                <span className="font-bold text-slate-700 block">工務所長 / 主任核准：</span>
                <div className="border-b border-slate-400 h-6"></div>
              </div>
              <div className="space-y-8">
                <span className="font-bold text-slate-700 block">會計月底對帳審核：</span>
                <div className="border-b border-slate-400 h-6"></div>
              </div>
            </div>

            {/* 底部操作按鈕 */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>立即列印 / 存為 PDF</span>
              </button>
              <button
                onClick={() => setIsPrintViewOpen(false)}
                className="px-4 py-2 bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
              >
                關閉預覽
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ 自訂作廢防呆確認 Modal (取代原生 prompt) */}
      {voidModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <h3 className="font-bold text-sm">確認作廢進貨簽收單</h3>
              </div>
              <button onClick={() => setVoidModalTarget(null)} className="text-rose-200 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-700">
                您即將作廢進貨單：<strong className="font-mono text-slate-900">{voidModalTarget.receiptNumber}</strong>（送貨單號：{voidModalTarget.deliveryNoteNumber}，金額：NT$ {voidModalTarget.totalAmount.toLocaleString()}）。
              </p>

              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  請選擇或輸入作廢原因說明：
                </label>
                <div className="space-y-1.5 mb-2">
                  {[
                    '廠商送貨規格不符現場退貨重送',
                    '送貨單號或金額誤植重開',
                    '現場重複登錄點收作廢',
                  ].map(reason => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setVoidReasonText(reason)}
                      className={`block w-full text-left px-2.5 py-1 rounded border text-[11px] transition-colors ${
                        voidReasonText === reason
                          ? 'border-rose-400 bg-rose-50 text-rose-800 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      • {reason}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={voidReasonText}
                  onChange={e => setVoidReasonText(e.target.value)}
                  placeholder="或手動輸入詳細作廢原因..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-rose-500 text-xs"
                />
              </div>

              <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-amber-800 text-[11px] flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>作廢後此單據將自廠商未結水池移出，並記入中文審計日誌。</span>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoidModalTarget(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded text-xs text-slate-700 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold"
              >
                確認作廢單據
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ 自訂刪除草稿防呆確認 Modal (取代原生 confirm) */}
      {deleteModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <h3 className="font-bold text-sm">刪除進貨單草稿</h3>
              </div>
              <button onClick={() => setDeleteModalTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-700">
              <p>
                確定要刪除尚未過帳的草稿進貨單「<strong>{deleteModalTarget.deliveryNoteNumber}</strong>」嗎？
              </p>
              <p className="text-rose-600 text-[11px]">
                此操作不可逆，物料明細將一併清除。
              </p>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalTarget(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded text-xs text-slate-700 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📷 自訂簽收單紙本照片/附件上傳 Modal (取代原生 prompt) */}
      {attachmentModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm">現場紙本簽收單照片/附件上傳</h3>
              </div>
              <button onClick={() => setAttachmentModalTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-600">
                可直接點選快速示範憑證或手動輸入手機拍照檔案名稱：
              </p>

              <div className="space-y-1.5">
                {[
                  '現場紙本送貨簽收單_照片存證.jpg',
                  '台泥混凝土出料簽收磅單_TC889922.pdf',
                  '中鋼結構進場吊運檢驗簽認單.jpg',
                  '地坪高壓泵送車簽認單_現場照.png',
                ].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        attachmentFileName: opt,
                        attachmentFileId: `ATT-${Date.now()}`,
                      }));
                      setAttachmentModalTarget(null);
                      triggerToast(`已附加簽收單憑據: ${opt}`, 'success');
                    }}
                    className="block w-full text-left px-3 py-2 rounded border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 text-slate-800 text-xs transition-colors"
                  >
                    📄 {opt}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <label className="block text-slate-600 font-bold mb-1">
                  或手動輸入附件名稱：
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="manualAttachmentInput"
                    defaultValue={attachmentModalTarget.currentName}
                    placeholder="輸入拍照檔名如 photo_202610.jpg"
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('manualAttachmentInput') as HTMLInputElement;
                      const val = input ? input.value.trim() : '';
                      if (val) {
                        setFormData(prev => ({
                          ...prev,
                          attachmentFileName: val,
                          attachmentFileId: `ATT-${Date.now()}`,
                        }));
                      }
                      setAttachmentModalTarget(null);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold"
                  >
                    設定
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setAttachmentModalTarget(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded text-xs text-slate-700 hover:bg-slate-100"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
