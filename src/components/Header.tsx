import React from 'react';
import { Company } from '../types/erp';
import { Building2, Database, Download, ShieldCheck, Search, Bell } from 'lucide-react';

interface HeaderProps {
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onQuickBackupSql: () => void;
  onQuickBackupSqlite: () => void;
  onOpenDatabaseManager: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onQuickBackupSql,
  onQuickBackupSqlite,
  onOpenDatabaseManager,
}) => {
  const currentCompany = companies.find(c => c.id === selectedCompanyId) || companies[0];

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
                鼎新 A1 流程引擎
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
            className="w-56 lg:w-72 bg-slate-800/80 border border-slate-700/80 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Database className="w-3.5 h-3.5" />
          <span>資料庫管理</span>
        </button>

        {/* 使用者身分 */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-300">
            黃
          </div>
          <div className="text-left text-xs leading-tight">
            <div className="font-medium text-slate-200">黃副總經理</div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400 inline" />
              超級權限
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
