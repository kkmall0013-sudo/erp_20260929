// src/components/finance/ar/ArCreateEditModal.tsx
// 📑 會計開立業主應收請款單 (AR) 彈窗（支援多工項明細、二/三聯式發票與暫收款認領連動）

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, Plus, Trash2, X, Zap } from 'lucide-react';
import {
  AccountReceivable,
  ArLineItem,
  BusinessPartner,
  Company,
  CompanyBankAccount,
  Project,
  SuspenseReceipt,
} from '../../../types/erp';
import {
  allocateSuspenseReceipt,
  createAccountsReceivable,
} from '../../../db/sqlite';
import {
  computeTermsPaymentDate,
  formatLocalYmd,
  isBossPrivateAccount,
  resolveProjectArContract,
} from '../financeUtils';

interface ArCreateEditModalProps {
  isOpen: boolean;
  pendingClaimSuspense: SuspenseReceipt | null;
  projects: Project[];
  companies: Company[];
  authorizedCorps: Company[];
  authorizedCorpIds: Set<string>;
  partners: BusinessPartner[];
  bankAccounts: CompanyBankAccount[];
  arList: AccountReceivable[];
  financeCompanyScope: string;
  taxRate: number;
  taxRatePct: number;
  operatorName: string;
  canEditArFor: (compId?: string) => boolean;
  canEditCashierFor: (compId?: string) => boolean;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onCreated: (createdAr: AccountReceivable, immediatelyCollect: boolean) => void;
}

export const ArCreateEditModal: React.FC<ArCreateEditModalProps> = ({
  isOpen,
  pendingClaimSuspense,
  projects,
  companies,
  authorizedCorps,
  authorizedCorpIds,
  partners,
  bankAccounts,
  arList,
  financeCompanyScope,
  taxRate,
  taxRatePct,
  operatorName,
  canEditArFor,
  canEditCashierFor,
  onClose,
  onNotify,
  onCreated,
}) => {
  const [arCompanyId, setArCompanyId] = useState<string>('COMP-01');
  const [arProjectId, setArProjectId] = useState<string>('');
  const [arTitle, setArTitle] = useState<string>('');
  const [arBaseAmount, setArBaseAmount] = useState<string>('');
  const [arHasInvoice, setArHasInvoice] = useState<boolean>(true);
  const [arInvoiceFormat, setArInvoiceFormat] = useState<'THREE_PART' | 'TWO_PART'>('THREE_PART');
  const [arTaxType, setArTaxType] = useState<'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT'>('TAX_EXCLUSIVE');
  const [arManualTax, setArManualTax] = useState<string>('');
  const [arInvoiceNumber, setArInvoiceNumber] = useState<string>('');
  const [arInvoiceDate, setArInvoiceDate] = useState<string>(formatLocalYmd(new Date()));
  const [arDueDate, setArDueDate] = useState<string>(() => computeTermsPaymentDate(30));
  const [arNotes, setArNotes] = useState<string>('');
  const [arUseMultiLine, setArUseMultiLine] = useState<boolean>(false);
  const [arMultiLines, setArMultiLines] = useState<
    Array<{ id: string; itemName: string; amount: string; taxMode: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT' }>
  >([]);

  useEffect(() => {
    if (!isOpen) return;

    const allowedProjects = projects.filter(p => {
      if (p.isDeleted || p.id === 'PRJ-INTERNAL') return false;
      const isUnassigned = !p.companyId || p.companyId === 'UNASSIGNED';
      if (!isUnassigned && authorizedCorpIds.size > 0 && !authorizedCorpIds.has(p.companyId)) return false;
      if (pendingClaimSuspense && pendingClaimSuspense.companyId !== 'BOSS-01') {
        return isUnassigned || p.companyId === pendingClaimSuspense.companyId;
      }
      return true;
    });

    const preferredScopeCompId =
      pendingClaimSuspense && pendingClaimSuspense.companyId !== 'BOSS-01'
        ? pendingClaimSuspense.companyId
        : financeCompanyScope !== 'ALL'
        ? financeCompanyScope
        : authorizedCorps[0]?.id || 'COMP-01';

    const matchingProj =
      allowedProjects.find(p => p.companyId === preferredScopeCompId) || allowedProjects[0];

    const contract = resolveProjectArContract(
      matchingProj,
      companies,
      partners,
      authorizedCorps,
      financeCompanyScope,
      preferredScopeCompId
    );
    const suspRemainingAmt = pendingClaimSuspense
      ? pendingClaimSuspense.remainingAmount ?? (pendingClaimSuspense.isAllocated ? 0 : pendingClaimSuspense.amount)
      : 0;

    setArProjectId(matchingProj?.id || '');
    setArCompanyId(contract.companyId || preferredScopeCompId);
    setArTitle(
      pendingClaimSuspense
        ? `暫收認領請款 (${pendingClaimSuspense.payerInfo.slice(0, 20)})`
        : '工程進度款請款'
    );
    setArBaseAmount(pendingClaimSuspense ? String(suspRemainingAmt) : '');

    const suspBank = pendingClaimSuspense
      ? bankAccounts.find(b => b.id === pendingClaimSuspense.bankAccountId)
      : undefined;
    const isSuspBoss = pendingClaimSuspense
      ? pendingClaimSuspense.companyId === 'BOSS-01' || Boolean(suspBank && isBossPrivateAccount(suspBank))
      : false;
    const hasEightDigitTax = /^\d{8}$/.test((contract.customerTaxId || '').trim());
    const initFormat: 'THREE_PART' | 'TWO_PART' = hasEightDigitTax ? 'THREE_PART' : 'TWO_PART';
    setArHasInvoice(!isSuspBoss);
    setArInvoiceFormat(initFormat);
    setArTaxType(isSuspBoss ? 'TAX_EXEMPT' : initFormat === 'TWO_PART' ? 'TAX_INCLUSIVE' : 'TAX_EXCLUSIVE');
    setArManualTax('');
    setArInvoiceNumber('');
    setArInvoiceDate(formatLocalYmd(new Date()));
    setArDueDate(computeTermsPaymentDate(30));
    setArNotes(pendingClaimSuspense ? `配合暫收款 [${pendingClaimSuspense.id}] 查明認領開單` : '');
    setArUseMultiLine(false);
    setArMultiLines([
      {
        id: `LI-${Date.now()}-1`,
        itemName: matchingProj?.name || '第一期工程款',
        amount: '',
        taxMode: !isSuspBoss ? 'TAX_EXCLUSIVE' : 'TAX_EXEMPT',
      },
    ]);
  }, [isOpen, pendingClaimSuspense]);

  const arTaxPreview = useMemo(() => {
    if (arUseMultiLine && arMultiLines.length > 0) {
      let netSum = 0;
      let taxSum = 0;
      for (const l of arMultiLines) {
        const raw = Math.max(0, Number(l.amount || 0));
        if (!arHasInvoice || l.taxMode === 'TAX_EXEMPT') {
          netSum += raw;
        } else if (l.taxMode === 'TAX_EXCLUSIVE') {
          const t = Math.round(raw * taxRate);
          netSum += raw;
          taxSum += t;
        } else {
          const t = Math.round(raw - raw / (1 + taxRate));
          const n = Math.max(0, raw - t);
          netSum += n;
          taxSum += t;
        }
      }
      const finalTax = !arHasInvoice
        ? 0
        : arManualTax.trim() !== ''
        ? Math.max(0, Number(arManualTax) || 0)
        : taxSum;
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
    const finalTax =
      !arHasInvoice || arTaxType === 'TAX_EXEMPT'
        ? 0
        : arManualTax.trim() !== ''
        ? Math.max(0, Number(arManualTax) || 0)
        : autoTax;
    const total =
      !arHasInvoice || arTaxType === 'TAX_EXEMPT'
        ? base
        : arTaxType === 'TAX_EXCLUSIVE'
        ? base + finalTax
        : base;
    const netAmt =
      !arHasInvoice || arTaxType === 'TAX_EXEMPT'
        ? base
        : arTaxType === 'TAX_EXCLUSIVE'
        ? base
        : Math.max(0, base - finalTax);
    return { base, autoTax, finalTax, total, netAmt };
  }, [arUseMultiLine, arMultiLines, arBaseAmount, arHasInvoice, arTaxType, arManualTax, taxRate]);

  if (!isOpen) return null;

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
  const lockedContract = resolveProjectArContract(
    selectedArProj,
    companies,
    partners,
    authorizedCorps,
    financeCompanyScope,
    arCompanyId
  );
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
    ? pendingClaimSuspense.remainingAmount ?? (pendingClaimSuspense.isAllocated ? 0 : pendingClaimSuspense.amount)
    : 0;

  const handleSave = (immediatelyCollect: boolean = false) => {
    const proj = projects.find(p => p.id === arProjectId);
    if (!proj) {
      onNotify('請選擇工程專案案場', 'warn');
      return;
    }
    const contract = resolveProjectArContract(
      proj,
      companies,
      partners,
      authorizedCorps,
      financeCompanyScope,
      arCompanyId
    );
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
        operatorName || '會計專員'
      );

      if (pendingClaimSuspense) {
        const suspRemBefore = pendingClaimSuspense.remainingAmount ?? pendingClaimSuspense.amount;
        allocateSuspenseReceipt(pendingClaimSuspense.id, createdAr.id, operatorName || '會計專員');
        const appliedFromSusp = Math.min(suspRemBefore, createdAr.amount);
        const suspLeftAfter = Math.max(0, suspRemBefore - appliedFromSusp);
        onNotify(
          suspLeftAfter > 0.01
            ? `✅ 已補開應收單 [${createdAr.arNumber}]（NT$ ${createdAr.amount.toLocaleString()}）並從暫收池自動沖銷，池內尚餘 NT$ ${suspLeftAfter.toLocaleString()} 可繼續分配下張請款單！`
            : `✅ 已補開應收單 [${createdAr.arNumber}] 並完成暫收款 NT$ ${appliedFromSusp.toLocaleString()} 認領沖銷！`,
          'success'
        );
        onClose();
        onCreated(createdAr, false);
        return;
      }

      onClose();
      onNotify(
        `✅ 應收請款單 [${createdAr.arNumber}] 已開立${
          createdAr.hasInvoice ? '並同步寫入該公司發票主檔' : '（免開發票，可入老闆私帳/現金）'
        }！`,
        'success'
      );
      onCreated(createdAr, immediatelyCollect && canEditCashierFor(createdAr.companyId));
    } catch (e: any) {
      onNotify(`開立應收單失敗：${e.message}`, 'error');
    }
  };

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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {pendingClaimSuspense && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-bold">🔗 綁定認領未知暫收款：{pendingClaimSuspense.bankAccountName}</div>
                <div className="text-[11px] mt-0.5">
                  來源附言：{pendingClaimSuspense.payerInfo}（{pendingClaimSuspense.receivedDate}）
                </div>
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
                  const nextContract = resolveProjectArContract(
                    nextProj,
                    companies,
                    partners,
                    authorizedCorps,
                    financeCompanyScope,
                    arCompanyId
                  );
                  setArCompanyId(nextContract.companyId);
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
                      [{p.projectCode}] {p.name}（承攬：{isUnassigned ? '尚未指定公司' : pComp?.shortName || pComp?.name || p.companyId} ｜ 業主：{p.ownerName}）
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
                  <div className="font-bold text-slate-900">{lockedContract.company?.name || '尚未選擇工程案場'}</div>
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
              <div className="font-bold text-slate-900">{lockedContract.customerName || '尚未選擇工程案場'}</div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                統編：{lockedContract.customerTaxId || '個人／無統編（建議開二聯式或免開票）'}
              </div>
            </div>

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
              <label className="block text-[11px] font-bold text-slate-700 mb-1">請款期別 / 摘要說明</label>
              <input
                type="text"
                value={arTitle}
                onChange={(e) => setArTitle(e.target.value)}
                placeholder="例：第一期簽約訂金（開發票60萬）、合約約定無發票尾款（40萬）"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none"
              />
            </div>
          </div>

          {/* 是否開發票切換 */}
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
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer"
          >
            {pendingClaimSuspense ? '補開 AR 並完成認領' : '開立應收請款單 (送交出納)'}
          </button>
          {!pendingClaimSuspense && lockedContract.companyId && canEditCashierFor(lockedContract.companyId) && (
            <button
              type="button"
              onClick={() => handleSave(true)}
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
};
