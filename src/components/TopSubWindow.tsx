import React, { useState, useRef } from 'react';
import { Company } from '../types/erp';
import {
  Menu,
  Bell,
  Building2,
  KeyRound,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SuperadminRecoveryCenterModal } from './widgets/SuperadminRecoveryCenterModal';
import {
  getAppConfigMap,
  subscribeToDatabase
} from '../db/sqlite';
import {
  BackupFilePreview,
  buildBackupFilePreview,
  executeDatabaseRestoreFile
} from '../utils/sqliteBackupUtils';
import {
  TopChangePasswordModal,
  TopDbQuickMenu,
  TopDbRestoreConfirmModal,
  TopDevAuthModal
} from './shell/TopBarModals';

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
  onImportSql: _onImportSql,
  onResetDatabase,
  onOpenDatabaseCenter
}) => {
  const { currentUser, allUsers, isSuperadmin, isAdmin, isBoss, switchUser } = useAuth();
  const [isDbMenuOpen, setIsDbMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecoveryCenterOpen, setIsRecoveryCenterOpen] = useState(false);
  const [isDevAuthModalOpen, setIsDevAuthModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

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

  const authorizedCompanies = React.useMemo(() => {
    if (!currentUser) return [];
    if (isSuperadmin || isBoss || currentUser.canManageAllCompanies) return companies;
    const allowed =
      currentUser.allowedCompanies && currentUser.allowedCompanies.length > 0
        ? currentUser.allowedCompanies
        : ['COMP-01'];
    return companies.filter(c => allowed.includes(c.id));
  }, [companies, currentUser, isSuperadmin, isBoss]);

  React.useEffect(() => {
    if (!currentUser) return;
    if (authorizedCompanies.length > 0 && !authorizedCompanies.some(c => c.id === selectedCompanyId)) {
      const fallback = authorizedCompanies.find(c => c.id === currentUser.defaultCompanyId) || authorizedCompanies[0];
      if (fallback) {
        onSelectCompany(fallback.id);
      }
    }
  }, [authorizedCompanies, selectedCompanyId, currentUser, onSelectCompany]);

  const [passwordSuccessToast, setPasswordSuccessToast] = useState<string | null>(null);
  const [topRestoreFile, setTopRestoreFile] = useState<File | null>(null);
  const [topRestorePreview, setTopRestorePreview] = useState<BackupFilePreview | null>(null);
  const [isTopRestoring, setIsTopRestoring] = useState(false);
  const [topToast, setTopToast] = useState<string | null>(null);

  const triggerTopToast = (msg: string) => {
    setTopToast(msg);
    setTimeout(() => setTopToast(null), 3500);
  };

  const handleTopFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTopRestoreFile(file);
    setTopRestorePreview(buildBackupFilePreview(file));
    setIsDbMenuOpen(false);
    e.target.value = '';
  };

  const handleExecuteTopRestore = async () => {
    if (!topRestoreFile) return;
    setIsTopRestoring(true);
    try {
      const res = await executeDatabaseRestoreFile(topRestoreFile, currentUser?.fullName || '系統管理者');
      if (res.success) {
        triggerTopToast(`✅ ${res.message}`);
        setTopRestoreFile(null);
        setTopRestorePreview(null);
      } else {
        triggerTopToast(`❌ ${res.message}`);
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".sqlite,.db,.sql"
        onChange={handleTopFileSelect}
        className="hidden"
      />

      {/* 左區：漢堡按鈕 + 動態軟體品牌識別與 Logo */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleLeftNav}
          title="收合 / 展開左側子視窗"
          className="p-1.5 rounded hover:bg-slate-700/70 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

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
              }
            }}
            title={!isSuperadmin ? '系統版本 (點擊驗證身分可切回架構師帳號)' : '系統版本'}
            className="text-[10px] text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono hidden sm:inline cursor-pointer hover:bg-amber-500/30 transition-colors"
          >
            {version}
          </button>
        </div>
      </div>

      {/* 全域公告廣播跑馬燈 */}
      {isAnnouncementEnabled && announcement && (
        <div className="hidden xl:flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-200 px-3 py-1 rounded-full text-xs animate-pulse max-w-sm truncate">
          <span className="font-bold shrink-0">📢</span>
          <span className="truncate">{announcement}</span>
        </div>
      )}

      {/* 中區：常駐法人資訊 */}
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
              onChange={e => onSelectCompany(e.target.value)}
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

      {/* 右區：長駐功能群 */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs text-slate-300">
        {isSuperadmin && (
          <button
            onClick={() => setIsRecoveryCenterOpen(true)}
            title="最高架構師軟刪除救援中心：檢視並救回被軟刪除的進貨單、廠內資產、專案與夥伴，並保留完整日誌軌跡"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-all shadow-xs cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">軟刪除救援中心</span>
          </button>
        )}

        {(isSuperadmin || isBoss || isAdmin) && (
          <TopDbQuickMenu
            isOpen={isDbMenuOpen}
            onToggle={() => setIsDbMenuOpen(prev => !prev)}
            onClose={() => setIsDbMenuOpen(false)}
            onPickRestoreFile={() => fileInputRef.current?.click()}
            onQuickBackupSqlite={onQuickBackupSqlite}
            onQuickBackupSql={onQuickBackupSql}
            onOpenDatabaseCenter={onOpenDatabaseCenter}
            onResetDatabase={onResetDatabase}
          />
        )}

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
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
              currentUser?.role === 'SUPERADMIN'
                ? 'bg-amber-500 shadow-2xs ring-1 ring-amber-300'
                : currentUser?.role === 'BOSS'
                ? 'bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 ring-2 ring-yellow-300 shadow-md'
                : currentUser?.role === 'ADMIN'
                ? 'bg-indigo-600'
                : 'bg-emerald-600'
            }`}
          >
            {currentUser?.role === 'BOSS' ? '👑' : (currentUser?.fullName ? currentUser.fullName.slice(0, 1) : '帳')}
          </div>

          <div className="relative flex items-center gap-1">
            <select
              value={currentUser?.id || ''}
              onChange={e => switchUser(e.target.value)}
              title="切換操作身分 (可實測不同身分權限與畫面過濾)"
              className="bg-slate-800 text-[11px] text-slate-200 border border-slate-700 rounded px-1.5 py-0.5 outline-none cursor-pointer max-w-[115px] sm:max-w-[165px] truncate"
            >
              {allUsers
                .filter(u => u.deleteStage !== 'ARCHIVED' || u.id === currentUser?.id)
                .map(u => {
                  const roleCn =
                    u.role === 'SUPERADMIN'
                      ? '最高架構師'
                      : u.role === 'BOSS'
                      ? '最高統裁 (BOSS)'
                      : u.role === 'ADMIN'
                      ? '管理員'
                      : '同仁';
                  const stageTag =
                    u.deleteStage === 'PENDING_DELETE'
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

          <button
            onClick={() => setIsPasswordModalOpen(true)}
            title="修改自己登入密碼"
            className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline text-[11px]">改密碼</span>
          </button>
        </div>
      </div>

      {passwordSuccessToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-2xl text-xs font-semibold z-50 animate-in fade-in flex items-center gap-2 border border-slate-700">
          <span>{passwordSuccessToast}</span>
        </div>
      )}

      {topToast && (
        <div className="fixed top-14 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold z-50 animate-in fade-in flex items-center gap-2 border border-slate-700">
          <span>{topToast}</span>
        </div>
      )}

      <TopChangePasswordModal
        isOpen={isPasswordModalOpen}
        currentUser={currentUser}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={msg => {
          setPasswordSuccessToast(msg);
          setTimeout(() => setPasswordSuccessToast(null), 3500);
        }}
      />

      <TopDbRestoreConfirmModal
        preview={topRestoreFile ? topRestorePreview : null}
        isRestoring={isTopRestoring}
        onBackupCurrent={handleTopBackupCurrent}
        onCancel={() => {
          setTopRestoreFile(null);
          setTopRestorePreview(null);
        }}
        onConfirmRestore={handleExecuteTopRestore}
      />

      <TopDevAuthModal
        isOpen={isDevAuthModalOpen}
        onClose={() => setIsDevAuthModalOpen(false)}
        onUnlockSuperadmin={() => {
          switchUser('USR-001');
          setIsDevAuthModalOpen(false);
          triggerTopToast('👑 已切換回系統最高架構師 (Superadmin) 權限！');
        }}
      />

      {isSuperadmin && (
        <SuperadminRecoveryCenterModal
          isOpen={isRecoveryCenterOpen}
          onClose={() => setIsRecoveryCenterOpen(false)}
        />
      )}
    </header>
  );
};
