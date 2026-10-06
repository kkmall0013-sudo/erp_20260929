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
  HardDrive,
  KeyRound,
  Eye,
  EyeOff,
  X,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { changeSelfPassword } from '../db/sqlite';

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
  onOpenDatabaseCenter?: () => void;
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
  onOpenDatabaseCenter,
}) => {
  const currentCompany = companies.find(c => c.id === selectedCompanyId) || companies[0];
  const { currentUser, allUsers, switchUser } = useAuth();
  const [isDbMenuOpen, setIsDbMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 自主修改密碼對話框狀態
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccessToast, setPasswordSuccessToast] = useState<string | null>(null);

  const handleOpenPasswordModal = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowOldPass(false);
    setShowNewPass(false);
    setPasswordError(null);
    setIsPasswordModalOpen(true);
  };

  const handleSaveMyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!currentUser) return;

    if (!oldPassword.trim()) {
      setPasswordError('請輸入目前原始密碼！');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('新密碼長度至少需為 6 個字元！');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('兩次輸入的新密碼不相符，請再次確認！');
      return;
    }

    try {
      changeSelfPassword(currentUser.id, oldPassword, newPassword, confirmPassword);
      setIsPasswordModalOpen(false);
      setPasswordSuccessToast('🎉 個人密碼已成功更新！');
      setTimeout(() => setPasswordSuccessToast(null), 3500);
    } catch (err: unknown) {
      setPasswordError((err as Error).message);
    }
  };

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
            <div className="absolute right-0 mt-1.5 w-68 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-2 z-50 text-xs animate-in fade-in space-y-1">
              <div className="px-2 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                本地 SQLite 資料庫協作與封存中心
              </div>

              {onOpenDatabaseCenter && (
                <button
                  onClick={() => {
                    onOpenDatabaseCenter();
                    setIsDbMenuOpen(false);
                  }}
                  className="w-full px-2.5 py-1.5 rounded hover:bg-indigo-900/40 text-left text-indigo-300 flex items-center gap-2 transition-colors border-b border-slate-800 pb-2 mb-1 cursor-pointer"
                >
                  <Database className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      <span>開啟資料庫與歷史封存中心</span>
                      <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1 py-0.2 rounded font-mono">NEW</span>
                    </div>
                    <div className="text-[10px] text-slate-400">模組化可選還原 · 年度死資料封存 · 資料檢視</div>
                  </div>
                </button>
              )}
              
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
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
            currentUser?.role === 'SUPERADMIN'
              ? 'bg-amber-500 shadow-2xs'
              : currentUser?.role === 'ADMIN'
              ? 'bg-indigo-600'
              : 'bg-emerald-600'
          }`}>
            {currentUser?.fullName ? currentUser.fullName.slice(0, 1) : '帳'}
          </div>

          <div className="relative flex items-center gap-1">
            <select
              value={currentUser?.id || ''}
              onChange={(e) => switchUser(e.target.value)}
              title="切換操作身分"
              className="bg-slate-800 text-[11px] text-slate-200 border border-slate-700 rounded px-1.5 py-0.5 outline-none cursor-pointer max-w-[105px] sm:max-w-[130px] truncate"
            >
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role}{u.status === 'DISABLED' ? ' [停用]' : ''}{u.role === 'SUPERADMIN' ? ' 👑' : ''}{u.role === 'ADMIN' && u.canManageUsers ? ' 🔑' : ''}{u.role === 'ADMIN' && u.canManageSystemConfigs ? ' 🛡️' : ''}{u.role === 'ADMIN' && u.canManageAdmins ? ' ⚡' : ''})
                </option>
              ))}
            </select>
            {currentUser?.status === 'DISABLED' && (
              <span className="px-1.5 py-0.2 rounded bg-rose-900/90 text-rose-200 border border-rose-700 text-[10px] font-bold whitespace-nowrap">
                已停用
              </span>
            )}
          </div>

          {/* 修改個人密碼按鈕 */}
          <button
            onClick={handleOpenPasswordModal}
            title="修改自己登入密碼 (驗證舊密碼與兩次新密碼)"
            className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline text-[11px]">改密碼</span>
          </button>
        </div>

        {/* 模組切換九宮格按鈕 (對應截圖最右上角之 [模組切換]) */}
        <button
          onClick={onOpenFlowchart}
          title="點擊切換鼎新 A1 業務流程地圖"
          className="ml-1 px-2.5 py-1 rounded bg-[#3b4b5e] hover:bg-indigo-600 text-white flex items-center gap-1.5 transition-colors border border-slate-600 shadow-2xs font-medium cursor-pointer"
        >
          <Grid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-xs font-semibold">模組切換</span>
        </button>
      </div>

      {/* 修改密碼成功浮動提示 */}
      {passwordSuccessToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-2xl text-xs font-semibold z-50 animate-in fade-in flex items-center gap-2 border border-slate-700">
          <span>{passwordSuccessToast}</span>
        </div>
      )}

      {/* 自主修改個人密碼對話框 (Centered Modal) */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in text-slate-800">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs">修改個人登入密碼</span>
              </div>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMyPassword} className="p-5 space-y-3.5 text-xs">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                <span>當前登入者：</span>
                <span className="font-bold text-slate-900">{currentUser?.fullName} (@{currentUser?.username})</span>
              </div>

              {passwordError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium animate-in fade-in">
                  ❌ {passwordError}
                </div>
              )}

              {/* 原始密碼 */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  目前原始密碼 <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showOldPass ? 'text' : 'password'}
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="請輸入目前密碼"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 pr-8 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showOldPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* 設定新密碼 */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  設定新密碼 (至少 6 位) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="請設定新密碼"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 pr-8 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* 再次確認新密碼 */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  再次確認新密碼 <span className="text-rose-500">*</span>
                </label>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="請再次輸入新密碼"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <span className="text-[10px] text-rose-500 mt-0.5 block">兩次輸入密碼不相符</span>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>確認變更密碼</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
