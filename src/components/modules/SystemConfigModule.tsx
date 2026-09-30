import React from 'react';
import { SystemConfig, AuditLog } from '../../types/erp';
import { Sliders, ShieldCheck, History, Database, CheckCircle2, Lock } from 'lucide-react';

interface SystemConfigModuleProps {
  configs: SystemConfig[];
  auditLogs: AuditLog[];
  onDataChanged: () => void;
}

export const SystemConfigModule: React.FC<SystemConfigModuleProps> = ({
  configs,
  auditLogs,
}) => {
  return (
    <div className="space-y-6">
      {/* 標題與簡介 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              全域參數與安全審計模組 (Phase 1 & 憲法第零章)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              全域法規參數字典 · 樂觀鎖防並行衝突 · 嚴格操作歷程 (AuditLog)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>憲法規範生效中</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 全域參數表 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>全域系統參數字典 (SystemConfig)</span>
            </h3>
            <span className="text-xs text-slate-400">時點版本控管</span>
          </div>

          <div className="space-y-3">
            {configs.map(cfg => (
              <div
                key={cfg.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between"
              >
                <div>
                  <div className="font-mono text-xs font-bold text-slate-800">
                    {cfg.configKey}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {cfg.configKey === 'TAX_RATE' && '加值型營業稅率 (5%)'}
                    {cfg.configKey === 'FIN_TAX_TOLERANCE' && '進銷項營業稅借貸平衡容差上限 ($5)'}
                    {cfg.configKey === 'DEFAULT_RETENTION_RATE' && '營造工程預設保留款提留比例 (10%)'}
                    {cfg.configKey === 'PROJECT_LOCK_MODE' && '專案鎖定模式 (STRICT 嚴格防竄改)'}
                    {cfg.configKey === 'NHI_RATE' && '二代健保補充保費率 (2.11%)'}
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded border border-indigo-200">
                    {cfg.configValue}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    生效: {cfg.validFrom}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 審計軌跡歷程 (Audit Logs) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <span>操作審計歷程 (AuditLog)</span>
            </h3>
            <span className="text-xs text-slate-400">即時稽核快照</span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {auditLogs.map(log => (
              <div
                key={log.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.2 rounded font-mono font-bold text-[10px] ${
                        log.action === 'POST'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.action === 'CREATE'
                          ? 'bg-blue-100 text-blue-800'
                          : log.action === 'VOID'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="font-semibold text-slate-800">{log.userName}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">{log.createdAt}</span>
                </div>

                <div className="text-slate-600">
                  操作資料表：<span className="font-mono font-medium text-slate-800">{log.targetTable}</span>
                  {log.targetId && (
                    <span className="font-mono text-slate-500 ml-1">({log.targetId})</span>
                  )}
                </div>

                {log.afterJson && (
                  <div className="font-mono text-[10px] text-slate-500 bg-white p-1.5 rounded border border-slate-200 truncate">
                    異動內容: {log.afterJson}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
