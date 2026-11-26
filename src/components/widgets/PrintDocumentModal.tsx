// src/components/widgets/PrintDocumentModal.tsx
// 🖨️ 全系統共用「單據／報表正式列印預覽」彈窗外框（統一 print:hidden 頂欄、Esc 關閉、A4 紙張容器）

import React, { useEffect } from 'react';
import { Printer, X } from 'lucide-react';

export interface PrintDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  printButtonLabel?: string;
  closeButtonLabel?: string;
  extraToolbarActions?: React.ReactNode;
  children: React.ReactNode;
  /** 彈窗最大寬度 class，預設 max-w-4xl */
  modalMaxWidthClass?: string;
  /** A4 紙張最大寬度 class，預設 max-w-[800px] */
  paperMaxWidthClass?: string;
  onPrint?: () => void;
}

export const PrintDocumentModal: React.FC<PrintDocumentModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  printButtonLabel = '列印 / 存為 PDF',
  closeButtonLabel = '關閉',
  extraToolbarActions,
  children,
  modalMaxWidthClass = 'max-w-4xl',
  paperMaxWidthClass = 'max-w-[800px]',
  onPrint
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:static print:bg-white print:p-0"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl ${modalMaxWidthClass} w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] print:max-h-none print:max-w-none print:border-none print:shadow-none print:rounded-none animate-in fade-in`}
        onClick={e => e.stopPropagation()}
      >
        {/* 頂部操作列（列印時自動隱藏） */}
        <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <Printer className="w-5 h-5 text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold tracking-wide truncate">{title}</h2>
              {subtitle && (
                <div className="text-[11px] text-slate-300 truncate">{subtitle}</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {extraToolbarActions}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>{printButtonLabel}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span>{closeButtonLabel}</span>
            </button>
          </div>
        </div>

        {/* 預覽紙張本體 (A4 紙張排版容器) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-100 flex justify-center print:overflow-visible print:bg-white print:p-0">
          <div
            className={`bg-white w-full ${paperMaxWidthClass} p-6 sm:p-8 rounded-lg shadow-xs border border-slate-300 text-slate-900 print:max-w-none print:shadow-none print:border-none print:p-0 print:rounded-none h-fit`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
