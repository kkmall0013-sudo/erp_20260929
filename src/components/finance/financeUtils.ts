// src/components/finance/financeUtils.ts
// 🧮 財務會計與出納模組共用純運算與資金規則防呆函式庫

import {
  AccountsPayableReconciliation,
  BankCheck,
  BusinessPartner,
  Company,
  CompanyBankAccount,
  InboundReceipt,
  Project,
  SuspenseReceipt,
} from '../../types/erp';

export interface VendorPoolGroup {
  vendorId: string;
  vendorName: string;
  vendorTaxId?: string;
  bankFeePayer: string;
  paymentTermsDays: number;
  paymentMethodNotes: string;
  receipts: InboundReceipt[];
  totalAmount: number;
}

export interface FinanceKpiMetrics {
  pendingInboundCount: number;
  pendingInboundTotal: number;
  pendingApCount: number;
  pendingApTotal: number;
  realBankBalance: number;
  bossBalance: number;
  unclearedChecksCount: number;
  unclearedChecksTotal: number;
  pendingSuspenseCount: number;
  pendingSuspenseTotal: number;
  projectedNetCash: number;
}

/** 本地 YYYY-MM-DD 格式化 (避免 UTC 時差造成日期減 1 天) */
export function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 解析每月付款排程日規則 (預設 7,17,27) */
export function parseScheduleDays(raw?: string): number[] {
  const parsed = Array.from(
    new Set(
      String(raw || '')
        .split(/[,，、\s]+/)
        .map(s => Number(s.trim()))
        .filter(n => Number.isInteger(n) && n >= 1 && n <= 31)
    )
  ).sort((a, b) => a - b);
  return parsed.length > 0 ? parsed : [7, 17, 27];
}

/** 推算指定年月偏移 (0=當月, 1=下月, 2=下下月) 的所有排程日期按鈕，跨年度自動顯示 YYYY/M/D */
export function getThreeMonthScheduleRows(days: number[]) {
  const validDays = days.length > 0 ? days : [7, 17, 27];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  return [0, 1, 2].map(offset => {
    const target = new Date(currentYear, currentMonth + offset, 1);
    const y = target.getFullYear();
    const mIndex = target.getMonth();
    const m = mIndex + 1;
    const lastDay = new Date(y, mIndex + 1, 0).getDate();
    const isCrossYear = y !== currentYear;

    const items = validDays.map(dayNum => {
      const clampedDay = Math.min(dayNum, lastDay);
      const ymd = `${y}-${String(m).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
      const label = isCrossYear ? `${y}/${m}/${clampedDay}` : `${m}/${clampedDay}`;
      return { dayNum: clampedDay, ymd, label };
    });

    return {
      offset,
      monthLabel: offset === 0 ? '當月' : offset === 1 ? '下月' : '下下月',
      yearMonthLabel: isCrossYear ? `${y}/${m}月` : `${m}月`,
      items,
    };
  });
}

/** 推算最近一次指定日 (本月尚未過則取本月該日，否則取次月該日；遇小月自動收斂為月底) */
export function computeUpcomingScheduleDate(dayOfMonth: number): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const clampDate = (year: number, monthIndex: number, day: number) => {
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return new Date(year, monthIndex, Math.min(day, lastDay));
  };
  const candidateThisMonth = clampDate(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (candidateThisMonth >= todayStart) {
    return formatLocalYmd(candidateThisMonth);
  }
  const candidateNextMonth = clampDate(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
  return formatLocalYmd(candidateNextMonth);
}

export function pickNearestScheduleDate(days: number[]): string {
  const valid = days.length > 0 ? days : [7, 17, 27];
  const candidates = valid.map(d => computeUpcomingScheduleDate(d)).sort();
  return candidates[0];
}

/** 推算天期到期日 (如 T+30, T+45, T+60) */
export function computeTermsPaymentDate(termsDays: number = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + termsDays);
  return formatLocalYmd(d);
}

/** 依優先序解析開票／付款排程日：銀行專戶專屬 > 法人公司設定 > 系統中樞全域設定 */
export function resolveScheduleInfo(
  bankAccounts: CompanyBankAccount[],
  companies: Company[],
  globalScheduleDaysStr: string,
  companyId?: string,
  bankAccountId?: string
): { days: number[]; sourceLabel: string } {
  const bank = bankAccountId ? bankAccounts.find(b => b.id === bankAccountId) : undefined;
  const comp = companyId ? companies.find(c => c.id === companyId) : undefined;
  if (bank?.paymentScheduleDays?.trim()) {
    const days = parseScheduleDays(bank.paymentScheduleDays);
    return { days, sourceLabel: `${bank.bankName} 專戶規則 (${days.join('/')})` };
  }
  if (comp?.paymentScheduleDays?.trim()) {
    const days = parseScheduleDays(comp.paymentScheduleDays);
    return { days, sourceLabel: `${comp.shortName || comp.name} 公司規則 (${days.join('/')})` };
  }
  const days = parseScheduleDays(globalScheduleDaysStr);
  return { days, sourceLabel: `系統中樞全域預設 (${days.join('/')})` };
}

/** 嚴格公司別與老闆私帳判定工具 (零跨公司外洩) */
export function isBossPrivateAccount(b: CompanyBankAccount): boolean {
  return Boolean(b.isVirtualAccount) || b.companyId === 'BOSS-01';
}

export function getEligibleBanks(
  bankAccounts: CompanyBankAccount[],
  companyId: string,
  allowBossPrivate: boolean
): CompanyBankAccount[] {
  const activeOwn = bankAccounts.filter(
    b =>
      b.status === 'ACTIVE' &&
      b.companyId === companyId &&
      (!b.isVirtualAccount || companyId === 'BOSS-01')
  );
  if (!allowBossPrivate) {
    return activeOwn;
  }
  const bossBanks = bankAccounts.filter(b => b.status === 'ACTIVE' && isBossPrivateAccount(b));
  const seen = new Set(activeOwn.map(b => b.id));
  return [...activeOwn, ...bossBanks.filter(b => !seen.has(b.id))];
}

export function getAllowedPaymentMethods(eligibleBanks: CompanyBankAccount[]) {
  return {
    canCheck: eligibleBanks.some(b => b.supportsCheck !== false),
    canTT: eligibleBanks.some(b => b.supportsTransfer !== false),
    canCash: true,
  };
}

export function filterBanksForMethod(
  eligibleBanks: CompanyBankAccount[],
  method: 'CHECK' | 'TT' | 'CASH'
): CompanyBankAccount[] {
  if (method === 'CASH') return [];
  if (method === 'CHECK') return eligibleBanks.filter(b => b.supportsCheck !== false);
  return eligibleBanks.filter(b => b.supportsTransfer !== false);
}

/**
 * 應收款收款銀行專戶嚴格防呆規則：
 * 1. 有開發票（交付業主）➔ 僅限開票法人自身之「非虛擬實體銀行戶」（或公司現金）；嚴禁老闆私帳、嚴禁其他公司帳戶
 * 2. 免開發票（或自主自留報稅）➔ 可進老闆私人戶 (BOSS-01 / 虛擬戶)、現金或該公司帳戶（嚴禁其他法人公司）
 */
export function getEligibleReceivingBanks(
  bankAccounts: CompanyBankAccount[],
  arCompanyId: string,
  hasInvoice: boolean,
  issueMode?: 'DELIVERED' | 'SELF_RETAINED'
): CompanyBankAccount[] {
  const ownRealBanks = bankAccounts.filter(
    b => b.status === 'ACTIVE' && b.companyId === arCompanyId && !isBossPrivateAccount(b)
  );
  if (hasInvoice && issueMode !== 'SELF_RETAINED') {
    return ownRealBanks;
  }
  const bossBanks = bankAccounts.filter(b => b.status === 'ACTIVE' && isBossPrivateAccount(b));
  const seen = new Set(bossBanks.map(b => b.id));
  return [...bossBanks, ...ownRealBanks.filter(b => !seen.has(b.id))];
}

/** 解析工程案場之承攬公司與業主資訊（支援未指定簽約公司案場） */
export function resolveProjectArContract(
  proj: Project | undefined,
  companies: Company[],
  partners: BusinessPartner[],
  authorizedCorps: Company[],
  financeCompanyScope: string,
  fallbackCompanyId?: string
) {
  if (!proj) {
    return {
      companyId: '',
      isCompanyLocked: false,
      company: undefined as Company | undefined,
      customerId: '',
      customerName: '',
      customerTaxId: '',
    };
  }
  const hasAssignedCompany = Boolean(proj.companyId && proj.companyId !== 'UNASSIGNED');
  const resolvedCompId = hasAssignedCompany
    ? proj.companyId
    : (fallbackCompanyId || (financeCompanyScope !== 'ALL' ? financeCompanyScope : authorizedCorps[0]?.id || 'COMP-01'));
  const company = companies.find(c => c.id === resolvedCompId);
  const matchedCust = partners.find(
    p =>
      (p.isCustomer || p.type === 'CUSTOMER' || p.type === 'BOTH') &&
      ((proj.ownerTaxId && p.taxId === proj.ownerTaxId) || (proj.ownerName && p.name === proj.ownerName))
  );
  const customerName = proj.ownerName || matchedCust?.name || '未建檔業主';
  const customerTaxId = proj.ownerTaxId || matchedCust?.taxId || '';
  const customerId = matchedCust?.id || `PROJ-OWNER-${proj.id}`;
  return {
    companyId: resolvedCompId,
    isCompanyLocked: hasAssignedCompany,
    company,
    customerId,
    customerName,
    customerTaxId,
  };
}

/** 計算頂部財務 KPI 與 90 天資金雷達水位 */
export function computeFinanceKpis(params: {
  inboundReceipts: InboundReceipt[];
  reconciliations: AccountsPayableReconciliation[];
  bankAccounts: CompanyBankAccount[];
  checks: BankCheck[];
  suspenses: SuspenseReceipt[];
  matchesCompanyScope: (compId?: string) => boolean;
}): FinanceKpiMetrics {
  const { inboundReceipts, reconciliations, bankAccounts, checks, suspenses, matchesCompanyScope } = params;

  const pendingReceipts = inboundReceipts.filter(
    r => r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED' && matchesCompanyScope(r.companyId)
  );
  const pendingInboundTotal = pendingReceipts.reduce((sum, r) => sum + r.totalAmount, 0);

  const approvedRecsScoped = reconciliations.filter(r => r.status === 'APPROVED' && matchesCompanyScope(r.companyId));
  const pendingApTotal = approvedRecsScoped.reduce((sum, r) => sum + r.netPayableAmount, 0);

  const realBankAccounts = bankAccounts.filter(
    b => !b.isVirtualAccount && b.status === 'ACTIVE' && matchesCompanyScope(b.companyId)
  );
  const realBankBalance = realBankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);

  const bossAccount = bankAccounts.find(b => b.isVirtualAccount);
  const bossBalance = bossAccount ? bossAccount.currentBalance : 0;

  const unclearedChecks = checks.filter(
    c => c.status === 'ISSUED' && c.type === 'PAYABLE' && matchesCompanyScope(c.companyId)
  );
  const unclearedChecksTotal = unclearedChecks.reduce((sum, c) => sum + c.amount, 0);

  const pendingSuspense = suspenses.filter(s => !s.isAllocated && matchesCompanyScope(s.companyId));
  const pendingSuspenseTotal = pendingSuspense.reduce((sum, s) => sum + s.amount, 0);

  const projectedNetCash = realBankBalance - pendingApTotal - unclearedChecksTotal;

  return {
    pendingInboundCount: pendingReceipts.length,
    pendingInboundTotal,
    pendingApCount: approvedRecsScoped.length,
    pendingApTotal,
    realBankBalance,
    bossBalance,
    unclearedChecksCount: unclearedChecks.length,
    unclearedChecksTotal,
    pendingSuspenseCount: pendingSuspense.length,
    pendingSuspenseTotal,
    projectedNetCash,
  };
}

/** 按廠商彙整待對帳進貨簽收單大水池 */
export function buildVendorPoolList(params: {
  inboundReceipts: InboundReceipt[];
  partners: BusinessPartner[];
  matchesCompanyScope: (compId?: string) => boolean;
}): VendorPoolGroup[] {
  const { inboundReceipts, partners, matchesCompanyScope } = params;
  const pendingReceipts = inboundReceipts.filter(
    r => r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED' && matchesCompanyScope(r.companyId)
  );
  const map: Record<string, VendorPoolGroup> = {};

  pendingReceipts.forEach(r => {
    if (!map[r.vendorId]) {
      const bp = partners.find(p => p.id === r.vendorId);
      map[r.vendorId] = {
        vendorId: r.vendorId,
        vendorName: r.vendorNameSnapshot || bp?.name || '未知廠商',
        vendorTaxId: r.vendorTaxIdSnapshot || bp?.taxId,
        bankFeePayer: bp?.bankFeePayer || 'COMPANY',
        paymentTermsDays: bp?.paymentTermsDays || 30,
        paymentMethodNotes: bp?.paymentMethodNotes || '',
        receipts: [],
        totalAmount: 0,
      };
    }
    map[r.vendorId].receipts.push(r);
    map[r.vendorId].totalAmount += r.totalAmount;
  });

  return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
}
