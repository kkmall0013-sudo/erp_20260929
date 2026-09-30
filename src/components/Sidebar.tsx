import React from 'react';
import {
  LayoutDashboard,
  FolderGit2,
  Users2,
  FileSpreadsheet,
  ShoppingCart,
  HardHat,
  Receipt,
  LineChart,
  FileText,
  Sliders,
  Database,
  Users,
  ArrowRightCircle
} from 'lucide-react';

export type ActiveTab =
  | 'FLOWCHART'
  | 'PROJECTS'
  | 'PARTNERS'
  | 'QUOTATIONS'
  | 'PROCUREMENT'
  | 'VALUATIONS'
  | 'FINANCE'
  | 'COMMAND_CENTER'
  | 'REPORTS'
  | 'SYSTEM_CONFIG'
  | 'USERS_PERMISSIONS'
  | 'DATABASE_MANAGER';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  stats?: {
    projectsCount: number;
    quotationsCount: number;
    posCount: number;
    valuationsCount: number;
    checksCount: number;
    usersCount?: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  stats = {
    projectsCount: 3,
    quotationsCount: 1,
    posCount: 3,
    valuationsCount: 2,
    checksCount: 4,
    usersCount: 6,
  }
}) => {
  const navSections = [
    {
      group: '流程首頁',
      items: [
        {
          id: 'FLOWCHART' as ActiveTab,
          label: '業務全流程圖',
          icon: LayoutDashboard,
          badge: '核心導航',
          badgeColor: 'bg-indigo-500/10 text-indigo-600',
        },
      ],
    },
    {
      group: '主檔與工程',
      items: [
        {
          id: 'PROJECTS' as ActiveTab,
          label: '專案與案場管理',
          icon: FolderGit2,
          count: stats.projectsCount,
        },
        {
          id: 'PARTNERS' as ActiveTab,
          label: '商業夥伴 (客戶/廠商)',
          icon: Users2,
        },
      ],
    },
    {
      group: '營業與採發',
      items: [
        {
          id: 'QUOTATIONS' as ActiveTab,
          label: '報價與銷售 (CPQ 引擎)',
          icon: FileSpreadsheet,
          count: stats.quotationsCount,
        },
        {
          id: 'PROCUREMENT' as ActiveTab,
          label: '採購與發包模組',
          icon: ShoppingCart,
          count: stats.posCount,
        },
        {
          id: 'VALUATIONS' as ActiveTab,
          label: '合約與估驗計價',
          icon: HardHat,
          count: stats.valuationsCount,
        },
      ],
    },
    {
      group: '會計與決策',
      items: [
        {
          id: 'FINANCE' as ActiveTab,
          label: '財務應收付與票據',
          icon: Receipt,
          count: stats.checksCount,
        },
        {
          id: 'COMMAND_CENTER' as ActiveTab,
          label: '營運戰情大腦',
          icon: LineChart,
          badge: '即時水池',
          badgeColor: 'bg-emerald-500/10 text-emerald-600',
        },
        {
          id: 'REPORTS' as ActiveTab,
          label: '商業級多維報表',
          icon: FileText,
        },
      ],
    },
    {
      group: '平台基礎設施',
      items: [
        {
          id: 'USERS_PERMISSIONS' as ActiveTab,
          label: '帳號與權限管理 (PBAC)',
          icon: Users,
          count: stats.usersCount,
          badge: '權限矩陣',
          badgeColor: 'bg-indigo-500/10 text-indigo-700',
        },
        {
          id: 'SYSTEM_CONFIG' as ActiveTab,
          label: '全域參數與審計日誌',
          icon: Sliders,
        },
        {
          id: 'DATABASE_MANAGER' as ActiveTab,
          label: 'SQLite 備份與 SQL 匯出',
          icon: Database,
          badge: 'SQL 備份',
          badgeColor: 'bg-amber-500/10 text-amber-700',
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto">
      {/* 流程地圖快捷橫幅 */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/70">
        <button
          onClick={() => onSelectTab('FLOWCHART')}
          className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between ${
            activeTab === 'FLOWCHART'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <LayoutDashboard className={`w-4 h-4 ${activeTab === 'FLOWCHART' ? 'text-white' : 'text-indigo-600'}`} />
            <div>
              <div className="text-xs font-bold leading-tight">全流程作業圖</div>
              <div className={`text-[10px] ${activeTab === 'FLOWCHART' ? 'text-indigo-100' : 'text-slate-400'}`}>
                營造工程全生命週期導航
              </div>
            </div>
          </div>
          <ArrowRightCircle className={`w-4 h-4 ${activeTab === 'FLOWCHART' ? 'text-white' : 'text-slate-400'}`} />
        </button>
      </div>

      {/* 各功能分組導航清單 */}
      <div className="flex-1 py-3 px-3 space-y-4">
        {navSections.map((section) => (
          <div key={section.group}>
            <div className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              {section.group}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-100 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {item.count !== undefined && item.count > 0 && (
                        <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          {item.count}
                        </span>
                      )}
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 底部資料庫狀態提示 */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            SQLite 引擎運行中
          </span>
          <button
            onClick={() => onSelectTab('DATABASE_MANAGER')}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            SQL 匯出
          </button>
        </div>
      </div>
    </aside>
  );
};
