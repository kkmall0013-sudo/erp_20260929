import React from 'react';
import { Archive, Pencil, Trash2 } from 'lucide-react';
import { TaiwanPostalCityRecord, TaiwanPostalCodeRecord } from '../../../types/erp';

interface GroupedCityEntry {
  cityName: string;
  items: TaiwanPostalCodeRecord[];
  minZip: number;
}

interface PostalCodeDirectoryGridProps {
  filteredGrouped: GroupedCityEntry[];
  cityMetaByName: Map<string, TaiwanPostalCityRecord>;
  canManage: boolean;
  onOpenCityEditor: (cityName: string) => void;
  onSelectDistrict?: (record: TaiwanPostalCodeRecord) => void;
  onEditDistrict: (record: TaiwanPostalCodeRecord) => void;
  onRequestDeleteDistrict: (record: TaiwanPostalCodeRecord) => void;
}

export const PostalCodeDirectoryGrid: React.FC<PostalCodeDirectoryGridProps> = ({
  filteredGrouped,
  cityMetaByName,
  canManage,
  onOpenCityEditor,
  onSelectDistrict,
  onEditDistrict,
  onRequestDeleteDistrict
}) => {
  if (filteredGrouped.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
        查無符合條件的縣市或鄉鎮市區資料
      </div>
    );
  }

  return (
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
                  onClick={() => onOpenCityEditor(cityName)}
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
                          onClick={() => onEditDistrict(item)}
                          title="編修此項目"
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestDeleteDistrict(item)}
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
  );
};
