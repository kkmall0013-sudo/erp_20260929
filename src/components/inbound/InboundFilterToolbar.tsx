// src/components/inbound/InboundFilterToolbar.tsx
// 🔍 現場進貨簽收工作台：頂部操作按鈕列、4 張 KPI 統計卡、多維度動態篩選列與視圖切換

import React from 'react';
import {
  Truck,
  Plus,
  Search,
  Calendar,
  Edit,
  Download,
  DollarSign,
  Boxes,
  FileSpreadsheet,
  FolderTree,
  List,
} from 'lucide-react';
import {
  DateFilterMode,
  DateRangeResult,
  VendorFilterOption,
  ProjectFilterOption,
  InboundStats,
} from './inboundWorkspaceUtils';

export interface InboundFilterToolbarProps {
  stats: InboundStats;
  activeDateRange: DateRangeResult;
  activeVendorsInDateRange: VendorFilterOption[];
  activeProjectsInDateRange: ProjectFilterOption[];
  filteredCount: number;
  dateFilterMode: DateFilterMode;
  onDateFilterModeChange: (mode: DateFilterMode) => void;
  customStartDate: string;
  onCustomStartDateChange: (val: string) => void;
  customEndDate: string;
  onCustomEndDateChange: (val: string) => void;
  selectedVendorId: string;
  onSelectedVendorIdChange: (id: string) => void;
  selectedProjectId: string;
  onSelectedProjectIdChange: (id: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchKeyword: string;
  onSearchKeywordChange: (kw: string) => void;
  viewMode: 'LIST' | 'HIERARCHY';
  onSwitchViewMode: (mode: 'LIST' | 'HIERARCHY') => void;
  onOpenExcelGrid: () => void;
  onOpenAssetManager: () => void;
  onOpenCreateModal: () => void;
  onExportCsv: () => void;
}

export const InboundFilterToolbar: React.FC<InboundFilterToolbarProps> = ({
  stats,
  activeDateRange,
  activeVendorsInDateRange,
  activeProjectsInDateRange,
  filteredCount,
  dateFilterMode,
  onDateFilterModeChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  selectedVendorId,
  onSelectedVendorIdChange,
  selectedProjectId,
  onSelectedProjectIdChange,
  statusFilter,
  onStatusFilterChange,
  searchKeyword,
  onSearchKeywordChange,
  viewMode,
  onSwitchViewMode,
  onOpenExcelGrid,
  onOpenAssetManager,
  onOpenCreateModal,
  onExportCsv,
}) => {
  return (
    <>
      {/* 頂部標題與主操作列 (精簡整合打單入口) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
                <Truck className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">現場進貨簽收管理</h2>
                  <span className="bg-emerald-50 text-emerald-700 font-mono text-xs px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                    A 模式直入案場成本
                  </span>
                  <span className="text-slate-400 text-xs hidden sm:inline">|</span>
                  <span className="text-xs text-slate-500 hidden sm:inline">
                    現場物料驗收簽收 · 會計請款由財務模組專責審核
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  現場點收即時建檔 · 支援完整下拉選單、案場搜尋、獨立修改、草稿暫存與廠商階層目錄檢視
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 📊 Excel 試算表極速打單模式 (主要入口) */}
            <button
              onClick={onOpenExcelGrid}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="仿 Excel 試算表快速鍵連續打單，支援多草稿暫存切換、輸入3自動推薦3310、新廠商登記與正式過帳"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>📊 極速進貨打單 (工作台)</span>
              {stats.draftCount > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.2 bg-amber-400 text-slate-900 font-black rounded-full text-[10px]"
                  title={`目前有 ${stats.draftCount} 筆待處理草稿`}
                >
                  草稿 {stats.draftCount}
                </span>
              )}
            </button>

            {/* 🚚 廠內資產維護 */}
            <button
              onClick={onOpenAssetManager}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-slate-100 font-semibold rounded-lg text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="維護公務車輛換車/汰換報廢、重型機具、常備庫存與廠區修繕項目，支援別名與進貨單關聯"
            >
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>🚚 廠內資產維護</span>
            </button>

            {/* 新增單筆進貨簽收單 */}
            <button
              onClick={onOpenCreateModal}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="新增單筆現場紙本簽收單"
            >
              <Plus className="w-4 h-4" />
              <span>新增單筆簽收單</span>
            </button>

            {/* 匯出報表 */}
            <button
              onClick={onExportCsv}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs transition-colors border border-slate-300 flex items-center gap-1 cursor-pointer"
              title="匯出當前篩選結果為標準 CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>匯出 CSV</span>
            </button>
          </div>
        </div>

        {/* 現場進貨簽收單據統計指標 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
              <span>本期進貨簽收單</span>
              <Boxes className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-xl font-bold text-slate-800">
                {stats.totalCount}
              </span>
              <span className="text-[11px] text-slate-400">筆單據</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">
              {activeDateRange.label}
            </div>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200/80">
            <div className="text-[11px] text-blue-800 font-medium flex items-center justify-between">
              <span>今日簽收進場</span>
              <Truck className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-xl font-bold text-blue-900">
                {stats.todayCount}
              </span>
              <span className="text-[11px] text-blue-600 font-medium">筆今日送達</span>
            </div>
            <div className="text-[10px] text-blue-600 truncate mt-0.5">
              現場已核對卸料
            </div>
          </div>

          {/* 現場草稿暫存單卡片 (點擊切換草稿篩選，支援載入極速打單) */}
          <div
            onClick={() => onStatusFilterChange(statusFilter === 'DRAFT' ? 'ALL' : 'DRAFT')}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              statusFilter === 'DRAFT'
                ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300 shadow-sm'
                : 'bg-amber-50/70 hover:bg-amber-100/70 border-amber-200'
            }`}
            title="點擊篩選顯示所有草稿單，可載入極速打單工作台編輯"
          >
            <div className="text-[11px] text-amber-800 font-medium flex items-center justify-between">
              <span>現場草稿暫存單</span>
              <Edit className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-xl font-bold text-amber-900">
                {stats.draftCount}
              </span>
              <span className="text-[11px] text-amber-700 font-medium">筆草稿</span>
            </div>
            <div className="text-[10px] text-amber-700 truncate mt-0.5 font-medium">
              {statusFilter === 'DRAFT' ? '✓ 篩選草稿中 (點擊還原)' : '點擊篩選 · 可載入極速打單'}
            </div>
          </div>

          <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-200">
            <div className="text-[11px] text-purple-900 font-medium flex items-center justify-between">
              <span>預計進貨未稅額</span>
              <DollarSign className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-xl font-bold text-purple-950">
                ${stats.subtotal.toLocaleString()}
              </span>
            </div>
            <div className="text-[10px] text-purple-700 truncate mt-0.5">
              預估稅金 5%: ${stats.estimatedTax.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 🔍 智慧篩選工具列：日期區間、動態廠商關聯、案場與狀態 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* 關鍵字搜尋 */}
          <div className="relative lg:col-span-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="搜尋單號 / 送貨單 / 材料品名..."
              value={searchKeyword}
              onChange={e => onSearchKeywordChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
          </div>

          {/* 日期區間模式 */}
          <div className="lg:col-span-3 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={dateFilterMode}
              onChange={e => onDateFilterModeChange(e.target.value as DateFilterMode)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800 font-medium"
            >
              <option value="THIS_MONTH">📅 本月進貨單</option>
              <option value="LAST_MONTH">📅 上月進貨單</option>
              <option value="LAST_30_DAYS">📅 近 30 天進貨</option>
              <option value="ALL">📅 全部歷史日期</option>
              <option value="CUSTOM">⚙️ 自訂起訖日期區間...</option>
            </select>
          </div>

          {/* ⚡ 動態廠商篩選 (只列出該日期區間內真正有進貨單的廠商，徹底避免點選後是空白) */}
          <div className="lg:col-span-3">
            <select
              value={selectedVendorId}
              onChange={e => onSelectedVendorIdChange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800 font-medium"
            >
              <option value="ALL">
                🏢 全部供貨廠商 (本期共 {activeVendorsInDateRange.length} 家有進貨)
              </option>
              {activeVendorsInDateRange.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.count} 筆進貨)
                </option>
              ))}
            </select>
          </div>

          {/* ⚡ 動態案場篩選 (與廠商選單一致：只列出該日期區間內真正有進貨單的案場，避免點選後空白) */}
          <div className="lg:col-span-3">
            <select
              value={selectedProjectId}
              onChange={e => onSelectedProjectIdChange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800 font-medium"
            >
              <option value="ALL">
                🏗️ 全部工區案場 (本期共 {activeProjectsInDateRange.length} 個案場有進貨)
              </option>
              {activeProjectsInDateRange.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.code ? `(${p.code})` : ''} ({p.count} 筆進貨)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 次行：自訂日期區間與狀態篩選 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          {dateFilterMode === 'CUSTOM' ? (
            <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-700">自訂起訖區間:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={e => onCustomStartDateChange(e.target.value)}
                className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-xs outline-none focus:border-indigo-500"
              />
              <span className="text-slate-400">至</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => onCustomEndDateChange(e.target.value)}
                className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-xs outline-none focus:border-indigo-500"
              />
            </div>
          ) : (
            <div className="text-slate-500 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-500"></span>
              <span>
                目前篩選期間：<strong className="text-slate-800">{activeDateRange.label}</strong>
              </span>
              <span className="text-slate-400">|</span>
              <span>
                符合進貨單：<strong className="text-indigo-600 font-mono">{filteredCount}</strong> 筆
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* 簽收狀態篩選 */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">狀態:</span>
              <select
                value={statusFilter}
                onChange={e => onStatusFilterChange(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700"
              >
                <option value="ALL">全部簽收狀態</option>
                <option value="POSTED">現場已點收簽收</option>
                <option value="DRAFT">現場草稿 (待點收)</option>
                <option value="VOIDED">已作廢</option>
              </select>
            </div>

            {/* 顯示模式切換：清單 vs 廠商階層目錄 */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => onSwitchViewMode('LIST')}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'LIST'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="標準進貨明細清單檢視"
              >
                <List className="w-3.5 h-3.5" />
                <span>清單檢視</span>
              </button>

              <button
                type="button"
                onClick={() => onSwitchViewMode('HIERARCHY')}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'HIERARCHY'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="以供貨廠商為目錄之手風琴階層檢視，點擊即展開該廠商明細與預估價格/稅金"
              >
                <FolderTree className="w-3.5 h-3.5 text-purple-600" />
                <span>廠商階層目錄檢視</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
