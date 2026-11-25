import type {
  BuildingCategoryGroup,
  SubcontractorCategoryGroup,
  SubcontractorVendorItem
} from '../../types/erp';
import { getDbInstance, notifyListeners, saveDatabaseSnapshot } from '../core/dbContext';
import {
  DEFAULT_BUILDING_CATEGORY_TREE,
  DEFAULT_SUBCONTRACTOR_CATEGORY_TREE
} from '../core/dbConstants';
import { ensureDatabaseIntegrity } from '../core/dbIntegrity';
import { logAudit } from './auditRepository';

// ============================================================================
// 🏗️ 建造物與業務項目階層分類字典 (大項 -> 小項) 管理函數
// ============================================================================
export function getBuildingCategoryTree(): BuildingCategoryGroup[] {
  const dbInstance = getDbInstance();
  if (!dbInstance) return DEFAULT_BUILDING_CATEGORY_TREE;
  ensureDatabaseIntegrity(dbInstance);
  try {
    const res = dbInstance.exec(`SELECT configValue FROM system_configs WHERE configKey = 'BUILDING_CATEGORY_TREE';`);
    if (res.length && res[0].values.length && res[0].values[0][0]) {
      const parsed = JSON.parse(String(res[0].values[0][0]));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('getBuildingCategoryTree failed:', err);
  }
  return DEFAULT_BUILDING_CATEGORY_TREE;
}

export function saveBuildingCategoryTree(tree: BuildingCategoryGroup[], operatorName = '系統管理員'): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();
  const jsonStr = JSON.stringify(tree);
  dbInstance.run(`
    INSERT INTO system_configs (id, configKey, configValue, description, valueType, validFrom, isDeleted, version, updatedBy, createdAt, updatedAt)
    VALUES ('CFG-BLD-TREE', 'BUILDING_CATEGORY_TREE', '${jsonStr.replace(/'/g, "''")}', '建造物與業務項目階層分類字典 (大項/小項)', 'JSON', '${now.slice(0, 10)}', 0, 1, '${operatorName.replace(/'/g, "''")}', '${now}', '${now}')
    ON CONFLICT(configKey) DO UPDATE SET
      configValue = excluded.configValue,
      version = version + 1,
      updatedBy = excluded.updatedBy,
      updatedAt = excluded.updatedAt;
  `);

  try {
    logAudit(dbInstance, operatorName, '修改字典', '建造物與業務項目分類', '兩階層分類字典更新', {}, { 分類群組數: tree.length }, operatorName);
  } catch (_) {}

  saveDatabaseSnapshot();
  notifyListeners();
}

// ============================================================================
// 🏗️ 協力廠商二階段階層分類字典 (第一階層: 工料大類 ➔ 第二階層: 實際建檔合作廠商)
// ============================================================================
export function getSubcontractorCategoryTree(): SubcontractorCategoryGroup[] {
  const dbInstance = getDbInstance();
  let categoryList: { id: string; category: string }[] = DEFAULT_SUBCONTRACTOR_CATEGORY_TREE.map(c => ({
    id: c.id,
    category: c.category
  }));

  if (dbInstance) {
    ensureDatabaseIntegrity(dbInstance);
    try {
      const res = dbInstance.exec(`SELECT configValue FROM system_configs WHERE configKey = 'SUBCONTRACTOR_CATEGORY_TREE';`);
      if (res.length && res[0].values.length && res[0].values[0][0]) {
        const parsed = JSON.parse(String(res[0].values[0][0]));
        if (Array.isArray(parsed) && parsed.length > 0) {
          categoryList = parsed
            .map((item: any, idx: number) => ({
              id: item.id || `CAT-${idx + 1}`,
              category: String(item.category || '').trim()
            }))
            .filter((c: any) => Boolean(c.category));
        }
      }
    } catch (err) {
      console.error('getSubcontractorCategoryTree category loading failed:', err);
    }
  }

  const realVendorsMap = new Map<string, SubcontractorVendorItem[]>();
  categoryList.forEach(c => realVendorsMap.set(c.category, []));

  if (dbInstance) {
    try {
      const bpRes = dbInstance.exec(`
        SELECT id, bpCode, name, categoryMain, serviceCategoryMain, categorySub, serviceCategorySub, contactPerson, phone, status, categoryTags 
        FROM business_partners 
        WHERE isVendor = 1 AND isDeleted = 0
        ORDER BY bpCode ASC, name ASC;
      `);
      if (bpRes.length && bpRes[0].values) {
        for (const row of bpRes[0].values) {
          const bpId = String(row[0] || '');
          const bpCode = String(row[1] || '');
          const bpName = String(row[2] || '').trim();
          const catMain = String(row[3] || row[4] || '').trim();
          const catSub = String(row[5] || row[6] || '').trim();
          const contact = String(row[7] || '').trim();
          const phone = String(row[8] || '').trim();
          const status = String(row[9] || 'ACTIVE');
          const rawTags = row[10] ? String(row[10]) : '';

          if (!bpName) continue;

          let tags: string[] = [];
          if (rawTags) {
            try {
              const parsed = JSON.parse(rawTags);
              if (Array.isArray(parsed)) tags = parsed.map(s => String(s).trim()).filter(Boolean);
            } catch (_) {}
          }
          if (tags.length === 0 && catMain) {
            tags = [catMain];
          }

          const vendorItem: SubcontractorVendorItem = {
            id: bpId,
            bpCode: bpCode,
            name: bpName,
            categorySub: catSub,
            categoryTags: tags,
            contactPerson: contact,
            phone: phone,
            isActive: status !== 'SUSPENDED'
          };

          for (const tag of tags) {
            if (!realVendorsMap.has(tag)) {
              const newCatId = `CAT-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 5)}`;
              categoryList.push({ id: newCatId, category: tag });
              realVendorsMap.set(tag, []);
            }
            realVendorsMap.get(tag)!.push(vendorItem);
          }
        }
      }
    } catch (err) {
      console.error('Failed to link business_partners to subcontractor categories:', err);
    }
  }

  return categoryList.map(c => ({
    id: c.id,
    category: c.category,
    vendors: realVendorsMap.get(c.category) || []
  }));
}

export function saveSubcontractorCategoryTree(tree: SubcontractorCategoryGroup[], operatorName = '系統管理員'): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) throw new Error('資料庫尚未初始化');
  const now = new Date().toISOString();
  const categoriesOnly = tree.map(c => ({
    id: c.id,
    category: c.category.trim()
  }));
  const jsonStr = JSON.stringify(categoriesOnly);
  dbInstance.run(`
    INSERT INTO system_configs (id, configKey, configValue, description, valueType, validFrom, isDeleted, version, updatedBy, createdAt, updatedAt)
    VALUES ('CFG-SUBCONTRACTOR-TREE', 'SUBCONTRACTOR_CATEGORY_TREE', '${jsonStr.replace(/'/g, "''")}', '協力廠商二階段階層分類字典 (工料大類)', 'JSON', '${now.slice(0, 10)}', 0, 1, '${operatorName.replace(/'/g, "''")}', '${now}', '${now}')
    ON CONFLICT(configKey) DO UPDATE SET
      configValue = excluded.configValue,
      version = version + 1,
      updatedBy = excluded.updatedBy,
      updatedAt = excluded.updatedAt;
  `);

  saveDatabaseSnapshot();
  notifyListeners();
}

export function assignVendorToCategory(vendorId: string, categoryName: string, categorySub?: string): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance || !vendorId) return false;
  ensureDatabaseIntegrity(dbInstance);
  const now = new Date().toISOString();
  const cleanCat = categoryName.trim();
  if (!cleanCat) return false;

  let currentTags: string[] = [];
  try {
    const res = dbInstance.exec(`SELECT categoryTags, categoryMain FROM business_partners WHERE id = '${vendorId}';`);
    if (res.length && res[0].values.length) {
      const raw = res[0].values[0][0];
      const catMain = res[0].values[0][1];
      if (raw) {
        try {
          const p = JSON.parse(String(raw));
          if (Array.isArray(p)) currentTags = p.map(s => String(s).trim()).filter(Boolean);
        } catch (_) {}
      }
      if (currentTags.length === 0 && catMain) {
        currentTags = [String(catMain).trim()];
      }
    }
  } catch (_) {}

  if (!currentTags.includes(cleanCat)) {
    currentTags.push(cleanCat);
  }

  const tagsJson = JSON.stringify(currentTags);
  const primaryCat = currentTags[0] || cleanCat;
  const subClause = categorySub !== undefined && categorySub.trim() !== ''
    ? `, categorySub = '${categorySub.trim().replace(/'/g, "''")}', serviceCategorySub = '${categorySub.trim().replace(/'/g, "''")}'`
    : '';

  dbInstance.run(`
    UPDATE business_partners 
    SET categoryTags = '${tagsJson.replace(/'/g, "''")}',
        categoryMain = '${primaryCat.replace(/'/g, "''")}',
        serviceCategoryMain = '${primaryCat.replace(/'/g, "''")}',
        updatedAt = '${now}'
        ${subClause}
    WHERE id = '${vendorId}';
  `);

  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

export function removeVendorFromCategory(vendorId: string, categoryNameToRemove?: string): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance || !vendorId) return false;
  ensureDatabaseIntegrity(dbInstance);
  const now = new Date().toISOString();

  if (categoryNameToRemove) {
    const cleanRemove = categoryNameToRemove.trim();
    let currentTags: string[] = [];
    try {
      const res = dbInstance.exec(`SELECT categoryTags, categoryMain FROM business_partners WHERE id = '${vendorId}';`);
      if (res.length && res[0].values.length) {
        const raw = res[0].values[0][0];
        const catMain = res[0].values[0][1];
        if (raw) {
          try {
            const p = JSON.parse(String(raw));
            if (Array.isArray(p)) currentTags = p.map(s => String(s).trim()).filter(Boolean);
          } catch (_) {}
        }
        if (currentTags.length === 0 && catMain) {
          currentTags = [String(catMain).trim()];
        }
      }
    } catch (_) {}

    currentTags = currentTags.filter(t => t !== cleanRemove);
    const tagsJson = JSON.stringify(currentTags);
    const primaryCat = currentTags[0] || null;

    dbInstance.run(`
      UPDATE business_partners 
      SET categoryTags = '${tagsJson.replace(/'/g, "''")}',
          categoryMain = ${primaryCat ? `'${primaryCat.replace(/'/g, "''")}'` : 'NULL'},
          serviceCategoryMain = ${primaryCat ? `'${primaryCat.replace(/'/g, "''")}'` : 'NULL'},
          updatedAt = '${now}'
      WHERE id = '${vendorId}';
    `);
  } else {
    dbInstance.run(`
      UPDATE business_partners 
      SET categoryTags = '[]',
          categoryMain = NULL,
          serviceCategoryMain = NULL,
          updatedAt = '${now}'
      WHERE id = '${vendorId}';
    `);
  }

  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

export function updateVendorCategoryTags(vendorId: string, tags: string[], categorySub?: string): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance || !vendorId) return false;
  ensureDatabaseIntegrity(dbInstance);
  const now = new Date().toISOString();
  const cleanTags = Array.from(new Set(tags.map(s => s.trim()).filter(Boolean)));
  const tagsJson = JSON.stringify(cleanTags);
  const primaryCat = cleanTags[0] || null;
  const subClause = categorySub !== undefined
    ? `, categorySub = '${categorySub.trim().replace(/'/g, "''")}', serviceCategorySub = '${categorySub.trim().replace(/'/g, "''")}'`
    : '';

  dbInstance.run(`
    UPDATE business_partners 
    SET categoryTags = '${tagsJson.replace(/'/g, "''")}',
        categoryMain = ${primaryCat ? `'${primaryCat.replace(/'/g, "''")}'` : 'NULL'},
        serviceCategoryMain = ${primaryCat ? `'${primaryCat.replace(/'/g, "''")}'` : 'NULL'},
        updatedAt = '${now}'
        ${subClause}
    WHERE id = '${vendorId}';
  `);

  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

export function updateVendorCategorySub(vendorId: string, categorySub: string): boolean {
  const dbInstance = getDbInstance();
  if (!dbInstance || !vendorId) return false;
  ensureDatabaseIntegrity(dbInstance);
  const now = new Date().toISOString();
  const cleanSub = categorySub.trim();

  dbInstance.run(`
    UPDATE business_partners 
    SET categorySub = '${cleanSub.replace(/'/g, "''")}',
        serviceCategorySub = '${cleanSub.replace(/'/g, "''")}',
        updatedAt = '${now}'
    WHERE id = '${vendorId}';
  `);

  saveDatabaseSnapshot();
  notifyListeners();
  return true;
}

export function renameSubcontractorCategory(oldCategoryName: string, newCategoryName: string, operatorName = '系統管理員'): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) return;
  ensureDatabaseIntegrity(dbInstance);
  const now = new Date().toISOString();
  const oldClean = oldCategoryName.trim();
  const newClean = newCategoryName.trim();
  if (!oldClean || !newClean || oldClean === newClean) return;

  dbInstance.run(`
    UPDATE business_partners 
    SET categoryMain = '${newClean.replace(/'/g, "''")}',
        serviceCategoryMain = '${newClean.replace(/'/g, "''")}',
        updatedAt = '${now}'
    WHERE categoryMain = '${oldClean.replace(/'/g, "''")}' OR serviceCategoryMain = '${oldClean.replace(/'/g, "''")}';
  `);

  const tree = getSubcontractorCategoryTree();
  const updatedTree = tree.map(c => c.category === oldClean ? { ...c, category: newClean } : c);
  saveSubcontractorCategoryTree(updatedTree, operatorName);
}

export function addVendorToSubcontractorCategory(categoryName: string, _vendorName: string, operatorName = '系統管理員'): SubcontractorCategoryGroup[] {
  const tree = getSubcontractorCategoryTree();
  const cat = tree.find(c => c.category === categoryName);
  if (!cat) {
    tree.push({
      id: `CAT-${Date.now().toString().slice(-6)}`,
      category: categoryName.trim() || '其他協力',
      vendors: []
    });
    saveSubcontractorCategoryTree(tree, operatorName);
  }
  return getSubcontractorCategoryTree();
}
