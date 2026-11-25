import type { Database } from 'sql.js';
import type { TaiwanPostalCityRecord, TaiwanPostalCodeRecord } from '../../types/erp';
import {
  DEFAULT_TAIWAN_POSTAL_CODES,
  setDynamicCityCatalog,
  setDynamicPostalCatalog,
  compareDistrictPostal,
  normalizeTaiwanCity,
  normalizeTaiwanDistrict
} from '../../utils/taiwanPostalCodes';
import {
  getDbInstance,
  notifyListeners,
  parseJsonArraySafe,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { logAudit } from './auditRepository';

export function ensurePostalCatalogSeeded(db: Database): void {
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS taiwan_postal_cities (
        id TEXT PRIMARY KEY,
        cityName TEXT UNIQUE NOT NULL,
        aliases TEXT DEFAULT '[]',
        isActive INTEGER DEFAULT 1,
        note TEXT,
        sortOrder INTEGER DEFAULT 0,
        updatedAt TEXT
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS taiwan_postal_codes (
        id TEXT PRIMARY KEY,
        cityId TEXT,
        city TEXT NOT NULL,
        district TEXT NOT NULL,
        postalCode TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        aliases TEXT DEFAULT '[]',
        replacedByCity TEXT,
        replacedByDistrict TEXT,
        note TEXT,
        sortOrder INTEGER DEFAULT 0,
        updatedAt TEXT
      );
    `);
    try { db.run("ALTER TABLE taiwan_postal_codes ADD COLUMN cityId TEXT;"); } catch (_) {}

    const cntRes = db.exec(`SELECT count(*) FROM taiwan_postal_codes;`);
    const count = Number(cntRes[0]?.values[0]?.[0] || 0);
    if (count === 0) {
      const now = new Date().toISOString();
      db.run('BEGIN TRANSACTION;');
      try {
        const cityMap = new Map<string, string>();
        let cityIdx = 0;
        DEFAULT_TAIWAN_POSTAL_CODES.forEach((p, idx) => {
          let cId = cityMap.get(p.city);
          if (!cId) {
            cityIdx += 1;
            cId = `CITY-${String(cityIdx).padStart(2, '0')}`;
            cityMap.set(p.city, cId);
            db.run(`
              INSERT OR IGNORE INTO taiwan_postal_cities (
                id, cityName, aliases, isActive, note, sortOrder, updatedAt
              ) VALUES (
                '${cId}', '${p.city.replace(/'/g, "''")}', '[]', 1, NULL, ${cityIdx}, '${now}'
              );
            `);
          }
          const id = `POST-${String(idx + 1).padStart(3, '0')}`;
          db.run(`
            INSERT INTO taiwan_postal_codes (
              id, cityId, city, district, postalCode, isActive, aliases, replacedByCity, replacedByDistrict, note, sortOrder, updatedAt
            ) VALUES (
              '${id}',
              '${cId}',
              '${p.city.replace(/'/g, "''")}',
              '${p.district.replace(/'/g, "''")}',
              '${p.postalCode.replace(/'/g, "''")}',
              1,
              '[]',
              NULL,
              NULL,
              NULL,
              ${idx + 1},
              '${now}'
            );
          `);
        });
        db.run('COMMIT;');
      } catch (innerErr) {
        try { db.run('ROLLBACK;'); } catch (_) {}
        throw innerErr;
      }
    } else {
      // 補齊舊有資料庫之 taiwan_postal_cities 與 cityId 關聯（修正 SQLite GROUP BY 聚合查詢）
      const distRes = db.exec(`
        SELECT city
        FROM taiwan_postal_codes
        WHERE city IS NOT NULL AND TRIM(city) != ''
        GROUP BY city
        ORDER BY MIN(CAST(postalCode AS INTEGER)) ASC, MIN(sortOrder) ASC;
      `);
      const distinctCities = distRes.length
        ? distRes[0].values.map(v => String(v[0] || '').trim()).filter(Boolean)
        : [];

      const existingCitiesRes = db.exec(`SELECT id, cityName FROM taiwan_postal_cities;`);
      const existingCityIdByName = new Map<string, string>();
      if (existingCitiesRes.length) {
        for (const row of existingCitiesRes[0].values) {
          existingCityIdByName.set(String(row[1] || ''), String(row[0] || ''));
        }
      }

      const now = new Date().toISOString();
      let nextSeq = existingCityIdByName.size + 1;
      distinctCities.forEach(cName => {
        let cId = existingCityIdByName.get(cName);
        if (!cId) {
          cId = `CITY-${String(nextSeq).padStart(2, '0')}`;
          nextSeq += 1;
          db.run(`
            INSERT OR IGNORE INTO taiwan_postal_cities (
              id, cityName, aliases, isActive, note, sortOrder, updatedAt
            ) VALUES (
              '${cId}', '${cName.replace(/'/g, "''")}', '[]', 1, NULL, ${nextSeq - 1}, '${now}'
            );
          `);
          const refetch = db.exec(`SELECT id FROM taiwan_postal_cities WHERE cityName = '${cName.replace(/'/g, "''")}';`);
          if (refetch.length && refetch[0].values.length) {
            cId = String(refetch[0].values[0][0]);
          }
          existingCityIdByName.set(cName, cId);
        }
        db.run(`
          UPDATE taiwan_postal_codes
          SET cityId = '${cId}'
          WHERE city = '${cName.replace(/'/g, "''")}' AND (cityId IS NULL OR cityId = '');
        `);
      });
    }
  } catch (e) {
    console.error('ensurePostalCatalogSeeded error:', e);
  }
}

function readPostalCitiesFromDb(db: Database): TaiwanPostalCityRecord[] {
  try {
    const res = db.exec(`
      SELECT id, cityName, aliases, isActive, note, updatedAt
      FROM taiwan_postal_cities
      ORDER BY sortOrder ASC, id ASC;
    `);
    if (!res.length || !res[0].values.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      cityName: String(v[1] || ''),
      aliases: parseJsonArraySafe<string>(v[2]),
      isActive: Number(v[3]) !== 0,
      note: v[4] ? String(v[4]) : undefined,
      updatedAt: v[5] ? String(v[5]) : undefined
    }));
  } catch {
    return [];
  }
}

function readPostalCatalogFromDb(db: Database): TaiwanPostalCodeRecord[] {
  try {
    const res = db.exec(`
      SELECT id, cityId, city, district, postalCode, isActive, aliases, replacedByCity, replacedByDistrict, note, sortOrder, updatedAt
      FROM taiwan_postal_codes
      ORDER BY postalCode ASC, sortOrder ASC, id ASC;
    `);
    if (!res.length || !res[0].values.length) return [];
    const rows: TaiwanPostalCodeRecord[] = res[0].values.map(v => ({
      id: String(v[0]),
      cityId: v[1] ? String(v[1]) : undefined,
      city: String(v[2] || ''),
      district: String(v[3] || ''),
      postalCode: String(v[4] || ''),
      isActive: Number(v[5]) !== 0,
      aliases: parseJsonArraySafe<string>(v[6]),
      replacedByCity: v[7] ? String(v[7]) : undefined,
      replacedByDistrict: v[8] ? String(v[8]) : undefined,
      note: v[9] ? String(v[9]) : undefined,
      sortOrder: Number(v[10] || 0),
      updatedAt: v[11] ? String(v[11]) : undefined
    }));
    const cityMinZip = new Map<string, number>();
    for (const r of rows) {
      const z = Number(String(r.postalCode || '').replace(/\D/g, '').slice(0, 6)) || 999999;
      const prev = cityMinZip.get(r.city);
      if (prev === undefined || z < prev) cityMinZip.set(r.city, z);
    }
    return rows.sort((a, b) => {
      if (a.city !== b.city) {
        const minA = cityMinZip.get(a.city) ?? 999999;
        const minB = cityMinZip.get(b.city) ?? 999999;
        if (minA !== minB) return minA - minB;
        return a.city.localeCompare(b.city, 'zh-Hant');
      }
      return compareDistrictPostal(a, b);
    });
  } catch {
    return [];
  }
}

export function syncPostalCatalogToUtility(db?: Database): void {
  const targetDb = db || getDbInstance();
  if (!targetDb) return;
  const cities = readPostalCitiesFromDb(targetDb);
  const rows = readPostalCatalogFromDb(targetDb);
  setDynamicCityCatalog(cities);
  setDynamicPostalCatalog(rows);
}

export function getAllTaiwanPostalCities(): TaiwanPostalCityRecord[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) {
    return Array.from(new Set(DEFAULT_TAIWAN_POSTAL_CODES.map(p => p.city))).map((cityName, idx) => ({
      id: `CITY-${String(idx + 1).padStart(2, '0')}`,
      cityName,
      aliases: [],
      isActive: true
    }));
  }
  ensurePostalCatalogSeeded(dbInstance);
  return readPostalCitiesFromDb(dbInstance);
}

export function getAllTaiwanPostalCodes(): TaiwanPostalCodeRecord[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) {
    return DEFAULT_TAIWAN_POSTAL_CODES.map((p, idx) => ({
      id: `POST-${String(idx + 1).padStart(3, '0')}`,
      city: p.city,
      district: p.district,
      postalCode: p.postalCode,
      isActive: true,
      aliases: [],
      sortOrder: idx + 1
    }));
  }
  ensurePostalCatalogSeeded(dbInstance);
  return readPostalCatalogFromDb(dbInstance);
}

/**
 * 編修縣市變數 (a)：一鍵更名並自動連動旗下全部鄉鎮市區 (a-1, a-2, a-3...)，絕不自動改寫既有夥伴/公司/案場歷史地址
 */
export function saveTaiwanPostalCity(
  params: {
    cityId?: string;
    oldCityName?: string;
    newCityName: string;
    aliases?: string[];
    isActive?: boolean;
    note?: string;
    keepOldNameAsAlias?: boolean;
  },
  operatorName: string = '系統管理員'
): TaiwanPostalCityRecord {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensurePostalCatalogSeeded(dbInstance);
  const now = new Date().toISOString();
  const cleanNewName = params.newCityName.trim();
  if (!cleanNewName) throw new Error('縣市名稱不可為空');

  const cities = readPostalCitiesFromDb(dbInstance);
  const existing = params.cityId
    ? cities.find(c => c.id === params.cityId)
    : params.oldCityName
    ? cities.find(c => c.cityName === params.oldCityName?.trim())
    : cities.find(c => c.cityName === cleanNewName);

  const oldName = existing?.cityName || params.oldCityName?.trim() || '';
  const mergedAliases = Array.from(
    new Set([
      ...(params.aliases !== undefined ? params.aliases : (existing?.aliases || [])),
      ...(params.keepOldNameAsAlias !== false && oldName && oldName !== cleanNewName ? [oldName] : [])
    ].map(s => String(s).trim()).filter(s => Boolean(s) && s !== cleanNewName))
  );
  const isActive = params.isActive !== false ? 1 : 0;
  const cleanNote = params.note !== undefined ? params.note.trim() : (existing?.note || '');

  const conflictTarget = cities.find(c => c.cityName === cleanNewName && c.id !== existing?.id);

  let finalId = existing?.id || `CITY-CUST-${Date.now().toString().slice(-6)}`;
  dbInstance.run('BEGIN TRANSACTION;');
  try {
    if (conflictTarget) {
      finalId = conflictTarget.id;
      const combinedAliases = Array.from(
        new Set([...(conflictTarget.aliases || []), ...mergedAliases])
      ).filter(s => s !== cleanNewName);
      const aliasesJson = JSON.stringify(combinedAliases).replace(/'/g, "''");
      dbInstance.run(`
        UPDATE taiwan_postal_cities SET
          aliases = '${aliasesJson}',
          isActive = ${isActive},
          note = ${cleanNote ? `'${cleanNote.replace(/'/g, "''")}'` : 'NULL'},
          updatedAt = '${now}'
        WHERE id = '${finalId}';
      `);
      if (existing) {
        dbInstance.run(`
          UPDATE taiwan_postal_codes SET
            cityId = '${finalId}',
            city = '${cleanNewName.replace(/'/g, "''")}',
            updatedAt = '${now}'
          WHERE cityId = '${existing.id}' OR city = '${existing.cityName.replace(/'/g, "''")}';
        `);
        dbInstance.run(`DELETE FROM taiwan_postal_cities WHERE id = '${existing.id}';`);
      } else if (oldName) {
        dbInstance.run(`
          UPDATE taiwan_postal_codes SET
            cityId = '${finalId}',
            city = '${cleanNewName.replace(/'/g, "''")}',
            updatedAt = '${now}'
          WHERE city = '${oldName.replace(/'/g, "''")}';
        `);
      }
    } else if (existing) {
      const aliasesJson = JSON.stringify(mergedAliases).replace(/'/g, "''");
      dbInstance.run(`
        UPDATE taiwan_postal_cities SET
          cityName = '${cleanNewName.replace(/'/g, "''")}',
          aliases = '${aliasesJson}',
          isActive = ${isActive},
          note = ${cleanNote ? `'${cleanNote.replace(/'/g, "''")}'` : 'NULL'},
          updatedAt = '${now}'
        WHERE id = '${existing.id}';
      `);
      dbInstance.run(`
        UPDATE taiwan_postal_codes SET
          cityId = '${existing.id}',
          city = '${cleanNewName.replace(/'/g, "''")}',
          updatedAt = '${now}'
        WHERE cityId = '${existing.id}' OR city = '${existing.cityName.replace(/'/g, "''")}';
      `);
    } else {
      const aliasesJson = JSON.stringify(mergedAliases).replace(/'/g, "''");
      dbInstance.run(`
        INSERT INTO taiwan_postal_cities (id, cityName, aliases, isActive, note, sortOrder, updatedAt)
        VALUES (
          '${finalId}',
          '${cleanNewName.replace(/'/g, "''")}',
          '${aliasesJson}',
          ${isActive},
          ${cleanNote ? `'${cleanNote.replace(/'/g, "''")}'` : 'NULL'},
          ${cities.length + 1},
          '${now}'
        );
      `);
      if (oldName) {
        dbInstance.run(`
          UPDATE taiwan_postal_codes SET
            cityId = '${finalId}',
            city = '${cleanNewName.replace(/'/g, "''")}',
            updatedAt = '${now}'
          WHERE city = '${oldName.replace(/'/g, "''")}';
        `);
      }
    }
    dbInstance.run('COMMIT;');
  } catch (err) {
    try { dbInstance.run('ROLLBACK;'); } catch (_) {}
    throw err;
  }

  logAudit(
    dbInstance,
    operatorName,
    '縣市更名與別名維護',
    '郵遞區號微型資料庫',
    cleanNewName,
    oldName ? { 縣市名稱: oldName } : undefined,
    { 縣市名稱: cleanNewName, 舊名別名: mergedAliases.join('、') || '無', 狀態: isActive ? '現行啟用' : '停用' }
  );

  syncPostalCatalogToUtility(dbInstance);
  saveDatabaseSnapshot();
  notifyListeners();
  return readPostalCitiesFromDb(dbInstance).find(c => c.id === finalId)!;
}

export function saveTaiwanPostalCode(
  record: Partial<TaiwanPostalCodeRecord> & { city: string; district: string; postalCode: string },
  operatorName: string = '系統管理員'
): TaiwanPostalCodeRecord {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensurePostalCatalogSeeded(dbInstance);
  const now = new Date().toISOString();
  const rawCityInput = record.city.trim();
  const existingCities = readPostalCitiesFromDb(dbInstance);
  const matchedCityRow =
    (record.cityId ? existingCities.find(c => c.id === record.cityId) : undefined) ||
    existingCities.find(c => c.cityName === rawCityInput) ||
    existingCities.find(c => c.cityName.replace(/台/g, '臺') === rawCityInput.replace(/台/g, '臺'));

  const cleanCity = matchedCityRow ? matchedCityRow.cityName : rawCityInput;
  let resolvedCityId = matchedCityRow?.id;
  if (!resolvedCityId && cleanCity) {
    resolvedCityId = `CITY-CUST-${Date.now().toString().slice(-6)}`;
    dbInstance.run(`
      INSERT OR IGNORE INTO taiwan_postal_cities (id, cityName, aliases, isActive, note, sortOrder, updatedAt)
      VALUES ('${resolvedCityId}', '${cleanCity.replace(/'/g, "''")}', '[]', 1, NULL, ${existingCities.length + 1}, '${now}');
    `);
  }

  const cleanDistrict = normalizeTaiwanDistrict(record.district);
  const cleanZip = record.postalCode.trim().replace(/[^\d-]/g, '');
  if (!cleanCity || !cleanDistrict || !cleanZip) {
    throw new Error('縣市、鄉鎮市區與郵遞區號皆為必填');
  }

  const existingList = readPostalCatalogFromDb(dbInstance);
  const existing = record.id ? existingList.find(r => r.id === record.id) : undefined;
  const targetId = existing ? existing.id : (record.id || `POST-CUST-${Date.now().toString().slice(-6)}`);
  const isActive = record.isActive !== false ? 1 : 0;
  const aliases = Array.from(
    new Set((record.aliases || []).map(s => String(s).trim()).filter(Boolean))
  );
  const aliasesJson = JSON.stringify(aliases).replace(/'/g, "''");
  const replacedByCity = record.replacedByCity ? normalizeTaiwanCity(record.replacedByCity) : '';
  const replacedByDistrict = record.replacedByDistrict ? normalizeTaiwanDistrict(record.replacedByDistrict) : '';
  const cleanNote = (record.note || '').trim();
  const zipOrderHint = Number(cleanZip.replace(/\D/g, '').slice(0, 6)) || 999;
  const sortOrder = record.sortOrder ?? existing?.sortOrder ?? zipOrderHint;

  if (existing) {
    dbInstance.run(`
      UPDATE taiwan_postal_codes SET
        cityId = ${resolvedCityId ? `'${resolvedCityId}'` : 'NULL'},
        city = '${cleanCity.replace(/'/g, "''")}',
        district = '${cleanDistrict.replace(/'/g, "''")}',
        postalCode = '${cleanZip.replace(/'/g, "''")}',
        isActive = ${isActive},
        aliases = '${aliasesJson}',
        replacedByCity = ${replacedByCity ? `'${replacedByCity.replace(/'/g, "''")}'` : 'NULL'},
        replacedByDistrict = ${replacedByDistrict ? `'${replacedByDistrict.replace(/'/g, "''")}'` : 'NULL'},
        note = ${cleanNote ? `'${cleanNote.replace(/'/g, "''")}'` : 'NULL'},
        sortOrder = ${sortOrder},
        updatedAt = '${now}'
      WHERE id = '${targetId}';
    `);
    logAudit(
      dbInstance,
      operatorName,
      '修改資料',
      '郵遞區號微型資料庫',
      `${cleanCity}${cleanDistrict}`,
      { 郵遞區號: existing.postalCode, 狀態: existing.isActive ? '啟用' : '停用' },
      { 郵遞區號: cleanZip, 狀態: isActive ? '啟用' : '歷史停用', 對應新制: replacedByCity ? `${replacedByCity}${replacedByDistrict}` : '無' }
    );
  } else {
    dbInstance.run(`
      INSERT INTO taiwan_postal_codes (
        id, cityId, city, district, postalCode, isActive, aliases, replacedByCity, replacedByDistrict, note, sortOrder, updatedAt
      ) VALUES (
        '${targetId}',
        ${resolvedCityId ? `'${resolvedCityId}'` : 'NULL'},
        '${cleanCity.replace(/'/g, "''")}',
        '${cleanDistrict.replace(/'/g, "''")}',
        '${cleanZip.replace(/'/g, "''")}',
        ${isActive},
        '${aliasesJson}',
        ${replacedByCity ? `'${replacedByCity.replace(/'/g, "''")}'` : 'NULL'},
        ${replacedByDistrict ? `'${replacedByDistrict.replace(/'/g, "''")}'` : 'NULL'},
        ${cleanNote ? `'${cleanNote.replace(/'/g, "''")}'` : 'NULL'},
        ${sortOrder},
        '${now}'
      );
    `);
    logAudit(
      dbInstance,
      operatorName,
      '新增資料',
      '郵遞區號微型資料庫',
      `${cleanCity}${cleanDistrict}`,
      undefined,
      { 縣市: cleanCity, 鄉鎮: cleanDistrict, 郵遞區號: cleanZip }
    );
  }

  syncPostalCatalogToUtility(dbInstance);
  saveDatabaseSnapshot();
  notifyListeners();
  return readPostalCatalogFromDb(dbInstance).find(r => r.id === targetId)!;
}

export function deleteTaiwanPostalCode(id: string, operatorName: string = '系統管理員'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const list = readPostalCatalogFromDb(dbInstance);
  const existing = list.find(r => r.id === id);
  if (!existing) return false;
  dbInstance.run(`DELETE FROM taiwan_postal_codes WHERE id = '${id.replace(/'/g, "''")}';`);
  logAudit(
    dbInstance,
    operatorName,
    '刪除資料',
    '郵遞區號微型資料庫',
    `${existing.city}${existing.district}`,
    { 郵遞區號: existing.postalCode },
    undefined
  );
  syncPostalCatalogToUtility(dbInstance);
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

export function resetTaiwanPostalCodesToDefault(operatorName: string = '系統管理員'): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) return;
  dbInstance.run(`DELETE FROM taiwan_postal_codes;`);
  dbInstance.run(`DELETE FROM taiwan_postal_cities;`);
  ensurePostalCatalogSeeded(dbInstance);
  logAudit(dbInstance, operatorName, '還原預設', '郵遞區號微型資料庫', '全台預設 368 鄉鎮市區', undefined, { 筆數: DEFAULT_TAIWAN_POSTAL_CODES.length });
  syncPostalCatalogToUtility(dbInstance);
  saveDatabaseSnapshot();
  notifyListeners();
}
