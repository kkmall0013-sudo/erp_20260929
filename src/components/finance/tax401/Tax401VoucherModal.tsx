// src/components/finance/tax401/Tax401VoucherModal.tsx
// 401 工作簿新增正式憑證／統一發票彈窗 (含電話費、台電電表快捷與 14 種 401 分類)

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  BusinessPartner,
  Company,
  CompanyTaxSetting,
  InvoiceCategory401,
  InvoiceFormat,
  InvoiceIssueMode,
  Project,
} from '../../../types/erp';
import { createInvoice } from '../../../db/sqlite';
import {
  CATEGORY_META,
  calcTax401Preview,
  derivePeriodFromDate,
} from '../../../utils/tax401Calculator';

interface Tax401VoucherModalProps {
  isOpen: boolean;
  defaultCategory: InvoiceCategory401;
  selectedYear: number;
  activePeriodKey: string;
  activeCompany?: Company;
  selectedCompanyId: string;
  activeSetting?: CompanyTaxSetting;
  partners: BusinessPartner[];
  projects: Project[];
  taxRate: number;
  taxRatePct: number;
  operatorName: string;
  onClose: () => void;
  onRefresh: () => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
}

export const Tax401VoucherModal: React.FC<Tax401VoucherModalProps> = ({
  isOpen,
  defaultCategory,
  selectedYear,
  activePeriodKey,
  activeCompany,
  selectedCompanyId,
  activeSetting,
  partners,
  projects,
  taxRate,
  taxRatePct,
  operatorName,
  onClose,
  onRefresh,
  onNotify,
}) => {
  const [vCategory, setVCategory] = useState<InvoiceCategory401>(defaultCategory);
  const [vFormat, setVFormat] = useState<InvoiceFormat>('THREE_PART');
  const [vIssueMode, setVIssueMode] = useState<InvoiceIssueMode>('DELIVERED');
  const [vNumber, setVNumber] = useState('');
  const [vDate, setVDate] = useState(new Date().toISOString().slice(0, 10));
  const [vPartnerId, setVPartnerId] = useState('');
  const [vPartnerName, setVPartnerName] = useState('');
  const [vPartnerTaxId, setVPartnerTaxId] = useState('');
  const [vProjectId, setVProjectId] = useState('');
  const [vTaxMode, setVTaxMode] = useState<'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT'>('TAX_EXCLUSIVE');
  const [vBaseAmt, setVBaseAmt] = useState('');
  const [vManualTax, setVManualTax] = useState('');
  const [vPresetLabel, setVPresetLabel] = useState('');
  const [vNotes, setVNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const meta = CATEGORY_META[defaultCategory];
    const startMonth = Number(activePeriodKey.slice(5, 7) || '01');
    const todayStr = new Date().toISOString().slice(0, 10);
    const defaultDate =
      derivePeriodFromDate(todayStr) === activePeriodKey
        ? todayStr
        : `${selectedYear}-${String(startMonth).padStart(2, '0')}-15`;

    setVCategory(defaultCategory);
    setVFormat(defaultCategory === 'SALES_TWO_PART' ? 'TWO_PART' : 'THREE_PART');
    setVIssueMode('DELIVERED');
    setVNumber('');
    setVDate(defaultDate);
    setVPartnerId('');
    setVPartnerName(
      defaultCategory === 'TELECOM_EXPENSE'
        ? '中華電信股份有限公司'
        : defaultCategory === 'ELECTRICITY_EXPENSE'
        ? '台灣電力股份有限公司'
        : ''
    );
    setVPartnerTaxId('');
    setVProjectId('');
    setVTaxMode(
      meta.exemptDefault
        ? 'TAX_EXEMPT'
        : defaultCategory === 'SALES_TWO_PART'
        ? 'TAX_INCLUSIVE'
        : 'TAX_EXCLUSIVE'
    );
    setVBaseAmt('');
    setVManualTax('');
    setVPresetLabel('');
    setVNotes('');
  }, [isOpen, defaultCategory, activePeriodKey, selectedYear]);

  if (!isOpen) return null;

  const voucherPreview = calcTax401Preview(vBaseAmt, vTaxMode, taxRate, vManualTax);

  const handleSaveOfficialVoucher = () => {
    const meta = CATEGORY_META[vCategory];
    const needAutoNo = vCategory === 'RECEIPT_EXEMPT' || vCategory === 'PERSONAL_VOUCHER';
    const cleanNo = vNumber.trim().toUpperCase() || (needAutoNo ? `RCP-${Date.now().toString().slice(-6)}` : '');
    if (!cleanNo) {
      onNotify('請輸入發票字軌號碼（僅收據／個人憑證可留空自動產號）', 'warn');
      return;
    }
    if (!vPartnerName.trim()) {
      onNotify('請填入交易對象／摘要名稱', 'warn');
      return;
    }
    if (voucherPreview.total <= 0) {
      onNotify('金額必須大於 0', 'warn');
      return;
    }
    const ourTax = activeCompany?.taxId || selectedCompanyId;
    const ourName = activeCompany?.name || selectedCompanyId;
    const otherTax = vPartnerTaxId.trim() || (vFormat === 'TWO_PART' ? '免統編(二聯)' : meta.exemptDefault ? '免稅憑證' : '未建統編');
    const invType = meta.defaultType;

    try {
      createInvoice(
        {
          invoiceType: invType,
          invoiceFormat: vFormat,
          invoiceIssueMode: invType === 'OUTPUT' ? vIssueMode : 'DELIVERED',
          invoiceCategory: vCategory,
          taxPeriod: derivePeriodFromDate(vDate),
          presetLabel: vPresetLabel.trim() || undefined,
          notes: vNotes.trim() || undefined,
          invoiceNumber: cleanNo,
          invoiceDate: vDate,
          taxReportingCompanyId: selectedCompanyId,
          issuerTaxId: invType === 'INPUT' ? otherTax : ourTax,
          issuerName: invType === 'INPUT' ? vPartnerName.trim() : ourName,
          buyerTaxId: invType === 'INPUT' ? ourTax : otherTax,
          buyerName: invType === 'INPUT' ? ourName : vPartnerName.trim(),
          netAmount: voucherPreview.net,
          taxAmount: voucherPreview.tax,
          totalAmount: voucherPreview.total,
          linkedProjectId: vProjectId || undefined,
          status: 'VALID',
        },
        operatorName
      );
      onClose();
      onRefresh();
      onNotify(`✅ 已登記「${meta.label}」憑證 [${cleanNo}] 至 ${activeCompany?.shortName || selectedCompanyId}！`, 'success');
    } catch (e: any) {
      onNotify(`登記失敗：${e.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-3.5 text-xs max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-900">
            新增憑證／統一發票 ({activeCompany?.shortName || selectedCompanyId})
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">401 申報分類明細</label>
          <select
            value={vCategory}
            onChange={(e) => {
              const nextCat = e.target.value as InvoiceCategory401;
              setVCategory(nextCat);
              const meta = CATEGORY_META[nextCat];
              setVTaxMode(meta.exemptDefault ? 'TAX_EXEMPT' : 'TAX_EXCLUSIVE');
              if (nextCat === 'SALES_TWO_PART') {
                setVFormat('TWO_PART');
                setVTaxMode('TAX_INCLUSIVE');
              } else if (nextCat === 'SALES_THREE_PART') {
                setVFormat('THREE_PART');
              } else if (nextCat === 'TELECOM_EXPENSE') {
                setVPartnerName('中華電信股份有限公司');
              } else if (nextCat === 'ELECTRICITY_EXPENSE') {
                setVPartnerName('台灣電力股份有限公司');
              }
            }}
            className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
          >
            <optgroup label="── 銷項憑證 (401 銷售額 / 銷項稅)">
              <option value="SALES_THREE_PART">銷貨發票-三聯式</option>
              <option value="SALES_TWO_PART">銷貨發票-二聯式</option>
              <option value="SALES_ALLOWANCE">銷貨折讓明細 (-)</option>
            </optgroup>
            <optgroup label="── 可扣抵進項憑證 (401 得抵扣進項)">
              <option value="PURCHASE_GOODS">進貨發票明細</option>
              <option value="FUEL_EXPENSE">油單+三聯單發票明細</option>
              <option value="TELECOM_EXPENSE">電話費明細</option>
              <option value="ELECTRICITY_EXPENSE">台灣電力公司電費</option>
              <option value="OTHER_EXPENSE_INV">費用發票明細</option>
              <option value="FIXED_ASSET">固定資產費用</option>
              <option value="PURCHASE_RETURN">進貨退出明細 (-)</option>
              <option value="PURCHASE_ALLOWANCE">進貨折讓明細 (-)</option>
            </optgroup>
            <optgroup label="── 不計入 401 抵減憑證">
              <option value="NON_DEDUCTIBLE_INV">不列入401申報發票</option>
              <option value="RECEIPT_EXEMPT">收據明細 (郵資/免開發票)</option>
              <option value="PERSONAL_VOUCHER">個人憑證 (非公司營業稅帳)</option>
            </optgroup>
          </select>
        </div>

        {vCategory === 'TELECOM_EXPENSE' && (activeSetting?.phonePresets?.length || 0) > 0 && (
          <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 space-y-1.5">
            <div className="text-[11px] font-bold text-sky-900">快速帶入常用電話門號（{activeCompany?.shortName}）：</div>
            <div className="flex flex-wrap gap-1.5">
              {activeSetting!.phonePresets.map(ph => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => setVPresetLabel(ph)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border cursor-pointer ${
                    vPresetLabel === ph ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-sky-800 border-sky-300'
                  }`}
                >
                  {ph}
                </button>
              ))}
            </div>
          </div>
        )}

        {vCategory === 'ELECTRICITY_EXPENSE' && (activeSetting?.electricityPresets?.length || 0) > 0 && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5">
            <div className="text-[11px] font-bold text-amber-900">快速帶入常用台電電表／地址：</div>
            <div className="flex flex-wrap gap-1.5">
              {activeSetting!.electricityPresets.map(el => (
                <button
                  key={el}
                  type="button"
                  onClick={() => setVPresetLabel(el)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                    vPresetLabel === el ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-900 border-amber-300'
                  }`}
                >
                  {el}
                </button>
              ))}
            </div>
          </div>
        )}

        {CATEGORY_META[vCategory].defaultType === 'OUTPUT' && (
          <div className="flex flex-wrap items-center gap-2 bg-purple-50/70 p-2 rounded-lg border border-purple-200">
            <span className="font-bold text-purple-900">交付模式：</span>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={vIssueMode === 'DELIVERED'} onChange={() => setVIssueMode('DELIVERED')} />
              <span>交付業主</span>
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer ml-2">
              <input type="radio" checked={vIssueMode === 'SELF_RETAINED'} onChange={() => setVIssueMode('SELF_RETAINED')} />
              <span className="font-bold text-purple-900">自主開立留存報稅 (自理稅金)</span>
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {CATEGORY_META[vCategory].exemptDefault ? '憑證號碼 (可留空自動)' : '發票字軌號碼 *'}
            </label>
            <input
              type="text"
              value={vNumber}
              onChange={(e) => setVNumber(e.target.value.toUpperCase())}
              placeholder="例: AB-12345678"
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-indigo-800 outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">開立日期 *</label>
            <input
              type="date"
              value={vDate}
              onChange={(e) => setVDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">選取夥伴帶入 (選填)</label>
            <select
              value={vPartnerId}
              onChange={(e) => {
                const pid = e.target.value;
                setVPartnerId(pid);
                const bp = partners.find(x => x.id === pid);
                if (bp) {
                  setVPartnerName(bp.name);
                  setVPartnerTaxId(bp.taxId || '');
                }
              }}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
            >
              <option value="">-- 手動輸入對象 --</option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.taxId || '無統編'})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">關聯專案案場 (選填)</label>
            <select
              value={vProjectId}
              onChange={(e) => setVProjectId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
            >
              <option value="">-- 不指定案場 --</option>
              {projects.filter(p => !p.isDeleted).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">對象名稱 / 費用摘要 *</label>
            <input
              type="text"
              value={vPartnerName}
              onChange={(e) => setVPartnerName(e.target.value)}
              placeholder="廠商名稱 / 客戶名稱 / 郵資..."
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">對象統編 / 門號電表標籤</label>
            <input
              type="text"
              value={vPartnerTaxId}
              onChange={(e) => setVPartnerTaxId(e.target.value)}
              placeholder="8碼統編 (選填)"
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {vTaxMode === 'TAX_INCLUSIVE' ? '含稅總額 *' : '未稅／實付金額 *'}
            </label>
            <input
              type="number"
              min="0"
              value={vBaseAmt}
              onChange={(e) => setVBaseAmt(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">計稅模式</label>
            <select
              value={vTaxMode}
              onChange={(e) => setVTaxMode(e.target.value as any)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
            >
              <option value="TAX_EXCLUSIVE">外加 {taxRatePct}%</option>
              <option value="TAX_INCLUSIVE">含稅反算</option>
              <option value="TAX_EXEMPT">免稅 $0</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">手調稅額 (試算 {voucherPreview.autoTax})</label>
            <input
              type="number"
              value={vManualTax}
              onChange={(e) => setVManualTax(e.target.value)}
              placeholder={String(voucherPreview.autoTax)}
              disabled={vTaxMode === 'TAX_EXEMPT'}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none disabled:bg-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">門號／電表地址標籤 (選填)</label>
            <input
              type="text"
              value={vPresetLabel}
              onChange={(e) => setVPresetLabel(e.target.value)}
              placeholder="例: 04-xxxxxxx / 一廠電表"
              className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">備註</label>
            <input
              type="text"
              value={vNotes}
              onChange={(e) => setVNotes(e.target.value)}
              placeholder="備註說明..."
              className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
            />
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-between font-mono">
          <span className="font-sans text-slate-700">
            未稅 <b>${voucherPreview.net.toLocaleString()}</b> ＋ 稅 <b>${voucherPreview.tax.toLocaleString()}</b>
          </span>
          <span className="font-black text-indigo-800 text-sm">含稅總額 NT$ {voucherPreview.total.toLocaleString()}</span>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSaveOfficialVoucher}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer"
          >
            確認登記入主檔
          </button>
        </div>
      </div>
    </div>
  );
};
