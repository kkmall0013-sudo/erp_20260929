import React from 'react';
import { History } from 'lucide-react';
import { AuditLog } from '../../types/erp';

interface RecoveryAuditLogsTabProps {
  logs: AuditLog[];
}

export const RecoveryAuditLogsTab: React.FC<RecoveryAuditLogsTabProps> = ({ logs }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <span>軟刪除與救援操作歷史審計日誌 (Audit Trail)</span>
          <span className="text-[10px] font-normal text-slate-500">
            (依時間降冪排列，詳實記錄操作人、時間戳記與差異快照，杜絕死無對證)
          </span>
        </h3>
      </div>

      {logs.length === 0 ? (
        <div className="py-16 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
          <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-600">目前尚無軟刪除或救援操作日誌</p>
          <p className="text-[11px] text-slate-400 mt-1">任何軟刪除、還原或抹除操作均會在此留下審計軌跡</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">時間戳記</th>
                <th className="py-3 px-4">操作人員</th>
                <th className="py-3 px-4">動作標籤</th>
                <th className="py-3 px-4">目標模組 / 資料表</th>
                <th className="py-3 px-4">目標識別碼 / 名稱</th>
                <th className="py-3 px-4">操作細節差異 (JSON Snapshot)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map(log => {
                const isRestore = log.action.includes('救援還原') || log.action.includes('RESTORE');
                const isPurge = log.action.includes('永久抹除') || log.action.includes('HARD_DELETE');

                return (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {log.createdAt}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {log.userName}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isRestore
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : isPurge
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {log.targetTable}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-indigo-700">
                      {log.targetId}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-600 max-w-md">
                      <div className="space-y-0.5 font-mono text-[10.5px]">
                        {log.beforeJson && (
                          <div className="truncate text-slate-500" title={log.beforeJson}>
                            <span className="text-slate-400 font-bold">刪前:</span> {log.beforeJson}
                          </div>
                        )}
                        {log.afterJson && (
                          <div className="truncate text-indigo-800 font-medium" title={log.afterJson}>
                            <span className="text-indigo-500 font-bold">結果:</span> {log.afterJson}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
