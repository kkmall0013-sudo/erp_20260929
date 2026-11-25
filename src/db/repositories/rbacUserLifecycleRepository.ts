import type { User } from '../../types/erp';
import {
  getDbInstance,
  notifyListeners,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { logAudit } from './auditRepository';
import { resolveGroupNamesCn } from './rbacGroupRepository';
import { getAllUsers } from './rbacUserRepository';

// 第一階段：移入待刪除回收站（7 日冷卻期）
export function markUserPendingDelete(
  userId: string,
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean,
  reason?: string
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const isPrivilegedOperator = operatorRole === 'SUPERADMIN' || operatorRole === 'BOSS';

  // 帳號管理專人權限檢核
  if (!isPrivilegedOperator && !operatorCanManageUsers) {
    throw new Error('無帳號管理專人權限：刪除同仁帳號需由最高統裁 (BOSS) 或指定之專人 Admin 始得操作！');
  }

  const check = dbInstance.exec(`SELECT id, role, fullName, username, deleteStage FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const role = check[0].values[0][1] as string;
  const fullName = check[0].values[0][2] as string;
  const currentStage = check[0].values[0][4] as string;

  if (role === 'SUPERADMIN') {
    throw new Error('【憲法金身防護】系統唯一最高架構師 (Superadmin) 具備永久保護，嚴禁刪除！');
  }

  if (role === 'BOSS') {
    throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 具備不可撼動金身護體，嚴禁刪除！');
  }

  if (role === 'ADMIN' && !isPrivilegedOperator && !operatorCanManageAdmins) {
    throw new Error('階層權限受限：您尚未取得授予之【同階管理特許】，無法刪除其他系統管理員 (Admin) 帳號！');
  }

  if (currentStage === 'PENDING_DELETE') {
    throw new Error('此同仁帳號已在待刪除回收站中！');
  }
  if (currentStage === 'ARCHIVED') {
    throw new Error('此同仁帳號已在深度封存區中！');
  }

  const nowIso = new Date().toISOString();
  // 7 天冷卻期
  const purgeDueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const cleanReason = (reason || '管理員執行第一階段刪除，移入7日冷卻回收站').replace(/'/g, "''");

  dbInstance.run(`
    UPDATE users 
    SET deleteStage = 'PENDING_DELETE',
        stageDeletedAt = '${nowIso}',
        purgeDueAt = '${purgeDueAt}',
        deletedBy = '${operatorName.replace(/'/g, "''")}',
        stageNotes = '${cleanReason}',
        status = 'DISABLED'
    WHERE id = '${userId}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '移入回收站',
    '同仁帳號',
    fullName,
    { '帳號狀態': '啟用中 (正常在職)' },
    { '帳號狀態': '已停用 (移入待刪除回收站 7 日冷卻)' },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 刪除使用者帳號 (向下相容：自動呼叫第一階段刪除冷卻流程)
export function deleteUser(
  userId: string,
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean
): void {
  markUserPendingDelete(userId, operatorRole, operatorName, operatorCanManageUsers, operatorCanManageAdmins, '第一階段刪除至待刪除回收站');
}

// 待刪除回收站：一鍵復原回啟用主檔 (Admin 與 Superadmin 均可操作)
export function restorePendingUser(
  userId: string,
  operatorName: string
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const check = dbInstance.exec(`SELECT id, role, fullName, username, deleteStage FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const fullName = check[0].values[0][2] as string;

  dbInstance.run(`
    UPDATE users 
    SET deleteStage = 'ACTIVE',
        stageDeletedAt = NULL,
        purgeDueAt = NULL,
        deletedBy = NULL,
        stageNotes = NULL,
        status = 'ACTIVE'
    WHERE id = '${userId}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '復原帳號',
    '同仁帳號',
    fullName,
    { '帳號狀態': '待刪除回收站 (已停用)' },
    { '帳號狀態': '啟用中 (正常在職)' },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 待刪除回收站：提前手動二次刪除，轉入 Superadmin 專屬封存區
export function advanceUserToArchive(
  userId: string,
  operatorRole: 'SUPERADMIN' | 'BOSS' | 'ADMIN',
  operatorName: string,
  operatorCanManageUsers?: boolean,
  operatorCanManageAdmins?: boolean
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const isPrivilegedOperator = operatorRole === 'SUPERADMIN' || operatorRole === 'BOSS';

  if (!isPrivilegedOperator && !operatorCanManageUsers) {
    throw new Error('無帳號管理專人權限：操作需由最高統裁 (BOSS) 或指定專人 Admin 始得操作！');
  }

  const check = dbInstance.exec(`SELECT id, role, fullName, username, deleteStage FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const role = check[0].values[0][1] as string;
  const fullName = check[0].values[0][2] as string;

  if (role === 'SUPERADMIN') {
    throw new Error('【憲法金身防護】系統唯一最高架構師嚴禁封存！');
  }

  if (role === 'BOSS') {
    throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 具備不可撼動金身護體，嚴禁封存！');
  }

  if (role === 'ADMIN' && !isPrivilegedOperator && !operatorCanManageAdmins) {
    throw new Error('階層權限受限：您尚未取得授予之【同階管理特許】，無法變更其他系統管理員 (Admin) 狀態！');
  }

  const nowIso = new Date().toISOString();

  dbInstance.run(`
    UPDATE users 
    SET deleteStage = 'ARCHIVED',
        stageDeletedAt = '${nowIso}',
        deletedBy = '${operatorName.replace(/'/g, "''")}',
        stageNotes = '由管理員手動提前二次刪除，移交 Superadmin 深度封存區',
        status = 'DISABLED'
    WHERE id = '${userId}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '移入封存區',
    '同仁帳號',
    fullName,
    { '帳號狀態': '待刪除回收站 (7日冷卻)' },
    { '帳號狀態': '深度封存區 (提前二次刪除封存)' },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 深度封存區：Superadmin 終極救援復原回啟用主檔 (僅限 Superadmin)
export function superadminRestoreArchivedUser(
  userId: string,
  operatorName: string
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const check = dbInstance.exec(`SELECT id, role, fullName, username, deleteStage FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const fullName = check[0].values[0][2] as string;

  dbInstance.run(`
    UPDATE users 
    SET deleteStage = 'ACTIVE',
        stageDeletedAt = NULL,
        purgeDueAt = NULL,
        deletedBy = NULL,
        stageNotes = NULL,
        status = 'ACTIVE'
    WHERE id = '${userId}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '終極救回帳號',
    '同仁帳號',
    fullName,
    { '帳號狀態': '深度封存區 (已停用)' },
    { '帳號狀態': '啟用中 (正常在職)' },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 深度封存區：Superadmin 終極安全詞物理粉碎清除 (物理實體 DELETE，不可逆)
export function superadminPermanentPurge(
  userId: string,
  operatorName: string,
  confirmText: string
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  if (confirmText.trim() !== '確認永久物理清除') {
    throw new Error('安全防呆校驗失敗：安全確認詞不相符，無法執行永久物理清除！請輸入「確認永久物理清除」以資確認。');
  }

  const check = dbInstance.exec(`SELECT id, role, fullName, username, deleteStage FROM users WHERE id = '${userId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('帳號不存在！');
  }

  const role = check[0].values[0][1] as string;
  const fullName = check[0].values[0][2] as string;

  if (role === 'SUPERADMIN') {
    throw new Error('【憲法金身防護】系統唯一最高管理員 (Superadmin) 具備永久保護，嚴禁清除！');
  }

  if (role === 'BOSS') {
    throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 具備永久金身護體，嚴禁清除！');
  }

  dbInstance.run(`DELETE FROM users WHERE id = '${userId}';`);

  logAudit(
    dbInstance,
    operatorName,
    '永久物理清除',
    '同仁帳號',
    fullName,
    { '帳號狀態': '深度封存區' },
    { '帳號狀態': '已從資料庫永久抹除' },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 復原遭刪除之人員帳號 (Undo Restore)
export function restoreUser(
  user: User,
  operatorName: string
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const check = dbInstance.exec(`SELECT id FROM users WHERE id = '${user.id}';`);
  if (check.length > 0 && check[0].values.length > 0) {
    throw new Error(`同仁帳號 ${user.username} 仍存在，無須復原！`);
  }

  const title = user.title ? `'${user.title.replace(/'/g, "''")}'` : 'NULL';
  const primaryGroupId = user.groupId ? `'${user.groupId}'` : 'NULL';
  const groupIdsJson = `'${JSON.stringify(user.groupIds || (user.groupId ? [user.groupId] : []))}'`;
  const compsJson = `'${JSON.stringify(user.allowedCompanies || ['COMP-01'])}'`;
  const pass = (user.passwordHash || '888888').replace(/'/g, "''");
  const now = new Date().toISOString().substring(0, 10);

  dbInstance.run(`
    INSERT INTO users (id, username, fullName, email, role, canManageUsers, canManageSystemConfigs, canManageAdmins, groupId, groupIds, status, title, allowedCompanies, defaultCompanyId, passwordHash, isPasswordReset, createdAt, updatedAt)
    VALUES ('${user.id}', '${user.username.replace(/'/g, "''")}', '${user.fullName.replace(/'/g, "''")}', '${(user.email || '').replace(/'/g, "''")}', '${user.role}', ${user.canManageUsers ? 1 : 0}, ${user.canManageSystemConfigs ? 1 : 0}, ${user.canManageAdmins ? 1 : 0}, ${primaryGroupId}, ${groupIdsJson}, '${user.status || 'ACTIVE'}', ${title}, ${compsJson}, '${user.defaultCompanyId || 'COMP-01'}', '${pass}', ${user.isPasswordReset ? 1 : 0}, '${user.createdAt || now}', '${now}');
  `);

  logAudit(
    dbInstance,
    operatorName,
    '復原帳號',
    '同仁帳號',
    user.fullName,
    { '帳號狀態': '待刪除回收站' },
    { '帳號狀態': '啟用中 (正常在職)' },
    operatorName
  );

  saveDatabaseSnapshot();
  notifyListeners();
}

// 最高權限交接 (Transfer Superadmin)
export function transferSuperadmin(
  currentSuperadminId: string,
  targetUserId: string,
  operatorName: string
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  if (currentSuperadminId === targetUserId) {
    throw new Error('交接對象不能為當前 Superadmin 本身！');
  }

  const superCheck = dbInstance.exec(`SELECT id, fullName, role FROM users WHERE id = '${currentSuperadminId}';`);
  if (!superCheck.length || superCheck[0].values[0][2] !== 'SUPERADMIN') {
    throw new Error('只有當前最高 Superadmin 才有權限執行移轉程序！');
  }

  const targetCheck = dbInstance.exec(`SELECT id, fullName, role FROM users WHERE id = '${targetUserId}';`);
  if (!targetCheck.length || !targetCheck[0].values.length) {
    throw new Error('指定的交接對象不存在！');
  }

  const targetRole = String(targetCheck[0].values[0][2]);
  if (targetRole === 'BOSS') {
    throw new Error('【金身護體防護】企業最高統裁 (集團董事長 BOSS) 具備專屬統裁身分，不可讓渡為 Superadmin！');
  }

  const now = new Date().toISOString().substring(0, 10);
  const oldName = String(superCheck[0].values[0][1]);
  const newName = String(targetCheck[0].values[0][1]);

  dbInstance.run(`BEGIN TRANSACTION;`);
  try {
    dbInstance.run(`
      UPDATE users SET role = 'ADMIN', updatedAt = '${now}' WHERE id = '${currentSuperadminId}';
    `);
    dbInstance.run(`
      UPDATE users SET role = 'SUPERADMIN', groupId = NULL, updatedAt = '${now}' WHERE id = '${targetUserId}';
    `);
    dbInstance.run(`COMMIT;`);
  } catch (e) {
    dbInstance.run(`ROLLBACK;`);
    throw e;
  }

  logAudit(
    dbInstance,
    operatorName,
    '最高權限交接',
    '同仁帳號',
    newName,
    { '唯一最高管理者': oldName },
    { '唯一最高管理者': newName },
    operatorName
  );

  saveDatabaseSnapshot();
  notifyListeners();
}

// 刪除自訂群組 (防呆：四大系統群組禁止刪除、有成員之群組禁止刪除)
export function deleteGroup(groupId: string, operatorName: string): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const check = dbInstance.exec(`SELECT isSystem, groupName FROM user_groups WHERE id = '${groupId}';`);
  if (!check.length || !check[0].values.length) {
    throw new Error('群組不存在！');
  }

  if (Boolean(check[0].values[0][0])) {
    throw new Error('【憲法安全保護】系統預設四大核心業務群組（工務、財務、採購、業務）禁止刪除！');
  }

  const grpName = String(check[0].values[0][1]);
  const allUsers = getAllUsers();
  const members = allUsers.filter(u => u.groupId === groupId || (u.groupIds && u.groupIds.includes(groupId)));
  if (members.length > 0) {
    throw new Error(`無法刪除：尚有 ${members.length} 位同仁隸屬於此群組，請先移轉人員或解除群組指派再行刪除！`);
  }

  dbInstance.run(`DELETE FROM group_module_permissions WHERE groupId = '${groupId}';`);
  dbInstance.run(`DELETE FROM user_groups WHERE id = '${groupId}';`);

  logAudit(dbInstance, operatorName, '刪除資料', '權限群組', grpName, { '群組名稱': grpName }, { '群組狀態': '已刪除' }, operatorName);
  saveDatabaseSnapshot();
  notifyListeners();
}

// 指派同仁所屬單人群組 (向下相容)
export function assignUserGroup(userId: string, groupId: string, operatorName: string): void {
  assignUserGroups(userId, [groupId], operatorName);
}

// 指派同仁所屬多群組矩陣
export function assignUserGroups(userId: string, groupIds: string[], operatorName: string): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const targetUser = getAllUsers().find(u => u.id === userId);
  const oldGroupIds = targetUser?.groupIds || (targetUser?.groupId ? [targetUser.groupId] : []);
  const now = new Date().toISOString().substring(0, 10);
  const primary = groupIds.length > 0 ? `'${groupIds[0]}'` : 'NULL';
  const jsonStr = JSON.stringify(groupIds);
  dbInstance.run(`
    UPDATE users SET groupId = ${primary}, groupIds = '${jsonStr}', updatedAt = '${now}' WHERE id = '${userId}';
  `);
  if ([...oldGroupIds].sort().join(',') !== [...groupIds].sort().join(',')) {
    logAudit(
      dbInstance,
      operatorName,
      '修改資料',
      '同仁帳號',
      targetUser?.fullName || userId,
      { '所屬業務群組': resolveGroupNamesCn(oldGroupIds) },
      { '所屬業務群組': resolveGroupNamesCn(groupIds) },
      operatorName
    );
  }
  saveDatabaseSnapshot();
  notifyListeners();
}
