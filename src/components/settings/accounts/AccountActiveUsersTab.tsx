import React from 'react';
import {
  ArrowRightLeft,
  Building2,
  Check,
  Crown,
  Edit,
  FileSpreadsheet,
  Filter,
  KeyRound,
  Lock,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import { Company, User } from '../../../types/erp';

interface AccountActiveUsersTabProps {
  currentUser: User | null;
  isSuperadmin: boolean;
  operatorCanGrantPrivileges: boolean;
  filteredUsers: User[];
  companies: Company[];
  searchTerm: string;
  onSearchTermChange: (val: string) => void;
  roleFilter: 'ALL' | 'SUPERADMIN' | 'BOSS' | 'ADMIN' | 'USER';
  onRoleFilterChange: (val: 'ALL' | 'SUPERADMIN' | 'BOSS' | 'ADMIN' | 'USER') => void;
  statusFilter: 'ALL' | 'ACTIVE' | 'DISABLED';
  onStatusFilterChange: (val: 'ALL' | 'ACTIVE' | 'DISABLED') => void;
  privilegeFilter: 'ALL' | 'USER_MGR' | 'SYS_CONFIG' | 'PEER_ADMIN' | 'NONE';
  onPrivilegeFilterChange: (val: 'ALL' | 'USER_MGR' | 'SYS_CONFIG' | 'PEER_ADMIN' | 'NONE') => void;
  getGroupName: (groupId?: string) => string | undefined;
  onOpenMatrixModal: () => void;
  onOpenCreate: () => void;
  onToggleUserManagerPrivilege: (user: User) => void;
  onToggleSysConfigPrivilege: (user: User) => void;
  onTogglePeerAdminPrivilege: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onQuickSimulate: (user: User) => void;
  onOpenEdit: (user: User) => void;
  onOpenResetPassword: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export const AccountActiveUsersTab: React.FC<AccountActiveUsersTabProps> = ({
  currentUser,
  isSuperadmin,
  operatorCanGrantPrivileges,
  filteredUsers,
  companies,
  searchTerm,
  onSearchTermChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  privilegeFilter,
  onPrivilegeFilterChange,
  getGroupName,
  onOpenMatrixModal,
  onOpenCreate,
  onToggleUserManagerPrivilege,
  onToggleSysConfigPrivilege,
  onTogglePeerAdminPrivilege,
  onToggleStatus,
  onQuickSimulate,
  onOpenEdit,
  onOpenResetPassword,
  onDeleteUser,
}) => {
  return (
    <>
      {/* 搜尋、篩選與快速工具列 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => onSearchTermChange(e.target.value)}
              placeholder="搜尋帳號、同仁姓名、職稱或 Email..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 self-end lg:self-auto">
            <button
              type="button"
              onClick={onOpenMatrixModal}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
              <span>群組權限矩陣</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreate}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>新增同仁帳號</span>
            </button>
          </div>
        </div>

        {/* 快速篩選標籤 */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
            <Filter className="w-3 h-3" />
            身分篩選：
          </span>
          {(isSuperadmin
            ? (['ALL', 'SUPERADMIN', 'BOSS', 'ADMIN', 'USER'] as const)
            : (['ALL', 'BOSS', 'ADMIN', 'USER'] as const)
          ).map(role => (
            <button
              key={role}
              type="button"
              onClick={() => onRoleFilterChange(role)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                roleFilter === role
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {role === 'ALL'
                ? '全部身分'
                : role === 'SUPERADMIN'
                ? '架構師 (SUPERADMIN)'
                : role === 'BOSS'
                ? '👑 BOSS (董事長)'
                : role}
            </button>
          ))}

          <span className="text-slate-300 mx-1">|</span>

          <span className="text-slate-400 text-[11px] font-medium">狀態：</span>
          {(['ALL', 'ACTIVE', 'DISABLED'] as const).map(status => (
            <button
              key={status}
              type="button"
              onClick={() => onStatusFilterChange(status)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                statusFilter === status
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status === 'ALL' ? '全部狀態' : status === 'ACTIVE' ? '正常啟用' : '已停用'}
            </button>
          ))}

          <span className="text-slate-300 mx-1">|</span>

          <span className="text-slate-400 text-[11px] font-medium">特許授權：</span>
          {(['ALL', 'USER_MGR', 'SYS_CONFIG', 'PEER_ADMIN', 'NONE'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => onPrivilegeFilterChange(p)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                privilegeFilter === p
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p === 'ALL'
                ? '全部'
                : p === 'USER_MGR'
                ? '帳號管理專人'
                : p === 'SYS_CONFIG'
                ? '核心參數特許'
                : p === 'PEER_ADMIN'
                ? '同階管理特許'
                : '無特許'}
            </button>
          ))}
        </div>
      </div>

      {/* 使用者帳號主檔表格 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800">系統操作人員主檔清單</span>
            <span className="text-[11px] text-slate-500 font-mono">
              (共 {filteredUsers.length} 位同仁)
            </span>
          </div>

          <div className="text-[11px] text-slate-400">
            提示：點選「切換模擬」即可即時在右上角身分切換器連動，模擬該人員權限
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 select-none">
                <th className="py-2.5 px-3">帳號 / 姓名</th>
                <th className="py-2.5 px-3">職稱</th>
                <th className="py-2.5 px-3">角色身分</th>
                <th className="py-2.5 px-3 text-center">特許授權項目</th>
                <th className="py-2.5 px-3">所屬業務群組 (PBAC)</th>
                <th className="py-2.5 px-3">授權營運法人</th>
                <th className="py-2.5 px-3 text-center">狀態</th>
                <th className="py-2.5 px-3">密碼狀態</th>
                <th className="py-2.5 px-3 text-right">操作控制</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    查無符合條件之人員帳號
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isCurrent = user.id === currentUser?.id;
                  const isUserSuperadmin = user.role === 'SUPERADMIN';
                  const isUserBoss = user.role === 'BOSS';
                  const isUserAdmin = user.role === 'ADMIN';

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCurrent ? 'bg-indigo-50/30 font-medium' : isUserBoss ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isUserSuperadmin
                                ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                                : isUserBoss
                                ? 'bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-white ring-2 ring-yellow-400 shadow-xs'
                                : isUserAdmin
                                ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isUserBoss ? '👑' : user.fullName ? user.fullName.slice(0, 1) : '帳'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <span>{user.fullName}</span>
                              {isUserBoss && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-bold shadow-2xs">
                                  集團最高統裁
                                </span>
                              )}
                              {isCurrent && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-normal">
                                  目前登入者
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">@{user.username}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-slate-600">
                        {user.title || <span className="text-slate-300">-</span>}
                      </td>

                      <td className="py-2.5 px-3">
                        {isUserSuperadmin ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                            <Crown className="w-3 h-3 text-amber-600" />
                            <span>SUPERADMIN</span>
                          </span>
                        ) : isUserBoss ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white border border-amber-600 shadow-2xs">
                            <Crown className="w-3 h-3 text-yellow-100 fill-yellow-200" />
                            <span>👑 企業最高統裁 (BOSS)</span>
                          </span>
                        ) : isUserAdmin ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-300">
                            <Shield className="w-3 h-3 text-indigo-600" />
                            <span>ADMIN</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <Users className="w-3 h-3 text-emerald-600" />
                            <span>USER</span>
                          </span>
                        )}
                      </td>

                      {/* 特許授權項目 */}
                      <td className="py-2.5 px-3 text-center">
                        {isUserSuperadmin ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <ShieldCheck className="w-3 h-3 text-amber-600" />
                            <span>全域最高權杖</span>
                          </span>
                        ) : isUserBoss ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-gradient-to-r from-amber-100 to-yellow-100 px-2 py-0.5 rounded border border-amber-300 shadow-2xs">
                            <Crown className="w-3 h-3 text-amber-600" />
                            <span>最高統裁 · 全模組無上限</span>
                          </span>
                        ) : isUserAdmin ? (
                          <div className="flex flex-col items-center gap-1">
                            {operatorCanGrantPrivileges ? (
                              <button
                                type="button"
                                onClick={() => onToggleUserManagerPrivilege(user)}
                                title="點選指定/收回帳號管理專人權限 (指定後左側選單可見帳號模組)"
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded transition-all border cursor-pointer ${
                                  user.canManageUsers
                                    ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                                }`}
                              >
                                {user.canManageUsers ? (
                                  <>
                                    <Check className="w-2.5 h-2.5 text-amber-700" />
                                    <span>帳號專人: 已指定</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                                    <span>帳號專人: 未授權</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                  user.canManageUsers
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-slate-50 text-slate-400 border-slate-200'
                                }`}
                              >
                                帳號專人: {user.canManageUsers ? '已指定' : '未授權'}
                              </span>
                            )}

                            {operatorCanGrantPrivileges ? (
                              <button
                                type="button"
                                onClick={() => onToggleSysConfigPrivilege(user)}
                                title="點選切換全域核心參數特許"
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded transition-all border cursor-pointer ${
                                  user.canManageSystemConfigs
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                                }`}
                              >
                                {user.canManageSystemConfigs ? (
                                  <>
                                    <Check className="w-2.5 h-2.5 text-emerald-700" />
                                    <span>核心參數: 已特許</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                                    <span>核心參數: 未授權</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                  user.canManageSystemConfigs
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-50 text-slate-400 border-slate-200'
                                }`}
                              >
                                核心參數: {user.canManageSystemConfigs ? '已特許' : '未授權'}
                              </span>
                            )}

                            {operatorCanGrantPrivileges ? (
                              <button
                                type="button"
                                onClick={() => onTogglePeerAdminPrivilege(user)}
                                title="點選切換同階 Admin 管理特許"
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded transition-all border cursor-pointer ${
                                  user.canManageAdmins
                                    ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                                }`}
                              >
                                {user.canManageAdmins ? (
                                  <>
                                    <Check className="w-2.5 h-2.5 text-purple-700" />
                                    <span>同階管理: 已特許</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                                    <span>同階管理: 未授權</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                  user.canManageAdmins
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-slate-50 text-slate-400 border-slate-200'
                                }`}
                              >
                                同階管理: {user.canManageAdmins ? '已特許' : '未授權'}
                              </span>
                            )}

                            {user.canManageAllCompanies && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded border bg-indigo-50 text-indigo-700 border-indigo-200"
                                title="全集團跨法人管理特許：老闆/常務管理Admin，具備全集團所有公司法人管理權限"
                              >
                                <Check className="w-2.5 h-2.5 text-indigo-700" />
                                <span>全集團法人: 已特許</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* 所屬業務群組 */}
                      <td className="py-2.5 px-3">
                        {user.role === 'BOSS' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded shadow-2xs">
                            👑 全模組穿透 · 無限額審批
                          </span>
                        ) : user.role === 'USER' ? (
                          user.companyGroupAssignments && user.companyGroupAssignments.length > 0 ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                <Building2 className="w-2.5 h-2.5 text-purple-600" />
                                <span>跨法人業務矩陣</span>
                              </span>
                              <div className="flex flex-col gap-0.5">
                                {user.companyGroupAssignments
                                  .filter(a => a.groupIds.length > 0)
                                  .map(a => {
                                    const c = companies.find(item => item.id === a.companyId);
                                    const compLabel = c?.shortName || a.companyId;
                                    const gNames = a.groupIds.map(g => getGroupName(g) || g).join('、');
                                    return (
                                      <div key={a.companyId} className="text-[10px] flex items-center gap-1">
                                        <span className="font-semibold text-slate-700 bg-slate-100 px-1 py-0.2 rounded text-[9px] font-mono">
                                          {compLabel}:
                                        </span>
                                        <span className="text-indigo-600 font-medium">{gNames}</span>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {(user.groupIds && user.groupIds.length > 0
                                ? user.groupIds
                                : user.groupId
                                ? [user.groupId]
                                : []
                              ).map(gId => (
                                <span
                                  key={gId}
                                  className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200"
                                >
                                  {getGroupName(gId) || gId}
                                </span>
                              ))}
                            </div>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">全域管理組</span>
                        )}
                      </td>

                      {/* 授權營運法人 */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(user.allowedCompanies || ['COMP-01']).map(cId => {
                            const c = companies.find(item => item.id === cId);
                            return (
                              <span
                                key={cId}
                                className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono"
                              >
                                {c?.shortName || cId}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* 狀態 */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onToggleStatus(user)}
                          disabled={(isUserBoss && !isSuperadmin) || user.id === currentUser?.id}
                          title={
                            isUserBoss && !isSuperadmin
                              ? '【金身護體】企業最高統裁 (BOSS) 具備金身防護，一般管理員嚴禁停用'
                              : user.id === currentUser?.id
                              ? '當前登入之帳號，系統禁止將自己停用'
                              : '點選切換啟用/停用'
                          }
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded transition-colors ${
                            user.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                          } ${
                            (isUserBoss && !isSuperadmin) || user.id === currentUser?.id
                              ? 'cursor-not-allowed opacity-90'
                              : 'cursor-pointer'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              user.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          <span>{user.status === 'ACTIVE' ? '啟用中' : '已停用'}</span>
                          {user.id === currentUser?.id && (
                            <span className="text-[9px] text-slate-400 font-normal ml-0.5">(本人)</span>
                          )}
                          {isUserBoss && (
                            <span className="text-[9px] text-amber-600 font-bold ml-0.5">👑金身</span>
                          )}
                        </button>
                      </td>

                      {/* 密碼狀態 */}
                      <td className="py-2.5 px-3">
                        <div className="text-[11px] text-slate-600 font-mono">
                          {user.isPasswordReset ? (
                            <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              預設/已重設
                            </span>
                          ) : (
                            <span className="text-slate-400">自訂密碼</span>
                          )}
                        </div>
                      </td>

                      {/* 操作控制列 */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onQuickSimulate(user)}
                            title={`切換身分模擬登入為【${user.fullName}】`}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-indigo-600 hover:text-white text-indigo-700 font-semibold text-[11px] transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>模擬</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenEdit(user)}
                            title="編輯帳號資料"
                            className="p-1 rounded text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {(!isUserBoss || isSuperadmin || isCurrent) && (
                            <button
                              type="button"
                              onClick={() => onOpenResetPassword(user)}
                              title="重設密碼"
                              className="p-1 rounded text-slate-600 hover:text-amber-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {!isUserSuperadmin && !isUserBoss && (
                            <button
                              type="button"
                              onClick={() => onDeleteUser(user)}
                              title="刪除帳號"
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
