import React from 'react';
import {
  FileText,
  LayoutDashboard,
  Columns,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Database,
  Building2,
  Lock,
  Layers,
  Sparkles,
  MousePointer2
} from 'lucide-react';

interface DiscussionRoadmapViewProps {
  onSwitchToWorkspaceTest: () => void;
}

export const DiscussionRoadmapView: React.FC<DiscussionRoadmapViewProps> = ({
  onSwitchToWorkspaceTest,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 bg-slate-100/70">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* 頂部焦點宣告 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                乾淨外殼 · 對焦定版
              </span>
              <span className="text-xs text-slate-400 font-mono">
                架構討論記錄與模組依序開發手冊
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              營造工程 ERP — 鼎新 A1 視窗配置與系統架構總綱
            </h2>
            <p className="text-xs text-slate-500">
              已清除先前所有雜亂程式碼，保留純粹外殼與完整討論結論。後續將「單一模組聚焦精雕、開發完才掛載選單」。
            </p>
          </div>

          <button
            onClick={onSwitchToWorkspaceTest}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
          >
            <MousePointer2 className="w-4 h-4" />
            <span>體驗左欄不動、右欄滾動手感</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 1. 鼎新 A1 視窗配置與滾動體驗核心結論 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Columns className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              【討論結論一】正統 ERP 三層視窗配置與滑鼠滾輪行為規範
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>1. 最左側主導航 (Sidebar)</span>
                <span className="font-mono text-indigo-600 font-semibold">~220px</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                <strong>永遠固定 (Sticky)</strong>。右側無論表單滑多長，左邊主選單永遠不動，支援底部一鍵收合為 56px 微型圖示模式。
              </p>
            </div>

            <div className="p-4 bg-indigo-50/60 rounded-lg border border-indigo-200/80 space-y-2">
              <div className="font-bold text-indigo-950 flex items-center justify-between">
                <span>2. 左側固定子視窗 (Sub-window)</span>
                <span className="font-mono text-indigo-600 font-semibold">300px 固定</span>
              </div>
              <p className="text-indigo-900 leading-relaxed">
                <strong>鼎新經典精巧清單</strong>。專門放案場清單、單據待辦樹；佔地不大不搶空間，具備<strong>獨立內部滾動</strong>，可一鍵向左收折。
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>3. 右側超寬主畫布 (Detail Canvas)</span>
                <span className="font-mono text-emerald-600 font-semibold">佔滿 75%~85%</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                <strong>右側滾輪滑動、左側不動</strong>！頂部 Action Bar 凍結，表格具備 Sticky 表頭，支援 15 欄位寬廣展開，閱讀極其舒適。
              </p>
            </div>
          </div>
        </div>

        {/* 2. 三層身分權限架構與 2D 矩陣 PBAC */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">
              【討論結論二】三層式身分架構與 2D 矩陣多群組 (PBAC)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1">
              <div className="font-bold text-amber-900">唯一 Superadmin 最高保護</div>
              <div className="text-amber-800 text-[11px] leading-relaxed">
                系統僅 1 位，無上限審批，底層參數與還原特權。一般 Admin 無法停用或刪除，只能由本人進行交接。
              </div>
            </div>

            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-1">
              <div className="font-bold text-indigo-900">Admin 若干位分權治理</div>
              <div className="text-indigo-800 text-[11px] leading-relaxed">
                工區所長與資訊管理，可建立與分派同仁帳號，受憲法約束禁止刪除其他 Admin。
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div className="font-bold text-slate-900">2D 多群組矩陣聯集</div>
              <div className="text-slate-600 text-[11px] leading-relaxed">
                同仁可同時隸屬多個群組（工務+業務），權限採聯集 (Union)，單筆審批額度自動取最高值。
              </div>
            </div>
          </div>
        </div>

        {/* 3. 12 大業務模組依序實施規劃清單 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                【討論結論三】後續模組聚焦推進藍圖（單一模組開發完才加上選單）
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              依序精雕 · 零技術債
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { phase: 'Phase 1 (當前)', name: '專案與案場工程主檔 (Projects & Sites)', desc: '工區立項、Target 預算基線、WBS 節點拆解、開工完工管制', status: '首發聚焦中', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
              { phase: 'Phase 2', name: '商業夥伴主檔 (Partners - 客戶/供應商/下包)', desc: '台灣統編邏輯防呆、黑名單聯徵、銀行雙證核印、工班違規記點', status: '待建', color: 'bg-slate-100 text-slate-600 border-slate-200' },
              { phase: 'Phase 3', name: '報價與銷售模組 (CPQ 核心引擎)', desc: '業主合約條款、REV-A/B 多版次比對、工料單價分析、粉紅減項防呆', status: '待建', color: 'bg-slate-100 text-slate-600 border-slate-200' },
              { phase: 'Phase 4', name: '採購與發包模組 (PO 發包合約)', desc: '原物料三家詢比議價單、採購單開立、防超額發包、預付款扣抵', status: '待建', color: 'bg-slate-100 text-slate-600 border-slate-200' },
              { phase: 'Phase 5', name: '合約與下包估驗計價模組 (Valuation)', desc: '瀑布式期別累計計價、5%~10%保留款獨立水池、現場扣款、實體快照', status: '待建', color: 'bg-slate-100 text-slate-600 border-slate-200' },
              { phase: 'Phase 6', name: '財務會計與金流票據模組 (AP/AR & Checks)', desc: '憑單自動拆單、遠期支票兌現預警、可用現金水池即時試算', status: '待建', color: 'bg-slate-100 text-slate-600 border-slate-200' },
              { phase: 'Phase 7', name: '營運戰情大腦與商業報表 (BI Analytics)', desc: '全集團資金水位預測、案場進度 S 曲線、專案 P&L 損益表', status: '待建', color: 'bg-slate-100 text-slate-600 border-slate-200' },
            ].map((m) => (
              <div
                key={m.phase}
                className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    {m.phase}
                  </span>
                  <div>
                    <div className="font-bold text-slate-800">{m.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{m.desc}</div>
                  </div>
                </div>
                <span className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded border ${m.color}`}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
