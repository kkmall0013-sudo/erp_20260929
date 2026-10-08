import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  FileCheck,
  Maximize2,
  AlertCircle
} from 'lucide-react';

export interface MediaPreviewItem {
  url: string;
  title: string;
  isPdf?: boolean;
  sizeBytes?: number;
  uploadedAt?: string;
}

export interface MediaPreviewLightboxProps {
  media: MediaPreviewItem | null;
  onClose: () => void;
}

/**
 * 轉 Base64 Data URL 為 Blob
 */
function dataURItoBlob(dataURI: string): Blob {
  try {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch (e) {
    return new Blob([], { type: 'application/octet-stream' });
  }
}

/**
 * 📑 高解析多媒體/支票/名片/PDF 預覽燈箱小程式 (MediaPreviewLightbox)
 * 解決痛點：
 * 1. 解決 Chrome iframe 預覽 Base64 PDF 時出現「Chrome 已封鎖這個網頁」的瀏覽器沙盒限制
 * 2. 自動將 Base64 轉換為安全的 Blob URL 進行渲染與另開檢視
 * 3. 支援圖片放大、縮小、旋轉 (90° / 180° / 270°)
 * 4. 支援另開獨立分頁檢視與安全一鍵下載
 */
export const MediaPreviewLightbox: React.FC<MediaPreviewLightboxProps> = ({
  media,
  onClose
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pdfEmbedError, setPdfEmbedError] = useState<boolean>(false);

  // 判定是否為 PDF (藉由副檔名或 mime type 或 isPdf flag)
  const isPdf = useMemo(() => {
    if (!media) return false;
    if (media.isPdf) return true;
    return (
      media.url.startsWith('data:application/pdf') ||
      media.url.toLowerCase().endsWith('.pdf') ||
      media.title.toLowerCase().endsWith('.pdf')
    );
  }, [media]);

  // 為 PDF 生成安全的 Blob URL，避免 data: url 被 Chrome 沙盒封鎖
  const blobUrl = useMemo(() => {
    if (!media || !isPdf) return null;
    if (media.url.startsWith('data:application/pdf')) {
      try {
        const blob = dataURItoBlob(media.url);
        return URL.createObjectURL(blob);
      } catch (e) {
        return media.url;
      }
    }
    return media.url;
  }, [media, isPdf]);

  // 釋放 Blob URL 資源
  useEffect(() => {
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // 重設縮放狀態
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPdfEmbedError(false);
  }, [media]);

  if (!media) return null;

  const handleOpenInNewTab = () => {
    const targetUrl = blobUrl || media.url;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = () => {
    const targetUrl = blobUrl || media.url;
    const a = document.createElement('a');
    a.href = targetUrl;
    const ext = isPdf ? '.pdf' : '.png';
    const filename = media.title.includes('.') ? media.title : `${media.title}${ext}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-700">
        {/* 頂部操作列 */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 gap-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            {isPdf ? (
              <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <FileCheck className="w-4 h-4" />
              </div>
            )}
            <div className="truncate">
              <h4 className="text-sm font-bold text-white truncate">{media.title}</h4>
              <p className="text-[11px] text-slate-400">
                {isPdf ? 'PDF 文件檔案' : '高解析圖像檔案'}
                {media.uploadedAt && ` • 上傳於 ${media.uploadedAt.slice(0, 16).replace('T', ' ')}`}
              </p>
            </div>
          </div>

          {/* 工具按鈕組 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isPdf && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  title="縮小"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-400 px-1">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  title="放大"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  title="旋轉 90 度"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-slate-700 mx-1" />
              </>
            )}

            {/* 另開獨立分頁檢視 (解決 iframe 限制最佳解) */}
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
              title="在獨立瀏覽器分頁開啟以完整檢視"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">新分頁開啟</span>
            </button>

            {/* 下載按鈕 */}
            <button
              type="button"
              onClick={handleDownload}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              title="下載至本機電腦"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下載檔案</span>
            </button>

            {/* 關閉按鈕 */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
              title="關閉預覽視窗"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 預覽主體展示區 */}
        <div className="p-4 bg-slate-950/95 flex-1 overflow-auto flex items-center justify-center min-h-[460px] max-h-[72vh] relative select-none">
          {isPdf ? (
            <div className="w-full h-full flex flex-col items-center justify-center">
              {/* PDF 內嵌檢視器 (使用 Blob URL 與 Object / Embed，避免 Chrome 封鎖) */}
              {!pdfEmbedError && blobUrl ? (
                <div className="w-full h-[68vh] rounded-xl overflow-hidden bg-white shadow-xl relative border border-slate-700">
                  <object
                    data={blobUrl}
                    type="application/pdf"
                    className="w-full h-full"
                    onError={() => setPdfEmbedError(true)}
                  >
                    {/* Fallback 內容 */}
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-50">
                      <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                        <FileText className="w-8 h-8" />
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-800 text-sm">PDF 文件已就緒</h5>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          瀏覽器內嵌限制，請點擊下方按鈕在新分頁檢視或下載文件。
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={handleOpenInNewTab}
                          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-md"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>另開新分頁檢視</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownload}
                          className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-2 hover:bg-slate-300"
                        >
                          <Download className="w-4 h-4" />
                          <span>下載本檔</span>
                        </button>
                      </div>
                    </div>
                  </object>
                </div>
              ) : (
                /* 當瀏覽器環境封鎖 Object 載入時的清晰卡片 */
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center max-w-md space-y-4 shadow-2xl">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-base">{media.title}</h5>
                    <p className="text-xs text-slate-400 mt-1">
                      本 PDF 文件已安全存入系統資料庫。由於預覽環境之安全策略防護，建議點擊按鈕直接開啟或下載閱讀。
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleOpenInNewTab}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>另開分頁完整閱讀</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 transition-transform active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      <span>下載本檔</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 圖像檢視器：支援縮放與旋轉 */
            <div
              className="flex items-center justify-center transition-transform duration-150"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`
              }}
            >
              <img
                src={media.url}
                alt={media.title}
                className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-2xl border border-slate-800 bg-black/20"
              />
            </div>
          )}
        </div>

        {/* 底部資訊列 */}
        <div className="px-5 py-2.5 bg-slate-900 text-slate-400 text-xs flex items-center justify-between shrink-0 border-t border-slate-800">
          <span>
            {isPdf
              ? '💡 提示：點擊「新分頁開啟」可在瀏覽器原生完整 PDF 閱讀器中放大、列印與劃記'
              : '💡 提示：使用上方縮放與旋轉工具，可清晰辨識支票印鑑、發票號碼與名片細節'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-300 hover:text-white font-semibold underline"
          >
            關閉預覽
          </button>
        </div>
      </div>
    </div>
  );
};
