// src/components/finance/ap/ApReconciliationPoolMiniApp.tsx
// 🧾 會計應付對帳大水池、已送出納待放款追蹤與已結清備查清冊小程式

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  Eye,
  RotateCcw,
  Send,
} from 'lucide-react';
import {
  AccountsPayableReconciliation,
  Company,
  PaymentRecord,
} from '../../../types/erp';
import { DuplicateApGroup } from '../../../db/sqlite';
import { formatLocalYmd, VendorPoolGroup } from '../financeUtils';
import { ApArchiveTable } from './ApArchiveTable';

interface ApReconciliationPoolMiniAppProps {
  reconciliations: AccountsPayableReconciliation[];
  payments: PaymentRecord[];
  companies: Company[];
  returnedRecs: AccountsPayableReconciliation[];
  draftRecs: AccountsPayableReconciliation[];
  approvedRecs: AccountsPayableReconciliation[];
  vendorPoolList: VendorPoolGroup[];
  duplicateApGroups: DuplicateApGroup[];
  accountingTodoCount: number;
  pendingInboundCount: number;
  taxRatePct: number;
  canEditAccounting: boolean;
  canEditCashier: boolean;
  matchesCompanyScope: (compId?: string) => boolean;
  onCleanupDuplicates: () => void;
  onOpenCreateRec: (vendorId?: string) => void;
  onOpenEditRec: (rec: AccountsPayableReconciliation) => void;
  onOpenPayment: (rec: AccountsPayableReconciliation) => void;
  onOpenVoidRec: (recId: string) => void;
  onOpenReturnRec: (rec: AccountsPayableReconciliation) => void;
  onViewVendorPool: (group: VendorPoolGroup) => void;
}

export const ApReconciliationPoolMiniApp: React.FC<ApReconciliationPoolMiniAppProps> = ({
  reconciliations,
  payments,
  companies,
  returnedRecs,
  draftRecs,
  approvedRecs,
  vendorPoolList,
  duplicateApGroups,
  accountingTodoCount,
  pendingInboundCount,
  taxRatePct,
  canEditAccounting,
  canEditCashier,
  matchesCompanyScope,
  onCleanupDuplicates,
  onOpenCreateRec,
  onOpenEditRec,
  onOpenPayment,
  onOpenVoidRec,
  onOpenReturnRec,
  onViewVendorPool,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('PAID');
  const [expandedVendorPoolIds, setExpandedVendorPoolIds] = useState<string[]>([]);

  const filteredRecs = useMemo(() => {
    return reconciliations.filter(r => {
      if (!matchesCompanyScope(r.companyId)) return false;
      const matchSearch =
        searchQuery === '' ||
        r.reconciliationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.vendorName && r.vendorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.invoiceNumber && r.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchStatus =
        selectedStatusFilter === 'ALL' ||
        (selectedStatusFilter === 'COMPLETED'
          ? r.status === 'PAID' || r.status === 'VOIDED'
          : r.status === selectedStatusFilter);
      return matchSearch && matchStatus;
    });
  }, [reconciliations, searchQuery, selectedStatusFilter, matchesCompanyScope]);

  return (
    <div className="space-y-4">
      {/* A. 會計待辦處理大水池（有新單據、退回重算、草稿待送皆集中於此，做完即清零） */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${accountingTodoCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <h3 className="text-xs font-bold text-slate-800">
              會計待辦處理大水池（出納退回重算 · 未完成草稿 · 待對帳新進貨）
            </h3>
            {returnedRecs.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-bold">
                🚨 退回重算 {returnedRecs.length} 筆
              </span>
            )}
            {draftRecs.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold">
                📝 草稿待送 {draftRecs.length} 筆
              </span>
            )}
            {vendorPoolList.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 font-bold">
                📦 待對帳新進貨 {vendorPoolList.length} 廠商 ({pendingInboundCount} 筆)
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            處理完此區即完成當期對帳作業；已確認無誤之單據會自動歸入下方備查清冊
          </span>
        </div>

        {/* 異常重複請款偵測與一鍵去重清理 */}
        {duplicateApGroups.length > 0 && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5 text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  ⚠️ 偵測到 {duplicateApGroups.length} 組進貨單被重複建立多筆請款對帳單！
                </div>
                <div className="text-[11px] text-rose-800 mt-0.5">
                  {duplicateApGroups.slice(0, 3).map(g => (
                    <span key={g.receiptId} className="mr-3">
                      進貨單【{g.receiptNumber}】多出 {g.duplicateRecs.length} 筆重複（{g.duplicateRecs.map(d => d.reconciliationNumber).join('、')}）
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {canEditAccounting && (
              <button
                type="button"
                onClick={onCleanupDuplicates}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer shrink-0 shadow-2xs"
              >
                一鍵清理重複請款（保留有效單據）
              </button>
            )}
          </div>
        )}

        {/* A-1. 出納退回待重算修正（最高優先級） */}
        {returnedRecs.length > 0 && (
          <div className="border-2 border-rose-300 rounded-xl overflow-hidden bg-rose-50/40">
            <div className="bg-rose-100/80 px-3.5 py-2 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                <span>出納退回重算通知（{returnedRecs.length} 筆待會計修正再送審）</span>
              </div>
              <span className="text-[11px] text-rose-700 font-medium">
                請核對退回原因並重算修正稅額／金額／發票
              </span>
            </div>
            <div className="divide-y divide-rose-200/70 bg-white">
              {returnedRecs.map(ret => {
                const retComp = companies.find(c => c.id === ret.companyId);
                return (
                  <div key={ret.id} className="p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-rose-50/30 transition-colors text-xs">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{ret.reconciliationNumber}</span>
                        <span className="font-bold text-slate-800">{ret.vendorName || ret.vendorId}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {retComp?.shortName || retComp?.name || ret.companyId}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono">
                          發票：{ret.invoiceNumber === 'NONE' ? '免用發票' : ret.invoiceNumber === 'PENDING_NEXT' ? '待補票' : ret.invoiceNumber}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          含稅應付：<b className="font-mono text-rose-700 text-sm">NT$ {ret.netPayableAmount.toLocaleString()}</b>（稅額 NT$ {ret.taxAmount.toLocaleString()}）
                        </span>
                      </div>
                      <div className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1 inline-flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>
                          <b>{ret.returnedBy || '出納'}退回原因：</b>{ret.returnedReason || '請重新核算金額與稅額'}
                        </span>
                      </div>
                    </div>
                    {canEditAccounting && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenEditRec(ret)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>重算修正並送審</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenVoidRec(ret.id)}
                          className="px-2.5 py-1.5 border border-slate-300 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                          title="作廢此對帳單並將進貨單釋放回待對帳水池"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>作廢釋放</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* A-2. 暫存草稿對帳單 */}
        {draftRecs.length > 0 && (
          <div className="border border-indigo-200 rounded-xl overflow-hidden bg-indigo-50/30">
            <div className="bg-indigo-50 px-3.5 py-2 border-b border-indigo-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <span>暫存草稿對帳單（{draftRecs.length} 筆尚未核准送交出納）</span>
              </div>
              <span className="text-[11px] text-indigo-700">
                所勾稽進貨單已鎖定於草稿中，不會重複出現在下方進貨池
              </span>
            </div>
            <div className="divide-y divide-indigo-100 bg-white">
              {draftRecs.map(draft => {
                const draftComp = companies.find(c => c.id === draft.companyId);
                return (
                  <div key={draft.id} className="p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-indigo-50/30 transition-colors text-xs">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono font-bold text-slate-900">{draft.reconciliationNumber}</span>
                      <span className="font-bold text-slate-800">{draft.vendorName || draft.vendorId}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {draftComp?.shortName || draftComp?.name || draft.companyId}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-mono">
                        綁定 {draft.receiptIds?.length || 0} 筆進貨單
                      </span>
                      <span className="text-xs text-slate-600">
                        含稅應付：<b className="font-mono text-indigo-700 text-sm">NT$ {draft.netPayableAmount.toLocaleString()}</b>（稅額 NT$ {draft.taxAmount.toLocaleString()}）
                      </span>
                    </div>
                    {canEditAccounting && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenEditRec(draft)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>繼續編輯送審</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenVoidRec(draft.id)}
                          className="px-2.5 py-1.5 border border-slate-300 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                          title="作廢草稿並將進貨單釋放回待對帳大水池"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>作廢釋放</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* A-3. 新進貨待對帳廠商水池 */}
        {vendorPoolList.length === 0 ? (
          returnedRecs.length === 0 && draftRecs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-emerald-50/40 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              <div className="font-bold text-emerald-900 text-sm">🎉 今日會計待辦大水池已全數清零！</div>
              <div className="text-[11px] text-emerald-700 mt-1">
                無新進貨待對帳、無暫存草稿、無出納退回重算事項；已確認之對帳單皆歸檔於下方備查清冊。
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-slate-500 text-xs bg-slate-50 rounded-lg border border-slate-200">
              目前無新的待對帳進貨簽收單，請先完成上方「退回重算／暫存草稿」項目即可結束本期對帳。
            </div>
          )
        ) : (
          <div className="overflow-x-auto border border-amber-200/80 rounded-xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-amber-50 text-amber-900 font-bold border-b border-amber-200">
                <tr>
                  <th className="p-3 w-8 text-center"></th>
                  <th className="p-3">對帳廠商 (統編 / 名稱)</th>
                  <th className="p-3">付款條件與慣例</th>
                  <th className="p-3 text-center">待對帳單據數</th>
                  <th className="p-3 text-right">累計待請款未稅總額</th>
                  <th className="p-3">最近進貨區間</th>
                  <th className="p-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 bg-white">
                {vendorPoolList.map((v) => {
                  const isExpanded = expandedVendorPoolIds.includes(v.vendorId);
                  const dates = v.receipts.map(r => r.receivedDate).filter(Boolean).sort();
                  const dateRange = dates.length > 0 ? `${dates[0]} ~ ${dates[dates.length - 1]}` : '當期進貨';

                  return (
                    <React.Fragment key={v.vendorId}>
                      <tr className="hover:bg-amber-50/40 transition-colors">
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedVendorPoolIds(prev =>
                                prev.includes(v.vendorId)
                                  ? prev.filter(id => id !== v.vendorId)
                                  : [...prev, v.vendorId]
                              );
                            }}
                            className="p-1 text-slate-400 hover:text-amber-800 rounded transition-colors cursor-pointer"
                            title={isExpanded ? '收合進貨簽收單' : '展開進貨簽收單'}
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-amber-700" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 text-sm">{v.vendorName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            統編: {v.vendorTaxId || '未建統編'}
                          </div>
                        </td>
                        <td className="p-3 text-slate-700">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">T+{v.paymentTermsDays} 天</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-sans">
                              {v.bankFeePayer === 'COMPANY' ? '匯費公司外加' : '匯費廠商內扣'}
                            </span>
                          </div>
                          {v.paymentMethodNotes && (
                            <div className="text-[11px] text-indigo-700 font-medium mt-0.5 truncate max-w-[220px]" title={v.paymentMethodNotes}>
                              💳 備註: {v.paymentMethodNotes}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                            {v.receipts.length} 筆待對帳
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="text-base font-mono font-black text-slate-900">
                            NT$ {v.totalAmount.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400">進貨簽收實體原額</div>
                        </td>
                        <td className="p-3 font-mono text-slate-600 text-[11px]">{dateRange}</td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => onViewVendorPool(v)}
                            className="px-3 py-1.5 text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            <span>檢視單據</span>
                          </button>
                          {canEditAccounting && (
                            <button
                              type="button"
                              onClick={() => onOpenCreateRec(v.vendorId)}
                              className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            >
                              <span>建立對帳單</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-amber-50/20">
                          <td colSpan={7} className="p-3.5 pl-10">
                            <div className="bg-white border border-amber-200 rounded-xl p-3 shadow-2xs">
                              <div className="text-xs font-bold text-amber-900 mb-2 flex items-center justify-between">
                                <span>該廠商大水池待請款進貨簽收單 ({v.receipts.length} 筆)</span>
                                <span className="text-[11px] text-slate-400">現場簽收直接調取 · 點擊「建立對帳單」進行勾稽</span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-[11px] text-left border-collapse">
                                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                    <tr>
                                      <th className="p-2">進貨單號</th>
                                      <th className="p-2">現場送貨單號</th>
                                      <th className="p-2">簽收日期</th>
                                      <th className="p-2">工程案場 / 原歸屬公司</th>
                                      <th className="p-2">簽收人</th>
                                      <th className="p-2 text-right">進貨未稅原額</th>
                                      <th className="p-2">簽收備註</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-mono">
                                    {v.receipts.map((r) => {
                                      const rComp = companies.find(c => c.id === r.companyId);
                                      return (
                                        <tr key={r.id} className="hover:bg-slate-50">
                                          <td className="p-2 font-bold text-slate-900">{r.receiptNumber}</td>
                                          <td className="p-2 text-indigo-700 font-semibold">{r.deliveryNoteNumber}</td>
                                          <td className="p-2 font-sans text-slate-600">{r.receivedDate}</td>
                                          <td className="p-2 font-sans text-slate-700">
                                            <span>{r.projectNameSnapshot}</span>
                                            {rComp && (
                                              <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold">
                                                {rComp.shortName || rComp.name}
                                              </span>
                                            )}
                                          </td>
                                          <td className="p-2 font-sans text-slate-600">{r.receivedBy}</td>
                                          <td className="p-2 text-right font-black text-slate-900">
                                            NT$ {r.totalAmount.toLocaleString()}
                                          </td>
                                          <td className="p-2 font-sans text-slate-500 max-w-xs truncate">
                                            {r.notes || '—'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* B. 已送交出納審核／待放款中 */}
      <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Send className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-800">
              2. 已送出納審核／待放款中（會計送件追蹤・催款參考）
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold font-mono">
              {approvedRecs.length} 筆待放款 · 合計 NT$ {approvedRecs.reduce((s, r) => s + r.netPayableAmount, 0).toLocaleString()}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            會計已覆核立帳，目前停留在出納待放款佇列；尚未出金前仍可追蹤進度、催請出納或抽回作廢
          </span>
        </div>

        {approvedRecs.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 rounded-lg border border-slate-100">
            目前無停留在出納端等待放款的對帳單（所有已核准單據皆已出金結清）。
          </div>
        ) : (
          <div className="overflow-x-auto border border-indigo-100 rounded-lg">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-indigo-50/70 text-indigo-900 font-bold border-b border-indigo-200">
                <tr>
                  <th className="p-2.5">對帳單號</th>
                  <th className="p-2.5">廠商名稱</th>
                  <th className="p-2.5">買受法人公司</th>
                  <th className="p-2.5">發票字軌</th>
                  <th className="p-2.5 text-right">應付淨額 (含稅)</th>
                  <th className="p-2.5">預計付款參考日 / 催款提示</th>
                  <th className="p-2.5">送出納時間 / 核准人</th>
                  <th className="p-2.5 text-center">操作 / 狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-100/70 font-mono">
                {approvedRecs.map((rec) => {
                  const today = formatLocalYmd(new Date());
                  const isOverdue = rec.paymentDueDate < today;
                  const isDueSoon = !isOverdue && rec.paymentDueDate <= formatLocalYmd(new Date(Date.now() + 7 * 86400000));
                  const payComp = companies.find(c => c.id === rec.companyId);
                  const sentDateMs = new Date(rec.updatedAt || rec.createdAt || Date.now()).getTime();
                  const waitDays = Math.max(0, Math.floor((Date.now() - sentDateMs) / 86400000));

                  return (
                    <tr key={rec.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="p-2.5 font-bold text-slate-900">{rec.reconciliationNumber}</td>
                      <td className="p-2.5 font-sans font-bold text-slate-800">
                        {rec.vendorName || rec.vendorId}
                      </td>
                      <td className="p-2.5 font-sans text-slate-700">
                        {payComp?.shortName || payComp?.name || rec.companyId}
                        {rec.isBossAdvance && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                            老闆私帳
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-sans text-slate-600">
                        {rec.invoiceNumber === 'NONE' ? '免用發票' : rec.invoiceNumber === 'PENDING_NEXT' ? '下期補票' : (
                          <span className="font-mono text-indigo-700 font-semibold">{rec.invoiceNumber}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right">
                        <div className="font-bold text-indigo-700">NT$ {rec.netPayableAmount.toLocaleString()}</div>
                        <div className="text-[10px] font-sans text-slate-400">
                          含稅 NT$ {rec.taxAmount.toLocaleString()}
                        </div>
                      </td>
                      <td className="p-2.5 font-sans">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          isOverdue
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : isDueSoon
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'text-slate-600'
                        }`}>
                          <span className="font-mono">{rec.paymentDueDate}</span>
                          {isOverdue && <span>· ⚠️ 逾期請催出納</span>}
                          {isDueSoon && <span>· ⏰ 即將到期</span>}
                        </span>
                      </td>
                      <td className="p-2.5 font-sans text-[11px] text-slate-600">
                        <div>{rec.approvedBy || rec.reconciledBy || '會計'}</div>
                        <div className="text-[10px] text-slate-400">已送出 {waitDays} 天</div>
                      </td>
                      <td className="p-2.5 text-center font-sans space-x-1">
                        {canEditCashier ? (
                          <button
                            onClick={() => onOpenPayment(rec)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            放款出金
                          </button>
                        ) : (
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            ⏳ 出納排程放款中
                          </span>
                        )}
                        {canEditAccounting && (
                          <button
                            onClick={() => onOpenVoidRec(rec.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            title="出納尚未放款前，會計可抽回作廢並釋放進貨單回大水池"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* C. 已完全完工結清備查清冊 */}
      <ApArchiveTable
        filteredRecs={filteredRecs}
        payments={payments}
        companies={companies}
        taxRatePct={taxRatePct}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedStatusFilter={selectedStatusFilter}
        onStatusFilterChange={setSelectedStatusFilter}
        canEditAccounting={canEditAccounting}
        canEditCashier={canEditCashier}
        onOpenEditRec={onOpenEditRec}
        onOpenPayment={onOpenPayment}
        onOpenReturnRec={onOpenReturnRec}
        onOpenVoidRec={onOpenVoidRec}
      />
    </div>
  );
};
