import type { Database } from 'sql.js';
import type { AuditLog } from '../../types/erp';
import { getDbInstance, notifyListeners, saveDatabaseSnapshot } from '../core/dbContext';

// 讀取審計日誌 (預設支援最多 300 筆，最新優先)
export function getAllAuditLogs(limit: number = 300): AuditLog[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT ${limit};`);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    userId: String(v[1]),
    userName: String(v[2]),
    action: String(v[3]),
    targetTable: String(v[4]),
    targetId: String(v[5]),
    beforeJson: v[6] ? String(v[6]) : undefined,
    afterJson: v[7] ? String(v[7]) : undefined,
    ipAddress: String(v[8]),
    createdAt: String(v[9]),
  }));
}

// 寫入審計日誌 helper
export function logAudit(
  db: Database,
  userName: string,
  action: AuditLog['action'] | string,
  targetTable: string,
  targetId: string,
  before?: object,
  after?: object,
  userId?: string
): void {
  const id = `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const beforeJson = before ? JSON.stringify(before).replace(/'/g, "''") : null;
  const afterJson = after ? JSON.stringify(after).replace(/'/g, "''") : null;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const safeUser = (userId || userName || '系統操作員').replace(/'/g, "''");

  db.run(`
    INSERT INTO audit_logs (id, userId, userName, action, targetTable, targetId, beforeJson, afterJson, ipAddress, createdAt)
    VALUES ('${id}', '${safeUser}', '${userName.replace(/'/g, "''")}', '${action}', '${targetTable}', '${targetId.replace(/'/g, "''")}', 
      ${beforeJson ? `'${beforeJson}'` : 'NULL'}, ${afterJson ? `'${afterJson}'` : 'NULL'}, '公司內網', '${now}');
  `);
}

// 供外部元件呼叫寫入操作日誌 (例如登入或身分切換、系統事件)
export function recordAuditLog(
  userName: string,
  action: string,
  targetTable: string,
  targetId: string,
  details?: object,
  userId?: string
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) return;
  logAudit(dbInstance, userName, action, targetTable, targetId, undefined, details, userId);
  saveDatabaseSnapshot();
  notifyListeners();
}
