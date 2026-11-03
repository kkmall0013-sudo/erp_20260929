import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Plus,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  FolderPlus,
  Save,
  CheckCircle2,
  ChevronRight,
  Building2,
  Phone,
  User,
  Tag,
  Search,
  ExternalLink
} from 'lucide-react';
import { SubcontractorCategoryGroup, SubcontractorVendorItem, BusinessPartner } from '../../types/erp';
import {
  getSubcontractorCategoryTree,
  saveSubcontractorCategoryTree,
  DEFAULT_SUBCONTRACTOR_CATEGORY_TREE,
  assignVendorToCategory,
  removeVendorFromCategory,
  updateVendorCategorySub,
  renameSubcontractorCategory,
  getAllBusinessPartners
} from '../../db/sqlite';

interface SubcontractorCategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  currentUser?: any;
}

export const SubcontractorCategoryManagerModal: React.FC<SubcontractorCategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  currentUser
}) => {
  const [tree, setTree] = useState<SubcontractorCategoryGroup[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [allVendors, setAllVendors] = useState<BusinessPartner[]>([]);

  // 編輯工料大類狀態
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // 指派已建檔廠商至此分類狀態
  const [isAssigningVendor, setIsAssigningVendor] = useState(false);
  const [assignTargetBpId, setAssignTargetBpId] = useState('');
  const [assignCategorySub, setAssignCategorySub] = useState('');
  const [assignSearchTerm, setAssignSearchTerm] = useState('');

  // 編輯細部料件/工項備註狀態 (categorySub)
  const [editingSubVendorId, setEditingSubVendorId] = useState<string | null>(null);
  const [editingSubValue, setEditingSubValue] = useState('');

  // 提示訊息
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 安全確認彈窗 (100% 杜絕 iframe 攔截 window.confirm)
  const [confirmTarget, setConfirmTarget] = useState<{
    title: string;
    message: string;
    isDanger?: boolean;
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);

  const refreshData = () => {
    const currentTree = getSubcontractorCategoryTree();
    setTree(currentTree);
    const partners = getAllBusinessPartners().filter(p => Boolean(p.isVendor) && !p.isDeleted);
    setAllVendors(partners);

    if (currentTree.length > 0) {
      if (!selectedCatId || !currentTree.some(c => c.id === selectedCatId)) {
        setSelectedCatId(currentTree[0].id);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedCategory = tree.find(c => c.id === selectedCatId) || tree[0];

  const triggerMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // 1. 新增第一階工料大類
  const handleAddCategory = () => {
    if (!newCatName.trim()) {
      triggerMessage('請輸入工料大類名稱', 'error');
      return;
    }
    const clean = newCatName.trim();
    if (tree.some(c => c.category === clean)) {
      triggerMessage(`工料類別【${clean}】已存在`, 'error');
      return;
    }
    const newGroup: SubcontractorCategoryGroup = {
      id: `CAT-${Date.now().toString().slice(-6)}`,
      category: clean,
      vendors: []
    };
    const updated = [...tree, newGroup];
    saveSubcontractorCategoryTree(updated, currentUser?.fullName || '管理員');
    setTree(updated);
    setSelectedCatId(newGroup.id);
    setNewCatName('');
    setIsAddingCat(false);
    triggerMessage(`已新增工料大類【${clean}】`);
  };

  // 2. 重新命名工料大類 (同步更新已建檔廠商)
  const handleSaveCategoryEdit = (catId: string) => {
    if (!editingCatName.trim()) return;
    const clean = editingCatName.trim();
    const oldCat = tree.find(c => c.id === catId);
    if (!oldCat) return;

    if (oldCat.category === clean) {
      setEditingCatId(null);
      return;
    }

    if (tree.some(c => c.id !== catId && c.category === clean)) {
      triggerMessage(`工料類別【${clean}】已存在`, 'error');
      return;
    }

    renameSubcontractorCategory(oldCat.category, clean, currentUser?.fullName || '管理員');
    refreshData();
    setEditingCatId(null);
    setEditingCatName('');
    triggerMessage(`工料類別已修改為【${clean}】，關聯廠商同步更新`);
  };

  // 3. 刪除大類 (無論有無歸屬廠商，一律強制二次確認彈窗，徹底防範手滑誤刪)
  const handleDeleteCategory = (catId: string) => {
    const target = tree.find(c => c.id === catId);
    if (!target) return;
    if (tree.length <= 1) {
      triggerMessage('系統至少需保留一個工料分類，禁止全部刪除', 'error');
      return;
    }

    const hasVendors = target.vendors.length > 0;
    const message = hasVendors
      ? `確定要刪除工料大類【${target.category}】嗎？\n\n⚠️ 重要警示：此分類底下目前有 ${target.vendors.length} 家已建檔合作廠商。執行刪除後，這些廠商將轉為「未分類」狀態（廠商資料本身不會被刪除）。`
      : `確定要刪除工料大類【${target.category}】嗎？\n\n刪除後此大類將自工料字典中移除。`;

    setConfirmTarget({
      title: '確認刪除工料大類',
      message,
      isDanger: true,
      confirmText: '確定刪除大類',
      onConfirm: () => {
        if (hasVendors) {
          // 將該分類底下的廠商移除該標籤（保留其他標籤）
          for (const v of target.vendors) {
            removeVendorFromCategory(v.id, target.category);
          }
        }
        const updated = tree.filter(c => c.id !== catId);
        saveSubcontractorCategoryTree(updated, currentUser?.fullName || '管理員');
        refreshData();
        if (selectedCatId === catId) {
          setSelectedCatId(updated[0]?.id || '');
        }
        triggerMessage(`已成功刪除工料分類【${target.category}】`);
        setConfirmTarget(null);
      }
    });
  };

  // 4. 指派已建檔廠商至此分類
  const handleConfirmAssignVendor = () => {
    if (!selectedCategory) return;
    if (!assignTargetBpId) {
      triggerMessage('請先從名冊中選取要指派的合作廠商', 'error');
      return;
    }

    const targetPartner = allVendors.find(p => p.id === assignTargetBpId);
    if (!targetPartner) {
      triggerMessage('找不到選定的廠商資料', 'error');
      return;
    }

    assignVendorToCategory(targetPartner.id, selectedCategory.category, assignCategorySub.trim());
    refreshData();
    setIsAssigningVendor(false);
    setAssignTargetBpId('');
    setAssignCategorySub('');
    setAssignSearchTerm('');
    triggerMessage(`✓ 已將【${targetPartner.name}】指派歸類於【${selectedCategory.category}】`);
  };

  // 5. 快速儲存廠商叫料備註 (categorySub)
  const handleSaveVendorSub = (vendorId: string) => {
    updateVendorCategorySub(vendorId, editingSubValue);
    refreshData();
    setEditingSubVendorId(null);
    setEditingSubValue('');
    triggerMessage('已更新叫料項目備註');
  };

  // 6. 將廠商移出此分類 (取消分類指派，絕不刪除廠商)
  const handleRemoveVendor = (vendor: SubcontractorVendorItem) => {
    if (!selectedCategory) return;
    const otherTags = (vendor.categoryTags || []).filter(t => t !== selectedCategory.category);
    const message = otherTags.length > 0
      ? `確定要將【${vendor.name}】自【${selectedCategory.category}】標籤移出嗎？\n\n💡 提示：該廠商仍保留「${otherTags.join('、')}」等分類標籤，且廠商通訊資料完整保留。`
      : `確定要將【${vendor.name}】自【${selectedCategory.category}】分類標籤中移出嗎？\n\n移出後該廠商轉為無此分類標籤，廠商主檔資料完整保留。`;

    setConfirmTarget({
      title: '確認移出分類標籤',
      message,
      onConfirm: () => {
        removeVendorFromCategory(vendor.id, selectedCategory.category);
        refreshData();
        triggerMessage(`已將【${vendor.name}】自【${selectedCategory.category}】移出`);
        setConfirmTarget(null);
      }
    });
  };

  // 7. 恢復預設分類範本
  const handleResetDefault = () => {
    setConfirmTarget({
      title: '恢復標準工料大類範本',
      message: '確定要將工料分類重設為標準範本嗎？（包含鋼材、屋頂浪板、螺絲五金、混凝土、拆圖、鋼構吊裝、門窗五金、機電消防等常用大類，不會刪除任何廠商）',
      onConfirm: () => {
        saveSubcontractorCategoryTree(DEFAULT_SUBCONTRACTOR_CATEGORY_TREE, currentUser?.fullName || '管理員');
        refreshData();
        setSelectedCatId(DEFAULT_SUBCONTRACTOR_CATEGORY_TREE[0].id);
        triggerMessage('已重設為標準工料大類範本');
        setConfirmTarget(null);
      }
    });
  };

  // 尚未指派至本類別的建檔廠商 (可供指派選單)
  const assignableVendors = allVendors.filter(p => {
    const isAlreadyInThisCat = selectedCategory?.vendors.some(v => v.id === p.id);
    if (isAlreadyInThisCat) return false;
    if (!assignSearchTerm.trim()) return true;
    const term = assignSearchTerm.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.bpCode && p.bpCode.toLowerCase().includes(term)) ||
      (p.contactPerson && p.contactPerson.toLowerCase().includes(term))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">
                  合作廠商工料分類字典與叫料歸類
                </h2>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  實名建檔綁定
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                左側維護工料大類 ➔ 右側管理該類別下「已建檔合作廠商」與叫料項目（如 H 型鋼、自攻螺絲），杜絕虛假公司
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 提示訊息 */}
        {statusMessage && (
          <div className={`mx-6 mt-3 px-4 py-2 rounded-lg text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* 雙欄主體 */}
        <div className="flex-1 overflow-hidden p-6 grid grid-cols-1 md:grid-cols-12 gap-5 text-xs">
          {/* 左欄：第一階 工料大類 (佔 4 欄) */}
          <div className="md:col-span-4 border border-slate-200 rounded-xl flex flex-col bg-slate-50/50 overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-slate-100/70 flex items-center justify-between">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-amber-600" />
                <span>工料大類</span>
              </span>
              <button
                type="button"
                onClick={() => setIsAddingCat(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 bg-white border border-amber-300 px-2 py-0.5 rounded-md hover:bg-amber-50 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>新增大類</span>
              </button>
            </div>

            {/* 新增大類輸入框 */}
            {isAddingCat && (
              <div className="p-2.5 bg-amber-50/80 border-b border-amber-200 flex items-center gap-1.5 animate-in fade-in">
                <input
                  type="text"
                  autoFocus
                  placeholder="類別名稱 (如: 鋼材、屋頂浪板)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCategory();
                    if (e.key === 'Escape') setIsAddingCat(false);
                  }}
                  className="flex-1 px-2.5 py-1.5 bg-white border border-amber-300 rounded text-xs outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="p-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 cursor-pointer"
                  title="確認新增"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingCat(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                  title="取消"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 大類清單 */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1.5 space-y-1">
              {tree.map(cat => {
                const isSelected = cat.id === selectedCatId;
                const isEditingThis = editingCatId === cat.id;

                if (isEditingThis) {
                  return (
                    <div key={cat.id} className="p-2 bg-amber-50/80 rounded-lg flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={editingCatName}
                        onChange={(e) => setEditingCatName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveCategoryEdit(cat.id);
                          if (e.key === 'Escape') setEditingCatId(null);
                        }}
                        className="flex-1 px-2 py-1 bg-white border border-amber-300 rounded text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveCategoryEdit(cat.id)}
                        className="p-1 bg-amber-600 text-white rounded hover:bg-amber-700 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCatId(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setSelectedCatId(cat.id);
                      setIsAssigningVendor(false);
                    }}
                    className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-600 text-white font-bold shadow-xs'
                        : 'hover:bg-slate-200/60 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{cat.category}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                        isSelected ? 'bg-amber-700 text-amber-100' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {cat.vendors.length} 家
                      </span>

                      {/* 快速改名圖示 (保留改名，移除懸浮誤觸的刪除鍵) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCatId(cat.id);
                          setEditingCatName(cat.category);
                        }}
                        className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10 cursor-pointer ${isSelected ? 'text-white' : 'text-slate-400 hover:text-slate-700'}`}
                        title="重新命名此大類"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右欄：已建檔合作廠商名冊 (佔 8 欄) */}
          <div className="md:col-span-8 border border-slate-200 rounded-xl flex flex-col bg-white overflow-hidden shadow-2xs">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-700" />
                  <span className="font-bold text-slate-800 text-sm">
                    【{selectedCategory?.category || '未選'}】已建檔合作廠商清單
                  </span>
                  <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono font-bold">
                    共 {selectedCategory?.vendors.length || 0} 家
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  僅呈現系統「聯絡明細」已建檔之真實合作廠商，支援註記細部叫料項目（如 H 型鋼、C 型鋼）
                </p>
              </div>

              {/* 類別操作工具列 (明確獨立按鈕，徹底杜絕左側列表手滑誤觸) */}
              <div className="flex items-center gap-2">
                {selectedCategory && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatId(selectedCategory.id);
                        setEditingCatName(selectedCategory.category);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 px-2.5 py-1 rounded-lg hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
                      title="修改此大類名稱"
                    >
                      <Edit2 className="w-3 h-3 text-slate-500" />
                      <span>改名</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(selectedCategory.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg hover:bg-rose-100 shadow-2xs transition-colors cursor-pointer"
                      title="刪除此大類 (彈窗二次確認)"
                    >
                      <Trash2 className="w-3 h-3 text-rose-600" />
                      <span>刪除此大類</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsAssigningVendor(!isAssigningVendor);
                    setAssignTargetBpId('');
                    setAssignCategorySub('');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-lg hover:bg-amber-100 shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>指派已建檔廠商</span>
                </button>
              </div>
            </div>

            {/* 指派已建檔廠商區塊 */}
            {isAssigningVendor && (
              <div className="p-3 bg-amber-50/70 border-b border-amber-200 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-700" />
                    <span>將已建檔之合作廠商歸入【{selectedCategory?.category}】</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAssigningVendor(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {/* 選取廠商 */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      選擇合作廠商 (僅列出未在此分類者)
                    </label>
                    <select
                      value={assignTargetBpId}
                      onChange={(e) => {
                        setAssignTargetBpId(e.target.value);
                        const p = allVendors.find(v => v.id === e.target.value);
                        if (p && (p.categorySub || p.serviceCategorySub)) {
                          setAssignCategorySub(p.categorySub || p.serviceCategorySub || '');
                        }
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="">-- 請選取合作廠商 --</option>
                      {assignableVendors.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.bpCode ? `[${p.bpCode}] ` : ''}{p.name} {p.categoryMain ? `(現歸類: ${p.categoryMain})` : '(尚未分類)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 叫料項目/備註 */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      叫料料件／供料規格備註 (供叫貨快速檢索)
                    </label>
                    <input
                      type="text"
                      placeholder="如: 專供 H 型鋼、C 型鋼裁切加工、自攻螺絲"
                      value={assignCategorySub}
                      onChange={(e) => setAssignCategorySub(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAssigningVendor(false)}
                    className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAssignVendor}
                    disabled={!assignTargetBpId}
                    className="px-3.5 py-1 bg-amber-600 text-white font-bold rounded hover:bg-amber-700 disabled:opacity-40 cursor-pointer shadow-xs"
                  >
                    確認指派加入
                  </button>
                </div>
              </div>
            )}

            {/* 廠商列表主體 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {(!selectedCategory || selectedCategory.vendors.length === 0) ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-slate-600">
                    目前尚未有建檔廠商歸類於【{selectedCategory?.category}】
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                    您可以點擊上方「+ 指派已建檔廠商至此分類」直接將您的合作廠商加入，或至「聯絡明細」名冊中進行分類設定。
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAssigningVendor(true)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg font-bold text-xs hover:bg-amber-700 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>立即指派廠商</span>
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 w-1/3">廠商編號 / 公司名稱</th>
                        <th className="py-2.5 px-3 w-1/4">聯絡窗口 & 電話</th>
                        <th className="py-2.5 px-3">叫料項目／供應規格備註</th>
                        <th className="py-2.5 px-3 text-right w-24">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {selectedCategory.vendors.map((v) => {
                        const isEditingThisSub = editingSubVendorId === v.id;

                        return (
                          <tr key={v.id} className="hover:bg-slate-50/80 transition-colors group">
                            {/* 公司名稱 */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                <div>
                                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <span>{v.name}</span>
                                    {v.bpCode && (
                                      <span className="text-[10px] text-slate-400 font-mono font-normal">
                                        ({v.bpCode})
                                      </span>
                                    )}
                                  </div>
                                  {v.categoryTags && v.categoryTags.length > 1 && (
                                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                      <span className="text-[10px] text-slate-400">同時經營:</span>
                                      {v.categoryTags.filter(t => t !== selectedCategory.category).map(t => (
                                        <span key={t} className="text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded border border-slate-200">
                                          🏷️ {t}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* 窗口與電話 */}
                            <td className="py-2.5 px-3 text-slate-600">
                              <div className="space-y-0.5">
                                {v.contactPerson && (
                                  <div className="flex items-center gap-1 text-[11px]">
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span>{v.contactPerson}</span>
                                  </div>
                                )}
                                {v.phone ? (
                                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    <span>{v.phone}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-[10px]">未填電話</span>
                                )}
                              </div>
                            </td>

                            {/* 叫料料件備註 */}
                            <td className="py-2.5 px-3">
                              {isEditingThisSub ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="如: 專供 H 型鋼、C 型鋼"
                                    value={editingSubValue}
                                    onChange={(e) => setEditingSubValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveVendorSub(v.id);
                                      if (e.key === 'Escape') setEditingSubVendorId(null);
                                    }}
                                    className="flex-1 px-2 py-1 bg-white border border-amber-400 rounded text-xs outline-none focus:ring-1 focus:ring-amber-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveVendorSub(v.id)}
                                    className="p-1 bg-amber-600 text-white rounded hover:bg-amber-700 cursor-pointer"
                                    title="儲存備註"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingSubVendorId(null)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                                    title="取消"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onClick={() => {
                                    setEditingSubVendorId(v.id);
                                    setEditingSubValue(v.categorySub || '');
                                  }}
                                  className="flex items-center justify-between cursor-pointer group/sub hover:bg-amber-50/50 p-1 rounded transition-colors"
                                  title="點擊可直接修改叫料備註"
                                >
                                  {v.categorySub ? (
                                    <span className="text-amber-900 font-medium">
                                      {v.categorySub}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px] flex items-center gap-1">
                                      <Plus className="w-3 h-3" />
                                      <span>點擊填寫叫料料件備註 (如: 專供 H 型鋼)</span>
                                    </span>
                                  )}
                                  <Edit2 className="w-3 h-3 text-slate-300 group-hover/sub:text-amber-600 shrink-0 ml-1 opacity-0 group-hover/sub:opacity-100" />
                                </div>
                              )}
                            </td>

                            {/* 操作欄 */}
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveVendor(v)}
                                className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded transition-colors cursor-pointer"
                                title="自此大類移出此標籤 (不會刪除廠商資料)"
                              >
                                <Tag className="w-3 h-3 text-amber-600" />
                                <span>移除此標籤</span>
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
          </div>
        </div>

        {/* 底部按鈕 */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="重設大類為標準系統範本"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>恢復標準工料大類範本</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (onSaved) onSaved();
                onClose();
              }}
              className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 transition-colors shadow-xs cursor-pointer"
            >
              完成並關閉
            </button>
          </div>
        </div>
      </div>

      {/* 🛡️ 內嵌式確認對話框 (100% 杜絕 iframe 攔截 window.confirm，強制阻斷未經確認之刪除) */}
      {confirmTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                confirmTarget.isDanger
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {confirmTarget.isDanger ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-bold ${
                  confirmTarget.isDanger ? 'text-rose-950' : 'text-slate-900'
                }`}>
                  {confirmTarget.title}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                  {confirmTarget.message}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
              >
                取消（保留）
              </button>
              <button
                type="button"
                onClick={confirmTarget.onConfirm}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs cursor-pointer transition-colors ${
                  confirmTarget.isDanger
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {confirmTarget.confirmText || '確定執行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
