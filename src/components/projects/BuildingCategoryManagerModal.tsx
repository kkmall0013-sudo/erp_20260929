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
  ChevronRight
} from 'lucide-react';
import { BuildingCategoryGroup, BuildingCategoryItem } from '../../types/erp';
import {
  getBuildingCategoryTree,
  saveBuildingCategoryTree,
  DEFAULT_BUILDING_CATEGORY_TREE
} from '../../db/sqlite';

interface BuildingCategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  currentUser?: any;
}

export const BuildingCategoryManagerModal: React.FC<BuildingCategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  currentUser
}) => {
  const [tree, setTree] = useState<BuildingCategoryGroup[]>(() => getBuildingCategoryTree());
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    const initialTree = getBuildingCategoryTree();
    return initialTree.length > 0 ? initialTree[0].id : '';
  });

  // 編輯大項狀態
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [isAddingGroup, setIsAddingGroup] = useState(false);

  // 編輯小項狀態
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);

  // 提示訊息
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const selectedGroup = tree.find(g => g.id === selectedGroupId) || tree[0];

  const triggerMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // 1. 新增大項
  const handleAddGroup = () => {
    if (!newGroupName.trim()) {
      triggerMessage('請輸入大項類別名稱', 'error');
      return;
    }
    const clean = newGroupName.trim();
    if (tree.some(g => g.name === clean)) {
      triggerMessage(`大項【${clean}】已存在`, 'error');
      return;
    }
    const newGroup: BuildingCategoryGroup = {
      id: `GRP-${Date.now().toString().slice(-6)}`,
      name: clean,
      sortOrder: tree.length + 1,
      items: []
    };
    const updated = [...tree, newGroup];
    setTree(updated);
    setSelectedGroupId(newGroup.id);
    setNewGroupName('');
    setIsAddingGroup(false);
    triggerMessage(`已新增大項【${clean}】`);
  };

  // 2. 儲存大項修改
  const handleSaveGroupEdit = (groupId: string) => {
    if (!editingGroupName.trim()) return;
    const clean = editingGroupName.trim();
    const updated = tree.map(g => g.id === groupId ? { ...g, name: clean } : g);
    setTree(updated);
    setEditingGroupId(null);
    setEditingGroupName('');
    triggerMessage('大項名稱已修改');
  };

  // 3. 刪除大項
  const handleDeleteGroup = (groupId: string) => {
    const target = tree.find(g => g.id === groupId);
    if (!target) return;
    if (tree.length <= 1) {
      triggerMessage('系統至少需保留一個大項類別', 'error');
      return;
    }
    if (target.items.length > 0) {
      if (!window.confirm(`大項【${target.name}】底下尚有 ${target.items.length} 個小項，確定要連同小項一併刪除嗎？`)) {
        return;
      }
    }
    const updated = tree.filter(g => g.id !== groupId);
    setTree(updated);
    if (selectedGroupId === groupId) {
      setSelectedGroupId(updated[0].id);
    }
    triggerMessage(`已刪除大項【${target.name}】`);
  };

  // 4. 新增小項
  const handleAddItem = () => {
    if (!selectedGroup) return;
    if (!newItemName.trim()) {
      triggerMessage('請輸入小項業務名稱', 'error');
      return;
    }
    const clean = newItemName.trim();
    if (selectedGroup.items.some(i => i.name === clean)) {
      triggerMessage(`該大項下已存在小項【${clean}】`, 'error');
      return;
    }
    const newItem: BuildingCategoryItem = {
      id: `ITM-${Date.now().toString().slice(-6)}`,
      name: clean,
      isActive: true,
      sortOrder: selectedGroup.items.length + 1
    };
    const updated = tree.map(g => {
      if (g.id === selectedGroup.id) {
        return { ...g, items: [...g.items, newItem] };
      }
      return g;
    });
    setTree(updated);
    setNewItemName('');
    setIsAddingItem(false);
    triggerMessage(`已於【${selectedGroup.name}】新增小項【${clean}】`);
  };

  // 5. 儲存小項修改
  const handleSaveItemEdit = (itemId: string) => {
    if (!selectedGroup || !editingItemName.trim()) return;
    const clean = editingItemName.trim();
    const updated = tree.map(g => {
      if (g.id === selectedGroup.id) {
        return {
          ...g,
          items: g.items.map(i => i.id === itemId ? { ...i, name: clean } : i)
        };
      }
      return g;
    });
    setTree(updated);
    setEditingItemId(null);
    setEditingItemName('');
    triggerMessage('小項名稱已修改');
  };

  // 6. 切換小項啟用/停用
  const handleToggleItemActive = (itemId: string) => {
    if (!selectedGroup) return;
    const updated = tree.map(g => {
      if (g.id === selectedGroup.id) {
        return {
          ...g,
          items: g.items.map(i => i.id === itemId ? { ...i, isActive: !i.isActive } : i)
        };
      }
      return g;
    });
    setTree(updated);
  };

  // 7. 刪除小項
  const handleDeleteItem = (itemId: string) => {
    if (!selectedGroup) return;
    const item = selectedGroup.items.find(i => i.id === itemId);
    if (!item) return;
    if (!window.confirm(`確定要刪除小項【${item.name}】嗎？若已有案場引用，建議設為「停用」而非刪除。`)) {
      return;
    }
    const updated = tree.map(g => {
      if (g.id === selectedGroup.id) {
        return { ...g, items: g.items.filter(i => i.id !== itemId) };
      }
      return g;
    });
    setTree(updated);
    triggerMessage(`已刪除小項【${item.name}】`);
  };

  // 8. 恢復預設項目
  const handleResetDefault = () => {
    if (!window.confirm('確定要將建物業務類型重設為標準預設範本嗎？（建物類: 鐵皮倉庫、鋼構建築、農業設施、風雨球場 / 其他: 鋼梯、屋頂浪板）')) {
      return;
    }
    setTree(DEFAULT_BUILDING_CATEGORY_TREE);
    setSelectedGroupId(DEFAULT_BUILDING_CATEGORY_TREE[0].id);
    triggerMessage('已重設為標準預設分類');
  };

  // 9. 儲存所有變更
  const handleSaveAll = () => {
    try {
      saveBuildingCategoryTree(tree, currentUser?.fullName || '管理員');
      triggerMessage('✓ 建造物業務類型已成功保存！');
      if (onSaved) onSaved();
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: any) {
      triggerMessage(`儲存失敗: ${err.message || err}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal 頂部 Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">
                  建造建物與業務類型自訂管理
                </h2>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  兩階層架構：大項分類 ➔ 第二階業務小項
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                可自由新增自訂業務大項與小項，開案時使用者將依此清單選取第二階層小項
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

        {/* 主體區塊：左右雙欄 (左欄大項、右欄小項) */}
        <div className="flex-1 overflow-hidden p-6 grid grid-cols-1 md:grid-cols-5 gap-4 text-xs">
          {/* 左欄：第一階 大項分類 (佔 2 欄) */}
          <div className="md:col-span-2 border border-slate-200 rounded-xl flex flex-col bg-slate-50/50 overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-slate-100/70 flex items-center justify-between">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-indigo-600" />
                <span>一、大項分類 (群組)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsAddingGroup(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-2 py-0.5 rounded-md hover:bg-indigo-50 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>新增大項</span>
              </button>
            </div>

            {/* 新增大項輸入框 */}
            {isAddingGroup && (
              <div className="p-2.5 bg-indigo-50/70 border-b border-indigo-100 flex items-center gap-1.5 animate-in fade-in">
                <input
                  type="text"
                  autoFocus
                  placeholder="輸入大項名稱 (如: 建物類、修繕類)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddGroup();
                    if (e.key === 'Escape') setIsAddingGroup(false);
                  }}
                  className="flex-1 px-2.5 py-1.5 bg-white border border-indigo-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddGroup}
                  className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 cursor-pointer"
                  title="確認新增"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingGroup(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                  title="取消"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 大項清單列表 */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1.5 space-y-1">
              {tree.map(group => {
                const isSelected = group.id === selectedGroupId;
                const isEditingThis = editingGroupId === group.id;

                if (isEditingThis) {
                  return (
                    <div key={group.id} className="p-2 bg-indigo-50/80 rounded-lg flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveGroupEdit(group.id);
                          if (e.key === 'Escape') setEditingGroupId(null);
                        }}
                        className="flex-1 px-2 py-1 bg-white border border-indigo-300 rounded text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveGroupEdit(group.id)}
                        className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingGroupId(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : 'hover:bg-slate-200/60 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{group.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {group.items.length} 項
                      </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingGroupId(group.id);
                          setEditingGroupName(group.name);
                        }}
                        className={`p-1 rounded hover:bg-black/10 cursor-pointer ${isSelected ? 'text-white' : 'text-slate-500'}`}
                        title="重新命名大項"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id);
                        }}
                        className={`p-1 rounded hover:bg-rose-500 hover:text-white cursor-pointer ${isSelected ? 'text-white' : 'text-rose-500'}`}
                        title="刪除大項"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右欄：第二階 小項業務 (佔 3 欄 - 實際案場選取項目) */}
          <div className="md:col-span-3 border border-slate-200 rounded-xl flex flex-col bg-white overflow-hidden shadow-2xs">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">
                  【{selectedGroup?.name}】下屬業務小項
                </span>
                <span className="text-[10px] text-slate-400 ml-1.5">
                  (案場選單中實際可選項目)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingItem(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md hover:bg-emerald-100 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>新增小項業務</span>
              </button>
            </div>

            {/* 新增小項輸入框 */}
            {isAddingItem && (
              <div className="p-2.5 bg-emerald-50/70 border-b border-emerald-100 flex items-center gap-1.5 animate-in fade-in">
                <input
                  type="text"
                  autoFocus
                  placeholder={`在【${selectedGroup?.name}】下新增小項 (如: 鐵皮倉庫、鋼梯)`}
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddItem();
                    if (e.key === 'Escape') setIsAddingItem(false);
                  }}
                  className="flex-1 px-2.5 py-1.5 bg-white border border-emerald-300 rounded text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer"
                  title="確認新增"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingItem(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                  title="取消"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 小項清單 */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
              {(!selectedGroup || selectedGroup.items.length === 0) ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="font-medium">此大項目前尚無任何小項業務</p>
                  <button
                    type="button"
                    onClick={() => setIsAddingItem(true)}
                    className="mt-2 text-indigo-600 hover:underline font-bold text-xs"
                  >
                    立即點擊新增第一個小項
                  </button>
                </div>
              ) : (
                selectedGroup.items.map(item => {
                  const isEditingThis = editingItemId === item.id;

                  if (isEditingThis) {
                    return (
                      <div key={item.id} className="p-2 bg-slate-50 border border-slate-300 rounded-lg flex items-center gap-1.5">
                        <input
                          type="text"
                          autoFocus
                          value={editingItemName}
                          onChange={(e) => setEditingItemName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveItemEdit(item.id);
                            if (e.key === 'Escape') setEditingItemId(null);
                          }}
                          className="flex-1 px-2 py-1 bg-white border border-indigo-300 rounded text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveItemEdit(item.id)}
                          className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="group flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className={`font-semibold ${item.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {item.name}
                        </span>
                        {!item.isActive && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded border border-slate-200">
                            已停用 (保留歷史不提供新選)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* 啟用/停用開關 */}
                        <button
                          type="button"
                          onClick={() => handleToggleItemActive(item.id)}
                          className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                            item.isActive
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
                          }`}
                          title={item.isActive ? '點擊停用此小項 (新案場不再提供選取)' : '點擊啟用此小項'}
                        >
                          {item.isActive ? '啟用中' : '已停用'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemId(item.id);
                            setEditingItemName(item.name);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                          title="修改名稱"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                          title="刪除小項"
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

        {/* 底部按鈕列 */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="重設為預設項目範本"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>恢復標準範本 (建物類/其他)</span>
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
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>儲存並套用分類設定</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
