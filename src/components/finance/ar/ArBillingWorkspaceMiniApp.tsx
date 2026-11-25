// src/components/finance/ar/ArBillingWorkspaceMiniApp.tsx
// 🧾 業主應收請款立帳管理小程式（會計開單請款、分批補開發票、拋轉出納與案場借貸總帳入口）

import React from 'react';
import {
  ArrowDownRight,
  BookOpen,
  CheckCircle2,
  Clock,
  FileCheck2,
  Plus,
  Printer,
  Zap,
} from 'lucide-react';
import {
  AccountReceivable,
  ArCollectionRecord,
  Company,
  Project,
} from '../../../types/erp';
import { CustomerBillingWorkflowMode } from '../CustomerStatementMiniApp';

interface ArBillingWorkspaceMiniAppProps {
  arList: AccountReceivable[];
  arCollections: ArCollectionRecord[];
  companies: Company[];
  projects: Project[];
  customerBillingMode: CustomerBillingWorkflowMode;
  canEditAr: boolean;
  canEditArFor: (compId?: string) => boolean;
  canEditCashierFor: (compId?: string) => boolean;
  matchesCompanyScope: (compId?: string) => boolean;
  onOpenCreateAr: () => void;
  onOpenCollectAr: (ar: AccountReceivable) => void;
  onOpenPostInvoice: (ar: AccountReceivable) => void;
  onVoidAr: (ar: AccountReceivable) => void;
  onOpenLedgerModal: (project: Project, initialTab: 'LEDGER' | 'STATEMENT', focusArId?: string) => void;
}

export const ArBillingWorkspaceMiniApp: React.FC<ArBillingWorkspaceMiniAppProps> = ({
  arList,
  arCollections,
  companies,
  projects,
  customerBillingMode,
  canEditAr,
  canEditArFor,
  canEditCashierFor,
  matchesCompanyScope,
  onOpenCreateAr,
  onOpenCollectAr,
  onOpenPostInvoice,
  onVoidAr,
  onOpenLedgerModal,
}) => {
  const scopedArList = arList.filter(a => matchesCompanyScope(a.companyId));
  const activeArs = scopedArList.filter(a => a.status === 'OPEN' || a.status === 'PARTIAL');
  const settledArs = scopedArList.filter(a => a.status === 'COLLECTED' || a.status === 'VOIDED');
  const totalOpenRemaining = activeArs.reduce((s, a) => s + a.remainingAmount, 0);
  const invoicedOpenTotal = activeArs.filter(a => a.hasInvoice !== false).reduce((s, a) => s + a.remainingAmount, 0);
  const noInvoiceOpenTotal = activeArs.filter(a => a.hasInvoice === false).reduce((s, a) => s + a.remainingAmount, 0);

  return (
    <div className="space-y-4">
      {/* 頂部應收結構與規則提示 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-800">
              業主應收請款立帳管理（會計開單請款 ➔ 決定開票/免票 ➔ 送交出納收款對帳）
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {customerBillingMode === 'FINANCE_ONLY'
                ? '目前對客表模式：A·會計統一'
                : customerBillingMode === 'PROJECT_FIRST_HANDOFF'
                ? '目前對客表模式：B·工務送審 ➔ 會計開票'
                : '目前對客表模式：C·雙軌各自調用'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {projects.filter(p => !p.isDeleted && p.id !== 'PRJ-INTERNAL').length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const p = projects.find(x => x.id === e.target.value);
                  if (p) onOpenLedgerModal(p, 'LEDGER');
                }}
                className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none cursor-pointer"
              >
                <option value="">📊 開啟案場借貸總帳 / 對客明細表...</option>
                {projects
                  .filter(p => !p.isDeleted && p.id !== 'PRJ-INTERNAL')
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.projectCode}] {p.name} ({p.ownerName || '-'})
                    </option>
                  ))}
              </select>
            )}
            {canEditAr && (
              <button
                type="button"
                onClick={onOpenCreateAr}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 text-xs cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>開立應收請款單 (AR)</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] text-slate-500 font-bold">待收款總餘額 ({activeArs.length} 筆)</div>
            <div className="text-lg font-mono font-black text-slate-900 mt-0.5">
              NT$ {totalOpenRemaining.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200">
            <div className="text-[11px] text-indigo-800 font-bold">🔒 有開發票 (嚴格限入開票公司戶)</div>
            <div className="text-lg font-mono font-black text-indigo-800 mt-0.5">
              NT$ {invoicedOpenTotal.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200">
            <div className="text-[11px] text-amber-800 font-bold">🔓 免開發票 (可入老闆私帳／現金)</div>
            <div className="text-lg font-mono font-black text-amber-800 mt-0.5">
              NT$ {noInvoiceOpenTotal.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 1. 待收款／部分收款應收單 */}
      <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>1. 待收款／部分收款應收請款單（已拋轉出納收款對帳）</span>
          </div>
          <span className="text-[11px] text-slate-400">出納收錢入帳後會即時同步此處已收金額</span>
        </div>

        {activeArs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-500 mb-1" />
            <div className="font-bold text-slate-700">目前無待收款應收請款單</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeArs.map(ar => {
              const comp = companies.find(c => c.id === ar.companyId);
              const proj = projects.find(p => p.id === ar.projectId);
              const cols = arCollections.filter(c => c.arId === ar.id && c.status !== 'VOIDED');
              const hasInv = ar.hasInvoice !== false;
              const allowEditThisAr = canEditArFor(ar.companyId);
              const allowCollectThisAr = canEditCashierFor(ar.companyId);

              return (
                <div key={ar.id} className="border border-slate-200 rounded-xl p-3.5 bg-white hover:border-emerald-300 transition-all space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {ar.arNumber}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold">
                        {comp?.shortName || comp?.name || ar.companyId}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                        ar.invoiceNumber && ar.invoiceIssueMode === 'SELF_RETAINED'
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : hasInv
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {ar.invoiceNumber && ar.invoiceIssueMode === 'SELF_RETAINED'
                          ? `🏷️ 自主報稅發票 ${ar.invoiceNumber} (公司自留)`
                          : hasInv
                          ? `🔒 ${ar.invoiceFormat === 'TWO_PART' ? '二聯' : '三聯'}發票 ${ar.invoiceNumber || '(待補)'}`
                          : '🔓 免開發票 · 可入私帳/現金'}
                      </span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      ar.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {ar.status === 'PARTIAL' ? '部分收款中' : '待收款'}
                    </span>
                  </div>

                  {ar.bouncedCheckNumber && (
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 text-[11px] font-bold">
                      ⚠️ 業主支票 [{ar.bouncedCheckNumber}] 退票跳票，餘額已回滾！{ar.bouncedReason ? `原因: ${ar.bouncedReason}` : ''}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{ar.customerName}</span>
                      {ar.title?.includes('[工務對客明細送審]') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold">
                          工務對客表送審 · 請確認開票/免票
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      案場: {ar.projectName || proj?.name || ar.projectId}
                      {ar.title ? ` · ${ar.title}` : ''}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                    <div>
                      <div className="text-[10px] text-slate-400 font-sans">請款總額</div>
                      <div className="font-bold text-slate-800">NT$ {ar.amount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-sans">已收／折讓</div>
                      <div className="font-bold text-emerald-700">NT$ {ar.appliedAmount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-sans">尚待收回</div>
                      <div className="font-black text-rose-700">NT$ {ar.remainingAmount.toLocaleString()}</div>
                    </div>
                  </div>

                  {cols.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[10px] font-bold text-slate-500">收款紀錄明細:</div>
                      {cols.map(c => (
                        <div key={c.id} className="text-[11px] flex items-center justify-between bg-emerald-50/50 border border-emerald-100 px-2 py-1 rounded">
                          <span className="truncate">
                            {c.receivedDate} · {c.collectionMethod === 'CHECK' ? `支票 ${c.checkNumber}` : c.collectionMethod === 'SUSPENSE' ? '暫收認領' : c.collectionMethod === 'TT' ? '匯款' : '現金'} ({c.bankAccountName})
                            {c.feeAmount > 0 ? ` · 折讓/匯費 NT$ ${c.feeAmount.toLocaleString()}` : ''}
                          </span>
                          <span className="font-mono font-bold text-emerald-800 shrink-0 ml-2">
                            +NT$ {c.netReceivedAmount.toLocaleString()}
                            {c.status === 'PENDING_CLEARANCE' ? ' (待兌)' : c.status === 'BOUNCED' ? ' (退票)' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400 font-mono">預計收款日: {ar.dueDate}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {proj && (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenLedgerModal(proj, 'LEDGER', ar.id)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-200 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                            title="檢視該案場借貸往來總帳與分批補開發票"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>借貸總帳</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenLedgerModal(proj, 'STATEMENT', ar.id)}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded border border-emerald-200 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                            title="產生給客人的簡潔請款／對帳明細表"
                          >
                            <Printer className="w-3 h-3" />
                            <span>對客明細表</span>
                          </button>
                        </>
                      )}
                      {allowEditThisAr && ar.appliedAmount === 0 && (
                        <button
                          type="button"
                          onClick={() => onVoidAr(ar)}
                          className="px-2 py-1 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded border border-slate-200 text-[11px] font-bold cursor-pointer"
                        >
                          作廢
                        </button>
                      )}
                      {allowEditThisAr && (
                        <button
                          type="button"
                          onClick={() => onOpenPostInvoice(ar)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold cursor-pointer"
                          title="支援後續補開（或分批多次補開）A公司發票，或自主開立留存報稅"
                        >
                          {ar.invoiceNumber ? '分批補開發票' : '後續補開發票'}
                        </button>
                      )}
                      {allowCollectThisAr && (
                        <button
                          type="button"
                          onClick={() => onOpenCollectAr(ar)}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3" />
                          <span>出納收款入帳</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. 已收齊／已作廢備查清冊 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
            <span>2. 已收齊結清／已作廢應收備查清冊 ({settledArs.length} 筆)</span>
          </h3>
        </div>
        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5">應收單號</th>
                <th className="p-2.5">公司／發票</th>
                <th className="p-2.5">業主／案場</th>
                <th className="p-2.5 text-right">應收總額</th>
                <th className="p-2.5 text-right">實收累計</th>
                <th className="p-2.5 text-center">狀態 / 後續補開</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {settledArs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-5 text-center text-slate-400 font-sans">尚無已結清或作廢應收單據</td>
                </tr>
              ) : (
                settledArs.map(ar => {
                  const comp = companies.find(c => c.id === ar.companyId);
                  const proj = projects.find(p => p.id === ar.projectId);
                  const allowPostInv = ar.status === 'COLLECTED' && canEditArFor(ar.companyId);
                  return (
                    <tr key={ar.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-800">{ar.arNumber}</td>
                      <td className="p-2.5 font-sans">
                        <span className="font-bold text-purple-900">{comp?.shortName || comp?.name || ar.companyId}</span>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {ar.invoiceNumber
                            ? `${ar.invoiceIssueMode === 'SELF_RETAINED' ? '自主報稅(自留): ' : '發票: '}${ar.invoiceNumber}`
                            : ar.hasInvoice !== false
                            ? '已開立發票'
                            : '免開發票'}
                        </div>
                      </td>
                      <td className="p-2.5 font-sans">
                        <div className="font-bold text-slate-800">{ar.customerName}</div>
                        <div className="text-[10px] text-slate-500">{ar.projectName || ar.projectId}</div>
                      </td>
                      <td className="p-2.5 text-right font-bold">NT$ {ar.amount.toLocaleString()}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-700">NT$ {ar.appliedAmount.toLocaleString()}</td>
                      <td className="p-2.5 text-center font-sans space-x-1.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          ar.status === 'COLLECTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {ar.status === 'COLLECTED' ? '已收齊結清' : '已作廢'}
                        </span>
                        {proj && (
                          <button
                            type="button"
                            onClick={() => onOpenLedgerModal(proj, 'LEDGER', ar.id)}
                            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-bold cursor-pointer"
                          >
                            借貸帳
                          </button>
                        )}
                        {allowPostInv && (
                          <button
                            type="button"
                            onClick={() => onOpenPostInvoice(ar)}
                            className="px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-bold cursor-pointer"
                            title="請完款後自主分批開立銷項發票繳稅（可選公司自留或交付業主補稅）"
                          >
                            {ar.invoiceNumber ? '分批補開發票' : '自主／補開發票'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
