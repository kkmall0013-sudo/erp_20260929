// src/components/inbound/ExcelInboundGridModal.tsx
// 📊 Excel 試算表極速進貨打單工作台 (Excel-Style Inbound Data Grid)
// 純粹現場進貨點收 · 支援仿 Excel 鍵盤快速連續鍵入 · 專屬 CSV 匯出匯入 (無會計年月與發票雜訊) · 案場/廠商/物料檢驗防呆與正式建檔

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
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Project, BusinessPartner, Item } from '../../types/erp';
import {
  getAllProjects,
  getAllBusinessPartners,
  getAllItems,
  createInboundReceipt,
  quickCreateProject,
  quickCreateVendor,
  quickCreateItem,
  previewNextDocumentNumber
} from '../../db/sqlite';

export interface ExcelGridRow {
  id: string; // 暫存 UUID
  seq: number; // 序號 (登打/核對序號)
  receivedDate: string; // 進貨日 (YYYY-MM-DD)
  vendorInputName: string; // 使用者輸入之廠商名稱
  matchedVendorId?: string; // 已對齊之廠商主鍵 ID
  vendorStatus: 'MATCHED' | 'NEW' | 'AMBIGUOUS'; // 檢驗狀態
  siteInputName: string; // 使用者輸入之個案用料 / 案場名稱
  matchedProjectId?: string; // 已對齊之專案主鍵 ID
  projectCodeSnapshot?: string; // 專案代碼 (如 PRJ-2026-001)
  projectStatus: 'MATCHED' | 'NEW' | 'AMBIGUOUS'; // 檢驗狀態
  itemName: string; // 品名 (料件名稱)
  spec: string; // 規格
  unit: string; // 單位
  quantity: number; // 數量
  unitPrice: number; // 單價
  deliveryNoteNumber: string; // 送貨單號 / 簽收單號
  notes: string; // 備註
}

interface ExcelInboundGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  triggerToast: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  currentUserFullName?: string;
  canApprove?: boolean;
}

// --------------------------------------------------------------------------
// 🛠️ 專用 CSV / TSV 穩健解析器 (支援引號內逗號、BOM 移除與容錯跳脫)
// --------------------------------------------------------------------------
function parseDelimitedLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex(h => {
    const clean = h.replace(/[\s\(\)（）_\ufeff]/g, '').toLowerCase();
    return candidates.some(c => clean.includes(c.toLowerCase()));
  });
}

export const ExcelInboundGridModal: React.FC<ExcelInboundGridModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  triggerToast,
  currentUserFullName = '現場工程師',
  canApprove = true,
}) => {
  // 主檔資料庫列表
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<BusinessPartner[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // 表格全域預設設定
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [defaultDate, setDefaultDate] = useState<string>(todayStr);
  const [autoPostDirectly, setAutoPostDirectly] = useState<boolean>(true);

  // 試算表列資料清單
  const [gridRows, setGridRows] = useState<ExcelGridRow[]>([]);

  // 極速就地快速建檔 Modal 狀態
  const [quickCreateType, setQuickCreateType] = useState<'PROJECT' | 'VENDOR' | 'ITEM' | null>(null);
  const [quickTargetRowId, setQuickTargetRowId] = useState<string | null>(null);

  // 廠商建檔欄位
  const [vendorNameInput, setVendorNameInput] = useState<string>('');
  const [vendorTaxIdInput, setVendorTaxIdInput] = useState<string>('');
  const [vendorCategoryInput, setVendorCategoryInput] = useState<string>('現場材料建材');
  const [vendorContactInput, setVendorContactInput] = useState<string>('');
  const [vendorPhoneInput, setVendorPhoneInput] = useState<string>('');
  const [vendorAddressInput, setVendorAddressInput] = useState<string>('');

  // 案場建檔欄位
  const [projectNameInput, setProjectNameInput] = useState<string>('');
  const [projectSiteInput, setProjectSiteInput] = useState<string>('');
  const [projectOwnerInput, setProjectOwnerInput] = useState<string>('');
  const [projectOwnerTaxIdInput, setProjectOwnerTaxIdInput] = useState<string>('');
  const [projectAddressInput, setProjectAddressInput] = useState<string>('');

  // 物料建檔欄位
  const [itemNameInput, setItemNameInput] = useState<string>('');
  const [itemSpecInput, setItemSpecInput] = useState<string>('');
  const [itemUnitInput, setItemUnitInput] = useState<string>('包');
  const [itemPriceInput, setItemPriceInput] = useState<number>(0);
  const [itemCategoryInput, setItemCategoryInput] = useState<string>('土木建材');

  // 檔案匯入 input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化讀取主檔資料
  const reloadMasterData = () => {
    const pList = getAllProjects();
    const vList = getAllBusinessPartners().filter(b => b.isVendor || b.type === 'VENDOR' || b.type === 'BOTH');
    const iList = getAllItems();
    setProjects(pList);
    setVendors(vList);
    setItems(iList);
  };

  // 建立空白列工廠
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
    deliveryNoteNumber: `DN-${Date.now().toString().slice(-4)}`,
    notes: '',
  });

  const generateInitialRows = (count: number) => {
    const rows: ExcelGridRow[] = [];
    for (let i = 1; i <= count; i++) {
      rows.push(createBlankRow(i));
    }
    setGridRows(rows);
  };

  useEffect(() => {
    if (isOpen) {
      reloadMasterData();
      if (gridRows.length === 0) {
        generateInitialRows(5);
      }
    }
  }, [isOpen]);

  // --------------------------------------------------------------------------
  // 🔍 檢驗機制：案場與廠商名稱比對
  // --------------------------------------------------------------------------
  const validateProjectName = (inputName: string): {
    status: 'MATCHED' | 'NEW' | 'AMBIGUOUS';
    matchedPrj?: Project;
  } => {
    const clean = (inputName || '').trim().toLowerCase();
    if (!clean) return { status: 'AMBIGUOUS' };

    // 1. 完全比對 (名稱、專案代碼、ID)
    const exact = projects.find(p => 
      p.name.toLowerCase() === clean || 
      p.projectCode.toLowerCase() === clean ||
      p.id.toLowerCase() === clean
    );
    if (exact) return { status: 'MATCHED', matchedPrj: exact };

    // 2. 模糊比對
    const partial = projects.find(p => 
      p.name.toLowerCase().includes(clean) || 
      clean.includes(p.name.toLowerCase()) ||
      (p.projectCode && p.projectCode.toLowerCase().includes(clean))
    );
    if (partial) return { status: 'MATCHED', matchedPrj: partial };

    // 未發現匹配 -> 標記為新案場
    return { status: 'NEW' };
  };

  const validateVendorName = (inputName: string): {
    status: 'MATCHED' | 'NEW' | 'AMBIGUOUS';
    matchedVen?: BusinessPartner;
  } => {
    const clean = (inputName || '').trim().toLowerCase();
    if (!clean) return { status: 'AMBIGUOUS' };

    // 1. 完全比對
    const exact = vendors.find(v => 
      v.name.toLowerCase() === clean || 
      v.bpCode.toLowerCase() === clean ||
      (v.taxId && v.taxId.trim() === clean)
    );
    if (exact) return { status: 'MATCHED', matchedVen: exact };

    // 2. 模糊比對
    const partial = vendors.find(v => 
      v.name.toLowerCase().includes(clean) || 
      clean.includes(v.name.toLowerCase())
    );
    if (partial) return { status: 'MATCHED', matchedVen: partial };

    return { status: 'NEW' };
  };

  // 試算表儲存格資料異動處理
  const handleCellChange = (
    rowId: string,
    field: keyof ExcelGridRow,
    value: any
  ) => {
    setGridRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;

      const updated = { ...row, [field]: value };

      if (field === 'siteInputName') {
        const check = validateProjectName(String(value));
        updated.projectStatus = check.status;
        updated.matchedProjectId = check.matchedPrj?.id;
        updated.projectCodeSnapshot = check.matchedPrj?.projectCode;
      }

      if (field === 'vendorInputName') {
        const check = validateVendorName(String(value));
        updated.vendorStatus = check.status;
        updated.matchedVendorId = check.matchedVen?.id;
      }

      return updated;
    }));
  };

  // 快速新增單列或多列
  const handleAddRows = (count: number = 1) => {
    setGridRows(prev => {
      const nextSeq = prev.length + 1;
      const newRows: ExcelGridRow[] = [];
      for (let i = 0; i < count; i++) {
        newRows.push(createBlankRow(nextSeq + i));
      }
      return [...prev, ...newRows];
    });
  };

  // 複製單列
  const handleDuplicateRow = (rowId: string) => {
    setGridRows(prev => {
      const targetIdx = prev.findIndex(r => r.id === rowId);
      if (targetIdx === -1) return prev;
      const target = prev[targetIdx];
      const cloned: ExcelGridRow = {
        ...target,
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        seq: prev.length + 1,
        deliveryNoteNumber: `DN-${Date.now().toString().slice(-4)}`,
      };
      const copy = [...prev];
      copy.splice(targetIdx + 1, 0, cloned);
      return copy.map((r, idx) => ({ ...r, seq: idx + 1 }));
    });
    triggerToast('已複製選定列資料', 'success');
  };

  // 刪除單列
  const handleDeleteRow = (rowId: string) => {
    setGridRows(prev => {
      if (prev.length <= 1) {
        triggerToast('至少保留一筆資料列', 'warn');
        return prev;
      }
      const filtered = prev.filter(r => r.id !== rowId);
      return filtered.map((r, idx) => ({ ...r, seq: idx + 1 }));
    });
  };

  // 清空表格
  const handleClearAllRows = () => {
    generateInitialRows(5);
    triggerToast('已清空目前表格，並重設為 5 筆空白輸入列', 'success');
  };

  // --------------------------------------------------------------------------
  // 📤 匯出 CSV (純粹進貨現場欄位，去除會計年月與發票雜訊，含 UTF-8 BOM)
  // --------------------------------------------------------------------------
  const handleExportCsv = () => {
    try {
      const headers = [
        '序號', '進貨日', '廠商名稱', '個案用料(案場)', '專案代碼',
        '品名', '規格', '單位', '數量', '單價', '金額', '送貨單號', '備註'
      ];

      const rows = gridRows.map(r => {
        const lineTotal = (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0);

        return [
          r.seq,
          `"${r.receivedDate}"`,
          `"${(r.vendorInputName || '').replace(/"/g, '""')}"`,
          `"${(r.siteInputName || '').replace(/"/g, '""')}"`,
          `"${r.projectCodeSnapshot || ''}"`,
          `"${(r.itemName || '').replace(/"/g, '""')}"`,
          `"${(r.spec || '').replace(/"/g, '""')}"`,
          `"${r.unit || '包'}"`,
          Number(r.quantity) || 0,
          Number(r.unitPrice) || 0,
          lineTotal,
          `"${(r.deliveryNoteNumber || '').replace(/"/g, '""')}"`,
          `"${(r.notes || '').replace(/"/g, '""')}"`
        ];
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `現場進貨登打表_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      triggerToast('🖨️ 已成功匯出標準 CSV 試算表（Excel 直接開不亂碼）！', 'success');
    } catch (err: any) {
      triggerToast('匯出失敗: ' + err.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // 📥 匯入 CSV / Excel 檔案 (智慧對齊，包容舊版 19 欄及不完整資料)
  // --------------------------------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        parseCsvFileContent(text);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const parseCsvFileContent = (rawText: string) => {
    // 移除 UTF-8 BOM
    const text = rawText.replace(/^\uFEFF/, '');
    if (!text.trim()) {
      triggerToast('匯入檔案內容不得為空', 'warn');
      return;
    }

    const rawLines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (rawLines.length === 0) return;

    // 判斷分隔符 (Tab 優先，次為逗號)
    const delimiter = rawLines[0].includes('\t') ? '\t' : ',';
    const firstLineCols = parseDelimitedLine(rawLines[0], delimiter);

    // 檢查第一行是否為標題列
    const hasHeader = firstLineCols.some(c => 
      ['序號', '進貨日', '日期', '廠商名稱', '廠商', '個案用料', '案場', '品名', '料件', '數量', '單價', '單位', '送貨單號'].some(k => c.includes(k))
    );

    let dataLines = rawLines;
    let headerCols: string[] = [];

    if (hasHeader) {
      headerCols = firstLineCols;
      dataLines = rawLines.slice(1);
    }

    // 建立動態欄位索引
    const dateIdx = findHeaderIndex(headerCols, ['進貨日', '進貨日期', '日期', 'date']);
    const vendorIdx = findHeaderIndex(headerCols, ['廠商名稱', '供料商', '廠商', 'vendor']);
    // 備援：若為舊版發票檔案，有些在發票所屬公司代碼有填寫
    const altVendorIdx = findHeaderIndex(headerCols, ['發票所屬公司代碼', '所屬公司', '公司名稱']);
    const siteIdx = findHeaderIndex(headerCols, ['個案用料', '案場', '工區', '專案名稱', 'site', 'project']);
    const codeIdx = findHeaderIndex(headerCols, ['專案代碼', '案場代碼', 'code']);
    const itemIdx = findHeaderIndex(headerCols, ['品名', '料件名稱', '料件', '材料', 'item']);
    const specIdx = findHeaderIndex(headerCols, ['規格', 'spec']);
    const unitIdx = findHeaderIndex(headerCols, ['單位', 'unit']);
    const qtyIdx = findHeaderIndex(headerCols, ['數量', 'qty', 'quantity']);
    const priceIdx = findHeaderIndex(headerCols, ['單價', 'price']);
    const dnIdx = findHeaderIndex(headerCols, ['送貨單號', '簽收單號', '單號', 'dn']);
    const notesIdx = findHeaderIndex(headerCols, ['備註', '說明', 'note', 'remark']);

    const newRows: ExcelGridRow[] = [];
    let startSeq = 1;

    for (const line of dataLines) {
      const cols = parseDelimitedLine(line, delimiter);
      if (cols.length === 0 || cols.every(c => c === '')) continue;

      let rowDate = defaultDate;
      let rowVendor = '';
      let rowSite = '';
      let rowCode = '';
      let rowItem = '';
      let rowSpec = '';
      let rowUnit = '包';
      let rowQty = 1;
      let rowPrice = 0;
      let rowDn = '';
      let rowNotes = '';

      if (hasHeader) {
        // 依據標題索引精準對齊，不依賴固定欄位位移
        if (dateIdx !== -1 && cols[dateIdx]) rowDate = cols[dateIdx].replace(/\//g, '-');
        
        // 廠商名稱：優先取 vendorIdx，若為空且有 altVendorIdx 則取備援
        if (vendorIdx !== -1 && cols[vendorIdx]) {
          rowVendor = cols[vendorIdx];
        } else if (altVendorIdx !== -1 && cols[altVendorIdx]) {
          rowVendor = cols[altVendorIdx];
        }

        if (siteIdx !== -1 && cols[siteIdx]) rowSite = cols[siteIdx];
        if (codeIdx !== -1 && cols[codeIdx]) rowCode = cols[codeIdx];
        if (itemIdx !== -1 && cols[itemIdx]) rowItem = cols[itemIdx];
        if (specIdx !== -1 && cols[specIdx]) rowSpec = cols[specIdx];
        if (unitIdx !== -1 && cols[unitIdx]) rowUnit = cols[unitIdx];
        if (qtyIdx !== -1 && cols[qtyIdx]) rowQty = Number(cols[qtyIdx]) || 1;
        if (priceIdx !== -1 && cols[priceIdx]) rowPrice = Number(cols[priceIdx]) || 0;
        if (dnIdx !== -1 && cols[dnIdx]) rowDn = cols[dnIdx];
        if (notesIdx !== -1 && cols[notesIdx]) rowNotes = cols[notesIdx];
      } else {
        // 無標題時的智慧位置推斷
        if (cols[0]?.match(/^\d{4}/)) {
          rowDate = cols[0].replace(/\//g, '-');
          rowVendor = cols[1] || '';
          rowSite = cols[2] || '';
          rowItem = cols[3] || '';
          rowQty = Number(cols[4]) || 1;
          rowPrice = Number(cols[5]) || 0;
          rowSpec = cols[6] || '';
          rowUnit = cols[7] || '包';
          rowDn = cols[8] || '';
          rowNotes = cols[9] || '';
        } else {
          rowItem = cols[0] || '';
          rowQty = Number(cols[1]) || 1;
          rowPrice = Number(cols[2]) || 0;
          rowUnit = cols[3] || '包';
          rowNotes = cols[4] || '';
        }
      }

      // 自動檢驗廠商與案場
      const venCheck = validateVendorName(rowVendor);
      const prjCheck = validateProjectName(rowSite || rowCode);

      newRows.push({
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        seq: startSeq++,
        receivedDate: rowDate,
        vendorInputName: rowVendor,
        matchedVendorId: venCheck.matchedVen?.id,
        vendorStatus: venCheck.status,
        siteInputName: rowSite,
        matchedProjectId: prjCheck.matchedPrj?.id,
        projectCodeSnapshot: prjCheck.matchedPrj?.projectCode || rowCode,
        projectStatus: prjCheck.status,
        itemName: rowItem,
        spec: rowSpec,
        unit: rowUnit || '包',
        quantity: rowQty,
        unitPrice: rowPrice,
        deliveryNoteNumber: rowDn || `DN-${Date.now().toString().slice(-4)}`,
        notes: rowNotes,
      });
    }

    if (newRows.length === 0) {
      triggerToast('未能解析出有效進貨列資料，請檢查檔案格式', 'warn');
      return;
    }

    setGridRows(newRows);
    triggerToast(`🎉 成功匯入 ${newRows.length} 筆進貨資料！金額已依數量與單價自動重算，欄位完全對齊！`, 'success');
  };

  // --------------------------------------------------------------------------
  // ⚡ 極速就地快速建檔 (Quick Create Project / Vendor / Item)
  // --------------------------------------------------------------------------
  const handleOpenQuickCreateVendor = (rowId: string, currentInput: string) => {
    setQuickTargetRowId(rowId);
    setQuickCreateType('VENDOR');
    setVendorNameInput(currentInput || '');
    setVendorTaxIdInput('');
    setVendorCategoryInput('現場材料建材');
    setVendorContactInput('業務聯絡人');
    setVendorPhoneInput('0912-345-678');
    setVendorAddressInput('');
  };

  const handleOpenQuickCreateProject = (rowId: string, currentInput: string) => {
    setQuickTargetRowId(rowId);
    setQuickCreateType('PROJECT');
    setProjectNameInput(currentInput ? `${currentInput}新建工程` : '大城蕭OO新建工程');
    setProjectSiteInput(currentInput || '大城蕭OO');
    setProjectOwnerInput('自建案場業主');
    setProjectOwnerTaxIdInput('');
    setProjectAddressInput('工地施工現場');
  };

  const handleOpenQuickCreateItem = (rowId: string, currentItemName: string, currentUnit: string, currentPrice: number) => {
    setQuickTargetRowId(rowId);
    setQuickCreateType('ITEM');
    setItemNameInput(currentItemName || '');
    setItemSpecInput('');
    setItemUnitInput(currentUnit || '包');
    setItemPriceInput(currentPrice || 0);
    setItemCategoryInput('現場建材');
  };

  const handleConfirmQuickCreate = () => {
    try {
      if (quickCreateType === 'PROJECT') {
        if (!projectNameInput.trim()) {
          triggerToast('請填寫案場名稱', 'warn');
          return;
        }
        const createdPrj = quickCreateProject(
          projectNameInput.trim(),
          projectSiteInput.trim() || projectNameInput.trim(),
          projectOwnerInput.trim() || '自建案場業主',
          'COMP-01',
          projectAddressInput.trim() || '現場工地',
          projectOwnerTaxIdInput.trim()
        );
        reloadMasterData();

        if (quickTargetRowId) {
          handleCellChange(quickTargetRowId, 'siteInputName', createdPrj.name);
          handleCellChange(quickTargetRowId, 'matchedProjectId', createdPrj.id);
          handleCellChange(quickTargetRowId, 'projectCodeSnapshot', createdPrj.projectCode);
          handleCellChange(quickTargetRowId, 'projectStatus', 'MATCHED');
        }

        triggerToast(`✅ 已在【工程案場模組】正式建檔！專案代碼：${createdPrj.projectCode}，未來案場模組直接連動共用！`, 'success');
      } else if (quickCreateType === 'VENDOR') {
        if (!vendorNameInput.trim()) {
          triggerToast('請填寫合作廠商全銜', 'warn');
          return;
        }
        const createdVen = quickCreateVendor(
          vendorNameInput.trim(),
          'COMP-01',
          vendorPhoneInput.trim(),
          vendorTaxIdInput.trim(),
          vendorContactInput.trim() || '業務窗口',
          vendorAddressInput.trim() || '通訊地址',
          vendorCategoryInput.trim()
        );
        reloadMasterData();

        if (quickTargetRowId) {
          handleCellChange(quickTargetRowId, 'vendorInputName', createdVen.name);
          handleCellChange(quickTargetRowId, 'matchedVendorId', createdVen.id);
          handleCellChange(quickTargetRowId, 'vendorStatus', 'MATCHED');
        }

        triggerToast(`✅ 已在【合作廠商模組】正式建檔！廠商編號：${createdVen.bpCode}，清冊已同步更新！`, 'success');
      } else if (quickCreateType === 'ITEM') {
        if (!itemNameInput.trim()) {
          triggerToast('請填寫品名名稱', 'warn');
          return;
        }
        const createdItm = quickCreateItem(
          itemNameInput.trim(),
          itemUnitInput.trim() || '式',
          Number(itemPriceInput) || 0,
          itemCategoryInput.trim()
        );
        reloadMasterData();

        if (quickTargetRowId) {
          handleCellChange(quickTargetRowId, 'itemName', createdItm.name);
          handleCellChange(quickTargetRowId, 'unit', createdItm.unit);
          handleCellChange(quickTargetRowId, 'unitPrice', createdItm.unitPrice);
        }

        triggerToast(`✅ 已登錄新料件「${createdItm.name}」入物料主檔清冊！`, 'success');
      }

      setQuickCreateType(null);
      setQuickTargetRowId(null);
    } catch (e: any) {
      triggerToast('建立失敗: ' + e.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // 💾 一鍵整批存檔入庫 (Batch Commit)
  // --------------------------------------------------------------------------
  const handleSaveAll = () => {
    const validRows = gridRows.filter(r => r.itemName.trim().length > 0 || r.vendorInputName.trim().length > 0);
    if (validRows.length === 0) {
      triggerToast('請至少填寫一筆進貨品項或廠商名稱', 'warn');
      return;
    }

    try {
      let createdCount = 0;

      for (const row of validRows) {
        let finalProjectId = row.matchedProjectId;
        if (!finalProjectId && row.siteInputName.trim()) {
          const autoPrj = quickCreateProject(row.siteInputName.trim(), row.siteInputName.trim(), '現場業主');
          finalProjectId = autoPrj.id;
        }

        let finalVendorId = row.matchedVendorId;
        if (!finalVendorId && row.vendorInputName.trim()) {
          const autoVen = quickCreateVendor(row.vendorInputName.trim());
          finalVendorId = autoVen.id;
        }

        const qty = Number(row.quantity) || 0;
        const price = Number(row.unitPrice) || 0;
        const total = qty * price;

        createInboundReceipt(
          {
            companyId: 'COMP-01',
            projectId: finalProjectId || 'PRJ-01',
            projectNameSnapshot: row.siteInputName || '未指定案場',
            vendorId: finalVendorId || 'BP-03',
            vendorNameSnapshot: row.vendorInputName || '未指定供料商',
            deliveryNoteNumber: row.deliveryNoteNumber || `DN-${Date.now().toString().slice(-4)}`,
            receivedDate: row.receivedDate || defaultDate,
            receivedBy: currentUserFullName,
            totalAmount: total,
            status: autoPostDirectly && canApprove ? 'POSTED' : 'DRAFT',
            billingStatus: 'PENDING_BILLING',
            notes: row.notes.trim(),
          },
          [
            {
              itemName: row.itemName || '現場建材物料',
              spec: row.spec,
              unit: row.unit || '式',
              quantity: qty,
              unitPrice: price,
              lineTotal: total,
              notes: row.notes,
            }
          ]
        );
        createdCount++;
      }

      triggerToast(
        `🎉 成功儲存 ${createdCount} 筆現場進貨簽收單！${autoPostDirectly ? '已正式過帳並累計至案場已實現成本！' : '（草稿狀態）'}`,
        'success'
      );

      onSaved();
      onClose();
    } catch (e: any) {
      triggerToast('儲存失敗: ' + e.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // 底部即時統計計算
  // --------------------------------------------------------------------------
  const summaryStats = useMemo(() => {
    let subtotal = 0;
    gridRows.forEach(r => {
      const q = Number(r.quantity) || 0;
      const p = Number(r.unitPrice) || 0;
      subtotal += q * p;
    });

    const filledCount = gridRows.filter(r => r.itemName.trim() || r.vendorInputName.trim()).length;
    return {
      subtotal,
      filledCount,
      totalRows: gridRows.length,
    };
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
              <h2 className="text-base font-bold tracking-tight">
                仿 Excel 極速進貨打單工作台
              </h2>
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
          {/* 隱藏之檔案上傳 input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.txt"
            className="hidden"
          />

          {/* 匯入 CSV 按鈕 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            title="匯入 CSV 試算表（自動依數量與單價重算金額，完美相容各版 CSV）"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>匯入 CSV 試算表</span>
          </button>

          {/* 匯出 CSV 按鈕 */}
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            title="匯出標準 CSV 試算表 (Excel 直接開不亂碼，欄位純粹現場化)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>匯出 CSV</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 批次工具列 (單純進貨日設定與列操作) */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
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
            <span className="font-semibold">儲存時正式過帳 (直入案場累計成本)</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAddRows(1)}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>加 1 列</span>
          </button>

          <button
            onClick={() => handleAddRows(5)}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>加 5 列</span>
          </button>

          {/* 清空按鈕：直接重設，零 iframe 阻擋 */}
          <button
            onClick={handleClearAllRows}
            className="px-2.5 py-1 rounded bg-white hover:bg-rose-50 border border-slate-300 text-rose-600 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="一鍵清空目前所有輸入內容，重設為 5 筆空白列"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空表格</span>
          </button>
        </div>
      </div>

      {/* 試算表主網格 (Excel Data Grid View) */}
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
              {gridRows.map((row) => {
                const lineTotal = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);

                return (
                  <tr 
                    key={row.id}
                    className="hover:bg-indigo-50/40 transition-colors divide-x divide-slate-200 group"
                  >
                    {/* 序號 */}
                    <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-500 bg-slate-50/70">
                      {row.seq}
                    </td>

                    {/* 進貨日 */}
                    <td className="p-1">
                      <input
                        type="date"
                        value={row.receivedDate}
                        onChange={e => handleCellChange(row.id, 'receivedDate', e.target.value)}
                        className="w-full px-1.5 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded font-mono text-xs outline-none transition-colors"
                      />
                    </td>

                    {/* 廠商名稱與檢驗 */}
                    <td className="p-1 relative">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="輸入或貼上廠商名稱"
                          value={row.vendorInputName}
                          onChange={e => handleCellChange(row.id, 'vendorInputName', e.target.value)}
                          className="flex-1 px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs font-semibold text-slate-900 outline-none transition-colors"
                        />
                        {row.vendorStatus === 'MATCHED' && (
                          <span 
                            className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0 flex items-center gap-0.5"
                            title="已匹配現有廠商主檔"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>既有</span>
                          </span>
                        )}
                        {row.vendorStatus === 'NEW' && row.vendorInputName.trim() && (
                          <button
                            type="button"
                            onClick={() => handleOpenQuickCreateVendor(row.id, row.vendorInputName)}
                            className="px-1.5 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold shrink-0 flex items-center gap-0.5 cursor-pointer"
                            title="未在廠商主庫發現，點擊極速建檔"
                          >
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            <span>新廠商</span>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 個案用料 / 案場名稱與專案代碼 */}
                    <td className="p-1 relative">
                      <div className="flex items-center gap-1">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="輸入或貼上案場俗稱/個案用料"
                            value={row.siteInputName}
                            onChange={e => handleCellChange(row.id, 'siteInputName', e.target.value)}
                            className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs font-semibold text-slate-900 outline-none transition-colors"
                          />
                          {row.projectCodeSnapshot && (
                            <div className="text-[10px] font-mono font-bold text-indigo-600 px-2">
                              專案代碼: {row.projectCodeSnapshot}
                            </div>
                          )}
                        </div>

                        {row.projectStatus === 'MATCHED' && (
                          <span 
                            className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0 flex items-center gap-0.5"
                            title="已匹配現有專案案場"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>已鎖定</span>
                          </span>
                        )}
                        {row.projectStatus === 'NEW' && row.siteInputName.trim() && (
                          <button
                            type="button"
                            onClick={() => handleOpenQuickCreateProject(row.id, row.siteInputName)}
                            className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold shrink-0 flex items-center gap-0.5 cursor-pointer"
                            title="未在案場清冊發現，點擊極速登記新案場代碼"
                          >
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>新案場</span>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 品名 */}
                    <td className="p-1 relative">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="例如 4000psi 混凝土 / 竹節鋼筋"
                          value={row.itemName}
                          onChange={e => handleCellChange(row.id, 'itemName', e.target.value)}
                          className="flex-1 px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs font-bold text-slate-800 outline-none transition-colors"
                        />
                        {row.itemName.trim() && (
                          <button
                            type="button"
                            onClick={() => handleOpenQuickCreateItem(row.id, row.itemName, row.unit, row.unitPrice)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 cursor-pointer transition-opacity"
                            title="將此用料登記至物料庫主檔"
                          >
                            <Package className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 規格 */}
                    <td className="p-1">
                      <input
                        type="text"
                        placeholder="如 #4, 15cm"
                        value={row.spec}
                        onChange={e => handleCellChange(row.id, 'spec', e.target.value)}
                        className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs outline-none transition-colors"
                      />
                    </td>

                    {/* 單位 */}
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.unit}
                        onChange={e => handleCellChange(row.id, 'unit', e.target.value)}
                        className="w-full px-1.5 py-1 text-center bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs font-medium outline-none transition-colors"
                      />
                    </td>

                    {/* 數量 */}
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

                    {/* 單價 */}
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

                    {/* 金額 (小計) - 即時動態計算 */}
                    <td className="p-1 text-right font-mono font-bold text-xs text-emerald-700 bg-emerald-50/50 px-2">
                      ${lineTotal.toLocaleString()}
                    </td>

                    {/* 送貨單號 */}
                    <td className="p-1">
                      <input
                        type="text"
                        placeholder="如 DN-3690"
                        value={row.deliveryNoteNumber}
                        onChange={e => handleCellChange(row.id, 'deliveryNoteNumber', e.target.value)}
                        className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded font-mono text-xs text-slate-700 outline-none transition-colors"
                      />
                    </td>

                    {/* 備註 */}
                    <td className="p-1">
                      <input
                        type="text"
                        placeholder="選填備註說明"
                        value={row.notes}
                        onChange={e => handleCellChange(row.id, 'notes', e.target.value)}
                        className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-indigo-500 rounded text-xs text-slate-600 outline-none transition-colors"
                      />
                    </td>

                    {/* 操作 (複製 / 刪除) */}
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

      {/* 底部摘要列與存檔按鈕 */}
      <div className="bg-white border-t border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-lg shrink-0">
        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">總行數:</span>
            <span className="font-mono font-bold text-slate-800 text-sm">{summaryStats.totalRows}</span>
            <span className="text-slate-400">（有效填寫：{summaryStats.filledCount} 筆）</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">本批進貨總計:</span>
            <span className="font-mono font-bold text-emerald-600 text-base">
              ${summaryStats.subtotal.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            取消關閉
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>儲存進貨單入庫</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* ⚡ 彈窗：就地完整建檔 (Quick Create Vendor / Project / Item Modal)       */}
      {/* ---------------------------------------------------------------------- */}
      {quickCreateType && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2.5 rounded-xl ${
                  quickCreateType === 'PROJECT' 
                    ? 'bg-amber-50 text-amber-600' 
                    : quickCreateType === 'VENDOR'
                    ? 'bg-purple-50 text-purple-600'
                    : 'bg-indigo-50 text-indigo-600'
                }`}>
                  {quickCreateType === 'PROJECT' && <Building2 className="w-5 h-5" />}
                  {quickCreateType === 'VENDOR' && <Sparkles className="w-5 h-5" />}
                  {quickCreateType === 'ITEM' && <Package className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {quickCreateType === 'PROJECT' && '⚡ 登記新案場 (自動配發專案代碼)'}
                    {quickCreateType === 'VENDOR' && '⚡ 登記新合作廠商 (同步寫入廠商主檔)'}
                    {quickCreateType === 'ITEM' && '⚡ 登記新物料品項 (建立物料主庫)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {quickCreateType === 'PROJECT' && '依系統單據編碼規範自動配發 PRJ 前綴代碼，未來案場模組直接連動共用'}
                    {quickCreateType === 'VENDOR' && '完整登記廠商統編、聯絡人與電話，正式建立【合作廠商清冊】檔案'}
                    {quickCreateType === 'ITEM' && '將現場用料登記為標準品項，未來打單可自動推薦'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickCreateType(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 新案場表單 */}
            {quickCreateType === 'PROJECT' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    案場專案全名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectNameInput}
                    onChange={e => setProjectNameInput(e.target.value)}
                    placeholder="如：大城蕭OO新建工程"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      個案用料 / 案場俗稱
                    </label>
                    <input
                      type="text"
                      value={projectSiteInput}
                      onChange={e => setProjectSiteInput(e.target.value)}
                      placeholder="如：大城蕭OO"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      起造人 / 業主姓名
                    </label>
                    <input
                      type="text"
                      value={projectOwnerInput}
                      onChange={e => setProjectOwnerInput(e.target.value)}
                      placeholder="如：蕭先生"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      業主統編 / 身分證號
                    </label>
                    <input
                      type="text"
                      value={projectOwnerTaxIdInput}
                      onChange={e => setProjectOwnerTaxIdInput(e.target.value)}
                      placeholder="選填統編或身分證"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      工地施工地址
                    </label>
                    <input
                      type="text"
                      value={projectAddressInput}
                      onChange={e => setProjectAddressInput(e.target.value)}
                      placeholder="如：彰化縣大城鄉..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between">
                  <div>
                    📌 <strong>單據編碼中樞預估產號</strong>：
                    <span className="font-mono font-bold ml-1 text-indigo-700">
                      {previewNextDocumentNumber('PRJ')}
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">
                    PRJ-YYYY-001 規範
                  </span>
                </div>
              </div>
            )}

            {/* 新合作廠商表單 (完整資訊，建立真正合作廠商主檔) */}
            {quickCreateType === 'VENDOR' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    合作廠商全銜 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={vendorNameInput}
                    onChange={e => setVendorNameInput(e.target.value)}
                    placeholder="如：東南預拌混凝土工廠 / 嘉新水泥"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      統一編號 (8 碼)
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={vendorTaxIdInput}
                      onChange={e => setVendorTaxIdInput(e.target.value)}
                      placeholder="如：88991234"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      材料/供料類別
                    </label>
                    <select
                      value={vendorCategoryInput}
                      onChange={e => setVendorCategoryInput(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    >
                      <option value="預拌混凝土">預拌混凝土</option>
                      <option value="鋼筋型鋼">鋼筋型鋼</option>
                      <option value="泥作建材">泥作建材</option>
                      <option value="水電五金">水電五金</option>
                      <option value="重機械租賃">重機械租賃</option>
                      <option value="現場材料建材">現場材料建材</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      業務 / 司機聯絡人
                    </label>
                    <input
                      type="text"
                      value={vendorContactInput}
                      onChange={e => setVendorContactInput(e.target.value)}
                      placeholder="如：王經理 / 李司機"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      聯絡電話 / 手機
                    </label>
                    <input
                      type="text"
                      value={vendorPhoneInput}
                      onChange={e => setVendorPhoneInput(e.target.value)}
                      placeholder="如：0912-345-678"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    公司通訊 / 出料廠址
                  </label>
                  <input
                    type="text"
                    value={vendorAddressInput}
                    onChange={e => setVendorAddressInput(e.target.value)}
                    placeholder="如：台中市工業區路..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900 text-[11px]">
                  🏛️ <strong>正式入庫合作廠商清冊</strong>：
                  點選後將正式寫入商業夥伴（Business Partners）模組，包含通訊錄與聯絡人資料，杜絕欄位短缺與資料遺漏。
                </div>
              </div>
            )}

            {/* 新料件表單 */}
            {quickCreateType === 'ITEM' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    料件品名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={itemNameInput}
                    onChange={e => setItemNameInput(e.target.value)}
                    placeholder="如：4000psi 預拌混凝土"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      單位
                    </label>
                    <input
                      type="text"
                      value={itemUnitInput}
                      onChange={e => setItemUnitInput(e.target.value)}
                      placeholder="如：包、立方米、支、式"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      預設單價
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={itemPriceInput}
                      onChange={e => setItemPriceInput(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    物料類別
                  </label>
                  <select
                    value={itemCategoryInput}
                    onChange={e => setItemCategoryInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="土木建材">土木建材</option>
                    <option value="預拌混凝土">預拌混凝土</option>
                    <option value="鋼筋五金">鋼筋五金</option>
                    <option value="水電材料">水電材料</option>
                    <option value="租賃耗材">租賃耗材</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickCreateType(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmQuickCreate}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>立即建立並回填</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
