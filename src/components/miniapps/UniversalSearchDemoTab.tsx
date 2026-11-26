import React, { useMemo, useState } from 'react';
import { Check, Code2, Copy } from 'lucide-react';
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
  getAllProjectSites
} from '../../db/sqlite';
import {
  buildUnifiedFinanceRows,
  SearchDatasetKey,
  SearchDatasetLookup,
  SearchResultItem,
  UNIVERSAL_SEARCH_SCHEMAS
} from '../../utils/universalSearchEngine';
import { UniversalSearchBar } from '../widgets/UniversalSearchBar';
import { SearchResultDetailModal } from '../widgets/SearchResultDetailModal';

interface UniversalSearchDemoTabProps {
  erpRefreshTick: number;
  copiedCodeKey: string | null;
  onCopyCode: (key: string, code: string) => void;
}

export const UniversalSearchDemoTab: React.FC<UniversalSearchDemoTabProps> = ({
  erpRefreshTick,
  copiedCodeKey,
  onCopyCode
}) => {
  const [searchDemoDataset, setSearchDemoDataset] = useState<SearchDatasetKey>('PARTNERS');
  const [searchDemoResults, setSearchDemoResults] = useState<SearchResultItem[]>([]);
  const [searchDemoMeta, setSearchDemoMeta] = useState<{ totalPoolCount: number; activeConditionCount: number }>({
    totalPoolCount: 0,
    activeConditionCount: 0
  });
  const [selectedDemoResult, setSelectedDemoResult] = useState<SearchResultItem | null>(null);

  const universalSearchData = useMemo(() => {
    void erpRefreshTick;
    const companies = getAllCompanies();
    const sites = getAllProjectSites();
    const partners = getAllBusinessPartners();
    const bankAccounts = getAllCompanyBankAccounts();

    const lookup: SearchDatasetLookup = {
      companiesById: new Map(companies.map(c => [c.id, c])),
      sitesByProjectId: new Map(sites.map(s => [s.projectId, s])),
      partnersById: new Map(partners.map(p => [p.id, p])),
      bankAccountsById: new Map(bankAccounts.map(b => [b.id, b]))
    };

    const recordsByDataset: Record<SearchDatasetKey, any[]> = {
      PARTNERS: partners,
      PROJECTS: getAllProjects(),
      INBOUND_RECEIPTS: getAllInboundReceipts(),
      FINANCE_LEDGER: buildUnifiedFinanceRows({
        reconciliations: getAllApReconciliations(),
        payments: getAllPaymentRecords(),
        arList: getAllAccountsReceivable(),
        checks: getAllBankChecks(),
        bankAccountsById: lookup.bankAccountsById
      }),
      TAX_401_INVOICES: getAllInvoices()
    };

    return { lookup, recordsByDataset };
  }, [erpRefreshTick]);

  const selectedDemoIndex = selectedDemoResult
    ? searchDemoResults.findIndex(r => r.id === selectedDemoResult.id)
    : -1;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  通用搜尋與多欄位過濾元件 (UniversalSearchBar)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  預設維持單行關鍵字以保持工作區整潔；點擊「展開更多條件」即顯示目前權限可查詢的格狀欄位，並支援臺灣縣市別名與台／臺字形統一比對。
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(Object.keys(UNIVERSAL_SEARCH_SCHEMAS) as SearchDatasetKey[]).map(key => {
                const schema = UNIVERSAL_SEARCH_SCHEMAS[key];
                const active = searchDemoDataset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSearchDemoDataset(key);
                      setSelectedDemoResult(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {schema.label}
                  </button>
                );
              })}
            </div>

            <UniversalSearchBar
              datasetKey={searchDemoDataset}
              records={universalSearchData.recordsByDataset[searchDemoDataset] || []}
              lookup={universalSearchData.lookup}
              onResultsChange={(results, meta) => {
                setSearchDemoResults(results);
                setSearchDemoMeta(meta);
              }}
            />

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  查詢結果清冊（點擊任一列可開啟完整明細視窗）
                </span>
                <span className="font-mono tabular-nums text-slate-500">
                  顯示 {Math.min(searchDemoResults.length, 30)} / 符合 {searchDemoResults.length} 筆
                </span>
              </div>

              {searchDemoResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  {searchDemoMeta.totalPoolCount === 0
                    ? '目前無可檢視資料列，或請切換至具該模組查詢權限的資料對象。'
                    : '找不到符合目前篩選條件的資料列，請放寬關鍵字或清除條件後再試。'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                  {searchDemoResults.slice(0, 30).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedDemoResult(item)}
                      className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center justify-between gap-4 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {item.subtitle} · {item.companyLabel}
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-indigo-700 shrink-0 whitespace-nowrap">
                        檢視明細
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-indigo-600" />
                <span>如何嵌入各業務模組？</span>
              </h4>
              <button
                type="button"
                onClick={() =>
                  onCopyCode(
                    'universal_search',
                    `import { UniversalSearchBar } from './widgets/UniversalSearchBar';\n\n<UniversalSearchBar\n  datasetKey="INBOUND_RECEIPTS"\n  records={receipts}\n  lookup={lookup}\n  onResultsChange={(results) => setFilteredRows(results.map(r => r.record))}\n/>`
                  )
                }
                className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                {copiedCodeKey === 'universal_search' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCodeKey === 'universal_search' ? '已複製！' : '複製代碼'}</span>
              </button>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed space-y-2">
              <p>
                <strong>正式版核心規範：</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-500 text-[11px]">
                <li>
                  <strong>無側漏靜默保護：</strong>正式版元件僅渲染當前帳號具權限之搜尋欄位，絕不顯示「已隱藏敏感欄位」提示或上鎖警告，避免低權限帳號推知機密欄位存在。
                </li>
                <li>
                  <strong>預設單行收合：</strong>僅佔一列快速搜尋欄高度，點選「展開更多條件」始展開三欄式格狀條件表。
                </li>
                <li>
                  <strong>共用權限與別名引擎：</strong>底層直連 <code>universalSearchEngine.ts</code>，自動完成私帳、401 稅務、法人權限矩陣裁切及臺灣縣市別名比對。
                </li>
              </ul>
            </div>

            <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed">
{`import { UniversalSearchBar } from './widgets/UniversalSearchBar';

<UniversalSearchBar
  datasetKey="PARTNERS"
  records={partners}
  lookup={lookup}
  onResultsChange={(items) => {
    setFilteredPartners(items.map(i => i.record));
  }}
/>`}
            </pre>
          </div>
        </div>
      </div>

      <SearchResultDetailModal
        isOpen={Boolean(selectedDemoResult)}
        item={selectedDemoResult}
        currentIndex={selectedDemoIndex}
        totalCount={searchDemoResults.length}
        onPrev={() => {
          if (selectedDemoIndex > 0) {
            setSelectedDemoResult(searchDemoResults[selectedDemoIndex - 1]);
          }
        }}
        onNext={() => {
          if (selectedDemoIndex >= 0 && selectedDemoIndex < searchDemoResults.length - 1) {
            setSelectedDemoResult(searchDemoResults[selectedDemoIndex + 1]);
          }
        }}
        onClose={() => setSelectedDemoResult(null)}
        maxWidthClass="max-w-xl"
      />
    </>
  );
};
