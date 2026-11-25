import {
  AuditLog,
  Company,
  CompanyGroupAssignment,
  User,
  UserGroup,
  UserRole,
} from '../../../types/erp';

export interface DiffItem {
  fieldName: string;
  oldValue: string;
  newValue: string;
}

export interface AlertModalState {
  title: string;
  message: string;
  details?: string;
}

export interface UserFormData {
  id?: string;
  username: string;
  fullName: string;
  email: string;
  title: string;
  role: UserRole;
  canManageUsers: boolean;
  canManageSystemConfigs: boolean;
  canManageAdmins: boolean;
  canManageAllCompanies: boolean;
  groupIds: string[];
  companyGroupAssignments: CompanyGroupAssignment[];
  permissionMode: 'GLOBAL' | 'MATRIX';
  allowedCompanies: string[];
  defaultCompanyId: string;
  password?: string;
}

export function getRoleLabelCn(role: string): string {
  if (role === 'SUPERADMIN') return '最高管理者';
  if (role === 'BOSS') return '企業最高統裁 (BOSS)';
  if (role === 'ADMIN') return '系統管理員';
  return '一般同仁';
}

export function translateAuditAction(action: string): string {
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
}

export function translateAuditTable(table: string): string {
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
}

export function translateAuditTarget(
  targetId: string,
  allUsers: User[],
  allGroups: UserGroup[],
  companies: Company[]
): string {
  if (!targetId) return '';
  const cleaned = targetId.replace(/\s*\([A-Za-z0-9_-]+\)/g, '').trim();
  const matchedUser = allUsers.find(u => u.id === cleaned || u.username === cleaned);
  if (matchedUser) return matchedUser.fullName;
  const matchedGroup = allGroups.find(g => g.id === cleaned || g.groupCode === cleaned);
  if (matchedGroup) return matchedGroup.groupName;
  const matchedComp = companies.find(c => c.id === cleaned || c.companyCode === cleaned);
  if (matchedComp) return matchedComp.shortName || matchedComp.name;
  return cleaned;
}

export function translateAuditKey(key: string): string {
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
}

export function translateAuditValue(
  val: unknown,
  allUsers: User[],
  allGroups: UserGroup[],
  companies: Company[]
): string {
  if (val === null || val === undefined) return '無';
  if (typeof val === 'boolean') return val ? '開啟' : '關閉';
  if (Array.isArray(val)) {
    if (val.length === 0) return '無';
    return val.map(item => translateAuditValue(item, allUsers, allGroups, companies)).join('、');
  }
  const str = String(val);
  const valMap: Record<string, string> = {
    SUPERADMIN: '最高管理者',
    BOSS: '企業最高統裁 (集團董事長)',
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
}

export function filterActiveUsers(
  activeUsers: User[],
  searchTerm: string,
  roleFilter: 'ALL' | 'SUPERADMIN' | 'BOSS' | 'ADMIN' | 'USER',
  statusFilter: 'ALL' | 'ACTIVE' | 'DISABLED',
  privilegeFilter: 'ALL' | 'USER_MGR' | 'SYS_CONFIG' | 'PEER_ADMIN' | 'NONE'
): User[] {
  return activeUsers.filter(u => {
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      const matchName = u.fullName.toLowerCase().includes(t);
      const matchUsername = u.username.toLowerCase().includes(t);
      const matchEmail = (u.email || '').toLowerCase().includes(t);
      const matchTitle = (u.title || '').toLowerCase().includes(t);
      if (!matchName && !matchUsername && !matchEmail && !matchTitle) return false;
    }

    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;

    if (privilegeFilter === 'USER_MGR' && !u.canManageUsers) return false;
    if (privilegeFilter === 'SYS_CONFIG' && !u.canManageSystemConfigs) return false;
    if (privilegeFilter === 'PEER_ADMIN' && !u.canManageAdmins) return false;
    if (
      privilegeFilter === 'NONE' &&
      (u.canManageUsers || u.canManageSystemConfigs || u.canManageAdmins)
    ) {
      return false;
    }

    return true;
  });
}

export function filterAuditLogs(
  auditLogs: AuditLog[],
  auditSearchTerm: string,
  auditActionFilter: string,
  auditUserFilter: string,
  allUsers: User[],
  allGroups: UserGroup[],
  companies: Company[]
): AuditLog[] {
  return auditLogs.filter(log => {
    const actionCn = translateAuditAction(log.action);
    const tableCn = translateAuditTable(log.targetTable);
    const targetCn = translateAuditTarget(log.targetId, allUsers, allGroups, companies);

    if (auditSearchTerm.trim()) {
      const t = auditSearchTerm.toLowerCase();
      const matchUser = log.userName.toLowerCase().includes(t) || log.userId.toLowerCase().includes(t);
      const matchTable = tableCn.toLowerCase().includes(t) || log.targetTable.toLowerCase().includes(t);
      const matchId = targetCn.toLowerCase().includes(t) || log.targetId.toLowerCase().includes(t);
      const matchAction = actionCn.toLowerCase().includes(t) || log.action.toLowerCase().includes(t);
      const matchAfter = (log.afterJson || '').toLowerCase().includes(t);
      const matchBefore = (log.beforeJson || '').toLowerCase().includes(t);
      if (!matchUser && !matchTable && !matchId && !matchAction && !matchAfter && !matchBefore) {
        return false;
      }
    }

    if (auditActionFilter !== 'ALL') {
      if (auditActionFilter === 'LOGIN' && !actionCn.includes('登入') && !log.action.includes('LOGIN')) {
        return false;
      }
      if (auditActionFilter === 'CREATE' && !actionCn.includes('新增') && log.action !== 'CREATE') {
        return false;
      }
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
      if (
        auditActionFilter === 'PASSWORD' &&
        !actionCn.includes('密碼') &&
        !log.action.includes('PASSWORD')
      ) {
        return false;
      }
    }

    if (auditUserFilter !== 'ALL') {
      if (log.userName !== auditUserFilter && log.userId !== auditUserFilter) return false;
    }

    return true;
  });
}

export function computeUserDiffs(
  formData: UserFormData,
  editingUser: User,
  companies: Company[],
  getGroupName: (groupId?: string) => string | undefined,
  operatorCanGrantPrivileges: boolean
): DiffItem[] {
  const diffs: DiffItem[] = [];

  if (formData.fullName.trim() !== editingUser.fullName) {
    diffs.push({
      fieldName: '同仁姓名',
      oldValue: editingUser.fullName,
      newValue: formData.fullName.trim(),
    });
  }

  if ((formData.title.trim() || '') !== (editingUser.title || '')) {
    diffs.push({
      fieldName: '職務職稱',
      oldValue: editingUser.title || '(無)',
      newValue: formData.title.trim() || '(無)',
    });
  }

  if (formData.email.trim() !== (editingUser.email || '')) {
    diffs.push({
      fieldName: '電子郵件',
      oldValue: editingUser.email || '(無)',
      newValue: formData.email.trim() || '(無)',
    });
  }

  if (editingUser.role !== 'SUPERADMIN' && editingUser.role !== 'BOSS' && formData.role !== editingUser.role) {
    diffs.push({
      fieldName: '身分層級角色',
      oldValue: editingUser.role === 'ADMIN' ? '系統管理員 (ADMIN)' : '業務同仁 (USER)',
      newValue: formData.role === 'ADMIN' ? '系統管理員 (ADMIN)' : '業務同仁 (USER)',
    });

    if (editingUser.role === 'ADMIN' && formData.role === 'USER') {
      if (
        editingUser.canManageUsers ||
        editingUser.canManageSystemConfigs ||
        editingUser.canManageAdmins ||
        editingUser.canManageAllCompanies
      ) {
        diffs.push({
          fieldName: '管理員進階特許權限',
          oldValue: '原已具備特定管理特許',
          newValue: '降為業務同仁，所有進階特許自動收回並歸零',
        });
      }
    }
  }

  if (operatorCanGrantPrivileges && formData.role === 'ADMIN') {
    if (Boolean(formData.canManageUsers) !== Boolean(editingUser.canManageUsers)) {
      diffs.push({
        fieldName: '帳號管理專人特許 (canManageUsers)',
        oldValue: editingUser.canManageUsers ? '已指定為專人' : '未指定 (選單隱藏)',
        newValue: formData.canManageUsers ? '已指定為專人' : '未指定 (選單隱藏)',
      });
    }

    if (Boolean(formData.canManageSystemConfigs) !== Boolean(editingUser.canManageSystemConfigs)) {
      diffs.push({
        fieldName: '全域核心參數特許 (canManageSystemConfigs)',
        oldValue: editingUser.canManageSystemConfigs ? '已特許授權' : '未授權 (唯讀)',
        newValue: formData.canManageSystemConfigs ? '已特許授權' : '未授權 (唯讀)',
      });
    }

    if (Boolean(formData.canManageAdmins) !== Boolean(editingUser.canManageAdmins)) {
      diffs.push({
        fieldName: '同階 Admin 管理特許 (canManageAdmins)',
        oldValue: editingUser.canManageAdmins ? '已特許授權' : '未授權 (僅管 User)',
        newValue: formData.canManageAdmins ? '已特許授權' : '未授權 (僅管 User)',
      });
    }

    if (Boolean(formData.canManageAllCompanies) !== Boolean(editingUser.canManageAllCompanies)) {
      diffs.push({
        fieldName: '全集團跨法人管理特許 (canManageAllCompanies)',
        oldValue: editingUser.canManageAllCompanies
          ? '已特許授權 (老闆/常務管理全集團)'
          : '未授權 (依所屬法人)',
        newValue: formData.canManageAllCompanies
          ? '已特許授權 (老闆/常務管理全集團)'
          : '未授權 (依所屬法人)',
      });
    }
  }

  if (formData.role === 'USER') {
    const oldG = (editingUser.groupIds || (editingUser.groupId ? [editingUser.groupId] : []))
      .sort()
      .join(',');
    const finalG = formData.groupIds.length > 0 ? formData.groupIds : ['GRP-ENG'];
    const newG = [...finalG].sort().join(',');
    if (oldG !== newG) {
      const oldNames = (editingUser.groupIds || (editingUser.groupId ? [editingUser.groupId] : []))
        .map(g => getGroupName(g) || g)
        .join('、');
      const newNames = finalG.map(g => getGroupName(g) || g).join('、');
      diffs.push({
        fieldName: '指派業務權限群組 (PBAC)',
        oldValue: oldNames || '(無)',
        newValue: newNames || '(無)',
      });
    }

    const oldMat = editingUser.companyGroupAssignments || [];
    const newMat = formData.permissionMode === 'MATRIX' ? formData.companyGroupAssignments : [];
    if (JSON.stringify(oldMat) !== JSON.stringify(newMat)) {
      const formatMat = (assignments: CompanyGroupAssignment[]) => {
        if (!assignments.length) return '全域群組模式 (統包)';
        return assignments
          .map(a => {
            const comp = companies.find(c => c.id === a.companyId);
            const compName = comp ? comp.shortName || comp.name : a.companyId;
            const grpNames = a.groupIds.map(g => getGroupName(g) || g).join('+') || '無指派';
            return `[${compName}: ${grpNames}]`;
          })
          .join('、');
      };
      diffs.push({
        fieldName: '跨法人業務授權矩陣',
        oldValue: formatMat(oldMat),
        newValue: formatMat(newMat),
      });
    }
  }

  const oldComps = (editingUser.allowedCompanies || ['COMP-01']).sort().join(',');
  const newComps = [...formData.allowedCompanies].sort().join(',');
  if (oldComps !== newComps) {
    diffs.push({
      fieldName: '授權操作營運法人',
      oldValue: (editingUser.allowedCompanies || ['COMP-01']).join('、'),
      newValue: formData.allowedCompanies.join('、'),
    });
  }

  return diffs;
}
