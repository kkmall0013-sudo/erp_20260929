import React from 'react';
import {
  LayoutDashboard,
  FolderGit2,
  Users2,
  FileSpreadsheet,
  Truck,
  HardHat,
  Receipt,
  FolderLock,
  LineChart,
  SlidersHorizontal,
  Home,
  ShoppingCart,
  UserCog,
  Sparkles,
  ClipboardList,
  Sliders
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type LeftNavId =
  | 'DASHBOARD'
  | 'PROJECTS'
  | 'PARTNERS'
  | 'QUOTATIONS'
  | 'INBOUND'
  | 'VALUATIONS'
  | 'FINANCE'
  | 'VAULT'
  | 'COMMAND_CENTER'
  | 'SETTINGS'
  // 向後相容或深層次子項目 ID
  | 'FLOWCHART'
  | 'PROCUREMENT'
  | 'APP_SETTINGS'
  | 'COMPANY'
  | 'USERS'
  | 'MINI_APPS'
  | 'ROADMAP';

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
  const { currentUser, isSuperadmin, isBoss, isAdmin, can } = useAuth();
  const hasUserManagementAccess = (isSuperadmin || isBoss || Boolean(currentUser?.canManageUsers)) && currentUser?.status === 'ACTIVE';
  const hasSystemSettingsAccess = isSuperadmin || isBoss || isAdmin || Boolean(currentUser?.canManageSystemConfigs) || hasUserManagementAccess;

  // 1. 上半部：常用業務主幹道 (按營造生命週期業務發生頻率由上至下嚴謹排列)
  const operationalNavItems: {
    id: LeftNavId;
    label: string;
    icon: any;
    badgeCount?: number;
  }[] = [
    { id: 'DASHBOARD', label: '營運儀表', icon: LayoutDashboard },
    { id: 'PROJECTS', label: '案場工程', icon: FolderGit2, badgeCount: 3 },
    { id: 'PARTNERS', label: '聯絡明細', icon: Users2 },
    { id: 'QUOTATIONS', label: '報價預算', icon: FileSpreadsheet },
    { id: 'INBOUND', label: '進貨管理', icon: Truck, badgeCount: 4 },
    { id: 'VALUATIONS', label: '估驗請款', icon: HardHat },
    { id: 'FINANCE', label: '財務收支', icon: Receipt },
    { id: 'VAULT', label: '保險箱', icon: FolderLock },
    { id: 'COMMAND_CENTER', label: '戰情指揮', icon: LineChart },
  ];

  // 2. 下半部：底層系統管理中樞 (整併基本資料、帳號管理、程式設定、小程式庫、藍圖總綱)
  const systemNavItems: {
    id: LeftNavId;
    label: string;
    icon: any;
    badgeCount?: number;
  }[] = [
    { id: 'SETTINGS', label: '系統中樞', icon: SlidersHorizontal },
  ];

  // 檢查導航項目在當前帳號權限下是否可見
  const isNavVisibleForUser = (id: LeftNavId): boolean => {
    if (!currentUser || currentUser.status === 'DISABLED') return false;

    switch (id) {
      case 'DASHBOARD':
        return true; // 個人工作儀表板全體可用
      case 'PROJECTS':
        return isSuperadmin || isBoss || isAdmin || can('PROJECTS', 'read');
      case 'PARTNERS':
        return isSuperadmin || isBoss || isAdmin || can('PARTNERS', 'read');
      case 'QUOTATIONS':
        return isSuperadmin || isBoss || isAdmin || can('QUOTATIONS', 'read');
      case 'INBOUND':
        return isSuperadmin || isBoss || isAdmin || can('INBOUND_RECEIPTS', 'read') || can('PURCHASE_ORDERS', 'read');
      case 'VALUATIONS':
        return isSuperadmin || isBoss || isAdmin || can('VALUATIONS', 'read');
      case 'FINANCE':
        return isSuperadmin || isBoss || isAdmin || can('FINANCE_AP', 'read') || can('FINANCE_AR', 'read') || can('BANK_CHECKS', 'read');
      case 'VAULT':
        return isSuperadmin || isBoss || isAdmin || can('PROJECTS', 'read') || can('QUOTATIONS', 'read') || can('VALUATIONS', 'read') || can('PARTNERS', 'read');
      case 'COMMAND_CENTER':
        return isSuperadmin || isBoss || isAdmin || (can('FINANCE_AP', 'read') && can('PROJECTS', 'read'));
      case 'SETTINGS':
        return hasSystemSettingsAccess;
      default:
        return false;
    }
  };

  const visibleOperationalItems = operationalNavItems.filter(item => isNavVisibleForUser(item.id));
  const visibleSystemItems = systemNavItems.filter(item => isNavVisibleForUser(item.id));
  const allVisibleItems = [...visibleOperationalItems, ...visibleSystemItems];

  // 當切換身分或重新整理時，若當前選取的 activeId 不在該帳號之可見清單內，自動安全跳轉至第一個合法項目 (如 DASHBOARD)
  React.useEffect(() => {
    const isCurrentActiveValid =
      allVisibleItems.some(item => item.id === activeId) ||
      // 若子設定項目存在，只要 SETTINGS 有權限即可
      (['APP_SETTINGS', 'COMPANY', 'USERS', 'MINI_APPS', 'ROADMAP'].includes(activeId) && visibleSystemItems.some(it => it.id === 'SETTINGS'));

    if (allVisibleItems.length > 0 && !isCurrentActiveValid) {
      const fallbackItem = allVisibleItems.find(it => it.id === 'DASHBOARD') || allVisibleItems[0];
      if (fallbackItem) {
        onSelect(fallbackItem.id);
      }
    }
  }, [allVisibleItems, activeId, onSelect, visibleSystemItems]);

  if (!isOpen) return null;

  // 判斷按鈕是否處於激活高亮狀態 (包含子分頁歸屬至 SETTINGS)
  const isItemActive = (itemId: LeftNavId) => {
    if (activeId === itemId) return true;
    if (itemId === 'SETTINGS' && ['APP_SETTINGS', 'COMPANY', 'USERS', 'MINI_APPS', 'ROADMAP'].includes(activeId)) {
      return true;
    }
    return false;
  };

  return (
    <aside className="w-[62px] bg-white border-r border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto overflow-x-hidden py-1 z-20 shadow-xs justify-between">
      {/* 上半部：常用業務主幹道 9 大模組 */}
      <div className="flex flex-col items-center space-y-1">
        {visibleOperationalItems.map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item.id);

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              title={item.label}
              className={`w-full py-2 px-1 flex flex-col items-center justify-center transition-all group relative cursor-pointer ${
                isActive
                  ? 'bg-slate-100 text-indigo-700 font-bold border-l-3 border-indigo-600'
                  : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 mb-0.5 transition-colors ${
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

      {/* 下半部：系統設定中樞 (若具管理權限) */}
      {visibleSystemItems.length > 0 && (
        <div className="flex flex-col items-center pt-1 border-t border-slate-200 mt-1">
          {visibleSystemItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item.id);

            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                title="系統設定中樞 (基本資料 · 帳號管理 · 程式設定 · 小程式庫 · 藍圖總綱)"
                className={`w-full py-2.5 px-1 flex flex-col items-center justify-center transition-all group relative cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-bold border-l-3 border-indigo-600'
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 mb-0.5 transition-colors ${
                      isActive
                        ? 'text-indigo-600 stroke-[2.2]'
                        : 'text-slate-500 group-hover:text-indigo-600'
                    }`}
                  />
                  {isSuperadmin && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute -top-0.5 -right-0.5 ring-1 ring-white" />
                  )}
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
      )}
    </aside>
  );
};
