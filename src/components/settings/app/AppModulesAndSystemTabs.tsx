import React from 'react';
import {
  CheckCircle2,
  Layers,
  Megaphone,
  Shield,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
  FlaskConical,
} from 'lucide-react';

export const ALL_SYSTEM_MODULE_KEYS = [
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
  { key: 'MINI_APPS', name: '小程式庫 (MINI_APPS)', desc: '工程計算小工具與特用工具集' },
];

interface TabProps {
  formData: Record<string, string>;
  onInputChange: (key: string, value: string) => void;
}

export const AppAnnouncementTab: React.FC<TabProps> = ({ formData, onInputChange }) => (
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
          <div className="text-xs font-bold text-slate-900">
            啟用頂部全域公告跑馬燈 (APP_ANNOUNCEMENT_ENABLED)
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            關閉時頂部將維持乾淨簡潔，開啟時即時輪播下方公告
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            onInputChange(
              'APP_ANNOUNCEMENT_ENABLED',
              formData.APP_ANNOUNCEMENT_ENABLED === 'true' ? 'false' : 'true'
            )
          }
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
          onChange={e => onInputChange('APP_GLOBAL_ANNOUNCEMENT', e.target.value)}
          placeholder="輸入全系統重要維護或廣播訊息..."
          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white"
        />
      </div>
    </div>
  </div>
);

interface AppModulesTabProps extends TabProps {
  enabledModules: string[];
  onToggleModule: (moduleKey: string) => void;
  canControlTestSandbox?: boolean;
  onToggleTestSandbox?: () => void;
}

export const AppModulesTab: React.FC<AppModulesTabProps> = ({
  formData,
  enabledModules,
  onToggleModule,
  onInputChange,
  canControlTestSandbox,
  onToggleTestSandbox,
}) => (
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
            onClick={() => onToggleModule(mod.key)}
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

    {/* 獨立測試模組開放區塊 (TEST_SANDBOX) */}
    {canControlTestSandbox && (
      <div className="pt-2">
        <div
          className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 transition-colors ${
            formData.APP_TEST_SANDBOX_PUBLIC === 'true'
              ? 'bg-amber-50/70 border-amber-300'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                formData.APP_TEST_SANDBOX_PUBLIC === 'true'
                  ? 'bg-amber-100 border-amber-300 text-amber-700'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-900">
                <span>開發測試模組：左側「測試區」開放開關 (TEST_SANDBOX · 僅 Superadmin 可控)</span>
                <span className="text-slate-400 font-normal">·</span>
                <span
                  className={
                    formData.APP_TEST_SANDBOX_PUBLIC === 'true'
                      ? 'text-amber-700'
                      : 'text-slate-600'
                  }
                >
                  {formData.APP_TEST_SANDBOX_PUBLIC === 'true'
                    ? '已開啟（全體啟用帳號皆可進入測試）'
                    : '已關閉（僅 Superadmin 可見）'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                測試中的新功能與權限邊界檢查皆放於「測試區」（嚴格唯讀、不寫入資料庫）。開啟時，一般管理員與同仁帳號皆可在左側選單進入測試區實測；關閉時即隱藏隔離。點擊右側按鈕會即時生效。
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onToggleTestSandbox) {
                onToggleTestSandbox();
              } else {
                onInputChange(
                  'APP_TEST_SANDBOX_PUBLIC',
                  formData.APP_TEST_SANDBOX_PUBLIC === 'true' ? 'false' : 'true'
                );
              }
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              formData.APP_TEST_SANDBOX_PUBLIC === 'true'
                ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
            }`}
          >
            {formData.APP_TEST_SANDBOX_PUBLIC === 'true' ? (
              <ToggleRight className="w-4 h-4" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
            <span>{formData.APP_TEST_SANDBOX_PUBLIC === 'true' ? '已開啟 · 點擊關閉' : '已關閉 · 點擊開啟'}</span>
          </button>
        </div>
      </div>
    )}

    {/* 業務分工與對客請款流程模式切換 */}
    <div className="pt-4 border-t border-slate-200 space-y-3">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
        <SlidersHorizontal className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xs font-bold text-emerald-950">
            「對外客戶請款／對帳明細表」權限分工模式 (APP_CUSTOMER_BILLING_MODE)
          </h3>
          <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
            決定「對外給客人看的請款／對帳表」要由誰調用開立。公司成長不同階段可由老闆 (BOSS) 或系統架構師隨時於此切換，無需修改程式碼；內部「401 營業稅活頁簿／銀行私帳／自主留存發票」永遠僅限財務會計模組存取。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {
            id: 'FINANCE_ONLY',
            badge: '模式 A · 現況預設',
            title: '會計統一管理（財務收支專責）',
            desc: '對客請款表僅由「財務收支 ＞ 應收請款」開啟與列印；「案場工程」專注工務進度與廠商進料管理。適合精簡團隊／會計統一對客階段。',
          },
          {
            id: 'PROJECT_FIRST_HANDOFF',
            badge: '模式 B · 未來擴編職能隔離',
            title: '工務／專案先開對客表 ➔ 送交會計決定開票',
            desc: '工務／專案可在「案場工程」開啟乾淨的對客請款表，填寫明細後一鍵「送交會計立帳」，由會計審核開哪間公司發票或免票。工務完全看不到銀行私帳與 401。',
          },
          {
            id: 'PROJECT_AND_FINANCE',
            badge: '模式 C · 雙軌彈性授權',
            title: '案場工程與財務收支皆可調用',
            desc: '兩邊同仁皆可依自身權限調出乾淨的「對客請款表」小程式即時對帳或列印給業主；對內借貸帳、補開發票與 401 活頁簿仍僅限財務部門使用。',
          },
        ].map(opt => {
          const selected = (formData.APP_CUSTOMER_BILLING_MODE || 'FINANCE_ONLY') === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onInputChange('APP_CUSTOMER_BILLING_MODE', opt.id)}
              className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer space-y-1.5 ${
                selected
                  ? 'bg-emerald-50/70 border-emerald-500 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {opt.badge}
                </span>
                {selected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              </div>
              <div className="text-xs font-bold text-slate-900">{opt.title}</div>
              <div className="text-[11px] text-slate-600 leading-relaxed">{opt.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

interface AppSystemEnvTabProps extends TabProps {
  canControlTestSandbox?: boolean;
  onToggleTestSandbox?: () => void;
}

export const AppSystemEnvTab: React.FC<AppSystemEnvTabProps> = ({
  formData,
  onInputChange,
  canControlTestSandbox,
  onToggleTestSandbox,
}) => (
  <div className="p-6 space-y-6">
    <div className="space-y-4">
      {canControlTestSandbox && (
        <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
          <div>
            <div className="text-xs font-bold text-indigo-950 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-indigo-600" />
              <span>對全體帳號開放左側「測試區」(APP_TEST_SANDBOX_PUBLIC · 僅 Superadmin 可控)</span>
            </div>
            <div className="text-[11px] text-indigo-700 mt-0.5">
              開啟時：所有啟用帳號皆可進入左側「測試區」驗證試作中的小程式與權限邊界；關閉時：僅 Superadmin 可見，包括 BOSS 與其他帳號皆完全隱藏。
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onToggleTestSandbox) {
                onToggleTestSandbox();
              } else {
                onInputChange(
                  'APP_TEST_SANDBOX_PUBLIC',
                  formData.APP_TEST_SANDBOX_PUBLIC === 'true' ? 'false' : 'true'
                );
              }
            }}
            className="cursor-pointer shrink-0 ml-3"
          >
            {formData.APP_TEST_SANDBOX_PUBLIC === 'true' ? (
              <ToggleRight className="w-9 h-9 text-indigo-600" />
            ) : (
              <ToggleLeft className="w-9 h-9 text-slate-400" />
            )}
          </button>
        </div>
      )}

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
          onClick={() =>
            onInputChange(
              'APP_MAINTENANCE_MODE',
              formData.APP_MAINTENANCE_MODE === 'true' ? 'false' : 'true'
            )
          }
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
              onChange={e => onInputChange('APP_PRIMARY_COLOR', e.target.value)}
              className="w-10 h-8 rounded border border-slate-300 cursor-pointer p-0.5 bg-white"
            />
            <input
              type="text"
              value={formData.APP_PRIMARY_COLOR || '#2d3a4b'}
              onChange={e => onInputChange('APP_PRIMARY_COLOR', e.target.value)}
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
            onChange={e => onInputChange('APP_LOGO_MODE', e.target.value)}
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
);
