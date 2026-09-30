import React, { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { FlowchartNavigator } from './components/FlowchartNavigator';
import { ProjectModule } from './components/modules/ProjectModule';
import { BusinessPartnerModule } from './components/modules/BusinessPartnerModule';
import { QuotationModule } from './components/modules/QuotationModule';
import { ProcurementModule } from './components/modules/ProcurementModule';
import { ValuationModule } from './components/modules/ValuationModule';
import { FinanceModule } from './components/modules/FinanceModule';
import { CommandCenterModule } from './components/modules/CommandCenterModule';
import { ReportsModule } from './components/modules/ReportsModule';
import { SystemConfigModule } from './components/modules/SystemConfigModule';
import { DatabaseManager } from './components/modules/DatabaseManager';
import { UserPermissionModule } from './components/modules/UserPermissionModule';
import { AuthScreen } from './components/AuthScreen';

import {
  getDatabase,
  subscribeToDatabase,
  getAllCompanies,
  getAllProjects,
  getAllBusinessPartners,
  getAllQuotations,
  getAllPurchaseOrders,
  getAllSubcontracts,
  getAllValuations,
  getAllAccountsPayable,
  getAllAccountsReceivable,
  getAllBankChecks,
  getAllSystemConfigs,
  getAllAuditLogs,
  getAllUsers,
  getAllRoles,
  getCashFlowMetrics,
  exportSqlDump,
  exportSqliteBinary
} from './db/sqlite';

import {
  Company,
  Project,
  BusinessPartner,
  Quotation,
  PurchaseOrder,
  Subcontract,
  Valuation,
  AccountPayable,
  AccountReceivable,
  BankCheck,
  SystemConfig,
  AuditLog,
  CashFlowMetrics,
  User,
  Role
} from './types/erp';

export const App: React.FC = () => {
  const [isDbReady, setIsDbReady] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('FLOWCHART');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('COMP-01');

  // 使用者身分與認證狀態
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  // 資料庫資料狀態
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [apList, setApList] = useState<AccountPayable[]>([]);
  const [arList, setArList] = useState<AccountReceivable[]>([]);
  const [checks, setChecks] = useState<BankCheck[]>([]);
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [metrics, setMetrics] = useState<CashFlowMetrics>({
    currentBankBalance: 38500000,
    projectedAR: 26775000,
    projectedAP: 15107500,
    unclearedChecks: 8727500,
    estimatedVAT: 583375,
    recurringExpenses: 2800000,
    projectedNetCash: 38056625,
    pendingChangeOrdersAmount: 8500000,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 重新載入所有資料庫狀態
  const reloadData = useCallback(() => {
    const loadedCompanies = getAllCompanies();
    const loadedUsers = getAllUsers();
    const loadedRoles = getAllRoles();

    setCompanies(loadedCompanies);
    setUsers(loadedUsers);
    setRoles(loadedRoles);
    setProjects(getAllProjects());
    setPartners(getAllBusinessPartners());
    setQuotations(getAllQuotations());
    setPurchaseOrders(getAllPurchaseOrders());
    setSubcontracts(getAllSubcontracts());
    setValuations(getAllValuations());
    setApList(getAllAccountsPayable());
    setArList(getAllAccountsReceivable());
    setChecks(getAllBankChecks());
    setConfigs(getAllSystemConfigs());
    setAuditLogs(getAllAuditLogs());
    setMetrics(getCashFlowMetrics());

    // 同步當前使用者資料（若已登入）
    setCurrentUser(prev => {
      if (!prev) return null;
      const updated = loadedUsers.find(u => u.id === prev.id);
      return updated || prev;
    });
  }, []);

  // 初始化資料庫
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    getDatabase().then(() => {
      setIsDbReady(true);
      reloadData();

      // 檢查本機儲存的登入狀態
      const savedUserId = localStorage.getItem('engineering_erp_current_user_id');
      const allUsers = getAllUsers();
      if (savedUserId) {
        const found = allUsers.find(u => u.id === savedUserId);
        if (found && found.status === 'ACTIVE') {
          setCurrentUser(found);
          if (found.defaultCompanyId) setSelectedCompanyId(found.defaultCompanyId);
        } else {
          // 預設為 admin 系統管理員
          const defaultAdmin = allUsers.find(u => u.username === 'admin') || allUsers[0];
          if (defaultAdmin) {
            setCurrentUser(defaultAdmin);
            localStorage.setItem('engineering_erp_current_user_id', defaultAdmin.id);
          }
        }
      } else {
        // 初次進入預設登入系統管理員 (陳大為)
        const defaultAdmin = allUsers.find(u => u.username === 'admin') || allUsers[0];
        if (defaultAdmin) {
          setCurrentUser(defaultAdmin);
          localStorage.setItem('engineering_erp_current_user_id', defaultAdmin.id);
        }
      }

      unsubscribe = subscribeToDatabase(() => {
        reloadData();
      });
    }).catch(err => {
      console.error('SQLite 資料庫初始化失敗', err);
      try {
        localStorage.removeItem('engineering_erp_sqlite_db');
      } catch (_) {}
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [reloadData]);

  // 登入成功處理
  const handleLoginSuccess = (user: User, companyId: string) => {
    setCurrentUser(user);
    setSelectedCompanyId(companyId);
    setIsLoggedOut(false);
    setIsAuthModalOpen(false);
    localStorage.setItem('engineering_erp_current_user_id', user.id);
    showToast(`🎉 歡迎回來，${user.fullName} (${user.role})！`);
  };

  // 登出系統
  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedOut(true);
    localStorage.removeItem('engineering_erp_current_user_id');
    showToast('已登出系統');
  };

  // 切換身分
  const handleImpersonateUser = (targetUser: User) => {
    setCurrentUser(targetUser);
    if (targetUser.defaultCompanyId) {
      setSelectedCompanyId(targetUser.defaultCompanyId);
    }
    localStorage.setItem('engineering_erp_current_user_id', targetUser.id);
    showToast(`已切換身分為：${targetUser.fullName} (${targetUser.role})`);
  };

  // 快捷 SQL 備份
  const handleQuickBackupSql = () => {
    try {
      const dump = exportSqlDump();
      const blob = new Blob([dump], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `engineering_erp_backup_${timestamp}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('✅ 已成功匯出 SQL 完整備份檔！');
    } catch (e) {
      showToast('❌ 匯出 SQL 失敗');
    }
  };

  // 快捷 SQLite 下載
  const handleQuickBackupSqlite = () => {
    try {
      const binary = exportSqliteBinary();
      const blob = new Blob([binary as unknown as BlobPart], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `engineering_erp_${timestamp}.sqlite`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('✅ 已成功下載 .sqlite 二進位備份檔！');
    } catch (e) {
      showToast('❌ 下載 SQLite 失敗');
    }
  };

  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <div className="text-base font-bold">客製化營造工程 ERP 系統</div>
          <div className="text-xs text-slate-400 mt-1">正在初始化 SQLite 本地引擎與全模組關聯結構...</div>
        </div>
      </div>
    );
  }

  // 若使用者已主動登出且目前無登入者，顯示完整的登入畫面
  if (isLoggedOut && !currentUser) {
    return (
      <AuthScreen
        users={users}
        companies={companies}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/80 text-slate-900 font-sans">
      {/* 頂部導航 */}
      <Header
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        currentUser={currentUser}
        onSelectCompany={setSelectedCompanyId}
        onQuickBackupSql={handleQuickBackupSql}
        onQuickBackupSqlite={handleQuickBackupSqlite}
        onOpenDatabaseManager={() => setActiveTab('DATABASE_MANAGER')}
        onOpenUserPermissions={() => setActiveTab('USERS_PERMISSIONS')}
        onOpenSwitchUserModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* 主體架構：左側 Sidebar + 右側主工作區 */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          stats={{
            projectsCount: projects.length,
            quotationsCount: quotations.length,
            posCount: purchaseOrders.length,
            valuationsCount: valuations.length,
            checksCount: checks.length,
            usersCount: users.length,
          }}
        />

        {/* 右側滾動內容視窗 */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* 流程地圖首頁 */}
            {activeTab === 'FLOWCHART' && (
              <FlowchartNavigator
                onNavigate={setActiveTab}
                stats={{
                  projectsCount: projects.length,
                  quotationsCount: quotations.length,
                  posCount: purchaseOrders.length,
                  valuationsCount: valuations.length,
                  checksCount: checks.length,
                  apCount: apList.length,
                  arCount: arList.length,
                }}
                metrics={{
                  projectedNetCash: metrics.projectedNetCash,
                  currentBankBalance: metrics.currentBankBalance,
                  pendingCO: metrics.pendingChangeOrdersAmount,
                }}
              />
            )}

            {/* 帳號與權限管理模組 (Phase 1 PBAC) */}
            {activeTab === 'USERS_PERMISSIONS' && (
              <UserPermissionModule
                users={users}
                roles={roles}
                companies={companies}
                currentUser={currentUser}
                onDataChanged={reloadData}
                onImpersonateUser={handleImpersonateUser}
              />
            )}

            {/* 各業務模組 */}
            {activeTab === 'PROJECTS' && (
              <ProjectModule projects={projects} onDataChanged={reloadData} />
            )}

            {activeTab === 'PARTNERS' && (
              <BusinessPartnerModule partners={partners} onDataChanged={reloadData} />
            )}

            {activeTab === 'QUOTATIONS' && (
              <QuotationModule quotations={quotations} onDataChanged={reloadData} />
            )}

            {activeTab === 'PROCUREMENT' && (
              <ProcurementModule
                purchaseOrders={purchaseOrders}
                partners={partners}
                projects={projects}
                onDataChanged={reloadData}
              />
            )}

            {activeTab === 'VALUATIONS' && (
              <ValuationModule
                valuations={valuations}
                subcontracts={subcontracts}
                onDataChanged={reloadData}
              />
            )}

            {activeTab === 'FINANCE' && (
              <FinanceModule
                apList={apList}
                arList={arList}
                checks={checks}
                companies={companies}
                onDataChanged={reloadData}
              />
            )}

            {activeTab === 'COMMAND_CENTER' && (
              <CommandCenterModule metrics={metrics} projects={projects} />
            )}

            {activeTab === 'REPORTS' && (
              <ReportsModule
                projects={projects}
                valuations={valuations}
                purchaseOrders={purchaseOrders}
              />
            )}

            {activeTab === 'SYSTEM_CONFIG' && (
              <SystemConfigModule
                configs={configs}
                auditLogs={auditLogs}
                onDataChanged={reloadData}
              />
            )}

            {activeTab === 'DATABASE_MANAGER' && (
              <DatabaseManager onDataChanged={reloadData} />
            )}
          </div>
        </main>
      </div>

      {/* 切換身分/登入彈窗 Modal */}
      {isAuthModalOpen && (
        <AuthScreen
          users={users}
          companies={companies}
          onLoginSuccess={handleLoginSuccess}
          onClose={() => setIsAuthModalOpen(false)}
          isModal={true}
        />
      )}

      {/* 浮動提示 Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium z-50 animate-bounce">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default App;
