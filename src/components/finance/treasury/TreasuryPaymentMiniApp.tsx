// src/components/finance/treasury/TreasuryPaymentMiniApp.tsx
// 🏦 出納收付款工作台小程式（待收款 AR 清冊、待放款 AP 清冊、出納付款紀錄）

import React from 'react';
import {
  ArrowDownRight,
  CheckCircle2,
  FileCheck2,
  Plus,
  RotateCcw,
  Send,
  Wallet,
} from 'lucide-react';
import {
  AccountsPayableReconciliation,
  AccountReceivable,
  BusinessPartner,
  Company,
  PaymentRecord,
} from '../../../types/erp';

interface TreasuryPaymentMiniAppProps {
  arList: AccountReceivable[];
  reconciliations: AccountsPayableReconciliation[];
  payments: PaymentRecord[];
  companies: Company[];
  partners: BusinessPartner[];
  canEditCashier: boolean;
  canEditCashierFor: (compId?: string) => boolean;
  matchesCompanyScope: (compId?: string) => boolean;
  onOpenQuickAdvance: () => void;
  onOpenCreateSuspense: () => void;
  onOpenCollectAr: (ar: AccountReceivable) => void;
  onOpenPaymentModal: (rec: AccountsPayableReconciliation) => void;
  onOpenReturnModal: (rec: AccountsPayableReconciliation) => void;
}

export const TreasuryPaymentMiniApp: React.FC<TreasuryPaymentMiniAppProps> = ({
  arList,
  reconciliations,
  payments,
  companies,
  partners,
  canEditCashier,
  canEditCashierFor,
  matchesCompanyScope,
  onOpenQuickAdvance,
  onOpenCreateSuspense,
  onOpenCollectAr,
  onOpenPaymentModal,
  onOpenReturnModal,
}) => {
  const openArs = arList.filter(a => (a.status === 'OPEN' || a.status === 'PARTIAL') && matchesCompanyScope(a.companyId));
  const approvedAps = reconciliations.filter(r => r.status === 'APPROVED');

  return (
    <div className="space-y-4">
      {/* A-0. 出納應收待收款區 */}
      <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-emerald-100 pb-2">
          <div className="flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-800">
              出納應收待收款清冊（客戶匯款／交票／付現 ➔ 入帳核對）
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEditCashier && (
              <>
                <button
                  type="button"
                  onClick={onOpenQuickAdvance}
                  className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                  title="已知業主/案場於尚未開請款單前先整筆匯款(如銀行貸款撥款/預付訂金)，直接掛入該案場借貸總帳"
                >
                  <Plus className="w-3 h-3" />
                  <span>案場貸款／預收款直入</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenCreateSuspense}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                  title="僅供完全無法辨認匯款人與案場之不明匯款使用"
                >
                  <Plus className="w-3 h-3" />
                  <span>不明未知匯款 ➔ 暫收池</span>
                </button>
              </>
            )}
          </div>
        </div>

        {openArs.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">
            目前選定法人無待收款之業主應收請款單；若收到未明匯款可點擊右上方放入暫收池。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {openArs.map(ar => {
              const comp = companies.find(c => c.id === ar.companyId);
              const hasInv = ar.hasInvoice !== false;
              const allowCollect = canEditCashierFor(ar.companyId);
              return (
                <div key={ar.id} className="border border-emerald-200 bg-emerald-50/20 rounded-xl p-3.5 flex flex-col justify-between text-xs">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {ar.arNumber}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">到期: {ar.dueDate}</span>
                    </div>
                    {ar.bouncedCheckNumber && (
                      <div className="mt-1.5 px-2 py-1 rounded bg-rose-100 border border-rose-300 text-rose-900 text-[10px] font-bold">
                        ⚠️ 原票 [{ar.bouncedCheckNumber}] 跳票退回，請追討款項
                      </div>
                    )}
                    <h4 className="text-sm font-bold text-slate-900 mt-2 truncate">{ar.customerName}</h4>
                    <div className="text-[11px] text-slate-500 truncate">
                      {ar.projectName || ar.projectId}{ar.title ? ` · ${ar.title}` : ''}
                    </div>
                    <div className="mt-2 p-2 rounded-lg bg-white border border-slate-200/80 space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500">入帳歸屬公司:</span>
                        <span className="font-bold text-purple-900">{comp?.shortName || comp?.name || ar.companyId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">發票與資金規則:</span>
                        <span className={`font-bold ${hasInv && ar.invoiceIssueMode !== 'SELF_RETAINED' ? 'text-indigo-700' : 'text-amber-800'}`}>
                          {hasInv && ar.invoiceIssueMode !== 'SELF_RETAINED'
                            ? '🔒 已開發票 (限入公司戶)'
                            : ar.invoiceIssueMode === 'SELF_RETAINED'
                            ? '🏷️ 自主報稅 (可入原定帳戶)'
                            : '🔓 免票 (可入私帳/現金)'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">已收／總額:</span>
                        <span className="font-mono text-slate-700">
                          {ar.appliedAmount.toLocaleString()} / {ar.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-lg font-mono font-black text-emerald-700 mt-2">
                      尚待收 NT$ {ar.remainingAmount.toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-emerald-200/60 flex justify-end">
                    {allowCollect ? (
                      <button
                        type="button"
                        onClick={() => onOpenCollectAr(ar)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>收款入帳 (轉帳 / 支票 / 現金)</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">無此法人收款權限</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* A. 待放款應付對帳單清冊 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-800">
              出納待放款對帳清冊 (會計已審核立帳 · 由出納擇定付款方式與開票)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            四柱平衡驗證 · 出納依法人帳戶擇定支票／電匯／現金 · 有疑義可退回會計重算
          </span>
        </div>

        {approvedAps.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
            <div className="font-bold text-slate-700">目前無待出納放款之應付對帳單！</div>
            <div className="text-[11px] text-slate-400 mt-1">若會計在對帳大水池中核准新單據，將自動匯入此清冊。</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {approvedAps.map((rec) => {
              const bp = partners.find(p => p.id === rec.vendorId);
              const payComp = companies.find(c => c.id === rec.companyId);
              const taxModeLabel = rec.taxType === 'TAX_EXCLUSIVE' ? '外加稅' : rec.taxType === 'TAX_INCLUSIVE' ? '內含稅' : '免稅';
              return (
                <div
                  key={rec.id}
                  className="border border-indigo-200/80 bg-indigo-50/20 rounded-xl p-3.5 hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                        {rec.reconciliationNumber}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        帳務參考日: {rec.paymentDueDate}
                      </span>
                    </div>
                    {rec.bouncedCheckNumber && (
                      <div className="mt-1.5 px-2 py-1 rounded bg-rose-100 border border-rose-300 text-rose-900 text-[10px] font-bold">
                        ⚠️ 原票 [{rec.bouncedCheckNumber}] 退票待重付 {rec.bouncedReason ? `(${rec.bouncedReason})` : ''}
                      </div>
                    )}
                    <h4 className="text-sm font-bold text-slate-900 mt-2 truncate">{rec.vendorName}</h4>
                    <div className="text-xs text-slate-500 mt-0.5">
                      期別: {rec.billingPeriod} · 發票: {rec.invoiceNumber === 'NONE' ? '免用發票' : rec.invoiceNumber === 'PENDING_NEXT' ? '下期補票' : rec.invoiceNumber || '無'}
                    </div>

                    <div className="mt-2 p-2 rounded-lg bg-white/90 border border-slate-200/80 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">立帳公司:</span>
                        <span className="font-bold text-purple-900">{payComp?.name || '未指定公司'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">進貨原額{rec.discountAmount > 0 ? ' (已扣折讓)' : ''}:</span>
                        <span className="font-mono text-slate-700">
                          NT$ {Math.max(0, rec.inboundTotalAmount - (rec.discountAmount || 0)).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">會計核定稅金 ({taxModeLabel}):</span>
                        <span className="font-mono font-bold text-indigo-700">
                          NT$ {rec.taxAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 shrink-0">廠商慣例:</span>
                        <span className="text-slate-700 truncate font-medium">
                          {bp?.paymentMethodNotes?.trim() || '未特別約定（請依可用專戶付款）'}
                        </span>
                      </div>
                      {rec.isBossAdvance && (
                        <div className="text-[10px] text-amber-900 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          👤 會計核可老闆私帳付款／代墊案件
                        </div>
                      )}
                      {rec.paymentTermNotes && (
                        <div className="text-[10px] text-amber-800 font-medium pt-0.5 border-t border-slate-100">
                          會計備註: {rec.paymentTermNotes}
                        </div>
                      )}
                    </div>

                    <div className="text-lg font-mono font-black text-indigo-700 mt-2">
                      NT$ {rec.netPayableAmount.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      匯費規則: {bp?.bankFeePayer === 'COMPANY' ? '公司外加吸收' : '廠商內扣 30 元'}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-indigo-200/50 flex items-center justify-between gap-2">
                    {canEditCashier ? (
                      <>
                        <button
                          onClick={() => onOpenReturnModal(rec)}
                          className="px-2.5 py-1.5 border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="金額、稅額或買受公司有誤時，退回會計水池重新核算"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>退回重算</span>
                        </button>
                        <button
                          onClick={() => onOpenPaymentModal(rec)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>選擇付款方式並出金</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-400">僅出納人員可執行放款</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* B. 已放款出金紀錄清冊 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-800">
              出納出金付款單歷史紀錄 (Payment Records)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">共 {payments.length} 筆放款紀錄</span>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5">付款單號 / 狀態</th>
                <th className="p-2.5">入帳日期</th>
                <th className="p-2.5">受款對象</th>
                <th className="p-2.5">出款帳戶</th>
                <th className="p-2.5 text-center">支付方式</th>
                <th className="p-2.5 text-right">實付總額</th>
                <th className="p-2.5 text-center">存摺調節</th>
                <th className="p-2.5">備註 / 作廢原因</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400 font-sans">尚無出金付款單紀錄</td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isVoided = p.status === 'VOIDED';
                  return (
                    <tr key={p.id} className={isVoided ? 'bg-rose-50/40 text-slate-400' : 'hover:bg-slate-50'}>
                      <td className="p-2.5">
                        <div className={`font-bold ${isVoided ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {p.paymentNo}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5 font-sans">
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                            isVoided
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isVoided ? 'VOIDED 已作廢沖銷' : 'POSTED 已過帳'}
                          </span>
                          {p.isBossAdvance && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                              老闆私帳
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 font-sans">{p.postingDate}</td>
                      <td className="p-2.5 font-sans font-bold">{p.partnerName || p.customVendorName}</td>
                      <td className="p-2.5 font-sans">{p.bankAccountName}</td>
                      <td className="p-2.5 text-center font-sans">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          p.paymentMethod === 'CHECK' ? 'bg-amber-100 text-amber-800' :
                          p.paymentMethod === 'TT' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {p.paymentMethod === 'CHECK' ? '期票支票' : p.paymentMethod === 'TT' ? '電匯' : '現金'}
                        </span>
                      </td>
                      <td className={`p-2.5 text-right font-black ${isVoided ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        NT$ {p.totalAmount.toLocaleString()}
                      </td>
                      <td className="p-2.5 text-center font-sans">
                        {isVoided ? (
                          <span className="text-rose-500 font-bold">已沖銷</span>
                        ) : p.isReconciled ? (
                          <span className="text-emerald-600 font-bold">已調節</span>
                        ) : (
                          <span className="text-slate-400">未調節</span>
                        )}
                      </td>
                      <td className="p-2.5 font-sans text-slate-500 max-w-xs">
                        <div className="truncate">{p.notes || '-'}</div>
                        {isVoided && p.voidReason && (
                          <div className="text-[10px] text-rose-600 font-bold truncate">
                            作廢原因: {p.voidReason}
                          </div>
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
