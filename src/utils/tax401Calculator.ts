// src/utils/tax401Calculator.ts
// 401 營業稅雙月期別試算引擎、分類中繼資料與跨期留抵結轉運算

import {
  CompanyTaxSetting,
  Invoice,
  InvoiceCategory401,
  PlannedInvoice,
} from '../types/erp';

export const BI_MONTHLY_PERIODS = [
  { code: '01-02', label: '1.2月' },
  { code: '03-04', label: '3.4月' },
  { code: '05-06', label: '5.6月' },
  { code: '07-08', label: '7.8月' },
  { code: '09-10', label: '9.10月' },
  { code: '11-12', label: '11.12月' },
] as const;

export const CATEGORY_META: Record<
  InvoiceCategory401,
  {
    label: string;
    group: 'OUTPUT' | 'INPUT' | 'NON_401';
    sign: 1 | -1 | 0;
    defaultType: 'OUTPUT' | 'INPUT';
    exemptDefault?: boolean;
  }
> = {
  SALES_THREE_PART: { label: '銷貨發票-三聯式', group: 'OUTPUT', sign: 1, defaultType: 'OUTPUT' },
  SALES_TWO_PART: { label: '銷貨發票-二聯式', group: 'OUTPUT', sign: 1, defaultType: 'OUTPUT' },
  SALES_ALLOWANCE: { label: '銷貨折讓明細 (-)', group: 'OUTPUT', sign: -1, defaultType: 'OUTPUT' },
  PURCHASE_GOODS: { label: '進貨發票明細', group: 'INPUT', sign: 1, defaultType: 'INPUT' },
  FUEL_EXPENSE: { label: '油單+三聯單發票', group: 'INPUT', sign: 1, defaultType: 'INPUT' },
  TELECOM_EXPENSE: { label: '電話費明細', group: 'INPUT', sign: 1, defaultType: 'INPUT' },
  ELECTRICITY_EXPENSE: { label: '台灣電力公司電費', group: 'INPUT', sign: 1, defaultType: 'INPUT' },
  OTHER_EXPENSE_INV: { label: '費用發票明細', group: 'INPUT', sign: 1, defaultType: 'INPUT' },
  FIXED_ASSET: { label: '固定資產費用', group: 'INPUT', sign: 1, defaultType: 'INPUT' },
  PURCHASE_RETURN: { label: '進貨退出明細 (-)', group: 'INPUT', sign: -1, defaultType: 'INPUT' },
  PURCHASE_ALLOWANCE: { label: '進貨折讓明細 (-)', group: 'INPUT', sign: -1, defaultType: 'INPUT' },
  NON_DEDUCTIBLE_INV: { label: '不列入401申報發票', group: 'NON_401', sign: 0, defaultType: 'INPUT' },
  RECEIPT_EXEMPT: { label: '收據明細 (郵資/免票)', group: 'NON_401', sign: 0, defaultType: 'INPUT', exemptDefault: true },
  PERSONAL_VOUCHER: { label: '個人憑證 (非公司帳)', group: 'NON_401', sign: 0, defaultType: 'INPUT', exemptDefault: true },
};

export interface Period401Metrics {
  periodKey: string;
  periodCode: string;
  label: string;
  // Realized
  outSalesNet: number;
  outTax: number; // Code 1
  inPurchaseNet: number;
  inTax: number; // Code 7
  non401Total: number;
  code8PriorCredit: number; // Code 8
  code10TotalDeductible: number; // Code 7 + Code 8
  code11NetPayable: number; // max(0, Code 1 - Code 10)
  code12AccumCredit: number; // max(0, Code 10 - Code 1)
  // Simulated (+ Planned)
  simOutSalesNet: number;
  simOutTax: number;
  inSimTax: number;
  simCode8PriorCredit: number;
  simCode10TotalDeductible: number;
  simCode11NetPayable: number;
  simCode12AccumCredit: number;
  plannedOutCount: number;
  plannedInCount: number;
}

export function derivePeriodFromDate(dateStr?: string): string {
  const clean = (dateStr || '').trim();
  const m = clean.match(/^(\d{4})-(\d{2})/);
  if (!m) {
    const now = new Date();
    const y = now.getFullYear();
    const mm = now.getMonth() + 1;
    const startM = mm % 2 === 1 ? mm : mm - 1;
    return `${y}-${String(startM).padStart(2, '0')}-${String(startM + 1).padStart(2, '0')}`;
  }
  const y = m[1];
  const month = Number(m[2]) || 1;
  const startM = month % 2 === 1 ? month : month - 1;
  return `${y}-${String(startM).padStart(2, '0')}-${String(startM + 1).padStart(2, '0')}`;
}

export function getNextBiMonthlyPeriod(period: string): string {
  const m = period.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return period;
  const year = Number(m[1]);
  const startM = Number(m[2]);
  if (startM >= 11) {
    return `${year + 1}-01-02`;
  }
  const nextStart = startM + 2;
  return `${year}-${String(nextStart).padStart(2, '0')}-${String(nextStart + 1).padStart(2, '0')}`;
}

export function resolveInvoiceCategory(inv: Invoice): InvoiceCategory401 {
  if (inv.invoiceCategory && CATEGORY_META[inv.invoiceCategory]) {
    return inv.invoiceCategory;
  }
  if (inv.invoiceType === 'OUTPUT') {
    return inv.invoiceFormat === 'TWO_PART' ? 'SALES_TWO_PART' : 'SALES_THREE_PART';
  }
  return 'PURCHASE_GOODS';
}

export function computeCompanyYearPeriods(params: {
  companyId: string;
  year: number;
  invoices: Invoice[];
  plannedInvoices: PlannedInvoice[];
  companyTaxSettings: CompanyTaxSetting[];
}): Period401Metrics[] {
  const { companyId, year, invoices, plannedInvoices, companyTaxSettings } = params;
  const setting = companyTaxSettings.find(s => s.companyId === companyId && s.taxYear === year);
  let runningRealizedCredit = Math.max(0, Number(setting?.priorYearCreditTax || 0));
  let runningSimCredit = runningRealizedCredit;

  const compInvs = invoices.filter(
    inv => inv.taxReportingCompanyId === companyId && inv.status !== 'VOIDED'
  );
  const compPlanned = plannedInvoices.filter(
    p => p.companyId === companyId && p.status === 'PLANNED'
  );

  return BI_MONTHLY_PERIODS.map(pm => {
    const periodKey = `${year}-${pm.code}`;
    const periodInvs = compInvs.filter(
      inv => (inv.taxPeriod || derivePeriodFromDate(inv.invoiceDate)) === periodKey
    );
    const periodPlanned = compPlanned.filter(p => p.taxPeriod === periodKey);

    let outSalesNet = 0;
    let outTax = 0;
    let inPurchaseNet = 0;
    let inTax = 0;
    let non401Total = 0;

    for (const inv of periodInvs) {
      const cat = resolveInvoiceCategory(inv);
      const meta = CATEGORY_META[cat];
      if (meta.group === 'OUTPUT') {
        outSalesNet += meta.sign * inv.netAmount;
        outTax += meta.sign * inv.taxAmount;
      } else if (meta.group === 'INPUT') {
        inPurchaseNet += meta.sign * inv.netAmount;
        inTax += meta.sign * inv.taxAmount;
      } else {
        non401Total += inv.totalAmount;
      }
    }

    const code8PriorCredit = runningRealizedCredit;
    const code10TotalDeductible = inTax + code8PriorCredit;
    const code11NetPayable = Math.max(0, outTax - code10TotalDeductible);
    const code12AccumCredit = Math.max(0, code10TotalDeductible - outTax);
    runningRealizedCredit = code12AccumCredit;

    let planOutNet = 0;
    let planOutTax = 0;
    let planInTax = 0;
    let plannedOutCount = 0;
    let plannedInCount = 0;

    for (const p of periodPlanned) {
      const meta = CATEGORY_META[p.invoiceCategory] || CATEGORY_META.SALES_THREE_PART;
      if (meta.group === 'OUTPUT') {
        planOutNet += meta.sign * p.netAmount;
        planOutTax += meta.sign * p.taxAmount;
        plannedOutCount++;
      } else if (meta.group === 'INPUT') {
        planInTax += meta.sign * p.taxAmount;
        plannedInCount++;
      }
    }

    const simOutSalesNet = outSalesNet + planOutNet;
    const simOutTax = outTax + planOutTax;
    const inSimTax = inTax + planInTax;
    const simCode8PriorCredit = runningSimCredit;
    const simCode10TotalDeductible = inSimTax + simCode8PriorCredit;
    const simCode11NetPayable = Math.max(0, simOutTax - simCode10TotalDeductible);
    const simCode12AccumCredit = Math.max(0, simCode10TotalDeductible - simOutTax);
    runningSimCredit = simCode12AccumCredit;

    return {
      periodKey,
      periodCode: pm.code,
      label: pm.label,
      outSalesNet,
      outTax,
      inPurchaseNet,
      inTax,
      non401Total,
      code8PriorCredit,
      code10TotalDeductible,
      code11NetPayable,
      code12AccumCredit,
      simOutSalesNet,
      simOutTax,
      inSimTax,
      simCode8PriorCredit,
      simCode10TotalDeductible,
      simCode11NetPayable,
      simCode12AccumCredit,
      plannedOutCount,
      plannedInCount,
    };
  });
}

export function calcTax401Preview(
  baseStr: string,
  mode: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT',
  taxRate: number,
  manualTaxStr?: string
) {
  const base = Math.max(0, Number(baseStr || 0));
  const autoTax =
    mode === 'TAX_EXEMPT'
      ? 0
      : mode === 'TAX_EXCLUSIVE'
      ? Math.round(base * taxRate)
      : Math.round(base - base / (1 + taxRate));
  const tax =
    mode === 'TAX_EXEMPT'
      ? 0
      : manualTaxStr && manualTaxStr.trim() !== ''
      ? Math.max(0, Number(manualTaxStr) || 0)
      : autoTax;
  const net =
    mode === 'TAX_EXEMPT'
      ? base
      : mode === 'TAX_EXCLUSIVE'
      ? base
      : Math.max(0, base - tax);
  const total =
    mode === 'TAX_EXEMPT'
      ? base
      : mode === 'TAX_EXCLUSIVE'
      ? base + tax
      : base;
  return { net, tax, autoTax, total };
}
