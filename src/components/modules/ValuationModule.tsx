import React, { useState } from 'react';
import { Valuation, Subcontract } from '../../types/erp';
import { HardHat, Plus, CheckCircle, ShieldCheck, DollarSign, AlertCircle, FileText, ArrowDown } from 'lucide-react';
import { getDatabase, saveDatabaseSnapshot, logAudit } from '../../db/sqlite';

interface ValuationModuleProps {
  valuations: Valuation[];
  subcontracts: Subcontract[];
  onDataChanged: () => void;
}

export const ValuationModule: React.FC<ValuationModuleProps> = ({
  valuations,
  subcontracts,
  onDataChanged,
}) => {
  const [selectedValuationId, setSelectedValuationId] = useState<string>(valuations[0]?.id || '');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const selectedValuation = valuations.find(v => v.id === selectedValuationId) || valuations[0];

  // 估驗單過帳放行 (憲法瀑布結算與實體快照)
  const handlePostValuation = async (val: Valuation) => {
    if (val.status === 'POSTED') return;
    const db = await getDatabase();
    const now = new Date().toISOString().substring(0, 10);

    db.run(`
      UPDATE valuations
      SET status = 'POSTED',
          version = version + 1,
          updatedAt = '${now}'
      WHERE id = '${val.id}';
    `);

    // 自動拋轉至財務 AP 應付憑單
    const apId = `AP-${Date.now().toString().slice(-4)}`;
    db.run(`
      INSERT INTO accounts_payable (id, apNumber, sourceTable, sourceId, companyId, vendorId, vendorName, originalAmount, appliedAmount, remainingAmount, dueDate, invoiceNumber, taxReportingCompanyId, status, createdAt)
      VALUES ('${apId}', 'AP-${val.valuationNumber}', 'VALUATION', '${val.id}', '${val.companyId}', '${val.subcontractorId}', '${val.counterpartyNameSnapshot.replace(/'/g, "''")}', ${val.totalAmount}, 0, ${val.totalAmount}, '2026-05-15', 'CD-44556677', '${val.companyId}', 'OPEN', '${now}');
    `);

    logAudit(db, '陳會計', 'POST', 'valuations', val.id, { status: val.status }, { status: 'POSTED', totalAmount: val.totalAmount });
    saveDatabaseSnapshot();
    onDataChanged();
  };

  return (
    <div className="space-y-6">
      {/* 標題與簡介 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              發包合約與估驗計價模組 (Phase 6 & 憲法第六篇)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              工程期別計價 · 10% 保留款扣留 · 預付款瀑布結算 · 工區罰扣粉紅扣款
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>開立估驗單</span>
        </button>
      </div>

      {/* 主工作台 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側估驗單清單 */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            下包計價估驗單 ({valuations.length})
          </div>

          {valuations.map((v) => {
            const isSelected = v.id === selectedValuation?.id;
            return (
              <div
                key={v.id}
                onClick={() => setSelectedValuationId(v.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50/40 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-emerald-700">
                      {v.valuationNumber}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-1">
                      {v.periodName}
                    </h4>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      v.status === 'POSTED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {v.status === 'POSTED' ? '已審核過帳' : '工務待審核'}
                  </span>
                </div>

                <div className="text-xs text-slate-500 mt-2 line-clamp-1">
                  下包：{v.counterpartyNameSnapshot}
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">本期應付淨額 (含稅)</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    ${v.totalAmount.toLocaleString()} NTD
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 右側估驗明細與瀑布式結算大腦 */}
        {selectedValuation && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                    {selectedValuation.valuationNumber}
                  </span>
                  <span className="text-xs text-slate-400">
                    計價期別: {selectedValuation.periodName}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedValuation.counterpartyNameSnapshot}
                </h3>
              </div>

              {/* 過帳按鈕 */}
              {selectedValuation.status !== 'POSTED' ? (
                <button
                  onClick={() => handlePostValuation(selectedValuation)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>核准過帳 (自動拋轉 AP 應付憑單)</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>已過帳完成</span>
                </div>
              )}
            </div>

            {/* 瀑布式結算引擎核心公式展示 (Waterfall Settlement Engine) */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 space-y-3">
              <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-2">
                <span>瀑布式結算引擎 (憲法第六篇標準結算流)</span>
                <span className="text-[10px] text-slate-400 font-normal">累計進度: {selectedValuation.cumulativeProgressPct}%</span>
              </h4>

              <div className="space-y-2 text-xs">
                {/* 1. 本期計價毛額 */}
                <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                  <span className="font-medium text-slate-700">1. 本期完成實作毛額 (Gross Amount)</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    ${selectedValuation.grossAmount.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-center -my-1 text-slate-400">
                  <ArrowDown className="w-3.5 h-3.5" />
                </div>

                {/* 2. 扣除 10% 保留款 */}
                <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                  <span className="font-medium text-slate-600">2. 扣除 10% 工程保留款 (Retention Deduction)</span>
                  <span className="font-mono font-bold text-amber-700 tabular-nums">
                    -${selectedValuation.retentionDeductionAmount.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-center -my-1 text-slate-400">
                  <ArrowDown className="w-3.5 h-3.5" />
                </div>

                {/* 3. 扣除動員預付款 */}
                <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                  <span className="font-medium text-slate-600">3. 扣抵前期動員預付款 (Prepaid Deduction)</span>
                  <span className="font-mono font-bold text-blue-700 tabular-nums">
                    -${selectedValuation.prepaidDeductionAmount.toLocaleString()}
                  </span>
                </div>

                {/* 4. 工區違規粉紅扣款 (若有) */}
                {selectedValuation.otherDeductionAmount > 0 && (
                  <>
                    <div className="flex justify-center -my-1 text-slate-400">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-rose-50 border border-rose-200 text-rose-900">
                      <span className="font-semibold">4. 工區環保/工安違規扣款 (粉紅防呆)</span>
                      <span className="font-mono font-bold tabular-nums">
                        -${selectedValuation.otherDeductionAmount.toLocaleString()}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex justify-center -my-1 text-slate-400">
                  <ArrowDown className="w-3.5 h-3.5" />
                </div>

                {/* 最終淨額 */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-600 text-white font-bold">
                  <span>＝ 本期實付未稅款 (Net Payable) + 5% 營業稅</span>
                  <span className="font-mono text-sm tabular-nums">
                    ${selectedValuation.totalAmount.toLocaleString()} NTD
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 簡易開立估驗單 Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">開立下包工程估驗單</h3>
            <div className="space-y-3 text-xs">
              <p className="text-slate-500">
                系統已自動帶出合約承攬約定之 10% 保留款扣除公式與累計期別進度。
              </p>
              <div className="p-3 bg-slate-50 rounded border border-slate-200 font-mono text-[11px] space-y-1">
                <div>合約編號: SC-2026-008</div>
                <div>下包廠商: 合眾基礎連續壁深開挖工程行</div>
                <div>本期估驗金額: $4,500,000</div>
                <div>保留款扣除 (10%): $450,000</div>
                <div>預付沖銷: $500,000</div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100"
                >
                  關閉
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert('已模擬建立估驗單！系統自動完成保留款與預付沖銷計算。');
                    setShowCreateModal(false);
                  }}
                  className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  確認開立
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
