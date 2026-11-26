import React, { useState } from 'react';
import { Check, Code2, Copy, Landmark, Search } from 'lucide-react';
import { TaiwanBankPickerWidget } from '../widgets/TaiwanBankPickerWidget';
import {
  BANK_CATEGORIES,
  BankCategory,
  searchTaiwanBanks,
  TAIWAN_BANKS
} from '../../utils/taiwanBanks';

interface TaiwanBanksDemoTabProps {
  copiedCodeKey: string | null;
  onCopyCode: (key: string, code: string) => void;
}

export const TaiwanBanksDemoTab: React.FC<TaiwanBanksDemoTabProps> = ({
  copiedCodeKey,
  onCopyCode
}) => {
  const [demoBank, setDemoBank] = useState<{ bankCode: string; bankName: string }>({
    bankCode: '004',
    bankName: '臺灣銀行'
  });
  const [bankDirSearch, setBankDirSearch] = useState<string>('');
  const [bankDirCategory, setBankDirCategory] = useState<'ALL' | BankCategory>('ALL');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                小程式：全國金融機構與農漁會速查選取元件（財金公司 FISC 官方資料庫）
              </h3>
              <p className="text-xs text-slate-500">
                同步財金資訊股份有限公司 (twd.txt) 官方清冊：完整涵蓋全國銀行、郵局、信合社及全臺 311 家農漁會信用部（如 616 雲林縣斗南鎮農會）
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-700">互動選取測試（支援左側輸入 3 碼/7 碼代號或右側搜尋篩選）</span>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-400">快速測試：</span>
              <button
                type="button"
                onClick={() => setDemoBank({ bankCode: '616', bankName: '雲林縣斗南鎮農會' })}
                className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-bold hover:bg-indigo-100"
              >
                616 斗南鎮農會
              </button>
              <button
                type="button"
                onClick={() => setDemoBank({ bankCode: '004', bankName: '臺灣銀行' })}
                className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono font-bold hover:bg-slate-200"
              >
                004 臺灣銀行
              </button>
              <button
                type="button"
                onClick={() => setDemoBank({ bankCode: '700', bankName: '中華郵政股份有限公司' })}
                className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono font-bold hover:bg-slate-200"
              >
                700 中華郵政
              </button>
            </div>
          </div>
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

        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                財金公司 (FISC) 全國跨行通匯金融機構官方名錄（共 {TAIWAN_BANKS.length} 家）
              </h4>
              <p className="text-[11px] text-slate-500">
                點擊任一列即可直接帶入上方測試元件；包含 3 碼總機構代號與 7 碼總行/本會通匯代號（如斗南鎮農會 616 / 6160056）
              </p>
            </div>
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={bankDirSearch}
                onChange={e => setBankDirSearch(e.target.value)}
                placeholder="搜尋代號(如 616)或名稱(斗南)..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {BANK_CATEGORIES.map(cat => {
              const count =
                cat.key === 'ALL'
                  ? TAIWAN_BANKS.length
                  : TAIWAN_BANKS.filter(b => b.category === cat.key).length;
              const active = bankDirCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setBankDirCategory(cat.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                    active
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1 rounded ${
                      active ? 'bg-indigo-700 text-indigo-100' : 'bg-white text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
            {searchTaiwanBanks(bankDirSearch, bankDirCategory).map(b => {
              const isSelected = demoBank.bankCode === b.code && demoBank.bankName === b.name;
              return (
                <div
                  key={b.branchCode || `${b.code}-${b.name}`}
                  onClick={() => setDemoBank({ bankCode: b.code, bankName: b.name })}
                  className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-50 font-bold' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 text-[11px] w-11 text-center shrink-0">
                      {b.code}
                    </span>
                    <span className="text-slate-900 font-semibold truncate">{b.name}</span>
                    {b.shortName && b.shortName !== b.name && (
                      <span className="text-[11px] text-slate-400 shrink-0">
                        ({b.shortName})
                      </span>
                    )}
                    {b.branchCode && (
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                        通匯 {b.branchCode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {b.centerName && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {b.centerName}
                      </span>
                    )}
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {b.category}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

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
                onCopyCode(
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
  );
};
