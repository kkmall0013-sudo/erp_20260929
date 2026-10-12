import React, { useState } from 'react';
import { Quotation, QuotationItem, QuotationBillingMilestone, Company, BusinessPartner, Project } from '../../types/erp';
import { Printer, Download, Eye, ShieldCheck, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';

interface QuotationPrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation;
  items: QuotationItem[];
  milestones: QuotationBillingMilestone[];
  company?: Company;
  customer?: BusinessPartner;
  project?: Project;
}

export const QuotationPrintPreviewModal: React.FC<QuotationPrintPreviewModalProps> = ({
  isOpen,
  onClose,
  quotation,
  items,
  milestones,
  company,
  customer,
  project,
}) => {
  if (!isOpen) return null;

  const awardedItems = items.filter(it => it.isAwarded !== false);
  const isHeaderDiscount = (quotation.pricingMode || 'HEADER_DISCOUNT') === 'HEADER_DISCOUNT';
  const isUnitPriceAdjust = quotation.pricingMode === 'UNIT_PRICE_ADJUSTMENT';
  const isShadowAllocation = quotation.pricingMode === 'SHADOW_ALLOCATION';

  const subtotalBeforeDiscount = awardedItems.reduce((acc, it) => {
    if (it.itemType === 'DEDUCTION') {
      return acc - Math.round(it.quantity * it.unitPrice);
    }
    return acc + Math.round(it.quantity * it.unitPrice);
  }, 0);

  const displayDiscount = isHeaderDiscount ? (quotation.discountAmount || 0) : 0;
  const netAmount = Math.round(quotation.netAmount);
  const taxAmount = Math.round(quotation.taxAmount);
  const totalAmount = Math.round(quotation.totalAmount);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* 頂部操作導航 */}
        <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Printer className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold tracking-wide">
                工程報價單正式列印與簽署預覽 (PDF Print Preview)
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <span className="font-mono">{quotation.quoteNumber}</span>
                <span>•</span>
                <span className="text-amber-300 font-medium">
                  {isHeaderDiscount && '軌道一：表頭折讓模式 (明細原價，印出協議折讓行)'}
                  {isUnitPriceAdjust && '軌道二：單價微調模式 (明細單價已平滑，無折讓字眼)'}
                  {isShadowAllocation && '軌道三：影子協議模式 (明細原價，附協議總價文字備註)'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>列印 / 存為 PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              關閉
            </button>
          </div>
        </div>

        {/* 預覽紙張本體 (A4 紙張排版風格) */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center">
          <div className="bg-white w-full max-w-[800px] p-8 rounded-lg shadow-sm border border-slate-300 text-slate-900 print:shadow-none print:border-none print:p-0">
            {/* 公司表頭資訊 */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-bold tracking-wider text-slate-900">
                    {company?.name || '工程事業股份有限公司'}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    統一編號：<span className="font-mono">{company?.taxId || '88888888'}</span> ｜ 幣別：{quotation.currency || 'TWD'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-slate-900 text-white font-bold text-sm px-3 py-1 rounded">
                    工 程 報 價 單
                  </span>
                  <p className="text-xs font-mono font-bold text-slate-700 mt-1">
                    單號：{quotation.quoteNumber} (v{quotation.currentRevision})
                  </p>
                </div>
              </div>
            </div>

            {/* 買賣雙方與專案資訊 */}
            <div className="grid grid-cols-2 gap-4 text-xs mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="space-y-1.5">
                <div>
                  <span className="text-slate-500">業主名稱 (客戶)：</span>
                  <strong className="text-slate-800 text-sm ml-1">
                    {quotation.customerName || customer?.name || '無'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">統一編號：</span>
                  <span className="font-mono text-slate-700 ml-1">
                    {customer?.taxId || '無'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">聯絡窗口：</span>
                  <span className="text-slate-700 ml-1">{customer?.contactPerson || '無'}</span>
                </div>
                <div>
                  <span className="text-slate-500">通訊地址：</span>
                  <span className="text-slate-700 ml-1">{customer?.address || '無'}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div>
                  <span className="text-slate-500">專案案場：</span>
                  <strong className="text-slate-800 text-sm ml-1">
                    {project?.name || '一般委外工程'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">報價日期：</span>
                  <span className="font-mono text-slate-700 ml-1">
                    {quotation.createdAt ? quotation.createdAt.substring(0, 10) : new Date().toISOString().substring(0, 10)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">有效期限：</span>
                  <span className="font-mono text-slate-700 ml-1">
                    {quotation.validityDate || '報價日起算 30 天內有效'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">付款條件：</span>
                  <span className="text-slate-700 ml-1">依雙方工程承攬里程碑請款</span>
                </div>
              </div>
            </div>

            {/* 工項明細清單 */}
            <div className="mb-6">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="py-2 px-2 text-center w-10">項次</th>
                    <th className="py-2 px-3 text-left">工項名稱與施工規範說明</th>
                    <th className="py-2 px-2 text-right w-16">數量</th>
                    <th className="py-2 px-2 text-center w-12">單位</th>
                    <th className="py-2 px-3 text-right w-24">單價 (元)</th>
                    <th className="py-2 px-3 text-right w-28">複價金額 (元)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {awardedItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        目前尚無工項明細
                      </td>
                    </tr>
                  ) : (
                    awardedItems.map((item, idx) => {
                      const isDeduction = item.itemType === 'DEDUCTION';
                      const itemSubtotal = Math.round(item.quantity * item.unitPrice);
                      return (
                        <tr
                          key={item.id || idx}
                          className={isDeduction ? 'bg-rose-50/50' : 'hover:bg-slate-50'}
                        >
                          <td className="py-2 px-2 text-center font-mono text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              {isDeduction && (
                                <span className="bg-rose-100 text-rose-700 text-[10px] px-1 rounded font-semibold">
                                  扣減項
                                </span>
                              )}
                              <span>{item.itemName}</span>
                            </div>
                            {item.spec && (
                              <div className="text-[11px] text-slate-500 mt-0.5">{item.spec}</div>
                            )}
                            {item.remark && (
                              <div className="text-[10px] text-slate-400 italic">{item.remark}</div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-700">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-600">{item.unit}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-slate-700">
                            {item.unitPrice.toLocaleString()}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${isDeduction ? 'text-rose-600' : 'text-slate-900'}`}>
                            {isDeduction ? `- ${itemSubtotal.toLocaleString()}` : itemSubtotal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 金額統計與折讓展示 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 pt-2 border-t border-slate-300">
              {/* 左側備註與條款 */}
              <div className="space-y-3 text-[11px] text-slate-600">
                <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-800">【報價協議與特別約定】</div>
                  {isShadowAllocation && quotation.customDiscountText ? (
                    <div className="p-2 bg-indigo-50 border border-indigo-200 rounded text-indigo-900 font-bold text-xs mt-1">
                      特別協議：{quotation.customDiscountText}
                    </div>
                  ) : null}
                  <p>1. 本報價單經雙方簽章確認後視同正式合約生效。</p>
                  <p>2. 工程施工範圍以外之追加減工項，需經雙方書面確認後依有效單價計價辦理。</p>
                  <p>3. 報價單所有金額均依政府法規依法開立統一發票。</p>
                </div>

                {/* 里程碑請款明細 */}
                {milestones.length > 0 && (
                  <div>
                    <div className="font-bold text-slate-700 mb-1">【預定請款階段與里程碑】</div>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      {milestones.map((m, idx) => (
                        <div key={m.id || idx} className="flex justify-between bg-white px-2 py-1 rounded border border-slate-200">
                          <span>{m.stageName} ({m.percentage}%)</span>
                          <span className="font-mono font-bold">NT$ {m.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 右側金額彙整四柱 */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>明細小計合計：</span>
                  <span className="font-mono text-slate-800 font-bold">
                    NT$ {subtotalBeforeDiscount.toLocaleString()}
                  </span>
                </div>

                {/* 軌道一顯示專屬表頭折讓 */}
                {isHeaderDiscount && displayDiscount > 0 && (
                  <div className="flex justify-between items-center text-rose-600 bg-rose-50/80 px-2 py-1 rounded border border-rose-200">
                    <span className="font-bold">專案商議折讓優惠 (Discount)：</span>
                    <span className="font-mono font-bold">
                      - NT$ {displayDiscount.toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-700 font-medium">
                  <span>應稅淨額 (未稅)：</span>
                  <span className="font-mono font-bold text-slate-900">
                    NT$ {netAmount.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-700">
                  <span>營業稅 (5%)：</span>
                  <span className="font-mono text-slate-800">
                    NT$ {taxAmount.toLocaleString()}
                  </span>
                </div>

                <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-baseline">
                  <span className="font-bold text-sm text-slate-900">報價總計 (含稅)：</span>
                  <span className="text-xl font-bold font-mono text-indigo-700">
                    NT$ {totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* 雙方簽署確認蓋章欄 */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 text-xs">
              <div className="space-y-8">
                <div>
                  <span className="text-slate-500">承攬廠商 (報價方)：</span>
                  <strong className="text-slate-900 ml-1">{company?.name || '本公司'}</strong>
                </div>
                <div className="border-b border-dashed border-slate-400 pb-1 flex justify-between items-end">
                  <span className="text-slate-400">公司用印 / 負責人簽章：</span>
                  <span className="text-slate-400 font-mono text-[10px]">年　　月　　日</span>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <span className="text-slate-500">定作業主 (簽認方)：</span>
                  <strong className="text-slate-900 ml-1">
                    {quotation.customerName || customer?.name || '業主確認'}
                  </strong>
                </div>
                <div className="border-b border-dashed border-slate-400 pb-1 flex justify-between items-end">
                  <span className="text-slate-400">業主簽署 / 統一發票章：</span>
                  <span className="text-slate-400 font-mono text-[10px]">年　　月　　日</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
