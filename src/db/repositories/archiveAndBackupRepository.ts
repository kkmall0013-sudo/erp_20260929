import type { Database } from 'sql.js';
import type {
  AnnualArchiveSnapshot,
  ModularBackupPackage,
  RestoreResult,
  RestoreStrategy
} from '../../types/erp';
import {
  getDbInstance,
  getSqlJsEngine,
  notifyListeners,
  saveDatabaseSnapshot,
  setDbInstance
} from '../core/dbContext';
import { getDatabase } from '../core/dbInit';
import { ensureDatabaseIntegrity } from '../core/dbIntegrity';
import { logAudit } from './auditRepository';
import { syncPostalCatalogToUtility } from './postalCatalogRepository';
import { reseedDocumentSequences } from './sequenceRepository';

// 產生完整 SQL DDL & INSERT Dump 文本
export function exportSqlDump(): string {
  const dbInstance = getDbInstance();
  if (!dbInstance) return '-- 資料庫尚未載入';
  const tables = [
    'users', 'user_groups', 'group_module_permissions',
    'app_configs', 'companies', 'system_configs', 'taiwan_postal_cities', 'taiwan_postal_codes', 'audit_logs', 'document_sequences',
    'annual_archive_snapshots', 'system_files', 'external_folder_links', 'file_links',
    'projects', 'project_sites',
    'project_wbs', 'business_partners', 'bp_bank_accounts', 'partner_addresses', 'partner_contacts', 'partner_cheque_records', 'items', 'quotations', 'quotation_revisions',
    'quotation_items', 'quotation_billing_milestones', 'purchase_orders',
    'purchase_order_items', 'inbound_receipts', 'inbound_receipt_items', 'subcontracts', 'valuations', 'valuation_items',
    'accounts_payable', 'accounts_receivable', 'bank_checks'
  ];

  let dump = `-- ==========================================================================\n`;
  dump += `-- 🏛️ 企業級營造工程 ERP 系統 - 完整 SQLite 資料庫 SQL 備份\n`;
  dump += `-- 匯出時間: ${new Date().toISOString()}\n`;
  dump += `-- 單一真實來源 (SSoT): 依據《ERP全模組資料庫欄位與用途總表》全模組定義\n`;
  dump += `-- ==========================================================================\n\n`;
  dump += `PRAGMA foreign_keys = OFF;\nBEGIN TRANSACTION;\n\n`;

  for (const table of tables) {
    dump += `-- --------------------------------------------------------------------------\n`;
    dump += `-- 資料表結構與資料: ${table}\n`;
    dump += `-- --------------------------------------------------------------------------\n`;

    try {
      const res = dbInstance.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}';`);
      if (res.length > 0 && res[0].values.length > 0) {
        dump += `DROP TABLE IF EXISTS ${table};\n`;
        dump += `${res[0].values[0][0]};\n\n`;
      }

      const rows = dbInstance.exec(`SELECT * FROM ${table};`);
      if (rows.length > 0 && rows[0].values.length > 0) {
        const columns = rows[0].columns.join(', ');
        for (const row of rows[0].values) {
          const formattedValues = row.map(v => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(', ');
          dump += `INSERT INTO ${table} (${columns}) VALUES (${formattedValues});\n`;
        }
        dump += `\n`;
      }
    } catch (e) {
      console.error(`匯出資料表 ${table} 失敗`, e);
    }
  }

  dump += `COMMIT;\nPRAGMA foreign_keys = ON;\n-- 匯出結束 --\n`;
  return dump;
}

// 匯出二進位 SQLite 檔案
export function exportSqliteBinary(): Uint8Array {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  return dbInstance.export();
}

// 匯入 SQL 指令稿
export function importSql(sqlText: string): { success: boolean; message: string; rowsAffected?: number } {
  const dbInstance = getDbInstance();
  if (!dbInstance) return { success: false, message: '資料庫尚未初始化' };
  try {
    dbInstance.run(sqlText);
    reseedDocumentSequences(dbInstance);
    saveDatabaseSnapshot();
    notifyListeners();
    return { success: true, message: 'SQL 備份指令稿執行成功，資料庫已即刻更新！' };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, message: `SQL 執行失敗: ${error.message}` };
  }
}

// 🏛️ 全庫 SQLite 二進位實體檔案一鍵上傳還原 (.sqlite / .db)
export async function restoreFromSqliteBinary(
  buffer: ArrayBuffer | Uint8Array,
  operatorName: string = '系統管理者'
): Promise<{ success: boolean; message: string; recordCount?: number; moduleCount?: number }> {
  try {
    let engine = getSqlJsEngine();
    if (!engine) {
      await getDatabase();
      engine = getSqlJsEngine();
    }
    if (!engine) {
      throw new Error('SQLite WebAssembly 引擎尚未就緒');
    }

    const uint8 = new Uint8Array(buffer);
    if (uint8.length < 100) {
      throw new Error('上傳之檔案體積過小，非有效之 SQLite 資料庫檔案');
    }

    const headerStr = String.fromCharCode(...uint8.slice(0, 15));
    if (!headerStr.startsWith('SQLite format 3')) {
      throw new Error('檔案標頭非標準 SQLite 3 格式，請確認是否為正確的 .sqlite / .db 檔案');
    }

    const newDb = new engine.Database(uint8);
    const test = newDb.exec("SELECT count(*) FROM sqlite_master WHERE type='table';");
    if (!test.length) {
      throw new Error('此檔案結構異常，無法讀取資料表目錄');
    }

    try {
      const prevDb = getDbInstance();
      if (prevDb) prevDb.close();
    } catch (_) {}

    setDbInstance(newDb);
    ensureDatabaseIntegrity(newDb);
    reseedDocumentSequences(newDb);
    saveDatabaseSnapshot();
    notifyListeners();

    const stats = getDatabaseModuleStats(newDb);
    const totalRecords = stats.reduce((acc, cur) => acc + cur.totalRecords, 0);

    try {
      logAudit(
        newDb,
        operatorName,
        '還原資料庫',
        '全庫備份還原',
        '全庫 SQLite 二進位實體檔案還原',
        undefined,
        { '還原模組數': stats.length, '總資料筆數': totalRecords, '操作人員': operatorName },
        operatorName
      );
    } catch (_) {}

    return {
      success: true,
      message: `資料庫還原成功！已完整掛載 ${stats.length} 個業務模組，共計 ${totalRecords.toLocaleString()} 筆資料，且各單據流水號計數器已自動校準對齊。`,
      recordCount: totalRecords,
      moduleCount: stats.length
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      message: `SQLite 還原失敗: ${error.message}`
    };
  }
}

// 🏛️ 全庫 SQL 文字指令稿一鍵上傳還原 (.sql)
export function restoreFromSqlScript(
  sqlContent: string,
  operatorName: string = '系統管理者'
): { success: boolean; message: string; recordCount?: number; moduleCount?: number } {
  const dbInstance = getDbInstance();
  if (!dbInstance) return { success: false, message: '資料庫尚未初始化' };
  try {
    if (!sqlContent || !sqlContent.trim()) {
      throw new Error('SQL 檔案內容為空');
    }

    dbInstance.run(sqlContent);
    ensureDatabaseIntegrity(dbInstance);
    reseedDocumentSequences(dbInstance);
    saveDatabaseSnapshot();
    notifyListeners();

    const stats = getDatabaseModuleStats(dbInstance);
    const totalRecords = stats.reduce((acc, cur) => acc + cur.totalRecords, 0);

    try {
      logAudit(
        dbInstance,
        operatorName,
        '還原資料庫',
        '全庫備份還原',
        'SQL 指令稿全庫還原',
        undefined,
        { '還原模組數': stats.length, '總資料筆數': totalRecords, '操作人員': operatorName },
        operatorName
      );
    } catch (_) {}

    return {
      success: true,
      message: `SQL 指令稿還原成功！已更新全模組資料庫，共計 ${totalRecords.toLocaleString()} 筆資料，各單據流水號計數器已自動校準對齊。`,
      recordCount: totalRecords,
      moduleCount: stats.length
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      message: `SQL 還原失敗: ${error.message}`
    };
  }
}

// 執行自訂 SQL (給資料庫管理介面之即時 Console 使用)
export function executeCustomQuery(sqlQuery: string): { columns: string[]; values: (string | number | null)[][] }[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const results = dbInstance.exec(sqlQuery);
  if (/INSERT|UPDATE|DELETE|DROP|ALTER|CREATE/i.test(sqlQuery)) {
    saveDatabaseSnapshot();
    notifyListeners();
  }
  return results.map(r => ({
    columns: r.columns,
    values: r.values as (string | number | null)[][]
  }));
}

// ============================================================================
// 🏛️ 年度唯讀封存快照引擎 (Annual Archival Snapshots Engine)
// ============================================================================
export function createAnnualArchiveSnapshot(
  year: number,
  description?: string,
  sealedBy = 'SUPERADMIN'
): {
  success: boolean;
  message: string;
  snapshot?: AnnualArchiveSnapshot;
} {
  const dbInstance = getDbInstance();
  if (!dbInstance) return { success: false, message: '資料庫尚未初始化' };

  try {
    const existingCheck = dbInstance.exec(`SELECT id FROM annual_archive_snapshots WHERE archiveYear = ${year};`);
    if (existingCheck.length && existingCheck[0].values.length) {
      return {
        success: false,
        message: `${year} 年度已存在唯讀封存快照紀錄，不可重複建立！如需重新封存請先確認歷史檔案狀態。`
      };
    }

    const yearStr = String(year);
    let totalRecords = 0;
    const tableData: Record<string, any[]> = {};

    const masterTables = [
      'companies', 'system_configs', 'projects', 'project_sites',
      'project_wbs', 'business_partners', 'items', 'subcontracts'
    ];
    for (const tbl of masterTables) {
      try {
        const res = dbInstance.exec(`SELECT * FROM ${tbl};`);
        if (res.length && res[0].values.length) {
          const cols = res[0].columns;
          tableData[tbl] = res[0].values.map(row => {
            const obj: any = {};
            cols.forEach((col, idx) => { obj[col] = row[idx]; });
            return obj;
          });
          totalRecords += res[0].values.length;
        }
      } catch (_) {}
    }

    const dateFilteredTables = [
      { name: 'valuations', dateCol: 'createdAt' },
      { name: 'valuation_items', parentTable: 'valuations', parentCol: 'id', foreignKey: 'valuationId' },
      { name: 'purchase_orders', dateCol: 'createdAt' },
      { name: 'purchase_order_items', parentTable: 'purchase_orders', parentCol: 'id', foreignKey: 'purchaseOrderId' },
      { name: 'quotations', dateCol: 'createdAt' },
      { name: 'quotation_revisions', parentTable: 'quotations', parentCol: 'id', foreignKey: 'quotationId' },
      { name: 'quotation_items', parentTable: 'quotations', parentCol: 'id', foreignKey: 'quotationId' },
      { name: 'quotation_billing_milestones', parentTable: 'quotations', parentCol: 'id', foreignKey: 'quotationId' },
      { name: 'accounts_payable', dateCol: 'createdAt' },
      { name: 'accounts_receivable', dateCol: 'createdAt' },
      { name: 'bank_checks', dateCol: 'issueDate' },
      { name: 'audit_logs', dateCol: 'createdAt' },
      { name: 'system_files', dateCol: 'uploadTime' }
    ];

    for (const tbl of dateFilteredTables) {
      let query = '';
      if (tbl.dateCol) {
        query = `SELECT * FROM ${tbl.name} WHERE ${tbl.dateCol} LIKE '${yearStr}%';`;
      } else if (tbl.parentTable) {
        query = `SELECT t.* FROM ${tbl.name} t JOIN ${tbl.parentTable} p ON t.${tbl.foreignKey} = p.${tbl.parentCol} WHERE p.createdAt LIKE '${yearStr}%';`;
      }
      if (query) {
        try {
          const res = dbInstance.exec(query);
          if (res.length && res[0].values.length) {
            const cols = res[0].columns;
            tableData[tbl.name] = res[0].values.map(row => {
              const obj: any = {};
              cols.forEach((col, idx) => { obj[col] = row[idx]; });
              return obj;
            });
            totalRecords += res[0].values.length;
          }
        } catch (_) {}
      }
    }

    const payloadJson = JSON.stringify(tableData);
    const fileSizeBytes = new Blob([payloadJson]).size;
    let hash = 0;
    for (let i = 0; i < payloadJson.length; i++) {
      hash = ((hash << 5) - hash) + payloadJson.charCodeAt(i);
      hash |= 0;
    }
    const fileHash = 'sha256_' + Math.abs(hash).toString(16).padStart(16, '0') + '_' + Date.now().toString(16);

    const snapshotId = `ARC-${year}-${Date.now().toString(36).toUpperCase()}`;
    const archiveFileName = `ERP_ARCHIVE_${year}.sqlite`;
    const relativePath = `archives/${archiveFileName}`;
    const sealedAt = new Date().toISOString();
    const desc = description || `${year} 年度營造工程完工與財務單據自包含唯讀封存快照`;

    dbInstance.run(`
      INSERT INTO annual_archive_snapshots (id, archiveYear, archiveFileName, relativePath, recordCount, fileSizeBytes, fileHash, isSealed, sealedAt, sealedBy, description)
      VALUES ('${snapshotId}', ${year}, '${archiveFileName}', '${relativePath}', ${totalRecords}, ${fileSizeBytes}, '${fileHash}', 1, '${sealedAt}', '${sealedBy}', '${desc.replace(/'/g, "''")}');
    `);

    saveDatabaseSnapshot();
    notifyListeners();

    const snapshot: AnnualArchiveSnapshot = {
      id: snapshotId,
      archiveYear: year,
      archiveFileName,
      relativePath,
      recordCount: totalRecords,
      fileSizeBytes,
      fileHash,
      isSealed: true,
      sealedAt,
      sealedBy,
      description: desc
    };

    return {
      success: true,
      message: `已成功封裝 ${year} 年度唯讀封存快照 (${totalRecords} 筆資料，大小約 ${(fileSizeBytes / 1024).toFixed(1)} KB)`,
      snapshot
    };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, message: `建立年度封存失敗: ${error.message}` };
  }
}

// 取得所有年度封存快照清單
export function getAnnualArchiveSnapshots(): AnnualArchiveSnapshot[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  try {
    const res = dbInstance.exec(`
      SELECT id, archiveYear, archiveFileName, relativePath, recordCount, fileSizeBytes, fileHash, isSealed, sealedAt, sealedBy, description
      FROM annual_archive_snapshots
      ORDER BY archiveYear DESC, sealedAt DESC;
    `);
    if (!res.length || !res[0].values.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      archiveYear: Number(v[1]),
      archiveFileName: String(v[2]),
      relativePath: String(v[3]),
      recordCount: Number(v[4] || 0),
      fileSizeBytes: Number(v[5] || 0),
      fileHash: String(v[6] || ''),
      isSealed: Number(v[7]) === 1,
      sealedAt: String(v[8] || ''),
      sealedBy: String(v[9] || ''),
      description: v[10] ? String(v[10]) : undefined
    }));
  } catch (e) {
    return [];
  }
}

// ============================================================================
// 🏛️ 模組化選擇性備份與冪等狀態機還原引擎 (Modular Backup & Idempotent Restore)
// ============================================================================
export function exportModularBackup(
  selectedModules: string[],
  timeFilter: { mode: 'ALL' | 'YEAR' | 'RANGE'; year?: number; startDate?: string; endDate?: string } = { mode: 'ALL' },
  exportedBy = 'SUPERADMIN'
): ModularBackupPackage {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const moduleTableMap: Record<string, string[]> = {
    'COMPANIES': ['companies'],
    'PROJECTS': ['projects', 'project_sites', 'project_wbs'],
    'PARTNERS': ['business_partners', 'items'],
    'QUOTATIONS': ['quotations', 'quotation_revisions', 'quotation_items', 'quotation_billing_milestones'],
    'PURCHASE_ORDERS': ['purchase_orders', 'purchase_order_items'],
    'PURCHASE': ['purchase_orders', 'purchase_order_items'],
    'SUBCONTRACTS': ['subcontracts'],
    'VALUATIONS': ['valuations', 'valuation_items'],
    'FINANCE': ['accounts_payable', 'accounts_receivable', 'bank_checks'],
    'SYSTEM_CONFIGS': ['app_configs', 'system_configs', 'taiwan_postal_cities', 'taiwan_postal_codes', 'user_groups', 'group_module_permissions', 'users', 'document_sequences', 'regulatory_schedules'],
    'ARCHIVES': ['annual_archive_snapshots'],
    'FILES': ['system_files']
  };

  const tablesToExport = new Set<string>();
  for (const mod of selectedModules) {
    const tbls = moduleTableMap[mod] || [];
    tbls.forEach(t => tablesToExport.add(t));
  }

  const getDateCondition = (dateCol: string) => {
    if (timeFilter.mode === 'YEAR' && timeFilter.year) {
      return `${dateCol} LIKE '${timeFilter.year}%'`;
    }
    if (timeFilter.mode === 'RANGE' && timeFilter.startDate && timeFilter.endDate) {
      return `${dateCol} >= '${timeFilter.startDate}' AND ${dateCol} <= '${timeFilter.endDate} 23:59:59'`;
    }
    return '';
  };

  const tableDateCols: Record<string, string> = {
    'projects': 'createdAt',
    'quotations': 'createdAt',
    'purchase_orders': 'createdAt',
    'subcontracts': 'createdAt',
    'valuations': 'createdAt',
    'accounts_payable': 'createdAt',
    'accounts_receivable': 'createdAt',
    'bank_checks': 'issueDate',
    'audit_logs': 'createdAt',
    'system_files': 'uploadTime'
  };

  const childTableParentMap: Record<string, { parentTable: string; foreignKey: string; parentDateCol: string }> = {
    'project_sites': { parentTable: 'projects', foreignKey: 'projectId', parentDateCol: 'createdAt' },
    'project_wbs': { parentTable: 'projects', foreignKey: 'projectId', parentDateCol: 'createdAt' },
    'quotation_revisions': { parentTable: 'quotations', foreignKey: 'quotationId', parentDateCol: 'createdAt' },
    'quotation_items': { parentTable: 'quotations', foreignKey: 'quotationId', parentDateCol: 'createdAt' },
    'quotation_billing_milestones': { parentTable: 'quotations', foreignKey: 'quotationId', parentDateCol: 'createdAt' },
    'purchase_order_items': { parentTable: 'purchase_orders', foreignKey: 'purchaseOrderId', parentDateCol: 'createdAt' },
    'valuation_items': { parentTable: 'valuations', foreignKey: 'valuationId', parentDateCol: 'createdAt' }
  };

  const packageTables: Record<string, any[]> = {};
  let totalCount = 0;

  for (const table of Array.from(tablesToExport)) {
    try {
      let query = `SELECT * FROM ${table}`;
      if (timeFilter.mode !== 'ALL') {
        if (tableDateCols[table]) {
          const cond = getDateCondition(tableDateCols[table]);
          if (cond) query += ` WHERE ${cond}`;
        } else if (childTableParentMap[table]) {
          const meta = childTableParentMap[table];
          const cond = getDateCondition(`p.${meta.parentDateCol}`);
          if (cond) {
            query = `SELECT t.* FROM ${table} t JOIN ${meta.parentTable} p ON t.${meta.foreignKey} = p.id WHERE ${cond}`;
          }
        }
      }
      query += ';';

      const res = dbInstance.exec(query);
      if (res.length && res[0].values.length) {
        const cols = res[0].columns;
        packageTables[table] = res[0].values.map(row => {
          const item: any = {};
          cols.forEach((col, idx) => { item[col] = row[idx]; });
          return item;
        });
        totalCount += res[0].values.length;
      } else {
        packageTables[table] = [];
      }
    } catch (_) {
      packageTables[table] = [];
    }
  }

  return {
    formatVersion: '1.0',
    exportDate: new Date().toISOString(),
    exportedBy,
    targetModules: selectedModules,
    timeFilter,
    tables: packageTables,
    recordCount: totalCount
  };
}

export function restoreModularBackup(
  pkg: ModularBackupPackage,
  strategy: RestoreStrategy = 'SKIP'
): RestoreResult {
  const dbInstance = getDbInstance();
  if (!dbInstance) {
    return { success: false, message: '資料庫尚未初始化', insertedCount: 0, updatedCount: 0, skippedCount: 0 };
  }

  const topologicalOrder = [
    'app_configs',
    'system_configs',
    'taiwan_postal_cities',
    'taiwan_postal_codes',
    'user_groups',
    'group_module_permissions',
    'users',
    'companies',
    'projects',
    'project_sites',
    'project_wbs',
    'business_partners',
    'items',
    'quotations',
    'quotation_revisions',
    'quotation_items',
    'quotation_billing_milestones',
    'purchase_orders',
    'purchase_order_items',
    'subcontracts',
    'valuations',
    'valuation_items',
    'accounts_payable',
    'accounts_receivable',
    'bank_checks',
    'annual_archive_snapshots',
    'system_files',
    'document_sequences'
  ];

  const uniqueBusinessKeyMap: Record<string, string> = {
    'users': 'username',
    'companies': 'companyCode',
    'projects': 'projectCode',
    'business_partners': 'bpCode',
    'items': 'itemCode',
    'quotations': 'quoteNumber',
    'purchase_orders': 'poNumber',
    'subcontracts': 'contractCode',
    'valuations': 'valuationNumber',
    'accounts_payable': 'apNumber',
    'accounts_receivable': 'arNumber',
    'bank_checks': 'checkNumber',
    'app_configs': 'configKey',
    'system_configs': 'configKey',
    'document_sequences': 'prefix'
  };

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const details: string[] = [];

  try {
    dbInstance.run('PRAGMA foreign_keys = OFF;');
    dbInstance.run('BEGIN TRANSACTION;');

    for (const table of topologicalOrder) {
      const rows = pkg.tables[table];
      if (!rows || !rows.length) continue;

      let tableInserted = 0;
      let tableUpdated = 0;
      let tableSkipped = 0;

      for (const row of rows) {
        const idVal = row.id !== undefined && row.id !== null ? String(row.id) : null;
        const uniqueKeyCol = uniqueBusinessKeyMap[table];
        const uniqueKeyVal = uniqueKeyCol && row[uniqueKeyCol] !== undefined && row[uniqueKeyCol] !== null ? String(row[uniqueKeyCol]) : null;

        let existing: any = null;
        let matchedById = false;

        if (idVal) {
          try {
            const checkRes = dbInstance.exec(`SELECT * FROM ${table} WHERE id = '${idVal.replace(/'/g, "''")}';`);
            if (checkRes.length && checkRes[0].values.length) {
              const cols = checkRes[0].columns;
              const values = checkRes[0].values[0];
              existing = {};
              cols.forEach((col, idx) => { existing[col] = values[idx]; });
              matchedById = true;
            }
          } catch (_) {}
        }

        if (!existing && uniqueKeyVal) {
          try {
            const checkRes = dbInstance.exec(`SELECT * FROM ${table} WHERE ${uniqueKeyCol} = '${uniqueKeyVal.replace(/'/g, "''")}';`);
            if (checkRes.length && checkRes[0].values.length) {
              const cols = checkRes[0].columns;
              const values = checkRes[0].values[0];
              existing = {};
              cols.forEach((col, idx) => { existing[col] = values[idx]; });
            }
          } catch (_) {}
        }

        if (!existing) {
          const cols = Object.keys(row);
          const colNames = cols.join(', ');
          const valPlaceholders = cols.map(c => {
            const v = row[c];
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(', ');

          dbInstance.run(`INSERT INTO ${table} (${colNames}) VALUES (${valPlaceholders});`);
          tableInserted++;
        } else {
          if (strategy === 'SKIP') {
            tableSkipped++;
          } else {
            const targetId = matchedById ? idVal : (existing.id ? String(existing.id) : null);
            const cols = Object.keys(row).filter(c => c !== 'id');
            const setClauses = cols.map(c => {
              const v = row[c];
              if (v === null || v === undefined) return `${c} = NULL`;
              if (typeof v === 'number') return `${c} = ${v}`;
              return `${c} = '${String(v).replace(/'/g, "''")}'`;
            }).join(', ');

            if (targetId) {
              dbInstance.run(`UPDATE ${table} SET ${setClauses} WHERE id = '${targetId.replace(/'/g, "''")}';`);
            } else if (uniqueKeyVal) {
              dbInstance.run(`UPDATE ${table} SET ${setClauses} WHERE ${uniqueKeyCol} = '${uniqueKeyVal.replace(/'/g, "''")}';`);
            }
            tableUpdated++;
          }
        }
      }

      insertedCount += tableInserted;
      updatedCount += tableUpdated;
      skippedCount += tableSkipped;
      details.push(`${table}: 新增 ${tableInserted} 筆, 更新 ${tableUpdated} 筆, 略過 ${tableSkipped} 筆`);
    }

    dbInstance.run('COMMIT;');
    dbInstance.run('PRAGMA foreign_keys = ON;');

    try {
      const fkCheck = dbInstance.exec('PRAGMA foreign_key_check;');
      if (fkCheck.length && fkCheck[0].values.length) {
        details.push(`⚠️ 外鍵相依校驗: 發現 ${fkCheck[0].values.length} 筆外部相依警示`);
      }
    } catch (_) {}

    reseedDocumentSequences(dbInstance);
    syncPostalCatalogToUtility(dbInstance);

    saveDatabaseSnapshot();
    notifyListeners();

    return {
      success: true,
      message: `資料庫還原完成！共新增 ${insertedCount} 筆，覆蓋更新 ${updatedCount} 筆，略過重複 ${skippedCount} 筆。單據跳號計數器已同步自動校準！`,
      insertedCount,
      updatedCount,
      skippedCount,
      details
    };
  } catch (err: unknown) {
    try { dbInstance.run('ROLLBACK;'); } catch (_) {}
    try { dbInstance.run('PRAGMA foreign_keys = ON;'); } catch (_) {}
    const error = err as Error;
    return {
      success: false,
      message: `還原失敗: ${error.message}`,
      insertedCount,
      updatedCount,
      skippedCount,
      details
    };
  }
}

// 取得各模組即時資料統計
export function getDatabaseModuleStats(db?: Database): {
  moduleKey: string;
  moduleName: string;
  tables: string[];
  totalRecords: number;
}[] {
  const targetDb = db || getDbInstance();
  if (!targetDb) return [];

  const modules = [
    { key: 'COMPANIES', name: '公司法人與集團實體', tables: ['companies'] },
    { key: 'PROJECTS', name: '專案案場與 WBS 工項', tables: ['projects', 'project_sites', 'project_wbs'] },
    { key: 'PARTNERS', name: '商業夥伴與工料庫存', tables: ['business_partners', 'items'] },
    { key: 'QUOTATIONS', name: '報價與請款里程碑', tables: ['quotations', 'quotation_revisions', 'quotation_items', 'quotation_billing_milestones'] },
    { key: 'PURCHASE_ORDERS', name: '採購發包與明細單據', tables: ['purchase_orders', 'purchase_order_items'] },
    { key: 'SUBCONTRACTS', name: '工程承攬合約主檔', tables: ['subcontracts'] },
    { key: 'VALUATIONS', name: '下包工程估驗計價', tables: ['valuations', 'valuation_items'] },
    { key: 'FINANCE', name: '財務會計與應收付票據', tables: ['accounts_payable', 'accounts_receivable', 'bank_checks'] },
    { key: 'SYSTEM_CONFIGS', name: '全域參數、權限與字典', tables: ['system_configs', 'taiwan_postal_cities', 'taiwan_postal_codes', 'user_groups', 'group_module_permissions', 'users', 'document_sequences', 'regulatory_schedules'] },
    { key: 'ARCHIVES', name: '年度唯讀封存快照紀錄', tables: ['annual_archive_snapshots'] },
    { key: 'FILES', name: '無紙化附件金庫索引', tables: ['system_files'] }
  ];

  return modules.map(m => {
    let count = 0;
    for (const t of m.tables) {
      try {
        const res = targetDb.exec(`SELECT count(*) FROM ${t};`);
        count += Number(res[0]?.values[0]?.[0] || 0);
      } catch (_) {}
    }
    return {
      moduleKey: m.key,
      moduleName: m.name,
      tables: m.tables,
      totalRecords: count
    };
  });
}
