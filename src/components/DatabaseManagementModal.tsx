import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  ShieldCheck,
  RefreshCw,
  Layers,
  Archive,
  Search,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  Lock,
  HardDrive,
  Filter,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import {
  exportSqlDump,
  exportSqliteBinary,
  importSql,
  resetToSeedData,
  getDatabaseModuleStats,
  exportModularBackup,
  restoreModularBackup,
  getAnnualArchiveSnapshots,
  createAnnualArchiveSnapshot,
  executeCustomQuery,
  reseedDocumentSequences
} from '../db/sqlite';
import {
  AnnualArchiveSnapshot,
  BackupTimeFilter,
  ModularBackupPackage,
  RestoreResult,
  RestoreStrategy
} from '../types/erp';

interface DatabaseManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
  showToast: (msg: string) => void;
}

type TabType = 'GHOST' | 'MODULAR' | 'ARCHIVE' | 'INSPECTOR';

export const DatabaseManagementModal: React.FC<DatabaseManagementModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('GHOST');

  // 模組狀態
  const [moduleStats, setModuleStats] = useState<ReturnType<typeof getDatabaseModuleStats>>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [restoreStrategy, setRestoreStrategy] = useState<RestoreStrategy>('SKIP');
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);

  // 模組備份時段過濾狀態
  const [backupTimeMode, setBackupTimeMode] = useState<'ALL' | 'YEAR' | 'RANGE'>('ALL');
  const [backupYear, setBackupYear] = useState<number>(new Date().getFullYear());
  const [backupStartDate, setBackupStartDate] = useState<string>(`${new Date().getFullYear()}-01-01`);
  const [backupEndDate, setBackupEndDate] = useState<string>(`${new Date().getFullYear()}-12-31`);

  // 年度封存狀態
  const [archiveSnapshots, setArchiveSnapshots] = useState<AnnualArchiveSnapshot[]>([]);
  const [targetYear, setTargetYear] = useState<number>(new Date().getFullYear() - 1);
  const [archiveDesc, setArchiveDesc] = useState<string>('');
  const [isArchiving, setIsArchiving] = useState(false);

  // SQL 匯入狀態
  const [importSqlText, setImportSqlText] = useState<string>('');

  // 萬能檢視器狀態
  const [inspectorTable, setInspectorTable] = useState<string>('projects');
  const [inspectorSearch, setInspectorSearch] = useState<string>('');
  const [inspectorData, setInspectorData] = useState<{ columns: string[]; values: (string | number | null)[][] }>({
    columns: [],
    values: []
  });

  // 載入資料
  const loadData = () => {
    const stats = getDatabaseModuleStats();
    setModuleStats(stats);
    if (selectedModules.length === 0) {
      setSelectedModules(stats.map(s => s.moduleKey));
    }
    const archives = getAnnualArchiveSnapshots();
    setArchiveSnapshots(archives);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      loadInspectorData(inspectorTable);
    }
  }, [isOpen]);

  // 載入檢視器表格資料
  const loadInspectorData = (tableName: string) => {
    try {
      const res = executeCustomQuery(`SELECT * FROM ${tableName} LIMIT 50;`);
      if (res.length > 0) {
        setInspectorData({
          columns: res[0].columns,
          values: res[0].values
        });
      } else {
        setInspectorData({ columns: [], values: [] });
      }
    } catch (_) {
      setInspectorData({ columns: [], values: [] });
    }
  };

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // A. 全庫 Ghost 備份與還原
  // -------------------------------------------------------------
  const handleExportSql = () => {
    try {
      const sqlContent = exportSqlDump();
      const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `enterprise_erp_ghost_dump_${new Date().toISOString().slice(0, 10)}.sql`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('✅ 已成功匯出全庫 SQL DDL & INSERT 備份指令稿');
    } catch (e) {
      showToast('❌ 匯出失敗: ' + (e as Error).message);
    }
  };

  const handleExportBinary = () => {
    try {
      const binary = exportSqliteBinary();
      const blob = new Blob([binary.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `enterprise_erp_database_${new Date().toISOString().slice(0, 10)}.sqlite`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('✅ 已成功下載 .sqlite 二進位資料庫實體備份檔案');
    } catch (e) {
      showToast('❌ 下載失敗: ' + (e as Error).message);
    }
  };

  const handleExecuteImportSql = () => {
    if (!importSqlText.trim()) {
      showToast('⚠️ 請先貼上或載入 SQL 語法指令');
      return;
    }
    const res = importSql(importSqlText);
    if (res.success) {
      showToast('✅ ' + res.message);
      setImportSqlText('');
      loadData();
      onDataChanged();
    } else {
      showToast('❌ ' + res.message);
    }
  };

  const handleResetSeed = () => {
    if (window.confirm('⚠️ 確定要將資料庫重置為標準營造工程初始種子狀態嗎？目前未備份之測試資料將會被覆蓋！')) {
      resetToSeedData();
      showToast('✅ 資料庫已成功重設為初始標準測試種子狀態！');
      loadData();
      onDataChanged();
    }
  };

  // -------------------------------------------------------------
  // B. 模組化選擇性備份與還原
  // -------------------------------------------------------------
  const toggleSelectModule = (modKey: string) => {
    if (selectedModules.includes(modKey)) {
      setSelectedModules(selectedModules.filter(k => k !== modKey));
    } else {
      setSelectedModules([...selectedModules, modKey]);
    }
  };

  const handleSelectAllModules = () => {
    setSelectedModules(moduleStats.map(s => s.moduleKey));
  };

  const handleDeselectAllModules = () => {
    setSelectedModules([]);
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
      const jsonStr = JSON.stringify(pkg, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timeSuffix = backupTimeMode === 'ALL'
        ? 'all_time'
        : backupTimeMode === 'YEAR'
          ? `year_${backupYear}`
          : `range_${backupStartDate}_to_${backupEndDate}`;
      link.download = `erp_modular_backup_${selectedModules.join('_').toLowerCase()}_${timeSuffix}_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      const timeDesc = backupTimeMode === 'ALL'
        ? '全部時段'
        : backupTimeMode === 'YEAR'
          ? `${backupYear} 年度`
          : `${backupStartDate} ~ ${backupEndDate}`;
      showToast(`✅ 已成功打包匯出 ${selectedModules.length} 個模組 (${timeDesc}) 資料包，共 ${pkg.recordCount} 筆資料`);
    } catch (e) {
      showToast('❌ 模組打包失敗: ' + (e as Error).message);
    }
  };

  const handleUploadModularPackage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const pkg: ModularBackupPackage = JSON.parse(content);
        if (!pkg.tables || !pkg.formatVersion) {
          throw new Error('無效的 ERP 模組備份包格式');
        }

        const result = restoreModularBackup(pkg, restoreStrategy);
        setRestoreResult(result);
        if (result.success) {
          showToast(`✅ 模組還原成功: 新增 ${result.insertedCount} 筆, 更新 ${result.updatedCount} 筆, 略過 ${result.skippedCount} 筆`);
          loadData();
          onDataChanged();
        } else {
          showToast(`❌ 還原失敗: ${result.message}`);
        }
      } catch (err) {
        showToast('❌ 解析備份檔案失敗: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    // 重設 input
    e.target.value = '';
  };

  // -------------------------------------------------------------
  // C. 年度唯讀封存快照
  // -------------------------------------------------------------
  const handleCreateArchive = () => {
    setIsArchiving(true);
    setTimeout(() => {
      const res = createAnnualArchiveSnapshot(
        targetYear,
        archiveDesc || `${targetYear} 年度營造工程完工與財務單據自包含唯讀封存快照`
      );
      setIsArchiving(false);
      if (res.success) {
        showToast(res.message);
        loadData();
        onDataChanged();
        setArchiveDesc('');
      } else {
        showToast(res.message);
      }
    }, 150);
  };

  // -------------------------------------------------------------
  // D. 萬能檢視器搜尋過濾
  // -------------------------------------------------------------
  const filteredInspectorValues = inspectorData.values.filter(row => {
    if (!inspectorSearch.trim()) return true;
    return row.some(cell =>
      String(cell || '').toLowerCase().includes(inspectorSearch.toLowerCase())
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal 頂部 Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                資料庫管理與歷史封存中心
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  SQLite SSoT Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                可攜式備份 · 模組化可選還原 · 年度死資料封存 · 三柱版本防衝突狀態機
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 頁籤切換導航 */}
        <div className="bg-slate-100/80 px-6 border-b border-slate-200 flex items-center gap-2 pt-2 shrink-0">
          <button
            onClick={() => setActiveTab('GHOST')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x ${
              activeTab === 'GHOST'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <HardDrive className="w-4 h-4 text-indigo-500" />
            <span>全庫 Ghost 備份與還原</span>
          </button>

          <button
            onClick={() => setActiveTab('MODULAR')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x ${
              activeTab === 'MODULAR'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>模組化選擇性備份/還原</span>
          </button>

          <button
            onClick={() => setActiveTab('ARCHIVE')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x ${
              activeTab === 'ARCHIVE'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <Archive className="w-4 h-4 text-amber-500" />
            <span>年度唯讀封存快照</span>
            {archiveSnapshots.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                {archiveSnapshots.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('INSPECTOR')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x ${
              activeTab === 'INSPECTOR'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <Search className="w-4 h-4 text-cyan-600" />
            <span>萬能資料庫檢視器</span>
          </button>
        </div>

        {/* 主內容區塊 */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">

          {/* ========================================================= */}
          {/* TAB 1: 全庫 GHOST 模式                                    */}
          {/* ========================================================= */}
          {activeTab === 'GHOST' && (
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

              {/* 匯出卡片 */}
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
                    onClick={handleExportBinary}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <HardDrive className="w-4 h-4" />
                    <span>下載完整 .sqlite 資料庫檔案</span>
                  </button>
                </div>
              </div>

              {/* SQL 還原與種子重設 */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-slate-600" />
                    <h4 className="text-sm font-bold text-slate-800">全庫 SQL 語法還原</h4>
                  </div>
                  <button
                    onClick={handleResetSeed}
                    className="text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>一鍵重設營造工程測試種子庫</span>
                  </button>
                </div>

                <textarea
                  value={importSqlText}
                  onChange={(e) => setImportSqlText(e.target.value)}
                  placeholder="在此貼上 .sql 指令稿文本，點擊下方按鈕即可整庫覆蓋還原..."
                  rows={4}
                  className="w-full font-mono text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleExecuteImportSql}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
                  >
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>執行 SQL 還原資料庫</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: 模組化選擇性備份/還原 (核心升級焦點)                   */}
          {/* ========================================================= */}
          {activeTab === 'MODULAR' && (
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
                
                {/* 備份時段範圍設定 */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>備份時段區間 (預設全部歷史，或指定年度/自訂起訖)：</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setBackupTimeMode('ALL')}
                        className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                          backupTimeMode === 'ALL'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        全部時段 (不限)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBackupTimeMode('YEAR')}
                        className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                          backupTimeMode === 'YEAR'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        指定單一年度
                      </button>
                      <button
                        type="button"
                        onClick={() => setBackupTimeMode('RANGE')}
                        className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                          backupTimeMode === 'RANGE'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        自訂日期起訖
                      </button>
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
                      onClick={handleSelectAllModules}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                    >
                      全選
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={handleDeselectAllModules}
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
                          onChange={() => {}} // 由外層 div 觸發
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

                {/* 備份動作列 */}
                <div className="pt-2 flex justify-end">
                  <button
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
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
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

                {/* 還原結果報表 */}
                {restoreResult && (
                  <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                    restoreResult.success
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50/80 border-rose-200 text-rose-950'
                  }`}>
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
          )}

          {/* ========================================================= */}
          {/* TAB 3: 年度唯讀封存快照 (Annual Archival Snapshots)          */}
          {/* ========================================================= */}
          {activeTab === 'ARCHIVE' && (
            <div className="space-y-6">
              <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-4 text-xs text-amber-950 leading-relaxed flex items-start gap-3">
                <Archive className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-amber-950 mb-1">
                    年度唯讀封存快照 (Annual Archival Snapshots & Self-Contained Views)
                  </h4>
                  <p className="text-amber-800/90">
                    主庫平時累積全部完整活資料；每年底結算完成後，系統產出該年度的「自包含唯讀死資料切片檔」。供三大落地用途：① 免啟動主庫的靜態離線查閱；② 新機遷移時挑選載入近 5~10 年資料；③ 不可篡改之災難救援基底。
                  </p>
                </div>
              </div>

              {/* 產生新年份封存卡片 */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>建立年度唯讀自包含封存快照</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      封存目標年份 (西元年)
                    </label>
                    <select
                      value={targetYear}
                      onChange={(e) => setTargetYear(Number(e.target.value))}
                      className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 bg-white"
                    >
                      {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map(y => (
                        <option key={y} value={y}>{y} 年度 (1/1 ~ 12/31)</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      封存備註說明 (選填)
                    </label>
                    <input
                      type="text"
                      value={archiveDesc}
                      onChange={(e) => setArchiveDesc(e.target.value)}
                      placeholder={`例如：${targetYear} 年度已結案工程與完稅財務憑單全量封存`}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleCreateArchive}
                    disabled={isArchiving}
                    className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
                  >
                    {isArchiving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    <span>{isArchiving ? '封裝處理中...' : `一鍵封裝 ${targetYear} 年度唯讀死資料快照`}</span>
                  </button>
                </div>
              </div>

              {/* 已封存快照清冊 */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center justify-between">
                  <span>歷年已建立之年度封存快照索引 ({archiveSnapshots.length})</span>
                  <span className="text-[11px] font-normal text-slate-400">PRAGMA query_only = ON 唯讀保護</span>
                </h4>

                {archiveSnapshots.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 space-y-2">
                    <Archive className="w-8 h-8 mx-auto text-slate-300" />
                    <p>尚無年度封存快照。您可於上方建立過去年度的自包含切片檔。</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {archiveSnapshots.map(arc => (
                      <div key={arc.id} className="py-3.5 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono">
                              {arc.archiveYear} 年度
                            </span>
                            <span className="text-xs font-semibold text-slate-700">
                              {arc.archiveFileName}
                            </span>
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.2 rounded-full font-bold flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              已唯讀鎖定
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">{arc.description}</p>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-4">
                            <span>自包含記錄: {arc.recordCount} 筆</span>
                            <span>大小: {(arc.fileSizeBytes / 1024).toFixed(1)} KB</span>
                            <span>封存時間: {arc.sealedAt.slice(0, 16).replace('T', ' ')}</span>
                            <span>指紋: {arc.fileHash.slice(0, 20)}...</span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            showToast(`📁 歷史快照「${arc.archiveFileName}」已就緒，可作為離線檢索基底`);
                            setInspectorSearch(String(arc.archiveYear));
                            setActiveTab('INSPECTOR');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-400 text-xs text-slate-700 hover:text-indigo-600 font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>在檢視器開啟</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: 萬能資料庫檢視器 (Universal Data Inspector)           */}
          {/* ========================================================= */}
          {activeTab === 'INSPECTOR' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700">選擇資料表：</span>
                  <select
                    value={inspectorTable}
                    onChange={(e) => {
                      setInspectorTable(e.target.value);
                      loadInspectorData(e.target.value);
                    }}
                    className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="projects">projects (專案主檔)</option>
                    <option value="companies">companies (公司法人實體)</option>
                    <option value="business_partners">business_partners (商業夥伴廠商)</option>
                    <option value="purchase_orders">purchase_orders (採購發包單)</option>
                    <option value="valuations">valuations (估驗計價單)</option>
                    <option value="accounts_payable">accounts_payable (應付帳款)</option>
                    <option value="bank_checks">bank_checks (支票票據)</option>
                    <option value="document_sequences">document_sequences (單據流水號)</option>
                    <option value="annual_archive_snapshots">annual_archive_snapshots (年度封存快照)</option>
                    <option value="system_files">system_files (無紙化附件金庫)</option>
                    <option value="audit_logs">audit_logs (全域操作審計)</option>
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
                    onClick={() => loadInspectorData(inspectorTable)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
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
                        {inspectorData.columns.map((col) => (
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
          )}

        </div>

        {/* Modal 底部 Footer */}
        <div className="bg-slate-100 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>SQLite ACID 事務保證 · SSoT 單一真實來源校準</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            關閉視窗
          </button>
        </div>

      </div>
    </div>
  );
};
