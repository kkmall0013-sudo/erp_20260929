import React from 'react';
import { ArrowRightLeft, Crown, FileSpreadsheet, Shield, Users } from 'lucide-react';
import { User } from '../../../types/erp';

interface AccountOverviewCardsProps {
  isSuperadmin: boolean;
  superadminUser?: User;
  bossUser?: User;
  adminUsers: User[];
  userManagerAdmins: User[];
  configAdmins: User[];
  peerAdmins: User[];
  regularUsers: User[];
  allUsers: User[];
  onOpenTransferModal: () => void;
  onOpenMatrixModal: () => void;
}

export const AccountOverviewCards: React.FC<AccountOverviewCardsProps> = ({
  isSuperadmin,
  superadminUser,
  bossUser,
  adminUsers,
  userManagerAdmins,
  configAdmins,
  peerAdmins,
  regularUsers,
  allUsers,
  onOpenTransferModal,
  onOpenMatrixModal,
}) => {
  return (
    <div className={`grid grid-cols-1 ${isSuperadmin ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3.5`}>
      {/* 卡片 1: Superadmin 最高架構師 (僅 Superadmin 本人可見) */}
      {isSuperadmin && (
        <div className="bg-white rounded-xl border border-amber-300 p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold shadow-2xs">
                <Crown className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">系統架構師</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                    SUPERADMIN
                  </span>
                </div>
                <div className="text-xs font-extrabold text-slate-900 mt-0.5 truncate max-w-[120px]">
                  {superadminUser ? superadminUser.fullName : '尚未指定'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenTransferModal}
              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              title="現任 Superadmin 發起最高權限安全讓渡"
            >
              <ArrowRightLeft className="w-3 h-3" />
              <span>交接</span>
            </button>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span>隱密底層維護</span>
            <span className="font-mono text-amber-700 font-semibold">底層架構</span>
          </div>
        </div>
      )}

      {/* 卡片 2: 企業最高統裁 (集團董事長 BOSS) */}
      <div className="bg-white rounded-xl border-2 border-amber-300 p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between bg-gradient-to-br from-amber-50/40 to-yellow-50/20">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-500 text-white flex items-center justify-center font-bold shadow-xs">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900">企業最高統裁</span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-950 border border-amber-300">
                  👑 BOSS
                </span>
              </div>
              <div className="text-xs font-black text-amber-950 mt-0.5">
                {bossUser ? bossUser.fullName : '林大巨 董事長'}
              </div>
            </div>
          </div>

          <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded border border-amber-300">
            金身護體
          </span>
        </div>

        <div className="mt-2.5 pt-2 border-t border-amber-200/50 flex items-center justify-between text-[10px] text-slate-600">
          <span>最高決策 · 不可停權/刪除</span>
          <span className="font-bold text-amber-800">全模組穿透 · 無限額</span>
        </div>
      </div>

      {/* 卡片 3: Admin 系統管理員組 */}
      <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600" />
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold shadow-2xs">
              <Shield className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800">系統管理員組</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                  ADMIN ({adminUsers.length} 位)
                </span>
              </div>
              <div className="text-[10px] font-medium text-slate-600 mt-1 flex flex-wrap gap-1">
                <span className="bg-amber-50 text-amber-700 px-1 py-0.2 rounded border border-amber-200 text-[9px]">
                  帳號專人: {userManagerAdmins.length}
                </span>
                <span className="bg-emerald-50 text-emerald-700 px-1 py-0.2 rounded border border-emerald-200 text-[9px]">
                  核心特許: {configAdmins.length}
                </span>
                <span className="bg-purple-50 text-purple-700 px-1 py-0.2 rounded border border-purple-200 text-[9px]">
                  同階特許: {peerAdmins.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <span>階層原則：預設管 User</span>
          <span className="text-indigo-600 font-medium">特許 Admin 可管同階</span>
        </div>
      </div>

      {/* 卡片 4: User 業務群組同仁 */}
      <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold shadow-2xs">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800">業務群組同仁</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  USER ({regularUsers.length} 位)
                </span>
              </div>
              <div className="text-[10px] text-slate-600 mt-1 font-medium flex flex-wrap gap-1">
                <span className="bg-slate-100 px-1 py-0.2 rounded text-[9px]">
                  工務:{allUsers.filter(u => u.groupIds?.includes('GRP-ENG') || u.groupId === 'GRP-ENG').length}
                </span>
                <span className="bg-slate-100 px-1 py-0.2 rounded text-[9px]">
                  財務:{allUsers.filter(u => u.groupIds?.includes('GRP-ACC') || u.groupId === 'GRP-ACC').length}
                </span>
                <span className="bg-slate-100 px-1 py-0.2 rounded text-[9px]">
                  採購:{allUsers.filter(u => u.groupIds?.includes('GRP-PROC') || u.groupId === 'GRP-PROC').length}
                </span>
                <span className="bg-slate-100 px-1 py-0.2 rounded text-[9px]">
                  業務:{allUsers.filter(u => u.groupIds?.includes('GRP-SALES') || u.groupId === 'GRP-SALES').length}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <span>PBAC 矩陣授權</span>
          <button
            type="button"
            onClick={onOpenMatrixModal}
            className="text-emerald-700 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>12大模組矩陣</span>
            <FileSpreadsheet className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
