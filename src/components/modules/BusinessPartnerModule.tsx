import React, { useState } from 'react';
import { BusinessPartner } from '../../types/erp';
import { Users2, Plus, ShieldAlert, AlertTriangle, Building, Phone, Mail, Landmark, CheckCircle } from 'lucide-react';
import { getDatabase, saveDatabaseSnapshot, logAudit } from '../../db/sqlite';

interface BusinessPartnerModuleProps {
  partners: BusinessPartner[];
  onDataChanged: () => void;
}

export const BusinessPartnerModule: React.FC<BusinessPartnerModuleProps> = ({ partners, onDataChanged }) => {
  const [filterType, setFilterType] = useState<'ALL' | 'CUSTOMER' | 'VENDOR' | 'SUBCONTRACTOR'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPartner, setNewPartner] = useState({
    bpCode: `BP-00${partners.length + 1}`,
    name: '',
    taxId: '',
    type: 'SUBCONTRACTOR' as BusinessPartner['type'],
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    bankName: '第一銀行',
    bankCode: '007',
    bankAccount: '',
    paymentTermsDays: 30,
    isHighRisk: false,
    riskReason: '',
  });

  const filtered = partners.filter(p => filterType === 'ALL' || p.type === filterType || p.type === 'BOTH');

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartner.name || !newPartner.taxId) return;

    const db = await getDatabase();
    const id = `BP-${Date.now().toString().slice(-4)}`;
    db.run(`
      INSERT INTO business_partners (id, bpCode, name, taxId, type, contactPerson, phone, email, address, bankName, bankCode, bankAccount, paymentTermsDays, isHighRisk, riskReason, companyId, isDeleted, version)
      VALUES ('${id}', '${newPartner.bpCode}', '${newPartner.name.replace(/'/g, "''")}', '${newPartner.taxId}', '${newPartner.type}', '${newPartner.contactPerson}', '${newPartner.phone}', '${newPartner.email}', '${newPartner.address}', '${newPartner.bankName}', '${newPartner.bankCode}', '${newPartner.bankAccount}', ${newPartner.paymentTermsDays}, ${newPartner.isHighRisk ? 1 : 0}, ${newPartner.riskReason ? `'${newPartner.riskReason.replace(/'/g, "''")}'` : 'NULL'}, 'COMP-01', 0, 1);
    `);

    logAudit(db, '黃副總經理', 'CREATE', 'business_partners', id, undefined, { bpCode: newPartner.bpCode, name: newPartner.name });
    saveDatabaseSnapshot();
    onDataChanged();
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      {/* 標題與簡介 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
            <Users2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              商業夥伴與防弊內控模組 (Phase 3 & 憲法第三篇)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              客戶 (CRM)、料商與下包 (SRM) 統一主檔 · 違規黑名單高光警告
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>建檔商業夥伴</span>
        </button>
      </div>

      {/* 篩選標籤 */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium">夥伴類型篩選：</span>
        {(['ALL', 'CUSTOMER', 'VENDOR', 'SUBCONTRACTOR'] as const).map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              filterType === type
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {type === 'ALL' && '全部夥伴'}
            {type === 'CUSTOMER' && '業主 / 客戶'}
            {type === 'VENDOR' && '材料設備廠商'}
            {type === 'SUBCONTRACTOR' && '下包專業工程行'}
          </button>
        ))}
      </div>

      {/* 夥伴卡片列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(partner => (
          <div
            key={partner.id}
            className={`p-4 rounded-xl border transition-all ${
              partner.isHighRisk
                ? 'bg-rose-50/40 border-rose-300 ring-1 ring-rose-300/30'
                : 'bg-white border-slate-200 hover:shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-xs font-bold text-slate-500">
                  {partner.bpCode}
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-1">
                  {partner.name}
                </h4>
              </div>

              <div className="shrink-0">
                {partner.isHighRisk ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    高風險警告
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                    {partner.type === 'CUSTOMER' ? '業主' : partner.type === 'VENDOR' ? '供料商' : '專業下包'}
                  </span>
                )}
              </div>
            </div>

            {/* 違規高光警告橫幅 (憲法 RULE-3.8) */}
            {partner.isHighRisk && (
              <div className="mt-2.5 p-2 rounded bg-rose-100/80 border border-rose-200 text-[11px] text-rose-800 flex items-start gap-1.5 leading-snug">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                <span>
                  <strong>防弊警示：</strong>{partner.riskReason || '該廠商曾有違規爭議紀錄，發包前需特許核可'}
                </span>
              </div>
            )}

            {/* 統編與聯絡資料 */}
            <div className="mt-3 space-y-1 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">統一編號：</span>
                <span className="font-mono font-semibold text-slate-800">{partner.taxId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">聯絡窗口：</span>
                <span>{partner.contactPerson || '未載'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">電話：</span>
                <span className="font-mono">{partner.phone || '未載'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">付款天數：</span>
                <span className="font-mono">{partner.paymentTermsDays} 天期</span>
              </div>
            </div>

            {/* 銀行帳戶資料 */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
              <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {partner.bankName} ({partner.bankCode}) · {partner.bankAccount || '無銀行帳號'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 新增夥伴 Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">建檔商業夥伴</h3>
            <form onSubmit={handleCreatePartner} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">夥伴代號</label>
                  <input
                    type="text"
                    required
                    value={newPartner.bpCode}
                    onChange={e => setNewPartner({ ...newPartner, bpCode: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">夥伴類別</label>
                  <select
                    value={newPartner.type}
                    onChange={e => setNewPartner({ ...newPartner, type: e.target.value as BusinessPartner['type'] })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  >
                    <option value="SUBCONTRACTOR">專業下包工程行</option>
                    <option value="VENDOR">材料設備供應商</option>
                    <option value="CUSTOMER">業主 / 建設開發商</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">夥伴全名</label>
                  <input
                    type="text"
                    required
                    placeholder="如：台灣水泥股份有限公司"
                    value={newPartner.name}
                    onChange={e => setNewPartner({ ...newPartner, name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">統一編號 (8碼)</label>
                  <input
                    type="text"
                    required
                    placeholder="03754904"
                    value={newPartner.taxId}
                    onChange={e => setNewPartner({ ...newPartner, taxId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">聯絡人</label>
                  <input
                    type="text"
                    value={newPartner.contactPerson}
                    onChange={e => setNewPartner({ ...newPartner, contactPerson: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">電話</label>
                  <input
                    type="text"
                    value={newPartner.phone}
                    onChange={e => setNewPartner({ ...newPartner, phone: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">往來銀行</label>
                  <input
                    type="text"
                    value={newPartner.bankName}
                    onChange={e => setNewPartner({ ...newPartner, bankName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">銀行代號</label>
                  <input
                    type="text"
                    value={newPartner.bankCode}
                    onChange={e => setNewPartner({ ...newPartner, bankCode: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">銀行帳號</label>
                  <input
                    type="text"
                    value={newPartner.bankAccount}
                    onChange={e => setNewPartner({ ...newPartner, bankAccount: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              {/* 違規黑名單標記 (憲法 RULE-3.8) */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPartner.isHighRisk}
                    onChange={e => setNewPartner({ ...newPartner, isHighRisk: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="font-semibold text-rose-700">標記為高風險廠商 (違規黑名單)</span>
                </label>
                {newPartner.isHighRisk && (
                  <input
                    type="text"
                    placeholder="請輸入高風險原因 (如：曾有逾期工期爭議、工安違規)"
                    value={newPartner.riskReason}
                    onChange={e => setNewPartner({ ...newPartner, riskReason: e.target.value })}
                    className="w-full px-3 py-1.5 border border-rose-300 bg-rose-50/50 rounded-md text-rose-900"
                  />
                )}
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
                  儲存建立
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
