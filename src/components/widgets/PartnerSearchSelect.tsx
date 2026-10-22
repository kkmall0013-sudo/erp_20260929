import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { getAllBusinessPartners, saveBusinessPartner } from '../../db/sqlite';

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
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  // 快速建檔表單狀態
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerType, setNewPartnerType] = useState<'CUSTOMER' | 'VENDOR'>(
    quickCreateDefaultType || (partnerTypeFilter === 'CUSTOMER' ? 'CUSTOMER' : 'VENDOR')
  );
  const [newTaxId, setNewTaxId] = useState('');
  const [newContactPerson, setNewContactPerson] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCategory, setNewCategory] = useState(quickCreateDefaultCategory || '');
  const [createError, setCreateError] = useState('');

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

  // 點選外部自動關閉下拉選單
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // 根據條件即時篩選商業夥伴
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
        const isShop =
          (p.serviceCategorySub && p.serviceCategorySub.includes('拆圖')) ||
          (p.serviceCategoryMain && p.serviceCategoryMain.includes('專業技術顧問')) ||
          (p.name && (p.name.includes('拆圖') || p.name.includes('繪圖') || p.name.includes('結構')));
        // 若指定 SHOP_DRAWING，可優先匹配，但不嚴格排他（仍保留所有廠商可供切換選取）
      }

      // 2. 自訂分類篩選 (如：拆圖)
      if (categoryFilter) {
        const catStr = [
          p.serviceCategoryMain || '',
          p.serviceCategorySub || '',
          ...(p.serviceCategories || []),
          p.name
        ].join(' ');
        if (!catStr.toLowerCase().includes(categoryFilter.toLowerCase())) {
          // 不完全排除，但排序降權
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

  // 開啟快速新增彈窗
  const handleOpenQuickCreate = () => {
    setNewPartnerName(searchTerm.trim());
    setNewTaxId('');
    setNewContactPerson('');
    setNewPhone('');
    setNewAddress('');
    setNewCategory(
      quickCreateDefaultCategory ||
      (partnerTypeFilter === 'SHOP_DRAWING'
        ? '專業技術顧問與測量設計 / 拆圖廠商 / 施工大樣圖拆圖'
        : partnerTypeFilter === 'CUSTOMER' ? '業主建設' : '協力包商')
    );
    setNewPartnerType(
      quickCreateDefaultType || (partnerTypeFilter === 'CUSTOMER' ? 'CUSTOMER' : 'VENDOR')
    );
    setCreateError('');
    setIsQuickCreateOpen(true);
    setIsOpen(false);
  };

  // 儲存快速新增夥伴
  const handleSaveQuickPartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName.trim()) {
      setCreateError('請填寫夥伴名稱全銜');
      return;
    }

    try {
      const isCust = newPartnerType === 'CUSTOMER';
      const isVend = newPartnerType === 'VENDOR';
      const bpCode = isCust
        ? `CUST-${Date.now().toString().slice(-4)}`
        : `VEND-${Date.now().toString().slice(-4)}`;

      const newPartner: BusinessPartner = {
        id: `BP-QUICK-${Date.now().toString().slice(-6)}`,
        bpCode,
        name: newPartnerName.trim(),
        taxId: newTaxId.trim(),
        entityType: 'CORPORATION',
        type: isCust ? 'CUSTOMER' : 'VENDOR',
        isCustomer: isCust,
        isVendor: isVend,
        serviceCategoryMain: isVend ? (newCategory.includes('/') ? newCategory.split('/')[0].trim() : '專業工程') : undefined,
        serviceCategorySub: newCategory.trim() || (isCust ? '業主客戶' : '工程協力廠商'),
        representative: newContactPerson.trim(),
        contactPerson: newContactPerson.trim(),
        phone: newPhone.trim(),
        email: '',
        address: newAddress.trim(),
        bankName: '',
        bankCode: '',
        bankAccount: '',
        bankAccountName: '',
        bankFeePayer: 'COMPANY',
        hasInvoice: true,
        paymentTermsDays: 30,
        isHighRisk: false,
        currentScore: 90,
        status: 'ACTIVE',
        companyId: 'COMP-01',
        isDeleted: false,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const saved = saveBusinessPartner(newPartner, '系統操作員');
      refreshPartners();
      setSearchTerm(saved.name);
      setIsQuickCreateOpen(false);
      onSelect(saved, saved.name);
    } catch (err: any) {
      setCreateError(`建立失敗：${err.message || err}`);
    }
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
              onClick={handleOpenQuickCreate}
              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>快速另建夥伴</span>
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
          onFocus={() => setIsOpen(true)}
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

      {/* 即時搜尋下拉浮動清單 (Autocomplete Dropdown) */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-72 flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          {/* 頂部標題與結果筆數 */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
            <span className="font-semibold flex items-center gap-1">
              <Building2 className="w-3 h-3 text-indigo-600" />
              <span>匹配夥伴清單</span>
            </span>
            <span className="font-mono text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-200 font-bold">
              符合 {filteredPartners.length} 家
            </span>
          </div>

          {/* 夥伴結果列表 */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 p-1">
            {filteredPartners.length === 0 ? (
              <div className="py-6 px-4 text-center">
                <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-slate-600">
                  查無名稱、統編或代碼含有「{searchTerm}」之夥伴
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  您可以直接點擊下方按鈕，就地快速登記建立主檔！
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
                        ? 'bg-indigo-50/90 text-indigo-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
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
                          <span>統編: <strong className="text-slate-700">{p.taxId}</strong></span>
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
                        <Check className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <span className="text-[10px] text-indigo-600 opacity-0 group-hover:opacity-100 font-bold transition-opacity">
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
                onClick={handleOpenQuickCreate}
                className="w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {searchTerm.trim()
                    ? `另建新夥伴「${searchTerm.trim()}」至商業夥伴主庫`
                    : '快速登記建立新客戶 / 廠商資料'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 快速新增客戶/廠商資料彈窗 (Quick Create Partner Modal) */}
      {isQuickCreateOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    快速登記新夥伴資料
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    立即寫入商業夥伴主檔資料庫，並自動帶入當前表單欄位
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickCreateOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveQuickPartner} className="p-5 space-y-4 text-xs">
              {createError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* 夥伴身分分類 Toggle */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  夥伴業務型態 <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPartnerType('CUSTOMER')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      newPartnerType === 'CUSTOMER'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>客戶 / 業主單位 (合約發票開立對象)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewPartnerType('VENDOR')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      newPartnerType === 'VENDOR'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-800 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <DraftingCompass className="w-3.5 h-3.5" />
                    <span>合作廠商 (拆圖顧問/分包/材料商)</span>
                  </button>
                </div>
              </div>

              {/* 夥伴全銜 */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  公司或單位全銜名稱 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  placeholder="例如：宏聯結構工程拆圖顧問有限公司 或 B開發營造股份有限公司"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* 統一編號 & 聯絡人 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    統一編號 (8 碼)
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    value={newTaxId}
                    onChange={(e) => setNewTaxId(e.target.value)}
                    placeholder="如：98765432"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    業務窗口 / 負責人姓名
                  </label>
                  <input
                    type="text"
                    value={newContactPerson}
                    onChange={(e) => setNewContactPerson(e.target.value)}
                    placeholder="例如：張總工程師 / 李專案經理"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* 電話 & 專業類別 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    聯絡電話 / 手機
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="如：02-2345-6789"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    專業服務分類標註
                  </label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="例如：拆圖廠商 / 施工大樣圖拆圖"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* 通訊地址 */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  營業通訊地址
                </label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="例如：台北市信義區信義路五段 7 號"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>立即建立並帶入表單</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
