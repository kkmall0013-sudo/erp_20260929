import React, { useState } from 'react';
import { Check, Code2, Copy, MapPin, ShieldCheck } from 'lucide-react';
import { TaiwanAddressPicker, TaiwanAddressValue } from '../widgets/TaiwanAddressPicker';
import { PostalCodeDirectoryPanel } from '../widgets/PostalCodeDirectoryPanel';
import { TaiwanIdTaxValidatorWidget } from '../widgets/TaiwanIdTaxValidatorWidget';

interface DemoTabCopyProps {
  copiedCodeKey: string | null;
  onCopyCode: (key: string, code: string) => void;
  onNotify?: (msg: string) => void;
}

export const TaiwanAddressDemoTab: React.FC<DemoTabCopyProps> = ({
  copiedCodeKey,
  onCopyCode,
  onNotify
}) => {
  const [demoAddress, setDemoAddress] = useState<TaiwanAddressValue>({
    postalCode: '100',
    city: '臺北市',
    district: '中正區',
    streetAddress: '重慶南路一段122號',
    fullAddress: '100 臺北市中正區重慶南路一段122號'
  });

  return (
    <div className="space-y-6">
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
                  排列順序：【郵遞區號 ➔ 縣市 ➔ 鄉鎮 ➔ 住址】雙向自動連動，動態讀取下方 SQLite 郵局表
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-700">互動即時體驗區（可輸入 3 碼郵遞區號、下拉縣市鄉鎮，或點擊下方郵局表任一行政區帶入測試）</span>
            <TaiwanAddressPicker
              label="營業登記地址 / 施工工地地址"
              value={demoAddress}
              onChange={val => setDemoAddress(val)}
              required
            />
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2 text-xs">
            <div className="font-bold text-indigo-950 flex items-center justify-between">
              <span>小程式輸出之 JSON 物件結構：</span>
              <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-700">
                SSoT 標準四段格式
              </span>
            </div>
            <pre className="p-3 bg-white rounded-lg border border-indigo-200 font-mono text-[11px] text-slate-800 overflow-x-auto">
              {JSON.stringify(demoAddress, null, 2)}
            </pre>
          </div>
        </div>

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
                  onCopyCode(
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
                <strong>適用模組：</strong>商業夥伴（業主/合作廠商）、公司法人、工程案場工地地址、進料快建彈窗。
              </p>
              <p>
                <strong>特性：</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-500 text-[11px]">
                <li>排列順序固定為：<strong>郵遞區號 ➔ 縣市 ➔ 鄉鎮 ➔ 住址</strong>。</li>
                <li>動態訂閱 SQLite 郵局表 (<code>taiwan_postal_codes</code>)，支援未來行政區改制與「舊名 ↔ 新名」雙向搜尋。</li>
                <li>支援「留存舊址為靜態歷史參考並改填新址」，絕不自動覆寫歷史檔案。</li>
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
            ✅ 動態 SQLite 郵遞區號微型資料庫，支援歷史別名雙向檢索與不覆寫舊檔機制。
          </div>
        </div>
      </div>

      <PostalCodeDirectoryPanel
        onSelectDistrict={rec => {
          const street = demoAddress.streetAddress || '';
          const full = `${rec.city}${rec.district}${street}`.trim();
          setDemoAddress({
            postalCode: rec.postalCode,
            city: rec.city,
            district: rec.district,
            streetAddress: street,
            fullAddress: rec.postalCode ? `${rec.postalCode} ${full}` : full
          });
        }}
        onNotify={onNotify}
      />
    </div>
  );
};

export const TaiwanTaxIdDemoTab: React.FC<Omit<DemoTabCopyProps, 'onNotify'>> = ({
  copiedCodeKey,
  onCopyCode
}) => {
  const [demoTaxId, setDemoTaxId] = useState<string>('24549210');
  const [demoNationalId, setDemoNationalId] = useState<string>('A123456789');

  return (
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
                onCopyCode(
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
  setErrorMsg('統編錯誤：' + res.message);
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
  );
};
