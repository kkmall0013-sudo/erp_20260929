// src/components/InboundWorkspace.tsx
// 🏛️ 現場進貨簽收管理工作台 (Inbound Goods / Material Receiving Management)
// 專責現場物料送達簽收點收 · A 模式直入案場成本 · 清冊支援「清單」與「廠商階層目錄」切換 · 動態日期與進貨廠商關聯篩選 · 支援單據獨立編輯修改與草稿功能

import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronDown,
  ChevronUp,
  Download,
  Printer,
  Sparkles,
  Info,
  DollarSign,
  Paperclip,
  Check,
  Boxes,
  FileSpreadsheet,
  FolderTree,
  List,
  RotateCcw
} from 'lucide-react';
import { ExcelInboundGridModal, loadStoredInternalAssets, InternalAsset } from './inbound/ExcelInboundGridModal';
import {
  InboundReceipt,
  InboundReceiptItem,
  InboundReceiptStatus,
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
  getAllProjects,
  getAllBusinessPartners,
  subscribeToDatabase,
  recordAuditLog
} from '../db/sqlite';
import { useAuth } from '../context/AuthContext';

interface InboundWorkspaceProps {
  onDataChanged?: () => void;
  triggerToast?: (msg: string, type?: 'success' | 'warn' | 'error') => void;
}

// 模擬現場角色權限
type DemoRole = 'ALL_PERMS' | 'SITE_CLERK' | 'SITE_CHIEF' | 'ACCOUNTANT';

// 日期區間篩選型別
type DateFilterMode = 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30_DAYS' | 'CUSTOM';

export const InboundWorkspace: React.FC<InboundWorkspaceProps> = ({
  onDataChanged,
  triggerToast = () => {},
}) => {
  const { currentUser, can } = useAuth();

  // 職責分離模擬身份
  const [demoRole, setDemoRole] = useState<DemoRole>('ALL_PERMS');

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

  // 案場與廠商篩選
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 展開檢視特定清單列明細之 ID
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // 📊 Excel 試算表極速打單工作台 Modal
  const [isExcelGridModalOpen, setIsExcelGridModalOpen] = useState<boolean>(false);
  const [initialDraftToLoad, setInitialDraftToLoad] = useState<InboundReceipt | null>(null);

  // 📝 單筆進貨簽收單 建立 / 編輯 Modal 控制
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedReceipt, setSelectedReceipt] = useState<InboundReceipt | null>(null);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState<boolean>(false);

  // 防呆確認 Modal
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

  // 載入資料
  const loadData = () => {
    try {
      const allReceipts = getAllInboundReceipts();
      setReceipts(allReceipts);
      const prjs = getAllProjects();
      setProjects(prjs);
      const vends = getAllBusinessPartners().filter(b => b.isVendor || b.type === 'VENDOR' || b.type === 'BOTH');
      setVendors(vends);
      setInternalAssets(loadStoredInternalAssets());
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

  // 計算有效日期區間
  const activeDateRange = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    if (dateFilterMode === 'THIS_MONTH') {
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { start, end, label: `本月 (${year}-${String(month + 1).padStart(2, '0')})` };
    }
    if (dateFilterMode === 'LAST_MONTH') {
      const lastMonthDate = new Date(year, month - 1, 1);
      const lmYear = lastMonthDate.getFullYear();
      const lmMonth = lastMonthDate.getMonth();
      const start = `${lmYear}-${String(lmMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(lmYear, lmMonth + 1, 0).getDate();
      const end = `${lmYear}-${String(lmMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { start, end, label: `上月 (${lmYear}-${String(lmMonth + 1).padStart(2, '0')})` };
    }
    if (dateFilterMode === 'LAST_30_DAYS') {
      const past = new Date(now.getTime() - 30 * 86400000);
      const start = past.toISOString().slice(0, 10);
      const end = now.toISOString().slice(0, 10);
      return { start, end, label: `近 30 天 (${start} ~ ${end})` };
    }
    if (dateFilterMode === 'CUSTOM') {
      return {
        start: customStartDate,
        end: customEndDate,
        label: `自訂區間 (${customStartDate || '起始'} ~ ${customEndDate || '迄日'})`
      };
    }
    return { start: '', end: '', label: '全部歷史進貨日' };
  }, [dateFilterMode, customStartDate, customEndDate]);

  // ⚡ 動態計算「在當前日期區間內真正有進貨單的廠商清單」 (解決 100 家廠商無效篩選問題)
  const activeVendorsInDateRange = useMemo(() => {
    const { start, end } = activeDateRange;
    const rangeReceipts = receipts.filter(r => {
      if (r.isDeleted) return false;
      if (start && r.receivedDate < start) return false;
      if (end && r.receivedDate > end) return false;
      return true;
    });

    const vendorMap = new Map<string, { id: string; name: string; count: number }>();
    rangeReceipts.forEach(r => {
      const vId = r.vendorId || 'UNKNOWN';
      const vName = r.vendorNameSnapshot || vendors.find(v => v.id === r.vendorId)?.name || '未指定供料商';
      const existing = vendorMap.get(vId);
      if (existing) {
        existing.count += 1;
      } else {
        vendorMap.set(vId, { id: vId, name: vName, count: 1 });
      }
    });

    return Array.from(vendorMap.values()).sort((a, b) => b.count - a.count);
  }, [receipts, activeDateRange, vendors]);

  // 當日期區間切換時，若原先選取的廠商在該區間內無單，自動重設為 ALL，避免無效空白頁面
  useEffect(() => {
    if (selectedVendorId !== 'ALL' && activeVendorsInDateRange.length > 0) {
      const exists = activeVendorsInDateRange.some(v => v.id === selectedVendorId);
      if (!exists) {
        setSelectedVendorId('ALL');
      }
    }
  }, [activeVendorsInDateRange, selectedVendorId]);

  // ⚡ 動態計算「在當前日期區間內真正有進貨單的案場清單」 (案場與廠商一致：有進貨的才進入選單，徹底杜絕無效空白頁面)
  const activeProjectsInDateRange = useMemo(() => {
    const { start, end } = activeDateRange;
    const rangeReceipts = receipts.filter(r => {
      if (r.isDeleted) return false;
      if (start && r.receivedDate < start) return false;
      if (end && r.receivedDate > end) return false;
      return true;
    });

    const projectMap = new Map<string, { id: string; name: string; code: string; count: number }>();
    rangeReceipts.forEach(r => {
      const pId = r.projectId || 'UNKNOWN';
      const prj = projects.find(p => p.id === r.projectId);
      const pName = r.projectNameSnapshot || prj?.name || '未指定案場';
      const pCode = (r as any).projectCodeSnapshot || prj?.projectCode || '';
      const existing = projectMap.get(pId);
      if (existing) {
        existing.count += 1;
      } else {
        projectMap.set(pId, { id: pId, name: pName, code: pCode, count: 1 });
      }
    });

    return Array.from(projectMap.values()).sort((a, b) => b.count - a.count);
  }, [receipts, activeDateRange, projects]);

  // 當日期區間切換時，若原先選取的案場在該區間內無單，自動重設為 ALL，避免點了空白
  useEffect(() => {
    if (selectedProjectId !== 'ALL' && activeProjectsInDateRange.length > 0) {
      const exists = activeProjectsInDateRange.some(p => p.id === selectedProjectId);
      if (!exists) {
        setSelectedProjectId('ALL');
      }
    }
  }, [activeProjectsInDateRange, selectedProjectId]);

  // 篩選後之進貨單清單
  const filteredReceipts = useMemo(() => {
    const { start, end } = activeDateRange;

    return receipts.filter(r => {
      if (r.isDeleted) return false;

      // 日期區間篩選
      if (start && r.receivedDate < start) return false;
      if (end && r.receivedDate > end) return false;

      // 案場篩選
      if (selectedProjectId !== 'ALL' && r.projectId !== selectedProjectId) return false;

      // 廠商篩選 (動態關聯)
      if (selectedVendorId !== 'ALL' && r.vendorId !== selectedVendorId) return false;

      // 狀態篩選
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;

      // 關鍵字搜尋
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const matchNo = (r.receiptNumber || '').toLowerCase().includes(kw);
        const matchDn = (r.deliveryNoteNumber || '').toLowerCase().includes(kw);
        const matchVendor = (r.vendorNameSnapshot || '').toLowerCase().includes(kw);
        const matchProject = (r.projectNameSnapshot || '').toLowerCase().includes(kw);
        const matchItem = (r.items || []).some(it =>
          (it.itemName || '').toLowerCase().includes(kw) ||
          (it.spec || '').toLowerCase().includes(kw) ||
          (it.notes || '').toLowerCase().includes(kw)
        );
        return matchNo || matchDn || matchVendor || matchProject || matchItem;
      }

      return true;
    });
  }, [receipts, activeDateRange, selectedProjectId, selectedVendorId, statusFilter, searchKeyword]);

  // 🏢 階層式資料結構：按供貨廠商分組
  const vendorHierarchyGroups = useMemo(() => {
    const groupMap = new Map<string, {
      vendorId: string;
      vendorName: string;
      vendorTaxId: string;
      receipts: InboundReceipt[];
      subtotal: number;
      tax: number;
      grandTotal: number;
      itemsCount: number;
    }>();

    filteredReceipts.forEach(r => {
      const vId = r.vendorId || 'UNKNOWN';
      const vName = r.vendorNameSnapshot || vendors.find(v => v.id === r.vendorId)?.name || '未指定供料商';
      const vTax = r.vendorTaxIdSnapshot || vendors.find(v => v.id === r.vendorId)?.taxId || '';

      const existing = groupMap.get(vId);
      const itemsInReceipt = (r.items || []).length;
      const receiptTotal = Number(r.totalAmount) || 0;

      if (existing) {
        existing.receipts.push(r);
        existing.subtotal += receiptTotal;
        existing.tax = Math.round(existing.subtotal * 0.05);
        existing.grandTotal = existing.subtotal + existing.tax;
        existing.itemsCount += itemsInReceipt;
      } else {
        const subtotal = receiptTotal;
        const tax = Math.round(subtotal * 0.05);
        groupMap.set(vId, {
          vendorId: vId,
          vendorName: vName,
          vendorTaxId: vTax,
          receipts: [r],
          subtotal,
          tax,
          grandTotal: subtotal + tax,
          itemsCount: itemsInReceipt,
        });
      }
    });

    return Array.from(groupMap.values()).sort((a, b) => b.subtotal - a.subtotal);
  }, [filteredReceipts, vendors]);

  // 現場純粹單據統計數值 (無會計大水池干擾)
  const stats = useMemo(() => {
    const valid = filteredReceipts;
    const totalCount = valid.length;
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = valid.filter(r => r.receivedDate === todayStr).length;
    const draftCount = valid.filter(r => r.status === 'DRAFT').length;
    const postedCount = valid.filter(r => r.status === 'POSTED').length;
    const subtotal = valid.reduce((acc, r) => acc + (Number(r.totalAmount) || 0), 0);
    const estimatedTax = Math.round(subtotal * 0.05);
    const grandTotal = subtotal + estimatedTax;

    return {
      totalCount,
      todayCount,
      draftCount,
      postedCount,
      subtotal,
      estimatedTax,
      grandTotal,
    };
  }, [filteredReceipts]);

  // 展開 / 收合全部廠商目錄
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
      if (next.has(vendorId)) {
        next.delete(vendorId);
      } else {
        next.add(vendorId);
      }
      return next;
    });
  };

  const handleToggleRowExpand = (id: string) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // -------------------------------------------------------------
  // 📝 新增進貨單
  // -------------------------------------------------------------
  const handleOpenCreateModal = () => {
    if (!canWrite) {
      triggerToast('⛔ 權限攔截：當前角色無進貨單填寫權限', 'warn');
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

  // -------------------------------------------------------------
  // ✏️ 單獨修改任何進貨簽收單 (解決無法單獨點選修改痛點)
  // -------------------------------------------------------------
  const handleOpenEditModal = (r: InboundReceipt) => {
    if (!canWrite) {
      triggerToast('⛔ 權限攔截：當前角色無進貨單修改權限', 'warn');
      return;
    }
    if (r.billingStatus === 'BILLED') {
      triggerToast('⚠️ 此進貨單已由會計完成對帳請款，已依法鎖定禁止修改', 'warn');
      return;
    }

    setFormData({ ...r });
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

  const calculatedFormTotal = useMemo(() => {
    return formItems.reduce((acc, it) => acc + (Number(it.lineTotal) || 0), 0);
  }, [formItems]);

  // -------------------------------------------------------------
  // 💾 儲存進貨單 (草稿或正式確認簽收)
  // -------------------------------------------------------------
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

    try {
      const statusToSave: InboundReceiptStatus = asPosted ? 'POSTED' : 'DRAFT';

      if (formData.id) {
        // 更新現有單據 (直接單獨修改，免作廢)
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
          asPosted ? '修改並簽收進貨單' : '修改進貨單草稿',
          '進貨管理',
          formData.id,
          { '送貨單號': formData.deliveryNoteNumber, '金額': calculatedFormTotal }
        );

        triggerToast(
          asPosted
            ? '✅ 進貨簽收單修改完成並確認簽收，等待會計核對！'
            : '✅ 進貨簽收單草稿已更新儲存，可隨時繼續修改',
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
          asPosted ? '新增並簽收進貨單' : '新增進貨單草稿',
          '進貨管理',
          newReceipt.receiptNumber,
          { '送貨單號': formData.deliveryNoteNumber, '金額': calculatedFormTotal }
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

  // 作廢處理
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

  // 刪除草稿
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
      deleteInboundReceipt(deleteModalTarget.id);
      recordAuditLog(
        currentUser?.fullName || '系統操作員',
        '刪除草稿進貨單',
        '進貨管理',
        deleteModalTarget.id,
        { '送貨單號': deleteModalTarget.deliveryNoteNumber }
      );
      triggerToast('✅ 草稿進貨單已刪除', 'success');
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

  // 📤 匯出現場進貨標準 CSV
  const handleExportCsv = () => {
    try {
      const headers = [
        '序號', '進貨日', '廠商名稱', '個案用料(案場)', '專案代碼',
        '品名', '規格', '單位', '數量', '單價', '金額', '送貨單號', '備註'
      ];
      let seq = 1;
      const rows: string[][] = [];
      filteredReceipts.forEach(r => {
        const prj = projects.find(p => p.id === r.projectId);
        const code = prj?.projectCode || '';
        const receiptItems = (r.items && r.items.length > 0)
          ? r.items
          : [{ id: 'temp', receiptId: r.id, itemName: '現場建材', spec: '', unit: '式', quantity: 1, unitPrice: r.totalAmount, lineTotal: r.totalAmount, notes: '' }];

        receiptItems.forEach(it => {
          const qty = Number(it.quantity) || 0;
          const price = Number(it.unitPrice) || 0;
          const total = Number(it.lineTotal) || (qty * price);
          rows.push([
            String(seq++),
            `"${r.receivedDate}"`,
            `"${(r.vendorNameSnapshot || '').replace(/"/g, '""')}"`,
            `"${(r.projectNameSnapshot || '').replace(/"/g, '""')}"`,
            `"${code}"`,
            `"${(it.itemName || '').replace(/"/g, '""')}"`,
            `"${(it.spec || '').replace(/"/g, '""')}"`,
            `"${it.unit || '包'}"`,
            String(qty),
            String(price),
            String(total),
            `"${(r.deliveryNoteNumber || '').replace(/"/g, '""')}"`,
            `"${(it.notes || r.notes || '').replace(/"/g, '""')}"`
          ]);
        });
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `現場進貨簽收單清冊_${activeDateRange.start || '全部'}_${activeDateRange.end || ''}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      triggerToast('🖨️ 已成功匯出現場進貨標準 CSV 試算表（Excel 直接開不亂碼）！', 'success');
    } catch (err: any) {
      triggerToast('匯出失敗: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* 頂部標題與主操作列 (精簡整合打單入口) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
                <Truck className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">現場進貨簽收管理</h2>
                  <span className="bg-emerald-50 text-emerald-700 font-mono text-xs px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                    A 模式直入案場成本
                  </span>
                  <span className="text-slate-400 text-xs hidden sm:inline">|</span>
                  <span className="text-xs text-slate-500 hidden sm:inline">
                    現場物料驗收簽收 · 會計請款由財務模組專責審核
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  現場點收即時建檔 · 支援完整下拉選單、案場搜尋、獨立修改、草稿暫存與廠商階層目錄檢視
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 📊 Excel 試算表極速打單模式 (主要入口) */}
            <button
              onClick={() => {
                setInitialDraftToLoad(null);
                setIsExcelGridModalOpen(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="仿 Excel 試算表快速鍵連續打單，支援多草稿暫存切換、輸入3自動推薦3310、新廠商登記與正式過帳"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>📊 極速進貨打單 (工作台)</span>
              {stats.draftCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-slate-900 font-black rounded-full text-[10px]" title={`目前有 ${stats.draftCount} 筆待處理草稿`}>
                  草稿 {stats.draftCount}
                </span>
              )}
            </button>

            {/* 新增單筆進貨簽收單 */}
            <button
              onClick={handleOpenCreateModal}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="新增單筆現場紙本簽收單"
            >
              <Plus className="w-4 h-4" />
              <span>新增單筆簽收單</span>
            </button>

            {/* 匯出報表 */}
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs transition-colors border border-slate-300 flex items-center gap-1 cursor-pointer"
              title="匯出當前篩選結果為標準 CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>匯出 CSV</span>
            </button>
          </div>
        </div>

        {/* 現場進貨簽收單據統計指標 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
              <span>本期進貨簽收單</span>
              <Boxes className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-xl font-bold text-slate-800">
                {stats.totalCount}
              </span>
              <span className="text-[11px] text-slate-400">筆單據</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">
              {activeDateRange.label}
            </div>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200/80">
            <div className="text-[11px] text-blue-800 font-medium flex items-center justify-between">
              <span>今日簽收進場</span>
              <Truck className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-xl font-bold text-blue-900">
                {stats.todayCount}
              </span>
              <span className="text-[11px] text-blue-600 font-medium">筆今日送達</span>
            </div>
            <div className="text-[10px] text-blue-600 truncate mt-0.5">
              現場已核對卸料
            </div>
          </div>

          {/* 現場草稿暫存單卡片 (點擊切換草稿篩選，支援載入極速打單) */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'DRAFT' ? 'ALL' : 'DRAFT')}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              statusFilter === 'DRAFT'
                ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300 shadow-sm'
                : 'bg-amber-50/70 hover:bg-amber-100/70 border-amber-200'
            }`}
            title="點擊篩選顯示所有草稿單，可載入極速打單工作台編輯"
          >
            <div className="text-[11px] text-amber-800 font-medium flex items-center justify-between">
              <span>現場草稿暫存單</span>
              <Edit className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-xl font-bold text-amber-900">
                {stats.draftCount}
              </span>
              <span className="text-[11px] text-amber-700 font-medium">筆草稿</span>
            </div>
            <div className="text-[10px] text-amber-700 truncate mt-0.5 font-medium">
              {statusFilter === 'DRAFT' ? '✓ 篩選草稿中 (點擊還原)' : '點擊篩選 · 可載入極速打單'}
            </div>
          </div>

          <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-200">
            <div className="text-[11px] text-purple-900 font-medium flex items-center justify-between">
              <span>預計進貨未稅額</span>
              <DollarSign className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-xl font-bold text-purple-950">
                ${stats.subtotal.toLocaleString()}
              </span>
            </div>
            <div className="text-[10px] text-purple-700 truncate mt-0.5">
              預估稅金 5%: ${stats.estimatedTax.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 🔍 智慧篩選工具列：日期區間、動態廠商關聯、案場與狀態 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* 關鍵字搜尋 */}
          <div className="relative lg:col-span-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="搜尋單號 / 送貨單 / 材料品名..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
          </div>

          {/* 日期區間模式 */}
          <div className="lg:col-span-3 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={dateFilterMode}
              onChange={e => setDateFilterMode(e.target.value as DateFilterMode)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800 font-medium"
            >
              <option value="THIS_MONTH">📅 本月進貨單</option>
              <option value="LAST_MONTH">📅 上月進貨單</option>
              <option value="LAST_30_DAYS">📅 近 30 天進貨</option>
              <option value="ALL">📅 全部歷史日期</option>
              <option value="CUSTOM">⚙️ 自訂起訖日期區間...</option>
            </select>
          </div>

          {/* ⚡ 動態廠商篩選 (只列出該日期區間內真正有進貨單的廠商，徹底避免點選後是空白) */}
          <div className="lg:col-span-3">
            <select
              value={selectedVendorId}
              onChange={e => setSelectedVendorId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800 font-medium"
            >
              <option value="ALL">
                🏢 全部供貨廠商 (本期共 {activeVendorsInDateRange.length} 家有進貨)
              </option>
              {activeVendorsInDateRange.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.count} 筆進貨)
                </option>
              ))}
            </select>
          </div>

          {/* ⚡ 動態案場篩選 (與廠商選單一致：只列出該日期區間內真正有進貨單的案場，避免點選後空白) */}
          <div className="lg:col-span-3">
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800 font-medium"
            >
              <option value="ALL">
                🏗️ 全部工區案場 (本期共 {activeProjectsInDateRange.length} 個案場有進貨)
              </option>
              {activeProjectsInDateRange.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.code ? `(${p.code})` : ''} ({p.count} 筆進貨)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 次行：自訂日期區間與狀態篩選 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          {dateFilterMode === 'CUSTOM' ? (
            <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-700">自訂起訖區間:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-xs outline-none focus:border-indigo-500"
              />
              <span className="text-slate-400">至</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-xs outline-none focus:border-indigo-500"
              />
            </div>
          ) : (
            <div className="text-slate-500 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-500"></span>
              <span>目前篩選期間：<strong className="text-slate-800">{activeDateRange.label}</strong></span>
              <span className="text-slate-400">|</span>
              <span>符合進貨單：<strong className="text-indigo-600 font-mono">{filteredReceipts.length}</strong> 筆</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* 簽收狀態篩選 */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">狀態:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700"
              >
                <option value="ALL">全部簽收狀態</option>
                <option value="POSTED">現場已點收簽收</option>
                <option value="DRAFT">現場草稿 (待點收)</option>
                <option value="VOIDED">已作廢</option>
              </select>
            </div>

            {/* 顯示模式切換：清單 vs 廠商階層目錄 */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'LIST'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="標準進貨明細清單檢視"
              >
                <List className="w-3.5 h-3.5" />
                <span>清單檢視</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('HIERARCHY');
                  if (expandedVendorIds.size === 0 && vendorHierarchyGroups.length > 0) {
                    setExpandedVendorIds(new Set(vendorHierarchyGroups.map(g => g.vendorId)));
                  }
                }}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'HIERARCHY'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="以供貨廠商為目錄之手風琴階層檢視，點擊即展開該廠商明細與預估價格/稅金"
              >
                <FolderTree className="w-3.5 h-3.5 text-purple-600" />
                <span>廠商階層目錄檢視</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 🏢 顯示方式 1：廠商階層目錄檢視 (Hierarchy Accordion View)         */}
      {/* ----------------------------------------------------------------- */}
      {viewMode === 'HIERARCHY' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-purple-50/40">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-purple-700" />
              <span className="text-xs font-bold text-slate-800">
                以供貨公司為目錄之進貨階層清冊
              </span>
              <span className="text-xs text-purple-700 font-mono font-bold">
                (共 {vendorHierarchyGroups.length} 家供料商 · {filteredReceipts.length} 筆簽收單)
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={handleToggleAllVendors}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-slate-700 font-medium cursor-pointer transition-colors"
              >
                {expandedVendorIds.size === vendorHierarchyGroups.length ? '全部收合' : '全部展開目錄'}
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {vendorHierarchyGroups.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium">該日期區間無符合條件的供料廠商與進貨單</p>
                <p className="text-xs text-slate-400 mt-1">
                  請更換上方篩選日期或點選右上角「📊 極速進貨打單」開始建單
                </p>
              </div>
            ) : (
              vendorHierarchyGroups.map(group => {
                const isExpanded = expandedVendorIds.has(group.vendorId);

                return (
                  <div key={group.vendorId} className="transition-colors">
                    {/* 廠商目錄列 (點選即可收合 / 展開該公司進貨明細) */}
                    <div
                      onClick={() => handleToggleVendor(group.vendorId)}
                      className={`px-5 py-3 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                        isExpanded ? 'bg-purple-50/70 border-b border-purple-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="p-1 rounded text-purple-700 hover:bg-purple-100 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-purple-700" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                        <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{group.vendorName}</span>
                            {group.vendorTaxId && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded">
                                統編: {group.vendorTaxId}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            本期進貨 <strong className="text-slate-800">{group.receipts.length}</strong> 筆簽收單 · 共 <strong className="text-slate-800">{group.itemsCount}</strong> 項材料
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-sans">預計未稅金額</span>
                          <span className="font-bold text-slate-800 text-sm">
                            ${group.subtotal.toLocaleString()}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-sans">預計稅金 (5%)</span>
                          <span className="font-bold text-amber-700">
                            ${group.tax.toLocaleString()}
                          </span>
                        </div>

                        <div className="text-right bg-white px-2.5 py-1 rounded border border-purple-200">
                          <span className="text-[10px] text-purple-700 block font-sans font-bold">預計含稅總額</span>
                          <span className="font-bold text-purple-900 text-sm">
                            ${group.grandTotal.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 展開之廠商進貨明細清單 (如同拿到月結請款對帳單，平整化條列該廠商本期進貨品項) */}
                    {isExpanded && (
                      <div className="p-0 border-t border-purple-200 bg-white">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                              <tr className="divide-x divide-slate-200">
                                <th className="py-2.5 px-3 w-12 text-center font-bold">序</th>
                                <th className="py-2.5 px-3 w-28 text-center font-bold">進貨日期</th>
                                <th className="py-2.5 px-3 w-40 font-bold">送貨單號 / 系統單號</th>
                                <th className="py-2.5 px-3 min-w-[150px] font-bold">歸屬案場</th>
                                <th className="py-2.5 px-3 min-w-[160px] font-bold">材料品名</th>
                                <th className="py-2.5 px-3 min-w-[120px] font-bold">規格型號</th>
                                <th className="py-2.5 px-3 w-16 text-center font-bold">單位</th>
                                <th className="py-2.5 px-3 w-24 text-right font-bold">進貨數量</th>
                                <th className="py-2.5 px-3 w-28 text-right font-bold">預計單價</th>
                                <th className="py-2.5 px-3 w-32 text-right font-bold bg-purple-50 text-purple-900">未稅金額</th>
                                <th className="py-2.5 px-3 w-28 text-center font-bold">點收狀態</th>
                                <th className="py-2.5 px-3 min-w-[120px] font-bold">備註說明</th>
                                <th className="py-2.5 px-3 w-28 text-center font-bold">操作</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(() => {
                                let itemCounter = 0;
                                return group.receipts.flatMap(r => {
                                  const items = r.items && r.items.length > 0 ? r.items : [{
                                    id: `empty-${r.id}`,
                                    itemName: '現場一般料件',
                                    spec: '—',
                                    unit: '批',
                                    quantity: 1,
                                    unitPrice: r.totalAmount || 0,
                                    lineTotal: r.totalAmount || 0,
                                    notes: r.notes || ''
                                  }];

                                  return items.map((it, itIdx) => {
                                    itemCounter += 1;
                                    const currentSeq = itemCounter;
                                    const lineAmt = Number(it.lineTotal) || (Number(it.quantity) * Number(it.unitPrice));

                                    return (
                                      <tr
                                        key={`${r.id}-${it.id || itIdx}`}
                                        className="hover:bg-purple-50/40 transition-colors divide-x divide-slate-100 text-slate-800"
                                      >
                                        <td className="py-2 px-3 text-center font-mono text-slate-400">
                                          {currentSeq}
                                        </td>
                                        <td className="py-2 px-3 text-center font-mono text-slate-700 whitespace-nowrap">
                                          {r.receivedDate}
                                        </td>
                                        <td className="py-2 px-3">
                                          <div className="font-mono font-bold text-slate-900">{r.deliveryNoteNumber}</div>
                                          <div className="text-[10px] font-mono text-slate-400">{r.receiptNumber}</div>
                                        </td>
                                        <td className="py-2 px-3">
                                          <div className="font-bold text-indigo-700">{r.projectNameSnapshot || '現場工區'}</div>
                                          {((r as any).projectCodeSnapshot || projects.find(p => p.id === r.projectId)?.projectCode) && (
                                            <div className="text-[10px] font-mono text-slate-500">
                                              代碼: {(r as any).projectCodeSnapshot || projects.find(p => p.id === r.projectId)?.projectCode}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 font-bold text-slate-900">
                                          {it.itemName}
                                        </td>
                                        <td className="py-2 px-3 font-mono text-slate-600">
                                          {it.spec || '—'}
                                        </td>
                                        <td className="py-2 px-3 text-center font-medium text-slate-700">
                                          {it.unit || '式'}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                          {Number(it.quantity).toLocaleString()}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                                          ${Number(it.unitPrice).toLocaleString()}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-bold text-purple-900 bg-purple-50/20">
                                          ${lineAmt.toLocaleString()}
                                        </td>
                                        <td className="py-2 px-3 text-center whitespace-nowrap">
                                          {r.status === 'POSTED' && (
                                            <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200 text-[10px] inline-flex items-center gap-0.5">
                                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                              <span>已點收</span>
                                            </span>
                                          )}
                                          {r.status === 'DRAFT' && (
                                            <span className="bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                                              草稿
                                            </span>
                                          )}
                                          {r.status === 'VOIDED' && (
                                            <span className="bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded border border-slate-300 text-[10px]">
                                              已作廢
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 text-slate-500 text-xs">
                                          {it.notes || r.notes || '—'}
                                        </td>
                                        <td className="py-2 px-3 text-center whitespace-nowrap">
                                          <div className="flex items-center justify-center gap-1">
                                            {canWrite && r.status === 'DRAFT' && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setInitialDraftToLoad(r);
                                                  setIsExcelGridModalOpen(true);
                                                }}
                                                className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs border border-amber-300 flex items-center gap-0.5 cursor-pointer transition-colors"
                                                title="載入至仿 Excel 極速打單工作台連續編輯"
                                              >
                                                <FileSpreadsheet className="w-3 h-3 text-amber-600" />
                                                <span>極速打單</span>
                                              </button>
                                            )}
                                            {canWrite && r.billingStatus !== 'BILLED' && (
                                              <button
                                                type="button"
                                                onClick={() => handleOpenEditModal(r)}
                                                className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 flex items-center gap-0.5 cursor-pointer transition-colors"
                                                title="修改此進貨簽收單 (料件/單價/數量/案場)"
                                              >
                                                <Edit className="w-3 h-3" />
                                                <span>修改</span>
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => handleOpenDetailModal(r)}
                                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                              title="查看單據詳情"
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handlePrint(r)}
                                              className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                              title="列印現場簽收單"
                                            >
                                              <Printer className="w-3.5 h-3.5" />
                                            </button>
                                            {canWrite && r.billingStatus !== 'BILLED' && r.status !== 'VOIDED' && (
                                              <button
                                                type="button"
                                                onClick={() => handleOpenVoidModal(r)}
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                                title="作廢"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  });
                                });
                              })()}
                            </tbody>
                            <tfoot className="bg-purple-50/70 border-t-2 border-purple-200 text-xs font-bold font-mono">
                              <tr>
                                <td colSpan={7} className="py-3 px-4 text-slate-800 font-sans">
                                  <span>【{group.vendorName}】本期進貨小計（共 {group.receipts.length} 筆單據 · {group.itemsCount} 項物料）</span>
                                </td>
                                <td className="py-3 px-3 text-right text-slate-600">
                                  —
                                </td>
                                <td className="py-3 px-3 text-right text-slate-600 font-sans">
                                  未稅小計:
                                </td>
                                <td className="py-3 px-3 text-right text-purple-900 text-sm">
                                  ${group.subtotal.toLocaleString()}
                                </td>
                                <td colSpan={3} className="py-3 px-4 text-slate-700 text-[11px] font-sans font-normal">
                                  <span>預估稅金 5%: <strong className="text-amber-800 font-bold">${group.tax.toLocaleString()}</strong> ｜ 預計含稅總額: <strong className="text-purple-900 font-bold text-xs">${group.grandTotal.toLocaleString()}</strong></span>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 📋 顯示方式 2：標準清單檢視 (List View)                           */}
      {/* ----------------------------------------------------------------- */}
      {viewMode === 'LIST' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">現場進貨簽收單清冊</span>
              <span className="text-xs text-slate-400 font-mono">({filteredReceipts.length} 筆)</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 現場已點收
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> 待點收草稿
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
                  <th className="py-3 px-3 whitespace-nowrap">系統單號</th>
                  <th className="py-3 px-3 whitespace-nowrap">送貨簽收單號</th>
                  <th className="py-3 px-3 whitespace-nowrap">簽收日</th>
                  <th className="py-3 px-3 whitespace-nowrap">供料廠商</th>
                  <th className="py-3 px-3 whitespace-nowrap">歸屬案場</th>
                  <th className="py-3 px-3 whitespace-nowrap">品名</th>
                  <th className="py-3 px-3 whitespace-nowrap">規格</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">單位</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">數量</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">單價</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">未稅金額 (NT$)</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">現場點收狀態</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400">
                      <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-sm font-medium">查無符合條件的進貨簽收單據</p>
                      <p className="text-xs text-slate-400 mt-1">
                        可點選右上角「📊 極速進貨打單」開始快速鍵入
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map(r => {
                    const firstItem = (r.items && r.items.length > 0) ? r.items[0] : null;
                    const itemsCount = (r.items || []).length;
                    const isExpanded = expandedRowIds.has(r.id);

                    return (
                      <React.Fragment key={r.id}>
                        <tr
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                          onClick={() => handleToggleRowExpand(r.id)}
                        >
                          <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {itemsCount > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleRowExpand(r.id);
                                  }}
                                  className="text-slate-400 hover:text-indigo-600 p-0.5"
                                >
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              <span>{r.receiptNumber}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
                              {r.deliveryNoteNumber}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {r.receivedDate}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              <span className="truncate max-w-[130px]">{r.vendorNameSnapshot || '廠商'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                            <span className="text-indigo-700 font-semibold truncate max-w-[140px] inline-block">
                              {r.projectNameSnapshot || '案場'}
                            </span>
                          </td>
                          {/* 品名 */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1 font-bold text-slate-900">
                              <span className="truncate max-w-[140px]">{firstItem ? firstItem.itemName : '無品名'}</span>
                              {itemsCount > 1 && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-normal shrink-0">
                                  +{itemsCount - 1}項
                                </span>
                              )}
                            </div>
                          </td>
                          {/* 規格 */}
                          <td className="py-3 px-3 text-slate-600 font-mono whitespace-nowrap">
                            {firstItem?.spec || '—'}
                          </td>
                          {/* 單位 */}
                          <td className="py-3 px-3 text-center text-slate-600 whitespace-nowrap font-medium">
                            {firstItem?.unit || '式'}
                          </td>
                          {/* 數量 */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                            {firstItem ? Number(firstItem.quantity).toLocaleString() : 0}
                          </td>
                          {/* 單價 */}
                          <td className="py-3 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                            ${firstItem ? Number(firstItem.unitPrice).toLocaleString() : 0}
                          </td>
                          {/* 未稅金額 */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700 tabular-nums whitespace-nowrap">
                            ${r.totalAmount.toLocaleString()}
                          </td>
                          {/* 現場點收狀態 */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {r.status === 'POSTED' && (
                              <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>現場已點收</span>
                              </span>
                            )}
                            {r.status === 'DRAFT' && (
                              <span className="bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded border border-amber-200">
                                待點收草稿
                              </span>
                            )}
                            {r.status === 'VOIDED' && (
                              <span className="bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded border border-slate-300">
                                已作廢
                              </span>
                            )}
                          </td>
                          {/* 操作按鈕 (支援單獨編輯修改) */}
                          <td
                            className="py-3 px-4 text-right whitespace-nowrap"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 草稿載入極速打單按鈕 */}
                              {canWrite && r.status === 'DRAFT' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInitialDraftToLoad(r);
                                    setIsExcelGridModalOpen(true);
                                  }}
                                  className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs border border-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                                  title="載入至極速打單工作台連續編輯"
                                >
                                  <FileSpreadsheet className="w-3 h-3 text-amber-600" />
                                  <span>極速打單</span>
                                </button>
                              )}
                              {/* 單獨點選修改按鈕 */}
                              {canWrite && r.billingStatus !== 'BILLED' && (
                                <button
                                  onClick={() => handleOpenEditModal(r)}
                                  className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 flex items-center gap-1 cursor-pointer transition-colors"
                                  title="單獨修改此進貨簽收單內容"
                                >
                                  <Edit className="w-3 h-3" />
                                  <span>修改</span>
                                </button>
                              )}

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
                                title="列印簽收單"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {r.status === 'DRAFT' && canApprove && (
                                <button
                                  onClick={() => handlePostReceipt(r)}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
                                  title="確認現場點收簽收"
                                >
                                  確認簽收
                                </button>
                              )}

                              {r.status === 'DRAFT' && canWrite && (
                                <button
                                  onClick={() => handleOpenDeleteModal(r)}
                                  className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors"
                                  title="刪除草稿"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {r.status === 'POSTED' && r.billingStatus === 'PENDING_BILLING' && canWrite && (
                                <button
                                  onClick={() => handleOpenVoidModal(r)}
                                  className="px-1.5 py-0.5 text-rose-600 hover:bg-rose-50 rounded text-[11px] border border-rose-200 cursor-pointer"
                                  title="作廢單據"
                                >
                                  作廢
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* 多項物料展開列 */}
                        {isExpanded && itemsCount > 1 && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={13} className="p-3 pl-12">
                              <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs">
                                <div className="text-[11px] font-bold text-slate-700 mb-2">
                                  全部物料清單 ({itemsCount} 項)：
                                </div>
                                <div className="divide-y divide-slate-100 text-xs">
                                  {(r.items || []).map((it, idx) => (
                                    <div key={it.id || idx} className="py-1.5 flex items-center justify-between text-slate-700">
                                      <div className="flex items-center gap-3">
                                        <span className="font-mono text-slate-400">#{idx + 1}</span>
                                        <span className="font-bold text-slate-900">{it.itemName}</span>
                                        <span className="text-slate-500 font-mono">{it.spec || '—'}</span>
                                      </div>
                                      <div className="flex items-center gap-4 font-mono">
                                        <span>{Number(it.quantity)} {it.unit}</span>
                                        <span className="text-slate-500">@ ${Number(it.unitPrice).toLocaleString()}</span>
                                        <span className="font-bold text-indigo-700">${Number(it.lineTotal).toLocaleString()}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 📝 新增 / 編輯單筆進貨簽收單 Modal (支援草稿與正式簽收兩種存檔)  */}
      {/* ------------------------------------------------------------- */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-400/30">
                  <PackageCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {formData.id ? '編輯現場進貨簽收單' : '新增現場進貨簽收單'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    A 模式直入案場成本 · 可儲存為草稿隨時再改，或正式確認簽收
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 表單內容 */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    歸屬工區案場 (直入成本) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.projectId}
                    onChange={e => {
                      const val = e.target.value;
                      const matchedAsset = internalAssets.find(a => a.id === val);
                      if (matchedAsset) {
                        setFormData({
                          ...formData,
                          projectId: val,
                          projectNameSnapshot: matchedAsset.name,
                          projectCodeSnapshot: matchedAsset.code,
                        } as any);
                      } else {
                        const prj = projects.find(p => p.id === val);
                        setFormData({
                          ...formData,
                          projectId: val,
                          projectNameSnapshot: prj?.name,
                          projectCodeSnapshot: prj?.projectCode,
                        } as any);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">請選擇專案案場或廠內資產</option>
                    <optgroup label="🏗️ 施工工程案場">
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.projectCode})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="🚚 廠內自用 / 車輛資產與公共儲備">
                      {internalAssets.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.code})
                        </option>
                      ))}
                    </optgroup>
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
                        {v.name} {v.taxId ? `(${v.taxId})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    廠商紙本送貨單號 / 簽收單號 <span className="text-rose-500">*</span>
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
                    現場簽收日期 <span className="text-rose-500">*</span>
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

              {/* 物料明細分欄表格 */}
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
                        <th className="py-2.5 px-3 w-20 text-center">單位</th>
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
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-900"
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
                          <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700 tabular-nums">
                            ${(Number(item.lineTotal) || 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="車號/備忘"
                              value={item.notes || ''}
                              onChange={e => handleItemChange(index, 'notes', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(index)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
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
                可儲存為草稿隨時再改，或確認簽收歸檔供會計核對
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  取消
                </button>

                {/* 儲存草稿按鈕 (草稿功能) */}
                <button
                  type="button"
                  onClick={() => handleSaveReceipt(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="儲存為草稿，隨時可回來修改"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>💾 儲存為草稿</span>
                </button>

                {/* 正式點收簽收按鈕 */}
                <button
                  type="button"
                  onClick={() => handleSaveReceipt(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="現場點收無誤，正式簽收歸檔"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>✅ 儲存並確認簽收</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 👁️ 檢視詳情 Modal (含直接點選修改按鈕)                        */}
      {/* ------------------------------------------------------------- */}
      {isDetailModalOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white">現場進貨簽收單詳情</h3>
                <span className="font-mono text-xs text-indigo-300 bg-indigo-900/50 px-2 py-0.5 rounded border border-indigo-700/50">
                  {selectedReceipt.receiptNumber}
                </span>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block mb-0.5">廠商送貨單號</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {selectedReceipt.deliveryNoteNumber}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">簽收日期</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedReceipt.receivedDate}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">現場點收人</span>
                  <span className="font-bold text-slate-800">
                    {selectedReceipt.receivedBy || '現場人員'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">點收狀態</span>
                  <span className="font-bold text-emerald-700">
                    {selectedReceipt.status === 'POSTED' ? '現場已點收簽收' : selectedReceipt.status === 'DRAFT' ? '現場草稿' : '已作廢'}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className="text-slate-400 block mb-0.5">供料合作廠商</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedReceipt.vendorNameSnapshot} {selectedReceipt.vendorTaxIdSnapshot ? `(${selectedReceipt.vendorTaxIdSnapshot})` : ''}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className="text-slate-400 block mb-0.5">歸屬工區案場 (直入成本)</span>
                  <span className="font-bold text-indigo-700 text-sm">
                    {selectedReceipt.projectNameSnapshot}
                  </span>
                </div>
              </div>

              {selectedReceipt.attachmentFileName && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">現場簽收單拍照存證：</span>
                  <div className="flex items-center gap-1.5 text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-200">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{selectedReceipt.attachmentFileName}</span>
                  </div>
                </div>
              )}

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
                          <td className="py-2 px-3 font-bold text-slate-900">{it.itemName}</td>
                          <td className="py-2 px-3 text-slate-600">{it.spec || '—'}</td>
                          <td className="py-2 px-3 text-center text-slate-600 font-medium">{it.unit}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{it.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">${Number(it.unitPrice).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">${Number(it.lineTotal).toLocaleString()}</td>
                          <td className="py-2 px-3 text-slate-500">{it.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold border-t border-slate-200">
                        <td colSpan={6} className="py-2 px-3 text-right text-slate-700">合計未稅金額：</td>
                        <td className="py-2 px-3 text-right font-mono text-indigo-700">${Number(selectedReceipt.totalAmount).toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedReceipt.notes && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block mb-0.5">現場備註</span>
                  <p className="text-slate-700">{selectedReceipt.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                建立時間: {selectedReceipt.createdAt}
              </span>

              <div className="flex items-center gap-2">
                {/* 詳情內直接修改按鈕 */}
                {canWrite && selectedReceipt.billingStatus !== 'BILLED' && (
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenEditModal(selectedReceipt);
                    }}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="修改此張簽收單內容"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>編輯修改此單</span>
                  </button>
                )}

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
                  className="px-4 py-1.5 bg-slate-800 text-white hover:bg-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🖨️ 列印預覽 Modal */}
      {isPrintViewOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden print:m-0 print:border-none print:shadow-none animate-in fade-in">
            <div className="p-8 space-y-6">
              <div className="text-center border-b pb-4">
                <h2 className="text-xl font-bold tracking-wider text-slate-900">工程現場進貨簽收單</h2>
                <div className="text-xs text-slate-500 font-mono mt-1">
                  單號: {selectedReceipt.receiptNumber} | 送貨單號: {selectedReceipt.deliveryNoteNumber}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">供料廠商：</span>
                  <span className="font-bold text-slate-900">{selectedReceipt.vendorNameSnapshot}</span>
                </div>
                <div>
                  <span className="text-slate-500">歸屬案場：</span>
                  <span className="font-bold text-slate-900">{selectedReceipt.projectNameSnapshot}</span>
                </div>
                <div>
                  <span className="text-slate-500">進貨簽收日：</span>
                  <span className="font-mono text-slate-900">{selectedReceipt.receivedDate}</span>
                </div>
                <div>
                  <span className="text-slate-500">現場點收人員：</span>
                  <span className="font-bold text-slate-900">{selectedReceipt.receivedBy || '現場人員'}</span>
                </div>
              </div>

              <table className="w-full text-xs border border-slate-300">
                <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                  <tr>
                    <th className="p-2 border-r border-slate-300 text-center w-10">項</th>
                    <th className="p-2 border-r border-slate-300">品名</th>
                    <th className="p-2 border-r border-slate-300">規格</th>
                    <th className="p-2 border-r border-slate-300 text-center">單位</th>
                    <th className="p-2 border-r border-slate-300 text-right">數量</th>
                    <th className="p-2 border-r border-slate-300 text-right">單價</th>
                    <th className="p-2 text-right">小計</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(selectedReceipt.items || []).map((it, i) => (
                    <tr key={i}>
                      <td className="p-2 border-r border-slate-200 text-center font-mono">{i + 1}</td>
                      <td className="p-2 border-r border-slate-200 font-bold">{it.itemName}</td>
                      <td className="p-2 border-r border-slate-200">{it.spec || '-'}</td>
                      <td className="p-2 border-r border-slate-200 text-center">{it.unit}</td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono">{it.quantity}</td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono">${it.unitPrice.toLocaleString()}</td>
                      <td className="p-2 text-right font-mono font-bold">${it.lineTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-300 font-bold">
                    <td colSpan={6} className="p-2 text-right">合計未稅 (NT$)：</td>
                    <td className="p-2 text-right font-mono">${selectedReceipt.totalAmount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="grid grid-cols-3 gap-4 pt-8 text-xs border-t">
                <div className="border-t border-slate-400 pt-2 text-center text-slate-600">
                  供料司機簽收：_______________
                </div>
                <div className="border-t border-slate-400 pt-2 text-center text-slate-600">
                  現場點收人：_______________
                </div>
                <div className="border-t border-slate-400 pt-2 text-center text-slate-600">
                  工務所主管：_______________
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer"
              >
                列印此頁
              </button>
              <button
                onClick={() => setIsPrintViewOpen(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-300 cursor-pointer"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ 作廢確認 Modal */}
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                請輸入作廢原因說明：
              </label>
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
                onClick={() => setVoidModalTarget(null)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleConfirmVoid}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                確認作廢
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ 刪除草稿確認 Modal */}
      {deleteModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <Trash2 className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">確認刪除草稿進貨單</h3>
            </div>
            <p className="text-xs text-slate-600">
              此草稿單尚未點收簽收，確定要自資料庫完全移除嗎？
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteModalTarget(null)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};
