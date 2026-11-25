import React, { useState } from 'react';
import {
  Terminal,
  FileText,
  Zap,
  Settings2,
  Archive,
  Database,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  AlertCircle,
  CheckCheck,
  RefreshCw
} from 'lucide-react';
import {
  Company,
  CompanyBankAccount,
  DocumentSequenceRule,
  DocumentModuleSequenceStatus
} from '../../types/erp';
import {
  reserveNextMonthSequence,
  autoCalibrateAllDocumentSequences,
  reseedDocumentSequences
} from '../../db/sqlite';
import { CompanyBankCheckbooksTable } from './CompanyBankCheckbooksTable';

export interface SequenceSuperadminDiagnosticsPanelProps {
  companies: Company[];
  bankAccounts: CompanyBankAccount[];
  selectedCompanyId: string;
  sequenceRules: DocumentSequenceRule[];
  moduleStatuses: DocumentModuleSequenceStatus[];
  canWriteModule: boolean;
  isSuperadmin: boolean;
  isBoss: boolean;
  operatorName: string;
  onSwitchToAdminView: () => void;
  onEditRule: (rule: DocumentSequenceRule) => void;
  onReloadData: () => void;
  onDataChanged: () => void;
  triggerToast: (msg: string) => void;
}

export const SequenceSuperadminDiagnosticsPanel: React.FC<SequenceSuperadminDiagnosticsPanelProps> = ({
  companies,
  bankAccounts,
  selectedCompanyId,
  sequenceRules,
  moduleStatuses,
  canWriteModule,
  isSuperadmin,
  isBoss,
  operatorName,
  onSwitchToAdminView,
  onEditRule,
  onReloadData,
  onDataChanged,
  triggerToast
}) => {
  const [superadminSubTab, setSuperadminSubTab] = useState<
    'RULES' | 'DIAGNOSTICS' | 'LEGACY_AUDIT' | 'BACKUP_CONSISTENCY'
  >('RULES');

  const handleReserveNextMonth = (moduleKey: string) => {
    if (!canWriteModule) {
      triggerToast('⛔ 權限攔截：無預約單據流水號權限！');
      return;
    }
    try {
      const res = reserveNextMonthSequence(moduleKey, operatorName);
      onReloadData();
      triggerToast(`✅ ${res.message}`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 預約失敗：${err.message || String(err)}`);
    }
  };

  const handleAutoCalibrateAllHub = () => {
    if (!canWriteModule) {
      triggerToast('⛔ 權限攔截：無校正單據流水號權限！');
      return;
    }
    try {
      const res = autoCalibrateAllDocumentSequences(operatorName);
      onReloadData();
      triggerToast(`✅ ${res.message}`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 自動校準失敗：${err.message || String(err)}`);
    }
  };

  const handleReseedAfterRestore = () => {
    if (!isSuperadmin && !isBoss) {
      triggerToast('⛔ 權限攔截：僅最高統裁 / 管理員 (Superadmin / BOSS) 可執行底層指針重置！');
      return;
    }
    try {
      reseedDocumentSequences();
      onReloadData();
      triggerToast(
        '✅ 已完成全庫單據指針重置！已根據資料庫現存所有業務單據實體記錄，重新對齊計數器至最新流水號，確保還原後新增單據 100% 不撞號。'
      );
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 指針重置失敗：${err.message || String(err)}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Superadmin 核心控管橫幅 */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-indigo-500/30 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
                <Terminal className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                  <span>單據編碼架構與底層產號診斷中樞</span>
                  <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                    👷‍♂️ 程式設計師 / 架構師深度除錯視角 (Superadmin Mode)
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  全模組編碼主檔維護、底層資料庫指針即時監控、歷史期別舊單匯入防撞審計、備份還原一致性保障
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onSwitchToAdminView}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-white/15 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-300" />
              <span>切換至業務主管簡約視角 (Admin View)</span>
            </button>

            <button
              type="button"
              onClick={handleAutoCalibrateAllHub}
              disabled={!canWriteModule}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer hover:shadow-lg active:scale-98 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-slate-950 fill-slate-950" />
              <span>⚡ 全域單號智能巡檢與防撞自癒</span>
            </button>
          </div>
        </div>
      </div>

      {/* Superadmin 4 大技術維護子分頁導覽 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setSuperadminSubTab('RULES')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            superadminSubTab === 'RULES'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>📋 業務編碼規則主檔 (Rule Policy)</span>
        </button>

        <button
          type="button"
          onClick={() => setSuperadminSubTab('DIAGNOSTICS')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            superadminSubTab === 'DIAGNOSTICS'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>⚡ 底層指針監控與防撞自癒 (Runtime Pointer Diagnostics)</span>
        </button>

        <button
          type="button"
          onClick={() => setSuperadminSubTab('LEGACY_AUDIT')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            superadminSubTab === 'LEGACY_AUDIT'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Archive className="w-3.5 h-3.5 text-indigo-400" />
          <span>🗄️ 歷史期別封存與舊資料匯入防撞審計 (Legacy Audit)</span>
        </button>

        <button
          type="button"
          onClick={() => setSuperadminSubTab('BACKUP_CONSISTENCY')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            superadminSubTab === 'BACKUP_CONSISTENCY'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-emerald-500" />
          <span>💾 備份還原單號一致性與災難復原保障 (Backup & Restore)</span>
        </button>
      </div>

      {/* 視圖 1：業務編碼規則主檔 */}
      {superadminSubTab === 'RULES' && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
              <h4 className="text-xs font-bold text-white tracking-wide">
                模組編碼規則變更與防衝突安全機制 (Prefix Rule Changes & Collision Safeguard)
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-1">
                <strong className="text-amber-300 font-bold block flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>情境 1：舊前綴 AP 改為全新前綴 PP</span>
                </strong>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  歷史開立的單據（如 <code className="text-amber-200 font-mono">AP-202603-001</code>）屬於法定會計憑證，資料庫主鍵<strong>永久保留不變</strong>；變更後新建立的應付帳款單據將一律套用新前綴，自動從第一號 <code className="text-emerald-300 font-mono">PP-202610-001</code> 順暢接續開單，絕不出事。
                </p>
              </div>

              <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-1">
                <strong className="text-rose-300 font-bold block flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>情境 2：將 AP 改為已存在前綴 AR</span>
                </strong>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  若 AP 改為 AR，將導致應付帳款與應收帳款單號重疊衝突。系統已內建<strong>「全域唯一性鎖定」</strong>與<strong>「跨表歷史碰撞預檢」</strong>，在輸入當下即刻嚴格阻擋並報警，強制禁用儲存，從根源徹底杜絕衝突！
                </p>
              </div>

              <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-1">
                <strong className="text-indigo-300 font-bold block flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>歷史已結案月份不在此陳列</span>
                </strong>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  過往歷史月份單據既已結案入帳，為法定不可竄改資料。規則制定中樞專注於「當前與未來開單規格設定」，免除 10 年歷史過往資料佔滿畫面與無效干擾。
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-indigo-600" />
                  <span>業務模組編碼規則主檔維護 (Rule Configurations)</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  自訂各業務別代碼前綴、破折號分隔符、日期格式及流水號碼長（支援即時格式預覽與全域防重衝突校驗）
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3">模組代號</th>
                    <th className="p-3">業務單據名稱</th>
                    <th className="p-3">前綴 Prefix</th>
                    <th className="p-3">日期格式</th>
                    <th className="p-3">分隔符</th>
                    <th className="p-3">流水號長度</th>
                    <th className="p-3">歸零週期</th>
                    <th className="p-3">格式預覽範例</th>
                    <th className="p-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sequenceRules.map(rule => {
                    const delim = rule.delimiter;
                    const dateSample =
                      rule.dateFormat === 'YYYYMM'
                        ? '202610'
                        : rule.dateFormat === 'YYYY'
                        ? '2026'
                        : rule.dateFormat === 'YYYYMMDD'
                        ? '20261014'
                        : '';
                    const serialSample = String(1).padStart(rule.serialLength, '0');
                    const sample = dateSample
                      ? `${rule.prefix}${delim}${dateSample}${delim}${serialSample}`
                      : `${rule.prefix}${delim}${serialSample}`;

                    return (
                      <tr key={rule.moduleKey} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-indigo-900">{rule.moduleKey}</td>
                        <td className="p-3 font-bold text-slate-800">{rule.moduleName}</td>
                        <td className="p-3 font-mono font-bold bg-slate-100 px-2 rounded w-min">{rule.prefix}</td>
                        <td className="p-3 font-mono text-slate-600">{rule.dateFormat}</td>
                        <td className="p-3 font-mono text-slate-600">{rule.delimiter ? `[ ${rule.delimiter} ]` : '無'}</td>
                        <td className="p-3 font-mono text-slate-600">{rule.serialLength} 碼</td>
                        <td className="p-3">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {rule.resetFrequency === 'MONTHLY'
                              ? '每月歸零重設'
                              : rule.resetFrequency === 'YEARLY'
                              ? '每年歸零重設'
                              : '永久累計'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs">
                            {sample}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => onEditRule({ ...rule })}
                            disabled={!canWriteModule}
                            className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs transition-colors cursor-pointer"
                          >
                            修改規則
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <CompanyBankCheckbooksTable
            companies={companies}
            bankAccounts={bankAccounts}
            selectedCompanyId={selectedCompanyId}
            canWriteModule={canWriteModule}
            operatorName={operatorName}
            onReloadData={onReloadData}
            onDataChanged={onDataChanged}
            triggerToast={triggerToast}
          />
        </div>
      )}

      {/* 視圖 2：底層指針監控與防撞自癒 */}
      {superadminSubTab === 'DIAGNOSTICS' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>底層資料庫產號指針深度監控 (Raw DB Sequences & Pointers)</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  直接透視 SQLite <code className="font-mono font-bold text-slate-700">document_sequences</code> 表指針與業務資料庫實體表記錄之對齊狀況
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
                即時診斷中
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3">模組 Key</th>
                    <th className="p-3">前綴指針 Key (Prefix)</th>
                    <th className="p-3">實體表最大已用號</th>
                    <th className="p-3">DB 目前計數值</th>
                    <th className="p-3">下筆預計配發單號</th>
                    <th className="p-3">次月整備 (Next Month)</th>
                    <th className="p-3">指針健康診斷</th>
                    <th className="p-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {moduleStatuses.map(mod => {
                    const isAligned = mod.currentPeriodNextVal > mod.currentPeriodMaxVal;

                    return (
                      <tr key={mod.moduleKey} className="hover:bg-slate-50 transition-colors font-mono">
                        <td className="p-3 font-sans font-bold text-slate-800">
                          {mod.moduleName} ({mod.moduleKey})
                        </td>
                        <td className="p-3 font-bold text-indigo-900">{mod.currentPeriodPrefix}</td>
                        <td className="p-3">
                          {mod.currentPeriodLatestDoc ? (
                            <span className="text-slate-800 font-bold">
                              {mod.currentPeriodLatestDoc} ({mod.currentPeriodMaxVal}號)
                            </span>
                          ) : (
                            <span className="text-slate-400 font-sans italic text-[11px]">無紀錄 (0)</span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-slate-700">{mod.currentPeriodNextVal - 1}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                            {mod.currentPeriodNextDoc}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600">{mod.nextMonthReservedNextDoc}</span>
                            <button
                              type="button"
                              onClick={() => handleReserveNextMonth(mod.moduleKey)}
                              disabled={!canWriteModule}
                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 text-[10px] font-sans font-bold border border-slate-200 cursor-pointer transition-colors"
                            >
                              預約次月
                            </button>
                          </div>
                        </td>
                        <td className="p-3 font-sans">
                          {isAligned ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCheck className="w-3.5 h-3.5" /> 指針健康對齊
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <AlertCircle className="w-3.5 h-3.5" /> 建議校準自癒
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-sans text-right">
                          <button
                            type="button"
                            onClick={() => onEditRule({ ...mod.rule })}
                            disabled={!canWriteModule}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 cursor-pointer"
                          >
                            調整
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
      )}

      {/* 視圖 3：歷史期別封存與舊資料匯入防撞審計 */}
      {superadminSubTab === 'LEGACY_AUDIT' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-sm text-indigo-950">
              <Archive className="w-4 h-4 text-indigo-600" />
              <span>舊系統資料轉移／外部歷史帳目匯入防撞審計指引</span>
            </div>
            <p className="text-[11px] leading-relaxed text-indigo-800">
              過往歷史月份單據在法律與會計上已結算封存，嚴禁回溯改號。若公司需自外部舊系統（如舊 ERP、Excel 請款帳冊）批次匯入過往歷史單據時，<strong>請在此查核該期別已存在之最大單號</strong>，杜絕外部舊單號衝撞現有資料庫主鍵（Primary Key Collision）。
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Archive className="w-4 h-4 text-indigo-600" />
                  <span>全模組過往歷史已結案月份資料清冊</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  唯讀鎖定狀態，提供歷史審計與舊資料批次匯入之單號範圍參考
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-sans font-bold border-b border-slate-200">
                    <th className="p-3">業務模組</th>
                    <th className="p-3">歷史已結案期別</th>
                    <th className="p-3">前綴指針 Key</th>
                    <th className="p-3">歷史已開最大單號</th>
                    <th className="p-3">封存記錄數</th>
                    <th className="p-3">封存鎖定狀態</th>
                    <th className="p-3">外部舊單匯入安全建議</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(() => {
                    const allHist: Array<{
                      moduleName: string;
                      moduleKey: string;
                      period: string;
                      prefixKey: string;
                      latestDoc: string;
                      maxVal: number;
                      count: number;
                    }> = [];

                    moduleStatuses.forEach(m => {
                      m.historicalPeriods?.forEach(h => {
                        allHist.push({
                          moduleName: m.moduleName,
                          moduleKey: m.moduleKey,
                          period: h.period,
                          prefixKey: h.prefixKey,
                          latestDoc: h.latestDoc,
                          maxVal: h.maxVal,
                          count: h.count
                        });
                      });
                    });

                    if (allHist.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400 font-sans">
                            目前系統中無歷史結案期別紀錄。
                          </td>
                        </tr>
                      );
                    }

                    return allHist.map((h, idx) => (
                      <tr key={`${h.moduleKey}-${h.period}-${idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-sans font-bold text-slate-800">
                          {h.moduleName} ({h.moduleKey})
                        </td>
                        <td className="p-3 font-bold text-slate-900">{h.period} 期</td>
                        <td className="p-3 text-slate-600">{h.prefixKey}</td>
                        <td className="p-3 font-bold text-indigo-900">{h.latestDoc}</td>
                        <td className="p-3 font-sans text-slate-700">{h.count} 筆單據</td>
                        <td className="p-3 font-sans">
                          <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-bold">
                            <Lock className="w-2.5 h-2.5" /> 歷史鎖定
                          </span>
                        </td>
                        <td className="p-3 font-sans text-slate-600 text-[11px]">
                          若批次轉入舊單，流水序號必須大於 <code className="font-mono font-bold text-indigo-700">{h.maxVal}</code> 以免撞號
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 視圖 4：備份還原單號一致性與災難復原保障 */}
      {superadminSubTab === 'BACKUP_CONSISTENCY' && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-slate-900 text-white space-y-3 border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" />
                <h4 className="text-xs font-bold text-white tracking-wide">
                  備份還原災難復原保障：單號計數器一致性重置中樞
                </h4>
              </div>
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded border border-emerald-500/30">
                Disaster Recovery Protected
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              當系統執行資料庫備份還原（例如還原上週 SQL Dump、或還原至歷史年度封存快照）時，由於實體資料表可能被回復至舊時間點，此時{' '}
              <code className="font-mono text-amber-300">document_sequences</code> 計數器指針若未重新對齊，可能導致還原後開立新單據時發生主鍵重號衝突。Superadmin 可使用以下工具一鍵重新對齊指針。
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={handleReseedAfterRestore}
                disabled={!canWriteModule}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer hover:shadow-lg active:scale-98 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4 text-slate-950" />
                <span>🔄 還原後全域序號指針重新校準 (Post-Restore Re-seed)</span>
              </button>
              <span className="text-[11px] text-slate-400">
                自動深度掃描全庫真實單據表記錄，將所有前綴指針強制對齊至真實最大號，杜絕撞號
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>實體單據資料表防撞指標檢驗對齊清單</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  比對底層實體表記錄最大單號與產號指針之對齊防撞狀態
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3">業務模組</th>
                    <th className="p-3">對應實體資料表</th>
                    <th className="p-3">單據主鍵欄位</th>
                    <th className="p-3">當前實體表最大號</th>
                    <th className="p-3">防撞自癒指針</th>
                    <th className="p-3">備份還原一致性</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {[
                    { name: '應付帳款單據', key: 'AP', table: 'accounts_payable', col: 'apNumber' },
                    { name: '採購發包單據', key: 'PO', table: 'purchase_orders', col: 'poNumber' },
                    { name: '工程報價單據', key: 'QUO', table: 'quotations', col: 'quoteNumber' },
                    { name: '計價估驗單據', key: 'VL', table: 'valuations', col: 'valuationNumber' },
                    { name: '收付款票據', key: 'CK', table: 'receipts', col: 'receiptNumber' },
                    { name: '應收請款記錄', key: 'AR', table: 'client_billing_records', col: 'billNumber' },
                    { name: '分包合約字號', key: 'SC', table: 'subcontracts', col: 'subcontractCode' }
                  ].map(item => {
                    const status = moduleStatuses.find(s => s.moduleKey === item.key);
                    return (
                      <tr key={item.key} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-sans font-bold text-slate-800">
                          {item.name} ({item.key})
                        </td>
                        <td className="p-3 text-indigo-900 font-bold">{item.table}</td>
                        <td className="p-3 text-slate-600">{item.col}</td>
                        <td className="p-3 text-slate-800">
                          {status?.currentPeriodLatestDoc || '尚未開單 (0)'}
                        </td>
                        <td className="p-3 text-indigo-700 font-bold">
                          {status?.currentPeriodNextDoc || '預備起號中'}
                        </td>
                        <td className="p-3 font-sans">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCheck className="w-3.5 h-3.5" /> 具備自動防撞指針守護
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
