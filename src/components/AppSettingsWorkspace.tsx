import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Sparkles,
  Save,
  RotateCcw,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Megaphone,
  Layers,
  Shield,
  Palette,
  Eye,
  Building,
  Building2,
  Image,
  Upload,
  Type,
  KeyRound,
  FileCode,
  Tag,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { AppConfig } from '../types/erp';
import {
  getAllAppConfigs,
  updateAppConfig,
  batchUpdateAppConfigs
} from '../db/sqlite';
import { useAuth } from '../context/AuthContext';

interface AppSettingsWorkspaceProps {
  onConfigChanged?: () => void;
  triggerToast: (msg: string) => void;
}

const ALL_SYSTEM_MODULE_KEYS = [
  { key: 'PROJECTS', name: '專案案場主檔 (PROJECTS)', desc: '案場預算、合約工程與工區架構' },
  { key: 'PARTNERS', name: '商業夥伴主檔 (PARTNERS)', desc: '業主、下游廠商、協力工班與雙向夥伴' },
  { key: 'QUOTATIONS', name: '報價銷售模組 (QUOTATIONS)', desc: '工程估價單、成本版次與請款合約' },
  { key: 'PURCHASE_ORDERS', name: '採購發包模組 (PURCHASE_ORDERS)', desc: '主料採購單、進場驗收與計價' },
  { key: 'SUBCONTRACTS', name: '分包承攬合約 (SUBCONTRACTS)', desc: '工程主承攬合約、扣款與計價條款' },
  { key: 'VALUATIONS', name: '工程估驗計價 (VALUATIONS)', desc: '累計估驗、保留款扣留與扣款' },
  { key: 'FINANCE_AP', name: '應付帳款 (FINANCE_AP)', desc: '應付帳款沖銷、立帳與付款審核' },
  { key: 'FINANCE_AR', name: '應收帳款 (FINANCE_AR)', desc: '業主估驗應收立帳與收款沖銷' },
  { key: 'BANK_CHECKS', name: '票據管理 (BANK_CHECKS)', desc: '收付應收應付票據、兌現與背書' },
  { key: 'VAULT', name: '檔案金庫與無紙化 (VAULT)', desc: '工程圖說、合約附件與實體 NAS 金庫' },
  { key: 'MINI_APPS', name: '小程式庫 (MINI_APPS)', desc: '工程計算小工具與特用工具集' }
];

export const AppSettingsWorkspace: React.FC<AppSettingsWorkspaceProps> = ({
  onConfigChanged,
  triggerToast
}) => {
  const { currentUser, isSuperadmin, isBoss } = useAuth();
  const [appConfigs, setAppConfigs] = useState<AppConfig[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({
    APP_BRAND_NAME: '田頭',
    APP_SUB_TITLE: '營造工程管理雲',
    APP_SYSTEM_NAME: '田頭營造工程雲端 ERP 整合系統',
    APP_VERSION: 'v2.5.0-PRO',
    APP_HTML_TITLE: '田頭 | 營造工程雲端 ERP 整合系統',
    APP_WELCOME_BANNER: '歡迎登入營造工程 ERP 整合系統，請透過左側選單操作業務功能。',
    APP_FOOTER_COPYRIGHT: '© 2026 營造工程雲端 ERP 整合系統 · 保留所有權利',
    APP_GLOBAL_ANNOUNCEMENT: '【系統公告】系統固定於每週日 02:00 ~ 04:00 進行資料庫異地冷備份，期間請勿執行巨量批次寫入。',
    APP_ANNOUNCEMENT_ENABLED: 'false',
    APP_ENABLED_MODULES: '["PROJECTS","PARTNERS","QUOTATIONS","PURCHASE_ORDERS","SUBCONTRACTS","VALUATIONS","FINANCE_AP","FINANCE_AR","BANK_CHECKS","VAULT","MINI_APPS"]',
    APP_MAINTENANCE_MODE: 'false',
    APP_LOGO_MODE: 'DEFAULT',
    APP_LOGO_IMAGE_URL: '',
    APP_LOGO_TEXT: '田',
    APP_LOGO_BG: '#4f46e5',
    APP_PRIMARY_COLOR: '#2d3a4b'
  });

  const [activeTab, setActiveTab] = useState<'BRANDING' | 'MODULES' | 'ANNOUNCEMENT' | 'SYSTEM'>('BRANDING');

  const loadConfigs = () => {
    const list = getAllAppConfigs();
    setAppConfigs(list);
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
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      if (dataUrl) {
        setFormData(prev => ({
          ...prev,
          APP_LOGO_IMAGE_URL: dataUrl,
          APP_LOGO_MODE: 'IMAGE'
        }));
        triggerToast('✅ 成功載入企業 Logo 圖檔！按下儲存後即刻全系統生效。');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAll = () => {
    if (!isSuperadmin && !isBoss) {
      triggerToast('⛔ 權限攔截：只有唯一最高管理員 (Superadmin) 或最高統裁 (BOSS) 可修改軟體程式設定！');
      return;
    }

    try {
      const operator = currentUser?.fullName || (isBoss ? 'BOSS 董事長' : 'Superadmin');
      batchUpdateAppConfigs(formData, operator);
      loadConfigs();
      if (formData.APP_HTML_TITLE) {
        document.title = formData.APP_HTML_TITLE;
      }
      triggerToast('✅ 軟體程式設定已成功更新並寫入稽核日誌！頂部標題、Logo 與系統環境已即時同步生效。');
      if (onConfigChanged) onConfigChanged();
    } catch (err: any) {
      triggerToast(`❌ 儲存失敗：${err.message || String(err)}`);
    }
  };

  const handleResetDefaults = () => {
    const defaults: Record<string, string> = {
      APP_BRAND_NAME: '田頭',
      APP_SUB_TITLE: '營造工程管理雲',
      APP_SYSTEM_NAME: '田頭營造工程雲端 ERP 整合系統',
      APP_VERSION: 'v2.5.0-PRO',
      APP_HTML_TITLE: '田頭 | 營造工程雲端 ERP 整合系統',
      APP_WELCOME_BANNER: '歡迎登入營造工程 ERP 整合系統，請透過左側選單操作業務功能。',
      APP_FOOTER_COPYRIGHT: '© 2026 營造工程雲端 ERP 整合系統 · 保留所有權利',
      APP_GLOBAL_ANNOUNCEMENT: '【系統公告】系統固定於每週日 02:00 ~ 04:00 進行資料庫異地冷備份，期間請勿執行巨量批次寫入。',
      APP_ANNOUNCEMENT_ENABLED: 'false',
      APP_ENABLED_MODULES: '["PROJECTS","PARTNERS","QUOTATIONS","PURCHASE_ORDERS","SUBCONTRACTS","VALUATIONS","FINANCE_AP","FINANCE_AR","BANK_CHECKS","VAULT","MINI_APPS"]',
      APP_MAINTENANCE_MODE: 'false',
      APP_LOGO_MODE: 'DEFAULT',
      APP_LOGO_IMAGE_URL: '',
      APP_LOGO_TEXT: '田',
      APP_LOGO_BG: '#4f46e5',
      APP_PRIMARY_COLOR: '#2d3a4b'
    };
    setFormData(defaults);
    try {
      batchUpdateAppConfigs(defaults, currentUser?.fullName || 'Superadmin');
      loadConfigs();
      document.title = defaults.APP_HTML_TITLE;
      triggerToast('🔄 軟體程式設定已成功恢復原廠預設值！');
      if (onConfigChanged) onConfigChanged();
    } catch (e: any) {
      triggerToast('重設失敗: ' + e.message);
    }
  };

  // 模組勾選狀態處理
  const enabledModules: string[] = (() => {
    try {
      return JSON.parse(formData.APP_ENABLED_MODULES || '[]');
    } catch {
      return [];
    }
  })();

  const toggleModule = (moduleKey: string) => {
    let next: string[];
    if (enabledModules.includes(moduleKey)) {
      next = enabledModules.filter(m => m !== moduleKey);
    } else {
      next = [...enabledModules, moduleKey];
    }
    handleInputChange('APP_ENABLED_MODULES', JSON.stringify(next));
  };

  return (
    <div className="space-y-6">
      {/* 頂部標題列與身分看板 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
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
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleResetDefaults}
            title="還原原廠初始軟體設定"
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>恢復原廠預設</span>
          </button>
          <button
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
          <span className="text-[10px] text-slate-500 font-mono">
            {formData.APP_HTML_TITLE}
          </span>
        </div>
        <div
          className="rounded-lg p-2.5 flex items-center justify-between border border-slate-700/80 transition-all"
          style={{ backgroundColor: formData.APP_PRIMARY_COLOR || '#2d3a4b' }}
        >
          <div className="flex items-center gap-3">
            {/* 動態 Logo 預覽 */}
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
              <span className="font-bold text-sm tracking-wide text-white">{formData.APP_BRAND_NAME}</span>
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

        {/* 標籤 1：品牌、名稱與 Logo 設定 */}
        {activeTab === 'BRANDING' && (
          <div className="p-6 space-y-6">
            {/* A. 企業 Logo 設定專區 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">企業識別標誌 Logo (APP_LOGO)</h3>
                    <p className="text-[11px] text-slate-500">
                      自訂系統頂端左側顯示之企業 Logo，可選擇預設圖示、上傳/貼入圖片網址，或使用字首圓角徽章。
                    </p>
                  </div>
                </div>

                {/* 模式切換鈕 */}
                <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => handleInputChange('APP_LOGO_MODE', 'DEFAULT')}
                    className={`px-3 py-1 rounded font-semibold transition-all cursor-pointer ${
                      formData.APP_LOGO_MODE === 'DEFAULT'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    預設圖示
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange('APP_LOGO_MODE', 'IMAGE')}
                    className={`px-3 py-1 rounded font-semibold transition-all cursor-pointer ${
                      formData.APP_LOGO_MODE === 'IMAGE'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    圖片 Logo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange('APP_LOGO_MODE', 'TEXT')}
                    className={`px-3 py-1 rounded font-semibold transition-all cursor-pointer ${
                      formData.APP_LOGO_MODE === 'TEXT'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    字首徽章
                  </button>
                </div>
              </div>

              {/* 圖片模式設定 */}
              {formData.APP_LOGO_MODE === 'IMAGE' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/80">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Logo 圖片來源 (網址或本機上傳)</span>
                      <span className="text-[10px] text-slate-400">支援 PNG / SVG / JPG</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formData.APP_LOGO_IMAGE_URL}
                        onChange={(e) => handleInputChange('APP_LOGO_IMAGE_URL', e.target.value)}
                        placeholder="https://... 或點右側按鈕上傳"
                        className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white"
                      />
                      <label className="px-3 py-2 text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>上傳圖檔</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      上傳後將直接轉為離線相容之 Data URL 存入本地 SQLite 資料庫。
                    </p>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500 shrink-0">當前 Logo 預覽：</div>
                    {formData.APP_LOGO_IMAGE_URL ? (
                      <div className="p-1.5 bg-slate-900 rounded flex items-center">
                        <img
                          src={formData.APP_LOGO_IMAGE_URL}
                          alt="Logo Preview"
                          className="h-8 max-w-[140px] object-contain"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">尚未設定圖片</span>
                    )}
                  </div>
                </div>
              )}

              {/* 文字徽章模式設定 */}
              {formData.APP_LOGO_MODE === 'TEXT' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/80">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      徽章字首 (1~2 個字元，例如「田」或「巨」)
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={formData.APP_LOGO_TEXT}
                      onChange={(e) => handleInputChange('APP_LOGO_TEXT', e.target.value)}
                      placeholder="田"
                      className="w-24 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-center text-slate-900 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      徽章底色 (APP_LOGO_BG)
                    </label>
                    <div className="flex items-center gap-2">
                      {['#4f46e5', '#d97706', '#059669', '#0284c7', '#dc2626', '#1e293b'].map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleInputChange('APP_LOGO_BG', color)}
                          style={{ backgroundColor: color }}
                          className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                            formData.APP_LOGO_BG === color ? 'border-white scale-110 shadow-sm ring-2 ring-indigo-500' : 'border-transparent'
                          }`}
                        />
                      ))}
                      <input
                        type="color"
                        value={formData.APP_LOGO_BG || '#4f46e5'}
                        onChange={(e) => handleInputChange('APP_LOGO_BG', e.target.value)}
                        className="w-7 h-7 rounded border border-slate-300 cursor-pointer ml-2"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 預設模式說明 */}
              {formData.APP_LOGO_MODE === 'DEFAULT' && (
                <div className="pt-2 border-t border-slate-200/80 text-xs text-slate-500 flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-indigo-600 text-white flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <span>使用系統內建現代化營造建築圖標作為企業識別。</span>
                </div>
              )}
            </div>

            {/* B. 軟體名稱與品牌變數 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>軟體品牌主名稱 (APP_BRAND_NAME)</span>
                  <span className="text-[10px] text-indigo-600 font-mono">必填</span>
                </label>
                <input
                  type="text"
                  value={formData.APP_BRAND_NAME}
                  onChange={(e) => handleInputChange('APP_BRAND_NAME', e.target.value)}
                  placeholder="例如：田頭、大巨、卓越、工信"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-900 bg-white"
                />
                <p className="text-[11px] text-slate-400">
                  顯示於頂欄最左側的大字主品牌識別（如「田頭」）。
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>軟體副標題／產品代號 (APP_SUB_TITLE)</span>
                  <span className="text-[10px] text-indigo-600 font-mono">必填</span>
                </label>
                <input
                  type="text"
                  value={formData.APP_SUB_TITLE}
                  onChange={(e) => handleInputChange('APP_SUB_TITLE', e.target.value)}
                  placeholder="例如：營造工程管理雲、企業雲端ERP、工程協同雲"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-900 bg-white"
                />
                <p className="text-[11px] text-slate-400">
                  顯示於品牌主名稱右側之產品線說明（如「營造工程管理雲」）。
                </p>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>軟體系統中文完整全稱 (APP_SYSTEM_NAME)</span>
                  <span className="text-[10px] text-indigo-600 font-mono">全域自訂</span>
                </label>
                <input
                  type="text"
                  value={formData.APP_SYSTEM_NAME}
                  onChange={(e) => handleInputChange('APP_SYSTEM_NAME', e.target.value)}
                  placeholder="例如：田頭營造工程雲端 ERP 整合系統"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white"
                />
                <p className="text-[11px] text-slate-400">
                  顯示於報表頁首、正式合約列印及登入說明之企業級完整系統名稱。
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>系統版本號標記 (APP_VERSION)</span>
                  <span className="text-[10px] text-indigo-600 font-mono">必填</span>
                </label>
                <input
                  type="text"
                  value={formData.APP_VERSION}
                  onChange={(e) => handleInputChange('APP_VERSION', e.target.value)}
                  placeholder="例如：v2.5.0-PRO、2026.1"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-bold text-amber-700 bg-white"
                />
                <p className="text-[11px] text-slate-400">
                  顯示於頂欄之發行版次勳章，供版本追蹤與軟體更新對照。
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>瀏覽器分頁標題 (APP_HTML_TITLE)</span>
                  <span className="text-[10px] text-indigo-600 font-mono">即時同步</span>
                </label>
                <input
                  type="text"
                  value={formData.APP_HTML_TITLE}
                  onChange={(e) => handleInputChange('APP_HTML_TITLE', e.target.value)}
                  placeholder="例如：田頭 | 營造工程雲端 ERP 整合系統"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white"
                />
                <p className="text-[11px] text-slate-400">
                  即時同步瀏覽器上方 Tab 分頁之 HTML document.title。
                </p>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-800">
                  頂部導航列主視覺底色 (APP_PRIMARY_COLOR)
                </label>
                <div className="flex items-center gap-3">
                  {['#2d3a4b', '#1e293b', '#0f172a', '#1e1b4b', '#064e3b', '#701a75'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleInputChange('APP_PRIMARY_COLOR', color)}
                      style={{ backgroundColor: color }}
                      className={`w-7 h-7 rounded-lg border-2 transition-all cursor-pointer ${
                        formData.APP_PRIMARY_COLOR === color ? 'border-white ring-2 ring-indigo-500 scale-110 shadow-sm' : 'border-transparent'
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={formData.APP_PRIMARY_COLOR || '#2d3a4b'}
                    onChange={(e) => handleInputChange('APP_PRIMARY_COLOR', e.target.value)}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer ml-2"
                  />
                  <span className="text-xs font-mono text-slate-500">{formData.APP_PRIMARY_COLOR}</span>
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-800">
                  全系統頁腳版權聲明 (APP_FOOTER_COPYRIGHT)
                </label>
                <input
                  type="text"
                  value={formData.APP_FOOTER_COPYRIGHT}
                  onChange={(e) => handleInputChange('APP_FOOTER_COPYRIGHT', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white"
                />
                <p className="text-[11px] text-slate-400">
                  顯示於各列印單據、報表頁尾及登入畫面下方之版權聲明文字。
                </p>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-800">
                  首頁儀表板歡迎標語 (APP_WELCOME_BANNER)
                </label>
                <textarea
                  rows={2}
                  value={formData.APP_WELCOME_BANNER}
                  onChange={(e) => handleInputChange('APP_WELCOME_BANNER', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* 標籤 2：全域廣播與公告 */}
        {activeTab === 'ANNOUNCEMENT' && (
          <div className="p-6 space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Megaphone className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-amber-900">全域緊急廣播功能說明</h3>
                <p className="text-xs text-amber-700 mt-1">
                  當啟用全域廣播跑馬燈時，全系統所有帳號（無論在案場、財務或報價畫面）皆會在頂部 Header 看見緊急廣播提示，可用於通知資料庫冷備份維護、修法停機或重要業務公告。
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <div className="text-xs font-bold text-slate-900">啟用頂部全域公告跑馬燈 (APP_ANNOUNCEMENT_ENABLED)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">關閉時頂部將維持乾淨簡潔，開啟時即時輪播下方公告</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleInputChange('APP_ANNOUNCEMENT_ENABLED', formData.APP_ANNOUNCEMENT_ENABLED === 'true' ? 'false' : 'true')}
                  className="cursor-pointer"
                >
                  {formData.APP_ANNOUNCEMENT_ENABLED === 'true' ? (
                    <ToggleRight className="w-9 h-9 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="w-9 h-9 text-slate-400" />
                  )}
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  全域廣播內容字串 (APP_GLOBAL_ANNOUNCEMENT)
                </label>
                <textarea
                  rows={3}
                  value={formData.APP_GLOBAL_ANNOUNCEMENT}
                  onChange={(e) => handleInputChange('APP_GLOBAL_ANNOUNCEMENT', e.target.value)}
                  placeholder="輸入全系統重要維護或廣播訊息..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* 標籤 3：模組授權開關 (Feature Flags) */}
        {activeTab === 'MODULES' && (
          <div className="p-6 space-y-5">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
              <Layers className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-indigo-900">軟體模組開放授權 (Feature Flags)</h3>
                <p className="text-xs text-indigo-700 mt-1">
                  此處為全系統最高層級的模組授權開關。若 Superadmin 關閉某一模組，則無論個別群組 PBAC 是否授權，全系統皆不會開放該業務模組。可作為模組授權租賃或功能分階段上線之控制依據。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {ALL_SYSTEM_MODULE_KEYS.map(mod => {
                const isEnabled = enabledModules.includes(mod.key);
                return (
                  <div
                    key={mod.key}
                    onClick={() => toggleModule(mod.key)}
                    className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition-all ${
                      isEnabled
                        ? 'bg-indigo-50/50 border-indigo-300 shadow-2xs'
                        : 'bg-slate-50/60 border-slate-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span>{mod.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">{mod.desc}</div>
                    </div>
                    <div className="shrink-0 pt-0.5">
                      {isEnabled ? (
                        <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 標籤 4：維護模式與系統環境 */}
        {activeTab === 'SYSTEM' && (
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <div>
                  <div className="text-xs font-bold text-rose-950 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-rose-600" />
                    <span>全系統維護唯讀模式 (APP_MAINTENANCE_MODE)</span>
                  </div>
                  <div className="text-[11px] text-rose-700 mt-0.5">
                    啟用後，除了 Superadmin 外，所有使用者在系統中僅能查詢檢視，所有寫入與過帳操作皆會受到唯讀阻擋。
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleInputChange('APP_MAINTENANCE_MODE', formData.APP_MAINTENANCE_MODE === 'true' ? 'false' : 'true')}
                  className="cursor-pointer"
                >
                  {formData.APP_MAINTENANCE_MODE === 'true' ? (
                    <ToggleRight className="w-9 h-9 text-rose-600" />
                  ) : (
                    <ToggleLeft className="w-9 h-9 text-slate-400" />
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    頂部 Header 主色碼 (APP_PRIMARY_COLOR)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.APP_PRIMARY_COLOR || '#2d3a4b'}
                      onChange={(e) => handleInputChange('APP_PRIMARY_COLOR', e.target.value)}
                      className="w-10 h-8 rounded border border-slate-300 cursor-pointer p-0.5 bg-white"
                    />
                    <input
                      type="text"
                      value={formData.APP_PRIMARY_COLOR || '#2d3a4b'}
                      onChange={(e) => handleInputChange('APP_PRIMARY_COLOR', e.target.value)}
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-slate-900 bg-white"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    預設為經典深石墨灰 (#2d3a4b)，可依企業形象客製化。
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    標誌顯示模式 (APP_LOGO_MODE)
                  </label>
                  <select
                    value={formData.APP_LOGO_MODE}
                    onChange={(e) => handleInputChange('APP_LOGO_MODE', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white font-semibold cursor-pointer"
                  >
                    <option value="DEFAULT">DEFAULT (文字 + 經典版本標記)</option>
                    <option value="TEXT">TEXT (純文字俐落模式)</option>
                    <option value="CUSTOM">CUSTOM (保留自訂圖章擴充)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 底部動作列 */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">
            全域軟體設定由資料庫 <code className="font-mono text-slate-600 bg-slate-200/70 px-1 py-0.5 rounded">app_configs</code> 管理，變更即刻寫入中文稽核日誌。
          </span>
          <button
            onClick={handleSaveAll}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>儲存全域軟體設定</span>
          </button>
        </div>
      </div>
    </div>
  );
};
