import type { Database, SqlJsStatic } from 'sql.js';
import {
  getDbInstance,
  saveDatabaseSnapshot,
  setDbInstance,
  setSqlJsEngine
} from './dbContext';
import { ensureDatabaseIntegrity } from './dbIntegrity';
import { initializeTables } from './schemaOperations';
import { seedInitialData } from './dbSeed';
import { syncPostalCatalogToUtility } from '../repositories/postalCatalogRepository';

// 初始化 SQLite 資料庫
export async function getDatabase(): Promise<Database> {
  const existing = getDbInstance();
  if (existing) return existing;

  let SQL: SqlJsStatic;

  if (typeof window !== 'undefined') {
    let initFn = window.initSqlJs;
    if (!initFn) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/sql-wasm.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('無法載入 /sql-wasm.js'));
        document.head.appendChild(script);
      });
      initFn = window.initSqlJs;
    }

    if (!initFn) {
      throw new Error('SQLite WebAssembly 初始化引擎未就緒');
    }

    SQL = await initFn({
      locateFile: (file) => `/${file}`
    });
  } else {
    // Node.js / 測試環境相容模式
    const initSqlModule = (await import('sql.js')).default;
    SQL = await initSqlModule();
  }

  setSqlJsEngine(SQL);

  if (typeof localStorage !== 'undefined') {
    const savedDb = localStorage.getItem('engineering_erp_sqlite_db');
    if (savedDb) {
      try {
        const uInt8Array = new Uint8Array(JSON.parse(savedDb));
        const restored = new SQL.Database(uInt8Array);
        setDbInstance(restored);
        console.log('✅ 成功從本機快照還原 SQLite 資料庫');
        ensureDatabaseIntegrity(restored);
        return restored;
      } catch (e) {
        console.warn('⚠️ 舊快照載入失敗，將重新建置全新資料庫', e);
      }
    }
  }

  const freshDb = new SQL.Database();
  setDbInstance(freshDb);
  initializeTables(freshDb);
  seedInitialData(freshDb);
  syncPostalCatalogToUtility(freshDb);
  saveDatabaseSnapshot();
  return freshDb;
}
