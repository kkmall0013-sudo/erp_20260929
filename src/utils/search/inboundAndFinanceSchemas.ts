import {
  AccountsPayableReconciliation,
  AccountReceivable,
  BankCheck,
  CompanyBankAccount,
  InboundReceipt,
  Invoice,
  PaymentRecord
} from '../../types/erp';
import {
  FinanceLedgerUnifiedRow,
  isCompanyAllowed,
  isRecordCompanyModuleAllowed,
  SearchDatasetSchema
} from './searchTypesAndPermissions';

export const INBOUND_RECEIPTS_SEARCH_SCHEMA: SearchDatasetSchema<InboundReceipt> = {
  key: 'INBOUND_RECEIPTS',
  label: '現場進貨與叫料簽收明細',
  subtitle: '可直接依材料品名、規格、工地地區或點收日查詢；進貨金額與會計對帳單號依權限隔離',
  primaryModule: 'INBOUND_RECEIPTS',
  canAccessDataset: ctx =>
    ctx.can('INBOUND_RECEIPTS', 'read')
      ? { allowed: true }
      : { allowed: false, reason: '您所屬群組未具備「進貨簽收 (INBOUND_RECEIPTS)」讀取權限' },
  filterAuthorizedRecords: (rows: InboundReceipt[], ctx) =>
    rows.filter(r => !r.isDeleted && isRecordCompanyModuleAllowed(r.companyId, 'INBOUND_RECEIPTS', ctx)),
  getRowId: (r: InboundReceipt) => r.id,
  getRowTitle: (r: InboundReceipt) => `${r.receiptNumber} · ${r.vendorNameSnapshot || r.vendorId}`,
  getRowSubtitle: (r: InboundReceipt) => {
    const itemsSummary = (r.items || []).map(i => `${i.itemName}${i.spec ? `(${i.spec})` : ''}`).slice(0, 3).join('、');
    return `${r.projectNameSnapshot || r.projectId} · 點收日 ${r.receivedDate} · ${itemsSummary || '無品項明細'}`;
  },
  getCompanyLabel: (r: InboundReceipt, lookup) =>
    lookup.companiesById.get(r.companyId)?.shortName || r.companyId,
  fields: [
    {
      key: 'docNumbers',
      label: '進貨單號 / 送貨單 / 訂貨單號',
      dataType: 'TEXT',
      sensitivity: 'PUBLIC',
      placeholder: '如：INB-2026、送貨單號',
      extract: (r: InboundReceipt) => [r.receiptNumber, r.deliveryNoteNumber || '', r.orderNumber || '']
    },
    {
      key: 'projectAndVendor',
      label: '案場名稱 / 供應廠商',
      dataType: 'TEXT',
      sensitivity: 'PUBLIC',
      placeholder: '案場或廠商關鍵字',
      extract: (r: InboundReceipt) => [
        r.projectNameSnapshot || '',
        r.projectCodeSnapshot || '',
        r.vendorNameSnapshot || '',
        r.vendorTaxIdSnapshot || ''
      ]
    },
    {
      key: 'siteRegion',
      label: '進貨案場地區（含舊名別名）',
      dataType: 'REGION',
      sensitivity: 'PUBLIC',
      placeholder: '如：台中市、雲林縣、台灣市',
      extract: (r: InboundReceipt, lookup) => {
        const site = lookup.sitesByProjectId.get(r.projectId);
        return site ? `${site.postalCode || ''} ${site.city || ''}${site.district || ''}${site.address || ''}` : '';
      }
    },
    {
      key: 'itemDetails',
      label: '進貨品名 / 規格明細',
      dataType: 'TEXT',
      sensitivity: 'PUBLIC',
      placeholder: '如：混凝土、鋼筋、模板、PVC管',
      extract: (r: InboundReceipt) =>
        (r.items || []).map(it => `${it.itemName} ${it.spec || ''} ${it.notes || ''}`),
      formatDisplay: (r: InboundReceipt) =>
        (r.items || []).map(it => `${it.itemName}×${it.quantity}${it.unit}`).slice(0, 2).join('、') || '-'
    },
    {
      key: 'receivedDate',
      label: '現場點收日期區間',
      dataType: 'DATE',
      sensitivity: 'PUBLIC',
      extract: (r: InboundReceipt) => r.receivedDate
    },
    {
      key: 'billingStatus',
      label: '請款狀態',
      dataType: 'SELECT',
      sensitivity: 'PUBLIC',
      options: [
        { value: 'PENDING_BILLING', label: '尚未對帳請款' },
        { value: 'BILLED', label: '已納入對帳請款' }
      ],
      extract: (r: InboundReceipt) => r.billingStatus
    },
    {
      key: 'totalAmount',
      label: '進貨未稅合計金額（商業機密）',
      dataType: 'NUMBER',
      sensitivity: 'COMMERCIAL_AMOUNT',
      allowFn: ctx => ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('PURCHASE_ORDERS', 'write') || ctx.can('FINANCE_AP', 'read'),
      blockedReason: '一般工務或無採購發包／財務權限人員無法搜尋進貨計價金額',
      extract: (r: InboundReceipt) => Number(r.totalAmount || 0),
      formatDisplay: (r: InboundReceipt) => `NT$ ${Number(r.totalAmount || 0).toLocaleString()}`
    },
    {
      key: 'reconciliationNumber',
      label: '會計對帳單號（財務欄位）',
      dataType: 'TEXT',
      sensitivity: 'FINANCE_PRIVATE',
      placeholder: 'REC-...',
      allowFn: ctx => ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('FINANCE_AP', 'read'),
      blockedReason: '需具備應付財務讀取權限才可搜尋對帳單號',
      extract: (r: InboundReceipt) => r.reconciliationNumber || ''
    }
  ]
};

export const FINANCE_LEDGER_SEARCH_SCHEMA: SearchDatasetSchema<FinanceLedgerUnifiedRow> = {
  key: 'FINANCE_LEDGER',
  label: '帳款與票據往來（含老闆私帳隔離）',
  subtitle: '整合 AP 對帳、出納付款、AR 應收與支票；無權限者徹底隔離老闆私帳與 401 發票欄位',
  primaryModule: 'FINANCE_AP',
  canAccessDataset: ctx => {
    const ok =
      ctx.isSuperadmin ||
      ctx.isBoss ||
      ctx.isAdmin ||
      ctx.can('FINANCE_AP', 'read') ||
      ctx.can('FINANCE_AR', 'read') ||
      ctx.can('BANK_CHECKS', 'read');
    return ok
      ? { allowed: true }
      : { allowed: false, reason: '您未具備應付 (AP)、應收 (AR) 或支票 (BANK_CHECKS) 任一財務模組讀取權限' };
  },
  filterAuthorizedRecords: (rows: FinanceLedgerUnifiedRow[], ctx) => {
    return rows.filter(row => {
      // 1. 老闆私帳紀錄嚴格隔離：無私帳權限者直接濾除，連筆數都不可得知
      if (row.isBossPrivate && !ctx.canSeeBossPrivate) return false;
      // 2. 公司法人隔離（BOSS-01 專屬私帳前面已檢查）
      if (row.companyId !== 'BOSS-01' && !isCompanyAllowed(row.companyId, ctx)) {
        return false;
      }
      const targetCid = row.companyId && row.companyId !== 'BOSS-01' ? row.companyId : undefined;
      // 3. 子模組權限隔離（同時檢查該筆資料所屬法人之授權矩陣）
      if ((row.ledgerKind === 'AP_RECON' || row.ledgerKind === 'PAYMENT') && !(ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('FINANCE_AP', 'read', targetCid))) {
        return false;
      }
      if (row.ledgerKind === 'AR' && !(ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('FINANCE_AR', 'read', targetCid))) {
        return false;
      }
      if (row.ledgerKind === 'BANK_CHECK' && !(ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('BANK_CHECKS', 'read', targetCid))) {
        return false;
      }
      return true;
    });
  },
  getRowId: (r: FinanceLedgerUnifiedRow) => `${r.ledgerKind}:${r.id}`,
  getRowTitle: (r: FinanceLedgerUnifiedRow) => `[${r.ledgerKindLabel}] ${r.docNo} · ${r.counterpartyName}`,
  getRowSubtitle: (r: FinanceLedgerUnifiedRow) =>
    `日期 ${r.docDate || '-'} · 狀態 ${r.status} · 帳戶：${r.bankAccountLabel}`,
  getCompanyLabel: (r: FinanceLedgerUnifiedRow, lookup) =>
    r.companyId === 'BOSS-01'
      ? '林董私帳專戶'
      : lookup.companiesById.get(r.companyId)?.shortName || r.companyId,
  fields: [
    {
      key: 'docNo',
      label: '單據 / 支票號碼',
      dataType: 'TEXT',
      sensitivity: 'PUBLIC',
      placeholder: 'REC-、PAY-、AR- 或支票號碼',
      extract: (r: FinanceLedgerUnifiedRow) => r.docNo
    },
    {
      key: 'ledgerKind',
      label: '帳務類型',
      dataType: 'SELECT',
      sensitivity: 'PUBLIC',
      options: [
        { value: 'AP_RECON', label: '應付對帳單' },
        { value: 'PAYMENT', label: '出納付款單' },
        { value: 'AR', label: '應收請款單' },
        { value: 'BANK_CHECK', label: '支票票據' }
      ],
      extract: (r: FinanceLedgerUnifiedRow) => r.ledgerKind
    },
    {
      key: 'counterpartyName',
      label: '往來對象（廠商／業主）',
      dataType: 'TEXT',
      sensitivity: 'PUBLIC',
      placeholder: '公司名稱或抬頭',
      extract: (r: FinanceLedgerUnifiedRow) => r.counterpartyName
    },
    {
      key: 'docDate',
      label: '帳務 / 到期日期區間',
      dataType: 'DATE',
      sensitivity: 'PUBLIC',
      extract: (r: FinanceLedgerUnifiedRow) => r.docDate
    },
    {
      key: 'amount',
      label: '帳款 / 票面金額區間',
      dataType: 'NUMBER',
      sensitivity: 'COMMERCIAL_AMOUNT',
      allowFn: ctx => ctx.canSeeCommercialAmounts,
      extract: (r: FinanceLedgerUnifiedRow) => r.amount,
      formatDisplay: (r: FinanceLedgerUnifiedRow) => `NT$ ${Number(r.amount || 0).toLocaleString()}`
    },
    {
      key: 'bankAccountLabel',
      label: '往來銀行帳戶名稱',
      dataType: 'TEXT',
      sensitivity: 'FINANCE_PRIVATE',
      placeholder: '如：合庫、台銀',
      allowFn: ctx =>
        ctx.isSuperadmin || ctx.isBoss || ctx.isAdmin || ctx.can('FINANCE_AP', 'read') || ctx.can('FINANCE_AR', 'read') || ctx.can('BANK_CHECKS', 'read'),
      blockedReason: '需具備財務收付或票據權限才可依往來銀行帳戶篩選',
      extract: (r: FinanceLedgerUnifiedRow) => r.bankAccountLabel
    },
    {
      key: 'invoiceNumber',
      label: '關聯發票字軌號碼（401 欄位）',
      dataType: 'TEXT',
      sensitivity: 'TAX_401',
      placeholder: '如：AB-12345678',
      allowFn: ctx => ctx.canSee401TaxData,
      blockedReason: '純出納／非會計人員未具備 401 稅務發票讀取權限，此欄位已隔離隱藏',
      extract: (r: FinanceLedgerUnifiedRow) => r.invoiceNumber || ''
    },
    {
      key: 'isBossPrivate',
      label: '老闆私帳／私人代墊交易（最高機密）',
      dataType: 'BOOLEAN',
      sensitivity: 'FINANCE_PRIVATE',
      allowFn: ctx => ctx.canSeeBossPrivate,
      blockedReason: '「老闆私帳」屬最高機密（僅董事長／Superadmin 可搜），一般管理員／會計／業務皆不可搜尋此欄位',
      extract: (r: FinanceLedgerUnifiedRow) => r.isBossPrivate,
      formatDisplay: (r: FinanceLedgerUnifiedRow) => (r.isBossPrivate ? '🔒 老闆私帳／代墊' : '公司正式戶')
    }
  ]
};

export const TAX_401_INVOICES_SEARCH_SCHEMA: SearchDatasetSchema<Invoice> = {
  key: 'TAX_401_INVOICES',
  label: '401 營業稅發票與自主留存憑證',
  subtitle: '專供會計／BOSS 搜尋進銷項字軌、雙月期別與稅額；嚴格隔離無 401 權限角色與自主留存機密',
  primaryModule: 'FINANCE_AR',
  canAccessDataset: ctx =>
    ctx.canSee401TaxData
      ? { allowed: true }
      : { allowed: false, reason: '您不具備「401 稅務／會計發票」檢視權限（工務／採購／純出納不可搜尋此資料表）' },
  filterAuthorizedRecords: (rows: Invoice[], ctx) =>
    rows.filter(inv => {
      const cid = inv.taxReportingCompanyId;
      if (!isCompanyAllowed(cid, ctx)) return false;
      const hasComp401 =
        ctx.isSuperadmin ||
        ctx.isBoss ||
        ctx.isAdmin ||
        ctx.can('FINANCE_AR', 'write', cid) ||
        ctx.can('FINANCE_AR', 'approve', cid) ||
        ctx.can('FINANCE_AP', 'write', cid) ||
        ctx.can('FINANCE_AP', 'approve', cid);
      if (!hasComp401) return false;
      // 自主開立留存報稅 (SELF_RETAINED) / 個人憑證 (PERSONAL_VOUCHER) 須完整雙邊會計權限或 BOSS
      const isConfidential401 =
        inv.invoiceIssueMode === 'SELF_RETAINED' ||
        inv.invoiceCategory === 'PERSONAL_VOUCHER' ||
        inv.invoiceCategory === 'NON_DEDUCTIBLE_INV';
      if (isConfidential401 && !ctx.canSeeFull401SelfRetained) return false;
      return true;
    }),
  getRowId: (r: Invoice) => r.id,
  getRowTitle: (r: Invoice) => `${r.invoiceNumber || '(免用字軌)'} · ${r.invoiceType === 'OUTPUT' ? '銷項' : '進項'}`,
  getRowSubtitle: (r: Invoice) =>
    `期別 ${r.taxPeriod || r.invoiceDate.slice(0, 7)} · ${r.invoiceType === 'OUTPUT' ? (r.buyerName || r.buyerTaxId) : (r.issuerName || r.issuerTaxId)} · 含稅 NT$ ${Number(r.totalAmount || 0).toLocaleString()}`,
  getCompanyLabel: (r: Invoice, lookup) =>
    lookup.companiesById.get(r.taxReportingCompanyId)?.shortName || r.taxReportingCompanyId,
  fields: [
    {
      key: 'invoiceNumber',
      label: '發票字軌號碼',
      dataType: 'TEXT',
      sensitivity: 'TAX_401',
      placeholder: '如：AA-、YZ-...',
      extract: (r: Invoice) => r.invoiceNumber || ''
    },
    {
      key: 'invoiceType',
      label: '進銷項別',
      dataType: 'SELECT',
      sensitivity: 'TAX_401',
      options: [
        { value: 'OUTPUT', label: '銷項發票（開出）' },
        { value: 'INPUT', label: '進項發票（取得）' }
      ],
      extract: (r: Invoice) => r.invoiceType
    },
    {
      key: 'taxPeriod',
      label: '401 雙月申報期別',
      dataType: 'TEXT',
      sensitivity: 'TAX_401',
      placeholder: '如：2026-03-04',
      extract: (r: Invoice) => r.taxPeriod || ''
    },
    {
      key: 'counterpartyInfo',
      label: '買受／開立方名稱與統編',
      dataType: 'TEXT',
      sensitivity: 'TAX_401',
      placeholder: '對象名稱或 8 碼統編',
      extract: (r: Invoice) => [r.buyerName || '', r.buyerTaxId || '', r.issuerName || '', r.issuerTaxId || '']
    },
    {
      key: 'invoiceDate',
      label: '發票開立日期區間',
      dataType: 'DATE',
      sensitivity: 'TAX_401',
      extract: (r: Invoice) => r.invoiceDate
    },
    {
      key: 'totalAmount',
      label: '含稅總金額區間',
      dataType: 'NUMBER',
      sensitivity: 'TAX_401',
      extract: (r: Invoice) => Number(r.totalAmount || 0),
      formatDisplay: (r: Invoice) => `NT$ ${Number(r.totalAmount || 0).toLocaleString()}`
    },
    {
      key: 'taxAmount',
      label: '營業稅額區間',
      dataType: 'NUMBER',
      sensitivity: 'TAX_401',
      extract: (r: Invoice) => Number(r.taxAmount || 0),
      formatDisplay: (r: Invoice) => `NT$ ${Number(r.taxAmount || 0).toLocaleString()}`
    },
    {
      key: 'invoiceIssueMode',
      label: '交付／自主留存模式（401 機密欄位）',
      dataType: 'SELECT',
      sensitivity: 'TAX_401',
      options: [
        { value: 'DELIVERED', label: '交付業主 / 一般憑證' },
        { value: 'SELF_RETAINED', label: '自主開立留存報稅（未交業主）' }
      ],
      allowFn: ctx => ctx.canSeeFull401SelfRetained,
      blockedReason: '「自主留存報稅模式」須同時具備進項與銷項雙邊會計權限（或 BOSS/Superadmin）才可查詢',
      extract: (r: Invoice) => r.invoiceIssueMode || 'DELIVERED',
      formatDisplay: (r: Invoice) => (r.invoiceIssueMode === 'SELF_RETAINED' ? '自主留存報稅' : '一般交付')
    }
  ]
};

/** 整合財務單據與私帳標記供跨表帳務搜尋 */
export function buildUnifiedFinanceRows(params: {
  reconciliations: AccountsPayableReconciliation[];
  payments: PaymentRecord[];
  arList: AccountReceivable[];
  checks: BankCheck[];
  bankAccountsById: Map<string, CompanyBankAccount>;
}): FinanceLedgerUnifiedRow[] {
  const { reconciliations, payments, arList, checks, bankAccountsById } = params;
  const rows: FinanceLedgerUnifiedRow[] = [];

  for (const r of reconciliations) {
    if (r.isDeleted) continue;
    const bank = r.designatedBankAccountId ? bankAccountsById.get(r.designatedBankAccountId) : undefined;
    const isBossPrivate = Boolean(
      r.isBossAdvance ||
        bank?.isVirtualAccount ||
        bank?.companyId === 'BOSS-01' ||
        r.designatedBankAccountId === 'BANK-BOSS'
    );
    rows.push({
      id: r.id,
      ledgerKind: 'AP_RECON',
      ledgerKindLabel: '應付對帳',
      docNo: r.reconciliationNumber,
      companyId: r.companyId,
      counterpartyName: r.vendorName || r.vendorId,
      docDate: r.paymentDueDate || r.billingPeriod || '',
      amount: Number(r.netPayableAmount || 0),
      status: r.status,
      bankAccountId: r.designatedBankAccountId,
      bankAccountLabel: isBossPrivate
        ? '🔒 老闆私帳代墊專戶'
        : r.designatedBankAccountName || bank?.bankName || '未指定專戶',
      invoiceNumber: r.invoiceNumber || '',
      isBossPrivate,
      notes: r.notes
    });
  }

  for (const p of payments) {
    if (p.isDeleted) continue;
    const bank = p.bankAccountId ? bankAccountsById.get(p.bankAccountId) : undefined;
    const isBossPrivate = Boolean(
      p.isBossAdvance ||
        bank?.isVirtualAccount ||
        bank?.companyId === 'BOSS-01' ||
        p.bankAccountId === 'BANK-BOSS' ||
        p.bankAccountId === 'BOSS_POCKET'
    );
    rows.push({
      id: p.id,
      ledgerKind: 'PAYMENT',
      ledgerKindLabel: '出納付款',
      docNo: p.paymentNo,
      companyId: isBossPrivate ? 'BOSS-01' : p.companyId,
      counterpartyName: p.partnerName || p.customVendorName || '-',
      docDate: p.postingDate || p.documentDate || '',
      amount: Number(p.totalAmount || 0),
      status: p.status,
      bankAccountId: p.bankAccountId,
      bankAccountLabel: isBossPrivate
        ? '🔒 老闆私帳／虛擬口袋'
        : p.bankAccountName || bank?.bankName || p.bankAccountId,
      isBossPrivate,
      notes: p.notes
    });
  }

  for (const ar of arList) {
    const isBossPrivate = false;
    rows.push({
      id: ar.id,
      ledgerKind: 'AR',
      ledgerKindLabel: '應收請款',
      docNo: ar.arNumber,
      companyId: ar.companyId,
      counterpartyName: ar.customerName,
      docDate: ar.invoiceDate || ar.dueDate || '',
      amount: Number(ar.amount || 0),
      status: ar.status,
      bankAccountLabel: ar.hasInvoice
        ? ar.invoiceIssueMode === 'SELF_RETAINED'
          ? '公司戶／自留開票'
          : '開票法人專戶'
        : '免開發票（可入私帳／現金）',
      invoiceNumber: ar.invoiceNumber || '',
      invoiceIssueMode: ar.invoiceIssueMode,
      isBossPrivate,
      notes: ar.notes
    });
  }

  for (const c of checks) {
    const isBossPrivate = Boolean(
      c.companyId === 'BOSS-01' ||
        (c.bankName || '').includes('私帳') ||
        (c.bankName || '').includes('老闆')
    );
    rows.push({
      id: c.id,
      ledgerKind: 'BANK_CHECK',
      ledgerKindLabel: c.type === 'RECEIVABLE' ? '應收支票' : '應付支票',
      docNo: c.checkNumber,
      companyId: c.companyId,
      counterpartyName: c.counterpartyName,
      docDate: c.dueDate || c.issueDate || '',
      amount: Number(c.amount || 0),
      status: c.status,
      bankAccountLabel: isBossPrivate ? '🔒 老闆私帳支票簿' : c.bankName || '-',
      isBossPrivate,
      notes: c.notes
    });
  }

  return rows;
}
