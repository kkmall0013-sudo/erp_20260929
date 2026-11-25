import type {
  AddressHistoryEntry,
  Company,
  CompanyBankAccount,
  KeyPerson,
  PhoneItem
} from '../../types/erp';
import {
  getDbInstance,
  notifyListeners,
  parseJsonArraySafe,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { ensureCompanyExtendedColumns } from '../core/schemaCore';
import { ensureDatabaseIntegrity } from '../core/dbIntegrity';
import { logAudit, recordAuditLog } from './auditRepository';

// 讀取所有集團、公司與個人實體
export function getAllCompanies(): Company[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureCompanyExtendedColumns(dbInstance);
  let res = dbInstance.exec(`
    SELECT id, companyCode, name, shortName, entityType, parentId, taxId, nationalId, representative, keyPersonnel, documentPrefix, phones, email, registeredAddress, contactAddress, capitalAmount, baseCurrency, isDeleted, version, createdAt, updatedAt, paymentScheduleDays,
           registeredPostalCode, registeredCity, registeredDistrict, registeredStreetAddress,
           contactPostalCode, contactCity, contactDistrict, contactStreetAddress,
           registeredAddressHistory, contactAddressHistory
    FROM companies 
    WHERE isDeleted = 0 
    ORDER BY CASE WHEN entityType = 'GROUP' THEN 0 WHEN entityType = 'CORPORATION' THEN 1 ELSE 2 END, companyCode;
  `);

  if (res.length > 0 && !res[0].values.some(v => String(v[0]) === 'COMP-03')) {
    dbInstance.run(`
      INSERT INTO companies (id, companyCode, name, shortName, entityType, parentId, taxId, nationalId, representative, keyPersonnel, documentPrefix, phones, email, registeredAddress, contactAddress, capitalAmount, baseCurrency, isDeleted, version, createdAt, updatedAt)
      VALUES ('COMP-03', 'CMP-TW03', '立勝工程實業股份有限公司', '立勝實業', 'CORPORATION', 'GRP-01', '13572468', NULL, '黃協理', '[]', 'LS', '[]', 'service@lisheng.tw', '台中市西屯區台灣大道三段99號', '台中市西屯區台灣大道三段99號', 30000000, 'TWD', 0, 1, '2026-01-01', '2026-01-01')
      ON CONFLICT(id) DO NOTHING;
    `);
    res = dbInstance.exec(`
      SELECT id, companyCode, name, shortName, entityType, parentId, taxId, nationalId, representative, keyPersonnel, documentPrefix, phones, email, registeredAddress, contactAddress, capitalAmount, baseCurrency, isDeleted, version, createdAt, updatedAt, paymentScheduleDays,
             registeredPostalCode, registeredCity, registeredDistrict, registeredStreetAddress,
             contactPostalCode, contactCity, contactDistrict, contactStreetAddress,
             registeredAddressHistory, contactAddressHistory
      FROM companies 
      WHERE isDeleted = 0 
      ORDER BY CASE WHEN entityType = 'GROUP' THEN 0 WHEN entityType = 'CORPORATION' THEN 1 ELSE 2 END, companyCode;
    `);
  }

  if (!res.length) return [];
  return res[0].values.map(v => {
    let keyPersonnelList: KeyPerson[] = [];
    try {
      if (v[9]) keyPersonnelList = JSON.parse(String(v[9]));
    } catch (e) {
      keyPersonnelList = [];
    }

    let phonesList: PhoneItem[] = [];
    try {
      if (v[11]) phonesList = JSON.parse(String(v[11]));
    } catch (e) {
      phonesList = [];
    }
    return {
      id: String(v[0]),
      companyCode: String(v[1]),
      name: String(v[2]),
      shortName: v[3] ? String(v[3]) : undefined,
      entityType: (v[4] as Company['entityType']) || 'CORPORATION',
      parentId: v[5] ? String(v[5]) : undefined,
      taxId: v[6] ? String(v[6]) : undefined,
      nationalId: v[7] ? String(v[7]) : undefined,
      representative: v[8] ? String(v[8]) : undefined,
      keyPersonnel: keyPersonnelList,
      documentPrefix: v[10] ? String(v[10]) : undefined,
      phones: phonesList,
      email: v[12] ? String(v[12]) : undefined,
      registeredAddress: v[13] ? String(v[13]) : undefined,
      contactAddress: v[14] ? String(v[14]) : undefined,
      capitalAmount: v[15] ? Number(v[15]) : 0,
      baseCurrency: String(v[16] || 'TWD'),
      isDeleted: Boolean(v[17]),
      version: Number(v[18] || 1),
      createdAt: String(v[19] || ''),
      updatedAt: String(v[20] || ''),
      paymentScheduleDays: v[21] ? String(v[21]) : undefined,
      registeredPostalCode: v[22] ? String(v[22]) : undefined,
      registeredCity: v[23] ? String(v[23]) : undefined,
      registeredDistrict: v[24] ? String(v[24]) : undefined,
      registeredStreetAddress: v[25] !== null && v[25] !== undefined ? String(v[25]) : undefined,
      contactPostalCode: v[26] ? String(v[26]) : undefined,
      contactCity: v[27] ? String(v[27]) : undefined,
      contactDistrict: v[28] ? String(v[28]) : undefined,
      contactStreetAddress: v[29] !== null && v[29] !== undefined ? String(v[29]) : undefined,
      registeredAddressHistory: parseJsonArraySafe<AddressHistoryEntry>(v[30]),
      contactAddressHistory: parseJsonArraySafe<AddressHistoryEntry>(v[31]),
    };
  });
}

// 賦予指定同仁操作特定法人之權限
export function grantCompanyAccessToUser(userId: string, companyId: string): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) return;
  try {
    const res = dbInstance.exec(`SELECT allowedCompanies FROM users WHERE id = '${userId}';`);
    if (res.length && res[0].values.length) {
      const curVal = res[0].values[0][0];
      const comps: string[] = curVal ? JSON.parse(String(curVal)) : ['COMP-01'];
      if (!comps.includes(companyId)) {
        comps.push(companyId);
        dbInstance.run(`UPDATE users SET allowedCompanies = '${JSON.stringify(comps)}', updatedAt = '${new Date().toISOString().substring(0, 10)}' WHERE id = '${userId}';`);
      }
    }
  } catch (err) {
    console.error('grantCompanyAccessToUser failed:', err);
  }
}

// 自動將新立法人加入所有具備全集團管理特許 (canManageAllCompanies=1) 或 Superadmin 之帳號
export function grantCompanyAccessToGlobalAdmins(companyId: string): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) return;
  try {
    const res = dbInstance.exec(`SELECT id, allowedCompanies FROM users WHERE role = 'SUPERADMIN' OR canManageAllCompanies = 1;`);
    if (res.length && res[0].values.length) {
      for (const row of res[0].values) {
        const uId = String(row[0]);
        const comps: string[] = row[1] ? JSON.parse(String(row[1])) : ['COMP-01'];
        if (!comps.includes(companyId)) {
          comps.push(companyId);
          dbInstance.run(`UPDATE users SET allowedCompanies = '${JSON.stringify(comps)}' WHERE id = '${uId}';`);
        }
      }
    }
  } catch (err) {
    console.error('grantCompanyAccessToGlobalAdmins failed:', err);
  }
}

// 儲存或更新公司法人/集團/個人實體 (僅記錄有修改之欄位，並以中文記錄)
export function saveCompany(
  company: Partial<Company> & { id: string; name: string; companyCode: string },
  operatorName: string = '系統管理員',
  creatorUserId?: string
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureCompanyExtendedColumns(dbInstance);
  const now = new Date().toISOString().substring(0, 10);
  const phonesJson = company.phones ? JSON.stringify(company.phones).replace(/'/g, "''") : '[]';
  const personnelJson = company.keyPersonnel ? JSON.stringify(company.keyPersonnel).replace(/'/g, "''") : '[]';
  const sqlNullableStr = (val?: string) => (val && val.trim() ? `'${val.trim().replace(/'/g, "''")}'` : 'NULL');

  const formatEntityCn = (t?: string) => t === 'GROUP' ? '集團母體' : t === 'PERSONAL' ? '個人帳戶' : '公司法人';
  const formatPhonesCn = (arr?: PhoneItem[]) => (arr && arr.length > 0) ? arr.map(p => `${p.type || '電話'}:${p.number}`).join('、') : '未填寫';
  const formatPersonnelCn = (arr?: KeyPerson[]) => (arr && arr.length > 0) ? arr.map(k => `${k.title}:${k.name}`).join('、') : '未填寫';

  const existingList = getAllCompanies();
  const oldComp = existingList.find(c => c.id === company.id);

  if (oldComp) {
    const beforeDiff: Record<string, string> = {};
    const afterDiff: Record<string, string> = {};

    if (company.name !== undefined && company.name !== oldComp.name) {
      beforeDiff['公司全銜'] = oldComp.name;
      afterDiff['公司全銜'] = company.name;
    }
    if ((company.shortName || '') !== (oldComp.shortName || '')) {
      beforeDiff['公司簡稱'] = oldComp.shortName || '未填寫';
      afterDiff['公司簡稱'] = company.shortName || '未填寫';
    }
    if ((company.entityType || 'CORPORATION') !== (oldComp.entityType || 'CORPORATION')) {
      beforeDiff['實體類型'] = formatEntityCn(oldComp.entityType);
      afterDiff['實體類型'] = formatEntityCn(company.entityType);
    }
    if ((company.taxId || '') !== (oldComp.taxId || '')) {
      beforeDiff['統一編號'] = oldComp.taxId || '未填寫';
      afterDiff['統一編號'] = company.taxId || '未填寫';
    }
    if ((company.nationalId || '') !== (oldComp.nationalId || '')) {
      beforeDiff['身分證字號'] = oldComp.nationalId || '未填寫';
      afterDiff['身分證字號'] = company.nationalId || '未填寫';
    }
    if ((company.representative || '') !== (oldComp.representative || '')) {
      beforeDiff['負責人'] = oldComp.representative || '未填寫';
      afterDiff['負責人'] = company.representative || '未填寫';
    }
    if ((company.documentPrefix || '') !== (oldComp.documentPrefix || '')) {
      beforeDiff['單據字軌'] = oldComp.documentPrefix || '未填寫';
      afterDiff['單據字軌'] = company.documentPrefix || '未填寫';
    }
    if ((company.email || '') !== (oldComp.email || '')) {
      beforeDiff['聯絡信箱'] = oldComp.email || '未填寫';
      afterDiff['聯絡信箱'] = company.email || '未填寫';
    }
    if ((company.registeredAddress || '') !== (oldComp.registeredAddress || '')) {
      beforeDiff['登記地址'] = oldComp.registeredAddress || '未填寫';
      afterDiff['登記地址'] = company.registeredAddress || '未填寫';
    }
    if ((company.contactAddress || '') !== (oldComp.contactAddress || '')) {
      beforeDiff['通訊地址'] = oldComp.contactAddress || '未填寫';
      afterDiff['通訊地址'] = company.contactAddress || '未填寫';
    }
    if (Number(company.capitalAmount || 0) !== Number(oldComp.capitalAmount || 0)) {
      beforeDiff['資本額'] = `NT$ ${Number(oldComp.capitalAmount || 0).toLocaleString()}`;
      afterDiff['資本額'] = `NT$ ${Number(company.capitalAmount || 0).toLocaleString()}`;
    }
    const oldPhonesStr = formatPhonesCn(oldComp.phones);
    const newPhonesStr = formatPhonesCn(company.phones);
    if (oldPhonesStr !== newPhonesStr) {
      beforeDiff['聯絡電話'] = oldPhonesStr;
      afterDiff['聯絡電話'] = newPhonesStr;
    }
    const oldPersStr = formatPersonnelCn(oldComp.keyPersonnel);
    const newPersStr = formatPersonnelCn(company.keyPersonnel);
    if (oldPersStr !== newPersStr) {
      beforeDiff['核心人員'] = oldPersStr;
      afterDiff['核心人員'] = newPersStr;
    }

    if ((company.baseCurrency || 'TWD') !== (oldComp.baseCurrency || 'TWD')) {
      beforeDiff['本位幣別'] = oldComp.baseCurrency || 'TWD';
      afterDiff['本位幣別'] = company.baseCurrency || 'TWD';
    }
    if ((company.paymentScheduleDays || '') !== (oldComp.paymentScheduleDays || '')) {
      beforeDiff['固定開票付款日'] = oldComp.paymentScheduleDays || '跟隨系統全域';
      afterDiff['固定開票付款日'] = company.paymentScheduleDays || '跟隨系統全域';
    }

    dbInstance.run(`
      UPDATE companies SET
        companyCode = '${company.companyCode}',
        name = '${company.name.replace(/'/g, "''")}',
        shortName = ${company.shortName ? `'${company.shortName.replace(/'/g, "''")}'` : 'NULL'},
        entityType = '${company.entityType || 'CORPORATION'}',
        parentId = ${company.parentId ? `'${company.parentId}'` : 'NULL'},
        taxId = ${company.taxId ? `'${company.taxId}'` : 'NULL'},
        nationalId = ${company.nationalId ? `'${company.nationalId}'` : 'NULL'},
        representative = ${company.representative ? `'${company.representative.replace(/'/g, "''")}'` : 'NULL'},
        keyPersonnel = '${personnelJson}',
        documentPrefix = ${company.documentPrefix ? `'${company.documentPrefix.replace(/'/g, "''")}'` : 'NULL'},
        phones = '${phonesJson}',
        email = ${company.email ? `'${company.email.replace(/'/g, "''")}'` : 'NULL'},
        registeredAddress = ${sqlNullableStr(company.registeredAddress)},
        registeredPostalCode = ${sqlNullableStr(company.registeredPostalCode)},
        registeredCity = ${sqlNullableStr(company.registeredCity)},
        registeredDistrict = ${sqlNullableStr(company.registeredDistrict)},
        registeredStreetAddress = ${sqlNullableStr(company.registeredStreetAddress)},
        registeredAddressHistory = '${JSON.stringify(company.registeredAddressHistory || oldComp.registeredAddressHistory || []).replace(/'/g, "''")}',
        contactAddress = ${sqlNullableStr(company.contactAddress)},
        contactPostalCode = ${sqlNullableStr(company.contactPostalCode)},
        contactCity = ${sqlNullableStr(company.contactCity)},
        contactDistrict = ${sqlNullableStr(company.contactDistrict)},
        contactStreetAddress = ${sqlNullableStr(company.contactStreetAddress)},
        contactAddressHistory = '${JSON.stringify(company.contactAddressHistory || oldComp.contactAddressHistory || []).replace(/'/g, "''")}',
        capitalAmount = ${company.capitalAmount || 0},
        baseCurrency = '${company.baseCurrency || 'TWD'}',
        paymentScheduleDays = ${company.paymentScheduleDays ? `'${company.paymentScheduleDays.replace(/'/g, "''")}'` : 'NULL'},
        version = version + 1,
        updatedAt = '${now}'
      WHERE id = '${company.id}';
    `);
    if (Object.keys(afterDiff).length > 0) {
      logAudit(dbInstance, operatorName, '修改資料', '集團與公司設定', company.shortName || company.name, beforeDiff, afterDiff, operatorName);
    }
  } else {
    dbInstance.run(`
      INSERT INTO companies (
        id, companyCode, name, shortName, entityType, parentId, taxId, nationalId, representative, keyPersonnel, documentPrefix, phones, email,
        registeredAddress, registeredPostalCode, registeredCity, registeredDistrict, registeredStreetAddress, registeredAddressHistory,
        contactAddress, contactPostalCode, contactCity, contactDistrict, contactStreetAddress, contactAddressHistory,
        capitalAmount, baseCurrency, paymentScheduleDays, isDeleted, version, createdAt, updatedAt
      )
      VALUES (
        '${company.id}',
        '${company.companyCode}',
        '${company.name.replace(/'/g, "''")}',
        ${company.shortName ? `'${company.shortName.replace(/'/g, "''")}'` : 'NULL'},
        '${company.entityType || 'CORPORATION'}',
        ${company.parentId ? `'${company.parentId}'` : 'NULL'},
        ${company.taxId ? `'${company.taxId}'` : 'NULL'},
        ${company.nationalId ? `'${company.nationalId}'` : 'NULL'},
        ${company.representative ? `'${company.representative.replace(/'/g, "''")}'` : 'NULL'},
        '${personnelJson}',
        ${company.documentPrefix ? `'${company.documentPrefix.replace(/'/g, "''")}'` : 'NULL'},
        '${phonesJson}',
        ${company.email ? `'${company.email.replace(/'/g, "''")}'` : 'NULL'},
        ${sqlNullableStr(company.registeredAddress)},
        ${sqlNullableStr(company.registeredPostalCode)},
        ${sqlNullableStr(company.registeredCity)},
        ${sqlNullableStr(company.registeredDistrict)},
        ${sqlNullableStr(company.registeredStreetAddress)},
        '${JSON.stringify(company.registeredAddressHistory || []).replace(/'/g, "''")}',
        ${sqlNullableStr(company.contactAddress)},
        ${sqlNullableStr(company.contactPostalCode)},
        ${sqlNullableStr(company.contactCity)},
        ${sqlNullableStr(company.contactDistrict)},
        ${sqlNullableStr(company.contactStreetAddress)},
        '${JSON.stringify(company.contactAddressHistory || []).replace(/'/g, "''")}',
        ${company.capitalAmount || 0},
        '${company.baseCurrency || 'TWD'}',
        ${company.paymentScheduleDays ? `'${company.paymentScheduleDays.replace(/'/g, "''")}'` : 'NULL'},
        0, 1, '${now}', '${now}'
      );
    `);

    if (creatorUserId) {
      grantCompanyAccessToUser(creatorUserId, company.id);
    }
    grantCompanyAccessToGlobalAdmins(company.id);

    logAudit(dbInstance, operatorName, '新增資料', '集團與公司設定', company.shortName || company.name, undefined, {
      '公司全銜': company.name,
      '公司簡稱': company.shortName || '無',
      '實體類型': formatEntityCn(company.entityType),
      '統一編號': company.taxId || '無'
    }, operatorName);
  }

  saveDatabaseSnapshot();
  notifyListeners();
}

// 刪除公司法人/集團/個人實體 (安全防呆：有子實體或有專案時禁止刪除)
export function deleteCompany(companyId: string, operatorName: string = '系統管理員'): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');

  const projCheck = dbInstance.exec(`SELECT count(*) FROM projects WHERE companyId = '${companyId}' AND isDeleted = 0;`);
  if (projCheck.length && Number(projCheck[0].values[0][0]) > 0) {
    throw new Error(`無法刪除：尚有 ${projCheck[0].values[0][0]} 個進行中專案工程綁定此公司法人，請先移轉或結案專案！`);
  }

  const childCheck = dbInstance.exec(`SELECT count(*) FROM companies WHERE parentId = '${companyId}' AND isDeleted = 0;`);
  if (childCheck.length && Number(childCheck[0].values[0][0]) > 0) {
    throw new Error(`無法刪除：該集團下尚有 ${childCheck[0].values[0][0]} 個子公司或個人帳戶，請先將子公司移轉或刪除！`);
  }

  const targetComp = getAllCompanies().find(c => c.id === companyId);
  const compDisplayName = targetComp ? (targetComp.shortName || targetComp.name) : companyId;

  dbInstance.run(`UPDATE companies SET isDeleted = 1, updatedAt = '${new Date().toISOString().substring(0, 10)}' WHERE id = '${companyId}';`);

  try {
    const userRows = dbInstance.exec(`SELECT id, defaultCompanyId, allowedCompanies FROM users;`);
    if (userRows.length && userRows[0].values.length) {
      for (const row of userRows[0].values) {
        const uId = String(row[0]);
        const defComp = String(row[1] || 'COMP-01');
        let comps: string[] = row[2] ? JSON.parse(String(row[2])) : ['COMP-01'];
        if (comps.includes(companyId)) {
          comps = comps.filter(id => id !== companyId);
          if (comps.length === 0) comps = ['COMP-01'];
          const newDef = (defComp === companyId) ? comps[0] : defComp;
          dbInstance.run(`UPDATE users SET defaultCompanyId = '${newDef}', allowedCompanies = '${JSON.stringify(comps)}' WHERE id = '${uId}';`);
        }
      }
    }
  } catch (err) {
    console.error('Clean deleted company from users failed:', err);
  }

  logAudit(dbInstance, operatorName, '軟刪除', '集團與公司設定', compDisplayName, { '實體狀態': '啟用中' }, { '實體狀態': '已軟刪除 (一般同仁與Admin隱蔽，Superadmin 可在救援中心救回)' }, operatorName);
  saveDatabaseSnapshot();
  notifyListeners();
}

// 取得所有已被軟刪除之公司法人/集團/個人實體 (Superadmin 救援中心專用)
export function getDeletedCompanies(): Company[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureDatabaseIntegrity(dbInstance);
  ensureCompanyExtendedColumns(dbInstance);
  const res = dbInstance.exec(`
    SELECT id, companyCode, name, shortName, entityType, parentId, taxId, nationalId, representative, keyPersonnel, documentPrefix, phones, email, registeredAddress, contactAddress, capitalAmount, baseCurrency, isDeleted, version, createdAt, updatedAt, paymentScheduleDays,
           registeredPostalCode, registeredCity, registeredDistrict, registeredStreetAddress,
           contactPostalCode, contactCity, contactDistrict, contactStreetAddress
    FROM companies
    WHERE isDeleted = 1
    ORDER BY updatedAt DESC;
  `);
  if (!res.length) return [];
  return res[0].values.map(v => {
    let keyPersonnelList: KeyPerson[] = [];
    try { if (v[9]) keyPersonnelList = JSON.parse(String(v[9])); } catch { keyPersonnelList = []; }
    let phonesList: PhoneItem[] = [];
    try { if (v[11]) phonesList = JSON.parse(String(v[11])); } catch { phonesList = []; }
    return {
      id: String(v[0]),
      companyCode: String(v[1]),
      name: String(v[2]),
      shortName: v[3] ? String(v[3]) : undefined,
      entityType: (v[4] as Company['entityType']) || 'CORPORATION',
      parentId: v[5] ? String(v[5]) : undefined,
      taxId: v[6] ? String(v[6]) : undefined,
      nationalId: v[7] ? String(v[7]) : undefined,
      representative: v[8] ? String(v[8]) : undefined,
      keyPersonnel: keyPersonnelList,
      documentPrefix: v[10] ? String(v[10]) : undefined,
      phones: phonesList,
      email: v[12] ? String(v[12]) : undefined,
      registeredAddress: v[13] ? String(v[13]) : undefined,
      contactAddress: v[14] ? String(v[14]) : undefined,
      capitalAmount: v[15] ? Number(v[15]) : 0,
      baseCurrency: String(v[16] || 'TWD'),
      isDeleted: Boolean(v[17]),
      version: Number(v[18] || 1),
      createdAt: String(v[19] || ''),
      updatedAt: String(v[20] || ''),
      paymentScheduleDays: v[21] ? String(v[21]) : undefined,
      registeredPostalCode: v[22] ? String(v[22]) : undefined,
      registeredCity: v[23] ? String(v[23]) : undefined,
      registeredDistrict: v[24] ? String(v[24]) : undefined,
      registeredStreetAddress: v[25] !== null && v[25] !== undefined ? String(v[25]) : undefined,
      contactPostalCode: v[26] ? String(v[26]) : undefined,
      contactCity: v[27] ? String(v[27]) : undefined,
      contactDistrict: v[28] ? String(v[28]) : undefined,
      contactStreetAddress: v[29] !== null && v[29] !== undefined ? String(v[29]) : undefined,
    };
  });
}

// 🛡️ Superadmin 救援還原公司法人/集團/私帳實體
export function restoreCompanyRecord(companyId: string, operatorName: string = 'Superadmin'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const res = dbInstance.exec(`SELECT name, shortName, companyCode FROM companies WHERE id = '${companyId}';`);
  if (!res.length || !res[0].values.length) return false;
  const name = String(res[0].values[0][0] || companyId);
  const shortName = res[0].values[0][1] ? String(res[0].values[0][1]) : name;
  const code = res[0].values[0][2] ? String(res[0].values[0][2]) : '';
  const now = new Date().toISOString().substring(0, 10);

  dbInstance.run(`UPDATE companies SET isDeleted = 0, updatedAt = '${now}', version = version + 1 WHERE id = '${companyId}';`);
  grantCompanyAccessToGlobalAdmins(companyId);

  logAudit(dbInstance, operatorName, '救援還原', '集團與公司設定', companyId, {
    '實體名稱': shortName,
    '實體代碼': code,
    '刪除狀態': '已軟刪除'
  }, {
    '實體名稱': shortName,
    '實體代碼': code,
    '刪除狀態': '已救援還原服役 (已恢復 Superadmin/全集團特許存取)',
    '救援人': operatorName,
    '救援時間': now
  });
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 🗑️ Superadmin 永久物理抹除公司法人/集團/私帳實體 (含完整性檢查)
export function purgeCompanyRecord(companyId: string, operatorName: string = 'Superadmin'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const projChk = dbInstance.exec(`SELECT count(*) FROM projects WHERE companyId = '${companyId}';`);
  if (projChk.length && Number(projChk[0].values[0][0]) > 0) {
    throw new Error(`無法物理抹除：此法人仍關聯 ${projChk[0].values[0][0]} 筆工程案場紀錄（含歷史或軟刪除），請先清除關聯案場！`);
  }
  const bankChk = dbInstance.exec(`SELECT count(*) FROM company_bank_accounts WHERE companyId = '${companyId}';`);
  if (bankChk.length && Number(bankChk[0].values[0][0]) > 0) {
    throw new Error(`無法物理抹除：此法人仍關聯 ${bankChk[0].values[0][0]} 個出款銀行帳戶，請先刪除專戶後再抹除！`);
  }
  const res = dbInstance.exec(`SELECT name, shortName FROM companies WHERE id = '${companyId}';`);
  const name = res[0]?.values[0]?.[1] ? String(res[0].values[0][1]) : (res[0]?.values[0]?.[0] ? String(res[0].values[0][0]) : companyId);
  const now = new Date().toISOString();

  dbInstance.run(`DELETE FROM companies WHERE id = '${companyId}';`);
  logAudit(dbInstance, operatorName, '永久抹除', '集團與公司設定', companyId, {
    '實體名稱': name
  }, {
    '狀態': '已永久自資料庫物理清除',
    '執行人': operatorName,
    '抹除時間': now
  });
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// -------------------------------------------------------------
// 🏛️ 公司出款銀行專戶與支票簿字軌 CRUD
// -------------------------------------------------------------
export function getAllCompanyBankAccounts(): CompanyBankAccount[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];

  try { dbInstance.run(`ALTER TABLE company_bank_accounts ADD COLUMN checkPrefix TEXT DEFAULT 'CQ';`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE company_bank_accounts ADD COLUMN nextCheckNumber INTEGER DEFAULT 1001;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE company_bank_accounts ADD COLUMN checkDigits INTEGER DEFAULT 6;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE company_bank_accounts ADD COLUMN supportsCheck INTEGER DEFAULT 1;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE company_bank_accounts ADD COLUMN supportsTransfer INTEGER DEFAULT 1;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE company_bank_accounts ADD COLUMN paymentScheduleDays TEXT;`); } catch (_) {}

  try {
    const countCheck = dbInstance.exec(`SELECT count(*) FROM company_bank_accounts;`);
    if (!countCheck.length || Number(countCheck[0].values[0][0]) === 0) {
      dbInstance.run(`
        INSERT INTO company_bank_accounts (id, companyId, bankCode, bankName, branchName, accountNumber, accountName, isVirtualAccount, initialBalance, currentBalance, currency, status, checkPrefix, nextCheckNumber, checkDigits, supportsCheck, supportsTransfer, paymentScheduleDays)
        VALUES
          ('BANK-01', 'COMP-01', '004', '臺灣銀行', '營業部 (大巨營造甲存支票戶)', '004001998822', '台灣大巨營造工程股份有限公司', 0, 25000000, 24500000, 'TWD', 'ACTIVE', 'TW', 1001, 6, 1, 1, '7,17,27'),
          ('BANK-02', 'COMP-01', '822', '中國信託商業銀行', '松高分行 (大巨營運專戶)', '822002334455', '台灣大巨營造工程股份有限公司', 0, 18000000, 17800000, 'TWD', 'ACTIVE', 'CT', 2001, 6, 1, 1, '7,17,27'),
          ('BANK-03', 'COMP-02', '808', '玉山商業銀行', '復興分行 (宏達機電甲存專戶)', '808003445566', '宏達機電工程股份有限公司', 0, 8500000, 8500000, 'TWD', 'ACTIVE', 'ES', 3001, 6, 1, 1, '7,17,27'),
          ('BANK-BOSS', 'BOSS-01', 'VIRT', '老闆口袋專戶', '林董私人代墊專戶', 'BOSS-POCKET-01', '林大巨 董事長私帳', 1, 5000000, 5000000, 'TWD', 'ACTIVE', 'BS', 9001, 6, 1, 1, NULL);
      `);
    } else {
      const comp02Exists = dbInstance.exec(`SELECT count(*) FROM companies WHERE id = 'COMP-02' AND isDeleted = 0;`);
      const comp02BankExists = dbInstance.exec(`SELECT count(*) FROM company_bank_accounts WHERE companyId = 'COMP-02' AND isVirtualAccount = 0;`);
      if (comp02Exists.length && Number(comp02Exists[0].values[0][0]) > 0 && (!comp02BankExists.length || Number(comp02BankExists[0].values[0][0]) === 0)) {
        const bank03Taken = dbInstance.exec(`SELECT count(*) FROM company_bank_accounts WHERE id = 'BANK-03';`);
        const newComp02BankId = bank03Taken.length && Number(bank03Taken[0].values[0][0]) > 0 ? 'BANK-COMP02-01' : 'BANK-03';
        dbInstance.run(`
          INSERT INTO company_bank_accounts (id, companyId, bankCode, bankName, branchName, accountNumber, accountName, isVirtualAccount, initialBalance, currentBalance, currency, status, checkPrefix, nextCheckNumber, checkDigits, supportsCheck, supportsTransfer, paymentScheduleDays)
          VALUES ('${newComp02BankId}', 'COMP-02', '808', '玉山商業銀行', '復興分行 (宏達機電甲存專戶)', '808003445566', '宏達機電工程股份有限公司', 0, 8500000, 8500000, 'TWD', 'ACTIVE', 'ES', 3001, 6, 1, 1, '7,17,27');
        `);
      }
      const bossBankExists = dbInstance.exec(`SELECT count(*) FROM company_bank_accounts WHERE isVirtualAccount = 1 OR companyId = 'BOSS-01';`);
      if (!bossBankExists.length || Number(bossBankExists[0].values[0][0]) === 0) {
        dbInstance.run(`
          INSERT INTO company_bank_accounts (id, companyId, bankCode, bankName, branchName, accountNumber, accountName, isVirtualAccount, initialBalance, currentBalance, currency, status, checkPrefix, nextCheckNumber, checkDigits, supportsCheck, supportsTransfer, paymentScheduleDays)
          VALUES ('BANK-BOSS', 'BOSS-01', '999', '林董私人代墊專戶', '虛擬帳戶 (老闆口袋)', 'BOSS-POCKET-01', '林大巨 創辦人', 1, 500000, 500000, 'TWD', 'ACTIVE', 'BS', 9001, 6, 1, 1, NULL);
        `);
      }
    }
  } catch (_) {}

  try {
    const res = dbInstance.exec(`SELECT id, companyId, bankCode, bankName, branchName, accountNumber, accountName, isVirtualAccount, initialBalance, currentBalance, currency, status, checkPrefix, nextCheckNumber, checkDigits, supportsCheck, supportsTransfer, paymentScheduleDays FROM company_bank_accounts ORDER BY isVirtualAccount ASC, bankName ASC;`);
    if (!res.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      companyId: String(v[1]),
      bankCode: String(v[2]),
      bankName: String(v[3]),
      branchName: v[4] ? String(v[4]) : undefined,
      accountNumber: String(v[5]),
      accountName: String(v[6]),
      isVirtualAccount: Boolean(v[7]),
      initialBalance: Number(v[8] || 0),
      currentBalance: Number(v[9] || 0),
      currency: String(v[10] || 'TWD'),
      status: (v[11] || 'ACTIVE') as CompanyBankAccount['status'],
      checkPrefix: v[12] ? String(v[12]) : 'CQ',
      nextCheckNumber: v[13] ? Number(v[13]) : 1001,
      checkDigits: v[14] ? Number(v[14]) : 6,
      supportsCheck: v[15] !== null && v[15] !== undefined ? Boolean(v[15]) : true,
      supportsTransfer: v[16] !== null && v[16] !== undefined ? Boolean(v[16]) : true,
      paymentScheduleDays: v[17] ? String(v[17]) : undefined,
    }));
  } catch (e) {
    try {
      const res2 = dbInstance.exec(`SELECT * FROM company_bank_accounts ORDER BY isVirtualAccount ASC, bankName ASC;`);
      if (!res2.length) return [];
      return res2[0].values.map(v => ({
        id: String(v[0]),
        companyId: String(v[1]),
        bankCode: String(v[2]),
        bankName: String(v[3]),
        branchName: v[4] ? String(v[4]) : undefined,
        accountNumber: String(v[5]),
        accountName: String(v[6]),
        isVirtualAccount: Boolean(v[7]),
        initialBalance: Number(v[8] || 0),
        currentBalance: Number(v[9] || 0),
        currency: String(v[10] || 'TWD'),
        status: (v[11] || 'ACTIVE') as CompanyBankAccount['status'],
        checkPrefix: 'CQ',
        nextCheckNumber: 1001,
        checkDigits: 6,
        supportsCheck: true,
        supportsTransfer: true,
      }));
    } catch (_) {
      return [];
    }
  }
}

// 更新銀行帳戶支票簿字軌與起始連續編號
export function updateBankAccountCheckSequence(
  id: string,
  checkPrefix: string,
  nextCheckNumber: number,
  checkDigits: number = 6,
  operatorName: string = '系統管理員'
): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  dbInstance.run(`
    UPDATE company_bank_accounts
    SET checkPrefix = '${checkPrefix.replace(/'/g, "''")}',
        nextCheckNumber = ${nextCheckNumber},
        checkDigits = ${checkDigits}
    WHERE id = '${id}';
  `);

  recordAuditLog(
    operatorName,
    '設定銀行帳戶支票簿起始號碼',
    '銀行帳戶支票簿管理',
    id,
    {
      '帳戶ID': id,
      '支票字軌': checkPrefix,
      '下一張連續票號': nextCheckNumber,
      '票號位數': checkDigits
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();
}

// 🏛️ 新增或修改公司出款銀行帳戶主檔 (含支票簿起號、支援付款方式與付款日規則)
export function saveCompanyBankAccount(
  data: Partial<CompanyBankAccount> & { companyId: string; bankName: string; accountNumber: string },
  operatorName: string = '系統管理員'
): CompanyBankAccount {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  try { dbInstance.run(`ALTER TABLE company_bank_accounts ADD COLUMN supportsCheck INTEGER DEFAULT 1;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE company_bank_accounts ADD COLUMN supportsTransfer INTEGER DEFAULT 1;`); } catch (_) {}
  try { dbInstance.run(`ALTER TABLE company_bank_accounts ADD COLUMN paymentScheduleDays TEXT;`); } catch (_) {}

  const id = data.id || `BANK-${Date.now().toString().slice(-6)}`;
  const cleanBankName = data.bankName.replace(/'/g, "''");
  const cleanBranch = (data.branchName || '').replace(/'/g, "''");
  const cleanAccNo = data.accountNumber.replace(/'/g, "''");
  const cleanAccName = (data.accountName || data.bankName).replace(/'/g, "''");
  const prefix = (data.checkPrefix || 'CQ').replace(/'/g, "''").toUpperCase();
  const nextCheck = Number(data.nextCheckNumber) || 1001;
  const digits = Number(data.checkDigits) || 6;
  const isVirt = data.isVirtualAccount ? 1 : 0;
  const initBal = Number(data.initialBalance) || 0;
  const currBal = data.currentBalance !== undefined ? Number(data.currentBalance) : initBal;
  const status = data.status || 'ACTIVE';
  const currency = data.currency || 'TWD';
  const bankCode = (data.bankCode || '004').replace(/'/g, "''");
  const supCheck = data.supportsCheck !== false ? 1 : 0;
  const supTransfer = data.supportsTransfer !== false ? 1 : 0;
  const schedDays = data.paymentScheduleDays?.trim()
    ? `'${data.paymentScheduleDays.trim().replace(/'/g, "''")}'`
    : 'NULL';

  dbInstance.run(`
    INSERT INTO company_bank_accounts (
      id, companyId, bankCode, bankName, branchName, accountNumber, accountName,
      isVirtualAccount, initialBalance, currentBalance, currency, status,
      checkPrefix, nextCheckNumber, checkDigits, supportsCheck, supportsTransfer, paymentScheduleDays
    ) VALUES (
      '${id}', '${data.companyId}', '${bankCode}', '${cleanBankName}', '${cleanBranch}',
      '${cleanAccNo}', '${cleanAccName}', ${isVirt}, ${initBal}, ${currBal},
      '${currency}', '${status}', '${prefix}', ${nextCheck}, ${digits},
      ${supCheck}, ${supTransfer}, ${schedDays}
    )
    ON CONFLICT(id) DO UPDATE SET
      companyId = excluded.companyId,
      bankCode = excluded.bankCode,
      bankName = excluded.bankName,
      branchName = excluded.branchName,
      accountNumber = excluded.accountNumber,
      accountName = excluded.accountName,
      isVirtualAccount = excluded.isVirtualAccount,
      status = excluded.status,
      checkPrefix = excluded.checkPrefix,
      nextCheckNumber = excluded.nextCheckNumber,
      checkDigits = excluded.checkDigits,
      supportsCheck = excluded.supportsCheck,
      supportsTransfer = excluded.supportsTransfer,
      paymentScheduleDays = excluded.paymentScheduleDays;
  `);

  recordAuditLog(
    operatorName,
    data.id ? '更新公司銀行帳戶' : '新增公司銀行帳戶',
    '銀行帳戶管理',
    id,
    {
      '帳戶ID': id,
      '所屬法人': data.companyId,
      '銀行名稱': cleanBankName,
      '帳號': cleanAccNo,
      '支援支票': supCheck ? '是' : '否',
      '支援轉帳': supTransfer ? '是' : '否',
      '付款日規則': data.paymentScheduleDays?.trim() || '套用系統預設',
      '支票字軌': prefix,
      '起始票號': nextCheck
    }
  );

  saveDatabaseSnapshot();
  notifyListeners();
  return {
    id,
    companyId: data.companyId,
    bankCode,
    bankName: data.bankName,
    branchName: data.branchName,
    accountNumber: data.accountNumber,
    accountName: data.accountName || data.bankName,
    isVirtualAccount: Boolean(data.isVirtualAccount),
    initialBalance: initBal,
    currentBalance: currBal,
    currency,
    status,
    checkPrefix: prefix,
    nextCheckNumber: nextCheck,
    checkDigits: digits,
    supportsCheck: Boolean(supCheck),
    supportsTransfer: Boolean(supTransfer),
    paymentScheduleDays: data.paymentScheduleDays?.trim() || undefined,
  };
}

// 刪除公司出款銀行帳戶
export function deleteCompanyBankAccount(id: string, operatorName: string = '系統管理員'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const resChk = dbInstance.exec(`
    SELECT count(*) FROM fin_payment_records WHERE bankAccountId = '${id}' AND isDeleted = 0;
  `);
  if (resChk.length && Number(resChk[0].values[0][0]) > 0) {
    throw new Error('此銀行帳戶已存在開立之付款單據紀錄，禁止物理刪除！若不再使用請在編輯中將狀態設為「停用」。');
  }

  dbInstance.run(`DELETE FROM company_bank_accounts WHERE id = '${id}';`);
  recordAuditLog(operatorName, '刪除銀行帳戶', '銀行帳戶管理', id, { '帳戶ID': id });
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}
