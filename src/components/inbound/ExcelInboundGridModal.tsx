// src/components/inbound/ExcelInboundGridModal.tsx
// 📊 Excel 試算表極速進貨打單工作台 (Excel-Style Inbound Data Grid)
// 純粹現場進貨點收 · 支援仿 Excel 鍵盤快速連續鍵入 · 專屬 CSV 匯出匯入 · 完整多草稿暫存切換 (草稿1/草稿2/草稿轉正) · 存檔自動清空防呆

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  CheckCircle2,
  Sparkles,
  Building2,
  Package,
  Save,
  X,
  Info,
  Layers,
  ArrowRight,
  ChevronDown,
  FolderOpen,
  Clock,
  RotateCcw,
  FileCheck,
  AlertCircle,
  Truck,
  Settings,
  Edit2
} from 'lucide-react';
import { Project, BusinessPartner, Item, InboundReceipt } from '../../types/erp';
import {
  getAllProjects,
  getAllBusinessPartners,
  getAllItems,
  getAllInboundReceipts,
  createInboundReceipt,
  updateInboundReceipt,
  deleteInboundReceipt,
  postInboundReceipt,
  quickCreateProject,
  quickCreateVendor,
  quickCreateItem,
  previewNextDocumentNumber
} from '../../db/sqlite';

export interface ExcelGridRow {
  id: string; // 暫存 UUID
  seq: number; // 序號 (登打/核對序號)
  receivedDate: string; // 進貨日 (YYYY-MM-DD)
  vendorInputName: string; // 使用者輸入之廠商名稱
  matchedVendorId?: string; // 已對齊之廠商主鍵 ID
  vendorStatus: 'MATCHED' | 'NEW' | 'AMBIGUOUS'; // 檢驗狀態
  siteInputName: string; // 使用者輸入之個案用料 / 案場名稱
  matchedProjectId?: string; // 已對齊之專案主鍵 ID
  projectCodeSnapshot?: string; // 專案代碼 (如 PRJ-2026-001 或 廠內自用)
  projectStatus: 'MATCHED' | 'NEW' | 'AMBIGUOUS' | 'INTERNAL_ASSET'; // 檢驗狀態 (含廠內資產免建案場)
  itemName: string; // 品名 (料件名稱)
  spec: string; // 規格
  unit: string; // 單位
  quantity: number; // 數量
  unitPrice: number; // 單價
  deliveryNoteNumber: string; // 送貨單號 / 簽收單號
  notes: string; // 備註
}

// 📋 極速打單多草稿資料結構
export interface InboundSpeedDraft {
  id: string; // 草稿唯一識別碼
  title: string; // 草稿名稱 (如: 草稿 1: 3310新建工程 · 合益建材)
  createdAt: string; // 建立時間
  updatedAt: string; // 更新時間
  defaultDate: string; // 預設進貨日
  rows: ExcelGridRow[]; // 所有打單列資料
  totalAmount: number; // 未稅合計金額
  itemCount: number; // 料件數
  primaryProjectName?: string; // 主案場
  primaryVendorName?: string; // 主廠商
  dbReceiptId?: string; // 關聯之 SQLite inbound_receipts 識別碼 (status: 'DRAFT')
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

export function saveStoredSpeedDrafts(drafts: InboundSpeedDraft[]) {
  try {
    localStorage.setItem(SPEED_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  } catch (e) {
    console.error('儲存極速打單草稿失敗:', e);
  }
}

// 🏢 廠內自用 / 車輛資產與廠務維護資料結構
export interface InternalAsset {
  id: string; // 唯一識別碼
  code: string; // 代碼 (如 VEH-358, FAC-ROOF, STOCK-01)
  name: string; // 顯示名稱 (如 廠內貨車 [358-AB])
  type: 'VEHICLE' | 'FACILITY' | 'CENTRAL_STOCK' | 'EQUIPMENT'; // 類別
  categoryLabel: string; // 標籤名稱
  aliases: string[]; // 常用別名/模糊比對關鍵字 (如 ['358', '358-AB', '三噸半'])
  licensePlate?: string; // 車牌號碼
  driverOrCustodian?: string; // 保管人 / 司機
  notes?: string; // 備註說明
  createdAt: string;
}

const INTERNAL_ASSETS_STORAGE_KEY = 'erp_inbound_internal_assets_v2';

export const DEFAULT_INTERNAL_ASSETS: InternalAsset[] = [
  {
    id: 'asset-veh-358',
    code: 'VEH-358',
    name: '廠內貨車 [358-AB]',
    type: 'VEHICLE',
    categoryLabel: '🚚 廠內車輛',
    aliases: ['358', '358-AB', '358ab', '三噸半', '大貨車', '一號車'],
    licensePlate: '358-AB',
    driverOrCustodian: '專責司機',
    notes: '3.5噸柴油框式小貨車，工區材料運補專用',
    createdAt: '2026-01-01',
  },
  {
    id: 'asset-veh-776',
    code: 'VEH-776',
    name: '廠內公務貨車 [776-EF]',
    type: 'VEHICLE',
    categoryLabel: '🚚 廠內車輛',
    aliases: ['776', '776-EF', '776ef', '二號車', '公務貨車', '公務小卡'],
    licensePlate: '776-EF',
    driverOrCustodian: '公務輪派',
    notes: '公務卡車，日常採買載料與出勤',
    createdAt: '2026-01-01',
  },
  {
    id: 'asset-eq-pc200',
    code: 'EQ-PC200',
    name: 'PC-200 挖土機 (怪手)',
    type: 'EQUIPMENT',
    categoryLabel: '🚜 重型機具',
    aliases: ['怪手', 'PC200', '挖土機', '大怪手'],
    notes: '廠內堆料與整地機具',
    createdAt: '2026-01-01',
  },
  {
    id: 'asset-eq-forklift',
    code: 'EQ-FORK',
    name: '廠內堆高機 (2.5噸)',
    type: 'EQUIPMENT',
    categoryLabel: '🚜 重型機具',
    aliases: ['堆高機', '叉車', '2.5噸堆高機'],
    notes: '倉庫與卸貨棧板專用堆高機',
    createdAt: '2026-01-01',
  },
  {
    id: 'asset-fac-roof',
    code: 'FAC-ROOF',
    name: '總廠廠務 - 屋頂翻修',
    type: 'FACILITY',
    categoryLabel: '🏠 廠區修繕',
    aliases: ['屋頂', '屋頂翻修', '翻修', '浪板修繕', '廠務修繕'],
    notes: '總廠廠房屋頂與遮雨棚翻修補漏工程',
    createdAt: '2026-01-01',
  },
  {
    id: 'asset-stock-central',
    code: 'STOCK-CENTRAL',
    name: '廠內公共儲備庫存',
    type: 'CENTRAL_STOCK',
    categoryLabel: '📦 常備庫存',
    aliases: ['廠內', '庫存', '放廠', '備料', '倉庫', '放廠裡', '留庫存', '常備料', '總廠庫存'],
    notes: '先買來放廠內之通用備料（黑鐵線、手套、螺絲五金、水泥備料等），自然消耗不二次分攤',
    createdAt: '2026-01-01',
  },
];

export function loadStoredInternalAssets(): InternalAsset[] {
  try {
    const raw = localStorage.getItem(INTERNAL_ASSETS_STORAGE_KEY);
    if (!raw) {
      saveStoredInternalAssets(DEFAULT_INTERNAL_ASSETS);
      return DEFAULT_INTERNAL_ASSETS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_INTERNAL_ASSETS;
  } catch (e) {
    console.warn('載入廠內資產清單失敗:', e);
    return DEFAULT_INTERNAL_ASSETS;
  }
}

export function saveStoredInternalAssets(assets: InternalAsset[]) {
  try {
    localStorage.setItem(INTERNAL_ASSETS_STORAGE_KEY, JSON.stringify(assets));
  } catch (e) {
    console.error('儲存廠內資產清單失敗:', e);
  }
}

interface ExcelInboundGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  triggerToast: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  currentUserFullName?: string;
  canApprove?: boolean;
  initialDraftToLoad?: InboundReceipt | null;
  onClearInitialDraft?: () => void;
}

// --------------------------------------------------------------------------
// 🛠️ 專用 CSV / TSV 穩健解析器 (支援引號內逗號、BOM 移除與容錯跳脫)
// --------------------------------------------------------------------------
function parseDelimitedLine(line: string, delimiter: string = ','): string[] {
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

function findHeaderIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex(h => {
    const clean = h.replace(/[\s\(\)（）_\ufeff]/g, '').toLowerCase();
    return candidates.some(c => clean.includes(c.toLowerCase()));
  });
}

export const ExcelInboundGridModal: React.FC<ExcelInboundGridModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  triggerToast,
  currentUserFullName = '現場工程師',
  canApprove = true,
  initialDraftToLoad,
  onClearInitialDraft,
}) => {
  // 主檔資料庫列表
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<BusinessPartner[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // 表格全域預設設定
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [defaultDate, setDefaultDate] = useState<string>(todayStr);
  const [autoPostDirectly, setAutoPostDirectly] = useState<boolean>(true);

  // 試算表列資料清單
  const [gridRows, setGridRows] = useState<ExcelGridRow[]>([]);

  // 📋 多草稿管理系統狀態 (草稿1、草稿2、草稿切換與轉正式單)
  const [drafts, setDrafts] = useState<InboundSpeedDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftTitle, setActiveDraftTitle] = useState<string>('');
  const [isDraftDrawerOpen, setIsDraftDrawerOpen] = useState<boolean>(false);
  const [isSaveDraftModalOpen, setIsSaveDraftModalOpen] = useState<boolean>(false);
  const [customDraftTitleInput, setCustomDraftTitleInput] = useState<string>('');

  // 極速就地快速建檔 Modal 狀態
  const [quickCreateType, setQuickCreateType] = useState<'PROJECT' | 'VENDOR' | 'ITEM' | null>(null);
  const [quickTargetRowId, setQuickTargetRowId] = useState<string | null>(null);

  // 廠商建檔欄位
  const [vendorNameInput, setVendorNameInput] = useState<string>('');
  const [vendorTaxIdInput, setVendorTaxIdInput] = useState<string>('');
  const [vendorCategoryInput, setVendorCategoryInput] = useState<string>('現場材料建材');
  const [vendorContactInput, setVendorContactInput] = useState<string>('');
  const [vendorPhoneInput, setVendorPhoneInput] = useState<string>('');
  const [vendorAddressInput, setVendorAddressInput] = useState<string>('');

  // 案場建檔欄位
  const [projectNameInput, setProjectNameInput] = useState<string>('');
  const [projectSiteInput, setProjectSiteInput] = useState<string>('');
  const [projectOwnerInput, setProjectOwnerInput] = useState<string>('');
  const [projectOwnerTaxIdInput, setProjectOwnerTaxIdInput] = useState<string>('');
  const [projectAddressInput, setProjectAddressInput] = useState<string>('');

  // 物料建檔欄位
  const [itemNameInput, setItemNameInput] = useState<string>('');
  const [itemSpecInput, setItemSpecInput] = useState<string>('');
  const [itemUnitInput, setItemUnitInput] = useState<string>('包');
  const [itemPriceInput, setItemPriceInput] = useState<number>(0);
  const [itemCategoryInput, setItemCategoryInput] = useState<string>('土木建材');

  // 🏢 廠內自用 / 車輛資產管理狀態 (可隨時自訂編輯與設定常用別名)
  const [internalAssets, setInternalAssets] = useState<InternalAsset[]>(loadStoredInternalAssets);
  const [isAssetManagerOpen, setIsAssetManagerOpen] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<Partial<InternalAsset> | null>(null);

  // 📥 匯入後未知歸屬批次校正看板狀態
  const [batchMappingAlert, setBatchMappingAlert] = useState<{
    unmappedName: string;
    count: number;
    sampleRowIds: string[];
  } | null>(null);

  // 檔案匯入 input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化讀取主檔資料
  const reloadMasterData = () => {
    const pList = getAllProjects();
    const vList = getAllBusinessPartners().filter(b => b.isVendor || b.type === 'VENDOR' || b.type === 'BOTH');
    const iList = getAllItems();
    setProjects(pList);
    setVendors(vList);
    setItems(iList);
    setInternalAssets(loadStoredInternalAssets());
  };

  // 建立空白列工廠
  const createBlankRow = (seq: number): ExcelGridRow => ({
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    seq,
    receivedDate: defaultDate,
    vendorInputName: '',
    matchedVendorId: undefined,
    vendorStatus: 'AMBIGUOUS',
    siteInputName: '',
    matchedProjectId: undefined,
    projectCodeSnapshot: undefined,
    projectStatus: 'AMBIGUOUS',
    itemName: '',
    spec: '',
    unit: '包',
    quantity: 1,
    unitPrice: 0,
    deliveryNoteNumber: '',
    notes: '',
  });

  const generateInitialRows = (count: number): ExcelGridRow[] => {
    const rows: ExcelGridRow[] = [];
    for (let i = 1; i <= count; i++) {
      rows.push(createBlankRow(i));
    }
    setGridRows(rows);
    return rows;
  };

  // 載入並同步現有草稿 (含 localStorage 與 SQLite inbound_receipts DRAFT 狀態單據)
  const reloadDraftsList = () => {
    const stored = loadStoredSpeedDrafts();
    try {
      const allDbReceipts = getAllInboundReceipts();
      const draftReceipts = allDbReceipts.filter(r => r.status === 'DRAFT');

      const mergedDrafts = [...stored];
      for (const dr of draftReceipts) {
        const exists = mergedDrafts.find(d => d.dbReceiptId === dr.id || d.id === dr.id);
        if (!exists) {
          const items = dr.items || [];
          const rows: ExcelGridRow[] = items.length > 0 ? items.map((it, idx) => ({
            id: `row-${dr.id}-${it.id || idx}`,
            seq: idx + 1,
            receivedDate: dr.receivedDate || defaultDate,
            vendorInputName: dr.vendorNameSnapshot || '',
            matchedVendorId: dr.vendorId,
            vendorStatus: dr.vendorId ? 'MATCHED' : 'AMBIGUOUS',
            siteInputName: dr.projectNameSnapshot || '',
            matchedProjectId: dr.projectId,
            projectCodeSnapshot: dr.projectCodeSnapshot,
            projectStatus: dr.projectId ? 'MATCHED' : 'AMBIGUOUS',
            itemName: it.itemName,
            spec: it.spec || '',
            unit: it.unit || '包',
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
            deliveryNoteNumber: dr.deliveryNoteNumber || '',
            notes: it.notes || dr.notes || '',
          })) : [createBlankRow(1)];

          mergedDrafts.push({
            id: dr.id,
            title: `草稿: ${dr.receiptNumber} (${dr.projectNameSnapshot || '未定案場'} · ${dr.vendorNameSnapshot || '未定廠商'})`,
            createdAt: dr.createdAt,
            updatedAt: dr.updatedAt,
            defaultDate: dr.receivedDate || defaultDate,
            rows,
            totalAmount: Number(dr.totalAmount) || 0,
            itemCount: items.length,
            primaryProjectName: dr.projectNameSnapshot,
            primaryVendorName: dr.vendorNameSnapshot,
            dbReceiptId: dr.id,
          });
        }
      }
      setDrafts(mergedDrafts);
      saveStoredSpeedDrafts(mergedDrafts);
    } catch (e) {
      console.warn('載入草稿清單警示:', e);
      setDrafts(stored);
    }
  };

  useEffect(() => {
    if (isOpen) {
      reloadMasterData();
      reloadDraftsList();

      if (initialDraftToLoad) {
        // 從外部指定載入特定草稿單據
        const items = initialDraftToLoad.items || [];
        const loadedRows: ExcelGridRow[] = items.length > 0 ? items.map((it, idx) => ({
          id: `row-${initialDraftToLoad.id}-${it.id || idx}`,
          seq: idx + 1,
          receivedDate: initialDraftToLoad.receivedDate || defaultDate,
          vendorInputName: initialDraftToLoad.vendorNameSnapshot || '',
          matchedVendorId: initialDraftToLoad.vendorId,
          vendorStatus: initialDraftToLoad.vendorId ? 'MATCHED' : 'AMBIGUOUS',
          siteInputName: initialDraftToLoad.projectNameSnapshot || '',
          matchedProjectId: initialDraftToLoad.projectId,
          projectCodeSnapshot: initialDraftToLoad.projectCodeSnapshot,
          projectStatus: initialDraftToLoad.projectId ? 'MATCHED' : 'AMBIGUOUS',
          itemName: it.itemName,
          spec: it.spec || '',
          unit: it.unit || '包',
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          deliveryNoteNumber: initialDraftToLoad.deliveryNoteNumber || '',
          notes: it.notes || initialDraftToLoad.notes || '',
        })) : [createBlankRow(1)];

        setGridRows(loadedRows);
        setActiveDraftId(initialDraftToLoad.id);
        setActiveDraftTitle(`草稿: ${initialDraftToLoad.projectNameSnapshot || '未定案場'} · ${initialDraftToLoad.vendorNameSnapshot || '未定廠商'}`);
        if (onClearInitialDraft) onClearInitialDraft();
      } else if (gridRows.length === 0) {
        generateInitialRows(5);
      }
    }
  }, [isOpen, initialDraftToLoad]);

  // --------------------------------------------------------------------------
  // 🔍 檢驗機制：案場與廠商名稱比對
  // --------------------------------------------------------------------------
  const validateProjectName = (inputName: string): {
    status: 'MATCHED' | 'NEW' | 'AMBIGUOUS' | 'INTERNAL_ASSET';
    matchedPrj?: Project;
    matchedAsset?: InternalAsset;
  } => {
    const clean = (inputName || '').trim();
    if (!clean) return { status: 'AMBIGUOUS' };
    const cleanLower = clean.toLowerCase();

    // 0. 比對可自訂之廠內自用 / 車輛資產庫 (名稱、代碼、車牌、別名)
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

    const isInternal = cleanLower.includes('廠內') || cleanLower.includes('自用') || cleanLower.includes('車') || cleanLower.includes('怪手') || cleanLower.includes('堆高機') || cleanLower.includes('翻修') || cleanLower.includes('庫存') || cleanLower.includes('廠務') || cleanLower.includes('公務車');
    if (isInternal) {
      return { status: 'INTERNAL_ASSET' };
    }

    // 1. 完全比對 (名稱、專案代碼、ID)
    const exact = projects.find(p => 
      p.name.toLowerCase() === cleanLower || 
      p.projectCode.toLowerCase() === cleanLower ||
      p.id.toLowerCase() === cleanLower
    );
    if (exact) return { status: 'MATCHED', matchedPrj: exact };

    // 2. 模糊比對
    const partial = projects.find(p => 
      p.name.toLowerCase().includes(cleanLower) || 
      cleanLower.includes(p.name.toLowerCase()) ||
      (p.projectCode && p.projectCode.toLowerCase().includes(cleanLower))
    );
    if (partial) return { status: 'MATCHED', matchedPrj: partial };

    // 未發現匹配 -> 標記為新案場
    return { status: 'NEW' };
  };

  // 🧠 案場與廠內資產全域解析器 (供 Excel / CSV 匯入與離線填寫時自動模糊辨識對齊)
  const resolveSiteOrAsset = (input: string, code?: string): {
    finalName: string;
    finalCode?: string;
    status: 'MATCHED' | 'NEW' | 'AMBIGUOUS' | 'INTERNAL_ASSET';
    matchedProjectId?: string;
    matchedAsset?: InternalAsset;
  } => {
    const clean = (input || '').trim();
    if (!clean) return { finalName: '', status: 'AMBIGUOUS' };
    const cleanLower = clean.toLowerCase();

    // 1. 比對廠內自用 / 車輛資產庫 (名稱、代碼、車牌、別名)
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
          matchedAsset: ast
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
            matchedAsset: ast
          };
        }
      }
    }

    // 常見廠內關鍵字推斷
    if (cleanLower.includes('庫存') || cleanLower.includes('放廠') || cleanLower.includes('倉庫') || cleanLower.includes('備料') || cleanLower.includes('留庫')) {
      const stockAst = internalAssets.find(a => a.type === 'CENTRAL_STOCK') || internalAssets[0];
      return {
        finalName: stockAst.name,
        finalCode: stockAst.code,
        status: 'INTERNAL_ASSET',
        matchedProjectId: 'PRJ-INTERNAL',
        matchedAsset: stockAst
      };
    }

    if (cleanLower.includes('廠內') || cleanLower.includes('自用') || cleanLower.includes('車') || cleanLower.includes('怪手') || cleanLower.includes('堆高機') || cleanLower.includes('翻修')) {
      return {
        finalName: '廠內自用 / 廠務支出',
        finalCode: '廠內自用',
        status: 'INTERNAL_ASSET',
        matchedProjectId: 'PRJ-INTERNAL'
      };
    }

    // 2. 比對現有工程專案
    const prjCheck = validateProjectName(clean);
    if (prjCheck.status === 'MATCHED' && prjCheck.matchedPrj) {
      return {
        finalName: prjCheck.matchedPrj.name,
        finalCode: prjCheck.matchedPrj.projectCode,
        status: 'MATCHED',
        matchedProjectId: prjCheck.matchedPrj.id
      };
    }

    return {
      finalName: clean,
      finalCode: code,
      status: 'NEW'
    };
  };

  const validateVendorName = (inputName: string): {
    status: 'MATCHED' | 'NEW' | 'AMBIGUOUS';
    matchedVen?: BusinessPartner;
  } => {
    const clean = (inputName || '').trim().toLowerCase();
    if (!clean) return { status: 'AMBIGUOUS' };

    // 1. 完全比對
    const exact = vendors.find(v => 
      v.name.toLowerCase() === clean || 
      v.bpCode.toLowerCase() === clean ||
      (v.taxId && v.taxId.trim() === clean)
    );
    if (exact) return { status: 'MATCHED', matchedVen: exact };

    // 2. 模糊比對
    const partial = vendors.find(v => 
      v.name.toLowerCase().includes(clean) || 
      clean.includes(v.name.toLowerCase())
    );
    if (partial) return { status: 'MATCHED', matchedVen: partial };

    return { status: 'NEW' };
  };

  // 試算表儲存格資料異動處理
  const handleCellChange = (
    rowId: string,
    field: keyof ExcelGridRow,
    value: any
  ) => {
    setGridRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;

      const updated = { ...row, [field]: value };

      if (field === 'siteInputName') {
        const resolved = resolveSiteOrAsset(String(value));
        updated.projectStatus = resolved.status;
        updated.matchedProjectId = resolved.matchedProjectId || (resolved.status === 'INTERNAL_ASSET' ? 'PRJ-INTERNAL' : undefined);
        updated.projectCodeSnapshot = resolved.finalCode;
      }

      if (field === 'vendorInputName') {
        const check = validateVendorName(String(value));
        updated.vendorStatus = check.status;
        updated.matchedVendorId = check.matchedVen?.id;
      }

      return updated;
    }));
  };

  // ⚡ 失去焦點時自動強制帶入「正式全名」，拒絕殘留 358、776、3310 等隨手簡寫
  const handleNormalizeSiteCell = (rowId: string) => {
    setGridRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const res = resolveSiteOrAsset(row.siteInputName);
      if (res.status === 'INTERNAL_ASSET' && res.matchedAsset) {
        return {
          ...row,
          siteInputName: res.matchedAsset.name, // 強制正規化帶入全名！例如「廠內貨車 [358-AB]」
          matchedProjectId: 'PRJ-INTERNAL',
          projectCodeSnapshot: res.matchedAsset.code,
          projectStatus: 'INTERNAL_ASSET',
        };
      } else if (res.status === 'MATCHED' && res.matchedProjectId) {
        return {
          ...row,
          siteInputName: res.finalName, // 強制正規化帶入案場全名！例如「3310新建工程」
          matchedProjectId: res.matchedProjectId,
          projectCodeSnapshot: res.finalCode,
          projectStatus: 'MATCHED',
        };
      }
      return row;
    }));
  };

  const handleNormalizeVendorCell = (rowId: string) => {
    setGridRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const res = validateVendorName(row.vendorInputName);
      if (res.status === 'MATCHED' && res.matchedVen) {
        return {
          ...row,
          vendorInputName: res.matchedVen.name, // 強制帶入廠商正式全銜！例如「中國鋼鐵股份有限公司」
          matchedVendorId: res.matchedVen.id,
          vendorStatus: 'MATCHED',
        };
      }
      return row;
    }));
  };

  // 🧠 方案 A 歷史進貨自適應學習索引：分析過去所有現場進貨單，自動萃取【廠商 ➔ 品名 ➔ 規格】之常用頻率、最新進價與單位
  const historicalMemory = useMemo(() => {
    // 廠商名稱 (lowercase) -> Map<品名 (lowercase), { count, latestPrice, latestUnit, specs: Map<規格, count>, lastDate }>
    const vendorMap = new Map<string, Map<string, {
      itemName: string;
      count: number;
      latestPrice: number;
      latestUnit: string;
      specs: Map<string, number>;
      lastDate: string;
    }>>();

    // 全系統通用品名規格字典 (lowercase 品名 -> Map<規格, count>)
    const globalItemSpecs = new Map<string, Map<string, number>>();

    try {
      const allReceipts = getAllInboundReceipts();
      for (const r of allReceipts) {
        if (r.status === 'VOIDED') continue; // 排除作廢單據
        const vKey = (r.vendorNameSnapshot || '').trim().toLowerCase();

        for (const it of (r.items || [])) {
          const itName = (it.itemName || '').trim();
          if (!itName) continue;
          const itKey = itName.toLowerCase();
          const spec = (it.spec || '').trim();
          const unit = it.unit || '式';
          const price = Number(it.unitPrice) || 0;
          const date = r.receivedDate || '';

          // 1. 廠商關聯記憶
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

          // 2. 全系統品名規格關聯
          if (!globalItemSpecs.has(itKey)) {
            globalItemSpecs.set(itKey, new Map());
          }
          if (spec) {
            const specMap = globalItemSpecs.get(itKey)!;
            specMap.set(spec, (specMap.get(spec) || 0) + 1);
          }
        }
      }
    } catch (e) {
      console.warn('建立歷史進貨自適應記憶失敗:', e);
    }

    return { vendorMap, globalItemSpecs };
  }, [isOpen, gridRows.length]);

  // 營建工程常用規格速查表 (輔助通用字典，完全零建檔負擔)
  const getIndustryCommonSpecs = (itemName: string): string[] => {
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
  };

  // 營建常用標準品名歸一字典 (防呆防分歧)
  interface CanonicalRule {
    keywords: string[];
    canonicalName: string;
    defaultUnit: string;
    suggestedSpec?: string;
  }

  const CANONICAL_RULES: CanonicalRule[] = [
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

  // 1. 規格混寫自動偵測 (Smart Spec Detachment)
  const detectSpecInItemName = (rawName: string): {
    cleanedItemName: string;
    extractedSpec: string;
  } | null => {
    const trimmed = (rawName || '').trim();
    if (!trimmed) return null;

    // A. 混凝土強度 (如 3000psi, 3500 psi, 4000psi, 210kg, 245kgf, 280kgf/cm², 140kg)
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

    // B. 鋼筋規格 (如 #3, #4, #5, #6, #7, #8, #10 或 D10, D13, D16, D19, D22, D25, D32 或 3分, 4分...)
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

    // C. 夾板厚度 (如: 12mm, 15mm, 18mm)
    const mmMatch = trimmed.match(/(6|9|12|15|18|20)\s*mm/i);
    if (mmMatch && (trimmed.includes('板') || trimmed.includes('模'))) {
      const spec = `${mmMatch[1]}mm`;
      const cleaned = trimmed.replace(mmMatch[0], '').replace(/[,、\-_\/\s]+/g, ' ').trim();
      return {
        cleanedItemName: cleaned.length > 0 ? (cleaned.includes('板') || cleaned.includes('模') ? cleaned : `${cleaned} 夾板模板`.trim()) : '夾板模板',
        extractedSpec: spec,
      };
    }

    // D. 管材 (如: 2吋, 3吋, 4吋, 1/2", 3/4", 1", 2", 3", 4")
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
  };

  // 2. 標準同義詞歸一化判斷
  const findCanonicalRule = (rawName: string): CanonicalRule | null => {
    const clean = (rawName || '').trim().toLowerCase();
    if (!clean) return null;
    for (const rule of CANONICAL_RULES) {
      if (rule.keywords.some(kw => clean.includes(kw.toLowerCase()))) {
        return rule;
      }
    }
    return null;
  };

  // 3. 相似品名防打錯字/多頭分流比對 (Bigram Similarity)
  const findSimilarItems = (rawName: string, maxResults: number = 2): Item[] => {
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
      if (!itName || itName === clean) continue; // 完全一致不視為模糊相似

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

    return results.sort((a, b) => b.score - a.score).slice(0, maxResults).map(r => r.item);
  };

  // ⚡ 當前儲存格快速推薦下拉狀態 (含屏幕坐標定位，使用 fixed 全局懸浮層徹底避免被表格邊界/第5列裁切)
  const [activeDropdown, setActiveDropdown] = useState<{
    rowId: string;
    field: 'site' | 'vendor' | 'item' | 'spec';
    rect: {
      top: number;
      bottom: number;
      left: number;
      width: number;
      openUpward: boolean;
    };
  } | null>(null);

  const openDropdown = (target: HTMLElement, rowId: string, field: 'site' | 'vendor' | 'item' | 'spec') => {
    const td = target.closest('td') || target;
    const rect = td.getBoundingClientRect();
    const dropdownHeight = 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setActiveDropdown({
      rowId,
      field,
      rect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        openUpward,
      }
    });
  };

  useEffect(() => {
    if (!activeDropdown) return;
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]') && !target.closest('[data-dropdown-trigger]')) {
        setActiveDropdown(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
      }
    };
    const handleScroll = (e: Event) => {
      // 若滾動發生在下拉選單內部，不關閉
      const target = e.target as HTMLElement;
      if (target && target.closest && target.closest('[data-dropdown-container]')) {
        return;
      }
      setActiveDropdown(null);
    };
    window.addEventListener('mousedown', handleDocumentClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('mousedown', handleDocumentClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [activeDropdown]);

  const handleSelectProject = (rowId: string, prj: Project) => {
    setGridRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        siteInputName: prj.name,
        matchedProjectId: prj.id,
        projectCodeSnapshot: prj.projectCode,
        projectStatus: 'MATCHED'
      };
    }));
    setActiveDropdown(null);
  };

  const handleSelectInternalAsset = (rowId: string, asset: InternalAsset | string) => {
    const isObj = typeof asset === 'object';
    const name = isObj ? asset.name : asset;
    const code = isObj ? asset.code : '廠內自用';

    setGridRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        siteInputName: name,
        matchedProjectId: 'PRJ-INTERNAL',
        projectCodeSnapshot: code,
        projectStatus: 'INTERNAL_ASSET'
      };
    }));
    setActiveDropdown(null);
  };

  // 儲存（新增/更新）廠內自用/車輛資產
  const handleSaveAsset = (assetData: Partial<InternalAsset>) => {
    if (!assetData.name?.trim()) {
      triggerToast('請輸入資產或車輛名稱', 'warn');
      return;
    }
    let current = [...internalAssets];
    if (assetData.id) {
      // 編輯更新
      current = current.map(a => a.id === assetData.id ? { ...a, ...assetData } as InternalAsset : a);
    } else {
      // 新增
      const newId = `asset-${Date.now()}`;
      let catLabel = '🚚 廠內車輛';
      if (assetData.type === 'EQUIPMENT') catLabel = '🚜 重型機具';
      if (assetData.type === 'FACILITY') catLabel = '🏠 廠區修繕';
      if (assetData.type === 'CENTRAL_STOCK') catLabel = '📦 常備庫存';

      const newAsset: InternalAsset = {
        id: newId,
        code: assetData.code?.trim() || `AST-${Date.now().toString().slice(-4)}`,
        name: assetData.name.trim(),
        type: assetData.type || 'VEHICLE',
        categoryLabel: catLabel,
        aliases: assetData.aliases || [],
        licensePlate: assetData.licensePlate?.trim(),
        driverOrCustodian: assetData.driverOrCustodian?.trim(),
        notes: assetData.notes?.trim(),
        createdAt: new Date().toISOString().slice(0, 10),
      };
      current.unshift(newAsset);
    }

    setInternalAssets(current);
    saveStoredInternalAssets(current);
    setEditingAsset(null);
    triggerToast('已成功儲存廠內車輛/資產設定！', 'success');
  };

  // 刪除廠內資產
  const handleDeleteAsset = (id: string) => {
    const filtered = internalAssets.filter(a => a.id !== id);
    setInternalAssets(filtered);
    saveStoredInternalAssets(filtered);
    triggerToast('已刪除該項廠內資產', 'success');
  };

  // 快速從打單格中就地建立新車輛/資產並回填
  const handleQuickCreateAsset = (rowId: string, inputName: string) => {
    const trimmed = inputName.trim();
    if (!trimmed) return;
    const isVeh = Boolean(trimmed.match(/[A-Z0-9]{2,4}-[A-Z0-9]{2,4}/i)) || trimmed.includes('車');
    const newAsset: InternalAsset = {
      id: `asset-${Date.now()}`,
      code: isVeh ? `VEH-${Date.now().toString().slice(-3)}` : `FAC-${Date.now().toString().slice(-3)}`,
      name: trimmed,
      type: isVeh ? 'VEHICLE' : 'FACILITY',
      categoryLabel: isVeh ? '🚚 廠內車輛' : '🏠 廠區修繕',
      aliases: [trimmed],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const updated = [newAsset, ...internalAssets];
    setInternalAssets(updated);
    saveStoredInternalAssets(updated);

    setGridRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        siteInputName: newAsset.name,
        projectCodeSnapshot: newAsset.code,
        projectStatus: 'INTERNAL_ASSET'
      };
    }));
    triggerToast(`已就地建立「${trimmed}」並自動回填至本列！`, 'success');
    setActiveDropdown(null);
  };

  // 📥 一鍵批次校正看板處理（批次指派 + 自動學習別名）
  const handleBatchMapSite = (unmappedName: string, targetAsset: InternalAsset) => {
    const cleanUnmapped = unmappedName.trim();
    if (!cleanUnmapped) return;

    // 1. 更新所有相符的打單列
    setGridRows(prev => prev.map(r => {
      if (
        r.siteInputName.trim() === cleanUnmapped ||
        r.siteInputName.trim().toLowerCase() === cleanUnmapped.toLowerCase()
      ) {
        return {
          ...r,
          siteInputName: targetAsset.name,
          projectCodeSnapshot: targetAsset.code,
          projectStatus: 'INTERNAL_ASSET'
        };
      }
      return r;
    }));

    // 2. 自動將此未識別名稱記住為別名，永久自適應學習
    if (!targetAsset.aliases.map(a => a.toLowerCase()).includes(cleanUnmapped.toLowerCase())) {
      const updated = internalAssets.map(a => {
        if (a.id === targetAsset.id) {
          return {
            ...a,
            aliases: [...a.aliases, cleanUnmapped]
          };
        }
        return a;
      });
      setInternalAssets(updated);
      saveStoredInternalAssets(updated);
    }

    setBatchMappingAlert(null);
    triggerToast(`⚡ 批次校正成功！已將「${cleanUnmapped}」全面對齊為【${targetAsset.name}】，系統已自動記住別名，下次匯入將自動辨識！`, 'success');
  };

  const handleSelectVendor = (rowId: string, ven: BusinessPartner) => {
    setGridRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        vendorInputName: ven.name,
        matchedVendorId: ven.id,
        vendorStatus: 'MATCHED'
      };
    }));
    setActiveDropdown(null);
  };

  // 帶入品名（支援連動自動建議規格、單位與單價）
  const handleSelectItem = (
    rowId: string,
    itemName: string,
    unit?: string,
    unitPrice?: number,
    suggestedSpec?: string
  ) => {
    setGridRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        itemName,
        unit: unit || r.unit,
        unitPrice: unitPrice !== undefined && unitPrice > 0 ? unitPrice : r.unitPrice,
        spec: (!r.spec && suggestedSpec) ? suggestedSpec : r.spec,
      };
    }));
    setActiveDropdown(null);
  };

  // 規格一鍵拆分回填 (如: 品名輸入 3000psi 混凝土 ➔ 自動拆為 品名【預拌混凝土】 + 規格【3000 psi】)
  const handleApplySpecDetachment = (rowId: string, cleanedName: string, extractedSpec: string) => {
    setGridRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        itemName: cleanedName,
        spec: extractedSpec,
      };
    }));
    triggerToast(`已自動拆分：品名【${cleanedName}】+ 規格【${extractedSpec}】`, 'success');
  };

  // 採用標準品名歸一 (如: 竹節 / 螺紋筋 ➔ 竹節鋼筋)
  const handleApplyCanonicalItem = (rowId: string, rule: CanonicalRule) => {
    setGridRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        itemName: rule.canonicalName,
        unit: rule.defaultUnit || r.unit,
        spec: (!r.spec && rule.suggestedSpec) ? rule.suggestedSpec : r.spec,
      };
    }));
    triggerToast(`已採用公司標準品名【${rule.canonicalName}】！`, 'success');
  };

  // 帶入規格
  const handleSelectSpec = (rowId: string, specVal: string) => {
    setGridRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        spec: specVal,
      };
    }));
    setActiveDropdown(null);
  };

  // 快速新增單列或多列
  const handleAddRows = (count: number = 1) => {
    setGridRows(prev => {
      const nextSeq = prev.length + 1;
      const newRows: ExcelGridRow[] = [];
      for (let i = 0; i < count; i++) {
        newRows.push(createBlankRow(nextSeq + i));
      }
      return [...prev, ...newRows];
    });
  };

  // 複製單列
  const handleDuplicateRow = (rowId: string) => {
    setGridRows(prev => {
      const targetIdx = prev.findIndex(r => r.id === rowId);
      if (targetIdx === -1) return prev;
      const target = prev[targetIdx];
      const cloned: ExcelGridRow = {
        ...target,
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        seq: prev.length + 1,
        deliveryNoteNumber: target.deliveryNoteNumber || '',
      };
      const copy = [...prev];
      copy.splice(targetIdx + 1, 0, cloned);
      return copy.map((r, idx) => ({ ...r, seq: idx + 1 }));
    });
    triggerToast('已複製選定列資料', 'success');
  };

  // 刪除單列
  const handleDeleteRow = (rowId: string) => {
    setGridRows(prev => {
      if (prev.length <= 1) {
        triggerToast('至少保留一筆資料列', 'warn');
        return prev;
      }
      const filtered = prev.filter(r => r.id !== rowId);
      return filtered.map((r, idx) => ({ ...r, seq: idx + 1 }));
    });
  };

  // 清空表格
  const handleClearAllRows = () => {
    generateInitialRows(5);
    triggerToast('已清空目前表格，並重設為 5 筆空白輸入列', 'success');
  };

  // --------------------------------------------------------------------------
  // 📤 匯出 CSV (純粹進貨現場欄位，去除會計年月與發票雜訊，含 UTF-8 BOM)
  // --------------------------------------------------------------------------
  const handleExportCsv = () => {
    try {
      const headers = [
        '序號', '進貨日', '廠商名稱', '個案用料(案場)', '專案代碼',
        '品名', '規格', '單位', '數量', '單價', '金額', '送貨單號', '備註'
      ];

      const rows = gridRows.map(r => {
        const lineTotal = (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0);

        return [
          r.seq,
          `"${r.receivedDate}"`,
          `"${(r.vendorInputName || '').replace(/"/g, '""')}"`,
          `"${(r.siteInputName || '').replace(/"/g, '""')}"`,
          `"${r.projectCodeSnapshot || ''}"`,
          `"${(r.itemName || '').replace(/"/g, '""')}"`,
          `"${(r.spec || '').replace(/"/g, '""')}"`,
          `"${r.unit || '包'}"`,
          Number(r.quantity) || 0,
          Number(r.unitPrice) || 0,
          lineTotal,
          `"${(r.deliveryNoteNumber || '').replace(/"/g, '""')}"`,
          `"${(r.notes || '').replace(/"/g, '""')}"`
        ];
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `現場進貨登打表_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      triggerToast('🖨️ 已成功匯出標準 CSV 試算表（Excel 直接開不亂碼）！', 'success');
    } catch (err: any) {
      triggerToast('匯出失敗: ' + err.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // 📥 匯入 CSV / Excel 檔案 (智慧對齊，包容舊版 19 欄及不完整資料)
  // --------------------------------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        parseCsvFileContent(text);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const parseCsvFileContent = (rawText: string) => {
    // 移除 UTF-8 BOM
    const text = rawText.replace(/^\uFEFF/, '');
    if (!text.trim()) {
      triggerToast('匯入檔案內容不得為空', 'warn');
      return;
    }

    const rawLines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (rawLines.length === 0) return;

    // 判斷分隔符 (Tab 優先，次為逗號)
    const delimiter = rawLines[0].includes('\t') ? '\t' : ',';
    const firstLineCols = parseDelimitedLine(rawLines[0], delimiter);

    // 檢查第一行是否為標題列
    const hasHeader = firstLineCols.some(c => 
      ['序號', '進貨日', '日期', '廠商名稱', '廠商', '個案用料', '案場', '品名', '料件', '數量', '單價', '單位', '送貨單號'].some(k => c.includes(k))
    );

    let dataLines = rawLines;
    let headerCols: string[] = [];

    if (hasHeader) {
      headerCols = firstLineCols;
      dataLines = rawLines.slice(1);
    }

    // 建立動態欄位索引
    const dateIdx = findHeaderIndex(headerCols, ['進貨日', '進貨日期', '日期', 'date']);
    const vendorIdx = findHeaderIndex(headerCols, ['廠商名稱', '供料商', '廠商', 'vendor']);
    // 備援：若為舊版發票檔案，有些在發票所屬公司代碼有填寫
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
        // 依據標題索引精準對齊，不依賴固定欄位位移
        if (dateIdx !== -1 && cols[dateIdx]) rowDate = cols[dateIdx].replace(/\//g, '-');
        
        // 廠商名稱：優先取 vendorIdx，若為空且有 altVendorIdx 則取備援
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
      } else {
        // 無標題時的智慧位置推斷
        if (cols[0]?.match(/^\d{4}/)) {
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
      }

      // 1. 廠商智慧對齊 (若模糊匹配到廠商全名，自動校正)
      const venCheck = validateVendorName(rowVendor);
      const finalVendorName = venCheck.matchedVen ? venCheck.matchedVen.name : rowVendor;

      // 2. 案場與廠內資產智慧對齊 (含車號、別名、常備庫存關鍵字自動對齊)
      const siteResolve = resolveSiteOrAsset(rowSite, rowCode);

      // 3. 品名與規格混寫自動拆分
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
      triggerToast('未能解析出有效進貨列資料，請檢查檔案格式', 'warn');
      return;
    }

    // 統計是否有相同未識別案場/名稱，開啟一鍵批次校正看板
    const unmappedCounts: Record<string, { count: number; sampleRowIds: string[] }> = {};
    for (const r of newRows) {
      if (r.projectStatus === 'NEW' && r.siteInputName.trim()) {
        const key = r.siteInputName.trim();
        if (!unmappedCounts[key]) unmappedCounts[key] = { count: 0, sampleRowIds: [] };
        unmappedCounts[key].count++;
        unmappedCounts[key].sampleRowIds.push(r.id);
      }
    }

    const topUnmapped = Object.entries(unmappedCounts).sort((a, b) => b[1].count - a[1].count)[0];
    if (topUnmapped && topUnmapped[1].count >= 1) {
      setBatchMappingAlert({
        unmappedName: topUnmapped[0],
        count: topUnmapped[1].count,
        sampleRowIds: topUnmapped[1].sampleRowIds,
      });
    } else {
      setBatchMappingAlert(null);
    }

    setGridRows(newRows);
    triggerToast(`🎉 成功匯入 ${newRows.length} 筆進貨資料！案場車輛已自動智慧辨識對齊！`, 'success');
  };

  // --------------------------------------------------------------------------
  // ⚡ 極速就地快速建檔 (Quick Create Project / Vendor / Item)
  // --------------------------------------------------------------------------
  const handleOpenQuickCreateVendor = (rowId: string, currentInput: string) => {
    setQuickTargetRowId(rowId);
    setQuickCreateType('VENDOR');
    setVendorNameInput(currentInput || '');
    setVendorTaxIdInput('');
    setVendorCategoryInput('現場材料建材');
    setVendorContactInput('業務聯絡人');
    setVendorPhoneInput('0912-345-678');
    setVendorAddressInput('');
  };

  const handleOpenQuickCreateProject = (rowId: string, currentInput: string) => {
    setQuickTargetRowId(rowId);
    setQuickCreateType('PROJECT');
    setProjectNameInput(currentInput ? `${currentInput}新建工程` : '大城蕭OO新建工程');
    setProjectSiteInput(currentInput || '大城蕭OO');
    setProjectOwnerInput('自建案場業主');
    setProjectOwnerTaxIdInput('');
    setProjectAddressInput('工地施工現場');
  };

  const handleOpenQuickCreateItem = (rowId: string, currentItemName: string, currentUnit: string, currentPrice: number) => {
    setQuickTargetRowId(rowId);
    setQuickCreateType('ITEM');
    setItemNameInput(currentItemName || '');
    setItemSpecInput('');
    setItemUnitInput(currentUnit || '包');
    setItemPriceInput(currentPrice || 0);
    setItemCategoryInput('現場建材');
  };

  const handleConfirmQuickCreate = () => {
    try {
      if (quickCreateType === 'PROJECT') {
        if (!projectNameInput.trim()) {
          triggerToast('請填寫案場名稱', 'warn');
          return;
        }
        const createdPrj = quickCreateProject(
          projectNameInput.trim(),
          projectSiteInput.trim() || projectNameInput.trim(),
          projectOwnerInput.trim() || '自建案場業主',
          'COMP-01',
          projectAddressInput.trim() || '現場工地',
          projectOwnerTaxIdInput.trim()
        );
        reloadMasterData();

        if (quickTargetRowId) {
          handleCellChange(quickTargetRowId, 'siteInputName', createdPrj.name);
          handleCellChange(quickTargetRowId, 'matchedProjectId', createdPrj.id);
          handleCellChange(quickTargetRowId, 'projectCodeSnapshot', createdPrj.projectCode);
          handleCellChange(quickTargetRowId, 'projectStatus', 'MATCHED');
        }

        triggerToast(`✅ 已在【工程案場模組】正式建檔！專案代碼：${createdPrj.projectCode}，未來案場模組直接連動共用！`, 'success');
      } else if (quickCreateType === 'VENDOR') {
        if (!vendorNameInput.trim()) {
          triggerToast('請填寫合作廠商全銜', 'warn');
          return;
        }
        const createdVen = quickCreateVendor(
          vendorNameInput.trim(),
          'COMP-01',
          vendorPhoneInput.trim(),
          vendorTaxIdInput.trim(),
          vendorContactInput.trim() || '業務窗口',
          vendorAddressInput.trim() || '通訊地址',
          vendorCategoryInput.trim()
        );
        reloadMasterData();

        if (quickTargetRowId) {
          handleCellChange(quickTargetRowId, 'vendorInputName', createdVen.name);
          handleCellChange(quickTargetRowId, 'matchedVendorId', createdVen.id);
          handleCellChange(quickTargetRowId, 'vendorStatus', 'MATCHED');
        }

        triggerToast(`✅ 已在【合作廠商模組】正式建檔！廠商編號：${createdVen.bpCode}，清冊已同步更新！`, 'success');
      } else if (quickCreateType === 'ITEM') {
        if (!itemNameInput.trim()) {
          triggerToast('請填寫品名名稱', 'warn');
          return;
        }
        const createdItm = quickCreateItem(
          itemNameInput.trim(),
          itemUnitInput.trim() || '式',
          Number(itemPriceInput) || 0,
          itemCategoryInput.trim()
        );
        reloadMasterData();

        if (quickTargetRowId) {
          handleCellChange(quickTargetRowId, 'itemName', createdItm.name);
          handleCellChange(quickTargetRowId, 'unit', createdItm.unit);
          handleCellChange(quickTargetRowId, 'unitPrice', createdItm.unitPrice);
        }

        triggerToast(`✅ 已登錄新料件「${createdItm.name}」入物料主檔清冊！`, 'success');
      }

      setQuickCreateType(null);
      setQuickTargetRowId(null);
    } catch (e: any) {
      triggerToast('建立失敗: ' + e.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // 📋 多草稿管理核心操作 (Draft Actions)
  // --------------------------------------------------------------------------

  // 1. 💾 暫存為草稿 (支援：存為草稿繼續編輯 或 存為草稿並清空開新單)
  const handleSaveAsDraft = (options: { clearAfter: boolean; customTitle?: string }) => {
    const validRows = gridRows.filter(r => r.itemName.trim().length > 0 || r.vendorInputName.trim().length > 0);
    if (validRows.length === 0) {
      triggerToast('請至少填寫一筆進貨品項或廠商名稱，方可存為草稿', 'warn');
      return;
    }

    try {
      const now = new Date();
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const firstRow = validRows[0];
      const prjName = firstRow.siteInputName.trim() || '未定案場';
      const venName = firstRow.vendorInputName.trim() || '未定廠商';
      const total = validRows.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0);

      let draftId = activeDraftId;
      const existingDraft = drafts.find(d => d.id === draftId);

      let draftTitle = options.customTitle || activeDraftTitle;
      if (!draftTitle) {
        const nextNum = drafts.length + 1;
        draftTitle = `草稿 ${nextNum}：${prjName} · ${venName}`;
      }

      if (!draftId) {
        draftId = `draft-${Date.now()}`;
      }

      // 同步寫入 / 更新 SQLite 中的 DRAFT 進貨單，確保儀表板與清冊能精準統計
      let dbReceiptId = existingDraft?.dbReceiptId || (draftId.startsWith('INB-') ? draftId : undefined);

      let finalProjectId = firstRow.matchedProjectId;
      let finalProjectName = firstRow.siteInputName.trim();

      if (firstRow.projectStatus === 'INTERNAL_ASSET' || !finalProjectId) {
        const resolved = resolveSiteOrAsset(firstRow.siteInputName);
        if (resolved.status === 'INTERNAL_ASSET') {
          finalProjectId = 'PRJ-INTERNAL';
          finalProjectName = resolved.finalName || firstRow.siteInputName.trim() || '廠內自用';
        } else if (resolved.status === 'MATCHED' && resolved.matchedProjectId) {
          finalProjectId = resolved.matchedProjectId;
          finalProjectName = resolved.finalName;
        } else {
          finalProjectId = 'PRJ-INTERNAL';
          finalProjectName = firstRow.siteInputName.trim() || '廠內自用';
        }
      }

      let finalVendorId = firstRow.matchedVendorId;
      let finalVendorName = firstRow.vendorInputName.trim();
      if (!finalVendorId && firstRow.vendorInputName.trim()) {
        const venCheck = validateVendorName(firstRow.vendorInputName);
        if (venCheck.status === 'MATCHED' && venCheck.matchedVen) {
          finalVendorId = venCheck.matchedVen.id;
          finalVendorName = venCheck.matchedVen.name;
        }
      }

      const receiptItems = validRows.map((r, idx) => ({
        id: `it-draft-${Date.now()}-${idx + 1}`,
        itemName: r.itemName || '現場材料',
        spec: r.spec || '',
        unit: r.unit || '式',
        quantity: Number(r.quantity) || 0,
        unitPrice: Number(r.unitPrice) || 0,
        lineTotal: (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
        notes: r.notes || '',
      }));

      if (dbReceiptId) {
        try {
          updateInboundReceipt(
            dbReceiptId,
            {
              projectId: finalProjectId || 'PRJ-INTERNAL',
              projectNameSnapshot: finalProjectName,
              vendorId: finalVendorId || 'BP-03',
              vendorNameSnapshot: finalVendorName,
              deliveryNoteNumber: firstRow.deliveryNoteNumber || `DN-${Date.now().toString().slice(-4)}`,
              receivedDate: firstRow.receivedDate || defaultDate,
              totalAmount: total,
              status: 'DRAFT',
              notes: `[極速打單草稿] ${draftTitle}`,
            },
            receiptItems
          );
        } catch (err) {
          console.warn('更新 SQLite 現有草稿失敗，轉為重新建立:', err);
          const created = createInboundReceipt(
            {
              companyId: 'COMP-01',
              projectId: finalProjectId || 'PRJ-INTERNAL',
              projectNameSnapshot: finalProjectName,
              vendorId: finalVendorId || 'BP-03',
              vendorNameSnapshot: finalVendorName,
              deliveryNoteNumber: firstRow.deliveryNoteNumber || `DN-${Date.now().toString().slice(-4)}`,
              receivedDate: firstRow.receivedDate || defaultDate,
              receivedBy: currentUserFullName,
              totalAmount: total,
              status: 'DRAFT',
              billingStatus: 'PENDING_BILLING',
              notes: `[極速打單草稿] ${draftTitle}`,
            },
            receiptItems
          );
          dbReceiptId = created.id;
        }
      } else {
        const created = createInboundReceipt(
          {
            companyId: 'COMP-01',
            projectId: finalProjectId || 'PRJ-INTERNAL',
            projectNameSnapshot: finalProjectName,
            vendorId: finalVendorId || 'BP-03',
            vendorNameSnapshot: finalVendorName,
            deliveryNoteNumber: firstRow.deliveryNoteNumber || `DN-${Date.now().toString().slice(-4)}`,
            receivedDate: firstRow.receivedDate || defaultDate,
            receivedBy: currentUserFullName,
            totalAmount: total,
            status: 'DRAFT',
            billingStatus: 'PENDING_BILLING',
            notes: `[極速打單草稿] ${draftTitle}`,
          },
          receiptItems
        );
        dbReceiptId = created.id;
      }

      const updatedDraft: InboundSpeedDraft = {
        id: draftId,
        title: draftTitle,
        createdAt: existingDraft?.createdAt || timeStr,
        updatedAt: timeStr,
        defaultDate,
        rows: gridRows,
        totalAmount: total,
        itemCount: validRows.length,
        primaryProjectName: prjName,
        primaryVendorName: venName,
        dbReceiptId,
      };

      const nextDrafts = drafts.filter(d => d.id !== draftId && d.dbReceiptId !== dbReceiptId);
      nextDrafts.unshift(updatedDraft);
      setDrafts(nextDrafts);
      saveStoredSpeedDrafts(nextDrafts);

      if (options.clearAfter) {
        // 清空工作台，準備打下一張單 (草稿 2)
        setGridRows(generateInitialRows(5));
        setActiveDraftId(null);
        setActiveDraftTitle('');
        triggerToast(`🎉 已成功儲存【${draftTitle}】！打單工作台已清空，可直接登打下一張單！`, 'success');
      } else {
        setActiveDraftId(draftId);
        setActiveDraftTitle(draftTitle);
        triggerToast(`💾 已儲存至【${draftTitle}】！可隨時繼續編輯或在草稿箱切換。`, 'success');
      }

      onSaved();
    } catch (err: any) {
      triggerToast('存為草稿失敗: ' + err.message, 'error');
    }
  };

  // 2. 📝 載入指定草稿至工作台接續編輯
  const handleLoadDraft = (draft: InboundSpeedDraft) => {
    setGridRows(draft.rows);
    setActiveDraftId(draft.id);
    setActiveDraftTitle(draft.title);
    setIsDraftDrawerOpen(false);
    triggerToast(`📋 已載入【${draft.title}】！可接續登打或一鍵轉為正式單。`, 'success');
  };

  // 3. 🗑️ 刪除草稿
  const handleDeleteDraft = (draftId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = drafts.find(d => d.id === draftId);
    if (!target) return;

    if (target.dbReceiptId) {
      try {
        deleteInboundReceipt(target.dbReceiptId);
      } catch (err) {
        console.warn('從資料庫刪除草稿失敗:', err);
      }
    }

    const nextDrafts = drafts.filter(d => d.id !== draftId);
    setDrafts(nextDrafts);
    saveStoredSpeedDrafts(nextDrafts);

    if (activeDraftId === draftId) {
      setGridRows(generateInitialRows(5));
      setActiveDraftId(null);
      setActiveDraftTitle('');
    }

    triggerToast(`已自草稿箱刪除【${target.title}】`, 'success');
    onSaved();
  };

  // 4. 🧹 清空工作台開新單
  const handleClearAndStartNew = () => {
    setGridRows(generateInitialRows(5));
    setActiveDraftId(null);
    setActiveDraftTitle('');
    setIsDraftDrawerOpen(false);
    triggerToast('打單工作台已清空重置，備妥 5 筆全新空白列！', 'success');
  };

  // --------------------------------------------------------------------------
  // 🚀 審核存入正式單 (Batch Commit & Convert Draft to Formal Receipts)
  // --------------------------------------------------------------------------
  const handleCommitFormalReceipts = () => {
    const validRows = gridRows.filter(r => r.itemName.trim().length > 0 || r.vendorInputName.trim().length > 0);
    if (validRows.length === 0) {
      triggerToast('請至少填寫一筆進貨品項或廠商名稱，方可審核存入', 'warn');
      return;
    }

    try {
      let createdCount = 0;
      const currentDraft = drafts.find(d => d.id === activeDraftId);
      const existingDbId = currentDraft?.dbReceiptId || (activeDraftId?.startsWith('INB-') ? activeDraftId : undefined);

      // 依廠商 + 案場 + 送貨單號 + 進貨日進行群組化，避免多物料被拆成零散單號
      const groups: { [key: string]: ExcelGridRow[] } = {};
      validRows.forEach(r => {
        const key = `${r.vendorInputName.trim()}___${r.siteInputName.trim()}___${r.deliveryNoteNumber.trim()}___${r.receivedDate.trim()}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });

      const groupKeys = Object.keys(groups);

      // 若目前是從單一草稿載入編輯，且所有資料屬於同張送貨單：
      if (existingDbId && groupKeys.length === 1) {
        const rows = groups[groupKeys[0]];
        const firstRow = rows[0];

        let finalProjectId = firstRow.matchedProjectId;
        let finalProjectName = firstRow.siteInputName.trim();

        if (firstRow.projectStatus === 'INTERNAL_ASSET' || !finalProjectId) {
          const resolved = resolveSiteOrAsset(firstRow.siteInputName);
          if (resolved.status === 'INTERNAL_ASSET') {
            finalProjectId = 'PRJ-INTERNAL';
            finalProjectName = resolved.finalName || firstRow.siteInputName.trim() || '廠內自用';
          } else if (resolved.status === 'MATCHED' && resolved.matchedProjectId) {
            finalProjectId = resolved.matchedProjectId;
            finalProjectName = resolved.finalName;
          } else {
            finalProjectId = 'PRJ-INTERNAL';
            finalProjectName = firstRow.siteInputName.trim() || '廠內自用';
          }
        }

        let finalVendorId = firstRow.matchedVendorId;
        let finalVendorName = firstRow.vendorInputName.trim();
        if (!finalVendorId && firstRow.vendorInputName.trim()) {
          const venCheck = validateVendorName(firstRow.vendorInputName);
          if (venCheck.status === 'MATCHED' && venCheck.matchedVen) {
            finalVendorId = venCheck.matchedVen.id;
            finalVendorName = venCheck.matchedVen.name;
          }
        }

        const receiptItems = rows.map((r, idx) => ({
          id: `it-${Date.now()}-${idx + 1}`,
          itemName: r.itemName || '現場材料',
          spec: r.spec || '',
          unit: r.unit || '式',
          quantity: Number(r.quantity) || 0,
          unitPrice: Number(r.unitPrice) || 0,
          lineTotal: (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
          notes: r.notes || '',
        }));

        const groupTotal = receiptItems.reduce((acc, it) => acc + it.lineTotal, 0);

        // 更新該草稿並正式過帳入庫
        updateInboundReceipt(
          existingDbId,
          {
            projectId: finalProjectId || 'PRJ-INTERNAL',
            projectNameSnapshot: finalProjectName,
            vendorId: finalVendorId || 'BP-03',
            vendorNameSnapshot: finalVendorName,
            deliveryNoteNumber: firstRow.deliveryNoteNumber || `DN-${Date.now().toString().slice(-4)}`,
            receivedDate: firstRow.receivedDate || defaultDate,
            receivedBy: currentUserFullName,
            totalAmount: groupTotal,
            status: 'POSTED',
            billingStatus: 'PENDING_BILLING',
            notes: firstRow.notes.trim(),
          },
          receiptItems
        );

        postInboundReceipt(existingDbId);
        createdCount = 1;
      } else {
        // 若包含多張單或非單一草稿，若原有草稿單據則先移除舊草稿
        if (existingDbId) {
          try {
            deleteInboundReceipt(existingDbId);
          } catch (e) {
            console.warn('清理原草稿記錄失敗:', e);
          }
        }

        for (const key of groupKeys) {
          const rows = groups[key];
          const firstRow = rows[0];

          let finalProjectId = firstRow.matchedProjectId;
          let finalProjectName = firstRow.siteInputName.trim();

          if (firstRow.projectStatus === 'INTERNAL_ASSET' || !finalProjectId) {
            const resolved = resolveSiteOrAsset(firstRow.siteInputName);
            if (resolved.status === 'INTERNAL_ASSET') {
              finalProjectId = 'PRJ-INTERNAL';
              finalProjectName = resolved.finalName || firstRow.siteInputName.trim() || '廠內自用';
            } else if (resolved.status === 'MATCHED' && resolved.matchedProjectId) {
              finalProjectId = resolved.matchedProjectId;
              finalProjectName = resolved.finalName;
            } else {
              finalProjectId = 'PRJ-INTERNAL';
              finalProjectName = firstRow.siteInputName.trim() || '廠內自用';
            }
          }

          let finalVendorId = firstRow.matchedVendorId;
          let finalVendorName = firstRow.vendorInputName.trim();
          if (!finalVendorId && firstRow.vendorInputName.trim()) {
            const venCheck = validateVendorName(firstRow.vendorInputName);
            if (venCheck.status === 'MATCHED' && venCheck.matchedVen) {
              finalVendorId = venCheck.matchedVen.id;
              finalVendorName = venCheck.matchedVen.name;
            }
          }

          const receiptItems = rows.map((r, idx) => ({
            id: `it-${Date.now()}-${idx + 1}`,
            itemName: r.itemName || '現場材料',
            spec: r.spec || '',
            unit: r.unit || '式',
            quantity: Number(r.quantity) || 0,
            unitPrice: Number(r.unitPrice) || 0,
            lineTotal: (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
            notes: r.notes || '',
          }));

          const groupTotal = receiptItems.reduce((acc, it) => acc + it.lineTotal, 0);

          createInboundReceipt(
            {
              companyId: 'COMP-01',
              projectId: finalProjectId || 'PRJ-INTERNAL',
              projectNameSnapshot: finalProjectName,
              vendorId: finalVendorId || 'BP-03',
              vendorNameSnapshot: finalVendorName,
              deliveryNoteNumber: firstRow.deliveryNoteNumber || `DN-${Date.now().toString().slice(-4)}`,
              receivedDate: firstRow.receivedDate || defaultDate,
              receivedBy: currentUserFullName,
              totalAmount: groupTotal,
              status: 'POSTED',
              billingStatus: 'PENDING_BILLING',
              notes: firstRow.notes.trim(),
            },
            receiptItems
          );
          createdCount++;
        }
      }

      // 草稿轉正後，自動自草稿清冊移除！
      if (activeDraftId) {
        const nextDrafts = drafts.filter(d => d.id !== activeDraftId && d.dbReceiptId !== existingDbId);
        setDrafts(nextDrafts);
        saveStoredSpeedDrafts(nextDrafts);
      }

      // 🌟 徹底清空打單工作台（避免殘留過去輸入資料）
      setGridRows(generateInitialRows(5));
      setActiveDraftId(null);
      setActiveDraftTitle('');

      triggerToast(
        `🎉 成功儲存並正式過帳 ${createdCount} 筆現場進貨簽收單！直入案場累計成本，工作台已為您清空備妥！`,
        'success'
      );

      onSaved();
      onClose();
    } catch (e: any) {
      triggerToast('儲存失敗: ' + e.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // 底部即時統計計算
  // --------------------------------------------------------------------------
  const summaryStats = useMemo(() => {
    let subtotal = 0;
    gridRows.forEach(r => {
      const q = Number(r.quantity) || 0;
      const p = Number(r.unitPrice) || 0;
      subtotal += q * p;
    });

    const filledCount = gridRows.filter(r => r.itemName.trim() || r.vendorInputName.trim()).length;
    return {
      subtotal,
      filledCount,
      totalRows: gridRows.length,
    };
  }, [gridRows]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      
      {/* 頂部導航與功能列 */}
      <div className="bg-slate-900 text-white border-b border-slate-800 px-5 py-3 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight">
                仿 Excel 極速進貨打單工作台
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                純粹現場進貨模式
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              專責物料現場簽收與數量單價登打 · 去除會計發票雜訊 · 支援 CSV 匯出匯入與案場廠商智慧檢驗建檔
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 📋 暫存草稿箱按鈕 (草稿1、草稿2隨時切換) */}
          <button
            onClick={() => setIsDraftDrawerOpen(!isDraftDrawerOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              isDraftDrawerOpen 
                ? 'bg-amber-500 text-slate-900 border-amber-400 shadow-sm' 
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-400/40'
            }`}
            title="查看所有暫存中的現場草稿單，支援多張草稿隨意切換、接續登打與一鍵正式入庫"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>📋 暫存草稿箱</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
              isDraftDrawerOpen ? 'bg-slate-900 text-amber-300' : 'bg-amber-400 text-slate-900'
            }`}>
              {drafts.length}
            </span>
          </button>

          {/* 隱藏之檔案上傳 input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.txt"
            className="hidden"
          />

          {/* 匯入 CSV 按鈕 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            title="匯入 CSV 試算表（自動依數量與單價重算金額，完美相容各版 CSV）"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>匯入 CSV 試算表</span>
          </button>

          {/* 匯出 CSV 按鈕 */}
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            title="匯出標準 CSV 試算表 (Excel 直接開不亂碼，欄位純粹現場化)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>匯出 CSV</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 📋 展開式草稿抽屜面板 (Draft Drawer) */}
      {isDraftDrawerOpen && (
        <div className="bg-slate-950 text-white border-b border-amber-500/40 p-4 shadow-xl z-30 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-amber-300 text-sm">
                現場進貨暫存草稿箱
              </h3>
              <span className="text-xs text-slate-400">
                （打到一半隨時存為草稿，隨意切換多張草稿，確認後一鍵轉正式單入帳）
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearAndStartNew}
                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>開一張新空白單 (打另一張單)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsDraftDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="pt-3">
            {drafts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <span>目前草稿箱中尚無暫存草稿。</span>
                <p className="text-slate-500 mt-1">
                  在下方打單時點擊「💾 存為草稿」，即可隨時暫存並在此切換多張單據！
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
                {drafts.map((d) => {
                  const isActive = activeDraftId === d.id;
                  return (
                    <div
                      key={d.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/50 shadow-md'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-100 truncate">
                              {d.title}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 text-[10px] font-black shrink-0">
                                編輯中 🟢
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                            <span>案場: <strong className="text-slate-200">{d.primaryProjectName || '未指定'}</strong></span>
                            <span>廠商: <strong className="text-slate-200">{d.primaryVendorName || '未指定'}</strong></span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 font-mono">
                            <span>料件: {d.itemCount} 筆</span>
                            <span>未稅金額: <strong className="text-amber-300 font-bold">${Number(d.totalAmount).toLocaleString()}</strong></span>
                            <span className="text-slate-500">更新: {d.updatedAt}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLoadDraft(d)}
                            className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer transition-colors shadow-xs"
                          >
                            載入編輯
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteDraft(d.id, e)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors text-center"
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🟡 現場草稿作業狀態與操作欄 (Draft Status Bar) */}
      <div className={`px-4 py-2 border-b flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 ${
        activeDraftId 
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' 
          : 'bg-slate-800/90 border-slate-700/80 text-slate-300'
      }`}>
        <div className="flex items-center gap-2.5">
          {activeDraftId ? (
            <>
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow-xs">
                <FolderOpen className="w-3 h-3" />
                <span>草稿載入中</span>
              </span>
              <span className="font-bold text-amber-300 text-xs truncate max-w-[320px]">
                {activeDraftTitle}
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                ({summaryStats.filledCount} 筆有效品項 · 合計 ${summaryStats.subtotal.toLocaleString()})
              </span>
            </>
          ) : (
            <>
              <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-bold text-[10px]">
                全新登打
              </span>
              <span className="text-xs text-slate-300">
                正在輸入新進貨單 · 支援打到一半暫存為草稿1，打另一張單存成草稿2
              </span>
              {drafts.length > 0 && (
                <span className="text-[11px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 font-mono">
                  現有 {drafts.length} 筆暫存草稿可隨時切換
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeDraftId ? (
            <>
              <button
                type="button"
                onClick={() => handleSaveAsDraft({ clearAfter: false })}
                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="儲存對此草稿的修改"
              >
                <Save className="w-3.5 h-3.5" />
                <span>更新此草稿</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveAsDraft({ clearAfter: true })}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="存妥目前草稿後清空工作台，開始打另一張新單 (草稿 2)"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>存草稿並開新單</span>
              </button>

              <button
                type="button"
                onClick={handleClearAndStartNew}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="保留此草稿不刪除，清空工作台開啟新單"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>清空開新單</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteDraft(activeDraftId!)}
                className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 cursor-pointer"
                title="放棄並自資料庫刪除此草稿"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleSaveAsDraft({ clearAfter: false })}
                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="將目前打到一半的內容暫存為草稿，方便隨時回來續打"
              >
                <Save className="w-3.5 h-3.5" />
                <span>存為草稿 (例如: 草稿 {drafts.length + 1})</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveAsDraft({ clearAfter: true })}
                className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-200 border border-amber-500/30 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="存為草稿後立即清空工作台，開始打另一張新單據"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>存為草稿並開新單</span>
              </button>

              <button
                type="button"
                onClick={handleClearAndStartNew}
                className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="清空表格所有列"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>清空重填</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ⚡ 匯入未知歸屬批次校正看板 (Batch Mapping Alert Banner) */}
      {batchMappingAlert && (
        <div className="bg-amber-950/80 text-amber-200 border-b border-amber-500/50 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 animate-in slide-in-from-top-1 duration-150 shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow-xs">
              <Sparkles className="w-3 h-3 text-slate-950" />
              <span>匯入智慧校正</span>
            </span>
            <span>
              Excel 匯入發現 <strong className="text-white font-mono bg-amber-900/90 px-1.5 py-0.2 rounded border border-amber-600/50">{batchMappingAlert.count}</strong> 筆未辨識名稱：
              【<strong className="text-amber-300 font-bold">{batchMappingAlert.unmappedName}</strong>】
            </span>
            <span className="text-[11px] text-slate-300 hidden md:inline">
              （一鍵批次指定歸屬，系統自動將此名稱記為別名，下次匯入即 100% 自動對齊！）
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-amber-300 font-medium">批次指派為：</span>
            <select
              onChange={(e) => {
                const targetId = e.target.value;
                const ast = internalAssets.find(a => a.id === targetId);
                if (ast) {
                  handleBatchMapSite(batchMappingAlert.unmappedName, ast);
                }
              }}
              defaultValue=""
              className="px-2.5 py-1 bg-slate-900 border border-amber-400/80 rounded text-amber-200 text-xs font-bold outline-none cursor-pointer hover:border-amber-300 transition-colors shadow-xs"
            >
              <option value="" disabled>點擊選擇對應之廠內資產或車輛...</option>
              {internalAssets.map(a => (
                <option key={a.id} value={a.id}>
                  {a.categoryLabel} {a.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setBatchMappingAlert(null)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
              title="忽略此次批次建議"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 批次工具列 (單純進貨日設定與列操作) */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-4 text-slate-700">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">新列預設進貨日:</span>
            <input
              type="date"
              value={defaultDate}
              onChange={e => setDefaultDate(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoPostDirectly}
              onChange={e => setAutoPostDirectly(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-semibold">審核存入時正式過帳 (直入案場累計成本)</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAddRows(1)}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>加 1 列</span>
          </button>

          <button
            onClick={() => handleAddRows(5)}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>加 5 列</span>
          </button>

          {/* 清空按鈕：直接重設，零 iframe 阻擋 */}
          <button
            onClick={handleClearAllRows}
            className="px-2.5 py-1 rounded bg-white hover:bg-rose-50 border border-slate-300 text-rose-600 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="一鍵清空目前所有輸入內容，重設為 5 筆空白列"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空表格</span>
          </button>
        </div>
      </div>

      {/* 試算表主網格 (Excel Data Grid View) */}
      <div className="flex-1 overflow-auto bg-slate-100 p-2 sm:p-3">
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden min-w-[1250px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-800 text-white sticky top-0 z-20 select-none text-[11px]">
              <tr className="divide-x divide-slate-700">
                <th className="py-2.5 px-2 text-center w-12 font-bold">序號</th>
                <th className="py-2.5 px-2 text-center w-32 font-bold">進貨日</th>
                <th className="py-2.5 px-2 w-52 font-bold">
                  <span>廠商名稱</span>
                  <span className="text-[10px] text-slate-400 block font-normal">檢驗/比對狀態</span>
                </th>
                <th className="py-2.5 px-2 w-60 font-bold">
                  <span>個案用料 / 案場</span>
                  <span className="text-[10px] text-slate-400 block font-normal">專案代碼/檢驗</span>
                </th>
                <th className="py-2.5 px-2 w-48 font-bold">品名 (料件名稱)</th>
                <th className="py-2.5 px-2 w-32 font-bold">規格</th>
                <th className="py-2.5 px-2 text-center w-24 font-bold">單位</th>
                <th className="py-2.5 px-2 text-right w-24 font-bold">數量</th>
                <th className="py-2.5 px-2 text-right w-28 font-bold">單價</th>
                <th className="py-2.5 px-2 text-right w-32 font-bold bg-slate-900 text-emerald-400">金額 (小計)</th>
                <th className="py-2.5 px-2 w-40 font-bold">送貨單號 / 簽收單號</th>
                <th className="py-2.5 px-2 w-44 font-bold">備註</th>
                <th className="py-2.5 px-2 text-center w-20 font-bold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {gridRows.map((row) => {
                const lineTotal = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);

                return (
                  <tr 
                    key={row.id}
                    className="hover:bg-indigo-50/40 transition-colors divide-x divide-slate-200 group"
                  >
                    {/* 序號 */}
                    <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-500 bg-slate-50/70">
                      {row.seq}
                    </td>

                    {/* 進貨日 */}
                    <td className="p-1">
                      <input
                        type="date"
                        value={row.receivedDate}
                        onChange={e => handleCellChange(row.id, 'receivedDate', e.target.value)}
                        className="w-full px-1.5 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded font-mono text-xs outline-none transition-colors"
                      />
                    </td>

                    {/* 廠商名稱與檢驗 (支援快速輸入即時推薦與點選回填全名，提供下拉箭頭) */}
                    <td className="p-1 relative" data-dropdown-trigger>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="輸入廠商或拉選"
                          value={row.vendorInputName}
                          onFocus={e => openDropdown(e.currentTarget, row.id, 'vendor')}
                          onClick={e => openDropdown(e.currentTarget, row.id, 'vendor')}
                          onBlur={() => handleNormalizeVendorCell(row.id)}
                          onChange={e => {
                            handleCellChange(row.id, 'vendorInputName', e.target.value);
                            openDropdown(e.currentTarget, row.id, 'vendor');
                          }}
                          className="flex-1 px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs font-semibold text-slate-900 outline-none transition-colors"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={e => {
                            e.stopPropagation();
                            if (activeDropdown?.rowId === row.id && activeDropdown?.field === 'vendor') {
                              setActiveDropdown(null);
                            } else {
                              openDropdown(e.currentTarget, row.id, 'vendor');
                            }
                          }}
                          className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="下拉查看所有合作廠商清單"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        {row.vendorStatus === 'MATCHED' && (
                          <span 
                            className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0 flex items-center gap-0.5"
                            title="已鎖定合作廠商主檔"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>既有</span>
                          </span>
                        )}
                        {row.vendorStatus === 'NEW' && row.vendorInputName.trim() && (
                          <button
                            type="button"
                            onClick={() => handleOpenQuickCreateVendor(row.id, row.vendorInputName)}
                            className="px-1.5 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold shrink-0 flex items-center gap-0.5 cursor-pointer"
                            title="未在廠商主庫發現，點擊極速建檔"
                          >
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            <span>新廠商</span>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 個案用料 / 案場名稱與專案代碼 (支援輸入 3 即刻推薦 3310新建工程 並回填全名，亦可直接拉選單查看進行中案場或廠內自用) */}
                    <td className="p-1 relative" data-dropdown-trigger>
                      <div className="flex items-center gap-1">
                        <div className="flex-1 flex items-center">
                          <input
                            type="text"
                            placeholder="輸入案場 (如 3310) 或 廠內貨車/自用"
                            value={row.siteInputName}
                            onFocus={e => openDropdown(e.currentTarget, row.id, 'site')}
                            onClick={e => openDropdown(e.currentTarget, row.id, 'site')}
                            onBlur={() => handleNormalizeSiteCell(row.id)}
                            onChange={e => {
                              handleCellChange(row.id, 'siteInputName', e.target.value);
                              openDropdown(e.currentTarget, row.id, 'site');
                            }}
                            className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs font-semibold text-slate-900 outline-none transition-colors"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={e => {
                              e.stopPropagation();
                              if (activeDropdown?.rowId === row.id && activeDropdown?.field === 'site') {
                                setActiveDropdown(null);
                              } else {
                                openDropdown(e.currentTarget, row.id, 'site');
                              }
                            }}
                            className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title="下拉查看工程案場或廠內車輛維運標籤"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {row.projectStatus === 'MATCHED' && (
                          <span 
                            className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0 flex items-center gap-0.5"
                            title="已匹配並鎖定現有專案案場"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>已鎖定</span>
                          </span>
                        )}
                        {row.projectStatus === 'INTERNAL_ASSET' && (
                          <span 
                            className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold shrink-0 flex items-center gap-0.5"
                            title="廠內自用 / 車輛資產或廠務維護，不需建案場代碼"
                          >
                            <Building2 className="w-3 h-3 text-blue-600" />
                            <span>廠內自用</span>
                          </span>
                        )}
                        {row.projectStatus === 'NEW' && row.siteInputName.trim() && (
                          <button
                            type="button"
                            onClick={() => handleOpenQuickCreateProject(row.id, row.siteInputName)}
                            className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold shrink-0 flex items-center gap-0.5 cursor-pointer"
                            title="未在案場清冊發現，點擊極速登記新案場代碼"
                          >
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>新案場</span>
                          </button>
                        )}
                      </div>

                      {row.projectCodeSnapshot && (
                        <div className={`text-[10px] font-mono font-bold px-2 mt-0.5 ${
                          row.projectStatus === 'INTERNAL_ASSET' ? 'text-blue-600' : 'text-indigo-600'
                        }`}>
                          {row.projectStatus === 'INTERNAL_ASSET' ? '類別: 廠內自用 (免建案場)' : `專案代碼: ${row.projectCodeSnapshot}`}
                        </div>
                      )}
                    </td>

                    {/* 品名 (支援點選常用標準料件帶入單位單價，各欄位徹底分離獨立) */}
                    <td className="p-1 relative" data-dropdown-trigger>
                      {(() => {
                        const cellDetectedSpec = detectSpecInItemName(row.itemName);
                        return (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="例如 竹節鋼筋 / 預拌混凝土"
                              value={row.itemName}
                              onFocus={e => openDropdown(e.currentTarget, row.id, 'item')}
                              onClick={e => openDropdown(e.currentTarget, row.id, 'item')}
                              onChange={e => {
                                handleCellChange(row.id, 'itemName', e.target.value);
                                openDropdown(e.currentTarget, row.id, 'item');
                              }}
                              className="flex-1 px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs font-bold text-slate-800 outline-none transition-colors"
                            />
                            {cellDetectedSpec && (
                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApplySpecDetachment(row.id, cellDetectedSpec.cleanedItemName, cellDetectedSpec.extractedSpec);
                                }}
                                className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-bold shrink-0 flex items-center gap-0.5 cursor-pointer shadow-xs animate-pulse"
                                title={`偵測到規格！點擊一鍵拆分為：品名【${cellDetectedSpec.cleanedItemName}】+ 規格【${cellDetectedSpec.extractedSpec}】`}
                              >
                                <Sparkles className="w-3 h-3 text-amber-700" />
                                <span>拆分規格</span>
                              </button>
                            )}
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={e => {
                                e.stopPropagation();
                                if (activeDropdown?.rowId === row.id && activeDropdown?.field === 'item') {
                                  setActiveDropdown(null);
                                } else {
                                  openDropdown(e.currentTarget, row.id, 'item');
                                }
                              }}
                              className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                              title="下拉查看標準物料清單"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            {row.itemName.trim() && (
                              <button
                                type="button"
                                onClick={() => handleOpenQuickCreateItem(row.id, row.itemName, row.unit, row.unitPrice)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 cursor-pointer transition-opacity"
                                title="將此用料登記至物料庫主檔"
                              >
                                <Package className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* 規格 (支援與廠商及品名歷史連動推薦，可直接手打新規格) */}
                    <td className="p-1 relative" data-dropdown-trigger>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="如 #4, 3000psi"
                          value={row.spec}
                          onFocus={e => openDropdown(e.currentTarget, row.id, 'spec')}
                          onClick={e => openDropdown(e.currentTarget, row.id, 'spec')}
                          onChange={e => {
                            handleCellChange(row.id, 'spec', e.target.value);
                            openDropdown(e.currentTarget, row.id, 'spec');
                          }}
                          className="flex-1 px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs outline-none transition-colors font-medium text-slate-800"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={e => {
                            e.stopPropagation();
                            if (activeDropdown?.rowId === row.id && activeDropdown?.field === 'spec') {
                              setActiveDropdown(null);
                            } else {
                              openDropdown(e.currentTarget, row.id, 'spec');
                            }
                          }}
                          className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="下拉查看該品名之常用規格與歷史進貨規格"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* 單位 */}
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.unit}
                        onChange={e => handleCellChange(row.id, 'unit', e.target.value)}
                        className="w-full px-1.5 py-1 text-center bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs font-medium outline-none transition-colors"
                      />
                    </td>

                    {/* 數量 */}
                    <td className="p-1">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={row.quantity}
                        onChange={e => handleCellChange(row.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded font-mono text-xs font-bold text-slate-800 outline-none transition-colors"
                      />
                    </td>

                    {/* 單價 */}
                    <td className="p-1">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={row.unitPrice}
                        onChange={e => handleCellChange(row.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded font-mono text-xs text-slate-800 outline-none transition-colors"
                      />
                    </td>

                    {/* 金額 (小計) - 即時動態計算 */}
                    <td className="p-1 text-right font-mono font-bold text-xs text-emerald-700 bg-emerald-50/50 px-2">
                      ${lineTotal.toLocaleString()}
                    </td>

                    {/* 送貨單號 */}
                    <td className="p-1">
                      <input
                        type="text"
                        placeholder="如 DN-3690"
                        value={row.deliveryNoteNumber}
                        onChange={e => handleCellChange(row.id, 'deliveryNoteNumber', e.target.value)}
                        className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded font-mono text-xs text-slate-700 outline-none transition-colors"
                      />
                    </td>

                    {/* 備註 */}
                    <td className="p-1">
                      <input
                        type="text"
                        placeholder="選填備註說明"
                        value={row.notes}
                        onChange={e => handleCellChange(row.id, 'notes', e.target.value)}
                        className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs text-slate-600 outline-none transition-colors"
                      />
                    </td>

                    {/* 操作 (複製 / 刪除) */}
                    <td className="py-1 px-1.5 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleDuplicateRow(row.id)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                          title="複製此列"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="刪除此列"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 底部摘要列與雙軌存檔按鈕 (草稿暫存 vs 正式過帳入帳) */}
      <div className="bg-white border-t border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-lg shrink-0">
        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">有效填寫:</span>
            <span className="font-mono font-bold text-slate-800 text-sm">{summaryStats.filledCount} 筆</span>
            <span className="text-slate-400">（總共 {summaryStats.totalRows} 列）</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">未稅總計:</span>
            <span className="font-mono font-bold text-emerald-600 text-base">
              ${summaryStats.subtotal.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 font-mono">
            <span>預估稅金 5%:</span>
            <span className="font-bold text-amber-700">
              ${Math.round(summaryStats.subtotal * 0.05).toLocaleString()}
            </span>
          </div>

          {activeDraftId && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 font-bold flex items-center gap-1">
              <FolderOpen className="w-3 h-3 text-amber-600" />
              <span>目前編輯：{activeDraftTitle}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            關閉視窗
          </button>

          {/* 🧹 清空開新單按鈕 */}
          <button
            type="button"
            onClick={handleClearAndStartNew}
            className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
            title="清空目前所有列，開一張全新的空白打單頁"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>清空開新單</span>
          </button>

          {/* 💾 暫存為草稿按鈕 */}
          <button
            type="button"
            onClick={() => handleSaveAsDraft({ clearAfter: false })}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="暫存為草稿，隨時可在草稿箱中切換或接續修改，不計入正式案場累計成本"
          >
            <Save className="w-4 h-4" />
            <span>{activeDraftId ? '💾 更新草稿' : `💾 存為草稿 (草稿 ${drafts.length + 1})`}</span>
          </button>

          {/* 🚀 審核存入正式單 (過帳入庫) */}
          <button
            type="button"
            onClick={handleCommitFormalReceipts}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
            title="正式過帳進貨單，直入案場累計成本，並自動將草稿轉正移出草稿箱、清空打單工作台！"
          >
            <FileCheck className="w-4 h-4" />
            <span>🚀 審核存入正式單 (過帳入庫)</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* ⚡ 全局浮動推薦下拉選單 (使用 fixed 徹底脫離表格容器，絕不被第5列或邊界切割) */}
      {/* ---------------------------------------------------------------------- */}
      {activeDropdown && (() => {
        const activeRow = gridRows.find(r => r.id === activeDropdown.rowId);
        if (!activeRow) return null;

        const { rect, field, rowId } = activeDropdown;
        const dropdownWidth = Math.max(rect.width, 360);
        const maxLeft = typeof window !== 'undefined' ? window.innerWidth - dropdownWidth - 16 : 400;
        const left = Math.max(12, Math.min(rect.left, maxLeft));

        return (
          <div
            data-dropdown-container
            style={{
              position: 'fixed',
              top: rect.openUpward ? undefined : rect.bottom + 4,
              bottom: rect.openUpward ? (window.innerHeight - rect.top + 4) : undefined,
              left,
              width: dropdownWidth,
              zIndex: 9999,
            }}
            className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[320px] animate-in fade-in zoom-in-95 duration-100"
          >
            {/* 廠商下拉選單 */}
            {field === 'vendor' && (() => {
              const query = activeRow.vendorInputName.trim().toLowerCase();
              const filtered = vendors.filter(v => {
                if (!query) return true;
                return (
                  (v.name && v.name.toLowerCase().includes(query)) ||
                  (v.bpCode && v.bpCode.toLowerCase().includes(query)) ||
                  (v.taxId && v.taxId.includes(query)) ||
                  (v.contactPerson && v.contactPerson.toLowerCase().includes(query))
                );
              });

              return (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-purple-600" />
                      <span>🏢 合作廠商主檔清冊</span>
                    </span>
                    <span className="text-[11px] font-mono font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      共 {filtered.length} 家
                    </span>
                  </div>

                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100 p-1">
                    {filtered.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        查無「{activeRow.vendorInputName}」之合作廠商
                      </div>
                    ) : (
                      filtered.map(v => (
                        <div
                          key={v.id}
                          onClick={() => handleSelectVendor(rowId, v)}
                          className="px-3 py-2 hover:bg-purple-50/70 rounded-lg cursor-pointer transition-colors group flex items-start justify-between gap-2"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-purple-700">
                              {v.name}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                              {v.taxId && <span>統編: {v.taxId}</span>}
                              {v.contactPerson && <span>聯絡人: {v.contactPerson}</span>}
                              {v.phone && <span>電話: {v.phone}</span>}
                            </div>
                          </div>
                          <span className="text-[10px] text-purple-600 opacity-0 group-hover:opacity-100 font-bold shrink-0 self-center">
                            點選帶入 ↵
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2 border-t border-slate-200 bg-slate-50 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenQuickCreateVendor(rowId, activeRow.vendorInputName)}
                      className="w-full py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>登記「{activeRow.vendorInputName || '新廠商'}」至合作廠商主檔</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 案場下拉選單 */}
            {field === 'site' && (() => {
              const query = activeRow.siteInputName.trim().toLowerCase();
              const filteredProjects = projects.filter(p => {
                if (!query) return true;
                return (
                  (p.name && p.name.toLowerCase().includes(query)) ||
                  (p.projectCode && p.projectCode.toLowerCase().includes(query)) ||
                  (p.ownerName && p.ownerName.toLowerCase().includes(query))
                );
              });

              const filteredAssets = internalAssets.filter(a => {
                if (!query) return true;
                return (
                  a.name.toLowerCase().includes(query) ||
                  a.code.toLowerCase().includes(query) ||
                  (a.licensePlate && a.licensePlate.toLowerCase().includes(query)) ||
                  a.aliases.some(al => al.toLowerCase().includes(query))
                );
              });

              return (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>案場與廠內自用對齊選單</span>
                    </span>
                    <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      共 {filteredProjects.length + filteredAssets.length} 項
                    </span>
                  </div>

                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100 p-1">
                    {/* 區塊 1: 廠內自用 / 車輛資產與常備庫存 (免建案場) */}
                    {filteredAssets.length > 0 && (
                      <div className="pb-1 mb-1">
                        <div className="px-2.5 py-1 text-[10px] font-bold text-blue-900 bg-blue-50/90 rounded flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1">
                            <Truck className="w-3 h-3 text-blue-600" />
                            <span>🏢 廠內自用 / 車輛資產與常備庫存（免建案場）</span>
                          </span>
                          <span className="text-[9px] font-mono text-blue-700">{filteredAssets.length} 項目</span>
                        </div>
                        {filteredAssets.map(a => (
                          <div
                            key={a.id}
                            onClick={() => handleSelectInternalAsset(rowId, a)}
                            className="px-3 py-1.5 hover:bg-blue-50/80 rounded-lg cursor-pointer transition-colors group flex items-center justify-between gap-2 mb-0.5 border border-transparent hover:border-blue-200"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-900 group-hover:text-blue-900 flex items-center gap-1.5">
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700 font-normal shrink-0">
                                  {a.categoryLabel}
                                </span>
                                <span className="truncate">{a.name}</span>
                                {a.licensePlate && (
                                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-blue-100 text-blue-800 font-bold shrink-0">
                                    {a.licensePlate}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                                <span>代碼: <strong className="text-slate-700">{a.code}</strong></span>
                                {a.driverOrCustodian && <span>保管/司機: {a.driverOrCustodian}</span>}
                                {a.aliases.length > 0 && (
                                  <span className="text-slate-400 truncate max-w-[200px]">
                                    別名: {a.aliases.slice(0, 3).join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] text-blue-700 opacity-0 group-hover:opacity-100 font-bold shrink-0">
                              帶入 ↵
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 區塊 2: 進行中工程案場清冊 */}
                    <div>
                      <div className="px-2.5 py-1 text-[10px] font-bold text-amber-900 bg-amber-50/90 rounded flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-amber-600" />
                          <span>🏗️ 進行中工程專案案場</span>
                        </span>
                        <span className="text-[9px] font-mono text-amber-700">{filteredProjects.length} 案場</span>
                      </div>
                      {filteredProjects.length === 0 && filteredAssets.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          查無「{activeRow.siteInputName}」之案場或車輛，可在下方直接登記！
                        </div>
                      ) : (
                        filteredProjects.map(p => (
                          <div
                            key={p.id}
                            onClick={() => handleSelectProject(rowId, p)}
                            className="px-3 py-1.5 hover:bg-amber-50/70 rounded-lg cursor-pointer transition-colors group flex items-start justify-between gap-2 mb-0.5"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-900 group-hover:text-amber-800 flex items-center gap-1.5">
                                <span className="truncate">{p.name}</span>
                                <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-200 shrink-0">
                                  {p.projectCode}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                {p.ownerName && <span>業主: {p.ownerName}</span>}
                              </div>
                            </div>
                            <span className="text-[10px] text-amber-700 opacity-0 group-hover:opacity-100 font-bold shrink-0 self-center">
                              帶入 ↵
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 底部快速建檔工具列 */}
                  <div className="p-2 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center gap-2">
                    {activeRow.siteInputName.trim() && (
                      <button
                        type="button"
                        onClick={() => handleQuickCreateAsset(rowId, activeRow.siteInputName)}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="將此名稱直接登記為廠內公務車或自用資產（免建案場）"
                      >
                        <Truck className="w-3 h-3" />
                        <span>登記「{activeRow.siteInputName}」為廠內車輛/資產</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenQuickCreateProject(rowId, activeRow.siteInputName)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>登記為工程案場 (PRJ)</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 物料品名下拉選單 (方案 A：優先推薦該廠商歷史進貨品名 ➔ 營建通用庫 ➔ 支援自由輸入學習) */}
            {field === 'item' && (() => {
              const query = activeRow.itemName.trim().toLowerCase();
              const vKey = activeRow.vendorInputName.trim().toLowerCase();

              // 1. 查找此廠商歷史常進品項
              let vendorHistoryItems: {
                itemName: string;
                count: number;
                latestPrice: number;
                latestUnit: string;
                specs: string[];
              }[] = [];

              if (vKey) {
                // 優先完全匹配，其次模糊比對廠商
                for (const [key, itemMap] of historicalMemory.vendorMap.entries()) {
                  if (key === vKey || key.includes(vKey) || vKey.includes(key)) {
                    for (const [, data] of itemMap.entries()) {
                      if (!query || data.itemName.toLowerCase().includes(query)) {
                        // 規格按使用次數降冪排列
                        const sortedSpecs = Array.from(data.specs.entries())
                          .sort((a, b) => b[1] - a[1])
                          .map(s => s[0]);

                        vendorHistoryItems.push({
                          itemName: data.itemName,
                          count: data.count,
                          latestPrice: data.latestPrice,
                          latestUnit: data.latestUnit,
                          specs: sortedSpecs,
                        });
                      }
                    }
                    break;
                  }
                }
              }

              // 按歷史進貨次數排序
              vendorHistoryItems.sort((a, b) => b.count - a.count);

              // 2. 標準物料庫清單 (排除已在廠商歷史中的品項避免重複)
              const historyNames = new Set(vendorHistoryItems.map(h => h.itemName.toLowerCase()));
              const standardFiltered = items.filter(it => {
                if (historyNames.has(it.name.toLowerCase())) return false;
                if (!query) return true;
                return (
                  (it.name && it.name.toLowerCase().includes(query)) ||
                  (it.itemCode && it.itemCode.toLowerCase().includes(query)) ||
                  (it.category && it.category.toLowerCase().includes(query))
                );
              });

              // 3. 智慧防呆計算：規格混入偵測、同義詞標準化、相似品名防打錯字
              const detectedSpec = detectSpecInItemName(activeRow.itemName);
              const canonicalRule = findCanonicalRule(activeRow.itemName);
              const similarItems = findSimilarItems(activeRow.itemName);

              return (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-indigo-600" />
                      <span>
                        {activeRow.vendorInputName.trim() ? (
                          <span>🏢【{activeRow.vendorInputName}】品項連動推薦</span>
                        ) : (
                          <span>⚡ 常用物料品名庫</span>
                        )}
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      共 {vendorHistoryItems.length + standardFiltered.length} 項
                    </span>
                  </div>

                  {/* 💡 防線 1: 規格混寫智慧自動拆分 (Smart Spec Detachment) */}
                  {detectedSpec && (
                    <div className="m-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 shadow-xs flex items-center justify-between gap-2 shrink-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                          <span>💡 規格混寫自動偵測</span>
                        </div>
                        <p className="text-[11px] text-amber-800 mt-0.5 leading-tight">
                          品名包含規格！建議拆為：品名【<strong className="text-amber-950 font-bold">{detectedSpec.cleanedItemName}</strong>】+ 規格【<strong className="text-amber-950 font-bold">{detectedSpec.extractedSpec}</strong>】
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplySpecDetachment(rowId, detectedSpec.cleanedItemName, detectedSpec.extractedSpec)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-xs shrink-0 flex items-center gap-1 transition-colors"
                      >
                        <span>一鍵拆分回填</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* 🏷️ 防線 2: 公司標準品名同義詞歸一 (Canonical Normalization) */}
                  {canonicalRule && activeRow.itemName.trim() !== canonicalRule.canonicalName && (
                    <div className="mx-2 mb-2 p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 shadow-xs flex items-center justify-between gap-2 shrink-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>🏷️ 公司標準品名歸一推薦</span>
                        </div>
                        <p className="text-[11px] text-indigo-800 mt-0.5 leading-tight">
                          「{activeRow.itemName}」建議採用公司標準品名【<strong className="text-indigo-950 font-bold">{canonicalRule.canonicalName}</strong>】
                        </p>
                        <span className="text-[10px] text-indigo-600 font-mono">（統一口徑，避免廠商對帳單被拆成多筆）</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyCanonicalItem(rowId, canonicalRule)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-xs shrink-0 flex items-center gap-1 transition-colors"
                      >
                        <span>採用標準名</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* ⚠️ 防線 3: 相似品名防打錯字分流 (Fuzzy Duplicate Warning) */}
                  {similarItems.length > 0 && !standardFiltered.some(it => it.name.toLowerCase() === query) && (
                    <div className="mx-2 mb-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 shadow-xs shrink-0">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-rose-800 mb-1">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>⚠️ 相似品名警示（防同音打錯字導致帳冊分歧）</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {similarItems.map(sim => (
                          <button
                            key={sim.id}
                            type="button"
                            onClick={() => handleSelectItem(rowId, sim.name, sim.unit, sim.unitPrice)}
                            className="px-2 py-1 rounded bg-white hover:bg-rose-100 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="採用已有的標準料件"
                          >
                            <span>改選庫存已有：【{sim.name}】</span>
                            {sim.unit && <span className="text-[10px] text-slate-500 font-normal">({sim.unit})</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100 p-1">
                    {/* 區塊 1: 該廠商歷史常進品項 (動態記憶) */}
                    {vendorHistoryItems.length > 0 && (
                      <div className="pb-1 mb-1">
                        <div className="px-2.5 py-1 text-[10px] font-bold text-amber-800 bg-amber-50/80 rounded flex items-center justify-between mb-1">
                          <span>⭐ 該廠商歷史進貨品項（優先推薦）</span>
                          <span>進過 {vendorHistoryItems.length} 種物料</span>
                        </div>
                        {vendorHistoryItems.map((vh, idx) => (
                          <div
                            key={`vh-${idx}`}
                            onClick={() => handleSelectItem(rowId, vh.itemName, vh.latestUnit, vh.latestPrice, vh.specs[0])}
                            className="px-3 py-2 hover:bg-amber-50/80 rounded-lg cursor-pointer transition-colors group flex items-center justify-between gap-2 border border-transparent hover:border-amber-200 mb-0.5"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-900 group-hover:text-amber-900 flex items-center gap-1.5">
                                <span>{vh.itemName}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-normal">
                                  進貨 {vh.count} 次
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                                {vh.latestUnit && <span>單位: <strong className="text-slate-700">{vh.latestUnit}</strong></span>}
                                {vh.latestPrice > 0 && <span>最新單價: <strong className="text-emerald-700 font-bold">${vh.latestPrice.toLocaleString()}</strong></span>}
                                {vh.specs.length > 0 && (
                                  <span className="text-slate-400 truncate">
                                    常用規格: {vh.specs.slice(0, 3).join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] text-amber-700 font-bold opacity-0 group-hover:opacity-100 shrink-0">
                              帶入 ↵
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 區塊 2: 標準物料庫品項 */}
                    <div>
                      {vendorHistoryItems.length > 0 && (
                        <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 bg-slate-100/80 rounded mb-1">
                          📦 其他標準材料品項
                        </div>
                      )}
                      {standardFiltered.length === 0 && vendorHistoryItems.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          查無「{activeRow.itemName}」之物料，可直接在儲存格輸入新品名（存檔自動學習記住）
                        </div>
                      ) : (
                        standardFiltered.map(it => (
                          <div
                            key={it.id}
                            onClick={() => handleSelectItem(rowId, it.name, it.unit, it.unitPrice)}
                            className="px-3 py-2 hover:bg-indigo-50/70 rounded-lg cursor-pointer transition-colors group flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                                {it.name}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                                <span>單位: {it.unit || '式'}</span>
                                {it.unitPrice > 0 && <span>參考單價: ${it.unitPrice.toLocaleString()}</span>}
                                {it.category && <span>分類: {it.category}</span>}
                              </div>
                            </div>
                            <span className="text-[10px] text-indigo-600 opacity-0 group-hover:opacity-100 font-bold shrink-0">
                              帶入 ↵
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="p-2 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate">💡 自由輸入不卡關，存檔後自動記住推薦</span>
                    <button
                      type="button"
                      onClick={() => handleOpenQuickCreateItem(rowId, activeRow.itemName, activeRow.unit, activeRow.unitPrice)}
                      className="py-1 px-2.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      <Package className="w-3 h-3" />
                      <span>登記至主物料庫</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 規格下拉選單 (方案 A：連動品名與廠商歷史 ➔ 快速常用規格膠囊 ➔ 支援直接手打) */}
            {field === 'spec' && (() => {
              const currentItem = activeRow.itemName.trim();
              const currentVendor = activeRow.vendorInputName.trim().toLowerCase();
              const currentItemKey = currentItem.toLowerCase();
              const currentSpecQuery = activeRow.spec.trim().toLowerCase();

              // 1. 查找此廠商 + 此品名之歷史規格
              const vendorSpecCounts: { spec: string; count: number }[] = [];
              if (currentVendor && currentItemKey) {
                for (const [vKey, itemMap] of historicalMemory.vendorMap.entries()) {
                  if (vKey === currentVendor || vKey.includes(currentVendor) || currentVendor.includes(vKey)) {
                    const itemData = itemMap.get(currentItemKey);
                    if (itemData && itemData.specs) {
                      for (const [sp, c] of itemData.specs.entries()) {
                        if (!currentSpecQuery || sp.toLowerCase().includes(currentSpecQuery)) {
                          vendorSpecCounts.push({ spec: sp, count: c });
                        }
                      }
                    }
                    break;
                  }
                }
              }
              vendorSpecCounts.sort((a, b) => b.count - a.count);

              // 2. 全系統此品名之歷史規格
              const globalSpecCounts: { spec: string; count: number }[] = [];
              const vendorSpecSet = new Set(vendorSpecCounts.map(v => v.spec));
              if (currentItemKey && historicalMemory.globalItemSpecs.has(currentItemKey)) {
                for (const [sp, c] of historicalMemory.globalItemSpecs.get(currentItemKey)!.entries()) {
                  if (!vendorSpecSet.has(sp) && (!currentSpecQuery || sp.toLowerCase().includes(currentSpecQuery))) {
                    globalSpecCounts.push({ spec: sp, count: c });
                  }
                }
              }
              globalSpecCounts.sort((a, b) => b.count - a.count);

              // 3. 行業通用規格速查清單 (例如 鋼筋 #3~#10, 混凝土 psi)
              const industrySpecs = getIndustryCommonSpecs(currentItem).filter(sp => {
                if (vendorSpecSet.has(sp) || globalSpecCounts.some(g => g.spec === sp)) return false;
                if (!currentSpecQuery) return true;
                return sp.toLowerCase().includes(currentSpecQuery);
              });

              return (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        {currentItem ? `📐【${currentItem}】規格智慧推薦` : '📐 材料規格推薦 (請先輸入品名)'}
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      點選立即帶入
                    </span>
                  </div>

                  {/* 常用規格一鍵點選膠囊列 */}
                  {industrySpecs.length > 0 && (
                    <div className="p-2 bg-blue-50/40 border-b border-blue-100 shrink-0">
                      <span className="text-[10px] text-blue-800 font-bold block mb-1">
                        ⚡ 常用工程規格一鍵填入：
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {industrySpecs.slice(0, 8).map((sp, idx) => (
                          <button
                            key={`ind-${idx}`}
                            type="button"
                            onClick={() => handleSelectSpec(rowId, sp)}
                            className="px-2 py-0.5 rounded-full bg-white hover:bg-blue-600 hover:text-white border border-blue-200 text-blue-800 text-[10px] font-mono font-semibold transition-colors cursor-pointer shadow-2xs"
                          >
                            {sp}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100 p-1">
                    {/* 該廠商歷史規格 */}
                    {vendorSpecCounts.length > 0 && (
                      <div className="pb-1 mb-1">
                        <div className="px-2.5 py-1 text-[10px] font-bold text-amber-800 bg-amber-50/80 rounded mb-1 flex items-center justify-between">
                          <span>⭐ 該廠商進貨歷史規格</span>
                          <span>{vendorSpecCounts.length} 種</span>
                        </div>
                        {vendorSpecCounts.map((vs, idx) => (
                          <div
                            key={`vs-${idx}`}
                            onClick={() => handleSelectSpec(rowId, vs.spec)}
                            className="px-3 py-1.5 hover:bg-amber-50/80 rounded-lg cursor-pointer transition-colors group flex items-center justify-between gap-2 border border-transparent hover:border-amber-200"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 group-hover:text-amber-900 font-mono">
                                {vs.spec}
                              </span>
                              <span className="text-[10px] font-mono text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                                使用 {vs.count} 次
                              </span>
                            </div>
                            <span className="text-[10px] text-amber-700 font-bold opacity-0 group-hover:opacity-100 shrink-0">
                              帶入 ↵
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 全系統其他常見規格 */}
                    {globalSpecCounts.length > 0 && (
                      <div className="pb-1 mb-1">
                        <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 bg-slate-100 rounded mb-1">
                          📋 全系統【{currentItem}】其他常見規格
                        </div>
                        {globalSpecCounts.map((gs, idx) => (
                          <div
                            key={`gs-${idx}`}
                            onClick={() => handleSelectSpec(rowId, gs.spec)}
                            className="px-3 py-1.5 hover:bg-indigo-50/70 rounded-lg cursor-pointer transition-colors group flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 font-mono">
                                {gs.spec}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                歷史使用 {gs.count} 次
                              </span>
                            </div>
                            <span className="text-[10px] text-indigo-600 font-bold opacity-0 group-hover:opacity-100 shrink-0">
                              帶入 ↵
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 查無規格提示 */}
                    {vendorSpecCounts.length === 0 && globalSpecCounts.length === 0 && industrySpecs.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400">
                        目前尚無規格記錄，請直接在儲存格內打字（如 #4, 15cm），存檔後系統將自動學習記住！
                      </div>
                    )}
                  </div>

                  <div className="p-2 border-t border-slate-200 bg-slate-50 shrink-0 text-[10px] text-slate-500 flex items-center justify-between">
                    <span>💡 支援任意手打規格，存檔即自動納入推薦</span>
                    <span className="font-mono text-slate-400">Esc 關閉選單</span>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ---------------------------------------------------------------------- */}
      {/* ⚡ 彈窗：就地完整建檔 (Quick Create Vendor / Project / Item Modal)       */}
      {/* ---------------------------------------------------------------------- */}
      {quickCreateType && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2.5 rounded-xl ${
                  quickCreateType === 'PROJECT' 
                    ? 'bg-amber-50 text-amber-600' 
                    : quickCreateType === 'VENDOR'
                    ? 'bg-purple-50 text-purple-600'
                    : 'bg-indigo-50 text-indigo-600'
                }`}>
                  {quickCreateType === 'PROJECT' && <Building2 className="w-5 h-5" />}
                  {quickCreateType === 'VENDOR' && <Sparkles className="w-5 h-5" />}
                  {quickCreateType === 'ITEM' && <Package className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {quickCreateType === 'PROJECT' && '⚡ 登記新案場 (自動配發專案代碼)'}
                    {quickCreateType === 'VENDOR' && '⚡ 登記新合作廠商 (同步寫入廠商主檔)'}
                    {quickCreateType === 'ITEM' && '⚡ 登記新物料品項 (建立物料主庫)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {quickCreateType === 'PROJECT' && '依系統單據編碼規範自動配發 PRJ 前綴代碼，未來案場模組直接連動共用'}
                    {quickCreateType === 'VENDOR' && '完整登記廠商統編、聯絡人與電話，正式建立【合作廠商清冊】檔案'}
                    {quickCreateType === 'ITEM' && '將現場用料登記為標準品項，未來打單可自動推薦'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickCreateType(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 新案場表單 */}
            {quickCreateType === 'PROJECT' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    案場專案全名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectNameInput}
                    onChange={e => setProjectNameInput(e.target.value)}
                    placeholder="如：大城蕭OO新建工程"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      個案用料 / 案場俗稱
                    </label>
                    <input
                      type="text"
                      value={projectSiteInput}
                      onChange={e => setProjectSiteInput(e.target.value)}
                      placeholder="如：大城蕭OO"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      起造人 / 業主姓名
                    </label>
                    <input
                      type="text"
                      value={projectOwnerInput}
                      onChange={e => setProjectOwnerInput(e.target.value)}
                      placeholder="如：蕭先生"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      業主統編 / 身分證號
                    </label>
                    <input
                      type="text"
                      value={projectOwnerTaxIdInput}
                      onChange={e => setProjectOwnerTaxIdInput(e.target.value)}
                      placeholder="選填統編或身分證"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      工地施工地址
                    </label>
                    <input
                      type="text"
                      value={projectAddressInput}
                      onChange={e => setProjectAddressInput(e.target.value)}
                      placeholder="如：彰化縣大城鄉..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between">
                  <div>
                    📌 <strong>單據編碼中樞預估產號</strong>：
                    <span className="font-mono font-bold ml-1 text-indigo-700">
                      {previewNextDocumentNumber('PRJ')}
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">
                    PRJ-YYYY-001 規範
                  </span>
                </div>
              </div>
            )}

            {/* 新合作廠商表單 (完整資訊，建立真正合作廠商主檔) */}
            {quickCreateType === 'VENDOR' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    合作廠商全銜 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={vendorNameInput}
                    onChange={e => setVendorNameInput(e.target.value)}
                    placeholder="如：東南預拌混凝土工廠 / 嘉新水泥"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      統一編號 (8 碼)
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={vendorTaxIdInput}
                      onChange={e => setVendorTaxIdInput(e.target.value)}
                      placeholder="如：88991234"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      材料/供料類別
                    </label>
                    <select
                      value={vendorCategoryInput}
                      onChange={e => setVendorCategoryInput(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    >
                      <option value="預拌混凝土">預拌混凝土</option>
                      <option value="鋼筋型鋼">鋼筋型鋼</option>
                      <option value="泥作建材">泥作建材</option>
                      <option value="水電五金">水電五金</option>
                      <option value="重機械租賃">重機械租賃</option>
                      <option value="現場材料建材">現場材料建材</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      業務 / 司機聯絡人
                    </label>
                    <input
                      type="text"
                      value={vendorContactInput}
                      onChange={e => setVendorContactInput(e.target.value)}
                      placeholder="如：王經理 / 李司機"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      聯絡電話 / 手機
                    </label>
                    <input
                      type="text"
                      value={vendorPhoneInput}
                      onChange={e => setVendorPhoneInput(e.target.value)}
                      placeholder="如：0912-345-678"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    公司通訊 / 出料廠址
                  </label>
                  <input
                    type="text"
                    value={vendorAddressInput}
                    onChange={e => setVendorAddressInput(e.target.value)}
                    placeholder="如：台中市工業區路..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900 text-[11px]">
                  🏛️ <strong>正式入庫合作廠商清冊</strong>：
                  點選後將正式寫入商業夥伴（Business Partners）模組，包含通訊錄與聯絡人資料，杜絕欄位短缺與資料遺漏。
                </div>
              </div>
            )}

            {/* 新料件表單 */}
            {quickCreateType === 'ITEM' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    料件品名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={itemNameInput}
                    onChange={e => setItemNameInput(e.target.value)}
                    placeholder="如：4000psi 預拌混凝土"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      單位
                    </label>
                    <input
                      type="text"
                      value={itemUnitInput}
                      onChange={e => setItemUnitInput(e.target.value)}
                      placeholder="如：包、立方米、支、式"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      預設單價
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={itemPriceInput}
                      onChange={e => setItemPriceInput(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    物料類別
                  </label>
                  <select
                    value={itemCategoryInput}
                    onChange={e => setItemCategoryInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="土木建材">土木建材</option>
                    <option value="預拌混凝土">預拌混凝土</option>
                    <option value="鋼筋五金">鋼筋五金</option>
                    <option value="水電材料">水電材料</option>
                    <option value="租賃耗材">租賃耗材</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickCreateType(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmQuickCreate}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>立即建立並回填</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 資產清冊由會計總帳主檔管理，現場進貨端僅作選取/對齊，不顯示維護彈窗 */}
      {false && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm tracking-tight">
                    廠內自用 / 車輛資產與廠區項目維護清冊
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    可自由增修公務車、重機具、修繕項目與常備庫存，並設定「常用別名」以利 Excel 匯入 100% 自動辨識
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAssetManagerOpen(false);
                  setEditingAsset(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 新增 / 編輯 表單區 */}
            <div className="p-4 bg-blue-50/50 border-b border-blue-200 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>{editingAsset ? '✏️ 編輯車輛 / 廠內項目' : '➕ 新增廠內公務車 / 資產項目'}</span>
                </span>
                {editingAsset && (
                  <button
                    type="button"
                    onClick={() => setEditingAsset(null)}
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    取消編輯，改為新增
                  </button>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const name = (form.elements.namedItem('assetName') as HTMLInputElement)?.value;
                  const type = (form.elements.namedItem('assetType') as HTMLSelectElement)?.value as any;
                  const plate = (form.elements.namedItem('assetPlate') as HTMLInputElement)?.value;
                  const custodian = (form.elements.namedItem('assetCustodian') as HTMLInputElement)?.value;
                  const aliasesRaw = (form.elements.namedItem('assetAliases') as HTMLInputElement)?.value;
                  const notes = (form.elements.namedItem('assetNotes') as HTMLInputElement)?.value;

                  const aliases = aliasesRaw
                    ? aliasesRaw.split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean)
                    : [];

                  handleSaveAsset({
                    id: editingAsset?.id,
                    name,
                    type,
                    licensePlate: plate,
                    driverOrCustodian: custodian,
                    aliases,
                    notes,
                  });
                }}
                className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs"
              >
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    資產 / 車輛名稱 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    name="assetName"
                    key={`name-${editingAsset?.id || 'new'}`}
                    defaultValue={editingAsset?.name || ''}
                    placeholder="如：廠內貨車 [889-CD]"
                    required
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    類型分類
                  </label>
                  <select
                    name="assetType"
                    key={`type-${editingAsset?.id || 'new'}`}
                    defaultValue={editingAsset?.type || 'VEHICLE'}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                  >
                    <option value="VEHICLE">🚚 廠內公務車 / 貨車</option>
                    <option value="EQUIPMENT">🚜 重型機具 (怪手/堆高機)</option>
                    <option value="FACILITY">🏠 廠區公共修繕 (屋頂/設備)</option>
                    <option value="CENTRAL_STOCK">📦 廠內常備公共庫存</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    車牌號碼 (車輛專用)
                  </label>
                  <input
                    name="assetPlate"
                    key={`plate-${editingAsset?.id || 'new'}`}
                    defaultValue={editingAsset?.licensePlate || ''}
                    placeholder="如：889-CD"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    司機 / 保管人
                  </label>
                  <input
                    name="assetCustodian"
                    key={`custodian-${editingAsset?.id || 'new'}`}
                    defaultValue={editingAsset?.driverOrCustodian || ''}
                    placeholder="如：陳司機 / 廠務組"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    常用別名 (以逗號分隔，用於 Excel 自動辨識)
                  </label>
                  <input
                    name="assetAliases"
                    key={`aliases-${editingAsset?.id || 'new'}`}
                    defaultValue={editingAsset?.aliases?.join(', ') || ''}
                    placeholder="如：889, 小卡, 藍色貨車"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block font-semibold text-slate-700 mb-1">
                      備註說明
                    </label>
                    <input
                      name="assetNotes"
                      key={`notes-${editingAsset?.id || 'new'}`}
                      defaultValue={editingAsset?.notes || ''}
                      placeholder="如：維修專用"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors shrink-0 flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{editingAsset ? '儲存修改' : '加入清冊'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* 現有資產清單列表 */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
              <div className="px-3 py-1.5 bg-slate-100 rounded-lg flex items-center justify-between text-[11px] font-bold text-slate-600 mb-2">
                <span>現有廠內資產與項目 ({internalAssets.length} 筆)</span>
                <span className="font-mono text-slate-500">點擊右側鉛筆可修改別名與資訊</span>
              </div>

              {internalAssets.map(ast => (
                <div
                  key={ast.id}
                  className="p-3 hover:bg-slate-50 rounded-xl transition-colors flex items-start justify-between gap-3 border border-transparent hover:border-slate-200"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-800 font-bold shrink-0">
                        {ast.categoryLabel}
                      </span>
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {ast.name}
                      </span>
                      {ast.licensePlate && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 font-mono text-[10px] font-bold shrink-0">
                          車牌: {ast.licensePlate}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-400">
                        代碼: {ast.code}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-500">
                      {ast.driverOrCustodian && (
                        <span>司機/保管: <strong className="text-slate-700">{ast.driverOrCustodian}</strong></span>
                      )}
                      {ast.notes && (
                        <span>備註: <span className="text-slate-600">{ast.notes}</span></span>
                      )}
                    </div>

                    {ast.aliases.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        <span className="text-[10px] text-slate-400 font-bold">自動辨識別名:</span>
                        {ast.aliases.map((al, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 text-[10px] border border-slate-200 font-mono"
                          >
                            {al}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingAsset(ast)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 cursor-pointer transition-colors"
                      title="編輯此項目"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAsset(ast.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                      title="刪除此項目"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500 text-[11px]">
                💡 設定豐富別名後，線下填寫 Excel 即使打暱稱或簡寫，匯入時系統也會自動對齊！
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAssetManagerOpen(false);
                  setEditingAsset(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
              >
                完成並關閉
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
