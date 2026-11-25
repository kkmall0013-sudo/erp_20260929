import type { Database } from 'sql.js';
import type { AppConfig, RegulatorySchedule, SystemConfig } from '../../types/erp';
import { getDbInstance, notifyListeners, saveDatabaseSnapshot } from '../core/dbContext';
import { logAudit } from './auditRepository';

// ============================================================================
// ⏰ 法規與稅率預約生效排程中樞 (Regulatory Schedules)
// ============================================================================
export function applyDueRegulatorySchedules(db?: Database): number {
  const activeDb = getDbInstance();
  const targetDb = db || activeDb;
  if (!targetDb) return 0;

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const nowDateOnly = now.substring(0, 10);

  try {
    const res = targetDb.exec(`
      SELECT id, configKey, configLabel, scheduledValue, effectiveDate, notes
      FROM regulatory_schedules
      WHERE status = 'SCHEDULED' AND (effectiveDate <= '${now}' OR effectiveDate <= '${nowDateOnly}');
    `);

    if (!res.length || !res[0].values.length) return 0;

    let appliedCount = 0;
    for (const row of res[0].values) {
      const id = String(row[0]);
      const configKey = String(row[1]);
      const configLabel = String(row[2]);
      const scheduledValue = String(row[3]);
      const notes = row[5] ? String(row[5]) : '';

      targetDb.run(`
        UPDATE system_configs
        SET configValue = '${scheduledValue.replace(/'/g, "''")}',
            version = version + 1,
            updatedBy = '自動法規排程引擎',
            updatedAt = '${now}'
        WHERE configKey = '${configKey}';
      `);

      targetDb.run(`
        UPDATE regulatory_schedules
        SET status = 'APPLIED',
            appliedAt = '${now}'
        WHERE id = '${id}';
      `);

      try {
        logAudit(
          targetDb,
          '系統排程守護程序',
          '法規排程自動生效',
          '營運法規中樞',
          configLabel,
          { 參數代碼: configKey },
          { 參數代碼: configKey, 自動套用新值: scheduledValue, 備註: notes },
          '系統自動執行'
        );
      } catch (_) {}

      appliedCount++;
    }

    if (appliedCount > 0 && targetDb === activeDb) {
      saveDatabaseSnapshot();
      notifyListeners();
    }
    return appliedCount;
  } catch (_) {
    return 0;
  }
}

export function getRegulatorySchedules(): RegulatorySchedule[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  applyDueRegulatorySchedules();

  try {
    const res = dbInstance.exec(`
      SELECT id, configKey, configLabel, scheduledValue, effectiveDate, status, createdBy, createdAt, appliedAt, notes
      FROM regulatory_schedules
      ORDER BY effectiveDate ASC, createdAt DESC;
    `);
    if (!res.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      configKey: String(v[1]),
      configLabel: String(v[2]),
      scheduledValue: String(v[3]),
      effectiveDate: String(v[4]),
      status: v[5] as RegulatorySchedule['status'],
      createdBy: v[6] ? String(v[6]) : undefined,
      createdAt: v[7] ? String(v[7]) : undefined,
      appliedAt: v[8] ? String(v[8]) : undefined,
      notes: v[9] ? String(v[9]) : undefined,
    }));
  } catch (_) {
    return [];
  }
}

export function createRegulatorySchedule(data: {
  configKey: string;
  configLabel: string;
  scheduledValue: string;
  effectiveDate: string;
  notes?: string;
  operatorName?: string;
}): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const id = `SCHED-${Date.now()}`;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const operator = data.operatorName || '系統管理員';

  dbInstance.run(`
    INSERT INTO regulatory_schedules (id, configKey, configLabel, scheduledValue, effectiveDate, status, createdBy, createdAt, notes)
    VALUES (
      '${id}',
      '${data.configKey}',
      '${data.configLabel.replace(/'/g, "''")}',
      '${data.scheduledValue.replace(/'/g, "''")}',
      '${data.effectiveDate}',
      'SCHEDULED',
      '${operator.replace(/'/g, "''")}',
      '${now}',
      ${data.notes ? `'${data.notes.replace(/'/g, "''")}'` : 'NULL'}
    );
  `);

  logAudit(
    dbInstance,
    operator,
    '新增法規生效排程',
    '法規排程中樞',
    data.configLabel,
    {},
    {
      參數代碼: data.configKey,
      預定新值: data.scheduledValue,
      預定生效時間: data.effectiveDate,
      備註: data.notes
    },
    operator
  );

  applyDueRegulatorySchedules();
  saveDatabaseSnapshot();
  notifyListeners();
}

export function cancelRegulatorySchedule(id: string, operatorName = '系統管理員'): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  dbInstance.run(`
    UPDATE regulatory_schedules
    SET status = 'CANCELLED'
    WHERE id = '${id}' AND status = 'SCHEDULED';
  `);
  logAudit(
    dbInstance,
    operatorName,
    '取消法規生效排程',
    '法規排程中樞',
    `排程 ID [${id}]`,
    { 排程ID: id },
    { 狀態: 'CANCELLED' },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// 讀取全域參數
export function getAllSystemConfigs(): SystemConfig[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  applyDueRegulatorySchedules();
  const res = dbInstance.exec(`
    SELECT id, configKey, configValue, valueType, validFrom, validTo, isDeleted, version, description, updatedBy, createdAt, updatedAt
    FROM system_configs WHERE isDeleted = 0;
  `);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    configKey: String(v[1]),
    configValue: String(v[2]),
    valueType: v[3] as SystemConfig['valueType'],
    validFrom: String(v[4]),
    validTo: v[5] ? String(v[5]) : undefined,
    isDeleted: Boolean(v[6]),
    version: Number(v[7] || 1),
    description: v[8] ? String(v[8]) : undefined,
    updatedBy: v[9] ? String(v[9]) : undefined,
    createdAt: v[10] ? String(v[10]) : undefined,
    updatedAt: v[11] ? String(v[11]) : undefined,
  }));
}

// 更新全域核心系統參數 (需 Superadmin 或具備 canManageSystemConfigs 特許之 Admin)
export function updateSystemConfig(
  configId: string,
  newValue: string,
  operatorName: string,
  canWriteConfig: boolean
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  if (!canWriteConfig) {
    throw new Error('【權限防線攔截】您尚未取得「全域核心參數維護特許」，僅能唯讀檢視，無法修改系統底層參數！');
  }

  const labelMap: Record<string, string> = {
    TAX_RATE: '法定營業稅率',
    FIN_TAX_TOLERANCE: '發票稅額尾差容許值 (元)',
    DEFAULT_RETENTION_RATE: '工程估驗預設保留款率 (%)',
    PROJECT_LOCK_MODE: '案場超支預算防呆鎖定模式',
    NHI_RATE: '二代健保補充保費扣繳率',
    PAYMENT_TERM_DAYS: '預設請款票期 / 付款天數',
    WARRANTY_MONTHS: '預設工程保固期 (月)',
    PAYMENT_SCHEDULE_DAYS: '預設每月固定付款日規則',
    BOSS_ACCOUNT_INVOICE_POLICY: '有發票單據老闆私帳代墊政策',
  };

  const existing = getAllSystemConfigs().find(c => c.id === configId);
  if (!existing) throw new Error('找不到指定的系統參數項目！');

  const trimmed = newValue.trim();
  if (trimmed === existing.configValue) return;

  const nextVer = (existing.version || 1) + 1;
  const now = new Date().toISOString().substring(0, 10);
  dbInstance.run(`
    UPDATE system_configs 
    SET configValue = '${trimmed.replace(/'/g, "''")}',
        version = ${nextVer},
        updatedBy = '${operatorName.replace(/'/g, "''")}',
        updatedAt = '${now}'
    WHERE id = '${configId}';
  `);

  const cnLabel = existing.description || labelMap[existing.configKey] || existing.configKey;
  logAudit(
    dbInstance,
    operatorName,
    '修改資料',
    '系統參數',
    cnLabel,
    { [cnLabel]: existing.configValue },
    { [cnLabel]: trimmed },
    operatorName
  );
  saveDatabaseSnapshot();
  notifyListeners();
}

// ============================================================================
// 🖥️ 軟體程式設定 (AppConfig - Superadmin 專屬)
// ============================================================================
export function getAllAppConfigs(): AppConfig[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const res = dbInstance.exec(`
    SELECT id, configKey, configValue, description, valueType, isDeleted, version, updatedBy, createdAt, updatedAt
    FROM app_configs WHERE isDeleted = 0 ORDER BY id ASC;
  `);
  if (!res.length) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    configKey: String(v[1]),
    configValue: String(v[2]),
    description: v[3] ? String(v[3]) : undefined,
    valueType: v[4] as AppConfig['valueType'],
    isDeleted: Boolean(v[5]),
    version: Number(v[6] || 1),
    updatedBy: v[7] ? String(v[7]) : undefined,
    createdAt: v[8] ? String(v[8]) : undefined,
    updatedAt: v[9] ? String(v[9]) : undefined,
  }));
}

export function getAppConfigMap(): Record<string, string> {
  const configs = getAllAppConfigs();
  const map: Record<string, string> = {};
  for (const c of configs) {
    map[c.configKey] = c.configValue;
  }
  return map;
}

export function updateAppConfig(
  configKey: string,
  newValue: string,
  operatorName: string
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const existing = getAllAppConfigs().find(c => c.configKey === configKey);
  const now = new Date().toISOString().substring(0, 10);
  const trimmed = newValue.trim();

  if (existing) {
    if (trimmed === existing.configValue) return;
    const nextVer = (existing.version || 1) + 1;
    dbInstance.run(`
      UPDATE app_configs 
      SET configValue = '${trimmed.replace(/'/g, "''")}',
          version = ${nextVer},
          updatedBy = '${operatorName.replace(/'/g, "''")}',
          updatedAt = '${now}'
      WHERE configKey = '${configKey}';
    `);
    const cnLabel = existing.description || configKey;
    logAudit(
      dbInstance,
      operatorName,
      '修改軟體設定',
      '程式本體設定',
      cnLabel,
      { [cnLabel]: existing.configValue },
      { [cnLabel]: trimmed },
      operatorName
    );
  } else {
    const newId = `APP-CFG-${Date.now()}`;
    dbInstance.run(`
      INSERT INTO app_configs (id, configKey, configValue, description, valueType, isDeleted, version, updatedBy, createdAt, updatedAt)
      VALUES ('${newId}', '${configKey}', '${trimmed.replace(/'/g, "''")}', '${configKey}', 'STRING', 0, 1, '${operatorName.replace(/'/g, "''")}', '${now}', '${now}');
    `);
    logAudit(
      dbInstance,
      operatorName,
      '新增軟體設定',
      '程式本體設定',
      configKey,
      {},
      { [configKey]: trimmed },
      operatorName
    );
  }
  saveDatabaseSnapshot();
  notifyListeners();
}

export function batchUpdateAppConfigs(
  updates: Record<string, string>,
  operatorName: string
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  let changed = false;
  for (const [key, val] of Object.entries(updates)) {
    const existing = getAllAppConfigs().find(c => c.configKey === key);
    if (!existing || existing.configValue !== val.trim()) {
      updateAppConfig(key, val, operatorName);
      changed = true;
    }
  }
  if (changed) {
    saveDatabaseSnapshot();
    notifyListeners();
  }
}
