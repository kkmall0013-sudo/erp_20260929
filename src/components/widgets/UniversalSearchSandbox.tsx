import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Search,
  RotateCcw,
  Lock,
  ShieldCheck,
  Eye,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Database
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getAllAccountsReceivable,
  getAllApReconciliations,
  getAllBankChecks,
  getAllBusinessPartners,
  getAllCompanies,
  getAllCompanyBankAccounts,
  getAllInboundReceipts,
  getAllInvoices,
  getAllPaymentRecords,
  getAllProjects,
  getAllProjectSites,
  subscribeToDatabase
} from '../../db/sqlite';
import {
  buildSearchPermissionContext,
  buildUnifiedFinanceRows,
  executeLayeredSearch,
  getDefaultOperatorForField,
  SearchCondition,
  SearchDatasetKey,
  SearchDatasetLookup,
  SearchFieldDescriptor,
  SearchFilterLayer,
  UNIVERSAL_SEARCH_SCHEMAS
} from '../../utils/universalSearchEngine';
import { BusinessPartner, Invoice, PaymentRecord } from '../../types/erp';

// ============================================================================
// 純記憶體測試誘餌資料（絕不寫入 SQLite 正式資料庫，刪除測試區即完全移除）
// ============================================================================
const MEMORY_BAIT_PARTNER: BusinessPartner = {
  id: 'BAIT-BP-SECRET',
  bpCode: 'BAIT-SEC-01',
  companyId: 'COMP-01',
  name: '測試台北秘密廠商股份有限公司 (記憶體誘餌)',
  type: 'VENDOR',
  isVendor: true,
  isCustomer: false,
  taxId: '24549210',
  categoryMain: '預拌混凝土',
  categoryTags: ['混凝土', '泵浦車'],
  contactPerson: '陳測試',
  phone: '02-2345-6789',
  email: 'test-sec@example.com',
  address: '100 臺北市中正區忠孝西路一段10號',
  addresses: [
    {
      id: 'BAIT-ADDR-1',
      partnerId: 'BAIT-BP-SECRET',
      addressType: 'COMMUNICATION',
      label: '營業處',
      postalCode: '100',
      city: '臺北市',
      district: '中正區',
      streetAddress: '忠孝西路一段10號',
      fullAddress: '100 臺北市中正區忠孝西路一段10號',
      isDeleted: false
    }
  ],
  bankCode: '004',
  bankName: '臺灣銀行',
  bankAccount: 'SECRET-ACCT-998877',
  bankAccountName: '秘密測試戶',
  hasInvoice: true,
  paymentTermsDays: 60,
  status: 'ACTIVE',
  isHighRisk: false,
  isDeleted: false,
  version: 1,
  createdAt: '2026-04-01',
  updatedAt: '2026-04-01'
};

const MEMORY_BAIT_BOSS_PAYMENT: PaymentRecord = {
  id: 'BAIT-PAY-BOSS-001',
  paymentNo: 'PAY-BOSS-BAIT-999',
  companyId: 'BOSS-01',
  currency: 'TWD',
  partnerId: 'BAIT-BP-SECRET',
  partnerName: '測試台北秘密廠商股份有限公司 (私帳誘餌)',
  documentDate: '2026-04-12',
  postingDate: '2026-04-12',
  paymentMethod: 'TT',
  isReversal: false,
  totalAmount: 88000,
  bankAccountId: 'BANK-BOSS',
  bankAccountName: '林董私人調度戶',
  isBossAdvance: true,
  isReconciled: false,
  status: 'POSTED',
  notes: '純記憶體老闆私帳誘餌，僅 BOSS / Superadmin 可查見',
  createdAt: '2026-04-12',
  updatedAt: '2026-04-12'
};

const MEMORY_BAIT_INVOICES: Invoice[] = [
  {
    id: 'BAIT-INV-SELF-01',
    taxReportingCompanyId: 'COMP-01',
    invoiceType: 'OUTPUT',
    invoiceNumber: 'ZZ-99887766',
    invoiceDate: '2026-04-10',
    taxPeriod: '2026-03-04',
    issuerTaxId: '88991234',
    issuerName: '台灣大巨營造工程股份有限公司',
    buyerName: '自留不交付業主 (401機密誘餌)',
    buyerTaxId: '24549210',
    netAmount: 100000,
    taxAmount: 5000,
    totalAmount: 105000,
    invoiceCategory: 'SALES_THREE_PART',
    invoiceIssueMode: 'SELF_RETAINED',
    status: 'VALID',
    createdAt: '2026-04-10',
    updatedAt: '2026-04-10'
  },
  {
    id: 'BAIT-INV-COMP02-01',
    taxReportingCompanyId: 'COMP-02',
    invoiceType: 'OUTPUT',
    invoiceNumber: 'AB-11223344',
    invoiceDate: '2026-04-11',
    taxPeriod: '2026-03-04',
    issuerTaxId: '54329876',
    issuerName: '宏達機電工程股份有限公司',
    buyerName: '宏達機電測試客戶 (跨法人誘餌)',
    buyerTaxId: '03795505',
    netAmount: 200000,
    taxAmount: 10000,
    totalAmount: 210000,
    invoiceCategory: 'SALES_THREE_PART',
    invoiceIssueMode: 'DELIVERED',
    status: 'VALID',
    createdAt: '2026-04-11',
    updatedAt: '2026-04-11'
  }
];

function getQuickDateRange(preset: 'THIS_MONTH' | 'LAST_3M' | 'THIS_YEAR'): { from: string; to: string } {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = now.getMonth(); // 0-indexed
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = (y: number, mZero: number) => new Date(y, mZero + 1, 0).getDate();

  if (preset === 'THIS_MONTH') {
    return {
      from: `${yyyy}-${pad(mm + 1)}-01`,
      to: `${yyyy}-${pad(mm + 1)}-${pad(lastDay(yyyy, mm))}`
    };
  }
  if (preset === 'LAST_3M') {
    const start = new Date(yyyy, mm - 2, 1);
    return {
      from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
      to: `${yyyy}-${pad(mm + 1)}-${pad(lastDay(yyyy, mm))}`
    };
  }
  return {
    from: `${yyyy}-01-01`,
    to: `${yyyy}-12-31`
  };
}

function hasFieldFormValue(field: SearchFieldDescriptor<any>, val: any): boolean {
  if (val === undefined || val === null) return false;
  switch (field.dataType) {
    case 'SELECT':
      return Array.isArray(val) && val.length > 0;
    case 'NUMBER':
      return Boolean((val.min !== undefined && val.min !== '') || (val.max !== undefined && val.max !== ''));
    case 'DATE':
      return Boolean(val.from || val.to);
    case 'BOOLEAN':
      return val === 'TRUE' || val === 'FALSE';
    default:
      return String(val).trim().length > 0;
  }
}

function buildConditionsFromFormValues(
  allSchemaFields: SearchFieldDescriptor<any>[],
  formValues: Record<string, any>
): SearchCondition[] {
  const conditions: SearchCondition[] = [];
  for (const field of allSchemaFields) {
    const val = formValues[field.key];
    if (!hasFieldFormValue(field, val)) continue;

    if (field.dataType === 'BOOLEAN') {
      conditions.push({
        id: `FORM-${field.key}`,
        fieldKey: field.key,
        operator: val === 'TRUE' ? 'IS_TRUE' : 'IS_FALSE',
        value: val === 'TRUE'
      });
    } else {
      conditions.push({
        id: `FORM-${field.key}`,
        fieldKey: field.key,
        operator: getDefaultOperatorForField(field.dataType),
        value: val
      });
    }
  }
  return conditions;
}

export const UniversalSearchSandbox: React.FC<{ onNotify?: (msg: string) => void }> = ({ onNotify }) => {
  const {
    currentUser,
    allUsers,
    activeCompanyId,
    isSuperadmin,
    isBoss,
    isAdmin,
    can,
    switchUser
  } = useAuth();

  const [dbTick, setDbTick] = useState(0);
  useEffect(() => {
    const unsub = subscribeToDatabase(() => setDbTick(t => t + 1));
    return () => unsub();
  }, []);

  const [includeMemoryBait, setIncludeMemoryBait] = useState<boolean>(true);
  const [datasetKey, setDatasetKey] = useState<SearchDatasetKey>('PARTNERS');
  const [keyword, setKeyword] = useState<string>('');
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [isFormExpanded, setIsFormExpanded] = useState<boolean>(false);
  const [showSecurityDetails, setShowSecurityDetails] = useState<boolean>(false);

  // 分頁控制（因應進貨等單月破百、全年上千筆情境）
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // 點選列後直接開啟中央檢視視窗（Modal），支援上一筆／下一筆
  const [modalRowId, setModalRowId] = useState<string | null>(null);

  // 讀取 SQLite 資料庫唯讀快照 ＋ 選擇性混入純記憶體測試誘餌
  const dbSnapshot = useMemo(() => {
    void dbTick;
    const companies = getAllCompanies();
    const projects = getAllProjects();
    const projectSites = getAllProjectSites();
    const rawPartners = getAllBusinessPartners();
    const inboundReceipts = getAllInboundReceipts();
    const reconciliations = getAllApReconciliations();
    const rawPayments = getAllPaymentRecords();
    const arList = getAllAccountsReceivable();
    const checks = getAllBankChecks();
    const rawInvoices = getAllInvoices();
    const bankAccounts = getAllCompanyBankAccounts();

    const partners = includeMemoryBait ? [MEMORY_BAIT_PARTNER, ...rawPartners] : rawPartners;
    const payments = includeMemoryBait ? [MEMORY_BAIT_BOSS_PAYMENT, ...rawPayments] : rawPayments;
    const invoices = includeMemoryBait ? [...MEMORY_BAIT_INVOICES, ...rawInvoices] : rawInvoices;

    const companiesById = new Map(companies.map(c => [c.id, c]));
    const sitesByProjectId = new Map(projectSites.map(s => [s.projectId, s]));
    const partnersById = new Map(partners.map(p => [p.id, p]));
    const bankAccountsById = new Map(bankAccounts.map(b => [b.id, b]));

    const lookup: SearchDatasetLookup = {
      companiesById,
      sitesByProjectId,
      partnersById,
      bankAccountsById
    };

    const financeRows = buildUnifiedFinanceRows({
      reconciliations,
      payments,
      arList,
      checks,
      bankAccountsById
    });

    return {
      lookup,
      datasets: {
        PARTNERS: partners,
        PROJECTS: projects,
        INBOUND_RECEIPTS: inboundReceipts,
        FINANCE_LEDGER: financeRows,
        TAX_401_INVOICES: invoices
      } as Record<SearchDatasetKey, any[]>
    };
  }, [dbTick, includeMemoryBait]);

  const permCtx = useMemo(
    () =>
      buildSearchPermissionContext({
        user: currentUser,
        activeCompanyId,
        isSuperadmin,
        isBoss,
        isAdmin,
        can
      }),
    [currentUser, activeCompanyId, isSuperadmin, isBoss, isAdmin, can]
  );

  const activeSchema = UNIVERSAL_SEARCH_SCHEMAS[datasetKey];

  const singleLayerStack = useMemo<SearchFilterLayer[]>(() => {
    const conditions = buildConditionsFromFormValues(activeSchema.fields, formValues);
    return [
      {
        id: 'FORM-GRID',
        label: '表格條件',
        combinator: 'AND',
        keyword,
        conditions
      }
    ];
  }, [activeSchema, formValues, keyword]);

  const execution = useMemo(() => {
    return executeLayeredSearch(
      dbSnapshot.datasets[datasetKey] || [],
      activeSchema,
      singleLayerStack,
      permCtx,
      dbSnapshot.lookup
    );
  }, [dbSnapshot, datasetKey, activeSchema, singleLayerStack, permCtx]);

  // 資料表頁籤清單（依當前帳號計算授權筆數 / 鎖定）
  const datasetAccessStates = useMemo(() => {
    const keys: SearchDatasetKey[] = [
      'PARTNERS',
      'PROJECTS',
      'INBOUND_RECEIPTS',
      'FINANCE_LEDGER',
      'TAX_401_INVOICES'
    ];
    return keys.map(k => {
      const schema = UNIVERSAL_SEARCH_SCHEMAS[k];
      const access = schema.canAccessDataset(permCtx);
      const count = access.allowed
        ? schema.filterAuthorizedRecords(dbSnapshot.datasets[k] || [], permCtx, dbSnapshot.lookup).length
        : 0;
      return { key: k, schema, allowed: access.allowed, count };
    });
  }, [permCtx, dbSnapshot]);

  // 分頁切片計算
  const totalResults = execution.results.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedResults = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return execution.results.slice(start, start + pageSize);
  }, [execution.results, safePage, pageSize]);

  // 搜尋條件變動時自動回到第 1 頁
  useEffect(() => {
    setCurrentPage(1);
  }, [datasetKey, keyword, formValues, currentUser?.id, includeMemoryBait]);

  // 彈出檢視視窗目前索引與支援上一筆 / 下一筆
  const modalIndex = useMemo(() => {
    if (!modalRowId) return -1;
    return execution.results.findIndex(r => r.id === modalRowId);
  }, [execution.results, modalRowId]);

  const modalItem = modalIndex >= 0 ? execution.results[modalIndex] : null;

  const handlePrevModal = useCallback(() => {
    if (modalIndex > 0) {
      setModalRowId(execution.results[modalIndex - 1].id);
    }
  }, [modalIndex, execution.results]);

  const handleNextModal = useCallback(() => {
    if (modalIndex >= 0 && modalIndex < execution.results.length - 1) {
      setModalRowId(execution.results[modalIndex + 1].id);
    }
  }, [modalIndex, execution.results]);

  // 鍵盤 Esc 關閉 Modal、左右鍵切換上/下一筆
  useEffect(() => {
    if (!modalItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalRowId(null);
      } else if (e.key === 'ArrowLeft' && !(e.target instanceof HTMLInputElement)) {
        handlePrevModal();
      } else if (e.key === 'ArrowRight' && !(e.target instanceof HTMLInputElement)) {
        handleNextModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalItem, handlePrevModal, handleNextModal]);

  const handleSelectDataset = (nextKey: SearchDatasetKey) => {
    setDatasetKey(nextKey);
    setKeyword('');
    setFormValues({});
    setModalRowId(null);
    setCurrentPage(1);
  };

  const handleFieldValueChange = (fieldKey: string, val: any) => {
    setFormValues(prev => ({ ...prev, [fieldKey]: val }));
  };

  const handleResetAll = () => {
    setKeyword('');
    setFormValues({});
    setModalRowId(null);
    setCurrentPage(1);
  };

  const activeConditionCount = useMemo(() => {
    const fieldCount = activeSchema.fields.filter(f => hasFieldFormValue(f, formValues[f.key])).length;
    return fieldCount + (keyword.trim() ? 1 : 0);
  }, [activeSchema, formValues, keyword]);

  // 一鍵測試範例
  const applyPresetScenario = (preset: 'TAIPEI_VENDOR' | 'INBOUND_CONCRETE' | 'HIGH_SEC_BAIT') => {
    setModalRowId(null);
    setIsFormExpanded(true);
    if (preset === 'TAIPEI_VENDOR') {
      setDatasetKey('PARTNERS');
      setKeyword('');
      setFormValues({
        roleType: ['VENDOR'],
        region: '台北'
      });
      onNotify?.('已填入「合作廠商 + 地區『台北』(相容臺北市)」表單條件');
    } else if (preset === 'INBOUND_CONCRETE') {
      setDatasetKey('INBOUND_RECEIPTS');
      setKeyword('');
      setFormValues({
        itemDetails: '混凝土'
      });
      onNotify?.('已切換至進貨表單並填入品名關鍵字「混凝土」');
    } else if (preset === 'HIGH_SEC_BAIT') {
      setIncludeMemoryBait(true);
      setDatasetKey('FINANCE_LEDGER');
      setKeyword('');
      setFormValues({
        isBossPrivate: 'TRUE'
      });
      onNotify?.('已填入「老闆私帳 = 是」條件；可切換上方員工帳號實測自動隔離攔截！');
    }
  };

  const quickSwitchUsers = useMemo(() => {
    const orderIds = ['USR-BOSS', 'USR-004', 'USR-005', 'USR-003', 'USR-006', 'USR-CASHIER-B', 'USR-007'];
    const prioritized = orderIds
      .map(id => allUsers.find(u => u.id === id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u));
    const extras = allUsers.filter(u => !orderIds.includes(u.id) && u.status === 'ACTIVE').slice(0, 2);
    return [...prioritized, ...extras];
  }, [allUsers]);

  return (
    <div className="space-y-4">
      {/* 1. 測試區定位說明與帳號切換列（無外門鎖，任何身分皆可停留測試） */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                通用搜尋與權限隔離獨立測試區
              </h3>
              <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                受系統中樞開關管控 · 唯讀不寫入資料庫
              </span>
            </div>
            <p className="text-xs text-slate-500">
              當 Superadmin 於「系統中樞 → 軟體程式設定 → 全系統開放模組授權」開啟測試模組時，所有啟用帳號皆可進入停留驗證；關閉時僅 Superadmin 本人可見。所有查詢與欄位比對皆嚴格依當前帳號之真實 PBAC 與私帳／401 權限執行。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeMemoryBait}
                onChange={e => setIncludeMemoryBait(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span>混入純記憶體測試誘餌</span>
            </label>

            <button
              type="button"
              onClick={() => applyPresetScenario('TAIPEI_VENDOR')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap cursor-pointer"
            >
              範例：台北廠商
            </button>
            <button
              type="button"
              onClick={() => applyPresetScenario('INBOUND_CONCRETE')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap cursor-pointer"
            >
              範例：進貨材料
            </button>
            <button
              type="button"
              onClick={() => applyPresetScenario('HIGH_SEC_BAIT')}
              className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-medium text-amber-900 whitespace-nowrap cursor-pointer"
            >
              實測：私帳權限防洩
            </button>
          </div>
        </div>

        {/* 快速切換帳號（停留於測試區內即時驗證不同角色權限） */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 mr-1 whitespace-nowrap">
              切換測試帳號：
            </span>
            {quickSwitchUsers.map(u => {
              const isActive = currentUser?.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    switchUser(u.id);
                    setModalRowId(null);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {u.fullName}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
            <span>
              當前身分：<strong className="text-slate-900">{currentUser?.fullName || '未登入'}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>{currentUser?.title || currentUser?.role}</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>
              授權法人：
              <strong className="font-mono tabular-nums text-slate-900">
                {permCtx.allowedCompanyIds === 'ALL'
                  ? '全集團不限'
                  : permCtx.allowedCompanyIds.join(', ') || '無'}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className={permCtx.canSeeBossPrivate ? 'text-emerald-700 font-medium' : 'text-rose-700 font-medium'}>
              老闆私帳：{permCtx.canSeeBossPrivate ? '開放存取' : '嚴格隔離'}
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className={permCtx.canSee401TaxData ? 'text-emerald-700 font-medium' : 'text-rose-700 font-medium'}>
              401 稅務發票：
              {permCtx.canSeeFull401SelfRetained
                ? '完整開放（含自主留存）'
                : permCtx.canSee401TaxData
                ? '僅一般發票（隔離自主留存）'
                : '禁止搜尋'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. 搜尋資料對象切換列 */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 flex flex-wrap items-center gap-1.5">
        {datasetAccessStates.map(ds => {
          const isCurrent = ds.key === datasetKey;
          return (
            <button
              key={ds.key}
              type="button"
              onClick={() => handleSelectDataset(ds.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isCurrent
                  ? 'bg-indigo-600 text-white'
                  : ds.allowed
                  ? 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}
            >
              {!ds.allowed && <Lock className="w-3 h-3 shrink-0" />}
              <span>{ds.schema.label}</span>
              <span className={`font-mono tabular-nums text-[11px] ${isCurrent ? 'text-indigo-100' : 'text-slate-400'}`}>
                {ds.allowed ? `(${ds.count})` : '(無權限)'}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. 若無該資料表權限 -> 立即安全攔截 */}
      {!execution.hasDatasetAccess ? (
        <div className="bg-white rounded-xl border border-rose-200 p-8 text-center space-y-3">
          <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900">
              無權限存取「{activeSchema.label}」
            </h4>
            <p className="text-xs text-rose-700 max-w-lg mx-auto">
              {execution.datasetDeniedReason}
            </p>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              即使可進入本測試區，資料查詢層依然徹底封鎖；總筆數、表單格子與內容皆不會載入或曝光。
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 4. 搜尋列（預設僅保留快速關鍵字；點擊「展開更多條件」才打開格狀條件表格） */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
            {/* 表單頂部操作列 */}
            <div
              className={`flex flex-wrap items-center justify-between gap-2 ${
                isFormExpanded || execution.droppedUnauthorizedConditionsTotal > 0
                  ? 'pb-3 border-b border-slate-100'
                  : ''
              }`}
            >
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder={`快速關鍵字搜尋（僅掃描您有權限的 ${execution.accessibleFields.length} 個欄位；已相容台/臺與縣市別名）...`}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeConditionCount > 0 && (
                  <span className="text-xs text-indigo-700 font-semibold font-mono tabular-nums">
                    已套用 {activeConditionCount} 項條件
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsFormExpanded(prev => !prev)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  {isFormExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>{isFormExpanded ? '收合條件表格' : '展開更多條件'}</span>
                </button>
                {activeConditionCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-600 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>清空條件</span>
                  </button>
                )}
              </div>
            </div>

            {/* 殘留高敏條件自動攔截提示 */}
            {execution.droppedUnauthorizedConditionsTotal > 0 && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    系統已自動攔截並排除 <strong>{execution.droppedUnauthorizedConditionsTotal}</strong> 個超出當前帳號權限的搜尋條件（如老闆私帳／401 發票／財務機密欄位），確保切換身分不外洩。
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="text-xs font-semibold text-amber-900 underline whitespace-nowrap cursor-pointer"
                >
                  清除殘留值
                </button>
              </div>
            )}

            {/* 展開條件表格時顯示：權限欄位防護條 ＋ 固定格狀搜尋表單網格 */}
            {isFormExpanded && (
              <div className="space-y-3">
                {execution.blockedFields.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-700">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          目前身分開放 <strong>{execution.accessibleFields.length}</strong> 個搜尋欄位，已自表單與關鍵字池隱藏隔離{' '}
                          <strong className="text-rose-700">{execution.blockedFields.length}</strong> 個敏感欄位
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSecurityDetails(prev => !prev)}
                        className="text-xs font-medium text-indigo-600 hover:underline whitespace-nowrap cursor-pointer"
                      >
                        {showSecurityDetails ? '收合隱藏欄位清單' : '查看已隱藏欄位'}
                      </button>
                    </div>

                    {showSecurityDetails && (
                      <div className="pt-2 border-t border-slate-200/80 divide-y divide-slate-200/60 text-xs">
                        {execution.blockedFields.map(bf => (
                          <div key={bf.key} className="py-1 flex flex-wrap items-center justify-between gap-2 text-slate-600">
                            <span className="flex items-center gap-1.5 font-medium text-slate-800">
                              <Lock className="w-3 h-3 text-rose-500 shrink-0" />
                              <span>{bf.label}</span>
                            </span>
                            <span className="text-slate-500">{bf.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {execution.accessibleFields.map(field => {
                  const val = formValues[field.key];
                  return (
                    <div
                      key={field.key}
                      className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[11px] font-semibold text-slate-700 truncate">
                          {field.label}
                        </label>
                        {field.dataType === 'REGION' && (
                          <span className="text-[10px] text-indigo-600 font-medium whitespace-nowrap">
                            台/臺·別名通用
                          </span>
                        )}
                        {field.dataType === 'DATE' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleFieldValueChange(field.key, getQuickDateRange('THIS_MONTH'))}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                            >
                              本月
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFieldValueChange(field.key, getQuickDateRange('LAST_3M'))}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                            >
                              近3月
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFieldValueChange(field.key, getQuickDateRange('THIS_YEAR'))}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                            >
                              本年
                            </button>
                          </div>
                        )}
                      </div>

                      {field.dataType === 'SELECT' && field.options ? (
                        <div className="flex flex-wrap gap-1">
                          {field.options.map(opt => {
                            const selectedArr: string[] = Array.isArray(val) ? val : [];
                            const checked = selectedArr.includes(opt.value);
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  const next = checked
                                    ? selectedArr.filter(v => v !== opt.value)
                                    : [...selectedArr, opt.value];
                                  handleFieldValueChange(field.key, next);
                                }}
                                className={`px-2 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                                  checked
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : field.dataType === 'NUMBER' ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={val?.min ?? ''}
                            onChange={e =>
                              handleFieldValueChange(field.key, { ...(val || {}), min: e.target.value })
                            }
                            placeholder="最小值"
                            className="w-1/2 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-hidden"
                          />
                          <span className="text-xs text-slate-400">~</span>
                          <input
                            type="number"
                            value={val?.max ?? ''}
                            onChange={e =>
                              handleFieldValueChange(field.key, { ...(val || {}), max: e.target.value })
                            }
                            placeholder="最大值"
                            className="w-1/2 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-hidden"
                          />
                        </div>
                      ) : field.dataType === 'DATE' ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={val?.from ?? ''}
                            onChange={e =>
                              handleFieldValueChange(field.key, { ...(val || {}), from: e.target.value })
                            }
                            className="w-1/2 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-hidden"
                          />
                          <span className="text-xs text-slate-400">~</span>
                          <input
                            type="date"
                            value={val?.to ?? ''}
                            onChange={e =>
                              handleFieldValueChange(field.key, { ...(val || {}), to: e.target.value })
                            }
                            className="w-1/2 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-hidden"
                          />
                        </div>
                      ) : field.dataType === 'BOOLEAN' ? (
                        <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-[11px]">
                          {[
                            { v: '', label: '不限' },
                            { v: 'TRUE', label: '是' },
                            { v: 'FALSE', label: '否' }
                          ].map(opt => {
                            const active = (val || '') === opt.v;
                            return (
                              <button
                                key={opt.v || 'ALL'}
                                type="button"
                                onClick={() => handleFieldValueChange(field.key, opt.v)}
                                className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                                  active
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={String(val ?? '')}
                          onChange={e => handleFieldValueChange(field.key, e.target.value)}
                          placeholder={field.placeholder || '空白＝不限'}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-500 outline-hidden"
                        />
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>

          {/* 5. 搜尋結果清單（支援分頁，點擊任何一列直接彈出檢視視窗） */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  篩選結果清單（命中{' '}
                  <span className="font-mono tabular-nums text-indigo-700">{totalResults}</span> /{' '}
                  <span className="font-mono tabular-nums">{execution.totalAuthorizedPoolCount}</span> 筆授權資料）
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  點選任一筆資料將直接於畫面中央彈出獨立檢視視窗，無須捲動至頁面底部；看完關閉即可停留在原列表位置。
                </p>
              </div>

              {/* 分頁筆數與換頁器 */}
              <div className="flex items-center gap-2 text-xs">
                <label className="text-slate-500 whitespace-nowrap">每頁顯示</label>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-slate-200 rounded-md bg-white text-slate-700 font-mono tabular-nums"
                >
                  <option value={20}>20 筆</option>
                  <option value={50}>50 筆</option>
                  <option value={100}>100 筆</option>
                </select>

                <div className="flex items-center gap-1 border border-slate-200 rounded-md px-1.5 py-0.5 bg-slate-50">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-0.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                    title="上一頁"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono tabular-nums text-slate-700 px-1">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-0.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                    title="下一頁"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {pagedResults.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-700">
                  查無符合目前表單條件之資料
                </p>
                <p className="text-xs text-slate-500">
                  請放寬上方篩選條件，或確認是否因目前帳號權限已自動隔離該筆敏感資料。
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap w-10 text-center">#</th>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">對象標題 / 摘要</th>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">所屬法人</th>
                      {execution.accessibleFields.slice(0, 4).map(f => (
                        <th key={f.key} className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          {f.label}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap text-right">檢視</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedResults.map((item, idx) => {
                      const globalIndex = (safePage - 1) * pageSize + idx + 1;
                      const isModalTarget = modalRowId === item.id;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setModalRowId(item.id)}
                          className={`hover:bg-indigo-50/40 cursor-pointer transition-colors ${
                            isModalTarget ? 'bg-indigo-50/70' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-400">
                            {globalIndex}
                          </td>
                          <td className="py-2.5 px-3 max-w-xs">
                            <div className="font-semibold text-slate-900 truncate">{item.title}</div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</div>
                            {item.matchedFields.length > 0 && (
                              <div className="text-[11px] text-indigo-700 mt-0.5 truncate">
                                命中：{item.matchedFields.map(m => `${m.fieldLabel}(${m.matchedText})`).join(' · ')}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {item.companyLabel}
                          </td>
                          {execution.accessibleFields.slice(0, 4).map(f => {
                            const col = item.displayColumns.find(c => c.key === f.key);
                            return (
                              <td
                                key={f.key}
                                className={`py-2.5 px-3 text-slate-700 max-w-[180px] truncate ${
                                  f.dataType === 'NUMBER' ? 'font-mono tabular-nums' : ''
                                }`}
                              >
                                {col?.value || '-'}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setModalRowId(item.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-700 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>開啟檢視</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. 置中獨立檢視彈窗（Modal），看完即關不跑動捲軸，支援上一筆／下一筆快速連看 */}
      {modalItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
          onClick={() => setModalRowId(null)}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal 標題與 上一筆/下一筆 導覽 */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                    第 {modalIndex + 1} / {execution.results.length} 筆
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {modalItem.title}
                  </h4>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {modalItem.companyLabel} · {modalItem.subtitle}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={modalIndex <= 0}
                  onClick={handlePrevModal}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 text-xs font-medium text-slate-700 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>上一筆</span>
                </button>
                <button
                  type="button"
                  disabled={modalIndex >= execution.results.length - 1}
                  onClick={handleNextModal}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 text-xs font-medium text-slate-700 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <span>下一筆</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setModalRowId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer ml-1"
                  title="關閉視窗 (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal 內容：依當前身分權限僅顯示開放欄位 */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {execution.accessibleFields.map(f => {
                  const rawVal = f.formatDisplay
                    ? f.formatDisplay(modalItem.record, dbSnapshot.lookup)
                    : (() => {
                        const raw = f.extract(modalItem.record, dbSnapshot.lookup);
                        return Array.isArray(raw) ? raw.filter(Boolean).join('、') : String(raw ?? '-');
                      })();
                  return (
                    <div key={f.key} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500">{f.label}</div>
                      <div
                        className={`text-slate-900 font-medium mt-1 break-all ${
                          f.dataType === 'NUMBER' ? 'font-mono tabular-nums' : ''
                        }`}
                      >
                        {rawVal || '-'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {execution.blockedFields.length > 0 && (
                <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-3 space-y-2">
                  <div className="text-xs font-semibold text-rose-800 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>以下 {execution.blockedFields.length} 個敏感欄位已依當前帳號權限遮蔽隱藏</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {execution.blockedFields.map(bf => (
                      <div key={bf.key} className="px-2.5 py-2 rounded bg-white border border-rose-200/80">
                        <div className="font-medium text-rose-900">{bf.label}</div>
                        <div className="text-[11px] text-rose-700/80 mt-0.5">{bf.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal 底部 */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
              <span>提示：支援鍵盤 ← / → 切換上一筆／下一筆，按 Esc 關閉視窗</span>
              <button
                type="button"
                onClick={() => setModalRowId(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 cursor-pointer"
              >
                關閉預覽
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
