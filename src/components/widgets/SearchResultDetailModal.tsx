// src/components/widgets/SearchResultDetailModal.tsx
// 🔍 全系統共用「搜尋結果詳情檢視與上下筆巡覽」彈窗（支援 Esc 關閉、←/→ 上下筆切換、自訂擴充區塊插槽）

import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { SearchResultItem } from '../../utils/universalSearchEngine';

export interface SearchDetailColumnOverride {
  key: string;
  label: string;
  value: string;
  isNumeric?: boolean;
}

export interface SearchResultDetailModalProps<T = any> {
  isOpen: boolean;
  item: SearchResultItem<T> | null;
  onClose: () => void;
  /** 當前筆次索引（0-based）與總筆數，提供時自動顯示「第 X / Y 筆」與上下筆巡覽 */
  currentIndex?: number;
  totalCount?: number;
  onPrev?: () => void;
  onNext?: () => void;
  /** 若需覆寫顯示欄位（例如在測試沙盒呈現即時欄位格式），可由此傳入 */
  fieldsOverride?: SearchDetailColumnOverride[];
  /** 自訂附加區塊（例如：案場關聯進料／請款明細、測試區權限遮蔽診斷等） */
  extraContent?: React.ReactNode;
  headerActions?: React.ReactNode;
  footerHint?: string;
  closeLabel?: string;
  maxWidthClass?: string;
}

export function SearchResultDetailModal<T = any>({
  isOpen,
  item,
  onClose,
  currentIndex,
  totalCount,
  onPrev,
  onNext,
  fieldsOverride,
  extraContent,
  headerActions,
  footerHint = '提示：支援鍵盤 ← / → 切換上一筆／下一筆，按 Esc 關閉視窗',
  closeLabel = '關閉',
  maxWidthClass = 'max-w-2xl'
}: SearchResultDetailModalProps<T>) {
  const showNavigation = Boolean(onPrev || onNext);
  const hasPrev =
    typeof currentIndex === 'number' && currentIndex > 0 && Boolean(onPrev);
  const hasNext =
    typeof currentIndex === 'number' &&
    typeof totalCount === 'number' &&
    currentIndex >= 0 &&
    currentIndex < totalCount - 1 &&
    Boolean(onNext);

  useEffect(() => {
    if (!isOpen || !item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === 'ArrowLeft' && hasPrev && onPrev) {
        onPrev();
      } else if (e.key === 'ArrowRight' && hasNext && onNext) {
        onNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, item, onClose, hasPrev, hasNext, onPrev, onNext]);

  if (!isOpen || !item) return null;

  const columns: SearchDetailColumnOverride[] =
    fieldsOverride ||
    item.displayColumns.map(col => ({
      key: col.key,
      label: col.label,
      value: col.value,
      isNumeric: true
    }));

  const positionLabel =
    typeof currentIndex === 'number' && typeof totalCount === 'number' && totalCount > 0 && currentIndex >= 0
      ? `第 ${currentIndex + 1} / ${totalCount} 筆`
      : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl border border-slate-200 shadow-2xl w-full ${maxWidthClass} max-h-[86vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95`}
        onClick={e => e.stopPropagation()}
      >
        {/* 頂部標題與導覽 */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {positionLabel && (
                <span className="font-mono tabular-nums text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                  {positionLabel}
                </span>
              )}
              <h4 className="text-sm font-bold text-slate-900 truncate">{item.title}</h4>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {item.companyLabel} · {item.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {headerActions}
            {showNavigation && (
              <>
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={onPrev}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed text-xs font-medium text-slate-700 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>上一筆</span>
                </button>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={onNext}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed text-xs font-medium text-slate-700 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <span>下一筆</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="關閉明細視窗"
              title="關閉視窗 (Esc)"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer ml-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 內容明細網格 + 自訂插槽 */}
        <div className="p-5 overflow-y-auto space-y-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {columns.map(col => (
              <div
                key={col.key}
                className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5"
              >
                <dt className="text-[11px] font-medium text-slate-500">{col.label}</dt>
                <dd
                  className={`text-xs font-semibold text-slate-900 break-words ${
                    col.isNumeric ? 'font-mono tabular-nums' : ''
                  }`}
                >
                  {col.value || '-'}
                </dd>
              </div>
            ))}
          </dl>

          {extraContent}
        </div>

        {/* 底部 */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3 text-xs text-slate-500 shrink-0">
          <span className="truncate">{footerHint}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer shrink-0"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
