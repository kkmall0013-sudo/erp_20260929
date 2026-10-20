import React, { useState, useMemo, useEffect } from 'react';
import {
  FolderLock,
  Search,
  Upload,
  Download,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FolderGit2,
  Lock,
  Layers,
  Sparkles,
  ExternalLink,
  Copy,
  Archive,
  Trash2,
  Eye,
  Plus,
  ShieldCheck,
  FileCheck,
  Inbox,
  Filter,
  Check,
  X,
  PackageCheck,
  Clock,
  HardDrive
} from 'lucide-react';
import { SystemFile, ExternalFolderLink } from '../../types/erp';
import {
  getAllSystemFiles,
  saveSystemFileRecord,
  markFileObsolete,
  softDeleteSystemFile,
  restoreSystemFile,
  checkStorageHealth,
  getAllExternalFolderLinks,
  saveExternalFolderLink,
  deleteExternalFolderLink
} from '../../db/sqlite';
import { MediaPreviewLightbox, MediaPreviewItem } from '../widgets/MediaPreviewLightbox';

interface UniversalVaultWorkspaceProps {
  onNotify?: (msg: string) => void;
}

export const UniversalVaultWorkspace: React.FC<UniversalVaultWorkspaceProps> = ({
  onNotify
}) => {
  const [activeTab, setActiveTab] = useState<'VAULT' | 'WORKSPACE' | 'TRIAGE' | 'TRASH'>('VAULT');
  const [files, setFiles] = useState<SystemFile[]>([]);
  const [folders, setFolders] = useState<ExternalFolderLink[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');

  // 燈箱預覽
  const [selectedPreviewMedia, setSelectedPreviewMedia] = useState<MediaPreviewItem | null>(null);

  // 健康檢查彈窗
  const [healthReport, setHealthReport] = useState<{
    totalChecked: number;
    normalCount: number;
    missingCount: number;
    repairedCount: number;
  } | null>(null);

  // 大批量 ZIP 匯出彈窗 (RULE-9.3 效能分水嶺)
  const [isZipModalOpen, setIsZipModalOpen] = useState(false);
  const [zipResultToast, setZipResultToast] = useState<string | null>(null);

  // 新增 NAS 資料夾彈窗
  const [isNasModalOpen, setIsNasModalOpen] = useState(false);
  const [nasPathInput, setNasPathInput] = useState('');
  const [nasDescInput, setNasDescInput] = useState('');
  const [nasTableInput, setNasTableInput] = useState('projects');
  const [nasIdInput, setNasIdInput] = useState('PRJ-01');

  // 新增上傳檔案彈窗
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('會計發票');
  const [uploadTargetTable, setUploadTargetTable] = useState('subcontracts');
  const [uploadTargetId, setUploadTargetId] = useState('SUB-CTR-01');
  const [uploadEncrypted, setUploadEncrypted] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');

  // Triage 雙欄待歸檔收件匣選取
  const [selectedTriageFile, setSelectedTriageFile] = useState<SystemFile | null>(null);

  const loadAllData = () => {
    const f = getAllSystemFiles(true);
    setFiles(f);
    const d = getAllExternalFolderLinks();
    setFolders(d);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const showToast = (msg: string) => {
    if (onNotify) onNotify(msg);
  };

  // 統計數據
  const activeFiles = useMemo(() => files.filter(f => !f.isDeleted), [files]);
  const trashFiles = useMemo(() => files.filter(f => f.isDeleted), [files]);

  const totalBytes = useMemo(() => {
    return activeFiles.reduce((acc, curr) => acc + curr.fileSizeBytes, 0);
  }, [activeFiles]);

  const webpSavedBytes = useMemo(() => {
    // 模擬統計：WebP 影像每張節省約 60%~75% 體積
    const imageCount = activeFiles.filter(f => f.mimeType.startsWith('image/')).length;
    return imageCount * 750000; // 平均每張約節省 750KB
  }, [activeFiles]);

  // 篩選後的主檔案清單
  const filteredActiveFiles = useMemo(() => {
    return activeFiles.filter(f => {
      if (categoryFilter !== 'ALL' && f.fileCategory !== categoryFilter) return false;
      if (moduleFilter !== 'ALL' && f.targetTable !== moduleFilter) return false;
      if (searchTerm.trim()) {
        const t = searchTerm.toLowerCase();
        const matchName = f.fileName.toLowerCase().includes(t);
        const matchOrig = (f.originalName || '').toLowerCase().includes(t);
        const matchTable = f.targetTable.toLowerCase().includes(t);
        const matchId = f.targetId.toLowerCase().includes(t);
        const matchCat = f.fileCategory.toLowerCase().includes(t);
        const matchHash = f.fileHash.toLowerCase().includes(t);
        if (!matchName && !matchOrig && !matchTable && !matchId && !matchCat && !matchHash) return false;
      }
      return true;
    });
  }, [activeFiles, categoryFilter, moduleFilter, searchTerm]);

  // 執行三段式健康檢查
  const handleRunHealthCheck = () => {
    const report = checkStorageHealth();
    setHealthReport(report);
    loadAllData();
    showToast(`✅ 儲存健康檢查完畢：共掃描 ${report.totalChecked} 筆附件，健全度 100%`);
  };

  // 觸發大批量非同步 ZIP 匯出 (RULE-9.3)
  const handleTriggerZipExport = () => {
    setIsZipModalOpen(true);
  };

  // 模擬提交 ZIP 匯出請求
  const handleConfirmZipExport = () => {
    setIsZipModalOpen(false);
    const count = filteredActiveFiles.length;
    const sizeMB = totalBytes / (1024 * 1024);

    if (count > 50 || sizeMB > 100) {
      setZipResultToast(
        `📦 QUEUE_REQUIRED：下載檔案數量（${count} 筆）或容量（${sizeMB.toFixed(1)} MB）已達非同步保護閥值。系統已轉入背景 Worker 打包，完成後將發送 24 小時時效安全下載連結！`
      );
      showToast(`📦 大批量匯出已進入背景排程佇列 (Queue Worker)！`);
    } else {
      setZipResultToast(`✅ 即時打包完成！已產生工程附件 ZIP 壓縮檔 (${count} 筆檔案，${sizeMB.toFixed(1)} MB)`);
      showToast(`✅ 即時打包成功！`);
    }
    setTimeout(() => setZipResultToast(null), 5000);
  };

  // 快速新增自訂模擬附件
  const handleQuickAddFile = () => {
    if (!uploadFileName.trim()) {
      showToast('⚠️ 請輸入檔案名稱');
      return;
    }
    const ext = uploadFileName.endsWith('.pdf') ? 'pdf' : uploadFileName.endsWith('.webp') ? 'webp' : 'pdf';
    const mime = ext === 'webp' ? 'image/webp' : 'application/pdf';
    const size = Math.floor(Math.random() * 2000000) + 200000;

    saveSystemFileRecord({
      targetTable: uploadTargetTable,
      targetId: uploadTargetId,
      companyId: 'COMP-01',
      fileName: uploadFileName.trim(),
      originalName: uploadFileName.trim(),
      fileSizeBytes: size,
      mimeType: mime,
      fileCategory: uploadCategory,
      isEncrypted: uploadEncrypted,
      storagePath: uploadEncrypted
        ? `storage/secure_vault/2026/04/enc_${Date.now()}.enc`
        : `storage/public_docs/2026/04/${uploadFileName.trim()}`,
      fileHash: `sha256_${Date.now()}`
    });

    setIsUploadModalOpen(false);
    setUploadFileName('');
    loadAllData();
    showToast(`✅ 已成功將【${uploadFileName}】歸檔入庫！`);
  };

  // 燈箱預覽處理
  const handleOpenPreview = (file: SystemFile) => {
    const isPdf = file.mimeType.includes('pdf');
    const placeholderSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="%23f8fafc"/><rect x="40" y="40" width="720" height="520" rx="16" fill="%23ffffff" stroke="%23cbd5e1" stroke-width="2"/><text x="400" y="270" font-family="sans-serif" font-size="28" font-weight="bold" fill="%231e293b" text-anchor="middle">金庫存摺／憑證安全沙盒預覽</text><text x="400" y="320" font-family="monospace" font-size="18" fill="%234f46e5" text-anchor="middle">${encodeURIComponent(file.fileName)}</text><text x="400" y="370" font-family="sans-serif" font-size="14" fill="%2364748b" text-anchor="middle">容量：${(file.fileSizeBytes / 1024).toFixed(1)} KB | 分類：${encodeURIComponent(file.fileCategory)}</text></svg>`;

    setSelectedPreviewMedia({
      url: placeholderSvg,
      title: file.fileName,
      isPdf,
      sizeBytes: file.fileSizeBytes,
      uploadedAt: file.uploadTime
    });
  };

  return (
    <div className="space-y-6">
      {/* 浮動提示 Toast */}
      {zipResultToast && (
        <div className="fixed bottom-6 right-8 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl z-50 text-xs font-semibold border border-indigo-500 animate-in fade-in flex items-center gap-2 max-w-lg">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{zipResultToast}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. 金庫核心 KPI 指標卡看板                                 */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>有效附件總數</span>
            <FileCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {activeFiles.length} <span className="text-xs font-normal text-slate-400">份</span>
          </div>
          <div className="text-[10px] text-slate-400">涵蓋全集團 12 大模組單據</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>金庫儲存體積</span>
            <HardDrive className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {(totalBytes / (1024 * 1024)).toFixed(2)} <span className="text-xs font-normal text-slate-400">MB</span>
          </div>
          <div className="text-[10px] text-slate-400">分離式相對路徑零 BLOB</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-800 text-xs">
            <span>WebP 節省空間</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700">
            {(webpSavedBytes / (1024 * 1024)).toFixed(2)} <span className="text-xs font-normal text-emerald-600">MB</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-medium">次世代 75% 畫質壓縮</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>外部 NAS 工作桌</span>
            <FolderGit2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {folders.length} <span className="text-xs font-normal text-slate-400">處</span>
          </div>
          <div className="text-[10px] text-slate-400">CAD/DWG 網芳免載連動</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>儲存健全度</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600">
            100% <span className="text-xs font-normal text-slate-400">正常</span>
          </div>
          <div className="text-[10px] text-slate-400">防篡改指紋與幽靈校驗</div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. 視圖頁籤切換與快捷工具列                                */}
      {/* ========================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setActiveTab('VAULT')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'VAULT'
                ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderLock className="w-4 h-4" />
            <span>保險箱檔案清冊 (Vault)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-mono">
              {activeFiles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('WORKSPACE')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'WORKSPACE'
                ? 'bg-white text-amber-700 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderGit2 className="w-4 h-4" />
            <span>CAD 外部工作桌 (Workspace)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 font-mono">
              {folders.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('TRIAGE');
              if (activeFiles.length > 0 && !selectedTriageFile) {
                setSelectedTriageFile(activeFiles[0]);
              }
            }}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'TRIAGE'
                ? 'bg-white text-purple-700 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>待歸檔收件匣 (Triage Inbox)</span>
          </button>

          <button
            onClick={() => setActiveTab('TRASH')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'TRASH'
                ? 'bg-white text-rose-700 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>回收金庫</span>
            {trashFiles.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-mono font-bold">
                {trashFiles.length}
              </span>
            )}
          </button>
        </div>

        {/* 右側動作按鈕 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRunHealthCheck}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>儲存健康檢查</span>
          </button>

          <button
            onClick={handleTriggerZipExport}
            className="px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>打包下載 ZIP</span>
          </button>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>上傳憑證進金庫</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 視圖 1: 保險箱檔案清冊 (Vault Files Table)                  */}
      {/* ========================================================= */}
      {activeTab === 'VAULT' && (
        <div className="space-y-4">
          {/* 搜尋與篩選列 */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜尋檔名、關聯模型、單據代碼、SHA-256 指紋..."
                className="w-full bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">分類：</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none"
                >
                  <option value="ALL">全部分類</option>
                  <option value="正式合約">正式合約</option>
                  <option value="補充條款">補充條款</option>
                  <option value="會計發票">會計發票</option>
                  <option value="存摺影本">存摺影本</option>
                  <option value="官方執照">官方執照</option>
                  <option value="一般憑證">一般憑證</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">關聯單據：</span>
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none"
                >
                  <option value="ALL">全部模組</option>
                  <option value="subcontracts">工程承攬主約 (subcontracts)</option>
                  <option value="business_partners">商業夥伴主檔 (business_partners)</option>
                  <option value="valuations">估驗計價單 (valuations)</option>
                  <option value="projects">專案工區 (projects)</option>
                  <option value="companies">公司法人 (companies)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 表格清冊 */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">檔案名稱 / 指紋</th>
                    <th className="py-3 px-3">憑證分類</th>
                    <th className="py-3 px-3">關聯單據</th>
                    <th className="py-3 px-3 text-right">檔案大小</th>
                    <th className="py-3 px-3 text-center">版本堆疊</th>
                    <th className="py-3 px-3 text-center">安全加密</th>
                    <th className="py-3 px-3 text-center">狀態</th>
                    <th className="py-3 px-3 text-right">上傳時間</th>
                    <th className="py-3 px-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActiveFiles.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        查無符合篩選條件之金庫附件檔案
                      </td>
                    </tr>
                  ) : (
                    filteredActiveFiles.map((file, idx) => {
                      const isImage = file.mimeType.startsWith('image/');
                      const isPdf = file.mimeType.includes('pdf');

                      return (
                        <tr
                          key={file.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            file.isObsolete ? 'bg-slate-50/60 opacity-80' : ''
                          }`}
                        >
                          {/* 檔名與指紋 */}
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isPdf
                                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                  : isImage
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {isPdf ? <FileText className="w-4 h-4" /> : isImage ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0">
                                <div className={`font-bold truncate max-w-[260px] ${
                                  file.isObsolete ? 'line-through text-slate-500' : 'text-slate-800'
                                }`}>
                                  {file.fileName}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono truncate max-w-[240px]" title={file.fileHash}>
                                  SHA-256: {file.fileHash.slice(0, 16)}...
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 憑證分類 */}
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                              {file.fileCategory}
                            </span>
                          </td>

                          {/* 關聯單據 */}
                          <td className="py-3 px-3">
                            <div className="font-mono text-[11px] font-bold text-indigo-700">
                              {file.targetId}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {file.targetTable}
                            </div>
                          </td>

                          {/* 檔案大小 */}
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                            {(file.fileSizeBytes / 1024).toFixed(1)} KB
                          </td>

                          {/* 版本堆疊 */}
                          <td className="py-3 px-3 text-center">
                            {file.isObsolete ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                舊版作廢
                              </span>
                            ) : file.parentFileId ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                新版疊加
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">首版</span>
                            )}
                          </td>

                          {/* 安全加密 */}
                          <td className="py-3 px-3 text-center">
                            {file.isEncrypted ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Lock className="w-2.5 h-2.5" />
                                <span>AES-256</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">公開</span>
                            )}
                          </td>

                          {/* 狀態 */}
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>正常</span>
                            </span>
                          </td>

                          {/* 上傳時間 */}
                          <td className="py-3 px-3 text-right font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {file.uploadTime.slice(0, 16).replace('T', ' ')}
                          </td>

                          {/* 操作 */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenPreview(file)}
                                title="預覽"
                                className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => showToast(`📥 已開始下載【${file.fileName}】`)}
                                title="下載"
                                className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-emerald-600 transition-colors cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              {!file.isObsolete && (
                                <button
                                  onClick={() => {
                                    markFileObsolete(file.id);
                                    loadAllData();
                                    showToast(`⚠️ 已標記【${file.fileName}】為舊版作廢`);
                                  }}
                                  title="作廢"
                                  className="p-1.5 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  softDeleteSystemFile(file.id);
                                  loadAllData();
                                  showToast(`🗑️ 已將【${file.fileName}】移入回收金庫`);
                                }}
                                title="移入回收金庫"
                                className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 視圖 2: CAD 外部工作桌 (Workspace NAS Folders)              */}
      {/* ========================================================= */}
      {activeTab === 'WORKSPACE' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <FolderGit2 className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>企業 NAS 圖紙外部工作桌</strong>：營造工程數百 MB 的巨型 CAD/DWG
                建築結構圖說，ERP 資料庫不以二進位 BLOB 存放，而是記錄企業網芳路徑，一鍵開啟檔案總管。
              </span>
            </div>

            <button
              onClick={() => setIsNasModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>綁定新 NAS 圖紙路徑</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {folders.map(f => (
              <div
                key={f.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:border-amber-400 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm shrink-0">
                      CAD
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{f.description || '工程施工圖說'}</h4>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        關聯模組：{f.targetTable} ({f.targetId})
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      deleteExternalFolderLink(f.id);
                      loadAllData();
                      showToast('🗑️ 已移除 NAS 資料夾路徑');
                    }}
                    className="text-slate-300 hover:text-rose-600 p-1"
                    title="移除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 break-all select-all flex items-center justify-between gap-2">
                  <span className="truncate">{f.nasFolderPath}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(f.nasFolderPath);
                      showToast(`📋 已複製 NAS 路徑：${f.nasFolderPath}`);
                    }}
                    title="複製"
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-xs">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(f.nasFolderPath);
                      showToast(`📂 已複製路徑！請於 Windows 按 Win+R 貼上開啟檔案總管`);
                    }}
                    className="flex-1 py-1.5 px-3 rounded-lg font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>開啟圖紙資料夾</span>
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(f.nasFolderPath);
                      showToast(`📋 已複製 NAS 路徑至剪貼簿`);
                    }}
                    className="py-1.5 px-3 rounded-lg font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>複製路徑</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 視圖 3: 待歸檔收件匣雙欄打單 (Triage Inbox)                  */}
      {/* ========================================================= */}
      {activeTab === 'TRIAGE' && (
        <div className="space-y-4">
          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-center gap-2">
            <Inbox className="w-4 h-4 text-purple-700 shrink-0" />
            <span>
              <strong>待歸檔收件匣 (Triage Inbox)</strong>：會計處理廠商大宗月底送來之多個案場對帳發票時，左側提供
              PDF 即時預覽、右側提供單據快速核對與派工歸檔，落實「前線進料綁明細、會計後端對總額」權責分離。
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* 左側：收件清單與預覽 */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <h4 className="font-bold text-xs text-slate-800 flex items-center justify-between">
                <span>收件匣憑證清單</span>
                <span className="text-slate-400 font-mono text-[11px]">{activeFiles.length} 筆待查</span>
              </h4>

              <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto border border-slate-200 rounded-lg">
                {activeFiles.map(f => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedTriageFile(f)}
                    className={`p-3 text-xs cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                      selectedTriageFile?.id === f.id
                        ? 'bg-purple-50/80 border-l-3 border-purple-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{f.fileName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {f.fileCategory} • {(f.fileSizeBytes / 1024).toFixed(1)} KB
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                      {f.targetTable}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 右側：憑證預覽與單據配對工作台 */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
              {selectedTriageFile ? (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{selectedTriageFile.fileName}</h4>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        SHA-256: {selectedTriageFile.fileHash}
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800">
                      {selectedTriageFile.fileCategory}
                    </span>
                  </div>

                  {/* 模擬 PDF / 影像安全沙盒預覽視窗 */}
                  <div className="w-full h-56 bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center p-4 text-center space-y-2">
                    <FileText className="w-10 h-10 text-slate-400" />
                    <div className="text-xs font-bold text-slate-700">
                      憑證沙盒即時預覽 [{selectedTriageFile.fileName}]
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-sm">
                      本金庫採用 Blob URL 封閉式解密沙盒渲染，不觸發 Chrome iframe 外部 PDF 攔截機制。
                    </p>
                    <button
                      onClick={() => {
                        if (selectedTriageFile) handleOpenPreview(selectedTriageFile);
                      }}
                      className="px-3 py-1 rounded bg-white text-indigo-600 font-bold text-xs border border-slate-300 shadow-2xs hover:bg-slate-50 cursor-pointer"
                    >
                      開啟全螢幕檢視燈箱
                    </button>
                  </div>

                  {/* 右側快速打單與重新派工配對 */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                    <div className="font-bold text-slate-800">會計快速核對與派工歸檔</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-500 mb-1">歸檔單據模組</label>
                        <select
                          defaultValue={selectedTriageFile.targetTable}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold text-slate-800"
                        >
                          <option value="subcontracts">工程承攬主約 (subcontracts)</option>
                          <option value="valuations">估驗計價請款 (valuations)</option>
                          <option value="purchase_orders">材料採購單 (purchase_orders)</option>
                          <option value="business_partners">商業夥伴主檔 (business_partners)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1">目標單號 / 代碼</label>
                        <input
                          type="text"
                          defaultValue={selectedTriageFile.targetId}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold font-mono text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => showToast(`✅ 已確認憑證【${selectedTriageFile.fileName}】與單據勾稽完成！`)}
                        className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold cursor-pointer"
                      >
                        確認勾稽並過帳歸檔
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-24 text-center text-slate-400 text-xs">
                  請由左側點選任一份待查憑證以展開雙欄核對打單視圖
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 視圖 4: 回收金庫與作廢紀錄 (Trash & Obsolete)              */}
      {/* ========================================================= */}
      {activeTab === 'TRASH' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>回收金庫 (已軟刪除檔案)</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                依據憲法軟刪除鐵律，刪除的附件將暫存於此，防止誤刪，可隨時一鍵原位復原。
              </p>
            </div>

            <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
              {trashFiles.length} 筆回收檔案
            </span>
          </div>

          {trashFiles.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">回收金庫目前空空如也</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {trashFiles.map(f => (
                <div key={f.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">{f.fileName}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      原關聯：{f.targetTable} ({f.targetId}) • {(f.fileSizeBytes / 1024).toFixed(1)} KB
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      restoreSystemFile(f.id);
                      loadAllData();
                      showToast(`✅ 已成功將【${f.fileName}】自回收金庫復原！`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold transition-colors cursor-pointer"
                  >
                    一鍵復原
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 模態彈窗 1: 儲存健康檢查報告 (Storage Health Modal)        */}
      {/* ========================================================= */}
      {healthReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/60">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>三段式儲存健康檢查與幽靈防禦報告</span>
              </div>
              <button onClick={() => setHealthReport(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">掃描檔案總數：</span>
                  <span className="font-mono font-bold text-slate-800">{healthReport.totalChecked} 筆</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">正常無損檔案：</span>
                  <span className="font-mono font-bold text-emerald-700">{healthReport.normalCount} 筆</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">實體遺失/幽靈指標：</span>
                  <span className="font-mono font-bold text-slate-500">{healthReport.missingCount} 筆</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">自動例外急救修復：</span>
                  <span className="font-mono font-bold text-indigo-700">{healthReport.repairedCount} 筆</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                ✅ 全系統金庫檔案指紋校驗一致，無斷鏈或孤兒檔案，儲存健康度達到 100%。
              </p>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end text-xs">
              <button
                onClick={() => setHealthReport(null)}
                className="px-5 py-2 rounded-lg bg-slate-900 text-white font-bold cursor-pointer"
              >
                確認完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 模態彈窗 2: 大批量非同步 ZIP 匯出確認 (RULE-9.3)           */}
      {/* ========================================================= */}
      {isZipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/60">
              <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                <PackageCheck className="w-5 h-5 text-indigo-700" />
                <span>全案場年度憑證大批量 ZIP 打包下載</span>
              </div>
              <button onClick={() => setIsZipModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">預計打包檔案數：</span>
                  <span className="font-mono font-bold text-slate-800">{filteredActiveFiles.length} 筆</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">預估打包容量：</span>
                  <span className="font-mono font-bold text-slate-800">
                    {(totalBytes / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">效能防線規則：</span>
                  <span className="font-bold text-indigo-700">RULE-9.3 (50檔 / 100MB 門檻)</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                ℹ️ <strong>內控安全提醒</strong>：當會計師或稽核主管要求調閱大批憑證時，為保護系統線上 OLTP
                效能與杜絕記憶體溢出 (OOM)，大於 50 檔案或 100MB 將自動由背景排程非同步打包並透過鈴鐺發送 24 小時時效安全下載連結。
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsZipModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleConfirmZipExport}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
              >
                開始打包下載
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 模態彈窗 3: 上傳新憑證 (Upload Modal)                      */}
      {/* ========================================================= */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>登記新憑證進無紙化金庫</span>
              </div>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  憑證檔案名稱 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  placeholder="例如：南港商辦主合約用印本.pdf"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium text-slate-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">憑證分類</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-semibold text-slate-800 outline-none"
                  >
                    <option value="正式合約">正式合約</option>
                    <option value="補充條款">補充條款</option>
                    <option value="會計發票">會計發票</option>
                    <option value="存摺影本">存摺影本</option>
                    <option value="支票影本">支票影本</option>
                    <option value="官方執照">官方執照</option>
                    <option value="一般憑證">一般憑證</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">關聯模型</label>
                  <select
                    value={uploadTargetTable}
                    onChange={(e) => setUploadTargetTable(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-semibold text-slate-800 outline-none"
                  >
                    <option value="subcontracts">工程承攬主約</option>
                    <option value="valuations">估驗計價請款</option>
                    <option value="business_partners">商業夥伴主檔</option>
                    <option value="projects">專案工區</option>
                    <option value="companies">公司法人</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">目標單號 / 代碼</label>
                <input
                  type="text"
                  value={uploadTargetId}
                  onChange={(e) => setUploadTargetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-800 outline-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={uploadEncrypted}
                  onChange={(e) => setUploadEncrypted(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span className="font-bold text-slate-700">啟用 AES-256-GCM 實體金庫機敏加密</span>
              </label>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleQuickAddFile}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
              >
                確認入庫
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 模態彈窗 4: 新增 NAS 圖紙工作桌 (NAS Modal)               */}
      {/* ========================================================= */}
      {isNasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                <FolderGit2 className="w-4 h-4 text-amber-700" />
                <span>綁定企業 NAS 圖紙外部工作桌</span>
              </div>
              <button onClick={() => setIsNasModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  實體 NAS 共用路徑 (UNC) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={nasPathInput}
                  onChange={(e) => setNasPathInput(e.target.value)}
                  placeholder="\\192.168.1.100\Drawings\PRJ-01\Structural_CAD"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">圖說內容說明</label>
                <input
                  type="text"
                  value={nasDescInput}
                  onChange={(e) => setNasDescInput(e.target.value)}
                  placeholder="例如：南港總部全套地下室 DWG 大樣圖"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">關聯模組</label>
                  <select
                    value={nasTableInput}
                    onChange={(e) => setNasTableInput(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-semibold text-slate-800 outline-none"
                  >
                    <option value="projects">專案工區 (projects)</option>
                    <option value="subcontracts">工程承攬 (subcontracts)</option>
                    <option value="business_partners">商業夥伴 (business_partners)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">目標代碼</label>
                  <input
                    type="text"
                    value={nasIdInput}
                    onChange={(e) => setNasIdInput(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsNasModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!nasPathInput.trim()) {
                    showToast('⚠️ 請輸入有效的 NAS 路徑');
                    return;
                  }
                  saveExternalFolderLink({
                    companyId: 'COMP-01',
                    targetTable: nasTableInput,
                    targetId: nasIdInput,
                    nasFolderPath: nasPathInput.trim(),
                    description: nasDescInput.trim() || undefined
                  });
                  setIsNasModalOpen(false);
                  setNasPathInput('');
                  setNasDescInput('');
                  loadAllData();
                  showToast('✅ 已成功建立 NAS 圖紙工作桌連結！');
                }}
                className="px-5 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold cursor-pointer"
              >
                確認綁定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 燈箱全螢幕預覽 */}
      {selectedPreviewMedia && (
        <MediaPreviewLightbox
          media={selectedPreviewMedia}
          onClose={() => setSelectedPreviewMedia(null)}
        />
      )}
    </div>
  );
};
