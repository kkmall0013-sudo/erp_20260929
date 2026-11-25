import {
  exportSqlDump,
  exportSqliteBinary,
  restoreFromSqlScript,
  restoreFromSqliteBinary
} from '../db/sqlite';

export interface BackupFilePreview {
  name: string;
  sizeFormatted: string;
  type: 'SQLITE' | 'SQL' | 'UNKNOWN';
}

export function buildBackupFilePreview(file: File): BackupFilePreview {
  const sizeKB = Math.round(file.size / 1024);
  const sizeFormatted = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB} KB`;
  const lowerName = file.name.toLowerCase();
  let type: BackupFilePreview['type'] = 'UNKNOWN';
  if (lowerName.endsWith('.sqlite') || lowerName.endsWith('.db')) {
    type = 'SQLITE';
  } else if (lowerName.endsWith('.sql')) {
    type = 'SQL';
  }
  return {
    name: file.name,
    sizeFormatted,
    type
  };
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadSqliteBinaryFile(filename?: string): string {
  const binary = exportSqliteBinary();
  const resolvedName = filename || `enterprise_erp_database_${new Date().toISOString().slice(0, 10)}.sqlite`;
  const blob = new Blob([binary.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
  triggerBlobDownload(blob, resolvedName);
  return resolvedName;
}

export function downloadSqlDumpFile(filename?: string): string {
  const sqlContent = exportSqlDump();
  const resolvedName = filename || `enterprise_erp_dump_${new Date().toISOString().slice(0, 10)}.sql`;
  const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });
  triggerBlobDownload(blob, resolvedName);
  return resolvedName;
}

export async function executeDatabaseRestoreFile(
  file: File,
  operatorName: string = '系統管理者'
): Promise<{ success: boolean; message: string }> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.sqlite') || lowerName.endsWith('.db')) {
    const buffer = await file.arrayBuffer();
    return restoreFromSqliteBinary(buffer, operatorName);
  }
  if (lowerName.endsWith('.sql')) {
    const text = await file.text();
    return restoreFromSqlScript(text, operatorName);
  }
  return {
    success: false,
    message: '不支援的檔案格式，請上傳 .sqlite、.db 或 .sql 檔案'
  };
}
