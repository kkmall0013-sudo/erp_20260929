// src/components/projects/ProjectEditorModal.tsx
// 🏛️ 專案案場 新增/編輯 Modal (可供專案工程工作台與現場進貨管理工作台共用小程式)
// 包含專案代碼自動預覽、建造執照法定團隊、兩階層建造建物類型、合約甲方(發票開立對象)與起造人分流、預計協力廠商發包清冊

import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderGit2,
  X,
  AlertTriangle,
  HardHat,
  Info,
  Briefcase,
  Plus,
  Trash2,
  MapPin,
  DollarSign,
  Save,
  Settings
} from 'lucide-react';
import {
  Project,
  ProjectSite,
  Company,
  BusinessPartner,
  BuildingCategoryGroup,
  ProjectBudgetPartner
} from '../../types/erp';
import {
  getAllCompanies,
  getAllBusinessPartners,
  getBuildingCategoryTree,
  previewNextDocumentNumber,
  getProjectBudgetPartners
} from '../../db/sqlite';
import { validateTaiwanTaxId, validateTaiwanNationalId } from '../../utils/taiwanValidation';
import { TaiwanIdTaxValidatorWidget } from '../widgets/TaiwanIdTaxValidatorWidget';
import { PartnerSearchSelect } from '../widgets/PartnerSearchSelect';
import { FloatingSubcontractorSelect } from '../widgets/FloatingSubcontractorSelect';

export const WORK_SCOPES = [
  '統包新建工程',
  '主體結構工程',
  '室內裝修與機電消防工程',
  '鋼構與鐵皮廠房新建',
  '連續壁與擋土排樁工程',
  '建築外牆拉皮與防水工程',
  '景觀綠美化與道路附屬工程',
  '工區材料運輸與廠務支援',
  '其他客製化承攬項目'
];

export interface ProjectEditorModalProps {
  isOpen: boolean;
  initialProject?: Project | null;
  initialSite?: ProjectSite | null;
  companies?: Company[];
  partners?: BusinessPartner[];
  categoryTree?: BuildingCategoryGroup[];
  onOpenCategoryManager?: () => void;
  onClose: () => void;
  onSave: (projectData: Partial<Project>, siteData: Partial<ProjectSite>) => void;
}

export const ProjectEditorModal: React.FC<ProjectEditorModalProps> = ({
  isOpen,
  initialProject = null,
  initialSite = null,
  companies: propsCompanies,
  partners: propsPartners,
  categoryTree: propsCategoryTree,
  onOpenCategoryManager,
  onClose,
  onSave
}) => {
  const isEditing = Boolean(initialProject);

  const companies = useMemo(() => {
    return propsCompanies || getAllCompanies();
  }, [propsCompanies]);

  const partners = useMemo(() => {
    return propsPartners || getAllBusinessPartners();
  }, [propsPartners]);

  const categoryTree = useMemo(() => {
    return propsCategoryTree || getBuildingCategoryTree();
  }, [propsCategoryTree]);

  // 專案代碼：依據系統設定動態預覽，不可手動修改
  const [projectCode, setProjectCode] = useState('');

  // 專案基本資料
  const [name, setName] = useState(initialProject?.name || '');
  // 所屬法人支援未定 (空字串代表未定)
  const [companyId, setCompanyId] = useState<string>(initialProject?.companyId || '');
  const [ownerName, setOwnerName] = useState(initialProject?.ownerName || '');
  const [ownerTaxId, setOwnerTaxId] = useState(initialProject?.ownerTaxId || '');
  const [status, setStatus] = useState<Project['status']>(initialProject?.status || 'ACTIVE');
  const [buildingType, setBuildingType] = useState<string>(initialProject?.buildingType || '鐵皮倉庫');
  const [workScope, setWorkScope] = useState<string>(initialProject?.workScope || '統包新建工程');
  const [contractAmount, setContractAmount] = useState<number>(initialProject?.contractAmount || 0);
  const [budgetAmount, setBudgetAmount] = useState<number>(initialProject?.budgetAmount || 0);
  const [startDate, setStartDate] = useState(initialProject?.startDate || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initialProject?.endDate || '');

  // 工區現地與法定主體資料
  const [siteName, setSiteName] = useState(initialSite?.siteName || '');
  const [address, setAddress] = useState(initialSite?.address || '');
  const [contactPerson, setContactPerson] = useState(initialSite?.contactPerson || '');
  const [contactPhone, setContactPhone] = useState(initialSite?.contactPhone || '');
  const [permitNumber, setPermitNumber] = useState(initialSite?.permitNumber || '');
  const [developerName, setDeveloperName] = useState(initialSite?.developerName || initialProject?.ownerName || '');
  const [architect, setArchitect] = useState(initialSite?.architect || '');
  const [constructorName, setConstructorName] = useState(initialSite?.constructor || '');
  const [shopDrawingVendorId, setShopDrawingVendorId] = useState(initialSite?.shopDrawingVendorId || '');
  const [shopDrawingVendorName, setShopDrawingVendorName] = useState(initialSite?.shopDrawingVendorName || '');
  const [landNumber, setLandNumber] = useState(initialSite?.landNumber || '');

  // 預計協力廠商多筆清冊 (預估發包金額與工料項目)
  const [budgetPartners, setBudgetPartners] = useState<ProjectBudgetPartner[]>(() => {
    if (initialProject?.budgetPartners && initialProject.budgetPartners.length > 0) {
      return initialProject.budgetPartners;
    }
    if (initialProject?.id) {
      return getProjectBudgetPartners(initialProject.id);
    }
    return [];
  });

  // 錯誤提示
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 初始化專案代碼與屬性：從 document_sequence_rules 讀取既定格式動態預覽
  useEffect(() => {
    if (isEditing && initialProject) {
      setProjectCode(initialProject.projectCode);
      setBuildingType(initialProject.buildingType || '鐵皮倉庫');
      setWorkScope(initialProject.workScope || '統包新建工程');
      const loaded = initialProject.budgetPartners && initialProject.budgetPartners.length > 0
        ? initialProject.budgetPartners
        : getProjectBudgetPartners(initialProject.id);
      setBudgetPartners(loaded || []);
    } else {
      try {
        const previewCode = previewNextDocumentNumber('PRJ');
        setProjectCode(previewCode);
      } catch (err) {
        setProjectCode('PRJ-2026-自動配發');
      }
      setBudgetPartners([]);
    }
  }, [isEditing, initialProject]);

  // 同步工區名稱與起造人
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing && (!siteName || siteName === name)) {
      setSiteName(val);
    }
  };

  // 新增預計協力廠商列
  const handleAddBudgetPartner = () => {
    const newPartner: ProjectBudgetPartner = {
      id: `pbp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      projectId: initialProject?.id || '',
      partnerId: '',
      partnerName: '',
      workScope: '',
      estimatedAmount: 0,
      notes: ''
    };
    setBudgetPartners(prev => [...prev, newPartner]);
  };

  // 更新單列協力廠商
  const handleUpdateBudgetPartner = (id: string, updates: Partial<ProjectBudgetPartner>) => {
    setBudgetPartners(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  // 移除協力廠商列
  const handleRemoveBudgetPartner = (id: string) => {
    setBudgetPartners(prev => prev.filter(item => item.id !== id));
  };

  const totalEstimatedPartnerBudget = useMemo(() => {
    return budgetPartners.reduce((acc, p) => acc + (p.estimatedAmount || 0), 0);
  }, [budgetPartners]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('請填寫案場工程全銜名稱');
      return;
    }
    if (!ownerName.trim()) {
      setErrorMessage('請填寫或選擇起造人/業主單位全銜');
      return;
    }
    if (contractAmount < 0 || budgetAmount < 0) {
      setErrorMessage('金額不可為負數');
      return;
    }
    if (ownerTaxId.trim()) {
      const cleanTax = ownerTaxId.trim();
      const taxValidation = /^[A-Za-z]/.test(cleanTax)
        ? validateTaiwanNationalId(cleanTax)
        : validateTaiwanTaxId(cleanTax);
      if (!taxValidation.isValid) {
        setErrorMessage(`業主統一編號 / 身分證字號格式或加權校驗未通過：${taxValidation.message}，請核對或修正。`);
        return;
      }
    }

    // 檢查若有設定拆圖類的協力廠商，自動同動更新至 site 記錄供簡視
    const drawingPartner = budgetPartners.find(bp =>
      (bp.workScope && bp.workScope.includes('拆圖')) ||
      (bp.partnerName && bp.partnerName.includes('拆圖'))
    );
    const finalDrawingId = drawingPartner ? drawingPartner.partnerId : shopDrawingVendorId;
    const finalDrawingName = drawingPartner ? drawingPartner.partnerName : shopDrawingVendorName;

    onSave(
      {
        name: name.trim(),
        companyId: companyId.trim(),
        ownerName: ownerName.trim(),
        ownerTaxId: ownerTaxId.trim(),
        status,
        buildingType: buildingType.trim(),
        workScope: workScope.trim(),
        contractAmount,
        budgetAmount,
        startDate,
        endDate,
        budgetPartners: budgetPartners.filter(bp => bp.partnerName.trim() !== '')
      },
      {
        siteName: (siteName.trim() || name.trim()),
        address: address.trim(),
        contactPerson: contactPerson.trim(),
        contactPhone: contactPhone.trim(),
        permitNumber: permitNumber.trim(),
        developerName: (developerName.trim() || ownerName.trim()),
        architect: architect.trim(),
        constructor: constructorName.trim(),
        shopDrawingVendorId: finalDrawingId.trim(),
        shopDrawingVendorName: finalDrawingName.trim(),
        landNumber: landNumber.trim()
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Modal 頂部 Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {isEditing ? `編輯案場工程：${initialProject?.name}` : '建立新工程案場基本資料'}
              </h2>
              <p className="text-[11px] text-slate-500">
                依據系統設定格式自動配號，登錄法定起造、監造、承造、預計協力廠商發包與工區資訊
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表單內容 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 區塊 1: 專案核心基本資訊 */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5">
              <FolderGit2 className="w-4 h-4 text-indigo-600" />
              <span>一、專案案場核心資訊</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  專案代碼 <span className="text-[10px] text-indigo-600 font-bold">(系統既定格式自動配發)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={projectCode}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold text-slate-700 cursor-not-allowed select-none"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                    {isEditing ? '唯讀主鍵' : '預覽配號'}
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  案場工程全銜 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="例如：台北信義 A21 頂級商辦大樓新建工程"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  所屬簽約承攬公司法人 (乙方)
                </label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                >
                  <option value="">【尚未確定】（待後續簽約/請款時決定）</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      [{c.companyCode}] {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  工程狀態
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Project['status'])}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                >
                  <option value="ACTIVE">施工中 (ACTIVE)</option>
                  <option value="PLANNING">規劃籌備中 (PLANNING)</option>
                  <option value="COMPLETED">已完工驗收 (COMPLETED)</option>
                  <option value="LOCKED">已結算封存 (LOCKED)</option>
                </select>
              </div>
            </div>

            {/* 建造建物類型 與 工作內容 / 承攬性質 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-600">
                    建造建物類型 <span className="text-[10px] text-slate-400">(兩階層分類：選第二階小項)</span>
                  </label>
                  {onOpenCategoryManager && (
                    <button
                      type="button"
                      onClick={onOpenCategoryManager}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      title="開啟自訂管理介面，新增/管理大項與小項"
                    >
                      <Settings className="w-3 h-3" />
                      <span>管理類型項目</span>
                    </button>
                  )}
                </div>
                <select
                  value={buildingType}
                  onChange={(e) => setBuildingType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                >
                  <option value="">-- 請選擇建造建物類型 (小項) --</option>
                  {categoryTree.map(group => (
                    <optgroup key={group.id} label={`【${group.name}】`}>
                      {group.items.filter(it => it.isActive !== false).map(item => (
                        <option key={item.id} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">選單已依自訂大項分群，僅能點選小項</p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  工作內容 / 承攬性質 <span className="text-[10px] text-slate-400">(分類與搜尋用)</span>
                </label>
                <select
                  value={workScope}
                  onChange={(e) => setWorkScope(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                >
                  {WORK_SCOPES.map(ws => (
                    <option key={ws} value={ws}>{ws}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">例如：統包新建工程、主體結構工程、精裝修工程等</p>
              </div>
            </div>

            {/* 合約甲方 (發票開立買受人) 與 統一編號 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div className="sm:col-span-2">
                <PartnerSearchSelect
                  label="合約甲方全銜 / 發票買受人全銜 (開立發票抬頭 B)"
                  required
                  partnerTypeFilter="CUSTOMER"
                  placeholder="輸入關鍵字篩選或另建客戶 (如: B開發、富鼎、宏)..."
                  value={ownerName}
                  onSelect={(partner, manualName) => {
                    if (partner) {
                      setOwnerName(partner.name);
                      setOwnerTaxId(partner.taxId || '');
                      if (!developerName) {
                        setDeveloperName(partner.name);
                      }
                    } else if (manualName !== undefined) {
                      setOwnerName(manualName);
                      if (!developerName) {
                        setDeveloperName(manualName);
                      }
                    }
                  }}
                  allowQuickCreate={true}
                  quickCreateDefaultType="CUSTOMER"
                  quickCreateDefaultCategory="業主建設"
                  helperText="合約發票開立對象（甲方 B）。若與建照起造人 A 不同，下方起造人欄位可獨立指定。"
                />
              </div>

              <div>
                <TaiwanIdTaxValidatorWidget
                  label="業主統一編號 / 身分證字號"
                  type="AUTO"
                  value={ownerTaxId}
                  onChange={(val) => setOwnerTaxId(val)}
                  placeholder="公司統編 8 碼 或 自然人身分證 10 碼"
                  showExplanation={true}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 選取上方業主後自動帶入，調用通用檢驗小程式即時執行財政部模數校驗
                </p>
              </div>
            </div>
          </div>

          {/* 區塊 2: 建造執照法定團隊與預計協力廠商發包預算管理 */}
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5">
              <HardHat className="w-4 h-4 text-purple-600" />
              <span>二、建造執照法定團隊與預計協力廠商管理 (叫料預算與請款對帳連動)</span>
            </div>

            {/* 起造人 vs 發票買受人分流說明 Banner */}
            <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-slate-700">
              <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-purple-900">營造實務架構說明（起造人 A vs. 合約發票抬頭 B）：</span>
                <span className="text-slate-600">
                  當遇到「<strong>起造人 A</strong>」與「<strong>合約請款發票買受人 B</strong>」為不同主體時（例如：甲方為 B 開發營造有限公司、起造人為投資地主 A、乙方為本公司），請直接在下方起造人欄位填寫 A。系統在請款單與發票開立時將對齊甲方 B，執照與現勘工務對齊起造人 A！
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-700 flex items-center gap-1">
                    <span>執照法定起造人 (A)</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  {ownerName && developerName !== ownerName && (
                    <button
                      type="button"
                      onClick={() => setDeveloperName(ownerName)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                      title="若起造人同合約發票抬頭，點擊一鍵帶入"
                    >
                      同發票抬頭
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={developerName}
                  onChange={(e) => setDeveloperName(e.target.value)}
                  placeholder="起造人全銜 (如: 陳大為 或 地主A)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  執照法定起造人 (A)
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  設計監造人 (建築師事務所 / 結構技師)
                </label>
                <input
                  type="text"
                  value={architect}
                  onChange={(e) => setArchitect(e.target.value)}
                  placeholder="例如：大元聯合建築師事務所 / 誠業結構技師"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  承造人 (營造廠全銜 / 專任工程人員)
                </label>
                <input
                  type="text"
                  value={constructorName}
                  onChange={(e) => setConstructorName(e.target.value)}
                  placeholder="例如：大巨營造股份有限公司 / 林主任技師"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                />
              </div>
            </div>

            {/* 預計協力廠商與發包預算管理清冊 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                    <span>預計協力廠商清冊 (二階段式清單：工料類別 ➔ 公司名稱)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    清單二階段快速選定：第一階為工料類別（如鋼材、混凝土、拆圖等），第二階為公司名稱（如中鋼、東和等）。選單採獨立懸浮層，僅需公司名稱，不需填寫繁複細節！
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddBudgetPartner}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新增預計協力廠商</span>
                </button>
              </div>

              {budgetPartners.length === 0 ? (
                <div className="p-4 bg-white rounded-lg border border-dashed border-slate-300 text-center text-slate-400 text-xs">
                  尚未新增預計協力廠商。點擊上方「新增預計協力廠商」按鈕即可新增（例如：鋼材類的中鋼、東和；混凝土類的台泥等）。
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse bg-white rounded-lg border border-slate-200">
                      <thead>
                        <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                          <th className="py-2 px-3 w-60">協力廠商公司名稱 (二階懸浮選單)</th>
                          <th className="py-2 px-3 w-40">承攬工料類別 / 工項</th>
                          <th className="py-2 px-3 w-36 text-right">預估發包金額 (NT$)</th>
                          <th className="py-2 px-3">備註說明</th>
                          <th className="py-2 px-2 w-12 text-center">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {budgetPartners.map((bp) => (
                          <tr key={bp.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3">
                              <FloatingSubcontractorSelect
                                value={bp.partnerName}
                                workScope={bp.workScope}
                                placeholder="點選二階廠商 (中鋼/東和等)..."
                                onChange={(vendorName, category) => {
                                  handleUpdateBudgetPartner(bp.id, {
                                    partnerName: vendorName,
                                    workScope: bp.workScope ? bp.workScope : (category || '')
                                  });
                                }}
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={bp.workScope || ''}
                                onChange={(e) => handleUpdateBudgetPartner(bp.id, { workScope: e.target.value })}
                                placeholder="例如: 鋼材/混凝土/拆圖"
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="1000"
                                value={bp.estimatedAmount || 0}
                                onChange={(e) => handleUpdateBudgetPartner(bp.id, { estimatedAmount: Number(e.target.value) || 0 })}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono font-bold text-right text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={bp.notes || ''}
                                onChange={(e) => handleUpdateBudgetPartner(bp.id, { notes: e.target.value })}
                                placeholder="備註料號、發包階段或叫料期程"
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700 text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveBudgetPartner(bp.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="刪除此協力廠商列"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between px-2 pt-1">
                    <span className="text-[11px] text-slate-500">
                      共登錄 <span className="font-bold text-indigo-700">{budgetPartners.length}</span> 家協力廠商
                    </span>
                    <div className="text-xs font-medium text-slate-700">
                      預計發包總金額合計：
                      <span className="font-mono font-bold text-indigo-700 text-sm ml-1">
                        NT$ {totalEstimatedPartnerBudget.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 區塊 3: 工區現地與執照座落 */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5">
              <MapPin className="w-4 h-4 text-rose-500" />
              <span>三、工區現地、執照與工地主任</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  建造執照字號
                </label>
                <input
                  type="text"
                  value={permitNumber}
                  onChange={(e) => setPermitNumber(e.target.value)}
                  placeholder="例如：(114)北市建字第00234號"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  基地座落地號
                </label>
                <input
                  type="text"
                  value={landNumber}
                  onChange={(e) => setLandNumber(e.target.value)}
                  placeholder="例如：南港段一小段 123-1 地號等 3 筆"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  工區別名 / 現地名稱
                </label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="工區別名（預設同工程全銜）"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  施工現址 (工區工地地址)
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="例如：台北市南港區經貿二路 188 號"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  工地主任姓名
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="例如：林工務主任"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                工地現場聯絡電話
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="例如：0912-345-678 或 02-2788-9900"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none max-w-sm"
              />
            </div>
          </div>

          {/* 區塊 4: 財務合約與期程目標 */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>四、合約金額、目標預算與工程期程</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  合約總金額 (NT$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={contractAmount}
                  onChange={(e) => setContractAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-right"
                />
                <div className="text-[10px] text-slate-400 text-right mt-1 font-mono">
                  約 NT$ {(contractAmount / 10000).toLocaleString()} 萬元
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  目標工程預算 (NT$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-right"
                />
                <div className="text-[10px] text-slate-400 text-right mt-1 font-mono">
                  約 NT$ {(budgetAmount / 10000).toLocaleString()} 萬元
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  開工日期
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  預計完工日期
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 底部按鈕 */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isEditing ? '儲存案場修改' : '立即建立案場 (系統自動配號)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
