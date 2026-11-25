// src/components/quotations/QuotationItemsTable.tsx
// 📋 報價單工項明細清單表格 (支援標準加項、粉紅扣款折讓與部分得標開關)

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { QuotationItem } from '../../types/erp';

interface QuotationItemsTableProps {
  items: QuotationItem[];
  onAddItem: (type: 'NORMAL' | 'DEDUCTION') => void;
  onUpdateItem: (index: number, field: keyof QuotationItem, val: any) => void;
  onDeleteItem: (index: number) => void;
}

export const QuotationItemsTable: React.FC<QuotationItemsTableProps> = ({
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">工項明細表</span>
          <span className="text-[11px] text-slate-500">
            支援【標準加項】與【粉紅扣款折讓】雙軌輸入，減項強制以正數存儲防弊
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAddItem('NORMAL')}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3 h-3" />
            <span>新增標準加項</span>
          </button>
          <button
            type="button"
            onClick={() => onAddItem('DEDUCTION')}
            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3 h-3" />
            <span>新增折讓扣減項 (Pink UI)</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 text-center w-12">得標</th>
              <th className="py-2.5 px-3 text-left w-24">工項類型</th>
              <th className="py-2.5 px-3 text-left">工項名稱</th>
              <th className="py-2.5 px-3 text-left w-48">施工規格說明</th>
              <th className="py-2.5 px-2 text-right w-20">數量</th>
              <th className="py-2.5 px-2 text-center w-16">單位</th>
              <th className="py-2.5 px-2 text-right w-24">單價 (元)</th>
              <th className="py-2.5 px-2 text-right w-28">複價金額</th>
              <th className="py-2.5 px-2 text-center w-12">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item, idx) => {
              const isDeduction = item.itemType === 'DEDUCTION';
              const isAwarded = item.isAwarded !== false;
              const lineAmount = Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));

              return (
                <tr
                  key={item.id || idx}
                  className={`transition-colors ${
                    !isAwarded
                      ? 'bg-slate-100 text-slate-400 line-through'
                      : isDeduction
                      ? 'bg-rose-50/70 hover:bg-rose-50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-2 px-3 text-center no-underline">
                    <input
                      type="checkbox"
                      checked={isAwarded}
                      onChange={(e) => onUpdateItem(idx, 'isAwarded', e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                      title="得標開關：取消後移入未得標歷史，不參與金額總計"
                    />
                  </td>

                  <td className="py-2 px-3">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isDeduction
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isDeduction ? '扣減折讓' : '標準施工'}
                    </span>
                  </td>

                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={item.itemName}
                      onChange={(e) => onUpdateItem(idx, 'itemName', e.target.value)}
                      placeholder="請輸入工項名稱"
                      className={`w-full px-2 py-1 rounded border text-xs font-bold outline-none ${
                        isDeduction
                          ? 'border-rose-300 bg-white text-rose-900 focus:ring-1 focus:ring-rose-500'
                          : 'border-slate-300 text-slate-800 focus:ring-1 focus:ring-indigo-500'
                      }`}
                    />
                    {!isAwarded && (
                      <input
                        type="text"
                        value={item.lostReason || ''}
                        onChange={(e) => onUpdateItem(idx, 'lostReason', e.target.value)}
                        placeholder="請輸入失標原因 (如：業主砍項)"
                        className="w-full mt-1 px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-[11px] text-amber-900 outline-none"
                      />
                    )}
                  </td>

                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={item.spec || ''}
                      onChange={(e) => onUpdateItem(idx, 'spec', e.target.value)}
                      placeholder="規範/工法/品牌"
                      className="w-full px-2 py-1 rounded border border-slate-300 text-xs text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </td>

                  <td className="py-2 px-2 text-right">
                    <input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => onUpdateItem(idx, 'quantity', Number(e.target.value))}
                      className="w-16 px-2 py-1 rounded border border-slate-300 font-mono tabular-nums text-right text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </td>

                  <td className="py-2 px-2 text-center">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => onUpdateItem(idx, 'unit', e.target.value)}
                      className="w-12 px-1 py-1 rounded border border-slate-300 text-center text-xs outline-none"
                    />
                  </td>

                  <td className="py-2 px-2 text-right">
                    <input
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => onUpdateItem(idx, 'unitPrice', Number(e.target.value))}
                      className={`w-20 px-2 py-1 rounded border font-mono tabular-nums text-right text-xs outline-none ${
                        isDeduction
                          ? 'border-rose-300 text-rose-700 bg-white font-bold'
                          : 'border-slate-300 text-slate-900'
                      }`}
                    />
                  </td>

                  <td
                    className={`py-2 px-2 text-right font-mono tabular-nums font-bold ${
                      isDeduction ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    {isDeduction ? `- ${lineAmount.toLocaleString()}` : lineAmount.toLocaleString()}
                  </td>

                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => onDeleteItem(idx)}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                      title="刪除工項"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
