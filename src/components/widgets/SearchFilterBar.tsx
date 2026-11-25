import React from 'react';
import { Search } from 'lucide-react';

export interface SearchFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  gridClassName?: string;
  searchColSpanClass?: string;
  children?: React.ReactNode;
  extraBars?: React.ReactNode;
  filteredCount?: number;
  activeFilterBadges?: React.ReactNode;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: Array<{ value: number; label: string }>;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [
  { value: 25, label: '25 筆' },
  { value: 50, label: '50 筆' },
  { value: 100, label: '100 筆' },
  { value: 9999, label: '全部顯示' }
];

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = '搜尋關鍵字...',
  gridClassName = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-1',
  searchColSpanClass = 'sm:col-span-2',
  children,
  extraBars,
  filteredCount,
  activeFilterBadges,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS
}) => {
  return (
    <>
      <div className={gridClassName}>
        <div className={`relative ${searchColSpanClass}`}>
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        {children}
      </div>

      {extraBars}

      {(filteredCount !== undefined || onPageSizeChange) && (
        <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            {filteredCount !== undefined && (
              <span>
                符合條件：<strong className="text-slate-900 font-mono">{filteredCount}</strong> 筆
              </span>
            )}
            {activeFilterBadges}
          </div>

          {pageSize !== undefined && onPageSizeChange && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">每頁顯示：</span>
              <select
                value={pageSize}
                onChange={e => onPageSizeChange(Number(e.target.value))}
                className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono font-bold"
              >
                {pageSizeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </>
  );
};
