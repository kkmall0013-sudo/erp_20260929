import React, { useState, useEffect } from 'react';
import {
  Building2,
  Sliders,
  FileText,
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
  Upload,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  Company,
  SystemConfig,
  DocumentSequence
} from '../types/erp';
import {
  getAllSystemConfigs,
  updateSystemConfig,
  getAllDocumentSequences,
  updateDocumentSequence,
  exportSqlDump,
  exportSqliteBinary
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
  const { currentUser, isSuperadmin, isAdmin, can } = useAuth();
  const canWriteModule = isSuperadmin || can('SYSTEM_CONFIGS', 'write') || Boolean(currentUser?.canManageSystemConfigs);

  // 分頁 Tabs
  const [activeTab, setActiveTab] = useState<'COMPANIES' | 'TAX_REG' | 'CONTRACT' | 'SEQUENCES' | 'DATABASE'>('COMPANIES');

  // 系統參數狀態
  const [systemConfigs, setSystemConfigs] = useState<SystemConfig[]>([]);
  const [editingConfigs, setEditingConfigs] = useState<Record<string, string>>({});

  // 單據跳號規則狀態
  const [docSequences, setDocSequences] = useState<DocumentSequence[]>([]);
  const [editingSequences, setEditingSequences] = useState<Record<string, number>>({});
  const [newPrefix, setNewPrefix] = useState('');
  const [newSeqVal, setNewSeqVal] = useState(1);

  const loadData = () => {
    const cfgs = getAllSystemConfigs();
    setSystemConfigs(cfgs);
    const map: Record<string, string> = {};
    for (const c of cfgs) {
      map[c.id] = c.configValue;
    }
    setEditingConfigs(map);

    const seqs = getAllDocumentSequences();
    setDocSequences(seqs);
    const seqMap: Record<string, number> = {};
    for (const s of seqs) {
      seqMap[s.prefix] = s.currentVal;
    }
    setEditingSequences(seqMap);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = (cfg: SystemConfig) => {
    if (!canWriteModule) {
      triggerToast(`⛔ 權限攔截：您目前的身分（${currentUser?.fullName}）無【全域系統參數】寫入權限！`);
      return;
    }

    try {
      const val = editingConfigs[cfg.id] ?? cfg.configValue;
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

  const handleSaveSequence = (prefix: string) => {
    if (!canWriteModule) {
      triggerToast(`⛔ 權限攔截：無修改單據流水號權限！`);
      return;
    }
    const val = editingSequences[prefix] ?? 1;
    try {
      updateDocumentSequence(prefix, Number(val), currentUser?.fullName || '管理員');
      loadData();
      triggerToast(`✅ 已成功校正前綴 [${prefix}] 單據流水號為 ${val}！`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 更新失敗：${err.message || String(err)}`);
    }
  };

  const handleAddNewSequence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrefix.trim()) {
      triggerToast('請輸入單據前綴代碼！');
      return;
    }
    const cleanPrefix = newPrefix.trim().toUpperCase();
    try {
      updateDocumentSequence(cleanPrefix, Number(newSeqVal), currentUser?.fullName || '管理員');
      setNewPrefix('');
      setNewSeqVal(1);
      loadData();
      triggerToast(`✅ 已新增單據跳號前綴 [${cleanPrefix}] 起始計數器 ${newSeqVal}！`);
      onDataChanged();
    } catch (err: any) {
      triggerToast(`⛔ 新增失敗：${err.message || String(err)}`);
    }
  };

  // 分類參數清單
  const taxConfigs = systemConfigs.filter(c => ['TAX_RATE', 'FIN_TAX_TOLERANCE', 'NHI_RATE'].includes(c.configKey));
  const contractConfigs = systemConfigs.filter(c => ['DEFAULT_RETENTION_RATE', 'PAYMENT_TERM_DAYS', 'WARRANTY_MONTHS', 'PROJECT_LOCK_MODE'].includes(c.configKey));
  const otherConfigs = systemConfigs.filter(c => !taxConfigs.some(t => t.id === c.id) && !contractConfigs.some(ct => ct.id === c.id));

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
                整併「公司主體與法人資訊」、「法定稅率」、「合約慣例」、「單據流水號」與「資料備份」。開台必填，法令或慣例調整時由 Admin 自主維護，無需 Superadmin 修改程式碼。
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
            <span>公司主體與法人資訊</span>
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
            <span>法定稅率與財務控管</span>
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
            <span>合約慣例與工程設定</span>
          </button>

          <button
            onClick={() => setActiveTab('SEQUENCES')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'SEQUENCES'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>單據流水號跳號規則</span>
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
          </button>
        </div>

        {/* 分頁 1：公司主體與法人資訊 (內嵌原 CompanySettingsWorkspace) */}
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

        {/* 分頁 2：法定稅率與財務控管 */}
        {activeTab === 'TAX_REG' && (
          <div className="p-6 space-y-6">
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-sky-900">法定營業稅率與財務公差配置</h3>
                <p className="text-xs text-sky-700 mt-1">
                  法定稅率與發票容許公差由財政部法令規定。修法或政策變更時，由系統管理員 Admin 於此維護即時生效，全系統所有估價、估驗計價、採購單發票稅額計算自動同步。
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {taxConfigs.map(cfg => (
                <div key={cfg.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>生效起日: {cfg.validFrom}</span>
                      {cfg.updatedBy && <span>最後維護者: {cfg.updatedBy}</span>}
                      {cfg.updatedAt && <span>更新時間: {cfg.updatedAt}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingConfigs[cfg.id] ?? cfg.configValue}
                      onChange={(e) => setEditingConfigs(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white w-44 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
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
        )}

        {/* 分頁 3：合約慣例與工程設定 */}
        {activeTab === 'CONTRACT' && (
          <div className="p-6 space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-emerald-900">工程合約慣例與預算內控模式</h3>
                <p className="text-xs text-emerald-700 mt-1">
                  控制營造合約預設保留款比例、標準票期、保固月數與案場預算超支時的防呆鎖定機制。
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {contractConfigs.map(cfg => (
                <div key={cfg.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {cfg.description || cfg.configKey}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {cfg.configKey}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>生效起日: {cfg.validFrom}</span>
                      {cfg.updatedBy && <span>最後維護者: {cfg.updatedBy}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {cfg.configKey === 'PROJECT_LOCK_MODE' ? (
                      <select
                        value={editingConfigs[cfg.id] ?? cfg.configValue}
                        onChange={(e) => setEditingConfigs(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white w-44 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                      >
                        <option value="STRICT">STRICT (嚴格阻擋過帳)</option>
                        <option value="WARN">WARN (黃色警示但放行)</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={editingConfigs[cfg.id] ?? cfg.configValue}
                        onChange={(e) => setEditingConfigs(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white w-44 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    )}
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
        )}

        {/* 分頁 4：單據流水號跳號規則 */}
        {activeTab === 'SEQUENCES' && (
          <div className="p-6 space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Hash className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-amber-900">單據前綴與流水號計數器維護</h3>
                <p className="text-xs text-amber-700 mt-1">
                  管理各模組單據流水號計數器（如採購單 PO、分包合約 SUB、估驗單 VAL、報價單 EST 等）。可在此校正計數器或新增業務前綴。
                </p>
              </div>
            </div>

            {/* 新增前綴表單 */}
            <form onSubmit={handleAddNewSequence} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700">新增前綴:</span>
              <input
                type="text"
                placeholder="例如: INV, PAY, MAT"
                value={newPrefix}
                onChange={(e) => setNewPrefix(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs uppercase font-mono font-bold text-slate-800 bg-white w-36 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <span className="text-xs font-bold text-slate-700">起始計數:</span>
              <input
                type="number"
                min="1"
                value={newSeqVal}
                onChange={(e) => setNewSeqVal(parseInt(e.target.value, 10) || 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white w-24 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                type="submit"
                disabled={!canWriteModule}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新增前綴</span>
              </button>
            </form>

            <div className="divide-y divide-slate-200">
              {docSequences.map(seq => (
                <div key={seq.prefix} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                        {seq.prefix}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        單據前綴 [{seq.prefix}]
                      </span>
                      <span className="text-[11px] text-slate-400">
                        下一筆預覽: <code className="text-indigo-600 font-mono font-bold">{seq.prefix}-{String((editingSequences[seq.prefix] ?? seq.currentVal) + 1).padStart(3, '0')}</code>
                      </span>
                    </div>
                    {seq.updatedAt && (
                      <div className="text-[11px] text-slate-400">
                        最後跳號時間: {seq.updatedAt}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">當前流水號:</span>
                    <input
                      type="number"
                      min="0"
                      value={editingSequences[seq.prefix] ?? seq.currentVal}
                      onChange={(e) => setEditingSequences(prev => ({ ...prev, [seq.prefix]: parseInt(e.target.value, 10) || 0 }))}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white w-28 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button
                      onClick={() => handleSaveSequence(seq.prefix)}
                      disabled={!canWriteModule}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        canWriteModule
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {canWriteModule ? <Save className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>校正</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 分頁 5：資料庫安全與歸檔備份 */}
        {activeTab === 'DATABASE' && (
          <div className="p-6 space-y-6">
            <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold">本地 SQLite 資料庫協作與封存中心</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  IndexedDB Persistent Engine
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                為確保營造公司業務資料之安全性，系統提供免伺服器之純本地 SQLite 備份還原與年度歷史死資料封存。
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {onOpenDatabaseCenter && (
                  <button
                    onClick={onOpenDatabaseCenter}
                    className="p-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-left text-xs font-bold flex flex-col justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Database className="w-4 h-4 text-indigo-200" />
                      <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-mono">推薦</span>
                    </div>
                    <div>
                      <div>歷史封存中心</div>
                      <div className="text-[10px] text-indigo-200 font-normal mt-0.5">模組化備份與年度封存</div>
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
                      <div>匯出 SQL 指令檔</div>
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
                      <div>下載 SQLite 快照</div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">二進位 .sqlite 檔案</div>
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
                      <div>重設出廠預設資料庫</div>
                      <div className="text-[10px] text-rose-300 font-normal mt-0.5">重灌初始業務種子</div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
