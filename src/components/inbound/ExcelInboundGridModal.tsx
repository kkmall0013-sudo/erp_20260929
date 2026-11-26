// src/components/inbound/ExcelInboundGridModal.tsx
// 📊 Excel 試算表極速進貨打單工作台 (Excel-Style Inbound Data Grid)
// 純粹現場進貨點收 · 支援仿 Excel 鍵盤快速連續鍵入 · 專屬 CSV 匯出匯入 · 完整多草稿暫存切換 (草稿1/草稿2/草稿轉正) · 存檔自動清空防呆

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  CheckCircle2,
  Sparkles,
  Building2,
  Package,
  Save,
  X,
  ChevronDown,
  FolderOpen,
  RotateCcw,
  FileCheck,
  Truck
} from 'lucide-react';
import { Project, BusinessPartner, Item, InboundReceipt } from '../../types/erp';
import { InternalAssetManagerModal } from '../widgets/InternalAssetManagerModal';
import { InternalAsset, loadStoredInternalAssets, saveStoredInternalAssets } from '../../utils/internalAssetStore';
import {
  ExcelGridRow,
  InboundSpeedDraft,
  CanonicalRule,
  loadStoredSpeedDrafts,
  saveStoredSpeedDrafts,
  detectSpecInItemName,
  resolveSiteOrAsset,
  validateVendorName,
  buildHistoricalItemMemory,
  parseCsvRowsToGrid,
  exportGridRowsCsv
} from './excelInboundEngine';
import { InboundDraftDrawer } from './InboundDraftDrawer';
import { InboundGridDropdown, ActiveDropdownState } from './InboundGridDropdown';
import { InboundQuickCreateModal, QuickCreateRequest } from './InboundQuickCreateModal';
import { computeFloatingPopoverCoords } from '../../utils/floatingPopover';
import { readFileAsText } from '../../utils/fileIO';
import {
  getAllProjects,
  getAllBusinessPartners,
  getAllItems,
  getAllInboundReceipts,
  createInboundReceipt,
  updateInboundReceipt,
  deleteInboundReceipt,
  postInboundReceipt
} from '../../db/sqlite';

// 向下相容匯出
export type { ExcelGridRow, InboundSpeedDraft };
export { loadStoredSpeedDrafts, saveStoredSpeedDrafts };
export * from '../../utils/internalAssetStore';

interface ExcelInboundGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  triggerToast: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  currentUserFullName?: string;
  canApprove?: boolean;
  initialDraftToLoad?: InboundReceipt | null;
  onClearInitialDraft?: () => void;
}

export const ExcelInboundGridModal: React.FC<ExcelInboundGridModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  triggerToast,
  currentUserFullName = '現場工程師',
  canApprove: _canApprove = true,
  initialDraftToLoad,
  onClearInitialDraft
}) => {
  // 主檔資料庫列表
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<BusinessPartner[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [internalAssets, setInternalAssets] = useState<InternalAsset[]>(loadStoredInternalAssets);

  // 表格全域預設設定
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [defaultDate, setDefaultDate] = useState<string>(todayStr);
  const [autoPostDirectly, setAutoPostDirectly] = useState<boolean>(true);
  const [gridRows, setGridRows] = useState<ExcelGridRow[]>([]);

  // 📋 多草稿管理系統狀態
  const [drafts, setDrafts] = useState<InboundSpeedDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftTitle, setActiveDraftTitle] = useState<string>('');
  const [isDraftDrawerOpen, setIsDraftDrawerOpen] = useState<boolean>(false);

  // ⚡ 子彈窗狀態
  const [quickCreateRequest, setQuickCreateRequest] = useState<QuickCreateRequest | null>(null);
  const [isAssetManagerOpen, setIsAssetManagerOpen] = useState<boolean>(false);
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdownState | null>(null);

  // 📥 匯入後未知歸屬批次校正看板狀態
  const [batchMappingAlert, setBatchMappingAlert] = useState<{
    unmappedName: string;
    count: number;
    sampleRowIds: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reloadMasterData = () => {
    setProjects(getAllProjects());
    setVendors(getAllBusinessPartners().filter(b => b.isVendor || b.type === 'VENDOR' || b.type === 'BOTH'));
    setItems(getAllItems());
    setInternalAssets(loadStoredInternalAssets());
  };

  const createBlankRow = (seq: number): ExcelGridRow => ({
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    seq,
    receivedDate: defaultDate,
    vendorInputName: '',
    matchedVendorId: undefined,
    vendorStatus: 'AMBIGUOUS',
    siteInputName: '',
    matchedProjectId: undefined,
    projectCodeSnapshot: undefined,
    projectStatus: 'AMBIGUOUS',
    itemName: '',
    spec: '',
    unit: '包',
    quantity: 1,
    unitPrice: 0,
    deliveryNoteNumber: '',
    notes: ''
  });

  const generateInitialRows = (count: number): ExcelGridRow[] => {
    const rows: ExcelGridRow[] = [];
    for (let i = 1; i <= count; i++) rows.push(createBlankRow(i));
    setGridRows(rows);
    return rows;
  };

  const mapReceiptToRows = (dr: InboundReceipt): ExcelGridRow[] => {
    const drItems = dr.items || [];
    if (drItems.length === 0) return [createBlankRow(1)];
    return drItems.map((it, idx) => ({
      id: `row-${dr.id}-${it.id || idx}`,
      seq: idx + 1,
      receivedDate: dr.receivedDate || defaultDate,
      vendorInputName: dr.vendorNameSnapshot || '',
      matchedVendorId: dr.vendorId,
      vendorStatus: dr.vendorId ? 'MATCHED' : 'AMBIGUOUS',
      siteInputName: dr.projectNameSnapshot || '',
      matchedProjectId: dr.projectId,
      projectCodeSnapshot: dr.projectCodeSnapshot,
      projectStatus: dr.projectId ? 'MATCHED' : 'AMBIGUOUS',
      itemName: it.itemName,
      spec: it.spec || '',
      unit: it.unit || '包',
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      deliveryNoteNumber: dr.deliveryNoteNumber || '',
      notes: it.notes || dr.notes || ''
    }));
  };

  const reloadDraftsList = () => {
    const stored = loadStoredSpeedDrafts();
    try {
      const draftReceipts = getAllInboundReceipts().filter(r => r.status === 'DRAFT');
      const mergedDrafts = [...stored];
      for (const dr of draftReceipts) {
        if (!mergedDrafts.find(d => d.dbReceiptId === dr.id || d.id === dr.id)) {
          const rows = mapReceiptToRows(dr);
          mergedDrafts.push({
            id: dr.id,
            title: `草稿: ${dr.receiptNumber} (${dr.projectNameSnapshot || '未定案場'} · ${dr.vendorNameSnapshot || '未定廠商'})`,
            createdAt: dr.createdAt,
            updatedAt: dr.updatedAt,
            defaultDate: dr.receivedDate || defaultDate,
            rows,
            totalAmount: Number(dr.totalAmount) || 0,
            itemCount: (dr.items || []).length,
            primaryProjectName: dr.projectNameSnapshot,
            primaryVendorName: dr.vendorNameSnapshot,
            dbReceiptId: dr.id
          });
        }
      }
      setDrafts(mergedDrafts);
      saveStoredSpeedDrafts(mergedDrafts);
    } catch (e) {
      console.warn('載入草稿清單警示:', e);
      setDrafts(stored);
    }
  };

  useEffect(() => {
    if (isOpen) {
      reloadMasterData();
      reloadDraftsList();
      if (initialDraftToLoad) {
        setGridRows(mapReceiptToRows(initialDraftToLoad));
        setActiveDraftId(initialDraftToLoad.id);
        setActiveDraftTitle(
          `草稿: ${initialDraftToLoad.projectNameSnapshot || '未定案場'} · ${initialDraftToLoad.vendorNameSnapshot || '未定廠商'}`
        );
        if (onClearInitialDraft) onClearInitialDraft();
      } else if (gridRows.length === 0) {
        generateInitialRows(5);
      }
    }
  }, [isOpen, initialDraftToLoad]);

  // 建立歷史進貨自適應記憶索引
  const historicalMemory = useMemo(() => {
    try {
      return buildHistoricalItemMemory(getAllInboundReceipts());
    } catch (e) {
      console.warn('建立歷史進貨自適應記憶失敗:', e);
      return { vendorMap: new Map(), globalItemSpecs: new Map() };
    }
  }, [isOpen, gridRows.length]);

  // 全局推薦下拉定位（複用共用 computeFloatingPopoverCoords）
  const openDropdown = (target: HTMLElement, rowId: string, field: 'site' | 'vendor' | 'item' | 'spec') => {
    const td = (target.closest('td') || target) as HTMLElement;
    setActiveDropdown({
      rowId,
      field,
      rect: computeFloatingPopoverCoords(td, {
        estimatedHeight: 300,
        minWidth: 360,
        viewportMargin: 16,
        gap: 4
      })
    });
  };

  // 儲存格操作
  const handleCellChange = (rowId: string, field: keyof ExcelGridRow, value: any) => {
    setGridRows(prev =>
      prev.map(row => {
        if (row.id !== rowId) return row;
        const updated = { ...row, [field]: value };
        if (field === 'siteInputName') {
          const resolved = resolveSiteOrAsset(String(value), projects, internalAssets);
          updated.projectStatus = resolved.status;
          updated.matchedProjectId =
            resolved.matchedProjectId || (resolved.status === 'INTERNAL_ASSET' ? 'PRJ-INTERNAL' : undefined);
          updated.projectCodeSnapshot = resolved.finalCode;
        }
        if (field === 'vendorInputName') {
          const check = validateVendorName(String(value), vendors);
          updated.vendorStatus = check.status;
          updated.matchedVendorId = check.matchedVen?.id;
        }
        return updated;
      })
    );
  };

  const handleNormalizeSiteCell = (rowId: string) => {
    setGridRows(prev =>
      prev.map(row => {
        if (row.id !== rowId) return row;
        const res = resolveSiteOrAsset(row.siteInputName, projects, internalAssets);
        if (res.status === 'INTERNAL_ASSET' && res.matchedAsset) {
          return {
            ...row,
            siteInputName: res.matchedAsset.name,
            matchedProjectId: 'PRJ-INTERNAL',
            projectCodeSnapshot: res.matchedAsset.code,
            projectStatus: 'INTERNAL_ASSET'
          };
        }
        if (res.status === 'MATCHED' && res.matchedProjectId) {
          return {
            ...row,
            siteInputName: res.finalName,
            matchedProjectId: res.matchedProjectId,
            projectCodeSnapshot: res.finalCode,
            projectStatus: 'MATCHED'
          };
        }
        return row;
      })
    );
  };

  const handleNormalizeVendorCell = (rowId: string) => {
    setGridRows(prev =>
      prev.map(row => {
        if (row.id !== rowId) return row;
        const res = validateVendorName(row.vendorInputName, vendors);
        if (res.status === 'MATCHED' && res.matchedVen) {
          return {
            ...row,
            vendorInputName: res.matchedVen.name,
            matchedVendorId: res.matchedVen.id,
            vendorStatus: 'MATCHED'
          };
        }
        return row;
      })
    );
  };

  // 下拉選單帶入回呼
  const handleSelectProject = (rowId: string, prj: Project) => {
    setGridRows(prev =>
      prev.map(r =>
        r.id === rowId
          ? { ...r, siteInputName: prj.name, matchedProjectId: prj.id, projectCodeSnapshot: prj.projectCode, projectStatus: 'MATCHED' }
          : r
      )
    );
    setActiveDropdown(null);
  };

  const handleSelectInternalAsset = (rowId: string, asset: InternalAsset | string) => {
    const isObj = typeof asset === 'object';
    const name = isObj ? asset.name : asset;
    const code = isObj ? asset.code : '廠內自用';
    setGridRows(prev =>
      prev.map(r =>
        r.id === rowId
          ? { ...r, siteInputName: name, matchedProjectId: 'PRJ-INTERNAL', projectCodeSnapshot: code, projectStatus: 'INTERNAL_ASSET' }
          : r
      )
    );
    setActiveDropdown(null);
  };

  const handleQuickCreateAsset = (rowId: string, inputName: string) => {
    const trimmed = inputName.trim();
    if (!trimmed) return;
    const isVeh = Boolean(trimmed.match(/[A-Z0-9]{2,4}-[A-Z0-9]{2,4}/i)) || trimmed.includes('車');
    const isStock = trimmed.includes('庫存') || trimmed.includes('備料') || trimmed.includes('倉庫');
    const newAsset: InternalAsset = {
      id: `asset-${Date.now()}`,
      code: isVeh ? `VEH-${Date.now().toString().slice(-3)}` : isStock ? `STOCK-${Date.now().toString().slice(-3)}` : `FAC-${Date.now().toString().slice(-3)}`,
      name: trimmed,
      assetCategory: isVeh ? 'MOVABLE' : isStock ? 'INVENTORY' : 'REAL_ESTATE',
      type: isVeh ? 'VEHICLE' : isStock ? 'CENTRAL_STOCK' : 'FACILITY',
      categoryLabel: isVeh ? '🚚 廠內車輛' : '🏠 廠區修繕',
      aliases: [trimmed],
      createdAt: new Date().toISOString().slice(0, 10)
    };
    const updated = [newAsset, ...internalAssets];
    setInternalAssets(updated);
    saveStoredInternalAssets(updated);
    setGridRows(prev =>
      prev.map(r =>
        r.id === rowId
          ? { ...r, siteInputName: newAsset.name, projectCodeSnapshot: newAsset.code, projectStatus: 'INTERNAL_ASSET' }
          : r
      )
    );
    triggerToast(`已就地建立「${trimmed}」並自動回填至本列！`, 'success');
    setActiveDropdown(null);
  };

  const handleBatchMapSite = (unmappedName: string, targetAsset: InternalAsset) => {
    const cleanUnmapped = unmappedName.trim();
    if (!cleanUnmapped) return;

    setGridRows(prev =>
      prev.map(r =>
        r.siteInputName.trim().toLowerCase() === cleanUnmapped.toLowerCase()
          ? { ...r, siteInputName: targetAsset.name, projectCodeSnapshot: targetAsset.code, projectStatus: 'INTERNAL_ASSET' }
          : r
      )
    );

    if (!targetAsset.aliases.map(a => a.toLowerCase()).includes(cleanUnmapped.toLowerCase())) {
      const updated = internalAssets.map(a =>
        a.id === targetAsset.id ? { ...a, aliases: [...a.aliases, cleanUnmapped] } : a
      );
      setInternalAssets(updated);
      saveStoredInternalAssets(updated);
    }

    setBatchMappingAlert(null);
    triggerToast(`⚡ 批次校正成功！已將「${cleanUnmapped}」全面對齊為【${targetAsset.name}】，系統已自動記住別名！`, 'success');
  };

  const handleSelectVendor = (rowId: string, ven: BusinessPartner) => {
    setGridRows(prev =>
      prev.map(r =>
        r.id === rowId ? { ...r, vendorInputName: ven.name, matchedVendorId: ven.id, vendorStatus: 'MATCHED' } : r
      )
    );
    setActiveDropdown(null);
  };

  const handleSelectItem = (rowId: string, itemName: string, unit?: string, unitPrice?: number, suggestedSpec?: string) => {
    setGridRows(prev =>
      prev.map(r =>
        r.id === rowId
          ? {
              ...r,
              itemName,
              unit: unit || r.unit,
              unitPrice: unitPrice !== undefined && unitPrice > 0 ? unitPrice : r.unitPrice,
              spec: !r.spec && suggestedSpec ? suggestedSpec : r.spec
            }
          : r
      )
    );
    setActiveDropdown(null);
  };

  const handleApplySpecDetachment = (rowId: string, cleanedName: string, extractedSpec: string) => {
    setGridRows(prev => prev.map(r => (r.id === rowId ? { ...r, itemName: cleanedName, spec: extractedSpec } : r)));
    triggerToast(`已自動拆分：品名【${cleanedName}】+ 規格【${extractedSpec}】`, 'success');
  };

  const handleApplyCanonicalItem = (rowId: string, rule: CanonicalRule) => {
    setGridRows(prev =>
      prev.map(r =>
        r.id === rowId
          ? {
              ...r,
              itemName: rule.canonicalName,
              unit: rule.defaultUnit || r.unit,
              spec: !r.spec && rule.suggestedSpec ? rule.suggestedSpec : r.spec
            }
          : r
      )
    );
    triggerToast(`已採用公司標準品名【${rule.canonicalName}】！`, 'success');
  };

  const handleSelectSpec = (rowId: string, specVal: string) => {
    setGridRows(prev => prev.map(r => (r.id === rowId ? { ...r, spec: specVal } : r)));
    setActiveDropdown(null);
  };

  // 列增刪與複製
  const handleAddRows = (count: number = 1) => {
    setGridRows(prev => {
      const nextSeq = prev.length + 1;
      const added: ExcelGridRow[] = [];
      for (let i = 0; i < count; i++) added.push(createBlankRow(nextSeq + i));
      return [...prev, ...added];
    });
  };

  const handleDuplicateRow = (rowId: string) => {
    setGridRows(prev => {
      const idx = prev.findIndex(r => r.id === rowId);
      if (idx === -1) return prev;
      const cloned: ExcelGridRow = {
        ...prev[idx],
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        seq: prev.length + 1
      };
      const copy = [...prev];
      copy.splice(idx + 1, 0, cloned);
      return copy.map((r, i) => ({ ...r, seq: i + 1 }));
    });
    triggerToast('已複製選定列資料', 'success');
  };

  const handleDeleteRow = (rowId: string) => {
    setGridRows(prev => {
      if (prev.length <= 1) {
        triggerToast('至少保留一筆資料列', 'warn');
        return prev;
      }
      return prev.filter(r => r.id !== rowId).map((r, i) => ({ ...r, seq: i + 1 }));
    });
  };

  const handleClearAllRows = () => {
    generateInitialRows(5);
    triggerToast('已清空目前表格，並重設為 5 筆空白輸入列', 'success');
  };

  // 匯出 / 匯入 CSV
  const handleExportCsv = () => {
    try {
      exportGridRowsCsv(gridRows);
      triggerToast('🖨️ 已成功匯出標準 CSV 試算表（Excel 直接開不亂碼）！', 'success');
    } catch (err: any) {
      triggerToast('匯出失敗: ' + err.message, 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file, 'utf-8');
      if (!text) return;
      const result = parseCsvRowsToGrid({ rawText: text, defaultDate, projects, vendors, internalAssets });
      if (result.errorMsg) {
        triggerToast(result.errorMsg, 'warn');
        return;
      }
      setBatchMappingAlert(result.topUnmapped);
      setGridRows(result.rows);
      triggerToast(`🎉 成功匯入 ${result.rows.length} 筆進貨資料！案場車輛已自動智慧辨識對齊！`, 'success');
    } catch (err) {
      triggerToast('❌ 讀取 CSV 失敗：' + (err as Error).message, 'error');
    } finally {
      e.target.value = '';
    }
  };

  // 解析歸屬 Helper（供暫存草稿與正式過帳共用）
  const resolveGroupMasterIds = (firstRow: ExcelGridRow) => {
    let finalProjectId = firstRow.matchedProjectId;
    let finalProjectName = firstRow.siteInputName.trim();

    if (firstRow.projectStatus === 'INTERNAL_ASSET' || !finalProjectId) {
      const resolved = resolveSiteOrAsset(firstRow.siteInputName, projects, internalAssets);
      if (resolved.status === 'INTERNAL_ASSET') {
        finalProjectId = 'PRJ-INTERNAL';
        finalProjectName = resolved.finalName || firstRow.siteInputName.trim() || '廠內自用';
      } else if (resolved.status === 'MATCHED' && resolved.matchedProjectId) {
        finalProjectId = resolved.matchedProjectId;
        finalProjectName = resolved.finalName;
      } else {
        finalProjectId = 'PRJ-INTERNAL';
        finalProjectName = firstRow.siteInputName.trim() || '廠內自用';
      }
    }

    let finalVendorId = firstRow.matchedVendorId;
    let finalVendorName = firstRow.vendorInputName.trim();
    if (!finalVendorId && firstRow.vendorInputName.trim()) {
      const venCheck = validateVendorName(firstRow.vendorInputName, vendors);
      if (venCheck.status === 'MATCHED' && venCheck.matchedVen) {
        finalVendorId = venCheck.matchedVen.id;
        finalVendorName = venCheck.matchedVen.name;
      }
    }

    return {
      finalProjectId: finalProjectId || 'PRJ-INTERNAL',
      finalProjectName,
      finalVendorId: finalVendorId || 'BP-03',
      finalVendorName
    };
  };

  // 草稿暫存 / 載入 / 刪除
  const handleSaveAsDraft = (options: { clearAfter: boolean; customTitle?: string }) => {
    const validRows = gridRows.filter(r => r.itemName.trim().length > 0 || r.vendorInputName.trim().length > 0);
    if (validRows.length === 0) {
      triggerToast('請至少填寫一筆進貨品項或廠商名稱，方可存為草稿', 'warn');
      return;
    }

    try {
      const now = new Date();
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const firstRow = validRows[0];
      const prjName = firstRow.siteInputName.trim() || '未定案場';
      const venName = firstRow.vendorInputName.trim() || '未定廠商';
      const total = validRows.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0);

      let draftId = activeDraftId;
      const existingDraft = drafts.find(d => d.id === draftId);
      const draftTitle = options.customTitle || activeDraftTitle || `草稿 ${drafts.length + 1}：${prjName} · ${venName}`;
      if (!draftId) draftId = `draft-${Date.now()}`;

      let dbReceiptId = existingDraft?.dbReceiptId || (draftId.startsWith('INB-') ? draftId : undefined);
      const { finalProjectId, finalProjectName, finalVendorId, finalVendorName } = resolveGroupMasterIds(firstRow);

      const receiptItems = validRows.map((r, idx) => ({
        id: `it-draft-${Date.now()}-${idx + 1}`,
        itemName: r.itemName || '現場材料',
        spec: r.spec || '',
        unit: r.unit || '式',
        quantity: Number(r.quantity) || 0,
        unitPrice: Number(r.unitPrice) || 0,
        lineTotal: (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
        notes: r.notes || ''
      }));

      const payload = {
        projectId: finalProjectId,
        projectNameSnapshot: finalProjectName,
        vendorId: finalVendorId,
        vendorNameSnapshot: finalVendorName,
        deliveryNoteNumber: firstRow.deliveryNoteNumber || `DN-${Date.now().toString().slice(-4)}`,
        orderNumber: firstRow.orderNumber || undefined,
        receivedDate: firstRow.receivedDate || defaultDate,
        totalAmount: total,
        status: 'DRAFT' as const,
        notes: `[極速打單草稿] ${draftTitle}`
      };

      if (dbReceiptId) {
        try {
          updateInboundReceipt(dbReceiptId, payload, receiptItems);
        } catch {
          const created = createInboundReceipt(
            { ...payload, companyId: 'COMP-01', receivedBy: currentUserFullName, billingStatus: 'PENDING_BILLING' },
            receiptItems
          );
          dbReceiptId = created.id;
        }
      } else {
        const created = createInboundReceipt(
          { ...payload, companyId: 'COMP-01', receivedBy: currentUserFullName, billingStatus: 'PENDING_BILLING' },
          receiptItems
        );
        dbReceiptId = created.id;
      }

      const updatedDraft: InboundSpeedDraft = {
        id: draftId,
        title: draftTitle,
        createdAt: existingDraft?.createdAt || timeStr,
        updatedAt: timeStr,
        defaultDate,
        rows: gridRows,
        totalAmount: total,
        itemCount: validRows.length,
        primaryProjectName: prjName,
        primaryVendorName: venName,
        dbReceiptId
      };

      const nextDrafts = [updatedDraft, ...drafts.filter(d => d.id !== draftId && d.dbReceiptId !== dbReceiptId)];
      setDrafts(nextDrafts);
      saveStoredSpeedDrafts(nextDrafts);

      if (options.clearAfter) {
        setGridRows(generateInitialRows(5));
        setActiveDraftId(null);
        setActiveDraftTitle('');
        triggerToast(`🎉 已成功儲存【${draftTitle}】！打單工作台已清空，可直接登打下一張單！`, 'success');
      } else {
        setActiveDraftId(draftId);
        setActiveDraftTitle(draftTitle);
        triggerToast(`💾 已儲存至【${draftTitle}】！可隨時繼續編輯或在草稿箱切換。`, 'success');
      }

      onSaved();
    } catch (err: any) {
      triggerToast('存為草稿失敗: ' + err.message, 'error');
    }
  };

  const handleLoadDraft = (draft: InboundSpeedDraft) => {
    setGridRows(draft.rows);
    setActiveDraftId(draft.id);
    setActiveDraftTitle(draft.title);
    setIsDraftDrawerOpen(false);
    triggerToast(`📋 已載入【${draft.title}】！可接續登打或一鍵轉為正式單。`, 'success');
  };

  const handleDeleteDraft = (draftId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = drafts.find(d => d.id === draftId);
    if (!target) return;

    if (target.dbReceiptId) {
      try {
        deleteInboundReceipt(target.dbReceiptId);
      } catch (err) {
        console.warn('從資料庫刪除草稿失敗:', err);
      }
    }

    const nextDrafts = drafts.filter(d => d.id !== draftId);
    setDrafts(nextDrafts);
    saveStoredSpeedDrafts(nextDrafts);

    if (activeDraftId === draftId) {
      setGridRows(generateInitialRows(5));
      setActiveDraftId(null);
      setActiveDraftTitle('');
    }

    triggerToast(`已自草稿箱刪除【${target.title}】`, 'success');
    onSaved();
  };

  const handleClearAndStartNew = () => {
    setGridRows(generateInitialRows(5));
    setActiveDraftId(null);
    setActiveDraftTitle('');
    setIsDraftDrawerOpen(false);
    triggerToast('打單工作台已清空重置，備妥 5 筆全新空白列！', 'success');
  };

  // 審核存入正式單
  const handleCommitFormalReceipts = () => {
    const validRows = gridRows.filter(r => r.itemName.trim().length > 0 || r.vendorInputName.trim().length > 0);
    if (validRows.length === 0) {
      triggerToast('請至少填寫一筆進貨品項或廠商名稱，方可審核存入', 'warn');
      return;
    }

    try {
      let createdCount = 0;
      const currentDraft = drafts.find(d => d.id === activeDraftId);
      const existingDbId = currentDraft?.dbReceiptId || (activeDraftId?.startsWith('INB-') ? activeDraftId : undefined);

      const groups: Record<string, ExcelGridRow[]> = {};
      validRows.forEach(r => {
        const key = `${r.vendorInputName.trim()}___${r.siteInputName.trim()}___${r.deliveryNoteNumber.trim()}___${r.receivedDate.trim()}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });

      const groupKeys = Object.keys(groups);

      if (existingDbId && groupKeys.length === 1) {
        const rows = groups[groupKeys[0]];
        const firstRow = rows[0];
        const { finalProjectId, finalProjectName, finalVendorId, finalVendorName } = resolveGroupMasterIds(firstRow);
        const receiptItems = rows.map((r, idx) => ({
          id: `it-${Date.now()}-${idx + 1}`,
          itemName: r.itemName || '現場材料',
          spec: r.spec || '',
          unit: r.unit || '式',
          quantity: Number(r.quantity) || 0,
          unitPrice: Number(r.unitPrice) || 0,
          lineTotal: (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
          notes: r.notes || ''
        }));
        const groupTotal = receiptItems.reduce((acc, it) => acc + it.lineTotal, 0);

        updateInboundReceipt(
          existingDbId,
          {
            projectId: finalProjectId,
            projectNameSnapshot: finalProjectName,
            vendorId: finalVendorId,
            vendorNameSnapshot: finalVendorName,
            deliveryNoteNumber: firstRow.deliveryNoteNumber || `DN-${Date.now().toString().slice(-4)}`,
            receivedDate: firstRow.receivedDate || defaultDate,
            receivedBy: currentUserFullName,
            totalAmount: groupTotal,
            status: 'POSTED',
            billingStatus: 'PENDING_BILLING',
            notes: firstRow.notes.trim()
          },
          receiptItems
        );
        postInboundReceipt(existingDbId);
        createdCount = 1;
      } else {
        if (existingDbId) {
          try {
            deleteInboundReceipt(existingDbId);
          } catch (e) {
            console.warn('清理原草稿記錄失敗:', e);
          }
        }
        for (const key of groupKeys) {
          const rows = groups[key];
          const firstRow = rows[0];
          const { finalProjectId, finalProjectName, finalVendorId, finalVendorName } = resolveGroupMasterIds(firstRow);
          const receiptItems = rows.map((r, idx) => ({
            id: `it-${Date.now()}-${idx + 1}`,
            itemName: r.itemName || '現場材料',
            spec: r.spec || '',
            unit: r.unit || '式',
            quantity: Number(r.quantity) || 0,
            unitPrice: Number(r.unitPrice) || 0,
            lineTotal: (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
            notes: r.notes || ''
          }));
          const groupTotal = receiptItems.reduce((acc, it) => acc + it.lineTotal, 0);

          createInboundReceipt(
            {
              companyId: 'COMP-01',
              projectId: finalProjectId,
              projectNameSnapshot: finalProjectName,
              vendorId: finalVendorId,
              vendorNameSnapshot: finalVendorName,
              deliveryNoteNumber: firstRow.deliveryNoteNumber || `DN-${Date.now().toString().slice(-4)}`,
              orderNumber: firstRow.orderNumber || undefined,
              receivedDate: firstRow.receivedDate || defaultDate,
              receivedBy: currentUserFullName,
              totalAmount: groupTotal,
              status: 'POSTED',
              billingStatus: 'PENDING_BILLING',
              notes: firstRow.notes.trim()
            },
            receiptItems
          );
          createdCount++;
        }
      }

      if (activeDraftId) {
        const nextDrafts = drafts.filter(d => d.id !== activeDraftId && d.dbReceiptId !== existingDbId);
        setDrafts(nextDrafts);
        saveStoredSpeedDrafts(nextDrafts);
      }

      setGridRows(generateInitialRows(5));
      setActiveDraftId(null);
      setActiveDraftTitle('');
      triggerToast(`🎉 成功儲存並正式過帳 ${createdCount} 筆現場進貨簽收單！直入案場累計成本，工作台已為您清空備妥！`, 'success');
      onSaved();
      onClose();
    } catch (e: any) {
      triggerToast('儲存失敗: ' + e.message, 'error');
    }
  };

  const summaryStats = useMemo(() => {
    const subtotal = gridRows.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0);
    const filledCount = gridRows.filter(r => r.itemName.trim() || r.vendorInputName.trim()).length;
    return { subtotal, filledCount, totalRows: gridRows.length };
  }, [gridRows]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      {/* 頂部導航與功能列 */}
      <div className="bg-slate-900 text-white border-b border-slate-800 px-5 py-3 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight">仿 Excel 極速進貨打單工作台</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                純粹現場進貨模式
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              專責物料現場簽收與數量單價登打 · 去除會計發票雜訊 · 支援 CSV 匯出匯入與案場廠商智慧檢驗建檔
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDraftDrawerOpen(!isDraftDrawerOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              isDraftDrawerOpen
                ? 'bg-amber-500 text-slate-900 border-amber-400 shadow-sm'
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-400/40'
            }`}
            title="查看所有暫存中的現場草稿單，支援多張草稿隨意切換、接續登打與一鍵正式入庫"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>📋 暫存草稿箱</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                isDraftDrawerOpen ? 'bg-slate-900 text-amber-300' : 'bg-amber-400 text-slate-900'
              }`}
            >
              {drafts.length}
            </span>
          </button>

          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.txt" className="hidden" />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            title="匯入 CSV 試算表（自動依數量與單價重算金額，完美相容各版 CSV）"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>匯入 CSV 試算表</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            title="匯出標準 CSV 試算表 (Excel 直接開不亂碼，欄位純粹現場化)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>匯出 CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAssetManagerOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            title="維護公務車換車、老舊報廢、重型機具與常備庫存別名"
          >
            <Truck className="w-3.5 h-3.5 text-blue-400" />
            <span>🚚 廠內資產維護</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 草稿抽屜與作業狀態條 */}
      <InboundDraftDrawer
        isOpen={isDraftDrawerOpen}
        onCloseDrawer={() => setIsDraftDrawerOpen(false)}
        drafts={drafts}
        activeDraftId={activeDraftId}
        activeDraftTitle={activeDraftTitle}
        filledCount={summaryStats.filledCount}
        subtotal={summaryStats.subtotal}
        onLoadDraft={handleLoadDraft}
        onDeleteDraft={handleDeleteDraft}
        onSaveAsDraft={handleSaveAsDraft}
        onClearAndStartNew={handleClearAndStartNew}
      />

      {/* 匯入未知歸屬批次校正看板 */}
      {batchMappingAlert && (
        <div className="bg-amber-950/80 text-amber-200 border-b border-amber-500/50 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 animate-in slide-in-from-top-1 duration-150 shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow-xs">
              <Sparkles className="w-3 h-3 text-slate-950" />
              <span>匯入智慧校正</span>
            </span>
            <span>
              Excel 匯入發現 <strong className="text-white font-mono bg-amber-900/90 px-1.5 py-0.2 rounded border border-amber-600/50">{batchMappingAlert.count}</strong> 筆未辨識名稱：
              【<strong className="text-amber-300 font-bold">{batchMappingAlert.unmappedName}</strong>】
            </span>
            <span className="text-[11px] text-slate-300 hidden md:inline">
              （一鍵批次指定歸屬，系統自動將此名稱記為別名，下次匯入即 100% 自動對齊！）
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-amber-300 font-medium">批次指派為：</span>
            <select
              onChange={e => {
                const ast = internalAssets.find(a => a.id === e.target.value);
                if (ast) handleBatchMapSite(batchMappingAlert.unmappedName, ast);
              }}
              defaultValue=""
              className="px-2.5 py-1 bg-slate-900 border border-amber-400/80 rounded text-amber-200 text-xs font-bold outline-none cursor-pointer hover:border-amber-300 transition-colors shadow-xs"
            >
              <option value="" disabled>點擊選擇對應之廠內資產或車輛...</option>
              {internalAssets.map(a => (
                <option key={a.id} value={a.id}>
                  {a.categoryLabel} {a.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setBatchMappingAlert(null)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
              title="忽略此次批次建議"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 批次工具列 */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-4 text-slate-700">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">新列預設進貨日:</span>
            <input
              type="date"
              value={defaultDate}
              onChange={e => setDefaultDate(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoPostDirectly}
              onChange={e => setAutoPostDirectly(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-semibold">審核存入時正式過帳 (直入案場累計成本)</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleAddRows(1)}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>加 1 列</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddRows(5)}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>加 5 列</span>
          </button>
          <button
            type="button"
            onClick={handleClearAllRows}
            className="px-2.5 py-1 rounded bg-white hover:bg-rose-50 border border-slate-300 text-rose-600 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="一鍵清空目前所有輸入內容，重設為 5 筆空白列"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空表格</span>
          </button>
        </div>
      </div>

      {/* 試算表主網格 */}
      <div className="flex-1 overflow-auto bg-slate-100 p-2 sm:p-3">
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden min-w-[1250px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-800 text-white sticky top-0 z-20 select-none text-[11px]">
              <tr className="divide-x divide-slate-700">
                <th className="py-2.5 px-2 text-center w-12 font-bold">序號</th>
                <th className="py-2.5 px-2 text-center w-32 font-bold">進貨日</th>
                <th className="py-2.5 px-2 w-52 font-bold">
                  <span>廠商名稱</span>
                  <span className="text-[10px] text-slate-400 block font-normal">檢驗/比對狀態</span>
                </th>
                <th className="py-2.5 px-2 w-60 font-bold">
                  <span>個案用料 / 案場</span>
                  <span className="text-[10px] text-slate-400 block font-normal">專案代碼/檢驗</span>
                </th>
                <th className="py-2.5 px-2 w-48 font-bold">品名 (料件名稱)</th>
                <th className="py-2.5 px-2 w-32 font-bold">規格</th>
                <th className="py-2.5 px-2 text-center w-24 font-bold">單位</th>
                <th className="py-2.5 px-2 text-right w-24 font-bold">數量</th>
                <th className="py-2.5 px-2 text-right w-28 font-bold">單價</th>
                <th className="py-2.5 px-2 text-right w-32 font-bold bg-slate-900 text-emerald-400">金額 (小計)</th>
                <th className="py-2.5 px-2 w-40 font-bold">送貨單號 / 簽收單號</th>
                <th className="py-2.5 px-2 w-44 font-bold">備註</th>
                <th className="py-2.5 px-2 text-center w-20 font-bold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {gridRows.map(row => {
                const lineTotal = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
                const cellDetectedSpec = detectSpecInItemName(row.itemName);

                return (
                  <tr key={row.id} className="hover:bg-indigo-50/40 transition-colors divide-x divide-slate-200 group">
                    <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-500 bg-slate-50/70">{row.seq}</td>
                    <td className="p-1">
                      <input
                        type="date"
                        value={row.receivedDate}
                        onChange={e => handleCellChange(row.id, 'receivedDate', e.target.value)}
                        className="w-full px-1.5 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded font-mono text-xs outline-none transition-colors"
                      />
                    </td>

                    {/* 廠商 */}
                    <td className="p-1 relative" data-dropdown-trigger>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="輸入廠商或拉選"
                          value={row.vendorInputName}
                          onFocus={e => openDropdown(e.currentTarget, row.id, 'vendor')}
                          onClick={e => openDropdown(e.currentTarget, row.id, 'vendor')}
                          onBlur={() => handleNormalizeVendorCell(row.id)}
                          onChange={e => {
                            handleCellChange(row.id, 'vendorInputName', e.target.value);
                            openDropdown(e.currentTarget, row.id, 'vendor');
                          }}
                          className="flex-1 px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs font-semibold text-slate-900 outline-none transition-colors"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={e => {
                            e.stopPropagation();
                            if (activeDropdown?.rowId === row.id && activeDropdown?.field === 'vendor') setActiveDropdown(null);
                            else openDropdown(e.currentTarget, row.id, 'vendor');
                          }}
                          className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="下拉查看所有合作廠商清單"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        {row.vendorStatus === 'MATCHED' && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>既有</span>
                          </span>
                        )}
                        {row.vendorStatus === 'NEW' && row.vendorInputName.trim() && (
                          <button
                            type="button"
                            onClick={() =>
                              setQuickCreateRequest({ type: 'VENDOR', rowId: row.id, initialName: row.vendorInputName })
                            }
                            className="px-1.5 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold shrink-0 flex items-center gap-0.5 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            <span>新廠商</span>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 案場 */}
                    <td className="p-1 relative" data-dropdown-trigger>
                      <div className="flex items-center gap-1">
                        <div className="flex-1 flex items-center">
                          <input
                            type="text"
                            placeholder="輸入案場 (如 3310) 或 廠內貨車/自用"
                            value={row.siteInputName}
                            onFocus={e => openDropdown(e.currentTarget, row.id, 'site')}
                            onClick={e => openDropdown(e.currentTarget, row.id, 'site')}
                            onBlur={() => handleNormalizeSiteCell(row.id)}
                            onChange={e => {
                              handleCellChange(row.id, 'siteInputName', e.target.value);
                              openDropdown(e.currentTarget, row.id, 'site');
                            }}
                            className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs font-semibold text-slate-900 outline-none transition-colors"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={e => {
                              e.stopPropagation();
                              if (activeDropdown?.rowId === row.id && activeDropdown?.field === 'site') setActiveDropdown(null);
                              else openDropdown(e.currentTarget, row.id, 'site');
                            }}
                            className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title="下拉查看工程案場或廠內車輛維運標籤"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {row.projectStatus === 'MATCHED' && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>已鎖定</span>
                          </span>
                        )}
                        {row.projectStatus === 'INTERNAL_ASSET' && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold shrink-0 flex items-center gap-0.5">
                            <Building2 className="w-3 h-3 text-blue-600" />
                            <span>廠內自用</span>
                          </span>
                        )}
                        {row.projectStatus === 'NEW' && row.siteInputName.trim() && (
                          <button
                            type="button"
                            onClick={() =>
                              setQuickCreateRequest({ type: 'PROJECT', rowId: row.id, initialName: row.siteInputName })
                            }
                            className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold shrink-0 flex items-center gap-0.5 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>新案場</span>
                          </button>
                        )}
                      </div>
                      {row.projectCodeSnapshot && (
                        <div
                          className={`text-[10px] font-mono font-bold px-2 mt-0.5 ${
                            row.projectStatus === 'INTERNAL_ASSET' ? 'text-blue-600' : 'text-indigo-600'
                          }`}
                        >
                          {row.projectStatus === 'INTERNAL_ASSET'
                            ? '類別: 廠內自用 (免建案場)'
                            : `專案代碼: ${row.projectCodeSnapshot}`}
                        </div>
                      )}
                    </td>

                    {/* 品名 */}
                    <td className="p-1 relative" data-dropdown-trigger>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="例如 竹節鋼筋 / 預拌混凝土"
                          value={row.itemName}
                          onFocus={e => openDropdown(e.currentTarget, row.id, 'item')}
                          onClick={e => openDropdown(e.currentTarget, row.id, 'item')}
                          onChange={e => {
                            handleCellChange(row.id, 'itemName', e.target.value);
                            openDropdown(e.currentTarget, row.id, 'item');
                          }}
                          className="flex-1 px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs font-bold text-slate-800 outline-none transition-colors"
                        />
                        {cellDetectedSpec && (
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={e => {
                              e.stopPropagation();
                              handleApplySpecDetachment(row.id, cellDetectedSpec.cleanedItemName, cellDetectedSpec.extractedSpec);
                            }}
                            className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-bold shrink-0 flex items-center gap-0.5 cursor-pointer shadow-xs animate-pulse"
                            title={`偵測到規格！點擊一鍵拆分為：品名【${cellDetectedSpec.cleanedItemName}】+ 規格【${cellDetectedSpec.extractedSpec}】`}
                          >
                            <Sparkles className="w-3 h-3 text-amber-700" />
                            <span>拆分規格</span>
                          </button>
                        )}
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={e => {
                            e.stopPropagation();
                            if (activeDropdown?.rowId === row.id && activeDropdown?.field === 'item') setActiveDropdown(null);
                            else openDropdown(e.currentTarget, row.id, 'item');
                          }}
                          className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="下拉查看標準物料清單"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        {row.itemName.trim() && (
                          <button
                            type="button"
                            onClick={() =>
                              setQuickCreateRequest({
                                type: 'ITEM',
                                rowId: row.id,
                                initialName: row.itemName,
                                initialUnit: row.unit,
                                initialPrice: row.unitPrice
                              })
                            }
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 cursor-pointer transition-opacity"
                            title="將此用料登記至物料庫主檔"
                          >
                            <Package className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 規格 */}
                    <td className="p-1 relative" data-dropdown-trigger>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="如 #4, 3000psi"
                          value={row.spec}
                          onFocus={e => openDropdown(e.currentTarget, row.id, 'spec')}
                          onClick={e => openDropdown(e.currentTarget, row.id, 'spec')}
                          onChange={e => {
                            handleCellChange(row.id, 'spec', e.target.value);
                            openDropdown(e.currentTarget, row.id, 'spec');
                          }}
                          className="flex-1 px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs outline-none transition-colors font-medium text-slate-800"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={e => {
                            e.stopPropagation();
                            if (activeDropdown?.rowId === row.id && activeDropdown?.field === 'spec') setActiveDropdown(null);
                            else openDropdown(e.currentTarget, row.id, 'spec');
                          }}
                          className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="下拉查看該品名之常用規格與歷史進貨規格"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    <td className="p-1">
                      <input
                        type="text"
                        value={row.unit}
                        onChange={e => handleCellChange(row.id, 'unit', e.target.value)}
                        className="w-full px-1.5 py-1 text-center bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs font-medium outline-none transition-colors"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={row.quantity}
                        onChange={e => handleCellChange(row.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded font-mono text-xs font-bold text-slate-800 outline-none transition-colors"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={row.unitPrice}
                        onChange={e => handleCellChange(row.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded font-mono text-xs text-slate-800 outline-none transition-colors"
                      />
                    </td>
                    <td className="p-1 text-right font-mono font-bold text-xs text-emerald-700 bg-emerald-50/50 px-2">
                      ${lineTotal.toLocaleString()}
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        placeholder="如 DN-3690"
                        value={row.deliveryNoteNumber}
                        onChange={e => handleCellChange(row.id, 'deliveryNoteNumber', e.target.value)}
                        className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded font-mono text-xs text-slate-700 outline-none transition-colors"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        placeholder="選填備註說明"
                        value={row.notes}
                        onChange={e => handleCellChange(row.id, 'notes', e.target.value)}
                        className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs text-slate-600 outline-none transition-colors"
                      />
                    </td>
                    <td className="py-1 px-1.5 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleDuplicateRow(row.id)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                          title="複製此列"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="刪除此列"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 底部摘要列與雙軌存檔按鈕 */}
      <div className="bg-white border-t border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-lg shrink-0">
        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">有效填寫:</span>
            <span className="font-mono font-bold text-slate-800 text-sm">{summaryStats.filledCount} 筆</span>
            <span className="text-slate-400">（總共 {summaryStats.totalRows} 列）</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">未稅總計:</span>
            <span className="font-mono font-bold text-emerald-600 text-base">${summaryStats.subtotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 font-mono">
            <span>預估稅金 5%:</span>
            <span className="font-bold text-amber-700">${Math.round(summaryStats.subtotal * 0.05).toLocaleString()}</span>
          </div>
          {activeDraftId && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 font-bold flex items-center gap-1">
              <FolderOpen className="w-3 h-3 text-amber-600" />
              <span>目前編輯：{activeDraftTitle}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            關閉視窗
          </button>
          <button
            type="button"
            onClick={handleClearAndStartNew}
            className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
            title="清空目前所有列，開一張全新的空白打單頁"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>清空開新單</span>
          </button>
          <button
            type="button"
            onClick={() => handleSaveAsDraft({ clearAfter: false })}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="暫存為草稿，隨時可在草稿箱中切換或接續修改，不計入正式案場累計成本"
          >
            <Save className="w-4 h-4" />
            <span>{activeDraftId ? '💾 更新草稿' : `💾 存為草稿 (草稿 ${drafts.length + 1})`}</span>
          </button>
          <button
            type="button"
            onClick={handleCommitFormalReceipts}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
            title="正式過帳進貨單，直入案場累計成本，並自動將草稿轉正移出草稿箱、清空打單工作台！"
          >
            <FileCheck className="w-4 h-4" />
            <span>🚀 審核存入正式單 (過帳入庫)</span>
          </button>
        </div>
      </div>

      {/* 全局浮動推薦下拉選單 */}
      <InboundGridDropdown
        activeDropdown={activeDropdown}
        onCloseDropdown={() => setActiveDropdown(null)}
        gridRows={gridRows}
        vendors={vendors}
        projects={projects}
        internalAssets={internalAssets}
        items={items}
        historicalMemory={historicalMemory}
        onSelectVendor={handleSelectVendor}
        onOpenQuickCreateVendor={(rowId, initialName) => setQuickCreateRequest({ type: 'VENDOR', rowId, initialName })}
        onSelectInternalAsset={handleSelectInternalAsset}
        onSelectProject={handleSelectProject}
        onQuickCreateAsset={handleQuickCreateAsset}
        onOpenQuickCreateProject={(rowId, initialName) => setQuickCreateRequest({ type: 'PROJECT', rowId, initialName })}
        onApplySpecDetachment={handleApplySpecDetachment}
        onApplyCanonicalItem={handleApplyCanonicalItem}
        onSelectItem={handleSelectItem}
        onOpenQuickCreateItem={(rowId, initialName, initialUnit, initialPrice) =>
          setQuickCreateRequest({ type: 'ITEM', rowId, initialName, initialUnit, initialPrice })
        }
        onSelectSpec={handleSelectSpec}
      />

      {/* 3 合 1 就地快速建檔 Modal */}
      <InboundQuickCreateModal
        request={quickCreateRequest}
        onClose={() => setQuickCreateRequest(null)}
        triggerToast={triggerToast}
        onProjectCreated={(rowId, createdPrj) => {
          reloadMasterData();
          if (rowId) {
            setGridRows(prev =>
              prev.map(r =>
                r.id === rowId
                  ? { ...r, siteInputName: createdPrj.name, matchedProjectId: createdPrj.id, projectCodeSnapshot: createdPrj.projectCode, projectStatus: 'MATCHED' }
                  : r
              )
            );
          }
        }}
        onVendorCreated={(rowId, createdVen) => {
          reloadMasterData();
          if (rowId) {
            setGridRows(prev =>
              prev.map(r =>
                r.id === rowId
                  ? { ...r, vendorInputName: createdVen.name, matchedVendorId: createdVen.id, vendorStatus: 'MATCHED' }
                  : r
              )
            );
          }
        }}
        onItemCreated={(rowId, createdItm) => {
          reloadMasterData();
          if (rowId) {
            setGridRows(prev =>
              prev.map(r =>
                r.id === rowId
                  ? { ...r, itemName: createdItm.name, unit: createdItm.unit, unitPrice: createdItm.unitPrice }
                  : r
              )
            );
          }
        }}
      />

      {/* 廠內自用公務車輛與廠務資產維護中心 Modal */}
      <InternalAssetManagerModal
        isOpen={isAssetManagerOpen}
        onClose={() => setIsAssetManagerOpen(false)}
        onAssetsUpdated={() => {
          setInternalAssets(loadStoredInternalAssets());
          triggerToast('✅ 廠內資產與車輛清冊已同步更新！', 'success');
        }}
        triggerToast={triggerToast}
      />
    </div>
  );
};
