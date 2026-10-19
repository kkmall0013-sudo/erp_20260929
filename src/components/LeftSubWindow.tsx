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
  Lock,
  FolderLock,
  Sparkles,
  SlidersHorizontal,
  Truck
} from 'lucide-react';

export type LeftNavId =
  | 'APP_SETTINGS'
  | 'COMPANY'
  | 'USERS'
  | 'DASHBOARD'
  | 'PROJECTS'
  | 'FLOWCHART'
  | 'PARTNERS'
  | 'MINI_APPS'
  | 'VAULT'
  | 'QUOTATIONS'
  | 'INBOUND'
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
  const { currentUser, isSuperadmin, isAdmin, can } = useAuth();
  const hasUserManagementAccess = (isSuperadmin || Boolean(currentUser?.canManageUsers)) && currentUser?.status === 'ACTIVE';

  // 對應經典鼎新 A1 垂直圖示功能鍵 (雙軌設定分層：Superadmin 程式設定 vs Admin 基本資料中樞)
  const navItems: {
    id: LeftNavId;
    label: string;
    icon: any;
    badgeCount?: number;
  }[] = [
    { id: 'APP_SETTINGS', label: '程式設定', icon: SlidersHorizontal },
    { id: 'SETTINGS', label: '基本資料', icon: Sliders },
    { id: 'USERS', label: '帳號管理', icon: UserCog },
    { id: 'DASHBOARD', label: '儀表板', icon: LayoutDashboard },
    { id: 'PROJECTS', label: '專案案場', icon: FolderGit2, badgeCount: 3 },
    { id: 'FLOWCHART', label: '業務流程', icon: Home },
    { id: 'PARTNERS', label: '商業夥伴', icon: Users2 },
    { id: 'MINI_APPS', label: '小程式庫', icon: Sparkles },
    { id: 'VAULT', label: '檔案金庫', icon: FolderLock },
    { id: 'QUOTATIONS', label: '報價銷售', icon: FileSpreadsheet },
    { id: 'INBOUND', label: '進貨管理', icon: Truck, badgeCount: 4 },
    { id: 'PROCUREMENT', label: '採購發包', icon: ShoppingCart },
    { id: 'VALUATIONS', label: '合約估驗', icon: HardHat },
    { id: 'FINANCE', label: '財務票據', icon: Receipt },
    { id: 'COMMAND_CENTER', label: '營運戰情', icon: LineChart },
    { id: 'ROADMAP', label: '藍圖討論', icon: ClipboardList },
  ];

  // 檢查導航項目是否在當前登入帳號下可見 (嚴格分層：Superadmin / Admin / User PBAC)
  const isNavVisibleForUser = (id: LeftNavId): boolean => {
    if (!currentUser || currentUser.status === 'DISABLED') return false;

    // 1. 【Superadmin 專屬範疇】：
    // 程式設定 (APP_SETTINGS)、小程式庫 (MINI_APPS)、藍圖討論 (ROADMAP)
    // 只有 Superadmin 登入時才看得見，其他角色 (Admin 或 一般同仁) 完全連看都看不到也無法選擇
    if (id === 'APP_SETTINGS' || id === 'MINI_APPS' || id === 'ROADMAP') {
      return isSuperadmin;
    }

    // 2. 【Admin 範疇】：基本資料營運法規中樞 (SETTINGS，已整併原公司設定)
    // 屬於系統管理員與最高管理員範疇，一般同仁 (USER) 完全不顯示
    if (id === 'SETTINGS' || id === 'COMPANY') {
      return isSuperadmin || isAdmin;
    }

    // 3. 【帳號管理 (USERS)】：只有 Superadmin 或獲得特許授權之同仁可見
    if (id === 'USERS') {
      return hasUserManagementAccess;
    }

    // 4. 【流程地圖 (FLOWCHART)】：全域業務流程架構，僅限最高管理員與系統管理員檢視
    if (id === 'FLOWCHART') {
      return isSuperadmin || isAdmin;
    }

    // 5. 【核心業務表單 (PBAC 權限矩陣)】：
    // 左側表單只出現該帳號所屬業務群組有被授權使用的選項 (無讀取權限者連看都看不到也無法選擇)
    switch (id) {
      case 'PROJECTS':
        return isSuperadmin || isAdmin || can('PROJECTS', 'read');
      case 'PARTNERS':
        return isSuperadmin || isAdmin || can('PARTNERS', 'read');
      case 'QUOTATIONS':
        return isSuperadmin || isAdmin || can('QUOTATIONS', 'read');
      case 'INBOUND':
        return isSuperadmin || isAdmin || can('INBOUND_RECEIPTS', 'read') || can('PURCHASE_ORDERS', 'read');
      case 'PROCUREMENT':
        return isSuperadmin || isAdmin || can('PURCHASE_ORDERS', 'read') || can('SUBCONTRACTS', 'read');
      case 'VALUATIONS':
        return isSuperadmin || isAdmin || can('VALUATIONS', 'read');
      case 'FINANCE':
        return isSuperadmin || isAdmin || can('FINANCE_AP', 'read') || can('FINANCE_AR', 'read') || can('BANK_CHECKS', 'read');
      case 'COMMAND_CENTER':
        return isSuperadmin || isAdmin || (can('FINANCE_AP', 'read') && can('PROJECTS', 'read'));
      case 'VAULT':
        return isSuperadmin || isAdmin || can('PROJECTS', 'read') || can('QUOTATIONS', 'read') || can('PURCHASE_ORDERS', 'read') || can('VALUATIONS', 'read') || can('PARTNERS', 'read');
      case 'DASHBOARD':
        return true; // 個人工作儀表板全體可用
      default:
        return false;
    }
  };

  // 過濾出目前登入帳號「真正能看見並使用」的左側選單項目
  const visibleNavItems = navItems.filter(item => isNavVisibleForUser(item.id));

  // 當切換身分或重新整理時，若當前選取的 activeId 不在該帳號之可見清單內，自動安全跳轉至第一個合法項目 (如 DASHBOARD)
  React.useEffect(() => {
    if (visibleNavItems.length > 0 && !visibleNavItems.some(item => item.id === activeId)) {
      const fallbackItem = visibleNavItems.find(it => it.id === 'DASHBOARD') || visibleNavItems[0];
      if (fallbackItem) {
        onSelect(fallbackItem.id);
      }
    }
  }, [visibleNavItems, activeId, onSelect]);

  if (!isOpen) return null;

  return (
    <aside className="w-[62px] bg-white border-r border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto overflow-x-hidden py-1 z-20 shadow-xs">
      <div className="flex-1 flex flex-col items-center space-y-1">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              title={item.label}
              className={`w-full py-2.5 px-1 flex flex-col items-center justify-center transition-all group relative cursor-pointer ${
                isActive
                  ? 'bg-slate-100 text-indigo-700 font-bold border-l-3 border-indigo-600'
                  : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 mb-1 transition-colors ${
                    isActive
                      ? 'text-indigo-600 stroke-[2.2]'
                      : 'text-slate-500 group-hover:text-indigo-600'
                  }`}
                />
                {item.badgeCount !== undefined && item.badgeCount > 0 ? (
                  <span className="w-2 h-2 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5 ring-2 ring-white" />
                ) : null}
              </div>
              <span
                className={`text-[10px] tracking-tight leading-tight text-center ${
                  isActive
                    ? 'text-indigo-700 font-bold'
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
