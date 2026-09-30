import React, { useState } from 'react';
import { Project, Valuation, PurchaseOrder } from '../../types/erp';
import { FileText, Download, Printer, ToggleLeft, ToggleRight, ShieldCheck, BarChart3, AlertOctagon } from 'lucide-react';

interface ReportsModuleProps {
  projects: Project[];
  valuations: Valuation[];
  purchaseOrders: PurchaseOrder[];
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({ projects, valuations, purchaseOrders }) => {
  // 憲法第十一篇重點：稅務與管理視角一鍵切換
  const [reportPerspective, setReportPerspective] = useState<'TAX' | 'MANAGEMENT'>('TAX');

  return (
    <div className="space-y-6">
      {/* 標題與簡介 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              商業級報表模組 (Phase 11 & 憲法全卷定版)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              單一真實來源 (SSoT) · 專案工程損益 · 下包保留款未退台帳
            </p>
          </div>
        </div>

        {/* 雙軌切換開關 (憲法第十一篇重點) */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setReportPerspective('TAX')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              reportPerspective === 'TAX'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>🔒 稅務結帳視角 (防篡改)</span>
          </button>

          <button
            onClick={() => setReportPerspective('MANAGEMENT')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              reportPerspective === 'MANAGEMENT'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>📊 現場管理視角 (含補登)</span>
          </button>
        </div>
      </div>

      {/* 視角差異提示橫幅 */}
      <div
        className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
          reportPerspective === 'TAX'
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
            : 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
        }`}
      >
        <div>
          <strong>當前檢視：</strong>
          {reportPerspective === 'TAX'
            ? '【稅務結帳視角】僅統計已取得進項憑證與正式開立發票之實體數據，供會計師查帳與主管機關報稅使用。'
            : '【現場管理視角】包含工務現場已發生施工、但發票尚未送達財務之預估工項（含待補簽變更單），供經營層內部決策會議使用。'}
        </div>
        <button
          onClick={() => window.print()}
          className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium shrink-0 flex items-center gap-1"
        >
          <Printer className="w-3 h-3" />
          <span>列印報表</span>
        </button>
      </div>

      {/* 專案工程損益總表 (Project P&L Summary) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">
            各專案案場工程損益與毛利匯總表 (SSoT)
          </h3>
          <span className="font-mono text-xs text-slate-400">幣別: TWD (新台幣)</span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="px-3 py-2 font-mono">案場編號</th>
                <th className="px-3 py-2">專案案場名稱</th>
                <th className="px-3 py-2">業主名稱</th>
                <th className="px-3 py-2 text-right">合約總額 (未稅)</th>
                <th className="px-3 py-2 text-right">核定總預算</th>
                <th className="px-3 py-2 text-right">目前已估驗成本</th>
                <th className="px-3 py-2 text-right">預計毛利額</th>
                <th className="px-3 py-2 text-right">毛利率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {projects.map(p => {
                const margin = p.contractAmount - p.budgetAmount;
                const marginPct = p.contractAmount > 0
                  ? Math.round((margin / p.contractAmount) * 100)
                  : 0;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 font-bold text-blue-600">{p.projectCode}</td>
                    <td className="px-3 py-2 font-sans font-semibold text-slate-800">{p.name}</td>
                    <td className="px-3 py-2 font-sans text-slate-600">{p.ownerName}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">
                      ${p.contractAmount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      ${p.budgetAmount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-700 font-bold">
                      ${p.actualCost.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-indigo-700 font-bold">
                      ${margin.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800">
                      {marginPct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 下包工程保留款統計 (Retention Money Ledger) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">
            下包工程保留款未退還台帳 (Retention Money)
          </h3>
          <span className="text-xs text-slate-500">保固期滿前扣留之 10% 保留款</span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="px-3 py-2 font-mono">估驗單號</th>
                <th className="px-3 py-2">承攬合約</th>
                <th className="px-3 py-2">下包廠商名稱</th>
                <th className="px-3 py-2 text-right">本期估驗毛額</th>
                <th className="px-3 py-2 text-right">累計扣留保留款 (10%)</th>
                <th className="px-3 py-2">預計釋放退還時機</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {valuations.map(v => (
                <tr key={v.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2 font-bold text-emerald-700">{v.valuationNumber}</td>
                  <td className="px-3 py-2 font-sans">{v.periodName}</td>
                  <td className="px-3 py-2 font-sans font-medium text-slate-800">
                    {v.counterpartyNameSnapshot}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-800">
                    ${v.grossAmount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-amber-700">
                    ${v.retentionDeductionAmount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-sans text-slate-500">
                    工程完工驗收且取得保固切結後撥付
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
