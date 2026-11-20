// src/components/finance/ProjectLedgerAndStatementModal.tsx
// 📊 工程案場雙軌核心：對內借貸總帳 (預收直入+分批補開發票) ＆ 對外客戶請款明細總表

import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  X,
  Wallet,
  CheckCircle2,
  Receipt,
} from 'lucide-react';
import {
  AccountReceivable,
  ArCollectionRecord,
  Company,
  CompanyBankAccount,
  Invoice,
  Project,
  ProjectAdvanceReceipt,
} from '../../types/erp';
import {
  createProjectAdvance,
  issueInvoiceForExistingAr,
  issueInvoiceForProject,
} from '../../db/sqlite';
import { CustomerStatementMiniApp } from './CustomerStatementMiniApp';

interface ProjectLedgerAndStatementModalProps {
  project: Project;
  arList: AccountReceivable[];
  arCollections: ArCollectionRecord[];
  projectAdvances: ProjectAdvanceReceipt[];
  invoices: Invoice[];
  companies: Company[];
  bankAccounts: CompanyBankAccount[];
  taxRate: number;
  canEditAr: boolean;
  canEditCashier: boolean;
  operatorName: string;
  initialTab?: 'LEDGER' | 'STATEMENT';
  initialFocusArId?: string;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onRefresh: () => void;
}

export const ProjectLedgerAndStatementModal: React.FC<ProjectLedgerAndStatementModalProps> = ({
  project,
  arList,
  arCollections,
  projectAdvances,
  invoices,
  companies,
  bankAccounts,
  taxRate,
  canEditAr,
  canEditCashier,
  operatorName,
  initialTab = 'LEDGER',
  initialFocusArId,
  onClose,
  onNotify,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'STATEMENT'>(initialTab);

  // Project-scoped records
  const projArs = useMemo(
    () => arList.filter(a => a.projectId === project.id && a.status !== 'VOIDED'),
    [arList, project.id]
  );
  const projArIds = useMemo(() => new Set(projArs.map(a => a.id)), [projArs]);
  const projCollections = useMemo(
    () => arCollections.filter(c => projArIds.has(c.arId) && c.status !== 'VOIDED'),
    [arCollections, projArIds]
  );
  const projAdvances = useMemo(
    () => projectAdvances.filter(a => a.projectId === project.id),
    [projectAdvances, project.id]
  );
  const projOutputInvoices = useMemo(
    () =>
      invoices.filter(
        inv =>
          inv.invoiceType === 'OUTPUT' &&
          inv.status === 'VALID' &&
          (inv.linkedProjectId === project.id || (inv.linkedArId && projArIds.has(inv.linkedArId)))
      ),
    [invoices, project.id, projArIds]
  );

  // KPI calculations (Internal)
  const kpi = useMemo(() => {
    const contractTotal = Number(project.contractAmount || 0);
    const totalBilled = projArs.reduce((s, a) => s + a.amount, 0);
    const totalFromCollections = projCollections.reduce((s, c) => s + c.amount, 0);
    const totalFromAdvances = projAdvances.reduce((s, a) => s + a.amount, 0);
    const totalCollected = totalFromCollections + totalFromAdvances;
    const totalRemainingToCollect = Math.max(0, totalBilled - totalFromCollections - totalFromAdvances);
    const totalInvoiced = projOutputInvoices.reduce((s, inv) => s + inv.totalAmount, 0);
    const uninvoicedCollectedCapacity = Math.max(0, Math.max(totalCollected, totalBilled) - totalInvoiced);
    return {
      contractTotal,
      totalBilled,
      totalCollected,
      totalRemainingToCollect,
      totalInvoiced,
      uninvoicedCollectedCapacity,
    };
  }, [project.contractAmount, projArs, projCollections, projAdvances, projOutputInvoices]);

  // Chronological internal ledger entries
  const ledgerRows = useMemo(() => {
    const rows: {
      id: string;
      date: string;
      kind: 'AR' | 'COLLECTION' | 'ADVANCE' | 'INVOICE';
      title: string;
      detail: string;
      debit: number;
      credit: number;
      badge: string;
      badgeTone: string;
    }[] = [];

    for (const ar of projArs) {
      rows.push({
        id: `AR-${ar.id}`,
        date: ar.invoiceDate || ar.createdAt?.slice(0, 10) || ar.dueDate,
        kind: 'AR',
        title: `${ar.arNumber} · ${ar.title || '工程請款單'}`,
        detail: `${ar.hasInvoice !== false ? `開票 ${ar.invoiceNumber || '(待補)'}` : '免開發票請款'} · 未收餘 NT$ ${ar.remainingAmount.toLocaleString()}`,
        debit: ar.amount,
        credit: 0,
        badge: '應收請款 (借方)',
        badgeTone: 'bg-blue-100 text-blue-800',
      });
    }

    for (const col of projCollections) {
      const mLabel = col.collectionMethod === 'CHECK' ? `支票 ${col.checkNumber || ''}` : col.collectionMethod === 'TT' ? '轉帳' : col.collectionMethod === 'SUSPENSE' ? '暫收認領' : '現金';
      rows.push({
        id: `COL-${col.id}`,
        date: col.receivedDate,
        kind: 'COLLECTION',
        title: `實收貨款 (${mLabel}) · ${col.arNumber || ''}`,
        detail: `入帳帳戶：${col.bankAccountName || col.bankAccountId}${col.feeAmount > 0 ? ` · 扣匯費/折讓 $${col.feeAmount.toLocaleString()}` : ''}`,
        debit: 0,
        credit: col.amount,
        badge: '實收款 (貸方)',
        badgeTone: 'bg-emerald-100 text-emerald-800',
      });
    }

    for (const adv of projAdvances) {
      const srcLabel = adv.sourceType === 'EARLY_LOAN' ? '銀行貸款先撥款' : adv.sourceType === 'DEPOSIT' ? '預付訂金' : '超付溢收直入';
      rows.push({
        id: `ADV-${adv.id}`,
        date: adv.receivedDate,
        kind: 'ADVANCE',
        title: `${srcLabel}（直入本案場帳）`,
        detail: `入帳帳戶：${adv.bankAccountName || adv.bankAccountId}${adv.notes ? ` · ${adv.notes}` : ''}`,
        debit: 0,
        credit: adv.amount,
        badge: '案場預收 (貸方)',
        badgeTone: 'bg-teal-100 text-teal-800',
      });
    }

    for (const inv of projOutputInvoices) {
      const isSelf = inv.invoiceIssueMode === 'SELF_RETAINED';
      rows.push({
        id: `INV-${inv.id}`,
        date: inv.invoiceDate,
        kind: 'INVOICE',
        title: `銷項發票 [${inv.invoiceNumber}] (${inv.invoiceFormat === 'TWO_PART' ? '二聯' : '三聯'})`,
        detail: `未稅 $${inv.netAmount.toLocaleString()} ＋ 稅 $${inv.taxAmount.toLocaleString()} ＝ $${inv.totalAmount.toLocaleString()}${inv.notes ? ` · ${inv.notes}` : ''}`,
        debit: 0,
        credit: 0,
        badge: isSelf ? '自主留存報稅 (公司自理)' : '交付業主發票',
        badgeTone: isSelf ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800',
      });
    }

    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [projArs, projCollections, projAdvances, projOutputInvoices]);

  // ------------------------------------------------------------------
  // TAB 1 INLINE ACTION 1: Direct Project Advance Form (預收／銀行貸款)
  // ------------------------------------------------------------------
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [advMethod, setAdvMethod] = useState<'TT' | 'CHECK' | 'CASH'>('TT');
  const [advBankId, setAdvBankId] = useState<string>(() => {
    const active = bankAccounts.filter(b => b.status === 'ACTIVE');
    return (
      active.find(b => b.companyId === project.companyId)?.id ||
      active[0]?.id ||
      'CASH'
    );
  });
  const [advSourceType, setAdvSourceType] = useState<'EARLY_LOAN' | 'DEPOSIT' | 'OVERPAYMENT'>('EARLY_LOAN');
  const [advAmount, setAdvAmount] = useState('');
  const [advDate, setAdvDate] = useState(new Date().toISOString().slice(0, 10));
  const [advCheckNo, setAdvCheckNo] = useState('');
  const [advCheckDue, setAdvCheckDue] = useState(new Date().toISOString().slice(0, 10));
  const [advNotes, setAdvNotes] = useState('');

  const eligibleAdvanceBanks = useMemo(
    () =>
      bankAccounts.filter(
        b =>
          b.status === 'ACTIVE' &&
          (b.isVirtualAccount ||
            b.companyId === 'BOSS-01' ||
            !project.companyId ||
            project.companyId === 'UNASSIGNED' ||
            b.companyId === project.companyId)
      ),
    [bankAccounts, project.companyId]
  );

  const handleCreateAdvance = () => {
    const num = Math.max(0, Number(advAmount || 0));
    if (num <= 0) {
      onNotify('請輸入大於 0 的預收金額', 'warn');
      return;
    }
    try {
      createProjectAdvance(
        {
          projectId: project.id,
          projectName: project.name,
          customerName: project.ownerName || '案場業主',
          companyId: (project.companyId && project.companyId !== 'UNASSIGNED' ? project.companyId : companies[0]?.id) || 'COMP-01',
          bankAccountId: advMethod === 'CASH' ? 'CASH' : advBankId,
          collectionMethod: advMethod,
          amount: num,
          receivedDate: advDate,
          sourceType: advSourceType,
          checkNumber: advMethod === 'CHECK' ? advCheckNo : undefined,
          checkDueDate: advMethod === 'CHECK' ? advCheckDue : undefined,
          notes: advNotes.trim() || undefined,
        },
        operatorName
      );
      setShowAdvanceForm(false);
      setAdvAmount('');
      setAdvNotes('');
      onRefresh();
      onNotify(`✅ 已將預收／貸款撥款 NT$ ${num.toLocaleString()} 直接掛入「${project.name}」案場總帳！`, 'success');
    } catch (e: any) {
      onNotify(`登錄預收失敗：${e.message}`, 'error');
    }
  };

  // ------------------------------------------------------------------
  // TAB 1 INLINE ACTION 2: Partial / Multi-batch / Self-retained Invoice
  // ------------------------------------------------------------------
  const [showPostInvForm, setShowPostInvForm] = useState(false);
  const [piTargetArId, setPiTargetArId] = useState<string>(initialFocusArId || '');
  const [piCompanyId, setPiCompanyId] = useState<string>(
    (project.companyId && project.companyId !== 'UNASSIGNED' ? project.companyId : companies[0]?.id) || 'COMP-01'
  );
  const [piMode, setPiMode] = useState<'DELIVERED' | 'SELF_RETAINED'>('SELF_RETAINED');
  const [piFormat, setPiFormat] = useState<'THREE_PART' | 'TWO_PART'>(
    /^\d{8}$/.test((project.ownerTaxId || '').trim()) ? 'THREE_PART' : 'TWO_PART'
  );
  const [piTaxMode, setPiTaxMode] = useState<'TAX_INCLUSIVE' | 'TAX_EXCLUSIVE'>('TAX_INCLUSIVE');
  const [piAmount, setPiAmount] = useState('');
  const [piNumber, setPiNumber] = useState('');
  const [piDate, setPiDate] = useState(new Date().toISOString().slice(0, 10));
  const [piCreateExtraTaxAr, setPiCreateExtraTaxAr] = useState(false);

  const piCalc = useMemo(() => {
    const base = Math.max(0, Number(piAmount || 0));
    if (piMode === 'SELF_RETAINED' || piTaxMode === 'TAX_INCLUSIVE') {
      const tax = Math.round(base - base / (1 + taxRate));
      return { net: Math.max(0, base - tax), tax, total: base };
    }
    const tax = Math.round(base * taxRate);
    return { net: base, tax, total: base + tax };
  }, [piAmount, piMode, piTaxMode, taxRate]);

  const handleConfirmProjectInvoice = () => {
    if (!piNumber.trim()) {
      onNotify('請填入發票字軌號碼', 'warn');
      return;
    }
    if (piCalc.total <= 0) {
      onNotify('請填入大於 0 的開票金額', 'warn');
      return;
    }
    try {
      let extraTaxAr: AccountReceivable | null = null;
      if (piTargetArId) {
        const targetAr = projArs.find(a => a.id === piTargetArId);
        extraTaxAr = issueInvoiceForExistingAr(
          {
            arId: piTargetArId,
            invoiceFormat: piFormat,
            invoiceIssueMode: piMode,
            invoiceNumber: piNumber.trim().toUpperCase(),
            invoiceDate: piDate,
            netAmount: piCalc.net,
            taxAmount: piCalc.tax,
            totalAmount: piCalc.total,
            updateArTotalIfUncollected: Boolean(
              piMode === 'DELIVERED' && targetAr && targetAr.appliedAmount === 0 && piTaxMode === 'TAX_EXCLUSIVE'
            ),
            createExtraTaxReceivable: piMode === 'DELIVERED' && piCreateExtraTaxAr,
            companyId: piCompanyId,
            customerTaxId: project.ownerTaxId || undefined,
          },
          operatorName
        );
      } else {
        extraTaxAr = issueInvoiceForProject(
          {
            projectId: project.id,
            companyId: piCompanyId,
            customerName: project.ownerName || '案場業主',
            customerTaxId: project.ownerTaxId || undefined,
            invoiceFormat: piFormat,
            invoiceIssueMode: piMode,
            invoiceNumber: piNumber.trim().toUpperCase(),
            invoiceDate: piDate,
            netAmount: piCalc.net,
            taxAmount: piCalc.tax,
            totalAmount: piCalc.total,
            createExtraTaxReceivable: piMode === 'DELIVERED' && piCreateExtraTaxAr,
          },
          operatorName
        );
      }
      setShowPostInvForm(false);
      setPiNumber('');
      setPiAmount('');
      onRefresh();
      onNotify(
        extraTaxAr
          ? `✅ 已開立發票 [${piNumber.trim().toUpperCase()}] 並同步產生 5% 稅金補收單 [${extraTaxAr.arNumber}] (NT$ ${extraTaxAr.amount.toLocaleString()})！`
          : `✅ 已完成分批開立發票 [${piNumber.trim().toUpperCase()}]（NT$ ${piCalc.total.toLocaleString()}）寫入發票主檔！`,
        'success'
      );
    } catch (e: any) {
      onNotify(`開立發票失敗：${e.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs print:bg-white print:p-0 print:static">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-xs print:shadow-none print:border-0 print:max-h-none print:rounded-none">
        {/* Header (hidden on print) */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-800">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                [{project.projectCode}] {project.name} · 雙軌對帳總表
              </h3>
              <p className="text-[11px] text-slate-500">
                業主：{project.ownerName || '未建檔'} · 合約總額：NT$ {Number(project.contractAmount || 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('LEDGER')}
                className={`px-3 py-1 rounded-md font-bold cursor-pointer ${
                  activeTab === 'LEDGER' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                }`}
              >
                對內：借貸總帳與補開發票
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('STATEMENT')}
                className={`px-3 py-1 rounded-md font-bold cursor-pointer ${
                  activeTab === 'STATEMENT' ? 'bg-emerald-600 text-white' : 'text-slate-600'
                }`}
              >
                對外：客戶請款／對帳明細表
              </button>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 print:overflow-visible print:p-6">
          {activeTab === 'LEDGER' ? (
            <div className="space-y-4">
              {/* Top 5 Internal KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500">簽約合約總額</div>
                  <div className="text-base font-mono font-black text-slate-900 mt-0.5">
                    NT$ {kpi.contractTotal.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                  <div className="text-[10px] font-bold text-blue-800">累計請款額 (借方)</div>
                  <div className="text-base font-mono font-black text-blue-900 mt-0.5">
                    NT$ {kpi.totalBilled.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <div className="text-[10px] font-bold text-emerald-800">累計實收+預收 (貸方)</div>
                  <div className="text-base font-mono font-black text-emerald-900 mt-0.5">
                    NT$ {kpi.totalCollected.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
                  <div className="text-[10px] font-bold text-rose-800">已請款尚餘未收</div>
                  <div className="text-base font-mono font-black text-rose-800 mt-0.5">
                    NT$ {kpi.totalRemainingToCollect.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200">
                  <div className="text-[10px] font-bold text-purple-800">已開票 / 尚可補開額度</div>
                  <div className="text-xs font-mono font-black text-purple-900 mt-0.5">
                    ${kpi.totalInvoiced.toLocaleString()} / <span className="text-amber-700">${kpi.uninvoicedCollectedCapacity.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center gap-2">
                {canEditCashier && (
                  <button
                    type="button"
                    onClick={() => { setShowAdvanceForm(!showAdvanceForm); setShowPostInvForm(false); }}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>＋ 登錄案場預收款／銀行貸款撥款（直入本案）</span>
                  </button>
                )}
                {canEditAr && (
                  <button
                    type="button"
                    onClick={() => { setShowPostInvForm(!showPostInvForm); setShowAdvanceForm(false); }}
                    className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>＋ 分批補開銷項發票 / 自主報稅開票</span>
                  </button>
                )}
              </div>

              {/* Inline Form 1: Direct Project Advance */}
              {showAdvanceForm && (
                <div className="p-4 rounded-xl bg-teal-50/60 border-2 border-teal-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-teal-950">登錄案場預收／貸款先撥款（直接增加入帳銀行餘額並寫入本案貸方，不進未知水池）</span>
                    <button onClick={() => setShowAdvanceForm(false)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">款項來源類型</label>
                      <select
                        value={advSourceType}
                        onChange={(e) => setAdvSourceType(e.target.value as any)}
                        className="w-full bg-white border border-teal-300 rounded-lg p-2 font-bold outline-none"
                      >
                        <option value="EARLY_LOAN">銀行貸款先整筆撥入</option>
                        <option value="DEPOSIT">簽約前／預付訂金</option>
                        <option value="OVERPAYMENT">其他預收工程款</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">收款方式</label>
                      <select
                        value={advMethod}
                        onChange={(e) => setAdvMethod(e.target.value as any)}
                        className="w-full bg-white border border-teal-300 rounded-lg p-2 font-bold outline-none"
                      >
                        <option value="TT">銀行匯款/轉帳</option>
                        <option value="CHECK">業主支票</option>
                        <option value="CASH">現金收訖</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">預收金額 *</label>
                      <input
                        type="number"
                        min="0"
                        value={advAmount}
                        onChange={(e) => setAdvAmount(e.target.value)}
                        placeholder="例: 500000"
                        className="w-full bg-white border border-teal-300 rounded-lg p-2 font-mono font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">入帳／收票日期</label>
                      <input
                        type="date"
                        value={advDate}
                        onChange={(e) => setAdvDate(e.target.value)}
                        className="w-full bg-white border border-teal-300 rounded-lg p-2 font-mono font-bold outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {advMethod !== 'CASH' && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">入帳帳戶（公司戶或老闆私帳）</label>
                        <select
                          value={advBankId}
                          onChange={(e) => setAdvBankId(e.target.value)}
                          className="w-full bg-white border border-teal-300 rounded-lg p-2 font-bold outline-none"
                        >
                          {eligibleAdvanceBanks.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.isVirtualAccount || b.companyId === 'BOSS-01' ? '👤 [老闆私帳] ' : '🏦 '}
                              {b.bankName} · {b.accountNumber}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">備註說明</label>
                      <input
                        type="text"
                        value={advNotes}
                        onChange={(e) => setAdvNotes(e.target.value)}
                        placeholder="例：業主農會貸款撥款，下期請款單扣抵"
                        className="w-full bg-white border border-teal-300 rounded-lg p-2 outline-none"
                      />
                    </div>
                  </div>
                  {advMethod === 'CHECK' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={advCheckNo}
                        onChange={(e) => setAdvCheckNo(e.target.value.toUpperCase())}
                        placeholder="支票號碼 *"
                        className="bg-white border border-amber-300 rounded-lg p-2 font-mono font-bold"
                      />
                      <input
                        type="date"
                        value={advCheckDue}
                        onChange={(e) => setAdvCheckDue(e.target.value)}
                        className="bg-white border border-amber-300 rounded-lg p-2 font-mono font-bold"
                      />
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowAdvanceForm(false)} className="px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 cursor-pointer">取消</button>
                    <button type="button" onClick={handleCreateAdvance} className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer">確認入案場總帳</button>
                  </div>
                </div>
              )}

              {/* Inline Form 2: Multi-batch Partial / Self-retained / Extra-tax Invoice */}
              {showPostInvForm && (
                <div className="p-4 rounded-xl bg-purple-50/60 border-2 border-purple-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-purple-950">分批補開發票 / 已收完款自主報稅（支援同案多次分批、或向業主補收 5% 稅金應收）</span>
                    <button onClick={() => setShowPostInvForm(false)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <label className={`flex items-start gap-2 p-2.5 rounded-lg border-2 cursor-pointer ${piMode === 'SELF_RETAINED' ? 'bg-white border-purple-500' : 'border-purple-200'}`}>
                      <input type="radio" checked={piMode === 'SELF_RETAINED'} onChange={() => { setPiMode('SELF_RETAINED'); setPiTaxMode('TAX_INCLUSIVE'); setPiCreateExtraTaxAr(false); }} className="mt-0.5" />
                      <div>
                        <div className="font-bold text-purple-950">自主開立留存報稅（不給業主・稅金公司自理）</div>
                        <div className="text-[10px] text-slate-600">依當期進銷項差額分批補開（例如先開幾十萬平衡稅額），採含稅反算</div>
                      </div>
                    </label>
                    <label className={`flex items-start gap-2 p-2.5 rounded-lg border-2 cursor-pointer ${piMode === 'DELIVERED' ? 'bg-white border-indigo-500' : 'border-purple-200'}`}>
                      <input type="radio" checked={piMode === 'DELIVERED'} onChange={() => setPiMode('DELIVERED')} className="mt-0.5" />
                      <div>
                        <div className="font-bold text-indigo-950">事後補開並交付業主（例：100萬工程要60萬發票）</div>
                        <div className="text-[10px] text-slate-600">可選含稅吸收，或勾選自動產生「5% 稅金補收單」向業主請款</div>
                      </div>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">關聯請款單 (可選)</label>
                      <select
                        value={piTargetArId}
                        onChange={(e) => setPiTargetArId(e.target.value)}
                        className="w-full bg-white border border-purple-200 rounded-lg p-2 outline-none"
                      >
                        <option value="">(直掛本案場分批開立)</option>
                        {projArs.map(a => (
                          <option key={a.id} value={a.id}>{a.arNumber} (${a.amount.toLocaleString()})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">開票公司</label>
                      <select
                        value={piCompanyId}
                        onChange={(e) => setPiCompanyId(e.target.value)}
                        className="w-full bg-white border border-purple-200 rounded-lg p-2 font-bold outline-none"
                      >
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.shortName || c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">發票字軌號碼 *</label>
                      <input
                        type="text"
                        value={piNumber}
                        onChange={(e) => setPiNumber(e.target.value.toUpperCase())}
                        placeholder="例: TT-25225466"
                        className="w-full bg-white border border-purple-300 rounded-lg p-2 font-mono font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">開立日期</label>
                      <input
                        type="date"
                        value={piDate}
                        onChange={(e) => setPiDate(e.target.value)}
                        className="w-full bg-white border border-purple-200 rounded-lg p-2 font-mono font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-end">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">發票聯式</label>
                      <select
                        value={piFormat}
                        onChange={(e) => setPiFormat(e.target.value as any)}
                        className="w-full bg-white border border-purple-200 rounded-lg p-2 font-bold outline-none"
                      >
                        <option value="THREE_PART">三聯式 (B2B 附統編)</option>
                        <option value="TWO_PART">二聯式 (免統編含稅)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {piMode === 'SELF_RETAINED' || piTaxMode === 'TAX_INCLUSIVE' ? '本次開票含稅總額 *' : '本次開票未稅銷售額 *'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={piAmount}
                        onChange={(e) => setPiAmount(e.target.value)}
                        placeholder={`例: 600000 (可補額度 ${kpi.uninvoicedCollectedCapacity.toLocaleString()})`}
                        className="w-full bg-white border border-purple-300 rounded-lg p-2 font-mono font-bold outline-none"
                      />
                    </div>
                    {piMode === 'DELIVERED' && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">稅金處理方式</label>
                        <select
                          value={piTaxMode}
                          onChange={(e) => setPiTaxMode(e.target.value as any)}
                          className="w-full bg-white border border-purple-200 rounded-lg p-2 font-bold outline-none"
                        >
                          <option value="TAX_INCLUSIVE">含稅反算（不另加收）</option>
                          <option value="TAX_EXCLUSIVE">外加 5% 稅金（未稅＋稅）</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {piMode === 'DELIVERED' && piCalc.tax > 0 && (
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-indigo-900 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-indigo-200">
                      <input
                        type="checkbox"
                        checked={piCreateExtraTaxAr}
                        onChange={(e) => setPiCreateExtraTaxAr(e.target.checked)}
                      />
                      <span>業主已收完本金，額外自動開立一張【NT$ {piCalc.tax.toLocaleString()} (5% 補開發票稅金)】應收請款單向業主補收（限入公司戶）</span>
                    </label>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-purple-200">
                    <span className="font-mono text-slate-700">
                      未稅 <b>${piCalc.net.toLocaleString()}</b> ＋ 銷項稅 <b>${piCalc.tax.toLocaleString()}</b> ＝ 發票總額 <b className="text-purple-900">${piCalc.total.toLocaleString()}</b>
                    </span>
                    <button type="button" onClick={handleConfirmProjectInvoice} className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold cursor-pointer inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>確認分批開立寫入主檔</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Debit / Credit Chronological Ledger Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">日期</th>
                      <th className="p-2.5">類別</th>
                      <th className="p-2.5">摘要說明</th>
                      <th className="p-2.5 text-right text-blue-800">借方（請款應收）</th>
                      <th className="p-2.5 text-right text-emerald-800">貸方（實收／預收）</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">
                          本案場尚無應收請款、收款或發票往來紀錄
                        </td>
                      </tr>
                    ) : (
                      ledgerRows.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">{r.date}</td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${r.badgeTone}`}>
                              {r.badge}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-900">{r.title}</div>
                            <div className="text-[11px] text-slate-500">{r.detail}</div>
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-blue-800">
                            {r.debit > 0 ? `NT$ ${r.debit.toLocaleString()}` : '-'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                            {r.credit > 0 ? `NT$ ${r.credit.toLocaleString()}` : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-mono font-bold">
                    <tr>
                      <td colSpan={3} className="p-3 font-sans">
                        合計（未結清差額＝累計請款 − 累計已收／預收）
                      </td>
                      <td className="p-3 text-right text-sky-300">NT$ {kpi.totalBilled.toLocaleString()}</td>
                      <td className="p-3 text-right text-emerald-300">
                        NT$ {kpi.totalCollected.toLocaleString()}（差 NT$ {(kpi.totalBilled - kpi.totalCollected).toLocaleString()}）
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* TAB 2: EXTERNAL CUSTOMER STATEMENT MINI-APP               */
            /* ========================================================= */
            <CustomerStatementMiniApp
              project={project}
              arList={arList}
              arCollections={arCollections}
              projectAdvances={projectAdvances}
              taxRate={taxRate}
              initialFocusArId={initialFocusArId}
              operatorName={operatorName}
              onNotify={onNotify}
              onAfterSubmit={onRefresh}
            />
          )}
        </div>
      </div>
    </div>
  );
};
