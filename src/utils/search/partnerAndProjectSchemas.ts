import { BusinessPartner, Project } from '../../types/erp';
import {
  isRecordCompanyModuleAllowed,
  SearchDatasetSchema
} from './searchTypesAndPermissions';

export const PARTNERS_SEARCH_SCHEMA: SearchDatasetSchema<BusinessPartner> = {
  key: 'PARTNERS',
  label: '商業夥伴（業主／廠商／下包）',
  subtitle: '含多組地址（相容台/臺與舊縣市別名）、多元工種、聯絡人；財務與稅籍欄位依權限隔離',
  primaryModule: 'PARTNERS',
  canAccessDataset: ctx =>
    ctx.can('PARTNERS', 'read')
      ? { allowed: true }
      : { allowed: false, reason: '您所屬群組未具備「商業夥伴 (PARTNERS)」讀取權限' },
  filterAuthorizedRecords: (rows: BusinessPartner[], ctx) =>
    rows.filter(r => !r.isDeleted && isRecordCompanyModuleAllowed(r.companyId, 'PARTNERS', ctx)),
  getRowId: (r: BusinessPartner) => r.id,
  getRowTitle: (r: BusinessPartner) => `${r.name} (${r.bpCode})`,
  getRowSubtitle: (r: BusinessPartner) => {
    const role =
      r.isCustomer && r.isVendor
        ? '業主兼廠商'
        : r.isCustomer
        ? '業主客戶'
        : r.type === 'SUBCONTRACTOR'
        ? '下包工班'
        : '材料/合作廠商';
    const tags = (r.categoryTags || []).slice(0, 3).join('、') || r.categoryMain || r.serviceCategoryMain || '未分類';
    return `${role} · ${tags} · ${r.taxId || '無統編'}`;
  },
  getCompanyLabel: (r: BusinessPartner, lookup) =>
    lookup.companiesById.get(r.companyId)?.shortName ||
    lookup.companiesById.get(r.companyId)?.name ||
    r.companyId ||
    '共用',
  fields: [
    {
      key: 'nameOrCode',
      label: '夥伴名稱 / 代號',
      dataType: 'TEXT',
      sensitivity: 'PUBLIC',
      placeholder: '如：台泥、富鼎、宏達、BP-...',
      extract: (r: BusinessPartner) => [r.name, r.bpCode, r.representative || '']
    },
    {
      key: 'taxId',
      label: '統一編號 / 身分證',
      dataType: 'TEXT',
      sensitivity: 'PUBLIC',
      placeholder: '輸入 8 碼統編或部分號碼',
      extract: (r: BusinessPartner) => [r.taxId || '', r.ownerIdNumber || '']
    },
    {
      key: 'roleType',
      label: '夥伴身分角色',
      dataType: 'SELECT',
      sensitivity: 'PUBLIC',
      options: [
        { value: 'CUSTOMER', label: '業主 / 客戶' },
        { value: 'VENDOR', label: '材料 / 合作廠商' },
        { value: 'SUBCONTRACTOR', label: '工程下包工班' },
        { value: 'BOTH', label: '業主兼廠商' }
      ],
      extract: (r: BusinessPartner) => {
        const roles: string[] = [];
        if (r.isCustomer || r.type === 'CUSTOMER' || r.type === 'BOTH') roles.push('CUSTOMER');
        if (r.isVendor || r.type === 'VENDOR' || r.type === 'BOTH') roles.push('VENDOR');
        if (r.type === 'SUBCONTRACTOR') roles.push('SUBCONTRACTOR');
        if ((r.isCustomer && r.isVendor) || r.type === 'BOTH') roles.push('BOTH');
        return roles;
      },
      formatDisplay: (r: BusinessPartner) =>
        r.isCustomer && r.isVendor
          ? '業主兼廠商'
          : r.isCustomer
          ? '業主/客戶'
          : r.type === 'SUBCONTRACTOR'
          ? '工程下包'
          : '合作廠商'
    },
    {
      key: 'region',
      label: '所在縣市／鄉鎮（含舊名別名）',
      dataType: 'REGION',
      sensitivity: 'PUBLIC',
      placeholder: '如：新北市、台北縣、台灣市、斗南鎮',
      extract: (r: BusinessPartner) => {
        const pool: string[] = [];
        if (r.address) pool.push(r.address);
        for (const a of r.addresses || []) {
          if (!a.isHistorical) {
            pool.push(`${a.postalCode || ''} ${a.city || ''}${a.district || ''}${a.streetAddress || ''} ${a.fullAddress || ''}`);
          }
        }
        return pool;
      },
      formatDisplay: (r: BusinessPartner) => {
        const primary = r.addresses?.find(a => !a.isHistorical);
        if (primary) return `${primary.postalCode ? `[${primary.postalCode}] ` : ''}${primary.city || ''}${primary.district || ''}`;
        return r.address || '未填寫';
      }
    },
    {
      key: 'tradeCategories',
      label: '工種 / 供料分類標籤',
      dataType: 'TEXT',
      sensitivity: 'PUBLIC',
      placeholder: '如：混凝土、鋼筋、水電、拆圖',
      extract: (r: BusinessPartner) => [
        r.serviceCategoryMain || '',
        r.serviceCategorySub || '',
        r.categoryMain || '',
        r.categorySub || '',
        ...(r.categoryTags || []),
        ...(r.serviceCategories || []).map(sc => `${sc.main} ${sc.sub}`)
      ],
      formatDisplay: (r: BusinessPartner) =>
        Array.from(new Set([...(r.categoryTags || []), r.categoryMain || '', r.serviceCategoryMain || ''].filter(Boolean))).join('、') || '未設定'
    },
    {
      key: 'contactInfo',
      label: '聯絡窗口 / 電話 / 名片',
      dataType: 'TEXT',
      sensitivity: 'PUBLIC',
      placeholder: '姓名、職稱、電話或名片備註',
      extract: (r: BusinessPartner) => [
        r.contactPerson || '',
        r.phone || '',
        r.email || '',
        ...(r.contacts || []).map(c => `${c.name} ${c.title || ''} ${c.phone || ''} ${c.mobile || ''} ${c.email || ''}`),
        ...(r.businessCards || []).map(bc => `${bc.name} ${bc.title || ''} ${bc.phone || ''} ${bc.mobile || ''} ${bc.notes || ''}`)
      ]
    },
    {
      key: 'status',
      label: '往來狀態',
      dataType: 'SELECT',
      sensitivity: 'PUBLIC',
      options: [
        { value: 'ACTIVE', label: '正常往來' },
        { value: 'WARNING', label: '觀察警示' },
        { value: 'PAYMENT_LOCKED', label: '暫停付款' },
        { value: 'SUSPENDED', label: '停權停用' }
      ],
      extract: (r: BusinessPartner) => r.status || 'ACTIVE'
    },
    {
      key: 'hasCheque',
      label: '是否有登記支票記錄',
      dataType: 'BOOLEAN',
      sensitivity: 'PUBLIC',
      extract: (r: BusinessPartner) => Boolean(r.chequeRecords && r.chequeRecords.length > 0),
      formatDisplay: (r: BusinessPartner) =>
        r.chequeRecords && r.chequeRecords.length > 0 ? `有 (${r.chequeRecords.length} 筆)` : '無登記支票'
    },
    {
      key: 'paymentTermsDays',
      label: '月結付款天數（商業條件）',
      dataType: 'NUMBER',
      sensitivity: 'COMMERCIAL_AMOUNT',
      allowFn: ctx => ctx.canSeeCommercialAmounts,
      blockedReason: '需具備採購／報價或財務讀取權限才可搜尋付款條件天數',
      extract: (r: BusinessPartner) => Number(r.paymentTermsDays || 0),
      formatDisplay: (r: BusinessPartner) => `${r.paymentTermsDays || 30} 天`
    },
    {
      key: 'bankAccount',
      label: '匯款銀行 / 帳戶資料（財務機密）',
      dataType: 'TEXT',
      sensitivity: 'FINANCE_PRIVATE',
      placeholder: '銀行名稱、代碼或帳號末碼',
      allowFn: ctx =>
        ctx.isSuperadmin ||
        ctx.isBoss ||
        ctx.isAdmin ||
        ctx.can('FINANCE_AP', 'read') ||
        ctx.can('FINANCE_AR', 'read') ||
        ctx.can('BANK_CHECKS', 'read'),
      blockedReason: '需具備會計／出納財務權限才可搜尋夥伴銀行帳戶',
      extract: (r: BusinessPartner) => [
        r.bankCode || '',
        r.bankName || '',
        r.bankAccount || '',
        r.bankAccountName || '',
        ...(r.bankAccounts || []).map(b => `${b.bankCode} ${b.bankName} ${b.accountNumber} ${b.accountName}`)
      ],
      formatDisplay: (r: BusinessPartner) =>
        r.bankAccount ? `${r.bankCode || ''} ${r.bankName || ''} (${r.bankAccount})` : '未建檔'
    },
    {
      key: 'hasInvoice',
      label: '是否開立三聯式發票（401 稅籍）',
      dataType: 'BOOLEAN',
      sensitivity: 'TAX_401',
      allowFn: ctx => ctx.canSee401TaxData,
      blockedReason: '需具備會計 / 401 稅務檢視權限才可依發票開立屬性篩選',
      extract: (r: BusinessPartner) => r.hasInvoice !== false,
      formatDisplay: (r: BusinessPartner) => (r.hasInvoice !== false ? '可開立統一發票' : '免用發票／個人領據')
    }
  ]
};

export const PROJECTS_SEARCH_SCHEMA: SearchDatasetSchema<Project> = {
  key: 'PROJECTS',
  label: '工程案場主檔（含工地位置）',
  subtitle: '跨表整合 projects 與 project_sites；金額欄位依報價／會計權限隔離',
  primaryModule: 'PROJECTS',
  canAccessDataset: ctx =>
    ctx.can('PROJECTS', 'read')
      ? { allowed: true }
      : { allowed: false, reason: '您所屬群組未具備「工程案場 (PROJECTS)」讀取權限' },
  filterAuthorizedRecords: (rows: Project[], ctx) =>
    rows.filter(r => !r.isDeleted && isRecordCompanyModuleAllowed(r.companyId, 'PROJECTS', ctx)),
  getRowId: (r: Project) => r.id,
  getRowTitle: (r: Project) => `${r.name} (${r.projectCode})`,
  getRowSubtitle: (r: Project, lookup) => {
    const site = lookup.sitesByProjectId.get(r.id);
    const addr = site
      ? `${site.postalCode ? `[${site.postalCode}] ` : ''}${site.city || ''}${site.district || ''}${site.streetAddress || ''}`
      : '尚未登記工地地址';
    return `業主：${r.ownerName} · 工地：${addr}`;
  },
  getCompanyLabel: (r: Project, lookup) =>
    lookup.companiesById.get(r.companyId)?.shortName ||
    lookup.companiesById.get(r.companyId)?.name ||
    r.companyId ||
    '未定',
  fields: [
    {
      key: 'nameOrCode',
      label: '案場名稱 / 專案代號',
      dataType: 'TEXT',
      sensitivity: 'PUBLIC',
      placeholder: '如：帝寶、廠房、PRJ-...',
      extract: (r: Project) => [r.name, r.projectCode, r.buildingType || '', r.workScope || '']
    },
    {
      key: 'ownerName',
      label: '業主名稱 / 統編',
      dataType: 'TEXT',
      sensitivity: 'PUBLIC',
      placeholder: '業主姓名、公司或統編',
      extract: (r: Project) => [r.ownerName, r.ownerTaxId || '']
    },
    {
      key: 'siteRegion',
      label: '工地縣市／鄉鎮（含舊名別名）',
      dataType: 'REGION',
      sensitivity: 'PUBLIC',
      placeholder: '如：雲林縣、斗南鎮、台灣市、台北縣',
      extract: (r: Project, lookup) => {
        const site = lookup.sitesByProjectId.get(r.id);
        if (!site) return '';
        const historyTexts = (site.addressHistory || []).map(
          h => `${h.postalCode || ''} ${h.city || ''}${h.district || ''}${h.fullAddress || ''}`
        );
        return [
          `${site.postalCode || ''} ${site.city || ''}${site.district || ''}${site.streetAddress || ''} ${site.address || ''}`,
          ...historyTexts
        ];
      },
      formatDisplay: (r: Project, lookup) => {
        const site = lookup.sitesByProjectId.get(r.id);
        if (!site) return '未登記';
        return `${site.postalCode ? `[${site.postalCode}] ` : ''}${site.city || ''}${site.district || ''}`;
      }
    },
    {
      key: 'siteTeamAndPermit',
      label: '法定團隊 / 起造人 / 執照字號',
      dataType: 'TEXT',
      sensitivity: 'PUBLIC',
      placeholder: '起造人、建築師、承造、拆圖廠商、主任或建照',
      extract: (r: Project, lookup) => {
        const site = lookup.sitesByProjectId.get(r.id);
        if (!site) return '';
        return [
          site.developerName || '',
          site.architect || '',
          site.constructor || '',
          site.shopDrawingVendorName || '',
          site.contactPerson || '',
          site.permitNumber || ''
        ];
      },
      formatDisplay: (r: Project, lookup) => {
        const site = lookup.sitesByProjectId.get(r.id);
        if (!site) return '-';
        return [site.architect, site.constructor, site.permitNumber].filter(Boolean).join(' / ') || '-';
      }
    },
    {
      key: 'status',
      label: '工程執行狀態',
      dataType: 'SELECT',
      sensitivity: 'PUBLIC',
      options: [
        { value: 'PLANNING', label: '規劃評估中' },
        { value: 'ACTIVE', label: '施工進行中' },
        { value: 'LOCKED', label: '鎖定凍結' },
        { value: 'COMPLETED', label: '已完工結案' }
      ],
      extract: (r: Project) => r.status
    },
    {
      key: 'startDate',
      label: '開工日期區間',
      dataType: 'DATE',
      sensitivity: 'PUBLIC',
      extract: (r: Project) => r.startDate || ''
    },
    {
      key: 'contractAmount',
      label: '合約總價（商業金額機密）',
      dataType: 'NUMBER',
      sensitivity: 'COMMERCIAL_AMOUNT',
      allowFn: ctx => ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('QUOTATIONS', 'read') || ctx.can('FINANCE_AR', 'read'),
      blockedReason: '工務／一般採購無報價或應收檢視權限時，不得搜尋案場承攬合約總價',
      extract: (r: Project) => Number(r.contractAmount || 0),
      formatDisplay: (r: Project) => `NT$ ${Number(r.contractAmount || 0).toLocaleString()}`
    },
    {
      key: 'actualCost',
      label: '已認列實際成本（財務機密）',
      dataType: 'NUMBER',
      sensitivity: 'FINANCE_PRIVATE',
      allowFn: ctx => ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('FINANCE_AP', 'read'),
      blockedReason: '需具備應付財務權限才可搜尋案場實際成本（工務無權查看）',
      extract: (r: Project) => Number(r.actualCost || 0),
      formatDisplay: (r: Project) => `NT$ ${Number(r.actualCost || 0).toLocaleString()}`
    }
  ]
};
