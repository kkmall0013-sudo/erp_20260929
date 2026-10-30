import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Layers,
  Building2,
  X,
  Sparkles
} from 'lucide-react';
import { SubcontractorCategoryGroup } from '../../types/erp';
import {
  getSubcontractorCategoryTree,
  addVendorToSubcontractorCategory
} from '../../db/sqlite';

interface FloatingSubcontractorSelectProps {
  value: string; // 廠商公司名稱
  workScope?: string; // 預計工料類別 (第一階)
  placeholder?: string;
  onChange: (vendorName: string, category?: string) => void;
  disabled?: boolean;
}

export const FloatingSubcontractorSelect: React.FC<FloatingSubcontractorSelectProps> = ({
  value = '',
  workScope = '',
  placeholder = '點選二階段廠商或直接輸入...',
  onChange,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tree, setTree] = useState<SubcontractorCategoryGroup[]>(() => getSubcontractorCategoryTree());
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [newVendorInput, setNewVendorInput] = useState('');
  const [newCatInput, setNewCatInput] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    width: 320,
    placeAbove: false
  });

  const refreshTree = () => {
    const data = getSubcontractorCategoryTree();
    setTree(data);
    return data;
  };

  // 當開啟或關閉時重新整理二階段字典
  useEffect(() => {
    if (isOpen) {
      const data = refreshTree();
      // 若已有 workScope 或 value，嘗試對應到該分類
      if (workScope) {
        const found = data.find(c => c.category === workScope || workScope.includes(c.category) || c.category.includes(workScope));
        if (found) {
          setSelectedCatId(found.id);
          return;
        }
      }
      if (value) {
        const found = data.find(c => c.vendors.some(v => v.name === value));
        if (found) {
          setSelectedCatId(found.id);
          return;
        }
      }
      if (data.length > 0 && !selectedCatId) {
        setSelectedCatId(data[0].id);
      }
    }
  }, [isOpen]);

  // 計算懸浮選單之精準螢幕絕對座標 (Fixed 座標系，依賴 document.body portal 徹底杜絕表格截斷)
  const updateCoords = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = 360;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
    const popoverWidth = Math.max(420, rect.width);

    // 避免水平超出螢幕
    let leftPos = rect.left;
    if (leftPos + popoverWidth > window.innerWidth - 12) {
      leftPos = Math.max(12, window.innerWidth - popoverWidth - 12);
    }

    setCoords({
      top: placeAbove ? rect.top - 6 : rect.bottom + 6,
      left: leftPos,
      width: popoverWidth,
      placeAbove
    });
  };

  const handleOpen = () => {
    if (disabled) return;
    updateCoords();
    setIsOpen(true);
    setSearchTerm('');
  };

  // 監聽視窗捲動或縮放，維持浮動座標對齊
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updateCoords();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  // 點擊彈窗外部自動關閉
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        !target.closest('#floating-subcontractor-popover')
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // 當前選中的大項類別
  const currentCategory = tree.find(c => c.id === selectedCatId) || tree[0];

  // 搜尋過濾：若有打字，同時在所有大項與小項廠商中搜尋
  const filteredVendorsBySearch = searchTerm.trim()
    ? tree.flatMap(cat =>
        cat.vendors
          .filter(v => v.name.toLowerCase().includes(searchTerm.trim().toLowerCase()))
          .map(v => ({ ...v, categoryName: cat.category }))
      )
    : [];

  // 選中廠商
  const handleSelectVendor = (vendorName: string, categoryName: string) => {
    onChange(vendorName, categoryName);
    setIsOpen(false);
  };

  // 新增小項廠商公司
  const handleAddNewVendor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newVendorInput.trim() || !currentCategory) return;
    const catName = currentCategory.category;
    const vName = newVendorInput.trim();
    const updated = addVendorToSubcontractorCategory(catName, vName);
    setTree(updated);
    setNewVendorInput('');
    onChange(vName, catName);
    setIsOpen(false);
  };

  // 新增大項類別
  const handleAddNewCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCatInput.trim()) return;
    const catName = newCatInput.trim();
    const newCat: SubcontractorCategoryGroup = {
      id: `CAT-${Date.now().toString().slice(-6)}`,
      category: catName,
      vendors: []
    };
    const updated = [...tree, newCat];
    setTree(updated);
    setSelectedCatId(newCat.id);
    setNewCatInput('');
    setIsAddingCat(false);
  };

  return (
    <div ref={triggerRef} className="relative w-full">
      {/* 觸發表單輸入格 */}
      <div
        onClick={handleOpen}
        className="flex items-center justify-between w-full px-2.5 py-1.5 bg-slate-50 hover:bg-white border border-slate-200 hover:border-indigo-400 rounded-lg cursor-pointer transition-all shadow-2xs group text-xs"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          {value ? (
            <span className="font-semibold text-slate-800 truncate">{value}</span>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-transform shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* 🌟 懸浮式二階段選單 (透過 createPortal 掛載至 body，徹底擺脫 overflow 截斷) */}
      {isOpen &&
        createPortal(
          <div
            id="floating-subcontractor-popover"
            style={{
              position: 'fixed',
              top: coords.placeAbove ? 'auto' : `${coords.top}px`,
              bottom: coords.placeAbove ? `${window.innerHeight - coords.top}px` : 'auto',
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999
            }}
            className="bg-white rounded-xl shadow-2xl border border-indigo-200 flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100 text-xs"
          >
            {/* 1. 懸浮頂部：二階段指引與快速搜尋 */}
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>二階協力廠商選單</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (① 點選工料類別 ➔ ② 點選公司名稱)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 關鍵字搜尋 */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="快速搜尋公司名稱 (如: 中鋼、東和、台泥、宏聯)..."
                  className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-md text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. 主體清單 */}
            {searchTerm.trim() ? (
              /* 搜尋結果模式 (跨分類) */
              <div className="max-h-60 overflow-y-auto p-2 divide-y divide-slate-100">
                <div className="text-[10px] text-slate-400 font-bold px-2 py-1">
                  搜尋結果 ({filteredVendorsBySearch.length} 筆)
                </div>
                {filteredVendorsBySearch.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    查無符合「{searchTerm}」之廠商公司
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => handleSelectVendor(searchTerm.trim(), currentCategory?.category || '其他協力')}
                        className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold cursor-pointer border border-indigo-200"
                      >
                        直接使用「{searchTerm.trim()}」為公司名稱
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredVendorsBySearch.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectVendor(item.name, item.categoryName)}
                      className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer group"
                    >
                      <span className="font-semibold text-slate-800 group-hover:text-indigo-700">
                        {item.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-800">
                        {item.categoryName}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              /* 標準二階段欄位模式 (左: 類別 / 右: 公司清單) */
              <div className="grid grid-cols-5 h-64 overflow-hidden">
                {/* 左欄：第一階層 - 工料類別 */}
                <div className="col-span-2 bg-slate-50/80 border-r border-slate-200 overflow-y-auto p-1.5 space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 px-2 py-1">
                    第一階：類別
                  </div>
                  {tree.map(cat => {
                    const isSelected = cat.id === (currentCategory?.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCatId(cat.id)}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                            : 'hover:bg-slate-200/60 text-slate-700 font-medium'
                        }`}
                      >
                        <span className="truncate">{cat.category}</span>
                        <span
                          className={`text-[10px] px-1 rounded-full font-mono ${
                            isSelected ? 'bg-indigo-500 text-white' : 'text-slate-400 bg-slate-200/50'
                          }`}
                        >
                          {cat.vendors.length}
                        </span>
                      </button>
                    );
                  })}

                  {/* 新增類別按鈕 */}
                  {isAddingCat ? (
                    <div className="p-1 space-y-1 bg-white rounded border border-indigo-200">
                      <input
                        type="text"
                        value={newCatInput}
                        onChange={(e) => setNewCatInput(e.target.value)}
                        placeholder="新類別名稱..."
                        className="w-full px-1.5 py-0.5 text-[11px] border border-slate-300 rounded outline-none"
                      />
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => setIsAddingCat(false)}
                          className="px-1.5 py-0.5 text-[10px] text-slate-500"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={handleAddNewCategory}
                          className="px-1.5 py-0.5 text-[10px] bg-indigo-600 text-white font-bold rounded"
                        >
                          確定
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingCat(true)}
                      className="w-full px-2 py-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer pt-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>新增大項類別</span>
                    </button>
                  )}
                </div>

                {/* 右欄：第二階層 - 公司名稱清單 */}
                <div className="col-span-3 overflow-y-auto p-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-500 px-1 py-0.5 flex items-center justify-between">
                      <span>第二階：【{currentCategory?.category || '未選'}】公司名稱</span>
                      <span className="text-[9px] text-slate-400">點選立即選定</span>
                    </div>

                    {currentCategory && currentCategory.vendors.length > 0 ? (
                      <div className="grid grid-cols-1 gap-1">
                        {currentCategory.vendors.map(v => {
                          const isPicked = value === v.name;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => handleSelectVendor(v.name, currentCategory.category)}
                              className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center justify-between transition-colors cursor-pointer group ${
                                isPicked
                                  ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold'
                                  : 'hover:bg-slate-50 border border-transparent hover:border-slate-200 text-slate-800'
                              }`}
                            >
                              <span className="truncate">{v.name}</span>
                              {isPicked && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        目前此類別尚無預設公司名稱
                      </div>
                    )}
                  </div>

                  {/* 快速新增此類別廠商輸入框 */}
                  <div className="pt-2 border-t border-slate-100 mt-2">
                    <form onSubmit={handleAddNewVendor} className="flex gap-1">
                      <input
                        type="text"
                        value={newVendorInput}
                        onChange={(e) => setNewVendorInput(e.target.value)}
                        placeholder={`＋ 新增【${currentCategory?.category || ''}】廠商...`}
                        className="flex-1 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!newVendorInput.trim()}
                        className="px-2.5 py-1 bg-indigo-600 disabled:bg-slate-300 text-white rounded text-xs font-semibold cursor-pointer shrink-0"
                      >
                        新增
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* 3. 底部自訂輸入輔助 */}
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">
                目前選定：<strong className="text-indigo-700">{value || '尚未選擇'}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-0.5 bg-white border border-slate-300 hover:bg-slate-100 rounded text-slate-700 font-semibold cursor-pointer"
              >
                完成
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
