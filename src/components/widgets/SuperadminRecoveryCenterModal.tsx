// src/components/widgets/SuperadminRecoveryCenterModal.tsx
// 🛡️ 最高架構師軟刪除救援中心 (Superadmin Data Recovery & Audit Center)
// 專供 Superadmin 檢視全系統被軟刪除之資料物件（進貨簽收單、廠內資產、專案案場、商業夥伴）
// 嚴格落實權限隔離：Admin 與一般 User 刪除後 100% 隱蔽不可見，僅 Superadmin 具備調閱、救援還原與物理抹除權限
// 所有軟刪除與救援操作全程記錄於 audit_logs 審計日誌

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  RotateCcw,
  Trash2,
  X,
  Search,
  Package,
  Truck,
  Building2,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Calendar,
  Layers,
  ArrowRight,
  Database,
  History,
  ShieldCheck,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import {
  InboundReceipt,
  Project,
  BusinessPartner,
  AuditLog
} from '../../types/erp';
import {
  getDeletedInboundReceipts,
  restoreInboundReceipt,
  purgeInboundReceipt,
  getDeletedProjects,
  restoreProjectRecord,
  purgeProjectRecord,
  getDeletedBusinessPartners,
  restoreBusinessPartner,
  purgeBusinessPartner,
  getAllAuditLogs,
  subscribeToDatabase
} from '../../db/sqlite';
import {
  InternalAsset,
  getDeletedInternalAssets,
  restoreInternalAsset,
  purgeInternalAsset,
  getAssetCategoryLabel,
  getAssetCategory
} from '../inbound/ExcelInboundGridModal';
import { useAuth } from '../../context/AuthContext';

interface SuperadminRecoveryCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerToast?: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onDataRestored?: () => void;
}

export const SuperadminRecoveryCenterModal: React.FC<SuperadminRecoveryCenterModalProps> = ({
  isOpen,
  onClose,
  triggerToast,
  onDataRestored
}) => {
  const { currentUser, isSuperadmin } = useAuth();

  // 分頁切換：廠內資產 | 進貨簽收單 | 專案案場 | 商業夥伴 | 審計日誌
  const [activeTab, setActiveTab] = useState<'ASSETS' | 'RECEIPTS' | 'PROJECTS' | 'PARTNERS' | 'LOGS'>('ASSETS');
  const [searchTerm, setSearchTerm] = useState('');

  // 各類被軟刪除資料
  const [deletedAssets, setDeletedAssets] = useState<InternalAsset[]>([]);
  const [deletedReceipts, setDeletedReceipts] = useState<InboundReceipt[]>([]);
  const [deletedProjects, setDeletedProjects] = useState<Project[]>([]);
  const [deletedPartners, setDeletedPartners] = useState<BusinessPartner[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // 物理抹除確認對話框
  const [purgeTarget, setPurgeTarget] = useState<{
    type: 'ASSET' | 'RECEIPT' | 'PROJECT' | 'PARTNER';
    id: string;
    title: string;
  } | null>(null);

  // 載入所有軟刪除資料
  const loadDeletedData = () => {
    try {
      setDeletedAssets(getDeletedInternalAssets());
      setDeletedReceipts(getDeletedInboundReceipts());
      setDeletedProjects(getDeletedProjects());
      setDeletedPartners(getDeletedBusinessPartners());
      setAuditLogs(getAllAuditLogs(200));
    } catch (e) {
      console.error('載入軟刪除資料失敗:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDeletedData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToDatabase(() => {
      loadDeletedData();
    });
    return () => unsub();
  }, [isOpen]);

  // 總計軟刪除物件數量
  const totalDeletedCount = deletedAssets.length + deletedReceipts.length + deletedProjects.length + deletedPartners.length;

  // 篩選與救援 Log 相關的審計紀錄
  const recoveryAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const act = log.action || '';
      return (
        act.includes('軟刪除') ||
        act.includes('救援還原') ||
        act.includes('永久抹除') ||
        act.includes('SOFT_DELETE') ||
        act.includes('RESTORE') ||
        act.includes('HARD_DELETE') ||
        act.includes('刪除草稿進貨單') ||
        act.includes('刪除資料')
      );
    });
  }, [auditLogs]);

  // ==========================================================================
  // ↩️ 救援還原操作 (Restore)
  // ==========================================================================

  // 1. 救援廠內資產
  const handleRestoreAsset = (asset: InternalAsset) => {
    const operator = currentUser?.fullName || 'Superadmin';
    const ok = restoreInternalAsset(asset.id, operator);
    if (ok) {
      loadDeletedData();
      if (triggerToast) triggerToast(`✅ 已成功救援還原廠內資產【${asset.name}】！各模組同仁已立即可見`, 'success');
      if (onDataRestored) onDataRestored();
    } else {
      if (triggerToast) triggerToast('❌ 救援資產失敗', 'error');
    }
  };

  // 2. 救援進貨單
  const handleRestoreReceipt = (receipt: InboundReceipt) => {
    const operator = currentUser?.fullName || 'Superadmin';
    const ok = restoreInboundReceipt(receipt.id, operator);
    if (ok) {
      loadDeletedData();
      if (triggerToast) triggerToast(`✅ 已成功救援還原進貨簽收單【${receipt.receiptNumber}】！`, 'success');
      if (onDataRestored) onDataRestored();
    } else {
      if (triggerToast) triggerToast('❌ 救援進貨單失敗', 'error');
    }
  };

  // 3. 救援專案案場
  const handleRestoreProject = (project: Project) => {
    const operator = currentUser?.fullName || 'Superadmin';
    const ok = restoreProjectRecord(project.id, operator);
    if (ok) {
      loadDeletedData();
      if (triggerToast) triggerToast(`✅ 已成功救援還原專案案場【${project.name}】！`, 'success');
      if (onDataRestored) onDataRestored();
    } else {
      if (triggerToast) triggerToast('❌ 救援案場失敗', 'error');
    }
  };

  // 4. 救援商業夥伴
  const handleRestorePartner = (partner: BusinessPartner) => {
    const operator = currentUser?.fullName || 'Superadmin';
    const ok = restoreBusinessPartner(partner.id, operator);
    if (ok) {
      loadDeletedData();
      if (triggerToast) triggerToast(`✅ 已成功救援還原商業夥伴【${partner.name}】！`, 'success');
      if (onDataRestored) onDataRestored();
    } else {
      if (triggerToast) triggerToast('❌ 救援夥伴失敗', 'error');
    }
  };

  // ==========================================================================
  // 🗑️ 永久抹除操作 (Hard Purge)
  // ==========================================================================
  const handleExecutePurge = () => {
    if (!purgeTarget) return;
    const operator = currentUser?.fullName || 'Superadmin';

    if (purgeTarget.type === 'ASSET') {
      purgeInternalAsset(purgeTarget.id, operator);
    } else if (purgeTarget.type === 'RECEIPT') {
      purgeInboundReceipt(purgeTarget.id, operator);
    } else if (purgeTarget.type === 'PROJECT') {
      purgeProjectRecord(purgeTarget.id, operator);
    } else if (purgeTarget.type === 'PARTNER') {
      purgeBusinessPartner(purgeTarget.id, operator);
    }

    if (triggerToast) triggerToast(`🗑️ 已永久物理抹除【${purgeTarget.title}】，資料已自資料庫徹底清除，日誌軌跡已永久存檔備查`, 'warn');
    setPurgeTarget(null);
    loadDeletedData();
    if (onDataRestored) onDataRestored();
  };

  if (!isOpen) return null;

  // 嚴密防護：僅 Superadmin 具有調閱救援中心權限
  if (!isSuperadmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
        <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl text-white">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-rose-400">權限隔離攔截：僅限最高架構師 (Superadmin)</h3>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            系統全面實施嚴密防護與軟刪除機制。所有已刪除物件對 Admin 與一般使用者 100% 隱蔽，僅具備 Superadmin 憑證身分者得開啟救援中心。
          </p>
          <button
            onClick={onClose}
            className="mt-5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg cursor-pointer"
          >
            關閉視窗
          </button>
        </div>
      </div>
    );
  }

  // 搜尋過濾
  const filteredAssets = deletedAssets.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.deletedBy && a.deletedBy.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredReceipts = deletedReceipts.filter(r =>
    r.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.vendorNameSnapshot && r.vendorNameSnapshot.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.deliveryNoteNumber && r.deliveryNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredProjects = deletedProjects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.projectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPartners = deletedPartners.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.bpCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.taxId && b.taxId.includes(searchTerm))
  );

  const filteredLogs = recoveryAuditLogs.filter(l =>
    l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.targetTable.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.targetId && l.targetId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
        
        {/* 頂部 Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center font-bold shadow-md shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  最高架構師軟刪除救援中心
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 font-mono">
                  Superadmin 專屬救援通道
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                  全面審計 Log 保留
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                避免誤刪全面實施軟刪除機制：Admin 與一般同仁刪除後全部隱蔽，僅 Superadmin 得以檢視救回，並完整保留日誌軌跡。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadDeletedData}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="重新整理資料"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 次導航工具列：分頁與搜尋 */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* 主分頁標籤 */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('ASSETS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ASSETS'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>廠內資產</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'ASSETS' ? 'bg-amber-800 text-amber-100' : 'bg-slate-100 text-slate-600'
              }`}>
                {deletedAssets.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('RECEIPTS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'RECEIPTS'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>進貨簽收單</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'RECEIPTS' ? 'bg-amber-800 text-amber-100' : 'bg-slate-100 text-slate-600'
              }`}>
                {deletedReceipts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('PROJECTS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'PROJECTS'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>專案工程案場</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'PROJECTS' ? 'bg-amber-800 text-amber-100' : 'bg-slate-100 text-slate-600'
              }`}>
                {deletedProjects.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('PARTNERS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'PARTNERS'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>商業夥伴</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'PARTNERS' ? 'bg-amber-800 text-amber-100' : 'bg-slate-100 text-slate-600'
              }`}>
                {deletedPartners.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('LOGS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'LOGS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>📜 刪除/救援審計日誌</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'LOGS' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-100 text-slate-600'
              }`}>
                {recoveryAuditLogs.length}
              </span>
            </button>
          </div>

          {/* 搜尋欄位 */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="搜尋代碼、名稱或操作人..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* 內容區塊 */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* ======================================================== */}
          {/* TAB 1: 廠內資產 (動產 / 不動產 / 庫存)                   */}
          {/* ======================================================== */}
          {activeTab === 'ASSETS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>被軟刪除之廠內資產清單</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      (目前共 {filteredAssets.length} 筆，一般 User 與 Admin 視圖完全不可見)
                    </span>
                  </h3>
                </div>
              </div>

              {filteredAssets.length === 0 ? (
                <div className="py-16 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                  <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">無任何被軟刪除的廠內資產</p>
                  <p className="text-[11px] text-slate-400 mt-1">目前所有在勤與歷史淘汰資產皆正常處於現役或存檔狀態</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">領域分類</th>
                        <th className="py-3 px-4">資產名稱</th>
                        <th className="py-3 px-4">代碼</th>
                        <th className="py-3 px-4">車牌/保管人/地點</th>
                        <th className="py-3 px-4">刪除操作人</th>
                        <th className="py-3 px-4">刪除時間</th>
                        <th className="py-3 px-4">刪除原因備註</th>
                        <th className="py-3 px-4 text-right">Superadmin 處置</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAssets.map(ast => (
                        <tr key={ast.id} className="hover:bg-amber-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              {getAssetCategoryLabel(getAssetCategory(ast))}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {ast.name}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-indigo-700">
                            {ast.code}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {ast.licensePlate ? (
                              <span className="font-mono font-bold text-slate-800">{ast.licensePlate}</span>
                            ) : ast.locationOrAddress ? (
                              <span>{ast.locationOrAddress}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                            {ast.driverOrCustodian && (
                              <span className="text-[11px] text-slate-500 ml-1">({ast.driverOrCustodian})</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700">
                            {ast.deletedBy || '系統管理員'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {ast.deletedAt || ast.createdAt || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                            {ast.deleteReason || '建檔錯誤或未購入之草稿軟刪除'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRestoreAsset(ast)}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="救回資產並還原至在勤使用中"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>↩️ 救回還原</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPurgeTarget({ type: 'ASSET', id: ast.id, title: `廠內資產 ${ast.name} (${ast.code})` })}
                                className="px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                                title="物理抹除（不可還原，保留日誌）"
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
          )}

          {/* ======================================================== */}
          {/* TAB 2: 進貨簽收單                                        */}
          {/* ======================================================== */}
          {activeTab === 'RECEIPTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>被軟刪除之現場進貨簽收單清單</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      (目前共 {filteredReceipts.length} 筆，進貨管理工作台與統計報表皆已自動過濾屏蔽)
                    </span>
                  </h3>
                </div>
              </div>

              {filteredReceipts.length === 0 ? (
                <div className="py-16 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">無任何被軟刪除的進貨單據</p>
                  <p className="text-[11px] text-slate-400 mt-1">所有現場簽收草稿與已核銷單據皆處於正常流程</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">進貨單號</th>
                        <th className="py-3 px-4">廠商送貨單號</th>
                        <th className="py-3 px-4">合作廠商</th>
                        <th className="py-3 px-4">歸屬案場</th>
                        <th className="py-3 px-4">進貨日期</th>
                        <th className="py-3 px-4 text-right">單據金額</th>
                        <th className="py-3 px-4">狀態</th>
                        <th className="py-3 px-4 text-right">Superadmin 處置</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredReceipts.map(rec => (
                        <tr key={rec.id} className="hover:bg-amber-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                            {rec.receiptNumber}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                            {rec.deliveryNoteNumber || '—'}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {rec.vendorNameSnapshot || '合作廠商'}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {rec.projectNameSnapshot || '工區案場'}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            {rec.receivedDate}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            NT$ {rec.totalAmount.toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              已軟刪除
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRestoreReceipt(rec)}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="救回進貨單據並恢復至進貨管理工作台"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>↩️ 救回還原</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPurgeTarget({ type: 'RECEIPT', id: rec.id, title: `進貨單據 ${rec.receiptNumber}` })}
                                className="px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                                title="物理抹除（不可還原，保留日誌）"
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
          )}

          {/* ======================================================== */}
          {/* TAB 3: 專案工程案場                                      */}
          {/* ======================================================== */}
          {activeTab === 'PROJECTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>被軟刪除之專案工程案場清單</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      (目前共 {filteredProjects.length} 筆，案場工程模組與打單選單均不可見)
                    </span>
                  </h3>
                </div>
              </div>

              {filteredProjects.length === 0 ? (
                <div className="py-16 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                  <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">無任何被軟刪除的工程案場</p>
                  <p className="text-[11px] text-slate-400 mt-1">目前所有施工中與完工案場皆受資料庫安全保護</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">案場代號</th>
                        <th className="py-3 px-4">工程案場全銜</th>
                        <th className="py-3 px-4">合約甲方 / 業主</th>
                        <th className="py-3 px-4">工程類型</th>
                        <th className="py-3 px-4 text-right">合約金額</th>
                        <th className="py-3 px-4">工期區間</th>
                        <th className="py-3 px-4 text-right">Superadmin 處置</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProjects.map(prj => (
                        <tr key={prj.id} className="hover:bg-amber-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                            {prj.projectCode}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {prj.name}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {prj.ownerName}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {prj.buildingType || '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            NT$ {prj.contractAmount.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {prj.startDate} ~ {prj.endDate}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRestoreProject(prj)}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="救回案場並還原至專案主檔與進貨打單選單"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>↩️ 救回還原</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPurgeTarget({ type: 'PROJECT', id: prj.id, title: `工程案場 ${prj.name} (${prj.projectCode})` })}
                                className="px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                                title="物理抹除（不可還原，保留日誌）"
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
          )}

          {/* ======================================================== */}
          {/* TAB 4: 商業夥伴 (業主 / 供料商 / 下包商)               */}
          {/* ======================================================== */}
          {activeTab === 'PARTNERS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>被軟刪除之商業夥伴清單</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      (目前共 {filteredPartners.length} 筆，商業夥伴庫與廠商通訊錄均已屏蔽)
                    </span>
                  </h3>
                </div>
              </div>

              {filteredPartners.length === 0 ? (
                <div className="py-16 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">無任何被軟刪除的商業夥伴</p>
                  <p className="text-[11px] text-slate-400 mt-1">業主、供料商與協力廠商名冊安全完整</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">夥伴編號</th>
                        <th className="py-3 px-4">夥伴名稱</th>
                        <th className="py-3 px-4">統一編號</th>
                        <th className="py-3 px-4">夥伴類別</th>
                        <th className="py-3 px-4">主要營業項目</th>
                        <th className="py-3 px-4">聯絡人 / 電話</th>
                        <th className="py-3 px-4 text-right">Superadmin 處置</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPartners.map(bp => (
                        <tr key={bp.id} className="hover:bg-amber-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                            {bp.bpCode}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {bp.name}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">
                            {bp.taxId || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                              {bp.isCustomer && bp.isVendor ? '業主/廠商雙重' : bp.isCustomer ? '合約業主' : '供貨/下包商'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {bp.serviceCategoryMain || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {bp.contactPerson || '—'} {bp.phone ? `(${bp.phone})` : ''}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRestorePartner(bp)}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="救回商業夥伴並還原至通訊錄主檔"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>↩️ 救回還原</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPurgeTarget({ type: 'PARTNER', id: bp.id, title: `商業夥伴 ${bp.name} (${bp.bpCode})` })}
                                className="px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                                title="物理抹除（不可還原，保留日誌）"
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
          )}

          {/* ======================================================== */}
          {/* TAB 5: 審計日誌 (Audit Logs 歷史軌跡)                     */}
          {/* ======================================================== */}
          {activeTab === 'LOGS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>軟刪除與救援操作歷史審計日誌 (Audit Trail)</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      (依時間降冪排列，詳實記錄操作人、時間戳記與差異快照，杜絕死無對證)
                    </span>
                  </h3>
                </div>
              </div>

              {filteredLogs.length === 0 ? (
                <div className="py-16 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                  <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">目前尚無軟刪除或救援操作日誌</p>
                  <p className="text-[11px] text-slate-400 mt-1">任何軟刪除、還原或抹除操作均會在此留下審計軌跡</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">時間戳記</th>
                        <th className="py-3 px-4">操作人員</th>
                        <th className="py-3 px-4">動作標籤</th>
                        <th className="py-3 px-4">目標模組 / 資料表</th>
                        <th className="py-3 px-4">目標識別碼 / 名稱</th>
                        <th className="py-3 px-4">操作細節差異 (JSON Snapshot)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLogs.map(log => {
                        const isRestore = log.action.includes('救援還原') || log.action.includes('RESTORE');
                        const isPurge = log.action.includes('永久抹除') || log.action.includes('HARD_DELETE');
                        const isSoft = log.action.includes('軟刪除') || log.action.includes('SOFT_DELETE') || log.action.includes('刪除');

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {log.createdAt}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {log.userName}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                isRestore
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : isPurge
                                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-700">
                              {log.targetTable}
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold text-indigo-700">
                              {log.targetId}
                            </td>
                            <td className="py-3 px-4 text-[11px] text-slate-600 max-w-md">
                              <div className="space-y-0.5 font-mono text-[10.5px]">
                                {log.beforeJson && (
                                  <div className="truncate text-slate-500" title={log.beforeJson}>
                                    <span className="text-slate-400 font-bold">刪前:</span> {log.beforeJson}
                                  </div>
                                )}
                                {log.afterJson && (
                                  <div className="truncate text-indigo-800 font-medium" title={log.afterJson}>
                                    <span className="text-indigo-500 font-bold">結果:</span> {log.afterJson}
                                  </div>
                                )}
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
          )}

        </div>

        {/* 底部 Footer 統計與說明 */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>全域軟刪除保護中</span>
            </span>
            <span>
              已安全隔離軟刪除物件：<strong className="text-amber-700 font-mono font-bold">{totalDeletedCount}</strong> 筆
            </span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="hidden sm:inline text-[11px] text-slate-400">
              物理抹除（Hard Delete）僅供建檔測試殘留清理，正式專案建議維持軟刪除隔離
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            關閉救援中心
          </button>
        </div>
      </div>

      {/* ⚠️ 永久物理抹除二次防呆確認 Modal */}
      {purgeTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-300 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">永久物理抹除警告</h4>
                <p className="text-xs text-rose-600 font-semibold mt-0.5">此操作不可復原，僅 Superadmin 得以執行</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5 text-slate-700">
              <div>抹除目標：<strong className="text-slate-900">{purgeTarget.title}</strong></div>
              <p className="text-slate-500 leading-relaxed text-[11px]">
                確認執行後，此筆資料將從資料庫（或本機儲存）中<strong>永久物理清除</strong>。系統將在審計日誌中留存最終抹除紀錄與操作員帳號備查。
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPurgeTarget(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                取消保留
              </button>
              <button
                type="button"
                onClick={handleExecutePurge}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm cursor-pointer"
              >
                確認永久抹除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
