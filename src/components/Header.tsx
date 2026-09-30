import React, { useState } from 'react';
import { Company, User } from '../types/erp';
import {
  Building2,
  Database,
  Download,
  ShieldCheck,
  Search,
  Users,
  LogOut,
  ChevronDown,
  LogIn,
  UserCheck
} from 'lucide-react';

interface HeaderProps {
  companies: Company[];
  selectedCompanyId: string;
  currentUser: User | null;
  onSelectCompany: (companyId: string) => void;
  onQuickBackupSql: () => void;
  onQuickBackupSqlite: () => void;
  onOpenDatabaseManager: () => void;
  onOpenUserPermissions: () => void;
  onOpenSwitchUserModal: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  companies,
  selectedCompanyId,
  currentUser,
  onSelectCompany,
  onQuickBackupSql,
  onQuickBackupSqlite,
  onOpenDatabaseManager,
  onOpenUserPermissions,
  onOpenSwitchUserModal,
  onLogout,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="h-16 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between px-6 shrink-0 sticky top-0 z-30">
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
                全流程業務引擎
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              全模組資料庫 · SQLite 隨選備份 · 憲法級防呆內控
            </p>
          </div>
        </div>

        {/* 多法人公司切換器 */}
        <div className="hidden lg:flex items-center gap-2 ml-6 pl-6 border-l border-slate-800">
          <span className="text-xs text-slate-400">營運法人：</span>
          <select
            value={selectedCompanyId}
            onChange={(e) => onSelectCompany(e.target.value)}
            className="bg-slate-800 text-xs font-medium text-slate-200 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {companies.map(c => (
              <option key={c.id} value={c.id}>
                [{c.companyCode}] {c.name} ({c.taxId})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 搜尋與快速操作區 */}
      <div className="flex items-center gap-3">
        {/* 全域快速搜尋 */}
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="搜尋單據、案場、統編或下包..."
            className="w-48 lg:w-64 bg-slate-800/80 border border-slate-700/80 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* SQL 備份快速捷徑 */}
        <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-md p-1">
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

        {/* 資料庫總覽按鈕 */}
        <button
          onClick={onOpenDatabaseManager}
          className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 shadow-sm"
          title="開啟 SQLite 備份與 SQL 匯出管理"
        >
          <Database className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">資料庫</span>
        </button>

        {/* 帳號權限管理專用快捷按鈕（明顯可見） */}
        <button
          onClick={onOpenUserPermissions}
          className="px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow-sm"
          title="開啟帳號與權限管理模組 (使用者清單、角色 PBAC 矩陣與資安防護)"
        >
          <Users className="w-3.5 h-3.5" />
          <span>帳號權限</span>
        </button>

        {/* 未登入時顯示的登入按鈕 */}
        {!currentUser && (
          <button
            onClick={onOpenSwitchUserModal}
            className="px-3.5 py-1.5 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 shadow-sm"
            title="登入系統或切換員工身分"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>登入系統</span>
          </button>
        )}

        {/* 使用者身分與帳號選單 */}
        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 transition-colors border border-slate-700"
              title="點擊查看帳號資訊或切換身分"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-600 border border-indigo-400/40 flex items-center justify-center text-xs font-bold text-white shadow-xs">
                {currentUser.fullName.slice(0, 1)}
              </div>
              <div className="text-left text-xs leading-tight hidden sm:block">
                <div className="font-semibold text-slate-200 flex items-center gap-1">
                  <span>{currentUser.fullName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({currentUser.username})</span>
                </div>
                <div className="text-[10px] text-indigo-300 flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 inline" />
                  <span>{currentUser.role}</span>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* 下拉選單 */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-60 rounded-xl bg-white text-slate-800 shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-900">{currentUser.fullName}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{currentUser.email}</div>
                  <div className="text-[10px] text-indigo-600 font-mono mt-0.5">員編: {currentUser.employeeId} · 角色: {currentUser.role}</div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenUserPermissions();
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                  >
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span>帳號權限管理 (PBAC 權限矩陣)</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenSwitchUserModal();
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 font-medium"
                  >
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span>切換登入身分 (切換帳號)</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenDatabaseManager();
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                  >
                    <Database className="w-4 h-4 text-amber-600" />
                    <span>SQLite 備份與 SQL 匯出</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>登出系統</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
