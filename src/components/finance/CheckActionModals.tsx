// src/components/finance/CheckActionModals.tsx
// 🎫 支票存摺兌現、退票跳票回滾、作廢與重新關聯彈窗

import React from 'react';
import { CreditCard, X } from 'lucide-react';
import { AccountsPayableReconciliation, BankCheck } from '../../types/erp';

interface CheckStatusActionModalProps {
  selectedCheck: BankCheck | null;
  actionType: 'CLEAR' | 'BOUNCE' | 'VOID';
  actualClearDate: string;
  onChangeClearDate: (val: string) => void;
  bounceRollbackMode: 'REPAY' | 'REBILL';
  onChangeBounceMode: (mode: 'REPAY' | 'REBILL') => void;
  actionReason: string;
  onChangeReason: (val: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const CheckStatusActionModal: React.FC<CheckStatusActionModalProps> = ({
  selectedCheck,
  actionType,
  actualClearDate,
  onChangeClearDate,
  bounceRollbackMode,
  onChangeBounceMode,
  actionReason,
  onChangeReason,
  onClose,
  onConfirm,
}) => {
  if (!selectedCheck) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            <span>
              {actionType === 'CLEAR'
                ? '支票存摺兌現結清'
                : actionType === 'BOUNCE'
                ? selectedCheck.type === 'RECEIVABLE'
                  ? '應收支票退票 (回滾 AR 待收餘額)'
                  : '支票退票 (觸發 AP 復活)'
                : '支票作廢'}
            </span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">票號：</span>
            <span className="font-mono font-bold text-slate-900">{selectedCheck.checkNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{selectedCheck.type === 'RECEIVABLE' ? '開票業主：' : '受款對象：'}</span>
            <span className="font-bold text-slate-800">{selectedCheck.counterpartyName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">票面金額：</span>
            <span className="font-mono font-bold text-indigo-700">NT$ {selectedCheck.amount.toLocaleString()}</span>
          </div>
        </div>

        {actionType === 'CLEAR' ? (
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {selectedCheck.type === 'RECEIVABLE'
                ? '存摺兌現入帳日期 (T+0 實際入庫日)'
                : '存摺扣款入帳日期 (T+0 實際扣減日)'}
            </label>
            <input
              type="date"
              value={actualClearDate}
              onChange={(e) => onChangeClearDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              {selectedCheck.type === 'RECEIVABLE'
                ? '點擊確認後，將正式加計該收款銀行帳戶真實餘額，並將對應 AR 收款紀錄轉為正式入帳 (POSTED)。'
                : '點擊確認後，將正式扣除該開票銀行帳戶真實餘額，單據徹底結案。'}
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {actionType === 'BOUNCE' && selectedCheck.type === 'RECEIVABLE' && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-900 leading-relaxed">
                <b>📌 應收票據退票自動回滾說明：</b>
                <br />
                業主支票跳票／退票時，系統將作廢此張支票與待兌現收款紀錄，並自動還原對應應收請款單 (AR) 之未收餘額與狀態（含退票票號留痕），方便後續重新催收或換票。
              </div>
            )}

            {actionType === 'BOUNCE' && selectedCheck.type === 'PAYABLE' && (
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-800">
                  選擇退票後續帳務處理方式
                </label>
                <label className={`block p-2.5 rounded-lg border cursor-pointer transition-all ${
                  bounceRollbackMode === 'REPAY'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-950'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <div className="flex items-center gap-2 font-bold">
                    <input
                      type="radio"
                      name="bounceMode"
                      checked={bounceRollbackMode === 'REPAY'}
                      onChange={() => onChangeBounceMode('REPAY')}
                      className="text-indigo-600"
                    />
                    <span>1. 退回重新付款（保留原對帳單與發票）</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 pl-5">
                    僅沖銷此筆支票與付款單，對帳單退回「待出金放款 (APPROVED)」並記錄退票票號，方便直接換補票或改電匯重付。
                  </p>
                </label>

                <label className={`block p-2.5 rounded-lg border cursor-pointer transition-all ${
                  bounceRollbackMode === 'REBILL'
                    ? 'bg-rose-50 border-rose-500 text-rose-950'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <div className="flex items-center gap-2 font-bold">
                    <input
                      type="radio"
                      name="bounceMode"
                      checked={bounceRollbackMode === 'REBILL'}
                      onChange={() => onChangeBounceMode('REBILL')}
                      className="text-rose-600"
                    />
                    <span>2. 退回重新請款（整筆交易退回重來）</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 pl-5">
                    將本支票、付款單與原對帳單一併作廢沖銷，所屬進貨簽收單全部釋放回待對帳水池重新請款。
                  </p>
                </label>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-rose-700 mb-1">
                退票/作廢原因說明 (強制留痕)
              </label>
              <textarea
                rows={3}
                value={actionReason}
                onChange={(e) => onChangeReason(e.target.value)}
                placeholder="例如: 印鑑不符退票 / 廠商通知換票..."
                className="w-full bg-white border border-rose-300 rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-rose-500"
              />
              <span className="text-[10px] text-rose-600 mt-1 block font-bold">
                🛡️ 逆向防線：系統將自動保留完整作廢／退票紀錄與原付款單追蹤歷程！
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-1.5 rounded-lg font-bold text-white text-xs shadow-2xs ${
              actionType === 'CLEAR' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {actionType === 'CLEAR' ? '確認存摺兌現' : '確認退票回滾'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface CheckRelinkModalProps {
  targetCheck: BankCheck | null;
  reconciliations: AccountsPayableReconciliation[];
  relinkApId: string;
  onChangeApId: (id: string) => void;
  replacesCheckNo: string;
  onChangeReplacesCheckNo: (val: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const CheckRelinkModal: React.FC<CheckRelinkModalProps> = ({
  targetCheck,
  reconciliations,
  relinkApId,
  onChangeApId,
  replacesCheckNo,
  onChangeReplacesCheckNo,
  onClose,
  onConfirm,
}) => {
  if (!targetCheck) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            <span>支票重新關聯對帳單 / 換補票註記</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">現行支票票號：</span>
            <span className="font-mono font-bold text-slate-900">{targetCheck.checkNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">受款對象：</span>
            <span className="font-bold text-slate-800">{targetCheck.counterpartyName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">票面金額：</span>
            <span className="font-mono font-bold text-indigo-700">NT$ {targetCheck.amount.toLocaleString()}</span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            關聯至應付對帳單 <span className="text-rose-500">*</span>
          </label>
          <select
            value={relinkApId}
            onChange={(e) => onChangeApId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
          >
            <option value="">-- 請選擇應付對帳單 --</option>
            {reconciliations
              .filter(r => r.status !== 'VOIDED')
              .map(r => (
                <option key={r.id} value={r.id}>
                  {r.reconciliationNumber} · {r.vendorName} (NT$ {r.netPayableAmount.toLocaleString()}) [{r.status}]
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            原退票／作廢替換票號 (選填)
          </label>
          <input
            type="text"
            value={replacesCheckNo}
            onChange={(e) => onChangeReplacesCheckNo(e.target.value)}
            placeholder="例: CQ-001001"
            className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800 outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-2xs"
          >
            確認儲存關聯
          </button>
        </div>
      </div>
    </div>
  );
};
