// src/components/finance/FinanceLedgerSearchSection.tsx
// 🔍 財務中樞跨帳冊統一檢索元件（整合 UniversalSearchBar + SearchResultDetailModal，嚴格遵循私帳／401 權限零側漏規範）

import React, { useMemo, useState } from 'react';
import { ExternalLink, FileSearch } from 'lucide-react';
import {
  AccountReceivable,
  AccountsPayableReconciliation,
  BankCheck,
  Company,
  CompanyBankAccount,
  PaymentRecord,
} from '../../types/erp';
import {
  buildUnifiedFinanceRows,
  createSearchDatasetLookup,
  FinanceLedgerUnifiedRow,
  SearchResultItem,
} from '../../utils/universalSearchEngine';
import { UniversalSearchBar } from '../widgets/UniversalSearchBar';
import { SearchResultDetailModal } from '../widgets/SearchResultDetailModal';
import { FinanceMainTab } from './FinanceHeaderAndKpis';

interface FinanceLedgerSearchSectionProps {
  reconciliations: AccountsPayableReconciliation[];
  payments: PaymentRecord[];
  arList: AccountReceivable[];
  checks: BankCheck[];
  companies: Company[];
  bankAccounts: CompanyBankAccount[];
  matchesCompanyScope: (compId?: string) => boolean;
  canViewAccounting: boolean;
  canViewArAndInvoices: boolean;
  canViewCashier: boolean;
  onSelectTab: (tab: FinanceMainTab) => void;
}

const KIND_BADGE_MAP: Record<FinanceLedgerUnifiedRow['ledgerKind'], string> = {
  AP_RECON: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PAYMENT: 'bg-sky-50 text-sky-700 border-sky-200',
  AR: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  BANK_CHECK: 'bg-amber-50 text-amber-800 border-amber-200',
};

export const FinanceLedgerSearchSection: React.FC<FinanceLedgerSearchSectionProps> = ({
  reconciliations,
  payments,
  arList,
  checks,
  companies,
  bankAccounts,
  matchesCompanyScope,
  canViewAccounting,
  canViewArAndInvoices,
  canViewCashier,
  onSelectTab,
}) => {
  const [results, setResults] = useState<SearchResultItem<FinanceLedgerUnifiedRow>[]>([]);
  const [searchMeta, setSearchMeta] = useState<{
    totalPoolCount: number;
    activeConditionCount: number;
    hasDatasetAccess: boolean;
  }>({
    totalPoolCount: 0,
    activeConditionCount: 0,
    hasDatasetAccess: false,
  });
  const [selectedItem, setSelectedItem] = useState<SearchResultItem<FinanceLedgerUnifiedRow> | null>(null);

  const searchLookup = useMemo(
    () =>
      createSearchDatasetLookup({
        companies,
        bankAccounts,
      }),
    [companies, bankAccounts]
  );

  const unifiedRows = useMemo(
    () =>
      buildUnifiedFinanceRows({
        reconciliations: reconciliations.filter(r => matchesCompanyScope(r.companyId)),
        payments: payments.filter(p => matchesCompanyScope(p.companyId)),
        arList: arList.filter(a => matchesCompanyScope(a.companyId)),
        checks: checks.filter(c => matchesCompanyScope(c.companyId)),
        bankAccountsById: searchLookup.bankAccountsById,
      }),
    [reconciliations, payments, arList, checks, matchesCompanyScope, searchLookup.bankAccountsById]
  );

  const selectedIndex = useMemo(() => {
    if (!selectedItem) return -1;
    return results.findIndex(r => r.id === selectedItem.id);
  }, [results, selectedItem]);

  const resolveTargetTab = (kind: FinanceLedgerUnifiedRow['ledgerKind']): FinanceMainTab | null => {
    if (kind === 'AP_RECON' && canViewAccounting) return 'RECONCILIATION_POOL';
    if (kind === 'AR' && canViewArAndInvoices) return 'AR_BILLING';
    if (kind === 'PAYMENT' && canViewCashier) return 'TREASURY_PAYMENT';
    if (kind === 'BANK_CHECK' && canViewCashier) return 'CHECK_RADAR';
    return null;
  };

  return (
    <div className="space-y-2">
      <UniversalSearchBar<FinanceLedgerUnifiedRow>
        datasetKey="FINANCE_LEDGER"
        records={unifiedRows}
        lookup={searchLookup}
        placeholder="跨帳冊快速搜尋（AP對帳單號、出納付款、AR請款、支票號碼、往來對象或發票字軌）..."
        onResultsChange={(nextResults, meta) => {
          setResults(nextResults);
          setSearchMeta(meta);
        }}
      />

      {searchMeta.hasDatasetAccess && searchMeta.activeConditionCount > 0 && (
        <div className="bg-white rounded-xl border border-indigo-200 shadow-2xs overflow-hidden">
          <div className="px-4 py-2 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-indigo-950 flex items-center gap-1.5">
              <FileSearch className="w-3.5 h-3.5 text-indigo-600" />
              <span>跨帳冊檢索結果（依當前權限過濾，點擊可看明細與跳轉分頁）</span>
            </span>
            <span className="font-mono tabular-nums text-indigo-700 font-bold">
              符合 {results.length} 筆
            </span>
          </div>

          {results.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              找不到符合目前搜尋條件的帳務或票據資料，請放寬關鍵字或清除條件後再試。
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {results.slice(0, 50).map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 whitespace-nowrap ${
                        KIND_BADGE_MAP[item.record.ledgerKind]
                      }`}
                    >
                      {item.record.ledgerKindLabel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{item.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {item.companyLabel} · {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-700 shrink-0 whitespace-nowrap">
                    檢視明細
                  </span>
                </button>
              ))}
              {results.length > 50 && (
                <div className="px-4 py-2 text-[11px] text-slate-400 bg-slate-50 text-center">
                  僅先顯示前 50 筆（共 {results.length} 筆），請縮小搜尋條件範圍以精準定位。
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <SearchResultDetailModal<FinanceLedgerUnifiedRow>
        isOpen={Boolean(selectedItem)}
        item={selectedItem}
        currentIndex={selectedIndex}
        totalCount={results.length}
        onPrev={() => {
          if (selectedIndex > 0) setSelectedItem(results[selectedIndex - 1]);
        }}
        onNext={() => {
          if (selectedIndex >= 0 && selectedIndex < results.length - 1) {
            setSelectedItem(results[selectedIndex + 1]);
          }
        }}
        onClose={() => setSelectedItem(null)}
        headerActions={
          selectedItem && resolveTargetTab(selectedItem.record.ledgerKind) ? (
            <button
              type="button"
              onClick={() => {
                const target = resolveTargetTab(selectedItem.record.ledgerKind);
                if (target) {
                  onSelectTab(target);
                  setSelectedItem(null);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>前往所屬分頁</span>
            </button>
          ) : undefined
        }
      />
    </div>
  );
};
