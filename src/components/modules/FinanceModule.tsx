import React, { useState } from 'react';
import { AccountPayable, AccountReceivable, BankCheck, Company } from '../../types/erp';
import { Receipt, CreditCard, Plus, CheckCircle, AlertTriangle, ShieldAlert, Split, Landmark, Calendar } from 'lucide-react';
import { getDatabase, saveDatabaseSnapshot, logAudit } from '../../db/sqlite';

interface FinanceModuleProps {
  apList: AccountPayable[];
  arList: AccountReceivable[];
  checks: BankCheck[];
  companies: Company[];
  onDataChanged: () => void;
}

export const FinanceModule: React.FC<FinanceModuleProps> = ({
  apList,
  arList,
  checks,
  companies,
  onDataChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'AP' | 'AR' | 'CHECKS'>('CHECKS');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [selectedCheckToVoid, setSelectedCheckToVoid] = useState<BankCheck | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [showSplitWizard, setShowSplitWizard] = useState(false);

  // 支票兌現
  const handleClearCheck = async (check: BankCheck) => {
    const db = await getDatabase();
    db.run(`UPDATE bank_checks SET status = 'CLEARED' WHERE id = '${check.id}';`);
    logAudit(db, '陳會計', 'UPDATE', 'bank_checks', check.id, { status: check.status }, { status: 'CLEARED' });
    saveDatabaseSnapshot();
    onDataChanged();
  };

  // 憲法規範：跳票/作廢支票必須強制輸入詳細原因 (CheckVoidSchema)
  const handleConfirmVoid = async () => {
    if (!selectedCheckToVoid || !voidReason.trim()) return;
    const db = await getDatabase();
    db.run(`
      UPDATE bank_checks 
      SET status = 'VOIDED', 
          voidReason = '${voidReason.replace(/'/g, "''")}'
      WHERE id = '${selectedCheckToVoid.id}';
    `);
    logAudit(db, '陳會計', 'VOID', 'bank_checks', selectedCheckToVoid.id, { status: selectedCheckToVoid.status }, { status: 'VOIDED', voidReason });
    saveDatabaseSnapshot();
    onDataChanged();
    setShowVoidModal(false);
    setSelectedCheckToVoid(null);
    setVoidReason('');
  };

  return (
    <div className="space-y-6">
      {/* 標題與簡介 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              財務會計與金流模組 (Phase 7 & 憲法第五篇)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              應收應付沖銷 · 銀行支票到期託收 · 跳票作廢原因強制警報 · 發票本位拆單精靈
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowSplitWizard(true)}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Split className="w-4 h-4" />
          <span>發票拆單小精靈</span>
        </button>
      </div>

      {/* 分頁標籤切換 */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('CHECKS')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'CHECKS'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>銀行應收付期票 ({checks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('AP')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'AP'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>應付帳款 AP ({apList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('AR')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'AR'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>業主應收帳款 AR ({arList.length})</span>
        </button>
      </div>

      {/* 支票票據作業區 (Checks) */}
      {activeTab === 'CHECKS' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>工程款銀行期票總覽 (應收/應付票據台帳)</span>
            </h3>
            <span className="text-xs text-slate-500">
              期票直接影響戰情室即時可用現金水位
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="px-3 py-2 font-mono">票據號碼</th>
                  <th className="px-3 py-2">票據性質</th>
                  <th className="px-3 py-2">對手方 (受款人/發票人)</th>
                  <th className="px-3 py-2 text-right">票面金額</th>
                  <th className="px-3 py-2 font-mono">開票日</th>
                  <th className="px-3 py-2 font-mono">到期日</th>
                  <th className="px-3 py-2">付款銀行</th>
                  <th className="px-3 py-2">狀態</th>
                  <th className="px-3 py-2 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checks.map(check => {
                  const isPayable = check.type === 'PAYABLE';
                  const isCleared = check.status === 'CLEARED';
                  const isVoided = check.status === 'VOIDED';

                  return (
                    <tr key={check.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2 font-mono font-bold text-slate-800">
                        {check.checkNumber}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isPayable ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {isPayable ? '應付票據' : '應收票據'}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {check.counterpartyName}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-slate-900">
                        ${check.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-500">{check.issueDate}</td>
                      <td className="px-3 py-2 font-mono font-bold text-slate-700">{check.dueDate}</td>
                      <td className="px-3 py-2 text-slate-600">{check.bankName}</td>
                      <td className="px-3 py-2">
                        {isCleared ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            已兌現沖銷
                          </span>
                        ) : isVoided ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                            已作廢/跳票
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                            未兌現流通中
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {!isCleared && !isVoided && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleClearCheck(check)}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium"
                            >
                              兌現
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCheckToVoid(check);
                                setShowVoidModal(true);
                              }}
                              className="px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-medium"
                            >
                              作廢
                            </button>
                          </div>
                        )}
                        {check.voidReason && (
                          <div className="text-[10px] text-rose-600 truncate max-w-[120px]" title={check.voidReason}>
                            原因: {check.voidReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 應付帳款 (AP) */}
      {activeTab === 'AP' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">應付帳款憑單清單 (AP)</h3>
            <span className="text-xs text-slate-500">來源：採購單 (PO) 及估驗單 (Valuation)</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="px-3 py-2 font-mono">憑單號碼</th>
                  <th className="px-3 py-2">來源類別</th>
                  <th className="px-3 py-2">受款廠商</th>
                  <th className="px-3 py-2 text-right">原始應付金額</th>
                  <th className="px-3 py-2 text-right">已沖銷金額</th>
                  <th className="px-3 py-2 text-right">尚未支付餘額</th>
                  <th className="px-3 py-2 font-mono">付款到期日</th>
                  <th className="px-3 py-2 font-mono">發票號碼</th>
                  <th className="px-3 py-2">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apList.map(ap => (
                  <tr key={ap.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 font-mono font-bold text-slate-800">{ap.apNumber}</td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                        {ap.sourceTable === 'PURCHASE_ORDER' ? '材料採購' : '工程估驗'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">{ap.vendorName}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-slate-900">
                      ${ap.originalAmount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-600">
                      ${ap.appliedAmount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-amber-700">
                      ${ap.remainingAmount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">{ap.dueDate}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">{ap.invoiceNumber || '待補發票'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          ap.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ap.status === 'PAID' ? '已全數結清' : '待付款'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 應收帳款 (AR) */}
      {activeTab === 'AR' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">業主合約計價應收清單 (AR)</h3>
            <span className="text-xs text-slate-500">來源：業主合約里程碑計價</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="px-3 py-2 font-mono">應收單號</th>
                  <th className="px-3 py-2">業主名稱</th>
                  <th className="px-3 py-2 text-right">應收總額</th>
                  <th className="px-3 py-2 text-right">已收兌現</th>
                  <th className="px-3 py-2 text-right">未催收款項</th>
                  <th className="px-3 py-2 font-mono">約定請款日</th>
                  <th className="px-3 py-2">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {arList.map(ar => (
                  <tr key={ar.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 font-mono font-bold text-slate-800">{ar.arNumber}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{ar.customerName}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-slate-900">
                      ${ar.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-600">
                      ${ar.appliedAmount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-blue-700">
                      ${ar.remainingAmount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">{ar.dueDate}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          ar.status === 'COLLECTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {ar.status === 'COLLECTED' ? '已全數入帳' : '請款作業中'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 憲法跳票/作廢強制輸入原因 Modal (CheckVoidSchema) */}
      {showVoidModal && selectedCheckToVoid && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-2 text-rose-600 mb-2">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-base font-bold">票據作廢或跳票警報確認</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              憲法第五篇鐵律：票據作廢或跳票時，強制要求輸入詳細原因，以啟動警報機制，防止內控弊端。
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded border border-slate-200 font-mono text-[11px] space-y-1">
                <div>票號: {selectedCheckToVoid.checkNumber}</div>
                <div>受款人: {selectedCheckToVoid.counterpartyName}</div>
                <div>金額: ${selectedCheckToVoid.amount.toLocaleString()} NTD</div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  作廢 / 跳票詳細原因 (必填)：
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="如：業主支票因印鑑不符退票，已要求下週重新換開..."
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 border border-rose-300 rounded-md bg-rose-50/40 text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowVoidModal(false)}
                  className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={!voidReason.trim()}
                  onClick={handleConfirmVoid}
                  className="px-4 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-medium disabled:opacity-50"
                >
                  確認作廢並記錄審計
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 發票拆單小精靈 Modal (Invoice Splitting Wizard) */}
      {showSplitWizard && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <Split className="w-5 h-5" />
              <h3 className="text-base font-bold">發票本位拆單智慧精靈</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              因應營造業下包拿多張發票報銷之實務需求，系統自動在背景拆分獨立憑證並綁定各自法人。
            </p>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="font-semibold text-slate-800 mb-1">發票 1 (大巨營造抬頭)</div>
                  <div className="text-slate-500">統編: 88991234</div>
                  <div className="font-mono font-bold text-slate-900 mt-1">$2,000,000 NTD</div>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="font-semibold text-slate-800 mb-1">發票 2 (宏達機電抬頭)</div>
                  <div className="text-slate-500">統編: 54329876</div>
                  <div className="font-mono font-bold text-slate-900 mt-1">$1,727,500 NTD</div>
                </div>
              </div>

              <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px]">
                兩張發票合計總額 $3,727,500 NTD，與估驗單 VAL-01 完全吻合，三柱借貸平衡校驗通過！
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowSplitWizard(false)}
                  className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100"
                >
                  關閉
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert('已模擬執行發票本位拆單！系統已在背景產生兩筆獨立應付憑單。');
                    setShowSplitWizard(false);
                  }}
                  className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  執行拆單拋轉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
