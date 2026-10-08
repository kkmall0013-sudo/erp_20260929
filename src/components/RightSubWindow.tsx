import React, { useState, useEffect } from 'react';
import { LeftNavId } from './LeftSubWindow';
import { Project, Company, ModuleKey, SystemConfig } from '../types/erp';
import {
  Calendar,
  Users,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Search,
  ExternalLink,
  GitFork,
  ArrowRight,
  Building2,
  FolderGit2,
  CheckCircle2,
  Clock,
  Printer,
  Save,
  Plus,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Send,
  Sliders,
  Ban,
  KeyRound
} from 'lucide-react';
import { FlowchartNavigator } from './FlowchartNavigator';
import { MainCanvasWorkspace } from './MainCanvasWorkspace';
import { DiscussionRoadmapView } from './DiscussionRoadmapView';
import { CompanySettingsWorkspace } from './CompanySettingsWorkspace';
import { AccountManagementWorkspace } from './AccountManagementWorkspace';
import { BusinessPartnerWorkspace } from './BusinessPartnerWorkspace';
import { useAuth } from '../context/AuthContext';
import {
  getAllSystemConfigs,
  updateSystemConfig,
  getAllBusinessPartners,
  getAllQuotations,
  getAllPurchaseOrders,
  getAllSubcontracts,
  getAllValuations,
  getAllBankChecks,
  recordAuditLog
} from '../db/sqlite';

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
}

const NAV_TO_MODULE_KEY: Record<LeftNavId, ModuleKey> = {
  COMPANY: 'COMPANIES',
  USERS: 'AUDIT_LOGS',
  DASHBOARD: 'PROJECTS',
  PROJECTS: 'PROJECTS',
  FLOWCHART: 'PROJECTS',
  PARTNERS: 'PARTNERS',
  QUOTATIONS: 'QUOTATIONS',
  PROCUREMENT: 'PURCHASE_ORDERS',
  VALUATIONS: 'VALUATIONS',
  FINANCE: 'BANK_CHECKS',
  COMMAND_CENTER: 'FINANCE_AP',
  ROADMAP: 'PROJECTS',
  SETTINGS: 'SYSTEM_CONFIGS',
};

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
}) => {
  const { currentUser, currentGroup, approvalLimit, isSuperadmin, can, checkApproval } = useAuth();
  const hasUserManagementAccess = isSuperadmin || Boolean(currentUser?.canManageUsers);

  const [showFlowchartInline, setShowFlowchartInline] = useState(false);
  const [moduleToast, setModuleToast] = useState<string | null>(null);
  const [testAmount, setTestAmount] = useState<number>(400000);
  const [systemConfigs, setSystemConfigs] = useState<SystemConfig[]>([]);
  const [editingConfigs, setEditingConfigs] = useState<Record<string, string>>({});

  const triggerModuleToast = (msg: string) => {
    setModuleToast(msg);
    setTimeout(() => setModuleToast(null), 4000);
  };

  useEffect(() => {
    if (activeNavId === 'SETTINGS') {
      const list = getAllSystemConfigs();
      setSystemConfigs(list);
      const map: Record<string, string> = {};
      list.forEach(c => {
        map[c.id] = c.configValue;
      });
      setEditingConfigs(map);
    }
  }, [activeNavId]);

  const currentProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null;
  const currentModuleKey = NAV_TO_MODULE_KEY[activeNavId];
  const canReadModule =
    activeNavId === 'USERS'
      ? hasUserManagementAccess
      : ['DASHBOARD', 'FLOWCHART', 'ROADMAP'].includes(activeNavId)
      ? true
      : activeNavId === 'PROCUREMENT'
      ? can('PURCHASE_ORDERS', 'read') || can('SUBCONTRACTS', 'read')
      : activeNavId === 'FINANCE'
      ? can('FINANCE_AP', 'read') || can('FINANCE_AR', 'read') || can('BANK_CHECKS', 'read')
      : can(currentModuleKey, 'read');
  const canWriteModule = can(currentModuleKey, 'write');
  const canApproveModule = can(currentModuleKey, 'approve');
  const canExportModule = can(currentModuleKey, 'export');

  // 標題文字依選取項切換
  const getPageTitle = () => {
    switch (activeNavId) {
      case 'COMPANY':
        return '集團與公司基本資料設定 (母子法人架構)';
      case 'USERS':
        return '使用者帳號與三層式身分管理 (密碼維護與特許授權)';
      case 'DASHBOARD':
        return '個人儀表板';
      case 'PROJECTS':
        return '專案與案場工程主檔';
      case 'FLOWCHART':
        return '鼎新 A1 業務流程圖導航';
      case 'PARTNERS':
        return '商業夥伴主檔管理';
      case 'QUOTATIONS':
        return '報價與銷售 (CPQ 核心引擎)';
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
      case 'SETTINGS':
        return '全域共用設定與底層參數';
      default:
        return '營造工程工作台';
    }
  };

  // =========================================================================
  // 攔截第一關：若該帳號已被停權 (DISABLED)，全系統畫面立即封鎖
  // =========================================================================
  if (currentUser?.status === 'DISABLED') {
    return (
      <main className="flex-1 h-[calc(100vh-48px)] overflow-y-auto bg-[#eef1f5] flex items-center justify-center p-8 select-none">
        <div className="bg-white rounded-2xl border-2 border-rose-300 shadow-lg max-w-lg w-full p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <Ban className="w-9 h-9" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span>⛔ 帳號停權凍結攔截 (Account Disabled)</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            您的帳號「{currentUser.fullName} ({currentUser.username})」目前已停權凍結
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            系統安全核心已攔截此帳號的所有模組存取、單據讀取與簽核權限。若需恢復存取，請由上方模擬切換器切換回「最高管理員」或「系統管理員」，並前往【帳號與權限管理】將此帳號狀態改回「正常啟用」。
          </p>
        </div>
      </main>
    );
  }

  // =========================================================================
  // 攔截第二關：PBAC 12大模組讀取權限檢核 (can(moduleKey, 'read') === false)
  // =========================================================================
  if (!canReadModule) {
    return (
      <main className="flex-1 h-[calc(100vh-48px)] overflow-y-auto bg-[#eef1f5] flex flex-col select-none">
        <div className="px-6 py-3.5 flex items-center justify-between shrink-0">
          <h1 className="text-xl font-normal text-slate-700 tracking-tight">
            {getPageTitle()}
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-md max-w-xl w-full p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>PBAC 模組權限防火牆已攔截存取</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              無權限存取【{getPageTitle()}】
            </h2>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-left text-xs space-y-2 text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">當前登入身分：</span>
                <span className="font-bold text-slate-800">{currentUser?.fullName} (@{currentUser?.username})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">所屬業務群組：</span>
                <span className="font-bold text-indigo-700">{currentGroup?.groupName || '未指派群組'} ({currentUser?.groupId})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">攔截原因：</span>
                <span className="font-bold text-rose-600">
                  {activeNavId === 'USERS'
                    ? '未開啟「帳號管理專人特許權 (canManageUsers)」'
                    : `該業務群組於【${currentModuleKey}】模組之讀取權限為關閉 (read: 0)`}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              💡 測試提示：您可以切換至「林董總 (Superadmin)」或具備帳號管理權限之帳號，進入【帳號與權限管理】➔ 點擊「12 大模組權限矩陣」，即可動態開啟或關閉此群組對本模組的「讀 / 寫 / 審 / 出」權限！
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => onNavigateNav('DASHBOARD')}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                返回個人儀表板
              </button>
              {hasUserManagementAccess && (
                <button
                  onClick={() => onNavigateNav('USERS')}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-xs transition-colors cursor-pointer"
                >
                  前往調整群組權限矩陣
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 h-[calc(100vh-48px)] overflow-y-auto bg-[#eef1f5] flex flex-col relative select-none">
      {/* 1. 右側子視窗固定頂部 Title 條 */}
      <div className="px-6 py-3.5 flex items-center justify-between shrink-0 bg-transparent">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-normal text-slate-700 tracking-tight">
            {getPageTitle()}
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>讀取授權通過 ({currentGroup?.groupName || currentUser?.role})</span>
          </span>
        </div>

        {/* 截圖右上角的經典 [流程圖 ⛶] 切換按鈕 */}
        <button
          onClick={() => setShowFlowchartInline(prev => !prev)}
          title="開啟 / 關閉 鼎新 A1 流程圖"
          className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs border cursor-pointer ${
            showFlowchartInline
              ? 'bg-indigo-600 text-white border-indigo-700'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <GitFork className="w-3.5 h-3.5" />
          <span>流程圖</span>
          <span className="text-[10px]">⛶</span>
        </button>
      </div>

      {/* 2. 流程圖展開視圖 */}
      {showFlowchartInline ? (
        <div className="px-6 pb-6 animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="text-xs font-bold text-slate-800">
                鼎新 A1 流程引擎 (點擊任一節點可直接穿透)
              </span>
              <button
                onClick={() => setShowFlowchartInline(false)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
              >
                關閉流程圖 &times;
              </button>
            </div>
            <FlowchartNavigator
              onNavigate={(tab) => {
                if (tab === 'PROJECTS') onNavigateNav('PROJECTS');
                else onNavigateNav('ROADMAP');
              }}
              stats={{
                projectsCount: projects.length,
                quotationsCount: 1,
                posCount: 3,
                valuationsCount: 2,
                checksCount: 4,
                apCount: 2,
                arCount: 1,
              }}
              metrics={{
                projectedNetCash: 38056625,
                currentBankBalance: 38500000,
                pendingCO: 8500000,
              }}
            />
          </div>
        </div>
      ) : null}

      {/* 3. 核心內容工作區 */}
      <div className="flex-1 px-6 pb-8 space-y-5">
        {/* 0. 公司設定視圖 */}
        {activeNavId === 'COMPANY' && (
          <CompanySettingsWorkspace
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            onSelectCompany={onSelectCompany}
            onDataChanged={onReloadData}
          />
        )}

        {/* 0.1 帳號管理視圖 */}
        {activeNavId === 'USERS' && (
          <AccountManagementWorkspace
            companies={companies}
            onDataChanged={onReloadData}
          />
        )}

        {/* A. 儀表板視圖 */}
        {activeNavId === 'DASHBOARD' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-md shadow-xs border border-slate-200 overflow-hidden flex h-24">
                <div className="w-24 bg-[#E05252] text-white flex flex-col items-center justify-center p-2 shrink-0">
                  <Calendar className="w-7 h-7 mb-1" />
                  <span className="text-xs font-bold">行程</span>
                </div>
                <div className="flex-1 p-3 flex flex-col justify-center text-xs space-y-1.5 bg-white">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>今日</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">0</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>本週</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">0</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-md shadow-xs border border-slate-200 overflow-hidden flex h-24">
                <div className="w-24 bg-[#00A896] text-white flex flex-col items-center justify-center p-2 shrink-0">
                  <Users className="w-7 h-7 mb-1" />
                  <span className="text-xs font-bold">新客</span>
                </div>
                <div className="flex-1 p-3 flex flex-col justify-center text-xs space-y-1.5 bg-white">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>本月</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">4</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>上月</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">5</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-md shadow-xs border border-slate-200 overflow-hidden flex h-24">
                <div className="w-24 bg-[#F5A623] text-white flex flex-col items-center justify-center p-2 shrink-0">
                  <TrendingUp className="w-7 h-7 mb-1" />
                  <span className="text-xs font-bold">商機</span>
                </div>
                <div className="flex-1 p-3 flex flex-col justify-center text-xs space-y-1 bg-white">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>新增</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">1</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>成交</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">0</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>停滯</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">23</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-md shadow-xs border border-slate-200 overflow-hidden flex h-24">
                <div className="w-24 bg-[#607D8B] text-white flex flex-col items-center justify-center p-2 shrink-0">
                  <Receipt className="w-7 h-7 mb-1" />
                  <span className="text-xs font-bold">油資</span>
                </div>
                <div className="flex-1 p-3 flex flex-col justify-center text-xs space-y-1 bg-white">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>未結算</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">1</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>未報銷</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">0</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>退件</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">0</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-md shadow-xs border border-slate-200 overflow-hidden">
                <div className="bg-[#607D8B] text-white px-4 py-2.5 text-xs font-bold tracking-wide">
                  銷售達成率
                </div>
                <div className="p-8 flex flex-col sm:flex-row items-center justify-around gap-6 min-h-[260px]">
                  <div className="relative w-40 h-40 rounded-full border-12 border-slate-100 flex items-center justify-center">
                    <span className="text-2xl font-bold text-slate-700 font-mono">0%</span>
                  </div>

                  <div className="space-y-3 text-xs text-slate-600 font-mono">
                    <div className="flex items-center gap-6">
                      <span className="text-slate-400">目標值</span>
                      <span className="font-bold text-slate-800 text-sm">65,000</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-slate-400">實際值</span>
                      <span className="font-bold text-slate-800 text-sm">0</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-md shadow-xs border border-slate-200 overflow-hidden">
                <div className="bg-[#607D8B] text-white px-4 py-2.5 text-xs font-bold tracking-wide">
                  商機漏斗
                </div>
                <div className="p-8 flex flex-col items-center justify-center min-h-[260px] text-slate-400 space-y-2">
                  <div className="w-16 h-20 border-2 border-slate-300 rounded bg-slate-50 flex items-center justify-center relative shadow-2xs">
                    <div className="space-y-1.5 w-10">
                      <div className="h-1 bg-slate-200 rounded" />
                      <div className="h-1 bg-slate-200 rounded" />
                      <div className="h-1 bg-slate-200 rounded" />
                    </div>
                    <Search className="w-8 h-8 text-slate-400 absolute -bottom-2 -right-2 bg-white rounded-full p-1 border border-slate-300 shadow-xs" />
                  </div>
                  <span className="text-xs text-slate-400 font-normal pt-2">
                    查無符合資料
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* B. 專案案場主檔 */}
        {activeNavId === 'PROJECTS' && (
          <div className="space-y-4">
            <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs shadow-2xs">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-slate-700">當前案場：</span>
                <select
                  value={selectedProjectId}
                  onChange={(e) => onSelectProjectId(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-bold text-slate-800 outline-none"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.projectCode}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-[11px] text-slate-400">
                向下滾動滑鼠，檢視左側子視窗與上方 TOP 是否 100% 保持不動
              </div>
            </div>

            <MainCanvasWorkspace
              project={currentProject}
              onDataChanged={onReloadData}
            />
          </div>
        )}

        {/* C. 系統架構討論與藍圖總綱 */}
        {activeNavId === 'ROADMAP' && (
          <DiscussionRoadmapView
            onSwitchToWorkspaceTest={() => onNavigateNav('PROJECTS')}
          />
        )}

        {/* D. 流程圖總覽 */}
        {activeNavId === 'FLOWCHART' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <FlowchartNavigator
              onNavigate={(tab) => {
                if (tab === 'PROJECTS') onNavigateNav('PROJECTS');
                else onNavigateNav('ROADMAP');
              }}
              stats={{
                projectsCount: projects.length,
                quotationsCount: 1,
                posCount: 3,
                valuationsCount: 2,
                checksCount: 4,
                apCount: 2,
                arCount: 1,
              }}
              metrics={{
                projectedNetCash: 38056625,
                currentBankBalance: 38500000,
                pendingCO: 8500000,
              }}
            />
          </div>
        )}

        {/* E. 全域共用設定與底層參數 (SETTINGS) ── 實機驗證 can('SYSTEM_CONFIGS', 'write') */}
        {activeNavId === 'SETTINGS' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>全域共用設定與營造內控底層參數 (system_configs)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  此頁面受 PBAC 權限矩陣【全域系統參數 (SYSTEM_CONFIGS)】及帳號管理之「全域系統參數配置權 (canManageSystemConfigs)」管控。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                  canWriteModule || currentUser?.canManageSystemConfigs
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {canWriteModule || currentUser?.canManageSystemConfigs
                    ? '✓ 具備參數修改權限 (Write Enabled)'
                    : '🔒 唯讀模式 (無修改權限)'}
                </span>
              </div>
            </div>

            <div className="p-6 divide-y divide-slate-200">
              {systemConfigs.map(cfg => (
                <div key={cfg.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {cfg.description || cfg.configKey}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {cfg.configKey}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">
                        型別：{cfg.valueType} (版本 v{cfg.version})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>生效起日：{cfg.validFrom}</span>
                      {cfg.updatedBy && <span>最後修改人：{cfg.updatedBy}</span>}
                      {cfg.updatedAt && <span>更新日期：{cfg.updatedAt}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingConfigs[cfg.id] ?? cfg.configValue}
                      onChange={(e) => setEditingConfigs(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white w-44 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button
                      onClick={() => {
                        const allowedToWrite = Boolean(isSuperadmin || canWriteModule || currentUser?.canManageSystemConfigs);
                        if (!allowedToWrite) {
                          triggerModuleToast(`⛔ 權限攔截：您目前的身分（${currentUser?.fullName}）無【全域系統參數】寫入權限，且未開啟「全域系統參數配置權」！`);
                          return;
                        }
                        try {
                          updateSystemConfig(
                            cfg.id,
                            editingConfigs[cfg.id] ?? cfg.configValue,
                            currentUser?.fullName || '系統操作員',
                            allowedToWrite
                          );
                          setSystemConfigs(getAllSystemConfigs());
                          triggerModuleToast(`✅ 已成功更新系統參數【${cfg.configKey}】並寫入中文稽核日誌！`);
                        } catch (err: any) {
                          triggerModuleToast(`⛔ 更新失敗：${err.message || String(err)}`);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        canWriteModule || currentUser?.canManageSystemConfigs
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : 'bg-rose-600 hover:bg-rose-700 text-white'
                      }`}
                    >
                      {canWriteModule || currentUser?.canManageSystemConfigs ? <Save className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>儲存參數</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* F. 其他核心業務模組 (PARTNERS, QUOTATIONS, PROCUREMENT, VALUATIONS, FINANCE, COMMAND_CENTER)
               提供真實 SQLite 資料檢視 + 互動式【讀 / 寫 / 審 / 出】權限實測沙盒 */}
        {![
          'COMPANY',
          'USERS',
          'DASHBOARD',
          'PROJECTS',
          'ROADMAP',
          'FLOWCHART',
          'SETTINGS',
          'PARTNERS'
        ].includes(activeNavId) && (
          <div className="space-y-4">
            {/* 頂部權限實測控制台 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {currentModuleKey}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      【{getPageTitle()}】PBAC 權限即時驗證工作台
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    目前登入：<strong className="text-slate-800">{currentUser?.fullName}</strong>（群組：<strong className="text-indigo-700">{currentGroup?.groupName || currentUser?.role}</strong>）── 可直接點擊下方按鈕實測本模組之「新增寫入、金額簽核、報表匯出」攔截與放行效果。
                  </p>
                </div>

                {/* 即時權限燈號 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ✓ 讀取 (r:1)
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${canWriteModule ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                    {canWriteModule ? '✓ 寫入 (w:1)' : '🔒 禁寫入 (w:0)'}
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${canApproveModule ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                    {canApproveModule
                      ? `✓ 簽核 (a:1 / 上限: ${approvalLimit === Infinity ? '無限額' : `NT$ ${approvalLimit.toLocaleString()}`})`
                      : '🔒 禁簽核 (a:0)'}
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${canExportModule ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                    {canExportModule ? '✓ 匯出 (e:1)' : '🔒 禁匯出 (e:0)'}
                  </span>
                </div>
              </div>

              {/* 四大權限實測按鈕列 */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    if (!canWriteModule) {
                      triggerModuleToast(`⛔ 寫入攔截：${currentUser?.fullName} (${currentGroup?.groupName || currentUser?.role}) 於【${getPageTitle()}】無寫入權限 (w:0)！`);
                      return;
                    }
                    recordAuditLog(
                      currentUser?.fullName || '系統操作員',
                      '新增單據',
                      getPageTitle(),
                      `${currentModuleKey}-TEST`,
                      { '操作模組': getPageTitle(), '執行結果': '寫入權限檢核通過' }
                    );
                    triggerModuleToast(`✅ 寫入放行：已成功執行【${getPageTitle()}】單據新增/儲存，並記錄至中文稽核日誌！`);
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    canWriteModule
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                  }`}
                >
                  {canWriteModule ? <Plus className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>測試「新增 / 寫入單據」</span>
                </button>

                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                  <select
                    value={testAmount}
                    onChange={(e) => setTestAmount(Number(e.target.value))}
                    className="bg-transparent text-xs font-mono font-bold text-slate-700 px-2.5 py-1.5 outline-none cursor-pointer"
                  >
                    <option value={100000}>測試簽核額：10 萬</option>
                    <option value={400000}>測試簽核額：40 萬 (工務50萬內)</option>
                    <option value={800000}>測試簽核額：80 萬 (逾工務50萬上限)</option>
                    <option value={1800000}>測試簽核額：180 萬 (採購200萬內)</option>
                    <option value={3500000}>測試簽核額：350 萬 (財務500萬內)</option>
                    <option value={8000000}>測試簽核額：800 萬 (僅總經理無限額)</option>
                  </select>
                  <button
                    onClick={() => {
                      const res = checkApproval(testAmount, currentModuleKey);
                      if (!res.allowed) {
                        triggerModuleToast(`⛔ 簽核攔截：${res.reason}`);
                        return;
                      }
                      recordAuditLog(
                        currentUser?.fullName || '系統操作員',
                        '核准單據',
                        getPageTitle(),
                        `${currentModuleKey}-APP`,
                        { '簽核單據金額': `NT$ ${testAmount.toLocaleString()}`, '簽核結果': '核准通過' }
                      );
                      triggerModuleToast(`✅ 簽核放行：${currentUser?.fullName} 已成功核准 NT$ ${testAmount.toLocaleString()} 之【${getPageTitle()}】單據！`);
                    }}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      canApproveModule
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  >
                    {canApproveModule ? <Send className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    <span>測試「呈核簽批」</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (!canExportModule) {
                      triggerModuleToast(`⛔ 匯出攔截：${currentUser?.fullName} (${currentGroup?.groupName || currentUser?.role}) 於【${getPageTitle()}】無匯出/列印權限 (e:0)！`);
                      return;
                    }
                    recordAuditLog(
                      currentUser?.fullName || '系統操作員',
                      '匯出報表',
                      getPageTitle(),
                      `${currentModuleKey}-EXP`,
                      { '匯出模組': getPageTitle(), '檔案格式': 'Excel / PDF' }
                    );
                    triggerModuleToast(`🖨️ 匯出放行：已成功匯出【${getPageTitle()}】Excel / PDF 報表！`);
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    canExportModule
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                  }`}
                >
                  {canExportModule ? <Printer className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>測試「匯出 / 列印報表」</span>
                </button>
              </div>
            </div>

            {/* 底層 SQLite 實機資料表預覽 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <h4 className="text-xs font-bold text-slate-800 mb-3">
                SQLite 資料庫【{getPageTitle()}】即時載入紀錄（通過讀取權限 r:1 始可檢視）
              </h4>
              {activeNavId === 'QUOTATIONS' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">報價單號</th>
                        <th className="p-2.5">版次</th>
                        <th className="p-2.5 text-right">總價 (含稅)</th>
                        <th className="p-2.5 text-center">業主名稱</th>
                        <th className="p-2.5 text-center">狀態</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {getAllQuotations().map(q => (
                        <tr key={q.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold">{q.quoteNumber}</td>
                          <td className="p-2.5 font-mono">{q.currentRevision}</td>
                          <td className="p-2.5 font-mono text-right font-bold">NT$ {q.totalAmount.toLocaleString()}</td>
                          <td className="p-2.5 text-center font-bold text-slate-700">{q.customerName}</td>
                          <td className="p-2.5 text-center">{q.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeNavId === 'PROCUREMENT' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">採購單號</th>
                        <th className="p-2.5">供應商名稱</th>
                        <th className="p-2.5 text-right">採購總額</th>
                        <th className="p-2.5 text-right">保留款扣減</th>
                        <th className="p-2.5 text-center">狀態</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {getAllPurchaseOrders().map(po => (
                        <tr key={po.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold">{po.poNumber}</td>
                          <td className="p-2.5 font-bold text-slate-800">{po.counterpartyNameSnapshot}</td>
                          <td className="p-2.5 font-mono text-right font-bold">NT$ {po.totalAmount.toLocaleString()}</td>
                          <td className="p-2.5 font-mono text-right text-rose-700">NT$ {po.retentionDeductionAmount.toLocaleString()}</td>
                          <td className="p-2.5 text-center">{po.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeNavId === 'VALUATIONS' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">估驗單號</th>
                        <th className="p-2.5">期別</th>
                        <th className="p-2.5 text-right">本期估驗總額</th>
                        <th className="p-2.5 text-right">實付淨額</th>
                        <th className="p-2.5 text-center">狀態</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {getAllValuations().map(v => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold">{v.valuationNumber}</td>
                          <td className="p-2.5">{v.periodName}</td>
                          <td className="p-2.5 font-mono text-right">NT$ {v.grossAmount.toLocaleString()}</td>
                          <td className="p-2.5 font-mono text-right font-bold text-indigo-700">NT$ {v.netPayableAmount.toLocaleString()}</td>
                          <td className="p-2.5 text-center">{v.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(activeNavId === 'FINANCE' || activeNavId === 'COMMAND_CENTER') && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">支票號碼</th>
                        <th className="p-2.5">開票銀行</th>
                        <th className="p-2.5">受款對象</th>
                        <th className="p-2.5 text-right">票面金額</th>
                        <th className="p-2.5 text-center">到期日</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {getAllBankChecks().map(chk => (
                        <tr key={chk.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold">{chk.checkNumber}</td>
                          <td className="p-2.5">{chk.bankName}</td>
                          <td className="p-2.5 font-bold text-slate-800">{chk.counterpartyName}</td>
                          <td className="p-2.5 font-mono text-right font-bold">NT$ {chk.amount.toLocaleString()}</td>
                          <td className="p-2.5 font-mono text-center">{chk.dueDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* G. 商業夥伴模組 (CRM & SRM 完整主檔管理：業主名冊 vs 合作廠商名冊雙頁籤) */}
        {activeNavId === 'PARTNERS' && (
          <BusinessPartnerWorkspace
            onNotify={triggerModuleToast}
          />
        )}
      </div>

      {/* 浮動提示 Toast */}
      {moduleToast && (
        <div className="fixed bottom-6 right-8 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 max-w-md">
          {moduleToast}
        </div>
      )}
    </main>
  );
};

