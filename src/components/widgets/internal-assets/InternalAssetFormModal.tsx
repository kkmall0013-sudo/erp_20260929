// src/components/widgets/internal-assets/InternalAssetFormModal.tsx
// 📝 廠內資產新增與編輯表單 Modal（支援動產 / 不動產 / 庫存三大領域與動態欄位）

import React from 'react';
import { Truck, X, Save } from 'lucide-react';
import { InternalAsset } from '../../../utils/internalAssetStore';

interface InternalAssetFormModalProps {
  isOpen: boolean;
  editingAsset: InternalAsset | null;
  formData: Partial<InternalAsset>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<InternalAsset>>>;
  aliasesInput: string;
  setAliasesInput: (val: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const InternalAssetFormModal: React.FC<InternalAssetFormModalProps> = ({
  isOpen,
  editingAsset,
  formData,
  setFormData,
  aliasesInput,
  setAliasesInput,
  onClose,
  onSubmit
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm">
              {editingAsset ? '編輯廠內資產項目' : '新增廠內資產項目'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4 text-xs">
          {/* 核心三大領域分類選擇 */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              資產核心領域分類 <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    ...formData,
                    assetCategory: 'MOVABLE',
                    type: 'VEHICLE',
                    categoryLabel: '🚗 廠內動產'
                  });
                }}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  (formData.assetCategory || 'MOVABLE') === 'MOVABLE'
                    ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold ring-2 ring-amber-400/40 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="text-base mb-0.5">🚗</div>
                <div className="text-xs font-bold">動產</div>
                <div className="text-[10px] text-slate-400">車輛 · 機具 · 設備</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormData({
                    ...formData,
                    assetCategory: 'REAL_ESTATE',
                    type: 'FACILITY',
                    categoryLabel: '🏢 廠內不動產'
                  });
                }}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  formData.assetCategory === 'REAL_ESTATE'
                    ? 'bg-purple-50 border-purple-500 text-purple-900 font-bold ring-2 ring-purple-400/40 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="text-base mb-0.5">🏢</div>
                <div className="text-xs font-bold">不動產</div>
                <div className="text-[10px] text-slate-400">廠房 · 土地 · 設施</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormData({
                    ...formData,
                    assetCategory: 'INVENTORY',
                    type: 'CENTRAL_STOCK',
                    categoryLabel: '📦 廠內庫存'
                  });
                }}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  formData.assetCategory === 'INVENTORY'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold ring-2 ring-emerald-400/40 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="text-base mb-0.5">📦</div>
                <div className="text-xs font-bold">庫存</div>
                <div className="text-[10px] text-slate-400">常備備料進庫登記</div>
              </button>
            </div>

            {formData.assetCategory === 'INVENTORY' && (
              <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 leading-relaxed">
                💡 <strong>庫存進貨登記說明：</strong>進貨時若選取此項目，貨物將直接登記進廠內公共庫存；依作業慣例，材料消耗時不強制做系統出庫扣帳，主要用於進貨追蹤與總花費累計。
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                系統識別代碼 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder={
                  formData.assetCategory === 'MOVABLE'
                    ? '如: VEH-358、EQ-PC200'
                    : formData.assetCategory === 'REAL_ESTATE'
                    ? '如: FAC-MAIN、FAC-ROOF'
                    : '如: STOCK-01、STOCK-STEEL'
                }
                value={formData.code || ''}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                子項屬性
              </label>
              {formData.assetCategory === 'MOVABLE' ? (
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                >
                  <option value="VEHICLE">🚚 公務車輛 (貨車/卡車)</option>
                  <option value="EQUIPMENT">🚜 重型機具 (怪手/堆高機/發電機)</option>
                </select>
              ) : formData.assetCategory === 'REAL_ESTATE' ? (
                <div className="py-2 px-3 bg-purple-50 text-purple-900 font-semibold rounded-lg border border-purple-200">
                  🏢 廠區土地/廠房建物/固定設施
                </div>
              ) : (
                <div className="py-2 px-3 bg-emerald-50 text-emerald-900 font-semibold rounded-lg border border-emerald-200">
                  📦 廠內常備儲備材料庫存
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              資產顯示全名 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder={
                formData.assetCategory === 'MOVABLE'
                  ? '如: 廠內貨車 [358-AB]、PC-200 挖土機 (怪手)'
                  : formData.assetCategory === 'REAL_ESTATE'
                  ? '如: 五股總廠主廠房、天車起重桁架'
                  : '如: 廠內公共儲備庫存、常備型鋼庫存'
              }
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
              required
            />
          </div>

          {/* 動態分類對應欄位 */}
          {formData.assetCategory === 'MOVABLE' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  車牌號碼 / 機具編號
                </label>
                <input
                  type="text"
                  placeholder="如: 358-AB 或 PC-200"
                  value={formData.licensePlate || ''}
                  onChange={e => setFormData({ ...formData, licensePlate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  專責司機 / 保管人員
                </label>
                <input
                  type="text"
                  placeholder="如: 陳司機 或 機具組"
                  value={formData.driverOrCustodian || ''}
                  onChange={e => setFormData({ ...formData, driverOrCustodian: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          ) : formData.assetCategory === 'REAL_ESTATE' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  坐落地點 / 建物廠房標號
                </label>
                <input
                  type="text"
                  placeholder="如: 新北市五股區成泰路三段廠區"
                  value={formData.locationOrAddress || ''}
                  onChange={e => setFormData({ ...formData, locationOrAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  廠區責任管理同仁
                </label>
                <input
                  type="text"
                  placeholder="如: 廠務主管 / 總務組"
                  value={formData.driverOrCustodian || ''}
                  onChange={e => setFormData({ ...formData, driverOrCustodian: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  存放庫位 / 倉區說明
                </label>
                <input
                  type="text"
                  placeholder="如: 總廠 A 區常備料架、鋼材堆置區"
                  value={formData.locationOrAddress || ''}
                  onChange={e => setFormData({ ...formData, locationOrAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  庫存負責同仁
                </label>
                <input
                  type="text"
                  placeholder="如: 倉管組 / 現場物料員"
                  value={formData.driverOrCustodian || ''}
                  onChange={e => setFormData({ ...formData, driverOrCustodian: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                原始購入 / 取得金額 (選填)
              </label>
              <input
                type="number"
                placeholder="NT$"
                value={formData.purchaseCost || 0}
                onChange={e => setFormData({ ...formData, purchaseCost: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                購置 / 啟用日期
              </label>
              <input
                type="date"
                value={formData.purchaseDate || ''}
                onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>常用辨識別名 (以逗點或空格分隔)</span>
              <span className="text-[10px] text-slate-400 font-normal">現場打單輸入此別名系統會精準自動對齊</span>
            </label>
            <input
              type="text"
              placeholder="如: 358, 358-AB, 怪手, 叉車, 備料, 倉庫"
              value={aliasesInput}
              onChange={e => setAliasesInput(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                運作狀態
              </label>
              <select
                value={formData.status || 'ACTIVE'}
                onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="ACTIVE">✅ 現役服役中 (可於進貨單選取)</option>
                <option value="MAINTENANCE">🔧 保養檢修中 (暫時送修)</option>
                <option value="RETIRED">📦 已除役/汰除 (自動移入歷史淘汰區)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                備註說明
              </label>
              <input
                type="text"
                placeholder="規格說明、購置年份、固定配合修配廠等備忘..."
                value={formData.notes || ''}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>儲存資產資料</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
