// SQLite 資料庫聚合入口（M09 模組化拆分後的統一向後相容 Barrel Facade）
import type { CashFlowMetrics } from '../types/erp';
import { getAllAccountsPayable } from './repositories/apReconciliationRepository';
import { getAllAccountsReceivable } from './repositories/arRepository';
import { getAllBankChecks } from './repositories/paymentAndCheckRepository';

export * from './core/dbContext';
export * from './core/dbConstants';
export * from './core/schemaCore';
export * from './core/schemaOperations';
export * from './core/dbIntegrity';
export * from './core/dbIntegrityUsersAndFinance';
export * from './core/dbSeed';
export * from './core/dbInit';

export * from './repositories/auditRepository';
export * from './repositories/postalCatalogRepository';
export * from './repositories/companyRepository';
export * from './repositories/sequenceRepository';
export * from './repositories/configAndRegulationRepository';
export * from './repositories/projectCatalogRepository';
export * from './repositories/projectRepository';
export * from './repositories/partnerRepository';
export * from './repositories/partnerSubRecordsRepository';
export * from './repositories/inboundRepository';
export * from './repositories/quotationAndPoRepository';
export * from './repositories/invoiceAndTaxRepository';
export * from './repositories/apReconciliationRepository';
export * from './repositories/paymentAndCheckRepository';
export * from './repositories/arRepository';
export * from './repositories/treasuryPoolRepository';
export * from './repositories/rbacGroupRepository';
export * from './repositories/rbacUserRepository';
export * from './repositories/rbacUserLifecycleRepository';
export * from './repositories/archiveAndBackupRepository';
export * from './repositories/vaultRepository';

// 取得營運戰情室財務指標 (憲法第六篇)
export function getCashFlowMetrics(): CashFlowMetrics {
  const checks = getAllBankChecks();
  const arList = getAllAccountsReceivable();
  const apList = getAllAccountsPayable();

  // 現有銀行結存 (模擬基礎水池)
  const currentBankBalance = 38500000;

  // 預計未收 AR
  const projectedAR = arList
    .filter(ar => ar.status === 'OPEN' || ar.status === 'PARTIAL')
    .reduce((sum, ar) => sum + ar.remainingAmount, 0);

  // 預計未付 AP
  const projectedAP = apList
    .filter(ap => ap.status === 'OPEN' || ap.status === 'PARTIAL')
    .reduce((sum, ap) => sum + ap.remainingAmount, 0);

  // 未兌現應付支票 (ISSUED)
  const unclearedChecks = checks
    .filter(c => c.type === 'PAYABLE' && c.status === 'ISSUED')
    .reduce((sum, c) => sum + c.amount, 0);

  // 預估營業稅 (粗估 5% 銷項 - 進項)
  const estimatedVAT = Math.max(0, (projectedAR - projectedAP) * 0.05);

  // 常態固定費用 (薪資、水電、辦公室租金)
  const recurringExpenses = 2800000;

  // 真實可用資金預測 = 銀行餘額 + 預計應收 - 預計應付 - 未兌票據 - 營業稅 - 固定支出
  const projectedNetCash = currentBankBalance + projectedAR - projectedAP - unclearedChecks - estimatedVAT - recurringExpenses;

  // 待補簽追加減工程風險 (Pending CO)
  const pendingChangeOrdersAmount = 8500000;

  return {
    currentBankBalance,
    projectedAR,
    projectedAP,
    unclearedChecks,
    estimatedVAT,
    recurringExpenses,
    projectedNetCash,
    pendingChangeOrdersAmount
  };
}
