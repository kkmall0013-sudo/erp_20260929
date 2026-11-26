import React from 'react';
import { Database } from 'lucide-react';
import { User } from '../../../types/erp';
import { SearchPermissionContext } from '../../../utils/universalSearchEngine';

interface SandboxTopControlsCardProps {
  includeMemoryBait: boolean;
  onToggleMemoryBait: (val: boolean) => void;
  onApplyPreset: (preset: 'TAIPEI_VENDOR' | 'INBOUND_CONCRETE' | 'HIGH_SEC_BAIT') => void;
  quickSwitchUsers: User[];
  currentUser: User | null;
  permCtx: SearchPermissionContext;
  onSwitchUser: (userId: string) => void;
}

export const SandboxTopControlsCard: React.FC<SandboxTopControlsCardProps> = ({
  includeMemoryBait,
  onToggleMemoryBait,
  onApplyPreset,
  quickSwitchUsers,
  currentUser,
  permCtx,
  onSwitchUser
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              通用搜尋與權限隔離獨立測試區
            </h3>
            <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              受系統中樞開關管控 · 唯讀不寫入資料庫
            </span>
          </div>
          <p className="text-xs text-slate-500">
            當 Superadmin 於「系統中樞 → 軟體程式設定 → 全系統開放模組授權」開啟測試模組時，所有啟用帳號皆可進入停留驗證；關閉時僅 Superadmin 本人可見。所有查詢與欄位比對皆嚴格依當前帳號之真實 PBAC 與私帳／401 權限執行。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeMemoryBait}
              onChange={e => onToggleMemoryBait(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span>混入純記憶體測試誘餌</span>
          </label>

          <button
            type="button"
            onClick={() => onApplyPreset('TAIPEI_VENDOR')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap cursor-pointer"
          >
            範例：台北廠商
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset('INBOUND_CONCRETE')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap cursor-pointer"
          >
            範例：進貨材料
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset('HIGH_SEC_BAIT')}
            className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-medium text-amber-900 whitespace-nowrap cursor-pointer"
          >
            實測：私帳權限防洩
          </button>
        </div>
      </div>

      {/* 快速切換帳號（停留於測試區內即時驗證不同角色權限） */}
      <div className="pt-3 border-t border-slate-100 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-600 mr-1 whitespace-nowrap">
            切換測試帳號：
          </span>
          {quickSwitchUsers.map(u => {
            const isActive = currentUser?.id === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => onSwitchUser(u.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {u.fullName}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
          <span>
            當前身分：<strong className="text-slate-900">{currentUser?.fullName || '未登入'}</strong>
          </span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>{currentUser?.title || currentUser?.role}</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>
            授權法人：
            <strong className="font-mono tabular-nums text-slate-900">
              {permCtx.allowedCompanyIds === 'ALL'
                ? '全集團不限'
                : permCtx.allowedCompanyIds.join(', ') || '無'}
            </strong>
          </span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className={permCtx.canSeeBossPrivate ? 'text-emerald-700 font-medium' : 'text-rose-700 font-medium'}>
            老闆私帳：{permCtx.canSeeBossPrivate ? '開放存取' : '嚴格隔離'}
          </span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className={permCtx.canSee401TaxData ? 'text-emerald-700 font-medium' : 'text-rose-700 font-medium'}>
            401 稅務發票：
            {permCtx.canSeeFull401SelfRetained
              ? '完整開放（含自主留存）'
              : permCtx.canSee401TaxData
              ? '僅一般發票（隔離自主留存）'
              : '禁止搜尋'}
          </span>
        </div>
      </div>
    </div>
  );
};
