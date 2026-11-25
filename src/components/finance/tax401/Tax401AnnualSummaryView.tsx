// src/components/finance/tax401/Tax401AnnualSummaryView.tsx
// 401 年度進銷項稅額統整表視圖

import React from 'react';
import { Company, CompanyTaxSetting } from '../../../types/erp';
import { Period401Metrics } from '../../../utils/tax401Calculator';

interface Tax401AnnualSummaryViewProps {
  activeCompany?: Company;
  selectedCompanyId: string;
  selectedYear: number;
  activeSetting?: CompanyTaxSetting;
  activeCompanyPeriods: Period401Metrics[];
  onSelectPeriod: (periodCode: string) => void;
}

export const Tax401AnnualSummaryView: React.FC<Tax401AnnualSummaryViewProps> = ({
  activeCompany,
  selectedCompanyId,
  selectedYear,
  activeSetting,
  activeCompanyPeriods,
  onSelectPeriod,
}) => {
  const sumOutSales = activeCompanyPeriods.reduce((s, p) => s + p.outSalesNet, 0);
  const sumOutTax = activeCompanyPeriods.reduce((s, p) => s + p.outTax, 0);
  const sumInPurchase = activeCompanyPeriods.reduce((s, p) => s + p.inPurchaseNet, 0);
  const sumInTax = activeCompanyPeriods.reduce((s, p) => s + p.inTax, 0);
  const sumPayable = activeCompanyPeriods.reduce((s, p) => s + p.code11NetPayable, 0);
  const endCredit = activeCompanyPeriods[activeCompanyPeriods.length - 1]?.code12AccumCredit || 0;
  const sumNon401 = activeCompanyPeriods.reduce((s, p) => s + p.non401Total, 0);

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-950 flex flex-wrap items-center justify-between gap-2">
        <div>
          <b>【{activeCompany?.shortName || selectedCompanyId}】{selectedYear} 年度進銷項稅額統整表</b>
          <span className="ml-2 text-purple-700">
            （期初上年度留抵：NT$ {Number(activeSetting?.priorYearCreditTax || 0).toLocaleString()}，各期負數留抵自動結轉至下期 Code 8）
          </span>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="p-2.5">申報期別</th>
              <th className="p-2.5 text-right">銷項銷售額 (未稅)</th>
              <th className="p-2.5 text-right">銷項稅額 (Code 1)</th>
              <th className="p-2.5 text-right">得抵扣進項額</th>
              <th className="p-2.5 text-right">得抵扣進項稅 (Code 7)</th>
              <th className="p-2.5 text-right">上期留抵 (Code 8)</th>
              <th className="p-2.5 text-right">本期應繳 / (留抵)</th>
              <th className="p-2.5 text-right text-amber-800">含預計模擬應繳/(留抵)</th>
              <th className="p-2.5 text-right">收據/不申報憑證</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {activeCompanyPeriods.map(pm => {
              const netReal = pm.outTax - pm.code10TotalDeductible;
              const netSim = pm.simOutTax - pm.simCode10TotalDeductible;
              return (
                <tr
                  key={pm.periodCode}
                  onClick={() => onSelectPeriod(pm.periodCode)}
                  className="hover:bg-indigo-50/40 cursor-pointer"
                >
                  <td className="p-2.5 font-sans font-bold text-indigo-700 underline">{selectedYear} {pm.label}</td>
                  <td className="p-2.5 text-right">NT$ {pm.outSalesNet.toLocaleString()}</td>
                  <td className="p-2.5 text-right font-bold text-slate-900">NT$ {pm.outTax.toLocaleString()}</td>
                  <td className="p-2.5 text-right">NT$ {pm.inPurchaseNet.toLocaleString()}</td>
                  <td className="p-2.5 text-right font-bold text-emerald-700">NT$ {pm.inTax.toLocaleString()}</td>
                  <td className="p-2.5 text-right text-blue-700">NT$ {pm.code8PriorCredit.toLocaleString()}</td>
                  <td className={`p-2.5 text-right font-black ${netReal > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {netReal > 0 ? `繳 $${netReal.toLocaleString()}` : `留抵 $${Math.abs(netReal).toLocaleString()}`}
                  </td>
                  <td className={`p-2.5 text-right font-bold ${netSim > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {netSim > 0 ? `繳 $${netSim.toLocaleString()}` : `留抵 $${Math.abs(netSim).toLocaleString()}`}
                  </td>
                  <td className="p-2.5 text-right text-slate-600">NT$ {pm.non401Total.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-900 text-white font-mono font-bold">
            <tr>
              <td className="p-3 font-sans">年度合計 / 年底結餘</td>
              <td className="p-3 text-right">NT$ {sumOutSales.toLocaleString()}</td>
              <td className="p-3 text-right">NT$ {sumOutTax.toLocaleString()}</td>
              <td className="p-3 text-right">NT$ {sumInPurchase.toLocaleString()}</td>
              <td className="p-3 text-right">NT$ {sumInTax.toLocaleString()}</td>
              <td className="p-3 text-right text-slate-300">-</td>
              <td className="p-3 text-right text-amber-300">
                實繳共 ${sumPayable.toLocaleString()} / 末留 ${endCredit.toLocaleString()}
              </td>
              <td className="p-3 text-right text-slate-300">-</td>
              <td className="p-3 text-right">NT$ {sumNon401.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
