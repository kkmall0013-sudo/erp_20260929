// src/components/projects/ProjectDirectoryTable.tsx
// 🏛️ 案場工程清冊資料表與狀態標籤組件

import React from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DraftingCompass,
  Edit3,
  Eye,
  FileText,
  FolderGit2,
  Lock,
  MapPin,
  Trash2,
} from 'lucide-react';
import { Company, Project, ProjectSite } from '../../types/erp';

interface ProjectDirectoryTableProps {
  filteredProjects: Project[];
  siteMap: Map<string, ProjectSite>;
  companies: Company[];
  searchTerm: string;
  canWrite: boolean;
  canOpenProjectStatement: boolean;
  onResetFilters: () => void;
  onViewProject: (project: Project) => void;
  onOpenStatement: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
}

export function getProjectStatusBadge(status: Project['status']) {
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
}

export const ProjectDirectoryTable: React.FC<ProjectDirectoryTableProps> = ({
  filteredProjects,
  siteMap,
  companies,
  searchTerm,
  canWrite,
  canOpenProjectStatement,
  onResetFilters,
  onViewProject,
  onOpenStatement,
  onEditProject,
  onDeleteProject,
}) => {
  return (
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
              onClick={onResetFilters}
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
                    <td className="py-3.5 px-4 text-center">
                      {getProjectStatusBadge(p.status)}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
                          {p.projectCode}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-800 mt-1 hover:text-indigo-600 transition-colors">
                        {p.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {p.buildingType && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-medium">
                            {p.buildingType}
                          </span>
                        )}
                        {p.workScope && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/70 font-medium">
                            {p.workScope}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span title="合約甲方全銜 (發票開立對象)">{p.ownerName}</span>
                        {p.ownerTaxId && (
                          <span className="font-mono text-slate-400 text-[10px]">({p.ownerTaxId})</span>
                        )}
                      </div>

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

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-mono font-bold text-slate-800">
                        NT$ {p.contractAmount?.toLocaleString() || 0}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        預算: NT$ {p.budgetAmount?.toLocaleString() || 0}
                      </div>
                    </td>

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

                    <td className="py-3.5 px-4">
                      <div className="text-slate-600 font-mono text-[11px] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{p.startDate || '未定'}</span>
                      </div>
                      <div className="text-slate-400 font-mono text-[11px] pl-4 mt-0.5">
                        ~ {p.endDate || '進行中'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => onViewProject(p)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="檢視案場詳情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {canOpenProjectStatement && (
                          <button
                            type="button"
                            onClick={() => onOpenStatement(p)}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="開啟對外客戶請款／對帳明細表小程式（不含私帳與內部401機密）"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>對客表</span>
                          </button>
                        )}

                        {canWrite && (
                          <button
                            onClick={() => onEditProject(p)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="編輯案場資料"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {canWrite && (
                          <button
                            onClick={() => onDeleteProject(p)}
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
  );
};
