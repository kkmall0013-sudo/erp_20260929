import React, { useState, useMemo, useEffect } from 'react';
import {
  FolderGit2,
  Plus,
  Search,
  Filter,
  Building2,
  MapPin,
  Phone,
  User,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Lock,
  Edit3,
  Trash2,
  Eye,
  Download,
  AlertTriangle,
  X,
  Save,
  Check,
  TrendingUp,
  Package,
  FileText,
  BadgeAlert,
  DraftingCompass,
  Landmark,
  HardHat,
  Briefcase,
  Info
} from 'lucide-react';
import { Project, ProjectSite, Company, BusinessPartner, InboundReceipt } from '../../types/erp';
import { useAuth } from '../../context/AuthContext';
import {
  getAllProjects,
  getAllProjectSites,
  createProjectRecord,
  updateProjectRecord,
  deleteProjectRecord,
  previewNextDocumentNumber,
  getAllBusinessPartners,
  getAllInboundReceipts
} from '../../db/sqlite';
import { PartnerSearchSelect } from '../widgets/PartnerSearchSelect';
import { TaiwanIdTaxValidatorWidget } from '../widgets/TaiwanIdTaxValidatorWidget';
import { validateTaiwanTaxId } from '../../utils/taiwanValidation';

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
  triggerToast = () => {}
}) => {
  const { currentUser, can } = useAuth();
  const canWrite = can('PROJECTS', 'write');

  // 本地專案現地工區資料與夥伴快取
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);

  // 篩選與搜尋
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PLANNING' | 'COMPLETED' | 'LOCKED'>('ALL');

  // Modal 狀態
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  // 載入現地資料與商業夥伴
  useEffect(() => {
    try {
      setSites(getAllProjectSites());
      setPartners(getAllBusinessPartners());
    } catch (err) {
      console.error('Failed to load project sites or partners:', err);
    }
  }, [projects]);

  // 現地工區 Mapping (projectId -> ProjectSite)
  const siteMap = useMemo(() => {
    const map = new Map<string, ProjectSite>();
    sites.forEach(s => map.set(s.projectId, s));
    return map;
  }, [sites]);

  // 篩選後之專案清單
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // 狀態篩選
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;

      // 關鍵字搜尋
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const site = siteMap.get(p.id);
        const matchCode = p.projectCode?.toLowerCase().includes(term);
        const matchName = p.name?.toLowerCase().includes(term);
        const matchOwner = p.ownerName?.toLowerCase().includes(term);
        const matchDeveloper = site?.developerName?.toLowerCase().includes(term);
        const matchArchitect = site?.architect?.toLowerCase().includes(term);
        const matchConstructor = site?.constructor?.toLowerCase().includes(term);
        const matchShopDrawing = site?.shopDrawingVendorName?.toLowerCase().includes(term);
        const matchAddress = site?.address?.toLowerCase().includes(term);
        const matchPerson = site?.contactPerson?.toLowerCase().includes(term);
        const matchPermit = site?.permitNumber?.toLowerCase().includes(term);
        return (
          matchCode ||
          matchName ||
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
  }, [projects, statusFilter, searchTerm, siteMap]);

  // KPI 彙總指標
  const kpiStats = useMemo(() => {
    const totalCount = projects.length;
    const activeCount = projects.filter(p => p.status === 'ACTIVE').length;
    const planningCount = projects.filter(p => p.status === 'PLANNING').length;
    const totalContract = projects.reduce((sum, p) => sum + (p.contractAmount || 0), 0);
    const totalCost = projects.reduce((sum, p) => sum + (p.actualCost || 0), 0);

    return { totalCount, activeCount, planningCount, totalContract, totalCost };
  }, [projects]);

  // 開啟新增專案彈窗
  const handleOpenCreate = () => {
    if (!canWrite) {
      triggerToast(`⛔ 權限攔截：您的身分（${currentUser?.fullName}）對專案工程無寫入權限 (w:0)`);
      return;
    }
    setEditingProject(null);
    setIsEditorOpen(true);
  };

  // 開啟編輯專案彈窗
  const handleOpenEdit = (proj: Project) => {
    if (!canWrite) {
      triggerToast(`⛔ 權限攔截：您的身分（${currentUser?.fullName}）對專案工程無寫入權限 (w:0)`);
      return;
    }
    setEditingProject(proj);
    setIsEditorOpen(true);
  };

  // 確定刪除專案
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

  // 匯出 CSV 清冊
  const handleExportCsv = () => {
    if (projects.length === 0) {
      triggerToast('⚠️ 目前尚無案場資料可匯出');
      return;
    }
    const headers = [
      '專案代碼',
      '案場工程全銜',
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
      '狀態'
    ];
    const rows = projects.map(p => {
      const site = siteMap.get(p.id);
      const comp = companies.find(c => c.id === p.companyId);
      const compName = comp ? comp.name : (p.companyId ? p.companyId : '尚未確定');
      return [
        `"${p.projectCode}"`,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${compName}"`,
        `"${(site?.developerName || p.ownerName || '').replace(/"/g, '""')}"`,
        `"${p.ownerTaxId || ''}"`,
        `"${(site?.architect || '').replace(/"/g, '""')}"`,
        `"${(site?.constructor || '').replace(/"/g, '""')}"`,
        `"${(site?.shopDrawingVendorName || '').replace(/"/g, '""')}"`,
        `"${(site?.permitNumber || '').replace(/"/g, '""')}"`,
        `"${(site?.landNumber || '').replace(/"/g, '""')}"`,
        `"${(site?.address || '').replace(/"/g, '""')}"`,
        `"${(site?.contactPerson || '').replace(/"/g, '""')}"`,
        `"${site?.contactPhone || ''}"`,
        p.contractAmount || 0,
        p.budgetAmount || 0,
        p.actualCost || 0,
        `"${p.startDate || ''}"`,
        `"${p.endDate || ''}"`,
        `"${p.status}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `工程案場基本資料清冊_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('✓ 案場基本資料清冊 CSV 已成功匯出！');
  };

  // 狀態轉換 Helper
  const getStatusBadge = (status: Project['status']) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            施工中
          </span>
        );
      case 'PLANNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" />
            規劃中
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <CheckCircle2 className="w-3 h-3" />
            已完工
          </span>
        );
      case 'LOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Lock className="w-3 h-3" />
            結算封存
          </span>
        );
      default:
        return null;
    }
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
            <div className="text-xl font-bold text-slate-800 font-mono">{kpiStats.totalCount} <span className="text-xs font-normal text-slate-400">處</span></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">施工中案場</div>
            <div className="text-xl font-bold text-emerald-600 font-mono">{kpiStats.activeCount} <span className="text-xs font-normal text-slate-400">處</span></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">規劃籌備中</div>
            <div className="text-xl font-bold text-blue-600 font-mono">{kpiStats.planningCount} <span className="text-xs font-normal text-slate-400">處</span></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">合約總金額</div>
            <div className="text-lg font-bold text-slate-800 font-mono">
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
            <div className="text-lg font-bold text-rose-600 font-mono">
              NT$ {(kpiStats.totalCost / 10000).toLocaleString()} <span className="text-xs font-normal text-slate-400">萬</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 工具列：搜尋、狀態過濾、新增案場、匯出 CSV */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* 關鍵字搜尋 */}
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

          {/* 狀態過濾按鈕組 */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
            {(
              [
                { id: 'ALL', label: '全部' },
                { id: 'ACTIVE', label: '施工中' },
                { id: 'PLANNING', label: '規劃中' },
                { id: 'COMPLETED', label: '已完工' },
                { id: 'LOCKED', label: '已結算' }
              ] as const
            ).map(item => (
              <button
                key={item.id}
                onClick={() => setStatusFilter(item.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === item.id
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            title="匯出為 CSV 試算表"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>匯出 CSV</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新增案場建檔</span>
          </button>
        </div>
      </div>

      {/* 3. 案場清冊資料表 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredProjects.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <FolderGit2 className="w-12 h-12 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">查無符合條件的案場資料</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              目前無匹配搜尋關鍵字之專案案場，您可以點擊「新增案場建檔」建立新工程案場，或清除搜尋過濾條件。
            </p>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                }}
                className="px-3 py-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
              >
                重設篩選條件
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold tracking-wide">
                  <th className="py-3 px-4 w-12 text-center">狀態</th>
                  <th className="py-3 px-4">專案代碼 / 工程全銜</th>
                  <th className="py-3 px-4">合約甲方(發票買受人) / 起造人</th>
                  <th className="py-3 px-4">法定團隊 (監造/承造/拆圖)</th>
                  <th className="py-3 px-4">工區現址 / 執照字號</th>
                  <th className="py-3 px-4 text-right">合約總額 / 預算</th>
                  <th className="py-3 px-4 text-right">已支成本 / 執行率</th>
                  <th className="py-3 px-4">工程期程</th>
                  <th className="py-3 px-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map((p) => {
                  const site = siteMap.get(p.id);
                  const budgetRate = p.budgetAmount > 0 ? Math.min(100, Math.round((p.actualCost / p.budgetAmount) * 100)) : 0;
                  const isOverBudget = p.budgetAmount > 0 && p.actualCost > p.budgetAmount;
                  const comp = companies.find(c => c.id === p.companyId);
                  const compName = comp ? (comp.shortName || comp.name) : (p.companyId ? p.companyId : null);

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* 狀態 Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(p.status)}
                      </td>

                      {/* 專案代碼 & 案場名稱 */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
                            {p.projectCode}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-slate-800 mt-1 hover:text-indigo-600 transition-colors">
                          {p.name}
                        </div>
                      </td>

                      {/* 合約甲方 (發票開立對象) / 執照法定起造人 / 簽約承攬乙方 */}
                      <td className="py-3.5 px-4">
                        {/* 甲方 / 發票買受人全銜 */}
                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span title="合約甲方全銜 (發票開立對象)">{p.ownerName}</span>
                          {p.ownerTaxId && (
                            <span className="font-mono text-slate-400 text-[10px]">({p.ownerTaxId})</span>
                          )}
                        </div>

                        {/* 若執照法定起造人與發票買受人不同，以顯著紫標分流呈現 */}
                        {site?.developerName && site.developerName !== p.ownerName ? (
                          <div className="text-[11px] text-purple-700 mt-1 flex items-center gap-1 font-medium bg-purple-50/80 px-1.5 py-0.5 rounded border border-purple-200/60 w-fit">
                            <span className="text-[9px] font-bold text-purple-800">執照起造人:</span>
                            <span className="font-semibold">{site.developerName}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            起造人同發票買受人
                          </div>
                        )}

                        {/* 承攬簽約乙方 */}
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                          {compName ? (
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-medium">
                              乙方：{compName}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                              乙方未定
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 法定團隊 (設計監造人 / 承造人 / 拆圖廠商) */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 text-[11px]">
                          <div className="text-slate-700 flex items-center gap-1">
                            <span className="text-slate-400 shrink-0">監造:</span>
                            <span className="font-medium truncate max-w-[130px]">{site?.architect || '未登錄'}</span>
                          </div>
                          <div className="text-slate-700 flex items-center gap-1">
                            <span className="text-slate-400 shrink-0">承造:</span>
                            <span className="font-medium truncate max-w-[130px]">{site?.constructor || '未登錄'}</span>
                          </div>
                          <div className="text-indigo-700 flex items-center gap-1 font-medium">
                            <DraftingCompass className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="text-slate-400 shrink-0">拆圖:</span>
                            <span className="truncate max-w-[130px]">{site?.shopDrawingVendorName || '未指定'}</span>
                          </div>
                        </div>
                      </td>

                      {/* 工區現址 / 執照字號 */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-700 flex items-center gap-1 max-w-[180px] truncate" title={site?.address}>
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="truncate">{site?.address || '未填寫現址'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                          {site?.permitNumber ? (
                            <span className="font-mono text-indigo-600 bg-indigo-50/70 px-1 rounded text-[10px]">
                              {site.permitNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">建照未載</span>
                          )}
                          {site?.contactPerson && (
                            <span className="text-slate-600 text-[10px]">
                              主任:{site.contactPerson}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 合約總額 / 預算 */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-bold text-slate-800">
                          NT$ {p.contractAmount?.toLocaleString() || 0}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          預算: NT$ {p.budgetAmount?.toLocaleString() || 0}
                        </div>
                      </td>

                      {/* 已支成本 / 執行率 */}
                      <td className="py-3.5 px-4 text-right">
                        <div className={`font-mono font-bold ${isOverBudget ? 'text-rose-600' : 'text-slate-700'}`}>
                          NT$ {p.actualCost?.toLocaleString() || 0}
                        </div>
                        <div className="flex items-center justify-end gap-1.5 mt-1">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isOverBudget ? 'bg-rose-500' : budgetRate > 80 ? 'bg-amber-500' : 'bg-indigo-500'
                              }`}
                              style={{ width: `${budgetRate}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-mono ${isOverBudget ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                            {budgetRate}%
                          </span>
                        </div>
                      </td>

                      {/* 工程期程 */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-600 font-mono text-[11px] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{p.startDate || '未定'}</span>
                        </div>
                        <div className="text-slate-400 font-mono text-[11px] pl-4 mt-0.5">
                          ~ {p.endDate || '進行中'}
                        </div>
                      </td>

                      {/* 操作功能欄 (移除設為當前按鈕) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setViewingProject(p)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="檢視案場詳情"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {canWrite && (
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                              title="編輯案場資料"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {canWrite && (
                            <button
                              onClick={() => setDeletingProject(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="刪除案場"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. 新增 / 編輯案場 Modal */}
      {isEditorOpen && (
        <ProjectEditorModal
          isOpen={isEditorOpen}
          initialProject={editingProject}
          initialSite={editingProject ? siteMap.get(editingProject.id) || null : null}
          companies={companies}
          partners={partners}
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

      {/* 5. 案場詳情檢視 Modal */}
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
        />
      )}

      {/* 6. 刪除確認 Modal */}
      {deletingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">確定刪除此工程案場？</h3>
              <p className="text-xs text-slate-500">
                您即將軟刪除【{deletingProject.name}】（代碼：{deletingProject.projectCode}）。此操作將標記刪除並於審計日誌留下軌跡，後續仍可透過資料庫管理進行追溯。
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-400">業主/起造人：</span>
                <span className="font-medium text-slate-800">{deletingProject.ownerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">合約金額：</span>
                <span className="font-mono text-slate-800">NT$ {deletingProject.contractAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">累計成本：</span>
                <span className="font-mono text-rose-600">NT$ {deletingProject.actualCost.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingProject(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-2xs cursor-pointer"
              >
                確認封存刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 🏛️ 專案案場 新增/編輯 Modal (ProjectEditorModal)
// ============================================================================
interface ProjectEditorModalProps {
  isOpen: boolean;
  initialProject: Project | null;
  initialSite: ProjectSite | null;
  companies: Company[];
  partners: BusinessPartner[];
  onClose: () => void;
  onSave: (projectData: Partial<Project>, siteData: Partial<ProjectSite>) => void;
}

const ProjectEditorModal: React.FC<ProjectEditorModalProps> = ({
  isOpen,
  initialProject,
  initialSite,
  companies,
  partners,
  onClose,
  onSave
}) => {
  const isEditing = Boolean(initialProject);

  // 專案代碼：依據系統設定動態預覽，不可手動修改
  const [projectCode, setProjectCode] = useState('');

  // 專案基本資料
  const [name, setName] = useState(initialProject?.name || '');
  // 所屬法人支援未定 (空字串代表未定)
  const [companyId, setCompanyId] = useState<string>(initialProject?.companyId || '');
  const [ownerName, setOwnerName] = useState(initialProject?.ownerName || '');
  const [ownerTaxId, setOwnerTaxId] = useState(initialProject?.ownerTaxId || '');
  const [status, setStatus] = useState<Project['status']>(initialProject?.status || 'ACTIVE');
  const [contractAmount, setContractAmount] = useState<number>(initialProject?.contractAmount || 0);
  const [budgetAmount, setBudgetAmount] = useState<number>(initialProject?.budgetAmount || 0);
  const [startDate, setStartDate] = useState(initialProject?.startDate || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initialProject?.endDate || '');

  // 工區現地與法定主體資料
  const [siteName, setSiteName] = useState(initialSite?.siteName || '');
  const [address, setAddress] = useState(initialSite?.address || '');
  const [contactPerson, setContactPerson] = useState(initialSite?.contactPerson || '');
  const [contactPhone, setContactPhone] = useState(initialSite?.contactPhone || '');
  const [permitNumber, setPermitNumber] = useState(initialSite?.permitNumber || '');
  const [developerName, setDeveloperName] = useState(initialSite?.developerName || initialProject?.ownerName || '');
  const [architect, setArchitect] = useState(initialSite?.architect || '');
  const [constructorName, setConstructorName] = useState(initialSite?.constructor || '');
  const [shopDrawingVendorId, setShopDrawingVendorId] = useState(initialSite?.shopDrawingVendorId || '');
  const [shopDrawingVendorName, setShopDrawingVendorName] = useState(initialSite?.shopDrawingVendorName || '');
  const [landNumber, setLandNumber] = useState(initialSite?.landNumber || '');

  // 錯誤提示
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 初始化專案代碼：從 document_sequence_rules 讀取既定格式動態預覽
  useEffect(() => {
    if (isEditing && initialProject) {
      setProjectCode(initialProject.projectCode);
    } else {
      try {
        const previewCode = previewNextDocumentNumber('PRJ');
        setProjectCode(previewCode);
      } catch (err) {
        setProjectCode('PRJ-2026-自動配發');
      }
    }
  }, [isEditing, initialProject]);

  // 同步工區名稱與起造人
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing && (!siteName || siteName === name)) {
      setSiteName(val);
    }
  };

  const handleOwnerChange = (val: string) => {
    setOwnerName(val);
    if (!developerName || developerName === ownerName) {
      setDeveloperName(val);
    }
  };

  // 快速選擇業主商業夥伴帶入
  const handleSelectPartner = (partnerId: string) => {
    const p = partners.find(item => item.id === partnerId);
    if (p) {
      handleOwnerChange(p.name);
      setOwnerTaxId(p.taxId || '');
    }
  };

  // 選擇拆圖廠商
  const handleSelectShopDrawingVendor = (partnerId: string) => {
    setShopDrawingVendorId(partnerId);
    const p = partners.find(item => item.id === partnerId);
    if (p) {
      setShopDrawingVendorName(p.name);
    } else if (!partnerId) {
      setShopDrawingVendorName('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('請填寫案場工程全銜名稱');
      return;
    }
    if (!ownerName.trim()) {
      setErrorMessage('請填寫或選擇起造人/業主單位全銜');
      return;
    }
    if (contractAmount < 0 || budgetAmount < 0) {
      setErrorMessage('金額不可為負數');
      return;
    }
    if (ownerTaxId.trim()) {
      const taxValidation = validateTaiwanTaxId(ownerTaxId.trim());
      if (!taxValidation.isValid) {
        setErrorMessage(`業主統一編號格式或加權校驗未通過：${taxValidation.message}，請核對或修正。`);
        return;
      }
    }

    onSave(
      {
        name: name.trim(),
        companyId: companyId.trim(),
        ownerName: ownerName.trim(),
        ownerTaxId: ownerTaxId.trim(),
        status,
        contractAmount,
        budgetAmount,
        startDate,
        endDate
      },
      {
        siteName: (siteName.trim() || name.trim()),
        address: address.trim(),
        contactPerson: contactPerson.trim(),
        contactPhone: contactPhone.trim(),
        permitNumber: permitNumber.trim(),
        developerName: (developerName.trim() || ownerName.trim()),
        architect: architect.trim(),
        constructor: constructorName.trim(),
        shopDrawingVendorId: shopDrawingVendorId.trim(),
        shopDrawingVendorName: shopDrawingVendorName.trim(),
        landNumber: landNumber.trim()
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Modal 頂部 Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {isEditing ? `編輯案場工程：${initialProject?.name}` : '建立新工程案場基本資料'}
              </h2>
              <p className="text-[11px] text-slate-500">
                依據系統設定格式自動配號，登錄法定起造、監造、承造、拆圖廠商與工區資訊
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表單內容 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 區塊 1: 專案核心基本資訊 */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5">
              <FolderGit2 className="w-4 h-4 text-indigo-600" />
              <span>一、專案案場核心資訊</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  專案代碼 <span className="text-[10px] text-indigo-600 font-bold">(系統既定格式自動配發)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={projectCode}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold text-slate-700 cursor-not-allowed select-none"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                    {isEditing ? '唯讀主鍵' : '預覽配號'}
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  案場工程全銜 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="例如：台北信義 A21 頂級商辦大樓新建工程"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  所屬簽約承攬公司法人 (乙方)
                </label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                >
                  <option value="">【尚未確定】（待後續簽約/請款時決定）</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      [{c.companyCode}] {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  工程狀態
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Project['status'])}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                >
                  <option value="ACTIVE">施工中 (ACTIVE)</option>
                  <option value="PLANNING">規劃籌備中 (PLANNING)</option>
                  <option value="COMPLETED">已完工驗收 (COMPLETED)</option>
                  <option value="LOCKED">已結算封存 (LOCKED)</option>
                </select>
              </div>
            </div>

            {/* 合約甲方 (發票開立買受人) 與 統一編號 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div className="sm:col-span-2">
                <PartnerSearchSelect
                  label="合約甲方全銜 / 發票買受人全銜 (開立發票抬頭 B)"
                  required
                  partnerTypeFilter="CUSTOMER"
                  placeholder="輸入關鍵字篩選或另建客戶 (如: B開發、富鼎、宏)..."
                  value={ownerName}
                  onSelect={(partner, manualName) => {
                    if (partner) {
                      setOwnerName(partner.name);
                      setOwnerTaxId(partner.taxId || '');
                      if (!developerName) {
                        setDeveloperName(partner.name);
                      }
                    } else if (manualName !== undefined) {
                      setOwnerName(manualName);
                      if (!developerName) {
                        setDeveloperName(manualName);
                      }
                    }
                  }}
                  allowQuickCreate={true}
                  quickCreateDefaultType="CUSTOMER"
                  quickCreateDefaultCategory="業主建設"
                  helperText="合約發票開立對象（甲方 B）。若與建照起造人 A 不同，下方起造人欄位可獨立指定。"
                />
              </div>

              <div>
                <TaiwanIdTaxValidatorWidget
                  label="業主統一編號 (8 碼)"
                  type="TAX_ID"
                  value={ownerTaxId}
                  onChange={(val) => setOwnerTaxId(val)}
                  placeholder="例如：28457226"
                  showExplanation={true}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 選取上方夥伴後自動帶入，調用通用檢驗小程式即時執行財政部模數校驗
                </p>
              </div>
            </div>
          </div>

          {/* 區塊 2: 建築執照法定主體與專業拆圖協力廠商 */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5">
              <DraftingCompass className="w-4 h-4 text-purple-600" />
              <span>二、建造執照法定團隊與拆圖協力廠商</span>
            </div>

            {/* 起造人 vs 發票買受人分流說明 Banner */}
            <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-slate-700">
              <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-purple-900">營造實務架構說明（起造人 A vs. 合約發票抬頭 B）：</span>
                <span className="text-slate-600">
                  當遇到「<strong>起造人 A</strong>」與「<strong>合約請款發票買受人 B</strong>」為不同主體時（例如：甲方為 B 開發營造有限公司、起造人為投資地主 A、乙方為本公司），請直接在下方起造人欄位填寫 A。系統在請款單與發票開立時將對齊甲方 B，執照與現勘工務對齊起造人 A！
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-700 flex items-center gap-1">
                    <span>執照法定起造人 (A)</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  {ownerName && developerName !== ownerName && (
                    <button
                      type="button"
                      onClick={() => setDeveloperName(ownerName)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                      title="若起造人同合約發票抬頭，點擊一鍵帶入"
                    >
                      同發票抬頭
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={developerName}
                  onChange={(e) => setDeveloperName(e.target.value)}
                  placeholder="起造人全銜 (如: 陳大為 或 地主A)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  執照法定起造人 (A)
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  設計監造人 (建築師事務所 / 結構技師)
                </label>
                <input
                  type="text"
                  value={architect}
                  onChange={(e) => setArchitect(e.target.value)}
                  placeholder="例如：大元聯合建築師事務所 / 誠業結構技師"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  承造人 (營造廠全銜 / 專任工程人員)
                </label>
                <input
                  type="text"
                  value={constructorName}
                  onChange={(e) => setConstructorName(e.target.value)}
                  placeholder="例如：大巨營造股份有限公司 / 林主任技師"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <PartnerSearchSelect
                  label="拆圖協力廠商 (專業結構 / 施工大樣圖 / 鋼筋拆圖)"
                  partnerTypeFilter="SHOP_DRAWING"
                  categoryFilter="拆圖"
                  quickCreateDefaultType="VENDOR"
                  quickCreateDefaultCategory="專業技術顧問與測量設計 / 拆圖廠商 / 施工大樣圖拆圖"
                  placeholder="輸入關鍵字篩選拆圖廠商 (如: 宏、結構、拆圖)..."
                  selectedPartnerId={shopDrawingVendorId}
                  value={shopDrawingVendorName}
                  onSelect={(partner, manualName) => {
                    if (partner) {
                      setShopDrawingVendorId(partner.id);
                      setShopDrawingVendorName(partner.name);
                    } else {
                      setShopDrawingVendorId('');
                      setShopDrawingVendorName(manualName || '');
                    }
                  }}
                  allowQuickCreate={true}
                  helperText="打字即時篩選（如打「宏」即自動列出宏聯等廠商），查無可彈窗直接建檔！"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  拆圖廠商備註 / 補充出圖料單說明
                </label>
                <input
                  type="text"
                  value={shopDrawingVendorName}
                  onChange={(e) => setShopDrawingVendorName(e.target.value)}
                  placeholder="例如：宏聯結構工程拆圖顧問有限公司 (樑柱接頭施工大樣)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  亦可在此手動調整名稱快照或補充工程拆圖註記
                </p>
              </div>
            </div>
          </div>

          {/* 區塊 3: 工區現地與執照座落 */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5">
              <MapPin className="w-4 h-4 text-rose-500" />
              <span>三、工區現地、執照與工地主任</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  建造執照字號
                </label>
                <input
                  type="text"
                  value={permitNumber}
                  onChange={(e) => setPermitNumber(e.target.value)}
                  placeholder="例如：(114)北市建字第00234號"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  基地座落地號
                </label>
                <input
                  type="text"
                  value={landNumber}
                  onChange={(e) => setLandNumber(e.target.value)}
                  placeholder="例如：南港段一小段 123-1 地號等 3 筆"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  工區別名 / 現地名稱
                </label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="工區別名（預設同工程全銜）"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  施工現址 (工區工地地址)
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="例如：台北市南港區經貿二路 188 號"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  工地主任姓名
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="例如：林工務主任"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                工地現場聯絡電話
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="例如：0912-345-678 或 02-2788-9900"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none max-w-sm"
              />
            </div>
          </div>

          {/* 區塊 4: 財務合約與期程目標 */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>四、合約金額、目標預算與工程期程</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  合約總金額 (NT$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={contractAmount}
                  onChange={(e) => setContractAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-right"
                />
                <div className="text-[10px] text-slate-400 text-right mt-1 font-mono">
                  約 NT$ {(contractAmount / 10000).toLocaleString()} 萬元
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  目標工程預算 (NT$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-right"
                />
                <div className="text-[10px] text-slate-400 text-right mt-1 font-mono">
                  約 NT$ {(budgetAmount / 10000).toLocaleString()} 萬元
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  開工日期
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  預計完工日期
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 底部按鈕 */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isEditing ? '儲存案場修改' : '立即建立案場 (系統自動配號)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 🏛️ 案場詳情檢視 Modal (ProjectDetailModal)
// ============================================================================
interface ProjectDetailModalProps {
  project: Project;
  site: ProjectSite | null;
  companies: Company[];
  onEdit: () => void;
  onClose: () => void;
}

const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  site,
  companies,
  onEdit,
  onClose
}) => {
  // 取得此案場的現場進料單據列表
  const inboundReceipts = useMemo(() => {
    try {
      return getAllInboundReceipts({ projectId: project.id });
    } catch (_) {
      return [];
    }
  }, [project.id]);

  const budgetUsagePct = project.budgetAmount > 0 ? Math.round((project.actualCost / project.budgetAmount) * 100) : 0;
  const grossMargin = project.contractAmount - project.budgetAmount;
  const grossMarginRate = project.contractAmount > 0 ? Math.round((grossMargin / project.contractAmount) * 100) : 0;

  const comp = companies.find(c => c.id === project.companyId);
  const compName = comp ? comp.name : (project.companyId ? project.companyId : '尚未確定（待請款簽約時決定）');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                  {project.projectCode}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  project.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : project.status === 'PLANNING'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {project.status === 'ACTIVE' ? '施工中' : project.status === 'PLANNING' ? '規劃中' : project.status === 'COMPLETED' ? '已完工' : '已結算'}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">
                {project.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>修改資料</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 內容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* 財務與預算 KPI 卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">合約承攬總額</div>
              <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                NT$ {project.contractAmount.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                含稅總承攬價
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">目標工程預算</div>
              <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                NT$ {project.budgetAmount.toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium mt-1">
                預估毛利：NT$ {grossMargin.toLocaleString()} ({grossMarginRate}%)
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">累計已發生成本</div>
              <div className={`text-base font-bold font-mono mt-0.5 ${project.actualCost > project.budgetAmount ? 'text-rose-600' : 'text-slate-900'}`}>
                NT$ {project.actualCost.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                進料與工程累計支出
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">預算執行率</div>
              <div className="text-base font-bold text-indigo-700 font-mono mt-0.5">
                {budgetUsagePct}%
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full ${budgetUsagePct > 100 ? 'bg-rose-500' : budgetUsagePct > 80 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                  style={{ width: `${Math.min(100, budgetUsagePct)}%` }}
                />
              </div>
            </div>
          </div>

          {/* 法定團隊、執照與工區現況 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 左側：業主與建造執照法定團隊 */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <DraftingCompass className="w-4 h-4 text-purple-600" />
                <span>建造執照法定主體與拆圖</span>
              </div>
              <div className="space-y-2.5 text-slate-600">
                <div className="flex justify-between items-start">
                  <span className="text-slate-400 shrink-0">合約發票甲方 (B)：</span>
                  <div className="text-right">
                    <span className="font-bold text-slate-800">{project.ownerName}</span>
                    {project.ownerTaxId && (
                      <div className="text-[10px] font-mono text-slate-400">統編: {project.ownerTaxId}</div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-start bg-purple-50/60 p-2 rounded-lg border border-purple-100">
                  <div>
                    <span className="text-purple-800 font-bold block">執照法定起造人 (A)：</span>
                    <span className="text-[10px] text-purple-600">建物所有權 / 投資人</span>
                  </div>
                  <span className="font-bold text-purple-900 text-sm">
                    {site?.developerName || project.ownerName}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">簽約承攬乙方：</span>
                  <span className="font-medium text-slate-800">{compName}</span>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span className="text-slate-400 flex items-center gap-1">
                    <DraftingCompass className="w-3.5 h-3.5 text-indigo-500" />
                    <span>拆圖協力廠商：</span>
                  </span>
                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {site?.shopDrawingVendorName || '未指定拆圖廠商'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">設計監造人：</span>
                  <span className="font-medium text-slate-800">{site?.architect || '未登錄'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">承造人：</span>
                  <span className="font-medium text-slate-800">{site?.constructor || '未登錄'}</span>
                </div>
              </div>
            </div>

            {/* 右側：工區現地與施工管理 */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <MapPin className="w-4 h-4 text-rose-500" />
                <span>工區現地與施工執照資訊</span>
              </div>
              <div className="space-y-2 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">施工現址：</span>
                  <span className="font-semibold text-slate-800 text-right">{site?.address || '未填寫現址'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">基地座落地號：</span>
                  <span className="font-medium text-slate-800">{site?.landNumber || '未登錄地號'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">建造執照字號：</span>
                  <span className="font-mono text-indigo-700 font-bold">{site?.permitNumber || '未登錄'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">工區現地別名：</span>
                  <span className="font-medium text-slate-800">{site?.siteName || project.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">工地主任姓名：</span>
                  <span className="font-bold text-slate-800">{site?.contactPerson || '未指派'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">工地聯絡電話：</span>
                  <span className="font-mono text-slate-800">{site?.contactPhone || '未登錄'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">工程期程：</span>
                  <span className="font-mono text-slate-800">{project.startDate || '未定'} ~ {project.endDate || '進行中'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 現場材料進貨簽收單關聯 (穿透檢視) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-indigo-600" />
                <span>此案場之材料進貨簽收單據（即時累計成本來源）</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                共 {inboundReceipts.length} 筆進料簽收
              </span>
            </div>

            {inboundReceipts.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                此案場目前尚無材料進貨簽收單據
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <th className="py-2 px-3">單據號碼</th>
                      <th className="py-2 px-3">供應商</th>
                      <th className="py-2 px-3">簽收日期</th>
                      <th className="py-2 px-3">簽收人</th>
                      <th className="py-2 px-3 text-right">進料金額</th>
                      <th className="py-2 px-3 text-center">過帳狀態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {inboundReceipts.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-indigo-700">
                          {rec.receiptNumber}
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-800">
                          {rec.vendorNameSnapshot}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {rec.receivedDate}
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-700">
                          {rec.receivedBy}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          NT$ {rec.totalAmount.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                            rec.status === 'POSTED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {rec.status === 'POSTED' ? '已過帳入成本' : '草稿未過帳'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 底部關閉按鈕 */}
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            關閉檢視
          </button>
        </div>
      </div>
    </div>
  );
};
