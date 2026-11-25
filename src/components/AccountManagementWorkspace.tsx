import React, { useState, useMemo, useEffect } from 'react';
import { Archive, Clock, ScrollText, ShieldCheck, Users } from 'lucide-react';
import { AuditLog, Company, CompanyGroupAssignment, User } from '../types/erp';
import { useAuth } from '../context/AuthContext';
import {
  advanceUserToArchive,
  createUser,
  getAllAuditLogs,
  markUserPendingDelete,
  resetUserPassword,
  restorePendingUser,
  superadminPermanentPurge,
  superadminRestoreArchivedUser,
  toggleAdminConfigPrivilege,
  toggleAdminPeerPrivilege,
  toggleAdminUserManagerPrivilege,
  toggleUserStatus,
  transferSuperadmin,
  updateUser,
} from '../db/sqlite';
import {
  AlertModalState,
  computeUserDiffs,
  DiffItem,
  filterActiveUsers,
  filterAuditLogs,
  UserFormData,
} from './settings/accounts/accountManagementUtils';
import { AccountOverviewCards } from './settings/accounts/AccountOverviewCards';
import { AccountActiveUsersTab } from './settings/accounts/AccountActiveUsersTab';
import {
  AccountArchiveTab,
  AccountTrashTab,
} from './settings/accounts/AccountLifecycleTrashArchiveTab';
import { AccountAuditLogsTab } from './settings/accounts/AccountAuditLogsTab';
import {
  AccountDiffConfirmModal,
  AccountUserEditorModal,
} from './settings/accounts/AccountUserEditorModal';
import { GroupPermissionMatrixModal } from './settings/accounts/GroupPermissionMatrixModal';
import {
  AccountAlertModal,
  AccountUndoToast,
  AdvanceToArchiveConfirmModal,
  DeleteToTrashConfirmModal,
  PasswordResetModal,
  PermanentPurgeConfirmModal,
  TransferSuperadminModal,
} from './settings/accounts/AccountSecurityModals';

interface AccountManagementWorkspaceProps {
  companies: Company[];
  onDataChanged: () => void;
}

const DEFAULT_FORM_DATA: UserFormData = {
  username: '',
  fullName: '',
  email: '',
  title: '',
  role: 'USER',
  canManageUsers: false,
  canManageSystemConfigs: false,
  canManageAdmins: false,
  canManageAllCompanies: false,
  groupIds: ['GRP-ENG'],
  companyGroupAssignments: [],
  permissionMode: 'GLOBAL',
  allowedCompanies: ['COMP-01', 'COMP-02'],
  defaultCompanyId: 'COMP-01',
  password: '888888',
};

export const AccountManagementWorkspace: React.FC<AccountManagementWorkspaceProps> = ({
  companies,
  onDataChanged,
}) => {
  const { currentUser, allUsers, allGroups, allPermissions, isSuperadmin, switchUser, reloadAuth } =
    useAuth();

  const isOperatorBoss = currentUser?.role === 'BOSS';
  const operatorCanManageUsers =
    isSuperadmin || isOperatorBoss || Boolean(currentUser?.canManageUsers);
  const operatorCanManageAdmins =
    isSuperadmin || isOperatorBoss || Boolean(currentUser?.canManageAdmins);
  const operatorCanGrantPrivileges = isSuperadmin || isOperatorBoss;
  const operatorRole = isSuperadmin ? 'SUPERADMIN' : isOperatorBoss ? 'BOSS' : 'ADMIN';

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'TRASH' | 'ARCHIVE' | 'AUDIT_LOGS'>('ACTIVE');

  // 搜尋與篩選狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'SUPERADMIN' | 'BOSS' | 'ADMIN' | 'USER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
  const [privilegeFilter, setPrivilegeFilter] = useState<
    'ALL' | 'USER_MGR' | 'SYS_CONFIG' | 'PEER_ADMIN' | 'NONE'
  >('ALL');

  // Toast 與安全提示狀態
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };
  const [alertModal, setAlertModal] = useState<AlertModalState | null>(null);

  // 彈窗狀態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(DEFAULT_FORM_DATA);
  const [diffConfirmInfo, setDiffConfirmInfo] = useState<{
    targetUser: User;
    diffs: DiffItem[];
    payload: any;
  } | null>(null);

  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('888888');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferConfirmText, setTransferConfirmText] = useState('');
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);

  // 稽核日誌狀態
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditUserFilter, setAuditUserFilter] = useState('ALL');

  // 多階段刪除與復原倒數狀態
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [advanceArchiveConfirmUser, setAdvanceArchiveConfirmUser] = useState<User | null>(null);
  const [purgeConfirmUser, setPurgeConfirmUser] = useState<User | null>(null);
  const [purgeConfirmInput, setPurgeConfirmInput] = useState('');
  const [undoToast, setUndoToast] = useState<{ user: User; countdown: number } | null>(null);

  const refreshAuditLogs = () => {
    try {
      setAuditLogs(getAllAuditLogs(300));
    } catch (e) {
      console.error('Failed to fetch audit logs', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'AUDIT_LOGS') {
      refreshAuditLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!undoToast) return;
    if (undoToast.countdown <= 0) {
      setUndoToast(null);
      return;
    }
    const timer = setTimeout(() => {
      setUndoToast(prev => (prev ? { ...prev, countdown: prev.countdown - 1 } : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [undoToast]);

  const getGroupName = (groupId?: string) => {
    const found = allGroups.find(g => g.id === groupId);
    return found ? found.groupName : groupId;
  };

  const handleToggleMatrixCompanyGroup = (companyId: string, groupId: string) => {
    setFormData(prev => {
      const existing = prev.companyGroupAssignments.find(a => a.companyId === companyId);
      let updatedAssignments: CompanyGroupAssignment[];
      if (existing) {
        const hasGrp = existing.groupIds.includes(groupId);
        const nextGroups = hasGrp
          ? existing.groupIds.filter(g => g !== groupId)
          : [...existing.groupIds, groupId];
        updatedAssignments = prev.companyGroupAssignments.map(a =>
          a.companyId === companyId ? { ...a, groupIds: nextGroups } : a
        );
      } else {
        updatedAssignments = [...prev.companyGroupAssignments, { companyId, groupIds: [groupId] }];
      }
      const compHasAny = updatedAssignments.some(
        a => a.companyId === companyId && a.groupIds.length > 0
      );
      const nextAllowed =
        compHasAny && !prev.allowedCompanies.includes(companyId)
          ? [...prev.allowedCompanies, companyId]
          : prev.allowedCompanies;
      const allAssigned = Array.from(new Set(updatedAssignments.flatMap(a => a.groupIds)));
      return {
        ...prev,
        allowedCompanies: nextAllowed,
        companyGroupAssignments: updatedAssignments,
        groupIds: allAssigned.length > 0 ? allAssigned : prev.groupIds,
      };
    });
  };

  const handleSetMatrixCompanyAllGroups = (companyId: string, groupIds: string[]) => {
    setFormData(prev => {
      const filtered = prev.companyGroupAssignments.filter(a => a.companyId !== companyId);
      const updatedAssignments = [...filtered, { companyId, groupIds }];
      const allAssigned = Array.from(new Set(updatedAssignments.flatMap(a => a.groupIds)));
      const nextAllowed =
        groupIds.length > 0 && !prev.allowedCompanies.includes(companyId)
          ? [...prev.allowedCompanies, companyId]
          : prev.allowedCompanies;
      return {
        ...prev,
        allowedCompanies: nextAllowed,
        companyGroupAssignments: updatedAssignments,
        groupIds: allAssigned.length > 0 ? allAssigned : prev.groupIds,
      };
    });
  };

  // 核心防護：檢查當前操作者是否可操作目標帳號
  const checkCanManageTarget = (target: User, actionName: string): boolean => {
    if (target.role === 'SUPERADMIN' && !isSuperadmin) {
      setAlertModal({
        title: `【憲法金身防護】無法${actionName}最高架構師`,
        message:
          '系統唯一最高架構師 (Superadmin) 具備不可撼動之金身保護，嚴禁由其他人員進行編輯、重設密碼、停用或刪除！',
        details: '如需更換最高管理員，必須由現任 Superadmin 發起「最高權限交接程序」。',
      });
      return false;
    }

    if (target.role === 'BOSS' && !isSuperadmin && !isOperatorBoss) {
      setAlertModal({
        title: `【金身護體防護】無法${actionName}企業最高統裁 (BOSS)`,
        message:
          '集團董事長 (BOSS) 為全企業最高統裁決策者，享有不可撼動的金身護體保護，任何系統管理員均無權對其進行編輯、停權、刪除或重設密碼！',
        details: '集團董事長帳號由董事長本人自主維護，或由系統架構師於底層支援。',
      });
      return false;
    }

    if (!isSuperadmin && !isOperatorBoss && !operatorCanManageUsers) {
      setAlertModal({
        title: '【權限不足】無帳號管理專人權限',
        message: '他人帳號與密碼只能由最高統裁 (BOSS) 或指定之帳號管理專人 Admin 進行維護！',
        details: `您目前未具備帳號管理專人授權，無權執行「${actionName}」操作。若有管理需要，請洽詢董事長或 Superadmin。`,
      });
      return false;
    }

    if (
      target.role === 'ADMIN' &&
      target.id !== currentUser?.id &&
      !isSuperadmin &&
      !isOperatorBoss &&
      !operatorCanManageAdmins
    ) {
      setAlertModal({
        title: `【階層原則受限】無法${actionName}其他同階管理員`,
        message: '您尚未取得授予之【同階管理特許 (canManageAdmins)】！',
        details: `依系統階層防護憲法，一般帳號管理專人 Admin 預設只能管理下一階層（一般同仁 User）。除非由企業最高統裁 (BOSS) 或 Superadmin 為您開啟「同階管理特許」，否則無法${actionName}其他同階 Admin 帳號。`,
      });
      return false;
    }

    return true;
  };

  const handleOpenCreate = () => {
    if (!isSuperadmin && !isOperatorBoss && !operatorCanManageUsers) {
      setAlertModal({
        title: '【權限不足】無帳號管理專人權限',
        message: '新增系統同仁帳號需由唯一最高 Superadmin 特別指定之專人 Admin 始得操作！',
        details: '您目前未具備帳號管理專人授權，無法新增帳號。',
      });
      return;
    }
    setEditingUser(null);
    setFormData(DEFAULT_FORM_DATA);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    if (!checkCanManageTarget(user, '編輯')) return;
    setEditingUser(user);
    const hasMatrix = Boolean(
      user.companyGroupAssignments && user.companyGroupAssignments.length > 0
    );
    setFormData({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      title: user.title || '',
      role: user.role === 'SUPERADMIN' ? 'ADMIN' : user.role,
      canManageUsers: Boolean(user.canManageUsers),
      canManageSystemConfigs: Boolean(user.canManageSystemConfigs),
      canManageAdmins: Boolean(user.canManageAdmins),
      canManageAllCompanies: Boolean(user.canManageAllCompanies),
      groupIds:
        user.groupIds && user.groupIds.length > 0
          ? user.groupIds
          : user.groupId
          ? [user.groupId]
          : [],
      companyGroupAssignments: user.companyGroupAssignments || [],
      permissionMode: hasMatrix ? 'MATRIX' : 'GLOBAL',
      allowedCompanies:
        user.allowedCompanies && user.allowedCompanies.length > 0
          ? user.allowedCompanies
          : ['COMP-01'],
      defaultCompanyId: user.defaultCompanyId || 'COMP-01',
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.fullName.trim()) {
      setAlertModal({
        title: '欄位檢核失敗',
        message: '同仁登入帳號代碼與真實姓名為必填欄位，請完整輸入！',
      });
      return;
    }

    if (formData.role === 'USER') {
      if (formData.permissionMode === 'MATRIX') {
        const hasValidAssignment = formData.companyGroupAssignments.some(
          a => a.groupIds && a.groupIds.length > 0
        );
        if (!hasValidAssignment) {
          setAlertModal({
            title: '矩陣授權未設定',
            message: '您選擇了「跨法人業務授權矩陣模式」，請至少為一家營運法人指派業務職能群組！',
          });
          return;
        }
      } else if (formData.groupIds.length === 0) {
        setAlertModal({
          title: '業務群組未指派',
          message: '一般同仁帳號必須至少指派一個所屬業務群組！',
        });
        return;
      }
    }

    const operatorName = currentUser?.fullName || '系統管理員';

    if (!editingUser) {
      try {
        createUser(
          {
            username: formData.username.trim(),
            fullName: formData.fullName.trim(),
            email: formData.email.trim(),
            title: formData.title.trim(),
            role: formData.role,
            canManageUsers:
              operatorCanGrantPrivileges && formData.role === 'ADMIN'
                ? Boolean(formData.canManageUsers)
                : false,
            canManageSystemConfigs:
              operatorCanGrantPrivileges && formData.role === 'ADMIN'
                ? Boolean(formData.canManageSystemConfigs)
                : false,
            canManageAdmins:
              operatorCanGrantPrivileges && formData.role === 'ADMIN'
                ? Boolean(formData.canManageAdmins)
                : false,
            canManageAllCompanies:
              operatorCanGrantPrivileges && formData.role === 'ADMIN'
                ? Boolean(formData.canManageAllCompanies)
                : false,
            groupIds:
              formData.role === 'USER'
                ? formData.groupIds.length > 0
                  ? formData.groupIds
                  : ['GRP-ENG']
                : [],
            companyGroupAssignments:
              formData.role === 'USER' && formData.permissionMode === 'MATRIX'
                ? formData.companyGroupAssignments
                : [],
            allowedCompanies: formData.allowedCompanies,
            defaultCompanyId: formData.defaultCompanyId,
            password: formData.password || '888888',
          },
          operatorRole,
          operatorName,
          operatorCanManageUsers,
          operatorCanManageAdmins
        );

        showToast(`🎉 成功建立新同仁【${formData.fullName}】帳號！`);
        setIsModalOpen(false);
        reloadAuth();
        onDataChanged();
      } catch (err: unknown) {
        setAlertModal({ title: '建立同仁帳號失敗', message: (err as Error).message });
      }
      return;
    }

    const diffs = computeUserDiffs(
      formData,
      editingUser,
      companies,
      getGroupName,
      operatorCanGrantPrivileges
    );

    if (diffs.length === 0) {
      setAlertModal({
        title: '未偵測到資料異動',
        message: '帳號所有欄位內容皆與目前資料完全相同，無須執行更新。',
      });
      return;
    }

    const finalGroupIds =
      formData.role === 'USER'
        ? formData.groupIds.length > 0
          ? formData.groupIds
          : ['GRP-ENG']
        : [];

    const payload = {
      id: editingUser.id,
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      title: formData.title.trim(),
      role:
        editingUser.role === 'SUPERADMIN' || editingUser.role === 'BOSS'
          ? undefined
          : formData.role,
      canManageUsers:
        operatorCanGrantPrivileges && formData.role === 'ADMIN'
          ? formData.canManageUsers
          : undefined,
      canManageSystemConfigs:
        operatorCanGrantPrivileges && formData.role === 'ADMIN'
          ? formData.canManageSystemConfigs
          : undefined,
      canManageAdmins:
        operatorCanGrantPrivileges && formData.role === 'ADMIN'
          ? formData.canManageAdmins
          : undefined,
      canManageAllCompanies:
        operatorCanGrantPrivileges && formData.role === 'ADMIN'
          ? formData.canManageAllCompanies
          : undefined,
      groupIds: finalGroupIds,
      companyGroupAssignments:
        formData.role === 'USER' && formData.permissionMode === 'MATRIX'
          ? formData.companyGroupAssignments
          : [],
      allowedCompanies: formData.allowedCompanies,
      defaultCompanyId: formData.defaultCompanyId,
    };

    setDiffConfirmInfo({ targetUser: editingUser, diffs, payload });
  };

  const handleExecuteConfirmedUpdate = () => {
    if (!diffConfirmInfo) return;
    const operatorName = currentUser?.fullName || '系統管理員';
    try {
      updateUser(
        diffConfirmInfo.payload,
        operatorRole,
        operatorName,
        operatorCanManageUsers,
        operatorCanManageAdmins,
        currentUser?.id
      );
      showToast(`✅ 已成功更新同仁【${diffConfirmInfo.targetUser.fullName}】之帳號資料！`);
      setDiffConfirmInfo(null);
      setIsModalOpen(false);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setDiffConfirmInfo(null);
      setAlertModal({ title: '更新帳號失敗', message: (err as Error).message });
    }
  };

  const handleTogglePrivilege = (
    user: User,
    field: 'USER_MGR' | 'SYS_CONFIG' | 'PEER_ADMIN'
  ) => {
    if (!operatorCanGrantPrivileges) {
      setAlertModal({
        title: '【權限不足】',
        message: '唯獨系統 Superadmin 或最高統裁 (BOSS) 才有權限異動此管理員特許授權！',
      });
      return;
    }
    if (user.role !== 'ADMIN') return;
    const operatorName = currentUser?.fullName || '企業最高統裁 (BOSS)';

    try {
      if (field === 'USER_MGR') {
        const nextVal = !user.canManageUsers;
        toggleAdminUserManagerPrivilege(user.id, nextVal, operatorRole, operatorName);
        showToast(
          nextVal
            ? `🔑 已特許指定【${user.fullName}】為帳號管理專人（開放帳號模組與重設他人密碼）！`
            : `🔒 已收回【${user.fullName}】之帳號管理專人權限（選單完全隱藏）！`
        );
      } else if (field === 'SYS_CONFIG') {
        const nextVal = !user.canManageSystemConfigs;
        toggleAdminConfigPrivilege(user.id, nextVal, operatorRole, operatorName);
        showToast(
          nextVal
            ? `🛡️ 已特許開放【${user.fullName}】修改全域核心參數！`
            : `🔒 已收回【${user.fullName}】之全域核心參數特許權限！`
        );
      } else {
        const nextVal = !user.canManageAdmins;
        toggleAdminPeerPrivilege(user.id, nextVal, operatorRole, operatorName);
        showToast(
          nextVal
            ? `👑 已特許授權【${user.fullName}】可管理同階 Admin 帳號！`
            : `🔒 已收回【${user.fullName}】之同階 Admin 管理特許！`
        );
      }
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '特許授權失敗', message: (err as Error).message });
    }
  };

  const handleToggleStatus = (user: User) => {
    if (user.id === currentUser?.id) {
      setAlertModal({
        title: '【安全防呆】禁止停用自身帳號',
        message:
          '系統安全機制嚴禁將當前正在登入操作的使用者帳號設為停用！若需停用此帳號，請由其他具備權限之專人管理員或 Superadmin 進行此操作。',
      });
      return;
    }
    if (!checkCanManageTarget(user, user.status === 'ACTIVE' ? '停用' : '啟用')) return;
    const nextStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      toggleUserStatus(
        user.id,
        nextStatus,
        operatorRole,
        currentUser?.fullName || '管理員',
        operatorCanManageUsers,
        operatorCanManageAdmins,
        currentUser?.id
      );
      showToast(
        nextStatus === 'ACTIVE'
          ? `✅ 已重新啟用同仁【${user.fullName}】帳號！`
          : `⏸️ 已停用同仁【${user.fullName}】帳號！`
      );
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '狀態切換失敗', message: (err as Error).message });
    }
  };

  const handleConfirmResetPassword = () => {
    if (!resetModalUser) return;
    if (!newPasswordInput.trim()) {
      setAlertModal({ title: '輸入錯誤', message: '請輸入有效的重設密碼！' });
      return;
    }
    try {
      resetUserPassword(
        resetModalUser.id,
        newPasswordInput.trim(),
        operatorRole,
        currentUser?.fullName || '管理員',
        operatorCanManageUsers,
        operatorCanManageAdmins
      );
      showToast(`🔑 已成功重設【${resetModalUser.fullName}】密碼為：${newPasswordInput.trim()}！`);
      setResetModalUser(null);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '重設密碼失敗', message: (err as Error).message });
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmUser) return;
    const target = deleteConfirmUser;
    try {
      markUserPendingDelete(
        target.id,
        operatorRole,
        currentUser?.fullName || '管理員',
        operatorCanManageUsers,
        operatorCanManageAdmins
      );
      setDeleteConfirmUser(null);
      setUndoToast({ user: target, countdown: 10 });
      showToast(`🗑️ 同仁【${target.fullName}】已移入「待刪除回收站」，具備 7 天冷卻保護期！`);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setDeleteConfirmUser(null);
      setAlertModal({ title: '移入回收站失敗', message: (err as Error).message });
    }
  };

  const handleRestorePending = (user: User) => {
    if (!checkCanManageTarget(user, '復原')) return;
    try {
      restorePendingUser(user.id, currentUser?.fullName || '管理員');
      showToast(`↩️ 已成功復原同仁【${user.fullName}】帳號回主檔！`);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '復原失敗', message: (err as Error).message });
    }
  };

  const handleAdvanceArchive = () => {
    if (!advanceArchiveConfirmUser) return;
    const target = advanceArchiveConfirmUser;
    try {
      advanceUserToArchive(
        target.id,
        operatorRole,
        currentUser?.fullName || '管理員',
        operatorCanManageUsers,
        operatorCanManageAdmins
      );
      setAdvanceArchiveConfirmUser(null);
      showToast(`📦 同仁【${target.fullName}】已提前移交 Superadmin 深度封存區！一般管理員視角已隱藏。`);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAdvanceArchiveConfirmUser(null);
      setAlertModal({ title: '移交封存失敗', message: (err as Error).message });
    }
  };

  const handleSuperadminRestore = (user: User) => {
    try {
      superadminRestoreArchivedUser(user.id, currentUser?.fullName || '管理員');
      showToast(`👑 Superadmin 終極救援成功！同仁【${user.fullName}】已無損恢復至啟用主檔。`);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '救援失敗', message: (err as Error).message });
    }
  };

  const handlePermanentPurge = () => {
    if (!purgeConfirmUser) return;
    const target = purgeConfirmUser;
    try {
      superadminPermanentPurge(
        target.id,
        currentUser?.fullName || '管理員',
        purgeConfirmInput
      );
      setPurgeConfirmUser(null);
      setPurgeConfirmInput('');
      showToast(
        `🔥 已從資料庫中徹底永久清除同仁【${target.fullName}】帳號！歷史單據仍純淨維持純文字姓名快照。`
      );
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '物理清除失敗', message: (err as Error).message });
    }
  };

  const handleUndoRestore = () => {
    if (!undoToast) return;
    const target = undoToast.user;
    try {
      restorePendingUser(target.id, currentUser?.fullName || '管理員');
      setUndoToast(null);
      showToast(`✅ 已成功一鍵復原同仁【${target.fullName}】帳號！`);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '復原失敗', message: (err as Error).message });
    }
  };

  const handleExecuteTransfer = () => {
    if (!isSuperadmin || !currentUser) {
      setAlertModal({ title: '權限不足', message: '只有當前唯一最高 Superadmin 才有權限發起交接！' });
      return;
    }
    if (!transferTargetId) {
      setAlertModal({ title: '尚未選擇對象', message: '請選擇欲交接之目標同仁！' });
      return;
    }
    if (transferConfirmText.trim() !== '確認交接最高權限') {
      setAlertModal({ title: '驗證字句不符', message: '請精確輸入確認安全字句「確認交接最高權限」！' });
      return;
    }
    const target = allUsers.find(u => u.id === transferTargetId);
    if (!target) return;
    try {
      transferSuperadmin(currentUser.id, transferTargetId, currentUser.fullName);
      showToast(
        `👑 最高管理權限已成功移轉給【${target.fullName}】！您目前已轉換為系統管理員 (Admin)。`
      );
      setIsTransferModalOpen(false);
      setTransferTargetId('');
      setTransferConfirmText('');
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '交接失敗', message: (err as Error).message });
    }
  };

  // 分群與過濾統計
  const activeUsers = useMemo(
    () => allUsers.filter(u => !u.deleteStage || u.deleteStage === 'ACTIVE'),
    [allUsers]
  );
  const trashUsers = useMemo(
    () => allUsers.filter(u => u.deleteStage === 'PENDING_DELETE'),
    [allUsers]
  );
  const archivedUsers = useMemo(
    () => allUsers.filter(u => u.deleteStage === 'ARCHIVED'),
    [allUsers]
  );

  const superadminUser = activeUsers.find(u => u.role === 'SUPERADMIN');
  const bossUser = activeUsers.find(u => u.role === 'BOSS');
  const adminUsers = activeUsers.filter(u => u.role === 'ADMIN');
  const regularUsers = activeUsers.filter(u => u.role === 'USER');

  const filteredUsers = useMemo(
    () => filterActiveUsers(activeUsers, searchTerm, roleFilter, statusFilter, privilegeFilter),
    [activeUsers, searchTerm, roleFilter, statusFilter, privilegeFilter]
  );

  const filteredAuditLogs = useMemo(
    () =>
      filterAuditLogs(
        auditLogs,
        auditSearchTerm,
        auditActionFilter,
        auditUserFilter,
        allUsers,
        allGroups,
        companies
      ),
    [auditLogs, auditSearchTerm, auditActionFilter, auditUserFilter, allUsers, allGroups, companies]
  );

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-2xl text-xs font-semibold z-40 animate-in fade-in flex items-center gap-2 border border-slate-700">
          <span>{toastMessage}</span>
        </div>
      )}

      <AccountAlertModal alertModal={alertModal} onClose={() => setAlertModal(null)} />

      {/* 視圖切換頁籤 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ACTIVE'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>同仁主檔</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'ACTIVE' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {activeUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TRASH')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'TRASH'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>待刪除回收站 (7日冷卻)</span>
            {trashUsers.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === 'TRASH' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {trashUsers.length}
              </span>
            )}
          </button>

          {(isSuperadmin || isOperatorBoss) && (
            <button
              type="button"
              onClick={() => setActiveTab('ARCHIVE')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ARCHIVE'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Archive className="w-4 h-4" />
              <span>帳號封存與終極清理</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 text-purple-800 font-semibold border border-purple-200">
                {isSuperadmin ? 'Superadmin' : '👑 BOSS 統裁'}
              </span>
              {archivedUsers.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    activeTab === 'ARCHIVE'
                      ? 'bg-purple-800 text-white'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {archivedUsers.length}
                </span>
              )}
            </button>
          )}

          {(isSuperadmin || isOperatorBoss) && (
            <button
              type="button"
              onClick={() => setActiveTab('AUDIT_LOGS')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'AUDIT_LOGS'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <ScrollText className="w-4 h-4 text-emerald-400" />
              <span>系統操作與登入稽核日誌</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-900 text-emerald-300 font-semibold border border-emerald-700">
                {isSuperadmin ? '特權日誌' : '👑 統裁日誌'}
              </span>
            </button>
          )}
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>分權階梯防護：7日防呆冷卻 ＋ 實體物理抹除審核</span>
        </div>
      </div>

      {activeTab === 'ACTIVE' && (
        <>
          <AccountOverviewCards
            isSuperadmin={isSuperadmin}
            superadminUser={superadminUser}
            bossUser={bossUser}
            adminUsers={adminUsers}
            userManagerAdmins={adminUsers.filter(u => u.canManageUsers)}
            configAdmins={adminUsers.filter(u => u.canManageSystemConfigs)}
            peerAdmins={adminUsers.filter(u => u.canManageAdmins)}
            regularUsers={regularUsers}
            allUsers={allUsers}
            onOpenTransferModal={() => {
              setTransferTargetId('');
              setTransferConfirmText('');
              setIsTransferModalOpen(true);
            }}
            onOpenMatrixModal={() => setIsMatrixModalOpen(true)}
          />

          <AccountActiveUsersTab
            currentUser={currentUser}
            isSuperadmin={isSuperadmin}
            operatorCanGrantPrivileges={operatorCanGrantPrivileges}
            filteredUsers={filteredUsers}
            companies={companies}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            privilegeFilter={privilegeFilter}
            onPrivilegeFilterChange={setPrivilegeFilter}
            getGroupName={getGroupName}
            onOpenMatrixModal={() => setIsMatrixModalOpen(true)}
            onOpenCreate={handleOpenCreate}
            onToggleUserManagerPrivilege={u => handleTogglePrivilege(u, 'USER_MGR')}
            onToggleSysConfigPrivilege={u => handleTogglePrivilege(u, 'SYS_CONFIG')}
            onTogglePeerAdminPrivilege={u => handleTogglePrivilege(u, 'PEER_ADMIN')}
            onToggleStatus={handleToggleStatus}
            onQuickSimulate={u => {
              switchUser(u.id);
              showToast(`⚡ 已即時模擬登入為【${u.fullName} (${u.role})】，全系統權限已即刻連動！`);
            }}
            onOpenEdit={handleOpenEdit}
            onOpenResetPassword={u => {
              if (!checkCanManageTarget(u, '重設密碼')) return;
              setResetModalUser(u);
              setNewPasswordInput('888888');
            }}
            onDeleteUser={u => {
              if (!checkCanManageTarget(u, '刪除')) return;
              if (u.id === currentUser?.id) {
                setAlertModal({
                  title: '無法刪除帳號',
                  message: '無法刪除當前正在登入操作的使用者帳號！',
                });
                return;
              }
              setDeleteConfirmUser(u);
            }}
          />
        </>
      )}

      {activeTab === 'TRASH' && (
        <AccountTrashTab
          trashUsers={trashUsers}
          onRestorePending={handleRestorePending}
          onRequestAdvanceArchive={setAdvanceArchiveConfirmUser}
        />
      )}

      {activeTab === 'ARCHIVE' && (isSuperadmin || isOperatorBoss) && (
        <AccountArchiveTab
          archivedUsers={archivedUsers}
          onSuperadminRestore={handleSuperadminRestore}
          onRequestPurge={u => {
            setPurgeConfirmUser(u);
            setPurgeConfirmInput('');
          }}
        />
      )}

      {activeTab === 'AUDIT_LOGS' && (isSuperadmin || isOperatorBoss) && (
        <AccountAuditLogsTab
          filteredAuditLogs={filteredAuditLogs}
          allUsers={allUsers}
          allGroups={allGroups}
          companies={companies}
          auditSearchTerm={auditSearchTerm}
          onAuditSearchTermChange={setAuditSearchTerm}
          auditActionFilter={auditActionFilter}
          onAuditActionFilterChange={setAuditActionFilter}
          auditUserFilter={auditUserFilter}
          onAuditUserFilterChange={setAuditUserFilter}
          onRefresh={refreshAuditLogs}
        />
      )}

      <AccountUserEditorModal
        isOpen={isModalOpen}
        editingUser={editingUser}
        formData={formData}
        setFormData={setFormData}
        currentUser={currentUser}
        isSuperadmin={isSuperadmin}
        isOperatorBoss={isOperatorBoss}
        operatorCanManageAdmins={operatorCanManageAdmins}
        operatorCanGrantPrivileges={operatorCanGrantPrivileges}
        allGroups={allGroups}
        companies={companies}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitForm}
        onShowAlert={setAlertModal}
        onToggleMatrixCompanyGroup={handleToggleMatrixCompanyGroup}
        onSetMatrixCompanyAllGroups={handleSetMatrixCompanyAllGroups}
      />

      <AccountDiffConfirmModal
        diffConfirmInfo={diffConfirmInfo}
        onCancel={() => setDiffConfirmInfo(null)}
        onConfirm={handleExecuteConfirmedUpdate}
      />

      <PasswordResetModal
        resetModalUser={resetModalUser}
        newPasswordInput={newPasswordInput}
        onPasswordChange={setNewPasswordInput}
        onClose={() => setResetModalUser(null)}
        onConfirm={handleConfirmResetPassword}
      />

      <TransferSuperadminModal
        isOpen={isTransferModalOpen}
        allUsers={allUsers}
        transferTargetId={transferTargetId}
        transferConfirmText={transferConfirmText}
        onTargetChange={setTransferTargetId}
        onConfirmTextChange={setTransferConfirmText}
        onClose={() => setIsTransferModalOpen(false)}
        onConfirm={handleExecuteTransfer}
      />

      <GroupPermissionMatrixModal
        isOpen={isMatrixModalOpen}
        onClose={() => setIsMatrixModalOpen(false)}
        allGroups={allGroups}
        allPermissions={allPermissions}
        currentUser={currentUser}
        operatorCanManageUsers={operatorCanManageUsers}
        onShowAlert={setAlertModal}
        onShowToast={showToast}
        onReloadAuth={reloadAuth}
        onDataChanged={onDataChanged}
      />

      <DeleteToTrashConfirmModal
        user={deleteConfirmUser}
        onCancel={() => setDeleteConfirmUser(null)}
        onConfirm={handleConfirmDelete}
      />

      <AdvanceToArchiveConfirmModal
        user={advanceArchiveConfirmUser}
        onCancel={() => setAdvanceArchiveConfirmUser(null)}
        onConfirm={handleAdvanceArchive}
      />

      <PermanentPurgeConfirmModal
        user={purgeConfirmUser}
        confirmInput={purgeConfirmInput}
        onInputChange={setPurgeConfirmInput}
        onCancel={() => {
          setPurgeConfirmUser(null);
          setPurgeConfirmInput('');
        }}
        onConfirm={handlePermanentPurge}
      />

      <AccountUndoToast
        undoToast={undoToast}
        onUndo={handleUndoRestore}
        onDismiss={() => setUndoToast(null)}
      />
    </div>
  );
};
