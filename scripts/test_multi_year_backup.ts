import {
  getDatabase,
  resetToSeedData,
  exportSqlDump,
  exportSqliteBinary,
  exportModularBackup,
  restoreModularBackup,
  createAnnualArchiveSnapshot,
  getAnnualArchiveSnapshots,
  reseedDocumentSequences,
  getNextSequenceNumber,
  updateDocumentSequence,
  getAllDocumentSequences
} from '../src/db/sqlite';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

async function runMultiYearTest() {
  console.log('============================================================');
  console.log('🧪 開始執行 2010 ~ 2026 多年份資料庫寫入、備份與歸檔封存實測');
  console.log('============================================================');

  // 1. 初始化資料庫
  const db = await getDatabase();
  resetToSeedData();
  console.log('資料庫初始化與重設完成');

  // 2. 準備年份：2010 ~ 2026 (共 17 年)
  const years: number[] = [];
  for (let y = 2010; y <= 2026; y++) {
    years.push(y);
  }

  console.log(`\n--- 階段 1: 寫入 2010 ~ 2026 年歷史業務資料 (每年 2~3 筆，分散與集中測試) ---`);

  // 測試分散月份 vs 集中月份模式
  // 偶數年：分散月份 (如 02月, 07月, 11月)
  // 奇數年：集中月份 (如 09月 集中 3 筆不同日期)
  let totalInjectedPOs = 0;
  let totalInjectedAPs = 0;

  for (const year of years) {
    const isClustered = year % 2 === 1; // 奇數年集中，偶數年分散
    const dates: string[] = isClustered
      ? [`${year}-09-05`, `${year}-09-12`, `${year}-09-28`] // 集中在 9 月
      : [`${year}-03-15`, `${year}-07-20`, `${year}-11-08`]; // 分散在 3, 7, 11 月

    for (let idx = 0; idx < dates.length; idx++) {
      const dateStr = dates[idx];
      const monthStr = dateStr.substring(5, 7);
      const prefix = `AP-${year}${monthStr}`;
      
      // 取得資料庫中該前綴既有最大序號，以確保往後跳號不衝突
      const existingRes = db.exec(`SELECT apNumber FROM accounts_payable WHERE apNumber LIKE '${prefix}-%';`);
      let maxExistingNum = 0;
      if (existingRes.length && existingRes[0].values.length) {
        for (const row of existingRes[0].values) {
          const parts = String(row[0]).split('-');
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > maxExistingNum) maxExistingNum = num;
        }
      }

      const seqVal = maxExistingNum + idx + 1;
      const seqStr = String(seqVal).padStart(3, '0');
      const poNum = `PO-${year}-${String(idx + 1).padStart(3, '0')}`;
      const apNum = `${prefix}-${seqStr}`;
      const poId = `TEST-PO-${year}-${idx + 1}`;
      const apId = `TEST-AP-${year}-${idx + 1}`;
      const amount = 100000 + (year - 2010) * 10000 + (idx + 1) * 5000;

      // 插入採購單 purchase_orders
      db.run(`
        INSERT INTO purchase_orders (
          id, poNumber, companyId, projectId, vendorId, currency,
          netAmount, taxAmount, totalAmount, discountAmount, retentionDeductionAmount,
          postedTaxRate, counterpartyNameSnapshot, counterpartyTaxIdSnapshot,
          projectNameSnapshot, status, isDeleted, version, createdAt, updatedAt
        ) VALUES (
          '${poId}', '${poNum}', 'COMP-01', 'PRJ-01', 'BP-03', 'TWD',
          ${amount}, ${Math.round(amount * 0.05)}, ${Math.round(amount * 1.05)}, 0, 0,
          0.05, '歷史測試水泥供應商', '11223344',
          '歷史測試案場', 'APPROVED', 0, 1, '${dateStr} 10:00:00', '${dateStr} 10:00:00'
        );
      `);
      totalInjectedPOs++;

      // 插入應付帳款 accounts_payable
      db.run(`
        INSERT INTO accounts_payable (
          id, apNumber, sourceTable, sourceId, companyId, vendorId,
          vendorName, originalAmount, appliedAmount, remainingAmount,
          dueDate, invoiceNumber, taxReportingCompanyId, status, createdAt
        ) VALUES (
          '${apId}', '${apNum}', 'PURCHASE_ORDER', '${poId}', 'COMP-01', 'BP-03',
          '歷史測試水泥供應商', ${Math.round(amount * 1.05)}, ${Math.round(amount * 1.05)}, 0,
          '${dateStr}', 'INV-${year}-${seqStr}', 'COMP-01', 'PAID', '${dateStr} 10:00:00'
        );
      `);
      totalInjectedAPs++;
    }
  }

  console.log(`寫入完成！總共跨 17 年寫入 ${totalInjectedPOs} 筆採購單、${totalInjectedAPs} 筆應付帳款。`);

  // 驗證寫入筆數
  const poCountRes = db.exec(`SELECT COUNT(*) FROM purchase_orders WHERE id LIKE 'TEST-PO-%';`);
  assert(Number(poCountRes[0].values[0][0]) === totalInjectedPOs, `成功寫入 ${totalInjectedPOs} 筆測試採購單`);

  const apCountRes = db.exec(`SELECT COUNT(*) FROM accounts_payable WHERE id LIKE 'TEST-AP-%';`);
  assert(Number(apCountRes[0].values[0][0]) === totalInjectedAPs, `成功寫入 ${totalInjectedAPs} 筆測試應付帳款`);

  console.log(`\n--- 階段 2: 測試 2010 ~ 2026 年度唯讀封存快照引擎 (Annual Archival Snapshots) ---`);
  // 針對 2010, 2015, 2020, 2025 建立年度封存快照
  const testArchiveYears = [2010, 2015, 2020, 2025];
  for (const yr of testArchiveYears) {
    const res = createAnnualArchiveSnapshot(yr, `${yr} 年度工程測試封存快照`);
    assert(res.success === true, `建立 ${yr} 年度封存快照成功 (紀錄數: ${res.snapshot?.recordCount}, 雜湊: ${res.snapshot?.fileHash?.substring(0, 15)}...)`);
  }

  // 驗證重複封存防呆阻擋
  const duplicateRes = createAnnualArchiveSnapshot(2010, `重複建立 2010`);
  assert(duplicateRes.success === false, `重複建立已封存的 2010 快照被成功阻擋`);

  // 查詢所有已封存快照清冊
  const allSnapshots = getAnnualArchiveSnapshots();
  assert(allSnapshots.length >= 4, `成功取得 ${allSnapshots.length} 筆已封存年度快照清單`);
  console.log('已封存快照清單:', allSnapshots.map(s => ({ 年度: s.archiveYear, 檔名: s.archiveFileName, 筆數: s.recordCount })));

  console.log(`\n--- 階段 3: 測試時段範圍與特定年度之模組化備份 (Modular Time-Filter Backup) ---`);
  // A. 匯出 2015 單一年度之財務與採購模組
  const pkg2015 = exportModularBackup(['PURCHASE', 'FINANCE'], {
    mode: 'YEAR',
    year: 2015
  });
  console.log(`2015 年度匯出包含模組:`, pkg2015.targetModules);
  const pos2015 = pkg2015.tables['purchase_orders'] || [];
  console.log(`2015 年度採購單筆數: ${pos2015.length} 筆`);
  assert(pos2015.length === 3, '2015 年度採購單過濾正確為 3 筆');
  assert(pos2015.every(p => String(p.createdAt).startsWith('2015')), '2015 年度採購單資料日期完全符合 2015');

  // B. 匯出 2012 ~ 2018 跨年區間備份
  const pkgRange = exportModularBackup(['PURCHASE', 'FINANCE'], {
    mode: 'RANGE',
    startDate: '2012-01-01',
    endDate: '2018-12-31'
  });
  const posRange = pkgRange.tables['purchase_orders'] || [];
  // 2012 到 2018 共 7 個年份，每年 3 筆 = 21 筆
  console.log(`2012-2018 區間採購單筆數: ${posRange.length} 筆`);
  assert(posRange.length === 21, '2012-2018 跨 7 年區間採購單總筆數為 21 筆');

  console.log(`\n--- 階段 4: 測試單據流水號防回溯鐵律與防重號自動自癒 ---`);
  // 自動校準流水號
  reseedDocumentSequences(db);
  const sequences = getAllDocumentSequences();
  console.log('當前資料庫流水號計數器清單 (前 5 筆):', sequences.slice(0, 5));

  // 測試問題 1：驗證如果 AP-202603-001 與 AP-202603-002 已存在
  const ap2026Res = db.exec(`SELECT apNumber FROM accounts_payable WHERE apNumber LIKE 'AP-202603%';`);
  console.log('現有 AP-202603 單據:', ap2026Res[0]?.values.map(v => v[0]));

  // 驗證 1：嘗試往前回溯設為 1，必須被防重號鐵律阻擋拋出例外
  // 驗證 1：嘗試將下一個單號回溯設為 1，必須被防重號鐵律阻擋拋出例外
  let rollbackBlocked = false;
  try {
    updateDocumentSequence('AP-202603', 1);
  } catch (err: any) {
    rollbackBlocked = true;
    console.log('回溯設為 1 成功被阻擋，訊息:', err.message);
  }
  assert(rollbackBlocked === true, '嚴格阻擋將 AP-202603 下一個號碼回溯修改為已使用的 1 號');

  // 驗證 2：校正下一個流水號為 9
  const { updateNextSequenceNumber, autoCalibrateSequence, autoCalibrateAllSequences } = await import('../src/db/sqlite');
  updateNextSequenceNumber('AP-202603', 9);
  const nextApNum = getNextSequenceNumber('AP-202603');
  assert(nextApNum === 'AP-202603-009', `校正下一個號為 9 後，下一筆開立單號精準為 AP-202603-009 (實際: ${nextApNum})`);

  // 將 AP-202603-009 實體寫入資料庫
  db.run(`INSERT INTO accounts_payable (id, apNumber, sourceTable, sourceId, companyId, vendorId, vendorName, originalAmount, appliedAmount, remainingAmount, dueDate, status, createdAt)
    VALUES ('TEST-AP-999', 'AP-202603-009', 'MANUAL', 'M9', 'COMP-01', 'BP-01', '測試廠商', 100, 100, 0, '2026-03-31', 'PAID', '2026-03-31');`);

  // 驗證 3：既然資料庫實體已存在 009，若這時候回頭想校正成 005 會發生什麼情況？
  let backTo005Blocked = false;
  try {
    updateNextSequenceNumber('AP-202603', 5);
  } catch (err: any) {
    backTo005Blocked = true;
    console.log('回溯設為 5 成功被阻擋，訊息:', err.message);
  }
  assert(backTo005Blocked === true, '實體存在 009 後，嚴格阻擋回頭校正為 005，防止後續開到 009 時發生重複衝突');

  // 驗證 4：如果資料庫實體存在間隔斷號（如 009 已存在，但人工手動設定計數器從 008 開始開立）
  // 當 008 產生後，下一筆會不會跟已存在的 009 撞號？
  // 模擬內部計數器回到 8 (下一筆候選 9)
  db.run(`UPDATE document_sequences SET currentVal = 8 WHERE prefix = 'AP-202603';`);
  const autoSkippedNextNum = getNextSequenceNumber('AP-202603');
  console.log('探測到 009 已存在，產號引擎自動跳空躍升至:', autoSkippedNextNum);
  assert(autoSkippedNextNum === 'AP-202603-010', '產號引擎偵測到 009 已存在，自動跳過 009 躍升開出 010，100% 杜絕碰撞');

  // 驗證 5：自動校正功能
  const calibratedNext = autoCalibrateSequence('AP-202603');
  assert(calibratedNext === 10, `單項自動校正將下一個單號正確校準至現存最大號+1 (即 10 號)`);

  autoCalibrateAllSequences();
  console.log('全系統跳號自動校準完成');

  console.log(`\n--- 階段 5: 測試法規預約生效排程自動切換 (Scheduled Regulations Zero-Touch) ---`);
  const {
    getRegulatorySchedules,
    createRegulatorySchedule,
    applyDueRegulatorySchedules,
    getAllSystemConfigs
  } = await import('../src/db/sqlite');

  // 取得目前最低基本工資
  const cfgsBefore = getAllSystemConfigs();
  const minWageBefore = cfgsBefore.find(c => c.configKey === 'MINIMUM_WAGE')?.configValue;
  console.log(`目前最低工資設定值: ${minWageBefore}`);
  assert(minWageBefore === '28590', '初始最低月薪基本工資為 28,590 元');

  // 建立一筆已到期的排程 (生效日期設為昨日或今日)
  const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
  createRegulatorySchedule({
    configKey: 'MINIMUM_WAGE',
    configLabel: '法定最低月薪基本工資',
    scheduledValue: '30000',
    effectiveDate: `${yesterday} 00:00:00`,
    notes: '測試排程到期自動生效'
  });

  // 驗證排程已於登記或到期時自動觸發切換
  const scheds = getRegulatorySchedules();
  const appliedSched = scheds.find(s => s.scheduledValue === '30000');
  assert(appliedSched?.status === 'APPLIED', '排程已成功自動切換為 APPLIED');

  const cfgsAfter = getAllSystemConfigs();
  const minWageAfter = cfgsAfter.find(c => c.configKey === 'MINIMUM_WAGE')?.configValue;
  console.log(`自動套用後最低工資新值: ${minWageAfter}`);
  assert(minWageAfter === '30000', '最低工資已零接觸自動更新為預定新值 30,000 元');

  console.log('\n============================================================');
  console.log('🎉 2010 ~ 2026 多年份寫入、封存、防回溯與法規排程測試全部 100% 通過！');
  console.log('============================================================');
}

runMultiYearTest().catch(err => {
  console.error('測試失敗:', err);
  process.exit(1);
});
