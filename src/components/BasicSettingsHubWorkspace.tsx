import React, { useState, useEffect } from 'react';
import {
  Building2,
  Sliders,
  DollarSign,
  ShieldCheck,
  Save,
  Lock,
  RotateCcw,
  Plus,
  Hash,
  Database,
  HardDrive,
  FileCode,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Clock,
  Trash2,
  Archive,
  Download,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  ExternalLink,
  Info,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Settings2,
  CalendarDays,
  FileCheck2
} from 'lucide-react';
import {
  Company,
  SystemConfig,
  DocumentSequence,
  DocumentSequenceRule,
  DocumentModuleSequenceStatus,
  RegulatorySchedule,
  AnnualArchiveSnapshot
} from '../types/erp';
import {
  getAllSystemConfigs,
  updateSystemConfig,
  getAllDocumentSequences,
  getAllDocumentModuleStatuses,
  getAllDocumentSequenceRules,
  updateDocumentSequenceRule,
  reserveNextMonthSequence,
  autoCalibrateAllDocumentSequences,
  updateDocumentSequence,
  updateNextSequenceNumber,
  autoCalibrateSequence,
  autoCalibrateAllSequences,
  exportSqlDump,
  exportSqliteBinary,
  getRegulatorySchedules,
  createRegulatorySchedule,
  cancelRegulatorySchedule,
  getDatabaseModuleStats,
  getAnnualArchiveSnapshots,
  createAnnualArchiveSnapshot
} from '../db/sqlite';
import { useAuth } from '../context/AuthContext';
import { CompanySettingsWorkspace } from './CompanySettingsWorkspace';

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
  const { currentUser, isSuperadmin, can } = useAuth();
  const canWriteModule = isSuperadmin || can('SYSTEM_CONFIGS', 'write') || Boolean(currentUser?.canManageSystemConfigs);

  // 分頁 Tabs
  const [activeTab, setActiveTab] = useState<'COMPANIES' | 'TAX_REG' | 'CONTRACT' | 'SEQUENCES' | 'DATABASE'>('COMPANIES');

  // 系統參數狀態
  const [systemConfigs, setSystemConfigs] = useState<SystemConfig[]>([]);
  const [editingConfigs, setEditingConfigs] = useState<Record<string, string>>({});

  // 法規生效預約排程狀態
  const [schedules, setSchedules] = useState<RegulatorySchedule[]>([]);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [schedKey, setSchedKey] = useState('MINIMUM_WAGE');
  const [schedVal, setSchedVal] = useState('29500');
  const [schedDate, setSchedDate] = useState('2027-01-01');
  const [schedNotes, setSchedNotes] = useState('2027/01/01 法定最低基本工資調整');

  // 單據編碼與自動產號中樞狀態
  const [docSequences, setDocSequences] = useState<DocumentSequence[]>([]);
  const [editingSequences, setEditingSequences] = useState<Record<string, number>>({});
  const [newPrefix, setNewPrefix] = useState('');
  const [newSeqVal, setNewSeqVal] = useState(1);
  const [moduleStatuses, setModuleStatuses] = useState<DocumentModuleSequenceStatus[]>([]);
  const [sequenceRules, setSequenceRules] = useState<DocumentSequenceRule[]>([]);
  const [sequenceViewMode, setSequenceViewMode] = useState<'MONITOR' | 'RULES'>('MONITOR');
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [editingRule, setEditingRule] = useState<DocumentSequenceRule | null>(null);

  // 資料庫模組統計與年度封存清冊
  const [moduleStats, setModuleStats] = useState<Array<{ moduleKey: string; moduleName: string; tables: string[]; totalRecords: number }>>([]);
  const [annualSnapshots, setAnnualSnapshots] = useState<AnnualArchiveSnapshot[]>([]);
  const [newArchiveYear, setNewArchiveYear] = useState<number>(new Date().getFullYear());
  const [newArchiveDesc, setNewArchiveDesc] = useState<string>('');
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  const loadData = () => {
    // 1. 系統參數
    const cfgs = getAllSystemConfigs();
    setSystemConfigs(cfgs);
    const map: Record<string, string> = {};
    for (const c of cfgs) {
      map[c.id] = c.configValue;
    }
    setEditingConfigs(map);

    // 2. 法規生效排程
    const schedList = getRegulatorySchedules();
    setSchedules(schedList);

    // 3. 單據流水號跳號規則與模組狀態
    try {
      const statuses = getAllDocumentModuleStatuses();
      setModuleStatuses(statuses);
      const rules = getAllDocumentSequenceRules();
      setSequenceRules(rules);
    } catch (_) {}

    const seqs = getAllDocumentSequences();
    setDocSequences(seqs);
    const seqMap: Record<string, number> = {};
    for (const s of seqs) {
      seqMap[s.prefix] = s.nextVal;
    }
    setEditingSequences(seqMap);

    // 4. 資料庫各模組筆數統計與年度封存清冊
    try {
      setModuleStats(getDatabaseModuleStats());
      setAnnualSnapshots(getAnnualArchiveSnapshots());
    } catch (_) {}
  };

  useEffect(() => {
    loadData();
  }, []);

  // 儲存系統參數
  const handleSaveConfig = (cfg: SystemConfig, overrideVal?: string) => {
    if (!canWriteModule) {
      triggerToast(`⛔ 權限攔截：您目前的身分（${currentUser?.fullName}）無【全域系統參數】寫入權限！`);
      return;
    }

    try {
      const val = overrideVal !== undefined ? overrideVal : (editingConfigs[cfg.id] ?? cfg.configValue);
      updateSystemConfig(
        cfg.id,
        val,
        currentUser?.fullName || '管理員',
        canWriteModule
      );
      loadData();
      triggerToast(`✅ 已成功更新營運法規參數【${cfg.description || cfg.configKey}】！`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 更新失敗：${err.message || String(err)}`);
    }
  };

  // 切換請款票期啟用/關閉
  const handleTogglePaymentTerms = (cfg: SystemConfig, turnOff: boolean) => {
    if (!canWriteModule) {
      triggerToast(`⛔ 權限攔截：無修改系統參數權限！`);
      return;
    }
    const newVal = turnOff ? '0' : '30';
    setEditingConfigs(prev => ({ ...prev, [cfg.id]: newVal }));
    handleSaveConfig(cfg, newVal);
  };

  // 新增法規預約排程
  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWriteModule) {
      triggerToast(`⛔ 權限攔截：無維護法規排程權限！`);
      return;
    }
    if (!schedVal.trim() || !schedDate.trim()) {
      triggerToast('請填寫預定數值與生效實施時間！');
      return;
    }

    const labelMap: Record<string, string> = {
      MINIMUM_WAGE: '法定最低月薪基本工資',
      TAX_RATE: '法定營業稅率',
      NHI_RATE: '二代健保補充保費法定扣繳費率',
      FIN_TAX_TOLERANCE: '發票稅額尾差容許值',
      DEFAULT_RETENTION_RATE: '工程估驗預設保留款率',
      PAYMENT_TERM_DAYS: '預設請款票期天數'
    };

    try {
      createRegulatorySchedule({
        configKey: schedKey,
        configLabel: labelMap[schedKey] || schedKey,
        scheduledValue: schedVal.trim(),
        effectiveDate: schedDate.includes(':') ? schedDate : `${schedDate} 00:00:00`,
        notes: schedNotes.trim() || undefined,
        operatorName: currentUser?.fullName || '管理員'
      });
      setIsAddingSchedule(false);
      loadData();
      triggerToast(`✅ 已成功登記【${labelMap[schedKey]}】預定生效排程（生效日：${schedDate}）！系統到期將自動無痛切換。`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 登記排程失敗：${err.message || String(err)}`);
    }
  };

  // 取消法規排程
  const handleCancelSchedule = (id: string) => {
    if (!canWriteModule) {
      triggerToast(`⛔ 權限攔截：無修改排程權限！`);
      return;
    }
    try {
      cancelRegulatorySchedule(id, currentUser?.fullName || '管理員');
      loadData();
      triggerToast('已成功取消該項預約法規排程！');
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 取消失敗：${err.message || String(err)}`);
    }
  };

  // 校正下一個發放流水號
  const handleSaveNextSequence = (seq: DocumentSequence) => {
    if (!canWriteModule) {
      triggerToast(`⛔ 權限攔截：無修改單據流水號權限！`);
      return;
    }
    const val = editingSequences[seq.prefix] ?? seq.nextVal;
    const maxExisting = seq.maxExistingVal || 0;

    // 防回溯鐵律檢核：下一個流水號必須 > 現存最大號
    if (Number(val) <= maxExisting) {
      triggerToast(`⛔ 校正攔截：前綴 [${seq.prefix}] 現存單據已使用至 ${String(maxExisting).padStart(3, '0')} 號，下一個發放流水號不得小於或等於現存最大單號！必須 >= ${maxExisting + 1} 號。`);
      return;
    }

    try {
      updateNextSequenceNumber(seq.prefix, Number(val), currentUser?.fullName || '管理員');
      loadData();
      triggerToast(`✅ 已成功校正前綴 [${seq.prefix}] 下一個發放流水號為 ${val} 號 (即將開出 ${seq.prefix}-${String(val).padStart(3, '0')})！`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 更新失敗：${err.message || String(err)}`);
    }
  };

  // 單項自動校準至現存最大單號 + 1
  const handleAutoCalibrateSingle = (seq: DocumentSequence) => {
    if (!canWriteModule) {
      triggerToast(`⛔ 權限攔截：無校正單據流水號權限！`);
      return;
    }
    try {
      const nextNum = autoCalibrateSequence(seq.prefix, currentUser?.fullName || '管理員');
      loadData();
      triggerToast(`✅ 已自動校準前綴 [${seq.prefix}] 下一個流水號為 ${nextNum} 號！`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 自動校準失敗：${err.message || String(err)}`);
    }
  };

  // 一鍵自動校準全系統所有單據前綴
  const handleAutoCalibrateAll = () => {
    if (!canWriteModule) {
      triggerToast(`⛔ 權限攔截：無校正單據流水號權限！`);
      return;
    }
    try {
      autoCalibrateAllSequences(currentUser?.fullName || '管理員');
      loadData();
      triggerToast(`✅ 全系統單據跳號已自動校準完成！所有前綴均已歸位至「現存最大單號 + 1」。`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 自動校準失敗：${err.message || String(err)}`);
    }
  };

  // 新增單據前綴
  const handleAddNewSequence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrefix.trim()) {
      triggerToast('請輸入單據前綴代碼！');
      return;
    }
    const cleanPrefix = newPrefix.trim().toUpperCase();
    try {
      updateNextSequenceNumber(cleanPrefix, Number(newSeqVal), currentUser?.fullName || '管理員');
      setNewPrefix('');
      setNewSeqVal(1);
      loadData();
      triggerToast(`✅ 已新增單據跳號前綴 [${cleanPrefix}] 下一個發放流水號為 ${newSeqVal} 號！`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 新增失敗：${err.message || String(err)}`);
    }
  };

  // 🔮 預約整備次月起號
  const handleReserveNextMonth = (moduleKey: string) => {
    if (!canWriteModule) {
      triggerToast('⛔ 權限攔截：無預約單據流水號權限！');
      return;
    }
    try {
      const res = reserveNextMonthSequence(moduleKey, currentUser?.fullName || '管理員');
      loadData();
      triggerToast(`✅ ${res.message}`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 預約失敗：${err.message || String(err)}`);
    }
  };

  // ⚡ 全域單號智能巡檢與防撞自癒
  const handleAutoCalibrateAllHub = () => {
    if (!canWriteModule) {
      triggerToast('⛔ 權限攔截：無校正單據流水號權限！');
      return;
    }
    try {
      const res = autoCalibrateAllDocumentSequences(currentUser?.fullName || '管理員');
      loadData();
      triggerToast(`✅ ${res.message}`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 自動校準失敗：${err.message || String(err)}`);
    }
  };

  // 儲存模組編碼規則
  const handleSaveRule = (rule: DocumentSequenceRule) => {
    if (!canWriteModule) {
      triggerToast('⛔ 權限攔截：無修改單據編碼規則權限！');
      return;
    }
    try {
      updateDocumentSequenceRule(rule, currentUser?.fullName || '管理員');
      setEditingRule(null);
      loadData();
      triggerToast(`✅ 已成功儲存【${rule.moduleName}】編碼規則！`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 儲存規則失敗：${err.message || String(err)}`);
    }
  };

  // 切換歷史紀錄展開收折
  const toggleHistoryExpanded = (key: string) => {
    setExpandedHistory(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 建立年度唯讀封存快照
  const handleCreateAnnualArchive = () => {
    if (!canWriteModule) {
      triggerToast('⛔ 權限攔截：無建立年度封存快照權限！');
      return;
    }
    setIsArchiving(true);
    setTimeout(() => {
      try {
        const desc = newArchiveDesc.trim() || `${newArchiveYear} 年度工程單據與財務帳目自包含唯讀封存快照`;
        const res = createAnnualArchiveSnapshot(newArchiveYear, desc, currentUser?.fullName || '管理員');
        setIsArchiving(false);
        if (res.success) {
          triggerToast(`✅ ${res.message}`);
          setNewArchiveDesc('');
          loadData();
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

  // 下載 SQLite 封存快照二進位
  const handleDownloadSnapshotBinary = (snapshot: AnnualArchiveSnapshot) => {
    try {
      const binary = exportSqliteBinary();
      const blob = new Blob([binary.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = snapshot.archiveFileName || `ERP_ARCHIVE_${snapshot.archiveYear}.sqlite`;
      link.click();
      URL.revokeObjectURL(url);
      triggerToast(`✅ 已啟動下載 ${snapshot.archiveFileName}！`);
    } catch (e: any) {
      triggerToast(`⛔ 下載失敗: ${e.message}`);
    }
  };

  // 分類參數清單
  const taxConfigs = systemConfigs.filter(c => ['TAX_RATE', 'FIN_TAX_TOLERANCE', 'NHI_RATE', 'MINIMUM_WAGE'].includes(c.configKey));
  const contractConfigs = systemConfigs.filter(c => ['DEFAULT_RETENTION_RATE', 'PAYMENT_TERM_DAYS', 'WARRANTY_MONTHS', 'PROJECT_LOCK_MODE'].includes(c.configKey));

  return (
    <div className="space-y-6">
      {/* 頂部中樞介紹與分頁導覽 */}
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
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
            canWriteModule
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {canWriteModule ? '✓ 具備修改維護權限' : '🔒 唯讀模式 (無修改權限)'}
          </span>
        </div>
      </div>

      {/* 分頁標籤列 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/70 flex flex-wrap gap-1 px-4 pt-2">
          <button
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
        </div>

        {/* 分頁 1：公司主體與法人資訊 */}
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

        {/* 分頁 2：法定稅率與財務控管（含最低基本工資與預約生效排程中樞） */}
        {activeTab === 'TAX_REG' && (
          <div className="p-6 space-y-8">
            {/* 說明橫幅 */}
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-sky-900">法定營業稅率、健保費率與法定基本薪資規範</h3>
                <p className="text-xs text-sky-700 mt-1">
                  法定稅率、二代健保扣繳率與法定最低工資均受政府法令約束。下方提供「現行有效設定」與「未來預約排程生效中心」。若接獲政府公布新法規（如已公布之 2027/01/01 最低基本工資調升），可事先登記生效時間，當天凌晨系統自動無縫換裝，管理者無須熬夜手動修改。
                </p>
              </div>
            </div>

            {/* 現行生效設定列表 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>目前正在生效之營運法規參數</span>
                </h4>
                <span className="text-[11px] text-slate-400">即時同步於全系統合約、計價與薪資計算</span>
              </div>

              <div className="bg-slate-50/50 rounded-xl border border-slate-200 divide-y divide-slate-200">
                {taxConfigs.map(cfg => (
                  <div key={cfg.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {cfg.description || cfg.configKey}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {cfg.configKey}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          型別: {cfg.valueType} (v{cfg.version})
                        </span>
                        {cfg.configKey === 'MINIMUM_WAGE' && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                            勞基法最低工資
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span>生效起日: {cfg.validFrom}</span>
                        {cfg.updatedBy && <span>最後維護者: {cfg.updatedBy}</span>}
                        {cfg.updatedAt && <span>更新時間: {cfg.updatedAt}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={editingConfigs[cfg.id] ?? cfg.configValue}
                          onChange={(e) => setEditingConfigs(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white w-44 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        {cfg.configKey === 'MINIMUM_WAGE' && (
                          <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-bold">元/月</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleSaveConfig(cfg)}
                        disabled={!canWriteModule}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          canWriteModule
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {canWriteModule ? <Save className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        <span>儲存</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ⏰ 法規預約生效排程中樞 (Scheduled Regulatory Updates) */}
            <div className="border border-indigo-200 bg-indigo-50/30 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>⏰ 法規與稅率預約生效排程中心 (Zero-Touch Scheduled Regulations)</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                      自動切換 · 免熬夜
                    </span>
                  </h4>
                  <p className="text-xs text-indigo-700 mt-1">
                    接獲政府未來法規公告時在此預先輸入實施時間戳記。系統時間一到自動置換為預定新設定，並自動寫入不可竄改稽核記錄。
                  </p>
                </div>

                <button
                  onClick={() => setIsAddingSchedule(!isAddingSchedule)}
                  disabled={!canWriteModule}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingSchedule ? '收合表單' : '新增法規預定排程'}</span>
                </button>
              </div>

              {/* 新增排程表單 */}
              {isAddingSchedule && (
                <form onSubmit={handleCreateSchedule} className="bg-white p-4 rounded-xl border border-indigo-200 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 border-b border-indigo-100 pb-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>預排未來新法規生效項目</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">法規參數項目</label>
                      <select
                        value={schedKey}
                        onChange={(e) => {
                          setSchedKey(e.target.value);
                          if (e.target.value === 'MINIMUM_WAGE') setSchedVal('29500');
                          if (e.target.value === 'TAX_RATE') setSchedVal('0.05');
                          if (e.target.value === 'NHI_RATE') setSchedVal('0.0211');
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="MINIMUM_WAGE">法定最低月薪基本工資 (元)</option>
                        <option value="TAX_RATE">法定營業稅率 (%)</option>
                        <option value="NHI_RATE">二代健保補充保費率 (%)</option>
                        <option value="DEFAULT_RETENTION_RATE">工程估驗預設保留款率 (%)</option>
                        <option value="PAYMENT_TERM_DAYS">預設請款票期 (天)</option>
                        <option value="FIN_TAX_TOLERANCE">發票稅額尾差容許值 (元)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">預定新設定數值</label>
                      <input
                        type="text"
                        value={schedVal}
                        onChange={(e) => setSchedVal(e.target.value)}
                        placeholder="例如: 29500 或 0.05"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">預定生效實施時間 (YYYY-MM-DD)</label>
                      <input
                        type="text"
                        value={schedDate}
                        onChange={(e) => setSchedDate(e.target.value)}
                        placeholder="例如: 2027-01-01"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">備註 / 法規公告依據</label>
                      <input
                        type="text"
                        value={schedNotes}
                        onChange={(e) => setSchedNotes(e.target.value)}
                        placeholder="例如: 勞動部公告 2027 基本工資調升"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingSchedule(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>儲存排程</span>
                    </button>
                  </div>
                </form>
              )}

              {/* 排程清單表格 */}
              <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden shadow-2xs">
                {schedules.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    目前尚未建立預約生效之法規排程。點擊上方「新增法規預定排程」即可預先安排新法規實施。
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-indigo-100/50 text-indigo-950 font-bold border-b border-indigo-200">
                      <tr>
                        <th className="py-2.5 px-4">法規項目</th>
                        <th className="py-2.5 px-4">預定設定值</th>
                        <th className="py-2.5 px-4">預定生效時間</th>
                        <th className="py-2.5 px-4">排程狀態</th>
                        <th className="py-2.5 px-4">備註說明</th>
                        <th className="py-2.5 px-4 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedules.map(sc => (
                        <tr key={sc.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            <div>{sc.configLabel}</div>
                            <div className="font-mono text-[10px] text-slate-400">{sc.configKey}</div>
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">
                            {sc.scheduledValue}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-700 flex items-center gap-1.5 mt-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{sc.effectiveDate}</span>
                          </td>
                          <td className="py-2.5 px-4">
                            {sc.status === 'SCHEDULED' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                <span>排程等待中</span>
                              </span>
                            )}
                            {sc.status === 'APPLIED' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>已自動生效 ({sc.appliedAt?.slice(0, 10)})</span>
                              </span>
                            )}
                            {sc.status === 'CANCELLED' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                <span>已取消</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 text-[11px]">
                            {sc.notes || '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {sc.status === 'SCHEDULED' && canWriteModule && (
                              <button
                                onClick={() => handleCancelSchedule(sc.id)}
                                className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              >
                                取消排程
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 分頁 3：合約慣例與工程設定（含預設請款票期可選關閉） */}
        {activeTab === 'CONTRACT' && (
          <div className="p-6 space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-emerald-900">工程合約慣例與預算內控模式</h3>
                <p className="text-xs text-emerald-700 mt-1">
                  控制營造合約預設保留款比例、工程保固月數、案場超支鎖定，以及請款票期。工程實務中若無票期慣例，可在此一鍵關閉票期（無票期 · 即期付款）。
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {contractConfigs.map(cfg => {
                const isPaymentTerm = cfg.configKey === 'PAYMENT_TERM_DAYS';
                const isLockMode = cfg.configKey === 'PROJECT_LOCK_MODE';
                const currentVal = editingConfigs[cfg.id] ?? cfg.configValue;
                const isTermDisabled = currentVal === '0' || currentVal === 'DISABLED';

                return (
                  <div key={cfg.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {cfg.description || cfg.configKey}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {cfg.configKey}
                        </span>
                        {isPaymentTerm && isTermDisabled && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                            ✓ 票期已關閉（無票期 · 即期付款）
                          </span>
                        )}
                        {isPaymentTerm && !isTermDisabled && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                            ✓ 票期已啟用（{currentVal} 天）
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span>生效起日: {cfg.validFrom}</span>
                        {cfg.updatedBy && <span>最後維護者: {cfg.updatedBy}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPaymentTerm ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTogglePaymentTerms(cfg, !isTermDisabled)}
                            disabled={!canWriteModule}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                              isTermDisabled
                                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {isTermDisabled ? <ToggleLeft className="w-4 h-4 text-amber-600" /> : <ToggleRight className="w-4 h-4 text-emerald-600" />}
                            <span>{isTermDisabled ? '切換為啟用票期' : '一鍵關閉請款票期 (即期)'}</span>
                          </button>

                          {!isTermDisabled && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="1"
                                value={currentVal}
                                onChange={(e) => setEditingConfigs(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white w-24 focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                              <span className="text-xs text-slate-500 font-bold">天</span>
                              <button
                                onClick={() => handleSaveConfig(cfg)}
                                disabled={!canWriteModule}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
                              >
                                儲存
                              </button>
                            </div>
                          )}
                        </div>
                      ) : isLockMode ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={currentVal}
                            onChange={(e) => setEditingConfigs(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white w-44 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                          >
                            <option value="STRICT">STRICT (嚴格阻擋過帳)</option>
                            <option value="WARN">WARN (黃色警示但放行)</option>
                          </select>
                          <button
                            onClick={() => handleSaveConfig(cfg)}
                            disabled={!canWriteModule}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={currentVal}
                            onChange={(e) => setEditingConfigs(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white w-32 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                          <button
                            onClick={() => handleSaveConfig(cfg)}
                            disabled={!canWriteModule}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>儲存</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 分頁 4：單據編碼與自動產號中樞 (零手動 · 智能防撞自癒) */}
        {activeTab === 'SEQUENCES' && (
          <div className="p-6 space-y-6">
            {/* 核心架構原則宣告橫幅 */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-indigo-900/50 shadow-md">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
                      <Sparkles className="w-5 h-5 text-indigo-300" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                        <span>單據編碼與自動產號中樞</span>
                        <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                          全自動循序配號 · 零人為手動干預
                        </span>
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        日常開單由系統依業務規則與當前時間自主配號，徹底杜絕手動跳號紊亂、人為竄改與重號碰撞
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs text-slate-300">
                    <div className="flex items-start gap-2 bg-white/5 rounded-lg p-2.5 border border-white/10">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block font-bold">1. 高可讀性業務編碼</strong>
                        <span>如 <code className="text-amber-300 font-mono">AP-202610-001</code>，一眼辨識業務模組、開單年月與序列號。</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 bg-white/5 rounded-lg p-2.5 border border-white/10">
                      <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block font-bold">2. 歷史過往月份嚴格鎖定</strong>
                        <span>過往月份（如 202603、202604）單據已入帳結算，系統自動封存鎖定，嚴禁回溯開單。</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 bg-white/5 rounded-lg p-2.5 border border-white/10">
                      <CalendarDays className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block font-bold">3. 次月預開單獨立整備</strong>
                        <span>針對下月提早預備開單需求，系統獨立預備次月起號指針，絕不干擾當月作業。</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col items-stretch lg:items-end gap-2.5 shrink-0">
                  {/* 一鍵全域自動安全校準按鈕 */}
                  <button
                    type="button"
                    onClick={handleAutoCalibrateAllHub}
                    disabled={!canWriteModule}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer hover:shadow-lg active:scale-98"
                  >
                    <Zap className="w-4 h-4 text-slate-950 fill-slate-950" />
                    <span>⚡ 全域單號智能巡檢與防撞自癒</span>
                  </button>

                  <div className="text-[11px] text-slate-400 text-right">
                    自動掃描全庫真實單據表記錄，防碰撞指針自動對齊
                  </div>
                </div>
              </div>
            </div>

            {/* 控制列：子頁籤切換 (即時看板 vs 規則自訂) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSequenceViewMode('MONITOR')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    sequenceViewMode === 'MONITOR'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>當期業務模組產號即時看板 (Live Periods)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSequenceViewMode('RULES')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    sequenceViewMode === 'RULES'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>模組編碼規則維護 (Rule Settings)</span>
                </button>
              </div>

              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>系統當前開單期別：<strong>{new Date().getFullYear()} 年 {String(new Date().getMonth() + 1).padStart(2, '0')} 月</strong></span>
              </div>
            </div>

            {/* 視圖 A：當期業務模組產號即時監控看板 (清單列表模式) */}
            {sequenceViewMode === 'MONITOR' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-600" />
                        <span>業務模組產號即時清單 (Live Module Sequences List)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        即時呈現各模組當期最大已開單號、系統下筆自動配發單號、次月整備與歷史歸檔狀態
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
                      共 {moduleStatuses.length} 個業務模組
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                          <th className="p-3.5">業務模組</th>
                          <th className="p-3.5">當期有效期別</th>
                          <th className="p-3.5">本期已開立最大號</th>
                          <th className="p-3.5">下筆系統自動配號</th>
                          <th className="p-3.5">次月預開整備 (Next Month)</th>
                          <th className="p-3.5">歷史已結案月份歸檔</th>
                          <th className="p-3.5">編碼規範</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {moduleStatuses.map(mod => {
                          const isHistoryExpanded = expandedHistory[mod.moduleKey] || false;
                          const hasHistory = mod.historicalPeriods && mod.historicalPeriods.length > 0;

                          return (
                            <React.Fragment key={mod.moduleKey}>
                              <tr className="hover:bg-slate-50/80 transition-colors">
                                {/* 1. 業務模組 */}
                                <td className="p-3.5 align-middle">
                                  <div className="flex items-center gap-2.5">
                                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-800 shrink-0">
                                      {mod.prefix}
                                    </span>
                                    <div>
                                      <div className="font-bold text-slate-900 leading-tight">
                                        {mod.moduleName}
                                      </div>
                                      <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                        {mod.rule.description || '標準營造工程業務單據'}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* 2. 當期有效期間 */}
                                <td className="p-3.5 align-middle">
                                  <div className="space-y-1">
                                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                                      {mod.currentPeriod}
                                    </span>
                                    <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      <span>自動配號中</span>
                                    </div>
                                  </div>
                                </td>

                                {/* 3. 本期已開立最大單號 */}
                                <td className="p-3.5 align-middle font-mono">
                                  {mod.currentPeriodLatestDoc ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-bold">
                                      <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>{mod.currentPeriodLatestDoc}</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic font-sans text-[11px]">
                                      本期尚未開單
                                    </span>
                                  )}
                                </td>

                                {/* 4. 下筆系統自動配發單號 */}
                                <td className="p-3.5 align-middle font-mono">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-xs shadow-2xs">
                                    <Zap className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600 shrink-0" />
                                    <span>{mod.currentPeriodNextDoc}</span>
                                  </span>
                                </td>

                                {/* 5. 次月預開整備 */}
                                <td className="p-3.5 align-middle">
                                  <div className="flex items-center gap-2">
                                    <div className="text-[11px] font-mono">
                                      <span className="text-slate-500 block text-[10px] font-sans">次月預定起號:</span>
                                      <span className="font-bold text-indigo-950">{mod.nextMonthReservedNextDoc}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleReserveNextMonth(mod.moduleKey)}
                                      disabled={!canWriteModule}
                                      title="預先在資料庫登記次月起號指針，防止下月開單重號"
                                      className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold text-[10px] border border-indigo-200 transition-colors cursor-pointer shrink-0"
                                    >
                                      預備起號
                                    </button>
                                  </div>
                                </td>

                                {/* 6. 歷史歸檔月份 */}
                                <td className="p-3.5 align-middle">
                                  {hasHistory ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleHistoryExpanded(mod.moduleKey)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors cursor-pointer"
                                    >
                                      <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>歷史歸檔 ({mod.historicalPeriods.length} 期)</span>
                                      {isHistoryExpanded ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                                    </button>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">無歷史月份</span>
                                  )}
                                </td>

                                {/* 7. 編碼規則規範 */}
                                <td className="p-3.5 align-middle">
                                  <div className="font-mono text-[11px] text-slate-600">
                                    <span>{mod.rule.prefix}{mod.rule.delimiter}{mod.rule.dateFormat}{mod.rule.delimiter}{mod.rule.serialLength}碼</span>
                                    <span className="block font-sans text-[10px] text-slate-400">
                                      {mod.rule.resetFrequency === 'MONTHLY' ? '每月重設' : mod.rule.resetFrequency === 'YEARLY' ? '每年重設' : '永久累計'}
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {/* 展開之歷史月份清單抽屜 */}
                              {isHistoryExpanded && hasHistory && (
                                <tr className="bg-slate-50/80">
                                  <td colSpan={7} className="p-3.5 pl-12 border-t border-slate-200/60">
                                    <div className="bg-white rounded-lg p-3 border border-slate-200 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                                          <span>【{mod.moduleName}】過往歷史月份單據封存清冊 (唯讀鎖定保護，禁止回溯改號)：</span>
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          已於結案時封存
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                                        {mod.historicalPeriods.map(h => (
                                          <div
                                            key={h.period}
                                            className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-xs font-mono"
                                          >
                                            <div>
                                              <span className="font-bold text-slate-800 block">{h.period} 期</span>
                                              <span className="text-[11px] text-slate-600">{h.latestDoc}</span>
                                            </div>
                                            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-sans flex items-center gap-0.5 shrink-0">
                                              <Lock className="w-2.5 h-2.5" /> 鎖定
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 視圖 B：模組編碼規則維護 */}
            {sequenceViewMode === 'RULES' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-indigo-600" />
                        <span>業務模組編碼規則主檔維護 (Rule Configurations)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        自訂各業務別代碼前綴、破折號分隔符、日期格式及流水號碼長（支援即時格式預覽）
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="p-3">模組代號</th>
                          <th className="p-3">業務單據名稱</th>
                          <th className="p-3">前綴 Prefix</th>
                          <th className="p-3">日期格式</th>
                          <th className="p-3">分隔符</th>
                          <th className="p-3">流水號長度</th>
                          <th className="p-3">歸零週期</th>
                          <th className="p-3">格式預覽範例</th>
                          <th className="p-3 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {sequenceRules.map(rule => {
                          const delim = rule.delimiter;
                          const dateSample = rule.dateFormat === 'YYYYMM' ? '202610' : rule.dateFormat === 'YYYY' ? '2026' : rule.dateFormat === 'YYYYMMDD' ? '20261014' : '';
                          const serialSample = String(1).padStart(rule.serialLength, '0');
                          const sample = dateSample ? `${rule.prefix}${delim}${dateSample}${delim}${serialSample}` : `${rule.prefix}${delim}${serialSample}`;

                          return (
                            <tr key={rule.moduleKey} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-mono font-bold text-indigo-900">{rule.moduleKey}</td>
                              <td className="p-3 font-bold text-slate-800">{rule.moduleName}</td>
                              <td className="p-3 font-mono font-bold bg-slate-100 px-2 rounded w-min">{rule.prefix}</td>
                              <td className="p-3 font-mono text-slate-600">{rule.dateFormat}</td>
                              <td className="p-3 font-mono text-slate-600">{rule.delimiter ? `[ ${rule.delimiter} ]` : '無'}</td>
                              <td className="p-3 font-mono text-slate-600">{rule.serialLength} 碼</td>
                              <td className="p-3">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {rule.resetFrequency === 'MONTHLY' ? '每月歸零重設' : rule.resetFrequency === 'YEARLY' ? '每年歸零重設' : '永久累計'}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs">
                                  {sample}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setEditingRule({ ...rule })}
                                  disabled={!canWriteModule}
                                  className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs transition-colors cursor-pointer"
                                >
                                  修改規則
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 彈出式規則編輯對話框 */}
            {editingRule && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
                  <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-5 h-5 text-indigo-400" />
                      <h3 className="font-bold text-sm">自訂單據編碼規則 - 【{editingRule.moduleName}】</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingRule(null)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveRule(editingRule);
                    }}
                    className="p-6 space-y-4 text-xs"
                  >
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">業務前綴代碼 (Prefix):</label>
                      <input
                        type="text"
                        value={editingRule.prefix}
                        onChange={(e) => setEditingRule(prev => prev ? { ...prev, prefix: e.target.value.toUpperCase() } : null)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold uppercase text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">日期格式段:</label>
                        <select
                          value={editingRule.dateFormat}
                          onChange={(e) => setEditingRule(prev => prev ? { ...prev, dateFormat: e.target.value as any } : null)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                        >
                          <option value="YYYYMM">YYYYMM (西元年月份，如 202610)</option>
                          <option value="YYYY">YYYY (西元年份，如 2026)</option>
                          <option value="YYYYMMDD">YYYYMMDD (年月日，如 20261014)</option>
                          <option value="NONE">無日期段 (純前綴)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">分隔符號 (Delimiter):</label>
                        <select
                          value={editingRule.delimiter}
                          onChange={(e) => setEditingRule(prev => prev ? { ...prev, delimiter: e.target.value as any } : null)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                        >
                          <option value="-">破折號 [ - ] (如 AP-202610-001)</option>
                          <option value="">無分隔符 (如 AP202610001)</option>
                          <option value="_">底線 [ _ ] (如 AP_202610_001)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">流水號碼長 (Serial Digits):</label>
                        <select
                          value={editingRule.serialLength}
                          onChange={(e) => setEditingRule(prev => prev ? { ...prev, serialLength: parseInt(e.target.value, 10) } : null)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                        >
                          <option value={2}>2 碼 (如 01 ~ 99)</option>
                          <option value={3}>3 碼 (如 001 ~ 999 - 推薦)</option>
                          <option value={4}>4 碼 (如 0001 ~ 9999)</option>
                          <option value={6}>6 碼 (如 000001 ~ 999999)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">自動歸零重設週期:</label>
                        <select
                          value={editingRule.resetFrequency}
                          onChange={(e) => setEditingRule(prev => prev ? { ...prev, resetFrequency: e.target.value as any } : null)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                        >
                          <option value="MONTHLY">每月歸零重設 (依月份從 001 開始)</option>
                          <option value="YEARLY">每年歸零重設 (跨年從 001 開始)</option>
                          <option value="NEVER">永久不重設 (連續累計)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">單據用途說明:</label>
                      <input
                        type="text"
                        value={editingRule.description || ''}
                        onChange={(e) => setEditingRule(prev => prev ? { ...prev, description: e.target.value } : null)}
                        placeholder="例如: 營造建案工程採購確認單"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    {/* 即時格式預覽卡片 */}
                    <div className="p-3 rounded-xl bg-slate-900 text-white space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold block">即時格式預覽效果 (Live Preview):</span>
                      <div className="font-mono text-sm font-bold text-amber-300 tracking-wider">
                        {(() => {
                          const delim = editingRule.delimiter;
                          const dateSample = editingRule.dateFormat === 'YYYYMM' ? '202610' : editingRule.dateFormat === 'YYYY' ? '2026' : editingRule.dateFormat === 'YYYYMMDD' ? '20261014' : '';
                          const serialSample = String(1).padStart(editingRule.serialLength, '0');
                          return dateSample ? `${editingRule.prefix}${delim}${dateSample}${delim}${serialSample}` : `${editingRule.prefix}${delim}${serialSample}`;
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setEditingRule(null)}
                        className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs"
                      >
                        儲存規則
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 分頁 5：資料庫安全與歸檔備份（完整實體化嵌入面板） */}
        {activeTab === 'DATABASE' && (
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
                {onOpenDatabaseCenter && (
                  <button
                    onClick={onOpenDatabaseCenter}
                    className="p-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-left text-xs font-bold flex flex-col justify-between transition-colors cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Database className="w-4 h-4 text-indigo-200" />
                      <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-mono">完整中心</span>
                    </div>
                    <div>
                      <div>歷史封存與時段備份中心</div>
                      <div className="text-[10px] text-indigo-200 font-normal mt-0.5">彈出完整時段過濾與還原視窗</div>
                    </div>
                  </button>
                )}

                {onQuickBackupSql && (
                  <button
                    onClick={onQuickBackupSql}
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
                )}

                {onQuickBackupSqlite && (
                  <button
                    onClick={onQuickBackupSqlite}
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
                )}

                {onResetDatabase && (
                  <button
                    onClick={onResetDatabase}
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
                )}
              </div>
            </div>

            {/* 實體化內嵌面板 1：全模組資料表健康度與即時筆數卡片 */}
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
                  <div key={stat.moduleKey} className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-indigo-300 transition-colors">
                    <div className="text-[10px] text-slate-400 font-bold truncate">
                      {stat.moduleKey}
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                      {stat.moduleName}
                    </div>
                    <div className="text-lg font-mono font-extrabold text-indigo-600 mt-2">
                      {stat.totalRecords.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">筆</span>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1 truncate">
                      {stat.tables.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 實體化內嵌面板 2：2010～2026 歷年唯讀封存快照清冊 */}
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

                {/* 手動建立年度封存按鈕區 */}
                <div className="flex items-center gap-2">
                  <select
                    value={newArchiveYear}
                    onChange={(e) => setNewArchiveYear(Number(e.target.value))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white"
                  >
                    {Array.from({ length: 17 }, (_, i) => 2010 + i).map(yr => (
                      <option key={yr} value={yr}>{yr} 年度</option>
                    ))}
                  </select>
                  <button
                    onClick={handleCreateAnnualArchive}
                    disabled={isArchiving || !canWriteModule}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>{isArchiving ? '封裝中...' : `封存 ${newArchiveYear} 年度`}</span>
                  </button>
                </div>
              </div>

              {/* 歷年封存表格 */}
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
          </div>
        )}
      </div>
    </div>
  );
};
