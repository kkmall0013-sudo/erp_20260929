import React, { useState, useEffect } from 'react';
import {
  Building2,
  Sliders,
  DollarSign,
  ShieldCheck,
  Database,
  Layers,
  Truck
} from 'lucide-react';
import {
  Company,
  SystemConfig,
  DocumentSequenceRule,
  DocumentModuleSequenceStatus,
  RegulatorySchedule,
  AnnualArchiveSnapshot,
  CompanyBankAccount
} from '../types/erp';
import {
  getAllSystemConfigs,
  updateSystemConfig,
  getAllDocumentModuleStatuses,
  getAllDocumentSequenceRules,
  getRegulatorySchedules,
  getDatabaseModuleStats,
  getAnnualArchiveSnapshots,
  getAllCompanyBankAccounts
} from '../db/sqlite';
import { useAuth } from '../context/AuthContext';
import { CompanySettingsWorkspace } from './CompanySettingsWorkspace';
import { InternalAssetManagerModal } from './widgets/InternalAssetManagerModal';
import {
  loadStoredInternalAssets,
  InternalAsset
} from '../utils/internalAssetStore';
import { SettingsTaxRegulationsTab } from './settings/SettingsTaxRegulationsTab';
import { SettingsContractDefaultsTab } from './settings/SettingsContractDefaultsTab';
import { SettingsDocumentSequenceTab } from './settings/SettingsDocumentSequenceTab';
import { SettingsDatabaseHubTab } from './settings/SettingsDatabaseHubTab';
import { SettingsInternalAssetsTab } from './settings/SettingsInternalAssetsTab';

interface BasicSettingsHubWorkspaceProps {
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onDataChanged: () => void;
  triggerToast: (msg: string) => void;
  onOpenDatabaseCenter?: () => void;
  onQuickBackupSql?: () => void;
  onQuickBackupSqlite?: () => void;
  onResetDatabase?: () => void;
}

export const BasicSettingsHubWorkspace: React.FC<BasicSettingsHubWorkspaceProps> = ({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onDataChanged,
  triggerToast,
  onOpenDatabaseCenter,
  onQuickBackupSql,
  onQuickBackupSqlite,
  onResetDatabase
}) => {
  const { currentUser, isSuperadmin, isBoss, can } = useAuth();
  const canWriteModule =
    isSuperadmin ||
    isBoss ||
    can('SYSTEM_CONFIGS', 'write') ||
    Boolean(currentUser?.canManageSystemConfigs);

  const [activeTab, setActiveTab] = useState<
    'COMPANIES' | 'TAX_REG' | 'CONTRACT' | 'SEQUENCES' | 'DATABASE' | 'ASSETS'
  >('COMPANIES');

  const [internalAssets, setInternalAssets] = useState<InternalAsset[]>(() =>
    loadStoredInternalAssets()
  );
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);

  const [systemConfigs, setSystemConfigs] = useState<SystemConfig[]>([]);
  const [editingConfigs, setEditingConfigs] = useState<Record<string, string>>({});
  const [schedules, setSchedules] = useState<RegulatorySchedule[]>([]);
  const [moduleStatuses, setModuleStatuses] = useState<DocumentModuleSequenceStatus[]>([]);
  const [sequenceRules, setSequenceRules] = useState<DocumentSequenceRule[]>([]);
  const [moduleStats, setModuleStats] = useState<
    Array<{ moduleKey: string; moduleName: string; tables: string[]; totalRecords: number }>
  >([]);
  const [annualSnapshots, setAnnualSnapshots] = useState<AnnualArchiveSnapshot[]>([]);
  const [hubBankAccounts, setHubBankAccounts] = useState<CompanyBankAccount[]>([]);

  const loadData = () => {
    const cfgs = getAllSystemConfigs();
    setSystemConfigs(cfgs);
    const map: Record<string, string> = {};
    for (const c of cfgs) {
      map[c.id] = c.configValue;
    }
    setEditingConfigs(map);

    setSchedules(getRegulatorySchedules());

    try {
      setModuleStatuses(getAllDocumentModuleStatuses());
      setSequenceRules(getAllDocumentSequenceRules());
    } catch (_) {}

    try {
      setModuleStats(getDatabaseModuleStats());
      setAnnualSnapshots(getAnnualArchiveSnapshots());
    } catch (_) {}

    try {
      setHubBankAccounts(getAllCompanyBankAccounts());
    } catch (_) {}
  };

  useEffect(() => {
    loadData();
  }, []);

  const operatorName = currentUser?.fullName || '系統管理員';

  const handleSaveConfig = (cfg: SystemConfig, overrideVal?: string) => {
    if (!canWriteModule) {
      triggerToast(
        `⛔ 權限攔截：您目前的身分（${currentUser?.fullName}）無【全域系統參數】寫入權限！`
      );
      return;
    }
    if (cfg.configKey === 'BOSS_ACCOUNT_INVOICE_POLICY' && !isSuperadmin) {
      triggerToast('⛔ 權限攔截：此為架構原則開關，僅限 Superadmin（最高架構管理員）切換！');
      return;
    }

    try {
      const val = overrideVal !== undefined ? overrideVal : (editingConfigs[cfg.id] ?? cfg.configValue);
      updateSystemConfig(cfg.id, val, operatorName, canWriteModule);
      loadData();
      triggerToast(`✅ 已成功更新營運法規參數【${cfg.description || cfg.configKey}】！`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 更新失敗：${err.message || String(err)}`);
    }
  };

  const taxConfigs = systemConfigs.filter(c =>
    ['TAX_RATE', 'FIN_TAX_TOLERANCE', 'NHI_RATE', 'MINIMUM_WAGE'].includes(c.configKey)
  );
  const contractConfigs = systemConfigs.filter(c =>
    [
      'DEFAULT_RETENTION_RATE',
      'PAYMENT_TERM_DAYS',
      'PAYMENT_SCHEDULE_DAYS',
      'BOSS_ACCOUNT_INVOICE_POLICY',
      'WARRANTY_MONTHS',
      'PROJECT_LOCK_MODE'
    ].includes(c.configKey)
  );

  return (
    <div className="space-y-6">
      {/* 頂部中樞介紹 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>基本資料營運法規中樞 (Operational Regulations Hub)</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 font-semibold">
                  M12 · Admin 營運設定
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                整併「公司主體與法人資訊」、「法定稅率與最低薪資」、「合約慣例與票期」、「單據跳號防重號」與「歷年資料庫封存安全」。法規變更時由 Admin 自主維護或預約排程，時間一到自動切換，免熬夜修改。
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
              canWriteModule
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {canWriteModule ? '✓ 具備修改維護權限' : '🔒 唯讀模式 (無修改權限)'}
          </span>
        </div>
      </div>

      {/* 分頁標籤列 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/70 flex flex-wrap gap-1 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('COMPANIES')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'COMPANIES'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>營運法人實體</span>
            <span className="text-[10px] bg-slate-200/80 text-slate-600 px-1.5 py-0.2 rounded font-mono">
              {companies.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TAX_REG')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'TAX_REG'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>法定稅率與最低薪資 (排程中心)</span>
            {schedules.filter(s => s.status === 'SCHEDULED').length > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded font-mono font-bold">
                {schedules.filter(s => s.status === 'SCHEDULED').length} 筆排程中
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CONTRACT')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'CONTRACT'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>合約慣例與工程設定 (票期可關)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SEQUENCES')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'SEQUENCES'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>單據編碼與自動產號中樞 (零手動·智能防重)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DATABASE')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'DATABASE'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>資料庫安全與歸檔備份</span>
            {annualSnapshots.length > 0 && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded font-mono">
                {annualSnapshots.length} 年封存
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ASSETS')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'ASSETS'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-emerald-600" />
            <span>廠內資產維護 (動產 · 不動產 · 庫存)</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded font-mono font-bold">
              {internalAssets.filter(a => (a as any).status !== 'RETIRED').length} 在勤 /{' '}
              {internalAssets.filter(a => (a as any).status === 'RETIRED').length} 淘汰
            </span>
          </button>
        </div>

        {/* 分頁 1：營運法人實體 */}
        {activeTab === 'COMPANIES' && (
          <div className="p-4 sm:p-6">
            <CompanySettingsWorkspace
              companies={companies}
              selectedCompanyId={selectedCompanyId}
              onSelectCompany={onSelectCompany}
              onDataChanged={onDataChanged}
            />
          </div>
        )}

        {/* 分頁 2：法定稅率與最低薪資 */}
        {activeTab === 'TAX_REG' && (
          <SettingsTaxRegulationsTab
            taxConfigs={taxConfigs}
            editingConfigs={editingConfigs}
            setEditingConfigs={setEditingConfigs}
            schedules={schedules}
            canWriteModule={canWriteModule}
            operatorName={operatorName}
            onSaveConfig={handleSaveConfig}
            onReloadData={loadData}
            onDataChanged={onDataChanged}
            triggerToast={triggerToast}
          />
        )}

        {/* 分頁 3：合約慣例與工程設定 */}
        {activeTab === 'CONTRACT' && (
          <SettingsContractDefaultsTab
            contractConfigs={contractConfigs}
            editingConfigs={editingConfigs}
            setEditingConfigs={setEditingConfigs}
            canWriteModule={canWriteModule}
            isSuperadmin={isSuperadmin}
            onSaveConfig={handleSaveConfig}
            onGoToCompaniesTab={() => setActiveTab('COMPANIES')}
            triggerToast={triggerToast}
          />
        )}

        {/* 分頁 4：單據編碼與自動產號中樞 */}
        {activeTab === 'SEQUENCES' && (
          <SettingsDocumentSequenceTab
            companies={companies}
            bankAccounts={hubBankAccounts}
            selectedCompanyId={selectedCompanyId}
            sequenceRules={sequenceRules}
            moduleStatuses={moduleStatuses}
            canWriteModule={canWriteModule}
            isSuperadmin={isSuperadmin}
            isBoss={isBoss}
            operatorName={operatorName}
            onReloadData={loadData}
            onDataChanged={onDataChanged}
            triggerToast={triggerToast}
          />
        )}

        {/* 分頁 5：資料庫安全與歸檔備份 */}
        {activeTab === 'DATABASE' && (
          <SettingsDatabaseHubTab
            moduleStats={moduleStats}
            annualSnapshots={annualSnapshots}
            canWriteModule={canWriteModule}
            operatorName={operatorName}
            onReloadData={loadData}
            onDataChanged={onDataChanged}
            triggerToast={triggerToast}
            onOpenDatabaseCenter={onOpenDatabaseCenter}
            onQuickBackupSql={onQuickBackupSql}
            onQuickBackupSqlite={onQuickBackupSqlite}
            onResetDatabase={onResetDatabase}
          />
        )}

        {/* 分頁 6：廠內資產維護 */}
        {activeTab === 'ASSETS' && (
          <SettingsInternalAssetsTab
            internalAssets={internalAssets}
            onOpenAssetModal={() => setIsAssetModalOpen(true)}
          />
        )}
      </div>

      <InternalAssetManagerModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        onAssetsUpdated={() => {
          setInternalAssets(loadStoredInternalAssets());
          triggerToast('✅ 廠內資產與公務車輛資料已成功更新！');
        }}
        triggerToast={triggerToast}
      />
    </div>
  );
};
