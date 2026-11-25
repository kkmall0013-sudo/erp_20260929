import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, HelpCircle, Info } from 'lucide-react';

export interface ConfirmDialogSecondaryAction {
  text: string;
  onClick: () => void;
  variant?: 'amber' | 'indigo' | 'slate';
}

export interface ConfirmDialogModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  variant?: 'danger' | 'warning' | 'info';
  extraNotice?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  secondaryAction?: ConfirmDialogSecondaryAction;
  usePortal?: boolean;
}

export const ConfirmDialogModal: React.FC<ConfirmDialogModalProps> = ({
  isOpen,
  title,
  message,
  variant = 'danger',
  extraNotice,
  confirmText = '確認執行',
  cancelText = '取消',
  onConfirm,
  onCancel,
  secondaryAction,
  usePortal = true
}) => {
  if (!isOpen) return null;

  const variantStyle =
    variant === 'danger'
      ? {
          border: 'border-red-200',
          iconBg: 'bg-red-100 text-red-600',
          confirmBtn: 'bg-red-600 hover:bg-red-700 text-white',
          Icon: AlertTriangle
        }
      : variant === 'warning'
      ? {
          border: 'border-amber-200',
          iconBg: 'bg-amber-100 text-amber-700',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
          Icon: HelpCircle
        }
      : {
          border: 'border-indigo-200',
          iconBg: 'bg-indigo-100 text-indigo-700',
          confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
          Icon: Info
        };

  const Icon = variantStyle.Icon;

  const secondaryBtnClass =
    secondaryAction?.variant === 'indigo'
      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
      : secondaryAction?.variant === 'slate'
      ? 'bg-slate-700 hover:bg-slate-800 text-white'
      : 'bg-amber-600 hover:bg-amber-700 text-white';

  const modalNode = (
    <div
      onClick={e => {
        e.stopPropagation();
        onCancel();
      }}
      className="fixed inset-0 z-[1000010] flex items-center justify-center bg-slate-900/65 backdrop-blur-2xs p-4 animate-in fade-in"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`bg-white w-full max-w-md rounded-2xl shadow-2xl border ${variantStyle.border} p-6 space-y-4`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-12 h-12 rounded-xl ${variantStyle.iconBg} flex items-center justify-center shrink-0`}
          >
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 leading-snug">{title}</h3>
            <div className="text-xs text-slate-500 mt-1 leading-relaxed">{message}</div>
          </div>
        </div>

        {extraNotice && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
            {extraNotice}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 flex-wrap">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
          >
            {cancelText}
          </button>

          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${secondaryBtnClass}`}
            >
              {secondaryAction.text}
            </button>
          )}

          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-2xs cursor-pointer transition-colors ${variantStyle.confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return usePortal ? createPortal(modalNode, document.body) : modalNode;
};
