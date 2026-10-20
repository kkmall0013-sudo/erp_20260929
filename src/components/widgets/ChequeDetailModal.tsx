import React, { useMemo } from 'react';
import {
  X,
  CreditCard,
  Building2,
  Calendar,
  AlertCircle,
  FileText,
  FileCheck,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  Ban,
  Download,
  Eye,
  Scale
} from 'lucide-react';
import { PartnerChequeRecord, StoredMediaFile } from '../../types/erp';
import { getBankByCode } from '../../utils/taiwanBanks';

export interface ChequeDetailModalProps {
  cheque: PartnerChequeRecord | null;
  partnerName?: string;
  onClose: () => void;
  onEdit?: (cheque: PartnerChequeRecord) => void;
  onDelete?: (chequeId: string) => void;
  onPreviewMedia?: (media: { url: string; title: string; isPdf?: boolean }) => void;
  onStatusChange?: (chequeId: string, newStatus: PartnerChequeRecord['status']) => void;
  canWrite?: boolean;
}

/**
 * 將阿拉伯數字金額轉為中文大寫數字 (營造出納常用)
 */
function numberToChineseAmount(n: number): string {
  if (!n || n <= 0) return '零元整';
  const digits = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟', '萬', '拾', '佰', '仟', '億'];
  let str = Math.floor(n).toString();
  let result = '';
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const digit = parseInt(str[i], 10);
    const unitIndex = len - i - 1;
    if (digit !== 0) {
      result += digits[digit] + (units[unitIndex] || '');
    } else {
      if (unitIndex === 4 && result.slice(-1) !== '萬') {
        result += '萬';
      }
      if (result.slice(-1) !== '零' && unitIndex !== 4) {
        result += '零';
      }
    }
  }
  return result.replace(/零+$/, '') + '元整';
}

/**
 * 計算票據法第22條第1項之法定一年消滅時效日 (發票日+1年)
 */
function calculateStatutoryExpiry(issueDateStr?: string): string {
  if (!issueDateStr) return '';
  try {
    const d = new Date(issueDateStr);
    if (isNaN(d.getTime())) return '';
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  } catch (e) {
    return '';
  }
}

/**
 * 💳 支票完整詳細資訊檢視視窗 (ChequeDetailModal)
 * 解決痛點：
 * 1. 解決「已開立支票詳細資訊無法點開，備註內容完全看不到」之問題
 * 2. 完整展示票據法發票日、約定兌現日與第22條法定一年時效關係
 * 3. 完整展示支票號碼、扣款帳號、銀行分行、受款人、禁背與附件清單
 */
export const ChequeDetailModal: React.FC<ChequeDetailModalProps> = ({
  cheque,
  partnerName = '',
  onClose,
  onEdit,
  onDelete,
  onPreviewMedia,
  onStatusChange,
  canWrite = true
}) => {
  if (!cheque) return null;

  const bankInfo = useMemo(() => getBankByCode(cheque.bankCode), [cheque.bankCode]);
  const chineseAmount = useMemo(() => numberToChineseAmount(cheque.amount), [cheque.amount]);
  const statutoryExpiry = useMemo(() => calculateStatutoryExpiry(cheque.issueDate), [cheque.issueDate]);

  // 匯總所有影本附件
  const allFiles: StoredMediaFile[] = useMemo(() => {
    const list: StoredMediaFile[] = [];
    if (cheque.chequeFiles && cheque.chequeFiles.length > 0) {
      list.push(...cheque.chequeFiles);
    } else if (cheque.chequeFileData) {
      list.push({
        id: cheque.chequeFileId || 'LEGACY-FILE',
        name: `支票_${cheque.checkNumber}_影本`,
        dataUrl: cheque.chequeFileData,
        fileType: cheque.chequeFileData.startsWith('data:application/pdf') ? 'PDF' : 'IMAGE',
        uploadedAt: cheque.createdAt || ''
      });
    }
    return list;
  }, [cheque]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-3 sm:p-4 animate-in fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* 頂部標題列 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                cheque.direction === 'RECEIPT'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}
            >
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    cheque.direction === 'RECEIPT'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-blue-500/20 text-blue-300'
                  }`}
                >
                  {cheque.direction === 'RECEIPT' ? '📥 收受支票 (業主/客戶款)' : '📤 開立支票 (付廠商/工班款)'}
                </span>
                <span className="text-xs text-slate-400">
                  {partnerName ? `商業夥伴：${partnerName}` : ''}
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5 font-mono">
                支票號碼：{cheque.checkNumber}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canWrite && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(cheque)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="修改支票內容"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>編輯</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 內容卷動區 */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* 金額大卡片 */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-indigo-900/70">票面金額 (新臺幣)</span>
              <div className="text-2xl font-extrabold text-indigo-700 font-mono tracking-tight mt-0.5">
                NT$ {cheque.amount.toLocaleString()}
              </div>
              <div className="text-xs text-slate-600 mt-1 font-medium">
                國字大寫：<strong className="text-slate-900">{chineseAmount}</strong>
              </div>
            </div>

            {/* 狀態切換徽章 */}
            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <span className="text-[11px] text-slate-500 font-bold">目前票據狀態</span>
              <div className="flex items-center gap-1 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    cheque.status === 'CLEARED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : cheque.status === 'DEPOSITED'
                      ? 'bg-sky-50 text-sky-700 border-sky-300'
                      : cheque.status === 'BOUNCED'
                      ? 'bg-red-50 text-red-700 border-red-300'
                      : cheque.status === 'VOIDED'
                      ? 'bg-slate-100 text-slate-500 border-slate-300'
                      : 'bg-amber-50 text-amber-700 border-amber-300'
                  }`}
                >
                  {cheque.status === 'CLEARED'
                    ? '✅ 已兌現入帳'
                    : cheque.status === 'DEPOSITED'
                    ? '🏦 已託收存入'
                    : cheque.status === 'BOUNCED'
                    ? '⚠️ 退票拒付'
                    : cheque.status === 'VOIDED'
                    ? '🚫 作廢無效'
                    : '⏳ 未到期 / 託收中'}
                </span>

                {canWrite && onStatusChange && (
                  <select
                    value={cheque.status}
                    onChange={e => onStatusChange(cheque.id, e.target.value as any)}
                    className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="RECEIVED">設為：未到期/已收存</option>
                    <option value="DEPOSITED">設為：已存入託收</option>
                    <option value="CLEARED">設為：已兌現完成</option>
                    <option value="BOUNCED">設為：退票 (異常)</option>
                    <option value="VOIDED">設為：作廢</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* 票據日期與票據法說明 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>票期管理與法規時間節點</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">收受 / 開出日期</div>
                <div className="text-xs font-bold text-slate-800 font-mono mt-1">
                  {cheque.receivedDate || cheque.createdAt?.slice(0, 10) || '無紀錄'}
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">票面發票日 (開票日)</div>
                <div className="text-xs font-bold text-slate-800 font-mono mt-1">
                  {cheque.issueDate}
                </div>
              </div>

              <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-200">
                <div className="text-[11px] text-indigo-700 font-bold">約定兌現日 (到期提示日)</div>
                <div className="text-xs font-bold text-indigo-900 font-mono mt-1">
                  {cheque.dueDate}
                </div>
              </div>
            </div>

            {/* 票據法第22條時效法律說明卡片 */}
            <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-sky-900">
                <Scale className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>票據法規定與時效提醒</span>
              </div>
              <p className="text-[11px] text-sky-800 leading-relaxed">
                依<strong>票據法第22條第1項</strong>規定：「票據上之權利，對支票發票人自發票日起算，<strong>一年間不行使，因免除其責任</strong>。」
                此支票之法定追索消滅時效至：
                <strong className="text-sky-950 font-mono ml-1 font-bold">
                  {statutoryExpiry || '開票日起算滿一年'}
                </strong> 止。
              </p>
              <p className="text-[10px] text-sky-700/80">
                💡 實務註記：商業上遠期支票約定之「到期日/兌現日」係供出納提示託收兌領使用，發票日起算一年則為票據追索權之法定最後效期。
              </p>
            </div>
          </div>

          {/* 金融機構與扣款帳戶 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>付款金融機構與扣款帳號</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="text-slate-500 text-[11px]">付款銀行代碼與機構</div>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="font-mono bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                    {cheque.bankCode}
                  </span>
                  <span>{cheque.bankName || bankInfo?.name || '未登記銀行'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-500 text-[11px]">付款分行</div>
                <div className="font-semibold text-slate-800">
                  {cheque.branchName || '未指定分行'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-500 text-[11px]">支票扣款帳號</div>
                <div className="font-mono font-bold text-slate-900 tracking-wider">
                  {cheque.accountNumber || '未記錄扣款帳號'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-500 text-[11px]">受款人抬頭</div>
                <div className="font-semibold text-slate-800">
                  {cheque.payeeName || '未指定抬頭 (無記名)'}
                </div>
              </div>
            </div>

            {/* 特殊記載：禁背、平行線 */}
            <div className="flex items-center gap-3 pt-1 border-t border-slate-200 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">禁止背書轉讓：</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    cheque.isNonNegotiable
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {cheque.isNonNegotiable ? '🔒 是 (票面已載明禁止背書轉讓)' : '否'}
                </span>
              </div>
            </div>
          </div>

          {/* 🌟 完整備註與用途說明 (使用者回饋重點) */}
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2">
            <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-600" />
              <span>支票備註與用途說明 (Notes)</span>
            </h4>
            {cheque.notes && cheque.notes.trim() ? (
              <div className="p-3 bg-white rounded-lg border border-amber-200/80 text-xs text-slate-800 font-sans whitespace-pre-wrap leading-relaxed">
                {cheque.notes}
              </div>
            ) : (
              <div className="p-3 bg-white/60 rounded-lg border border-dashed border-amber-200 text-xs text-slate-400 italic">
                本筆支票尚未填寫備註內容。點擊上方「編輯」按鈕可填入款項用途、工程估驗期數或對應發票號碼。
              </div>
            )}
          </div>

          {/* 影本與附件清單 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-indigo-600" />
                <span>支票正反面影本與掃描檔附件 ({allFiles.length})</span>
              </h4>
            </div>

            {allFiles.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 italic">
                尚未上傳此支票之正反面影本或 PDF 掃描檔
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {allFiles.map((file, idx) => {
                  const isPdf = file.fileType === 'PDF';
                  return (
                    <div
                      key={file.id || idx}
                      className="group bg-white p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div className="aspect-4/3 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center relative mb-2">
                        {isPdf ? (
                          <div className="flex flex-col items-center justify-center text-red-600 p-2">
                            <FileText className="w-8 h-8" />
                            <span className="text-[10px] font-bold mt-1">PDF 掃描件</span>
                          </div>
                        ) : (
                          <img
                            src={file.dataUrl}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                          {onPreviewMedia && (
                            <button
                              type="button"
                              onClick={() =>
                                onPreviewMedia({
                                  url: file.dataUrl,
                                  title: `支票 ${cheque.checkNumber} - ${file.name}`,
                                  isPdf
                                })
                              }
                              className="p-1.5 rounded-lg bg-white/90 text-slate-900 hover:bg-white text-xs font-bold"
                              title="點擊全螢幕預覽"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="truncate text-xs font-medium text-slate-800">
                        {file.name}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onPreviewMedia &&
                          onPreviewMedia({
                            url: file.dataUrl,
                            title: `支票 ${cheque.checkNumber} - ${file.name}`,
                            isPdf
                          })
                        }
                        className="mt-2 w-full py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>檢視影本</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 底部操作列 */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {canWrite && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (onDelete) {
                    onDelete(cheque.id);
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>刪除此票據紀錄</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors shadow-2xs"
            >
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
