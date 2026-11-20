// src/components/finance/SuspensePoolMiniApp.tsx
// 💧 獨立小程式：未知款項暫收池與分批認領轉拋 (Suspense Pool Manager)

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import {
  AccountReceivable,
  Company,
  CompanyBankAccount,
  SuspenseReceipt,
} from '../../types/erp';

interface SuspensePoolMiniAppProps {
  suspenses: SuspenseReceipt[];
  arList: AccountReceivable[];
  companies: Company[];
  bankAccounts: CompanyBankAccount[];
  canEditCashier: boolean;
  canEditAr: boolean;
  isBossPrivateAccount: (b: CompanyBankAccount) => boolean;
  onOpenCreateSuspense: () => void;
  onAllocateSuspense: (susp: SuspenseReceipt, arId: string, customAllocAmt?: number) => boolean | void;
  onOpenCreateArForSuspense: (susp: SuspenseReceipt) => void;
}

export const SuspensePoolMiniApp: React.FC<SuspensePoolMiniAppProps> = ({
  suspenses,
  arList,
  companies,
  bankAccounts,
  canEditCashier,
  canEditAr,
  isBossPrivateAccount,
  onOpenCreateSuspense,
  onAllocateSuspense,
  onOpenCreateArForSuspense,
}) => {
  const [showAllocatedSuspenses, setShowAllocatedSuspenses] = useState<boolean>(false);
  const [suspAllocAmounts, setSuspAllocAmounts] = useState<Record<string, string>>({});

  const unallocatedSuspenses = suspenses.filter(s => !s.isAllocated);
  const allocatedSuspenses = suspenses.filter(s => s.isAllocated);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <h3 className="text-xs font-bold text-slate-800">
            未知款項暫收池 (Suspense Accounts - 認領轉拋前不計營業稅)
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-400">
            出納先入庫保帳實相符 ➔ 會計查明案場後補開／認領轉拋 AR
          </span>
          {allocatedSuspenses.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllocatedSuspenses(prev => !prev)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              {showAllocatedSuspenses ? '隱藏已認領歷史' : `檢視已認領 (${allocatedSuspenses.length})`}
            </button>
          )}
          {canEditCashier && (
            <button
              type="button"
              onClick={onOpenCreateSuspense}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>登錄未知暫收款</span>
            </button>
          )}
        </div>
      </div>

      {unallocatedSuspenses.length === 0 ? (
        <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">
          <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-1 opacity-80" />
          <div className="font-bold text-slate-700">目前無待釐清之未知暫收款！</div>
        </div>
      ) : (
        <div className="space-y-2">
          {unallocatedSuspenses.map(susp => {
            const suspComp = companies.find(c => c.id === susp.companyId);
            const suspBank = bankAccounts.find(b => b.id === susp.bankAccountId);
            const suspIsBoss = susp.companyId === 'BOSS-01' || Boolean(suspBank && isBossPrivateAccount(suspBank));
            const suspRemaining = susp.remainingAmount ?? (susp.isAllocated ? 0 : susp.amount);
            const suspAllocated = susp.allocatedAmount ?? Math.max(0, susp.amount - suspRemaining);
            const compatibleArs = arList.filter(ar => {
              if (ar.status === 'VOIDED' || ar.status === 'COLLECTED') return false;
              const arHasInv = ar.hasInvoice !== false && ar.invoiceIssueMode !== 'SELF_RETAINED';
              if (arHasInv && (suspIsBoss || susp.companyId !== ar.companyId)) return false;
              if (!arHasInv && !suspIsBoss && susp.companyId !== ar.companyId) return false;
              return true;
            });
            const customAllocVal = suspAllocAmounts[susp.id] ?? '';

            return (
              <div
                key={susp.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-50/40 border border-amber-200/80 rounded-lg text-xs"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-amber-900">{susp.receivedDate}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold">
                      {suspComp?.shortName || suspComp?.name || susp.companyId}
                    </span>
                    <span className="font-bold text-slate-800">{susp.bankAccountName || '公司帳戶'}</span>
                    {suspAllocated > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold">
                        分批認領中（已沖 NT$ {suspAllocated.toLocaleString()}）
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    來源附言: <span className="font-semibold text-slate-900">{susp.payerInfo}</span>
                  </div>
                  {susp.notes && (
                    <div className="text-[11px] text-slate-500 mt-0.5">備註: {susp.notes}</div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400">
                      {suspAllocated > 0 ? `尚餘待認領 (原 NT$ ${susp.amount.toLocaleString()})` : '入帳金額'}
                    </div>
                    <div className="text-sm font-mono font-black text-slate-900">
                      NT$ {suspRemaining.toLocaleString()}
                    </div>
                  </div>

                  {canEditAr && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {compatibleArs.length > 0 && (
                        <>
                          <select
                            id={`alloc-${susp.id}`}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs max-w-[220px]"
                          >
                            {compatibleArs.map(ar => (
                              <option key={ar.id} value={ar.id}>
                                [{ar.arNumber}] {ar.customerName} (待收 NT$ {ar.remainingAmount.toLocaleString()})
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="1"
                            max={suspRemaining}
                            value={customAllocVal}
                            onChange={(e) => setSuspAllocAmounts(prev => ({ ...prev, [susp.id]: e.target.value }))}
                            placeholder={`沖銷額(上限 ${suspRemaining.toLocaleString()})`}
                            className="w-32 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                            title="留空則依兩單較小餘額自動沖銷；可填入分批沖銷金額"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const sel = document.getElementById(`alloc-${susp.id}`) as HTMLSelectElement;
                              const numVal = Number(customAllocVal || 0);
                              if (sel) {
                                const ok = onAllocateSuspense(susp, sel.value, numVal > 0 ? numVal : undefined);
                                if (ok !== false) {
                                  setSuspAllocAmounts(prev => {
                                    const next = { ...prev };
                                    delete next[susp.id];
                                    return next;
                                  });
                                }
                              }
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
                          >
                            認領轉拋 AR
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenCreateArForSuspense(susp)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                        title="若會計尚未開立此案應收單（如貸款先匯入整筆），可補開一張或分批開單自動認領"
                      >
                        <Plus className="w-3 h-3" />
                        <span>補開 AR 並認領</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAllocatedSuspenses && allocatedSuspenses.length > 0 && (
        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          <div className="text-[11px] font-bold text-slate-500">已認領結案暫收紀錄 ({allocatedSuspenses.length} 筆)</div>
          {allocatedSuspenses.map(s => (
            <div key={s.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600">
              <div>
                <span className="font-mono font-bold mr-2">{s.receivedDate}</span>
                <span className="font-bold text-slate-800 mr-2">{s.bankAccountName}</span>
                <span>{s.payerInfo}</span>
              </div>
              <div className="font-mono font-bold text-emerald-700">
                NT$ {s.amount.toLocaleString()} · 已認領結清
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
