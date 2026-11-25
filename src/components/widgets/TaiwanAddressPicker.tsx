import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Search,
  Check,
  RefreshCw,
  AlertTriangle,
  Archive,
  History,
  ChevronDown,
  ChevronUp,
  Copy
} from 'lucide-react';
import { AddressHistoryEntry } from '../../types/erp';
import { subscribeToDatabase } from '../../db/sqlite';
import {
  getTaiwanCities,
  getDistrictsByCity,
  getPostalCode,
  getLocationsByPostalCode,
  normalizeTaiwanCity,
  normalizeTaiwanDistrict,
  lookupPostalCode,
  findDeprecatedDistrictInfo
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
  addressHistory?: AddressHistoryEntry[];
  onArchiveAndUpdate?: (archived: AddressHistoryEntry, newValue: TaiwanAddressValue) => void;
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
  rem = rem.replace(/^[\[\(（【]\d{3,6}(?:-\d{2,3})?[\]\)）】]\s*/, '');
  if (zip) {
    const zipDigits = zip.replace(/\D/g, '');
    if (zipDigits) {
      rem = rem.replace(new RegExp(`^${zipDigits}(?:-\\d{2,3})?\\s*`), '');
    }
  }
  if (cityName || distName) {
    rem = rem.replace(/^\d{3,6}(?:-\d{2,3})?\s*(?=[^\d])/, '');
  }
  if (cityName) {
    const cNorm = cityName.replace(/台/g, '臺');
    const cAlias = cityName.replace(/臺/g, '台');
    rem = rem.replace(new RegExp(`^(${cNorm}|${cAlias})\\s*`), '');
  }
  if (distName) {
    const dNorm = distName.replace(/台/g, '臺');
    const dAlias = distName.replace(/臺/g, '台');
    rem = rem.replace(new RegExp(`^(${dNorm}|${dAlias})\\s*`), '');
  }
  return rem.trim();
}

function formatArchivedTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

/**
 * 📍 臺灣標準郵遞地址輸入小程式 (TaiwanAddressPicker)
 * 排列順序：郵遞區號 ➔ 縣市 ➔ 鄉鎮 ➔ 住址
 * 特色：
 * 1. 動態讀取 SQLite 郵遞區號微型資料庫 (taiwan_postal_codes)
 * 2. 雙向連動：郵遞區號 ↔ 縣市/鄉鎮，絕不覆寫人工住址欄
 * 3. 非破壞性行政區異動提示（舊制地址保留原樣顯示，不自動改寫）
 * 4. 選配「留存舊址為歷史參考並改填新址」輕量紀錄功能
 */
export const TaiwanAddressPicker: React.FC<TaiwanAddressPickerProps> = ({
  value,
  onChange,
  label = '通訊地址',
  required = false,
  disabled = false,
  className = '',
  compact = false,
  showAutoParse = true,
  addressHistory,
  onArchiveAndUpdate
}) => {
  const [postalCode, setPostalCode] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [streetAddress, setStreetAddress] = useState<string>('');
  const [parseInput, setParseInput] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [zipUnmatched, setZipUnmatched] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [, setCatalogTick] = useState<number>(0);

  // 訂閱資料庫變動，讓郵局表增修即時反映於各表單下拉選單
  useEffect(() => {
    const unsub = subscribeToDatabase(() => {
      setCatalogTick(t => t + 1);
    });
    return () => unsub();
  }, []);

  // 追蹤自身最後一次向外發出的值，避免父層回傳相同 prop 時重複觸發 useEffect 覆蓋輸入中狀態
  const lastEmittedRef = useRef<{ fullAddress: string; key: string } | null>(null);

  // 初始化或外部 value 變更時同步
  useEffect(() => {
    if (typeof value === 'string') {
      if (lastEmittedRef.current && value === lastEmittedRef.current.fullAddress) {
        return;
      }
      const trimmed = value.trim();
      if (!trimmed) {
        setPostalCode('');
        setCity('');
        setDistrict('');
        setStreetAddress('');
        setZipUnmatched(false);
        return;
      }

      if (/^\d{1,6}(-\d{0,3})?$/.test(trimmed)) {
        const matched = getLocationsByPostalCode(trimmed, { includeInactive: true });
        setPostalCode(trimmed);
        if (matched.length > 0) {
          setCity(matched[0].city);
          setDistrict(matched[0].district);
          setZipUnmatched(false);
        } else {
          setCity('');
          setDistrict('');
          setZipUnmatched(trimmed.replace(/\D/g, '').length >= 3);
        }
        setStreetAddress('');
        return;
      }

      const parsed = lookupPostalCode(trimmed);
      if (parsed.city) {
        const normCity = normalizeTaiwanCity(parsed.city);
        const dist = parsed.district || '';
        const zip = parsed.postalCode || (dist ? getPostalCode(normCity, dist) || '' : '');
        const rem =
          parsed.remaining !== undefined
            ? parsed.remaining
            : extractRemainingStreet(trimmed, zip, normCity, dist);
        setCity(normCity);
        setDistrict(dist);
        setPostalCode(zip);
        setStreetAddress(rem);
        setZipUnmatched(false);
      } else {
        setPostalCode('');
        setCity('');
        setDistrict('');
        setStreetAddress(trimmed);
        setZipUnmatched(false);
      }
    } else if (value) {
      const incomingZ = value.postalCode || '';
      const incomingC = normalizeTaiwanCity(value.city || '');
      const incomingD = normalizeTaiwanDistrict(value.district || '');
      const incomingS = value.streetAddress !== undefined ? value.streetAddress : undefined;
      const incomingFull = value.fullAddress || '';

      const incomingKey = JSON.stringify([
        incomingZ,
        incomingC,
        incomingD,
        incomingS ?? '',
        incomingFull
      ]);
      if (lastEmittedRef.current && incomingKey === lastEmittedRef.current.key) {
        return;
      }

      let c = incomingC;
      let d = incomingD;
      let z = incomingZ;
      let s = incomingS !== undefined ? incomingS : '';

      if (incomingS === undefined && incomingFull) {
        if (!c || !d) {
          const parsed = lookupPostalCode(incomingFull);
          if (parsed.city) {
            c = c || normalizeTaiwanCity(parsed.city);
            d = d || parsed.district || '';
            z = z || parsed.postalCode || '';
          }
        }
        s = extractRemainingStreet(incomingFull, z, c, d);
      }

      if (z && (!c || !d)) {
        const matched = getLocationsByPostalCode(z, { includeInactive: true });
        if (matched.length > 0) {
          c = c || matched[0].city;
          d = d || matched[0].district;
        }
      }

      if (c && d && !z) {
        z = getPostalCode(c, d) || '';
      }

      setPostalCode(z);
      setCity(c);
      setDistrict(d);
      setStreetAddress(s);
      setZipUnmatched(false);
    } else {
      setPostalCode('');
      setCity('');
      setDistrict('');
      setStreetAddress('');
      setZipUnmatched(false);
    }
  }, [value]);

  // 動態讀取現行啟用縣市與行政區
  const activeCities = getTaiwanCities(false);
  const hasLegacyCity = Boolean(city && !activeCities.includes(city));

  const activeDistricts = city ? getDistrictsByCity(city, { includeInactive: false }) : [];
  const allCityDistricts = city ? getDistrictsByCity(city, { includeInactive: true }) : [];
  const hasLegacyDistrict = Boolean(
    district && !activeDistricts.some(d => d.district === district)
  );
  const legacyDistrictInfo = hasLegacyDistrict
    ? allCityDistricts.find(d => d.district === district)
    : undefined;

  // 檢查是否命中郵局表停用／行政區改制警示（僅提醒，絕不自動改寫）
  const deprecatedInfo = findDeprecatedDistrictInfo(city, district);

  // 通知父元件
  const notifyChange = (z: string, c: string, d: string, s: string) => {
    const full = `${c}${d}${s}`.trim();
    const fullWithZip = full ? (z ? `${z} ${full}`.trim() : full) : '';
    const payload: TaiwanAddressValue = {
      postalCode: z,
      city: c,
      district: d,
      streetAddress: s,
      fullAddress: fullWithZip
    };
    lastEmittedRef.current = {
      fullAddress: fullWithZip,
      key: JSON.stringify([z, c, d, s, fullWithZip])
    };
    onChange(payload);
  };

  // 1. 輸入郵遞區號 -> 自動帶出縣市與鄉鎮（現行優先，相容歷史停用）
  const handlePostalCodeChange = (rawZip: string) => {
    const cleaned = rawZip.replace(/[^\d-]/g, '');
    setPostalCode(cleaned);

    const digits = cleaned.replace(/\D/g, '');
    if (digits.length >= 3) {
      const matchedActive = getLocationsByPostalCode(digits, { includeInactive: false });
      const matchedList =
        matchedActive.length > 0
          ? matchedActive
          : getLocationsByPostalCode(digits, { includeInactive: true });
      if (matchedList.length > 0) {
        setZipUnmatched(false);
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

  // 2. 選取縣市 -> 自動帶出第一個現行鄉鎮與郵遞區號（保留人工住址欄）
  const handleCityChange = (newCity: string) => {
    if (!newCity) {
      setCity('');
      setDistrict('');
      setPostalCode('');
      setZipUnmatched(false);
      notifyChange('', '', '', streetAddress);
      return;
    }
    const normCity = normalizeTaiwanCity(newCity);
    setCity(normCity);
    const activeList = getDistrictsByCity(normCity, { includeInactive: false });
    const newDistList =
      activeList.length > 0
        ? activeList
        : getDistrictsByCity(normCity, { includeInactive: true });
    const firstDist = newDistList.length > 0 ? newDistList[0].district : '';
    setDistrict(firstDist);

    const newZip = firstDist ? getPostalCode(normCity, firstDist) || '' : '';
    setPostalCode(newZip);
    setZipUnmatched(false);

    notifyChange(newZip, normCity, firstDist, streetAddress);
  };

  // 3. 選取鄉鎮 -> 自動帶出郵遞區號（保留人工住址欄）
  const handleDistrictChange = (newDist: string) => {
    setDistrict(newDist);
    const newZip = newDist ? getPostalCode(city, newDist) || '' : '';
    setPostalCode(newZip);
    setZipUnmatched(false);

    notifyChange(newZip, city, newDist, streetAddress);
  };

  // 4. 人工輸入住址
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

  // 留存目前舊址為靜態歷史參考，並清空現役欄位供填寫新址
  const hasCurrentAddressContent = Boolean(
    postalCode.trim() || city.trim() || district.trim() || streetAddress.trim()
  );

  const handleArchiveCurrentAddress = () => {
    if (!onArchiveAndUpdate || !hasCurrentAddressContent || disabled) return;
    const full = `${city}${district}${streetAddress}`.trim();
    const fullWithZip = full ? (postalCode ? `${postalCode} ${full}`.trim() : full) : '';
    const archivedEntry: AddressHistoryEntry = {
      id: `ADDRHIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      postalCode: postalCode.trim(),
      city: city.trim(),
      district: district.trim(),
      streetAddress: streetAddress.trim(),
      fullAddress: fullWithZip || streetAddress.trim() || postalCode.trim(),
      archivedAt: new Date().toISOString()
    };
    const emptyVal: TaiwanAddressValue = {
      postalCode: '',
      city: '',
      district: '',
      streetAddress: '',
      fullAddress: ''
    };
    lastEmittedRef.current = null;
    setPostalCode('');
    setCity('');
    setDistrict('');
    setStreetAddress('');
    setZipUnmatched(false);
    setShowHistory(true);
    onArchiveAndUpdate(archivedEntry, emptyVal);
  };

  // 一鍵套用建議新制縣市／行政區（保留原路街段，由使用者手動點擊觸發）
  const handleApplySuggestedReplacement = () => {
    if (!deprecatedInfo || disabled) return;
    const nextCity = deprecatedInfo.replacedByCity
      ? normalizeTaiwanCity(deprecatedInfo.replacedByCity)
      : city;
    const nextDist = deprecatedInfo.replacedByDistrict || district;
    const nextZip = nextCity && nextDist ? getPostalCode(nextCity, nextDist) || postalCode : postalCode;
    setCity(nextCity);
    setDistrict(nextDist);
    setPostalCode(nextZip);
    setZipUnmatched(false);
    notifyChange(nextZip, nextCity, nextDist, streetAddress);
  };

  const historyCount = addressHistory?.length || 0;

  return (
    <div className={`space-y-2 ${className}`}>
      {(label || onArchiveAndUpdate || historyCount > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {label ? (
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>{label}</span>
              {required && <span className="text-red-500">*</span>}
            </label>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {zipUnmatched && (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                查無此 3 碼郵遞區號，請確認或由縣市選取
              </span>
            )}
            {postalCode && !zipUnmatched && (
              <span className="text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
                [{postalCode}] {city}
                {district}
              </span>
            )}
            {onArchiveAndUpdate && !disabled && (
              <button
                type="button"
                onClick={handleArchiveCurrentAddress}
                disabled={!hasCurrentAddressContent}
                title="將目前這筆地址保留到下方歷史舊址清單（唯讀參考），並清空欄位輸入新地址"
                className="px-2 py-0.5 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed text-amber-800 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Archive className="w-3 h-3" />
                <span>留存舊址並改填新址</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 固定四欄排列：郵遞區號 ➔ 縣市 ➔ 鄉鎮 ➔ 住址 */}
      <div className="grid grid-cols-12 gap-2 items-end">
        {/* 1. 郵遞區號 */}
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

        {/* 2. 縣市 */}
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
            {hasLegacyCity && (
              <option value={city}>{city}（歷史／停用）</option>
            )}
            {activeCities.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* 3. 鄉鎮 */}
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
            {hasLegacyDistrict && (
              <option value={district}>
                {district}
                {legacyDistrictInfo?.postalCode ? ` (${legacyDistrictInfo.postalCode})` : ''}（歷史／停用）
              </option>
            )}
            {activeDistricts.map(d => (
              <option key={d.id || d.district} value={d.district}>
                {d.district} ({d.postalCode})
              </option>
            ))}
          </select>
        </div>

        {/* 4. 住址 */}
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

      {/* 非破壞性歷史行政區／停用郵遞區號提示（僅提示，不主動改寫原資料） */}
      {deprecatedInfo && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>行政區沿革提示：</strong>
              「{deprecatedInfo.city}
              {deprecatedInfo.district}」於郵遞區號表中已標記為歷史／停用（系統已保留此舊址不自動改寫）
              {(deprecatedInfo.replacedByCity || deprecatedInfo.replacedByDistrict) && (
                <span className="font-bold text-amber-800 ml-1">
                  ➔ 對應現行區域：{deprecatedInfo.replacedByCity || deprecatedInfo.city}
                  {deprecatedInfo.replacedByDistrict || ''}
                </span>
              )}
              {deprecatedInfo.note ? `（${deprecatedInfo.note}）` : ''}
            </span>
          </div>
          {!disabled && (deprecatedInfo.replacedByCity || deprecatedInfo.replacedByDistrict) && (
            <button
              type="button"
              onClick={handleApplySuggestedReplacement}
              className="px-2 py-0.5 rounded bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-[10px] cursor-pointer shrink-0"
            >
              套用新制區域
            </button>
          )}
        </div>
      )}

      {/* 智慧地址快速貼上解析列 */}
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
            組合完整地址：
            <strong className="text-slate-800 font-mono">
              {postalCode ? `${postalCode} ` : ''}
              {city}
              {district}
              {streetAddress}
            </strong>
          </span>
          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold shrink-0">
            郵遞區號 ➔ 縣市 ➔ 鄉鎮 ➔ 住址
          </span>
        </div>
      )}

      {/* 歷史留存舊址參考 (唯讀靜態參考清單) */}
      {historyCount > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-100/70 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowHistory(prev => !prev)}
            className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>歷史留存舊址參考（唯讀靜態資料，共 {historyCount} 筆）</span>
            </span>
            {showHistory ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {showHistory && (
            <div className="px-3 pb-2.5 pt-1 space-y-1.5 border-t border-slate-200/80">
              {addressHistory!.map((entry, hIdx) => (
                <div
                  key={entry.id || hIdx}
                  className="p-2 rounded-md bg-white/90 border border-slate-200 text-[11px] flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-mono font-semibold text-slate-700 break-all">
                      {entry.postalCode ? `[${entry.postalCode}] ` : ''}
                      {entry.city || ''}
                      {entry.district || ''}
                      {entry.streetAddress || (!entry.city && !entry.district ? entry.fullAddress : '')}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      封存時間：{formatArchivedTime(entry.archivedAt)}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </div>
                  </div>
                  {!disabled && entry.streetAddress && (
                    <button
                      type="button"
                      onClick={() => {
                        setStreetAddress(entry.streetAddress || '');
                        notifyChange(postalCode, city, district, entry.streetAddress || '');
                      }}
                      title="僅複製舊址的路街段至目前住址欄（方便沿用原址門牌、只改新版郵遞區號或行政區）"
                      className="px-2 py-0.5 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>帶入原路街段</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
