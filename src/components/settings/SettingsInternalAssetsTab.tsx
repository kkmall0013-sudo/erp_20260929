import React from 'react';
import { Truck, Plus } from 'lucide-react';
import {
  InternalAsset,
  getAssetCategory,
  getAssetCategoryLabel
} from '../../utils/internalAssetStore';

export interface SettingsInternalAssetsTabProps {
  internalAssets: InternalAsset[];
  onOpenAssetModal: () => void;
}

export const SettingsInternalAssetsTab: React.FC<SettingsInternalAssetsTabProps> = ({
  internalAssets,
  onOpenAssetModal
}) => {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl shadow-md border border-slate-700">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>廠內資產維護中心</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-mono">
                動產 · 不動產 · 庫存 三大領域 SSoT
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              車輛機具可能老舊損壞、汰舊換新。本中心分流「在勤使用資產」與「歷史淘汰存檔區」：淘汰物件完整保留歷史簽收、保養修繕履歷與總耗資，新物件自動接棒打單；廠房固定設施與庫存進料登記分門別類，主畫面清爽乾淨。
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAssetModal}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Truck className="w-4 h-4" />
          <span>🚚 開啟廠內資產維護中心</span>
        </button>
      </div>

      {/* 資產統計卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">在勤總資產 (現役)</div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {internalAssets.filter(a => (a as any).status !== 'RETIRED').length}{' '}
            <span className="text-xs font-normal text-slate-400">項</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">動產 / 不動產 / 庫存</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-blue-600">🚗 在勤動產</div>
          <div className="text-2xl font-bold font-mono text-blue-900 mt-1">
            {internalAssets.filter(a => (a as any).status !== 'RETIRED' && getAssetCategory(a) === 'MOVABLE').length}{' '}
            <span className="text-xs font-normal text-blue-400">項</span>
          </div>
          <div className="text-[11px] text-blue-500 mt-0.5">公務貨車、重型施工機具</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-amber-600">🏢 廠內不動產</div>
          <div className="text-2xl font-bold font-mono text-amber-900 mt-1">
            {internalAssets.filter(a => (a as any).status !== 'RETIRED' && getAssetCategory(a) === 'REAL_ESTATE').length}{' '}
            <span className="text-xs font-normal text-amber-400">項</span>
          </div>
          <div className="text-[11px] text-amber-500 mt-0.5">廠房建物、固定設施</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-purple-600">📦 廠內庫存 / 🏛️ 淘汰存檔</div>
          <div className="text-2xl font-bold font-mono text-purple-900 mt-1">
            {internalAssets.filter(a => (a as any).status !== 'RETIRED' && getAssetCategory(a) === 'INVENTORY').length}{' '}
            <span className="text-xs font-normal text-slate-400">庫存 /</span>{' '}
            <span className="text-slate-500 font-normal text-sm">
              {internalAssets.filter(a => (a as any).status === 'RETIRED').length} 淘汰
            </span>
          </div>
          <div className="text-[11px] text-purple-500 mt-0.5">公共備料與歷史汰除存檔</div>
        </div>
      </div>

      {/* 資產清冊清單 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-800">現行廠內資產清冊 (動產 · 不動產 · 庫存)</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              進貨簽收與極速打單模組均對齊此主檔；已淘汰資產移入歷史存檔區，保留簽收歷史防斷鏈
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAssetModal}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新增或編輯資產</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">類別</th>
                <th className="py-3 px-4">資產名稱</th>
                <th className="py-3 px-4">代碼</th>
                <th className="py-3 px-4">車牌號碼 / 司機</th>
                <th className="py-3 px-4">自動辨識別名關鍵字</th>
                <th className="py-3 px-4">說明備註</th>
                <th className="py-3 px-4 text-center">狀態</th>
                <th className="py-3 px-4 text-right">管理操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {internalAssets.map(ast => {
                const isRetired = (ast as any).status === 'RETIRED';
                const isMaint = (ast as any).status === 'MAINTENANCE';
                return (
                  <tr key={ast.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          getAssetCategory(ast) === 'MOVABLE'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : getAssetCategory(ast) === 'REAL_ESTATE'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}
                      >
                        {getAssetCategoryLabel(getAssetCategory(ast))}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{ast.name}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-indigo-700">{ast.code}</td>
                    <td className="py-3 px-4">
                      {ast.licensePlate ? (
                        <div className="font-mono font-bold text-slate-800">
                          {ast.licensePlate}
                          {ast.driverOrCustodian && (
                            <span className="text-[11px] font-normal text-slate-500 ml-1.5">
                              ({ast.driverOrCustodian})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {ast.aliases.map((al, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[10px] border border-slate-200"
                          >
                            {al}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                      {ast.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isRetired ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-300">
                          已汰換/報廢 (保留歷史)
                        </span>
                      ) : isMaint ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          保養檢修中
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          服役中
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={onOpenAssetModal}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                      >
                        維修/履歷/汰換
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
