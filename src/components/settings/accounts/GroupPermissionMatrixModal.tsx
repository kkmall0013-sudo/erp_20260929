import React, { useState } from 'react';
import { FileSpreadsheet, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  createGroup,
  deleteGroup,
  SYSTEM_MODULES,
  toggleGroupModulePermission,
  updateGroup,
} from '../../../db/sqlite';
import { GroupModulePermission, ModuleKey, User, UserGroup } from '../../../types/erp';
import { AlertModalState } from './accountManagementUtils';

interface GroupPermissionMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  allGroups: UserGroup[];
  allPermissions: GroupModulePermission[];
  currentUser: User | null;
  operatorCanManageUsers: boolean;
  onShowAlert: (alert: AlertModalState) => void;
  onShowToast: (msg: string) => void;
  onReloadAuth: () => void;
  onDataChanged: () => void;
}

export const GroupPermissionMatrixModal: React.FC<GroupPermissionMatrixModalProps> = ({
  isOpen,
  onClose,
  allGroups,
  allPermissions,
  currentUser,
  operatorCanManageUsers,
  onShowAlert,
  onShowToast,
  onReloadAuth,
  onDataChanged,
}) => {
  const [isNewGroupFormOpen, setIsNewGroupFormOpen] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({
    groupCode: '',
    groupName: '',
    description: '',
    approvalLimit: 1000000,
    canExport: true,
  });

  if (!isOpen) return null;

  const handleCreateGroup = () => {
    if (!newGroupForm.groupCode.trim() || !newGroupForm.groupName.trim()) {
      onShowAlert({ title: '欄位未填', message: '請輸入群組識別碼與群組中文名稱！' });
      return;
    }
    try {
      const createdName = newGroupForm.groupName.trim();
      const defaultPerms = SYSTEM_MODULES.map(m => ({
        moduleKey: m.key as ModuleKey,
        canRead: m.key === 'PROJECTS' || m.key === 'COMPANIES',
        canWrite: m.key === 'PROJECTS',
        canApprove: false,
        canExport: false,
      }));
      createGroup(
        {
          groupCode: newGroupForm.groupCode.trim(),
          groupName: createdName,
          description: newGroupForm.description.trim() || '自訂業務權限群組',
          approvalLimit: newGroupForm.approvalLimit,
          canExport: newGroupForm.canExport,
        },
        defaultPerms,
        currentUser?.fullName || '管理員'
      );
      setNewGroupForm({
        groupCode: '',
        groupName: '',
        description: '',
        approvalLimit: 1000000,
        canExport: true,
      });
      setIsNewGroupFormOpen(false);
      onReloadAuth();
      onDataChanged();
      onShowToast(`🎉 已建立新權限群組【${createdName}】，可立即在矩陣配置權限！`);
    } catch (err: unknown) {
      onShowAlert({ title: '建立群組失敗', message: (err as Error).message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span>12 大營造核心模組 × 業務群組 權限即時配置矩陣 (PBAC Matrix)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  點擊「讀 / 寫 / 審 / 出」或調整額度即刻生效
                </span>
              </h3>
              <div className="text-[11px] text-slate-300 mt-0.5">
                點擊下方各群組之【讀 (檢視)、寫 (新增修改)、審 (核准過帳)、出 (匯出列印)】即可即時開啟或擋下權限；變更將自動記錄至純中文差異稽核日誌
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {operatorCanManageUsers && (
              <button
                type="button"
                onClick={() => setIsNewGroupFormOpen(prev => !prev)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isNewGroupFormOpen ? '收合新增群組' : '新增自訂群組'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white cursor-pointer p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 新增自訂業務權限群組表單列 */}
        {isNewGroupFormOpen && (
          <div className="px-6 py-3.5 bg-indigo-50/90 border-b border-indigo-200 flex flex-wrap items-end gap-3 text-xs animate-in fade-in">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                群組識別碼 *
              </label>
              <input
                type="text"
                value={newGroupForm.groupCode}
                onChange={e =>
                  setNewGroupForm(prev => ({ ...prev, groupCode: e.target.value.toUpperCase() }))
                }
                placeholder="如: QA_TEAM"
                className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-mono w-28"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                群組中文名稱 *
              </label>
              <input
                type="text"
                value={newGroupForm.groupName}
                onChange={e => setNewGroupForm(prev => ({ ...prev, groupName: e.target.value }))}
                placeholder="如: 品管安衛組"
                className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs w-36"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">職責說明</label>
              <input
                type="text"
                value={newGroupForm.description}
                onChange={e =>
                  setNewGroupForm(prev => ({ ...prev, description: e.target.value }))
                }
                placeholder="如: 工地安全衛生稽核與品質查驗"
                className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs w-full"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">單筆審核額度</label>
              <select
                value={newGroupForm.approvalLimit}
                onChange={e =>
                  setNewGroupForm(prev => ({ ...prev, approvalLimit: Number(e.target.value) }))
                }
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
              >
                <option value={0}>$0 (僅填草稿)</option>
                <option value={1000000}>$100萬</option>
                <option value={3000000}>$300萬</option>
                <option value={5000000}>$500萬</option>
                <option value={10000000}>$1,000萬</option>
                <option value={50000000}>$5,000萬</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 py-1 cursor-pointer font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={newGroupForm.canExport}
                onChange={e =>
                  setNewGroupForm(prev => ({ ...prev, canExport: e.target.checked }))
                }
                className="rounded text-indigo-600"
              />
              <span>允許匯出報表</span>
            </label>
            <button
              type="button"
              onClick={handleCreateGroup}
              className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-2xs"
            >
              建立群組
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          <div className="border border-slate-200 rounded-lg overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-3 px-3 w-24">模組類別</th>
                  <th className="py-3 px-3 min-w-[190px]">營造工程核心模組</th>
                  {allGroups.map(grp => (
                    <th
                      key={grp.id}
                      className="py-2.5 px-2.5 text-center min-w-[155px] border-l border-slate-200/80"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-slate-900 font-extrabold">{grp.groupName}</span>
                        {!grp.isSystem && operatorCanManageUsers && (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                deleteGroup(grp.id, currentUser?.fullName || '管理員');
                                onReloadAuth();
                                onDataChanged();
                                onShowToast(`🗑️ 已刪除自訂群組【${grp.groupName}】`);
                              } catch (err: unknown) {
                                onShowAlert({
                                  title: '無法刪除群組',
                                  message: (err as Error).message,
                                });
                              }
                            }}
                            title="刪除此自訂群組"
                            className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* 單筆審核額度即時調整器 */}
                      <div className="mt-1.5 flex items-center justify-center gap-1">
                        <span className="text-[10px] font-normal text-slate-500">審核額度:</span>
                        <select
                          value={grp.approvalLimit}
                          disabled={!operatorCanManageUsers}
                          onChange={e => {
                            const nextLimit = Number(e.target.value);
                            try {
                              updateGroup(
                                { id: grp.id, approvalLimit: nextLimit },
                                undefined,
                                currentUser?.fullName || '管理員'
                              );
                              onReloadAuth();
                              onDataChanged();
                              onShowToast(
                                `💰 已更新【${grp.groupName}】單筆審核額度為 ${
                                  nextLimit > 0
                                    ? `NT$ ${nextLimit.toLocaleString()}`
                                    : '$0 (僅填草稿)'
                                }`
                              );
                            } catch (err: unknown) {
                              onShowAlert({
                                title: '更新額度失敗',
                                message: (err as Error).message,
                              });
                            }
                          }}
                          className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-indigo-700 cursor-pointer outline-none"
                        >
                          <option value={0}>$0 (僅草稿)</option>
                          <option value={1000000}>$100萬</option>
                          <option value={3000000}>$300萬</option>
                          <option value={5000000}>$500萬</option>
                          <option value={10000000}>$1,000萬</option>
                          <option value={30000000}>$3,000萬</option>
                          <option value={50000000}>$5,000萬</option>
                          <option value={100000000}>$1億</option>
                        </select>
                      </div>

                      {/* 群組全域匯出開關 */}
                      <div className="mt-1 flex items-center justify-center">
                        <button
                          type="button"
                          disabled={!operatorCanManageUsers}
                          onClick={() => {
                            try {
                              updateGroup(
                                { id: grp.id, canExport: !grp.canExport },
                                undefined,
                                currentUser?.fullName || '管理員'
                              );
                              onReloadAuth();
                              onDataChanged();
                              onShowToast(
                                `${!grp.canExport ? '✅ 已開放' : '🔒 已禁止'}【${
                                  grp.groupName
                                }】全域報表匯出權限`
                              );
                            } catch (err: unknown) {
                              onShowAlert({
                                title: '更新失敗',
                                message: (err as Error).message,
                              });
                            }
                          }}
                          className={`text-[10px] px-1.5 py-0.2 rounded border transition-colors cursor-pointer ${
                            grp.canExport
                              ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold'
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}
                        >
                          全域匯出: {grp.canExport ? '允許' : '禁止'}
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {SYSTEM_MODULES.map(mod => (
                  <tr key={mod.key} className="hover:bg-slate-50/80">
                    <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                      {mod.category}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-800">{mod.name}</div>
                      <div className="text-[10px] text-slate-400">{mod.description}</div>
                    </td>
                    {allGroups.map(grp => {
                      const p = allPermissions.find(
                        item => item.groupId === grp.id && item.moduleKey === mod.key
                      ) || {
                        canRead: false,
                        canWrite: false,
                        canApprove: false,
                        canExport: false,
                      };
                      const handleClickToggle = (
                        field: 'canRead' | 'canWrite' | 'canApprove' | 'canExport',
                        labelCn: string
                      ) => {
                        if (!operatorCanManageUsers) {
                          onShowAlert({
                            title: '權限不足',
                            message: '您未具備帳號與權限管理授權，無法變更權限矩陣！',
                          });
                          return;
                        }
                        try {
                          toggleGroupModulePermission(
                            grp.id,
                            mod.key as ModuleKey,
                            field,
                            currentUser?.fullName || '管理員'
                          );
                          onReloadAuth();
                          onDataChanged();
                          onShowToast(
                            `⚡ 已切換【${grp.groupName}】於「${mod.name}」之【${labelCn}】權限！`
                          );
                        } catch (err: unknown) {
                          onShowAlert({
                            title: '切換權限失敗',
                            message: (err as Error).message,
                          });
                        }
                      };

                      return (
                        <td
                          key={grp.id}
                          className="py-2 px-2.5 text-center border-l border-slate-100"
                        >
                          <div className="inline-flex items-center justify-center gap-1 font-mono text-[11px]">
                            <button
                              type="button"
                              onClick={() => handleClickToggle('canRead', '讀取檢視')}
                              title={`點擊切換【${grp.groupName}】對「${mod.name}」之讀取檢視 (Read) 權限`}
                              className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                p.canRead
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold shadow-2xs hover:bg-emerald-200'
                                  : 'bg-slate-50 text-slate-300 border-slate-200 hover:bg-slate-100 hover:text-slate-500'
                              }`}
                            >
                              讀
                            </button>
                            <button
                              type="button"
                              onClick={() => handleClickToggle('canWrite', '新增編輯')}
                              title={`點擊切換【${grp.groupName}】對「${mod.name}」之新增編輯 (Write) 權限`}
                              className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                p.canWrite
                                  ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold shadow-2xs hover:bg-indigo-200'
                                  : 'bg-slate-50 text-slate-300 border-slate-200 hover:bg-slate-100 hover:text-slate-500'
                              }`}
                            >
                              寫
                            </button>
                            <button
                              type="button"
                              onClick={() => handleClickToggle('canApprove', '單據核准')}
                              title={`點擊切換【${grp.groupName}】對「${mod.name}」之單據核准 (Approve) 權限`}
                              className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                p.canApprove
                                  ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold shadow-2xs hover:bg-amber-200'
                                  : 'bg-slate-50 text-slate-300 border-slate-200 hover:bg-slate-100 hover:text-slate-500'
                              }`}
                            >
                              審
                            </button>
                            <button
                              type="button"
                              onClick={() => handleClickToggle('canExport', '報表匯出')}
                              title={`點擊切換【${grp.groupName}】對「${mod.name}」之報表匯出 (Export) 權限`}
                              className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                p.canExport && grp.canExport
                                  ? 'bg-purple-100 text-purple-800 border-purple-300 font-bold shadow-2xs hover:bg-purple-200'
                                  : p.canExport && !grp.canExport
                                  ? 'bg-amber-50 text-amber-500 border-amber-200 line-through'
                                  : 'bg-slate-50 text-slate-300 border-slate-200 hover:bg-slate-100 hover:text-slate-500'
                              }`}
                            >
                              出
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              智慧連動：開啟「寫/審/出」將自動開啟「讀」；關閉「讀」將自動一併收回「寫/審/出」權限。
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white cursor-pointer"
          >
            完成並關閉矩陣
          </button>
        </div>
      </div>
    </div>
  );
};
