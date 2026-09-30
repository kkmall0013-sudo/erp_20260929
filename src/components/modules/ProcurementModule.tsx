import React, { useState } from 'react';
import { PurchaseOrder, BusinessPartner, Project } from '../../types/erp';
import { ShoppingCart, Plus, CheckCircle, ShieldCheck, Lock, Building, DollarSign, Tag, FileText } from 'lucide-react';
import { getDatabase, saveDatabaseSnapshot, logAudit } from '../../db/sqlite';

interface ProcurementModuleProps {
  purchaseOrders: PurchaseOrder[];
  partners: BusinessPartner[];
  projects: Project[];
  onDataChanged: () => void;
}

export const ProcurementModule: React.FC<ProcurementModuleProps> = ({
  purchaseOrders,
  partners,
  projects,
  onDataChanged,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<string>(purchaseOrders[0]?.id || '');
  const vendors = partners.filter(p => p.type === 'VENDOR' || p.type === 'BOTH' || p.type === 'SUBCONTRACTOR');

  const [newPO, setNewPO] = useState({
    poNumber: `PO-202604-000${purchaseOrders.length + 1}`,
    projectId: projects[0]?.id || 'PRJ-01',
    vendorId: vendors[0]?.id || 'BP-03',
    netAmount: 5000000,
    isPrepaidDeduction: false,
    prepaidDeductionAmount: 500000,
  });

  const selectedPO = purchaseOrders.find(p => p.id === selectedPOId) || purchaseOrders[0];

  // 單據過帳 (落實憲法 RULE-3.9: 實體文字快照鎖死)
  const handlePostPO = async (po: PurchaseOrder) => {
    if (po.status === 'POSTED') return;
    const db = await getDatabase();
    const vendor = partners.find(p => p.id === po.vendorId);
    const project = projects.find(p => p.id === po.projectId);

    const vendorNameSnapshot = (vendor?.name || '供應商').replace(/'/g, "''");
    const vendorTaxIdSnapshot = vendor?.taxId || '88888888';
    const projectNameSnapshot = (project?.name || '工程案場').replace(/'/g, "''");
    const now = new Date().toISOString().substring(0, 10);

    db.run(`
      UPDATE purchase_orders
      SET status = 'POSTED',
          counterpartyNameSnapshot = '${vendorNameSnapshot}',
          counterpartyTaxIdSnapshot = '${vendorTaxIdSnapshot}',
          projectNameSnapshot = '${projectNameSnapshot}',
          postedTaxRate = 0.05,
          version = version + 1,
          updatedAt = '${now}'
      WHERE id = '${po.id}';
    `);

    // 同步自動拋轉應付憑單 (AP)
    const apId = `AP-${Date.now().toString().slice(-4)}`;
    db.run(`
      INSERT INTO accounts_payable (id, apNumber, sourceTable, sourceId, companyId, vendorId, vendorName, originalAmount, appliedAmount, remainingAmount, dueDate, status, createdAt)
      VALUES ('${apId}', 'AP-${po.poNumber.slice(-10)}', 'PURCHASE_ORDER', '${po.id}', '${po.companyId}', '${po.vendorId}', '${vendorNameSnapshot}', ${po.totalAmount}, 0, ${po.totalAmount}, '2026-05-31', 'OPEN', '${now}');
    `);

    logAudit(db, '黃副總經理', 'POST', 'purchase_orders', po.id, { status: po.status }, { status: 'POSTED', counterpartyNameSnapshot: vendorNameSnapshot });
    saveDatabaseSnapshot();
    onDataChanged();
  };

  // 建立新採購單
  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = await getDatabase();
    const vendor = partners.find(p => p.id === newPO.vendorId);
    const project = projects.find(p => p.id === newPO.projectId);

    const id = `PO-${Date.now().toString().slice(-4)}`;
    const tax = Math.round(newPO.netAmount * 0.05);
    const total = newPO.netAmount + tax;
    const now = new Date().toISOString().substring(0, 10);

    db.run(`
      INSERT INTO purchase_orders (id, poNumber, companyId, projectId, vendorId, currency, netAmount, taxAmount, totalAmount, discountAmount, retentionDeductionAmount, postedTaxRate, counterpartyNameSnapshot, counterpartyTaxIdSnapshot, projectNameSnapshot, isPrepaidDeduction, prepaidDeductionAmount, status, isDeleted, version, createdAt, updatedAt)
      VALUES ('${id}', '${newPO.poNumber}', 'COMP-01', '${newPO.projectId}', '${newPO.vendorId}', 'TWD', ${newPO.netAmount}, ${tax}, ${total}, 0, 0, 0.05, '${(vendor?.name || '').replace(/'/g, "''")}', '${vendor?.taxId || ''}', '${(project?.name || '').replace(/'/g, "''")}', ${newPO.isPrepaidDeduction ? 1 : 0}, ${newPO.isPrepaidDeduction ? newPO.prepaidDeductionAmount : 0}, 'DRAFT', 0, 1, '${now}', '${now}');
    `);

    // 建立明細項目
    db.run(`
      INSERT INTO purchase_order_items (id, purchaseOrderId, itemCode, itemName, spec, quantity, unit, unitPrice, lineTotal)
      VALUES ('POI-${id}', '${id}', 'MAT-NEW', '工程採購原物料', '符合國家工程 CNS 規範', 1, '式', ${newPO.netAmount}, ${newPO.netAmount});
    `);

    logAudit(db, '黃副總經理', 'CREATE', 'purchase_orders', id, undefined, { poNumber: newPO.poNumber, total });
    saveDatabaseSnapshot();
    onDataChanged();
    setShowCreateModal(false);
    setSelectedPOId(id);
  };

  return (
    <div className="space-y-6">
      {/* 標題與簡介 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              採購與發包模組 (Phase 5 & 憲法第三、五篇)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              採購單開立 · 預付沖銷連動 · 過帳實體文字快照 (Frozen Snapshot) 法律級防弊
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>開立採購單</span>
        </button>
      </div>

      {/* 採購單主工作台 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側清單 */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            採購單列表 ({purchaseOrders.length})
          </div>

          {purchaseOrders.map((po) => {
            const isSelected = po.id === selectedPO?.id;
            return (
              <div
                key={po.id}
                onClick={() => setSelectedPOId(po.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-50/40 border-amber-500 shadow-sm ring-1 ring-amber-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-amber-700">
                      {po.poNumber}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-1">
                      {po.counterpartyNameSnapshot || '廠商建檔中'}
                    </h4>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                      po.status === 'POSTED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {po.status === 'POSTED' && <ShieldCheck className="w-3 h-3 text-emerald-600" />}
                    {po.status === 'POSTED' ? '已過帳凍結' : '草稿評估'}
                  </span>
                </div>

                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" />
                  <span className="truncate">{po.projectNameSnapshot || '關聯專案'}</span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">含稅總計</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    ${po.totalAmount.toLocaleString()} NTD
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 右側詳細資料面板 */}
        {selectedPO && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                    {selectedPO.poNumber}
                  </span>
                  <span className="text-xs text-slate-400">
                    立單日: {selectedPO.createdAt}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedPO.counterpartyNameSnapshot || '尚未鎖定快照'}
                </h3>
              </div>

              {/* 過帳放行按鈕 (憲法快照凍結) */}
              {selectedPO.status !== 'POSTED' ? (
                <button
                  onClick={() => handlePostPO(selectedPO)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>核准過帳 (鎖死快照並拋轉 AP)</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                  <Lock className="w-3.5 h-3.5" />
                  <span>已過帳：實體文字快照已永久鎖定</span>
                </div>
              )}
            </div>

            {/* 過帳文字實體快照展示 (RULE-3.9) */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  憲法過帳防篡改實體快照 (Frozen Snapshot)
                </span>
                <span className="text-[11px] text-slate-400">
                  過帳稅率快照: {(selectedPO.postedTaxRate * 100).toFixed(0)}%
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <div className="text-[11px] text-slate-400">對手方公司全名快照</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedPO.counterpartyNameSnapshot}
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <div className="text-[11px] text-slate-400">統一編號快照 (Tax ID)</div>
                  <div className="font-mono font-semibold text-slate-800 mt-0.5">
                    {selectedPO.counterpartyTaxIdSnapshot || '無統編'}
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <div className="text-[11px] text-slate-400">所屬專案名稱快照</div>
                  <div className="font-semibold text-slate-800 mt-0.5 line-clamp-1">
                    {selectedPO.projectNameSnapshot}
                  </div>
                </div>
              </div>
            </div>

            {/* 金額統計 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-400">採購未稅總計</div>
                <div className="font-mono text-base font-bold text-slate-900 tabular-nums">
                  ${selectedPO.netAmount.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-400">營業稅額 (5%)</div>
                <div className="font-mono text-base font-bold text-slate-700 tabular-nums">
                  ${selectedPO.taxAmount.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200">
                <div className="text-[11px] text-amber-800 font-semibold">應付總額 (含稅)</div>
                <div className="font-mono text-base font-bold text-amber-800 tabular-nums">
                  ${selectedPO.totalAmount.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-400">預付款扣抵狀態</div>
                <div className="font-mono text-xs font-bold text-slate-800 mt-1">
                  {selectedPO.isPrepaidDeduction ? `已扣抵 $${selectedPO.prepaidDeductionAmount.toLocaleString()}` : '無扣抵'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 開立採購單 Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">開立採購單</h3>
            <form onSubmit={handleCreatePO} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">採購單編號</label>
                <input
                  type="text"
                  required
                  value={newPO.poNumber}
                  onChange={e => setNewPO({ ...newPO, poNumber: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">選擇工程案場</label>
                  <select
                    value={newPO.projectId}
                    onChange={e => setNewPO({ ...newPO, projectId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">選擇供應商 / 下包</label>
                  <select
                    value={newPO.vendorId}
                    onChange={e => setNewPO({ ...newPO, vendorId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  >
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.taxId})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">採購未稅金額 (NTD)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newPO.netAmount}
                  onChange={e => setNewPO({ ...newPO, netAmount: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                />
              </div>

              {/* 預付款扣抵開關 (RULE-5.3) */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPO.isPrepaidDeduction}
                    onChange={e => setNewPO({ ...newPO, isPrepaidDeduction: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-800">本次由預付款扣抵 (防重複付款)</span>
                </label>
                {newPO.isPrepaidDeduction && (
                  <input
                    type="number"
                    min="0"
                    placeholder="輸入預付款扣抵金額"
                    value={newPO.prepaidDeductionAmount}
                    onChange={e => setNewPO({ ...newPO, prepaidDeductionAmount: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  儲存建立
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
