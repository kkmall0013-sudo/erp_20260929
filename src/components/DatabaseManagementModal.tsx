import React, { useState, useEffect } from 'react';
import {
  Database,
  Layers,
  Archive,
  Search,
  FileText,
  X,
  HardDrive,
  ShieldCheck
} from 'lucide-react';
import {
  getDatabaseModuleStats,
  getAnnualArchiveSnapshots,
  executeCustomQuery
} from '../db/sqlite';
import { AnnualArchiveSnapshot } from '../types/erp';
import { DatabaseGhostBackupTab } from './settings/db/DatabaseGhostBackupTab';
import { DatabaseModularPackageTab } from './settings/db/DatabaseModularPackageTab';
import { DatabaseAnnualArchiveTab } from './settings/db/DatabaseAnnualArchiveTab';
import { DatabaseTableInspectorTab } from './settings/db/DatabaseTableInspectorTab';
import { DatabaseSchemaAuditTab } from './settings/db/DatabaseSchemaAuditTab';

interface DatabaseManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
  showToast: (msg: string) => void;
}

type TabType = 'GHOST' | 'MODULAR' | 'ARCHIVE' | 'INSPECTOR' | 'SCHEMA_AUDIT';

export const DatabaseManagementModal: React.FC<DatabaseManagementModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('GHOST');
  const [moduleStats, setModuleStats] = useState<ReturnType<typeof getDatabaseModuleStats>>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [archiveSnapshots, setArchiveSnapshots] = useState<AnnualArchiveSnapshot[]>([]);

  const [inspectorTable, setInspectorTable] = useState<string>('projects');
  const [inspectorSearch, setInspectorSearch] = useState<string>('');
  const [inspectorData, setInspectorData] = useState<{
    columns: string[];
    values: (string | number | null)[][];
  }>({ columns: [], values: [] });

  const loadData = () => {
    const stats = getDatabaseModuleStats();
    setModuleStats(stats);
    if (selectedModules.length === 0) {
      setSelectedModules(stats.map(s => s.moduleKey));
    }
    setArchiveSnapshots(getAnnualArchiveSnapshots());
  };

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

  useEffect(() => {
    if (isOpen) {
      loadData();
      loadInspectorData(inspectorTable);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 頁籤切換導航 */}
        <div className="bg-slate-100/80 px-6 border-b border-slate-200 flex items-center gap-2 pt-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('GHOST')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x cursor-pointer shrink-0 ${
              activeTab === 'GHOST'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <HardDrive className="w-4 h-4 text-indigo-500" />
            <span>全庫 Ghost 備份與還原</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MODULAR')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x cursor-pointer shrink-0 ${
              activeTab === 'MODULAR'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>模組化選擇性備份/還原</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ARCHIVE')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x cursor-pointer shrink-0 ${
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
            type="button"
            onClick={() => setActiveTab('INSPECTOR')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x cursor-pointer shrink-0 ${
              activeTab === 'INSPECTOR'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <Search className="w-4 h-4 text-cyan-600" />
            <span>萬能資料庫檢視器</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SCHEMA_AUDIT')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x cursor-pointer shrink-0 ${
              activeTab === 'SCHEMA_AUDIT'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <FileText className="w-4 h-4 text-purple-600" />
            <span>欄位與用途審核總表</span>
          </button>
        </div>

        {/* 主內容區塊 */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
          {activeTab === 'GHOST' && (
            <DatabaseGhostBackupTab
              onReloadLocal={loadData}
              onDataChanged={onDataChanged}
              showToast={showToast}
            />
          )}

          {activeTab === 'MODULAR' && (
            <DatabaseModularPackageTab
              moduleStats={moduleStats}
              selectedModules={selectedModules}
              setSelectedModules={setSelectedModules}
              onReloadLocal={loadData}
              onDataChanged={onDataChanged}
              showToast={showToast}
            />
          )}

          {activeTab === 'ARCHIVE' && (
            <DatabaseAnnualArchiveTab
              archiveSnapshots={archiveSnapshots}
              onReloadLocal={loadData}
              onDataChanged={onDataChanged}
              showToast={showToast}
              onInspectArchiveYear={(year, fileName) => {
                showToast(`📁 歷史快照「${fileName}」已就緒，可作為離線檢索基底`);
                setInspectorSearch(String(year));
                setActiveTab('INSPECTOR');
              }}
            />
          )}

          {activeTab === 'INSPECTOR' && (
            <DatabaseTableInspectorTab
              inspectorTable={inspectorTable}
              setInspectorTable={setInspectorTable}
              inspectorSearch={inspectorSearch}
              setInspectorSearch={setInspectorSearch}
              inspectorData={inspectorData}
              onReloadTable={loadInspectorData}
            />
          )}

          {activeTab === 'SCHEMA_AUDIT' && <DatabaseSchemaAuditTab />}
        </div>

        {/* Modal 底部 Footer */}
        <div className="bg-slate-100 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>SQLite ACID 事務保證 · SSoT 單一真實來源校準</span>
          </div>
          <button
            type="button"
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
