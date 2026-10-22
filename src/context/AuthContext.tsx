import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User, UserGroup, GroupModulePermission, ModuleKey, UserRole } from '../types/erp';
import {
  getAllUsers,
  getAllUserGroups,
  getAllGroupPermissions,
  subscribeToDatabase,
  recordAuditLog
} from '../db/sqlite';

interface AuthContextType {
  currentUser: User | null;
  currentGroup: UserGroup | null;
  currentGroups: UserGroup[];
  allUsers: User[];
  allGroups: UserGroup[];
  allPermissions: GroupModulePermission[];
  isSuperadmin: boolean;
  isBoss: boolean;
  isAdmin: boolean;
  isUser: boolean;
  approvalLimit: number;
  activeCompanyId: string;
  setActiveCompanyId: (id: string) => void;
  can: (moduleKey: ModuleKey, action: 'read' | 'write' | 'approve' | 'export', targetCompanyId?: string) => boolean;
  checkApproval: (amount: number, moduleKey?: ModuleKey, targetCompanyId?: string) => { allowed: boolean; reason?: string };
  getGroupsForCompany: (companyId: string) => UserGroup[];
  switchUser: (userId: string) => void;
  reloadAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode; activeCompanyId?: string }> = ({
  children,
  activeCompanyId: propActiveCompanyId
}) => {
  const [internalActiveCompanyId, setInternalActiveCompanyId] = useState<string>(propActiveCompanyId || 'COMP-01');
  const [allUsersState, setAllUsersState] = useState<User[]>([]);
  const [allGroups, setAllGroups] = useState<UserGroup[]>([]);
  const [allPermissions, setAllPermissions] = useState<GroupModulePermission[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return localStorage.getItem('engineering_erp_active_user_id') || 'USR-BOSS';
  });

  useEffect(() => {
    if (propActiveCompanyId && propActiveCompanyId !== internalActiveCompanyId) {
      setInternalActiveCompanyId(propActiveCompanyId);
    }
  }, [propActiveCompanyId, internalActiveCompanyId]);

  const activeCompanyId = propActiveCompanyId || internalActiveCompanyId;
  const setActiveCompanyId = setInternalActiveCompanyId;

  const reloadAuth = useCallback(() => {
    const users = getAllUsers();
    const groups = getAllUserGroups();
    const perms = getAllGroupPermissions();
    setAllUsersState(users);
    setAllGroups(groups);
    setAllPermissions(perms);
  }, []);

  useEffect(() => {
    reloadAuth();
    const unsubscribe = subscribeToDatabase(() => {
      reloadAuth();
    });
    return () => unsubscribe();
  }, [reloadAuth]);

  // 當前使用者 (安全防護：嚴禁靜默提權回退至 Superadmin)
  const currentUser = useMemo(() => {
    if (!allUsersState.length) return null;
    const matched = allUsersState.find(u => u.id === currentUserId);
    if (matched) {
      return matched;
    }
    const bossUser = allUsersState.find(u => u.role === 'BOSS' && u.status === 'ACTIVE');
    if (bossUser) return bossUser;
    const firstActive = allUsersState.find(u => u.status === 'ACTIVE');
    return firstActive || null;
  }, [allUsersState, currentUserId]);

  const isSuperadmin = currentUser?.role === 'SUPERADMIN' && currentUser?.status === 'ACTIVE';
  const isBoss = currentUser?.role === 'BOSS' && currentUser?.status === 'ACTIVE';
  const isAdmin = currentUser?.role === 'ADMIN' && currentUser?.status === 'ACTIVE';
  const isUser = currentUser?.role === 'USER' && currentUser?.status === 'ACTIVE';

  // 🛡️ 隱密防護 (Stealth Mode)：
  // 除非目前登入身分即為系統架構師 (Superadmin 本人)，否則全系統 (包含同仁清單、統計數據、身分切換選單) 100% 隱蔽 Superadmin
  const visibleUsers = useMemo(() => {
    if (isSuperadmin) {
      return allUsersState;
    }
    return allUsersState.filter(u => u.role !== 'SUPERADMIN');
  }, [isSuperadmin, allUsersState]);

  // 取得使用者在指定法人下的業務群組 (支援跨法人業務授權矩陣)
  const getGroupsForCompany = useCallback((companyId: string): UserGroup[] => {
    if (!currentUser || currentUser.role !== 'USER' || currentUser.status !== 'ACTIVE') return [];

    // 若設定了跨法人業務授權矩陣
    if (currentUser.companyGroupAssignments && currentUser.companyGroupAssignments.length > 0) {
      if (companyId === 'COMP-ALL' || !companyId) {
        const allAssignedGroupIds = Array.from(new Set(currentUser.companyGroupAssignments.flatMap(a => a.groupIds)));
        return allGroups.filter(g => allAssignedGroupIds.includes(g.id));
      }

      const match = currentUser.companyGroupAssignments.find(a => a.companyId === companyId);
      if (match && match.groupIds && match.groupIds.length > 0) {
        return allGroups.filter(g => match.groupIds.includes(g.id));
      }
      // 在矩陣模式下，若此特定法人未被指派業務群組，代表在此法人無權限
      return [];
    }

    // 回退至全域業務群組 (向下相容)
    const ids = currentUser.groupIds && currentUser.groupIds.length > 0
      ? currentUser.groupIds
      : (currentUser.groupId ? [currentUser.groupId] : []);
    return allGroups.filter(g => ids.includes(g.id));
  }, [currentUser, allGroups]);

  // 當前使用者在當前選定法人下的有效群組
  const currentGroups = useMemo<UserGroup[]>(() => {
    return getGroupsForCompany(activeCompanyId);
  }, [getGroupsForCompany, activeCompanyId]);

  // 主要群組 (供單一群組簡易向下相容顯示)
  const currentGroup = useMemo<UserGroup | null>(() => {
    return currentGroups[0] || null;
  }, [currentGroups]);

  // 核准金額上限 (依當前法人有效群組取最大上限)
  const approvalLimit = useMemo(() => {
    if (isSuperadmin || isBoss) return Infinity;
    if (isAdmin) return 50000000;
    if (currentGroups.length > 0) {
      if (currentGroups.some(g => g.approvalLimit === -1 || g.approvalLimit >= 999999999)) {
        return Infinity;
      }
      return Math.max(...currentGroups.map(g => g.approvalLimit || 0), 0);
    }
    return 0;
  }, [isSuperadmin, isBoss, isAdmin, currentGroups]);

  // 切換模擬身分與登入
  const switchUser = useCallback((userId: string) => {
    setCurrentUserId(userId);
    localStorage.setItem('engineering_erp_active_user_id', userId);

    const target = allUsersState.find(u => u.id === userId);
    if (target) {
      const roleCn = target.role === 'SUPERADMIN'
        ? '系統架構師 (Superadmin)'
        : target.role === 'BOSS'
        ? '企業最高統裁 (集團董事長)'
        : target.role === 'ADMIN'
        ? '系統管理員'
        : '一般同仁';
      recordAuditLog(
        target.fullName,
        '登入系統',
        '同仁帳號',
        target.fullName,
        {
          '權限身分': roleCn,
          '職務職稱': target.title || '無職稱',
        },
        roleCn
      );
    }
  }, [allUsersState]);

  // 權限判斷函式 (PBAC 多群組矩陣聯集解析 + 跨法人業務分權)
  const can = useCallback((moduleKey: ModuleKey, action: 'read' | 'write' | 'approve' | 'export', targetCompanyId?: string): boolean => {
    if (!currentUser) return false;

    // 停權帳號（DISABLED）或待刪除/封存帳號：全面封鎖所有模組權限
    if (currentUser.status === 'DISABLED' || (currentUser.deleteStage && currentUser.deleteStage !== 'ACTIVE')) return false;

    // Superadmin: 系統架構師擁有所有模組的無條件最高權限
    if (currentUser.role === 'SUPERADMIN') return true;

    // BOSS: 企業最高統裁 (集團董事長) 擁有全集團跨法人全業務模組穿透、最高審批權 (無限額審批)
    // 審計日誌禁止篡改 (唯讀)
    if (currentUser.role === 'BOSS') {
      if (moduleKey === 'AUDIT_LOGS' && (action === 'write' || action === 'approve')) {
        return false;
      }
      return true;
    }

    const effCompId = targetCompanyId || activeCompanyId;

    // Admin: 系統管理員擁有絕大多數檢視、同仁維護與系統管理權限
    if (currentUser.role === 'ADMIN') {
      // 審計日誌不可竄改，永遠禁止覆寫
      if (moduleKey === 'AUDIT_LOGS' && (action === 'write' || action === 'approve')) {
        return false;
      }
      // 全域核心參數：若獲得 Superadmin/BOSS 特許授權 (canManageSystemConfigs)，則開放維護；否則唯讀
      if (moduleKey === 'SYSTEM_CONFIGS' && (action === 'write' || action === 'approve')) {
        return Boolean(currentUser.canManageSystemConfigs);
      }
      // 若指定特定公司，檢查是否在授權法人範圍內
      if (effCompId && !currentUser.canManageAllCompanies && !(currentUser.allowedCompanies || []).includes(effCompId)) {
        return false;
      }
      return true;
    }

    // User: 業務同仁
    // 若未指定 targetCompanyId，且當前法人下群組為空，但查詢為唯讀（例如左側導航選單項目是否對同仁可見）
    if (!targetCompanyId && currentGroups.length === 0 && action === 'read') {
      if (currentUser.companyGroupAssignments && currentUser.companyGroupAssignments.length > 0) {
        const allAssignedGroupIds = Array.from(new Set(currentUser.companyGroupAssignments.flatMap(a => a.groupIds)));
        const allAssignedGroups = allGroups.filter(g => allAssignedGroupIds.includes(g.id));
        return allAssignedGroups.some(grp => {
          const perm = allPermissions.find(p => p.groupId === grp.id && p.moduleKey === moduleKey);
          return perm?.canRead;
        });
      }
    }

    const effGroups = targetCompanyId ? getGroupsForCompany(targetCompanyId) : currentGroups;
    if (effGroups.length === 0) return false;

    // 檢查是否有任一個所屬群組具備該權限
    return effGroups.some(grp => {
      // 若為匯出動作，該群組必須具有全域匯出授權 (canExport)
      if (action === 'export' && !grp.canExport) {
        return false;
      }

      const perm = allPermissions.find(p => p.groupId === grp.id && p.moduleKey === moduleKey);
      if (!perm) return false;

      switch (action) {
        case 'read':
          return perm.canRead;
        case 'write':
          return perm.canWrite;
        case 'approve':
          return perm.canApprove;
        case 'export':
          return perm.canExport && grp.canExport;
        default:
          return false;
      }
    });
  }, [currentUser, activeCompanyId, currentGroups, getGroupsForCompany, allGroups, allPermissions]);

  // 審核單據金額上限查核
  const checkApproval = useCallback((amount: number, moduleKey?: ModuleKey, targetCompanyId?: string): { allowed: boolean; reason?: string } => {
    if (!currentUser) return { allowed: false, reason: '未登入或無身分' };
    if (isSuperadmin || isBoss) return { allowed: true };

    const effCompId = targetCompanyId || activeCompanyId;
    const effGroups = targetCompanyId ? getGroupsForCompany(targetCompanyId) : currentGroups;
    const groupNames = effGroups.map(g => g.groupName).join(' / ') || currentUser.role;

    if (moduleKey && !can(moduleKey, 'approve', effCompId)) {
      return { allowed: false, reason: `您在當前法人所屬身分 [${groupNames}] 尚未被賦予本模組的單據核准權限！` };
    }

    let effLimit = 0;
    if (isAdmin) {
      effLimit = 50000000;
    } else if (effGroups.length > 0) {
      if (effGroups.some(g => g.approvalLimit === -1 || g.approvalLimit >= 999999999)) {
        effLimit = Infinity;
      } else {
        effLimit = Math.max(...effGroups.map(g => g.approvalLimit || 0), 0);
      }
    }

    if (effLimit === 0) {
      return { allowed: false, reason: `您在當前法人所屬群組 [${groupNames}] 單筆核准額度為 NT$ 0，僅可填報草稿，無核准權限！` };
    }

    if (amount > effLimit) {
      return {
        allowed: false,
        reason: `單據金額 NT$ ${amount.toLocaleString()} 超出您在當前法人所屬群組之單筆審核上限 NT$ ${effLimit.toLocaleString()}，須呈報上級長官核准！`
      };
    }

    return { allowed: true };
  }, [currentUser, isSuperadmin, isBoss, isAdmin, can, activeCompanyId, currentGroups, getGroupsForCompany]);

  const value = {
    currentUser,
    currentGroup,
    currentGroups,
    allUsers: visibleUsers,
    allGroups,
    allPermissions,
    isSuperadmin,
    isBoss,
    isAdmin,
    isUser,
    approvalLimit,
    activeCompanyId,
    setActiveCompanyId,
    can,
    checkApproval,
    getGroupsForCompany,
    switchUser,
    reloadAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
