import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Save,
  RotateCcw,
  Megaphone,
  Layers,
  Shield,
  Eye,
  Building2,
  Tag,
} from 'lucide-react';
import { getAllAppConfigs, batchUpdateAppConfigs, updateAppConfig } from '../db/sqlite';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialogModal } from './widgets/ConfirmDialogModal';
import { AppBrandingTab } from './settings/app/AppBrandingTab';
import {
  AppAnnouncementTab,
  AppModulesTab,
  AppSystemEnvTab,
} from './settings/app/AppModulesAndSystemTabs';

interface AppSettingsWorkspaceProps {
  onConfigChanged?: () => void;
  triggerToast: (msg: string) => void;
}

const DEFAULT_APP_SETTINGS: Record<string, string> = {
  APP_BRAND_NAME: '田頭',
  APP_SUB_TITLE: '營造工程管理雲',
  APP_SYSTEM_NAME: '田頭營造工程雲端 ERP 整合系統',
  APP_VERSION: 'v2.5.0-PRO',
  APP_HTML_TITLE: '田頭 | 營造工程雲端 ERP 整合系統',
  APP_WELCOME_BANNER: '歡迎登入營造工程 ERP 整合系統，請透過左側選單操作業務功能。',
  APP_FOOTER_COPYRIGHT: '© 2026 營造工程雲端 ERP 整合系統 · 保留所有權利',
  APP_GLOBAL_ANNOUNCEMENT:
    '【系統公告】系統固定於每週日 02:00 ~ 04:00 進行資料庫異地冷備份，期間請勿執行巨量批次寫入。',
  APP_ANNOUNCEMENT_ENABLED: 'false',
  APP_ENABLED_MODULES:
    '["PROJECTS","PARTNERS","QUOTATIONS","PURCHASE_ORDERS","SUBCONTRACTS","VALUATIONS","FINANCE_AP","FINANCE_AR","BANK_CHECKS","VAULT","MINI_APPS"]',
  APP_MAINTENANCE_MODE: 'false',
  APP_LOGO_MODE: 'DEFAULT',
  APP_LOGO_IMAGE_URL: '',
  APP_LOGO_TEXT: '田',
  APP_LOGO_BG: '#4f46e5',
  APP_PRIMARY_COLOR: '#2d3a4b',
  APP_CUSTOMER_BILLING_MODE: 'FINANCE_ONLY',
  APP_TEST_SANDBOX_PUBLIC: 'false',
};

export const AppSettingsWorkspace: React.FC<AppSettingsWorkspaceProps> = ({
  onConfigChanged,
  triggerToast,
}) => {
  const { currentUser, isSuperadmin, isBoss } = useAuth();
  const canControlTestSandbox = isSuperadmin;
  const [formData, setFormData] = useState<Record<string, string>>(DEFAULT_APP_SETTINGS);
  const [activeTab, setActiveTab] = useState<'BRANDING' | 'MODULES' | 'ANNOUNCEMENT' | 'SYSTEM'>(
    'BRANDING'
  );
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const loadConfigs = () => {
    const list = getAllAppConfigs();
    const map: Record<string, string> = {};
    for (const c of list) {
      map[c.configKey] = c.configValue;
    }
    setFormData(prev => ({ ...prev, ...map }));
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const handleInputChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 500) {
      triggerToast('⚠️ 建議 Logo 圖片小於 500KB，避免資料庫快照過大');
    }
    const reader = new FileReader();
    reader.onload = uploadEvent => {
      const dataUrl = uploadEvent.target?.result as string;
      if (dataUrl) {
        setFormData(prev => ({
          ...prev,
          APP_LOGO_IMAGE_URL: dataUrl,
          APP_LOGO_MODE: 'IMAGE',
        }));
        triggerToast('✅ 成功載入企業 Logo 圖檔！按下儲存後即刻全系統生效。');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleToggleTestSandbox = () => {
    if (!canControlTestSandbox) {
      triggerToast('⛔ 權限攔截：僅系統架構師 (Superadmin) 可決定是否開放測試區！');
      return;
    }
    const nextVal = formData.APP_TEST_SANDBOX_PUBLIC === 'true' ? 'false' : 'true';
    const operator = currentUser?.fullName || 'Superadmin';
    updateAppConfig('APP_TEST_SANDBOX_PUBLIC', nextVal, operator);
    setFormData(prev => ({ ...prev, APP_TEST_SANDBOX_PUBLIC: nextVal }));
    triggerToast(
      nextVal === 'true'
        ? '🧪 已開啟「測試區」對全體帳號開放：左側選單已即時對所有啟用帳號顯示測試區。'
        : '🔒 已關閉「測試區」對外開放：現在僅 Superadmin 可見測試區（其餘帳號已隱藏）。'
    );
    if (onConfigChanged) onConfigChanged();
  };

  const handleSaveAll = () => {
    if (!isSuperadmin && !isBoss) {
      triggerToast(
        '⛔ 權限攔截：只有唯一最高管理員 (Superadmin) 或最高統裁 (BOSS) 可修改軟體程式設定！'
      );
      return;
    }

    try {
      const operator = currentUser?.fullName || (isBoss ? 'BOSS 董事長' : 'Superadmin');
      const payload = { ...formData };
      if (!canControlTestSandbox) {
        const currentDbMap = getAllAppConfigs().reduce<Record<string, string>>((acc, c) => {
          acc[c.configKey] = c.configValue;
          return acc;
        }, {});
        payload.APP_TEST_SANDBOX_PUBLIC = currentDbMap.APP_TEST_SANDBOX_PUBLIC ?? 'false';
      }
      batchUpdateAppConfigs(payload, operator);
      loadConfigs();
      if (formData.APP_HTML_TITLE) {
        document.title = formData.APP_HTML_TITLE;
      }
      triggerToast('✅ 軟體程式設定已成功更新並寫入稽核日誌！頂部標題、Logo 與系統環境已即時同步生效。');
      if (onConfigChanged) onConfigChanged();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      triggerToast(`❌ 儲存失敗：${message}`);
    }
  };

  const handleExecuteResetDefaults = () => {
    if (!isSuperadmin && !isBoss) {
      triggerToast('⛔ 權限攔截：只有唯一最高管理員 (Superadmin) 或最高統裁 (BOSS) 可還原預設！');
      setIsResetConfirmOpen(false);
      return;
    }
    try {
      const resetPayload = { ...DEFAULT_APP_SETTINGS };
      if (!canControlTestSandbox) {
        const currentDbMap = getAllAppConfigs().reduce<Record<string, string>>((acc, c) => {
          acc[c.configKey] = c.configValue;
          return acc;
        }, {});
        resetPayload.APP_TEST_SANDBOX_PUBLIC = currentDbMap.APP_TEST_SANDBOX_PUBLIC ?? 'false';
      }
      setFormData(resetPayload);
      batchUpdateAppConfigs(
        resetPayload,
        currentUser?.fullName || (isBoss ? 'BOSS 董事長' : 'Superadmin')
      );
      loadConfigs();
      document.title = DEFAULT_APP_SETTINGS.APP_HTML_TITLE;
      setIsResetConfirmOpen(false);
      triggerToast('🔄 軟體程式設定已成功恢復原廠預設值！');
      if (onConfigChanged) onConfigChanged();
    } catch (e: unknown) {
      setIsResetConfirmOpen(false);
      const message = e instanceof Error ? e.message : String(e);
      triggerToast('重設失敗: ' + message);
    }
  };

  const enabledModules: string[] = (() => {
    try {
      return JSON.parse(formData.APP_ENABLED_MODULES || '[]');
    } catch {
      return [];
    }
  })();

  const toggleModule = (moduleKey: string) => {
    const next = enabledModules.includes(moduleKey)
      ? enabledModules.filter(m => m !== moduleKey)
      : [...enabledModules, moduleKey];
    handleInputChange('APP_ENABLED_MODULES', JSON.stringify(next));
  };

  return (
    <div className="space-y-6">
      {/* 頂部標題列與身分看板 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>軟體程式設定 (App Engine Configs)</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-semibold">
                M13 · Superadmin 專屬
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              此處專責維護「軟體本體」的品牌名稱、版本標記、全域公告、開放業務模組（Feature Flags）等程式層級資訊。與客戶公司營運業務完全解耦，Admin 與一般同仁連看都看不到。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            title="還原原廠初始軟體設定"
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>恢復原廠預設</span>
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>儲存全域軟體設定</span>
          </button>
        </div>
      </div>

      {/* 即時視覺呈現預覽卡片 */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-md border border-slate-800">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            頂部 Header 即時外觀預覽效果 (Live Preview)
          </span>
          <span className="text-[10px] text-slate-500 font-mono">{formData.APP_HTML_TITLE}</span>
        </div>
        <div
          className="rounded-lg p-2.5 flex items-center justify-between border border-slate-700/80 transition-all"
          style={{ backgroundColor: formData.APP_PRIMARY_COLOR || '#2d3a4b' }}
        >
          <div className="flex items-center gap-3">
            {formData.APP_LOGO_MODE === 'IMAGE' && formData.APP_LOGO_IMAGE_URL ? (
              <img
                src={formData.APP_LOGO_IMAGE_URL}
                alt={formData.APP_BRAND_NAME}
                className="h-7 max-w-[120px] object-contain rounded"
              />
            ) : formData.APP_LOGO_MODE === 'TEXT' ? (
              <div
                style={{ backgroundColor: formData.APP_LOGO_BG || '#4f46e5' }}
                className="w-7 h-7 rounded-lg text-white font-bold text-xs flex items-center justify-center shadow-xs border border-white/20 select-none shrink-0"
              >
                {formData.APP_LOGO_TEXT || formData.APP_BRAND_NAME?.slice(0, 1) || '田'}
              </div>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-indigo-600/80 border border-indigo-400/30 text-white flex items-center justify-center shadow-xs shrink-0">
                <Building2 className="w-4 h-4 text-indigo-200" />
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white">
                {formData.APP_BRAND_NAME}
              </span>
              <span className="text-slate-400 font-light text-sm">|</span>
              <span className="font-semibold text-sm text-slate-100">{formData.APP_SUB_TITLE}</span>
              <span className="text-[10px] text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono">
                {formData.APP_VERSION}
              </span>
            </div>
          </div>
          {formData.APP_ANNOUNCEMENT_ENABLED === 'true' && (
            <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/40 text-amber-200 px-3 py-1 rounded text-xs animate-pulse truncate max-w-md">
              <Megaphone className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="truncate">{formData.APP_GLOBAL_ANNOUNCEMENT}</span>
            </div>
          )}
          <div className="text-xs text-slate-300 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-slate-800/80 text-[11px] text-slate-300 border border-slate-700">
              營運法人: [CMP-TW01] 大巨營造
            </span>
          </div>
        </div>
      </div>

      {/* 標籤切換頁 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/70 flex flex-wrap gap-1 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('BRANDING')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'BRANDING'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>軟體品牌名稱與 Logo 識別</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ANNOUNCEMENT')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'ANNOUNCEMENT'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>全域廣播與系統公告</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('MODULES')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'MODULES'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>全系統開放模組授權 (Feature Flags)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SYSTEM')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'SYSTEM'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>維護模式與系統環境</span>
          </button>
        </div>

        {activeTab === 'BRANDING' && (
          <AppBrandingTab
            formData={formData}
            onInputChange={handleInputChange}
            onLogoFileUpload={handleLogoFileUpload}
          />
        )}
        {activeTab === 'ANNOUNCEMENT' && (
          <AppAnnouncementTab formData={formData} onInputChange={handleInputChange} />
        )}
        {activeTab === 'MODULES' && (
          <AppModulesTab
            formData={formData}
            enabledModules={enabledModules}
            onToggleModule={toggleModule}
            onInputChange={handleInputChange}
            canControlTestSandbox={canControlTestSandbox}
            onToggleTestSandbox={handleToggleTestSandbox}
          />
        )}
        {activeTab === 'SYSTEM' && (
          <AppSystemEnvTab
            formData={formData}
            onInputChange={handleInputChange}
            canControlTestSandbox={canControlTestSandbox}
            onToggleTestSandbox={handleToggleTestSandbox}
          />
        )}

        {/* 底部動作列 */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">
            全域軟體設定由資料庫{' '}
            <code className="font-mono text-slate-600 bg-slate-200/70 px-1 py-0.5 rounded">
              app_configs
            </code>{' '}
            管理，變更即刻寫入中文稽核日誌。
          </span>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>儲存全域軟體設定</span>
          </button>
        </div>
      </div>

      <ConfirmDialogModal
        isOpen={isResetConfirmOpen}
        variant="warning"
        title="恢復軟體設定原廠預設值"
        message="確定要將品牌名稱、Logo、系統公告與所有功能開關重設為初始原廠設定嗎？自訂的上傳 Logo 與品牌字串將會被預設值覆蓋。"
        confirmText="確認重設預設"
        onConfirm={handleExecuteResetDefaults}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
};
