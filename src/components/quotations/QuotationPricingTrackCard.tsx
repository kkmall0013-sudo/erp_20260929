// src/components/quotations/QuotationPricingTrackCard.tsx
// 🎛️ 報價單三軌並行議價控制樞紐 (表頭折讓流 / 單價微調流 / 影子協議備註流)

import React, { useState } from 'react';
import { Calculator, Sliders, Sparkles, TrendingDown, X } from 'lucide-react';
import { Quotation, QuotationPricingMode } from '../../types/erp';

interface QuotationPricingTrackCardProps {
  pricingMode: QuotationPricingMode;
  discountAmount: number;
  agreedTotalAmount?: number;
  customDiscountText?: string;
  rawSubtotal: number;
  computedNetAmount: number;
  onChangeFormData: (updates: Partial<Quotation>) => void;
  onAutoAdjustUnitPrices: (targetNetAmount: number) => void;
}

export const QuotationPricingTrackCard: React.FC<QuotationPricingTrackCardProps> = ({
  pricingMode,
  discountAmount,
  agreedTotalAmount,
  customDiscountText,
  rawSubtotal,
  computedNetAmount,
  onChangeFormData,
  onAutoAdjustUnitPrices,
}) => {
  const [showTargetAdjuster, setShowTargetAdjuster] = useState(false);
  const [targetNetInput, setTargetNetInput] = useState<string>('');

  const handleApplyTargetNet = () => {
    const cleanNum = Math.round(Number(targetNetInput.replace(/,/g, '').trim()));
    if (!Number.isFinite(cleanNum) || cleanNum <= 0) return;
    onAutoAdjustUnitPrices(cleanNum);
    setShowTargetAdjuster(false);
    setTargetNetInput('');
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-indigo-600" />
          <span>三軌並行議價控制樞紐 (Sales Negotiation Track)</span>
        </span>
        <span className="text-[11px] text-slate-400">
          依業主談判心理與驗算習慣，即時切換出單模式
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 軌道一：表頭折讓流 */}
        <button
          type="button"
          onClick={() => onChangeFormData({ pricingMode: 'HEADER_DISCOUNT' })}
          className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
            pricingMode === 'HEADER_DISCOUNT'
              ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-xs text-indigo-950 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-indigo-600" />
              <span>軌道一：表頭折讓流</span>
            </span>
            {pricingMode === 'HEADER_DISCOUNT' && (
              <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded font-bold">
                當前啟用
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            工項明細維持原價，紙本報價單最下方印出「協議折讓：-X 元」。適合喜歡看自己砍了多少價的業主。
          </p>
        </button>

        {/* 軌道二：單價微調流 */}
        <button
          type="button"
          onClick={() => onChangeFormData({ pricingMode: 'UNIT_PRICE_ADJUSTMENT' })}
          className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
            pricingMode === 'UNIT_PRICE_ADJUSTMENT'
              ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-xs text-indigo-950 flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5 text-emerald-600" />
              <span>軌道二：單價微調流</span>
            </span>
            {pricingMode === 'UNIT_PRICE_ADJUSTMENT' && (
              <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded font-bold">
                當前啟用
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            反推並改寫各工項單價，紙本完全不出現折讓字眼。適合要求每行乘積與總價絕對吻合之嚴謹業主。
          </p>
        </button>

        {/* 軌道三：影子均攤流 */}
        <button
          type="button"
          onClick={() => onChangeFormData({ pricingMode: 'SHADOW_ALLOCATION' })}
          className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
            pricingMode === 'SHADOW_ALLOCATION'
              ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-xs text-indigo-950 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>軌道三：影子協議備註流</span>
            </span>
            {pricingMode === 'SHADOW_ALLOCATION' && (
              <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded font-bold">
                當前啟用
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            明細與總計維持原價，於下方備註印出「協議總價」。適合現場常見的總價發包、不改明細快速成交情境。
          </p>
        </button>
      </div>

      {/* 軌道特殊設定輸入 */}
      {pricingMode === 'HEADER_DISCOUNT' && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-700">表頭折讓優惠金額 (折讓金)：</span>
          <div className="flex items-center gap-1">
            <span className="text-xs font-mono font-bold text-slate-500">NT$</span>
            <input
              type="number"
              min="0"
              value={discountAmount || 0}
              onChange={(e) =>
                onChangeFormData({ discountAmount: Math.max(0, Number(e.target.value)) })
              }
              className="w-36 px-2.5 py-1 rounded border border-slate-300 text-xs font-mono tabular-nums font-bold text-rose-600 focus:ring-1 focus:ring-indigo-500 outline-none"
              placeholder="輸入折讓額"
            />
          </div>
          <span className="text-[11px] text-slate-400 font-mono tabular-nums">
            折讓後應稅淨額：NT$ {computedNetAmount.toLocaleString()}
          </span>
        </div>
      )}

      {pricingMode === 'UNIT_PRICE_ADJUSTMENT' && (
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-600">
              目前各工項乘積加總淨額為：
              <strong className="font-mono tabular-nums text-slate-900 ml-1">
                NT$ {rawSubtotal.toLocaleString()}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setTargetNetInput(String(Math.max(0, rawSubtotal)));
                setShowTargetAdjuster(prev => !prev);
              }}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>自動目標總價均攤小幫手</span>
            </button>
          </div>

          {showTargetAdjuster && (
            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
              <span className="font-bold text-emerald-900">期望之未稅目標淨額 (NT$)：</span>
              <input
                type="number"
                min="1"
                value={targetNetInput}
                onChange={(e) => setTargetNetInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyTargetNet();
                  }
                }}
                placeholder="例如 550000"
                className="w-40 px-2.5 py-1 rounded border border-emerald-300 bg-white font-mono tabular-nums font-bold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleApplyTargetNet}
                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              >
                套用反推單價
              </button>
              <button
                type="button"
                onClick={() => setShowTargetAdjuster(false)}
                className="p-1 rounded text-slate-500 hover:text-slate-700 cursor-pointer"
                title="關閉"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {pricingMode === 'SHADOW_ALLOCATION' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              約定含稅總成交金額 (NTD)：
            </label>
            <input
              type="number"
              min="0"
              value={agreedTotalAmount || ''}
              onChange={(e) =>
                onChangeFormData({ agreedTotalAmount: Number(e.target.value) })
              }
              placeholder="例如 150000"
              className="w-full px-3 py-1.5 rounded border border-slate-300 text-xs font-mono tabular-nums font-bold text-indigo-700 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              紙本印出協議備註文字：
            </label>
            <input
              type="text"
              value={customDiscountText || ''}
              onChange={(e) =>
                onChangeFormData({ customDiscountText: e.target.value })
              }
              placeholder="經雙方協議同意以 150,000 承製"
              className="w-full px-3 py-1.5 rounded border border-slate-300 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};
