// src/components/projects/ProjectBudgetPartnersSection.tsx
// 🏗️ 建造執照法定團隊與預計協力廠商發包預算管理區塊 (由 ProjectEditorModal 拆出)

import React from 'react';
import { Briefcase, HardHat, Info, Plus, Trash2 } from 'lucide-react';
import { ProjectBudgetPartner } from '../../types/erp';
import { FloatingSubcontractorSelect } from '../widgets/FloatingSubcontractorSelect';

interface ProjectBudgetPartnersSectionProps {
  ownerName: string;
  developerName: string;
  onChangeDeveloperName: (val: string) => void;
  architect: string;
  onChangeArchitect: (val: string) => void;
  constructorName: string;
  onChangeConstructorName: (val: string) => void;
  budgetPartners: ProjectBudgetPartner[];
  totalEstimatedPartnerBudget: number;
  onAddBudgetPartner: () => void;
  onUpdateBudgetPartner: (id: string, updates: Partial<ProjectBudgetPartner>) => void;
  onRemoveBudgetPartner: (id: string) => void;
}

export const ProjectBudgetPartnersSection: React.FC<ProjectBudgetPartnersSectionProps> = ({
  ownerName,
  developerName,
  onChangeDeveloperName,
  architect,
  onChangeArchitect,
  constructorName,
  onChangeConstructorName,
  budgetPartners,
  totalEstimatedPartnerBudget,
  onAddBudgetPartner,
  onUpdateBudgetPartner,
  onRemoveBudgetPartner,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5">
        <HardHat className="w-4 h-4 text-purple-600" />
        <span>二、建造執照法定團隊與預計協力廠商管理 (叫料預算與請款對帳連動)</span>
      </div>

      <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-slate-700">
        <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-purple-900">營造實務架構說明（起造人 A vs. 合約發票抬頭 B）：</span>
          <span className="text-slate-600">
            當遇到「<strong>起造人 A</strong>」與「<strong>合約請款發票買受人 B</strong>」為不同主體時（例如：甲方為 B 開發營造有限公司、起造人為投資地主 A、乙方為本公司），請直接在下方起造人欄位填寫 A。系統在請款單與發票開立時將對齊甲方 B，執照與現勘工務對齊起造人 A！
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-medium text-slate-700 flex items-center gap-1">
              <span>執照法定起造人 (A)</span>
              <span className="text-rose-500">*</span>
            </label>
            {ownerName && developerName !== ownerName && (
              <button
                type="button"
                onClick={() => onChangeDeveloperName(ownerName)}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                title="若起造人同合約發票抬頭，點擊一鍵帶入"
              >
                同發票抬頭
              </button>
            )}
          </div>
          <input
            type="text"
            required
            value={developerName}
            onChange={(e) => onChangeDeveloperName(e.target.value)}
            placeholder="起造人全銜 (如: 陳大為 或 地主A)"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold"
          />
          <p className="text-[10px] text-slate-400 mt-1">執照法定起造人 (A)</p>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            設計監造人 (建築師事務所 / 結構技師)
          </label>
          <input
            type="text"
            value={architect}
            onChange={(e) => onChangeArchitect(e.target.value)}
            placeholder="例如：大元聯合建築師事務所 / 誠業結構技師"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            承造人 (營造廠全銜 / 專任工程人員)
          </label>
          <input
            type="text"
            value={constructorName}
            onChange={(e) => onChangeConstructorName(e.target.value)}
            placeholder="例如：大巨營造股份有限公司 / 林主任技師"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
          />
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
              <span>預計協力廠商清冊 (二階段式清單：工料類別 ➔ 公司名稱)</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              清單二階段快速選定：第一階為工料類別（如鋼材、混凝土、拆圖等），第二階為公司名稱（如中鋼、東和等）。選單採獨立懸浮層，僅需公司名稱，不需填寫繁複細節！
            </p>
          </div>
          <button
            type="button"
            onClick={onAddBudgetPartner}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新增預計協力廠商</span>
          </button>
        </div>

        {budgetPartners.length === 0 ? (
          <div className="p-4 bg-white rounded-lg border border-dashed border-slate-300 text-center text-slate-400 text-xs">
            尚未新增預計協力廠商。點擊上方「新增預計協力廠商」按鈕即可新增（例如：鋼材類的中鋼、東和；混凝土類的台泥等）。
          </div>
        ) : (
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse bg-white rounded-lg border border-slate-200">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-2 px-3 w-60">協力廠商公司名稱 (二階懸浮選單)</th>
                    <th className="py-2 px-3 w-40">承攬工料類別 / 工項</th>
                    <th className="py-2 px-3 w-36 text-right">預估發包金額 (NT$)</th>
                    <th className="py-2 px-3">備註說明</th>
                    <th className="py-2 px-2 w-12 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {budgetPartners.map((bp) => (
                    <tr key={bp.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <FloatingSubcontractorSelect
                          value={bp.partnerName}
                          workScope={bp.workScope}
                          placeholder="點選二階廠商 (中鋼/東和等)..."
                          onChange={(vendorName, category) => {
                            onUpdateBudgetPartner(bp.id, {
                              partnerName: vendorName,
                              workScope: bp.workScope ? bp.workScope : (category || ''),
                            });
                          }}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={bp.workScope || ''}
                          onChange={(e) => onUpdateBudgetPartner(bp.id, { workScope: e.target.value })}
                          placeholder="例如: 鋼材/混凝土/拆圖"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={bp.estimatedAmount || 0}
                          onChange={(e) => onUpdateBudgetPartner(bp.id, { estimatedAmount: Number(e.target.value) || 0 })}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono font-bold text-right text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={bp.notes || ''}
                          onChange={(e) => onUpdateBudgetPartner(bp.id, { notes: e.target.value })}
                          placeholder="備註料號、發包階段或叫料期程"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700 text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => onRemoveBudgetPartner(bp.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="刪除此協力廠商列"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-2 pt-1">
              <span className="text-[11px] text-slate-500">
                共登錄 <span className="font-bold text-indigo-700">{budgetPartners.length}</span> 家協力廠商
              </span>
              <div className="text-xs font-medium text-slate-700">
                預計發包總金額合計：
                <span className="font-mono font-bold text-indigo-700 text-sm ml-1">
                  NT$ {totalEstimatedPartnerBudget.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
