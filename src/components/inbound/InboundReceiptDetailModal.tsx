// src/components/inbound/InboundReceiptDetailModal.tsx
// 👁️ 進貨簽收單詳情檢視 Modal (含直達編輯鈕) + 🖨️ 工程現場進貨簽收單列印預覽 Modal

import React from 'react';
import {
  FileText,
  Edit,
  X,
  Printer,
  Paperclip,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { InboundReceipt } from '../../types/erp';

export interface InboundReceiptDetailModalProps {
  selectedReceipt: InboundReceipt | null;
  isDetailOpen: boolean;
  isPrintOpen: boolean;
  canWrite: boolean;
  hasPrev?: boolean;
  hasNext?: boolean;
  positionLabel?: string;
  onPrev?: () => void;
  onNext?: () => void;
  onCloseDetail: () => void;
  onClosePrint: () => void;
  onEditFromDetail: (receipt: InboundReceipt) => void;
  onPrintFromDetail: (receipt: InboundReceipt) => void;
}

export const InboundReceiptDetailModal: React.FC<InboundReceiptDetailModalProps> = ({
  selectedReceipt,
  isDetailOpen,
  isPrintOpen,
  canWrite,
  hasPrev = false,
  hasNext = false,
  positionLabel,
  onPrev,
  onNext,
  onCloseDetail,
  onClosePrint,
  onEditFromDetail,
  onPrintFromDetail,
}) => {
  if (!selectedReceipt) return null;

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* 👁️ 檢視詳情 Modal (含直接點選修改按鈕)                        */}
      {/* ------------------------------------------------------------- */}
      {isDetailOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white">現場進貨簽收單詳情</h3>
                <span className="font-mono text-xs text-indigo-300 bg-indigo-900/50 px-2 py-0.5 rounded border border-indigo-700/50">
                  {selectedReceipt.receiptNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={onCloseDetail}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block mb-0.5">廠商送貨單號</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {selectedReceipt.deliveryNoteNumber}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">簽收日期</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedReceipt.receivedDate}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">現場點收人</span>
                  <span className="font-bold text-slate-800">
                    {selectedReceipt.receivedBy || '現場人員'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">點收狀態</span>
                  <span className="font-bold text-emerald-700">
                    {selectedReceipt.status === 'POSTED'
                      ? '現場已點收簽收'
                      : selectedReceipt.status === 'DRAFT'
                      ? '現場草稿'
                      : '已作廢'}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className="text-slate-400 block mb-0.5">供料合作廠商</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedReceipt.vendorNameSnapshot}{' '}
                    {selectedReceipt.vendorTaxIdSnapshot ? `(${selectedReceipt.vendorTaxIdSnapshot})` : ''}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className="text-slate-400 block mb-0.5">歸屬工區案場 (直入成本)</span>
                  <span className="font-bold text-indigo-700 text-sm">
                    {selectedReceipt.projectNameSnapshot}
                  </span>
                </div>
              </div>

              {selectedReceipt.attachmentFileName && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">現場簽收單拍照存證：</span>
                  <div className="flex items-center gap-1.5 text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-200">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{selectedReceipt.attachmentFileName}</span>
                  </div>
                </div>
              )}

              {/* 明細清冊 */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">物料簽收明細</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2 px-3 text-center w-8">#</th>
                        <th className="py-2 px-3">品名</th>
                        <th className="py-2 px-3">規格</th>
                        <th className="py-2 px-3 text-center">單位</th>
                        <th className="py-2 px-3 text-right">數量</th>
                        <th className="py-2 px-3 text-right">單價</th>
                        <th className="py-2 px-3 text-right">小計</th>
                        <th className="py-2 px-3">備註</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedReceipt.items || []).map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{it.itemName}</td>
                          <td className="py-2 px-3 text-slate-600">{it.spec || '—'}</td>
                          <td className="py-2 px-3 text-center text-slate-600 font-medium">{it.unit}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{it.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            ${Number(it.unitPrice).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">
                            ${Number(it.lineTotal).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-slate-500">{it.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold border-t border-slate-200">
                        <td colSpan={6} className="py-2 px-3 text-right text-slate-700">
                          合計未稅金額：
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-indigo-700">
                          ${Number(selectedReceipt.totalAmount).toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedReceipt.notes && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block mb-0.5">現場備註</span>
                  <p className="text-slate-700">{selectedReceipt.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {(onPrev || onNext) && (
                  <div className="inline-flex items-center gap-1 mr-2">
                    <button
                      type="button"
                      disabled={!hasPrev}
                      onClick={onPrev}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>上一筆</span>
                    </button>
                    {positionLabel && (
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 px-1.5">
                        {positionLabel}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={!hasNext}
                      onClick={onNext}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>下一筆</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <span className="text-xs text-slate-400 font-mono">
                  建立時間: {selectedReceipt.createdAt}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* 詳情內直接修改按鈕 */}
                {canWrite && selectedReceipt.billingStatus !== 'BILLED' && (
                  <button
                    type="button"
                    onClick={() => onEditFromDetail(selectedReceipt)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="修改此張簽收單內容"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>編輯修改此單</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onPrintFromDetail(selectedReceipt)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>列印簽單</span>
                </button>

                <button
                  type="button"
                  onClick={onCloseDetail}
                  className="px-4 py-1.5 bg-slate-800 text-white hover:bg-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🖨️ 列印預覽 Modal */}
      {isPrintOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden print:m-0 print:border-none print:shadow-none animate-in fade-in">
            <div className="p-8 space-y-6">
              <div className="text-center border-b pb-4">
                <h2 className="text-xl font-bold tracking-wider text-slate-900">工程現場進貨簽收單</h2>
                <div className="text-xs text-slate-500 font-mono mt-1">
                  單號: {selectedReceipt.receiptNumber} | 送貨單號: {selectedReceipt.deliveryNoteNumber}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">供料廠商：</span>
                  <span className="font-bold text-slate-900">{selectedReceipt.vendorNameSnapshot}</span>
                </div>
                <div>
                  <span className="text-slate-500">歸屬案場：</span>
                  <span className="font-bold text-slate-900">{selectedReceipt.projectNameSnapshot}</span>
                </div>
                <div>
                  <span className="text-slate-500">進貨簽收日：</span>
                  <span className="font-mono text-slate-900">{selectedReceipt.receivedDate}</span>
                </div>
                <div>
                  <span className="text-slate-500">現場點收人員：</span>
                  <span className="font-bold text-slate-900">{selectedReceipt.receivedBy || '現場人員'}</span>
                </div>
              </div>

              <table className="w-full text-xs border border-slate-300">
                <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                  <tr>
                    <th className="p-2 border-r border-slate-300 text-center w-10">項</th>
                    <th className="p-2 border-r border-slate-300">品名</th>
                    <th className="p-2 border-r border-slate-300">規格</th>
                    <th className="p-2 border-r border-slate-300 text-center">單位</th>
                    <th className="p-2 border-r border-slate-300 text-right">數量</th>
                    <th className="p-2 border-r border-slate-300 text-right">單價</th>
                    <th className="p-2 text-right">小計</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(selectedReceipt.items || []).map((it, i) => (
                    <tr key={i}>
                      <td className="p-2 border-r border-slate-200 text-center font-mono">{i + 1}</td>
                      <td className="p-2 border-r border-slate-200 font-bold">{it.itemName}</td>
                      <td className="p-2 border-r border-slate-200">{it.spec || '-'}</td>
                      <td className="p-2 border-r border-slate-200 text-center">{it.unit}</td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono">{it.quantity}</td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono">
                        ${it.unitPrice.toLocaleString()}
                      </td>
                      <td className="p-2 text-right font-mono font-bold">${it.lineTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-300 font-bold">
                    <td colSpan={6} className="p-2 text-right">
                      合計未稅 (NT$)：
                    </td>
                    <td className="p-2 text-right font-mono">${selectedReceipt.totalAmount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="grid grid-cols-3 gap-4 pt-8 text-xs border-t">
                <div className="border-t border-slate-400 pt-2 text-center text-slate-600">
                  供料司機簽收：_______________
                </div>
                <div className="border-t border-slate-400 pt-2 text-center text-slate-600">
                  現場點收人：_______________
                </div>
                <div className="border-t border-slate-400 pt-2 text-center text-slate-600">
                  工務所主管：_______________
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer"
              >
                列印此頁
              </button>
              <button
                type="button"
                onClick={onClosePrint}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-300 cursor-pointer"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
