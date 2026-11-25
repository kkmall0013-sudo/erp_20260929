import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  X,
  Search,
  History,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { AuditLog } from '../../types/erp';
import { getAllAuditLogs, subscribeToDatabase } from '../../db/sqlite';
import { useAuth } from '../../context/AuthContext';
import {
  RecoveryEntityKey,
  SOFT_DELETE_REGISTRY
} from '../../utils/softDeleteRegistry';
import { RecoveryEntityTable } from './RecoveryEntityTable';
import { RecoveryAuditLogsTab } from './RecoveryAuditLogsTab';
import { ConfirmDialogModal } from './ConfirmDialogModal';

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

  const [activeTab, setActiveTab] = useState<RecoveryEntityKey | 'LOGS'>('ASSETS');
  const [searchTerm, setSearchTerm] = useState('');

  const [deletedByEntity, setDeletedByEntity] = useState<Record<RecoveryEntityKey, any[]>>({
    ASSETS: [],
    RECEIPTS: [],
    PROJECTS: [],
    PARTNERS: [],
    COMPANIES: []
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [purgeTarget, setPurgeTarget] = useState<{
    key: RecoveryEntityKey;
    id: string;
    title: string;
  } | null>(null);

  const loadDeletedData = () => {
    try {
      const next: Record<RecoveryEntityKey, any[]> = {
        ASSETS: [],
        RECEIPTS: [],
        PROJECTS: [],
        PARTNERS: [],
        COMPANIES: []
      };
      for (const cfg of SOFT_DELETE_REGISTRY) {
        next[cfg.key] = cfg.getDeletedList();
      }
      setDeletedByEntity(next);
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

  const totalDeletedCount = useMemo(
    () => Object.values(deletedByEntity).reduce((sum, list) => sum + list.length, 0),
    [deletedByEntity]
  );

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

  const filteredLogs = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return recoveryAuditLogs.filter(
      l =>
        l.action.toLowerCase().includes(term) ||
        l.userName.toLowerCase().includes(term) ||
        l.targetTable.toLowerCase().includes(term) ||
        (l.targetId && l.targetId.toLowerCase().includes(term))
    );
  }, [recoveryAuditLogs, searchTerm]);

  const activeConfig = useMemo(
    () => SOFT_DELETE_REGISTRY.find(c => c.key === activeTab),
    [activeTab]
  );

  const filteredActiveItems = useMemo(() => {
    if (!activeConfig) return [];
    const list = deletedByEntity[activeConfig.key] || [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return list;
    return list.filter(item =>
      activeConfig.getSearchFields(item).some(f => f && f.toLowerCase().includes(term))
    );
  }, [activeConfig, deletedByEntity, searchTerm]);

  const handleRestoreItem = (item: any) => {
    if (!activeConfig) return;
    const operator = currentUser?.fullName || 'Superadmin';
    try {
      const ok = activeConfig.restore(item.id, operator);
      if (ok) {
        loadDeletedData();
        triggerToast?.(activeConfig.getRestoreToast(item), 'success');
        onDataRestored?.();
      } else {
        triggerToast?.(`❌ 救援${activeConfig.label}失敗`, 'error');
      }
    } catch (e: any) {
      triggerToast?.(`❌ 救援失敗：${e?.message || String(e)}`, 'error');
    }
  };

  const handleExecutePurge = () => {
    if (!purgeTarget) return;
    const cfg = SOFT_DELETE_REGISTRY.find(c => c.key === purgeTarget.key);
    if (!cfg) return;
    const operator = currentUser?.fullName || 'Superadmin';
    try {
      cfg.purge(purgeTarget.id, operator);
      triggerToast?.(
        `🗑️ 已永久物理抹除【${purgeTarget.title}】，資料已自資料庫徹底清除，日誌軌跡已永久存檔備查`,
        'warn'
      );
      setPurgeTarget(null);
      loadDeletedData();
      onDataRestored?.();
    } catch (e: any) {
      setPurgeTarget(null);
      triggerToast?.(`⛔ 物理抹除攔截：${e?.message || String(e)}`, 'error');
    }
  };

  if (!isOpen) return null;

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
            type="button"
            onClick={onClose}
            className="mt-5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg cursor-pointer"
          >
            關閉視窗
          </button>
        </div>
      </div>
    );
  }

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
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-tight">
                  最高架構師軟刪除救援中心
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 font-mono">
                  Superadmin 專屬救援通道
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                  兩階段刪除防護 · 全面審計 Log
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                避免誤刪全面實施軟刪除機制：Admin 與一般同仁刪除後全部隱蔽，僅 Superadmin 得以檢視救回或二次確認物理抹除。
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

        {/* 次導航工具列：由 SOFT_DELETE_REGISTRY 動態產生分頁與搜尋 */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {SOFT_DELETE_REGISTRY.map(cfg => {
              const Icon = cfg.icon;
              const isActive = activeTab === cfg.key;
              const count = deletedByEntity[cfg.key]?.length || 0;
              return (
                <button
                  key={cfg.key}
                  type="button"
                  onClick={() => setActiveTab(cfg.key)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cfg.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive ? 'bg-amber-800 text-amber-100' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setActiveTab('LOGS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'LOGS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>📜 刪除/救援審計日誌</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === 'LOGS' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {recoveryAuditLogs.length}
              </span>
            </button>
          </div>

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
          {activeTab === 'LOGS' ? (
            <RecoveryAuditLogsTab logs={filteredLogs} />
          ) : (
            activeConfig && (
              <RecoveryEntityTable
                config={activeConfig}
                items={filteredActiveItems}
                onRestore={handleRestoreItem}
                onRequestPurge={item =>
                  setPurgeTarget({
                    key: activeConfig.key,
                    id: item.id,
                    title: activeConfig.getPurgeTitle(item)
                  })
                }
              />
            )
          )}
        </div>

        {/* 底部 Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>全域兩階段軟刪除保護中</span>
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

      {/* ⚠️ 共用二次確認：永久物理抹除警告 */}
      <ConfirmDialogModal
        isOpen={Boolean(purgeTarget)}
        title="永久物理抹除警告（不可復原）"
        variant="danger"
        message={
          <>
            您即將永久物理抹除：【<strong className="text-slate-900">{purgeTarget?.title}</strong>】。確認執行後，此筆資料將從資料庫中徹底清除，僅 Superadmin 得以執行。
          </>
        }
        extraNotice="系統將依各模組關聯完整性進行安全檢查，並於審計日誌保留最終抹除紀錄與操作員帳號備查。"
        confirmText="確認永久抹除"
        cancelText="取消保留"
        onConfirm={handleExecutePurge}
        onCancel={() => setPurgeTarget(null)}
      />
    </div>
  );
};
