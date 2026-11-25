import React, { useState } from 'react';
import { Archive, Sparkles, RefreshCw, Lock, Eye } from 'lucide-react';
import { createAnnualArchiveSnapshot } from '../../../db/sqlite';
import { AnnualArchiveSnapshot } from '../../../types/erp';

interface DatabaseAnnualArchiveTabProps {
  archiveSnapshots: AnnualArchiveSnapshot[];
  onReloadLocal: () => void;
  onDataChanged: () => void;
  showToast: (msg: string) => void;
  onInspectArchiveYear: (year: number, fileName: string) => void;
}

export const DatabaseAnnualArchiveTab: React.FC<DatabaseAnnualArchiveTabProps> = ({
  archiveSnapshots,
  onReloadLocal,
  onDataChanged,
  showToast,
  onInspectArchiveYear
}) => {
  const [targetYear, setTargetYear] = useState<number>(new Date().getFullYear() - 1);
  const [archiveDesc, setArchiveDesc] = useState<string>('');
  const [isArchiving, setIsArchiving] = useState(false);

  const handleCreateArchive = () => {
    setIsArchiving(true);
    setTimeout(() => {
      const res = createAnnualArchiveSnapshot(
        targetYear,
        archiveDesc || `${targetYear} 年度營造工程完工與財務單據自包含唯讀封存快照`
      );
      setIsArchiving(false);
      if (res.success) {
        showToast(res.message);
        onReloadLocal();
        onDataChanged();
        setArchiveDesc('');
      } else {
        showToast(res.message);
      }
    }, 150);
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-4 text-xs text-amber-950 leading-relaxed flex items-start gap-3">
        <Archive className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm text-amber-950 mb-1">
            年度唯讀封存快照 (Annual Archival Snapshots & Self-Contained Views)
          </h4>
          <p className="text-amber-800/90">
            主庫平時累積全部完整活資料；每年底結算完成後，系統產出該年度的「自包含唯讀死資料切片檔」。供三大落地用途：① 免啟動主庫的靜態離線查閱；② 新機遷移時挑選載入近 5~10 年資料；③ 不可篡改之災難救援基底。
          </p>
        </div>
      </div>

      {/* 產生新年份封存卡片 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>建立年度唯讀自包含封存快照</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              封存目標年份 (西元年)
            </label>
            <select
              value={targetYear}
              onChange={(e) => setTargetYear(Number(e.target.value))}
              className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map(y => (
                <option key={y} value={y}>{y} 年度 (1/1 ~ 12/31)</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              封存備註說明 (選填)
            </label>
            <input
              type="text"
              value={archiveDesc}
              onChange={(e) => setArchiveDesc(e.target.value)}
              placeholder={`例如：${targetYear} 年度已結案工程與完稅財務憑單全量封存`}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 bg-white"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleCreateArchive}
            disabled={isArchiving}
            className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
          >
            {isArchiving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            <span>{isArchiving ? '封裝處理中...' : `一鍵封裝 ${targetYear} 年度唯讀死資料快照`}</span>
          </button>
        </div>
      </div>

      {/* 已封存快照清冊 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center justify-between">
          <span>歷年已建立之年度封存快照索引 ({archiveSnapshots.length})</span>
          <span className="text-[11px] font-normal text-slate-400">PRAGMA query_only = ON 唯讀保護</span>
        </h4>

        {archiveSnapshots.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 space-y-2">
            <Archive className="w-8 h-8 mx-auto text-slate-300" />
            <p>尚無年度封存快照。您可於上方建立過去年度的自包含切片檔。</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {archiveSnapshots.map(arc => (
              <div key={arc.id} className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono">
                      {arc.archiveYear} 年度
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {arc.archiveFileName}
                    </span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.2 rounded-full font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      已唯讀鎖定
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{arc.description}</p>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-4">
                    <span>自包含記錄: {arc.recordCount} 筆</span>
                    <span>大小: {(arc.fileSizeBytes / 1024).toFixed(1)} KB</span>
                    <span>封存時間: {arc.sealedAt.slice(0, 16).replace('T', ' ')}</span>
                    <span>指紋: {arc.fileHash.slice(0, 20)}...</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onInspectArchiveYear(arc.archiveYear, arc.archiveFileName)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-400 text-xs text-slate-700 hover:text-indigo-600 font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>在檢視器開啟</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
