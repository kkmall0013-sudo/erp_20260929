import React from 'react';
import {
  Building2,
  Home,
  LayoutDashboard,
  Calendar,
  CalendarDays,
  MessageSquareText,
  TrendingUp,
  FolderGit2,
  ClipboardList,
  Receipt,
  Users2,
  Sliders,
  Database,
  FileSpreadsheet,
  ShoppingCart,
  HardHat,
  LineChart
} from 'lucide-react';

export type LeftNavId =
  | 'COMPANY'
  | 'DASHBOARD'
  | 'PROJECTS'
  | 'FLOWCHART'
  | 'PARTNERS'
  | 'QUOTATIONS'
  | 'PROCUREMENT'
  | 'VALUATIONS'
  | 'FINANCE'
  | 'COMMAND_CENTER'
  | 'ROADMAP'
  | 'SETTINGS';

interface LeftSubWindowProps {
  activeId: LeftNavId;
  onSelect: (id: LeftNavId) => void;
  isOpen?: boolean;
}

export const LeftSubWindow: React.FC<LeftSubWindowProps> = ({
  activeId,
  onSelect,
  isOpen = true,
}) => {
  // 對應截圖中經典的鼎新 A1 垂直圖示功能鍵 (優先聚焦：公司設定)
  const navItems: {
    id: LeftNavId;
    label: string;
    icon: any;
    badgeCount?: number;
  }[] = [
    { id: 'COMPANY', label: '公司設定', icon: Building2 },
    { id: 'DASHBOARD', label: '儀表板', icon: LayoutDashboard },
    { id: 'PROJECTS', label: '專案案場', icon: FolderGit2, badgeCount: 3 },
    { id: 'FLOWCHART', label: '業務流程', icon: Home },
    { id: 'PARTNERS', label: '商業夥伴', icon: Users2 },
    { id: 'QUOTATIONS', label: '報價銷售', icon: FileSpreadsheet },
    { id: 'PROCUREMENT', label: '採購發包', icon: ShoppingCart },
    { id: 'VALUATIONS', label: '合約估驗', icon: HardHat },
    { id: 'FINANCE', label: '財務票據', icon: Receipt },
    { id: 'COMMAND_CENTER', label: '營運戰情', icon: LineChart },
    { id: 'ROADMAP', label: '藍圖討論', icon: ClipboardList },
    { id: 'SETTINGS', label: '基本資料', icon: Sliders },
  ];

  if (!isOpen) return null;

  return (
    <aside className="w-[62px] bg-white border-r border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto overflow-x-hidden py-1 z-20 shadow-xs">
      <div className="flex-1 flex flex-col items-center space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              title={item.label}
              className={`w-full py-2.5 px-1 flex flex-col items-center justify-center transition-all group relative ${
                isActive
                  ? 'bg-slate-100 text-indigo-700 font-bold border-l-3 border-indigo-600'
                  : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 mb-1 transition-colors ${
                    isActive ? 'text-indigo-600 stroke-[2.2]' : 'text-slate-500 group-hover:text-indigo-600'
                  }`}
                />
                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5 ring-2 ring-white" />
                )}
              </div>
              <span
                className={`text-[10px] tracking-tight leading-tight text-center ${
                  isActive ? 'text-indigo-700 font-bold' : 'text-slate-600 group-hover:text-slate-900'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
