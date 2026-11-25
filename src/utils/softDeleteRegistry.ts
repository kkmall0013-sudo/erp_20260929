import React from 'react';
import {
  Truck,
  Package,
  Building2,
  Users,
  Landmark,
  FileText
} from 'lucide-react';
import {
  InboundReceipt,
  Project,
  BusinessPartner,
  Company,
  SystemFile
} from '../types/erp';
import {
  getDeletedInboundReceipts,
  restoreInboundReceipt,
  purgeInboundReceipt,
  getDeletedProjects,
  restoreProjectRecord,
  purgeProjectRecord,
  getDeletedBusinessPartners,
  restoreBusinessPartner,
  purgeBusinessPartner,
  getDeletedCompanies,
  restoreCompanyRecord,
  purgeCompanyRecord,
  getDeletedSystemFiles,
  restoreSystemFile,
  purgeSystemFile
} from '../db/sqlite';
import {
  InternalAsset,
  getDeletedInternalAssets,
  restoreInternalAsset,
  purgeInternalAsset,
  getAssetCategoryLabel,
  getAssetCategory
} from './internalAssetStore';

export type RecoveryEntityKey = 'ASSETS' | 'RECEIPTS' | 'PROJECTS' | 'PARTNERS' | 'COMPANIES' | 'SYSTEM_FILES';

export interface RecoveryColumnDef<T> {
  header: string;
  alignRight?: boolean;
  render: (item: T) => React.ReactNode;
}

export interface SoftDeleteEntityConfig<T = any> {
  key: RecoveryEntityKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  sectionTitle: string;
  sectionHint: string;
  emptyTitle: string;
  emptySubtitle: string;
  restoreTooltip: string;
  getPurgeTitle: (item: T) => string;
  getRestoreToast: (item: T) => string;
  getDeletedList: () => T[];
  restore: (id: string, operatorName: string) => boolean;
  purge: (id: string, operatorName: string) => boolean;
  getSearchFields: (item: T) => string[];
  columns: RecoveryColumnDef<T>[];
}

export const SOFT_DELETE_REGISTRY: SoftDeleteEntityConfig<any>[] = [
  {
    key: 'ASSETS',
    label: '廠內資產',
    icon: Truck,
    sectionTitle: '被軟刪除之廠內資產清單',
    sectionHint: '一般 User 與 Admin 視圖完全不可見',
    emptyTitle: '無任何被軟刪除的廠內資產',
    emptySubtitle: '目前所有在勤與歷史淘汰資產皆正常處於現役或存檔狀態',
    restoreTooltip: '救回資產並還原至在勤使用中',
    getPurgeTitle: (ast: InternalAsset) => `廠內資產 ${ast.name} (${ast.code})`,
    getRestoreToast: (ast: InternalAsset) => `✅ 已成功救援還原廠內資產【${ast.name}】！各模組同仁已立即可見`,
    getDeletedList: () => getDeletedInternalAssets(),
    restore: (id, op) => restoreInternalAsset(id, op),
    purge: (id, op) => purgeInternalAsset(id, op),
    getSearchFields: (a: InternalAsset) => [a.name, a.code, a.deletedBy || '', a.licensePlate || ''],
    columns: [
      {
        header: '領域分類',
        render: (ast: InternalAsset) =>
          React.createElement(
            'span',
            { className: 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300' },
            getAssetCategoryLabel(getAssetCategory(ast))
          )
      },
      {
        header: '資產名稱',
        render: (ast: InternalAsset) => React.createElement('span', { className: 'font-bold text-slate-900' }, ast.name)
      },
      {
        header: '代碼',
        render: (ast: InternalAsset) => React.createElement('span', { className: 'font-mono font-semibold text-indigo-700' }, ast.code)
      },
      {
        header: '車牌/保管人/地點',
        render: (ast: InternalAsset) =>
          React.createElement(
            'span',
            { className: 'text-slate-600' },
            ast.licensePlate
              ? React.createElement('span', { className: 'font-mono font-bold text-slate-800' }, ast.licensePlate)
              : ast.locationOrAddress || '—',
            ast.driverOrCustodian ? ` (${ast.driverOrCustodian})` : ''
          )
      },
      {
        header: '刪除操作人',
        render: (ast: InternalAsset) => React.createElement('span', { className: 'font-semibold text-slate-700' }, ast.deletedBy || '系統管理員')
      },
      {
        header: '刪除時間',
        render: (ast: InternalAsset) => React.createElement('span', { className: 'font-mono text-[11px] text-slate-500' }, ast.deletedAt || ast.createdAt || '—')
      },
      {
        header: '刪除原因備註',
        render: (ast: InternalAsset) =>
          React.createElement('span', { className: 'text-slate-500 text-[11px] block max-w-xs truncate' }, ast.deleteReason || '建檔錯誤或未購入之草稿軟刪除')
      }
    ]
  },
  {
    key: 'RECEIPTS',
    label: '進貨簽收單',
    icon: Package,
    sectionTitle: '被軟刪除之現場進貨簽收單清單',
    sectionHint: '進貨管理工作台與統計報表皆已自動過濾屏蔽',
    emptyTitle: '無任何被軟刪除的進貨單據',
    emptySubtitle: '所有現場簽收草稿與已核銷單據皆處於正常流程',
    restoreTooltip: '救回進貨單據並恢復至進貨管理工作台',
    getPurgeTitle: (rec: InboundReceipt) => `進貨單據 ${rec.receiptNumber}`,
    getRestoreToast: (rec: InboundReceipt) => `✅ 已成功救援還原進貨簽收單【${rec.receiptNumber}】！`,
    getDeletedList: () => getDeletedInboundReceipts(),
    restore: (id, op) => restoreInboundReceipt(id, op),
    purge: (id, op) => purgeInboundReceipt(id, op),
    getSearchFields: (r: InboundReceipt) => [r.receiptNumber, r.vendorNameSnapshot || '', r.deliveryNoteNumber || ''],
    columns: [
      {
        header: '進貨單號',
        render: (rec: InboundReceipt) => React.createElement('span', { className: 'font-mono font-bold text-indigo-700' }, rec.receiptNumber)
      },
      {
        header: '廠商送貨單號',
        render: (rec: InboundReceipt) => React.createElement('span', { className: 'font-mono font-semibold text-slate-800' }, rec.deliveryNoteNumber || '—')
      },
      {
        header: '合作廠商',
        render: (rec: InboundReceipt) => React.createElement('span', { className: 'font-bold text-slate-900' }, rec.vendorNameSnapshot || '合作廠商')
      },
      {
        header: '歸屬案場',
        render: (rec: InboundReceipt) => React.createElement('span', { className: 'text-slate-700' }, rec.projectNameSnapshot || '工區案場')
      },
      {
        header: '進貨日期',
        render: (rec: InboundReceipt) => React.createElement('span', { className: 'font-mono text-slate-500' }, rec.receivedDate)
      },
      {
        header: '單據金額',
        alignRight: true,
        render: (rec: InboundReceipt) => React.createElement('span', { className: 'font-mono font-bold text-slate-900' }, `NT$ ${rec.totalAmount.toLocaleString()}`)
      },
      {
        header: '狀態',
        render: () =>
          React.createElement(
            'span',
            { className: 'px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300' },
            '已軟刪除'
          )
      }
    ]
  },
  {
    key: 'PROJECTS',
    label: '專案工程案場',
    icon: Building2,
    sectionTitle: '被軟刪除之專案工程案場清單',
    sectionHint: '案場工程模組與打單選單均不可見',
    emptyTitle: '無任何被軟刪除的工程案場',
    emptySubtitle: '目前所有施工中與完工案場皆受資料庫安全保護',
    restoreTooltip: '救回案場並還原至專案主檔與進貨打單選單',
    getPurgeTitle: (prj: Project) => `工程案場 ${prj.name} (${prj.projectCode})`,
    getRestoreToast: (prj: Project) => `✅ 已成功救援還原專案案場【${prj.name}】！`,
    getDeletedList: () => getDeletedProjects(),
    restore: (id, op) => restoreProjectRecord(id, op),
    purge: (id, op) => purgeProjectRecord(id, op),
    getSearchFields: (p: Project) => [p.name, p.projectCode, p.ownerName],
    columns: [
      {
        header: '案場代號',
        render: (prj: Project) => React.createElement('span', { className: 'font-mono font-bold text-indigo-700' }, prj.projectCode)
      },
      {
        header: '工程案場全銜',
        render: (prj: Project) => React.createElement('span', { className: 'font-bold text-slate-900' }, prj.name)
      },
      {
        header: '合約甲方 / 業主',
        render: (prj: Project) => React.createElement('span', { className: 'text-slate-700' }, prj.ownerName)
      },
      {
        header: '工程類型',
        render: (prj: Project) => React.createElement('span', { className: 'text-slate-500' }, prj.buildingType || '—')
      },
      {
        header: '合約金額',
        alignRight: true,
        render: (prj: Project) => React.createElement('span', { className: 'font-mono font-bold text-slate-900' }, `NT$ ${prj.contractAmount.toLocaleString()}`)
      },
      {
        header: '工期區間',
        render: (prj: Project) => React.createElement('span', { className: 'font-mono text-[11px] text-slate-500' }, `${prj.startDate} ~ ${prj.endDate}`)
      }
    ]
  },
  {
    key: 'PARTNERS',
    label: '商業夥伴',
    icon: Users,
    sectionTitle: '被軟刪除之商業夥伴清單',
    sectionHint: '商業夥伴庫與廠商通訊錄均已屏蔽',
    emptyTitle: '無任何被軟刪除的商業夥伴',
    emptySubtitle: '業主、供料商與協力廠商名冊安全完整',
    restoreTooltip: '救回商業夥伴並還原至通訊錄主檔',
    getPurgeTitle: (bp: BusinessPartner) => `商業夥伴 ${bp.name} (${bp.bpCode})`,
    getRestoreToast: (bp: BusinessPartner) => `✅ 已成功救援還原商業夥伴【${bp.name}】！`,
    getDeletedList: () => getDeletedBusinessPartners(),
    restore: (id, op) => restoreBusinessPartner(id, op),
    purge: (id, op) => purgeBusinessPartner(id, op),
    getSearchFields: (b: BusinessPartner) => [b.name, b.bpCode, b.taxId || ''],
    columns: [
      {
        header: '夥伴編號',
        render: (bp: BusinessPartner) => React.createElement('span', { className: 'font-mono font-bold text-indigo-700' }, bp.bpCode)
      },
      {
        header: '夥伴名稱',
        render: (bp: BusinessPartner) => React.createElement('span', { className: 'font-bold text-slate-900' }, bp.name)
      },
      {
        header: '統一編號',
        render: (bp: BusinessPartner) => React.createElement('span', { className: 'font-mono text-slate-700' }, bp.taxId || '—')
      },
      {
        header: '夥伴類別',
        render: (bp: BusinessPartner) =>
          React.createElement(
            'span',
            { className: 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300' },
            bp.isCustomer && bp.isVendor ? '業主/廠商雙重' : bp.isCustomer ? '合約業主' : '供貨/下包商'
          )
      },
      {
        header: '主要營業項目',
        render: (bp: BusinessPartner) => React.createElement('span', { className: 'text-slate-600' }, bp.serviceCategoryMain || '—')
      },
      {
        header: '聯絡人 / 電話',
        render: (bp: BusinessPartner) =>
          React.createElement('span', { className: 'text-slate-600' }, `${bp.contactPerson || '—'}${bp.phone ? ` (${bp.phone})` : ''}`)
      }
    ]
  },
  {
    key: 'COMPANIES',
    label: '集團與法人實體',
    icon: Landmark,
    sectionTitle: '被軟刪除之集團母體／公司法人／老闆私帳清單',
    sectionHint: '營運組織選單已隱蔽，僅 Superadmin 可救援並自動恢復存取授權',
    emptyTitle: '無任何被軟刪除的公司法人或私帳實體',
    emptySubtitle: '全集團母體、子公司與老闆私帳實體皆正常服役中',
    restoreTooltip: '救回營運實體並恢復全集團管理者權限',
    getPurgeTitle: (c: Company) => `營運實體 ${c.shortName || c.name} (${c.companyCode})`,
    getRestoreToast: (c: Company) => `✅ 已成功救援還原營運實體【${c.shortName || c.name}】！`,
    getDeletedList: () => getDeletedCompanies(),
    restore: (id, op) => restoreCompanyRecord(id, op),
    purge: (id, op) => purgeCompanyRecord(id, op),
    getSearchFields: (c: Company) => [c.name, c.shortName || '', c.companyCode, c.taxId || '', c.nationalId || ''],
    columns: [
      {
        header: '實體代碼',
        render: (c: Company) => React.createElement('span', { className: 'font-mono font-bold text-indigo-700' }, c.companyCode)
      },
      {
        header: '實體類型',
        render: (c: Company) =>
          React.createElement(
            'span',
            {
              className: `px-2 py-0.5 rounded text-[10px] font-bold border ${
                c.entityType === 'GROUP'
                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                  : c.entityType === 'PERSONAL'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`
            },
            c.entityType === 'GROUP' ? '集團母體' : c.entityType === 'PERSONAL' ? '老闆私帳' : '公司法人'
          )
      },
      {
        header: '實體全銜',
        render: (c: Company) => React.createElement('span', { className: 'font-bold text-slate-900' }, c.name)
      },
      {
        header: '統編 / 身分證',
        render: (c: Company) => React.createElement('span', { className: 'font-mono text-slate-700' }, c.taxId || c.nationalId || '—')
      },
      {
        header: '單據字軌',
        render: (c: Company) => React.createElement('span', { className: 'font-mono text-indigo-700 font-bold' }, c.documentPrefix || '—')
      },
      {
        header: '最後更新日',
        render: (c: Company) => React.createElement('span', { className: 'font-mono text-[11px] text-slate-500' }, c.updatedAt || '—')
      }
    ]
  },
  {
    key: 'SYSTEM_FILES',
    label: '金庫憑證附件',
    icon: FileText,
    sectionTitle: '被軟刪除之無紙化金庫附件清單',
    sectionHint: 'Admin 與一般同仁已完全不可見，僅 Superadmin 可救回或永久清除',
    emptyTitle: '無任何被軟刪除的金庫憑證檔案',
    emptySubtitle: '所有合約、發票與工程圖說附件皆安全保存於金庫中',
    restoreTooltip: '救回附件並還原至無紙化金庫與關聯單據',
    getPurgeTitle: (f: SystemFile) => `金庫附件 ${f.fileName}`,
    getRestoreToast: (f: SystemFile) => `✅ 已成功救援還原附件【${f.fileName}】！`,
    getDeletedList: () => getDeletedSystemFiles(),
    restore: (id, op) => restoreSystemFile(id, op),
    purge: (id, op) => purgeSystemFile(id, op),
    getSearchFields: (f: SystemFile) => [f.fileName, f.fileCategory, f.targetTable, f.targetId],
    columns: [
      {
        header: '檔案名稱',
        render: (f: SystemFile) => React.createElement('span', { className: 'font-bold text-slate-900' }, f.fileName)
      },
      {
        header: '憑證分類',
        render: (f: SystemFile) =>
          React.createElement(
            'span',
            { className: 'px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200' },
            f.fileCategory
          )
      },
      {
        header: '關聯單據',
        render: (f: SystemFile) =>
          React.createElement('span', { className: 'font-mono text-slate-700' }, `${f.targetTable} (${f.targetId})`)
      },
      {
        header: '檔案大小',
        alignRight: true,
        render: (f: SystemFile) => React.createElement('span', { className: 'font-mono text-slate-600' }, `${(f.fileSizeBytes / 1024).toFixed(1)} KB`)
      },
      {
        header: '最後異動日',
        render: (f: SystemFile) => React.createElement('span', { className: 'font-mono text-[11px] text-slate-500' }, f.updatedAt?.slice(0, 16).replace('T', ' ') || '—')
      }
    ]
  }
];
