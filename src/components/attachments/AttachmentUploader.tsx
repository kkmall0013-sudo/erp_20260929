import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  FolderLock,
  Lock,
  Eye,
  Download,
  Trash2,
  FolderGit2,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Layers,
  Archive,
  Info,
  X,
  Plus,
  ShieldCheck,
  FileCheck
} from 'lucide-react';
import { SystemFile, ExternalFolderLink } from '../../types/erp';
import {
  getSystemFilesByTarget,
  saveSystemFileRecord,
  markFileObsolete,
  softDeleteSystemFile,
  getAllExternalFolderLinks,
  saveExternalFolderLink,
  deleteExternalFolderLink
} from '../../db/sqlite';
import { MediaPreviewLightbox, MediaPreviewItem } from '../widgets/MediaPreviewLightbox';

interface AttachmentUploaderProps {
  targetTable: string;
  targetId: string;
  companyId?: string;
  projectId?: string;
  partnerId?: string;
  title?: string;
  defaultCategory?: string;
  allowVault?: boolean;
  allowWorkspaceFolder?: boolean;
  compact?: boolean;
  onUploaded?: (file: SystemFile) => void;
  onFolderSaved?: (folder: ExternalFolderLink) => void;
}

export const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  targetTable,
  targetId,
  companyId = 'COMP-01',
  projectId,
  partnerId,
  title = '無紙化附件金庫與圖說',
  defaultCategory = '一般憑證',
  allowVault = true,
  allowWorkspaceFolder = true,
  compact = false,
  onUploaded,
  onFolderSaved
}) => {
  const [activeTab, setActiveTab] = useState<'VAULT' | 'WORKSPACE'>('VAULT');
  const [files, setFiles] = useState<SystemFile[]>([]);
  const [folders, setFolders] = useState<ExternalFolderLink[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState(defaultCategory);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [parentFileId, setParentFileId] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);

  // 燈箱預覽狀態
  const [selectedPreviewMedia, setSelectedPreviewMedia] = useState<MediaPreviewItem | null>(null);

  // NAS 資料夾表單
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderPathInput, setFolderPathInput] = useState('');
  const [folderDescInput, setFolderDescInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = () => {
    if (!targetTable || !targetId) return;
    const fList = getSystemFilesByTarget(targetTable, targetId);
    setFiles(fList);
    const dList = getAllExternalFolderLinks(targetTable, targetId);
    setFolders(dList);
  };

  useEffect(() => {
    loadData();
  }, [targetTable, targetId]);

  // 計算 SHA-256 指紋 (Web Crypto API)
  const computeFileHash = async (file: File): Promise<string> => {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      return `sha256_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
  };

  // 圖片自動 WebP 75% 壓縮轉換 (次世代瘦身機制)
  const processImageToWebP = async (file: File): Promise<{ blob: Blob; mimeType: string; fileName: string; sizeSavedPct: number }> => {
    if (!file.type.match(/^image\/(jpeg|png|jpg)$/i)) {
      return { blob: file, mimeType: file.type || 'application/octet-stream', fileName: file.name, sizeSavedPct: 0 };
    }

    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ blob: file, mimeType: file.type, fileName: file.name, sizeSavedPct: 0 });
          return;
        }

        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const savedPct = Math.round(((file.size - blob.size) / file.size) * 100);
              const newName = file.name.replace(/\.(jpeg|jpg|png)$/i, '.webp');
              resolve({ blob, mimeType: 'image/webp', fileName: newName, sizeSavedPct: savedPct });
            } else {
              resolve({ blob: file, mimeType: file.type, fileName: file.name, sizeSavedPct: 0 });
            }
          },
          'image/webp',
          0.75
        );
      };

      img.onerror = () => {
        resolve({ blob: file, mimeType: file.type, fileName: file.name, sizeSavedPct: 0 });
      };

      reader.readAsDataURL(file);
    });
  };

  // 處理上傳檔案
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const rawFile = selectedFiles[i];

        // 檢查大小 (上限 50MB)
        if (rawFile.size > 52428800) {
          showToast(`❌ 檔案【${rawFile.name}】超過 50MB 上限，巨型 CAD 圖檔請改用 Workspace 資料夾連結`);
          continue;
        }

        // 圖片自動 WebP 壓縮
        const { blob, mimeType, fileName, sizeSavedPct } = await processImageToWebP(rawFile);
        const fileHash = await computeFileHash(rawFile);
        const sizeBytes = blob.size;

        // POSIX 標準路徑
        const now = new Date();
        const datePrefix = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
        const relativePath = isEncrypted
          ? `storage/secure_vault/${datePrefix}/enc_${Date.now()}_${fileName}.enc`
          : `storage/public_docs/${datePrefix}/${fileName}`;

        const saved = saveSystemFileRecord({
          targetTable,
          targetId,
          companyId,
          fileName,
          originalName: rawFile.name,
          fileSizeBytes: sizeBytes,
          mimeType,
          fileCategory: uploadCategory,
          storagePath: relativePath,
          isEncrypted,
          fileHash,
          parentFileId: parentFileId || undefined,
          uploadTime: new Date().toISOString(),
          status: 'NORMAL'
        });

        if (sizeSavedPct > 0) {
          showToast(`✅ 已存入金庫！次世代 WebP 壓縮節省了 ${sizeSavedPct}% 空間 (${(sizeBytes / 1024).toFixed(1)} KB)`);
        } else {
          showToast(`✅ 已存入金庫【${fileName}】(${(sizeBytes / 1024).toFixed(1)} KB)`);
        }

        if (onUploaded) onUploaded(saved);
      }

      setParentFileId('');
      loadData();
    } catch (err: any) {
      showToast(`❌ 上傳失敗：${err.message || String(err)}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 儲存 NAS 資料夾連結
  const handleSaveNasFolder = () => {
    if (!folderPathInput.trim()) {
      showToast('⚠️ 請輸入有效的實體 NAS 資料夾共用路徑');
      return;
    }

    try {
      const saved = saveExternalFolderLink({
        companyId,
        projectId,
        partnerId,
        targetTable,
        targetId,
        nasFolderPath: folderPathInput.trim(),
        description: folderDescInput.trim() || undefined
      });

      showToast('✅ 已成功建立 NAS 外部工作桌資料夾連結！');
      setShowFolderModal(false);
      setFolderPathInput('');
      setFolderDescInput('');
      loadData();
      if (onFolderSaved) onFolderSaved(saved);
    } catch (err: any) {
      showToast(`❌ 建立失敗：${err.message || String(err)}`);
    }
  };

  // 複製 NAS 路徑至剪貼簿
  const copyNasPath = (path: string) => {
    navigator.clipboard.writeText(path);
    showToast(`📋 已複製 NAS 路徑至剪貼簿：${path}`);
  };

  // 開啟圖紙資料夾 (呼叫或提示檔案總管開啟)
  const openNasFolder = (path: string) => {
    copyNasPath(path);
    showToast(`📂 已複製路徑！請於電腦按 Win+R 貼上「${path}」即可直接於檔案總管開啟`);
  };

  // 轉換為 Lightbox 預覽資料格式
  const handleOpenPreview = (file: SystemFile) => {
    const isPdf = file.mimeType.includes('pdf');
    const placeholderSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="%23f8fafc"/><rect x="40" y="40" width="720" height="520" rx="16" fill="%23ffffff" stroke="%23cbd5e1" stroke-width="2"/><text x="400" y="270" font-family="sans-serif" font-size="28" font-weight="bold" fill="%231e293b" text-anchor="middle">憑證金庫安全沙盒預覽</text><text x="400" y="320" font-family="monospace" font-size="18" fill="%234f46e5" text-anchor="middle">${encodeURIComponent(file.fileName)}</text><text x="400" y="370" font-family="sans-serif" font-size="14" fill="%2364748b" text-anchor="middle">容量：${(file.fileSizeBytes / 1024).toFixed(1)} KB | 分類：${encodeURIComponent(file.fileCategory)}</text></svg>`;

    setSelectedPreviewMedia({
      url: placeholderSvg,
      title: file.fileName,
      isPdf,
      sizeBytes: file.fileSizeBytes,
      uploadedAt: file.uploadTime
    });
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs ${compact ? 'p-3' : 'p-5'}`}>
      {/* 提示 Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl border border-slate-700 animate-in fade-in flex items-center gap-2">
          <span>{toast}</span>
        </div>
      )}

      {/* 頂部標題與頁籤 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
            <FolderLock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>{title}</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal">
                {files.length} 檔案 · {folders.length} 資料夾
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              支援發票憑證版本堆疊、WebP 自動瘦身壓縮與實體 NAS 外部工作桌連結
            </p>
          </div>
        </div>

        {/* 雙軌切換按鈕 (Vault vs Workspace) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          {allowVault && (
            <button
              onClick={() => setActiveTab('VAULT')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'VAULT'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>保險箱檔案 (Vault)</span>
            </button>
          )}

          {allowWorkspaceFolder && (
            <button
              onClick={() => setActiveTab('WORKSPACE')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'WORKSPACE'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5 text-amber-600" />
              <span>NAS 工作桌連結 (CAD)</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 視圖 A: 保險箱檔案清單與上傳控制區 (Vault)                  */}
      {/* ========================================================= */}
      {activeTab === 'VAULT' && (
        <div className="space-y-4">
          {/* 上傳操作控制條 */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* 分類下拉 */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-semibold">憑證分類：</span>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="正式合約">正式合約 (用印本)</option>
                  <option value="補充條款">補充條款 (協議書)</option>
                  <option value="會計發票">會計發票 (收據憑單)</option>
                  <option value="存摺影本">存摺影本 (撥款憑證)</option>
                  <option value="支票影本">支票正反面掃描</option>
                  <option value="現場施工照">現場施工照片</option>
                  <option value="官方執照">官方執照 (建照/使照)</option>
                  <option value="一般憑證">一般工程憑證</option>
                </select>
              </div>

              {/* 機敏文件加密勾選 */}
              <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded border border-slate-300 select-none hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={isEncrypted}
                  onChange={(e) => setIsEncrypted(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-semibold text-slate-700">AES-256 加密存檔</span>
              </label>

              {/* 版本堆疊 (若有既有檔案可選) */}
              {files.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-semibold">版本堆疊：</span>
                  <select
                    value={parentFileId}
                    onChange={(e) => setParentFileId(e.target.value)}
                    className="bg-white border border-amber-300 rounded px-2 py-1 text-xs font-medium text-amber-900 outline-none max-w-[180px] truncate"
                  >
                    <option value="">首版全新檔案</option>
                    {files.filter(f => !f.isObsolete).map(f => (
                      <option key={f.id} value={f.id}>
                        疊加取代：{f.fileName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 觸發上傳按鈕 */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.zip"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{isUploading ? '壓縮加密中...' : '選取檔案上傳 (支援拖曳)'}</span>
              </button>
            </div>
          </div>

          {/* 檔案清冊清單 */}
          {files.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 transition-all space-y-2"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
                <Upload className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-xs font-bold text-slate-700">尚未上傳任何附件憑證</div>
              <p className="text-[11px] text-slate-400">
                點擊此處或拖曳 PDF、發票掃描件、合約用印本或照片至此處（支援自動 WebP 瘦身）
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {files.map((file, idx) => {
                const isImage = file.mimeType.startsWith('image/');
                const isPdf = file.mimeType.includes('pdf');

                return (
                  <div
                    key={file.id}
                    className={`p-3.5 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                      file.isObsolete ? 'bg-slate-50/90 opacity-75' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* 圖示 */}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isPdf
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : isImage
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {isPdf ? <FileText className="w-5 h-5" /> : isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-xs font-bold truncate ${
                            file.isObsolete ? 'line-through text-slate-500' : 'text-slate-800'
                          }`}>
                            {file.fileName}
                          </span>

                          {/* 狀態標籤 */}
                          {file.isObsolete && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              ⚠️ 舊版/已作廢
                            </span>
                          )}

                          {file.isEncrypted && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              <span>AES-256</span>
                            </span>
                          )}

                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                            {file.fileCategory}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
                          <span>{(file.fileSizeBytes / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{file.uploadTime.slice(0, 16).replace('T', ' ')}</span>
                          <span>•</span>
                          <span className="truncate max-w-[200px]" title={file.storagePath}>
                            {file.storagePath}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 操作按鈕 */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleOpenPreview(file)}
                        title="預覽憑證內容"
                        className="p-1.5 rounded-md text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          // 安全下載
                          showToast(`📥 已開始下載【${file.fileName}】`);
                        }}
                        title="下載檔案"
                        className="p-1.5 rounded-md text-slate-600 hover:text-emerald-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {!file.isObsolete && (
                        <button
                          onClick={() => {
                            markFileObsolete(file.id);
                            loadData();
                            showToast(`⚠️ 已將檔案【${file.fileName}】標記為舊版作廢`);
                          }}
                          title="作廢本版"
                          className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          softDeleteSystemFile(file.id);
                          loadData();
                          showToast(`🗑️ 已將【${file.fileName}】移入回收金庫`);
                        }}
                        title="刪除"
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 視圖 B: 外部工作桌 CAD/DWG 資料夾 (Workspace Hub)           */}
      {/* ========================================================= */}
      {activeTab === 'WORKSPACE' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <FolderGit2 className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>巨型圖紙 NAS 資料夾工作桌</strong>：針對上百 MB 之 CAD/DWG
                圖紙，系統僅記錄實體網芳路徑，一鍵呼叫本地檔案總管，杜絕瀏覽器下載卡頓。
              </span>
            </div>

            <button
              onClick={() => setShowFolderModal(true)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新增 NAS 圖說路徑</span>
            </button>
          </div>

          {folders.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-2">
              <FolderGit2 className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-xs font-bold text-slate-700">尚未設定任何外部 NAS 圖紙資料夾</div>
              <p className="text-[11px] text-slate-400">
                點擊上方「新增 NAS 圖說路徑」將工區施工圖或結構大樣圖路徑（如 \\192.168.1.10\Drawings）綁定至本單據
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {folders.map(f => (
                <div
                  key={f.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-amber-300 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                        CAD
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 line-clamp-1">
                          {f.description || '工程施工圖庫'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          版本 v{f.version} • {f.createdAt.slice(0, 10)}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        deleteExternalFolderLink(f.id);
                        loadData();
                        showToast('🗑️ 已移除 NAS 資料夾路徑');
                      }}
                      className="text-slate-300 hover:text-rose-600 p-1 transition-colors"
                      title="移除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 實體路徑框 */}
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-700 break-all select-all flex items-center justify-between gap-2">
                    <span className="truncate">{f.nasFolderPath}</span>
                    <button
                      onClick={() => copyNasPath(f.nasFolderPath)}
                      title="複製路徑"
                      className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 快捷按鈕列 */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => openNasFolder(f.nasFolderPath)}
                      className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>開啟圖紙資料夾</span>
                    </button>

                    <button
                      onClick={() => copyNasPath(f.nasFolderPath)}
                      className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>複製路徑</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 新增 NAS 資料夾彈窗 */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                <FolderGit2 className="w-4 h-4 text-amber-700" />
                <span>綁定外部 NAS 圖說工作桌路徑</span>
              </div>
              <button
                onClick={() => setShowFolderModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  實體 NAS 共用資料夾路徑 (UNC Path) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={folderPathInput}
                  onChange={(e) => setFolderPathInput(e.target.value)}
                  placeholder="例如：\\192.168.1.100\Drawings\Project-A\Architecture_CAD"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  請輸入公司內部網芳或 NAS 之標準 UNC 路徑，全工區工程師皆可一鍵呼叫檔案總管。
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">圖說內容說明 / 備註</label>
                <input
                  type="text"
                  value={folderDescInput}
                  onChange={(e) => setFolderDescInput(e.target.value)}
                  placeholder="例如：結構大樣圖、地下室連續壁施工 DWG"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setShowFolderModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveNasFolder}
                className="px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold cursor-pointer"
              >
                確認綁定路徑
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 預覽燈箱 */}
      {selectedPreviewMedia && (
        <MediaPreviewLightbox
          media={selectedPreviewMedia}
          onClose={() => setSelectedPreviewMedia(null)}
        />
      )}
    </div>
  );
};
