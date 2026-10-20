// 臺灣統一編號 (8 碼) 與 國民身分證統一編號 (10 碼) 內控防弊加權校驗演算法

export interface ValidationResult {
  isValid: boolean;
  message: string;
}

/**
 * 臺灣公司/商業營利事業統一編號 (8 碼) 加權檢核邏輯
 * 乘數邏輯：[1, 2, 1, 2, 1, 2, 4, 1]
 * 支援財政部最新修正準則 (第 7 碼為 7 時的雙重模數校驗)
 */
export function validateTaiwanTaxId(taxId?: string): ValidationResult {
  if (!taxId || !taxId.trim()) {
    return { isValid: false, message: '請輸入 8 碼公司統一編號' };
  }

  const clean = taxId.trim();

  if (!/^\d{8}$/.test(clean)) {
    return { isValid: false, message: '統編格式需為 8 碼純數字' };
  }

  const weights = [1, 2, 1, 2, 1, 2, 4, 1];
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    const digit = parseInt(clean[i], 10);
    const prod = digit * weights[i];
    sum += Math.floor(prod / 10) + (prod % 10);
  }

  // 狀況一：加總能被 10 整除
  if (sum % 10 === 0) {
    return { isValid: true, message: '統一編號邏輯檢核正確' };
  }

  // 狀況二：第 7 位數字為 7，且 (加總 + 1) 能被 10 整除 (舊制與新制雙重相容)
  if (clean[6] === '7' && (sum + 1) % 10 === 0) {
    return { isValid: true, message: '統一編號邏輯檢核正確' };
  }

  return { isValid: false, message: '統編檢核碼不符 (請確認是否有鍵入筆誤)' };
}

/**
 * 臺灣國民身分證字號 (10 碼) 加權檢核邏輯
 * 1 碼英文字母 + 1 碼性別碼 (1/2/8/9) + 8 碼數字
 */
export function validateTaiwanNationalId(nationalId?: string): ValidationResult {
  if (!nationalId || !nationalId.trim()) {
    return { isValid: false, message: '請輸入 10 碼國民身分證字號' };
  }

  const clean = nationalId.trim().toUpperCase();

  if (!/^[A-Z][1289]\d{8}$/.test(clean)) {
    return { isValid: false, message: '身分證字號格式需為 1 碼英文字母 + 9 碼數字' };
  }

  const letterMap: Record<string, number> = {
    A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, J: 18, K: 19,
    L: 20, M: 21, N: 22, P: 23, Q: 24, R: 25, S: 26, T: 27, U: 28, V: 29,
    X: 30, Y: 31, W: 32, Z: 33, I: 34, O: 35
  };

  const letterNum = letterMap[clean[0]];
  if (!letterNum) {
    return { isValid: false, message: '英文字母代號無效' };
  }

  const n1 = Math.floor(letterNum / 10);
  const n2 = letterNum % 10;

  const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];
  const digits = [n1, n2, ...clean.slice(1).split('').map(c => parseInt(c, 10))];

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * weights[i];
  }

  const checkDigit = (10 - (sum % 10)) % 10;

  if (checkDigit === digits[10]) {
    return { isValid: true, message: '國民身分證字號檢核正確' };
  }

  return { isValid: false, message: '身分證字號檢核碼不符 (請確認是否鍵錯)' };
}
