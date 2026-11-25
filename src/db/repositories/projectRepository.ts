import type {
  AddressHistoryEntry,
  InboundReceipt,
  Project,
  ProjectBudgetPartner,
  ProjectSite
} from '../../types/erp';
import {
  normalizeTaiwanCity,
  normalizeTaiwanDistrict,
  parseTaiwanAddress
} from '../../utils/taiwanPostalCodes';
import {
  getDbInstance,
  notifyListeners,
  parseJsonArraySafe,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { ensureDatabaseIntegrity } from '../core/dbIntegrity';
import { logAudit } from './auditRepository';
import { getAllInboundReceipts } from './inboundRepository';
import { getNextDocumentNumber } from './sequenceRepository';

// 讀取所有專案
export function getAllProjects(companyId?: string): Project[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureDatabaseIntegrity(dbInstance);

  try {
    const check3310 = dbInstance.exec(`SELECT count(*) FROM projects WHERE name LIKE '%3310%' OR projectCode = 'PRJ-2026-004';`);
    if (check3310.length && Number(check3310[0].values[0][0]) === 0) {
      dbInstance.run(`
        INSERT INTO projects (id, projectCode, name, ownerName, ownerTaxId, buildingType, workScope, contractAmount, budgetAmount, committedCost, actualCost, startDate, endDate, status, isLocked, companyId, isDeleted, version, createdAt, updatedAt)
        VALUES ('PRJ-04', 'PRJ-2026-004', '3310新建工程', '大城建設開發股份有限公司', '88991234', '集合住宅大樓', '建築結構主體工程', 35000000, 30000000, 18000000, 6500000, '2026-03-01', '2027-05-31', 'ACTIVE', 0, 'COMP-01', 0, 1, '2026-03-01', '2026-03-01');
      `);
      dbInstance.run(`
        INSERT INTO project_sites (id, projectId, siteName, address, contactPerson, contactPhone, permitNumber)
        VALUES ('SITE-04', 'PRJ-04', '3310新建工程工區', '彰化縣大城鄉大城段3310號工地', '蕭主任', '0912-331-000', '115建字第3310號');
      `);
      saveDatabaseSnapshot();
    }

    const checkInternal = dbInstance.exec(`SELECT count(*) FROM projects WHERE id = 'PRJ-INTERNAL';`);
    if (checkInternal.length && Number(checkInternal[0].values[0][0]) === 0) {
      dbInstance.run(`
        INSERT INTO projects (id, projectCode, name, ownerName, ownerTaxId, buildingType, workScope, contractAmount, budgetAmount, committedCost, actualCost, startDate, endDate, status, isLocked, companyId, isDeleted, version, createdAt, updatedAt)
        VALUES ('PRJ-INTERNAL', 'PRJ-INTERNAL', '廠內自用 (廠務/公共備料/機具車輛)', '內部廠區', '00000000', '廠務資產', '廠內車輛機具維護與廠務備料', 0, 0, 0, 0, '2026-01-01', '2030-12-31', 'ACTIVE', 0, 'COMP-01', 0, 1, '2026-01-01', '2026-01-01');
      `);
      saveDatabaseSnapshot();
    }

    dbInstance.run(`
      DELETE FROM projects 
      WHERE name = '358' OR projectCode = '358' OR name LIKE '廠內貨車%' OR name LIKE 'PC-200%' OR name LIKE '總廠廠務%' OR name LIKE '廠內堆高機%' OR name LIKE '廠內公務%';
    `);
  } catch (err) {
    // ignore
  }

  const sql = companyId
    ? `SELECT * FROM projects WHERE isDeleted = 0 AND companyId = '${companyId}' ORDER BY projectCode;`
    : `SELECT * FROM projects WHERE isDeleted = 0 ORDER BY projectCode;`;
  const res = dbInstance.exec(sql);
  if (!res.length || !res[0].values) return [];
  const cols = res[0].columns;
  const colMap = new Map<string, number>();
  cols.forEach((c, idx) => colMap.set(c, idx));
  const getVal = (row: any[], col: string) => {
    const idx = colMap.get(col);
    return idx !== undefined ? row[idx] : undefined;
  };

  return res[0].values.map(v => {
    const pId = String(getVal(v, 'id') || '');
    return {
      id: pId,
      projectCode: String(getVal(v, 'projectCode') || ''),
      name: String(getVal(v, 'name') || ''),
      ownerName: String(getVal(v, 'ownerName') || ''),
      ownerTaxId: String(getVal(v, 'ownerTaxId') || ''),
      buildingType: getVal(v, 'buildingType') ? String(getVal(v, 'buildingType')) : undefined,
      workScope: getVal(v, 'workScope') ? String(getVal(v, 'workScope')) : undefined,
      contractAmount: Number(getVal(v, 'contractAmount') || 0),
      budgetAmount: Number(getVal(v, 'budgetAmount') || 0),
      committedCost: Number(getVal(v, 'committedCost') || 0),
      actualCost: Number(getVal(v, 'actualCost') || 0),
      startDate: String(getVal(v, 'startDate') || ''),
      endDate: String(getVal(v, 'endDate') || ''),
      status: (getVal(v, 'status') || 'ACTIVE') as Project['status'],
      isLocked: Boolean(getVal(v, 'isLocked')),
      companyId: String(getVal(v, 'companyId') || ''),
      budgetPartners: getProjectBudgetPartners(pId),
      isDeleted: Boolean(getVal(v, 'isDeleted')),
      version: Number(getVal(v, 'version') || 1),
      createdAt: String(getVal(v, 'createdAt') || ''),
      updatedAt: String(getVal(v, 'updatedAt') || ''),
    };
  });
}

// ⚡ 一鍵極速建立專案案場 (支援進貨模糊比對就地建檔與未來案場模組共用)
export function quickCreateProject(
  name: string,
  siteName?: string,
  ownerName?: string,
  companyId: string = 'COMP-01',
  address?: string,
  ownerTaxId?: string,
  addressParts?: { postalCode?: string; city?: string; district?: string; streetAddress?: string }
): Project {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureDatabaseIntegrity(dbInstance);
  const now = new Date().toISOString();
  const id = `PRJ-${Date.now().toString().slice(-6)}`;
  const projectCode = getNextDocumentNumber('PRJ');
  const cleanName = name.trim();
  const cleanSite = siteName ? siteName.trim() : cleanName;
  const cleanOwner = ownerName ? ownerName.trim() : '自建案場業主';
  const cleanTaxId = ownerTaxId ? ownerTaxId.trim() : '';
  const cleanAddress = (address || '').trim();

  const hasParts = Boolean(
    addressParts?.postalCode ||
      addressParts?.city ||
      addressParts?.district ||
      addressParts?.streetAddress
  );
  const parsed = !hasParts && cleanAddress ? parseTaiwanAddress(cleanAddress) : {};
  const postalCode = (addressParts?.postalCode ?? parsed.postalCode ?? '').trim();
  const city = normalizeTaiwanCity(addressParts?.city ?? parsed.city ?? '');
  const district = normalizeTaiwanDistrict(addressParts?.district ?? parsed.district ?? '');
  const streetAddress = (
    addressParts?.streetAddress !== undefined
      ? addressParts.streetAddress
      : parsed.remaining !== undefined
      ? parsed.remaining
      : city
      ? ''
      : cleanAddress
  ).trim();

  dbInstance.run(`
    INSERT INTO projects (
      id, projectCode, name, ownerName, ownerTaxId, buildingType, workScope, contractAmount, budgetAmount, committedCost, actualCost, startDate, endDate, status, isLocked, companyId, isDeleted, version, createdAt, updatedAt
    ) VALUES (
      '${id}', '${projectCode}', '${cleanName.replace(/'/g, "''")}', '${cleanOwner.replace(/'/g, "''")}', '${cleanTaxId.replace(/'/g, "''")}', '集合住宅大樓', '統包新建工程', 0, 0, 0, 0, '${now.slice(0, 10)}', '', 'ACTIVE', 0, '${companyId}', 0, 1, '${now}', '${now}'
    );
  `);

  if (cleanSite) {
    const siteId = `SITE-${Date.now().toString().slice(-6)}`;
    dbInstance.run(`
      INSERT INTO project_sites (id, projectId, siteName, address, postalCode, city, district, streetAddress, contactPerson, contactPhone, permitNumber)
      VALUES (
        '${siteId}',
        '${id}',
        '${cleanSite.replace(/'/g, "''")}',
        '${cleanAddress.replace(/'/g, "''")}',
        ${postalCode ? `'${postalCode.replace(/'/g, "''")}'` : 'NULL'},
        ${city ? `'${city.replace(/'/g, "''")}'` : 'NULL'},
        ${district ? `'${district.replace(/'/g, "''")}'` : 'NULL'},
        ${streetAddress ? `'${streetAddress.replace(/'/g, "''")}'` : 'NULL'},
        '',
        '',
        ''
      );
    `);
  }

  saveDatabaseSnapshot();
  notifyListeners();
  return getAllProjects().find(p => p.id === id)!;
}

// 讀取單一專案
export function getProjectById(id: string): Project | null {
  const dbInstance = getDbInstance();
  if (!dbInstance) return null;
  const res = dbInstance.exec(`SELECT * FROM projects WHERE id = '${id.replace(/'/g, "''")}' AND isDeleted = 0;`);
  if (!res.length || !res[0].values.length) return null;
  const cols = res[0].columns;
  const colMap = new Map<string, number>();
  cols.forEach((c, idx) => colMap.set(c, idx));
  const getVal = (row: any[], col: string) => {
    const idx = colMap.get(col);
    return idx !== undefined ? row[idx] : undefined;
  };
  const v = res[0].values[0];
  return {
    id: String(getVal(v, 'id') || ''),
    projectCode: String(getVal(v, 'projectCode') || ''),
    name: String(getVal(v, 'name') || ''),
    ownerName: String(getVal(v, 'ownerName') || ''),
    ownerTaxId: String(getVal(v, 'ownerTaxId') || ''),
    buildingType: getVal(v, 'buildingType') ? String(getVal(v, 'buildingType')) : undefined,
    workScope: getVal(v, 'workScope') ? String(getVal(v, 'workScope')) : undefined,
    contractAmount: Number(getVal(v, 'contractAmount') || 0),
    budgetAmount: Number(getVal(v, 'budgetAmount') || 0),
    committedCost: Number(getVal(v, 'committedCost') || 0),
    actualCost: Number(getVal(v, 'actualCost') || 0),
    startDate: String(getVal(v, 'startDate') || ''),
    endDate: String(getVal(v, 'endDate') || ''),
    status: (getVal(v, 'status') || 'ACTIVE') as Project['status'],
    isLocked: Boolean(getVal(v, 'isLocked')),
    companyId: String(getVal(v, 'companyId') || ''),
    budgetPartners: getProjectBudgetPartners(String(getVal(v, 'id') || '')),
    isDeleted: Boolean(getVal(v, 'isDeleted')),
    version: Number(getVal(v, 'version') || 1),
    createdAt: String(getVal(v, 'createdAt') || ''),
    updatedAt: String(getVal(v, 'updatedAt') || ''),
  };
}

// 讀取所有工區案場現址資訊
export function getAllProjectSites(): ProjectSite[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureDatabaseIntegrity(dbInstance);
  try {
    const res = dbInstance.exec(`
      SELECT id, projectId, siteName, address, contactPerson, contactPhone, permitNumber, developerName, architect, constructor, shopDrawingVendorId, shopDrawingVendorName, landNumber,
             postalCode, city, district, streetAddress, addressHistory
      FROM project_sites;
    `);
    if (!res.length || !res[0].values) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      projectId: String(v[1]),
      siteName: String(v[2] || ''),
      address: String(v[3] || ''),
      contactPerson: String(v[4] || ''),
      contactPhone: String(v[5] || ''),
      permitNumber: v[6] ? String(v[6]) : undefined,
      developerName: v[7] ? String(v[7]) : undefined,
      architect: v[8] ? String(v[8]) : undefined,
      constructor: v[9] ? String(v[9]) : undefined,
      shopDrawingVendorId: v[10] ? String(v[10]) : undefined,
      shopDrawingVendorName: v[11] ? String(v[11]) : undefined,
      landNumber: v[12] ? String(v[12]) : undefined,
      postalCode: v[13] ? String(v[13]) : undefined,
      city: v[14] ? String(v[14]) : undefined,
      district: v[15] ? String(v[15]) : undefined,
      streetAddress: v[16] !== null && v[16] !== undefined ? String(v[16]) : undefined,
      addressHistory: parseJsonArraySafe<AddressHistoryEntry>(v[17]),
    }));
  } catch (e) {
    return [];
  }
}

// 讀取特定專案的工區現址資訊
export function getProjectSiteByProjectId(projectId: string): ProjectSite | null {
  const dbInstance = getDbInstance();
  if (!dbInstance) return null;
  ensureDatabaseIntegrity(dbInstance);
  try {
    const res = dbInstance.exec(`
      SELECT id, projectId, siteName, address, contactPerson, contactPhone, permitNumber, developerName, architect, constructor, shopDrawingVendorId, shopDrawingVendorName, landNumber,
             postalCode, city, district, streetAddress, addressHistory
      FROM project_sites 
      WHERE projectId = '${projectId.replace(/'/g, "''")}';
    `);
    if (!res.length || !res[0].values.length) return null;
    const v = res[0].values[0];
    return {
      id: String(v[0]),
      projectId: String(v[1]),
      siteName: String(v[2] || ''),
      address: String(v[3] || ''),
      contactPerson: String(v[4] || ''),
      contactPhone: String(v[5] || ''),
      permitNumber: v[6] ? String(v[6]) : undefined,
      developerName: v[7] ? String(v[7]) : undefined,
      architect: v[8] ? String(v[8]) : undefined,
      constructor: v[9] ? String(v[9]) : undefined,
      shopDrawingVendorId: v[10] ? String(v[10]) : undefined,
      shopDrawingVendorName: v[11] ? String(v[11]) : undefined,
      landNumber: v[12] ? String(v[12]) : undefined,
      postalCode: v[13] ? String(v[13]) : undefined,
      city: v[14] ? String(v[14]) : undefined,
      district: v[15] ? String(v[15]) : undefined,
      streetAddress: v[16] !== null && v[16] !== undefined ? String(v[16]) : undefined,
      addressHistory: parseJsonArraySafe<AddressHistoryEntry>(v[17]),
    };
  } catch (e) {
    return null;
  }
}

// ============================================================================
// 💼 專案案場之預計協力廠商列表 (支援多筆、預估發包金額與工項)
// ============================================================================
export function getProjectBudgetPartners(projectId: string): ProjectBudgetPartner[] {
  const dbInstance = getDbInstance();
  if (!dbInstance || !projectId) return [];
  ensureDatabaseIntegrity(dbInstance);
  try {
    const res = dbInstance.exec(`
      SELECT id, projectId, partnerId, partnerName, workScope, estimatedAmount, notes, createdAt, updatedAt
      FROM project_budget_partners
      WHERE projectId = '${projectId.replace(/'/g, "''")}'
      ORDER BY estimatedAmount DESC, id ASC;
    `);
    if (!res.length || !res[0].values) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      projectId: String(v[1]),
      partnerId: String(v[2]),
      partnerName: String(v[3] || ''),
      workScope: String(v[4] || ''),
      estimatedAmount: Number(v[5] || 0),
      notes: v[6] ? String(v[6]) : undefined,
      createdAt: v[7] ? String(v[7]) : undefined,
      updatedAt: v[8] ? String(v[8]) : undefined,
    }));
  } catch (e) {
    return [];
  }
}

export function saveProjectBudgetPartners(projectId: string, partners: ProjectBudgetPartner[]): void {
  const dbInstance = getDbInstance();
  if (!dbInstance || !projectId) return;
  ensureDatabaseIntegrity(dbInstance);
  const now = new Date().toISOString();

  dbInstance.run(`DELETE FROM project_budget_partners WHERE projectId = '${projectId.replace(/'/g, "''")}';`);

  for (let i = 0; i < partners.length; i++) {
    const p = partners[i];
    const pid = p.id || `PBP-${Date.now().toString().slice(-6)}-${i + 1}`;
    const pName = (p.partnerName || '').trim();
    const wScope = (p.workScope || '').trim();
    const est = Number(p.estimatedAmount) || 0;
    const n = (p.notes || '').trim();

    dbInstance.run(`
      INSERT INTO project_budget_partners (id, projectId, partnerId, partnerName, workScope, estimatedAmount, notes, createdAt, updatedAt)
      VALUES (
        '${pid}',
        '${projectId.replace(/'/g, "''")}',
        '${(p.partnerId || '').replace(/'/g, "''")}',
        '${pName.replace(/'/g, "''")}',
        '${wScope.replace(/'/g, "''")}',
        ${est},
        ${n ? `'${n.replace(/'/g, "''")}'` : 'NULL'},
        '${p.createdAt || now}',
        '${now}'
      );
    `);
  }

  saveDatabaseSnapshot();
  notifyListeners();
}

// ============================================================================
// 📊 取得特定案場中特定廠商之進貨、請款與支付統計 (純調取資料，依 projectId + partnerId 隔離)
// ============================================================================
export interface ProjectPartnerBillingSummary {
  projectId: string;
  partnerId: string;
  partnerName: string;
  workScope: string;
  estimatedAmount: number;
  totalInboundAmount: number;
  billedInboundAmount: number;
  pendingBillingAmount: number;
  totalPaidAmount: number;
  unpaidBalance: number;
  receiptCount: number;
  pendingReceiptCount: number;
  receipts: InboundReceipt[];
  statusLabel: 'NOT_DELIVERED' | 'PENDING_BILLING' | 'PENDING_PAYMENT' | 'FULLY_SETTLED';
  statusText: string;
}

export function getProjectPartnerBillingSummary(
  projectId: string,
  partnerId: string,
  estimatedAmount: number = 0,
  workScope: string = '',
  partnerName: string = ''
): ProjectPartnerBillingSummary {
  const dbInstance = getDbInstance();
  if (!dbInstance) {
    return {
      projectId,
      partnerId,
      partnerName,
      workScope,
      estimatedAmount,
      totalInboundAmount: 0,
      billedInboundAmount: 0,
      pendingBillingAmount: 0,
      totalPaidAmount: 0,
      unpaidBalance: 0,
      receiptCount: 0,
      pendingReceiptCount: 0,
      receipts: [],
      statusLabel: 'NOT_DELIVERED',
      statusText: '尚未進料'
    };
  }

  const allReceipts = getAllInboundReceipts({ projectId, vendorId: partnerId });
  const validReceipts = allReceipts.filter(r => r.status !== 'VOIDED' && !r.isDeleted);

  let totalInboundAmount = 0;
  let billedInboundAmount = 0;
  let pendingBillingAmount = 0;
  let pendingReceiptCount = 0;

  for (const r of validReceipts) {
    totalInboundAmount += r.totalAmount;
    if (r.billingStatus === 'BILLED') {
      billedInboundAmount += r.totalAmount;
    } else {
      pendingBillingAmount += r.totalAmount;
      pendingReceiptCount++;
    }
  }

  let totalValuationAmount = 0;
  let paidValuationAmount = 0;
  try {
    const valRes = dbInstance.exec(`
      SELECT totalAmount, status FROM valuations
      WHERE projectId = '${projectId.replace(/'/g, "''")}' 
        AND subcontractorId = '${partnerId.replace(/'/g, "''")}' 
        AND isDeleted = 0;
    `);
    if (valRes.length && valRes[0].values) {
      for (const row of valRes[0].values) {
        const amt = Number(row[0] || 0);
        const st = String(row[1]);
        totalValuationAmount += amt;
        if (st === 'PAID') {
          paidValuationAmount += amt;
        }
      }
    }
  } catch (_) {}

  let apPaidAmount = 0;
  try {
    const apRes = dbInstance.exec(`
      SELECT appliedAmount FROM accounts_payable
      WHERE vendorId = '${partnerId.replace(/'/g, "''")}'
        AND (sourceId IN (SELECT id FROM inbound_receipts WHERE projectId = '${projectId.replace(/'/g, "''")}')
             OR sourceId IN (SELECT id FROM valuations WHERE projectId = '${projectId.replace(/'/g, "''")}'));
    `);
    if (apRes.length && apRes[0].values) {
      for (const row of apRes[0].values) {
        apPaidAmount += Number(row[0] || 0);
      }
    }
  } catch (_) {}

  const effectiveBilled = Math.max(billedInboundAmount, totalValuationAmount);
  const effectivePaid = Math.max(paidValuationAmount, apPaidAmount);
  const unpaidBalance = Math.max(0, effectiveBilled - effectivePaid);

  let statusLabel: ProjectPartnerBillingSummary['statusLabel'] = 'NOT_DELIVERED';
  let statusText = '尚未進料';

  if (totalInboundAmount === 0 && effectiveBilled === 0) {
    statusLabel = 'NOT_DELIVERED';
    statusText = '尚未進料';
  } else if (pendingBillingAmount > 0) {
    statusLabel = 'PENDING_BILLING';
    statusText = `尚有 ${pendingReceiptCount} 筆進貨未請款 (NT$ ${pendingBillingAmount.toLocaleString()})`;
  } else if (unpaidBalance > 0) {
    statusLabel = 'PENDING_PAYMENT';
    statusText = `請款待付款 (NT$ ${unpaidBalance.toLocaleString()})`;
  } else {
    statusLabel = 'FULLY_SETTLED';
    statusText = '全部進貨已結清';
  }

  return {
    projectId,
    partnerId,
    partnerName: partnerName || (validReceipts[0]?.vendorNameSnapshot || partnerId),
    workScope,
    estimatedAmount,
    totalInboundAmount,
    billedInboundAmount: effectiveBilled,
    pendingBillingAmount,
    totalPaidAmount: effectivePaid,
    unpaidBalance,
    receiptCount: validReceipts.length,
    pendingReceiptCount,
    receipts: validReceipts,
    statusLabel,
    statusText
  };
}

// 正式新增案場
export function createProjectRecord(
  projectData: Partial<Project>,
  siteData?: Partial<ProjectSite>,
  operatorName: string = '系統管理員'
): Project {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureDatabaseIntegrity(dbInstance);
  const now = new Date().toISOString();
  const id = projectData.id || `PRJ-${Date.now().toString().slice(-6)}`;
  const projectCode = getNextDocumentNumber('PRJ');
  const cleanName = (projectData.name || '新建工程案場').trim();
  const cleanOwner = (projectData.ownerName || '自建案場業主').trim();
  const cleanOwnerTaxId = (projectData.ownerTaxId || '').trim();
  const contractAmount = Number(projectData.contractAmount) || 0;
  const budgetAmount = Number(projectData.budgetAmount) || 0;
  const committedCost = Number(projectData.committedCost) || 0;
  const actualCost = Number(projectData.actualCost) || 0;
  const startDate = projectData.startDate || now.slice(0, 10);
  const endDate = projectData.endDate || '';
  const status = projectData.status || 'ACTIVE';
  const isLocked = projectData.isLocked ? 1 : 0;
  const companyIdVal = projectData.companyId && projectData.companyId.trim() ? `'${projectData.companyId.trim()}'` : 'NULL';
  const cleanBuildingType = (projectData.buildingType || '').trim();
  const cleanWorkScope = (projectData.workScope || '').trim();

  dbInstance.run(`
    INSERT INTO projects (
      id, projectCode, name, ownerName, ownerTaxId, buildingType, workScope, contractAmount, budgetAmount, committedCost, actualCost, startDate, endDate, status, isLocked, companyId, isDeleted, version, createdAt, updatedAt
    ) VALUES (
      '${id}', '${projectCode}', '${cleanName.replace(/'/g, "''")}', '${cleanOwner.replace(/'/g, "''")}', '${cleanOwnerTaxId.replace(/'/g, "''")}',
      ${cleanBuildingType ? `'${cleanBuildingType.replace(/'/g, "''")}'` : 'NULL'},
      ${cleanWorkScope ? `'${cleanWorkScope.replace(/'/g, "''")}'` : 'NULL'},
      ${contractAmount}, ${budgetAmount}, ${committedCost}, ${actualCost}, '${startDate}', '${endDate}', '${status}', ${isLocked}, ${companyIdVal}, 0, 1, '${now}', '${now}'
    );
  `);

  if (siteData) {
    const siteId = siteData.id || `SITE-${Date.now().toString().slice(-6)}`;
    const cleanSiteName = (siteData.siteName || cleanName).trim();
    const cleanAddress = (siteData.address || '').trim();
    const cleanPostalCode = (siteData.postalCode || '').trim();
    const cleanCity = normalizeTaiwanCity(siteData.city || '');
    const cleanDistrict = normalizeTaiwanDistrict(siteData.district || '');
    const cleanStreetAddress = (siteData.streetAddress || '').trim();
    const addressHistoryJson = JSON.stringify(siteData.addressHistory || []).replace(/'/g, "''");
    const cleanPerson = (siteData.contactPerson || '').trim();
    const cleanPhone = (siteData.contactPhone || '').trim();
    const cleanPermit = (siteData.permitNumber || '').trim();
    const cleanDeveloper = (siteData.developerName || cleanOwner).trim();
    const cleanArchitect = (siteData.architect || '').trim();
    const cleanConstructor = (typeof siteData.constructor === 'string' ? siteData.constructor : '').trim();
    const cleanShopDrawingId = (siteData.shopDrawingVendorId || '').trim();
    const cleanShopDrawingName = (siteData.shopDrawingVendorName || '').trim();
    const cleanLandNumber = (siteData.landNumber || '').trim();

    dbInstance.run(`
      INSERT INTO project_sites (
        id, projectId, siteName, address, postalCode, city, district, streetAddress, addressHistory, contactPerson, contactPhone, permitNumber, developerName, architect, constructor, shopDrawingVendorId, shopDrawingVendorName, landNumber
      ) VALUES (
        '${siteId}', '${id}', '${cleanSiteName.replace(/'/g, "''")}', '${cleanAddress.replace(/'/g, "''")}',
        ${cleanPostalCode ? `'${cleanPostalCode.replace(/'/g, "''")}'` : 'NULL'},
        ${cleanCity ? `'${cleanCity.replace(/'/g, "''")}'` : 'NULL'},
        ${cleanDistrict ? `'${cleanDistrict.replace(/'/g, "''")}'` : 'NULL'},
        ${cleanStreetAddress ? `'${cleanStreetAddress.replace(/'/g, "''")}'` : 'NULL'},
        '${addressHistoryJson}',
        '${cleanPerson.replace(/'/g, "''")}', '${cleanPhone.replace(/'/g, "''")}', '${cleanPermit.replace(/'/g, "''")}',
        '${cleanDeveloper.replace(/'/g, "''")}', '${cleanArchitect.replace(/'/g, "''")}', '${cleanConstructor.replace(/'/g, "''")}',
        ${cleanShopDrawingId ? `'${cleanShopDrawingId}'` : 'NULL'}, '${cleanShopDrawingName.replace(/'/g, "''")}', '${cleanLandNumber.replace(/'/g, "''")}'
      );
    `);
  }

  if (projectData.budgetPartners && projectData.budgetPartners.length > 0) {
    saveProjectBudgetPartners(id, projectData.budgetPartners);
  }

  logAudit(dbInstance, operatorName, '新增資料', '專案案場工程', cleanName, undefined, { '專案代碼': projectCode, '合約總額': contractAmount, '起造人/業主': cleanOwner, '所屬法人': projectData.companyId || '未定' });
  saveDatabaseSnapshot();
  notifyListeners();
  return getProjectById(id)!;
}

// 完整更新案場資料
export function updateProjectRecord(
  id: string,
  projectData: Partial<Project>,
  siteData?: Partial<ProjectSite>,
  operatorName: string = '系統管理員'
): Project {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  ensureDatabaseIntegrity(dbInstance);
  const now = new Date().toISOString();
  const existing = getProjectById(id);
  if (!existing) throw new Error(`找不到案場 ${id}`);

  const updates: string[] = [`updatedAt = '${now}'`, `version = version + 1`];
  if (projectData.name !== undefined) updates.push(`name = '${projectData.name.trim().replace(/'/g, "''")}'`);
  if (projectData.ownerName !== undefined) updates.push(`ownerName = '${projectData.ownerName.trim().replace(/'/g, "''")}'`);
  if (projectData.ownerTaxId !== undefined) updates.push(`ownerTaxId = '${projectData.ownerTaxId.trim().replace(/'/g, "''")}'`);
  if (projectData.buildingType !== undefined) {
    updates.push(projectData.buildingType && projectData.buildingType.trim() ? `buildingType = '${projectData.buildingType.trim().replace(/'/g, "''")}'` : `buildingType = NULL`);
  }
  if (projectData.workScope !== undefined) {
    updates.push(projectData.workScope && projectData.workScope.trim() ? `workScope = '${projectData.workScope.trim().replace(/'/g, "''")}'` : `workScope = NULL`);
  }
  if (projectData.companyId !== undefined) {
    updates.push(projectData.companyId && projectData.companyId.trim() ? `companyId = '${projectData.companyId.trim()}'` : `companyId = NULL`);
  }
  if (projectData.contractAmount !== undefined) updates.push(`contractAmount = ${Number(projectData.contractAmount) || 0}`);
  if (projectData.budgetAmount !== undefined) updates.push(`budgetAmount = ${Number(projectData.budgetAmount) || 0}`);
  if (projectData.startDate !== undefined) updates.push(`startDate = '${projectData.startDate}'`);
  if (projectData.endDate !== undefined) updates.push(`endDate = '${projectData.endDate}'`);
  if (projectData.status !== undefined) updates.push(`status = '${projectData.status}'`);
  if (projectData.isLocked !== undefined) updates.push(`isLocked = ${projectData.isLocked ? 1 : 0}`);

  dbInstance.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = '${id}';`);

  if (siteData) {
    const existingSite = getProjectSiteByProjectId(id);
    const cleanSiteName = (siteData.siteName !== undefined ? siteData.siteName : existing.name).trim();
    const cleanAddress = (siteData.address !== undefined ? siteData.address : '').trim();
    const cleanPostalCode = (siteData.postalCode !== undefined ? siteData.postalCode : (existingSite?.postalCode || '')).trim();
    const cleanCity = normalizeTaiwanCity(siteData.city !== undefined ? siteData.city : (existingSite?.city || ''));
    const cleanDistrict = normalizeTaiwanDistrict(siteData.district !== undefined ? siteData.district : (existingSite?.district || ''));
    const cleanStreetAddress = (siteData.streetAddress !== undefined ? siteData.streetAddress : (existingSite?.streetAddress || '')).trim();
    const addressHistoryJson = JSON.stringify(
      siteData.addressHistory !== undefined ? siteData.addressHistory : (existingSite?.addressHistory || [])
    ).replace(/'/g, "''");
    const cleanPerson = (siteData.contactPerson !== undefined ? siteData.contactPerson : '').trim();
    const cleanPhone = (siteData.contactPhone !== undefined ? siteData.contactPhone : '').trim();
    const cleanPermit = (siteData.permitNumber !== undefined ? siteData.permitNumber : '').trim();
    const cleanDeveloper = (siteData.developerName !== undefined ? siteData.developerName : (existingSite?.developerName || existing.ownerName)).trim();
    const cleanArchitect = (siteData.architect !== undefined ? siteData.architect : (existingSite?.architect || '')).trim();
    const cleanConstructor = (
      Object.prototype.hasOwnProperty.call(siteData, 'constructor') &&
      typeof siteData.constructor === 'string'
        ? siteData.constructor
        : (existingSite?.constructor || '')
    ).trim();
    const cleanShopDrawingId = (siteData.shopDrawingVendorId !== undefined ? siteData.shopDrawingVendorId : (existingSite?.shopDrawingVendorId || '')).trim();
    const cleanShopDrawingName = (siteData.shopDrawingVendorName !== undefined ? siteData.shopDrawingVendorName : (existingSite?.shopDrawingVendorName || '')).trim();
    const cleanLandNumber = (siteData.landNumber !== undefined ? siteData.landNumber : (existingSite?.landNumber || '')).trim();

    if (existingSite) {
      dbInstance.run(`
        UPDATE project_sites 
        SET siteName = '${cleanSiteName.replace(/'/g, "''")}',
            address = '${cleanAddress.replace(/'/g, "''")}',
            postalCode = ${cleanPostalCode ? `'${cleanPostalCode.replace(/'/g, "''")}'` : 'NULL'},
            city = ${cleanCity ? `'${cleanCity.replace(/'/g, "''")}'` : 'NULL'},
            district = ${cleanDistrict ? `'${cleanDistrict.replace(/'/g, "''")}'` : 'NULL'},
            streetAddress = ${cleanStreetAddress ? `'${cleanStreetAddress.replace(/'/g, "''")}'` : 'NULL'},
            addressHistory = '${addressHistoryJson}',
            contactPerson = '${cleanPerson.replace(/'/g, "''")}',
            contactPhone = '${cleanPhone.replace(/'/g, "''")}',
            permitNumber = '${cleanPermit.replace(/'/g, "''")}',
            developerName = '${cleanDeveloper.replace(/'/g, "''")}',
            architect = '${cleanArchitect.replace(/'/g, "''")}',
            constructor = '${cleanConstructor.replace(/'/g, "''")}',
            shopDrawingVendorId = ${cleanShopDrawingId ? `'${cleanShopDrawingId}'` : 'NULL'},
            shopDrawingVendorName = '${cleanShopDrawingName.replace(/'/g, "''")}',
            landNumber = '${cleanLandNumber.replace(/'/g, "''")}'
        WHERE projectId = '${id}';
      `);
    } else {
      const siteId = `SITE-${Date.now().toString().slice(-6)}`;
      dbInstance.run(`
        INSERT INTO project_sites (
          id, projectId, siteName, address, postalCode, city, district, streetAddress, addressHistory, contactPerson, contactPhone, permitNumber, developerName, architect, constructor, shopDrawingVendorId, shopDrawingVendorName, landNumber
        ) VALUES (
          '${siteId}', '${id}', '${cleanSiteName.replace(/'/g, "''")}', '${cleanAddress.replace(/'/g, "''")}',
          ${cleanPostalCode ? `'${cleanPostalCode.replace(/'/g, "''")}'` : 'NULL'},
          ${cleanCity ? `'${cleanCity.replace(/'/g, "''")}'` : 'NULL'},
          ${cleanDistrict ? `'${cleanDistrict.replace(/'/g, "''")}'` : 'NULL'},
          ${cleanStreetAddress ? `'${cleanStreetAddress.replace(/'/g, "''")}'` : 'NULL'},
          '${addressHistoryJson}',
          '${cleanPerson.replace(/'/g, "''")}', '${cleanPhone.replace(/'/g, "''")}', '${cleanPermit.replace(/'/g, "''")}',
          '${cleanDeveloper.replace(/'/g, "''")}', '${cleanArchitect.replace(/'/g, "''")}', '${cleanConstructor.replace(/'/g, "''")}',
          ${cleanShopDrawingId ? `'${cleanShopDrawingId}'` : 'NULL'}, '${cleanShopDrawingName.replace(/'/g, "''")}', '${cleanLandNumber.replace(/'/g, "''")}'
        );
      `);
    }
  }

  if (projectData.budgetPartners !== undefined) {
    saveProjectBudgetPartners(id, projectData.budgetPartners);
  }

  logAudit(dbInstance, operatorName, '修改資料', '專案案場工程', existing.name, { '狀態': existing.status }, { '狀態': projectData.status || existing.status });
  saveDatabaseSnapshot();
  notifyListeners();
  return getProjectById(id)!;
}

// 軟刪除案場
export function deleteProjectRecord(id: string, operatorName: string = '系統管理員', reason: string = '日常管理刪除'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const existing = getProjectById(id);
  if (!existing) return false;
  const now = new Date().toISOString();
  dbInstance.run(`UPDATE projects SET isDeleted = 1, updatedAt = '${now}', version = version + 1 WHERE id = '${id}';`);
  logAudit(dbInstance, operatorName, '軟刪除', '專案案場工程', existing.name, {
    '案場代碼': existing.projectCode,
    '案場名稱': existing.name,
    '業主名稱': existing.ownerName,
    '合約金額': existing.contractAmount,
    '原狀態': '正常有效'
  }, {
    '刪除狀態': '已軟刪除 (一般同仁與Admin隱蔽，Superadmin 可在救援中心救回)',
    '刪除人': operatorName,
    '刪除原因': reason,
    '刪除時間': now
  });
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 🛡️ Superadmin 救援還原專案案場
export function restoreProjectRecord(id: string, operatorName: string = 'Superadmin'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const res = dbInstance.exec(`SELECT name, projectCode FROM projects WHERE id = '${id}';`);
  const name = res[0]?.values[0]?.[0] ? String(res[0].values[0][0]) : id;
  const code = res[0]?.values[0]?.[1] ? String(res[0].values[0][1]) : '';
  const now = new Date().toISOString();
  dbInstance.run(`UPDATE projects SET isDeleted = 0, updatedAt = '${now}', version = version + 1 WHERE id = '${id}';`);
  logAudit(dbInstance, operatorName, '救援還原', '專案案場工程', id, {
    '案場名稱': name,
    '案場代碼': code,
    '刪除狀態': '已軟刪除'
  }, {
    '案場名稱': name,
    '案場代碼': code,
    '刪除狀態': '已救援還原服役 (所有同仁立即可見)',
    '救援人': operatorName,
    '救援時間': now
  });
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 🗑️ Superadmin 永久物理抹除專案案場
export function purgeProjectRecord(id: string, operatorName: string = 'Superadmin'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const res = dbInstance.exec(`SELECT name, projectCode FROM projects WHERE id = '${id}';`);
  const name = res[0]?.values[0]?.[0] ? String(res[0].values[0][0]) : id;
  const now = new Date().toISOString();
  dbInstance.run(`DELETE FROM project_sites WHERE projectId = '${id}';`);
  dbInstance.run(`DELETE FROM projects WHERE id = '${id}';`);
  logAudit(dbInstance, operatorName, '永久抹除', '專案案場工程', id, {
    '案場名稱': name
  }, {
    '狀態': '已永久自資料庫物理清除',
    '執行人': operatorName,
    '抹除時間': now
  });
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 取得所有已被軟刪除之專案案場 (Superadmin 救援中心專用)
export function getDeletedProjects(): Project[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureDatabaseIntegrity(dbInstance);
  const sql = `SELECT * FROM projects WHERE isDeleted = 1 ORDER BY updatedAt DESC;`;
  const res = dbInstance.exec(sql);
  if (!res.length || !res[0].values) return [];
  const cols = res[0].columns;
  const colMap = new Map<string, number>();
  cols.forEach((c, idx) => colMap.set(c, idx));
  const getVal = (row: any[], col: string) => {
    const idx = colMap.get(col);
    return idx !== undefined ? row[idx] : undefined;
  };

  return res[0].values.map(v => {
    const pId = String(getVal(v, 'id') || '');
    return {
      id: pId,
      projectCode: String(getVal(v, 'projectCode') || ''),
      name: String(getVal(v, 'name') || ''),
      ownerName: String(getVal(v, 'ownerName') || ''),
      ownerTaxId: String(getVal(v, 'ownerTaxId') || ''),
      buildingType: getVal(v, 'buildingType') ? String(getVal(v, 'buildingType')) : undefined,
      workScope: getVal(v, 'workScope') ? String(getVal(v, 'workScope')) : undefined,
      contractAmount: Number(getVal(v, 'contractAmount') || 0),
      budgetAmount: Number(getVal(v, 'budgetAmount') || 0),
      committedCost: Number(getVal(v, 'committedCost') || 0),
      actualCost: Number(getVal(v, 'actualCost') || 0),
      startDate: String(getVal(v, 'startDate') || ''),
      endDate: String(getVal(v, 'endDate') || ''),
      status: (getVal(v, 'status') || 'ACTIVE') as Project['status'],
      isLocked: Boolean(getVal(v, 'isLocked')),
      companyId: String(getVal(v, 'companyId') || ''),
      budgetPartners: getProjectBudgetPartners(pId),
      isDeleted: true,
      version: Number(getVal(v, 'version') || 1),
      createdAt: String(getVal(v, 'createdAt') || ''),
      updatedAt: String(getVal(v, 'updatedAt') || ''),
    };
  });
}
