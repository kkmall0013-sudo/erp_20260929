import React, { useState, useEffect } from 'react';
import {
  Quotation,
  QuotationItem,
  QuotationBillingMilestone,
  QuotationRevision,
  Company,
  BusinessPartner,
  Project
} from '../../types/erp';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  Edit,
  Trash2,
  Copy,
  TrendingDown,
  Calculator,
  Sparkles,
  Paperclip,
  Eye,
  FileCheck,
  AlertCircle,
  Building2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Percent,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getAllQuotations,
  getQuotationItems,
  getQuotationMilestones,
  getQuotationRevisions,
  saveQuotation,
  createQuotationRevisionDeepCopy,
  getAllCompanies,
  getAllBusinessPartners,
  getAllProjects,
  recordAuditLog
} from '../../db/sqlite';
import { QuotationEditorModal } from './QuotationEditorModal';
import { QuotationPrintPreviewModal } from './QuotationPrintPreviewModal';

interface QuotationWorkspaceProps {
  onNotify: (msg: string) => void;
}

export const QuotationWorkspace: React.FC<QuotationWorkspaceProps> = ({ onNotify }) => {
  const { currentUser, isSuperadmin, can } = useAuth();
  const canWrite = isSuperadmin || can('QUOTATIONS', 'write');
  const canApprove = isSuperadmin || can('QUOTATIONS', 'approve');

  // 資料狀態
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [customers, setCustomers] = useState<BusinessPartner[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // 篩選狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [pricingModeFilter, setPricingModeFilter] = useState<string>('ALL');

  // 彈窗狀態
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printQuotation, setPrintQuotation] = useState<Quotation | null>(null);
  const [printItems, setPrintItems] = useState<QuotationItem[]>([]);
  const [printMilestones, setPrintMilestones] = useState<QuotationBillingMilestone[]>([]);
  const [activeRevisions, setActiveRevisions] = useState<QuotationRevision[]>([]);

  // 重新讀取資料庫
  const reloadData = () => {
    const qList = getAllQuotations();
    setQuotations(qList);
    setCompanies(getAllCompanies());
    setCustomers(getAllBusinessPartners().filter(p => p.type === 'CUSTOMER' || p.type === 'BOTH' || p.isCustomer));
    setProjects(getAllProjects());
  };

  useEffect(() => {
    reloadData();
  }, []);

  // 開啟新增編輯彈窗
  const handleCreateNew = () => {
    setSelectedQuotation(null);
    setActiveRevisions([]);
    setIsEditorOpen(true);
  };

  const handleEdit = (q: Quotation) => {
    setSelectedQuotation(q);
    const revs = getQuotationRevisions(q.id);
    setActiveRevisions(revs);
    setIsEditorOpen(true);
  };

  // 開啟列印預覽
  const handleOpenPrint = (q: Quotation) => {
    setPrintQuotation(q);
    setPrintItems(getQuotationItems(q.id, q.currentRevision));
    setPrintMilestones(getQuotationMilestones(q.id));
    setShowPrintModal(true);
  };

  // 儲存報價單
  const handleSaveQuotation = (
    savedQ: Quotation,
    items: QuotationItem[],
    milestones: QuotationBillingMilestone[]
  ) => {
    try {
      saveQuotation(savedQ, items, milestones, currentUser?.fullName || '系統操作員');
      reloadData();
      onNotify(`✅ 報價單【${savedQ.quoteNumber}】(v${savedQ.currentRevision}) 已成功儲存！`);
    } catch (err: any) {
      onNotify(`⛔ 儲存失敗：${err.message || String(err)}`);
    }
  };

  // 深拷貝產出新版次
  const handleDeepCopyRevision = (sourceId: string, newRevCode: string) => {
    try {
      createQuotationRevisionDeepCopy(sourceId, newRevCode, currentUser?.fullName || '系統操作員');
      reloadData();
      onNotify(`✅ 已成功深拷貝產出新版次【${newRevCode}】，歷史版本已降級隔離封裝！`);
    } catch (err: any) {
      onNotify(`⛔ 深拷貝失敗：${err.message || String(err)}`);
    }
  };

  // 篩選報價單清單
  const filteredQuotations = quotations.filter(q => {
    const matchSearch =
      q.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || q.status === statusFilter;
    const matchMode = pricingModeFilter === 'ALL' || (q.pricingMode || 'HEADER_DISCOUNT') === pricingModeFilter;
    return matchSearch && matchStatus && matchMode;
  });

  // 計算 KPI 數據
  const totalQuoteSum = quotations.reduce((acc, q) => acc + (q.totalAmount || 0), 0);
  const acceptedQuotations = quotations.filter(q => q.status === 'ACCEPTED');
  const acceptedSum = acceptedQuotations.reduce((acc, q) => acc + (q.totalAmount || 0), 0);
  const conversionRate = quotations.length > 0 ? Math.round((acceptedQuotations.length / quotations.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* 頂部標題與總覽卡片 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 tracking-tight">
                  報價與銷售管理工作台 (Quotation & Sales CPQ 旗艦版 - Phase 4)
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  三軌並行議價引擎 • 幽靈小數強制洗滌 • 影子有效單價追減防禦 • 部分得標決選版
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={reloadData}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
              title="重新載入"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleCreateNew}
              disabled={!canWrite}
              className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs ${
                canWrite
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>開立新報價單</span>
            </button>
          </div>
        </div>

        {/* 營運指標卡 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500">歷史總報價件數</span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {quotations.length} <span className="text-xs font-normal text-slate-500">件</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500">累計報價含稅總額</span>
            <div className="text-xl font-bold font-mono text-indigo-700 mt-1">
              NT$ {totalQuoteSum.toLocaleString()}
            </div>
          </div>

          <div className="bg-emerald-50/60 p-3.5 rounded-lg border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800">已成交合約金額</span>
            <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
              NT$ {acceptedSum.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500">工程成交轉化率</span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {conversionRate}% <span className="text-xs font-normal text-slate-500">({acceptedQuotations.length} / {quotations.length})</span>
            </div>
          </div>
        </div>
      </div>

      {/* 搜尋與篩選列 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋報價單號、業主名稱..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>

          {/* 狀態過濾 */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-bold text-slate-500">單況：</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white"
            >
              <option value="ALL">全部狀態</option>
              <option value="DRAFT">草稿中 (DRAFT)</option>
              <option value="SENT">已送出 (SENT)</option>
              <option value="ACCEPTED">已成交 (ACCEPTED)</option>
              <option value="REJECTED">已失標 (REJECTED)</option>
              <option value="SUPERSEDED">已取代 (SUPERSEDED)</option>
            </select>
          </div>

          {/* 議價軌道過濾 */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-bold text-slate-500">議價軌道：</span>
            <select
              value={pricingModeFilter}
              onChange={(e) => setPricingModeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white"
            >
              <option value="ALL">全部軌道</option>
              <option value="HEADER_DISCOUNT">軌道一：表頭折讓流</option>
              <option value="UNIT_PRICE_ADJUSTMENT">軌道二：單價微調流</option>
              <option value="SHADOW_ALLOCATION">軌道三：影子協議備註</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          共 {filteredQuotations.length} 筆報價單
        </div>
      </div>

      {/* 報價單清單表格 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 text-left w-36">報價單號</th>
                <th className="py-3 px-3 text-center w-20">版次</th>
                <th className="py-3 px-3 text-left">定作業主 (客戶)</th>
                <th className="py-3 px-3 text-left w-32">議價出單軌道</th>
                <th className="py-3 px-3 text-right w-28">未稅淨額</th>
                <th className="py-3 px-3 text-right w-24">營業稅</th>
                <th className="py-3 px-3 text-right w-32">總金額 (含稅)</th>
                <th className="py-3 px-3 text-center w-24">單據狀態</th>
                <th className="py-3 px-3 text-center w-36">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs">查無符合條件之工程報價單</p>
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((q) => {
                  const mode = q.pricingMode || 'HEADER_DISCOUNT';
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 單號 */}
                      <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                        {q.quoteNumber}
                      </td>

                      {/* 版次 */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {q.currentRevision}
                        </span>
                      </td>

                      {/* 業主名稱 */}
                      <td className="py-3 px-3 font-bold text-slate-800">
                        {q.customerName || '未指定業主'}
                      </td>

                      {/* 議價出單軌道 */}
                      <td className="py-3 px-3">
                        {mode === 'HEADER_DISCOUNT' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            <TrendingDown className="w-3 h-3 text-indigo-600" />
                            <span>表頭折讓流</span>
                          </span>
                        )}
                        {mode === 'UNIT_PRICE_ADJUSTMENT' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Calculator className="w-3 h-3 text-emerald-600" />
                            <span>單價微調流</span>
                          </span>
                        )}
                        {mode === 'SHADOW_ALLOCATION' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>影子協議備註</span>
                          </span>
                        )}
                      </td>

                      {/* 未稅淨額 */}
                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                        NT$ {Math.round(q.netAmount).toLocaleString()}
                      </td>

                      {/* 營業稅 */}
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        NT$ {Math.round(q.taxAmount).toLocaleString()}
                      </td>

                      {/* 總金額 */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                        NT$ {Math.round(q.totalAmount).toLocaleString()}
                      </td>

                      {/* 狀態 */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            q.status === 'ACCEPTED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : q.status === 'SENT'
                              ? 'bg-sky-100 text-sky-800 border border-sky-200'
                              : q.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : q.status === 'SUPERSEDED'
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {q.status === 'ACCEPTED' && '✓ 已成交'}
                          {q.status === 'SENT' && '已送出'}
                          {q.status === 'REJECTED' && '未得標'}
                          {q.status === 'SUPERSEDED' && '已取代'}
                          {q.status === 'DRAFT' && '草稿'}
                        </span>
                      </td>

                      {/* 操作列 */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenPrint(q)}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                            title="列印預覽 / 存為 PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleEdit(q)}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                            title="編輯明細與議價設定"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 編輯彈窗 */}
      <QuotationEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        quotation={selectedQuotation}
        companies={companies}
        customers={customers}
        projects={projects}
        onSave={handleSaveQuotation}
        onDeepCopyRevision={handleDeepCopyRevision}
        revisions={activeRevisions}
      />

      {/* 列印預覽彈窗 */}
      {printQuotation && (
        <QuotationPrintPreviewModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          quotation={printQuotation}
          items={printItems}
          milestones={printMilestones}
          company={companies.find(c => c.id === printQuotation.companyId)}
          customer={customers.find(c => c.id === printQuotation.customerId)}
          project={projects.find(p => p.id === printQuotation.projectId)}
        />
      )}
    </div>
  );
};
