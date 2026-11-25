import { BusinessPartner, PartnerAddress } from '../../types/erp';
import { exportCsvFile } from '../../utils/csvExport';
import { parseTaiwanAddress, normalizeTaiwanCity, matchesTaiwanRegion } from '../../utils/taiwanPostalCodes';
import { MappedCategoryItem } from './tabs/PartnerBasicInfoTab';

export interface PartnerFilterCriteria {
  activeTab: 'CLIENTS' | 'VENDORS';
  selectedMainCategory: string;
  selectedSubCategory: string;
  selectedCity: string;
  selectedDistrict: string;
  hasChequeFilter: 'ALL' | 'HAS' | 'NONE';
  searchTerm: string;
}

export function filterBusinessPartners(
  partners: BusinessPartner[],
  criteria: PartnerFilterCriteria
): BusinessPartner[] {
  const {
    activeTab,
    selectedMainCategory,
    selectedSubCategory,
    selectedCity,
    selectedDistrict,
    hasChequeFilter,
    searchTerm
  } = criteria;

  return partners.filter(p => {
    if (activeTab === 'CLIENTS' && !p.isCustomer) return false;
    if (activeTab === 'VENDORS' && !p.isVendor) return false;

    if (selectedMainCategory !== 'ALL') {
      const hasMain =
        (p.categoryTags || []).includes(selectedMainCategory) ||
        p.categoryMain === selectedMainCategory ||
        p.serviceCategoryMain === selectedMainCategory ||
        (p.serviceCategories || []).some(c => c.main === selectedMainCategory);
      if (!hasMain) return false;
    }

    if (selectedSubCategory !== 'ALL') {
      const hasSub =
        p.categorySub === selectedSubCategory ||
        p.serviceCategorySub === selectedSubCategory ||
        (p.serviceCategories || []).some(c => c.sub === selectedSubCategory);
      if (!hasSub) return false;
    }

    if (selectedCity !== 'ALL') {
      const matchCity =
        matchesTaiwanRegion(p.address, selectedCity) ||
        (p.addresses || []).some(
          a =>
            matchesTaiwanRegion(a.city, selectedCity, true) ||
            matchesTaiwanRegion(a.fullAddress, selectedCity)
        );
      if (!matchCity) return false;
    }

    if (selectedDistrict !== 'ALL') {
      const matchDist =
        matchesTaiwanRegion(p.address, selectedDistrict) ||
        (p.addresses || []).some(
          a =>
            matchesTaiwanRegion(a.district, selectedDistrict, true) ||
            matchesTaiwanRegion(a.fullAddress, selectedDistrict)
        );
      if (!matchDist) return false;
    }

    if (hasChequeFilter === 'HAS' && (!p.chequeRecords || p.chequeRecords.length === 0)) {
      return false;
    }
    if (hasChequeFilter === 'NONE' && p.chequeRecords && p.chequeRecords.length > 0) {
      return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const hit =
        p.bpCode.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.taxId.toLowerCase().includes(q) ||
        p.contactPerson.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        matchesTaiwanRegion(p.address, q) ||
        (p.addresses || []).some(
          a =>
            (a.fullAddress || '').toLowerCase().includes(q) ||
            (a.postalCode || '').toLowerCase().includes(q) ||
            matchesTaiwanRegion(a.fullAddress, q) ||
            matchesTaiwanRegion(a.city, q) ||
            matchesTaiwanRegion(a.district, q)
        ) ||
        (p.representative || '').toLowerCase().includes(q) ||
        (p.bankName || '').toLowerCase().includes(q) ||
        (p.categoryTags || []).some(t => t.toLowerCase().includes(q)) ||
        (p.categoryMain || '').toLowerCase().includes(q) ||
        (p.serviceCategoryMain || '').toLowerCase().includes(q) ||
        (p.categorySub || '').toLowerCase().includes(q) ||
        (p.serviceCategorySub || '').toLowerCase().includes(q) ||
        (p.serviceCategories || []).some(
          c => c.main.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q)
        ) ||
        (p.chequeRecords || []).some(
          chk =>
            chk.checkNumber.toLowerCase().includes(q) ||
            (chk.notes || '').toLowerCase().includes(q) ||
            chk.bankName.toLowerCase().includes(q)
        ) ||
        (p.businessCards || []).some(
          card =>
            card.name.toLowerCase().includes(q) ||
            (card.title || '').toLowerCase().includes(q) ||
            (card.notes || '').toLowerCase().includes(q)
        );
      if (!hit) return false;
    }

    return true;
  });
}

export function buildNewPartnerDraft(
  activeTab: 'CLIENTS' | 'VENDORS',
  clientsCount: number,
  vendorsCount: number,
  categoryTree: MappedCategoryItem[]
): BusinessPartner {
  const isClientMode = activeTab === 'CLIENTS';
  const newId = `BP-${Date.now().toString().slice(-6)}`;
  const newCode = isClientMode
    ? `CUST-${(clientsCount + 1).toString().padStart(4, '0')}`
    : `VEND-${(vendorsCount + 1).toString().padStart(4, '0')}`;
  const defaultVendorCategory = categoryTree[0]?.mainCategory || '鋼材';

  return {
    id: newId,
    bpCode: newCode,
    name: '',
    taxId: '',
    entityType: isClientMode ? 'NATURAL_PERSON' : 'CORPORATION',
    isIndividual: isClientMode,
    type: isClientMode ? 'CUSTOMER' : 'VENDOR',
    isCustomer: isClientMode,
    isVendor: !isClientMode,
    categoryMain: !isClientMode ? defaultVendorCategory : undefined,
    categorySub: '',
    serviceCategoryMain: !isClientMode ? defaultVendorCategory : '泥作裝修工程',
    serviceCategorySub: '',
    serviceCategories: !isClientMode
      ? [{ id: `CAT-${Date.now()}-1`, main: defaultVendorCategory, sub: '' }]
      : [],
    representative: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    bankName: '臺灣銀行',
    bankCode: '004',
    bankAccount: '',
    bankAccountName: '',
    bankFeePayer: 'COMPANY',
    hasInvoice: true,
    paymentTermsDays: 30,
    isHighRisk: false,
    currentScore: 85,
    status: 'ACTIVE',
    companyId: 'COMP-01',
    isDeleted: false,
    version: 1,
    addresses: [
      {
        id: `PADDR-${Date.now()}-1`,
        partnerId: newId,
        addressType: 'COMMUNICATION',
        label: '主要營業地址',
        postalCode: '',
        city: '',
        district: '',
        streetAddress: '',
        fullAddress: '',
        isDeleted: false
      }
    ],
    contacts: [
      {
        id: `PCON-${Date.now()}-1`,
        partnerId: newId,
        contactType: 'PRIMARY',
        name: '',
        title: '業務聯絡人',
        phone: '',
        mobile: '',
        extension: '',
        email: '',
        notes: '',
        isDeleted: false
      }
    ],
    bankAccounts: [
      {
        id: `BACC-${Date.now()}-1`,
        bpId: newId,
        bankCode: '004',
        bankName: '臺灣銀行',
        accountNumber: '',
        accountName: '',
        isPrimary: true,
        passbookFiles: [],
        isDeleted: false
      }
    ],
    chequeRecords: [],
    businessCards: []
  };
}

function normalizeAddressRecord(a: PartnerAddress, partnerId: string): PartnerAddress {
  const hasStruct = Boolean(a.postalCode || a.city || a.district || a.streetAddress !== undefined);
  if (hasStruct || !a.fullAddress?.trim()) {
    return {
      ...a,
      partnerId: a.partnerId || partnerId,
      postalCode: a.postalCode || '',
      city: a.city ? normalizeTaiwanCity(a.city) : '',
      district: a.district || '',
      streetAddress: a.streetAddress ?? '',
      fullAddress: a.fullAddress || '',
      isHistorical: Boolean(a.isHistorical),
      archivedAt: a.archivedAt,
      archiveNote: a.archiveNote
    };
  }
  const parsed = parseTaiwanAddress(a.fullAddress);
  const city = parsed.city ? normalizeTaiwanCity(parsed.city) : '';
  return {
    ...a,
    partnerId: a.partnerId || partnerId,
    postalCode: parsed.postalCode || '',
    city,
    district: parsed.district || '',
    streetAddress: parsed.remaining !== undefined ? parsed.remaining : (parsed.city ? '' : a.fullAddress),
    fullAddress: a.fullAddress,
    isHistorical: Boolean(a.isHistorical),
    archivedAt: a.archivedAt,
    archiveNote: a.archiveNote
  };
}

export function normalizePartnerForEditor(p: BusinessPartner): BusinessPartner {
  const fallbackParsed = (!p.addresses || p.addresses.length === 0) && p.address?.trim()
    ? parseTaiwanAddress(p.address)
    : {};
  const fallbackCity = fallbackParsed.city ? normalizeTaiwanCity(fallbackParsed.city) : '';

  return {
    ...p,
    serviceCategories: p.serviceCategories || [
      {
        id: `CAT-${Date.now()}-1`,
        main: p.serviceCategoryMain || '泥作裝修工程',
        sub: p.serviceCategorySub || '粉刷打底工'
      }
    ],
    addresses:
      p.addresses && p.addresses.length > 0
        ? p.addresses.map(a => normalizeAddressRecord(a, p.id))
        : [
            {
              id: `PADDR-${Date.now()}-1`,
              partnerId: p.id,
              addressType: 'COMMUNICATION',
              label: '通訊地址',
              postalCode: fallbackParsed.postalCode || '',
              city: fallbackCity,
              district: fallbackParsed.district || '',
              streetAddress:
                fallbackParsed.remaining !== undefined
                  ? fallbackParsed.remaining
                  : fallbackCity
                  ? ''
                  : p.address || '',
              fullAddress: p.address || '',
              isDeleted: false
            }
          ],
    contacts:
      p.contacts && p.contacts.length > 0
        ? p.contacts
        : [
            {
              id: `PCON-${Date.now()}-1`,
              partnerId: p.id,
              contactType: 'PRIMARY',
              name: p.contactPerson || '',
              title: '主要聯絡人',
              phone: p.phone || '',
              mobile: '',
              extension: '',
              email: p.email || '',
              isDeleted: false
            }
          ],
    bankAccounts:
      p.bankAccounts && p.bankAccounts.length > 0
        ? p.bankAccounts
        : [
            {
              id: `BACC-${Date.now()}-1`,
              bpId: p.id,
              bankCode: p.bankCode || '004',
              bankName: p.bankName || '臺灣銀行',
              accountNumber: p.bankAccount || '',
              accountName: p.bankAccountName || p.name,
              isPrimary: true,
              passbookFiles: [],
              isDeleted: false
            }
          ],
    chequeRecords: p.chequeRecords || [],
    businessCards: p.businessCards || []
  };
}

export function exportPartnersToCsv(
  partnersList: BusinessPartner[],
  activeTab: 'CLIENTS' | 'VENDORS'
): void {
  const headers = [
    '夥伴代碼',
    '全銜/姓名',
    '業務型態',
    '實體性質',
    '是否為個人',
    '統一編號/身分證',
    '主要聯絡人',
    '聯絡電話',
    '電子信箱',
    '通訊地址',
    '第一階工料大類',
    '第二階細部工項',
    '金融機構代碼',
    '金融機構名稱',
    '銀行帳號',
    '帳戶戶名',
    '付款天數',
    '高風險管制',
    '風險原因'
  ];

  const rows = partnersList.map(p => {
    const typeLabel =
      p.type === 'CUSTOMER' ? '業主客戶' : p.type === 'BOTH' ? '雙重身分(業主暨廠商)' : '合作廠商';
    const entityLabel =
      p.isIndividual || p.entityType === 'NATURAL_PERSON' ? '自然人' : '公司法人';
    const primaryAddr =
      p.addresses?.find(a => !a.isHistorical)?.fullAddress ||
      p.addresses?.[0]?.fullAddress ||
      p.address ||
      '';
    const primaryContact = p.contacts?.[0]?.name || p.contactPerson || '';
    const primaryPhone = p.contacts?.[0]?.phone || p.contacts?.[0]?.mobile || p.phone || '';

    return [
      p.bpCode,
      p.name || '',
      typeLabel,
      entityLabel,
      p.isIndividual ? '是' : '否',
      p.taxId || '',
      primaryContact,
      primaryPhone,
      p.email || '',
      primaryAddr,
      p.categoryMain || p.serviceCategoryMain || '',
      p.categorySub || p.serviceCategorySub || '',
      p.bankCode || '',
      p.bankName || '',
      p.bankAccount ? `\t${p.bankAccount}` : '',
      p.bankAccountName || p.name,
      p.paymentTermsDays || 30,
      p.isHighRisk ? '是' : '否',
      p.riskReason || ''
    ];
  });

  const tabName = activeTab === 'CLIENTS' ? '業主客戶名冊' : '合作廠商工班名冊';
  exportCsvFile({
    filename: `${tabName}_匯出_${new Date().toISOString().slice(0, 10)}.csv`,
    headers,
    rows
  });
}
