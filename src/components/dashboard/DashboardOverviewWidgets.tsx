import React from 'react';
import { Calendar, Receipt, Search, TrendingUp, Users } from 'lucide-react';
import { LeftNavId } from '../LeftSubWindow';
import { BusinessLifecycleMapCard } from './BusinessLifecycleMapCard';

interface DashboardOverviewWidgetsProps {
  projectsCount: number;
  onNavigateNav: (id: LeftNavId) => void;
}

export const DashboardOverviewWidgets: React.FC<DashboardOverviewWidgetsProps> = ({
  projectsCount,
  onNavigateNav
}) => {
  return (
    <div className="space-y-5">
      {/* 營造業務生命週期地圖 (雙保險之一：儀表板直接整合穿透) */}
      <BusinessLifecycleMapCard
        onNavigateNav={onNavigateNav}
        projectsCount={projectsCount}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-md shadow-xs border border-slate-200 overflow-hidden flex h-24">
          <div className="w-24 bg-[#E05252] text-white flex flex-col items-center justify-center p-2 shrink-0">
            <Calendar className="w-7 h-7 mb-1" />
            <span className="text-xs font-bold">行程</span>
          </div>
          <div className="flex-1 p-3 flex flex-col justify-center text-xs space-y-1.5 bg-white">
            <div className="flex justify-between items-center text-slate-600">
              <span>今日</span>
              <span className="font-mono font-bold text-slate-800 text-sm">0</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>本週</span>
              <span className="font-mono font-bold text-slate-800 text-sm">0</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md shadow-xs border border-slate-200 overflow-hidden flex h-24">
          <div className="w-24 bg-[#00A896] text-white flex flex-col items-center justify-center p-2 shrink-0">
            <Users className="w-7 h-7 mb-1" />
            <span className="text-xs font-bold">新客</span>
          </div>
          <div className="flex-1 p-3 flex flex-col justify-center text-xs space-y-1.5 bg-white">
            <div className="flex justify-between items-center text-slate-600">
              <span>本月</span>
              <span className="font-mono font-bold text-slate-800 text-sm">4</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>上月</span>
              <span className="font-mono font-bold text-slate-800 text-sm">5</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md shadow-xs border border-slate-200 overflow-hidden flex h-24">
          <div className="w-24 bg-[#F5A623] text-white flex flex-col items-center justify-center p-2 shrink-0">
            <TrendingUp className="w-7 h-7 mb-1" />
            <span className="text-xs font-bold">商機</span>
          </div>
          <div className="flex-1 p-3 flex flex-col justify-center text-xs space-y-1 bg-white">
            <div className="flex justify-between items-center text-slate-600">
              <span>新增</span>
              <span className="font-mono font-bold text-slate-800 text-xs">1</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>成交</span>
              <span className="font-mono font-bold text-slate-800 text-xs">0</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>停滯</span>
              <span className="font-mono font-bold text-slate-800 text-xs">23</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md shadow-xs border border-slate-200 overflow-hidden flex h-24">
          <div className="w-24 bg-[#607D8B] text-white flex flex-col items-center justify-center p-2 shrink-0">
            <Receipt className="w-7 h-7 mb-1" />
            <span className="text-xs font-bold">油資</span>
          </div>
          <div className="flex-1 p-3 flex flex-col justify-center text-xs space-y-1 bg-white">
            <div className="flex justify-between items-center text-slate-600">
              <span>未結算</span>
              <span className="font-mono font-bold text-slate-800 text-xs">1</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>未報銷</span>
              <span className="font-mono font-bold text-slate-800 text-xs">0</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>退件</span>
              <span className="font-mono font-bold text-slate-800 text-xs">0</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-md shadow-xs border border-slate-200 overflow-hidden">
          <div className="bg-[#607D8B] text-white px-4 py-2.5 text-xs font-bold tracking-wide">
            銷售達成率
          </div>
          <div className="p-8 flex flex-col sm:flex-row items-center justify-around gap-6 min-h-[260px]">
            <div className="relative w-40 h-40 rounded-full border-12 border-slate-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-slate-700 font-mono">0%</span>
            </div>

            <div className="space-y-3 text-xs text-slate-600 font-mono">
              <div className="flex items-center gap-6">
                <span className="text-slate-400">目標值</span>
                <span className="font-bold text-slate-800 text-sm">65,000</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-slate-400">實際值</span>
                <span className="font-bold text-slate-800 text-sm">0</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md shadow-xs border border-slate-200 overflow-hidden">
          <div className="bg-[#607D8B] text-white px-4 py-2.5 text-xs font-bold tracking-wide">
            商機漏斗
          </div>
          <div className="p-8 flex flex-col items-center justify-center min-h-[260px] text-slate-400 space-y-2">
            <div className="w-16 h-20 border-2 border-slate-300 rounded bg-slate-50 flex items-center justify-center relative shadow-2xs">
              <div className="space-y-1.5 w-10">
                <div className="h-1 bg-slate-200 rounded" />
                <div className="h-1 bg-slate-200 rounded" />
                <div className="h-1 bg-slate-200 rounded" />
              </div>
              <Search className="w-8 h-8 text-slate-400 absolute -bottom-2 -right-2 bg-white rounded-full p-1 border border-slate-300 shadow-xs" />
            </div>
            <span className="text-xs text-slate-400 font-normal pt-2">
              查無符合資料
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
