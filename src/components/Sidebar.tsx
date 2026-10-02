import React from 'react';
import {
  FileText,
  FolderGit2,
  LayoutDashboard,
  ArrowRightCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  ShieldCheck,
  Database
} from 'lucide-react';

export type ActiveTab =
  | 'ROADMAP'
  | 'PROJECTS'
  | 'FLOWCHART'
  | 'PARTNERS'
  | 'QUOTATIONS'
  | 'PROCUREMENT'
  | 'VALUATIONS'
  | 'FINANCE'
  | 'COMMAND_CENTER'
  | 'REPORTS'
  | 'SYSTEM_CONFIG'
  | 'DATABASE_MANAGER'
  | 'USER_PERMISSIONS';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  projectsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed = false,
  onToggleCollapse,
  projectsCount = 3,
}) => {
  const menuItems: {
    id: ActiveTab;
    label: string;
    sublabel: string;
    icon: any;
    badge?: string;
    badgeColor?: string;
  }[] = [
    {
      id: 'ROADMAP',
      label: '架構討論與藍圖總綱',
      sublabel: '討論內容與決策紀錄',
      icon: FileText,
      badge: '保留討論',
      badgeColor: 'bg-indigo-50 text-indigo-700 font-bold',
    },
    {
      id: 'PROJECTS',
      label: '專案案場主檔 (外殼)',
      sublabel: '左子視窗 + 右畫布',
      icon: FolderGit2,
      badge: `${projectsCount} 案`,
      badgeColor: 'bg-emerald-50 text-emerald-700 font-bold',
    },
    {
      id: 'FLOWCHART',
      label: '鼎新 A1 業務流程圖',
      sublabel: '全流程導航地圖',
      icon: LayoutDashboard,
      badge: 'A1 導航',
      badgeColor: 'bg-slate-100 text-slate-600',
    },
  ];

  return (
    <aside
      className={`${
        isCollapsed ? 'w-16' : 'w-56 xl:w-60'
      } bg-white border-r border-slate-200 flex flex-col shrink-0 select-none overflow-hidden transition-[width] duration-150 z-20`}
    >
      {/* 頂部收合切換按鈕 */}
      <div className="p-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
        {!isCollapsed && (
          <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            <span>功能工作台選單</span>
          </div>
        )}

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? '展開側邊導航欄' : '收合側邊導航欄 (獲取更寬工作空間)'}
            className="p-1 rounded hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 transition-colors mx-auto"
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* 導航清單 */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          if (isCollapsed) {
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                title={`${item.label} (${item.sublabel})`}
                className={`w-full p-2.5 rounded-lg flex items-center justify-center relative transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 absolute right-1.5 top-1.5" />
                )}
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                isActive
                  ? 'bg-indigo-50/80 text-indigo-900 border-indigo-300 shadow-2xs'
                  : 'bg-white text-slate-700 border-transparent hover:bg-slate-50 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center font-bold shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <div className={`text-xs font-bold ${isActive ? 'text-indigo-900' : 'text-slate-800'}`}>
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {item.sublabel}
                  </div>
                </div>
              </div>

              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold shrink-0 ml-1 ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 底部說明 */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 text-[10px] text-slate-400 space-y-1 shrink-0">
          <div className="font-bold text-slate-600">重構準則：</div>
          <div>1. 清空先前先行雜亂代碼</div>
          <div>2. 單一模組聚焦精雕</div>
          <div>3. 逐一完成才掛載選單</div>
        </div>
      )}
    </aside>
  );
};
