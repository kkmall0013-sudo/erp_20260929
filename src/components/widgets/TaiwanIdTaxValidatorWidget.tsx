import React, { useMemo } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertCircle, HelpCircle } from 'lucide-react';
import {
  validateTaiwanTaxId,
  validateTaiwanNationalId,
  ValidationResult
} from '../../utils/taiwanValidation';

export interface TaiwanIdTaxValidatorProps {
  value: string;
  type?: 'TAX_ID' | 'NATIONAL_ID' | 'AUTO';
  onChange?: (val: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showExplanation?: boolean;
}

/**
 * 🛡️ 臺灣統一編號 / 身分證字號檢核小程式 (TaiwanIdTaxValidatorWidget)
 * 內建：
 * 1. 統一編號 8 碼加權驗證（財政部最新邏輯，含第7位為7的模數校驗）
 * 2. 國民身分證 10 碼英文字母加權模數檢驗
 * 3. 即時視覺狀態回饋：綠色勾選（合法）、紅色警示（格式/檢核碼錯誤）、黃色提示（輸入中）
 * 4. 支援 AUTO 自動偵測長度與字元判定
 */
export const TaiwanIdTaxValidatorWidget: React.FC<TaiwanIdTaxValidatorProps> = ({
  value,
  type = 'AUTO',
  onChange,
  label,
  placeholder,
  required = false,
  disabled = false,
  className = '',
  showExplanation = true
}) => {
  const cleanVal = (value || '').trim();

  // 自動判斷檢驗模式
  const detectedType = useMemo(() => {
    if (type !== 'AUTO') return type;
    if (!cleanVal) return 'TAX_ID';
    if (/^[A-Za-z]/.test(cleanVal)) return 'NATIONAL_ID';
    return 'TAX_ID';
  }, [type, cleanVal]);

  // 執行檢核
  const validation: ValidationResult = useMemo(() => {
    if (!cleanVal) {
      return { isValid: false, message: '尚未填寫' };
    }
    if (detectedType === 'TAX_ID') {
      return validateTaiwanTaxId(cleanVal);
    } else {
      return validateTaiwanNationalId(cleanVal);
    }
  }, [cleanVal, detectedType]);

  const defaultPlaceholder =
    placeholder ||
    (detectedType === 'TAX_ID'
      ? '請輸入 8 碼公司統一編號'
      : '請輸入 10 碼負責人身分證號 (如 A123456789)');

  const defaultLabel =
    label ||
    (detectedType === 'TAX_ID'
      ? '公司統一編號 (8 碼)'
      : '國民身分證號 (10 碼)');

  return (
    <div className={`space-y-1.5 ${className}`}>
      {defaultLabel && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
            {validation.isValid ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            ) : cleanVal.length > 0 ? (
              <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
            ) : (
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{defaultLabel}</span>
            {required && <span className="text-red-500">*</span>}
          </label>

          {/* 狀態徽章 */}
          {cleanVal.length > 0 && (
            <div className="flex items-center gap-1">
              {validation.isValid ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>檢核通過</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  <XCircle className="w-3 h-3 text-red-600" />
                  <span>檢核不符</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 輸入框 */}
      <div className="relative">
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange && onChange(e.target.value.trim().toUpperCase())}
          placeholder={defaultPlaceholder}
          disabled={disabled}
          maxLength={detectedType === 'TAX_ID' ? 8 : 10}
          className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono tracking-wider transition-all ${
            !cleanVal
              ? 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
              : validation.isValid
              ? 'border-emerald-400 bg-emerald-50/20 text-emerald-950 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
              : 'border-red-400 bg-red-50/20 text-red-950 focus:border-red-500 focus:ring-2 focus:ring-red-100'
          }`}
        />
        {cleanVal && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            {validation.isValid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
        )}
      </div>

      {/* 詳細說明 / 警示文字 */}
      {showExplanation && cleanVal.length > 0 && (
        <div
          className={`text-[11px] px-2 py-1 rounded flex items-center gap-1.5 ${
            validation.isValid
              ? 'text-emerald-700 bg-emerald-50/50'
              : 'text-red-700 bg-red-50/60'
          }`}
        >
          <span>{validation.message}</span>
        </div>
      )}
    </div>
  );
};
