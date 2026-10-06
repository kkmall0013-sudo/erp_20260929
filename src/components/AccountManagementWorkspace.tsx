import React, { useState, useMemo, useEffect } from 'react';
import { User, Company, AuditLog, ModuleKey } from '../types/erp';
import {
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Crown,
  KeyRound,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Lock,
  Trash2,
  Edit,
  ArrowRightLeft,
  X,
  Check,
  UserCog,
  FileSpreadsheet,
  RotateCcw,
  Archive,
  Clock,
  Flame,
  Undo2,
  ScrollText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  createUser,
  updateUser,
  deleteUser,
  restoreUser,
  resetUserPassword,
  toggleUserStatus,
  toggleAdminConfigPrivilege,
  toggleAdminPeerPrivilege,
  toggleAdminUserManagerPrivilege,
  transferSuperadmin,
  markUserPendingDelete,
  restorePendingUser,
  advanceUserToArchive,
  superadminRestoreArchivedUser,
  superadminPermanentPurge,
  getAllAuditLogs,
  createGroup,
  updateGroup,
  deleteGroup,
  toggleGroupModulePermission,
  SYSTEM_MODULES
} from '../db/sqlite';

interface AccountManagementWorkspaceProps {
  companies: Company[];
  onDataChanged: () => void;
}

interface DiffItem {
  fieldName: string;
  oldValue: string;
  newValue: string;
}

export const AccountManagementWorkspace: React.FC<AccountManagementWorkspaceProps> = ({
  companies,
  onDataChanged,
}) => {
  const {
    currentUser,
    allUsers,
    allGroups,
    allPermissions,
    isSuperadmin,
    isAdmin,
    switchUser,
    reloadAuth
  } = useAuth();

  // 操作者權限狀態 (專人與同階特許)
  const operatorCanManageUsers = isSuperadmin || Boolean(currentUser?.canManageUsers);
  const operatorCanManageAdmins = isSuperadmin || Boolean(currentUser?.canManageAdmins);

  // 搜尋與篩選狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'SUPERADMIN' | 'ADMIN' | 'USER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
  const [privilegeFilter, setPrivilegeFilter] = useState<'ALL' | 'USER_MGR' | 'SYS_CONFIG' | 'PEER_ADMIN' | 'NONE'>('ALL');

  // 浮動 Toast 提示
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. 最頂層阻擋警示確認視窗 (Top-most Alert Confirm Modal, z-[100])
  const [alertModal, setAlertModal] = useState<{
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  // 2. 編輯帳號正中間對話框 (Centered Modal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // 3. 帳號異動二次確認對話框 (Diff Confirm Modal, z-[70])
  const [diffConfirmInfo, setDiffConfirmInfo] = useState<{
    targetUser: User;
    diffs: DiffItem[];
    payload: any;
  } | null>(null);

  // 4. 密碼重設對話框 (Centered Modal)
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('888888');

  // 5. 最高權限交接對話框 (Centered Modal)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferConfirmText, setTransferConfirmText] = useState('');

  // 6. 12 大模組權限矩陣檢視與互動設定對話框
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [isNewGroupFormOpen, setIsNewGroupFormOpen] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({
    groupCode: '',
    groupName: '',
    description: '',
    approvalLimit: 1000000,
    canExport: true,
  });

  // 7. 階梯式生命週期與資安稽核視圖頁籤 (ACTIVE: 同仁主檔, TRASH: 待刪除回收站, ARCHIVE: 深度封存區, AUDIT_LOGS: Superadmin專屬系統稽核)
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'TRASH' | 'ARCHIVE' | 'AUDIT_LOGS'>('ACTIVE');

  // 8. 系統操作與登入稽核日誌狀態
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditUserFilter, setAuditUserFilter] = useState('ALL');

  // 載入稽核日誌
  const refreshAuditLogs = () => {
    try {
      const logs = getAllAuditLogs(300);
      setAuditLogs(logs);
    } catch (e) {
      console.error('Failed to fetch audit logs', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'AUDIT_LOGS') {
      refreshAuditLogs();
    }
  }, [activeTab]);

  // 9. 刪除同仁防呆確認視窗 (第一階段移入回收站, Centered Modal, z-[80])
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  // 10. 提前送往封存確認對話框 (Centered Modal, z-[80])
  const [advanceArchiveConfirmUser, setAdvanceArchiveConfirmUser] = useState<User | null>(null);

  // 11. Superadmin 永久物理粉碎清除確認對話框 (Centered Modal, z-[80])
  const [purgeConfirmUser, setPurgeConfirmUser] = useState<User | null>(null);
  const [purgeConfirmInput, setPurgeConfirmInput] = useState('');

  // 12. 刪除後一鍵復原 Toast (Undo Restore, 10 秒倒數)
  const [undoToast, setUndoToast] = useState<{
    user: User;
    countdown: number;
  } | null>(null);

  // 復原倒數計時器
  React.useEffect(() => {
    if (!undoToast) return;
    if (undoToast.countdown <= 0) {
      setUndoToast(null);
      return;
    }
    const timer = setTimeout(() => {
      setUndoToast(prev => prev ? { ...prev, countdown: prev.countdown - 1 } : null);
    }, 1000);
    return () => clearTimeout(timer);
  }, [undoToast]);

  // 表單資料狀態 (新增 / 編輯)
  const [formData, setFormData] = useState<{
    id?: string;
    username: string;
    fullName: string;
    email: string;
    title: string;
    role: 'ADMIN' | 'USER';
    canManageUsers: boolean;
    canManageSystemConfigs: boolean;
    canManageAdmins: boolean;
    groupIds: string[];
    allowedCompanies: string[];
    defaultCompanyId: string;
    password?: string;
  }>({
    username: '',
    fullName: '',
    email: '',
    title: '',
    role: 'USER',
    canManageUsers: false,
    canManageSystemConfigs: false,
    canManageAdmins: false,
    groupIds: ['GRP-ENG'],
    allowedCompanies: ['COMP-01'],
    defaultCompanyId: 'COMP-01',
    password: '888888',
  });

  // 取得群組名稱標籤
  const getGroupName = (groupId?: string) => {
    const found = allGroups.find(g => g.id === groupId);
    return found ? found.groupName : groupId;
  };

  // 權限檢查輔助函式：當前操作者是否能管理目標帳號 (置頂警示視窗防護)
  const checkCanManageTarget = (target: User, actionName: string): boolean => {
    // 憲法金身防線：Superadmin 永遠不可被任何其他人員操作
    if (target.role === 'SUPERADMIN' && !isSuperadmin) {
      setAlertModal({
        title: `【憲法金身防護】無法${actionName}最高管理員`,
        message: '系統唯一最高管理員 (Superadmin) 具備不可撼動之金身保護，嚴禁由一般管理員進行編輯、重設密碼、停用或刪除！',
        details: '如需更換最高管理員，必須由現任 Superadmin 發起「最高權限交接程序」。',
      });
      return false;
    }

    // 帳號專人防線：未獲 Superadmin 指定帳號管理權限者，禁止維護同仁或重設他人密碼
    if (!isSuperadmin && !operatorCanManageUsers) {
      setAlertModal({
        title: `【權限不足】無帳號管理專人權限`,
        message: `他人帳號與密碼只能由 Superadmin 特別指定之帳號管理專人 Admin 進行維護！`,
        details: `您目前未具備帳號管理專人授權，無權執行「${actionName}」操作。若有管理需要，請洽詢 Superadmin。`,
      });
      return false;
    }

    // 階層原則：一般 Admin 只能管理下一階 User，除非經 Superadmin 授權同階管理特許 (canManageAdmins)
    if (target.role === 'ADMIN' && target.id !== currentUser?.id && !isSuperadmin && !operatorCanManageAdmins) {
      setAlertModal({
        title: `【階層原則受限】無法${actionName}其他同階管理員`,
        message: `您尚未取得 Superadmin 授予之【同階管理特許 (canManageAdmins)】！`,
        details: `依系統階層防護憲法，一般帳號管理專人 Admin 預設只能管理下一階層（一般同仁 User）。除非由唯一最高 Superadmin 為您開啟「同階管理特許」，否則無法${actionName}其他同階 Admin 帳號。`,
      });
      return false;
    }

    return true;
  };

  // 開啟新增表單 (先檢查帳號專人權限)
  const handleOpenCreate = () => {
    if (!isSuperadmin && !operatorCanManageUsers) {
      setAlertModal({
        title: '【權限不足】無帳號管理專人權限',
        message: '新增系統同仁帳號需由唯一最高 Superadmin 特別指定之專人 Admin 始得操作！',
        details: '您目前未具備帳號管理專人授權，無法新增帳號。',
      });
      return;
    }

    setEditingUser(null);
    setFormData({
      username: '',
      fullName: '',
      email: '',
      title: '',
      role: 'USER',
      canManageUsers: false,
      canManageSystemConfigs: false,
      canManageAdmins: false,
      groupIds: ['GRP-ENG'],
      allowedCompanies: ['COMP-01', 'COMP-02'],
      defaultCompanyId: 'COMP-01',
      password: '888888',
    });
    setIsModalOpen(true);
  };

  // 開啟編輯表單 (先進行權限檢查，無權限時立即觸發置頂警示視窗)
  const handleOpenEdit = (user: User) => {
    if (!checkCanManageTarget(user, '編輯')) return;

    setEditingUser(user);
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
      groupIds: user.groupIds && user.groupIds.length > 0 ? user.groupIds : (user.groupId ? [user.groupId] : []),
      allowedCompanies: user.allowedCompanies && user.allowedCompanies.length > 0 ? user.allowedCompanies : ['COMP-01'],
      defaultCompanyId: user.defaultCompanyId || 'COMP-01',
    });
    setIsModalOpen(true);
  };

  // 表單點擊「儲存」：進行資料驗證與變更 Diff 比對
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.fullName.trim()) {
      setAlertModal({
        title: '欄位檢核失敗',
        message: '同仁登入帳號代碼與真實姓名為必填欄位，請完整輸入！',
      });
      return;
    }

    const operatorRole = isSuperadmin ? 'SUPERADMIN' : 'ADMIN';
    const operatorName = currentUser?.fullName || '系統管理員';

    // 若為新增帳號：直接二次確認
    if (!editingUser) {
      try {
        createUser({
          username: formData.username.trim(),
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          title: formData.title.trim(),
          role: formData.role,
          canManageUsers: isSuperadmin && formData.role === 'ADMIN' ? Boolean(formData.canManageUsers) : false,
          canManageSystemConfigs: isSuperadmin && formData.role === 'ADMIN' ? Boolean(formData.canManageSystemConfigs) : false,
          canManageAdmins: isSuperadmin && formData.role === 'ADMIN' ? Boolean(formData.canManageAdmins) : false,
          groupIds: formData.role === 'USER' ? (formData.groupIds.length > 0 ? formData.groupIds : ['GRP-ENG']) : [],
          allowedCompanies: formData.allowedCompanies,
          defaultCompanyId: formData.defaultCompanyId,
          password: formData.password || '888888',
        }, operatorRole, operatorName, operatorCanManageUsers, operatorCanManageAdmins);

        showToast(`🎉 成功建立新同仁【${formData.fullName}】帳號！`);
        setIsModalOpen(false);
        reloadAuth();
        onDataChanged();
      } catch (err: unknown) {
        setAlertModal({
          title: '建立同仁帳號失敗',
          message: (err as Error).message,
        });
      }
      return;
    }

    // 若為修改既有帳號：進行異動 Diff 比對，產出異動前後清單
    const diffs: DiffItem[] = [];

    if (formData.fullName.trim() !== editingUser.fullName) {
      diffs.push({
        fieldName: '同仁姓名',
        oldValue: editingUser.fullName,
        newValue: formData.fullName.trim()
      });
    }

    if ((formData.title.trim() || '') !== (editingUser.title || '')) {
      diffs.push({
        fieldName: '職務職稱',
        oldValue: editingUser.title || '(無)',
        newValue: formData.title.trim() || '(無)'
      });
    }

    if (formData.email.trim() !== (editingUser.email || '')) {
      diffs.push({
        fieldName: '電子郵件',
        oldValue: editingUser.email || '(無)',
        newValue: formData.email.trim() || '(無)'
      });
    }

    if (editingUser.role !== 'SUPERADMIN' && formData.role !== editingUser.role) {
      diffs.push({
        fieldName: '身分層級角色',
        oldValue: editingUser.role === 'ADMIN' ? '系統管理員 (ADMIN)' : '業務同仁 (USER)',
        newValue: formData.role === 'ADMIN' ? '系統管理員 (ADMIN)' : '業務同仁 (USER)'
      });

      // 當從 ADMIN 降級為 USER 時，清楚標示所有特許歸零
      if (editingUser.role === 'ADMIN' && formData.role === 'USER') {
        if (editingUser.canManageUsers || editingUser.canManageSystemConfigs || editingUser.canManageAdmins) {
          diffs.push({
            fieldName: '管理員進階特許權限',
            oldValue: '原已具備特定管理特許',
            newValue: '降為業務同仁，所有進階特許自動收回並歸零'
          });
        }
      }
    }

    // 只有 Superadmin 且角色維持 ADMIN 時，才進行特許異動比對
    if (isSuperadmin && formData.role === 'ADMIN') {
      if (Boolean(formData.canManageUsers) !== Boolean(editingUser.canManageUsers)) {
        diffs.push({
          fieldName: '帳號管理專人特許 (canManageUsers)',
          oldValue: editingUser.canManageUsers ? '已指定為專人' : '未指定 (選單隱藏)',
          newValue: formData.canManageUsers ? '已指定為專人' : '未指定 (選單隱藏)'
        });
      }

      if (Boolean(formData.canManageSystemConfigs) !== Boolean(editingUser.canManageSystemConfigs)) {
        diffs.push({
          fieldName: '全域核心參數特許 (canManageSystemConfigs)',
          oldValue: editingUser.canManageSystemConfigs ? '已特許授權' : '未授權 (唯讀)',
          newValue: formData.canManageSystemConfigs ? '已特許授權' : '未授權 (唯讀)'
        });
      }

      if (Boolean(formData.canManageAdmins) !== Boolean(editingUser.canManageAdmins)) {
        diffs.push({
          fieldName: '同階 Admin 管理特許 (canManageAdmins)',
          oldValue: editingUser.canManageAdmins ? '已特許授權' : '未授權 (僅管 User)',
          newValue: formData.canManageAdmins ? '已特許授權' : '未授權 (僅管 User)'
        });
      }
    }

    if (formData.role === 'USER') {
      const oldG = (editingUser.groupIds || (editingUser.groupId ? [editingUser.groupId] : [])).sort().join(',');
      const finalG = formData.groupIds.length > 0 ? formData.groupIds : ['GRP-ENG'];
      const newG = [...finalG].sort().join(',');
      if (oldG !== newG) {
        const oldNames = (editingUser.groupIds || (editingUser.groupId ? [editingUser.groupId] : []))
          .map(getGroupName).join('、');
        const newNames = finalG.map(getGroupName).join('、');
        diffs.push({
          fieldName: '指派業務權限群組 (PBAC)',
          oldValue: oldNames || '(無)',
          newValue: newNames || '(無)'
        });
      }
    }

    const oldComps = (editingUser.allowedCompanies || ['COMP-01']).sort().join(',');
    const newComps = [...formData.allowedCompanies].sort().join(',');
    if (oldComps !== newComps) {
      diffs.push({
        fieldName: '授權操作營運法人',
        oldValue: (editingUser.allowedCompanies || ['COMP-01']).join('、'),
        newValue: formData.allowedCompanies.join('、')
      });
    }

    // 若毫無任何變更，跳出置頂警示告知
    if (diffs.length === 0) {
      setAlertModal({
        title: '未偵測到資料異動',
        message: '帳號所有欄位內容皆與目前資料完全相同，無須執行更新。',
      });
      return;
    }

    // 若為 USER 角色，確保至少指派一個業務群組
    const finalGroupIds = formData.role === 'USER'
      ? (formData.groupIds.length > 0 ? formData.groupIds : ['GRP-ENG'])
      : [];

    // 有變更：開啟二次確認視窗，列出明確異動對照表 (非 Superadmin 不帶特許欄位)
    const payload = {
      id: editingUser.id,
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      title: formData.title.trim(),
      role: editingUser.role === 'SUPERADMIN' ? undefined : formData.role,
      canManageUsers: isSuperadmin && formData.role === 'ADMIN' ? formData.canManageUsers : undefined,
      canManageSystemConfigs: isSuperadmin && formData.role === 'ADMIN' ? formData.canManageSystemConfigs : undefined,
      canManageAdmins: isSuperadmin && formData.role === 'ADMIN' ? formData.canManageAdmins : undefined,
      groupIds: finalGroupIds,
      allowedCompanies: formData.allowedCompanies,
      defaultCompanyId: formData.defaultCompanyId,
    };

    setDiffConfirmInfo({
      targetUser: editingUser,
      diffs,
      payload
    });
  };

  // 確定執行二次確認後的異動寫入
  const handleExecuteConfirmedUpdate = () => {
    if (!diffConfirmInfo) return;

    const operatorRole = isSuperadmin ? 'SUPERADMIN' : 'ADMIN';
    const operatorName = currentUser?.fullName || '系統管理員';

    try {
      updateUser(diffConfirmInfo.payload, operatorRole, operatorName, operatorCanManageUsers, operatorCanManageAdmins, currentUser?.id);
      showToast(`✅ 已成功更新同仁【${diffConfirmInfo.targetUser.fullName}】之帳號資料！`);
      setDiffConfirmInfo(null);
      setIsModalOpen(false);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setDiffConfirmInfo(null);
      setAlertModal({
        title: '更新帳號失敗',
        message: (err as Error).message,
      });
    }
  };

  // 快速切換特定 Admin 之帳號管理專人特許 (Superadmin 專用)
  const handleToggleUserManagerPrivilege = (user: User) => {
    if (!isSuperadmin) {
      setAlertModal({
        title: '【憲法金身防護】權限不足',
        message: '唯獨系統最高 Superadmin 才有權限指定或撤銷【帳號管理專人特許】！',
      });
      return;
    }
    if (user.role !== 'ADMIN') return;

    const newPrivilege = !user.canManageUsers;
    try {
      toggleAdminUserManagerPrivilege(user.id, newPrivilege, 'SUPERADMIN', currentUser?.fullName || 'Superadmin');
      showToast(newPrivilege
        ? `🔑 已特許指定【${user.fullName}】為帳號管理專人（開放帳號模組與重設他人密碼）！`
        : `🔒 已收回【${user.fullName}】之帳號管理專人權限（選單完全隱藏）！`
      );
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '專人授權失敗', message: (err as Error).message });
    }
  };

  // 快速切換特定 Admin 之全域參數特許 (Superadmin 專用)
  const handleToggleSysConfigPrivilege = (user: User) => {
    if (!isSuperadmin) {
      setAlertModal({
        title: '【憲法金身防護】權限不足',
        message: '唯獨系統最高 Superadmin 才有權限授予或撤回【全域核心參數特許】！',
      });
      return;
    }
    if (user.role !== 'ADMIN') return;

    const newPrivilege = !user.canManageSystemConfigs;
    try {
      toggleAdminConfigPrivilege(user.id, newPrivilege, 'SUPERADMIN', currentUser?.fullName || 'Superadmin');
      showToast(newPrivilege
        ? `🛡️ 已特許開放【${user.fullName}】修改全域核心參數！`
        : `🔒 已收回【${user.fullName}】之全域核心參數特許權限！`
      );
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '特許授權失敗', message: (err as Error).message });
    }
  };

  // 快速切換特定 Admin 之同階管理特許 (Superadmin 專用)
  const handleTogglePeerAdminPrivilege = (user: User) => {
    if (!isSuperadmin) {
      setAlertModal({
        title: '【憲法金身防護】權限不足',
        message: '唯獨系統最高 Superadmin 才有權限授予或撤回【同階 Admin 管理特許】！',
      });
      return;
    }
    if (user.role !== 'ADMIN') return;

    const newPrivilege = !user.canManageAdmins;
    try {
      toggleAdminPeerPrivilege(user.id, newPrivilege, 'SUPERADMIN', currentUser?.fullName || 'Superadmin');
      showToast(newPrivilege
        ? `👑 已特許授權【${user.fullName}】可管理同階 Admin 帳號！`
        : `🔒 已收回【${user.fullName}】之同階 Admin 管理特許！`
      );
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '同階特許授權失敗', message: (err as Error).message });
    }
  };

  // 切換啟用 / 停用 (先檢查權限)
  const handleToggleStatus = (user: User) => {
    // 嚴禁停用當前登入之自身帳號（自殺式停權防呆防護）
    if (user.id === currentUser?.id) {
      setAlertModal({
        title: '【安全防呆】禁止停用自身帳號',
        message: '系統安全機制嚴禁將當前正在登入操作的使用者帳號設為停用！若需停用此帳號，請由其他具備權限之專人管理員或 Superadmin 進行此操作。',
      });
      return;
    }

    if (!checkCanManageTarget(user, user.status === 'ACTIVE' ? '停用' : '啟用')) return;

    const operatorRole = isSuperadmin ? 'SUPERADMIN' : 'ADMIN';
    const operatorName = currentUser?.fullName || '管理員';
    const nextStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';

    try {
      toggleUserStatus(user.id, nextStatus, operatorRole, operatorName, operatorCanManageUsers, operatorCanManageAdmins, currentUser?.id);
      showToast(nextStatus === 'ACTIVE'
        ? `✅ 已重新啟用同仁【${user.fullName}】帳號！`
        : `⏸️ 已停用同仁【${user.fullName}】帳號！`
      );
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '狀態切換失敗', message: (err as Error).message });
    }
  };

  // 點擊「重設密碼」按鈕 (先檢查權限)
  const handleOpenResetPassword = (user: User) => {
    if (!checkCanManageTarget(user, '重設密碼')) return;
    setResetModalUser(user);
    setNewPasswordInput('888888');
  };

  // 確定執行重設密碼
  const handleConfirmResetPassword = () => {
    if (!resetModalUser) return;
    if (!newPasswordInput.trim()) {
      setAlertModal({ title: '輸入錯誤', message: '請輸入有效的重設密碼！' });
      return;
    }

    const operatorRole = isSuperadmin ? 'SUPERADMIN' : 'ADMIN';
    const operatorName = currentUser?.fullName || '管理員';

    try {
      resetUserPassword(resetModalUser.id, newPasswordInput.trim(), operatorRole, operatorName, operatorCanManageUsers, operatorCanManageAdmins);
      showToast(`🔑 已成功重設【${resetModalUser.fullName}】密碼為：${newPasswordInput.trim()}！`);
      setResetModalUser(null);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '重設密碼失敗', message: (err as Error).message });
    }
  };

  // 點擊「刪除帳號」按鈕 (先檢查權限，通過後開啟置中防呆確認視窗)
  const handleDeleteUser = (user: User) => {
    if (!checkCanManageTarget(user, '刪除')) return;

    if (user.id === currentUser?.id) {
      setAlertModal({
        title: '無法刪除帳號',
        message: '無法刪除當前正在登入操作的使用者帳號！',
      });
      return;
    }

    // 開啟置中防呆確認視窗 (完全替換 iframe 中失效的 window.confirm)
    setDeleteConfirmUser(user);
  };

  // 第一階段確認刪除 (移入待刪除回收站，享有 7 天冷卻期)
  const handleConfirmDelete = () => {
    if (!deleteConfirmUser) return;

    const userToDelete = deleteConfirmUser;
    const operatorRole = isSuperadmin ? 'SUPERADMIN' : 'ADMIN';
    const operatorName = currentUser?.fullName || '管理員';

    try {
      markUserPendingDelete(userToDelete.id, operatorRole, operatorName, operatorCanManageUsers, operatorCanManageAdmins);
      setDeleteConfirmUser(null);

      // 啟動 10 秒倒數一鍵復原機制
      setUndoToast({
        user: userToDelete,
        countdown: 10
      });

      showToast(`🗑️ 同仁【${userToDelete.fullName}】已移入「待刪除回收站」，具備 7 天冷卻保護期！`);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setDeleteConfirmUser(null);
      setAlertModal({ title: '移入回收站失敗', message: (err as Error).message });
    }
  };

  // 待刪除回收站：一鍵復原回啟用主檔 (Admin 與 Superadmin 均可，但須遵守同階防呆)
  const handleRestorePending = (user: User) => {
    if (!checkCanManageTarget(user, '復原')) return;
    const operatorName = currentUser?.fullName || '管理員';
    try {
      restorePendingUser(user.id, operatorName);
      showToast(`↩️ 已成功復原同仁【${user.fullName}】帳號回主檔！`);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '復原失敗', message: (err as Error).message });
    }
  };

  // 待刪除回收站：手動提前二次刪除送往 Superadmin 深度封存區
  const handleAdvanceArchive = () => {
    if (!advanceArchiveConfirmUser) return;
    const userToAdvance = advanceArchiveConfirmUser;
    const operatorRole = isSuperadmin ? 'SUPERADMIN' : 'ADMIN';
    const operatorName = currentUser?.fullName || '管理員';

    try {
      advanceUserToArchive(userToAdvance.id, operatorRole, operatorName, operatorCanManageUsers, operatorCanManageAdmins);
      setAdvanceArchiveConfirmUser(null);
      showToast(`📦 同仁【${userToAdvance.fullName}】已提前移交 Superadmin 深度封存區！一般管理員視角已隱藏。`);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAdvanceArchiveConfirmUser(null);
      setAlertModal({ title: '移交封存失敗', message: (err as Error).message });
    }
  };

  // 深度封存區：Superadmin 終極救回復原 (僅限 Superadmin)
  const handleSuperadminRestore = (user: User) => {
    const operatorName = currentUser?.fullName || '管理員';
    try {
      superadminRestoreArchivedUser(user.id, operatorName);
      showToast(`👑 Superadmin 終極救援成功！同仁【${user.fullName}】已無損恢復至啟用主檔。`);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '救援失敗', message: (err as Error).message });
    }
  };

  // 深度封存區：Superadmin 永久物理粉碎清除 (物理 DELETE)
  const handlePermanentPurge = () => {
    if (!purgeConfirmUser) return;
    const userToPurge = purgeConfirmUser;
    const operatorName = currentUser?.fullName || '管理員';

    try {
      superadminPermanentPurge(userToPurge.id, operatorName, purgeConfirmInput);
      setPurgeConfirmUser(null);
      setPurgeConfirmInput('');
      showToast(`🔥 已從資料庫中徹底永久清除同仁【${userToPurge.fullName}】帳號！歷史單據仍純淨維持純文字姓名快照。`);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '物理清除失敗', message: (err as Error).message });
    }
  };

  // 點擊一鍵復原 Toast
  const handleUndoRestore = () => {
    if (!undoToast) return;
    const userToRestore = undoToast.user;
    const operatorName = currentUser?.fullName || '管理員';

    try {
      restorePendingUser(userToRestore.id, operatorName);
      setUndoToast(null);
      showToast(`✅ 已成功一鍵復原同仁【${userToRestore.fullName}】帳號！`);
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '復原失敗', message: (err as Error).message });
    }
  };

  // 執行最高權限交接
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
      showToast(`👑 最高管理權限已成功移轉給【${target.fullName}】！您目前已轉換為系統管理員 (Admin)。`);
      setIsTransferModalOpen(false);
      setTransferTargetId('');
      setTransferConfirmText('');
      reloadAuth();
      onDataChanged();
    } catch (err: unknown) {
      setAlertModal({ title: '交接失敗', message: (err as Error).message });
    }
  };

  // 快速模擬切換身分
  const handleQuickSimulate = (user: User) => {
    switchUser(user.id);
    showToast(`⚡ 已即時模擬登入為【${user.fullName} (${user.role})】，全系統權限已即刻連動！`);
  };

  // 階梯式生命週期使用者分群
  const activeUsers = useMemo(() => {
    return allUsers.filter(u => !u.deleteStage || u.deleteStage === 'ACTIVE');
  }, [allUsers]);

  const trashUsers = useMemo(() => {
    return allUsers.filter(u => u.deleteStage === 'PENDING_DELETE');
  }, [allUsers]);

  const archivedUsers = useMemo(() => {
    return allUsers.filter(u => u.deleteStage === 'ARCHIVED');
  }, [allUsers]);

  // 資料統計 (以在職主檔同仁為基準)
  const superadminUser = activeUsers.find(u => u.role === 'SUPERADMIN');
  const adminUsers = activeUsers.filter(u => u.role === 'ADMIN');
  const userManagerAdmins = adminUsers.filter(u => u.canManageUsers);
  const configAdmins = adminUsers.filter(u => u.canManageSystemConfigs);
  const peerAdmins = adminUsers.filter(u => u.canManageAdmins);
  const regularUsers = activeUsers.filter(u => u.role === 'USER');

  // 篩選後的主檔使用者列表
  const filteredUsers = useMemo(() => {
    return activeUsers.filter(u => {
      // 關鍵字
      if (searchTerm.trim()) {
        const t = searchTerm.toLowerCase();
        const matchName = u.fullName.toLowerCase().includes(t);
        const matchUsername = u.username.toLowerCase().includes(t);
        const matchEmail = (u.email || '').toLowerCase().includes(t);
        const matchTitle = (u.title || '').toLowerCase().includes(t);
        if (!matchName && !matchUsername && !matchEmail && !matchTitle) return false;
      }

      // 角色
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;

      // 狀態
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;

      // 特許
      if (privilegeFilter === 'USER_MGR' && !u.canManageUsers) return false;
      if (privilegeFilter === 'SYS_CONFIG' && !u.canManageSystemConfigs) return false;
      if (privilegeFilter === 'PEER_ADMIN' && !u.canManageAdmins) return false;
      if (privilegeFilter === 'NONE' && (u.canManageUsers || u.canManageSystemConfigs || u.canManageAdmins)) return false;

      return true;
    });
  }, [activeUsers, searchTerm, roleFilter, statusFilter, privilegeFilter]);

  // 審計日誌純中文轉譯輔助函式（確保完全不顯示英文代號或系統代碼）
  const translateAuditAction = (action: string): string => {
    const map: Record<string, string> = {
      LOGIN: '登入系統',
      SWITCH_USER: '切換身分登入',
      CREATE: '新增資料',
      UPDATE: '修改資料',
      DELETE: '刪除資料',
      POST: '單據過帳',
      VOID: '單據作廢',
      PASSWORD_RESET: '重設密碼',
      SELF_PASSWORD_CHANGE: '修改個人密碼',
      STAGE_PENDING_DELETE: '移入回收站',
      STAGE_ARCHIVE: '移入封存區',
      AUTO_ARCHIVE: '自動封存',
      RESTORE_USER: '復原帳號',
      SUPERADMIN_RESTORE: '終極救回帳號',
      PERMANENT_PURGE: '永久物理清除',
      TRANSFER_SUPERADMIN: '最高權限交接',
    };
    return map[action] || action;
  };

  const translateAuditTable = (table: string): string => {
    const map: Record<string, string> = {
      users: '同仁帳號',
      user_groups: '權限群組',
      group_module_permissions: '模組權限矩陣',
      companies: '集團與公司設定',
      purchase_orders: '採購單',
      valuations: '估驗計價單',
      quotations: '報價單',
      projects: '專案工程',
      subcontracts: '發包合約',
      system_configs: '系統參數',
    };
    return map[table] || table;
  };

  const translateAuditTarget = (targetId: string): string => {
    if (!targetId) return '';
    // 移除括號內英文代號如 (PO-01)、(VAL-01)
    const cleaned = targetId.replace(/\s*\([A-Za-z0-9_-]+\)/g, '').trim();
    const matchedUser = allUsers.find(u => u.id === cleaned || u.username === cleaned);
    if (matchedUser) return matchedUser.fullName;
    const matchedGroup = allGroups.find(g => g.id === cleaned || g.groupCode === cleaned);
    if (matchedGroup) return matchedGroup.groupName;
    const matchedComp = companies.find(c => c.id === cleaned || c.companyCode === cleaned);
    if (matchedComp) return matchedComp.shortName || matchedComp.name;
    return cleaned;
  };

  const translateAuditKey = (key: string): string => {
    const map: Record<string, string> = {
      username: '登入帳號',
      fullName: '同仁姓名',
      role: '權限角色',
      status: '帳號狀態',
      title: '職務職稱',
      email: '電子信箱',
      groupId: '所屬業務群組',
      groupIds: '所屬業務群組',
      allowedCompanies: '授權營運法人',
      defaultCompanyId: '預設登入法人',
      canManageUsers: '帳號管理專人特許',
      canManageSystemConfigs: '全域核心參數特許',
      canManageAdmins: '同階管理員維護特許',
      event: '事件說明',
      device: '登入設備',
      vendor: '供應商名稱',
      netPayable: '實付淨額',
      deleteStage: '帳號狀態',
      reason: '操作原因',
    };
    return map[key] || key;
  };

  const translateAuditValue = (val: unknown): string => {
    if (val === null || val === undefined) return '無';
    if (typeof val === 'boolean') return val ? '開啟' : '關閉';
    if (Array.isArray(val)) {
      if (val.length === 0) return '無';
      return val.map(item => translateAuditValue(item)).join('、');
    }
    const str = String(val);
    const valMap: Record<string, string> = {
      SUPERADMIN: '最高管理者',
      ADMIN: '系統管理員',
      USER: '一般同仁',
      ACTIVE: '啟用中',
      DISABLED: '已停用',
      PENDING_DELETE: '待刪除回收站',
      ARCHIVED: '深度封存區',
      POSTED: '已過帳',
      APPROVED: '已核准',
      SUBMITTED: '已送審',
      DRAFT: '草稿',
      true: '開啟',
      false: '關閉',
      'GRP-ENG': '工務組',
      'GRP-ACC': '財務會計組',
      'GRP-PROC': '採購發包組',
      'GRP-SALES': '專案業務組',
      'GRP-01': '大巨集團',
      'COMP-01': '大巨營造',
      'COMP-02': '宏達機電',
      'BOSS-01': '林董私帳',
    };
    if (valMap[str]) return valMap[str];
    const matchedUser = allUsers.find(u => u.id === str);
    if (matchedUser) return matchedUser.fullName;
    const matchedGroup = allGroups.find(g => g.id === str);
    if (matchedGroup) return matchedGroup.groupName;
    const matchedComp = companies.find(c => c.id === str);
    if (matchedComp) return matchedComp.shortName || matchedComp.name;
    return str;
  };

  // 篩選後的稽核日誌列表
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const actionCn = translateAuditAction(log.action);
      const tableCn = translateAuditTable(log.targetTable);
      const targetCn = translateAuditTarget(log.targetId);

      // 關鍵字搜尋
      if (auditSearchTerm.trim()) {
        const t = auditSearchTerm.toLowerCase();
        const matchUser = log.userName.toLowerCase().includes(t) || log.userId.toLowerCase().includes(t);
        const matchTable = tableCn.toLowerCase().includes(t) || log.targetTable.toLowerCase().includes(t);
        const matchId = targetCn.toLowerCase().includes(t) || log.targetId.toLowerCase().includes(t);
        const matchAction = actionCn.toLowerCase().includes(t) || log.action.toLowerCase().includes(t);
        const matchAfter = (log.afterJson || '').toLowerCase().includes(t);
        const matchBefore = (log.beforeJson || '').toLowerCase().includes(t);
        if (!matchUser && !matchTable && !matchId && !matchAction && !matchAfter && !matchBefore) return false;
      }

      // 動作類型篩選 (同時相容中文與舊版代號)
      if (auditActionFilter !== 'ALL') {
        if (auditActionFilter === 'LOGIN' && !actionCn.includes('登入') && !log.action.includes('LOGIN')) return false;
        if (auditActionFilter === 'CREATE' && !actionCn.includes('新增') && log.action !== 'CREATE') return false;
        if (
          auditActionFilter === 'UPDATE' &&
          !actionCn.includes('修改') &&
          !actionCn.includes('過帳') &&
          !actionCn.includes('復原') &&
          !actionCn.includes('救回') &&
          !actionCn.includes('交接') &&
          !log.action.includes('UPDATE') &&
          !log.action.includes('POST') &&
          !log.action.includes('RESTORE')
        ) {
          return false;
        }
        if (
          auditActionFilter === 'DELETE' &&
          !actionCn.includes('刪除') &&
          !actionCn.includes('回收') &&
          !actionCn.includes('封存') &&
          !actionCn.includes('清除') &&
          !log.action.includes('DELETE') &&
          !log.action.includes('PURGE') &&
          !log.action.includes('STAGE')
        ) {
          return false;
        }
        if (auditActionFilter === 'PASSWORD' && !actionCn.includes('密碼') && !log.action.includes('PASSWORD')) return false;
      }

      // 操作人員篩選
      if (auditUserFilter !== 'ALL') {
        if (log.userName !== auditUserFilter && log.userId !== auditUserFilter) return false;
      }

      return true;
    });
  }, [auditLogs, auditSearchTerm, auditActionFilter, auditUserFilter, allUsers, allGroups, companies]);

  return (
    <div className="space-y-6">
      {/* 浮動提示 Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-2xl text-xs font-semibold z-40 animate-in fade-in flex items-center gap-2 border border-slate-700">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 0. 最前端阻擋警示確認視窗 (Top-most Alert Confirm Modal)    */}
      {/*    層級 z-[100]，必須點擊確認按鈕方可關閉，確保訊息不漏接  */}
      {/* ======================================================== */}
      {alertModal && (
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
                onClick={() => setAlertModal(null)}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>確認瞭解</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 視圖切換頁籤：同仁主檔 / 待刪除回收站 (7日冷卻) / 帳號封存與終極清理 */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          {/* 頁籤 1: 同仁主檔 */}
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ACTIVE'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>同仁主檔</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'ACTIVE' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {activeUsers.length}
            </span>
          </button>

          {/* 頁籤 2: 待刪除回收站 (7日冷卻期) */}
          <button
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
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'TRASH' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {trashUsers.length}
              </span>
            )}
          </button>

          {/* 頁籤 3: 帳號封存與終極清理 (僅 Superadmin 可見) */}
          {isSuperadmin && (
            <button
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
                Superadmin
              </span>
              {archivedUsers.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === 'ARCHIVE' ? 'bg-purple-800 text-white' : 'bg-purple-100 text-purple-800'
                }`}>
                  {archivedUsers.length}
                </span>
              )}
            </button>
          )}

          {/* 頁籤 4: 系統操作與登入稽核日誌 (僅 Superadmin 可見) */}
          {isSuperadmin && (
            <button
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
                特權日誌
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
          {/* ======================================================== */}
          {/* 1. 三層式帳號狀態看板 (Overview KPI Cards - 僅 Superadmin 可見) */}
          {/* ======================================================== */}
          {isSuperadmin && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 卡片 1: Superadmin 最高管理員 */}
              <div className="bg-white rounded-xl border border-amber-200 p-4.5 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold shadow-2xs">
                <Crown className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">唯一最高管理者</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    SUPERADMIN (1 位)
                  </span>
                </div>
                <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                  {superadminUser ? superadminUser.fullName : '尚未指定'}
                </div>
              </div>
            </div>

            {isSuperadmin && (
              <button
                onClick={() => {
                  setTransferTargetId('');
                  setTransferConfirmText('');
                  setIsTransferModalOpen(true);
                }}
                className="px-2.5 py-1 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 transition-colors flex items-center gap-1 shadow-2xs"
                title="現任 Superadmin 發起最高權限安全讓渡"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>權限交接</span>
              </button>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>憲法金身防護：不可停用、不可刪除</span>
            <span className="font-mono text-amber-700 font-semibold">擁有全域授權權力</span>
          </div>
        </div>

        {/* 卡片 2: Admin 系統管理員組 */}
        <div className="bg-white rounded-xl border border-indigo-200 p-4.5 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600" />
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold shadow-2xs">
                <Shield className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">系統管理員組</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                    ADMIN ({adminUsers.length} 位)
                  </span>
                </div>
                <div className="text-xs font-medium text-slate-600 mt-1 flex flex-wrap gap-1.5">
                  <span className="bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded border border-amber-200">
                    帳號專人: {userManagerAdmins.length} 位
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                    全域核心特許: {configAdmins.length} 位
                  </span>
                  <span className="bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
                    同階管理特許: {peerAdmins.length} 位
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>階層原則：預設僅能管理下一階 User</span>
            <span className="text-indigo-600 font-medium">特許 Admin 可管同階</span>
          </div>
        </div>

        {/* 卡片 3: User 業務群組同仁 */}
        <div className="bg-white rounded-xl border border-emerald-200 p-4.5 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold shadow-2xs">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">業務群組同仁</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    USER ({regularUsers.length} 位)
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1 font-medium flex flex-wrap gap-1">
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">工務: {allUsers.filter(u => u.groupIds?.includes('GRP-ENG') || u.groupId === 'GRP-ENG').length}</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">財務: {allUsers.filter(u => u.groupIds?.includes('GRP-ACC') || u.groupId === 'GRP-ACC').length}</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">採購: {allUsers.filter(u => u.groupIds?.includes('GRP-PROC') || u.groupId === 'GRP-PROC').length}</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">業務: {allUsers.filter(u => u.groupIds?.includes('GRP-SALES') || u.groupId === 'GRP-SALES').length}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>依所屬業務群組 PBAC 矩陣授權</span>
            <button
              onClick={() => setIsMatrixModalOpen(true)}
              className="text-emerald-700 font-semibold hover:underline flex items-center gap-0.5"
            >
              <span>查看 12 大模組矩陣</span>
              <FileSpreadsheet className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    )}

      {/* ======================================================== */}
      {/* 2. 搜尋、篩選與快速工具列                                  */}
      {/* ======================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* 搜尋框 */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋帳號、同仁姓名、職稱或 Email..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          {/* 右側按鈕組 */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <button
              onClick={() => setIsMatrixModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
              <span>群組權限矩陣</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs"
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
          {(['ALL', 'SUPERADMIN', 'ADMIN', 'USER'] as const).map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                roleFilter === role
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {role === 'ALL' ? '全部身分' : role}
            </button>
          ))}

          <span className="text-slate-300 mx-1">|</span>

          <span className="text-slate-400 text-[11px] font-medium">狀態：</span>
          {(['ALL', 'ACTIVE', 'DISABLED'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
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
              onClick={() => setPrivilegeFilter(p)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                privilegeFilter === p
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p === 'ALL' ? '全部' : p === 'USER_MGR' ? '帳號管理專人' : p === 'SYS_CONFIG' ? '核心參數特許' : p === 'PEER_ADMIN' ? '同階管理特許' : '無特許'}
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. 使用者帳號主檔表格 (Dense Data Grid)                    */}
      {/* ======================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800">
              系統操作人員主檔清單
            </span>
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
                filteredUsers.map((user) => {
                  const isCurrent = user.id === currentUser?.id;
                  const isUserSuperadmin = user.role === 'SUPERADMIN';
                  const isUserAdmin = user.role === 'ADMIN';

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCurrent ? 'bg-indigo-50/30 font-medium' : ''
                      }`}
                    >
                      {/* 帳號與姓名 */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isUserSuperadmin
                                ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                                : isUserAdmin
                                ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {user.fullName ? user.fullName.slice(0, 1) : '帳'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <span>{user.fullName}</span>
                              {isCurrent && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-normal">
                                  目前登入者
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 職稱 */}
                      <td className="py-2.5 px-3 text-slate-600">
                        {user.title || <span className="text-slate-300">-</span>}
                      </td>

                      {/* 角色身分 Badge */}
                      <td className="py-2.5 px-3">
                        {isUserSuperadmin ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                            <Crown className="w-3 h-3 text-amber-600" />
                            <span>SUPERADMIN</span>
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

                      {/* 特許授權項目 (帳號專人 + 全域核心參數 + 同階管理) */}
                      <td className="py-2.5 px-3 text-center">
                        {isUserSuperadmin ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <ShieldCheck className="w-3 h-3 text-amber-600" />
                            <span>全域最高權杖</span>
                          </span>
                        ) : isUserAdmin ? (
                          <div className="flex flex-col items-center gap-1">
                            {/* 帳號管理專人特許按鈕/標籤 */}
                            {isSuperadmin ? (
                              <button
                                onClick={() => handleToggleUserManagerPrivilege(user)}
                                title="Superadmin 點選指定/收回帳號管理專人權限 (指定後左側選單可見帳號模組)"
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
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                user.canManageUsers
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}>
                                帳號專人: {user.canManageUsers ? '已指定' : '未授權'}
                              </span>
                            )}

                            {/* 全域參數特許按鈕/標籤 */}
                            {isSuperadmin ? (
                              <button
                                onClick={() => handleToggleSysConfigPrivilege(user)}
                                title="Superadmin 點選切換全域核心參數特許"
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
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                user.canManageSystemConfigs
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}>
                                核心參數: {user.canManageSystemConfigs ? '已特許' : '未授權'}
                              </span>
                            )}

                            {/* 同階管理特許按鈕/標籤 */}
                            {isSuperadmin ? (
                              <button
                                onClick={() => handleTogglePeerAdminPrivilege(user)}
                                title="Superadmin 點選切換同階 Admin 管理特許"
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
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                user.canManageAdmins
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}>
                                同階管理: {user.canManageAdmins ? '已特許' : '未授權'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* 所屬業務群組 */}
                      <td className="py-2.5 px-3">
                        {user.role === 'USER' ? (
                          <div className="flex flex-wrap gap-1">
                            {(user.groupIds && user.groupIds.length > 0
                              ? user.groupIds
                              : (user.groupId ? [user.groupId] : [])
                            ).map(gId => (
                              <span
                                key={gId}
                                className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200"
                              >
                                {getGroupName(gId)}
                              </span>
                            ))}
                          </div>
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
                          onClick={() => handleToggleStatus(user)}
                          title={user.id === currentUser?.id ? '當前登入之帳號，系統禁止將自己停用' : '點選切換啟用/停用'}
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded transition-colors ${
                            user.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                          } ${user.id === currentUser?.id ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span>{user.status === 'ACTIVE' ? '啟用中' : '已停用'}</span>
                          {user.id === currentUser?.id && (
                            <span className="text-[9px] text-slate-400 font-normal ml-0.5">(本人)</span>
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
                          {/* 模擬登入切換 */}
                          <button
                            onClick={() => handleQuickSimulate(user)}
                            title={`切換身分模擬登入為【${user.fullName}】`}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-indigo-600 hover:text-white text-indigo-700 font-semibold text-[11px] transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>模擬</span>
                          </button>

                          {/* 編輯 */}
                          <button
                            onClick={() => handleOpenEdit(user)}
                            title="編輯帳號資料"
                            className="p-1 rounded text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* 重設密碼 */}
                          <button
                            onClick={() => handleOpenResetPassword(user)}
                            title="重設密碼"
                            className="p-1 rounded text-slate-600 hover:text-amber-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* 刪除 (Superadmin 免受刪除) */}
                          {!isUserSuperadmin && (
                            <button
                              onClick={() => handleDeleteUser(user)}
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
  )}

  {/* ======================================================== */}
  {/* 視圖 2: 待刪除回收站 (7日冷卻期獨立頁面)                    */}
  {/* ======================================================== */}
  {activeTab === 'TRASH' && (
    <div className="space-y-4">
      {/* 回收站說明 Banner */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="font-bold text-amber-900">
            待刪除回收站（7日冷卻保護期）
          </div>
          <p className="text-amber-800 leading-relaxed text-[11px]">
            遭刪除之同仁帳號將在此保留 7 天，期間其系統登入權限自動停用。管理人員可於冷卻期內隨時點選「一鍵復原」無損救回主檔；亦可手動「提前送往封存」。若 7 天冷卻期屆滿，系統將自動移交至 Superadmin 深度封存區。
          </p>
        </div>
      </div>

      {/* 回收站表格 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-3.5">待刪同仁姓名 / 帳號</th>
                <th className="py-3 px-3">原職務職稱</th>
                <th className="py-3 px-3">原身分層級</th>
                <th className="py-3 px-3">刪除經辦人</th>
                <th className="py-3 px-3">移入冷卻時間</th>
                <th className="py-3 px-3">剩餘冷卻期</th>
                <th className="py-3 px-3">刪除事由 / 備註</th>
                <th className="py-3 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trashUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                    <div>目前回收站內無任何待刪除帳號，所有人員主檔運作正常</div>
                  </td>
                </tr>
              ) : (
                trashUsers.map(user => {
                  const due = user.purgeDueAt ? new Date(user.purgeDueAt).getTime() : 0;
                  const remainingMs = due - Date.now();
                  const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
                  const remainingHours = Math.max(0, Math.ceil((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

                  return (
                    <tr key={user.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-800">{user.fullName}</div>
                        <div className="font-mono text-[11px] text-indigo-600">@{user.username}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {user.title || '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          user.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {user.role === 'ADMIN' ? '系統管理員 (ADMIN)' : '業務同仁 (USER)'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {user.deletedBy || '管理員'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                        {user.stageDeletedAt ? new Date(user.stageDeletedAt).toLocaleString() : '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          剩餘 {remainingDays} 天 {remainingHours} 小時
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">
                        {user.stageNotes || '正常待刪移轉'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleRestorePending(user)}
                            className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer border border-emerald-200"
                            title="一鍵復原回啟用同仁主檔"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>一鍵復原</span>
                          </button>
                          <button
                            onClick={() => setAdvanceArchiveConfirmUser(user)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-600 font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer border border-slate-300"
                            title="提前送往 Superadmin 深度封存區"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>提前送往封存</span>
                          </button>
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
    </div>
  )}

  {/* ======================================================== */}
  {/* 視圖 3: 帳號封存與終極清理 (Superadmin 專屬救援與粉碎清理) */}
  {/* ======================================================== */}
  {activeTab === 'ARCHIVE' && isSuperadmin && (
    <div className="space-y-4">
      {/* 封存區說明 Banner */}
      <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
        <Archive className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="font-bold text-purple-950 flex items-center gap-1.5">
            <span>帳號深度封存區（Superadmin 專屬救援與終極清理）</span>
            <span className="text-[10px] bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded font-mono">最高權限</span>
          </div>
          <p className="text-purple-900 leading-relaxed text-[11px]">
            此處收容冷卻期屆滿（滿7天）或經提前二次刪除之同仁帳號。一般 Admin 視角已徹底隱藏且無權存取。最高 Superadmin 可在此進行「終極救回復原」，或於必要時輸入安全驗證詞執行「不可逆之資料庫物理實體粉碎清除」。歷史單據將純淨保留其姓名純文字快照，永不留白。
          </p>
        </div>
      </div>

      {/* 封存表格 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-3.5">已封存同仁姓名 / 帳號</th>
                <th className="py-3 px-3">原職稱</th>
                <th className="py-3 px-3">原身分層級</th>
                <th className="py-3 px-3">移交封存時間</th>
                <th className="py-3 px-3">移交經辦人</th>
                <th className="py-3 px-3">封存說明</th>
                <th className="py-3 px-3 text-right">Superadmin 終極操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {archivedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Archive className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-60" />
                    <div>目前封存區內無任何待清理同仁帳號</div>
                  </td>
                </tr>
              ) : (
                archivedUsers.map(user => (
                  <tr key={user.id} className="hover:bg-purple-50/20 transition-colors">
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-800">{user.fullName}</div>
                      <div className="font-mono text-[11px] text-indigo-600">@{user.username}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {user.title || '-'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {user.role === 'ADMIN' ? '管理員 (ADMIN)' : '一般同仁 (USER)'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      {user.stageDeletedAt ? new Date(user.stageDeletedAt).toLocaleString() : '-'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {user.deletedBy || '系統排程'}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">
                      {user.stageNotes || '7日冷卻期滿自動封存'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleSuperadminRestore(user)}
                          className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-500 hover:text-slate-950 text-amber-800 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer border border-amber-300"
                          title="Superadmin 終極救回復原"
                        >
                          <Crown className="w-3.5 h-3.5 text-amber-600" />
                          <span>終極救回</span>
                        </button>
                        <button
                          onClick={() => {
                            setPurgeConfirmUser(user);
                            setPurgeConfirmInput('');
                          }}
                          className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer border border-rose-200"
                          title="從資料庫中物理永久清除 (不可逆)"
                        >
                          <Flame className="w-3.5 h-3.5 text-rose-600" />
                          <span>物理粉碎</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

  {/* ======================================================== */}
  {/* 視圖 4: 系統操作與登入稽核日誌 (Superadmin 專屬資安追蹤功能)   */}
  {/* ======================================================== */}
  {activeTab === 'AUDIT_LOGS' && isSuperadmin && (
    <div className="space-y-4">
      {/* 稽核日誌說明 Banner */}
      <div className="bg-slate-900 text-slate-200 border border-slate-700 rounded-xl p-4 flex items-start justify-between gap-3 shadow-sm">
        <div className="flex items-start gap-3">
          <ScrollText className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-bold text-white flex items-center gap-2">
              <span>全域系統安全與操作稽核日誌（最高管理者專屬追蹤）</span>
              <span className="text-[10px] bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700">
                唯讀防竄改・純中文差異紀錄
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              系統自動以純中文記錄所有關鍵操作軌跡，不顯示系統代號；針對資料修改事件，僅精準記錄「有實際修改的項目（修改前 ➔ 修改後）」，一目了然掌握何人、何時、修改了哪個具體項目。
            </p>
          </div>
        </div>
        <button
          onClick={refreshAuditLogs}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-600 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          title="重新整理最新日誌"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>重新整理</span>
        </button>
      </div>

      {/* 稽核日誌篩選工具列 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 text-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* 搜尋框 */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={auditSearchTerm}
              onChange={(e) => setAuditSearchTerm(e.target.value)}
              placeholder="搜尋操作人員、異動對象或修改內容關鍵字..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 動作類型過濾 */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-medium">操作動作：</span>
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">全部操作類型</option>
                <option value="LOGIN">登入系統與切換身分</option>
                <option value="CREATE">新增建立資料</option>
                <option value="UPDATE">修改資料與單據過帳</option>
                <option value="DELETE">刪除、回收與封存</option>
                <option value="PASSWORD">密碼重設與變更</option>
              </select>
            </div>

            {/* 操作人員過濾 */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-medium">操作人員：</span>
              <select
                value={auditUserFilter}
                onChange={(e) => setAuditUserFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">全部同仁</option>
                {allUsers.map(u => {
                  const roleLabel = u.role === 'SUPERADMIN' ? '最高管理者' : u.role === 'ADMIN' ? '系統管理員' : '一般同仁';
                  return (
                    <option key={u.id} value={u.fullName}>
                      {u.fullName}（{roleLabel}）
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* 筆數統計 */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
          <span>
            共檢索出 <strong className="text-slate-900 font-bold">{filteredAuditLogs.length}</strong> 筆操作紀錄（最新時間優先排序）
          </span>
          <span className="text-emerald-700 font-medium">僅記錄實際修改差異項目・全中文直觀呈現</span>
        </div>
      </div>

      {/* 稽核日誌表格 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-3.5 whitespace-nowrap">紀錄時間</th>
                <th className="py-3 px-3 whitespace-nowrap">操作人員</th>
                <th className="py-3 px-3 whitespace-nowrap text-center">操作動作</th>
                <th className="py-3 px-3 whitespace-nowrap">異動項目與對象</th>
                <th className="py-3 px-3">修改內容明細（僅記錄實際異動部分）</th>
                <th className="py-3 px-3 whitespace-nowrap text-right">操作來源</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAuditLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <ScrollText className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-60" />
                    <div>查無符合條件的操作稽核紀錄</div>
                  </td>
                </tr>
              ) : (
                filteredAuditLogs.map(log => {
                  const actionCn = translateAuditAction(log.action);
                  const tableCn = translateAuditTable(log.targetTable);
                  const targetCn = translateAuditTarget(log.targetId);

                  // 事件動作樣式對應
                  const isLogin = actionCn.includes('登入');
                  const isCreate = actionCn.includes('新增');
                  const isDelete = actionCn.includes('刪除') || actionCn.includes('回收') || actionCn.includes('封存') || actionCn.includes('清除');
                  const isUpdate = actionCn.includes('修改') || actionCn.includes('過帳') || actionCn.includes('復原') || actionCn.includes('救回') || actionCn.includes('交接') || actionCn.includes('密碼');

                  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (isLogin) badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
                  else if (isCreate) badgeColor = 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
                  else if (isDelete) badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
                  else if (isUpdate) badgeColor = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';

                  // 解析操作人員之中文身分角色（絕不顯示 USR-xxx 代號）
                  const operatorObj = allUsers.find(u => u.fullName === log.userName || u.id === log.userId);
                  const operatorRoleCn = operatorObj
                    ? (operatorObj.role === 'SUPERADMIN' ? '最高管理者' : operatorObj.role === 'ADMIN' ? '系統管理員' : '一般同仁')
                    : (log.userId && !/^[A-Za-z0-9_-]+$/.test(log.userId) && log.userId !== log.userName ? log.userId : '系統操作員');

                  // 解析 beforeJson 與 afterJson，僅擷取有修改的差異項目並轉為純中文
                  let parsedBefore: Record<string, unknown> | null = null;
                  let parsedAfter: Record<string, unknown> | null = null;
                  try {
                    if (log.beforeJson) parsedBefore = JSON.parse(log.beforeJson);
                  } catch (_) {}
                  try {
                    if (log.afterJson) parsedAfter = JSON.parse(log.afterJson);
                  } catch (_) {}

                  // 建立要顯示的差異清單或屬性清單
                  const diffEntries: { label: string; beforeVal?: string; afterVal: string; isDiff: boolean }[] = [];
                  if (parsedBefore && parsedAfter && typeof parsedBefore === 'object' && typeof parsedAfter === 'object') {
                    const allKeys = Array.from(new Set([...Object.keys(parsedBefore), ...Object.keys(parsedAfter)]));
                    for (const k of allKeys) {
                      if (k === 'username' || k === '登入帳號' || k === 'id' || k === 'updatedAt') continue;
                      const bVal = parsedBefore[k] !== undefined ? translateAuditValue(parsedBefore[k]) : undefined;
                      const aVal = parsedAfter[k] !== undefined ? translateAuditValue(parsedAfter[k]) : '無';
                      // 若有修改前與修改後，僅顯示實際有異動的欄位
                      if (bVal !== undefined && bVal !== aVal) {
                        diffEntries.push({
                          label: translateAuditKey(k),
                          beforeVal: bVal,
                          afterVal: aVal,
                          isDiff: true,
                        });
                      } else if (bVal === undefined) {
                        diffEntries.push({
                          label: translateAuditKey(k),
                          afterVal: aVal,
                          isDiff: false,
                        });
                      }
                    }
                  } else if (parsedAfter && typeof parsedAfter === 'object') {
                    for (const [k, v] of Object.entries(parsedAfter)) {
                      if (k === 'username' || k === '登入帳號' || k === 'id' || k === 'updatedAt') continue;
                      diffEntries.push({
                        label: translateAuditKey(k),
                        afterVal: translateAuditValue(v),
                        isDiff: false,
                      });
                    }
                  }

                  // 來源位置純中文化
                  const ipDisplay = !log.ipAddress || log.ipAddress.includes('127.0.0.1') || log.ipAddress.includes('192.168.1.')
                    ? '公司內網'
                    : log.ipAddress.includes('192.168.20.')
                    ? '工地內網'
                    : log.ipAddress;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 紀錄時間 */}
                      <td className="py-3 px-3.5 text-[11px] text-slate-600 whitespace-nowrap">
                        {log.createdAt}
                      </td>

                      {/* 操作人員 */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{log.userName}</div>
                        <div className="text-[10px] text-slate-400">{operatorRoleCn}</div>
                      </td>

                      {/* 操作動作 */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] border ${badgeColor}`}>
                          {actionCn}
                        </span>
                      </td>

                      {/* 異動項目與對象 */}
                      <td className="py-3 px-3 whitespace-nowrap text-xs">
                        <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px] font-bold mr-1.5">
                          {tableCn}
                        </span>
                        <span className="font-bold text-slate-800">{targetCn}</span>
                      </td>

                      {/* 修改內容明細（僅顯示有修改的部分） */}
                      <td className="py-3 px-3">
                        {diffEntries.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {diffEntries.map((item, idx) =>
                              item.isDiff ? (
                                <div
                                  key={`${item.label}-${idx}`}
                                  className="inline-flex items-center gap-1.5 bg-amber-50/70 text-slate-800 px-2.5 py-1 rounded-md text-[11px] border border-amber-200/90 shadow-2xs"
                                >
                                  <span className="font-bold text-slate-700">{item.label}：</span>
                                  <span className="text-slate-500 line-through decoration-slate-400 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                    {item.beforeVal}
                                  </span>
                                  <span className="text-amber-600 font-bold">➔</span>
                                  <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    {item.afterVal}
                                  </span>
                                </div>
                              ) : (
                                <span
                                  key={`${item.label}-${idx}`}
                                  className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] border border-slate-200"
                                >
                                  <span className="text-slate-500">{item.label}：</span>
                                  <strong className="text-slate-900">{item.afterVal}</strong>
                                </span>
                              )
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-600">
                            {actionCn}完成
                          </span>
                        )}
                      </td>

                      {/* 操作來源 */}
                      <td className="py-3 px-3 text-right text-[11px] text-slate-500 whitespace-nowrap">
                        {ipDisplay}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

      {/* ======================================================== */}
      {/* 4. 編輯 / 新增帳號正中間對話框 (Centered Form Modal)       */}
      {/*    居中呈現於螢幕正中央，具備良好視覺聚焦與緊湊表單       */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Modal 頂部 Header */}
            <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <UserCog className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">
                  {editingUser ? `編輯同仁帳號資訊：${editingUser.fullName} (@${editingUser.username})` : '新增系統操作同仁帳號'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal 本體表單 */}
            <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
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
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="如: 王工務"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 職稱與 Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    職務職稱
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="如: 主任工程師、採購副理"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    電子郵件 (Email)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@daju-eng.com.tw"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 角色身分設定 (受階層原則保護) */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  三層式身分角色 <span className="text-rose-500">*</span>
                </label>
                {editingUser?.role === 'SUPERADMIN' ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <div className="font-bold">此帳號為系統唯一最高 Superadmin</div>
                      <div className="text-[11px] text-amber-700">不可直接變更為其他角色，欲更換請使用「最高權限交接」流程。</div>
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
                        onChange={() => {
                          setFormData(prev => ({
                            ...prev,
                            role: 'USER',
                            groupIds: prev.groupIds && prev.groupIds.length > 0 ? prev.groupIds : ['GRP-ENG'],
                            canManageUsers: false,
                            canManageSystemConfigs: false,
                            canManageAdmins: false
                          }));
                        }}
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
                        !isSuperadmin && !operatorCanManageAdmins && editingUser?.role !== 'ADMIN'
                          ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                          : formData.role === 'ADMIN'
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold cursor-pointer'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!isSuperadmin && !operatorCanManageAdmins && editingUser?.role !== 'ADMIN') {
                          setAlertModal({
                            title: '【階層原則受限】無法指派同階管理員角色',
                            message: '您尚未取得 Superadmin 授予之【同階管理特許 (canManageAdmins)】，依規定只能建立或指派下一階層 (一般業務同仁 User)！',
                          });
                        }
                      }}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="ADMIN"
                        disabled={!isSuperadmin && !operatorCanManageAdmins && editingUser?.role !== 'ADMIN'}
                        checked={formData.role === 'ADMIN'}
                        onChange={() => {
                          if (isSuperadmin || operatorCanManageAdmins || editingUser?.role === 'ADMIN') {
                            setFormData({ ...formData, role: 'ADMIN' });
                          }
                        }}
                        className="hidden"
                      />
                      <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <div className="flex items-center gap-1">
                          <span>系統管理員 (ADMIN)</span>
                          {!isSuperadmin && !operatorCanManageAdmins && editingUser?.role !== 'ADMIN' && <Lock className="w-3 h-3 text-slate-400" />}
                        </div>
                        <div className="text-[10px] font-normal text-slate-500">
                          {isSuperadmin || operatorCanManageAdmins ? '全系統檢視與授權管理' : '需 Superadmin 授予同階管理特許'}
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Superadmin 專屬特許授權區 (僅限 Superadmin 呈現；非 Superadmin 人員畫面完全隱藏特許區塊) */}
              {isSuperadmin && formData.role === 'ADMIN' && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-3">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-amber-200/60 pb-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Superadmin 管理員進階特許授權</span>
                  </div>

                  {/* 特許 0: 帳號管理專人 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <span>1. 帳號管理專人授權 (canManageUsers)</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">專人管理</span>
                      </div>
                      <div className="text-[10px] text-slate-500">由 Superadmin 指定專人；左側選單可見帳號模組並可維護同仁與重設他人密碼（未獲指定者選單完全隱藏）</div>
                    </div>
                    {isSuperadmin ? (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.canManageUsers}
                          onChange={(e) => setFormData({ ...formData, canManageUsers: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                      </label>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">
                        {formData.canManageUsers ? '已指定' : '未授權'}
                      </span>
                    )}
                  </div>

                  {/* 特許 1: 全域核心參數 */}
                  <div className="flex items-center justify-between border-t border-amber-200/40 pt-2">
                    <div>
                      <div className="font-semibold text-slate-800">2. 全域核心參數維護特許 (canManageSystemConfigs)</div>
                      <div className="text-[10px] text-slate-500">可協同修改營業稅率、保留款率、鎖定模式等系統核心參數</div>
                    </div>
                    {isSuperadmin ? (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.canManageSystemConfigs}
                          onChange={(e) => setFormData({ ...formData, canManageSystemConfigs: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">
                        {formData.canManageSystemConfigs ? '已特許' : '未授權'}
                      </span>
                    )}
                  </div>

                  {/* 特許 2: 同階 Admin 管理特許 */}
                  <div className="flex items-center justify-between border-t border-amber-200/40 pt-2">
                    <div>
                      <div className="font-semibold text-slate-800">3. 同階 Admin 帳號管理特許 (canManageAdmins)</div>
                      <div className="text-[10px] text-slate-500">可新增、編輯、重設密碼與刪除同階 Admin（仍禁止動 Superadmin）</div>
                    </div>
                    {isSuperadmin ? (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.canManageAdmins}
                          onChange={(e) => setFormData({ ...formData, canManageAdmins: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">
                        {formData.canManageAdmins ? '已特許' : '未授權'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 所屬業務群組多選 (當 role === 'USER' 時必選) */}
              {formData.role === 'USER' && (
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
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ ...formData, groupIds: [...formData.groupIds, grp.id] });
                                } else {
                                  if (formData.groupIds.length === 1) {
                                    setAlertModal({
                                      title: '操作限制',
                                      message: '一般同仁至少需保留一個業務權限群組！',
                                    });
                                    return;
                                  }
                                  setFormData({ ...formData, groupIds: formData.groupIds.filter(id => id !== grp.id) });
                                }
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>{grp.groupName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({grp.groupCode})</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            審核額度: {grp.approvalLimit > 0 ? `NT$ ${grp.approvalLimit.toLocaleString()}` : '$0 (草稿填報)'}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    勾選多個群組時，系統自動將模組權限採聯集 (OR) 生效，並取最大單筆核准額度。
                  </span>
                </div>
              )}

              {/* 授權營運法人 */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  授權操作法人
                </label>
                <div className="space-y-1.5 bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                  {companies.map(comp => {
                    const checked = formData.allowedCompanies.includes(comp.id);
                    return (
                      <label
                        key={comp.id}
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
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, allowedCompanies: [...formData.allowedCompanies, comp.id] });
                              } else {
                                if (formData.allowedCompanies.length === 1) {
                                  setAlertModal({
                                    title: '操作限制',
                                    message: '至少需保留一個授權法人！',
                                  });
                                  return;
                                }
                                setFormData({ ...formData, allowedCompanies: formData.allowedCompanies.filter(id => id !== comp.id) });
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>[{comp.companyCode}] {comp.shortName || comp.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {comp.entityType === 'GROUP' ? '母體集團' : comp.entityType === 'PERSONAL' ? '老闆私帳' : '公司法人'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 新增時初始密碼 */}
              {!editingUser && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    初始登入密碼
                  </label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="預設為 888888"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    同仁首次登入後可自行變更密碼；管理員亦可隨時於列表一鍵重設。
                  </span>
                </div>
              )}
            </form>

            {/* Modal 底部操作按鈕 */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmitForm}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{editingUser ? '儲存變更 (進入二次確認)' : '確定建立帳號'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. 帳號異動二次確認對話框 (Diff Confirm Modal)              */}
      {/*    層級 z-[70]，清楚列出本次修改哪些地方 (變更前 vs 變更後) */}
      {/* ======================================================== */}
      {diffConfirmInfo && (
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
                onClick={() => setDiffConfirmInfo(null)}
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

              {/* 異動項目明確對照表 */}
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
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {d.fieldName}
                        </td>
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
                onClick={() => setDiffConfirmInfo(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                返回修改
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedUpdate}
                className="px-5 py-2 rounded-lg text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>確認執行變更</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. 密碼重設對話框 (Password Reset Modal)                   */}
      {/* ======================================================== */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs">重設同仁登入密碼</span>
              </div>
              <button
                onClick={() => setResetModalUser(null)}
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
                <div className="text-[11px] text-slate-400 mt-0.5">
                  身分角色：{resetModalUser.role}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  設定新密碼
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="請輸入新密碼"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setNewPasswordInput('888888')}
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
                onClick={() => setResetModalUser(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleConfirmResetPassword}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>確認重設</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. 最高權限交接專屬彈窗 (Transfer Superadmin Modal)       */}
      {/* ======================================================== */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-amber-300 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-3.5 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-white" />
                <span className="font-bold text-sm">最高權限交接程序 (Transfer Superadmin)</span>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
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
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- 請選擇要移轉權限的同仁 --</option>
                  {allUsers
                    .filter(u => u.role !== 'SUPERADMIN' && u.status === 'ACTIVE')
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
                  請在下方輸入文字「<span className="font-bold text-amber-700 select-all">確認交接最高權限</span>」以確認執行：
                </p>
                <input
                  type="text"
                  value={transferConfirmText}
                  onChange={(e) => setTransferConfirmText(e.target.value)}
                  placeholder="確認交接最高權限"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleExecuteTransfer}
                disabled={transferConfirmText.trim() !== '確認交接最高權限' || !transferTargetId}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>執行交接</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. 12 大模組權限矩陣互動配置彈窗 (Interactive PBAC Matrix) */}
      {/* ======================================================== */}
      {isMatrixModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <span>12 大營造核心模組 × 業務群組 權限即時配置矩陣 (PBAC Matrix)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      點擊「讀 / 寫 / 審 / 出」或調整額度即刻生效
                    </span>
                  </h3>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    點擊下方各群組之【讀 (檢視)、寫 (新增修改)、審 (核准過帳)、出 (匯出列印)】即可即時開啟或擋下權限；變更將自動記錄至純中文差異稽核日誌
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {operatorCanManageUsers && (
                  <button
                    onClick={() => setIsNewGroupFormOpen(prev => !prev)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isNewGroupFormOpen ? '收合新增群組' : '新增自訂群組'}</span>
                  </button>
                )}
                <button
                  onClick={() => setIsMatrixModalOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 新增自訂業務權限群組表單列 */}
            {isNewGroupFormOpen && (
              <div className="px-6 py-3.5 bg-indigo-50/90 border-b border-indigo-200 flex flex-wrap items-end gap-3 text-xs animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">群組識別碼 *</label>
                  <input
                    type="text"
                    value={newGroupForm.groupCode}
                    onChange={e => setNewGroupForm(prev => ({ ...prev, groupCode: e.target.value.toUpperCase() }))}
                    placeholder="如: QA_TEAM"
                    className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-mono w-28"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">群組中文名稱 *</label>
                  <input
                    type="text"
                    value={newGroupForm.groupName}
                    onChange={e => setNewGroupForm(prev => ({ ...prev, groupName: e.target.value }))}
                    placeholder="如: 品管安衛組"
                    className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs w-36"
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">職責說明</label>
                  <input
                    type="text"
                    value={newGroupForm.description}
                    onChange={e => setNewGroupForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="如: 工地安全衛生稽核與品質查驗"
                    className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">單筆審核額度</label>
                  <select
                    value={newGroupForm.approvalLimit}
                    onChange={e => setNewGroupForm(prev => ({ ...prev, approvalLimit: Number(e.target.value) }))}
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                  >
                    <option value={0}>$0 (僅填草稿)</option>
                    <option value={1000000}>$100萬</option>
                    <option value={3000000}>$300萬</option>
                    <option value={5000000}>$500萬</option>
                    <option value={10000000}>$1,000萬</option>
                    <option value={50000000}>$5,000萬</option>
                  </select>
                </div>
                <label className="flex items-center gap-1.5 py-1 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={newGroupForm.canExport}
                    onChange={e => setNewGroupForm(prev => ({ ...prev, canExport: e.target.checked }))}
                    className="rounded text-indigo-600"
                  />
                  <span>允許匯出報表</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (!newGroupForm.groupCode.trim() || !newGroupForm.groupName.trim()) {
                      setAlertModal({ title: '欄位未填', message: '請輸入群組識別碼與群組中文名稱！' });
                      return;
                    }
                    try {
                      const defaultPerms = SYSTEM_MODULES.map(m => ({
                        moduleKey: m.key as ModuleKey,
                        canRead: m.key === 'PROJECTS' || m.key === 'COMPANIES',
                        canWrite: m.key === 'PROJECTS',
                        canApprove: false,
                        canExport: false,
                      }));
                      createGroup(
                        {
                          groupCode: newGroupForm.groupCode.trim(),
                          groupName: newGroupForm.groupName.trim(),
                          description: newGroupForm.description.trim() || '自訂業務權限群組',
                          approvalLimit: newGroupForm.approvalLimit,
                          canExport: newGroupForm.canExport,
                        },
                        defaultPerms,
                        currentUser?.fullName || '管理員'
                      );
                      setNewGroupForm({ groupCode: '', groupName: '', description: '', approvalLimit: 1000000, canExport: true });
                      setIsNewGroupFormOpen(false);
                      reloadAuth();
                      onDataChanged();
                      showToast(`🎉 已建立新權限群組【${newGroupForm.groupName.trim()}】，可立即在矩陣配置權限！`);
                    } catch (err: unknown) {
                      setAlertModal({ title: '建立群組失敗', message: (err as Error).message });
                    }
                  }}
                  className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-2xs"
                >
                  建立群組
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5">
              <div className="border border-slate-200 rounded-lg overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-3 px-3 w-24">模組類別</th>
                      <th className="py-3 px-3 min-w-[190px]">營造工程核心模組</th>
                      {allGroups.map(grp => (
                        <th key={grp.id} className="py-2.5 px-2.5 text-center min-w-[155px] border-l border-slate-200/80">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-slate-900 font-extrabold">{grp.groupName}</span>
                            {!grp.isSystem && operatorCanManageUsers && (
                              <button
                                onClick={() => {
                                  try {
                                    deleteGroup(grp.id, currentUser?.fullName || '管理員');
                                    reloadAuth();
                                    onDataChanged();
                                    showToast(`🗑️ 已刪除自訂群組【${grp.groupName}】`);
                                  } catch (err: unknown) {
                                    setAlertModal({ title: '無法刪除群組', message: (err as Error).message });
                                  }
                                }}
                                title="刪除此自訂群組"
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* 單筆審核額度即時調整器 */}
                          <div className="mt-1.5 flex items-center justify-center gap-1">
                            <span className="text-[10px] font-normal text-slate-500">審核額度:</span>
                            <select
                              value={grp.approvalLimit}
                              disabled={!operatorCanManageUsers}
                              onChange={e => {
                                const nextLimit = Number(e.target.value);
                                try {
                                  updateGroup(
                                    { id: grp.id, approvalLimit: nextLimit },
                                    undefined,
                                    currentUser?.fullName || '管理員'
                                  );
                                  reloadAuth();
                                  onDataChanged();
                                  showToast(`💰 已更新【${grp.groupName}】單筆審核額度為 ${nextLimit > 0 ? `NT$ ${nextLimit.toLocaleString()}` : '$0 (僅填草稿)'}`);
                                } catch (err: unknown) {
                                  setAlertModal({ title: '更新額度失敗', message: (err as Error).message });
                                }
                              }}
                              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-indigo-700 cursor-pointer outline-none"
                            >
                              <option value={0}>$0 (僅草稿)</option>
                              <option value={1000000}>$100萬</option>
                              <option value={3000000}>$300萬</option>
                              <option value={5000000}>$500萬</option>
                              <option value={10000000}>$1,000萬</option>
                              <option value={30000000}>$3,000萬</option>
                              <option value={50000000}>$5,000萬</option>
                              <option value={100000000}>$1億</option>
                            </select>
                          </div>

                          {/* 群組全域匯出開關 */}
                          <div className="mt-1 flex items-center justify-center">
                            <button
                              type="button"
                              disabled={!operatorCanManageUsers}
                              onClick={() => {
                                try {
                                  updateGroup(
                                    { id: grp.id, canExport: !grp.canExport },
                                    undefined,
                                    currentUser?.fullName || '管理員'
                                  );
                                  reloadAuth();
                                  onDataChanged();
                                  showToast(`${!grp.canExport ? '✅ 已開放' : '🔒 已禁止'}【${grp.groupName}】全域報表匯出權限`);
                                } catch (err: unknown) {
                                  setAlertModal({ title: '更新失敗', message: (err as Error).message });
                                }
                              }}
                              className={`text-[10px] px-1.5 py-0.2 rounded border transition-colors cursor-pointer ${
                                grp.canExport
                                  ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold'
                                  : 'bg-slate-100 text-slate-400 border-slate-200'
                              }`}
                            >
                              全域匯出: {grp.canExport ? '允許' : '禁止'}
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {SYSTEM_MODULES.map(mod => (
                      <tr key={mod.key} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                          {mod.category}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-800">{mod.name}</div>
                          <div className="text-[10px] text-slate-400">{mod.description}</div>
                        </td>
                        {allGroups.map(grp => {
                          const p = allPermissions.find(item => item.groupId === grp.id && item.moduleKey === mod.key) || {
                            canRead: false,
                            canWrite: false,
                            canApprove: false,
                            canExport: false,
                          };
                          const handleClickToggle = (field: 'canRead' | 'canWrite' | 'canApprove' | 'canExport', labelCn: string) => {
                            if (!operatorCanManageUsers) {
                              setAlertModal({ title: '權限不足', message: '您未具備帳號與權限管理授權，無法變更權限矩陣！' });
                              return;
                            }
                            try {
                              toggleGroupModulePermission(
                                grp.id,
                                mod.key as ModuleKey,
                                field,
                                currentUser?.fullName || '管理員'
                              );
                              reloadAuth();
                              onDataChanged();
                              showToast(`⚡ 已切換【${grp.groupName}】於「${mod.name}」之【${labelCn}】權限！`);
                            } catch (err: unknown) {
                              setAlertModal({ title: '切換權限失敗', message: (err as Error).message });
                            }
                          };

                          return (
                            <td key={grp.id} className="py-2 px-2.5 text-center border-l border-slate-100">
                              <div className="inline-flex items-center justify-center gap-1 font-mono text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => handleClickToggle('canRead', '讀取檢視')}
                                  title={`點擊切換【${grp.groupName}】對「${mod.name}」之讀取檢視 (Read) 權限`}
                                  className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                    p.canRead
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold shadow-2xs hover:bg-emerald-200'
                                      : 'bg-slate-50 text-slate-300 border-slate-200 hover:bg-slate-100 hover:text-slate-500'
                                  }`}
                                >
                                  讀
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleClickToggle('canWrite', '新增編輯')}
                                  title={`點擊切換【${grp.groupName}】對「${mod.name}」之新增編輯 (Write) 權限`}
                                  className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                    p.canWrite
                                      ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold shadow-2xs hover:bg-indigo-200'
                                      : 'bg-slate-50 text-slate-300 border-slate-200 hover:bg-slate-100 hover:text-slate-500'
                                  }`}
                                >
                                  寫
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleClickToggle('canApprove', '單據核准')}
                                  title={`點擊切換【${grp.groupName}】對「${mod.name}」之單據核准 (Approve) 權限`}
                                  className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                    p.canApprove
                                      ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold shadow-2xs hover:bg-amber-200'
                                      : 'bg-slate-50 text-slate-300 border-slate-200 hover:bg-slate-100 hover:text-slate-500'
                                  }`}
                                >
                                  審
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleClickToggle('canExport', '報表匯出')}
                                  title={`點擊切換【${grp.groupName}】對「${mod.name}」之報表匯出 (Export) 權限`}
                                  className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                    p.canExport && grp.canExport
                                      ? 'bg-purple-100 text-purple-800 border-purple-300 font-bold shadow-2xs hover:bg-purple-200'
                                      : p.canExport && !grp.canExport
                                      ? 'bg-amber-50 text-amber-500 border-amber-200 line-through'
                                      : 'bg-slate-50 text-slate-300 border-slate-200 hover:bg-slate-100 hover:text-slate-500'
                                  }`}
                                >
                                  出
                                </button>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
              <div className="text-slate-500 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>智慧連動：開啟「寫/審/出」將自動開啟「讀」；關閉「讀」將自動一併收回「寫/審/出」權限。</span>
              </div>
              <button
                onClick={() => setIsMatrixModalOpen(false)}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white cursor-pointer"
              >
                完成並關閉矩陣
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. 置中防呆刪除確認彈窗 (Centered Delete Confirm Modal, z-[80]) */}
      {/*    徹底替換 iframe 環境中失效的 window.confirm，提供清晰資料防呆 */}
      {/* ======================================================== */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-white" />
                <h3 className="font-bold text-sm">第一階段：移入待刪除回收站 (7日冷卻)</h3>
              </div>
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="text-amber-200 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-950">
                    您確定要將同仁【{deleteConfirmUser.fullName}】移入待刪除回收站嗎？
                  </p>
                  <p className="text-amber-800 leading-relaxed text-[11px]">
                    移入後該同仁帳號將自【同仁主檔】移除並停用登入，享有 <span className="font-bold text-amber-950 underline decoration-amber-400">7 天冷卻保護期</span>。冷卻期內可隨時在「待刪除回收站」一鍵復原。若 7 天屆滿，系統將自動移交 Superadmin 深度封存區。
                  </p>
                </div>
              </div>

              {/* 帳號詳情卡片 */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2 text-slate-700 text-xs">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-400">同仁姓名：</span>
                  <span className="font-bold text-slate-800">{deleteConfirmUser.fullName}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-400">登入帳號：</span>
                  <span className="font-mono text-indigo-700 font-bold">@{deleteConfirmUser.username}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-400">身分層級：</span>
                  <span className={`font-bold px-1.5 py-0.2 rounded text-[11px] ${
                    deleteConfirmUser.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {deleteConfirmUser.role === 'ADMIN' ? '系統管理員 (ADMIN)' : '業務同仁 (USER)'}
                  </span>
                </div>
                {deleteConfirmUser.title && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">職務職稱：</span>
                    <span className="text-slate-700">{deleteConfirmUser.title}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>移入待刪回收站 (7日冷卻)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 提前移交 Superadmin 深度封存區確認彈窗 (Centered Modal, z-[80]) */}
      {/* ======================================================== */}
      {advanceArchiveConfirmUser && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-4 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">確認提前送往 Superadmin 深度封存區</h3>
              </div>
              <button
                onClick={() => setAdvanceArchiveConfirmUser(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-700 leading-relaxed">
                確定要將同仁【<span className="font-bold text-slate-900">{advanceArchiveConfirmUser.fullName}</span>】(@{advanceArchiveConfirmUser.username}) 提前二次刪除送往 Superadmin 深度封存區嗎？
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                  <span>權限移交提醒</span>
                </div>
                <p>
                  送交封存後，該筆同仁資料將自「待刪除回收站」移除，一般 Admin 視角將<strong>徹底隱藏且無法再執行復原</strong>，僅唯獨 Superadmin 擁有終極救援與物理清除之權力。
                </p>
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAdvanceArchiveConfirmUser(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAdvanceArchive}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>確認送往封存區</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Superadmin 永久物理粉碎清除確認對話框 (Centered Modal, z-[80]) */}
      {/* ======================================================== */}
      {purgeConfirmUser && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-300 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-white" />
                <h3 className="font-bold text-sm">Superadmin 終極物理粉碎清除</h3>
              </div>
              <button
                onClick={() => {
                  setPurgeConfirmUser(null);
                  setPurgeConfirmInput('');
                }}
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
                  您即將從資料庫中<strong>永久刪除</strong>同仁【<span className="font-bold">{purgeConfirmUser.fullName}</span>】(@{purgeConfirmUser.username}) 之使用者實體記錄。本動作無法撤銷！
                </p>
                <p className="text-[11px] text-rose-800">
                  依系統單據血緣防護設計，歷史單據將純淨保留其姓名純文字快照，單據內容絕不留白。
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 text-xs">
                  請輸入安全確認詞以解鎖清除：<span className="font-mono text-rose-600 select-all font-bold">確認永久物理清除</span>
                </label>
                <input
                  type="text"
                  value={purgeConfirmInput}
                  onChange={(e) => setPurgeConfirmInput(e.target.value)}
                  placeholder="請在此輸入「確認永久物理清除」..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                />
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPurgeConfirmUser(null);
                  setPurgeConfirmInput('');
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={purgeConfirmInput.trim() !== '確認永久物理清除'}
                onClick={handlePermanentPurge}
                className={`px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm transition-all flex items-center gap-1.5 ${
                  purgeConfirmInput.trim() === '確認永久物理清除'
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
      )}

      {/* ======================================================== */}
      {/* 9. 刪除後一鍵復原 Toast (Undo Restore Notification, z-[90]) */}
      {/* ======================================================== */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-[90] flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🗑️</span>
            <div className="text-xs">
              <p className="font-bold">
                已刪除同仁【{undoToast.user.fullName}】帳號
              </p>
              <p className="text-[11px] text-slate-400">
                防呆復原倒數：<span className="font-mono text-amber-400 font-bold">{undoToast.countdown}s</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={handleUndoRestore}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>一鍵復原 ({undoToast.countdown}s)</span>
            </button>
            <button
              onClick={() => setUndoToast(null)}
              className="text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
              title="關閉提示"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
