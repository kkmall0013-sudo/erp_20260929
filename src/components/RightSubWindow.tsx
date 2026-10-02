import React, { useState } from 'react';
import { LeftNavId } from './LeftSubWindow';
import { Project, Company } from '../types/erp';
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
  Plus
} from 'lucide-react';
import { FlowchartNavigator } from './FlowchartNavigator';
import { MainCanvasWorkspace } from './MainCanvasWorkspace';
import { DiscussionRoadmapView } from './DiscussionRoadmapView';
import { CompanySettingsWorkspace } from './CompanySettingsWorkspace';
import { AccountManagementWorkspace } from './AccountManagementWorkspace';
import { useAuth } from '../context/AuthContext';

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
  const { currentUser, isSuperadmin } = useAuth();
  const hasUserManagementAccess = isSuperadmin || Boolean(currentUser?.canManageUsers);

  // 安全防護：若當前同仁非專人且在 USERS 頁面，自動安全回退至個人儀表板
  React.useEffect(() => {
    if (activeNavId === 'USERS' && !hasUserManagementAccess) {
      onNavigateNav('DASHBOARD');
    }
  }, [activeNavId, hasUserManagementAccess, onNavigateNav]);

  const [showFlowchartInline, setShowFlowchartInline] = useState(false);

  const currentProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null;

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

  return (
    <main className="flex-1 h-[calc(100vh-48px)] overflow-y-auto bg-[#eef1f5] flex flex-col relative select-none">
      {/* 1. 右側子視窗固定頂部 Title 條 (對應截圖中的「個人儀表板 ── [流程圖 ⛶]」) */}
      <div className="px-6 py-3.5 flex items-center justify-between shrink-0 bg-transparent">
        <h1 className="text-xl font-normal text-slate-700 tracking-tight">
          {getPageTitle()}
        </h1>

        {/* 截圖右上角的經典 [流程圖 ⛶] 切換按鈕 */}
        <button
          onClick={() => setShowFlowchartInline(prev => !prev)}
          title="開啟 / 關閉 鼎新 A1 流程圖"
          className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs border ${
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

      {/* 2. 流程圖展開視圖 (若使用者點擊右上角流程圖鈕) */}
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

      {/* 3. 核心內容工作區 (根據左側選取的子視窗功能呈現) */}
      <div className="flex-1 px-6 pb-8 space-y-5">
        {/* ======================================================== */}
        {/* 0. 公司設定視圖 (核心聚焦：集團多法人與老闆個人帳戶)       */}
        {/* ======================================================== */}
        {activeNavId === 'COMPANY' && (
          <CompanySettingsWorkspace
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            onSelectCompany={onSelectCompany}
            onDataChanged={onReloadData}
          />
        )}

        {/* ======================================================== */}
        {/* 0.1 帳號管理視圖 (三層式身分、密碼重設與全域特許授權)      */}
        {/* ======================================================== */}
        {activeNavId === 'USERS' && (
          <AccountManagementWorkspace
            companies={companies}
            onDataChanged={onReloadData}
          />
        )}

        {/* ======================================================== */}
        {/* A. 儀表板視圖 (完全比照截圖之版面規則：4 色塊卡 + 2 大面板)  */}
        {/* ======================================================== */}
        {activeNavId === 'DASHBOARD' && (
          <div className="space-y-5">
            {/* 上半部：4 個經典鼎新色彩統計卡片 (行程、新客、商機、油資/票據) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 卡片 1: 紅色系 block (行程 / 工區案件) */}
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

              {/* 卡片 2: 青綠色系 block (新客 / 估驗計價) */}
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

              {/* 卡片 3: 橘黃色系 block (商機 / 發包合約) */}
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

              {/* 卡片 4: 鋼灰藍色系 block (油資 / 財務票據) */}
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

            {/* 下半部：2 個經典灰色 Header 面板 (銷售達成率 + 商機漏斗) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* 左側面板：銷售達成率 (圓形進度儀表) */}
              <div className="bg-white rounded-md shadow-xs border border-slate-200 overflow-hidden">
                <div className="bg-[#607D8B] text-white px-4 py-2.5 text-xs font-bold tracking-wide">
                  銷售達成率
                </div>
                <div className="p-8 flex flex-col sm:flex-row items-center justify-around gap-6 min-h-[260px]">
                  {/* 圓環進度環 (比照截圖 0%) */}
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

              {/* 右側面板：商機漏斗 (空資料示意：文件 + 放大鏡圖示) */}
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

        {/* ======================================================== */}
        {/* B. 專案案場主檔 (外殼手感測試：超寬長清單滾動，左側完全靜止) */}
        {/* ======================================================== */}
        {activeNavId === 'PROJECTS' && (
          <div className="space-y-4">
            {/* 案場快速切換器 (供測試不同專案切換) */}
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

            {/* 案場主內容畫布 */}
            <MainCanvasWorkspace
              project={currentProject}
              onDataChanged={onReloadData}
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* C. 系統架構討論與藍圖總綱 (保留所有先前討論結論)           */}
        {/* ======================================================== */}
        {activeNavId === 'ROADMAP' && (
          <DiscussionRoadmapView
            onSwitchToWorkspaceTest={() => onNavigateNav('PROJECTS')}
          />
        )}

        {/* ======================================================== */}
        {/* D. 流程圖總覽                                            */}
        {/* ======================================================== */}
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

        {/* 其他尚未實裝之模組，提示即將依序聚焦開發 */}
        {![
          'COMPANY',
          'USERS',
          'DASHBOARD',
          'PROJECTS',
          'ROADMAP',
          'FLOWCHART'
        ].includes(activeNavId) && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 space-y-3 shadow-xs">
            <Building2 className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-base font-bold text-slate-700">
              【{getPageTitle()}】模組排程中
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              目前架構已全面對齊鼎新 A1 視窗切割規範。確認版面配置手感滿意後，我們將按照規劃依序進行本模組的精雕開發！
            </p>
            <button
              onClick={() => onNavigateNav('DASHBOARD')}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
            >
              返回個人儀表板
            </button>
          </div>
        )}
      </div>
    </main>
  );
};
