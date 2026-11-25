import React from 'react';
import {
  Users2,
  Layers,
  Lock,
  Unlock,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { BusinessPartner } from '../../../types/erp';
import { TaiwanIdTaxValidatorWidget } from '../../widgets/TaiwanIdTaxValidatorWidget';

export interface MappedCategoryItem {
  mainCategory: string;
  subCategories: string[];
}

export interface PartnerBasicInfoTabProps {
  editingPartner: BusinessPartner;
  setEditingPartner: React.Dispatch<React.SetStateAction<BusinessPartner>>;
  categoryTree: MappedCategoryItem[];
  isClientOnly: boolean;
  isPerson: boolean;
  isTaxRequired: boolean;
  isTagEditMode: boolean;
  setIsTagEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  pendingDeleteTag: string | null;
  setPendingDeleteTag: React.Dispatch<React.SetStateAction<string | null>>;
  lastRemovedTag: string | null;
  setLastRemovedTag: React.Dispatch<React.SetStateAction<string | null>>;
  showToast: (msg: string) => void;
}

export const PartnerBasicInfoTab: React.FC<PartnerBasicInfoTabProps> = ({
  editingPartner,
  setEditingPartner,
  categoryTree,
  isClientOnly,
  isPerson,
  isTaxRequired,
  isTagEditMode,
  setIsTagEditMode,
  pendingDeleteTag,
  setPendingDeleteTag,
  lastRemovedTag,
  setLastRemovedTag,
  showToast
}) => {
  const defaultCat = categoryTree[0]?.mainCategory || '鋼材';
  const currentTags =
    editingPartner.categoryTags && editingPartner.categoryTags.length > 0
      ? editingPartner.categoryTags
      : [editingPartner.categoryMain || defaultCat];

  return (
    <div className="space-y-4">
      {/* 業主名冊專屬說明橫幅 */}
      {isClientOnly && (
        <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between text-xs gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <div>
              <span className="font-bold text-indigo-950">業主名冊專屬建檔版面</span>
              <span className="text-[11px] text-indigo-700 block">
                個人自住業主免強制身分證，公司法人則自動連動統編驗證。
              </span>
            </div>
          </div>
          <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg shadow-2xs cursor-pointer font-bold text-indigo-900 shrink-0">
            <input
              type="checkbox"
              checked={Boolean(editingPartner.isIndividual)}
              onChange={e => {
                const checked = e.target.checked;
                setEditingPartner({
                  ...editingPartner,
                  isIndividual: checked,
                  entityType: checked ? 'NATURAL_PERSON' : editingPartner.entityType
                });
              }}
              className="rounded text-indigo-600"
            />
            <span>個人自建/自住業主 (免身分證)</span>
          </label>
        </div>
      )}

      {/* 法人別與業務身分 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            實體組織型態 (法人別)
          </label>
          <div className="flex items-center gap-4 mt-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="modalEntityType"
                checked={editingPartner.entityType !== 'NATURAL_PERSON' && !editingPartner.isIndividual}
                onChange={() =>
                  setEditingPartner({
                    ...editingPartner,
                    entityType: 'CORPORATION',
                    isIndividual: false
                  })
                }
                className="text-indigo-600"
              />
              <span>公司法人 (營利事業)</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="modalEntityType"
                checked={editingPartner.entityType === 'NATURAL_PERSON' || Boolean(editingPartner.isIndividual)}
                onChange={() =>
                  setEditingPartner({
                    ...editingPartner,
                    entityType: 'NATURAL_PERSON',
                    isIndividual: Boolean(editingPartner.isCustomer)
                  })
                }
                className="text-indigo-600"
              />
              <span>自然人 (個人業主/工班師傅)</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            業務身分定義 <span className="text-red-500">* (至少須勾選一項)</span>
          </label>
          <div className="flex items-center gap-4 mt-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(editingPartner.isCustomer)}
                onChange={e => {
                  const newChecked = e.target.checked;
                  if (!newChecked && !editingPartner.isVendor) {
                    showToast('⚠️ 業務身分至少須勾選一項（業主或合作廠商）');
                    return;
                  }
                  const nextIsCust = newChecked;
                  const nextIsVend = Boolean(editingPartner.isVendor);
                  const nextType = nextIsCust && nextIsVend ? 'BOTH' : nextIsCust ? 'CUSTOMER' : 'VENDOR';
                  setEditingPartner({
                    ...editingPartner,
                    isCustomer: nextIsCust,
                    type: nextType
                  });
                }}
                className="rounded text-indigo-600"
              />
              <span>業主 (客戶 / 發包方)</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(editingPartner.isVendor)}
                onChange={e => {
                  const newChecked = e.target.checked;
                  if (!newChecked && !editingPartner.isCustomer) {
                    showToast('⚠️ 業務身分至少須勾選一項（業主或合作廠商）');
                    return;
                  }
                  const nextIsVend = newChecked;
                  const nextIsCust = Boolean(editingPartner.isCustomer);
                  const nextType = nextIsCust && nextIsVend ? 'BOTH' : nextIsCust ? 'CUSTOMER' : 'VENDOR';
                  setEditingPartner({
                    ...editingPartner,
                    isVendor: nextIsVend,
                    type: nextType,
                    categoryMain: nextIsVend ? editingPartner.categoryMain || defaultCat : editingPartner.categoryMain
                  });
                }}
                className="rounded text-indigo-600"
              />
              <span>合作廠商 (協力包商 / 材料商)</span>
            </label>
          </div>
        </div>
      </div>

      {/* 廠商多角化分類標籤 (防誤刪安全鎖 + 雙重確認 + 復原條) */}
      {editingPartner.isVendor && (
        <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="block text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-700" />
              <span>廠商工料分類標籤 (多角化多標籤)</span>
              <span className="text-red-500">* (至少保留 1 項)</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setIsTagEditMode(!isTagEditMode);
                setPendingDeleteTag(null);
              }}
              className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                isTagEditMode
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-300'
              }`}
            >
              {isTagEditMode ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-rose-600" />
                  <span>標籤解鎖編輯中 (點此鎖定)</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>🔒 標籤安全鎖定中 (防誤刪)</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap p-2.5 bg-white border border-amber-300 rounded-xl min-h-[48px]">
            {currentTags.map((tag, tIdx) => {
              const isPendingDelete = pendingDeleteTag === tag;
              if (isPendingDelete) {
                return (
                  <span
                    key={tIdx}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 border-2 border-rose-500 text-rose-950 text-xs font-bold"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>確定移除【{tag}】？</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentTags.length <= 1) {
                          showToast('⚠️ 至少須保留 1 個分類標籤！');
                          setPendingDeleteTag(null);
                          return;
                        }
                        const newTags = currentTags.filter((_, idx) => idx !== tIdx);
                        setEditingPartner({
                          ...editingPartner,
                          categoryTags: newTags,
                          categoryMain: newTags[0] || '',
                          serviceCategoryMain: newTags[0] || ''
                        });
                        setPendingDeleteTag(null);
                        setLastRemovedTag(tag);
                        showToast(`✓ 已成功移除標籤「${tag}」`);
                      }}
                      className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-xs cursor-pointer"
                    >
                      確認移除
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteTag(null)}
                      className="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-300 font-medium text-xs cursor-pointer"
                    >
                      取消
                    </button>
                  </span>
                );
              }

              return (
                <span
                  key={tIdx}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs ${
                    isTagEditMode
                      ? 'bg-amber-100 text-amber-950 border border-amber-400'
                      : 'bg-amber-50 text-amber-900 border border-amber-300'
                  }`}
                >
                  <span>🏷️ {tag}</span>
                  {isTagEditMode && currentTags.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteTag(tag)}
                      className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-200 hover:bg-rose-100 hover:text-rose-700 text-amber-800 border border-amber-300 cursor-pointer"
                    >
                      移除
                    </button>
                  )}
                </span>
              );
            })}

            {/* 下拉添加字典標籤 */}
            <select
              value=""
              onChange={e => {
                const selected = e.target.value;
                if (!selected) return;
                if (!currentTags.includes(selected)) {
                  const updated = [...currentTags, selected];
                  setEditingPartner({
                    ...editingPartner,
                    categoryTags: updated,
                    categoryMain: updated[0],
                    serviceCategoryMain: updated[0]
                  });
                  showToast(`✓ 已加入產品標籤「${selected}」`);
                }
              }}
              className="text-xs py-1.5 px-2 bg-amber-50 border border-dashed border-amber-400 rounded-lg text-amber-900 font-semibold cursor-pointer"
            >
              <option value="">＋ 新增字典標籤...</option>
              {categoryTree
                .filter(g => !currentTags.includes(g.mainCategory))
                .map(g => (
                  <option key={g.mainCategory} value={g.mainCategory}>
                    🏷️ {g.mainCategory}
                  </option>
                ))}
            </select>
          </div>

          {lastRemovedTag && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs">
              <span>剛才移除了標籤：🏷️ {lastRemovedTag}</span>
              <button
                type="button"
                onClick={() => {
                  const existing = editingPartner.categoryTags || [];
                  setEditingPartner({
                    ...editingPartner,
                    categoryTags: [...existing, lastRemovedTag]
                  });
                  setLastRemovedTag(null);
                }}
                className="px-2.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>復原</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 名稱與統編驗證機小程式 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {isClientOnly ? '業主全銜 / 客戶名稱' : '夥伴名稱 / 公司全稱'} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={editingPartner.name}
            onChange={e => setEditingPartner({ ...editingPartner, name: e.target.value })}
            placeholder={isPerson ? '例：林建國 (個人業主/地主代表)' : '例：宏聯資產開發股份有限公司'}
            className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 font-bold"
          />
        </div>

        <div>
          <TaiwanIdTaxValidatorWidget
            type={isPerson ? 'NATIONAL_ID' : 'TAX_ID'}
            value={editingPartner.taxId || ''}
            onChange={val => setEditingPartner({ ...editingPartner, taxId: val })}
            label={
              isPerson
                ? isTaxRequired
                  ? '身分證字號 (10 碼)'
                  : '身分證字號 (個人業主選填，免強制)'
                : '公司統一編號 (8 碼)'
            }
            required={isTaxRequired}
          />
        </div>
      </div>

      {/* 負責人身分與收付款約定 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {isPerson ? '業主/聯絡代表姓名' : '負責人姓名'}
          </label>
          <input
            type="text"
            value={editingPartner.representative || ''}
            onChange={e => setEditingPartner({ ...editingPartner, representative: e.target.value })}
            placeholder={isPerson ? '填寫聯絡代表' : '公司代表人'}
            className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {isClientOnly ? '付款方式約定' : '手續費/匯費負擔方'}
          </label>
          {isClientOnly ? (
            <select
              value={editingPartner.bankFeePayer || 'COMPANY'}
              onChange={e =>
                setEditingPartner({
                  ...editingPartner,
                  bankFeePayer: e.target.value as any
                })
              }
              className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-bold"
            >
              <option value="COMPANY">🏦 銀行匯款轉帳 (公庫入帳)</option>
              <option value="PARTNER">💵 支票或現金交付</option>
            </select>
          ) : (
            <select
              value={editingPartner.bankFeePayer || 'COMPANY'}
              onChange={e =>
                setEditingPartner({
                  ...editingPartner,
                  bankFeePayer: e.target.value as any
                })
              }
              className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-bold"
            >
              <option value="COMPANY">🏢 公司自行吸收 (請款 100 全額匯 100)</option>
              <option value="PARTNER">👤 廠商自付 (匯款時內扣 30 元手續費)</option>
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {isClientOnly ? '請款收款天數' : '付款條件天數 (票期)'}
          </label>
          <select
            value={editingPartner.paymentTermsDays || 30}
            onChange={e =>
              setEditingPartner({
                ...editingPartner,
                paymentTermsDays: Number(e.target.value)
              })
            }
            className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-bold"
          >
            <option value={0}>0 天 (即期給付)</option>
            <option value={30}>30 天 (月結 30 天)</option>
            <option value={45}>45 天</option>
            <option value={60}>60 天 (二個月票期)</option>
            <option value={90}>90 天 (三個月票期)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          慣用付款方式備註 (自由填寫，對帳／請款時自動提示會計與出納)
        </label>
        <input
          type="text"
          value={editingPartner.paymentMethodNotes || ''}
          onChange={e => setEditingPartner({ ...editingPartner, paymentMethodNotes: e.target.value })}
          placeholder="例：月結30天支票、每月7/17/27日對帳電匯、現場完工領現..."
          className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg"
        />
      </div>

      {/* 統一發票與高風險管制 */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
            <input
              type="checkbox"
              checked={editingPartner.hasInvoice !== false}
              onChange={e => setEditingPartner({ ...editingPartner, hasInvoice: e.target.checked })}
              className="rounded text-indigo-600"
            />
            <span>提供合法統一發票 (電子/三聯式發票)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(editingPartner.isHighRisk)}
              onChange={e => setEditingPartner({ ...editingPartner, isHighRisk: e.target.checked })}
              className="rounded text-red-600 focus:ring-red-500"
            />
            <span className="text-xs font-bold text-red-700">
              列為高風險管制夥伴 (停權 / 警示 / 請款凍結)
            </span>
          </label>
        </div>

        {editingPartner.isHighRisk && (
          <input
            type="text"
            value={editingPartner.riskReason || ''}
            onChange={e => setEditingPartner({ ...editingPartner, riskReason: e.target.value })}
            placeholder="請述明風險原因（例：曾有工程逾期爭議紀錄，發包或計價前需副總核准）..."
            className="w-full text-xs p-2 bg-white border border-red-300 rounded-lg text-red-900"
          />
        )}
      </div>
    </div>
  );
};
