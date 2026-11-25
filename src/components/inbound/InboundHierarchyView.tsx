// src/components/inbound/InboundHierarchyView.tsx
// 🏢 現場進貨簽收工作台：以供貨廠商為目錄之手風琴階層檢視 (含小計與 5% 預估稅金)

import React from 'react';
import {
  Truck,
  Building2,
  CheckCircle2,
  Eye,
  Trash2,
  Edit,
  ChevronRight,
  ChevronDown,
  Printer,
  FileSpreadsheet,
  FolderTree,
} from 'lucide-react';
import { InboundReceipt } from '../../types/erp';
import { ReceiptProjectInfo, VendorHierarchyGroup } from './inboundWorkspaceUtils';

export interface InboundHierarchyViewProps {
  vendorHierarchyGroups: VendorHierarchyGroup[];
  filteredReceiptsCount: number;
  expandedVendorIds: Set<string>;
  canWrite: boolean;
  getReceiptProjectInfo: (r: InboundReceipt) => ReceiptProjectInfo;
  onToggleAllVendors: () => void;
  onToggleVendor: (vendorId: string) => void;
  onLoadDraftToExcelGrid: (r: InboundReceipt) => void;
  onOpenEditModal: (r: InboundReceipt) => void;
  onOpenDetailModal: (r: InboundReceipt) => void;
  onPrintReceipt: (r: InboundReceipt) => void;
  onOpenVoidModal: (r: InboundReceipt) => void;
}

export const InboundHierarchyView: React.FC<InboundHierarchyViewProps> = ({
  vendorHierarchyGroups,
  filteredReceiptsCount,
  expandedVendorIds,
  canWrite,
  getReceiptProjectInfo,
  onToggleAllVendors,
  onToggleVendor,
  onLoadDraftToExcelGrid,
  onOpenEditModal,
  onOpenDetailModal,
  onPrintReceipt,
  onOpenVoidModal,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-purple-50/40">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-purple-700" />
          <span className="text-xs font-bold text-slate-800">
            以供貨公司為目錄之進貨階層清冊
          </span>
          <span className="text-xs text-purple-700 font-mono font-bold">
            (共 {vendorHierarchyGroups.length} 家供料商 · {filteredReceiptsCount} 筆簽收單)
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={onToggleAllVendors}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-slate-700 font-medium cursor-pointer transition-colors"
          >
            {expandedVendorIds.size === vendorHierarchyGroups.length && vendorHierarchyGroups.length > 0
              ? '全部收合'
              : '全部展開目錄'}
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {vendorHierarchyGroups.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">該日期區間無符合條件的供料廠商與進貨單</p>
            <p className="text-xs text-slate-400 mt-1">
              請更換上方篩選日期或點選右上角「📊 極速進貨打單」開始建單
            </p>
          </div>
        ) : (
          vendorHierarchyGroups.map(group => {
            const isExpanded = expandedVendorIds.has(group.vendorId);

            return (
              <div key={group.vendorId} className="transition-colors">
                {/* 廠商目錄列 (點選即可收合 / 展開該公司進貨明細) */}
                <div
                  onClick={() => onToggleVendor(group.vendorId)}
                  className={`px-5 py-3 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                    isExpanded ? 'bg-purple-50/70 border-b border-purple-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="p-1 rounded text-purple-700 hover:bg-purple-100 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-purple-700" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                    <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{group.vendorName}</span>
                        {group.vendorTaxId && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded">
                            統編: {group.vendorTaxId}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        本期進貨 <strong className="text-slate-800">{group.receipts.length}</strong> 筆簽收單 · 共{' '}
                        <strong className="text-slate-800">{group.itemsCount}</strong> 項材料
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-sans">預計未稅金額</span>
                      <span className="font-bold text-slate-800 text-sm">
                        ${group.subtotal.toLocaleString()}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-sans">預計稅金 (5%)</span>
                      <span className="font-bold text-amber-700">
                        ${group.tax.toLocaleString()}
                      </span>
                    </div>

                    <div className="text-right bg-white px-2.5 py-1 rounded border border-purple-200">
                      <span className="text-[10px] text-purple-700 block font-sans font-bold">預計含稅總額</span>
                      <span className="font-bold text-purple-900 text-sm">
                        ${group.grandTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 展開之廠商進貨明細清單 (如同拿到月結請款對帳單，平整化條列該廠商本期進貨品項) */}
                {isExpanded && (
                  <div className="p-0 border-t border-purple-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                          <tr className="divide-x divide-slate-200">
                            <th className="py-2.5 px-3 w-12 text-center font-bold">序</th>
                            <th className="py-2.5 px-3 w-28 text-center font-bold">進貨日期</th>
                            <th className="py-2.5 px-3 w-40 font-bold">送貨單號 / 系統單號</th>
                            <th className="py-2.5 px-3 min-w-[150px] font-bold">歸屬案場</th>
                            <th className="py-2.5 px-3 min-w-[160px] font-bold">材料品名</th>
                            <th className="py-2.5 px-3 min-w-[120px] font-bold">規格型號</th>
                            <th className="py-2.5 px-3 w-16 text-center font-bold">單位</th>
                            <th className="py-2.5 px-3 w-24 text-right font-bold">進貨數量</th>
                            <th className="py-2.5 px-3 w-28 text-right font-bold">預計單價</th>
                            <th className="py-2.5 px-3 w-32 text-right font-bold bg-purple-50 text-purple-900">未稅金額</th>
                            <th className="py-2.5 px-3 w-28 text-center font-bold">點收狀態</th>
                            <th className="py-2.5 px-3 min-w-[120px] font-bold">備註說明</th>
                            <th className="py-2.5 px-3 w-28 text-center font-bold">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(() => {
                            let itemCounter = 0;
                            return group.receipts.flatMap(r => {
                              const items =
                                r.items && r.items.length > 0
                                  ? r.items
                                  : [
                                      {
                                        id: `empty-${r.id}`,
                                        itemName: '現場一般料件',
                                        spec: '—',
                                        unit: '批',
                                        quantity: 1,
                                        unitPrice: r.totalAmount || 0,
                                        lineTotal: r.totalAmount || 0,
                                        notes: r.notes || '',
                                      },
                                    ];

                              return items.map((it, itIdx) => {
                                itemCounter += 1;
                                const currentSeq = itemCounter;
                                const lineAmt =
                                  Number(it.lineTotal) || Number(it.quantity) * Number(it.unitPrice);

                                return (
                                  <tr
                                    key={`${r.id}-${it.id || itIdx}`}
                                    className="hover:bg-purple-50/40 transition-colors divide-x divide-slate-100 text-slate-800"
                                  >
                                    <td className="py-2 px-3 text-center font-mono text-slate-400">
                                      {currentSeq}
                                    </td>
                                    <td className="py-2 px-3 text-center font-mono text-slate-700 whitespace-nowrap">
                                      {r.receivedDate}
                                    </td>
                                    <td className="py-2 px-3">
                                      <div className="font-mono font-bold text-slate-900">
                                        {r.deliveryNoteNumber}
                                      </div>
                                      <div className="text-[10px] font-mono text-slate-400">
                                        {r.receiptNumber}
                                      </div>
                                    </td>
                                    <td className="py-2 px-3">
                                      {(() => {
                                        const prjInfo = getReceiptProjectInfo(r);
                                        return (
                                          <div>
                                            <div className="font-bold text-indigo-700">{prjInfo.name}</div>
                                            {prjInfo.code && (
                                              <div className="text-[10px] font-mono text-slate-500">
                                                代碼: {prjInfo.code}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td className="py-2 px-3 font-bold text-slate-900">
                                      {it.itemName}
                                    </td>
                                    <td className="py-2 px-3 font-mono text-slate-600">
                                      {it.spec || '—'}
                                    </td>
                                    <td className="py-2 px-3 text-center font-medium text-slate-700">
                                      {it.unit || '式'}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                      {Number(it.quantity).toLocaleString()}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-slate-600">
                                      ${Number(it.unitPrice).toLocaleString()}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-purple-900 bg-purple-50/20">
                                      ${lineAmt.toLocaleString()}
                                    </td>
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                      {r.status === 'POSTED' && (
                                        <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200 text-[10px] inline-flex items-center gap-0.5">
                                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                          <span>已點收</span>
                                        </span>
                                      )}
                                      {r.status === 'DRAFT' && (
                                        <span className="bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                                          草稿
                                        </span>
                                      )}
                                      {r.status === 'VOIDED' && (
                                        <span className="bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded border border-slate-300 text-[10px]">
                                          已作廢
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-slate-500 text-xs">
                                      {it.notes || r.notes || '—'}
                                    </td>
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                      <div className="flex items-center justify-center gap-1">
                                        {canWrite && r.status === 'DRAFT' && (
                                          <button
                                            type="button"
                                            onClick={() => onLoadDraftToExcelGrid(r)}
                                            className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs border border-amber-300 flex items-center gap-0.5 cursor-pointer transition-colors"
                                            title="載入至仿 Excel 極速打單工作台連續編輯"
                                          >
                                            <FileSpreadsheet className="w-3 h-3 text-amber-600" />
                                            <span>極速打單</span>
                                          </button>
                                        )}
                                        {canWrite && r.billingStatus !== 'BILLED' && (
                                          <button
                                            type="button"
                                            onClick={() => onOpenEditModal(r)}
                                            className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 flex items-center gap-0.5 cursor-pointer transition-colors"
                                            title="修改此進貨簽收單 (料件/單價/數量/案場)"
                                          >
                                            <Edit className="w-3 h-3" />
                                            <span>修改</span>
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => onOpenDetailModal(r)}
                                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                          title="查看單據詳情"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onPrintReceipt(r)}
                                          className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                          title="列印現場簽收單"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                        </button>
                                        {canWrite && r.billingStatus !== 'BILLED' && r.status !== 'VOIDED' && (
                                          <button
                                            type="button"
                                            onClick={() => onOpenVoidModal(r)}
                                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                            title="作廢"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              });
                            });
                          })()}
                        </tbody>
                        <tfoot className="bg-purple-50/70 border-t-2 border-purple-200 text-xs font-bold font-mono">
                          <tr>
                            <td colSpan={7} className="py-3 px-4 text-slate-800 font-sans">
                              <span>
                                【{group.vendorName}】本期進貨小計（共 {group.receipts.length} 筆單據 · {group.itemsCount} 項物料）
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right text-slate-600">—</td>
                            <td className="py-3 px-3 text-right text-slate-600 font-sans">未稅小計:</td>
                            <td className="py-3 px-3 text-right text-purple-900 text-sm">
                              ${group.subtotal.toLocaleString()}
                            </td>
                            <td colSpan={3} className="py-3 px-4 text-slate-700 text-[11px] font-sans font-normal">
                              <span>
                                預估稅金 5%: <strong className="text-amber-800 font-bold">${group.tax.toLocaleString()}</strong> ｜ 預計含稅總額:{' '}
                                <strong className="text-purple-900 font-bold text-xs">${group.grandTotal.toLocaleString()}</strong>
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
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
