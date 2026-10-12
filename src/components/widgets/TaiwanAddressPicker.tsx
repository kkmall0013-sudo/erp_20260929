import React, { useState, useEffect } from 'react';
import { MapPin, Search, Check, RefreshCw } from 'lucide-react';
import {
  TAIWAN_CITIES,
  getDistrictsByCity,
  getPostalCode,
  getLocationsByPostalCode,
  normalizeTaiwanCity,
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
 * 輔助函式：從完整地址移除前綴之郵遞區號、縣市與鄉鎮，提取純人工住址路段
 */
function extractRemainingStreet(
  rawFull: string,
  zip?: string,
  cityName?: string,
  distName?: string
): string {
  if (!rawFull) return '';
  let rem = rawFull.trim();
  // 移除開頭可能帶有的 3~6 碼郵遞區號
  rem = rem.replace(/^[\[\(（【]?\d{3,6}[\]\)）】]?\s*/, '');
  if (zip) {
    rem = rem.replace(new RegExp(`^${zip.replace(/\D/g, '')}\\s*`), '');
  }
  if (cityName) {
    const cNorm = cityName.replace('台', '臺');
    const cAlias = cityName.replace('臺', '台');
    rem = rem.replace(new RegExp(`^(${cNorm}|${cAlias})\\s*`), '');
  }
  if (distName) {
    rem = rem.replace(new RegExp(`^${distName}\\s*`), '');
  }
  return rem.trim();
}

/**
 * 📍 臺灣標準郵遞地址輸入小程式 (TaiwanAddressPicker)
 * 排列順序：郵遞區號 ➔ 縣市 ➔ 鄉鎮 ➔ 住址
 * 特色：
 * 1. 郵遞區號在最前面：輸入 3 碼郵遞區號後，後面的「縣市」與「鄉鎮」自動改變
 * 2. 選擇「縣市」及「鄉鎮」後，最前面的「郵遞區號」自動改變
 * 3. 剩餘的「住址」（路、街、段、巷、弄、號、樓）由人工輸入並完整保留
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
  const [postalCode, setPostalCode] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [streetAddress, setStreetAddress] = useState<string>('');
  const [parseInput, setParseInput] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [zipUnmatched, setZipUnmatched] = useState<boolean>(false);

  // 初始化或外部 value 變更時同步
  useEffect(() => {
    if (typeof value === 'string') {
      if (value) {
        const parsed = lookupPostalCode(value);
        if (parsed.city) {
          const normCity = normalizeTaiwanCity(parsed.city);
          setCity(normCity);
          setDistrict(parsed.district || '');
          setPostalCode(parsed.postalCode || '');
          const rem =
            parsed.remaining !== undefined
              ? parsed.remaining
              : extractRemainingStreet(value, parsed.postalCode, normCity, parsed.district);
          setStreetAddress(rem);
          setZipUnmatched(false);
        } else {
          setStreetAddress(value);
        }
      } else {
        setPostalCode('');
        setCity('');
        setDistrict('');
        setStreetAddress('');
      }
    } else if (value) {
      let c = normalizeTaiwanCity(value.city || '');
      let d = value.district || '';
      let z = value.postalCode || '';
      let s = value.streetAddress !== undefined ? value.streetAddress : '';

      // 若未提供拆分的 streetAddress 但有 fullAddress，智慧拆解出住址
      if (!s && value.fullAddress) {
        if (!c || !d) {
          const parsed = lookupPostalCode(value.fullAddress);
          if (parsed.city) {
            c = c || normalizeTaiwanCity(parsed.city);
            d = d || parsed.district || '';
            z = z || parsed.postalCode || '';
          }
        }
        s = extractRemainingStreet(value.fullAddress, z, c, d);
      }

      // 若有郵遞區號但無縣市鄉鎮，自動反查補齊
      if (z && (!c || !d)) {
        const matched = getLocationsByPostalCode(z);
        if (matched.length > 0) {
          c = c || matched[0].city;
          d = d || matched[0].district;
        }
      }

      // 若有縣市鄉鎮但無郵遞區號，自動正向補齊
      if (c && d && !z) {
        z = getPostalCode(c, d) || '';
      }

      setPostalCode(z);
      setCity(c);
      setDistrict(d);
      setStreetAddress(s);
      setZipUnmatched(false);
    }
  }, [value]);

  // 當前縣市之行政區清單
  const districts = city ? getDistrictsByCity(city) : [];

  // 通知父元件
  const notifyChange = (z: string, c: string, d: string, s: string) => {
    const full = `${c}${d}${s}`.trim();
    const fullWithZip = z ? `${z} ${full}`.trim() : full;

    onChange({
      postalCode: z,
      city: c,
      district: d,
      streetAddress: s,
      fullAddress: fullWithZip
    });
  };

  // 1. 當使用者在最前面輸入「郵遞區號」 -> 後面的「縣市」與「鄉鎮」自動改變
  const handlePostalCodeChange = (rawZip: string) => {
    // 允許數字與破折號 (如 100 或 100-41 或 10041)
    const cleaned = rawZip.replace(/[^\d-]/g, '');
    setPostalCode(cleaned);

    const digits = cleaned.replace(/\D/g, '');
    if (digits.length >= 3) {
      const matchedList = getLocationsByPostalCode(digits);
      if (matchedList.length > 0) {
        setZipUnmatched(false);
        // 若目前選中的縣市+鄉鎮已經屬於該 3 碼郵遞區號 (例如新竹市 300 或嘉義市 600)，維持原選取行政區
        const stillMatchesCurrent = matchedList.some(
          item => item.city === city && item.district === district
        );
        const target = stillMatchesCurrent
          ? matchedList.find(item => item.city === city && item.district === district)!
          : matchedList[0];

        setCity(target.city);
        setDistrict(target.district);
        notifyChange(cleaned, target.city, target.district, streetAddress);
        return;
      } else {
        setZipUnmatched(true);
      }
    } else {
      setZipUnmatched(false);
    }

    notifyChange(cleaned, city, district, streetAddress);
  };

  // 2. 當使用者選取「縣市」 -> 自動帶出第一個「鄉鎮」且最前面的「郵遞區號」自動改變
  const handleCityChange = (newCity: string) => {
    const normCity = normalizeTaiwanCity(newCity);
    setCity(normCity);
    const newDistList = getDistrictsByCity(normCity);
    const firstDist = newDistList.length > 0 ? newDistList[0].district : '';
    setDistrict(firstDist);

    const newZip = firstDist ? getPostalCode(normCity, firstDist) || '' : '';
    setPostalCode(newZip);
    setZipUnmatched(false);

    notifyChange(newZip, normCity, firstDist, streetAddress);
  };

  // 3. 當使用者選取「鄉鎮」 -> 最前面的「郵遞區號」自動改變
  const handleDistrictChange = (newDist: string) => {
    setDistrict(newDist);
    const newZip = getPostalCode(city, newDist) || '';
    setPostalCode(newZip);
    setZipUnmatched(false);

    notifyChange(newZip, city, newDist, streetAddress);
  };

  // 4. 當使用者人工輸入「住址」
  const handleStreetChange = (newStreet: string) => {
    setStreetAddress(newStreet);
    notifyChange(postalCode, city, district, newStreet);
  };

  // 智慧反向解析地址字串
  const handleSmartParse = () => {
    if (!parseInput.trim()) return;
    setIsParsing(true);
    const res = lookupPostalCode(parseInput);
    if (res.city) {
      const normCity = normalizeTaiwanCity(res.city);
      const dist = res.district || '';
      const zip = res.postalCode || '';
      const rem =
        res.remaining !== undefined
          ? res.remaining
          : extractRemainingStreet(parseInput, zip, normCity, dist);

      setPostalCode(zip);
      setCity(normCity);
      setDistrict(dist);
      setStreetAddress(rem);
      setZipUnmatched(false);
      notifyChange(zip, normCity, dist, rem);
      setParseInput('');
    } else {
      setStreetAddress(parseInput.trim());
      notifyChange(postalCode, city, district, parseInput.trim());
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
          <div className="flex items-center gap-2">
            {zipUnmatched && (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                查無此 3 碼郵遞區號，請確認或由縣市選取
              </span>
            )}
            {postalCode && !zipUnmatched && (
              <span className="text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
                [{postalCode}] {city}{district}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 固定四欄排列：郵遞區號 ➔ 縣市 ➔ 鄉鎮 ➔ 住址 */}
      <div className="grid grid-cols-12 gap-2 items-end">
        {/* 1. 郵遞區號 (最前面：輸入後自動改變縣市與鄉鎮) */}
        <div className="col-span-3 sm:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">
            郵遞區號
          </label>
          <input
            type="text"
            value={postalCode}
            onChange={e => handlePostalCodeChange(e.target.value)}
            placeholder="例: 100"
            disabled={disabled}
            maxLength={7}
            title="輸入 3 碼郵遞區號即可自動帶出縣市與鄉鎮"
            className={`w-full px-2.5 py-1.5 text-xs rounded-lg border bg-white text-slate-900 font-mono font-bold text-center focus:ring-2 focus:ring-indigo-500 ${
              zipUnmatched ? 'border-amber-400 bg-amber-50/40' : 'border-slate-300'
            }`}
          />
        </div>

        {/* 2. 縣市 (選擇後自動連動鄉鎮與最前面的郵遞區號) */}
        <div className="col-span-4 sm:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">
            縣市
          </label>
          <select
            value={city}
            onChange={e => handleCityChange(e.target.value)}
            disabled={disabled}
            className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="">選擇縣市</option>
            {TAIWAN_CITIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* 3. 鄉鎮 (選擇後自動改變最前面的郵遞區號) */}
        <div className="col-span-5 sm:col-span-3">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">
            鄉鎮市區
          </label>
          <select
            value={district}
            onChange={e => handleDistrictChange(e.target.value)}
            disabled={disabled || !city}
            className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 font-medium disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">選擇鄉鎮市區</option>
            {districts.map(d => (
              <option key={d.district} value={d.district}>
                {d.district} ({d.postalCode})
              </option>
            ))}
          </select>
        </div>

        {/* 4. 住址 (剩餘住址由人工輸入) */}
        <div className="col-span-12 sm:col-span-5">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">
            住址（路街段巷弄號樓，人工輸入）
          </label>
          <input
            type="text"
            value={streetAddress}
            onChange={e => handleStreetChange(e.target.value)}
            placeholder="請人工輸入剩餘住址（如：重慶南路一段122號）"
            disabled={disabled}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* 智慧地址快速貼上解析列 (選配輔助) */}
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
            placeholder="整串地址快速貼上拆解（選填，如：248新北市五股區成泰路三段12號）"
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
            <span>拆解填入</span>
          </button>
        </div>
      )}

      {/* 完整地址即時預覽 */}
      {!compact && (postalCode || city || streetAddress) && (
        <div className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200 flex items-center justify-between">
          <span className="truncate">
            組合完整地址：<strong className="text-slate-800 font-mono">{postalCode ? `${postalCode} ` : ''}{city}{district}{streetAddress}</strong>
          </span>
          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold shrink-0">
            郵遞區號 ➔ 縣市 ➔ 鄉鎮 ➔ 住址
          </span>
        </div>
      )}
    </div>
  );
};

