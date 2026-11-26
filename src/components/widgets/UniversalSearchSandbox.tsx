import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Lock, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { SearchResultDetailModal } from './SearchResultDetailModal';
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
  SearchDatasetKey,
  SearchDatasetLookup,
  SearchFilterLayer,
  UNIVERSAL_SEARCH_SCHEMAS
} from '../../utils/universalSearchEngine';
import {
  buildConditionsFromFormValues,
  hasFieldFormValue,
  MEMORY_BAIT_BOSS_PAYMENT,
  MEMORY_BAIT_INVOICES,
  MEMORY_BAIT_PARTNER
} from './searchSandbox/sandboxBaitAndHelpers';
import { SandboxTopControlsCard } from './searchSandbox/SandboxTopControlsCard';
import { SandboxConditionGridCard } from './searchSandbox/SandboxConditionGridCard';

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

  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
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

  const totalResults = execution.results.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedResults = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return execution.results.slice(start, start + pageSize);
  }, [execution.results, safePage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [datasetKey, keyword, formValues, currentUser?.id, includeMemoryBait]);

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

  const applyPresetScenario = (preset: 'TAIPEI_VENDOR' | 'INBOUND_CONCRETE' | 'HIGH_SEC_BAIT') => {
    setModalRowId(null);
    setIsFormExpanded(true);
    if (preset === 'TAIPEI_VENDOR') {
      setDatasetKey('PARTNERS');
      setKeyword('');
      setFormValues({ roleType: ['VENDOR'], region: '台北' });
      onNotify?.('已填入「合作廠商 + 地區『台北』(相容臺北市)」表單條件');
    } else if (preset === 'INBOUND_CONCRETE') {
      setDatasetKey('INBOUND_RECEIPTS');
      setKeyword('');
      setFormValues({ itemDetails: '混凝土' });
      onNotify?.('已切換至進貨表單並填入品名關鍵字「混凝土」');
    } else if (preset === 'HIGH_SEC_BAIT') {
      setIncludeMemoryBait(true);
      setDatasetKey('FINANCE_LEDGER');
      setKeyword('');
      setFormValues({ isBossPrivate: 'TRUE' });
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
      <SandboxTopControlsCard
        includeMemoryBait={includeMemoryBait}
        onToggleMemoryBait={setIncludeMemoryBait}
        onApplyPreset={applyPresetScenario}
        quickSwitchUsers={quickSwitchUsers}
        currentUser={currentUser}
        permCtx={permCtx}
        onSwitchUser={userId => {
          switchUser(userId);
          setModalRowId(null);
        }}
      />

      {/* 搜尋資料對象切換列 */}
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

      {/* 若無該資料表權限 -> 立即安全攔截 */}
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
          <SandboxConditionGridCard
            keyword={keyword}
            onKeywordChange={setKeyword}
            accessibleFields={execution.accessibleFields}
            blockedFields={execution.blockedFields}
            droppedUnauthorizedConditionsTotal={execution.droppedUnauthorizedConditionsTotal}
            activeConditionCount={activeConditionCount}
            isFormExpanded={isFormExpanded}
            onToggleExpand={() => setIsFormExpanded(prev => !prev)}
            showSecurityDetails={showSecurityDetails}
            onToggleSecurityDetails={() => setShowSecurityDetails(prev => !prev)}
            formValues={formValues}
            onFieldValueChange={handleFieldValueChange}
            onResetAll={handleResetAll}
          />

          {/* 搜尋結果清單 */}
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

      <SearchResultDetailModal
        isOpen={Boolean(modalItem)}
        item={modalItem}
        currentIndex={modalIndex}
        totalCount={execution.results.length}
        onPrev={handlePrevModal}
        onNext={handleNextModal}
        onClose={() => setModalRowId(null)}
        maxWidthClass="max-w-3xl"
        closeLabel="關閉預覽"
        fieldsOverride={
          modalItem
            ? execution.accessibleFields.map(f => {
                const rawVal = f.formatDisplay
                  ? f.formatDisplay(modalItem.record, dbSnapshot.lookup)
                  : (() => {
                      const raw = f.extract(modalItem.record, dbSnapshot.lookup);
                      return Array.isArray(raw) ? raw.filter(Boolean).join('、') : String(raw ?? '-');
                    })();
                return {
                  key: f.key,
                  label: f.label,
                  value: rawVal || '-',
                  isNumeric: f.dataType === 'NUMBER'
                };
              })
            : undefined
        }
        extraContent={
          execution.blockedFields.length > 0 ? (
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
          ) : undefined
        }
      />
    </div>
  );
};
