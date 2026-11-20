// src/components/finance/CustomerStatementMiniApp.tsx
// 🧾 獨立小程式：對外客戶請款／對帳明細表 (Clean External Statement Builder)
// 職能隔離保證：本元件不接收銀行私帳、401 稅額活頁簿或自主留存發票(SELF_RETAINED)機密，專責產出給業主看的簡潔請款總表。

import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Plus,
  Printer,
  Send,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import {
  AccountReceivable,
  ArCollectionRecord,
  ArLineItem,
  Project,
  ProjectAdvanceReceipt,
} from '../../types/erp';
import { createAccountsReceivable } from '../../db/sqlite';

export type CustomerBillingWorkflowMode =
  | 'FINANCE_ONLY'
  | 'PROJECT_AND_FINANCE'
  | 'PROJECT_FIRST_HANDOFF';

export interface CustomerStatementMiniAppProps {
  project?: Project;
  projects?: Project[];
  arList: AccountReceivable[];
  arCollections: ArCollectionRecord[];
  projectAdvances: ProjectAdvanceReceipt[];
  taxRate?: number;
  initialFocusArId?: string;
  workflowMode?: CustomerBillingWorkflowMode;
  canSubmitToAccounting?: boolean;
  operatorName?: string;
  onNotify?: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onAfterSubmit?: () => void;
}

interface StatementEditLine {
  id: string;
  itemName: string;
  inputAmount: string;
  taxMode: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT';
}

interface StatementPaymentRef {
  id: string;
  dateStr: string;
  label: string;
  amount: number;
}

function formatStatementDate(ymd: string, useRoc: boolean): string {
  const m = (ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return ymd;
  const year = useRoc ? Number(m[1]) - 1911 : Number(m[1]);
  return `${year}.${m[2]}.${m[3]}`;
}

export const CustomerStatementMiniApp: React.FC<CustomerStatementMiniAppProps> = ({
  project: lockedProject,
  projects = [],
  arList,
  arCollections,
  projectAdvances,
  taxRate = 0.05,
  initialFocusArId,
  workflowMode = 'FINANCE_ONLY',
  canSubmitToAccounting = false,
  operatorName = '工務／承辦人員',
  onNotify = () => {},
  onAfterSubmit,
}) => {
  const selectableProjects = useMemo(
    () => projects.filter(p => !p.isDeleted && p.id !== 'PRJ-INTERNAL'),
    [projects]
  );

  const [selectedProjId, setSelectedProjId] = useState<string>(
    () => lockedProject?.id || selectableProjects[0]?.id || ''
  );

  useEffect(() => {
    if (lockedProject?.id) {
      setSelectedProjId(lockedProject.id);
    } else if (!selectedProjId && selectableProjects.length > 0) {
      setSelectedProjId(selectableProjects[0].id);
    }
  }, [lockedProject?.id, selectableProjects, selectedProjId]);

  const project = useMemo(
    () => lockedProject || selectableProjects.find(p => p.id === selectedProjId) || null,
    [lockedProject, selectableProjects, selectedProjId]
  );

  const projArs = useMemo(
    () => (project ? arList.filter(a => a.projectId === project.id && a.status !== 'VOIDED') : []),
    [arList, project]
  );
  const projArIds = useMemo(() => new Set(projArs.map(a => a.id)), [projArs]);

  const projCollections = useMemo(
    () => arCollections.filter(c => projArIds.has(c.arId) && c.status !== 'VOIDED'),
    [arCollections, projArIds]
  );
  const projAdvances = useMemo(
    () => (project ? projectAdvances.filter(a => a.projectId === project.id) : []),
    [projectAdvances, project]
  );

  const buildInitialLines = (targetProj: Project | null, ars: AccountReceivable[], focusArId?: string): StatementEditLine[] => {
    if (!targetProj) return [];
    const targetArs = focusArId ? ars.filter(a => a.id === focusArId) : ars;
    const out: StatementEditLine[] = [];
    for (const ar of targetArs) {
      if (ar.lineItems && ar.lineItems.length > 0) {
        ar.lineItems.forEach((li, idx) => {
          out.push({
            id: `${ar.id}-${idx}-${li.id}`,
            itemName: li.itemName,
            inputAmount: String(li.taxMode === 'TAX_INCLUSIVE' ? li.totalAmount : li.netAmount),
            taxMode: li.taxMode,
          });
        });
      } else {
        const mode: StatementEditLine['taxMode'] =
          ar.hasInvoice === false || ar.taxType === 'TAX_EXEMPT'
            ? 'TAX_EXEMPT'
            : ar.taxType === 'TAX_INCLUSIVE'
            ? 'TAX_INCLUSIVE'
            : 'TAX_EXCLUSIVE';
        out.push({
          id: ar.id,
          itemName: `${targetProj.name}${ar.title ? `-${ar.title}` : ''}`,
          inputAmount: String(mode === 'TAX_INCLUSIVE' ? ar.amount : ar.netAmount ?? ar.amount),
          taxMode: mode,
        });
      }
    }
    if (out.length === 0) {
      out.push({
        id: `LINE-${Date.now()}`,
        itemName: targetProj.name,
        inputAmount: String(targetProj.contractAmount || 0),
        taxMode: 'TAX_EXEMPT',
      });
    }
    return out;
  };

  const [stmtLines, setStmtLines] = useState<StatementEditLine[]>(() =>
    buildInitialLines(project, projArs, initialFocusArId)
  );
  const [stmtUseRocDate, setStmtUseRocDate] = useState<boolean>(true);
  const [stmtInvoiceNo, setStmtInvoiceNo] = useState<string>(() => {
    if (initialFocusArId) {
      const ar = projArs.find(a => a.id === initialFocusArId);
      if (ar && ar.invoiceIssueMode !== 'SELF_RETAINED' && ar.invoiceNumber) {
        return ar.invoiceNumber;
      }
    }
    return '';
  });
  const [requestTitle, setRequestTitle] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment deductions (strictly clean: only date + amount, never private bank info)
  const allPaymentRefs: StatementPaymentRef[] = useMemo(() => {
    const refs: StatementPaymentRef[] = [];
    projCollections.forEach(c => {
      refs.push({
        id: `COL-${c.id}`,
        dateStr: c.receivedDate,
        label: '已收帳款',
        amount: c.amount,
      });
    });
    projAdvances.forEach(a => {
      refs.push({
        id: `ADV-${a.id}`,
        dateStr: a.receivedDate,
        label: a.sourceType === 'DEPOSIT' ? '已收訂金' : '已收帳款',
        amount: a.amount,
      });
    });
    return refs.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [projCollections, projAdvances]);

  const [selectedPayIds, setSelectedPayIds] = useState<string[]>(() => allPaymentRefs.map(r => r.id));

  // Sync when switching project in standalone mode
  useEffect(() => {
    setStmtLines(buildInitialLines(project, projArs, initialFocusArId));
    setSelectedPayIds(allPaymentRefs.map(r => r.id));
    if (initialFocusArId) {
      const ar = projArs.find(a => a.id === initialFocusArId);
      setStmtInvoiceNo(ar && ar.invoiceIssueMode !== 'SELF_RETAINED' && ar.invoiceNumber ? ar.invoiceNumber : '');
    } else {
      setStmtInvoiceNo('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, initialFocusArId]);

  const computedStmt = useMemo(() => {
    const items = stmtLines.map((l, idx) => {
      const raw = Math.max(0, Number(l.inputAmount || 0));
      let sales = raw;
      let tax = 0;
      let subtotal = raw;
      if (l.taxMode === 'TAX_EXCLUSIVE') {
        tax = Math.round(raw * taxRate);
        subtotal = raw + tax;
      } else if (l.taxMode === 'TAX_INCLUSIVE') {
        tax = Math.round(raw - raw / (1 + taxRate));
        sales = Math.max(0, raw - tax);
        subtotal = raw;
      }
      return {
        ...l,
        index: idx + 1,
        sales,
        tax,
        subtotal,
      };
    });

    const sumSales = items.reduce((s, i) => s + i.sales, 0);
    const sumTax = items.reduce((s, i) => s + i.tax, 0);
    const sumSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const chosenPayments = allPaymentRefs.filter(r => selectedPayIds.includes(r.id));
    const sumPaid = chosenPayments.reduce((s, p) => s + p.amount, 0);
    const grandTotalReceivable = sumSubtotal - sumPaid;

    return {
      items,
      sumSales,
      sumTax,
      sumSubtotal,
      chosenPayments,
      sumPaid,
      grandTotalReceivable,
    };
  }, [stmtLines, taxRate, allPaymentRefs, selectedPayIds]);

  const handleSubmitBillingRequestToAccounting = () => {
    if (!project) return;
    const validItems = computedStmt.items.filter(i => i.subtotal > 0);
    if (validItems.length === 0) {
      onNotify('請至少輸入一筆金額大於 0 的請款工項明細再送交會計！', 'warn');
      return;
    }

    setIsSubmitting(true);
    try {
      const lineItems: ArLineItem[] = validItems.map((it, idx) => ({
        id: `LI-${Date.now()}-${idx}`,
        itemName: it.itemName.trim() || `${project.name} 工項 ${idx + 1}`,
        netAmount: it.sales,
        taxMode: it.taxMode,
        taxAmount: it.tax,
        totalAmount: it.subtotal,
      }));

      const hasAnyTax = computedStmt.sumTax > 0;
      const inferredTaxType: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' | 'TAX_EXEMPT' = !hasAnyTax
        ? 'TAX_EXEMPT'
        : validItems.every(i => i.taxMode === 'TAX_INCLUSIVE')
        ? 'TAX_INCLUSIVE'
        : 'TAX_EXCLUSIVE';

      const due = new Date();
      due.setDate(due.getDate() + 30);
      const dueStr = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;

      const cleanTitle = requestTitle.trim()
        ? `[工務對客明細送審] ${requestTitle.trim()}`
        : `[工務對客明細送審] ${validItems[0].itemName || project.name}`;

      const created = createAccountsReceivable(
        {
          projectId: project.id,
          projectName: project.name,
          customerId: `PROJ-OWNER-${project.id}`,
          customerName: project.ownerName || '案場業主',
          customerTaxId: project.ownerTaxId || undefined,
          companyId: project.companyId && project.companyId !== 'UNASSIGNED' ? project.companyId : 'COMP-01',
          title: cleanTitle,
          lineItems,
          netAmount: computedStmt.sumSales,
          taxType: inferredTaxType,
          taxAmount: computedStmt.sumTax,
          amount: computedStmt.sumSubtotal,
          hasInvoice: false, // 交由會計最後決定開哪間公司發票／聯式或免開發票
          dueDate: dueStr,
          notes: `由「對外客戶請款明細表」小程式送交會計（原試算未扣已收合計 NT$ ${computedStmt.sumSubtotal.toLocaleString()}，勾選已收扣抵 NT$ ${computedStmt.sumPaid.toLocaleString()}）`,
        },
        operatorName
      );

      setRequestTitle('');
      if (onAfterSubmit) onAfterSubmit();
      onNotify(
        `✅ 已產生請款送審單 [${created.arNumber}] 送交會計！會計可在「財務收支 ＞ 應收請款」決定開立公司發票或免票交出納。`,
        'success'
      );
    } catch (e: any) {
      onNotify(`送交會計失敗：${e.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!project) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
        目前尚無有效工程案場可製作對外請款明細表。
      </div>
    );
  }

  return (
    <div className="space-y-4 text-xs">
      {/* Editor Controls (Hidden when printing) */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>對外給客明細編輯區（自動隔離銀行私帳／401 稅冊／自主留存發票等敏感機密）</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!lockedProject && selectableProjects.length > 0 && (
              <select
                value={project.id}
                onChange={(e) => setSelectedProjId(e.target.value)}
                className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none"
              >
                {selectableProjects.map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.projectCode}] {p.name} ({p.ownerName || '-'})
                  </option>
                ))}
              </select>
            )}
            {projArs.length > 0 && (
              <select
                onChange={(e) => setStmtLines(buildInitialLines(project, projArs, e.target.value || undefined))}
                defaultValue={initialFocusArId || ''}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold outline-none"
              >
                <option value="">載入本案全部請款項目</option>
                {projArs.map(a => (
                  <option key={a.id} value={a.id}>
                    僅載入 {a.arNumber} ({a.title})
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>列印／另存 PDF 給客戶</span>
            </button>
          </div>
        </div>

        {/* Options: Invoice number & Date format */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              合計列顯示發票號碼 (選填，留空僅顯示「合計」)
            </label>
            <input
              type="text"
              value={stmtInvoiceNo}
              onChange={(e) => setStmtInvoiceNo(e.target.value.toUpperCase())}
              placeholder="例: TT25225466"
              className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-mono font-bold outline-none"
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="inline-flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={stmtUseRocDate}
                onChange={(e) => setStmtUseRocDate(e.target.checked)}
              />
              <span>已收帳款日期採用民國年 (例 114.10.30)</span>
            </label>
          </div>
          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={() =>
                setStmtLines(prev => [
                  ...prev,
                  { id: `LINE-${Date.now()}`, itemName: '', inputAmount: '', taxMode: 'TAX_EXEMPT' },
                ])
              }
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-700 cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新增工程工項列</span>
            </button>
          </div>
        </div>

        {/* Multi-line rows editor */}
        <div className="space-y-1.5">
          {stmtLines.map((line, idx) => (
            <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-1 text-center font-mono font-bold text-slate-500">{idx + 1}</div>
              <input
                type="text"
                value={line.itemName}
                onChange={(e) =>
                  setStmtLines(prev => prev.map(x => (x.id === line.id ? { ...x, itemName: e.target.value } : x)))
                }
                placeholder="工程項目明細名稱 (例：倉庫新建工程、追加工程)"
                className="col-span-5 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-bold"
              />
              <input
                type="number"
                min="0"
                value={line.inputAmount}
                onChange={(e) =>
                  setStmtLines(prev => prev.map(x => (x.id === line.id ? { ...x, inputAmount: e.target.value } : x)))
                }
                placeholder="金額"
                className="col-span-2 bg-white border border-slate-300 rounded px-2 py-1 font-mono font-bold text-right"
              />
              <select
                value={line.taxMode}
                onChange={(e) =>
                  setStmtLines(prev =>
                    prev.map(x => (x.id === line.id ? { ...x, taxMode: e.target.value as any } : x))
                  )
                }
                className="col-span-3 bg-white border border-slate-300 rounded px-2 py-1 font-bold"
              >
                <option value="TAX_EXCLUSIVE">外加 5% 營業稅</option>
                <option value="TAX_INCLUSIVE">含稅反算 5%</option>
                <option value="TAX_EXEMPT">免稅 / 無稅 ($0)</option>
              </select>
              <button
                type="button"
                onClick={() => setStmtLines(prev => prev.filter(x => x.id !== line.id))}
                className="col-span-1 text-slate-400 hover:text-rose-600 flex justify-center cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Selectable Collected Deductions */}
        {allPaymentRefs.length > 0 && (
          <div className="pt-2 border-t border-slate-200">
            <div className="text-[11px] font-bold text-slate-700 mb-1.5">勾選要列示減項的「已收帳款」紀錄：</div>
            <div className="flex flex-wrap gap-2">
              {allPaymentRefs.map(ref => {
                const checked = selectedPayIds.includes(ref.id);
                return (
                  <label
                    key={ref.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] cursor-pointer ${
                      checked ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedPayIds(prev => [...prev, ref.id]);
                        else setSelectedPayIds(prev => prev.filter(id => id !== ref.id));
                      }}
                    />
                    <span>
                      {ref.label}-{formatStatementDate(ref.dateStr, stmtUseRocDate)} (${ref.amount.toLocaleString()})
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode B Handoff Action: Submit billing request to Accounting AR queue */}
        {canSubmitToAccounting && (
          <div className="pt-3 border-t border-indigo-200/80 flex flex-wrap items-center justify-between gap-2 bg-indigo-50/70 p-3 rounded-xl">
            <div className="flex-1 min-w-[220px] space-y-1">
              <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>
                  {workflowMode === 'PROJECT_FIRST_HANDOFF'
                    ? '工務送審模式已啟用：填好明細後可直接拋轉給會計確認開票與入帳'
                    : '雙軌整合：可將目前對客工項明細直接拋轉建立「待確認應收立帳單」'}
                </span>
              </div>
              <input
                type="text"
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                placeholder="輸入送交會計期別摘要 (選填，例：第二期進度款請款)"
                className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1 text-xs outline-none"
              />
            </div>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmitBillingRequestToAccounting}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs shrink-0 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>送交會計立帳／確認開票</span>
            </button>
          </div>
        )}
      </div>

      {/* Clean External Customer Statement Sheet */}
      <div className="bg-white p-4 border border-slate-200 rounded-xl print:border-0 print:p-0">
        <div className="mb-3 flex items-end justify-between text-slate-800">
          <div>
            <div className="text-base font-black tracking-wide">請款對帳明細表</div>
            <div className="text-xs text-slate-600 mt-0.5">
              工程案場：{project.name}　｜　業主：{project.ownerName || '-'}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            製表日期：{formatStatementDate(new Date().toISOString().slice(0, 10), stmtUseRocDate)}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse bg-[#b9b9b9]/45 text-slate-950 font-serif">
            <thead>
              <tr className="bg-[#b0b0b0]/70 border-t border-b border-slate-400">
                <th className="py-2.5 px-3 w-12 text-center font-normal"></th>
                <th className="py-2.5 px-3 text-left font-normal"></th>
                <th className="py-2.5 px-4 text-right font-normal w-36">銷貨金額</th>
                <th className="py-2.5 px-4 text-right font-normal w-28">稅金</th>
                <th className="py-2.5 px-4 text-right font-normal w-36">小計</th>
              </tr>
            </thead>
            <tbody>
              {computedStmt.items.map(item => (
                <tr key={item.id} className="bg-[#b0b0b0]/55">
                  <td className="py-2.5 px-3 text-center align-top">{item.index}</td>
                  <td className="py-2.5 px-3 text-left whitespace-pre-wrap">{item.itemName || '(未填項目)'}</td>
                  <td className="py-2.5 px-4 text-right font-mono">${item.sales.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-right font-mono">${item.tax.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-right font-mono">${item.subtotal.toLocaleString()}</td>
                </tr>
              ))}

              {/* Total row with double top border */}
              <tr className="bg-[#b0b0b0]/70 border-t-[3px] border-double border-slate-900">
                <td className="py-2.5 px-3"></td>
                <td className="py-2.5 px-3 text-center font-bold">
                  {stmtInvoiceNo.trim() ? `合計-發票${stmtInvoiceNo.trim()}` : '合計'}
                </td>
                <td className="py-2.5 px-4 text-right font-mono">
                  {computedStmt.chosenPayments.length > 0 ? '' : `$${computedStmt.sumSales.toLocaleString()}`}
                </td>
                <td className="py-2.5 px-4 text-right font-mono">
                  {computedStmt.chosenPayments.length > 0 ? '' : `$${computedStmt.sumTax.toLocaleString()}`}
                </td>
                <td
                  className={`py-2.5 px-4 text-right font-mono font-bold ${
                    computedStmt.chosenPayments.length === 0 ? 'border-2 border-slate-900' : ''
                  }`}
                >
                  ${computedStmt.sumSubtotal.toLocaleString()}
                </td>
              </tr>

              {/* Red negative payment deductions if any */}
              {computedStmt.chosenPayments.map(pay => (
                <tr key={pay.id} className="bg-[#b0b0b0]/60">
                  <td className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-center">
                    {pay.label}-{formatStatementDate(pay.dateStr, stmtUseRocDate)}
                  </td>
                  <td className="py-2 px-4"></td>
                  <td className="py-2 px-4"></td>
                  <td className="py-2 px-4 text-right font-mono font-bold text-red-600">
                    -${pay.amount.toLocaleString()}
                  </td>
                </tr>
              ))}

              {/* Final boxed total row when deductions exist */}
              {computedStmt.chosenPayments.length > 0 && (
                <tr className="bg-[#b0b0b0]/75 border-t-[3px] border-double border-slate-900">
                  <td className="py-2.5 px-3"></td>
                  <td className="py-2.5 px-3 text-center font-bold">總計應收帳款</td>
                  <td className="py-2.5 px-4"></td>
                  <td className="py-2.5 px-4"></td>
                  <td className="py-2.5 px-4 text-right font-mono font-black border-2 border-slate-900">
                    ${computedStmt.grandTotalReceivable.toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
