import React, { useState } from 'react';
import {
  DollarSign,
  Sliders,
  Save,
  Lock,
  Clock,
  Plus,
  Sparkles,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { SystemConfig, RegulatorySchedule } from '../../types/erp';
import { createRegulatorySchedule, cancelRegulatorySchedule } from '../../db/sqlite';

export interface SettingsTaxRegulationsTabProps {
  taxConfigs: SystemConfig[];
  editingConfigs: Record<string, string>;
  setEditingConfigs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  schedules: RegulatorySchedule[];
  canWriteModule: boolean;
  operatorName: string;
  onSaveConfig: (cfg: SystemConfig, overrideVal?: string) => void;
  onReloadData: () => void;
  onDataChanged: () => void;
  triggerToast: (msg: string) => void;
}

const LABEL_MAP: Record<string, string> = {
  MINIMUM_WAGE: '法定最低月薪基本工資',
  TAX_RATE: '法定營業稅率',
  NHI_RATE: '二代健保補充保費法定扣繳費率',
  FIN_TAX_TOLERANCE: '發票稅額尾差容許值',
  DEFAULT_RETENTION_RATE: '工程估驗預設保留款率',
  PAYMENT_TERM_DAYS: '預設請款票期天數'
};

export const SettingsTaxRegulationsTab: React.FC<SettingsTaxRegulationsTabProps> = ({
  taxConfigs,
  editingConfigs,
  setEditingConfigs,
  schedules,
  canWriteModule,
  operatorName,
  onSaveConfig,
  onReloadData,
  onDataChanged,
  triggerToast
}) => {
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [schedKey, setSchedKey] = useState('MINIMUM_WAGE');
  const [schedVal, setSchedVal] = useState('29500');
  const [schedDate, setSchedDate] = useState('2027-01-01');
  const [schedNotes, setSchedNotes] = useState('2027/01/01 法定最低基本工資調整');

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWriteModule) {
      triggerToast('⛔ 權限攔截：無維護法規排程權限！');
      return;
    }
    if (!schedVal.trim() || !schedDate.trim()) {
      triggerToast('請填寫預定數值與生效實施時間！');
      return;
    }

    try {
      createRegulatorySchedule({
        configKey: schedKey,
        configLabel: LABEL_MAP[schedKey] || schedKey,
        scheduledValue: schedVal.trim(),
        effectiveDate: schedDate.includes(':') ? schedDate : `${schedDate} 00:00:00`,
        notes: schedNotes.trim() || undefined,
        operatorName
      });
      setIsAddingSchedule(false);
      onReloadData();
      triggerToast(
        `✅ 已成功登記【${LABEL_MAP[schedKey] || schedKey}】預定生效排程（生效日：${schedDate}）！系統到期將自動無痛切換。`
      );
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 登記排程失敗：${err.message || String(err)}`);
    }
  };

  const handleCancelSchedule = (id: string) => {
    if (!canWriteModule) {
      triggerToast('⛔ 權限攔截：無修改排程權限！');
      return;
    }
    try {
      cancelRegulatorySchedule(id, operatorName);
      onReloadData();
      triggerToast('已成功取消該項預約法規排程！');
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 取消失敗：${err.message || String(err)}`);
    }
  };

  return (
    <div className="p-6 space-y-8">
      {/* 說明橫幅 */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3">
        <DollarSign className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xs font-bold text-sky-900">法定營業稅率、健保費率與法定基本薪資規範</h3>
          <p className="text-xs text-sky-700 mt-1">
            法定稅率、二代健保扣繳率與法定最低工資均受政府法令約束。下方提供「現行有效設定」與「未來預約排程生效中心」。若接獲政府公布新法規（如已公布之 2027/01/01 最低基本工資調升），可事先登記生效時間，當天凌晨系統自動無縫換裝，管理者無須熬夜手動修改。
          </p>
        </div>
      </div>

      {/* 現行生效設定列表 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>目前正在生效之營運法規參數</span>
          </h4>
          <span className="text-[11px] text-slate-400">即時同步於全系統合約、計價與薪資計算</span>
        </div>

        <div className="bg-slate-50/50 rounded-xl border border-slate-200 divide-y divide-slate-200">
          {taxConfigs.map(cfg => (
            <div key={cfg.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {cfg.description || cfg.configKey}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {cfg.configKey}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    型別: {cfg.valueType} (v{cfg.version})
                  </span>
                  {cfg.configKey === 'MINIMUM_WAGE' && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                      勞基法最低工資
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-3">
                  <span>生效起日: {cfg.validFrom}</span>
                  {cfg.updatedBy && <span>最後維護者: {cfg.updatedBy}</span>}
                  {cfg.updatedAt && <span>更新時間: {cfg.updatedAt}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    value={editingConfigs[cfg.id] ?? cfg.configValue}
                    onChange={(e) => setEditingConfigs(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white w-44 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  {cfg.configKey === 'MINIMUM_WAGE' && (
                    <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-bold">元/月</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onSaveConfig(cfg)}
                  disabled={!canWriteModule}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    canWriteModule
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {canWriteModule ? <Save className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>儲存</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 法規預約生效排程中樞 */}
      <div className="border border-indigo-200 bg-indigo-50/30 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>⏰ 法規與稅率預約生效排程中心 (Zero-Touch Scheduled Regulations)</span>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                自動切換 · 免熬夜
              </span>
            </h4>
            <p className="text-xs text-indigo-700 mt-1">
              接獲政府未來法規公告時在此預先輸入實施時間戳記。系統時間一到自動置換為預定新設定，並自動寫入不可竄改稽核記錄。
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddingSchedule(!isAddingSchedule)}
            disabled={!canWriteModule}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAddingSchedule ? '收合表單' : '新增法規預定排程'}</span>
          </button>
        </div>

        {isAddingSchedule && (
          <form onSubmit={handleCreateSchedule} className="bg-white p-4 rounded-xl border border-indigo-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 border-b border-indigo-100 pb-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>預排未來新法規生效項目</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">法規參數項目</label>
                <select
                  value={schedKey}
                  onChange={(e) => {
                    setSchedKey(e.target.value);
                    if (e.target.value === 'MINIMUM_WAGE') setSchedVal('29500');
                    if (e.target.value === 'TAX_RATE') setSchedVal('0.05');
                    if (e.target.value === 'NHI_RATE') setSchedVal('0.0211');
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="MINIMUM_WAGE">法定最低月薪基本工資 (元)</option>
                  <option value="TAX_RATE">法定營業稅率 (%)</option>
                  <option value="NHI_RATE">二代健保補充保費率 (%)</option>
                  <option value="DEFAULT_RETENTION_RATE">工程估驗預設保留款率 (%)</option>
                  <option value="PAYMENT_TERM_DAYS">預設請款票期 (天)</option>
                  <option value="FIN_TAX_TOLERANCE">發票稅額尾差容許值 (元)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">預定新設定數值</label>
                <input
                  type="text"
                  value={schedVal}
                  onChange={(e) => setSchedVal(e.target.value)}
                  placeholder="例如: 29500 或 0.05"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">預定生效實施時間 (YYYY-MM-DD)</label>
                <input
                  type="text"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  placeholder="例如: 2027-01-01"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">備註 / 法規公告依據</label>
                <input
                  type="text"
                  value={schedNotes}
                  onChange={(e) => setSchedNotes(e.target.value)}
                  placeholder="例如: 勞動部公告 2027 基本工資調升"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingSchedule(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>儲存排程</span>
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden shadow-2xs">
          {schedules.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              目前尚未建立預約生效之法規排程。點擊上方「新增法規預定排程」即可預先安排新法規實施。
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-indigo-100/50 text-indigo-950 font-bold border-b border-indigo-200">
                <tr>
                  <th className="py-2.5 px-4">法規項目</th>
                  <th className="py-2.5 px-4">預定設定值</th>
                  <th className="py-2.5 px-4">預定生效時間</th>
                  <th className="py-2.5 px-4">排程狀態</th>
                  <th className="py-2.5 px-4">備註說明</th>
                  <th className="py-2.5 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map(sc => (
                  <tr key={sc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-slate-900">
                      <div>{sc.configLabel}</div>
                      <div className="font-mono text-[10px] text-slate-400">{sc.configKey}</div>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">
                      {sc.scheduledValue}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700 flex items-center gap-1.5 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{sc.effectiveDate}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      {sc.status === 'SCHEDULED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          <span>排程等待中</span>
                        </span>
                      )}
                      {sc.status === 'APPLIED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>已自動生效 ({sc.appliedAt?.slice(0, 10)})</span>
                        </span>
                      )}
                      {sc.status === 'CANCELLED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                          <span>已取消</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 text-[11px]">
                      {sc.notes || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {sc.status === 'SCHEDULED' && canWriteModule && (
                        <button
                          type="button"
                          onClick={() => handleCancelSchedule(sc.id)}
                          className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        >
                          取消排程
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
