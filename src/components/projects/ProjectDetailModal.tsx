// src/components/projects/ProjectDetailModal.tsx
// 🏛️ 案場詳情與預計協力廠商對帳追蹤彈窗

import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  DraftingCompass,
  Edit3,
  FileText,
  FolderGit2,
  MapPin,
  Package,
  PackageCheck,
  X,
} from 'lucide-react';
import { Company, Project, ProjectSite } from '../../types/erp';
import {
  getAllInboundReceipts,
  getProjectBudgetPartners,
  getProjectPartnerBillingSummary,
} from '../../db/sqlite';

interface ProjectDetailModalProps {
  project: Project;
  site: ProjectSite | null;
  companies: Company[];
  onEdit: () => void;
  onClose: () => void;
  onOpenCustomerStatement?: () => void;
  onDrillVendor: (
    project: Project,
    partnerId: string,
    partnerName: string,
    workScope?: string,
    estimatedAmount?: number
  ) => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  site,
  companies,
  onEdit,
  onClose,
  onOpenCustomerStatement,
  onDrillVendor,
}) => {
  const inboundReceipts = useMemo(() => {
    try {
      return getAllInboundReceipts({ projectId: project.id });
    } catch (_) {
      return [];
    }
  }, [project.id]);

  const budgetPartners = useMemo(() => {
    if (project.budgetPartners && project.budgetPartners.length > 0) {
      return project.budgetPartners;
    }
    return getProjectBudgetPartners(project.id);
  }, [project.id, project.budgetPartners]);

  const partnerBillingSummaries = useMemo(() => {
    return budgetPartners.map(bp => {
      const summary = getProjectPartnerBillingSummary(
        project.id,
        bp.partnerId,
        bp.estimatedAmount,
        bp.workScope,
        bp.partnerName
      );
      return { partner: bp, summary };
    });
  }, [budgetPartners, project.id]);

  const aggregateTotals = useMemo(() => {
    return partnerBillingSummaries.reduce(
      (acc, item) => {
        acc.estimated += item.summary.estimatedAmount;
        acc.inbound += item.summary.totalInboundAmount;
        acc.billed += item.summary.billedInboundAmount;
        acc.pending += item.summary.pendingBillingAmount;
        acc.paid += item.summary.totalPaidAmount;
        return acc;
      },
      { estimated: 0, inbound: 0, billed: 0, pending: 0, paid: 0 }
    );
  }, [partnerBillingSummaries]);

  const budgetUsagePct = project.budgetAmount > 0 ? Math.round((project.actualCost / project.budgetAmount) * 100) : 0;
  const grossMargin = project.contractAmount - project.budgetAmount;
  const grossMarginRate = project.contractAmount > 0 ? Math.round((grossMargin / project.contractAmount) * 100) : 0;

  const comp = companies.find(c => c.id === project.companyId);
  const compName = comp ? comp.name : (project.companyId ? project.companyId : '尚未確定（待請款簽約時決定）');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                  {project.projectCode}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  project.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : project.status === 'PLANNING'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {project.status === 'ACTIVE' ? '施工中' : project.status === 'PLANNING' ? '規劃中' : project.status === 'COMPLETED' ? '已完工' : '已結算'}
                </span>
                {project.buildingType && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {project.buildingType}
                  </span>
                )}
                {project.workScope && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {project.workScope}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">
                {project.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCustomerStatement && (
              <button
                type="button"
                onClick={onOpenCustomerStatement}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-700" />
                <span>對客請款表</span>
              </button>
            )}
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>修改資料</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">合約承攬總額</div>
              <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                NT$ {project.contractAmount.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">含稅總承攬價</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">目標工程預算</div>
              <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                NT$ {project.budgetAmount.toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium mt-1">
                預估毛利：NT$ {grossMargin.toLocaleString()} ({grossMarginRate}%)
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">累計已發生成本</div>
              <div className={`text-base font-bold font-mono mt-0.5 ${project.actualCost > project.budgetAmount ? 'text-rose-600' : 'text-slate-900'}`}>
                NT$ {project.actualCost.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">進料與工程累計支出</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">預算執行率</div>
              <div className="text-base font-bold text-indigo-700 font-mono mt-0.5">
                {budgetUsagePct}%
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full ${budgetUsagePct > 100 ? 'bg-rose-500' : budgetUsagePct > 80 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                  style={{ width: `${Math.min(100, budgetUsagePct)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <DraftingCompass className="w-4 h-4 text-purple-600" />
                <span>建造執照法定主體與承攬</span>
              </div>
              <div className="space-y-2.5 text-slate-600">
                <div className="flex justify-between items-start">
                  <span className="text-slate-400 shrink-0">合約發票甲方 (B)：</span>
                  <div className="text-right">
                    <span className="font-bold text-slate-800">{project.ownerName}</span>
                    {project.ownerTaxId && (
                      <div className="text-[10px] font-mono text-slate-400">統編: {project.ownerTaxId}</div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-start bg-purple-50/60 p-2 rounded-lg border border-purple-100">
                  <div>
                    <span className="text-purple-800 font-bold block">執照法定起造人 (A)：</span>
                    <span className="text-[10px] text-purple-600">建物所有權 / 投資人</span>
                  </div>
                  <span className="font-bold text-purple-900 text-sm">
                    {site?.developerName || project.ownerName}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">簽約承攬乙方：</span>
                  <span className="font-medium text-slate-800">{compName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">建造建物類型：</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                    {project.buildingType || '未分類'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">承攬工作內容：</span>
                  <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                    {project.workScope || '未分類'}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span className="text-slate-400 flex items-center gap-1">
                    <DraftingCompass className="w-3.5 h-3.5 text-indigo-500" />
                    <span>拆圖協力廠商：</span>
                  </span>
                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {site?.shopDrawingVendorName || '未指定拆圖廠商'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">設計監造人：</span>
                  <span className="font-medium text-slate-800">{site?.architect || '未登錄'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">承造人：</span>
                  <span className="font-medium text-slate-800">{site?.constructor || '未登錄'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <MapPin className="w-4 h-4 text-rose-500" />
                <span>工區現地與施工執照資訊</span>
              </div>
              <div className="space-y-2 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">施工現址：</span>
                  <span className="font-semibold text-slate-800 text-right">{site?.address || '未填寫現址'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">基地座落地號：</span>
                  <span className="font-medium text-slate-800">{site?.landNumber || '未登錄地號'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">建造執照字號：</span>
                  <span className="font-mono text-indigo-700 font-bold">{site?.permitNumber || '未登錄'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">工區現地別名：</span>
                  <span className="font-medium text-slate-800">{site?.siteName || project.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">工地主任姓名：</span>
                  <span className="font-bold text-slate-800">{site?.contactPerson || '未指派'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">工地聯絡電話：</span>
                  <span className="font-mono text-slate-800">{site?.contactPhone || '未登錄'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">工程期程：</span>
                  <span className="font-mono text-slate-800">{project.startDate || '未定'} ~ {project.endDate || '進行中'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                  <Briefcase className="w-4 h-4 text-indigo-600" />
                  <span>預計協力廠商、進料與請款連動即時統計</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  自動連動抓取該案場之進貨簽收單與計價單，即時計算「預估金額、已進貨金額、已計價請款、待請款差額與已支付金額」。
                  點擊各廠商右側按鈕可穿透檢視僅屬於本案場的進料細項！
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                  全案待請款差額：NT$ {aggregateTotals.pending.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="text-center">
                <div className="text-[10px] text-slate-500">預計發包合計 (A)</div>
                <div className="font-mono font-bold text-slate-800 text-xs mt-0.5">
                  NT$ {aggregateTotals.estimated.toLocaleString()}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500">累計已進貨簽收 (B)</div>
                <div className="font-mono font-bold text-indigo-700 text-xs mt-0.5">
                  NT$ {aggregateTotals.inbound.toLocaleString()}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500">累計已計價請款 (C)</div>
                <div className="font-mono font-bold text-slate-800 text-xs mt-0.5">
                  NT$ {aggregateTotals.billed.toLocaleString()}
                </div>
              </div>
              <div className="text-center bg-amber-100/50 rounded-lg py-0.5 border border-amber-200">
                <div className="text-[10px] text-amber-800 font-bold">⚠️ 待請款差額 (B-C)</div>
                <div className="font-mono font-bold text-amber-700 text-xs mt-0.5">
                  NT$ {aggregateTotals.pending.toLocaleString()}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500">累計已支付出帳 (D)</div>
                <div className="font-mono font-bold text-emerald-700 text-xs mt-0.5">
                  NT$ {aggregateTotals.paid.toLocaleString()}
                </div>
              </div>
            </div>

            {partnerBillingSummaries.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                此案場尚未設定預計協力廠商清冊。請點擊上方「修改資料」在第二區塊新增預計協力廠商與預算金額。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3">協力廠商全銜</th>
                      <th className="py-2.5 px-3">預計承攬工料</th>
                      <th className="py-2.5 px-3 text-right">預估發包 (A)</th>
                      <th className="py-2.5 px-3 text-right">累計已進貨 (B)</th>
                      <th className="py-2.5 px-3 text-right">已計價請款 (C)</th>
                      <th className="py-2.5 px-3 text-right bg-amber-50/60 font-bold text-amber-900">待請款差額 (B-C)</th>
                      <th className="py-2.5 px-3 text-right">已支付金額 (D)</th>
                      <th className="py-2.5 px-3 text-center">請款狀態</th>
                      <th className="py-2.5 px-3 text-center">本案進貨穿透檢視</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {partnerBillingSummaries.map(({ partner, summary }) => {
                      const hasPending = summary.pendingBillingAmount > 0;
                      const isComplete = summary.totalInboundAmount > 0 && summary.pendingBillingAmount === 0;

                      return (
                        <tr key={partner.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-sans font-bold text-slate-800">
                            {summary.partnerName || partner.partnerName}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-600">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                              {summary.workScope || '未指定'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                            NT$ {summary.estimatedAmount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                            NT$ {summary.totalInboundAmount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-800">
                            NT$ {summary.billedInboundAmount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right bg-amber-50/40">
                            {hasPending ? (
                              <span className="font-bold text-amber-700">
                                NT$ {summary.pendingBillingAmount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400">NT$ 0</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">
                            NT$ {summary.totalPaidAmount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            {hasPending ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>尚有未請款 (待請款)</span>
                              </span>
                            ) : isComplete ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>已全部請款完成</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-100">
                                尚未進貨
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            <button
                              type="button"
                              onClick={() => {
                                onDrillVendor(
                                  project,
                                  partner.partnerId,
                                  partner.partnerName,
                                  partner.workScope,
                                  partner.estimatedAmount
                                );
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer"
                              title="穿透檢視：調出該廠商僅屬於本案場的進料單據明細"
                            >
                              <PackageCheck className="w-3.5 h-3.5 text-indigo-600" />
                              <span>調閱本案進貨</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-indigo-600" />
                <span>此案場全部材料進貨簽收單據（即時累計成本來源）</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                共 {inboundReceipts.length} 筆進料簽收
              </span>
            </div>

            {inboundReceipts.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                此案場目前尚無材料進貨簽收單據
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <th className="py-2 px-3">單據號碼</th>
                      <th className="py-2 px-3">供應商</th>
                      <th className="py-2 px-3">簽收日期</th>
                      <th className="py-2 px-3">簽收人</th>
                      <th className="py-2 px-3 text-right">進料金額</th>
                      <th className="py-2 px-3 text-center">過帳狀態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {inboundReceipts.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-indigo-700">{rec.receiptNumber}</td>
                        <td className="py-2 px-3 font-sans text-slate-800">{rec.vendorNameSnapshot}</td>
                        <td className="py-2 px-3 text-slate-600">{rec.receivedDate}</td>
                        <td className="py-2 px-3 font-sans text-slate-700">{rec.receivedBy}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          NT$ {rec.totalAmount.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                            rec.status === 'POSTED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {rec.status === 'POSTED' ? '已過帳入成本' : '草稿未過帳'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 flex justify-end bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            關閉檢視
          </button>
        </div>
      </div>
    </div>
  );
};
