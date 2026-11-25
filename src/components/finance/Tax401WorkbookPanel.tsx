// src/components/finance/Tax401WorkbookPanel.tsx
// 📊 各公司獨立 401 雙月營業稅試算活頁簿、預計請款模擬區 & 年度統整表（輕量化指揮協調層）

import React, { useMemo, useState } from 'react';
import {
  Building2,
  FileSpreadsheet,
  Plus,
  Settings,
  TrendingUp,
} from 'lucide-react';
import {
  BusinessPartner,
  Company,
  CompanyTaxSetting,
  Invoice,
  InvoiceCategory401,
  PlannedInvoice,
  Project,
} from '../../types/erp';
import {
  BI_MONTHLY_PERIODS,
  CATEGORY_META,
  computeCompanyYearPeriods,
  derivePeriodFromDate,
  resolveInvoiceCategory,
} from '../../utils/tax401Calculator';
import { Tax401AnnualSummaryView } from './tax401/Tax401AnnualSummaryView';
import { Tax401PeriodSheetView } from './tax401/Tax401PeriodSheetView';
import { Tax401VoucherModal } from './tax401/Tax401VoucherModal';
import {
  Tax401AddPlannedModal,
  Tax401PromotePlannedModal,
  Tax401SettingsModal,
} from './tax401/Tax401ForecastModals';

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
  const [activeSheet, setActiveSheet] = useState<string>(currentPeriodCode);
  const [voucherGroupFilter, setVoucherGroupFilter] = useState<'ALL' | 'OUTPUT' | 'INPUT' | 'NON_401'>('ALL');

  const [voucherModalState, setVoucherModalState] = useState<{
    isOpen: boolean;
    defaultCategory: InvoiceCategory401;
  }>({ isOpen: false, defaultCategory: 'PURCHASE_GOODS' });
  const [isAddPlannedOpen, setIsAddPlannedOpen] = useState(false);
  const [promotingPlanned, setPromotingPlanned] = useState<PlannedInvoice | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  const activeSetting = useMemo(
    () => companyTaxSettings.find(s => s.companyId === selectedCompanyId && s.taxYear === selectedYear),
    [companyTaxSettings, selectedCompanyId, selectedYear]
  );

  const activeCompanyPeriods = useMemo(
    () =>
      computeCompanyYearPeriods({
        companyId: selectedCompanyId,
        year: selectedYear,
        invoices,
        plannedInvoices,
        companyTaxSettings,
      }),
    [selectedCompanyId, selectedYear, invoices, plannedInvoices, companyTaxSettings]
  );

  const crossCompanyComparison = useMemo(() => {
    const targetCode = activeSheet === 'ANNUAL' ? currentPeriodCode : activeSheet;
    return companies.map(c => {
      const periods = computeCompanyYearPeriods({
        companyId: c.id,
        year: selectedYear,
        invoices,
        plannedInvoices,
        companyTaxSettings,
      });
      const pm = periods.find(p => p.periodCode === targetCode) || periods[0];
      return { company: c, metrics: pm };
    });
  }, [companies, selectedYear, activeSheet, currentPeriodCode, invoices, plannedInvoices, companyTaxSettings]);

  const activePeriodKey =
    activeSheet === 'ANNUAL' ? `${selectedYear}-${currentPeriodCode}` : `${selectedYear}-${activeSheet}`;

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
              onClick={() => setIsSettingsOpen(true)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1 border border-slate-200"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>設定去年留抵 &amp; 門號/電表</span>
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setVoucherModalState({ isOpen: true, defaultCategory: 'PURCHASE_GOODS' })}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新增憑證／發票</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Cross-Company Period Comparison Strip */}
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

      {/* 4. Active Sheet View */}
      {activeSheet === 'ANNUAL' ? (
        <Tax401AnnualSummaryView
          activeCompany={activeCompany}
          selectedCompanyId={selectedCompanyId}
          selectedYear={selectedYear}
          activeSetting={activeSetting}
          activeCompanyPeriods={activeCompanyPeriods}
          onSelectPeriod={(code) => setActiveSheet(code)}
        />
      ) : (
        <Tax401PeriodSheetView
          selectedYear={selectedYear}
          activePeriodKey={activePeriodKey}
          currentPeriodMetrics={currentPeriodMetrics}
          voucherGroupFilter={voucherGroupFilter}
          onChangeVoucherGroupFilter={setVoucherGroupFilter}
          canEdit={canEdit}
          taxRatePct={taxRatePct}
          periodOfficialInvoices={periodOfficialInvoices}
          periodPlannedList={periodPlannedList}
          companies={companies}
          operatorName={operatorName}
          onOpenAddVoucherModal={(cat = 'PURCHASE_GOODS') => setVoucherModalState({ isOpen: true, defaultCategory: cat })}
          onOpenAddPlannedModal={() => setIsAddPlannedOpen(true)}
          onOpenPromoteModal={(planned) => setPromotingPlanned(planned)}
          onRefresh={onRefresh}
          onNotify={onNotify}
        />
      )}

      {/* 5. Modals */}
      <Tax401VoucherModal
        isOpen={voucherModalState.isOpen}
        defaultCategory={voucherModalState.defaultCategory}
        selectedYear={selectedYear}
        activePeriodKey={activePeriodKey}
        activeCompany={activeCompany}
        selectedCompanyId={selectedCompanyId}
        activeSetting={activeSetting}
        partners={partners}
        projects={projects}
        taxRate={taxRate}
        taxRatePct={taxRatePct}
        operatorName={operatorName}
        onClose={() => setVoucherModalState(prev => ({ ...prev, isOpen: false }))}
        onRefresh={onRefresh}
        onNotify={onNotify}
      />

      <Tax401AddPlannedModal
        isOpen={isAddPlannedOpen}
        selectedCompanyId={selectedCompanyId}
        activePeriodKey={activePeriodKey}
        companies={companies}
        projects={projects}
        taxRate={taxRate}
        taxRatePct={taxRatePct}
        operatorName={operatorName}
        onClose={() => setIsAddPlannedOpen(false)}
        onRefresh={onRefresh}
        onNotify={onNotify}
      />

      <Tax401PromotePlannedModal
        promotingPlanned={promotingPlanned}
        operatorName={operatorName}
        onClose={() => setPromotingPlanned(null)}
        onRefresh={onRefresh}
        onNotify={onNotify}
      />

      <Tax401SettingsModal
        isOpen={isSettingsOpen}
        activeCompany={activeCompany}
        selectedCompanyId={selectedCompanyId}
        selectedYear={selectedYear}
        activeSetting={activeSetting}
        onClose={() => setIsSettingsOpen(false)}
        onRefresh={onRefresh}
        onNotify={onNotify}
      />
    </div>
  );
};
