import React, { useState } from 'react';
import { Project } from '../types/erp';
import {
  FolderGit2,
  Save,
  Send,
  Printer,
  History,
  Plus,
  Edit3,
  Calendar,
  DollarSign,
  Building,
  MapPin,
  TrendingUp,
  FileCheck2,
  Download,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  ArrowUpRight,
  Info,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';

interface MainCanvasWorkspaceProps {
  project: Project | null;
  onDataChanged: () => void;
  onOpenFlowchart?: () => void;
}

// 模擬案場明細工程工料項目 (供測試長頁面滑動手感)
const SAMPLE_WBS_ITEMS = [
  { id: 'WBS-01', code: '03000-01', name: '連續壁導溝工程 (厚度 80cm)', spec: '3000psi 混凝土 / 雙層鋼筋', unit: 'm', qty: 260, price: 18500, amount: 4810000, progress: 100, isDeduction: false },
  { id: 'WBS-02', code: '03000-02', name: '全套管基樁工程 (直徑 1500mm)', spec: '深度 45m / 載重 800t', unit: '支', qty: 48, price: 210000, amount: 10080000, progress: 95, isDeduction: false },
  { id: 'WBS-03', code: '02200-01', name: '地下室土方開挖與運棄', spec: '含土資場合法流向管制聯單', unit: 'm³', qty: 32000, price: 650, amount: 20800000, progress: 85, isDeduction: false },
  { id: 'WBS-04', code: '02200-02', name: '安全支撐與型鋼圍令工程', spec: 'H400*400 高張力型鋼', unit: '噸', qty: 850, price: 42000, amount: 35700000, progress: 80, isDeduction: false },
  { id: 'WBS-05', code: '03300-01', name: '結構體筏基高強度預拌混凝土', spec: '5000psi 水密配比 / 水化熱控制', unit: 'm³', qty: 4500, price: 3450, amount: 15525000, progress: 70, isDeduction: false },
  { id: 'WBS-06', code: '03200-01', name: '竹節鋼筋加工組立工程 (SD420W)', spec: '抗震可銲級標章 / 輻射檢驗合格', unit: '噸', qty: 1850, price: 28500, amount: 52725000, progress: 65, isDeduction: false },
  { id: 'WBS-07', code: '03100-01', name: '結構清水清水模與系統模板', spec: '芬蘭進口多層板 / 脫模劑合格', unit: 'm²', qty: 28000, price: 820, amount: 22960000, progress: 60, isDeduction: false },
  { id: 'WBS-08', code: '07100-01', name: '地下外牆雙層高分子防水工程', spec: '烘烤型自粘防水毯 + 點銲網', unit: 'm²', qty: 6200, price: 1250, amount: 7750000, progress: 45, isDeduction: false },
  { id: 'WBS-09', code: '04200-01', name: '外牆花崗石乾式吊掛石材工程', spec: '黃金麻 30mm / 不銹鋼件', unit: 'm²', qty: 3800, price: 6800, amount: 25840000, progress: 20, isDeduction: false },
  { id: 'WBS-10', code: '08500-01', name: '氣密鋁門窗與雙層膠合 Low-E 玻璃', spec: '8mm+8mm 中空抗風壓水密窗', unit: '處', qty: 420, price: 36000, amount: 15120000, progress: 10, isDeduction: false },
  { id: 'WBS-11', code: '15000-01', name: '高低壓電氣設備與變壓器配電盤', spec: 'Schneider 原裝盤體 / TA電纜', unit: '式', qty: 1, price: 28500000, amount: 28500000, progress: 15, isDeduction: false },
  { id: 'WBS-12', code: '15400-01', name: '給排水衛生設備與雨水回收系統', spec: '不銹鋼配管 / 變頻恆壓抽水機', unit: '式', qty: 1, price: 14200000, amount: 14200000, progress: 10, isDeduction: false },
  { id: 'WBS-13', code: '15800-01', name: '地下停車場排煙與全熱交換通風', spec: '消防署合格標章 / 誘導風機', unit: '式', qty: 1, price: 9800000, amount: 9800000, progress: 5, isDeduction: false },
  { id: 'WBS-14', code: '00999-D1', name: '【業主核定減項】取消頂樓景觀水幕設施', spec: '變更設計減項協議書 REV-B', unit: '式', qty: 1, price: -3500000, amount: -3500000, progress: 100, isDeduction: true },
  { id: 'WBS-15', code: '00999-D2', name: '【材料代購扣款】鋼筋由本營造代購沖銷', spec: '下包計價直接扣減款項', unit: '式', qty: 1, price: -2800000, amount: -2800000, progress: 100, isDeduction: true },
];

export const MainCanvasWorkspace: React.FC<MainCanvasWorkspaceProps> = ({
  project,
  onDataChanged,
  onOpenFlowchart,
}) => {
  const [activeCanvasTab, setActiveCanvasTab] = useState<'WBS' | 'CONTRACT' | 'VALUATION_TIMELINE' | 'ATTACHMENTS'>('WBS');
  const [toastNote, setToastNote] = useState<string | null>(null);

  const showActionToast = (msg: string) => {
    setToastNote(msg);
    setTimeout(() => setToastNote(null), 3000);
  };

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-50">
        <FolderGit2 className="w-12 h-12 text-slate-300 mb-3" />
        <div className="text-sm font-bold text-slate-600">請從左側子視窗選擇或點選一個專案案場</div>
        <div className="text-xs text-slate-400 mt-1">選取後右側主工作畫布將立即展開工程明細</div>
      </div>
    );
  }

  // 計算匯總數據
  const totalAmount = SAMPLE_WBS_ITEMS.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100/60 overflow-hidden relative">
      {/* ======================================================== */}
      {/* 1. 右側固定頂部單據工具列 (Frozen Action Bar)             */}
      {/* ======================================================== */}
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-20 shadow-2xs">
        {/* 左側：單據標題與麵包屑 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
              {project.projectCode}
            </span>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{project.name}</span>
              <span className="text-xs font-normal text-slate-500 font-mono">
                [REV-A 定版]
              </span>
            </h2>
          </div>

          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              project.status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{project.status === 'ACTIVE' ? '施工在建中' : project.status === 'COMPLETED' ? '完工結案' : '規劃起標'}</span>
          </span>
        </div>

        {/* 右側：標準 ERP 核心按鈕群組 (新增、儲存、送審、列印) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => showActionToast('已觸發工料項目新增作業')}
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>新增工項</span>
          </button>

          <button
            onClick={() => showActionToast('✅ 單據資料已即時寫入 SQLite 資料庫')}
            className="px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>儲存單據</span>
          </button>

          <button
            onClick={() => showActionToast('已啟動鼎新 A1 審批呈核流程')}
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Send className="w-3.5 h-3.5 text-slate-300" />
            <span>呈核審批</span>
          </button>

          <button
            onClick={() => window.print()}
            title="列印或匯出工程報表"
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. 獨立內部滾動主內容區 (Independent Scroll Container)     */}
      {/*    右側滑鼠滾輪滑動時，左側 Sidebar 與子視窗 100% 紋風不動! */}
      {/* ======================================================== */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        {/* A. 案場主檔基本資料卡片 (Master Profile Card) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                案場主檔工程基線資料 (Project Baseline)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              工程合約流水號：CTR-{project.projectCode}-2026
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
              <span className="text-slate-400 block text-[11px] mb-1">工程目標總預算</span>
              <span className="font-mono font-bold text-base text-slate-900">
                NT$ {project.budgetAmount ? project.budgetAmount.toLocaleString() : '265,000,000'}
              </span>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
              <span className="text-slate-400 block text-[11px] mb-1">累計已發包合約金額</span>
              <span className="font-mono font-bold text-base text-indigo-700">
                NT$ {project.actualCost ? project.actualCost.toLocaleString() : '216,490,000'}
              </span>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
              <span className="text-slate-400 block text-[11px] mb-1">工程開工 / 完工日期</span>
              <span className="font-mono text-slate-700 font-semibold">
                {project.startDate || '2026-02-15'} ~ {project.endDate || '2027-11-30'}
              </span>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
              <span className="text-slate-400 block text-[11px] mb-1">業主發包單位</span>
              <span className="text-slate-800 font-semibold truncate block">
                {project.ownerName || '台北市捷運工程局 / 聯開處'}
              </span>
            </div>
          </div>
        </div>

        {/* B. 頁籤列 (Tabs) */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
          {[
            { id: 'WBS', label: `工程工料與發包明細 (${SAMPLE_WBS_ITEMS.length} 項)` },
            { id: 'CONTRACT', label: '業主合約與條款' },
            { id: 'VALUATION_TIMELINE', label: '下包估驗請款進度' },
            { id: 'ATTACHMENTS', label: '圖說與無紙化附件 (3)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCanvasTab(tab.id as any)}
              className={`px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px ${
                activeCanvasTab === tab.id
                  ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg border-t border-x border-slate-200 shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* C. 寬廣舒適的工程工料明細表格 (High-Density Engineering Grid) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                WBS 工料預算明細表 (具備固定表頭 Sticky Header)
              </span>
              <span className="text-[11px] text-slate-400">
                向下滾動時，表頭自動鎖定，左側案場清單完全靜止
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">預算結算合計：</span>
              <span className="font-mono font-bold text-sm text-indigo-700">
                NT$ {totalAmount.toLocaleString()} 元整
              </span>
            </div>
          </div>

          {/* 表格容器 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              {/* 表頭固定 Sticky Header */}
              <thead className="bg-slate-100/90 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-300 backdrop-blur-xs">
                <tr>
                  <th className="py-3 px-3 w-12 text-center border-r border-slate-200">項次</th>
                  <th className="py-3 px-3 min-w-[90px] border-r border-slate-200">工項編碼</th>
                  <th className="py-3 px-4 min-w-[240px] border-r border-slate-200">工程項目名稱與說明</th>
                  <th className="py-3 px-3 min-w-[180px] border-r border-slate-200">規格 / 材料認證</th>
                  <th className="py-3 px-2 w-16 text-center border-r border-slate-200">單位</th>
                  <th className="py-3 px-3 min-w-[90px] text-right border-r border-slate-200">合約數量</th>
                  <th className="py-3 px-3 min-w-[100px] text-right border-r border-slate-200">核定單價</th>
                  <th className="py-3 px-4 min-w-[120px] text-right border-r border-slate-200">發包複價 (NTD)</th>
                  <th className="py-3 px-3 min-w-[80px] text-center border-r border-slate-200">進度 %</th>
                  <th className="py-3 px-3 text-center">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {SAMPLE_WBS_ITEMS.map((item, idx) => {
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        item.isDeduction ? 'bg-rose-50/50 text-rose-950 font-medium' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 border-r border-slate-100">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 border-r border-slate-100">
                        {item.code}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-800 border-r border-slate-100">
                        <div className="flex items-center gap-1.5">
                          {item.isDeduction && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded shrink-0">
                              減項沖銷
                            </span>
                          )}
                          <span>{item.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] border-r border-slate-100">
                        {item.spec}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-600 font-semibold border-r border-slate-100">
                        {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800 border-r border-slate-100">
                        {item.qty.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800 border-r border-slate-100">
                        {item.price.toLocaleString()}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-mono font-bold border-r border-slate-100 ${
                        item.isDeduction ? 'text-rose-700' : 'text-slate-900'
                      }`}>
                        {item.amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-600 border-r border-slate-100">
                        {item.progress}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.progress === 100 ? (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            已結清
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                            執行中
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* D. 底部營造內控審核狀態條 (Approval Footer) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <div>
              <div className="font-bold text-slate-800">憲法級內控防呆檢核通過</div>
              <div className="text-[11px] text-slate-400">
                本期工程發包預算未超標 · 無未結算負值懸帳 · 鼎新 A1 稽核流水號：AUD-20260930-OK
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-400 text-[11px]">
              最後更新人：林董總 (Superadmin)
            </span>
          </div>
        </div>
      </div>

      {/* 浮動操作回饋提示 */}
      {toastNote && (
        <div className="fixed bottom-6 right-8 bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2">
          {toastNote}
        </div>
      )}
    </div>
  );
};
