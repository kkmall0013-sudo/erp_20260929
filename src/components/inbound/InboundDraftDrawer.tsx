// src/components/inbound/InboundDraftDrawer.tsx
// 📋 現場進貨暫存草稿箱抽屜與頂部草稿作業狀態操作條

import React from 'react';
import { FolderOpen, Plus, X, Save, RotateCcw, Trash2 } from 'lucide-react';
import { InboundSpeedDraft } from './excelInboundEngine';

interface InboundDraftDrawerProps {
  isOpen: boolean;
  onCloseDrawer: () => void;
  drafts: InboundSpeedDraft[];
  activeDraftId: string | null;
  activeDraftTitle: string;
  filledCount: number;
  subtotal: number;
  onLoadDraft: (draft: InboundSpeedDraft) => void;
  onDeleteDraft: (draftId: string, e?: React.MouseEvent) => void;
  onSaveAsDraft: (options: { clearAfter: boolean; customTitle?: string }) => void;
  onClearAndStartNew: () => void;
}

export const InboundDraftDrawer: React.FC<InboundDraftDrawerProps> = ({
  isOpen,
  onCloseDrawer,
  drafts,
  activeDraftId,
  activeDraftTitle,
  filledCount,
  subtotal,
  onLoadDraft,
  onDeleteDraft,
  onSaveAsDraft,
  onClearAndStartNew
}) => {
  return (
    <>
      {/* 展開式草稿抽屜面板 */}
      {isOpen && (
        <div className="bg-slate-950 text-white border-b border-amber-500/40 p-4 shadow-xl z-30 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-amber-300 text-sm">現場進貨暫存草稿箱</h3>
              <span className="text-xs text-slate-400">
                （打到一半隨時存為草稿，隨意切換多張草稿，確認後一鍵轉正式單入帳）
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClearAndStartNew}
                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>開一張新空白單 (打另一張單)</span>
              </button>
              <button
                type="button"
                onClick={onCloseDrawer}
                className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="pt-3">
            {drafts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <span>目前草稿箱中尚無暫存草稿。</span>
                <p className="text-slate-500 mt-1">
                  在下方打單時點擊「💾 存為草稿」，即可隨時暫存並在此切換多張單據！
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
                {drafts.map(d => {
                  const isActive = activeDraftId === d.id;
                  return (
                    <div
                      key={d.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/50 shadow-md'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-100 truncate">{d.title}</span>
                            {isActive && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 text-[10px] font-black shrink-0">
                                編輯中 🟢
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                            <span>
                              案場: <strong className="text-slate-200">{d.primaryProjectName || '未指定'}</strong>
                            </span>
                            <span>
                              廠商: <strong className="text-slate-200">{d.primaryVendorName || '未指定'}</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 font-mono">
                            <span>料件: {d.itemCount} 筆</span>
                            <span>
                              未稅金額: <strong className="text-amber-300 font-bold">${Number(d.totalAmount).toLocaleString()}</strong>
                            </span>
                            <span className="text-slate-500">更新: {d.updatedAt}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onLoadDraft(d)}
                            className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer transition-colors shadow-xs"
                          >
                            載入編輯
                          </button>
                          <button
                            type="button"
                            onClick={e => onDeleteDraft(d.id, e)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors text-center"
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 現場草稿作業狀態與操作欄 */}
      <div
        className={`px-4 py-2 border-b flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 ${
          activeDraftId
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            : 'bg-slate-800/90 border-slate-700/80 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {activeDraftId ? (
            <>
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow-xs">
                <FolderOpen className="w-3 h-3" />
                <span>草稿載入中</span>
              </span>
              <span className="font-bold text-amber-300 text-xs truncate max-w-[320px]">{activeDraftTitle}</span>
              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                ({filledCount} 筆有效品項 · 合計 ${subtotal.toLocaleString()})
              </span>
            </>
          ) : (
            <>
              <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-bold text-[10px]">全新登打</span>
              <span className="text-xs text-slate-300">
                正在輸入新進貨單 · 支援打到一半暫存為草稿1，打另一張單存成草稿2
              </span>
              {drafts.length > 0 && (
                <span className="text-[11px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 font-mono">
                  現有 {drafts.length} 筆暫存草稿可隨時切換
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeDraftId ? (
            <>
              <button
                type="button"
                onClick={() => onSaveAsDraft({ clearAfter: false })}
                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="儲存對此草稿的修改"
              >
                <Save className="w-3.5 h-3.5" />
                <span>更新此草稿</span>
              </button>

              <button
                type="button"
                onClick={() => onSaveAsDraft({ clearAfter: true })}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="存妥目前草稿後清空工作台，開始打另一張新單 (草稿 2)"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>存草稿並開新單</span>
              </button>

              <button
                type="button"
                onClick={onClearAndStartNew}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="保留此草稿不刪除，清空工作台開啟新單"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>清空開新單</span>
              </button>

              <button
                type="button"
                onClick={() => onDeleteDraft(activeDraftId)}
                className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 cursor-pointer"
                title="放棄並自資料庫刪除此草稿"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSaveAsDraft({ clearAfter: false })}
                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="將目前打到一半的內容暫存為草稿，方便隨時回來續打"
              >
                <Save className="w-3.5 h-3.5" />
                <span>存為草稿 (例如: 草稿 {drafts.length + 1})</span>
              </button>

              <button
                type="button"
                onClick={() => onSaveAsDraft({ clearAfter: true })}
                className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-200 border border-amber-500/30 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="存為草稿後立即清空工作台，開始打另一張新單據"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>存為草稿並開新單</span>
              </button>

              <button
                type="button"
                onClick={onClearAndStartNew}
                className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="清空表格所有列"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>清空重填</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};
