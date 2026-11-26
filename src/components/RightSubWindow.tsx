import React, { useState, useEffect, Suspense, lazy } from 'react';
import { LeftNavId } from './LeftSubWindow';
import { Project, Company, ModuleKey } from '../types/erp';
import { FolderGit2, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAppConfigMap, subscribeToDatabase } from '../db/sqlite';
import { DashboardOverviewWidgets } from './dashboard/DashboardOverviewWidgets';
import { AccountDisabledOverlay, ModuleAccessDeniedView } from './shell/RightAccessDeniedView';
import { ModulePbacSandboxPanel } from './shell/ModulePbacSandboxPanel';

const FlowchartNavigator = lazy(() =>
  import('./FlowchartNavigator').then(m => ({ default: m.FlowchartNavigator }))
);
const MainCanvasWorkspace = lazy(() =>
  import('./MainCanvasWorkspace').then(m => ({ default: m.MainCanvasWorkspace }))
);
const ProjectWorkspace = lazy(() =>
  import('./projects/ProjectWorkspace').then(m => ({ default: m.ProjectWorkspace }))
);
const BusinessPartnerWorkspace = lazy(() =>
  import('./BusinessPartnerWorkspace').then(m => ({ default: m.BusinessPartnerWorkspace }))
);
const UniversalVaultWorkspace = lazy(() =>
  import('./attachments/UniversalVaultWorkspace').then(m => ({ default: m.UniversalVaultWorkspace }))
);
const QuotationWorkspace = lazy(() =>
  import('./quotations/QuotationWorkspace').then(m => ({ default: m.QuotationWorkspace }))
);
const InboundWorkspace = lazy(() =>
  import('./InboundWorkspace').then(m => ({ default: m.InboundWorkspace }))
);
const FinanceCashierWorkspace = lazy(() =>
  import('./finance/FinanceCashierWorkspace').then(m => ({ default: m.FinanceCashierWorkspace }))
);
const SystemHubWorkspace = lazy(() =>
  import('./SystemHubWorkspace').then(m => ({ default: m.SystemHubWorkspace }))
);
const UniversalSearchSandbox = lazy(() =>
  import('./widgets/UniversalSearchSandbox').then(m => ({ default: m.UniversalSearchSandbox }))
);

interface RightSubWindowProps {
  activeNavId: LeftNavId;
  onNavigateNav: (id: LeftNavId) => void;
  projects: Project[];
  selectedProjectId: string;
  onSelectProjectId: (id: string) => void;
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onReloadData: () => void;
  onOpenDatabaseCenter?: () => void;
}

const NAV_TO_MODULE_KEY: Record<LeftNavId, ModuleKey> = {
  APP_SETTINGS: 'SYSTEM_CONFIGS',
  COMPANY: 'COMPANIES',
  USERS: 'AUDIT_LOGS',
  DASHBOARD: 'PROJECTS',
  PROJECTS: 'PROJECTS',
  FLOWCHART: 'PROJECTS',
  PARTNERS: 'PARTNERS',
  MINI_APPS: 'SYSTEM_CONFIGS',
  VAULT: 'SYSTEM_CONFIGS',
  QUOTATIONS: 'QUOTATIONS',
  INBOUND: 'INBOUND_RECEIPTS',
  PROCUREMENT: 'PURCHASE_ORDERS',
  VALUATIONS: 'VALUATIONS',
  FINANCE: 'BANK_CHECKS',
  COMMAND_CENTER: 'FINANCE_AP',
  TEST_SANDBOX: 'PARTNERS',
  ROADMAP: 'PROJECTS',
  SETTINGS: 'SYSTEM_CONFIGS'
};

function getPageTitleForNav(activeNavId: LeftNavId, brandName: string): string {
  switch (activeNavId) {
    case 'SETTINGS':
      return '系統設定與管理中樞 (System Hub)';
    case 'APP_SETTINGS':
      return '軟體程式設定 (App Engine Configs - Superadmin)';
    case 'COMPANY':
      return '基本資料營運法規中樞 (Operational Regulations Hub)';
    case 'USERS':
      return '使用者帳號與三層式身分管理 (密碼維護與特許授權)';
    case 'DASHBOARD':
      return `${brandName} 營運戰情儀表板 (Dashboard & Lifecycle Map)`;
    case 'PROJECTS':
      return '案場管理主檔 (工程專案與工區現地建檔)';
    case 'FLOWCHART':
      return `${brandName} 業務流程圖導航`;
    case 'PARTNERS':
      return '商業夥伴主檔管理';
    case 'QUOTATIONS':
      return '報價與預算管理 (CPQ 核心引擎)';
    case 'INBOUND':
      return '現場進貨管理工作台 (Inbound Goods Management)';
    case 'PROCUREMENT':
      return '採購與發包合約管理 (PO)';
    case 'VALUATIONS':
      return '合約與下包估驗計價模組';
    case 'FINANCE':
      return '財務會計與金流票據模組';
    case 'COMMAND_CENTER':
      return '營運戰情大腦與資金池 (BI)';
    case 'ROADMAP':
      return '系統架構討論與重構藍圖總綱';
    case 'VAULT':
      return '通用無紙化附件金庫與圖說工作桌 (Universal Vault & Workspace)';
    case 'MINI_APPS':
      return '通用小程式專區 (Mini-Apps Hub)';
    case 'TEST_SANDBOX':
      return '通用搜尋與權限隔離測試區（受中樞開關控制 · 唯讀不寫入資料庫）';
    default:
      return '營造工程工作台';
  }
}

export const RightSubWindow: React.FC<RightSubWindowProps> = ({
  activeNavId,
  onNavigateNav,
  projects,
  selectedProjectId,
  onSelectProjectId,
  companies,
  selectedCompanyId,
  onSelectCompany,
  onReloadData,
  onOpenDatabaseCenter
}) => {
  const { currentUser, currentGroup, isSuperadmin, isBoss, isAdmin, can } = useAuth();
  const hasUserManagementAccess = isSuperadmin || isBoss || Boolean(currentUser?.canManageUsers);

  const [moduleToast, setModuleToast] = useState<string | null>(null);
  const [appConfigMap, setAppConfigMap] = useState<Record<string, string>>({});
  const [projectSubTab, setProjectSubTab] = useState<'MANAGEMENT' | 'WBS'>('MANAGEMENT');

  useEffect(() => {
    const loadConfigs = () => {
      try {
        setAppConfigMap(getAppConfigMap());
      } catch (_) {}
    };
    loadConfigs();
    const unsubscribe = subscribeToDatabase(loadConfigs);
    return () => unsubscribe();
  }, []);

  const brandName = appConfigMap.APP_BRAND_NAME || '田頭';
  const isSandboxPublic = appConfigMap.APP_TEST_SANDBOX_PUBLIC === 'true';

  const triggerModuleToast = (msg: string) => {
    setModuleToast(msg);
    setTimeout(() => setModuleToast(null), 4000);
  };

  const currentProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null;
  const currentModuleKey = NAV_TO_MODULE_KEY[activeNavId];
  const canReadModule =
    activeNavId === 'USERS'
      ? hasUserManagementAccess
      : ['APP_SETTINGS', 'ROADMAP'].includes(activeNavId)
      ? isSuperadmin || isBoss
      : activeNavId === 'MINI_APPS'
      ? isSuperadmin || isBoss || isAdmin
      : ['COMPANY', 'SETTINGS'].includes(activeNavId)
      ? isSuperadmin || isBoss || isAdmin || Boolean(currentUser?.canManageSystemConfigs) || hasUserManagementAccess
      : activeNavId === 'TEST_SANDBOX'
      ? isSuperadmin || isSandboxPublic
      : ['DASHBOARD', 'VAULT'].includes(activeNavId)
      ? true
      : activeNavId === 'FLOWCHART'
      ? isSuperadmin || isAdmin
      : activeNavId === 'PROCUREMENT'
      ? can('PURCHASE_ORDERS', 'read') || can('SUBCONTRACTS', 'read')
      : activeNavId === 'FINANCE'
      ? can('FINANCE_AP', 'read') || can('FINANCE_AR', 'read') || can('BANK_CHECKS', 'read')
      : activeNavId === 'COMMAND_CENTER'
      ? isSuperadmin || isAdmin || (can('FINANCE_AP', 'read') && can('PROJECTS', 'read'))
      : can(currentModuleKey, 'read');

  useEffect(() => {
    if (!canReadModule && currentUser?.status === 'ACTIVE') {
      onNavigateNav('DASHBOARD');
    }
  }, [canReadModule, currentUser, onNavigateNav]);

  const canWriteModule = can(currentModuleKey, 'write');
  const canApproveModule = can(currentModuleKey, 'approve');
  const canExportModule = can(currentModuleKey, 'export');
  const pageTitle = getPageTitleForNav(activeNavId, brandName);

  if (currentUser?.status === 'DISABLED') {
    return <AccountDisabledOverlay currentUser={currentUser} />;
  }

  if (!canReadModule) {
    return (
      <ModuleAccessDeniedView
        pageTitle={pageTitle}
        activeNavId={activeNavId}
        currentModuleKey={currentModuleKey}
        currentUser={currentUser}
        currentGroup={currentGroup}
        hasUserManagementAccess={hasUserManagementAccess}
        onNavigateNav={onNavigateNav}
      />
    );
  }

  const isLegacyPbacSandboxNav = ![
    'APP_SETTINGS',
    'COMPANY',
    'USERS',
    'DASHBOARD',
    'PROJECTS',
    'ROADMAP',
    'FLOWCHART',
    'SETTINGS',
    'PARTNERS',
    'MINI_APPS',
    'VAULT',
    'QUOTATIONS',
    'INBOUND',
    'FINANCE',
    'TEST_SANDBOX'
  ].includes(activeNavId);

  return (
    <main className="flex-1 h-[calc(100vh-48px)] overflow-y-auto bg-[#eef1f5] flex flex-col relative select-none">
      {/* 1. 右側子視窗固定頂部 Title 條 */}
      <div className="px-6 py-3.5 flex items-center justify-between shrink-0 bg-transparent">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-normal text-slate-700 tracking-tight">
            {pageTitle}
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>讀取授權通過 ({currentGroup?.groupName || currentUser?.role})</span>
          </span>
        </div>
      </div>

      {/* 2. 核心內容工作區 */}
      <div className="flex-1 px-6 pb-8 space-y-5">
        <Suspense
          fallback={
            <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center justify-center gap-3 text-slate-500 shadow-xs">
              <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold">載入功能工作區模組中...</span>
            </div>
          }
        >
          {activeNavId === 'DASHBOARD' && (
            <DashboardOverviewWidgets
              projectsCount={projects.length}
              onNavigateNav={onNavigateNav}
            />
          )}

          {activeNavId === 'PROJECTS' && (
            <div className="space-y-4">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setProjectSubTab('MANAGEMENT')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                      projectSubTab === 'MANAGEMENT'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <FolderGit2 className="w-3.5 h-3.5" />
                    <span>案場管理主檔 (清冊與建檔)</span>
                  </button>
                  <button
                    onClick={() => setProjectSubTab('WBS')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                      projectSubTab === 'WBS'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>工程工料與 WBS 畫布</span>
                  </button>
                </div>

                {projectSubTab === 'WBS' && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">檢視工項案場：</span>
                    <select
                      value={selectedProjectId}
                      onChange={e => onSelectProjectId(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          [{p.projectCode}] {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {projectSubTab === 'MANAGEMENT' ? (
                <ProjectWorkspace
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  onSelectProjectId={onSelectProjectId}
                  companies={companies}
                  selectedCompanyId={selectedCompanyId}
                  onDataChanged={onReloadData}
                  triggerToast={triggerModuleToast}
                />
              ) : (
                <MainCanvasWorkspace
                  project={currentProject}
                  onDataChanged={onReloadData}
                />
              )}
            </div>
          )}

          {activeNavId === 'FLOWCHART' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <FlowchartNavigator
                onNavigate={tab => {
                  if (tab === 'PROJECTS') onNavigateNav('PROJECTS');
                  else onNavigateNav('SETTINGS');
                }}
                stats={{
                  projectsCount: projects.length,
                  quotationsCount: 1,
                  posCount: 3,
                  valuationsCount: 2,
                  checksCount: 4,
                  apCount: 2,
                  arCount: 1
                }}
                metrics={{
                  projectedNetCash: 38056625,
                  currentBankBalance: 38500000,
                  pendingCO: 8500000
                }}
              />
            </div>
          )}

          {['SETTINGS', 'COMPANY', 'APP_SETTINGS', 'USERS', 'MINI_APPS', 'ROADMAP'].includes(activeNavId) && (
            <SystemHubWorkspace
              initialTab={
                activeNavId === 'USERS'
                  ? 'USERS'
                  : activeNavId === 'APP_SETTINGS'
                  ? 'APP_SETTINGS'
                  : activeNavId === 'MINI_APPS'
                  ? 'MINI_APPS'
                  : activeNavId === 'ROADMAP'
                  ? 'ROADMAP'
                  : 'BASIC'
              }
              companies={companies}
              selectedCompanyId={selectedCompanyId}
              onSelectCompany={onSelectCompany}
              onDataChanged={onReloadData}
              triggerToast={triggerModuleToast}
              onOpenDatabaseCenter={onOpenDatabaseCenter}
              onSwitchToWorkspaceTest={() => onNavigateNav('PROJECTS')}
            />
          )}

          {isLegacyPbacSandboxNav && (
            <ModulePbacSandboxPanel
              activeNavId={activeNavId}
              pageTitle={pageTitle}
              currentModuleKey={currentModuleKey}
              canWriteModule={canWriteModule}
              canApproveModule={canApproveModule}
              canExportModule={canExportModule}
              onNotify={triggerModuleToast}
            />
          )}

          {activeNavId === 'PARTNERS' && (
            <BusinessPartnerWorkspace onNotify={triggerModuleToast} />
          )}

          {activeNavId === 'VAULT' && (
            <UniversalVaultWorkspace onNotify={triggerModuleToast} />
          )}

          {activeNavId === 'QUOTATIONS' && (
            <QuotationWorkspace onNotify={triggerModuleToast} />
          )}

          {activeNavId === 'INBOUND' && (
            <InboundWorkspace
              onDataChanged={onReloadData}
              triggerToast={triggerModuleToast}
            />
          )}

          {activeNavId === 'FINANCE' && (
            <FinanceCashierWorkspace
              onNotify={triggerModuleToast}
              onNavigateToInbound={() => onNavigateNav('INBOUND')}
            />
          )}

          {activeNavId === 'TEST_SANDBOX' && (
            <UniversalSearchSandbox onNotify={triggerModuleToast} />
          )}
        </Suspense>
      </div>

      {moduleToast && (
        <div className="fixed bottom-6 right-8 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 max-w-md">
          {moduleToast}
        </div>
      )}
    </main>
  );
};
