import React from 'react';
import {
  AlertCircle,
  Archive,
  Check,
  Clock,
  Crown,
  Flame,
  KeyRound,
  RotateCcw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { User } from '../../../types/erp';
import { AlertModalState } from './accountManagementUtils';

interface AccountAlertModalProps {
  alertModal: AlertModalState | null;
  onClose: () => void;
}

export const AccountAlertModal: React.FC<AccountAlertModalProps> = ({ alertModal, onClose }) => {
  if (!alertModal) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border-2 border-rose-300 w-full max-w-md overflow-hidden animate-in zoom-in-95">
        <div className="p-5 flex items-start gap-3.5 bg-rose-50/60 border-b border-rose-100">
          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-extrabold text-sm text-rose-950 leading-snug">
              {alertModal.title}
            </h3>
            <p className="text-xs text-rose-800 mt-1.5 leading-relaxed font-medium">
              {alertModal.message}
            </p>
            {alertModal.details && (
              <p className="text-[11px] text-slate-600 mt-2 p-2 bg-white/80 rounded border border-rose-200 leading-normal">
                {alertModal.details}
              </p>
            )}
          </div>
        </div>
        <div className="px-5 py-3.5 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>確認瞭解</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface PasswordResetModalProps {
  resetModalUser: User | null;
  newPasswordInput: string;
  onPasswordChange: (val: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  resetModalUser,
  newPasswordInput,
  onPasswordChange,
  onClose,
  onConfirm,
}) => {
  if (!resetModalUser) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95">
        <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-xs">重設同仁登入密碼</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[11px]">目標同仁：</div>
            <div className="font-bold text-slate-800 text-sm mt-0.5">
              {resetModalUser.fullName} (@{resetModalUser.username})
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">身分角色：{resetModalUser.role}</div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">設定新密碼</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPasswordInput}
                onChange={e => onPasswordChange(e.target.value)}
                placeholder="請輸入新密碼"
                className="flex-1 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => onPasswordChange('888888')}
                className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-semibold whitespace-nowrap cursor-pointer"
              >
                預設 888888
              </button>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              重設後同仁將能以此新密碼登入，該紀錄會寫入全域審計日誌。
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>確認重設</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface TransferSuperadminModalProps {
  isOpen: boolean;
  allUsers: User[];
  transferTargetId: string;
  transferConfirmText: string;
  onTargetChange: (val: string) => void;
  onConfirmTextChange: (val: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const TransferSuperadminModal: React.FC<TransferSuperadminModalProps> = ({
  isOpen,
  allUsers,
  transferTargetId,
  transferConfirmText,
  onTargetChange,
  onConfirmTextChange,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-amber-300 w-full max-w-md overflow-hidden animate-in zoom-in-95">
        <div className="px-5 py-3.5 bg-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-white" />
            <span className="font-bold text-sm">最高權限交接程序 (Transfer Superadmin)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-amber-200 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>最高指揮權讓渡注意事項</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              系統唯一最高管理員（Superadmin）具備不可撼動之全域最高控制權。交接完成後，您（現任 Superadmin）將自動轉為系統管理員（Admin），而所選對象將即刻接掌唯一的 Superadmin 權杖。
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              選擇交接對象同仁 <span className="text-rose-500">*</span>
            </label>
            <select
              value={transferTargetId}
              onChange={e => onTargetChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-amber-500"
            >
              <option value="">-- 請選擇要移轉權限的同仁 --</option>
              {allUsers
                .filter(u => u.role !== 'SUPERADMIN' && u.role !== 'BOSS' && u.status === 'ACTIVE')
                .map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} (@{u.username}) - {u.role} ({u.title || '無職稱'})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              安全防呆驗證 <span className="text-rose-500">*</span>
            </label>
            <p className="text-[11px] text-slate-400 mb-1.5">
              請在下方輸入文字「
              <span className="font-bold text-amber-700 select-all">確認交接最高權限</span>
              」以確認執行：
            </p>
            <input
              type="text"
              value={transferConfirmText}
              onChange={e => onConfirmTextChange(e.target.value)}
              placeholder="確認交接最高權限"
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={transferConfirmText.trim() !== '確認交接最高權限' || !transferTargetId}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>執行交接</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeleteToTrashConfirmModalProps {
  user: User | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteToTrashConfirmModal: React.FC<DeleteToTrashConfirmModalProps> = ({
  user,
  onCancel,
  onConfirm,
}) => {
  if (!user) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-rose-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
        <div className="px-5 py-4 bg-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-white" />
            <h3 className="font-bold text-sm">第一階段：移入待刪除回收站 (7日冷卻)</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-amber-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-950">
                您確定要將同仁【{user.fullName}】移入待刪除回收站嗎？
              </p>
              <p className="text-amber-800 leading-relaxed text-[11px]">
                移入後該同仁帳號將自【同仁主檔】移除並停用登入，享有{' '}
                <span className="font-bold text-amber-950 underline decoration-amber-400">
                  7 天冷卻保護期
                </span>
                。冷卻期內可隨時在「待刪除回收站」一鍵復原。若 7 天屆滿，系統將自動移交 Superadmin 深度封存區。
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2 text-slate-700 text-xs">
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
              <span className="text-slate-400">同仁姓名：</span>
              <span className="font-bold text-slate-800">{user.fullName}</span>
            </div>
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
              <span className="text-slate-400">登入帳號：</span>
              <span className="font-mono text-indigo-700 font-bold">@{user.username}</span>
            </div>
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
              <span className="text-slate-400">身分層級：</span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded text-[11px] ${
                  user.role === 'ADMIN'
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {user.role === 'ADMIN' ? '系統管理員 (ADMIN)' : '業務同仁 (USER)'}
              </span>
            </div>
            {user.title && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">職務職稱：</span>
                <span className="text-slate-700">{user.title}</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>移入待刪回收站 (7日冷卻)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface AdvanceToArchiveConfirmModalProps {
  user: User | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const AdvanceToArchiveConfirmModal: React.FC<AdvanceToArchiveConfirmModalProps> = ({
  user,
  onCancel,
  onConfirm,
}) => {
  if (!user) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-md overflow-hidden animate-in zoom-in-95">
        <div className="px-5 py-4 bg-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm">確認提前送往 Superadmin 深度封存區</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-700 leading-relaxed">
            確定要將同仁【<span className="font-bold text-slate-900">{user.fullName}</span>】（@{user.username}）提前二次刪除送往 Superadmin 深度封存區嗎？
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed space-y-1">
            <div className="font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
              <span>權限移交提醒</span>
            </div>
            <p>
              送交封存後，該筆同仁資料將自「待刪除回收站」移除，一般 Admin 視角將
              <strong>徹底隱藏且無法再執行復原</strong>
              ，僅唯獨 Superadmin 擁有終極救援與物理清除之權力。
            </p>
          </div>
        </div>
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>確認送往封存區</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface PermanentPurgeConfirmModalProps {
  user: User | null;
  confirmInput: string;
  onInputChange: (val: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export const PermanentPurgeConfirmModal: React.FC<PermanentPurgeConfirmModalProps> = ({
  user,
  confirmInput,
  onInputChange,
  onCancel,
  onConfirm,
}) => {
  if (!user) return null;
  const isUnlocked = confirmInput.trim() === '確認永久物理清除';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-rose-300 w-full max-w-md overflow-hidden animate-in zoom-in-95">
        <div className="px-5 py-4 bg-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-white" />
            <h3 className="font-bold text-sm">Superadmin 終極物理粉碎清除</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-rose-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1.5 leading-relaxed">
            <div className="font-bold flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>危險操作：資料庫實體不可逆抹除</span>
            </div>
            <p className="text-[11px] text-rose-800">
              您即將從資料庫中<strong>永久刪除</strong>同仁【
              <span className="font-bold">{user.fullName}</span>】（@{user.username}）之使用者實體記錄。本動作無法撤銷！
            </p>
            <p className="text-[11px] text-rose-800">
              依系統單據血緣防護設計，歷史單據將純淨保留其姓名純文字快照，單據內容絕不留白。
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1.5 text-xs">
              請輸入安全確認詞以解鎖清除：
              <span className="font-mono text-rose-600 select-all font-bold">確認永久物理清除</span>
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={e => onInputChange(e.target.value)}
              placeholder="請在此輸入「確認永久物理清除」..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
            />
          </div>
        </div>
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!isUnlocked}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm transition-all flex items-center gap-1.5 ${
              isUnlocked
                ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer'
                : 'bg-slate-300 cursor-not-allowed opacity-60'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>執行永久物理粉碎清除</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface AccountUndoToastProps {
  undoToast: { user: User; countdown: number } | null;
  onUndo: () => void;
  onDismiss: () => void;
}

export const AccountUndoToast: React.FC<AccountUndoToastProps> = ({
  undoToast,
  onUndo,
  onDismiss,
}) => {
  if (!undoToast) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[90] flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">🗑️</span>
        <div className="text-xs">
          <p className="font-bold">已刪除同仁【{undoToast.user.fullName}】帳號</p>
          <p className="text-[11px] text-slate-400">
            防呆復原倒數：
            <span className="font-mono text-amber-400 font-bold">{undoToast.countdown}s</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <button
          type="button"
          onClick={onUndo}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>一鍵復原 ({undoToast.countdown}s)</span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
          title="關閉提示"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
