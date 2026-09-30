import React, { useState } from 'react';
import {
  Database,
  Download,
  Upload,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  Table,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  exportSqlDump,
  exportSqliteBinary,
  importSql,
  executeCustomQuery,
  getDatabase,
  seedInitialData
} from '../../db/sqlite';

interface DatabaseManagerProps {
  onDataChanged: () => void;
}

export const DatabaseManager: React.FC<DatabaseManagerProps> = ({ onDataChanged }) => {
  const [sqlInput, setSqlInput] = useState('');
  const [queryInput, setQueryInput] = useState('SELECT poNumber, counterpartyNameSnapshot, totalAmount, status FROM purchase_orders;');
  const [queryResults, setQueryResults] = useState<{ columns: string[]; values: (string | number | null)[][] }[] | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'BACKUP_RESTORE' | 'CONSOLE' | 'SCHEMA_OVERVIEW'>('BACKUP_RESTORE');

  // 下載文字 SQL Dump
  const handleDownloadSqlDump = () => {
    try {
      const dump = exportSqlDump();
      const blob = new Blob([dump], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `engineering_erp_backup_${timestamp}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setNotification({
        type: 'success',
        message: '✅ 成功匯出 SQL 完整備份指令稿！包含 12 大模組 DDL 與所有 INSERT 數據。'
      });
    } catch (e: unknown) {
      const err = e as Error;
      setNotification({ type: 'error', message: `匯出 SQL 失敗: ${err.message}` });
    }
  };

  // 下載二進位 SQLite 檔案
  const handleDownloadSqliteFile = () => {
    try {
      const binary = exportSqliteBinary();
      const blob = new Blob([binary as unknown as BlobPart], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `engineering_erp_${timestamp}.sqlite`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setNotification({
        type: 'success',
        message: '✅ 成功下載 .sqlite 二進位資料庫！可直接使用 DBeaver 或 DB Browser 開啟。'
      });
    } catch (e: unknown) {
      const err = e as Error;
      setNotification({ type: 'error', message: `下載 SQLite 失敗: ${err.message}` });
    }
  };

  // 匯入 SQL 指令稿執行
  const handleImportSql = () => {
    if (!sqlInput.trim()) {
      setNotification({ type: 'error', message: '請先貼上或輸入 SQL 指令稿內容' });
      return;
    }
    const result = importSql(sqlInput);
    if (result.success) {
      setNotification({ type: 'success', message: result.message });
      setSqlInput('');
      onDataChanged();
    } else {
      setNotification({ type: 'error', message: result.message });
    }
  };

  // 讀取檔案匯入
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setSqlInput(content);
      setNotification({
        type: 'success',
        message: `已讀取檔案 ${file.name} (${content.length} 字元)，點擊「執行 SQL 指令稿」以套用。`
      });
    };
    reader.readAsText(file);
  };

  // 執行即時 SQL 查詢
  const handleRunQuery = () => {
    if (!queryInput.trim()) return;
    try {
      const results = executeCustomQuery(queryInput);
      setQueryResults(results);
      setNotification(null);
      onDataChanged();
    } catch (e: unknown) {
      const err = e as Error;
      setNotification({ type: 'error', message: `SQL 查詢錯誤: ${err.message}` });
      setQueryResults(null);
    }
  };

  // 重置為真實營造範例資料
  const handleResetSampleData = async () => {
    if (!window.confirm('確定要將資料庫重置為系統初始的台灣營造工程示範資料嗎？現有自訂資料將被覆蓋。')) {
      return;
    }
    try {
      const db = await getDatabase();
      seedInitialData(db);
      onDataChanged();
      setNotification({
        type: 'success',
        message: '✅ 資料庫已成功重置為標準營造工程業務展示資料！'
      });
    } catch (e: unknown) {
      const err = e as Error;
      setNotification({ type: 'error', message: `重置失敗: ${err.message}` });
    }
  };

  const tablesSummary = [
    { name: 'companies', label: '公司法人主檔', purpose: '多法人代碼、統編與本位幣' },
    { name: 'projects', label: '專案與案場', purpose: '合約金額、預算、執行成本與案場鎖定' },
    { name: 'project_sites', label: '案場工地所', purpose: '工地地址、建照號碼、工務主管' },
    { name: 'project_wbs', label: 'WBS 預算節點', purpose: '各工項預算與承諾發包金額' },
    { name: 'business_partners', label: '商業夥伴 (BP)', purpose: '客戶、廠商、下包整合主檔與黑名單警報' },
    { name: 'quotations', label: '報價單 (CPQ)', purpose: '三軌報價、多版次 REV-A/B 與粉紅折讓' },
    { name: 'purchase_orders', label: '採購單', purpose: '過帳統編快照、預付款自動扣抵沖銷' },
    { name: 'subcontracts', label: '下包工程承攬合約', purpose: '合約總額、10% 保留款比率、預付款水位' },
    { name: 'valuations', label: '估驗計價單', purpose: '期別累計度、保留款扣除、瀑布式付款結算' },
    { name: 'accounts_payable', label: '應付帳款 (AP)', purpose: '進貨估驗轉應付憑單、發票本位拆單' },
    { name: 'accounts_receivable', label: '應收帳款 (AR)', purpose: '業主合約里程碑請款與帳齡分析' },
    { name: 'bank_checks', label: '銀行期票', purpose: '應收付支票、到期兌現與跳票作廢警報' },
    { name: 'system_configs', label: '全域參數', purpose: '營業稅率 5%、容差 5.0、健保、印花稅' },
    { name: 'audit_logs', label: '全域審計歷程', purpose: '過帳、修改前/後 JSON 快照、IP 追蹤' },
  ];

  return (
    <div className="space-y-6">
      {/* 標題與簡介 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              SQLite 本地資料庫與備份匯出中心
              <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-800">
                便利 SQL 備份
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              依據您的需求採用輕量、零維護、備份極為方便的 SQLite 關聯式資料庫，支援一鍵下載 .sqlite 與匯出標準 .sql 指令檔。
            </p>
          </div>
        </div>

        {/* 快速重置示範資料 */}
        <button
          onClick={handleResetSampleData}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>重置營造範例資料</span>
        </button>
      </div>

      {/* 訊息通知 */}
      {notification && (
        <div
          className={`p-4 rounded-lg text-xs font-medium flex items-center gap-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* 分頁開關 */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('BACKUP_RESTORE')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'BACKUP_RESTORE'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>一鍵備份與匯入還原</span>
        </button>

        <button
          onClick={() => setActiveTab('CONSOLE')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'CONSOLE'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCode2 className="w-3.5 h-3.5" />
          <span>即時 SQL 查詢控制台</span>
        </button>

        <button
          onClick={() => setActiveTab('SCHEMA_OVERVIEW')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'SCHEMA_OVERVIEW'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          <span>12 大模組資料表總覽</span>
        </button>
      </div>

      {/* 分頁 1: 一鍵備份與還原 */}
      {activeTab === 'BACKUP_RESTORE' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側：匯出與下載 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Download className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">資料庫匯出與下載 (備份)</h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              隨時點擊下方按鈕，直接將完整的工程資料庫保存為純文字 SQL 語法或二進位 SQLite 檔案，安全、自主且可攜。
            </p>

            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-lg border border-indigo-100 bg-indigo-50/30 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FileCode2 className="w-4 h-4 text-indigo-600" />
                    匯出純文字 SQL 指令檔 (.sql)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    包含所有 12 大模組的 DDL 建表與完整 INSERT INTO 資料列
                  </div>
                </div>
                <button
                  onClick={handleDownloadSqlDump}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下載 .sql</span>
                </button>
              </div>

              <div className="p-3.5 rounded-lg border border-emerald-100 bg-emerald-50/30 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-600" />
                    下載二進位 SQLite 資料庫 (.sqlite)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    可用於 DBeaver, Navicat, SQLiteStudio 直接開啟檢閱與備份
                  </div>
                </div>
                <button
                  onClick={handleDownloadSqliteFile}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下載 .sqlite</span>
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="font-semibold text-slate-700">📌 備份建議與優勢：</div>
              <div>• SQL 檔案為純文字，可備份至隨身碟、Git、NAS 或私人雲端。</div>
              <div>• 未來隨時可將該 .sql 檔案無痛匯入至 PostgreSQL 或 MySQL。</div>
            </div>
          </div>

          {/* 右側：匯入與還原 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Upload className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">匯入 SQL 指令稿進行還原</h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              上傳先前匯出的 .sql 備份檔，或直接在下方貼上 SQL 語句以執行批次更新與資料還原：
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                選擇本機 .sql 檔案上傳：
              </label>
              <input
                type="file"
                accept=".sql,.txt"
                onChange={handleFileUpload}
                className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                或直接貼上 SQL 語句內容：
              </label>
              <textarea
                rows={6}
                value={sqlInput}
                onChange={(e) => setSqlInput(e.target.value)}
                placeholder="在此貼上 CREATE TABLE, INSERT INTO 或 UPDATE 指令..."
                className="w-full bg-slate-50 font-mono text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={handleImportSql}
              className="w-full py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>執行 SQL 指令稿以套用還原</span>
            </button>
          </div>
        </div>
      )}

      {/* 分頁 2: 即時 SQL 查詢控制台 */}
      {activeTab === 'CONSOLE' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">即時 SQL 查詢控制台 (Live SQL Console)</h3>
            </div>
            <div className="text-xs text-slate-500">支援 SELECT, INSERT, UPDATE 等所有 SQLite 語法</div>
          </div>

          {/* 常用預設查詢快速帶入 */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">範例查詢：</span>
            <button
              onClick={() => setQueryInput('SELECT * FROM projects;')}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px]"
            >
              所有專案案場
            </button>
            <button
              onClick={() => setQueryInput('SELECT poNumber, counterpartyNameSnapshot, totalAmount, status FROM purchase_orders;')}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px]"
            >
              採購單快照
            </button>
            <button
              onClick={() => setQueryInput('SELECT valuationNumber, periodName, grossAmount, retentionDeductionAmount, netPayableAmount FROM valuations;')}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px]"
            >
              下包估驗瀑布款
            </button>
            <button
              onClick={() => setQueryInput('SELECT checkNumber, type, counterpartyName, amount, dueDate, status FROM bank_checks;')}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px]"
            >
              銀行期票
            </button>
          </div>

          <div className="relative">
            <textarea
              rows={4}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              className="w-full bg-slate-900 text-emerald-400 font-mono text-xs p-3.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="輸入 SQL 語法..."
            />
            <button
              onClick={handleRunQuery}
              className="absolute right-3 bottom-4 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>執行查詢</span>
            </button>
          </div>

          {/* 查詢結果資料表 */}
          {queryResults && queryResults.length > 0 && (
            <div className="space-y-4 pt-2">
              {queryResults.map((res, idx) => (
                <div key={idx} className="overflow-x-auto border border-slate-200 rounded-lg">
                  <div className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200 flex items-center justify-between">
                    <span>查詢結果 ({res.values.length} 筆資料列)</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {res.columns.map((col, cIdx) => (
                          <th key={cIdx} className="px-3 py-2 font-mono text-slate-700 border-r border-slate-200 last:border-0">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {res.values.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/80">
                          {row.map((val, vIdx) => (
                            <td key={vIdx} className="px-3 py-1.5 font-mono text-slate-700 border-r border-slate-100 last:border-0 tabular-nums">
                              {val === null || val === undefined ? (
                                <span className="text-slate-300 italic">NULL</span>
                              ) : typeof val === 'number' ? (
                                val.toLocaleString()
                              ) : (
                                String(val)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 分頁 3: 12 大模組資料表總覽 */}
      {activeTab === 'SCHEMA_OVERVIEW' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              全模組 SQLite 資料表結構與用途 (SSoT 依據《ERP全模組資料庫欄位與用途總表》)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tablesSummary.map((t, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 flex items-start gap-3">
                <div className="w-7 h-7 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{t.name}</span>
                    <span className="text-xs text-indigo-600 font-medium">({t.label})</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.purpose}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
