import React from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Crown,
  Lock,
  Shield,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { Company, User, UserGroup } from '../../../types/erp';
import { AlertModalState, DiffItem, UserFormData } from './accountManagementUtils';

interface AccountUserEditorModalProps {
  isOpen: boolean;
  editingUser: User | null;
  formData: UserFormData;
  setFormData: React.Dispatch<React.SetStateAction<UserFormData>>;
  currentUser: User | null;
  isSuperadmin: boolean;
  isOperatorBoss: boolean;
  operatorCanManageAdmins: boolean;
  operatorCanGrantPrivileges: boolean;
  allGroups: UserGroup[];
  companies: Company[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onShowAlert: (alert: AlertModalState) => void;
  onToggleMatrixCompanyGroup: (companyId: string, groupId: string) => void;
  onSetMatrixCompanyAllGroups: (companyId: string, groupIds: string[]) => void;
}

export const AccountUserEditorModal: React.FC<AccountUserEditorModalProps> = ({
  isOpen,
  editingUser,
  formData,
  setFormData,
  currentUser,
  isSuperadmin,
  isOperatorBoss,
  operatorCanManageAdmins,
  operatorCanGrantPrivileges,
  allGroups,
  companies,
  onClose,
  onSubmit,
  onShowAlert,
  onToggleMatrixCompanyGroup,
  onSetMatrixCompanyAllGroups,
}) => {
  if (!isOpen) return null;

  const canSelectAdminRole =
    isSuperadmin || isOperatorBoss || operatorCanManageAdmins || editingUser?.role === 'ADMIN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm">
              {editingUser
                ? `編輯同仁帳號資訊：${editingUser.fullName} (@${editingUser.username})`
                : '新增系統操作同仁帳號'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* 帳號代碼與姓名 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                登入帳號代碼 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={Boolean(editingUser)}
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                placeholder="如: eng_wang"
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
              {editingUser && (
                <span className="text-[10px] text-slate-400">帳號代碼建立後不可變更</span>
              )}
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                同仁姓名 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="如: 王工務"
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 職稱與 Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">職務職稱</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="如: 主任工程師、採購副理"
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">電子郵件 (Email)</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@daju-eng.com.tw"
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 三層式身分角色 */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              三層式身分角色 <span className="text-rose-500">*</span>
            </label>
            {editingUser?.role === 'SUPERADMIN' ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <div className="font-bold">此帳號為系統唯一最高 Superadmin</div>
                  <div className="text-[11px] text-amber-700">
                    不可直接變更為其他角色，欲更換請使用「最高權限交接」流程。
                  </div>
                </div>
              </div>
            ) : editingUser?.role === 'BOSS' ? (
              <div className="p-3 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-lg text-amber-950 flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-600 fill-amber-400 shrink-0" />
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>企業最高統裁 (集團董事長 BOSS)</span>
                    <span className="text-[10px] bg-amber-200/80 text-amber-950 font-bold px-1.5 py-0.2 rounded border border-amber-300">
                      金身護體
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-800">
                    享有不可撼動的金身護體防護，角色身分鎖定為 BOSS，不可降階或變更。
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`p-3 rounded-lg border cursor-pointer flex items-center gap-2 transition-all ${
                    formData.role === 'USER'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="USER"
                    checked={formData.role === 'USER'}
                    onChange={() =>
                      setFormData(prev => ({
                        ...prev,
                        role: 'USER',
                        groupIds: prev.groupIds && prev.groupIds.length > 0 ? prev.groupIds : ['GRP-ENG'],
                        canManageUsers: false,
                        canManageSystemConfigs: false,
                        canManageAdmins: false,
                      }))
                    }
                    className="hidden"
                  />
                  <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div>一般業務同仁 (USER)</div>
                    <div className="text-[10px] font-normal text-slate-500">依業務群組指派矩陣授權</div>
                  </div>
                </label>

                <label
                  className={`p-3 rounded-lg border flex items-center gap-2 transition-all ${
                    !canSelectAdminRole
                      ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                      : formData.role === 'ADMIN'
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold cursor-pointer'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer'
                  }`}
                  onClick={() => {
                    if (!canSelectAdminRole) {
                      onShowAlert({
                        title: '【階層原則受限】無法指派同階管理員角色',
                        message:
                          '您尚未取得授予之【同階管理特許 (canManageAdmins)】，依規定只能建立或指派下一階層 (一般業務同仁 User)！',
                      });
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="role"
                    value="ADMIN"
                    disabled={!canSelectAdminRole}
                    checked={formData.role === 'ADMIN'}
                    onChange={() => {
                      if (canSelectAdminRole) {
                        setFormData({ ...formData, role: 'ADMIN' });
                      }
                    }}
                    className="hidden"
                  />
                  <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <div className="flex items-center gap-1">
                      <span>系統管理員 (ADMIN)</span>
                      {!canSelectAdminRole && <Lock className="w-3 h-3 text-slate-400" />}
                    </div>
                    <div className="text-[10px] font-normal text-slate-500">
                      {canSelectAdminRole ? '全系統檢視與授權管理' : '需取得同階管理特許'}
                    </div>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* 特許授權區 (Superadmin / BOSS) */}
          {operatorCanGrantPrivileges && formData.role === 'ADMIN' && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-3">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-amber-200/60 pb-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>
                  {isOperatorBoss ? '👑 企業最高統裁 (BOSS) 行政授權下放' : 'Superadmin 管理員進階特許授權'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>1. 帳號管理專人授權 (canManageUsers)</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                      專人管理
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    由最高層級指定專人：左側選單可見帳號模組並可維護同仁與重設他人密碼（未獲指定者選單完全隱藏）
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canManageUsers}
                    onChange={e => setFormData({ ...formData, canManageUsers: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600" />
                </label>
              </div>

              <div className="flex items-center justify-between border-t border-amber-200/40 pt-2">
                <div>
                  <div className="font-semibold text-slate-800">
                    2. 全域核心參數維護特許 (canManageSystemConfigs)
                  </div>
                  <div className="text-[10px] text-slate-500">
                    可協同修改營業稅率、保留款率、鎖定模式等系統核心參數
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canManageSystemConfigs}
                    onChange={e =>
                      setFormData({ ...formData, canManageSystemConfigs: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>

              <div className="flex items-center justify-between border-t border-amber-200/40 pt-2">
                <div>
                  <div className="font-semibold text-slate-800">
                    3. 同階 Admin 帳號管理特許 (canManageAdmins)
                  </div>
                  <div className="text-[10px] text-slate-500">
                    可新增、編輯、重設密碼與刪除同階 Admin（仍禁止動 Superadmin 與 BOSS）
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canManageAdmins}
                    onChange={e => setFormData({ ...formData, canManageAdmins: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                </label>
              </div>

              <div className="flex items-center justify-between border-t border-amber-200/40 pt-2">
                <div>
                  <div className="font-semibold text-slate-800">
                    4. 全集團跨法人管理特許 (canManageAllCompanies)
                  </div>
                  <div className="text-[10px] text-slate-500">
                    【老闆/總經理常務管理特許】可管理全集團所有公司法人、組織與營運法規中樞（不受限於單一子公司）
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canManageAllCompanies}
                    onChange={e =>
                      setFormData({ ...formData, canManageAllCompanies: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>
            </div>
          )}

          {/* USER 身分：全域統包 vs 跨法人矩陣 */}
          {formData.role === 'USER' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-slate-700 font-bold">
                  業務權限授權模式 <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-500 font-normal">
                  支援依單一營運法人個別指定業務職能
                </span>
              </div>

              <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, permissionMode: 'GLOBAL' }))}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    formData.permissionMode === 'GLOBAL'
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>全域群組模式 (統包共用)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => {
                      let assignments = prev.companyGroupAssignments;
                      if (!assignments || assignments.length === 0) {
                        assignments = prev.allowedCompanies.map(cId => ({
                          companyId: cId,
                          groupIds: [...prev.groupIds],
                        }));
                      }
                      return {
                        ...prev,
                        permissionMode: 'MATRIX',
                        companyGroupAssignments: assignments,
                      };
                    });
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    formData.permissionMode === 'MATRIX'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>跨法人業務矩陣 (獨立分權)</span>
                  <span className="text-[10px] bg-indigo-500/80 text-white px-1 py-0.2 rounded font-normal">
                    精細指定
                  </span>
                </button>
              </div>

              {formData.permissionMode === 'GLOBAL' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5">
                      指派業務權限群組 (PBAC 矩陣多選) <span className="text-rose-500">*</span>
                    </label>
                    <div className="space-y-1.5 bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                      {allGroups.map(grp => {
                        const checked = formData.groupIds.includes(grp.id);
                        return (
                          <label
                            key={grp.id}
                            className={`p-2 rounded border flex items-center justify-between cursor-pointer transition-colors ${
                              checked
                                ? 'bg-white border-indigo-400 text-indigo-900 shadow-2xs font-semibold'
                                : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setFormData({
                                      ...formData,
                                      groupIds: [...formData.groupIds, grp.id],
                                    });
                                  } else {
                                    if (formData.groupIds.length === 1) {
                                      onShowAlert({
                                        title: '操作限制',
                                        message: '一般同仁至少需保留一個業務權限群組！',
                                      });
                                      return;
                                    }
                                    setFormData({
                                      ...formData,
                                      groupIds: formData.groupIds.filter(id => id !== grp.id),
                                    });
                                  }
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>{grp.groupName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({grp.groupCode})
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              審核額度:{' '}
                              {grp.approvalLimit > 0
                                ? `NT$ ${grp.approvalLimit.toLocaleString()}`
                                : '$0 (草稿填報)'}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      在全域模式下，所選群組權限將無差別套用於該同仁獲授權的所有營運法人中。
                    </span>
                  </div>

                  {/* 授權營運法人 */}
                  <AllowedCompaniesCheckboxes
                    companies={companies}
                    allowedCompanies={formData.allowedCompanies}
                    currentUser={currentUser}
                    isSuperadmin={isSuperadmin}
                    onChange={next => setFormData({ ...formData, allowedCompanies: next })}
                    onShowAlert={onShowAlert}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        <span>跨法人多維度業務授權矩陣</span>
                      </div>
                      <span className="text-[10px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full font-semibold">
                        {
                          formData.companyGroupAssignments.filter(
                            a => a.groupIds && a.groupIds.length > 0
                          ).length
                        }{' '}
                        家法人已指派
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-800 leading-relaxed">
                      您可以為每一家營運法人指定該同仁負責之業務。例如：在<strong>【大巨營造】負責財務會計</strong>、在<strong>【宏達機電】負責採購發包</strong>。同仁在頂部切換不同公司時，系統將自動套用對應的模組權限與審核額度。
                    </p>
                  </div>

                  <div className="space-y-2">
                    {companies.map(comp => {
                      const operatorCanAssign =
                        isSuperadmin ||
                        currentUser?.canManageAllCompanies ||
                        (currentUser?.allowedCompanies || []).includes(comp.id);
                      const assignment = formData.companyGroupAssignments.find(
                        a => a.companyId === comp.id
                      );
                      const assignedGroupIds = assignment ? assignment.groupIds : [];
                      const isCompanyEnabled = assignedGroupIds.length > 0;
                      const compGroups = allGroups.filter(g => assignedGroupIds.includes(g.id));
                      const compLimit =
                        compGroups.length > 0
                          ? compGroups.some(
                              g => g.approvalLimit === -1 || g.approvalLimit >= 999999999
                            )
                            ? '無限制'
                            : `NT$ ${Math.max(...compGroups.map(g => g.approvalLimit || 0), 0).toLocaleString()}`
                          : '$0 (未指派業務)';

                      return (
                        <div
                          key={comp.id}
                          className={`p-3 rounded-lg border transition-all ${
                            !operatorCanAssign
                              ? 'bg-slate-50 border-slate-200 opacity-50'
                              : isCompanyEnabled
                              ? 'bg-white border-indigo-300 shadow-2xs'
                              : 'bg-slate-50/70 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-800">
                                [{comp.companyCode}] {comp.shortName || comp.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                                {comp.entityType === 'GROUP'
                                  ? '母體集團'
                                  : comp.entityType === 'PERSONAL'
                                  ? '老闆私帳'
                                  : '公司法人'}
                              </span>
                              {!operatorCanAssign && (
                                <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  非您授權管轄
                                </span>
                              )}
                            </div>

                            {operatorCanAssign && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-slate-500">
                                  審核額度:{' '}
                                  <span className="font-bold text-slate-700">{compLimit}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSetMatrixCompanyAllGroups(
                                      comp.id,
                                      allGroups.map(g => g.id)
                                    )
                                  }
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                >
                                  全選
                                </button>
                                <span className="text-slate-300 text-xs">|</span>
                                <button
                                  type="button"
                                  onClick={() => onSetMatrixCompanyAllGroups(comp.id, [])}
                                  className="text-[10px] text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                                >
                                  清空
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="pt-2">
                            <div className="text-[10px] text-slate-500 font-medium mb-1.5">
                              指派業務職能群組 (點選按鈕切換)：
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              {allGroups.map(grp => {
                                const isChecked = assignedGroupIds.includes(grp.id);
                                const colorClass =
                                  grp.id === 'GRP-ENG'
                                    ? isChecked
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                      : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400'
                                    : grp.id === 'GRP-ACC'
                                    ? isChecked
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                      : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                                    : grp.id === 'GRP-PROC'
                                    ? isChecked
                                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                      : 'bg-white border-slate-200 text-slate-700 hover:border-amber-400'
                                    : isChecked
                                    ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-purple-400';

                                return (
                                  <button
                                    key={grp.id}
                                    type="button"
                                    disabled={!operatorCanAssign}
                                    onClick={() => onToggleMatrixCompanyGroup(comp.id, grp.id)}
                                    className={`py-1.5 px-2 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer disabled:cursor-not-allowed ${colorClass}`}
                                  >
                                    <span className="truncate">{grp.groupName}</span>
                                    {isChecked ? (
                                      <Check className="w-3.5 h-3.5 shrink-0" />
                                    ) : (
                                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {formData.role === 'ADMIN' && (
            <AllowedCompaniesCheckboxes
              companies={companies}
              allowedCompanies={formData.allowedCompanies}
              currentUser={currentUser}
              isSuperadmin={isSuperadmin}
              onChange={next => setFormData({ ...formData, allowedCompanies: next })}
              onShowAlert={onShowAlert}
            />
          )}

          {!editingUser && (
            <div>
              <label className="block text-slate-700 font-bold mb-1">初始登入密碼</label>
              <input
                type="text"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder="預設為 888888"
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                同仁首次登入後可自行變更密碼；管理員亦可隨時於列表一鍵重設。
              </span>
            </div>
          )}
        </form>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="px-5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{editingUser ? '儲存變更 (進入二次確認)' : '確定建立帳號'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface AllowedCompaniesCheckboxesProps {
  companies: Company[];
  allowedCompanies: string[];
  currentUser: User | null;
  isSuperadmin: boolean;
  onChange: (next: string[]) => void;
  onShowAlert: (alert: AlertModalState) => void;
}

const AllowedCompaniesCheckboxes: React.FC<AllowedCompaniesCheckboxesProps> = ({
  companies,
  allowedCompanies,
  currentUser,
  isSuperadmin,
  onChange,
  onShowAlert,
}) => (
  <div>
    <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
      <span>授權操作營運法人</span>
      {!isSuperadmin && !currentUser?.canManageAllCompanies && (
        <span className="text-[11px] font-normal text-slate-500">
          (僅限指派您自身獲授權之營運法人)
        </span>
      )}
    </label>
    <div className="space-y-1.5 bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
      {companies.map(comp => {
        const checked = allowedCompanies.includes(comp.id);
        const operatorCanAssign =
          isSuperadmin ||
          currentUser?.canManageAllCompanies ||
          (currentUser?.allowedCompanies || []).includes(comp.id);
        return (
          <label
            key={comp.id}
            className={`p-2 rounded border flex items-center justify-between transition-colors ${
              !operatorCanAssign
                ? 'bg-slate-100/80 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                : checked
                ? 'bg-white border-indigo-400 text-indigo-900 shadow-2xs font-semibold cursor-pointer'
                : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={checked}
                disabled={!operatorCanAssign}
                onChange={e => {
                  if (!operatorCanAssign) return;
                  if (e.target.checked) {
                    onChange([...allowedCompanies, comp.id]);
                  } else {
                    if (allowedCompanies.length === 1) {
                      onShowAlert({
                        title: '操作限制',
                        message: '至少需保留一個授權法人！',
                      });
                      return;
                    }
                    onChange(allowedCompanies.filter(id => id !== comp.id));
                  }
                }}
                className="rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
              />
              <span>
                [{comp.companyCode}] {comp.shortName || comp.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!operatorCanAssign && (
                <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  非您授權管轄
                </span>
              )}
              <span className="text-[10px] text-slate-400">
                {comp.entityType === 'GROUP'
                  ? '母體集團'
                  : comp.entityType === 'PERSONAL'
                  ? '老闆私帳'
                  : '公司法人'}
              </span>
            </div>
          </label>
        );
      })}
    </div>
  </div>
);

interface AccountDiffConfirmModalProps {
  diffConfirmInfo: {
    targetUser: User;
    diffs: DiffItem[];
    payload: unknown;
  } | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const AccountDiffConfirmModal: React.FC<AccountDiffConfirmModalProps> = ({
  diffConfirmInfo,
  onCancel,
  onConfirm,
}) => {
  if (!diffConfirmInfo) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border-2 border-indigo-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
        <div className="px-6 py-4 bg-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-300" />
            <div>
              <h3 className="font-extrabold text-sm">帳號異動二次確認 (審計安全防線)</h3>
              <div className="text-[11px] text-indigo-200">
                請審查本次修改項目，確認無誤後點擊執行寫入
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-indigo-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400">目標帳號同仁：</span>
              <div className="font-bold text-slate-800 text-sm mt-0.5">
                {diffConfirmInfo.targetUser.fullName} (@{diffConfirmInfo.targetUser.username})
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">
              {diffConfirmInfo.diffs.length} 項欄位異動
            </span>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2 px-3">修改欄位名稱</th>
                  <th className="py-2 px-3">修改前 (原值)</th>
                  <th className="py-2 px-3">修改後 (新值)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {diffConfirmInfo.diffs.map((d, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2 px-3 font-semibold text-slate-800">{d.fieldName}</td>
                    <td className="py-2 px-3 text-slate-500 line-through font-mono">
                      {d.oldValue}
                    </td>
                    <td className="py-2 px-3 font-bold text-indigo-700 font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>{d.newValue}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-[11px] text-slate-500 bg-amber-50 p-2.5 rounded border border-amber-200 flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              本次異動將在資料庫原子交易中更新，並自動保存至日誌追蹤，確認後無法撤銷。
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            返回修改
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 rounded-lg text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>確認執行變更</span>
          </button>
        </div>
      </div>
    </div>
  );
};
