import {
  getDatabase,
  resetToSeedData,
  exportSqlDump,
  exportSqliteBinary,
  importSql,
  exportModularBackup,
  restoreModularBackup,
  getDatabaseModuleStats,
  createAnnualArchiveSnapshot,
  getAnnualArchiveSnapshots,
  executeCustomQuery,
  reseedDocumentSequences
} from '../src/db/sqlite';
import type { ModularBackupPackage } from '../src/types/erp';

async function runTests() {
  console.log('🚀 開始執行資料庫備份與還原功能完整自動化測試...');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`, detail || '');
      failed++;
    }
  }

  // 1. 初始化資料庫
  const db = await getDatabase();
  resetToSeedData();
  assert(db !== null, 'SQLite 實例初始化與種子資料重設');

  // 2. 測試模組統計
  const stats = getDatabaseModuleStats();
  assert(stats.length > 0, '取得模組資料統計', `模組數: ${stats.length}`);
  const totalRecs = stats.reduce((sum, s) => sum + s.totalRecords, 0);
  assert(totalRecs > 0, '初始測試資料總筆數大於 0', `總筆數: ${totalRecs}`);

  // 3. 測試二進位備份 (Ghost .sqlite)
  const binary = exportSqliteBinary();
  assert(binary instanceof Uint8Array && binary.length > 0, '匯出 .sqlite 二進位備份檔案', `檔案大小: ${binary.length} bytes`);

  // 驗證二進位 SQLite Header ("SQLite format 3")
  const headerStr = String.fromCharCode(...binary.slice(0, 16));
  assert(headerStr.startsWith('SQLite format 3'), '二進位檔頭符合 SQLite 3 格式規範');

  // 4. 測試 SQL Dump 匯出
  const sqlDump = exportSqlDump();
  assert(sqlDump.length > 0, '匯出完整 SQL 指令稿', `SQL 字元數: ${sqlDump.length}`);
  assert(sqlDump.includes('CREATE TABLE') && sqlDump.includes('INSERT INTO'), 'SQL 指令稿包含 DDL 與 INSERT 語法');

  // 5. 測試 SQL 還原
  // 先修改一筆資料，然後用 SQL Dump 還原
  db.run("UPDATE system_configs SET configValue = '999.0' WHERE configKey = 'TAX_RATE';");
  const checkUpdated = db.exec("SELECT configValue FROM system_configs WHERE configKey = 'TAX_RATE';");
  assert(checkUpdated[0].values[0][0] === '999.0', '測試環境修改 TAX_RATE 為 999.0');

  const importResult = importSql(sqlDump);
  assert(importResult.success === true, '執行 SQL 還原指令稿成功');
  const checkRestored = db.exec("SELECT configValue FROM system_configs WHERE configKey = 'TAX_RATE';");
  assert(checkRestored[0].values[0][0] === '0.05', 'SQL 還原後 TAX_RATE 正確復原為原始 0.05');

  // 6. 測試模組化勾選備份
  const selectedMods = ['COMPANIES', 'PROJECTS'];
  const modularPkg = exportModularBackup(selectedMods, 'TEST_RUNNER');
  assert(modularPkg.targetModules.length === 2, '模組化封裝包含選取之模組');
  assert(Array.isArray(modularPkg.tables['companies']) && modularPkg.tables['companies'].length > 0, '包含 companies 表資料');
  assert(Array.isArray(modularPkg.tables['projects']) && modularPkg.tables['projects'].length > 0, '包含 projects 表資料');
  assert(!modularPkg.tables['quotations'], '未勾選的 quotations 表不在打包中');

  // 7. 測試模組還原 - 冪等略過重複 (SKIP 策略)
  const countBefore = (db.exec("SELECT COUNT(*) FROM projects;")[0].values[0][0] as number);
  const skipRestoreResult = restoreModularBackup(modularPkg, 'SKIP');
  assert(skipRestoreResult.success === true, '以 SKIP 策略執行模組還原');
  assert(skipRestoreResult.skippedCount > 0, '既有資料被正確識別並略過 (不重複寫入)', `略過筆數: ${skipRestoreResult.skippedCount}`);
  assert(skipRestoreResult.insertedCount === 0, '沒有重複插入既有資料');
  const countAfter = (db.exec("SELECT COUNT(*) FROM projects;")[0].values[0][0] as number);
  assert(countBefore === countAfter, '還原後總筆數維持不變 (防止資料膨脹)');

  // 8. 測試模組還原 - 覆蓋更新 (UPDATE 策略)
  // 修改打包中的一筆專案名稱
  const modifiedPkg: ModularBackupPackage = JSON.parse(JSON.stringify(modularPkg));
  const prj = modifiedPkg.tables['projects'][0];
  prj.name = '【還原測試】南港經貿旗艦總部新建工程';
  prj.version = 2; // 版本遞增

  const updateRestoreResult = restoreModularBackup(modifiedPkg, 'UPDATE');
  assert(updateRestoreResult.success === true, '以 UPDATE 策略執行模組還原');
  assert(updateRestoreResult.updatedCount > 0, '更新筆數大於 0', `更新筆數: ${updateRestoreResult.updatedCount}`);
  const verifyName = db.exec(`SELECT name FROM projects WHERE id = '${prj.id}';`)[0].values[0][0];
  assert(verifyName === '【還原測試】南港經貿旗艦總部新建工程', '資料庫內容成功被覆蓋更新');

  // 9. 測試模組還原 - 全新資料插入
  const newProjectPkg: ModularBackupPackage = {
    formatVersion: '1.0',
    exportDate: new Date().toISOString(),
    exportedBy: 'TEST_INSERT',
    targetModules: ['PROJECTS'],
    tables: {
      projects: [{
        id: 'PRJ-TEST-NEW-01',
        projectCode: 'PRJ-2026-999',
        name: '全新自動化測試案場',
        ownerName: '測試業主',
        ownerTaxId: '99998888',
        contractAmount: 50000000,
        budgetAmount: 40000000,
        committedCost: 0,
        actualCost: 0,
        startDate: '2026-05-01',
        endDate: '2027-05-01',
        status: 'ACTIVE',
        isLocked: 0,
        companyId: 'COMP-01',
        isDeleted: 0,
        version: 1,
        createdAt: '2026-05-01',
        updatedAt: '2026-05-01'
      }]
    },
    recordCount: 1
  };
  const insertRestoreResult = restoreModularBackup(newProjectPkg, 'SKIP');
  assert(insertRestoreResult.success === true, '全新專案資料還原成功');
  assert(insertRestoreResult.insertedCount === 1, '新增筆數為 1');
  const verifyNewPrj = db.exec("SELECT name FROM projects WHERE id = 'PRJ-TEST-NEW-01';")[0].values[0][0];
  assert(verifyNewPrj === '全新自動化測試案場', '資料庫已成功寫入新專案');

  // 10. 測試年度封存快照
  const archiveResult = createAnnualArchiveSnapshot(2025, '2025 年度營造工程完工封存測試');
  assert(archiveResult.success === true, '建立 2025 年度封存快照成功');
  const archives = getAnnualArchiveSnapshots();
  assert(archives.some(a => a.archiveYear === 2025), '封存快照清單包含 2025 年度記錄');

  // 重複建立同年度封存測試 (應防呆拒絕或覆蓋)
  const dupArchiveResult = createAnnualArchiveSnapshot(2025, '重複封存測試');
  assert(dupArchiveResult.success === false, '重複建立同年度封存快照時正確防呆擋下');

  // 11. 測試萬能 SQL 檢視器
  const queryRes = executeCustomQuery('SELECT COUNT(*) AS total FROM business_partners;');
  assert(queryRes.length > 0 && queryRes[0].values[0][0] > 0, '執行自訂查詢語法成功');

  // 12. 測試時段過濾模組化備份 (YEAR 與 RANGE 模式)
  const pkg2026 = exportModularBackup(['PURCHASE_ORDERS'], { mode: 'YEAR', year: 2026 });
  assert(pkg2026.tables['purchase_orders'].length > 0, '2026 年度包含採購單');
  const pkg2020 = exportModularBackup(['PURCHASE_ORDERS'], { mode: 'YEAR', year: 2020 });
  assert(pkg2020.tables['purchase_orders'].length === 0, '2020 年度無採購單，過濾條件正確排除');

  const pkgRange = exportModularBackup(['PURCHASE_ORDERS'], {
    mode: 'RANGE',
    startDate: '2026-03-01',
    endDate: '2026-03-31'
  });
  assert(pkgRange.tables['purchase_orders'].length === 2, '2026年3月份範圍過濾精確命中 2 筆採購單 (PO-01 & PO-02)');

  // 13. 測試業務唯一鍵 (Business Key) 防重複略過檢核
  // 模擬同一筆採購單，即使被指派了不同隨機 ID，依據 poNumber 判定為同一筆業務單據，SKIP 策略下略過不重複插入
  const dupBusinessKeyPkg: ModularBackupPackage = {
    formatVersion: '1.0',
    exportDate: new Date().toISOString(),
    exportedBy: 'TEST_BIZ_DUP',
    targetModules: ['PURCHASE_ORDERS'],
    tables: {
      purchase_orders: [{
        id: 'PO-RANDOM-NEW-ID-999',
        poNumber: 'PO-202603-0001', // 與既有 PO-01 相同之業務採購單號
        companyId: 'COMP-01',
        projectId: 'PRJ-01',
        vendorId: 'BP-03',
        currency: 'TWD',
        netAmount: 9600000,
        taxAmount: 480000,
        totalAmount: 10080000,
        status: 'POSTED',
        version: 1,
        createdAt: '2026-03-01'
      }]
    },
    recordCount: 1
  };
  const countPOBefore = (db.exec("SELECT COUNT(*) FROM purchase_orders;")[0].values[0][0] as number);
  const dupRestoreResult = restoreModularBackup(dupBusinessKeyPkg, 'SKIP');
  assert(dupRestoreResult.success === true, '業務單號重複資料檢核執行成功');
  assert(dupRestoreResult.skippedCount === 1, '依據業務唯一鍵 (poNumber) 成功識別並略過重複，未重複寫入');
  const countPOAfter = (db.exec("SELECT COUNT(*) FROM purchase_orders;")[0].values[0][0] as number);
  assert(countPOBefore === countPOAfter, '資料庫筆數維持不變，防重複寫入機制健全生效');

  // 14. 測試單據流水號自癒校準 (Sequence Reseed)
  // 匯入一張號碼高達 88 的採購單，還原後流水號應自動調高至 88 以上，避免未來開單衝號
  const highSeqPkg: ModularBackupPackage = {
    formatVersion: '1.0',
    exportDate: new Date().toISOString(),
    exportedBy: 'TEST_SEQ',
    targetModules: ['PURCHASE_ORDERS'],
    tables: {
      purchase_orders: [{
        id: 'PO-TEST-HIGH-SEQ-88',
        poNumber: 'PO-202603-0088',
        companyId: 'COMP-01',
        projectId: 'PRJ-01',
        vendorId: 'BP-03',
        totalAmount: 1000,
        status: 'DRAFT',
        version: 1,
        createdAt: '2026-03-10'
      }]
    },
    recordCount: 1
  };
  restoreModularBackup(highSeqPkg, 'SKIP');
  const seqRes = db.exec("SELECT currentVal FROM document_sequences WHERE prefix = 'PO-202603';");
  assert(seqRes.length > 0 && Number(seqRes[0].values[0][0]) >= 88, '流水號計數器自動校準調高至 >= 88，防跳號衝碼');

  console.log(`\n========================================`);
  console.log(`測試結果總結: 通過 ${passed} 項, 失敗 ${failed} 項`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('測試執行異常:', err);
  process.exit(1);
});
