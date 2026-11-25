// src/components/quotations/QuotationMilestonesAndTabs.tsx
// 📑 報價單請款里程碑分期比例、無紙化圖說附件與版本歷程抽屜頁籤內容

import React from 'react';
import { Paperclip, Plus, Trash2 } from 'lucide-react';
import { QuotationBillingMilestone, QuotationRevision } from '../../types/erp';
import { AttachmentUploader } from '../attachments/AttachmentUploader';

interface QuotationMilestonesAndTabsProps {
  activeTab: 'MILESTONES' | 'ATTACHMENTS' | 'VERSIONS';
  quotationId?: string;
  milestones: QuotationBillingMilestone[];
  revisions: QuotationRevision[];
  onChangeMilestones: React.Dispatch<React.SetStateAction<QuotationBillingMilestone[]>>;
}

export const QuotationMilestonesAndTabs: React.FC<QuotationMilestonesAndTabsProps> = ({
  activeTab,
  quotationId,
  milestones,
  revisions,
  onChangeMilestones,
}) => {
  if (activeTab === 'MILESTONES') {
    const totalPct = milestones.reduce((acc, m) => acc + Number(m.percentage || 0), 0);
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900">工程合約請款里程碑分期比例</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              請款比例總和必須嚴格等於 100%，系統自動依含稅總額試算每期應領金額
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const newStage: QuotationBillingMilestone = {
                id: crypto.randomUUID(),
                quotationId: quotationId || '',
                stageIndex: milestones.length + 1,
                stageName: `第 ${milestones.length + 1} 期工程款`,
                percentage: 10,
                amount: 0,
              };
              onChangeMilestones(prev => [...prev, newStage]);
            }}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3 h-3" />
            <span>新增請款階段</span>
          </button>
        </div>

        <div className="space-y-2">
          {milestones.map((ms, idx) => (
            <div
              key={ms.id || idx}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs"
            >
              <span className="font-mono font-bold text-slate-500 w-6 text-center">#{idx + 1}</span>
              <input
                type="text"
                value={ms.stageName}
                onChange={(e) => {
                  const val = e.target.value;
                  onChangeMilestones(prev => prev.map((m, i) => (i === idx ? { ...m, stageName: val } : m)));
                }}
                className="flex-1 px-3 py-1.5 rounded border border-slate-300 font-bold text-slate-800 bg-white"
                placeholder="階段名稱"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={ms.percentage}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    onChangeMilestones(prev => prev.map((m, i) => (i === idx ? { ...m, percentage: val } : m)));
                  }}
                  className="w-16 px-2 py-1.5 rounded border border-slate-300 font-mono tabular-nums font-bold text-right text-indigo-700 bg-white"
                />
                <span className="text-slate-500 font-bold">%</span>
              </div>

              <div className="w-36 text-right font-mono tabular-nums font-bold text-slate-800">
                NT$ {ms.amount.toLocaleString()}
              </div>

              <button
                type="button"
                onClick={() => onChangeMilestones(prev => prev.filter((_, i) => i !== idx))}
                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                title="移除請款階段"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-slate-200">
          <span className="text-xs font-bold text-slate-700">
            目前比例加總：
            <span
              className={`font-mono tabular-nums text-sm ml-1 ${
                Math.abs(totalPct - 100) < 0.01 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'
              }`}
            >
              {totalPct}%
            </span>
          </span>
          <span className="text-xs text-slate-500">必須恰好為 100% 才能定案生效</span>
        </div>
      </div>
    );
  }

  if (activeTab === 'ATTACHMENTS') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div>
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-indigo-600" />
            <span>報價單專屬圖說與施工圖面附件 (Universal Vault - Phase 9)</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            支援上傳 CAD 施工圖面、現場會勘照片與業主需求規範書，內建 WebP 自動壓縮與 PDF 在線預覽
          </p>
        </div>

        <AttachmentUploader
          targetTable="quotations"
          targetId={quotationId || 'NEW_QUOTATION'}
          title="報價單專屬關聯附件與施工圖說"
          defaultCategory="工程圖說"
        />
      </div>
    );
  }

  if (activeTab === 'VERSIONS' && revisions.length > 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold text-slate-900">報價單深拷貝版次演進歷程 (Version History)</h3>
        <div className="space-y-3">
          {revisions.map((rev) => (
            <div
              key={rev.id}
              className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs">
                    {rev.revisionCode}
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {rev.isWinning ? '決選得標版' : '歷史修訂版'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  建立時間：{rev.createdAt ? rev.createdAt.substring(0, 19).replace('T', ' ') : '—'}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                  NT$ {rev.totalAmount.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500">
                  {rev.pricingMode === 'HEADER_DISCOUNT' && '表頭折讓流'}
                  {rev.pricingMode === 'UNIT_PRICE_ADJUSTMENT' && '單價微調流'}
                  {rev.pricingMode === 'SHADOW_ALLOCATION' && '影子協議流'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};
