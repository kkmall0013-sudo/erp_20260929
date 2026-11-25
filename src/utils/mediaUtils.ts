import { StoredMediaFile } from '../types/erp';

/** 將上傳圖片壓縮至指定寬度以內，避免 localStorage / SQLite Base64 體積過大 */
export function compressImageFile(file: File, maxWidth = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** 讀取檔案為 Data URL (支援 PDF 與圖片) */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** 批次處理上傳圖檔或 PDF，回傳標準化 StoredMediaFile 陣列 */
export async function processUploadedMediaFiles(
  files: FileList | null,
  onError?: (fileName: string, err: unknown) => void
): Promise<StoredMediaFile[]> {
  if (!files || files.length === 0) return [];
  const uploadedList: StoredMediaFile[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
    try {
      const dataUrl = isPdf ? await readFileAsDataUrl(f) : await compressImageFile(f);
      uploadedList.push({
        id: `FILE-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        name: f.name,
        dataUrl,
        fileType: isPdf ? 'PDF' : 'IMAGE',
        sizeBytes: f.size,
        uploadedAt: new Date().toISOString()
      });
    } catch (err) {
      onError?.(f.name, err);
    }
  }

  return uploadedList;
}
