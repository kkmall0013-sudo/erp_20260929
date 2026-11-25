import React, { useState, useEffect } from 'react';
import { CreditCard, X, Save } from 'lucide-react';
import { Company, CompanyBankAccount } from '../../types/erp';
import { saveCompanyBankAccount } from '../../db/sqlite';
import { TaiwanBankPickerWidget } from '../widgets/TaiwanBankPickerWidget';

export interface CompanyBankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  initialAccount: Partial<CompanyBankAccount>;
  lockCompanySelect?: boolean;
  operatorName: string;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

export const CompanyBankAccountModal: React.FC<CompanyBankAccountModalProps> = ({
  isOpen,
  onClose,
  companies,
  initialAccount,
  lockCompanySelect = false,
  operatorName,
  onSaved,
  onError
}) => {
  const [formData, setFormData] = useState<Partial<CompanyBankAccount>>(initialAccount);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...initialAccount,
        supportsCheck: initialAccount.supportsCheck !== false,
        supportsTransfer: initialAccount.supportsTransfer !== false,
        paymentScheduleDays: initialAccount.paymentScheduleDays || '',
        status: initialAccount.status || 'ACTIVE',
        checkPrefix: initialAccount.checkPrefix || 'CQ',
        nextCheckNumber: initialAccount.nextCheckNumber || 1001,
        checkDigits: initialAccount.checkDigits || 6,
        currency: initialAccount.currency || 'TWD'
      });
    }
  }, [isOpen, initialAccount]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!formData.bankName?.trim() || !formData.accountNumber?.trim()) {
      onError('請完整填寫銀行金融機構名稱與銀行帳號');
      return;
    }
    const targetCompany = companies.find(c => c.id === formData.companyId);
    setIsSaving(true);
    try {
      saveCompanyBankAccount(
        {
          id: formData.id,
          companyId: formData.companyId || companies[0]?.id || 'COMP-01',
          bankCode: formData.bankCode?.trim() || '004',
          bankName: formData.bankName.trim(),
          branchName: formData.branchName?.trim() || '',
          accountNumber: formData.accountNumber.trim(),
          accountName: formData.accountName?.trim() || targetCompany?.name || formData.bankName.trim(),
          isVirtualAccount: Boolean(formData.isVirtualAccount),
          status: formData.status || 'ACTIVE',
          checkPrefix: (formData.checkPrefix || 'CQ').trim().toUpperCase(),
          nextCheckNumber: Math.max(1, Number(formData.nextCheckNumber) || 1001),
          checkDigits: Number(formData.checkDigits) || 6,
          currency: formData.currency || 'TWD',
          supportsCheck: formData.supportsCheck !== false,
          supportsTransfer: formData.supportsTransfer !== false,
          paymentScheduleDays: formData.paymentScheduleDays?.trim() || undefined
        },
        operatorName
      );
      onSaved(formData.id ? '✅ 銀行帳戶與支票簿已成功更新！' : '✅ 已成功建立公司出款銀行專戶！');
      onClose();
    } catch (err: any) {
      onError(`⛔ 儲存失敗：${err?.message || String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-800">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {formData.id ? '編輯公司出款銀行專戶與支票簿' : '新增公司出款銀行專戶 (Bank Account Setup)'}
              </h3>
              <p className="text-[11px] text-slate-500">
                維護營造集團各公司之實體或私帳出金專戶，設定專屬支票簿連續序號。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* 所屬公司與帳戶性質 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                所屬公司法人 (Owner Company) <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.companyId || ''}
                disabled={lockCompanySelect}
                onChange={e => {
                  const cId = e.target.value;
                  const c = companies.find(item => item.id === cId);
                  setFormData(prev => ({
                    ...prev,
                    companyId: cId,
                    accountName: prev.accountName || c?.name || ''
                  }));
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none disabled:opacity-75"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.taxId ? `(統編: ${c.taxId})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                帳戶專戶性質 (Account Type)
              </label>
              <select
                value={formData.isVirtualAccount ? 'VIRTUAL' : 'STANDARD'}
                onChange={e => setFormData(prev => ({ ...prev, isVirtualAccount: e.target.value === 'VIRTUAL' }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
              >
                <option value="STANDARD">公司實體營運帳戶 (甲存支票戶 / 活儲專戶)</option>
                <option value="VIRTUAL">老闆私人調度專戶 (代墊 / 私人代付週轉)</option>
              </select>
            </div>
          </div>

          {/* 🏦 全國 414 家金融機構代碼與名稱共用小程式 + 分行輸入 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
            <div className="md:col-span-2">
              <TaiwanBankPickerWidget
                bankCode={formData.bankCode || ''}
                bankName={formData.bankName || ''}
                onChange={b =>
                  setFormData(prev => ({
                    ...prev,
                    bankCode: b.bankCode,
                    bankName: b.bankName
                  }))
                }
                label="銀行代碼與金融機構名稱"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                所屬分行名稱 (Branch)
              </label>
              <input
                type="text"
                value={formData.branchName || ''}
                onChange={e => setFormData(prev => ({ ...prev, branchName: e.target.value }))}
                placeholder="例: 營業部 / 板橋分行 / 敦南分行"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 帳號與戶名 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                銀行帳號 (Account Number) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.accountNumber || ''}
                onChange={e => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                placeholder="例: 004-001-12345678"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                帳戶開戶名稱 / 戶名 (Account Holder)
              </label>
              <input
                type="text"
                value={formData.accountName || ''}
                onChange={e => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
                placeholder="例: 寶佳營造股份有限公司"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none"
              />
            </div>
          </div>

          {/* 支票簿設定區 (字軌、起號、碼長) */}
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
              <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>本帳戶支票簿設定 (連續票號自動跳號)</span>
              </span>
              <span className="text-[11px] text-emerald-800 font-mono font-bold">
                下張開立票號: {formData.checkPrefix ? `${formData.checkPrefix}-` : ''}
                {String(formData.nextCheckNumber || 1001).padStart(formData.checkDigits || 6, '0')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  支票字軌前綴 (Prefix)
                </label>
                <input
                  type="text"
                  value={formData.checkPrefix || ''}
                  onChange={e => setFormData(prev => ({ ...prev, checkPrefix: e.target.value.toUpperCase() }))}
                  placeholder="例: TW / CT / ES"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  號碼位數 (Check Digits)
                </label>
                <select
                  value={formData.checkDigits || 6}
                  onChange={e => setFormData(prev => ({ ...prev, checkDigits: Number(e.target.value) }))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-800 outline-none"
                >
                  <option value={4}>4 位數</option>
                  <option value={5}>5 位數</option>
                  <option value={6}>6 位數 (標準)</option>
                  <option value={7}>7 位數</option>
                  <option value={8}>8 位數</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  起始連貫序號 (Next Number)
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.nextCheckNumber || 1001}
                  onChange={e => setFormData(prev => ({ ...prev, nextCheckNumber: Math.max(1, Number(e.target.value) || 1) }))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 支援付款方式與專屬排程日設定 */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="font-bold text-slate-800 text-xs">
              開放出款付款方式與帳戶專屬每月付款日
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <span className="block text-[11px] font-bold text-slate-600">
                  此專戶允許開立之付款工具 (未勾選者不顯示於付款選單)
                </span>
                <div className="flex flex-wrap gap-3 pt-1">
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.supportsCheck !== false}
                      onChange={e => setFormData(prev => ({ ...prev, supportsCheck: e.target.checked }))}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>開立支票 (CHECK)</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.supportsTransfer !== false}
                      onChange={e => setFormData(prev => ({ ...prev, supportsTransfer: e.target.checked }))}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>銀行電匯 / 轉帳 (TT)</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  本帳戶專屬每月固定出款日 (選填，留空則依全域預設)
                </label>
                <input
                  type="text"
                  value={formData.paymentScheduleDays || ''}
                  onChange={e => setFormData(prev => ({ ...prev, paymentScheduleDays: e.target.value }))}
                  placeholder="例: 7,17,27 或 10,25"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-800 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 帳戶狀態與幣別 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                帳戶狀態 (Status)
              </label>
              <select
                value={formData.status || 'ACTIVE'}
                onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as 'ACTIVE' | 'DISABLED' }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
              >
                <option value="ACTIVE">正常啟用 (Active · 可出納放款與開票)</option>
                <option value="DISABLED">停用列管 (Disabled · 暫不允許新單據選取)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                帳戶計價幣別 (Currency)
              </label>
              <input
                type="text"
                value={formData.currency || 'TWD'}
                onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-800 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer text-xs"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors cursor-pointer text-xs shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? '儲存中...' : formData.id ? '更新帳戶主檔' : '確認建立帳戶'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
