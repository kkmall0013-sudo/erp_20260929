import React from 'react';
import { Building2, Upload } from 'lucide-react';

interface AppBrandingTabProps {
  formData: Record<string, string>;
  onInputChange: (key: string, value: string) => void;
  onLogoFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const AppBrandingTab: React.FC<AppBrandingTabProps> = ({
  formData,
  onInputChange,
  onLogoFileUpload,
}) => {
  return (
    <div className="p-6 space-y-6">
      {/* A. 企業 Logo 設定專區 */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
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

          <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => onInputChange('APP_LOGO_MODE', 'DEFAULT')}
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
              onClick={() => onInputChange('APP_LOGO_MODE', 'IMAGE')}
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
              onClick={() => onInputChange('APP_LOGO_MODE', 'TEXT')}
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
                  onChange={e => onInputChange('APP_LOGO_IMAGE_URL', e.target.value)}
                  placeholder="https://... 或點右側按鈕上傳"
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white"
                />
                <label className="px-3 py-2 text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>上傳圖檔</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onLogoFileUpload}
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
                onChange={e => onInputChange('APP_LOGO_TEXT', e.target.value)}
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
                    onClick={() => onInputChange('APP_LOGO_BG', color)}
                    style={{ backgroundColor: color }}
                    className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                      formData.APP_LOGO_BG === color
                        ? 'border-white scale-110 shadow-sm ring-2 ring-indigo-500'
                        : 'border-transparent'
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={formData.APP_LOGO_BG || '#4f46e5'}
                  onChange={e => onInputChange('APP_LOGO_BG', e.target.value)}
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
            onChange={e => onInputChange('APP_BRAND_NAME', e.target.value)}
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
            onChange={e => onInputChange('APP_SUB_TITLE', e.target.value)}
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
            onChange={e => onInputChange('APP_SYSTEM_NAME', e.target.value)}
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
            onChange={e => onInputChange('APP_VERSION', e.target.value)}
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
            onChange={e => onInputChange('APP_HTML_TITLE', e.target.value)}
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
                onClick={() => onInputChange('APP_PRIMARY_COLOR', color)}
                style={{ backgroundColor: color }}
                className={`w-7 h-7 rounded-lg border-2 transition-all cursor-pointer ${
                  formData.APP_PRIMARY_COLOR === color
                    ? 'border-white ring-2 ring-indigo-500 scale-110 shadow-sm'
                    : 'border-transparent'
                }`}
              />
            ))}
            <input
              type="color"
              value={formData.APP_PRIMARY_COLOR || '#2d3a4b'}
              onChange={e => onInputChange('APP_PRIMARY_COLOR', e.target.value)}
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
            onChange={e => onInputChange('APP_FOOTER_COPYRIGHT', e.target.value)}
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
            onChange={e => onInputChange('APP_WELCOME_BANNER', e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white"
          />
        </div>
      </div>
    </div>
  );
};
