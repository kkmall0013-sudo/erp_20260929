// src/components/finance/Tax401WorkbookPanel.tsx
// 📊 各公司獨立 401 雙月營業稅試算活頁簿、預計請款模擬區 & 年度統整表

import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Settings,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Trash2,
  X,
  Building2,
  TrendingUp,
  AlertCircle,
  Ban,
} from 'lucide-react';
import {
  BusinessPartner,
  Company,
  CompanyTaxSetting,
  Invoice,
  InvoiceCategory401,
  InvoiceFormat,
  InvoiceIssueMode,
  PlannedInvoice,
  Project,
} from '../../types/erp';
import {
  convertPlannedInvoiceToOfficial,
  createInvoice,
  createPlannedInvoice,
  deletePlannedInvoice,
  saveCompanyTaxSetting,
  updatePlannedInvoice,
  voidInvoice,
} from '../../db/sqlite';

interface Tax401WorkbookPanelProps {
  companies: Company[];
  partners: BusinessPartner[];
  projects: Project[];
  invoices: Invoice[];
  plannedInvoices: PlannedInvoice[];
  companyTaxSettings: CompanyTaxSetting[];
  selectedCompanyId: string;
  onSelectCompanyId: (companyId: string) => void;
  canEdit: boolean;
  taxRate: number;
  operatorName: string;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onRefresh: () => void;
}

const BI_MONTHLY_PERIODS = [
  { code: '01-02', label: '1.2月' },
  { code: '03-04', label: '3.4月' },
  { code: '05-06', label: '5.6月' },
  { code: '07-08', label: '7.8月' },
  { code: '09-10', label: '9.10月' },
  { code: '11-12', label: '11.12月' },
] as const;

const CATEGORY_META: Record<
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

function derivePeriodFromDate(dateStr?: string): string {
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

function getNextBiMonthlyPeriod(period: string): string {
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

function resolveInvoiceCategory(inv: Invoice): InvoiceCategory401 {
  if (inv.invoiceCategory && CATEGORY_META[inv.invoiceCategory]) {
    return inv.invoiceCategory;
  }
  if (inv.invoiceType === 'OUTPUT') {
    return inv.invoiceFormat === 'TWO_PART' ? 'SALES_TWO_PART' : 'SALES_THREE_PART';
  }
  return 'PURCHASE_GOODS';
}

interface Period401Metrics {
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

export const Tax401WorkbookPanel: React.FC<Tax401WorkbookPanelProps> = ({
  companies,
  partners,
  projects,
  invoices,
  plannedInvoices,
  companyTaxSettings,
  selectedCompanyId,
  onSelectCompanyId,
  canEdit,
  taxRate,
  operatorName,
  onNotify,
  onRefresh,
}) => {
  const currentYear = new Date().getFullYear();
  const currentPeriodCode = derivePeriodFromDate(new Date().toISOString().slice(0, 10)).slice(5);

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [activeSheet, setActiveSheet] = useState<string>(currentPeriodCode); // '01-02'..'11-12' | 'ANNUAL'
  const [voucherGroupFilter, setVoucherGroupFilter] = useState<'ALL' | 'OUTPUT' | 'INPUT' | 'NON_401'>('ALL');

  // Quick Add Official Voucher Modal
  const [isAddVoucherOpen, setIsAddVoucherOpen] = useState(false);
  const [vCategory, setVCategory] = useState<InvoiceCategory401>('PURCHASE_GOODS');
  const [vFormat, setVFormat] = useState<InvoiceFormat>('THREE_PART');
  const [vIssueMode, setVIssueMode] = useState<InvoiceIssueMode>('DELIVERED');
  const [vNumber, setVNumber] = useState('');
  const [vDate, setVDate] = useState(new Date().toISOString().slice(0, 10));
  const [vPartnerId, setVPartnerId] = useState('');
  const [vPartnerName, setVPartnerName] = useState('');
  const [vPartnerTaxId, setVPartnerTaxId] = useState('');
  const [vProjectId, setVProjectId] = useState('');
  const [vTaxMode, setVTaxMode] = useState<'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT'>('TAX_EXCLUSIVE');
  const [vBaseAmt, setVBaseAmt] = useState('');
  const [vManualTax, setVManualTax] = useState('');
  const [vPresetLabel, setVPresetLabel] = useState('');
  const [vNotes, setVNotes] = useState('');

  // Quick Add Planned Forecast Modal / Inline Form
  const [isAddPlannedOpen, setIsAddPlannedOpen] = useState(false);
  const [pCompanyId, setPCompanyId] = useState<string>(selectedCompanyId);
  const [pCategory, setPCategory] = useState<InvoiceCategory401>('SALES_THREE_PART');
  const [pFormat, setPFormat] = useState<InvoiceFormat>('THREE_PART');
  const [pIssueMode, setPIssueMode] = useState<InvoiceIssueMode>('DELIVERED');
  const [pPartnerName, setPPartnerName] = useState('');
  const [pPartnerTaxId, setPPartnerTaxId] = useState('');
  const [pProjectId, setPProjectId] = useState('');
  const [pTaxMode, setPTaxMode] = useState<'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT'>('TAX_EXCLUSIVE');
  const [pBaseAmt, setPBaseAmt] = useState('');
  const [pNotes, setPNotes] = useState('');

  // Promote Planned -> Official Modal
  const [promotingPlanned, setPromotingPlanned] = useState<PlannedInvoice | null>(null);
  const [promoteInvNo, setPromoteInvNo] = useState('');
  const [promoteInvDate, setPromoteInvDate] = useState(new Date().toISOString().slice(0, 10));

  // Company Tax Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [setPriorCredit, setSetPriorCredit] = useState<string>('0');
  const [setPhonesText, setSetPhonesText] = useState<string>('');
  const [setElecText, setSetElecText] = useState<string>('');
  const [setPersonalLabel, setSetPersonalLabel] = useState<string>('');

  const taxRatePct = Number((taxRate * 100).toFixed(2));
  const activeCompany = companies.find(c => c.id === selectedCompanyId) || companies[0];

  const yearOptions = useMemo(() => {
    const years = new Set<number>([currentYear - 1, currentYear, currentYear + 1, 2025, 2026, 2027]);
    invoices.forEach(inv => {
      const y = Number((inv.taxPeriod || inv.invoiceDate || '').slice(0, 4));
      if (y >= 2020 && y <= 2035) years.add(y);
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [invoices, currentYear]);

  const getSettingFor = (compId: string, year: number): CompanyTaxSetting | undefined =>
    companyTaxSettings.find(s => s.companyId === compId && s.taxYear === year);

  const activeSetting = getSettingFor(selectedCompanyId, selectedYear);

  // Compute all 6 bi-monthly periods with automatic Code 8 cascade for any companyId
  const computeCompanyYearPeriods = (compId: string, year: number): Period401Metrics[] => {
    const setting = getSettingFor(compId, year);
    let runningRealizedCredit = Math.max(0, Number(setting?.priorYearCreditTax || 0));
    let runningSimCredit = runningRealizedCredit;

    const compInvs = invoices.filter(
      inv => inv.taxReportingCompanyId === compId && inv.status !== 'VOIDED'
    );
    const compPlanned = plannedInvoices.filter(
      p => p.companyId === compId && p.status === 'PLANNED'
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
  };

  const activeCompanyPeriods = useMemo(
    () => computeCompanyYearPeriods(selectedCompanyId, selectedYear),
    [selectedCompanyId, selectedYear, invoices, plannedInvoices, companyTaxSettings]
  );

  // Cross-company comparison for the currently selected bi-monthly period (or full year)
  const crossCompanyComparison = useMemo(() => {
    const targetCode = activeSheet === 'ANNUAL' ? currentPeriodCode : activeSheet;
    return companies.map(c => {
      const periods = computeCompanyYearPeriods(c.id, selectedYear);
      const pm = periods.find(p => p.periodCode === targetCode) || periods[0];
      return {
        company: c,
        metrics: pm,
      };
    });
  }, [companies, selectedYear, activeSheet, currentPeriodCode, invoices, plannedInvoices, companyTaxSettings]);

  const activePeriodKey = activeSheet === 'ANNUAL' ? `${selectedYear}-${currentPeriodCode}` : `${selectedYear}-${activeSheet}`;
  const currentPeriodMetrics = useMemo(
    () => activeCompanyPeriods.find(p => p.periodCode === activeSheet) || activeCompanyPeriods[0],
    [activeCompanyPeriods, activeSheet]
  );

  const periodOfficialInvoices = useMemo(() => {
    const list = invoices.filter(
      inv =>
        inv.taxReportingCompanyId === selectedCompanyId &&
        (inv.taxPeriod || derivePeriodFromDate(inv.invoiceDate)) === activePeriodKey
    );
    if (voucherGroupFilter === 'ALL') return list;
    return list.filter(inv => CATEGORY_META[resolveInvoiceCategory(inv)].group === voucherGroupFilter);
  }, [invoices, selectedCompanyId, activePeriodKey, voucherGroupFilter]);

  const periodPlannedList = useMemo(
    () =>
      plannedInvoices.filter(
        p =>
          p.companyId === selectedCompanyId &&
          p.taxPeriod === activePeriodKey &&
          p.status === 'PLANNED'
      ),
    [plannedInvoices, selectedCompanyId, activePeriodKey]
  );

  // Tax preview calculators
  const calcPreview = (
    baseStr: string,
    mode: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT',
    manualTaxStr?: string
  ) => {
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
  };

  const voucherPreview = calcPreview(vBaseAmt, vTaxMode, vManualTax);
  const plannedPreview = calcPreview(pBaseAmt, pTaxMode);

  const openAddVoucherModal = (defaultCat: InvoiceCategory401 = 'PURCHASE_GOODS') => {
    const meta = CATEGORY_META[defaultCat];
    const startMonth = Number((activePeriodKey.slice(5, 7)) || '01');
    const defaultDate =
      derivePeriodFromDate(new Date().toISOString().slice(0, 10)) === activePeriodKey
        ? new Date().toISOString().slice(0, 10)
        : `${selectedYear}-${String(startMonth).padStart(2, '0')}-15`;
    setVCategory(defaultCat);
    setVFormat('THREE_PART');
    setVIssueMode('DELIVERED');
    setVNumber('');
    setVDate(defaultDate);
    setVPartnerId('');
    setVPartnerName('');
    setVPartnerTaxId('');
    setVProjectId('');
    setVTaxMode(meta.exemptDefault ? 'TAX_EXEMPT' : 'TAX_EXCLUSIVE');
    setVBaseAmt('');
    setVManualTax('');
    setVPresetLabel('');
    setVNotes('');
    setIsAddVoucherOpen(true);
  };

  const handleSaveOfficialVoucher = () => {
    const meta = CATEGORY_META[vCategory];
    const needAutoNo = vCategory === 'RECEIPT_EXEMPT' || vCategory === 'PERSONAL_VOUCHER';
    const cleanNo = vNumber.trim().toUpperCase() || (needAutoNo ? `RCP-${Date.now().toString().slice(-6)}` : '');
    if (!cleanNo) {
      onNotify('請輸入發票字軌號碼（僅收據／個人憑證可留空自動產號）', 'warn');
      return;
    }
    if (!vPartnerName.trim()) {
      onNotify('請填入交易對象／摘要名稱', 'warn');
      return;
    }
    if (voucherPreview.total <= 0) {
      onNotify('金額必須大於 0', 'warn');
      return;
    }
    const ourTax = activeCompany?.taxId || selectedCompanyId;
    const ourName = activeCompany?.name || selectedCompanyId;
    const otherTax = vPartnerTaxId.trim() || (vFormat === 'TWO_PART' ? '免統編(二聯)' : meta.exemptDefault ? '免稅憑證' : '未建統編');
    const invType = meta.defaultType;

    try {
      createInvoice(
        {
          invoiceType: invType,
          invoiceFormat: vFormat,
          invoiceIssueMode: invType === 'OUTPUT' ? vIssueMode : 'DELIVERED',
          invoiceCategory: vCategory,
          taxPeriod: derivePeriodFromDate(vDate),
          presetLabel: vPresetLabel.trim() || undefined,
          notes: vNotes.trim() || undefined,
          invoiceNumber: cleanNo,
          invoiceDate: vDate,
          taxReportingCompanyId: selectedCompanyId,
          issuerTaxId: invType === 'INPUT' ? otherTax : ourTax,
          issuerName: invType === 'INPUT' ? vPartnerName.trim() : ourName,
          buyerTaxId: invType === 'INPUT' ? ourTax : otherTax,
          buyerName: invType === 'INPUT' ? ourName : vPartnerName.trim(),
          netAmount: voucherPreview.net,
          taxAmount: voucherPreview.tax,
          totalAmount: voucherPreview.total,
          linkedProjectId: vProjectId || undefined,
          status: 'VALID',
        },
        operatorName
      );
      setIsAddVoucherOpen(false);
      onRefresh();
      onNotify(`✅ 已登記「${meta.label}」憑證 [${cleanNo}] 至 ${activeCompany?.shortName || selectedCompanyId}！`, 'success');
    } catch (e: any) {
      onNotify(`登記失敗：${e.message}`, 'error');
    }
  };

  const openAddPlannedModal = () => {
    setPCompanyId(selectedCompanyId);
    setPCategory('SALES_THREE_PART');
    setPFormat('THREE_PART');
    setPIssueMode('DELIVERED');
    setPPartnerName('');
    setPPartnerTaxId('');
    setPProjectId('');
    setPTaxMode('TAX_EXCLUSIVE');
    setPBaseAmt('');
    setPNotes('');
    setIsAddPlannedOpen(true);
  };

  const handleSavePlanned = () => {
    if (!pPartnerName.trim()) {
      onNotify('請填入預計對象／工程摘要', 'warn');
      return;
    }
    if (plannedPreview.total <= 0) {
      onNotify('請輸入預計金額', 'warn');
      return;
    }
    const meta = CATEGORY_META[pCategory];
    try {
      createPlannedInvoice(
        {
          companyId: pCompanyId,
          taxPeriod: activePeriodKey,
          invoiceType: meta.defaultType,
          invoiceCategory: pCategory,
          invoiceFormat: pFormat,
          invoiceIssueMode: meta.defaultType === 'OUTPUT' ? pIssueMode : 'DELIVERED',
          partnerName: pPartnerName.trim(),
          partnerTaxId: pPartnerTaxId.trim() || undefined,
          linkedProjectId: pProjectId || undefined,
          netAmount: plannedPreview.net,
          taxAmount: plannedPreview.tax,
          totalAmount: plannedPreview.total,
          notes: pNotes.trim() || undefined,
        },
        operatorName
      );
      setIsAddPlannedOpen(false);
      onRefresh();
      onNotify('✅ 已新增至「預計請款／預計進項模擬區」（尚未壓日期與發票號，不影響正式申報）', 'success');
    } catch (e: any) {
      onNotify(`新增預計項目失敗：${e.message}`, 'error');
    }
  };

  const handleConfirmPromote = () => {
    if (!promotingPlanned) return;
    if (!promoteInvNo.trim()) {
      onNotify('請填入正式發票號碼', 'warn');
      return;
    }
    try {
      convertPlannedInvoiceToOfficial(promotingPlanned.id, promoteInvNo.trim().toUpperCase(), promoteInvDate, operatorName);
      setPromotingPlanned(null);
      onRefresh();
      onNotify(`✅ 已將預計項目轉為正式發票 [${promoteInvNo.trim().toUpperCase()}]！`, 'success');
    } catch (e: any) {
      onNotify(`轉正式失敗：${e.message}`, 'error');
    }
  };

  const openSettingsModal = () => {
    setSetPriorCredit(String(activeSetting?.priorYearCreditTax ?? 0));
    setSetPhonesText((activeSetting?.phonePresets || []).join('\n'));
    setSetElecText((activeSetting?.electricityPresets || []).join('\n'));
    setSetPersonalLabel(activeSetting?.personalVoucherLabel || '');
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    const phones = setPhonesText
      .split(/[\n,，]+/)
      .map(s => s.trim())
      .filter(Boolean);
    const elecs = setElecText
      .split(/[\n,，]+/)
      .map(s => s.trim())
      .filter(Boolean);
    saveCompanyTaxSetting({
      companyId: selectedCompanyId,
      taxYear: selectedYear,
      priorYearCreditTax: Math.max(0, Number(setPriorCredit || 0)),
      phonePresets: phones,
      electricityPresets: elecs,
      personalVoucherLabel: setPersonalLabel.trim() || undefined,
    });
    setIsSettingsOpen(false);
    onRefresh();
    onNotify(`✅ 已更新【${activeCompany?.shortName || selectedCompanyId}】${selectedYear}年度期初留抵與常用門號／電表設定！`, 'success');
  };

  const renderSignedMoney = (val: number, forceColor?: string) => (
    <span className={forceColor || (val < 0 ? 'text-rose-600' : 'text-slate-800')}>
      NT$ {val.toLocaleString()}
    </span>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
      {/* 1. Top Workbook Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-black text-slate-900">
            【{activeCompany?.shortName || activeCompany?.name || selectedCompanyId}】{selectedYear} 年度 401 營業稅工作簿
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold font-mono">
            統編: {activeCompany?.taxId || '未建檔'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y} 年 ({y - 1911} 民國年)</option>
            ))}
          </select>

          {companies.length > 1 && (
            <select
              value={selectedCompanyId}
              onChange={(e) => onSelectCompanyId(e.target.value)}
              className="bg-indigo-50 border border-indigo-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-indigo-900 outline-none cursor-pointer"
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  切換活頁簿：{c.shortName || c.name} ({c.taxId || c.id})
                </option>
              ))}
            </select>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={openSettingsModal}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1 border border-slate-200"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>設定去年留抵 & 門號/電表</span>
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => openAddVoucherModal('PURCHASE_GOODS')}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新增憑證／發票</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Cross-Company Period Comparison Strip (Helps accountant choose A/B/C for planned invoicing) */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            跨公司【{selectedYear} {BI_MONTHLY_PERIODS.find(p => p.code === (activeSheet === 'ANNUAL' ? currentPeriodCode : activeSheet))?.label || currentPeriodCode}】進銷項稅額對比（決策下個月請款要開哪家公司發票）
          </span>
          <span className="text-slate-400">點擊公司卡片即可切換工作簿</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {crossCompanyComparison.map(({ company, metrics }) => {
            const isActive = company.id === selectedCompanyId;
            return (
              <button
                key={company.id}
                type="button"
                onClick={() => onSelectCompanyId(company.id)}
                className={`text-left p-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white border-indigo-500 shadow-xs'
                    : 'bg-white/70 border-slate-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900">{company.shortName || company.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">{company.taxId}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1.5 text-[11px] font-mono">
                  <div>
                    <div className="text-[10px] text-slate-500 font-sans">正式已實現</div>
                    {metrics.code11NetPayable > 0 ? (
                      <div className="font-black text-rose-700">應繳 ${metrics.code11NetPayable.toLocaleString()}</div>
                    ) : (
                      <div className="font-black text-emerald-700">留抵 ${metrics.code12AccumCredit.toLocaleString()}</div>
                    )}
                  </div>
                  <div className="border-l border-slate-100 pl-2">
                    <div className="text-[10px] text-amber-700 font-sans">
                      含預計 ({metrics.plannedOutCount + metrics.plannedInCount}筆)
                    </div>
                    {metrics.simCode11NetPayable > 0 ? (
                      <div className="font-black text-rose-600">應繳 ${metrics.simCode11NetPayable.toLocaleString()}</div>
                    ) : (
                      <div className="font-black text-emerald-600">留抵 ${metrics.simCode12AccumCredit.toLocaleString()}</div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Bi-Monthly Sheet Tabs + Annual Summary */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
        {BI_MONTHLY_PERIODS.map(pm => {
          const m = activeCompanyPeriods.find(x => x.periodCode === pm.code);
          const hasPlanned = Boolean(m && (m.plannedOutCount + m.plannedInCount > 0));
          const isSelected = activeSheet === pm.code;
          return (
            <button
              key={pm.code}
              type="button"
              onClick={() => setActiveSheet(pm.code)}
              className={`px-3 py-1.5 rounded-t-lg text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>{selectedYear}_{pm.label}</span>
              {hasPlanned && (
                <span className={`text-[9px] px-1.5 rounded-full font-mono ${isSelected ? 'bg-amber-300 text-slate-900' : 'bg-amber-100 text-amber-800'}`}>
                  +預計
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setActiveSheet('ANNUAL')}
          className={`px-3.5 py-1.5 rounded-t-lg text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
            activeSheet === 'ANNUAL'
              ? 'bg-purple-700 text-white border-purple-700 shadow-2xs'
              : 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{selectedYear} 年度統整</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* VIEW A: ANNUAL SUMMARY SHEET                              */}
      {/* ========================================================= */}
      {activeSheet === 'ANNUAL' ? (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-950 flex flex-wrap items-center justify-between gap-2">
            <div>
              <b>【{activeCompany?.shortName || selectedCompanyId}】{selectedYear} 年度進銷項稅額統整表</b>
              <span className="ml-2 text-purple-700">
                （期初上年度留抵：NT$ {Number(activeSetting?.priorYearCreditTax || 0).toLocaleString()}，各期負數留抵自動結轉至下期 Code 8）
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">申報期別</th>
                  <th className="p-2.5 text-right">銷項銷售額 (未稅)</th>
                  <th className="p-2.5 text-right">銷項稅額 (Code 1)</th>
                  <th className="p-2.5 text-right">得抵扣進項額</th>
                  <th className="p-2.5 text-right">得抵扣進項稅 (Code 7)</th>
                  <th className="p-2.5 text-right">上期留抵 (Code 8)</th>
                  <th className="p-2.5 text-right">本期應繳 / (留抵)</th>
                  <th className="p-2.5 text-right text-amber-800">含預計模擬應繳/(留抵)</th>
                  <th className="p-2.5 text-right">收據/不申報憑證</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {activeCompanyPeriods.map(pm => {
                  const netReal = pm.outTax - pm.code10TotalDeductible;
                  const netSim = pm.simOutTax - pm.simCode10TotalDeductible;
                  return (
                    <tr
                      key={pm.periodCode}
                      onClick={() => setActiveSheet(pm.periodCode)}
                      className="hover:bg-indigo-50/40 cursor-pointer"
                    >
                      <td className="p-2.5 font-sans font-bold text-indigo-700 underline">{selectedYear} {pm.label}</td>
                      <td className="p-2.5 text-right">NT$ {pm.outSalesNet.toLocaleString()}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">NT$ {pm.outTax.toLocaleString()}</td>
                      <td className="p-2.5 text-right">NT$ {pm.inPurchaseNet.toLocaleString()}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-700">NT$ {pm.inTax.toLocaleString()}</td>
                      <td className="p-2.5 text-right text-blue-700">NT$ {pm.code8PriorCredit.toLocaleString()}</td>
                      <td className={`p-2.5 text-right font-black ${netReal > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {netReal > 0 ? `繳 $${netReal.toLocaleString()}` : `留抵 $${Math.abs(netReal).toLocaleString()}`}
                      </td>
                      <td className={`p-2.5 text-right font-bold ${netSim > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {netSim > 0 ? `繳 $${netSim.toLocaleString()}` : `留抵 $${Math.abs(netSim).toLocaleString()}`}
                      </td>
                      <td className="p-2.5 text-right text-slate-600">NT$ {pm.non401Total.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900 text-white font-mono font-bold">
                {(() => {
                  const sumOutSales = activeCompanyPeriods.reduce((s, p) => s + p.outSalesNet, 0);
                  const sumOutTax = activeCompanyPeriods.reduce((s, p) => s + p.outTax, 0);
                  const sumInPurchase = activeCompanyPeriods.reduce((s, p) => s + p.inPurchaseNet, 0);
                  const sumInTax = activeCompanyPeriods.reduce((s, p) => s + p.inTax, 0);
                  const sumPayable = activeCompanyPeriods.reduce((s, p) => s + p.code11NetPayable, 0);
                  const endCredit = activeCompanyPeriods[activeCompanyPeriods.length - 1]?.code12AccumCredit || 0;
                  const sumNon401 = activeCompanyPeriods.reduce((s, p) => s + p.non401Total, 0);
                  return (
                    <tr>
                      <td className="p-3 font-sans">年度合計 / 年底結餘</td>
                      <td className="p-3 text-right">NT$ {sumOutSales.toLocaleString()}</td>
                      <td className="p-3 text-right">NT$ {sumOutTax.toLocaleString()}</td>
                      <td className="p-3 text-right">NT$ {sumInPurchase.toLocaleString()}</td>
                      <td className="p-3 text-right">NT$ {sumInTax.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-300">-</td>
                      <td className="p-3 text-right text-amber-300">
                        實繳共 ${sumPayable.toLocaleString()} / 末留 ${endCredit.toLocaleString()}
                      </td>
                      <td className="p-3 text-right text-slate-300">-</td>
                      <td className="p-3 text-right">NT$ {sumNon401.toLocaleString()}</td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* VIEW B: BI-MONTHLY 401 WORKSHEET + FORECAST ZONE          */
        /* ========================================================= */
        <div className="space-y-4">
          {/* 401 Tax Formula Dashboard: Realized vs Simulated */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Official Realized 401 */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900">
                  【正式已實現】{selectedYear} {currentPeriodMetrics.label} 401 稅額試算
                </span>
                <span className={`text-xs font-mono font-black px-2 py-0.5 rounded ${
                  currentPeriodMetrics.code11NetPayable > 0
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {currentPeriodMetrics.code11NetPayable > 0
                    ? `本期應繳：NT$ ${currentPeriodMetrics.code11NetPayable.toLocaleString()}`
                    : `本期累積留抵：NT$ ${currentPeriodMetrics.code12AccumCredit.toLocaleString()}`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-sans">① 銷項稅額</div>
                  <div className="font-bold text-slate-900">${currentPeriodMetrics.outTax.toLocaleString()}</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-sans">⑦ 本期得抵進項</div>
                  <div className="font-bold text-emerald-700">${currentPeriodMetrics.inTax.toLocaleString()}</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-sans">⑧ 上期留抵結轉</div>
                  <div className="font-bold text-blue-700">${currentPeriodMetrics.code8PriorCredit.toLocaleString()}</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-sans">⑩ 可抵減合計</div>
                  <div className="font-bold text-indigo-800">${currentPeriodMetrics.code10TotalDeductible.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Simulated (+ Planned) 401 */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-300 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-950">
                  【含預計模擬】加計下方未開預計發票試算
                </span>
                <span className={`text-xs font-mono font-black px-2 py-0.5 rounded ${
                  currentPeriodMetrics.simCode11NetPayable > 0
                    ? 'bg-rose-200 text-rose-900'
                    : 'bg-emerald-200 text-emerald-900'
                }`}>
                  {currentPeriodMetrics.simCode11NetPayable > 0
                    ? `模擬應繳：NT$ ${currentPeriodMetrics.simCode11NetPayable.toLocaleString()}`
                    : `模擬留抵：NT$ ${currentPeriodMetrics.simCode12AccumCredit.toLocaleString()}`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
                <div className="bg-white/90 p-2 rounded-lg border border-amber-200">
                  <div className="text-[10px] text-amber-800 font-sans">① 模擬銷項稅</div>
                  <div className="font-bold text-slate-900">${currentPeriodMetrics.simOutTax.toLocaleString()}</div>
                </div>
                <div className="bg-white/90 p-2 rounded-lg border border-amber-200">
                  <div className="text-[10px] text-amber-800 font-sans">⑦ 模擬進項稅</div>
                  <div className="font-bold text-emerald-700">${currentPeriodMetrics.inSimTax.toLocaleString()}</div>
                </div>
                <div className="bg-white/90 p-2 rounded-lg border border-amber-200">
                  <div className="text-[10px] text-amber-800 font-sans">⑧ 模擬期初留抵</div>
                  <div className="font-bold text-blue-700">${currentPeriodMetrics.simCode8PriorCredit.toLocaleString()}</div>
                </div>
                <div className="bg-white/90 p-2 rounded-lg border border-amber-200">
                  <div className="text-[10px] text-amber-800 font-sans">非401收據/免稅</div>
                  <div className="font-bold text-slate-700">${currentPeriodMetrics.non401Total.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Quick Category Chips */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: 'ALL', label: '全部憑證' },
                { id: 'OUTPUT', label: '銷項 (三聯/二聯/折讓)' },
                { id: 'INPUT', label: '可抵進項 (進貨/油單/電話/台電/費用)' },
                { id: 'NON_401', label: '不申報401 (收據/郵資/個人憑證)' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setVoucherGroupFilter(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-bold border cursor-pointer ${
                    voucherGroupFilter === tab.id
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => openAddVoucherModal('TELECOM_EXPENSE')}
                  className="px-2 py-1 rounded bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold cursor-pointer"
                >
                  + 電話費
                </button>
                <button
                  type="button"
                  onClick={() => openAddVoucherModal('ELECTRICITY_EXPENSE')}
                  className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold cursor-pointer"
                >
                  + 台電電費
                </button>
                <button
                  type="button"
                  onClick={() => openAddVoucherModal('FUEL_EXPENSE')}
                  className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold cursor-pointer"
                >
                  + 油單+三聯
                </button>
                <button
                  type="button"
                  onClick={() => openAddVoucherModal('RECEIPT_EXEMPT')}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold cursor-pointer"
                >
                  + 收據/郵資
                </button>
              </div>
            )}
          </div>

          {/* Official Vouchers Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">發票字軌 / 憑證號</th>
                  <th className="p-2.5">401 分類</th>
                  <th className="p-2.5">日期</th>
                  <th className="p-2.5">開立／買受對象 (統編)</th>
                  <th className="p-2.5 text-right">銷售額 / 未稅</th>
                  <th className="p-2.5 text-right">營業稅 ({taxRatePct}%)</th>
                  <th className="p-2.5 text-right">含稅總額</th>
                  <th className="p-2.5 text-center">狀態 / 操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {periodOfficialInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 font-sans">
                      本期（{activePeriodKey}）尚無正式發票或費用憑證（AR開票、AP核准會自動寫入，或點擊右上方手動新增）
                    </td>
                  </tr>
                ) : (
                  periodOfficialInvoices.map(inv => {
                    const cat = resolveInvoiceCategory(inv);
                    const meta = CATEGORY_META[cat];
                    const counterpartName = inv.invoiceType === 'INPUT' ? (inv.issuerName || inv.issuerTaxId) : (inv.buyerName || inv.buyerTaxId);
                    const counterpartTax = inv.invoiceType === 'INPUT' ? inv.issuerTaxId : inv.buyerTaxId;
                    const sign = meta.sign === -1 ? -1 : 1;
                    return (
                      <tr key={inv.id} className={inv.status === 'VOIDED' ? 'bg-slate-50 text-slate-400' : 'hover:bg-slate-50'}>
                        <td className={`p-2.5 font-bold ${inv.status === 'VOIDED' ? 'line-through text-slate-400' : 'text-indigo-700'}`}>
                          <div>{inv.invoiceNumber}</div>
                          <div className="flex flex-wrap gap-1 mt-0.5 font-sans text-[9px]">
                            <span className="px-1 rounded bg-slate-100 text-slate-600">
                              {inv.invoiceFormat === 'TWO_PART' ? '二聯' : '三聯'}
                            </span>
                            {inv.invoiceIssueMode === 'SELF_RETAINED' && (
                              <span className="px-1 rounded bg-purple-100 text-purple-800 font-bold">自主留存報稅</span>
                            )}
                            {inv.presetLabel && (
                              <span className="px-1 rounded bg-sky-100 text-sky-800 font-bold">{inv.presetLabel}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 font-sans">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            meta.group === 'OUTPUT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : meta.group === 'INPUT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600">{inv.invoiceDate}</td>
                        <td className="p-2.5 font-sans text-slate-700">
                          <div className="font-bold">{counterpartName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {counterpartTax}
                            {inv.notes ? ` · ${inv.notes}` : ''}
                          </div>
                        </td>
                        <td className="p-2.5 text-right">{renderSignedMoney(sign * inv.netAmount)}</td>
                        <td className="p-2.5 text-right">{renderSignedMoney(sign * inv.taxAmount)}</td>
                        <td className="p-2.5 text-right font-black">{renderSignedMoney(sign * inv.totalAmount)}</td>
                        <td className="p-2.5 text-center font-sans">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            inv.status === 'VOIDED' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {inv.status === 'VOIDED' ? '已作廢' : '有效'}
                          </span>
                          {canEdit && inv.status === 'VALID' && (
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  voidInvoice(inv.id, '發票主檔作業作廢', operatorName);
                                  onRefresh();
                                  onNotify(`已作廢發票 [${inv.invoiceNumber}]`, 'warn');
                                } catch (e: any) {
                                  onNotify(`作廢失敗：${e.message}`, 'error');
                                }
                              }}
                              className="text-[10px] text-slate-400 hover:text-rose-600 underline cursor-pointer ml-1.5"
                            >
                              作廢
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ========================================================= */}
          {/* PLANNED FORECAST SEPARATOR ZONE (預計請款／預計進項模擬區)  */}
          {/* ========================================================= */}
          <div className="border-2 border-dashed border-amber-300 rounded-xl p-4 bg-amber-50/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-700" />
                <h4 className="text-xs font-black text-amber-950">
                  預計請款／預計進項模擬區（比照 Excel 空數行放置未押日期與未開號碼之預計資料）
                </h4>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={openAddPlannedModal}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新增預計請款 / 預計發票</span>
                </button>
              )}
            </div>

            {periodPlannedList.length === 0 ? (
              <div className="p-4 text-center text-xs text-amber-800/70 bg-white/60 rounded-lg border border-amber-200/70">
                本雙月期別尚無「預計請款／預計進項」項目；會計可先打上預計金額（不壓日期與發票號），即時試算要開哪家公司發票或順延下期。
              </div>
            ) : (
              <div className="space-y-2">
                {periodPlannedList.map(p => {
                  const meta = CATEGORY_META[p.invoiceCategory] || CATEGORY_META.SALES_THREE_PART;
                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-white border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                            預計模擬 · 未押日期/號碼
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            meta.group === 'OUTPUT' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                          }`}>
                            {meta.label}
                          </span>
                          {p.invoiceIssueMode === 'SELF_RETAINED' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">
                              預計自主報稅
                            </span>
                          )}
                          <span className="font-bold text-slate-900">{p.partnerName}</span>
                          {p.partnerTaxId && <span className="font-mono text-[10px] text-slate-400">({p.partnerTaxId})</span>}
                        </div>
                        <div className="font-mono text-[11px] text-slate-600">
                          未稅 NT$ <b>{p.netAmount.toLocaleString()}</b> ＋ 稅額 NT$ <b className="text-amber-800">{p.taxAmount.toLocaleString()}</b> ＝ 含稅 <b>NT$ {p.totalAmount.toLocaleString()}</b>
                          {p.notes && <span className="font-sans text-slate-400 ml-2">({p.notes})</span>}
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Instant company switch for tax comparison */}
                          {companies.length > 1 && (
                            <select
                              value={p.companyId}
                              onChange={(e) => {
                                updatePlannedInvoice(p.id, { companyId: e.target.value });
                                onRefresh();
                                onNotify('已將預計項目切換試算公司！', 'success');
                              }}
                              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-[11px] font-bold text-slate-700 cursor-pointer"
                              title="快速切換要由哪家公司開立／認列以試算稅額"
                            >
                              {companies.map(c => (
                                <option key={c.id} value={c.id}>改由 {c.shortName || c.name}</option>
                              ))}
                            </select>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              const nextPeriod = getNextBiMonthlyPeriod(p.taxPeriod);
                              updatePlannedInvoice(p.id, { taxPeriod: nextPeriod });
                              onRefresh();
                              onNotify(`已順延至下一期 (${nextPeriod})`, 'success');
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                            title="本期不開立，一鍵延至下一個雙月期別"
                          >
                            <ArrowRight className="w-3 h-3" />
                            <span>順延下期</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPromotingPlanned(p);
                              setPromoteInvNo('');
                              setPromoteInvDate(new Date().toISOString().slice(0, 10));
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>補號轉正式</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              deletePlannedInvoice(p.id);
                              onRefresh();
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="移除預計項目"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: ADD OFFICIAL VOUCHER / INVOICE                   */}
      {/* ========================================================= */}
      {isAddVoucherOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-3.5 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                新增憑證／統一發票 ({activeCompany?.shortName || selectedCompanyId})
              </h3>
              <button onClick={() => setIsAddVoucherOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">401 申報分類明細</label>
              <select
                value={vCategory}
                onChange={(e) => {
                  const nextCat = e.target.value as InvoiceCategory401;
                  setVCategory(nextCat);
                  const meta = CATEGORY_META[nextCat];
                  setVTaxMode(meta.exemptDefault ? 'TAX_EXEMPT' : 'TAX_EXCLUSIVE');
                  if (nextCat === 'SALES_TWO_PART') {
                    setVFormat('TWO_PART');
                    setVTaxMode('TAX_INCLUSIVE');
                  } else if (nextCat === 'SALES_THREE_PART') {
                    setVFormat('THREE_PART');
                  } else if (nextCat === 'TELECOM_EXPENSE') {
                    setVPartnerName('中華電信股份有限公司');
                  } else if (nextCat === 'ELECTRICITY_EXPENSE') {
                    setVPartnerName('台灣電力股份有限公司');
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
              >
                <optgroup label="── 銷項憑證 (401 銷售額 / 銷項稅)">
                  <option value="SALES_THREE_PART">銷貨發票-三聯式</option>
                  <option value="SALES_TWO_PART">銷貨發票-二聯式</option>
                  <option value="SALES_ALLOWANCE">銷貨折讓明細 (-)</option>
                </optgroup>
                <optgroup label="── 可扣抵進項憑證 (401 得抵扣進項)">
                  <option value="PURCHASE_GOODS">進貨發票明細</option>
                  <option value="FUEL_EXPENSE">油單+三聯單發票明細</option>
                  <option value="TELECOM_EXPENSE">電話費明細</option>
                  <option value="ELECTRICITY_EXPENSE">台灣電力公司電費</option>
                  <option value="OTHER_EXPENSE_INV">費用發票明細</option>
                  <option value="FIXED_ASSET">固定資產費用</option>
                  <option value="PURCHASE_RETURN">進貨退出明細 (-)</option>
                  <option value="PURCHASE_ALLOWANCE">進貨折讓明細 (-)</option>
                </optgroup>
                <optgroup label="── 不計入 401 抵減憑證">
                  <option value="NON_DEDUCTIBLE_INV">不列入401申報發票</option>
                  <option value="RECEIPT_EXEMPT">收據明細 (郵資/免開發票)</option>
                  <option value="PERSONAL_VOUCHER">個人憑證 (非公司營業稅帳)</option>
                </optgroup>
              </select>
            </div>

            {/* Company presets for telecom / electricity */}
            {vCategory === 'TELECOM_EXPENSE' && (activeSetting?.phonePresets?.length || 0) > 0 && (
              <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 space-y-1.5">
                <div className="text-[11px] font-bold text-sky-900">快速帶入常用電話門號（{activeCompany?.shortName}）：</div>
                <div className="flex flex-wrap gap-1.5">
                  {activeSetting!.phonePresets.map(ph => (
                    <button
                      key={ph}
                      type="button"
                      onClick={() => setVPresetLabel(ph)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border cursor-pointer ${
                        vPresetLabel === ph ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-sky-800 border-sky-300'
                      }`}
                    >
                      {ph}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {vCategory === 'ELECTRICITY_EXPENSE' && (activeSetting?.electricityPresets?.length || 0) > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5">
                <div className="text-[11px] font-bold text-amber-900">快速帶入常用台電電表／地址：</div>
                <div className="flex flex-wrap gap-1.5">
                  {activeSetting!.electricityPresets.map(el => (
                    <button
                      key={el}
                      type="button"
                      onClick={() => setVPresetLabel(el)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                        vPresetLabel === el ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-900 border-amber-300'
                      }`}
                    >
                      {el}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {CATEGORY_META[vCategory].defaultType === 'OUTPUT' && (
              <div className="flex flex-wrap items-center gap-2 bg-purple-50/70 p-2 rounded-lg border border-purple-200">
                <span className="font-bold text-purple-900">交付模式：</span>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input type="radio" checked={vIssueMode === 'DELIVERED'} onChange={() => setVIssueMode('DELIVERED')} />
                  <span>交付業主</span>
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer ml-2">
                  <input type="radio" checked={vIssueMode === 'SELF_RETAINED'} onChange={() => setVIssueMode('SELF_RETAINED')} />
                  <span className="font-bold text-purple-900">自主開立留存報稅 (自理稅金)</span>
                </label>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {CATEGORY_META[vCategory].exemptDefault ? '憑證號碼 (可留空自動)' : '發票字軌號碼 *'}
                </label>
                <input
                  type="text"
                  value={vNumber}
                  onChange={(e) => setVNumber(e.target.value.toUpperCase())}
                  placeholder="例: AB-12345678"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-indigo-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">開立日期 *</label>
                <input
                  type="date"
                  value={vDate}
                  onChange={(e) => setVDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">選取夥伴帶入 (選填)</label>
                <select
                  value={vPartnerId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setVPartnerId(pid);
                    const bp = partners.find(x => x.id === pid);
                    if (bp) {
                      setVPartnerName(bp.name);
                      setVPartnerTaxId(bp.taxId || '');
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
                >
                  <option value="">-- 手動輸入對象 --</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.taxId || '無統編'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">關聯專案案場 (選填)</label>
                <select
                  value={vProjectId}
                  onChange={(e) => setVProjectId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
                >
                  <option value="">-- 不指定案場 --</option>
                  {projects.filter(p => !p.isDeleted).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">對象名稱 / 費用摘要 *</label>
                <input
                  type="text"
                  value={vPartnerName}
                  onChange={(e) => setVPartnerName(e.target.value)}
                  placeholder="廠商名稱 / 客戶名稱 / 郵資..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">對象統編 / 門號電表標籤</label>
                <input
                  type="text"
                  value={vPartnerTaxId}
                  onChange={(e) => setVPartnerTaxId(e.target.value)}
                  placeholder="8碼統編 (選填)"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {vTaxMode === 'TAX_INCLUSIVE' ? '含稅總額 *' : '未稅／實付金額 *'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={vBaseAmt}
                  onChange={(e) => setVBaseAmt(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">計稅模式</label>
                <select
                  value={vTaxMode}
                  onChange={(e) => setVTaxMode(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
                >
                  <option value="TAX_EXCLUSIVE">外加 {taxRatePct}%</option>
                  <option value="TAX_INCLUSIVE">含稅反算</option>
                  <option value="TAX_EXEMPT">免稅 $0</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">手調稅額 (試算 {voucherPreview.autoTax})</label>
                <input
                  type="number"
                  value={vManualTax}
                  onChange={(e) => setVManualTax(e.target.value)}
                  placeholder={String(voucherPreview.autoTax)}
                  disabled={vTaxMode === 'TAX_EXEMPT'}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">門號／電表地址標籤 (選填)</label>
                <input
                  type="text"
                  value={vPresetLabel}
                  onChange={(e) => setVPresetLabel(e.target.value)}
                  placeholder="例: 04-xxxxxxx / 一廠電表"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">備註</label>
                <input
                  type="text"
                  value={vNotes}
                  onChange={(e) => setVNotes(e.target.value)}
                  placeholder="備註說明..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-between font-mono">
              <span className="font-sans text-slate-700">
                未稅 <b>${voucherPreview.net.toLocaleString()}</b> ＋ 稅 <b>${voucherPreview.tax.toLocaleString()}</b>
              </span>
              <span className="font-black text-indigo-800 text-sm">含稅總額 NT$ {voucherPreview.total.toLocaleString()}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddVoucherOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveOfficialVoucher}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer"
              >
                確認登記入主檔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ADD PLANNED FORECAST INVOICE                     */}
      {/* ========================================================= */}
      {isAddPlannedOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-amber-900">新增預計請款／預計進項模擬項目</h3>
              <button onClick={() => setIsAddPlannedOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>此項目不押日期與發票號碼，專供評估下個月請款或自主補開時，決定歸屬哪間公司或是否順延下期。</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">模擬歸屬公司</label>
                <select
                  value={pCompanyId}
                  onChange={(e) => setPCompanyId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.shortName || c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">預計憑證類型</label>
                <select
                  value={pCategory}
                  onChange={(e) => {
                    const c = e.target.value as InvoiceCategory401;
                    setPCategory(c);
                    if (c === 'SALES_TWO_PART') {
                      setPFormat('TWO_PART');
                      setPTaxMode('TAX_INCLUSIVE');
                    } else {
                      setPFormat('THREE_PART');
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
                >
                  <option value="SALES_THREE_PART">預計銷項-三聯式</option>
                  <option value="SALES_TWO_PART">預計銷項-二聯式</option>
                  <option value="PURCHASE_GOODS">預計進項-進貨發票</option>
                  <option value="OTHER_EXPENSE_INV">預計進項-費用發票</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">預計交易對象／工程案場摘要 *</label>
              <input
                type="text"
                value={pPartnerName}
                onChange={(e) => setPPartnerName(e.target.value)}
                placeholder="例：下月 XX 廠房第二期請款 100萬"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">金額 *</label>
                <input
                  type="number"
                  min="0"
                  value={pBaseAmt}
                  onChange={(e) => setPBaseAmt(e.target.value)}
                  placeholder="例: 1000000"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">稅金推算</label>
                <select
                  value={pTaxMode}
                  onChange={(e) => setPTaxMode(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
                >
                  <option value="TAX_EXCLUSIVE">外加 {taxRatePct}%</option>
                  <option value="TAX_INCLUSIVE">含稅反算</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">關聯案場 (選填)</label>
                <select
                  value={pProjectId}
                  onChange={(e) => setPProjectId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
                >
                  <option value="">-- 不指定 --</option>
                  {projects.filter(p => !p.isDeleted).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">備註</label>
                <input
                  type="text"
                  value={pNotes}
                  onChange={(e) => setPNotes(e.target.value)}
                  placeholder="討論中 / 待確認..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between font-mono">
              <span className="font-sans">銷售額 ${plannedPreview.net.toLocaleString()} ＋ 稅額 <b>${plannedPreview.tax.toLocaleString()}</b></span>
              <span className="font-black text-amber-900">NT$ {plannedPreview.total.toLocaleString()}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setIsAddPlannedOpen(false)} className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 cursor-pointer">取消</button>
              <button type="button" onClick={handleSavePlanned} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold cursor-pointer">加入預計模擬區</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: PROMOTE PLANNED -> OFFICIAL                      */}
      {/* ========================================================= */}
      {promotingPlanned && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-emerald-900">補上發票字軌與日期 ➔ 轉為正式發票</h3>
              <button onClick={() => setPromotingPlanned(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900">{promotingPlanned.partnerName}</div>
              <div className="font-mono text-slate-600">
                未稅 ${promotingPlanned.netAmount.toLocaleString()} ＋ 稅 ${promotingPlanned.taxAmount.toLocaleString()} ＝ 總額 ${promotingPlanned.totalAmount.toLocaleString()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">正式發票號碼 *</label>
                <input
                  type="text"
                  value={promoteInvNo}
                  onChange={(e) => setPromoteInvNo(e.target.value.toUpperCase())}
                  placeholder="例: AB-99887766"
                  className="w-full bg-white border border-emerald-300 rounded-lg p-2 font-mono font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">開立日期 *</label>
                <input
                  type="date"
                  value={promoteInvDate}
                  onChange={(e) => setPromoteInvDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setPromotingPlanned(null)} className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 cursor-pointer">取消</button>
              <button type="button" onClick={handleConfirmPromote} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer">確認轉為正式發票</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: COMPANY YEAR TAX SETTINGS                        */}
      {/* ========================================================= */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                【{activeCompany?.shortName || selectedCompanyId}】{selectedYear} 年度稅務參數與快捷清單
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                去年年底結轉留抵稅額（本年度 1.2 月 Code 8 起始值）
              </label>
              <input
                type="number"
                min="0"
                value={setPriorCredit}
                onChange={(e) => setSetPriorCredit(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                3.4月起的留抵稅額將由系統自動抓取上一期的累積留抵（負數即留抵、正數繳稅後歸零）。
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">本公司常用電話門號（每行一筆，可於登錄電話費時一鍵帶入）</label>
              <textarea
                rows={3}
                value={setPhonesText}
                onChange={(e) => setSetPhonesText(e.target.value)}
                placeholder={'04-1234567\n09xx-xxxxxx'}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">本公司常用台電電表／廠址（每行一筆）</label>
              <textarea
                rows={3}
                value={setElecText}
                onChange={(e) => setSetElecText(e.target.value)}
                placeholder={'一廠電表 (xx-xxxx-xx)\n辦公室地址'}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setIsSettingsOpen(false)} className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 cursor-pointer">取消</button>
              <button type="button" onClick={handleSaveSettings} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer">儲存設定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
