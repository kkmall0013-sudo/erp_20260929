import React from 'react';
import { Search, RefreshCw } from 'lucide-react';

interface DatabaseTableInspectorTabProps {
  inspectorTable: string;
  setInspectorTable: (table: string) => void;
  inspectorSearch: string;
  setInspectorSearch: (term: string) => void;
  inspectorData: { columns: string[]; values: (string | number | null)[][] };
  onReloadTable: (tableName: string) => void;
}

export const DatabaseTableInspectorTab: React.FC<DatabaseTableInspectorTabProps> = ({
  inspectorTable,
  setInspectorTable,
  inspectorSearch,
  setInspectorSearch,
  inspectorData,
  onReloadTable
}) => {
  const filteredInspectorValues = inspectorData.values.filter(row => {
    if (!inspectorSearch.trim()) return true;
    return row.some(cell => String(cell || '').toLowerCase().includes(inspectorSearch.toLowerCase()));
  });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-700">選擇資料表：</span>
          <select
            value={inspectorTable}
            onChange={(e) => {
              setInspectorTable(e.target.value);
              onReloadTable(e.target.value);
            }}
            className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-1 focus:ring-indigo-500"
          >
            <optgroup label="帳號權限與平台基礎">
              <option value="users">users (使用者帳號與三階段生命週期主檔)</option>
              <option value="user_groups">user_groups (業務權限群組與核准上限主檔)</option>
              <option value="group_module_permissions">group_module_permissions (12大模組 PBAC 權限矩陣)</option>
              <option value="system_configs">system_configs (全域核心系統參數)</option>
              <option value="audit_logs">audit_logs (純中文差異比對審計日誌)</option>
              <option value="document_sequences">document_sequences (單據跳號流水號引擎)</option>
              <option value="annual_archive_snapshots">annual_archive_snapshots (年度唯讀封存快照)</option>
              <option value="system_files">system_files (無紙化附件金庫)</option>
            </optgroup>
            <optgroup label="法人、專案與商業夥伴">
              <option value="companies">companies (公司法人、集團與個人實體)</option>
              <option value="projects">projects (專案工程主檔)</option>
              <option value="project_sites">project_sites (工程案場地址與建照)</option>
              <option value="project_wbs">project_wbs (工程 WBS 預算節點)</option>
              <option value="business_partners">business_partners (商業夥伴業主與廠商)</option>
              <option value="items">items (料件與服務工項主檔)</option>
            </optgroup>
            <optgroup label="報價、採購、發包與財務">
              <option value="quotations">quotations (業主報價單 CPQ)</option>
              <option value="quotation_revisions">quotation_revisions (報價單版次歷程 REV-A/B)</option>
              <option value="quotation_items">quotation_items (報價單工項與粉紅折讓明細)</option>
              <option value="quotation_billing_milestones">quotation_billing_milestones (報價請款里程碑)</option>
              <option value="purchase_orders">purchase_orders (採購發包單 PO)</option>
              <option value="purchase_order_items">purchase_order_items (採購單明細)</option>
              <option value="subcontracts">subcontracts (下包工程承攬合約)</option>
              <option value="valuations">valuations (下包估驗計價請款單)</option>
              <option value="valuation_items">valuation_items (估驗計價明細与粉紅扣款)</option>
              <option value="accounts_payable">accounts_payable (應付帳款憑單 AP)</option>
              <option value="accounts_receivable">accounts_receivable (應收帳款憑單 AR)</option>
              <option value="bank_checks">bank_checks (應收付支票票據)</option>
            </optgroup>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={inspectorSearch}
              onChange={(e) => setInspectorSearch(e.target.value)}
              placeholder="全文快速檢索..."
              className="text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg w-52 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={() => onReloadTable(inspectorTable)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            title="重新整理"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 唯讀表格展示 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[50vh]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100/80 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3 border-r border-slate-200 w-12 text-center text-slate-400">#</th>
                {inspectorData.columns.map(col => (
                  <th key={col} className="py-2.5 px-3 border-r border-slate-200 font-mono whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-700">
              {filteredInspectorValues.length === 0 ? (
                <tr>
                  <td colSpan={inspectorData.columns.length + 1} className="py-8 text-center text-slate-400">
                    無符合之紀錄
                  </td>
                </tr>
              ) : (
                filteredInspectorValues.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 border-r border-slate-100 text-center text-slate-400">
                      {rowIdx + 1}
                    </td>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="py-2 px-3 border-r border-slate-100 whitespace-nowrap max-w-xs truncate">
                        {cell === null || cell === undefined ? (
                          <span className="text-slate-300 italic">NULL</span>
                        ) : typeof cell === 'number' ? (
                          <span className="text-indigo-600 font-semibold tabular-nums">{cell.toLocaleString()}</span>
                        ) : (
                          <span>{String(cell)}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between items-center">
          <span>顯示前 50 筆紀錄 (純唯讀安全檢視，禁止未經授權之歷史更動)</span>
          <span className="font-mono">共 {filteredInspectorValues.length} 列</span>
        </div>
      </div>
    </div>
  );
};
