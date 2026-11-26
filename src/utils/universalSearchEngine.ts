import { matchesTaiwanRegion } from './taiwanPostalCodes';
import {
  BlockedFieldNotice,
  FilterLayerSnapshot,
  LayeredSearchExecutionResult,
  normKeyword,
  SearchCondition,
  SearchDatasetKey,
  SearchDatasetLookup,
  SearchDatasetSchema,
  SearchFieldDescriptor,
  SearchFilterLayer,
  SearchPermissionContext,
  SearchResultItem,
  toValuesArray
} from './search/searchTypesAndPermissions';
import {
  PARTNERS_SEARCH_SCHEMA,
  PROJECTS_SEARCH_SCHEMA
} from './search/partnerAndProjectSchemas';
import {
  FINANCE_LEDGER_SEARCH_SCHEMA,
  INBOUND_RECEIPTS_SEARCH_SCHEMA,
  TAX_401_INVOICES_SEARCH_SCHEMA
} from './search/inboundAndFinanceSchemas';

export type {
  BlockedFieldNotice,
  FilterLayerSnapshot,
  FinanceLedgerUnifiedRow,
  LayeredSearchExecutionResult,
  SearchCondition,
  SearchDatasetKey,
  SearchDatasetLookup,
  SearchDatasetSchema,
  SearchFieldDataType,
  SearchFieldDescriptor,
  SearchFieldOption,
  SearchFieldSensitivity,
  SearchFilterLayer,
  SearchOperator,
  SearchPermissionContext,
  SearchResultItem
} from './search/searchTypesAndPermissions';

export {
  buildSearchPermissionContext,
  createSearchDatasetLookup,
  getDefaultOperatorForField,
  getOperatorsForDataType
} from './search/searchTypesAndPermissions';

export { buildUnifiedFinanceRows } from './search/inboundAndFinanceSchemas';

export const UNIVERSAL_SEARCH_SCHEMAS: Record<SearchDatasetKey, SearchDatasetSchema<any>> = {
  PARTNERS: PARTNERS_SEARCH_SCHEMA,
  PROJECTS: PROJECTS_SEARCH_SCHEMA,
  INBOUND_RECEIPTS: INBOUND_RECEIPTS_SEARCH_SCHEMA,
  FINANCE_LEDGER: FINANCE_LEDGER_SEARCH_SCHEMA,
  TAX_401_INVOICES: TAX_401_INVOICES_SEARCH_SCHEMA
};

function isFieldAccessible(field: SearchFieldDescriptor<any>, ctx: SearchPermissionContext): boolean {
  if (field.allowFn) return field.allowFn(ctx);
  if (field.sensitivity === 'COMMERCIAL_AMOUNT') return ctx.canSeeCommercialAmounts;
  if (field.sensitivity === 'TAX_401') return ctx.canSee401TaxData;
  return true;
}

function getFieldBlockedReason(field: SearchFieldDescriptor<any>): string {
  if (field.blockedReason) return field.blockedReason;
  if (field.sensitivity === 'TAX_401') return '缺少 401 稅務／會計檢視權限';
  if (field.sensitivity === 'FINANCE_PRIVATE') return '缺少財務或私帳機密檢視權限';
  if (field.sensitivity === 'COMMERCIAL_AMOUNT') return '缺少商業金額檢視權限';
  return '無欄位存取權限';
}

function conditionHasInput(cond: SearchCondition): boolean {
  if (cond.operator === 'IS_TRUE' || cond.operator === 'IS_FALSE') return true;
  if (cond.operator === 'IN') return Array.isArray(cond.value) && cond.value.length > 0;
  if (cond.operator === 'BETWEEN') {
    const min = cond.value?.min;
    const max = cond.value?.max;
    return (min !== undefined && min !== '') || (max !== undefined && max !== '');
  }
  if (cond.operator === 'DATE_RANGE') {
    const from = cond.value?.from;
    const to = cond.value?.to;
    return Boolean(from || to);
  }
  return String(cond.value ?? '').trim().length > 0;
}

function evaluateSingleCondition<T>(
  row: T,
  field: SearchFieldDescriptor<T>,
  cond: SearchCondition,
  lookup: SearchDatasetLookup
): { matched: boolean; matchedText?: string } {
  const raw = field.extract(row, lookup);
  const values = toValuesArray(raw);

  if (cond.operator === 'IS_TRUE') {
    const ok = values.some(v => v === true || String(v) === 'true' || v === 1);
    return ok ? { matched: true, matchedText: '是' } : { matched: false };
  }
  if (cond.operator === 'IS_FALSE') {
    const ok = values.length > 0 && values.every(v => v === false || String(v) === 'false' || v === 0);
    return ok ? { matched: true, matchedText: '否' } : { matched: false };
  }
  if (cond.operator === 'BETWEEN') {
    const minRaw = cond.value?.min;
    const maxRaw = cond.value?.max;
    const minVal = minRaw !== undefined && minRaw !== '' ? Number(minRaw) : -Infinity;
    const maxVal = maxRaw !== undefined && maxRaw !== '' ? Number(maxRaw) : Infinity;
    for (const v of values) {
      const num = Number(v);
      if (Number.isFinite(num) && num >= minVal && num <= maxVal) {
        return { matched: true, matchedText: num.toLocaleString() };
      }
    }
    return { matched: false };
  }
  if (cond.operator === 'DATE_RANGE') {
    const from = String(cond.value?.from || '').trim();
    const to = String(cond.value?.to || '').trim();
    for (const v of values) {
      const d = String(v || '').slice(0, 10);
      if (!d) continue;
      if (from && d < from) continue;
      if (to && d > to) continue;
      return { matched: true, matchedText: d };
    }
    return { matched: false };
  }
  if (cond.operator === 'IN') {
    const selected: string[] = Array.isArray(cond.value) ? cond.value.map(String) : [];
    if (selected.length === 0) return { matched: true };
    const matchedVal = values.find(v => selected.includes(String(v)));
    return matchedVal !== undefined
      ? { matched: true, matchedText: String(matchedVal) }
      : { matched: false };
  }

  const query = String(cond.value ?? '').trim();
  if (!query) return { matched: true };

  if (cond.operator === 'REGION_ALIAS') {
    for (const v of values) {
      const text = String(v || '');
      if (text && matchesTaiwanRegion(text, query)) {
        return { matched: true, matchedText: text.trim() };
      }
    }
    return { matched: false };
  }

  const normQ = normKeyword(query);
  if (cond.operator === 'EQUALS') {
    const hit = values.find(v => normKeyword(v) === normQ);
    return hit !== undefined ? { matched: true, matchedText: String(hit) } : { matched: false };
  }

  // CONTAINS (預設相容台/臺)
  const hit = values.find(v => normKeyword(v).includes(normQ));
  return hit !== undefined ? { matched: true, matchedText: String(hit) } : { matched: false };
}

export function executeLayeredSearch<T>(
  rawRecords: T[],
  schema: SearchDatasetSchema<T>,
  filterStack: SearchFilterLayer[],
  permCtx: SearchPermissionContext,
  lookup: SearchDatasetLookup
): LayeredSearchExecutionResult<T> {
  const datasetAccess = schema.canAccessDataset(permCtx);
  if (!datasetAccess.allowed) {
    return {
      hasDatasetAccess: false,
      datasetDeniedReason: datasetAccess.reason || '無存取權限',
      accessibleFields: [],
      blockedFields: schema.fields.map(f => ({
        key: f.key,
        label: f.label,
        sensitivity: f.sensitivity,
        reason: getFieldBlockedReason(f)
      })),
      totalAuthorizedPoolCount: 0,
      droppedUnauthorizedConditionsTotal: 0,
      layerSnapshots: [],
      results: []
    };
  }

  // A. 依權限裁切欄位清單：無權限欄位絕不進入可選清單、關鍵字比對池與回傳欄位
  const accessibleFields: SearchFieldDescriptor<T>[] = [];
  const blockedFields: BlockedFieldNotice[] = [];
  for (const field of schema.fields) {
    if (isFieldAccessible(field, permCtx)) {
      accessibleFields.push(field);
    } else {
      blockedFields.push({
        key: field.key,
        label: field.label,
        sensitivity: field.sensitivity,
        reason: getFieldBlockedReason(field)
      });
    }
  }
  const accessibleFieldMap = new Map(accessibleFields.map(f => [f.key, f]));

  // B. 依法人授權與私帳/401規範過濾資料列池
  const authorizedPool = schema.filterAuthorizedRecords(rawRecords, permCtx, lookup);

  // C. 逐層執行 Filter Stack（第 1 層初篩 -> 第 2 層於結果內再篩 -> 第 N 層...）
  let currentRows = authorizedPool;
  let droppedUnauthorizedConditionsTotal = 0;
  const layerSnapshots: FilterLayerSnapshot[] = [];
  const matchedMetaByRowId = new Map<string, Map<string, string>>();

  for (const layer of filterStack) {
    const beforeCount = currentRows.length;
    const validConditions: { cond: SearchCondition; field: SearchFieldDescriptor<T> }[] = [];
    let droppedInLayer = 0;

    for (const cond of layer.conditions) {
      const targetField = accessibleFieldMap.get(cond.fieldKey);
      if (!targetField) {
        droppedInLayer += 1;
        droppedUnauthorizedConditionsTotal += 1;
        continue;
      }
      if (conditionHasInput(cond)) {
        validConditions.push({ cond, field: targetField });
      }
    }

    const kw = layer.keyword.trim();
    const normKw = normKeyword(kw);

    // 若本層沒有任何關鍵字與有效條件，則保留上層結果不縮小
    if (!kw && validConditions.length === 0) {
      layerSnapshots.push({
        layerId: layer.id,
        label: layer.label,
        beforeCount,
        afterCount: currentRows.length,
        droppedUnauthorizedCount: droppedInLayer
      });
      continue;
    }

    const nextRows: T[] = [];
    for (const row of currentRows) {
      const rowId = schema.getRowId(row);
      if (!matchedMetaByRowId.has(rowId)) {
        matchedMetaByRowId.set(rowId, new Map());
      }
      const rowMatchedMap = matchedMetaByRowId.get(rowId)!;

      // 1. 若有關鍵字：僅比對「目前有權限的 accessibleFields」，絕對不搜尋已被隔離隱藏的機密欄位！
      let keywordPass = true;
      if (kw) {
        keywordPass = false;
        for (const f of accessibleFields) {
          const vals = toValuesArray(f.extract(row, lookup));
          let hitText: string | undefined;
          if (f.dataType === 'REGION') {
            const found = vals.find(v => v && matchesTaiwanRegion(String(v), kw));
            if (found) hitText = String(found).trim();
          } else {
            const found = vals.find(v => normKeyword(v).includes(normKw));
            if (found !== undefined) hitText = String(found).trim();
          }
          if (hitText) {
            keywordPass = true;
            if (!rowMatchedMap.has(f.label)) {
              rowMatchedMap.set(f.label, hitText.slice(0, 48));
            }
          }
        }
      }

      // 2. 複數欄位條件評估 (AND / OR)
      let conditionsPass = true;
      if (validConditions.length > 0) {
        if (layer.combinator === 'AND') {
          conditionsPass = true;
          for (const { cond, field } of validConditions) {
            const res = evaluateSingleCondition(row, field, cond, lookup);
            if (!res.matched) {
              conditionsPass = false;
              break;
            }
            if (res.matchedText) {
              rowMatchedMap.set(field.label, res.matchedText.slice(0, 48));
            }
          }
        } else {
          conditionsPass = false;
          for (const { cond, field } of validConditions) {
            const res = evaluateSingleCondition(row, field, cond, lookup);
            if (res.matched) {
              conditionsPass = true;
              if (res.matchedText) {
                rowMatchedMap.set(field.label, res.matchedText.slice(0, 48));
              }
            }
          }
        }
      }

      if (keywordPass && conditionsPass) {
        nextRows.push(row);
      }
    }

    currentRows = nextRows;
    layerSnapshots.push({
      layerId: layer.id,
      label: layer.label,
      beforeCount,
      afterCount: currentRows.length,
      droppedUnauthorizedCount: droppedInLayer
    });
  }

  // D. 僅擷取「當前身分有權限檢視的欄位摘要」回傳給展示 UI
  const results: SearchResultItem<T>[] = currentRows.map(row => {
    const id = schema.getRowId(row);
    const matchedMap = matchedMetaByRowId.get(id);
    const displayColumns = accessibleFields
      .slice(0, 6)
      .map(f => {
        let valText = '';
        if (f.formatDisplay) {
          valText = f.formatDisplay(row, lookup);
        } else {
          const vals = toValuesArray(f.extract(row, lookup))
            .map(v => String(v ?? '').trim())
            .filter(Boolean);
          valText = Array.from(new Set(vals)).slice(0, 2).join('、') || '-';
        }
        return { key: f.key, label: f.label, value: valText };
      });

    return {
      id,
      title: schema.getRowTitle(row, lookup),
      subtitle: schema.getRowSubtitle(row, lookup),
      companyLabel: schema.getCompanyLabel(row, lookup),
      record: row,
      displayColumns,
      matchedFields: matchedMap
        ? Array.from(matchedMap.entries()).map(([fieldLabel, matchedText]) => ({
            fieldLabel,
            matchedText
          }))
        : []
    };
  });

  return {
    hasDatasetAccess: true,
    accessibleFields,
    blockedFields,
    totalAuthorizedPoolCount: authorizedPool.length,
    droppedUnauthorizedConditionsTotal,
    layerSnapshots,
    results
  };
}
