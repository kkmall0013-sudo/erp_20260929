// src/components/inbound/InboundGridDropdown.tsx
// ⚡ fixed 全局浮動推薦下拉選單（協力廠商、施工案場與廠內資產、歷史連動品名與三道防線、常用規格膠囊）

import React from 'react';
import {
  Building2,
  Sparkles,
  Truck,
  Package,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Layers
} from 'lucide-react';
import { Project, BusinessPartner, Item } from '../../types/erp';
import { InternalAsset, getAssetCategory } from '../../utils/internalAssetStore';
import {
  ExcelGridRow,
  CanonicalRule,
  HistoricalItemMemory,
  getIndustryCommonSpecs,
  detectSpecInItemName,
  findCanonicalRule,
  findSimilarItems
} from './excelInboundEngine';
import { FloatingPopoverCoords } from '../../utils/floatingPopover';
import { FloatingPortalPopover } from '../widgets/FloatingPortalPopover';

export interface ActiveDropdownState {
  rowId: string;
  field: 'site' | 'vendor' | 'item' | 'spec';
  rect: FloatingPopoverCoords;
}

interface InboundGridDropdownProps {
  activeDropdown: ActiveDropdownState | null;
  onCloseDropdown: () => void;
  gridRows: ExcelGridRow[];
  vendors: BusinessPartner[];
  projects: Project[];
  internalAssets: InternalAsset[];
  items: Item[];
  historicalMemory: HistoricalItemMemory;
  onSelectVendor: (rowId: string, ven: BusinessPartner) => void;
  onOpenQuickCreateVendor: (rowId: string, currentInput: string) => void;
  onSelectInternalAsset: (rowId: string, asset: InternalAsset | string) => void;
  onSelectProject: (rowId: string, prj: Project) => void;
  onQuickCreateAsset: (rowId: string, inputName: string) => void;
  onOpenQuickCreateProject: (rowId: string, currentInput: string) => void;
  onApplySpecDetachment: (rowId: string, cleanedName: string, extractedSpec: string) => void;
  onApplyCanonicalItem: (rowId: string, rule: CanonicalRule) => void;
  onSelectItem: (rowId: string, itemName: string, unit?: string, unitPrice?: number, suggestedSpec?: string) => void;
  onOpenQuickCreateItem: (rowId: string, itemName: string, unit: string, price: number) => void;
  onSelectSpec: (rowId: string, specVal: string) => void;
}

export const InboundGridDropdown: React.FC<InboundGridDropdownProps> = ({
  activeDropdown,
  onCloseDropdown,
  gridRows,
  vendors,
  projects,
  internalAssets,
  items,
  historicalMemory,
  onSelectVendor,
  onOpenQuickCreateVendor,
  onSelectInternalAsset,
  onSelectProject,
  onQuickCreateAsset,
  onOpenQuickCreateProject,
  onApplySpecDetachment,
  onApplyCanonicalItem,
  onSelectItem,
  onOpenQuickCreateItem,
  onSelectSpec
}) => {
  if (!activeDropdown) return null;

  const activeRow = gridRows.find(r => r.id === activeDropdown.rowId);
  if (!activeRow) return null;

  const { rect, field, rowId } = activeDropdown;

  return (
    <FloatingPortalPopover
      isOpen={Boolean(activeDropdown)}
      coords={rect}
      onClose={onCloseDropdown}
      ignoreOutsideSelector="[data-dropdown-trigger]"
      onScrollOutside="CLOSE"
      zIndex={9999}
      className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[320px] animate-in fade-in zoom-in-95 duration-100"
    >
      {/* 1. 廠商下拉選單 */}
      {field === 'vendor' &&
        (() => {
          const query = activeRow.vendorInputName.trim().toLowerCase();
          const filtered = vendors.filter(v => {
            if (!query) return true;
            return (
              (v.name && v.name.toLowerCase().includes(query)) ||
              (v.bpCode && v.bpCode.toLowerCase().includes(query)) ||
              (v.taxId && v.taxId.includes(query)) ||
              (v.contactPerson && v.contactPerson.toLowerCase().includes(query))
            );
          });

          return (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-600" />
                  <span>🏢 合作廠商主檔清冊</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  共 {filtered.length} 家
                </span>
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-slate-100 p-1">
                {filtered.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">查無「{activeRow.vendorInputName}」之合作廠商</div>
                ) : (
                  filtered.map(v => (
                    <div
                      key={v.id}
                      onClick={() => onSelectVendor(rowId, v)}
                      className="px-3 py-2 hover:bg-purple-50/70 rounded-lg cursor-pointer transition-colors group flex items-start justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900 group-hover:text-purple-700">{v.name}</div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                          {v.taxId && <span>統編: {v.taxId}</span>}
                          {v.contactPerson && <span>聯絡人: {v.contactPerson}</span>}
                          {v.phone && <span>電話: {v.phone}</span>}
                        </div>
                      </div>
                      <span className="text-[10px] text-purple-600 opacity-0 group-hover:opacity-100 font-bold shrink-0 self-center">
                        點選帶入 ↵
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-slate-200 bg-slate-50 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenQuickCreateVendor(rowId, activeRow.vendorInputName)}
                  className="w-full py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>登記「{activeRow.vendorInputName || '新廠商'}」至合作廠商主檔</span>
                </button>
              </div>
            </div>
          );
        })()}

      {/* 2. 案場與廠內資產下拉選單 */}
      {field === 'site' &&
        (() => {
          const query = activeRow.siteInputName.trim().toLowerCase();

          const filteredProjects = projects.filter(p => {
            if (p.isDeleted) return false;
            const isCompletedOrLocked = p.status === 'COMPLETED' || p.status === 'LOCKED';
            if (!query && isCompletedOrLocked) return false;
            if (!query) return true;
            return (
              (p.name && p.name.toLowerCase().includes(query)) ||
              (p.projectCode && p.projectCode.toLowerCase().includes(query)) ||
              (p.ownerName && p.ownerName.toLowerCase().includes(query))
            );
          });

          const filteredAssets = internalAssets.filter(a => {
            if (a.status === 'RETIRED') return false;
            if (!query) return true;
            return (
              a.name.toLowerCase().includes(query) ||
              a.code.toLowerCase().includes(query) ||
              (a.licensePlate && a.licensePlate.toLowerCase().includes(query)) ||
              a.aliases.some(al => al.toLowerCase().includes(query))
            );
          });

          return (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>案場與廠內資產對齊選單</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  施工中案場 {filteredProjects.length} · 廠內資產 {filteredAssets.length}
                </span>
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-slate-100 p-1">
                {filteredAssets.length > 0 && (
                  <div className="pb-1 mb-1">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-blue-900 bg-blue-50/90 rounded flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1">
                        <Truck className="w-3 h-3 text-blue-600" />
                        <span>🏢 廠內資產（動產 · 不動產 · 庫存登記）</span>
                      </span>
                      <span className="text-[9px] font-mono text-blue-700">{filteredAssets.length} 項目</span>
                    </div>
                    {filteredAssets.map(a => {
                      const cat = getAssetCategory(a);
                      return (
                        <div
                          key={a.id}
                          onClick={() => onSelectInternalAsset(rowId, a)}
                          className="px-3 py-1.5 hover:bg-blue-50/80 rounded-lg cursor-pointer transition-colors group flex items-center justify-between gap-2 mb-0.5 border border-transparent hover:border-blue-200"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-900 group-hover:text-blue-900 flex items-center gap-1.5">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-semibold shrink-0 ${
                                  cat === 'MOVABLE'
                                    ? 'bg-amber-100 text-amber-800'
                                    : cat === 'REAL_ESTATE'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {cat === 'MOVABLE' ? '🚗 動產' : cat === 'REAL_ESTATE' ? '🏢 不動產' : '📦 庫存'}
                              </span>
                              <span className="truncate">{a.name}</span>
                              {a.licensePlate && (
                                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-blue-100 text-blue-800 font-bold shrink-0">
                                  {a.licensePlate}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                              <span>
                                代碼: <strong className="text-slate-700">{a.code}</strong>
                              </span>
                              {a.driverOrCustodian && <span>保管/司機: {a.driverOrCustodian}</span>}
                              {a.aliases.length > 0 && (
                                <span className="text-slate-400 truncate max-w-[200px]">
                                  別名: {a.aliases.slice(0, 3).join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-blue-700 opacity-0 group-hover:opacity-100 font-bold shrink-0">
                            帶入 ↵
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div>
                  <div className="px-2.5 py-1 text-[10px] font-bold text-amber-900 bg-amber-50/90 rounded flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-amber-600" />
                      <span>🏗️ 施工工程案場（正在施工中）</span>
                    </span>
                    <span className="text-[9px] font-mono text-amber-700">{filteredProjects.length} 案場</span>
                  </div>
                  {filteredProjects.length === 0 && filteredAssets.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      查無「{activeRow.siteInputName}」之施工中案場或廠內資產，可在下方直接登記！
                    </div>
                  ) : (
                    filteredProjects.map(p => {
                      const isCompleted = p.status === 'COMPLETED' || p.status === 'LOCKED';
                      return (
                        <div
                          key={p.id}
                          onClick={() => onSelectProject(rowId, p)}
                          className="px-3 py-1.5 hover:bg-amber-50/70 rounded-lg cursor-pointer transition-colors group flex items-start justify-between gap-2 mb-0.5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-900 group-hover:text-amber-800 flex items-center gap-1.5">
                              <span className="truncate">{p.name}</span>
                              <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-200 shrink-0">
                                {p.projectCode}
                              </span>
                              {isCompleted ? (
                                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-300 shrink-0">
                                  已完工/封存
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                                  施工中
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                              {p.ownerName && <span>業主: {p.ownerName}</span>}
                            </div>
                          </div>
                          <span className="text-[10px] text-amber-700 opacity-0 group-hover:opacity-100 font-bold shrink-0 self-center">
                            帶入 ↵
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="p-2 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center gap-2">
                {activeRow.siteInputName.trim() && (
                  <button
                    type="button"
                    onClick={() => onQuickCreateAsset(rowId, activeRow.siteInputName)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="將此名稱直接登記為廠內資產（動產/不動產/庫存）"
                  >
                    <Truck className="w-3 h-3" />
                    <span>登記「{activeRow.siteInputName}」為廠內資產</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenQuickCreateProject(rowId, activeRow.siteInputName)}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>登記為工程案場 (PRJ)</span>
                </button>
              </div>
            </div>
          );
        })()}

      {/* 3. 物料品名下拉選單 */}
      {field === 'item' &&
        (() => {
          const query = activeRow.itemName.trim().toLowerCase();
          const vKey = activeRow.vendorInputName.trim().toLowerCase();

          const vendorHistoryItems: {
            itemName: string;
            count: number;
            latestPrice: number;
            latestUnit: string;
            specs: string[];
          }[] = [];

          if (vKey) {
            for (const [key, itemMap] of historicalMemory.vendorMap.entries()) {
              if (key === vKey || key.includes(vKey) || vKey.includes(key)) {
                for (const [, data] of itemMap.entries()) {
                  if (!query || data.itemName.toLowerCase().includes(query)) {
                    const sortedSpecs = Array.from(data.specs.entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(s => s[0]);

                    vendorHistoryItems.push({
                      itemName: data.itemName,
                      count: data.count,
                      latestPrice: data.latestPrice,
                      latestUnit: data.latestUnit,
                      specs: sortedSpecs
                    });
                  }
                }
                break;
              }
            }
          }

          vendorHistoryItems.sort((a, b) => b.count - a.count);

          const historyNames = new Set(vendorHistoryItems.map(h => h.itemName.toLowerCase()));
          const standardFiltered = items.filter(it => {
            if (historyNames.has(it.name.toLowerCase())) return false;
            if (!query) return true;
            return (
              (it.name && it.name.toLowerCase().includes(query)) ||
              (it.itemCode && it.itemCode.toLowerCase().includes(query)) ||
              (it.category && it.category.toLowerCase().includes(query))
            );
          });

          const detectedSpec = detectSpecInItemName(activeRow.itemName);
          const canonicalRule = findCanonicalRule(activeRow.itemName);
          const similarItems = findSimilarItems(activeRow.itemName, items);

          return (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    {activeRow.vendorInputName.trim()
                      ? `🏢【${activeRow.vendorInputName}】品項連動推薦`
                      : '⚡ 常用物料品名庫'}
                  </span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  共 {vendorHistoryItems.length + standardFiltered.length} 項
                </span>
              </div>

              {/* 防線 1: 規格混寫智慧自動拆分 */}
              {detectedSpec && (
                <div className="m-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 shadow-xs flex items-center justify-between gap-2 shrink-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                      <span>💡 規格混寫自動偵測</span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-tight">
                      品名包含規格！建議拆為：品名【<strong className="text-amber-950 font-bold">{detectedSpec.cleanedItemName}</strong>】+ 規格【
                      <strong className="text-amber-950 font-bold">{detectedSpec.extractedSpec}</strong>】
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onApplySpecDetachment(rowId, detectedSpec.cleanedItemName, detectedSpec.extractedSpec)
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-xs shrink-0 flex items-center gap-1 transition-colors"
                  >
                    <span>一鍵拆分回填</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* 防線 2: 公司標準品名同義詞歸一 */}
              {canonicalRule && activeRow.itemName.trim() !== canonicalRule.canonicalName && (
                <div className="mx-2 mb-2 p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 shadow-xs flex items-center justify-between gap-2 shrink-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>🏷️ 公司標準品名歸一推薦</span>
                    </div>
                    <p className="text-[11px] text-indigo-800 mt-0.5 leading-tight">
                      「{activeRow.itemName}」建議採用公司標準品名【
                      <strong className="text-indigo-950 font-bold">{canonicalRule.canonicalName}</strong>】
                    </p>
                    <span className="text-[10px] text-indigo-600 font-mono">（統一口徑，避免廠商對帳單被拆成多筆）</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onApplyCanonicalItem(rowId, canonicalRule)}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-xs shrink-0 flex items-center gap-1 transition-colors"
                  >
                    <span>採用標準名</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* 防線 3: 相似品名防打錯字分流 */}
              {similarItems.length > 0 && !standardFiltered.some(it => it.name.toLowerCase() === query) && (
                <div className="mx-2 mb-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 shadow-xs shrink-0">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-rose-800 mb-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>⚠️ 相似品名警示（防同音打錯字導致帳冊分歧）</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {similarItems.map(sim => (
                      <button
                        key={sim.id}
                        type="button"
                        onClick={() => onSelectItem(rowId, sim.name, sim.unit, sim.unitPrice)}
                        className="px-2 py-1 rounded bg-white hover:bg-rose-100 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="採用已有的標準料件"
                      >
                        <span>改選庫存已有：【{sim.name}】</span>
                        {sim.unit && <span className="text-[10px] text-slate-500 font-normal">({sim.unit})</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-y-auto flex-1 divide-y divide-slate-100 p-1">
                {vendorHistoryItems.length > 0 && (
                  <div className="pb-1 mb-1">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-amber-800 bg-amber-50/80 rounded flex items-center justify-between mb-1">
                      <span>⭐ 該廠商歷史進貨品項（優先推薦）</span>
                      <span>進過 {vendorHistoryItems.length} 種物料</span>
                    </div>
                    {vendorHistoryItems.map((vh, idx) => (
                      <div
                        key={`vh-${idx}`}
                        onClick={() => onSelectItem(rowId, vh.itemName, vh.latestUnit, vh.latestPrice, vh.specs[0])}
                        className="px-3 py-2 hover:bg-amber-50/80 rounded-lg cursor-pointer transition-colors group flex items-center justify-between gap-2 border border-transparent hover:border-amber-200 mb-0.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 group-hover:text-amber-900 flex items-center gap-1.5">
                            <span>{vh.itemName}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-normal">
                              進貨 {vh.count} 次
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                            {vh.latestUnit && (
                              <span>
                                單位: <strong className="text-slate-700">{vh.latestUnit}</strong>
                              </span>
                            )}
                            {vh.latestPrice > 0 && (
                              <span>
                                最新單價: <strong className="text-emerald-700 font-bold">${vh.latestPrice.toLocaleString()}</strong>
                              </span>
                            )}
                            {vh.specs.length > 0 && (
                              <span className="text-slate-400 truncate">常用規格: {vh.specs.slice(0, 3).join(', ')}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-amber-700 font-bold opacity-0 group-hover:opacity-100 shrink-0">
                          帶入 ↵
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  {vendorHistoryItems.length > 0 && (
                    <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 bg-slate-100/80 rounded mb-1">
                      📦 其他標準材料品項
                    </div>
                  )}
                  {standardFiltered.length === 0 && vendorHistoryItems.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      查無「{activeRow.itemName}」之物料，可直接在儲存格輸入新品名（存檔自動學習記住）
                    </div>
                  ) : (
                    standardFiltered.map(it => (
                      <div
                        key={it.id}
                        onClick={() => onSelectItem(rowId, it.name, it.unit, it.unitPrice)}
                        className="px-3 py-2 hover:bg-indigo-50/70 rounded-lg cursor-pointer transition-colors group flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">{it.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                            <span>單位: {it.unit || '式'}</span>
                            {it.unitPrice > 0 && <span>參考單價: ${it.unitPrice.toLocaleString()}</span>}
                            {it.category && <span>分類: {it.category}</span>}
                          </div>
                        </div>
                        <span className="text-[10px] text-indigo-600 opacity-0 group-hover:opacity-100 font-bold shrink-0">
                          帶入 ↵
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-2 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between text-[11px] text-slate-500">
                <span className="truncate">💡 自由輸入不卡關，存檔後自動記住推薦</span>
                <button
                  type="button"
                  onClick={() =>
                    onOpenQuickCreateItem(rowId, activeRow.itemName, activeRow.unit, activeRow.unitPrice)
                  }
                  className="py-1 px-2.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  <Package className="w-3 h-3" />
                  <span>登記至主物料庫</span>
                </button>
              </div>
            </div>
          );
        })()}

      {/* 4. 規格下拉選單 */}
      {field === 'spec' &&
        (() => {
          const currentItem = activeRow.itemName.trim();
          const currentVendor = activeRow.vendorInputName.trim().toLowerCase();
          const currentItemKey = currentItem.toLowerCase();
          const currentSpecQuery = activeRow.spec.trim().toLowerCase();

          const vendorSpecCounts: { spec: string; count: number }[] = [];
          if (currentVendor && currentItemKey) {
            for (const [vKey, itemMap] of historicalMemory.vendorMap.entries()) {
              if (vKey === currentVendor || vKey.includes(currentVendor) || currentVendor.includes(vKey)) {
                const itemData = itemMap.get(currentItemKey);
                if (itemData && itemData.specs) {
                  for (const [sp, c] of itemData.specs.entries()) {
                    if (!currentSpecQuery || sp.toLowerCase().includes(currentSpecQuery)) {
                      vendorSpecCounts.push({ spec: sp, count: c });
                    }
                  }
                }
                break;
              }
            }
          }
          vendorSpecCounts.sort((a, b) => b.count - a.count);

          const globalSpecCounts: { spec: string; count: number }[] = [];
          const vendorSpecSet = new Set(vendorSpecCounts.map(v => v.spec));
          if (currentItemKey && historicalMemory.globalItemSpecs.has(currentItemKey)) {
            for (const [sp, c] of historicalMemory.globalItemSpecs.get(currentItemKey)!.entries()) {
              if (!vendorSpecSet.has(sp) && (!currentSpecQuery || sp.toLowerCase().includes(currentSpecQuery))) {
                globalSpecCounts.push({ spec: sp, count: c });
              }
            }
          }
          globalSpecCounts.sort((a, b) => b.count - a.count);

          const industrySpecs = getIndustryCommonSpecs(currentItem).filter(sp => {
            if (vendorSpecSet.has(sp) || globalSpecCounts.some(g => g.spec === sp)) return false;
            if (!currentSpecQuery) return true;
            return sp.toLowerCase().includes(currentSpecQuery);
          });

          return (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>{currentItem ? `📐【${currentItem}】規格智慧推薦` : '📐 材料規格推薦 (請先輸入品名)'}</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">點選立即帶入</span>
              </div>

              {industrySpecs.length > 0 && (
                <div className="p-2 bg-blue-50/40 border-b border-blue-100 shrink-0">
                  <span className="text-[10px] text-blue-800 font-bold block mb-1">⚡ 常用工程規格一鍵填入：</span>
                  <div className="flex flex-wrap gap-1">
                    {industrySpecs.slice(0, 8).map((sp, idx) => (
                      <button
                        key={`ind-${idx}`}
                        type="button"
                        onClick={() => onSelectSpec(rowId, sp)}
                        className="px-2 py-0.5 rounded-full bg-white hover:bg-blue-600 hover:text-white border border-blue-200 text-blue-800 text-[10px] font-mono font-semibold transition-colors cursor-pointer shadow-2xs"
                      >
                        {sp}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-y-auto flex-1 divide-y divide-slate-100 p-1">
                {vendorSpecCounts.length > 0 && (
                  <div className="pb-1 mb-1">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-amber-800 bg-amber-50/80 rounded mb-1 flex items-center justify-between">
                      <span>⭐ 該廠商進貨歷史規格</span>
                      <span>{vendorSpecCounts.length} 種</span>
                    </div>
                    {vendorSpecCounts.map((vs, idx) => (
                      <div
                        key={`vs-${idx}`}
                        onClick={() => onSelectSpec(rowId, vs.spec)}
                        className="px-3 py-1.5 hover:bg-amber-50/80 rounded-lg cursor-pointer transition-colors group flex items-center justify-between gap-2 border border-transparent hover:border-amber-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-amber-900 font-mono">
                            {vs.spec}
                          </span>
                          <span className="text-[10px] font-mono text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                            使用 {vs.count} 次
                          </span>
                        </div>
                        <span className="text-[10px] text-amber-700 font-bold opacity-0 group-hover:opacity-100 shrink-0">
                          帶入 ↵
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {globalSpecCounts.length > 0 && (
                  <div className="pb-1 mb-1">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 bg-slate-100 rounded mb-1">
                      📋 全系統【{currentItem}】其他常見規格
                    </div>
                    {globalSpecCounts.map((gs, idx) => (
                      <div
                        key={`gs-${idx}`}
                        onClick={() => onSelectSpec(rowId, gs.spec)}
                        className="px-3 py-1.5 hover:bg-indigo-50/70 rounded-lg cursor-pointer transition-colors group flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 font-mono">{gs.spec}</span>
                          <span className="text-[10px] font-mono text-slate-400">歷史使用 {gs.count} 次</span>
                        </div>
                        <span className="text-[10px] text-indigo-600 font-bold opacity-0 group-hover:opacity-100 shrink-0">
                          帶入 ↵
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {vendorSpecCounts.length === 0 && globalSpecCounts.length === 0 && industrySpecs.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">
                    目前尚無規格記錄，請直接在儲存格內打字（如 #4, 15cm），存檔後系統將自動學習記住！
                  </div>
                )}
              </div>

              <div className="p-2 border-t border-slate-200 bg-slate-50 shrink-0 text-[10px] text-slate-500 flex items-center justify-between">
                <span>💡 支援任意手打規格，存檔即自動納入推薦</span>
                <span className="font-mono text-slate-400">Esc 關閉選單</span>
              </div>
            </div>
          );
        })()}
    </FloatingPortalPopover>
  );
};
