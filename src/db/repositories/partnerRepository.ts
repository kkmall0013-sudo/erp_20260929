import type {
  BPBankAccount,
  BusinessPartner,
  PartnerAddress,
  PartnerBusinessCard,
  PartnerChequeRecord,
  PartnerContact
} from '../../types/erp';
import {
  normalizeTaiwanCity,
  normalizeTaiwanDistrict,
  parseTaiwanAddress
} from '../../utils/taiwanPostalCodes';
import {
  getDbInstance,
  notifyListeners,
  saveDatabaseSnapshot
} from '../core/dbContext';
import { recordAuditLog } from './auditRepository';

// ⚡ 一鍵極速建立合作廠商 (直接同步寫入商業夥伴模組，杜絕 SQL 欄位報錯)
export function quickCreateVendor(
  name: string,
  companyId: string = 'COMP-01',
  phone?: string,
  taxId?: string,
  contactPerson?: string,
  address?: string,
  category?: string,
  addressParts?: { postalCode?: string; city?: string; district?: string; streetAddress?: string }
): BusinessPartner {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();
  const id = `BP-VEND-${Date.now().toString().slice(-6)}`;
  const bpCode = `VEND-${Date.now().toString().slice(-4)}`;
  const cleanName = name.trim();
  const cleanTaxId = (taxId || '').trim();
  const cleanPhone = (phone || '').trim();
  const cleanContact = (contactPerson || '').trim();
  const cleanAddress = (address || '').trim();
  const cleanCategory = (category || '現場材料供料商').trim();

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
    INSERT INTO business_partners (
      id, bpCode, name, taxId, entityType, type, isCustomer, isVendor, convertedFromVendorId,
      serviceCategoryMain, serviceCategorySub, ownerIdNumber, representative, contactPerson,
      phone, email, address, bankName, bankCode, bankAccount, bankAccountName, bankFeePayer,
      hasInvoice, paymentTermsDays, isHighRisk, riskReason, currentScore, status, companyId,
      isDeleted, version, createdAt, updatedAt
    ) VALUES (
      '${id}',
      '${bpCode}',
      '${cleanName.replace(/'/g, "''")}',
      '${cleanTaxId.replace(/'/g, "''")}',
      'CORPORATION',
      'VENDOR',
      0,
      1,
      NULL,
      '${cleanCategory.replace(/'/g, "''")}',
      '材料建材',
      '',
      '${cleanName.replace(/'/g, "''")}',
      '${cleanContact.replace(/'/g, "''")}',
      '${cleanPhone.replace(/'/g, "''")}',
      '',
      '${cleanAddress.replace(/'/g, "''")}',
      '',
      '',
      '',
      '',
      'COMPANY',
      1,
      30,
      0,
      NULL,
      90,
      'ACTIVE',
      '${companyId}',
      0,
      1,
      '${now}',
      '${now}'
    );
  `);

  if (cleanAddress || postalCode || city || district || streetAddress) {
    dbInstance.run(`
      INSERT INTO partner_addresses (id, partnerId, addressType, label, postalCode, city, district, streetAddress, fullAddress, isDeleted)
      VALUES (
        'PADDR-${Date.now()}',
        '${id}',
        'COMMUNICATION',
        '主要通訊地址',
        ${postalCode ? `'${postalCode.replace(/'/g, "''")}'` : 'NULL'},
        ${city ? `'${city.replace(/'/g, "''")}'` : 'NULL'},
        ${district ? `'${district.replace(/'/g, "''")}'` : 'NULL'},
        ${streetAddress ? `'${streetAddress.replace(/'/g, "''")}'` : 'NULL'},
        '${cleanAddress.replace(/'/g, "''")}',
        0
      );
    `);
  }
  if (cleanContact || cleanPhone) {
    dbInstance.run(`
      INSERT INTO partner_contacts (id, partnerId, contactType, name, title, phone, mobile, extension, email, notes, isDeleted)
      VALUES ('PCON-${Date.now()}', '${id}', 'PRIMARY', '${(cleanContact || '業務聯絡人').replace(/'/g, "''")}', '業務窗口', '', '${cleanPhone.replace(/'/g, "''")}', '', '', '自現場進貨登記建立', 0);
    `);
  }

  saveDatabaseSnapshot();
  notifyListeners();
  return getAllBusinessPartners().find(b => b.id === id)!;
}

// 讀取所有商業夥伴（含地址、聯絡人、銀行帳戶、支票記錄子集合）
export function getAllBusinessPartners(): BusinessPartner[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];

  try { dbInstance.run(`ALTER TABLE business_partners ADD COLUMN paymentMethodNotes TEXT;`); } catch (_) {}

  const bpRes = dbInstance.exec(`
    SELECT 
      id, bpCode, name, taxId, entityType, type, isCustomer, isVendor, convertedFromVendorId,
      serviceCategoryMain, serviceCategorySub, ownerIdNumber, representative, contactPerson,
      phone, email, address, bankName, bankCode, bankAccount, bankAccountName, bankFeePayer,
      hasInvoice, paymentTermsDays, isHighRisk, riskReason, currentScore, status, companyId,
      isDeleted, version, createdAt, updatedAt, serviceCategories,
      isIndividual, categoryMain, categorySub, categoryTags, paymentMethodNotes
    FROM business_partners
    WHERE isDeleted = 0
    ORDER BY bpCode;
  `);

  if (!bpRes.length) return [];

  const addressesMap = new Map<string, PartnerAddress[]>();
  try {
    const addrRes = dbInstance.exec(`SELECT id, partnerId, addressType, label, fullAddress, isDeleted, postalCode, city, district, streetAddress, isHistorical, archivedAt, archiveNote FROM partner_addresses WHERE isDeleted = 0;`);
    if (addrRes.length && addrRes[0].values) {
      for (const row of addrRes[0].values) {
        const pId = String(row[1]);
        const addr: PartnerAddress = {
          id: String(row[0]),
          partnerId: pId,
          addressType: (row[2] as PartnerAddress['addressType']) || 'COMMUNICATION',
          label: row[3] ? String(row[3]) : undefined,
          fullAddress: String(row[4] || ''),
          isDeleted: Boolean(row[5]),
          postalCode: row[6] ? String(row[6]) : undefined,
          city: row[7] ? String(row[7]) : undefined,
          district: row[8] ? String(row[8]) : undefined,
          streetAddress: row[9] ? String(row[9]) : undefined,
          isHistorical: Number(row[10]) === 1,
          archivedAt: row[11] ? String(row[11]) : undefined,
          archiveNote: row[12] ? String(row[12]) : undefined
        };
        const list = addressesMap.get(pId) || [];
        list.push(addr);
        addressesMap.set(pId, list);
      }
    }
  } catch (e) {}

  const contactsMap = new Map<string, PartnerContact[]>();
  try {
    const conRes = dbInstance.exec(`SELECT id, partnerId, contactType, name, title, phone, mobile, extension, email, notes, isDeleted FROM partner_contacts WHERE isDeleted = 0;`);
    if (conRes.length && conRes[0].values) {
      for (const row of conRes[0].values) {
        const pId = String(row[1]);
        const con: PartnerContact = {
          id: String(row[0]),
          partnerId: pId,
          contactType: (row[2] as PartnerContact['contactType']) || 'PRIMARY',
          name: String(row[3] || ''),
          title: row[4] ? String(row[4]) : undefined,
          phone: row[5] ? String(row[5]) : undefined,
          mobile: row[6] ? String(row[6]) : undefined,
          extension: row[7] ? String(row[7]) : undefined,
          email: row[8] ? String(row[8]) : undefined,
          notes: row[9] ? String(row[9]) : undefined,
          isDeleted: Boolean(row[10])
        };
        const list = contactsMap.get(pId) || [];
        list.push(con);
        contactsMap.set(pId, list);
      }
    }
  } catch (e) {}

  const cardsMap = new Map<string, PartnerBusinessCard[]>();
  try {
    const cardRes = dbInstance.exec(`SELECT id, partnerId, name, title, companyName, phone, mobile, email, address, exchangeDate, cardFrontUrl, cardBackUrl, cardFileType, notes, createdAt FROM partner_business_cards ORDER BY createdAt DESC;`);
    if (cardRes.length && cardRes[0].values) {
      for (const row of cardRes[0].values) {
        const pId = String(row[1]);
        const card: PartnerBusinessCard = {
          id: String(row[0]),
          partnerId: pId,
          name: String(row[2] || ''),
          title: row[3] ? String(row[3]) : undefined,
          companyName: row[4] ? String(row[4]) : undefined,
          phone: row[5] ? String(row[5]) : undefined,
          mobile: row[6] ? String(row[6]) : undefined,
          email: row[7] ? String(row[7]) : undefined,
          address: row[8] ? String(row[8]) : undefined,
          exchangeDate: row[9] ? String(row[9]) : undefined,
          cardFrontUrl: row[10] ? String(row[10]) : undefined,
          cardBackUrl: row[11] ? String(row[11]) : undefined,
          cardFileType: (row[12] as any) || 'IMAGE',
          notes: row[13] ? String(row[13]) : undefined,
          createdAt: row[14] ? String(row[14]) : undefined
        };
        const list = cardsMap.get(pId) || [];
        list.push(card);
        cardsMap.set(pId, list);
      }
    }
  } catch (e) {}

  const banksMap = new Map<string, BPBankAccount[]>();
  try {
    const bnkRes = dbInstance.exec(`SELECT id, bpId, bankCode, bankName, branchCode, branchName, accountNumber, accountName, isPrimary, passbookFileId, passbookFileData, isDeleted, passbookFiles FROM bp_bank_accounts WHERE isDeleted = 0;`);
    if (bnkRes.length && bnkRes[0].values) {
      for (const row of bnkRes[0].values) {
        const pId = String(row[1]);
        let pFiles: any[] = [];
        try {
          if (row[12]) pFiles = JSON.parse(String(row[12]));
        } catch (e) {}
        const bnk: BPBankAccount = {
          id: String(row[0]),
          bpId: pId,
          bankCode: String(row[2] || ''),
          bankName: String(row[3] || ''),
          branchCode: row[4] ? String(row[4]) : undefined,
          branchName: row[5] ? String(row[5]) : undefined,
          accountNumber: String(row[6] || ''),
          accountName: String(row[7] || ''),
          isPrimary: Boolean(row[8]),
          passbookFileId: row[9] ? String(row[9]) : undefined,
          passbookFileData: row[10] ? String(row[10]) : undefined,
          isDeleted: Boolean(row[11]),
          passbookFiles: pFiles
        };
        const list = banksMap.get(pId) || [];
        list.push(bnk);
        banksMap.set(pId, list);
      }
    }
  } catch (e) {}

  const chequesMap = new Map<string, PartnerChequeRecord[]>();
  try {
    const chkRes = dbInstance.exec(`SELECT * FROM partner_cheque_records ORDER BY dueDate DESC;`);
    if (chkRes.length && chkRes[0].values) {
      const cols = chkRes[0].columns;
      const colIdx: Record<string, number> = {};
      cols.forEach((c, idx) => { colIdx[c] = idx; });
      const getVal = (row: any[], cName: string) => colIdx[cName] !== undefined ? row[colIdx[cName]] : undefined;

      for (const row of chkRes[0].values) {
        const pId = String(getVal(row, 'partnerId') || '');
        if (!pId) continue;
        let cFiles: any[] = [];
        try {
          const rawFiles = getVal(row, 'chequeFiles');
          if (rawFiles) cFiles = JSON.parse(String(rawFiles));
        } catch (e) {}

        const chk: PartnerChequeRecord = {
          id: String(getVal(row, 'id') || ''),
          partnerId: pId,
          direction: (getVal(row, 'direction') as PartnerChequeRecord['direction']) || 'RECEIPT',
          bankCode: String(getVal(row, 'bankCode') || ''),
          bankName: String(getVal(row, 'bankName') || ''),
          branchName: getVal(row, 'branchName') ? String(getVal(row, 'branchName')) : undefined,
          accountNumber: String(getVal(row, 'accountNumber') || ''),
          checkNumber: String(getVal(row, 'checkNumber') || ''),
          receivedDate: getVal(row, 'receivedDate') ? String(getVal(row, 'receivedDate')) : undefined,
          issueDate: String(getVal(row, 'issueDate') || ''),
          dueDate: String(getVal(row, 'dueDate') || ''),
          statutoryExpiryDate: getVal(row, 'statutoryExpiryDate') ? String(getVal(row, 'statutoryExpiryDate')) : undefined,
          amount: Number(getVal(row, 'amount') || 0),
          payeeName: String(getVal(row, 'payeeName') || ''),
          isNonNegotiable: Boolean(getVal(row, 'isNonNegotiable')),
          chequeFileId: getVal(row, 'chequeFileId') ? String(getVal(row, 'chequeFileId')) : undefined,
          chequeFileData: getVal(row, 'chequeFileData') ? String(getVal(row, 'chequeFileData')) : undefined,
          chequeFiles: cFiles,
          status: (getVal(row, 'status') as PartnerChequeRecord['status']) || 'RECEIVED',
          notes: getVal(row, 'notes') ? String(getVal(row, 'notes')) : undefined,
          createdAt: String(getVal(row, 'createdAt') || ''),
          updatedAt: String(getVal(row, 'updatedAt') || '')
        };
        const list = chequesMap.get(pId) || [];
        list.push(chk);
        chequesMap.set(pId, list);
      }
    }
  } catch (e) {
    console.error('Failed to load partner_cheque_records:', e);
  }

  return bpRes[0].values.map(v => {
    const id = String(v[0]);
    const bType = v[5] as BusinessPartner['type'];
    const isCust = v[6] !== null && v[6] !== undefined ? Boolean(v[6]) : (bType === 'CUSTOMER' || bType === 'BOTH');
    const isVend = v[7] !== null && v[7] !== undefined ? Boolean(v[7]) : (bType === 'VENDOR' || bType === 'SUBCONTRACTOR' || bType === 'BOTH');

    let parsedServiceCategories: any[] = [];
    try {
      if (v[33]) parsedServiceCategories = JSON.parse(String(v[33]));
    } catch (e) {}

    return {
      id,
      bpCode: String(v[1]),
      name: String(v[2]),
      taxId: String(v[3]),
      entityType: (v[4] as BusinessPartner['entityType']) || 'CORPORATION',
      isIndividual: v[34] !== null && v[34] !== undefined ? Boolean(v[34]) : ((v[4] as any) === 'NATURAL_PERSON'),
      type: bType,
      isCustomer: isCust,
      isVendor: isVend,
      convertedFromVendorId: v[8] ? String(v[8]) : undefined,
      serviceCategoryMain: v[9] ? String(v[9]) : undefined,
      categoryMain: v[35] ? String(v[35]) : (v[9] ? String(v[9]) : undefined),
      categorySub: v[36] ? String(v[36]) : (v[10] ? String(v[10]) : undefined),
      categoryTags: (() => {
        let tags: string[] = [];
        if (v[37]) {
          try {
            const raw = JSON.parse(String(v[37]));
            if (Array.isArray(raw)) tags = raw.map(s => String(s).trim()).filter(Boolean);
          } catch (_) {}
        }
        if (tags.length === 0 && (v[35] || v[9])) {
          const fallback = String(v[35] || v[9] || '').trim();
          if (fallback) tags = [fallback];
        }
        return tags;
      })(),
      serviceCategories: parsedServiceCategories,
      ownerIdNumber: v[11] ? String(v[11]) : undefined,
      representative: v[12] ? String(v[12]) : undefined,
      contactPerson: String(v[13] || ''),
      phone: String(v[14] || ''),
      email: String(v[15] || ''),
      address: String(v[16] || ''),
      bankName: String(v[17] || ''),
      bankCode: String(v[18] || ''),
      bankAccount: String(v[19] || ''),
      bankAccountName: v[20] ? String(v[20]) : undefined,
      bankFeePayer: (v[21] as BusinessPartner['bankFeePayer']) || 'COMPANY',
      hasInvoice: v[22] !== null ? Boolean(v[22]) : true,
      paymentTermsDays: Number(v[23] || 30),
      paymentMethodNotes: v[38] ? String(v[38]) : undefined,
      isHighRisk: Boolean(v[24]),
      riskReason: v[25] ? String(v[25]) : undefined,
      currentScore: Number(v[26] ?? 85),
      status: (v[27] as BusinessPartner['status']) || 'ACTIVE',
      companyId: String(v[28] || 'COMP-01'),
      isDeleted: Boolean(v[29]),
      version: Number(v[30] || 1),
      createdAt: String(v[31] || '2026-01-01'),
      updatedAt: String(v[32] || '2026-01-01'),
      addresses: addressesMap.get(id) || [],
      contacts: contactsMap.get(id) || [],
      bankAccounts: banksMap.get(id) || [],
      chequeRecords: chequesMap.get(id) || [],
      businessCards: cardsMap.get(id) || []
    };
  });
}

// 根據 ID 讀取單一商業夥伴
export function getBusinessPartnerById(id: string): BusinessPartner | null {
  const all = getAllBusinessPartners();
  return all.find(b => b.id === id) || null;
}

// 儲存或更新商業夥伴 (包含子地址、聯絡人、銀行帳戶及審計日誌)
export function saveBusinessPartner(
  partner: BusinessPartner,
  operatorName: string = '系統管理員'
): BusinessPartner {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未就緒');

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const isExisting = Boolean(partner.id && getBusinessPartnerById(partner.id));
  const targetId = partner.id || `BP-${Date.now().toString().slice(-6)}`;
  let targetCode = partner.bpCode || (partner.isCustomer ? `CUST-${Date.now().toString().slice(-4)}` : `VEND-${Date.now().toString().slice(-4)}`);

  if (!isExisting) {
    let codeCounter = 1;
    let candidateCode = targetCode;
    while (true) {
      try {
        const checkRes = dbInstance.exec(`SELECT id FROM business_partners WHERE bpCode = '${candidateCode.replace(/'/g, "''")}' AND id != '${targetId}';`);
        if (checkRes.length && checkRes[0].values && checkRes[0].values.length > 0) {
          candidateCode = `${targetCode}-${codeCounter}`;
          codeCounter++;
        } else {
          break;
        }
      } catch (_) {
        break;
      }
    }
    targetCode = candidateCode;
  }

  let determinedType: BusinessPartner['type'] = partner.type;
  if (partner.isCustomer && partner.isVendor) {
    determinedType = 'BOTH';
  } else if (partner.isCustomer) {
    determinedType = 'CUSTOMER';
  } else if (partner.isVendor) {
    determinedType = partner.type === 'SUBCONTRACTOR' ? 'SUBCONTRACTOR' : 'VENDOR';
  }

  const activeFirstAddr = partner.addresses?.find(a => !a.isHistorical) || partner.addresses?.[0];
  const primaryAddress = activeFirstAddr
    ? activeFirstAddr.fullAddress
    : partner.address || '';

  const primaryContact = partner.contacts && partner.contacts.length > 0
    ? partner.contacts[0].name
    : partner.contactPerson || '';

  const primaryPhone = partner.contacts && partner.contacts.length > 0
    ? (partner.contacts[0].mobile || partner.contacts[0].phone || '')
    : partner.phone || '';

  const primaryBank = partner.bankAccounts && partner.bankAccounts.length > 0
    ? partner.bankAccounts[0]
    : null;

  const bankName = primaryBank ? primaryBank.bankName : (partner.bankName || '');
  const bankCode = primaryBank ? primaryBank.bankCode : (partner.bankCode || '');
  const bankAccount = primaryBank ? primaryBank.accountNumber : (partner.bankAccount || '');
  const bankAccountName = primaryBank ? primaryBank.accountName : (partner.bankAccountName || partner.name);

  const tagsToSave = Array.isArray(partner.categoryTags) && partner.categoryTags.length > 0
    ? Array.from(new Set(partner.categoryTags.map(s => String(s).trim()).filter(Boolean)))
    : (partner.categoryMain ? [partner.categoryMain.trim()] : []);
  const primaryCategory = tagsToSave[0] || partner.categoryMain || partner.serviceCategoryMain || '';

  try { dbInstance.run(`ALTER TABLE business_partners ADD COLUMN paymentMethodNotes TEXT;`); } catch (_) {}

  dbInstance.run(`
    INSERT INTO business_partners (
      id, bpCode, name, taxId, entityType, type, isCustomer, isVendor, convertedFromVendorId,
      serviceCategoryMain, serviceCategorySub, serviceCategories, ownerIdNumber, representative, contactPerson,
      phone, email, address, bankName, bankCode, bankAccount, bankAccountName, bankFeePayer,
      hasInvoice, paymentTermsDays, paymentMethodNotes, isHighRisk, riskReason, currentScore, status, companyId,
      isDeleted, version, createdAt, updatedAt, isIndividual, categoryMain, categorySub, categoryTags
    ) VALUES (
      '${targetId}',
      '${targetCode.replace(/'/g, "''")}',
      '${partner.name.replace(/'/g, "''")}',
      '${(partner.taxId || '').replace(/'/g, "''")}',
      '${partner.entityType || 'CORPORATION'}',
      '${determinedType}',
      ${partner.isCustomer ? 1 : 0},
      ${partner.isVendor ? 1 : 0},
      ${partner.convertedFromVendorId ? `'${partner.convertedFromVendorId.replace(/'/g, "''")}'` : 'NULL'},
      ${primaryCategory ? `'${primaryCategory.replace(/'/g, "''")}'` : 'NULL'},
      ${partner.serviceCategorySub ? `'${partner.serviceCategorySub.replace(/'/g, "''")}'` : 'NULL'},
      ${partner.serviceCategories && partner.serviceCategories.length > 0 ? `'${JSON.stringify(partner.serviceCategories).replace(/'/g, "''")}'` : 'NULL'},
      ${partner.ownerIdNumber ? `'${partner.ownerIdNumber.replace(/'/g, "''")}'` : 'NULL'},
      ${partner.representative ? `'${partner.representative.replace(/'/g, "''")}'` : 'NULL'},
      '${primaryContact.replace(/'/g, "''")}',
      '${primaryPhone.replace(/'/g, "''")}',
      '${(partner.email || '').replace(/'/g, "''")}',
      '${primaryAddress.replace(/'/g, "''")}',
      '${bankName.replace(/'/g, "''")}',
      '${bankCode.replace(/'/g, "''")}',
      '${bankAccount.replace(/'/g, "''")}',
      '${bankAccountName.replace(/'/g, "''")}',
      '${partner.bankFeePayer || 'COMPANY'}',
      ${partner.hasInvoice !== false ? 1 : 0},
      ${partner.paymentTermsDays || 30},
      ${partner.paymentMethodNotes ? `'${partner.paymentMethodNotes.replace(/'/g, "''")}'` : 'NULL'},
      ${partner.isHighRisk ? 1 : 0},
      ${partner.riskReason ? `'${partner.riskReason.replace(/'/g, "''")}'` : 'NULL'},
      ${partner.currentScore ?? 85},
      '${partner.status || 'ACTIVE'}',
      '${partner.companyId || 'COMP-01'}',
      0,
      ${(partner.version || 1) + 1},
      '${partner.createdAt || now}',
      '${now}',
      ${partner.isIndividual || partner.entityType === 'NATURAL_PERSON' ? 1 : 0},
      ${primaryCategory ? `'${primaryCategory.replace(/'/g, "''")}'` : 'NULL'},
      ${partner.categorySub || partner.serviceCategorySub ? `'${(partner.categorySub || partner.serviceCategorySub || '').replace(/'/g, "''")}'` : 'NULL'},
      '${JSON.stringify(tagsToSave).replace(/'/g, "''")}'
    )
    ON CONFLICT(id) DO UPDATE SET
      bpCode = excluded.bpCode,
      name = excluded.name,
      taxId = excluded.taxId,
      entityType = excluded.entityType,
      type = excluded.type,
      isCustomer = excluded.isCustomer,
      isVendor = excluded.isVendor,
      convertedFromVendorId = excluded.convertedFromVendorId,
      serviceCategoryMain = excluded.serviceCategoryMain,
      serviceCategorySub = excluded.serviceCategorySub,
      serviceCategories = excluded.serviceCategories,
      categoryMain = excluded.categoryMain,
      categorySub = excluded.categorySub,
      categoryTags = excluded.categoryTags,
      isIndividual = excluded.isIndividual,
      ownerIdNumber = excluded.ownerIdNumber,
      representative = excluded.representative,
      contactPerson = excluded.contactPerson,
      phone = excluded.phone,
      email = excluded.email,
      address = excluded.address,
      bankName = excluded.bankName,
      bankCode = excluded.bankCode,
      bankAccount = excluded.bankAccount,
      bankAccountName = excluded.bankAccountName,
      bankFeePayer = excluded.bankFeePayer,
      hasInvoice = excluded.hasInvoice,
      paymentTermsDays = excluded.paymentTermsDays,
      paymentMethodNotes = excluded.paymentMethodNotes,
      isHighRisk = excluded.isHighRisk,
      riskReason = excluded.riskReason,
      currentScore = excluded.currentScore,
      status = excluded.status,
      companyId = excluded.companyId,
      isDeleted = 0,
      version = business_partners.version + 1,
      updatedAt = '${now}';
  `);

  if (partner.addresses && partner.addresses.length > 0) {
    dbInstance.run(`DELETE FROM partner_addresses WHERE partnerId = '${targetId}';`);
    for (const a of partner.addresses) {
      if (
        !a.fullAddress?.trim() &&
        !a.postalCode?.trim() &&
        !a.city?.trim() &&
        !a.district?.trim() &&
        !a.streetAddress?.trim()
      ) {
        continue;
      }
      const aId = a.id || `PADDR-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
      dbInstance.run(`
        INSERT INTO partner_addresses (id, partnerId, addressType, label, postalCode, city, district, streetAddress, fullAddress, isHistorical, archivedAt, archiveNote, isDeleted)
        VALUES (
          '${aId}',
          '${targetId}',
          '${a.addressType || 'COMMUNICATION'}',
          ${a.label ? `'${a.label.replace(/'/g, "''")}'` : 'NULL'},
          ${a.postalCode ? `'${a.postalCode.replace(/'/g, "''")}'` : 'NULL'},
          ${a.city ? `'${a.city.replace(/'/g, "''")}'` : 'NULL'},
          ${a.district ? `'${a.district.replace(/'/g, "''")}'` : 'NULL'},
          ${a.streetAddress ? `'${a.streetAddress.replace(/'/g, "''")}'` : 'NULL'},
          '${(a.fullAddress || '').replace(/'/g, "''")}',
          ${a.isHistorical ? 1 : 0},
          ${a.archivedAt ? `'${a.archivedAt.replace(/'/g, "''")}'` : 'NULL'},
          ${a.archiveNote ? `'${a.archiveNote.replace(/'/g, "''")}'` : 'NULL'},
          0
        );
      `);
    }
  }

  if (partner.contacts && partner.contacts.length > 0) {
    dbInstance.run(`DELETE FROM partner_contacts WHERE partnerId = '${targetId}';`);
    for (const c of partner.contacts) {
      if (!c.name || !c.name.trim()) continue;
      const cId = c.id || `PCON-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
      dbInstance.run(`
        INSERT INTO partner_contacts (id, partnerId, contactType, name, title, phone, mobile, extension, email, notes, isDeleted)
        VALUES (
          '${cId}',
          '${targetId}',
          '${c.contactType || 'PRIMARY'}',
          '${c.name.replace(/'/g, "''")}',
          ${c.title ? `'${c.title.replace(/'/g, "''")}'` : 'NULL'},
          ${c.phone ? `'${c.phone.replace(/'/g, "''")}'` : 'NULL'},
          ${c.mobile ? `'${c.mobile.replace(/'/g, "''")}'` : 'NULL'},
          ${c.extension ? `'${c.extension.replace(/'/g, "''")}'` : 'NULL'},
          ${c.email ? `'${c.email.replace(/'/g, "''")}'` : 'NULL'},
          ${c.notes ? `'${c.notes.replace(/'/g, "''")}'` : 'NULL'},
          0
        );
      `);
    }
  }

  if (partner.bankAccounts && partner.bankAccounts.length > 0) {
    dbInstance.run(`DELETE FROM bp_bank_accounts WHERE bpId = '${targetId}';`);
    for (const b of partner.bankAccounts) {
      if (!b.accountNumber || !b.accountNumber.trim()) continue;
      const bId = b.id || `BACC-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
      dbInstance.run(`
        INSERT INTO bp_bank_accounts (id, bpId, bankCode, bankName, branchCode, branchName, accountNumber, accountName, isPrimary, passbookFileId, passbookFileData, passbookFiles, isDeleted)
        VALUES (
          '${bId}',
          '${targetId}',
          '${(b.bankCode || '').replace(/'/g, "''")}',
          '${(b.bankName || '').replace(/'/g, "''")}',
          ${b.branchCode ? `'${b.branchCode.replace(/'/g, "''")}'` : 'NULL'},
          ${b.branchName ? `'${b.branchName.replace(/'/g, "''")}'` : 'NULL'},
          '${b.accountNumber.replace(/'/g, "''")}',
          '${(b.accountName || partner.name).replace(/'/g, "''")}',
          ${b.isPrimary ? 1 : 0},
          ${b.passbookFileId ? `'${b.passbookFileId.replace(/'/g, "''")}'` : 'NULL'},
          ${b.passbookFileData ? `'${b.passbookFileData.replace(/'/g, "''")}'` : 'NULL'},
          ${b.passbookFiles && b.passbookFiles.length > 0 ? `'${JSON.stringify(b.passbookFiles).replace(/'/g, "''")}'` : 'NULL'},
          0
        );
      `);
    }
  }

  if (partner.businessCards && partner.businessCards.length > 0) {
    dbInstance.run(`DELETE FROM partner_business_cards WHERE partnerId = '${targetId}';`);
    for (const card of partner.businessCards) {
      if (!card.name && !card.cardFrontUrl) continue;
      const cId = card.id || `PBC-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
      dbInstance.run(`
        INSERT INTO partner_business_cards (
          id, partnerId, name, title, companyName, phone, mobile, email, address,
          exchangeDate, cardFrontUrl, cardBackUrl, cardFileType, notes, createdAt
        ) VALUES (
          '${cId}',
          '${targetId}',
          '${(card.name || partner.name).replace(/'/g, "''")}',
          ${card.title ? `'${card.title.replace(/'/g, "''")}'` : 'NULL'},
          ${card.companyName ? `'${card.companyName.replace(/'/g, "''")}'` : `'${partner.name.replace(/'/g, "''")}'`},
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
        );
      `);
    }
  }

  try {
    const actionDesc = isExisting ? '修改資料' : '新增資料';
    recordAuditLog(operatorName, actionDesc, '商業夥伴', targetId, {
      夥伴編號: targetCode,
      夥伴名稱: partner.name,
      統一編號: partner.taxId,
      身分型態: partner.isCustomer && partner.isVendor ? '業主暨廠商' : partner.isCustomer ? '業主' : '合作廠商',
      工項分類: `${partner.serviceCategoryMain || ''} / ${partner.serviceCategorySub || ''}`,
      手續費負擔: partner.bankFeePayer === 'PARTNER' ? '廠商自付' : '公司自行吸收(不扣)',
      高風險註記: partner.isHighRisk ? `是 (${partner.riskReason || ''})` : '正常'
    });
  } catch (e) {}

  saveDatabaseSnapshot();
  notifyListeners();

  return getBusinessPartnerById(targetId) || partner;
}
