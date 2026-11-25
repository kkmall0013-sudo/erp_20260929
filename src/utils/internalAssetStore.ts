// src/utils/internalAssetStore.ts
// 🏢 廠內自用資產與公務動產共用資料存取層（無 UI 純函式庫）
// 統一提供 InboundWorkspace、ExcelInboundGridModal、InternalAssetManagerModal、BasicSettingsHubWorkspace、SuperadminRecoveryCenterModal 調用

import { recordAuditLog } from '../db/sqlite';

export interface AssetMaintenanceRecord {
  id: string;
  assetId: string;
  recordDate: string;
  maintenanceType: 'REGULAR' | 'REPAIR' | 'OVERHAUL' | 'INSPECTION' | 'PARTS_REPLACEMENT';
  title: string;
  vendorName: string;
  cost: number;
  invoiceNumber?: string;
  mileageOrHours?: string;
  status: 'COMPLETED' | 'IN_PROGRESS';
  description?: string;
  handledBy?: string;
  createdAt: string;
}

export type InternalAssetCategory = 'MOVABLE' | 'REAL_ESTATE' | 'INVENTORY';

export interface InternalAsset {
  id: string;
  code: string;
  name: string;
  assetCategory?: InternalAssetCategory;
  type: 'VEHICLE' | 'FACILITY' | 'CENTRAL_STOCK' | 'EQUIPMENT';
  categoryLabel: string;
  aliases: string[];
  licensePlate?: string;
  driverOrCustodian?: string;
  locationOrAddress?: string;
  status?: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
  purchaseDate?: string;
  purchaseCost?: number;
  retiredDate?: string;
  retiredReason?: string;
  disposalMethod?: 'SCRAPPED' | 'SOLD' | 'TRADE_IN' | 'DONATED' | 'STORED';
  salvageAmount?: number;
  replacedByAssetId?: string;
  replacedByAssetName?: string;
  notes?: string;
  maintenanceRecords?: AssetMaintenanceRecord[];
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
  createdAt: string;
}

export function getAssetCategory(asset: InternalAsset): InternalAssetCategory {
  if (asset.assetCategory) return asset.assetCategory;
  if (asset.type === 'VEHICLE' || asset.type === 'EQUIPMENT') return 'MOVABLE';
  if (asset.type === 'FACILITY') return 'REAL_ESTATE';
  if (asset.type === 'CENTRAL_STOCK') return 'INVENTORY';
  return 'MOVABLE';
}

export function getAssetCategoryLabel(cat: InternalAssetCategory): string {
  switch (cat) {
    case 'MOVABLE':
      return '🚗 動產 (車輛/機具/設備)';
    case 'REAL_ESTATE':
      return '🏢 不動產 (廠房/土地/設施)';
    case 'INVENTORY':
      return '📦 庫存 (公共備料/材料進庫登記)';
  }
}

export const INTERNAL_ASSETS_STORAGE_KEY = 'erp_inbound_internal_assets_v2';

export const DEFAULT_INTERNAL_ASSETS: InternalAsset[] = [
  {
    id: 'asset-veh-358',
    code: 'VEH-358',
    name: '廠內貨車 [358-AB]',
    assetCategory: 'MOVABLE',
    type: 'VEHICLE',
    categoryLabel: '🚗 廠內動產 (車輛)',
    aliases: ['358', '358-AB', '358ab', '三噸半', '大貨車', '一號車'],
    licensePlate: '358-AB',
    driverOrCustodian: '專責司機',
    status: 'ACTIVE',
    purchaseDate: '2023-05-15',
    purchaseCost: 980000,
    notes: '3.5噸柴油框式小貨車，工區材料運補專用',
    createdAt: '2026-01-01',
    maintenanceRecords: [
      {
        id: 'maint-358-1',
        assetId: 'asset-veh-358',
        recordDate: '2026-02-10',
        maintenanceType: 'REGULAR',
        title: '定期更換機油、機油芯與煞車油檢查',
        vendorName: '台日重車輪業保養廠',
        cost: 6500,
        invoiceNumber: 'INV-TR-8812',
        mileageOrHours: '86,400 km',
        status: 'COMPLETED',
        description: '更換 15W40 柴油引擎專用合成機油 7L，更換副廠機油濾心，底盤四輪胎紋正常。',
        handledBy: '專責司機',
        createdAt: '2026-02-10',
      },
      {
        id: 'maint-358-2',
        assetId: 'asset-veh-358',
        recordDate: '2026-03-22',
        maintenanceType: 'PARTS_REPLACEMENT',
        title: '後煞車分泵分總成與前煞車來令片更換',
        vendorName: '弘揚汽車修配廠',
        cost: 14200,
        invoiceNumber: 'HY-202603-09',
        mileageOrHours: '89,800 km',
        status: 'COMPLETED',
        description: '右後輪煞車皮咬死磨損，更換左右後輪煞車皮及分泵油封，剎車力道經檢驗線測試合格。',
        handledBy: '專責司機',
        createdAt: '2026-03-22',
      },
    ],
  },
  {
    id: 'asset-veh-776',
    code: 'VEH-776',
    name: '廠內公務貨車 [776-EF]',
    assetCategory: 'MOVABLE',
    type: 'VEHICLE',
    categoryLabel: '🚗 廠內動產 (車輛)',
    aliases: ['776', '776-EF', '776ef', '二號車', '公務貨車', '公務小卡'],
    licensePlate: '776-EF',
    driverOrCustodian: '公務輪派',
    status: 'ACTIVE',
    purchaseDate: '2024-08-01',
    purchaseCost: 620000,
    notes: '公務卡車，日常採買載料與出勤',
    createdAt: '2026-01-01',
    maintenanceRecords: [
      {
        id: 'maint-776-1',
        assetId: 'asset-veh-776',
        recordDate: '2026-01-18',
        maintenanceType: 'REGULAR',
        title: '5,000 公里定期保養換油',
        vendorName: '台日重車輪業保養廠',
        cost: 4800,
        invoiceNumber: 'INV-TR-7910',
        mileageOrHours: '32,500 km',
        status: 'COMPLETED',
        description: '全車五油三水檢查，四輪對調平衡，更換機油。',
        handledBy: '公務組',
        createdAt: '2026-01-18',
      },
    ],
  },
  {
    id: 'asset-eq-pc200',
    code: 'EQ-PC200',
    name: 'PC-200 挖土機 (怪手)',
    assetCategory: 'MOVABLE',
    type: 'EQUIPMENT',
    categoryLabel: '🚜 廠內動產 (機具)',
    aliases: ['怪手', 'PC200', '挖土機', '大怪手'],
    status: 'ACTIVE',
    purchaseDate: '2022-03-10',
    purchaseCost: 2450000,
    notes: '廠內堆料與整地重型機具',
    createdAt: '2026-01-01',
    maintenanceRecords: [
      {
        id: 'maint-pc200-1',
        assetId: 'asset-eq-pc200',
        recordDate: '2026-02-28',
        maintenanceType: 'REPAIR',
        title: '大臂液壓高壓油管老化漏油搶修',
        vendorName: '順成液壓機械工程行',
        cost: 28500,
        invoiceNumber: 'SC-88910',
        mileageOrHours: '3,420 小時',
        status: 'COMPLETED',
        description: '更換兩條 1-1/4 吋四層鋼絲液壓高壓耐磨管，補充 AW-68 液壓循環油 40 公升。',
        handledBy: '機械主管',
        createdAt: '2026-02-28',
      },
    ],
  },
  {
    id: 'asset-eq-forklift',
    code: 'EQ-FORK',
    name: '廠內堆高機 (2.5噸)',
    assetCategory: 'MOVABLE',
    type: 'EQUIPMENT',
    categoryLabel: '🚜 廠內動產 (機具)',
    aliases: ['堆高機', '叉車', '2.5噸堆高機'],
    status: 'ACTIVE',
    purchaseDate: '2023-11-20',
    purchaseCost: 480000,
    notes: '倉庫與卸貨棧板專用堆高機',
    createdAt: '2026-01-01',
    maintenanceRecords: [],
  },
  {
    id: 'asset-fac-roof',
    code: 'FAC-ROOF',
    name: '總廠廠務 - 屋頂與遮雨棚修繕',
    assetCategory: 'REAL_ESTATE',
    type: 'FACILITY',
    categoryLabel: '🏢 廠內不動產 (設施修繕)',
    aliases: ['屋頂', '屋頂翻修', '翻修', '浪板修繕', '廠務修繕'],
    locationOrAddress: '五股總廠主廠房屋頂與側邊棚架',
    status: 'ACTIVE',
    purchaseDate: '2025-06-01',
    purchaseCost: 350000,
    notes: '總廠廠房屋頂與遮雨棚翻修補漏工程',
    createdAt: '2026-01-01',
    maintenanceRecords: [],
  },
  {
    id: 'asset-fac-main',
    code: 'FAC-MAIN',
    name: '五股總廠主廠房與固定天車設備',
    assetCategory: 'REAL_ESTATE',
    type: 'FACILITY',
    categoryLabel: '🏢 廠內不動產 (廠房建物)',
    aliases: ['總廠', '主廠房', '天車', '工廠', '廠辦'],
    locationOrAddress: '新北市五股區成泰路三段廠區',
    status: 'ACTIVE',
    purchaseDate: '2020-01-15',
    purchaseCost: 18500000,
    notes: '鋼構廠房主體結構、水電消防基礎設施與固定天車起重桁架',
    createdAt: '2026-01-01',
    maintenanceRecords: [],
  },
  {
    id: 'asset-stock-central',
    code: 'STOCK-CENTRAL',
    name: '廠內公共儲備庫存',
    assetCategory: 'INVENTORY',
    type: 'CENTRAL_STOCK',
    categoryLabel: '📦 廠內庫存 (常備儲備)',
    aliases: ['廠內', '庫存', '放廠', '備料', '倉庫', '放廠裡', '留庫存', '常備料', '總廠庫存'],
    locationOrAddress: '總廠 A 區常備材料儲放架',
    status: 'ACTIVE',
    notes: '先買來放廠內之通用備料（黑鐵線、手套、螺絲五金、水泥備料等），進貨直接入庫登記，消耗時不強求出庫扣帳，供進貨與耗資追蹤登記',
    createdAt: '2026-01-01',
    maintenanceRecords: [],
  },
  {
    id: 'asset-stock-steel',
    code: 'STOCK-STEEL',
    name: '常備型鋼與板材公共庫存',
    assetCategory: 'INVENTORY',
    type: 'CENTRAL_STOCK',
    categoryLabel: '📦 廠內庫存 (常備型鋼)',
    aliases: ['型鋼庫存', '鋼板庫存', '常備鋼料', '鐵板備料'],
    locationOrAddress: '總廠鋼材堆置專區',
    status: 'ACTIVE',
    notes: '通用 H 型鋼、C 型鋼與鐵板備料，進貨入庫直接登記',
    createdAt: '2026-01-01',
    maintenanceRecords: [],
  },
  {
    id: 'asset-veh-old-168',
    code: 'VEH-168',
    name: '舊三噸半貨車 [168-XY]',
    assetCategory: 'MOVABLE',
    type: 'VEHICLE',
    categoryLabel: '🚗 廠內動產 (舊車已淘汰)',
    aliases: ['168', '168-XY', '舊貨車', '老爺車'],
    licensePlate: '168-XY',
    driverOrCustodian: '原專責司機 (已由 358-AB 接棒)',
    status: 'RETIRED',
    purchaseDate: '2016-04-12',
    purchaseCost: 750000,
    retiredDate: '2025-12-15',
    retiredReason: '車齡 10 年，引擎漏油修復成本過高，經評估報廢並由 358-AB 接替服役',
    disposalMethod: 'SCRAPPED',
    salvageAmount: 38000,
    replacedByAssetId: 'asset-veh-358',
    replacedByAssetName: '廠內貨車 [358-AB]',
    notes: '歷史老爺車，已淘汰移至歷史存檔區，保留完整審計歷程',
    createdAt: '2026-01-01',
    maintenanceRecords: [
      {
        id: 'maint-168-old-1',
        assetId: 'asset-veh-old-168',
        recordDate: '2025-08-20',
        maintenanceType: 'REPAIR',
        title: '冷氣壓縮機與水箱總成換修',
        vendorName: '弘揚汽車修配廠',
        cost: 18500,
        invoiceNumber: 'HY-202508-41',
        mileageOrHours: '198,200 km',
        status: 'COMPLETED',
        description: '壓縮機軸承咬死更換，更換加大銅水箱總成。',
        handledBy: '專責司機',
        createdAt: '2025-08-20',
      },
    ],
  },
];

export function saveStoredInternalAssets(assets: InternalAsset[]): void {
  try {
    localStorage.setItem(INTERNAL_ASSETS_STORAGE_KEY, JSON.stringify(assets));
  } catch (e) {
    console.error('儲存廠內資產清單失敗:', e);
  }
}

// 載入廠內資產清單 (預設 includeDeleted = false，一般 User 與 Admin 100% 隱蔽已刪除資產)
export function loadStoredInternalAssets(includeDeleted: boolean = false): InternalAsset[] {
  try {
    const raw = localStorage.getItem(INTERNAL_ASSETS_STORAGE_KEY);
    if (!raw) {
      saveStoredInternalAssets(DEFAULT_INTERNAL_ASSETS);
      return DEFAULT_INTERNAL_ASSETS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveStoredInternalAssets(DEFAULT_INTERNAL_ASSETS);
      return DEFAULT_INTERNAL_ASSETS;
    }
    const mapped = parsed.map((a: InternalAsset) => ({
      ...a,
      assetCategory: a.assetCategory || getAssetCategory(a),
    }));
    if (includeDeleted) {
      return mapped;
    }
    return mapped.filter((a: InternalAsset) => !a.isDeleted);
  } catch (e) {
    console.warn('載入廠內資產清單失敗:', e);
    return DEFAULT_INTERNAL_ASSETS;
  }
}

export function getDeletedInternalAssets(): InternalAsset[] {
  return loadStoredInternalAssets(true).filter(a => a.isDeleted);
}

export function softDeleteInternalAsset(
  assetId: string,
  operatorName: string = '系統管理員',
  reason: string = '日常管理刪除 (可由 Superadmin 救回)'
): boolean {
  try {
    const all = loadStoredInternalAssets(true);
    const target = all.find(a => a.id === assetId);
    if (!target) return false;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const updated = all.map(a =>
      a.id === assetId
        ? {
            ...a,
            isDeleted: true,
            deletedAt: now,
            deletedBy: operatorName,
            deleteReason: reason,
          }
        : a
    );
    saveStoredInternalAssets(updated);
    recordAuditLog(operatorName, '軟刪除', '廠內資產維護', assetId, {
      資產名稱: target.name,
      資產代碼: target.code,
      資產類別: target.categoryLabel,
      原狀態: target.status || 'ACTIVE',
      軟刪除說明: '一般用戶與Admin均不可見，僅Superadmin可檢視並救援還原',
    });
    return true;
  } catch (e) {
    console.error('軟刪除廠內資產失敗:', e);
    return false;
  }
}

export function restoreInternalAsset(assetId: string, operatorName: string = 'Superadmin'): boolean {
  try {
    const all = loadStoredInternalAssets(true);
    const target = all.find(a => a.id === assetId);
    if (!target) return false;
    const updated = all.map(a =>
      a.id === assetId
        ? {
            ...a,
            isDeleted: false,
            deletedAt: undefined,
            deletedBy: undefined,
            deleteReason: undefined,
          }
        : a
    );
    saveStoredInternalAssets(updated);
    recordAuditLog(operatorName, '救援還原', '廠內資產維護', assetId, {
      資產名稱: target.name,
      資產代碼: target.code,
      原刪除人: target.deletedBy || '未知',
      原刪除時間: target.deletedAt || '未知',
      救援說明: 'Superadmin 成功救援恢復服役，一般人員已立即可見',
    });
    return true;
  } catch (e) {
    console.error('救援廠內資產失敗:', e);
    return false;
  }
}

export function purgeInternalAsset(assetId: string, operatorName: string = 'Superadmin'): boolean {
  try {
    const all = loadStoredInternalAssets(true);
    const target = all.find(a => a.id === assetId);
    if (!target) return false;
    const updated = all.filter(a => a.id !== assetId);
    saveStoredInternalAssets(updated);
    recordAuditLog(operatorName, '永久抹除', '廠內資產維護', assetId, {
      資產名稱: target.name,
      資產代碼: target.code,
      抹除說明: 'Superadmin 永久物理清除資產記錄',
    });
    return true;
  } catch (e) {
    console.error('永久抹除廠內資產失敗:', e);
    return false;
  }
}
