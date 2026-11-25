import type {
  BusinessPartner,
  Item,
  PartnerBusinessCard,
  PartnerChequeRecord
} from '../../types/erp';
import {
  normalizeTaiwanCity,
  parseTaiwanAddress
} from '../../utils/taiwanPostalCodes';
import {
  getDbInstance,
  notifyListeners,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { ensureDatabaseIntegrity } from '../core/dbIntegrity';
import { logAudit, recordAuditLog } from './auditRepository';
import {
  getAllBusinessPartners,
  getBusinessPartnerById,
  saveBusinessPartner
} from './partnerRepository';

// ⚡ 讀取物料主檔與一鍵建立新物料用料
export function getAllItems(): Item[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  const res = dbInstance.exec(`
    SELECT id, itemCode, name, category, unit, unitPrice, standardCost, isDeleted
    FROM items
    WHERE isDeleted = 0
    ORDER BY itemCode;
  `);
  if (!res.length || !res[0].values) return [];
  return res[0].values.map(v => ({
    id: String(v[0]),
    itemCode: String(v[1]),
    name: String(v[2]),
    category: String(v[3] || '一般材料'),
    unit: String(v[4] || '式'),
    unitPrice: Number(v[5]) || 0,
    standardCost: Number(v[6]) || 0,
    isDeleted: Boolean(v[7]),
  }));
}

export function quickCreateItem(
  name: string,
  unit: string = '式',
  unitPrice: number = 0,
  category: string = '工程材料'
): Item {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const cleanName = name.trim();
  const id = `ITEM-${Date.now().toString().slice(-6)}`;
  const itemCode = `MAT-${Date.now().toString().slice(-4)}`;
  const cleanUnit = (unit || '式').trim();
  const cleanCategory = (category || '工程材料').trim();
  const price = Number(unitPrice) || 0;

  dbInstance.run(`
    INSERT INTO items (id, itemCode, name, category, unit, unitPrice, standardCost, isDeleted)
    VALUES ('${id}', '${itemCode}', '${cleanName.replace(/'/g, "''")}', '${cleanCategory.replace(/'/g, "''")}', '${cleanUnit.replace(/'/g, "''")}', ${price}, ${price}, 0);
  `);

  saveDatabaseSnapshot();
  notifyListeners();
  return getAllItems().find(i => i.id === id)!;
}

// 📦 批次匯入商業夥伴 / 通訊錄 (支援業主、合作廠商、下包工班)
export function batchImportBusinessPartners(
  partners: Partial<BusinessPartner>[],
  operatorName: string = '系統管理員'
): { imported: number; updated: number; errors: string[] } {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未就緒');
  let imported = 0;
  let updated = 0;
  const errors: string[] = [];

  const existingAll = getAllBusinessPartners();
  const existingMap = new Map<string, BusinessPartner>();
  for (const ep of existingAll) {
    if (ep.taxId) existingMap.set(ep.taxId, ep);
    existingMap.set(ep.name.trim().toLowerCase(), ep);
  }

  for (let i = 0; i < partners.length; i++) {
    const row = partners[i];
    const cleanName = (row.name || '').trim();
    if (!cleanName) continue;

    try {
      const existing = (row.taxId ? existingMap.get(row.taxId) : null) || existingMap.get(cleanName.toLowerCase());

      const isCust = row.type === 'CUSTOMER' || row.type === 'BOTH' || Boolean(row.isCustomer);
      const isVend = row.type === 'VENDOR' || row.type === 'SUBCONTRACTOR' || row.type === 'BOTH' || Boolean(row.isVendor);

      const targetId = existing ? existing.id : (row.id || `BP-${Date.now().toString().slice(-6)}-${i + 1}`);
      const targetCode = existing
        ? existing.bpCode
        : (row.bpCode || (isCust ? `CUST-${(existingAll.length + imported + 1).toString().padStart(4, '0')}` : `VEND-${(existingAll.length + imported + 1).toString().padStart(4, '0')}`));

      const partnerToSave: BusinessPartner = {
        id: targetId,
        bpCode: targetCode,
        name: cleanName,
        taxId: (row.taxId || '').trim(),
        entityType: row.isIndividual ? 'NATURAL_PERSON' : (row.entityType || 'CORPORATION'),
        isIndividual: Boolean(row.isIndividual),
        type: (isCust && isVend) ? 'BOTH' : (isCust ? 'CUSTOMER' : 'VENDOR'),
        isCustomer: isCust,
        isVendor: isVend,
        contactPerson: row.contactPerson || cleanName,
        phone: row.phone || '',
        email: row.email || '',
        address: (row.address || '').trim(),
        serviceCategoryMain: row.categoryMain || row.serviceCategoryMain || (isVend ? '一般協力廠商' : undefined),
        serviceCategorySub: row.categorySub || row.serviceCategorySub || (isVend ? '材料工項' : undefined),
        categoryMain: row.categoryMain || row.serviceCategoryMain,
        categorySub: row.categorySub || row.serviceCategorySub,
        bankName: row.bankName || (row.bankCode ? '銀行' : ''),
        bankCode: row.bankCode || '',
        bankAccount: row.bankAccount || '',
        bankAccountName: row.bankAccountName || cleanName,
        bankFeePayer: row.bankFeePayer || 'COMPANY',
        hasInvoice: row.hasInvoice !== false,
        paymentTermsDays: row.paymentTermsDays || 30,
        isHighRisk: Boolean(row.isHighRisk),
        currentScore: row.currentScore ?? 85,
        status: row.status || 'ACTIVE',
        companyId: row.companyId || 'COMP-01',
        isDeleted: false,
        version: existing ? (existing.version || 1) + 1 : 1,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        addresses: row.address?.trim()
          ? (() => {
              const parsed = parseTaiwanAddress(row.address);
              const city = parsed.city ? normalizeTaiwanCity(parsed.city) : '';
              return [
                {
                  id: `PADDR-${Date.now()}-${i + 1}`,
                  partnerId: targetId,
                  addressType: 'COMMUNICATION' as const,
                  label: '主要通訊地址',
                  postalCode: parsed.postalCode || '',
                  city,
                  district: parsed.district || '',
                  streetAddress:
                    parsed.remaining !== undefined
                      ? parsed.remaining
                      : city
                      ? ''
                      : row.address.trim(),
                  fullAddress: row.address.trim(),
                  isDeleted: false
                }
              ];
            })()
          : [],
        contacts: [
          {
            id: `PCON-${Date.now()}-${i + 1}`,
            partnerId: targetId,
            contactType: 'PRIMARY',
            name: row.contactPerson || cleanName,
            title: '主要聯絡人',
            phone: row.phone || '',
            mobile: row.phone || '',
            isDeleted: false
          }
        ],
        bankAccounts: row.bankAccount ? [
          {
            id: `BACC-${Date.now()}-${i + 1}`,
            bpId: targetId,
            bankCode: row.bankCode || '004',
            bankName: row.bankName || '臺灣銀行',
            accountNumber: row.bankAccount,
            accountName: row.bankAccountName || cleanName,
            isPrimary: true
          }
        ] : []
      };

      saveBusinessPartner(partnerToSave, operatorName);
      if (existing) {
        updated++;
      } else {
        imported++;
      }
    } catch (err: any) {
      errors.push(`第 ${i + 1} 筆「${cleanName}」匯入異常: ${err.message || err}`);
    }
  }

  saveDatabaseSnapshot();
  notifyListeners();
  return { imported, updated, errors };
}

// 軟刪除商業夥伴
export function deleteBusinessPartner(id: string, operatorName: string = '系統管理員', reason: string = '日常管理刪除'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const res = dbInstance.exec(`SELECT name, bpCode, taxId, type FROM business_partners WHERE id = '${id}';`);
  if (!res.length || !res[0].values.length) return false;
  const pName = String(res[0].values[0][0] || '');
  const pCode = String(res[0].values[0][1] || '');
  const pTaxId = String(res[0].values[0][2] || '');
  const pType = String(res[0].values[0][3] || '');
  const now = new Date().toISOString();

  dbInstance.run(`UPDATE business_partners SET isDeleted = 1, updatedAt = '${now}' WHERE id = '${id}';`);

  logAudit(dbInstance, operatorName, '軟刪除', '商業夥伴', id, {
    '夥伴名稱': pName,
    '夥伴代碼': pCode,
    '統一編號': pTaxId,
    '類型': pType,
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

// 🛡️ Superadmin 救援還原商業夥伴
export function restoreBusinessPartner(id: string, operatorName: string = 'Superadmin'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const res = dbInstance.exec(`SELECT name, bpCode FROM business_partners WHERE id = '${id}';`);
  const name = res[0]?.values[0]?.[0] ? String(res[0].values[0][0]) : id;
  const code = res[0]?.values[0]?.[1] ? String(res[0].values[0][1]) : '';
  const now = new Date().toISOString();
  dbInstance.run(`UPDATE business_partners SET isDeleted = 0, updatedAt = '${now}' WHERE id = '${id}';`);
  logAudit(dbInstance, operatorName, '救援還原', '商業夥伴', id, {
    '夥伴名稱': name,
    '夥伴代碼': code,
    '刪除狀態': '已軟刪除'
  }, {
    '夥伴名稱': name,
    '夥伴代碼': code,
    '刪除狀態': '已救援還原服役 (所有同仁立即可見)',
    '救援人': operatorName,
    '救援時間': now
  });
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 🗑️ Superadmin 永久物理抹除商業夥伴
export function purgeBusinessPartner(id: string, operatorName: string = 'Superadmin'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const res = dbInstance.exec(`SELECT name, bpCode FROM business_partners WHERE id = '${id}';`);
  const name = res[0]?.values[0]?.[0] ? String(res[0].values[0][0]) : id;
  const now = new Date().toISOString();
  dbInstance.run(`DELETE FROM partner_addresses WHERE partnerId = '${id}';`);
  dbInstance.run(`DELETE FROM bp_bank_accounts WHERE bpId = '${id}';`);
  dbInstance.run(`DELETE FROM business_partners WHERE id = '${id}';`);
  logAudit(dbInstance, operatorName, '永久抹除', '商業夥伴', id, {
    '夥伴名稱': name
  }, {
    '狀態': '已永久自資料庫物理清除',
    '執行人': operatorName,
    '抹除時間': now
  });
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 取得所有已被軟刪除之商業夥伴 (Superadmin 救援中心專用)
export function getDeletedBusinessPartners(): BusinessPartner[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  ensureDatabaseIntegrity(dbInstance);
  const bpRes = dbInstance.exec(`
    SELECT 
      id, bpCode, name, taxId, entityType, type, isCustomer, isVendor, convertedFromVendorId,
      serviceCategoryMain, serviceCategorySub, ownerIdNumber, representative, contactPerson,
      phone, email, address, bankName, bankCode, bankAccount, bankAccountName, bankFeePayer,
      hasInvoice, paymentTermsDays, isHighRisk, riskReason, currentScore, status, companyId,
      isDeleted, version, createdAt, updatedAt, serviceCategories,
      isIndividual, categoryMain, categorySub, categoryTags
    FROM business_partners
    WHERE isDeleted = 1
    ORDER BY updatedAt DESC;
  `);
  if (!bpRes.length) return [];
  const cols = bpRes[0].columns;
  const colMap = new Map<string, number>();
  cols.forEach((c, idx) => colMap.set(c, idx));
  const getVal = (row: any[], col: string) => {
    const idx = colMap.get(col);
    return idx !== undefined ? row[idx] : undefined;
  };

  return bpRes[0].values.map(row => {
    const pId = String(getVal(row, 'id'));
    return {
      id: pId,
      bpCode: String(getVal(row, 'bpCode')),
      name: String(getVal(row, 'name')),
      taxId: String(getVal(row, 'taxId') || ''),
      entityType: ((getVal(row, 'entityType') === 'NATURAL_PERSON') ? 'NATURAL_PERSON' : 'CORPORATION') as BusinessPartner['entityType'],
      type: (getVal(row, 'type') as BusinessPartner['type']) || 'VENDOR',
      isCustomer: Boolean(getVal(row, 'isCustomer')),
      isVendor: Boolean(getVal(row, 'isVendor')),
      serviceCategoryMain: getVal(row, 'serviceCategoryMain') ? String(getVal(row, 'serviceCategoryMain')) : undefined,
      serviceCategorySub: getVal(row, 'serviceCategorySub') ? String(getVal(row, 'serviceCategorySub')) : undefined,
      representative: getVal(row, 'representative') ? String(getVal(row, 'representative')) : undefined,
      contactPerson: String(getVal(row, 'contactPerson') || ''),
      phone: String(getVal(row, 'phone') || ''),
      email: String(getVal(row, 'email') || ''),
      address: String(getVal(row, 'address') || ''),
      bankName: String(getVal(row, 'bankName') || ''),
      bankCode: String(getVal(row, 'bankCode') || ''),
      bankAccount: String(getVal(row, 'bankAccount') || ''),
      bankAccountName: String(getVal(row, 'bankAccountName') || ''),
      bankFeePayer: (getVal(row, 'bankFeePayer') || 'COMPANY') as any,
      hasInvoice: Boolean(getVal(row, 'hasInvoice')),
      paymentTermsDays: Number(getVal(row, 'paymentTermsDays') || 30),
      isHighRisk: Boolean(getVal(row, 'isHighRisk')),
      status: (getVal(row, 'status') as BusinessPartner['status']) || 'ACTIVE',
      companyId: String(getVal(row, 'companyId') || 'COMP-01'),
      isDeleted: true,
      version: Number(getVal(row, 'version') || 1),
      createdAt: String(getVal(row, 'createdAt') || ''),
      updatedAt: String(getVal(row, 'updatedAt') || '')
    };
  });
}

// 一鍵自合作廠商引薦/加入變業主
export function convertVendorToClient(vendorId: string, operatorName: string = '系統管理員'): BusinessPartner {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未就緒');
  const vendor = getBusinessPartnerById(vendorId);
  if (!vendor) throw new Error('找不到該合作廠商');

  vendor.isCustomer = true;
  vendor.type = vendor.isVendor ? 'BOTH' : 'CUSTOMER';
  vendor.convertedFromVendorId = vendorId;

  const saved = saveBusinessPartner(vendor, operatorName);

  try {
    recordAuditLog(operatorName, '身分轉換', '商業夥伴', vendorId, {
      原始身分: '合作廠商',
      轉換結果: '一鍵加入變業主 (SSoT 單一真實來源)',
      業主名稱: vendor.name
    });
  } catch (e) {}

  saveDatabaseSnapshot();
  notifyListeners();
  return saved;
}

// 新增/更新支票往來記錄
export function savePartnerChequeRecord(
  cheque: PartnerChequeRecord,
  operatorName: string = '系統管理員'
): PartnerChequeRecord {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未就緒');

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const targetId = cheque.id || `PCHK-${Date.now().toString().slice(-6)}`;

  const calcStatutoryExpiry = cheque.statutoryExpiryDate || (cheque.issueDate ? (() => {
    try {
      const d = new Date(cheque.issueDate);
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0, 10);
    } catch (e) {
      return null;
    }
  })() : null);

  dbInstance.run(`
    INSERT INTO partner_cheque_records (
      id, partnerId, direction, bankCode, bankName, branchName, accountNumber, checkNumber,
      receivedDate, issueDate, dueDate, statutoryExpiryDate, amount, payeeName, isNonNegotiable, chequeFileId, chequeFileData,
      chequeFiles, status, notes, createdAt, updatedAt
    ) VALUES (
      '${targetId}',
      '${cheque.partnerId}',
      '${cheque.direction || 'RECEIPT'}',
      '${(cheque.bankCode || '').replace(/'/g, "''")}',
      '${(cheque.bankName || '').replace(/'/g, "''")}',
      ${cheque.branchName ? `'${cheque.branchName.replace(/'/g, "''")}'` : 'NULL'},
      '${(cheque.accountNumber || '').replace(/'/g, "''")}',
      '${(cheque.checkNumber || '').replace(/'/g, "''")}',
      ${cheque.receivedDate ? `'${cheque.receivedDate.replace(/'/g, "''")}'` : 'NULL'},
      '${cheque.issueDate || now.slice(0, 10)}',
      '${cheque.dueDate || now.slice(0, 10)}',
      ${calcStatutoryExpiry ? `'${calcStatutoryExpiry}'` : 'NULL'},
      ${Math.max(0, cheque.amount || 0)},
      '${(cheque.payeeName || '').replace(/'/g, "''")}',
      ${cheque.isNonNegotiable ? 1 : 0},
      ${cheque.chequeFileId ? `'${cheque.chequeFileId.replace(/'/g, "''")}'` : 'NULL'},
      ${cheque.chequeFileData ? `'${cheque.chequeFileData.replace(/'/g, "''")}'` : 'NULL'},
      ${cheque.chequeFiles && cheque.chequeFiles.length > 0 ? `'${JSON.stringify(cheque.chequeFiles).replace(/'/g, "''")}'` : 'NULL'},
      '${cheque.status || 'RECEIVED'}',
      ${cheque.notes ? `'${cheque.notes.replace(/'/g, "''")}'` : 'NULL'},
      '${cheque.createdAt || now}',
      '${now}'
    )
    ON CONFLICT(id) DO UPDATE SET
      direction = excluded.direction,
      bankCode = excluded.bankCode,
      bankName = excluded.bankName,
      branchName = excluded.branchName,
      accountNumber = excluded.accountNumber,
      checkNumber = excluded.checkNumber,
      receivedDate = excluded.receivedDate,
      issueDate = excluded.issueDate,
      dueDate = excluded.dueDate,
      statutoryExpiryDate = excluded.statutoryExpiryDate,
      amount = excluded.amount,
      payeeName = excluded.payeeName,
      isNonNegotiable = excluded.isNonNegotiable,
      chequeFileId = excluded.chequeFileId,
      chequeFileData = excluded.chequeFileData,
      chequeFiles = excluded.chequeFiles,
      status = excluded.status,
      notes = excluded.notes,
      updatedAt = '${now}';
  `);

  try {
    const dirText = cheque.direction === 'RECEIPT' ? '收受支票' : '開立支票';
    recordAuditLog(operatorName, '登記票據', '夥伴支票記錄', targetId, {
      票據方向: dirText,
      支票號碼: cheque.checkNumber,
      票面金額: cheque.amount,
      到期日: cheque.dueDate
    });
  } catch (e) {}

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    ...cheque,
    id: targetId,
    updatedAt: now
  };
}

// 刪除支票往來記錄
export function deletePartnerChequeRecord(chequeId: string, operatorName: string = '系統管理員'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  dbInstance.run(`DELETE FROM partner_cheque_records WHERE id = '${chequeId}';`);

  try {
    recordAuditLog(operatorName, '刪除票據', '夥伴支票記錄', chequeId, { 支票記錄代碼: chequeId });
  } catch (e) {}

  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 新增/更新名片資料
export function savePartnerBusinessCard(
  card: PartnerBusinessCard,
  operatorName: string = '系統管理員'
): PartnerBusinessCard {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未就緒');
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const targetId = card.id || `PBC-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;

  dbInstance.run(`
    INSERT INTO partner_business_cards (
      id, partnerId, name, title, companyName, phone, mobile, email, address,
      exchangeDate, cardFrontUrl, cardBackUrl, cardFileType, notes, createdAt
    ) VALUES (
      '${targetId}',
      '${card.partnerId}',
      '${(card.name || '').replace(/'/g, "''")}',
      ${card.title ? `'${card.title.replace(/'/g, "''")}'` : 'NULL'},
      ${card.companyName ? `'${card.companyName.replace(/'/g, "''")}'` : 'NULL'},
      ${card.phone ? `'${card.phone.replace(/'/g, "''")}'` : 'NULL'},
      ${card.mobile ? `'${card.mobile.replace(/'/g, "''")}'` : 'NULL'},
      ${card.email ? `'${card.email.replace(/'/g, "''")}'` : 'NULL'},
      ${card.address ? `'${card.address.replace(/'/g, "''")}'` : 'NULL'},
      ${card.exchangeDate ? `'${card.exchangeDate.replace(/'/g, "''")}'` : 'NULL'},
      ${card.cardFrontUrl ? `'${card.cardFrontUrl.replace(/'/g, "''")}'` : 'NULL'},
      ${card.cardBackUrl ? `'${card.cardBackUrl.replace(/'/g, "''")}'` : 'NULL'},
      '${card.cardFileType || 'IMAGE'}',
      ${card.notes ? `'${card.notes.replace(/'/g, "''")}'` : 'NULL'},
      '${card.createdAt || now}'
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      title = excluded.title,
      companyName = excluded.companyName,
      phone = excluded.phone,
      mobile = excluded.mobile,
      email = excluded.email,
      address = excluded.address,
      exchangeDate = excluded.exchangeDate,
      cardFrontUrl = excluded.cardFrontUrl,
      cardBackUrl = excluded.cardBackUrl,
      cardFileType = excluded.cardFileType,
      notes = excluded.notes;
  `);

  try {
    recordAuditLog(operatorName, '儲存名片', '商業夥伴名片', targetId, {
      夥伴ID: card.partnerId,
      姓名: card.name,
      職稱: card.title
    });
  } catch (e) {}

  saveDatabaseSnapshot();
  notifyListeners();
  return { ...card, id: targetId };
}

// 刪除名片資料
export function deletePartnerBusinessCard(cardId: string, operatorName: string = '系統管理員'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  dbInstance.run(`DELETE FROM partner_business_cards WHERE id = '${cardId}';`);

  try {
    recordAuditLog(operatorName, '刪除名片', '商業夥伴名片', cardId, { 名片ID: cardId });
  } catch (e) {}

  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}
