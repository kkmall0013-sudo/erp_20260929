// src/components/inbound/InboundQuickCreateModal.tsx
// ⚡ 極速打單試算表內就地快速建檔 Modal（新案場 PRJ / 新合作廠商 BP / 新物料品項 Item 3 合 1）

import React, { useState, useEffect } from 'react';
import { Building2, Sparkles, Package, X, Save } from 'lucide-react';
import { Project, BusinessPartner, Item } from '../../types/erp';
import {
  quickCreateProject,
  quickCreateVendor,
  quickCreateItem,
  previewNextDocumentNumber
} from '../../db/sqlite';
import { TaiwanAddressPicker, TaiwanAddressValue } from '../widgets/TaiwanAddressPicker';

const EMPTY_ADDRESS: TaiwanAddressValue = {
  postalCode: '',
  city: '',
  district: '',
  streetAddress: '',
  fullAddress: ''
};

export interface QuickCreateRequest {
  type: 'PROJECT' | 'VENDOR' | 'ITEM';
  rowId: string;
  initialName: string;
  initialUnit?: string;
  initialPrice?: number;
}

interface InboundQuickCreateModalProps {
  request: QuickCreateRequest | null;
  onClose: () => void;
  onProjectCreated: (rowId: string, project: Project) => void;
  onVendorCreated: (rowId: string, vendor: BusinessPartner) => void;
  onItemCreated: (rowId: string, item: Item) => void;
  triggerToast: (msg: string, type?: 'success' | 'warn' | 'error') => void;
}

export const InboundQuickCreateModal: React.FC<InboundQuickCreateModalProps> = ({
  request,
  onClose,
  onProjectCreated,
  onVendorCreated,
  onItemCreated,
  triggerToast
}) => {
  // 廠商建檔欄位
  const [vendorNameInput, setVendorNameInput] = useState<string>('');
  const [vendorTaxIdInput, setVendorTaxIdInput] = useState<string>('');
  const [vendorCategoryInput, setVendorCategoryInput] = useState<string>('現場材料建材');
  const [vendorContactInput, setVendorContactInput] = useState<string>('業務聯絡人');
  const [vendorPhoneInput, setVendorPhoneInput] = useState<string>('0912-345-678');
  const [vendorAddressInput, setVendorAddressInput] = useState<TaiwanAddressValue>(EMPTY_ADDRESS);

  // 案場建檔欄位
  const [projectNameInput, setProjectNameInput] = useState<string>('');
  const [projectSiteInput, setProjectSiteInput] = useState<string>('');
  const [projectOwnerInput, setProjectOwnerInput] = useState<string>('自建案場業主');
  const [projectOwnerTaxIdInput, setProjectOwnerTaxIdInput] = useState<string>('');
  const [projectAddressInput, setProjectAddressInput] = useState<TaiwanAddressValue>(EMPTY_ADDRESS);

  // 物料建檔欄位
  const [itemNameInput, setItemNameInput] = useState<string>('');
  const [itemUnitInput, setItemUnitInput] = useState<string>('包');
  const [itemPriceInput, setItemPriceInput] = useState<number>(0);
  const [itemCategoryInput, setItemCategoryInput] = useState<string>('土木建材');

  useEffect(() => {
    if (!request) return;
    if (request.type === 'VENDOR') {
      setVendorNameInput(request.initialName || '');
      setVendorTaxIdInput('');
      setVendorCategoryInput('現場材料建材');
      setVendorContactInput('業務聯絡人');
      setVendorPhoneInput('0912-345-678');
      setVendorAddressInput(EMPTY_ADDRESS);
    } else if (request.type === 'PROJECT') {
      setProjectNameInput(request.initialName ? `${request.initialName}新建工程` : '大城蕭OO新建工程');
      setProjectSiteInput(request.initialName || '大城蕭OO');
      setProjectOwnerInput('自建案場業主');
      setProjectOwnerTaxIdInput('');
      setProjectAddressInput(EMPTY_ADDRESS);
    } else if (request.type === 'ITEM') {
      setItemNameInput(request.initialName || '');
      setItemUnitInput(request.initialUnit || '包');
      setItemPriceInput(request.initialPrice || 0);
      setItemCategoryInput('土木建材');
    }
  }, [request]);

  if (!request) return null;

  const quickCreateType = request.type;

  const handleConfirm = () => {
    try {
      if (quickCreateType === 'PROJECT') {
        if (!projectNameInput.trim()) {
          triggerToast('請填寫案場名稱', 'warn');
          return;
        }
        const createdPrj = quickCreateProject(
          projectNameInput.trim(),
          projectSiteInput.trim() || projectNameInput.trim(),
          projectOwnerInput.trim() || '自建案場業主',
          'COMP-01',
          (projectAddressInput.fullAddress || '').trim(),
          projectOwnerTaxIdInput.trim(),
          projectAddressInput
        );
        onProjectCreated(request.rowId, createdPrj);
        triggerToast(
          `✅ 已在【工程案場模組】正式建檔！專案代碼：${createdPrj.projectCode}，未來案場模組直接連動共用！`,
          'success'
        );
      } else if (quickCreateType === 'VENDOR') {
        if (!vendorNameInput.trim()) {
          triggerToast('請填寫合作廠商全銜', 'warn');
          return;
        }
        const createdVen = quickCreateVendor(
          vendorNameInput.trim(),
          'COMP-01',
          vendorPhoneInput.trim(),
          vendorTaxIdInput.trim(),
          vendorContactInput.trim() || '業務窗口',
          (vendorAddressInput.fullAddress || '').trim(),
          vendorCategoryInput.trim(),
          vendorAddressInput
        );
        onVendorCreated(request.rowId, createdVen);
        triggerToast(
          `✅ 已在【合作廠商模組】正式建檔！廠商編號：${createdVen.bpCode}，清冊已同步更新！`,
          'success'
        );
      } else if (quickCreateType === 'ITEM') {
        if (!itemNameInput.trim()) {
          triggerToast('請填寫品名名稱', 'warn');
          return;
        }
        const createdItm = quickCreateItem(
          itemNameInput.trim(),
          itemUnitInput.trim() || '式',
          Number(itemPriceInput) || 0,
          itemCategoryInput.trim()
        );
        onItemCreated(request.rowId, createdItm);
        triggerToast(`✅ 已登錄新料件「${createdItm.name}」入物料主檔清冊！`, 'success');
      }
      onClose();
    } catch (e: any) {
      triggerToast('建立失敗: ' + e.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl p-6 space-y-4 animate-in fade-in duration-150 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2.5 rounded-xl ${
                quickCreateType === 'PROJECT'
                  ? 'bg-amber-50 text-amber-600'
                  : quickCreateType === 'VENDOR'
                  ? 'bg-purple-50 text-purple-600'
                  : 'bg-indigo-50 text-indigo-600'
              }`}
            >
              {quickCreateType === 'PROJECT' && <Building2 className="w-5 h-5" />}
              {quickCreateType === 'VENDOR' && <Sparkles className="w-5 h-5" />}
              {quickCreateType === 'ITEM' && <Package className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {quickCreateType === 'PROJECT' && '⚡ 登記新案場 (自動配發專案代碼)'}
                {quickCreateType === 'VENDOR' && '⚡ 登記新合作廠商 (同步寫入廠商主檔)'}
                {quickCreateType === 'ITEM' && '⚡ 登記新物料品項 (建立物料主庫)'}
              </h3>
              <p className="text-xs text-slate-500">
                {quickCreateType === 'PROJECT' && '依系統單據編碼規範自動配發 PRJ 前綴代碼，未來案場模組直接連動共用'}
                {quickCreateType === 'VENDOR' && '完整登記廠商統編、聯絡人與電話，正式建立【合作廠商清冊】檔案'}
                {quickCreateType === 'ITEM' && '將現場用料登記為標準品項，未來打單可自動推薦'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 新案場表單 */}
        {quickCreateType === 'PROJECT' && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                案場專案全名 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={projectNameInput}
                onChange={e => setProjectNameInput(e.target.value)}
                placeholder="如：大城蕭OO新建工程"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">個案用料 / 案場俗稱</label>
                <input
                  type="text"
                  value={projectSiteInput}
                  onChange={e => setProjectSiteInput(e.target.value)}
                  placeholder="如：大城蕭OO"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">起造人 / 業主姓名</label>
                <input
                  type="text"
                  value={projectOwnerInput}
                  onChange={e => setProjectOwnerInput(e.target.value)}
                  placeholder="如：蕭先生"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">業主統編 / 身分證號</label>
              <input
                type="text"
                value={projectOwnerTaxIdInput}
                onChange={e => setProjectOwnerTaxIdInput(e.target.value)}
                placeholder="選填統編或身分證"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl">
              <TaiwanAddressPicker
                compact
                showAutoParse={false}
                label="工地施工地址"
                value={projectAddressInput}
                onChange={setProjectAddressInput}
              />
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between">
              <div>
                📌 <strong>單據編碼中樞預估產號</strong>：
                <span className="font-mono font-bold ml-1 text-indigo-700">{previewNextDocumentNumber('PRJ')}</span>
              </div>
              <span className="text-[10px] text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">PRJ-YYYY-001 規範</span>
            </div>
          </div>
        )}

        {/* 新合作廠商表單 */}
        {quickCreateType === 'VENDOR' && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                合作廠商全銜 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={vendorNameInput}
                onChange={e => setVendorNameInput(e.target.value)}
                placeholder="如：東南預拌混凝土工廠 / 嘉新水泥"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">統一編號 (8 碼)</label>
                <input
                  type="text"
                  maxLength={8}
                  value={vendorTaxIdInput}
                  onChange={e => setVendorTaxIdInput(e.target.value)}
                  placeholder="如：88991234"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">材料/供料類別</label>
                <select
                  value={vendorCategoryInput}
                  onChange={e => setVendorCategoryInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="預拌混凝土">預拌混凝土</option>
                  <option value="鋼筋型鋼">鋼筋型鋼</option>
                  <option value="泥作建材">泥作建材</option>
                  <option value="水電五金">水電五金</option>
                  <option value="重機械租賃">重機械租賃</option>
                  <option value="現場材料建材">現場材料建材</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">業務 / 司機聯絡人</label>
                <input
                  type="text"
                  value={vendorContactInput}
                  onChange={e => setVendorContactInput(e.target.value)}
                  placeholder="如：王經理 / 李司機"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">聯絡電話 / 手機</label>
                <input
                  type="text"
                  value={vendorPhoneInput}
                  onChange={e => setVendorPhoneInput(e.target.value)}
                  placeholder="如：0912-345-678"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl">
              <TaiwanAddressPicker
                compact
                showAutoParse={false}
                label="公司通訊 / 出料廠址"
                value={vendorAddressInput}
                onChange={setVendorAddressInput}
              />
            </div>

            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900 text-[11px]">
              🏛️ <strong>正式入庫合作廠商清冊</strong>：點選後將正式寫入商業夥伴（Business Partners）模組，包含通訊錄與聯絡人資料，杜絕欄位短缺與資料遺漏。
            </div>
          </div>
        )}

        {/* 新料件表單 */}
        {quickCreateType === 'ITEM' && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                料件品名 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={itemNameInput}
                onChange={e => setItemNameInput(e.target.value)}
                placeholder="如：4000psi 預拌混凝土"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">單位</label>
                <input
                  type="text"
                  value={itemUnitInput}
                  onChange={e => setItemUnitInput(e.target.value)}
                  placeholder="如：包、立方米、支、式"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">預設單價</label>
                <input
                  type="number"
                  min="0"
                  value={itemPriceInput}
                  onChange={e => setItemPriceInput(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">物料類別</label>
              <select
                value={itemCategoryInput}
                onChange={e => setItemCategoryInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="土木建材">土木建材</option>
                <option value="預拌混凝土">預拌混凝土</option>
                <option value="鋼筋五金">鋼筋五金</option>
                <option value="水電材料">水電材料</option>
                <option value="租賃耗材">租賃耗材</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>立即建立並回填</span>
          </button>
        </div>
      </div>
    </div>
  );
};
