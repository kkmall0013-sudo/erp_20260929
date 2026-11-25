import React, { useState } from 'react';
import {
  Upload,
  RefreshCw,
  HardDrive,
  FileCode,
  AlertTriangle,
  Download
} from 'lucide-react';
import { resetToSeedData } from '../../../db/sqlite';
import {
  BackupFilePreview,
  buildBackupFilePreview,
  downloadSqliteBinaryFile,
  executeDatabaseRestoreFile
} from '../../../utils/sqliteBackupUtils';
import { ConfirmDialogModal } from '../../widgets/ConfirmDialogModal';

export interface DatabaseRestoreDropzoneCardProps {
  operatorName: string;
  inputId: string;
  onDataChanged: () => void;
  onReloadLocal?: () => void;
  showToast: (msg: string) => void;
  onResetSeedOverride?: () => void;
  onDownloadBackupOverride?: () => void;
  allowManualSql?: boolean;
  onImportManualSql?: (sql: string) => { success: boolean; message: string };
}

export const DatabaseRestoreDropzoneCard: React.FC<DatabaseRestoreDropzoneCardProps> = ({
  operatorName,
  inputId,
  onDataChanged,
  onReloadLocal,
  showToast,
  onResetSeedOverride,
  onDownloadBackupOverride,
  allowManualSql = false,
  onImportManualSql
}) => {
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupFilePreview | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [showManualSql, setShowManualSql] = useState(false);
  const [manualSqlText, setManualSqlText] = useState('');

  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const handleSelectFile = (file: File) => {
    setRestoreFile(file);
    setRestorePreview(buildBackupFilePreview(file));
  };

  const handleDownloadBinary = () => {
    if (onDownloadBackupOverride) {
      onDownloadBackupOverride();
      return;
    }
    try {
      downloadSqliteBinaryFile();
      showToast('✅ 已成功下載 .sqlite 二進位資料庫實體備份檔案');
    } catch (e: any) {
      showToast('❌ 下載失敗: ' + (e?.message || String(e)));
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreFile) return;
    setConfirmRestoreOpen(false);
    setIsRestoring(true);
    try {
      const res = await executeDatabaseRestoreFile(restoreFile, operatorName);
      if (res.success) {
        showToast(`✅ ${res.message}`);
        setRestoreFile(null);
        setRestorePreview(null);
        onReloadLocal?.();
        onDataChanged();
      } else {
        showToast(`❌ ${res.message}`);
      }
    } catch (err: unknown) {
      showToast(`❌ 還原失敗: ${(err as Error).message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleConfirmResetSeed = () => {
    setConfirmResetOpen(false);
    resetToSeedData();
    showToast('✅ 資料庫已成功重設為初始標準測試種子狀態！');
    onReloadLocal?.();
    onDataChanged();
  };

  const handleRunManualSql = () => {
    if (!onImportManualSql) return;
    if (!manualSqlText.trim()) {
      showToast('⚠️ 請先貼上或載入 SQL 語法指令');
      return;
    }
    const res = onImportManualSql(manualSqlText);
    if (res.success) {
      showToast('✅ ' + res.message);
      setManualSqlText('');
      onReloadLocal?.();
      onDataChanged();
    } else {
      showToast('❌ ' + res.message);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">
              全庫檔案一鍵上傳還原 (Direct File Restore)
            </h4>
            <p className="text-[11px] text-slate-500">
              支援 .sqlite / .db 實體庫二進位檔案，或 .sql 標準建表資料指令檔
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (onResetSeedOverride) {
              onResetSeedOverride();
            } else {
              setConfirmResetOpen(true);
            }
          }}
          className="text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>一鍵重設測試種子庫</span>
        </button>
      </div>

      {/* 拖曳或點選上傳區 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleSelectFile(file);
        }}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
            : restoreFile
            ? 'border-emerald-400 bg-emerald-50/20'
            : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50'
        }`}
      >
        <input
          type="file"
          id={inputId}
          accept=".sqlite,.db,.sql"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleSelectFile(file);
          }}
          className="hidden"
        />

        {!restoreFile ? (
          <label
            htmlFor={inputId}
            className="cursor-pointer flex flex-col items-center justify-center space-y-2 py-1"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold text-slate-800">
              點擊選擇或將資料庫備份檔案拖曳至此
            </div>
            <p className="text-[11px] text-slate-500">
              支援 <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-mono">.sqlite</code>、
              <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-mono">.db</code>、
              <code className="bg-slate-200 px-1 py-0.5 rounded text-emerald-700 font-mono">.sql</code>
            </p>
          </label>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                {restorePreview?.type === 'SQLITE' ? <HardDrive className="w-5 h-5" /> : <FileCode className="w-5 h-5" />}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span>{restorePreview?.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      restorePreview?.type === 'SQLITE'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {restorePreview?.type === 'SQLITE' ? 'SQLite 3 實體二進位庫' : 'SQL 指令稿檔案'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  檔案大小：{restorePreview?.sizeFormatted} · 準備還原
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRestoreFile(null);
                  setRestorePreview(null);
                }}
                className="ml-4 text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 rounded hover:bg-rose-50 cursor-pointer"
              >
                重新選擇
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 text-left flex items-start gap-2 max-w-2xl mx-auto">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">安全提醒：執行還原將會以所選檔案完全取代目前系統的所有資料表！</div>
                <div className="text-[11px] text-amber-800/90 mt-0.5">
                  還原完成後系統將自動校準全模組單據流水號計數器，確保後續開單絕不撞號。建議先點擊下方防呆按鈕下載備份。
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadBinary}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>還原前先下載當前庫備份防呆 (建議)</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmRestoreOpen(true)}
                disabled={isRestoring}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-4 h-4 text-emerald-300" />
                <span>{isRestoring ? '正在還原掛載資料庫...' : '確認執行全庫覆蓋還原'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 貼上純文字 SQL (摺疊展開) */}
      {allowManualSql && onImportManualSql && (
        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowManualSql(!showManualSql)}
            className="text-xs text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{showManualSql ? '▼ 收起純文字 SQL 語法手動輸入區' : '▶ 進階工程師模式：手動貼上 SQL 語法指令還原'}</span>
          </button>

          {showManualSql && (
            <div className="mt-3 space-y-3">
              <textarea
                value={manualSqlText}
                onChange={(e) => setManualSqlText(e.target.value)}
                placeholder="在此貼上 .sql 指令稿文本，點擊下方按鈕即可整庫覆蓋還原..."
                rows={4}
                className="w-full font-mono text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleRunManualSql}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>執行文字 SQL 還原</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 取代原生 window.confirm 的二次確認彈窗 */}
      <ConfirmDialogModal
        isOpen={confirmRestoreOpen}
        title="資料庫全庫覆蓋還原確認"
        variant="warning"
        message={
          <>
            您即將以檔案【<strong className="text-slate-900 font-mono">{restoreFile?.name}</strong>】覆蓋還原目前的 ERP 資料庫！現有資料將會被完全替換。
          </>
        }
        extraNotice="還原完成後，系統將自動校準全模組單據流水號計數器與三柱版本設定。"
        confirmText="立即執行全庫還原"
        onConfirm={handleExecuteRestore}
        onCancel={() => setConfirmRestoreOpen(false)}
      />

      <ConfirmDialogModal
        isOpen={confirmResetOpen}
        title="重置測試種子資料庫確認"
        variant="danger"
        message="確定要將資料庫重置為標準營造工程初始種子狀態嗎？目前未備份之測試與異動資料將會被完整覆蓋！"
        confirmText="確認重置為種子庫"
        onConfirm={handleConfirmResetSeed}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </div>
  );
};
