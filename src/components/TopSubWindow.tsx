import React, { useState, useRef } from 'react';
import { Company } from '../types/erp';
import {
  Menu,
  Bot,
  Bell,
  GraduationCap,
  MessageSquare,
  Grid,
  ChevronDown,
  Building2,
  Crown,
  Shield,
  User,
  Database,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  FileCode,
  HardDrive
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface TopSubWindowProps {
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onToggleLeftNav: () => void;
  onQuickBackupSql: () => void;
  onQuickBackupSqlite: () => void;
  onImportSql: (sqlText: string) => void;
  onResetDatabase: () => void;
  onOpenFlowchart: () => void;
}

export const TopSubWindow: React.FC<TopSubWindowProps> = ({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onToggleLeftNav,
  onQuickBackupSql,
  onQuickBackupSqlite,
  onImportSql,
  onResetDatabase,
  onOpenFlowchart,
}) => {
  const currentCompany = companies.find(c => c.id === selectedCompanyId) || companies[0];
  const { currentUser, allUsers, switchUser } = useAuth();
  const [isDbMenuOpen, setIsDbMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 處理匯入 SQL 檔案
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content && onImportSql) {
        onImportSql(content);
        setIsDbMenuOpen(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="h-12 bg-[#2d3a4b] text-white flex items-center justify-between px-3 shrink-0 select-none z-30 shadow-xs border-b border-slate-700/60">
      {/* 隱藏的檔案上傳輸入框 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".sql"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 左區：漢堡按鈕 + 鼎新 A1 品牌識別 */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleLeftNav}
          title="收合 / 展開左側子視窗"
          className="p-1.5 rounded hover:bg-slate-700/70 text-slate-300 hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-wide text-white">鼎新</span>
          <span className="text-slate-400 font-light text-sm">|</span>
          <span className="font-semibold text-sm text-slate-100">A1 商務應用雲</span>
          <span className="text-[10px] text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono hidden sm:inline">
            營造工程 ERP 引擎
          </span>
        </div>
      </div>

      {/* 中區：常駐法人資訊與公告條 (對應截圖中的體驗/法人狀態條) */}
      <div className="hidden md:flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 rounded-full px-3 py-1 text-xs">
        <Building2 className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-slate-400">營運法人：</span>
        <select
          value={selectedCompanyId}
          onChange={(e) => onSelectCompany(e.target.value)}
          className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer pr-1"
        >
          {companies.map(c => (
            <option key={c.id} value={c.id} className="bg-slate-800 text-white">
              [{c.companyCode}] {c.shortName || c.name} {c.taxId ? `(${c.taxId})` : c.nationalId ? `(${c.nationalId.slice(0, 4)}***)` : ''}
            </option>
          ))}
        </select>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>

      {/* 右區：長駐功能群 (資料庫備份/匯入、通知、線上學習、登入帳號、模組切換) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs text-slate-300">
        {/* 資料庫匯出/匯入快捷工具 (多人協作與測試備份) */}
        <div className="relative">
          <button
            onClick={() => setIsDbMenuOpen(prev => !prev)}
            title="資料庫匯出、匯入與備份管理 (協作測試專用)"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline text-[11px] font-medium">資料庫備份/還原</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isDbMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-60 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-2 z-50 text-xs animate-in fade-in space-y-1">
              <div className="px-2 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                本地 SQLite 資料庫協作中心
              </div>
              
              <button
                onClick={() => {
                  onQuickBackupSql();
                  setIsDbMenuOpen(false);
                }}
                className="w-full px-2.5 py-1.5 rounded hover:bg-slate-800 text-left text-slate-200 flex items-center gap-2 transition-colors"
              >
                <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-white">匯出 SQL 指令檔 (.sql)</div>
                  <div className="text-[10px] text-slate-400">完整結構與您新增的所有實體資料</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onQuickBackupSqlite();
                  setIsDbMenuOpen(false);
                }}
                className="w-full px-2.5 py-1.5 rounded hover:bg-slate-800 text-left text-slate-200 flex items-center gap-2 transition-colors"
              >
                <HardDrive className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <div className="font-semibold text-white">下載 SQLite 檔案 (.sqlite)</div>
                  <div className="text-[10px] text-slate-400">標準二進位資料庫快照</div>
                </div>
              </button>

              <div className="my-1 border-t border-slate-800" />

              <button
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="w-full px-2.5 py-1.5 rounded hover:bg-slate-800 text-left text-amber-300 flex items-center gap-2 transition-colors"
              >
                <Upload className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold text-amber-200">匯入 SQL 指令檔 (.sql)</div>
                  <div className="text-[10px] text-slate-400">供測試人員一鍵還原整套資料</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onResetDatabase();
                  setIsDbMenuOpen(false);
                }}
                className="w-full px-2.5 py-1.5 rounded hover:bg-rose-950/40 text-left text-rose-300 flex items-center gap-2 transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <div className="font-semibold text-rose-200">重設為初始預設資料庫</div>
                  <div className="text-[10px] text-slate-500">重灌原始系統種子</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* 智能助理 */}
        <button
          title="智能助理"
          className="flex flex-col sm:flex-row items-center gap-1 p-1 sm:px-2 rounded hover:text-white hover:bg-slate-700/60 transition-colors"
        >
          <Bot className="w-4 h-4 text-cyan-400" />
          <span className="hidden xl:inline text-[11px]">智能助理</span>
        </button>

        {/* 通知 */}
        <button
          title="系統通知"
          className="relative flex flex-col sm:flex-row items-center gap-1 p-1 sm:px-2 rounded hover:text-white hover:bg-slate-700/60 transition-colors"
        >
          <Bell className="w-4 h-4 text-slate-300" />
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-1 right-1" />
          <span className="hidden xl:inline text-[11px]">通知</span>
        </button>

        {/* 線上學習 */}
        <button
          title="線上學習與操作手冊"
          className="flex flex-col sm:flex-row items-center gap-1 p-1 sm:px-2 rounded hover:text-white hover:bg-slate-700/60 transition-colors"
        >
          <GraduationCap className="w-4 h-4 text-slate-300" />
          <span className="hidden xl:inline text-[11px]">線上學習</span>
        </button>

        {/* 帳號身分下拉 (截圖右上方之帳號區) */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700 ml-1">
          <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {currentUser?.fullName ? currentUser.fullName.slice(0, 1) : '帳'}
          </div>

          <div className="relative">
            <select
              value={currentUser?.id || ''}
              onChange={(e) => switchUser(e.target.value)}
              title="切換操作身分"
              className="bg-slate-800 text-[11px] text-slate-200 border border-slate-700 rounded px-1.5 py-0.5 outline-none cursor-pointer max-w-[95px] sm:max-w-[120px] truncate"
            >
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 模組切換九宮格按鈕 (對應截圖最右上角之 [模組切換]) */}
        <button
          onClick={onOpenFlowchart}
          title="點擊切換鼎新 A1 業務流程地圖"
          className="ml-1 px-2.5 py-1 rounded bg-[#3b4b5e] hover:bg-indigo-600 text-white flex items-center gap-1.5 transition-colors border border-slate-600 shadow-2xs font-medium"
        >
          <Grid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-xs font-semibold">模組切換</span>
        </button>
      </div>
    </header>
  );
};
