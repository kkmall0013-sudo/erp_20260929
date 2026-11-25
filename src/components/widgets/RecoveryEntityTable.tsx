import React from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { SoftDeleteEntityConfig } from '../../utils/softDeleteRegistry';

interface RecoveryEntityTableProps {
  config: SoftDeleteEntityConfig<any>;
  items: any[];
  onRestore: (item: any) => void;
  onRequestPurge: (item: any) => void;
}

export const RecoveryEntityTable: React.FC<RecoveryEntityTableProps> = ({
  config,
  items,
  onRestore,
  onRequestPurge
}) => {
  const EmptyIcon = config.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <span>{config.sectionTitle}</span>
          <span className="text-[10px] font-normal text-slate-500">
            (目前共 {items.length} 筆，{config.sectionHint})
          </span>
        </h3>
      </div>

      {items.length === 0 ? (
        <div className="py-16 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
          <EmptyIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-600">{config.emptyTitle}</p>
          <p className="text-[11px] text-slate-400 mt-1">{config.emptySubtitle}</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                {config.columns.map((col, idx) => (
                  <th key={idx} className={`py-3 px-4 ${col.alignRight ? 'text-right' : ''}`}>
                    {col.header}
                  </th>
                ))}
                <th className="py-3 px-4 text-right">Superadmin 處置</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-amber-50/50 transition-colors">
                  {config.columns.map((col, idx) => (
                    <td key={idx} className={`py-3 px-4 ${col.alignRight ? 'text-right' : ''}`}>
                      {col.render(item)}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onRestore(item)}
                        className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title={config.restoreTooltip}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>↩️ 救回還原</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRequestPurge(item)}
                        className="px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                        title="物理抹除（不可還原，保留日誌）"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
