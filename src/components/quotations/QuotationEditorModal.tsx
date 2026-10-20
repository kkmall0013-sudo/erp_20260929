import React, { useState, useEffect } from 'react';
import {
  Quotation,
  QuotationItem,
  QuotationBillingMilestone,
  QuotationRevision,
  QuotationPricingMode,
  Company,
  BusinessPartner,
  Project
} from '../../types/erp';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Clock,
  Printer,
  Copy,
  AlertTriangle,
  HelpCircle,
  Percent,
  Calculator,
  ArrowRight,
  ShieldAlert,
  Sliders,
  DollarSign,
  TrendingDown,
  Layers,
  Search,
  Sparkles,
  Paperclip
} from 'lucide-react';
import { TaiwanIdTaxValidatorWidget } from '../widgets/TaiwanIdTaxValidatorWidget';
import { QuotationPrintPreviewModal } from './QuotationPrintPreviewModal';
import { AttachmentUploader } from '../attachments/AttachmentUploader';
import { previewNextDocumentNumber, getNextDocumentNumber } from '../../db/sqlite';

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
  if (!isOpen) return null;

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

  // 2. 明細清單
  const [items, setItems] = useState<QuotationItem[]>([]);
  // 3. 里程碑清單
  const [milestones, setMilestones] = useState<QuotationBillingMilestone[]>([]);
  // 4. 列印預覽彈窗
  const [showPrintModal, setShowPrintModal] = useState(false);
  // 5. 尾差警示狀態
  const [gapWarning, setGapWarning] = useState<number | null>(null);
  // 6. 頁籤切換：工項明細 vs 里程碑請款 vs 附件圖說
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'MILESTONES' | 'ATTACHMENTS' | 'VERSIONS'>('ITEMS');

  // 初始化載入既有項目或預設工程明細
  useEffect(() => {
    if (quotation) {
      setFormData({ ...quotation });
    } else {
      setFormData(prev => ({
        ...prev,
        quoteNumber: previewNextDocumentNumber('QUO'),
      }));
      // 全新預設三筆工程工項
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
        }
      ]);

      setMilestones([
        { id: crypto.randomUUID(), quotationId: '', stageIndex: 1, stageName: '簽約訂金款', percentage: 30, amount: 0 },
        { id: crypto.randomUUID(), quotationId: '', stageIndex: 2, stageName: '結構體完成款', percentage: 40, amount: 0 },
        { id: crypto.randomUUID(), quotationId: '', stageIndex: 3, stageName: '泥作粉刷驗收款', percentage: 20, amount: 0 },
        { id: crypto.randomUUID(), quotationId: '', stageIndex: 4, stageName: '完工保固款', percentage: 10, amount: 0 },
      ]);
    }
  }, [quotation]);

  // 同步客戶名稱
  const handleCustomerChange = (cid: string) => {
    const cust = customers.find(c => c.id === cid);
    setFormData(prev => ({
      ...prev,
      customerId: cid,
      customerName: cust ? cust.name : prev.customerName,
    }));
  };

  // 即時計算金額四柱
  // 1. 得標工項合計 (扣減項以正數輸入，但在總計中扣除)
  const awardedItems = items.filter(it => it.isAwarded !== false);
  const rawSubtotal = awardedItems.reduce((acc, it) => {
    const lineVal = Math.round((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0));
    if (it.itemType === 'DEDUCTION') {
      return acc - lineVal;
    }
    return acc + lineVal;
  }, 0);

  // 依議價模式計算未稅淨額 (netAmount)
  const pricingMode = (formData.pricingMode || 'HEADER_DISCOUNT') as QuotationPricingMode;
  let computedNetAmount = rawSubtotal;
  let computedDiscount = Number(formData.discountAmount || 0);

  if (pricingMode === 'HEADER_DISCOUNT') {
    computedNetAmount = Math.max(0, rawSubtotal - computedDiscount);
  } else if (pricingMode === 'UNIT_PRICE_ADJUSTMENT') {
    computedNetAmount = rawSubtotal; // 單價已微調在明細中
    computedDiscount = 0;
  } else if (pricingMode === 'SHADOW_ALLOCATION') {
    // 若有自訂協議含稅總價，反推未稅
    if (formData.agreedTotalAmount && formData.agreedTotalAmount > 0) {
      computedNetAmount = Math.round(formData.agreedTotalAmount / 1.05);
    }
  }

  // 幽靈小數洗滌：全域四捨五入為整數
  const taxRate = 0.05;
  const computedTax = Math.round(computedNetAmount * taxRate);
  const computedTotal = pricingMode === 'SHADOW_ALLOCATION' && formData.agreedTotalAmount
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

  // 工項明細增刪改
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

  // 軌道二：自動反推單價平滑演算法 (Smart Unit Price Resolver)
  const handleAutoAdjustUnitPrices = () => {
    const targetNet = prompt('請輸入期望之未稅目標淨額 (例如: 550,000)：');
    if (!targetNet || isNaN(Number(targetNet))) return;
    const targetNetNum = Math.round(Number(targetNet));

    const standardItems = items.filter(it => it.itemType !== 'DEDUCTION' && it.isAwarded !== false);
    if (!standardItems.length) return;

    const currentStandardSum = standardItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
    if (currentStandardSum <= 0) return;

    // 計算折讓係數
    const ratio = targetNetNum / currentStandardSum;

    // 平滑調整各項單價（最多 2 位小數）
    setItems(prev =>
      prev.map(it => {
        if (it.itemType === 'DEDUCTION' || it.isAwarded === false) return it;
        const newUnitPrice = Number((it.unitPrice * ratio).toFixed(2));
        const newLineTotal = Math.round(it.quantity * newUnitPrice);
        return {
          ...it,
          unitPrice: newUnitPrice,
          lineTotal: newLineTotal,
        };
      })
    );

    // 切換至軌道二模式
    setFormData(prev => ({
      ...prev,
      pricingMode: 'UNIT_PRICE_ADJUSTMENT',
      discountAmount: 0,
    }));
  };

  // 儲存送出驗證
  const handleSubmit = (targetStatus: Quotation['status'] = 'DRAFT') => {
    // 幽靈小數與數學防呆
    if (items.length === 0) {
      alert('⚠️ 報價單必須包含至少一筆工項明細！');
      return;
    }

    // 檢查未得標項目是否有填寫原因
    const unawardedWithoutReason = items.find(it => it.isAwarded === false && (!it.lostReason || it.lostReason.trim() === ''));
    if (unawardedWithoutReason) {
      alert(`⚠️ 項目【${unawardedWithoutReason.itemName}】標記為未得標，依 Rule 4.1 必須填寫「失標原因」！`);
      return;
    }

    // 里程碑請款總和必須為 100%
    const totalPercentage = milestones.reduce((acc, m) => acc + Number(m.percentage || 0), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      alert(`⚠️ 請款里程碑比例總和為 ${totalPercentage}%，必須剛好等於 100%！`);
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
      pricingMode: pricingMode,
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
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                  formData.status === 'ACCEPTED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
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
              onClick={() => setShowPrintModal(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>列印預覽</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              關閉
            </button>
          </div>
        </div>

        {/* 核心工作內容區 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          {/* A. 三軌議價模式切換器 (Triple-Track Mode Switcher) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>三軌並行議價控制樞紐 (Sales Negotiation Track)</span>
              </span>
              <span className="text-[11px] text-slate-400">
                依業主談判心理與驗算習慣，即時切換出單模式
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 軌道一：表頭折讓流 */}
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, pricingMode: 'HEADER_DISCOUNT' }))}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  pricingMode === 'HEADER_DISCOUNT'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-indigo-950 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5 text-indigo-600" />
                    <span>軌道一：表頭折讓流</span>
                  </span>
                  {pricingMode === 'HEADER_DISCOUNT' && (
                    <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded font-bold">
                      當前啟用
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  工項明細維持原價，紙本報價單最下方印出「協議折讓：-X 元」。適合喜歡看自己砍了多少價的業主。
                </p>
              </button>

              {/* 軌道二：單價微調流 */}
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, pricingMode: 'UNIT_PRICE_ADJUSTMENT' }))}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  pricingMode === 'UNIT_PRICE_ADJUSTMENT'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-indigo-950 flex items-center gap-1">
                    <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                    <span>軌道二：單價微調流</span>
                  </span>
                  {pricingMode === 'UNIT_PRICE_ADJUSTMENT' && (
                    <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded font-bold">
                      當前啟用
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  反推並改寫各工項單價，紙本完全不出現折讓字眼。適合要求每行乘積與總價絕對吻合之嚴謹業主。
                </p>
              </button>

              {/* 軌道三：影子均攤流 */}
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, pricingMode: 'SHADOW_ALLOCATION' }))}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  pricingMode === 'SHADOW_ALLOCATION'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-indigo-950 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>軌道三：影子協議備註流</span>
                  </span>
                  {pricingMode === 'SHADOW_ALLOCATION' && (
                    <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded font-bold">
                      當前啟用
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  明細與總計維持原價，於下方備註印出「協議總價」。適合現場常見的總價發包、不改明細快速成交情境。
                </p>
              </button>
            </div>

            {/* 軌道特殊設定輸入 */}
            {pricingMode === 'HEADER_DISCOUNT' && (
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700">表頭折讓優惠金額 (折讓金)：</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono font-bold text-slate-500">NT$</span>
                  <input
                    type="number"
                    min="0"
                    value={formData.discountAmount || 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountAmount: Math.max(0, Number(e.target.value)) }))}
                    className="w-36 px-2.5 py-1 rounded border border-slate-300 text-xs font-mono font-bold text-rose-600 focus:ring-1 focus:ring-indigo-500 outline-none"
                    placeholder="輸入折讓額"
                  />
                </div>
                <span className="text-[11px] text-slate-400">
                  折讓後應稅淨額：NT$ {computedNetAmount.toLocaleString()}
                </span>
              </div>
            )}

            {pricingMode === 'UNIT_PRICE_ADJUSTMENT' && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-600">
                  目前各工項乘積加總淨額為：<strong className="font-mono text-slate-900">NT$ {rawSubtotal.toLocaleString()}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleAutoAdjustUnitPrices}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>自動目標總價均攤小幫手</span>
                </button>
              </div>
            )}

            {pricingMode === 'SHADOW_ALLOCATION' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">約定含稅總成交金額 (NTD)：</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.agreedTotalAmount || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, agreedTotalAmount: Number(e.target.value) }))}
                    placeholder="例如 150000"
                    className="w-full px-3 py-1.5 rounded border border-slate-300 text-xs font-mono font-bold text-indigo-700 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">紙本印出協議備註文字：</label>
                  <input
                    type="text"
                    value={formData.customDiscountText || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, customDiscountText: e.target.value }))}
                    placeholder="經雙方協議同意以 150,000 承製"
                    className="w-full px-3 py-1.5 rounded border border-slate-300 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

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
                    <option key={c.id} value={c.id}>{c.name} ({c.companyCode})</option>
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
                    <option key={c.id} value={c.id}>{c.name} ({c.taxId || '無統編'})</option>
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
                    <option key={p.id} value={p.id}>{p.name} ({p.projectCode})</option>
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
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 text-slate-800 font-bold"
                >
                  <option value="DRAFT">DRAFT (草稿中)</option>
                  <option value="SENT">SENT (已送出給業主)</option>
                  <option value="ACCEPTED">ACCEPTED (已成交簽署)</option>
                  <option value="REJECTED">REJECTED (未得標/失標)</option>
                  <option value="SUPERSEDED">SUPERSEDED (已由新版取代)</option>
                </select>
              </div>

              <div className="flex items-end">
                {quotation && onDeepCopyRevision && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextRev = prompt('請輸入新版次代碼 (如 REV-B, REV-C 或 V_FINAL 決選版)：', 'REV-B');
                      if (nextRev) {
                        onDeepCopyRevision(quotation.id, nextRev);
                        onClose();
                      }
                    }}
                    className="w-full px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>深拷貝產出新版次 (Deep Copy)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* C. 中間功能頁籤導航 */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('ITEMS')}
              className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
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
              className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
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
              className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
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
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
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

          {/* D. 頁籤內容一：工項明細清單 (支援粉紅扣款折讓與部分得標) */}
          {activeTab === 'ITEMS' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">工項明細表</span>
                  <span className="text-[11px] text-slate-500">
                    支援【標準加項】與【粉紅扣款折讓】雙軌輸入，減項強制以正數存儲防弊
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddItem('NORMAL')}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增標準加項</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddItem('DEDUCTION')}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增折讓扣減項 (Pink UI)</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-12">得標</th>
                      <th className="py-2.5 px-3 text-left w-24">工項類型</th>
                      <th className="py-2.5 px-3 text-left">工項名稱</th>
                      <th className="py-2.5 px-3 text-left w-48">施工規格說明</th>
                      <th className="py-2.5 px-2 text-right w-20">數量</th>
                      <th className="py-2.5 px-2 text-center w-16">單位</th>
                      <th className="py-2.5 px-2 text-right w-24">單價 (元)</th>
                      <th className="py-2.5 px-2 text-right w-28">複價金額</th>
                      <th className="py-2.5 px-2 text-center w-12">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item, idx) => {
                      const isDeduction = item.itemType === 'DEDUCTION';
                      const isAwarded = item.isAwarded !== false;

                      return (
                        <tr
                          key={item.id || idx}
                          className={`transition-colors ${
                            !isAwarded
                              ? 'bg-slate-100 text-slate-400 line-through'
                              : isDeduction
                              ? 'bg-rose-50/70 hover:bg-rose-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          {/* 部分得標開關 (Rule 4.1) */}
                          <td className="py-2 px-3 text-center no-underline">
                            <input
                              type="checkbox"
                              checked={isAwarded}
                              onChange={(e) => handleUpdateItem(idx, 'isAwarded', e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                              title="得標開關：取消後移入未得標歷史，不參與金額總計"
                            />
                          </td>

                          {/* 類型切換 */}
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isDeduction
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isDeduction ? '扣減折讓' : '標準施工'}
                            </span>
                          </td>

                          {/* 工項名稱 */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.itemName}
                              onChange={(e) => handleUpdateItem(idx, 'itemName', e.target.value)}
                              placeholder="請輸入工項名稱"
                              className={`w-full px-2 py-1 rounded border text-xs font-bold outline-none ${
                                isDeduction
                                  ? 'border-rose-300 bg-white text-rose-900 focus:ring-1 focus:ring-rose-500'
                                  : 'border-slate-300 text-slate-800 focus:ring-1 focus:ring-indigo-500'
                              }`}
                            />
                            {!isAwarded && (
                              <input
                                type="text"
                                value={item.lostReason || ''}
                                onChange={(e) => handleUpdateItem(idx, 'lostReason', e.target.value)}
                                placeholder="請輸入失標原因 (如：業主砍項)"
                                className="w-full mt-1 px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-[11px] text-amber-900 outline-none"
                              />
                            )}
                          </td>

                          {/* 施工規格 */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.spec || ''}
                              onChange={(e) => handleUpdateItem(idx, 'spec', e.target.value)}
                              placeholder="規範/工法/品牌"
                              className="w-full px-2 py-1 rounded border border-slate-300 text-xs text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>

                          {/* 數量 */}
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                              className="w-16 px-2 py-1 rounded border border-slate-300 font-mono text-right text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>

                          {/* 單位 */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                              className="w-12 px-1 py-1 rounded border border-slate-300 text-center text-xs outline-none"
                            />
                          </td>

                          {/* 單價 */}
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateItem(idx, 'unitPrice', e.target.value)}
                              className={`w-20 px-2 py-1 rounded border font-mono text-right text-xs outline-none ${
                                isDeduction
                                  ? 'border-rose-300 text-rose-700 bg-white font-bold'
                                  : 'border-slate-300 text-slate-900'
                              }`}
                            />
                          </td>

                          {/* 複價金額 */}
                          <td className={`py-2 px-2 text-right font-mono font-bold ${isDeduction ? 'text-rose-600' : 'text-slate-900'}`}>
                            {isDeduction ? `- ${Math.round(item.quantity * item.unitPrice).toLocaleString()}` : Math.round(item.quantity * item.unitPrice).toLocaleString()}
                          </td>

                          {/* 刪除操作 */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(idx)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                              title="刪除工項"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* E. 頁籤內容二：請款里程碑 (總和 100%) */}
          {activeTab === 'MILESTONES' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">工程合約請款里程碑分期比例</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    請款比例總和必須嚴格等於 100%，系統自動依含稅總額試算每期應領金額
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newStage: QuotationBillingMilestone = {
                      id: crypto.randomUUID(),
                      quotationId: quotation?.id || '',
                      stageIndex: milestones.length + 1,
                      stageName: `第 ${milestones.length + 1} 期工程款`,
                      percentage: 10,
                      amount: 0,
                    };
                    setMilestones(prev => [...prev, newStage]);
                  }}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>新增請款階段</span>
                </button>
              </div>

              <div className="space-y-2">
                {milestones.map((ms, idx) => (
                  <div key={ms.id || idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <span className="font-mono font-bold text-slate-500 w-6 text-center">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={ms.stageName}
                      onChange={(e) => {
                        const copy = [...milestones];
                        copy[idx].stageName = e.target.value;
                        setMilestones(copy);
                      }}
                      className="flex-1 px-3 py-1.5 rounded border border-slate-300 font-bold text-slate-800 bg-white"
                      placeholder="階段名稱"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={ms.percentage}
                        onChange={(e) => {
                          const copy = [...milestones];
                          copy[idx].percentage = Number(e.target.value);
                          setMilestones(copy);
                        }}
                        className="w-16 px-2 py-1.5 rounded border border-slate-300 font-mono font-bold text-right text-indigo-700 bg-white"
                      />
                      <span className="text-slate-500 font-bold">%</span>
                    </div>

                    <div className="w-36 text-right font-mono font-bold text-slate-800">
                      NT$ {ms.amount.toLocaleString()}
                    </div>

                    <button
                      type="button"
                      onClick={() => setMilestones(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-700">
                  目前比例加總：
                  <span className={`font-mono text-sm ml-1 ${
                    Math.abs(milestones.reduce((acc, m) => acc + Number(m.percentage || 0), 0) - 100) < 0.01
                      ? 'text-emerald-600 font-bold'
                      : 'text-rose-600 font-bold'
                  }`}>
                    {milestones.reduce((acc, m) => acc + Number(m.percentage || 0), 0)}%
                  </span>
                </span>
                <span className="text-xs text-slate-500">
                  必須恰好為 100% 才能定案生效
                </span>
              </div>
            </div>
          )}

          {/* F. 頁籤內容三：無紙化附件金庫 (調用 Phase 9 通用 AttachmentUploader) */}
          {activeTab === 'ATTACHMENTS' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-indigo-600" />
                  <span>報價單專屬圖說與施工圖面附件 (Universal Vault - Phase 9)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  支援上傳 CAD 施工圖面、現場會勘照片與業主需求規範書，內建 WebP 自動壓縮與 PDF 在線預覽
                </p>
              </div>

              <AttachmentUploader
                targetTable="quotations"
                targetId={quotation?.id || 'NEW_QUOTATION'}
                title="報價單專屬關聯附件與施工圖說"
                defaultCategory="工程圖說"
              />
            </div>
          )}

          {/* G. 頁籤內容四：版本歷程抽屜 */}
          {activeTab === 'VERSIONS' && revisions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-slate-900">報價單深拷貝版次演進歷程 (Version History)</h3>
              <div className="space-y-3">
                {revisions.map((rev) => (
                  <div key={rev.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs">
                          {rev.revisionCode}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {rev.isWinning ? '決選得標版' : '歷史修訂版'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        建立時間：{rev.createdAt ? rev.createdAt.substring(0, 19).replace('T', ' ') : '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-900 text-sm">
                        NT$ {rev.totalAmount.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {rev.pricingMode === 'HEADER_DISCOUNT' && '表頭折讓流'}
                        {rev.pricingMode === 'UNIT_PRICE_ADJUSTMENT' && '單價微調流'}
                        {rev.pricingMode === 'SHADOW_ALLOCATION' && '影子協議流'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* H. 金額統計卡 (財務四柱平衡檢核) */}
          <div className="bg-slate-900 text-white p-5 rounded-xl flex flex-wrap items-center justify-between gap-6 shadow-md">
            <div className="flex flex-wrap items-center gap-8 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">得標明細小計</span>
                <span className="font-mono font-bold text-base text-slate-200">
                  NT$ {rawSubtotal.toLocaleString()}
                </span>
              </div>

              {pricingMode === 'HEADER_DISCOUNT' && computedDiscount > 0 && (
                <div>
                  <span className="text-rose-400 block text-[11px]">表頭專案折讓</span>
                  <span className="font-mono font-bold text-base text-rose-300">
                    - NT$ {computedDiscount.toLocaleString()}
                  </span>
                </div>
              )}

              <div>
                <span className="text-slate-400 block text-[11px]">應稅淨額 (未稅)</span>
                <span className="font-mono font-bold text-base text-slate-200">
                  NT$ {computedNetAmount.toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">營業稅 (5%)</span>
                <span className="font-mono font-bold text-base text-slate-200">
                  NT$ {computedTax.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-amber-400 text-xs font-bold block">
                {pricingMode === 'SHADOW_ALLOCATION' ? '約定成交總計 (含稅)' : '報價總金額 (含稅)'}
              </span>
              <span className="text-2xl font-mono font-black text-white tracking-tight">
                NT$ {computedTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 底部按鈕控制區 */}
        <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
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
          pricingMode: pricingMode,
          customDiscountText: formData.customDiscountText,
          agreedTotalAmount: formData.agreedTotalAmount,
          netAmount: computedNetAmount,
          taxAmount: computedTax,
          totalAmount: computedTotal,
          discountAmount: computedDiscount,
          currentRevision: formData.currentRevision || 'REV-A',
          status: formData.status as any || 'DRAFT',
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
