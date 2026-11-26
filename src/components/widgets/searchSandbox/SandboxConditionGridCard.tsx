import React from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lock,
  RotateCcw,
  Search,
  ShieldCheck
} from 'lucide-react';
import {
  BlockedFieldNotice,
  SearchFieldDescriptor
} from '../../../utils/universalSearchEngine';
import { getQuickDateRange } from './sandboxBaitAndHelpers';

interface SandboxConditionGridCardProps {
  keyword: string;
  onKeywordChange: (val: string) => void;
  accessibleFields: SearchFieldDescriptor<any>[];
  blockedFields: BlockedFieldNotice[];
  droppedUnauthorizedConditionsTotal: number;
  activeConditionCount: number;
  isFormExpanded: boolean;
  onToggleExpand: () => void;
  showSecurityDetails: boolean;
  onToggleSecurityDetails: () => void;
  formValues: Record<string, any>;
  onFieldValueChange: (fieldKey: string, val: any) => void;
  onResetAll: () => void;
}

export const SandboxConditionGridCard: React.FC<SandboxConditionGridCardProps> = ({
  keyword,
  onKeywordChange,
  accessibleFields,
  blockedFields,
  droppedUnauthorizedConditionsTotal,
  activeConditionCount,
  isFormExpanded,
  onToggleExpand,
  showSecurityDetails,
  onToggleSecurityDetails,
  formValues,
  onFieldValueChange,
  onResetAll
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
      {/* 表單頂部操作列 */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 ${
          isFormExpanded || droppedUnauthorizedConditionsTotal > 0
            ? 'pb-3 border-b border-slate-100'
            : ''
        }`}
      >
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={keyword}
            onChange={e => onKeywordChange(e.target.value)}
            placeholder={`快速關鍵字搜尋（僅掃描您有權限的 ${accessibleFields.length} 個欄位；已相容台/臺與縣市別名）...`}
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
            onClick={onToggleExpand}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1 whitespace-nowrap cursor-pointer"
          >
            {isFormExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{isFormExpanded ? '收合條件表格' : '展開更多條件'}</span>
          </button>
          {activeConditionCount > 0 && (
            <button
              type="button"
              onClick={onResetAll}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-600 flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>清空條件</span>
            </button>
          )}
        </div>
      </div>

      {/* 殘留高敏條件自動攔截提示 */}
      {droppedUnauthorizedConditionsTotal > 0 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              系統已自動攔截並排除 <strong>{droppedUnauthorizedConditionsTotal}</strong> 個超出當前帳號權限的搜尋條件（如老闆私帳／401 發票／財務機密欄位），確保切換身分不外洩。
            </span>
          </div>
          <button
            type="button"
            onClick={onResetAll}
            className="text-xs font-semibold text-amber-900 underline whitespace-nowrap cursor-pointer"
          >
            清除殘留值
          </button>
        </div>
      )}

      {/* 展開條件表格時顯示：權限欄位防護條 ＋ 固定格狀搜尋表單網格 */}
      {isFormExpanded && (
        <div className="space-y-3">
          {blockedFields.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    目前身分開放 <strong>{accessibleFields.length}</strong> 個搜尋欄位，已自表單與關鍵字池隱藏隔離{' '}
                    <strong className="text-rose-700">{blockedFields.length}</strong> 個敏感欄位
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onToggleSecurityDetails}
                  className="text-xs font-medium text-indigo-600 hover:underline whitespace-nowrap cursor-pointer"
                >
                  {showSecurityDetails ? '收合隱藏欄位清單' : '查看已隱藏欄位'}
                </button>
              </div>

              {showSecurityDetails && (
                <div className="pt-2 border-t border-slate-200/80 divide-y divide-slate-200/60 text-xs">
                  {blockedFields.map(bf => (
                    <div key={bf.key} className="py-1 flex flex-wrap items-center justify-between gap-2 text-slate-600">
                      <span className="flex items-center gap-1.5 font-medium text-slate-800">
                        <Lock className="w-3 h-3 text-rose-500 shrink-0" />
                        <span>{bf.label}</span>
                      </span>
                      <span className="text-slate-500">{bf.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accessibleFields.map(field => {
              const val = formValues[field.key];
              return (
                <div
                  key={field.key}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 space-y-1.5"
                >
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
                          onClick={() => onFieldValueChange(field.key, getQuickDateRange('THIS_MONTH'))}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                        >
                          本月
                        </button>
                        <button
                          type="button"
                          onClick={() => onFieldValueChange(field.key, getQuickDateRange('LAST_3M'))}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                        >
                          近3月
                        </button>
                        <button
                          type="button"
                          onClick={() => onFieldValueChange(field.key, getQuickDateRange('THIS_YEAR'))}
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
                              onFieldValueChange(field.key, next);
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
                        onChange={e =>
                          onFieldValueChange(field.key, { ...(val || {}), min: e.target.value })
                        }
                        placeholder="最小值"
                        className="w-1/2 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-hidden"
                      />
                      <span className="text-xs text-slate-400">~</span>
                      <input
                        type="number"
                        value={val?.max ?? ''}
                        onChange={e =>
                          onFieldValueChange(field.key, { ...(val || {}), max: e.target.value })
                        }
                        placeholder="最大值"
                        className="w-1/2 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-hidden"
                      />
                    </div>
                  ) : field.dataType === 'DATE' ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={val?.from ?? ''}
                        onChange={e =>
                          onFieldValueChange(field.key, { ...(val || {}), from: e.target.value })
                        }
                        className="w-1/2 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-hidden"
                      />
                      <span className="text-xs text-slate-400">~</span>
                      <input
                        type="date"
                        value={val?.to ?? ''}
                        onChange={e =>
                          onFieldValueChange(field.key, { ...(val || {}), to: e.target.value })
                        }
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
                            onClick={() => onFieldValueChange(field.key, opt.v)}
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
                      onChange={e => onFieldValueChange(field.key, e.target.value)}
                      placeholder={field.placeholder || '空白＝不限'}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-500 outline-hidden"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
