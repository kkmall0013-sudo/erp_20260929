import React, { useState } from 'react';
import { Layers, Clock, Download, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { exportModularBackup, getDatabaseModuleStats, restoreModularBackup } from '../../../db/sqlite';
import { BackupTimeFilter, ModularBackupPackage, RestoreResult, RestoreStrategy } from '../../../types/erp';
import { downloadJsonFile, readFileAsText } from '../../../utils/fileIO';

interface DatabaseModularPackageTabProps {
  moduleStats: ReturnType<typeof getDatabaseModuleStats>;
  selectedModules: string[];
  setSelectedModules: React.Dispatch<React.SetStateAction<string[]>>;
  onReloadLocal: () => void;
  onDataChanged: () => void;
  showToast: (msg: string) => void;
}

export const DatabaseModularPackageTab: React.FC<DatabaseModularPackageTabProps> = ({
  moduleStats,
  selectedModules,
  setSelectedModules,
  onReloadLocal,
  onDataChanged,
  showToast
}) => {
  const [restoreStrategy, setRestoreStrategy] = useState<RestoreStrategy>('SKIP');
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);

  const [backupTimeMode, setBackupTimeMode] = useState<'ALL' | 'YEAR' | 'RANGE'>('ALL');
  const [backupYear, setBackupYear] = useState<number>(new Date().getFullYear());
  const [backupStartDate, setBackupStartDate] = useState<string>(`${new Date().getFullYear()}-01-01`);
  const [backupEndDate, setBackupEndDate] = useState<string>(`${new Date().getFullYear()}-12-31`);

  const toggleSelectModule = (modKey: string) => {
    if (selectedModules.includes(modKey)) {
      setSelectedModules(selectedModules.filter(k => k !== modKey));
    } else {
      setSelectedModules([...selectedModules, modKey]);
    }
  };

  const handleExportModularPackage = () => {
    if (selectedModules.length === 0) {
      showToast('⚠️ 請至少勾選一個欲備份的模組');
      return;
    }
    try {
      const timeFilter: BackupTimeFilter = {
        mode: backupTimeMode,
        year: backupTimeMode === 'YEAR' ? backupYear : undefined,
        startDate: backupTimeMode === 'RANGE' ? backupStartDate : undefined,
        endDate: backupTimeMode === 'RANGE' ? backupEndDate : undefined
      };
      const pkg = exportModularBackup(selectedModules, timeFilter);
      const timeSuffix =
        backupTimeMode === 'ALL'
          ? 'all_time'
          : backupTimeMode === 'YEAR'
          ? `year_${backupYear}`
          : `range_${backupStartDate}_to_${backupEndDate}`;
      downloadJsonFile(
        pkg,
        `erp_modular_backup_${selectedModules.join('_').toLowerCase()}_${timeSuffix}_${new Date().toISOString().slice(0, 10)}.json`
      );
      const timeDesc =
        backupTimeMode === 'ALL'
          ? '全部時段'
          : backupTimeMode === 'YEAR'
          ? `${backupYear} 年度`
          : `${backupStartDate} ~ ${backupEndDate}`;
      showToast(`✅ 已成功打包匯出 ${selectedModules.length} 個模組 (${timeDesc}) 資料包，共 ${pkg.recordCount} 筆資料`);
    } catch (e) {
      showToast('❌ 模組打包失敗: ' + (e as Error).message);
    }
  };

  const handleUploadModularPackage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      const pkg: ModularBackupPackage = JSON.parse(content);
      if (!pkg.tables || !pkg.formatVersion) {
        throw new Error('無效的 ERP 模組備份包格式');
      }

      const result = restoreModularBackup(pkg, restoreStrategy);
      setRestoreResult(result);
      if (result.success) {
        showToast(
          `✅ 模組還原成功: 新增 ${result.insertedCount} 筆, 更新 ${result.updatedCount} 筆, 略過 ${result.skippedCount} 筆`
        );
        onReloadLocal();
        onDataChanged();
      } else {
        showToast(`❌ 還原失敗: ${result.message}`);
      }
    } catch (err) {
      showToast('❌ 解析備份檔案失敗: ' + (err as Error).message);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-4 text-xs text-emerald-950 leading-relaxed flex items-start gap-3">
        <Layers className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm text-emerald-950 mb-1">
            模組化可選備份與冪等狀態機還原 (Modular & Idempotent Engine)
          </h4>
          <p className="text-emerald-800/90">
            支援多人分工協同開發與局部測試！可單獨勾選指定模組匯出；還原時採用三柱版本樂觀鎖狀態機（相同版本跳過不重複寫入、新版本自動覆蓋更新），並在還原後自動校準單據流水號計數器。
          </p>
        </div>
      </div>

      {/* 模組勾選與時段篩選清冊 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>備份時段區間 (預設全部歷史，或指定年度/自訂起訖)：</span>
            </span>
            <div className="flex items-center gap-1">
              {(['ALL', 'YEAR', 'RANGE'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBackupTimeMode(mode)}
                  className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                    backupTimeMode === mode
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {mode === 'ALL' ? '全部時段 (不限)' : mode === 'YEAR' ? '指定單一年度' : '自訂日期起訖'}
                </button>
              ))}
            </div>
          </div>

          {backupTimeMode === 'YEAR' && (
            <div className="flex items-center gap-3 pt-1 text-xs border-t border-slate-200/60 mt-1">
              <span className="text-slate-600 font-medium">欲備份年度：</span>
              <select
                value={backupYear}
                onChange={(e) => setBackupYear(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded px-2.5 py-1 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {[2028, 2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020].map(y => (
                  <option key={y} value={y}>{y} 年度</option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500">
                僅封裝 {backupYear} 年度產生之交易單據（專案/報價/採購/計價/財務），基礎主檔與參數自動完整包含。
              </span>
            </div>
          )}

          {backupTimeMode === 'RANGE' && (
            <div className="flex items-center gap-3 pt-1 text-xs border-t border-slate-200/60 mt-1 flex-wrap">
              <span className="text-slate-600 font-medium">日期起訖區間：</span>
              <input
                type="date"
                value={backupStartDate}
                onChange={(e) => setBackupStartDate(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2.5 py-1 font-mono text-xs text-slate-800"
              />
              <span className="text-slate-400">至</span>
              <input
                type="date"
                value={backupEndDate}
                onChange={(e) => setBackupEndDate(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2.5 py-1 font-mono text-xs text-slate-800"
              />
              <span className="text-[11px] text-slate-500">
                支援 5 年期分段備份或特定工期區間封裝。
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">選擇欲備份之模組資料表：</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              已選 {selectedModules.length} / {moduleStats.length} 個模組
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedModules(moduleStats.map(s => s.moduleKey))}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
            >
              全選
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setSelectedModules([])}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
            >
              全不選
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {moduleStats.map(stat => {
            const isSelected = selectedModules.includes(stat.moduleKey);
            return (
              <div
                key={stat.moduleKey}
                onClick={() => toggleSelectModule(stat.moduleKey)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                  isSelected
                    ? 'bg-indigo-50/60 border-indigo-300 text-slate-800 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold flex items-center justify-between">
                    <span className="truncate">{stat.moduleName}</span>
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded ml-1">
                      {stat.totalRecords} 筆
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                    {stat.tables.join(', ')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleExportModularPackage}
            disabled={selectedModules.length === 0}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>打包下載所選模組 JSON 封裝包</span>
          </button>
        </div>
      </div>

      {/* 還原動作區 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Upload className="w-4 h-4 text-slate-600" />
            <span>上傳模組 JSON 包並還原</span>
          </h4>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">重複資料衝突策略：</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="restoreStrategy"
                value="SKIP"
                checked={restoreStrategy === 'SKIP'}
                onChange={() => setRestoreStrategy('SKIP')}
                className="text-indigo-600"
              />
              <span className="font-semibold text-slate-700">自動跳過重複 (Skip)</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer ml-2">
              <input
                type="radio"
                name="restoreStrategy"
                value="UPDATE"
                checked={restoreStrategy === 'UPDATE'}
                onChange={() => setRestoreStrategy('UPDATE')}
                className="text-indigo-600"
              />
              <span className="font-semibold text-slate-700">以備份檔更新 (Update)</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex-1 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20 transition-all flex flex-col items-center justify-center gap-1.5">
            <Upload className="w-6 h-6 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">
              點擊選擇或拖曳模組備份包檔案 (.json) 至此
            </span>
            <span className="text-[10px] text-slate-400">
              系統將自動進行外鍵依賴排序、重複資料指紋比對與流水號自癒校準
            </span>
            <input
              type="file"
              accept=".json"
              onChange={handleUploadModularPackage}
              className="hidden"
            />
          </label>
        </div>

        {restoreResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 ${
              restoreResult.success
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : 'bg-rose-50/80 border-rose-200 text-rose-950'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {restoreResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
              <span>{restoreResult.message}</span>
            </div>
            {restoreResult.details && restoreResult.details.length > 0 && (
              <div className="mt-2 pt-2 border-t border-emerald-200/50 text-[11px] font-mono space-y-1 max-h-32 overflow-y-auto">
                {restoreResult.details.map((d, i) => (
                  <div key={i} className="text-slate-700">{d}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
