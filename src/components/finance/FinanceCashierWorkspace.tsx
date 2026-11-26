// src/components/finance/FinanceCashierWorkspace.tsx
// 🏛️ 財務會計與收納金流中樞 (Finance, Accounting & Cashier Workspace)
// 模組化瘦身外殼：職能隔離 PBAC、法人公司切換、頂部 KPI 看板與五大財務子模組調度

import React, { useEffect, useMemo, useState } from 'react';
import {
  AccountReceivable,
  AccountsPayableReconciliation,
  ArCollectionRecord,
  BankCheck,
  BusinessPartner,
  Company,
  CompanyBankAccount,
  CompanyTaxSetting,
  InboundReceipt,
  Invoice,
  PaymentRecord,
  PlannedInvoice,
  Project,
  ProjectAdvanceReceipt,
  SuspenseReceipt,
  SystemConfig,
} from '../../types/erp';
import {
  allocateSuspenseReceipt,
  cleanupDuplicateApReconciliations,
  getAllAccountsReceivable,
  getAllApReconciliations,
  getAllArCollections,
  getAllBankChecks,
  getAllBusinessPartners,
  getAllCompanies,
  getAllCompanyBankAccounts,
  getAllCompanyTaxSettings,
  getAllInboundReceipts,
  getAllInvoices,
  getAllPaymentRecords,
  getAllPlannedInvoices,
  getAllProjectAdvances,
  getAllProjects,
  getAllSuspenseReceipts,
  getAllSystemConfigs,
  getAppConfigMap,
  getDuplicateApReconciliationGroups,
  subscribeToDatabase,
  voidAccountsReceivable,
} from '../../db/sqlite';
import { useAuth } from '../../context/AuthContext';
import { Tax401WorkbookPanel } from './Tax401WorkbookPanel';
import { ProjectLedgerAndStatementModal } from './ProjectLedgerAndStatementModal';
import { CheckRadarMiniApp } from './CheckRadarMiniApp';
import { SuspensePoolMiniApp } from './SuspensePoolMiniApp';
import { CustomerBillingWorkflowMode } from './CustomerStatementMiniApp';
import {
  buildVendorPoolList,
  computeFinanceKpis,
  isBossPrivateAccount,
  VendorPoolGroup,
} from './financeUtils';
import { ApReconciliationPoolMiniApp } from './ap/ApReconciliationPoolMiniApp';
import { ApVendorPoolModal } from './ap/ApVendorPoolModal';
import { ApReconciliationEditorModal } from './ap/ApReconciliationEditorModal';
import { ApCashierPaymentModal } from './ap/ApCashierPaymentModal';
import {
  ApReturnToAccountingModal,
  ApVoidReconciliationModal,
} from './ap/ApReturnVoidModals';
import { ArBillingWorkspaceMiniApp } from './ar/ArBillingWorkspaceMiniApp';
import { ArCreateEditModal } from './ar/ArCreateEditModal';
import { ArCollectModal } from './ar/ArCollectModal';
import { ArPostInvoiceModal } from './ar/ArPostInvoiceModal';
import { TreasuryPaymentMiniApp } from './treasury/TreasuryPaymentMiniApp';
import {
  CreateSuspenseModal,
  QuickProjectAdvanceModal,
} from './treasury/TreasuryAdvanceSuspenseModals';
import { FinanceHeaderAndKpis, FinanceMainTab } from './FinanceHeaderAndKpis';
import { FinanceLedgerSearchSection } from './FinanceLedgerSearchSection';

interface FinanceCashierWorkspaceProps {
  onNotify?: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onNavigateToInbound?: () => void;
}

type MainTab = FinanceMainTab;

export const FinanceCashierWorkspace: React.FC<FinanceCashierWorkspaceProps> = ({
  onNotify = () => {},
  onNavigateToInbound,
}) => {
  const { currentUser, activeCompanyId, can, isSuperadmin, isBoss, isAdmin } = useAuth();

  // 職能分工權限拆解：會計 (FINANCE_AP/FINANCE_AR) 僅管帳對帳開單、出納 (BANK_CHECKS) 僅管錢收付與票據
  const canViewAccounting = can('FINANCE_AP', 'read') || isSuperadmin || isBoss || isAdmin;
  const canEditAccounting = can('FINANCE_AP', 'write') || can('FINANCE_AP', 'approve') || isSuperadmin || isBoss || isAdmin;
  const canViewCashier = can('BANK_CHECKS', 'read') || isSuperadmin || isBoss || isAdmin;
  const canEditCashier = can('BANK_CHECKS', 'write') || can('BANK_CHECKS', 'approve') || isSuperadmin || isBoss || isAdmin;
  const canViewArAndInvoices = can('FINANCE_AR', 'read') || can('FINANCE_AP', 'read') || isSuperadmin || isBoss || isAdmin;
  const canEditAr = can('FINANCE_AR', 'write') || can('FINANCE_AR', 'approve') || can('FINANCE_AP', 'write') || isSuperadmin || isBoss || isAdmin;

  const canEditArFor = (compId?: string) =>
    isSuperadmin || isBoss || isAdmin || can('FINANCE_AR', 'write', compId) || can('FINANCE_AR', 'approve', compId) || can('FINANCE_AP', 'write', compId);
  const canEditCashierFor = (compId?: string) =>
    isSuperadmin || isBoss || isAdmin || can('BANK_CHECKS', 'write', compId) || can('BANK_CHECKS', 'approve', compId);

  const permittedTabs = useMemo<MainTab[]>(() => {
    const tabs: MainTab[] = [];
    if (canViewAccounting) tabs.push('RECONCILIATION_POOL');
    if (canViewArAndInvoices) tabs.push('AR_BILLING');
    if (canViewCashier) tabs.push('TREASURY_PAYMENT', 'CHECK_RADAR');
    if (canViewArAndInvoices || canViewCashier) tabs.push('INVOICE_PETTY_CASH');
    return tabs;
  }, [canViewAccounting, canViewCashier, canViewArAndInvoices]);

  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    if (canViewAccounting) return 'RECONCILIATION_POOL';
    if (canViewCashier) return 'TREASURY_PAYMENT';
    if (canViewArAndInvoices) return 'AR_BILLING';
    return 'RECONCILIATION_POOL';
  });

  useEffect(() => {
    if (permittedTabs.length > 0 && !permittedTabs.includes(activeTab)) {
      setActiveTab(permittedTabs[0]);
    }
  }, [permittedTabs, activeTab]);

  // 資料庫資料狀態
  const [reconciliations, setReconciliations] = useState<AccountsPayableReconciliation[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [checks, setChecks] = useState<BankCheck[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [suspenses, setSuspenses] = useState<SuspenseReceipt[]>([]);
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([]);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [inboundReceipts, setInboundReceipts] = useState<InboundReceipt[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [systemConfigs, setSystemConfigs] = useState<SystemConfig[]>([]);
  const [arList, setArList] = useState<AccountReceivable[]>([]);
  const [arCollections, setArCollections] = useState<ArCollectionRecord[]>([]);
  const [projectAdvances, setProjectAdvances] = useState<ProjectAdvanceReceipt[]>([]);
  const [plannedInvoices, setPlannedInvoices] = useState<PlannedInvoice[]>([]);
  const [companyTaxSettings, setCompanyTaxSettings] = useState<CompanyTaxSetting[]>([]);
  const [customerBillingMode, setCustomerBillingMode] = useState<CustomerBillingWorkflowMode>('FINANCE_ONLY');

  // 法人隔離視角
  const [financeCompanyScope, setFinanceCompanyScope] = useState<string>(activeCompanyId || 'COMP-01');
  const [invoiceCompanyId, setInvoiceCompanyId] = useState<string>(activeCompanyId || 'COMP-01');

  useEffect(() => {
    if (activeCompanyId && activeCompanyId !== 'GRP-01' && activeCompanyId !== 'BOSS-01') {
      setFinanceCompanyScope(activeCompanyId);
      setInvoiceCompanyId(activeCompanyId);
    }
  }, [activeCompanyId]);

  // 子彈窗開關控制狀態
  const [viewingVendorPool, setViewingVendorPool] = useState<VendorPoolGroup | null>(null);
  const [recModalState, setRecModalState] = useState<{
    isOpen: boolean;
    vendorId: string;
    editingRec: AccountsPayableReconciliation | null;
  }>({ isOpen: false, vendorId: '', editingRec: null });
  const [selectedRecForPayment, setSelectedRecForPayment] = useState<AccountsPayableReconciliation | null>(null);
  const [voidModalTargetId, setVoidModalTargetId] = useState<string | null>(null);
  const [returnModalTargetRec, setReturnModalTargetRec] = useState<AccountsPayableReconciliation | null>(null);

  const [arModalState, setArModalState] = useState<{
    isOpen: boolean;
    suspense: SuspenseReceipt | null;
  }>({ isOpen: false, suspense: null });
  const [collectingTargetAr, setCollectingTargetAr] = useState<AccountReceivable | null>(null);
  const [postInvTargetAr, setPostInvTargetAr] = useState<AccountReceivable | null>(null);

  const [isCreateSuspenseModalOpen, setIsCreateSuspenseModalOpen] = useState(false);
  const [isQuickAdvanceModalOpen, setIsQuickAdvanceModalOpen] = useState(false);
  const [ledgerModalContext, setLedgerModalContext] = useState<{
    project: Project;
    initialTab: 'LEDGER' | 'STATEMENT';
    focusArId?: string;
  } | null>(null);

  const loadAllFinanceData = () => {
    try {
      setReconciliations(getAllApReconciliations());
      setPayments(getAllPaymentRecords());
      setChecks(getAllBankChecks());
      setInvoices(getAllInvoices());
      setSuspenses(getAllSuspenseReceipts());
      setBankAccounts(getAllCompanyBankAccounts());
      setPartners(getAllBusinessPartners());
      setInboundReceipts(getAllInboundReceipts());
      setProjects(getAllProjects());
      setCompanies(getAllCompanies());
      setSystemConfigs(getAllSystemConfigs());
      setArList(getAllAccountsReceivable());
      setArCollections(getAllArCollections());
      setProjectAdvances(getAllProjectAdvances());
      setPlannedInvoices(getAllPlannedInvoices());
      setCompanyTaxSettings(getAllCompanyTaxSettings());
      const cfgMap = getAppConfigMap();
      const modeRaw = cfgMap.APP_CUSTOMER_BILLING_MODE;
      if (modeRaw === 'PROJECT_AND_FINANCE' || modeRaw === 'PROJECT_FIRST_HANDOFF') {
        setCustomerBillingMode(modeRaw);
      } else {
        setCustomerBillingMode('FINANCE_ONLY');
      }
    } catch (e) {
      console.error('載入財務資料庫失敗', e);
    }
  };

  useEffect(() => {
    loadAllFinanceData();
    const unsubscribe = subscribeToDatabase(loadAllFinanceData);
    return () => unsubscribe();
  }, []);

  // 全域系統財務參數
  const taxRate = useMemo(() => {
    const cfg = systemConfigs.find(c => c.configKey === 'TAX_RATE');
    const raw = cfg ? Number(String(cfg.configValue).replace('%', '').trim()) : 0.05;
    if (!Number.isFinite(raw) || raw < 0) return 0.05;
    return raw > 1 ? raw / 100 : raw;
  }, [systemConfigs]);
  const taxRatePct = Number((taxRate * 100).toFixed(2));

  const taxTolerance = useMemo(() => {
    const cfg = systemConfigs.find(c => c.configKey === 'FIN_TAX_TOLERANCE');
    return cfg ? Number(cfg.configValue) : 5.0;
  }, [systemConfigs]);

  const globalScheduleDaysStr = useMemo(() => {
    const cfg = systemConfigs.find(c => c.configKey === 'PAYMENT_SCHEDULE_DAYS');
    return cfg?.configValue || '7,17,27';
  }, [systemConfigs]);

  const bossInvoicePolicy = useMemo(() => {
    const cfg = systemConfigs.find(c => c.configKey === 'BOSS_ACCOUNT_INVOICE_POLICY');
    return cfg?.configValue === 'ALLOW_BOSS_ADVANCE' ? 'ALLOW_BOSS_ADVANCE' : 'STRICT_INVOICE_MATCH';
  }, [systemConfigs]);

  // 授權法人隔離計算
  const authorizedCorps = useMemo(() => {
    return companies.filter(c => {
      if (c.entityType !== 'CORPORATION') return false;
      if (isSuperadmin || isBoss) return true;
      if (isAdmin) {
        return Boolean(currentUser?.canManageAllCompanies) || (currentUser?.allowedCompanies || []).includes(c.id);
      }
      return (
        can('FINANCE_AP', 'read', c.id) ||
        can('FINANCE_AR', 'read', c.id) ||
        can('BANK_CHECKS', 'read', c.id)
      );
    });
  }, [companies, isSuperadmin, isBoss, isAdmin, currentUser, can]);

  useEffect(() => {
    if (authorizedCorps.length === 0) return;
    const corpIds = authorizedCorps.map(c => c.id);
    if (financeCompanyScope !== 'ALL' && !corpIds.includes(financeCompanyScope)) {
      setFinanceCompanyScope(corpIds[0]);
    }
    if (!corpIds.includes(invoiceCompanyId)) {
      setInvoiceCompanyId(corpIds[0]);
    }
  }, [authorizedCorps, financeCompanyScope, invoiceCompanyId]);

  const authorizedCorpIds = useMemo(() => new Set(authorizedCorps.map(c => c.id)), [authorizedCorps]);
  const matchesCompanyScope = (compId?: string): boolean => {
    if (!compId) return true;
    if (compId === 'BOSS-01') return true;
    if (financeCompanyScope === 'ALL') return authorizedCorpIds.size === 0 || authorizedCorpIds.has(compId);
    return compId === financeCompanyScope;
  };

  // KPI 與大水池統計
  const metrics = useMemo(
    () =>
      computeFinanceKpis({
        inboundReceipts,
        reconciliations,
        bankAccounts,
        checks,
        suspenses,
        matchesCompanyScope,
      }),
    [inboundReceipts, reconciliations, bankAccounts, checks, suspenses, financeCompanyScope, authorizedCorpIds]
  );

  const vendorPoolList = useMemo(
    () =>
      buildVendorPoolList({
        inboundReceipts,
        partners,
        matchesCompanyScope,
      }),
    [inboundReceipts, partners, financeCompanyScope, authorizedCorpIds]
  );

  const returnedRecs = useMemo(
    () => reconciliations.filter(r => r.status === 'RETURNED' && matchesCompanyScope(r.companyId)),
    [reconciliations, financeCompanyScope, authorizedCorpIds]
  );
  const draftRecs = useMemo(
    () => reconciliations.filter(r => r.status === 'DRAFT' && matchesCompanyScope(r.companyId)),
    [reconciliations, financeCompanyScope, authorizedCorpIds]
  );
  const approvedRecs = useMemo(
    () => reconciliations.filter(r => r.status === 'APPROVED' && matchesCompanyScope(r.companyId)),
    [reconciliations, financeCompanyScope, authorizedCorpIds]
  );
  const duplicateApGroups = useMemo(
    () => getDuplicateApReconciliationGroups(),
    [reconciliations, inboundReceipts]
  );
  const accountingTodoCount = metrics.pendingInboundCount + returnedRecs.length + draftRecs.length;

  const handleCleanupDuplicateRecs = () => {
    try {
      const removedCount = cleanupDuplicateApReconciliations(currentUser?.fullName || '會計專員');
      loadAllFinanceData();
      if (removedCount > 0) {
        onNotify(`🧹 已自動作廢清理 ${removedCount} 筆重複請款對帳單，並保留有效／已核准單據！`, 'success');
      } else {
        onNotify('目前無重複請款單據需要清理', 'success');
      }
    } catch (e: any) {
      onNotify(`清理失敗：${e.message}`, 'error');
    }
  };

  const handleOpenCreateRecModal = (vendorId?: string) => {
    const targetVId = vendorId || (vendorPoolList.length > 0 ? vendorPoolList[0].vendorId : '');
    if (!targetVId) {
      onNotify('目前待對帳大水池尚無待請款進貨簽收單', 'warn');
      return;
    }
    setRecModalState({ isOpen: true, vendorId: targetVId, editingRec: null });
  };

  const handleOpenEditRecModal = (rec: AccountsPayableReconciliation) => {
    setRecModalState({ isOpen: true, vendorId: rec.vendorId, editingRec: rec });
  };

  const handleAllocateSuspense = (susp: SuspenseReceipt, arId: string, customAllocAmt?: number): boolean => {
    if (!arId) {
      onNotify('請先選擇要認領沖銷的應收請款單', 'warn');
      return false;
    }
    try {
      const suspRem = susp.remainingAmount ?? (susp.isAllocated ? 0 : susp.amount);
      const targetAr = arList.find(a => a.id === arId);
      const expectedApply =
        customAllocAmt && customAllocAmt > 0
          ? Math.min(customAllocAmt, suspRem, targetAr?.remainingAmount ?? suspRem)
          : Math.min(suspRem, targetAr?.remainingAmount ?? suspRem);
      allocateSuspenseReceipt(susp.id, arId, currentUser?.fullName || '會計專員', customAllocAmt);
      const afterRem = Math.max(0, suspRem - expectedApply);
      onNotify(
        afterRem > 0.01
          ? `✅ 已分批認領 NT$ ${expectedApply.toLocaleString()} 至 [${targetAr?.arNumber || arId}]，暫收池尚餘 NT$ ${afterRem.toLocaleString()} 待續沖！`
          : `✅ 暫收款【NT$ ${expectedApply.toLocaleString()}】已全數認領結清至應收帳款，銀行餘額不重複計入！`,
        'success'
      );
      loadAllFinanceData();
      return true;
    } catch (e: any) {
      onNotify(`認領失敗：${e.message}`, 'error');
      return false;
    }
  };

  const handleVoidAr = (ar: AccountReceivable) => {
    try {
      voidAccountsReceivable(ar.id, '會計作廢重開', currentUser?.fullName || '會計專員');
      onNotify(`已作廢應收請款單 [${ar.arNumber}]`, 'warn');
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`作廢失敗：${e.message}`, 'error');
    }
  };

  const openArCount = arList.filter(a => (a.status === 'OPEN' || a.status === 'PARTIAL') && matchesCompanyScope(a.companyId)).length;

  return (
    <div className="space-y-4">
      <FinanceHeaderAndKpis
        metrics={metrics}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        canViewAccounting={canViewAccounting}
        canEditAccounting={canEditAccounting}
        canViewCashier={canViewCashier}
        canEditCashier={canEditCashier}
        canViewArAndInvoices={canViewArAndInvoices}
        canEditAr={canEditAr}
        accountingTodoCount={accountingTodoCount}
        returnedRecsCount={returnedRecs.length}
        openArCount={openArCount}
        vendorPoolLength={vendorPoolList.length}
        authorizedCorps={authorizedCorps}
        financeCompanyScope={financeCompanyScope}
        onChangeCompanyScope={(val) => {
          setFinanceCompanyScope(val);
          if (val !== 'ALL') setInvoiceCompanyId(val);
        }}
        onOpenCreateRecModal={() => handleOpenCreateRecModal()}
        onOpenCreateArModal={() => setArModalState({ isOpen: true, suspense: null })}
        onNavigateToInbound={onNavigateToInbound}
      />

      <FinanceLedgerSearchSection
        reconciliations={reconciliations}
        payments={payments}
        arList={arList}
        checks={checks}
        companies={companies}
        bankAccounts={bankAccounts}
        matchesCompanyScope={matchesCompanyScope}
        canViewAccounting={canViewAccounting}
        canViewArAndInvoices={canViewArAndInvoices}
        canViewCashier={canViewCashier}
        onSelectTab={setActiveTab}
      />

      {/* TAB 1: 會計應付對帳大水池 */}
      {activeTab === 'RECONCILIATION_POOL' && (
        <ApReconciliationPoolMiniApp
          reconciliations={reconciliations}
          payments={payments}
          companies={companies}
          returnedRecs={returnedRecs}
          draftRecs={draftRecs}
          approvedRecs={approvedRecs}
          vendorPoolList={vendorPoolList}
          duplicateApGroups={duplicateApGroups}
          accountingTodoCount={accountingTodoCount}
          pendingInboundCount={metrics.pendingInboundCount}
          taxRatePct={taxRatePct}
          canEditAccounting={canEditAccounting}
          canEditCashier={canEditCashier}
          matchesCompanyScope={matchesCompanyScope}
          onCleanupDuplicates={handleCleanupDuplicateRecs}
          onOpenCreateRec={handleOpenCreateRecModal}
          onOpenEditRec={handleOpenEditRecModal}
          onOpenPayment={(rec) => setSelectedRecForPayment(rec)}
          onOpenVoidRec={(recId) => setVoidModalTargetId(recId)}
          onOpenReturnRec={(rec) => setReturnModalTargetRec(rec)}
          onViewVendorPool={(group) => setViewingVendorPool(group)}
        />
      )}

      {/* TAB 2: 會計應收請款作業 */}
      {activeTab === 'AR_BILLING' && (
        <ArBillingWorkspaceMiniApp
          arList={arList}
          arCollections={arCollections}
          companies={companies}
          projects={projects}
          customerBillingMode={customerBillingMode}
          canEditAr={canEditAr}
          canEditArFor={canEditArFor}
          canEditCashierFor={canEditCashierFor}
          matchesCompanyScope={matchesCompanyScope}
          onOpenCreateAr={() => setArModalState({ isOpen: true, suspense: null })}
          onOpenCollectAr={(ar) => setCollectingTargetAr(ar)}
          onOpenPostInvoice={(ar) => setPostInvTargetAr(ar)}
          onVoidAr={handleVoidAr}
          onOpenLedgerModal={(project, initialTab, focusArId) =>
            setLedgerModalContext({ project, initialTab, focusArId })
          }
        />
      )}

      {/* TAB 3: 出納收付款工作台 */}
      {activeTab === 'TREASURY_PAYMENT' && (
        <TreasuryPaymentMiniApp
          arList={arList}
          reconciliations={reconciliations}
          payments={payments}
          companies={companies}
          partners={partners}
          canEditCashier={canEditCashier}
          canEditCashierFor={canEditCashierFor}
          matchesCompanyScope={matchesCompanyScope}
          onOpenQuickAdvance={() => setIsQuickAdvanceModalOpen(true)}
          onOpenCreateSuspense={() => setIsCreateSuspenseModalOpen(true)}
          onOpenCollectAr={(ar) => setCollectingTargetAr(ar)}
          onOpenPaymentModal={(rec) => setSelectedRecForPayment(rec)}
          onOpenReturnModal={(rec) => setReturnModalTargetRec(rec)}
        />
      )}

      {/* TAB 4: 票據三燈號生命週期與資金雷達 */}
      {activeTab === 'CHECK_RADAR' && (
        <CheckRadarMiniApp
          checks={checks.filter(c => matchesCompanyScope(c.companyId))}
          reconciliations={reconciliations}
          arList={arList}
          canEditCashier={canEditCashier}
          operatorName={currentUser?.fullName || '李出納專員'}
          onNotify={onNotify}
          onRefresh={loadAllFinanceData}
        />
      )}

      {/* TAB 5: 各公司統一發票主檔、401 營業稅活頁簿與未知暫收池 */}
      {activeTab === 'INVOICE_PETTY_CASH' && (
        <div className="space-y-4">
          <SuspensePoolMiniApp
            suspenses={suspenses.filter(s => matchesCompanyScope(s.companyId))}
            arList={arList}
            companies={companies}
            bankAccounts={bankAccounts}
            canEditCashier={canEditCashier}
            canEditAr={canEditAr}
            isBossPrivateAccount={isBossPrivateAccount}
            onOpenCreateSuspense={() => setIsCreateSuspenseModalOpen(true)}
            onAllocateSuspense={handleAllocateSuspense}
            onOpenCreateArForSuspense={(s) => setArModalState({ isOpen: true, suspense: s })}
          />

          <Tax401WorkbookPanel
            companies={authorizedCorps.length > 0 ? authorizedCorps : companies}
            partners={partners}
            projects={projects}
            invoices={invoices}
            plannedInvoices={plannedInvoices}
            companyTaxSettings={companyTaxSettings}
            selectedCompanyId={invoiceCompanyId}
            onSelectCompanyId={setInvoiceCompanyId}
            canEdit={canEditArFor(invoiceCompanyId)}
            taxRate={taxRate}
            operatorName={currentUser?.fullName || '會計專員'}
            onNotify={onNotify}
            onRefresh={loadAllFinanceData}
          />
        </div>
      )}

      {/* 子彈窗調度群 */}
      <ApVendorPoolModal
        vendorPool={viewingVendorPool}
        companies={companies}
        canEditAccounting={canEditAccounting}
        onClose={() => setViewingVendorPool(null)}
        onCreateReconciliation={(vId) => handleOpenCreateRecModal(vId)}
      />

      <ApReconciliationEditorModal
        isOpen={recModalState.isOpen}
        initialVendorId={recModalState.vendorId}
        editingRec={recModalState.editingRec}
        reconciliations={reconciliations}
        inboundReceipts={inboundReceipts}
        partners={partners}
        companies={companies}
        vendorPoolList={vendorPoolList}
        taxRate={taxRate}
        taxRatePct={taxRatePct}
        taxTolerance={taxTolerance}
        bossInvoicePolicy={bossInvoicePolicy}
        canEditCashier={canEditCashier}
        operatorName={currentUser?.fullName || '會計專員'}
        onClose={() => setRecModalState({ isOpen: false, vendorId: '', editingRec: null })}
        onNotify={onNotify}
        onSaved={(savedRec, openPaymentAfter) => {
          loadAllFinanceData();
          if (openPaymentAfter) setSelectedRecForPayment(savedRec);
        }}
      />

      <ApCashierPaymentModal
        targetRec={selectedRecForPayment}
        partners={partners}
        companies={companies}
        bankAccounts={bankAccounts}
        globalScheduleDaysStr={globalScheduleDaysStr}
        bossInvoicePolicy={bossInvoicePolicy}
        canEditCashier={canEditCashier}
        operatorName={currentUser?.fullName || '李出納專員'}
        onClose={() => setSelectedRecForPayment(null)}
        onRequestReturn={(rec) => setReturnModalTargetRec(rec)}
        onNotify={onNotify}
        onPaid={loadAllFinanceData}
      />

      <ApVoidReconciliationModal
        targetRecId={voidModalTargetId}
        operatorName={currentUser?.fullName || '會計專員'}
        onClose={() => setVoidModalTargetId(null)}
        onNotify={onNotify}
        onSuccess={loadAllFinanceData}
      />

      <ApReturnToAccountingModal
        targetRec={returnModalTargetRec}
        operatorName={currentUser?.fullName || '出納專員'}
        onClose={() => setReturnModalTargetRec(null)}
        onNotify={onNotify}
        onReturned={(returnedId) => {
          if (selectedRecForPayment?.id === returnedId) {
            setSelectedRecForPayment(null);
          }
          loadAllFinanceData();
        }}
      />

      <ArCreateEditModal
        isOpen={arModalState.isOpen}
        pendingClaimSuspense={arModalState.suspense}
        projects={projects}
        companies={companies}
        authorizedCorps={authorizedCorps}
        authorizedCorpIds={authorizedCorpIds}
        partners={partners}
        bankAccounts={bankAccounts}
        arList={arList}
        financeCompanyScope={financeCompanyScope}
        taxRate={taxRate}
        taxRatePct={taxRatePct}
        operatorName={currentUser?.fullName || '會計專員'}
        canEditArFor={canEditArFor}
        canEditCashierFor={canEditCashierFor}
        onClose={() => setArModalState({ isOpen: false, suspense: null })}
        onNotify={onNotify}
        onCreated={(createdAr, immediatelyCollect) => {
          loadAllFinanceData();
          if (immediatelyCollect) setCollectingTargetAr(createdAr);
        }}
      />

      <ArCollectModal
        targetAr={collectingTargetAr}
        companies={companies}
        bankAccounts={bankAccounts}
        operatorName={currentUser?.fullName || 'B出納'}
        onClose={() => setCollectingTargetAr(null)}
        onNotify={onNotify}
        onCollected={loadAllFinanceData}
      />

      <ArPostInvoiceModal
        targetAr={postInvTargetAr}
        projects={projects}
        authorizedCorps={authorizedCorps}
        taxRate={taxRate}
        taxRatePct={taxRatePct}
        operatorName={currentUser?.fullName || '會計專員'}
        onClose={() => setPostInvTargetAr(null)}
        onNotify={onNotify}
        onIssued={loadAllFinanceData}
      />

      <CreateSuspenseModal
        isOpen={isCreateSuspenseModalOpen}
        bankAccounts={bankAccounts}
        companies={companies}
        authorizedCorps={authorizedCorps}
        financeCompanyScope={financeCompanyScope}
        operatorName={currentUser?.fullName || 'B出納'}
        matchesCompanyScope={matchesCompanyScope}
        onClose={() => setIsCreateSuspenseModalOpen(false)}
        onNotify={onNotify}
        onCreated={loadAllFinanceData}
      />

      <QuickProjectAdvanceModal
        isOpen={isQuickAdvanceModalOpen}
        projects={projects}
        bankAccounts={bankAccounts}
        authorizedCorps={authorizedCorps}
        operatorName={currentUser?.fullName || 'B出納'}
        matchesCompanyScope={matchesCompanyScope}
        onClose={() => setIsQuickAdvanceModalOpen(false)}
        onNotify={onNotify}
        onCreated={loadAllFinanceData}
      />

      {ledgerModalContext && (
        <ProjectLedgerAndStatementModal
          project={ledgerModalContext.project}
          arList={arList}
          arCollections={arCollections}
          projectAdvances={projectAdvances}
          invoices={invoices}
          companies={authorizedCorps.length > 0 ? authorizedCorps : companies}
          bankAccounts={bankAccounts}
          taxRate={taxRate}
          canEditAr={canEditAr}
          canEditCashier={canEditCashier}
          operatorName={currentUser?.fullName || '財務人員'}
          initialTab={ledgerModalContext.initialTab}
          initialFocusArId={ledgerModalContext.focusArId}
          onClose={() => setLedgerModalContext(null)}
          onNotify={onNotify}
          onRefresh={loadAllFinanceData}
        />
      )}
    </div>
  );
};
