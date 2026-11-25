import type {
  GroupModulePermission,
  ModuleKey,
  UserGroup
} from '../../types/erp';
import { SYSTEM_MODULES } from '../core/dbConstants';
import {
  getDbInstance,
  notifyListeners,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { logAudit } from './auditRepository';

// 讀取所有權限群組 (四大內建 + 自訂群組)
export function getAllUserGroups(): UserGroup[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const res = dbInstance.exec(`
    SELECT id, groupCode, groupName, description, isSystem, approvalLimit, canExport, createdAt, updatedAt 
    FROM user_groups 
    ORDER BY isSystem DESC, groupCode ASC;
  `);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    groupCode: String(v[1]),
    groupName: String(v[2]),
    description: String(v[3] || ''),
    isSystem: Boolean(v[4]),
    approvalLimit: Number(v[5] || 0),
    canExport: Boolean(v[6]),
    createdAt: String(v[7] || ''),
    updatedAt: String(v[8] || '')
  }));
}

// 讀取群組模組細項權限矩陣
export function getAllGroupPermissions(groupId?: string): GroupModulePermission[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const query = groupId
    ? `SELECT id, groupId, moduleKey, canRead, canWrite, canApprove, canExport FROM group_module_permissions WHERE groupId = '${groupId}';`
    : `SELECT id, groupId, moduleKey, canRead, canWrite, canApprove, canExport FROM group_module_permissions;`;
  const res = dbInstance.exec(query);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    groupId: String(v[1]),
    moduleKey: String(v[2]) as GroupModulePermission['moduleKey'],
    canRead: Boolean(v[3]),
    canWrite: Boolean(v[4]),
    canApprove: Boolean(v[5]),
    canExport: Boolean(v[6])
  }));
}

export function resolveGroupNamesCn(groupIds?: string[]): string {
  if (!groupIds || groupIds.length === 0) return '無';
  const fallbackMap: Record<string, string> = {
    'GRP-ENG': '工務組',
    'GRP-ACC': '財務會計組',
    'GRP-PURE-ACC': '專職會計組（僅管帳）',
    'GRP-CASHIER': '專職出納組（僅管錢）',
    'GRP-PROC': '採購發包組',
    'GRP-SALES': '專案業務組',
  };
  const allGroups = getAllUserGroups();
  return groupIds
    .map(gid => {
      const found = allGroups.find(g => g.id === gid);
      return found ? found.groupName : (fallbackMap[gid] || gid);
    })
    .join('、');
}

// 建立自訂群組與模組權限矩陣
export function createGroup(
  group: {
    groupCode: string;
    groupName: string;
    description: string;
    approvalLimit: number;
    canExport: boolean;
  },
  permissions: {
    moduleKey: ModuleKey;
    canRead: boolean;
    canWrite: boolean;
    canApprove: boolean;
    canExport: boolean;
  }[],
  operatorName: string
): UserGroup {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const check = dbInstance.exec(`SELECT id FROM user_groups WHERE groupCode = '${group.groupCode.replace(/'/g, "''")}';`);
  if (check.length > 0 && check[0].values.length > 0) {
    throw new Error(`群組代碼 ${group.groupCode} 已存在，請使用不同代碼！`);
  }

  const id = `GRP-${Date.now().toString().slice(-4)}`;
  const now = new Date().toISOString().substring(0, 10);

  dbInstance.run(`
    INSERT INTO user_groups (id, groupCode, groupName, description, isSystem, approvalLimit, canExport, createdAt, updatedAt)
    VALUES ('${id}', '${group.groupCode.replace(/'/g, "''")}', '${group.groupName.replace(/'/g, "''")}', '${group.description.replace(/'/g, "''")}', 0, ${group.approvalLimit}, ${group.canExport ? 1 : 0}, '${now}', '${now}');
  `);

  for (const p of permissions) {
    const permId = `PERM-${id}-${p.moduleKey}`;
    dbInstance.run(`
      INSERT INTO group_module_permissions (id, groupId, moduleKey, canRead, canWrite, canApprove, canExport)
      VALUES ('${permId}', '${id}', '${p.moduleKey}', ${p.canRead ? 1 : 0}, ${p.canWrite ? 1 : 0}, ${p.canApprove ? 1 : 0}, ${p.canExport ? 1 : 0});
    `);
  }

  logAudit(
    dbInstance,
    operatorName,
    '新增資料',
    '權限群組',
    group.groupName,
    undefined,
    {
      '群組名稱': group.groupName,
      '核准金額上限': `NT$ ${Number(group.approvalLimit || 0).toLocaleString()}`,
      '匯出報表權限': group.canExport ? '允許' : '禁止',
    },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    groupCode: group.groupCode,
    groupName: group.groupName,
    description: group.description,
    isSystem: false,
    approvalLimit: group.approvalLimit,
    canExport: group.canExport,
    createdAt: now,
    updatedAt: now
  };
}

// 更新群組與模組權限矩陣 (僅記錄有修改之群組屬性與模組權限，全中文呈現)
export function updateGroup(
  group: {
    id: string;
    groupName?: string;
    description?: string;
    approvalLimit?: number;
    canExport?: boolean;
  },
  permissions: {
    moduleKey: ModuleKey;
    canRead: boolean;
    canWrite: boolean;
    canApprove: boolean;
    canExport: boolean;
  }[] | undefined,
  operatorName: string
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const oldGroup = getAllUserGroups().find(g => g.id === group.id);
  const oldPerms = getAllGroupPermissions(group.id);
  const beforeDiff: Record<string, string> = {};
  const afterDiff: Record<string, string> = {};

  if (oldGroup) {
    if (group.groupName !== undefined && group.groupName !== oldGroup.groupName) {
      beforeDiff['群組名稱'] = oldGroup.groupName;
      afterDiff['群組名稱'] = group.groupName;
    }
    if (group.description !== undefined && group.description !== oldGroup.description) {
      beforeDiff['職責說明'] = oldGroup.description || '無';
      afterDiff['職責說明'] = group.description || '無';
    }
    if (group.approvalLimit !== undefined && Number(group.approvalLimit) !== Number(oldGroup.approvalLimit)) {
      beforeDiff['核准金額上限'] = `NT$ ${Number(oldGroup.approvalLimit).toLocaleString()}`;
      afterDiff['核准金額上限'] = `NT$ ${Number(group.approvalLimit).toLocaleString()}`;
    }
    if (group.canExport !== undefined && Boolean(group.canExport) !== Boolean(oldGroup.canExport)) {
      beforeDiff['全域匯出權限'] = oldGroup.canExport ? '允許' : '禁止';
      afterDiff['全域匯出權限'] = group.canExport ? '允許' : '禁止';
    }
  }

  const formatPermActionsCn = (p?: { canRead: boolean; canWrite: boolean; canApprove: boolean; canExport: boolean }) => {
    if (!p) return '無權限';
    const list: string[] = [];
    if (p.canRead) list.push('檢視');
    if (p.canWrite) list.push('編輯');
    if (p.canApprove) list.push('審批');
    if (p.canExport) list.push('匯出');
    return list.length > 0 ? list.join('、') : '無權限';
  };

  const now = new Date().toISOString().substring(0, 10);
  const updates: string[] = [`updatedAt = '${now}'`];

  if (group.groupName !== undefined) updates.push(`groupName = '${group.groupName.replace(/'/g, "''")}'`);
  if (group.description !== undefined) updates.push(`description = '${group.description.replace(/'/g, "''")}'`);
  if (group.approvalLimit !== undefined) updates.push(`approvalLimit = ${group.approvalLimit}`);
  if (group.canExport !== undefined) updates.push(`canExport = ${group.canExport ? 1 : 0}`);

  dbInstance.run(`UPDATE user_groups SET ${updates.join(', ')} WHERE id = '${group.id}';`);

  if (permissions) {
    for (const p of permissions) {
      const oldP = oldPerms.find(item => item.moduleKey === p.moduleKey);
      const oldPermStr = formatPermActionsCn(oldP);
      const newPermStr = formatPermActionsCn(p);
      if (oldPermStr !== newPermStr) {
        const modName = SYSTEM_MODULES.find(m => m.key === p.moduleKey)?.name || p.moduleKey;
        beforeDiff[`${modName}權限`] = oldPermStr;
        afterDiff[`${modName}權限`] = newPermStr;
      }

      const check = dbInstance.exec(`SELECT id FROM group_module_permissions WHERE groupId = '${group.id}' AND moduleKey = '${p.moduleKey}';`);
      if (check.length && check[0].values.length) {
        dbInstance.run(`
          UPDATE group_module_permissions
          SET canRead = ${p.canRead ? 1 : 0}, canWrite = ${p.canWrite ? 1 : 0}, canApprove = ${p.canApprove ? 1 : 0}, canExport = ${p.canExport ? 1 : 0}
          WHERE groupId = '${group.id}' AND moduleKey = '${p.moduleKey}';
        `);
      } else {
        const permId = `PERM-${group.id}-${p.moduleKey}`;
        dbInstance.run(`
          INSERT INTO group_module_permissions (id, groupId, moduleKey, canRead, canWrite, canApprove, canExport)
          VALUES ('${permId}', '${group.id}', '${p.moduleKey}', ${p.canRead ? 1 : 0}, ${p.canWrite ? 1 : 0}, ${p.canApprove ? 1 : 0}, ${p.canExport ? 1 : 0});
        `);
      }
    }
  }

  if (Object.keys(afterDiff).length > 0) {
    const grpDisplayName = group.groupName || oldGroup?.groupName || group.id;
    logAudit(dbInstance, operatorName, '修改資料', '權限群組', grpDisplayName, beforeDiff, afterDiff, operatorName);
  }
  saveDatabaseSnapshot();
  notifyListeners();
}

// 刪除自訂群組移至 rbacUserLifecycleRepository.ts（避免循環依賴）

// 快速切換群組在單一模組之讀/寫/審/出權限 (供 12 大模組權限矩陣即時點擊切換並記錄中文差異日誌)
export function toggleGroupModulePermission(
  groupId: string,
  moduleKey: ModuleKey,
  field: 'canRead' | 'canWrite' | 'canApprove' | 'canExport',
  operatorName: string
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const grp = getAllUserGroups().find(g => g.id === groupId);
  const mod = SYSTEM_MODULES.find(m => m.key === moduleKey);
  const currentPerms = getAllGroupPermissions(groupId);
  const existing = currentPerms.find(p => p.moduleKey === moduleKey) || {
    id: `PERM-${groupId}-${moduleKey}`,
    groupId,
    moduleKey,
    canRead: false,
    canWrite: false,
    canApprove: false,
    canExport: false,
  };

  const nextState = {
    canRead: existing.canRead,
    canWrite: existing.canWrite,
    canApprove: existing.canApprove,
    canExport: existing.canExport,
  };

  const nextVal = !existing[field];
  nextState[field] = nextVal;

  // 智慧防呆連動：若開啟「寫/審/出」，自動確保「讀 (canRead)」一併開啟；若關閉「讀」，自動關閉「寫/審/出」
  if (field !== 'canRead' && nextVal) {
    nextState.canRead = true;
  }
  if (field === 'canRead' && !nextVal) {
    nextState.canWrite = false;
    nextState.canApprove = false;
    nextState.canExport = false;
  }

  const check = dbInstance.exec(`SELECT id FROM group_module_permissions WHERE groupId = '${groupId}' AND moduleKey = '${moduleKey}';`);
  if (check.length && check[0].values.length) {
    dbInstance.run(`
      UPDATE group_module_permissions
      SET canRead = ${nextState.canRead ? 1 : 0},
          canWrite = ${nextState.canWrite ? 1 : 0},
          canApprove = ${nextState.canApprove ? 1 : 0},
          canExport = ${nextState.canExport ? 1 : 0}
      WHERE groupId = '${groupId}' AND moduleKey = '${moduleKey}';
    `);
  } else {
    dbInstance.run(`
      INSERT INTO group_module_permissions (id, groupId, moduleKey, canRead, canWrite, canApprove, canExport)
      VALUES ('PERM-${groupId}-${moduleKey}', '${groupId}', '${moduleKey}', ${nextState.canRead ? 1 : 0}, ${nextState.canWrite ? 1 : 0}, ${nextState.canApprove ? 1 : 0}, ${nextState.canExport ? 1 : 0});
    `);
  }

  const formatActions = (s: { canRead: boolean; canWrite: boolean; canApprove: boolean; canExport: boolean }) => {
    const arr: string[] = [];
    if (s.canRead) arr.push('檢視');
    if (s.canWrite) arr.push('編輯');
    if (s.canApprove) arr.push('審批');
    if (s.canExport) arr.push('匯出');
    return arr.length > 0 ? arr.join('、') : '無權限';
  };

  const oldStr = formatActions(existing);
  const newStr = formatActions(nextState);
  if (oldStr !== newStr) {
    const modName = mod?.name || moduleKey;
    const grpName = grp?.groupName || groupId;
    logAudit(
      dbInstance,
      operatorName,
      '修改資料',
      '權限群組',
      grpName,
      { [`${modName}權限`]: oldStr },
      { [`${modName}權限`]: newStr },
      operatorName
    );
  }

  saveDatabaseSnapshot();
  notifyListeners();
}
