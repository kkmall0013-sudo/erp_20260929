import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Landmark, Search, Check, ChevronDown } from 'lucide-react';
import {
  TAIWAN_BANKS,
  BANK_CATEGORIES,
  BankCategory,
  BankInfo,
  getBankByCode,
  getBanksByCode,
  searchTaiwanBanks
} from '../../utils/taiwanBanks';

export interface TaiwanBankPickerProps {
  bankCode?: string;
  bankName?: string;
  onChange: (bank: { bankCode: string; bankName: string; shortName?: string; branchCode?: string }) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showCategoryBadge?: boolean;
}

/**
 * 🏦 全國金融機構查詢選取小程式 (TaiwanBankPickerWidget)
 * 資料來源：財金資訊股份有限公司 (FISC) 台幣跨行通匯金融機構代號表 (twd.txt)
 * 特色：
 * 1. 完整收錄全國 414 家跨行通匯金融機構（本國銀行、純網銀、中華郵政、全臺 23 家信合社、外商與票券機構、電子支付、全臺 311 家農漁會信用部）
 * 2. 支援 3 碼總機構代號（如 616）與 7 碼本會通匯代號（如斗南鎮農會 6160056）雙向檢索，並針對南農中心共用 3 碼代號自動展開對應鄉鎮農漁會選單
 */
export const TaiwanBankPickerWidget: React.FC<TaiwanBankPickerProps> = ({
  bankCode = '',
  bankName = '',
  onChange,
  label = '金融機構代碼與名稱',
  required = false,
  disabled = false,
  className = '',
  showCategoryBadge = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'ALL' | BankCategory>('ALL');
  const [codeInput, setCodeInput] = useState(bankCode);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCodeInput(bankCode || '');
  }, [bankCode]);

  // 關閉下拉
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // 當前選取的金融機構資訊（同時比對 bankCode 與 bankName，支援 616 等共用代號精準定位如斗南鎮農會）
  const currentBank = useMemo(() => {
    return getBankByCode(bankCode, bankName);
  }, [bankCode, bankName]);

  // 檢查此 3 碼代號是否為多家農漁會共用代號（例如 616 為雲林縣斗南鎮農會、斗六市農會等 13 家共用）
  const sharedCodeBanks = useMemo(() => {
    if (!bankCode) return [];
    return getBanksByCode(bankCode);
  }, [bankCode]);

  // 過濾搜尋結果 (完整呈現符合條件之全國金融機構，不裁切筆數)
  const filteredBanks = useMemo(() => {
    return searchTaiwanBanks(searchQuery, activeCategory);
  }, [searchQuery, activeCategory]);

  const handleSelectBank = (b: BankInfo) => {
    setCodeInput(b.code);
    onChange({
      bankCode: b.code,
      bankName: b.name,
      shortName: b.shortName,
      branchCode: b.branchCode
    });
    setIsOpen(false);
    setSearchQuery('');
  };

  // 當使用者直接輸入 3 碼銀行代號或 7 碼本會通匯代號時自動反查連動
  const handleCodeInputChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 7);
    setCodeInput(digits);
    if (digits.length === 3 || digits.length === 7) {
      const matches = getBanksByCode(digits);
      if (matches.length === 1) {
        onChange({
          bankCode: matches[0].code,
          bankName: matches[0].name,
          shortName: matches[0].shortName,
          branchCode: matches[0].branchCode
        });
        return;
      } else if (matches.length > 1) {
        // 多家農漁會共用同一 3 碼代號（如 616 包含斗南鎮農會、斗六市農會等 13 家）
        const chosen = getBankByCode(digits, bankName) || matches[0];
        onChange({
          bankCode: chosen.code,
          bankName: chosen.name,
          shortName: chosen.shortName,
          branchCode: chosen.branchCode
        });
        setSearchQuery(digits);
        setActiveCategory('ALL');
        setIsOpen(true);
        return;
      }
    }
    onChange({
      bankCode: digits.slice(0, 3),
      bankName: bankName
    });
  };

  return (
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between flex-wrap gap-1">
          <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-indigo-600" />
            <span>{label}</span>
            {required && <span className="text-red-500">*</span>}
          </label>
          <div className="flex items-center gap-1.5">
            {sharedCodeBanks.length > 1 && (
              <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                代號 {bankCode} 共 {sharedCodeBanks.length} 家農漁會共用
              </span>
            )}
            <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              財金官方清冊 {TAIWAN_BANKS.length} 家 {bankCode ? `｜當前：${bankCode}` : ''}
            </span>
          </div>
        </div>
      )}

      {/* 左側 3 碼機構代號直接輸入 + 右側全國金融機構下拉選單 */}
      <div className="grid grid-cols-12 gap-2 relative">
        <div className="col-span-3 sm:col-span-2">
          <input
            type="text"
            value={codeInput}
            onChange={e => handleCodeInputChange(e.target.value)}
            disabled={disabled}
            maxLength={7}
            placeholder="3碼代號"
            title="輸入 3 碼總機構代號（如 004、616、700）或 7 碼本會通匯代號（如斗南鎮農會 6160056）自動切換對應金融機構"
            className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 font-mono font-bold text-center focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="col-span-9 sm:col-span-10">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full px-3 py-2 text-xs rounded-lg border flex items-center justify-between text-left transition-all ${
              disabled
                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                : isOpen
                ? 'border-indigo-500 ring-2 ring-indigo-100 bg-white'
                : 'border-slate-300 bg-white hover:border-slate-400 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {currentBank ? (
                <>
                  <span className="font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 text-[11px]">
                    {currentBank.code}
                  </span>
                  <span className="font-bold text-slate-900 truncate">
                    {currentBank.name}
                  </span>
                  {currentBank.branchCode && (
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                      通匯 {currentBank.branchCode}
                    </span>
                  )}
                  {showCategoryBadge && currentBank.category && (
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                      {currentBank.category}
                    </span>
                  )}
                </>
              ) : bankCode ? (
                <span className="font-mono text-slate-800">
                  [{bankCode}] {bankName || '查無此代號，請從選單選取'}
                </span>
              ) : (
                <span className="text-slate-400">請選取或搜尋金融機構名稱/代碼（如：616 斗南鎮農會）...</span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* 搜尋與分類選單下拉框 */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-2.5 space-y-2 max-h-88 flex flex-col animate-in fade-in zoom-in-95">
            {/* 搜尋列 */}
            <div className="relative shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="輸入 3 碼(616)、7 碼(6160056)或機構名稱 (如：斗南鎮農會、台銀、三信)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            {/* 機構分類快速篩選列 */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 shrink-0">
              {BANK_CATEGORIES.map(cat => {
                const active = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategory(cat.key)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold shrink-0 transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
              <span className="ml-auto text-[10px] font-mono text-slate-400 shrink-0 pl-2">
                符合 {filteredBanks.length} 筆
              </span>
            </div>

            {/* 清單項目 */}
            <div className="overflow-y-auto flex-1 space-y-1 pr-1 divide-y divide-slate-100">
              {filteredBanks.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  查無符合「{searchQuery}」之金融機構代碼
                </div>
              ) : (
                filteredBanks.map(b => {
                  const isSelected =
                    b.code === bankCode && (!bankName || b.name === bankName);
                  return (
                    <button
                      key={b.branchCode || `${b.code}-${b.name}`}
                      type="button"
                      onClick={() => handleSelectBank(b)}
                      className={`w-full px-2.5 py-2 text-left rounded-lg text-xs flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-900 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono font-bold text-indigo-700 text-[11px] bg-indigo-50/60 px-1.5 py-0.5 rounded border border-indigo-100 shrink-0">
                          {b.code}
                        </span>
                        <div className="truncate flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900">{b.name}</span>
                          {b.shortName && b.shortName !== b.name && (
                            <span className="text-[11px] text-slate-400">
                              ({b.shortName})
                            </span>
                          )}
                          {b.branchCode && (
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              通匯 {b.branchCode}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {b.centerName && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {b.centerName}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {b.category}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


