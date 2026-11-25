import React from 'react';
import {
  CheckCircle2,
  Phone,
  MapPin,
  Receipt,
  CreditCard,
  Contact,
  HardHat,
  Trash2
} from 'lucide-react';
import { BusinessPartner, PartnerChequeRecord } from '../../types/erp';
import { validateTaiwanTaxId } from '../../utils/taiwanValidation';
import { DeletePartnerRequest } from './PartnerDirectoryTableView';

interface PartnerDirectoryCardViewProps {
  pagedPartners: BusinessPartner[];
  activeTab: 'CLIENTS' | 'VENDORS';
  selectedMainCategory: string;
  onSelectMainCategory: (tag: string) => void;
  canWrite: boolean;
  onEditPartner: (p: BusinessPartner) => void;
  onOpenAddCheque: (partnerId: string) => void;
  onSelectChequeDetail: (cheque: PartnerChequeRecord) => void;
  onOpenAddCard: (partner: BusinessPartner) => void;
  onUpgradeClient: (partner: BusinessPartner) => void;
  onRequestDeletePartner: (req: DeletePartnerRequest) => void;
}

export const PartnerDirectoryCardView: React.FC<PartnerDirectoryCardViewProps> = ({
  pagedPartners,
  activeTab,
  selectedMainCategory,
  onSelectMainCategory,
  canWrite,
  onEditPartner,
  onOpenAddCheque,
  onSelectChequeDetail,
  onOpenAddCard,
  onUpgradeClient,
  onRequestDeletePartner
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {pagedPartners.map(p => {
        const isTaxValid = validateTaiwanTaxId(p.taxId).isValid;
        const chequeCount = p.chequeRecords?.length || 0;
        const cardCount = p.businessCards?.length || 0;
        const tags =
          p.categoryTags && p.categoryTags.length > 0
            ? p.categoryTags
            : p.categoryMain || p.serviceCategoryMain
            ? [p.categoryMain || p.serviceCategoryMain!]
            : [];

        return (
          <div
            key={p.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-400">{p.bpCode}</span>
                    {p.isCustomer && p.isVendor ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-purple-100 text-purple-800">
                        業主暨廠商
                      </span>
                    ) : p.isCustomer ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-indigo-100 text-indigo-800">
                        業主 (發包方)
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800">
                        合作廠商
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 truncate mt-0.5" title={p.name}>
                    {p.name}
                  </h3>
                </div>

                {p.isHighRisk && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 shrink-0">
                    高風險
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">統編：</span>
                  <span className="font-mono font-bold text-slate-800">{p.taxId}</span>
                  {isTaxValid && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>驗證通過</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-400 text-[11px]">{p.isVendor ? '分類標籤：' : '工項：'}</span>
                  {tags.map((tag, tIdx) => (
                    <button
                      key={tIdx}
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onSelectMainCategory(tag === selectedMainCategory ? 'ALL' : tag);
                      }}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 transition-colors cursor-pointer ${
                        selectedMainCategory === tag
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                      }`}
                      title={`點擊快速篩選標籤「${tag}」`}
                    >
                      🏷️ {tag}
                    </button>
                  ))}
                  {(p.categorySub || p.serviceCategorySub) && (
                    <span
                      className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-medium"
                      title={`細部專長/叫料項目：${p.categorySub || p.serviceCategorySub}`}
                    >
                      {p.categorySub || p.serviceCategorySub}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">{p.phone || '未登記電話'}</span>
                </div>

                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{p.address || '未登記通訊地址'}</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-semibold text-slate-700">支票往來：</span>
                  <strong className="text-indigo-700 font-mono font-bold">{chequeCount} 筆</strong>
                </div>
                {chequeCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const chk = p.chequeRecords?.[0];
                      if (chk) onSelectChequeDetail(chk);
                    }}
                    className="text-[11px] text-indigo-600 hover:underline font-bold cursor-pointer"
                  >
                    查看明細
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1">
                {cardCount > 0 && (
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                    📇 名片 {cardCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => onOpenAddCheque(p.id)}
                    className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold cursor-pointer"
                    title="登記支票"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                  </button>
                )}
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => onOpenAddCard(p)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                    title="交換名片"
                  >
                    <Contact className="w-3.5 h-3.5" />
                  </button>
                )}
                {activeTab === 'CLIENTS' && !p.isVendor && canWrite && (
                  <button
                    type="button"
                    onClick={() => onUpgradeClient(p)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1 border border-amber-300 cursor-pointer"
                    title="啟動補填廠商工料分類與銀行帳戶流程"
                  >
                    <HardHat className="w-3.5 h-3.5 text-amber-600" />
                    <span>兼任廠商</span>
                  </button>
                )}
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => onEditPartner(p)}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                  >
                    編輯
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
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
