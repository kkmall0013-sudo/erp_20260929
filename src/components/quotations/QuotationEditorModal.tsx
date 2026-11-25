import React, { useState, useEffect } from 'react';
import {
  Quotation,
  QuotationItem,
  QuotationBillingMilestone,
  QuotationRevision,
  QuotationPricingMode,
  Company,
  BusinessPartner,
  Project,
} from '../../types/erp';
import {
  FileSpreadsheet,
  Save,
  CheckCircle2,
  Printer,
  Copy,
  AlertTriangle,
  Percent,
  Layers,
  Paperclip,
  X,
} from 'lucide-react';
import { QuotationPrintPreviewModal } from './QuotationPrintPreviewModal';
import { QuotationPricingTrackCard } from './QuotationPricingTrackCard';
import { QuotationItemsTable } from './QuotationItemsTable';
import { QuotationMilestonesAndTabs } from './QuotationMilestonesAndTabs';
import {
  previewNextDocumentNumber,
  getNextDocumentNumber,
  getQuotationItems,
  getQuotationMilestones,
} from '../../db/sqlite';

interface QuotationEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation?: Quotation | null;
  companies: Company[];
  customers: BusinessPartner[];
  projects: Project[];
  onSave: (
    quotation: Quotation,
    items: QuotationItem[],
    milestones: QuotationBillingMilestone[]
  ) => void;
  onDeepCopyRevision?: (sourceId: string, newRevCode: string) => void;
  revisions?: QuotationRevision[];
}

export const QuotationEditorModal: React.FC<QuotationEditorModalProps> = ({
  isOpen,
  onClose,
  quotation,
  companies,
  customers,
  projects,
  onSave,
  onDeepCopyRevision,
  revisions = [],
}) => {
  // 1. 報價單表頭狀態
  const [formData, setFormData] = useState<Partial<Quotation>>({
    quoteNumber: quotation?.quoteNumber || previewNextDocumentNumber('QUO'),
    projectId: quotation?.projectId || projects[0]?.id || '',
    customerId: quotation?.customerId || customers[0]?.id || '',
    customerName: quotation?.customerName || customers[0]?.name || '',
    companyId: quotation?.companyId || companies[0]?.id || '',
    currency: quotation?.currency || 'TWD',
    pricingMode: quotation?.pricingMode || 'HEADER_DISCOUNT',
    customDiscountText: quotation?.customDiscountText || '',
    agreedTotalAmount: quotation?.agreedTotalAmount || undefined,
    currentRevision: quotation?.currentRevision || 'REV-A',
    status: quotation?.status || 'DRAFT',
    validityDate: quotation?.validityDate || new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
    discountAmount: quotation?.discountAmount || 0,
  });

  // 2. 明細與里程碑清單
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [milestones, setMilestones] = useState<QuotationBillingMilestone[]>([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'MILESTONES' | 'ATTACHMENTS' | 'VERSIONS'>('ITEMS');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 3. 深拷貝新版次 inline 輸入條 (取代 window.prompt)
  const [showCopyRevBox, setShowCopyRevBox] = useState(false);
  const [copyRevCode, setCopyRevCode] = useState('REV-B');

  // 初始化載入既有項目或預設工程明細
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setShowCopyRevBox(false);
    setCopyRevCode('REV-B');

    if (quotation) {
      setFormData({ ...quotation });
      const loadedItems = getQuotationItems(quotation.id, quotation.currentRevision);
      const loadedMilestones = getQuotationMilestones(quotation.id);
      setItems(loadedItems.length > 0 ? loadedItems : []);
      setMilestones(
        loadedMilestones.length > 0
          ? loadedMilestones
          : [
              { id: crypto.randomUUID(), quotationId: quotation.id, stageIndex: 1, stageName: '簽約訂金款', percentage: 30, amount: 0 },
              { id: crypto.randomUUID(), quotationId: quotation.id, stageIndex: 2, stageName: '結構體完成款', percentage: 40, amount: 0 },
              { id: crypto.randomUUID(), quotationId: quotation.id, stageIndex: 3, stageName: '泥作粉刷驗收款', percentage: 20, amount: 0 },
              { id: crypto.randomUUID(), quotationId: quotation.id, stageIndex: 4, stageName: '完工保固款', percentage: 10, amount: 0 },
            ]
      );
    } else {
      setFormData({
        quoteNumber: previewNextDocumentNumber('QUO'),
        projectId: projects[0]?.id || '',
        customerId: customers[0]?.id || '',
        customerName: customers[0]?.name || '',
        companyId: companies[0]?.id || '',
        currency: 'TWD',
        pricingMode: 'HEADER_DISCOUNT',
        customDiscountText: '',
        agreedTotalAmount: undefined,
        currentRevision: 'REV-A',
        status: 'DRAFT',
        validityDate: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
        discountAmount: 0,
      });
      setItems([
        {
          id: crypto.randomUUID(),
          quotationId: '',
          revisionCode: 'REV-A',
          itemType: 'NORMAL',
          itemName: '一樓主結構 RC 灌漿混凝土澆置',
          spec: '3500 psi 國產優質預拌混凝土，含壓送泵浦車',
          quantity: 120,
          unit: 'M3',
          unitPrice: 2800,
          lineTotal: 336000,
          estimatedUnitCost: 2200,
          effectiveUnitPrice: 2800,
          isAwarded: true,
          lostReason: '',
        },
        {
          id: crypto.randomUUID(),
          quotationId: '',
          revisionCode: 'REV-A',
          itemType: 'NORMAL',
          itemName: '外牆雙層防裂泥作粉刷工程',
          spec: '1:3 水泥砂漿打底加強貼網防裂，厚度 20mm',
          quantity: 350,
          unit: 'M2',
          unitPrice: 750,
          lineTotal: 262500,
          estimatedUnitCost: 550,
          effectiveUnitPrice: 750,
          isAwarded: true,
          lostReason: '',
        },
        {
          id: crypto.randomUUID(),
          quotationId: '',
          revisionCode: 'REV-A',
          itemType: 'DEDUCTION',
          itemName: '原有舊水塔折抵減項扣款',
          spec: '不鏽鋼水塔由業主自行回收拆除折抵',
          quantity: 1,
          unit: '式',
          unitPrice: 15000,
          lineTotal: 15000,
          estimatedUnitCost: 0,
          effectiveUnitPrice: 15000,
          isAwarded: true,
          lostReason: '',
        },
      ]);

      setMilestones([
        { id: crypto.randomUUID(), quotationId: '', stageIndex: 1, stageName: '簽約訂金款', percentage: 30, amount: 0 },
        { id: crypto.randomUUID(), quotationId: '', stageIndex: 2, stageName: '結構體完成款', percentage: 40, amount: 0 },
        { id: crypto.randomUUID(), quotationId: '', stageIndex: 3, stageName: '泥作粉刷驗收款', percentage: 20, amount: 0 },
        { id: crypto.randomUUID(), quotationId: '', stageIndex: 4, stageName: '完工保固款', percentage: 10, amount: 0 },
      ]);
    }
  }, [isOpen, quotation]);

  // 同步客戶名稱
  const handleCustomerChange = (cid: string) => {
    const cust = customers.find(c => c.id === cid);
    setFormData(prev => ({
      ...prev,
      customerId: cid,
      customerName: cust ? cust.name : prev.customerName,
    }));
  };

  // 即時計算金額四柱 (扣減項以正數輸入，但在總計中扣除)
  const awardedItems = items.filter(it => it.isAwarded !== false);
  const rawSubtotal = awardedItems.reduce((acc, it) => {
    const lineVal = Math.round((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0));
    return it.itemType === 'DEDUCTION' ? acc - lineVal : acc + lineVal;
  }, 0);

  const pricingMode = (formData.pricingMode || 'HEADER_DISCOUNT') as QuotationPricingMode;
  let computedNetAmount = rawSubtotal;
  let computedDiscount = Number(formData.discountAmount || 0);

  if (pricingMode === 'HEADER_DISCOUNT') {
    computedNetAmount = Math.max(0, rawSubtotal - computedDiscount);
  } else if (pricingMode === 'UNIT_PRICE_ADJUSTMENT') {
    computedNetAmount = rawSubtotal;
    computedDiscount = 0;
  } else if (pricingMode === 'SHADOW_ALLOCATION') {
    if (formData.agreedTotalAmount && formData.agreedTotalAmount > 0) {
      computedNetAmount = Math.round(formData.agreedTotalAmount / 1.05);
    }
  }

  const taxRate = 0.05;
  const computedTax = Math.round(computedNetAmount * taxRate);
  const computedTotal =
    pricingMode === 'SHADOW_ALLOCATION' && formData.agreedTotalAmount
      ? Math.round(formData.agreedTotalAmount)
      : computedNetAmount + computedTax;

  // 自動更新里程碑各期試算金額
  useEffect(() => {
    setMilestones(prev =>
      prev.map(m => ({
        ...m,
        amount: Math.round((computedTotal * (Number(m.percentage) || 0)) / 100),
      }))
    );
  }, [computedTotal]);

  // Hooks 之後才能提早 return
  if (!isOpen) return null;

  const handleAddItem = (type: 'NORMAL' | 'DEDUCTION' = 'NORMAL') => {
    const newItem: QuotationItem = {
      id: crypto.randomUUID(),
      quotationId: quotation?.id || '',
      revisionCode: formData.currentRevision || 'REV-A',
      itemType: type,
      itemName: type === 'DEDUCTION' ? '折讓減項工項' : '新工程項目',
      spec: '',
      quantity: 1,
      unit: '式',
      unitPrice: 0,
      lineTotal: 0,
      estimatedUnitCost: 0,
      effectiveUnitPrice: 0,
      isAwarded: true,
      lostReason: '',
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleUpdateItem = (index: number, field: keyof QuotationItem, val: any) => {
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index], [field]: val };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Number(val) : Number(target.quantity);
        const price = field === 'unitPrice' ? Number(val) : Number(target.unitPrice);
        target.lineTotal = Math.round(qty * price);
      }
      copy[index] = target;
      return copy;
    });
  };

  const handleDeleteItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // 軌道二：自動反推單價平滑演算法
  const handleAutoAdjustUnitPrices = (targetNetNum: number) => {
    const standardItems = items.filter(it => it.itemType !== 'DEDUCTION' && it.isAwarded !== false);
    if (!standardItems.length) return;
    const currentStandardSum = standardItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
    if (currentStandardSum <= 0) return;

    const ratio = targetNetNum / currentStandardSum;
    setItems(prev =>
      prev.map(it => {
        if (it.itemType === 'DEDUCTION' || it.isAwarded === false) return it;
        const newUnitPrice = Number((it.unitPrice * ratio).toFixed(2));
        return {
          ...it,
          unitPrice: newUnitPrice,
          lineTotal: Math.round(it.quantity * newUnitPrice),
        };
      })
    );
    setFormData(prev => ({
      ...prev,
      pricingMode: 'UNIT_PRICE_ADJUSTMENT',
      discountAmount: 0,
    }));
  };

  // 儲存送出驗證 (以 inline error banner 取代 alert)
  const handleSubmit = (targetStatus: Quotation['status'] = 'DRAFT') => {
    setErrorMessage(null);
    if (items.length === 0) {
      setErrorMessage('報價單必須包含至少一筆工項明細，請切換至「工項明細清單」新增項目。');
      return;
    }

    const unawardedWithoutReason = items.find(
      it => it.isAwarded === false && (!it.lostReason || it.lostReason.trim() === '')
    );
    if (unawardedWithoutReason) {
      setErrorMessage(`項目【${unawardedWithoutReason.itemName}】標記為未得標，依 Rule 4.1 必須填寫「失標原因」。`);
      setActiveTab('ITEMS');
      return;
    }

    const totalPercentage = milestones.reduce((acc, m) => acc + Number(m.percentage || 0), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      setErrorMessage(`請款里程碑比例總和為 ${totalPercentage}%，必須剛好等於 100%。`);
      setActiveTab('MILESTONES');
      return;
    }

    const finalQuotation: Quotation = {
      id: quotation?.id || crypto.randomUUID(),
      quoteNumber: quotation?.quoteNumber || getNextDocumentNumber('QUO'),
      projectId: formData.projectId || '',
      customerId: formData.customerId || '',
      customerName: formData.customerName || '',
      companyId: formData.companyId || '',
      currency: formData.currency || 'TWD',
      pricingMode,
      customDiscountText: formData.customDiscountText || '',
      agreedTotalAmount: formData.agreedTotalAmount,
      netAmount: computedNetAmount,
      taxAmount: computedTax,
      totalAmount: computedTotal,
      discountAmount: computedDiscount,
      currentRevision: formData.currentRevision || 'REV-A',
      status: targetStatus,
      validityDate: formData.validityDate || '',
      parentQuotationId: quotation?.parentQuotationId,
      isDeleted: false,
      version: quotation?.version ? quotation.version + 1 : 1,
      createdAt: quotation?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(finalQuotation, items, milestones);
    onClose();
  };

  const selectedCompany = companies.find(c => c.id === formData.companyId);
  const selectedCustomer = customers.find(c => c.id === formData.customerId);
  const selectedProject = projects.find(p => p.id === formData.projectId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[94vh]">
        {/* 頂部導航列 */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-600/30 border border-indigo-400/40 text-indigo-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-wide">
                  {quotation ? '編輯報價單 (CPQ 議價引擎)' : '開立工程報價單 (CPQ Engine)'}
                </h2>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-mono text-xs px-2 py-0.5 rounded font-bold">
                  {formData.currentRevision}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold ${
                    formData.status === 'ACCEPTED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {formData.status === 'ACCEPTED' ? '✓ 已成交定案' : '草稿作業中'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                單號：<span className="font-mono text-slate-200">{formData.quoteNumber}</span> ｜ 遵循 Rule 4.1~4.5 三軌議價、幽靈小數洗滌與影子有效單價防禦
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700 whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>列印預覽</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              關閉
            </button>
          </div>
        </div>

        {/* 核心工作內容區 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2.5 rounded-lg flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-500 hover:text-rose-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* A. 三軌議價模式切換器 (拆出子元件) */}
          <QuotationPricingTrackCard
            pricingMode={pricingMode}
            discountAmount={Number(formData.discountAmount || 0)}
            agreedTotalAmount={formData.agreedTotalAmount}
            customDiscountText={formData.customDiscountText}
            rawSubtotal={rawSubtotal}
            computedNetAmount={computedNetAmount}
            onChangeFormData={(updates) => setFormData(prev => ({ ...prev, ...updates }))}
            onAutoAdjustUnitPrices={handleAutoAdjustUnitPrices}
          />

          {/* B. 基本資料表頭資訊 */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">報價單號</label>
                <input
                  type="text"
                  value={formData.quoteNumber || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, quoteNumber: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">承攬開立法人</label>
                <select
                  value={formData.companyId || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyId: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 text-slate-800 font-medium"
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.companyCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">定作業主 (客戶)</label>
                <select
                  value={formData.customerId || ''}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 text-slate-800 font-bold"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.taxId || '無統編'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">關聯專案工程</label>
                <select
                  value={formData.projectId || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 text-slate-800 font-medium"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.projectCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs pt-2 border-t border-slate-100">
              <div>
                <label className="block font-bold text-slate-700 mb-1">報價有效日期</label>
                <input
                  type="date"
                  value={formData.validityDate || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, validityDate: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">幣別代碼</label>
                <input
                  type="text"
                  value={formData.currency || 'TWD'}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">報價單況</label>
                <select
                  value={formData.status || 'DRAFT'}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Quotation['status'] }))}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 text-slate-800 font-bold"
                >
                  <option value="DRAFT">DRAFT (草稿中)</option>
                  <option value="SENT">SENT (已送出給業主)</option>
                  <option value="ACCEPTED">ACCEPTED (已成交簽署)</option>
                  <option value="REJECTED">REJECTED (未得標/失標)</option>
                  <option value="SUPERSEDED">SUPERSEDED (已由新版取代)</option>
                </select>
              </div>

              <div className="flex flex-col justify-end gap-1.5">
                {quotation && onDeepCopyRevision && !showCopyRevBox && (
                  <button
                    type="button"
                    onClick={() => setShowCopyRevBox(true)}
                    className="w-full px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>深拷貝產出新版次 (Deep Copy)</span>
                  </button>
                )}
                {quotation && onDeepCopyRevision && showCopyRevBox && (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={copyRevCode}
                      onChange={(e) => setCopyRevCode(e.target.value)}
                      placeholder="新版代碼如 REV-B"
                      className="flex-1 min-w-0 px-2 py-1 rounded border border-indigo-300 font-mono text-xs text-indigo-900 bg-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const code = copyRevCode.trim();
                        if (!code) return;
                        onDeepCopyRevision(quotation.id, code);
                        setShowCopyRevBox(false);
                        onClose();
                      }}
                      className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      建立
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCopyRevBox(false)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* C. 中間功能頁籤導航 */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('ITEMS')}
              className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'ITEMS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>工項明細清單 ({items.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('MILESTONES')}
              className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'MILESTONES'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>請款里程碑比例 (總和 100%)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ATTACHMENTS')}
              className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'ATTACHMENTS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>圖說與附件金庫 (Phase 9)</span>
            </button>

            {revisions.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('VERSIONS')}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'VERSIONS'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>版本歷程樹 ({revisions.length})</span>
              </button>
            )}
          </div>

          {/* D. 頁籤內容 */}
          {activeTab === 'ITEMS' ? (
            <QuotationItemsTable
              items={items}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
            />
          ) : (
            <QuotationMilestonesAndTabs
              activeTab={activeTab}
              quotationId={quotation?.id}
              milestones={milestones}
              revisions={revisions}
              onChangeMilestones={setMilestones}
            />
          )}

          {/* H. 金額統計卡 */}
          <div className="bg-slate-900 text-white p-5 rounded-xl flex flex-wrap items-center justify-between gap-6 shadow-md">
            <div className="flex flex-wrap items-center gap-8 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">得標明細小計</span>
                <span className="font-mono tabular-nums font-bold text-base text-slate-200">
                  NT$ {rawSubtotal.toLocaleString()}
                </span>
              </div>

              {pricingMode === 'HEADER_DISCOUNT' && computedDiscount > 0 && (
                <div>
                  <span className="text-rose-400 block text-[11px]">表頭專案折讓</span>
                  <span className="font-mono tabular-nums font-bold text-base text-rose-300">
                    - NT$ {computedDiscount.toLocaleString()}
                  </span>
                </div>
              )}

              <div>
                <span className="text-slate-400 block text-[11px]">應稅淨額 (未稅)</span>
                <span className="font-mono tabular-nums font-bold text-base text-slate-200">
                  NT$ {computedNetAmount.toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">營業稅 (5%)</span>
                <span className="font-mono tabular-nums font-bold text-base text-slate-200">
                  NT$ {computedTax.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-amber-400 text-xs font-bold block">
                {pricingMode === 'SHADOW_ALLOCATION' ? '約定成交總計 (含稅)' : '報價總金額 (含稅)'}
              </span>
              <span className="text-2xl font-mono tabular-nums font-black text-white tracking-tight">
                NT$ {computedTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 底部按鈕控制區 */}
        <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>幽靈小數已洗滌抹平 • 嚴格落實正數存儲防弊憲法</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('DRAFT')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>儲存為草稿 (Draft-First)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('ACCEPTED')}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>核准定案 (轉為正式合約)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 列印預覽彈窗 */}
      <QuotationPrintPreviewModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        quotation={{
          id: quotation?.id || '',
          quoteNumber: formData.quoteNumber || 'QUO-2026-001',
          projectId: formData.projectId || '',
          customerId: formData.customerId || '',
          customerName: formData.customerName || '',
          companyId: formData.companyId || '',
          currency: formData.currency || 'TWD',
          pricingMode,
          customDiscountText: formData.customDiscountText,
          agreedTotalAmount: formData.agreedTotalAmount,
          netAmount: computedNetAmount,
          taxAmount: computedTax,
          totalAmount: computedTotal,
          discountAmount: computedDiscount,
          currentRevision: formData.currentRevision || 'REV-A',
          status: (formData.status as Quotation['status']) || 'DRAFT',
          validityDate: formData.validityDate || '',
          isDeleted: false,
          version: 1,
          createdAt: quotation?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }}
        items={items}
        milestones={milestones}
        company={selectedCompany}
        customer={selectedCustomer}
        project={selectedProject}
      />
    </div>
  );
};
