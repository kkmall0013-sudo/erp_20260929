// src/components/inbound/InboundReceiptEditorModal.tsx
// 📝 單筆進貨簽收單 新增 / 編輯 Modal (支援草稿儲存與正式簽收、在建/已完工案場分流與廠內資產三大分類)

import React, { useMemo, useRef } from 'react';
import {
  PackageCheck,
  Truck,
  Plus,
  CheckCircle2,
  Save,
  X,
  Upload,
} from 'lucide-react';
import {
  InboundReceipt,
  InboundReceiptItem,
  Project,
  BusinessPartner,
} from '../../types/erp';
import { InternalAsset, getAssetCategory } from '../../utils/internalAssetStore';

export interface InboundReceiptEditorModalProps {
  isOpen: boolean;
  formData: Partial<InboundReceipt>;
  onChangeFormData: React.Dispatch<React.SetStateAction<Partial<InboundReceipt>>>;
  formItems: Partial<InboundReceiptItem>[];
  projects: Project[];
  vendors: BusinessPartner[];
  internalAssets: InternalAsset[];
  showCompletedProjectsInForm: boolean;
  onToggleCompletedProjectsInForm: () => void;
  onItemChange: (index: number, field: keyof InboundReceiptItem, value: any) => void;
  onAddItemRow: () => void;
  onRemoveItemRow: (index: number) => void;
  onOpenNewProjectModal: () => void;
  onOpenAssetManager: () => void;
  onOpenNewVendorModal: () => void;
  onSaveReceipt: (asPosted: boolean) => void;
  onClose: () => void;
}

export const InboundReceiptEditorModal: React.FC<InboundReceiptEditorModalProps> = ({
  isOpen,
  formData,
  onChangeFormData,
  formItems,
  projects,
  vendors,
  internalAssets,
  showCompletedProjectsInForm,
  onToggleCompletedProjectsInForm,
  onItemChange,
  onAddItemRow,
  onRemoveItemRow,
  onOpenNewProjectModal,
  onOpenAssetManager,
  onOpenNewVendorModal,
  onSaveReceipt,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🏗️ 施工工程案場 (區隔「正在施工中」與「已完工/封存」案場，保持現場打單視圖乾淨)
  const activeProjects = useMemo(() => {
    return projects.filter(
      p => !p.isDeleted && (p.status === 'ACTIVE' || (!p.status && p.status !== 'COMPLETED' && p.status !== 'LOCKED'))
    );
  }, [projects]);

  const completedProjects = useMemo(() => {
    return projects.filter(p => !p.isDeleted && (p.status === 'COMPLETED' || p.status === 'LOCKED'));
  }, [projects]);

  // 🚚 廠內三大資產領域 (動產、不動產、庫存) 且排除歷史已淘汰退役者
  const activeInternalAssets = useMemo(() => {
    return internalAssets.filter(a => a.status !== 'RETIRED');
  }, [internalAssets]);

  const movableAssets = useMemo(() => {
    return activeInternalAssets.filter(a => getAssetCategory(a) === 'MOVABLE');
  }, [activeInternalAssets]);

  const realEstateAssets = useMemo(() => {
    return activeInternalAssets.filter(a => getAssetCategory(a) === 'REAL_ESTATE');
  }, [activeInternalAssets]);

  const inventoryAssets = useMemo(() => {
    return activeInternalAssets.filter(a => getAssetCategory(a) === 'INVENTORY');
  }, [activeInternalAssets]);

  // 若當前編輯的單據剛好屬於已淘汰資產或已完工案場，予以保留顯示以利審計歷史
  const retiredAssetInUse = useMemo(() => {
    if (!formData.projectId) return null;
    return internalAssets.find(a => a.id === formData.projectId && a.status === 'RETIRED') || null;
  }, [formData.projectId, internalAssets]);

  const completedProjectInUse = useMemo(() => {
    if (!formData.projectId) return null;
    return completedProjects.find(p => p.id === formData.projectId) || null;
  }, [formData.projectId, completedProjects]);

  const calculatedFormTotal = useMemo(() => {
    return formItems.reduce((acc, it) => acc + (Number(it.lineTotal) || 0), 0);
  }, [formItems]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-400/30">
              <PackageCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">
                {formData.id ? '編輯現場進貨簽收單' : '新增現場進貨簽收單'}
              </h3>
              <p className="text-xs text-slate-400">
                A 模式直入案場成本 · 可儲存為草稿隨時再改，或正式確認簽收
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-md cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表單內容 */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  歸屬工區案場 (直入成本) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onOpenNewProjectModal}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="調用案場工程小程式建立新工區，具備起造人分流與建物分類"
                  >
                    <Plus className="w-3 h-3" />
                    另建新案場
                  </button>
                  <span className="text-slate-300 text-xs">|</span>
                  <button
                    type="button"
                    onClick={onOpenAssetManager}
                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="廠內動產、不動產、備料庫存與歷史淘汰資產維護中心"
                  >
                    <Truck className="w-3 h-3" />
                    廠內資產維護
                  </button>
                </div>
              </div>
              <select
                value={formData.projectId || ''}
                onChange={e => {
                  const val = e.target.value;
                  const matchedAsset = internalAssets.find(a => a.id === val);
                  if (matchedAsset) {
                    onChangeFormData(prev => ({
                      ...prev,
                      projectId: val,
                      projectNameSnapshot: matchedAsset.name,
                      projectCodeSnapshot: matchedAsset.code,
                    } as any));
                  } else {
                    const prj = projects.find(p => p.id === val);
                    onChangeFormData(prev => ({
                      ...prev,
                      projectId: val,
                      projectNameSnapshot: prj?.name,
                      projectCodeSnapshot: prj?.projectCode,
                    } as any));
                  }
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="">請選擇專案案場或廠內資產</option>

                <optgroup label="🏗️ 施工工程案場 (正在施工中)">
                  {activeProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.projectCode})
                    </option>
                  ))}
                </optgroup>

                {(showCompletedProjectsInForm || completedProjectInUse) && completedProjects.length > 0 && (
                  <optgroup label="🏛️ 施工工程案場 (已完工/保固特許)">
                    {completedProjects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.projectCode}) [已完工封存]
                      </option>
                    ))}
                  </optgroup>
                )}

                {movableAssets.length > 0 && (
                  <optgroup label="🚗 廠內動產 (公務車輛 / 重型施工機具)">
                    {movableAssets.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.code})
                        {a.licensePlate ? ` [${a.licensePlate}]` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}

                {realEstateAssets.length > 0 && (
                  <optgroup label="🏢 廠內不動產 (廠房建物 / 固定設施 / 天車水電)">
                    {realEstateAssets.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.code})
                      </option>
                    ))}
                  </optgroup>
                )}

                {inventoryAssets.length > 0 && (
                  <optgroup label="📦 廠內庫存 (公共備料 / 型鋼材料進庫登記)">
                    {inventoryAssets.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.code})
                      </option>
                    ))}
                  </optgroup>
                )}

                {retiredAssetInUse && (
                  <optgroup label="🏛️ 歷史淘汰資產 (已退役/僅供舊單歷史審計)">
                    <option value={retiredAssetInUse.id}>
                      {retiredAssetInUse.name} ({retiredAssetInUse.code}) [已汰除/歷史保留]
                    </option>
                  </optgroup>
                )}
              </select>
              <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                <span>
                  在建施工案場 {activeProjects.length} 個 · 廠內資產 {activeInternalAssets.length} 項
                </span>
                {completedProjects.length > 0 && (
                  <button
                    type="button"
                    onClick={onToggleCompletedProjectsInForm}
                    className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                  >
                    {showCompletedProjectsInForm
                      ? '隱藏已完工案場'
                      : `顯示已完工案場 (${completedProjects.length}) (保固特許)`}
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  合作供貨廠商 <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={onOpenNewVendorModal}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                  title="調用聯絡明細規格之商業夥伴小程式直接建檔，保持資料庫乾淨"
                >
                  <Plus className="w-3 h-3" />
                  另建新供料商
                </button>
              </div>
              <select
                value={formData.vendorId || ''}
                onChange={e => onChangeFormData(prev => ({ ...prev, vendorId: e.target.value }))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="">請選擇供應商</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.taxId ? `(${v.taxId})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                廠商紙本送貨單號 / 簽收單號 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="例如: TC-889922、CSC-003"
                value={formData.deliveryNoteNumber || ''}
                onChange={e => onChangeFormData(prev => ({ ...prev, deliveryNoteNumber: e.target.value }))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                訂貨單號 / 採購單號 <span className="text-slate-400 font-normal">(選填，不強制)</span>
              </label>
              <input
                type="text"
                placeholder="例如: PO-2026-001 (無可留空)"
                value={formData.orderNumber || ''}
                onChange={e => onChangeFormData(prev => ({ ...prev, orderNumber: e.target.value }))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                現場簽收日期 <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.receivedDate || ''}
                onChange={e => onChangeFormData(prev => ({ ...prev, receivedDate: e.target.value }))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                現場點收人 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="點收同仁姓名"
                value={formData.receivedBy || ''}
                onChange={e => onChangeFormData(prev => ({ ...prev, receivedBy: e.target.value }))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                簽收單紙本照片/附件 (選填)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="紙本照片或檔案名稱"
                  value={formData.attachmentFileName || ''}
                  onChange={e => onChangeFormData(prev => ({ ...prev, attachmentFileName: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onChangeFormData(prev => ({ ...prev, attachmentFileName: file.name }));
                    }
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>拍照/選取</span>
                </button>
              </div>
            </div>
          </div>

          {/* 物料明細分欄表格 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">物料進貨明細清單</span>
                <span className="text-xs text-slate-400">
                  (共 {formItems.length} 項 · 合計未稅 NT${calculatedFormTotal.toLocaleString()})
                </span>
              </div>

              <button
                type="button"
                onClick={onAddItemRow}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>增加一列材料</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[160px]">
                      材料品名 <span className="text-rose-500">*</span>
                    </th>
                    <th className="py-2.5 px-3 min-w-[120px]">規格型號</th>
                    <th className="py-2.5 px-3 w-20 text-center">單位</th>
                    <th className="py-2.5 px-3 w-24 text-right">進貨數量</th>
                    <th className="py-2.5 px-3 w-28 text-right">約定單價</th>
                    <th className="py-2.5 px-3 w-28 text-right">小計金額</th>
                    <th className="py-2.5 px-3 min-w-[100px]">備註</th>
                    <th className="py-2.5 px-3 w-10 text-center">刪</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formItems.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono">
                        {index + 1}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          placeholder="如: 4000psi 預拌混凝土"
                          value={item.itemName || ''}
                          onChange={e => onItemChange(index, 'itemName', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-900"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          placeholder="規格/型號"
                          value={item.spec || ''}
                          onChange={e => onItemChange(index, 'spec', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          placeholder="包/m³/噸"
                          value={item.unit || '式'}
                          onChange={e => onItemChange(index, 'unit', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.quantity || 0}
                          onChange={e => onItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right font-mono font-bold"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.unitPrice || 0}
                          onChange={e => onItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right font-mono"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700 tabular-nums">
                        ${(Number(item.lineTotal) || 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          placeholder="車號/備忘"
                          value={item.notes || ''}
                          onChange={e => onItemChange(index, 'notes', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onRemoveItemRow(index)}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/80 font-bold border-t border-slate-200">
                    <td colSpan={6} className="py-2.5 px-3 text-right text-slate-700">
                      進貨未稅金額總計 (NT$)：
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-indigo-700 text-sm tabular-nums">
                      ${calculatedFormTotal.toLocaleString()}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              現場簽收備註 / 驗收紀錄
            </label>
            <textarea
              rows={2}
              placeholder="可記錄卸料地點、抗壓試驗棒取樣、出廠檢驗報告編號等現場備忘..."
              value={formData.notes || ''}
              onChange={e => onChangeFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Modal 底部按鈕 */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            可儲存為草稿隨時再改，或確認簽收歸檔供會計核對
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              取消
            </button>

            {/* 儲存草稿按鈕 (草稿功能) */}
            <button
              type="button"
              onClick={() => onSaveReceipt(false)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              title="儲存為草稿，隨時可回來修改"
            >
              <Save className="w-3.5 h-3.5" />
              <span>💾 儲存為草稿</span>
            </button>

            {/* 正式點收簽收按鈕 */}
            <button
              type="button"
              onClick={() => onSaveReceipt(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="現場點收無誤，正式簽收歸檔"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>✅ 儲存並確認簽收</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
