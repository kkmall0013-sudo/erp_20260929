import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Users2,
  FileSpreadsheet,
  Truck,
  HardHat,
  Receipt,
  LineChart,
  ArrowRight,
  GitFork
} from 'lucide-react';
import { LeftNavId } from '../LeftSubWindow';
import { getAppConfigMap, subscribeToDatabase } from '../../db/sqlite';

interface BusinessLifecycleMapCardProps {
  onNavigateNav: (id: LeftNavId) => void;
  projectsCount: number;
}

export const BusinessLifecycleMapCard: React.FC<BusinessLifecycleMapCardProps> = ({
  onNavigateNav,
  projectsCount,
}) => {
  // 動態連動 Superadmin 於「系統中樞 ➔ 軟體程式設定 (app_configs)」之系統品牌與副標題設定
  const [appConfigs, setAppConfigs] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadConfigs = () => {
      try {
        setAppConfigs(getAppConfigMap());
      } catch (_) {}
    };
    loadConfigs();
    const unsubscribe = subscribeToDatabase(loadConfigs);
    return () => unsubscribe();
  }, []);

  const brandName = appConfigs.APP_BRAND_NAME || '田頭';
  const subTitle = appConfigs.APP_SUB_TITLE || '';
  // 業務常用順序主幹道 7 大節點
  const lifecycleSteps: {
    id: LeftNavId;
    stepNum: number;
    title: string;
    sub: string;
    icon: React.ComponentType<{ className?: string }>;
    metric: string;
    badgeColor: string;
    iconBg: string;
  }[] = [
    {
      id: 'PROJECTS',
      stepNum: 1,
      title: '案場工程',
      sub: '合約主檔與工區',
      icon: FolderGit2,
      metric: `${projectsCount} 個案場`,
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      iconBg: 'bg-indigo-600 text-white'
    },
    {
      id: 'PARTNERS',
      stepNum: 2,
      title: '廠商工班',
      sub: '業主與下游廠商',
      icon: Users2,
      metric: '4 家名冊',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      iconBg: 'bg-blue-600 text-white'
    },
    {
      id: 'QUOTATIONS',
      stepNum: 3,
      title: '報價預算',
      sub: '估價單與版次',
      icon: FileSpreadsheet,
      metric: '1 份報價',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconBg: 'bg-emerald-600 text-white'
    },
    {
      id: 'INBOUND',
      stepNum: 4,
      title: '進貨管理',
      sub: '直入案場成本',
      icon: Truck,
      metric: '4 筆驗收入庫',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      iconBg: 'bg-amber-600 text-white'
    },
    {
      id: 'VALUATIONS',
      stepNum: 5,
      title: '估驗請款',
      sub: '累計估驗扣保留',
      icon: HardHat,
      metric: '2 期估驗',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      iconBg: 'bg-purple-600 text-white'
    },
    {
      id: 'FINANCE',
      stepNum: 6,
      title: '財務收支',
      sub: '應付應收與票據',
      icon: Receipt,
      metric: '4 張支票',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      iconBg: 'bg-rose-600 text-white'
    },
    {
      id: 'COMMAND_CENTER',
      stepNum: 7,
      title: '戰情指揮',
      sub: '即時決策大水池',
      icon: LineChart,
      metric: '$3,850 萬',
      badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      iconBg: 'bg-cyan-600 text-white'
    }
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* 標題與說明列 */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                {brandName} {subTitle ? `· ${subTitle} ` : ''}營造業務生命週期地圖
              </h3>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                常用業務主幹道
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              案場開工 ➔ 工班進場 ➔ 預算報價 ➔ 進貨驗收直入成本 ➔ 估驗計價 ➔ 票據財務 ➔ 營運戰情
            </p>
          </div>
        </div>
      </div>

      {/* 7 大節點橫向卡片導航列 */}
      <div className="p-4 bg-slate-50/70 overflow-x-auto">
        <div className="flex items-center min-w-[760px] justify-between gap-1">
          {lifecycleSteps.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === lifecycleSteps.length - 1;

            return (
              <React.Fragment key={step.id}>
                {/* 節點卡片 */}
                <button
                  onClick={() => onNavigateNav(step.id)}
                  title={`點擊穿透跳轉至【${step.title}】`}
                  className="flex-1 bg-white hover:bg-indigo-50/50 p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:shadow-xs transition-all text-left group cursor-pointer relative"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${step.iconBg} shadow-2xs`}>
                        <Icon className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        #{step.stepNum}
                      </span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold border ${step.badgeColor}`}>
                      {step.metric}
                    </span>
                  </div>

                  <div className="font-bold text-xs text-slate-800 group-hover:text-indigo-700 transition-colors">
                    {step.title}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {step.sub}
                  </div>
                </button>

                {/* 連接箭頭 */}
                {!isLast && (
                  <div className="px-1 text-slate-300 shrink-0">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
