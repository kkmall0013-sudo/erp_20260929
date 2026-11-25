import React from 'react';
import { LayoutGrid, Table as TableIcon } from 'lucide-react';

export interface WorkspaceHeaderTabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  activeTabClass?: string;
  activeBadgeClass?: string;
}

export interface WorkspaceHeaderShellProps {
  icon: React.ReactNode;
  iconBgClass?: string;
  title: string;
  badgeText?: string;
  subtitle: string;
  rightActions?: React.ReactNode;
  tabs?: WorkspaceHeaderTabItem[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  viewMode?: 'TABLE' | 'CARDS';
  onViewModeChange?: (mode: 'TABLE' | 'CARDS') => void;
  tableModeLabel?: string;
  cardsModeLabel?: string;
  children?: React.ReactNode;
}

export const WorkspaceHeaderShell: React.FC<WorkspaceHeaderShellProps> = ({
  icon,
  iconBgClass = 'bg-indigo-600 text-white',
  title,
  badgeText,
  subtitle,
  rightActions,
  tabs,
  activeTab,
  onTabChange,
  viewMode,
  onViewModeChange,
  tableModeLabel = '緊湊表格 (推薦)',
  cardsModeLabel = '名片卡片',
  children
}) => {
  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4 shrink-0 shadow-2xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${iconBgClass} flex items-center justify-center shadow-md`}>
              {icon}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>{title}</span>
                {badgeText && (
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    {badgeText}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            </div>
          </div>
        </div>

        {rightActions && <div className="flex items-center gap-2 flex-wrap">{rightActions}</div>}
      </div>

      {((tabs && tabs.length > 0) || onViewModeChange) && (
        <div className="flex items-center justify-between border-b border-slate-200">
          {tabs && tabs.length > 0 ? (
            <div className="flex items-center">
              {tabs.map(tab => {
                const isActive = activeTab === tab.key;
                const activeTabCls =
                  tab.activeTabClass || 'border-indigo-600 text-indigo-600 bg-indigo-50/30';
                const activeBadgeCls = tab.activeBadgeClass || 'bg-indigo-600 text-white';

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onTabChange?.(tab.key)}
                    className={`pb-3 px-5 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                      isActive
                        ? activeTabCls
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                          isActive ? activeBadgeCls : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div />
          )}

          {viewMode && onViewModeChange && (
            <div className="flex items-center gap-2 pb-2">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => onViewModeChange('TABLE')}
                  className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'TABLE'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="清單表格模式：高密度展示，適合大量資料極速瀏覽"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>{tableModeLabel}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onViewModeChange('CARDS')}
                  className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'CARDS'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="名片網格模式：卡片視覺化展示"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{cardsModeLabel}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
};
