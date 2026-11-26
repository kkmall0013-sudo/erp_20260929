import React from 'react';
import { Building2, Check, X } from 'lucide-react';

export interface PostalDistrictEditorFormState {
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

export interface PostalCityEditorFormState {
  cityId?: string;
  oldCityName: string;
  newCityName: string;
  aliasesText: string;
  keepOldNameAsAlias: boolean;
  isActive: boolean;
  note: string;
}

export const EMPTY_POSTAL_DISTRICT_FORM: PostalDistrictEditorFormState = {
  city: '',
  district: '',
  postalCode: '',
  isActive: true,
  aliasesText: '',
  replacedByCity: '',
  replacedByDistrict: '',
  note: ''
};

interface PostalCodeCityEditorFormProps {
  state: PostalCityEditorFormState;
  error: string | null;
  onChange: React.Dispatch<React.SetStateAction<PostalCityEditorFormState | null>>;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const PostalCodeCityEditorForm: React.FC<PostalCodeCityEditorFormProps> = ({
  state,
  error,
  onChange,
  onCancel,
  onSubmit
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-emerald-700" />
          <span>
            縣市變數編修：【{state.oldCityName}】（儲存後轄下所有鄉鎮市區自動連動更新）
          </span>
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            現行縣市名稱（變數 a） <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={state.newCityName}
            onChange={e => onChange(s => (s ? { ...s, newCityName: e.target.value } : s))}
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
            value={state.aliasesText}
            onChange={e => onChange(s => (s ? { ...s, aliasesText: e.target.value } : s))}
            placeholder="例：臺北縣, 臺北市"
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
          />
        </div>

        <div className="flex items-end">
          <label className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={state.isActive}
              onChange={e => onChange(s => (s ? { ...s, isActive: e.target.checked } : s))}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs font-bold text-slate-800">
              {state.isActive ? '此縣市現行啟用' : '整縣市設為歷史停用'}
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-emerald-900 font-semibold cursor-pointer select-none">
          <input
            type="checkbox"
            checked={state.keepOldNameAsAlias}
            onChange={e =>
              onChange(s => (s ? { ...s, keepOldNameAsAlias: e.target.checked } : s))
            }
            className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            改名時自動將「{state.oldCityName}」加入搜尋別名（確保舊名 ↔ 新名搜尋互通）
          </span>
        </label>

        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
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
  );
};

interface PostalCodeDistrictEditorFormProps {
  formState: PostalDistrictEditorFormState;
  formError: string | null;
  uniqueCities: string[];
  onChange: React.Dispatch<React.SetStateAction<PostalDistrictEditorFormState>>;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const PostalCodeDistrictEditorForm: React.FC<PostalCodeDistrictEditorFormProps> = ({
  formState,
  formError,
  uniqueCities,
  onChange,
  onCancel,
  onSubmit
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-indigo-950">
          {formState.id ? '編修郵局郵遞區號項目' : '新增郵局郵遞區號項目（存檔後自動依郵遞區號由小到大排列）'}
        </h4>
        <button
          type="button"
          onClick={onCancel}
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
            onChange={e => onChange(s => ({ ...s, city: e.target.value }))}
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
            onChange={e => onChange(s => ({ ...s, district: e.target.value }))}
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
              onChange(s => ({
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
              onChange={e => onChange(s => ({ ...s, isActive: e.target.checked }))}
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
            onChange={e => onChange(s => ({ ...s, aliasesText: e.target.value }))}
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
            onChange={e => onChange(s => ({ ...s, replacedByCity: e.target.value }))}
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
              onChange(s => ({ ...s, replacedByDistrict: e.target.value }))
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
          onChange={e => onChange(s => ({ ...s, note: e.target.value }))}
          placeholder="備註說明（選填，例：區界調整）"
          className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
        />
        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
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
  );
};
