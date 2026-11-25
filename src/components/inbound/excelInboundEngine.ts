// src/components/inbound/excelInboundEngine.ts
// 🧠 Excel 極速進貨打單純函式演算引擎（模糊比對、規格拆分、標準歸一、CSV/TSV 匯入解析與草稿儲存）

import { Project, BusinessPartner, Item, InboundReceipt } from '../../types/erp';
import { InternalAsset } from '../../utils/internalAssetStore';
import { exportCsvFile } from '../../utils/csvExport';

export interface ExcelGridRow {
  id: string;
  seq: number;
  receivedDate: string;
  vendorInputName: string;
  matchedVendorId?: string;
  vendorStatus: 'MATCHED' | 'NEW' | 'AMBIGUOUS';
  siteInputName: string;
  matchedProjectId?: string;
  projectCodeSnapshot?: string;
  projectStatus: 'MATCHED' | 'NEW' | 'AMBIGUOUS' | 'INTERNAL_ASSET';
  itemName: string;
  spec: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  deliveryNoteNumber: string;
  orderNumber?: string;
  notes: string;
}

export interface InboundSpeedDraft {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  defaultDate: string;
  rows: ExcelGridRow[];
  totalAmount: number;
  itemCount: number;
  primaryProjectName?: string;
  primaryVendorName?: string;
  dbReceiptId?: string;
}

export interface CanonicalRule {
  keywords: string[];
  canonicalName: string;
  defaultUnit: string;
  suggestedSpec?: string;
}

export interface HistoricalVendorItemStats {
  itemName: string;
  count: number;
  latestPrice: number;
  latestUnit: string;
  specs: Map<string, number>;
  lastDate: string;
}

export interface HistoricalItemMemory {
  vendorMap: Map<string, Map<string, HistoricalVendorItemStats>>;
  globalItemSpecs: Map<string, Map<string, number>>;
}

const SPEED_DRAFTS_STORAGE_KEY = 'erp_inbound_speed_drafts_v2';

export function loadStoredSpeedDrafts(): InboundSpeedDraft[] {
  try {
    const raw = localStorage.getItem(SPEED_DRAFTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('載入極速打單草稿失敗:', e);
    return [];
  }
}

export function saveStoredSpeedDrafts(drafts: InboundSpeedDraft[]): void {
  try {
    localStorage.setItem(SPEED_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  } catch (e) {
    console.error('儲存極速打單草稿失敗:', e);
  }
}

export const CANONICAL_RULES: CanonicalRule[] = [
  {
    keywords: ['鋼筋', '竹節', '螺紋筋', '黑鐵筋', '圓鐵', '竹節鋼筋'],
    canonicalName: '竹節鋼筋',
    defaultUnit: '噸',
    suggestedSpec: '#4 (D13)',
  },
  {
    keywords: ['混凝土', '預拌', '預拌混凝土', '混泥土', '水泥混泥土', '水泥混凝土'],
    canonicalName: '預拌混凝土',
    defaultUnit: 'M3',
    suggestedSpec: '3000 psi',
  },
  {
    keywords: ['水泥', '波特蘭', '黑水泥', '第I型水泥'],
    canonicalName: '波特蘭水泥',
    defaultUnit: '包',
    suggestedSpec: '第I型波特蘭水泥 (50kg)',
  },
  {
    keywords: ['砂漿', '水泥砂漿', '打底砂漿', '粉光砂漿'],
    canonicalName: '水泥砂漿',
    defaultUnit: '包',
    suggestedSpec: '1:3 打底砂漿',
  },
  {
    keywords: ['砂', '川砂', '天然砂', '粗砂', '細砂', '碎石', '級配', '砂石'],
    canonicalName: '砂石級配',
    defaultUnit: 'M3',
    suggestedSpec: '天然級配',
  },
  {
    keywords: ['模板', '夾板', '清水模', '芬蘭板', '覆膜板'],
    canonicalName: '夾板模板',
    defaultUnit: '塊',
    suggestedSpec: '15mm 芬蘭夾板',
  },
  {
    keywords: ['紅磚', '磚塊', '白磚', '空心磚', '輕質白磚', '砌磚'],
    canonicalName: '砌築用磚',
    defaultUnit: '塊',
    suggestedSpec: '一等紅磚 (標準)',
  },
  {
    keywords: ['pvc', '塑膠管', '排水管', '給水管', '電管'],
    canonicalName: 'PVC管材',
    defaultUnit: '支',
    suggestedSpec: '2" 厚管(W)',
  },
  {
    keywords: ['點焊鋼絲網', '鋼絲網', '點焊網'],
    canonicalName: '點焊鋼絲網',
    defaultUnit: '片',
    suggestedSpec: '15x15cm (φ5mm)',
  },
];

export function getIndustryCommonSpecs(itemName: string): string[] {
  const name = (itemName || '').toLowerCase();
  if (name.includes('鋼筋') || name.includes('竹節') || name.includes('鐵線')) {
    return ['#3 (D10)', '#4 (D13)', '#5 (D16)', '#6 (D19)', '#7 (D22)', '#8 (D25)', '#10 (D32)', 'SD280', 'SD420', 'SD420W'];
  }
  if (name.includes('混凝土') || name.includes('預拌') || name.includes('水泥砂漿')) {
    return ['140 kgf/cm²', '210 kgf/cm²', '245 kgf/cm²', '280 kgf/cm²', '350 kgf/cm²', '3000 psi', '3500 psi', '4000 psi', '5000 psi', '自充填(SCC)', '早強'];
  }
  if (name.includes('水泥') && !name.includes('混凝土')) {
    return ['第I型波特蘭水泥 (50kg)', '第II型波特蘭水泥', '白水泥', '快乾水泥', '防水水泥'];
  }
  if (name.includes('砂') || name.includes('石') || name.includes('級配')) {
    return ['粗砂', '特粗砂', '細砂', '天然級配', '1分碎石', '2分碎石', '3分碎石', '卵石'];
  }
  if (name.includes('模') || name.includes('夾板')) {
    return ['12mm 普通夾板', '15mm 芬蘭夾板', '18mm 清水模板', '2分夾板', '3分夾板', '雙面覆膜模'];
  }
  if (name.includes('磚')) {
    return ['一等紅磚 (標準)', '空心磚 15cm', '空心磚 19cm', '輕質白磚 10cm', '輕質白磚 15cm'];
  }
  if (name.includes('管') || name.includes('pvc')) {
    return ['1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', '4"', '6"', '8"', '厚管(W)', '薄管(E)'];
  }
  return ['標準規格', '特製規格', 'CNS標準'];
}

export function detectSpecInItemName(rawName: string): {
  cleanedItemName: string;
  extractedSpec: string;
} | null {
  const trimmed = (rawName || '').trim();
  if (!trimmed) return null;

  const psiMatch = trimmed.match(/(140|210|245|280|350)\s*(kgf(?:\/cm²)?|kg)?/i);
  if (psiMatch) {
    const spec = psiMatch[2] ? `${psiMatch[1]} ${psiMatch[2]}` : `${psiMatch[1]} kgf/cm²`;
    const cleaned = trimmed.replace(psiMatch[0], '').replace(/[,、\-_\/\s]+/g, ' ').trim();
    return {
      cleanedItemName: cleaned.length > 0 ? (cleaned.includes('混凝土') ? cleaned : `${cleaned} 預拌混凝土`.trim()) : '預拌混凝土',
      extractedSpec: spec,
    };
  }

  const psiMatch2 = trimmed.match(/(2000|2500|3000|3500|4000|5000)\s*(psi|磅)?/i);
  if (psiMatch2) {
    const spec = `${psiMatch2[1]} psi`;
    const cleaned = trimmed.replace(psiMatch2[0], '').replace(/[,、\-_\/\s]+/g, ' ').trim();
    return {
      cleanedItemName: cleaned.length > 0 ? (cleaned.includes('混凝土') ? cleaned : `${cleaned} 預拌混凝土`.trim()) : '預拌混凝土',
      extractedSpec: spec,
    };
  }

  const hashMatch = trimmed.match(/(?:#|＃)([3-9]|10)\b/);
  if (hashMatch) {
    const num = hashMatch[1];
    const specMap: Record<string, string> = {
      '3': '#3 (D10)',
      '4': '#4 (D13)',
      '5': '#5 (D16)',
      '6': '#6 (D19)',
      '7': '#7 (D22)',
      '8': '#8 (D25)',
      '10': '#10 (D32)',
    };
    const spec = specMap[num] || `#${num}`;
    const cleaned = trimmed.replace(hashMatch[0], '').replace(/[,、\-_\/\s]+/g, ' ').trim();
    return {
      cleanedItemName: cleaned.length > 0 ? (cleaned.includes('鋼筋') ? cleaned : `${cleaned} 竹節鋼筋`.trim()) : '竹節鋼筋',
      extractedSpec: spec,
    };
  }

  const dMatch = trimmed.match(/\bD(10|13|16|19|22|25|32)\b/i);
  if (dMatch) {
    const dVal = dMatch[1];
    const dMap: Record<string, string> = {
      '10': '#3 (D10)',
      '13': '#4 (D13)',
      '16': '#5 (D16)',
      '19': '#6 (D19)',
      '22': '#7 (D22)',
      '25': '#8 (D25)',
      '32': '#10 (D32)',
    };
    const spec = dMap[dVal] || `D${dVal}`;
    const cleaned = trimmed.replace(dMatch[0], '').replace(/[,、\-_\/\s]+/g, ' ').trim();
    return {
      cleanedItemName: cleaned.length > 0 ? (cleaned.includes('鋼筋') ? cleaned : `${cleaned} 竹節鋼筋`.trim()) : '竹節鋼筋',
      extractedSpec: spec,
    };
  }

  const fenMatch = trimmed.match(/([2-8])分(?:\s*(?:鋼筋|鐵|鐵線))?/);
  if (fenMatch && (trimmed.includes('鋼筋') || trimmed.includes('竹節') || trimmed.includes('鐵'))) {
    const fen = fenMatch[1];
    const fenMap: Record<string, string> = {
      '2': '#2 (D6)',
      '3': '#3 (D10)',
      '4': '#4 (D13)',
      '5': '#5 (D16)',
      '6': '#6 (D19)',
      '7': '#7 (D22)',
      '8': '#8 (D25)',
    };
    const spec = fenMap[fen] || `${fen}分`;
    const cleaned = trimmed.replace(fenMatch[0], '').replace(/[,、\-_\/\s]+/g, ' ').trim();
    return {
      cleanedItemName: cleaned.length > 0 ? (cleaned.includes('鋼筋') ? cleaned : `${cleaned} 竹節鋼筋`.trim()) : '竹節鋼筋',
      extractedSpec: spec,
    };
  }

  const mmMatch = trimmed.match(/(6|9|12|15|18|20)\s*mm/i);
  if (mmMatch && (trimmed.includes('板') || trimmed.includes('模'))) {
    const spec = `${mmMatch[1]}mm`;
    const cleaned = trimmed.replace(mmMatch[0], '').replace(/[,、\-_\/\s]+/g, ' ').trim();
    return {
      cleanedItemName: cleaned.length > 0 ? (cleaned.includes('板') || cleaned.includes('模') ? cleaned : `${cleaned} 夾板模板`.trim()) : '夾板模板',
      extractedSpec: spec,
    };
  }

  const pipeMatch = trimmed.match(/(1\/2|3\/4|1-1\/4|1-1\/2|2-1\/2|[1-8])\s*(?:"|吋|寸)/);
  if (pipeMatch && (trimmed.includes('管') || trimmed.includes('pvc'))) {
    const spec = `${pipeMatch[1]}"`;
    const cleaned = trimmed.replace(pipeMatch[0], '').replace(/[,、\-_\/\s]+/g, ' ').trim();
    return {
      cleanedItemName: cleaned.length > 0 ? (cleaned.includes('管') ? cleaned : `${cleaned} PVC管材`.trim()) : 'PVC管材',
      extractedSpec: spec,
    };
  }

  return null;
}

export function findCanonicalRule(rawName: string): CanonicalRule | null {
  const clean = (rawName || '').trim().toLowerCase();
  if (!clean) return null;
  for (const rule of CANONICAL_RULES) {
    if (rule.keywords.some(kw => clean.includes(kw.toLowerCase()))) {
      return rule;
    }
  }
  return null;
}

export function findSimilarItems(rawName: string, items: Item[], maxResults: number = 2): Item[] {
  const clean = (rawName || '').trim().toLowerCase();
  if (!clean || clean.length < 2) return [];

  const results: { item: Item; score: number }[] = [];
  const getBigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const bInput = getBigrams(clean);

  for (const it of items) {
    const itName = (it.name || '').trim().toLowerCase();
    if (!itName || itName === clean) continue;

    let score = 0;
    if (itName.includes(clean) || clean.includes(itName)) {
      score = Math.min(clean.length, itName.length) / Math.max(clean.length, itName.length);
    } else {
      const bTarget = getBigrams(itName);
      if (bTarget.size > 0 && bInput.size > 0) {
        let inter = 0;
        for (const bg of bInput) if (bTarget.has(bg)) inter++;
        score = (2 * inter) / (bInput.size + bTarget.size);
      }
    }

    if (score >= 0.5) {
      results.push({ item: it, score });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(r => r.item);
}

export function validateProjectName(
  inputName: string,
  projects: Project[],
  internalAssets: InternalAsset[]
): {
  status: 'MATCHED' | 'NEW' | 'AMBIGUOUS' | 'INTERNAL_ASSET';
  matchedPrj?: Project;
  matchedAsset?: InternalAsset;
} {
  const clean = (inputName || '').trim();
  if (!clean) return { status: 'AMBIGUOUS' };
  const cleanLower = clean.toLowerCase();

  for (const ast of internalAssets) {
    if (
      ast.name.toLowerCase() === cleanLower ||
      ast.code.toLowerCase() === cleanLower ||
      (ast.licensePlate && ast.licensePlate.toLowerCase() === cleanLower) ||
      ast.aliases.some(al => al.toLowerCase() === cleanLower || cleanLower.includes(al.toLowerCase()))
    ) {
      return { status: 'INTERNAL_ASSET', matchedAsset: ast };
    }
  }

  const isInternal =
    cleanLower.includes('廠內') ||
    cleanLower.includes('自用') ||
    cleanLower.includes('車') ||
    cleanLower.includes('怪手') ||
    cleanLower.includes('堆高機') ||
    cleanLower.includes('翻修') ||
    cleanLower.includes('庫存') ||
    cleanLower.includes('廠務') ||
    cleanLower.includes('公務車');
  if (isInternal) {
    return { status: 'INTERNAL_ASSET' };
  }

  const exact = projects.find(
    p =>
      p.name.toLowerCase() === cleanLower ||
      p.projectCode.toLowerCase() === cleanLower ||
      p.id.toLowerCase() === cleanLower
  );
  if (exact) return { status: 'MATCHED', matchedPrj: exact };

  const partial = projects.find(
    p =>
      p.name.toLowerCase().includes(cleanLower) ||
      cleanLower.includes(p.name.toLowerCase()) ||
      (p.projectCode && p.projectCode.toLowerCase().includes(cleanLower))
  );
  if (partial) return { status: 'MATCHED', matchedPrj: partial };

  return { status: 'NEW' };
}

export function resolveSiteOrAsset(
  input: string,
  projects: Project[],
  internalAssets: InternalAsset[],
  code?: string
): {
  finalName: string;
  finalCode?: string;
  status: 'MATCHED' | 'NEW' | 'AMBIGUOUS' | 'INTERNAL_ASSET';
  matchedProjectId?: string;
  matchedAsset?: InternalAsset;
} {
  const clean = (input || '').trim();
  if (!clean) return { finalName: '', status: 'AMBIGUOUS' };
  const cleanLower = clean.toLowerCase();

  for (const ast of internalAssets) {
    if (
      ast.name.toLowerCase() === cleanLower ||
      ast.code.toLowerCase() === cleanLower ||
      (ast.licensePlate && ast.licensePlate.toLowerCase() === cleanLower)
    ) {
      return {
        finalName: ast.name,
        finalCode: ast.code,
        status: 'INTERNAL_ASSET',
        matchedProjectId: 'PRJ-INTERNAL',
        matchedAsset: ast,
      };
    }
  }

  for (const ast of internalAssets) {
    for (const al of ast.aliases) {
      const alLower = al.toLowerCase().trim();
      if (
        cleanLower === alLower ||
        cleanLower.includes(alLower) ||
        (alLower.length >= 2 && alLower.includes(cleanLower))
      ) {
        return {
          finalName: ast.name,
          finalCode: ast.code,
          status: 'INTERNAL_ASSET',
          matchedProjectId: 'PRJ-INTERNAL',
          matchedAsset: ast,
        };
      }
    }
  }

  if (
    cleanLower.includes('庫存') ||
    cleanLower.includes('放廠') ||
    cleanLower.includes('倉庫') ||
    cleanLower.includes('備料') ||
    cleanLower.includes('留庫')
  ) {
    const stockAst = internalAssets.find(a => a.type === 'CENTRAL_STOCK') || internalAssets[0];
    if (stockAst) {
      return {
        finalName: stockAst.name,
        finalCode: stockAst.code,
        status: 'INTERNAL_ASSET',
        matchedProjectId: 'PRJ-INTERNAL',
        matchedAsset: stockAst,
      };
    }
  }

  if (
    cleanLower.includes('廠內') ||
    cleanLower.includes('自用') ||
    cleanLower.includes('車') ||
    cleanLower.includes('怪手') ||
    cleanLower.includes('堆高機') ||
    cleanLower.includes('翻修')
  ) {
    return {
      finalName: '廠內自用 / 廠務支出',
      finalCode: '廠內自用',
      status: 'INTERNAL_ASSET',
      matchedProjectId: 'PRJ-INTERNAL',
    };
  }

  const prjCheck = validateProjectName(clean, projects, internalAssets);
  if (prjCheck.status === 'MATCHED' && prjCheck.matchedPrj) {
    return {
      finalName: prjCheck.matchedPrj.name,
      finalCode: prjCheck.matchedPrj.projectCode,
      status: 'MATCHED',
      matchedProjectId: prjCheck.matchedPrj.id,
    };
  }

  return {
    finalName: clean,
    finalCode: code,
    status: 'NEW',
  };
}

export function validateVendorName(
  inputName: string,
  vendors: BusinessPartner[]
): {
  status: 'MATCHED' | 'NEW' | 'AMBIGUOUS';
  matchedVen?: BusinessPartner;
} {
  const clean = (inputName || '').trim().toLowerCase();
  if (!clean) return { status: 'AMBIGUOUS' };

  const exact = vendors.find(
    v =>
      v.name.toLowerCase() === clean ||
      v.bpCode.toLowerCase() === clean ||
      (v.taxId && v.taxId.trim() === clean)
  );
  if (exact) return { status: 'MATCHED', matchedVen: exact };

  const partial = vendors.find(
    v => v.name.toLowerCase().includes(clean) || clean.includes(v.name.toLowerCase())
  );
  if (partial) return { status: 'MATCHED', matchedVen: partial };

  return { status: 'NEW' };
}

export function buildHistoricalItemMemory(allReceipts: InboundReceipt[]): HistoricalItemMemory {
  const vendorMap = new Map<string, Map<string, HistoricalVendorItemStats>>();
  const globalItemSpecs = new Map<string, Map<string, number>>();

  for (const r of allReceipts) {
    if (r.status === 'VOIDED') continue;
    const vKey = (r.vendorNameSnapshot || '').trim().toLowerCase();

    for (const it of r.items || []) {
      const itName = (it.itemName || '').trim();
      if (!itName) continue;
      const itKey = itName.toLowerCase();
      const spec = (it.spec || '').trim();
      const unit = it.unit || '式';
      const price = Number(it.unitPrice) || 0;
      const date = r.receivedDate || '';

      if (vKey) {
        if (!vendorMap.has(vKey)) vendorMap.set(vKey, new Map());
        const vItems = vendorMap.get(vKey)!;

        if (!vItems.has(itKey)) {
          vItems.set(itKey, {
            itemName: itName,
            count: 0,
            latestPrice: price,
            latestUnit: unit,
            specs: new Map(),
            lastDate: date,
          });
        }

        const itemEntry = vItems.get(itKey)!;
        itemEntry.count += 1;
        if (date >= itemEntry.lastDate) {
          if (price > 0) itemEntry.latestPrice = price;
          if (unit) itemEntry.latestUnit = unit;
          itemEntry.lastDate = date;
        }
        if (spec) {
          itemEntry.specs.set(spec, (itemEntry.specs.get(spec) || 0) + 1);
        }
      }

      if (!globalItemSpecs.has(itKey)) {
        globalItemSpecs.set(itKey, new Map());
      }
      if (spec) {
        const specMap = globalItemSpecs.get(itKey)!;
        specMap.set(spec, (specMap.get(spec) || 0) + 1);
      }
    }
  }

  return { vendorMap, globalItemSpecs };
}

export function parseDelimitedLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function findHeaderIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex(h => {
    const clean = h.replace(/[\s\(\)（）_\ufeff]/g, '').toLowerCase();
    return candidates.some(c => clean.includes(c.toLowerCase()));
  });
}

export function parseCsvRowsToGrid(params: {
  rawText: string;
  defaultDate: string;
  projects: Project[];
  vendors: BusinessPartner[];
  internalAssets: InternalAsset[];
}): {
  rows: ExcelGridRow[];
  topUnmapped: { unmappedName: string; count: number; sampleRowIds: string[] } | null;
  errorMsg?: string;
} {
  const { rawText, defaultDate, projects, vendors, internalAssets } = params;
  const text = rawText.replace(/^\uFEFF/, '');
  if (!text.trim()) {
    return { rows: [], topUnmapped: null, errorMsg: '匯入檔案內容不得為空' };
  }

  const rawLines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (rawLines.length === 0) {
    return { rows: [], topUnmapped: null, errorMsg: '未能解析出有效進貨列資料，請檢查檔案格式' };
  }

  const delimiter = rawLines[0].includes('\t') ? '\t' : ',';
  const firstLineCols = parseDelimitedLine(rawLines[0], delimiter);

  const hasHeader = firstLineCols.some(c =>
    ['序號', '進貨日', '日期', '廠商名稱', '廠商', '個案用料', '案場', '品名', '料件', '數量', '單價', '單位', '送貨單號'].some(k =>
      c.includes(k)
    )
  );

  let dataLines = rawLines;
  let headerCols: string[] = [];
  if (hasHeader) {
    headerCols = firstLineCols;
    dataLines = rawLines.slice(1);
  }

  const dateIdx = findHeaderIndex(headerCols, ['進貨日', '進貨日期', '日期', 'date']);
  const vendorIdx = findHeaderIndex(headerCols, ['廠商名稱', '供料商', '廠商', 'vendor']);
  const altVendorIdx = findHeaderIndex(headerCols, ['發票所屬公司代碼', '所屬公司', '公司名稱']);
  const siteIdx = findHeaderIndex(headerCols, ['個案用料', '案場', '工區', '專案名稱', 'site', 'project']);
  const codeIdx = findHeaderIndex(headerCols, ['專案代碼', '案場代碼', 'code']);
  const itemIdx = findHeaderIndex(headerCols, ['品名', '料件名稱', '料件', '材料', 'item']);
  const specIdx = findHeaderIndex(headerCols, ['規格', 'spec']);
  const unitIdx = findHeaderIndex(headerCols, ['單位', 'unit']);
  const qtyIdx = findHeaderIndex(headerCols, ['數量', 'qty', 'quantity']);
  const priceIdx = findHeaderIndex(headerCols, ['單價', 'price']);
  const dnIdx = findHeaderIndex(headerCols, ['送貨單號', '簽收單號', '單號', 'dn']);
  const notesIdx = findHeaderIndex(headerCols, ['備註', '說明', 'note', 'remark']);

  const newRows: ExcelGridRow[] = [];
  let startSeq = 1;

  for (const line of dataLines) {
    const cols = parseDelimitedLine(line, delimiter);
    if (cols.length === 0 || cols.every(c => c === '')) continue;

    let rowDate = defaultDate;
    let rowVendor = '';
    let rowSite = '';
    let rowCode = '';
    let rowItem = '';
    let rowSpec = '';
    let rowUnit = '包';
    let rowQty = 1;
    let rowPrice = 0;
    let rowDn = '';
    let rowNotes = '';

    if (hasHeader) {
      if (dateIdx !== -1 && cols[dateIdx]) rowDate = cols[dateIdx].replace(/\//g, '-');
      if (vendorIdx !== -1 && cols[vendorIdx]) {
        rowVendor = cols[vendorIdx];
      } else if (altVendorIdx !== -1 && cols[altVendorIdx]) {
        rowVendor = cols[altVendorIdx];
      }
      if (siteIdx !== -1 && cols[siteIdx]) rowSite = cols[siteIdx];
      if (codeIdx !== -1 && cols[codeIdx]) rowCode = cols[codeIdx];
      if (itemIdx !== -1 && cols[itemIdx]) rowItem = cols[itemIdx];
      if (specIdx !== -1 && cols[specIdx]) rowSpec = cols[specIdx];
      if (unitIdx !== -1 && cols[unitIdx]) rowUnit = cols[unitIdx];
      if (qtyIdx !== -1 && cols[qtyIdx]) rowQty = Number(cols[qtyIdx]) || 1;
      if (priceIdx !== -1 && cols[priceIdx]) rowPrice = Number(cols[priceIdx]) || 0;
      if (dnIdx !== -1 && cols[dnIdx]) rowDn = cols[dnIdx];
      if (notesIdx !== -1 && cols[notesIdx]) rowNotes = cols[notesIdx];
    } else if (cols[0]?.match(/^\d{4}/)) {
      rowDate = cols[0].replace(/\//g, '-');
      rowVendor = cols[1] || '';
      rowSite = cols[2] || '';
      rowItem = cols[3] || '';
      rowQty = Number(cols[4]) || 1;
      rowPrice = Number(cols[5]) || 0;
      rowSpec = cols[6] || '';
      rowUnit = cols[7] || '包';
      rowDn = cols[8] || '';
      rowNotes = cols[9] || '';
    } else {
      rowItem = cols[0] || '';
      rowQty = Number(cols[1]) || 1;
      rowPrice = Number(cols[2]) || 0;
      rowUnit = cols[3] || '包';
      rowNotes = cols[4] || '';
    }

    const venCheck = validateVendorName(rowVendor, vendors);
    const finalVendorName = venCheck.matchedVen ? venCheck.matchedVen.name : rowVendor;
    const siteResolve = resolveSiteOrAsset(rowSite, projects, internalAssets, rowCode);

    let finalItem = rowItem;
    let finalSpec = rowSpec;
    if (!finalSpec.trim() && finalItem.trim()) {
      const specDetached = detectSpecInItemName(finalItem);
      if (specDetached) {
        finalItem = specDetached.cleanedItemName;
        finalSpec = specDetached.extractedSpec;
      }
    }

    newRows.push({
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${startSeq}`,
      seq: startSeq++,
      receivedDate: rowDate,
      vendorInputName: finalVendorName,
      matchedVendorId: venCheck.matchedVen?.id,
      vendorStatus: venCheck.status,
      siteInputName: siteResolve.finalName,
      matchedProjectId: siteResolve.matchedProjectId,
      projectCodeSnapshot: siteResolve.finalCode,
      projectStatus: siteResolve.status,
      itemName: finalItem,
      spec: finalSpec,
      unit: rowUnit || '包',
      quantity: rowQty,
      unitPrice: rowPrice,
      deliveryNoteNumber: rowDn || '',
      notes: rowNotes,
    });
  }

  if (newRows.length === 0) {
    return { rows: [], topUnmapped: null, errorMsg: '未能解析出有效進貨列資料，請檢查檔案格式' };
  }

  const unmappedCounts: Record<string, { count: number; sampleRowIds: string[] }> = {};
  for (const r of newRows) {
    if (r.projectStatus === 'NEW' && r.siteInputName.trim()) {
      const key = r.siteInputName.trim();
      if (!unmappedCounts[key]) unmappedCounts[key] = { count: 0, sampleRowIds: [] };
      unmappedCounts[key].count++;
      unmappedCounts[key].sampleRowIds.push(r.id);
    }
  }

  const topEntry = Object.entries(unmappedCounts).sort((a, b) => b[1].count - a[1].count)[0];
  const topUnmapped =
    topEntry && topEntry[1].count >= 1
      ? { unmappedName: topEntry[0], count: topEntry[1].count, sampleRowIds: topEntry[1].sampleRowIds }
      : null;

  return { rows: newRows, topUnmapped };
}

export function exportGridRowsCsv(gridRows: ExcelGridRow[]): void {
  const headers = [
    '序號',
    '進貨日',
    '廠商名稱',
    '個案用料(案場)',
    '專案代碼',
    '品名',
    '規格',
    '單位',
    '數量',
    '單價',
    '金額',
    '送貨單號',
    '備註',
  ];

  const rows = gridRows.map(r => {
    const qty = Number(r.quantity) || 0;
    const price = Number(r.unitPrice) || 0;
    const lineTotal = qty * price;
    return [
      r.seq,
      r.receivedDate,
      r.vendorInputName || '',
      r.siteInputName || '',
      r.projectCodeSnapshot || '',
      r.itemName || '',
      r.spec || '',
      r.unit || '包',
      qty,
      price,
      lineTotal,
      r.deliveryNoteNumber || '',
      r.notes || '',
    ];
  });

  exportCsvFile({
    filename: `現場進貨登打表_${new Date().toISOString().slice(0, 10)}.csv`,
    headers,
    rows,
  });
}
