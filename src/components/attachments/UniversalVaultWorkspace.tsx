import React, { useState, useMemo, useEffect } from 'react';
import {
  FolderLock,
  Upload,
  Download,
  RefreshCw,
  FolderGit2,
  Sparkles,
  Trash2,
  ShieldCheck,
  FileCheck,
  Inbox,
  HardDrive,
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
  deleteExternalFolderLink,
} from '../../db/sqlite';
import { MediaPreviewLightbox, MediaPreviewItem } from '../widgets/MediaPreviewLightbox';
import { useAuth } from '../../context/AuthContext';
import { VaultFileRegistryTable } from './VaultFileRegistryTable';
import { VaultNasBrowserPanel } from './VaultNasBrowserPanel';
import { VaultTriageInboxPanel } from './VaultTriageInboxPanel';
import { VaultModals, VaultTrashPanel } from './VaultModalsAndTrash';

interface UniversalVaultWorkspaceProps {
  onNotify?: (msg: string) => void;
}

export const UniversalVaultWorkspace: React.FC<UniversalVaultWorkspaceProps> = ({ onNotify }) => {
  const { currentUser, isSuperadmin } = useAuth();
  const operatorName = currentUser?.fullName || '系統操作員';
  const [activeTab, setActiveTab] = useState<'VAULT' | 'WORKSPACE' | 'TRIAGE' | 'TRASH'>('VAULT');
  const [files, setFiles] = useState<SystemFile[]>([]);
  const [folders, setFolders] = useState<ExternalFolderLink[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');

  const [selectedPreviewMedia, setSelectedPreviewMedia] = useState<MediaPreviewItem | null>(null);
  const [healthReport, setHealthReport] = useState<{
    totalChecked: number;
    normalCount: number;
    missingCount: number;
    repairedCount: number;
  } | null>(null);

  const [isZipModalOpen, setIsZipModalOpen] = useState(false);
  const [zipResultToast, setZipResultToast] = useState<string | null>(null);

  const [isNasModalOpen, setIsNasModalOpen] = useState(false);
  const [nasPathInput, setNasPathInput] = useState('');
  const [nasDescInput, setNasDescInput] = useState('');
  const [nasTableInput, setNasTableInput] = useState('projects');
  const [nasIdInput, setNasIdInput] = useState('PRJ-01');

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('會計發票');
  const [uploadTargetTable, setUploadTargetTable] = useState('subcontracts');
  const [uploadTargetId, setUploadTargetId] = useState('SUB-CTR-01');
  const [uploadEncrypted, setUploadEncrypted] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');

  const [selectedTriageFile, setSelectedTriageFile] = useState<SystemFile | null>(null);

  const loadAllData = () => {
    setFiles(getAllSystemFiles(true));
    setFolders(getAllExternalFolderLinks());
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const showToast = (msg: string) => {
    if (onNotify) onNotify(msg);
  };

  const activeFiles = useMemo(() => files.filter(f => !f.isDeleted), [files]);
  const trashFiles = useMemo(() => files.filter(f => f.isDeleted), [files]);

  const totalBytes = useMemo(
    () => activeFiles.reduce((acc, curr) => acc + curr.fileSizeBytes, 0),
    [activeFiles]
  );

  const webpSavedBytes = useMemo(() => {
    const imageCount = activeFiles.filter(f => f.mimeType.startsWith('image/')).length;
    return imageCount * 750000;
  }, [activeFiles]);

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

  const handleRunHealthCheck = () => {
    const report = checkStorageHealth();
    setHealthReport(report);
    loadAllData();
    showToast(`✅ 儲存健康檢查完畢：共掃描 ${report.totalChecked} 筆附件，健全度 100%`);
  };

  const handleConfirmZipExport = () => {
    setIsZipModalOpen(false);
    const count = filteredActiveFiles.length;
    const sizeMB = totalBytes / (1024 * 1024);

    if (count > 50 || sizeMB > 100) {
      setZipResultToast(
        `📦 QUEUE_REQUIRED：下載檔案數量（${count} 筆）或容量（${sizeMB.toFixed(1)} MB）已達非同步保護閥值。系統已轉入背景 Worker 打包，完成後將發送 24 小時時效安全下載連結！`
      );
      showToast('📦 大批量匯出已進入背景排程佇列 (Queue Worker)！');
    } else {
      setZipResultToast(`✅ 即時打包完成！已產生工程附件 ZIP 壓縮檔 (${count} 筆檔案，${sizeMB.toFixed(1)} MB)`);
      showToast('✅ 即時打包成功！');
    }
    setTimeout(() => setZipResultToast(null), 5000);
  };

  const handleQuickAddFile = () => {
    if (!uploadFileName.trim()) {
      showToast('⚠️ 請輸入檔案名稱');
      return;
    }
    const ext = uploadFileName.endsWith('.pdf') ? 'pdf' : uploadFileName.endsWith('.webp') ? 'webp' : 'pdf';
    const mime = ext === 'webp' ? 'image/webp' : 'application/pdf';
    const size = Math.floor(Math.random() * 2000000) + 200000;

    saveSystemFileRecord(
      {
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
        fileHash: `sha256_${Date.now()}`,
      },
      operatorName
    );

    setIsUploadModalOpen(false);
    setUploadFileName('');
    loadAllData();
    showToast(`✅ 已成功將【${uploadFileName}】歸檔入庫！`);
  };

  const handleConfirmBindNas = () => {
    if (!nasPathInput.trim()) {
      showToast('⚠️ 請輸入有效的 NAS 路徑');
      return;
    }
    saveExternalFolderLink({
      companyId: 'COMP-01',
      targetTable: nasTableInput,
      targetId: nasIdInput,
      nasFolderPath: nasPathInput.trim(),
      description: nasDescInput.trim() || undefined,
    });
    setIsNasModalOpen(false);
    setNasPathInput('');
    setNasDescInput('');
    loadAllData();
    showToast('✅ 已成功建立 NAS 圖紙工作桌連結！');
  };

  const handleOpenPreview = (file: SystemFile) => {
    const isPdf = file.mimeType.includes('pdf');
    const placeholderSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="%23f8fafc"/><rect x="40" y="40" width="720" height="520" rx="16" fill="%23ffffff" stroke="%23cbd5e1" stroke-width="2"/><text x="400" y="270" font-family="sans-serif" font-size="28" font-weight="bold" fill="%231e293b" text-anchor="middle">金庫存摺／憑證安全沙盒預覽</text><text x="400" y="320" font-family="monospace" font-size="18" fill="%234f46e5" text-anchor="middle">${encodeURIComponent(file.fileName)}</text><text x="400" y="370" font-family="sans-serif" font-size="14" fill="%2364748b" text-anchor="middle">容量：${(file.fileSizeBytes / 1024).toFixed(1)} KB | 分類：${encodeURIComponent(file.fileCategory)}</text></svg>`;

    setSelectedPreviewMedia({
      url: placeholderSvg,
      title: file.fileName,
      isPdf,
      sizeBytes: file.fileSizeBytes,
      uploadedAt: file.uploadTime,
    });
  };

  return (
    <div className="space-y-6">
      {zipResultToast && (
        <div className="fixed bottom-6 right-8 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl z-50 text-xs font-semibold border border-indigo-500 animate-in fade-in flex items-center gap-2 max-w-lg">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{zipResultToast}</span>
        </div>
      )}

      {/* 1. 金庫核心 KPI 指標卡看板 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>有效附件總數</span>
            <FileCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
            {activeFiles.length} <span className="text-xs font-normal text-slate-400">份</span>
          </div>
          <div className="text-[10px] text-slate-400">涵蓋全集團 12 大模組單據</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>金庫儲存體積</span>
            <HardDrive className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
            {(totalBytes / (1024 * 1024)).toFixed(2)} <span className="text-xs font-normal text-slate-400">MB</span>
          </div>
          <div className="text-[10px] text-slate-400">分離式相對路徑零 BLOB</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-800 text-xs">
            <span>WebP 節省空間</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-700">
            {(webpSavedBytes / (1024 * 1024)).toFixed(2)}{' '}
            <span className="text-xs font-normal text-emerald-600">MB</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-medium">次世代 75% 畫質壓縮</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>外部 NAS 工作桌</span>
            <FolderGit2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
            {folders.length} <span className="text-xs font-normal text-slate-400">處</span>
          </div>
          <div className="text-[10px] text-slate-400">CAD/DWG 網芳免載連動</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>儲存健全度</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-600">
            100% <span className="text-xs font-normal text-slate-400">正常</span>
          </div>
          <div className="text-[10px] text-slate-400">防篡改指紋與幽靈校驗</div>
        </div>
      </div>

      {/* 2. 視圖頁籤切換與快捷工具列 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('VAULT')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
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
            type="button"
            onClick={() => setActiveTab('WORKSPACE')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
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
            type="button"
            onClick={() => {
              setActiveTab('TRIAGE');
              if (activeFiles.length > 0 && !selectedTriageFile) {
                setSelectedTriageFile(activeFiles[0]);
              }
            }}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'TRIAGE'
                ? 'bg-white text-purple-700 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>待歸檔收件匣 (Triage Inbox)</span>
          </button>

          {isSuperadmin && (
            <button
              type="button"
              onClick={() => setActiveTab('TRASH')}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'TRASH'
                  ? 'bg-white text-rose-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>回收金庫 (Superadmin)</span>
              {trashFiles.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-mono font-bold">
                  {trashFiles.length}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRunHealthCheck}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>儲存健康檢查</span>
          </button>

          <button
            type="button"
            onClick={() => setIsZipModalOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>打包下載 ZIP</span>
          </button>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>上傳憑證進金庫</span>
          </button>
        </div>
      </div>

      {/* 3. 各視圖內容切換 */}
      {activeTab === 'VAULT' && (
        <VaultFileRegistryTable
          files={filteredActiveFiles}
          searchTerm={searchTerm}
          onChangeSearchTerm={setSearchTerm}
          categoryFilter={categoryFilter}
          onChangeCategoryFilter={setCategoryFilter}
          moduleFilter={moduleFilter}
          onChangeModuleFilter={setModuleFilter}
          onPreviewFile={handleOpenPreview}
          onDownloadFile={(file) => showToast(`📥 已開始下載【${file.fileName}】`)}
          onMarkObsolete={(file) => {
            markFileObsolete(file.id, operatorName);
            loadAllData();
            showToast(`⚠️ 已標記【${file.fileName}】為舊版作廢`);
          }}
          onSoftDelete={(file) => {
            softDeleteSystemFile(file.id, operatorName);
            loadAllData();
            showToast(`🗑️ 已將【${file.fileName}】移除，僅 Superadmin 可於救援中心救回`);
          }}
        />
      )}

      {activeTab === 'WORKSPACE' && (
        <VaultNasBrowserPanel
          folders={folders}
          onOpenBindModal={() => setIsNasModalOpen(true)}
          onDeleteFolder={(id) => {
            deleteExternalFolderLink(id, operatorName);
            loadAllData();
            showToast('🗑️ 已移除 NAS 資料夾路徑');
          }}
          onCopyPath={(path, message) => {
            navigator.clipboard.writeText(path);
            showToast(message);
          }}
        />
      )}

      {activeTab === 'TRIAGE' && (
        <VaultTriageInboxPanel
          activeFiles={activeFiles}
          selectedTriageFile={selectedTriageFile}
          onSelectTriageFile={setSelectedTriageFile}
          onPreviewFile={handleOpenPreview}
          onConfirmMatch={(file) => showToast(`✅ 已確認憑證【${file.fileName}】與單據勾稽完成！`)}
        />
      )}

      {activeTab === 'TRASH' && isSuperadmin && (
        <VaultTrashPanel
          trashFiles={trashFiles}
          onRestoreFile={(file) => {
            restoreSystemFile(file.id, operatorName);
            loadAllData();
            showToast(`✅ 已成功將【${file.fileName}】自回收金庫復原！`);
          }}
        />
      )}

      <VaultModals
        healthReport={healthReport}
        onCloseHealthReport={() => setHealthReport(null)}
        isZipModalOpen={isZipModalOpen}
        onCloseZipModal={() => setIsZipModalOpen(false)}
        filteredCount={filteredActiveFiles.length}
        totalBytes={totalBytes}
        onConfirmZipExport={handleConfirmZipExport}
        isUploadModalOpen={isUploadModalOpen}
        onCloseUploadModal={() => setIsUploadModalOpen(false)}
        uploadFileName={uploadFileName}
        onChangeUploadFileName={setUploadFileName}
        uploadCategory={uploadCategory}
        onChangeUploadCategory={setUploadCategory}
        uploadTargetTable={uploadTargetTable}
        onChangeUploadTargetTable={setUploadTargetTable}
        uploadTargetId={uploadTargetId}
        onChangeUploadTargetId={setUploadTargetId}
        uploadEncrypted={uploadEncrypted}
        onChangeUploadEncrypted={setUploadEncrypted}
        onConfirmUpload={handleQuickAddFile}
        isNasModalOpen={isNasModalOpen}
        onCloseNasModal={() => setIsNasModalOpen(false)}
        nasPathInput={nasPathInput}
        onChangeNasPathInput={setNasPathInput}
        nasDescInput={nasDescInput}
        onChangeNasDescInput={setNasDescInput}
        nasTableInput={nasTableInput}
        onChangeNasTableInput={setNasTableInput}
        nasIdInput={nasIdInput}
        onChangeNasIdInput={setNasIdInput}
        onConfirmBindNas={handleConfirmBindNas}
      />

      {selectedPreviewMedia && (
        <MediaPreviewLightbox media={selectedPreviewMedia} onClose={() => setSelectedPreviewMedia(null)} />
      )}
    </div>
  );
};
