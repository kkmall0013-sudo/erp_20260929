import React from 'react';
import { createPortal } from 'react-dom';
import { Contact, X, Upload, FileText, Save } from 'lucide-react';
import { BusinessPartner, PartnerBusinessCard, StoredMediaFile } from '../../types/erp';

interface PartnerBusinessCardModalProps {
  isOpen: boolean;
  cardTargetPartner: BusinessPartner | null;
  editingCard: Partial<PartnerBusinessCard>;
  setEditingCard: React.Dispatch<React.SetStateAction<Partial<PartnerBusinessCard>>>;
  onClose: () => void;
  onSave: () => void;
  onProcessFiles: (files: FileList | null, onSuccess: (newFiles: StoredMediaFile[]) => void) => void;
}

export const PartnerBusinessCardModal: React.FC<PartnerBusinessCardModalProps> = ({
  isOpen,
  cardTargetPartner,
  editingCard,
  setEditingCard,
  onClose,
  onSave,
  onProcessFiles
}) => {
  if (!isOpen || !cardTargetPartner) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000005] flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Contact className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                交換/上傳商業名片 ({cardTargetPartner.name})
              </h3>
              <p className="text-[11px] text-slate-400">建檔拜訪名片聯絡人資訊與名片圖檔/PDF</p>
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

        <div className="p-6 space-y-3.5 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                姓名 (名片稱謂) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editingCard.name || ''}
                onChange={e => setEditingCard({ ...editingCard, name: e.target.value })}
                placeholder="姓名"
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">職稱</label>
              <input
                type="text"
                value={editingCard.title || ''}
                onChange={e => setEditingCard({ ...editingCard, title: e.target.value })}
                placeholder="例：業務處協理、工地主任"
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">手機號碼</label>
              <input
                type="text"
                value={editingCard.mobile || ''}
                onChange={e => setEditingCard({ ...editingCard, mobile: e.target.value })}
                placeholder="09xx-xxx-xxx"
                className="w-full text-xs p-2 font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">總機/公司電話</label>
              <input
                type="text"
                value={editingCard.phone || ''}
                onChange={e => setEditingCard({ ...editingCard, phone: e.target.value })}
                placeholder="02-xxxx-xxxx"
                className="w-full text-xs p-2 font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">電子郵件信箱</label>
            <input
              type="email"
              value={editingCard.email || ''}
              onChange={e => setEditingCard({ ...editingCard, email: e.target.value })}
              placeholder="name@example.com"
              className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
            />
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">名片正面圖檔 / PDF 掃描檔</span>
              <label className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded cursor-pointer flex items-center gap-1 shadow-2xs">
                <Upload className="w-3 h-3" />
                <span>選取圖檔/PDF</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={e =>
                    onProcessFiles(e.target.files, files => {
                      if (files[0]) {
                        setEditingCard({
                          ...editingCard,
                          cardFrontUrl: files[0].dataUrl,
                          cardFileType: files[0].fileType
                        });
                      }
                    })
                  }
                />
              </label>
            </div>

            {editingCard.cardFrontUrl ? (
              <div className="relative aspect-16/9 bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                {editingCard.cardFileType === 'PDF' ? (
                  <div className="text-red-600 flex flex-col items-center">
                    <FileText className="w-10 h-10" />
                    <span className="text-xs font-bold">PDF 名片掃描文件</span>
                  </div>
                ) : (
                  <img
                    src={editingCard.cardFrontUrl}
                    alt="名片正面"
                    className="w-full h-full object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setEditingCard({ ...editingCard, cardFrontUrl: undefined })}
                  className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic text-center py-4">
                尚未選取名片圖檔 (拍照上傳或選取 PDF)
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">名片備註</label>
            <input
              type="text"
              value={editingCard.notes || ''}
              onChange={e => setEditingCard({ ...editingCard, notes: e.target.value })}
              placeholder="例：於南港展覽館建材展交換，主要接洽泥作工程"
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
            <span>收存名片</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
