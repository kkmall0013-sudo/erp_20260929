import React, { useState } from 'react';
import { User, Company } from '../types/erp';
import { Building2, Lock, UserCheck, ShieldCheck, ArrowRight, KeyRound, AlertCircle, X } from 'lucide-react';
import { verifyLogin } from '../db/sqlite';

interface AuthScreenProps {
  users: User[];
  companies: Company[];
  onLoginSuccess: (user: User, companyId: string) => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  users,
  companies,
  onLoginSuccess,
  onClose,
  isModal = false,
}) => {
  const [usernameInput, setUsernameInput] = useState('admin');
  const [passwordInput, setPasswordInput] = useState('123456');
  const [selectedCompanyId, setSelectedCompanyId] = useState(companies[0]?.id || 'COMP-01');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const user = verifyLogin(usernameInput, passwordInput);
    if (!user) {
      setErrorMessage('帳號或密碼錯誤，請重新確認 (預設密碼為 123456)');
      return;
    }

    if (user.status === 'SUSPENDED') {
      setErrorMessage('此帳號已被管理員停權，禁止登入');
      return;
    }

    onLoginSuccess(user, selectedCompanyId);
  };

  const handleQuickLogin = (u: User) => {
    setUsernameInput(u.username);
    setPasswordInput('123456');
    setSelectedCompanyId(u.defaultCompanyId || companies[0]?.id || 'COMP-01');
    onLoginSuccess(u, u.defaultCompanyId || companies[0]?.id || 'COMP-01');
  };

  const containerClasses = isModal
    ? 'fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col justify-center items-center p-4 overflow-y-auto animate-in fade-in duration-150'
    : 'min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden';

  return (
    <div className={containerClasses}>
      {/* 幾何工程背景紋理 */}
      {!isModal && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.12)_0,transparent_100%)] pointer-events-none" />
      )}

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200/80 z-10 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
            title="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* 左側形象與快速體驗導引 */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-8 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold shadow-md shadow-indigo-500/20">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  客製化營造工程 ERP 系統
                </h1>
                <p className="text-xs text-indigo-300">
                  全流程資料庫 · 企業級權限防禦中心
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>
                本系統為台灣營造工程量身打造，涵蓋 <strong>專案案場、CPQ 報價、採購發包、現場估驗、財務金流與營運戰情大腦</strong> 12 大模組。
              </p>

              <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80 space-y-1.5">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  憲法級資安與 PBAC 存取控制
                </div>
                <div className="text-[11px] text-slate-400">
                  多法人帳號邊界隔離、過帳文字快照鎖死、單次核准金額上限防弊。
                </div>
              </div>
            </div>
          </div>

          {/* 快速一鍵切換身分體驗區 */}
          <div className="mt-8 pt-6 border-t border-slate-800 space-y-2">
            <div className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
              快速體驗身分登入 (點擊立即切換)：
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {users.slice(0, 6).map(u => (
                <button
                  key={u.id}
                  onClick={() => handleQuickLogin(u)}
                  className="p-2 rounded-lg bg-slate-800/90 hover:bg-indigo-600/50 border border-slate-700 hover:border-indigo-400 text-left transition-all group"
                >
                  <div className="font-semibold text-white group-hover:text-indigo-200 truncate">
                    {u.fullName}
                  </div>
                  <div className="text-[10px] text-slate-400 group-hover:text-slate-200 font-mono">
                    [{u.role === 'SUPERADMIN' ? 'Superadmin 最高管理' : u.role === 'ADMIN' ? 'Admin 系統管理員' : u.groupName || 'User 業務同仁'}]
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 右側登入表單 */}
        <div className="p-8 flex flex-col justify-center bg-white">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">帳號登入</h2>
            <p className="text-xs text-slate-500 mt-1">
              請輸入您的員工作業帳號或選擇上方快速登入
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                登入帳號或 Email
              </label>
              <input
                type="text"
                required
                placeholder="如：admin 或 huang.vp@greatgiant.com.tw"
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                登入密碼
              </label>
              <input
                type="password"
                required
                placeholder="預設密碼：123456"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                登入營運法人 (公司)
              </label>
              <select
                value={selectedCompanyId}
                onChange={e => setSelectedCompanyId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    [{c.companyCode}] {c.name} ({c.taxId})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5 mt-2"
            >
              <span>進入客製化營造工程 ERP 系統</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
            預設全系統示範密碼統一為：<code className="font-mono font-bold text-slate-600">123456</code>
          </div>
        </div>
      </div>
    </div>
  );
};
