// src/components/finance/ap/ApReturnVoidModals.tsx
// ↩️ AP 對帳單作廢回滾彈窗 & 出納退回會計重算彈窗

import React, { useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { AccountsPayableReconciliation } from '../../../types/erp';
import {
  returnApReconciliationToAccounting,
  voidApReconciliation,
} from '../../../db/sqlite';

interface ApVoidReconciliationModalProps {
  targetRecId: string | null;
  operatorName: string;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onSuccess: () => void;
}

export const ApVoidReconciliationModal: React.FC<ApVoidReconciliationModalProps> = ({
  targetRecId,
  operatorName,
  onClose,
  onNotify,
  onSuccess,
}) => {
  const [voidReasonText, setVoidReasonText] = useState('');

  useEffect(() => {
    if (targetRecId) {
      setVoidReasonText('');
    }
  }, [targetRecId]);

  if (!targetRecId) return null;

  const handleConfirm = () => {
    if (!voidReasonText.trim()) {
      onNotify('請填寫作廢原因以保留稽核紀錄', 'warn');
      return;
    }
    try {
      voidApReconciliation(targetRecId, voidReasonText, operatorName || '會計專員');
      onNotify('🛡️ 對帳單已成功作廢！所屬進貨簽收單已安全回滾釋放回待對帳大水池。', 'success');
      onClose();
      onSuccess();
    } catch (e: any) {
      onNotify(`作廢失敗：${e.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>作廢應付對帳單 (水池回滾防線)</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
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
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-2xs"
          >
            確認作廢並釋放單據
          </button>
        </div>
      </div>
    </div>
  );
};

interface ApReturnToAccountingModalProps {
  targetRec: AccountsPayableReconciliation | null;
  operatorName: string;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onReturned: (returnedRecId: string) => void;
}

export const ApReturnToAccountingModal: React.FC<ApReturnToAccountingModalProps> = ({
  targetRec,
  operatorName,
  onClose,
  onNotify,
  onReturned,
}) => {
  const [returnReasonText, setReturnReasonText] = useState('');

  useEffect(() => {
    if (targetRec) {
      setReturnReasonText('');
    }
  }, [targetRec]);

  if (!targetRec) return null;

  const handleConfirm = () => {
    if (!returnReasonText.trim()) {
      onNotify('請填寫退回會計重算的具體原因，方便會計核對修正', 'warn');
      return;
    }
    try {
      returnApReconciliationToAccounting(
        targetRec.id,
        returnReasonText,
        operatorName || '出納專員'
      );
      onNotify(`↩️ 已將對帳單【${targetRec.reconciliationNumber}】退回會計大水池重算！`, 'warn');
      const recId = targetRec.id;
      onClose();
      onReturned(recId);
    } catch (e: any) {
      onNotify(`退回失敗：${e.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-rose-600" />
            <span>退回對帳單給會計重新核算</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">對帳單號：</span>
            <span className="font-mono font-bold text-slate-900">{targetRec.reconciliationNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">受款廠商：</span>
            <span className="font-bold text-slate-800">{targetRec.vendorName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">原核定稅額 / 應付總額：</span>
            <span className="font-mono font-bold text-indigo-700">
              稅 NT$ {targetRec.taxAmount.toLocaleString()} ／ 總額 NT$ {targetRec.netPayableAmount.toLocaleString()}
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
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer"
          >
            確認退回會計重算
          </button>
        </div>
      </div>
    </div>
  );
};
