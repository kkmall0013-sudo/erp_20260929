// src/components/finance/tax401/Tax401PeriodSheetView.tsx
// 雙月 401 稅額試算活頁簿單期視圖 + 憑證清冊 + 預計請款模擬區

import React from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Company,
  Invoice,
  InvoiceCategory401,
  PlannedInvoice,
} from '../../../types/erp';
import {
  deletePlannedInvoice,
  updatePlannedInvoice,
  voidInvoice,
} from '../../../db/sqlite';
import {
  CATEGORY_META,
  Period401Metrics,
  getNextBiMonthlyPeriod,
  resolveInvoiceCategory,
} from '../../../utils/tax401Calculator';

interface Tax401PeriodSheetViewProps {
  selectedYear: number;
  activePeriodKey: string;
  currentPeriodMetrics: Period401Metrics;
  voucherGroupFilter: 'ALL' | 'OUTPUT' | 'INPUT' | 'NON_401';
  onChangeVoucherGroupFilter: (f: 'ALL' | 'OUTPUT' | 'INPUT' | 'NON_401') => void;
  canEdit: boolean;
  taxRatePct: number;
  periodOfficialInvoices: Invoice[];
  periodPlannedList: PlannedInvoice[];
  companies: Company[];
  operatorName: string;
  onOpenAddVoucherModal: (defaultCat?: InvoiceCategory401) => void;
  onOpenAddPlannedModal: () => void;
  onOpenPromoteModal: (planned: PlannedInvoice) => void;
  onRefresh: () => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
}

export const Tax401PeriodSheetView: React.FC<Tax401PeriodSheetViewProps> = ({
  selectedYear,
  activePeriodKey,
  currentPeriodMetrics,
  voucherGroupFilter,
  onChangeVoucherGroupFilter,
  canEdit,
  taxRatePct,
  periodOfficialInvoices,
  periodPlannedList,
  companies,
  operatorName,
  onOpenAddVoucherModal,
  onOpenAddPlannedModal,
  onOpenPromoteModal,
  onRefresh,
  onNotify,
}) => {
  const renderSignedMoney = (val: number, forceColor?: string) => (
    <span className={forceColor || (val < 0 ? 'text-rose-600' : 'text-slate-800')}>
      NT$ {val.toLocaleString()}
    </span>
  );

  return (
    <div className="space-y-4">
      {/* 401 Tax Formula Dashboard: Realized vs Simulated */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-900">
              【正式已實現】{selectedYear} {currentPeriodMetrics.label} 401 稅額試算
            </span>
            <span className={`text-xs font-mono font-black px-2 py-0.5 rounded ${
              currentPeriodMetrics.code11NetPayable > 0
                ? 'bg-rose-100 text-rose-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {currentPeriodMetrics.code11NetPayable > 0
                ? `本期應繳：NT$ ${currentPeriodMetrics.code11NetPayable.toLocaleString()}`
                : `本期累積留抵：NT$ ${currentPeriodMetrics.code12AccumCredit.toLocaleString()}`}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
            <div className="bg-white p-2 rounded-lg border border-slate-200">
              <div className="text-[10px] text-slate-500 font-sans">① 銷項稅額</div>
              <div className="font-bold text-slate-900">${currentPeriodMetrics.outTax.toLocaleString()}</div>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-200">
              <div className="text-[10px] text-slate-500 font-sans">⑦ 本期得抵進項</div>
              <div className="font-bold text-emerald-700">${currentPeriodMetrics.inTax.toLocaleString()}</div>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-200">
              <div className="text-[10px] text-slate-500 font-sans">⑧ 上期留抵結轉</div>
              <div className="font-bold text-blue-700">${currentPeriodMetrics.code8PriorCredit.toLocaleString()}</div>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-200">
              <div className="text-[10px] text-slate-500 font-sans">⑩ 可抵減合計</div>
              <div className="font-bold text-indigo-800">${currentPeriodMetrics.code10TotalDeductible.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-300 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-950">
              【含預計模擬】加計下方未開預計發票試算
            </span>
            <span className={`text-xs font-mono font-black px-2 py-0.5 rounded ${
              currentPeriodMetrics.simCode11NetPayable > 0
                ? 'bg-rose-200 text-rose-900'
                : 'bg-emerald-200 text-emerald-900'
            }`}>
              {currentPeriodMetrics.simCode11NetPayable > 0
                ? `模擬應繳：NT$ ${currentPeriodMetrics.simCode11NetPayable.toLocaleString()}`
                : `模擬留抵：NT$ ${currentPeriodMetrics.simCode12AccumCredit.toLocaleString()}`}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
            <div className="bg-white/90 p-2 rounded-lg border border-amber-200">
              <div className="text-[10px] text-amber-800 font-sans">① 模擬銷項稅</div>
              <div className="font-bold text-slate-900">${currentPeriodMetrics.simOutTax.toLocaleString()}</div>
            </div>
            <div className="bg-white/90 p-2 rounded-lg border border-amber-200">
              <div className="text-[10px] text-amber-800 font-sans">⑦ 模擬進項稅</div>
              <div className="font-bold text-emerald-700">${currentPeriodMetrics.inSimTax.toLocaleString()}</div>
            </div>
            <div className="bg-white/90 p-2 rounded-lg border border-amber-200">
              <div className="text-[10px] text-amber-800 font-sans">⑧ 模擬期初留抵</div>
              <div className="font-bold text-blue-700">${currentPeriodMetrics.simCode8PriorCredit.toLocaleString()}</div>
            </div>
            <div className="bg-white/90 p-2 rounded-lg border border-amber-200">
              <div className="text-[10px] text-amber-800 font-sans">非401收據/免稅</div>
              <div className="font-bold text-slate-700">${currentPeriodMetrics.non401Total.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Quick Category Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: 'ALL', label: '全部憑證' },
            { id: 'OUTPUT', label: '銷項 (三聯/二聯/折讓)' },
            { id: 'INPUT', label: '可抵進項 (進貨/油單/電話/台電/費用)' },
            { id: 'NON_401', label: '不申報401 (收據/郵資/個人憑證)' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeVoucherGroupFilter(tab.id as any)}
              className={`px-2.5 py-1 rounded-lg font-bold border cursor-pointer ${
                voucherGroupFilter === tab.id
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => onOpenAddVoucherModal('TELECOM_EXPENSE')}
              className="px-2 py-1 rounded bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold cursor-pointer"
            >
              + 電話費
            </button>
            <button
              type="button"
              onClick={() => onOpenAddVoucherModal('ELECTRICITY_EXPENSE')}
              className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold cursor-pointer"
            >
              + 台電電費
            </button>
            <button
              type="button"
              onClick={() => onOpenAddVoucherModal('FUEL_EXPENSE')}
              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold cursor-pointer"
            >
              + 油單+三聯
            </button>
            <button
              type="button"
              onClick={() => onOpenAddVoucherModal('RECEIPT_EXEMPT')}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold cursor-pointer"
            >
              + 收據/郵資
            </button>
          </div>
        )}
      </div>

      {/* Official Vouchers Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="p-2.5">發票字軌 / 憑證號</th>
              <th className="p-2.5">401 分類</th>
              <th className="p-2.5">日期</th>
              <th className="p-2.5">開立／買受對象 (統編)</th>
              <th className="p-2.5 text-right">銷售額 / 未稅</th>
              <th className="p-2.5 text-right">營業稅 ({taxRatePct}%)</th>
              <th className="p-2.5 text-right">含稅總額</th>
              <th className="p-2.5 text-center">狀態 / 操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {periodOfficialInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400 font-sans">
                  本期（{activePeriodKey}）尚無正式發票或費用憑證（AR開票、AP核准會自動寫入，或點擊右上方手動新增）
                </td>
              </tr>
            ) : (
              periodOfficialInvoices.map(inv => {
                const cat = resolveInvoiceCategory(inv);
                const meta = CATEGORY_META[cat];
                const counterpartName = inv.invoiceType === 'INPUT' ? (inv.issuerName || inv.issuerTaxId) : (inv.buyerName || inv.buyerTaxId);
                const counterpartTax = inv.invoiceType === 'INPUT' ? inv.issuerTaxId : inv.buyerTaxId;
                const sign = meta.sign === -1 ? -1 : 1;
                return (
                  <tr key={inv.id} className={inv.status === 'VOIDED' ? 'bg-slate-50 text-slate-400' : 'hover:bg-slate-50'}>
                    <td className={`p-2.5 font-bold ${inv.status === 'VOIDED' ? 'line-through text-slate-400' : 'text-indigo-700'}`}>
                      <div>{inv.invoiceNumber}</div>
                      <div className="flex flex-wrap gap-1 mt-0.5 font-sans text-[9px]">
                        <span className="px-1 rounded bg-slate-100 text-slate-600">
                          {inv.invoiceFormat === 'TWO_PART' ? '二聯' : '三聯'}
                        </span>
                        {inv.invoiceIssueMode === 'SELF_RETAINED' && (
                          <span className="px-1 rounded bg-purple-100 text-purple-800 font-bold">自主留存報稅</span>
                        )}
                        {inv.presetLabel && (
                          <span className="px-1 rounded bg-sky-100 text-sky-800 font-bold">{inv.presetLabel}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 font-sans">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        meta.group === 'OUTPUT'
                          ? 'bg-emerald-100 text-emerald-800'
                          : meta.group === 'INPUT'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-600">{inv.invoiceDate}</td>
                    <td className="p-2.5 font-sans text-slate-700">
                      <div className="font-bold">{counterpartName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {counterpartTax}
                        {inv.notes ? ` · ${inv.notes}` : ''}
                      </div>
                    </td>
                    <td className="p-2.5 text-right">{renderSignedMoney(sign * inv.netAmount)}</td>
                    <td className="p-2.5 text-right">{renderSignedMoney(sign * inv.taxAmount)}</td>
                    <td className="p-2.5 text-right font-black">{renderSignedMoney(sign * inv.totalAmount)}</td>
                    <td className="p-2.5 text-center font-sans">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        inv.status === 'VOIDED' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {inv.status === 'VOIDED' ? '已作廢' : '有效'}
                      </span>
                      {canEdit && inv.status === 'VALID' && (
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              voidInvoice(inv.id, '發票主檔作業作廢', operatorName);
                              onRefresh();
                              onNotify(`已作廢發票 [${inv.invoiceNumber}]`, 'warn');
                            } catch (e: any) {
                              onNotify(`作廢失敗：${e.message}`, 'error');
                            }
                          }}
                          className="text-[10px] text-slate-400 hover:text-rose-600 underline cursor-pointer ml-1.5"
                        >
                          作廢
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

      {/* PLANNED FORECAST SEPARATOR ZONE */}
      <div className="border-2 border-dashed border-amber-300 rounded-xl p-4 bg-amber-50/30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-amber-700" />
            <h4 className="text-xs font-black text-amber-950">
              預計請款／預計進項模擬區（比照 Excel 空數行放置未押日期與未開號碼之預計資料）
            </h4>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={onOpenAddPlannedModal}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新增預計請款 / 預計發票</span>
            </button>
          )}
        </div>

        {periodPlannedList.length === 0 ? (
          <div className="p-4 text-center text-xs text-amber-800/70 bg-white/60 rounded-lg border border-amber-200/70">
            本雙月期別尚無「預計請款／預計進項」項目；會計可先打上預計金額（不壓日期與發票號），即時試算要開哪家公司發票或順延下期。
          </div>
        ) : (
          <div className="space-y-2">
            {periodPlannedList.map(p => {
              const meta = CATEGORY_META[p.invoiceCategory] || CATEGORY_META.SALES_THREE_PART;
              return (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-white border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                        預計模擬 · 未押日期/號碼
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        meta.group === 'OUTPUT' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                      }`}>
                        {meta.label}
                      </span>
                      {p.invoiceIssueMode === 'SELF_RETAINED' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">
                          預計自主報稅
                        </span>
                      )}
                      <span className="font-bold text-slate-900">{p.partnerName}</span>
                      {p.partnerTaxId && <span className="font-mono text-[10px] text-slate-400">({p.partnerTaxId})</span>}
                    </div>
                    <div className="font-mono text-[11px] text-slate-600">
                      未稅 NT$ <b>{p.netAmount.toLocaleString()}</b> ＋ 稅額 NT$ <b className="text-amber-800">{p.taxAmount.toLocaleString()}</b> ＝ 含稅 <b>NT$ {p.totalAmount.toLocaleString()}</b>
                      {p.notes && <span className="font-sans text-slate-400 ml-2">({p.notes})</span>}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {companies.length > 1 && (
                        <select
                          value={p.companyId}
                          onChange={(e) => {
                            updatePlannedInvoice(p.id, { companyId: e.target.value });
                            onRefresh();
                            onNotify('已將預計項目切換試算公司！', 'success');
                          }}
                          className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-[11px] font-bold text-slate-700 cursor-pointer"
                          title="快速切換要由哪家公司開立／認列以試算稅額"
                        >
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>改由 {c.shortName || c.name}</option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          const nextPeriod = getNextBiMonthlyPeriod(p.taxPeriod);
                          updatePlannedInvoice(p.id, { taxPeriod: nextPeriod });
                          onRefresh();
                          onNotify(`已順延至下一期 (${nextPeriod})`, 'success');
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                        title="本期不開立，一鍵延至下一個雙月期別"
                      >
                        <ArrowRight className="w-3 h-3" />
                        <span>順延下期</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenPromoteModal(p)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>補號轉正式</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          deletePlannedInvoice(p.id);
                          onRefresh();
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="移除預計項目"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
