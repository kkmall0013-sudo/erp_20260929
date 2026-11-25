import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const DatabaseSchemaAuditTab: React.FC = () => {
  return (
    <div className="space-y-5">
      <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-4 text-xs text-purple-950 leading-relaxed flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm text-purple-950 mb-1">
            全系統資料庫欄位重複性審核與既有欄位重用總表 (SSoT Field Audit)
          </h4>
          <p className="text-purple-800/90">
            依據《ERP全模組資料庫欄位與用途總表.md》最新審核結果，已全面盤點 26 張 SQLite 實體資料表，淘汰同義重複欄位與廢棄舊表，100% 優先重用既有對應欄位並對齊三柱版本規範（<code>id</code>、<code>version</code>、<code>createdAt</code>/<code>updatedAt</code>）。
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-800 text-white text-xs font-bold flex items-center justify-between">
          <span>一、欄位去重與既有欄位重用審核決策表</span>
          <span className="text-[11px] font-normal text-emerald-300">✓ 已通過單一真實來源 (SSoT) 審核</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="py-2.5 px-3 border-r border-slate-200 w-44">模組／實體資料表</th>
                <th className="py-2.5 px-3 border-r border-slate-200 w-56">原先潛在重複或雙重定義欄位</th>
                <th className="py-2.5 px-3 border-r border-slate-200 w-52">審核後唯一採用標準欄位</th>
                <th className="py-2.5 px-3">審核決策與既有欄位重用說明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr className="hover:bg-slate-50">
                <td className="py-2.5 px-3 border-r border-slate-100 font-bold">User (<code>users</code>)</td>
                <td className="py-2.5 px-3 border-r border-slate-100 font-mono text-rose-600">name vs fullName</td>
                <td className="py-2.5 px-3 border-r border-slate-100 font-mono font-bold text-emerald-700">fullName</td>
                <td className="py-2.5 px-3">統一使用 <code>fullName</code> 儲存同仁真實中文全名，廢除 <code>name</code> 別名，避免與 <code>username</code>（登入帳號）混淆。</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-2.5 px-3 border-r border-slate-100 font-bold">User (<code>users</code>)</td>
                <td className="py-2.5 px-3 border-r border-slate-100 font-mono text-rose-600">deleteStage vs isDeleted / isGhost</td>
                <td className="py-2.5 px-3 border-r border-slate-100 font-mono font-bold text-emerald-700">deleteStage + status</td>
                <td className="py-2.5 px-3">以 <code>deleteStage</code>（<code>ACTIVE</code>、<code>PENDING_DELETE</code> 7日回收站、<code>ARCHIVED</code> 深度封存區）完整涵蓋軟刪除與封存三態，進入非 ACTIVE 自動同步 <code>status = 'DISABLED'</code>，不另設冗餘之 <code>isDeleted</code> 或 <code>isGhost</code>。</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-2.5 px-3 border-r border-slate-100 font-bold">User (<code>users</code>)</td>
                <td className="py-2.5 px-3 border-r border-slate-100 font-mono text-amber-700">groupId vs groupIds</td>
                <td className="py-2.5 px-3 border-r border-slate-100 font-mono font-bold text-emerald-700">groupIds (主) + groupId (同步索引)</td>
                <td className="py-2.5 px-3"><code>groupIds</code> 為多重業務群組 JSON 陣列（PBAC 聯集計算來源）；<code>groupId</code> 自動同步為 <code>groupIds[0]</code> 供主群組索引與相容，免除額外中介表。</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-2.5 px-3 border-r border-slate-100 font-bold">權限與跨法人模型</td>
                <td className="py-2.5 px-3 border-r border-slate-100 font-mono text-rose-600">Role / UserCompanyAccess</td>
                <td className="py-2.5 px-3 border-r border-slate-100 font-mono font-bold text-emerald-700">user_groups + group_module_permissions + allowedCompanies</td>
                <td className="py-2.5 px-3">舊版單層 Role 與 UserCompanyAccess 已由三層身分 (<code>users.role</code>)、跨法人陣列 (<code>users.allowedCompanies</code>)、業務群組 (<code>user_groups</code>) 與 12 大模組權限矩陣 (<code>group_module_permissions</code>) 完全取代。</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-2.5 px-3 border-r border-slate-100 font-bold">AuditLog (<code>audit_logs</code>)</td>
                <td className="py-2.5 px-3 border-r border-slate-100 font-mono text-rose-600">performedBy / tableName / recordId / maskedPayload</td>
                <td className="py-2.5 px-3 border-r border-slate-100 font-mono font-bold text-emerald-700">userId, userName, targetTable, targetId, beforeJson, afterJson</td>
                <td className="py-2.5 px-3">全面重用既有 <code>audit_logs</code> 欄位儲存「純中文、無代號、僅記錄實際修改差異（修改前 ➔ 修改後）」之高可讀性日誌，廢除憲法草案重複定義之欄位。</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-2.5 px-3 border-r border-slate-100 font-bold">SystemConfig (<code>system_configs</code>)</td>
                <td className="py-2.5 px-3 border-r border-slate-100 font-mono text-rose-600">createdBy vs updatedBy</td>
                <td className="py-2.5 px-3 border-r border-slate-100 font-mono font-bold text-emerald-700">updatedBy + description</td>
                <td className="py-2.5 px-3">重用 <code>updatedBy</code> 記錄最近修改參數之授權管理員姓名，並增補 <code>description</code> 儲存參數中文名稱與用途說明，供介面與中文審計日誌直接讀取。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
