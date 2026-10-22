import React, { useState, useRef } from 'react';
import { Company } from '../types/erp';
import {
  Menu,
  Bell,
  MessageSquare,
  Grid,
  ChevronDown,
  Building2,
  Crown,
  Shield,
  User,
  Database,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  FileCode,
  HardDrive,
  KeyRound,
  Eye,
  EyeOff,
  X,
  Check,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  changeSelfPassword,
  getAppConfigMap,
  subscribeToDatabase,
  restoreFromSqliteBinary,
  restoreFromSqlScript,
  exportSqliteBinary
} from '../db/sqlite';

interface TopSubWindowProps {
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onToggleLeftNav: () => void;
  onQuickBackupSql: () => void;
  onQuickBackupSqlite: () => void;
  onImportSql: (sqlText: string) => void;
  onResetDatabase: () => void;
  onOpenDatabaseCenter?: () => void;
}

export const TopSubWindow: React.FC<TopSubWindowProps> = ({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onToggleLeftNav,
  onQuickBackupSql,
  onQuickBackupSqlite,
  onImportSql,
  onResetDatabase,
  onOpenDatabaseCenter,
}) => {
  const { currentUser, allUsers, isSuperadmin, isAdmin, isBoss, switchUser } = useAuth();
  const [isDbMenuOpen, setIsDbMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 系統架構師 (Superadmin) 隱身回歸驗證對話框
  const [isDevAuthModalOpen, setIsDevAuthModalOpen] = useState(false);
  const [devPasswordInput, setDevPasswordInput] = useState('');
  const [devAuthError, setDevAuthError] = useState<string | null>(null);

  // 動態讀取 Superadmin 專屬軟體程式設定 (app_configs)
  const [appConfigMap, setAppConfigMap] = useState<Record<string, string>>({});

  React.useEffect(() => {
    const refreshConfigs = () => {
      try {
        const map = getAppConfigMap();
        setAppConfigMap(map);
        if (map.APP_HTML_TITLE) {
          document.title = map.APP_HTML_TITLE;
        }
      } catch (_) {}
    };
    refreshConfigs();
    const unsub = subscribeToDatabase(refreshConfigs);
    return () => unsub();
  }, []);

  // 依登入者權限精確過濾可見營運法人：
  // 1. Superadmin 與 BOSS (最高統裁) 與具備全集團跨法人管理特許 (canManageAllCompanies) 之老闆/常務管理Admin 可見所有法人
  // 2. 一般 Admin / 一般同仁 僅能看見授權之 allowedCompanies
  // 3. 無權限之法人連看都看不到 (完全自清單中排除)
  const authorizedCompanies = React.useMemo(() => {
    if (!currentUser) return [];
    if (isSuperadmin || isBoss || currentUser.canManageAllCompanies) return companies;
    const allowed = currentUser.allowedCompanies && currentUser.allowedCompanies.length > 0
      ? currentUser.allowedCompanies
      : ['COMP-01'];
    return companies.filter(c => allowed.includes(c.id));
  }, [companies, currentUser, isSuperadmin, isBoss]);

  // 當切換身分或法人名單變更時，若當前選取的法人不在許可名單內，自動安全跳轉至其第一家合法法人
  React.useEffect(() => {
    if (!currentUser) return;
    if (authorizedCompanies.length > 0 && !authorizedCompanies.some(c => c.id === selectedCompanyId)) {
      const fallback = authorizedCompanies.find(c => c.id === currentUser.defaultCompanyId) || authorizedCompanies[0];
      if (fallback) {
        onSelectCompany(fallback.id);
      }
    }
  }, [authorizedCompanies, selectedCompanyId, currentUser, onSelectCompany]);

  // 自主修改密碼對話框狀態
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccessToast, setPasswordSuccessToast] = useState<string | null>(null);

  const handleOpenPasswordModal = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowOldPass(false);
    setShowNewPass(false);
    setPasswordError(null);
    setIsPasswordModalOpen(true);
  };

  const handleSaveMyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!currentUser) return;

    if (!oldPassword.trim()) {
      setPasswordError('請輸入目前原始密碼！');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('新密碼長度至少需為 6 個字元！');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('兩次輸入的新密碼不相符，請再次確認！');
      return;
    }

    try {
      changeSelfPassword(currentUser.id, oldPassword, newPassword, confirmPassword);
      setIsPasswordModalOpen(false);
      setPasswordSuccessToast('🎉 個人密碼已成功更新！');
      setTimeout(() => setPasswordSuccessToast(null), 3500);
    } catch (err: unknown) {
      setPasswordError((err as Error).message);
    }
  };

  // 頂部資料庫全庫上傳還原狀態 (與基本資料完全統一)
  const [topRestoreFile, setTopRestoreFile] = useState<File | null>(null);
  const [topRestorePreview, setTopRestorePreview] = useState<{
    name: string;
    sizeFormatted: string;
    type: 'SQLITE' | 'SQL' | 'UNKNOWN';
  } | null>(null);
  const [isTopRestoring, setIsTopRestoring] = useState(false);
  const [topToast, setTopToast] = useState<string | null>(null);

  const triggerTopToast = (msg: string) => {
    setTopToast(msg);
    setTimeout(() => setTopToast(null), 3500);
  };

  // 處理選取全庫備份檔案 (支援 .sqlite, .db, .sql)
  const handleTopFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeKB = Math.round(file.size / 1024);
    const sizeFormatted = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB} KB`;
    const lowerName = file.name.toLowerCase();
    let fileType: 'SQLITE' | 'SQL' | 'UNKNOWN' = 'UNKNOWN';
    if (lowerName.endsWith('.sqlite') || lowerName.endsWith('.db')) {
      fileType = 'SQLITE';
    } else if (lowerName.endsWith('.sql')) {
      fileType = 'SQL';
    }
    setTopRestoreFile(file);
    setTopRestorePreview({
      name: file.name,
      sizeFormatted,
      type: fileType
    });
    setIsDbMenuOpen(false);
    e.target.value = '';
  };

  const handleExecuteTopRestore = async () => {
    if (!topRestoreFile) return;
    setIsTopRestoring(true);
    try {
      const lowerName = topRestoreFile.name.toLowerCase();
      if (lowerName.endsWith('.sqlite') || lowerName.endsWith('.db')) {
        const buffer = await topRestoreFile.arrayBuffer();
        const res = await restoreFromSqliteBinary(buffer, currentUser?.fullName || '系統管理者');
        if (res.success) {
          triggerTopToast(`✅ ${res.message}`);
          setTopRestoreFile(null);
          setTopRestorePreview(null);
        } else {
          triggerTopToast(`❌ ${res.message}`);
        }
      } else if (lowerName.endsWith('.sql')) {
        const text = await topRestoreFile.text();
        const res = restoreFromSqlScript(text, currentUser?.fullName || '系統管理者');
        if (res.success) {
          triggerTopToast(`✅ ${res.message}`);
          setTopRestoreFile(null);
          setTopRestorePreview(null);
        } else {
          triggerTopToast(`❌ ${res.message}`);
        }
      } else {
        triggerTopToast('❌ 不支援的檔案格式，請上傳 .sqlite 或 .sql 檔案');
      }
    } catch (err: unknown) {
      triggerTopToast(`❌ 還原失敗: ${(err as Error).message}`);
    } finally {
      setIsTopRestoring(false);
    }
  };

  const handleTopBackupCurrent = () => {
    try {
      onQuickBackupSqlite();
      triggerTopToast('✅ 已下載目前資料庫快照防呆！');
    } catch (e: any) {
      triggerTopToast('❌ 備份失敗: ' + (e?.message || String(e)));
    }
  };

  const brandName = appConfigMap.APP_BRAND_NAME || '田頭';
  const subTitle = appConfigMap.APP_SUB_TITLE || '營造工程管理雲';
  const version = appConfigMap.APP_VERSION || 'v2.5.0-PRO';
  const announcement = appConfigMap.APP_GLOBAL_ANNOUNCEMENT || '';
  const isAnnouncementEnabled = appConfigMap.APP_ANNOUNCEMENT_ENABLED === 'true';
  const primaryColor = appConfigMap.APP_PRIMARY_COLOR || '#2d3a4b';
  const logoMode = appConfigMap.APP_LOGO_MODE || 'DEFAULT';
  const logoImageUrl = appConfigMap.APP_LOGO_IMAGE_URL || '';
  const logoText = appConfigMap.APP_LOGO_TEXT || brandName.slice(0, 1) || '田';
  const logoBg = appConfigMap.APP_LOGO_BG || '#4f46e5';

  return (
    <header
      style={{ backgroundColor: primaryColor }}
      className="h-12 text-white flex items-center justify-between px-3 shrink-0 select-none z-30 shadow-xs border-b border-slate-700/60 transition-colors"
    >
      {/* 隱藏的檔案上傳輸入框 (支援 .sqlite, .db, .sql) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".sqlite,.db,.sql"
        onChange={handleTopFileSelect}
        className="hidden"
      />

      {/* 左區：漢堡按鈕 + 動態軟體品牌識別與 Logo (Superadmin app_configs 動態綁定) */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleLeftNav}
          title="收合 / 展開左側子視窗"
          className="p-1.5 rounded hover:bg-slate-700/70 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* 動態企業 Logo (支援自訂圖片 / 自訂字首徽章 / 預設工程圖示) */}
        {logoMode === 'IMAGE' && logoImageUrl ? (
          <img
            src={logoImageUrl}
            alt={brandName}
            className="h-7 max-w-[120px] object-contain rounded"
          />
        ) : logoMode === 'TEXT' ? (
          <div
            style={{ backgroundColor: logoBg }}
            className="w-7 h-7 rounded-lg text-white font-bold text-xs flex items-center justify-center shadow-xs border border-white/20 select-none shrink-0"
          >
            {logoText}
          </div>
        ) : (
          <div className="w-7 h-7 rounded-lg bg-indigo-600/80 border border-indigo-400/30 text-white flex items-center justify-center shadow-xs shrink-0">
            <Building2 className="w-4 h-4 text-indigo-200" />
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-wide text-white">{brandName}</span>
          <span className="text-slate-400 font-light text-sm">|</span>
          <span className="font-semibold text-sm text-slate-100">{subTitle}</span>
          <button
            type="button"
            onClick={() => {
              if (!isSuperadmin) {
                setIsDevAuthModalOpen(true);
                setDevPasswordInput('');
                setDevAuthError(null);
              }
            }}
            title={!isSuperadmin ? "系統版本 (點擊驗證身分可切回架構師帳號)" : "系統版本"}
            className="text-[10px] text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono hidden sm:inline cursor-pointer hover:bg-amber-500/30 transition-colors"
          >
            {version}
          </button>
        </div>
      </div>

      {/* 全域公告廣播跑馬燈 (若 Superadmin 開啟) */}
      {isAnnouncementEnabled && announcement && (
        <div className="hidden xl:flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-200 px-3 py-1 rounded-full text-xs animate-pulse max-w-sm truncate">
          <span className="font-bold shrink-0">📢</span>
          <span className="truncate">{announcement}</span>
        </div>
      )}

      {/* 中區：常駐法人資訊 (僅顯示該帳號有權限之營運法人，其餘無權限法人完全隱藏) */}
      {authorizedCompanies.length > 0 && (
        <div className="hidden md:flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 rounded-full px-3 py-1 text-xs">
          <Building2 className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-slate-400">營運法人：</span>
          {authorizedCompanies.length === 1 ? (
            <span className="text-xs font-semibold text-white tracking-wide">
              [{authorizedCompanies[0].companyCode}] {authorizedCompanies[0].shortName || authorizedCompanies[0].name}
            </span>
          ) : (
            <select
              value={selectedCompanyId}
              onChange={(e) => onSelectCompany(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer pr-1"
            >
              {authorizedCompanies.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-800 text-white">
                  [{c.companyCode}] {c.shortName || c.name} {c.taxId ? `(${c.taxId})` : c.nationalId ? `(${c.nationalId.slice(0, 4)}***)` : ''}
                </option>
              ))}
            </select>
          )}
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      )}

      {/* 右區：長駐功能群 (簡潔專注：一般同仁僅顯示個人身分與必要功能) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs text-slate-300">
        {/* 資料庫匯出/匯入快捷工具 (僅限最高架構師、BOSS與系統管理員) */}
        {(isSuperadmin || isBoss || isAdmin) && (
          <div className="relative">
            <button
              onClick={() => setIsDbMenuOpen(prev => !prev)}
              title="資料庫匯出、匯入與備份管理"
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden lg:inline text-[11px] font-medium">資料庫備份/還原</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isDbMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-84 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2.5 z-50 text-xs animate-in fade-in space-y-1.5">
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px] font-bold text-white tracking-wide">
                      本地 SQLite 資料庫協作與安全中樞
                    </span>
                  </div>
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                    IndexedDB 持久引擎
                  </span>
                </div>

                {/* 1. 全庫檔案一鍵上傳還原 (核心焦點 · 與基本資料完全一致) */}
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="w-full px-2.5 py-2 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700/50 text-left text-indigo-200 flex items-start gap-2.5 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="p-1.5 rounded-md bg-indigo-600 text-white shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    <Upload className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span>全庫檔案一鍵上傳還原</span>
                      <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded font-mono font-bold">
                        極簡秒級
                      </span>
                    </div>
                    <div className="text-[10px] text-indigo-300/80 mt-0.5">
                      支援 .sqlite / .db / .sql · 1 秒覆蓋掛載並自動校準流水號
                    </div>
                  </div>
                </button>

                {/* 2. 下載 SQLite 快照 (.sqlite) */}
                <button
                  onClick={() => {
                    onQuickBackupSqlite();
                    setIsDbMenuOpen(false);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-left text-slate-200 flex items-start gap-2.5 transition-colors cursor-pointer"
                >
                  <HardDrive className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-white">下載 SQLite 快照 (.sqlite)</div>
                    <div className="text-[10px] text-slate-400">二進位實體資料庫檔案 · 完整鏡像</div>
                  </div>
                </button>

                {/* 3. 匯出全庫 SQL 指令稿 (.sql) */}
                <button
                  onClick={() => {
                    onQuickBackupSql();
                    setIsDbMenuOpen(false);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-left text-slate-200 flex items-start gap-2.5 transition-colors cursor-pointer"
                >
                  <FileCode className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-white">匯出全庫 SQL 指令稿 (.sql)</div>
                    <div className="text-[10px] text-slate-400">標準 DDL 與純文字備份 · 跨平台通用</div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-800" />

                {/* 4. 歷史封存與進階管理中心 */}
                {onOpenDatabaseCenter && (
                  <button
                    onClick={() => {
                      onOpenDatabaseCenter();
                      setIsDbMenuOpen(false);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-left text-slate-200 flex items-start gap-2.5 transition-colors cursor-pointer"
                  >
                    <Database className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span>歷史封存與進階管理中心</span>
                        <span className="text-[9px] bg-white/10 text-slate-300 px-1 py-0.2 rounded font-mono">完整彈窗</span>
                      </div>
                      <div className="text-[10px] text-slate-400">時段過濾 · 歷年唯讀封存 · 拖曳還原 · 結構審核</div>
                    </div>
                  </button>
                )}

                {/* 5. 重設出廠預設種子 */}
                <button
                  onClick={() => {
                    onResetDatabase();
                    setIsDbMenuOpen(false);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-rose-950/40 text-left text-rose-300 flex items-start gap-2.5 transition-colors cursor-pointer border-t border-slate-800/80 pt-1.5"
                >
                  <RotateCcw className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-rose-200">重設出廠預設種子</div>
                    <div className="text-[10px] text-rose-300/70">重灌初始業務範例種子</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 系統通知 */}
        <button
          title="系統通知"
          className="relative flex items-center gap-1 p-1 sm:px-2 rounded hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4 text-slate-300" />
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-1 right-1" />
          <span className="hidden xl:inline text-[11px]">通知</span>
        </button>

        {/* 帳號身分切換與個人資訊 */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700 ml-1">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
            currentUser?.role === 'SUPERADMIN'
              ? 'bg-amber-500 shadow-2xs ring-1 ring-amber-300'
              : currentUser?.role === 'BOSS'
              ? 'bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 ring-2 ring-yellow-300 shadow-md'
              : currentUser?.role === 'ADMIN'
              ? 'bg-indigo-600'
              : 'bg-emerald-600'
          }`}>
            {currentUser?.role === 'BOSS' ? '👑' : (currentUser?.fullName ? currentUser.fullName.slice(0, 1) : '帳')}
          </div>

          <div className="relative flex items-center gap-1">
            <select
              value={currentUser?.id || ''}
              onChange={(e) => switchUser(e.target.value)}
              title="切換操作身分 (可實測不同身分權限與畫面過濾)"
              className="bg-slate-800 text-[11px] text-slate-200 border border-slate-700 rounded px-1.5 py-0.5 outline-none cursor-pointer max-w-[115px] sm:max-w-[165px] truncate"
            >
              {allUsers
                .filter(u => u.deleteStage !== 'ARCHIVED' || u.id === currentUser?.id)
                .map(u => {
                  const roleCn = u.role === 'SUPERADMIN'
                    ? '最高架構師'
                    : u.role === 'BOSS'
                    ? '最高統裁 (BOSS)'
                    : u.role === 'ADMIN'
                    ? '管理員'
                    : '同仁';
                  const stageTag = u.deleteStage === 'PENDING_DELETE'
                    ? ' [回收站停權]'
                    : u.status === 'DISABLED'
                    ? ' [已停用]'
                    : '';
                  return (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({roleCn}{stageTag}{u.role === 'SUPERADMIN' ? ' 👑' : ''}{u.role === 'BOSS' ? ' 👑' : ''}{u.role === 'ADMIN' && u.canManageUsers ? ' 🔑' : ''}{u.role === 'ADMIN' && u.canManageSystemConfigs ? ' 🛡️' : ''}{u.role === 'ADMIN' && u.canManageAdmins ? ' ⚡' : ''})
                    </option>
                  );
                })}
            </select>
            {currentUser?.status === 'DISABLED' && (
              <span className="px-1.5 py-0.2 rounded bg-rose-900/90 text-rose-200 border border-rose-700 text-[10px] font-bold whitespace-nowrap">
                已停權封鎖
              </span>
            )}
          </div>

          {/* 修改個人密碼按鈕 */}
          <button
            onClick={handleOpenPasswordModal}
            title="修改自己登入密碼"
            className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline text-[11px]">改密碼</span>
          </button>
        </div>
      </div>

      {/* 修改密碼成功浮動提示 */}
      {passwordSuccessToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-2xl text-xs font-semibold z-50 animate-in fade-in flex items-center gap-2 border border-slate-700">
          <span>{passwordSuccessToast}</span>
        </div>
      )}

      {/* 自主修改個人密碼對話框 (Centered Modal) */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in text-slate-800">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs">修改個人登入密碼</span>
              </div>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMyPassword} className="p-5 space-y-3.5 text-xs">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                <span>當前登入者：</span>
                <span className="font-bold text-slate-900">{currentUser?.fullName} (@{currentUser?.username})</span>
              </div>

              {passwordError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium animate-in fade-in">
                  ❌ {passwordError}
                </div>
              )}

              {/* 原始密碼 */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  目前原始密碼 <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showOldPass ? 'text' : 'password'}
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="請輸入目前密碼"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 pr-8 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showOldPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* 設定新密碼 */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  設定新密碼 (至少 6 位) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="請設定新密碼"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 pr-8 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* 再次確認新密碼 */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  再次確認新密碼 <span className="text-rose-500">*</span>
                </label>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="請再次輸入新密碼"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <span className="text-[10px] text-rose-500 mt-0.5 block">兩次輸入密碼不相符</span>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>確認變更密碼</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🏛️ 全庫資料庫覆蓋還原確認彈窗 (與基本資料完全統一) */}
      {topRestoreFile && topRestorePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden text-slate-900">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">全庫備份檔案一鍵還原確認</h3>
                  <p className="text-[11px] text-slate-400">Direct Full Database Restore</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setTopRestoreFile(null);
                  setTopRestorePreview(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* 檔案資訊預覽 */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  {topRestorePreview.type === 'SQLITE' ? <HardDrive className="w-5 h-5" /> : <FileCode className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 truncate">{topRestorePreview.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold shrink-0 ${
                      topRestorePreview.type === 'SQLITE'
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}>
                      {topRestorePreview.type === 'SQLITE' ? 'SQLite 3 實體二進位庫' : 'SQL 指令稿'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    檔案大小：<span className="font-mono font-bold text-slate-700">{topRestorePreview.sizeFormatted}</span> · 檔案檢查完畢
                  </div>
                </div>
              </div>

              {/* 安全提醒 */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">安全提醒：執行還原將會以所選檔案完全取代目前系統中的所有資料表！</div>
                  <div className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
                    還原完成後系統將自動校準全模組單據流水號計數器，確保後續開單絕不撞號。建議先點擊下方防呆按鈕下載備份。
                  </div>
                </div>
              </div>

              {/* 操作按鈕 */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTopBackupCurrent}
                  className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>還原前先下載當前庫備份防呆 (建議)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTopRestoreFile(null);
                    setTopRestorePreview(null);
                  }}
                  className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleExecuteTopRestore}
                  disabled={isTopRestoring}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{isTopRestoring ? '正在全庫還原中...' : '確認執行全庫覆蓋還原'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 獨立 Toast 提示 */}
      {topToast && (
        <div className="fixed top-14 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold z-50 animate-in fade-in flex items-center gap-2 border border-slate-700">
          <span>{topToast}</span>
        </div>
      )}

      {/* 🔐 架構師 (Superadmin) 隱身回歸驗證對話框 (Developer Secret Switcher) */}
      {isDevAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs animate-in fade-in text-slate-800">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs tracking-wide">系統最高架構師 (Superadmin) 驗證登入</span>
              </div>
              <button
                onClick={() => setIsDevAuthModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                // 驗證碼：架構師預設密碼 888888 或 admin888
                if (devPasswordInput === '888888' || devPasswordInput === 'admin888') {
                  switchUser('USR-001');
                  setIsDevAuthModalOpen(false);
                  triggerTopToast('👑 已切換回系統最高架構師 (Superadmin) 權限！');
                } else {
                  setDevAuthError('驗證碼/密碼錯誤，拒絕存取！');
                }
              }}
              className="p-5 space-y-3.5 text-xs"
            >
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                <div className="font-bold mb-1 flex items-center gap-1 text-amber-800">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>架構師極致隱身防護作用中</span>
                </div>
                依企業最高治理規範，Superadmin 帳號對外完全隱身（清單、選單、統計卡全數隱藏）。請輸入架構師密碼即可切換回最高權杖身分。
              </div>

              {devAuthError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium animate-in fade-in">
                  ❌ {devAuthError}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  架構師密碼 (預設: 888888) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  autoFocus
                  required
                  value={devPasswordInput}
                  onChange={(e) => {
                    setDevPasswordInput(e.target.value);
                    setDevAuthError(null);
                  }}
                  placeholder="請輸入架構師驗證密碼"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDevAuthModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5 text-yellow-200" />
                  <span>解鎖切換</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
