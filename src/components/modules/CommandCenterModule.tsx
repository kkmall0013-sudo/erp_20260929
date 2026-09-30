import React from 'react';
import { CashFlowMetrics, Project } from '../../types/erp';
import { LineChart, DollarSign, TrendingUp, AlertTriangle, ShieldCheck, PieChart, Sparkles, Building2 } from 'lucide-react';

interface CommandCenterModuleProps {
  metrics: CashFlowMetrics;
  projects: Project[];
}

export const CommandCenterModule: React.FC<CommandCenterModuleProps> = ({ metrics, projects }) => {
  return (
    <div className="space-y-6">
      {/* 標題與簡介 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
            <LineChart className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              營運戰情大腦與高階決策支援 (Phase 10 & 憲法第六篇)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              100% 唯讀決策視角 · 即時可用資金預測 (扣除未兌支票與稅費) · 待補簽追加減 (Pending CO) 風險長條圖
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>上帝視角 · 唯讀防護</span>
        </div>
      </div>

      {/* 核心第一區：真實可用資金預測水庫 (Cash Runway) */}
      <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm border border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              最高決策大腦核心指標
            </div>
            <h3 className="text-xl font-bold mt-1 text-white">
              集團本月真實可用周轉淨現金 (Projected Net Cash)
            </h3>
          </div>

          <div className="text-right">
            <div className="font-mono text-3xl font-extrabold text-emerald-400 tabular-nums">
              ${metrics.projectedNetCash.toLocaleString()} <span className="text-sm font-normal text-slate-400">NTD</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              真實可用餘額（非表面會計數字）
            </div>
          </div>
        </div>

        {/* 憲法第六篇公式解耦展開 (三柱/四柱平衡水流) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700">
            <div className="text-slate-400">現有銀行存款結存</div>
            <div className="font-mono text-sm font-bold text-white mt-1 tabular-nums">
              +${metrics.currentBankBalance.toLocaleString()}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700">
            <div className="text-slate-400">預計請款應收 (AR)</div>
            <div className="font-mono text-sm font-bold text-blue-400 mt-1 tabular-nums">
              +${metrics.projectedAR.toLocaleString()}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700">
            <div className="text-slate-400">未付帳款 (AP)</div>
            <div className="font-mono text-sm font-bold text-rose-400 mt-1 tabular-nums">
              -${metrics.projectedAP.toLocaleString()}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700">
            <div className="text-slate-400">未兌現應付支票</div>
            <div className="font-mono text-sm font-bold text-amber-400 mt-1 tabular-nums">
              -${metrics.unclearedChecks.toLocaleString()}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700">
            <div className="text-slate-400">預估應納營業稅</div>
            <div className="font-mono text-sm font-bold text-slate-300 mt-1 tabular-nums">
              -${metrics.estimatedVAT.toLocaleString()}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700">
            <div className="text-slate-400">常規固定薪資水電</div>
            <div className="font-mono text-sm font-bold text-slate-300 mt-1 tabular-nums">
              -${metrics.recurringExpenses.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 核心第二區：專案毛利雷達與追加減未定風險 (Pending CO) 虛線長條圖 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>專案毛利雷達面板</span>
              <span className="text-xs font-normal text-slate-400">· 包含追加減未定風險 (Pending CO)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              工地現場已施工、但業主尚未簽核完成之追加減金額以虛線長條圖疊加，視覺化呈現潛在回升潛力。
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-600 inline-block" />
              已確認合約額
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-indigo-300 border border-dashed border-indigo-600 inline-block" />
              待簽追加減 (Pending CO)
            </span>
          </div>
        </div>

        {/* 專案毛利列表 */}
        <div className="space-y-5">
          {projects.map(project => {
            const margin = project.contractAmount - project.budgetAmount;
            const marginPct = project.contractAmount > 0
              ? Math.round((margin / project.contractAmount) * 100)
              : 0;

            // 模擬第 1 案場有 850 萬的 Pending CO
            const hasPendingCO = project.id === 'PRJ-01';
            const pendingCOAmount = hasPendingCO ? metrics.pendingChangeOrdersAmount : 0;
            const potentialContract = project.contractAmount + pendingCOAmount;
            const potentialMargin = potentialContract - project.budgetAmount;
            const potentialMarginPct = Math.round((potentialMargin / potentialContract) * 100);

            return (
              <div key={project.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-600 mr-2">
                      {project.projectCode}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{project.name}</span>
                    <span className="text-xs text-slate-400 block sm:inline sm:ml-2">
                      業主: {project.ownerName}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">目前預估毛利率</div>
                      <div className="font-mono text-sm font-bold text-emerald-600 tabular-nums">
                        {marginPct}% (${margin.toLocaleString()})
                      </div>
                    </div>

                    {hasPendingCO && (
                      <div className="text-right pl-3 border-l border-slate-200">
                        <div className="text-[11px] text-indigo-600 font-semibold">
                          催簽後潛在毛利 (CO)
                        </div>
                        <div className="font-mono text-sm font-bold text-indigo-700 tabular-nums">
                          {potentialMarginPct}% (${potentialMargin.toLocaleString()})
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 虛線長條圖視覺呈現 (憲法第十篇重點) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
                    <span>合約預算結構</span>
                    <span>
                      合約: ${project.contractAmount.toLocaleString()}
                      {hasPendingCO && ` + 待補簽CO: $${pendingCOAmount.toLocaleString()}`}
                    </span>
                  </div>

                  <div className="w-full h-4 bg-slate-200 rounded-md overflow-hidden flex items-center">
                    {/* 已簽合約 */}
                    <div
                      className="h-full bg-blue-600 flex items-center justify-center text-[10px] text-white font-mono"
                      style={{ width: `${hasPendingCO ? 82 : 100}%` }}
                      title="已簽訂合約金額"
                    >
                      已簽合約
                    </div>

                    {/* 待簽追加減 (虛線圖示) */}
                    {hasPendingCO && (
                      <div
                        className="h-full bg-indigo-200 border-l-2 border-dashed border-indigo-600 flex items-center justify-center text-[10px] text-indigo-900 font-bold font-mono"
                        style={{ width: '18%' }}
                        title="待補簽追加減 (工務已施工、待業主簽約)"
                      >
                        Pending CO
                      </div>
                    )}
                  </div>
                </div>

                {hasPendingCO && (
                  <div className="p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <strong>高層決策建議：</strong>南港案場現場已施工追加 $8,500,000，建議派員跟業催簽追加減合約單，簽署後毛利將由 15% 躍升至 23%！
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
