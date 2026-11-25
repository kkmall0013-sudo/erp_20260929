// src/components/projects/ProjectSiteSection.tsx
// 📍 工區現地、執照與工地主任表單區塊 (由 ProjectEditorModal 拆出)

import React from 'react';
import { MapPin } from 'lucide-react';
import { AddressHistoryEntry } from '../../types/erp';
import { TaiwanAddressPicker, TaiwanAddressValue } from '../widgets/TaiwanAddressPicker';

interface ProjectSiteSectionProps {
  permitNumber: string;
  onChangePermitNumber: (val: string) => void;
  landNumber: string;
  onChangeLandNumber: (val: string) => void;
  siteName: string;
  onChangeSiteName: (val: string) => void;
  siteAddress: TaiwanAddressValue;
  onChangeSiteAddress: (val: TaiwanAddressValue) => void;
  siteAddressHistory: AddressHistoryEntry[];
  onArchiveAndUpdateAddress: (archived: AddressHistoryEntry, newVal: TaiwanAddressValue) => void;
  contactPerson: string;
  onChangeContactPerson: (val: string) => void;
  contactPhone: string;
  onChangeContactPhone: (val: string) => void;
}

export const ProjectSiteSection: React.FC<ProjectSiteSectionProps> = ({
  permitNumber,
  onChangePermitNumber,
  landNumber,
  onChangeLandNumber,
  siteName,
  onChangeSiteName,
  siteAddress,
  onChangeSiteAddress,
  siteAddressHistory,
  onArchiveAndUpdateAddress,
  contactPerson,
  onChangeContactPerson,
  contactPhone,
  onChangeContactPhone,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5">
        <MapPin className="w-4 h-4 text-rose-500" />
        <span>三、工區現地、執照與工地主任</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            建造執照字號
          </label>
          <input
            type="text"
            value={permitNumber}
            onChange={(e) => onChangePermitNumber(e.target.value)}
            placeholder="例如：(114)北市建字第00234號"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            基地座落地號
          </label>
          <input
            type="text"
            value={landNumber}
            onChange={(e) => onChangeLandNumber(e.target.value)}
            placeholder="例如：南港段一小段 123-1 地號等 3 筆"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            工區別名 / 現地名稱
          </label>
          <input
            type="text"
            value={siteName}
            onChange={(e) => onChangeSiteName(e.target.value)}
            placeholder="工區別名（預設同工程全銜）"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl">
        <TaiwanAddressPicker
          compact
          label="施工現址 (工區工地地址)"
          value={siteAddress}
          addressHistory={siteAddressHistory}
          onArchiveAndUpdate={onArchiveAndUpdateAddress}
          onChange={onChangeSiteAddress}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            工地主任姓名
          </label>
          <input
            type="text"
            value={contactPerson}
            onChange={(e) => onChangeContactPerson(e.target.value)}
            placeholder="例如：林工務主任"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            工地現場聯絡電話
          </label>
          <input
            type="text"
            value={contactPhone}
            onChange={(e) => onChangeContactPhone(e.target.value)}
            placeholder="例如：0912-345-678 或 02-2788-9900"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>
    </div>
  );
};
