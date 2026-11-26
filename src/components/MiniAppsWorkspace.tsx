import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  MapPin,
  ShieldCheck,
  Landmark,
  CreditCard,
  FileCheck,
  Code2,
  Search,
  Users2,
  FlaskConical,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { MediaPreviewLightbox, MediaPreviewItem } from './widgets/MediaPreviewLightbox';
import { copyTextToClipboard } from '../utils/fileIO';
import { useAuth } from '../context/AuthContext';
import {
  getAppConfigMap,
  subscribeToDatabase,
  updateAppConfig
} from '../db/sqlite';
import { ErpMiniAppsDispatchTab } from './miniapps/ErpMiniAppsDispatchTab';
import { UniversalSearchDemoTab } from './miniapps/UniversalSearchDemoTab';
import {
  TaiwanAddressDemoTab,
  TaiwanTaxIdDemoTab
} from './miniapps/TaiwanAddressAndTaxDemoTabs';
import { TaiwanBanksDemoTab } from './miniapps/TaiwanBanksDemoTab';
import {
  ChequeCalculatorDemoTab,
  MiniAppsDevDocsTab,
  PartnerSearchDemoTab
} from './miniapps/ChequePartnerAndDocsTabs';

export interface MiniAppsWorkspaceProps {
  onNotify?: (msg: string) => void;
}

type MiniAppsTabId =
  | 'ERP_MINI_APPS'
  | 'UNIVERSAL_SEARCH'
  | 'ADDRESS'
  | 'TAX_ID'
  | 'BANKS'
  | 'CHEQUE_CALC'
  | 'PARTNER_SEARCH'
  | 'MEDIA'
  | 'DEV_DOCS';

export const MiniAppsWorkspace: React.FC<MiniAppsWorkspaceProps> = ({ onNotify }) => {
  const { currentUser, isSuperadmin } = useAuth();
  const [activeTab, setActiveTab] = useState<MiniAppsTabId>('ERP_MINI_APPS');
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);
  const [erpRefreshTick, setErpRefreshTick] = useState(0);
  const [lightboxItem, setLightboxItem] = useState<MediaPreviewItem | null>(null);

  useEffect(() => {
    const unsub = subscribeToDatabase(() => setErpRefreshTick(t => t + 1));
    return () => unsub();
  }, []);

  const isSandboxPublic = useMemo(() => {
    void erpRefreshTick;
    try {
      return getAppConfigMap().APP_TEST_SANDBOX_PUBLIC === 'true';
    } catch (_) {
      return false;
    }
  }, [erpRefreshTick]);

  const canControlTestSandbox = isSuperadmin;

  const handleToggleSandboxPublic = () => {
    if (!canControlTestSandbox) return;
    const nextVal = isSandboxPublic ? 'false' : 'true';
    updateAppConfig('APP_TEST_SANDBOX_PUBLIC', nextVal, currentUser?.fullName || 'Superadmin');
    setErpRefreshTick(t => t + 1);
    onNotify?.(
      nextVal === 'true'
        ? '🧪 已開啟「測試區」對全體帳號開放：所有啟用帳號皆可於左側選單進入測試區進行跨角色權限驗證。'
        : '🔒 已關閉「測試區」對外開放：現在僅 Superadmin 可見測試區（正式隔離狀態）。'
    );
  };

  const handleCopyCode = async (key: string, code: string) => {
    const ok = await copyTextToClipboard(code);
    if (ok) {
      setCopiedCodeKey(key);
      if (onNotify) onNotify('📋 已複製小程式調用代碼！');
      setTimeout(() => setCopiedCodeKey(null), 2000);
    } else if (onNotify) {
      onNotify('❌ 無法寫入剪貼簿，請手動選取複製');
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* 頂部標題列 */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                通用小程式專區與元件庫 (Mini-Apps Hub)
              </h2>
              <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
                v2.0 全模組共用
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              跨模組高度封裝之商業邏輯小程式：臺灣地址選單、統編身分證檢核、全國金融機構資料庫、票據法時效試算
            </p>
          </div>
        </div>

        {/* 頁籤切換選單 */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('ERP_MINI_APPS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'ERP_MINI_APPS'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>業務功能小程式調度區</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('UNIVERSAL_SEARCH')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'UNIVERSAL_SEARCH'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>通用搜尋元件</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ADDRESS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'ADDRESS'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>地址郵遞小程式</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TAX_ID')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'TAX_ID'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>統編身分證小程式</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BANKS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'BANKS'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>全國金融機構小程式</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PARTNER_SEARCH')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'PARTNER_SEARCH'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users2 className="w-3.5 h-3.5" />
            <span>夥伴快搜/快建小程式</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CHEQUE_CALC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'CHEQUE_CALC'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>票據法規與試算</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DEV_DOCS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'DEV_DOCS'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>模組調用手冊</span>
          </button>
        </div>
      </div>

      {/* 主體展示區 */}
      <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full space-y-6">
        {canControlTestSandbox && (
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                  isSandboxPublic
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <FlaskConical className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <span>開發中測試區開放控制（Superadmin 專屬）</span>
                  <span className="text-slate-400 font-normal">·</span>
                  <span className={isSandboxPublic ? 'text-amber-700' : 'text-slate-600'}>
                    {isSandboxPublic ? '全體啟用帳號可進入測試區' : '僅 Superadmin 可見（正式隔離）'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  已驗證穩定之小程式請收納於下方常用小程式庫；開發中元件留在「測試區」驗證（唯讀不寫入資料庫），必要時可開啟供其他角色實測。
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleSandboxPublic}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isSandboxPublic
                  ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
              }`}
            >
              {isSandboxPublic ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              <span>{isSandboxPublic ? '關閉對外測試（切回僅 Superadmin）' : '開啟測試區供全體帳號測試'}</span>
            </button>
          </div>
        )}

        {activeTab === 'ERP_MINI_APPS' && (
          <ErpMiniAppsDispatchTab
            erpRefreshTick={erpRefreshTick}
            onRefresh={() => setErpRefreshTick(t => t + 1)}
            onNotify={onNotify}
          />
        )}

        {activeTab === 'UNIVERSAL_SEARCH' && (
          <UniversalSearchDemoTab
            erpRefreshTick={erpRefreshTick}
            copiedCodeKey={copiedCodeKey}
            onCopyCode={handleCopyCode}
          />
        )}

        {activeTab === 'ADDRESS' && (
          <TaiwanAddressDemoTab
            copiedCodeKey={copiedCodeKey}
            onCopyCode={handleCopyCode}
            onNotify={onNotify}
          />
        )}

        {activeTab === 'TAX_ID' && (
          <TaiwanTaxIdDemoTab
            copiedCodeKey={copiedCodeKey}
            onCopyCode={handleCopyCode}
          />
        )}

        {activeTab === 'BANKS' && (
          <TaiwanBanksDemoTab
            copiedCodeKey={copiedCodeKey}
            onCopyCode={handleCopyCode}
          />
        )}

        {activeTab === 'CHEQUE_CALC' && <ChequeCalculatorDemoTab />}

        {activeTab === 'PARTNER_SEARCH' && (
          <PartnerSearchDemoTab
            copiedCodeKey={copiedCodeKey}
            onCopyCode={handleCopyCode}
          />
        )}

        {activeTab === 'DEV_DOCS' && <MiniAppsDevDocsTab />}
      </div>

      {lightboxItem && (
        <MediaPreviewLightbox
          media={lightboxItem}
          onClose={() => setLightboxItem(null)}
        />
      )}
    </div>
  );
};
