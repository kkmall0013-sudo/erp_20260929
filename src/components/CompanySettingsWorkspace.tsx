import React, { useState, useEffect, useMemo } from 'react';
import { Company, PhoneItem, KeyPerson } from '../types/erp';
import {
  Building2,
  Users2,
  UserCheck,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  Printer,
  Mail,
  MapPin,
  DollarSign,
  FileText,
  ShieldCheck,
  Layers,
  Sparkles,
  Info,
  Clock,
  ArrowRight,
  User,
  Crown,
  Search,
  Filter,
  AlertTriangle,
  X,
  ExternalLink,
  ChevronRight,
  GitBranch
} from 'lucide-react';
import { saveCompany, deleteCompany } from '../db/sqlite';
import { useAuth } from '../context/AuthContext';

interface CompanySettingsWorkspaceProps {
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onDataChanged: () => void;
}

// =========================================================================
// 1. 內控檢核防呆演算法 (台灣統編 8 碼 & 台灣身分證 10 碼)
// =========================================================================

// 台灣財政部 8 碼統一編號加權檢核邏輯
function validateTaiwanTaxId(taxId: string): { valid: boolean; reason?: string } {
  if (!taxId) return { valid: false, reason: '請輸入 8 碼統一編號' };
  if (!/^\d{8}$/.test(taxId)) return { valid: false, reason: '統一編號必須為 8 位純數字' };

  const weights = [1, 2, 1, 2, 1, 2, 4, 1];
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    const digit = parseInt(taxId[i], 10);
    const prod = digit * weights[i];
    sum += Math.floor(prod / 10) + (prod % 10);
  }

  if (sum % 10 === 0) return { valid: true, reason: '統編加權檢核通過' };

  // 若第 7 位是 7，可有兩種可能（加 1 是否能整除 10）
  if (taxId[6] === '7') {
    if ((sum + 1) % 10 === 0) return { valid: true, reason: '統編加權檢核通過 (第7碼為7特許)' };
  }

  return { valid: false, reason: '統一編號檢查碼不符（請確認輸入）' };
}

// 台灣身分證字號加權模數 10 防呆檢核演算法 (首字大寫英文字母 + 9 碼數字)
function validateTaiwanNationalId(nationalId: string): { valid: boolean; reason?: string; gender?: string } {
  if (!nationalId) return { valid: false, reason: '請輸入身分證字號' };
  const cleanId = nationalId.trim().toUpperCase();

  if (!/^[A-Z][1289]\d{8}$/.test(cleanId)) {
    if (!/^[A-Z]/.test(cleanId)) return { valid: false, reason: '首字必須為大寫英文字母' };
    if (cleanId.length > 1 && !/^[A-Z][1289]/.test(cleanId)) {
      return { valid: false, reason: '第 2 碼須為性別碼 (1 男性 / 2 女性)' };
    }
    return { valid: false, reason: `格式須為首字英文字母+9碼數字 (${cleanId.length}/10 碼)` };
  }

  // 字母對應縣市數值表
  const letterMap: Record<string, number> = {
    A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, J: 18, K: 19,
    L: 20, M: 21, N: 22, P: 23, Q: 24, R: 25, S: 26, T: 27, U: 28, V: 29,
    X: 30, Y: 31, W: 32, Z: 33, I: 34, O: 35
  };

  const letterVal = letterMap[cleanId[0]];
  if (!letterVal) return { valid: false, reason: '無效的英文字母代碼' };

  const n1 = Math.floor(letterVal / 10);
  const n2 = letterVal % 10;

  const weights = [8, 7, 6, 5, 4, 3, 2, 1];
  let sum = n1 * 1 + n2 * 9;

  for (let i = 0; i < 8; i++) {
    sum += parseInt(cleanId[i + 1], 10) * weights[i];
  }
  sum += parseInt(cleanId[9], 10);

  if (sum % 10 === 0) {
    const gender = cleanId[1] === '1' ? '男性' : cleanId[1] === '2' ? '女性' : '居留證/外籍';
    return { valid: true, reason: `身分證檢核正確 (${gender})`, gender };
  }

  return { valid: false, reason: '身分證檢查碼計算不符 (請核對號碼)' };
}

// Email 格式防呆
function validateEmail(email: string): boolean {
  if (!email) return true; // 選填允許留空
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// =========================================================================
// 2. 主組件：公司設定 (鼎新 A1 旗艦工作台實作)
// =========================================================================
export const CompanySettingsWorkspace: React.FC<CompanySettingsWorkspaceProps> = ({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onDataChanged,
}) => {
  const { currentUser } = useAuth();
  const [activeCompanyId, setActiveCompanyId] = useState<string>(selectedCompanyId || companies[0]?.id || 'COMP-01');

  // 篩選與搜尋狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GROUP' | 'CORPORATION' | 'PERSONAL'>('ALL');

  // 當前編輯表單狀態
  const [formData, setFormData] = useState<Partial<Company>>({});
  const [phones, setPhones] = useState<PhoneItem[]>([]);
  const [keyPersonnel, setKeyPersonnel] = useState<KeyPerson[]>([]);

  // 即時防呆檢核反饋
  const [taxIdFeedback, setTaxIdFeedback] = useState<{ valid: boolean; reason?: string }>({ valid: true });
  const [nationalIdFeedback, setNationalIdFeedback] = useState<{ valid: boolean; reason?: string; gender?: string }>({ valid: true });

  // 內控防呆刪除確認 Modal 狀態
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteErrorNote, setDeleteErrorNote] = useState<string | null>(null);

  // 浮動提示 Toast
  const [toastNote, setToastNote] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastNote(msg);
    setTimeout(() => setToastNote(null), 3200);
  };

  // 當前選取的實體
  const targetCompany = companies.find(c => c.id === activeCompanyId) || companies[0];

  useEffect(() => {
    if (targetCompany) {
      setFormData({
        id: targetCompany.id,
        companyCode: targetCompany.companyCode,
        name: targetCompany.name,
        shortName: targetCompany.shortName || '',
        entityType: targetCompany.entityType || 'CORPORATION',
        parentId: targetCompany.parentId || '',
        taxId: targetCompany.taxId || '',
        nationalId: targetCompany.nationalId || '',
        representative: targetCompany.representative || '',
        documentPrefix: targetCompany.documentPrefix || '',
        email: targetCompany.email || '',
        registeredAddress: targetCompany.registeredAddress || '',
        contactAddress: targetCompany.contactAddress || '',
        capitalAmount: targetCompany.capitalAmount || 0,
        baseCurrency: targetCompany.baseCurrency || 'TWD',
        version: targetCompany.version,
        updatedAt: targetCompany.updatedAt,
      });
      setPhones(targetCompany.phones || []);
      setKeyPersonnel(targetCompany.keyPersonnel || []);

      if (targetCompany.entityType === 'CORPORATION' && targetCompany.taxId) {
        setTaxIdFeedback(validateTaiwanTaxId(targetCompany.taxId));
      } else {
        setTaxIdFeedback({ valid: true });
      }

      if (targetCompany.entityType === 'PERSONAL' && targetCompany.nationalId) {
        setNationalIdFeedback(validateTaiwanNationalId(targetCompany.nationalId));
      } else {
        setNationalIdFeedback({ valid: true });
      }
    }
  }, [targetCompany, activeCompanyId]);

  // 處理統編變更與即時驗證
  const handleTaxIdChange = (val: string) => {
    setFormData(prev => ({ ...prev, taxId: val }));
    if (formData.entityType === 'CORPORATION') {
      if (val.length === 8) {
        setTaxIdFeedback(validateTaiwanTaxId(val));
      } else if (val.length > 0) {
        setTaxIdFeedback({ valid: false, reason: `已輸入 ${val.length}/8 碼` });
      } else {
        setTaxIdFeedback({ valid: false, reason: '公司法人必須填寫統一編號' });
      }
    } else {
      setTaxIdFeedback({ valid: true });
    }
  };

  // 處理個人身分證變更與即時驗證
  const handleNationalIdChange = (val: string) => {
    const upperVal = val.toUpperCase();
    setFormData(prev => ({ ...prev, nationalId: upperVal }));
    if (formData.entityType === 'PERSONAL') {
      if (upperVal.length === 10) {
        setNationalIdFeedback(validateTaiwanNationalId(upperVal));
      } else if (upperVal.length > 0) {
        setNationalIdFeedback({ valid: false, reason: `已輸入 ${upperVal.length}/10 碼` });
      } else {
        setNationalIdFeedback({ valid: true });
      }
    }
  };

  // 新增電話項目
  const handleAddPhone = (type: PhoneItem['type'] = '市話') => {
    setPhones(prev => [
      ...prev,
      { id: `P-${Date.now()}`, type, number: '' }
    ]);
  };

  const handleUpdatePhone = (id: string, field: 'type' | 'number', value: string) => {
    setPhones(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleRemovePhone = (id: string) => {
    setPhones(prev => prev.filter(p => p.id !== id));
  };

  // 新增重要人物 (重要決策層名單)
  const handleAddKeyPerson = () => {
    setKeyPersonnel(prev => [
      ...prev,
      { id: `KP-${Date.now()}`, title: '總經理', name: '', phone: '' }
    ]);
  };

  const handleUpdateKeyPerson = (id: string, field: keyof KeyPerson, value: string) => {
    setKeyPersonnel(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleRemoveKeyPerson = (id: string) => {
    setKeyPersonnel(prev => prev.filter(p => p.id !== id));
  };

  // 建立新公司、新個人實體或新集團
  const handleCreateNew = (type: 'GROUP' | 'CORPORATION' | 'PERSONAL') => {
    const isCorp = type === 'CORPORATION';
    const isPersonal = type === 'PERSONAL';
    const isGroup = type === 'GROUP';

    const groupEntity = companies.find(c => c.entityType === 'GROUP');
    const suffix = Date.now().toString().slice(-4);
    const newId = isGroup ? `GRP-${suffix}` : isCorp ? `COMP-${suffix}` : `BOSS-${suffix}`;
    const newCode = isGroup ? `GRP-${suffix}` : isCorp ? `CMP-${suffix}` : `PERS-${suffix}`;

    const newEntity: Partial<Company> = {
      id: newId,
      companyCode: newCode,
      name: isGroup 
        ? '新創立營造控股事業集團' 
        : isCorp 
        ? '新立案營造工程股份有限公司' 
        : '負責人私人調度資金戶',
      shortName: isGroup ? '新建集團' : isCorp ? '新營造' : '老闆私帳',
      entityType: type,
      parentId: isGroup ? undefined : (groupEntity ? groupEntity.id : 'GRP-01'),
      taxId: isCorp ? '88991234' : undefined,
      nationalId: isPersonal ? 'A123456789' : undefined,
      representative: isCorp ? '負責人姓名' : isGroup ? '創辦人兼董事長' : '老闆本人',
      keyPersonnel: isCorp 
        ? [{ id: `kp-${Date.now()}`, title: '董事長', name: '林負責人', phone: '0910-123456' }] 
        : isGroup 
        ? [{ id: `kp-${Date.now()}`, title: '集團總裁', name: '創辦人', phone: '0910-123456' }] 
        : [],
      documentPrefix: isGroup ? 'GRP' : isCorp ? 'NEW' : 'PS',
      phones: isCorp ? [{ id: 'p1', type: '市話', number: '02-' }] : [],
      email: isCorp ? 'service@company.com.tw' : '',
      registeredAddress: isCorp ? '台北市' : '',
      contactAddress: isCorp ? '台北市' : '',
      capitalAmount: isCorp ? 30000000 : isGroup ? 100000000 : 0,
      baseCurrency: 'TWD',
    };

    try {
      saveCompany(newEntity as any, currentUser?.fullName || '系統管理員');
      onDataChanged();
      setActiveCompanyId(newId);
      onSelectCompany(newId);
      showToast(`✅ 已建立全新【${isGroup ? '集團母體' : isCorp ? '公司法人' : '個人實體 (老闆私帳)'}】！`);
    } catch (e) {
      showToast(`❌ 建立失敗: ${(e as Error).message}`);
    }
  };

  // 儲存表單
  const handleSave = () => {
    if (!formData.name?.trim()) {
      showToast('❌ 請輸入主體完整名稱');
      return;
    }
    if (!formData.companyCode?.trim()) {
      showToast('❌ 請輸入主體識別代碼');
      return;
    }

    // 公司法人必須驗證統編
    if (formData.entityType === 'CORPORATION') {
      const v = validateTaiwanTaxId(formData.taxId || '');
      if (!v.valid) {
        showToast(`❌ 統編檢核未通過: ${v.reason}`);
        return;
      }
    }

    // 個人實體若有輸入身分證則必須驗證防呆
    if (formData.entityType === 'PERSONAL' && formData.nationalId) {
      const nv = validateTaiwanNationalId(formData.nationalId);
      if (!nv.valid) {
        showToast(`❌ 身分證檢核未通過: ${nv.reason}`);
        return;
      }
    }

    // Email 格式防呆
    if (formData.email && !validateEmail(formData.email)) {
      showToast('❌ 電子信箱格式不正確，請確認');
      return;
    }

    try {
      const payload: Partial<Company> & { id: string; name: string; companyCode: string } = {
        id: formData.id!,
        companyCode: formData.companyCode.trim().toUpperCase(),
        name: formData.name.trim(),
        shortName: formData.shortName?.trim(),
        entityType: formData.entityType || 'CORPORATION',
        parentId: formData.entityType === 'GROUP' ? undefined : (formData.parentId || undefined),
        taxId: formData.entityType === 'CORPORATION' ? formData.taxId?.trim() : undefined,
        nationalId: formData.entityType === 'PERSONAL' ? formData.nationalId?.trim().toUpperCase() : undefined,
        representative: formData.entityType !== 'PERSONAL' ? formData.representative?.trim() : undefined,
        keyPersonnel: formData.entityType !== 'PERSONAL' ? keyPersonnel : [],
        documentPrefix: formData.documentPrefix ? formData.documentPrefix.trim().toUpperCase() : undefined,
        phones,
        email: formData.email?.trim(),
        registeredAddress: formData.entityType === 'CORPORATION' ? formData.registeredAddress?.trim() : undefined,
        contactAddress: formData.entityType === 'CORPORATION' ? formData.contactAddress?.trim() : undefined,
        capitalAmount: formData.entityType !== 'PERSONAL' ? (Number(formData.capitalAmount) || 0) : 0,
        baseCurrency: formData.baseCurrency || 'TWD',
      };

      saveCompany(payload, currentUser?.fullName || '系統管理員');
      onDataChanged();
      showToast('💾 公司基本資料已成功儲存至 SQLite 資料庫！');
    } catch (e) {
      showToast(`❌ 儲存失敗: ${(e as Error).message}`);
    }
  };

  // 開啟安全刪除確認 Modal
  const handleOpenDeleteModal = () => {
    setDeleteErrorNote(null);
    setIsDeleteModalOpen(true);
  };

  // 確定執行刪除
  const handleConfirmDelete = () => {
    if (!formData.id) return;
    try {
      deleteCompany(formData.id, currentUser?.fullName || '系統管理員');
      onDataChanged();
      setIsDeleteModalOpen(false);
      const remaining = companies.filter(c => c.id !== formData.id);
      setActiveCompanyId(remaining[0]?.id || 'COMP-01');
      onSelectCompany(remaining[0]?.id || 'COMP-01');
      showToast('🗑️ 已安全移除該實體');
    } catch (e) {
      setDeleteErrorNote((e as Error).message);
    }
  };

  // 篩選實體清單
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      if (typeFilter !== 'ALL' && c.entityType !== typeFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = c.name.toLowerCase().includes(term);
        const matchCode = c.companyCode.toLowerCase().includes(term);
        const matchTax = c.taxId?.toLowerCase().includes(term);
        const matchNat = c.nationalId?.toLowerCase().includes(term);
        if (!matchName && !matchCode && !matchTax && !matchNat) return false;
      }
      return true;
    });
  }, [companies, typeFilter, searchTerm]);

  // 取得當前實體之上層母體
  const parentGroup = companies.find(c => c.id === formData.parentId);

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* 1. 集團維度導航列 (Group & Entities Master Navigator)      */}
      {/* ======================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
        {/* 頂部標題與快速操作按鈕 */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold shadow-2xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span>集團多法人實體管理架構</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                  全集團共 {companies.length} 個實體
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                拉取集團報表時自動合併下屬各公司與個人帳戶損益；亦可獨立拉取單一公司分析
              </div>
            </div>
          </div>

          {/* 快捷新增按鈕組 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleCreateNew('CORPORATION')}
              className="px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新增公司法人</span>
            </button>
            <button
              onClick={() => handleCreateNew('PERSONAL')}
              title="新增以老闆個人為名的內部調度帳戶 (驗證身分證，免填公司工商登記)"
              className="px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>新增個人帳戶 (老闆私帳)</span>
            </button>
            <button
              onClick={() => handleCreateNew('GROUP')}
              title="新增事業集團母體 (控股與合併報表維度)"
              className="px-2.5 py-1.5 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-colors border border-slate-300"
            >
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>新增集團母體</span>
            </button>
          </div>
        </div>

        {/* 搜尋過濾工具列 */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          {/* 分類標籤切換 */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-lg border border-slate-200 text-xs w-full sm:w-auto">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                typeFilter === 'ALL'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              全部實體 ({companies.length})
            </button>
            <button
              onClick={() => setTypeFilter('GROUP')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                typeFilter === 'GROUP'
                  ? 'bg-white text-purple-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              集團母體 ({companies.filter(c => c.entityType === 'GROUP').length})
            </button>
            <button
              onClick={() => setTypeFilter('CORPORATION')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                typeFilter === 'CORPORATION'
                  ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              公司法人 ({companies.filter(c => c.entityType === 'CORPORATION').length})
            </button>
            <button
              onClick={() => setTypeFilter('PERSONAL')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                typeFilter === 'PERSONAL'
                  ? 'bg-white text-amber-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              老闆私帳 ({companies.filter(c => c.entityType === 'PERSONAL').length})
            </button>
          </div>

          {/* 搜尋框 */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋代碼、名稱、統編、身分證..."
              className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* 實體切換卡片清單 (母子樹狀架構) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {filteredCompanies.map((c) => {
            const isSelected = c.id === activeCompanyId;
            const isGroup = c.entityType === 'GROUP';
            const isPersonal = c.entityType === 'PERSONAL';
            const cParent = companies.find(p => p.id === c.parentId);

            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCompanyId(c.id);
                  onSelectCompany(c.id);
                }}
                className={`p-3.5 rounded-lg border text-left transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? isPersonal
                      ? 'bg-amber-50/80 border-amber-400 shadow-xs ring-2 ring-amber-400/40'
                      : isGroup
                      ? 'bg-purple-50/80 border-purple-400 shadow-xs ring-2 ring-purple-400/40'
                      : 'bg-indigo-50/80 border-indigo-400 shadow-xs ring-2 ring-indigo-400/40'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-mono text-[11px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {c.companyCode}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isGroup
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : isPersonal
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isGroup ? '集團母體' : isPersonal ? '老闆私帳' : '公司法人'}
                    </span>
                  </div>

                  <div className="font-bold text-xs text-slate-900 truncate mt-2">
                    {c.name}
                  </div>

                  {cParent && (
                    <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
                      <GitBranch className="w-3 h-3 text-indigo-500 shrink-0" />
                      <span className="truncate">隸屬: {cParent.shortName || cParent.name}</span>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="truncate">
                    {isPersonal
                      ? c.nationalId ? `身分證: ${c.nationalId.slice(0, 4)}***` : '身分證: 未填'
                      : c.taxId ? `統編: ${c.taxId}` : '集團控股'}
                  </span>
                  {c.documentPrefix && (
                    <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 shrink-0">
                      {c.documentPrefix}-
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. 當前選定實體編輯表單 (Master Entity Detail Editor)     */}
      {/* ======================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* 表單頂部工具列 */}
        <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100/70 px-2.5 py-1 rounded border border-indigo-200">
              {formData.companyCode || 'COMP'}
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>{formData.name || '未命名實體'}</span>
                <span className="text-[11px] font-normal text-slate-400 font-mono">
                  [版本: v{formData.version || 1}]
                </span>
                {formData.shortName && (
                  <span className="text-xs font-semibold text-slate-600 bg-slate-200/60 px-2 py-0.5 rounded">
                    簡稱: {formData.shortName}
                  </span>
                )}
              </h2>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {formData.entityType === 'PERSONAL'
                  ? '個人實體調度帳戶，已自動收折免填公司工商登記等欄位，並驗證台灣身分證'
                  : formData.entityType === 'GROUP'
                  ? '集團最高控股彙總層，支援跨子公司合併報表與資金調撥'
                  : '正式對外營業公司法人，具備 8 碼統編防呆、重要人物組織與單據前綴'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenDeleteModal}
              className="px-3 py-1.5 rounded-md text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>刪除實體</span>
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-md text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>儲存基本資料</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 text-xs">
          {/* 區塊 A：主體屬性與母子集團階層 */}
          <div className="space-y-3">
            <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>主體屬性與母子集團階層架構</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  主體類型 (entityType) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.entityType}
                  onChange={(e) => setFormData(prev => ({ ...prev, entityType: e.target.value as any }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="CORPORATION">公司法人 (需驗證 8 碼統編、重要人物架構、登記地址)</option>
                  <option value="PERSONAL">個人實體 / 老闆私帳 (驗證身分證，內部資金調度專用)</option>
                  <option value="GROUP">集團母體 (Conglomerate Group 控股與彙總層)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  所屬集團母體 (parentId)
                </label>
                <select
                  disabled={formData.entityType === 'GROUP'}
                  value={formData.parentId || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, parentId: e.target.value }))}
                  className={`w-full border rounded-md px-2.5 py-1.5 text-slate-800 outline-none ${
                    formData.entityType === 'GROUP'
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  <option value="">-- 無 (此實體為頂層集團本體) --</option>
                  {companies.filter(c => c.entityType === 'GROUP' && c.id !== formData.id).map(g => (
                    <option key={g.id} value={g.id}>
                      [{g.companyCode}] {g.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  掛在集團下方後，未來拉取集團報表會自動合併本實體數據。
                </p>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  主體識別代碼 (companyCode) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.companyCode || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyCode: e.target.value.toUpperCase() }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 font-mono text-slate-800 outline-none uppercase font-bold"
                  placeholder="如: CMP-TW01, BOSS-01"
                />
              </div>
            </div>
          </div>

          {/* 區塊 B：名稱、表單前綴與幣別 */}
          <div className="space-y-3">
            <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>名稱與 ERP 單據印製前綴</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-slate-600 font-semibold mb-1">
                  主體完整名稱 (name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 font-bold text-slate-800 outline-none"
                  placeholder="如: 台灣大巨營造工程股份有限公司 或 林董私人調度資金戶"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  顯示簡稱 (shortName)
                </label>
                <input
                  type="text"
                  value={formData.shortName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, shortName: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 outline-none"
                  placeholder="如: 大巨營造、林董"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  單據前綴編號 (documentPrefix)
                </label>
                <input
                  type="text"
                  value={formData.documentPrefix || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, documentPrefix: e.target.value.toUpperCase() }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 font-mono font-bold text-indigo-700 outline-none uppercase"
                  placeholder="如: DJ, HD, BOSS"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  該公司後續開立採購單 ({formData.documentPrefix || 'PO'}-PO-...)、估驗單跳號之開頭
                </p>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  本位幣別 (baseCurrency)
                </label>
                <select
                  value={formData.baseCurrency || 'TWD'}
                  onChange={(e) => setFormData(prev => ({ ...prev, baseCurrency: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 outline-none"
                >
                  <option value="TWD">TWD 新台幣</option>
                  <option value="USD">USD 美元</option>
                  <option value="EUR">EUR 歐元</option>
                  <option value="JPY">JPY 日圓</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  電子信箱 (email)
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 outline-none"
                  placeholder="service@company.com.tw"
                />
              </div>
            </div>
          </div>

          {/* 區塊 C：若為個人實體，顯示身分證驗證，其餘法定欄位自動收折 */}
          {formData.entityType === 'PERSONAL' ? (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="font-bold text-amber-900 text-xs flex items-center justify-between pb-2 border-b border-amber-200">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <span>個人實體身分驗證 (台灣身分證加權防呆)</span>
                </div>
                {formData.nationalId && (
                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                      nationalIdFeedback.valid
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                        : 'bg-rose-50 text-rose-700 border border-rose-300'
                    }`}
                  >
                    {nationalIdFeedback.valid ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{nationalIdFeedback.reason}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        <span>{nationalIdFeedback.reason}</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    台灣身分證字號 (首字英文字母 + 9 碼數字) <span className="text-amber-600 font-normal">(選填/防呆)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={formData.nationalId || ''}
                    onChange={(e) => handleNationalIdChange(e.target.value)}
                    className={`w-full bg-slate-50 border rounded-md px-2.5 py-1.5 font-mono font-bold text-slate-800 outline-none uppercase ${
                      formData.nationalId && !nationalIdFeedback.valid
                        ? 'border-rose-400 focus:ring-1 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-1 focus:ring-amber-500'
                    }`}
                    placeholder="如: A123456789"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    系統自動以縣市代碼加權模數 10 進行即時驗證與性別檢查。
                  </p>
                </div>
              </div>

              {/* 智慧收折提示區 */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-800">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold">公司法定欄位已自動收折免填</span>：
                  統一編號、工商登記地址、工務總部地址、登記資本額及組織代表人物已隱藏。本實體僅作為內部股東借貸、墊款調度及專案損益分流核算。
                </div>
              </div>
            </div>
          ) : (
            /* 區塊 D：公司法人 / 集團 法定資質與重要人物組織架構 */
            <div className="space-y-6 pt-2 border-t border-slate-100">
              <div className="space-y-3">
                <div className="font-bold text-slate-800 text-xs flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>公司法定資質 (具備台灣 8 碼統編加權防呆)</span>
                  </div>
                  {formData.taxId && formData.entityType === 'CORPORATION' && (
                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                        taxIdFeedback.valid
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                          : 'bg-rose-50 text-rose-700 border border-rose-300'
                      }`}
                    >
                      {taxIdFeedback.valid ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{taxIdFeedback.reason}</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3 text-rose-600" />
                          <span>{taxIdFeedback.reason}</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {formData.entityType === 'CORPORATION' && (
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        法人統一編號 (8 碼) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={8}
                        value={formData.taxId || ''}
                        onChange={(e) => handleTaxIdChange(e.target.value)}
                        className={`w-full bg-slate-50 border rounded-md px-2.5 py-1.5 font-mono font-bold text-slate-800 outline-none ${
                          formData.taxId && !taxIdFeedback.valid
                            ? 'border-rose-400 focus:ring-1 focus:ring-rose-500'
                            : 'border-slate-300 focus:ring-1 focus:ring-indigo-500'
                        }`}
                        placeholder="如: 88991234"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      公司負責人 / 法定代表 (representative)
                    </label>
                    <input
                      type="text"
                      value={formData.representative || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, representative: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 outline-none"
                      placeholder="如: 林大巨 董事長"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      登記資本額 (NTD)
                    </label>
                    <input
                      type="number"
                      value={formData.capitalAmount || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, capitalAmount: Number(e.target.value) }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 font-mono text-slate-800 outline-none"
                      placeholder="150000000"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-slate-600 font-semibold mb-1">
                      官方登記地址 (registeredAddress)
                    </label>
                    <input
                      type="text"
                      value={formData.registeredAddress || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, registeredAddress: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 outline-none"
                      placeholder="工商登記地址，如: 台北市信義區經貿二路100號"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      通訊 / 工務聯絡地址 (contactAddress)
                    </label>
                    <input
                      type="text"
                      value={formData.contactAddress || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, contactAddress: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 outline-none"
                      placeholder="實際營運工務辦公室地址"
                    />
                  </div>
                </div>
              </div>

              {/* 區塊 E：公司組織架構重要人物清單 (keyPersonnel) */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Crown className="w-3.5 h-3.5 text-amber-600" />
                    <span>組織架構與重要人物清單 (keyPersonnel)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddKeyPerson}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增重要人物</span>
                  </button>
                </div>

                {keyPersonnel.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-lg text-center text-slate-400 text-xs">
                    尚未維護重要決策人物，點選上方「新增重要人物」加入（例如：董事長、總經理、財務長、工務特助）
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {keyPersonnel.map((person) => (
                      <div
                        key={person.id}
                        className="p-2.5 bg-slate-50 rounded-md border border-slate-200 flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={person.title}
                            onChange={(e) => handleUpdateKeyPerson(person.id, 'title', e.target.value)}
                            placeholder="職稱 (如: 總經理)"
                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 outline-none"
                          />
                          <input
                            type="text"
                            value={person.name}
                            onChange={(e) => handleUpdateKeyPerson(person.id, 'name', e.target.value)}
                            placeholder="姓名"
                            className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-900 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveKeyPerson(person.id)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={person.phone || ''}
                          onChange={(e) => handleUpdateKeyPerson(person.id, 'phone', e.target.value)}
                          placeholder="聯絡電話 / 行動"
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs text-slate-700 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 區塊 F：動態電話與傳真列表 (phones) */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Phone className="w-3.5 h-3.5 text-indigo-600" />
                <span>聯絡電話與傳真列表 (可新增多組區別)</span>
              </div>
              <button
                type="button"
                onClick={() => handleAddPhone('市話')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>新增電話項目</span>
              </button>
            </div>

            {phones.length === 0 ? (
              <div className="p-3 bg-slate-50 rounded-lg text-center text-slate-400 text-xs">
                尚未設定電話，點選上方「新增電話項目」開始維護
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {phones.map((phone) => (
                  <div
                    key={phone.id}
                    className="p-2 bg-slate-50 rounded-md border border-slate-200 flex items-center gap-2"
                  >
                    <select
                      value={phone.type}
                      onChange={(e) => handleUpdatePhone(phone.id, 'type', e.target.value as any)}
                      className="bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-bold text-slate-700 outline-none shrink-0"
                    >
                      <option value="市話">市話總機</option>
                      <option value="傳真">傳真專線</option>
                      <option value="工務專線">工務專線</option>
                      <option value="行動電話">主管行動</option>
                      <option value="緊急聯絡">緊急值勤</option>
                    </select>

                    <input
                      type="text"
                      value={phone.number}
                      onChange={(e) => handleUpdatePhone(phone.id, 'number', e.target.value)}
                      placeholder="號碼 (含區碼)"
                      className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs text-slate-800 outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => handleRemovePhone(phone.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. 內控防呆確認 Modal (嚴格禁止原生 window.confirm)         */}
      {/* ======================================================== */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            {/* Modal 頂部警告外觀 */}
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900">
                  確認安全移除實體？
                </h3>
                <p className="text-xs text-rose-700">
                  營造內控防呆程序檢核
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">主體代碼:</span>
                  <span className="font-mono font-bold text-slate-800">{formData.companyCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">主體名稱:</span>
                  <span className="font-bold text-slate-900">{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">實體屬性:</span>
                  <span className="font-semibold text-slate-800">
                    {formData.entityType === 'GROUP' ? '集團母體' : formData.entityType === 'PERSONAL' ? '老闆私帳' : '公司法人'}
                  </span>
                </div>
              </div>

              {deleteErrorNote && (
                <div className="p-3 bg-rose-100/80 border border-rose-300 rounded-lg text-rose-800 font-semibold text-xs leading-relaxed flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{deleteErrorNote}</span>
                </div>
              )}

              <p className="text-slate-600 leading-relaxed">
                若該實體名下尚有「進行中的專案工程」或「所屬子公司」，系統防弊內控將主動阻擋刪除，以防資料孤島。
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-200/70 border border-slate-300 transition-colors"
              >
                取消返回
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-md text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-2xs"
              >
                確認安全刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 浮動提示 Toast */}
      {toastNote && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-xl z-50 animate-in fade-in flex items-center gap-2">
          <span>{toastNote}</span>
        </div>
      )}
    </div>
  );
};
