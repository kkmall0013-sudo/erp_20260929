// src/components/finance/ar/ArPostInvoiceModal.tsx
// 🏷️ 免開票應收單 後續補開銷項發票／自主開立報稅發票彈窗

import React, { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import {
  AccountReceivable,
  Company,
  Project,
} from '../../../types/erp';
import { issueInvoiceForExistingAr } from '../../../db/sqlite';
import { formatLocalYmd } from '../financeUtils';

interface ArPostInvoiceModalProps {
  targetAr: AccountReceivable | null;
  projects: Project[];
  authorizedCorps: Company[];
  taxRate: number;
  taxRatePct: number;
  operatorName: string;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onIssued: () => void;
}

export const ArPostInvoiceModal: React.FC<ArPostInvoiceModalProps> = ({
  targetAr,
  projects,
  authorizedCorps,
  taxRate,
  taxRatePct,
  operatorName,
  onClose,
  onNotify,
  onIssued,
}) => {
  const [postInvMode, setPostInvMode] = useState<'DELIVERED' | 'SELF_RETAINED'>('DELIVERED');
  const [postInvFormat, setPostInvFormat] = useState<'THREE_PART' | 'TWO_PART'>('THREE_PART');
  const [postInvCompanyId, setPostInvCompanyId] = useState<string>('COMP-01');
  const [postInvTaxType, setPostInvTaxType] = useState<'TAX_INCLUSIVE' | 'TAX_EXCLUSIVE'>('TAX_INCLUSIVE');
  const [postInvAmount, setPostInvAmount] = useState<string>('');
  const [postInvNumber, setPostInvNumber] = useState<string>('');
  const [postInvDate, setPostInvDate] = useState<string>(formatLocalYmd(new Date()));
  const [postInvExtraTaxAr, setPostInvExtraTaxAr] = useState<boolean>(false);

  useEffect(() => {
    if (!targetAr) return;
    const proj = projects.find(p => p.id === targetAr.projectId);
    const hasTax = /^\d{8}$/.test((proj?.ownerTaxId || '').trim());
    setPostInvMode(targetAr.status === 'COLLECTED' ? 'SELF_RETAINED' : 'DELIVERED');
    setPostInvFormat(hasTax ? 'THREE_PART' : 'TWO_PART');
    setPostInvCompanyId(targetAr.companyId || authorizedCorps[0]?.id || 'COMP-01');
    setPostInvTaxType('TAX_INCLUSIVE');
    setPostInvAmount(String(targetAr.amount));
    setPostInvNumber('');
    setPostInvDate(formatLocalYmd(new Date()));
    setPostInvExtraTaxAr(false);
  }, [targetAr]);

  if (!targetAr) return null;

  const baseNum = Math.max(0, Number(postInvAmount || 0));
  const isSelf = postInvMode === 'SELF_RETAINED';
  const calcTax =
    isSelf || postInvTaxType === 'TAX_INCLUSIVE'
      ? Math.round(baseNum - baseNum / (1 + taxRate))
      : Math.round(baseNum * taxRate);
  const calcNet =
    isSelf || postInvTaxType === 'TAX_INCLUSIVE'
      ? Math.max(0, baseNum - calcTax)
      : baseNum;
  const calcTotal =
    isSelf || postInvTaxType === 'TAX_INCLUSIVE'
      ? baseNum
      : baseNum + calcTax;

  const handleConfirm = () => {
    if (!postInvNumber.trim()) {
      onNotify('請填入銷項發票字軌號碼', 'warn');
      return;
    }
    if (baseNum <= 0) {
      onNotify('請輸入大於 0 的發票金額', 'warn');
      return;
    }
    const proj = projects.find(p => p.id === targetAr.projectId);
    try {
      const createdTaxAr = issueInvoiceForExistingAr(
        {
          arId: targetAr.id,
          invoiceFormat: postInvFormat,
          invoiceIssueMode: postInvMode,
          invoiceNumber: postInvNumber.trim().toUpperCase(),
          invoiceDate: postInvDate,
          netAmount: calcNet,
          taxAmount: calcTax,
          totalAmount: calcTotal,
          updateArTotalIfUncollected:
            postInvMode === 'DELIVERED' && targetAr.appliedAmount === 0 && postInvTaxType === 'TAX_EXCLUSIVE',
          createExtraTaxReceivable:
            postInvMode === 'DELIVERED' && postInvExtraTaxAr && targetAr.appliedAmount > 0,
          companyId: postInvCompanyId,
          customerTaxId: proj?.ownerTaxId || undefined,
        },
        operatorName || '會計專員'
      );
      onNotify(
        createdTaxAr
          ? `✅ 已補開銷項發票 [${postInvNumber.trim().toUpperCase()}]，並自動產生 5% 稅金補收單 [${createdTaxAr.arNumber}] (NT$ ${createdTaxAr.amount.toLocaleString()})！`
          : postInvMode === 'SELF_RETAINED'
          ? `✅ 已自主開立報稅發票 [${postInvNumber.trim().toUpperCase()}] 寫入發票主檔（公司自留・稅金自理）！`
          : `✅ 已替應收單 [${targetAr.arNumber}] 補開銷項發票 [${postInvNumber.trim().toUpperCase()}]！`,
        'success'
      );
      onClose();
      onIssued();
    } catch (e: any) {
      onNotify(`補開發票失敗：${e.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-600" />
            <span>補開銷項發票 / 自主報稅 ({targetAr.arNumber})</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">業主／案場：</span>
            <span className="font-bold text-slate-900">
              {targetAr.customerName} ({targetAr.projectName})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">原請款單金額：</span>
            <span className="font-mono font-bold text-slate-800">
              NT$ {targetAr.amount.toLocaleString()}（已收 NT$ {targetAr.appliedAmount.toLocaleString()}）
            </span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1.5">開立用途模式</label>
          <div className="grid grid-cols-1 gap-2">
            <label
              className={`flex items-start gap-2 p-2.5 rounded-xl border-2 cursor-pointer ${
                postInvMode === 'DELIVERED' ? 'bg-indigo-50/70 border-indigo-400' : 'border-slate-200'
              }`}
            >
              <input
                type="radio"
                checked={postInvMode === 'DELIVERED'}
                onChange={() => setPostInvMode('DELIVERED')}
                className="mt-0.5"
              />
              <div>
                <div className="font-bold text-indigo-950">後續補開銷項發票（交付業主）</div>
                <div className="text-[11px] text-slate-600">
                  原免開票請款，事後業主要求補開 A 公司發票（未收款餘額將自動改鎖進開票公司戶）
                </div>
              </div>
            </label>
            <label
              className={`flex items-start gap-2 p-2.5 rounded-xl border-2 cursor-pointer ${
                postInvMode === 'SELF_RETAINED' ? 'bg-purple-50/70 border-purple-400' : 'border-slate-200'
              }`}
            >
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
                <div className="text-[11px] text-slate-600">
                  請完款後公司自行報稅使用，採含稅反算不向業主多收 5%，發票寫入公司主檔並標記自留
                </div>
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
          {!isSelf && targetAr.appliedAmount === 0 && (
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

        {!isSelf && targetAr.appliedAmount > 0 && calcTax > 0 && (
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
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer"
          >
            {isSelf ? '確認自主開票寫入主檔 (自留報稅)' : '確認補開銷項發票'}
          </button>
        </div>
      </div>
    </div>
  );
};
