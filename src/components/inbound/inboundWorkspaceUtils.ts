// src/components/inbound/inboundWorkspaceUtils.ts
// 🧮 現場進貨簽收工作台純函式運算與 CSV 匯出輔助工具

import { InboundReceipt, Project, BusinessPartner } from '../../types/erp';
import { InternalAsset } from '../../utils/internalAssetStore';
import { exportCsvFile } from '../../utils/csvExport';

export type DateFilterMode = 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30_DAYS' | 'CUSTOM';

export interface DateRangeResult {
  start: string;
  end: string;
  label: string;
}

export interface ReceiptProjectInfo {
  id: string;
  name: string;
  code: string;
  isInternalAsset: boolean;
}

export interface VendorFilterOption {
  id: string;
  name: string;
  count: number;
}

export interface ProjectFilterOption {
  id: string;
  name: string;
  code: string;
  count: number;
}

export interface VendorHierarchyGroup {
  vendorId: string;
  vendorName: string;
  vendorTaxId: string;
  receipts: InboundReceipt[];
  subtotal: number;
  tax: number;
  grandTotal: number;
  itemsCount: number;
}

export interface InboundStats {
  totalCount: number;
  todayCount: number;
  draftCount: number;
  postedCount: number;
  subtotal: number;
  estimatedTax: number;
  grandTotal: number;
}

export function computeInboundDateRange(
  dateFilterMode: DateFilterMode,
  customStartDate: string,
  customEndDate: string
): DateRangeResult {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (dateFilterMode === 'THIS_MONTH') {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end, label: `本月 (${year}-${String(month + 1).padStart(2, '0')})` };
  }
  if (dateFilterMode === 'LAST_MONTH') {
    const lastMonthDate = new Date(year, month - 1, 1);
    const lmYear = lastMonthDate.getFullYear();
    const lmMonth = lastMonthDate.getMonth();
    const start = `${lmYear}-${String(lmMonth + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(lmYear, lmMonth + 1, 0).getDate();
    const end = `${lmYear}-${String(lmMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end, label: `上月 (${lmYear}-${String(lmMonth + 1).padStart(2, '0')})` };
  }
  if (dateFilterMode === 'LAST_30_DAYS') {
    const past = new Date(now.getTime() - 30 * 86400000);
    const start = past.toISOString().slice(0, 10);
    const end = now.toISOString().slice(0, 10);
    return { start, end, label: `近 30 天 (${start} ~ ${end})` };
  }
  if (dateFilterMode === 'CUSTOM') {
    return {
      start: customStartDate,
      end: customEndDate,
      label: `自訂區間 (${customStartDate || '起始'} ~ ${customEndDate || '迄日'})`,
    };
  }
  return { start: '', end: '', label: '全部歷史進貨日' };
}

export function resolveReceiptProjectInfo(
  r: InboundReceipt,
  projects: Project[],
  internalAssets: InternalAsset[]
): ReceiptProjectInfo {
  const snapCode = (r as any).projectCodeSnapshot;

  if (r.projectId) {
    const prj = projects.find(p => p.id === r.projectId || p.projectCode === r.projectId);
    if (prj) {
      return { id: prj.id, name: prj.name, code: prj.projectCode, isInternalAsset: false };
    }
    const asset = internalAssets.find(
      a => a.id === r.projectId || a.code === r.projectId || (a.aliases && a.aliases.includes(r.projectId))
    );
    if (asset) {
      return { id: asset.id, name: asset.name, code: asset.code, isInternalAsset: true };
    }
  }

  if (r.projectNameSnapshot || snapCode) {
    const prjBySnap = projects.find(
      p => p.name === r.projectNameSnapshot || (p.projectCode && p.projectCode === snapCode)
    );
    if (prjBySnap) {
      return { id: prjBySnap.id, name: prjBySnap.name, code: prjBySnap.projectCode, isInternalAsset: false };
    }
  }

  const assetByAlias = internalAssets.find(
    a =>
      a.id === r.projectId ||
      a.code === snapCode ||
      a.name === r.projectNameSnapshot ||
      (a.aliases &&
        (a.aliases.includes(r.projectId || '') ||
          a.aliases.includes(r.projectNameSnapshot || '') ||
          a.aliases.includes(snapCode || '')))
  );
  if (assetByAlias) {
    return { id: assetByAlias.id, name: assetByAlias.name, code: assetByAlias.code, isInternalAsset: true };
  }

  if (
    r.projectId === 'PRJ-INTERNAL' ||
    (r.projectNameSnapshot || '').includes('廠內') ||
    (r.projectNameSnapshot || '').includes('車輛')
  ) {
    return {
      id: r.projectId || 'PRJ-INTERNAL',
      name: r.projectNameSnapshot || '廠內自用 / 廠務支出',
      code: snapCode || 'INTERNAL',
      isInternalAsset: true,
    };
  }

  return {
    id: r.projectId || 'UNKNOWN',
    name: r.projectNameSnapshot || '未指定案場',
    code: snapCode || '',
    isInternalAsset: false,
  };
}

export function computeActiveVendorsInRange(
  receipts: InboundReceipt[],
  dateRange: DateRangeResult,
  vendors: BusinessPartner[]
): VendorFilterOption[] {
  const { start, end } = dateRange;
  const rangeReceipts = receipts.filter(r => {
    if (r.isDeleted) return false;
    if (start && r.receivedDate < start) return false;
    if (end && r.receivedDate > end) return false;
    return true;
  });

  const vendorMap = new Map<string, VendorFilterOption>();
  rangeReceipts.forEach(r => {
    const vId = r.vendorId || 'UNKNOWN';
    const vName = r.vendorNameSnapshot || vendors.find(v => v.id === r.vendorId)?.name || '未指定供料商';
    const existing = vendorMap.get(vId);
    if (existing) {
      existing.count += 1;
    } else {
      vendorMap.set(vId, { id: vId, name: vName, count: 1 });
    }
  });

  return Array.from(vendorMap.values()).sort((a, b) => b.count - a.count);
}

export function computeActiveProjectsInRange(
  receipts: InboundReceipt[],
  dateRange: DateRangeResult,
  getProjectInfo: (r: InboundReceipt) => ReceiptProjectInfo
): ProjectFilterOption[] {
  const { start, end } = dateRange;
  const rangeReceipts = receipts.filter(r => {
    if (r.isDeleted) return false;
    if (start && r.receivedDate < start) return false;
    if (end && r.receivedDate > end) return false;
    return true;
  });

  const projectMap = new Map<string, ProjectFilterOption>();
  rangeReceipts.forEach(r => {
    const prjInfo = getProjectInfo(r);
    const existing = projectMap.get(prjInfo.id);
    if (existing) {
      existing.count += 1;
    } else {
      projectMap.set(prjInfo.id, {
        id: prjInfo.id,
        name: prjInfo.name,
        code: prjInfo.code,
        count: 1,
      });
    }
  });

  return Array.from(projectMap.values()).sort((a, b) => b.count - a.count);
}

export function filterInboundReceipts(params: {
  receipts: InboundReceipt[];
  dateRange: DateRangeResult;
  selectedProjectId: string;
  selectedVendorId: string;
  statusFilter: string;
  searchKeyword: string;
  getProjectInfo: (r: InboundReceipt) => ReceiptProjectInfo;
}): InboundReceipt[] {
  const { receipts, dateRange, selectedProjectId, selectedVendorId, statusFilter, searchKeyword, getProjectInfo } =
    params;
  const { start, end } = dateRange;

  return receipts.filter(r => {
    if (r.isDeleted) return false;
    if (start && r.receivedDate < start) return false;
    if (end && r.receivedDate > end) return false;

    if (selectedProjectId !== 'ALL') {
      const prjInfo = getProjectInfo(r);
      if (r.projectId !== selectedProjectId && prjInfo.id !== selectedProjectId) return false;
    }

    if (selectedVendorId !== 'ALL' && r.vendorId !== selectedVendorId) return false;
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;

    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      const prjInfo = getProjectInfo(r);
      const matchNo = (r.receiptNumber || '').toLowerCase().includes(kw);
      const matchDn = (r.deliveryNoteNumber || '').toLowerCase().includes(kw);
      const matchOrder = (r.orderNumber || '').toLowerCase().includes(kw);
      const matchVendor = (r.vendorNameSnapshot || '').toLowerCase().includes(kw);
      const matchProject =
        (r.projectNameSnapshot || '').toLowerCase().includes(kw) ||
        prjInfo.name.toLowerCase().includes(kw) ||
        prjInfo.code.toLowerCase().includes(kw);
      const matchItem = (r.items || []).some(
        it =>
          (it.itemName || '').toLowerCase().includes(kw) ||
          (it.spec || '').toLowerCase().includes(kw) ||
          (it.notes || '').toLowerCase().includes(kw)
      );
      return matchNo || matchDn || matchOrder || matchVendor || matchProject || matchItem;
    }

    return true;
  });
}

export function groupReceiptsByVendor(
  filteredReceipts: InboundReceipt[],
  vendors: BusinessPartner[]
): VendorHierarchyGroup[] {
  const groupMap = new Map<string, VendorHierarchyGroup>();

  filteredReceipts.forEach(r => {
    const vId = r.vendorId || 'UNKNOWN';
    const vName = r.vendorNameSnapshot || vendors.find(v => v.id === r.vendorId)?.name || '未指定供料商';
    const vTax = r.vendorTaxIdSnapshot || vendors.find(v => v.id === r.vendorId)?.taxId || '';

    const existing = groupMap.get(vId);
    const itemsInReceipt = (r.items || []).length;
    const receiptTotal = Number(r.totalAmount) || 0;

    if (existing) {
      existing.receipts.push(r);
      existing.subtotal += receiptTotal;
      existing.tax = Math.round(existing.subtotal * 0.05);
      existing.grandTotal = existing.subtotal + existing.tax;
      existing.itemsCount += itemsInReceipt;
    } else {
      const subtotal = receiptTotal;
      const tax = Math.round(subtotal * 0.05);
      groupMap.set(vId, {
        vendorId: vId,
        vendorName: vName,
        vendorTaxId: vTax,
        receipts: [r],
        subtotal,
        tax,
        grandTotal: subtotal + tax,
        itemsCount: itemsInReceipt,
      });
    }
  });

  return Array.from(groupMap.values()).sort((a, b) => b.subtotal - a.subtotal);
}

export function computeInboundStats(filteredReceipts: InboundReceipt[]): InboundStats {
  const todayStr = new Date().toISOString().slice(0, 10);
  const totalCount = filteredReceipts.length;
  const todayCount = filteredReceipts.filter(r => r.receivedDate === todayStr).length;
  const draftCount = filteredReceipts.filter(r => r.status === 'DRAFT').length;
  const postedCount = filteredReceipts.filter(r => r.status === 'POSTED').length;
  const subtotal = filteredReceipts.reduce((acc, r) => acc + (Number(r.totalAmount) || 0), 0);
  const estimatedTax = Math.round(subtotal * 0.05);
  const grandTotal = subtotal + estimatedTax;

  return {
    totalCount,
    todayCount,
    draftCount,
    postedCount,
    subtotal,
    estimatedTax,
    grandTotal,
  };
}

export function exportInboundReceiptsCsv(
  filteredReceipts: InboundReceipt[],
  projects: Project[],
  dateRange: DateRangeResult
): void {
  const headers = [
    '序號',
    '進貨日',
    '廠商名稱',
    '個案用料(案場)',
    '專案代碼',
    '品名',
    '規格',
    '單位',
    '數量',
    '單價',
    '金額',
    '送貨單號',
    '備註',
  ];

  let seq = 1;
  const rows: (string | number)[][] = [];

  filteredReceipts.forEach(r => {
    const prj = projects.find(p => p.id === r.projectId);
    const code = prj?.projectCode || '';
    const receiptItems =
      r.items && r.items.length > 0
        ? r.items
        : [
            {
              id: 'temp',
              receiptId: r.id,
              itemName: '現場建材',
              spec: '',
              unit: '式',
              quantity: 1,
              unitPrice: r.totalAmount,
              lineTotal: r.totalAmount,
              notes: '',
            },
          ];

    receiptItems.forEach(it => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      const total = Number(it.lineTotal) || qty * price;
      rows.push([
        seq++,
        r.receivedDate,
        r.vendorNameSnapshot || '',
        r.projectNameSnapshot || '',
        code,
        it.itemName || '',
        it.spec || '',
        it.unit || '包',
        qty,
        price,
        total,
        r.deliveryNoteNumber || '',
        it.notes || r.notes || '',
      ]);
    });
  });

  exportCsvFile({
    filename: `現場進貨簽收單清冊_${dateRange.start || '全部'}_${dateRange.end || ''}.csv`,
    headers,
    rows,
  });
}
