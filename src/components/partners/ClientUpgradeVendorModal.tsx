import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  ArrowRightLeft,
  Building2,
  HardHat,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Phone,
  MapPin,
  Save,
  Info
} from 'lucide-react';
import { BusinessPartner, SubcontractorCategoryGroup } from '../../types/erp';
import {
  saveBusinessPartner,
  getSubcontractorCategoryTree
} from '../../db/sqlite';
import { TaiwanBankPickerWidget } from '../widgets/TaiwanBankPickerWidget';
import { TaiwanIdTaxValidatorWidget } from '../widgets/TaiwanIdTaxValidatorWidget';
import { FloatingSubcontractorSelect } from '../widgets/FloatingSubcontractorSelect';

interface ClientUpgradeVendorModalProps {
  isOpen: boolean;
  client: BusinessPartner | null;
  onClose: () => void;
  onSuccess: (updated: BusinessPartner) => void;
  currentUser?: any;
}

export const ClientUpgradeVendorModal: React.FC<ClientUpgradeVendorModalProps> = ({
  isOpen,
  client,
  onClose,
  onSuccess,
  currentUser
}) => {
  const [categoryTree, setCategoryTree] = useState<SubcontractorCategoryGroup[]>(() => getSubcontractorCategoryTree());

  // 補填欄位狀態
  const [workScopeMain, setWorkScopeMain] = useState('');
  const [workScopeSub, setWorkScopeSub] = useState('');
  const [taxId, setTaxId] = useState('');
  const [bankCode, setBankCode] = useState('004');
  const [bankName, setBankName] = useState('臺灣銀行');
  const [branchName, setBranchName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [hasInvoice, setHasInvoice] = useState(true);
  const [bankFeePayer, setBankFeePayer] = useState<'COMPANY' | 'PARTNER'>('COMPANY');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && client) {
      setCategoryTree(getSubcontractorCategoryTree());
      setTaxId(client.taxId || '');
      setWorkScopeMain(client.categoryMain || client.serviceCategoryMain || '鋼材');
      setWorkScopeSub(client.categorySub || client.serviceCategorySub || client.name);
      setBankCode(client.bankCode || '004');
      setBankName(client.bankName || '臺灣銀行');
      setBankAccount(client.bankAccount || '');
      setBankAccountName(client.bankAccountName || client.name);
      setPaymentTermsDays(client.paymentTermsDays || 30);
      setHasInvoice(client.hasInvoice !== false);
      setBankFeePayer(client.bankFeePayer || 'COMPANY');
      setErrorMessage(null);
    }
  }, [isOpen, client]);

  if (!isOpen || !client) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workScopeMain.trim()) {
      setErrorMessage('請指定該廠商之「第一階工料大類」（如鋼材、拆圖、混凝土等）');
      return;
    }
    if (!bankAccount.trim()) {
      setErrorMessage('請補填「匯款銀行帳號」，以供工程計價與財務出帳放行！');
      return;
    }

    try {
      const operator = currentUser?.fullName || '系統管理員';
      const updated: BusinessPartner = {
        ...client,
        isVendor: true,
        type: 'BOTH', // 同時具備業主與廠商雙重身分
        serviceCategoryMain: workScopeMain.trim(),
        serviceCategorySub: workScopeSub.trim(),
        categoryMain: workScopeMain.trim(),
        categorySub: workScopeSub.trim(),
        taxId: taxId.trim(),
        bankCode: bankCode.trim(),
        bankName: bankName.trim(),
        bankAccount: bankAccount.trim(),
        bankAccountName: (bankAccountName.trim() || client.name),
        paymentTermsDays,
        hasInvoice,
        bankFeePayer,
        bankAccounts: [
          {
            id: `BACC-${Date.now()}-1`,
            bpId: client.id,
            bankCode: bankCode.trim(),
            bankName: bankName.trim(),
            branchName: branchName.trim(),
            accountNumber: bankAccount.trim(),
            accountName: (bankAccountName.trim() || client.name),
            isPrimary: true
          }
        ]
      };

      saveBusinessPartner(updated, operator);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || '儲存失敗');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  {client.bpCode}
                </span>
                <span className="text-xs font-bold text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-full">
                  業主 ➔ 兼具合作廠商補填流程
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">
                {client.name}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 智慧引導說明 Banner */}
        <div className="bg-amber-50/70 border-b border-amber-200/80 px-6 py-3 flex items-start gap-2.5 text-xs text-amber-900">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            系統已自動載入既有的業主資料（全銜、聯絡電話、地址）。由於合作廠商需參與<strong>採購發包、材料進料簽收與工程款計價放行</strong>，請於下方補填廠商必備的「專業工料分類」與「匯款金融帳戶」。
          </div>
        </div>

        {/* 表單內容 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 區塊 1: 既有業主資訊 (已確認無誤) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="font-bold text-slate-700 flex items-center gap-1.5 text-xs border-b border-slate-200 pb-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>已同步載入之業主基本資訊 (不需重複 Key 鍵入)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-600 pt-1">
              <div>
                <span className="text-slate-400">業主全銜：</span>
                <span className="font-bold text-slate-800 ml-1">{client.name}</span>
              </div>
              <div>
                <span className="text-slate-400">聯絡電話：</span>
                <span className="font-mono text-slate-800 ml-1">{client.phone || '(未填)'}</span>
              </div>
              <div className="sm:col-span-1">
                <span className="text-slate-400">目前身分：</span>
                <span className="font-bold text-indigo-700 ml-1">案場業主客戶</span>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <span className="text-slate-400">通訊地址：</span>
                <span className="text-slate-700 ml-1">{client.address || '(未指定)'}</span>
              </div>
            </div>
          </div>

          {/* 區塊 2: 補填廠商專業工料大類與細項 */}
          <div className="space-y-3">
            <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs border-b border-slate-200 pb-1.5">
              <HardHat className="w-4 h-4 text-amber-600" />
              <span>一、補填廠商工料二階專業分類 (與案場發包連動) <span className="text-rose-500">*</span></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  第一階工料大類 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={workScopeMain}
                  onChange={(e) => setWorkScopeMain(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-bold focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none"
                >
                  <option value="">-- 請選擇工料大類 --</option>
                  {categoryTree.map(cat => (
                    <option key={cat.id} value={cat.category}>{cat.category}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">如：鋼材、混凝土、拆圖、屋頂浪板、機電等</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  第二階專業工項或公司簡稱
                </label>
                <input
                  type="text"
                  value={workScopeSub}
                  onChange={(e) => setWorkScopeSub(e.target.value)}
                  placeholder="例如: 鋼構加工、結構大樣圖拆圖"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">選填，供案場叫料與發包時快速辨識</p>
              </div>
            </div>
          </div>

          {/* 區塊 3: 統一編號或身分證補填 (若原先業主未填) */}
          <div className="space-y-3">
            <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs border-b border-slate-200 pb-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>二、統一編號 / 身分證字號核實</span>
            </div>
            <TaiwanIdTaxValidatorWidget
              label="統一編號 (8 碼) 或 負責人身分證 (10 碼)"
              type="AUTO"
              value={taxId}
              onChange={(val) => setTaxId(val)}
              placeholder="請輸入公司 8 碼統編或個人身分證字號..."
              showExplanation={true}
            />
          </div>

          {/* 區塊 4: 廠商專屬金融機構匯款帳號 (必填) */}
          <div className="space-y-3">
            <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs border-b border-slate-200 pb-1.5">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>三、工程請款與匯款金融帳號 <span className="text-rose-500">*</span></span>
            </div>

            <TaiwanBankPickerWidget
              label="請款放行匯款機構 (3 碼代號)"
              bankCode={bankCode}
              bankName={bankName}
              onChange={(bank) => {
                setBankCode(bank.bankCode);
                setBankName(bank.bankName);
              }}
              required={true}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  分行名稱
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="例：營業部、信義分行"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  金融帳號 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="10~14 碼銀行帳號"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs font-mono font-bold focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  帳戶戶名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="存摺抬頭戶名"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  約定付款條件 (票期天數)
                </label>
                <select
                  value={paymentTermsDays}
                  onChange={(e) => setPaymentTermsDays(Number(e.target.value) || 30)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  <option value={0}>當月結清 (現金 / 即期)</option>
                  <option value={15}>月結 15 天</option>
                  <option value={30}>月結 30 天 (標準)</option>
                  <option value={45}>月結 45 天</option>
                  <option value={60}>月結 60 天 (票期)</option>
                  <option value={90}>月結 90 天</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  匯費負擔原則
                </label>
                <div className="grid grid-cols-2 gap-2 mt-0.5">
                  <label className="flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] cursor-pointer">
                    <input
                      type="radio"
                      name="bankFeePayer"
                      checked={bankFeePayer === 'COMPANY'}
                      onChange={() => setBankFeePayer('COMPANY')}
                      className="text-indigo-600"
                    />
                    <span>本公司吸收 (全額匯)</span>
                  </label>
                  <label className="flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] cursor-pointer">
                    <input
                      type="radio"
                      name="bankFeePayer"
                      checked={bankFeePayer === 'PARTNER'}
                      onChange={() => setBankFeePayer('PARTNER')}
                      className="text-indigo-600"
                    />
                    <span>廠商內扣 (扣30元)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 底部按鈕 */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              確認送出後，該名冊身分將更新為「雙重身分 (BOTH)」
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>確認補齊並升級為合作廠商</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
