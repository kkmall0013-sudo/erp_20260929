import React, { useState } from 'react';
import { ArrowRightLeft, Search, X } from 'lucide-react';
import { BusinessPartner } from '../../types/erp';

interface PartnerVendorToClientModalProps {
  isOpen: boolean;
  partners: BusinessPartner[];
  onClose: () => void;
  onExecuteConvert: (vendor: BusinessPartner) => void;
}

export const PartnerVendorToClientModal: React.FC<PartnerVendorToClientModalProps> = ({
  isOpen,
  partners,
  onClose,
  onExecuteConvert
}) => {
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');

  if (!isOpen) return null;

  const candidates = partners
    .filter(p => p.isVendor && !p.isCustomer)
    .filter(p =>
      vendorSearchTerm.trim()
        ? p.name.includes(vendorSearchTerm) || p.taxId.includes(vendorSearchTerm)
        : true
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-amber-200 p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                一鍵自合作廠商加入變業主 (SSoT 單一真實來源)
              </h3>
              <p className="text-xs text-slate-500">
                從既有合作廠商中選取，賦予其業主客戶身分，無需重複鍵檔
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={vendorSearchTerm}
            onChange={e => setVendorSearchTerm(e.target.value)}
            placeholder="搜尋合作廠商名稱、統一編號..."
            className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
          {candidates.length > 0 ? (
            candidates.map(v => (
              <div key={v.id} className="pt-2 flex items-center justify-between hover:bg-slate-50 p-2 rounded-lg">
                <div>
                  <div className="font-bold text-xs text-slate-800">{v.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">統編：{v.taxId}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onExecuteConvert(v)}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  加入業主名冊
                </button>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">
              查無尚未成為業主之合作廠商
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
