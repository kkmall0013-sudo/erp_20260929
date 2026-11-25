import React from 'react';
import { createPortal } from 'react-dom';
import { FileText } from 'lucide-react';

export interface HoverMediaPreviewData {
  url: string;
  title: string;
  isPdf?: boolean;
  x: number;
  y: number;
}

interface HoverMediaPopoverProps {
  preview: HoverMediaPreviewData | null;
}

export const HoverMediaPopover: React.FC<HoverMediaPopoverProps> = ({ preview }) => {
  if (!preview) return null;

  const clampedLeft =
    typeof window !== 'undefined' ? Math.max(10, Math.min(window.innerWidth - 420, preview.x)) : preview.x;
  const clampedTop =
    typeof window !== 'undefined' ? Math.max(10, Math.min(window.innerHeight - 320, preview.y)) : preview.y;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: clampedLeft,
        top: clampedTop,
        zIndex: 1000050
      }}
      className="w-96 bg-white p-2.5 rounded-2xl shadow-2xl border-2 border-indigo-500/30 pointer-events-none animate-in fade-in zoom-in-95"
    >
      <div className="text-[11px] font-bold text-slate-800 truncate mb-1">{preview.title}</div>
      {preview.isPdf ? (
        <div className="h-56 bg-red-50 rounded-xl flex flex-col items-center justify-center text-red-600 gap-2 border border-red-200">
          <FileText className="w-12 h-12" />
          <span className="text-xs font-bold">PDF 文件憑證 (點擊開燈箱檢視)</span>
        </div>
      ) : (
        <img
          src={preview.url}
          alt={preview.title || 'Preview'}
          className="w-full h-56 object-contain rounded-xl bg-slate-900/5 border border-slate-200"
        />
      )}
      <div className="text-[10px] text-slate-400 text-center mt-1">點擊可放大全螢幕檢視與下載</div>
    </div>,
    document.body
  );
};
