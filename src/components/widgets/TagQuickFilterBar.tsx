import React from 'react';
import { Tag } from 'lucide-react';

export interface TagQuickFilterItem {
  key: string;
  label: string;
  count?: number;
  title?: string;
}

export interface TagQuickFilterBarProps {
  title?: string;
  allLabel: string;
  allCount?: number;
  items: TagQuickFilterItem[];
  selectedKey: string;
  onSelect: (key: string) => void;
  itemPrefix?: string;
}

export const TagQuickFilterBar: React.FC<TagQuickFilterBarProps> = ({
  title = '產品標籤篩選：',
  allLabel,
  allCount,
  items,
  selectedKey,
  onSelect,
  itemPrefix = '🏷️ '
}) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
      <span className="text-[11px] text-amber-950 font-bold shrink-0 flex items-center gap-1">
        <Tag className="w-3.5 h-3.5 text-amber-600" />
        <span>{title}</span>
      </span>

      <button
        type="button"
        onClick={() => onSelect('ALL')}
        className={`text-xs px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer ${
          selectedKey === 'ALL'
            ? 'bg-amber-600 text-white shadow-2xs'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
        }`}
      >
        {allLabel}
        {allCount !== undefined ? ` (${allCount})` : ''}
      </button>

      {items.map(item => {
        const isSelected = selectedKey === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(isSelected ? 'ALL' : item.key)}
            className={`text-xs px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors flex items-center gap-1 cursor-pointer ${
              isSelected
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
            }`}
            title={item.title || `點選快速檢視「${item.label}」`}
          >
            <span>
              {itemPrefix}
              {item.label}
            </span>
            {item.count !== undefined && (
              <span
                className={`text-[10px] px-1 py-0.2 rounded-full ${
                  isSelected ? 'bg-amber-700 text-white' : 'bg-amber-200/80 text-amber-950 font-mono'
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
