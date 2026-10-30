import React, { useState, useMemo } from 'react';
import {
  X,
  PackageCheck,
  Building2,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Receipt,
  DollarSign,
  CheckCircle2,
  Clock,
  FileText
} from 'lucide-react';
import { Project, InboundReceipt } from '../../types/erp';
import { getProjectPartnerBillingSummary } from '../../db/sqlite';

interface ProjectVendorInboundModalProps {
  isOpen: boolean;
  project: Project;
  partnerId: string;
  partnerName: string;
  workScope?: string;
  estimatedAmount?: number;
  onClose: () => void;
}

export const ProjectVendorInboundModal: React.FC<ProjectVendorInboundModalProps> = ({
  isOpen,
  project,
  partnerId,
  partnerName,
  workScope = '',
  estimatedAmount = 0,
  onClose
}) => {
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);

  // 調取本案場 + 本廠商專屬進料與計價統計 (只讀取，不修改任何單據)
  const summary = useMemo(() => {
    if (!isOpen || !project.id || !partnerId) return null;
    return getProjectPartnerBillingSummary(project.id, partnerId, estimatedAmount, workScope, partnerName);
  }, [isOpen, project.id, partnerId, estimatedAmount, workScope, partnerName]);

  if (!isOpen || !summary) return null;

  const toggleExpand = (id: string) => {
    setExpandedReceiptId(prev => prev === id ? null : id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                  {project.projectCode}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {project.name}
                </span>
                {workScope && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                    {workScope}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                <span>{summary.partnerName}</span>
                <span className="text-xs font-normal text-slate-400 font-mono">
                  (夥伴代碼: {partnerId})
                </span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 內容區塊 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* 四大 KPI 彙總卡片 (預估發包、已進貨、已請款、待請款差額) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. 案場預估發包金額 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>案場預估發包額度</span>
              </div>
              <div className="text-base font-bold text-slate-800 font-mono mt-1">
                NT$ {summary.estimatedAmount.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                本案場初始預算編列
              </div>
            </div>

            {/* 2. 累計已進貨簽收金額 */}
            <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-3.5">
              <div className="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
                <PackageCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>累計已進料簽收 (進貨端)</span>
              </div>
              <div className="text-base font-bold text-blue-700 font-mono mt-1">
                NT$ {summary.totalInboundAmount.toLocaleString()}
              </div>
              <div className="text-[10px] text-blue-600/80 mt-1">
                共 {summary.receiptCount} 筆簽收單據
              </div>
            </div>

            {/* 3. 累計已計價請款金額 */}
            <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-3.5">
              <div className="text-[11px] text-purple-700 font-semibold flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-purple-600" />
                <span>累計已計價請款</span>
              </div>
              <div className="text-base font-bold text-purple-700 font-mono mt-1">
                NT$ {summary.billedInboundAmount.toLocaleString()}
              </div>
              <div className="text-[10px] text-purple-600/80 mt-1">
                廠商已送請款/對帳總額
              </div>
            </div>

            {/* 4. 待請款金額 (已進貨 - 已請款) 解決忘記請款問題！ */}
            <div className={`rounded-xl p-3.5 border ${
              summary.pendingBillingAmount > 0
                ? 'bg-rose-50 border-rose-300'
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="text-[11px] font-semibold flex items-center gap-1">
                {summary.pendingBillingAmount > 0 ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span className="text-rose-800">⚠️ 尚有進貨未請款 (待請款)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-800">進貨已全數請款</span>
                  </>
                )}
              </div>
              <div className={`text-base font-bold font-mono mt-1 ${
                summary.pendingBillingAmount > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                NT$ {summary.pendingBillingAmount.toLocaleString()}
              </div>
              <div className="text-[10px] mt-1 font-medium">
                {summary.pendingBillingAmount > 0 ? (
                  <span className="text-rose-600">
                    尚有 {summary.pendingReceiptCount} 筆進貨簽收單未轉請款
                  </span>
                ) : (
                  <span className="text-emerald-600">進貨簽收單無遺漏</span>
                )}
              </div>
            </div>
          </div>

          {/* 狀態說明橫幅 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">即時請款勾稽狀態：</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                summary.statusLabel === 'PENDING_BILLING'
                  ? 'bg-rose-100 text-rose-700 border border-rose-300'
                  : summary.statusLabel === 'PENDING_PAYMENT'
                  ? 'bg-amber-100 text-amber-700 border border-amber-300'
                  : summary.statusLabel === 'FULLY_SETTLED'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  : 'bg-slate-100 text-slate-600 border border-slate-300'
              }`}>
                {summary.statusText}
              </span>
            </div>

            <div className="text-[11px] text-slate-500">
              已撥款支付：<span className="font-mono font-bold text-slate-800">NT$ {summary.totalPaidAmount.toLocaleString()}</span>
              {summary.unpaidBalance > 0 && (
                <span className="ml-2 text-amber-600 font-medium">
                  (待放行: NT$ {summary.unpaidBalance.toLocaleString()})
                </span>
              )}
            </div>
          </div>

          {/* 本案場進貨明細清單 (嚴格僅顯示本案場，徹底隔離其他案場) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>此協力廠商於【{project.name}】之進貨簽收明細單據 (共 {summary.receipts.length} 筆)</span>
              </div>
              <span className="text-[11px] text-slate-400">
                點擊單據可展開各材料明細項次
              </span>
            </div>

            {summary.receipts.length === 0 ? (
              <div className="border border-slate-200 rounded-xl p-8 text-center text-slate-400 bg-slate-50/50">
                <PackageCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-medium">此廠商於本案場目前尚無任何進貨簽收單據記錄</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  後續於「材料進貨簽收」模組登記屬於本案場之進料時，將自動在此處同步彙整
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                {summary.receipts.map(receipt => {
                  const isExpanded = expandedReceiptId === receipt.id;
                  const isBilled = receipt.billingStatus === 'BILLED';

                  return (
                    <div key={receipt.id} className="bg-white hover:bg-slate-50/60 transition-colors">
                      {/* 單據摘要列 */}
                      <div
                        onClick={() => toggleExpand(receipt.id)}
                        className="p-3.5 flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="text-slate-400 hover:text-slate-600"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-800">
                                {receipt.receiptNumber}
                              </span>
                              {receipt.deliveryNoteNumber && (
                                <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-mono">
                                  隨貨單: {receipt.deliveryNoteNumber}
                                </span>
                              )}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                isBilled
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {isBilled ? '✓ 已計價請款' : '⚠️ 尚未請款 (待請款)'}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                              <span className="flex items-center gap-1 font-mono">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {receipt.receivedDate}
                              </span>
                              <span>
                                點收人: <strong className="text-slate-700">{receipt.receivedBy || '工地主任'}</strong>
                              </span>
                              <span>
                                材料項數: <strong className="text-slate-700">{receipt.items?.length || 0} 項</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-bold text-slate-900 text-sm">
                            NT$ {receipt.totalAmount.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {isBilled ? '已完成對帳審核' : '未轉請款單'}
                          </div>
                        </div>
                      </div>

                      {/* 展開之材料明細表 */}
                      {isExpanded && (
                        <div className="px-5 pb-3.5 pt-1 bg-slate-50/80 border-t border-slate-100 animate-in fade-in">
                          <div className="text-[11px] font-bold text-slate-600 mb-1.5">
                            進料明細清單：
                          </div>
                          {(!receipt.items || receipt.items.length === 0) ? (
                            <div className="text-slate-400 text-center py-2">無材料明細</div>
                          ) : (
                            <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden bg-white">
                              <thead className="bg-slate-100 text-[10px] text-slate-500 font-semibold border-b border-slate-200">
                                <tr>
                                  <th className="py-1.5 px-3">品名</th>
                                  <th className="py-1.5 px-3">規格尺寸</th>
                                  <th className="py-1.5 px-3 text-right">數量</th>
                                  <th className="py-1.5 px-3 text-center">單位</th>
                                  <th className="py-1.5 px-3 text-right">單價 (NT$)</th>
                                  <th className="py-1.5 px-3 text-right">小計複價 (NT$)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-[11px]">
                                {receipt.items.map((item, idx) => (
                                  <tr key={item.id || idx} className="hover:bg-slate-50/50">
                                    <td className="py-1.5 px-3 font-semibold text-slate-800">
                                      {item.itemName}
                                    </td>
                                    <td className="py-1.5 px-3 text-slate-500 font-mono">
                                      {item.spec || '-'}
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-700">
                                      {item.quantity?.toLocaleString()}
                                    </td>
                                    <td className="py-1.5 px-3 text-center text-slate-500">
                                      {item.unit}
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-mono text-slate-600">
                                      {item.unitPrice?.toLocaleString()}
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                                      {item.lineTotal?.toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 底部按鈕 */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="text-[11px] text-slate-500">
            💡 此處為即時跨模組調閱，僅呈現在【{project.name}】的貨物，其他案場之進貨已自動隔離
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 transition-colors cursor-pointer"
          >
            關閉檢視
          </button>
        </div>
      </div>
    </div>
  );
};
