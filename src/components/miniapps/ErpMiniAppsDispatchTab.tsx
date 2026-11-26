import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getAllAccountsReceivable,
  getAllApReconciliations,
  getAllArCollections,
  getAllBankChecks,
  getAllBusinessPartners,
  getAllCompanies,
  getAllCompanyTaxSettings,
  getAllInvoices,
  getAllPlannedInvoices,
  getAllProjectAdvances,
  getAllProjects,
  getAllSystemConfigs,
  getAppConfigMap
} from '../../db/sqlite';
import {
  CustomerBillingWorkflowMode,
  CustomerStatementMiniApp
} from '../finance/CustomerStatementMiniApp';
import { CheckRadarMiniApp } from '../finance/CheckRadarMiniApp';
import { Tax401WorkbookPanel } from '../finance/Tax401WorkbookPanel';

interface ErpMiniAppsDispatchTabProps {
  erpRefreshTick: number;
  onRefresh: () => void;
  onNotify?: (msg: string) => void;
}

export const ErpMiniAppsDispatchTab: React.FC<ErpMiniAppsDispatchTabProps> = ({
  erpRefreshTick,
  onRefresh,
  onNotify
}) => {
  const { currentUser, can, isSuperadmin, isBoss, isAdmin } = useAuth();
  const [activeErpMiniApp, setActiveErpMiniApp] = useState<'CUSTOMER_STATEMENT' | 'CHECK_RADAR' | 'TAX_401'>('CUSTOMER_STATEMENT');
  const [selected401CompanyId, setSelected401CompanyId] = useState('COMP-01');

  const canUseStatement = isSuperadmin || isBoss || isAdmin || can('PROJECTS', 'read') || can('FINANCE_AR', 'read');
  const canUseCheckRadar = isSuperadmin || isBoss || isAdmin || can('BANK_CHECKS', 'read');
  const canUse401 = isSuperadmin || isBoss || isAdmin || can('FINANCE_AR', 'read') || can('FINANCE_AP', 'read');

  void erpRefreshTick;
  const projects = getAllProjects();
  const arList = getAllAccountsReceivable();
  const arCollections = getAllArCollections();
  const projectAdvances = getAllProjectAdvances();
  const checks = getAllBankChecks();
  const reconciliations = getAllApReconciliations();
  const companies = getAllCompanies().filter(c => c.entityType === 'CORPORATION');
  const partners = getAllBusinessPartners();
  const invoices = getAllInvoices();
  const plannedInvoices = getAllPlannedInvoices();
  const companyTaxSettings = getAllCompanyTaxSettings();
  const sysCfgs = getAllSystemConfigs();
  const taxCfg = sysCfgs.find(c => c.configKey === 'TAX_RATE');
  const rawRate = taxCfg ? Number(String(taxCfg.configValue).replace('%', '').trim()) : 0.05;
  const taxRate = Number.isFinite(rawRate) && rawRate >= 0 ? (rawRate > 1 ? rawRate / 100 : rawRate) : 0.05;
  const appCfgMap = getAppConfigMap();
  const wfRaw = appCfgMap.APP_CUSTOMER_BILLING_MODE;
  const workflowMode: CustomerBillingWorkflowMode =
    wfRaw === 'PROJECT_AND_FINANCE' || wfRaw === 'PROJECT_FIRST_HANDOFF' ? wfRaw : 'FINANCE_ONLY';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900">
              模組化功能小程式架構 (獨立檔拆分 · 依權限即時調用)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              各業務工具已拆分封裝為獨立小程式元件，維護時只需針對單一檔案調整；授權人員可直接於此或各模組頁籤調度開啟。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setActiveErpMiniApp('CUSTOMER_STATEMENT')}
            disabled={!canUseStatement}
            className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer disabled:opacity-40 ${
              activeErpMiniApp === 'CUSTOMER_STATEMENT'
                ? 'bg-emerald-50/70 border-emerald-500 shadow-2xs'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="text-xs font-black text-slate-900">1. 對外客戶請款／對帳明細表</div>
            <div className="text-[11px] text-slate-500 mt-1">
              乾淨列印給業主，完全隔離私帳與 401；支援送交會計立帳（CustomerStatementMiniApp）。
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveErpMiniApp('CHECK_RADAR')}
            disabled={!canUseCheckRadar}
            className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer disabled:opacity-40 ${
              activeErpMiniApp === 'CHECK_RADAR'
                ? 'bg-indigo-50/70 border-indigo-500 shadow-2xs'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="text-xs font-black text-slate-900">2. 支票統計管理與資金雷達</div>
            <div className="text-[11px] text-slate-500 mt-1">
              兌現日區間、每日待付資金加總、三燈號兌現與退票回滾（CheckRadarMiniApp）。
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveErpMiniApp('TAX_401')}
            disabled={!canUse401}
            className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer disabled:opacity-40 ${
              activeErpMiniApp === 'TAX_401'
                ? 'bg-purple-50/70 border-purple-500 shadow-2xs'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="text-xs font-black text-slate-900">3. 401 營業稅雙月試算活頁簿</div>
            <div className="text-[11px] text-slate-500 mt-1">
              進銷項發票、留抵稅額滾存、預計請款模擬區與年度統整（Tax401WorkbookPanel）。
            </div>
          </button>
        </div>
      </div>

      {activeErpMiniApp === 'CUSTOMER_STATEMENT' && canUseStatement && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <CustomerStatementMiniApp
            projects={projects}
            arList={arList}
            arCollections={arCollections}
            projectAdvances={projectAdvances}
            taxRate={taxRate}
            workflowMode={workflowMode}
            canSubmitToAccounting={can('PROJECTS', 'write') || can('FINANCE_AR', 'write') || isSuperadmin || isBoss}
            operatorName={currentUser?.fullName || '系統操作員'}
            onNotify={msg => onNotify && onNotify(msg)}
            onAfterSubmit={onRefresh}
          />
        </div>
      )}

      {activeErpMiniApp === 'CHECK_RADAR' && canUseCheckRadar && (
        <CheckRadarMiniApp
          checks={checks}
          reconciliations={reconciliations}
          arList={arList}
          canEditCashier={isSuperadmin || isBoss || isAdmin || can('BANK_CHECKS', 'write')}
          operatorName={currentUser?.fullName || '出納專員'}
          onNotify={msg => onNotify && onNotify(msg)}
          onRefresh={onRefresh}
        />
      )}

      {activeErpMiniApp === 'TAX_401' && canUse401 && companies.length > 0 && (
        <Tax401WorkbookPanel
          companies={companies}
          partners={partners}
          projects={projects}
          invoices={invoices}
          plannedInvoices={plannedInvoices}
          companyTaxSettings={companyTaxSettings}
          selectedCompanyId={companies.some(c => c.id === selected401CompanyId) ? selected401CompanyId : companies[0].id}
          onSelectCompanyId={setSelected401CompanyId}
          canEdit={isSuperadmin || isBoss || isAdmin || can('FINANCE_AR', 'write')}
          taxRate={taxRate}
          operatorName={currentUser?.fullName || '會計專員'}
          onNotify={msg => onNotify && onNotify(msg)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
};
