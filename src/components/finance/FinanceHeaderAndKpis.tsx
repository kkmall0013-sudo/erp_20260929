// src/components/finance/FinanceHeaderAndKpis.tsx
// 📊 財務中樞頂部 KPI 指標看板與主頁籤／法人隔離導航列

import React from 'react';
import {
  ArrowDownRight,
  Building2,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Plus,
  Receipt,
  Wallet,
} from 'lucide-react';
import { Company } from '../../types/erp';
import { FinanceKpiMetrics } from './financeUtils';

export type FinanceMainTab =
  | 'RECONCILIATION_POOL'
  | 'AR_BILLING'
  | 'TREASURY_PAYMENT'
  | 'CHECK_RADAR'
  | 'INVOICE_PETTY_CASH';

interface FinanceHeaderAndKpisProps {
  metrics: FinanceKpiMetrics;
  activeTab: FinanceMainTab;
  onSelectTab: (tab: FinanceMainTab) => void;
  canViewAccounting: boolean;
  canEditAccounting: boolean;
  canViewCashier: boolean;
  canEditCashier: boolean;
  canViewArAndInvoices: boolean;
  canEditAr: boolean;
  accountingTodoCount: number;
  returnedRecsCount: number;
  openArCount: number;
  vendorPoolLength: number;
  authorizedCorps: Company[];
  financeCompanyScope: string;
  onChangeCompanyScope: (val: string) => void;
  onOpenCreateRecModal: () => void;
  onOpenCreateArModal: () => void;
  onNavigateToInbound?: () => void;
}

export const FinanceHeaderAndKpis: React.FC<FinanceHeaderAndKpisProps> = ({
  metrics,
  activeTab,
  onSelectTab,
  canViewAccounting,
  canEditAccounting,
  canViewCashier,
  canEditCashier,
  canViewArAndInvoices,
  canEditAr,
  accountingTodoCount,
  returnedRecsCount,
  openArCount,
  vendorPoolLength,
  authorizedCorps,
  financeCompanyScope,
  onChangeCompanyScope,
  onOpenCreateRecModal,
  onOpenCreateArModal,
  onNavigateToInbound,
}) => {
  return (
    <>
      {/* 頂部四核心 KPI 指標看板 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>進貨待對帳大水池</span>
            </span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">
              {metrics.pendingInboundCount} 筆待請款
            </span>
          </div>
          <div className="text-xl font-mono font-black text-slate-900 mt-1">
            NT$ {metrics.pendingInboundTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>現場已簽收 · 尚未勾稽對帳</span>
            {canEditAccounting && vendorPoolLength > 0 && (
              <button
                onClick={onOpenCreateRecModal}
                className="text-amber-700 font-bold hover:underline cursor-pointer"
              >
                一鍵開單 →
              </button>
            )}
          </div>
          <div className="absolute right-2 -bottom-2 text-amber-100 -z-0 opacity-40">
            <Receipt className="w-16 h-16" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              <span>應付對帳款 (待放款)</span>
            </span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">
              {metrics.pendingApCount} 筆待付
            </span>
          </div>
          <div className="text-xl font-mono font-black text-indigo-700 mt-1">
            NT$ {metrics.pendingApTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>會計已核准發票與稅額 · 依到期日放款</span>
          </div>
          <div className="absolute right-2 -bottom-2 text-indigo-100 -z-0 opacity-40">
            <Wallet className="w-16 h-16" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>實體銀行存款餘額</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
              T+0 實體存摺
            </span>
          </div>
          <div className="text-xl font-mono font-black text-emerald-700 mt-1">
            NT$ {metrics.realBankBalance.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>老闆代墊口袋：</span>
            <span className="font-mono font-bold text-slate-700">NT$ {metrics.bossBalance.toLocaleString()}</span>
          </div>
          <div className="absolute right-2 -bottom-2 text-emerald-100 -z-0 opacity-40">
            <Building2 className="w-16 h-16" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span>資金雷達可用淨額</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-bold">
              未兌票據: {metrics.unclearedChecksCount} 張
            </span>
          </div>
          <div className={`text-xl font-mono font-black mt-1 ${metrics.projectedNetCash >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            NT$ {metrics.projectedNetCash.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>扣除未兌現期票:</span>
            <span className="font-mono text-amber-700 font-bold">- NT$ {metrics.unclearedChecksTotal.toLocaleString()}</span>
          </div>
          <div className="absolute right-2 -bottom-2 text-blue-100 -z-0 opacity-40">
            <Clock className="w-16 h-16" />
          </div>
        </div>
      </div>

      {/* 主頁籤切換導航 */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {canViewAccounting && (
            <button
              onClick={() => onSelectTab('RECONCILIATION_POOL')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'RECONCILIATION_POOL'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>應付對帳 (會計)</span>
              {accountingTodoCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'RECONCILIATION_POOL'
                    ? 'bg-indigo-800 text-white'
                    : returnedRecsCount > 0
                    ? 'bg-rose-100 text-rose-800 font-bold'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {accountingTodoCount}
                </span>
              )}
            </button>
          )}

          {canViewArAndInvoices && (
            <button
              onClick={() => onSelectTab('AR_BILLING')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'AR_BILLING'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>應收請款 (會計)</span>
              {openArCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'AR_BILLING' ? 'bg-indigo-800 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {openArCount}
                </span>
              )}
            </button>
          )}

          {canViewCashier && (
            <button
              onClick={() => onSelectTab('TREASURY_PAYMENT')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'TREASURY_PAYMENT'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>出納收付款工作台</span>
              {metrics.pendingApCount + openArCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'TREASURY_PAYMENT' ? 'bg-indigo-800 text-white' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  {metrics.pendingApCount + openArCount}
                </span>
              )}
            </button>
          )}

          {canViewCashier && (
            <button
              onClick={() => onSelectTab('CHECK_RADAR')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'CHECK_RADAR'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>票據雷達</span>
              {metrics.unclearedChecksCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'CHECK_RADAR' ? 'bg-indigo-800 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {metrics.unclearedChecksCount}
                </span>
              )}
            </button>
          )}

          {(canViewArAndInvoices || canViewCashier) && (
            <button
              onClick={() => onSelectTab('INVOICE_PETTY_CASH')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'INVOICE_PETTY_CASH'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>各公司發票與暫收池</span>
              {metrics.pendingSuspenseCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'INVOICE_PETTY_CASH' ? 'bg-indigo-800 text-white' : 'bg-rose-100 text-rose-800'
                }`}>
                  {metrics.pendingSuspenseCount}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {authorizedCorps.length > 0 && (
            <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <Building2 className="w-3.5 h-3.5 text-purple-600" />
              <select
                value={financeCompanyScope}
                onChange={(e) => onChangeCompanyScope(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                title="依授權法人公司隔離財務與銀行帳務視角"
              >
                {authorizedCorps.map(c => (
                  <option key={c.id} value={c.id}>{c.shortName || c.name}</option>
                ))}
                {authorizedCorps.length > 1 && (
                  <option value="ALL">全部授權法人 ({authorizedCorps.length}間)</option>
                )}
              </select>
            </div>
          )}

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
              canEditAccounting && canEditCashier
                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                : canEditAccounting
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : canEditCashier
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
            title="依權限群組自動切換：1人兼任可一體快辦，2人分工則自動隔離管帳與管錢"
          >
            {canEditAccounting && canEditCashier
              ? '⚡ 會計兼出納一體模式'
              : canEditAccounting
              ? '📒 專職會計模式（僅管帳・對帳立帳）'
              : canEditCashier
              ? '💰 專職出納模式（僅管錢・收付款開票）'
              : '👁️ 唯讀檢視模式'}
          </span>

          {activeTab === 'RECONCILIATION_POOL' && canEditAccounting && (
            <button
              onClick={onOpenCreateRecModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>開立應付對帳單</span>
            </button>
          )}

          {activeTab === 'AR_BILLING' && canEditAr && (
            <button
              onClick={onOpenCreateArModal}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>開立應收請款單</span>
            </button>
          )}

          {onNavigateToInbound && (
            <button
              onClick={onNavigateToInbound}
              className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1"
              title="穿透前往現場進貨簽收模組"
            >
              <span>查看現場進貨單</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </>
  );
};
