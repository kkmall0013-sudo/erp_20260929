// src/components/finance/ar/ArCollectModal.tsx
// 💰 出納應收收款登錄彈窗（支援部分收款／少收折讓結清／溢收直入案場總帳或暫收池）

import React, { useEffect, useState } from 'react';
import { Wallet, X } from 'lucide-react';
import {
  AccountReceivable,
  Company,
  CompanyBankAccount,
} from '../../../types/erp';
import { collectAccountsReceivable } from '../../../db/sqlite';
import {
  formatLocalYmd,
  getEligibleReceivingBanks,
  isBossPrivateAccount,
} from '../financeUtils';

interface ArCollectModalProps {
  targetAr: AccountReceivable | null;
  companies: Company[];
  bankAccounts: CompanyBankAccount[];
  operatorName: string;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onCollected: () => void;
}

export const ArCollectModal: React.FC<ArCollectModalProps> = ({
  targetAr,
  companies,
  bankAccounts,
  operatorName,
  onClose,
  onNotify,
  onCollected,
}) => {
  const [collectMethod, setCollectMethod] = useState<'TT' | 'CHECK' | 'CASH'>('TT');
  const [collectBankAccountId, setCollectBankAccountId] = useState<string>('');
  const [collectReceivedAmount, setCollectReceivedAmount] = useState<string>('');
  const [collectShortageMode, setCollectShortageMode] = useState<'PARTIAL' | 'SETTLE_SHORT'>('PARTIAL');
  const [collectOverpayMode, setCollectOverpayMode] = useState<'TO_PROJECT_ADVANCE' | 'TO_SUSPENSE' | 'DIRECT_OVERPAY'>('TO_PROJECT_ADVANCE');
  const [collectReceivedDate, setCollectReceivedDate] = useState<string>(formatLocalYmd(new Date()));
  const [collectCheckNumber, setCollectCheckNumber] = useState<string>('');
  const [collectCheckDueDate, setCollectCheckDueDate] = useState<string>(formatLocalYmd(new Date()));
  const [collectDrawerBank, setCollectDrawerBank] = useState<string>('');
  const [collectNotes, setCollectNotes] = useState<string>('');

  useEffect(() => {
    if (!targetAr) return;
    const hasInv = targetAr.hasInvoice !== false;
    const eligibleBanks = getEligibleReceivingBanks(
      bankAccounts,
      targetAr.companyId,
      hasInv,
      targetAr.invoiceIssueMode
    );
    setCollectMethod(eligibleBanks.length > 0 ? 'TT' : 'CASH');
    setCollectBankAccountId(eligibleBanks[0]?.id || 'CASH');
    setCollectReceivedAmount(String(targetAr.remainingAmount));
    setCollectShortageMode('PARTIAL');
    setCollectOverpayMode('TO_PROJECT_ADVANCE');
    setCollectReceivedDate(formatLocalYmd(new Date()));
    setCollectCheckNumber('');
    setCollectCheckDueDate(targetAr.dueDate || formatLocalYmd(new Date()));
    setCollectDrawerBank('');
    setCollectNotes('');
  }, [targetAr]);

  if (!targetAr) return null;

  const hasInv = targetAr.hasInvoice !== false;
  const strictInvLock = hasInv && targetAr.invoiceIssueMode !== 'SELF_RETAINED';
  const targetComp = companies.find(c => c.id === targetAr.companyId);
  const eligibleBanks = getEligibleReceivingBanks(
    bankAccounts,
    targetAr.companyId,
    hasInv,
    targetAr.invoiceIssueMode
  );
  const remaining = targetAr.remainingAmount;
  const recNum = Math.max(0, Number(collectReceivedAmount || 0));
  const isShort = recNum > 0 && recNum < remaining - 0.01;
  const isOver = recNum > remaining + 0.01;
  const shortDiff = Math.max(0, remaining - recNum);
  const overDiff = Math.max(0, recNum - remaining);

  const handleConfirm = () => {
    const receivedAmt = Number(collectReceivedAmount || 0);
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
          arId: targetAr.id,
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
        operatorName || 'B出納'
      );
      onNotify(
        collectMethod === 'CHECK'
          ? `✅ 已收受業主支票 [${collectCheckNumber.trim()}] NT$ ${receivedAmt.toLocaleString()}！已納入票據雷達（黃燈待兌現）。`
          : overpayAmt > 0 && collectOverpayMode === 'TO_PROJECT_ADVANCE'
          ? `✅ 已收款入帳 NT$ ${receivedAmt.toLocaleString()}！溢收 NT$ ${overpayAmt.toLocaleString()} 已直接掛入該案場預收款／借貸總帳！`
          : overpayAmt > 0 && collectOverpayMode === 'TO_SUSPENSE'
          ? `✅ 已收款入帳 NT$ ${receivedAmt.toLocaleString()}！應收單已結清，溢收 NT$ ${overpayAmt.toLocaleString()} 已轉入暫收池！`
          : `✅ 應收單 [${targetAr.arNumber}] 已成功收款入帳 NT$ ${receivedAmt.toLocaleString()}！`,
        'success'
      );
      onClose();
      onCollected();
    } catch (e: any) {
      onNotify(`收款入帳失敗：${e.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-600" />
            <span>出納收款入帳確認 ({targetAr.arNumber})</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className={`p-3 rounded-xl border text-[11px] font-bold ${
            strictInvLock
              ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          {strictInvLock
            ? `🔒 本案已開立銷項發票 [${targetAr.invoiceNumber || '開發票'}]：資金嚴格僅能入【${targetComp?.shortName || targetComp?.name}】實體銀行戶或公司現金，已鎖定排除老闆私帳與他公司帳戶。`
            : targetAr.invoiceIssueMode === 'SELF_RETAINED'
            ? `🏷️ 本案採自主報稅自留發票 [${targetAr.invoiceNumber}]：未交付業主，仍可入原定【老闆私人戶】、現金或本公司專戶。`
            : `🔓 本案免開發票：出納可選擇入【老闆私人戶】、現金或該公司專戶（禁止跨入其他公司戶）。`}
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">付款業主：</span>
            <span className="font-bold text-slate-900">{targetAr.customerName}</span>
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
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer"
          >
            {collectMethod === 'CHECK' ? '確認收票登錄' : '確認收款入帳'}
          </button>
        </div>
      </div>
    </div>
  );
};
