import React, { useMemo } from 'react';
import {
  Building2,
  Plus,
  UserCheck,
  Layers,
  Search,
  GitBranch
} from 'lucide-react';
import { Company } from '../../types/erp';

import { matchesTaiwanRegion } from '../../utils/taiwanPostalCodes';

export type CompanyEntityFilter = 'ALL' | 'GROUP' | 'CORPORATION' | 'PERSONAL';

export interface CompanyHierarchyGridProps {
  companies: Company[];
  activeCompanyId: string;
  typeFilter: CompanyEntityFilter;
  searchTerm: string;
  onTypeFilterChange: (filter: CompanyEntityFilter) => void;
  onSearchTermChange: (term: string) => void;
  onSelectCompany: (company: Company) => void;
  onCreateNew: (type: 'GROUP' | 'CORPORATION' | 'PERSONAL') => void;
  isCompanyAllowed: (compId: string) => boolean;
}

export const CompanyHierarchyGrid: React.FC<CompanyHierarchyGridProps> = ({
  companies,
  activeCompanyId,
  typeFilter,
  searchTerm,
  onTypeFilterChange,
  onSearchTermChange,
  onSelectCompany,
  onCreateNew,
  isCompanyAllowed
}) => {
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      if (typeFilter !== 'ALL' && c.entityType !== typeFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = c.name.toLowerCase().includes(term);
        const matchCode = c.companyCode.toLowerCase().includes(term);
        const matchTax = c.taxId?.toLowerCase().includes(term);
        const matchNat = c.nationalId?.toLowerCase().includes(term);
        const matchAddress =
          (c.registeredAddress || '').toLowerCase().includes(term) ||
          (c.contactAddress || '').toLowerCase().includes(term) ||
          matchesTaiwanRegion(c.registeredAddress, searchTerm) ||
          matchesTaiwanRegion(c.contactAddress, searchTerm) ||
          (c.registeredAddressHistory || []).some(
            h =>
              (h.fullAddress || '').toLowerCase().includes(term) ||
              matchesTaiwanRegion(h.fullAddress, searchTerm)
          ) ||
          (c.contactAddressHistory || []).some(
            h =>
              (h.fullAddress || '').toLowerCase().includes(term) ||
              matchesTaiwanRegion(h.fullAddress, searchTerm)
          );
        if (!matchName && !matchCode && !matchTax && !matchNat && !matchAddress) return false;
      }
      return true;
    });
  }, [companies, typeFilter, searchTerm]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      {/* 頂部標題與快速操作按鈕 */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold shadow-2xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span>集團多法人實體管理架構</span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                全集團共 {companies.length} 個實體
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              拉取集團報表時自動合併下屬各公司與個人帳戶損益；亦可獨立拉取單一公司分析
            </div>
          </div>
        </div>

        {/* 快捷新增按鈕組 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCreateNew('CORPORATION')}
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新增公司法人</span>
          </button>
          <button
            type="button"
            onClick={() => onCreateNew('PERSONAL')}
            title="新增以老闆個人為名的內部調度帳戶 (驗證身分證，免填公司工商登記)"
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>新增個人帳戶 (老闆私帳)</span>
          </button>
          <button
            type="button"
            onClick={() => onCreateNew('GROUP')}
            title="新增事業集團母體 (控股與合併報表維度)"
            className="px-2.5 py-1.5 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-colors border border-slate-300 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>新增集團母體</span>
          </button>
        </div>
      </div>

      {/* 搜尋過濾工具列 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-lg border border-slate-200 text-xs w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onTypeFilterChange('ALL')}
            className={`px-2.5 py-1 rounded font-semibold transition-all cursor-pointer ${
              typeFilter === 'ALL'
                ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            全部實體 ({companies.length})
          </button>
          <button
            type="button"
            onClick={() => onTypeFilterChange('GROUP')}
            className={`px-2.5 py-1 rounded font-semibold transition-all cursor-pointer ${
              typeFilter === 'GROUP'
                ? 'bg-white text-purple-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            集團母體 ({companies.filter(c => c.entityType === 'GROUP').length})
          </button>
          <button
            type="button"
            onClick={() => onTypeFilterChange('CORPORATION')}
            className={`px-2.5 py-1 rounded font-semibold transition-all cursor-pointer ${
              typeFilter === 'CORPORATION'
                ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            公司法人 ({companies.filter(c => c.entityType === 'CORPORATION').length})
          </button>
          <button
            type="button"
            onClick={() => onTypeFilterChange('PERSONAL')}
            className={`px-2.5 py-1 rounded font-semibold transition-all cursor-pointer ${
              typeFilter === 'PERSONAL'
                ? 'bg-white text-amber-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            老闆私帳 ({companies.filter(c => c.entityType === 'PERSONAL').length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="搜尋代碼、名稱、統編、身分證..."
            className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 實體切換卡片清單 (母子樹狀架構) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        {filteredCompanies.map((c) => {
          const isSelected = c.id === activeCompanyId;
          const isGroup = c.entityType === 'GROUP';
          const isPersonal = c.entityType === 'PERSONAL';
          const cParent = companies.find(p => p.id === c.parentId);
          const allowedForUser = isCompanyAllowed(c.id);

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCompany(c)}
              className={`p-3.5 rounded-lg border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                !allowedForUser
                  ? 'bg-slate-100/70 border-slate-200 opacity-65 hover:border-rose-300'
                  : isSelected
                  ? isPersonal
                    ? 'bg-amber-50/80 border-amber-400 shadow-xs ring-2 ring-amber-400/40'
                    : isGroup
                    ? 'bg-purple-50/80 border-purple-400 shadow-xs ring-2 ring-purple-400/40'
                    : 'bg-indigo-50/80 border-indigo-400 shadow-xs ring-2 ring-indigo-400/40'
                  : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-mono text-[11px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {c.companyCode}
                  </span>
                  <div className="flex items-center gap-1">
                    {!allowedForUser && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                        🔒 未授權
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isGroup
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : isPersonal
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isGroup ? '集團母體' : isPersonal ? '老闆私帳' : '公司法人'}
                    </span>
                  </div>
                </div>

                <div className="font-bold text-xs text-slate-900 truncate mt-2">
                  {c.name}
                </div>

                {cParent && (
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
                    <GitBranch className="w-3 h-3 text-indigo-500 shrink-0" />
                    <span className="truncate">隸屬: {cParent.shortName || cParent.name}</span>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <span className="truncate">
                  {isPersonal
                    ? c.nationalId ? `身分證: ${c.nationalId.slice(0, 4)}***` : '身分證: 未填'
                    : c.taxId ? `統編: ${c.taxId}` : '集團控股'}
                </span>
                {c.documentPrefix && (
                  <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 shrink-0">
                    {c.documentPrefix}-
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
