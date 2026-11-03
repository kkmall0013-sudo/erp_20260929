import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Check,
  Plus,
  X,
  Building2,
  Phone,
  User,
  DraftingCompass,
  Briefcase,
  AlertCircle,
  Sparkles,
  MapPin,
  FileText
} from 'lucide-react';
import { BusinessPartner } from '../../types/erp';
import { getAllBusinessPartners, saveBusinessPartner, subscribeToDatabase } from '../../db/sqlite';
import { validateTaiwanTaxId, validateTaiwanNationalId } from '../../utils/taiwanValidation';
import { PartnerEditorModal } from '../partners/PartnerEditorModal';

export interface PartnerSearchSelectProps {
  value?: string; // 目前選定夥伴之名稱或 ID
  selectedPartnerId?: string; // 綁定的特定夥伴 ID
  onSelect: (partner: BusinessPartner | null, manualName?: string) => void;
  partnerTypeFilter?: 'CUSTOMER' | 'VENDOR' | 'SUBCONTRACTOR' | 'SHOP_DRAWING' | 'ALL';
  categoryFilter?: string; // 例如 '拆圖'
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  allowQuickCreate?: boolean;
  quickCreateDefaultCategory?: string; // 例如 '拆圖廠商 / 施工大樣圖拆圖'
  quickCreateDefaultType?: 'CUSTOMER' | 'VENDOR';
  helperText?: string;
  className?: string;
}

export const PartnerSearchSelect: React.FC<PartnerSearchSelectProps> = ({
  value = '',
  selectedPartnerId = '',
  onSelect,
  partnerTypeFilter = 'ALL',
  categoryFilter = '',
  placeholder = '請輸入關鍵字搜尋夥伴 (如：宏、開發、營造)...',
  label,
  required = false,
  disabled = false,
  allowQuickCreate = true,
  quickCreateDefaultCategory = '',
  quickCreateDefaultType,
  helperText,
  className = ''
}) => {
  const isCustomerOnly = partnerTypeFilter === 'CUSTOMER';
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    width: 300,
    placeAbove: false
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 載入全量夥伴主檔
  const refreshPartners = () => {
    try {
      const all = getAllBusinessPartners();
      setPartners(all);
    } catch (err) {
      console.error('無法載入商業夥伴清單:', err);
    }
  };

  useEffect(() => {
    refreshPartners();
    const unsubscribe = subscribeToDatabase(() => {
      refreshPartners();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // 同步外部傳入之 value
  useEffect(() => {
    if (selectedPartnerId) {
      const found = partners.find(p => p.id === selectedPartnerId);
      if (found) {
        setSearchTerm(found.name);
        return;
      }
    }
    setSearchTerm(value || '');
  }, [value, selectedPartnerId, partners]);

  const updateCoords = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
    const popoverWidth = Math.max(340, rect.width);
    let leftPos = rect.left;
    if (leftPos + popoverWidth > window.innerWidth - 12) {
      leftPos = Math.max(12, window.innerWidth - popoverWidth - 12);
    }
    setCoords({
      top: placeAbove ? rect.top - 4 : rect.bottom + 4,
      left: leftPos,
      width: popoverWidth,
      placeAbove
    });
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const handleScrollOrResize = () => updateCoords();
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    }
  }, [isOpen]);

  // 點選外部自動關閉下拉選單
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !target.closest('.floating-partner-dropdown')
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // 根據條件即時篩選商業夥伴（嚴格排除無關類別雜訊）
  const filteredPartners = useMemo(() => {
    const query = (searchTerm || '').trim().toLowerCase();

    return partners.filter(p => {
      // 1. 夥伴型態篩選
      if (partnerTypeFilter === 'CUSTOMER') {
        const isCust = p.isCustomer || p.type === 'CUSTOMER' || p.type === 'BOTH';
        if (!isCust) return false;
      } else if (partnerTypeFilter === 'VENDOR') {
        const isVend = p.isVendor || p.type === 'VENDOR' || p.type === 'BOTH' || p.type === 'SUBCONTRACTOR';
        if (!isVend) return false;
      } else if (partnerTypeFilter === 'SUBCONTRACTOR') {
        if (p.type !== 'SUBCONTRACTOR') return false;
      } else if (partnerTypeFilter === 'SHOP_DRAWING') {
        // 嚴格過濾拆圖協力廠商：只保留具備拆圖專業業務之廠商，排除預拌混泥土、土方、鋼構等無拆圖業務廠商，杜絕雜訊
        const isShop =
          (p.serviceCategorySub && p.serviceCategorySub.includes('拆圖')) ||
          (p.serviceCategoryMain && p.serviceCategoryMain.includes('拆圖')) ||
          (p.serviceCategories && p.serviceCategories.some(c => (c.main && c.main.includes('拆圖')) || (c.sub && c.sub.includes('拆圖')))) ||
          (p.name && (p.name.includes('拆圖') || p.name.includes('大樣圖')));
        if (!isShop) return false;
      }

      // 2. 自訂分類篩選 (如：拆圖) - 嚴格排除非此類別之廠商雜訊
      if (categoryFilter) {
        const catStr = [
          p.serviceCategoryMain || '',
          p.serviceCategorySub || '',
          ...(p.serviceCategories || []).map(c => `${c.main || ''} ${c.sub || ''}`),
          p.name
        ].join(' ').toLowerCase();
        if (!catStr.includes(categoryFilter.toLowerCase())) {
          return false;
        }
      }

      // 3. 搜尋字詞即時自動篩選（打一個字就篩出）
      if (!query) return true;

      const matchName = p.name?.toLowerCase().includes(query);
      const matchTaxId = p.taxId?.toLowerCase().includes(query);
      const matchCode = p.bpCode?.toLowerCase().includes(query);
      const matchContact = p.contactPerson?.toLowerCase().includes(query);
      const matchSubCat = p.serviceCategorySub?.toLowerCase().includes(query);
      const matchMainCat = p.serviceCategoryMain?.toLowerCase().includes(query);
      const matchPhone = p.phone?.toLowerCase().includes(query);

      return (
        matchName ||
        matchTaxId ||
        matchCode ||
        matchContact ||
        matchSubCat ||
        matchMainCat ||
        matchPhone
      );
    }).sort((a, b) => {
      // 拆圖廠商特別加權置頂
      if (partnerTypeFilter === 'SHOP_DRAWING' || categoryFilter.includes('拆圖')) {
        const aIsShop = (a.serviceCategorySub?.includes('拆圖') || a.name.includes('拆圖')) ? 1 : 0;
        const bIsShop = (b.serviceCategorySub?.includes('拆圖') || b.name.includes('拆圖')) ? 1 : 0;
        if (aIsShop !== bIsShop) return bIsShop - aIsShop;
      }
      return 0;
    });
  }, [partners, searchTerm, partnerTypeFilter, categoryFilter]);

  // 選取夥伴
  const handleSelect = (partner: BusinessPartner) => {
    setSearchTerm(partner.name);
    setIsOpen(false);
    onSelect(partner, partner.name);
  };

  // 清除目前選取
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchTerm('');
    onSelect(null, '');
    if (inputRef.current) inputRef.current.focus();
  };

  // 開啟聯絡明細規格新增彈窗
  const handleOpenQuickCreate = () => {
    setIsQuickCreateOpen(true);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-[11px] font-medium text-slate-700 mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <span>{label}</span>
            {required && <span className="text-rose-500">*</span>}
          </span>
          {allowQuickCreate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenQuickCreate();
              }}
              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{isCustomerOnly ? '另建新業主' : '快速另建夥伴'}</span>
            </button>
          )}
        </label>
      )}

      {/* 輸入搜尋框 */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-3.5 h-3.5" />
        </div>

        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={searchTerm}
          placeholder={placeholder}
          onFocus={() => {
            refreshPartners();
            setIsOpen(true);
          }}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            // 允許同時透過純文字回傳手動輸入值
            onSelect(null, e.target.value);
          }}
          className={`w-full pl-8 pr-16 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
            disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
          }`}
        />

        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
          {searchTerm && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="清除內容"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
          >
            <span className={`text-[10px] transition-transform inline-block ${isOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
        </div>
      </div>

      {helperText && (
        <p className="text-[10px] text-slate-500 mt-1">{helperText}</p>
      )}

      {/* 即時搜尋下拉浮動清單 (Autocomplete Dropdown - 懸浮式 Portal 徹底避免被任何外層表格或滾動區域截斷) */}
      {isOpen && !disabled && createPortal(
        <div
          style={{
            position: 'fixed',
            top: coords.placeAbove ? 'auto' : `${coords.top}px`,
            bottom: coords.placeAbove ? `${window.innerHeight - coords.top}px` : 'auto',
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 99999
          }}
          className="floating-partner-dropdown bg-white rounded-xl shadow-2xl border border-indigo-200 max-h-80 flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100 text-xs"
        >
          {/* 頂部標題與結果筆數 */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
            <span className="font-semibold flex items-center gap-1">
              <Building2 className={`w-3 h-3 ${isCustomerOnly ? 'text-emerald-600' : 'text-indigo-600'}`} />
              <span>{isCustomerOnly ? '匹配業主清單 (合約甲方)' : '匹配夥伴清單'}</span>
            </span>
            <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded border font-bold ${
              isCustomerOnly ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}>
              符合 {filteredPartners.length} 家
            </span>
          </div>

          {/* 夥伴結果列表 */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 p-1">
            {filteredPartners.length === 0 ? (
              <div className="py-6 px-4 text-center">
                <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-slate-600">
                  {isCustomerOnly
                    ? `查無名稱、統編或代碼含有「${searchTerm}」之已建檔業主`
                    : `查無名稱、統編或代碼含有「${searchTerm}」之夥伴`}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isCustomerOnly
                    ? '您可以直接點擊下方「另建新業主」，立即登記建立業主主檔！'
                    : '您可以直接點擊下方按鈕，就地快速登記建立主檔！'}
                </p>
              </div>
            ) : (
              filteredPartners.map(p => {
                const isSelected = selectedPartnerId === p.id || value === p.name;
                const isShopDrawing =
                  (p.serviceCategorySub && p.serviceCategorySub.includes('拆圖')) ||
                  (p.serviceCategoryMain && p.serviceCategoryMain.includes('專業技術顧問')) ||
                  p.name.includes('拆圖');

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className={`px-3 py-2 rounded-lg cursor-pointer transition-colors group flex items-start justify-between gap-2 ${
                      isSelected
                        ? (isCustomerOnly ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'bg-indigo-50/90 text-indigo-900 font-semibold')
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-bold text-slate-800 transition-colors ${
                          isCustomerOnly ? 'group-hover:text-emerald-700' : 'group-hover:text-indigo-600'
                        }`}>
                          {p.name}
                        </span>

                        {/* 拆圖廠商專屬勳章 */}
                        {isShopDrawing && (
                          <span className="px-1.5 py-0.2 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[9px] font-bold flex items-center gap-0.5">
                            <DraftingCompass className="w-2.5 h-2.5 text-purple-600" />
                            <span>拆圖顧問</span>
                          </span>
                        )}

                        {/* 客戶 / 廠商 Badge */}
                        {p.isCustomer && (
                          <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-medium">
                            客戶/業主
                          </span>
                        )}
                        {p.isVendor && !isShopDrawing && (
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-medium">
                            {p.serviceCategorySub || '協力廠商'}
                          </span>
                        )}
                      </div>

                      {/* 細部資訊 (統編、代碼、聯絡人、電話) */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] text-slate-500 font-mono">
                        {p.taxId && (
                          <span>統編/身分證: <strong className="text-slate-700">{p.taxId}</strong></span>
                        )}
                        {p.bpCode && (
                          <span>代碼: {p.bpCode}</span>
                        )}
                        {p.contactPerson && (
                          <span className="flex items-center gap-0.5 font-sans">
                            <User className="w-2.5 h-2.5 text-slate-400" />
                            <span>{p.contactPerson}</span>
                          </span>
                        )}
                        {p.phone && (
                          <span className="flex items-center gap-0.5">
                            <Phone className="w-2.5 h-2.5 text-slate-400" />
                            <span>{p.phone}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 self-center">
                      {isSelected ? (
                        <Check className={`w-4 h-4 ${isCustomerOnly ? 'text-emerald-600' : 'text-indigo-600'}`} />
                      ) : (
                        <span className={`text-[10px] opacity-0 group-hover:opacity-100 font-bold transition-opacity ${
                          isCustomerOnly ? 'text-emerald-600' : 'text-indigo-600'
                        }`}>
                          帶入 ↵
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 底部快速新增引導列 */}
          {allowQuickCreate && (
            <div className="p-2 border-t border-slate-200 bg-slate-50/90 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenQuickCreate();
                }}
                className={`w-full py-1.5 px-3 rounded-lg text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer ${
                  isCustomerOnly
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {searchTerm.trim()
                    ? (isCustomerOnly
                        ? `另建新業主「${searchTerm.trim()}」至客戶主庫`
                        : `另建新夥伴「${searchTerm.trim()}」至商業夥伴主庫`)
                    : (isCustomerOnly
                        ? '＋ 快速登記建立新業主資料'
                        : '快速登記建立新客戶 / 廠商資料')}
                </span>
              </button>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* 聯絡明細全功能新增彈窗 (PartnerEditorModal - 規格與聯絡明細 100% 一致) */}
      {isQuickCreateOpen && (
        <PartnerEditorModal
          isOpen={isQuickCreateOpen}
          onClose={() => setIsQuickCreateOpen(false)}
          initialName={searchTerm.trim()}
          defaultType={isCustomerOnly ? 'CUSTOMER' : 'VENDOR'}
          title={isCustomerOnly ? '新增業主客戶資料（聯絡明細規格）' : '新增商業夥伴主檔（聯絡明細規格）'}
          onSaved={(savedPartner) => {
            refreshPartners();
            setSearchTerm(savedPartner.name);
            setIsQuickCreateOpen(false);
            onSelect(savedPartner, savedPartner.name);
          }}
        />
      )}
    </div>
  );
};

