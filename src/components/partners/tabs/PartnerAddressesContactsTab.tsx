import React, { useState } from 'react';
import { Plus, Trash2, Archive, History, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { BusinessPartner, PartnerAddress } from '../../../types/erp';
import { TaiwanAddressPicker } from '../../widgets/TaiwanAddressPicker';

interface PartnerAddressesContactsTabProps {
  editingPartner: BusinessPartner;
  setEditingPartner: React.Dispatch<React.SetStateAction<BusinessPartner>>;
  isClientOnly: boolean;
}

function formatPartnerArchiveTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export const PartnerAddressesTab: React.FC<PartnerAddressesContactsTabProps> = ({
  editingPartner,
  setEditingPartner,
  isClientOnly
}) => {
  const [showHistorical, setShowHistorical] = useState<boolean>(true);

  const allAddresses = editingPartner.addresses || [];
  const indexedAddresses = allAddresses.map((addr, origIdx) => ({ addr, origIdx }));
  const activeItems = indexedAddresses.filter(item => !item.addr.isHistorical);
  const historicalItems = indexedAddresses.filter(item => Boolean(item.addr.isHistorical));

  const syncPrimaryAddressField = (list: PartnerAddress[]) => {
    const firstActive = list.find(a => !a.isHistorical);
    return firstActive ? (firstActive.fullAddress || '') : '';
  };

  const handleArchiveAndCreateNew = (origIdx: number) => {
    const list = [...allAddresses];
    const target = list[origIdx];
    if (!target) return;

    const archivedCard: PartnerAddress = {
      ...target,
      isHistorical: true,
      archivedAt: new Date().toISOString()
    };
    const freshCard: PartnerAddress = {
      id: `PADDR-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      partnerId: editingPartner.id,
      addressType: target.addressType || 'COMMUNICATION',
      label: target.label || (isClientOnly ? '通訊地址' : '主要營業地址'),
      postalCode: '',
      city: '',
      district: '',
      streetAddress: '',
      fullAddress: '',
      isHistorical: false,
      isDeleted: false
    };

    // 將封存舊址留存於清單中，並在最前方放入空白新址供填寫
    list[origIdx] = archivedCard;
    list.unshift(freshCard);
    setShowHistorical(true);
    setEditingPartner({
      ...editingPartner,
      addresses: list,
      address: syncPrimaryAddressField(list)
    });
  };

  const handleCopyStreetToFirstActive = (streetText?: string) => {
    if (!streetText) return;
    const list = [...allAddresses];
    const firstActiveIdx = list.findIndex(a => !a.isHistorical);
    if (firstActiveIdx < 0) return;
    const cur = list[firstActiveIdx];
    const full = `${cur.city || ''}${cur.district || ''}${streetText}`.trim();
    const fullWithZip = full ? (cur.postalCode ? `${cur.postalCode} ${full}`.trim() : full) : streetText;
    list[firstActiveIdx] = {
      ...cur,
      streetAddress: streetText,
      fullAddress: fullWithZip
    };
    setEditingPartner({
      ...editingPartner,
      addresses: list,
      address: syncPrimaryAddressField(list)
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-900">
            {isClientOnly ? '通訊與案場現勘地址' : '多地址管理 (中華郵政標準郵遞區號選單小程式)'}
          </h4>
          <p className="text-[11px] text-slate-500">
            排列順序：郵遞區號 ➔ 縣市 ➔ 鄉鎮 ➔ 住址。需要更正或搬遷時，可點選「封存舊址並改填新址」將舊地址轉為靜態歷史參考。
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const list = [...allAddresses];
            list.unshift({
              id: `PADDR-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
              partnerId: editingPartner.id,
              addressType: 'COMMUNICATION',
              label: isClientOnly ? '案場現勘地址' : '通訊地址',
              postalCode: '',
              city: '',
              district: '',
              streetAddress: '',
              fullAddress: '',
              isHistorical: false,
              isDeleted: false
            });
            setEditingPartner({ ...editingPartner, addresses: list });
          }}
          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新增地址</span>
        </button>
      </div>

      {/* 現行使用中地址 */}
      <div className="space-y-3">
        {activeItems.map(({ addr, origIdx }, activeOrder) => {
          const hasContent = Boolean(
            addr.postalCode?.trim() ||
              addr.city?.trim() ||
              addr.district?.trim() ||
              addr.streetAddress?.trim() ||
              addr.fullAddress?.trim()
          );
          return (
            <div key={addr.id || origIdx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                    {activeOrder === 0 ? '主要現行地址' : `現行地址 #${activeOrder + 1}`}
                  </span>
                  <span className="text-xs font-bold text-slate-700">地址類別：</span>
                  <input
                    type="text"
                    value={addr.label || (isClientOnly ? '通訊地址' : '主要營業地址')}
                    onChange={e => {
                      const list = [...allAddresses];
                      list[origIdx] = { ...list[origIdx], label: e.target.value };
                      setEditingPartner({ ...editingPartner, addresses: list });
                    }}
                    className="text-xs p-1.5 bg-white border border-slate-300 rounded font-bold w-36"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!hasContent}
                    onClick={() => handleArchiveAndCreateNew(origIdx)}
                    title="將此地址轉為下方唯讀歷史舊址參考，並立即產生一筆空白新址填寫"
                    className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed text-amber-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>封存舊址並改填新址</span>
                  </button>

                  {activeItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const list = allAddresses.filter((_, i) => i !== origIdx);
                        setEditingPartner({
                          ...editingPartner,
                          addresses: list,
                          address: syncPrimaryAddressField(list)
                        });
                      }}
                      className="text-slate-400 hover:text-red-600 text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>刪除地址</span>
                    </button>
                  )}
                </div>
              </div>

              <TaiwanAddressPicker
                value={{
                  postalCode: addr.postalCode,
                  city: addr.city,
                  district: addr.district,
                  streetAddress: addr.streetAddress,
                  fullAddress: addr.fullAddress
                }}
                onChange={val => {
                  const list = [...allAddresses];
                  list[origIdx] = {
                    ...list[origIdx],
                    postalCode: val.postalCode || '',
                    city: val.city || '',
                    district: val.district || '',
                    streetAddress: val.streetAddress || '',
                    fullAddress: val.fullAddress || ''
                  };
                  setEditingPartner({
                    ...editingPartner,
                    addresses: list,
                    address: syncPrimaryAddressField(list)
                  });
                }}
              />
            </div>
          );
        })}
      </div>

      {/* 歷史留存舊址（唯讀靜態參考清單） */}
      {historicalItems.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-100/80 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowHistorical(prev => !prev)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" />
              <span>歷史留存舊址參考（唯讀靜態資料，共 {historicalItems.length} 筆）</span>
            </span>
            {showHistorical ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showHistorical && (
            <div className="px-4 pb-3 pt-1 space-y-2 border-t border-slate-200">
              {historicalItems.map(({ addr, origIdx }) => (
                <div
                  key={addr.id || origIdx}
                  className="p-3 rounded-lg bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                        歷史舊址
                      </span>
                      {addr.label && (
                        <span className="text-[11px] font-bold text-slate-600">
                          [{addr.label}]
                        </span>
                      )}
                      <span className="font-mono font-bold text-slate-800 break-all">
                        {addr.postalCode ? `[${addr.postalCode}] ` : ''}
                        {addr.city || ''}
                        {addr.district || ''}
                        {addr.streetAddress || (!addr.city && !addr.district ? addr.fullAddress : '')}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      封存時間：{formatPartnerArchiveTime(addr.archivedAt) || '歷史紀錄'}
                      {addr.archiveNote ? ` · ${addr.archiveNote}` : ''}
                    </div>
                  </div>

                  {addr.streetAddress && activeItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCopyStreetToFirstActive(addr.streetAddress)}
                      className="px-2.5 py-1 rounded-md border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                      <span>帶入原路街段至目前主址</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const PartnerContactsTab: React.FC<PartnerAddressesContactsTabProps> = ({
  editingPartner,
  setEditingPartner,
  isClientOnly
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-900">
            {isClientOnly ? '業主窗口名冊' : '商業夥伴多元聯絡人'}
          </h4>
          <p className="text-[11px] text-slate-500">
            記錄主要負責人、工務窗口、業務代表與會計對帳窗口
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const list = editingPartner.contacts ? [...editingPartner.contacts] : [];
            list.push({
              id: `PCON-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
              partnerId: editingPartner.id,
              contactType: 'ENGINEERING',
              name: '',
              title: isClientOnly ? '現勘工地窗口' : '工務窗口',
              phone: '',
              mobile: '',
              extension: '',
              email: '',
              isDeleted: false
            });
            setEditingPartner({ ...editingPartner, contacts: list });
          }}
          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新增聯絡人</span>
        </button>
      </div>

      <div className="space-y-3">
        {(editingPartner.contacts || []).map((con, idx) => (
          <div key={con.id || idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 text-xs">
                {idx === 0 ? '主要業務窗口' : `聯絡人 #${idx + 1}`}
              </span>
              {(editingPartner.contacts || []).length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const list = editingPartner.contacts!.filter((_, i) => i !== idx);
                    setEditingPartner({ ...editingPartner, contacts: list });
                  }}
                  className="text-slate-400 hover:text-red-600 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>刪除</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">姓名</label>
                <input
                  type="text"
                  value={con.name}
                  onChange={e => {
                    const list = [...(editingPartner.contacts || [])];
                    list[idx] = { ...list[idx], name: e.target.value };
                    setEditingPartner({
                      ...editingPartner,
                      contacts: list,
                      contactPerson: idx === 0 ? e.target.value : editingPartner.contactPerson
                    });
                  }}
                  placeholder="聯絡人姓名"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">職稱</label>
                <input
                  type="text"
                  value={con.title || ''}
                  onChange={e => {
                    const list = [...(editingPartner.contacts || [])];
                    list[idx] = { ...list[idx], title: e.target.value };
                    setEditingPartner({ ...editingPartner, contacts: list });
                  }}
                  placeholder="例：專案經理"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">行動電話</label>
                <input
                  type="text"
                  value={con.mobile || ''}
                  onChange={e => {
                    const list = [...(editingPartner.contacts || [])];
                    list[idx] = { ...list[idx], mobile: e.target.value };
                    setEditingPartner({
                      ...editingPartner,
                      contacts: list,
                      phone: idx === 0 && !editingPartner.phone ? e.target.value : editingPartner.phone
                    });
                  }}
                  placeholder="09xx-xxx-xxx"
                  className="w-full text-xs p-2 font-mono bg-white border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">電話/分機</label>
                <input
                  type="text"
                  value={con.phone || ''}
                  onChange={e => {
                    const list = [...(editingPartner.contacts || [])];
                    list[idx] = { ...list[idx], phone: e.target.value };
                    setEditingPartner({ ...editingPartner, contacts: list });
                  }}
                  placeholder="02-xxxx-xxxx"
                  className="w-full text-xs p-2 font-mono bg-white border border-slate-300 rounded"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
