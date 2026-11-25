import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Search,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Check,
  X,
  Info,
  Archive,
  Building2
} from 'lucide-react';
import { TaiwanPostalCityRecord, TaiwanPostalCodeRecord } from '../../types/erp';
import { useAuth } from '../../context/AuthContext';
import {
  getAllTaiwanPostalCities,
  getAllTaiwanPostalCodes,
  saveTaiwanPostalCity,
  saveTaiwanPostalCode,
  deleteTaiwanPostalCode,
  resetTaiwanPostalCodesToDefault,
  subscribeToDatabase
} from '../../db/sqlite';
import {
  compareDistrictPostal,
  matchesTaiwanRegion
} from '../../utils/taiwanPostalCodes';
import { ConfirmDialogModal } from './ConfirmDialogModal';

export interface PostalCodeDirectoryPanelProps {
  onSelectDistrict?: (record: TaiwanPostalCodeRecord) => void;
  onNotify?: (msg: string) => void;
}

interface EditorFormState {
  id?: string;
  city: string;
  district: string;
  postalCode: string;
  isActive: boolean;
  aliasesText: string;
  replacedByCity: string;
  replacedByDistrict: string;
  note: string;
}

interface CityEditorFormState {
  cityId?: string;
  oldCityName: string;
  newCityName: string;
  aliasesText: string;
  keepOldNameAsAlias: boolean;
  isActive: boolean;
  note: string;
}

const EMPTY_FORM: EditorFormState = {
  city: '',
  district: '',
  postalCode: '',
  isActive: true,
  aliasesText: '',
  replacedByCity: '',
  replacedByDistrict: '',
  note: ''
};

/**
 * 📮 中華郵政「牆上分區一覽表」微型資料庫與管理面板
 * - 依「郵遞區號由小到大」嚴格排序縣市與轄下鄉鎮市區（例：臺北市固定由 100 中正區排在最上方）
 * - 支援「縣市變數 (a) 一鍵更名與設別名」，轄下所有鄉鎮區 (a-1, a-2, a-3) 自動連動更新，無須逐筆改寫
 * - 異動時僅更新微型資料庫與雙向搜尋別名圖，絕不自動改寫既有夥伴、公司或案場舊地址
 */
export const PostalCodeDirectoryPanel: React.FC<PostalCodeDirectoryPanelProps> = ({
  onSelectDistrict,
  onNotify
}) => {
  const { currentUser, isSuperadmin, isBoss, can } = useAuth();
  const canManage =
    isSuperadmin ||
    isBoss ||
    can('SYSTEM_CONFIGS', 'write') ||
    Boolean(currentUser?.canManageSystemConfigs);
  const operatorName = currentUser?.fullName || '系統管理員';

  const [cities, setCities] = useState<TaiwanPostalCityRecord[]>(() =>
    getAllTaiwanPostalCities()
  );
  const [records, setRecords] = useState<TaiwanPostalCodeRecord[]>(() =>
    getAllTaiwanPostalCodes()
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [showInactive, setShowInactive] = useState<boolean>(true);

  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [formState, setFormState] = useState<EditorFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [cityEditorState, setCityEditorState] = useState<CityEditorFormState | null>(null);
  const [cityEditorError, setCityEditorError] = useState<string | null>(null);

  const [inlineToast, setInlineToast] = useState<string | null>(null);
  const [pendingDeleteRecord, setPendingDeleteRecord] =
    useState<TaiwanPostalCodeRecord | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);

  useEffect(() => {
    const sync = () => {
      setCities(getAllTaiwanPostalCities());
      setRecords(getAllTaiwanPostalCodes());
    };
    sync();
    const unsub = subscribeToDatabase(sync);
    return () => unsub();
  }, []);

  const notify = (msg: string) => {
    setInlineToast(msg);
    onNotify?.(msg);
    setTimeout(() => {
      setInlineToast(curr => (curr === msg ? null : curr));
    }, 3400);
  };

  const cityMetaByName = useMemo(() => {
    const map = new Map<string, TaiwanPostalCityRecord>();
    for (const c of cities) {
      map.set(c.cityName, c);
    }
    return map;
  }, [cities]);

  const uniqueCities = useMemo(() => {
    const cityMinZip = new Map<string, number>();
    for (const r of records) {
      const z = Number(String(r.postalCode || '').replace(/\D/g, '').slice(0, 6)) || 999999;
      const prev = cityMinZip.get(r.city);
      if (prev === undefined || z < prev) cityMinZip.set(r.city, z);
    }
    const names = Array.from(new Set([...records.map(r => r.city), ...cities.map(c => c.cityName)])).filter(Boolean);
    return names.sort((a, b) => {
      const minA = cityMinZip.get(a) ?? 999999;
      const minB = cityMinZip.get(b) ?? 999999;
      if (minA !== minB) return minA - minB;
      return a.localeCompare(b, 'zh-Hant');
    });
  }, [records, cities]);

  const activeCount = useMemo(
    () =>
      records.filter(r => {
        const cMeta = cityMetaByName.get(r.city);
        return r.isActive !== false && (cMeta ? cMeta.isActive !== false : true);
      }).length,
    [records, cityMetaByName]
  );
  const inactiveCount = records.length - activeCount;

  const filteredGrouped = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = records.filter(r => {
      const cMeta = cityMetaByName.get(r.city);
      const effectiveActive = r.isActive !== false && (cMeta ? cMeta.isActive !== false : true);
      if (!showInactive && !effectiveActive) return false;
      if (cityFilter !== 'ALL' && r.city !== cityFilter) return false;
      if (!q) return true;
      const hitZip = r.postalCode.toLowerCase().includes(q);
      const hitCity =
        r.city.toLowerCase().includes(q) || matchesTaiwanRegion(r.city, searchTerm);
      const hitCityAlias = (cMeta?.aliases || []).some(
        a => a.toLowerCase().includes(q) || matchesTaiwanRegion(a, searchTerm)
      );
      const hitDist =
        r.district.toLowerCase().includes(q) ||
        matchesTaiwanRegion(r.district, searchTerm);
      const hitAlias = (r.aliases || []).some(
        a => a.toLowerCase().includes(q) || matchesTaiwanRegion(a, searchTerm)
      );
      const hitReplacement =
        (r.replacedByCity || '').toLowerCase().includes(q) ||
        (r.replacedByDistrict || '').toLowerCase().includes(q);
      const hitNote = (r.note || '').toLowerCase().includes(q);
      return hitZip || hitCity || hitCityAlias || hitDist || hitAlias || hitReplacement || hitNote;
    });

    const groupedMap = new Map<string, TaiwanPostalCodeRecord[]>();
    for (const item of filtered) {
      if (!groupedMap.has(item.city)) {
        groupedMap.set(item.city, []);
      }
      groupedMap.get(item.city)!.push(item);
    }

    // 每個縣市內部嚴格依郵遞區號由小到大排序，縣市卡片依該縣市最小郵遞區號排序
    const entries = Array.from(groupedMap.entries()).map(([cityName, items]) => {
      const sortedItems = [...items].sort(compareDistrictPostal);
      const minZip =
        Number(String(sortedItems[0]?.postalCode || '').replace(/\D/g, '').slice(0, 6)) || 999999;
      return { cityName, items: sortedItems, minZip };
    });

    entries.sort((a, b) => {
      if (a.minZip !== b.minZip) return a.minZip - b.minZip;
      return a.cityName.localeCompare(b.cityName, 'zh-Hant');
    });

    return entries;
  }, [records, cities, cityMetaByName, searchTerm, cityFilter, showInactive]);

  const handleOpenCreate = () => {
    if (!canManage) return;
    setCityEditorState(null);
    setFormError(null);
    setFormState({
      ...EMPTY_FORM,
      city: cityFilter !== 'ALL' ? cityFilter : ''
    });
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (rec: TaiwanPostalCodeRecord) => {
    if (!canManage) return;
    setCityEditorState(null);
    setFormError(null);
    setFormState({
      id: rec.id,
      city: rec.city,
      district: rec.district,
      postalCode: rec.postalCode,
      isActive: rec.isActive !== false,
      aliasesText: (rec.aliases || []).join(', '),
      replacedByCity: rec.replacedByCity || '',
      replacedByDistrict: rec.replacedByDistrict || '',
      note: rec.note || ''
    });
    setIsEditorOpen(true);
  };

  const handleOpenCityEditor = (cityName: string) => {
    if (!canManage) return;
    setIsEditorOpen(false);
    setCityEditorError(null);
    const meta = cityMetaByName.get(cityName);
    setCityEditorState({
      cityId: meta?.id,
      oldCityName: cityName,
      newCityName: cityName,
      aliasesText: (meta?.aliases || []).join(', '),
      keepOldNameAsAlias: true,
      isActive: meta ? meta.isActive !== false : true,
      note: meta?.note || ''
    });
  };

  const handleSubmitCityForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !cityEditorState) return;
    const cleanNew = cityEditorState.newCityName.trim();
    if (!cleanNew) {
      setCityEditorError('縣市名稱不可為空');
      return;
    }

    const aliases = cityEditorState.aliasesText
      .split(/[,，、;；\s]+/)
      .map(s => s.trim())
      .filter(Boolean);

    try {
      const savedCity = saveTaiwanPostalCity(
        {
          cityId: cityEditorState.cityId,
          oldCityName: cityEditorState.oldCityName,
          newCityName: cleanNew,
          aliases,
          keepOldNameAsAlias: cityEditorState.keepOldNameAsAlias,
          isActive: cityEditorState.isActive,
          note: cityEditorState.note.trim() || undefined
        },
        operatorName
      );
      if (cityFilter === cityEditorState.oldCityName) {
        setCityFilter(savedCity.cityName);
      }
      setCityEditorState(null);
      setCityEditorError(null);
      notify(
        `✅ 已更新縣市變數：【${cityEditorState.oldCityName} ➔ ${savedCity.cityName}】（轄下全部鄉鎮市區已自動連動）`
      );
    } catch (err: any) {
      setCityEditorError(err?.message || '儲存失敗');
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    const cleanCity = formState.city.trim();
    const cleanDistrict = formState.district.trim();
    const cleanZip = formState.postalCode.trim().replace(/[^\d-]/g, '');

    if (!cleanCity || !cleanDistrict || !cleanZip) {
      setFormError('縣市、鄉鎮市區與郵遞區號為必填欄位');
      return;
    }
    if (!/^\d{3}(-\d{2,3})?$/.test(cleanZip)) {
      setFormError('郵遞區號請輸入 3 碼數字（例：100、630）');
      return;
    }

    const aliases = formState.aliasesText
      .split(/[,，、;；\s]+/)
      .map(s => s.trim())
      .filter(Boolean);

    try {
      const saved = saveTaiwanPostalCode(
        {
          id: formState.id,
          city: cleanCity,
          district: cleanDistrict,
          postalCode: cleanZip,
          isActive: formState.isActive,
          aliases,
          replacedByCity: formState.replacedByCity.trim() || undefined,
          replacedByDistrict: formState.replacedByDistrict.trim() || undefined,
          note: formState.note.trim() || undefined
        },
        operatorName
      );
      setIsEditorOpen(false);
      setFormState(EMPTY_FORM);
      setFormError(null);
      notify(`✅ 已更新郵局郵遞區號表：【${saved.city} ${saved.district} ${saved.postalCode}】`);
    } catch (err: any) {
      setFormError(err?.message || '儲存失敗');
    }
  };

  const handleConfirmDelete = () => {
    if (!pendingDeleteRecord || !canManage) return;
    const target = pendingDeleteRecord;
    setPendingDeleteRecord(null);
    const ok = deleteTaiwanPostalCode(target.id, operatorName);
    if (ok) {
      notify(`🗑️ 已移除郵局表項目：【${target.city} ${target.district} ${target.postalCode}】`);
    }
  };

  const handleConfirmReset = () => {
    if (!canManage) return;
    setIsResetConfirmOpen(false);
    resetTaiwanPostalCodesToDefault(operatorName);
    setCityFilter('ALL');
    notify('🔄 已還原中華郵政官方預設 22 縣市、368 鄉鎮市區清單');
  };

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-4">
      {/* 標題與統計列 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                中華郵政「牆上分區一覽表」微型資料庫
              </h3>
              <span className="text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                現行 {activeCount} 區
              </span>
              {inactiveCount > 0 && (
                <span className="text-[11px] font-mono font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                  歷史停用 {inactiveCount} 筆
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              全表固定依「郵遞區號由小到大」排列（如 100 永遠排在最前面）；點選任一縣市標題旁「更名/別名」即可一鍵修改縣市名稱並自動連動全部下屬鄉鎮區。
              {!canManage && '（目前為唯讀查表權限）'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {inlineToast && (
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
              {inlineToast}
            </span>
          )}
          {canManage && (
            <>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新增行政區／郵遞區號</span>
              </button>
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>還原官方 368 區</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 原則提醒橫幅 */}
      <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2 text-[11px] text-slate-600">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-800">縣市連動與歷史保護規則：</strong>
          若縣市改名或升格（例如將 <code>臺北市</code> 改名 <code>台灣市</code>，或將 <code>臺北縣</code> 改為 <code>新北市</code>），直接點選該縣市標題的「<strong>更名/別名</strong>」即可一次連動全部子區，無須逐筆編輯。
          <strong>所有異動皆不會自動改寫</strong>既有的合作廠商、業主、公司法人與工程案場歷史地址。
        </div>
      </div>

      {/* 內嵌縣市變數編修面板 (一鍵更名 + 縣市別名) */}
      {cityEditorState && canManage && (
        <form
          onSubmit={handleSubmitCityForm}
          className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-700" />
              <span>
                縣市變數編修：【{cityEditorState.oldCityName}】（儲存後轄下所有鄉鎮市區自動連動更新）
              </span>
            </h4>
            <button
              type="button"
              onClick={() => {
                setCityEditorState(null);
                setCityEditorError(null);
              }}
              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {cityEditorError && (
            <div className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              ⚠️ {cityEditorError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                現行縣市名稱（變數 a） <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={cityEditorState.newCityName}
                onChange={e =>
                  setCityEditorState(s => (s ? { ...s, newCityName: e.target.value } : s))
                }
                placeholder="例：台灣市 或 新北市"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                舊名／搜尋別名（逗號分隔，支援雙向搜尋）
              </label>
              <input
                type="text"
                value={cityEditorState.aliasesText}
                onChange={e =>
                  setCityEditorState(s => (s ? { ...s, aliasesText: e.target.value } : s))
                }
                placeholder="例：臺北縣, 臺北市"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div className="flex items-end">
              <label className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cityEditorState.isActive}
                  onChange={e =>
                    setCityEditorState(s => (s ? { ...s, isActive: e.target.checked } : s))
                  }
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-slate-800">
                  {cityEditorState.isActive ? '此縣市現行啟用' : '整縣市設為歷史停用'}
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-emerald-900 font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={cityEditorState.keepOldNameAsAlias}
                onChange={e =>
                  setCityEditorState(s =>
                    s ? { ...s, keepOldNameAsAlias: e.target.checked } : s
                  )
                }
                className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                改名時自動將「{cityEditorState.oldCityName}」加入搜尋別名（確保舊名 ↔ 新名搜尋互通）
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCityEditorState(null);
                  setCityEditorError(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>儲存縣市設定並連動子區</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 內嵌單區新增 / 編輯精簡表單 */}
      {isEditorOpen && canManage && (
        <form
          onSubmit={handleSubmitForm}
          className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-indigo-950">
              {formState.id ? '編修郵局郵遞區號項目' : '新增郵局郵遞區號項目（存檔後自動依郵遞區號由小到大排列）'}
            </h4>
            <button
              type="button"
              onClick={() => {
                setIsEditorOpen(false);
                setFormError(null);
              }}
              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              ⚠️ {formError}
            </div>
          )}

          {/* 核心 3 欄位 */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                縣市名稱 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formState.city}
                onChange={e => setFormState(s => ({ ...s, city: e.target.value }))}
                placeholder="例：雲林縣 / 臺北市"
                list="postal-city-datalist"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-semibold"
                required
              />
              <datalist id="postal-city-datalist">
                {uniqueCities.map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                鄉鎮市區名稱 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formState.district}
                onChange={e => setFormState(s => ({ ...s, district: e.target.value }))}
                placeholder="例：中正區 / 斗南鎮"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                郵遞區號 (3 碼) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formState.postalCode}
                onChange={e =>
                  setFormState(s => ({
                    ...s,
                    postalCode: e.target.value.replace(/[^\d-]/g, '')
                  }))
                }
                maxLength={7}
                placeholder="例：100"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono font-bold"
                required
              />
            </div>

            <div className="flex items-end">
              <label className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={e =>
                    setFormState(s => ({ ...s, isActive: e.target.checked }))
                  }
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-800">
                  {formState.isActive ? '現行啟用' : '歷史停用（僅供對照）'}
                </span>
              </label>
            </div>
          </div>

          {/* 選填改制與別名欄位 */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 mb-1">
                舊名／搜尋別名（選填，逗號分隔，支援雙向搜尋）
              </label>
              <input
                type="text"
                value={formState.aliasesText}
                onChange={e =>
                  setFormState(s => ({ ...s, aliasesText: e.target.value }))
                }
                placeholder="例：中壢市, 桃園縣"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">
                對應新制縣市（選填）
              </label>
              <input
                type="text"
                value={formState.replacedByCity}
                onChange={e =>
                  setFormState(s => ({ ...s, replacedByCity: e.target.value }))
                }
                placeholder="例：桃園市"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">
                對應新制鄉鎮（選填）
              </label>
              <input
                type="text"
                value={formState.replacedByDistrict}
                onChange={e =>
                  setFormState(s => ({
                    ...s,
                    replacedByDistrict: e.target.value
                  }))
                }
                placeholder="例：中壢區"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <input
              type="text"
              value={formState.note}
              onChange={e => setFormState(s => ({ ...s, note: e.target.value }))}
              placeholder="備註說明（選填，例：區界調整）"
              className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
            />
            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsEditorOpen(false);
                  setFormError(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>儲存此郵遞區號項目</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 篩選搜尋列 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="快速搜尋郵遞區號 (如 100、630)、縣市 (雲林/台北/台灣市)、鄉鎮 (中正/斗南/台西) 或別名..."
            className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-hidden"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={cityFilter}
          onChange={e => setCityFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-semibold text-slate-700"
        >
          <option value="ALL">全部縣市（{uniqueCities.length} 縣市）</option>
          {uniqueCities.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>顯示歷史停用項</span>
        </label>
      </div>

      {/* 郵局牆上分區表格展示區 */}
      {filteredGrouped.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          查無符合條件的縣市或鄉鎮市區資料
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 max-h-[540px] overflow-y-auto pr-1">
          {filteredGrouped.map(({ cityName, items: cityItems }) => {
            const cMeta = cityMetaByName.get(cityName);
            const cityInactive = cMeta?.isActive === false;
            return (
              <div
                key={cityName}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col shadow-2xs"
              >
                <div
                  className={`px-3.5 py-2 text-white flex items-center justify-between gap-2 ${
                    cityInactive ? 'bg-amber-800' : 'bg-slate-800'
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold tracking-wide truncate">
                      {cityName}
                    </span>
                    <span className="text-[10px] font-mono bg-white/15 text-slate-100 px-1.5 py-0.2 rounded">
                      {cityItems.length} 區
                    </span>
                    {cityInactive && (
                      <span className="text-[10px] font-bold bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded">
                        停用
                      </span>
                    )}
                    {cMeta && cMeta.aliases.length > 0 && (
                      <span
                        title={`舊名／別名：${cMeta.aliases.join('、')}`}
                        className="text-[10px] bg-indigo-500/40 text-indigo-100 px-1.5 py-0.2 rounded truncate max-w-[120px]"
                      >
                        別名: {cMeta.aliases.join('、')}
                      </span>
                    )}
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleOpenCityEditor(cityName)}
                      title="一鍵修改此縣市名稱（自動連動全部轄下鄉鎮區）或管理縣市別名"
                      className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/25 text-white text-[10px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>更名/別名</span>
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100">
                  {cityItems.map(item => {
                    const isLegacy = item.isActive === false || cityInactive;
                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectDistrict?.(item)}
                        className={`px-3 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors ${
                          onSelectDistrict ? 'cursor-pointer' : ''
                        } ${
                          isLegacy
                            ? 'bg-amber-50/50 text-slate-500 hover:bg-amber-50'
                            : 'hover:bg-indigo-50/50 text-slate-800'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-400 select-none">-</span>
                            <span
                              className={`font-semibold ${
                                isLegacy ? 'line-through text-slate-500' : 'text-slate-800'
                              }`}
                            >
                              {item.district}
                            </span>
                            <span
                              className={`font-mono font-bold text-[11px] px-1.5 py-0.2 rounded border ${
                                isLegacy
                                  ? 'bg-amber-100/70 text-amber-800 border-amber-200'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}
                            >
                              {item.postalCode}
                            </span>
                            {item.isActive === false && (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5">
                                <Archive className="w-2.5 h-2.5" />
                                歷史停用
                              </span>
                            )}
                          </div>

                          {((item.aliases && item.aliases.length > 0) ||
                            item.replacedByCity ||
                            item.replacedByDistrict ||
                            item.note) && (
                            <div className="text-[10px] text-slate-400 pl-3 mt-0.5 truncate">
                              {(item.replacedByCity || item.replacedByDistrict) && (
                                <span className="text-amber-700 font-semibold mr-1.5">
                                  ➔ {item.replacedByCity || item.city}
                                  {item.replacedByDistrict || ''}
                                </span>
                              )}
                              {item.aliases && item.aliases.length > 0 && (
                                <span className="mr-1.5">
                                  別名: {item.aliases.join('、')}
                                </span>
                              )}
                              {item.note && <span>({item.note})</span>}
                            </div>
                          )}
                        </div>

                        {canManage && (
                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              title="編修此項目"
                              className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteRecord(item)}
                              title="刪除此項目"
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 刪除項目確認 Modal */}
      <ConfirmDialogModal
        isOpen={Boolean(pendingDeleteRecord)}
        title="確認移除此郵遞區號項目？"
        variant="danger"
        message={
          pendingDeleteRecord
            ? `確定要從郵遞區號表中刪除「${pendingDeleteRecord.city} ${pendingDeleteRecord.district} (${pendingDeleteRecord.postalCode})」嗎？`
            : ''
        }
        extraNotice="提示：若該行政區僅是因升格或裁併而不再使用，建議改用「編修 ➔ 取消勾選現行啟用」轉為歷史停用，即可保留舊名↔新名別名對照搜尋能力。移除此表列不會改寫任何既有的合作夥伴或案場地址。"
        confirmText="確認移除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteRecord(null)}
      />

      {/* 還原官方 368 區預設值確認 Modal */}
      <ConfirmDialogModal
        isOpen={isResetConfirmOpen}
        title="還原中華郵政預設 368 鄉鎮市區清冊？"
        variant="warning"
        message="此操作將把郵遞區號微型資料庫重設為系統內建的 22 縣市、368 個現行臺灣鄉鎮市區，自訂新增或編修過的縣市更名、別名與停用狀態將會清空。"
        extraNotice="系統保證：既有的合作廠商、業主、公司法人與工程案場地址資料皆不會受到任何改寫影響。"
        confirmText="確認還原預設 368 區"
        cancelText="取消"
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
};
