import React from 'react';
import { createPortal } from 'react-dom';
import {
  CreditCard,
  X,
  Calendar,
  Upload,
  FileText,
  Trash2,
  Save
} from 'lucide-react';
import { PartnerChequeRecord, StoredMediaFile } from '../../types/erp';
import { TaiwanBankPickerWidget } from '../widgets/TaiwanBankPickerWidget';
import { MediaPreviewItem } from '../widgets/MediaPreviewLightbox';

interface PartnerChequeModalProps {
  isOpen: boolean;
  editingCheque: Partial<PartnerChequeRecord>;
  setEditingCheque: React.Dispatch<React.SetStateAction<Partial<PartnerChequeRecord>>>;
  onClose: () => void;
  onSave: () => void;
  onProcessFiles: (files: FileList | null, onSuccess: (newFiles: StoredMediaFile[]) => void) => void;
  onOpenLightbox: (media: MediaPreviewItem) => void;
}

export const PartnerChequeModal: React.FC<PartnerChequeModalProps> = ({
  isOpen,
  editingCheque,
  setEditingCheque,
  onClose,
  onSave,
  onProcessFiles,
  onOpenLightbox
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000005] flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">登記支票往來資訊 (收票 / 開票)</h3>
              <p className="text-[11px] text-slate-400">
                票面金融機構代碼、扣款帳戶、發票日、約定兌現日與附件
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">支票收發方向</label>
              <select
                value={editingCheque.direction || 'RECEIPT'}
                onChange={e => setEditingCheque({ ...editingCheque, direction: e.target.value as any })}
                className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
              >
                <option value="RECEIPT">📥 收受支票 (業主款 / 存入)</option>
                <option value="PAYMENT">📤 開立支票 (付廠商款 / 支出)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">支票狀態</label>
              <select
                value={editingCheque.status || 'RECEIVED'}
                onChange={e => setEditingCheque({ ...editingCheque, status: e.target.value as any })}
                className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
              >
                <option value="RECEIVED">已收受 (未到期)</option>
                <option value="ISSUED">已開立 (未到期)</option>
                <option value="DEPOSITED">已存入託收</option>
                <option value="CLEARED">已兌現入帳</option>
                <option value="BOUNCED">退票拒付</option>
                <option value="VOIDED">作廢無效</option>
              </select>
            </div>
          </div>

          <TaiwanBankPickerWidget
            bankCode={editingCheque.bankCode || '004'}
            bankName={editingCheque.bankName || '臺灣銀行'}
            onChange={({ bankCode, bankName }) => setEditingCheque({ ...editingCheque, bankCode, bankName })}
            label="付款銀行金融機構 (全國 400+ 金融資料庫速查)"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">付款分行名稱</label>
              <input
                type="text"
                value={editingCheque.branchName || ''}
                onChange={e => setEditingCheque({ ...editingCheque, branchName: e.target.value })}
                placeholder="例：城中分行、營業部"
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">支票扣款帳號</label>
              <input
                type="text"
                value={editingCheque.accountNumber || ''}
                onChange={e => setEditingCheque({ ...editingCheque, accountNumber: e.target.value.trim() })}
                placeholder="支存帳號"
                className="w-full text-xs p-2 font-mono font-bold bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                支票號碼 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editingCheque.checkNumber || ''}
                onChange={e =>
                  setEditingCheque({
                    ...editingCheque,
                    checkNumber: e.target.value.trim().toUpperCase()
                  })
                }
                placeholder="票面號碼 (例：CQ-882201)"
                className="w-full text-xs font-mono font-bold p-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                票面金額 (新臺幣) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={editingCheque.amount || ''}
                onChange={e =>
                  setEditingCheque({
                    ...editingCheque,
                    amount: Math.max(0, Number(e.target.value))
                  })
                }
                placeholder="請輸入金額"
                className="w-full text-xs font-mono font-bold p-2 bg-white border border-slate-300 rounded-lg text-indigo-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 items-center">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">受款人抬頭</label>
              <input
                type="text"
                value={editingCheque.payeeName || ''}
                onChange={e => setEditingCheque({ ...editingCheque, payeeName: e.target.value })}
                placeholder="受款人全稱"
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div className="pt-5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editingCheque.isNonNegotiable)}
                  onChange={e => setEditingCheque({ ...editingCheque, isNonNegotiable: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                <span>禁止背書轉讓</span>
              </label>
            </div>
          </div>

          <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>票期時間節點與快捷連動</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  收票日 / 寄發日
                </label>
                <input
                  type="date"
                  value={editingCheque.receivedDate || ''}
                  onChange={e => setEditingCheque({ ...editingCheque, receivedDate: e.target.value })}
                  className="w-full text-xs font-mono p-1.5 bg-white border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  發票日 (開票日)
                </label>
                <input
                  type="date"
                  value={editingCheque.issueDate || ''}
                  onChange={e => setEditingCheque({ ...editingCheque, issueDate: e.target.value })}
                  className="w-full text-xs font-mono p-1.5 bg-white border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-indigo-700 mb-0.5">
                  約定兌現日 (到期日)
                </label>
                <input
                  type="date"
                  value={editingCheque.dueDate || ''}
                  onChange={e => setEditingCheque({ ...editingCheque, dueDate: e.target.value })}
                  className="w-full text-xs font-mono font-bold p-1.5 bg-white border border-indigo-300 rounded text-indigo-800"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
              <span className="text-slate-500 font-semibold">⚡ 快捷計算兌現日：</span>
              <button
                type="button"
                onClick={() => {
                  const base = editingCheque.issueDate || new Date().toISOString().slice(0, 10);
                  setEditingCheque({ ...editingCheque, dueDate: base });
                }}
                className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-bold cursor-pointer"
              >
                見票即付 (同開票日)
              </button>
              <button
                type="button"
                onClick={() => {
                  const base = new Date(editingCheque.issueDate || new Date());
                  base.setDate(base.getDate() + 30);
                  setEditingCheque({ ...editingCheque, dueDate: base.toISOString().slice(0, 10) });
                }}
                className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-bold cursor-pointer"
              >
                30 天期
              </button>
              <button
                type="button"
                onClick={() => {
                  const base = new Date(editingCheque.issueDate || new Date());
                  base.setDate(base.getDate() + 60);
                  setEditingCheque({ ...editingCheque, dueDate: base.toISOString().slice(0, 10) });
                }}
                className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-bold cursor-pointer"
              >
                60 天期
              </button>
              <button
                type="button"
                onClick={() => {
                  const base = new Date(editingCheque.issueDate || new Date());
                  base.setFullYear(base.getFullYear() + 1);
                  setEditingCheque({ ...editingCheque, dueDate: base.toISOString().slice(0, 10) });
                }}
                className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-bold cursor-pointer"
              >
                法定一年時效 (+1年)
              </button>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">支票正反面影本 / PDF 掃描檔</span>
              <label className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded cursor-pointer flex items-center gap-1 shadow-2xs">
                <Upload className="w-3 h-3" />
                <span>上傳影本</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={e =>
                    onProcessFiles(e.target.files, newFiles => {
                      setEditingCheque({
                        ...editingCheque,
                        chequeFiles: [...(editingCheque.chequeFiles || []), ...newFiles]
                      });
                    })
                  }
                />
              </label>
            </div>

            {editingCheque.chequeFiles && editingCheque.chequeFiles.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {editingCheque.chequeFiles.map((f, i) => (
                  <div key={f.id || i} className="bg-white p-1.5 rounded border border-slate-200">
                    <div
                      className="aspect-video bg-slate-100 rounded overflow-hidden flex items-center justify-center cursor-pointer"
                      onClick={() =>
                        onOpenLightbox({
                          url: f.dataUrl,
                          title: f.name,
                          isPdf: f.fileType === 'PDF'
                        })
                      }
                    >
                      {f.fileType === 'PDF' ? (
                        <FileText className="w-6 h-6 text-red-600" />
                      ) : (
                        <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1 text-[10px]">
                      <span className="truncate max-w-[80px]" title={f.name}>
                        {f.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const list = editingCheque.chequeFiles!.filter((_, idx) => idx !== i);
                          setEditingCheque({ ...editingCheque, chequeFiles: list });
                        }}
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic">尚未上傳支票照片或 PDF</div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              支票備註與用途說明 (Notes)
            </label>
            <textarea
              rows={2}
              value={editingCheque.notes || ''}
              onChange={e => setEditingCheque({ ...editingCheque, notes: e.target.value })}
              placeholder="例：南港住宅大樓案第 2 期合約估驗訂金，約定次月 5 日提示兌領..."
              className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>儲存支票記錄</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
