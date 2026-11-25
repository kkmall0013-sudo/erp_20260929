// src/components/widgets/internal-assets/InternalAssetLifecycleModal.tsx
// 🔧 廠內資產維修保養紀錄與全生命週期履歷 Modal（含 KPI 總耗資 + 維修工單 + 進料明細 + 履歷資訊 3 分頁）

import React, { useState } from 'react';
import { Wrench, Truck, History, Plus, Save, Trash2, Clock, X } from 'lucide-react';
import { InternalAsset, AssetMaintenanceRecord } from '../../../utils/internalAssetStore';
import { InboundReceipt } from '../../../types/erp';
import { ConfirmDialogModal } from '../ConfirmDialogModal';

export interface AssetLifecycleStats {
  purchaseCost: number;
  inboundCount: number;
  inboundAmount: number;
  inboundReceipts: InboundReceipt[];
  maintCount: number;
  maintAmount: number;
  maintList: AssetMaintenanceRecord[];
  totalLifetimeSpend: number;
}

interface InternalAssetLifecycleModalProps {
  target: InternalAsset | null;
  subTab: 'LOGS' | 'INBOUND' | 'PROFILE';
  setSubTab: (tab: 'LOGS' | 'INBOUND' | 'PROFILE') => void;
  isAddingMaintenance: boolean;
  setIsAddingMaintenance: (val: boolean) => void;
  maintFormData: Partial<AssetMaintenanceRecord>;
  setMaintFormData: React.Dispatch<React.SetStateAction<Partial<AssetMaintenanceRecord>>>;
  stats: AssetLifecycleStats | null;
  onClose: () => void;
  onSaveMaintenance: (e: React.FormEvent) => void;
  onDeleteMaintenance: (recordId: string) => void;
}

export const InternalAssetLifecycleModal: React.FC<InternalAssetLifecycleModalProps> = ({
  target,
  subTab,
  setSubTab,
  isAddingMaintenance,
  setIsAddingMaintenance,
  maintFormData,
  setMaintFormData,
  stats,
  onClose,
  onSaveMaintenance,
  onDeleteMaintenance
}) => {
  const [deleteRecordTarget, setDeleteRecordTarget] = useState<AssetMaintenanceRecord | null>(null);

  if (!target || !stats) return null;

  return (
    <>
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    {target.name}
                  </h3>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    代碼: {target.code}
                  </span>
                  {target.licensePlate && (
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-bold">
                      車牌: {target.licensePlate}
                    </span>
                  )}
                  {target.status === 'RETIRED' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-bold">
                      已汰除報廢 (歷史留存)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  動產全生命週期耗資總成 · 歷次維修保養紀錄與現場材料進貨追溯
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 生命週期耗資 KPI 指標看板 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5 bg-slate-50 border-b border-slate-200 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <div className="text-slate-500 text-[11px] font-semibold">原始購入成本</div>
              <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                NT$ {stats.purchaseCost.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                啟用日: {target.purchaseDate || '未載'}
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <div className="text-indigo-600 text-[11px] font-semibold">現場進料簽收成本</div>
              <div className="text-lg font-bold font-mono text-indigo-700 mt-1">
                NT$ {stats.inboundAmount.toLocaleString()}
              </div>
              <div className="text-[10px] text-indigo-500 mt-0.5">
                累積 {stats.inboundCount} 筆簽收單
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <div className="text-blue-600 text-[11px] font-semibold">歷次維修保養花費</div>
              <div className="text-lg font-bold font-mono text-blue-700 mt-1">
                NT$ {stats.maintAmount.toLocaleString()}
              </div>
              <div className="text-[10px] text-blue-500 mt-0.5">
                累積 {stats.maintCount} 次維修工單
              </div>
            </div>

            <div className="p-3 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200">
              <div className="text-indigo-950 text-[11px] font-bold">全生命週期累積總支出</div>
              <div className="text-xl font-bold font-mono text-indigo-900 mt-1">
                NT$ {stats.totalLifetimeSpend.toLocaleString()}
              </div>
              <div className="text-[10px] text-indigo-600 mt-0.5 font-medium">
                購置 + 進料 + 保養
              </div>
            </div>
          </div>

          {/* 子分頁導航 */}
          <div className="px-6 border-b border-slate-200 bg-white flex items-center justify-between text-xs">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setSubTab('LOGS')}
                className={`py-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  subTab === 'LOGS'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>歷次維修保養工單 ({target.maintenanceRecords?.length || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTab('INBOUND')}
                className={`py-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  subTab === 'INBOUND'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>現場材料進貨清單 ({stats.inboundCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTab('PROFILE')}
                className={`py-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  subTab === 'PROFILE'
                    ? 'border-slate-800 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>動產履歷與除役資訊</span>
              </button>
            </div>

            {subTab === 'LOGS' && (
              <button
                type="button"
                onClick={() => setIsAddingMaintenance(!isAddingMaintenance)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingMaintenance ? '收合表單' : '登記維修保養單'}</span>
              </button>
            )}
          </div>

          {/* 子分頁內容 */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* 分頁 1: 維修保養工單清單與登記表單 */}
            {subTab === 'LOGS' && (
              <div className="space-y-5">
                {isAddingMaintenance && (
                  <form onSubmit={onSaveMaintenance} className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3 animate-in fade-in duration-150 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-blue-200 font-bold text-blue-900">
                      <span>登記新維修保養工單：</span>
                      <span className="text-[11px] font-normal text-blue-700">記錄修配廠費用、更換零件與里程</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          維修/保養日期 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={maintFormData.recordDate || ''}
                          onChange={e => setMaintFormData({ ...maintFormData, recordDate: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          保養維護類別 <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={maintFormData.maintenanceType}
                          onChange={e => setMaintFormData({ ...maintFormData, maintenanceType: e.target.value as any })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="REGULAR">定期保養 (換油/濾心/定檢)</option>
                          <option value="REPAIR">故障叫修 (臨時急修/漏油)</option>
                          <option value="OVERHAUL">重大翻修 (引擎/底盤大修)</option>
                          <option value="PARTS_REPLACEMENT">零件耗損更換 (輪胎/來令片/履帶)</option>
                          <option value="INSPECTION">監理法定檢驗 / 安全檢查</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          維修保養花費金額 (NT$) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={maintFormData.cost || 0}
                          onChange={e => setMaintFormData({ ...maintFormData, cost: Number(e.target.value) })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1">
                          維修保養項目主旨 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="如: 8萬公里全車大保養、更換左右後輪剎車皮"
                          value={maintFormData.title || ''}
                          onChange={e => setMaintFormData({ ...maintFormData, title: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          承修廠商 / 修配廠
                        </label>
                        <input
                          type="text"
                          placeholder="如: 台日汽車保養廠"
                          value={maintFormData.vendorName || ''}
                          onChange={e => setMaintFormData({ ...maintFormData, vendorName: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          維修發票號 / 工單單號
                        </label>
                        <input
                          type="text"
                          placeholder="如: INV-2026-009"
                          value={maintFormData.invoiceNumber || ''}
                          onChange={e => setMaintFormData({ ...maintFormData, invoiceNumber: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          當前里程數 / 運轉時數
                        </label>
                        <input
                          type="text"
                          placeholder="如: 88,500 km 或 1,200 小時"
                          value={maintFormData.mileageOrHours || ''}
                          onChange={e => setMaintFormData({ ...maintFormData, mileageOrHours: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          完工處理狀態
                        </label>
                        <select
                          value={maintFormData.status}
                          onChange={e => setMaintFormData({ ...maintFormData, status: e.target.value as any })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="COMPLETED">✅ 已完工驗收</option>
                          <option value="IN_PROGRESS">🔧 進廠修繕中 (暫停出勤)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        故障原因與處理說明 (更換零件、材料明細)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="更換之機油型號、更換油封規格、檢驗數值備忘..."
                        value={maintFormData.description || ''}
                        onChange={e => setMaintFormData({ ...maintFormData, description: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingMaintenance(false)}
                        className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>儲存維修紀錄</span>
                      </button>
                    </div>
                  </form>
                )}

                {(!target.maintenanceRecords || target.maintenanceRecords.length === 0) ? (
                  <div className="p-10 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                    此動產目前尚無維修保養紀錄。點擊上方「登記維修保養單」即可記錄保養換油、修配廠費用與更換材料。
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-slate-100">
                    {target.maintenanceRecords.map(rec => (
                      <div key={rec.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-500 font-bold">
                              {rec.recordDate}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {rec.maintenanceType === 'REGULAR'
                                ? '定期保養'
                                : rec.maintenanceType === 'REPAIR'
                                ? '故障搶修'
                                : rec.maintenanceType === 'OVERHAUL'
                                ? '重大翻修'
                                : rec.maintenanceType === 'PARTS_REPLACEMENT'
                                ? '零件更換'
                                : '定期檢驗'}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">
                              {rec.title}
                            </span>
                            {rec.status === 'IN_PROGRESS' ? (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                進廠處理中
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                                已完工
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-slate-500 text-[11px]">
                            <span>承修廠: <strong className="text-slate-700">{rec.vendorName || '修配廠'}</strong></span>
                            {rec.invoiceNumber && <span>單據/發票: <strong className="font-mono text-slate-700">{rec.invoiceNumber}</strong></span>}
                            {rec.mileageOrHours && <span>里程/工時: <strong className="font-mono text-slate-700">{rec.mileageOrHours}</strong></span>}
                            {rec.handledBy && <span>經辦: {rec.handledBy}</span>}
                          </div>

                          {rec.description && (
                            <p className="text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px] mt-1 leading-relaxed">
                              {rec.description}
                            </p>
                          )}
                        </div>

                        <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0">
                          <div className="font-mono font-bold text-blue-700 text-sm">
                            NT$ {rec.cost.toLocaleString()}
                          </div>
                          <button
                            type="button"
                            onClick={() => setDeleteRecordTarget(rec)}
                            className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="刪除此筆維修紀錄"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 分頁 2: 現場材料進貨清單 */}
            {subTab === 'INBOUND' && (
              <div className="space-y-4">
                {stats.inboundReceipts.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                    目前尚無以【{target.name}】名義簽收進場之物料簽收單。
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-slate-100 text-xs">
                    {stats.inboundReceipts.map(r => (
                      <div key={r.id} className="p-3.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">
                              {r.receiptNumber}
                            </span>
                            <span className="font-mono text-slate-500">
                              {r.receivedDate}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              廠商: {r.vendorNameSnapshot || '廠商'}
                            </span>
                            {r.deliveryNoteNumber && (
                              <span className="font-mono text-slate-500 text-[11px]">
                                送貨單: {r.deliveryNoteNumber}
                              </span>
                            )}
                          </div>
                          <div className="font-mono font-bold text-indigo-700 text-sm">
                            NT$ {r.totalAmount.toLocaleString()}
                          </div>
                        </div>

                        <div className="mt-2 pl-3 border-l-2 border-indigo-200 space-y-1">
                          {(r.items || []).map((it, itIdx) => (
                            <div key={it.id || itIdx} className="flex items-center justify-between text-slate-600 text-[11px]">
                              <span>{it.itemName} {it.spec ? `(${it.spec})` : ''}</span>
                              <span className="font-mono">{it.quantity} {it.unit} @ ${it.unitPrice} = <strong>${it.lineTotal}</strong></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 分頁 3: 動產履歷與除役資訊 */}
            {subTab === 'PROFILE' && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-slate-400 block text-[11px]">資產全銜名稱</span>
                    <strong className="text-slate-900 text-sm">{target.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">系統專用代碼</span>
                    <strong className="text-indigo-700 font-mono text-sm">{target.code}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">當前運作狀態</span>
                    <strong className="text-slate-900">
                      {target.status === 'RETIRED'
                        ? '已除役/汰除 (歷史留存)'
                        : target.status === 'MAINTENANCE'
                        ? '保養檢修中'
                        : '現役服役中'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">購置啟用日期</span>
                    <span className="font-mono text-slate-800">{target.purchaseDate || '未登記'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">原始購置成本</span>
                    <span className="font-mono text-slate-800 font-bold">NT$ {Number(target.purchaseCost || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">專責保管人 / 司機</span>
                    <span className="text-slate-800 font-medium">{target.driverOrCustodian || '公務輪派'}</span>
                  </div>
                </div>

                {target.status === 'RETIRED' && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1.5 mt-2">
                    <div className="font-bold text-amber-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>動產除役報廢詳細存檔：</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-amber-950">
                      <div>汰除日期：<strong className="font-mono">{target.retiredDate || '已除役'}</strong></div>
                      <div>處分方式：<strong>{target.disposalMethod || '報廢處分'}</strong></div>
                      <div>回收殘值：<strong className="font-mono">NT$ {Number(target.salvageAmount || 0).toLocaleString()}</strong></div>
                      <div className="col-span-2">除役原因：{target.retiredReason || '使用年限屆滿'}</div>
                      {target.replacedByAssetName && (
                        <div className="col-span-3 text-indigo-700 font-bold">
                          接棒接替新資產：{target.replacedByAssetName}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">常用自動對齊別名</span>
                  <div className="flex flex-wrap gap-1">
                    {(target.aliases || []).map((al, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-slate-700">
                        {al}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 刪除維修保養紀錄二次確認 */}
      <ConfirmDialogModal
        isOpen={!!deleteRecordTarget}
        title="確定刪除此筆維修保養紀錄？"
        variant="danger"
        message={
          <span>
            即將刪除維修工單「<strong className="text-slate-900">{deleteRecordTarget?.title}</strong>」（金額 NT$ {(deleteRecordTarget?.cost || 0).toLocaleString()}），刪除後將同步扣除生命週期累積耗資。
          </span>
        }
        confirmText="確認刪除"
        onCancel={() => setDeleteRecordTarget(null)}
        onConfirm={() => {
          if (deleteRecordTarget) {
            onDeleteMaintenance(deleteRecordTarget.id);
          }
          setDeleteRecordTarget(null);
        }}
      />
    </>
  );
};
