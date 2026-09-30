import React, { useState, useEffect } from 'react';
import { User, Role, Company, UserGroup, ErpModuleKey, ModulePermissionItem, UserRole } from '../../types/erp';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Edit2,
  Lock,
  Unlock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Building,
  KeyRound,
  FileCheck,
  DollarSign,
  Plus,
  Crown,
  ShieldAlert,
  ArrowRightLeft,
  Sliders,
  Check,
  X,
  FileSpreadsheet,
  Layers,
  ChevronRight
} from 'lucide-react';
import {
  createUser,
  updateUser,
  deleteUser,
  getAllUserGroups,
  createUserGroup,
  updateUserGroup,
  deleteUserGroup,
  updateGroupModulePermissions,
  transferSuperadmin,
  getUserEffectivePermissions,
  ERP_MODULES
} from '../../db/sqlite';

interface UserPermissionModuleProps {
  users: User[];
  roles: Role[];
  companies: Company[];
  currentUser: User | null;
  onDataChanged: () => void;
  onImpersonateUser?: (user: User) => void;
}

export const UserPermissionModule: React.FC<UserPermissionModuleProps> = ({
  users,
  roles,
  companies,
  currentUser,
  onDataChanged,
  onImpersonateUser,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'USERS' | 'GROUPS_MATRIX' | 'TIER_ARCHITECTURE'>('USERS');
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('GRP-ENG');
  const [filterRole, setFilterRole] = useState<'ALL' | 'SUPERADMIN' | 'ADMIN' | 'USER'>('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 彈跳視窗狀態
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string>('');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);

  // 通知訊息
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // 重新載入權限群組
  const loadGroups = () => {
    const loaded = getAllUserGroups();
    setUserGroups(loaded);
    if (loaded.length > 0 && !loaded.some(g => g.id === selectedGroupId)) {
      setSelectedGroupId(loaded[0].id);
    }
  };

  useEffect(() => {
    loadGroups();
  }, [users]);

  // 新建使用者表單
  const [newUserForm, setNewUserForm] = useState({
    employeeId: `EMP-00${users.length + 1}`,
    username: '',
    fullName: '',
    email: '',
    passwordPlain: '123456',
    role: 'USER' as UserRole,
    groupId: 'GRP-ENG',
    allowedCompanies: ['COMP-01'],
    defaultCompanyId: 'COMP-01',
    status: 'ACTIVE' as User['status'],
    dailyExportLimit: 1000,
  });

  // 編輯使用者表單
  const [editUserForm, setEditUserForm] = useState({
    fullName: '',
    email: '',
    role: 'USER' as UserRole,
    groupId: 'GRP-ENG',
    allowedCompanies: ['COMP-01'],
    defaultCompanyId: 'COMP-01',
    status: 'ACTIVE' as User['status'],
    dailyExportLimit: 1000,
    passwordPlain: '',
  });

  // 新建群組表單
  const [newGroupForm, setNewGroupForm] = useState({
    groupCode: '',
    groupName: '',
    description: '',
    approvalLimit: 1000000,
    canExportData: true,
  });

  // 目前登入同仁權限
  const currentOperatorName = currentUser?.fullName || '系統管理員';
  const isCurrentSuperadmin = currentUser?.role === 'SUPERADMIN';
  const isCurrentAdmin = currentUser?.role === 'ADMIN' || isCurrentSuperadmin;

  // 統計數據
  const superadminCount = users.filter(u => u.role === 'SUPERADMIN').length;
  const adminCount = users.filter(u => u.role === 'ADMIN').length;
  const userCount = users.filter(u => u.role === 'USER' || (u.role !== 'SUPERADMIN' && u.role !== 'ADMIN')).length;

  // 篩選後使用者列表
  const filteredUsers = users.filter(u => {
    if (filterRole !== 'ALL' && u.role !== filterRole) return false;
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      const matchName = u.fullName.toLowerCase().includes(kw);
      const matchUser = u.username.toLowerCase().includes(kw);
      const matchEmp = u.employeeId.toLowerCase().includes(kw);
      const matchEmail = u.email.toLowerCase().includes(kw);
      const matchGroup = (u.groupName || '').toLowerCase().includes(kw);
      return matchName || matchUser || matchEmp || matchEmail || matchGroup;
    }
    return true;
  });

  // 當前選取進行矩陣編輯的群組
  const activeGroup = userGroups.find(g => g.id === selectedGroupId) || userGroups[0];

  // 儲存矩陣勾選項目
  const handleTogglePermission = (moduleKey: ErpModuleKey, action: 'canRead' | 'canWrite' | 'canApprove' | 'canExport') => {
    if (!activeGroup) return;
    const updatedPermissions = activeGroup.permissions.map(p => {
      if (p.moduleKey === moduleKey) {
        return {
          ...p,
          [action]: !p[action]
        };
      }
      return p;
    });

    try {
      updateGroupModulePermissions(activeGroup.id, updatedPermissions, currentOperatorName);
      loadGroups();
      onDataChanged();
      showToast(`已即時更新「${activeGroup.groupName}」的模組權限`);
    } catch (e: unknown) {
      const err = e as Error;
      showToast(err.message, 'error');
    }
  };

  // 全選或取消該模組的所有權限
  const handleToggleAllForModule = (moduleKey: ErpModuleKey) => {
    if (!activeGroup) return;
    const current = activeGroup.permissions.find(p => p.moduleKey === moduleKey);
    const allChecked = current && current.canRead && current.canWrite && current.canApprove && current.canExport;
    const nextVal = !allChecked;

    const updatedPermissions = activeGroup.permissions.map(p => {
      if (p.moduleKey === moduleKey) {
        return {
          ...p,
          canRead: nextVal,
          canWrite: nextVal,
          canApprove: nextVal,
          canExport: nextVal,
        };
      }
      return p;
    });

    try {
      updateGroupModulePermissions(activeGroup.id, updatedPermissions, currentOperatorName);
      loadGroups();
      onDataChanged();
    } catch (e: unknown) {
      const err = e as Error;
      showToast(err.message, 'error');
    }
  };

  // 儲存群組核准限額與匯出設定
  const handleSaveGroupConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup) return;
    try {
      updateUserGroup(
        activeGroup.id,
        {
          approvalLimit: activeGroup.approvalLimit,
          canExportData: activeGroup.canExportData,
          description: activeGroup.description
        },
        currentOperatorName
      );
      loadGroups();
      onDataChanged();
      showToast(`已儲存「${activeGroup.groupName}」的審核額度與全域設定`);
    } catch (e: unknown) {
      const err = e as Error;
      showToast(err.message, 'error');
    }
  };

  // 建立新使用者
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      createUser(
        {
          employeeId: newUserForm.employeeId,
          username: newUserForm.username,
          fullName: newUserForm.fullName,
          email: newUserForm.email,
          passwordPlain: newUserForm.passwordPlain,
          role: newUserForm.role,
          groupId: newUserForm.role === 'USER' ? newUserForm.groupId : undefined,
          allowedCompanies: newUserForm.allowedCompanies,
          defaultCompanyId: newUserForm.defaultCompanyId,
          status: newUserForm.status,
          dailyExportLimit: newUserForm.dailyExportLimit,
        },
        currentOperatorName
      );
      setShowCreateUserModal(false);
      onDataChanged();
      showToast(`成功新增同仁【${newUserForm.fullName}】！已指派至${newUserForm.role === 'USER' ? '指定業務群組' : newUserForm.role}。`);
      setNewUserForm({
        employeeId: `EMP-00${users.length + 2}`,
        username: '',
        fullName: '',
        email: '',
        passwordPlain: '123456',
        role: 'USER',
        groupId: userGroups[0]?.id || 'GRP-ENG',
        allowedCompanies: ['COMP-01'],
        defaultCompanyId: 'COMP-01',
        status: 'ACTIVE',
        dailyExportLimit: 1000,
      });
    } catch (e: unknown) {
      const err = e as Error;
      showToast(err.message, 'error');
    }
  };

  // 儲存編輯使用者
  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      updateUser(
        editingUser.id,
        {
          fullName: editUserForm.fullName,
          email: editUserForm.email,
          role: editUserForm.role,
          groupId: editUserForm.role === 'USER' ? editUserForm.groupId : undefined,
          allowedCompanies: editUserForm.allowedCompanies,
          defaultCompanyId: editUserForm.defaultCompanyId,
          status: editUserForm.status,
          dailyExportLimit: editUserForm.dailyExportLimit,
          passwordPlain: editUserForm.passwordPlain || undefined,
        },
        currentOperatorName
      );
      setEditingUser(null);
      onDataChanged();
      showToast(`已成功更新同仁【${editUserForm.fullName}】的權限設定。`);
    } catch (e: unknown) {
      const err = e as Error;
      showToast(err.message, 'error');
    }
  };

  // 轉移最高 Superadmin
  const handleTransferSuperadmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== 'SUPERADMIN') {
      showToast('只有當前唯一的 Superadmin 能發起權限轉移！', 'error');
      return;
    }
    if (!transferTargetId) {
      showToast('請選取要接替最高權限的同仁', 'error');
      return;
    }
    try {
      transferSuperadmin(currentUser.id, transferTargetId, currentOperatorName);
      setShowTransferModal(false);
      onDataChanged();
      showToast('已順利完成最高 Superadmin 權限交接！');
    } catch (e: unknown) {
      const err = e as Error;
      showToast(err.message, 'error');
    }
  };

  // 新建自訂群組
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newGrp = createUserGroup(
        {
          groupCode: newGroupForm.groupCode,
          groupName: newGroupForm.groupName,
          description: newGroupForm.description,
          approvalLimit: newGroupForm.approvalLimit,
          canExportData: newGroupForm.canExportData,
        },
        currentOperatorName
      );
      setShowCreateGroupModal(false);
      loadGroups();
      setSelectedGroupId(newGrp.id);
      onDataChanged();
      showToast(`已成功建立新權限群組【${newGrp.groupName}】，請繼續設定模組矩陣勾選！`);
    } catch (e: unknown) {
      const err = e as Error;
      showToast(err.message, 'error');
    }
  };

  // 刪除自訂群組
  const handleDeleteGroup = (group: UserGroup) => {
    if (!window.confirm(`確定要刪除自訂群組【${group.groupName}】嗎？此動作無法復原。`)) return;
    try {
      deleteUserGroup(group.id, currentOperatorName);
      loadGroups();
      onDataChanged();
      showToast(`已成功刪除群組【${group.groupName}】`);
    } catch (e: unknown) {
      const err = e as Error;
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* 頂部通知 Toast */}
      {notification && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl shadow-md border animate-in fade-in slide-in-from-top-2 duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* 標題與核心架構導航 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              三層式身分權限管理與自訂群組矩陣 (PBAC)
              <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-800">
                憲法內控級
              </span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>Superadmin (唯一最高)</span>
              <span aria-hidden="true">·</span>
              <span>Admin ({adminCount}位管理員)</span>
              <span aria-hidden="true">·</span>
              <span>User ({userGroups.length}個業務群組)</span>
            </div>
          </div>
        </div>

        {/* 次頁籤切換 */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveSubTab('USERS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeSubTab === 'USERS'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            人員帳號名冊 ({users.length})
          </button>
          <button
            onClick={() => setActiveSubTab('GROUPS_MATRIX')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeSubTab === 'GROUPS_MATRIX'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            群組模組權限矩陣 ({userGroups.length}組)
          </button>
          <button
            onClick={() => setActiveSubTab('TIER_ARCHITECTURE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeSubTab === 'TIER_ARCHITECTURE'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            三層身分防護機制
          </button>
        </div>
      </div>

      {/* 三層架構統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tier 1: Superadmin */}
        <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/40 p-4 rounded-xl border border-amber-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <Crown className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-bold text-amber-900 tracking-wide">第一層：唯一最高主控者</span>
                <h3 className="text-base font-bold text-slate-900">Superadmin (1人)</h3>
              </div>
            </div>
            {isCurrentSuperadmin && (
              <button
                onClick={() => setShowTransferModal(true)}
                className="text-xs px-2.5 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 font-medium transition-colors shadow-xs"
              >
                交接移轉
              </button>
            )}
          </div>
          <p className="text-xs text-amber-800 mt-2 leading-relaxed">
            擁有全系統 12 大模組最高權限、底層 SQL 與參數變更。不可被任何一般 Admin 降級或刪除。
          </p>
          <div className="mt-3 pt-2 border-t border-amber-200/70 flex items-center justify-between text-xs text-amber-900">
            <span>現任管理者: <strong>{users.find(u => u.role === 'SUPERADMIN')?.fullName || '黃副總經理'}</strong></span>
            <span className="font-mono text-amber-700">無審核金額上限</span>
          </div>
        </div>

        {/* Tier 2: Admins */}
        <div className="bg-gradient-to-br from-indigo-50/70 to-sky-50/40 p-4 rounded-xl border border-indigo-200 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-bold text-indigo-900 tracking-wide">第二層：分權系統管理員</span>
                <h3 className="text-base font-bold text-slate-900">Admin ({adminCount}人)</h3>
              </div>
            </div>
          </div>
          <p className="text-xs text-indigo-800 mt-2 leading-relaxed">
            負責工區人員帳號開立、密碼重設、指派業務群組與查閱審計歷程。不可修改 Superadmin。
          </p>
          <div className="mt-3 pt-2 border-t border-indigo-200/70 flex items-center justify-between text-xs text-indigo-900">
            <span>權限範圍: <strong>帳號管理、群組指派</strong></span>
            <span className="font-mono text-indigo-700">審批限額 $50,000,000</span>
          </div>
        </div>

        {/* Tier 3: User Groups */}
        <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center shadow-xs">
                <Users className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-bold text-slate-700 tracking-wide">第三層：業務功能群組</span>
                <h3 className="text-base font-bold text-slate-900">User 群組 ({userGroups.length}組 / {userCount}人)</h3>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveSubTab('GROUPS_MATRIX');
                setShowCreateGroupModal(true);
              }}
              className="text-xs px-2.5 py-1 rounded bg-slate-800 text-white hover:bg-slate-700 font-medium transition-colors shadow-xs"
            >
              + 新增群組
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            內建「工務、財務、採購、業務」4 大標準組，並支援無限擴充自訂群組與模組細項權限。
          </p>
          <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>內建預設: <strong>4 大營造核心組</strong></span>
            <span>自訂群組: <strong>{userGroups.filter(g => !g.isSystem).length} 組</strong></span>
          </div>
        </div>
      </div>

      {/* 頁籤內容一：人員帳號名冊 */}
      {activeSubTab === 'USERS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* 工具列 */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/60">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* 角色過濾 */}
              <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200 text-xs">
                <button
                  onClick={() => setFilterRole('ALL')}
                  className={`px-2.5 py-1 rounded font-medium ${filterRole === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  全部 ({users.length})
                </button>
                <button
                  onClick={() => setFilterRole('SUPERADMIN')}
                  className={`px-2.5 py-1 rounded font-medium ${filterRole === 'SUPERADMIN' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Superadmin ({superadminCount})
                </button>
                <button
                  onClick={() => setFilterRole('ADMIN')}
                  className={`px-2.5 py-1 rounded font-medium ${filterRole === 'ADMIN' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Admin ({adminCount})
                </button>
                <button
                  onClick={() => setFilterRole('USER')}
                  className={`px-2.5 py-1 rounded font-medium ${filterRole === 'USER' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  User 群組 ({userCount})
                </button>
              </div>

              {/* 搜尋框 */}
              <input
                type="text"
                placeholder="搜尋姓名、帳號、Email或群組..."
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-48 sm:w-64"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => setShowCreateUserModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                新增同仁帳號
              </button>
            </div>
          </div>

          {/* 人員列表 Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">員工工號 / 姓名</th>
                  <th className="py-3 px-4">登入帳號 & Email</th>
                  <th className="py-3 px-4">身分層級 / 所屬業務群組</th>
                  <th className="py-3 px-4">授權公司</th>
                  <th className="py-3 px-4">審批金額上限</th>
                  <th className="py-3 px-4">帳號狀態</th>
                  <th className="py-3 px-4 text-right">操作管理</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(user => {
                  const isUserSuperadmin = user.role === 'SUPERADMIN';
                  const isUserAdmin = user.role === 'ADMIN';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            isUserSuperadmin 
                              ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                              : isUserAdmin 
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-200' 
                                : 'bg-slate-100 text-slate-800'
                          }`}>
                            {user.fullName.substring(0, 1)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {user.fullName}
                              {isUserSuperadmin && (
                                <Crown className="w-3.5 h-3.5 text-amber-600" title="最高主控者" />
                              )}
                            </div>
                            <span className="font-mono text-slate-500 text-[11px]">{user.employeeId}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono font-medium text-slate-900">{user.username}</div>
                        <div className="text-slate-500 text-[11px]">{user.email}</div>
                      </td>

                      <td className="py-3 px-4">
                        {isUserSuperadmin ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-semibold text-[11px]">
                            <Crown className="w-3 h-3 text-amber-600" />
                            Superadmin (唯一最高)
                          </div>
                        ) : isUserAdmin ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold text-[11px]">
                            <ShieldCheck className="w-3 h-3 text-indigo-600" />
                            系統管理員 Admin
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-medium text-[11px]">
                            <Users className="w-3 h-3 text-slate-500" />
                            {user.groupName || '未指定群組'}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {user.allowedCompanies.map(c => (
                            <span key={c} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-slate-900 tabular-nums">
                        {isUserSuperadmin ? (
                          <span className="text-amber-700 font-semibold">無上限 (999M)</span>
                        ) : isUserAdmin ? (
                          <span>$50,000,000</span>
                        ) : (
                          <span>
                            ${(userGroups.find(g => g.id === user.groupId)?.approvalLimit || 0).toLocaleString()}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded ${
                          user.status === 'ACTIVE' 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          {user.status === 'ACTIVE' ? '在職中' : '已停權'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 模擬登入身分 */}
                          {onImpersonateUser && (
                            <button
                              onClick={() => onImpersonateUser(user)}
                              title="一鍵模擬此同仁身分登入體驗"
                              className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors border border-slate-200"
                            >
                              身分模擬
                            </button>
                          )}

                          {/* 編輯同仁 */}
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setEditUserForm({
                                fullName: user.fullName,
                                email: user.email,
                                role: user.role as UserRole,
                                groupId: user.groupId || 'GRP-ENG',
                                allowedCompanies: user.allowedCompanies,
                                defaultCompanyId: user.defaultCompanyId,
                                status: user.status,
                                dailyExportLimit: user.dailyExportLimit,
                                passwordPlain: '',
                              });
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                            title="編輯設定"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* 停權/啟用 (Superadmin 禁用) */}
                          {!isUserSuperadmin && (
                            <button
                              onClick={() => {
                                const next = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
                                updateUser(user.id, { status: next }, currentOperatorName);
                                onDataChanged();
                                showToast(`已將【${user.fullName}】設定為${next === 'ACTIVE' ? '啟用' : '停權'}`);
                              }}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded transition-colors"
                              title={user.status === 'ACTIVE' ? '停權同仁' : '恢復啟用'}
                            >
                              {user.status === 'ACTIVE' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* 刪除同仁 (Superadmin 禁用) */}
                          {!isUserSuperadmin && (
                            <button
                              onClick={() => {
                                if (window.confirm(`確定要刪除同仁【${user.fullName}】帳號嗎？`)) {
                                  deleteUser(user.id, currentOperatorName);
                                  onDataChanged();
                                  showToast(`已刪除同仁【${user.fullName}】`);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="刪除帳號"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 頁籤內容二：群組模組權限矩陣 (PBAC Matrix) */}
      {activeSubTab === 'GROUPS_MATRIX' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左側：群組選單與新增自訂群組按鈕 */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-900 tracking-wide">權限群組清單</h3>
                <button
                  onClick={() => setShowCreateGroupModal(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  新建自訂組
                </button>
              </div>

              <div className="space-y-1.5">
                {userGroups.map(grp => {
                  const isSelected = grp.id === selectedGroupId;
                  return (
                    <div
                      key={grp.id}
                      onClick={() => setSelectedGroupId(grp.id)}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          {grp.groupName}
                          {grp.isSystem && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-normal">
                              內建
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">
                          {grp.memberCount || 0}人
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                        {grp.description || '無詳細描述'}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>上限: ${(grp.approvalLimit || 0).toLocaleString()}</span>
                        <span>{grp.canExportData ? '可匯出' : '禁匯出'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 群組管理與刪除自訂群組 */}
            {activeGroup && !activeGroup.isSystem && (
              <div className="bg-rose-50/60 rounded-xl border border-rose-200 p-4">
                <h4 className="text-xs font-bold text-rose-900 mb-1">自訂群組管理</h4>
                <p className="text-[11px] text-rose-700 mb-3 leading-relaxed">
                  可刪除此自訂群組，但群組內不可有任何在職同仁。
                </p>
                <button
                  onClick={() => handleDeleteGroup(activeGroup)}
                  className="w-full py-1.5 px-3 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                >
                  刪除此自訂群組
                </button>
              </div>
            )}
          </div>

          {/* 右側：選定群組之模組細項權限矩陣網格 */}
          <div className="lg:col-span-3 space-y-4">
            {activeGroup && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* 群組標題與屬性設定 */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        【{activeGroup.groupName}】模組權限矩陣
                      </h3>
                      <span className="text-xs font-mono text-slate-500">({activeGroup.groupCode})</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{activeGroup.description}</p>
                  </div>

                  {/* 限額與匯出快調表單 */}
                  <form onSubmit={handleSaveGroupConfig} className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-600 font-medium">審核上限:</span>
                      <input
                        type="number"
                        min="0"
                        step="100000"
                        value={activeGroup.approvalLimit}
                        onChange={e => {
                          const val = Number(e.target.value) || 0;
                          setUserGroups(prev => prev.map(g => g.id === activeGroup.id ? { ...g, approvalLimit: val } : g));
                        }}
                        className="w-28 px-2 py-1 text-xs border border-slate-300 rounded font-mono bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeGroup.canExportData}
                        onChange={e => {
                          const checked = e.target.checked;
                          setUserGroups(prev => prev.map(g => g.id === activeGroup.id ? { ...g, canExportData: checked } : g));
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>開放資料匯出 (Excel/PDF)</span>
                    </label>

                    <button
                      type="submit"
                      className="px-3 py-1 text-xs font-semibold rounded bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs"
                    >
                      儲存設定
                    </button>
                  </form>
                </div>

                {/* 12 大模組勾選矩陣表 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                      <tr>
                        <th className="py-3 px-4">營造核心模組</th>
                        <th className="py-3 px-4">所屬業務範疇</th>
                        <th className="py-3 px-4 text-center">讀取 (Read)</th>
                        <th className="py-3 px-4 text-center">建立/修改 (Write)</th>
                        <th className="py-3 px-4 text-center">單據核准 (Approve)</th>
                        <th className="py-3 px-4 text-center">報表匯出 (Export)</th>
                        <th className="py-3 px-4 text-right">批次快捷</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeGroup.permissions.map(p => {
                        const allChecked = p.canRead && p.canWrite && p.canApprove && p.canExport;
                        return (
                          <tr key={p.moduleKey} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {p.moduleName}
                            </td>

                            <td className="py-3 px-4 text-slate-500">
                              {p.category === 'CORE_ENGINEERING' && '工程案場與計價'}
                              {p.category === 'PROCUREMENT_SUBCONTRACT' && '採購下包管理'}
                              {p.category === 'FINANCE_ACCOUNTING' && '財務會計資金'}
                              {p.category === 'GOVERNANCE' && '內控與系統治理'}
                            </td>

                            {/* 讀取 Read */}
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={p.canRead}
                                onChange={() => handleTogglePermission(p.moduleKey, 'canRead')}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>

                            {/* 修改 Write */}
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={p.canWrite}
                                onChange={() => handleTogglePermission(p.moduleKey, 'canWrite')}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>

                            {/* 核准 Approve */}
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={p.canApprove}
                                onChange={() => handleTogglePermission(p.moduleKey, 'canApprove')}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>

                            {/* 匯出 Export */}
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={p.canExport}
                                onChange={() => handleTogglePermission(p.moduleKey, 'canExport')}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>

                            {/* 批次模組全開/全關 */}
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleToggleAllForModule(p.moduleKey)}
                                className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
                                  allChecked
                                    ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                }`}
                              >
                                {allChecked ? '全清空' : '全授權'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 頁籤內容三：三層身分防護機制解說 */}
      {activeSubTab === 'TIER_ARCHITECTURE' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">營造工程 ERP 內控權限架構設計規範</h3>
            <p className="text-xs text-slate-500 mt-1">
              遵循實務工程內控防弊準則，杜絕未授權發包、越權核准與資料洩漏風險。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-sm mb-2">
                <Crown className="w-4 h-4 text-amber-600" />
                唯一 Superadmin 憲法防護
              </div>
              <ul className="text-xs text-amber-800 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>系統強制保證永遠恰好存在 <strong>1 位 Superadmin</strong>。</li>
                <li>任何一般 Admin 均<strong>無權刪除、停用或降級</strong> Superadmin。</li>
                <li>更換最高管理者時，必須由現任 Superadmin 主動發起「移轉交接」流程。</li>
                <li>具備資料庫備份還原與底層 SQL Console 執行權限。</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40">
              <div className="flex items-center gap-2 font-bold text-indigo-900 text-sm mb-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                若干位 Admin 分權維護
              </div>
              <ul className="text-xs text-indigo-800 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>工地工務所長或系統資訊主管可擔任 Admin。</li>
                <li>可自由建立、維護同仁帳號、指派業務所屬群組。</li>
                <li>無權竄改 Superadmin 或變更全域不可逆之加密憑證。</li>
                <li>審核限額預設為 $50,000,000，滿足日常大額採購審批。</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-2">
                <Users className="w-4 h-4 text-slate-600" />
                User 群組矩陣化配置 (PBAC)
              </div>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>同仁依職掌加入對應群組（工務、財務、採購、業務）。</li>
                <li>以 12 大模組 x 4 種操作（讀/寫/核/匯）精密鎖定邊界。</li>
                <li>群組權限調整即刻全域生效，無需逐一修改各同仁帳號。</li>
                <li>嚴格執行零負數、防浮報與合約保留款自動扣抵防呆。</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: 新增同仁帳號 */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                新增同仁帳號與身分指派
              </h3>
              <button
                onClick={() => setShowCreateUserModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">員工編號 (ID) *</label>
                  <input
                    type="text"
                    required
                    value={newUserForm.employeeId}
                    onChange={e => setNewUserForm({ ...newUserForm, employeeId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">同仁中文姓名 *</label>
                  <input
                    type="text"
                    required
                    placeholder="例：陳志豪 工程師"
                    value={newUserForm.fullName}
                    onChange={e => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">系統登入帳號 *</label>
                  <input
                    type="text"
                    required
                    placeholder="例：chen.eng"
                    value={newUserForm.username}
                    onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">預設登入密碼</label>
                  <input
                    type="text"
                    value={newUserForm.passwordPlain}
                    onChange={e => setNewUserForm({ ...newUserForm, passwordPlain: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">電子郵件 Email *</label>
                <input
                  type="email"
                  required
                  placeholder="name@greatgiant.com.tw"
                  value={newUserForm.email}
                  onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* 關鍵：三層身分層級選取 */}
              <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/50 space-y-2">
                <label className="block text-indigo-950 font-bold">身分層級與權限角色 *</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded bg-white border border-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="roleTier"
                      value="USER"
                      checked={newUserForm.role === 'USER'}
                      onChange={() => setNewUserForm({ ...newUserForm, role: 'USER' })}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-slate-900">User 業務群組</div>
                      <div className="text-[10px] text-slate-500">依指派群組繼承模組權限</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded bg-white border border-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="roleTier"
                      value="ADMIN"
                      checked={newUserForm.role === 'ADMIN'}
                      onChange={() => setNewUserForm({ ...newUserForm, role: 'ADMIN' })}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-slate-900">Admin 系統管理員</div>
                      <div className="text-[10px] text-slate-500">具備帳號維護與審核權</div>
                    </div>
                  </label>
                </div>

                {/* 當選 User 時，選擇指派之群組 */}
                {newUserForm.role === 'USER' && (
                  <div className="mt-2">
                    <label className="block text-slate-700 font-semibold mb-1">指派業務群組 *</label>
                    <select
                      value={newUserForm.groupId}
                      onChange={e => setNewUserForm({ ...newUserForm, groupId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                    >
                      {userGroups.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.groupName} (上限 ${(g.approvalLimit || 0).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  確認建立同仁帳號
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: 編輯同仁資料 */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                編輯同仁【{editingUser.fullName}】身分與群組
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">中文姓名 *</label>
                  <input
                    type="text"
                    required
                    value={editUserForm.fullName}
                    onChange={e => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">電子郵件 *</label>
                  <input
                    type="email"
                    required
                    value={editUserForm.email}
                    onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 身分層級 */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">身分角色</label>
                {editingUser.role === 'SUPERADMIN' ? (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-bold flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-600" />
                    Superadmin 唯一最高管理者 (受核心憲法保護不可直接降級)
                  </div>
                ) : (
                  <select
                    value={editUserForm.role}
                    onChange={e => setEditUserForm({ ...editUserForm, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    <option value="USER">User (一般業務群組同仁)</option>
                    <option value="ADMIN">Admin (分權系統管理員)</option>
                  </select>
                )}
              </div>

              {/* 若為 USER 則可修改所屬群組 */}
              {editUserForm.role === 'USER' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">所屬業務群組</label>
                  <select
                    value={editUserForm.groupId}
                    onChange={e => setEditUserForm({ ...editUserForm, groupId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    {userGroups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.groupName} (上限 ${(g.approvalLimit || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">重設密碼 (留空代表不變更)</label>
                <input
                  type="password"
                  placeholder="輸入新密碼以重設..."
                  value={editUserForm.passwordPlain}
                  onChange={e => setEditUserForm({ ...editUserForm, passwordPlain: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  儲存修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: 轉移最高 Superadmin 權限 */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-amber-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-amber-200 flex items-center justify-between bg-amber-50">
              <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-600" />
                最高 Superadmin 權限交接移轉
              </h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransferSuperadmin} className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                系統嚴格保障<strong>僅有且恰有 1 位 Superadmin</strong>。完成轉移後，您將轉為<strong>一般系統管理員 (Admin)</strong>，而選定之同仁將獲得系統最高主控權。
              </p>

              <div>
                <label className="block text-slate-800 font-bold mb-1">請選取接替之同仁 *</label>
                <select
                  required
                  value={transferTargetId}
                  onChange={e => setTransferTargetId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-medium"
                >
                  <option value="">-- 請選擇同仁 --</option>
                  {users
                    .filter(u => u.role !== 'SUPERADMIN' && u.status === 'ACTIVE')
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.employeeId} - {u.role === 'ADMIN' ? '系統管理員' : u.groupName || 'User'})
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                ⚠️ 注意：此項操作屬於不可逆之重大安全授權，完成後即刻生效並寫入稽核日誌。
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!transferTargetId}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  確認移交最高權限
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: 新增自訂權限群組 */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                新增自訂業務權限群組
              </h3>
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">群組名稱 *</label>
                <input
                  type="text"
                  required
                  placeholder="例：機電弱電特工組、外部顧問查閱組"
                  value={newGroupForm.groupName}
                  onChange={e => setNewGroupForm({ ...newGroupForm, groupName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">英文群組代碼</label>
                <input
                  type="text"
                  placeholder="例：GRP_MEP"
                  value={newGroupForm.groupCode}
                  onChange={e => setNewGroupForm({ ...newGroupForm, groupCode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">群組職掌描述</label>
                <textarea
                  rows={2}
                  placeholder="說明此群組的業務權責與使用時機..."
                  value={newGroupForm.description}
                  onChange={e => setNewGroupForm({ ...newGroupForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">審核金額上限 ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="500000"
                    value={newGroupForm.approvalLimit}
                    onChange={e => setNewGroupForm({ ...newGroupForm, approvalLimit: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newGroupForm.canExportData}
                      onChange={e => setNewGroupForm({ ...newGroupForm, canExportData: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>具備報表匯出權</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  建立群組
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
