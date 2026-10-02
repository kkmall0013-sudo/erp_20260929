import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User, UserGroup, GroupModulePermission, ModuleKey, UserRole } from '../types/erp';
import {
  getAllUsers,
  getAllUserGroups,
  getAllGroupPermissions,
  subscribeToDatabase
} from '../db/sqlite';

interface AuthContextType {
  currentUser: User | null;
  currentGroup: UserGroup | null;
  currentGroups: UserGroup[];
  allUsers: User[];
  allGroups: UserGroup[];
  allPermissions: GroupModulePermission[];
  isSuperadmin: boolean;
  isAdmin: boolean;
  isUser: boolean;
  approvalLimit: number;
  can: (moduleKey: ModuleKey, action: 'read' | 'write' | 'approve' | 'export') => boolean;
  checkApproval: (amount: number, moduleKey?: ModuleKey) => { allowed: boolean; reason?: string };
  switchUser: (userId: string) => void;
  reloadAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allGroups, setAllGroups] = useState<UserGroup[]>([]);
  const [allPermissions, setAllPermissions] = useState<GroupModulePermission[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return localStorage.getItem('engineering_erp_active_user_id') || 'USR-001';
  });

  const reloadAuth = useCallback(() => {
    const users = getAllUsers();
    const groups = getAllUserGroups();
    const perms = getAllGroupPermissions();
    setAllUsers(users);
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

  // 當前使用者
  const currentUser = useMemo(() => {
    if (!allUsers.length) return null;
    const found = allUsers.find(u => u.id === currentUserId && u.status === 'ACTIVE');
    return found || allUsers[0] || null;
  }, [allUsers, currentUserId]);

  // 當前使用者所屬全部群組 (支援多重業務群組矩陣)
  const currentGroups = useMemo<UserGroup[]>(() => {
    if (!currentUser || currentUser.role !== 'USER') return [];
    const ids = currentUser.groupIds && currentUser.groupIds.length > 0
      ? currentUser.groupIds
      : (currentUser.groupId ? [currentUser.groupId] : []);
    return allGroups.filter(g => ids.includes(g.id));
  }, [currentUser, allGroups]);

  // 主要群組 (供單一群組簡易向下相容顯示)
  const currentGroup = useMemo<UserGroup | null>(() => {
    return currentGroups[0] || null;
  }, [currentGroups]);

  const isSuperadmin = currentUser?.role === 'SUPERADMIN';
  const isAdmin = currentUser?.role === 'ADMIN';
  const isUser = currentUser?.role === 'USER';

  // 核准金額上限 (多群組取最大上限，賦予同仁最大授權)
  const approvalLimit = useMemo(() => {
    if (isSuperadmin) return Infinity;
    if (isAdmin) return 50000000;
    if (currentGroups.length > 0) {
      return Math.max(...currentGroups.map(g => g.approvalLimit || 0), 0);
    }
    return 0;
  }, [isSuperadmin, isAdmin, currentGroups]);

  // 切換模擬身分
  const switchUser = useCallback((userId: string) => {
    setCurrentUserId(userId);
    localStorage.setItem('engineering_erp_active_user_id', userId);
  }, []);

  // 權限判斷函式 (PBAC 多群組矩陣聯集解析)
  const can = useCallback((moduleKey: ModuleKey, action: 'read' | 'write' | 'approve' | 'export'): boolean => {
    if (!currentUser) return false;

    // Superadmin: 擁有所有模組的無條件最高權限
    if (currentUser.role === 'SUPERADMIN') return true;

    // Admin: 系統管理員擁有絕大多數檢視、同仁維護與系統管理權限，但不可變更底層全域設定
    if (currentUser.role === 'ADMIN') {
      if ((moduleKey === 'AUDIT_LOGS' || moduleKey === 'SYSTEM_CONFIGS') && (action === 'write' || action === 'approve')) {
        return false;
      }
      return true;
    }

    // User: 依所屬多個業務群組之 group_module_permissions 綜合聯集 (OR) 查核
    if (currentGroups.length === 0) return false;

    // 檢查是否有任一個所屬群組具備該權限
    return currentGroups.some(grp => {
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
  }, [currentUser, currentGroups, allPermissions]);

  // 審核單據金額上限查核
  const checkApproval = useCallback((amount: number, moduleKey?: ModuleKey): { allowed: boolean; reason?: string } => {
    if (!currentUser) return { allowed: false, reason: '未登入或無身分' };
    if (isSuperadmin) return { allowed: true };

    const groupNames = currentGroups.map(g => g.groupName).join(' / ') || currentUser.role;

    if (moduleKey && !can(moduleKey, 'approve')) {
      return { allowed: false, reason: `您所屬身分 [${groupNames}] 尚未被賦予本模組的單據核准權限！` };
    }

    if (approvalLimit === 0) {
      return { allowed: false, reason: `您所屬群組 [${groupNames}] 單筆核准額度為 NT$ 0，僅可填報草稿，無核准權限！` };
    }

    if (amount > approvalLimit) {
      return {
        allowed: false,
        reason: `單據金額 NT$ ${amount.toLocaleString()} 超出您所屬群組之單筆審核上限 NT$ ${approvalLimit.toLocaleString()}，須呈報上級長官核准！`
      };
    }

    return { allowed: true };
  }, [currentUser, isSuperadmin, can, currentGroups, approvalLimit]);

  const value = {
    currentUser,
    currentGroup,
    currentGroups,
    allUsers,
    allGroups,
    allPermissions,
    isSuperadmin,
    isAdmin,
    isUser,
    approvalLimit,
    can,
    checkApproval,
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
