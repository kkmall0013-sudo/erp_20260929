import React from 'react';
import { ShieldCheck, Download, Database, HardDrive } from 'lucide-react';
import { importSql } from '../../../db/sqlite';
import { downloadSqlDumpFile, downloadSqliteBinaryFile } from '../../../utils/sqliteBackupUtils';
import { DatabaseRestoreDropzoneCard } from './DatabaseRestoreDropzoneCard';

interface DatabaseGhostBackupTabProps {
  onReloadLocal: () => void;
  onDataChanged: () => void;
  showToast: (msg: string) => void;
}

export const DatabaseGhostBackupTab: React.FC<DatabaseGhostBackupTabProps> = ({
  onReloadLocal,
  onDataChanged,
  showToast
}) => {
  const handleExportSql = () => {
    try {
      downloadSqlDumpFile(`enterprise_erp_ghost_dump_${new Date().toISOString().slice(0, 10)}.sql`);
      showToast('✅ 已成功匯出全庫 SQL DDL & INSERT 備份指令稿');
    } catch (e) {
      showToast('❌ 匯出失敗: ' + (e as Error).message);
    }
  };

  const handleExportBinary = () => {
    try {
      downloadSqliteBinaryFile();
      showToast('✅ 已成功下載 .sqlite 二進位資料庫實體備份檔案');
    } catch (e) {
      showToast('❌ 下載失敗: ' + (e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-900 leading-relaxed flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm text-indigo-950 mb-1">
            全庫鏡像模式 (Ghost Backup & Full Restore)
          </h4>
          <p className="text-indigo-800/90">
            適合全系統大版本升級前、伺服器定時排程快照，或遭受重大硬體損壞時的救命繩。將所有 12 大模組完整封裝，包含外鍵約束、跳號計數器與系統參數。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-all">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 mb-2 font-bold text-sm">
              <Download className="w-4 h-4" />
              <h4>匯出完整純文字 SQL 指令稿 (.sql)</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              自動產生全系統資料表的 DDL 建表與逐列標準 <code>INSERT INTO</code> 語法，可在任何標準 SQL 編輯器檢閱或跨資料庫遷移。
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportSql}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>即刻匯出 .sql 指令檔</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-all">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 mb-2 font-bold text-sm">
              <Database className="w-4 h-4" />
              <h4>下載二進位 SQLite 實體庫 (.sqlite)</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              直接將記憶體中運行的 SQLite 原始檔案完整二進位打包。單一檔案帶走，插上隨身碟即可直接於其他電腦原封不動掛載。
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportBinary}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <HardDrive className="w-4 h-4" />
            <span>下載完整 .sqlite 資料庫檔案</span>
          </button>
        </div>
      </div>

      <DatabaseRestoreDropzoneCard
        operatorName="系統管理者"
        inputId="modal-ghost-file-input"
        onDataChanged={onDataChanged}
        onReloadLocal={onReloadLocal}
        showToast={showToast}
        allowManualSql
        onImportManualSql={(sql) => importSql(sql)}
      />
    </div>
  );
};
