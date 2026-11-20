// src/components/finance/CheckRadarMiniApp.tsx
// 🎫 獨立小程式：應收付票據統計管理與資金三燈號雷達 (Check Lifecycle & Cash Radar)

import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Clock,
  CreditCard,
  Search,
  X,
} from 'lucide-react';
import {
  AccountReceivable,
  AccountsPayableReconciliation,
  BankCheck,
} from '../../types/erp';
import {
  relinkCheckToAp,
  updateBankCheckStatus,
} from '../../db/sqlite';

interface CheckRadarMiniAppProps {
  checks: BankCheck[];
  reconciliations: AccountsPayableReconciliation[];
  arList: AccountReceivable[];
  canEditCashier: boolean;
  operatorName: string;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onRefresh: () => void;
}

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const CheckRadarMiniApp: React.FC<CheckRadarMiniAppProps> = ({
  checks,
  reconciliations,
  arList,
  canEditCashier,
  operatorName,
  onNotify,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [checkTypeFilter, setCheckTypeFilter] = useState<'ALL' | 'PAYABLE' | 'RECEIVABLE'>('ALL');
  const [checkStatusFilter, setCheckStatusFilter] = useState<'ALL' | 'ISSUED' | 'CLEARED' | 'BOUNCED' | 'VOIDED'>('ALL');
  const [checkDueDateStart, setCheckDueDateStart] = useState<string>('');
  const [checkDueDateEnd, setCheckDueDateEnd] = useState<string>('');
  const [checkSortBy, setCheckSortBy] = useState<'DUE_ASC' | 'DUE_DESC' | 'ISSUE_DESC' | 'AMT_DESC'>('DUE_ASC');

  // 支票狀態流轉 Modal
  const [selectedCheckForAction, setSelectedCheckForAction] = useState<BankCheck | null>(null);
  const [checkActionType, setCheckActionType] = useState<'CLEAR' | 'BOUNCE' | 'VOID'>('CLEAR');
  const [checkActualClearDate, setCheckActualClearDate] = useState<string>(() => formatLocalYmd(new Date()));
  const [checkActionReason, setCheckActionReason] = useState<string>('');
  const [bounceRollbackMode, setBounceRollbackMode] = useState<'REPAY' | 'REBILL'>('REPAY');

  // 退票／支票手動重新關聯 AP Modal
  const [relinkCheckTarget, setRelinkCheckTarget] = useState<BankCheck | null>(null);
  const [relinkApId, setRelinkApId] = useState<string>('');
  const [relinkReplacesCheckNo, setRelinkReplacesCheckNo] = useState<string>('');

  const filteredChecks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = checks.filter(c => {
      const matchType = checkTypeFilter === 'ALL' || c.type === checkTypeFilter;
      const matchStatus = checkStatusFilter === 'ALL' || c.status === checkStatusFilter;
      const matchDueStart = !checkDueDateStart || c.dueDate >= checkDueDateStart;
      const matchDueEnd = !checkDueDateEnd || c.dueDate <= checkDueDateEnd;
      const matchSearch =
        q === '' ||
        c.checkNumber.toLowerCase().includes(q) ||
        c.counterpartyName.toLowerCase().includes(q) ||
        c.bankName.toLowerCase().includes(q) ||
        (c.dueDate && c.dueDate.toLowerCase().includes(q)) ||
        (c.issueDate && c.issueDate.toLowerCase().includes(q)) ||
        (c.actualClearanceDate && c.actualClearanceDate.toLowerCase().includes(q));
      return matchType && matchStatus && matchDueStart && matchDueEnd && matchSearch;
    });

    return [...list].sort((a, b) => {
      if (checkSortBy === 'DUE_ASC') {
        return a.dueDate.localeCompare(b.dueDate) || a.checkNumber.localeCompare(b.checkNumber);
      }
      if (checkSortBy === 'DUE_DESC') {
        return b.dueDate.localeCompare(a.dueDate) || b.checkNumber.localeCompare(a.checkNumber);
      }
      if (checkSortBy === 'ISSUE_DESC') {
        return b.issueDate.localeCompare(a.issueDate) || b.checkNumber.localeCompare(a.checkNumber);
      }
      return b.amount - a.amount;
    });
  }, [checks, checkTypeFilter, checkStatusFilter, checkDueDateStart, checkDueDateEnd, checkSortBy, searchQuery]);

  // 依「預計兌現日」統計每日應付資金需求
  const checkDueSummary = useMemo(() => {
    let payableUnclearedTotal = 0;
    let payableClearedTotal = 0;
    let receivableTotal = 0;
    const dailyMap: Record<string, { dueDate: string; count: number; issuedAmount: number; clearedAmount: number; totalAmount: number }> = {};

    filteredChecks.forEach(c => {
      if (c.status === 'VOIDED' || c.status === 'BOUNCED') return;
      if (c.type === 'PAYABLE') {
        if (c.status === 'ISSUED') payableUnclearedTotal += c.amount;
        if (c.status === 'CLEARED') payableClearedTotal += c.amount;
        const key = c.dueDate || '未定日期';
        if (!dailyMap[key]) {
          dailyMap[key] = { dueDate: key, count: 0, issuedAmount: 0, clearedAmount: 0, totalAmount: 0 };
        }
        dailyMap[key].count += 1;
        if (c.status === 'ISSUED') dailyMap[key].issuedAmount += c.amount;
        if (c.status === 'CLEARED') dailyMap[key].clearedAmount += c.amount;
        dailyMap[key].totalAmount += c.amount;
      } else {
        receivableTotal += c.amount;
      }
    });

    const dailyPayables = Object.values(dailyMap).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return {
      payableUnclearedTotal,
      payableClearedTotal,
      payableAllTotal: payableUnclearedTotal + payableClearedTotal,
      receivableTotal,
      dailyPayables,
    };
  }, [filteredChecks]);

  const handleExecuteCheckAction = () => {
    if (!selectedCheckForAction) return;
    try {
      if (checkActionType === 'CLEAR') {
        updateBankCheckStatus(
          selectedCheckForAction.id,
          'CLEARED',
          checkActualClearDate,
          undefined,
          operatorName
        );
        onNotify(
          selectedCheckForAction.type === 'RECEIVABLE'
            ? `🟢 應收支票【${selectedCheckForAction.checkNumber}】已確認存摺兌現！已正式加計收款銀行真實餘額。`
            : `🟢 支票【${selectedCheckForAction.checkNumber}】已確認存摺兌現！已正式扣減銀行真實餘額。`,
          'success'
        );
      } else if (checkActionType === 'BOUNCE') {
        if (!checkActionReason.trim()) {
          onNotify('跳票退票必須填寫原因！', 'warn');
          return;
        }
        updateBankCheckStatus(
          selectedCheckForAction.id,
          'BOUNCED',
          undefined,
          checkActionReason,
          operatorName,
          { rollbackMode: bounceRollbackMode }
        );
        onNotify(
          selectedCheckForAction.type === 'RECEIVABLE'
            ? `🚨【應收票據退票】支票【${selectedCheckForAction.checkNumber}】已記錄跳票，系統已自動回滾還原應收請款單 (AR) 待收餘額！`
            : bounceRollbackMode === 'REBILL'
            ? `🚨【退票整筆退回】支票【${selectedCheckForAction.checkNumber}】已作廢退票，原對帳單已作廢並釋放進貨單回待對帳水池！`
            : `🚨【退票待重付】支票【${selectedCheckForAction.checkNumber}】已記錄退票，源頭對帳單已復活為「待出金放款」並註記換補票！`,
          'error'
        );
      } else if (checkActionType === 'VOID') {
        if (!checkActionReason.trim()) {
          onNotify('支票作廢必須填寫原因！', 'warn');
          return;
        }
        updateBankCheckStatus(
          selectedCheckForAction.id,
          'VOIDED',
          undefined,
          checkActionReason,
          operatorName
        );
        onNotify(`🛡️ 支票【${selectedCheckForAction.checkNumber}】已作廢！源頭帳務已自動執行反向沖銷。`, 'warn');
      }

      setSelectedCheckForAction(null);
      setCheckActionReason('');
      onRefresh();
    } catch (e: any) {
      onNotify(`支票操作失敗：${e.message}`, 'error');
    }
  };

  const handleConfirmRelinkCheck = () => {
    if (!relinkCheckTarget) return;
    if (!relinkApId) {
      onNotify('請選擇要關聯的應付對帳單！', 'warn');
      return;
    }
    try {
      relinkCheckToAp(
        relinkCheckTarget.id,
        relinkApId,
        relinkReplacesCheckNo.trim() || undefined,
        operatorName
      );
      onNotify(`✅ 支票【${relinkCheckTarget.checkNumber}】已成功重新關聯至對帳單！`, 'success');
      setRelinkCheckTarget(null);
      setRelinkApId('');
      setRelinkReplacesCheckNo('');
      onRefresh();
    } catch (e: any) {
      onNotify(`關聯失敗：${e.message}`, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-800">
              應收付票據三燈號生命週期與資金雷達 (Check Lifecycle & Cash Radar)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCheckTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                checkTypeFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              全部票據
            </button>
            <button
              type="button"
              onClick={() => setCheckTypeFilter('PAYABLE')}
              className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                checkTypeFilter === 'PAYABLE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              應付票據 (廠商)
            </button>
            <button
              type="button"
              onClick={() => setCheckTypeFilter('RECEIVABLE')}
              className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                checkTypeFilter === 'RECEIVABLE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              應收票據 (業主)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>🟡 黃燈：已開票/收票未兌現 (ISSUED)</span>
            </div>
            <div className="text-[11px] text-amber-800 leading-relaxed">
              期票已開立或收取，債權債務催款警報解除，但<b>實體銀行存款絕對不增減</b>。僅依據預計兌現日排程於資金雷達時間軸。
            </div>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>🟢 綠燈：存摺已兌現結清 (CLEARED)</span>
            </div>
            <div className="text-[11px] text-emerald-800 leading-relaxed">
              出納刷實體存摺確認扣款或入帳後點擊「確認兌現」，<b>實體銀行餘額正式變動</b>，單據徹底結清閉案。
            </div>
          </div>

          <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-rose-900 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>🔴 紅燈：退票跳票與單據回滾 (BOUNCED)</span>
            </div>
            <div className="text-[11px] text-rose-800 leading-relaxed">
              發生退票時，自動發送最高警報，並<b>瞬間將源頭應付／應收單據退回待處理狀態</b>，保留審計軌跡。
            </div>
          </div>
        </div>

        {/* 票據兌現日搜尋、區間篩選、排序與每日到期金額統計 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋票號、對象、銀行或兌現日期 (2026-11-17)..."
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 w-64"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2 py-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-[11px] font-bold text-slate-600 shrink-0">兌現日:</span>
                <input
                  type="date"
                  value={checkDueDateStart}
                  onChange={(e) => setCheckDueDateStart(e.target.value)}
                  className="text-xs font-mono font-bold text-slate-800 outline-none bg-transparent"
                  title="預計兌現日起日"
                />
                <span className="text-slate-400">~</span>
                <input
                  type="date"
                  value={checkDueDateEnd}
                  onChange={(e) => setCheckDueDateEnd(e.target.value)}
                  className="text-xs font-mono font-bold text-slate-800 outline-none bg-transparent"
                  title="預計兌現日迄日"
                />
              </div>

              <select
                value={checkStatusFilter}
                onChange={(e) => setCheckStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="ALL">全部燈號狀態</option>
                <option value="ISSUED">🟡 黃燈 (未兌現)</option>
                <option value="CLEARED">🟢 綠燈 (已兌現)</option>
                <option value="BOUNCED">🔴 紅燈 (退票跳票)</option>
                <option value="VOIDED">已作廢</option>
              </select>

              <select
                value={checkSortBy}
                onChange={(e) => setCheckSortBy(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-indigo-800 outline-none"
                title="票據排序方式"
              >
                <option value="DUE_ASC">排序：預計兌現日 (由近到遠 ↑)</option>
                <option value="DUE_DESC">排序：預計兌現日 (由遠到近 ↓)</option>
                <option value="ISSUE_DESC">排序：開票日期 (新 → 舊)</option>
                <option value="AMT_DESC">排序：票面金額 (大 → 小)</option>
              </select>
            </div>

            {/* 兌現日快捷按鈕 */}
            <div className="flex flex-wrap items-center gap-1">
              {(() => {
                const now = new Date();
                const todayStr = formatLocalYmd(now);
                const next7Str = formatLocalYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
                const next30Str = formatLocalYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30));
                const monthStartStr = formatLocalYmd(new Date(now.getFullYear(), now.getMonth(), 1));
                const monthEndStr = formatLocalYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => { setCheckDueDateStart(''); setCheckDueDateEnd(''); }}
                      className={`px-2 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                        !checkDueDateStart && !checkDueDateEnd
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      全部日期
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCheckDueDateStart(todayStr); setCheckDueDateEnd(todayStr); }}
                      className={`px-2 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                        checkDueDateStart === todayStr && checkDueDateEnd === todayStr
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50'
                      }`}
                    >
                      今日到期
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCheckDueDateStart(todayStr); setCheckDueDateEnd(next7Str); }}
                      className={`px-2 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                        checkDueDateStart === todayStr && checkDueDateEnd === next7Str
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50'
                      }`}
                    >
                      未來 7 天
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCheckDueDateStart(todayStr); setCheckDueDateEnd(next30Str); }}
                      className={`px-2 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                        checkDueDateStart === todayStr && checkDueDateEnd === next30Str
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50'
                      }`}
                    >
                      未來 30 天
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCheckDueDateStart(monthStartStr); setCheckDueDateEnd(monthEndStr); }}
                      className={`px-2 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                        checkDueDateStart === monthStartStr && checkDueDateEnd === monthEndStr
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50'
                      }`}
                    >
                      本月到期
                    </button>
                  </>
                );
              })()}
            </div>
          </div>

          {/* 依兌現日期每日應付資金統計列 */}
          <div className="pt-2 border-t border-slate-200/80 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>📅 篩選範圍內各兌現日應付票據金額統計（點擊日期可單日對帳）：</span>
              </span>
              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                <span className="text-amber-800 font-bold">
                  🟡 待兌現應付: NT$ {checkDueSummary.payableUnclearedTotal.toLocaleString()}
                </span>
                <span className="text-emerald-700 font-bold">
                  🟢 已兌現應付: NT$ {checkDueSummary.payableClearedTotal.toLocaleString()}
                </span>
                <span className="text-indigo-800 font-black">
                  應付合計: NT$ {checkDueSummary.payableAllTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {checkDueSummary.dailyPayables.length === 0 ? (
              <div className="text-[11px] text-slate-400">目前篩選條件下無有效應付支票統計資料</div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {checkDueSummary.dailyPayables.map(day => {
                  const isSelectedDay = checkDueDateStart === day.dueDate && checkDueDateEnd === day.dueDate;
                  return (
                    <button
                      key={day.dueDate}
                      type="button"
                      onClick={() => {
                        if (isSelectedDay) {
                          setCheckDueDateStart('');
                          setCheckDueDateEnd('');
                        } else {
                          setCheckDueDateStart(day.dueDate);
                          setCheckDueDateEnd(day.dueDate);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                        isSelectedDay
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : day.issuedAmount > 0
                          ? 'bg-amber-50/80 text-amber-950 border-amber-300 hover:bg-amber-100'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                      title={`預計兌現日 ${day.dueDate}：共 ${day.count} 張，待兌現 NT$ ${day.issuedAmount.toLocaleString()} / 已兌現 NT$ ${day.clearedAmount.toLocaleString()}`}
                    >
                      <span className="font-bold">{day.dueDate}</span>
                      <span className="opacity-75">({day.count}張)</span>
                      <span className="font-black">NT$ {day.totalAmount.toLocaleString()}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 支票台帳表格 */}
        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5">支票票號</th>
                <th className="p-2.5 text-center">票據方向</th>
                <th className="p-2.5">對象 (受款/發票人)</th>
                <th className="p-2.5">開票銀行</th>
                <th className="p-2.5 text-right">票面金額</th>
                <th className="p-2.5">開票日期</th>
                <th className="p-2.5">
                  <button
                    type="button"
                    onClick={() => setCheckSortBy(prev => prev === 'DUE_ASC' ? 'DUE_DESC' : 'DUE_ASC')}
                    className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                    title="點擊切換依預計兌現日升冪／降冪排序"
                  >
                    <span>預計兌現日</span>
                    {checkSortBy === 'DUE_ASC' ? (
                      <ArrowUp className="w-3.5 h-3.5" />
                    ) : checkSortBy === 'DUE_DESC' ? (
                      <ArrowDown className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                    )}
                  </button>
                </th>
                <th className="p-2.5">實際兌現日</th>
                <th className="p-2.5 text-center">三燈號狀態</th>
                <th className="p-2.5 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredChecks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-400 font-sans">
                    查無符合條件的票據紀錄
                  </td>
                </tr>
              ) : (
                filteredChecks.map((chk) => {
                  const linkedAp = chk.reconciledApId
                    ? reconciliations.find(r => r.id === chk.reconciledApId)
                    : undefined;
                  const linkedAr = chk.reconciledArId
                    ? arList.find(a => a.id === chk.reconciledArId)
                    : undefined;
                  return (
                    <tr key={chk.id} className="hover:bg-slate-50">
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900">{chk.checkNumber}</div>
                        {chk.replacesCheckNumber && (
                          <div className="text-[10px] font-sans font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded inline-block mt-0.5">
                            補換原票: {chk.replacesCheckNumber}
                          </div>
                        )}
                        {linkedAp && (
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            關聯應付: {linkedAp.reconciliationNumber}
                          </div>
                        )}
                        {linkedAr && (
                          <div className="text-[10px] font-mono text-emerald-700 mt-0.5">
                            關聯應收: {linkedAr.arNumber}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-sans">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          chk.type === 'PAYABLE' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {chk.type === 'PAYABLE' ? '應付票據' : '應收票據'}
                        </span>
                      </td>
                      <td className="p-2.5 font-sans font-bold text-slate-800">{chk.counterpartyName}</td>
                      <td className="p-2.5 font-sans text-slate-600">{chk.bankName}</td>
                      <td className="p-2.5 text-right font-black text-slate-900">
                        NT$ {chk.amount.toLocaleString()}
                      </td>
                      <td className="p-2.5 font-sans text-slate-600">{chk.issueDate}</td>
                      <td className="p-2.5 font-sans text-slate-700 font-bold">{chk.dueDate}</td>
                      <td className="p-2.5 font-sans text-slate-500">{chk.actualClearanceDate || '-'}</td>
                      <td className="p-2.5 text-center font-sans">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          chk.status === 'ISSUED' ? 'bg-amber-100 text-amber-800' :
                          chk.status === 'CLEARED' ? 'bg-emerald-100 text-emerald-800' :
                          chk.status === 'BOUNCED' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            chk.status === 'ISSUED' ? 'bg-amber-500' :
                            chk.status === 'CLEARED' ? 'bg-emerald-500' :
                            chk.status === 'BOUNCED' ? 'bg-rose-600' : 'bg-slate-400'
                          }`} />
                          <span>
                            {chk.status === 'ISSUED' ? '黃燈 (未兌現)' :
                             chk.status === 'CLEARED' ? '綠燈 (已兌現)' :
                             chk.status === 'BOUNCED' ? '紅燈 (退票跳票)' : '已作廢'}
                          </span>
                        </span>
                        {(chk.status === 'BOUNCED' || chk.status === 'VOIDED') && chk.voidReason && (
                          <div className="text-[10px] text-rose-700 mt-0.5 max-w-[140px] mx-auto truncate" title={chk.voidReason}>
                            {chk.voidReason}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-sans space-x-1">
                        {canEditCashier ? (
                          <>
                            {chk.status === 'ISSUED' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCheckForAction(chk);
                                    setCheckActionType('CLEAR');
                                    setCheckActualClearDate(formatLocalYmd(new Date()));
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                                >
                                  確認兌現
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCheckForAction(chk);
                                    setCheckActionType('BOUNCE');
                                    setBounceRollbackMode('REPAY');
                                    setCheckActionReason('');
                                  }}
                                  className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                                >
                                  退票回滾
                                </button>
                              </>
                            )}
                            {chk.type === 'PAYABLE' && chk.status !== 'VOIDED' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRelinkCheckTarget(chk);
                                  setRelinkApId(chk.reconciledApId || '');
                                  setRelinkReplacesCheckNo(chk.replacesCheckNumber || '');
                                }}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                                title="重新關聯應付對帳單或補登換票原票號"
                              >
                                重新關聯
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400">唯讀</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: 支票動作處理 (存摺兌現 / 退票跳票 / 作廢) */}
      {selectedCheckForAction && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>
                  {checkActionType === 'CLEAR'
                    ? '支票存摺兌現結清'
                    : checkActionType === 'BOUNCE'
                    ? selectedCheckForAction.type === 'RECEIVABLE'
                      ? '應收支票退票 (回滾 AR 待收餘額)'
                      : '支票退票 (觸發 AP 復活)'
                    : '支票作廢'}
                </span>
              </h3>
              <button onClick={() => setSelectedCheckForAction(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">票號：</span>
                <span className="font-mono font-bold text-slate-900">{selectedCheckForAction.checkNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{selectedCheckForAction.type === 'RECEIVABLE' ? '開票業主：' : '受款對象：'}</span>
                <span className="font-bold text-slate-800">{selectedCheckForAction.counterpartyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">票面金額：</span>
                <span className="font-mono font-bold text-indigo-700">NT$ {selectedCheckForAction.amount.toLocaleString()}</span>
              </div>
            </div>

            {checkActionType === 'CLEAR' ? (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {selectedCheckForAction.type === 'RECEIVABLE'
                    ? '存摺兌現入帳日期 (T+0 實際入庫日)'
                    : '存摺扣款入帳日期 (T+0 實際扣減日)'}
                </label>
                <input
                  type="date"
                  value={checkActualClearDate}
                  onChange={(e) => setCheckActualClearDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {selectedCheckForAction.type === 'RECEIVABLE'
                    ? '點擊確認後，將正式加計該收款銀行帳戶真實餘額，並將對應 AR 收款紀錄轉為正式入帳 (POSTED)。'
                    : '點擊確認後，將正式扣除該開票銀行帳戶真實餘額，單據徹底結案。'}
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {checkActionType === 'BOUNCE' && selectedCheckForAction.type === 'RECEIVABLE' && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-900 leading-relaxed">
                    <b>📌 應收票據退票自動回滾說明：</b>
                    <br />
                    業主支票跳票／退票時，系統將作廢此張支票與待兌現收款紀錄，並自動還原對應應收請款單 (AR) 之未收餘額與狀態（含退票票號留痕），方便後續重新催收或換票。
                  </div>
                )}

                {checkActionType === 'BOUNCE' && selectedCheckForAction.type === 'PAYABLE' && (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-800">
                      選擇退票後續帳務處理方式
                    </label>
                    <label className={`block p-2.5 rounded-lg border cursor-pointer transition-all ${
                      bounceRollbackMode === 'REPAY'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-950'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}>
                      <div className="flex items-center gap-2 font-bold">
                        <input
                          type="radio"
                          name="bounceMode"
                          checked={bounceRollbackMode === 'REPAY'}
                          onChange={() => setBounceRollbackMode('REPAY')}
                          className="text-indigo-600"
                        />
                        <span>1. 退回重新付款（保留原對帳單與發票）</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 pl-5">
                        僅沖銷此筆支票與付款單，對帳單退回「待出金放款 (APPROVED)」並記錄退票票號，方便直接換補票或改電匯重付。
                      </p>
                    </label>

                    <label className={`block p-2.5 rounded-lg border cursor-pointer transition-all ${
                      bounceRollbackMode === 'REBILL'
                        ? 'bg-rose-50 border-rose-500 text-rose-950'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}>
                      <div className="flex items-center gap-2 font-bold">
                        <input
                          type="radio"
                          name="bounceMode"
                          checked={bounceRollbackMode === 'REBILL'}
                          onChange={() => setBounceRollbackMode('REBILL')}
                          className="text-rose-600"
                        />
                        <span>2. 退回重新請款（整筆交易退回重來）</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 pl-5">
                        將本支票、付款單與原對帳單一併作廢沖銷，所屬進貨簽收單全部釋放回待對帳水池重新請款。
                      </p>
                    </label>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-rose-700 mb-1">
                    退票/作廢原因說明 (強制留痕)
                  </label>
                  <textarea
                    rows={3}
                    value={checkActionReason}
                    onChange={(e) => setCheckActionReason(e.target.value)}
                    placeholder="例如: 印鑑不符退票 / 廠商通知換票..."
                    className="w-full bg-white border border-rose-300 rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <span className="text-[10px] text-rose-600 mt-1 block font-bold">
                    🛡️ 逆向防線：系統將自動保留完整作廢／退票紀錄與原付款單追蹤歷程！
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedCheckForAction(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleExecuteCheckAction}
                className={`px-4 py-1.5 rounded-lg font-bold text-white text-xs shadow-2xs ${
                  checkActionType === 'CLEAR' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {checkActionType === 'CLEAR' ? '確認存摺兌現' : '確認退票回滾'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: 支票重新關聯對帳單 / 換補票登錄 */}
      {relinkCheckTarget && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>支票重新關聯對帳單 / 換補票註記</span>
              </h3>
              <button onClick={() => setRelinkCheckTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">現行支票票號：</span>
                <span className="font-mono font-bold text-slate-900">{relinkCheckTarget.checkNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">受款對象：</span>
                <span className="font-bold text-slate-800">{relinkCheckTarget.counterpartyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">票面金額：</span>
                <span className="font-mono font-bold text-indigo-700">NT$ {relinkCheckTarget.amount.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                關聯至應付對帳單 <span className="text-rose-500">*</span>
              </label>
              <select
                value={relinkApId}
                onChange={(e) => setRelinkApId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
              >
                <option value="">-- 請選擇應付對帳單 --</option>
                {reconciliations
                  .filter(r => r.status !== 'VOIDED')
                  .map(r => (
                    <option key={r.id} value={r.id}>
                      {r.reconciliationNumber} · {r.vendorName} (NT$ {r.netPayableAmount.toLocaleString()}) [{r.status}]
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                原退票／作廢替換票號 (選填)
              </label>
              <input
                type="text"
                value={relinkReplacesCheckNo}
                onChange={(e) => setRelinkReplacesCheckNo(e.target.value)}
                placeholder="例: CQ-001001"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRelinkCheckTarget(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmRelinkCheck}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-2xs"
              >
                確認儲存關聯
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
