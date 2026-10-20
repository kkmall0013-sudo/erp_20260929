import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Building2,
  UserCog,
  Sparkles,
  ClipboardList,
  ShieldAlert,
  Info,
  CheckCircle2,
  Lock,
  ExternalLink
} from 'lucide-react';
import { Company } from '../types/erp';
import { useAuth } from '../context/AuthContext';
import { BasicSettingsHubWorkspace } from './BasicSettingsHubWorkspace';
import { AccountManagementWorkspace } from './AccountManagementWorkspace';
import { AppSettingsWorkspace } from './AppSettingsWorkspace';
import { MiniAppsWorkspace } from './MiniAppsWorkspace';
import { DiscussionRoadmapView } from './DiscussionRoadmapView';

export type SystemHubTab = 'BASIC' | 'USERS' | 'APP_SETTINGS' | 'MINI_APPS' | 'ROADMAP';

interface SystemHubWorkspaceProps {
  initialTab?: SystemHubTab;
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onDataChanged: () => void;
  triggerToast: (msg: string) => void;
  onOpenDatabaseCenter?: () => void;
  onSwitchToWorkspaceTest?: () => void;
}

export const SystemHubWorkspace: React.FC<SystemHubWorkspaceProps> = ({
  initialTab = 'BASIC',
  companies,
  selectedCompanyId,
  onSelectCompany,
  onDataChanged,
  triggerToast,
  onOpenDatabaseCenter,
  onSwitchToWorkspaceTest
}) => {
  const { currentUser, isSuperadmin, isAdmin } = useAuth();
  const hasUserManagementAccess = isSuperadmin || Boolean(currentUser?.canManageUsers);

  // 定義分頁清單與權限檢核
  const allTabs: {
    id: SystemHubTab;
    label: string;
    subLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    isPermitted: boolean;
    roleBadge?: string;
  }[] = [
    {
      id: 'BASIC',
      label: '營運基本資料',
      subLabel: '法人 · 稅制 · 合約 · 編碼 · 備份',
      icon: Building2,
      isPermitted: isSuperadmin || isAdmin,
      roleBadge: 'Admin / 最高管理'
    },
    {
      id: 'USERS',
      label: '帳號與權限管理',
      subLabel: '三層身分矩陣 · PBAC · 審批額 · 稽核',
      icon: UserCog,
      isPermitted: hasUserManagementAccess,
      roleBadge: isSuperadmin ? 'Superadmin' : '特許 Admin'
    },
    {
      id: 'APP_SETTINGS',
      label: '軟體程式設定',
      subLabel: '抬頭 · 版本 · 主題色 · 公告廣播 · Flags',
      icon: SlidersHorizontal,
      isPermitted: isSuperadmin,
      roleBadge: 'Superadmin 專屬'
    },
    {
      id: 'MINI_APPS',
      label: '常用小程式庫',
      subLabel: '郵遞區號 · 全國 414 家金融機構速查',
      icon: Sparkles,
      isPermitted: isSuperadmin || isAdmin,
      roleBadge: '共用工具庫'
    },
    {
      id: 'ROADMAP',
      label: '藍圖總綱與規約',
      subLabel: '憲法規約 · 架構討論綱要 · 模組清冊',
      icon: ClipboardList,
      isPermitted: isSuperadmin,
      roleBadge: 'Superadmin 專屬'
    }
  ];

  // 過濾當前使用者可存取之分頁
  const permittedTabs = allTabs.filter(t => t.isPermitted);

  const [activeTab, setActiveTab] = useState<SystemHubTab>(() => {
    if (initialTab && permittedTabs.some(t => t.id === initialTab)) {
      return initialTab;
    }
    return permittedTabs[0]?.id || 'BASIC';
  });

  // 當使用者切換身分或權限變更時，若當前 Tab 無權限，自動跳轉至第一個合法分頁
  useEffect(() => {
    if (permittedTabs.length > 0 && !permittedTabs.some(t => t.id === activeTab)) {
      setActiveTab(permittedTabs[0].id);
    }
  }, [permittedTabs, activeTab]);

  if (permittedTabs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-rose-200 p-8 text-center max-w-lg mx-auto mt-12 shadow-sm">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900 mb-1">無系統中樞管理存取權限</h3>
        <p className="text-xs text-slate-500">
          您的帳號角色為「{currentUser?.role || '同仁'}」，本管理中樞僅供「系統管理員 (Admin)」與「最高管理員 (Superadmin)」使用。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 頂部整合分頁導航列 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5 mb-2.5 px-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">系統設定與管理中樞 (System Hub)</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                  {currentUser?.role === 'SUPERADMIN' ? '👑 最高管理全權模式' : '🛡️ 管理員授權模式'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                將營運基本資料、帳號權限、程式設定、通用小程式庫與藍圖總綱統一整併於底層中樞，依角色身分精確授權分流。
              </p>
            </div>
          </div>
        </div>

        {/* 分頁按鈕群 */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          {permittedTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-200'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <div className="text-left">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>{tab.label}</span>
                    {tab.roleBadge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-normal ${
                          isActive
                            ? 'bg-indigo-700/80 text-indigo-100'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {tab.roleBadge}
                      </span>
                    )}
                  </div>
                  <div className={`text-[10px] hidden md:block ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {tab.subLabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 分頁工作區本體內容 */}
      <div>
        {/* 1. 營運基本資料 */}
        {activeTab === 'BASIC' && (
          <BasicSettingsHubWorkspace
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            onSelectCompany={onSelectCompany}
            onDataChanged={onDataChanged}
            triggerToast={triggerToast}
            onOpenDatabaseCenter={onOpenDatabaseCenter}
          />
        )}

        {/* 2. 帳號與權限管理 */}
        {activeTab === 'USERS' && (
          <AccountManagementWorkspace
            companies={companies}
            onDataChanged={onDataChanged}
          />
        )}

        {/* 3. 軟體程式設定 */}
        {activeTab === 'APP_SETTINGS' && (
          <AppSettingsWorkspace
            triggerToast={triggerToast}
            onConfigChanged={onDataChanged}
          />
        )}

        {/* 4. 常用小程式庫 */}
        {activeTab === 'MINI_APPS' && (
          <MiniAppsWorkspace
            onNotify={triggerToast}
          />
        )}

        {/* 5. 藍圖總綱與規約手冊 */}
        {activeTab === 'ROADMAP' && (
          <DiscussionRoadmapView
            onSwitchToWorkspaceTest={onSwitchToWorkspaceTest || (() => {})}
          />
        )}
      </div>
    </div>
  );
};
