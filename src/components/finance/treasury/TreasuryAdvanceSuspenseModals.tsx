// src/components/finance/treasury/TreasuryAdvanceSuspenseModals.tsx
// 💰 出納登錄未知款項暫收池彈窗 & 案場預收／貸款直入彈窗

import React, { useEffect, useState } from 'react';
import { AlertCircle, Wallet, X } from 'lucide-react';
import {
  Company,
  CompanyBankAccount,
  Project,
} from '../../../types/erp';
import {
  createProjectAdvance,
  createSuspenseReceipt,
} from '../../../db/sqlite';
import { formatLocalYmd, isBossPrivateAccount } from '../financeUtils';

interface CreateSuspenseModalProps {
  isOpen: boolean;
  bankAccounts: CompanyBankAccount[];
  companies: Company[];
  authorizedCorps: Company[];
  financeCompanyScope: string;
  operatorName: string;
  matchesCompanyScope: (compId?: string) => boolean;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onCreated: () => void;
}

export const CreateSuspenseModal: React.FC<CreateSuspenseModalProps> = ({
  isOpen,
  bankAccounts,
  companies,
  authorizedCorps,
  financeCompanyScope,
  operatorName,
  matchesCompanyScope,
  onClose,
  onNotify,
  onCreated,
}) => {
  const [suspBankAccountId, setSuspBankAccountId] = useState<string>('');
  const [suspAmount, setSuspAmount] = useState<string>('');
  const [suspReceivedDate, setSuspReceivedDate] = useState<string>(formatLocalYmd(new Date()));
  const [suspPayerInfo, setSuspPayerInfo] = useState<string>('');
  const [suspNotes, setSuspNotes] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    const scopeBankList = bankAccounts.filter(
      b => b.status === 'ACTIVE' && (isBossPrivateAccount(b) || matchesCompanyScope(b.companyId))
    );
    setSuspBankAccountId(scopeBankList[0]?.id || 'CASH');
    setSuspAmount('');
    setSuspReceivedDate(formatLocalYmd(new Date()));
    setSuspPayerInfo('');
    setSuspNotes('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const amt = Number(suspAmount || 0);
    if (amt <= 0) {
      onNotify('請輸入大於 0 的入帳金額', 'warn');
      return;
    }
    if (!suspPayerInfo.trim()) {
      onNotify('請填寫銀行存摺顯示的匯入戶名／附言摘要', 'warn');
      return;
    }
    const selBank = bankAccounts.find(b => b.id === suspBankAccountId);
    const derivedCompanyId =
      selBank?.companyId ||
      (financeCompanyScope !== 'ALL' ? financeCompanyScope : authorizedCorps[0]?.id || 'COMP-01');
    try {
      createSuspenseReceipt(
        {
          companyId: derivedCompanyId,
          bankAccountId: suspBankAccountId || 'CASH',
          amount: amt,
          receivedDate: suspReceivedDate,
          payerInfo: suspPayerInfo.trim(),
          notes: suspNotes.trim() || undefined,
        },
        operatorName || 'B出納'
      );
      onNotify(`✅ 已登錄未知暫收款 NT$ ${amt.toLocaleString()}（銀行餘額已即時同步，待會計確認認領）！`, 'success');
      onClose();
      onCreated();
    } catch (e: any) {
      onNotify(`登錄暫收款失敗：${e.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>出納登錄銀行未知匯入暫收款</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
          存摺已確認收到現金／匯款，但會計尚未開單或無法辨認業主案場時使用。<b>登錄後會立即增加對應帳戶餘額，但暫不認列營業稅與收入</b>，待會計查明認領。
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            入帳收款帳戶 <span className="text-rose-500">*</span>
          </label>
          <select
            value={suspBankAccountId}
            onChange={(e) => setSuspBankAccountId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
          >
            {bankAccounts
              .filter(b => b.status === 'ACTIVE' && (isBossPrivateAccount(b) || matchesCompanyScope(b.companyId)))
              .map(b => {
                const bComp = companies.find(c => c.id === b.companyId);
                return (
                  <option key={b.id} value={b.id}>
                    {isBossPrivateAccount(b) ? '👤 [老闆私帳] ' : `🏦 [${bComp?.shortName || b.companyId}] `}
                    {b.bankName} {b.branchName || ''} · {b.accountNumber}
                  </option>
                );
              })}
            <option value="CASH">💵 公司現金櫃台</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              入帳金額 <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              value={suspAmount}
              onChange={(e) => setSuspAmount(e.target.value)}
              placeholder="例: 350000"
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">存摺入帳日</label>
            <input
              type="date"
              value={suspReceivedDate}
              onChange={(e) => setSuspReceivedDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            存摺匯入來源戶名／網銀附言摘要 <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={suspPayerInfo}
            onChange={(e) => setSuspPayerInfo(e.target.value)}
            placeholder="例：國泰世華轉入 陳先生 / 後五碼 12345 (未註明案場)"
            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">備註 (選填)</label>
          <input
            type="text"
            value={suspNotes}
            onChange={(e) => setSuspNotes(e.target.value)}
            placeholder="已通知工務主任查對..."
            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 text-xs cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer"
          >
            確認入暫收池
          </button>
        </div>
      </div>
    </div>
  );
};

interface QuickProjectAdvanceModalProps {
  isOpen: boolean;
  projects: Project[];
  bankAccounts: CompanyBankAccount[];
  authorizedCorps: Company[];
  operatorName: string;
  matchesCompanyScope: (compId?: string) => boolean;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'warn' | 'error') => void;
  onCreated: () => void;
}

export const QuickProjectAdvanceModal: React.FC<QuickProjectAdvanceModalProps> = ({
  isOpen,
  projects,
  bankAccounts,
  authorizedCorps,
  operatorName,
  matchesCompanyScope,
  onClose,
  onNotify,
  onCreated,
}) => {
  const [quickAdvProjId, setQuickAdvProjId] = useState<string>('');
  const [quickAdvSourceType, setQuickAdvSourceType] = useState<'EARLY_LOAN' | 'DEPOSIT' | 'OVERPAYMENT'>('EARLY_LOAN');
  const [quickAdvMethod, setQuickAdvMethod] = useState<'TT' | 'CHECK' | 'CASH'>('TT');
  const [quickAdvBankId, setQuickAdvBankId] = useState<string>('');
  const [quickAdvAmount, setQuickAdvAmount] = useState<string>('');
  const [quickAdvDate, setQuickAdvDate] = useState<string>(formatLocalYmd(new Date()));
  const [quickAdvCheckNo, setQuickAdvCheckNo] = useState<string>('');
  const [quickAdvCheckDue, setQuickAdvCheckDue] = useState<string>(formatLocalYmd(new Date()));
  const [quickAdvNotes, setQuickAdvNotes] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    const selectableProjs = projects.filter(p => !p.isDeleted && p.id !== 'PRJ-INTERNAL');
    const firstProj = selectableProjs.find(p => matchesCompanyScope(p.companyId)) || selectableProjs[0];
    const scopeBankList = bankAccounts.filter(
      b => b.status === 'ACTIVE' && (isBossPrivateAccount(b) || matchesCompanyScope(b.companyId))
    );
    setQuickAdvProjId(firstProj?.id || '');
    setQuickAdvSourceType('EARLY_LOAN');
    setQuickAdvMethod('TT');
    setQuickAdvBankId(scopeBankList[0]?.id || 'CASH');
    setQuickAdvAmount('');
    setQuickAdvDate(formatLocalYmd(new Date()));
    setQuickAdvCheckNo('');
    setQuickAdvCheckDue(formatLocalYmd(new Date()));
    setQuickAdvNotes('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const proj = projects.find(p => p.id === quickAdvProjId);
    if (!proj) {
      onNotify('請選擇預收款歸屬的工程案場', 'warn');
      return;
    }
    const amt = Number(quickAdvAmount || 0);
    if (amt <= 0) {
      onNotify('請輸入大於 0 的預收金額', 'warn');
      return;
    }
    try {
      createProjectAdvance(
        {
          projectId: proj.id,
          projectName: proj.name,
          customerName: proj.ownerName || '案場業主',
          companyId:
            (proj.companyId && proj.companyId !== 'UNASSIGNED'
              ? proj.companyId
              : authorizedCorps[0]?.id) || 'COMP-01',
          bankAccountId: quickAdvMethod === 'CASH' ? 'CASH' : quickAdvBankId,
          collectionMethod: quickAdvMethod,
          amount: amt,
          receivedDate: quickAdvDate,
          sourceType: quickAdvSourceType,
          checkNumber: quickAdvMethod === 'CHECK' ? quickAdvCheckNo : undefined,
          checkDueDate: quickAdvMethod === 'CHECK' ? quickAdvCheckDue : undefined,
          notes: quickAdvNotes.trim() || undefined,
        },
        operatorName || 'B出納'
      );
      onNotify(`✅ 已將預收／貸款撥款 NT$ ${amt.toLocaleString()} 直接掛入「${proj.name}」案場總帳！`, 'success');
      onClose();
      onCreated();
    } catch (e: any) {
      onNotify(`登錄案場預收失敗：${e.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-3.5 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-teal-900 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-teal-600" />
            <span>出納登錄案場預收款／銀行貸款撥款（直入案場總帳）</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-2.5 rounded-lg bg-teal-50 border border-teal-200 text-[11px] text-teal-900">
          已知工程案場之預付訂金或業主貸款先撥入一整筆（尚未開請款單時），直接掛入該案場貸方與銀行存摺，不經由未知大水池。
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">歸屬工程專案案場 *</label>
          <select
            value={quickAdvProjId}
            onChange={(e) => setQuickAdvProjId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
          >
            {projects.filter(p => !p.isDeleted && p.id !== 'PRJ-INTERNAL').map(p => (
              <option key={p.id} value={p.id}>
                [{p.projectCode}] {p.name}（業主：{p.ownerName || '-'}）
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">款項性質</label>
            <select
              value={quickAdvSourceType}
              onChange={(e) => setQuickAdvSourceType(e.target.value as any)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
            >
              <option value="EARLY_LOAN">銀行貸款先整筆撥入</option>
              <option value="DEPOSIT">預付工程訂金</option>
              <option value="OVERPAYMENT">其他預收工程款</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">收款方式</label>
            <select
              value={quickAdvMethod}
              onChange={(e) => setQuickAdvMethod(e.target.value as any)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
            >
              <option value="TT">銀行匯款/轉帳</option>
              <option value="CHECK">收到業主支票</option>
              <option value="CASH">現金收訖</option>
            </select>
          </div>
        </div>
        {quickAdvMethod !== 'CASH' && (
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">入帳銀行帳戶 *</label>
            <select
              value={quickAdvBankId}
              onChange={(e) => setQuickAdvBankId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold outline-none"
            >
              {bankAccounts
                .filter(b => b.status === 'ACTIVE' && (isBossPrivateAccount(b) || matchesCompanyScope(b.companyId)))
                .map(b => (
                  <option key={b.id} value={b.id}>
                    {isBossPrivateAccount(b) ? '👤 [老闆私帳] ' : '🏦 '}
                    {b.bankName} · {b.accountNumber}
                  </option>
                ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">實收預收金額 *</label>
            <input
              type="number"
              min="0"
              value={quickAdvAmount}
              onChange={(e) => setQuickAdvAmount(e.target.value)}
              placeholder="例: 500000"
              className="w-full bg-white border border-teal-300 rounded-lg p-2 font-mono font-bold outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">入帳日期</label>
            <input
              type="date"
              value={quickAdvDate}
              onChange={(e) => setQuickAdvDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none"
            />
          </div>
        </div>
        {quickAdvMethod === 'CHECK' && (
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={quickAdvCheckNo}
              onChange={(e) => setQuickAdvCheckNo(e.target.value.toUpperCase())}
              placeholder="支票號碼 *"
              className="bg-white border border-amber-300 rounded-lg p-2 font-mono font-bold"
            />
            <input
              type="date"
              value={quickAdvCheckDue}
              onChange={(e) => setQuickAdvCheckDue(e.target.value)}
              className="bg-white border border-amber-300 rounded-lg p-2 font-mono font-bold"
            />
          </div>
        )}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">備註</label>
          <input
            type="text"
            value={quickAdvNotes}
            onChange={(e) => setQuickAdvNotes(e.target.value)}
            placeholder="例：銀行二期貸款撥款"
            className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer"
          >
            確認入案場預收帳
          </button>
        </div>
      </div>
    </div>
  );
};
