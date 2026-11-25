import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Search,
  RotateCcw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  buildSearchPermissionContext,
  executeLayeredSearch,
  getDefaultOperatorForField,
  SearchCondition,
  SearchDatasetKey,
  SearchDatasetLookup,
  SearchFieldDescriptor,
  SearchFilterLayer,
  SearchResultItem,
  UNIVERSAL_SEARCH_SCHEMAS
} from '../../utils/universalSearchEngine';

function getQuickDateRange(preset: 'THIS_MONTH' | 'LAST_3M' | 'THIS_YEAR'): { from: string; to: string } {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = (y: number, mZero: number) => new Date(y, mZero + 1, 0).getDate();

  if (preset === 'THIS_MONTH') {
    return {
      from: `${yyyy}-${pad(mm + 1)}-01`,
      to: `${yyyy}-${pad(mm + 1)}-${pad(lastDay(yyyy, mm))}`
    };
  }
  if (preset === 'LAST_3M') {
    const start = new Date(yyyy, mm - 2, 1);
    return {
      from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
      to: `${yyyy}-${pad(mm + 1)}-${pad(lastDay(yyyy, mm))}`
    };
  }
  return {
    from: `${yyyy}-01-01`,
    to: `${yyyy}-12-31`
  };
}

function hasFieldFormValue(field: SearchFieldDescriptor<any>, val: any): boolean {
  if (val === undefined || val === null) return false;
  switch (field.dataType) {
    case 'SELECT':
      return Array.isArray(val) && val.length > 0;
    case 'NUMBER':
      return Boolean((val.min !== undefined && val.min !== '') || (val.max !== undefined && val.max !== ''));
    case 'DATE':
      return Boolean(val.from || val.to);
    case 'BOOLEAN':
      return val === 'TRUE' || val === 'FALSE';
    default:
      return String(val).trim().length > 0;
  }
}

export interface UniversalSearchBarProps<T = any> {
  datasetKey: SearchDatasetKey;
  records: T[];
  lookup: SearchDatasetLookup;
  onResultsChange: (results: SearchResultItem<T>[], meta: { totalPoolCount: number; activeConditionCount: number }) => void;
  placeholder?: string;
  defaultExpanded?: boolean;
}

/**
 * 正式版共用搜尋與多欄位過濾條（收編至常用小程式庫）
 * - 預設收合僅保留單行快速關鍵字，點擊「展開更多條件」才打開格狀表單
 * - 嚴格依當前登入身分裁切可搜尋欄位與關鍵字掃描範圍
 * - 無側漏防護：不渲染、不提示任何「已隱藏敏感欄位／無權限欄位」資訊
 */
export function UniversalSearchBar<T = any>({
  datasetKey,
  records,
  lookup,
  onResultsChange,
  placeholder,
  defaultExpanded = false
}: UniversalSearchBarProps<T>) {
  const { currentUser, activeCompanyId, isSuperadmin, isBoss, isAdmin, can } = useAuth();

  const [keyword, setKeyword] = useState<string>('');
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [isFormExpanded, setIsFormExpanded] = useState<boolean>(defaultExpanded);

  const schema = UNIVERSAL_SEARCH_SCHEMAS[datasetKey];

  const permCtx = useMemo(
    () =>
      buildSearchPermissionContext({
        user: currentUser,
        activeCompanyId,
        isSuperadmin,
        isBoss,
        isAdmin,
        can
      }),
    [currentUser, activeCompanyId, isSuperadmin, isBoss, isAdmin, can]
  );

  // 先行取得目前帳號有權限的欄位集合（僅依此渲染與組裝條件）
  const singleLayerStack = useMemo<SearchFilterLayer[]>(() => {
    const conditions: SearchCondition[] = [];
    for (const field of schema.fields) {
      const val = formValues[field.key];
      if (!hasFieldFormValue(field, val)) continue;
      if (field.dataType === 'BOOLEAN') {
        conditions.push({
          id: `PROD-${field.key}`,
          fieldKey: field.key,
          operator: val === 'TRUE' ? 'IS_TRUE' : 'IS_FALSE',
          value: val === 'TRUE'
        });
      } else {
        conditions.push({
          id: `PROD-${field.key}`,
          fieldKey: field.key,
          operator: getDefaultOperatorForField(field.dataType),
          value: val
        });
      }
    }
    return [
      {
        id: 'PROD-FORM',
        label: '搜尋條件',
        combinator: 'AND',
        keyword,
        conditions
      }
    ];
  }, [schema, formValues, keyword]);

  const execution = useMemo(() => {
    return executeLayeredSearch(records, schema, singleLayerStack, permCtx, lookup);
  }, [records, schema, singleLayerStack, permCtx, lookup]);

  // 切換帳號或權限變動時，靜默清理無權限欄位殘留值（不暴露任何提示）
  useEffect(() => {
    const allowedSet = new Set(execution.accessibleFields.map(f => f.key));
    setFormValues(prev => {
      let changed = false;
      const next: Record<string, any> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (allowedSet.has(k)) {
          next[k] = v;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [execution.accessibleFields]);

  // 切換資料對象時重置搜尋值
  useEffect(() => {
    setKeyword('');
    setFormValues({});
  }, [datasetKey]);

  const activeConditionCount = useMemo(() => {
    const fieldCount = execution.accessibleFields.filter(f => hasFieldFormValue(f, formValues[f.key])).length;
    return fieldCount + (keyword.trim() ? 1 : 0);
  }, [execution.accessibleFields, formValues, keyword]);

  const onResultsChangeRef = useRef(onResultsChange);
  onResultsChangeRef.current = onResultsChange;

  useEffect(() => {
    onResultsChangeRef.current(execution.results, {
      totalPoolCount: execution.totalAuthorizedPoolCount,
      activeConditionCount
    });
  }, [execution.results, execution.totalAuthorizedPoolCount, activeConditionCount]);

  if (!execution.hasDatasetAccess) {
    return null;
  }

  const handleReset = () => {
    setKeyword('');
    setFormValues({});
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 ${
          isFormExpanded ? 'pb-3 border-b border-slate-100' : ''
        }`}
      >
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder={placeholder || `輸入關鍵字快速搜尋「${schema.label}」（支援台／臺與縣市別名）...`}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeConditionCount > 0 && (
            <span className="text-xs text-indigo-700 font-semibold font-mono tabular-nums">
              已套用 {activeConditionCount} 項條件
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsFormExpanded(prev => !prev)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1 whitespace-nowrap cursor-pointer"
          >
            {isFormExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{isFormExpanded ? '收合條件表格' : '展開更多條件'}</span>
          </button>
          {activeConditionCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-600 flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>清空條件</span>
            </button>
          )}
        </div>
      </div>

      {isFormExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {execution.accessibleFields.map(field => {
            const val = formValues[field.key];
            const setField = (nextVal: any) =>
              setFormValues(prev => ({ ...prev, [field.key]: nextVal }));

            return (
              <div key={field.key} className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <label className="text-[11px] font-semibold text-slate-700 truncate">
                    {field.label}
                  </label>
                  {field.dataType === 'REGION' && (
                    <span className="text-[10px] text-indigo-600 font-medium whitespace-nowrap">
                      台/臺·別名通用
                    </span>
                  )}
                  {field.dataType === 'DATE' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setField(getQuickDateRange('THIS_MONTH'))}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                      >
                        本月
                      </button>
                      <button
                        type="button"
                        onClick={() => setField(getQuickDateRange('LAST_3M'))}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                      >
                        近3月
                      </button>
                      <button
                        type="button"
                        onClick={() => setField(getQuickDateRange('THIS_YEAR'))}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                      >
                        本年
                      </button>
                    </div>
                  )}
                </div>

                {field.dataType === 'SELECT' && field.options ? (
                  <div className="flex flex-wrap gap-1">
                    {field.options.map(opt => {
                      const selectedArr: string[] = Array.isArray(val) ? val : [];
                      const checked = selectedArr.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            const next = checked
                              ? selectedArr.filter(v => v !== opt.value)
                              : [...selectedArr, opt.value];
                            setField(next);
                          }}
                          className={`px-2 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                ) : field.dataType === 'NUMBER' ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={val?.min ?? ''}
                      onChange={e => setField({ ...(val || {}), min: e.target.value })}
                      placeholder="最小值"
                      className="w-1/2 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-hidden"
                    />
                    <span className="text-xs text-slate-400">~</span>
                    <input
                      type="number"
                      value={val?.max ?? ''}
                      onChange={e => setField({ ...(val || {}), max: e.target.value })}
                      placeholder="最大值"
                      className="w-1/2 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-hidden"
                    />
                  </div>
                ) : field.dataType === 'DATE' ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={val?.from ?? ''}
                      onChange={e => setField({ ...(val || {}), from: e.target.value })}
                      className="w-1/2 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-hidden"
                    />
                    <span className="text-xs text-slate-400">~</span>
                    <input
                      type="date"
                      value={val?.to ?? ''}
                      onChange={e => setField({ ...(val || {}), to: e.target.value })}
                      className="w-1/2 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-hidden"
                    />
                  </div>
                ) : field.dataType === 'BOOLEAN' ? (
                  <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-[11px]">
                    {[
                      { v: '', label: '不限' },
                      { v: 'TRUE', label: '是' },
                      { v: 'FALSE', label: '否' }
                    ].map(opt => {
                      const active = (val || '') === opt.v;
                      return (
                        <button
                          key={opt.v || 'ALL'}
                          type="button"
                          onClick={() => setField(opt.v)}
                          className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                            active
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={String(val ?? '')}
                    onChange={e => setField(e.target.value)}
                    placeholder={field.placeholder || '空白＝不限'}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-500 outline-hidden"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
