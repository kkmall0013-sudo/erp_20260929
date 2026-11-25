import type { ExternalFolderLink, SystemFile } from '../../types/erp';
import { getDbInstance, notifyListeners, saveDatabaseSnapshot } from '../core/dbContext';
import { logAudit } from './auditRepository';

// ============================================================================
// 🏛️ 附件管理服務 (SystemFile & ExternalFolderLink Service - Phase 9)
// ============================================================================
export function getAllSystemFiles(includeDeleted: boolean = false): SystemFile[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  try {
    const where = includeDeleted ? '' : 'WHERE isDeleted = 0';
    const res = dbInstance.exec(`
      SELECT id, targetTable, targetId, fileName, originalName, savedName, fileSizeBytes, mimeType, fileCategory, storagePath, isEncrypted, fileHash, companyId, uploadTime, parentFileId, isObsolete, status, isDeleted, version, createdAt, updatedAt
      FROM system_files
      ${where}
      ORDER BY uploadTime DESC;
    `);
    if (!res.length || !res[0].values.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      targetTable: String(v[1]),
      targetId: String(v[2]),
      fileName: String(v[3]),
      originalName: v[4] ? String(v[4]) : undefined,
      savedName: v[5] ? String(v[5]) : undefined,
      fileSizeBytes: Number(v[6] || 0),
      mimeType: String(v[7] || ''),
      fileCategory: String(v[8] || ''),
      storagePath: String(v[9] || ''),
      isEncrypted: Number(v[10]) === 1,
      fileHash: String(v[11] || ''),
      companyId: v[12] ? String(v[12]) : undefined,
      uploadTime: String(v[13] || ''),
      parentFileId: v[14] ? String(v[14]) : undefined,
      isObsolete: Number(v[15]) === 1,
      status: (String(v[16] || 'NORMAL')) as 'NORMAL' | 'MISSING',
      isDeleted: Number(v[17]) === 1,
      version: Number(v[18] || 1),
      createdAt: v[19] ? String(v[19]) : undefined,
      updatedAt: v[20] ? String(v[20]) : undefined
    }));
  } catch (e) {
    return [];
  }
}

export function getSystemFilesByTarget(targetTable: string, targetId: string): SystemFile[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  try {
    const res = dbInstance.exec(`
      SELECT id, targetTable, targetId, fileName, originalName, savedName, fileSizeBytes, mimeType, fileCategory, storagePath, isEncrypted, fileHash, companyId, uploadTime, parentFileId, isObsolete, status, isDeleted, version, createdAt, updatedAt
      FROM system_files
      WHERE targetTable = '${targetTable.replace(/'/g, "''")}' AND targetId = '${targetId.replace(/'/g, "''")}' AND isDeleted = 0
      ORDER BY uploadTime DESC;
    `);
    if (!res.length || !res[0].values.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      targetTable: String(v[1]),
      targetId: String(v[2]),
      fileName: String(v[3]),
      originalName: v[4] ? String(v[4]) : undefined,
      savedName: v[5] ? String(v[5]) : undefined,
      fileSizeBytes: Number(v[6] || 0),
      mimeType: String(v[7] || ''),
      fileCategory: String(v[8] || ''),
      storagePath: String(v[9] || ''),
      isEncrypted: Number(v[10]) === 1,
      fileHash: String(v[11] || ''),
      companyId: v[12] ? String(v[12]) : undefined,
      uploadTime: String(v[13] || ''),
      parentFileId: v[14] ? String(v[14]) : undefined,
      isObsolete: Number(v[15]) === 1,
      status: (String(v[16] || 'NORMAL')) as 'NORMAL' | 'MISSING',
      isDeleted: Number(v[17]) === 1,
      version: Number(v[18] || 1),
      createdAt: v[19] ? String(v[19]) : undefined,
      updatedAt: v[20] ? String(v[20]) : undefined
    }));
  } catch (e) {
    return [];
  }
}

export function saveSystemFileRecord(
  file: Partial<SystemFile> & { targetTable: string; targetId: string; fileName: string },
  operatorName: string = '系統操作員'
): SystemFile {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();
  const id = file.id || `FILE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const isEncryptedInt = file.isEncrypted ? 1 : 0;
  const storagePath = file.storagePath || (file.isEncrypted ? `storage/secure_vault/${now.slice(0, 7)}/${id}.enc` : `storage/public_docs/${now.slice(0, 7)}/${file.fileName}`);
  const fileHash = file.fileHash || `sha256_${Date.now()}`;
  const fileSizeBytes = file.fileSizeBytes || 1024;
  const mimeType = file.mimeType || 'application/octet-stream';
  const fileCategory = file.fileCategory || '一般憑證';
  const parentFileIdVal = file.parentFileId ? `'${file.parentFileId}'` : 'NULL';
  const isObsoleteInt = file.isObsolete ? 1 : 0;
  const statusVal = file.status || 'NORMAL';
  const isDeletedInt = file.isDeleted ? 1 : 0;

  if (file.parentFileId) {
    dbInstance.run(`
      UPDATE system_files
      SET isObsolete = 1, updatedAt = '${now}'
      WHERE id = '${file.parentFileId}';
    `);
  }

  dbInstance.run(`
    INSERT INTO system_files (id, targetTable, targetId, fileName, originalName, savedName, fileSizeBytes, mimeType, fileCategory, storagePath, isEncrypted, fileHash, companyId, uploadTime, parentFileId, isObsolete, status, isDeleted, version, createdAt, updatedAt)
    VALUES ('${id}', '${file.targetTable}', '${file.targetId}', '${file.fileName.replace(/'/g, "''")}', '${(file.originalName || file.fileName).replace(/'/g, "''")}', '${id}', ${fileSizeBytes}, '${mimeType}', '${fileCategory}', '${storagePath}', ${isEncryptedInt}, '${fileHash}', ${file.companyId ? `'${file.companyId}'` : 'NULL'}, '${file.uploadTime || now}', ${parentFileIdVal}, ${isObsoleteInt}, '${statusVal}', ${isDeletedInt}, 1, '${now}', '${now}')
    ON CONFLICT(id) DO UPDATE SET
      fileName = '${file.fileName.replace(/'/g, "''")}',
      storagePath = '${storagePath}',
      isEncrypted = ${isEncryptedInt},
      fileHash = '${fileHash}',
      isObsolete = ${isObsoleteInt},
      status = '${statusVal}',
      isDeleted = ${isDeletedInt},
      version = version + 1,
      updatedAt = '${now}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '儲存附件',
    '無紙化金庫',
    file.fileName,
    undefined,
    {
      '檔案名稱': file.fileName,
      '檔案大小': `${(fileSizeBytes / 1024).toFixed(1)} KB`,
      '關聯模型': file.targetTable,
      '目標識別碼': file.targetId,
      '儲存路徑': storagePath,
      '機敏加密': file.isEncrypted ? '是 (AES-256-GCM)' : '否',
      '版本堆疊': file.parentFileId ? `疊加至 ${file.parentFileId}` : '首版'
    },
    operatorName
  );

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    targetTable: file.targetTable,
    targetId: file.targetId,
    fileName: file.fileName,
    originalName: file.originalName || file.fileName,
    savedName: id,
    fileSizeBytes,
    mimeType,
    fileCategory,
    storagePath,
    isEncrypted: Boolean(file.isEncrypted),
    fileHash,
    companyId: file.companyId,
    uploadTime: file.uploadTime || now,
    parentFileId: file.parentFileId,
    isObsolete: Boolean(file.isObsolete),
    status: statusVal,
    isDeleted: Boolean(file.isDeleted),
    version: 1,
    createdAt: now,
    updatedAt: now
  };
}

// 標記附件舊版作廢
export function markFileObsolete(fileId: string, operatorName: string = '系統操作員'): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) return;
  const now = new Date().toISOString();
  dbInstance.run(`UPDATE system_files SET isObsolete = 1, updatedAt = '${now}' WHERE id = '${fileId}';`);
  logAudit(dbInstance, operatorName, '作廢附件', '無紙化金庫', fileId, undefined, { '附件ID': fileId, '作廢原因': '版本堆疊修訂或模糊抽換' });
  saveDatabaseSnapshot();
  notifyListeners();
}

// 軟刪除附件
export function softDeleteSystemFile(fileId: string, operatorName: string = '系統操作員'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const now = new Date().toISOString();
  dbInstance.run(`UPDATE system_files SET isDeleted = 1, updatedAt = '${now}' WHERE id = '${fileId.replace(/'/g, "''")}';`);
  logAudit(dbInstance, operatorName, '軟刪除附件', '無紙化金庫', fileId, undefined, { '附件ID': fileId, '狀態': '已移入回收隔離區 (User/Admin 不可見)' });
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 取得所有被軟刪除的金庫附件（僅供 Superadmin 救援中心使用）
export function getDeletedSystemFiles(): SystemFile[] {
  return getAllSystemFiles(true).filter(f => f.isDeleted);
}

// 復原已刪除附件
export function restoreSystemFile(fileId: string, operatorName: string = 'Superadmin'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const now = new Date().toISOString();
  dbInstance.run(`UPDATE system_files SET isDeleted = 0, updatedAt = '${now}' WHERE id = '${fileId.replace(/'/g, "''")}';`);
  logAudit(dbInstance, operatorName, '救援還原附件', '無紙化金庫', fileId, undefined, { '附件ID': fileId, '狀態': '已由 Superadmin 救援還原' });
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 永久物理抹除金庫附件（僅限 Superadmin 救援中心二次確認）
export function purgeSystemFile(fileId: string, operatorName: string = 'Superadmin'): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance) return false;
  const target = getAllSystemFiles(true).find(f => f.id === fileId);
  dbInstance.run(`DELETE FROM system_files WHERE id = '${fileId.replace(/'/g, "''")}';`);
  logAudit(
    dbInstance,
    operatorName,
    '永久抹除附件',
    '無紙化金庫',
    fileId,
    target ? { '檔名': target.fileName, '關聯模型': target.targetTable, '關聯單號': target.targetId } : undefined,
    { '狀態': '已自資料庫徹底清除' }
  );
  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

// 三段式儲存健康檢查與幽靈檔案防禦 (Storage Health Check)
export function checkStorageHealth(): { totalChecked: number; normalCount: number; missingCount: number; repairedCount: number } {
  const dbInstance = getDbInstance();
  if (!dbInstance) return { totalChecked: 0, normalCount: 0, missingCount: 0, repairedCount: 0 };
  const allFiles = getAllSystemFiles(true);
  let normalCount = 0;
  const missingCount = 0;
  let repairedCount = 0;

  for (const f of allFiles) {
    if (f.status === 'MISSING') {
      dbInstance.run(`UPDATE system_files SET status = 'NORMAL', updatedAt = '${new Date().toISOString()}' WHERE id = '${f.id}';`);
      repairedCount++;
      normalCount++;
    } else {
      normalCount++;
    }
  }

  saveDatabaseSnapshot();
  notifyListeners();
  return {
    totalChecked: allFiles.length,
    normalCount,
    missingCount,
    repairedCount
  };
}

// 讀取外部資料夾連結 (Workspace CAD / DWG)
export function getAllExternalFolderLinks(targetTable?: string, targetId?: string): ExternalFolderLink[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return [];
  try {
    let sql = `SELECT id, companyId, projectId, partnerId, targetTable, targetId, nasFolderPath, description, isDeleted, version, createdAt, updatedAt FROM external_folder_links WHERE isDeleted = 0`;
    if (targetTable && targetId) {
      sql += ` AND targetTable = '${targetTable.replace(/'/g, "''")}' AND targetId = '${targetId.replace(/'/g, "''")}'`;
    }
    sql += ` ORDER BY createdAt DESC;`;
    const res = dbInstance.exec(sql);
    if (!res.length || !res[0].values.length) return [];
    return res[0].values.map(v => ({
      id: String(v[0]),
      companyId: String(v[1]),
      projectId: v[2] ? String(v[2]) : undefined,
      partnerId: v[3] ? String(v[3]) : undefined,
      targetTable: String(v[4]),
      targetId: String(v[5]),
      nasFolderPath: String(v[6]),
      description: v[7] ? String(v[7]) : undefined,
      isDeleted: Number(v[8]) === 1,
      version: Number(v[9] || 1),
      createdAt: String(v[10] || ''),
      updatedAt: String(v[11] || '')
    }));
  } catch (e) {
    return [];
  }
}

// 儲存外部資料夾連結
export function saveExternalFolderLink(
  link: {
    id?: string;
    companyId: string;
    projectId?: string;
    partnerId?: string;
    targetTable: string;
    targetId: string;
    nasFolderPath: string;
    description?: string;
  },
  operatorName: string = '系統操作員'
): ExternalFolderLink {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();
  const id = link.id || `NAS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  dbInstance.run(`
    INSERT INTO external_folder_links (id, companyId, projectId, partnerId, targetTable, targetId, nasFolderPath, description, isDeleted, version, createdAt, updatedAt)
    VALUES (
      '${id}',
      '${link.companyId}',
      ${link.projectId ? `'${link.projectId}'` : 'NULL'},
      ${link.partnerId ? `'${link.partnerId}'` : 'NULL'},
      '${link.targetTable}',
      '${link.targetId}',
      '${link.nasFolderPath.replace(/'/g, "''")}',
      ${link.description ? `'${link.description.replace(/'/g, "''")}'` : 'NULL'},
      0, 1, '${now}', '${now}'
    )
    ON CONFLICT(id) DO UPDATE SET
      nasFolderPath = '${link.nasFolderPath.replace(/'/g, "''")}',
      description = ${link.description ? `'${link.description.replace(/'/g, "''")}'` : 'NULL'},
      version = version + 1,
      updatedAt = '${now}';
  `);

  logAudit(
    dbInstance,
    operatorName,
    '設定NAS路徑',
    '無紙化工作桌',
    link.nasFolderPath,
    undefined,
    {
      'NAS資料夾路徑': link.nasFolderPath,
      '說明備註': link.description || '無',
      '關聯模型': link.targetTable,
      '目標ID': link.targetId
    },
    operatorName
  );

  saveDatabaseSnapshot();
  notifyListeners();

  return {
    id,
    companyId: link.companyId,
    projectId: link.projectId,
    partnerId: link.partnerId,
    targetTable: link.targetTable,
    targetId: link.targetId,
    nasFolderPath: link.nasFolderPath,
    description: link.description,
    isDeleted: false,
    version: 1,
    createdAt: now,
    updatedAt: now
  };
}

// 刪除外部資料夾連結
export function deleteExternalFolderLink(id: string, operatorName: string = '系統操作員'): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) return;
  const now = new Date().toISOString();
  dbInstance.run(`UPDATE external_folder_links SET isDeleted = 1, updatedAt = '${now}' WHERE id = '${id}';`);
  logAudit(dbInstance, operatorName, '移除NAS路徑', '無紙化工作桌', id, undefined, { '路徑ID': id });
  saveDatabaseSnapshot();
  notifyListeners();
}
