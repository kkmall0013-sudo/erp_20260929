import React, { useState } from 'react';
import { Project, ProjectSite, ProjectWBS } from '../../types/erp';
import { FolderGit2, Plus, Lock, Unlock, MapPin, Layers, Building, Calendar, DollarSign } from 'lucide-react';
import { getDatabase, saveDatabaseSnapshot, logAudit } from '../../db/sqlite';

interface ProjectModuleProps {
  projects: Project[];
  onDataChanged: () => void;
}

export const ProjectModule: React.FC<ProjectModuleProps> = ({ projects, onDataChanged }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    projectCode: `PRJ-2026-00${projects.length + 1}`,
    name: '',
    ownerName: '',
    ownerTaxId: '',
    contractAmount: 30000000,
    budgetAmount: 25000000,
    startDate: '2026-05-01',
    endDate: '2027-06-30',
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  // 切換專案鎖定狀態 (憲法 RULE: 專案鎖定防工務私自竄改)
  const handleToggleLock = async (project: Project) => {
    const db = await getDatabase();
    const newLock = project.isLocked ? 0 : 1;
    const newStatus = newLock ? 'LOCKED' : 'ACTIVE';
    db.run(`UPDATE projects SET isLocked = ${newLock}, status = '${newStatus}', version = version + 1 WHERE id = '${project.id}';`);
    logAudit(db, '黃副總經理', 'UPDATE', 'projects', project.id, { isLocked: project.isLocked }, { isLocked: Boolean(newLock) });
    saveDatabaseSnapshot();
    onDataChanged();
  };

  // 新增專案案場
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !newProject.ownerName) return;

    const db = await getDatabase();
    const id = `PRJ-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString().substring(0, 10);

    db.run(`
      INSERT INTO projects (id, projectCode, name, ownerName, ownerTaxId, contractAmount, budgetAmount, committedCost, actualCost, startDate, endDate, status, isLocked, companyId, isDeleted, version, createdAt, updatedAt)
      VALUES ('${id}', '${newProject.projectCode}', '${newProject.name.replace(/'/g, "''")}', '${newProject.ownerName.replace(/'/g, "''")}', '${newProject.ownerTaxId}', ${newProject.contractAmount}, ${newProject.budgetAmount}, 0, 0, '${newProject.startDate}', '${newProject.endDate}', 'ACTIVE', 0, 'COMP-01', 0, 1, '${now}', '${now}');
    `);

    // 建立預設案場與 WBS
    db.run(`
      INSERT INTO project_sites (id, projectId, siteName, address, contactPerson, contactPhone)
      VALUES ('SITE-${id}', '${id}', '${newProject.name.replace(/'/g, "''")} 工地所', '台灣施工基地', '待指派工地主任', '0900-000-000');
    `);

    logAudit(db, '黃副總經理', 'CREATE', 'projects', id, undefined, { code: newProject.projectCode, name: newProject.name });
    saveDatabaseSnapshot();
    onDataChanged();
    setShowCreateModal(false);
    setSelectedProjectId(id);
  };

  return (
    <div className="space-y-6">
      {/* 頁面頂部控制列 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              專案與案場建檔模組 (Phase 2 & 憲法第三篇)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              營造案場合約立項 · WBS 工項預算拆解 · 鎖定過帳防弊
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>新建專案案場</span>
        </button>
      </div>

      {/* 專案卡片清單與詳細資訊 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側清單 */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            進行中專案清單 ({projects.length})
          </div>

          {projects.map((project) => {
            const isSelected = project.id === selectedProject?.id;
            const burnPct = project.budgetAmount > 0
              ? Math.min(100, Math.round((project.actualCost / project.budgetAmount) * 100))
              : 0;

            return (
              <div
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/40 border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-600">
                      {project.projectCode}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-1">
                      {project.name}
                    </h4>
                  </div>
                  {project.isLocked ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      已鎖定
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 flex items-center gap-1">
                      <Unlock className="w-3 h-3" />
                      施工中
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" />
                  <span className="truncate">{project.ownerName}</span>
                </div>

                {/* 預算消耗進度條 */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-400">實際執行成本</span>
                    <span className="font-mono text-slate-700 tabular-nums">
                      ${project.actualCost.toLocaleString()} ({burnPct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        burnPct > 90 ? 'bg-rose-500' : burnPct > 70 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${burnPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 右側詳細資料面板 */}
        {selectedProject && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    {selectedProject.projectCode}
                  </span>
                  <span className="text-xs text-slate-400">
                    建檔日: {selectedProject.createdAt}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedProject.name}
                </h3>
              </div>

              {/* 專案鎖定切換 */}
              <button
                onClick={() => handleToggleLock(selectedProject)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  selectedProject.isLocked
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                {selectedProject.isLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>專案已鎖定 (點擊解鎖)</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>鎖定專案 (防工務竄改預算)</span>
                  </>
                )}
              </button>
            </div>

            {/* 核心金額指標 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-400">業主合約總額 (未稅)</div>
                <div className="font-mono text-base font-bold text-slate-900 tabular-nums mt-0.5">
                  ${selectedProject.contractAmount.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-400">總核定工程預算</div>
                <div className="font-mono text-base font-bold text-blue-700 tabular-nums mt-0.5">
                  ${selectedProject.budgetAmount.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-400">已承諾發包額 (PO)</div>
                <div className="font-mono text-base font-bold text-amber-700 tabular-nums mt-0.5">
                  ${selectedProject.committedCost.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-400">累計已估驗實付額</div>
                <div className="font-mono text-base font-bold text-emerald-700 tabular-nums mt-0.5">
                  ${selectedProject.actualCost.toLocaleString()}
                </div>
              </div>
            </div>

            {/* 業主與合約資訊 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  業主法人資料
                </div>
                <div className="text-slate-600">業主名稱：{selectedProject.ownerName}</div>
                <div className="text-slate-600 font-mono">統一編號：{selectedProject.ownerTaxId || '未填寫'}</div>
              </div>

              <div className="space-y-1.5 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  工期起訖時程
                </div>
                <div className="text-slate-600 font-mono">預計開工日：{selectedProject.startDate}</div>
                <div className="text-slate-600 font-mono">預定竣工日：{selectedProject.endDate}</div>
              </div>
            </div>

            {/* 工務 WBS 節點與案場 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  WBS 工項拆解與預算上限控制
                </h4>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="px-3 py-2 font-mono">工項代碼</th>
                      <th className="px-3 py-2">工項說明</th>
                      <th className="px-3 py-2 text-right">核定預算</th>
                      <th className="px-3 py-2 text-right">已承諾發包</th>
                      <th className="px-3 py-2 text-right">目前估驗實支</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-slate-700">
                    <tr>
                      <td className="px-3 py-2 font-bold text-blue-600">WBS-100</td>
                      <td className="px-3 py-2 font-sans">地下室連續壁與土方深開挖工程</td>
                      <td className="px-3 py-2 text-right">$18,000,000</td>
                      <td className="px-3 py-2 text-right text-amber-600">$16,500,000</td>
                      <td className="px-3 py-2 text-right text-emerald-600">$15,000,000</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-bold text-blue-600">WBS-200</td>
                      <td className="px-3 py-2 font-sans">主體 SRC 鋼骨與 5000psi 混凝土澆置</td>
                      <td className="px-3 py-2 text-right">$34,000,000</td>
                      <td className="px-3 py-2 text-right text-amber-600">$22,500,000</td>
                      <td className="px-3 py-2 text-right text-emerald-600">$11,000,000</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-bold text-blue-600">WBS-300</td>
                      <td className="px-3 py-2 font-sans">機電配管、消防灑水與高低壓變電工程</td>
                      <td className="px-3 py-2 text-right">$20,000,000</td>
                      <td className="px-3 py-2 text-right text-amber-600">$9,000,000</td>
                      <td className="px-3 py-2 text-right text-emerald-600">$5,500,000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 新增專案彈窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">新建營造工程專案案場</h3>
            <form onSubmit={handleCreateProject} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">專案編號</label>
                  <input
                    type="text"
                    required
                    value={newProject.projectCode}
                    onChange={(e) => setNewProject({ ...newProject, projectCode: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">專案名稱</label>
                  <input
                    type="text"
                    required
                    placeholder="如：信義區商辦大樓新建工程"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">業主名稱</label>
                  <input
                    type="text"
                    required
                    placeholder="建設公司 / 開發商"
                    value={newProject.ownerName}
                    onChange={(e) => setNewProject({ ...newProject, ownerName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">業主統一編號</label>
                  <input
                    type="text"
                    placeholder="8 碼統編"
                    value={newProject.ownerTaxId}
                    onChange={(e) => setNewProject({ ...newProject, ownerTaxId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">合約總額 (未稅 NTD)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newProject.contractAmount}
                    onChange={(e) => setNewProject({ ...newProject, contractAmount: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">總預算目標 (NTD)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newProject.budgetAmount}
                    onChange={(e) => setNewProject({ ...newProject, budgetAmount: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">開工日期</label>
                  <input
                    type="date"
                    value={newProject.startDate}
                    onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">預計竣工日期</label>
                  <input
                    type="date"
                    value={newProject.endDate}
                    onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  建立專案
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
