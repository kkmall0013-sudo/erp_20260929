import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Save, Trash2 } from 'lucide-react';
import { Company, CompanyBankAccount } from '../../types/erp';
import {
  updateBankAccountCheckSequence,
  deleteCompanyBankAccount
} from '../../db/sqlite';
import { CompanyBankAccountModal } from './CompanyBankAccountModal';
import { ConfirmDialogModal } from '../widgets/ConfirmDialogModal';

export interface CompanyBankCheckbooksTableProps {
  companies: Company[];
  bankAccounts: CompanyBankAccount[];
  selectedCompanyId: string;
  canWriteModule: boolean;
  operatorName: string;
  onReloadData: () => void;
  onDataChanged: () => void;
  triggerToast: (msg: string) => void;
}

export const CompanyBankCheckbooksTable: React.FC<CompanyBankCheckbooksTableProps> = ({
  companies,
  bankAccounts,
  selectedCompanyId,
  canWriteModule,
  operatorName,
  onReloadData,
  onDataChanged,
  triggerToast
}) => {
  const [editingChecks, setEditingChecks] = useState<
    Record<string, { checkPrefix: string; nextCheckNumber: number; checkDigits: number }>
  >({});
  const [savingBankId, setSavingBankId] = useState<string | null>(null);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankInitialData, setBankInitialData] = useState<Partial<CompanyBankAccount>>({});
  const [bankToDelete, setBankToDelete] = useState<CompanyBankAccount | null>(null);

  useEffect(() => {
    const bMap: Record<string, { checkPrefix: string; nextCheckNumber: number; checkDigits: number }> = {};
    bankAccounts.forEach(b => {
      bMap[b.id] = {
        checkPrefix: b.checkPrefix || 'CQ',
        nextCheckNumber: b.nextCheckNumber || 1001,
        checkDigits: b.checkDigits || 6
      };
    });
    setEditingChecks(bMap);
  }, [bankAccounts]);

  const handleSaveBankCheckSequence = (bankId: string) => {
    if (!canWriteModule) {
      triggerToast('⛔ 權限攔截：您目前的身分無【銀行支票簿序號】維護權限！');
      return;
    }
    const edit = editingChecks[bankId];
    if (!edit) return;
    try {
      setSavingBankId(bankId);
      updateBankAccountCheckSequence(
        bankId,
        edit.checkPrefix,
        edit.nextCheckNumber,
        edit.checkDigits,
        operatorName
      );
      triggerToast('✅ 銀行支票簿起始字軌與連貫序號已成功儲存！');
      onReloadData();
      onDataChanged();
    } catch (e: any) {
      triggerToast(`❌ 儲存失敗: ${e.message}`);
    } finally {
      setSavingBankId(null);
    }
  };

  const handleOpenAddBank = () => {
    const compId = selectedCompanyId || companies[0]?.id || 'COMP-01';
    const comp = companies.find(c => c.id === compId);
    setBankInitialData({
      companyId: compId,
      bankCode: '004',
      bankName: '臺灣銀行',
      branchName: '營業部',
      accountNumber: '',
      accountName: comp?.name || '',
      isVirtualAccount: false,
      status: 'ACTIVE',
      checkPrefix: 'CQ',
      nextCheckNumber: 1001,
      checkDigits: 6,
      currency: 'TWD',
      supportsCheck: true,
      supportsTransfer: true,
      paymentScheduleDays: ''
    });
    setIsBankModalOpen(true);
  };

  const handleOpenEditBank = (b: CompanyBankAccount) => {
    setBankInitialData({
      ...b,
      supportsCheck: b.supportsCheck !== false,
      supportsTransfer: b.supportsTransfer !== false,
      paymentScheduleDays: b.paymentScheduleDays || ''
    });
    setIsBankModalOpen(true);
  };

  const handleConfirmDeleteBank = () => {
    if (!bankToDelete) return;
    try {
      deleteCompanyBankAccount(bankToDelete.id, operatorName);
      triggerToast(`✅ 銀行帳戶【${bankToDelete.bankName} ${bankToDelete.accountNumber}】已成功刪除！`);
      setBankToDelete(null);
      onReloadData();
      onDataChanged();
    } catch (e: any) {
      triggerToast(`❌ 刪除攔截: ${e.message}`);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
            <CreditCard className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <span>公司出款銀行專戶與支票簿起始字軌序號管理 (Company Bank Accounts & Checkbooks)</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                防跳號・自動遞增
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              各公司法人出款銀行專戶主檔維護。可在此新增帳號、修改銀行戶名、設定支票簿專屬字軌前綴與起始號，出納放款自動連貫給號。
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAddBank}
          disabled={!canWriteModule}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>＋ 新增公司出款銀行專戶</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
              <th className="p-3.5">所屬公司法人</th>
              <th className="p-3.5">銀行機構與分行</th>
              <th className="p-3.5">銀行帳號與開戶名稱</th>
              <th className="p-3.5">帳戶性質 / 狀態</th>
              <th className="p-3.5">支票字軌前綴</th>
              <th className="p-3.5">碼長</th>
              <th className="p-3.5">下一筆票號</th>
              <th className="p-3.5">開票預覽</th>
              <th className="p-3.5 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {bankAccounts.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-400">
                  尚未建立銀行帳戶主檔，請點擊右上角「＋ 新增公司出款銀行專戶」建立
                </td>
              </tr>
            ) : (
              bankAccounts.map(b => {
                const edit = editingChecks[b.id] || {
                  checkPrefix: b.checkPrefix || 'CQ',
                  nextCheckNumber: b.nextCheckNumber || 1001,
                  checkDigits: b.checkDigits || 6
                };
                const formattedNum = String(edit.nextCheckNumber).padStart(edit.checkDigits, '0');
                const previewCheckNo = `${edit.checkPrefix ? `${edit.checkPrefix}-` : ''}${formattedNum}`;
                const isSaving = savingBankId === b.id;

                const ownerCompany = companies.find(c => c.id === b.companyId);
                const companyName = ownerCompany?.name || '全集團共用帳戶';
                const taxId = ownerCompany?.taxId || '-';

                return (
                  <tr key={b.id} className="hover:bg-slate-50/90 transition-colors">
                    <td className="p-3.5 align-middle">
                      <div className="font-bold text-slate-900">{companyName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">統編 {taxId}</div>
                    </td>
                    <td className="p-3.5 align-middle">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{b.bankName}</span>
                        {b.bankCode && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {b.bankCode}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">{b.branchName || '總行 / 營業部'}</div>
                    </td>
                    <td className="p-3.5 align-middle">
                      <div className="font-mono text-slate-900 font-bold">{b.accountNumber}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">戶名: {b.accountName}</div>
                    </td>
                    <td className="p-3.5 align-middle">
                      <div className="flex flex-col gap-1 items-start">
                        {b.isVirtualAccount ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            老闆私人專戶
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                            公司實體帳戶
                          </span>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {b.supportsCheck !== false && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              支票
                            </span>
                          )}
                          {b.supportsTransfer !== false && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200">
                              電匯
                            </span>
                          )}
                          {b.supportsCheck === false && b.supportsTransfer === false && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              無支援線上出款
                            </span>
                          )}
                        </div>
                        {b.paymentScheduleDays && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            排程: {b.paymentScheduleDays} 日
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            b.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {b.status === 'ACTIVE' ? '● 正常啟用' : '○ 停用列管'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 align-middle">
                      <input
                        type="text"
                        value={edit.checkPrefix}
                        onChange={e => {
                          const val = e.target.value.toUpperCase();
                          setEditingChecks(prev => ({
                            ...prev,
                            [b.id]: { ...(prev[b.id] || edit), checkPrefix: val }
                          }));
                        }}
                        placeholder="例 TW / CT"
                        className="w-20 px-2 py-1.5 font-mono font-bold text-xs rounded border border-slate-300 focus:ring-1 focus:ring-indigo-500 bg-white"
                        disabled={!canWriteModule}
                      />
                    </td>
                    <td className="p-3.5 align-middle">
                      <select
                        value={edit.checkDigits}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setEditingChecks(prev => ({
                            ...prev,
                            [b.id]: { ...(prev[b.id] || edit), checkDigits: val }
                          }));
                        }}
                        className="px-2 py-1.5 font-mono text-xs rounded border border-slate-300 bg-white cursor-pointer"
                        disabled={!canWriteModule}
                      >
                        <option value={4}>4 位數</option>
                        <option value={5}>5 位數</option>
                        <option value={6}>6 位數</option>
                        <option value={7}>7 位數</option>
                        <option value={8}>8 位數</option>
                      </select>
                    </td>
                    <td className="p-3.5 align-middle">
                      <input
                        type="number"
                        min={1}
                        value={edit.nextCheckNumber}
                        onChange={e => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          setEditingChecks(prev => ({
                            ...prev,
                            [b.id]: { ...(prev[b.id] || edit), nextCheckNumber: val }
                          }));
                        }}
                        className="w-24 px-2 py-1.5 font-mono font-bold text-xs rounded border border-slate-300 focus:ring-1 focus:ring-indigo-500 bg-white"
                        disabled={!canWriteModule}
                      />
                    </td>
                    <td className="p-3.5 align-middle font-mono">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{previewCheckNo}</span>
                      </span>
                    </td>
                    <td className="p-3.5 align-middle text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveBankCheckSequence(b.id)}
                          disabled={!canWriteModule || isSaving}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer border border-emerald-700 shadow-2xs inline-flex items-center gap-1 disabled:opacity-50"
                          title="儲存此行支票序號"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isSaving ? '...' : '存序號'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditBank(b)}
                          disabled={!canWriteModule}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors cursor-pointer border border-indigo-200 inline-flex items-center gap-1 disabled:opacity-50"
                          title="編輯完整帳戶資料與銀行名稱"
                        >
                          <span>修改</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBankToDelete(b)}
                          disabled={!canWriteModule}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer border border-rose-200 disabled:opacity-40"
                          title="刪除此銀行帳戶"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 共用公司銀行專戶彈窗 */}
      <CompanyBankAccountModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        companies={companies}
        initialAccount={bankInitialData}
        operatorName={operatorName}
        onSaved={(msg) => {
          triggerToast(msg);
          onReloadData();
          onDataChanged();
        }}
        onError={(msg) => triggerToast(msg)}
      />

      {/* 安全刪除確認彈窗 */}
      <ConfirmDialogModal
        isOpen={Boolean(bankToDelete)}
        title="確認刪除出款銀行專戶？"
        variant="danger"
        confirmText="確認刪除"
        cancelText="取消"
        message={
          bankToDelete && (
            <>
              您即將刪除銀行專戶【
              <b className="text-slate-900">
                {bankToDelete.bankName} {bankToDelete.branchName || ''}
              </b>{' '}
              帳號：<span className="font-mono font-bold text-indigo-700">{bankToDelete.accountNumber}</span>
              】。
            </>
          )
        }
        extraNotice="⚠️ 安全稽核檢核：若該帳戶已存在任何開立之放款付款單或支票記錄，系統將自動攔截禁止物理刪除，以維護四柱財務平衡歷史紀錄。"
        onConfirm={handleConfirmDeleteBank}
        onCancel={() => setBankToDelete(null)}
      />
    </div>
  );
};
