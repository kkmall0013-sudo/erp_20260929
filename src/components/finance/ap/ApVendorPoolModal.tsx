// src/components/finance/ap/ApVendorPoolModal.tsx
// 🔍 廠商待請款進貨簽收單正中央檢視彈窗

import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Info, Receipt, X } from 'lucide-react';
import { Company } from '../../../types/erp';
import { VendorPoolGroup } from '../financeUtils';

interface ApVendorPoolModalProps {
  vendorPool: VendorPoolGroup | null;
  companies: Company[];
  canEditAccounting: boolean;
  onClose: () => void;
  onCreateReconciliation: (vendorId: string) => void;
}

export const ApVendorPoolModal: React.FC<ApVendorPoolModalProps> = ({
  vendorPool,
  companies,
  canEditAccounting,
  onClose,
  onCreateReconciliation,
}) => {
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<string[]>([]);

  useEffect(() => {
    if (vendorPool) {
      setExpandedReceiptIds(vendorPool.receipts.map(r => r.id));
    } else {
      setExpandedReceiptIds([]);
    }
  }, [vendorPool]);

  if (!vendorPool) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-4 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl text-amber-800 border border-amber-200">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  待對帳進貨簽收單清冊與送貨單明細
                </h3>
                <span className="font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full text-xs font-mono">
                  {vendorPool.vendorName}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-200">
                  共 {vendorPool.receipts.length} 筆簽收單
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                <span>統一編號: <b className="font-mono text-slate-700">{vendorPool.vendorTaxId || '未載明'}</b></span>
                <span>約定付款天期: <b className="font-mono text-slate-700">T+{vendorPool.paymentTermsDays} 天</b></span>
                <span>匯費約定: <b className="text-slate-700">{vendorPool.bankFeePayer === 'COMPANY' ? '公司外加吸收' : '廠商內扣'}</b></span>
                {vendorPool.paymentMethodNotes && (
                  <span>慣用付款備註: <b className="text-indigo-700">{vendorPool.paymentMethodNotes}</b></span>
                )}
                <span>待請款未稅總原額: <b className="font-mono text-amber-900 font-black">NT$ {vendorPool.totalAmount.toLocaleString()}</b></span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="關閉視窗"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/80">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <Info className="w-4 h-4 text-amber-700" />
              <span>現場紙本簽收單調取清單 · 各送貨單工料明細已同步關聯展示</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExpandedReceiptIds(vendorPool.receipts.map(r => r.id))}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-pointer text-xs"
              >
                全部展開明細
              </button>
              <button
                type="button"
                onClick={() => setExpandedReceiptIds([])}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-semibold cursor-pointer text-xs"
              >
                全部收合
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {vendorPool.receipts.map((r) => {
              const isExp = expandedReceiptIds.includes(r.id);
              const items = r.items || [];
              const rComp = companies.find(c => c.id === r.companyId);

              return (
                <div key={r.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div
                    onClick={() => {
                      setExpandedReceiptIds(prev =>
                        prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id]
                      );
                    }}
                    className="p-3.5 bg-slate-50/70 hover:bg-slate-100/70 transition-colors flex flex-wrap items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="p-1 rounded text-slate-400 hover:text-indigo-600"
                      >
                        {isExp ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 font-mono">
                          <span className="font-bold text-slate-900 text-sm">{r.receiptNumber}</span>
                          <span className="text-indigo-700 font-bold px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100">
                            送貨單號: {r.deliveryNoteNumber || '無單號'}
                          </span>
                          {rComp && (
                            <span className="text-[11px] font-sans px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold">
                              原公司: {rComp.shortName || rComp.name}
                            </span>
                          )}
                          <span className="text-slate-600 font-sans text-xs">
                            簽收日: {r.receivedDate}
                          </span>
                          <span className="text-[11px] font-sans px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                            {items.length} 項品名工料
                          </span>
                        </div>
                        <div className="text-slate-500 font-sans text-xs mt-1 flex flex-wrap items-center gap-3">
                          <span>工區案場: <b className="text-slate-700">{r.projectNameSnapshot || '未指定案場'}</b></span>
                          <span>現場簽收人: <b className="text-slate-700">{r.receivedBy || '現場人員'}</b></span>
                          {r.notes && <span>備註: <i className="text-slate-600">{r.notes}</i></span>}
                          {r.attachmentFileName && (
                            <span className="text-indigo-600 font-mono font-bold flex items-center gap-1">
                              📎 附件: {r.attachmentFileName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">進貨簽收金額 (未稅)</div>
                      <div className="text-lg font-mono font-black text-slate-900">
                        NT$ {r.totalAmount.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {isExp && (
                    <div className="p-3 border-t border-slate-200 bg-white">
                      {items.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 text-xs">無品項明細紀錄</div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                              <tr>
                                <th className="p-2 w-10 text-center">#</th>
                                <th className="p-2">材料品名</th>
                                <th className="p-2">規格型號</th>
                                <th className="p-2 text-center">單位</th>
                                <th className="p-2 text-right">簽收數量</th>
                                <th className="p-2 text-right">採購單價</th>
                                <th className="p-2 text-right">小計金額</th>
                                <th className="p-2">現場備註</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {items.map((it, itemIdx) => (
                                <tr key={it.id || itemIdx} className="hover:bg-slate-50/80">
                                  <td className="p-2 text-center text-slate-400 font-sans">{itemIdx + 1}</td>
                                  <td className="p-2 font-bold text-slate-900 font-sans">{it.itemName}</td>
                                  <td className="p-2 text-slate-600 font-sans">{it.spec || '標準規格'}</td>
                                  <td className="p-2 text-center text-slate-600 font-sans">{it.unit}</td>
                                  <td className="p-2 text-right text-slate-800 font-bold">{it.quantity}</td>
                                  <td className="p-2 text-right text-slate-600">NT$ {it.unitPrice.toLocaleString()}</td>
                                  <td className="p-2 text-right font-black text-slate-900">NT$ {it.lineTotal.toLocaleString()}</td>
                                  <td className="p-2 text-slate-500 font-sans truncate max-w-xs">{it.notes || '—'}</td>
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
            })}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50/90 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer text-xs"
          >
            關閉視窗
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              共檢閱 {vendorPool.receipts.length} 筆進貨簽收單
            </span>
            {canEditAccounting && (
              <button
                type="button"
                onClick={() => {
                  const vId = vendorPool.vendorId;
                  onClose();
                  onCreateReconciliation(vId);
                }}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors cursor-pointer text-xs shadow-2xs inline-flex items-center gap-1.5"
              >
                <Receipt className="w-4 h-4" />
                <span>直接建立對帳單 (帶入勾稽)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
