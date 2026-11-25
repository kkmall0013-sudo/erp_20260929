// src/components/finance/ap/ApReconciliationReceiptsSelector.tsx
// 📦 應付對帳單勾稽進貨單清單與品項展開檢視器

import React from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Company, InboundReceipt } from '../../../types/erp';

interface ApReconciliationReceiptsSelectorProps {
  visibleReceipts: InboundReceipt[];
  vendorPendingAllCount: number;
  selectedReceiptIds: string[];
  expandedReceiptIds: string[];
  recCompanyId: string;
  receiptCompanyFilter: 'ALL' | 'MATCH_COMPANY';
  selectedMismatchedCount: number;
  selectedBuyerCompName: string;
  companies: Company[];
  onChangeFilter: (f: 'ALL' | 'MATCH_COMPANY') => void;
  onToggleSelect: (receiptId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onToggleExpand: (receiptId: string) => void;
}

export const ApReconciliationReceiptsSelector: React.FC<ApReconciliationReceiptsSelectorProps> = ({
  visibleReceipts,
  vendorPendingAllCount,
  selectedReceiptIds,
  expandedReceiptIds,
  recCompanyId,
  receiptCompanyFilter,
  selectedMismatchedCount,
  selectedBuyerCompName,
  companies,
  onChangeFilter,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onToggleExpand,
}) => {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="font-bold text-slate-800 flex items-center gap-1.5">
          <span>勾選本期核對之現場進貨簽收單</span>
          <span className="text-slate-400 font-normal">
            (已勾選 {selectedReceiptIds.length} 筆 · 可展開查看明細品項)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => onChangeFilter('ALL')}
              className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                receiptCompanyFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'
              }`}
            >
              顯示全部待對帳 ({vendorPendingAllCount})
            </button>
            <button
              type="button"
              onClick={() => onChangeFilter('MATCH_COMPANY')}
              className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                receiptCompanyFilter === 'MATCH_COMPANY' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'
              }`}
            >
              僅看此買受公司進貨單
            </button>
          </div>
          <button
            type="button"
            onClick={onSelectAll}
            className="text-indigo-600 font-bold hover:underline cursor-pointer"
          >
            全選顯示
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-slate-500 font-medium hover:underline cursor-pointer"
          >
            清空
          </button>
        </div>
      </div>

      {selectedMismatchedCount > 0 && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <b>跨公司案場對帳提醒：</b>已勾選項目中有 {selectedMismatchedCount} 筆原進貨歸屬公司與本次發票買受付款公司（<b>{selectedBuyerCompName}</b>）不同。依「以發票為主」原則，本單將以買受公司出帳（案場原成本不變）。
          </span>
        </div>
      )}

      <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
        {visibleReceipts.length === 0 ? (
          <div className="p-6 text-center text-slate-400">
            {receiptCompanyFilter === 'MATCH_COMPANY' && vendorPendingAllCount > 0
              ? '此買受公司名下目前無待對帳進貨單（可點上方「顯示全部待對帳」跨案場合併開發票）'
              : '該廠商大水池中目前無待對帳進貨單'}
          </div>
        ) : (
          visibleReceipts.map((rec) => {
            const isChecked = selectedReceiptIds.includes(rec.id);
            const isExpanded = expandedReceiptIds.includes(rec.id);
            const rComp = companies.find(c => c.id === rec.companyId);
            const isDiffCompany = Boolean(rec.companyId && rec.companyId !== recCompanyId);

            return (
              <div key={rec.id} className="transition-colors">
                <div
                  onClick={() => onToggleSelect(rec.id)}
                  className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                    isChecked ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(rec.id);
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                      title={isExpanded ? '收合商品品項明細' : '展開檢視商品品項明細'}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{rec.receiptNumber}</span>
                        <span className="text-indigo-700 font-mono font-semibold">送貨單: {rec.deliveryNoteNumber}</span>
                        {rComp && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${
                            isDiffCompany
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-purple-50 text-purple-800 border-purple-200'
                          }`}>
                            {rComp.shortName || rComp.name}
                          </span>
                        )}
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-sans">
                          {rec.receivedDate}
                        </span>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-mono font-bold">
                          {rec.items?.length || 0} 個品項
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        案場: {rec.projectNameSnapshot} · 現場簽收人: {rec.receivedBy}
                        {rec.notes && ` · 備註: ${rec.notes}`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-black text-slate-900">
                      NT$ {rec.totalAmount.toLocaleString()}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-slate-50 p-3 pl-11 border-t border-slate-200 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold text-slate-700 flex items-center gap-1.5 text-[11px]">
                        <span>📦 進貨簽收單明細清冊 (原始調取資料)</span>
                      </div>
                      {rec.attachmentFileName && (
                        <span className="text-[10px] text-indigo-600 font-mono font-bold">
                          📎 簽單附件: {rec.attachmentFileName}
                        </span>
                      )}
                    </div>

                    {(!rec.items || rec.items.length === 0) ? (
                      <div className="text-slate-400 py-2 text-center text-[10px]">無工料明細品項</div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full text-[11px] text-left border-collapse">
                          <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                              <th className="p-1.5 w-8 text-center">#</th>
                              <th className="p-1.5">材料/品名名稱</th>
                              <th className="p-1.5">規格/型號</th>
                              <th className="p-1.5 text-center">單位</th>
                              <th className="p-1.5 text-right">簽收數量</th>
                              <th className="p-1.5 text-right">採購單價</th>
                              <th className="p-1.5 text-right">金額小計</th>
                              <th className="p-1.5">現場簽收備註</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {rec.items.map((it, idx) => (
                              <tr key={it.id || idx} className="hover:bg-slate-50/70">
                                <td className="p-1.5 text-center text-slate-400">{idx + 1}</td>
                                <td className="p-1.5 font-bold text-slate-900 font-sans">{it.itemName}</td>
                                <td className="p-1.5 text-slate-600 font-sans">{it.spec || '標準規格'}</td>
                                <td className="p-1.5 text-center text-slate-600 font-sans">{it.unit}</td>
                                <td className="p-1.5 text-right text-slate-800">{it.quantity}</td>
                                <td className="p-1.5 text-right text-slate-600">NT$ {it.unitPrice.toLocaleString()}</td>
                                <td className="p-1.5 text-right font-black text-slate-900">NT$ {it.lineTotal.toLocaleString()}</td>
                                <td className="p-1.5 text-slate-500 font-sans max-w-xs truncate">{it.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
