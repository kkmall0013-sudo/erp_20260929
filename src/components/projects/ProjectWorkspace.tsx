import React, { useState, useMemo, useEffect } from 'react';
import {
  FolderGit2,
  Plus,
  Search,
  Building2,
  DollarSign,
  Clock,
  Download,
  X,
  TrendingUp,
  FileText,
  Briefcase,
  Layers,
} from 'lucide-react';
import { Project, ProjectSite, Company, BusinessPartner, BuildingCategoryGroup } from '../../types/erp';
import { useAuth } from '../../context/AuthContext';
import {
  getAllProjectSites,
  createProjectRecord,
  updateProjectRecord,
  deleteProjectRecord,
  getAllBusinessPartners,
  getBuildingCategoryTree,
  getAppConfigMap,
  getAllAccountsReceivable,
  getAllArCollections,
  getAllProjectAdvances,
  getAllSystemConfigs,
  subscribeToDatabase,
} from '../../db/sqlite';
import { exportCsvFile } from '../../utils/csvExport';
import { matchesTaiwanRegion } from '../../utils/taiwanPostalCodes';
import { ConfirmDialogModal } from '../widgets/ConfirmDialogModal';
import { BuildingCategoryManagerModal } from './BuildingCategoryManagerModal';
import { ProjectVendorInboundModal } from './ProjectVendorInboundModal';
import { ProjectEditorModal } from './ProjectEditorModal';
import { ProjectDirectoryTable } from './ProjectDirectoryTable';
import { ProjectDetailModal } from './ProjectDetailModal';
import {
  CustomerBillingWorkflowMode,
  CustomerStatementMiniApp,
} from '../finance/CustomerStatementMiniApp';

// 🏛️ 建造建物類型標準分類
export const BUILDING_TYPES = [
  '集合住宅大樓',
  '商辦金融大樓',
  '廠辦與工業廠房',
  '透天別墅與住宅群',
  '鋼結構廠房與倉儲物流',
  '公共工程與文教展館',
  '醫療長照機構',
  '土地重劃與基盤工程',
  '商業零售商場',
  '專業室內裝修與改建',
  '其他特殊工程',
];

// 🏛️ 承攬工作內容與工程性質標準分類
export const WORK_SCOPES = [
  '統包新建工程',
  '建築結構主體工程',
  '室內裝修與機電消防工程',
  '外牆拉皮與結構補強工程',
  '基礎開挖與地質改良工程',
  '鋼結構吊裝工程',
  '連續壁與擋土排樁工程',
  '景觀綠美化與外部附屬工程',
  '舊建拆除與整地工程',
  '專業代工代料工程',
  '其他工程承攬',
];

interface ProjectWorkspaceProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProjectId?: (id: string) => void;
  companies: Company[];
  selectedCompanyId?: string;
  onDataChanged: () => void;
  triggerToast?: (msg: string) => void;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  projects,
  companies,
  onDataChanged,
  triggerToast = () => {},
}) => {
  const { currentUser, can } = useAuth();
  const canWrite = can('PROJECTS', 'write');

  // 本地專案現地工區資料與夥伴快取
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);

  // 篩選與搜尋
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PLANNING' | 'COMPLETED' | 'LOCKED'>('ALL');
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<string>('ALL');
  const [workScopeFilter, setWorkScopeFilter] = useState<string>('ALL');

  // Modal 狀態
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  // 建物與業務類型階層字典 (大項 -> 小項)
  const [categoryTree, setCategoryTree] = useState<BuildingCategoryGroup[]>(() => getBuildingCategoryTree());
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  // 對外客戶請款表小程式狀態 (依系統中樞 APP_CUSTOMER_BILLING_MODE 動態開啟)
  const [customerBillingMode, setCustomerBillingMode] = useState<CustomerBillingWorkflowMode>('FINANCE_ONLY');
  const [statementProject, setStatementProject] = useState<Project | null>(null);
  const [sanitizedBillingData, setSanitizedBillingData] = useState<{
    arList: ReturnType<typeof getAllAccountsReceivable>;
    arCollections: ReturnType<typeof getAllArCollections>;
    projectAdvances: ReturnType<typeof getAllProjectAdvances>;
    taxRate: number;
  }>({ arList: [], arCollections: [], projectAdvances: [], taxRate: 0.05 });

  // 廠商進料穿透檢視狀態
  const [drillingVendor, setDrillingVendor] = useState<{
    project: Project;
    partnerId: string;
    partnerName: string;
    workScope?: string;
    estimatedAmount?: number;
  } | null>(null);

  const refreshCategoryTree = () => {
    setCategoryTree(getBuildingCategoryTree());
  };

  // 載入現地資料、商業夥伴與流程權限設定
  useEffect(() => {
    const refreshData = () => {
      try {
        setSites(getAllProjectSites());
        setPartners(getAllBusinessPartners());
        const cfgMap = getAppConfigMap();
        const modeRaw = cfgMap.APP_CUSTOMER_BILLING_MODE;
        if (modeRaw === 'PROJECT_AND_FINANCE' || modeRaw === 'PROJECT_FIRST_HANDOFF') {
          setCustomerBillingMode(modeRaw);
        } else {
          setCustomerBillingMode('FINANCE_ONLY');
        }
        const sysCfgs = getAllSystemConfigs();
        const taxCfg = sysCfgs.find(c => c.configKey === 'TAX_RATE');
        const rawRate = taxCfg ? Number(String(taxCfg.configValue).replace('%', '').trim()) : 0.05;
        const taxRate = Number.isFinite(rawRate) && rawRate >= 0 ? (rawRate > 1 ? rawRate / 100 : rawRate) : 0.05;
        setSanitizedBillingData({
          arList: getAllAccountsReceivable(),
          arCollections: getAllArCollections(),
          projectAdvances: getAllProjectAdvances(),
          taxRate,
        });
      } catch (err) {
        console.error('Failed to load project sites or partners:', err);
      }
    };
    refreshData();
    const unsubscribe = subscribeToDatabase(() => {
      refreshData();
    });
    return () => {
      unsubscribe();
    };
  }, [projects]);

  const canOpenProjectStatement =
    customerBillingMode !== 'FINANCE_ONLY' && (can('PROJECTS', 'read') || can('FINANCE_AR', 'read'));

  // 現地工區 Mapping (projectId -> ProjectSite)
  const siteMap = useMemo(() => {
    const map = new Map<string, ProjectSite>();
    sites.forEach(s => map.set(s.projectId, s));
    return map;
  }, [sites]);

  // 篩選後之專案清單
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (buildingTypeFilter !== 'ALL' && p.buildingType !== buildingTypeFilter) return false;
      if (workScopeFilter !== 'ALL' && p.workScope !== workScopeFilter) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const site = siteMap.get(p.id);
        const matchCode = p.projectCode?.toLowerCase().includes(term);
        const matchName = p.name?.toLowerCase().includes(term);
        const matchBuildingType = p.buildingType?.toLowerCase().includes(term);
        const matchWorkScope = p.workScope?.toLowerCase().includes(term);
        const matchOwner = p.ownerName?.toLowerCase().includes(term);
        const matchDeveloper = site?.developerName?.toLowerCase().includes(term);
        const matchArchitect = site?.architect?.toLowerCase().includes(term);
        const matchConstructor = site?.constructor?.toLowerCase().includes(term);
        const matchShopDrawing = site?.shopDrawingVendorName?.toLowerCase().includes(term);
        const matchAddress =
          site?.address?.toLowerCase().includes(term) ||
          matchesTaiwanRegion(site?.address, searchTerm) ||
          (site?.addressHistory || []).some(
            h =>
              (h.fullAddress || '').toLowerCase().includes(term) ||
              matchesTaiwanRegion(h.fullAddress, searchTerm) ||
              matchesTaiwanRegion(h.city, searchTerm) ||
              matchesTaiwanRegion(h.district, searchTerm)
          );
        const matchPerson = site?.contactPerson?.toLowerCase().includes(term);
        const matchPermit = site?.permitNumber?.toLowerCase().includes(term);
        return (
          matchCode ||
          matchName ||
          matchBuildingType ||
          matchWorkScope ||
          matchOwner ||
          matchDeveloper ||
          matchArchitect ||
          matchConstructor ||
          matchShopDrawing ||
          matchAddress ||
          matchPerson ||
          matchPermit
        );
      }
      return true;
    });
  }, [projects, statusFilter, buildingTypeFilter, workScopeFilter, searchTerm, siteMap]);

  // KPI 彙總指標
  const kpiStats = useMemo(() => {
    const totalCount = projects.length;
    const activeCount = projects.filter(p => p.status === 'ACTIVE').length;
    const planningCount = projects.filter(p => p.status === 'PLANNING').length;
    const totalContract = projects.reduce((sum, p) => sum + (p.contractAmount || 0), 0);
    const totalCost = projects.reduce((sum, p) => sum + (p.actualCost || 0), 0);
    return { totalCount, activeCount, planningCount, totalContract, totalCost };
  }, [projects]);

  const handleOpenCreate = () => {
    if (!canWrite) {
      triggerToast(`⛔ 權限攔截：您的身分（${currentUser?.fullName}）對專案工程無寫入權限 (w:0)`);
      return;
    }
    setEditingProject(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (proj: Project) => {
    if (!canWrite) {
      triggerToast(`⛔ 權限攔截：您的身分（${currentUser?.fullName}）對專案工程無寫入權限 (w:0)`);
      return;
    }
    setEditingProject(proj);
    setIsEditorOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deletingProject) return;
    try {
      deleteProjectRecord(deletingProject.id, currentUser?.fullName || '使用者');
      triggerToast(`✓ 案場【${deletingProject.name}】已成功封存刪除！`);
      setDeletingProject(null);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`❌ 刪除失敗: ${err.message || err}`);
    }
  };

  const handleExportCsv = () => {
    if (projects.length === 0) {
      triggerToast('⚠️ 目前尚無案場資料可匯出');
      return;
    }
    const headers = [
      '專案代碼',
      '案場工程全銜',
      '建造建物類型',
      '工作內容與承攬性質',
      '簽約法人',
      '起造人/業主',
      '統一編號',
      '設計監造人',
      '承造人',
      '拆圖廠商',
      '建造執照字號',
      '基地座落地號',
      '施工現址',
      '工地主任',
      '工地聯絡電話',
      '合約總金額',
      '目標預算',
      '累計成本',
      '開工日期',
      '預計完工日',
      '狀態',
    ];
    const rows = projects.map(p => {
      const site = siteMap.get(p.id);
      const comp = companies.find(c => c.id === p.companyId);
      const compName = comp ? comp.name : p.companyId || '尚未確定';
      return [
        p.projectCode,
        p.name || '',
        p.buildingType || '未分類',
        p.workScope || '未分類',
        compName,
        site?.developerName || p.ownerName || '',
        p.ownerTaxId || '',
        site?.architect || '',
        site?.constructor || '',
        site?.shopDrawingVendorName || '',
        site?.permitNumber || '',
        site?.landNumber || '',
        site?.address || '',
        site?.contactPerson || '',
        site?.contactPhone || '',
        p.contractAmount || 0,
        p.budgetAmount || 0,
        p.actualCost || 0,
        p.startDate || '',
        p.endDate || '',
        p.status,
      ];
    });
    exportCsvFile({
      filename: `工程案場基本資料清冊_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
    });
    triggerToast('✓ 案場基本資料清冊 CSV 已成功匯出！');
  };

  return (
    <div className="space-y-5">
      {/* 1. 頂部營運指標摘要列 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <FolderGit2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">全部案場總數</div>
            <div className="text-xl font-bold text-slate-800 font-mono tabular-nums">
              {kpiStats.totalCount} <span className="text-xs font-normal text-slate-400">處</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">施工中案場</div>
            <div className="text-xl font-bold text-emerald-600 font-mono tabular-nums">
              {kpiStats.activeCount} <span className="text-xs font-normal text-slate-400">處</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">規劃籌備中</div>
            <div className="text-xl font-bold text-blue-600 font-mono tabular-nums">
              {kpiStats.planningCount} <span className="text-xs font-normal text-slate-400">處</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">合約總金額</div>
            <div className="text-lg font-bold text-slate-800 font-mono tabular-nums">
              NT$ {(kpiStats.totalContract / 10000).toLocaleString()} <span className="text-xs font-normal text-slate-400">萬</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">累計發生成本</div>
            <div className="text-lg font-bold text-rose-600 font-mono tabular-nums">
              NT$ {(kpiStats.totalCost / 10000).toLocaleString()} <span className="text-xs font-normal text-slate-400">萬</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 工具列：搜尋、狀態過濾、新增案場、匯出 CSV */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜尋案場代碼、工程全銜、起造人、監造建築師、拆圖廠商、現址..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
            {(
              [
                { id: 'ALL', label: '全部' },
                { id: 'ACTIVE', label: '施工中' },
                { id: 'PLANNING', label: '規劃中' },
                { id: 'COMPLETED', label: '已完工' },
                { id: 'LOCKED', label: '已結算' },
              ] as const
            ).map(item => (
              <button
                key={item.id}
                onClick={() => setStatusFilter(item.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === item.id
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <select
              value={buildingTypeFilter}
              onChange={(e) => setBuildingTypeFilter(e.target.value)}
              className="bg-transparent text-slate-700 font-bold outline-none text-xs cursor-pointer"
              title="依建造建物類型篩選 (第二階小項)"
            >
              <option value="ALL">全部建物類型</option>
              {categoryTree.map(grp => (
                <optgroup key={grp.id} label={`【${grp.name}】`}>
                  {grp.items.filter(i => i.isActive).map(item => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Briefcase className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <select
              value={workScopeFilter}
              onChange={(e) => setWorkScopeFilter(e.target.value)}
              className="bg-transparent text-slate-700 font-bold outline-none text-xs cursor-pointer"
              title="依工作內容/承攬性質篩選"
            >
              <option value="ALL">全部工作內容</option>
              {WORK_SCOPES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCategoryManagerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="自訂管理建造物與業務項目階層字典 (新增大項與第二階小項)"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>自訂類型管理</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="匯出為 CSV 試算表"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>匯出 CSV</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>新增案場建檔</span>
          </button>
        </div>
      </div>

      {/* 3. 案場清冊資料表 (拆出子元件) */}
      <ProjectDirectoryTable
        filteredProjects={filteredProjects}
        siteMap={siteMap}
        companies={companies}
        searchTerm={searchTerm}
        canWrite={canWrite}
        canOpenProjectStatement={canOpenProjectStatement}
        onResetFilters={() => {
          setSearchTerm('');
          setStatusFilter('ALL');
        }}
        onViewProject={(p) => setViewingProject(p)}
        onOpenStatement={(p) => setStatementProject(p)}
        onEditProject={handleOpenEdit}
        onDeleteProject={(p) => setDeletingProject(p)}
      />

      {/* 4. 新增 / 編輯案場 Modal */}
      {isEditorOpen && (
        <ProjectEditorModal
          isOpen={isEditorOpen}
          initialProject={editingProject}
          initialSite={editingProject ? siteMap.get(editingProject.id) || null : null}
          companies={companies}
          partners={partners}
          categoryTree={categoryTree}
          onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
          onClose={() => setIsEditorOpen(false)}
          onSave={(projectData, siteData) => {
            try {
              if (editingProject) {
                updateProjectRecord(editingProject.id, projectData, siteData, currentUser?.fullName || '管理者');
                triggerToast(`✓ 案場【${projectData.name || editingProject.name}】資料已成功更新！`);
              } else {
                const newProj = createProjectRecord(projectData, siteData, currentUser?.fullName || '管理者');
                triggerToast(`✓ 案場【${newProj.name}】已成功建檔！專案代碼：${newProj.projectCode}`);
              }
              setIsEditorOpen(false);
              onDataChanged();
            } catch (err: any) {
              triggerToast(`❌ 儲存失敗: ${err.message || err}`);
            }
          }}
        />
      )}

      {/* 5. 案場詳情檢視 Modal (拆出子元件) */}
      {viewingProject && (
        <ProjectDetailModal
          project={viewingProject}
          site={siteMap.get(viewingProject.id) || null}
          companies={companies}
          onEdit={() => {
            const p = viewingProject;
            setViewingProject(null);
            handleOpenEdit(p);
          }}
          onClose={() => setViewingProject(null)}
          onOpenCustomerStatement={
            canOpenProjectStatement
              ? () => {
                  const p = viewingProject;
                  setViewingProject(null);
                  setStatementProject(p);
                }
              : undefined
          }
          onDrillVendor={(proj, partnerId, partnerName, workScope, estimatedAmount) => {
            setDrillingVendor({
              project: proj,
              partnerId,
              partnerName,
              workScope,
              estimatedAmount,
            });
          }}
        />
      )}

      {/* 5-B. 案場調用「對外客戶請款／對帳明細表」獨立小程式 Modal */}
      {statementProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 print:bg-white print:p-0 print:static">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden print:shadow-none print:border-0 print:max-h-none">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2 print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    [{statementProject.projectCode}] {statementProject.name} · 對外客戶請款明細表小程式
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    業主：{statementProject.ownerName || '未建檔'} ·{' '}
                    {customerBillingMode === 'PROJECT_FIRST_HANDOFF'
                      ? '工務送審模式（可送交會計立帳開票）'
                      : '雙軌調用模式（與財務機密完全隔離）'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatementProject(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 print:overflow-visible print:p-6">
              <CustomerStatementMiniApp
                project={statementProject}
                arList={sanitizedBillingData.arList}
                arCollections={sanitizedBillingData.arCollections}
                projectAdvances={sanitizedBillingData.projectAdvances}
                taxRate={sanitizedBillingData.taxRate}
                workflowMode={customerBillingMode}
                canSubmitToAccounting={
                  canWrite &&
                  (customerBillingMode === 'PROJECT_FIRST_HANDOFF' || customerBillingMode === 'PROJECT_AND_FINANCE')
                }
                operatorName={currentUser?.fullName || '工務承辦'}
                onNotify={(msg) => triggerToast(msg)}
                onAfterSubmit={() => {
                  onDataChanged();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. 刪除確認 Modal (調用公用 ConfirmDialogModal) */}
      <ConfirmDialogModal
        isOpen={Boolean(deletingProject)}
        variant="danger"
        title="確定刪除此工程案場？"
        message={
          deletingProject ? (
            <span>
              您即將軟刪除【{deletingProject.name}】（代碼：{deletingProject.projectCode}
              ）。此操作將標記刪除並於審計日誌留下軌跡，後續仍可透過資料庫管理進行追溯。
            </span>
          ) : null
        }
        extraNotice={
          deletingProject ? (
            <div className="space-y-1 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">業主/起造人：</span>
                <span className="font-semibold">{deletingProject.ownerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">合約金額：</span>
                <span className="font-mono tabular-nums">NT$ {deletingProject.contractAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">累計成本：</span>
                <span className="font-mono tabular-nums text-rose-600">NT$ {deletingProject.actualCost.toLocaleString()}</span>
              </div>
            </div>
          ) : undefined
        }
        confirmText="確認封存刪除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingProject(null)}
      />

      {/* 7. 建造物與工作業務類型階層管理 Modal */}
      <BuildingCategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => {
          setIsCategoryManagerOpen(false);
          refreshCategoryTree();
        }}
        onSaved={() => {
          refreshCategoryTree();
          triggerToast('✓ 建物與業務類別階層字典已成功更新！');
        }}
      />

      {/* 8. 協力廠商進料與請款穿透檢視 Modal */}
      {drillingVendor && (
        <ProjectVendorInboundModal
          isOpen={Boolean(drillingVendor)}
          project={drillingVendor.project}
          partnerId={drillingVendor.partnerId}
          partnerName={drillingVendor.partnerName}
          workScope={drillingVendor.workScope}
          estimatedAmount={drillingVendor.estimatedAmount}
          onClose={() => setDrillingVendor(null)}
        />
      )}
    </div>
  );
};
