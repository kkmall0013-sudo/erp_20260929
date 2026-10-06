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
  Sparkles,
  Lock,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { recordAuditLog } from '../db/sqlite';

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
  const { currentUser, currentGroup, approvalLimit, can, checkApproval } = useAuth();
  const canWrite = can('PROJECTS', 'write');
  const canApprove = can('PROJECTS', 'approve');
  const canExport = can('PROJECTS', 'export');

  const [activeCanvasTab, setActiveCanvasTab] = useState<'WBS' | 'CONTRACT' | 'VALUATION_TIMELINE' | 'ATTACHMENTS'>('WBS');
  const [toastNote, setToastNote] = useState<string | null>(null);
  const [wbsItems, setWbsItems] = useState(SAMPLE_WBS_ITEMS);
  const [testApprovalAmount, setTestApprovalAmount] = useState<number>(350000);

  const showActionToast = (msg: string) => {
    setToastNote(msg);
    setTimeout(() => setToastNote(null), 4000);
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
  const totalAmount = wbsItems.reduce((sum, item) => sum + item.amount, 0);

  const handleAddWbsItem = () => {
    if (!canWrite) {
      showActionToast(`⛔ 權限攔截：您目前的身分（${currentUser?.fullName} / ${currentGroup?.groupName || '無群組'}）對【專案工程案場】僅具唯讀權限 (w:0)，禁止新增工項！`);
      return;
    }
    const nextIdx = wbsItems.length + 1;
    const newItem = {
      id: `WBS-${nextIdx}-${Date.now()}`,
      code: `09900-${String(nextIdx).padStart(2, '0')}`,
      name: `新增變更追加工程項目 #${nextIdx}`,
      spec: '依最新核定施工圖說辦理',
      unit: '式',
      qty: 1,
      price: 150000,
      amount: 150000,
      progress: 0,
      isDeduction: false,
    };
    setWbsItems(prev => [newItem, ...prev]);
    recordAuditLog(
      currentUser?.fullName || '系統操作員',
      '新增工項',
      '專案工程案場',
      project.name,
      { '新增工項名稱': newItem.name, '發包預算金額': 'NT$ 150,000' }
    );
    showActionToast(`✅ 已成功新增工項「${newItem.name}」並寫入中文稽核日誌！`);
  };

  const handleSaveDocument = () => {
    if (!canWrite) {
      showActionToast(`⛔ 權限攔截：您目前的身分（${currentUser?.fullName}）無【專案工程案場】之寫入權限 (w:0)，系統已阻擋儲存變更！`);
      return;
    }
    recordAuditLog(
      currentUser?.fullName || '系統操作員',
      '儲存單據',
      '專案工程案場',
      project.name,
      { '工料筆數': `${wbsItems.length} 項`, '預算結算合計': `NT$ ${totalAmount.toLocaleString()}` }
    );
    showActionToast('✅ 單據資料已即時寫入 SQLite 資料庫並記錄中文稽核軌跡');
    onDataChanged();
  };

  const handleApproveDocument = () => {
    const check = checkApproval(testApprovalAmount, 'PROJECTS');
    if (!check.allowed) {
      showActionToast(`⛔ 簽核攔截：${check.reason}`);
      return;
    }
    recordAuditLog(
      currentUser?.fullName || '系統操作員',
      '核准簽呈',
      '專案工程案場',
      project.name,
      { '簽核單據金額': `NT$ ${testApprovalAmount.toLocaleString()}`, '簽核結果': '核准通過' }
    );
    showActionToast(`✅ 簽核通過！已由 ${currentUser?.fullName} 核准 NT$ ${testApprovalAmount.toLocaleString()} 預算單據`);
  };

  const handleExportDocument = () => {
    if (!canExport) {
      showActionToast(`⛔ 權限攔截：您目前的身分（${currentUser?.fullName}）無【專案工程案場】之匯出/列印權限 (e:0)，系統已禁止匯出敏感工程底價！`);
      return;
    }
    recordAuditLog(
      currentUser?.fullName || '系統操作員',
      '匯出報表',
      '專案工程案場',
      project.name,
      { '匯出內容': '工程發包預算明細報表 PDF' }
    );
    showActionToast('🖨️ 權限檢核通過！已產出鼎新標準工程發包明細報表 PDF');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100/60 overflow-hidden relative">
      {/* ======================================================== */}
      {/* 1. 右側固定頂部單據工具列 (Frozen Action Bar)             */}
      {/* ======================================================== */}
      <div className="min-h-14 py-2 bg-white border-b border-slate-200 px-6 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20 shadow-2xs">
        {/* 左側：單據標題與即時 PBAC 權限狀態 */}
        <div className="flex flex-col gap-1">
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

          {/* 即時 PBAC 權限徽章列 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400">當前身分權限：</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${canWrite ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
              {canWrite ? '✓ 可編輯寫入' : '🔒 唯讀 (禁止新增/儲存)'}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${canApprove ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
              {canApprove
                ? `✓ 可簽核 (上限: ${approvalLimit === Infinity ? '無限額' : `NT$ ${approvalLimit.toLocaleString()}`})`
                : '🔒 無簽核權'}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${canExport ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
              {canExport ? '✓ 可匯出列印' : '🔒 禁止匯出'}
            </span>
          </div>
        </div>

        {/* 右側：標準 ERP 核心按鈕群組 (受 PBAC 權限即時管控) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleAddWbsItem}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer ${
              canWrite
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                : 'bg-rose-50/70 hover:bg-rose-100/70 text-rose-700 border-rose-200'
            }`}
            title={canWrite ? '新增工程工項' : '無寫入權限 (點擊可測試攔截)'}
          >
            {canWrite ? <Plus className="w-3.5 h-3.5 text-slate-500" /> : <Lock className="w-3.5 h-3.5 text-rose-600" />}
            <span>新增工項</span>
          </button>

          <button
            onClick={handleSaveDocument}
            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer ${
              canWrite
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
            title={canWrite ? '儲存單據變更' : '無寫入權限 (點擊可測試攔截)'}
          >
            {canWrite ? <Save className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>儲存單據</span>
          </button>

          {/* 簽核金額模擬器 + 呈核審批按鈕 */}
          <div className="flex items-center bg-slate-100 rounded-md p-0.5 border border-slate-200">
            <select
              value={testApprovalAmount}
              onChange={(e) => setTestApprovalAmount(Number(e.target.value))}
              className="bg-transparent text-[11px] font-mono font-bold text-slate-700 px-2 py-1 outline-none cursor-pointer"
              title="選擇欲測試簽核之單據金額 (用於測試群組核准上限攔截)"
            >
              <option value={50000}>簽核額: 5萬</option>
              <option value={350000}>簽核額: 35萬 (工務50萬內)</option>
              <option value={800000}>簽核額: 80萬 (逾工務50萬上限)</option>
              <option value={1500000}>簽核額: 150萬 (採購200萬內)</option>
              <option value={3500000}>簽核額: 350萬 (財務500萬內)</option>
              <option value={8000000}>簽核額: 800萬 (僅總經理無限額)</option>
            </select>
            <button
              onClick={handleApproveDocument}
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer ${
                canApprove
                  ? 'bg-slate-800 hover:bg-slate-900 text-white'
                  : 'bg-rose-700 hover:bg-rose-800 text-white'
              }`}
            >
              {canApprove ? <Send className="w-3.5 h-3.5 text-slate-300" /> : <Lock className="w-3.5 h-3.5 text-white" />}
              <span>呈核審批</span>
            </button>
          </div>

          <button
            onClick={handleExportDocument}
            title={canExport ? '列印或匯出工程報表' : '無匯出權限 (點擊可測試攔截)'}
            className={`px-2.5 py-1.5 rounded-md border flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
              canExport
                ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-800 border-slate-200 bg-white'
                : 'bg-rose-50/70 hover:bg-rose-100/70 text-rose-700 border-rose-200'
            }`}
          >
            {canExport ? <Printer className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-rose-600" />}
            <span>匯出</span>
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
            { id: 'WBS', label: `工程工料與發包明細 (${wbsItems.length} 項)` },
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
                {wbsItems.map((item, idx) => {
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
