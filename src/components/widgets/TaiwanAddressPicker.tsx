import React, { useState, useEffect } from 'react';
import { MapPin, Search, Check, RefreshCw } from 'lucide-react';
import {
  TAIWAN_CITIES,
  getDistrictsByCity,
  getPostalCode,
  lookupPostalCode
} from '../../utils/taiwanPostalCodes';

export interface TaiwanAddressValue {
  postalCode?: string;
  city?: string;
  district?: string;
  streetAddress?: string;
  fullAddress?: string;
}

export interface TaiwanAddressPickerProps {
  value?: TaiwanAddressValue | string;
  onChange: (value: TaiwanAddressValue) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  showAutoParse?: boolean;
}

/**
 * 📍 臺灣標準郵遞地址輸入小程式 (TaiwanAddressPicker)
 * 特色：
 * 1. 縣市下拉選單 -> 自動連動鄉鎮市區清單
 * 2. 選定鄉鎮市區 -> 自動帶出中華郵政標準 3 碼 / 3+2 碼郵遞區號
 * 3. 支援手動輸入街道門牌 -> 即時自動組裝 fullAddress
 * 4. 支援智慧貼上解析：貼上任意臺灣完整地址自動反向剖析縣市、市區與郵遞區號
 */
export const TaiwanAddressPicker: React.FC<TaiwanAddressPickerProps> = ({
  value,
  onChange,
  label = '通訊地址',
  required = false,
  disabled = false,
  className = '',
  compact = false,
  showAutoParse = true
}) => {
  // 內部狀態解析
  const [city, setCity] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [postalCode, setPostalCode] = useState<string>('');
  const [streetAddress, setStreetAddress] = useState<string>('');
  const [parseInput, setParseInput] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);

  // 初始化或外部 value 變更時同步
  useEffect(() => {
    if (typeof value === 'string') {
      if (value) {
        const parsed = lookupPostalCode(value);
        if (parsed.city) {
          setCity(parsed.city);
          setDistrict(parsed.district || '');
          setPostalCode(parsed.postalCode || '');
          // 移除郵遞區號、縣市、鄉鎮市區後的剩餘街道
          let rem = value.replace(parsed.postalCode || '', '')
            .replace(parsed.city, '')
            .replace(parsed.district || '', '')
            .trim();
          setStreetAddress(rem);
        } else {
          setStreetAddress(value);
        }
      }
    } else if (value) {
      setCity(value.city || '');
      setDistrict(value.district || '');
      setPostalCode(value.postalCode || '');
      setStreetAddress(value.streetAddress || '');
    }
  }, [value]);

  // 當前縣市之行政區清單
  const districts = city ? getDistrictsByCity(city) : [];

  // 當使用者選取縣市
  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    const newDistList = getDistrictsByCity(newCity);
    const firstDist = newDistList.length > 0 ? newDistList[0].district : '';
    setDistrict(firstDist);

    const newZip = firstDist ? getPostalCode(newCity, firstDist) || '' : '';
    setPostalCode(newZip);

    notifyChange(newCity, firstDist, newZip, streetAddress);
  };

  // 當使用者選取鄉鎮市區
  const handleDistrictChange = (newDist: string) => {
    setDistrict(newDist);
    const newZip = getPostalCode(city, newDist) || '';
    setPostalCode(newZip);

    notifyChange(city, newDist, newZip, streetAddress);
  };

  // 當使用者變更郵遞區號 (允許手動微調如輸入 3+2 碼)
  const handlePostalCodeChange = (newZip: string) => {
    setPostalCode(newZip);
    notifyChange(city, district, newZip, streetAddress);
  };

  // 當使用者變更街路門牌
  const handleStreetChange = (newStreet: string) => {
    setStreetAddress(newStreet);
    notifyChange(city, district, postalCode, newStreet);
  };

  // 通知父元件
  const notifyChange = (c: string, d: string, z: string, s: string) => {
    const parts = [z, c, d, s].filter(Boolean);
    const full = `${c}${d}${s}`.trim();
    const fullWithZip = z ? `${z} ${c}${d}${s}`.trim() : full;

    onChange({
      postalCode: z,
      city: c,
      district: d,
      streetAddress: s,
      fullAddress: fullWithZip
    });
  };

  // 智慧反向解析地址字串
  const handleSmartParse = () => {
    if (!parseInput.trim()) return;
    setIsParsing(true);
    const res = lookupPostalCode(parseInput);
    if (res.city) {
      setCity(res.city);
      setDistrict(res.district || '');
      setPostalCode(res.postalCode || '');

      let rem = parseInput
        .replace(res.postalCode || '', '')
        .replace(res.city, '')
        .replace(res.district || '', '')
        .trim();
      setStreetAddress(rem);
      notifyChange(res.city, res.district || '', res.postalCode || '', rem);
      setParseInput('');
    } else {
      // 無法精準對應，直接置入街道
      setStreetAddress(parseInput.trim());
      notifyChange(city, district, postalCode, parseInput.trim());
      setParseInput('');
    }
    setTimeout(() => setIsParsing(false), 300);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
            <span>{label}</span>
            {required && <span className="text-red-500">*</span>}
          </label>
          {postalCode && (
            <span className="text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
              郵遞區號：{postalCode}
            </span>
          )}
        </div>
      )}

      {/* 智慧地址快速貼上解析列 (選配) */}
      {showAutoParse && (
        <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            value={parseInput}
            onChange={e => setParseInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSmartParse();
              }
            }}
            placeholder="智慧解析：貼上完整地址（如：台北市信義區市府路1號）按解析"
            className="flex-1 bg-transparent border-0 outline-hidden text-xs text-slate-700 placeholder:text-slate-400"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={handleSmartParse}
            disabled={!parseInput.trim() || disabled}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0"
          >
            {isParsing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            <span>自動解析</span>
          </button>
        </div>
      )}

      {/* 選單組合：縣市 + 鄉鎮市區 + 郵遞區號 */}
      <div className="grid grid-cols-12 gap-2">
        {/* 縣市選單 */}
        <div className="col-span-4 sm:col-span-3">
          <select
            value={city}
            onChange={e => handleCityChange(e.target.value)}
            disabled={disabled}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="">選擇縣市</option>
            {TAIWAN_CITIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* 鄉鎮市區選單 */}
        <div className="col-span-4 sm:col-span-3">
          <select
            value={district}
            onChange={e => handleDistrictChange(e.target.value)}
            disabled={disabled || !city}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 font-medium disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">選擇行政區</option>
            {districts.map(d => (
              <option key={d.district} value={d.district}>
                {d.district} ({d.postalCode})
              </option>
            ))}
          </select>
        </div>

        {/* 郵遞區號 (自動帶出，亦支援微調為 3+2 碼) */}
        <div className="col-span-4 sm:col-span-2">
          <div className="relative">
            <input
              type="text"
              value={postalCode}
              onChange={e => handlePostalCodeChange(e.target.value)}
              placeholder="郵遞區號"
              disabled={disabled}
              maxLength={6}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 font-mono font-bold text-center focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* 街道門牌地址輸入 */}
        <div className="col-span-12 sm:col-span-4">
          <input
            type="text"
            value={streetAddress}
            onChange={e => handleStreetChange(e.target.value)}
            placeholder="詳細路名、巷弄、門牌、樓層"
            disabled={disabled}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* 完整地址即時預覽 */}
      {!compact && (city || streetAddress) && (
        <div className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 flex items-center justify-between">
          <span className="truncate">
            完整地址：<strong className="text-slate-800 font-mono">{postalCode ? `${postalCode} ` : ''}{city}{district}{streetAddress}</strong>
          </span>
          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold shrink-0">
            已正規化
          </span>
        </div>
      )}
    </div>
  );
};
