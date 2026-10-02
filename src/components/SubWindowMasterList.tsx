import React, { useState, useMemo } from 'react';
import {
  FolderGit2,
  Search,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  ArrowUpDown,
  Tag
} from 'lucide-react';
import { Project } from '../types/erp';

interface SubWindowMasterListProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
  onAddNew: () => void;
}

export const SubWindowMasterList: React.FC<SubWindowMasterListProps> = ({
  isOpen,
  onToggleOpen,
  projects,
  selectedProjectId,
  onSelectProject,
  onAddNew,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'PLANNING'>('ALL');

  // 篩選與搜尋
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        return (
          p.projectCode.toLowerCase().includes(query) ||
          p.name.toLowerCase().includes(query) ||
          (p.ownerName && p.ownerName.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [projects, statusFilter, searchTerm]);

  // 若使用者關閉子視窗，僅顯示一條精緻的展開把手
  if (!isOpen) {
    return (
      <div className="w-8 bg-white border-r border-slate-200 flex flex-col items-center py-3 select-none shrink-0 shadow-2xs z-10 transition-all">
        <button
          onClick={onToggleOpen}
          title="展開左側清單子視窗"
          className="w-6 h-6 rounded bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors mb-4"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <div
          onClick={onToggleOpen}
          className="flex-1 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 w-full"
          title="點擊展開專案案場清單"
        >
          <FolderGit2 className="w-4 h-4 text-indigo-600 mb-2" />
          <div className="[writing-mode:vertical-rl] text-[11px] font-bold text-slate-600 tracking-wider">
            案場清單子視窗 ({projects.length})
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside className="w-[300px] xl:w-[320px] bg-white border-r border-slate-200 flex flex-col shrink-0 select-none overflow-hidden relative shadow-xs z-10">
      {/* 1. 子視窗固定頂部表頭 (Header) */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
            <FolderGit2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>案場工區清單</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                {filteredProjects.length}
              </span>
            </div>
            <div className="text-[10px] text-slate-400">鼎新 A1 固定左側子視窗</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onAddNew}
            title="快速新增案場"
            className="p-1.5 rounded-md text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleOpen}
            title="向左收合子視窗"
            className="p-1.5 rounded-md hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. 搜尋與狀態標籤篩選列 */}
      <div className="p-2.5 border-b border-slate-100 bg-white space-y-2 shrink-0">
        {/* 搜尋框 */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="搜尋案場編號、名稱或地點..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>

        {/* 快捷狀態 Filter Tabs */}
        <div className="flex items-center gap-1 text-[11px] font-medium">
          {[
            { id: 'ALL', label: '全部' },
            { id: 'IN_PROGRESS', label: '施工中' },
            { id: 'PLANNING', label: '規劃中' },
            { id: 'COMPLETED', label: '完工' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`flex-1 py-1 rounded text-center transition-colors ${
                statusFilter === tab.id
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 專案案場獨立內部滾動清單區 (Independent Scroll Container) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-slate-100/60">
        {filteredProjects.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs space-y-1">
            <Layers className="w-6 h-6 mx-auto opacity-40 text-slate-400" />
            <div>查無符合之案場資料</div>
          </div>
        ) : (
          filteredProjects.map((p) => {
            const isSelected = p.id === selectedProjectId;
            const progress = p.budgetAmount && p.actualCost 
              ? Math.min(Math.round((p.actualCost / p.budgetAmount) * 100), 100) 
              : 35;

            return (
              <div
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                className={`pt-1.5 first:pt-0 cursor-pointer`}
              >
                <div
                  className={`p-2.5 rounded-lg border transition-all text-left ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-400/90 shadow-xs ring-1 ring-indigo-400/30'
                      : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-100/60 px-1.5 py-0.2 rounded border border-indigo-200/50">
                      {p.projectCode}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                        p.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : p.status === 'COMPLETED'
                          ? 'bg-slate-100 text-slate-600 border border-slate-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {p.status === 'ACTIVE' ? '在建施工' : p.status === 'COMPLETED' ? '完工結案' : '規劃起標'}
                    </span>
                  </div>

                  <div className="mt-1 font-bold text-xs text-slate-900 line-clamp-1">
                    {p.name}
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate max-w-[130px]">{p.ownerName || '台灣業主單位'}</span>
                    <span className="font-mono font-semibold text-slate-800">
                      NT$ {(p.budgetAmount / 10000).toLocaleString()}萬
                    </span>
                  </div>

                  {/* 進度條 */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {progress}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. 子視窗底部統計資訊 */}
      <div className="p-2.5 border-t border-slate-200 bg-slate-50/70 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
        <span>全案場總計：<strong>{projects.length}</strong> 處</span>
        <span className="font-mono text-indigo-700 font-semibold">
          在建 {projects.filter(p => p.status === 'ACTIVE').length} 案
        </span>
      </div>
    </aside>
  );
};
