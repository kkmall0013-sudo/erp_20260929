// src/components/attachments/VaultTriageInboxPanel.tsx
// 📥 待歸檔收件匣雙欄打單工作台 (Triage Inbox)

import React from 'react';
import { FileText, Inbox } from 'lucide-react';
import { SystemFile } from '../../types/erp';

interface VaultTriageInboxPanelProps {
  activeFiles: SystemFile[];
  selectedTriageFile: SystemFile | null;
  onSelectTriageFile: (file: SystemFile) => void;
  onPreviewFile: (file: SystemFile) => void;
  onConfirmMatch: (file: SystemFile) => void;
}

export const VaultTriageInboxPanel: React.FC<VaultTriageInboxPanelProps> = ({
  activeFiles,
  selectedTriageFile,
  onSelectTriageFile,
  onPreviewFile,
  onConfirmMatch,
}) => {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-center gap-2">
        <Inbox className="w-4 h-4 text-purple-700 shrink-0" />
        <span>
          <strong>待歸檔收件匣 (Triage Inbox)</strong>：會計處理廠商大宗月底送來之多個案場對帳發票時，左側提供
          PDF 即時預覽、右側提供單據快速核對與派工歸檔，落實「前線進料綁明細、會計後端對總額」權責分離。
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <h4 className="font-bold text-xs text-slate-800 flex items-center justify-between">
            <span>收件匣憑證清單</span>
            <span className="text-slate-400 font-mono tabular-nums text-[11px]">{activeFiles.length} 筆待查</span>
          </h4>

          <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto border border-slate-200 rounded-lg">
            {activeFiles.map(f => (
              <div
                key={f.id}
                onClick={() => onSelectTriageFile(f)}
                className={`p-3 text-xs cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                  selectedTriageFile?.id === f.id ? 'bg-purple-50/80 ring-1 ring-inset ring-purple-300' : 'hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{f.fileName}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono tabular-nums">
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

              <div className="w-full h-56 bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center p-4 text-center space-y-2">
                <FileText className="w-10 h-10 text-slate-400" />
                <div className="text-xs font-bold text-slate-700">
                  憑證沙盒即時預覽 [{selectedTriageFile.fileName}]
                </div>
                <p className="text-[11px] text-slate-400 max-w-sm">
                  本金庫採用 Blob URL 封閉式解密沙盒渲染，不觸發 Chrome iframe 外部 PDF 攔截機制。
                </p>
                <button
                  type="button"
                  onClick={() => onPreviewFile(selectedTriageFile)}
                  className="px-3 py-1 rounded bg-white text-indigo-600 font-bold text-xs border border-slate-300 shadow-2xs hover:bg-slate-50 cursor-pointer"
                >
                  開啟全螢幕檢視燈箱
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="font-bold text-slate-800">會計快速核對與派工歸檔</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 mb-1">歸檔單據模組</label>
                    <select
                      defaultValue={selectedTriageFile.targetTable}
                      key={`tbl-${selectedTriageFile.id}`}
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
                      key={`id-${selectedTriageFile.id}`}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => onConfirmMatch(selectedTriageFile)}
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
  );
};
