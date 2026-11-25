import React, { useState } from 'react';
import {
  Database,
  FileCode,
  HardDrive,
  RotateCcw,
  Layers,
  Archive,
  CheckCircle2,
  Download
} from 'lucide-react';
import { AnnualArchiveSnapshot } from '../../types/erp';
import {
  createAnnualArchiveSnapshot,
  resetToSeedData
} from '../../db/sqlite';
import {
  downloadSqlDumpFile,
  downloadSqliteBinaryFile
} from '../../utils/sqliteBackupUtils';
import { DatabaseRestoreDropzoneCard } from './db/DatabaseRestoreDropzoneCard';
import { ConfirmDialogModal } from '../widgets/ConfirmDialogModal';

export interface SettingsDatabaseHubTabProps {
  moduleStats: Array<{ moduleKey: string; moduleName: string; tables: string[]; totalRecords: number }>;
  annualSnapshots: AnnualArchiveSnapshot[];
  canWriteModule: boolean;
  operatorName: string;
  onReloadData: () => void;
  onDataChanged: () => void;
  triggerToast: (msg: string) => void;
  onOpenDatabaseCenter?: () => void;
  onQuickBackupSql?: () => void;
  onQuickBackupSqlite?: () => void;
  onResetDatabase?: () => void;
}

export const SettingsDatabaseHubTab: React.FC<SettingsDatabaseHubTabProps> = ({
  moduleStats,
  annualSnapshots,
  canWriteModule,
  operatorName,
  onReloadData,
  onDataChanged,
  triggerToast,
  onOpenDatabaseCenter,
  onQuickBackupSql,
  onQuickBackupSqlite,
  onResetDatabase
}) => {
  const [newArchiveYear, setNewArchiveYear] = useState<number>(new Date().getFullYear());
  const [isArchiving, setIsArchiving] = useState<boolean>(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState<boolean>(false);

  const handleDownloadSql = () => {
    if (onQuickBackupSql) {
      onQuickBackupSql();
      return;
    }
    try {
      downloadSqlDumpFile();
      triggerToast('✅ 已成功匯出完整 SQL DDL & INSERT 備份指令稿');
    } catch (e: any) {
      triggerToast('❌ 匯出失敗: ' + (e?.message || String(e)));
    }
  };

  const handleDownloadSqlite = () => {
    if (onQuickBackupSqlite) {
      onQuickBackupSqlite();
      return;
    }
    try {
      downloadSqliteBinaryFile();
      triggerToast('✅ 已成功下載 .sqlite 二進位資料庫實體備份檔案');
    } catch (e: any) {
      triggerToast('❌ 下載失敗: ' + (e?.message || String(e)));
    }
  };

  const handleRequestReset = () => {
    if (onResetDatabase) {
      onResetDatabase();
      return;
    }
    setConfirmResetOpen(true);
  };

  const handleConfirmResetSeed = () => {
    setConfirmResetOpen(false);
    resetToSeedData();
    triggerToast('✅ 資料庫已成功重設為初始標準測試種子狀態！');
    onReloadData();
    onDataChanged();
  };

  const handleCreateAnnualArchive = () => {
    if (!canWriteModule) {
      triggerToast('⛔ 權限攔截：無建立年度封存快照權限！');
      return;
    }
    setIsArchiving(true);
    setTimeout(() => {
      try {
        const desc = `${newArchiveYear} 年度工程單據與財務帳目自包含唯讀封存快照`;
        const res = createAnnualArchiveSnapshot(newArchiveYear, desc, operatorName);
        setIsArchiving(false);
        if (res.success) {
          triggerToast(`✅ ${res.message}`);
          onReloadData();
          onDataChanged();
        } else {
          triggerToast(`⚠️ ${res.message}`);
        }
      } catch (err: any) {
        setIsArchiving(false);
        triggerToast(`⛔ 封存失敗：${err.message || String(err)}`);
      }
    }, 200);
  };

  const handleDownloadSnapshotBinary = (snapshot: AnnualArchiveSnapshot) => {
    try {
      downloadSqliteBinaryFile(snapshot.archiveFileName || `ERP_ARCHIVE_${snapshot.archiveYear}.sqlite`);
      triggerToast(`✅ 已啟動下載 ${snapshot.archiveFileName}！`);
    } catch (e: any) {
      triggerToast(`⛔ 下載失敗: ${e.message}`);
    }
  };

  return (
    <div className="p-6 space-y-8">
      {/* 頂部快捷控制列 */}
      <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold">本地 SQLite 資料庫協作、備份與年度封存安全中樞</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            IndexedDB 零伺服器持久引擎
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          系統支援全庫鏡像 (.sqlite / .sql)、時段過濾模組化備份還原、以及 2010～2026 歷年工程完工唯讀封存清冊，保障公司數十年營運資料資安。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={
              onOpenDatabaseCenter ||
              (() => triggerToast('💡 可點擊畫面頂部右上角齒輪或資料庫圖示開啟進階彈窗'))
            }
            className="p-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-left text-xs font-bold flex flex-col justify-between transition-colors cursor-pointer shadow-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <Database className="w-4 h-4 text-indigo-200" />
              <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-mono">完整彈窗</span>
            </div>
            <div>
              <div>歷史封存與進階管理中心</div>
              <div className="text-[10px] text-indigo-200 font-normal mt-0.5">彈出完整時段過濾與結構審核</div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleDownloadSql}
            className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-left text-xs font-bold flex flex-col justify-between transition-colors cursor-pointer border border-slate-700"
          >
            <div className="mb-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div>匯出全庫 SQL 指令稿</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">標準 DDL 與純文字備份</div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleDownloadSqlite}
            className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-left text-xs font-bold flex flex-col justify-between transition-colors cursor-pointer border border-slate-700"
          >
            <div className="mb-2">
              <HardDrive className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div>下載 SQLite 快照 (.sqlite)</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">二進位實體資料庫檔案</div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleRequestReset}
            className="p-3 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 text-left text-xs font-bold flex flex-col justify-between transition-colors cursor-pointer border border-rose-900/60"
          >
            <div className="mb-2">
              <RotateCcw className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <div>重設出廠預設種子</div>
              <div className="text-[10px] text-rose-300 font-normal mt-0.5">重灌初始業務範例</div>
            </div>
          </button>
        </div>
      </div>

      {/* 共用全庫檔案一鍵拖曳／上傳還原卡片 (含 ConfirmDialogModal) */}
      <DatabaseRestoreDropzoneCard
        operatorName={operatorName}
        inputId="hub-database-file-input"
        onDataChanged={onDataChanged}
        onReloadLocal={onReloadData}
        showToast={triggerToast}
        onResetSeedOverride={onResetDatabase}
        onDownloadBackupOverride={onQuickBackupSqlite}
      />

      {/* 全模組資料表健康度與即時筆數卡片 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>全模組即時健康度與資料筆數監控面板</span>
          </h4>
          <span className="text-[11px] text-slate-400">即時動態統計</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {moduleStats.map(stat => (
            <div
              key={stat.moduleKey}
              className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-indigo-300 transition-colors"
            >
              <div className="text-[10px] text-slate-400 font-bold truncate">{stat.moduleKey}</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5 truncate">{stat.moduleName}</div>
              <div className="text-lg font-mono font-extrabold text-indigo-600 mt-2">
                {stat.totalRecords.toLocaleString()}{' '}
                <span className="text-[10px] font-normal text-slate-400">筆</span>
              </div>
              <div className="text-[9px] text-slate-400 mt-1 truncate">{stat.tables.join(', ')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2010～2026 歷年唯讀封存快照清冊 */}
      <div className="border border-slate-200 rounded-xl bg-white p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Archive className="w-4 h-4 text-emerald-600" />
              <span>🏛️ 2010～2026 歷年唯讀封存快照實體清冊 (Annual Archival Registry)</span>
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              年度封存快照獨立封裝各年度歷史單據，標記為唯讀 (isSealed: 1)。移機時可選擇性掛載，主庫永不膨脹。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={newArchiveYear}
              onChange={(e) => setNewArchiveYear(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white"
            >
              {Array.from({ length: 17 }, (_, i) => 2010 + i).map(yr => (
                <option key={yr} value={yr}>
                  {yr} 年度
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCreateAnnualArchive}
              disabled={isArchiving || !canWriteModule}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{isArchiving ? '封裝中...' : `封存 ${newArchiveYear} 年度`}</span>
            </button>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {annualSnapshots.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              目前尚未建立年度封存快照。可使用上方「封存特定年度」按鈕將指定年份（2010～2026）封裝為唯讀快照檔案。
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">封存年份</th>
                  <th className="py-2.5 px-4">檔案名稱</th>
                  <th className="py-2.5 px-4">記錄筆數</th>
                  <th className="py-2.5 px-4">封存時間</th>
                  <th className="py-2.5 px-4">狀態</th>
                  <th className="py-2.5 px-4">備註說明</th>
                  <th className="py-2.5 px-4 text-right">下載快照</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {annualSnapshots.map(snap => (
                  <tr key={snap.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-slate-900 font-mono">
                      {snap.archiveYear} 年
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">
                      {snap.archiveFileName}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700">
                      {snap.recordCount.toLocaleString()} 筆
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                      {snap.sealedAt?.slice(0, 16)} ({snap.sealedBy})
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>唯讀封存 (isSealed: 1)</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 text-[11px]">
                      {snap.description || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDownloadSnapshotBinary(snap)}
                        className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded flex items-center gap-1 ml-auto cursor-pointer transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>下載 .sqlite</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 重置種子庫二次確認彈窗 */}
      <ConfirmDialogModal
        isOpen={confirmResetOpen}
        title="重置出廠預設種子確認"
        variant="danger"
        message="確定要將資料庫重置為標準營造工程初始種子狀態嗎？目前未備份之測試與異動資料將會被覆蓋！"
        confirmText="確認重置"
        onConfirm={handleConfirmResetSeed}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </div>
  );
};
