// src/components/attachments/VaultFileRegistryTable.tsx
// 🗄️ 保險箱檔案清冊與多維搜尋篩選表格

import React from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Lock,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { SystemFile } from '../../types/erp';

interface VaultFileRegistryTableProps {
  files: SystemFile[];
  searchTerm: string;
  onChangeSearchTerm: (val: string) => void;
  categoryFilter: string;
  onChangeCategoryFilter: (val: string) => void;
  moduleFilter: string;
  onChangeModuleFilter: (val: string) => void;
  onPreviewFile: (file: SystemFile) => void;
  onDownloadFile: (file: SystemFile) => void;
  onMarkObsolete: (file: SystemFile) => void;
  onSoftDelete: (file: SystemFile) => void;
}

export const VaultFileRegistryTable: React.FC<VaultFileRegistryTableProps> = ({
  files,
  searchTerm,
  onChangeSearchTerm,
  categoryFilter,
  onChangeCategoryFilter,
  moduleFilter,
  onChangeModuleFilter,
  onPreviewFile,
  onDownloadFile,
  onMarkObsolete,
  onSoftDelete,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onChangeSearchTerm(e.target.value)}
            placeholder="搜尋檔名、關聯模型、單據代碼、SHA-256 指紋..."
            className="w-full bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onChangeSearchTerm('')}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">分類：</span>
            <select
              value={categoryFilter}
              onChange={(e) => onChangeCategoryFilter(e.target.value)}
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
              onChange={(e) => onChangeModuleFilter(e.target.value)}
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
              {files.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    查無符合篩選條件之金庫附件檔案
                  </td>
                </tr>
              ) : (
                files.map((file) => {
                  const isImage = file.mimeType.startsWith('image/');
                  const isPdf = file.mimeType.includes('pdf');

                  return (
                    <tr
                      key={file.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        file.isObsolete ? 'bg-slate-50/60 opacity-80' : ''
                      }`}
                    >
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isPdf
                                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                : isImage
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {isImage ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div
                              className={`font-bold truncate max-w-[260px] ${
                                file.isObsolete ? 'line-through text-slate-500' : 'text-slate-800'
                              }`}
                            >
                              {file.fileName}
                            </div>
                            <div
                              className="text-[10px] text-slate-400 font-mono truncate max-w-[240px]"
                              title={file.fileHash}
                            >
                              SHA-256: {file.fileHash.slice(0, 16)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {file.fileCategory}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono text-[11px] font-bold text-indigo-700">{file.targetId}</div>
                        <div className="text-[10px] text-slate-400">{file.targetTable}</div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                        {(file.fileSizeBytes / 1024).toFixed(1)} KB
                      </td>

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

                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>正常</span>
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[11px] text-slate-500 whitespace-nowrap">
                        {file.uploadTime.slice(0, 16).replace('T', ' ')}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onPreviewFile(file)}
                            title="預覽"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDownloadFile(file)}
                            title="下載"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-emerald-600 transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {!file.isObsolete && (
                            <button
                              type="button"
                              onClick={() => onMarkObsolete(file)}
                              title="作廢"
                              className="p-1.5 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onSoftDelete(file)}
                            title="刪除憑證"
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
  );
};
