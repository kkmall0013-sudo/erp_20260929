import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Company, PhoneItem, KeyPerson, CompanyBankAccount } from '../types/erp';
import {
  saveCompany,
  deleteCompany,
  getAllCompanyBankAccounts,
  deleteCompanyBankAccount
} from '../db/sqlite';
import { useAuth } from '../context/AuthContext';
import {
  validateTaiwanTaxId,
  validateTaiwanNationalId,
  validateEmail,
  ValidationResult
} from '../utils/taiwanValidation';
import { parseTaiwanAddress, normalizeTaiwanCity } from '../utils/taiwanPostalCodes';
import { CompanyHierarchyGrid, CompanyEntityFilter } from './settings/CompanyHierarchyGrid';
import { CompanyEntityFormPanel } from './settings/CompanyEntityFormPanel';
import { CompanyBankAccountModal } from './settings/CompanyBankAccountModal';
import { ConfirmDialogModal } from './widgets/ConfirmDialogModal';

interface CompanySettingsWorkspaceProps {
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onDataChanged: () => void;
}

export const CompanySettingsWorkspace: React.FC<CompanySettingsWorkspaceProps> = ({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onDataChanged
}) => {
  const { currentUser, isSuperadmin, isBoss, can, reloadAuth } = useAuth();
  const canWriteCompany = can('COMPANIES', 'write');

  const isCompanyAllowed = (compId: string) => {
    if (isSuperadmin || isBoss) return true;
    if (currentUser?.canManageAllCompanies) return true;
    const allowed =
      currentUser?.allowedCompanies && currentUser.allowedCompanies.length > 0
        ? currentUser.allowedCompanies
        : ['COMP-01'];
    return allowed.includes(compId);
  };

  const [activeCompanyId, setActiveCompanyId] = useState<string>(
    selectedCompanyId || companies[0]?.id || 'COMP-01'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<CompanyEntityFilter>('ALL');

  const [formData, setFormData] = useState<Partial<Company>>({});
  const [phones, setPhones] = useState<PhoneItem[]>([]);
  const [keyPersonnel, setKeyPersonnel] = useState<KeyPerson[]>([]);

  const [taxIdFeedback, setTaxIdFeedback] = useState<ValidationResult>({ isValid: true, message: '' });
  const [nationalIdFeedback, setNationalIdFeedback] = useState<ValidationResult>({ isValid: true, message: '' });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteErrorNote, setDeleteErrorNote] = useState<string | null>(null);
  const [toastNote, setToastNote] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastNote(msg);
    setTimeout(() => setToastNote(null), 3200);
  };

  // 本公司出款銀行專戶狀態
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([]);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankInitialData, setBankInitialData] = useState<Partial<CompanyBankAccount>>({
    companyId: activeCompanyId
  });
  const [bankToDelete, setBankToDelete] = useState<CompanyBankAccount | null>(null);

  const targetCompany = companies.find(c => c.id === activeCompanyId) || companies[0];

  const loadCompanyBankAccounts = () => {
    try {
      const allBanks = getAllCompanyBankAccounts();
      setCompanyBankAccounts(allBanks.filter(b => b.companyId === activeCompanyId));
    } catch (_) {}
  };

  useEffect(() => {
    loadCompanyBankAccounts();
  }, [activeCompanyId]);

  useEffect(() => {
    if (targetCompany) {
      const hasRegStruct = Boolean(
        targetCompany.registeredPostalCode ||
          targetCompany.registeredCity ||
          targetCompany.registeredDistrict ||
          targetCompany.registeredStreetAddress !== undefined
      );
      const parsedReg =
        !hasRegStruct && targetCompany.registeredAddress
          ? parseTaiwanAddress(targetCompany.registeredAddress)
          : {};

      const hasContactStruct = Boolean(
        targetCompany.contactPostalCode ||
          targetCompany.contactCity ||
          targetCompany.contactDistrict ||
          targetCompany.contactStreetAddress !== undefined
      );
      const parsedContact =
        !hasContactStruct && targetCompany.contactAddress
          ? parseTaiwanAddress(targetCompany.contactAddress)
          : {};

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
        registeredPostalCode: hasRegStruct
          ? targetCompany.registeredPostalCode || ''
          : parsedReg.postalCode || '',
        registeredCity: hasRegStruct
          ? normalizeTaiwanCity(targetCompany.registeredCity || '')
          : parsedReg.city
          ? normalizeTaiwanCity(parsedReg.city)
          : '',
        registeredDistrict: hasRegStruct
          ? targetCompany.registeredDistrict || ''
          : parsedReg.district || '',
        registeredStreetAddress: hasRegStruct
          ? targetCompany.registeredStreetAddress || ''
          : parsedReg.remaining !== undefined
          ? parsedReg.remaining
          : parsedReg.city
          ? ''
          : targetCompany.registeredAddress || '',
        registeredAddressHistory: targetCompany.registeredAddressHistory || [],
        contactAddress: targetCompany.contactAddress || '',
        contactPostalCode: hasContactStruct
          ? targetCompany.contactPostalCode || ''
          : parsedContact.postalCode || '',
        contactCity: hasContactStruct
          ? normalizeTaiwanCity(targetCompany.contactCity || '')
          : parsedContact.city
          ? normalizeTaiwanCity(parsedContact.city)
          : '',
        contactDistrict: hasContactStruct
          ? targetCompany.contactDistrict || ''
          : parsedContact.district || '',
        contactStreetAddress: hasContactStruct
          ? targetCompany.contactStreetAddress || ''
          : parsedContact.remaining !== undefined
          ? parsedContact.remaining
          : parsedContact.city
          ? ''
          : targetCompany.contactAddress || '',
        contactAddressHistory: targetCompany.contactAddressHistory || [],
        capitalAmount: targetCompany.capitalAmount || 0,
        baseCurrency: targetCompany.baseCurrency || 'TWD',
        paymentScheduleDays: targetCompany.paymentScheduleDays || '',
        version: targetCompany.version,
        updatedAt: targetCompany.updatedAt
      });
      setPhones(targetCompany.phones || []);
      setKeyPersonnel(targetCompany.keyPersonnel || []);

      if (targetCompany.entityType === 'CORPORATION' && targetCompany.taxId) {
        setTaxIdFeedback(validateTaiwanTaxId(targetCompany.taxId));
      } else {
        setTaxIdFeedback({ isValid: true, message: '' });
      }

      if (targetCompany.entityType === 'PERSONAL' && targetCompany.nationalId) {
        setNationalIdFeedback(validateTaiwanNationalId(targetCompany.nationalId));
      } else {
        setNationalIdFeedback({ isValid: true, message: '' });
      }
    }
  }, [targetCompany, activeCompanyId]);

  const handleSelectEntity = (c: Company) => {
    if (!isCompanyAllowed(c.id)) {
      showToast(
        `⛔ 【法人權限攔截】您的帳號（${currentUser?.fullName}）未獲授權存取「${c.shortName || c.name}」！`
      );
      return;
    }
    setActiveCompanyId(c.id);
    onSelectCompany(c.id);
  };

  const handleTaxIdChange = (val: string) => {
    setFormData(prev => ({ ...prev, taxId: val }));
    if (formData.entityType === 'CORPORATION') {
      if (val.length === 8) {
        setTaxIdFeedback(validateTaiwanTaxId(val));
      } else if (val.length > 0) {
        setTaxIdFeedback({ isValid: false, message: `已輸入 ${val.length}/8 碼` });
      } else {
        setTaxIdFeedback({ isValid: false, message: '公司法人必須填寫統一編號' });
      }
    } else {
      setTaxIdFeedback({ isValid: true, message: '' });
    }
  };

  const handleNationalIdChange = (val: string) => {
    const upperVal = val.toUpperCase();
    setFormData(prev => ({ ...prev, nationalId: upperVal }));
    if (formData.entityType === 'PERSONAL') {
      if (upperVal.length === 10) {
        setNationalIdFeedback(validateTaiwanNationalId(upperVal));
      } else if (upperVal.length > 0) {
        setNationalIdFeedback({ isValid: false, message: `已輸入 ${upperVal.length}/10 碼` });
      } else {
        setNationalIdFeedback({ isValid: true, message: '' });
      }
    }
  };

  const handleAddPhone = (type: PhoneItem['type'] = '市話') => {
    setPhones(prev => [...prev, { id: `P-${Date.now()}`, type, number: '' }]);
  };

  const handleUpdatePhone = (id: string, field: 'type' | 'number', value: string) => {
    setPhones(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleRemovePhone = (id: string) => {
    setPhones(prev => prev.filter(p => p.id !== id));
  };

  const handleAddKeyPerson = () => {
    setKeyPersonnel(prev => [
      ...prev,
      { id: `KP-${Date.now()}`, title: '總經理', name: '', phone: '' }
    ]);
  };

  const handleUpdateKeyPerson = (id: string, field: keyof KeyPerson, value: string) => {
    setKeyPersonnel(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleRemoveKeyPerson = (id: string) => {
    setKeyPersonnel(prev => prev.filter(p => p.id !== id));
  };

  const handleCreateNew = (type: 'GROUP' | 'CORPORATION' | 'PERSONAL') => {
    if (!canWriteCompany) {
      showToast(
        '⛔ 【權限攔截】您目前的身分或業務群組僅具備「公司法人組織」之唯讀權限，無法新增實體！（可於權限矩陣開啟「寫」權限後再試）'
      );
      return;
    }
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
      parentId: isGroup ? undefined : groupEntity ? groupEntity.id : 'GRP-01',
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
      registeredAddress: '',
      registeredPostalCode: '',
      registeredCity: '',
      registeredDistrict: '',
      registeredStreetAddress: '',
      registeredAddressHistory: [],
      contactAddress: '',
      contactPostalCode: '',
      contactCity: '',
      contactDistrict: '',
      contactStreetAddress: '',
      contactAddressHistory: [],
      capitalAmount: isCorp ? 30000000 : isGroup ? 100000000 : 0,
      baseCurrency: 'TWD',
      paymentScheduleDays: isCorp ? '7,17,27' : undefined
    };

    try {
      saveCompany(newEntity as any, currentUser?.fullName || '系統管理員', currentUser?.id);
      reloadAuth();
      onDataChanged();
      setActiveCompanyId(newId);
      onSelectCompany(newId);
      showToast(
        `✅ 已建立全新【${isGroup ? '集團母體' : isCorp ? '公司法人' : '個人實體 (老闆私帳)'}】！您已自動獲賦予該實體之管理維護權限。`
      );
    } catch (e) {
      showToast(`❌ 建立失敗: ${(e as Error).message}`);
    }
  };

  const handleSave = () => {
    if (!canWriteCompany) {
      showToast('⛔ 【權限攔截】您目前的業務群組未開啟「公司法人組織」之【寫入編輯 (Write)】權限，無法儲存變更！');
      return;
    }
    if (formData.id && !isCompanyAllowed(formData.id)) {
      showToast('⛔ 【法人權限攔截】您的帳號未獲授權維護此營運法人！');
      return;
    }
    if (!formData.name?.trim()) {
      showToast('❌ 請輸入主體完整名稱');
      return;
    }
    if (!formData.companyCode?.trim()) {
      showToast('❌ 請輸入主體識別代碼');
      return;
    }

    if (formData.entityType === 'CORPORATION') {
      const v = validateTaiwanTaxId(formData.taxId || '');
      if (!v.isValid) {
        showToast(`❌ 統編檢核未通過: ${v.message}`);
        return;
      }
    }

    if (formData.entityType === 'PERSONAL' && formData.nationalId) {
      const nv = validateTaiwanNationalId(formData.nationalId);
      if (!nv.isValid) {
        showToast(`❌ 身分證檢核未通過: ${nv.message}`);
        return;
      }
    }

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
        parentId: formData.entityType === 'GROUP' ? undefined : formData.parentId || undefined,
        taxId: formData.entityType === 'CORPORATION' ? formData.taxId?.trim() : undefined,
        nationalId:
          formData.entityType === 'PERSONAL' ? formData.nationalId?.trim().toUpperCase() : undefined,
        representative: formData.entityType !== 'PERSONAL' ? formData.representative?.trim() : undefined,
        keyPersonnel: formData.entityType !== 'PERSONAL' ? keyPersonnel : [],
        documentPrefix: formData.documentPrefix
          ? formData.documentPrefix.trim().toUpperCase()
          : undefined,
        phones,
        email: formData.email?.trim(),
        registeredAddress:
          formData.entityType === 'CORPORATION' ? formData.registeredAddress?.trim() : undefined,
        registeredPostalCode:
          formData.entityType === 'CORPORATION' ? formData.registeredPostalCode?.trim() : undefined,
        registeredCity:
          formData.entityType === 'CORPORATION' ? formData.registeredCity?.trim() : undefined,
        registeredDistrict:
          formData.entityType === 'CORPORATION' ? formData.registeredDistrict?.trim() : undefined,
        registeredStreetAddress:
          formData.entityType === 'CORPORATION'
            ? formData.registeredStreetAddress?.trim()
            : undefined,
        registeredAddressHistory:
          formData.entityType === 'CORPORATION'
            ? formData.registeredAddressHistory || []
            : undefined,
        contactAddress:
          formData.entityType === 'CORPORATION' ? formData.contactAddress?.trim() : undefined,
        contactPostalCode:
          formData.entityType === 'CORPORATION' ? formData.contactPostalCode?.trim() : undefined,
        contactCity:
          formData.entityType === 'CORPORATION' ? formData.contactCity?.trim() : undefined,
        contactDistrict:
          formData.entityType === 'CORPORATION' ? formData.contactDistrict?.trim() : undefined,
        contactStreetAddress:
          formData.entityType === 'CORPORATION' ? formData.contactStreetAddress?.trim() : undefined,
        contactAddressHistory:
          formData.entityType === 'CORPORATION'
            ? formData.contactAddressHistory || []
            : undefined,
        capitalAmount: formData.entityType !== 'PERSONAL' ? Number(formData.capitalAmount) || 0 : 0,
        baseCurrency: formData.baseCurrency || 'TWD',
        paymentScheduleDays: formData.paymentScheduleDays?.trim() || undefined
      };

      saveCompany(payload, currentUser?.fullName || '系統管理員', currentUser?.id);
      reloadAuth();
      onDataChanged();
      showToast('💾 公司基本資料已成功儲存至 SQLite 資料庫！');
    } catch (e) {
      showToast(`❌ 儲存失敗: ${(e as Error).message}`);
    }
  };

  const handleOpenDeleteModal = () => {
    if (!canWriteCompany) {
      showToast('⛔ 【權限攔截】您目前的業務群組未開啟「公司法人組織」之【寫入編輯 (Write)】權限，無法刪除實體！');
      return;
    }
    if (formData.id && !isCompanyAllowed(formData.id)) {
      showToast('⛔ 【法人權限攔截】您的帳號未獲授權刪除此營運法人！');
      return;
    }
    setDeleteErrorNote(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!formData.id) return;
    try {
      deleteCompany(formData.id, currentUser?.fullName || '系統管理員');
      reloadAuth();
      onDataChanged();
      setIsDeleteModalOpen(false);
      const remaining = companies.filter(c => c.id !== formData.id);
      setActiveCompanyId(remaining[0]?.id || 'COMP-01');
      onSelectCompany(remaining[0]?.id || 'COMP-01');
      showToast('🗑️ 已安全移除該實體（已轉入軟刪除救援中心，可隨時還原）');
    } catch (e) {
      setDeleteErrorNote((e as Error).message);
    }
  };

  const handleOpenAddBank = () => {
    setBankInitialData({
      companyId: activeCompanyId,
      bankCode: '004',
      bankName: '臺灣銀行',
      branchName: '營業部',
      accountNumber: '',
      accountName: targetCompany?.name || '',
      isVirtualAccount: targetCompany?.entityType === 'PERSONAL',
      status: 'ACTIVE',
      checkPrefix: 'CQ',
      nextCheckNumber: 1001,
      checkDigits: 6,
      currency: 'TWD',
      supportsCheck: true,
      supportsTransfer: true,
      paymentScheduleDays: ''
    });
    setIsBankModalOpen(true);
  };

  const handleOpenEditBank = (b: CompanyBankAccount) => {
    setBankInitialData({
      ...b,
      supportsCheck: b.supportsCheck !== false,
      supportsTransfer: b.supportsTransfer !== false,
      paymentScheduleDays: b.paymentScheduleDays || ''
    });
    setIsBankModalOpen(true);
  };

  const handleConfirmDeleteBank = () => {
    if (!bankToDelete) return;
    try {
      deleteCompanyBankAccount(bankToDelete.id, currentUser?.fullName || '系統管理員');
      showToast(`✅ 銀行帳戶【${bankToDelete.bankName} ${bankToDelete.accountNumber}】已成功刪除！`);
      setBankToDelete(null);
      loadCompanyBankAccounts();
      onDataChanged();
    } catch (e: any) {
      showToast(`❌ 刪除攔截: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <CompanyHierarchyGrid
        companies={companies}
        activeCompanyId={activeCompanyId}
        typeFilter={typeFilter}
        searchTerm={searchTerm}
        onTypeFilterChange={setTypeFilter}
        onSearchTermChange={setSearchTerm}
        onSelectCompany={handleSelectEntity}
        onCreateNew={handleCreateNew}
        isCompanyAllowed={isCompanyAllowed}
      />

      <CompanyEntityFormPanel
        companies={companies}
        formData={formData}
        setFormData={setFormData}
        phones={phones}
        keyPersonnel={keyPersonnel}
        taxIdFeedback={taxIdFeedback}
        nationalIdFeedback={nationalIdFeedback}
        companyBankAccounts={companyBankAccounts}
        canWriteCompany={canWriteCompany}
        onTaxIdChange={handleTaxIdChange}
        onNationalIdChange={handleNationalIdChange}
        onAddPhone={handleAddPhone}
        onUpdatePhone={handleUpdatePhone}
        onRemovePhone={handleRemovePhone}
        onAddKeyPerson={handleAddKeyPerson}
        onUpdateKeyPerson={handleUpdateKeyPerson}
        onRemoveKeyPerson={handleRemoveKeyPerson}
        onSave={handleSave}
        onOpenDeleteModal={handleOpenDeleteModal}
        onOpenAddBank={handleOpenAddBank}
        onOpenEditBank={handleOpenEditBank}
        onRequestDeleteBank={(b) => setBankToDelete(b)}
      />

      {/* 共用出款銀行專戶編輯視窗 */}
      <CompanyBankAccountModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        companies={companies}
        initialAccount={bankInitialData}
        lockCompanySelect
        operatorName={currentUser?.fullName || '系統管理員'}
        onSaved={(msg) => {
          showToast(msg);
          loadCompanyBankAccounts();
          onDataChanged();
        }}
        onError={(msg) => showToast(msg)}
      />

      {/* 確認刪除出款銀行專戶 */}
      <ConfirmDialogModal
        isOpen={Boolean(bankToDelete)}
        title="確認刪除出款銀行專戶？"
        variant="danger"
        confirmText="確認刪除"
        cancelText="取消"
        message={
          bankToDelete && (
            <>
              您即將刪除銀行專戶【
              <b className="text-slate-900">
                {bankToDelete.bankName} {bankToDelete.branchName || ''}
              </b>{' '}
              帳號：<span className="font-mono font-bold text-indigo-700">{bankToDelete.accountNumber}</span>
              】。
            </>
          )
        }
        extraNotice="⚠️ 安全檢核：若該帳戶已存在任何開立之付款單據，系統將自動攔截禁止物理刪除，以維護歷史紀錄。"
        onConfirm={handleConfirmDeleteBank}
        onCancel={() => setBankToDelete(null)}
      />

      {/* 確認安全軟刪除實體 */}
      <ConfirmDialogModal
        isOpen={isDeleteModalOpen}
        title="確認安全移除實體？"
        variant="danger"
        confirmText="確認安全刪除"
        cancelText="取消返回"
        message={
          <div className="space-y-2 mt-1">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-[11px]">
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
                  {formData.entityType === 'GROUP'
                    ? '集團母體'
                    : formData.entityType === 'PERSONAL'
                    ? '老闆私帳'
                    : '公司法人'}
                </span>
              </div>
            </div>
            <p>
              若該實體名下尚有「進行中的專案工程」或「所屬子公司」，系統防弊內控將主動阻擋刪除；移除後將轉入「軟刪除救援中心」安全暫存。
            </p>
          </div>
        }
        extraNotice={
          deleteErrorNote ? (
            <div className="flex items-start gap-2 text-rose-800 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{deleteErrorNote}</span>
            </div>
          ) : undefined
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

      {toastNote && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-xl z-50 animate-in fade-in flex items-center gap-2">
          <span>{toastNote}</span>
        </div>
      )}
    </div>
  );
};
