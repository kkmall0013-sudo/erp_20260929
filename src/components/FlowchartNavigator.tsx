import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FolderGit2,
  ShoppingCart,
  HardHat,
  Receipt,
  CreditCard,
  LineChart,
  ArrowRight,
  Plus,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  HelpCircle,
  Database
} from 'lucide-react';
import { ActiveTab } from './Sidebar';

interface FlowchartNavigatorProps {
  onNavigate: (tab: ActiveTab) => void;
  stats: {
    projectsCount: number;
    quotationsCount: number;
    posCount: number;
    valuationsCount: number;
    checksCount: number;
    apCount: number;
    arCount: number;
  };
  metrics: {
    projectedNetCash: number;
    currentBankBalance: number;
    pendingCO: number;
  };
}

export const FlowchartNavigator: React.FC<FlowchartNavigatorProps> = ({
  onNavigate,
  stats,
  metrics,
}) => {
  const [activeLane, setActiveLane] = useState<'ALL' | 'PROCUREMENT' | 'SALES' | 'FINANCE'>('ALL');

  return (
    <div className="space-y-6">
      {/* 頂部歡迎與快速戰情報告列 */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-6 shadow-sm border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                鼎新 A1 風格流程引擎
              </span>
              <span className="text-xs text-slate-400">
                · 單一事實來源 (SSoT) 全鏈貫通
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              營造工程全生命週期 — 業務流程地圖
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              點擊任一流程節點直接穿透進入單據清單或開立新單。系統底層全面落實「全域零負數」、「過帳文字快照鎖死」與「SQLite 隨選快速備份」。
            </p>
          </div>

          {/* 右側戰情速覽 */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 text-right">
              <div className="text-[11px] text-slate-400">本月真實可用淨現金水位</div>
              <div className="font-mono text-lg font-bold text-emerald-400 tabular-nums">
                $ {metrics.projectedNetCash.toLocaleString()} <span className="text-xs font-normal text-slate-400">NTD</span>
              </div>
              <div className="text-[10px] text-slate-400">已扣除未兌支票與預估稅費</div>
            </div>

            <button
              onClick={() => onNavigate('DATABASE_MANAGER')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-lg flex flex-col items-center justify-center transition-colors text-center text-xs font-medium border border-indigo-400/30 shadow-sm"
            >
              <Database className="w-5 h-5 mb-1" />
              <span>SQL 備份</span>
            </button>
          </div>
        </div>

        {/* 流程篩選開關 */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-800/80">
          <span className="text-xs text-slate-400">檢視動線：</span>
          <div className="inline-flex p-0.5 rounded-lg bg-slate-800 border border-slate-700 text-xs">
            <button
              onClick={() => setActiveLane('ALL')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeLane === 'ALL' ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              全部主幹流程
            </button>
            <button
              onClick={() => setActiveLane('SALES')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeLane === 'SALES' ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              業務接單與立項 (CPQ)
            </button>
            <button
              onClick={() => setActiveLane('PROCUREMENT')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeLane === 'PROCUREMENT' ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              採發與估驗計價
            </button>
            <button
              onClick={() => setActiveLane('FINANCE')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeLane === 'FINANCE' ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              財務票據與現金流
            </button>
          </div>
        </div>
      </div>

      {/* 互動式流程畫布 (Interactive Process Canvas) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              互動作業節點 (點擊進入單據作業)
            </h3>
            <span className="text-xs text-slate-500">· 綠點表示資料庫已過帳單據</span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
              業務與工程
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              採購與發包
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              估驗與財務
            </span>
          </div>
        </div>

        {/* 流程網格架構 */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 relative">
          {/* 節點 1: 報價與銷售 CPQ */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/20 hover:border-indigo-400 hover:shadow-md transition-all group relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                {stats.quotationsCount} 筆報價單
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
              01. 報價與銷售 (CPQ)
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              三軌議價引擎 · 多版次 (REV-A/B) · 請款里程碑拆分 · 粉紅折讓防呆
            </p>

            <div className="mt-4 pt-3 border-t border-indigo-100 flex items-center justify-between">
              <button
                onClick={() => onNavigate('QUOTATIONS')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>檢視報價清單</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigate('QUOTATIONS')}
                className="p-1 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700 transition-colors"
                title="新增報價單"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 節點 2: 專案與案場立項 */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/20 hover:border-blue-400 hover:shadow-md transition-all group relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                {stats.projectsCount} 個進行中案場
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
              02. 專案案場與 WBS
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              業主合約建檔 · 案場負責人工務 · 工項預算拆解 · 正式過帳鎖定 (Lock)
            </p>

            <div className="mt-4 pt-3 border-t border-blue-100 flex items-center justify-between">
              <button
                onClick={() => onNavigate('PROJECTS')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span>進入專案管理</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigate('PROJECTS')}
                className="p-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors"
                title="新建專案案場"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 節點 3: 採購與發包 */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/20 hover:border-amber-400 hover:shadow-md transition-all group relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                {stats.posCount} 張採購單
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors flex items-center gap-1.5">
              03. 採購單與發包
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              材料/設備訂購 · 預付扣抵連動 · 廠商統編文字快照 · 多法人稅務調度
            </p>

            <div className="mt-4 pt-3 border-t border-amber-100 flex items-center justify-between">
              <button
                onClick={() => onNavigate('PROCUREMENT')}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1"
              >
                <span>管理採購發包</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigate('PROCUREMENT')}
                className="p-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors"
                title="開立採購單"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 節點 4: 現場工程與下包估驗計價 */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 hover:border-emerald-400 hover:shadow-md transition-all group relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <HardHat className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-medium text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                {stats.valuationsCount} 筆估驗計價
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors flex items-center gap-1.5">
              04. 下包估驗計價 (Progress Billing)
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              期別累計度 · 10% 保留款扣留 · 預付款瀑布沖銷 · 工區罰款粉紅扣款
            </p>

            <div className="mt-4 pt-3 border-t border-emerald-100 flex items-center justify-between">
              <button
                onClick={() => onNavigate('VALUATIONS')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
              >
                <span>進入估驗台</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigate('VALUATIONS')}
                className="p-1 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors"
                title="新建估驗計價單"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 節點 5: 財務應付憑單與發票拆單 */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-indigo-400 hover:shadow-md transition-all group relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-slate-800 text-white flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-medium text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                {stats.apCount} 筆應付憑單
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
              05. 應付憑單與發票拆單
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              發票本位拆單小精靈 · 多法人跨買受人報銷 · 三柱借貸平衡校驗
            </p>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => onNavigate('FINANCE')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>應付帳務作業</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 節點 6: 業主請款與應收帳款 */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-indigo-400 hover:shadow-md transition-all group relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-700 text-white flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-medium text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
                {stats.arCount} 筆應收款項
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
              06. 業主合約計價 (應收 AR)
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              里程碑請款開單 · 業主保留款扣留 · 催款帳齡分析 · 實時入帳沖銷
            </p>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => onNavigate('FINANCE')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>應收對帳管理</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 節點 7: 支票票據與資金水流 */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-indigo-400 hover:shadow-md transition-all group relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-medium text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                {stats.checksCount} 張期票
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
              07. 銀行期票與金流
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              應收/應付支票開立 · 到期託收與兌現 · 跳票作廢原因強制警報
            </p>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => onNavigate('FINANCE')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>票據託收兌現</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 節點 8: 營運決策戰情室 */}
          <div className="p-4 rounded-xl border border-indigo-300 bg-indigo-50/40 hover:border-indigo-500 hover:shadow-md transition-all group relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                <LineChart className="w-5 h-5 text-indigo-400" />
              </div>
              <span className="text-xs font-medium text-indigo-800 bg-indigo-200/60 px-2 py-0.5 rounded flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                決策大腦
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
              08. 營運戰情大腦
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              即時可用資金預測 · 專案毛利雷達 · 待補簽追加減 (Pending CO) 風險
            </p>

            <div className="mt-4 pt-3 border-t border-indigo-200 flex items-center justify-between">
              <button
                onClick={() => onNavigate('COMMAND_CENTER')}
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
              >
                <span>進入決策戰情室</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 營造業特色內控說明條 (防呆三件套落實) */}
      <div className="bg-slate-100/70 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>憲法級防呆落實：</strong>全系統單據折讓/扣款一律以「正數」輸入並由核心公式扣減（粉紅警示色視覺引導）；過帳後廠商統編與合約名稱凍結為快照防查帳篡改。
          </span>
        </div>
        <button
          onClick={() => onNavigate('SYSTEM_CONFIG')}
          className="text-indigo-600 hover:text-indigo-800 font-medium shrink-0 flex items-center gap-1"
        >
          <span>查看系統憲法與審計軌跡</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
