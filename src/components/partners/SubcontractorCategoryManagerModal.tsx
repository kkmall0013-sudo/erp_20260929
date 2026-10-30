import React, { useState } from 'react';
import {
  X,
  Layers,
  Plus,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  AlertCircle,
  FolderPlus,
  Save,
  CheckCircle2,
  ChevronRight,
  Building2,
  ShieldAlert
} from 'lucide-react';
import { SubcontractorCategoryGroup, SubcontractorVendorItem } from '../../types/erp';
import {
  getSubcontractorCategoryTree,
  saveSubcontractorCategoryTree,
  DEFAULT_SUBCONTRACTOR_CATEGORY_TREE
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
  const [tree, setTree] = useState<SubcontractorCategoryGroup[]>(() => getSubcontractorCategoryTree());
  const [selectedCatId, setSelectedCatId] = useState<string>(() => {
    const initialTree = getSubcontractorCategoryTree();
    return initialTree.length > 0 ? initialTree[0].id : '';
  });

  // 編輯大項狀態
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // 編輯細項 (公司/工項) 狀態
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [editingVendorName, setEditingVendorName] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [isAddingVendor, setIsAddingVendor] = useState(false);

  // 提示訊息
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    setTree(updated);
    setSelectedCatId(newGroup.id);
    setNewCatName('');
    setIsAddingCat(false);
    triggerMessage(`已新增工料大類【${clean}】`);
  };

  // 2. 儲存大類修改
  const handleSaveCategoryEdit = (catId: string) => {
    if (!editingCatName.trim()) return;
    const clean = editingCatName.trim();
    const updated = tree.map(c => c.id === catId ? { ...c, category: clean } : c);
    setTree(updated);
    setEditingCatId(null);
    setEditingCatName('');
    triggerMessage('工料類別名稱已修改');
  };

  // 3. 刪除大類
  const handleDeleteCategory = (catId: string) => {
    const target = tree.find(c => c.id === catId);
    if (!target) return;
    if (tree.length <= 1) {
      triggerMessage('系統至少需保留一個工料分類', 'error');
      return;
    }
    if (target.vendors.length > 0) {
      if (!window.confirm(`類別【${target.category}】底下尚有 ${target.vendors.length} 筆廠商或專業項目，確定要連同清單一併刪除嗎？`)) {
        return;
      }
    }
    const updated = tree.filter(c => c.id !== catId);
    setTree(updated);
    if (selectedCatId === catId) {
      setSelectedCatId(updated[0].id);
    }
    triggerMessage(`已刪除工料分類【${target.category}】`);
  };

  // 4. 新增第二階細項 (專業項目 / 廠商公司)
  const handleAddVendor = () => {
    if (!selectedCategory) return;
    if (!newVendorName.trim()) {
      triggerMessage('請輸入專業工項或廠商名稱', 'error');
      return;
    }
    const clean = newVendorName.trim();
    if (selectedCategory.vendors.some(v => v.name === clean)) {
      triggerMessage(`該類別下已存在【${clean}】`, 'error');
      return;
    }
    const newVendor: SubcontractorVendorItem = {
      id: `V-${Date.now().toString().slice(-6)}`,
      name: clean,
      isActive: true
    };
    const updated = tree.map(c => {
      if (c.id === selectedCategory.id) {
        return { ...c, vendors: [...c.vendors, newVendor] };
      }
      return c;
    });
    setTree(updated);
    setNewVendorName('');
    setIsAddingVendor(false);
    triggerMessage(`已於【${selectedCategory.category}】新增【${clean}】`);
  };

  // 5. 儲存第二階細項修改
  const handleSaveVendorEdit = (vendorId: string) => {
    if (!selectedCategory || !editingVendorName.trim()) return;
    const clean = editingVendorName.trim();
    const updated = tree.map(c => {
      if (c.id === selectedCategory.id) {
        return {
          ...c,
          vendors: c.vendors.map(v => v.id === vendorId ? { ...v, name: clean } : v)
        };
      }
      return c;
    });
    setTree(updated);
    setEditingVendorId(null);
    setEditingVendorName('');
    triggerMessage('廠商／專業名稱已修改');
  };

  // 6. 切換啟用 / 停用
  const handleToggleVendorActive = (vendorId: string) => {
    if (!selectedCategory) return;
    const updated = tree.map(c => {
      if (c.id === selectedCategory.id) {
        return {
          ...c,
          vendors: c.vendors.map(v => v.id === vendorId ? { ...v, isActive: !(v.isActive ?? true) } : v)
        };
      }
      return c;
    });
    setTree(updated);
  };

  // 7. 刪除細項
  const handleDeleteVendor = (vendorId: string) => {
    if (!selectedCategory) return;
    const target = selectedCategory.vendors.find(v => v.id === vendorId);
    if (!target) return;
    if (!window.confirm(`確定要刪除【${target.name}】嗎？`)) {
      return;
    }
    const updated = tree.map(c => {
      if (c.id === selectedCategory.id) {
        return { ...c, vendors: c.vendors.filter(v => v.id !== vendorId) };
      }
      return c;
    });
    setTree(updated);
    triggerMessage(`已刪除【${target.name}】`);
  };

  // 8. 恢復預設字典
  const handleResetDefault = () => {
    if (!window.confirm('確定要將工料專業分類字典重設為標準預設範本嗎？（鋼材、混凝土、拆圖、屋頂浪板、鋼構吊裝、門窗五金、機電消防等）')) {
      return;
    }
    setTree(DEFAULT_SUBCONTRACTOR_CATEGORY_TREE);
    setSelectedCatId(DEFAULT_SUBCONTRACTOR_CATEGORY_TREE[0].id);
    triggerMessage('已重設為標準工料專業分類');
  };

  // 9. 儲存所有變更
  const handleSaveAll = () => {
    try {
      saveSubcontractorCategoryTree(tree, currentUser?.fullName || '管理員');
      triggerMessage('✓ 廠商二階專業工料字典已成功保存！');
      if (onSaved) onSaved();
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: any) {
      triggerMessage(`儲存失敗: ${err.message || err}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">
                  廠商工料二階專業分類管理中樞
                </h2>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  管理員 / 授權人員專屬維護
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                第 1 階工料大類 ➔ 第 2 階專業工項與公司名稱，直接與案場工程發包模組聯動
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
          <div className={`mx-6 mt-4 px-4 py-2.5 rounded-lg text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* 雙欄主體 */}
        <div className="flex-1 overflow-hidden p-6 grid grid-cols-1 md:grid-cols-5 gap-4 text-xs">
          {/* 左欄：第一階 工料大類 */}
          <div className="md:col-span-2 border border-slate-200 rounded-xl flex flex-col bg-slate-50/50 overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-slate-100/70 flex items-center justify-between">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-amber-600" />
                <span>一、工料大類</span>
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
              <div className="p-2.5 bg-amber-50/70 border-b border-amber-200 flex items-center gap-1.5 animate-in fade-in">
                <input
                  type="text"
                  autoFocus
                  placeholder="大類名稱 (如: 鋼材、泥作、拆圖)"
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
                    onClick={() => setSelectedCatId(cat.id)}
                    className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-600 text-white font-bold shadow-xs'
                        : 'hover:bg-slate-200/60 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{cat.category}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected ? 'bg-amber-700 text-amber-100' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {cat.vendors.length} 項
                      </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCatId(cat.id);
                          setEditingCatName(cat.category);
                        }}
                        className={`p-1 rounded hover:bg-black/10 cursor-pointer ${isSelected ? 'text-white' : 'text-slate-500'}`}
                        title="重新命名大類"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(cat.id);
                        }}
                        className={`p-1 rounded hover:bg-rose-500 hover:text-white cursor-pointer ${isSelected ? 'text-white' : 'text-rose-500'}`}
                        title="刪除大類"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右欄：第二階 專業工項或推薦公司 */}
          <div className="md:col-span-3 border border-slate-200 rounded-xl flex flex-col bg-white overflow-hidden shadow-2xs">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">
                  【{selectedCategory?.category}】專業細項 / 公司清單
                </span>
                <span className="text-[10px] text-slate-400 ml-1.5">
                  (案場發包二階選單之項目)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingVendor(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-300 px-2 py-0.5 rounded-md hover:bg-indigo-100 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>新增細項 / 公司</span>
              </button>
            </div>

            {/* 新增細項輸入框 */}
            {isAddingVendor && (
              <div className="p-2.5 bg-indigo-50/70 border-b border-indigo-100 flex items-center gap-1.5 animate-in fade-in">
                <input
                  type="text"
                  autoFocus
                  placeholder={`在【${selectedCategory?.category}】下新增細項 (如: 結構大樣圖、中鋼)`}
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddVendor();
                    if (e.key === 'Escape') setIsAddingVendor(false);
                  }}
                  className="flex-1 px-2.5 py-1.5 bg-white border border-indigo-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddVendor}
                  className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 cursor-pointer"
                  title="確認新增"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingVendor(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                  title="取消"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 細項清單 */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
              {(!selectedCategory || selectedCategory.vendors.length === 0) ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="font-medium">此工料類別目前尚無細項</p>
                  <button
                    type="button"
                    onClick={() => setIsAddingVendor(true)}
                    className="mt-2 text-indigo-600 hover:underline font-bold text-xs"
                  >
                    立即點擊新增第一個項目
                  </button>
                </div>
              ) : (
                selectedCategory.vendors.map(v => {
                  const isEditingThis = editingVendorId === v.id;
                  const isActive = v.isActive ?? true;

                  if (isEditingThis) {
                    return (
                      <div key={v.id} className="p-2 bg-slate-50 border border-slate-300 rounded-lg flex items-center gap-1.5">
                        <input
                          type="text"
                          autoFocus
                          value={editingVendorName}
                          onChange={(e) => setEditingVendorName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveVendorEdit(v.id);
                            if (e.key === 'Escape') setEditingVendorId(null);
                          }}
                          className="flex-1 px-2 py-1 bg-white border border-indigo-300 rounded text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveVendorEdit(v.id)}
                          className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingVendorId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={v.id}
                      className="group flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-amber-500' : 'bg-slate-300'}`} />
                        <span className={`font-semibold ${isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {v.name}
                        </span>
                        {!isActive && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded border border-slate-200">
                            已停用
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleVendorActive(v.id)}
                          className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
                          }`}
                        >
                          {isActive ? '啟用中' : '已停用'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingVendorId(v.id);
                            setEditingVendorName(v.name);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                          title="修改名稱"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteVendor(v.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                          title="刪除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
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
            title="重設為系統預設範本"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>恢復標準工料範本</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              取消離開
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>儲存並套用專業分類</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
