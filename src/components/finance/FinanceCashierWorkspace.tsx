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
  Ban
} from 'lucide-react';
import {
  AccountsPayableReconciliation,
  PaymentRecord,
  PaymentLineItem,
  BankCheck,
  Invoice,
  SuspenseReceipt,
  CompanyBankAccount,
  BusinessPartner,
  InboundReceipt,
  Company,
  SystemConfig
} from '../../types/erp';
import {
  getAllApReconciliations,
  createApReconciliation,
  voidApReconciliation,
  getAllPaymentRecords,
  createPaymentRecord,
  getAllBankChecks,
  updateBankCheckStatus,
  getAllInvoices,
  createInvoice,
  getAllSuspenseReceipts,
  allocateSuspenseReceipt,
  getAllCompanyBankAccounts,
  getAllBusinessPartners,
  getAllInboundReceipts,
  getAllCompanies,
  getAllSystemConfigs,
  getAllAccountsReceivable,
  subscribeToDatabase,
  recordAuditLog
} from '../../db/sqlite';
import { useAuth } from '../../context/AuthContext';

interface FinanceCashierWorkspaceProps {
  onNotify?: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onNavigateToInbound?: () => void;
}

type MainTab = 'RECONCILIATION_POOL' | 'TREASURY_PAYMENT' | 'CHECK_RADAR' | 'INVOICE_PETTY_CASH';

export const FinanceCashierWorkspace: React.FC<FinanceCashierWorkspaceProps> = ({
  onNotify = () => {},
  onNavigateToInbound,
}) => {
  const { currentUser, can, isSuperadmin, isAdmin } = useAuth();
  const canApprove = can('BANK_CHECKS', 'approve') || isSuperadmin || isAdmin;
  const canWrite = can('BANK_CHECKS', 'write') || isSuperadmin || isAdmin;

  // 主頁籤
  const [activeTab, setActiveTab] = useState<MainTab>('RECONCILIATION_POOL');

  // 資料庫資料狀態
  const [reconciliations, setReconciliations] = useState<AccountsPayableReconciliation[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [checks, setChecks] = useState<BankCheck[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [suspenses, setSuspenses] = useState<SuspenseReceipt[]>([]);
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([]);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [inboundReceipts, setInboundReceipts] = useState<InboundReceipt[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [systemConfigs, setSystemConfigs] = useState<SystemConfig[]>([]);
  const [arList, setArList] = useState<any[]>([]);

  // 篩選狀態
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [checkTypeFilter, setCheckTypeFilter] = useState<'ALL' | 'PAYABLE' | 'RECEIVABLE'>('ALL');

  // 對帳單建立 Modal 狀態
  const [isCreateRecModalOpen, setIsCreateRecModalOpen] = useState(false);
  const [recTargetVendorId, setRecTargetVendorId] = useState<string>('');
  const [recSelectedReceiptIds, setRecSelectedReceiptIds] = useState<string[]>([]);
  const [recDiscountAmount, setRecDiscountAmount] = useState<number>(0);
  const [recTaxType, setRecTaxType] = useState<'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT'>('TAX_EXCLUSIVE');
  const [recManualTax, setRecManualTax] = useState<string>(''); // 手動輸入稅額 (容差比對)
  const [recInvoiceNumber, setRecInvoiceNumber] = useState<string>('');
  const [recHasInvoice, setRecHasInvoice] = useState<boolean>(true);
  const [recPaymentDueDate, setRecPaymentDueDate] = useState<string>('');
  const [recBillingPeriod, setRecBillingPeriod] = useState<string>(new Date().toISOString().slice(0, 7));
  const [recNotes, setRecNotes] = useState<string>('');

  // 大水池清單與進貨單明細展開檢視狀態
  const [expandedVendorPoolIds, setExpandedVendorPoolIds] = useState<string[]>([]);
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<string[]>([]);

  // 輔助函式：推算次月固定付款日 (預設 10 日，工程實務逢十付款慣例)
  const computeNextMonthPaymentDate = (dayOfMonth: number = 10): string => {
    const d = new Date();
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, dayOfMonth);
    return nextMonth.toISOString().slice(0, 10);
  };

  // 輔助函式：推算天期到期日 (如 T+30)
  const computeTermsPaymentDate = (termsDays: number = 30): string => {
    const d = new Date();
    d.setDate(d.getDate() + termsDays);
    return d.toISOString().slice(0, 10);
  };

  // 出納放款 Modal 狀態
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedRecForPayment, setSelectedRecForPayment] = useState<AccountsPayableReconciliation | null>(null);
  const [payBankAccountId, setPayBankAccountId] = useState<string>('BANK-01');
  const [payMethod, setPayMethod] = useState<'TT' | 'CHECK' | 'CASH'>('TT');
  const [payCheckNumber, setPayCheckNumber] = useState<string>('');
  const [payCheckDueDate, setPayCheckDueDate] = useState<string>('');
  const [payFeeAmount, setPayFeeAmount] = useState<number>(30);
  const [payIsFeeAbsorbed, setPayIsFeeAbsorbed] = useState<boolean>(true);
  const [payDeductionAmount, setPayDeductionAmount] = useState<number>(0);
  const [payDeductionNote, setPayDeductionNote] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');

  // 作廢對帳單 Modal 狀態
  const [voidModalTargetId, setVoidModalTargetId] = useState<string | null>(null);
  const [voidReasonText, setVoidReasonText] = useState<string>('');

  // 支票狀態流轉 Modal
  const [selectedCheckForAction, setSelectedCheckForAction] = useState<BankCheck | null>(null);
  const [checkActionType, setCheckActionType] = useState<'CLEAR' | 'BOUNCE' | 'VOID'>('CLEAR');
  const [checkActualClearDate, setCheckActualClearDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [checkActionReason, setCheckActionReason] = useState<string>('');

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
      setCompanies(getAllCompanies());
      setSystemConfigs(getAllSystemConfigs());
      setArList(getAllAccountsReceivable());
    } catch (e) {
      console.error('載入財務資料庫失敗', e);
    }
  };

  useEffect(() => {
    loadAllFinanceData();
    const unsubscribe = subscribeToDatabase(loadAllFinanceData);
    return () => unsubscribe();
  }, []);

  // 讀取全域容差參數
  const taxTolerance = useMemo(() => {
    const cfg = systemConfigs.find(c => c.configKey === 'FIN_TAX_TOLERANCE');
    return cfg ? Number(cfg.configValue) : 5.0;
  }, [systemConfigs]);

  // -------------------------------------------------------------
  // 核心統計指標 (KPIs & Cash Radar)
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    // 待對帳進貨單 (水池沉澱，尚未勾稽請款)
    const pendingReceipts = inboundReceipts.filter(r => r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED');
    const pendingInboundTotal = pendingReceipts.reduce((sum, r) => sum + r.totalAmount, 0);

    // 已對帳未放款應付水位 (APPROVED 狀態)
    const approvedRecs = reconciliations.filter(r => r.status === 'APPROVED');
    const pendingApTotal = approvedRecs.reduce((sum, r) => sum + r.netPayableAmount, 0);

    // 銀行存摺真實可用總餘額 (實體帳戶加總)
    const realBankAccounts = bankAccounts.filter(b => !b.isVirtualAccount && b.status === 'ACTIVE');
    const realBankBalance = realBankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);

    // 老闆口袋代墊專戶餘額
    const bossAccount = bankAccounts.find(b => b.isVirtualAccount);
    const bossBalance = bossAccount ? bossAccount.currentBalance : 0;

    // 未兌現支票總額 (黃燈期票 ISSUED)
    const unclearedChecks = checks.filter(c => c.status === 'ISSUED' && c.type === 'PAYABLE');
    const unclearedChecksTotal = unclearedChecks.reduce((sum, c) => sum + c.amount, 0);

    // 待釐清未知暫收款
    const pendingSuspense = suspenses.filter(s => !s.isAllocated);
    const pendingSuspenseTotal = pendingSuspense.reduce((sum, s) => sum + s.amount, 0);

    // 預測可用現金淨水位
    const projectedNetCash = realBankBalance - pendingApTotal - unclearedChecksTotal;

    return {
      pendingInboundCount: pendingReceipts.length,
      pendingInboundTotal,
      pendingApCount: approvedRecs.length,
      pendingApTotal,
      realBankBalance,
      bossBalance,
      unclearedChecksCount: unclearedChecks.length,
      unclearedChecksTotal,
      pendingSuspenseCount: pendingSuspense.length,
      pendingSuspenseTotal,
      projectedNetCash,
    };
  }, [inboundReceipts, reconciliations, bankAccounts, checks, suspenses]);

  // -------------------------------------------------------------
  // 廠商未結水池彙總 (按廠商分組，亮起「待請款」琥珀色標籤)
  // -------------------------------------------------------------
  const vendorPoolList = useMemo(() => {
    const pendingReceipts = inboundReceipts.filter(r => r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED');
    const map: Record<string, {
      vendorId: string;
      vendorName: string;
      vendorTaxId?: string;
      bankFeePayer: string;
      paymentTermsDays: number;
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
          receipts: [],
          totalAmount: 0,
        };
      }
      map[r.vendorId].receipts.push(r);
      map[r.vendorId].totalAmount += r.totalAmount;
    });

    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [inboundReceipts, partners]);

  // 開啟建立對帳單 Modal
  const handleOpenCreateRecModal = (vendorId?: string) => {
    const targetVId = vendorId || (vendorPoolList.length > 0 ? vendorPoolList[0].vendorId : '');
    setRecTargetVendorId(targetVId);

    // 預設全選該廠商的所有待對帳單據
    const vPending = inboundReceipts.filter(r => r.vendorId === targetVId && r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED');
    setRecSelectedReceiptIds(vPending.map(r => r.id));

    // 自動預設次月 10 日為預計付款日 (營造實務逢十付款，免逐筆手動輸入)
    setRecPaymentDueDate(computeNextMonthPaymentDate(10));

    setRecDiscountAmount(0);
    setRecTaxType('TAX_EXCLUSIVE');
    setRecManualTax('');
    setRecInvoiceNumber('');
    const bp = partners.find(p => p.id === targetVId);
    setRecHasInvoice(bp?.hasInvoice !== false);
    setRecBillingPeriod(new Date().toISOString().slice(0, 7));
    setRecNotes('');
    setIsCreateRecModalOpen(true);
  };

  // 當選定廠商切換時，連動重設待選單據
  const handleVendorChangeInModal = (vId: string) => {
    setRecTargetVendorId(vId);
    const vPending = inboundReceipts.filter(r => r.vendorId === vId && r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED');
    setRecSelectedReceiptIds(vPending.map(r => r.id));

    // 預設次月 10 日
    setRecPaymentDueDate(computeNextMonthPaymentDate(10));
    const bp = partners.find(p => p.id === vId);
    setRecHasInvoice(bp?.hasInvoice !== false);
  };

  // 對帳單試算金額計算
  const recCalculations = useMemo(() => {
    const selectedReceipts = inboundReceipts.filter(r => recSelectedReceiptIds.includes(r.id));
    const inboundTotal = selectedReceipts.reduce((sum, r) => sum + r.totalAmount, 0);
    const discount = Math.max(0, recDiscountAmount || 0);

    let baseAmount = Math.max(0, inboundTotal - discount);
    let autoTax = 0;
    if (recTaxType === 'TAX_EXCLUSIVE') {
      autoTax = Math.round(baseAmount * 0.05);
    } else if (recTaxType === 'TAX_INCLUSIVE') {
      autoTax = Math.round(baseAmount - (baseAmount / 1.05));
    } else {
      autoTax = 0;
    }

    // 手動覆寫稅額與容差檢驗
    const finalTax = recManualTax.trim() !== '' ? Number(recManualTax) : autoTax;
    const taxDiff = Math.abs(finalTax - autoTax);
    const isTaxToleranceValid = taxDiff <= taxTolerance;

    let netPayable = 0;
    if (recTaxType === 'TAX_EXCLUSIVE') {
      netPayable = baseAmount + finalTax;
    } else {
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
      netPayable,
    };
  }, [inboundReceipts, recSelectedReceiptIds, recDiscountAmount, recTaxType, recManualTax, taxTolerance]);

  // 儲存/覆核應付對帳單
  const handleSaveReconciliation = (isApproved: boolean) => {
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
    if (!recPaymentDueDate) {
      onNotify('請填寫預計付款日，以利資金雷達運算', 'warn');
      return;
    }

    const targetPartner = partners.find(p => p.id === recTargetVendorId);
    const vendorName = targetPartner?.name || '未知廠商';
    const recNumber = `REC-${recBillingPeriod.replace('-', '')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

    try {
      createApReconciliation(
        {
          reconciliationNumber: recNumber,
          companyId: targetPartner?.companyId || 'COMP-01',
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
          paymentDueDate: recPaymentDueDate,
          status: isApproved ? 'APPROVED' : 'DRAFT',
          notes: recNotes,
          receiptIds: recSelectedReceiptIds,
        },
        currentUser?.fullName || '張會計長'
      );

      setIsCreateRecModalOpen(false);
      onNotify(`✅ 對帳單【${recNumber}】已成功${isApproved ? '核准過帳' : '儲存為草稿'}！已同步將 ${recSelectedReceiptIds.length} 筆進貨單標記為已對帳。`, 'success');
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`❌ 對帳單建立失敗：${e.message}`, 'error');
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
      voidApReconciliation(voidModalTargetId, voidReasonText, currentUser?.fullName || '張會計長');
      setVoidModalTargetId(null);
      setVoidReasonText('');
      onNotify('🛡️ 對帳單已成功作廢！所屬進貨簽收單已安全回滾釋放回待對帳大水池。', 'success');
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`作廢失敗：${e.message}`, 'error');
    }
  };

  // 開啟放款出金 Modal
  const handleOpenPaymentModal = (rec: AccountsPayableReconciliation) => {
    setSelectedRecForPayment(rec);
    const bp = partners.find(p => p.id === rec.vendorId);
    
    // 預設匯費負擔方
    const feePayer = bp?.bankFeePayer || 'COMPANY';
    setPayIsFeeAbsorbed(feePayer === 'COMPANY');
    setPayFeeAmount(30);

    // 優先挑選該請款發票買受法人之銀行帳戶 (跟著法人帳戶走)
    const companyBanks = bankAccounts.filter(b => b.companyId === rec.companyId && b.status === 'ACTIVE');
    const defaultBank = companyBanks[0] || bankAccounts.find(b => b.id === 'BANK-01') || bankAccounts[0];
    const targetBankId = defaultBank?.id || 'BANK-01';
    setPayBankAccountId(targetBankId);

    setPayMethod('TT');

    // 依該銀行帳戶之支票簿連續序號自動帶入
    const prefix = defaultBank?.checkPrefix || 'CQ';
    const nextSeq = defaultBank?.nextCheckNumber || 1001;
    const digits = defaultBank?.checkDigits || 6;
    setPayCheckNumber(`${prefix}-${String(nextSeq).padStart(digits, '0')}`);

    setPayCheckDueDate(rec.paymentDueDate);
    setPayDeductionAmount(0);
    setPayDeductionNote('');
    setPayNotes(`沖銷應付對帳單 [${rec.reconciliationNumber}]`);
    setIsPaymentModalOpen(true);
  };

  // 變更出款銀行帳戶時，自動連動支票連續號碼
  const handleBankChangeInPayment = (bId: string) => {
    setPayBankAccountId(bId);
    const targetBank = bankAccounts.find(b => b.id === bId);
    if (targetBank && payMethod === 'CHECK') {
      const prefix = targetBank.checkPrefix || 'CQ';
      const nextSeq = targetBank.nextCheckNumber || 1001;
      const digits = targetBank.checkDigits || 6;
      setPayCheckNumber(`${prefix}-${String(nextSeq).padStart(digits, '0')}`);
    }
  };

  // 變更支付方式時，連動票號與手續費防呆隔離 (Rule 2-2)
  const handlePayMethodChange = (method: 'TT' | 'CHECK' | 'CASH') => {
    setPayMethod(method);
    if (method === 'CHECK') {
      const targetBank = bankAccounts.find(b => b.id === payBankAccountId);
      const prefix = targetBank?.checkPrefix || 'CQ';
      const nextSeq = targetBank?.nextCheckNumber || 1001;
      const digits = targetBank?.checkDigits || 6;
      setPayCheckNumber(`${prefix}-${String(nextSeq).padStart(digits, '0')}`);
      setPayFeeAmount(0); // 支票無跨行轉帳手續費
    } else if (method === 'CASH') {
      setPayFeeAmount(0); // 現金無跨行轉帳手續費
    } else {
      setPayFeeAmount(30); // 電匯預設手續費 30 元
    }
  };

  // 放款金額與四柱沖銷計算 (跨行手續費僅轉帳生效，支票與現金手續費為 0 防呆)
  const paymentCalculations = useMemo(() => {
    if (!selectedRecForPayment) return { expectedTotal: 0, actualDisburse: 0, isBalanced: false, fee: 0, deduction: 0 };
    const expectedTotal = selectedRecForPayment.netPayableAmount;
    const deduction = Math.max(0, payDeductionAmount || 0);

    // 只有在電匯/轉帳 (TT) 時才有手續費，現金 (CASH) 或支票 (CHECK) 手續費絕對為 0 (防呆)
    const effectiveFee = payMethod === 'TT' ? Math.max(0, payFeeAmount || 0) : 0;

    // 四柱平衡公式 (Rule 7.3)
    // 實付 = 應付期望 - 粉紅代扣款
    let actualDisburse = Math.max(0, expectedTotal - deduction);

    // 內扣模式：匯費從實付中扣除 (廠商吸收)
    if (payMethod === 'TT' && !payIsFeeAbsorbed) {
      actualDisburse = Math.max(0, actualDisburse - effectiveFee);
    }

    // 驗證四柱平衡：實付 + 手續費 + 代扣 = 應付
    const testSum = actualDisburse + effectiveFee + deduction;
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
    const selectedBank = bankAccounts.find(b => b.id === payBankAccountId);
    const bp = partners.find(p => p.id === selectedRecForPayment.vendorId);

    // 廠商帳號異動鎖定防線 (Rule 7.5)
    if (bp?.isHighRisk) {
      onNotify(`⚠️ 廠商【${bp.name}】處於高風險鎖定狀態，需由管理主管核可後方得放款！`, 'error');
      return;
    }

    const payNo = `PAY-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

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
          feeAmount: payFeeAmount,
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
          bankAccountId: payBankAccountId,
          bankAccountName: selectedBank?.bankName || '公司帳戶',
          partnerId: selectedRecForPayment.vendorId,
          partnerName: selectedRecForPayment.vendorName,
          paymentMethod: payMethod,
          isReversal: false,
          documentDate: new Date().toISOString().slice(0, 10),
          postingDate: new Date().toISOString().slice(0, 10),
          totalAmount: paymentCalculations.actualDisburse,
          status: 'POSTED',
          isReconciled: false,
          notes: payNotes,
          lineItems,
          checkNumber: payMethod === 'CHECK' ? payCheckNumber : undefined,
          checkDueDate: payMethod === 'CHECK' ? payCheckDueDate : undefined,
          drawerBank: selectedBank?.bankName,
        },
        currentUser?.fullName || '李出納專員'
      );

      setIsPaymentModalOpen(false);
      onNotify(`✅ 付款單【${payNo}】已完成放款過帳！${payMethod === 'CHECK' ? `已開立黃燈期票 [${payCheckNumber}]。` : '已由實體銀行存款扣除。'}`, 'success');
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`放款失敗：${e.message}`, 'error');
    }
  };

  // 執行支票狀態流轉 (綠燈兌現 / 紅燈跳票 / 作廢)
  const handleExecuteCheckAction = () => {
    if (!selectedCheckForAction) return;

    try {
      if (checkActionType === 'CLEAR') {
        updateBankCheckStatus(
          selectedCheckForAction.id,
          'CLEARED',
          checkActualClearDate,
          undefined,
          currentUser?.fullName || '李出納專員'
        );
        onNotify(`🟢 支票【${selectedCheckForAction.checkNumber}】已確認存摺兌現！已正式扣減銀行真實餘額。`, 'success');
      } else if (checkActionType === 'BOUNCE') {
        if (!checkActionReason.trim()) {
          onNotify('跳票退票必須填寫原因！', 'warn');
          return;
        }
        updateBankCheckStatus(
          selectedCheckForAction.id,
          'BOUNCED',
          undefined,
          checkActionReason,
          currentUser?.fullName || '李出納專員'
        );
        onNotify(`🚨【最高警報】支票【${selectedCheckForAction.checkNumber}】已標記退票！源頭對帳單已瞬間復活為待付款！`, 'error');
      } else if (checkActionType === 'VOID') {
        if (!checkActionReason.trim()) {
          onNotify('支票作廢必須填寫原因！', 'warn');
          return;
        }
        updateBankCheckStatus(
          selectedCheckForAction.id,
          'VOIDED',
          undefined,
          checkActionReason,
          currentUser?.fullName || '李出納專員'
        );
        onNotify(`🛡️ 支票【${selectedCheckForAction.checkNumber}】已作廢！源頭帳務已自動執行反向沖銷。`, 'warn');
      }

      setSelectedCheckForAction(null);
      setCheckActionReason('');
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`支票操作失敗：${e.message}`, 'error');
    }
  };

  // 認領未知暫收款
  const handleAllocateSuspense = (susp: SuspenseReceipt, arId: string) => {
    try {
      allocateSuspenseReceipt(susp.id, arId, currentUser?.fullName || '張會計長');
      onNotify(`✅ 未知暫收款【NT$ ${susp.amount.toLocaleString()}】已成功認領勾稽至應收帳款，並正式觸發發票營業稅申報！`, 'success');
      loadAllFinanceData();
    } catch (e: any) {
      onNotify(`認領失敗：${e.message}`, 'error');
    }
  };

  // -------------------------------------------------------------
  // 過濾清冊
  // -------------------------------------------------------------
  const filteredRecs = useMemo(() => {
    return reconciliations.filter(r => {
      const matchSearch = searchQuery === '' ||
        r.reconciliationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.vendorName && r.vendorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.invoiceNumber && r.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchVendor = selectedVendorFilter === 'ALL' || r.vendorId === selectedVendorFilter;
      const matchStatus = selectedStatusFilter === 'ALL' || r.status === selectedStatusFilter;
      return matchSearch && matchVendor && matchStatus;
    });
  }, [reconciliations, searchQuery, selectedVendorFilter, selectedStatusFilter]);

  const filteredChecks = useMemo(() => {
    return checks.filter(c => {
      const matchType = checkTypeFilter === 'ALL' || c.type === checkTypeFilter;
      const matchSearch = searchQuery === '' ||
        c.checkNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.counterpartyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.bankName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchSearch;
    });
  }, [checks, checkTypeFilter, searchQuery]);

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
            {vendorPoolList.length > 0 && (
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
      {/* 主頁籤切換導航 (四核心支柱) */}
      {/* ======================================================== */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('RECONCILIATION_POOL')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'RECONCILIATION_POOL'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>會計應付對帳大水池</span>
            {metrics.pendingInboundCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'RECONCILIATION_POOL' ? 'bg-indigo-800 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {metrics.pendingInboundCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('TREASURY_PAYMENT')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'TREASURY_PAYMENT'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>出納放款與收納工作台</span>
            {metrics.pendingApCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'TREASURY_PAYMENT' ? 'bg-indigo-800 text-white' : 'bg-indigo-100 text-indigo-800'
              }`}>
                {metrics.pendingApCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('CHECK_RADAR')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'CHECK_RADAR'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>票據三燈號與資金雷達</span>
            {metrics.unclearedChecksCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'CHECK_RADAR' ? 'bg-indigo-800 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {metrics.unclearedChecksCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('INVOICE_PETTY_CASH')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'INVOICE_PETTY_CASH'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>共用發票主檔與暫收池</span>
            {metrics.pendingSuspenseCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'INVOICE_PETTY_CASH' ? 'bg-indigo-800 text-white' : 'bg-rose-100 text-rose-800'
              }`}>
                {metrics.pendingSuspenseCount}
              </span>
            )}
          </button>
        </div>

        {/* 頂部快捷動作 */}
        <div className="flex items-center gap-2">
          {activeTab === 'RECONCILIATION_POOL' && (
            <button
              onClick={() => handleOpenCreateRecModal()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>開立應付對帳單</span>
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
          {/* A. 待對帳大水池廠商卡片牆 (琥珀色標籤 · 防忘記請款) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h3 className="text-xs font-bold text-slate-800">
                  各廠商待對帳進貨大水池 (未結款項彙總 · 點擊開單對帳)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                依據現場簽收單沉澱 · 支援部分勾選與跨月延遲
              </span>
            </div>

            {vendorPoolList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                <div className="font-bold text-slate-700">目前所有現場進貨簽收單皆已完成對帳！大水池無沉澱款項。</div>
                <div className="text-[11px] text-slate-400 mt-1">若現場有新進貨點收過帳，將自動注入此水池中。</div>
              </div>
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
                                  if (isExpanded) {
                                    setExpandedVendorPoolIds(expandedVendorPoolIds.filter(id => id !== v.vendorId));
                                  } else {
                                    setExpandedVendorPoolIds([...expandedVendorPoolIds, v.vendorId]);
                                  }
                                }}
                                className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                              >
                                {isExpanded ? '收合' : '檢視單據'}
                              </button>
                              <button
                                onClick={() => handleOpenCreateRecModal(v.vendorId)}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                              >
                                <span>建立對帳單</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
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
                                          <th className="p-2">工程案場</th>
                                          <th className="p-2">簽收人</th>
                                          <th className="p-2 text-right">進貨未稅原額</th>
                                          <th className="p-2">簽收備註</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-mono">
                                        {v.receipts.map((r) => (
                                          <tr key={r.id} className="hover:bg-slate-50">
                                            <td className="p-2 font-bold text-slate-900">{r.receiptNumber}</td>
                                            <td className="p-2 text-indigo-700 font-semibold">{r.deliveryNoteNumber}</td>
                                            <td className="p-2 font-sans text-slate-600">{r.receivedDate}</td>
                                            <td className="p-2 font-sans text-slate-700">{r.projectNameSnapshot}</td>
                                            <td className="p-2 font-sans text-slate-600">{r.receivedBy}</td>
                                            <td className="p-2 text-right font-black text-slate-900">
                                              NT$ {r.totalAmount.toLocaleString()}
                                            </td>
                                            <td className="p-2 font-sans text-slate-500 max-w-xs truncate">
                                              {r.notes || '—'}
                                            </td>
                                          </tr>
                                        ))}
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

          {/* B. 應付對帳單清冊 (歷史紀錄與欠款水位預警) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800">
                  會計廠商應付對帳單主檔清冊 (AP Reconciliations)
                </h3>
                <span className="text-[11px] text-slate-400">
                  (共 {filteredRecs.length} 筆對帳單)
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
                  <option value="ALL">全部狀態</option>
                  <option value="APPROVED">已覆核 (待放款)</option>
                  <option value="PAID">已出金結清</option>
                  <option value="DRAFT">草稿暫存</option>
                  <option value="VOIDED">已作廢</option>
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
                    <th className="p-2.5 text-right">營業稅 (5%)</th>
                    <th className="p-2.5 text-right">本期應付淨額</th>
                    <th className="p-2.5">發票字軌</th>
                    <th className="p-2.5">預計付款日</th>
                    <th className="p-2.5 text-center">狀態</th>
                    <th className="p-2.5 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredRecs.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-slate-400 font-sans">
                        查無符合條件的應付對帳單
                      </td>
                    </tr>
                  ) : (
                    filteredRecs.map((rec) => {
                      // 計算預計付款日燈號
                      const today = new Date().toISOString().slice(0, 10);
                      const isOverdue = rec.status === 'APPROVED' && rec.paymentDueDate < today;
                      const isDueSoon = rec.status === 'APPROVED' && rec.paymentDueDate >= today && rec.paymentDueDate <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
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
                          <td className="p-2.5 text-right text-slate-600">
                            NT$ {rec.taxAmount.toLocaleString()}
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
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              rec.status === 'APPROVED' ? 'bg-amber-100 text-amber-800' :
                              rec.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                              rec.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {rec.status === 'APPROVED' ? '待出金放款' :
                               rec.status === 'PAID' ? '已出金結清' :
                               rec.status === 'DRAFT' ? '草稿暫存' : '已作廢'}
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-sans space-x-1.5">
                            {rec.status === 'APPROVED' && (
                              <button
                                onClick={() => handleOpenPaymentModal(rec)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                放款出金
                              </button>
                            )}
                            {rec.status !== 'VOIDED' && rec.status !== 'PAID' && (
                              <button
                                onClick={() => {
                                  setVoidModalTargetId(rec.id);
                                  setVoidReasonText('');
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
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
      {/* TAB 2: 出納放款與收納工作台 (Treasury & Cashier) */}
      {/* ======================================================== */}
      {activeTab === 'TREASURY_PAYMENT' && (
        <div className="space-y-4">
          {/* A. 待放款應付對帳單清冊 (可直接點擊進行四柱出金) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800">
                  出納待放款對帳清冊 (會計已審核 · 待出金放款)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                四柱平衡驗證 · 支援電匯與期票支票 · 匯費內外扣自動拆分
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
                  return (
                    <div
                      key={rec.id}
                      className="border border-indigo-200/80 bg-indigo-50/20 rounded-xl p-3.5 hover:shadow-xs transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                            {rec.reconciliationNumber}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            到期: {rec.paymentDueDate}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-2 truncate">
                          {rec.vendorName}
                        </h4>
                        <div className="text-xs text-slate-500 mt-0.5">
                          期別: {rec.billingPeriod} · 發票: {rec.invoiceNumber || '無'}
                        </div>
                        <div className="text-lg font-mono font-black text-indigo-700 mt-2">
                          NT$ {rec.netPayableAmount.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          匯費規則: {bp?.bankFeePayer === 'COMPANY' ? '公司外加吸收' : '廠商內扣 30 元'}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-indigo-200/50 flex items-center justify-end">
                        <button
                          onClick={() => handleOpenPaymentModal(rec)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>建立出金付款單</span>
                        </button>
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
                    <th className="p-2.5">付款單號</th>
                    <th className="p-2.5">入帳日期</th>
                    <th className="p-2.5">受款對象</th>
                    <th className="p-2.5">出款帳戶</th>
                    <th className="p-2.5 text-center">支付方式</th>
                    <th className="p-2.5 text-right">實付總額</th>
                    <th className="p-2.5 text-center">存摺調節</th>
                    <th className="p-2.5">備註說明</th>
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
                    payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{p.paymentNo}</td>
                        <td className="p-2.5 font-sans text-slate-600">{p.postingDate}</td>
                        <td className="p-2.5 font-sans font-bold text-slate-800">
                          {p.partnerName || p.customVendorName}
                        </td>
                        <td className="p-2.5 font-sans text-slate-600">{p.bankAccountName}</td>
                        <td className="p-2.5 text-center font-sans">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            p.paymentMethod === 'CHECK' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {p.paymentMethod === 'CHECK' ? '期票支票' : p.paymentMethod === 'TT' ? '電匯' : '現金'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-black text-slate-900">
                          NT$ {p.totalAmount.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-center font-sans">
                          {p.isReconciled ? (
                            <span className="text-emerald-600 font-bold">已調節</span>
                          ) : (
                            <span className="text-slate-400">未調節</span>
                          )}
                        </td>
                        <td className="p-2.5 font-sans text-slate-500 truncate max-w-xs">{p.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: 票據三燈號生命週期與資金雷達 (Check Radar) */}
      {/* ======================================================== */}
      {activeTab === 'CHECK_RADAR' && (
        <div className="space-y-4">
          {/* A. 票據狀態三燈號說明卡 */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800">
                  應收付票據三燈號生命週期 (Check Lifecycle & Cash Radar)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCheckTypeFilter('ALL')}
                  className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                    checkTypeFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  全部票據
                </button>
                <button
                  onClick={() => setCheckTypeFilter('PAYABLE')}
                  className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                    checkTypeFilter === 'PAYABLE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  應付票據 (廠商)
                </button>
                <button
                  onClick={() => setCheckTypeFilter('RECEIVABLE')}
                  className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                    checkTypeFilter === 'RECEIVABLE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  應收票據 (業主)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>🟡 黃燈：已開票/收票未兌現 (ISSUED)</span>
                </div>
                <div className="text-[11px] text-amber-800 leading-relaxed">
                  期票已開立或收取，債權債務催款警報解除，但<b>實體銀行存款絕對不增減</b>。僅依據預計兌現日排程於資金雷達時間軸。
                </div>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>🟢 綠燈：存摺已兌現結清 (CLEARED)</span>
                </div>
                <div className="text-[11px] text-emerald-800 leading-relaxed">
                  出納刷實體存摺確認扣款或入帳後點擊「確認兌現」，<b>實體銀行餘額正式變動</b>，單據徹底結清閉案。
                </div>
              </div>

              <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-rose-900 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>🔴 紅燈：退票跳票與 AP 瞬間復活 (BOUNCED)</span>
                </div>
                <div className="text-[11px] text-rose-800 leading-relaxed">
                  發生退票時，自動發送最高警報，並<b>瞬間將源頭應付對帳單退回「待付款」狀態</b>，保留審計軌跡且防範停工危機。
                </div>
              </div>
            </div>

            {/* 支票台帳表格 */}
            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">支票票號</th>
                    <th className="p-2.5 text-center">票據方向</th>
                    <th className="p-2.5">對象 (受款/發票人)</th>
                    <th className="p-2.5">開票銀行</th>
                    <th className="p-2.5 text-right">票面金額</th>
                    <th className="p-2.5">開票日期</th>
                    <th className="p-2.5">預計兌現日</th>
                    <th className="p-2.5">實際兌現日</th>
                    <th className="p-2.5 text-center">三燈號狀態</th>
                    <th className="p-2.5 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredChecks.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-400 font-sans">
                        查無符合條件的票據紀錄
                      </td>
                    </tr>
                  ) : (
                    filteredChecks.map((chk) => (
                      <tr key={chk.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{chk.checkNumber}</td>
                        <td className="p-2.5 text-center font-sans">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            chk.type === 'PAYABLE' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {chk.type === 'PAYABLE' ? '應付票據' : '應收票據'}
                          </span>
                        </td>
                        <td className="p-2.5 font-sans font-bold text-slate-800">{chk.counterpartyName}</td>
                        <td className="p-2.5 font-sans text-slate-600">{chk.bankName}</td>
                        <td className="p-2.5 text-right font-black text-slate-900">
                          NT$ {chk.amount.toLocaleString()}
                        </td>
                        <td className="p-2.5 font-sans text-slate-600">{chk.issueDate}</td>
                        <td className="p-2.5 font-sans text-slate-700 font-bold">{chk.dueDate}</td>
                        <td className="p-2.5 font-sans text-slate-500">{chk.actualClearanceDate || '-'}</td>
                        <td className="p-2.5 text-center font-sans">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            chk.status === 'ISSUED' ? 'bg-amber-100 text-amber-800' :
                            chk.status === 'CLEARED' ? 'bg-emerald-100 text-emerald-800' :
                            chk.status === 'BOUNCED' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              chk.status === 'ISSUED' ? 'bg-amber-500' :
                              chk.status === 'CLEARED' ? 'bg-emerald-500' :
                              chk.status === 'BOUNCED' ? 'bg-rose-600' : 'bg-slate-400'
                            }`} />
                            <span>
                              {chk.status === 'ISSUED' ? '黃燈 (未兌現)' :
                               chk.status === 'CLEARED' ? '綠燈 (已兌現)' :
                               chk.status === 'BOUNCED' ? '紅燈 (退票跳票)' : '已作廢'}
                            </span>
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-sans space-x-1.5">
                          {chk.status === 'ISSUED' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedCheckForAction(chk);
                                  setCheckActionType('CLEAR');
                                  setCheckActualClearDate(new Date().toISOString().slice(0, 10));
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                確認兌現
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCheckForAction(chk);
                                  setCheckActionType('BOUNCE');
                                  setCheckActionReason('');
                                }}
                                className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                退票回滾
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: 共用發票主檔與未知暫收池 (Invoices & Suspense) */}
      {/* ======================================================== */}
      {activeTab === 'INVOICE_PETTY_CASH' && (
        <div className="space-y-4">
          {/* A. 未知款項暫收池 (未認領前不報營業稅 · 認領瞬間才連動申報) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-800">
                  未知款項暫收款過渡池 (Suspense Accounts - 認領轉拋前不計營業稅)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                Rule 5.5: 存摺入帳未明款項先收容於此，工務釐清歸屬後點擊認領轉拋
              </span>
            </div>

            {suspenses.filter(s => !s.isAllocated).length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">
                <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-1 opacity-80" />
                <div className="font-bold text-slate-700">目前無待釐清之未知暫收款！</div>
              </div>
            ) : (
              <div className="space-y-2">
                {suspenses.filter(s => !s.isAllocated).map(susp => (
                  <div
                    key={susp.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-50/40 border border-amber-200/80 rounded-lg text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-900">
                          {susp.receivedDate}
                        </span>
                        <span className="font-bold text-slate-800">
                          {susp.bankAccountName || '公司帳戶'}
                        </span>
                      </div>
                      <div className="text-slate-600 mt-0.5">
                        來源附言: <span className="font-semibold text-slate-900">{susp.payerInfo}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">入帳金額</div>
                        <div className="text-sm font-mono font-black text-slate-900">
                          NT$ {susp.amount.toLocaleString()}
                        </div>
                      </div>

                      {arList.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <select
                            id={`alloc-${susp.id}`}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                          >
                            {arList.map(ar => (
                              <option key={ar.id} value={ar.id}>
                                [{ar.arNumber}] {ar.customerName} (NT$ {ar.amount.toLocaleString()})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const sel = document.getElementById(`alloc-${susp.id}`) as HTMLSelectElement;
                              if (sel) handleAllocateSuspense(susp, sel.value);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
                          >
                            認領轉拋 AR
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* B. 共用統一發票主檔 (進項與銷項) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800">
                  共用統一發票主檔 (進項/銷項 · 內外帳徹底解耦)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                字軌防重號檢核 · 多對多勾稽中介
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">發票字軌號碼</th>
                    <th className="p-2.5 text-center">發票方向</th>
                    <th className="p-2.5">開立日期</th>
                    <th className="p-2.5">開立方 (統編)</th>
                    <th className="p-2.5">買受方 (統編)</th>
                    <th className="p-2.5 text-right">未稅銷售額</th>
                    <th className="p-2.5 text-right">營業稅 (5%)</th>
                    <th className="p-2.5 text-right">含稅總額</th>
                    <th className="p-2.5 text-center">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-400 font-sans">
                        尚無統一發票登記主檔
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-indigo-700">{inv.invoiceNumber}</td>
                        <td className="p-2.5 text-center font-sans">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            inv.invoiceType === 'INPUT' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {inv.invoiceType === 'INPUT' ? '進項發票' : '銷項發票'}
                          </span>
                        </td>
                        <td className="p-2.5 font-sans text-slate-600">{inv.invoiceDate}</td>
                        <td className="p-2.5 font-sans text-slate-700">
                          {inv.issuerName || inv.issuerTaxId}
                        </td>
                        <td className="p-2.5 font-sans text-slate-700">
                          {inv.buyerName || inv.buyerTaxId}
                        </td>
                        <td className="p-2.5 text-right text-slate-700">
                          NT$ {inv.netAmount.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right text-slate-600">
                          NT$ {inv.taxAmount.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right font-black text-slate-900">
                          NT$ {inv.totalAmount.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-center font-sans">
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
                  開立廠商應付對帳單 (大水池簽收單勾稽 · 發票與稅額核算)
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
              {/* 基本對帳資訊列 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    對帳廠商 (Vendor)
                  </label>
                  <select
                    value={recTargetVendorId}
                    onChange={(e) => handleVendorChangeInModal(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                  >
                    {partners.filter(p => p.isVendor).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
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
                    預計付款日 (Due Date)
                  </label>
                  <input
                    type="date"
                    value={recPaymentDueDate}
                    onChange={(e) => setRecPaymentDueDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setRecPaymentDueDate(computeNextMonthPaymentDate(10))}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        recPaymentDueDate === computeNextMonthPaymentDate(10)
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      次月10日
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecPaymentDueDate(computeNextMonthPaymentDate(15))}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        recPaymentDueDate === computeNextMonthPaymentDate(15)
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      次月15日
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecPaymentDueDate(computeNextMonthPaymentDate(25))}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        recPaymentDueDate === computeNextMonthPaymentDate(25)
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      次月25日
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const bp = partners.find(p => p.id === recTargetVendorId);
                        setRecPaymentDueDate(computeTermsPaymentDate(bp?.paymentTermsDays || 30));
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      T+{partners.find(p => p.id === recTargetVendorId)?.paymentTermsDays || 30}
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    💡 預計付款日供出納排程；支票則以支票實際兌現日為出金基準。
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    營業稅模式
                  </label>
                  <select
                    value={recTaxType}
                    onChange={(e: any) => setRecTaxType(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                  >
                    <option value="TAX_EXCLUSIVE">外加 5% 營業稅 (標準)</option>
                    <option value="TAX_INCLUSIVE">內含 5% 營業稅</option>
                    <option value="TAX_EXEMPT">免稅 / 免用發票</option>
                  </select>
                </div>
              </div>

              {/* 勾稽進貨單清單 (支援直接展開檢視送貨單完整品項、單價與備註) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>勾選本期核對之現場進貨簽收單</span>
                    <span className="text-slate-400 font-normal">
                      (已勾選 {recSelectedReceiptIds.length} 筆 · 可展開查看明細品項)
                    </span>
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => {
                        const allIds = inboundReceipts
                          .filter(r => r.vendorId === recTargetVendorId && r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED')
                          .map(r => r.id);
                        setRecSelectedReceiptIds(allIds);
                      }}
                      className="text-indigo-600 font-bold hover:underline"
                    >
                      全選
                    </button>
                    <button
                      onClick={() => setRecSelectedReceiptIds([])}
                      className="text-slate-500 font-medium hover:underline"
                    >
                      清空
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {inboundReceipts.filter(r => r.vendorId === recTargetVendorId && r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED').length === 0 ? (
                    <div className="p-6 text-center text-slate-400">
                      該廠商大水池中目前無待對帳進貨單
                    </div>
                  ) : (
                    inboundReceipts
                      .filter(r => r.vendorId === recTargetVendorId && r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED')
                      .map((rec) => {
                        const isChecked = recSelectedReceiptIds.includes(rec.id);
                        const isExpanded = expandedReceiptIds.includes(rec.id);

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
                                  onChange={() => {}} // 由 parent onClick 觸發
                                  className="w-4 h-4 text-indigo-600 rounded"
                                />

                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-900">{rec.receiptNumber}</span>
                                    <span className="text-indigo-700 font-mono font-semibold">送貨單: {rec.deliveryNoteNumber}</span>
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
                        onChange={(e) => setRecHasInvoice(!e.target.checked)}
                      />
                      <span>免用發票 / 跨期補票</span>
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
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    發票手動稅額 (微調容差 ±{taxTolerance} 元)
                  </label>
                  <input
                    type="number"
                    value={recManualTax}
                    onChange={(e) => setRecManualTax(e.target.value)}
                    placeholder={`系統試算: NT$ ${recCalculations.autoTax}`}
                    className={`w-full bg-white border rounded-lg p-2 font-mono font-bold outline-none ${
                      !recCalculations.isTaxToleranceValid ? 'border-rose-500 text-rose-600 ring-1 ring-rose-500' : 'border-slate-300 text-slate-800'
                    }`}
                  />
                  <span className={`text-[10px] mt-1 block ${!recCalculations.isTaxToleranceValid ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                    {!recCalculations.isTaxToleranceValid
                      ? `⚠️ 差異 NT$ ${recCalculations.taxDiff} 超出全域容差 ±${taxTolerance} 元！`
                      : `系統試算 NT$ ${recCalculations.autoTax} · 容差內直接放行`}
                  </span>
                </div>
              </div>

              {/* 對帳計算結果卡片 */}
              <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] text-indigo-900 font-bold">
                    本期對帳結算 (四柱沖銷)
                  </div>
                  <div className="text-xs text-indigo-700 mt-0.5">
                    進貨 NT$ {recCalculations.inboundTotal.toLocaleString()} - 折讓 NT$ {recCalculations.discount.toLocaleString()} + 稅額 NT$ {recCalculations.finalTax.toLocaleString()}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-slate-500">本期應付淨額</div>
                  <div className="text-2xl font-mono font-black text-indigo-700">
                    NT$ {recCalculations.netPayable.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal 底部按鈕 */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setIsCreateRecModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer text-xs"
              >
                取消
              </button>

              <div className="space-x-2">
                <button
                  onClick={() => handleSaveReconciliation(false)}
                  className="px-4 py-2 border border-indigo-300 bg-white text-indigo-700 rounded-lg font-bold hover:bg-indigo-50 transition-colors cursor-pointer text-xs"
                >
                  存為草稿 (暫存)
                </button>
                <button
                  disabled={!recCalculations.isTaxToleranceValid}
                  onClick={() => handleSaveReconciliation(true)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors cursor-pointer text-xs shadow-2xs disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  確認覆核過帳 (轉入待放款)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: 出納放款出金 Modal (四柱平衡 · 匯費內外扣) */}
      {/* ======================================================== */}
      {isPaymentModalOpen && selectedRecForPayment && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  出納出金付款單 (四柱平衡檢核 · 匯費拆分)
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
              {/* 單據來源快照 */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                    {selectedRecForPayment.reconciliationNumber}
                  </span>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {selectedRecForPayment.vendorName}
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    到期日: {selectedRecForPayment.paymentDueDate} · 發票: {selectedRecForPayment.invoiceNumber}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400">應付總額期望值</div>
                  <div className="text-xl font-mono font-black text-indigo-700">
                    NT$ {selectedRecForPayment.netPayableAmount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* 出款帳戶與方式 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    出款銀行帳戶 (跟隨請款發票買受法人)
                  </label>
                  {(() => {
                    const companyBanks = bankAccounts.filter(b => b.companyId === selectedRecForPayment.companyId || b.isVirtualAccount);
                    const displayBanks = companyBanks.length > 0 ? companyBanks : bankAccounts;

                    return (
                      <select
                        value={payBankAccountId}
                        onChange={(e) => handleBankChangeInPayment(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                      >
                        {displayBanks.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.bankName} {b.branchName || ''} - 帳號: {b.accountNumber} {b.isVirtualAccount ? '(老闆私人專戶)' : ''}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    依法人發票買受主體篩選帳戶；銀行存款真實金額不對外出納顯示。
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    支付方式 (Payment Method)
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e: any) => handlePayMethodChange(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                  >
                    <option value="TT">電匯 / 轉帳 (TT · 需跨行手續費)</option>
                    <option value="CHECK">開立期票支票 (三燈號列管 · 自動取連貫票號)</option>
                    <option value="CASH">現金支付 (免跨行手續費)</option>
                  </select>
                </div>
              </div>

              {/* 若選支票，展開連續期票欄位 (防重號跳號) */}
              {payMethod === 'CHECK' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-amber-900">
                        支票票號 (連續號碼防呆)
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
                      由所選銀行帳戶之支票簿設定自動依序遞增，過帳後自動跳下號。
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">
                      支票實際到期日 / 兌現日 (資金雷達基準日)
                    </label>
                    <input
                      type="date"
                      value={payCheckDueDate}
                      onChange={(e) => setPayCheckDueDate(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-lg p-2 font-bold text-slate-900 outline-none"
                    />
                    <div className="text-[10px] text-amber-800 mt-1">
                      💡 票據以到期兌現日為準，入帳時先掛黃燈期票，兌現後才扣存摺。
                    </div>
                  </div>
                </div>
              )}

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
                    實付 NT$ {paymentCalculations.actualDisburse.toLocaleString()} + 匯費 NT$ {payFeeAmount} + 代扣 NT$ {(paymentCalculations.deduction || 0).toLocaleString()} = NT$ {paymentCalculations.expectedTotal.toLocaleString()}
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

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer text-xs"
              >
                取消
              </button>
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

      {/* ======================================================== */}
      {/* MODAL 3: 支票動作處理 (存摺兌現 / 退票跳票 / 作廢) */}
      {/* ======================================================== */}
      {selectedCheckForAction && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>
                  {checkActionType === 'CLEAR' ? '支票存摺兌現結清' :
                   checkActionType === 'BOUNCE' ? '支票退票 (觸發 AP 復活)' : '支票作廢'}
                </span>
              </h3>
              <button onClick={() => setSelectedCheckForAction(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">票號：</span>
                <span className="font-mono font-bold text-slate-900">{selectedCheckForAction.checkNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">受款對象：</span>
                <span className="font-bold text-slate-800">{selectedCheckForAction.counterpartyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">票面金額：</span>
                <span className="font-mono font-bold text-indigo-700">NT$ {selectedCheckForAction.amount.toLocaleString()}</span>
              </div>
            </div>

            {checkActionType === 'CLEAR' ? (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  存摺扣款入帳日期 (T+0 實際扣減日)
                </label>
                <input
                  type="date"
                  value={checkActualClearDate}
                  onChange={(e) => setCheckActualClearDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  點擊確認後，將正式扣除該開票銀行帳戶真實餘額，單據徹底結案。
                </span>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-rose-700 mb-1">
                  退票/作廢原因說明 (強制留痕)
                </label>
                <textarea
                  rows={3}
                  value={checkActionReason}
                  onChange={(e) => setCheckActionReason(e.target.value)}
                  placeholder="例如: 印鑑不符退票 / 廠商通知換票..."
                  className="w-full bg-white border border-rose-300 rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-rose-500"
                />
                <span className="text-[10px] text-rose-600 mt-1 block font-bold">
                  🛡️ 逆向防線：退票將自動生成反向分錄，並將源頭應付對帳單退回待付款狀態！
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedCheckForAction(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs"
              >
                取消
              </button>
              <button
                onClick={handleExecuteCheckAction}
                className={`px-4 py-1.5 rounded-lg font-bold text-white text-xs shadow-2xs ${
                  checkActionType === 'CLEAR' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {checkActionType === 'CLEAR' ? '確認存摺兌現' : '確認退票回滾'}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};
