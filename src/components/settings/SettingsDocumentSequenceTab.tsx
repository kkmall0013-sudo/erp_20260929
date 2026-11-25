import React, { useState } from 'react';
import {
  Info,
  FileText,
  Settings2,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import {
  Company,
  CompanyBankAccount,
  DocumentSequenceRule,
  DocumentModuleSequenceStatus
} from '../../types/erp';
import {
  updateDocumentSequenceRule,
  validateDocumentPrefixConflict
} from '../../db/sqlite';
import { CompanyBankCheckbooksTable } from './CompanyBankCheckbooksTable';
import { SequenceSuperadminDiagnosticsPanel } from './SequenceSuperadminDiagnosticsPanel';

export interface SettingsDocumentSequenceTabProps {
  companies: Company[];
  bankAccounts: CompanyBankAccount[];
  selectedCompanyId: string;
  sequenceRules: DocumentSequenceRule[];
  moduleStatuses: DocumentModuleSequenceStatus[];
  canWriteModule: boolean;
  isSuperadmin: boolean;
  isBoss: boolean;
  operatorName: string;
  onReloadData: () => void;
  onDataChanged: () => void;
  triggerToast: (msg: string) => void;
}

export const SettingsDocumentSequenceTab: React.FC<SettingsDocumentSequenceTabProps> = ({
  companies,
  bankAccounts,
  selectedCompanyId,
  sequenceRules,
  moduleStatuses,
  canWriteModule,
  isSuperadmin,
  isBoss,
  operatorName,
  onReloadData,
  onDataChanged,
  triggerToast
}) => {
  const [simulateAdminView, setSimulateAdminView] = useState(false);
  const [editingRule, setEditingRule] = useState<DocumentSequenceRule | null>(null);

  const isSuperadminMode = isSuperadmin && !simulateAdminView;

  const handleSaveRule = (rule: DocumentSequenceRule) => {
    if (!canWriteModule) {
      triggerToast('⛔ 權限攔截：無修改單據編碼規則權限！');
      return;
    }
    try {
      updateDocumentSequenceRule(rule, operatorName);
      setEditingRule(null);
      onReloadData();
      triggerToast(`✅ 已成功儲存【${rule.moduleName}】編碼規則！`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 儲存規則失敗：${err.message || String(err)}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {!isSuperadminMode ? (
        <div className="space-y-6">
          {/* Superadmin 預覽提示條 */}
          {isSuperadmin && simulateAdminView && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  您目前正以<strong>【業務主管簡約視角 (Admin View)】</strong>預覽。此模式為公司主管設計，僅呈現公司編碼政策，已隱藏所有底層除錯指標與計數器。
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSimulateAdminView(false)}
                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-xs shrink-0"
              >
                返回程式設計師深度模式 ➔
              </button>
            </div>
          )}

          {/* 業務主管抬頭橫幅 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>公司單據編碼規範設定 (Document Numbering Policy)</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                    💼 業務主管視角 (Admin)
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  為全公司各營運模組制定單據代碼前綴、日期格式、流水號碼長與分隔符。同仁開單時系統一律在背景自動依此規範循序配號，免人為手動干預。
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-500 font-mono flex items-center gap-2 self-start md:self-auto bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>
                當前開單期別：
                <strong>
                  {new Date().getFullYear()} 年 {String(new Date().getMonth() + 1).padStart(2, '0')} 月
                </strong>
              </span>
            </div>
          </div>

          {/* 各業務模組編碼規範總表 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>各業務模組編碼規範總表 (Document Taxonomy Rules)</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  調整規則將立即套用於後續新開立之單據，過往歷史已開單據依法定會計原則自動永久保留原樣。
                </p>
              </div>
              <span className="text-xs text-slate-600 font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
                共 {sequenceRules.length} 個業務模組
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3.5">業務單據模組</th>
                    <th className="p-3.5">前綴代碼 Prefix</th>
                    <th className="p-3.5">日期格式段</th>
                    <th className="p-3.5">分隔符號</th>
                    <th className="p-3.5">流水號長度</th>
                    <th className="p-3.5">自動重設週期</th>
                    <th className="p-3.5">下筆開單效果預覽</th>
                    <th className="p-3.5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sequenceRules.map(rule => {
                    const status = moduleStatuses.find(s => s.moduleKey === rule.moduleKey);
                    const delim = rule.delimiter;
                    const dateSample =
                      rule.dateFormat === 'YYYYMM'
                        ? '202610'
                        : rule.dateFormat === 'YYYY'
                        ? '2026'
                        : rule.dateFormat === 'YYYYMMDD'
                        ? '20261014'
                        : '';
                    const serialSample = String(status ? status.currentPeriodNextVal : 1).padStart(
                      rule.serialLength,
                      '0'
                    );
                    const previewDoc = status
                      ? status.currentPeriodNextDoc
                      : dateSample
                      ? `${rule.prefix}${delim}${dateSample}${delim}${serialSample}`
                      : `${rule.prefix}${delim}${serialSample}`;

                    return (
                      <tr key={rule.moduleKey} className="hover:bg-slate-50/90 transition-colors">
                        <td className="p-3.5 align-middle">
                          <div className="font-bold text-slate-900">{rule.moduleName}</div>
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {rule.description || '營造業務單據標準規範'}
                          </div>
                        </td>
                        <td className="p-3.5 align-middle">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-900 text-amber-300 border border-slate-800">
                            {rule.prefix}
                          </span>
                        </td>
                        <td className="p-3.5 align-middle font-mono text-slate-700">
                          {rule.dateFormat === 'NONE' ? '無日期段 (純流水號)' : rule.dateFormat}
                        </td>
                        <td className="p-3.5 align-middle font-mono text-slate-700">
                          {rule.delimiter ? `[ ${rule.delimiter} ]` : '無'}
                        </td>
                        <td className="p-3.5 align-middle font-mono text-slate-700">
                          {rule.serialLength} 碼
                        </td>
                        <td className="p-3.5 align-middle text-slate-700">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {rule.resetFrequency === 'MONTHLY'
                              ? '每月歸零重設'
                              : rule.resetFrequency === 'YEARLY'
                              ? '每年歸零重設'
                              : '永久累計'}
                          </span>
                        </td>
                        <td className="p-3.5 align-middle font-mono">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-xs shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>{previewDoc}</span>
                          </span>
                        </td>
                        <td className="p-3.5 align-middle text-right">
                          <button
                            type="button"
                            onClick={() => setEditingRule({ ...rule })}
                            disabled={!canWriteModule}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs transition-colors cursor-pointer border border-indigo-200 shadow-2xs"
                          >
                            修改規範
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
      ) : (
        <SequenceSuperadminDiagnosticsPanel
          companies={companies}
          bankAccounts={bankAccounts}
          selectedCompanyId={selectedCompanyId}
          sequenceRules={sequenceRules}
          moduleStatuses={moduleStatuses}
          canWriteModule={canWriteModule}
          isSuperadmin={isSuperadmin}
          isBoss={isBoss}
          operatorName={operatorName}
          onSwitchToAdminView={() => setSimulateAdminView(true)}
          onEditRule={(r) => setEditingRule(r)}
          onReloadData={onReloadData}
          onDataChanged={onDataChanged}
          triggerToast={triggerToast}
        />
      )}

      {/* 共用單據編碼規則編輯彈窗 */}
      {editingRule && (() => {
        const originalRule = sequenceRules.find(r => r.moduleKey === editingRule.moduleKey);
        const isPrefixChanged = originalRule && originalRule.prefix !== editingRule.prefix;
        const conflictCheck = validateDocumentPrefixConflict(editingRule.moduleKey, editingRule.prefix);

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
              <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-sm">自訂單據編碼規則 - 【{editingRule.moduleName}】</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!conflictCheck.valid) {
                    triggerToast(`⛔ ${conflictCheck.reason}`);
                    return;
                  }
                  handleSaveRule(editingRule);
                }}
                className="p-6 space-y-4 text-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">業務前綴代碼 (Prefix):</label>
                    <span className="text-[11px] text-slate-400">僅限大寫英數字，1~8 碼</span>
                  </div>
                  <input
                    type="text"
                    value={editingRule.prefix}
                    onChange={(e) =>
                      setEditingRule(prev => (prev ? { ...prev, prefix: e.target.value.toUpperCase() } : null))
                    }
                    className={`w-full px-3 py-2 rounded-lg border font-mono font-bold uppercase text-slate-800 outline-none transition-all ${
                      !conflictCheck.valid
                        ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/30'
                        : 'border-slate-300 focus:ring-2 focus:ring-indigo-500'
                    }`}
                  />

                  {!conflictCheck.valid && (
                    <div className="mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <strong>衝突阻擋：</strong>
                        {conflictCheck.reason}
                      </div>
                    </div>
                  )}

                  {isPrefixChanged && conflictCheck.valid && (
                    <div className="mt-2 p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <strong>前綴變更生效須知：</strong>歷史已開立的單據（<code className="font-mono font-bold">{originalRule.prefix}-...</code>）將依法保留法定會計憑證；自變更起新建立的單據將自動套用新前綴【<strong>{editingRule.prefix}</strong>】並自第 1 號開始發放。
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">日期格式段:</label>
                    <select
                      value={editingRule.dateFormat}
                      onChange={(e) =>
                        setEditingRule(prev => (prev ? { ...prev, dateFormat: e.target.value as any } : null))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="YYYYMM">YYYYMM (西元年月份，如 202610)</option>
                      <option value="YYYY">YYYY (西元年份，如 2026)</option>
                      <option value="YYYYMMDD">YYYYMMDD (年月日，如 20261014)</option>
                      <option value="NONE">無日期段 (純前綴)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">分隔符號 (Delimiter):</label>
                    <select
                      value={editingRule.delimiter}
                      onChange={(e) =>
                        setEditingRule(prev => (prev ? { ...prev, delimiter: e.target.value as any } : null))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="-">破折號 [ - ] (如 AP-202610-001)</option>
                      <option value="">無分隔符 (如 AP202610001)</option>
                      <option value="_">底線 [ _ ] (如 AP_202610_001)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">流水號碼長 (Serial Digits):</label>
                    <select
                      value={editingRule.serialLength}
                      onChange={(e) =>
                        setEditingRule(prev => (prev ? { ...prev, serialLength: parseInt(e.target.value, 10) } : null))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                      <option value={2}>2 碼 (如 01 ~ 99)</option>
                      <option value={3}>3 碼 (如 001 ~ 999 - 推薦)</option>
                      <option value={4}>4 碼 (如 0001 ~ 9999)</option>
                      <option value={6}>6 碼 (如 000001 ~ 999999)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">自動歸零重設週期:</label>
                    <select
                      value={editingRule.resetFrequency}
                      onChange={(e) =>
                        setEditingRule(prev => (prev ? { ...prev, resetFrequency: e.target.value as any } : null))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="MONTHLY">每月歸零重設 (依月份從 001 開始)</option>
                      <option value="YEARLY">每年歸零重設 (跨年從 001 開始)</option>
                      <option value="NEVER">永久不重設 (連續累計)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">單據用途說明:</label>
                  <input
                    type="text"
                    value={editingRule.description || ''}
                    onChange={(e) =>
                      setEditingRule(prev => (prev ? { ...prev, description: e.target.value } : null))
                    }
                    placeholder="例如: 營造建案工程採購確認單"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-1.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block flex items-center justify-between">
                    <span>即時格式預覽效果 (Live Preview):</span>
                    <span className="text-emerald-400 font-mono">系統下筆將以此格式產號</span>
                  </span>
                  <div className="font-mono text-base font-bold text-amber-300 tracking-wider">
                    {(() => {
                      const delim = editingRule.delimiter;
                      const dateSample =
                        editingRule.dateFormat === 'YYYYMM'
                          ? '202610'
                          : editingRule.dateFormat === 'YYYY'
                          ? '2026'
                          : editingRule.dateFormat === 'YYYYMMDD'
                          ? '20261014'
                          : '';
                      const serialSample = String(1).padStart(editingRule.serialLength, '0');
                      return dateSample
                        ? `${editingRule.prefix}${delim}${dateSample}${delim}${serialSample}`
                        : `${editingRule.prefix}${delim}${serialSample}`;
                    })()}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingRule(null)}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={!conflictCheck.valid}
                    className={`px-4 py-2 rounded-lg font-bold shadow-xs transition-colors cursor-pointer ${
                      !conflictCheck.valid
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    儲存規則
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
