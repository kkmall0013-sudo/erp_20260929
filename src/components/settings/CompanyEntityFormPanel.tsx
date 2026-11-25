import React from 'react';
import {
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  FileText,
  ShieldCheck,
  Layers,
  Sparkles,
  UserCheck,
  Crown,
  CreditCard
} from 'lucide-react';
import { Company, PhoneItem, KeyPerson, CompanyBankAccount } from '../../types/erp';
import { ValidationResult } from '../../utils/taiwanValidation';
import { TaiwanAddressPicker } from '../widgets/TaiwanAddressPicker';

export interface CompanyEntityFormPanelProps {
  companies: Company[];
  formData: Partial<Company>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Company>>>;
  phones: PhoneItem[];
  keyPersonnel: KeyPerson[];
  taxIdFeedback: ValidationResult;
  nationalIdFeedback: ValidationResult;
  companyBankAccounts: CompanyBankAccount[];
  canWriteCompany: boolean;
  onTaxIdChange: (val: string) => void;
  onNationalIdChange: (val: string) => void;
  onAddPhone: (type?: PhoneItem['type']) => void;
  onUpdatePhone: (id: string, field: 'type' | 'number', value: string) => void;
  onRemovePhone: (id: string) => void;
  onAddKeyPerson: () => void;
  onUpdateKeyPerson: (id: string, field: keyof KeyPerson, value: string) => void;
  onRemoveKeyPerson: (id: string) => void;
  onSave: () => void;
  onOpenDeleteModal: () => void;
  onOpenAddBank: () => void;
  onOpenEditBank: (bank: CompanyBankAccount) => void;
  onRequestDeleteBank: (bank: CompanyBankAccount) => void;
}

export const CompanyEntityFormPanel: React.FC<CompanyEntityFormPanelProps> = ({
  companies,
  formData,
  setFormData,
  phones,
  keyPersonnel,
  taxIdFeedback,
  nationalIdFeedback,
  companyBankAccounts,
  canWriteCompany,
  onTaxIdChange,
  onNationalIdChange,
  onAddPhone,
  onUpdatePhone,
  onRemovePhone,
  onAddKeyPerson,
  onUpdateKeyPerson,
  onRemoveKeyPerson,
  onSave,
  onOpenDeleteModal,
  onOpenAddBank,
  onOpenEditBank,
  onRequestDeleteBank
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* 表單頂部工具列 */}
      <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100/70 px-2.5 py-1 rounded border border-indigo-200">
            {formData.companyCode || 'COMP'}
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex flex-wrap items-center gap-2">
              <span>{formData.name || '未命名實體'}</span>
              <span className="text-[11px] font-normal text-slate-400 font-mono">
                [版本: v{formData.version || 1}]
              </span>
              {formData.shortName && (
                <span className="text-xs font-semibold text-slate-600 bg-slate-200/60 px-2 py-0.5 rounded">
                  簡稱: {formData.shortName}
                </span>
              )}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  canWriteCompany
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
              >
                {canWriteCompany ? '✅ 目前身分具備編輯權限 (Write)' : '🔒 唯讀檢視模式 (無寫入權限)'}
              </span>
            </h2>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {formData.entityType === 'PERSONAL'
                ? '個人實體調度帳戶，已自動收折免填公司工商登記等欄位，並驗證台灣身分證'
                : formData.entityType === 'GROUP'
                ? '集團最高控股彙總層，支援跨子公司合併報表與資金調撥'
                : '正式對外營業公司法人，具備 8 碼統編防呆、重要人物組織與單據前綴'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenDeleteModal}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors flex items-center gap-1 cursor-pointer ${
              canWriteCompany
                ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-slate-200'
                : 'text-slate-400 bg-slate-100 border-slate-200'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>刪除實體</span>
          </button>
          <button
            type="button"
            onClick={onSave}
            className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer ${
              canWriteCompany
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-slate-300 text-slate-600 hover:bg-slate-400'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{canWriteCompany ? '儲存基本資料' : '🔒 儲存基本資料 (唯讀攔截)'}</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 text-xs">
        {/* 區塊 A：主體屬性與母子集團階層 */}
        <div className="space-y-3">
          <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5 pb-2 border-b border-slate-100">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>主體屬性與母子集團階層架構</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                主體類型 (entityType) <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.entityType || 'CORPORATION'}
                onChange={(e) => setFormData(prev => ({ ...prev, entityType: e.target.value as Company['entityType'] }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="CORPORATION">公司法人 (需驗證 8 碼統編、重要人物架構、登記地址)</option>
                <option value="PERSONAL">個人實體 / 老闆私帳 (驗證身分證，內部資金調度專用)</option>
                <option value="GROUP">集團母體 (Conglomerate Group 控股與彙總層)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                所屬集團母體 (parentId)
              </label>
              <select
                disabled={formData.entityType === 'GROUP'}
                value={formData.parentId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, parentId: e.target.value }))}
                className={`w-full border rounded-md px-2.5 py-1.5 text-slate-800 outline-none ${
                  formData.entityType === 'GROUP'
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-50 border-slate-300'
                }`}
              >
                <option value="">-- 無 (此實體為頂層集團本體) --</option>
                {companies.filter(c => c.entityType === 'GROUP' && c.id !== formData.id).map(g => (
                  <option key={g.id} value={g.id}>
                    [{g.companyCode}] {g.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-0.5">
                掛在集團下方後，未來拉取集團報表會自動合併本實體數據。
              </p>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                主體識別代碼 (companyCode) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.companyCode || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, companyCode: e.target.value.toUpperCase() }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 font-mono text-slate-800 outline-none uppercase font-bold"
                placeholder="如: CMP-TW01, BOSS-01"
              />
            </div>
          </div>
        </div>

        {/* 區塊 B：名稱、表單前綴與幣別 */}
        <div className="space-y-3">
          <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5 pb-2 border-b border-slate-100">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>名稱與 ERP 單據印製前綴</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-slate-600 font-semibold mb-1">
                主體完整名稱 (name) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 font-bold text-slate-800 outline-none"
                placeholder="如: 台灣大巨營造工程股份有限公司 或 林董私人調度資金戶"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                顯示簡稱 (shortName)
              </label>
              <input
                type="text"
                value={formData.shortName || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, shortName: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 outline-none"
                placeholder="如: 大巨營造、林董"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                單據前綴編號 (documentPrefix)
              </label>
              <input
                type="text"
                value={formData.documentPrefix || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, documentPrefix: e.target.value.toUpperCase() }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 font-mono font-bold text-indigo-700 outline-none uppercase"
                placeholder="如: DJ, HD, BOSS"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                該公司後續開立採購單 ({formData.documentPrefix || 'PO'}-PO-...)、估驗單跳號之開頭
              </p>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                本位幣別 (baseCurrency)
              </label>
              <select
                value={formData.baseCurrency || 'TWD'}
                onChange={(e) => setFormData(prev => ({ ...prev, baseCurrency: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 outline-none"
              >
                <option value="TWD">TWD 新台幣</option>
                <option value="USD">USD 美元</option>
                <option value="EUR">EUR 歐元</option>
                <option value="JPY">JPY 日圓</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                電子信箱 (email)
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 outline-none"
                placeholder="service@company.com.tw"
              />
            </div>

            <div className="md:col-span-3 bg-indigo-50/50 border border-indigo-200/80 rounded-lg p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-indigo-950 font-bold text-xs">
                  本公司每月固定開票／付款排程日 (paymentScheduleDays)
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  {['7,17,27', '5,15,25', '10,20,30', '10,25', ''].map(preset => (
                    <button
                      key={preset || 'GLOBAL'}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, paymentScheduleDays: preset }))}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                        (formData.paymentScheduleDays || '') === preset
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {preset || '跟隨系統全域'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  type="text"
                  value={formData.paymentScheduleDays || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentScheduleDays: e.target.value }))}
                  className="w-full sm:w-56 bg-white border border-indigo-300 rounded-md px-2.5 py-1.5 font-mono font-bold text-indigo-900 outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="留空則跟隨系統全域（如 7,17,27）"
                />
                <span className="text-[11px] text-slate-600">
                  請以半形逗號分隔每月開票或匯款日 (1~31)。套用優先序：<strong>銀行專戶專屬設定</strong> &gt; <strong>本公司設定</strong> &gt; <strong>系統全域預設</strong>。
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 區塊 C / D：個人實體 vs 公司法人/集團 */}
        {formData.entityType === 'PERSONAL' ? (
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="font-bold text-amber-900 text-xs flex items-center justify-between pb-2 border-b border-amber-200">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-amber-600" />
                <span>個人實體身分驗證 (台灣身分證加權防呆)</span>
              </div>
              {formData.nationalId && (
                <span
                  className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                    nationalIdFeedback.isValid
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                      : 'bg-rose-50 text-rose-700 border border-rose-300'
                  }`}
                >
                  {nationalIdFeedback.isValid ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{nationalIdFeedback.message}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 text-rose-600" />
                      <span>{nationalIdFeedback.message}</span>
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  台灣身分證字號 (首字英文字母 + 9 碼數字) <span className="text-amber-600 font-normal">(選填/防呆)</span>
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={formData.nationalId || ''}
                  onChange={(e) => onNationalIdChange(e.target.value)}
                  className={`w-full bg-slate-50 border rounded-md px-2.5 py-1.5 font-mono font-bold text-slate-800 outline-none uppercase ${
                    formData.nationalId && !nationalIdFeedback.isValid
                      ? 'border-rose-400 focus:ring-1 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-1 focus:ring-amber-500'
                  }`}
                  placeholder="如: A123456789"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  系統自動以縣市代碼加權模數 10 進行即時驗證與性別檢查。
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-800">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-bold">公司法定欄位已自動收折免填</span>：
                統一編號、工商登記地址、工務總部地址、登記資本額及組織代表人物已隱藏。本實體僅作為內部股東借貸、墊款調度及專案損益分流核算。
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pt-2 border-t border-slate-100">
            <div className="space-y-4">
              <div className="font-bold text-slate-800 text-xs flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>公司法定資質 (具備台灣 8 碼統編加權防呆與標準郵遞地址選單)</span>
                </div>
                {formData.taxId && formData.entityType === 'CORPORATION' && (
                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                      taxIdFeedback.isValid
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                        : 'bg-rose-50 text-rose-700 border border-rose-300'
                    }`}
                  >
                    {taxIdFeedback.isValid ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{taxIdFeedback.message}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        <span>{taxIdFeedback.message}</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {formData.entityType === 'CORPORATION' && (
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      法人統一編號 (8 碼) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={formData.taxId || ''}
                      onChange={(e) => onTaxIdChange(e.target.value)}
                      className={`w-full bg-slate-50 border rounded-md px-2.5 py-1.5 font-mono font-bold text-slate-800 outline-none ${
                        formData.taxId && !taxIdFeedback.isValid
                          ? 'border-rose-400 focus:ring-1 focus:ring-rose-500'
                          : 'border-slate-300 focus:ring-1 focus:ring-indigo-500'
                      }`}
                      placeholder="如: 88991234"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    公司負責人 / 法定代表 (representative)
                  </label>
                  <input
                    type="text"
                    value={formData.representative || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, representative: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 outline-none"
                    placeholder="如: 林大巨 董事長"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    登記資本額 (NTD)
                  </label>
                  <input
                    type="number"
                    value={formData.capitalAmount || 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, capitalAmount: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 font-mono text-slate-800 outline-none"
                    placeholder="150000000"
                  />
                </div>
              </div>

              {/* 📍 臺灣標準郵遞區號地址選單 (共用公用元件) */}
              {formData.entityType === 'CORPORATION' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
                  <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl">
                    <TaiwanAddressPicker
                      compact
                      label="官方登記地址 (registeredAddress)"
                      value={{
                        postalCode: formData.registeredPostalCode,
                        city: formData.registeredCity,
                        district: formData.registeredDistrict,
                        streetAddress: formData.registeredStreetAddress,
                        fullAddress: formData.registeredAddress
                      }}
                      addressHistory={formData.registeredAddressHistory}
                      onArchiveAndUpdate={(archived, newVal) =>
                        setFormData(prev => ({
                          ...prev,
                          registeredAddressHistory: [
                            archived,
                            ...(prev.registeredAddressHistory || [])
                          ],
                          registeredPostalCode: newVal.postalCode || '',
                          registeredCity: newVal.city || '',
                          registeredDistrict: newVal.district || '',
                          registeredStreetAddress: newVal.streetAddress || '',
                          registeredAddress: newVal.fullAddress || ''
                        }))
                      }
                      onChange={(val) =>
                        setFormData(prev => ({
                          ...prev,
                          registeredPostalCode: val.postalCode || '',
                          registeredCity: val.city || '',
                          registeredDistrict: val.district || '',
                          registeredStreetAddress: val.streetAddress || '',
                          registeredAddress: val.fullAddress || ''
                        }))
                      }
                    />
                  </div>
                  <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl">
                    <TaiwanAddressPicker
                      compact
                      label="通訊 / 工務聯絡地址 (contactAddress)"
                      value={{
                        postalCode: formData.contactPostalCode,
                        city: formData.contactCity,
                        district: formData.contactDistrict,
                        streetAddress: formData.contactStreetAddress,
                        fullAddress: formData.contactAddress
                      }}
                      addressHistory={formData.contactAddressHistory}
                      onArchiveAndUpdate={(archived, newVal) =>
                        setFormData(prev => ({
                          ...prev,
                          contactAddressHistory: [
                            archived,
                            ...(prev.contactAddressHistory || [])
                          ],
                          contactPostalCode: newVal.postalCode || '',
                          contactCity: newVal.city || '',
                          contactDistrict: newVal.district || '',
                          contactStreetAddress: newVal.streetAddress || '',
                          contactAddress: newVal.fullAddress || ''
                        }))
                      }
                      onChange={(val) =>
                        setFormData(prev => ({
                          ...prev,
                          contactPostalCode: val.postalCode || '',
                          contactCity: val.city || '',
                          contactDistrict: val.district || '',
                          contactStreetAddress: val.streetAddress || '',
                          contactAddress: val.fullAddress || ''
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 區塊 E：公司組織架構重要人物清單 (keyPersonnel) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Crown className="w-3.5 h-3.5 text-amber-600" />
                  <span>組織架構與重要人物清單 (keyPersonnel)</span>
                </div>
                <button
                  type="button"
                  onClick={onAddKeyPerson}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>新增重要人物</span>
                </button>
              </div>

              {keyPersonnel.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-lg text-center text-slate-400 text-xs">
                  尚未維護重要決策人物，點選上方「新增重要人物」加入（例如：董事長、總經理、財務長、工務特助）
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {keyPersonnel.map((person) => (
                    <div
                      key={person.id}
                      className="p-2.5 bg-slate-50 rounded-md border border-slate-200 flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={person.title}
                          onChange={(e) => onUpdateKeyPerson(person.id, 'title', e.target.value)}
                          placeholder="職稱 (如: 總經理)"
                          className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 outline-none"
                        />
                        <input
                          type="text"
                          value={person.name}
                          onChange={(e) => onUpdateKeyPerson(person.id, 'name', e.target.value)}
                          placeholder="姓名"
                          className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-900 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveKeyPerson(person.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={person.phone || ''}
                        onChange={(e) => onUpdateKeyPerson(person.id, 'phone', e.target.value)}
                        placeholder="聯絡電話 / 行動"
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs text-slate-700 outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 區塊 F：動態電話與傳真列表 (phones) */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Phone className="w-3.5 h-3.5 text-indigo-600" />
              <span>聯絡電話與傳真列表 (可新增多組區別)</span>
            </div>
            <button
              type="button"
              onClick={() => onAddPhone('市話')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>新增電話項目</span>
            </button>
          </div>

          {phones.length === 0 ? (
            <div className="p-3 bg-slate-50 rounded-lg text-center text-slate-400 text-xs">
              尚未設定電話，點選上方「新增電話項目」開始維護
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {phones.map((phone) => (
                <div
                  key={phone.id}
                  className="p-2 bg-slate-50 rounded-md border border-slate-200 flex items-center gap-2"
                >
                  <select
                    value={phone.type}
                    onChange={(e) => onUpdatePhone(phone.id, 'type', e.target.value)}
                    className="bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-bold text-slate-700 outline-none shrink-0"
                  >
                    <option value="市話">市話總機</option>
                    <option value="傳真">傳真專線</option>
                    <option value="工務專線">工務專線</option>
                    <option value="行動電話">主管行動</option>
                    <option value="緊急聯絡">緊急值勤</option>
                  </select>

                  <input
                    type="text"
                    value={phone.number}
                    onChange={(e) => onUpdatePhone(phone.id, 'number', e.target.value)}
                    placeholder="號碼 (含區碼)"
                    className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs text-slate-800 outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => onRemovePhone(phone.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 區塊 G：本公司出款銀行專戶與支票簿 */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>出款銀行專戶與支票簿設定 (Bank Accounts & Checkbooks)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                {companyBankAccounts.length} 個帳戶
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenAddBank}
              disabled={!canWriteCompany}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>＋ 為本公司新增出款銀行專戶</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            維護本公司專屬之出款帳戶（如台銀、富邦、中信或私帳）。開立對帳單時將直接關聯此處設定之銀行帳戶與連貫支票簿。
          </p>

          {companyBankAccounts.length === 0 ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
              尚未建立本公司出款專戶，點選右上角「＋ 為本公司新增出款銀行專戶」開始建立
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {companyBankAccounts.map((b) => {
                const prefix = b.checkPrefix || 'CQ';
                const nextNo = b.nextCheckNumber || 1001;
                const digits = b.checkDigits || 6;
                const previewCheck = `${prefix}-${String(nextNo).padStart(digits, '0')}`;

                return (
                  <div
                    key={b.id}
                    className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl flex flex-col justify-between hover:bg-white transition-all shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <span>{b.bankName}</span>
                          {b.branchName && <span className="text-slate-500 font-normal">({b.branchName})</span>}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            b.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {b.status === 'ACTIVE' ? '正常啟用' : '暫停使用'}
                        </span>
                      </div>
                      <div className="font-mono text-slate-700 font-bold text-xs mt-1">
                        帳號: {b.accountNumber}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        戶名: {b.accountName}
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">支票下張票號:</span>
                        <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {previewCheck}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
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
                        {b.paymentScheduleDays && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            排程 {b.paymentScheduleDays} 日
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => onOpenEditBank(b)}
                        disabled={!canWriteCompany}
                        className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                      >
                        修改設定
                      </button>
                      <button
                        type="button"
                        onClick={() => onRequestDeleteBank(b)}
                        disabled={!canWriteCompany}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer disabled:opacity-40"
                        title="刪除帳戶"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
