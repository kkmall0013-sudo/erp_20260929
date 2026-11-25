import type { Database, SqlJsStatic } from 'sql.js';

declare global {
  interface Window {
    initSqlJs?: (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;
  }
}

let sqlJsEngine: SqlJsStatic | null = null;
let dbInstance: Database | null = null;
const listeners = new Set<() => void>();

export function getSqlJsEngine(): SqlJsStatic | null {
  return sqlJsEngine;
}

export function setSqlJsEngine(engine: SqlJsStatic | null): void {
  sqlJsEngine = engine;
}

export function getDbInstance(): Database | null {
  return dbInstance;
}

export function setDbInstance(db: Database | null): void {
  dbInstance = db;
}

export function notifyListeners(): void {
  listeners.forEach(fn => fn());
}

export function subscribeToDatabase(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// 儲存資料庫狀態至 localStorage
export function saveDatabaseSnapshot(): void {
  if (!dbInstance) return;
  if (typeof localStorage === 'undefined') return;
  try {
    const binary = dbInstance.export();
    const array = Array.from(binary);
    localStorage.setItem('engineering_erp_sqlite_db', JSON.stringify(array));
  } catch (e) {
    console.error('儲存本機 SQLite 快照失敗', e);
  }
}

export function parseJsonArraySafe<T>(raw: any): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function formatLocalDateIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
