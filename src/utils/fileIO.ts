// src/utils/fileIO.ts
// 統一前端檔案下載、文字檔讀取與剪貼簿複製工具（避免各模組重複手寫 Blob / FileReader / Clipboard）

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string = 'text/plain;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mimeType });
  triggerBlobDownload(blob, filename);
}

export function downloadJsonFile(data: unknown, filename: string): void {
  const normalizedName = filename.endsWith('.json') ? filename : `${filename}.json`;
  downloadTextFile(JSON.stringify(data, null, 2), normalizedName, 'application/json;charset=utf-8');
}

export function readFileAsText(file: File, encoding: string = 'utf-8'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve((event.target?.result as string) || '');
    reader.onerror = () => reject(reader.error || new Error('檔案讀取失敗'));
    reader.readAsText(file, encoding);
  });
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {
    // fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.className = 'fixed -left-[9999px] top-0 opacity-0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch (_) {
    return false;
  }
}
