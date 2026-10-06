import React from 'react';
import { Company } from '../types/erp';
import { Building2, Database, Download, ShieldCheck, Crown, Shield, Users, Search, Columns2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onQuickBackupSql: () => void;
  onQuickBackupSqlite: () => void;
  isSubWindowOpen?: boolean;
  onToggleSubWindow?: () => void;
  onOpenDatabaseCenter?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onQuickBackupSql,
  onQuickBackupSqlite,
  isSubWindowOpen = true,
  onToggleSubWindow,
  onOpenDatabaseCenter,
}) => {
  const currentCompany = companies.find(c => c.id === selectedCompanyId) || companies[0];
  const { currentUser, currentGroup, currentGroups, allUsers, switchUser } = useAuth();

  return (
    <header className="h-16 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between px-6 shrink-0 sticky top-0 z-30 select-none">
      {/* 品牌與公司識別 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm shadow-indigo-500/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              客製化營造工程 ERP
              <span className="text-xs font-normal text-slate-400 border border-slate-700 rounded px-1.5 py-0.5">
                鼎新 A1 旗艦外殼
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              三層視窗架構 · 左欄固定右欄滾動 · 單一模組聚焦精雕
            </p>
          </div>
        </div>

        {/* 多法人公司切換器 */}
        <div className="hidden lg:flex items-center gap-2 ml-6 pl-6 border-l border-slate-800">
          <span className="text-xs text-slate-400">營運法人：</span>
          <select
            value={selectedCompanyId}
            onChange={(e) => onSelectCompany(e.target.value)}
            className="bg-slate-800 text-xs font-medium text-slate-200 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            {companies.map(c => (
              <option key={c.id} value={c.id}>
                [{c.companyCode}] {c.name} ({c.taxId})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 快捷操作區 */}
      <div className="flex items-center gap-3">
        {/* 左側子視窗開關 (核心焦點) */}
        {onToggleSubWindow && (
          <button
            onClick={onToggleSubWindow}
            title={isSubWindowOpen ? '點擊收合左側子視窗 (最大化右側主畫布)' : '點擊展開左側子視窗 (鼎新案場清單模式)'}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 shadow-sm border ${
              isSubWindowOpen
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-indigo-900/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:text-white'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5 text-indigo-300" />
            <span className="font-semibold">{isSubWindowOpen ? '已開左子視窗' : '展開子視窗'}</span>
          </button>
        )}

        {/* 資料庫管理與封存中心按鈕 */}
        {onOpenDatabaseCenter && (
          <button
            onClick={onOpenDatabaseCenter}
            title="開啟資料庫管理與歷史封存中心 (支援模組化備份、年度封存與資料檢視)"
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 shadow-sm border bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:text-white cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">資料庫中心</span>
          </button>
        )}

        {/* SQL 備份快速捷徑 */}
        <div className="hidden sm:flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-md p-1">
          <button
            onClick={onQuickBackupSql}
            title="一鍵匯出完整 .sql DDL & INSERT 指令稿"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>匯出 SQL</span>
          </button>
          <div className="w-[1px] h-4 bg-slate-700" />
          <button
            onClick={onQuickBackupSqlite}
            title="下載二進位 SQLite 資料庫備份檔案 (.sqlite)"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>備份 .sqlite</span>
          </button>
        </div>

        {/* 使用者身分與即時切換 */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
          <div
            className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold ${
              currentUser?.role === 'SUPERADMIN'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : currentUser?.role === 'ADMIN'
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                : 'bg-slate-700 text-slate-200 border-slate-600'
            }`}
          >
            {currentUser?.fullName ? currentUser.fullName.slice(0, 1) : '用'}
          </div>

          <div className="hidden sm:block text-left text-xs leading-tight">
            <div className="font-semibold text-slate-200 flex items-center gap-1">
              <span>{currentUser?.fullName || '未指定'}</span>
            </div>
            <div className="text-[10px] flex items-center gap-1 mt-0.5">
              {currentUser?.role === 'SUPERADMIN' && (
                <span className="text-amber-400 font-bold flex items-center gap-0.5">
                  <Crown className="w-2.5 h-2.5" />
                  Superadmin
                </span>
              )}
              {currentUser?.role === 'ADMIN' && (
                <span className="text-indigo-400 font-semibold flex items-center gap-0.5">
                  <Shield className="w-2.5 h-2.5" />
                  Admin
                </span>
              )}
              {currentUser?.role === 'USER' && (
                <span className="text-slate-300 flex items-center gap-0.5">
                  <Users className="w-2.5 h-2.5 text-slate-400" />
                  {currentGroups.length > 1
                    ? `${currentGroups.map(g => g.groupName).join(' + ')}`
                    : currentGroup?.groupName || 'User'}
                </span>
              )}
            </div>
          </div>

          {/* 身分切換快捷下拉 */}
          <div className="ml-1">
            <select
              value={currentUser?.id || ''}
              onChange={(e) => switchUser(e.target.value)}
              title="切換模擬身分以測試 PBAC 權限"
              className="bg-slate-800 text-[11px] text-slate-300 border border-slate-700 rounded px-1.5 py-1 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer max-w-[120px] truncate"
            >
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.role === 'SUPERADMIN' ? '👑 ' : u.role === 'ADMIN' ? '🛡️ ' : '👤 '}
                  {u.fullName} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
