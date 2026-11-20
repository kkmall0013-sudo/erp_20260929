// src/components/finance/FinanceCashierWorkspace.tsx
// 🏛️ 財務會計與收納金流中樞 (Finance, Accounting & Cashier Workspace)
// 旗艦定版：應付對帳大水池 · 出納放款四柱平衡 · 票據三燈號資金雷達 · 發票多對多勾稽 · 未知暫收認領

import React, { useState, useMemo, useEffect } from 'react';
import {
  Wallet,
  Receipt,
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  Plus,
  ArrowRight,
  FileText,
  FileCheck2,
  AlertTriangle,
  RotateCcw,
  DollarSign,
  Download,
  Printer,
  ChevronRight,
  ChevronDown,
  Layers,
  Sparkles,
  Info,
  X,
  Save,
  Send,
  Eye,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Ban,
  Zap,
  Edit3,
  BookOpen
} from 'lucide-react';
import {
  AccountsPayableReconciliation,
  AccountReceivable,
  ArCollectionRecord,
  ArLineItem,
  PaymentRecord,
  PaymentLineItem,
  BankCheck,
  Invoice,
  SuspenseReceipt,
  CompanyBankAccount,
  BusinessPartner,
  InboundReceipt,
  Project,
  Company,
  SystemConfig,
  ProjectAdvanceReceipt,
  PlannedInvoice,
  CompanyTaxSetting
} from '../../types/erp';
import {
  getAllApReconciliations,
  createApReconciliation,
  updateApReconciliation,
  returnApReconciliationToAccounting,
  voidApReconciliation,
  getDuplicateApReconciliationGroups,
  cleanupDuplicateApReconciliations,
  getAllPaymentRecords,
  createPaymentRecord,
  getAllBankChecks,
  getAllInvoices,
  createInvoice,
  voidInvoice,
  getAllSuspenseReceipts,
  createSuspenseReceipt,
  allocateSuspenseReceipt,
  getAllCompanyBankAccounts,
  getAllBusinessPartners,
  getAllInboundReceipts,
  getAllProjects,
  getAllCompanies,
  getAllSystemConfigs,
  getAppConfigMap,
  getAllAccountsReceivable,
  getAllArCollections,
  createAccountsReceivable,
  issueInvoiceForExistingAr,
  voidAccountsReceivable,
  collectAccountsReceivable,
  getAllProjectAdvances,
  createProjectAdvance,
  getAllPlannedInvoices,
  getAllCompanyTaxSettings,
  subscribeToDatabase,
  recordAuditLog
} from '../../db/sqlite';
import { useAuth } from '../../context/AuthContext';
import { Tax401WorkbookPanel } from './Tax401WorkbookPanel';
import { ProjectLedgerAndStatementModal } from './ProjectLedgerAndStatementModal';
import { CheckRadarMiniApp } from './CheckRadarMiniApp';
import { SuspensePoolMiniApp } from './SuspensePoolMiniApp';
import { CustomerBillingWorkflowMode } from './CustomerStatementMiniApp';

interface FinanceCashierWorkspaceProps {
  onNotify?: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onNavigateToInbound?: () => void;
}

type MainTab = 'RECONCILIATION_POOL' | 'AR_BILLING' | 'TREASURY_PAYMENT' | 'CHECK_RADAR' | 'INVOICE_PETTY_CASH';

export const FinanceCashierWorkspace: React.FC<FinanceCashierWorkspaceProps> = ({
  onNotify = () => {},
  onNavigateToInbound,
}) => {
  const { currentUser, activeCompanyId, can, isSuperadmin, isBoss, isAdmin } = useAuth();
  // 職能分工權限拆解：會計 (FINANCE_AP/FINANCE_AR) 僅管帳對帳開單、出納 (BANK_CHECKS) 僅管錢收付與票據
  // 1 人兼任模式同時具備兩者權限，享一鍵連貫快速操作；並支援依各法人公司獨立評估 PBAC 矩陣
  const canViewAccounting = can('FINANCE_AP', 'read') || isSuperadmin || isBoss || isAdmin;
  const canEditAccounting = can('FINANCE_AP', 'write') || can('FINANCE_AP', 'approve') || isSuperadmin || isBoss || isAdmin;
  const canViewCashier = can('BANK_CHECKS', 'read') || isSuperadmin || isBoss || isAdmin;
  const canEditCashier = can('BANK_CHECKS', 'write') || can('BANK_CHECKS', 'approve') || isSuperadmin || isBoss || isAdmin;
  const canViewArAndInvoices = can('FINANCE_AR', 'read') || can('FINANCE_AP', 'read') || isSuperadmin || isBoss || isAdmin;
  const canEditAr = can('FINANCE_AR', 'write') || can('FINANCE_AR', 'approve') || can('FINANCE_AP', 'write') || isSuperadmin || isBoss || isAdmin;

  const canEditAccountingFor = (compId?: string) =>
    isSuperadmin || isBoss || isAdmin || can('FINANCE_AP', 'write', compId) || can('FINANCE_AP', 'approve', compId);
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

  // 主頁籤（依登入者職能自動落點至第一個有權限的頁籤）
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

  // 案場雙軌借貸總帳 & 對客明細表 Modal 狀態
  const [ledgerModalContext, setLedgerModalContext] = useState<{
    project: Project;
    initialTab: 'LEDGER' | 'STATEMENT';
    focusArId?: string;
  } | null>(null);

  // 出納快速登錄「案場預收／貸款直入」Modal 狀態
  const [isQuickAdvanceModalOpen, setIsQuickAdvanceModalOpen] = useState(false);
  const [quickAdvProjId, setQuickAdvProjId] = useState<string>('');
  const [quickAdvSourceType, setQuickAdvSourceType] = useState<'EARLY_LOAN' | 'DEPOSIT' | 'OVERPAYMENT'>('EARLY_LOAN');
  const [quickAdvMethod, setQuickAdvMethod] = useState<'TT' | 'CHECK' | 'CASH'>('TT');
  const [quickAdvBankId, setQuickAdvBankId] = useState<string>('');
  const [quickAdvAmount, setQuickAdvAmount] = useState<string>('');
  const [quickAdvDate, setQuickAdvDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [quickAdvCheckNo, setQuickAdvCheckNo] = useState<string>('');
  const [quickAdvCheckDue, setQuickAdvCheckDue] = useState<string>(new Date().toISOString().slice(0, 10));
  const [quickAdvNotes, setQuickAdvNotes] = useState<string>('');

  // 法人隔離視角狀態 (依頂部選取法人或各公司 PBAC 權限過濾；發票主檔嚴格僅看單一法人)
  const [financeCompanyScope, setFinanceCompanyScope] = useState<string>(activeCompanyId || 'COMP-01');
  const [invoiceCompanyId, setInvoiceCompanyId] = useState<string>(activeCompanyId || 'COMP-01');
  const [invoiceDirectionFilter, setInvoiceDirectionFilter] = useState<'ALL' | 'INPUT' | 'OUTPUT'>('ALL');

  useEffect(() => {
    if (activeCompanyId && activeCompanyId !== 'GRP-01' && activeCompanyId !== 'BOSS-01') {
      setFinanceCompanyScope(activeCompanyId);
      setInvoiceCompanyId(activeCompanyId);
    }
  }, [activeCompanyId]);

  // 篩選狀態（清冊預設僅顯示「已完全完工結清」備查資料；待辦與已送出納中各獨立於上方區塊）
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('PAID');

  // 對帳單建立／重算編輯 Modal 狀態
  const [isCreateRecModalOpen, setIsCreateRecModalOpen] = useState(false);
  const [isSavingRec, setIsSavingRec] = useState(false);
  const [editingRecId, setEditingRecId] = useState<string | null>(null);
  const [editingReturnedReason, setEditingReturnedReason] = useState<string | null>(null);
  const [recTargetVendorId, setRecTargetVendorId] = useState<string>('');
  const [recVendorLocked, setRecVendorLocked] = useState<boolean>(true);
  const [recSelectedReceiptIds, setRecSelectedReceiptIds] = useState<string[]>([]);
  const [recDiscountAmount, setRecDiscountAmount] = useState<number>(0);
  const [recTaxType, setRecTaxType] = useState<'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT'>('TAX_EXCLUSIVE');
  const [recManualTax, setRecManualTax] = useState<string>(''); // 手動輸入稅額 (容差比對)
  const [recInvoiceNumber, setRecInvoiceNumber] = useState<string>('');
  const [recHasInvoice, setRecHasInvoice] = useState<boolean>(true);
  const [recBillingPeriod, setRecBillingPeriod] = useState<string>(new Date().toISOString().slice(0, 7));
  const [recNotes, setRecNotes] = useState<string>('');

  // 🏛️ 會計立帳法人歸屬與給出納之備註（會計只管帳，付款方式／專戶／支票到期日交由出納決定）
  const [recCompanyId, setRecCompanyId] = useState<string>('COMP-01');
  const [recPaymentTermNotes, setRecPaymentTermNotes] = useState<string>('');
  const [recIsBossAdvance, setRecIsBossAdvance] = useState<boolean>(false);
  const [recReceiptCompanyFilter, setRecReceiptCompanyFilter] = useState<'ALL' | 'MATCH_COMPANY'>('ALL');

  // 出納退回會計重算 Modal 狀態
  const [returnModalTargetRec, setReturnModalTargetRec] = useState<AccountsPayableReconciliation | null>(null);
  const [returnReasonText, setReturnReasonText] = useState<string>('');

  // 廠商未結進貨單正中央彈出全螢幕檢視 Modal 狀態
  const [viewingVendorPool, setViewingVendorPool] = useState<any | null>(null);
  const [viewingModalExpandedReceiptIds, setViewingModalExpandedReceiptIds] = useState<string[]>([]);

  // 大水池清單與進貨單明細展開檢視狀態
  const [expandedVendorPoolIds, setExpandedVendorPoolIds] = useState<string[]>([]);
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<string[]>([]);

  // 輔助函式：本地 YYYY-MM-DD 格式化 (避免 UTC 時差造成日期減 1 天)
  const formatLocalYmd = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 解析每月付款排程日規則 (預設 7,17,27)
  const parseScheduleDays = (raw?: string): number[] => {
    const parsed = Array.from(
      new Set(
        String(raw || '')
          .split(/[,，、\s]+/)
          .map(s => Number(s.trim()))
          .filter(n => Number.isInteger(n) && n >= 1 && n <= 31)
      )
    ).sort((a, b) => a - b);
    return parsed.length > 0 ? parsed : [7, 17, 27];
  };

  // 推算指定年月偏移 (0=當月, 1=下月, 2=下下月) 的所有排程日期按鈕，跨年度自動顯示 YYYY/M/D
  const getThreeMonthScheduleRows = (days: number[]) => {
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
  };

  // 推算最近一次指定日 (本月尚未過則取本月該日，否則取次月該日；遇小月自動收斂為月底)
  const computeUpcomingScheduleDate = (dayOfMonth: number): string => {
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
  };

  const pickNearestScheduleDate = (days: number[]): string => {
    const valid = days.length > 0 ? days : [7, 17, 27];
    const candidates = valid.map(d => computeUpcomingScheduleDate(d)).sort();
    return candidates[0];
  };

  // 輔助函式：推算天期到期日 (如 T+30, T+45, T+60)
  const computeTermsPaymentDate = (termsDays: number = 30): string => {
    const d = new Date();
    d.setDate(d.getDate() + termsDays);
    return formatLocalYmd(d);
  };

  // 出納放款 Modal 狀態
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedRecForPayment, setSelectedRecForPayment] = useState<AccountsPayableReconciliation | null>(null);
  const [payBankAccountId, setPayBankAccountId] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'TT' | 'CHECK' | 'CASH'>('CASH');
  const [payCheckNumber, setPayCheckNumber] = useState<string>('');
  const [payCheckDueDate, setPayCheckDueDate] = useState<string>('');
  const [payFeeAmount, setPayFeeAmount] = useState<number>(30);
  const [payIsFeeAbsorbed, setPayIsFeeAbsorbed] = useState<boolean>(true);
  const [payDeductionAmount, setPayDeductionAmount] = useState<number>(0);
  const [payDeductionNote, setPayDeductionNote] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [payIsBossAdvance, setPayIsBossAdvance] = useState<boolean>(false);

  // 作廢對帳單 Modal 狀態
  const [voidModalTargetId, setVoidModalTargetId] = useState<string | null>(null);
  const [voidReasonText, setVoidReasonText] = useState<string>('');

  // 會計開立應收請款單 (AR) Modal 狀態
  const [isCreateArModalOpen, setIsCreateArModalOpen] = useState(false);
  const [arCompanyId, setArCompanyId] = useState<string>('COMP-01');
  const [arProjectId, setArProjectId] = useState<string>('');
  const [arCustomerId, setArCustomerId] = useState<string>('');
  const [arTitle, setArTitle] = useState<string>('');
  const [arBaseAmount, setArBaseAmount] = useState<string>('');
  const [arHasInvoice, setArHasInvoice] = useState<boolean>(true);
  const [arInvoiceFormat, setArInvoiceFormat] = useState<'THREE_PART' | 'TWO_PART'>('THREE_PART');
  const [arTaxType, setArTaxType] = useState<'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT'>('TAX_EXCLUSIVE');
  const [arManualTax, setArManualTax] = useState<string>('');
  const [arInvoiceNumber, setArInvoiceNumber] = useState<string>('');
  const [arInvoiceDate, setArInvoiceDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [arDueDate, setArDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [arNotes, setArNotes] = useState<string>('');
  const [arUseMultiLine, setArUseMultiLine] = useState<boolean>(false);
  const [arMultiLines, setArMultiLines] = useState<Array<{ id: string; itemName: string; amount: string; taxMode: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT' }>>([]);
  const [pendingClaimSuspense, setPendingClaimSuspense] = useState<SuspenseReceipt | null>(null);

  // 出納應收收款登錄 Modal 狀態 (支援給少折讓結清/部分收款、給多溢收預設直入案場總帳或轉暫收池)
  const [collectingTargetAr, setCollectingTargetAr] = useState<AccountReceivable | null>(null);
  const [collectMethod, setCollectMethod] = useState<'TT' | 'CHECK' | 'CASH'>('TT');
  const [collectBankAccountId, setCollectBankAccountId] = useState<string>('');
  const [collectReceivedAmount, setCollectReceivedAmount] = useState<string>('');
  const [collectShortageMode, setCollectShortageMode] = useState<'PARTIAL' | 'SETTLE_SHORT'>('PARTIAL');
  const [collectOverpayMode, setCollectOverpayMode] = useState<'TO_PROJECT_ADVANCE' | 'TO_SUSPENSE' | 'DIRECT_OVERPAY'>('TO_PROJECT_ADVANCE');
  const [collectReceivedDate, setCollectReceivedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [collectCheckNumber, setCollectCheckNumber] = useState<string>('');
  const [collectCheckDueDate, setCollectCheckDueDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [collectDrawerBank, setCollectDrawerBank] = useState<string>('');
  const [collectNotes, setCollectNotes] = useState<string>('');

  // 出納登錄未知暫收款 Modal 狀態 & 分批認領金額入力
  const [isCreateSuspenseModalOpen, setIsCreateSuspenseModalOpen] = useState(false);
  const [suspBankAccountId, setSuspBankAccountId] = useState<string>('');
  const [suspAmount, setSuspAmount] = useState<string>('');
  const [suspReceivedDate, setSuspReceivedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [suspPayerInfo, setSuspPayerInfo] = useState<string>('');
  const [suspNotes, setSuspNotes] = useState<string>('');

  // 免開票應收單 後續補開／自主開立繳稅 Modal 狀態
  const [postInvTargetAr, setPostInvTargetAr] = useState<AccountReceivable | null>(null);
  const [postInvMode, setPostInvMode] = useState<'DELIVERED' | 'SELF_RETAINED'>('DELIVERED');
  const [postInvFormat, setPostInvFormat] = useState<'THREE_PART' | 'TWO_PART'>('THREE_PART');
  const [postInvCompanyId, setPostInvCompanyId] = useState<string>('COMP-01');
  const [postInvTaxType, setPostInvTaxType] = useState<'TAX_INCLUSIVE' | 'TAX_EXCLUSIVE'>('TAX_INCLUSIVE');
  const [postInvAmount, setPostInvAmount] = useState<string>('');
  const [postInvNumber, setPostInvNumber] = useState<string>('');
  const [postInvDate, setPostInvDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [postInvExtraTaxAr, setPostInvExtraTaxAr] = useState<boolean>(false);

  // 會計手動補登統一發票 Modal 狀態
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);
  const [invTargetCompanyId, setInvTargetCompanyId] = useState<string>('COMP-01');
  const [invType, setInvType] = useState<'INPUT' | 'OUTPUT'>('INPUT');
  const [invFormat, setInvFormat] = useState<'THREE_PART' | 'TWO_PART'>('THREE_PART');
  const [invIssueMode, setInvIssueMode] = useState<'DELIVERED' | 'SELF_RETAINED'>('DELIVERED');
  const [invProjectId, setInvProjectId] = useState<string>('');
  const [invNumber, setInvNumber] = useState<string>('');
  const [invDate, setInvDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [invPartnerId, setInvPartnerId] = useState<string>('');
  const [invPartnerTaxId, setInvPartnerTaxId] = useState<string>('');
  const [invPartnerName, setInvPartnerName] = useState<string>('');
  const [invTaxType, setInvTaxType] = useState<'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT'>('TAX_EXCLUSIVE');
  const [invBaseAmount, setInvBaseAmount] = useState<string>('');
  const [invManualTax, setInvManualTax] = useState<string>('');

  // 重新載入資料庫
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

  // 讀取全域法定營業稅率、容差、排程日與老闆私帳政策參數
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

  // 依優先序解析開票／付款排程日：銀行專戶專屬 > 法人公司設定 > 系統中樞全域設定
  const resolveScheduleInfo = (companyId?: string, bankAccountId?: string) => {
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
  };

  // 嚴格公司別與老闆私帳判定工具 (零跨公司外洩)
  const isBossPrivateAccount = (b: CompanyBankAccount): boolean =>
    Boolean(b.isVirtualAccount) || b.companyId === 'BOSS-01';

  const getEligibleBanks = (companyId: string, allowBossPrivate: boolean): CompanyBankAccount[] => {
    const activeOwn = bankAccounts.filter(b =>
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
  };

  const getAllowedPaymentMethods = (eligibleBanks: CompanyBankAccount[]) => ({
    canCheck: eligibleBanks.some(b => b.supportsCheck !== false),
    canTT: eligibleBanks.some(b => b.supportsTransfer !== false),
    canCash: true,
  });

  const filterBanksForMethod = (eligibleBanks: CompanyBankAccount[], method: 'CHECK' | 'TT' | 'CASH'): CompanyBankAccount[] => {
    if (method === 'CASH') return [];
    if (method === 'CHECK') return eligibleBanks.filter(b => b.supportsCheck !== false);
    return eligibleBanks.filter(b => b.supportsTransfer !== false);
  };

  // 🛡️ 應收款收款銀行專戶嚴格防呆規則：
  // 1. 有開發票（交付業主）➔ 僅限開票法人自身之「非虛擬實體銀行戶」（或公司現金）；嚴禁老闆私帳、嚴禁其他公司帳戶
  // 2. 免開發票（或自主自留報稅）➔ 可進老闆私人戶 (BOSS-01 / 虛擬戶)、現金或該公司帳戶（嚴禁其他法人公司）
  const getEligibleReceivingBanks = (
    arCompanyId: string,
    hasInvoice: boolean,
    issueMode?: 'DELIVERED' | 'SELF_RETAINED'
  ): CompanyBankAccount[] => {
    const ownRealBanks = bankAccounts.filter(
      b => b.status === 'ACTIVE' && b.companyId === arCompanyId && !isBossPrivateAccount(b)
    );
    if (hasInvoice && issueMode !== 'SELF_RETAINED') {
      return ownRealBanks;
    }
    const bossBanks = bankAccounts.filter(b => b.status === 'ACTIVE' && isBossPrivateAccount(b));
    const seen = new Set(bossBanks.map(b => b.id));
    return [...bossBanks, ...ownRealBanks.filter(b => !seen.has(b.id))];
  };

  // 已授權營運法人清單 (含未來各公司獨立會計／出納分權隔離)
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

  // -------------------------------------------------------------
  // 核心統計指標 (KPIs & Cash Radar)
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    // 待對帳進貨單 (水池沉澱，尚未勾稽請款)
    const pendingReceipts = inboundReceipts.filter(
      r => r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED' && matchesCompanyScope(r.companyId)
    );
    const pendingInboundTotal = pendingReceipts.reduce((sum, r) => sum + r.totalAmount, 0);

    // 已對帳未放款應付水位 (APPROVED 狀態)
    const approvedRecsScoped = reconciliations.filter(r => r.status === 'APPROVED' && matchesCompanyScope(r.companyId));
    const pendingApTotal = approvedRecsScoped.reduce((sum, r) => sum + r.netPayableAmount, 0);

    // 銀行存摺真實可用總餘額 (實體帳戶加總，依法人篩選)
    const realBankAccounts = bankAccounts.filter(
      b => !b.isVirtualAccount && b.status === 'ACTIVE' && matchesCompanyScope(b.companyId)
    );
    const realBankBalance = realBankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);

    // 老闆口袋代墊專戶餘額
    const bossAccount = bankAccounts.find(b => b.isVirtualAccount);
    const bossBalance = bossAccount ? bossAccount.currentBalance : 0;

    // 未兌現支票總額 (黃燈期票 ISSUED)
    const unclearedChecks = checks.filter(
      c => c.status === 'ISSUED' && c.type === 'PAYABLE' && matchesCompanyScope(c.companyId)
    );
    const unclearedChecksTotal = unclearedChecks.reduce((sum, c) => sum + c.amount, 0);

    // 待釐清未知暫收款
    const pendingSuspense = suspenses.filter(s => !s.isAllocated && matchesCompanyScope(s.companyId));
    const pendingSuspenseTotal = pendingSuspense.reduce((sum, s) => sum + s.amount, 0);

    // 預測可用現金淨水位
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
  }, [inboundReceipts, reconciliations, bankAccounts, checks, suspenses, financeCompanyScope, authorizedCorpIds]);

  // -------------------------------------------------------------
  // 廠商未結水池彙總 (按廠商分組，亮起「待請款」琥珀色標籤)
  // -------------------------------------------------------------
  const vendorPoolList = useMemo(() => {
    const pendingReceipts = inboundReceipts.filter(
      r => r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED' && matchesCompanyScope(r.companyId)
    );
    const map: Record<string, {
      vendorId: string;
      vendorName: string;
      vendorTaxId?: string;
      bankFeePayer: string;
      paymentTermsDays: number;
      paymentMethodNotes: string;
      receipts: InboundReceipt[];
      totalAmount: number;
    }> = {};

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
  }, [inboundReceipts, partners, financeCompanyScope, authorizedCorpIds]);

  // 退回重算、暫存草稿、已送出納待放款與重複請款偵測
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

  // 開啟建立對帳單 Modal（會計作業：對帳廠商依來源單據鎖定，僅核對發票／稅額／買受法人）
  const handleOpenCreateRecModal = (vendorId?: string) => {
    const targetVId = vendorId || (vendorPoolList.length > 0 ? vendorPoolList[0].vendorId : '');
    if (!targetVId) {
      onNotify('目前待對帳大水池尚無待請款進貨簽收單', 'warn');
      return;
    }
    setEditingRecId(null);
    setEditingReturnedReason(null);
    setRecTargetVendorId(targetVId);
    setRecVendorLocked(Boolean(vendorId) || vendorPoolList.length <= 1);

    // 預設全選該廠商的所有待對帳單據
    const vPending = inboundReceipts.filter(r => r.vendorId === targetVId && r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED');
    setRecSelectedReceiptIds(vPending.map(r => r.id));

    setRecDiscountAmount(0);
    const bp = partners.find(p => p.id === targetVId);
    const nextHasInvoice = bp?.hasInvoice !== false;
    const nextTaxType: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT' = nextHasInvoice ? 'TAX_EXCLUSIVE' : 'TAX_EXEMPT';
    setRecHasInvoice(nextHasInvoice);
    setRecTaxType(nextTaxType);
    setRecManualTax('');
    setRecInvoiceNumber('');
    setRecBillingPeriod(new Date().toISOString().slice(0, 7));
    setRecNotes('');
    setRecIsBossAdvance(false);
    setRecReceiptCompanyFilter('ALL');

    // 買受／立帳法人公司：優先以進貨單案場歸屬公司 -> 廠商關聯公司 -> 第一間公司
    const receiptCompanyId = vPending.find(r => r.companyId)?.companyId;
    const preferredCompanyId = receiptCompanyId || bp?.companyId || (companies.length > 0 ? companies[0].id : 'COMP-01');
    setRecCompanyId(preferredCompanyId);
    setRecPaymentTermNotes(bp?.paymentMethodNotes?.trim() || '');

    setIsCreateRecModalOpen(true);
  };

  // 開啟編輯／重算既有對帳單 Modal（適用於草稿 DRAFT 或被出納退回重算 RETURNED 之單據）
  const handleOpenEditRecModal = (rec: AccountsPayableReconciliation) => {
    setEditingRecId(rec.id);
    setEditingReturnedReason(rec.status === 'RETURNED' ? (rec.returnedReason || '出納退回要求重算修正') : null);
    setRecTargetVendorId(rec.vendorId);
    setRecVendorLocked(true);

    const attachedIds = (rec.receiptIds && rec.receiptIds.length > 0)
      ? rec.receiptIds
      : inboundReceipts.filter(r => r.reconciliationId === rec.id).map(r => r.id);
    setRecSelectedReceiptIds(attachedIds);

    const nextTaxType = rec.taxType || 'TAX_EXCLUSIVE';
    const editBase = Math.max(0, (rec.inboundTotalAmount || 0) - (rec.discountAmount || 0));
    const editAutoTax = nextTaxType === 'TAX_EXCLUSIVE'
      ? Math.round(editBase * taxRate)
      : nextTaxType === 'TAX_INCLUSIVE'
      ? Math.round(editBase - editBase / (1 + taxRate))
      : 0;
    const isCustomManualTax = nextTaxType !== 'TAX_EXEMPT' && rec.taxAmount !== undefined && rec.taxAmount !== editAutoTax;

    setRecDiscountAmount(rec.discountAmount || 0);
    setRecHasInvoice(rec.hasInvoice !== false);
    setRecTaxType(nextTaxType);
    setRecManualTax(isCustomManualTax ? String(rec.taxAmount) : '');
    setRecInvoiceNumber(rec.invoiceNumber === 'NONE' || rec.invoiceNumber === 'PENDING_NEXT' ? '' : (rec.invoiceNumber || ''));
    setRecBillingPeriod(rec.billingPeriod || new Date().toISOString().slice(0, 7));
    setRecNotes(rec.notes || '');
    setRecIsBossAdvance(Boolean(rec.isBossAdvance));
    setRecReceiptCompanyFilter('ALL');
    setRecCompanyId(rec.companyId || 'COMP-01');
    setRecPaymentTermNotes(rec.paymentTermNotes || '');

    setIsCreateRecModalOpen(true);
  };

  // 當選定廠商切換時，連動重設待選單據與買受法人公司
  const handleVendorChangeInModal = (vId: string) => {
    setRecTargetVendorId(vId);
    const vPending = inboundReceipts.filter(r => r.vendorId === vId && r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED');
    setRecSelectedReceiptIds(vPending.map(r => r.id));

    const bp = partners.find(p => p.id === vId);
    const nextHasInvoice = bp?.hasInvoice !== false;
    const nextTaxType: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT' = nextHasInvoice ? 'TAX_EXCLUSIVE' : 'TAX_EXEMPT';
    setRecHasInvoice(nextHasInvoice);
    setRecTaxType(nextTaxType);
    setRecManualTax('');
    setRecIsBossAdvance(false);

    const receiptCompanyId = vPending.find(r => r.companyId)?.companyId;
    const preferredCompanyId = receiptCompanyId || bp?.companyId || (companies.length > 0 ? companies[0].id : 'COMP-01');
    setRecCompanyId(preferredCompanyId);
    setRecPaymentTermNotes(bp?.paymentMethodNotes?.trim() || '');
  };

  // 切換買受／立帳法人公司
  const handleRecCompanyChange = (cId: string) => {
    setRecCompanyId(cId);
  };

  // 對帳單試算金額計算（同步讀取系統設定中樞 TAX_RATE 法定稅率，支援手動微調稅額與容差防呆）
  const recCalculations = useMemo(() => {
    const selectedReceipts = inboundReceipts.filter(r => recSelectedReceiptIds.includes(r.id));
    const inboundTotal = selectedReceipts.reduce((sum, r) => sum + r.totalAmount, 0);
    const discount = Math.max(0, recDiscountAmount || 0);

    const baseAmount = Math.max(0, inboundTotal - discount);
    let autoTax = 0;
    if (recTaxType === 'TAX_EXCLUSIVE') {
      autoTax = Math.round(baseAmount * taxRate);
    } else if (recTaxType === 'TAX_INCLUSIVE') {
      autoTax = Math.round(baseAmount - (baseAmount / (1 + taxRate)));
    } else {
      autoTax = 0;
    }

    // 手動覆寫稅額與容差檢驗（免稅模式強制為 0，避免殘留手動輸入值）
    const parsedManual = recManualTax.trim() !== '' ? Number(recManualTax) : NaN;
    const finalTax = recTaxType === 'TAX_EXEMPT'
      ? 0
      : (Number.isFinite(parsedManual) ? Math.max(0, Math.round(parsedManual)) : autoTax);
    const taxDiff = recTaxType === 'TAX_EXEMPT' ? 0 : Math.abs(finalTax - autoTax);
    const isTaxToleranceValid = taxDiff <= taxTolerance;

    let netPayable = 0;
    let netExclusiveAmount = baseAmount;
    if (recTaxType === 'TAX_EXCLUSIVE') {
      netExclusiveAmount = baseAmount;
      netPayable = baseAmount + finalTax;
    } else if (recTaxType === 'TAX_INCLUSIVE') {
      netPayable = baseAmount;
      netExclusiveAmount = Math.max(0, baseAmount - finalTax);
    } else {
      netExclusiveAmount = baseAmount;
      netPayable = baseAmount;
    }

    return {
      selectedReceipts,
      inboundTotal,
      discount,
      autoTax,
      finalTax,
      taxDiff,
      isTaxToleranceValid,
      netExclusiveAmount,
      netPayable,
    };
  }, [inboundReceipts, recSelectedReceiptIds, recDiscountAmount, recTaxType, recManualTax, taxTolerance, taxRate]);

  // 儲存/覆核應付對帳單（支援新建與重算編輯兩種模式，內建防連點鎖定）
  const handleSaveReconciliation = (isApproved: boolean, openPaymentAfter: boolean = false) => {
    if (isSavingRec) return;
    if (!recTargetVendorId) {
      onNotify('請先選擇廠商', 'error');
      return;
    }
    if (recSelectedReceiptIds.length === 0) {
      onNotify('請至少勾選一筆進貨簽收單進行對帳', 'warn');
      return;
    }
    if (!recCalculations.isTaxToleranceValid) {
      onNotify(`發票手動稅額與系統試算差異 (NT$ ${recCalculations.taxDiff}) 超過法定容差 ±${taxTolerance} 元，系統已阻斷存檔！`, 'error');
      return;
    }

    const targetPartner = partners.find(p => p.id === recTargetVendorId);
    const vendorName = targetPartner?.name || '未知廠商';
    const isNoInv = !recHasInvoice || recTaxType === 'TAX_EXEMPT';
    const isBossAdvFlag = Boolean(bossInvoicePolicy === 'ALLOW_BOSS_ADVANCE' && !isNoInv && recIsBossAdvance);
    // 依廠商約定付款天數產生初始帳務參考日，實際開票到期日由出納選擇支票時設定
    const effectiveDueDate = computeTermsPaymentDate(targetPartner?.paymentTermsDays || 30);
    const payload = {
      companyId: recCompanyId,
      vendorId: recTargetVendorId,
      vendorName,
      billingPeriod: recBillingPeriod,
      inboundTotalAmount: recCalculations.inboundTotal,
      discountAmount: recCalculations.discount,
      taxType: recTaxType,
      taxAmount: recCalculations.finalTax,
      netPayableAmount: recCalculations.netPayable,
      invoiceNumber: recInvoiceNumber.trim() || (recHasInvoice ? 'PENDING_NEXT' : 'NONE'),
      hasInvoice: recHasInvoice,
      paymentDueDate: effectiveDueDate,
      status: (isApproved ? 'APPROVED' : 'DRAFT') as AccountsPayableReconciliation['status'],
      notes: recNotes,
      receiptIds: recSelectedReceiptIds,
      paymentTermNotes: recPaymentTermNotes.trim() || undefined,
      isBossAdvance: isBossAdvFlag,
    };

    setIsSavingRec(true);
    try {
      const savedRec = editingRecId
        ? updateApReconciliation(editingRecId, payload, currentUser?.fullName || '會計專員')
        : createApReconciliation(
            {
              ...payload,
              reconciliationNumber: `REC-${recBillingPeriod.replace('-', '')}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
            },
            currentUser?.fullName || '會計專員'
          );

      const wasEditing = Boolean(editingRecId);
      setIsCreateRecModalOpen(false);
      setEditingRecId(null);
      setEditingReturnedReason(null);
      loadAllFinanceData();

      if (isApproved && openPaymentAfter && canEditCashier) {
        onNotify(`✅ 對帳單【${savedRec.reconciliationNumber}】已完成${wasEditing ? '重算並' : ''}核准立帳，已為您開啟出納付款單！`, 'success');
        handleOpenPaymentModal(savedRec);
      } else {
        onNotify(
          `✅ 對帳單【${savedRec.reconciliationNumber}】已成功${wasEditing ? '重算更新並' : ''}${isApproved ? '核准立帳（已拋轉至出納待放款清冊）' : '儲存為草稿（保留於上方待辦大水池）'}！`,
          'success'
        );
      }
    } catch (e: any) {
      onNotify(`❌ 對帳單儲存失敗：${e.message}`, 'error');
    } finally {
      setIsSavingRec(false);
    }
  };

  // 出納退回對帳單請會計重算
  const handleConfirmReturnToAccounting = () => {
    if (!returnModalTargetRec) return;
    if (!returnReasonText.trim()) {
      onNotify('請填寫退回會計重算的具體原因，方便會計核對修正', 'warn');
      return;
    }
    try {
      returnApReconciliationToAccounting(
        returnModalTargetRec.id,
        returnReasonText,
        currentUser?.fullName || '出納專員'
      );
      onNotify(`↩️ 已將對帳單【${returnModalTargetRec.reconciliationNumber}】退回會計大水池重算！`, 'warn');
      if (isPaymentModalOpen && selectedRecForPayment?.id === returnModalTargetRec.id) {
        setIsPaymentModalOpen(false);
        setSelectedRecForPayment(null);
      }
      setReturnModalTargetRec(null);
      setReturnReasonText('');
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`退回失敗：${e.message}`, 'error');
    }
  };

  // 作廢對帳單 (回滾釋放進貨單回水池)
  const handleConfirmVoidReconciliation = () => {
    if (!voidModalTargetId) return;
    if (!voidReasonText.trim()) {
      onNotify('請填寫作廢原因以保留稽核紀錄', 'warn');
      return;
    }

    try {
      voidApReconciliation(voidModalTargetId, voidReasonText, currentUser?.fullName || '會計專員');
      setVoidModalTargetId(null);
      setVoidReasonText('');
      onNotify('🛡️ 對帳單已成功作廢！所屬進貨簽收單已安全回滾釋放回待對帳大水池。', 'success');
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`作廢失敗：${e.message}`, 'error');
    }
  };

  // 同步出納放款頁之合法付款方式與出款銀行帳戶 (嚴格遵守買受公司＋無發票／特例私帳政策)
  const syncPaySelectionForRec = (
    rec: AccountsPayableReconciliation,
    allowBossPrivate: boolean,
    preferredMethod?: 'CHECK' | 'TT' | 'CASH',
    preferredBankId?: string
  ) => {
    const eligible = getEligibleBanks(rec.companyId, allowBossPrivate);
    const allowed = getAllowedPaymentMethods(eligible);

    let targetMethod: 'CHECK' | 'TT' | 'CASH' =
      preferredMethod ||
      rec.designatedPaymentMethod ||
      (allowed.canCheck ? 'CHECK' : allowed.canTT ? 'TT' : 'CASH');

    if (targetMethod === 'CHECK' && !allowed.canCheck) {
      targetMethod = allowed.canTT ? 'TT' : 'CASH';
    } else if (targetMethod === 'TT' && !allowed.canTT) {
      targetMethod = allowed.canCheck ? 'CHECK' : 'CASH';
    }
    if (!allowed.canCheck && !allowed.canTT) {
      targetMethod = 'CASH';
    }

    const methodBanks = filterBanksForMethod(eligible, targetMethod);
    const matchedBank = preferredBankId ? methodBanks.find(b => b.id === preferredBankId) : undefined;
    const targetBank = targetMethod === 'CASH' ? undefined : (matchedBank || methodBanks[0]);
    const targetBankId = targetMethod === 'CASH' ? 'CASH' : (targetBank?.id || '');

    setPayMethod(targetMethod);
    setPayBankAccountId(targetBankId);

    if (targetMethod === 'CHECK' && targetBank) {
      const prefix = targetBank.checkPrefix || 'CQ';
      const nextSeq = targetBank.nextCheckNumber || 1001;
      const digits = targetBank.checkDigits || 6;
      const fallbackCheckNo = `${prefix}-${String(nextSeq).padStart(digits, '0')}`;
      const prefilledCheckNo = (rec.designatedCheckNumber && rec.designatedBankAccountId === targetBank.id)
        ? rec.designatedCheckNumber
        : fallbackCheckNo;
      setPayCheckNumber(prefilledCheckNo);
      setPayFeeAmount(0);
    } else {
      setPayCheckNumber('');
      setPayFeeAmount(targetMethod === 'TT' ? 30 : 0);
    }

    return { targetMethod, targetBankId };
  };

  // 開啟放款出金 Modal (出納專屬：依立帳買受公司擇定付款方式、銀行帳戶、支票票號與支票到期日)
  const handleOpenPaymentModal = (rec: AccountsPayableReconciliation) => {
    setSelectedRecForPayment(rec);
    const bp = partners.find(p => p.id === rec.vendorId);

    const feePayer = bp?.bankFeePayer || 'COMPANY';
    setPayIsFeeAbsorbed(feePayer === 'COMPANY');

    const initBossAdvance = Boolean(rec.isBossAdvance);
    setPayIsBossAdvance(initBossAdvance);

    const isNoInv = !rec.hasInvoice || rec.taxType === 'TAX_EXEMPT';
    const allowBoss = isNoInv || (bossInvoicePolicy === 'ALLOW_BOSS_ADVANCE' && initBossAdvance) || initBossAdvance;

    const { targetMethod, targetBankId } = syncPaySelectionForRec(
      rec,
      allowBoss,
      rec.designatedPaymentMethod,
      rec.designatedBankAccountId
    );

    if (targetMethod === 'CHECK') {
      if (rec.designatedPaymentMethod === 'CHECK' && rec.paymentDueDate) {
        setPayCheckDueDate(rec.paymentDueDate);
      } else {
        const { days } = resolveScheduleInfo(rec.companyId, targetBankId === 'CASH' ? undefined : targetBankId);
        setPayCheckDueDate(pickNearestScheduleDate(days));
      }
    } else {
      setPayCheckDueDate(rec.paymentDueDate || formatLocalYmd(new Date()));
    }

    setPayDeductionAmount(0);
    setPayDeductionNote('');
    setPayNotes(
      `${rec.bouncedCheckNumber ? `[退票重付 原票 ${rec.bouncedCheckNumber}] ` : ''}沖銷應付對帳單 [${rec.reconciliationNumber}] ${rec.paymentTermNotes ? `(${rec.paymentTermNotes})` : ''}`
    );
    setIsPaymentModalOpen(true);
  };

  // 變更出款銀行帳戶時，自動連動支票連續號碼與該專戶預設開票排程日
  const handleBankChangeInPayment = (bId: string) => {
    setPayBankAccountId(bId);
    const targetBank = bankAccounts.find(b => b.id === bId);
    if (targetBank && payMethod === 'CHECK') {
      const prefix = targetBank.checkPrefix || 'CQ';
      const nextSeq = targetBank.nextCheckNumber || 1001;
      const digits = targetBank.checkDigits || 6;
      setPayCheckNumber(`${prefix}-${String(nextSeq).padStart(digits, '0')}`);
      if (selectedRecForPayment) {
        const { days } = resolveScheduleInfo(selectedRecForPayment.companyId, bId);
        setPayCheckDueDate(pickNearestScheduleDate(days));
      }
    }
  };

  // 變更支付方式時，連動合法銀行帳戶、票號、支票到期日與手續費防呆隔離
  const handlePayMethodChange = (method: 'TT' | 'CHECK' | 'CASH') => {
    if (!selectedRecForPayment) return;
    const isNoInv = !selectedRecForPayment.hasInvoice || selectedRecForPayment.taxType === 'TAX_EXEMPT';
    const allowBoss = isNoInv || Boolean(selectedRecForPayment.isBossAdvance) || (bossInvoicePolicy === 'ALLOW_BOSS_ADVANCE' && payIsBossAdvance);
    const { targetMethod, targetBankId } = syncPaySelectionForRec(selectedRecForPayment, allowBoss, method, payBankAccountId);
    if (targetMethod === 'CHECK') {
      const { days } = resolveScheduleInfo(selectedRecForPayment.companyId, targetBankId === 'CASH' ? undefined : targetBankId);
      setPayCheckDueDate(pickNearestScheduleDate(days));
    }
  };

  // 放款金額與四柱沖銷計算 (跨行手續費僅轉帳生效，支票與現金手續費為 0 防呆；公司外加吸收不影響 AP 沖銷平衡)
  const paymentCalculations = useMemo(() => {
    if (!selectedRecForPayment) return { expectedTotal: 0, actualDisburse: 0, isBalanced: false, fee: 0, deduction: 0 };
    const expectedTotal = selectedRecForPayment.netPayableAmount;
    const deduction = Math.max(0, payDeductionAmount || 0);

    // 只有在電匯/轉帳 (TT) 時才有手續費，現金 (CASH) 或支票 (CHECK) 手續費絕對為 0 (防呆)
    const effectiveFee = payMethod === 'TT' ? Math.max(0, payFeeAmount || 0) : 0;

    // 實付 = 應付期望 - 粉紅代扣款
    let actualDisburse = Math.max(0, expectedTotal - deduction);

    // 內扣模式：匯費從實付中扣除 (廠商吸收)
    if (payMethod === 'TT' && !payIsFeeAbsorbed) {
      actualDisburse = Math.max(0, actualDisburse - effectiveFee);
    }

    // 四柱平衡校驗：
    // - 廠商吸收匯費時：實付 + 廠商內扣匯費 + 代扣 = 應付總額
    // - 公司外加吸收或非電匯時：實付 + 代扣 = 應付總額 (公司額外支出之銀行匯費另計營業費用，不計入沖銷 AP 差額)
    const testSum = payMethod === 'TT' && !payIsFeeAbsorbed
      ? actualDisburse + effectiveFee + deduction
      : actualDisburse + deduction;
    const isBalanced = Math.abs(testSum - expectedTotal) <= 1;

    return {
      expectedTotal,
      actualDisburse,
      isBalanced,
      fee: effectiveFee,
      deduction,
    };
  }, [selectedRecForPayment, payDeductionAmount, payIsFeeAbsorbed, payFeeAmount, payMethod]);

  // 確認放款過帳
  const handleConfirmPayment = () => {
    if (!selectedRecForPayment) return;
    if (payMethod !== 'CASH' && (!payBankAccountId || payBankAccountId === 'CASH')) {
      onNotify('請選擇合法的出款銀行專戶，或改為現金支付！', 'warn');
      return;
    }
    const selectedBank = payMethod === 'CASH' ? undefined : bankAccounts.find(b => b.id === payBankAccountId);
    const bp = partners.find(p => p.id === selectedRecForPayment.vendorId);

    // 廠商帳號異動鎖定防線 (Rule 7.5)
    if (bp?.isHighRisk) {
      onNotify(`⚠️ 廠商【${bp.name}】處於高風險鎖定狀態，需由管理主管核可後方得放款！`, 'error');
      return;
    }

    const payNo = `PAY-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const isBossAdvPay = Boolean(
      payIsBossAdvance ||
      selectedRecForPayment.isBossAdvance ||
      (selectedBank && isBossPrivateAccount(selectedBank))
    );

    try {
      const lineItems: PaymentLineItem[] = [
        {
          id: `PLI-${Date.now()}-1`,
          paymentId: '',
          sourceType: 'AP',
          sourceId: selectedRecForPayment.id,
          sourceNumber: selectedRecForPayment.reconciliationNumber,
          itemType: 'STANDARD',
          appliedAmount: paymentCalculations.actualDisburse,
          feeAmount: paymentCalculations.fee,
          isFeeAbsorbedByCompany: payIsFeeAbsorbed,
          discountAmount: 0,
          notes: payNotes,
        }
      ];

      // 若有粉紅代扣款，加入減項明細
      if (payDeductionAmount > 0) {
        lineItems.push({
          id: `PLI-${Date.now()}-2`,
          paymentId: '',
          sourceType: 'EXP',
          sourceId: selectedRecForPayment.id,
          sourceNumber: `DED-${selectedRecForPayment.reconciliationNumber}`,
          itemType: 'DEDUCTION',
          appliedAmount: payDeductionAmount,
          feeAmount: 0,
          isFeeAbsorbedByCompany: true,
          discountAmount: 0,
          offsetExpenseId: 'EXP-SITE-OFFSET',
          notes: payDeductionNote || '工務代墊現場扣款還原',
        });
      }

      createPaymentRecord(
        {
          paymentNo: payNo,
          companyId: selectedRecForPayment.companyId,
          currency: 'TWD',
          bankAccountId: payMethod === 'CASH' ? 'CASH' : payBankAccountId,
          bankAccountName: payMethod === 'CASH' ? '公司現金櫃檯 / 零用金' : (selectedBank?.bankName || '公司帳戶'),
          partnerId: selectedRecForPayment.vendorId,
          partnerName: selectedRecForPayment.vendorName,
          paymentMethod: payMethod,
          isReversal: false,
          isBossAdvance: isBossAdvPay,
          documentDate: formatLocalYmd(new Date()),
          postingDate: formatLocalYmd(new Date()),
          totalAmount: paymentCalculations.actualDisburse,
          status: 'POSTED',
          isReconciled: false,
          notes: payNotes,
          lineItems,
          checkNumber: payMethod === 'CHECK' ? payCheckNumber : undefined,
          checkDueDate: payMethod === 'CHECK' ? payCheckDueDate : undefined,
          drawerBank: selectedBank?.bankName,
          replacesCheckNumber: payMethod === 'CHECK' ? selectedRecForPayment.bouncedCheckNumber : undefined,
        },
        currentUser?.fullName || '李出納專員'
      );

      setIsPaymentModalOpen(false);
      onNotify(
        `✅ 付款單【${payNo}】已完成放款過帳！${
          payMethod === 'CHECK'
            ? `已開立黃燈期票 [${payCheckNumber}]。`
            : payMethod === 'CASH'
            ? '已記錄現金出金結清。'
            : '已由實體銀行存款扣除。'
        }`,
        'success'
      );
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`放款失敗：${e.message}`, 'error');
    }
  };

  // 認領未知暫收款（支援大水池分批拆沖，剩餘金額自動留存待認領）
  const handleAllocateSuspense = (susp: SuspenseReceipt, arId: string, customAllocAmt?: number): boolean => {
    if (!arId) {
      onNotify('請先選擇要認領沖銷的應收請款單', 'warn');
      return false;
    }
    try {
      const suspRem = susp.remainingAmount ?? (susp.isAllocated ? 0 : susp.amount);
      const targetAr = arList.find(a => a.id === arId);
      const expectedApply = customAllocAmt && customAllocAmt > 0
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

  // -------------------------------------------------------------
  // 應收請款 (AR)、出納收款、未知暫收登錄與公司發票主檔處理函式
  // -------------------------------------------------------------
  const arTaxPreview = useMemo(() => {
    if (arUseMultiLine && arMultiLines.length > 0) {
      let netSum = 0;
      let taxSum = 0;
      let totalSum = 0;
      for (const l of arMultiLines) {
        const raw = Math.max(0, Number(l.amount || 0));
        if (!arHasInvoice || l.taxMode === 'TAX_EXEMPT') {
          netSum += raw;
          totalSum += raw;
        } else if (l.taxMode === 'TAX_EXCLUSIVE') {
          const t = Math.round(raw * taxRate);
          netSum += raw;
          taxSum += t;
          totalSum += raw + t;
        } else {
          const t = Math.round(raw - raw / (1 + taxRate));
          const n = Math.max(0, raw - t);
          netSum += n;
          taxSum += t;
          totalSum += raw;
        }
      }
      const finalTax = !arHasInvoice ? 0 : arManualTax.trim() !== '' ? Math.max(0, Number(arManualTax) || 0) : taxSum;
      const total = netSum + finalTax;
      return { base: netSum, autoTax: taxSum, finalTax, total, netAmt: netSum };
    }
    const base = Math.max(0, Number(arBaseAmount || 0));
    let autoTax = 0;
    if (!arHasInvoice || arTaxType === 'TAX_EXEMPT') {
      autoTax = 0;
    } else if (arTaxType === 'TAX_EXCLUSIVE') {
      autoTax = Math.round(base * taxRate);
    } else {
      autoTax = Math.round(base - base / (1 + taxRate));
    }
    const finalTax = (!arHasInvoice || arTaxType === 'TAX_EXEMPT')
      ? 0
      : (arManualTax.trim() !== '' ? Math.max(0, Number(arManualTax) || 0) : autoTax);
    const total = (!arHasInvoice || arTaxType === 'TAX_EXEMPT')
      ? base
      : arTaxType === 'TAX_EXCLUSIVE'
      ? base + finalTax
      : base;
    const netAmt = (!arHasInvoice || arTaxType === 'TAX_EXEMPT')
      ? base
      : arTaxType === 'TAX_EXCLUSIVE'
      ? base
      : Math.max(0, base - finalTax);
    return { base, autoTax, finalTax, total, netAmt };
  }, [arUseMultiLine, arMultiLines, arBaseAmount, arHasInvoice, arTaxType, arManualTax, taxRate]);

  const resolveProjectArContract = (proj?: Project, fallbackCompanyId?: string) => {
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
  };

  const handleOpenCreateArModal = (prefillSuspense?: SuspenseReceipt) => {
    const allowedProjects = projects.filter(p => {
      if (p.isDeleted || p.id === 'PRJ-INTERNAL') return false;
      const isUnassigned = !p.companyId || p.companyId === 'UNASSIGNED';
      if (!isUnassigned && authorizedCorpIds.size > 0 && !authorizedCorpIds.has(p.companyId)) return false;
      if (prefillSuspense && prefillSuspense.companyId !== 'BOSS-01') {
        return isUnassigned || p.companyId === prefillSuspense.companyId;
      }
      return true;
    });

    const preferredScopeCompId =
      prefillSuspense && prefillSuspense.companyId !== 'BOSS-01'
        ? prefillSuspense.companyId
        : financeCompanyScope !== 'ALL'
        ? financeCompanyScope
        : authorizedCorps[0]?.id || 'COMP-01';

    const matchingProj =
      allowedProjects.find(p => p.companyId === preferredScopeCompId) ||
      allowedProjects[0];

    const contract = resolveProjectArContract(matchingProj, preferredScopeCompId);
    const suspRemainingAmt = prefillSuspense
      ? (prefillSuspense.remainingAmount ?? (prefillSuspense.isAllocated ? 0 : prefillSuspense.amount))
      : 0;

    setPendingClaimSuspense(prefillSuspense || null);
    setArProjectId(matchingProj?.id || '');
    setArCompanyId(contract.companyId || preferredScopeCompId);
    setArCustomerId(contract.customerId);
    setArTitle(prefillSuspense ? `暫收認領請款 (${prefillSuspense.payerInfo.slice(0, 20)})` : '工程進度款請款');
    setArBaseAmount(prefillSuspense ? String(suspRemainingAmt) : '');
    const suspBank = prefillSuspense ? bankAccounts.find(b => b.id === prefillSuspense.bankAccountId) : undefined;
    const isSuspBoss = prefillSuspense ? (prefillSuspense.companyId === 'BOSS-01' || Boolean(suspBank && isBossPrivateAccount(suspBank))) : false;
    const hasEightDigitTax = /^\d{8}$/.test((contract.customerTaxId || '').trim());
    const initFormat: 'THREE_PART' | 'TWO_PART' = hasEightDigitTax ? 'THREE_PART' : 'TWO_PART';
    setArHasInvoice(!isSuspBoss);
    setArInvoiceFormat(initFormat);
    setArTaxType(isSuspBoss ? 'TAX_EXEMPT' : (initFormat === 'TWO_PART' ? 'TAX_INCLUSIVE' : 'TAX_EXCLUSIVE'));
    setArManualTax('');
    setArInvoiceNumber('');
    setArInvoiceDate(formatLocalYmd(new Date()));
    setArDueDate(computeTermsPaymentDate(30));
    setArNotes(prefillSuspense ? `配合暫收款 [${prefillSuspense.id}] 查明認領開單` : '');
    setArUseMultiLine(false);
    setArMultiLines([
      { id: `LI-${Date.now()}-1`, itemName: matchingProj?.name || '第一期工程款', amount: '', taxMode: !isSuspBoss ? 'TAX_EXCLUSIVE' : 'TAX_EXEMPT' },
    ]);
    setIsCreateArModalOpen(true);
  };

  const handleSaveAccountsReceivable = (immediatelyCollect: boolean = false) => {
    const proj = projects.find(p => p.id === arProjectId);
    if (!proj) {
      onNotify('請選擇工程專案案場', 'warn');
      return;
    }
    const contract = resolveProjectArContract(proj, arCompanyId);
    if (!contract.companyId || !canEditArFor(contract.companyId)) {
      onNotify('您沒有權限開立該案場承攬公司之應收請款單', 'error');
      return;
    }
    if (arTaxPreview.total <= 0) {
      onNotify('請輸入大於 0 的請款金額', 'warn');
      return;
    }
    if (arHasInvoice && !arInvoiceNumber.trim()) {
      onNotify('勾選「需開立銷項發票」時，請填入銷項發票字軌號碼（或改選免開發票）', 'warn');
      return;
    }

    const builtLineItems: ArLineItem[] | undefined =
      arUseMultiLine && arMultiLines.length > 0
        ? arMultiLines
            .filter(l => Number(l.amount || 0) > 0 || l.itemName.trim())
            .map((l, idx) => {
              const raw = Math.max(0, Number(l.amount || 0));
              let netAmount = raw;
              let taxAmount = 0;
              let totalAmount = raw;
              const effMode: ArLineItem['taxMode'] = !arHasInvoice ? 'TAX_EXEMPT' : l.taxMode;
              if (effMode === 'TAX_EXCLUSIVE') {
                taxAmount = Math.round(raw * taxRate);
                totalAmount = raw + taxAmount;
              } else if (effMode === 'TAX_INCLUSIVE') {
                taxAmount = Math.round(raw - raw / (1 + taxRate));
                netAmount = Math.max(0, raw - taxAmount);
                totalAmount = raw;
              }
              return {
                id: l.id || `LI-${idx + 1}`,
                itemName: l.itemName.trim() || `工項 ${idx + 1}`,
                netAmount,
                taxAmount,
                totalAmount,
                taxMode: effMode,
              };
            })
        : undefined;

    try {
      const createdAr = createAccountsReceivable(
        {
          projectId: proj.id,
          projectName: proj.name,
          customerId: contract.customerId,
          customerName: contract.customerName,
          customerTaxId: contract.customerTaxId || undefined,
          companyId: contract.companyId,
          title: arTitle.trim() || (builtLineItems && builtLineItems[0]?.itemName) || '工程款請款',
          lineItems: builtLineItems,
          netAmount: arTaxPreview.netAmt,
          taxType: arHasInvoice ? arTaxType : 'TAX_EXEMPT',
          taxAmount: arTaxPreview.finalTax,
          amount: arTaxPreview.total,
          hasInvoice: arHasInvoice,
          invoiceFormat: arHasInvoice ? arInvoiceFormat : undefined,
          invoiceIssueMode: 'DELIVERED',
          invoiceNumber: arHasInvoice ? arInvoiceNumber.trim().toUpperCase() : undefined,
          invoiceDate: arHasInvoice ? arInvoiceDate : undefined,
          dueDate: arDueDate,
          notes: arNotes.trim() || undefined,
        },
        currentUser?.fullName || '會計專員'
      );

      if (pendingClaimSuspense) {
        const suspRemBefore = pendingClaimSuspense.remainingAmount ?? pendingClaimSuspense.amount;
        allocateSuspenseReceipt(pendingClaimSuspense.id, createdAr.id, currentUser?.fullName || '會計專員');
        const appliedFromSusp = Math.min(suspRemBefore, createdAr.amount);
        const suspLeftAfter = Math.max(0, suspRemBefore - appliedFromSusp);
        onNotify(
          suspLeftAfter > 0.01
            ? `✅ 已補開應收單 [${createdAr.arNumber}]（NT$ ${createdAr.amount.toLocaleString()}）並從暫收池自動沖銷，池內尚餘 NT$ ${suspLeftAfter.toLocaleString()} 可繼續分配下張請款單！`
            : `✅ 已補開應收單 [${createdAr.arNumber}] 並完成暫收款 NT$ ${appliedFromSusp.toLocaleString()} 認領沖銷！`,
          'success'
        );
        setPendingClaimSuspense(null);
        setIsCreateArModalOpen(false);
        loadAllFinanceData();
        return;
      }

      setIsCreateArModalOpen(false);
      loadAllFinanceData();
      onNotify(
        `✅ 應收請款單 [${createdAr.arNumber}] 已開立${createdAr.hasInvoice ? '並同步寫入該公司發票主檔' : '（免開發票，可入老闆私帳/現金）'}！`,
        'success'
      );

      if (immediatelyCollect && canEditCashierFor(createdAr.companyId)) {
        handleOpenCollectArModal(createdAr);
      }
    } catch (e: any) {
      onNotify(`開立應收單失敗：${e.message}`, 'error');
    }
  };

  const handleOpenPostInvoiceModal = (ar: AccountReceivable) => {
    const proj = projects.find(p => p.id === ar.projectId);
    const hasTax = /^\d{8}$/.test((proj?.ownerTaxId || '').trim());
    setPostInvTargetAr(ar);
    setPostInvMode(ar.status === 'COLLECTED' ? 'SELF_RETAINED' : 'DELIVERED');
    setPostInvFormat(hasTax ? 'THREE_PART' : 'TWO_PART');
    setPostInvCompanyId(ar.companyId || authorizedCorps[0]?.id || 'COMP-01');
    setPostInvTaxType('TAX_INCLUSIVE');
    setPostInvAmount(String(ar.amount));
    setPostInvNumber('');
    setPostInvDate(formatLocalYmd(new Date()));
    setPostInvExtraTaxAr(false);
  };

  const handleConfirmPostInvoice = () => {
    if (!postInvTargetAr) return;
    if (!postInvNumber.trim()) {
      onNotify('請填入銷項發票字軌號碼', 'warn');
      return;
    }
    const baseNum = Math.max(0, Number(postInvAmount || 0));
    if (baseNum <= 0) {
      onNotify('請輸入大於 0 的發票金額', 'warn');
      return;
    }
    let netAmt = baseNum;
    let taxAmt = 0;
    let totalAmt = baseNum;
    if (postInvMode === 'SELF_RETAINED' || postInvTaxType === 'TAX_INCLUSIVE') {
      taxAmt = Math.round(baseNum - baseNum / (1 + taxRate));
      netAmt = Math.max(0, baseNum - taxAmt);
      totalAmt = baseNum;
    } else {
      taxAmt = Math.round(baseNum * taxRate);
      netAmt = baseNum;
      totalAmt = baseNum + taxAmt;
    }

    const proj = projects.find(p => p.id === postInvTargetAr.projectId);
    try {
      const createdTaxAr = issueInvoiceForExistingAr(
        {
          arId: postInvTargetAr.id,
          invoiceFormat: postInvFormat,
          invoiceIssueMode: postInvMode,
          invoiceNumber: postInvNumber.trim().toUpperCase(),
          invoiceDate: postInvDate,
          netAmount: netAmt,
          taxAmount: taxAmt,
          totalAmount: totalAmt,
          updateArTotalIfUncollected: postInvMode === 'DELIVERED' && postInvTargetAr.appliedAmount === 0 && postInvTaxType === 'TAX_EXCLUSIVE',
          createExtraTaxReceivable: postInvMode === 'DELIVERED' && postInvExtraTaxAr && postInvTargetAr.appliedAmount > 0,
          companyId: postInvCompanyId,
          customerTaxId: proj?.ownerTaxId || undefined,
        },
        currentUser?.fullName || '會計專員'
      );
      onNotify(
        createdTaxAr
          ? `✅ 已補開銷項發票 [${postInvNumber.trim().toUpperCase()}]，並自動產生 5% 稅金補收單 [${createdTaxAr.arNumber}] (NT$ ${createdTaxAr.amount.toLocaleString()})！`
          : postInvMode === 'SELF_RETAINED'
          ? `✅ 已自主開立報稅發票 [${postInvNumber.trim().toUpperCase()}] 寫入發票主檔（公司自留・稅金自理）！`
          : `✅ 已替應收單 [${postInvTargetAr.arNumber}] 補開銷項發票 [${postInvNumber.trim().toUpperCase()}]！`,
        'success'
      );
      setPostInvTargetAr(null);
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`補開發票失敗：${e.message}`, 'error');
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

  const handleOpenCollectArModal = (ar: AccountReceivable) => {
    const hasInv = ar.hasInvoice !== false;
    const eligibleBanks = getEligibleReceivingBanks(ar.companyId, hasInv, ar.invoiceIssueMode);
    setCollectingTargetAr(ar);
    setCollectMethod(eligibleBanks.length > 0 ? 'TT' : 'CASH');
    setCollectBankAccountId(eligibleBanks[0]?.id || 'CASH');
    setCollectReceivedAmount(String(ar.remainingAmount));
    setCollectShortageMode('PARTIAL');
    setCollectOverpayMode('TO_PROJECT_ADVANCE');
    setCollectReceivedDate(formatLocalYmd(new Date()));
    setCollectCheckNumber('');
    setCollectCheckDueDate(ar.dueDate || formatLocalYmd(new Date()));
    setCollectDrawerBank('');
    setCollectNotes('');
  };

  const handleConfirmCollectAr = () => {
    if (!collectingTargetAr) return;
    const receivedAmt = Number(collectReceivedAmount || 0);
    const remaining = collectingTargetAr.remainingAmount;
    if (receivedAmt <= 0) {
      onNotify('請輸入大於 0 的實收金額', 'warn');
      return;
    }
    if (collectMethod !== 'CASH' && (!collectBankAccountId || collectBankAccountId === 'CASH')) {
      onNotify('請選擇實際入帳的收款銀行帳戶', 'warn');
      return;
    }
    if (collectMethod === 'CHECK' && !collectCheckNumber.trim()) {
      onNotify('收受業主支票請填入支票號碼', 'warn');
      return;
    }

    let applyAmt = receivedAmt;
    let feeAmt = 0;
    let overpayAmt = 0;
    if (receivedAmt < remaining - 0.01) {
      if (collectShortageMode === 'SETTLE_SHORT') {
        applyAmt = remaining;
        feeAmt = remaining - receivedAmt;
      } else {
        applyAmt = receivedAmt;
        feeAmt = 0;
      }
    } else if (receivedAmt > remaining + 0.01) {
      applyAmt = remaining;
      overpayAmt = receivedAmt - remaining;
    }

    try {
      collectAccountsReceivable(
        {
          arId: collectingTargetAr.id,
          collectionMethod: collectMethod,
          bankAccountId: collectMethod === 'CASH' ? 'CASH' : collectBankAccountId,
          amount: applyAmt,
          feeAmount: feeAmt,
          overpaymentAmount: overpayAmt,
          overpaymentHandling: overpayAmt > 0 ? collectOverpayMode : undefined,
          receivedDate: collectReceivedDate,
          checkNumber: collectMethod === 'CHECK' ? collectCheckNumber.trim() : undefined,
          checkDueDate: collectMethod === 'CHECK' ? collectCheckDueDate : undefined,
          drawerBank: collectMethod === 'CHECK' ? collectDrawerBank.trim() : undefined,
          notes: collectNotes.trim() || undefined,
        },
        currentUser?.fullName || 'B出納'
      );
      onNotify(
        collectMethod === 'CHECK'
          ? `✅ 已收受業主支票 [${collectCheckNumber.trim()}] NT$ ${receivedAmt.toLocaleString()}！已納入票據雷達（黃燈待兌現）。`
          : overpayAmt > 0 && collectOverpayMode === 'TO_PROJECT_ADVANCE'
          ? `✅ 已收款入帳 NT$ ${receivedAmt.toLocaleString()}！溢收 NT$ ${overpayAmt.toLocaleString()} 已直接掛入該案場預收款／借貸總帳！`
          : overpayAmt > 0 && collectOverpayMode === 'TO_SUSPENSE'
          ? `✅ 已收款入帳 NT$ ${receivedAmt.toLocaleString()}！應收單已結清，溢收 NT$ ${overpayAmt.toLocaleString()} 已轉入暫收池！`
          : `✅ 應收單 [${collectingTargetAr.arNumber}] 已成功收款入帳 NT$ ${receivedAmt.toLocaleString()}！`,
        'success'
      );
      setCollectingTargetAr(null);
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`收款入帳失敗：${e.message}`, 'error');
    }
  };

  const handleOpenQuickAdvanceModal = () => {
    const selectableProjs = projects.filter(p => !p.isDeleted && p.id !== 'PRJ-INTERNAL');
    const firstProj = selectableProjs.find(p => matchesCompanyScope(p.companyId)) || selectableProjs[0];
    const scopeBankList = bankAccounts.filter(
      b => b.status === 'ACTIVE' && (isBossPrivateAccount(b) || matchesCompanyScope(b.companyId))
    );
    setQuickAdvProjId(firstProj?.id || '');
    setQuickAdvSourceType('EARLY_LOAN');
    setQuickAdvMethod('TT');
    setQuickAdvBankId(scopeBankList[0]?.id || 'CASH');
    setQuickAdvAmount('');
    setQuickAdvDate(formatLocalYmd(new Date()));
    setQuickAdvCheckNo('');
    setQuickAdvCheckDue(formatLocalYmd(new Date()));
    setQuickAdvNotes('');
    setIsQuickAdvanceModalOpen(true);
  };

  const handleConfirmQuickAdvance = () => {
    const proj = projects.find(p => p.id === quickAdvProjId);
    if (!proj) {
      onNotify('請選擇預收款歸屬的工程案場', 'warn');
      return;
    }
    const amt = Number(quickAdvAmount || 0);
    if (amt <= 0) {
      onNotify('請輸入大於 0 的預收金額', 'warn');
      return;
    }
    try {
      createProjectAdvance(
        {
          projectId: proj.id,
          projectName: proj.name,
          customerName: proj.ownerName || '案場業主',
          companyId: (proj.companyId && proj.companyId !== 'UNASSIGNED' ? proj.companyId : authorizedCorps[0]?.id) || 'COMP-01',
          bankAccountId: quickAdvMethod === 'CASH' ? 'CASH' : quickAdvBankId,
          collectionMethod: quickAdvMethod,
          amount: amt,
          receivedDate: quickAdvDate,
          sourceType: quickAdvSourceType,
          checkNumber: quickAdvMethod === 'CHECK' ? quickAdvCheckNo : undefined,
          checkDueDate: quickAdvMethod === 'CHECK' ? quickAdvCheckDue : undefined,
          notes: quickAdvNotes.trim() || undefined,
        },
        currentUser?.fullName || 'B出納'
      );
      onNotify(`✅ 已將預收／貸款撥款 NT$ ${amt.toLocaleString()} 直接掛入「${proj.name}」案場總帳！`, 'success');
      setIsQuickAdvanceModalOpen(false);
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`登錄案場預收失敗：${e.message}`, 'error');
    }
  };

  const handleOpenCreateSuspenseModal = () => {
    const scopeBankList = bankAccounts.filter(
      b => b.status === 'ACTIVE' && (isBossPrivateAccount(b) || matchesCompanyScope(b.companyId))
    );
    setSuspBankAccountId(scopeBankList[0]?.id || 'CASH');
    setSuspAmount('');
    setSuspReceivedDate(formatLocalYmd(new Date()));
    setSuspPayerInfo('');
    setSuspNotes('');
    setIsCreateSuspenseModalOpen(true);
  };

  const handleConfirmCreateSuspense = () => {
    const amt = Number(suspAmount || 0);
    if (amt <= 0) {
      onNotify('請輸入大於 0 的入帳金額', 'warn');
      return;
    }
    if (!suspPayerInfo.trim()) {
      onNotify('請填寫銀行存摺顯示的匯入戶名／附言摘要', 'warn');
      return;
    }
    const selBank = bankAccounts.find(b => b.id === suspBankAccountId);
    const derivedCompanyId = selBank?.companyId || (financeCompanyScope !== 'ALL' ? financeCompanyScope : (authorizedCorps[0]?.id || 'COMP-01'));
    try {
      createSuspenseReceipt(
        {
          companyId: derivedCompanyId,
          bankAccountId: suspBankAccountId || 'CASH',
          amount: amt,
          receivedDate: suspReceivedDate,
          payerInfo: suspPayerInfo.trim(),
          notes: suspNotes.trim() || undefined,
        },
        currentUser?.fullName || 'B出納'
      );
      onNotify(`✅ 已登錄未知暫收款 NT$ ${amt.toLocaleString()}（銀行餘額已即時同步，待會計確認認領）！`, 'success');
      setIsCreateSuspenseModalOpen(false);
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`登錄暫收款失敗：${e.message}`, 'error');
    }
  };

  const invModalTaxPreview = useMemo(() => {
    const base = Math.max(0, Number(invBaseAmount || 0));
    let autoTax = 0;
    if (invTaxType === 'TAX_EXEMPT') {
      autoTax = 0;
    } else if (invTaxType === 'TAX_EXCLUSIVE') {
      autoTax = Math.round(base * taxRate);
    } else {
      autoTax = Math.round(base - base / (1 + taxRate));
    }
    const finalTax = invTaxType === 'TAX_EXEMPT'
      ? 0
      : (invManualTax.trim() !== '' ? Math.max(0, Number(invManualTax) || 0) : autoTax);
    const total = invTaxType === 'TAX_EXEMPT' ? base : invTaxType === 'TAX_EXCLUSIVE' ? base + finalTax : base;
    const netAmt = invTaxType === 'TAX_EXEMPT' ? base : invTaxType === 'TAX_EXCLUSIVE' ? base : Math.max(0, base - finalTax);
    return { base, autoTax, finalTax, total, netAmt };
  }, [invBaseAmount, invTaxType, invManualTax, taxRate]);

  const handleOpenCreateInvoiceModal = () => {
    setInvTargetCompanyId(invoiceCompanyId);
    setInvType('INPUT');
    setInvFormat('THREE_PART');
    setInvIssueMode('DELIVERED');
    setInvProjectId('');
    setInvNumber('');
    setInvDate(formatLocalYmd(new Date()));
    setInvPartnerId('');
    setInvPartnerTaxId('');
    setInvPartnerName('');
    setInvTaxType('TAX_EXCLUSIVE');
    setInvBaseAmount('');
    setInvManualTax('');
    setIsCreateInvoiceModalOpen(true);
  };

  const handleConfirmCreateInvoice = () => {
    if (!invNumber.trim()) {
      onNotify('請填入統一發票字軌號碼', 'warn');
      return;
    }
    if (invFormat === 'THREE_PART' && !invPartnerTaxId.trim() && !invPartnerName.trim()) {
      onNotify('三聯式發票請選擇交易夥伴或填入對方統編與名稱', 'warn');
      return;
    }
    if (invFormat === 'TWO_PART' && !invPartnerName.trim()) {
      onNotify('二聯式發票請填入買受人／業主名稱（統編可免填）', 'warn');
      return;
    }
    if (invModalTaxPreview.total <= 0) {
      onNotify('請輸入大於 0 的發票金額', 'warn');
      return;
    }
    const ourComp = companies.find(c => c.id === invTargetCompanyId);
    const ourTaxId = ourComp?.taxId || invTargetCompanyId;
    const ourName = ourComp?.name || invTargetCompanyId;
    const otherTaxId = invPartnerTaxId.trim() || (invFormat === 'TWO_PART' ? '免統編(二聯)' : '未建統編');
    const otherName = invPartnerName.trim() || otherTaxId;
    const resolvedIssueMode = invType === 'OUTPUT' ? invIssueMode : 'DELIVERED';

    try {
      createInvoice(
        {
          invoiceType: invType,
          invoiceFormat: invFormat,
          invoiceIssueMode: resolvedIssueMode,
          invoiceNumber: invNumber.trim().toUpperCase(),
          invoiceDate: invDate,
          taxReportingCompanyId: invTargetCompanyId,
          issuerTaxId: invType === 'INPUT' ? otherTaxId : ourTaxId,
          issuerName: invType === 'INPUT' ? otherName : ourName,
          buyerTaxId: invType === 'INPUT' ? ourTaxId : otherTaxId,
          buyerName: invType === 'INPUT' ? ourName : otherName,
          netAmount: invModalTaxPreview.netAmt,
          taxAmount: invModalTaxPreview.finalTax,
          totalAmount: invModalTaxPreview.total,
          linkedProjectId: invProjectId || undefined,
          status: 'VALID',
        },
        currentUser?.fullName || '會計專員'
      );
      onNotify(`✅ 已成功補登統一發票 [${invNumber.trim().toUpperCase()}] 至【${ourComp?.shortName || ourName}】發票主檔！`, 'success');
      setIsCreateInvoiceModalOpen(false);
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`登記發票失敗：${e.message}`, 'error');
    }
  };

  const handleVoidInvoice = (inv: Invoice) => {
    try {
      voidInvoice(inv.id, '會計作廢統一發票', currentUser?.fullName || '會計專員');
      onNotify(`已作廢統一發票 [${inv.invoiceNumber}]`, 'warn');
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`作廢發票失敗：${e.message}`, 'error');
    }
  };

  // -------------------------------------------------------------
  // 過濾清冊
  // -------------------------------------------------------------
  const filteredRecs = useMemo(() => {
    return reconciliations.filter(r => {
      if (!matchesCompanyScope(r.companyId)) return false;
      const matchSearch = searchQuery === '' ||
        r.reconciliationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.vendorName && r.vendorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.invoiceNumber && r.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchVendor = selectedVendorFilter === 'ALL' || r.vendorId === selectedVendorFilter;
      const matchStatus =
        selectedStatusFilter === 'ALL' ||
        (selectedStatusFilter === 'COMPLETED'
          ? (r.status === 'PAID' || r.status === 'VOIDED')
          : r.status === selectedStatusFilter);
      return matchSearch && matchVendor && matchStatus;
    });
  }, [reconciliations, searchQuery, selectedVendorFilter, selectedStatusFilter, financeCompanyScope, authorizedCorpIds]);

  return (
    <div className="space-y-4">
      {/* ======================================================== */}
      {/* 頂部四核心 KPI 指標看板 (大水池水位 · 應付負債 · 資金雷達) */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* KPI 1: 進貨大水池未結款項 (PENDING_BILLING) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>進貨待對帳大水池</span>
            </span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">
              {metrics.pendingInboundCount} 筆待請款
            </span>
          </div>
          <div className="text-xl font-mono font-black text-slate-900 mt-1">
            NT$ {metrics.pendingInboundTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>現場已簽收 · 尚未勾稽對帳</span>
            {canEditAccounting && vendorPoolList.length > 0 && (
              <button
                onClick={() => handleOpenCreateRecModal()}
                className="text-amber-700 font-bold hover:underline cursor-pointer"
              >
                一鍵開單 →
              </button>
            )}
          </div>
          <div className="absolute right-2 -bottom-2 text-amber-100 -z-0 opacity-40">
            <Receipt className="w-16 h-16" />
          </div>
        </div>

        {/* KPI 2: 已覆核待放款 AP 水位 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              <span>應付對帳款 (待放款)</span>
            </span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">
              {metrics.pendingApCount} 筆待付
            </span>
          </div>
          <div className="text-xl font-mono font-black text-indigo-700 mt-1">
            NT$ {metrics.pendingApTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>會計已核准發票與稅額 · 依到期日放款</span>
          </div>
          <div className="absolute right-2 -bottom-2 text-indigo-100 -z-0 opacity-40">
            <Wallet className="w-16 h-16" />
          </div>
        </div>

        {/* KPI 3: 銀行真實存款 vs 老闆口袋 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>實體銀行存款餘額</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
              T+0 實體存摺
            </span>
          </div>
          <div className="text-xl font-mono font-black text-emerald-700 mt-1">
            NT$ {metrics.realBankBalance.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>老闆代墊口袋：</span>
            <span className="font-mono font-bold text-slate-700">NT$ {metrics.bossBalance.toLocaleString()}</span>
          </div>
          <div className="absolute right-2 -bottom-2 text-emerald-100 -z-0 opacity-40">
            <Building2 className="w-16 h-16" />
          </div>
        </div>

        {/* KPI 4: 90 天資金雷達預測 (扣除未兌現支票) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span>資金雷達可用淨額</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-bold">
              未兌票據: {metrics.unclearedChecksCount} 張
            </span>
          </div>
          <div className={`text-xl font-mono font-black mt-1 ${metrics.projectedNetCash >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            NT$ {metrics.projectedNetCash.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>扣除未兌現期票:</span>
            <span className="font-mono text-amber-700 font-bold">- NT$ {metrics.unclearedChecksTotal.toLocaleString()}</span>
          </div>
          <div className="absolute right-2 -bottom-2 text-blue-100 -z-0 opacity-40">
            <Clock className="w-16 h-16" />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 主頁籤切換導航 (依權限自動區分：會計管帳 vs 出納管錢 vs 一人兼任模式) */}
      {/* ======================================================== */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {canViewAccounting && (
            <button
              onClick={() => setActiveTab('RECONCILIATION_POOL')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'RECONCILIATION_POOL'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>應付對帳 (會計)</span>
              {accountingTodoCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'RECONCILIATION_POOL'
                    ? 'bg-indigo-800 text-white'
                    : returnedRecs.length > 0
                    ? 'bg-rose-100 text-rose-800 font-bold'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {accountingTodoCount}
                </span>
              )}
            </button>
          )}

          {canViewArAndInvoices && (
            <button
              onClick={() => setActiveTab('AR_BILLING')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'AR_BILLING'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>應收請款 (會計)</span>
              {arList.filter(a => (a.status === 'OPEN' || a.status === 'PARTIAL') && matchesCompanyScope(a.companyId)).length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'AR_BILLING' ? 'bg-indigo-800 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {arList.filter(a => (a.status === 'OPEN' || a.status === 'PARTIAL') && matchesCompanyScope(a.companyId)).length}
                </span>
              )}
            </button>
          )}

          {canViewCashier && (
            <button
              onClick={() => setActiveTab('TREASURY_PAYMENT')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'TREASURY_PAYMENT'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>出納收付款工作台</span>
              {(metrics.pendingApCount + arList.filter(a => (a.status === 'OPEN' || a.status === 'PARTIAL') && matchesCompanyScope(a.companyId)).length) > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'TREASURY_PAYMENT' ? 'bg-indigo-800 text-white' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  {metrics.pendingApCount + arList.filter(a => (a.status === 'OPEN' || a.status === 'PARTIAL') && matchesCompanyScope(a.companyId)).length}
                </span>
              )}
            </button>
          )}

          {canViewCashier && (
            <button
              onClick={() => setActiveTab('CHECK_RADAR')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'CHECK_RADAR'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>票據雷達</span>
              {metrics.unclearedChecksCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'CHECK_RADAR' ? 'bg-indigo-800 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {metrics.unclearedChecksCount}
                </span>
              )}
            </button>
          )}

          {(canViewArAndInvoices || canViewCashier) && (
            <button
              onClick={() => setActiveTab('INVOICE_PETTY_CASH')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'INVOICE_PETTY_CASH'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>各公司發票與暫收池</span>
              {metrics.pendingSuspenseCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'INVOICE_PETTY_CASH' ? 'bg-indigo-800 text-white' : 'bg-rose-100 text-rose-800'
                }`}>
                  {metrics.pendingSuspenseCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* 頂部法人隔離切換器 ＋ 作業模式標誌 ＋ 快捷動作 */}
        <div className="flex flex-wrap items-center gap-2">
          {authorizedCorps.length > 0 && (
            <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <Building2 className="w-3.5 h-3.5 text-purple-600" />
              <select
                value={financeCompanyScope}
                onChange={(e) => {
                  const val = e.target.value;
                  setFinanceCompanyScope(val);
                  if (val !== 'ALL') setInvoiceCompanyId(val);
                }}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                title="依授權法人公司隔離財務與銀行帳務視角"
              >
                {authorizedCorps.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.shortName || c.name}
                  </option>
                ))}
                {authorizedCorps.length > 1 && (
                  <option value="ALL">全部授權法人 ({authorizedCorps.length}間)</option>
                )}
              </select>
            </div>
          )}

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
              canEditAccounting && canEditCashier
                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                : canEditAccounting
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : canEditCashier
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
            title="依權限群組自動切換：1人兼任可一體快辦，2人分工則自動隔離管帳與管錢"
          >
            {canEditAccounting && canEditCashier
              ? '⚡ 會計兼出納一體模式'
              : canEditAccounting
              ? '📒 專職會計模式（僅管帳・對帳立帳）'
              : canEditCashier
              ? '💰 專職出納模式（僅管錢・收付款開票）'
              : '👁️ 唯讀檢視模式'}
          </span>

          {activeTab === 'RECONCILIATION_POOL' && canEditAccounting && (
            <button
              onClick={() => handleOpenCreateRecModal()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>開立應付對帳單</span>
            </button>
          )}

          {activeTab === 'AR_BILLING' && canEditAr && (
            <button
              onClick={() => handleOpenCreateArModal()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>開立應收請款單</span>
            </button>
          )}

          {onNavigateToInbound && (
            <button
              onClick={onNavigateToInbound}
              className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1"
              title="穿透前往現場進貨簽收模組"
            >
              <span>查看現場進貨單</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: 會計應付對帳大水池 (AP Reconciliation) */}
      {/* ======================================================== */}
      {activeTab === 'RECONCILIATION_POOL' && (
        <div className="space-y-4">
          {/* ======================================================== */}
          {/* A. 會計待辦處理大水池（有新單據、退回重算、草稿待送皆集中於此，做完即清零） */}
          {/* ======================================================== */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${accountingTodoCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                <h3 className="text-xs font-bold text-slate-800">
                  會計待辦處理大水池（出納退回重算 · 未完成草稿 · 待對帳新進貨）
                </h3>
                {returnedRecs.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-bold">
                    🚨 退回重算 {returnedRecs.length} 筆
                  </span>
                )}
                {draftRecs.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold">
                    📝 草稿待送 {draftRecs.length} 筆
                  </span>
                )}
                {vendorPoolList.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 font-bold">
                    📦 待對帳新進貨 {vendorPoolList.length} 廠商 ({metrics.pendingInboundCount} 筆)
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                處理完此區即完成當期對帳作業；已確認無誤之單據會自動歸入下方備查清冊
              </span>
            </div>

            {/* 異常重複請款偵測與一鍵去重清理 */}
            {duplicateApGroups.length > 0 && (
              <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5 text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">
                      ⚠️ 偵測到 {duplicateApGroups.length} 組進貨單被重複建立多筆請款對帳單！
                    </div>
                    <div className="text-[11px] text-rose-800 mt-0.5">
                      {duplicateApGroups.slice(0, 3).map(g => (
                        <span key={g.receiptId} className="mr-3">
                          進貨單【{g.receiptNumber}】多出 {g.duplicateRecs.length} 筆重複（{g.duplicateRecs.map(d => d.reconciliationNumber).join('、')}）
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {canEditAccounting && (
                  <button
                    type="button"
                    onClick={handleCleanupDuplicateRecs}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer shrink-0 shadow-2xs"
                  >
                    一鍵清理重複請款（保留有效單據）
                  </button>
                )}
              </div>
            )}

            {/* A-1. 🚨 出納退回待重算修正（最高優先級 · 直接置頂於大水池） */}
            {returnedRecs.length > 0 && (
              <div className="border-2 border-rose-300 rounded-xl overflow-hidden bg-rose-50/40">
                <div className="bg-rose-100/80 px-3.5 py-2 border-b border-rose-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
                    <RotateCcw className="w-4 h-4 text-rose-600" />
                    <span>出納退回重算通知（{returnedRecs.length} 筆待會計修正再送審）</span>
                  </div>
                  <span className="text-[11px] text-rose-700 font-medium">
                    請核對退回原因並重算修正稅額／金額／發票
                  </span>
                </div>
                <div className="divide-y divide-rose-200/70 bg-white">
                  {returnedRecs.map(ret => {
                    const retComp = companies.find(c => c.id === ret.companyId);
                    return (
                      <div key={ret.id} className="p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-rose-50/30 transition-colors text-xs">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{ret.reconciliationNumber}</span>
                            <span className="font-bold text-slate-800">{ret.vendorName || ret.vendorId}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {retComp?.shortName || retComp?.name || ret.companyId}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono">
                              發票：{ret.invoiceNumber === 'NONE' ? '免用發票' : ret.invoiceNumber === 'PENDING_NEXT' ? '待補票' : ret.invoiceNumber}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              含稅應付：<b className="font-mono text-rose-700 text-sm">NT$ {ret.netPayableAmount.toLocaleString()}</b>（稅額 NT$ {ret.taxAmount.toLocaleString()}）
                            </span>
                          </div>
                          <div className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1 inline-flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>
                              <b>{ret.returnedBy || '出納'}退回原因：</b>{ret.returnedReason || '請重新核算金額與稅額'}
                            </span>
                          </div>
                        </div>
                        {canEditAccounting && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditRecModal(ret)}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>重算修正並送審</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setVoidModalTargetId(ret.id);
                                setVoidReasonText('');
                              }}
                              className="px-2.5 py-1.5 border border-slate-300 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                              title="作廢此對帳單並將進貨單釋放回待對帳水池"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>作廢釋放</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* A-2. 📝 暫存草稿對帳單（直接放於大水池，避免遺漏未送審草稿） */}
            {draftRecs.length > 0 && (
              <div className="border border-indigo-200 rounded-xl overflow-hidden bg-indigo-50/30">
                <div className="bg-indigo-50 px-3.5 py-2 border-b border-indigo-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                    <Edit3 className="w-4 h-4 text-indigo-600" />
                    <span>暫存草稿對帳單（{draftRecs.length} 筆尚未核准送交出納）</span>
                  </div>
                  <span className="text-[11px] text-indigo-700">
                    所勾稽進貨單已鎖定於草稿中，不會重複出現在下方進貨池
                  </span>
                </div>
                <div className="divide-y divide-indigo-100 bg-white">
                  {draftRecs.map(draft => {
                    const draftComp = companies.find(c => c.id === draft.companyId);
                    return (
                      <div key={draft.id} className="p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-indigo-50/30 transition-colors text-xs">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono font-bold text-slate-900">{draft.reconciliationNumber}</span>
                          <span className="font-bold text-slate-800">{draft.vendorName || draft.vendorId}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {draftComp?.shortName || draftComp?.name || draft.companyId}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-mono">
                            綁定 {draft.receiptIds?.length || 0} 筆進貨單
                          </span>
                          <span className="text-xs text-slate-600">
                            含稅應付：<b className="font-mono text-indigo-700 text-sm">NT$ {draft.netPayableAmount.toLocaleString()}</b>（稅額 NT$ {draft.taxAmount.toLocaleString()}）
                          </span>
                        </div>
                        {canEditAccounting && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditRecModal(draft)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>繼續編輯送審</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setVoidModalTargetId(draft.id);
                                setVoidReasonText('');
                              }}
                              className="px-2.5 py-1.5 border border-slate-300 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                              title="作廢草稿並將進貨單釋放回待對帳大水池"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>作廢釋放</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* A-3. 📦 新進貨待對帳廠商水池 */}
            {vendorPoolList.length === 0 ? (
              returnedRecs.length === 0 && draftRecs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-emerald-50/40 border border-emerald-200 rounded-lg">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                  <div className="font-bold text-emerald-900 text-sm">🎉 今日會計待辦大水池已全數清零！</div>
                  <div className="text-[11px] text-emerald-700 mt-1">
                    無新進貨待對帳、無暫存草稿、無出納退回重算事項；已確認之對帳單皆歸檔於下方備查清冊。
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-slate-500 text-xs bg-slate-50 rounded-lg border border-slate-200">
                  目前無新的待對帳進貨簽收單，請先完成上方「退回重算／暫存草稿」項目即可結束本期對帳。
                </div>
              )
            ) : (
              <div className="overflow-x-auto border border-amber-200/80 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-amber-50 text-amber-900 font-bold border-b border-amber-200">
                    <tr>
                      <th className="p-3 w-8 text-center"></th>
                      <th className="p-3">對帳廠商 (統編 / 名稱)</th>
                      <th className="p-3">付款條件與慣例</th>
                      <th className="p-3 text-center">待對帳單據數</th>
                      <th className="p-3 text-right">累計待請款未稅總額</th>
                      <th className="p-3">最近進貨區間</th>
                      <th className="p-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 bg-white">
                    {vendorPoolList.map((v) => {
                      const isExpanded = expandedVendorPoolIds.includes(v.vendorId);
                      const dates = v.receipts.map(r => r.receivedDate).filter(Boolean).sort();
                      const dateRange = dates.length > 0
                        ? `${dates[0]} ~ ${dates[dates.length - 1]}`
                        : '當期進貨';

                      return (
                        <React.Fragment key={v.vendorId}>
                          <tr className="hover:bg-amber-50/40 transition-colors">
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isExpanded) {
                                    setExpandedVendorPoolIds(expandedVendorPoolIds.filter(id => id !== v.vendorId));
                                  } else {
                                    setExpandedVendorPoolIds([...expandedVendorPoolIds, v.vendorId]);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-amber-800 rounded transition-colors cursor-pointer"
                                title={isExpanded ? '收合進貨簽收單' : '展開進貨簽收單'}
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-amber-700" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900 text-sm">{v.vendorName}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                統編: {v.vendorTaxId || '未建統編'}
                              </div>
                            </td>
                            <td className="p-3 text-slate-700">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium">T+{v.paymentTermsDays} 天</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-sans">
                                  {v.bankFeePayer === 'COMPANY' ? '匯費公司外加' : '匯費廠商內扣'}
                                </span>
                              </div>
                              {v.paymentMethodNotes && (
                                <div className="text-[11px] text-indigo-700 font-medium mt-0.5 truncate max-w-[220px]" title={v.paymentMethodNotes}>
                                  💳 備註: {v.paymentMethodNotes}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                {v.receipts.length} 筆待對帳
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="text-base font-mono font-black text-slate-900">
                                NT$ {v.totalAmount.toLocaleString()}
                              </div>
                              <div className="text-[10px] text-slate-400">進貨簽收實體原額</div>
                            </td>
                            <td className="p-3 font-mono text-slate-600 text-[11px]">
                              {dateRange}
                            </td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingVendorPool(v);
                                  setViewingModalExpandedReceiptIds(v.receipts.map(r => r.id));
                                }}
                                className="px-3 py-1.5 text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                <span>檢視單據</span>
                              </button>
                              {canEditAccounting && (
                                <button
                                  onClick={() => handleOpenCreateRecModal(v.vendorId)}
                                  className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                >
                                  <span>建立對帳單</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>

                          {/* 展開之進貨簽收單明細預覽 */}
                          {isExpanded && (
                            <tr className="bg-amber-50/20">
                              <td colSpan={7} className="p-3.5 pl-10">
                                <div className="bg-white border border-amber-200 rounded-xl p-3 shadow-2xs">
                                  <div className="text-xs font-bold text-amber-900 mb-2 flex items-center justify-between">
                                    <span>該廠商大水池待請款進貨簽收單 ({v.receipts.length} 筆)</span>
                                    <span className="text-[11px] text-slate-400">現場簽收直接調取 · 點擊「建立對帳單」進行勾稽</span>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-[11px] text-left border-collapse">
                                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                        <tr>
                                          <th className="p-2">進貨單號</th>
                                          <th className="p-2">現場送貨單號</th>
                                          <th className="p-2">簽收日期</th>
                                          <th className="p-2">工程案場 / 原歸屬公司</th>
                                          <th className="p-2">簽收人</th>
                                          <th className="p-2 text-right">進貨未稅原額</th>
                                          <th className="p-2">簽收備註</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-mono">
                                        {v.receipts.map((r) => {
                                          const rComp = companies.find(c => c.id === r.companyId);
                                          return (
                                            <tr key={r.id} className="hover:bg-slate-50">
                                              <td className="p-2 font-bold text-slate-900">{r.receiptNumber}</td>
                                              <td className="p-2 text-indigo-700 font-semibold">{r.deliveryNoteNumber}</td>
                                              <td className="p-2 font-sans text-slate-600">{r.receivedDate}</td>
                                              <td className="p-2 font-sans text-slate-700">
                                                <span>{r.projectNameSnapshot}</span>
                                                {rComp && (
                                                  <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold">
                                                    {rComp.shortName || rComp.name}
                                                  </span>
                                                )}
                                              </td>
                                              <td className="p-2 font-sans text-slate-600">{r.receivedBy}</td>
                                              <td className="p-2 text-right font-black text-slate-900">
                                                NT$ {r.totalAmount.toLocaleString()}
                                              </td>
                                              <td className="p-2 font-sans text-slate-500 max-w-xs truncate">
                                                {r.notes || '—'}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* B. 已送交出納審核／待放款中（會計追蹤與催款管理・尚未完工結清） */}
          {/* ======================================================== */}
          <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800">
                  2. 已送出納審核／待放款中（會計送件追蹤・催款參考）
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold font-mono">
                  {approvedRecs.length} 筆待放款 · 合計 NT$ {approvedRecs.reduce((s, r) => s + r.netPayableAmount, 0).toLocaleString()}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                會計已覆核立帳，目前停留在出納待放款佇列；尚未出金前仍可追蹤進度、催請出納或抽回作廢
              </span>
            </div>

            {approvedRecs.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 rounded-lg border border-slate-100">
                目前無停留在出納端等待放款的對帳單（所有已核准單據皆已出金結清）。
              </div>
            ) : (
              <div className="overflow-x-auto border border-indigo-100 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-indigo-50/70 text-indigo-900 font-bold border-b border-indigo-200">
                    <tr>
                      <th className="p-2.5">對帳單號</th>
                      <th className="p-2.5">廠商名稱</th>
                      <th className="p-2.5">買受法人公司</th>
                      <th className="p-2.5">發票字軌</th>
                      <th className="p-2.5 text-right">應付淨額 (含稅)</th>
                      <th className="p-2.5">預計付款參考日 / 催款提示</th>
                      <th className="p-2.5">送出納時間 / 核准人</th>
                      <th className="p-2.5 text-center">操作 / 狀態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-100/70 font-mono">
                    {approvedRecs.map((rec) => {
                      const today = formatLocalYmd(new Date());
                      const isOverdue = rec.paymentDueDate < today;
                      const isDueSoon = !isOverdue && rec.paymentDueDate <= formatLocalYmd(new Date(Date.now() + 7 * 86400000));
                      const payComp = companies.find(c => c.id === rec.companyId);
                      const sentDateMs = new Date(rec.updatedAt || rec.createdAt || Date.now()).getTime();
                      const waitDays = Math.max(0, Math.floor((Date.now() - sentDateMs) / 86400000));

                      return (
                        <tr key={rec.id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="p-2.5 font-bold text-slate-900">{rec.reconciliationNumber}</td>
                          <td className="p-2.5 font-sans font-bold text-slate-800">
                            {rec.vendorName || rec.vendorId}
                          </td>
                          <td className="p-2.5 font-sans text-slate-700">
                            {payComp?.shortName || payComp?.name || rec.companyId}
                            {rec.isBossAdvance && (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                                老闆私帳
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-sans text-slate-600">
                            {rec.invoiceNumber === 'NONE' ? '免用發票' : rec.invoiceNumber === 'PENDING_NEXT' ? '下期補票' : (
                              <span className="font-mono text-indigo-700 font-semibold">{rec.invoiceNumber}</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            <div className="font-bold text-indigo-700">NT$ {rec.netPayableAmount.toLocaleString()}</div>
                            <div className="text-[10px] font-sans text-slate-400">
                              含稅 NT$ {rec.taxAmount.toLocaleString()}
                            </div>
                          </td>
                          <td className="p-2.5 font-sans">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                              isOverdue
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : isDueSoon
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'text-slate-600'
                            }`}>
                              <span className="font-mono">{rec.paymentDueDate}</span>
                              {isOverdue && <span>· ⚠️ 逾期請催出納</span>}
                              {isDueSoon && <span>· ⏰ 即將到期</span>}
                            </span>
                          </td>
                          <td className="p-2.5 font-sans text-[11px] text-slate-600">
                            <div>{rec.approvedBy || rec.reconciledBy || '會計'}</div>
                            <div className="text-[10px] text-slate-400">已送出 {waitDays} 天</div>
                          </td>
                          <td className="p-2.5 text-center font-sans space-x-1">
                            {canEditCashier ? (
                              <button
                                onClick={() => handleOpenPaymentModal(rec)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                放款出金
                              </button>
                            ) : (
                              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                ⏳ 出納排程放款中
                              </span>
                            )}
                            {canEditAccounting && (
                              <button
                                onClick={() => {
                                  setVoidModalTargetId(rec.id);
                                  setVoidReasonText('');
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                title="出納尚未放款前，會計可抽回作廢並釋放進貨單回大水池"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* C. 已完全完工結清備查清冊（供歷史查核與追蹤，待辦事項統一於上方大水池處理） */}
          {/* ======================================================== */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-800">
                  3. 已完全完工備查清冊 (Completed &amp; Settled Archive)
                </h3>
                <span className="text-[11px] text-slate-400">
                  (目前顯示 {filteredRecs.length} 筆 · 已出金結清與歷史備查資料)
                </span>
              </div>

              {/* 篩選控制器 */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋對帳單號、廠商、發票..."
                    className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 w-48"
                  />
                </div>

                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 outline-none"
                >
                  <option value="PAID">已完全完工結清 (PAID)</option>
                  <option value="COMPLETED">已結清 + 已作廢 (歷史歸檔)</option>
                  <option value="VOIDED">僅看：已作廢紀錄</option>
                  <option value="APPROVED">僅看：已送出納待放款</option>
                  <option value="RETURNED">僅看：出納退回重算</option>
                  <option value="DRAFT">僅看：草稿暫存</option>
                  <option value="ALL">全部歷史紀錄</option>
                </select>
              </div>
            </div>

            {/* 清冊表格 */}
            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">對帳單號</th>
                    <th className="p-2.5">期別</th>
                    <th className="p-2.5">廠商名稱</th>
                    <th className="p-2.5 text-right">進貨原額</th>
                    <th className="p-2.5 text-right text-rose-600">折讓扣除</th>
                    <th className="p-2.5 text-right">營業稅 ({taxRatePct}%)</th>
                    <th className="p-2.5 text-right">本期應付淨額</th>
                    <th className="p-2.5">發票字軌</th>
                    <th className="p-2.5">立帳歸屬公司 / 帳務性質</th>
                    <th className="p-2.5">預計付款日</th>
                    <th className="p-2.5 text-center">狀態</th>
                    <th className="p-2.5 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredRecs.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-6 text-center text-slate-400 font-sans">
                        查無符合條件的應付對帳單
                      </td>
                    </tr>
                  ) : (
                    filteredRecs.map((rec) => {
                      // 計算預計付款日燈號
                      const today = formatLocalYmd(new Date());
                      const isOverdue = rec.status === 'APPROVED' && rec.paymentDueDate < today;
                      const isDueSoon = rec.status === 'APPROVED' && rec.paymentDueDate >= today && rec.paymentDueDate <= formatLocalYmd(new Date(Date.now() + 7 * 86400000));
                      const payComp = companies.find(c => c.id === rec.companyId);
                      const matchedPay = payments.find(
                        p => p.status !== 'VOIDED' && p.lineItems?.some(li => li.sourceId === rec.id)
                      );

                      return (
                        <tr key={rec.id} className={`transition-colors ${rec.status === 'RETURNED' ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/80'}`}>
                          <td className="p-2.5 font-bold text-slate-900">
                            {rec.reconciliationNumber}
                          </td>
                          <td className="p-2.5 font-sans text-slate-600">{rec.billingPeriod}</td>
                          <td className="p-2.5 font-sans font-bold text-slate-800">
                            {rec.vendorName || rec.vendorId}
                          </td>
                          <td className="p-2.5 text-right text-slate-700">
                            NT$ {rec.inboundTotalAmount.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-right text-rose-600">
                            {rec.discountAmount > 0 ? `- NT$ ${rec.discountAmount.toLocaleString()}` : '-'}
                          </td>
                          <td className="p-2.5 text-right text-slate-700">
                            <div>NT$ {rec.taxAmount.toLocaleString()}</div>
                            <div className="text-[10px] font-sans text-slate-400">
                              {rec.taxType === 'TAX_EXCLUSIVE' ? '外加' : rec.taxType === 'TAX_INCLUSIVE' ? '內含' : '免稅'}
                            </div>
                          </td>
                          <td className="p-2.5 text-right font-bold text-indigo-700">
                            NT$ {rec.netPayableAmount.toLocaleString()}
                          </td>
                          <td className="p-2.5 font-sans text-slate-600">
                            {rec.invoiceNumber === 'NONE' ? (
                              <span className="text-slate-400">免用發票</span>
                            ) : rec.invoiceNumber === 'PENDING_NEXT' ? (
                              <span className="text-amber-600 font-semibold">下期補票</span>
                            ) : (
                              <span className="font-mono text-indigo-600 font-semibold">{rec.invoiceNumber}</span>
                            )}
                          </td>
                          <td className="p-2.5 font-sans">
                            <div className="font-bold text-slate-800 text-[11px]">
                              {payComp?.shortName || payComp?.name || '未指定公司'}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[10px] text-slate-500">
                              {matchedPay ? (
                                <span className={`px-1.5 py-0.2 rounded font-bold ${
                                  matchedPay.paymentMethod === 'CHECK' ? 'bg-amber-100 text-amber-800' :
                                  matchedPay.paymentMethod === 'TT' ? 'bg-indigo-100 text-indigo-800' :
                                  'bg-emerald-100 text-emerald-800'
                                }`}>
                                  出納實付：{matchedPay.paymentMethod === 'CHECK' ? '支票' : matchedPay.paymentMethod === 'TT' ? '電匯' : '現金'}
                                </span>
                              ) : rec.status === 'APPROVED' ? (
                                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                                  待出納決定付款方式
                                </span>
                              ) : rec.status === 'RETURNED' ? (
                                <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">
                                  出納退回重算中
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                                  {rec.hasInvoice ? '憑證立帳' : '免用發票內帳'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <span className={`inline-flex items-center gap-1 font-sans ${
                              isOverdue ? 'text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded' :
                              isDueSoon ? 'text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded' : 'text-slate-600'
                            }`}>
                              {isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />}
                              {isDueSoon && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                              <span>{rec.paymentDueDate}</span>
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-sans">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                rec.status === 'APPROVED' ? 'bg-amber-100 text-amber-800' :
                                rec.status === 'RETURNED' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                rec.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                                rec.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {rec.status === 'APPROVED' ? '待出金放款' :
                                 rec.status === 'RETURNED' ? '🚨 出納退回重算' :
                                 rec.status === 'PAID' ? '已出金結清' :
                                 rec.status === 'DRAFT' ? '草稿暫存' : '已作廢'}
                              </span>
                              {rec.status === 'RETURNED' && rec.returnedReason && (
                                <span
                                  className="text-[10px] text-rose-700 font-semibold max-w-[140px] truncate"
                                  title={`${rec.returnedBy || '出納'}：${rec.returnedReason}`}
                                >
                                  原因：{rec.returnedReason}
                                </span>
                              )}
                              {rec.bouncedCheckNumber && rec.status === 'APPROVED' && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-bold"
                                  title={rec.bouncedReason || '退票待重付'}
                                >
                                  ⚠️ 原票 {rec.bouncedCheckNumber} 退票
                                </span>
                              )}
                              {rec.isBossAdvance && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                                  老闆私帳
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 text-center font-sans space-x-1">
                            {(rec.status === 'DRAFT' || rec.status === 'RETURNED') && canEditAccounting && (
                              <button
                                onClick={() => handleOpenEditRecModal(rec)}
                                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                                  rec.status === 'RETURNED'
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                                }`}
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>{rec.status === 'RETURNED' ? '重算修正' : '繼續編輯'}</span>
                              </button>
                            )}
                            {rec.status === 'APPROVED' && (
                              canEditCashier ? (
                                <>
                                  <button
                                    onClick={() => handleOpenPaymentModal(rec)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                                  >
                                    放款出金
                                  </button>
                                  <button
                                    onClick={() => {
                                      setReturnModalTargetRec(rec);
                                      setReturnReasonText('');
                                    }}
                                    className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 p-1 rounded transition-colors cursor-pointer"
                                    title="退回會計重算"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  已拋轉出納
                                </span>
                              )
                            )}
                            {canEditAccounting && rec.status !== 'VOIDED' && rec.status !== 'PAID' && (
                              <button
                                onClick={() => {
                                  setVoidModalTargetId(rec.id);
                                  setVoidReasonText('');
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                title="作廢對帳單 (進貨單回滾釋放回大水池)"
                              >
                                <Ban className="w-3.5 h-3.5" />
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
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB AR: 會計應收請款作業 (AR Billing & Collection Tracking) */}
      {/* ======================================================== */}
      {activeTab === 'AR_BILLING' && (() => {
        const scopedArList = arList.filter(a => matchesCompanyScope(a.companyId));
        const activeArs = scopedArList.filter(a => a.status === 'OPEN' || a.status === 'PARTIAL');
        const settledArs = scopedArList.filter(a => a.status === 'COLLECTED' || a.status === 'VOIDED');
        const totalOpenRemaining = activeArs.reduce((s, a) => s + a.remainingAmount, 0);
        const invoicedOpenTotal = activeArs.filter(a => a.hasInvoice !== false).reduce((s, a) => s + a.remainingAmount, 0);
        const noInvoiceOpenTotal = activeArs.filter(a => a.hasInvoice === false).reduce((s, a) => s + a.remainingAmount, 0);

        return (
          <div className="space-y-4">
            {/* 頂部應收結構與規則提示 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-800">
                    業主應收請款立帳管理（會計開單請款 ➔ 決定開票/免票 ➔ 送交出納收款對帳）
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {customerBillingMode === 'FINANCE_ONLY'
                      ? '目前對客表模式：A·會計統一'
                      : customerBillingMode === 'PROJECT_FIRST_HANDOFF'
                      ? '目前對客表模式：B·工務送審 ➔ 會計開票'
                      : '目前對客表模式：C·雙軌各自調用'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {projects.filter(p => !p.isDeleted && p.id !== 'PRJ-INTERNAL').length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        const p = projects.find(x => x.id === e.target.value);
                        if (p) setLedgerModalContext({ project: p, initialTab: 'LEDGER' });
                      }}
                      className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="">📊 開啟案場借貸總帳 / 對客明細表...</option>
                      {projects
                        .filter(p => !p.isDeleted && p.id !== 'PRJ-INTERNAL')
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            [{p.projectCode}] {p.name} ({p.ownerName || '-'})
                          </option>
                        ))}
                    </select>
                  )}
                  {canEditAr && (
                    <button
                      type="button"
                      onClick={() => handleOpenCreateArModal()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 text-xs cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>開立應收請款單 (AR)</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-bold">待收款總餘額 ({activeArs.length} 筆)</div>
                  <div className="text-lg font-mono font-black text-slate-900 mt-0.5">
                    NT$ {totalOpenRemaining.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200">
                  <div className="text-[11px] text-indigo-800 font-bold">🔒 有開發票 (嚴格限入開票公司戶)</div>
                  <div className="text-lg font-mono font-black text-indigo-800 mt-0.5">
                    NT$ {invoicedOpenTotal.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200">
                  <div className="text-[11px] text-amber-800 font-bold">🔓 免開發票 (可入老闆私帳／現金)</div>
                  <div className="text-lg font-mono font-black text-amber-800 mt-0.5">
                    NT$ {noInvoiceOpenTotal.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* 1. 待收款／部分收款應收單 */}
            <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>1. 待收款／部分收款應收請款單（已拋轉出納收款對帳）</span>
                </div>
                <span className="text-[11px] text-slate-400">出納收錢入帳後會即時同步此處已收金額</span>
              </div>

              {activeArs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">
                  <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-500 mb-1" />
                  <div className="font-bold text-slate-700">目前無待收款應收請款單</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeArs.map(ar => {
                    const comp = companies.find(c => c.id === ar.companyId);
                    const proj = projects.find(p => p.id === ar.projectId);
                    const cols = arCollections.filter(c => c.arId === ar.id && c.status !== 'VOIDED');
                    const hasInv = ar.hasInvoice !== false;
                    const allowEditThisAr = canEditArFor(ar.companyId);
                    const allowCollectThisAr = canEditCashierFor(ar.companyId);

                    return (
                      <div key={ar.id} className="border border-slate-200 rounded-xl p-3.5 bg-white hover:border-emerald-300 transition-all space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {ar.arNumber}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold">
                              {comp?.shortName || comp?.name || ar.companyId}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                              ar.invoiceNumber && ar.invoiceIssueMode === 'SELF_RETAINED'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : hasInv
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {ar.invoiceNumber && ar.invoiceIssueMode === 'SELF_RETAINED'
                                ? `🏷️ 自主報稅發票 ${ar.invoiceNumber} (公司自留)`
                                : hasInv
                                ? `🔒 ${ar.invoiceFormat === 'TWO_PART' ? '二聯' : '三聯'}發票 ${ar.invoiceNumber || '(待補)'}`
                                : '🔓 免開發票 · 可入私帳/現金'}
                            </span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            ar.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {ar.status === 'PARTIAL' ? '部分收款中' : '待收款'}
                          </span>
                        </div>

                        {ar.bouncedCheckNumber && (
                          <div className="p-2 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 text-[11px] font-bold">
                            ⚠️ 業主支票 [{ar.bouncedCheckNumber}] 退票跳票，餘額已回滾！{ar.bouncedReason ? `原因: ${ar.bouncedReason}` : ''}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">{ar.customerName}</span>
                            {ar.title?.includes('[工務對客明細送審]') && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold">
                                工務對客表送審 · 請確認開票/免票
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            案場: {ar.projectName || proj?.name || ar.projectId}
                            {ar.title ? ` · ${ar.title}` : ''}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                          <div>
                            <div className="text-[10px] text-slate-400 font-sans">請款總額</div>
                            <div className="font-bold text-slate-800">NT$ {ar.amount.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400 font-sans">已收／折讓</div>
                            <div className="font-bold text-emerald-700">NT$ {ar.appliedAmount.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400 font-sans">尚待收回</div>
                            <div className="font-black text-rose-700">NT$ {ar.remainingAmount.toLocaleString()}</div>
                          </div>
                        </div>

                        {cols.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <div className="text-[10px] font-bold text-slate-500">收款紀錄明細:</div>
                            {cols.map(c => (
                              <div key={c.id} className="text-[11px] flex items-center justify-between bg-emerald-50/50 border border-emerald-100 px-2 py-1 rounded">
                                <span className="truncate">
                                  {c.receivedDate} · {c.collectionMethod === 'CHECK' ? `支票 ${c.checkNumber}` : c.collectionMethod === 'SUSPENSE' ? '暫收認領' : c.collectionMethod === 'TT' ? '匯款' : '現金'} ({c.bankAccountName})
                                  {c.feeAmount > 0 ? ` · 折讓/匯費 NT$ ${c.feeAmount.toLocaleString()}` : ''}
                                </span>
                                <span className="font-mono font-bold text-emerald-800 shrink-0 ml-2">
                                  +NT$ {c.netReceivedAmount.toLocaleString()}
                                  {c.status === 'PENDING_CLEARANCE' ? ' (待兌)' : c.status === 'BOUNCED' ? ' (退票)' : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                          <span className="text-[11px] text-slate-400 font-mono">預計收款日: {ar.dueDate}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {proj && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setLedgerModalContext({ project: proj, initialTab: 'LEDGER', focusArId: ar.id })}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-200 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                                  title="檢視該案場借貸往來總帳與分批補開發票"
                                >
                                  <BookOpen className="w-3 h-3" />
                                  <span>借貸總帳</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setLedgerModalContext({ project: proj, initialTab: 'STATEMENT', focusArId: ar.id })}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded border border-emerald-200 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                                  title="產生給客人的簡潔請款／對帳明細表"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>對客明細表</span>
                                </button>
                              </>
                            )}
                            {allowEditThisAr && ar.appliedAmount === 0 && (
                              <button
                                type="button"
                                onClick={() => handleVoidAr(ar)}
                                className="px-2 py-1 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded border border-slate-200 text-[11px] font-bold cursor-pointer"
                              >
                                作廢
                              </button>
                            )}
                            {allowEditThisAr && (
                              <button
                                type="button"
                                onClick={() => handleOpenPostInvoiceModal(ar)}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold cursor-pointer"
                                title="支援後續補開（或分批多次補開）A公司發票，或自主開立留存報稅"
                              >
                                {ar.invoiceNumber ? '分批補開發票' : '後續補開發票'}
                              </button>
                            )}
                            {allowCollectThisAr && (
                              <button
                                type="button"
                                onClick={() => handleOpenCollectArModal(ar)}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                              >
                                <Zap className="w-3 h-3" />
                                <span>出納收款入帳</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. 已收齊／已作廢備查清冊 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  <span>2. 已收齊結清／已作廢應收備查清冊 ({settledArs.length} 筆)</span>
                </h3>
              </div>
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">應收單號</th>
                      <th className="p-2.5">公司／發票</th>
                      <th className="p-2.5">業主／案場</th>
                      <th className="p-2.5 text-right">應收總額</th>
                      <th className="p-2.5 text-right">實收累計</th>
                      <th className="p-2.5 text-center">狀態 / 後續補開</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {settledArs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-5 text-center text-slate-400 font-sans">尚無已結清或作廢應收單據</td>
                      </tr>
                    ) : (
                      settledArs.map(ar => {
                        const comp = companies.find(c => c.id === ar.companyId);
                        const proj = projects.find(p => p.id === ar.projectId);
                        const allowPostInv = ar.status === 'COLLECTED' && canEditArFor(ar.companyId);
                        return (
                          <tr key={ar.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">{ar.arNumber}</td>
                            <td className="p-2.5 font-sans">
                              <span className="font-bold text-purple-900">{comp?.shortName || comp?.name || ar.companyId}</span>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {ar.invoiceNumber
                                  ? `${ar.invoiceIssueMode === 'SELF_RETAINED' ? '自主報稅(自留): ' : '發票: '}${ar.invoiceNumber}`
                                  : ar.hasInvoice !== false
                                  ? '已開立發票'
                                  : '免開發票'}
                              </div>
                            </td>
                            <td className="p-2.5 font-sans">
                              <div className="font-bold text-slate-800">{ar.customerName}</div>
                              <div className="text-[10px] text-slate-500">{ar.projectName || ar.projectId}</div>
                            </td>
                            <td className="p-2.5 text-right font-bold">NT$ {ar.amount.toLocaleString()}</td>
                            <td className="p-2.5 text-right font-bold text-emerald-700">NT$ {ar.appliedAmount.toLocaleString()}</td>
                            <td className="p-2.5 text-center font-sans space-x-1.5">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                ar.status === 'COLLECTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {ar.status === 'COLLECTED' ? '已收齊結清' : '已作廢'}
                              </span>
                              {proj && (
                                <button
                                  type="button"
                                  onClick={() => setLedgerModalContext({ project: proj, initialTab: 'LEDGER', focusArId: ar.id })}
                                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-bold cursor-pointer"
                                >
                                  借貸帳
                                </button>
                              )}
                              {allowPostInv && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPostInvoiceModal(ar)}
                                  className="px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-bold cursor-pointer"
                                  title="請完款後自主分批開立銷項發票繳稅（可選公司自留或交付業主補稅）"
                                >
                                  {ar.invoiceNumber ? '分批補開發票' : '自主／補開發票'}
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
            </div>
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* TAB 2: 出納收付款工作台 (Treasury & Cashier: 應收收款 + 未知暫收 + 應付放款) */}
      {/* ======================================================== */}
      {activeTab === 'TREASURY_PAYMENT' && (
        <div className="space-y-4">
          {/* A-0. 出納應收待收款區 (收款入帳 · 有發票鎖定公司戶 / 免發票可入老闆私帳或現金) */}
          <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-emerald-100 pb-2">
              <div className="flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-800">
                  出納應收待收款清冊（客戶匯款／交票／付現 ➔ 入帳核對）
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canEditCashier && (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenQuickAdvanceModal}
                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                      title="已知業主/案場於尚未開請款單前先整筆匯款(如銀行貸款撥款/預付訂金)，直接掛入該案場借貸總帳"
                    >
                      <Plus className="w-3 h-3" />
                      <span>案場貸款／預收款直入</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenCreateSuspenseModal}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                      title="僅供完全無法辨認匯款人與案場之不明匯款使用"
                    >
                      <Plus className="w-3 h-3" />
                      <span>不明未知匯款 ➔ 暫收池</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {arList.filter(a => (a.status === 'OPEN' || a.status === 'PARTIAL') && matchesCompanyScope(a.companyId)).length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">
                目前選定法人無待收款之業主應收請款單；若收到未明匯款可點擊右上方放入暫收池。
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {arList
                  .filter(a => (a.status === 'OPEN' || a.status === 'PARTIAL') && matchesCompanyScope(a.companyId))
                  .map(ar => {
                    const comp = companies.find(c => c.id === ar.companyId);
                    const hasInv = ar.hasInvoice !== false;
                    const allowCollect = canEditCashierFor(ar.companyId);
                    return (
                      <div key={ar.id} className="border border-emerald-200 bg-emerald-50/20 rounded-xl p-3.5 flex flex-col justify-between text-xs">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              {ar.arNumber}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">到期: {ar.dueDate}</span>
                          </div>
                          {ar.bouncedCheckNumber && (
                            <div className="mt-1.5 px-2 py-1 rounded bg-rose-100 border border-rose-300 text-rose-900 text-[10px] font-bold">
                              ⚠️ 原票 [{ar.bouncedCheckNumber}] 跳票退回，請追討款項
                            </div>
                          )}
                          <h4 className="text-sm font-bold text-slate-900 mt-2 truncate">{ar.customerName}</h4>
                          <div className="text-[11px] text-slate-500 truncate">
                            {ar.projectName || ar.projectId}{ar.title ? ` · ${ar.title}` : ''}
                          </div>
                          <div className="mt-2 p-2 rounded-lg bg-white border border-slate-200/80 space-y-1 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-slate-500">入帳歸屬公司:</span>
                              <span className="font-bold text-purple-900">{comp?.shortName || comp?.name || ar.companyId}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">發票與資金規則:</span>
                              <span className={`font-bold ${hasInv && ar.invoiceIssueMode !== 'SELF_RETAINED' ? 'text-indigo-700' : 'text-amber-800'}`}>
                                {hasInv && ar.invoiceIssueMode !== 'SELF_RETAINED'
                                  ? `🔒 已開發票 (限入公司戶)`
                                  : ar.invoiceIssueMode === 'SELF_RETAINED'
                                  ? '🏷️ 自主報稅 (可入原定帳戶)'
                                  : '🔓 免票 (可入私帳/現金)'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">已收／總額:</span>
                              <span className="font-mono text-slate-700">
                                {ar.appliedAmount.toLocaleString()} / {ar.amount.toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="text-lg font-mono font-black text-emerald-700 mt-2">
                            尚待收 NT$ {ar.remainingAmount.toLocaleString()}
                          </div>
                        </div>
                        <div className="mt-3 pt-2 border-t border-emerald-200/60 flex justify-end">
                          {allowCollect ? (
                            <button
                              type="button"
                              onClick={() => handleOpenCollectArModal(ar)}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>收款入帳 (轉帳 / 支票 / 現金)</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">無此法人收款權限</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* A. 待放款應付對帳單清冊 (可直接點擊進行四柱出金或退回重算) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800">
                  出納待放款對帳清冊 (會計已審核立帳 · 由出納擇定付款方式與開票)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                四柱平衡驗證 · 出納依法人帳戶擇定支票／電匯／現金 · 有疑義可退回會計重算
              </span>
            </div>

            {reconciliations.filter(r => r.status === 'APPROVED').length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                <div className="font-bold text-slate-700">目前無待出納放款之應付對帳單！</div>
                <div className="text-[11px] text-slate-400 mt-1">若會計在對帳大水池中核准新單據，將自動匯入此清冊。</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {reconciliations.filter(r => r.status === 'APPROVED').map((rec) => {
                  const bp = partners.find(p => p.id === rec.vendorId);
                  const payComp = companies.find(c => c.id === rec.companyId);
                  const taxModeLabel = rec.taxType === 'TAX_EXCLUSIVE' ? '外加稅' : rec.taxType === 'TAX_INCLUSIVE' ? '內含稅' : '免稅';
                  return (
                    <div
                      key={rec.id}
                      className="border border-indigo-200/80 bg-indigo-50/20 rounded-xl p-3.5 hover:shadow-xs transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                            {rec.reconciliationNumber}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            帳務參考日: {rec.paymentDueDate}
                          </span>
                        </div>
                        {rec.bouncedCheckNumber && (
                          <div className="mt-1.5 px-2 py-1 rounded bg-rose-100 border border-rose-300 text-rose-900 text-[10px] font-bold">
                            ⚠️ 原票 [{rec.bouncedCheckNumber}] 退票待重付 {rec.bouncedReason ? `(${rec.bouncedReason})` : ''}
                          </div>
                        )}
                        <h4 className="text-sm font-bold text-slate-900 mt-2 truncate">
                          {rec.vendorName}
                        </h4>
                        <div className="text-xs text-slate-500 mt-0.5">
                          期別: {rec.billingPeriod} · 發票: {rec.invoiceNumber === 'NONE' ? '免用發票' : rec.invoiceNumber === 'PENDING_NEXT' ? '下期補票' : rec.invoiceNumber || '無'}
                        </div>

                        {/* 出納放款依據卡（顯示會計立帳歸屬公司、未稅／稅額拆分明細與廠商慣例） */}
                        <div className="mt-2 p-2 rounded-lg bg-white/90 border border-slate-200/80 space-y-1 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">立帳公司:</span>
                            <span className="font-bold text-purple-900">{payComp?.name || '未指定公司'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">進貨原額{rec.discountAmount > 0 ? ' (已扣折讓)' : ''}:</span>
                            <span className="font-mono text-slate-700">
                              NT$ {Math.max(0, rec.inboundTotalAmount - (rec.discountAmount || 0)).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">會計核定稅金 ({taxModeLabel}):</span>
                            <span className="font-mono font-bold text-indigo-700">
                              NT$ {rec.taxAmount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 shrink-0">廠商慣例:</span>
                            <span className="text-slate-700 truncate font-medium">
                              {bp?.paymentMethodNotes?.trim() || '未特別約定（請依可用專戶付款）'}
                            </span>
                          </div>
                          {rec.isBossAdvance && (
                            <div className="text-[10px] text-amber-900 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              👤 會計核可老闆私帳付款／代墊案件
                            </div>
                          )}
                          {rec.paymentTermNotes && (
                            <div className="text-[10px] text-amber-800 font-medium pt-0.5 border-t border-slate-100">
                              會計備註: {rec.paymentTermNotes}
                            </div>
                          )}
                        </div>

                        <div className="text-lg font-mono font-black text-indigo-700 mt-2">
                          NT$ {rec.netPayableAmount.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          匯費規則: {bp?.bankFeePayer === 'COMPANY' ? '公司外加吸收' : '廠商內扣 30 元'}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-indigo-200/50 flex items-center justify-between gap-2">
                        {canEditCashier ? (
                          <>
                            <button
                              onClick={() => {
                                setReturnModalTargetRec(rec);
                                setReturnReasonText('');
                              }}
                              className="px-2.5 py-1.5 border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="金額、稅額或買受公司有誤時，退回會計水池重新核算"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>退回重算</span>
                            </button>
                            <button
                              onClick={() => handleOpenPaymentModal(rec)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>選擇付款方式並出金</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-400">僅出納人員可執行放款</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* B. 已放款出金紀錄清冊 (PaymentRecord) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-800">
                  出納出金付款單歷史紀錄 (Payment Records)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                共 {payments.length} 筆放款紀錄
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">付款單號 / 狀態</th>
                    <th className="p-2.5">入帳日期</th>
                    <th className="p-2.5">受款對象</th>
                    <th className="p-2.5">出款帳戶</th>
                    <th className="p-2.5 text-center">支付方式</th>
                    <th className="p-2.5 text-right">實付總額</th>
                    <th className="p-2.5 text-center">存摺調節</th>
                    <th className="p-2.5">備註 / 作廢原因</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400 font-sans">
                        尚無出金付款單紀錄
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => {
                      const isVoided = p.status === 'VOIDED';
                      return (
                        <tr key={p.id} className={isVoided ? 'bg-rose-50/40 text-slate-400' : 'hover:bg-slate-50'}>
                          <td className="p-2.5">
                            <div className={`font-bold ${isVoided ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                              {p.paymentNo}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5 font-sans">
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                isVoided
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {isVoided ? 'VOIDED 已作廢沖銷' : 'POSTED 已過帳'}
                              </span>
                              {p.isBossAdvance && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                                  老闆私帳
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 font-sans">{p.postingDate}</td>
                          <td className="p-2.5 font-sans font-bold">
                            {p.partnerName || p.customVendorName}
                          </td>
                          <td className="p-2.5 font-sans">{p.bankAccountName}</td>
                          <td className="p-2.5 text-center font-sans">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              p.paymentMethod === 'CHECK' ? 'bg-amber-100 text-amber-800' :
                              p.paymentMethod === 'TT' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {p.paymentMethod === 'CHECK' ? '期票支票' : p.paymentMethod === 'TT' ? '電匯' : '現金'}
                            </span>
                          </td>
                          <td className={`p-2.5 text-right font-black ${isVoided ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                            NT$ {p.totalAmount.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-center font-sans">
                            {isVoided ? (
                              <span className="text-rose-500 font-bold">已沖銷</span>
                            ) : p.isReconciled ? (
                              <span className="text-emerald-600 font-bold">已調節</span>
                            ) : (
                              <span className="text-slate-400">未調節</span>
                            )}
                          </td>
                          <td className="p-2.5 font-sans text-slate-500 max-w-xs">
                            <div className="truncate">{p.notes || '-'}</div>
                            {isVoided && p.voidReason && (
                              <div className="text-[10px] text-rose-600 font-bold truncate">
                                作廢原因: {p.voidReason}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ======================================================== */}
      {/* TAB 3: 票據三燈號生命週期與資金雷達 (CheckRadarMiniApp 小程式) */}
      {/* ======================================================== */}
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

      {/* ======================================================== */}
      {/* TAB 4: 各公司統一發票主檔與未知暫收池 (按公司法人隔離) */}
      {/* ======================================================== */}
      {activeTab === 'INVOICE_PETTY_CASH' && (() => {
        const scopedSuspenses = suspenses.filter(s => matchesCompanyScope(s.companyId));
        const allowEditThisInvCompany = canEditArFor(invoiceCompanyId);

        return (
          <div className="space-y-4">
            {/* A. 未知款項暫收池小程式 */}
            <SuspensePoolMiniApp
              suspenses={scopedSuspenses}
              arList={arList}
              companies={companies}
              bankAccounts={bankAccounts}
              canEditCashier={canEditCashier}
              canEditAr={canEditAr}
              isBossPrivateAccount={isBossPrivateAccount}
              onOpenCreateSuspense={handleOpenCreateSuspenseModal}
              onAllocateSuspense={handleAllocateSuspense}
              onOpenCreateArForSuspense={(s) => handleOpenCreateArModal(s)}
            />

            {/* B. 各公司獨立 401 營業稅雙月試算活頁簿 · 預計請款模擬區 · 年度統整 */}
            <Tax401WorkbookPanel
              companies={authorizedCorps.length > 0 ? authorizedCorps : companies}
              partners={partners}
              projects={projects}
              invoices={invoices}
              plannedInvoices={plannedInvoices}
              companyTaxSettings={companyTaxSettings}
              selectedCompanyId={invoiceCompanyId}
              onSelectCompanyId={setInvoiceCompanyId}
              canEdit={allowEditThisInvCompany}
              taxRate={taxRate}
              operatorName={currentUser?.fullName || '會計專員'}
              onNotify={onNotify}
              onRefresh={loadAllFinanceData}
            />
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* MODAL 0: 廠商待請款進貨簽收單正中央檢視視窗 (Centered Modal) */}
      {/* ======================================================== */}
      {viewingVendorPool && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal 頂部標題與快速資訊 */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 rounded-xl text-amber-800 border border-amber-200">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      待對帳進貨簽收單清冊與送貨單明細
                    </h3>
                    <span className="font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full text-xs font-mono">
                      {viewingVendorPool.vendorName}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-200">
                      共 {viewingVendorPool.receipts.length} 筆簽收單
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                    <span>統一編號: <b className="font-mono text-slate-700">{viewingVendorPool.vendorTaxId || '未載明'}</b></span>
                    <span>約定付款天期: <b className="font-mono text-slate-700">T+{viewingVendorPool.paymentTermsDays} 天</b></span>
                    <span>匯費約定: <b className="text-slate-700">{viewingVendorPool.bankFeePayer === 'COMPANY' ? '公司外加吸收' : '廠商內扣'}</b></span>
                    {viewingVendorPool.paymentMethodNotes && (
                      <span>慣用付款備註: <b className="text-indigo-700">{viewingVendorPool.paymentMethodNotes}</b></span>
                    )}
                    <span>待請款未稅總原額: <b className="font-mono text-amber-900 font-black">NT$ {viewingVendorPool.totalAmount.toLocaleString()}</b></span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewingVendorPool(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                title="關閉視窗"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal 主體：進貨簽收單與展開送貨單明細列表 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/80">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <Info className="w-4 h-4 text-amber-700" />
                  <span>現場紙本簽收單調取清單 · 各送貨單工料明細已同步關聯展示</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = viewingVendorPool.receipts.map((r: any) => r.id);
                      setViewingModalExpandedReceiptIds(allIds);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-pointer text-xs"
                  >
                    全部展開明細
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingModalExpandedReceiptIds([])}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-semibold cursor-pointer text-xs"
                  >
                    全部收合
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {viewingVendorPool.receipts.map((r: any) => {
                  const isExp = viewingModalExpandedReceiptIds.includes(r.id);
                  const items = r.items || [];
                  const rComp = companies.find(c => c.id === r.companyId);

                  return (
                    <div key={r.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                      {/* 單據摘要條 */}
                      <div
                        onClick={() => {
                          if (isExp) {
                            setViewingModalExpandedReceiptIds(viewingModalExpandedReceiptIds.filter(id => id !== r.id));
                          } else {
                            setViewingModalExpandedReceiptIds([...viewingModalExpandedReceiptIds, r.id]);
                          }
                        }}
                        className="p-3.5 bg-slate-50/70 hover:bg-slate-100/70 transition-colors flex flex-wrap items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="p-1 rounded text-slate-400 hover:text-indigo-600"
                          >
                            {isExp ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 font-mono">
                              <span className="font-bold text-slate-900 text-sm">{r.receiptNumber}</span>
                              <span className="text-indigo-700 font-bold px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100">
                                送貨單號: {r.deliveryNoteNumber || '無單號'}
                              </span>
                              {rComp && (
                                <span className="text-[11px] font-sans px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold">
                                  原公司: {rComp.shortName || rComp.name}
                                </span>
                              )}
                              <span className="text-slate-600 font-sans text-xs">
                                簽收日: {r.receivedDate}
                              </span>
                              <span className="text-[11px] font-sans px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                {items.length} 項品名工料
                              </span>
                            </div>
                            <div className="text-slate-500 font-sans text-xs mt-1 flex flex-wrap items-center gap-3">
                              <span>工區案場: <b className="text-slate-700">{r.projectNameSnapshot || '未指定案場'}</b></span>
                              <span>現場簽收人: <b className="text-slate-700">{r.receivedBy || '現場人員'}</b></span>
                              {r.notes && <span>備註: <i className="text-slate-600">{r.notes}</i></span>}
                              {r.attachmentFileName && (
                                <span className="text-indigo-600 font-mono font-bold flex items-center gap-1">
                                  📎 附件: {r.attachmentFileName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[11px] text-slate-400">進貨簽收金額 (未稅)</div>
                          <div className="text-lg font-mono font-black text-slate-900">
                            NT$ {r.totalAmount.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* 展開之完整送貨單品項清單 */}
                      {isExp && (
                        <div className="p-3 border-t border-slate-200 bg-white">
                          {items.length === 0 ? (
                            <div className="p-3 text-center text-slate-400 text-xs">無品項明細紀錄</div>
                          ) : (
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full text-xs text-left border-collapse">
                                <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="p-2 w-10 text-center">#</th>
                                    <th className="p-2">材料品名</th>
                                    <th className="p-2">規格型號</th>
                                    <th className="p-2 text-center">單位</th>
                                    <th className="p-2 text-right">簽收數量</th>
                                    <th className="p-2 text-right">採購單價</th>
                                    <th className="p-2 text-right">小計金額</th>
                                    <th className="p-2">現場備註</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-mono">
                                  {items.map((it: any, itemIdx: number) => (
                                    <tr key={it.id || itemIdx} className="hover:bg-slate-50/80">
                                      <td className="p-2 text-center text-slate-400 font-sans">{itemIdx + 1}</td>
                                      <td className="p-2 font-bold text-slate-900 font-sans">{it.itemName}</td>
                                      <td className="p-2 text-slate-600 font-sans">{it.spec || '標準規格'}</td>
                                      <td className="p-2 text-center text-slate-600 font-sans">{it.unit}</td>
                                      <td className="p-2 text-right text-slate-800 font-bold">{it.quantity}</td>
                                      <td className="p-2 text-right text-slate-600">NT$ {it.unitPrice.toLocaleString()}</td>
                                      <td className="p-2 text-right font-black text-slate-900">NT$ {it.lineTotal.toLocaleString()}</td>
                                      <td className="p-2 text-slate-500 font-sans truncate max-w-xs">{it.notes || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal 底部按鈕 */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/90 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewingVendorPool(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer text-xs"
              >
                關閉視窗
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  共檢閱 {viewingVendorPool.receipts.length} 筆進貨簽收單
                </span>
                {canEditAccounting && (
                  <button
                    type="button"
                    onClick={() => {
                      const vId = viewingVendorPool.vendorId;
                      setViewingVendorPool(null);
                      handleOpenCreateRecModal(vId);
                    }}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors cursor-pointer text-xs shadow-2xs inline-flex items-center gap-1.5"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>直接建立對帳單 (帶入勾稽)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: 建立廠商應付對帳單 (抽屜勾稽大水池) */}
      {/* ======================================================== */}
      {isCreateRecModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal 頂部 */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {editingRecId
                    ? '重算修正應付對帳單（會計重新核對金額／稅額／發票後再送出納）'
                    : '開立廠商應付對帳單（會計只管帳・發票／稅額／進貨勾稽）'}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateRecModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal 內容區 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {editingReturnedReason && (
                <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 flex items-start gap-2.5 text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">🚨 出納退回重算通知</div>
                    <div className="text-xs text-rose-800 mt-0.5">退回原因：{editingReturnedReason}</div>
                  </div>
                </div>
              )}

              {/* 基本對帳資訊列 */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>對帳廠商 (Vendor)</span>
                      {recVendorLocked && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                          <Lock className="w-2.5 h-2.5" />
                          <span>依來源單據鎖定</span>
                        </span>
                      )}
                    </label>
                    {recVendorLocked ? (
                      (() => {
                        const lockedPartner = partners.find(p => p.id === recTargetVendorId);
                        const lockedPool = vendorPoolList.find(v => v.vendorId === recTargetVendorId);
                        const lockedName = lockedPartner?.name || lockedPool?.vendorName || '未知廠商';
                        const lockedTaxId = lockedPartner?.taxId || lockedPool?.vendorTaxId;
                        return (
                          <div
                            className="w-full bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-2 font-bold text-slate-800 flex items-center justify-between gap-2 select-none"
                            title="已鎖定為來源單據之對帳廠商，不可變更"
                          >
                            <span className="truncate">{lockedName}</span>
                            {lockedTaxId && (
                              <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                {lockedTaxId}
                              </span>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <select
                        value={recTargetVendorId}
                        onChange={(e) => handleVendorChangeInModal(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                      >
                        {vendorPoolList.map(v => (
                          <option key={v.vendorId} value={v.vendorId}>
                            {v.vendorName} (待對帳 {v.receipts.length} 筆)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      對帳期別 (Billing Period)
                    </label>
                    <input
                      type="month"
                      value={recBillingPeriod}
                      onChange={(e) => setRecBillingPeriod(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      營業稅模式（目前系統稅率 {taxRatePct}%）
                    </label>
                    <select
                      value={recTaxType}
                      onChange={(e: any) => {
                        const nextTax = e.target.value as 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT';
                        setRecTaxType(nextTax);
                        setRecManualTax('');
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                    >
                      <option value="TAX_EXCLUSIVE">外加 {taxRatePct}% 營業稅 (標準)</option>
                      <option value="TAX_INCLUSIVE">內含 {taxRatePct}% 營業稅</option>
                      <option value="TAX_EXEMPT">免稅 / 免用發票</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 廠商主檔慣用付款方式提示條 */}
              {(() => {
                const bp = partners.find(p => p.id === recTargetVendorId);
                if (!bp?.paymentMethodNotes) return null;
                return (
                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl px-3.5 py-2 flex items-center gap-2 text-xs text-indigo-900">
                    <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      廠商【<b>{bp.name}</b>】主檔付款慣例備註：<b className="text-indigo-700">{bp.paymentMethodNotes}</b>
                    </span>
                  </div>
                );
              })()}

              {/* 🏛️ 立帳歸屬法人與交辦出納條件（純會計區：只確認發票買受公司與備忘，付款方式與支票日由出納執行時決定） */}
              {(() => {
                const isNoInvoiceMode = !recHasInvoice || recTaxType === 'TAX_EXEMPT';
                return (
                  <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-700" />
                        <span className="font-bold text-slate-800 text-xs">
                          立帳歸屬法人與交辦出納條件（付款方式、銀行帳戶、支票號碼與到期日由出納放款時選填）
                        </span>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-amber-200 text-amber-900">
                        {isNoInvoiceMode
                          ? '✓ 免用發票內帳（出納可選老闆私帳／現金）'
                          : bossInvoicePolicy === 'ALLOW_BOSS_ADVANCE'
                          ? '做法 2：以發票買受公司為主 + 可核可老闆代墊'
                          : '做法 1：嚴格發票對應模式（僅限本法人帳戶或現金）'}
                      </span>
                    </div>

                    {!isNoInvoiceMode && bossInvoicePolicy === 'ALLOW_BOSS_ADVANCE' && (
                      <div className="bg-white/90 border border-amber-300 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-950 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={recIsBossAdvance}
                            onChange={(e) => setRecIsBossAdvance(e.target.checked)}
                            className="rounded border-amber-400 text-amber-600"
                          />
                          <span>特例：核可由老闆私帳代墊（股東往來 — 出納放款時將解鎖老闆私人帳戶／私帳支票）</span>
                        </label>
                        {recIsBossAdvance && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            已標記為老闆代墊
                          </span>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          買受／立帳法人公司 (Company) <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={recCompanyId}
                          onChange={(e) => handleRecCompanyChange(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                        >
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.taxId ? `(統編: ${c.taxId})` : ''}
                            </option>
                          ))}
                        </select>
                        <div className="text-[10px] text-slate-500 mt-1">
                          依發票買受人或內帳歸屬公司設定，後續出納將僅能由此公司名下帳戶付款。
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          給出納之對帳／付款條件備註 (Notes for Cashier)
                        </label>
                        <input
                          type="text"
                          value={recPaymentTermNotes}
                          onChange={(e) => setRecPaymentTermNotes(e.target.value)}
                          placeholder="例: 月結30天 / 工地完工結算 / 急件請優先安排"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none font-sans"
                        />
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {['月結30天', '依排程日開立期票', '工地現金結算'].map(preset => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setRecPaymentTermNotes(preset)}
                              className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-slate-50 text-[10px] rounded text-slate-600 font-medium cursor-pointer"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 勾稽進貨單清單 (以發票為主 + 顯示原進貨歸屬公司 + 篩選與跨公司提醒) */}
              {(() => {
                const editingRecObj = editingRecId ? reconciliations.find(x => x.id === editingRecId) : undefined;
                const editingAttachedSet = new Set(editingRecObj?.receiptIds || []);
                const vendorPendingAll = inboundReceipts.filter(
                  r =>
                    r.vendorId === recTargetVendorId &&
                    r.status === 'POSTED' &&
                    (r.billingStatus === 'PENDING_BILLING' || (editingRecId && (r.reconciliationId === editingRecId || editingAttachedSet.has(r.id))))
                );
                const visibleReceipts = recReceiptCompanyFilter === 'MATCH_COMPANY'
                  ? vendorPendingAll.filter(r => !r.companyId || r.companyId === recCompanyId)
                  : vendorPendingAll;
                const selectedMismatched = recCalculations.selectedReceipts.filter(
                  r => r.companyId && r.companyId !== recCompanyId
                );
                const selectedBuyerComp = companies.find(c => c.id === recCompanyId);

                return (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span>勾選本期核對之現場進貨簽收單</span>
                        <span className="text-slate-400 font-normal">
                          (已勾選 {recSelectedReceiptIds.length} 筆 · 可展開查看明細品項)
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setRecReceiptCompanyFilter('ALL')}
                            className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                              recReceiptCompanyFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'
                            }`}
                          >
                            顯示全部待對帳 ({vendorPendingAll.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecReceiptCompanyFilter('MATCH_COMPANY')}
                            className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                              recReceiptCompanyFilter === 'MATCH_COMPANY' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'
                            }`}
                          >
                            僅看此買受公司進貨單
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRecSelectedReceiptIds(visibleReceipts.map(r => r.id))}
                          className="text-indigo-600 font-bold hover:underline cursor-pointer"
                        >
                          全選顯示
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecSelectedReceiptIds([])}
                          className="text-slate-500 font-medium hover:underline cursor-pointer"
                        >
                          清空
                        </button>
                      </div>
                    </div>

                    {selectedMismatched.length > 0 && (
                      <div className="mb-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          <b>跨公司案場對帳提醒：</b>已勾選項目中有 {selectedMismatched.length} 筆原進貨歸屬公司與本次發票買受付款公司（<b>{selectedBuyerComp?.shortName || selectedBuyerComp?.name}</b>）不同。依「以發票為主」原則，本單將以買受公司出帳（案場原成本不變）。
                        </span>
                      </div>
                    )}

                    <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                      {visibleReceipts.length === 0 ? (
                        <div className="p-6 text-center text-slate-400">
                          {recReceiptCompanyFilter === 'MATCH_COMPANY' && vendorPendingAll.length > 0
                            ? '此買受公司名下目前無待對帳進貨單（可點上方「顯示全部待對帳」跨案場合併開發票）'
                            : '該廠商大水池中目前無待對帳進貨單'}
                        </div>
                      ) : (
                        visibleReceipts.map((rec) => {
                          const isChecked = recSelectedReceiptIds.includes(rec.id);
                          const isExpanded = expandedReceiptIds.includes(rec.id);
                          const rComp = companies.find(c => c.id === rec.companyId);
                          const isDiffCompany = Boolean(rec.companyId && rec.companyId !== recCompanyId);

                          return (
                            <div key={rec.id} className="transition-colors">
                              <div
                                onClick={() => {
                                  if (isChecked) {
                                    setRecSelectedReceiptIds(recSelectedReceiptIds.filter(id => id !== rec.id));
                                  } else {
                                    setRecSelectedReceiptIds([...recSelectedReceiptIds, rec.id]);
                                  }
                                }}
                                className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                                  isChecked ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isExpanded) {
                                        setExpandedReceiptIds(expandedReceiptIds.filter(id => id !== rec.id));
                                      } else {
                                        setExpandedReceiptIds([...expandedReceiptIds, rec.id]);
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                                    title={isExpanded ? '收合商品品項明細' : '展開檢視商品品項明細'}
                                  >
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4" />}
                                  </button>

                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-indigo-600 rounded"
                                  />

                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono font-bold text-slate-900">{rec.receiptNumber}</span>
                                      <span className="text-indigo-700 font-mono font-semibold">送貨單: {rec.deliveryNoteNumber}</span>
                                      {rComp && (
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${
                                          isDiffCompany
                                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                                            : 'bg-purple-50 text-purple-800 border-purple-200'
                                        }`}>
                                          {rComp.shortName || rComp.name}
                                        </span>
                                      )}
                                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-sans">
                                        {rec.receivedDate}
                                      </span>
                                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-mono font-bold">
                                        {rec.items?.length || 0} 個品項
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                      案場: {rec.projectNameSnapshot} · 現場簽收人: {rec.receivedBy}
                                      {rec.notes && ` · 備註: ${rec.notes}`}
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="font-mono font-black text-slate-900">
                                    NT$ {rec.totalAmount.toLocaleString()}
                                  </div>
                                </div>
                              </div>

                              {/* 展開之進貨簽收單完整工料明細 (直接拉自進貨單原始資料) */}
                              {isExpanded && (
                                <div className="bg-slate-50 p-3 pl-11 border-t border-slate-200 text-xs">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="font-bold text-slate-700 flex items-center gap-1.5 text-[11px]">
                                      <span>📦 進貨簽收單明細清冊 (原始調取資料)</span>
                                    </div>
                                    {rec.attachmentFileName && (
                                      <span className="text-[10px] text-indigo-600 font-mono font-bold">
                                        📎 簽單附件: {rec.attachmentFileName}
                                      </span>
                                    )}
                                  </div>

                                  {(!rec.items || rec.items.length === 0) ? (
                                    <div className="text-slate-400 py-2 text-center text-[10px]">無工料明細品項</div>
                                  ) : (
                                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                      <table className="w-full text-[11px] text-left border-collapse">
                                        <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                          <tr>
                                            <th className="p-1.5 w-8 text-center">#</th>
                                            <th className="p-1.5">材料/品名名稱</th>
                                            <th className="p-1.5">規格/型號</th>
                                            <th className="p-1.5 text-center">單位</th>
                                            <th className="p-1.5 text-right">簽收數量</th>
                                            <th className="p-1.5 text-right">採購單價</th>
                                            <th className="p-1.5 text-right">金額小計</th>
                                            <th className="p-1.5">現場簽收備註</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono">
                                          {rec.items.map((it, idx) => (
                                            <tr key={it.id || idx} className="hover:bg-slate-50/70">
                                              <td className="p-1.5 text-center text-slate-400">{idx + 1}</td>
                                              <td className="p-1.5 font-bold text-slate-900 font-sans">{it.itemName}</td>
                                              <td className="p-1.5 text-slate-600 font-sans">{it.spec || '標準規格'}</td>
                                              <td className="p-1.5 text-center text-slate-600 font-sans">{it.unit}</td>
                                              <td className="p-1.5 text-right text-slate-800">{it.quantity}</td>
                                              <td className="p-1.5 text-right text-slate-600">NT$ {it.unitPrice.toLocaleString()}</td>
                                              <td className="p-1.5 text-right font-black text-slate-900">NT$ {it.lineTotal.toLocaleString()}</td>
                                              <td className="p-1.5 text-slate-500 font-sans max-w-xs truncate">{it.notes || '—'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 折讓抹零與發票輸入 (粉紅折讓防呆) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-200">
                  <label className="block text-[11px] font-bold text-rose-800 mb-1">
                    廠商折讓扣款 / 尾數抹零 (粉紅減項)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={recDiscountAmount || ''}
                      onChange={(e) => setRecDiscountAmount(Math.max(0, Number(e.target.value)))}
                      placeholder="0 (輸入正數，系統自動扣減)"
                      className="w-full bg-white border border-rose-300 rounded-lg p-2 font-mono font-bold text-rose-800 outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <span className="absolute right-3 top-2 text-rose-400 font-mono text-xs">NT$</span>
                  </div>
                  <span className="text-[10px] text-rose-600 mt-1 block">
                    憲法鐵律：儲存為絕對正數，系統於過帳時自動進行四柱減項。
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      發票字軌號碼
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!recHasInvoice}
                        onChange={(e) => {
                          const noInv = e.target.checked;
                          setRecHasInvoice(!noInv);
                        }}
                      />
                      <span>免用發票 / 無發票</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    disabled={!recHasInvoice}
                    value={recInvoiceNumber}
                    onChange={(e) => setRecInvoiceNumber(e.target.value.toUpperCase())}
                    placeholder={recHasInvoice ? "例如: TC-88992211" : "免用統一發票"}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {recHasInvoice ? "台灣發票字軌 (英文2碼 + 8碼數字)" : "若當期未取具發票，標記為下期補票"}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      發票手動稅額 (容差 ±{taxTolerance} 元)
                    </label>
                    {recManualTax.trim() !== '' && recTaxType !== 'TAX_EXEMPT' && (
                      <button
                        type="button"
                        onClick={() => setRecManualTax('')}
                        className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        重設為試算稅額
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    disabled={recTaxType === 'TAX_EXEMPT'}
                    value={recTaxType === 'TAX_EXEMPT' ? '0' : recManualTax}
                    onChange={(e) => setRecManualTax(e.target.value)}
                    placeholder={`系統試算 (${taxRatePct}%): NT$ ${recCalculations.autoTax}`}
                    className={`w-full bg-white border rounded-lg p-2 font-mono font-bold outline-none disabled:bg-slate-100 disabled:text-slate-400 ${
                      !recCalculations.isTaxToleranceValid ? 'border-rose-500 text-rose-600 ring-1 ring-rose-500' : 'border-slate-300 text-slate-800'
                    }`}
                  />
                  <span className={`text-[10px] mt-1 block ${!recCalculations.isTaxToleranceValid ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                    {recTaxType === 'TAX_EXEMPT'
                      ? '免稅 / 免用發票模式：營業稅固定為 NT$ 0'
                      : !recCalculations.isTaxToleranceValid
                      ? `⚠️ 差異 NT$ ${recCalculations.taxDiff} 超出全域容差 ±${taxTolerance} 元！`
                      : `系統試算 NT$ ${recCalculations.autoTax} · 實際採用 NT$ ${recCalculations.finalTax}`}
                  </span>
                </div>
              </div>

              {/* 對帳計算結果卡片 */}
              <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] text-indigo-900 font-bold">
                    本期對帳結算 (送交出納之確定金額與稅額)
                  </div>
                  <div className="text-xs text-indigo-700 mt-0.5">
                    {recTaxType === 'TAX_EXCLUSIVE'
                      ? `未稅進貨 NT$ ${recCalculations.inboundTotal.toLocaleString()} - 折讓 NT$ ${recCalculations.discount.toLocaleString()} + 營業稅 NT$ ${recCalculations.finalTax.toLocaleString()}`
                      : recTaxType === 'TAX_INCLUSIVE'
                      ? `未稅銷售額 NT$ ${recCalculations.netExclusiveAmount.toLocaleString()} + 營業稅 NT$ ${recCalculations.finalTax.toLocaleString()} = 含稅總額 NT$ ${recCalculations.netPayable.toLocaleString()}（原額 ${recCalculations.inboundTotal.toLocaleString()} - 折讓 ${recCalculations.discount.toLocaleString()}）`
                      : `免稅進貨 NT$ ${recCalculations.inboundTotal.toLocaleString()} - 折讓 NT$ ${recCalculations.discount.toLocaleString()}（免計稅額）`}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-slate-500">
                    核定營業稅：NT$ {recCalculations.finalTax.toLocaleString()} · 本期應付淨額
                  </div>
                  <div className="text-2xl font-mono font-black text-indigo-700">
                    NT$ {recCalculations.netPayable.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal 底部按鈕 */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => setIsCreateRecModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer text-xs"
              >
                取消
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={isSavingRec}
                  onClick={() => handleSaveReconciliation(false, false)}
                  className="px-4 py-2 border border-indigo-300 bg-white text-indigo-700 rounded-lg font-bold hover:bg-indigo-50 transition-colors cursor-pointer text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingRec ? '處理中...' : '存為草稿 (暫存)'}
                </button>
                <button
                  disabled={isSavingRec || !recCalculations.isTaxToleranceValid}
                  onClick={() => handleSaveReconciliation(true, false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors cursor-pointer text-xs shadow-2xs disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {isSavingRec ? '處理中...' : '核准對帳立帳（送交出納）'}
                </button>
                {canEditCashier && (
                  <button
                    disabled={isSavingRec || !recCalculations.isTaxToleranceValid}
                    onClick={() => handleSaveReconciliation(true, true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors cursor-pointer text-xs shadow-2xs disabled:bg-slate-300 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    title="一人兼任快捷鍵：核准立帳後直接開啟出納付款單選擇付款方式"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{isSavingRec ? '處理中...' : '核准立帳 ＋ 立即出納付款'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: 出納放款出金 Modal (出納決定付款方式、專戶、支票號與到期日) */}
      {/* ======================================================== */}
      {isPaymentModalOpen && selectedRecForPayment && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  出納出金付款單（付款方式擇定 · 四柱平衡檢核 · 支票到期排程）
                </h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* 單據來源快照（會計已核准立帳之資訊） */}
              {(() => {
                const bpSnapshot = partners.find(p => p.id === selectedRecForPayment.vendorId);
                const taxModeText = selectedRecForPayment.taxType === 'TAX_EXCLUSIVE'
                  ? '外加稅'
                  : selectedRecForPayment.taxType === 'TAX_INCLUSIVE'
                  ? '內含稅'
                  : '免稅';
                return (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                          {selectedRecForPayment.reconciliationNumber}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200">
                          {companies.find(c => c.id === selectedRecForPayment.companyId)?.name || '指定公司'} 立帳
                        </span>
                        {selectedRecForPayment.isBossAdvance && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            老闆私帳核可
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-1">
                        {selectedRecForPayment.vendorName}
                      </div>
                      <div className="text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>發票: {selectedRecForPayment.invoiceNumber === 'NONE' ? '免用發票' : selectedRecForPayment.invoiceNumber === 'PENDING_NEXT' ? '下期補票' : selectedRecForPayment.invoiceNumber}</span>
                        {bpSnapshot?.paymentMethodNotes && (
                          <span className="text-indigo-700 font-semibold">· 廠商慣例: {bpSnapshot.paymentMethodNotes}</span>
                        )}
                        {selectedRecForPayment.paymentTermNotes && (
                          <span className="text-amber-800 font-semibold">· 會計備註: {selectedRecForPayment.paymentTermNotes}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">
                        本金 NT$ {Math.max(0, selectedRecForPayment.inboundTotalAmount - (selectedRecForPayment.discountAmount || 0)).toLocaleString()} · 稅額 ({taxModeText}) <b className="text-indigo-700">NT$ {selectedRecForPayment.taxAmount.toLocaleString()}</b>
                      </div>
                      <div className="text-[10px] text-slate-400">應付總額期望值</div>
                      <div className="text-xl font-mono font-black text-indigo-700">
                        NT$ {selectedRecForPayment.netPayableAmount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 出款帳戶與方式 (嚴格跟隨發票買受公司，並套用 Superadmin 老闆私帳政策) */}
              {(() => {
                const isNoInv = !selectedRecForPayment.hasInvoice || selectedRecForPayment.taxType === 'TAX_EXEMPT';
                const allowBoss = isNoInv || Boolean(selectedRecForPayment.isBossAdvance) || (bossInvoicePolicy === 'ALLOW_BOSS_ADVANCE' && payIsBossAdvance);
                const eligibleBanks = getEligibleBanks(selectedRecForPayment.companyId, allowBoss);
                const allowedMethods = getAllowedPaymentMethods(eligibleBanks);
                const methodBanks = filterBanksForMethod(eligibleBanks, payMethod);

                return (
                  <div className="space-y-3">
                    {!isNoInv && bossInvoicePolicy === 'ALLOW_BOSS_ADVANCE' && (
                      <div className="bg-amber-50/60 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-950 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={payIsBossAdvance}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPayIsBossAdvance(checked);
                              const { targetMethod, targetBankId } = syncPaySelectionForRec(
                                selectedRecForPayment,
                                checked || Boolean(selectedRecForPayment.isBossAdvance)
                              );
                              if (targetMethod === 'CHECK') {
                                const { days } = resolveScheduleInfo(selectedRecForPayment.companyId, targetBankId === 'CASH' ? undefined : targetBankId);
                                setPayCheckDueDate(pickNearestScheduleDate(days));
                              }
                            }}
                            className="rounded border-amber-400 text-amber-600"
                          />
                          <span>特例：由老闆私帳代墊（股東往來 — 解鎖老闆私人帳戶／私帳支票）</span>
                        </label>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          支付方式 (出納依本公司帳戶支援擇定) <span className="text-rose-500">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            disabled={!allowedMethods.canCheck}
                            onClick={() => handlePayMethodChange('CHECK')}
                            className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all text-center ${
                              !allowedMethods.canCheck
                                ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                                : payMethod === 'CHECK'
                                ? 'bg-amber-600 text-white border-amber-700 shadow-2xs cursor-pointer'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer'
                            }`}
                          >
                            期票支票
                          </button>
                          <button
                            type="button"
                            disabled={!allowedMethods.canTT}
                            onClick={() => handlePayMethodChange('TT')}
                            className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all text-center ${
                              !allowedMethods.canTT
                                ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                                : payMethod === 'TT'
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs cursor-pointer'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer'
                            }`}
                          >
                            電匯轉帳
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePayMethodChange('CASH')}
                            className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center ${
                              payMethod === 'CASH'
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            現金支付
                          </button>
                        </div>
                        {!allowedMethods.canTT && !allowedMethods.canCheck && (
                          <span className="text-[10px] text-amber-700 font-bold mt-1 block">
                            ⚠️ 本買受公司未設定可用銀行帳戶，已鎖定為現金支付。
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          出款銀行帳戶 (嚴格限定本法人 / 核可私帳)
                        </label>
                        {payMethod === 'CASH' ? (
                          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-[11px]">
                            💵 現金支付（公司現金櫃檯 / 零用金直付，免選銀行帳戶）
                          </div>
                        ) : (
                          <select
                            value={payBankAccountId}
                            onChange={(e) => handleBankChangeInPayment(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                          >
                            {methodBanks.map(b => (
                              <option key={b.id} value={b.id}>
                                {isBossPrivateAccount(b) ? '[老闆私人專戶] ' : ''}{b.bankName} {b.branchName || ''} - 帳號: {b.accountNumber}
                              </option>
                            ))}
                          </select>
                        )}
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          依發票買受公司嚴格篩選帳戶（禁止跨公司錯帳）；銀行存摺真實餘額不對出納揭露。
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 若選支票，展開連續期票號碼 ＋ 三個月排程快選與票期設定 */}
              {payMethod === 'CHECK' && (() => {
                const { days: activeScheduleDays, sourceLabel } = resolveScheduleInfo(
                  selectedRecForPayment.companyId,
                  payBankAccountId && payBankAccountId !== 'CASH' ? payBankAccountId : undefined
                );
                const threeMonthRows = getThreeMonthScheduleRows(activeScheduleDays);
                const bp = partners.find(p => p.id === selectedRecForPayment.vendorId);
                const partnerTerm = bp?.paymentTermsDays;
                const baseTerms = [0, 30, 45, 60, 90];
                const termOptions = partnerTerm && !baseTerms.includes(partnerTerm)
                  ? [...baseTerms, partnerTerm].sort((a, b) => a - b)
                  : baseTerms;

                return (
                  <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-amber-900">
                            支票票號 (可自由修正)
                          </label>
                          <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                            ✓ 本帳戶連續票號
                          </span>
                        </div>
                        <input
                          type="text"
                          value={payCheckNumber}
                          onChange={(e) => setPayCheckNumber(e.target.value)}
                          placeholder="CQ-2026001"
                          className="w-full bg-white border border-amber-300 rounded-lg p-2 font-mono font-bold text-slate-900 outline-none"
                        />
                        <div className="text-[10px] text-slate-500 mt-1">
                          預設帶入本帳戶連續下張票號，若跳號或人工填票可直接修改。
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                            <span>預計付款日／支票到期日</span>
                          </label>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 truncate max-w-[180px]" title={sourceLabel}>
                            {sourceLabel}
                          </span>
                        </div>
                        <input
                          type="date"
                          value={payCheckDueDate}
                          onChange={(e) => setPayCheckDueDate(e.target.value)}
                          className="w-full bg-white border border-amber-300 rounded-lg p-2 font-mono font-bold text-slate-900 outline-none"
                        />
                        <div className="text-[10px] text-amber-800 mt-1">
                          💡 入帳時先掛黃燈期票，到期兌現後才扣存摺真實餘額。
                        </div>
                      </div>
                    </div>

                    {/* 三個月固定排程日快捷按鈕 (當月 / 下月 / 下下月，跨年度顯示 YYYY/M/D) + 票期快選 */}
                    <div className="bg-white rounded-xl border border-amber-200/80 p-3 space-y-1.5">
                      {threeMonthRows.map(row => (
                        <div key={row.offset} className="flex flex-wrap items-center gap-1.5">
                          <span className="w-20 shrink-0 text-[10px] font-bold text-slate-500">
                            {row.monthLabel} ({row.yearMonthLabel})
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {row.items.map(item => (
                              <button
                                key={item.ymd}
                                type="button"
                                onClick={() => setPayCheckDueDate(item.ymd)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                                  payCheckDueDate === item.ymd
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300'
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-dashed border-slate-200">
                        <span className="w-20 shrink-0 text-[10px] font-bold text-amber-800">
                          票期快選
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {termOptions.map(days => {
                            const termDate = computeTermsPaymentDate(days);
                            const isPartnerDefault = partnerTerm === days;
                            return (
                              <button
                                key={days}
                                type="button"
                                onClick={() => setPayCheckDueDate(termDate)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                                  payCheckDueDate === termDate
                                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                    : 'bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100'
                                }`}
                              >
                                {days === 0 ? '即期 (0天)' : `${days}天票`}{isPartnerDefault ? ' · 廠商約定' : ''}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 匯費與代扣款設定 (手續費僅在支付方式為電匯/轉帳 TT 時才顯示，防呆隔離) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {payMethod === 'TT' ? (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        跨行轉帳手續費
                      </label>
                      <label className="flex items-center gap-1 text-[11px] text-indigo-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={payIsFeeAbsorbed}
                          onChange={(e) => setPayIsFeeAbsorbed(e.target.checked)}
                        />
                        <span>公司外加吸收</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={payFeeAmount}
                        onChange={(e) => setPayFeeAmount(Number(e.target.value))}
                        className="w-24 bg-white border border-slate-300 rounded-lg p-1.5 font-mono font-bold"
                      />
                      <span className="text-slate-500 text-[11px]">
                        {payIsFeeAbsorbed ? '公司吸收：實付不扣' : '廠商吸收：由實付金額中內扣 30 元'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-slate-500">
                    <div>
                      <div className="font-bold text-slate-700 text-[11px]">跨行轉帳手續費</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {payMethod === 'CHECK' ? '支票支付免跨行轉帳手續費 (NT$ 0)' : '現金支付免轉帳手續費 (NT$ 0)'}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                      免手續費
                    </span>
                  </div>
                )}

                <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-200">
                  <label className="block text-[11px] font-bold text-rose-800 mb-1">
                    現場代扣款 (便當/粗工代墊轉扣)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={payDeductionAmount || ''}
                    onChange={(e) => setPayDeductionAmount(Math.max(0, Number(e.target.value)))}
                    placeholder="0 (輸入正數，沖減實付)"
                    className="w-full bg-white border border-rose-300 rounded-lg p-1.5 font-mono font-bold text-rose-800 outline-none"
                  />
                  <input
                    type="text"
                    value={payDeductionNote}
                    onChange={(e) => setPayDeductionNote(e.target.value)}
                    placeholder="代扣款說明 (如: 代墊工區粗工清潔費)"
                    className="w-full bg-white border border-rose-200 rounded-lg p-1 mt-1 text-[11px]"
                  />
                </div>
              </div>

              {/* 四柱平衡即時結算 */}
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-emerald-900">
                    四柱平衡校驗 (Four-Column Balancing)
                  </div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    {payMethod === 'TT' && payIsFeeAbsorbed
                      ? `實付 NT$ ${paymentCalculations.actualDisburse.toLocaleString()} + 代扣 NT$ ${(paymentCalculations.deduction || 0).toLocaleString()} = 應付 NT$ ${paymentCalculations.expectedTotal.toLocaleString()}（另計公司吸收匯費 NT$ ${paymentCalculations.fee.toLocaleString()}）`
                      : payMethod === 'TT' && !payIsFeeAbsorbed
                      ? `實付 NT$ ${paymentCalculations.actualDisburse.toLocaleString()} + 廠商內扣匯費 NT$ ${paymentCalculations.fee.toLocaleString()} + 代扣 NT$ ${(paymentCalculations.deduction || 0).toLocaleString()} = 應付 NT$ ${paymentCalculations.expectedTotal.toLocaleString()}`
                      : `實付 NT$ ${paymentCalculations.actualDisburse.toLocaleString()} + 代扣 NT$ ${(paymentCalculations.deduction || 0).toLocaleString()} = 應付 NT$ ${paymentCalculations.expectedTotal.toLocaleString()}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">實際出金放款金額</div>
                  <div className="text-2xl font-mono font-black text-emerald-700">
                    NT$ {paymentCalculations.actualDisburse.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                >
                  取消
                </button>
                {canEditCashier && (
                  <button
                    type="button"
                    onClick={() => {
                      setReturnModalTargetRec(selectedRecForPayment);
                      setReturnReasonText('');
                    }}
                    className="px-3.5 py-2 border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 rounded-lg font-bold transition-colors cursor-pointer text-xs inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>退回會計重算</span>
                  </button>
                )}
              </div>
              <button
                disabled={!paymentCalculations.isBalanced}
                onClick={handleConfirmPayment}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors cursor-pointer text-xs shadow-2xs disabled:bg-slate-300"
              >
                核准出金過帳
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 支票動作與重新關聯已抽離封裝於獨立小程式 CheckRadarMiniApp */}

      {/* ======================================================== */}
      {/* MODAL 4: 作廢對帳單確認 (進貨單回滾釋放) */}
      {/* ======================================================== */}
      {voidModalTargetId && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>作廢應付對帳單 (水池回滾防線)</span>
              </h3>
              <button onClick={() => setVoidModalTargetId(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600 leading-relaxed">
              您確定要作廢此筆應付對帳單嗎？作廢後：
              <br />
              1. <b>原先勾選的所有現場進貨簽收單將瞬間釋放回待對帳大水池</b>。
              <br />
              2. 狀態還原為 <code className="bg-amber-100 text-amber-800 px-1 rounded font-mono">PENDING_BILLING</code>，便於會計於下期重新勾選開單。
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                作廢原因 (留痕稽核)
              </label>
              <textarea
                rows={2}
                value={voidReasonText}
                onChange={(e) => setVoidReasonText(e.target.value)}
                placeholder="例如: 發票金額開錯需由廠商重開..."
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setVoidModalTargetId(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs"
              >
                取消
              </button>
              <button
                onClick={handleConfirmVoidReconciliation}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-2xs"
              >
                確認作廢並釋放單據
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5 已移入 CheckRadarMiniApp 獨立小程式 */}

      {/* ======================================================== */}
      {/* MODAL 6: 出納退回對帳單請會計重算 (Return AP to Accounting) */}
      {/* ======================================================== */}
      {returnModalTargetRec && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                <span>退回對帳單給會計重新核算</span>
              </h3>
              <button onClick={() => setReturnModalTargetRec(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">對帳單號：</span>
                <span className="font-mono font-bold text-slate-900">{returnModalTargetRec.reconciliationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">受款廠商：</span>
                <span className="font-bold text-slate-800">{returnModalTargetRec.vendorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">原核定稅額 / 應付總額：</span>
                <span className="font-mono font-bold text-indigo-700">
                  稅 NT$ {returnModalTargetRec.taxAmount.toLocaleString()} ／ 總額 NT$ {returnModalTargetRec.netPayableAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                退回會計重算原因 <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1 mb-2">
                {[
                  '營業稅額與紙本發票不符，請重算',
                  '買受法人公司誤植，請確認統編',
                  '應扣折讓／尾數未扣除',
                  '勾稽進貨單據需調整',
                ].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReturnReasonText(preset)}
                    className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded text-[10px] font-bold cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                value={returnReasonText}
                onChange={(e) => setReturnReasonText(e.target.value)}
                placeholder="請說明需退回會計重算的細節（例如：紙本發票稅額為 NT$ 502，非 500）..."
                className="w-full bg-white border border-rose-300 rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-rose-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                退回後此單據將移出出納待放款清單，並於會計對帳水池亮起紅燈提醒修正。
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setReturnModalTargetRec(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleConfirmReturnToAccounting}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer"
              >
                確認退回會計重算
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 7: 會計開立應收請款單 (Create AR Billing) */}
      {/* ======================================================== */}
      {isCreateArModalOpen && (() => {
        const selectableArProjects = projects.filter(p => {
          if (p.isDeleted || p.id === 'PRJ-INTERNAL') return false;
          const isUnassigned = !p.companyId || p.companyId === 'UNASSIGNED';
          if (!isUnassigned && authorizedCorpIds.size > 0 && !authorizedCorpIds.has(p.companyId)) return false;
          if (pendingClaimSuspense && pendingClaimSuspense.companyId !== 'BOSS-01') {
            return isUnassigned || p.companyId === pendingClaimSuspense.companyId;
          }
          return true;
        });
        const selectedArProj = projects.find(p => p.id === arProjectId);
        const lockedContract = resolveProjectArContract(selectedArProj, arCompanyId);
        const projActiveArs = selectedArProj
          ? arList.filter(a => a.projectId === selectedArProj.id && a.status !== 'VOIDED')
          : [];
        const projBilledInvoiced = projActiveArs.filter(a => a.hasInvoice !== false).reduce((s, a) => s + a.amount, 0);
        const projBilledNoInv = projActiveArs.filter(a => a.hasInvoice === false).reduce((s, a) => s + a.amount, 0);
        const projBilledTotal = projBilledInvoiced + projBilledNoInv;
        const projContractAmt = selectedArProj?.contractAmount || 0;
        const projRemainingBillable = Math.max(0, projContractAmt - projBilledTotal);
        const projAfterThisTotal = projBilledTotal + arTaxPreview.total;
        const isOverContract = projContractAmt > 0 && projAfterThisTotal > projContractAmt;
        const suspRemainingBannerAmt = pendingClaimSuspense
          ? (pendingClaimSuspense.remainingAmount ?? (pendingClaimSuspense.isAllocated ? 0 : pendingClaimSuspense.amount))
          : 0;

        return (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-xs animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-200 bg-emerald-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {pendingClaimSuspense ? '補開應收請款單並認領暫收款' : '會計開立業主應收請款單 (AR)'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    已指定簽約公司之案場將自動鎖定公司與業主；未綁定簽約公司之案場可於請款時指定開票／入帳公司
                  </p>
                </div>
              </div>
              <button onClick={() => { setIsCreateArModalOpen(false); setPendingClaimSuspense(null); }} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {pendingClaimSuspense && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold">🔗 綁定認領未知暫收款：{pendingClaimSuspense.bankAccountName}</div>
                    <div className="text-[11px] mt-0.5">來源附言：{pendingClaimSuspense.payerInfo}（{pendingClaimSuspense.receivedDate}）</div>
                    <div className="text-[10px] text-amber-700 mt-0.5">
                      若本次開立請款金額小於大水池餘額，剩餘金額會自動保留在暫收池供後續拆單繼續沖銷！
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-amber-700 font-bold">尚餘可認領額</div>
                    <div className="text-base font-mono font-black">NT$ {suspRemainingBannerAmt.toLocaleString()}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    1. 工程專案案場（選定後自動鎖定合約業主與承攬公司） <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={arProjectId}
                    onChange={(e) => {
                      const nextPid = e.target.value;
                      setArProjectId(nextPid);
                      const nextProj = projects.find(p => p.id === nextPid);
                      const nextContract = resolveProjectArContract(nextProj, arCompanyId);
                      setArCompanyId(nextContract.companyId);
                      setArCustomerId(nextContract.customerId);
                      const hasTax = /^\d{8}$/.test((nextContract.customerTaxId || '').trim());
                      const nextFmt: 'THREE_PART' | 'TWO_PART' = hasTax ? 'THREE_PART' : 'TWO_PART';
                      setArInvoiceFormat(nextFmt);
                      if (arHasInvoice) {
                        setArTaxType(nextFmt === 'TWO_PART' ? 'TAX_INCLUSIVE' : 'TAX_EXCLUSIVE');
                      }
                    }}
                    className="w-full bg-white border-2 border-indigo-300 rounded-lg p-2 font-bold text-slate-900 outline-none focus:border-indigo-500"
                  >
                    <option value="">-- 請選擇工程案場 --</option>
                    {selectableArProjects.map(p => {
                      const isUnassigned = !p.companyId || p.companyId === 'UNASSIGNED';
                      const pComp = isUnassigned ? null : companies.find(c => c.id === p.companyId);
                      return (
                        <option key={p.id} value={p.id}>
                          [{p.projectCode}] {p.name}（承攬：{isUnassigned ? '尚未指定公司' : (pComp?.shortName || pComp?.name || p.companyId)} ｜ 業主：{p.ownerName}）
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                    <span>{lockedContract.isCompanyLocked ? '🔒 承攬方（開票／收款歸屬公司）' : '🏢 開票／入帳歸屬公司（案場未指定）'}</span>
                    <span className={`px-1.5 py-0.2 rounded ${lockedContract.isCompanyLocked ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'}`}>
                      {lockedContract.isCompanyLocked ? '依案場自動鎖定' : '請款時指定公司'}
                    </span>
                  </div>
                  {selectedArProj && !lockedContract.isCompanyLocked ? (
                    <select
                      value={arCompanyId}
                      onChange={(e) => setArCompanyId(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded p-1.5 font-bold text-slate-900 outline-none mt-0.5"
                    >
                      {authorizedCorps.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.taxId || c.id})</option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <div className="font-bold text-slate-900">
                        {lockedContract.company?.name || '尚未選擇工程案場'}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        統編：{lockedContract.company?.taxId || '-'}
                      </div>
                    </>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                    <span>🔒 合約業主（發票買受／付款對象）</span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">依案場自動鎖定</span>
                  </div>
                  <div className="font-bold text-slate-900">
                    {lockedContract.customerName || '尚未選擇工程案場'}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    統編：{lockedContract.customerTaxId || '個人／無統編（建議開二聯式或免開票）'}
                  </div>
                </div>

                {/* 案場合約請款額度與開票/免票拆分進度看板 */}
                {selectedArProj && (
                  <div className="md:col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-slate-700">
                        📊 本案合約請款進度（合約總額 <b className="font-mono text-slate-900">NT$ {projContractAmt.toLocaleString()}</b>）
                      </span>
                      <div className="flex flex-wrap items-center gap-2 font-mono">
                        <span className="text-indigo-700">已開發票: NT$ {projBilledInvoiced.toLocaleString()}</span>
                        <span className="text-amber-700">免開發票: NT$ {projBilledNoInv.toLocaleString()}</span>
                        <span className="font-bold text-emerald-700">尚餘可請: NT$ {projRemainingBillable.toLocaleString()}</span>
                        {!pendingClaimSuspense && projRemainingBillable > 0 && (
                          <button
                            type="button"
                            onClick={() => setArBaseAmount(String(projRemainingBillable))}
                            className="font-sans px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[10px] cursor-pointer"
                          >
                            帶入剩餘額度
                          </button>
                        )}
                      </div>
                    </div>
                    {isOverContract && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 font-bold">
                        ⚠️ 含本次請款（累計 NT$ {projAfterThisTotal.toLocaleString()}）將超過原簽約總額 NT$ {(projAfterThisTotal - projContractAmt).toLocaleString()}（若為追加工程仍可開立）
                      </div>
                    )}
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    請款期別 / 摘要說明
                  </label>
                  <input
                    type="text"
                    value={arTitle}
                    onChange={(e) => setArTitle(e.target.value)}
                    placeholder="例：第一期簽約訂金（開發票60萬）、合約約定無發票尾款（40萬）"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* 是否開發票切換 (核心分流規則) */}
              <div className={`p-3.5 rounded-xl border-2 space-y-3 ${arHasInvoice ? 'bg-indigo-50/50 border-indigo-200' : 'bg-amber-50/50 border-amber-200'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-800">是否需開立銷項發票（決定資金入帳帳戶防呆）</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setArHasInvoice(true);
                        setArTaxType(arInvoiceFormat === 'TWO_PART' ? 'TAX_INCLUSIVE' : 'TAX_EXCLUSIVE');
                        setArManualTax('');
                      }}
                      className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer border ${
                        arHasInvoice ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      🔒 需開立銷項發票（僅入公司戶）
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setArHasInvoice(false);
                        setArTaxType('TAX_EXEMPT');
                        setArManualTax('0');
                      }}
                      className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer border ${
                        !arHasInvoice ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      🔓 免開發票（可入老闆私帳/現金）
                    </button>
                  </div>
                </div>

                {arHasInvoice && (
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-white/90 px-3 py-2 rounded-lg border border-indigo-200/80">
                    <span className="text-[11px] font-bold text-indigo-950">統一發票聯式：</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setArInvoiceFormat('THREE_PART');
                          setArTaxType('TAX_EXCLUSIVE');
                          setArManualTax('');
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold border cursor-pointer ${
                          arInvoiceFormat === 'THREE_PART'
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        三聯式（B2B 公司統編 · 未稅＋稅額）
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setArInvoiceFormat('TWO_PART');
                          setArTaxType('TAX_INCLUSIVE');
                          setArManualTax('');
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold border cursor-pointer ${
                          arInvoiceFormat === 'TWO_PART'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        二聯式（個人免統編 · 票面含稅反算）
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700">工項明細輸入模式（多工項自動彙總）</span>
                  <button
                    type="button"
                    onClick={() => setArUseMultiLine(prev => !prev)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer border ${
                      arUseMultiLine ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    {arUseMultiLine ? '✓ 多列工程明細模式 (點擊切回單筆)' : '切換為多列工項明細 (對客表可細列各工項)'}
                  </button>
                </div>

                {arUseMultiLine ? (
                  <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200">
                    {arMultiLines.map((ln, i) => (
                      <div key={ln.id} className="grid grid-cols-12 gap-2 items-center">
                        <span className="col-span-1 text-center font-mono font-bold text-slate-500">{i + 1}</span>
                        <input
                          type="text"
                          value={ln.itemName}
                          onChange={(e) => setArMultiLines(prev => prev.map(x => x.id === ln.id ? { ...x, itemName: e.target.value } : x))}
                          placeholder="工項明細 (例：第一區、追加工程)"
                          className="col-span-5 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold"
                        />
                        <input
                          type="number"
                          min="0"
                          value={ln.amount}
                          onChange={(e) => setArMultiLines(prev => prev.map(x => x.id === ln.id ? { ...x, amount: e.target.value } : x))}
                          placeholder="金額"
                          className="col-span-3 bg-white border border-slate-300 rounded px-2 py-1 font-mono font-bold text-right"
                        />
                        <select
                          value={!arHasInvoice ? 'TAX_EXEMPT' : ln.taxMode}
                          disabled={!arHasInvoice}
                          onChange={(e) => setArMultiLines(prev => prev.map(x => x.id === ln.id ? { ...x, taxMode: e.target.value as any } : x))}
                          className="col-span-2 bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-bold disabled:bg-slate-100"
                        >
                          <option value="TAX_EXCLUSIVE">外加 5%</option>
                          <option value="TAX_INCLUSIVE">含稅反算</option>
                          <option value="TAX_EXEMPT">免稅 $0</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setArMultiLines(prev => prev.length > 1 ? prev.filter(x => x.id !== ln.id) : prev)}
                          className="col-span-1 text-slate-400 hover:text-rose-600 flex justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setArMultiLines(prev => [...prev, { id: `LI-${Date.now()}`, itemName: '', amount: '', taxMode: arHasInvoice ? 'TAX_EXCLUSIVE' : 'TAX_EXEMPT' }])}
                      className="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>新增工項明細列</span>
                    </button>
                  </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {arHasInvoice && arTaxType === 'TAX_INCLUSIVE' ? '含稅請款總額' : '未稅請款本金'} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={arBaseAmount}
                      onChange={(e) => setArBaseAmount(e.target.value)}
                      placeholder="例: 600000"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 outline-none"
                    />
                  </div>

                  {arHasInvoice && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">課稅別 ({taxRatePct}%)</label>
                        <select
                          value={arTaxType}
                          onChange={(e) => {
                            const nextTax = e.target.value as 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT';
                            setArTaxType(nextTax);
                            setArManualTax('');
                          }}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                        >
                          <option value="TAX_EXCLUSIVE">外加 {taxRatePct}% 營業稅</option>
                          <option value="TAX_INCLUSIVE">內含 {taxRatePct}% 營業稅</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          營業稅額（系統試算 NT$ {arTaxPreview.autoTax.toLocaleString()}）
                        </label>
                        <input
                          type="number"
                          value={arManualTax}
                          onChange={(e) => setArManualTax(e.target.value)}
                          placeholder={String(arTaxPreview.autoTax)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-indigo-700 outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>
                )}

                {arHasInvoice && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        銷項發票字軌號碼 <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={arInvoiceNumber}
                        onChange={(e) => setArInvoiceNumber(e.target.value.toUpperCase())}
                        placeholder="例: AB-11223344（自動寫入該公司發票主檔）"
                        className="w-full bg-white border border-indigo-300 rounded-lg p-2 font-mono font-bold text-indigo-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">發票開立日期</label>
                      <input
                        type="date"
                        value={arInvoiceDate}
                        onChange={(e) => setArInvoiceDate(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 font-mono">
                  <span className="font-sans text-slate-600">
                    未稅 NT$ <b>{arTaxPreview.netAmt.toLocaleString()}</b> ＋ 稅額 NT$ <b>{arTaxPreview.finalTax.toLocaleString()}</b>
                  </span>
                  <span className="text-sm font-black text-emerald-700">
                    應收總額 NT$ {arTaxPreview.total.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">預計收款日</label>
                  <input
                    type="date"
                    value={arDueDate}
                    onChange={(e) => setArDueDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">備註說明</label>
                  <input
                    type="text"
                    value={arNotes}
                    onChange={(e) => setArNotes(e.target.value)}
                    placeholder="選填請款說明..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setIsCreateArModalOpen(false); setPendingClaimSuspense(null); }}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => handleSaveAccountsReceivable(false)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer"
              >
                {pendingClaimSuspense ? '補開 AR 並完成認領' : '開立應收請款單 (送交出納)'}
              </button>
              {!pendingClaimSuspense && lockedContract.companyId && canEditCashierFor(lockedContract.companyId) && (
                <button
                  type="button"
                  onClick={() => handleSaveAccountsReceivable(true)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer inline-flex items-center gap-1"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>開立並立即出納收款</span>
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* ======================================================== */}
      {/* MODAL 8: 出納應收收款登錄 (支援少收折讓結清 & 溢收自動轉暫收池) */}
      {/* ======================================================== */}
      {collectingTargetAr && (() => {
        const hasInv = collectingTargetAr.hasInvoice !== false;
        const strictInvLock = hasInv && collectingTargetAr.invoiceIssueMode !== 'SELF_RETAINED';
        const targetComp = companies.find(c => c.id === collectingTargetAr.companyId);
        const eligibleBanks = getEligibleReceivingBanks(collectingTargetAr.companyId, hasInv, collectingTargetAr.invoiceIssueMode);
        const remaining = collectingTargetAr.remainingAmount;
        const recNum = Math.max(0, Number(collectReceivedAmount || 0));
        const isShort = recNum > 0 && recNum < remaining - 0.01;
        const isOver = recNum > remaining + 0.01;
        const shortDiff = Math.max(0, remaining - recNum);
        const overDiff = Math.max(0, recNum - remaining);

        return (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <span>出納收款入帳確認 ({collectingTargetAr.arNumber})</span>
                </h3>
                <button onClick={() => setCollectingTargetAr(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className={`p-3 rounded-xl border text-[11px] font-bold ${
                strictInvLock
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                {strictInvLock
                  ? `🔒 本案已開立銷項發票 [${collectingTargetAr.invoiceNumber || '開發票'}]：資金嚴格僅能入【${targetComp?.shortName || targetComp?.name}】實體銀行戶或公司現金，已鎖定排除老闆私帳與他公司帳戶。`
                  : collectingTargetAr.invoiceIssueMode === 'SELF_RETAINED'
                  ? `🏷️ 本案採自主報稅自留發票 [${collectingTargetAr.invoiceNumber}]：未交付業主，仍可入原定【老闆私人戶】、現金或本公司專戶。`
                  : `🔓 本案免開發票：出納可選擇入【老闆私人戶】、現金或該公司專戶（禁止跨入其他公司戶）。`}
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">付款業主：</span>
                  <span className="font-bold text-slate-900">{collectingTargetAr.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">本單尚未收回餘額：</span>
                  <span className="font-mono font-black text-rose-700">NT$ {remaining.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">業主付款方式</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'TT', label: '銀行轉帳/匯款' },
                    { id: 'CHECK', label: '收到業主支票' },
                    { id: 'CASH', label: '現金收訖' },
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setCollectMethod(m.id as 'TT' | 'CHECK' | 'CASH');
                        if (m.id === 'CASH') {
                          setCollectBankAccountId('CASH');
                        } else if (!collectBankAccountId || collectBankAccountId === 'CASH') {
                          setCollectBankAccountId(eligibleBanks[0]?.id || '');
                        }
                      }}
                      className={`py-2 px-2 rounded-lg font-bold border text-xs cursor-pointer ${
                        collectMethod === m.id
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {collectMethod !== 'CASH' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    存入專戶 ({strictInvLock ? '僅限開票公司實體銀行' : '老闆私帳／本公司專戶'}) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={collectBankAccountId}
                    onChange={(e) => setCollectBankAccountId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                  >
                    {eligibleBanks.length === 0 ? (
                      <option value="">（此公司尚未建立可用銀行帳戶，請改選現金或先至設定建檔）</option>
                    ) : (
                      eligibleBanks.map(b => (
                        <option key={b.id} value={b.id}>
                          {isBossPrivateAccount(b) ? '👤 [老闆私帳] ' : '🏦 '}
                          {b.bankName} {b.branchName || ''} · {b.accountNumber} (餘 NT$ {b.currentBalance.toLocaleString()})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    實際收到金額／票面金額（可多給或少給）<span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={collectReceivedAmount}
                    onChange={(e) => setCollectReceivedAmount(e.target.value)}
                    className="w-full bg-white border-2 border-emerald-300 rounded-lg p-2 font-mono font-black text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">收款 / 收票日</label>
                  <input
                    type="date"
                    value={collectReceivedDate}
                    onChange={(e) => setCollectReceivedDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* 少收情境處置 */}
              {isShort && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 space-y-2">
                  <div className="font-bold text-amber-900">
                    ⚠️ 業主實收少於應收餘額（少 NT$ {shortDiff.toLocaleString()}），請選擇帳務處置：
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${collectShortageMode === 'PARTIAL' ? 'bg-white border-amber-500 font-bold text-slate-900' : 'border-amber-200 text-slate-700'}`}>
                      <input
                        type="radio"
                        checked={collectShortageMode === 'PARTIAL'}
                        onChange={() => setCollectShortageMode('PARTIAL')}
                      />
                      <span>部分收款（保留剩餘 NT$ {shortDiff.toLocaleString()} 待業主後續補付）</span>
                    </label>
                    <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${collectShortageMode === 'SETTLE_SHORT' ? 'bg-white border-emerald-500 font-bold text-emerald-900' : 'border-amber-200 text-slate-700'}`}>
                      <input
                        type="radio"
                        checked={collectShortageMode === 'SETTLE_SHORT'}
                        onChange={() => setCollectShortageMode('SETTLE_SHORT')}
                      />
                      <span>折讓／扣匯費直接結清（差額 NT$ {shortDiff.toLocaleString()} 認列折讓不追討，應收結案）</span>
                    </label>
                  </div>
                </div>
              )}

              {/* 多給溢收情境處置 */}
              {isOver && (
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-300 space-y-2">
                  <div className="font-bold text-indigo-900">
                    💡 業主實付金額大於應收餘額（多給 NT$ {overDiff.toLocaleString()}），帳戶將完整入庫 NT$ {recNum.toLocaleString()}：
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${collectOverpayMode === 'TO_PROJECT_ADVANCE' ? 'bg-white border-teal-500 font-bold text-teal-950' : 'border-indigo-200 text-slate-700'}`}>
                      <input
                        type="radio"
                        checked={collectOverpayMode === 'TO_PROJECT_ADVANCE'}
                        onChange={() => setCollectOverpayMode('TO_PROJECT_ADVANCE')}
                      />
                      <span>推薦：溢收 NT$ {overDiff.toLocaleString()} 直接掛入「本案場預收款／借貸總帳」（不丟入未知水池）</span>
                    </label>
                    <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${collectOverpayMode === 'TO_SUSPENSE' ? 'bg-white border-indigo-500 font-bold text-indigo-950' : 'border-indigo-200 text-slate-700'}`}>
                      <input
                        type="radio"
                        checked={collectOverpayMode === 'TO_SUSPENSE'}
                        onChange={() => setCollectOverpayMode('TO_SUSPENSE')}
                      />
                      <span>轉入未知暫收池（待後續其他案件認領）</span>
                    </label>
                    <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${collectOverpayMode === 'DIRECT_OVERPAY' ? 'bg-white border-emerald-500 font-bold text-emerald-900' : 'border-indigo-200 text-slate-700'}`}>
                      <input
                        type="radio"
                        checked={collectOverpayMode === 'DIRECT_OVERPAY'}
                        onChange={() => setCollectOverpayMode('DIRECT_OVERPAY')}
                      />
                      <span>直接認列為本期超收結清（不保留預收餘額）</span>
                    </label>
                  </div>
                </div>
              )}

              {collectMethod === 'CHECK' && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                  <div className="text-[11px] font-bold text-amber-900">
                    📝 收到業主支票會先入「票據雷達」黃燈待兌現；銀行餘額於到期確認兌現後方正式增加
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">支票號碼 *</label>
                      <input
                        type="text"
                        value={collectCheckNumber}
                        onChange={(e) => setCollectCheckNumber(e.target.value.toUpperCase())}
                        placeholder="例: RC-556677"
                        className="w-full bg-white border border-amber-300 rounded p-1.5 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">票面到期日</label>
                      <input
                        type="date"
                        value={collectCheckDueDate}
                        onChange={(e) => setCollectCheckDueDate(e.target.value)}
                        className="w-full bg-white border border-amber-300 rounded p-1.5 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">發票銀行 (選填)</label>
                      <input
                        type="text"
                        value={collectDrawerBank}
                        onChange={(e) => setCollectDrawerBank(e.target.value)}
                        placeholder="例: 國泰世華"
                        className="w-full bg-white border border-amber-300 rounded p-1.5"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between font-mono">
                <span className="font-sans text-emerald-900 font-bold">
                  {collectMethod === 'CHECK' ? '票面實收金額：' : '實際入庫金額：'}
                </span>
                <span className="text-base font-black text-emerald-800">NT$ {recNum.toLocaleString()}</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">收款備註</label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  placeholder="例：網銀後五碼 88991、業主少給尾款折讓、或預付超付..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCollectingTargetAr(null)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCollectAr}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer"
                >
                  {collectMethod === 'CHECK' ? '確認收票登錄' : '確認收款入帳'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* MODAL 9: 出納登錄未知款項暫收池 (Create Suspense Receipt) */}
      {/* ======================================================== */}
      {isCreateSuspenseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>出納登錄銀行未知匯入暫收款</span>
              </h3>
              <button onClick={() => setIsCreateSuspenseModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
              存摺已確認收到現金／匯款，但會計尚未開單或無法辨認業主案場時使用。<b>登錄後會立即增加對應帳戶餘額，但暫不認列營業稅與收入</b>，待會計查明認領。
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                入帳收款帳戶 <span className="text-rose-500">*</span>
              </label>
              <select
                value={suspBankAccountId}
                onChange={(e) => setSuspBankAccountId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
              >
                {bankAccounts
                  .filter(b => b.status === 'ACTIVE' && (isBossPrivateAccount(b) || matchesCompanyScope(b.companyId)))
                  .map(b => {
                    const bComp = companies.find(c => c.id === b.companyId);
                    return (
                      <option key={b.id} value={b.id}>
                        {isBossPrivateAccount(b) ? '👤 [老闆私帳] ' : `🏦 [${bComp?.shortName || b.companyId}] `}
                        {b.bankName} {b.branchName || ''} · {b.accountNumber}
                      </option>
                    );
                  })}
                <option value="CASH">💵 公司現金櫃台</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  入帳金額 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={suspAmount}
                  onChange={(e) => setSuspAmount(e.target.value)}
                  placeholder="例: 350000"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">存摺入帳日</label>
                <input
                  type="date"
                  value={suspReceivedDate}
                  onChange={(e) => setSuspReceivedDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                存摺匯入來源戶名／網銀附言摘要 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={suspPayerInfo}
                onChange={(e) => setSuspPayerInfo(e.target.value)}
                placeholder="例：國泰世華轉入 陳先生 / 後五碼 12345 (未註明案場)"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">備註 (選填)</label>
              <input
                type="text"
                value={suspNotes}
                onChange={(e) => setSuspNotes(e.target.value)}
                placeholder="已通知工務主任查對..."
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateSuspenseModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateSuspense}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer"
              >
                確認入暫收池
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 10: 會計手動補登統一發票 (Create Invoice Master) */}
      {/* ======================================================== */}
      {isCreateInvoiceModalOpen && (() => {
        const targetComp = companies.find(c => c.id === invTargetCompanyId);
        return (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>手動補登【{targetComp?.shortName || targetComp?.name}】統一發票</span>
                </h3>
                <button onClick={() => setIsCreateInvoiceModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">發票歸屬申報法人</label>
                  <select
                    value={invTargetCompanyId}
                    onChange={(e) => setInvTargetCompanyId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                  >
                    {authorizedCorps.map(c => (
                      <option key={c.id} value={c.id}>{c.shortName || c.name} ({c.taxId || c.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">發票方向</label>
                  <select
                    value={invType}
                    onChange={(e) => setInvType(e.target.value as 'INPUT' | 'OUTPUT')}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                  >
                    <option value="INPUT">進項發票 (廠商開給本公司)</option>
                    <option value="OUTPUT">銷項發票 (本公司開給業主)</option>
                  </select>
                </div>

                {invType === 'OUTPUT' && (
                  <div className="col-span-2 p-3 rounded-xl bg-purple-50/70 border border-purple-200 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-purple-950">銷項發票開立用途：</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setInvIssueMode('DELIVERED')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                            invIssueMode === 'DELIVERED'
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          正常交付業主
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInvIssueMode('SELF_RETAINED');
                            setInvTaxType('TAX_INCLUSIVE');
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                            invIssueMode === 'SELF_RETAINED'
                              ? 'bg-purple-700 text-white border-purple-700'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          自主開立繳稅（公司自留・稅金自理）
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">關聯歸屬工程案場 (選填備查)</label>
                      <select
                        value={invProjectId}
                        onChange={(e) => setInvProjectId(e.target.value)}
                        className="w-full bg-white border border-purple-200 rounded p-1.5 text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value="">-- 不指定特定案場 --</option>
                        {projects.filter(p => !p.isDeleted && p.id !== 'PRJ-INTERNAL').map(p => (
                          <option key={p.id} value={p.id}>[{p.projectCode}] {p.name} ({p.ownerName})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="col-span-2 flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700">發票聯式</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setInvFormat('THREE_PART');
                        setInvTaxType('TAX_EXCLUSIVE');
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                        invFormat === 'THREE_PART'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      三聯式 (B2B附統編)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInvFormat('TWO_PART');
                        setInvTaxType('TAX_INCLUSIVE');
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                        invFormat === 'TWO_PART'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      二聯式 (個人含稅免統編)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">發票字軌號碼 *</label>
                  <input
                    type="text"
                    value={invNumber}
                    onChange={(e) => setInvNumber(e.target.value.toUpperCase())}
                    placeholder="例: AB-88776655"
                    className="w-full bg-white border border-indigo-300 rounded-lg p-2 font-mono font-bold text-indigo-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">開立日期</label>
                  <input
                    type="date"
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {invType === 'INPUT' ? '快速帶入開立方廠商' : '快速帶入買受方業主'}
                  </label>
                  <select
                    value={invPartnerId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setInvPartnerId(pid);
                      const bp = partners.find(p => p.id === pid);
                      if (bp) {
                        setInvPartnerTaxId(bp.taxId || '');
                        setInvPartnerName(bp.name || '');
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                  >
                    <option value="">-- 可直接選取名冊或下方手動輸入 --</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.taxId || '無統編'})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      {invFormat === 'TWO_PART' ? '對方統編 (二聯式可免填)' : '對方統編 *'}
                    </label>
                    <input
                      type="text"
                      value={invPartnerTaxId}
                      onChange={(e) => setInvPartnerTaxId(e.target.value)}
                      placeholder={invFormat === 'TWO_PART' ? '個人免統編可留空' : '8碼統編'}
                      className="w-full bg-white border border-slate-300 rounded p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">對方抬頭名稱 *</label>
                    <input
                      type="text"
                      value={invPartnerName}
                      onChange={(e) => setInvPartnerName(e.target.value)}
                      placeholder="公司全銜"
                      className="w-full bg-white border border-slate-300 rounded p-1.5"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">課稅方式</label>
                  <select
                    value={invTaxType}
                    onChange={(e) => {
                      setInvTaxType(e.target.value as 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT');
                      setInvManualTax('');
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
                  >
                    <option value="TAX_EXCLUSIVE">外加 {taxRatePct}%</option>
                    <option value="TAX_INCLUSIVE">內含 {taxRatePct}%</option>
                    <option value="TAX_EXEMPT">免稅 / 零稅</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {invTaxType === 'TAX_INCLUSIVE' ? '含稅金額' : '未稅金額'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={invBaseAmount}
                    onChange={(e) => setInvBaseAmount(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    營業稅 (自動 {invModalTaxPreview.autoTax.toLocaleString()})
                  </label>
                  <input
                    type="number"
                    disabled={invTaxType === 'TAX_EXEMPT'}
                    value={invTaxType === 'TAX_EXEMPT' ? '0' : invManualTax}
                    onChange={(e) => setInvManualTax(e.target.value)}
                    placeholder={String(invModalTaxPreview.autoTax)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-between font-mono">
                <span className="font-sans text-slate-700">
                  未稅 NT$ <b>{invModalTaxPreview.netAmt.toLocaleString()}</b> ＋ 稅 NT$ <b>{invModalTaxPreview.finalTax.toLocaleString()}</b>
                </span>
                <span className="font-black text-indigo-800 text-sm">含稅總額 NT$ {invModalTaxPreview.total.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateInvoiceModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCreateInvoice}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer"
                >
                  確認登記寫入發票主檔
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* MODAL 11: 免開票應收單 後續補開／自主開立報稅發票 */}
      {/* ======================================================== */}
      {postInvTargetAr && (() => {
        const baseNum = Math.max(0, Number(postInvAmount || 0));
        const isSelf = postInvMode === 'SELF_RETAINED';
        const calcTax = isSelf || postInvTaxType === 'TAX_INCLUSIVE'
          ? Math.round(baseNum - baseNum / (1 + taxRate))
          : Math.round(baseNum * taxRate);
        const calcNet = isSelf || postInvTaxType === 'TAX_INCLUSIVE'
          ? Math.max(0, baseNum - calcTax)
          : baseNum;
        const calcTotal = isSelf || postInvTaxType === 'TAX_INCLUSIVE'
          ? baseNum
          : baseNum + calcTax;

        return (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>補開銷項發票 / 自主報稅 ({postInvTargetAr.arNumber})</span>
                </h3>
                <button onClick={() => setPostInvTargetAr(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">業主／案場：</span>
                  <span className="font-bold text-slate-900">{postInvTargetAr.customerName} ({postInvTargetAr.projectName})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">原請款單金額：</span>
                  <span className="font-mono font-bold text-slate-800">NT$ {postInvTargetAr.amount.toLocaleString()}（已收 NT$ {postInvTargetAr.appliedAmount.toLocaleString()}）</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">開立用途模式</label>
                <div className="grid grid-cols-1 gap-2">
                  <label className={`flex items-start gap-2 p-2.5 rounded-xl border-2 cursor-pointer ${postInvMode === 'DELIVERED' ? 'bg-indigo-50/70 border-indigo-400' : 'border-slate-200'}`}>
                    <input
                      type="radio"
                      checked={postInvMode === 'DELIVERED'}
                      onChange={() => setPostInvMode('DELIVERED')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-indigo-950">後續補開銷項發票（交付業主）</div>
                      <div className="text-[11px] text-slate-600">原免開票請款，事後業主要求補開 A 公司發票（未收款餘額將自動改鎖進開票公司戶）</div>
                    </div>
                  </label>
                  <label className={`flex items-start gap-2 p-2.5 rounded-xl border-2 cursor-pointer ${postInvMode === 'SELF_RETAINED' ? 'bg-purple-50/70 border-purple-400' : 'border-slate-200'}`}>
                    <input
                      type="radio"
                      checked={postInvMode === 'SELF_RETAINED'}
                      onChange={() => {
                        setPostInvMode('SELF_RETAINED');
                        setPostInvTaxType('TAX_INCLUSIVE');
                      }}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-purple-950">自主開立發票繳稅（公司自留・不給業主・稅金自理）</div>
                      <div className="text-[11px] text-slate-600">請完款後公司自行報稅使用，採含稅反算不向業主多收 5%，發票寫入公司主檔並標記自留</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">開票申報公司</label>
                  <select
                    value={postInvCompanyId}
                    onChange={(e) => setPostInvCompanyId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                  >
                    {authorizedCorps.map(c => (
                      <option key={c.id} value={c.id}>{c.shortName || c.name} ({c.taxId})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">發票聯式</label>
                  <select
                    value={postInvFormat}
                    onChange={(e) => setPostInvFormat(e.target.value as 'THREE_PART' | 'TWO_PART')}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                  >
                    <option value="THREE_PART">三聯式（B2B附統編）</option>
                    <option value="TWO_PART">二聯式（個人免統編含稅）</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">銷項發票字軌號碼 *</label>
                  <input
                    type="text"
                    value={postInvNumber}
                    onChange={(e) => setPostInvNumber(e.target.value.toUpperCase())}
                    placeholder="例: CD-33445566"
                    className="w-full bg-white border border-purple-300 rounded-lg p-2 font-mono font-bold text-purple-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">開立日期</label>
                  <input
                    type="date"
                    value={postInvDate}
                    onChange={(e) => setPostInvDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isSelf || postInvTaxType === 'TAX_INCLUSIVE' ? '發票含稅總額（反算稅額）' : '未稅本金'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={postInvAmount}
                    onChange={(e) => setPostInvAmount(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 outline-none"
                  />
                </div>
                {!isSelf && postInvTargetAr.appliedAmount === 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">稅金計算方式</label>
                    <select
                      value={postInvTaxType}
                      onChange={(e) => setPostInvTaxType(e.target.value as 'TAX_INCLUSIVE' | 'TAX_EXCLUSIVE')}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
                    >
                      <option value="TAX_INCLUSIVE">含稅反算 (請款總額不變)</option>
                      <option value="TAX_EXCLUSIVE">外加 {taxRatePct}% (同步調增應收額)</option>
                    </select>
                  </div>
                )}
              </div>

              {!isSelf && postInvTargetAr.appliedAmount > 0 && calcTax > 0 && (
                <label className="flex items-start gap-2 p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 cursor-pointer text-indigo-950 font-bold">
                  <input
                    type="checkbox"
                    checked={postInvExtraTaxAr}
                    onChange={(e) => setPostInvExtraTaxAr(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    業主已收完本金，額外自動開立一張【NT$ {calcTax.toLocaleString()} ({taxRatePct}% 補開發票稅金)】應收請款單向業主補收（僅限入公司戶）
                  </span>
                </label>
              )}

              <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-between font-mono">
                <span className="font-sans text-slate-700">
                  銷售額 NT$ <b>{calcNet.toLocaleString()}</b> ＋ 銷項稅 NT$ <b>{calcTax.toLocaleString()}</b>
                </span>
                <span className="font-black text-purple-900 text-sm">發票總額 NT$ {calcTotal.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPostInvTargetAr(null)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPostInvoice}
                  className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer"
                >
                  {isSelf ? '確認自主開票寫入主檔 (自留報稅)' : '確認補開銷項發票'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* MODAL 12: 出納直接登錄「案場預收／貸款先撥款」(直入案場) */}
      {/* ======================================================== */}
      {isQuickAdvanceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-teal-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-teal-600" />
                <span>出納登錄案場預收款／銀行貸款撥款（直入案場總帳）</span>
              </h3>
              <button onClick={() => setIsQuickAdvanceModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2.5 rounded-lg bg-teal-50 border border-teal-200 text-[11px] text-teal-900">
              已知工程案場之預付訂金或業主貸款先撥入一整筆（尚未開請款單時），直接掛入該案場貸方與銀行存摺，不經由未知大水池。
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">歸屬工程專案案場 *</label>
              <select
                value={quickAdvProjId}
                onChange={(e) => setQuickAdvProjId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
              >
                {projects.filter(p => !p.isDeleted && p.id !== 'PRJ-INTERNAL').map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.projectCode}] {p.name}（業主：{p.ownerName || '-'}）
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">款項性質</label>
                <select
                  value={quickAdvSourceType}
                  onChange={(e) => setQuickAdvSourceType(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
                >
                  <option value="EARLY_LOAN">銀行貸款先整筆撥入</option>
                  <option value="DEPOSIT">預付工程訂金</option>
                  <option value="OVERPAYMENT">其他預收工程款</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">收款方式</label>
                <select
                  value={quickAdvMethod}
                  onChange={(e) => setQuickAdvMethod(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
                >
                  <option value="TT">銀行匯款/轉帳</option>
                  <option value="CHECK">收到業主支票</option>
                  <option value="CASH">現金收訖</option>
                </select>
              </div>
            </div>
            {quickAdvMethod !== 'CASH' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">入帳銀行帳戶 *</label>
                <select
                  value={quickAdvBankId}
                  onChange={(e) => setQuickAdvBankId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
                >
                  {bankAccounts
                    .filter(b => b.status === 'ACTIVE' && (isBossPrivateAccount(b) || matchesCompanyScope(b.companyId)))
                    .map(b => (
                      <option key={b.id} value={b.id}>
                        {isBossPrivateAccount(b) ? '👤 [老闆私帳] ' : '🏦 '}
                        {b.bankName} · {b.accountNumber}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">實收預收金額 *</label>
                <input
                  type="number"
                  min="0"
                  value={quickAdvAmount}
                  onChange={(e) => setQuickAdvAmount(e.target.value)}
                  placeholder="例: 500000"
                  className="w-full bg-white border border-teal-300 rounded-lg p-2 font-mono font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">入帳日期</label>
                <input
                  type="date"
                  value={quickAdvDate}
                  onChange={(e) => setQuickAdvDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none"
                />
              </div>
            </div>
            {quickAdvMethod === 'CHECK' && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={quickAdvCheckNo}
                  onChange={(e) => setQuickAdvCheckNo(e.target.value.toUpperCase())}
                  placeholder="支票號碼 *"
                  className="bg-white border border-amber-300 rounded-lg p-2 font-mono font-bold"
                />
                <input
                  type="date"
                  value={quickAdvCheckDue}
                  onChange={(e) => setQuickAdvCheckDue(e.target.value)}
                  className="bg-white border border-amber-300 rounded-lg p-2 font-mono font-bold"
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">備註</label>
              <input
                type="text"
                value={quickAdvNotes}
                onChange={(e) => setQuickAdvNotes(e.target.value)}
                placeholder="例：銀行二期貸款撥款"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setIsQuickAdvanceModalOpen(false)} className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 cursor-pointer">取消</button>
              <button type="button" onClick={handleConfirmQuickAdvance} className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer">確認入案場預收帳</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 13: 工程案場雙軌借貸總帳 ＆ 對外客戶明細總表          */}
      {/* ======================================================== */}
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
