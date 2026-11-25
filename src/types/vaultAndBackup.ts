// 無紙化金庫、外部 NAS 資料夾掛載、年度備份封存與營運戰情指標型別定義

export interface SystemFile {
  id: string;
  targetTable: string;
  targetId: string;
  fileName: string;
  originalName?: string;
  savedName?: string;
  fileSizeBytes: number;
  mimeType: string;
  fileCategory: string;
  storagePath: string; // POSIX 相對路徑如 'storage/public_docs/2026/10/uuid.pdf'
  isEncrypted: boolean; // 是否為敏感文件採 AES-256-GCM 加密存放
  fileHash: string; // SHA-256 指紋
  companyId?: string;
  uploadTime: string;
  parentFileId?: string; // 前一版本檔案 ID，建立版本堆疊
  isObsolete?: boolean; // 舊版或模糊發票作廢標記
  status?: 'NORMAL' | 'MISSING'; // 實體健康檢查狀態
  isDeleted?: boolean; // 軟刪除標記
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExternalFolderLink {
  id: string;
  companyId: string;
  projectId?: string; // 綁定案場 CAD 圖庫
  partnerId?: string; // 綁定特定廠商共用區
  targetTable: string; // 關聯主模組 (如 'projects', 'business_partners')
  targetId: string; // 關聯單據 ID
  nasFolderPath: string; // 實體 NAS 共用資料夾路徑 (如 \\192.168.1.10\Drawings\Project-A)
  description?: string;
  isDeleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface FileLink {
  id: string;
  fileId: string;
  companyId?: string; // 法人隔離錨點
  projectId?: string; // 專案授權穿透錨點
  partnerId?: string; // 夥伴授權穿透錨點
  userId?: string; // 人資身分授權錨點
  targetTable: string; // 關聯主單據 (如 'business_partners', 'purchase_orders', 'valuations')
  targetId: string; // 關聯主單據 ID
  isDeleted: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnualArchiveSnapshot {
  id: string;
  archiveYear: number;
  archiveFileName: string;
  relativePath: string;
  recordCount: number;
  fileSizeBytes: number;
  fileHash: string;
  isSealed: boolean;
  sealedAt: string;
  sealedBy: string;
  description?: string;
}

export type RestoreStrategy = 'SKIP' | 'UPDATE';

export interface BackupTimeFilter {
  mode: 'ALL' | 'YEAR' | 'RANGE';
  year?: number;
  startDate?: string;
  endDate?: string;
}

export interface ModularBackupPackage {
  formatVersion: '1.0';
  exportDate: string;
  exportedBy: string;
  targetModules: string[];
  timeFilter?: BackupTimeFilter;
  tables: Record<string, any[]>;
  recordCount: number;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  details?: string[];
}

// 營運戰情室財務指標模型 (Phase 10 & 憲法第六篇)
export interface CashFlowMetrics {
  currentBankBalance: number;
  projectedAR: number;
  projectedAP: number;
  unclearedChecks: number;
  estimatedVAT: number;
  recurringExpenses: number;
  projectedNetCash: number;
  pendingChangeOrdersAmount: number; // 待補簽追加減工程風險金額
}
