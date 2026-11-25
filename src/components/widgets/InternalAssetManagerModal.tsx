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
  CheckCircle2,
  X,
  Search,
  ArrowRightLeft,
  User,
  ShieldCheck,
  History,
  BadgeAlert,
  Archive,
  Undo2,
  ShieldAlert
} from 'lucide-react';
import {
  InternalAsset,
  InternalAssetCategory,
  getAssetCategory,
  getAssetCategoryLabel,
  AssetMaintenanceRecord,
  DEFAULT_INTERNAL_ASSETS,
  loadStoredInternalAssets,
  saveStoredInternalAssets,
  getDeletedInternalAssets,
  softDeleteInternalAsset,
  restoreInternalAsset,
  purgeInternalAsset
} from '../../utils/internalAssetStore';
import { getAllInboundReceipts } from '../../db/sqlite';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialogModal } from './ConfirmDialogModal';
import { InternalAssetFormModal } from './internal-assets/InternalAssetFormModal';
import { InternalAssetRetireModal } from './internal-assets/InternalAssetRetireModal';
import { InternalAssetLifecycleModal, AssetLifecycleStats } from './internal-assets/InternalAssetLifecycleModal';

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
  const { currentUser, isSuperadmin } = useAuth();
  const [assets, setAssets] = useState<InternalAsset[]>(() => loadStoredInternalAssets(false));
  const [viewSection, setViewSection] = useState<'ACTIVE_ASSETS' | 'RETIRED_ARCHIVE' | 'SUPERADMIN_RECOVERY'>('ACTIVE_ASSETS');
  const [activeCategoryTab, setActiveCategoryTab] = useState<'ALL' | 'MOVABLE' | 'REAL_ESTATE' | 'INVENTORY'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'MAINTENANCE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. 編輯 / 新增資產表單狀態
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<InternalAsset | null>(null);
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

  // 4. 防呆攔截與二次確認 Modal 狀態 (全面取代原生 window.confirm)
  const [blockedDeleteModal, setBlockedDeleteModal] = useState<{
    asset: InternalAsset;
    inboundCount: number;
    maintCount: number;
    totalSpend: number;
  } | null>(null);
  const [confirmDraftDeleteModal, setConfirmDraftDeleteModal] = useState<InternalAsset | null>(null);
  const [confirmPurgeTarget, setConfirmPurgeTarget] = useState<InternalAsset | null>(null);
  const [confirmResetDefaultsOpen, setConfirmResetDefaultsOpen] = useState(false);

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
  const getAssetLifecycleStats = (asset: InternalAsset): AssetLifecycleStats => {
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

  const activeAssets = useMemo(() => assets.filter(a => a.status !== 'RETIRED'), [assets]);
  const retiredAssets = useMemo(() => assets.filter(a => a.status === 'RETIRED'), [assets]);
  const deletedAssets = useMemo(() => (isSuperadmin ? getDeletedInternalAssets() : []), [isSuperadmin, assets]);

  const displayAssets = useMemo(() => {
    const baseList = viewSection === 'ACTIVE_ASSETS' ? activeAssets : retiredAssets;
    return baseList.filter(a => {
      const cat = getAssetCategory(a);
      if (viewSection === 'ACTIVE_ASSETS' && activeCategoryTab !== 'ALL' && cat !== activeCategoryTab) {
        return false;
      }
      const currentStatus = a.status || 'ACTIVE';
      if (statusFilter !== 'ALL' && currentStatus !== statusFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const kw = searchTerm.toLowerCase();
        const matchName = a.name.toLowerCase().includes(kw);
        const matchCode = a.code.toLowerCase().includes(kw);
        const matchPlate = (a.licensePlate || '').toLowerCase().includes(kw);
        const matchDriver = (a.driverOrCustodian || '').toLowerCase().includes(kw);
        const matchLoc = (a.locationOrAddress || '').toLowerCase().includes(kw);
        const matchNotes = (a.notes || '').toLowerCase().includes(kw);
        const matchAlias = (a.aliases || []).some(al => al.toLowerCase().includes(kw));
        const matchReason = (a.retiredReason || '').toLowerCase().includes(kw);
        return matchName || matchCode || matchPlate || matchDriver || matchLoc || matchNotes || matchAlias || matchReason;
      }
      return true;
    });
  }, [viewSection, activeAssets, retiredAssets, activeCategoryTab, statusFilter, searchTerm]);

  // 復歸服役
  const handleRestoreAssetToActive = (asset: InternalAsset) => {
    const nextList = assets.map(a => {
      if (a.id === asset.id) {
        return {
          ...a,
          name: a.name.replace(/\s*\(已汰除\)/g, '').replace(/\s*\(已報廢\)/g, ''),
          status: 'ACTIVE' as const,
          retiredDate: undefined,
          retiredReason: undefined,
          disposalMethod: undefined,
          salvageAmount: undefined,
          replacedByAssetId: undefined,
          replacedByAssetName: undefined
        };
      }
      return a;
    });
    setAssets(nextList);
    saveStoredInternalAssets(nextList);
    if (triggerToast) triggerToast(`✓ 已將【${asset.name}】復歸服役至在勤資產清單！`, 'success');
    onAssetsUpdated();
  };

  // 開啟新增 / 編輯
  const handleOpenCreate = () => {
    setEditingAsset(null);
    const cat: InternalAssetCategory = activeCategoryTab === 'ALL' ? 'MOVABLE' : activeCategoryTab;
    const defaultPrefix = cat === 'MOVABLE' ? 'VEH' : cat === 'REAL_ESTATE' ? 'FAC' : 'STOCK';
    setFormData({
      code: `${defaultPrefix}-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      assetCategory: cat,
      type: cat === 'MOVABLE' ? 'VEHICLE' : cat === 'REAL_ESTATE' ? 'FACILITY' : 'CENTRAL_STOCK',
      categoryLabel: cat === 'MOVABLE' ? '🚗 廠內動產' : cat === 'REAL_ESTATE' ? '🏢 廠內不動產' : '📦 廠內庫存',
      aliases: [],
      licensePlate: '',
      driverOrCustodian: '',
      locationOrAddress: '',
      status: 'ACTIVE',
      purchaseDate: new Date().toISOString().slice(0, 10),
      purchaseCost: 0,
      notes: ''
    });
    setAliasesInput('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (asset: InternalAsset) => {
    setEditingAsset(asset);
    setFormData({ ...asset, assetCategory: getAssetCategory(asset) });
    setAliasesInput((asset.aliases || []).join(', '));
    setIsFormOpen(true);
  };

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

    const parsedAliases = aliasesInput.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
    if (formData.licensePlate) {
      const cleanPlate = formData.licensePlate.trim();
      const pureDigits = cleanPlate.replace(/[^a-zA-Z0-9]/g, '');
      if (!parsedAliases.includes(cleanPlate)) parsedAliases.push(cleanPlate);
      if (pureDigits && !parsedAliases.includes(pureDigits)) parsedAliases.push(pureDigits);
    }

    const cat: InternalAssetCategory = formData.assetCategory || 'MOVABLE';
    const subType = formData.type || (cat === 'MOVABLE' ? 'VEHICLE' : cat === 'REAL_ESTATE' ? 'FACILITY' : 'CENTRAL_STOCK');
    const catLabel =
      cat === 'MOVABLE'
        ? formData.licensePlate
          ? '🚗 廠內動產 (車輛)'
          : '🚜 廠內動產 (機具/設備)'
        : cat === 'REAL_ESTATE'
        ? '🏢 廠內不動產 (廠房/設施)'
        : '📦 廠內庫存 (公共備料)';

    let updatedList: InternalAsset[] = [];

    if (editingAsset) {
      updatedList = assets.map(a =>
        a.id === editingAsset.id
          ? ({
              ...a,
              ...formData,
              assetCategory: cat,
              type: subType,
              categoryLabel: catLabel,
              purchaseCost: Number(formData.purchaseCost) || 0,
              locationOrAddress: formData.locationOrAddress?.trim(),
              aliases: Array.from(new Set([...(formData.aliases || []), ...parsedAliases]))
            } as InternalAsset)
          : a
      );
      if (triggerToast) triggerToast(`✓ 廠內資產【${formData.name}】資料已成功更新！`, 'success');
    } else {
      const newId = `asset-${cat.toLowerCase()}-${Date.now().toString().slice(-6)}`;
      const newAsset: InternalAsset = {
        id: newId,
        code: formData.code.trim(),
        name: formData.name.trim(),
        assetCategory: cat,
        type: subType,
        categoryLabel: catLabel,
        aliases: Array.from(new Set(parsedAliases)),
        licensePlate: formData.licensePlate?.trim(),
        driverOrCustodian: formData.driverOrCustodian?.trim(),
        locationOrAddress: formData.locationOrAddress?.trim(),
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

  // 汰換 / 汰除
  const handleOpenRetireModal = (asset: InternalAsset) => {
    setReplaceTarget(asset);
    setReplaceMode('REPLACE_WITH_NEW');
    setRetiredReason('達到使用折舊年限 / 重大維修耗損');
    setDisposalMethod('SCRAPPED');
    setSalvageAmount(0);
    if (asset.type === 'VEHICLE') {
      setNewAssetCode(`VEH-${Math.floor(100 + Math.random() * 900)}`);
      setNewAssetName('');
      setNewLicensePlate('');
    } else {
      setNewAssetCode(`${asset.code.split('-')[0] || 'EQ'}-${Math.floor(100 + Math.random() * 900)}`);
      setNewAssetName(`新代購置 - ${asset.name}`);
      setNewLicensePlate('');
    }
    setNewDriverOrCustodian(asset.driverOrCustodian || '');
    setNewPurchaseCost(0);
  };

  const handleExecuteRetire = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceTarget) return;

    const retiredId = replaceTarget.id;
    const nowStr = new Date().toISOString().slice(0, 10);
    let nextList = [...assets];
    let createdNewAsset: InternalAsset | null = null;

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

    nextList = nextList.map(a => {
      if (a.id === retiredId) {
        return {
          ...a,
          name: a.name.includes('(已汰除)') || a.name.includes('(已報廢)') ? a.name : `${a.name} (已汰除)`,
          status: 'RETIRED' as const,
          retiredDate: nowStr,
          retiredReason: retiredReason.trim() || '使用年限屆滿除役',
          disposalMethod,
          salvageAmount: Number(salvageAmount) || 0,
          replacedByAssetId: createdNewAsset ? createdNewAsset.id : undefined,
          replacedByAssetName: createdNewAsset ? createdNewAsset.name : undefined,
          notes: `${a.notes ? a.notes + ' | ' : ''}[${nowStr} 除役: ${retiredReason.trim() || '汰換報廢'}${createdNewAsset ? `，由【${createdNewAsset.name}】接棒` : ''}]`
        };
      }
      return a;
    });

    if (createdNewAsset) {
      nextList = [createdNewAsset, ...nextList];
      if (triggerToast) {
        triggerToast(`✓ 舊物件【${replaceTarget.name}】已標記汰換存檔，並自動建立接棒新資產【${createdNewAsset.name}】！`, 'success');
      }
    } else if (triggerToast) {
      triggerToast(`✓ 物件【${replaceTarget.name}】已成功執行汰除除役程序，歷史帳目與履歷全數永久保留！`, 'success');
    }

    setAssets(nextList);
    saveStoredInternalAssets(nextList);
    setReplaceTarget(null);
    onAssetsUpdated();
  };

  // 維修保養紀錄與歷程管理
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
        return { ...a, status: newStatus, maintenanceRecords: records };
      }
      return a;
    });

    setAssets(nextList);
    saveStoredInternalAssets(nextList);
    setMaintenanceTarget(nextList.find(a => a.id === maintenanceTarget.id) || null);
    setIsAddingMaintenance(false);
    if (triggerToast) {
      triggerToast(`✓ 已成功記錄【${maintenanceTarget.name}】維修保養項目：${newRecord.title} (NT$ ${newRecord.cost.toLocaleString()})`, 'success');
    }
    onAssetsUpdated();
  };

  const handleDeleteMaintenanceRecord = (recordId: string) => {
    if (!maintenanceTarget) return;
    const nextList = assets.map(a =>
      a.id === maintenanceTarget.id
        ? { ...a, maintenanceRecords: (a.maintenanceRecords || []).filter(r => r.id !== recordId) }
        : a
    );
    setAssets(nextList);
    saveStoredInternalAssets(nextList);
    setMaintenanceTarget(nextList.find(a => a.id === maintenanceTarget.id) || null);
    if (triggerToast) triggerToast('已刪除指定維修紀錄', 'success');
    onAssetsUpdated();
  };

  // 刪除防呆驗證
  const handleDeleteAssetAttempt = (asset: InternalAsset) => {
    const stats = getAssetLifecycleStats(asset);
    if (stats.inboundCount > 0 || stats.maintCount > 0) {
      setBlockedDeleteModal({
        asset,
        inboundCount: stats.inboundCount,
        maintCount: stats.maintCount,
        totalSpend: stats.inboundAmount + stats.maintAmount
      });
      return;
    }
    setConfirmDraftDeleteModal(asset);
  };

  const handleConfirmDraftDelete = () => {
    if (!confirmDraftDeleteModal) return;
    const target = confirmDraftDeleteModal;
    const operator = currentUser?.fullName || '系統操作員';
    softDeleteInternalAsset(target.id, operator, '現場刪除建檔錯誤或未購入之預建資產');
    setAssets(loadStoredInternalAssets(false));
    setConfirmDraftDeleteModal(null);
    if (triggerToast) triggerToast(`✅ 已軟刪除資產【${target.name}】（Admin 與一般人員隱蔽，Superadmin 可於救援區救回）`, 'success');
    onAssetsUpdated();
  };

  const handleExecuteResetToDefaults = () => {
    setAssets(DEFAULT_INTERNAL_ASSETS);
    saveStoredInternalAssets(DEFAULT_INTERNAL_ASSETS);
    setConfirmResetDefaultsOpen(false);
    if (triggerToast) triggerToast('已還原為初始預設廠內資產清單', 'success');
    onAssetsUpdated();
  };

  const handleExecutePurgeAsset = () => {
    if (!confirmPurgeTarget) return;
    purgeInternalAsset(confirmPurgeTarget.id, currentUser?.fullName || 'Superadmin');
    setAssets(loadStoredInternalAssets(false));
    if (triggerToast) triggerToast(`🗑️ 已永久抹除【${confirmPurgeTarget.name}】`, 'warn');
    setConfirmPurgeTarget(null);
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
                <h2 className="text-base font-bold text-white tracking-tight">廠內資產維護中心</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">動產 · 不動產 · 庫存</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">SSoT 防斷鏈</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                廠內動產 (車輛/機具/設備) · 不動產 (廠房/土地/設施) · 庫存 (公共備料進庫登記) 全生命週期管理
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
              <span>新增廠內資產</span>
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
        <div className="px-6 py-2 bg-indigo-50/80 border-b border-indigo-200 text-xs text-indigo-950 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed text-[11px]">
            <span className="font-bold">資產法規與管理原則：</span>
            廠內資產分為<strong>動產</strong>、<strong>不動產</strong>與<strong>庫存</strong>；動產淘汰後自動移至「<strong>歷史淘汰區</strong>」歸檔留存，主畫面保持清爽。
            凡具備歷史進料或維修工單者，嚴禁物理刪除以維護會計審計；僅建檔錯誤或取消購入之無紀錄草稿允許刪除。
          </div>
          <button
            type="button"
            onClick={() => setConfirmResetDefaultsOpen(true)}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline shrink-0 cursor-pointer"
            title="還原為系統初始預設"
          >
            還原預設
          </button>
        </div>

        {/* 核心雙視圖/三視圖主分頁 */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 pt-2.5 bg-slate-100/70">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setViewSection('ACTIVE_ASSETS'); setActiveCategoryTab('ALL'); }}
              className={`pb-2.5 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                viewSection === 'ACTIVE_ASSETS'
                  ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>目前在勤使用資產</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold">
                {activeAssets.length} 項
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewSection('RETIRED_ARCHIVE')}
              className={`pb-2.5 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                viewSection === 'RETIRED_ARCHIVE'
                  ? 'border-amber-600 text-amber-800 bg-white rounded-t-lg shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Archive className="w-4 h-4 text-amber-600" />
              <span>🏛️ 歷史淘汰存檔區</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-200 text-slate-700 font-bold">
                {retiredAssets.length} 項除役
              </span>
            </button>

            {isSuperadmin && (
              <button
                type="button"
                onClick={() => setViewSection('SUPERADMIN_RECOVERY')}
                className={`pb-2.5 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  viewSection === 'SUPERADMIN_RECOVERY'
                    ? 'border-rose-600 text-rose-800 bg-white rounded-t-lg shadow-xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>🛡️ 軟刪除救援區</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-100 text-rose-800 font-bold">
                  {deletedAssets.length} 筆
                </span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-500 pb-2 hidden sm:block">
            {viewSection === 'ACTIVE_ASSETS'
              ? '僅顯示服役在勤物件 · 淘汰物件已封存至淘汰區'
              : viewSection === 'RETIRED_ARCHIVE'
              ? '歷史除役資產永久歸檔 · 保留進貨與保修紀錄'
              : '最高架構師專用：可檢視並救援被軟刪除之資產'}
          </div>
        </div>

        {/* 工具列 */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          {viewSection === 'SUPERADMIN_RECOVERY' ? (
            <div className="flex items-center gap-2 text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>最高架構師專屬：軟刪除資產救援清單（共 {deletedAssets.length} 筆已安全隔離物件）</span>
            </div>
          ) : viewSection === 'ACTIVE_ASSETS' ? (
            <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveCategoryTab('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeCategoryTab === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                全部在勤 ({activeAssets.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategoryTab('MOVABLE')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  activeCategoryTab === 'MOVABLE' ? 'bg-white text-amber-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>🚗 動產 ({activeAssets.filter(a => getAssetCategory(a) === 'MOVABLE').length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategoryTab('REAL_ESTATE')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  activeCategoryTab === 'REAL_ESTATE' ? 'bg-white text-purple-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>🏢 不動產 ({activeAssets.filter(a => getAssetCategory(a) === 'REAL_ESTATE').length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategoryTab('INVENTORY')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  activeCategoryTab === 'INVENTORY' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>📦 庫存 ({activeAssets.filter(a => getAssetCategory(a) === 'INVENTORY').length})</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <Archive className="w-4 h-4 text-amber-600" />
              <span>歷史淘汰除役物件清單（共 {displayAssets.length} 筆）</span>
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜尋名稱、車牌、代碼、別名、保管人..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-60"
              />
            </div>

            {viewSection === 'ACTIVE_ASSETS' && (
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700"
              >
                <option value="ALL">全部運作狀態</option>
                <option value="ACTIVE">✅ 現役服役中</option>
                <option value="MAINTENANCE">🔧 保養檢修中</option>
              </select>
            )}
          </div>
        </div>

        {/* 資產清單主內容區 */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewSection === 'SUPERADMIN_RECOVERY' ? (
            <div className="space-y-4">
              <div className="mb-4 p-4 bg-slate-900 text-white rounded-xl border border-slate-700 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold shrink-0 border border-rose-500/30">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>廠內資產軟刪除救援中心 (Superadmin 專用)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white">一般人員完全隱蔽</span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      一般 Admin 與現場同仁刪除之資產均自動轉為「軟刪除」並留存日誌。您可以在此一鍵救援還原回在勤狀態，或進行物理抹除。
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewSection('ACTIVE_ASSETS')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors"
                >
                  ← 返回在勤資產
                </button>
              </div>

              {deletedAssets.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  目前無任何被軟刪除的廠內資產。
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">類別</th>
                        <th className="py-2.5 px-3">資產名稱</th>
                        <th className="py-2.5 px-3">代碼</th>
                        <th className="py-2.5 px-3">刪除人</th>
                        <th className="py-2.5 px-3">刪除時間</th>
                        <th className="py-2.5 px-3">備註原因</th>
                        <th className="py-2.5 px-3 text-right">Superadmin 處置</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deletedAssets.map(ast => (
                        <tr key={ast.id} className="hover:bg-amber-50/50 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              {getAssetCategoryLabel(getAssetCategory(ast))}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{ast.name}</td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-indigo-700">{ast.code}</td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">{ast.deletedBy || '管理員'}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{ast.deletedAt || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">{ast.deleteReason || '草稿刪除'}</td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  restoreInternalAsset(ast.id, currentUser?.fullName || 'Superadmin');
                                  setAssets(loadStoredInternalAssets(false));
                                  if (triggerToast) triggerToast(`✅ 已救援還原資產【${ast.name}】！各模組同仁已立即可見`, 'success');
                                  onAssetsUpdated();
                                }}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                <span>↩️ 救回還原</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmPurgeTarget(ast)}
                                className="px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="物理抹除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <>
              {viewSection === 'RETIRED_ARCHIVE' && (
                <div className="mb-4 p-4 bg-slate-900 text-white rounded-xl border border-slate-700 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0 border border-amber-500/30">
                      <Archive className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>廠內資產歷史淘汰與除役存檔區</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400 text-slate-950">永久封存不刪單</span>
                      </h3>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        動產一旦淘汰除役即自動歸檔於此，<strong>主畫面完全淨化，僅保留服役在勤之物件</strong>。
                        此區物件之歷史進貨單據、發票金額與保修工單永久完整保留，隨時可調閱全生命週期總耗資；若操作失誤，亦可點擊「復歸服役」還原。
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewSection('ACTIVE_ASSETS')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors"
                  >
                    ← 返回在勤資產
                  </button>
                </div>
              )}

              {displayAssets.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  {viewSection === 'ACTIVE_ASSETS'
                    ? '查無符合條件之在勤資產（可點擊右上角「+ 新增廠內資產」）。'
                    : '目前歷史淘汰存檔區尚無任何除役資產。'}
                </div>
              ) : viewSection === 'ACTIVE_ASSETS' ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3 w-12 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[210px]">資產全名 / 車牌機號</th>
                        <th className="py-2.5 px-3 w-28 text-center">資產代碼</th>
                        <th className="py-2.5 px-3 w-24">領域分類</th>
                        <th className="py-2.5 px-3 min-w-[150px]">快速比對別名</th>
                        <th className="py-2.5 px-3 w-28">保管人/司機/位置</th>
                        <th className="py-2.5 px-3 w-24 text-center">運作狀態</th>
                        <th className="py-2.5 px-3 w-32 text-right">進料 / 維修總耗資</th>
                        <th className="py-2.5 px-3 w-48 text-center">動產生命週期管理</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayAssets.map((asset, idx) => {
                        const stats = getAssetLifecycleStats(asset);
                        const currentStatus = asset.status || 'ACTIVE';
                        const cat = getAssetCategory(asset);
                        const hasRecords = stats.inboundCount > 0 || stats.maintCount > 0;

                        return (
                          <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors text-slate-800">
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                  {cat === 'MOVABLE' && <Truck className="w-4 h-4 text-amber-600 shrink-0" />}
                                  {cat === 'REAL_ESTATE' && <Home className="w-4 h-4 text-purple-600 shrink-0" />}
                                  {cat === 'INVENTORY' && <Package className="w-4 h-4 text-emerald-600 shrink-0" />}
                                  <span>{asset.name}</span>
                                </span>
                                {asset.licensePlate && (
                                  <span className="font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 text-[10px] font-bold shrink-0">
                                    {asset.licensePlate}
                                  </span>
                                )}
                              </div>
                              {asset.notes && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{asset.notes}</p>}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">{asset.code}</td>
                            <td className="py-2.5 px-3 font-medium">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  cat === 'MOVABLE'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : cat === 'REAL_ESTATE'
                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                {cat === 'MOVABLE' ? '🚗 動產' : cat === 'REAL_ESTATE' ? '🏢 不動產' : '📦 庫存'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap gap-1 max-w-[200px]">
                                {(asset.aliases || []).map((al, aIdx) => (
                                  <span key={aIdx} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono border border-slate-200">
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
                              ) : asset.locationOrAddress ? (
                                <span className="text-slate-500 text-[11px] truncate max-w-[120px] block" title={asset.locationOrAddress}>
                                  📍 {asset.locationOrAddress}
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
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              <div className="font-bold text-indigo-700">NT$ {stats.totalLifetimeSpend.toLocaleString()}</div>
                              <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1.5 mt-0.5">
                                <span>進料:{stats.inboundCount}筆</span>
                                <span>·</span>
                                <span>維修:{stats.maintCount}次</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenMaintenance(asset)}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="查看全生命週期耗資總計、歷次維修保養單與現場進料明細"
                                >
                                  <Wrench className="w-3 h-3 text-blue-600" />
                                  <span>維修/履歷</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenRetireModal(asset)}
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="老舊或損壞資產汰換（可換新接替或純除役，完成後自動移入歷史淘汰區）"
                                >
                                  <ArrowRightLeft className="w-3 h-3 text-amber-700" />
                                  <span>汰換/除役</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(asset)}
                                  className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                  title="編輯動產主檔資料"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAssetAttempt(asset)}
                                  className={`p-1 rounded transition-colors ${
                                    hasRecords
                                      ? 'text-slate-300 hover:text-rose-400 hover:bg-rose-50 cursor-pointer'
                                      : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                                  }`}
                                  title={hasRecords ? '已有進貨或維修花費紀錄，點擊查看防呆說明' : '建檔錯誤或預計購買未購入，可刪除預建資料'}
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
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-200/90 text-slate-800 font-bold border-b border-slate-300">
                        <th className="py-2.5 px-3 w-12 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[200px]">已淘汰資產全名 / 原車牌</th>
                        <th className="py-2.5 px-3 w-24 text-center">原代碼</th>
                        <th className="py-2.5 px-3 w-20">領域分類</th>
                        <th className="py-2.5 px-3 w-24 text-center">淘汰日期</th>
                        <th className="py-2.5 px-3 w-24 text-center">處分方式</th>
                        <th className="py-2.5 px-3 min-w-[180px]">除役原因 / 接棒新資產</th>
                        <th className="py-2.5 px-3 w-24 text-right">回收殘值</th>
                        <th className="py-2.5 px-3 w-32 text-right">一生累積耗資</th>
                        <th className="py-2.5 px-3 w-44 text-center">歷史管理與還原</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-slate-50/50">
                      {displayAssets.map((asset, idx) => {
                        const stats = getAssetLifecycleStats(asset);
                        const cat = getAssetCategory(asset);
                        const hasRecords = stats.inboundCount > 0 || stats.maintCount > 0;

                        return (
                          <tr key={asset.id} className="hover:bg-slate-100/80 transition-colors text-slate-700">
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 line-through decoration-slate-400">{asset.name}</span>
                                {asset.licensePlate && (
                                  <span className="font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">
                                    {asset.licensePlate}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-amber-800 font-semibold inline-block mt-0.5">已封存於淘汰區 · 現場打單選單自動隱藏</span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">{asset.code}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-700">
                                {cat === 'MOVABLE' ? '🚗 動產' : cat === 'REAL_ESTATE' ? '🏢 不動產' : '📦 庫存'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-600">{asset.retiredDate || '—'}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                {asset.disposalMethod === 'SCRAPPED'
                                  ? '報廢拆解'
                                  : asset.disposalMethod === 'SOLD'
                                  ? '二手變賣'
                                  : asset.disposalMethod === 'TRADE_IN'
                                  ? '舊換新折抵'
                                  : asset.disposalMethod === 'STORED'
                                  ? '停用封存'
                                  : '除役'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="text-slate-800 text-[11px] font-medium">{asset.retiredReason || '使用年限屆滿除役'}</div>
                              {asset.replacedByAssetName && (
                                <div className="text-[10px] text-indigo-700 font-semibold flex items-center gap-1 mt-0.5">
                                  <span>接替新機：</span>
                                  <strong className="underline">{asset.replacedByAssetName}</strong>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                              {asset.salvageAmount ? `NT$ ${asset.salvageAmount.toLocaleString()}` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              <div className="font-bold text-slate-900">NT$ {stats.totalLifetimeSpend.toLocaleString()}</div>
                              <div className="text-[10px] text-slate-400">進料:{stats.inboundCount}筆 · 維修:{stats.maintCount}次</div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenMaintenance(asset)}
                                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="調閱該資產服役期間的所有進貨簽收單與維修紀錄"
                                >
                                  <History className="w-3 h-3 text-slate-700" />
                                  <span>歷史履歷</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRestoreAssetToActive(asset)}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="操作失誤或重新啟用？點擊一鍵還原回在勤使用資產"
                                >
                                  <Undo2 className="w-3 h-3 text-emerald-700" />
                                  <span>復歸服役</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAssetAttempt(asset)}
                                  className={`p-1 rounded transition-colors ${
                                    hasRecords
                                      ? 'text-slate-300 hover:text-rose-400 hover:bg-rose-50 cursor-pointer'
                                      : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                                  }`}
                                  title={hasRecords ? '已有歷史帳目，依法規禁止刪除' : '無任何紀錄之錯誤草稿可徹底刪除'}
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
            </>
          )}
        </div>

        {/* 底部總覽狀態列 */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>服役在勤中：<strong className="text-emerald-700 font-bold">{activeAssets.length}</strong> 項（主畫面乾淨）</span>
            <span>歷史淘汰存檔：<strong className="text-amber-800 font-bold">{retiredAssets.length}</strong> 項（歷史帳目完整留存）</span>
            <span className="hidden md:inline">
              三大領域：動產 {assets.filter(a => getAssetCategory(a) === 'MOVABLE').length} · 不動產 {assets.filter(a => getAssetCategory(a) === 'REAL_ESTATE').length} · 庫存 {assets.filter(a => getAssetCategory(a) === 'INVENTORY').length}
            </span>
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

      {/* 1. 新增 / 編輯 資產表單 Modal */}
      <InternalAssetFormModal
        isOpen={isFormOpen}
        editingAsset={editingAsset}
        formData={formData}
        setFormData={setFormData}
        aliasesInput={aliasesInput}
        setAliasesInput={setAliasesInput}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSaveAsset}
      />

      {/* 2. 全物件汰換 / 汰除 / 報廢作業彈窗 */}
      <InternalAssetRetireModal
        target={replaceTarget}
        replaceMode={replaceMode}
        setReplaceMode={setReplaceMode}
        retiredReason={retiredReason}
        setRetiredReason={setRetiredReason}
        disposalMethod={disposalMethod}
        setDisposalMethod={setDisposalMethod}
        salvageAmount={salvageAmount}
        setSalvageAmount={setSalvageAmount}
        newAssetCode={newAssetCode}
        setNewAssetCode={setNewAssetCode}
        newAssetName={newAssetName}
        setNewAssetName={setNewAssetName}
        newLicensePlate={newLicensePlate}
        setNewLicensePlate={setNewLicensePlate}
        newDriverOrCustodian={newDriverOrCustodian}
        setNewDriverOrCustodian={setNewDriverOrCustodian}
        newPurchaseCost={newPurchaseCost}
        setNewPurchaseCost={setNewPurchaseCost}
        onClose={() => setReplaceTarget(null)}
        onSubmit={handleExecuteRetire}
      />

      {/* 3. 維修維護紀錄與全生命週期履歷 Modal */}
      <InternalAssetLifecycleModal
        target={maintenanceTarget}
        subTab={maintenanceSubTab}
        setSubTab={setMaintenanceSubTab}
        isAddingMaintenance={isAddingMaintenance}
        setIsAddingMaintenance={setIsAddingMaintenance}
        maintFormData={maintFormData}
        setMaintFormData={setMaintFormData}
        stats={maintenanceTarget ? getAssetLifecycleStats(maintenanceTarget) : null}
        onClose={() => setMaintenanceTarget(null)}
        onSaveMaintenance={handleSaveMaintenanceRecord}
        onDeleteMaintenance={handleDeleteMaintenanceRecord}
      />

      {/* 4. 嚴禁刪除之法規與會計防呆攔截 Modal */}
      {blockedDeleteModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <BadgeAlert className="w-7 h-7" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">法律與會計防呆：此動產嚴禁物理刪除！</h3>
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

      {/* 5. 建檔錯誤或未購買之草稿刪除確認 (共用 ConfirmDialogModal) */}
      <ConfirmDialogModal
        isOpen={!!confirmDraftDeleteModal}
        title="確認刪除預建動產資料？"
        variant="warning"
        message={
          <span>
            此項目【<strong className="text-slate-900">{confirmDraftDeleteModal?.name}</strong>】經系統查驗，
            <strong>完全無任何進料簽收或維修花費紀錄</strong>。
          </span>
        }
        extraNotice={
          <span>
            確認為<strong>建檔錯誤</strong>或<strong>原本預計購買但後續取消購入</strong>時方可執行刪除。此操作將自一般清單移至 Superadmin 安全隔離區。
          </span>
        }
        confirmText="確認刪除"
        onCancel={() => setConfirmDraftDeleteModal(null)}
        onConfirm={handleConfirmDraftDelete}
      />

      {/* 6. 還原初始預設資產清單確認 (共用 ConfirmDialogModal) */}
      <ConfirmDialogModal
        isOpen={confirmResetDefaultsOpen}
        title="還原為系統預設資產清單？"
        variant="warning"
        message="確定要還原為系統初始預設的廠內資產與車輛清單嗎？"
        extraNotice="自訂新增或編輯過之廠內資產項目將會被預設清單重置覆蓋。"
        confirmText="確認還原預設"
        onCancel={() => setConfirmResetDefaultsOpen(false)}
        onConfirm={handleExecuteResetToDefaults}
      />

      {/* 7. Superadmin 永久物理抹除確認 (共用 ConfirmDialogModal) */}
      <ConfirmDialogModal
        isOpen={!!confirmPurgeTarget}
        title="確定要永久物理抹除資產？"
        variant="danger"
        message={
          <span>
            即將自系統永久抹除資產「<strong className="text-slate-900">{confirmPurgeTarget?.name}</strong>」（{confirmPurgeTarget?.code}）。
          </span>
        }
        extraNotice="物理抹除後資料將無法再從軟刪除救援區找回，請確認是否繼續執行。"
        confirmText="確認永久抹除"
        onCancel={() => setConfirmPurgeTarget(null)}
        onConfirm={handleExecutePurgeAsset}
      />
    </div>
  );
};
