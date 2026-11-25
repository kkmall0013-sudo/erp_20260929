// src/components/finance/ap/ApReconciliationEditorModal.tsx
// 🧾 建立／重算修正廠商應付對帳單彈窗（純會計區：進貨單勾稽、折讓、發票與稅額容差檢核）

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Info,
  Lock,
  Receipt,
  X,
  Zap,
} from 'lucide-react';
import {
  AccountsPayableReconciliation,
  BusinessPartner,
  Company,
  InboundReceipt,
} from '../../../types/erp';
import {
  createApReconciliation,
  updateApReconciliation,
} from '../../../db/sqlite';
import {
  computeTermsPaymentDate,
  VendorPoolGroup,
} from '../financeUtils';
import { ApReconciliationReceiptsSelector } from './ApReconciliationReceiptsSelector';

interface ApReconciliationEditorModalProps {
  isOpen: boolean;
  initialVendorId: string;
  editingRec: AccountsPayableReconciliation | null;
  reconciliations: AccountsPayableReconciliation[];
  inboundReceipts: InboundReceipt[];
  partners: BusinessPartner[];
  companies: Company[];
  vendorPoolList: VendorPoolGroup[];
  taxRate: number;
  taxRatePct: number;
  taxTolerance: number;
  bossInvoicePolicy: 'STRICT_INVOICE_MATCH' | 'ALLOW_BOSS_ADVANCE';
  canEditCashier: boolean;
  operatorName: string;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onSaved: (savedRec: AccountsPayableReconciliation, openPaymentAfter: boolean) => void;
}

export const ApReconciliationEditorModal: React.FC<ApReconciliationEditorModalProps> = ({
  isOpen,
  initialVendorId,
  editingRec,
  reconciliations,
  inboundReceipts,
  partners,
  companies,
  vendorPoolList,
  taxRate,
  taxRatePct,
  taxTolerance,
  bossInvoicePolicy,
  canEditCashier,
  operatorName,
  onClose,
  onNotify,
  onSaved,
}) => {
  const [isSavingRec, setIsSavingRec] = useState(false);
  const [recTargetVendorId, setRecTargetVendorId] = useState<string>('');
  const [recVendorLocked, setRecVendorLocked] = useState<boolean>(true);
  const [recSelectedReceiptIds, setRecSelectedReceiptIds] = useState<string[]>([]);
  const [recDiscountAmount, setRecDiscountAmount] = useState<number>(0);
  const [recTaxType, setRecTaxType] = useState<'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT'>('TAX_EXCLUSIVE');
  const [recManualTax, setRecManualTax] = useState<string>('');
  const [recInvoiceNumber, setRecInvoiceNumber] = useState<string>('');
  const [recHasInvoice, setRecHasInvoice] = useState<boolean>(true);
  const [recBillingPeriod, setRecBillingPeriod] = useState<string>(new Date().toISOString().slice(0, 7));
  const [recNotes, setRecNotes] = useState<string>('');
  const [recCompanyId, setRecCompanyId] = useState<string>('COMP-01');
  const [recPaymentTermNotes, setRecPaymentTermNotes] = useState<string>('');
  const [recIsBossAdvance, setRecIsBossAdvance] = useState<boolean>(false);
  const [recReceiptCompanyFilter, setRecReceiptCompanyFilter] = useState<'ALL' | 'MATCH_COMPANY'>('ALL');
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setIsSavingRec(false);
    setExpandedReceiptIds([]);

    if (editingRec) {
      setRecTargetVendorId(editingRec.vendorId);
      setRecVendorLocked(true);

      const attachedIds =
        editingRec.receiptIds && editingRec.receiptIds.length > 0
          ? editingRec.receiptIds
          : inboundReceipts.filter(r => r.reconciliationId === editingRec.id).map(r => r.id);
      setRecSelectedReceiptIds(attachedIds);

      const nextTaxType = editingRec.taxType || 'TAX_EXCLUSIVE';
      const editBase = Math.max(0, (editingRec.inboundTotalAmount || 0) - (editingRec.discountAmount || 0));
      const editAutoTax =
        nextTaxType === 'TAX_EXCLUSIVE'
          ? Math.round(editBase * taxRate)
          : nextTaxType === 'TAX_INCLUSIVE'
          ? Math.round(editBase - editBase / (1 + taxRate))
          : 0;
      const isCustomManualTax =
        nextTaxType !== 'TAX_EXEMPT' &&
        editingRec.taxAmount !== undefined &&
        editingRec.taxAmount !== editAutoTax;

      setRecDiscountAmount(editingRec.discountAmount || 0);
      setRecHasInvoice(editingRec.hasInvoice !== false);
      setRecTaxType(nextTaxType);
      setRecManualTax(isCustomManualTax ? String(editingRec.taxAmount) : '');
      setRecInvoiceNumber(
        editingRec.invoiceNumber === 'NONE' || editingRec.invoiceNumber === 'PENDING_NEXT'
          ? ''
          : editingRec.invoiceNumber || ''
      );
      setRecBillingPeriod(editingRec.billingPeriod || new Date().toISOString().slice(0, 7));
      setRecNotes(editingRec.notes || '');
      setRecIsBossAdvance(Boolean(editingRec.isBossAdvance));
      setRecReceiptCompanyFilter('ALL');
      setRecCompanyId(editingRec.companyId || 'COMP-01');
      setRecPaymentTermNotes(editingRec.paymentTermNotes || '');
    } else {
      const targetVId = initialVendorId || (vendorPoolList.length > 0 ? vendorPoolList[0].vendorId : '');
      setRecTargetVendorId(targetVId);
      setRecVendorLocked(Boolean(initialVendorId) || vendorPoolList.length <= 1);

      const vPending = inboundReceipts.filter(
        r => r.vendorId === targetVId && r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED'
      );
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

      const receiptCompanyId = vPending.find(r => r.companyId)?.companyId;
      const preferredCompanyId = receiptCompanyId || bp?.companyId || (companies.length > 0 ? companies[0].id : 'COMP-01');
      setRecCompanyId(preferredCompanyId);
      setRecPaymentTermNotes(bp?.paymentMethodNotes?.trim() || '');
    }
  }, [isOpen, initialVendorId, editingRec]);

  const handleVendorChangeInModal = (vId: string) => {
    setRecTargetVendorId(vId);
    const vPending = inboundReceipts.filter(
      r => r.vendorId === vId && r.billingStatus === 'PENDING_BILLING' && r.status === 'POSTED'
    );
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

  const recCalculations = useMemo(() => {
    const selectedReceipts = inboundReceipts.filter(r => recSelectedReceiptIds.includes(r.id));
    const inboundTotal = selectedReceipts.reduce((sum, r) => sum + r.totalAmount, 0);
    const discount = Math.max(0, recDiscountAmount || 0);
    const baseAmount = Math.max(0, inboundTotal - discount);

    let autoTax = 0;
    if (recTaxType === 'TAX_EXCLUSIVE') {
      autoTax = Math.round(baseAmount * taxRate);
    } else if (recTaxType === 'TAX_INCLUSIVE') {
      autoTax = Math.round(baseAmount - baseAmount / (1 + taxRate));
    }

    const parsedManual = recManualTax.trim() !== '' ? Number(recManualTax) : NaN;
    const finalTax =
      recTaxType === 'TAX_EXEMPT'
        ? 0
        : Number.isFinite(parsedManual)
        ? Math.max(0, Math.round(parsedManual))
        : autoTax;
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

  if (!isOpen) return null;

  const editingRecId = editingRec?.id || null;
  const editingReturnedReason =
    editingRec && editingRec.status === 'RETURNED'
      ? editingRec.returnedReason || '出納退回要求重算修正'
      : null;

  const handleSave = (isApproved: boolean, openPaymentAfter: boolean = false) => {
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
      onNotify(
        `發票手動稅額與系統試算差異 (NT$ ${recCalculations.taxDiff}) 超過法定容差 ±${taxTolerance} 元，系統已阻斷存檔！`,
        'error'
      );
      return;
    }

    const targetPartner = partners.find(p => p.id === recTargetVendorId);
    const vendorName = targetPartner?.name || '未知廠商';
    const isNoInv = !recHasInvoice || recTaxType === 'TAX_EXEMPT';
    const isBossAdvFlag = Boolean(bossInvoicePolicy === 'ALLOW_BOSS_ADVANCE' && !isNoInv && recIsBossAdvance);
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
        ? updateApReconciliation(editingRecId, payload, operatorName || '會計專員')
        : createApReconciliation(
            {
              ...payload,
              reconciliationNumber: `REC-${recBillingPeriod.replace('-', '')}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
            },
            operatorName || '會計專員'
          );

      const wasEditing = Boolean(editingRecId);
      onClose();

      if (isApproved && openPaymentAfter && canEditCashier) {
        onNotify(`✅ 對帳單【${savedRec.reconciliationNumber}】已完成${wasEditing ? '重算並' : ''}核准立帳，已為您開啟出納付款單！`, 'success');
        onSaved(savedRec, true);
      } else {
        onNotify(
          `✅ 對帳單【${savedRec.reconciliationNumber}】已成功${wasEditing ? '重算更新並' : ''}${
            isApproved ? '核准立帳（已拋轉至出納待放款清冊）' : '儲存為草稿（保留於上方待辦大水池）'
          }！`,
          'success'
        );
        onSaved(savedRec, false);
      }
    } catch (e: any) {
      onNotify(`❌ 對帳單儲存失敗：${e.message}`, 'error');
    } finally {
      setIsSavingRec(false);
    }
  };

  const lockedPartner = partners.find(p => p.id === recTargetVendorId);
  const lockedPool = vendorPoolList.find(v => v.vendorId === recTargetVendorId);
  const lockedName = lockedPartner?.name || lockedPool?.vendorName || '未知廠商';
  const lockedTaxId = lockedPartner?.taxId || lockedPool?.vendorTaxId;
  const isNoInvoiceMode = !recHasInvoice || recTaxType === 'TAX_EXEMPT';

  const editingRecObj = editingRecId ? reconciliations.find(x => x.id === editingRecId) : undefined;
  const editingAttachedSet = new Set(editingRecObj?.receiptIds || []);
  const vendorPendingAll = inboundReceipts.filter(
    r =>
      r.vendorId === recTargetVendorId &&
      r.status === 'POSTED' &&
      (r.billingStatus === 'PENDING_BILLING' ||
        (editingRecId && (r.reconciliationId === editingRecId || editingAttachedSet.has(r.id))))
  );
  const visibleReceipts =
    recReceiptCompanyFilter === 'MATCH_COMPANY'
      ? vendorPendingAll.filter(r => !r.companyId || r.companyId === recCompanyId)
      : vendorPendingAll;
  const selectedMismatched = recCalculations.selectedReceipts.filter(
    r => r.companyId && r.companyId !== recCompanyId
  );
  const selectedBuyerComp = companies.find(c => c.id === recCompanyId);

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
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
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

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
                  onChange={(e) => {
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

          {lockedPartner?.paymentMethodNotes && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl px-3.5 py-2 flex items-center gap-2 text-xs text-indigo-900">
              <Info className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                廠商【<b>{lockedPartner.name}</b>】主檔付款慣例備註：<b className="text-indigo-700">{lockedPartner.paymentMethodNotes}</b>
              </span>
            </div>
          )}

          {/* 立帳歸屬法人與交辦出納條件 */}
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
                  onChange={(e) => setRecCompanyId(e.target.value)}
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

          {/* 勾稽進貨單清單 */}
          <ApReconciliationReceiptsSelector
            visibleReceipts={visibleReceipts}
            vendorPendingAllCount={vendorPendingAll.length}
            selectedReceiptIds={recSelectedReceiptIds}
            expandedReceiptIds={expandedReceiptIds}
            recCompanyId={recCompanyId}
            receiptCompanyFilter={recReceiptCompanyFilter}
            selectedMismatchedCount={selectedMismatched.length}
            selectedBuyerCompName={selectedBuyerComp?.shortName || selectedBuyerComp?.name || ''}
            companies={companies}
            onChangeFilter={setRecReceiptCompanyFilter}
            onToggleSelect={(id) =>
              setRecSelectedReceiptIds(prev =>
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
              )
            }
            onSelectAll={() => setRecSelectedReceiptIds(visibleReceipts.map(r => r.id))}
            onClearSelection={() => setRecSelectedReceiptIds([])}
            onToggleExpand={(id) =>
              setExpandedReceiptIds(prev =>
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
              )
            }
          />

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
                <label className="text-[11px] font-bold text-slate-700">發票字軌號碼</label>
                <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!recHasInvoice}
                    onChange={(e) => setRecHasInvoice(!e.target.checked)}
                  />
                  <span>免用發票 / 無發票</span>
                </label>
              </div>
              <input
                type="text"
                disabled={!recHasInvoice}
                value={recInvoiceNumber}
                onChange={(e) => setRecInvoiceNumber(e.target.value.toUpperCase())}
                placeholder={recHasInvoice ? '例如: TC-88992211' : '免用統一發票'}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-400"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                {recHasInvoice ? '台灣發票字軌 (英文2碼 + 8碼數字)' : '若當期未取具發票，標記為下期補票'}
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

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer text-xs"
          >
            取消
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={isSavingRec}
              onClick={() => handleSave(false, false)}
              className="px-4 py-2 border border-indigo-300 bg-white text-indigo-700 rounded-lg font-bold hover:bg-indigo-50 transition-colors cursor-pointer text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingRec ? '處理中...' : '存為草稿 (暫存)'}
            </button>
            <button
              disabled={isSavingRec || !recCalculations.isTaxToleranceValid}
              onClick={() => handleSave(true, false)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors cursor-pointer text-xs shadow-2xs disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {isSavingRec ? '處理中...' : '核准對帳立帳（送交出納）'}
            </button>
            {canEditCashier && (
              <button
                disabled={isSavingRec || !recCalculations.isTaxToleranceValid}
                onClick={() => handleSave(true, true)}
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
  );
};
