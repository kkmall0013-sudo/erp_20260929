// src/components/finance/ap/ApArchiveTable.tsx
// 🧾 已完全完工結清應付對帳單備查清冊表格

import React from 'react';
import {
  Ban,
  Edit3,
  FileCheck2,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  AccountsPayableReconciliation,
  Company,
  PaymentRecord,
} from '../../../types/erp';
import { formatLocalYmd } from '../financeUtils';

interface ApArchiveTableProps {
  filteredRecs: AccountsPayableReconciliation[];
  payments: PaymentRecord[];
  companies: Company[];
  taxRatePct: number;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  selectedStatusFilter: string;
  onStatusFilterChange: (val: string) => void;
  canEditAccounting: boolean;
  canEditCashier: boolean;
  onOpenEditRec: (rec: AccountsPayableReconciliation) => void;
  onOpenPayment: (rec: AccountsPayableReconciliation) => void;
  onOpenReturnRec: (rec: AccountsPayableReconciliation) => void;
  onOpenVoidRec: (recId: string) => void;
}

export const ApArchiveTable: React.FC<ApArchiveTableProps> = ({
  filteredRecs,
  payments,
  companies,
  taxRatePct,
  searchQuery,
  onSearchQueryChange,
  selectedStatusFilter,
  onStatusFilterChange,
  canEditAccounting,
  canEditCashier,
  onOpenEditRec,
  onOpenPayment,
  onOpenReturnRec,
  onOpenVoidRec,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-bold text-slate-800">
            3. 已完全完工備查清冊 (Completed &amp; Settled Archive)
          </h3>
          <span className="text-[11px] text-slate-400">
            (目前顯示 {filteredRecs.length} 筆 · 已出金結清與歷史備查資料)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="搜尋對帳單號、廠商、發票..."
              className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 w-48"
            />
          </div>

          <select
            value={selectedStatusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 outline-none"
          >
            <option value="PAID">已完全完工結清 (PAID)</option>
            <option value="COMPLETED">已結清 + 已作廢 (歷史歸檔)</option>
            <option value="VOIDED">僅看：已作廢紀錄</option>
            <option value="APPROVED">僅看：已送出納待放款</option>
            <option value="RETURNED">僅看：出納退回重算</option>
            <option value="DRAFT">僅看：草稿暫存</option>
            <option value="ALL">全部歷史紀錄</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-100 rounded-lg">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="p-2.5">對帳單號</th>
              <th className="p-2.5">期別</th>
              <th className="p-2.5">廠商名稱</th>
              <th className="p-2.5 text-right">進貨原額</th>
              <th className="p-2.5 text-right text-rose-600">折讓扣除</th>
              <th className="p-2.5 text-right">營業稅 ({taxRatePct}%)</th>
              <th className="p-2.5 text-right">本期應付淨額</th>
              <th className="p-2.5">發票字軌</th>
              <th className="p-2.5">立帳歸屬公司 / 帳務性質</th>
              <th className="p-2.5">預計付款日</th>
              <th className="p-2.5 text-center">狀態</th>
              <th className="p-2.5 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {filteredRecs.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-6 text-center text-slate-400 font-sans">
                  查無符合條件的應付對帳單
                </td>
              </tr>
            ) : (
              filteredRecs.map((rec) => {
                const today = formatLocalYmd(new Date());
                const isOverdue = rec.status === 'APPROVED' && rec.paymentDueDate < today;
                const isDueSoon = rec.status === 'APPROVED' && rec.paymentDueDate >= today && rec.paymentDueDate <= formatLocalYmd(new Date(Date.now() + 7 * 86400000));
                const payComp = companies.find(c => c.id === rec.companyId);
                const matchedPay = payments.find(
                  p => p.status !== 'VOIDED' && p.lineItems?.some(li => li.sourceId === rec.id)
                );

                return (
                  <tr key={rec.id} className={`transition-colors ${rec.status === 'RETURNED' ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/80'}`}>
                    <td className="p-2.5 font-bold text-slate-900">{rec.reconciliationNumber}</td>
                    <td className="p-2.5 font-sans text-slate-600">{rec.billingPeriod}</td>
                    <td className="p-2.5 font-sans font-bold text-slate-800">{rec.vendorName || rec.vendorId}</td>
                    <td className="p-2.5 text-right text-slate-700">NT$ {rec.inboundTotalAmount.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-rose-600">
                      {rec.discountAmount > 0 ? `- NT$ ${rec.discountAmount.toLocaleString()}` : '-'}
                    </td>
                    <td className="p-2.5 text-right text-slate-700">
                      <div>NT$ {rec.taxAmount.toLocaleString()}</div>
                      <div className="text-[10px] font-sans text-slate-400">
                        {rec.taxType === 'TAX_EXCLUSIVE' ? '外加' : rec.taxType === 'TAX_INCLUSIVE' ? '內含' : '免稅'}
                      </div>
                    </td>
                    <td className="p-2.5 text-right font-bold text-indigo-700">NT$ {rec.netPayableAmount.toLocaleString()}</td>
                    <td className="p-2.5 font-sans text-slate-600">
                      {rec.invoiceNumber === 'NONE' ? (
                        <span className="text-slate-400">免用發票</span>
                      ) : rec.invoiceNumber === 'PENDING_NEXT' ? (
                        <span className="text-amber-600 font-semibold">下期補票</span>
                      ) : (
                        <span className="font-mono text-indigo-600 font-semibold">{rec.invoiceNumber}</span>
                      )}
                    </td>
                    <td className="p-2.5 font-sans">
                      <div className="font-bold text-slate-800 text-[11px]">
                        {payComp?.shortName || payComp?.name || '未指定公司'}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[10px] text-slate-500">
                        {matchedPay ? (
                          <span className={`px-1.5 py-0.2 rounded font-bold ${
                            matchedPay.paymentMethod === 'CHECK' ? 'bg-amber-100 text-amber-800' :
                            matchedPay.paymentMethod === 'TT' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            出納實付：{matchedPay.paymentMethod === 'CHECK' ? '支票' : matchedPay.paymentMethod === 'TT' ? '電匯' : '現金'}
                          </span>
                        ) : rec.status === 'APPROVED' ? (
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                            待出納決定付款方式
                          </span>
                        ) : rec.status === 'RETURNED' ? (
                          <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">
                            出納退回重算中
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                            {rec.hasInvoice ? '憑證立帳' : '免用發票內帳'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <span className={`inline-flex items-center gap-1 font-sans ${
                        isOverdue ? 'text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded' :
                        isDueSoon ? 'text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded' : 'text-slate-600'
                      }`}>
                        {isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />}
                        {isDueSoon && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                        <span>{rec.paymentDueDate}</span>
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-sans">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          rec.status === 'APPROVED' ? 'bg-amber-100 text-amber-800' :
                          rec.status === 'RETURNED' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                          rec.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                          rec.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {rec.status === 'APPROVED' ? '待出金放款' :
                           rec.status === 'RETURNED' ? '🚨 出納退回重算' :
                           rec.status === 'PAID' ? '已出金結清' :
                           rec.status === 'DRAFT' ? '草稿暫存' : '已作廢'}
                        </span>
                        {rec.status === 'RETURNED' && rec.returnedReason && (
                          <span
                            className="text-[10px] text-rose-700 font-semibold max-w-[140px] truncate"
                            title={`${rec.returnedBy || '出納'}：${rec.returnedReason}`}
                          >
                            原因：{rec.returnedReason}
                          </span>
                        )}
                        {rec.bouncedCheckNumber && rec.status === 'APPROVED' && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-bold"
                            title={rec.bouncedReason || '退票待重付'}
                          >
                            ⚠️ 原票 {rec.bouncedCheckNumber} 退票
                          </span>
                        )}
                        {rec.isBossAdvance && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                            老闆私帳
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 text-center font-sans space-x-1">
                      {(rec.status === 'DRAFT' || rec.status === 'RETURNED') && canEditAccounting && (
                        <button
                          onClick={() => onOpenEditRec(rec)}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                            rec.status === 'RETURNED'
                              ? 'bg-rose-600 hover:bg-rose-700 text-white'
                              : 'bg-amber-600 hover:bg-amber-700 text-white'
                          }`}
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>{rec.status === 'RETURNED' ? '重算修正' : '繼續編輯'}</span>
                        </button>
                      )}
                      {rec.status === 'APPROVED' && (
                        canEditCashier ? (
                          <>
                            <button
                              onClick={() => onOpenPayment(rec)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              放款出金
                            </button>
                            <button
                              onClick={() => onOpenReturnRec(rec)}
                              className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 p-1 rounded transition-colors cursor-pointer"
                              title="退回會計重算"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            已拋轉出納
                          </span>
                        )
                      )}
                      {canEditAccounting && rec.status !== 'VOIDED' && rec.status !== 'PAID' && (
                        <button
                          onClick={() => onOpenVoidRec(rec.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title="作廢對帳單 (進貨單回滾釋放回大水池)"
                        >
                          <Ban className="w-3.5 h-3.5" />
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
  );
};
