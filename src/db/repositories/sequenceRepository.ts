import type { Database } from 'sql.js';
import type {
  DocumentModuleSequenceStatus,
  DocumentSequence,
  DocumentSequenceRule
} from '../../types/erp';
import { getDbInstance, notifyListeners, saveDatabaseSnapshot } from '../core/dbContext';
import { DEFAULT_DOCUMENT_RULES } from '../core/dbConstants';
import { logAudit } from './auditRepository';

// 取得資料庫中指定前綴之現存最大流水號碼 (防重號探測核心)
export function getMaxExistingSequenceForPrefix(prefix: string, db?: Database): number {
  const targetDb = db || getDbInstance();
  if (!targetDb) return 0;

  const sequenceSources: { table: string; column: string }[] = [
    { table: 'purchase_orders', column: 'poNumber' },
    { table: 'inbound_receipts', column: 'receiptNumber' },
    { table: 'valuations', column: 'valuationNumber' },
    { table: 'quotations', column: 'quoteNumber' },
    { table: 'accounts_payable', column: 'apNumber' },
    { table: 'accounts_receivable', column: 'arNumber' },
    { table: 'bank_checks', column: 'checkNumber' },
    { table: 'projects', column: 'projectCode' },
    { table: 'subcontracts', column: 'contractCode' }
  ];

  let maxNum = 0;
  for (const src of sequenceSources) {
    try {
      const res = targetDb.exec(`
        SELECT ${src.column} 
        FROM ${src.table} 
        WHERE ${src.column} LIKE '${prefix}%';
      `);
      if (res.length && res[0].values.length) {
        for (const row of res[0].values) {
          const val = String(row[0] || '').trim();
          const match = val.match(/(\d+)$/);
          if (match) {
            const numPart = parseInt(match[1], 10);
            if (!isNaN(numPart) && numPart > maxNum) {
              maxNum = numPart;
            }
          }
        }
      }
    } catch (_) {
      // Table or column might not exist yet
    }
  }

  return maxNum;
}

// 🏛️ 單據跳號自癒校準 (Sequence Reseed Engine)
export function reseedDocumentSequences(db?: Database): void {
  const targetDb = db || getDbInstance();
  if (!targetDb) return;

  const sequenceSources: { table: string; column: string }[] = [
    { table: 'purchase_orders', column: 'poNumber' },
    { table: 'inbound_receipts', column: 'receiptNumber' },
    { table: 'valuations', column: 'valuationNumber' },
    { table: 'quotations', column: 'quoteNumber' },
    { table: 'accounts_payable', column: 'apNumber' },
    { table: 'accounts_receivable', column: 'arNumber' },
    { table: 'bank_checks', column: 'checkNumber' },
    { table: 'projects', column: 'projectCode' },
    { table: 'subcontracts', column: 'contractCode' }
  ];

  for (const src of sequenceSources) {
    try {
      const res = targetDb.exec(`SELECT ${src.column} FROM ${src.table} WHERE ${src.column} IS NOT NULL;`);
      if (res.length && res[0].values.length) {
        for (const row of res[0].values) {
          const val = String(row[0] || '').trim();
          const lastDash = val.lastIndexOf('-');
          if (lastDash > 0) {
            const prefix = val.substring(0, lastDash);
            const numPart = parseInt(val.substring(lastDash + 1), 10);
            if (!isNaN(numPart) && numPart > 0) {
              const now = new Date().toISOString();
              targetDb.run(`
                INSERT INTO document_sequences (prefix, currentVal, updatedAt)
                VALUES ('${prefix}', ${numPart}, '${now}')
                ON CONFLICT(prefix) DO UPDATE SET
                  currentVal = MAX(currentVal, ${numPart}),
                  updatedAt = '${now}';
              `);
            }
          }
        }
      }
    } catch (_) {
      // Table or column might not exist yet
    }
  }
}

// 檢查特定完整單據號碼 (例如 AP-202603-009) 是否已被任一業務單據表使用
export function checkIfDocumentNumberExists(docNumber: string, db?: Database): boolean {
  const targetDb = db || getDbInstance();
  if (!targetDb) return false;

  const sequenceSources: { table: string; column: string }[] = [
    { table: 'purchase_orders', column: 'poNumber' },
    { table: 'inbound_receipts', column: 'receiptNumber' },
    { table: 'valuations', column: 'valuationNumber' },
    { table: 'quotations', column: 'quoteNumber' },
    { table: 'accounts_payable', column: 'apNumber' },
    { table: 'accounts_receivable', column: 'arNumber' },
    { table: 'bank_checks', column: 'checkNumber' },
    { table: 'projects', column: 'projectCode' },
    { table: 'subcontracts', column: 'contractCode' }
  ];

  for (const src of sequenceSources) {
    try {
      const res = targetDb.exec(`SELECT count(*) FROM ${src.table} WHERE ${src.column} = '${docNumber}';`);
      if (res.length && res[0].values.length && Number(res[0].values[0][0]) > 0) {
        return true;
      }
    } catch (_) {}
  }
  return false;
}

// 取得下一個單據號碼（具備防重號自動跳空躍升防碰撞機制）
export function getNextSequenceNumber(prefix: string, padLength = 3): string {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();

  const maxExisting = getMaxExistingSequenceForPrefix(prefix, dbInstance);
  const seqRes = dbInstance.exec(`SELECT currentVal FROM document_sequences WHERE prefix = '${prefix}';`);
  const currentDbVal = seqRes.length && seqRes[0].values.length ? Number(seqRes[0].values[0][0] || 0) : 0;

  let nextVal = Math.max(currentDbVal, maxExisting) + 1;
  let candidate = `${prefix}-${String(nextVal).padStart(padLength, '0')}`;

  let safetyLoopLimit = 1000;
  while (checkIfDocumentNumberExists(candidate, dbInstance) && safetyLoopLimit-- > 0) {
    nextVal++;
    candidate = `${prefix}-${String(nextVal).padStart(padLength, '0')}`;
  }

  dbInstance.run(`
    INSERT INTO document_sequences (prefix, currentVal, updatedAt)
    VALUES ('${prefix}', ${nextVal}, '${now}')
    ON CONFLICT(prefix) DO UPDATE SET
      currentVal = ${nextVal},
      updatedAt = '${now}';
  `);
  return candidate;
}

export function ensureDocumentSequenceRules(db?: Database): void {
  const targetDb = db || getDbInstance();
  if (!targetDb) return;

  targetDb.run(`
    CREATE TABLE IF NOT EXISTS document_sequence_rules (
      moduleKey TEXT PRIMARY KEY,
      moduleName TEXT NOT NULL,
      prefix TEXT NOT NULL,
      dateFormat TEXT DEFAULT 'YYYYMM',
      delimiter TEXT DEFAULT '-',
      serialLength INTEGER DEFAULT 3,
      resetFrequency TEXT DEFAULT 'MONTHLY',
      description TEXT,
      updatedAt TEXT
    );
  `);

  const res = targetDb.exec(`SELECT count(*) FROM document_sequence_rules;`);
  const count = res.length && res[0].values.length ? Number(res[0].values[0][0]) : 0;
  if (count === 0) {
    const now = new Date().toISOString();
    for (const r of DEFAULT_DOCUMENT_RULES) {
      targetDb.run(`
        INSERT INTO document_sequence_rules (moduleKey, moduleName, prefix, dateFormat, delimiter, serialLength, resetFrequency, description, updatedAt)
        VALUES ('${r.moduleKey}', '${r.moduleName}', '${r.prefix}', '${r.dateFormat}', '${r.delimiter}', ${r.serialLength}, '${r.resetFrequency}', '${r.description}', '${now}')
        ON CONFLICT(moduleKey) DO NOTHING;
      `);
    }
  }
}

export function getAllDocumentSequenceRules(): DocumentSequenceRule[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return DEFAULT_DOCUMENT_RULES;
  ensureDocumentSequenceRules(dbInstance);

  const res = dbInstance.exec(`
    SELECT moduleKey, moduleName, prefix, dateFormat, delimiter, serialLength, resetFrequency, description, updatedAt
    FROM document_sequence_rules
    ORDER BY moduleKey ASC;
  `);
  if (!res.length || !res[0].values.length) return DEFAULT_DOCUMENT_RULES;

  return res[0].values.map(row => ({
    moduleKey: String(row[0]),
    moduleName: String(row[1]),
    prefix: String(row[2]),
    dateFormat: (String(row[3]) as any) || 'YYYYMM',
    delimiter: (String(row[4]) as any) || '-',
    serialLength: Number(row[5]) || 3,
    resetFrequency: (String(row[6]) as any) || 'MONTHLY',
    description: String(row[7] || ''),
    updatedAt: String(row[8] || ''),
  }));
}

// 🛡️ 模組編碼前綴防衝突檢驗中樞 (全域唯一性與跨模組防撞校驗)
export function validateDocumentPrefixConflict(
  moduleKey: string,
  newPrefix: string,
  db?: Database
): { valid: boolean; reason?: string } {
  const targetDb = db || getDbInstance();
  if (!targetDb) return { valid: true };

  const cleanPrefix = (newPrefix || '').trim().toUpperCase();
  if (!cleanPrefix) {
    return { valid: false, reason: '單據前綴代碼不得為空！' };
  }

  if (!/^[A-Z0-9]{1,8}$/.test(cleanPrefix)) {
    return { valid: false, reason: '單據前綴僅能由 1~8 碼大寫英數字組成（如 AP、PO、QUO、VAL），不得包含空格或破折號等符號（分隔符號由單獨欄位設定）。' };
  }

  const rules = getAllDocumentSequenceRules();
  const conflictingRule = rules.find(r => r.moduleKey !== moduleKey && r.prefix.toUpperCase() === cleanPrefix);
  if (conflictingRule) {
    return {
      valid: false,
      reason: `衝突攔截：前綴代碼【${cleanPrefix}】已被【${conflictingRule.moduleName}】模組佔用！不同業務模組禁止使用相同前綴，以杜絕單號重號主鍵衝突與業務科目混淆。`
    };
  }

  const moduleTableMap: Record<string, string> = {
    AP: 'accounts_payable',
    AR: 'client_billing_records',
    PO: 'purchase_orders',
    QUO: 'quotations',
    VL: 'valuations',
    CK: 'receipts',
    PRJ: 'projects',
    SC: 'subcontracts',
    INV: 'vendor_bills'
  };

  const currentModuleTable = moduleTableMap[moduleKey];
  const allSourceTables = [
    { table: 'accounts_payable', col: 'apNumber', label: '應付帳款' },
    { table: 'purchase_orders', col: 'poNumber', label: '採購發包' },
    { table: 'quotations', col: 'quoteNumber', label: '工程報價' },
    { table: 'valuations', col: 'valuationNumber', label: '計價估驗' },
    { table: 'receipts', col: 'receiptNumber', label: '收付款單' },
    { table: 'client_billing_records', col: 'billNumber', label: '應收請款' },
    { table: 'subcontracts', col: 'subcontractCode', label: '分包合約' }
  ];

  for (const src of allSourceTables) {
    if (src.table === currentModuleTable) continue;
    try {
      const q = `SELECT count(*) FROM ${src.table} WHERE ${src.col} LIKE '${cleanPrefix}%';`;
      const res = targetDb.exec(q);
      const count = res.length && res[0].values.length ? Number(res[0].values[0][0]) : 0;
      if (count > 0) {
        return {
          valid: false,
          reason: `衝突攔截：【${src.label}】歷史資料中已存在 ${count} 筆以【${cleanPrefix}】開頭的單據！將此模組改為【${cleanPrefix}】會造成嚴重跨模組單號衝突。`
        };
      }
    } catch {
      // 容錯跳過尚未建立之資料表
    }
  }

  return { valid: true };
}

export function updateDocumentSequenceRule(
  rule: Partial<DocumentSequenceRule> & { moduleKey: string },
  operatorName = '系統管理者'
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureDocumentSequenceRules(dbInstance);

  const existingRules = getAllDocumentSequenceRules();
  const current = existingRules.find(r => r.moduleKey === rule.moduleKey);
  const targetPrefix = rule.prefix ? rule.prefix.trim().toUpperCase() : (current?.prefix || rule.moduleKey);

  const validation = validateDocumentPrefixConflict(rule.moduleKey, targetPrefix, dbInstance);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const now = new Date().toISOString();
  const updated: DocumentSequenceRule = {
    moduleKey: rule.moduleKey,
    moduleName: rule.moduleName || current?.moduleName || rule.moduleKey,
    prefix: targetPrefix,
    dateFormat: rule.dateFormat || current?.dateFormat || 'YYYYMM',
    delimiter: rule.delimiter !== undefined ? rule.delimiter : (current?.delimiter || '-'),
    serialLength: rule.serialLength || current?.serialLength || 3,
    resetFrequency: rule.resetFrequency || current?.resetFrequency || 'MONTHLY',
    description: rule.description !== undefined ? rule.description : (current?.description || ''),
    updatedAt: now,
  };

  dbInstance.run(`
    INSERT INTO document_sequence_rules (moduleKey, moduleName, prefix, dateFormat, delimiter, serialLength, resetFrequency, description, updatedAt)
    VALUES ('${updated.moduleKey}', '${updated.moduleName}', '${updated.prefix}', '${updated.dateFormat}', '${updated.delimiter}', ${updated.serialLength}, '${updated.resetFrequency}', '${updated.description}', '${now}')
    ON CONFLICT(moduleKey) DO UPDATE SET
      moduleName = '${updated.moduleName}',
      prefix = '${updated.prefix}',
      dateFormat = '${updated.dateFormat}',
      delimiter = '${updated.delimiter}',
      serialLength = ${updated.serialLength},
      resetFrequency = '${updated.resetFrequency}',
      description = '${updated.description}',
      updatedAt = '${now}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '修改單據編碼規則',
    '單據流水號規則',
    `模組 [${updated.moduleKey}]`,
    current ? { 模組: current.moduleKey, 前綴: current.prefix, 格式: `${current.prefix}${current.delimiter}${current.dateFormat}` } : {},
    { 模組: updated.moduleKey, 前綴: updated.prefix, 格式: `${updated.prefix}${updated.delimiter}${updated.dateFormat}`, 碼長: updated.serialLength },
    operatorName
  );

  saveDatabaseSnapshot();
  notifyListeners();
}

// 輔助函式：根據規則與指定日期計算週期字串 (如 202610, 2026, 20261014)
export function computePeriodString(dateFormat: 'YYYYMM' | 'YYYY' | 'YYYYMMDD' | 'NONE', targetDate?: string | Date): string {
  if (dateFormat === 'NONE') return '';
  const d = targetDate ? (typeof targetDate === 'string' ? new Date(targetDate) : targetDate) : new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (dateFormat === 'YYYY') return yyyy;
  if (dateFormat === 'YYYYMMDD') return `${yyyy}${mm}${dd}`;
  return `${yyyy}${mm}`;
}

// 取得所有模組跳號監控狀態（當期即時產號、次月預約、歷史歸檔分類）
export function getAllDocumentModuleStatuses(): DocumentModuleSequenceStatus[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureDocumentSequenceRules(dbInstance);
  const rules = getAllDocumentSequenceRules();

  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const seqRes = dbInstance.exec(`SELECT prefix, currentVal, updatedAt FROM document_sequences;`);
  const seqMap = new Map<string, { currentVal: number; updatedAt: string }>();
  if (seqRes.length && seqRes[0].values.length) {
    for (const row of seqRes[0].values) {
      seqMap.set(String(row[0]), { currentVal: Number(row[1] || 0), updatedAt: String(row[2] || '') });
    }
  }

  return rules.map(rule => {
    const currentPeriod = computePeriodString(rule.dateFormat, now);
    const delimiter = rule.delimiter;
    const currentPeriodPrefix = currentPeriod ? `${rule.prefix}${delimiter}${currentPeriod}` : rule.prefix;
    const maxExisting = getMaxExistingSequenceForPrefix(currentPeriodPrefix, dbInstance);
    const storedSeq = seqMap.get(currentPeriodPrefix)?.currentVal || 0;

    let nextVal = Math.max(maxExisting, storedSeq) + 1;
    let candidate = `${currentPeriodPrefix}${delimiter}${String(nextVal).padStart(rule.serialLength, '0')}`;
    let safety = 500;
    while (checkIfDocumentNumberExists(candidate, dbInstance) && safety-- > 0) {
      nextVal++;
      candidate = `${currentPeriodPrefix}${delimiter}${String(nextVal).padStart(rule.serialLength, '0')}`;
    }

    const latestDoc = maxExisting > 0
      ? `${currentPeriodPrefix}${delimiter}${String(maxExisting).padStart(rule.serialLength, '0')}`
      : null;

    const nextMonthPeriod = computePeriodString(rule.dateFormat, nextMonthDate);
    const nextMonthPrefix = nextMonthPeriod ? `${rule.prefix}${delimiter}${nextMonthPeriod}` : rule.prefix;
    const nextMonthMax = getMaxExistingSequenceForPrefix(nextMonthPrefix, dbInstance);
    const nextMonthStored = seqMap.get(nextMonthPrefix)?.currentVal || 0;
    const nextMonthNextVal = Math.max(nextMonthMax, nextMonthStored) + 1;
    const nextMonthReservedNextDoc = `${nextMonthPrefix}${delimiter}${String(nextMonthNextVal).padStart(rule.serialLength, '0')}`;

    const historicalPeriods: {
      period: string;
      prefixKey: string;
      maxVal: number;
      latestDoc: string;
      count: number;
      isLocked: boolean;
    }[] = [];

    seqMap.forEach((data, pKey) => {
      if (pKey.startsWith(rule.prefix) && pKey !== currentPeriodPrefix && pKey !== nextMonthPrefix) {
        const sub = pKey.substring(rule.prefix.length);
        const cleanPeriod = sub.replace(/^[-_]/, '');
        if (cleanPeriod && cleanPeriod < currentPeriod && /^\d+$/.test(cleanPeriod)) {
          const histMax = Math.max(data.currentVal, getMaxExistingSequenceForPrefix(pKey, dbInstance));
          if (histMax > 0) {
            historicalPeriods.push({
              period: cleanPeriod,
              prefixKey: pKey,
              maxVal: histMax,
              latestDoc: `${pKey}${delimiter}${String(histMax).padStart(rule.serialLength, '0')}`,
              count: histMax,
              isLocked: true,
            });
          }
        }
      }
    });

    historicalPeriods.sort((a, b) => b.period.localeCompare(a.period));

    return {
      moduleKey: rule.moduleKey,
      moduleName: rule.moduleName,
      prefix: rule.prefix,
      rule,
      currentPeriod: currentPeriod || '常態累計',
      currentPeriodPrefix,
      currentPeriodMaxVal: maxExisting,
      currentPeriodLatestDoc: latestDoc,
      currentPeriodNextVal: nextVal,
      currentPeriodNextDoc: candidate,
      nextMonthPeriod: nextMonthPeriod || '次期累計',
      nextMonthReservedNextDoc,
      historicalPeriods,
    };
  });
}

// 🚀 核心產號引擎：自動依序產出合法單號（系統自主產出，免人為手動輸入，絕不撞號）
export function getNextDocumentNumber(moduleKey: string, docDate?: string | Date): string {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureDocumentSequenceRules(dbInstance);

  const rules = getAllDocumentSequenceRules();
  const rule = rules.find(r => r.moduleKey === moduleKey || r.prefix === moduleKey) || {
    moduleKey,
    moduleName: moduleKey,
    prefix: moduleKey,
    dateFormat: 'YYYYMM' as const,
    delimiter: '-' as const,
    serialLength: 3,
    resetFrequency: 'MONTHLY' as const,
  };

  const periodStr = computePeriodString(rule.dateFormat, docDate);
  const delimiter = rule.delimiter;
  const prefixKey = periodStr ? `${rule.prefix}${delimiter}${periodStr}` : rule.prefix;
  const padLength = rule.serialLength || 3;

  const maxExisting = getMaxExistingSequenceForPrefix(prefixKey, dbInstance);
  const seqRes = dbInstance.exec(`SELECT currentVal FROM document_sequences WHERE prefix = '${prefixKey}';`);
  const currentDbVal = seqRes.length && seqRes[0].values.length ? Number(seqRes[0].values[0][0] || 0) : 0;

  let nextVal = Math.max(currentDbVal, maxExisting) + 1;
  let candidate = `${prefixKey}${delimiter}${String(nextVal).padStart(padLength, '0')}`;

  let safetyLoopLimit = 1000;
  while (checkIfDocumentNumberExists(candidate, dbInstance) && safetyLoopLimit-- > 0) {
    nextVal++;
    candidate = `${prefixKey}${delimiter}${String(nextVal).padStart(padLength, '0')}`;
  }

  const now = new Date().toISOString();
  dbInstance.run(`
    INSERT INTO document_sequences (prefix, currentVal, updatedAt)
    VALUES ('${prefixKey}', ${nextVal}, '${now}')
    ON CONFLICT(prefix) DO UPDATE SET
      currentVal = ${nextVal},
      updatedAt = '${now}';
  `);

  saveDatabaseSnapshot();
  notifyListeners();
  return candidate;
}

// 預覽下一個即將產出單號（純唯讀，不消耗計數器序號）
export function previewNextDocumentNumber(moduleKey: string, docDate?: string | Date): string {
  const dbInstance = getDbInstance();
  if (!dbInstance) return `${moduleKey}-001`;
  ensureDocumentSequenceRules(dbInstance);

  const rules = getAllDocumentSequenceRules();
  const rule = rules.find(r => r.moduleKey === moduleKey || r.prefix === moduleKey) || {
    moduleKey,
    moduleName: moduleKey,
    prefix: moduleKey,
    dateFormat: 'YYYYMM' as const,
    delimiter: '-' as const,
    serialLength: 3,
    resetFrequency: 'MONTHLY' as const,
  };

  const periodStr = computePeriodString(rule.dateFormat, docDate);
  const delimiter = rule.delimiter;
  const prefixKey = periodStr ? `${rule.prefix}${delimiter}${periodStr}` : rule.prefix;
  const padLength = rule.serialLength || 3;

  const maxExisting = getMaxExistingSequenceForPrefix(prefixKey, dbInstance);
  const seqRes = dbInstance.exec(`SELECT currentVal FROM document_sequences WHERE prefix = '${prefixKey}';`);
  const currentDbVal = seqRes.length && seqRes[0].values.length ? Number(seqRes[0].values[0][0] || 0) : 0;

  let nextVal = Math.max(currentDbVal, maxExisting) + 1;
  let candidate = `${prefixKey}${delimiter}${String(nextVal).padStart(padLength, '0')}`;

  let safetyLoopLimit = 1000;
  while (checkIfDocumentNumberExists(candidate, dbInstance) && safetyLoopLimit-- > 0) {
    nextVal++;
    candidate = `${prefixKey}${delimiter}${String(nextVal).padStart(padLength, '0')}`;
  }

  return candidate;
}

// 🔮 次月預約整備單號：預先初始化次月單號計數起點，避免跨月開單衝突
export function reserveNextMonthSequence(
  moduleKey: string,
  operatorName = '系統管理者'
): { success: boolean; message: string; reservedDoc: string } {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureDocumentSequenceRules(dbInstance);

  const rules = getAllDocumentSequenceRules();
  const rule = rules.find(r => r.moduleKey === moduleKey || r.prefix === moduleKey);
  if (!rule) throw new Error(`找不到模組 [${moduleKey}] 之單據編碼規則`);

  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthPeriod = computePeriodString(rule.dateFormat, nextMonthDate);
  const nextMonthPrefix = nextMonthPeriod ? `${rule.prefix}${rule.delimiter}${nextMonthPeriod}` : rule.prefix;

  const currentMax = getMaxExistingSequenceForPrefix(nextMonthPrefix, dbInstance);
  const nextVal = currentMax > 0 ? currentMax : 0;

  const timestamp = new Date().toISOString();
  dbInstance.run(`
    INSERT INTO document_sequences (prefix, currentVal, updatedAt)
    VALUES ('${nextMonthPrefix}', ${nextVal}, '${timestamp}')
    ON CONFLICT(prefix) DO NOTHING;
  `);

  const reservedDoc = previewNextDocumentNumber(moduleKey, nextMonthDate);

  logAudit(
    dbInstance,
    operatorName,
    '次月預約整備單號',
    '單據流水號規則',
    `模組 [${rule.moduleKey}]`,
    {},
    { 模組: rule.moduleKey, 次月期間: nextMonthPeriod, 預約首號: reservedDoc },
    operatorName
  );

  saveDatabaseSnapshot();
  notifyListeners();
  return {
    success: true,
    message: `已成功為【${rule.moduleName}】預備次月（${nextMonthPeriod}）單據流水號起點：${reservedDoc}！開立下月單據時將自動接續發放。`,
    reservedDoc
  };
}

// ⚡ 系統全域單號安全巡檢與智能防撞自癒
export function autoCalibrateAllDocumentSequences(operatorName = '系統管理者'): {
  success: boolean;
  message: string;
  calibratedModules: string[];
} {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureDocumentSequenceRules(dbInstance);
  reseedDocumentSequences(dbInstance);

  const rules = getAllDocumentSequenceRules();
  const calibrated: string[] = [];

  for (const rule of rules) {
    calibrated.push(rule.moduleName);
  }

  logAudit(
    dbInstance,
    operatorName,
    '全域單號智能防撞自癒',
    '單據流水號規則',
    '全模組業務單據表',
    {},
    { 說明: '掃描全庫真實單據表記錄，校準當期與歷史計數器指針，100% 杜絕主鍵衝突' },
    operatorName
  );

  saveDatabaseSnapshot();
  notifyListeners();
  return {
    success: true,
    message: `全域單號智能巡檢與防撞自癒已完成！已對齊 ${calibrated.length} 個業務模組的最新開單序號。`,
    calibratedModules: calibrated
  };
}

// 相容舊介面：全域清單
export function getAllDocumentSequences(): DocumentSequence[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const res = dbInstance.exec(`SELECT prefix, currentVal, updatedAt FROM document_sequences ORDER BY prefix ASC;`);
  if (!res.length) return [];
  return res[0].values.map(v => {
    const prefix = String(v[0]);
    const currentVal = Number(v[1] || 0);
    const maxExisting = getMaxExistingSequenceForPrefix(prefix, dbInstance);
    const nextVal = Math.max(currentVal, maxExisting) + 1;
    return {
      prefix,
      currentVal,
      maxExistingVal: maxExisting,
      nextVal,
      updatedAt: String(v[2] || ''),
    };
  });
}

// 相容舊介面：校正下一個流水號
export function updateNextSequenceNumber(
  prefix: string,
  targetNextVal: number,
  operatorName = '系統管理者'
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const maxUsed = getMaxExistingSequenceForPrefix(prefix, dbInstance);
  if (targetNextVal <= maxUsed) {
    throw new Error(
      `【單據防重號鐵律】校正失敗！前綴 [${prefix}] 現存單據已使用至最大序號 [${String(maxUsed).padStart(3, '0')}]。\n` +
      `下一個發放流水號不得小於或等於已使用的現存最大單號，必須 >= ${maxUsed + 1} 號！`
    );
  }

  const internalVal = targetNextVal - 1;
  const now = new Date().toISOString();
  dbInstance.run(`
    INSERT INTO document_sequences (prefix, currentVal, updatedAt)
    VALUES ('${prefix}', ${internalVal}, '${now}')
    ON CONFLICT(prefix) DO UPDATE SET
      currentVal = ${internalVal},
      updatedAt = '${now}';
  `);
  logAudit(
    dbInstance,
    operatorName,
    '校正下一個流水號',
    '單據流水號規則',
    `前綴 [${prefix}]`,
    { 前綴: prefix, 原現存最大單號: maxUsed },
    { 前綴: prefix, 下一個開立流水號: targetNextVal },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 相容舊介面：updateDocumentSequence
export function updateDocumentSequence(
  prefix: string,
  newVal: number,
  operatorName = '系統管理者'
): void {
  updateNextSequenceNumber(prefix, newVal, operatorName);
}

// 相容舊介面：單項自動校正
export function autoCalibrateSequence(
  prefix: string,
  operatorName = '系統管理者'
): number {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const maxUsed = getMaxExistingSequenceForPrefix(prefix, dbInstance);
  const now = new Date().toISOString();

  dbInstance.run(`
    INSERT INTO document_sequences (prefix, currentVal, updatedAt)
    VALUES ('${prefix}', ${maxUsed}, '${now}')
    ON CONFLICT(prefix) DO UPDATE SET
      currentVal = ${maxUsed},
      updatedAt = '${now}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '自動校正單據流水號',
    '單據流水號規則',
    `前綴 [${prefix}]`,
    { 前綴: prefix, 現存最大單號: maxUsed },
    { 前綴: prefix, 自動校準下一個流水號: maxUsed + 1 },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
  return maxUsed + 1;
}

// 相容舊介面：全域一鍵自動校正
export function autoCalibrateAllSequences(operatorName = '系統管理者'): void {
  autoCalibrateAllDocumentSequences(operatorName);
}
