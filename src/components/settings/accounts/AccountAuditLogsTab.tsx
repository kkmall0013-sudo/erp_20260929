import React from 'react';
import { RotateCcw, ScrollText, Search } from 'lucide-react';
import { AuditLog, Company, User, UserGroup } from '../../../types/erp';
import {
  getRoleLabelCn,
  translateAuditAction,
  translateAuditKey,
  translateAuditTable,
  translateAuditTarget,
  translateAuditValue,
} from './accountManagementUtils';

interface AccountAuditLogsTabProps {
  filteredAuditLogs: AuditLog[];
  allUsers: User[];
  allGroups: UserGroup[];
  companies: Company[];
  auditSearchTerm: string;
  onAuditSearchTermChange: (val: string) => void;
  auditActionFilter: string;
  onAuditActionFilterChange: (val: string) => void;
  auditUserFilter: string;
  onAuditUserFilterChange: (val: string) => void;
  onRefresh: () => void;
}

export const AccountAuditLogsTab: React.FC<AccountAuditLogsTabProps> = ({
  filteredAuditLogs,
  allUsers,
  allGroups,
  companies,
  auditSearchTerm,
  onAuditSearchTermChange,
  auditActionFilter,
  onAuditActionFilterChange,
  auditUserFilter,
  onAuditUserFilterChange,
  onRefresh,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-slate-900 text-slate-200 border border-slate-700 rounded-xl p-4 flex items-start justify-between gap-3 shadow-sm">
        <div className="flex items-start gap-3">
          <ScrollText className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-bold text-white flex items-center gap-2">
              <span>全域系統安全與操作稽核日誌（最高管理者專屬追蹤）</span>
              <span className="text-[10px] bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700">
                唯讀防竄改・純中文差異紀錄
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              系統自動以純中文記錄所有關鍵操作軌跡，不顯示系統代號；針對資料修改事件，僅精準記錄「有實際修改的項目（修改前 ➔ 修改後）」，一目了然掌握何人、何時、修改了哪個具體項目。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-600 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          title="重新整理最新日誌"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>重新整理</span>
        </button>
      </div>

      {/* 稽核日誌篩選工具列 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 text-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={auditSearchTerm}
              onChange={e => onAuditSearchTermChange(e.target.value)}
              placeholder="搜尋操作人員、異動對象或修改內容關鍵字..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-medium">操作動作：</span>
              <select
                value={auditActionFilter}
                onChange={e => onAuditActionFilterChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">全部操作類型</option>
                <option value="LOGIN">登入系統與切換身分</option>
                <option value="CREATE">新增建立資料</option>
                <option value="UPDATE">修改資料與單據過帳</option>
                <option value="DELETE">刪除、回收與封存</option>
                <option value="PASSWORD">密碼重設與變更</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-medium">操作人員：</span>
              <select
                value={auditUserFilter}
                onChange={e => onAuditUserFilterChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">全部同仁</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.fullName}>
                    {u.fullName}（{getRoleLabelCn(u.role)}）
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
          <span>
            共檢索出 <strong className="text-slate-900 font-bold">{filteredAuditLogs.length}</strong>{' '}
            筆操作紀錄（最新時間優先排序）
          </span>
          <span className="text-emerald-700 font-medium">僅記錄實際修改差異項目・全中文直觀呈現</span>
        </div>
      </div>

      {/* 稽核日誌表格 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-3.5 whitespace-nowrap">紀錄時間</th>
                <th className="py-3 px-3 whitespace-nowrap">操作人員</th>
                <th className="py-3 px-3 whitespace-nowrap text-center">操作動作</th>
                <th className="py-3 px-3 whitespace-nowrap">異動項目與對象</th>
                <th className="py-3 px-3">修改內容明細（僅記錄實際異動部分）</th>
                <th className="py-3 px-3 whitespace-nowrap text-right">操作來源</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAuditLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <ScrollText className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-60" />
                    <div>查無符合條件的操作稽核紀錄</div>
                  </td>
                </tr>
              ) : (
                filteredAuditLogs.map(log => {
                  const actionCn = translateAuditAction(log.action);
                  const tableCn = translateAuditTable(log.targetTable);
                  const targetCn = translateAuditTarget(
                    log.targetId,
                    allUsers,
                    allGroups,
                    companies
                  );

                  const isLogin = actionCn.includes('登入');
                  const isCreate = actionCn.includes('新增');
                  const isDelete =
                    actionCn.includes('刪除') ||
                    actionCn.includes('回收') ||
                    actionCn.includes('封存') ||
                    actionCn.includes('清除');
                  const isUpdate =
                    actionCn.includes('修改') ||
                    actionCn.includes('過帳') ||
                    actionCn.includes('復原') ||
                    actionCn.includes('救回') ||
                    actionCn.includes('交接') ||
                    actionCn.includes('密碼');

                  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (isLogin) badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
                  else if (isCreate) badgeColor = 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
                  else if (isDelete) badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
                  else if (isUpdate) badgeColor = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';

                  const operatorObj = allUsers.find(
                    u => u.fullName === log.userName || u.id === log.userId
                  );
                  const operatorRoleCn = operatorObj
                    ? getRoleLabelCn(operatorObj.role)
                    : log.userId &&
                      !/^[A-Za-z0-9_-]+$/.test(log.userId) &&
                      log.userId !== log.userName
                    ? log.userId
                    : '系統操作員';

                  let parsedBefore: Record<string, unknown> | null = null;
                  let parsedAfter: Record<string, unknown> | null = null;
                  try {
                    if (log.beforeJson) parsedBefore = JSON.parse(log.beforeJson);
                  } catch {
                    // ignore malformed json
                  }
                  try {
                    if (log.afterJson) parsedAfter = JSON.parse(log.afterJson);
                  } catch {
                    // ignore malformed json
                  }

                  const diffEntries: {
                    label: string;
                    beforeVal?: string;
                    afterVal: string;
                    isDiff: boolean;
                  }[] = [];

                  if (
                    parsedBefore &&
                    parsedAfter &&
                    typeof parsedBefore === 'object' &&
                    typeof parsedAfter === 'object'
                  ) {
                    const allKeys = Array.from(
                      new Set([...Object.keys(parsedBefore), ...Object.keys(parsedAfter)])
                    );
                    for (const k of allKeys) {
                      if (k === 'username' || k === '登入帳號' || k === 'id' || k === 'updatedAt') continue;
                      const bVal =
                        parsedBefore[k] !== undefined
                          ? translateAuditValue(parsedBefore[k], allUsers, allGroups, companies)
                          : undefined;
                      const aVal =
                        parsedAfter[k] !== undefined
                          ? translateAuditValue(parsedAfter[k], allUsers, allGroups, companies)
                          : '無';
                      if (bVal !== undefined && bVal !== aVal) {
                        diffEntries.push({
                          label: translateAuditKey(k),
                          beforeVal: bVal,
                          afterVal: aVal,
                          isDiff: true,
                        });
                      } else if (bVal === undefined) {
                        diffEntries.push({
                          label: translateAuditKey(k),
                          afterVal: aVal,
                          isDiff: false,
                        });
                      }
                    }
                  } else if (parsedAfter && typeof parsedAfter === 'object') {
                    for (const [k, v] of Object.entries(parsedAfter)) {
                      if (k === 'username' || k === '登入帳號' || k === 'id' || k === 'updatedAt') continue;
                      diffEntries.push({
                        label: translateAuditKey(k),
                        afterVal: translateAuditValue(v, allUsers, allGroups, companies),
                        isDiff: false,
                      });
                    }
                  }

                  const ipDisplay =
                    !log.ipAddress ||
                    log.ipAddress.includes('127.0.0.1') ||
                    log.ipAddress.includes('192.168.1.')
                      ? '公司內網'
                      : log.ipAddress.includes('192.168.20.')
                      ? '工地內網'
                      : log.ipAddress;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5 text-[11px] text-slate-600 whitespace-nowrap">
                        {log.createdAt}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{log.userName}</div>
                        <div className="text-[10px] text-slate-400">{operatorRoleCn}</div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] border ${badgeColor}`}>
                          {actionCn}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-xs">
                        <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px] font-bold mr-1.5">
                          {tableCn}
                        </span>
                        <span className="font-bold text-slate-800">{targetCn}</span>
                      </td>
                      <td className="py-3 px-3">
                        {diffEntries.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {diffEntries.map((item, idx) =>
                              item.isDiff ? (
                                <div
                                  key={`${item.label}-${idx}`}
                                  className="inline-flex items-center gap-1.5 bg-amber-50/70 text-slate-800 px-2.5 py-1 rounded-md text-[11px] border border-amber-200/90 shadow-2xs"
                                >
                                  <span className="font-bold text-slate-700">{item.label}：</span>
                                  <span className="text-slate-500 line-through decoration-slate-400 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                    {item.beforeVal}
                                  </span>
                                  <span className="text-amber-600 font-bold">➔</span>
                                  <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    {item.afterVal}
                                  </span>
                                </div>
                              ) : (
                                <span
                                  key={`${item.label}-${idx}`}
                                  className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] border border-slate-200"
                                >
                                  <span className="text-slate-500">{item.label}：</span>
                                  <strong className="text-slate-900">{item.afterVal}</strong>
                                </span>
                              )
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-600">{actionCn}完成</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-[11px] text-slate-500 whitespace-nowrap">
                        {ipDisplay}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
