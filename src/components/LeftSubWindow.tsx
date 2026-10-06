import React from 'react';
import {
  Building2,
  Home,
  LayoutDashboard,
  FolderGit2,
  ClipboardList,
  Receipt,
  Users2,
  Sliders,
  FileSpreadsheet,
  ShoppingCart,
  HardHat,
  LineChart,
  UserCog,
  Lock
} from 'lucide-react';

export type LeftNavId =
  | 'COMPANY'
  | 'USERS'
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

import { useAuth } from '../context/AuthContext';

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
  const { currentUser, isSuperadmin, can } = useAuth();
  const hasUserManagementAccess = (isSuperadmin || Boolean(currentUser?.canManageUsers)) && currentUser?.status === 'ACTIVE';

  // 檢查導航項目是否具備模組讀取權限
  const checkNavReadAccess = (id: LeftNavId): boolean => {
    if (!currentUser || currentUser.status === 'DISABLED') return false;
    switch (id) {
      case 'COMPANY':
        return can('COMPANIES', 'read');
      case 'USERS':
        return hasUserManagementAccess;
      case 'PROJECTS':
        return can('PROJECTS', 'read');
      case 'PARTNERS':
        return can('PARTNERS', 'read');
      case 'QUOTATIONS':
        return can('QUOTATIONS', 'read');
      case 'PROCUREMENT':
        return can('PURCHASE_ORDERS', 'read') || can('SUBCONTRACTS', 'read');
      case 'VALUATIONS':
        return can('VALUATIONS', 'read');
      case 'FINANCE':
        return can('FINANCE_AP', 'read') || can('FINANCE_AR', 'read') || can('BANK_CHECKS', 'read');
      case 'COMMAND_CENTER':
        return can('FINANCE_AP', 'read') || can('FINANCE_AR', 'read') || can('PROJECTS', 'read');
      case 'SETTINGS':
        return can('SYSTEM_CONFIGS', 'read');
      case 'DASHBOARD':
      case 'FLOWCHART':
      case 'ROADMAP':
      default:
        return true;
    }
  };

  // 對應截圖中經典的鼎新 A1 垂直圖示功能鍵 (優先聚焦：公司設定、帳號管理)
  const navItems: {
    id: LeftNavId;
    label: string;
    icon: any;
    badgeCount?: number;
  }[] = [
    { id: 'COMPANY', label: '公司設定', icon: Building2 },
    { id: 'USERS', label: '帳號管理', icon: UserCog },
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

  // 帳號管理專人防護：未獲 Superadmin 指定帳號管理權限者，完全自選單隱藏不可見
  const visibleNavItems = navItems.filter(item => {
    if (item.id === 'USERS' && !hasUserManagementAccess) {
      return false;
    }
    return true;
  });

  if (!isOpen) return null;

  return (
    <aside className="w-[62px] bg-white border-r border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto overflow-x-hidden py-1 z-20 shadow-xs">
      <div className="flex-1 flex flex-col items-center space-y-1">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          const hasRead = checkNavReadAccess(item.id);

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              title={hasRead ? item.label : `${item.label} (目前帳號無讀取權限)`}
              className={`w-full py-2.5 px-1 flex flex-col items-center justify-center transition-all group relative cursor-pointer ${
                isActive
                  ? 'bg-slate-100 text-indigo-700 font-bold border-l-3 border-indigo-600'
                  : !hasRead
                  ? 'text-slate-400 opacity-75 hover:bg-rose-50/50 hover:text-rose-600'
                  : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 mb-1 transition-colors ${
                    isActive
                      ? 'text-indigo-600 stroke-[2.2]'
                      : !hasRead
                      ? 'text-slate-400 group-hover:text-rose-500'
                      : 'text-slate-500 group-hover:text-indigo-600'
                  }`}
                />
                {!hasRead ? (
                  <span className="w-3.5 h-3.5 rounded-full bg-rose-100 text-rose-600 border border-rose-300 flex items-center justify-center absolute -top-1 -right-1.5 shadow-2xs">
                    <Lock className="w-2 h-2" />
                  </span>
                ) : item.badgeCount !== undefined && item.badgeCount > 0 ? (
                  <span className="w-2 h-2 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5 ring-2 ring-white" />
                ) : null}
              </div>
              <span
                className={`text-[10px] tracking-tight leading-tight text-center ${
                  isActive
                    ? 'text-indigo-700 font-bold'
                    : !hasRead
                    ? 'text-slate-400 group-hover:text-rose-600'
                    : 'text-slate-600 group-hover:text-slate-900'
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
