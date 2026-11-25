import type {
  CompanyGroupAssignment,
  User,
  UserRole
} from '../../types/erp';
import {
  getDbInstance,
  notifyListeners,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { logAudit } from './auditRepository';
import { getAllCompanies } from './companyRepository';
import { getAllUserGroups, resolveGroupNamesCn } from './rbacGroupRepository';

// 中文名稱轉換輔助函式 (避免在審計日誌中出現英文代號)
function formatRoleCn(role?: string): string {
  if (role === 'SUPERADMIN') return '系統架構師 (Superadmin)';
  if (role === 'BOSS') return '企業最高統裁 (集團董事長)';
  if (role === 'ADMIN') return '系統管理員';
  return '一般同仁';
}

function formatStatusCn(status?: string): string {
  if (status === 'DISABLED') return '已停用';
  return '啟用中';
}

function resolveCompanyNamesCn(companyIds?: string[]): string {
  if (!companyIds || companyIds.length === 0) return '無';
  const fallbackMap: Record<string, string> = {
    'GRP-01': '大巨集團',
    'COMP-01': '大巨營造',
    'COMP-02': '宏達機電',
    'BOSS-01': '林董私帳',
    'COMP-GROUP': '大巨集團',
    'COMP-BOSS': '林董私帳',
  };
  const allComps = getAllCompanies();
  return companyIds
    .map(cid => {
      const found = allComps.find(c => c.id === cid);
      return found ? (found.shortName || found.name) : (fallbackMap[cid] || cid);
    })
    .join('、');
}

function formatCompanyGroupAssignmentsCn(assignments?: CompanyGroupAssignment[]): string {
  if (!assignments || assignments.length === 0) return '未設定 (採全域業務群組)';
  const allComps = getAllCompanies();
  const allGroups = getAllUserGroups();
  return assignments.map(a => {
    const comp = allComps.find(c => c.id === a.companyId);
    const compName = comp ? (comp.shortName || comp.name) : a.companyId;
    const groupNames = a.groupIds.map(gid => {
      const g = allGroups.find(grp => grp.id === gid);
      return g ? g.groupName : gid;
    }).join('+');
    return `[${compName}: ${groupNames || '無指派'}]`;
  }).join('、');
}

// 自動將逾期 7 天之冷卻同仁轉入 Superadmin 封存區
export function autoArchiveExpiredUsers(): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) return;
  try {
    const nowIso = new Date().toISOString();
    const check = dbInstance.exec(`
      SELECT id, fullName, username FROM users 
      WHERE deleteStage = 'PENDING_DELETE' AND purgeDueAt IS NOT NULL AND purgeDueAt <= '${nowIso}';
    `);
    if (check.length > 0 && check[0].values.length > 0) {
      for (const row of check[0].values) {
        const uId = String(row[0]);
        const uName = String(row[1]);
        dbInstance.run(`
          UPDATE users 
          SET deleteStage = 'ARCHIVED', 
              stageNotes = '7日冷卻期屆滿，系統自動轉入 Superadmin 封存區'
          WHERE id = '${uId}';
        `);
        logAudit(
          dbInstance,
          '系統排程',
          '自動封存',
          '同仁帳號',
          uName,
          { '帳號生命週期': '待刪除回收站 (7日冷卻)' },
          { '帳號生命週期': '深度封存區 (冷卻期滿自動移交)' },
          '系統排程'
        );
      }
      saveDatabaseSnapshot();
    }
  } catch (e) {
    console.error('autoArchiveExpiredUsers error', e);
  }
}

// 讀取所有人員帳號 (自動執行冷卻逾期審查與讀取三態生命週期欄位)
export function getAllUsers(): User[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  autoArchiveExpiredUsers();
  const res = dbInstance.exec(`
    SELECT id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, groupId, groupIds, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, lastLoginAt, createdAt, updatedAt, deleteStage, stageDeletedAt, purgeDueAt, deletedBy, stageNotes, canManageAllCompanies, companyGroupAssignments 
    FROM users 
    ORDER BY CASE role WHEN 'SUPERADMIN' THEN 1 WHEN 'BOSS' THEN 2 WHEN 'ADMIN' THEN 3 ELSE 4 END, id ASC;
  `);
  if (!res.length) return [];
  return res[0].values.map(v => {
    let groupIds: string[] = [];
    if (v[9]) {
      try {
        const parsed = JSON.parse(String(v[9]));
        if (Array.isArray(parsed)) groupIds = parsed;
      } catch (e) {}
    }
    const groupId = v[8] ? String(v[8]) : undefined;
    if (groupIds.length === 0 && groupId) {
      groupIds = [groupId];
    }
    let companyGroupAssignments: CompanyGroupAssignment[] = [];
    if (v[25]) {
      try {
        const parsed = JSON.parse(String(v[25]));
        if (Array.isArray(parsed)) companyGroupAssignments = parsed;
      } catch (e) {}
    }
    return {
      id: String(v[0]),
      username: String(v[1]),
      fullName: String(v[2]),
      email: String(v[3] || ''),
      role: String(v[4]) as User['role'],
      canManageUsers: Boolean(v[5]),
      canManageSystemConfigs: Boolean(v[6]),
      canManageAdmins: Boolean(v[7]),
      canManageAllCompanies: Boolean(v[24]),
      groupId: groupId || groupIds[0],
      groupIds,
      companyGroupAssignments,
      status: (v[10] || 'ACTIVE') as User['status'],
      title: v[11] ? String(v[11]) : undefined,
      allowedCompanies: v[12] ? JSON.parse(String(v[12])) : ['COMP-01'],
      defaultCompanyId: String(v[13] || 'COMP-01'),
      passwordHash: v[14] ? String(v[14]) : '888888',
      isPasswordReset: Boolean(v[15]),
      lastLoginAt: v[16] ? String(v[16]) : undefined,
      createdAt: String(v[17] || ''),
      updatedAt: String(v[18] || ''),
      deleteStage: (v[19] || 'ACTIVE') as User['deleteStage'],
      stageDeletedAt: v[20] ? String(v[20]) : undefined,
      purgeDueAt: v[21] ? String(v[21]) : undefined,
      deletedBy: v[22] ? String(v[22]) : undefined,
      stageNotes: v[23] ? String(v[23]) : undefined
    };
  });
}

// 同仁自主修改個人密碼 (輸入原始密碼 + 兩次新密碼驗證)
export function changeSelfPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  if (!newPassword || newPassword.length < 6) {
    throw new Error('新密碼長度至少需為 6 個字元！');
  }

  if (newPassword !== confirmPassword) {
    throw new Error('兩次輸入的新密碼不相符，請重新確認！');
  }

  const check = dbInstance.exec(`SELECT id, username, fullName, passwordHash FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const user = check[0].values[0];
  const fullName = String(user[2]);
  const dbPass = String(user[3] || '888888');

  if (dbPass !== currentPassword) {
    throw new Error('原始密碼輸入錯誤，請重新確認！');
  }

  const now = new Date().toISOString().substring(0, 10);
  const cleanPass = newPassword.replace(/'/g, "''");
  dbInstance.run(`
    UPDATE users SET passwordHash = '${cleanPass}', isPasswordReset = 0, updatedAt = '${now}' WHERE id = '${userId}';
  `);

  logAudit(
    dbInstance,
    fullName,
    '修改個人密碼',
    '同仁帳號',
    fullName,
    { '登入密碼': '原個人密碼' },
    { '登入密碼': '已自主更新為新密碼' },
    fullName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 建立使用者帳號 (需具備帳號管理專人權限；階層原則防呆)
export function createUser(
  newUser: {
    username: string;
    fullName: string;
    email: string;
    role: UserRole;
    canManageUsers?: boolean;
    canManageSystemConfigs?: boolean;
    canManageAdmins?: boolean;
    canManageAllCompanies?: boolean;
    groupId?: string;
    groupIds?: string[];
    companyGroupAssignments?: CompanyGroupAssignment[];
    title?: string;
    allowedCompanies?: string[];
    defaultCompanyId?: string;
    password?: string;
  },
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean
): User {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const isPrivilegedOperator = operatorRole === 'SUPERADMIN' || operatorRole === 'BOSS';

  // 帳號管理專人權限檢核
  if (!isPrivilegedOperator && !operatorCanManageUsers) {
    throw new Error('無帳號管理專人權限：系統帳號維護需由最高統裁 (BOSS) 或指定專人 Admin 始得操作！');
  }

  if ((newUser.role as string) === 'SUPERADMIN') {
    throw new Error('憲法防呆：系統僅允許一位 Superadmin，禁止直接建立第二位 Superadmin！若需移交請使用「最高權限交接」流程。');
  }

  if ((newUser.role as string) === 'BOSS' && operatorRole !== 'SUPERADMIN') {
    throw new Error('企業防禦防呆：企業最高統裁 (集團董事長 BOSS) 具備唯一性，不得重複建立！');
  }

  // 階層原則：一般 Admin 只能建立下一階 User，除非經 BOSS 或 Superadmin 授權同階管理特許
  if (newUser.role === 'ADMIN' && !isPrivilegedOperator && !operatorCanManageAdmins) {
    throw new Error('階層權限受限：您尚未取得授予之【同階管理特許 (canManageAdmins)】，依規定只能建立下一階層 (User) 業務同仁，無法新增同階 Admin 帳號！');
  }

  const selectedGroupIds = newUser.groupIds && newUser.groupIds.length > 0
    ? newUser.groupIds
    : (newUser.groupId ? [newUser.groupId] : []);

  if (newUser.role === 'USER' && selectedGroupIds.length === 0 && (!newUser.companyGroupAssignments || newUser.companyGroupAssignments.length === 0)) {
    throw new Error('一般同仁帳號必須至少指派一個所屬業務群組或設定跨法人業務矩陣！');
  }

  // 檢查帳號重複
  const check = dbInstance.exec(`SELECT id FROM users WHERE username = '${newUser.username.replace(/'/g, "''")}';`);
  if (check.length > 0 && check[0].values.length > 0) {
    throw new Error(`帳號 ${newUser.username} 已存在，請使用其他帳號！`);
  }

  // 檢查特許授權權限 (只有 Superadmin 或 BOSS 可開啟特許)
  const canManageUserMgr = (isPrivilegedOperator && newUser.role === 'ADMIN' && Boolean(newUser.canManageUsers)) ? 1 : 0;
  const canManageConfigs = (isPrivilegedOperator && newUser.role === 'ADMIN' && Boolean(newUser.canManageSystemConfigs)) ? 1 : 0;
  const canManagePeers = (isPrivilegedOperator && newUser.role === 'ADMIN' && Boolean(newUser.canManageAdmins)) ? 1 : 0;
  const canManageAllComps = (isPrivilegedOperator && newUser.role === 'ADMIN' && Boolean(newUser.canManageAllCompanies)) ? 1 : 0;

  const id = `USR-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  const now = new Date().toISOString().substring(0, 10);
  const title = newUser.title ? `'${newUser.title.replace(/'/g, "''")}'` : 'NULL';
  const primaryGroupId = selectedGroupIds[0] ? `'${selectedGroupIds[0]}'` : 'NULL';
  const groupIdsJson = `'${JSON.stringify(selectedGroupIds)}'`;
  const matrixJson = `'${JSON.stringify(newUser.companyGroupAssignments || []).replace(/'/g, "''")}'`;
  const comps = newUser.allowedCompanies && newUser.allowedCompanies.length > 0 ? newUser.allowedCompanies : ['COMP-01', 'COMP-02'];
  const compsJson = `'${JSON.stringify(comps)}'`;
  const defComp = newUser.defaultCompanyId || comps[0] || 'COMP-01';
  const pass = (newUser.password || '888888').replace(/'/g, "''");

  dbInstance.run(`
    INSERT INTO users (id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, canManageAllCompanies, groupId, groupIds, companyGroupAssignments, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, createdAt, updatedAt)
    VALUES ('${id}', '${newUser.username.replace(/'/g, "''")}', '${newUser.fullName.replace(/'/g, "''")}', '${(newUser.email || '').replace(/'/g, "''")}', '${newUser.role}', ${canManageUserMgr}, ${canManageConfigs}, ${canManagePeers}, ${canManageAllComps}, ${primaryGroupId}, ${groupIdsJson}, ${matrixJson}, 'ACTIVE', ${title}, ${compsJson}, '${defComp}', '${pass}', 0, '${now}', '${now}');
  `);

  const createSummary: Record<string, string> = {
    '同仁姓名': newUser.fullName,
    '權限角色': formatRoleCn(newUser.role),
    '職務職稱': newUser.title || '未填寫',
    '授權營運法人': resolveCompanyNamesCn(comps),
  };
  if (newUser.role === 'USER') {
    createSummary['所屬業務群組'] = resolveGroupNamesCn(selectedGroupIds);
    if (newUser.companyGroupAssignments && newUser.companyGroupAssignments.length > 0) {
      createSummary['跨法人業務授權矩陣'] = formatCompanyGroupAssignmentsCn(newUser.companyGroupAssignments);
    }
  } else {
    if (canManageUserMgr) createSummary['帳號管理專人特許'] = '開啟';
    if (canManageConfigs) createSummary['全域核心參數特許'] = '開啟';
    if (canManagePeers) createSummary['同階管理員維護特許'] = '開啟';
    if (canManageAllComps) createSummary['全集團跨法人管理特許'] = '開啟';
  }

  logAudit(dbInstance, operatorName, '新增資料', '同仁帳號', newUser.fullName, undefined, createSummary, operatorName);

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    username: newUser.username,
    fullName: newUser.fullName,
    email: newUser.email,
    role: newUser.role,
    canManageUsers: Boolean(canManageUserMgr),
    canManageSystemConfigs: Boolean(canManageConfigs),
    canManageAdmins: Boolean(canManagePeers),
    canManageAllCompanies: Boolean(canManageAllComps),
    groupId: selectedGroupIds[0],
    groupIds: selectedGroupIds,
    companyGroupAssignments: newUser.companyGroupAssignments || [],
    status: 'ACTIVE',
    title: newUser.title,
    allowedCompanies: comps,
    defaultCompanyId: defComp,
    passwordHash: pass,
    isPasswordReset: false,
    createdAt: now,
    updatedAt: now
  };
}

// 更新使用者帳號 (含帳號管理專人、階層原則與 canManageAdmins 防呆保護，且僅記錄實際有修改之欄位)
export function updateUser(
  updateData: {
    id: string;
    fullName?: string;
    email?: string;
    role?: UserRole;
    canManageUsers?: boolean;
    canManageSystemConfigs?: boolean;
    canManageAdmins?: boolean;
    canManageAllCompanies?: boolean;
    groupId?: string | null;
    groupIds?: string[];
    companyGroupAssignments?: CompanyGroupAssignment[];
    allowedCompanies?: string[];
    defaultCompanyId?: string;
    status?: 'ACTIVE' | 'DISABLED';
    title?: string;
  },
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean,
  currentOperatorId?: string
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  // 安全防呆：禁止操作者將當前登入之自身帳號停用（防範自殺式停權）
  if (currentOperatorId && currentOperatorId === updateData.id && updateData.status === 'DISABLED') {
    throw new Error('【安全防呆防護】系統嚴禁將當前正在登入操作中之自身帳號設為停用！');
  }

  const isPrivilegedOperator = operatorRole === 'SUPERADMIN' || operatorRole === 'BOSS';

  // 帳號管理專人權限檢核
  if (!isPrivilegedOperator && !operatorCanManageUsers) {
    throw new Error('無帳號管理專人權限：系統帳號維護需由最高統裁 (BOSS) 或指定專人 Admin 始得操作！');
  }

  // 取得原目標帳號完整資料以便精準比對修改差異
  const currentRes = dbInstance.exec(`
    SELECT id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, groupId, groupIds, status, title, allowedCompanies, defaultCompanyId, canManageAllCompanies, companyGroupAssignments 
    FROM users WHERE id = '${updateData.id}';
  `);
  if (!currentRes.length || !currentRes[0].values.length) {
    throw new Error('找不到指定帳號！');
  }

  const oldRow = currentRes[0].values[0];
  const oldFullName = String(oldRow[2] || '');
  const oldEmail = String(oldRow[3] || '');
  const targetRole = String(oldRow[4] || 'USER');
  const oldCanManageUsers = Boolean(oldRow[5]);
  const oldCanManageConfigs = Boolean(oldRow[6]);
  const oldCanManageAdmins = Boolean(oldRow[7]);
  const oldCanManageAllCompanies = Boolean(oldRow[14]);
  let oldGroupIds: string[] = [];
  try {
    if (oldRow[9]) oldGroupIds = JSON.parse(String(oldRow[9]));
  } catch (e) {}
  if (oldGroupIds.length === 0 && oldRow[8]) oldGroupIds = [String(oldRow[8])];
  let oldCompanyGroupAssignments: CompanyGroupAssignment[] = [];
  try {
    if (oldRow[15]) oldCompanyGroupAssignments = JSON.parse(String(oldRow[15]));
  } catch (e) {}
  const oldStatus = String(oldRow[10] || 'ACTIVE');
  const oldTitle = String(oldRow[11] || '');
  let oldAllowedComps: string[] = ['COMP-01'];
  try {
    if (oldRow[12]) oldAllowedComps = JSON.parse(String(oldRow[12]));
  } catch (e) {}
  const oldDefaultComp = String(oldRow[13] || 'COMP-01');

  // 憲法防呆：一般 Admin / BOSS 不得變更 Superadmin 帳號
  if (targetRole === 'SUPERADMIN' && operatorRole !== 'SUPERADMIN') {
    throw new Error('憲法保護防禦：除架構師本人外，其他人無權修改 Superadmin 帳號！');
  }

  // 👑 BOSS 金身護體防護：除 Superadmin 或 BOSS 本人外，一般 Admin 絕對無權修改 BOSS 帳號
  if (targetRole === 'BOSS' && operatorRole !== 'SUPERADMIN' && operatorRole !== 'BOSS') {
    throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 帳號具備最高決策金身護體，一般管理員無權修改其資料！');
  }

  // 階層防呆：若目標帳號為其他同階 ADMIN，且操作者非 SUPERADMIN、非 BOSS 且無同階管理特許 (canManageAdmins)
  if (targetRole === 'ADMIN' && updateData.id !== currentOperatorId && !isPrivilegedOperator && !operatorCanManageAdmins) {
    throw new Error('階層權限受限：您尚未取得授予之【同階管理特許】，依規定只能管理一般同仁 (User)，無法修改其他系統管理員 (Admin) 帳號！');
  }

  // 階層防呆：若試圖將角色改為 ADMIN，且操作者非 SUPERADMIN、非 BOSS 且無同階管理特許
  if (updateData.role === 'ADMIN' && targetRole !== 'ADMIN' && !isPrivilegedOperator && !operatorCanManageAdmins) {
    throw new Error('階層權限受限：您無權將同仁角色提升為 Admin，需由最高統裁授權同階管理特許！');
  }

  // 憲法防呆：Superadmin 不能被停用或直接被降級 (必須透過交接)
  if (targetRole === 'SUPERADMIN') {
    if (updateData.status === 'DISABLED') {
      throw new Error('憲法保護防禦：唯一的最高 Superadmin 具備不可停用保護！');
    }
    if (updateData.role && (updateData.role as string) !== 'SUPERADMIN') {
      throw new Error('憲法保護防禦：最高 Superadmin 不可直接降級，必須透過最高權限交接！');
    }
  }

  // 👑 BOSS 金身護體防呆：BOSS 不能被停用或降級
  if (targetRole === 'BOSS') {
    if (updateData.status === 'DISABLED') {
      throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 具備不可停用金身護體保護！');
    }
    if (updateData.role && updateData.role !== 'BOSS') {
      throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 職位不可被降級！');
    }
  }

  // 憲法防呆：不可將任何使用者直接變更為 SUPERADMIN 或 BOSS
  if ((updateData.role as string) === 'SUPERADMIN' && targetRole !== 'SUPERADMIN') {
    throw new Error('系統禁止直接賦予 SUPERADMIN 角色，必須由現任 Superadmin 執行交接程序！');
  }
  if (updateData.role === 'BOSS' && targetRole !== 'BOSS') {
    throw new Error('系統禁止直接賦予 BOSS 角色，企業最高統裁帳號具備唯一性！');
  }

  const updates: string[] = [];
  const now = new Date().toISOString().substring(0, 10);
  updates.push(`updatedAt = '${now}'`);

  // 準備記錄有實際修改之欄位 (純中文對照)
  const beforeDiff: Record<string, string> = {};
  const afterDiff: Record<string, string> = {};

  if (updateData.fullName !== undefined) {
    const trimmed = updateData.fullName.trim();
    updates.push(`fullName = '${trimmed.replace(/'/g, "''")}'`);
    if (trimmed !== oldFullName) {
      beforeDiff['同仁姓名'] = oldFullName;
      afterDiff['同仁姓名'] = trimmed;
    }
  }
  if (updateData.email !== undefined) {
    const trimmed = updateData.email.trim();
    updates.push(`email = '${trimmed.replace(/'/g, "''")}'`);
    if (trimmed !== oldEmail) {
      beforeDiff['電子信箱'] = oldEmail || '未填寫';
      afterDiff['電子信箱'] = trimmed || '未填寫';
    }
  }
  if (updateData.title !== undefined) {
    const trimmed = updateData.title.trim();
    updates.push(`title = '${trimmed.replace(/'/g, "''")}'`);
    if (trimmed !== oldTitle) {
      beforeDiff['職務職稱'] = oldTitle || '未填寫';
      afterDiff['職務職稱'] = trimmed || '未填寫';
    }
  }
  if (updateData.status !== undefined) {
    updates.push(`status = '${updateData.status}'`);
    if (updateData.status !== oldStatus) {
      beforeDiff['帳號狀態'] = formatStatusCn(oldStatus);
      afterDiff['帳號狀態'] = formatStatusCn(updateData.status);
    }
  }
  if (updateData.role !== undefined) {
    updates.push(`role = '${updateData.role}'`);
    if (updateData.role !== targetRole) {
      beforeDiff['權限角色'] = formatRoleCn(targetRole);
      afterDiff['權限角色'] = formatRoleCn(updateData.role);
    }
  }

  // 角色變更與特許授權防護：
  const effectiveRole = updateData.role !== undefined ? updateData.role : targetRole;
  if (updateData.role === 'USER') {
    // 當同仁身分被設定/降級為 USER 時，原子化自動收回並歸零所有管理特許項目
    updates.push(`canManageUsers = 0`);
    updates.push(`canManageSystemConfigs = 0`);
    updates.push(`canManageAdmins = 0`);
    if (oldCanManageUsers) {
      beforeDiff['帳號管理專人特許'] = '開啟';
      afterDiff['帳號管理專人特許'] = '關閉 (隨降級自動收回)';
    }
    if (oldCanManageConfigs) {
      beforeDiff['全域核心參數特許'] = '開啟';
      afterDiff['全域核心參數特許'] = '關閉 (隨降級自動收回)';
    }
    if (oldCanManageAdmins) {
      beforeDiff['同階管理員維護特許'] = '開啟';
      afterDiff['同階管理員維護特許'] = '關閉 (隨降級自動收回)';
    }
  } else if (isPrivilegedOperator) {
    // 系統最高 Superadmin 與企業最高統裁 BOSS 擁有授予及調整 Admin 進階特許之權力
    if (updateData.canManageUsers !== undefined) {
      updates.push(`canManageUsers = ${updateData.canManageUsers ? 1 : 0}`);
      if (Boolean(updateData.canManageUsers) !== oldCanManageUsers) {
        beforeDiff['帳號管理專人特許'] = oldCanManageUsers ? '開啟' : '關閉';
        afterDiff['帳號管理專人特許'] = updateData.canManageUsers ? '開啟' : '關閉';
      }
    }
    if (updateData.canManageSystemConfigs !== undefined) {
      updates.push(`canManageSystemConfigs = ${updateData.canManageSystemConfigs ? 1 : 0}`);
      if (Boolean(updateData.canManageSystemConfigs) !== oldCanManageConfigs) {
        beforeDiff['全域核心參數特許'] = oldCanManageConfigs ? '開啟' : '關閉';
        afterDiff['全域核心參數特許'] = updateData.canManageSystemConfigs ? '開啟' : '關閉';
      }
    }
    if (updateData.canManageAdmins !== undefined) {
      updates.push(`canManageAdmins = ${updateData.canManageAdmins ? 1 : 0}`);
      if (Boolean(updateData.canManageAdmins) !== oldCanManageAdmins) {
        beforeDiff['同階管理員維護特許'] = oldCanManageAdmins ? '開啟' : '關閉';
        afterDiff['同階管理員維護特許'] = updateData.canManageAdmins ? '開啟' : '關閉';
      }
    }
    if (updateData.canManageAllCompanies !== undefined) {
      updates.push(`canManageAllCompanies = ${updateData.canManageAllCompanies ? 1 : 0}`);
      if (Boolean(updateData.canManageAllCompanies) !== oldCanManageAllCompanies) {
        beforeDiff['全集團跨法人管理特許'] = oldCanManageAllCompanies ? '開啟' : '關閉';
        afterDiff['全集團跨法人管理特許'] = updateData.canManageAllCompanies ? '開啟' : '關閉';
      }
    }
  } else {
    // 非 Superadmin / BOSS 操作者：若試圖開啟特許則強制攔截，若未試圖開啟則自動忽略防禦性阻擋
    if (updateData.canManageUsers || updateData.canManageSystemConfigs || updateData.canManageAdmins || updateData.canManageAllCompanies) {
      throw new Error('憲法權限防護：唯獨最高 Superadmin 或企業最高統裁 (BOSS) 才有權限授予管理員進階特許！');
    }
  }

  if (updateData.allowedCompanies !== undefined) {
    updates.push(`allowedCompanies = '${JSON.stringify(updateData.allowedCompanies)}'`);
    const oldCompKey = [...oldAllowedComps].sort().join(',');
    const newCompKey = [...updateData.allowedCompanies].sort().join(',');
    if (oldCompKey !== newCompKey) {
      beforeDiff['授權營運法人'] = resolveCompanyNamesCn(oldAllowedComps);
      afterDiff['授權營運法人'] = resolveCompanyNamesCn(updateData.allowedCompanies);
    }
  }
  if (updateData.defaultCompanyId !== undefined) {
    updates.push(`defaultCompanyId = '${updateData.defaultCompanyId}'`);
    if (updateData.defaultCompanyId !== oldDefaultComp) {
      beforeDiff['預設登入法人'] = resolveCompanyNamesCn([oldDefaultComp]);
      afterDiff['預設登入法人'] = resolveCompanyNamesCn([updateData.defaultCompanyId]);
    }
  }

  if (updateData.groupIds !== undefined) {
    const jsonStr = JSON.stringify(updateData.groupIds);
    updates.push(`groupIds = '${jsonStr}'`);
    if (updateData.groupIds.length > 0) {
      updates.push(`groupId = '${updateData.groupIds[0]}'`);
    } else {
      updates.push(`groupId = NULL`);
    }
    const oldGrpKey = [...oldGroupIds].sort().join(',');
    const newGrpKey = [...updateData.groupIds].sort().join(',');
    if (oldGrpKey !== newGrpKey && (effectiveRole === 'USER' || targetRole === 'USER')) {
      beforeDiff['所屬業務群組'] = resolveGroupNamesCn(oldGroupIds);
      afterDiff['所屬業務群組'] = resolveGroupNamesCn(updateData.groupIds);
    }
  } else if (updateData.groupId !== undefined) {
    updates.push(updateData.groupId ? `groupId = '${updateData.groupId}'` : `groupId = NULL`);
    updates.push(updateData.groupId ? `groupIds = '["${updateData.groupId}"]'` : `groupIds = '[]'`);
    const newArr = updateData.groupId ? [updateData.groupId] : [];
    const oldGrpKey = [...oldGroupIds].sort().join(',');
    const newGrpKey = [...newArr].sort().join(',');
    if (oldGrpKey !== newGrpKey && (effectiveRole === 'USER' || targetRole === 'USER')) {
      beforeDiff['所屬業務群組'] = resolveGroupNamesCn(oldGroupIds);
      afterDiff['所屬業務群組'] = resolveGroupNamesCn(newArr);
    }
  }

  if (updateData.companyGroupAssignments !== undefined) {
    const matJson = JSON.stringify(updateData.companyGroupAssignments).replace(/'/g, "''");
    updates.push(`companyGroupAssignments = '${matJson}'`);
    const oldMatKey = JSON.stringify(oldCompanyGroupAssignments || []);
    const newMatKey = JSON.stringify(updateData.companyGroupAssignments || []);
    if (oldMatKey !== newMatKey && (effectiveRole === 'USER' || targetRole === 'USER')) {
      beforeDiff['跨法人業務授權矩陣'] = formatCompanyGroupAssignmentsCn(oldCompanyGroupAssignments);
      afterDiff['跨法人業務授權矩陣'] = formatCompanyGroupAssignmentsCn(updateData.companyGroupAssignments);
    }
  }

  dbInstance.run(`
    UPDATE users SET ${updates.join(', ')} WHERE id = '${updateData.id}';
  `);

  // 僅在實際有欄位發生變更時才寫入審計日誌
  if (Object.keys(afterDiff).length > 0) {
    logAudit(
      dbInstance,
      operatorName,
      '修改資料',
      '同仁帳號',
      updateData.fullName?.trim() || oldFullName,
      beforeDiff,
      afterDiff,
      operatorName
    );
  }

  saveDatabaseSnapshot();
  notifyListeners();
}

// 快速切換特定 Admin 之帳號管理專人特許 (Superadmin 與 BOSS 均可操作)
export function toggleAdminUserManagerPrivilege(
  userId: string,
  canManage: boolean,
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string
): void {
  updateUser({ id: userId, canManageUsers: canManage }, operatorRole, operatorName, true, true);
}

// 快速切換特定 Admin 之全域核心參數維護特許 (Superadmin 與 BOSS 均可操作)
export function toggleAdminConfigPrivilege(
  userId: string,
  canManage: boolean,
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string
): void {
  updateUser({ id: userId, canManageSystemConfigs: canManage }, operatorRole, operatorName, true, true);
}

// 快速切換特定 Admin 之同階管理特許 (Superadmin 與 BOSS 均可操作)
export function toggleAdminPeerPrivilege(
  userId: string,
  canManage: boolean,
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string
): void {
  updateUser({ id: userId, canManageAdmins: canManage }, operatorRole, operatorName, true, true);
}

// 重設同仁密碼 (需具備帳號管理專人權限；支援自訂新密碼或套用預設安全密碼)
export function resetUserPassword(
  userId: string,
  newPassword: string,
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const isPrivilegedOperator = operatorRole === 'SUPERADMIN' || operatorRole === 'BOSS';

  // 帳號管理專人權限檢核：非所有 Admin 都能重設他人密碼
  if (!isPrivilegedOperator && !operatorCanManageUsers) {
    throw new Error('無重設他人密碼權限：他人密碼只能由最高統裁 (BOSS) 特別指定之帳號管理專人 Admin 執行重設！');
  }

  const check = dbInstance.exec(`SELECT id, role, fullName FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const role = check[0].values[0][1] as string;
  const fullName = String(check[0].values[0][2]);

  if (role === 'SUPERADMIN' && operatorRole !== 'SUPERADMIN') {
    throw new Error('憲法保護防禦：除架構師本人外，其他人無權重設系統最高 Superadmin 密碼！');
  }

  if (role === 'BOSS' && operatorRole !== 'SUPERADMIN' && operatorRole !== 'BOSS') {
    throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 密碼不可由一般管理員重設！');
  }

  if (role === 'ADMIN' && !isPrivilegedOperator && !operatorCanManageAdmins) {
    throw new Error('階層權限受限：您尚未取得授予之【同階管理特許】，無法重設其他系統管理員 (Admin) 之密碼！');
  }

  const now = new Date().toISOString().substring(0, 10);
  const cleanPass = newPassword.replace(/'/g, "''");
  dbInstance.run(`
    UPDATE users SET passwordHash = '${cleanPass}', isPasswordReset = 1, updatedAt = '${now}' WHERE id = '${userId}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '重設密碼',
    '同仁帳號',
    fullName,
    { '密碼狀態': '原密碼' },
    { '密碼狀態': '已由管理員重設密碼' },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 快速切換同仁啟用/停用狀態 (需具備帳號管理專人權限)
export function toggleUserStatus(
  userId: string,
  newStatus: 'ACTIVE' | 'DISABLED',
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean,
  currentOperatorId?: string
): void {
  if (currentOperatorId && currentOperatorId === userId && newStatus === 'DISABLED') {
    throw new Error('【安全防呆防護】系統嚴禁將當前正在登入操作中之自身帳號設為停用！');
  }
  updateUser({ id: userId, status: newStatus }, operatorRole, operatorName, operatorCanManageUsers, operatorCanManageAdmins, currentOperatorId);
}
