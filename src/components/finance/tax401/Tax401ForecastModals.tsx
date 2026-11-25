// src/components/finance/tax401/Tax401ForecastModals.tsx
// 401 工作簿：新增預計模擬項目、補號轉正式發票、公司年度留抵與常用門號設定彈窗

import React, { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import {
  Company,
  CompanyTaxSetting,
  InvoiceCategory401,
  InvoiceFormat,
  PlannedInvoice,
  Project,
} from '../../../types/erp';
import {
  convertPlannedInvoiceToOfficial,
  createPlannedInvoice,
  saveCompanyTaxSetting,
} from '../../../db/sqlite';
import { CATEGORY_META, calcTax401Preview } from '../../../utils/tax401Calculator';

interface Tax401AddPlannedModalProps {
  isOpen: boolean;
  selectedCompanyId: string;
  activePeriodKey: string;
  companies: Company[];
  projects: Project[];
  taxRate: number;
  taxRatePct: number;
  operatorName: string;
  onClose: () => void;
  onRefresh: () => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
}

export const Tax401AddPlannedModal: React.FC<Tax401AddPlannedModalProps> = ({
  isOpen,
  selectedCompanyId,
  activePeriodKey,
  companies,
  projects,
  taxRate,
  taxRatePct,
  operatorName,
  onClose,
  onRefresh,
  onNotify,
}) => {
  const [pCompanyId, setPCompanyId] = useState(selectedCompanyId);
  const [pCategory, setPCategory] = useState<InvoiceCategory401>('SALES_THREE_PART');
  const [pFormat, setPFormat] = useState<InvoiceFormat>('THREE_PART');
  const [pPartnerName, setPPartnerName] = useState('');
  const [pProjectId, setPProjectId] = useState('');
  const [pTaxMode, setPTaxMode] = useState<'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT'>('TAX_EXCLUSIVE');
  const [pBaseAmt, setPBaseAmt] = useState('');
  const [pNotes, setPNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setPCompanyId(selectedCompanyId);
    setPCategory('SALES_THREE_PART');
    setPFormat('THREE_PART');
    setPPartnerName('');
    setPProjectId('');
    setPTaxMode('TAX_EXCLUSIVE');
    setPBaseAmt('');
    setPNotes('');
  }, [isOpen, selectedCompanyId]);

  if (!isOpen) return null;

  const plannedPreview = calcTax401Preview(pBaseAmt, pTaxMode, taxRate);

  const handleSavePlanned = () => {
    if (!pPartnerName.trim()) {
      onNotify('請填入預計對象／工程摘要', 'warn');
      return;
    }
    if (plannedPreview.total <= 0) {
      onNotify('請輸入預計金額', 'warn');
      return;
    }
    const meta = CATEGORY_META[pCategory];
    try {
      createPlannedInvoice(
        {
          companyId: pCompanyId,
          taxPeriod: activePeriodKey,
          invoiceType: meta.defaultType,
          invoiceCategory: pCategory,
          invoiceFormat: pFormat,
          invoiceIssueMode: 'DELIVERED',
          partnerName: pPartnerName.trim(),
          linkedProjectId: pProjectId || undefined,
          netAmount: plannedPreview.net,
          taxAmount: plannedPreview.tax,
          totalAmount: plannedPreview.total,
          notes: pNotes.trim() || undefined,
        },
        operatorName
      );
      onClose();
      onRefresh();
      onNotify('✅ 已新增至「預計請款／預計進項模擬區」（尚未壓日期與發票號，不影響正式申報）', 'success');
    } catch (e: any) {
      onNotify(`新增預計項目失敗：${e.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-3.5 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-amber-900">新增預計請款／預計進項模擬項目</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>此項目不押日期與發票號碼，專供評估下個月請款或自主補開時，決定歸屬哪間公司或是否順延下期。</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">模擬歸屬公司</label>
            <select
              value={pCompanyId}
              onChange={(e) => setPCompanyId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.shortName || c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">預計憑證類型</label>
            <select
              value={pCategory}
              onChange={(e) => {
                const c = e.target.value as InvoiceCategory401;
                setPCategory(c);
                if (c === 'SALES_TWO_PART') {
                  setPFormat('TWO_PART');
                  setPTaxMode('TAX_INCLUSIVE');
                } else {
                  setPFormat('THREE_PART');
                }
              }}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
            >
              <option value="SALES_THREE_PART">預計銷項-三聯式</option>
              <option value="SALES_TWO_PART">預計銷項-二聯式</option>
              <option value="PURCHASE_GOODS">預計進項-進貨發票</option>
              <option value="OTHER_EXPENSE_INV">預計進項-費用發票</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">預計交易對象／工程案場摘要 *</label>
          <input
            type="text"
            value={pPartnerName}
            onChange={(e) => setPPartnerName(e.target.value)}
            placeholder="例：下月 XX 廠房第二期請款 100萬"
            className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">金額 *</label>
            <input
              type="number"
              min="0"
              value={pBaseAmt}
              onChange={(e) => setPBaseAmt(e.target.value)}
              placeholder="例: 1000000"
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">稅金推算</label>
            <select
              value={pTaxMode}
              onChange={(e) => setPTaxMode(e.target.value as any)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
            >
              <option value="TAX_EXCLUSIVE">外加 {taxRatePct}%</option>
              <option value="TAX_INCLUSIVE">含稅反算</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">關聯案場 (選填)</label>
            <select
              value={pProjectId}
              onChange={(e) => setPProjectId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
            >
              <option value="">-- 不指定 --</option>
              {projects.filter(p => !p.isDeleted).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">備註</label>
            <input
              type="text"
              value={pNotes}
              onChange={(e) => setPNotes(e.target.value)}
              placeholder="討論中 / 待確認..."
              className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
            />
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between font-mono">
          <span className="font-sans">銷售額 ${plannedPreview.net.toLocaleString()} ＋ 稅額 <b>${plannedPreview.tax.toLocaleString()}</b></span>
          <span className="font-black text-amber-900">NT$ {plannedPreview.total.toLocaleString()}</span>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 cursor-pointer">取消</button>
          <button type="button" onClick={handleSavePlanned} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold cursor-pointer">加入預計模擬區</button>
        </div>
      </div>
    </div>
  );
};

interface Tax401PromotePlannedModalProps {
  promotingPlanned: PlannedInvoice | null;
  operatorName: string;
  onClose: () => void;
  onRefresh: () => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
}

export const Tax401PromotePlannedModal: React.FC<Tax401PromotePlannedModalProps> = ({
  promotingPlanned,
  operatorName,
  onClose,
  onRefresh,
  onNotify,
}) => {
  const [promoteInvNo, setPromoteInvNo] = useState('');
  const [promoteInvDate, setPromoteInvDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!promotingPlanned) return;
    setPromoteInvNo('');
    setPromoteInvDate(new Date().toISOString().slice(0, 10));
  }, [promotingPlanned]);

  if (!promotingPlanned) return null;

  const handleConfirmPromote = () => {
    if (!promoteInvNo.trim()) {
      onNotify('請填入正式發票號碼', 'warn');
      return;
    }
    try {
      convertPlannedInvoiceToOfficial(promotingPlanned.id, promoteInvNo.trim().toUpperCase(), promoteInvDate, operatorName);
      onClose();
      onRefresh();
      onNotify(`✅ 已將預計項目轉為正式發票 [${promoteInvNo.trim().toUpperCase()}]！`, 'success');
    } catch (e: any) {
      onNotify(`轉正式失敗：${e.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-3.5 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-emerald-900">補上發票字軌與日期 ➔ 轉為正式發票</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
          <div className="font-bold text-slate-900">{promotingPlanned.partnerName}</div>
          <div className="font-mono text-slate-600">
            未稅 ${promotingPlanned.netAmount.toLocaleString()} ＋ 稅 ${promotingPlanned.taxAmount.toLocaleString()} ＝ 總額 ${promotingPlanned.totalAmount.toLocaleString()}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">正式發票號碼 *</label>
            <input
              type="text"
              value={promoteInvNo}
              onChange={(e) => setPromoteInvNo(e.target.value.toUpperCase())}
              placeholder="例: AB-99887766"
              className="w-full bg-white border border-emerald-300 rounded-lg p-2 font-mono font-bold outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">開立日期 *</label>
            <input
              type="date"
              value={promoteInvDate}
              onChange={(e) => setPromoteInvDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 cursor-pointer">取消</button>
          <button type="button" onClick={handleConfirmPromote} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer">確認轉為正式發票</button>
        </div>
      </div>
    </div>
  );
};

interface Tax401SettingsModalProps {
  isOpen: boolean;
  activeCompany?: Company;
  selectedCompanyId: string;
  selectedYear: number;
  activeSetting?: CompanyTaxSetting;
  onClose: () => void;
  onRefresh: () => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
}

export const Tax401SettingsModal: React.FC<Tax401SettingsModalProps> = ({
  isOpen,
  activeCompany,
  selectedCompanyId,
  selectedYear,
  activeSetting,
  onClose,
  onRefresh,
  onNotify,
}) => {
  const [setPriorCredit, setSetPriorCredit] = useState('0');
  const [setPhonesText, setSetPhonesText] = useState('');
  const [setElecText, setSetElecText] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSetPriorCredit(String(activeSetting?.priorYearCreditTax ?? 0));
    setSetPhonesText((activeSetting?.phonePresets || []).join('\n'));
    setSetElecText((activeSetting?.electricityPresets || []).join('\n'));
  }, [isOpen, activeSetting]);

  if (!isOpen) return null;

  const handleSaveSettings = () => {
    const phones = setPhonesText.split(/[\n,，]+/).map(s => s.trim()).filter(Boolean);
    const elecs = setElecText.split(/[\n,，]+/).map(s => s.trim()).filter(Boolean);
    saveCompanyTaxSetting({
      companyId: selectedCompanyId,
      taxYear: selectedYear,
      priorYearCreditTax: Math.max(0, Number(setPriorCredit || 0)),
      phonePresets: phones,
      electricityPresets: elecs,
      personalVoucherLabel: activeSetting?.personalVoucherLabel,
    });
    onClose();
    onRefresh();
    onNotify(`✅ 已更新【${activeCompany?.shortName || selectedCompanyId}】${selectedYear}年度期初留抵與常用門號／電表設定！`, 'success');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-3.5 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-900">
            【{activeCompany?.shortName || selectedCompanyId}】{selectedYear} 年度稅務參數與快捷清單
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            去年年底結轉留抵稅額（本年度 1.2 月 Code 8 起始值）
          </label>
          <input
            type="number"
            min="0"
            value={setPriorCredit}
            onChange={(e) => setSetPriorCredit(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            3.4月起的留抵稅額將由系統自動抓取上一期的累積留抵（負數即留抵、正數繳稅後歸零）。
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">本公司常用電話門號（每行一筆，可於登錄電話費時一鍵帶入）</label>
          <textarea
            rows={3}
            value={setPhonesText}
            onChange={(e) => setSetPhonesText(e.target.value)}
            placeholder={'04-1234567\n09xx-xxxxxx'}
            className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">本公司常用台電電表／廠址（每行一筆）</label>
          <textarea
            rows={3}
            value={setElecText}
            onChange={(e) => setSetElecText(e.target.value)}
            placeholder={'一廠電表 (xx-xxxx-xx)\n辦公室地址'}
            className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 cursor-pointer">取消</button>
          <button type="button" onClick={handleSaveSettings} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer">儲存設定</button>
        </div>
      </div>
    </div>
  );
};
