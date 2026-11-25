import React from 'react';
import { Archive, CheckCircle2, Clock, Crown, Flame, Undo2 } from 'lucide-react';
import { User } from '../../../types/erp';

interface AccountTrashTabProps {
  trashUsers: User[];
  onRestorePending: (user: User) => void;
  onRequestAdvanceArchive: (user: User) => void;
}

export const AccountTrashTab: React.FC<AccountTrashTabProps> = ({
  trashUsers,
  onRestorePending,
  onRequestAdvanceArchive,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="font-bold text-amber-900">待刪除回收站（7日冷卻保護期）</div>
          <p className="text-amber-800 leading-relaxed text-[11px]">
            遭刪除之同仁帳號將在此保留 7 天，期間其系統登入權限自動停用。管理人員可於冷卻期內隨時點選「一鍵復原」無損救回主檔；亦可手動「提前送往封存」。若 7 天冷卻期屆滿，系統將自動移交至 Superadmin 深度封存區。
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-3.5">待刪同仁姓名 / 帳號</th>
                <th className="py-3 px-3">原職務職稱</th>
                <th className="py-3 px-3">原身分層級</th>
                <th className="py-3 px-3">刪除經辦人</th>
                <th className="py-3 px-3">移入冷卻時間</th>
                <th className="py-3 px-3">剩餘冷卻期</th>
                <th className="py-3 px-3">刪除事由 / 備註</th>
                <th className="py-3 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trashUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                    <div>目前回收站內無任何待刪除帳號，所有人員主檔運作正常</div>
                  </td>
                </tr>
              ) : (
                trashUsers.map(user => {
                  const due = user.purgeDueAt ? new Date(user.purgeDueAt).getTime() : 0;
                  const remainingMs = due - Date.now();
                  const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
                  const remainingHours = Math.max(
                    0,
                    Math.ceil((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
                  );

                  return (
                    <tr key={user.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-800">{user.fullName}</div>
                        <div className="font-mono text-[11px] text-indigo-600">@{user.username}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{user.title || '-'}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            user.role === 'ADMIN'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {user.role === 'ADMIN' ? '系統管理員 (ADMIN)' : '業務同仁 (USER)'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {user.deletedBy || '管理員'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                        {user.stageDeletedAt ? new Date(user.stageDeletedAt).toLocaleString() : '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          剩餘 {remainingDays} 天 {remainingHours} 小時
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">
                        {user.stageNotes || '正常待刪移轉'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onRestorePending(user)}
                            className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer border border-emerald-200"
                            title="一鍵復原回啟用同仁主檔"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>一鍵復原</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onRequestAdvanceArchive(user)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-600 font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer border border-slate-300"
                            title="提前送往 Superadmin 深度封存區"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>提前送往封存</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface AccountArchiveTabProps {
  archivedUsers: User[];
  onSuperadminRestore: (user: User) => void;
  onRequestPurge: (user: User) => void;
}

export const AccountArchiveTab: React.FC<AccountArchiveTabProps> = ({
  archivedUsers,
  onSuperadminRestore,
  onRequestPurge,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
        <Archive className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="font-bold text-purple-950 flex items-center gap-1.5">
            <span>帳號深度封存區（Superadmin 專屬救援與終極清理）</span>
            <span className="text-[10px] bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded font-mono">
              最高權限
            </span>
          </div>
          <p className="text-purple-900 leading-relaxed text-[11px]">
            此處收容冷卻期屆滿（滿7天）或經提前二次刪除之同仁帳號。一般 Admin 視角已徹底隱藏且無權存取。最高 Superadmin 可在此進行「終極救回復原」，或於必要時輸入安全驗證詞執行「不可逆之資料庫物理實體粉碎清除」。歷史單據將純淨保留其姓名純文字快照，永不留白。
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-3.5">已封存同仁姓名 / 帳號</th>
                <th className="py-3 px-3">原職稱</th>
                <th className="py-3 px-3">原身分層級</th>
                <th className="py-3 px-3">移交封存時間</th>
                <th className="py-3 px-3">移交經辦人</th>
                <th className="py-3 px-3">封存說明</th>
                <th className="py-3 px-3 text-right">Superadmin 終極操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {archivedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Archive className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-60" />
                    <div>目前封存區內無任何待清理同仁帳號</div>
                  </td>
                </tr>
              ) : (
                archivedUsers.map(user => (
                  <tr key={user.id} className="hover:bg-purple-50/20 transition-colors">
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-800">{user.fullName}</div>
                      <div className="font-mono text-[11px] text-indigo-600">@{user.username}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{user.title || '-'}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {user.role === 'ADMIN' ? '管理員 (ADMIN)' : '一般同仁 (USER)'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      {user.stageDeletedAt ? new Date(user.stageDeletedAt).toLocaleString() : '-'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {user.deletedBy || '系統排程'}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">
                      {user.stageNotes || '7日冷卻期滿自動封存'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSuperadminRestore(user)}
                          className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-500 hover:text-slate-950 text-amber-800 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer border border-amber-300"
                          title="Superadmin 終極救回復原"
                        >
                          <Crown className="w-3.5 h-3.5 text-amber-600" />
                          <span>終極救回</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestPurge(user)}
                          className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer border border-rose-200"
                          title="從資料庫中物理永久清除 (不可逆)"
                        >
                          <Flame className="w-3.5 h-3.5 text-rose-600" />
                          <span>物理粉碎</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
