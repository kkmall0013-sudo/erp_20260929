import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Crown,
  Database,
  Download,
  Eye,
  EyeOff,
  FileCode,
  HardDrive,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  Upload,
  X
} from 'lucide-react';
import { User as ErpUser } from '../../types/erp';
import { changeSelfPassword } from '../../db/sqlite';
import { BackupFilePreview } from '../../utils/sqliteBackupUtils';

interface TopDbQuickMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onPickRestoreFile: () => void;
  onQuickBackupSqlite: () => void;
  onQuickBackupSql: () => void;
  onOpenDatabaseCenter?: () => void;
  onResetDatabase: () => void;
}

export const TopDbQuickMenu: React.FC<TopDbQuickMenuProps> = ({
  isOpen,
  onToggle,
  onClose,
  onPickRestoreFile,
  onQuickBackupSqlite,
  onQuickBackupSql,
  onOpenDatabaseCenter,
  onResetDatabase
}) => {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        title="資料庫匯出、匯入與備份管理"
        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
      >
        <Database className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden lg:inline text-[11px] font-medium">資料庫備份/還原</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-84 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2.5 z-50 text-xs animate-in fade-in space-y-1.5">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold text-white tracking-wide">
                本地 SQLite 資料庫協作與安全中樞
              </span>
            </div>
            <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
              IndexedDB 持久引擎
            </span>
          </div>

          <button
            onClick={onPickRestoreFile}
            className="w-full px-2.5 py-2 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700/50 text-left text-indigo-200 flex items-start gap-2.5 transition-all cursor-pointer group shadow-2xs"
          >
            <div className="p-1.5 rounded-md bg-indigo-600 text-white shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <Upload className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white flex items-center justify-between">
                <span>全庫檔案一鍵上傳還原</span>
                <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded font-mono font-bold">
                  極簡秒級
                </span>
              </div>
              <div className="text-[10px] text-indigo-300/80 mt-0.5">
                支援 .sqlite / .db / .sql · 1 秒覆蓋掛載並自動校準流水號
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              onQuickBackupSqlite();
              onClose();
            }}
            className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-left text-slate-200 flex items-start gap-2.5 transition-colors cursor-pointer"
          >
            <HardDrive className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white">下載 SQLite 快照 (.sqlite)</div>
              <div className="text-[10px] text-slate-400">二進位實體資料庫檔案 · 完整鏡像</div>
            </div>
          </button>

          <button
            onClick={() => {
              onQuickBackupSql();
              onClose();
            }}
            className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-left text-slate-200 flex items-start gap-2.5 transition-colors cursor-pointer"
          >
            <FileCode className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white">匯出全庫 SQL 指令稿 (.sql)</div>
              <div className="text-[10px] text-slate-400">標準 DDL 與純文字備份 · 跨平台通用</div>
            </div>
          </button>

          <div className="my-1 border-t border-slate-800" />

          {onOpenDatabaseCenter && (
            <button
              onClick={() => {
                onOpenDatabaseCenter();
                onClose();
              }}
              className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-left text-slate-200 flex items-start gap-2.5 transition-colors cursor-pointer"
            >
              <Database className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <span>歷史封存與進階管理中心</span>
                  <span className="text-[9px] bg-white/10 text-slate-300 px-1 py-0.2 rounded font-mono">完整彈窗</span>
                </div>
                <div className="text-[10px] text-slate-400">時段過濾 · 歷年唯讀封存 · 拖曳還原 · 結構審核</div>
              </div>
            </button>
          )}

          <button
            onClick={() => {
              onResetDatabase();
              onClose();
            }}
            className="w-full px-2.5 py-1.5 rounded-lg hover:bg-rose-950/40 text-left text-rose-300 flex items-start gap-2.5 transition-colors cursor-pointer border-t border-slate-800/80 pt-1.5"
          >
            <RotateCcw className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-200">重設出廠預設種子</div>
              <div className="text-[10px] text-rose-300/70">重灌初始業務範例種子</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

interface TopChangePasswordModalProps {
  isOpen: boolean;
  currentUser: ErpUser | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const TopChangePasswordModal: React.FC<TopChangePasswordModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSuccess
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!isOpen) return null;

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
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
      onSuccess('🎉 個人密碼已成功更新！');
    } catch (err: unknown) {
      setPasswordError((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in text-slate-800">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95">
        <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-xs">修改個人登入密碼</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSaveMyPassword} className="p-5 space-y-3.5 text-xs">
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <span>當前登入者：</span>
            <span className="font-bold text-slate-900">
              {currentUser?.fullName} (@{currentUser?.username})
            </span>
          </div>

          {passwordError && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium animate-in fade-in">
              ❌ {passwordError}
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              目前原始密碼 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showOldPass ? 'text' : 'password'}
                required
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
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

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              設定新密碼 (至少 6 位) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
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

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              再次確認新密碼 <span className="text-rose-500">*</span>
            </label>
            <input
              type={showNewPass ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
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
              onClick={onClose}
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
  );
};

interface TopDbRestoreConfirmModalProps {
  preview: BackupFilePreview | null;
  isRestoring: boolean;
  onBackupCurrent: () => void;
  onCancel: () => void;
  onConfirmRestore: () => void;
}

export const TopDbRestoreConfirmModal: React.FC<TopDbRestoreConfirmModalProps> = ({
  preview,
  isRestoring,
  onBackupCurrent,
  onCancel,
  onConfirmRestore
}) => {
  if (!preview) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden text-slate-900">
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">全庫備份檔案一鍵還原確認</h3>
              <p className="text-[11px] text-slate-400">Direct Full Database Restore</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              {preview.type === 'SQLITE' ? <HardDrive className="w-5 h-5" /> : <FileCode className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 truncate">{preview.name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold shrink-0 ${
                    preview.type === 'SQLITE'
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {preview.type === 'SQLITE' ? 'SQLite 3 實體二進位庫' : 'SQL 指令稿'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                檔案大小：<span className="font-mono font-bold text-slate-700">{preview.sizeFormatted}</span> · 檔案檢查完畢
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">安全提醒：執行還原將會以所選檔案完全取代目前系統中的所有資料表！</div>
              <div className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
                還原完成後系統將自動校準全模組單據流水號計數器，確保後續開單絕不撞號。建議先點擊下方防呆按鈕下載備份。
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onBackupCurrent}
              className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>還原前先下載當前庫備份防呆 (建議)</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirmRestore}
              disabled={isRestoring}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-300" />
              <span>{isRestoring ? '正在全庫還原中...' : '確認執行全庫覆蓋還原'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TopDevAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlockSuperadmin: () => void;
}

export const TopDevAuthModal: React.FC<TopDevAuthModalProps> = ({
  isOpen,
  onClose,
  onUnlockSuperadmin
}) => {
  const [devPasswordInput, setDevPasswordInput] = useState('');
  const [devAuthError, setDevAuthError] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs animate-in fade-in text-slate-800">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-xs tracking-wide">系統最高架構師 (Superadmin) 驗證登入</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={e => {
            e.preventDefault();
            if (devPasswordInput === '888888' || devPasswordInput === 'admin888') {
              setDevPasswordInput('');
              setDevAuthError(null);
              onUnlockSuperadmin();
            } else {
              setDevAuthError('驗證碼/密碼錯誤，拒絕存取！');
            }
          }}
          className="p-5 space-y-3.5 text-xs"
        >
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
            <div className="font-bold mb-1 flex items-center gap-1 text-amber-800">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>架構師極致隱身防護作用中</span>
            </div>
            依企業最高治理規範，Superadmin 帳號對外完全隱身（清單、選單、統計卡全數隱藏）。請輸入架構師密碼即可切換回最高權杖身分。
          </div>

          {devAuthError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium animate-in fade-in">
              ❌ {devAuthError}
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              架構師密碼 (預設: 888888) <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              autoFocus
              required
              value={devPasswordInput}
              onChange={e => {
                setDevPasswordInput(e.target.value);
                setDevAuthError(null);
              }}
              placeholder="請輸入架構師驗證密碼"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5 text-yellow-200" />
              <span>解鎖切換</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
