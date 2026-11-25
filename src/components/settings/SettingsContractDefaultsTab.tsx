import React from 'react';
import {
  ShieldCheck,
  Save,
  Lock,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { SystemConfig } from '../../types/erp';

export interface SettingsContractDefaultsTabProps {
  contractConfigs: SystemConfig[];
  editingConfigs: Record<string, string>;
  setEditingConfigs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  canWriteModule: boolean;
  isSuperadmin: boolean;
  onSaveConfig: (cfg: SystemConfig, overrideVal?: string) => void;
  onGoToCompaniesTab: () => void;
  triggerToast: (msg: string) => void;
}

export const SettingsContractDefaultsTab: React.FC<SettingsContractDefaultsTabProps> = ({
  contractConfigs,
  editingConfigs,
  setEditingConfigs,
  canWriteModule,
  isSuperadmin,
  onSaveConfig,
  onGoToCompaniesTab,
  triggerToast
}) => {
  const handleTogglePaymentTerms = (cfg: SystemConfig, turnOff: boolean) => {
    if (!canWriteModule) {
      triggerToast('⛔ 權限攔截：無修改系統參數權限！');
      return;
    }
    const newVal = turnOff ? '0' : '30';
    setEditingConfigs(prev => ({ ...prev, [cfg.id]: newVal }));
    onSaveConfig(cfg, newVal);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xs font-bold text-emerald-900">工程合約慣例與預算內控模式</h3>
          <p className="text-xs text-emerald-700 mt-1">
            控制營造合約預設保留款比例、工程保固月數、案場超支鎖定，以及請款票期。工程實務中若無票期慣例，可在此一鍵關閉票期（無票期 · 即期付款）。
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {contractConfigs.map(cfg => {
          const isPaymentTerm = cfg.configKey === 'PAYMENT_TERM_DAYS';
          const isLockMode = cfg.configKey === 'PROJECT_LOCK_MODE';
          const isScheduleDays = cfg.configKey === 'PAYMENT_SCHEDULE_DAYS';
          const isBossPolicy = cfg.configKey === 'BOSS_ACCOUNT_INVOICE_POLICY';
          const currentVal = editingConfigs[cfg.id] ?? cfg.configValue;
          const isTermDisabled = currentVal === '0' || currentVal === 'DISABLED';

          if (isScheduleDays) {
            const parsedDays = Array.from(
              new Set(
                String(currentVal || '')
                  .split(/[,，、\s]+/)
                  .map(s => Number(s.trim()))
                  .filter(n => Number.isInteger(n) && n >= 1 && n <= 31)
              )
            ).sort((a, b) => a - b);

            return (
              <div key={cfg.id} className="py-5 first:pt-0 last:pb-0 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {cfg.description || '每月固定匯款與開票排程日'}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {cfg.configKey}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      設定全域每個月固定放款／開票日（逗號分隔 1~31，如{' '}
                      <code className="font-mono font-bold text-slate-700">7,17,27</code>）。因為不同公司可能使用不同結帳與開票習慣，套用優先序為：<strong>銀行專戶設定</strong> &gt; <strong>各公司法人設定</strong> &gt; <strong>系統全域預設</strong>。
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-400">預覽排程日：</span>
                      {parsedDays.length > 0 ? (
                        parsedDays.map(d => (
                          <span
                            key={d}
                            className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200"
                          >
                            每月 {d} 日
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-rose-600 font-bold">⚠️ 請輸入 1~31 數字</span>
                      )}
                      <button
                        type="button"
                        onClick={onGoToCompaniesTab}
                        className="ml-2 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-0.5 rounded transition-colors cursor-pointer"
                      >
                        前往「營運法人實體」依各公司別單獨設定 →
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-start lg:items-end gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={currentVal}
                        onChange={(e) => setEditingConfigs(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                        placeholder="7,17,27"
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white w-44 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => onSaveConfig(cfg)}
                        disabled={!canWriteModule || parsedDays.length === 0}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>儲存</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {['7,17,27', '5,15,25', '10,20,30', '10,25'].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          disabled={!canWriteModule}
                          onClick={() => setEditingConfigs(prev => ({ ...prev, [cfg.id]: preset }))}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                            currentVal === preset
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (isBossPolicy) {
            const isPolicyAllow = currentVal === 'ALLOW_BOSS_ADVANCE';
            return (
              <div key={cfg.id} className="py-5 first:pt-0 last:pb-0 space-y-3">
                <div className="flex flex-col gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {cfg.description || '有發票單據之老闆私帳代墊政策'}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        {cfg.configKey}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-300">
                        僅限 Superadmin 可切換
                      </span>
                    </div>
                    {!isSuperadmin && (
                      <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        <span>唯讀檢視（須 Superadmin 權限調整）</span>
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    「無發票／免用發票（小包內帳）」無論切換哪一項，皆可選用老闆私帳付款且成本留於案場。此開關決定<strong>【已開立合法統一發票之應付單據】</strong>是否開放特例由老闆私帳代墊：
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={!isSuperadmin}
                      onClick={() => {
                        setEditingConfigs(prev => ({ ...prev, [cfg.id]: 'STRICT_INVOICE_MATCH' }));
                        onSaveConfig(cfg, 'STRICT_INVOICE_MATCH');
                      }}
                      className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer disabled:cursor-not-allowed ${
                        !isPolicyAllow
                          ? 'bg-indigo-50 border-indigo-600 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          做法 1：嚴格發票對應模式（預設建議）
                        </span>
                        {!isPolicyAllow && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-600 text-white">
                            使用中
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                        有發票時僅顯示該發票買受人公司的銀行帳戶與現金支付，完全隱藏老闆私帳，介面最簡潔、避免使用者誤選私帳導致稅務帳不符。
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={!isSuperadmin}
                      onClick={() => {
                        setEditingConfigs(prev => ({ ...prev, [cfg.id]: 'ALLOW_BOSS_ADVANCE' }));
                        onSaveConfig(cfg, 'ALLOW_BOSS_ADVANCE');
                      }}
                      className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer disabled:cursor-not-allowed ${
                        isPolicyAllow
                          ? 'bg-amber-50 border-amber-600 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          做法 2：嚴格為主 + 開放特例私帳代墊
                        </span>
                        {isPolicyAllow && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-600 text-white">
                            使用中
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                        有發票時預設僅顯示公司帳戶，但額外顯示「特例：由老闆私帳代墊（股東往來）」勾選框，勾選後可選老闆私帳並明確標記代墊註記。
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={cfg.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {cfg.description || cfg.configKey}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {cfg.configKey}
                  </span>
                  {isPaymentTerm && isTermDisabled && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                      ✓ 票期已關閉（無票期 · 即期付款）
                    </span>
                  )}
                  {isPaymentTerm && !isTermDisabled && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                      ✓ 票期已啟用（{currentVal} 天）
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-3">
                  <span>生效起日: {cfg.validFrom}</span>
                  {cfg.updatedBy && <span>最後維護者: {cfg.updatedBy}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isPaymentTerm ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTogglePaymentTerms(cfg, !isTermDisabled)}
                      disabled={!canWriteModule}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                        isTermDisabled
                          ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                          : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {isTermDisabled ? <ToggleLeft className="w-4 h-4 text-amber-600" /> : <ToggleRight className="w-4 h-4 text-emerald-600" />}
                      <span>{isTermDisabled ? '切換為啟用票期' : '一鍵關閉請款票期 (即期)'}</span>
                    </button>

                    {!isTermDisabled && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          value={currentVal}
                          onChange={(e) => setEditingConfigs(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white w-24 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <span className="text-xs text-slate-500 font-bold">天</span>
                        <button
                          type="button"
                          onClick={() => onSaveConfig(cfg)}
                          disabled={!canWriteModule}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
                        >
                          儲存
                        </button>
                      </div>
                    )}
                  </div>
                ) : isLockMode ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={currentVal}
                      onChange={(e) => setEditingConfigs(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white w-44 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="STRICT">STRICT (嚴格阻擋過帳)</option>
                      <option value="WARN">WARN (黃色警示但放行)</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => onSaveConfig(cfg)}
                      disabled={!canWriteModule}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={currentVal}
                      onChange={(e) => setEditingConfigs(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white w-32 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => onSaveConfig(cfg)}
                      disabled={!canWriteModule}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>儲存</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
