import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Contact,
  Plus,
  CreditCard,
  HardHat,
  Edit,
  Trash2,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight
} from 'lucide-react';
import { BusinessPartner, PartnerChequeRecord } from '../../types/erp';
import { validateTaiwanTaxId } from '../../utils/taiwanValidation';
import { MediaPreviewItem } from '../widgets/MediaPreviewLightbox';
import { HoverMediaPreviewData } from '../widgets/HoverMediaPopover';

export interface DeletePartnerRequest {
  type: 'PARTNER';
  id: string;
  name: string;
  isBoth: boolean;
  extraNotice: string;
}

interface PartnerDirectoryTableViewProps {
  pagedPartners: BusinessPartner[];
  totalFilteredCount: number;
  activeTab: 'CLIENTS' | 'VENDORS';
  selectedMainCategory: string;
  onSelectMainCategory: (tag: string) => void;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  canWrite: boolean;
  onEditPartner: (p: BusinessPartner) => void;
  onOpenAddCheque: (partnerId: string) => void;
  onSelectChequeDetail: (cheque: PartnerChequeRecord) => void;
  onOpenAddCard: (partner: BusinessPartner) => void;
  onUpgradeClient: (partner: BusinessPartner) => void;
  onRequestDeletePartner: (req: DeletePartnerRequest) => void;
  onOpenLightbox: (media: MediaPreviewItem) => void;
  onHoverPreview: (preview: HoverMediaPreviewData | null) => void;
}

export const PartnerDirectoryTableView: React.FC<PartnerDirectoryTableViewProps> = ({
  pagedPartners,
  totalFilteredCount,
  activeTab,
  selectedMainCategory,
  onSelectMainCategory,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  canWrite,
  onEditPartner,
  onOpenAddCheque,
  onSelectChequeDetail,
  onOpenAddCard,
  onUpgradeClient,
  onRequestDeletePartner,
  onOpenLightbox,
  onHoverPreview
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold select-none">
              <th className="py-2.5 px-3 w-24">夥伴編號</th>
              <th className="py-2.5 px-3 min-w-[180px]">夥伴名稱 / 身分</th>
              <th className="py-2.5 px-3 w-32">統一編號</th>
              <th className="py-2.5 px-3 min-w-[160px]">
                {activeTab === 'VENDORS' ? '第一階分類 / 專長' : '接案工項 / 服務項目'}
              </th>
              <th className="py-2.5 px-3 w-28">負責人 / 窗口</th>
              <th className="py-2.5 px-3 w-32">主要電話</th>
              <th className="py-2.5 px-3 min-w-[200px]">通訊地址 (拆分)</th>
              <th className="py-2.5 px-3 w-24 text-center">手續費</th>
              <th className="py-2.5 px-3 w-28 text-center">票據往來</th>
              <th className="py-2.5 px-3 w-20 text-center">名片</th>
              <th className="py-2.5 px-3 w-20 text-center">風控</th>
              <th className="py-2.5 px-3 w-36 text-right">操作功能</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedPartners.map(p => {
              const isTaxValid = validateTaiwanTaxId(p.taxId).isValid;
              const chkCount = p.chequeRecords?.length || 0;
              const cardCount = p.businessCards?.length || 0;
              const primaryCard = p.businessCards?.[0];
              const tags =
                p.categoryTags && p.categoryTags.length > 0
                  ? p.categoryTags
                  : p.categoryMain || p.serviceCategoryMain
                  ? [p.categoryMain || p.serviceCategoryMain!]
                  : [];

              return (
                <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{p.bpCode}</td>

                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                      <span className="truncate max-w-[180px]" title={p.name}>
                        {p.name}
                      </span>
                      {p.isCustomer && p.isVendor ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-purple-100 text-purple-800 shrink-0">
                          雙重身分
                        </span>
                      ) : p.isCustomer ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-indigo-100 text-indigo-800 shrink-0">
                          業主
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800 shrink-0">
                          廠商
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 px-3 font-mono">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-800 font-bold">{p.taxId}</span>
                      {isTaxValid ? (
                        <span
                          className="w-3.5 h-3.5 text-emerald-600 inline-flex items-center justify-center shrink-0"
                          title="統一編號邏輯檢核正確"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span
                          className="w-3.5 h-3.5 text-amber-500 inline-flex items-center justify-center shrink-0"
                          title="統編待驗證或為非標準自然人"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1 flex-wrap max-w-[220px]">
                      {tags.map((tag, tIdx) => (
                        <button
                          key={tIdx}
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onSelectMainCategory(tag === selectedMainCategory ? 'ALL' : tag);
                          }}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 shadow-2xs shrink-0 cursor-pointer transition-colors ${
                            selectedMainCategory === tag
                              ? 'bg-amber-600 text-white'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                          }`}
                          title={`點擊快速篩選標籤「${tag}」 (再次點擊取消)`}
                        >
                          🏷️ {tag}
                        </button>
                      ))}
                      {(p.categorySub || p.serviceCategorySub) && (
                        <span
                          className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-medium truncate max-w-[120px]"
                          title={`細部專長/叫料項目：${p.categorySub || p.serviceCategorySub}`}
                        >
                          {p.categorySub || p.serviceCategorySub}
                        </span>
                      )}
                      {tags.length === 0 && !(p.categorySub || p.serviceCategorySub) && (
                        <span className="text-[10px] text-slate-400">-</span>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 px-3 text-slate-700">
                    <div className="truncate font-medium" title={p.representative || p.contactPerson}>
                      {p.representative ? p.representative : p.contactPerson || '-'}
                    </div>
                    {p.representative && p.contactPerson && p.representative !== p.contactPerson && (
                      <div className="text-[10px] text-slate-400 truncate">窗: {p.contactPerson}</div>
                    )}
                  </td>

                  <td className="py-2.5 px-3 font-mono text-slate-700">{p.phone || '-'}</td>

                  <td className="py-2.5 px-3 text-slate-600">
                    <div className="truncate max-w-[220px]" title={p.address}>
                      {p.address || '-'}
                    </div>
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        p.bankFeePayer === 'PARTNER'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {p.bankFeePayer === 'PARTNER' ? '自付' : '公司吸收'}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    {chkCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const chk = p.chequeRecords?.[0];
                          if (chk) onSelectChequeDetail(chk);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 transition-colors cursor-pointer"
                        title="點擊查看支票明細與備註"
                      >
                        <Receipt className="w-3 h-3" />
                        <span>{chkCount} 張</span>
                      </button>
                    ) : (
                      <span className="text-slate-300 text-[11px]">-</span>
                    )}
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    {cardCount > 0 ? (
                      <div className="inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (primaryCard?.cardFrontUrl) {
                              onOpenLightbox({
                                url: primaryCard.cardFrontUrl,
                                title: `名片：${p.name} - ${primaryCard.name}`,
                                isPdf: primaryCard.cardFileType === 'PDF'
                              });
                            } else {
                              onOpenAddCard(p);
                            }
                          }}
                          onMouseEnter={e => {
                            if (!primaryCard?.cardFrontUrl) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            onHoverPreview({
                              url: primaryCard.cardFrontUrl,
                              title: `名片：${primaryCard.name} (${primaryCard.title || ''})`,
                              isPdf: primaryCard.cardFileType === 'PDF',
                              x: rect.left - 400,
                              y: rect.top - 80
                            });
                          }}
                          onMouseLeave={() => onHoverPreview(null)}
                          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"
                          title="移入看名片大圖，點擊全螢幕預覽"
                        >
                          <Contact className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenAddCard(p)}
                        className="text-slate-300 hover:text-indigo-600 p-1 rounded cursor-pointer"
                        title="上傳名片圖檔/PDF"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    {p.isHighRisk ? (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                        高風險
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">{p.currentScore || 85}分</span>
                    )}
                  </td>

                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => onOpenAddCheque(p.id)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="登記支票"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => onOpenAddCard(p)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="交換/上傳名片"
                        >
                          <Contact className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {activeTab === 'CLIENTS' && !p.isVendor && canWrite && (
                        <button
                          type="button"
                          onClick={() => onUpgradeClient(p)}
                          className="p-1 rounded text-amber-600 hover:text-amber-800 hover:bg-amber-50 transition-colors cursor-pointer"
                          title="兼具合作廠商：啟動補填廠商工料分類與銀行帳戶流程"
                        >
                          <HardHat className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => onEditPartner(p)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="編輯夥伴主檔"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canWrite && (
                        <button
                          type="button"
                          onClick={() =>
                            onRequestDeletePartner({
                              type: 'PARTNER',
                              id: p.id,
                              name: p.name,
                              isBoth: Boolean(p.isCustomer && p.isVendor),
                              extraNotice:
                                p.isCustomer && p.isVendor
                                  ? '此夥伴同時具備業主與合作廠商雙重身分。您可以選擇僅移除業主身分，或完全刪除。'
                                  : '執行刪除後將對商業夥伴執行軟刪除，相關歷史估驗與報價單據仍完整保留備查。'
                            })
                          }
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="刪除夥伴"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 表格底部翻頁控制列 */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <div>
          顯示第 <strong className="font-mono">{(currentPage - 1) * pageSize + 1}</strong> 至{' '}
          <strong className="font-mono">{Math.min(currentPage * pageSize, totalFilteredCount)}</strong> 筆，共{' '}
          <strong className="font-mono text-slate-900">{totalFilteredCount}</strong> 筆夥伴
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
              title="第一頁"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
              title="上一頁"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="px-3 py-1 font-mono font-bold text-slate-800">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
              title="下一頁"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
              title="最後一頁"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
