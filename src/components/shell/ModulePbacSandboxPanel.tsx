import React, { useState } from 'react';
import { Lock, Plus, Printer, Send } from 'lucide-react';
import { ModuleKey } from '../../types/erp';
import { LeftNavId } from '../LeftSubWindow';
import { useAuth } from '../../context/AuthContext';
import {
  getAllBankChecks,
  getAllPurchaseOrders,
  getAllQuotations,
  getAllValuations,
  recordAuditLog
} from '../../db/sqlite';

interface ModulePbacSandboxPanelProps {
  activeNavId: LeftNavId;
  pageTitle: string;
  currentModuleKey: ModuleKey;
  canWriteModule: boolean;
  canApproveModule: boolean;
  canExportModule: boolean;
  onNotify: (msg: string) => void;
}

export const ModulePbacSandboxPanel: React.FC<ModulePbacSandboxPanelProps> = ({
  activeNavId,
  pageTitle,
  currentModuleKey,
  canWriteModule,
  canApproveModule,
  canExportModule,
  onNotify
}) => {
  const { currentUser, currentGroup, approvalLimit, checkApproval } = useAuth();
  const [testAmount, setTestAmount] = useState<number>(400000);

  return (
    <div className="space-y-4">
      {/* 頂部權限實測控制台 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {currentModuleKey}
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                【{pageTitle}】PBAC 權限即時驗證工作台
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              目前登入：<strong className="text-slate-800">{currentUser?.fullName}</strong>（群組：<strong className="text-indigo-700">{currentGroup?.groupName || currentUser?.role}</strong>）── 可直接點擊下方按鈕實測本模組之「新增寫入、金額簽核、報表匯出」攔截與放行效果。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              ✓ 讀取 (r:1)
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${canWriteModule ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
              {canWriteModule ? '✓ 寫入 (w:1)' : '🔒 禁寫入 (w:0)'}
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${canApproveModule ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
              {canApproveModule
                ? `✓ 簽核 (a:1 / 上限: ${approvalLimit === Infinity ? '無限額' : `NT$ ${approvalLimit.toLocaleString()}`})`
                : '🔒 禁簽核 (a:0)'}
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${canExportModule ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
              {canExportModule ? '✓ 匯出 (e:1)' : '🔒 禁匯出 (e:0)'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              if (!canWriteModule) {
                onNotify(`⛔ 寫入攔截：${currentUser?.fullName} (${currentGroup?.groupName || currentUser?.role}) 於【${pageTitle}】無寫入權限 (w:0)！`);
                return;
              }
              recordAuditLog(
                currentUser?.fullName || '系統操作員',
                '新增單據',
                pageTitle,
                `${currentModuleKey}-TEST`,
                { '操作模組': pageTitle, '執行結果': '寫入權限檢核通過' }
              );
              onNotify(`✅ 寫入放行：已成功執行【${pageTitle}】單據新增/儲存，並記錄至中文稽核日誌！`);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              canWriteModule
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
            }`}
          >
            {canWriteModule ? <Plus className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>測試「新增 / 寫入單據」</span>
          </button>

          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <select
              value={testAmount}
              onChange={e => setTestAmount(Number(e.target.value))}
              className="bg-transparent text-xs font-mono font-bold text-slate-700 px-2.5 py-1.5 outline-none cursor-pointer"
            >
              <option value={100000}>測試簽核額：10 萬</option>
              <option value={400000}>測試簽核額：40 萬 (工務50萬內)</option>
              <option value={800000}>測試簽核額：80 萬 (逾工務50萬上限)</option>
              <option value={1800000}>測試簽核額：180 萬 (採購200萬內)</option>
              <option value={3500000}>測試簽核額：350 萬 (財務500萬內)</option>
              <option value={8000000}>測試簽核額：800 萬 (僅總經理無限額)</option>
            </select>
            <button
              onClick={() => {
                const res = checkApproval(testAmount, currentModuleKey);
                if (!res.allowed) {
                  onNotify(`⛔ 簽核攔截：${res.reason}`);
                  return;
                }
                recordAuditLog(
                  currentUser?.fullName || '系統操作員',
                  '核准單據',
                  pageTitle,
                  `${currentModuleKey}-APP`,
                  { '簽核單據金額': `NT$ ${testAmount.toLocaleString()}`, '簽核結果': '核准通過' }
                );
                onNotify(`✅ 簽核放行：${currentUser?.fullName} 已成功核准 NT$ ${testAmount.toLocaleString()} 之【${pageTitle}】單據！`);
              }}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                canApproveModule
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              {canApproveModule ? <Send className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>測試「呈核簽批」</span>
            </button>
          </div>

          <button
            onClick={() => {
              if (!canExportModule) {
                onNotify(`⛔ 匯出攔截：${currentUser?.fullName} (${currentGroup?.groupName || currentUser?.role}) 於【${pageTitle}】無匯出/列印權限 (e:0)！`);
                return;
              }
              recordAuditLog(
                currentUser?.fullName || '系統操作員',
                '匯出報表',
                pageTitle,
                `${currentModuleKey}-EXP`,
                { '匯出模組': pageTitle, '檔案格式': 'Excel / PDF' }
              );
              onNotify(`🖨️ 匯出放行：已成功匯出【${pageTitle}】Excel / PDF 報表！`);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              canExportModule
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
            }`}
          >
            {canExportModule ? <Printer className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>測試「匯出 / 列印報表」</span>
          </button>
        </div>
      </div>

      {/* 底層 SQLite 實機資料表預覽 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h4 className="text-xs font-bold text-slate-800 mb-3">
          SQLite 資料庫【{pageTitle}】即時載入紀錄（通過讀取權限 r:1 始可檢視）
        </h4>
        {activeNavId === 'QUOTATIONS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">報價單號</th>
                  <th className="p-2.5">版次</th>
                  <th className="p-2.5 text-right">總價 (含稅)</th>
                  <th className="p-2.5 text-center">業主名稱</th>
                  <th className="p-2.5 text-center">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {getAllQuotations().map(q => (
                  <tr key={q.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold">{q.quoteNumber}</td>
                    <td className="p-2.5 font-mono">{q.currentRevision}</td>
                    <td className="p-2.5 font-mono text-right font-bold">NT$ {q.totalAmount.toLocaleString()}</td>
                    <td className="p-2.5 text-center font-bold text-slate-700">{q.customerName}</td>
                    <td className="p-2.5 text-center">{q.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeNavId === 'PROCUREMENT' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">採購單號</th>
                  <th className="p-2.5">供應商名稱</th>
                  <th className="p-2.5 text-right">採購總額</th>
                  <th className="p-2.5 text-right">保留款扣減</th>
                  <th className="p-2.5 text-center">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {getAllPurchaseOrders().map(po => (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold">{po.poNumber}</td>
                    <td className="p-2.5 font-bold text-slate-800">{po.counterpartyNameSnapshot}</td>
                    <td className="p-2.5 font-mono text-right font-bold">NT$ {po.totalAmount.toLocaleString()}</td>
                    <td className="p-2.5 font-mono text-right text-rose-700">NT$ {po.retentionDeductionAmount.toLocaleString()}</td>
                    <td className="p-2.5 text-center">{po.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeNavId === 'VALUATIONS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">估驗單號</th>
                  <th className="p-2.5">期別</th>
                  <th className="p-2.5 text-right">本期估驗總額</th>
                  <th className="p-2.5 text-right">實付淨額</th>
                  <th className="p-2.5 text-center">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {getAllValuations().map(v => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold">{v.valuationNumber}</td>
                    <td className="p-2.5">{v.periodName}</td>
                    <td className="p-2.5 font-mono text-right">NT$ {v.grossAmount.toLocaleString()}</td>
                    <td className="p-2.5 font-mono text-right font-bold text-indigo-700">NT$ {v.netPayableAmount.toLocaleString()}</td>
                    <td className="p-2.5 text-center">{v.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(activeNavId === 'FINANCE' || activeNavId === 'COMMAND_CENTER') && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">支票號碼</th>
                  <th className="p-2.5">開票銀行</th>
                  <th className="p-2.5">受款對象</th>
                  <th className="p-2.5 text-right">票面金額</th>
                  <th className="p-2.5 text-center">到期日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {getAllBankChecks().map(chk => (
                  <tr key={chk.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold">{chk.checkNumber}</td>
                    <td className="p-2.5">{chk.bankName}</td>
                    <td className="p-2.5 font-bold text-slate-800">{chk.counterpartyName}</td>
                    <td className="p-2.5 font-mono text-right font-bold">NT$ {chk.amount.toLocaleString()}</td>
                    <td className="p-2.5 font-mono text-center">{chk.dueDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
