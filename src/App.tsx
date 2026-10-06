import React, { useEffect, useState, useCallback } from 'react';
import { TopSubWindow } from './components/TopSubWindow';
import { LeftSubWindow, LeftNavId } from './components/LeftSubWindow';
import { RightSubWindow } from './components/RightSubWindow';
import { DatabaseManagementModal } from './components/DatabaseManagementModal';
import { AuthProvider } from './context/AuthContext';

import {
  getDatabase,
  subscribeToDatabase,
  getAllCompanies,
  getAllProjects,
  getAllAuditLogs,
  exportSqlDump,
  exportSqliteBinary,
  importSql,
  resetToSeedData
} from './db/sqlite';

import {
  Company,
  Project,
  AuditLog
} from './types/erp';

export const App: React.FC = () => {
  const [isDbReady, setIsDbReady] = useState(false);
  
  // 當前選取之左側導航功能 (優先聚焦：公司設定 COMPANY)
  const [activeNavId, setActiveNavId] = useState<LeftNavId>('COMPANY');
  const [isLeftNavOpen, setIsLeftNavOpen] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('COMP-01');

  // 選取的當前案場 ID (供專案主檔切換測試)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // 核心資料狀態
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // 浮動提示 Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 資料庫管理與歷史封存中心彈窗
  const [isDbCenterOpen, setIsDbCenterOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // 重新載入所有資料庫狀態
  const reloadData = useCallback(() => {
    const comps = getAllCompanies();
    const projs = getAllProjects();
    const audits = getAllAuditLogs();
    setCompanies(comps);
    setProjects(projs);
    setAuditLogs(audits);

    if (projs.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projs[0].id);
    }
  }, [selectedProjectId]);

  // 初始化 SQLite 資料庫
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    getDatabase().then(() => {
      setIsDbReady(true);
      reloadData();
      unsubscribe = subscribeToDatabase(() => {
        reloadData();
      });
    }).catch(err => {
      console.error('SQLite 資料庫初始化失敗', err);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [reloadData]);

  // 快捷匯出純文字 SQL 指令檔
  const handleQuickBackupSql = () => {
    try {
      const sqlContent = exportSqlDump();
      const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `engineering_erp_dump_${new Date().toISOString().slice(0, 10)}.sql`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('✅ 已成功匯出完整 SQLite SQL 備份指令檔');
    } catch (err) {
      console.error(err);
      showToast('❌ 匯出失敗：' + (err as Error).message);
    }
  };

  // 快捷備份 SQLite 二進位檔案
  const handleQuickBackupSqlite = () => {
    try {
      const binaryData = exportSqliteBinary();
      const blob = new Blob([binaryData.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `engineering_erp_database_${new Date().toISOString().slice(0, 10)}.sqlite`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('✅ 已成功下載 .sqlite 二進位資料庫備份檔案');
    } catch (err) {
      console.error(err);
      showToast('❌ 下載失敗：' + (err as Error).message);
    }
  };

  // 匯入 SQL 指令檔還原資料庫 (供測試人員或協作者一鍵同步)
  const handleImportSql = (sqlText: string) => {
    try {
      const res = importSql(sqlText);
      if (res.success) {
        reloadData();
        showToast('✅ 資料庫已成功由 SQL 指令檔匯入還原！');
      } else {
        showToast('❌ 匯入失敗: ' + res.message);
      }
    } catch (err) {
      console.error(err);
      showToast('❌ 匯入異常: ' + (err as Error).message);
    }
  };

  // 重設為初始預設種子資料庫
  const handleResetDatabase = () => {
    try {
      resetToSeedData();
      reloadData();
      showToast('🔄 資料庫已成功重設為系統初始種子狀態');
    } catch (err) {
      console.error(err);
      showToast('❌ 重設失敗: ' + (err as Error).message);
    }
  };

  if (!isDbReady) {
    return (
      <div className="h-screen w-screen bg-slate-900 text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <h2 className="text-lg font-bold">載入 SQLite 本地資料庫引擎中...</h2>
          <p className="text-xs text-slate-400 mt-1">鼎新 A1 商務應用雲版面配置引擎</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      {/* ======================================================== */}
      {/* 父視窗：滿版 100vw × 100vh，外層無捲軸，嚴格切割為 3 個子視窗 */}
      {/* ======================================================== */}
      <div className="h-screen w-screen flex flex-col bg-[#eef1f5] overflow-hidden font-sans select-none">
        {/* 子視窗 1：[TOP 子視窗] 常駐頂部資訊與重要功能 (固定 48px，完全無捲軸) */}
        <TopSubWindow
          companies={companies}
          selectedCompanyId={selectedCompanyId}
          onSelectCompany={setSelectedCompanyId}
          onToggleLeftNav={() => setIsLeftNavOpen(prev => !prev)}
          onQuickBackupSql={handleQuickBackupSql}
          onQuickBackupSqlite={handleQuickBackupSqlite}
          onImportSql={handleImportSql}
          onResetDatabase={handleResetDatabase}
          onOpenFlowchart={() => setActiveNavId('FLOWCHART')}
          onOpenDatabaseCenter={() => setIsDbCenterOpen(true)}
        />

        {/* 下半部主體分割：LEFT 與 RIGHT 子視窗 */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* 子視窗 2：[LEFT 子視窗] 緊湊功能導航欄 (固定 62px 寬，圖示上+文字下，完全不隨右側滾動) */}
          <LeftSubWindow
            activeId={activeNavId}
            onSelect={setActiveNavId}
            isOpen={isLeftNavOpen}
          />

          {/* 子視窗 3：[RIGHT 主工作子視窗] (自適應佔滿剩餘 95% 寬度，全視窗唯一擁有內部垂直滾動) */}
          <RightSubWindow
            activeNavId={activeNavId}
            onNavigateNav={setActiveNavId}
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProjectId={setSelectedProjectId}
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            onSelectCompany={setSelectedCompanyId}
            onReloadData={reloadData}
          />
        </div>

        {/* 資料庫管理與歷史封存中心 Modal */}
        <DatabaseManagementModal
          isOpen={isDbCenterOpen}
          onClose={() => setIsDbCenterOpen(false)}
          onDataChanged={reloadData}
          showToast={showToast}
        />

        {/* 浮動提示 Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-xl text-xs font-semibold z-50 animate-in fade-in">
            {toastMessage}
          </div>
        )}
      </div>
    </AuthProvider>
  );
};

export default App;
