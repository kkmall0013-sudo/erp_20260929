// src/components/widgets/InternalAssetManagerModal.tsx
// 🚚 廠內自用資產與公務動產全生命週期維護中心 (Internal Fleet & Movable Asset Lifecycle Center)
// 支援全物件（車輛、機具、設施、公共備料）之「維修保養紀錄」、「以新換舊/純汰除報廢」與「生命週期總花費統計」
// 嚴格落實資產會計防呆：已具備進貨或維修履歷之資產禁止物理刪除，僅未實現購買或建檔錯誤才得刪除

import React, { useState, useMemo } from 'react';
import {
  Truck,
  Wrench,
  Package,
  Home,
  Plus,
  Trash2,
  Edit3,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  X,
  Save,
  Search,
  Filter,
  ArrowRightLeft,
  Calendar,
  User,
  ShieldCheck,
  Tag,
  DollarSign,
  FileText,
  Clock,
  History,
  AlertCircle,
  HelpCircle,
  Eye,
  Check,
  FileCheck2,
  Building2,
  BadgeAlert
} from 'lucide-react';
import {
  InternalAsset,
  AssetMaintenanceRecord,
  DEFAULT_INTERNAL_ASSETS,
  loadStoredInternalAssets,
  saveStoredInternalAssets
} from '../inbound/ExcelInboundGridModal';
import { getAllInboundReceipts } from '../../db/sqlite';

interface InternalAssetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssetsUpdated: () => void;
  triggerToast?: (msg: string, type?: 'success' | 'warn' | 'error') => void;
}

export const InternalAssetManagerModal: React.FC<InternalAssetManagerModalProps> = ({
  isOpen,
  onClose,
  onAssetsUpdated,
  triggerToast
}) => {
  const [assets, setAssets] = useState<InternalAsset[]>(() => loadStoredInternalAssets());
  const [activeTypeTab, setActiveTypeTab] = useState<'ALL' | 'VEHICLE' | 'EQUIPMENT' | 'CENTRAL_STOCK' | 'FACILITY'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'MAINTENANCE' | 'RETIRED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. 編輯 / 新增資產表單狀態
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<InternalAsset | null>(null);

  // 2. 汰換 / 汰除 / 報廢專用 Modal 狀態 (全物件適用)
  const [replaceTarget, setReplaceTarget] = useState<InternalAsset | null>(null);
  const [replaceMode, setReplaceMode] = useState<'REPLACE_WITH_NEW' | 'RETIRE_ONLY'>('REPLACE_WITH_NEW');
  const [retiredReason, setRetiredReason] = useState('');
  const [disposalMethod, setDisposalMethod] = useState<'SCRAPPED' | 'SOLD' | 'TRADE_IN' | 'DONATED' | 'STORED'>('SCRAPPED');
  const [salvageAmount, setSalvageAmount] = useState<number>(0);
  const [newAssetCode, setNewAssetCode] = useState('');
  const [newAssetName, setNewAssetName] = useState('');
  const [newLicensePlate, setNewLicensePlate] = useState('');
  const [newDriverOrCustodian, setNewDriverOrCustodian] = useState('');
  const [newPurchaseCost, setNewPurchaseCost] = useState<number>(0);

  // 3. 維修維護紀錄與全生命週期履歷 Modal
  const [maintenanceTarget, setMaintenanceTarget] = useState<InternalAsset | null>(null);
  const [maintenanceSubTab, setMaintenanceSubTab] = useState<'LOGS' | 'INBOUND' | 'PROFILE'>('LOGS');
  const [isAddingMaintenance, setIsAddingMaintenance] = useState(false);
  const [maintFormData, setMaintFormData] = useState<Partial<AssetMaintenanceRecord>>({
    recordDate: new Date().toISOString().slice(0, 10),
    maintenanceType: 'REGULAR',
    title: '',
    vendorName: '',
    cost: 0,
    invoiceNumber: '',
    mileageOrHours: '',
    status: 'COMPLETED',
    description: '',
    handledBy: ''
  });

  // 4. 防呆攔截確認 Modal
  const [blockedDeleteModal, setBlockedDeleteModal] = useState<{
    asset: InternalAsset;
    inboundCount: number;
    maintCount: number;
    totalSpend: number;
  } | null>(null);

  const [confirmDraftDeleteModal, setConfirmDraftDeleteModal] = useState<InternalAsset | null>(null);

  // 表單主欄位狀態
  const [formData, setFormData] = useState<Partial<InternalAsset>>({
    code: '',
    name: '',
    type: 'VEHICLE',
    categoryLabel: '🚚 廠內車輛',
    aliases: [],
    licensePlate: '',
    driverOrCustodian: '',
    status: 'ACTIVE',
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchaseCost: 0,
    notes: ''
  });
  const [aliasesInput, setAliasesInput] = useState('');

  // 讀取進貨簽收單
  const receipts = useMemo(() => {
    try {
      return getAllInboundReceipts();
    } catch {
      return [];
    }
  }, [isOpen]);

  // 統計進貨簽收單與此資產的關聯累計
  const assetUsageMap = useMemo(() => {
    const map = new Map<string, { count: number; totalAmount: number; receipts: typeof receipts }>();
    receipts.forEach(r => {
      if (r.isDeleted) return;
      const amount = Number(r.totalAmount) || 0;
      assets.forEach(a => {
        const isMatched =
          r.projectId === a.id ||
          r.projectId === a.code ||
          r.projectNameSnapshot === a.name ||
          (a.aliases && (
            a.aliases.includes(r.projectId || '') ||
            a.aliases.includes(r.projectNameSnapshot || '') ||
            a.aliases.includes((r as any).projectCodeSnapshot || '')
          ));
        if (isMatched) {
          const prev = map.get(a.id) || { count: 0, totalAmount: 0, receipts: [] };
          map.set(a.id, {
            count: prev.count + 1,
            totalAmount: prev.totalAmount + amount,
            receipts: [...prev.receipts, r]
          });
        }
      });
    });
    return map;
  }, [assets, receipts]);

  // 計算特定資產之生命週期花費
  const getAssetLifecycleStats = (asset: InternalAsset) => {
    const inbound = assetUsageMap.get(asset.id) || { count: 0, totalAmount: 0, receipts: [] };
    const maintList = asset.maintenanceRecords || [];
    const maintCost = maintList.reduce((acc, m) => acc + (Number(m.cost) || 0), 0);
    const purchaseCost = Number(asset.purchaseCost) || 0;
    const totalLifetimeSpend = purchaseCost + inbound.totalAmount + maintCost;
    return {
      purchaseCost,
      inboundCount: inbound.count,
      inboundAmount: inbound.totalAmount,
      inboundReceipts: inbound.receipts,
      maintCount: maintList.length,
      maintAmount: maintCost,
      maintList,
      totalLifetimeSpend
    };
  };

  // 篩選資產
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      if (activeTypeTab !== 'ALL' && a.type !== activeTypeTab) return false;
      const currentStatus = a.status || 'ACTIVE';
      if (statusFilter !== 'ALL' && currentStatus !== statusFilter) return false;

      if (searchTerm.trim()) {
        const kw = searchTerm.toLowerCase();
        const matchName = a.name.toLowerCase().includes(kw);
        const matchCode = a.code.toLowerCase().includes(kw);
        const matchPlate = (a.licensePlate || '').toLowerCase().includes(kw);
        const matchDriver = (a.driverOrCustodian || '').toLowerCase().includes(kw);
        const matchNotes = (a.notes || '').toLowerCase().includes(kw);
        const matchAlias = (a.aliases || []).some(al => al.toLowerCase().includes(kw));
        return matchName || matchCode || matchPlate || matchDriver || matchNotes || matchAlias;
      }
      return true;
    });
  }, [assets, activeTypeTab, statusFilter, searchTerm]);

  // 開啟新增資產表單
  const handleOpenCreate = () => {
    setEditingAsset(null);
    const defaultPrefix = activeTypeTab === 'VEHICLE' ? 'VEH' : activeTypeTab === 'EQUIPMENT' ? 'EQ' : activeTypeTab === 'CENTRAL_STOCK' ? 'STOCK' : 'FAC';
    setFormData({
      code: `${defaultPrefix}-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      type: activeTypeTab === 'ALL' ? 'VEHICLE' : activeTypeTab,
      categoryLabel:
        activeTypeTab === 'VEHICLE'
          ? '🚚 廠內車輛'
          : activeTypeTab === 'EQUIPMENT'
          ? '🚜 重型機具'
          : activeTypeTab === 'CENTRAL_STOCK'
          ? '📦 常備庫存'
          : '🏠 廠區修繕',
      aliases: [],
      licensePlate: '',
      driverOrCustodian: '',
      status: 'ACTIVE',
      purchaseDate: new Date().toISOString().slice(0, 10),
      purchaseCost: 0,
      notes: ''
    });
    setAliasesInput('');
    setIsFormOpen(true);
  };

  // 開啟編輯資產表單
  const handleOpenEdit = (asset: InternalAsset) => {
    setEditingAsset(asset);
    setFormData({ ...asset });
    setAliasesInput((asset.aliases || []).join(', '));
    setIsFormOpen(true);
  };

  // 儲存資產主檔
  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      if (triggerToast) triggerToast('請填寫資產名稱', 'warn');
      return;
    }
    if (!formData.code?.trim()) {
      if (triggerToast) triggerToast('請填寫資產代碼', 'warn');
      return;
    }

    const parsedAliases = aliasesInput
      .split(/[,，\s]+/)
      .map(s => s.trim())
      .filter(Boolean);

    // 若為車輛且有車牌，自動納入純數字別名
    if (formData.licensePlate) {
      const cleanPlate = formData.licensePlate.trim();
      const pureDigits = cleanPlate.replace(/[^a-zA-Z0-9]/g, '');
      if (!parsedAliases.includes(cleanPlate)) parsedAliases.push(cleanPlate);
      if (pureDigits && !parsedAliases.includes(pureDigits)) parsedAliases.push(pureDigits);
    }

    let updatedList: InternalAsset[] = [];

    if (editingAsset) {
      updatedList = assets.map(a => {
        if (a.id === editingAsset.id) {
          return {
            ...a,
            ...formData,
            purchaseCost: Number(formData.purchaseCost) || 0,
            aliases: Array.from(new Set([...(formData.aliases || []), ...parsedAliases])),
          } as InternalAsset;
        }
        return a;
      });
      if (triggerToast) triggerToast(`✓ 廠內資產【${formData.name}】資料已成功更新！`, 'success');
    } else {
      const newId = `asset-${formData.type?.toLowerCase()}-${Date.now().toString().slice(-6)}`;
      const newAsset: InternalAsset = {
        id: newId,
        code: formData.code.trim(),
        name: formData.name.trim(),
        type: formData.type || 'VEHICLE',
        categoryLabel:
          formData.type === 'VEHICLE'
            ? '🚚 廠內車輛'
            : formData.type === 'EQUIPMENT'
            ? '🚜 重型機具'
            : formData.type === 'CENTRAL_STOCK'
            ? '📦 常備庫存'
            : '🏠 廠區修繕',
        aliases: Array.from(new Set(parsedAliases)),
        licensePlate: formData.licensePlate?.trim(),
        driverOrCustodian: formData.driverOrCustodian?.trim(),
        status: formData.status || 'ACTIVE',
        purchaseDate: formData.purchaseDate || new Date().toISOString().slice(0, 10),
        purchaseCost: Number(formData.purchaseCost) || 0,
        notes: formData.notes?.trim() || '',
        maintenanceRecords: [],
        createdAt: new Date().toISOString().slice(0, 10)
      };
      updatedList = [newAsset, ...assets];
      if (triggerToast) triggerToast(`✓ 廠內新資產【${newAsset.name}】已成功建檔入庫！`, 'success');
    }

    setAssets(updatedList);
    saveStoredInternalAssets(updatedList);
    setIsFormOpen(false);
    onAssetsUpdated();
  };

  // --------------------------------------------------------------------------
  // 🔄 全物件汰換 / 汰除 / 報廢作業流程 (以新換舊 vs 純汰除除役)
  // --------------------------------------------------------------------------
  const handleOpenRetireModal = (asset: InternalAsset) => {
    setReplaceTarget(asset);
    setReplaceMode('REPLACE_WITH_NEW');
    setRetiredReason('達到使用折舊年限 / 重大維修耗損');
    setDisposalMethod('SCRAPPED');
    setSalvageAmount(0);

    // 預設接替新物件欄位
    if (asset.type === 'VEHICLE') {
      setNewAssetCode(`VEH-${Math.floor(100 + Math.random() * 900)}`);
      setNewAssetName('');
      setNewLicensePlate('');
      setNewDriverOrCustodian(asset.driverOrCustodian || '');
    } else {
      setNewAssetCode(`${asset.code.split('-')[0] || 'EQ'}-${Math.floor(100 + Math.random() * 900)}`);
      setNewAssetName(`新代購置 - ${asset.name}`);
      setNewLicensePlate('');
      setNewDriverOrCustodian(asset.driverOrCustodian || '');
    }
    setNewPurchaseCost(0);
  };

  const handleExecuteRetire = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceTarget) return;

    const retiredId = replaceTarget.id;
    const nowStr = new Date().toISOString().slice(0, 10);
    let nextList = [...assets];
    let createdNewAsset: InternalAsset | null = null;

    // 若選擇「以新換舊」且使用者有填寫新資產名稱/代碼
    if (replaceMode === 'REPLACE_WITH_NEW') {
      const cleanName = newAssetName.trim() || (newLicensePlate ? `廠內貨車 [${newLicensePlate.trim()}]` : `新接替項目 (${replaceTarget.name})`);
      const cleanCode = newAssetCode.trim() || `${replaceTarget.type === 'VEHICLE' ? 'VEH' : 'EQ'}-${Math.floor(100 + Math.random() * 900)}`;
      const cleanPlate = newLicensePlate.trim();
      const pureDigits = cleanPlate ? cleanPlate.replace(/[^a-zA-Z0-9]/g, '') : '';
      const aliases = [cleanPlate, pureDigits, cleanName].filter(Boolean);

      const newId = `asset-${replaceTarget.type.toLowerCase()}-${Date.now().toString().slice(-6)}`;
      createdNewAsset = {
        id: newId,
        code: cleanCode,
        name: cleanName,
        type: replaceTarget.type,
        categoryLabel: replaceTarget.categoryLabel,
        aliases: Array.from(new Set(aliases)),
        licensePlate: cleanPlate || undefined,
        driverOrCustodian: newDriverOrCustodian.trim() || replaceTarget.driverOrCustodian || '',
        status: 'ACTIVE',
        purchaseDate: nowStr,
        purchaseCost: Number(newPurchaseCost) || 0,
        notes: `由舊資產【${replaceTarget.name}】汰換接替 (${nowStr})`,
        maintenanceRecords: [],
        createdAt: nowStr
      };
    }

    // 1. 將舊資產標記為 RETIRED，記錄汰除履歷
    nextList = nextList.map(a => {
      if (a.id === retiredId) {
        return {
          ...a,
          name: a.name.includes('(已汰除)') || a.name.includes('(已報廢)')
            ? a.name
            : `${a.name} (已汰除)`,
          status: 'RETIRED' as const,
          retiredDate: nowStr,
          retiredReason: retiredReason.trim() || '使用年限屆滿除役',
          disposalMethod: disposalMethod,
          salvageAmount: Number(salvageAmount) || 0,
          replacedByAssetId: createdNewAsset ? createdNewAsset.id : undefined,
          replacedByAssetName: createdNewAsset ? createdNewAsset.name : undefined,
          notes: `${a.notes ? a.notes + ' | ' : ''}[${nowStr} 除役: ${retiredReason.trim() || '汰換報廢'}${createdNewAsset ? `，由【${createdNewAsset.name}】接棒` : ''}]`
        };
      }
      return a;
    });

    // 2. 若有新建接替物件，插入清冊
    if (createdNewAsset) {
      nextList = [createdNewAsset, ...nextList];
      if (triggerToast) {
        triggerToast(`✓ 舊物件【${replaceTarget.name}】已標記汰換存檔，並自動建立接棒新資產【${createdNewAsset.name}】！`, 'success');
      }
    } else {
      if (triggerToast) {
        triggerToast(`✓ 物件【${replaceTarget.name}】已成功執行汰除除役程序，歷史帳目與履歷全數永久保留！`, 'success');
      }
    }

    setAssets(nextList);
    saveStoredInternalAssets(nextList);
    setReplaceTarget(null);
    onAssetsUpdated();
  };

  // --------------------------------------------------------------------------
  // 🔧 維修保養紀錄與歷程管理
  // --------------------------------------------------------------------------
  const handleOpenMaintenance = (asset: InternalAsset) => {
    setMaintenanceTarget(asset);
    setMaintenanceSubTab('LOGS');
    setIsAddingMaintenance(false);
    setMaintFormData({
      recordDate: new Date().toISOString().slice(0, 10),
      maintenanceType: 'REGULAR',
      title: '',
      vendorName: '',
      cost: 0,
      invoiceNumber: '',
      mileageOrHours: '',
      status: 'COMPLETED',
      description: '',
      handledBy: asset.driverOrCustodian || ''
    });
  };

  const handleSaveMaintenanceRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceTarget) return;
    if (!maintFormData.title?.trim()) {
      if (triggerToast) triggerToast('請輸入維修保養項目簡述', 'warn');
      return;
    }

    const newRecord: AssetMaintenanceRecord = {
      id: `maint-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      assetId: maintenanceTarget.id,
      recordDate: maintFormData.recordDate || new Date().toISOString().slice(0, 10),
      maintenanceType: maintFormData.maintenanceType || 'REGULAR',
      title: maintFormData.title.trim(),
      vendorName: maintFormData.vendorName?.trim() || '外包修配廠商',
      cost: Number(maintFormData.cost) || 0,
      invoiceNumber: maintFormData.invoiceNumber?.trim() || '',
      mileageOrHours: maintFormData.mileageOrHours?.trim() || '',
      status: maintFormData.status || 'COMPLETED',
      description: maintFormData.description?.trim() || '',
      handledBy: maintFormData.handledBy?.trim() || maintenanceTarget.driverOrCustodian || '',
      createdAt: new Date().toISOString()
    };

    const nextList = assets.map(a => {
      if (a.id === maintenanceTarget.id) {
        const records = [newRecord, ...(a.maintenanceRecords || [])];
        const newStatus = maintFormData.status === 'IN_PROGRESS' ? ('MAINTENANCE' as const) : a.status;
        return {
          ...a,
          status: newStatus,
          maintenanceRecords: records
        };
      }
      return a;
    });

    setAssets(nextList);
    saveStoredInternalAssets(nextList);
    const updatedTarget = nextList.find(a => a.id === maintenanceTarget.id) || null;
    setMaintenanceTarget(updatedTarget);
    setIsAddingMaintenance(false);
    if (triggerToast) triggerToast(`✓ 已成功記錄【${maintenanceTarget.name}】維修保養項目：${newRecord.title} (NT$ ${newRecord.cost.toLocaleString()})`, 'success');
    onAssetsUpdated();
  };

  const handleDeleteMaintenanceRecord = (recordId: string) => {
    if (!maintenanceTarget) return;
    if (!window.confirm('確定要刪除此筆維修保養紀錄嗎？')) return;

    const nextList = assets.map(a => {
      if (a.id === maintenanceTarget.id) {
        return {
          ...a,
          maintenanceRecords: (a.maintenanceRecords || []).filter(r => r.id !== recordId)
        };
      }
      return a;
    });

    setAssets(nextList);
    saveStoredInternalAssets(nextList);
    const updatedTarget = nextList.find(a => a.id === maintenanceTarget.id) || null;
    setMaintenanceTarget(updatedTarget);
    if (triggerToast) triggerToast('已刪除指定維修紀錄', 'success');
    onAssetsUpdated();
  };

  // --------------------------------------------------------------------------
  // 🗑️ 刪除資產之法律防呆驗證 (有紀錄禁止刪除，僅未實現購買或建檔錯誤才得刪除)
  // --------------------------------------------------------------------------
  const handleDeleteAssetAttempt = (asset: InternalAsset) => {
    const stats = getAssetLifecycleStats(asset);

    // 嚴格攔截：有進貨單 OR 有維修紀錄
    if (stats.inboundCount > 0 || stats.maintCount > 0) {
      setBlockedDeleteModal({
        asset,
        inboundCount: stats.inboundCount,
        maintCount: stats.maintCount,
        totalSpend: stats.inboundAmount + stats.maintAmount
      });
      return;
    }

    // 若完全為零紀錄，才開啟預建/錯誤草稿刪除確認
    setConfirmDraftDeleteModal(asset);
  };

  const handleConfirmDraftDelete = () => {
    if (!confirmDraftDeleteModal) return;
    const target = confirmDraftDeleteModal;
    const nextList = assets.filter(a => a.id !== target.id);
    setAssets(nextList);
    saveStoredInternalAssets(nextList);
    setConfirmDraftDeleteModal(null);
    if (triggerToast) triggerToast(`已刪除建檔錯誤或未購入之預建資產【${target.name}】`, 'success');
    onAssetsUpdated();
  };

  // 重置回預設資產庫
  const handleResetToDefaults = () => {
    if (!window.confirm('確定要還原為系統初始預設的廠內資產與車輛清單嗎？（自訂新增之項目將被重置）')) return;
    setAssets(DEFAULT_INTERNAL_ASSETS);
    saveStoredInternalAssets(DEFAULT_INTERNAL_ASSETS);
    if (triggerToast) triggerToast('已還原為初始預設廠內資產清單', 'success');
    onAssetsUpdated();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden my-auto">
        
        {/* 頂部 Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  廠內自用動產與公務車輛維護中心 (生命週期履歷)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                  SSoT 動產防斷鏈
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                公司動產生命週期管理 · 支援「維修維護紀錄」、「全物件以新換舊 / 汰除除役」與「累計歷史耗資統計」
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>新增動產/廠內資產</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="關閉視窗"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 實務指南說明 Banner */}
        <div className="px-6 py-2.5 bg-indigo-50/80 border-b border-indigo-200 text-xs text-indigo-950 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-bold">公司動產嚴格管理原則：</span>
            動產入列後擁有完整生命週期與維護履歷，<strong>凡曾有關聯進貨單或維修單者，依法規與會計原則嚴禁物理刪除</strong>。
            車輛、機具或設備老舊時，請點擊「<strong>🔄 汰換/除役</strong>」；送修保養請點擊「<strong>🔧 維修與履歷</strong>」，系統永久追蹤該物件累積花費與零件紀錄！
          </div>
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline shrink-0 cursor-pointer"
            title="還原為系統初始預設"
          >
            還原預設
          </button>
        </div>

        {/* 工具列：分類分頁、搜尋、狀態切換 */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          
          {/* 類別分頁切換 */}
          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTypeTab('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTypeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              全部物件 ({assets.length})
            </button>
            <button
              onClick={() => setActiveTypeTab('VEHICLE')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                activeTypeTab === 'VEHICLE'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>公務車輛 ({assets.filter(a => a.type === 'VEHICLE').length})</span>
            </button>
            <button
              onClick={() => setActiveTypeTab('EQUIPMENT')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                activeTypeTab === 'EQUIPMENT'
                  ? 'bg-white text-amber-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>重型機具 ({assets.filter(a => a.type === 'EQUIPMENT').length})</span>
            </button>
            <button
              onClick={() => setActiveTypeTab('CENTRAL_STOCK')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                activeTypeTab === 'CENTRAL_STOCK'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>常備庫存 ({assets.filter(a => a.type === 'CENTRAL_STOCK').length})</span>
            </button>
            <button
              onClick={() => setActiveTypeTab('FACILITY')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                activeTypeTab === 'FACILITY'
                  ? 'bg-white text-purple-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>廠務設施 ({assets.filter(a => a.type === 'FACILITY').length})</span>
            </button>
          </div>

          {/* 搜尋與狀態篩選 */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜尋名稱、車牌、別名、保管人..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700"
            >
              <option value="ALL">全部運作狀態</option>
              <option value="ACTIVE">✅ 現役服役中</option>
              <option value="MAINTENANCE">🔧 保養檢修中</option>
              <option value="RETIRED">📦 已汰除/報廢 (保留歷程)</option>
            </select>
          </div>
        </div>

        {/* 資產清單表格 */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredAssets.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
              查無符合篩選條件之廠內自用動產或公務資產。
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[210px]">資產全名 / 車牌機號</th>
                    <th className="py-2.5 px-3 w-28 text-center">資產代碼</th>
                    <th className="py-2.5 px-3 w-24">分類</th>
                    <th className="py-2.5 px-3 min-w-[150px]">快速比對別名</th>
                    <th className="py-2.5 px-3 w-24">保管人/司機</th>
                    <th className="py-2.5 px-3 w-24 text-center">運作狀態</th>
                    <th className="py-2.5 px-3 w-32 text-right">進料 / 維修總耗資</th>
                    <th className="py-2.5 px-3 w-44 text-center">動產生命週期管理</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssets.map((asset, idx) => {
                    const stats = getAssetLifecycleStats(asset);
                    const currentStatus = asset.status || 'ACTIVE';
                    const isRetired = currentStatus === 'RETIRED';
                    const hasRecords = stats.inboundCount > 0 || stats.maintCount > 0;

                    return (
                      <tr
                        key={asset.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isRetired ? 'bg-slate-50/60 text-slate-400' : 'text-slate-800'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                              {asset.type === 'VEHICLE' && <Truck className="w-4 h-4 text-indigo-600 shrink-0" />}
                              {asset.type === 'EQUIPMENT' && <Wrench className="w-4 h-4 text-amber-600 shrink-0" />}
                              {asset.type === 'CENTRAL_STOCK' && <Package className="w-4 h-4 text-emerald-600 shrink-0" />}
                              {asset.type === 'FACILITY' && <Home className="w-4 h-4 text-purple-600 shrink-0" />}
                              <span>{asset.name}</span>
                            </span>

                            {asset.licensePlate && (
                              <span className="font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 text-[10px] font-bold shrink-0">
                                {asset.licensePlate}
                              </span>
                            )}
                          </div>
                          {asset.notes && (
                            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                              {asset.notes}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                          {asset.code}
                        </td>
                        <td className="py-2.5 px-3 font-medium">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                            {asset.categoryLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(asset.aliases || []).map((al, aIdx) => (
                              <span
                                key={aIdx}
                                className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono border border-slate-200"
                              >
                                {al}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">
                          {asset.driverOrCustodian ? (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{asset.driverOrCustodian}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {currentStatus === 'ACTIVE' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              現役服役中
                            </span>
                          )}
                          {currentStatus === 'MAINTENANCE' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                              <Wrench className="w-3 h-3 text-amber-600" />
                              檢修保養中
                            </span>
                          )}
                          {currentStatus === 'RETIRED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300">
                              已除役/汰換
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <div className="font-bold text-indigo-700">
                            NT$ {stats.totalLifetimeSpend.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1.5 mt-0.5">
                            <span>進料:{stats.inboundCount}筆</span>
                            <span>·</span>
                            <span>維修:{stats.maintCount}次</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* 🔧 維修與生命週期履歷按鈕 (所有物件均可開啟) */}
                            <button
                              type="button"
                              onClick={() => handleOpenMaintenance(asset)}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="查看全生命週期耗資總計、歷次維修保養單與現場進料明細"
                            >
                              <Wrench className="w-3 h-3 text-blue-600" />
                              <span>維修/履歷</span>
                            </button>

                            {/* 🔄 全物件汰換 / 汰除 / 報廢按鈕 */}
                            {!isRetired ? (
                              <button
                                type="button"
                                onClick={() => handleOpenRetireModal(asset)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                title="老舊或損壞資產汰換（可無縫接替新機/新車，或純粹除役報廢）"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-amber-700" />
                                <span>汰換/除役</span>
                              </button>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 text-[10px] font-mono rounded border border-slate-200">
                                已除役
                              </span>
                            )}

                            {/* ✏️ 編輯按鈕 */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(asset)}
                              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="編輯動產主檔資料"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* 🗑️ 刪除按鈕 (具備防呆機制：有紀錄者嚴禁刪除) */}
                            <button
                              type="button"
                              onClick={() => handleDeleteAssetAttempt(asset)}
                              className={`p-1 rounded transition-colors ${
                                hasRecords
                                  ? 'text-slate-300 hover:text-rose-400 hover:bg-rose-50 cursor-pointer'
                                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                              }`}
                              title={
                                hasRecords
                                  ? '已有進貨或維修花費紀錄，點擊查看防呆說明'
                                  : '建檔錯誤或預計購買未購入，可刪除預建資料'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 底部總覽狀態列 */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>現役服役：<strong className="text-emerald-700">{assets.filter(a => (a.status || 'ACTIVE') === 'ACTIVE').length}</strong> 項</span>
            <span>檢修中：<strong className="text-amber-700">{assets.filter(a => a.status === 'MAINTENANCE').length}</strong> 項</span>
            <span>已汰除報廢：<strong className="text-slate-600">{assets.filter(a => a.status === 'RETIRED').length}</strong> 項（歷史帳目完整留存）</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
          >
            完成並關閉
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 📝 1. 新增 / 編輯 資產表單 Modal */}
      {/* ------------------------------------------------------------- */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm">
                  {editingAsset ? '編輯廠內自用動產項目' : '新增廠內自用動產項目'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    資產類型分類 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={e => {
                      const t = e.target.value as any;
                      setFormData({
                        ...formData,
                        type: t,
                        categoryLabel:
                          t === 'VEHICLE'
                            ? '🚚 廠內車輛'
                            : t === 'EQUIPMENT'
                            ? '🚜 重型機具'
                            : t === 'CENTRAL_STOCK'
                            ? '📦 常備庫存'
                            : '🏠 廠區修繕'
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="VEHICLE">🚚 廠內公務車輛 (貨車/公務車)</option>
                    <option value="EQUIPMENT">🚜 重型施工機具 (怪手/堆高機/發電機)</option>
                    <option value="FACILITY">🏠 廠區公共修繕 (屋頂/鐵捲門/水電)</option>
                    <option value="CENTRAL_STOCK">📦 廠內公共儲備庫存 (通用耗材備料)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    系統識別代碼 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如: VEH-358、EQ-PC200"
                    value={formData.code || ''}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  資產顯示全名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="如: 廠內貨車 [358-AB]、PC-200 挖土機 (怪手)"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  required
                />
              </div>

              {formData.type === 'VEHICLE' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      車牌號碼 (車輛專用)
                    </label>
                    <input
                      type="text"
                      placeholder="如: 358-AB"
                      value={formData.licensePlate || ''}
                      onChange={e => setFormData({ ...formData, licensePlate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      專責司機 / 保管人員
                    </label>
                    <input
                      type="text"
                      placeholder="如: 陳司機 或 公務組"
                      value={formData.driverOrCustodian || ''}
                      onChange={e => setFormData({ ...formData, driverOrCustodian: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      保管人 / 專責維修技師
                    </label>
                    <input
                      type="text"
                      placeholder="如: 機械組 / 廠務組"
                      value={formData.driverOrCustodian || ''}
                      onChange={e => setFormData({ ...formData, driverOrCustodian: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      原始購入金額 (選填)
                    </label>
                    <input
                      type="number"
                      placeholder="NT$"
                      value={formData.purchaseCost || 0}
                      onChange={e => setFormData({ ...formData, purchaseCost: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>常用辨識別名 (以逗點或空格分隔)</span>
                  <span className="text-[10px] text-slate-400 font-normal">現場登打時輸入別名系統會精準自動對齊</span>
                </label>
                <input
                  type="text"
                  placeholder="如: 358, 358-AB, 怪手, 叉車, 堆高機"
                  value={aliasesInput}
                  onChange={e => setAliasesInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    購置 / 啟用日期
                  </label>
                  <input
                    type="date"
                    value={formData.purchaseDate || ''}
                    onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    運作狀態
                  </label>
                  <select
                    value={formData.status || 'ACTIVE'}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="ACTIVE">✅ 現役服役中 (可於進貨單選取)</option>
                    <option value="MAINTENANCE">🔧 保養檢修中 (暫時送修)</option>
                    <option value="RETIRED">📦 已除役/汰除 (日常選單隱藏，保留歷程)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  備註說明
                </label>
                <textarea
                  rows={2}
                  placeholder="備註規格、購置年份、固定配合修配廠等備忘..."
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>儲存資產資料</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 🔄 2. 全物件汰換 / 汰除 / 報廢作業彈窗 (以新換舊 vs 純汰除除役) */}
      {/* ------------------------------------------------------------- */}
      {replaceTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/55 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-amber-200" />
                <h3 className="font-bold text-sm">
                  動產汰換 / 汰除除役作業程序
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReplaceTarget(null)}
                className="text-amber-200 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteRetire} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="text-[11px] text-slate-500 font-medium">即將汰除 / 報廢之動產標的：</div>
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>{replaceTarget.name}</span>
                  <span className="font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                    代碼: {replaceTarget.code}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  ⚠️ 汰除除役後，歷史進貨簽收單與維修花費依然 100% 留存於系統，日常新打單選單自動隱藏。
                </p>
              </div>

              {/* 汰除模式切換 */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  選擇汰換作業類型：
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReplaceMode('REPLACE_WITH_NEW')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      replaceMode === 'REPLACE_WITH_NEW'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold ring-1 ring-indigo-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-indigo-600" />
                      <span>以新換舊 (換代購置)</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      除役舊物，同時建立接替新資產
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReplaceMode('RETIRE_ONLY')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      replaceMode === 'RETIRE_ONLY'
                        ? 'border-amber-600 bg-amber-50/70 text-amber-900 font-bold ring-1 ring-amber-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>純粹汰除 (除役報廢)</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      老舊報廢不換新，保留歷史帳目
                    </div>
                  </button>
                </div>
              </div>

              {/* 汰除原因與處分方式 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    汰除 / 報廢處分方式
                  </label>
                  <select
                    value={disposalMethod}
                    onChange={e => setDisposalMethod(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                  >
                    <option value="SCRAPPED">報廢報拆 / 殘值回收</option>
                    <option value="SOLD">二手變賣轉讓</option>
                    <option value="TRADE_IN">購置新機舊換新折抵</option>
                    <option value="STORED">停用封存留廠備料</option>
                    <option value="DONATED">無償贈與或移轉</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    處分變賣 / 殘值回收金額
                  </label>
                  <input
                    type="number"
                    placeholder="NT$ (無可填 0)"
                    value={salvageAmount}
                    onChange={e => setSalvageAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  汰換 / 報廢原因說明 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="如: 車齡已高、引擎大修不符效益、專案結束除役等"
                  value={retiredReason}
                  onChange={e => setRetiredReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                  required
                />
              </div>

              {/* 若選擇「以新換舊」，填寫新資產資料 */}
              {replaceMode === 'REPLACE_WITH_NEW' && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5 mb-2">
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>接替新資產規格資料（自動建立並串連履歷）：</span>
                  </div>

                  <div className="space-y-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          接替新物件代碼 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newAssetCode}
                          onChange={e => setNewAssetCode(e.target.value)}
                          placeholder="如: VEH-889、EQ-PC300"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-mono font-bold text-xs"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          新物件顯示名稱 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newAssetName}
                          onChange={e => setNewAssetName(e.target.value)}
                          placeholder={replaceTarget.type === 'VEHICLE' ? '如: 廠內貨車 [889-CD]' : '如: CAT-320 挖掘機'}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-bold text-xs"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {replaceTarget.type === 'VEHICLE' ? (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            新車車牌號碼
                          </label>
                          <input
                            type="text"
                            value={newLicensePlate}
                            onChange={e => setNewLicensePlate(e.target.value)}
                            placeholder="如: 889-CD"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-mono uppercase font-bold text-xs"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            新購置成本 (NT$)
                          </label>
                          <input
                            type="number"
                            value={newPurchaseCost}
                            onChange={e => setNewPurchaseCost(Number(e.target.value))}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-mono text-xs"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          保管人員 / 司機 / 經辦
                        </label>
                        <input
                          type="text"
                          value={newDriverOrCustodian}
                          onChange={e => setNewDriverOrCustodian(e.target.value)}
                          placeholder="同仁姓名"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReplaceTarget(null)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>確認執行汰除除役</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 🔧 3. 維修維護紀錄與全生命週期履歷 Modal */}
      {/* ------------------------------------------------------------- */}
      {maintenanceTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      {maintenanceTarget.name}
                    </h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      代碼: {maintenanceTarget.code}
                    </span>
                    {maintenanceTarget.licensePlate && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-bold">
                        車牌: {maintenanceTarget.licensePlate}
                      </span>
                    )}
                    {maintenanceTarget.status === 'RETIRED' && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-bold">
                        已汰除報廢 (歷史留存)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    動產全生命週期耗資總成 · 歷次維修保養紀錄與現場材料進貨追溯
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMaintenanceTarget(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 生命週期耗資 KPI 指標看板 */}
            {(() => {
              const stats = getAssetLifecycleStats(maintenanceTarget);
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5 bg-slate-50 border-b border-slate-200 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-slate-500 text-[11px] font-semibold">原始購入成本</div>
                    <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                      NT$ {stats.purchaseCost.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      啟用日: {maintenanceTarget.purchaseDate || '未載'}
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-indigo-600 text-[11px] font-semibold">現場進料簽收成本</div>
                    <div className="text-lg font-bold font-mono text-indigo-700 mt-1">
                      NT$ {stats.inboundAmount.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-indigo-500 mt-0.5">
                      累積 {stats.inboundCount} 筆簽收單
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-blue-600 text-[11px] font-semibold">歷次維修保養花費</div>
                    <div className="text-lg font-bold font-mono text-blue-700 mt-1">
                      NT$ {stats.maintAmount.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-blue-500 mt-0.5">
                      累積 {stats.maintCount} 次維修工單
                    </div>
                  </div>

                  <div className="p-3 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200">
                    <div className="text-indigo-950 text-[11px] font-bold">全生命週期累積總支出</div>
                    <div className="text-xl font-bold font-mono text-indigo-900 mt-1">
                      NT$ {stats.totalLifetimeSpend.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-indigo-600 mt-0.5 font-medium">
                      購置 + 進料 + 保養
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 子分頁導航 */}
            <div className="px-6 border-b border-slate-200 bg-white flex items-center justify-between text-xs">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setMaintenanceSubTab('LOGS')}
                  className={`py-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    maintenanceSubTab === 'LOGS'
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>歷次維修保養工單 ({maintenanceTarget.maintenanceRecords?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMaintenanceSubTab('INBOUND')}
                  className={`py-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    maintenanceSubTab === 'INBOUND'
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>現場材料進貨清單 ({(assetUsageMap.get(maintenanceTarget.id)?.count || 0)})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMaintenanceSubTab('PROFILE')}
                  className={`py-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    maintenanceSubTab === 'PROFILE'
                      ? 'border-slate-800 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>動產履歷與除役資訊</span>
                </button>
              </div>

              {maintenanceSubTab === 'LOGS' && (
                <button
                  type="button"
                  onClick={() => setIsAddingMaintenance(!isAddingMaintenance)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingMaintenance ? '收合表單' : '登記維修保養單'}</span>
                </button>
              )}
            </div>

            {/* 子分頁內容 */}
            <div className="flex-1 overflow-y-auto p-6">
              
              {/* 分頁 1: 維修保養工單清單與登記表單 */}
              {maintenanceSubTab === 'LOGS' && (
                <div className="space-y-5">
                  {/* 新增維修表單 */}
                  {isAddingMaintenance && (
                    <form onSubmit={handleSaveMaintenanceRecord} className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3 animate-in fade-in duration-150 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-blue-200 font-bold text-blue-900">
                        <span>登記新維修保養工單：</span>
                        <span className="text-[11px] font-normal text-blue-700">記錄修配廠費用、更換零件與里程</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            維修/保養日期 <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={maintFormData.recordDate || ''}
                            onChange={e => setMaintFormData({ ...maintFormData, recordDate: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                            required
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            保養維護類別 <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={maintFormData.maintenanceType}
                            onChange={e => setMaintFormData({ ...maintFormData, maintenanceType: e.target.value as any })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                          >
                            <option value="REGULAR">定期保養 (換油/濾心/定檢)</option>
                            <option value="REPAIR">故障叫修 (臨時急修/漏油)</option>
                            <option value="OVERHAUL">重大翻修 (引擎/底盤大修)</option>
                            <option value="PARTS_REPLACEMENT">零件耗損更換 (輪胎/來令片/履帶)</option>
                            <option value="INSPECTION">監理法定檢驗 / 安全檢查</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            維修保養花費金額 (NT$) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={maintFormData.cost || 0}
                            onChange={e => setMaintFormData({ ...maintFormData, cost: Number(e.target.value) })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="block font-bold text-slate-700 mb-1">
                            維修保養項目主旨 <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="如: 8萬公里全車大保養、更換左右後輪剎車皮"
                            value={maintFormData.title || ''}
                            onChange={e => setMaintFormData({ ...maintFormData, title: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                            required
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            承修廠商 / 修配廠
                          </label>
                          <input
                            type="text"
                            placeholder="如: 台日汽車保養廠"
                            value={maintFormData.vendorName || ''}
                            onChange={e => setMaintFormData({ ...maintFormData, vendorName: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            維修發票號 / 工單單號
                          </label>
                          <input
                            type="text"
                            placeholder="如: INV-2026-009"
                            value={maintFormData.invoiceNumber || ''}
                            onChange={e => setMaintFormData({ ...maintFormData, invoiceNumber: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            當前里程數 / 運轉時數
                          </label>
                          <input
                            type="text"
                            placeholder="如: 88,500 km 或 1,200 小時"
                            value={maintFormData.mileageOrHours || ''}
                            onChange={e => setMaintFormData({ ...maintFormData, mileageOrHours: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            完工處理狀態
                          </label>
                          <select
                            value={maintFormData.status}
                            onChange={e => setMaintFormData({ ...maintFormData, status: e.target.value as any })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                          >
                            <option value="COMPLETED">✅ 已完工驗收</option>
                            <option value="IN_PROGRESS">🔧 進廠修繕中 (暫停出勤)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          故障原因與處理說明 (更換零件、材料明細)
                        </label>
                        <textarea
                          rows={2}
                          placeholder="更換之機油型號、更換油封規格、檢驗數值備忘..."
                          value={maintFormData.description || ''}
                          onChange={e => setMaintFormData({ ...maintFormData, description: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingMaintenance(false)}
                          className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>儲存維修紀錄</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* 歷次維修紀錄清單 */}
                  {(!maintenanceTarget.maintenanceRecords || maintenanceTarget.maintenanceRecords.length === 0) ? (
                    <div className="p-10 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                      此動產目前尚無維修保養紀錄。點擊上方「登記維修保養單」即可記錄保養換油、修配廠費用與更換材料。
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-slate-100">
                      {maintenanceTarget.maintenanceRecords.map(rec => (
                        <div key={rec.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-500 font-bold">
                                {rec.recordDate}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {rec.maintenanceType === 'REGULAR' ? '定期保養' : rec.maintenanceType === 'REPAIR' ? '故障搶修' : rec.maintenanceType === 'OVERHAUL' ? '重大翻修' : rec.maintenanceType === 'PARTS_REPLACEMENT' ? '零件更換' : '定期檢驗'}
                              </span>
                              <span className="font-bold text-slate-900 text-sm">
                                {rec.title}
                              </span>
                              {rec.status === 'IN_PROGRESS' ? (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  進廠處理中
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                                  已完工
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-slate-500 text-[11px]">
                              <span>承修廠: <strong className="text-slate-700">{rec.vendorName || '修配廠'}</strong></span>
                              {rec.invoiceNumber && <span>單據/發票: <strong className="font-mono text-slate-700">{rec.invoiceNumber}</strong></span>}
                              {rec.mileageOrHours && <span>里程/工時: <strong className="font-mono text-slate-700">{rec.mileageOrHours}</strong></span>}
                              {rec.handledBy && <span>經辦: {rec.handledBy}</span>}
                            </div>

                            {rec.description && (
                              <p className="text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px] mt-1 leading-relaxed">
                                {rec.description}
                              </p>
                            )}
                          </div>

                          <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0">
                            <div className="font-mono font-bold text-blue-700 text-sm">
                              NT$ {rec.cost.toLocaleString()}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteMaintenanceRecord(rec.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="刪除此筆維修紀錄"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 分頁 2: 現場材料進貨清單 */}
              {maintenanceSubTab === 'INBOUND' && (
                <div className="space-y-4">
                  {(() => {
                    const usage = assetUsageMap.get(maintenanceTarget.id);
                    if (!usage || usage.receipts.length === 0) {
                      return (
                        <div className="p-10 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                          目前尚無以【{maintenanceTarget.name}】名義簽收進場之物料簽收單。
                        </div>
                      );
                    }

                    return (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-slate-100 text-xs">
                        {usage.receipts.map(r => (
                          <div key={r.id} className="p-3.5 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900">
                                  {r.receiptNumber}
                                </span>
                                <span className="font-mono text-slate-500">
                                  {r.receivedDate}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                  廠商: {r.vendorNameSnapshot || '廠商'}
                                </span>
                                {r.deliveryNoteNumber && (
                                  <span className="font-mono text-slate-500 text-[11px]">
                                    送貨單: {r.deliveryNoteNumber}
                                  </span>
                                )}
                              </div>
                              <div className="font-mono font-bold text-indigo-700 text-sm">
                                NT$ {r.totalAmount.toLocaleString()}
                              </div>
                            </div>

                            {/* 物料項目明細 */}
                            <div className="mt-2 pl-3 border-l-2 border-indigo-200 space-y-1">
                              {(r.items || []).map((it, itIdx) => (
                                <div key={it.id || itIdx} className="flex items-center justify-between text-slate-600 text-[11px]">
                                  <span>{it.itemName} {it.spec ? `(${it.spec})` : ''}</span>
                                  <span className="font-mono">{it.quantity} {it.unit} @ ${it.unitPrice} = <strong>${it.lineTotal}</strong></span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 分頁 3: 動產履歷與除役資訊 */}
              {maintenanceSubTab === 'PROFILE' && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4 text-xs">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-slate-400 block text-[11px]">資產全銜名稱</span>
                      <strong className="text-slate-900 text-sm">{maintenanceTarget.name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">系統專用代碼</span>
                      <strong className="text-indigo-700 font-mono text-sm">{maintenanceTarget.code}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">當前運作狀態</span>
                      <strong className="text-slate-900">{maintenanceTarget.status === 'RETIRED' ? '已除役/汰除 (歷史留存)' : maintenanceTarget.status === 'MAINTENANCE' ? '保養檢修中' : '現役服役中'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">購置啟用日期</span>
                      <span className="font-mono text-slate-800">{maintenanceTarget.purchaseDate || '未登記'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">原始購置成本</span>
                      <span className="font-mono text-slate-800 font-bold">NT$ {Number(maintenanceTarget.purchaseCost || 0).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">專責保管人 / 司機</span>
                      <span className="text-slate-800 font-medium">{maintenanceTarget.driverOrCustodian || '公務輪派'}</span>
                    </div>
                  </div>

                  {maintenanceTarget.status === 'RETIRED' && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1.5 mt-2">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>動產除役報廢詳細存檔：</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-amber-950">
                        <div>汰除日期：<strong className="font-mono">{maintenanceTarget.retiredDate || '已除役'}</strong></div>
                        <div>處分方式：<strong>{maintenanceTarget.disposalMethod || '報廢處分'}</strong></div>
                        <div>回收殘值：<strong className="font-mono">NT$ {Number(maintenanceTarget.salvageAmount || 0).toLocaleString()}</strong></div>
                        <div className="col-span-2">除役原因：{maintenanceTarget.retiredReason || '使用年限屆滿'}</div>
                        {maintenanceTarget.replacedByAssetName && (
                          <div className="col-span-3 text-indigo-700 font-bold">
                            接棒接替新資產：{maintenanceTarget.replacedByAssetName}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-400 block text-[11px] mb-1">常用自動對齊別名</span>
                    <div className="flex flex-wrap gap-1">
                      {(maintenanceTarget.aliases || []).map((al, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-slate-700">
                          {al}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ⛔ 4. 嚴禁刪除之法規與會計防呆攔截 Modal */}
      {/* ------------------------------------------------------------- */}
      {blockedDeleteModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <BadgeAlert className="w-7 h-7" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                法律與會計防呆：此動產嚴禁物理刪除！
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                依據營造業法規、商業會計法與內部稽核原則，成為公司資產並已產生費用帳目者，<strong>絕對禁止物理抹除</strong>。
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">資產標的：</span>
                <strong className="text-slate-900">{blockedDeleteModal.asset.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">歷史進料簽收單：</span>
                <strong className="text-indigo-700 font-mono">{blockedDeleteModal.inboundCount} 筆</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">歷次維修保養紀錄：</span>
                <strong className="text-blue-700 font-mono">{blockedDeleteModal.maintCount} 筆</strong>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="text-slate-700 font-bold">歷史累計支出總額：</span>
                <strong className="text-rose-600 font-mono font-bold">NT$ {blockedDeleteModal.totalSpend.toLocaleString()}</strong>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200 leading-relaxed">
              💡 <strong>合規處理方式：</strong>若該動產老舊故障或不再使用，請使用「<strong>🔄 汰換/除役</strong>」將其標記為除役報廢。系統會從日常打單選單隱藏，但永久完整保留歷史會計帳目與維修履歷！
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBlockedDeleteModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs cursor-pointer"
              >
                我已瞭解，關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ⚠️ 5. 建檔錯誤或未購買之草稿刪除確認 Modal */}
      {/* ------------------------------------------------------------- */}
      {confirmDraftDeleteModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                確認刪除預建動產資料？
              </h3>
              <p className="text-xs text-slate-500">
                此項目【{confirmDraftDeleteModal.name}】經系統查驗，<strong>完全無任何進料簽收或維修花費紀錄</strong>。
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
              確認為<strong>建檔錯誤</strong>或<strong>原本預計購買但後續取消購入</strong>時方可執行刪除。此操作將自資產清冊中徹底移除。
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDraftDeleteModal(null)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDraftDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
