import React, { useState } from 'react';
import {
  Sparkles,
  MapPin,
  ShieldCheck,
  Landmark,
  CreditCard,
  FileCheck,
  Code2,
  Copy,
  Check,
  ExternalLink,
  Info,
  Scale
} from 'lucide-react';
import { TaiwanAddressPicker, TaiwanAddressValue } from './widgets/TaiwanAddressPicker';
import { TaiwanIdTaxValidatorWidget } from './widgets/TaiwanIdTaxValidatorWidget';
import { TaiwanBankPickerWidget } from './widgets/TaiwanBankPickerWidget';
import { MediaPreviewLightbox, MediaPreviewItem } from './widgets/MediaPreviewLightbox';

export interface MiniAppsWorkspaceProps {
  onNotify?: (msg: string) => void;
}

export const MiniAppsWorkspace: React.FC<MiniAppsWorkspaceProps> = ({ onNotify }) => {
  const [activeTab, setActiveTab] = useState<'ADDRESS' | 'TAX_ID' | 'BANKS' | 'CHEQUE_CALC' | 'MEDIA' | 'DEV_DOCS'>('ADDRESS');
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);

  // 1. 地址小程式測試狀態
  const [demoAddress, setDemoAddress] = useState<TaiwanAddressValue>({
    postalCode: '100',
    city: '台北市',
    district: '中正區',
    streetAddress: '重慶南路一段122號',
    fullAddress: '100 台北市中正區重慶南路一段122號'
  });

  // 2. 統編/身分證小程式測試狀態
  const [demoTaxId, setDemoTaxId] = useState<string>('24549210'); // 範例台積電統編
  const [demoNationalId, setDemoNationalId] = useState<string>('A123456789');

  // 3. 銀行代碼小程式測試狀態
  const [demoBank, setDemoBank] = useState<{ bankCode: string; bankName: string }>({
    bankCode: '004',
    bankName: '臺灣銀行'
  });

  // 4. 票據試算狀態
  const [calcIssueDate, setCalcIssueDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [calcTerms, setCalcTerms] = useState<number>(30);

  // 5. 媒體燈箱預覽測試狀態
  const [lightboxItem, setLightboxItem] = useState<MediaPreviewItem | null>(null);

  const handleCopyCode = (key: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeKey(key);
    if (onNotify) onNotify('📋 已複製小程式調用代碼！');
    setTimeout(() => setCopiedCodeKey(null), 2000);
  };

  // 票據法試算日
  const calcResults = React.useMemo(() => {
    try {
      const issue = new Date(calcIssueDate);
      if (isNaN(issue.getTime())) return { expiry: '', due: '' };

      // 票據法第22條第1項：自發票日起算一年不行使因免除其責任
      const expiry = new Date(issue);
      expiry.setFullYear(expiry.getFullYear() + 1);

      // 約定兌現日 (發票日 + N 天)
      const due = new Date(issue);
      due.setDate(due.getDate() + calcTerms);

      return {
        expiry: expiry.toISOString().slice(0, 10),
        due: due.toISOString().slice(0, 10)
      };
    } catch (e) {
      return { expiry: '', due: '' };
    }
  }, [calcIssueDate, calcTerms]);

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
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
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
        {/* ======================================================== */}
        {/* 1. 臺灣郵遞地址小程式 */}
        {/* ======================================================== */}
        {activeTab === 'ADDRESS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      小程式：臺灣標準郵遞地址輸入元件
                    </h3>
                    <p className="text-xs text-slate-500">
                      中華郵政全國縣市鄉鎮市區連動，自動帶出 3 碼 / 3+2 碼郵遞區號
                    </p>
                  </div>
                </div>
              </div>

              {/* 實體小程式互動預覽 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-700">互動即時體驗區</span>
                <TaiwanAddressPicker
                  label="營業登記地址 / 施工工地地址"
                  value={demoAddress}
                  onChange={val => setDemoAddress(val)}
                  required
                />
              </div>

              {/* 剖析資料結果展示 */}
              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2 text-xs">
                <div className="font-bold text-indigo-950 flex items-center justify-between">
                  <span>小程式輸出之 JSON 物件結構：</span>
                  <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-700">
                    SSoT 標準格式
                  </span>
                </div>
                <pre className="p-3 bg-white rounded-lg border border-indigo-200 font-mono text-[11px] text-slate-800 overflow-x-auto">
                  {JSON.stringify(demoAddress, null, 2)}
                </pre>
              </div>
            </div>

            {/* 調用代碼指南 */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-indigo-600" />
                    <span>其他模組如何調用此小程式？</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyCode(
                        'addr',
                        `import { TaiwanAddressPicker } from './widgets/TaiwanAddressPicker';\n\n<TaiwanAddressPicker\n  label="通訊地址"\n  value={myAddress}\n  onChange={(val) => setMyAddress(val)}\n  required\n/>`
                      )
                    }
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
                  >
                    {copiedCodeKey === 'addr' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCodeKey === 'addr' ? '已複製！' : '複製代碼'}</span>
                  </button>
                </div>

                <div className="text-xs text-slate-600 leading-relaxed space-y-2">
                  <p>
                    <strong>適用模組：</strong>商業夥伴（業主/合作廠商）、工程合約、施工專案工地地址、請款發票收件地址、員工通訊地址。
                  </p>
                  <p>
                    <strong>特性：</strong>
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-500 text-[11px]">
                    <li>全自動 22 個縣市與 368 個鄉鎮市區郵政編碼資料庫。</li>
                    <li>支援智慧反向貼上解析，快速剖析地址。</li>
                    <li>地址拆分：縣市、行政區、郵遞區號、門牌完整分離。</li>
                  </ul>
                </div>

                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed">
{`// 1. 引入元件
import { TaiwanAddressPicker } from './widgets/TaiwanAddressPicker';

// 2. 於 JSX 中使用
<TaiwanAddressPicker
  label="通訊地址"
  value={formData.address}
  onChange={(val) => {
    // val 包含 { postalCode, city, district, streetAddress, fullAddress }
    setFormData(prev => ({ ...prev, address: val.fullAddress }));
  }}
  required
/>`}
                </pre>
              </div>

              <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800">
                ✅ 支援全臺灣 368 鄉鎮區最新郵遞區號與外島偏遠地區。
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. 臺灣統一編號 / 身分證字號檢核小程式 */}
        {/* ======================================================== */}
        {activeTab === 'TAX_ID' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      小程式：臺灣統編與身分證字號即時檢核機
                    </h3>
                    <p className="text-xs text-slate-500">
                      包含財政部營利事業 8 碼乘數校驗與內政部 10 碼國民身分證模數加權演算法
                    </p>
                  </div>
                </div>
              </div>

              {/* 實體測試區 */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-700">測試一：公司營利事業統一編號 (8 碼)</span>
                  <TaiwanIdTaxValidatorWidget
                    type="TAX_ID"
                    value={demoTaxId}
                    onChange={val => setDemoTaxId(val)}
                    label="公司統一編號 (可試著修改任意一碼觀察報錯)"
                    required
                  />
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>快捷測試真實統編：</span>
                    <button
                      type="button"
                      onClick={() => setDemoTaxId('24549210')}
                      className="text-indigo-600 hover:underline font-mono font-bold"
                    >
                      24549210 (台積電)
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setDemoTaxId('03795505')}
                      className="text-indigo-600 hover:underline font-mono font-bold"
                    >
                      03795505 (台塑)
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setDemoTaxId('12345678')}
                      className="text-red-600 hover:underline font-mono font-bold"
                    >
                      12345678 (非法統編)
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-700">測試二：個人/工班負責人國民身分證號 (10 碼)</span>
                  <TaiwanIdTaxValidatorWidget
                    type="NATIONAL_ID"
                    value={demoNationalId}
                    onChange={val => setDemoNationalId(val)}
                    label="國民身分證字號"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 調用代碼指南 */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-emerald-600" />
                    <span>其他模組調用方式</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyCode(
                        'tax',
                        `import { TaiwanIdTaxValidatorWidget } from './widgets/TaiwanIdTaxValidatorWidget';\n\n<TaiwanIdTaxValidatorWidget\n  type="TAX_ID"\n  value={taxId}\n  onChange={(val) => setTaxId(val)}\n  required\n/>`
                      )
                    }
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
                  >
                    {copiedCodeKey === 'tax' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCodeKey === 'tax' ? '已複製！' : '複製代碼'}</span>
                  </button>
                </div>

                <div className="text-xs text-slate-600 leading-relaxed space-y-2">
                  <p>
                    <strong>演算規則：</strong>
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-500 text-[11px]">
                    <li>統編加權數：[1, 2, 1, 2, 1, 2, 4, 1]。</li>
                    <li>支援財政部 2023 最新修正案（第七位數為 7 之雙重模數校驗）。</li>
                    <li>身分證字母依縣市轉二位數乘 [1, 9]，接續九位數乘 [8, 7, 6, 5, 4, 3, 2, 1, 1]。</li>
                  </ul>
                </div>

                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed">
{`// 1. 純函數校驗 (在 Save / Submit 前防呆)
import { validateTaiwanTaxId } from '../utils/taiwanValidation';

const res = validateTaiwanTaxId(taxId);
if (!res.isValid) {
  alert('統編錯誤：' + res.message);
  return;
}

// 2. 或直接嵌入 UI 元件
import { TaiwanIdTaxValidatorWidget } from './widgets/TaiwanIdTaxValidatorWidget';

<TaiwanIdTaxValidatorWidget
  value={partner.taxId}
  type="TAX_ID"
  onChange={(val) => setPartner(p => ({ ...p, taxId: val }))}
  required
/>`}
                </pre>
              </div>

              <div className="mt-4 p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs text-sky-800">
                🛡️ 營造工程內控鐵律：嚴禁未通過統編/身分證校驗之單據過帳！
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. 全國金融機構選單小程式 */}
        {/* ======================================================== */}
        {activeTab === 'BANKS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      小程式：全國金融機構與農漁會速查選取元件
                    </h3>
                    <p className="text-xs text-slate-500">
                      涵蓋全國銀行、郵局、信用合作社、各鄉鎮農漁會信用部
                    </p>
                  </div>
                </div>
              </div>

              {/* 實體測試區 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-700">互動選取測試</span>
                <TaiwanBankPickerWidget
                  bankCode={demoBank.bankCode}
                  bankName={demoBank.bankName}
                  onChange={b => setDemoBank({ bankCode: b.bankCode, bankName: b.bankName })}
                  label="匯款/支票付款銀行"
                  required
                />
                <div className="pt-2 text-xs text-slate-600 flex items-center gap-2">
                  <span>當前選定代碼：</span>
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    [{demoBank.bankCode}] {demoBank.bankName}
                  </span>
                </div>
              </div>
            </div>

            {/* 調用代碼指南 */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-sky-600" />
                    <span>其他模組調用方式</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyCode(
                        'bank',
                        `import { TaiwanBankPickerWidget } from './widgets/TaiwanBankPickerWidget';\n\n<TaiwanBankPickerWidget\n  bankCode={form.bankCode}\n  bankName={form.bankName}\n  onChange={(b) => setForm(prev => ({ ...prev, bankCode: b.bankCode, bankName: b.bankName }))}\n  required\n/>`
                      )
                    }
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
                  >
                    {copiedCodeKey === 'bank' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCodeKey === 'bank' ? '已複製！' : '複製代碼'}</span>
                  </button>
                </div>

                <div className="text-xs text-slate-600 leading-relaxed space-y-2">
                  <p>
                    <strong>適用範圍：</strong>商業夥伴銀行帳戶管理、支票收付款登記、出納匯款批次過帳、員工薪轉帳戶維護。
                  </p>
                </div>

                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed">
{`import { TaiwanBankPickerWidget } from './widgets/TaiwanBankPickerWidget';

<TaiwanBankPickerWidget
  bankCode={account.bankCode}
  bankName={account.bankName}
  onChange={({ bankCode, bankName }) => {
    setAccount(prev => ({ ...prev, bankCode, bankName }));
  }}
  required
/>`}
                </pre>
              </div>

              <div className="mt-4 p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs text-sky-800">
                🏦 全國金融機構資料庫即時模糊搜尋，代碼 3 碼精準對齊跨行通匯規範。
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 4. 票據法規與支票票期試算 */}
        {/* ======================================================== */}
        {activeTab === 'CHEQUE_CALC' && (
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  票據法第22條時效與遠期支票到期日工程實務試算機
                </h3>
                <p className="text-xs text-slate-500">
                  釐清「收票日」、「發票日/開票日」、「約定兌現日」與「法定一年追索消滅時效」之法律與會計定義
                </p>
              </div>
            </div>

            {/* 試算輸入列 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  票面開票日 / 發票日 (Issue Date)
                </label>
                <input
                  type="date"
                  value={calcIssueDate}
                  onChange={e => setCalcIssueDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  工程約定票期 (天數)
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={calcTerms}
                    onChange={e => setCalcTerms(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value={0}>0 天 (即期支票 / 見票即付)</option>
                    <option value={30}>30 天期 (次月付款)</option>
                    <option value={45}>45 天期</option>
                    <option value={60}>60 天期 (常見工程包商票期)</option>
                    <option value={90}>90 天期 (三個月期票)</option>
                    <option value={365}>365 天 (法定一年追索時效)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col justify-end">
                <div className="text-xs text-slate-500">
                  試算約定兌現日：
                  <span className="font-mono font-bold text-indigo-700 ml-1">
                    {calcResults.due}
                  </span>
                </div>
              </div>
            </div>

            {/* 法律解說與比較卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2 text-xs">
                <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-700" />
                  <span>使用者常見疑問：支票到期日不是一年嗎？為什麼還要輸入？</span>
                </h4>
                <div className="text-amber-950 space-y-2 leading-relaxed">
                  <p>
                    <strong>1. 票據法第128條第2項規定：</strong>「支票限於見票即付，有相反之記載者，其記載無效。」
                  </p>
                  <p>
                    <strong>2. 臺灣商業與工程實務（遠期支票 Post-dated Check）：</strong>
                    商業習慣開立「遠期支票」，發票人簽發時記載將來之日期作為「發票日」，雙方約定在該日之前不提示。因此，工程會計出納所謂的「到期日/兌現日」，在法律與票面文字上即是該「約定發票日」。
                  </p>
                  <p>
                    <strong>3. 票據法第22條第1項（法定一年消滅時效）：</strong>
                    「票據上之權利，對支票發票人自發票日起算，<strong>一年間不行使，因免除其責任</strong>。」
                    這一年指的是「執票人向發票人行使追索權的法定消滅時效」，並非可任由延後一年才兌換。
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2 text-xs">
                <h4 className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-700" />
                  <span>系統四種日期節點設計規範 (SSoT)</span>
                </h4>
                <div className="text-indigo-950 space-y-2 leading-relaxed">
                  <p>
                    <strong>📥 收到日期 (receivedDate)：</strong>
                    出納人員拿到支票的當天（如：2026-10-08），用以登記保管箱在庫盤點。
                  </p>
                  <p>
                    <strong>✍️ 發票日/開票日 (issueDate)：</strong>
                    支票票面上載明的日期（票據法權利起算點）。
                  </p>
                  <p>
                    <strong>🏦 約定兌現日 (dueDate / cashableDate)：</strong>
                    資金可真正入帳之提示日。系統提供快捷鍵一鍵填入（即期、30天、60天等）。
                  </p>
                  <p>
                    <strong>⚖️ 法定時效終期 (statutoryExpiryDate)：</strong>
                    系統自動根據發票日 + 1 年進行法律警示：<span className="font-mono font-bold text-red-600">{calcResults.expiry}</span>。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 5. 模組調用手冊與開發者指南 */}
        {/* ======================================================== */}
        {activeTab === 'DEV_DOCS' && (
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  小程式專區規範與調用手冊 (Developer Cheat Sheet)
                </h3>
                <p className="text-xs text-slate-500">
                  供所有接手開發其他模組（報價、估驗、合約、發票、人事）之工程師與 AI 直接引入調用
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-900">
                  📁 元件與工具函數檔案架構清單：
                </h4>
                <ul className="text-xs text-slate-700 font-mono space-y-1.5 pl-4 list-disc">
                  <li>
                    <code>src/components/widgets/TaiwanAddressPicker.tsx</code> — 臺灣郵遞地址選單小程式
                  </li>
                  <li>
                    <code>src/components/widgets/TaiwanIdTaxValidatorWidget.tsx</code> — 統編與身分證檢核小程式
                  </li>
                  <li>
                    <code>src/components/widgets/TaiwanBankPickerWidget.tsx</code> — 全國金融機構查詢小程式
                  </li>
                  <li>
                    <code>src/components/widgets/MediaPreviewLightbox.tsx</code> — 高解析圖片/PDF燈箱小程式 (免受 Chrome iframe 封鎖)
                  </li>
                  <li>
                    <code>src/components/widgets/ChequeDetailModal.tsx</code> — 支票完整資訊與備註檢視視窗
                  </li>
                  <li>
                    <code>src/utils/taiwanPostalCodes.ts</code> — 全國 368 鄉鎮市區與郵遞區號資料庫
                  </li>
                  <li>
                    <code>src/utils/taiwanValidation.ts</code> — 統編 (8碼) 與身分證 (10碼) 加權演算法
                  </li>
                  <li>
                    <code>src/utils/taiwanBanks.ts</code> — 全國 400+ 金融機構代碼資料庫
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 燈箱視窗 (若有) */}
      {lightboxItem && (
        <MediaPreviewLightbox
          media={lightboxItem}
          onClose={() => setLightboxItem(null)}
        />
      )}
    </div>
  );
};
