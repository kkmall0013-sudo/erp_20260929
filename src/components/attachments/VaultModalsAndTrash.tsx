// src/components/attachments/VaultModalsAndTrash.tsx
// 🗑️ 金庫回收視圖 (僅 Superadmin) 與 4 枚工作台對話彈窗

import React from 'react';
import { FolderGit2, PackageCheck, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { SystemFile } from '../../types/erp';

interface VaultTrashPanelProps {
  trashFiles: SystemFile[];
  onRestoreFile: (file: SystemFile) => void;
}

export const VaultTrashPanel: React.FC<VaultTrashPanelProps> = ({ trashFiles, onRestoreFile }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>回收金庫 (已軟刪除檔案 — 僅 Superadmin 可見)</span>
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            依據軟刪除鐵律，刪除後一般同仁與 Admin 皆完全不可見，僅 Superadmin 可檢視並救回，所有操作皆留存 Log。
          </p>
        </div>

        <span className="text-xs font-mono tabular-nums font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
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
                <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
                  原關聯：{f.targetTable} ({f.targetId}) • {(f.fileSizeBytes / 1024).toFixed(1)} KB
                </div>
              </div>

              <button
                type="button"
                onClick={() => onRestoreFile(f)}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold transition-colors cursor-pointer shrink-0"
              >
                一鍵復原
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface VaultModalsProps {
  healthReport: {
    totalChecked: number;
    normalCount: number;
    missingCount: number;
    repairedCount: number;
  } | null;
  onCloseHealthReport: () => void;

  isZipModalOpen: boolean;
  onCloseZipModal: () => void;
  filteredCount: number;
  totalBytes: number;
  onConfirmZipExport: () => void;

  isUploadModalOpen: boolean;
  onCloseUploadModal: () => void;
  uploadFileName: string;
  onChangeUploadFileName: (v: string) => void;
  uploadCategory: string;
  onChangeUploadCategory: (v: string) => void;
  uploadTargetTable: string;
  onChangeUploadTargetTable: (v: string) => void;
  uploadTargetId: string;
  onChangeUploadTargetId: (v: string) => void;
  uploadEncrypted: boolean;
  onChangeUploadEncrypted: (v: boolean) => void;
  onConfirmUpload: () => void;

  isNasModalOpen: boolean;
  onCloseNasModal: () => void;
  nasPathInput: string;
  onChangeNasPathInput: (v: string) => void;
  nasDescInput: string;
  onChangeNasDescInput: (v: string) => void;
  nasTableInput: string;
  onChangeNasTableInput: (v: string) => void;
  nasIdInput: string;
  onChangeNasIdInput: (v: string) => void;
  onConfirmBindNas: () => void;
}

export const VaultModals: React.FC<VaultModalsProps> = ({
  healthReport,
  onCloseHealthReport,
  isZipModalOpen,
  onCloseZipModal,
  filteredCount,
  totalBytes,
  onConfirmZipExport,
  isUploadModalOpen,
  onCloseUploadModal,
  uploadFileName,
  onChangeUploadFileName,
  uploadCategory,
  onChangeUploadCategory,
  uploadTargetTable,
  onChangeUploadTargetTable,
  uploadTargetId,
  onChangeUploadTargetId,
  uploadEncrypted,
  onChangeUploadEncrypted,
  onConfirmUpload,
  isNasModalOpen,
  onCloseNasModal,
  nasPathInput,
  onChangeNasPathInput,
  nasDescInput,
  onChangeNasDescInput,
  nasTableInput,
  onChangeNasTableInput,
  nasIdInput,
  onChangeNasIdInput,
  onConfirmBindNas,
}) => {
  return (
    <>
      {healthReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/60">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>三段式儲存健康檢查與幽靈防禦報告</span>
              </div>
              <button type="button" onClick={onCloseHealthReport} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">掃描檔案總數：</span>
                  <span className="font-mono tabular-nums font-bold text-slate-800">{healthReport.totalChecked} 筆</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">正常無損檔案：</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-700">{healthReport.normalCount} 筆</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">實體遺失/幽靈指標：</span>
                  <span className="font-mono tabular-nums font-bold text-slate-500">{healthReport.missingCount} 筆</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">自動例外急救修復：</span>
                  <span className="font-mono tabular-nums font-bold text-indigo-700">{healthReport.repairedCount} 筆</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                ✅ 全系統金庫檔案指紋校驗一致，無斷鏈或孤兒檔案，儲存健康度達到 100%。
              </p>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end text-xs">
              <button
                type="button"
                onClick={onCloseHealthReport}
                className="px-5 py-2 rounded-lg bg-slate-900 text-white font-bold cursor-pointer"
              >
                確認完成
              </button>
            </div>
          </div>
        </div>
      )}

      {isZipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/60">
              <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                <PackageCheck className="w-5 h-5 text-indigo-700" />
                <span>全案場年度憑證大批量 ZIP 打包下載</span>
              </div>
              <button type="button" onClick={onCloseZipModal} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">預計打包檔案數：</span>
                  <span className="font-mono tabular-nums font-bold text-slate-800">{filteredCount} 筆</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">預估打包容量：</span>
                  <span className="font-mono tabular-nums font-bold text-slate-800">
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
                type="button"
                onClick={onCloseZipModal}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={onConfirmZipExport}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
              >
                開始打包下載
              </button>
            </div>
          </div>
        </div>
      )}

      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>登記新憑證進無紙化金庫</span>
              </div>
              <button type="button" onClick={onCloseUploadModal} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
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
                  onChange={(e) => onChangeUploadFileName(e.target.value)}
                  placeholder="例如：南港商辦主合約用印本.pdf"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium text-slate-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">憑證分類</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => onChangeUploadCategory(e.target.value)}
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
                    onChange={(e) => onChangeUploadTargetTable(e.target.value)}
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
                  onChange={(e) => onChangeUploadTargetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-800 outline-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={uploadEncrypted}
                  onChange={(e) => onChangeUploadEncrypted(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span className="font-bold text-slate-700">啟用 AES-256-GCM 實體金庫機敏加密</span>
              </label>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={onCloseUploadModal}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={onConfirmUpload}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
              >
                確認入庫
              </button>
            </div>
          </div>
        </div>
      )}

      {isNasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                <FolderGit2 className="w-4 h-4 text-amber-700" />
                <span>綁定企業 NAS 圖紙外部工作桌</span>
              </div>
              <button type="button" onClick={onCloseNasModal} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
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
                  onChange={(e) => onChangeNasPathInput(e.target.value)}
                  placeholder="\\192.168.1.100\Drawings\PRJ-01\Structural_CAD"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">圖說內容說明</label>
                <input
                  type="text"
                  value={nasDescInput}
                  onChange={(e) => onChangeNasDescInput(e.target.value)}
                  placeholder="例如：南港總部全套地下室 DWG 大樣圖"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">關聯模組</label>
                  <select
                    value={nasTableInput}
                    onChange={(e) => onChangeNasTableInput(e.target.value)}
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
                    onChange={(e) => onChangeNasIdInput(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={onCloseNasModal}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={onConfirmBindNas}
                className="px-5 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold cursor-pointer"
              >
                確認綁定
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
