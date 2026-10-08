import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Landmark, Search, Check, ChevronDown, Building2, MapPin } from 'lucide-react';
import {
  TAIWAN_BANKS,
  BankInfo,
  getBankByCode,
  searchTaiwanBanks
} from '../../utils/taiwanBanks';

export interface TaiwanBankPickerProps {
  bankCode?: string;
  bankName?: string;
  onChange: (bank: { bankCode: string; bankName: string; shortName?: string }) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showCategoryBadge?: boolean;
}

/**
 * 🏦 全國金融機構查詢選取小程式 (TaiwanBankPickerWidget)
 * 涵蓋全臺灣 400+ 家金融機構：
 * 1. 本國一般銀行 (004 臺灣銀行、013 國泰世華、822 中國信託等)
 * 2. 中華郵政 700
 * 3. 全國各地信用合作社 (103 新竹三信、114 基隆一信等)
 * 4. 各鄉鎮市區農漁會信用部 (516 三峽農會、600 全國農業金庫、904 新店農會等)
 * 5. 即時模糊關鍵字與 3 碼機構代碼速查
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
  const containerRef = useRef<HTMLDivElement>(null);

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

  // 當前選取的金融機構資訊
  const currentBank = useMemo(() => {
    return getBankByCode(bankCode);
  }, [bankCode]);

  // 過濾搜尋結果 (限制前 40 筆以保證極致流暢)
  const filteredBanks = useMemo(() => {
    if (!searchQuery.trim()) {
      return TAIWAN_BANKS.slice(0, 30);
    }
    return searchTaiwanBanks(searchQuery).slice(0, 40);
  }, [searchQuery]);

  const handleSelectBank = (b: BankInfo) => {
    onChange({
      bankCode: b.code,
      bankName: b.name,
      shortName: b.shortName
    });
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-indigo-600" />
            <span>{label}</span>
            {required && <span className="text-red-500">*</span>}
          </label>
          {bankCode && (
            <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              代碼：{bankCode}
            </span>
          )}
        </div>
      )}

      {/* 選取主按鈕 */}
      <div className="relative">
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
                <span className="font-mono font-bold bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                  {currentBank.code}
                </span>
                <span className="font-bold text-slate-900 truncate">
                  {currentBank.name}
                </span>
                {showCategoryBadge && currentBank.category && (
                  <span className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                    {currentBank.category}
                  </span>
                )}
              </>
            ) : bankCode ? (
              <span className="font-mono text-slate-800">
                [{bankCode}] {bankName || '未知金融機構'}
              </span>
            ) : (
              <span className="text-slate-400">請選取或輸入金融機構名稱/代碼...</span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* 搜尋與選單下拉框 */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 space-y-2 max-h-72 flex flex-col animate-in fade-in zoom-in-95">
            {/* 搜尋列 */}
            <div className="relative shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="輸入 3 碼代號或關鍵字 (如 004, 臺灣銀行, 板橋農會)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            {/* 清單項目 */}
            <div className="overflow-y-auto flex-1 space-y-1 pr-1 divide-y divide-slate-100">
              {filteredBanks.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  查無符合「{searchQuery}」之金融機構代碼
                </div>
              ) : (
                filteredBanks.map(b => {
                  const isSelected = b.code === bankCode;
                  return (
                    <button
                      key={b.code}
                      type="button"
                      onClick={() => handleSelectBank(b)}
                      className={`w-full px-2.5 py-2 text-left rounded-lg text-xs flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-900 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono font-bold text-indigo-700 text-[11px] bg-indigo-50/60 px-1.5 py-0.5 rounded border border-indigo-100">
                          {b.code}
                        </span>
                        <div className="truncate">
                          <span className="font-semibold text-slate-900">{b.name}</span>
                          {b.shortName !== b.name && (
                            <span className="text-[11px] text-slate-400 ml-1.5">
                              ({b.shortName})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
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
