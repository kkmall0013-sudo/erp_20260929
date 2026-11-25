// src/components/widgets/internal-assets/InternalAssetRetireModal.tsx
// 🔄 全物件汰換 / 汰除 / 報廢作業專用彈窗（支援以新換舊自動建立接棒新資產 vs 純汰除除役）

import React from 'react';
import { ArrowRightLeft, Plus, Clock, X } from 'lucide-react';
import { InternalAsset } from '../../../utils/internalAssetStore';

interface InternalAssetRetireModalProps {
  target: InternalAsset | null;
  replaceMode: 'REPLACE_WITH_NEW' | 'RETIRE_ONLY';
  setReplaceMode: (mode: 'REPLACE_WITH_NEW' | 'RETIRE_ONLY') => void;
  retiredReason: string;
  setRetiredReason: (val: string) => void;
  disposalMethod: 'SCRAPPED' | 'SOLD' | 'TRADE_IN' | 'DONATED' | 'STORED';
  setDisposalMethod: (val: 'SCRAPPED' | 'SOLD' | 'TRADE_IN' | 'DONATED' | 'STORED') => void;
  salvageAmount: number;
  setSalvageAmount: (val: number) => void;
  newAssetCode: string;
  setNewAssetCode: (val: string) => void;
  newAssetName: string;
  setNewAssetName: (val: string) => void;
  newLicensePlate: string;
  setNewLicensePlate: (val: string) => void;
  newDriverOrCustodian: string;
  setNewDriverOrCustodian: (val: string) => void;
  newPurchaseCost: number;
  setNewPurchaseCost: (val: number) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const InternalAssetRetireModal: React.FC<InternalAssetRetireModalProps> = ({
  target,
  replaceMode,
  setReplaceMode,
  retiredReason,
  setRetiredReason,
  disposalMethod,
  setDisposalMethod,
  salvageAmount,
  setSalvageAmount,
  newAssetCode,
  setNewAssetCode,
  newAssetName,
  setNewAssetName,
  newLicensePlate,
  setNewLicensePlate,
  newDriverOrCustodian,
  setNewDriverOrCustodian,
  newPurchaseCost,
  setNewPurchaseCost,
  onClose,
  onSubmit
}) => {
  if (!target) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/55 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-5 py-3.5 bg-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-amber-200" />
            <h3 className="font-bold text-sm">
              動產汰換 / 汰除除役作業程序
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-amber-200 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="text-[11px] text-slate-500 font-medium">即將汰除 / 報廢之動產標的：</div>
            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>{target.name}</span>
              <span className="font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                代碼: {target.code}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              ⚠️ 汰除除役後，歷史進貨簽收單與維修花費依然 100% 留存於系統，日常新打單選單自動隱藏。
            </p>
          </div>

          {/* 汰除模式切換 */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              選擇汰換作業類型：
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReplaceMode('REPLACE_WITH_NEW')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  replaceMode === 'REPLACE_WITH_NEW'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold ring-1 ring-indigo-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-indigo-600" />
                  <span>以新換舊 (換代購置)</span>
                </div>
                <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                  除役舊物，同時建立接替新資產
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReplaceMode('RETIRE_ONLY')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  replaceMode === 'RETIRE_ONLY'
                    ? 'border-amber-600 bg-amber-50/70 text-amber-900 font-bold ring-1 ring-amber-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>純粹汰除 (除役報廢)</span>
                </div>
                <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                  老舊報廢不換新，保留歷史帳目
                </div>
              </button>
            </div>
          </div>

          {/* 汰除原因與處分方式 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                汰除 / 報廢處分方式
              </label>
              <select
                value={disposalMethod}
                onChange={e => setDisposalMethod(e.target.value as any)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
              >
                <option value="SCRAPPED">報廢報拆 / 殘值回收</option>
                <option value="SOLD">二手變賣轉讓</option>
                <option value="TRADE_IN">購置新機舊換新折抵</option>
                <option value="STORED">停用封存留廠備料</option>
                <option value="DONATED">無償贈與或移轉</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                處分變賣 / 殘值回收金額
              </label>
              <input
                type="number"
                placeholder="NT$ (無可填 0)"
                value={salvageAmount}
                onChange={e => setSalvageAmount(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              汰換 / 報廢原因說明 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="如: 車齡已高、引擎大修不符效益、專案結束除役等"
              value={retiredReason}
              onChange={e => setRetiredReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
              required
            />
          </div>

          {/* 若選擇「以新換舊」，填寫新資產資料 */}
          {replaceMode === 'REPLACE_WITH_NEW' && (
            <div className="pt-2 border-t border-slate-200">
              <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5 mb-2">
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>接替新資產規格資料（自動建立並串連履歷）：</span>
              </div>

              <div className="space-y-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      接替新物件代碼 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newAssetCode}
                      onChange={e => setNewAssetCode(e.target.value)}
                      placeholder="如: VEH-889、EQ-PC300"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-mono font-bold text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      新物件顯示名稱 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newAssetName}
                      onChange={e => setNewAssetName(e.target.value)}
                      placeholder={target.type === 'VEHICLE' ? '如: 廠內貨車 [889-CD]' : '如: CAT-320 挖掘機'}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-bold text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {target.type === 'VEHICLE' ? (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        新車車牌號碼
                      </label>
                      <input
                        type="text"
                        value={newLicensePlate}
                        onChange={e => setNewLicensePlate(e.target.value)}
                        placeholder="如: 889-CD"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-mono uppercase font-bold text-xs"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        新購置成本 (NT$)
                      </label>
                      <input
                        type="number"
                        value={newPurchaseCost}
                        onChange={e => setNewPurchaseCost(Number(e.target.value))}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-mono text-xs"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      保管人員 / 司機 / 經辦
                    </label>
                    <input
                      type="text"
                      value={newDriverOrCustodian}
                      onChange={e => setNewDriverOrCustodian(e.target.value)}
                      placeholder="同仁姓名"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

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
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>確認執行汰除除役</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
