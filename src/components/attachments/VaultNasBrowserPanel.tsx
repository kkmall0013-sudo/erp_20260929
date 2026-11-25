// src/components/attachments/VaultNasBrowserPanel.tsx
// 📂 企業 NAS 圖紙外部工作桌 (CAD/DWG UNC 路徑管理)

import React from 'react';
import { Copy, ExternalLink, FolderGit2, Plus, Trash2 } from 'lucide-react';
import { ExternalFolderLink } from '../../types/erp';

interface VaultNasBrowserPanelProps {
  folders: ExternalFolderLink[];
  onOpenBindModal: () => void;
  onDeleteFolder: (id: string) => void;
  onCopyPath: (path: string, message: string) => void;
}

export const VaultNasBrowserPanel: React.FC<VaultNasBrowserPanelProps> = ({
  folders,
  onOpenBindModal,
  onDeleteFolder,
  onCopyPath,
}) => {
  return (
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
          type="button"
          onClick={onOpenBindModal}
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
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
                type="button"
                onClick={() => onDeleteFolder(f.id)}
                className="text-slate-300 hover:text-rose-600 p-1 cursor-pointer"
                title="移除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 break-all select-all flex items-center justify-between gap-2">
              <span className="truncate">{f.nasFolderPath}</span>
              <button
                type="button"
                onClick={() => onCopyPath(f.nasFolderPath, `📋 已複製 NAS 路徑：${f.nasFolderPath}`)}
                title="複製"
                className="p-1 hover:bg-slate-200 rounded text-slate-500 shrink-0 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() =>
                  onCopyPath(f.nasFolderPath, '📂 已複製路徑！請於 Windows 按 Win+R 貼上開啟檔案總管')
                }
                className="flex-1 py-1.5 px-3 rounded-lg font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>開啟圖紙資料夾</span>
              </button>

              <button
                type="button"
                onClick={() => onCopyPath(f.nasFolderPath, '📋 已複製 NAS 路徑至剪貼簿')}
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
  );
};
