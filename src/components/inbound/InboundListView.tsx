// src/components/inbound/InboundListView.tsx
// 📋 現場進貨簽收工作台：標準清單檢視 (支援多項物料展開與單筆極速/修改/點收/刪除/作廢)

import React from 'react';
import {
  Truck,
  Building2,
  CheckCircle2,
  Eye,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import { InboundReceipt } from '../../types/erp';
import { ReceiptProjectInfo } from './inboundWorkspaceUtils';

export interface InboundListViewProps {
  filteredReceipts: InboundReceipt[];
  expandedRowIds: Set<string>;
  canWrite: boolean;
  canApprove: boolean;
  getReceiptProjectInfo: (r: InboundReceipt) => ReceiptProjectInfo;
  onToggleRowExpand: (id: string) => void;
  onLoadDraftToExcelGrid: (r: InboundReceipt) => void;
  onOpenEditModal: (r: InboundReceipt) => void;
  onOpenDetailModal: (r: InboundReceipt) => void;
  onPrintReceipt: (r: InboundReceipt) => void;
  onPostReceipt: (r: InboundReceipt) => void;
  onOpenDeleteModal: (r: InboundReceipt) => void;
  onOpenVoidModal: (r: InboundReceipt) => void;
}

export const InboundListView: React.FC<InboundListViewProps> = ({
  filteredReceipts,
  expandedRowIds,
  canWrite,
  canApprove,
  getReceiptProjectInfo,
  onToggleRowExpand,
  onLoadDraftToExcelGrid,
  onOpenEditModal,
  onOpenDetailModal,
  onPrintReceipt,
  onPostReceipt,
  onOpenDeleteModal,
  onOpenVoidModal,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">現場進貨簽收單清冊</span>
          <span className="text-xs text-slate-400 font-mono">({filteredReceipts.length} 筆)</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 現場已點收
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> 待點收草稿
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span> 已作廢
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
              <th className="py-3 px-3 whitespace-nowrap">系統單號</th>
              <th className="py-3 px-3 whitespace-nowrap">送貨簽收單號</th>
              <th className="py-3 px-3 whitespace-nowrap">簽收日</th>
              <th className="py-3 px-3 whitespace-nowrap">供料廠商</th>
              <th className="py-3 px-3 whitespace-nowrap">歸屬案場</th>
              <th className="py-3 px-3 whitespace-nowrap">品名</th>
              <th className="py-3 px-3 whitespace-nowrap">規格</th>
              <th className="py-3 px-3 text-center whitespace-nowrap">單位</th>
              <th className="py-3 px-3 text-right whitespace-nowrap">數量</th>
              <th className="py-3 px-3 text-right whitespace-nowrap">單價</th>
              <th className="py-3 px-3 text-right whitespace-nowrap">未稅金額 (NT$)</th>
              <th className="py-3 px-3 text-center whitespace-nowrap">現場點收狀態</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredReceipts.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-12 text-center text-slate-400">
                  <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-medium">查無符合條件的進貨簽收單據</p>
                  <p className="text-xs text-slate-400 mt-1">
                    可點選右上角「📊 極速進貨打單」開始快速鍵入
                  </p>
                </td>
              </tr>
            ) : (
              filteredReceipts.map(r => {
                const firstItem = r.items && r.items.length > 0 ? r.items[0] : null;
                const itemsCount = (r.items || []).length;
                const isExpanded = expandedRowIds.has(r.id);

                return (
                  <React.Fragment key={r.id}>
                    <tr
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => onToggleRowExpand(r.id)}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {itemsCount > 1 && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onToggleRowExpand(r.id);
                              }}
                              className="text-slate-400 hover:text-indigo-600 p-0.5"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <span>{r.receiptNumber}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
                          {r.deliveryNoteNumber}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {r.receivedDate}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate max-w-[130px]">{r.vendorNameSnapshot || '廠商'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                        {(() => {
                          const prjInfo = getReceiptProjectInfo(r);
                          return (
                            <span
                              className="text-indigo-700 font-semibold truncate max-w-[140px] inline-block"
                              title={prjInfo.name}
                            >
                              {prjInfo.name}
                            </span>
                          );
                        })()}
                      </td>
                      {/* 品名 */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-bold text-slate-900">
                          <span className="truncate max-w-[140px]">
                            {firstItem ? firstItem.itemName : '無品名'}
                          </span>
                          {itemsCount > 1 && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-normal shrink-0">
                              +{itemsCount - 1}項
                            </span>
                          )}
                        </div>
                      </td>
                      {/* 規格 */}
                      <td className="py-3 px-3 text-slate-600 font-mono whitespace-nowrap">
                        {firstItem?.spec || '—'}
                      </td>
                      {/* 單位 */}
                      <td className="py-3 px-3 text-center text-slate-600 whitespace-nowrap font-medium">
                        {firstItem?.unit || '式'}
                      </td>
                      {/* 數量 */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                        {firstItem ? Number(firstItem.quantity).toLocaleString() : 0}
                      </td>
                      {/* 單價 */}
                      <td className="py-3 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                        ${firstItem ? Number(firstItem.unitPrice).toLocaleString() : 0}
                      </td>
                      {/* 未稅金額 */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700 tabular-nums whitespace-nowrap">
                        ${r.totalAmount.toLocaleString()}
                      </td>
                      {/* 現場點收狀態 */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {r.status === 'POSTED' && (
                          <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>現場已點收</span>
                          </span>
                        )}
                        {r.status === 'DRAFT' && (
                          <span className="bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded border border-amber-200">
                            待點收草稿
                          </span>
                        )}
                        {r.status === 'VOIDED' && (
                          <span className="bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded border border-slate-300">
                            已作廢
                          </span>
                        )}
                      </td>
                      {/* 操作按鈕 (支援單獨編輯修改) */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 草稿載入極速打單按鈕 */}
                          {canWrite && r.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => onLoadDraftToExcelGrid(r)}
                              className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs border border-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                              title="載入至極速打單工作台連續編輯"
                            >
                              <FileSpreadsheet className="w-3 h-3 text-amber-600" />
                              <span>極速打單</span>
                            </button>
                          )}
                          {/* 單獨點選修改按鈕 */}
                          {canWrite && r.billingStatus !== 'BILLED' && (
                            <button
                              type="button"
                              onClick={() => onOpenEditModal(r)}
                              className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 flex items-center gap-1 cursor-pointer transition-colors"
                              title="單獨修改此進貨簽收單內容"
                            >
                              <Edit className="w-3 h-3" />
                              <span>修改</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onOpenDetailModal(r)}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="檢視詳情"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onPrintReceipt(r)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="列印簽收單"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {r.status === 'DRAFT' && canApprove && (
                            <button
                              type="button"
                              onClick={() => onPostReceipt(r)}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
                              title="確認現場點收簽收"
                            >
                              確認簽收
                            </button>
                          )}

                          {r.status === 'DRAFT' && canWrite && (
                            <button
                              type="button"
                              onClick={() => onOpenDeleteModal(r)}
                              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="刪除草稿"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {r.status === 'POSTED' && r.billingStatus === 'PENDING_BILLING' && canWrite && (
                            <button
                              type="button"
                              onClick={() => onOpenVoidModal(r)}
                              className="px-1.5 py-0.5 text-rose-600 hover:bg-rose-50 rounded text-[11px] border border-rose-200 cursor-pointer"
                              title="作廢單據"
                            >
                              作廢
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* 多項物料展開列 */}
                    {isExpanded && itemsCount > 1 && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={13} className="p-3 pl-12">
                          <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs">
                            <div className="text-[11px] font-bold text-slate-700 mb-2">
                              全部物料清單 ({itemsCount} 項)：
                            </div>
                            <div className="divide-y divide-slate-100 text-xs">
                              {(r.items || []).map((it, idx) => (
                                <div
                                  key={it.id || idx}
                                  className="py-1.5 flex items-center justify-between text-slate-700"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-slate-400">#{idx + 1}</span>
                                    <span className="font-bold text-slate-900">{it.itemName}</span>
                                    <span className="text-slate-500 font-mono">{it.spec || '—'}</span>
                                  </div>
                                  <div className="flex items-center gap-4 font-mono">
                                    <span>
                                      {Number(it.quantity)} {it.unit}
                                    </span>
                                    <span className="text-slate-500">@ ${Number(it.unitPrice).toLocaleString()}</span>
                                    <span className="font-bold text-indigo-700">
                                      ${Number(it.lineTotal).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
