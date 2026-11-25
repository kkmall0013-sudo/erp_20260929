// src/components/finance/ap/ApCashierPaymentModal.tsx
// 💳 出納放款出金付款單彈窗（付款方式擇定、四柱平衡校驗、連續票號與排程快選）

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, RotateCcw, Wallet, X } from 'lucide-react';
import {
  AccountsPayableReconciliation,
  BusinessPartner,
  Company,
  CompanyBankAccount,
  PaymentLineItem,
} from '../../../types/erp';
import { createPaymentRecord } from '../../../db/sqlite';
import {
  computeTermsPaymentDate,
  filterBanksForMethod,
  formatLocalYmd,
  getAllowedPaymentMethods,
  getEligibleBanks,
  getThreeMonthScheduleRows,
  isBossPrivateAccount,
  pickNearestScheduleDate,
  resolveScheduleInfo,
} from '../financeUtils';

interface ApCashierPaymentModalProps {
  targetRec: AccountsPayableReconciliation | null;
  partners: BusinessPartner[];
  companies: Company[];
  bankAccounts: CompanyBankAccount[];
  globalScheduleDaysStr: string;
  bossInvoicePolicy: 'STRICT_INVOICE_MATCH' | 'ALLOW_BOSS_ADVANCE';
  canEditCashier: boolean;
  operatorName: string;
  onClose: () => void;
  onRequestReturn: (rec: AccountsPayableReconciliation) => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onPaid: () => void;
}

export const ApCashierPaymentModal: React.FC<ApCashierPaymentModalProps> = ({
  targetRec,
  partners,
  companies,
  bankAccounts,
  globalScheduleDaysStr,
  bossInvoicePolicy,
  canEditCashier,
  operatorName,
  onClose,
  onRequestReturn,
  onNotify,
  onPaid,
}) => {
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

  const syncPaySelectionForRec = (
    rec: AccountsPayableReconciliation,
    allowBossPrivate: boolean,
    preferredMethod?: 'CHECK' | 'TT' | 'CASH',
    preferredBankId?: string
  ) => {
    const eligible = getEligibleBanks(bankAccounts, rec.companyId, allowBossPrivate);
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
    const targetBank = targetMethod === 'CASH' ? undefined : matchedBank || methodBanks[0];
    const targetBankId = targetMethod === 'CASH' ? 'CASH' : targetBank?.id || '';

    setPayMethod(targetMethod);
    setPayBankAccountId(targetBankId);

    if (targetMethod === 'CHECK' && targetBank) {
      const prefix = targetBank.checkPrefix || 'CQ';
      const nextSeq = targetBank.nextCheckNumber || 1001;
      const digits = targetBank.checkDigits || 6;
      const fallbackCheckNo = `${prefix}-${String(nextSeq).padStart(digits, '0')}`;
      const prefilledCheckNo =
        rec.designatedCheckNumber && rec.designatedBankAccountId === targetBank.id
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

  useEffect(() => {
    if (!targetRec) return;
    const bp = partners.find(p => p.id === targetRec.vendorId);
    const feePayer = bp?.bankFeePayer || 'COMPANY';
    setPayIsFeeAbsorbed(feePayer === 'COMPANY');

    const initBossAdvance = Boolean(targetRec.isBossAdvance);
    setPayIsBossAdvance(initBossAdvance);

    const isNoInv = !targetRec.hasInvoice || targetRec.taxType === 'TAX_EXEMPT';
    const allowBoss =
      isNoInv || (bossInvoicePolicy === 'ALLOW_BOSS_ADVANCE' && initBossAdvance) || initBossAdvance;

    const { targetMethod, targetBankId } = syncPaySelectionForRec(
      targetRec,
      allowBoss,
      targetRec.designatedPaymentMethod,
      targetRec.designatedBankAccountId
    );

    if (targetMethod === 'CHECK') {
      if (targetRec.designatedPaymentMethod === 'CHECK' && targetRec.paymentDueDate) {
        setPayCheckDueDate(targetRec.paymentDueDate);
      } else {
        const { days } = resolveScheduleInfo(
          bankAccounts,
          companies,
          globalScheduleDaysStr,
          targetRec.companyId,
          targetBankId === 'CASH' ? undefined : targetBankId
        );
        setPayCheckDueDate(pickNearestScheduleDate(days));
      }
    } else {
      setPayCheckDueDate(targetRec.paymentDueDate || formatLocalYmd(new Date()));
    }

    setPayDeductionAmount(0);
    setPayDeductionNote('');
    setPayNotes(
      `${targetRec.bouncedCheckNumber ? `[退票重付 原票 ${targetRec.bouncedCheckNumber}] ` : ''}沖銷應付對帳單 [${targetRec.reconciliationNumber}] ${
        targetRec.paymentTermNotes ? `(${targetRec.paymentTermNotes})` : ''
      }`
    );
  }, [targetRec]);

  const paymentCalculations = useMemo(() => {
    if (!targetRec) {
      return { expectedTotal: 0, actualDisburse: 0, isBalanced: false, fee: 0, deduction: 0 };
    }
    const expectedTotal = targetRec.netPayableAmount;
    const deduction = Math.max(0, payDeductionAmount || 0);
    const effectiveFee = payMethod === 'TT' ? Math.max(0, payFeeAmount || 0) : 0;

    let actualDisburse = Math.max(0, expectedTotal - deduction);
    if (payMethod === 'TT' && !payIsFeeAbsorbed) {
      actualDisburse = Math.max(0, actualDisburse - effectiveFee);
    }

    const testSum =
      payMethod === 'TT' && !payIsFeeAbsorbed
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
  }, [targetRec, payDeductionAmount, payIsFeeAbsorbed, payFeeAmount, payMethod]);

  if (!targetRec) return null;

  const handleBankChangeInPayment = (bId: string) => {
    setPayBankAccountId(bId);
    const targetBank = bankAccounts.find(b => b.id === bId);
    if (targetBank && payMethod === 'CHECK') {
      const prefix = targetBank.checkPrefix || 'CQ';
      const nextSeq = targetBank.nextCheckNumber || 1001;
      const digits = targetBank.checkDigits || 6;
      setPayCheckNumber(`${prefix}-${String(nextSeq).padStart(digits, '0')}`);
      const { days } = resolveScheduleInfo(bankAccounts, companies, globalScheduleDaysStr, targetRec.companyId, bId);
      setPayCheckDueDate(pickNearestScheduleDate(days));
    }
  };

  const handlePayMethodChange = (method: 'TT' | 'CHECK' | 'CASH') => {
    const isNoInv = !targetRec.hasInvoice || targetRec.taxType === 'TAX_EXEMPT';
    const allowBoss =
      isNoInv ||
      Boolean(targetRec.isBossAdvance) ||
      (bossInvoicePolicy === 'ALLOW_BOSS_ADVANCE' && payIsBossAdvance);
    const { targetMethod, targetBankId } = syncPaySelectionForRec(targetRec, allowBoss, method, payBankAccountId);
    if (targetMethod === 'CHECK') {
      const { days } = resolveScheduleInfo(
        bankAccounts,
        companies,
        globalScheduleDaysStr,
        targetRec.companyId,
        targetBankId === 'CASH' ? undefined : targetBankId
      );
      setPayCheckDueDate(pickNearestScheduleDate(days));
    }
  };

  const handleConfirmPayment = () => {
    if (payMethod !== 'CASH' && (!payBankAccountId || payBankAccountId === 'CASH')) {
      onNotify('請選擇合法的出款銀行專戶，或改為現金支付！', 'warn');
      return;
    }
    const selectedBank = payMethod === 'CASH' ? undefined : bankAccounts.find(b => b.id === payBankAccountId);
    const bp = partners.find(p => p.id === targetRec.vendorId);

    if (bp?.isHighRisk) {
      onNotify(`⚠️ 廠商【${bp.name}】處於高風險鎖定狀態，需由管理主管核可後方得放款！`, 'error');
      return;
    }

    const payNo = `PAY-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const isBossAdvPay = Boolean(
      payIsBossAdvance ||
        targetRec.isBossAdvance ||
        (selectedBank && isBossPrivateAccount(selectedBank))
    );

    try {
      const lineItems: PaymentLineItem[] = [
        {
          id: `PLI-${Date.now()}-1`,
          paymentId: '',
          sourceType: 'AP',
          sourceId: targetRec.id,
          sourceNumber: targetRec.reconciliationNumber,
          itemType: 'STANDARD',
          appliedAmount: paymentCalculations.actualDisburse,
          feeAmount: paymentCalculations.fee,
          isFeeAbsorbedByCompany: payIsFeeAbsorbed,
          discountAmount: 0,
          notes: payNotes,
        },
      ];

      if (payDeductionAmount > 0) {
        lineItems.push({
          id: `PLI-${Date.now()}-2`,
          paymentId: '',
          sourceType: 'EXP',
          sourceId: targetRec.id,
          sourceNumber: `DED-${targetRec.reconciliationNumber}`,
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
          companyId: targetRec.companyId,
          currency: 'TWD',
          bankAccountId: payMethod === 'CASH' ? 'CASH' : payBankAccountId,
          bankAccountName: payMethod === 'CASH' ? '公司現金櫃檯 / 零用金' : selectedBank?.bankName || '公司帳戶',
          partnerId: targetRec.vendorId,
          partnerName: targetRec.vendorName,
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
          replacesCheckNumber: payMethod === 'CHECK' ? targetRec.bouncedCheckNumber : undefined,
        },
        operatorName || '李出納專員'
      );

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
      onClose();
      onPaid();
    } catch (e: any) {
      onNotify(`放款失敗：${e.message}`, 'error');
    }
  };

  const bpSnapshot = partners.find(p => p.id === targetRec.vendorId);
  const taxModeText =
    targetRec.taxType === 'TAX_EXCLUSIVE'
      ? '外加稅'
      : targetRec.taxType === 'TAX_INCLUSIVE'
      ? '內含稅'
      : '免稅';
  const isNoInv = !targetRec.hasInvoice || targetRec.taxType === 'TAX_EXEMPT';
  const allowBoss =
    isNoInv || Boolean(targetRec.isBossAdvance) || (bossInvoicePolicy === 'ALLOW_BOSS_ADVANCE' && payIsBossAdvance);
  const eligibleBanks = getEligibleBanks(bankAccounts, targetRec.companyId, allowBoss);
  const allowedMethods = getAllowedPaymentMethods(eligibleBanks);
  const methodBanks = filterBanksForMethod(eligibleBanks, payMethod);

  const { days: activeScheduleDays, sourceLabel } = resolveScheduleInfo(
    bankAccounts,
    companies,
    globalScheduleDaysStr,
    targetRec.companyId,
    payBankAccountId && payBankAccountId !== 'CASH' ? payBankAccountId : undefined
  );
  const threeMonthRows = getThreeMonthScheduleRows(activeScheduleDays);
  const partnerTerm = bpSnapshot?.paymentTermsDays;
  const baseTerms = [0, 30, 45, 60, 90];
  const termOptions =
    partnerTerm && !baseTerms.includes(partnerTerm)
      ? [...baseTerms, partnerTerm].sort((a, b) => a - b)
      : baseTerms;

  return (
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
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* 單據來源快照 */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                  {targetRec.reconciliationNumber}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200">
                  {companies.find(c => c.id === targetRec.companyId)?.name || '指定公司'} 立帳
                </span>
                {targetRec.isBossAdvance && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                    老闆私帳核可
                  </span>
                )}
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1">{targetRec.vendorName}</div>
              <div className="text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>
                  發票:{' '}
                  {targetRec.invoiceNumber === 'NONE'
                    ? '免用發票'
                    : targetRec.invoiceNumber === 'PENDING_NEXT'
                    ? '下期補票'
                    : targetRec.invoiceNumber}
                </span>
                {bpSnapshot?.paymentMethodNotes && (
                  <span className="text-indigo-700 font-semibold">· 廠商慣例: {bpSnapshot.paymentMethodNotes}</span>
                )}
                {targetRec.paymentTermNotes && (
                  <span className="text-amber-800 font-semibold">· 會計備註: {targetRec.paymentTermNotes}</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500">
                本金 NT$ {Math.max(0, targetRec.inboundTotalAmount - (targetRec.discountAmount || 0)).toLocaleString()} · 稅額 ({taxModeText}){' '}
                <b className="text-indigo-700">NT$ {targetRec.taxAmount.toLocaleString()}</b>
              </div>
              <div className="text-[10px] text-slate-400">應付總額期望值</div>
              <div className="text-xl font-mono font-black text-indigo-700">
                NT$ {targetRec.netPayableAmount.toLocaleString()}
              </div>
            </div>
          </div>

          {/* 出款帳戶與方式 */}
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
                        targetRec,
                        checked || Boolean(targetRec.isBossAdvance)
                      );
                      if (targetMethod === 'CHECK') {
                        const { days } = resolveScheduleInfo(
                          bankAccounts,
                          companies,
                          globalScheduleDaysStr,
                          targetRec.companyId,
                          targetBankId === 'CASH' ? undefined : targetBankId
                        );
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
                        {isBossPrivateAccount(b) ? '[老闆私人專戶] ' : ''}
                        {b.bankName} {b.branchName || ''} - 帳號: {b.accountNumber}
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

          {/* 連續期票號碼 ＋ 三個月排程快選與票期設定 */}
          {payMethod === 'CHECK' && (
            <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-amber-900">支票票號 (可自由修正)</label>
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
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 truncate max-w-[180px]"
                      title={sourceLabel}
                    >
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
                  <span className="w-20 shrink-0 text-[10px] font-bold text-amber-800">票期快選</span>
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
                          {days === 0 ? '即期 (0天)' : `${days}天票`}
                          {isPartnerDefault ? ' · 廠商約定' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 匯費與代扣款設定 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {payMethod === 'TT' ? (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">跨行轉帳手續費</label>
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
                <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">免手續費</span>
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
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer text-xs"
            >
              取消
            </button>
            {canEditCashier && (
              <button
                type="button"
                onClick={() => onRequestReturn(targetRec)}
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
  );
};
