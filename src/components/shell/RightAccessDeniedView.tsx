import React from 'react';
import { Ban, Lock, ShieldAlert } from 'lucide-react';
import { ModuleKey, User, UserGroup } from '../../types/erp';
import { LeftNavId } from '../LeftSubWindow';

export const AccountDisabledOverlay: React.FC<{ currentUser: User }> = ({ currentUser }) => (
  <main className="flex-1 h-[calc(100vh-48px)] overflow-y-auto bg-[#eef1f5] flex items-center justify-center p-8 select-none">
    <div className="bg-white rounded-2xl border-2 border-rose-300 shadow-lg max-w-lg w-full p-8 text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
        <Ban className="w-9 h-9" />
      </div>
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <span>⛔ 帳號停權凍結攔截 (Account Disabled)</span>
      </div>
      <h2 className="text-lg font-bold text-slate-900">
        您的帳號「{currentUser.fullName} ({currentUser.username})」目前已停權凍結
      </h2>
      <p className="text-xs text-slate-600 leading-relaxed">
        系統安全核心已攔截此帳號的所有模組存取、單據讀取與簽核權限。若需恢復存取，請由上方模擬切換器切換回「最高管理員」或「系統管理員」，並前往【帳號與權限管理】將此帳號狀態改回「正常啟用」。
      </p>
    </div>
  </main>
);

interface ModuleAccessDeniedViewProps {
  pageTitle: string;
  activeNavId: LeftNavId;
  currentModuleKey: ModuleKey;
  currentUser: User | null;
  currentGroup: UserGroup | null;
  hasUserManagementAccess: boolean;
  onNavigateNav: (id: LeftNavId) => void;
}

export const ModuleAccessDeniedView: React.FC<ModuleAccessDeniedViewProps> = ({
  pageTitle,
  activeNavId,
  currentModuleKey,
  currentUser,
  currentGroup,
  hasUserManagementAccess,
  onNavigateNav
}) => (
  <main className="flex-1 h-[calc(100vh-48px)] overflow-y-auto bg-[#eef1f5] flex flex-col select-none">
    <div className="px-6 py-3.5 flex items-center justify-between shrink-0">
      <h1 className="text-xl font-normal text-slate-700 tracking-tight">
        {pageTitle}
      </h1>
    </div>
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-md max-w-xl w-full p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>PBAC 模組權限防火牆已攔截存取</span>
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          無權限存取【{pageTitle}】
        </h2>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-left text-xs space-y-2 text-slate-600">
          <div className="flex justify-between">
            <span className="text-slate-400">當前登入身分：</span>
            <span className="font-bold text-slate-800">{currentUser?.fullName} (@{currentUser?.username})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">所屬業務群組：</span>
            <span className="font-bold text-indigo-700">{currentGroup?.groupName || '未指派群組'} ({currentUser?.groupId})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">攔截原因：</span>
            <span className="font-bold text-rose-600">
              {activeNavId === 'USERS'
                ? '未開啟「帳號管理專人特許權 (canManageUsers)」'
                : `該業務群組於【${currentModuleKey}】模組之讀取權限為關閉 (read: 0)`}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          💡 測試提示：您可以切換至「林董總 (Superadmin)」或具備帳號管理權限之帳號，進入【帳號與權限管理】➔ 點擊「12 大模組權限矩陣」，即可動態開啟或關閉此群組對本模組的「讀 / 寫 / 審 / 出」權限！
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigateNav('DASHBOARD')}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            返回個人儀表板
          </button>
          {hasUserManagementAccess && (
            <button
              onClick={() => onNavigateNav('USERS')}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-xs transition-colors cursor-pointer"
            >
              前往調整群組權限矩陣
            </button>
          )}
        </div>
      </div>
    </div>
  </main>
);
