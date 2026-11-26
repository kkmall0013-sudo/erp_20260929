import React, { useMemo, useState } from 'react';
import { Check, Code2, Copy, CreditCard, Info, Scale, Users2 } from 'lucide-react';
import { BusinessPartner } from '../../types/erp';
import { PartnerSearchSelect } from '../widgets/PartnerSearchSelect';

export const ChequeCalculatorDemoTab: React.FC = () => {
  const [calcIssueDate, setCalcIssueDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [calcTerms, setCalcTerms] = useState<number>(30);

  const calcResults = useMemo(() => {
    try {
      const issue = new Date(calcIssueDate);
      if (isNaN(issue.getTime())) return { expiry: '', due: '' };

      const expiry = new Date(issue);
      expiry.setFullYear(expiry.getFullYear() + 1);

      const due = new Date(issue);
      due.setDate(due.getDate() + calcTerms);

      return {
        expiry: expiry.toISOString().slice(0, 10),
        due: due.toISOString().slice(0, 10)
      };
    } catch (_) {
      return { expiry: '', due: '' };
    }
  }, [calcIssueDate, calcTerms]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
          <Scale className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            票據法第22條時效與遠期支票到期日工程實務試算機
          </h3>
          <p className="text-xs text-slate-500">
            釐清「收票日」、「發票日/開票日」、「約定兌現日」與「法定一年追索消滅時效」之法律與會計定義
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            票面開票日 / 發票日 (Issue Date)
          </label>
          <input
            type="date"
            value={calcIssueDate}
            onChange={e => setCalcIssueDate(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            工程約定票期 (天數)
          </label>
          <div className="flex items-center gap-1.5">
            <select
              value={calcTerms}
              onChange={e => setCalcTerms(Number(e.target.value))}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
            >
              <option value={0}>0 天 (即期支票 / 見票即付)</option>
              <option value={30}>30 天期 (次月付款)</option>
              <option value={45}>45 天期</option>
              <option value={60}>60 天期 (常見工程包商票期)</option>
              <option value={90}>90 天期 (三個月期票)</option>
              <option value={365}>365 天 (法定一年追索時效)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col justify-end">
          <div className="text-xs text-slate-500">
            試算約定兌現日：
            <span className="font-mono font-bold text-indigo-700 ml-1">
              {calcResults.due}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2 text-xs">
          <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-amber-700" />
            <span>使用者常見疑問：支票到期日不是一年嗎？為什麼還要輸入？</span>
          </h4>
          <div className="text-amber-950 space-y-2 leading-relaxed">
            <p>
              <strong>1. 票據法第128條第2項規定：</strong>「支票限於見票即付，有相反之記載者，其記載無效。」
            </p>
            <p>
              <strong>2. 臺灣商業與工程實務（遠期支票 Post-dated Check）：</strong>
              商業習慣開立「遠期支票」，發票人簽發時記載將來之日期作為「發票日」，雙方約定在該日之前不提示。因此，工程會計出納所謂的「到期日/兌現日」，在法律與票面文字上即是該「約定發票日」。
            </p>
            <p>
              <strong>3. 票據法第22條第1項（法定一年消滅時效）：</strong>
              「票據上之權利，對支票發票人自發票日起算，<strong>一年間不行使，因免除其責任</strong>。」
              這一年指的是「執票人向發票人行使追索權的法定消滅時效」，並非可任由延後一年才兌換。
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2 text-xs">
          <h4 className="font-bold text-indigo-950 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-indigo-700" />
            <span>系統四種日期節點設計規範 (SSoT)</span>
          </h4>
          <div className="text-indigo-950 space-y-2 leading-relaxed">
            <p>
              <strong>📥 收到日期 (receivedDate)：</strong>
              出納人員拿到支票的當天（如：2026-10-08），用以登記保管箱在庫盤點。
            </p>
            <p>
              <strong>✍️ 發票日/開票日 (issueDate)：</strong>
              支票票面上載明的日期（票據法權利起算點）。
            </p>
            <p>
              <strong>🏦 約定兌現日 (dueDate / cashableDate)：</strong>
              資金可真正入帳之提示日。系統提供快捷鍵一鍵填入（即期、30天、60天等）。
            </p>
            <p>
              <strong>⚖️ 法定時效終期 (statutoryExpiryDate)：</strong>
              系統自動根據發票日 + 1 年進行法律警示：<span className="font-mono font-bold text-red-600">{calcResults.expiry}</span>。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PartnerSearchDemoTabProps {
  copiedCodeKey: string | null;
  onCopyCode: (key: string, code: string) => void;
}

export const PartnerSearchDemoTab: React.FC<PartnerSearchDemoTabProps> = ({
  copiedCodeKey,
  onCopyCode
}) => {
  const [demoPartner, setDemoPartner] = useState<BusinessPartner | null>(null);
  const [demoPartnerName, setDemoPartnerName] = useState<string>('');
  const [demoPartnerFilter, setDemoPartnerFilter] = useState<'ALL' | 'CUSTOMER' | 'VENDOR' | 'SUBCONTRACTOR' | 'SHOP_DRAWING'>('ALL');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                小程式：商業夥伴即時搜尋與彈窗快建元件 (PartnerSearchSelect)
              </h3>
              <p className="text-xs text-slate-500">
                打字即時動態過濾（打一個字即自動篩選出宏、大巨等），若查無夥伴可直接點擊「另建新客戶/廠商」彈窗即時新增！
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="font-bold text-slate-700">夥伴類型過濾：</span>
          {(['ALL', 'CUSTOMER', 'VENDOR', 'SUBCONTRACTOR', 'SHOP_DRAWING'] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setDemoPartnerFilter(type)}
              className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                demoPartnerFilter === type
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {type === 'ALL' ? '全部夥伴' : type === 'CUSTOMER' ? '僅業主客戶' : type === 'VENDOR' ? '供料廠商' : type === 'SUBCONTRACTOR' ? '下包工班' : '拆圖協力廠'}
            </button>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <span className="text-xs font-bold text-slate-700">
            互動即時體驗區（可輸入「宏」、「大巨」、「台泥」、「結構」實測打字即時篩選，或輸入不存在名稱測試彈窗另建）：
          </span>
          <PartnerSearchSelect
            label="搜尋客戶、廠商或拆圖夥伴"
            partnerTypeFilter={demoPartnerFilter}
            placeholder="請輸入關鍵字搜尋夥伴 (如：宏、開發、營造、結構)..."
            value={demoPartnerName}
            onSelect={(partner, manualName) => {
              setDemoPartner(partner);
              setDemoPartnerName(partner ? partner.name : (manualName || ''));
            }}
            allowQuickCreate={true}
            quickCreateDefaultCategory={demoPartnerFilter === 'SHOP_DRAWING' ? '專業技術顧問 / 拆圖廠商' : undefined}
            helperText="打字即時篩選，可直接以鍵盤或滑鼠點選帶入，查無資料可彈窗另建！"
          />
        </div>

        <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2 text-xs">
          <div className="font-bold text-indigo-950 flex items-center justify-between">
            <span>選定之商業夥伴物件 SSoT：</span>
            <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-700">
              {demoPartner ? `已綁定 (ID: ${demoPartner.id})` : '手動輸入名稱'}
            </span>
          </div>
          <pre className="p-3 bg-white rounded-lg border border-indigo-200 font-mono text-[11px] text-slate-800 overflow-x-auto max-h-56">
            {demoPartner ? JSON.stringify(demoPartner, null, 2) : JSON.stringify({ manualName: demoPartnerName || '(尚未選取或輸入)' }, null, 2)}
          </pre>
        </div>
      </div>

      <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-indigo-600" />
              <span>其他模組如何調用此小程式？</span>
            </h4>
            <button
              type="button"
              onClick={() =>
                onCopyCode(
                  'partner_select',
                  `import { PartnerSearchSelect } from './widgets/PartnerSearchSelect';\n\n<PartnerSearchSelect\n  label="廠商名稱"\n  partnerTypeFilter="VENDOR"\n  placeholder="輸入文字即時篩選..."\n  value={vendorName}\n  onSelect={(partner, manualName) => {\n    if (partner) {\n      setVendorId(partner.id);\n      setVendorName(partner.name);\n    } else {\n      setVendorName(manualName || '');\n    }\n  }}\n  allowQuickCreate={true}\n/>`
                )
              }
              className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              {copiedCodeKey === 'partner_select' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCodeKey === 'partner_select' ? '已複製！' : '複製代碼'}</span>
            </button>
          </div>

          <div className="text-xs text-slate-600 leading-relaxed space-y-2">
            <p>
              <strong>適用模組：</strong>專案案場立項（甲方發票買受人 B / 起造人 A / 拆圖協力廠商）、採購發包單 PO、下包承攬約、進貨簽收單、應收應付憑單、支票受款人。
            </p>
            <p>
              <strong>三大核心特性：</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500 text-[11px]">
              <li><strong>即打即篩：</strong>打一個字立即過濾數百筆夥伴（支援名稱、統編、夥伴代號模糊比對），無須在超長下拉選單中肉眼尋找。</li>
              <li><strong>查無直接彈窗快建：</strong>若關鍵字找不到，下拉選單底部即時顯示「＋ 另建新客戶/廠商」按鈕，點擊彈出簡約建檔窗，儲存後立即自動選取並寫入資料庫。</li>
              <li><strong>分流過濾：</strong>支援 <code>partnerTypeFilter</code> (CUSTOMER, VENDOR, SUBCONTRACTOR, SHOP_DRAWING) 與 <code>categoryFilter</code> (如拆圖)，精準限定或加權推薦。</li>
            </ul>
          </div>

          <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed">
{`// 1. 引入通用元件
import { PartnerSearchSelect } from './widgets/PartnerSearchSelect';

// 2. 於 JSX 中調用
<PartnerSearchSelect
  label="合約甲方全銜"
  required
  partnerTypeFilter="CUSTOMER"
  placeholder="輸入關鍵字篩選 (如: 富鼎、宏)..."
  value={ownerName}
  onSelect={(partner, manualName) => {
    if (partner) {
      setOwnerName(partner.name);
      setOwnerTaxId(partner.taxId);
    }
  }}
  allowQuickCreate={true}
/>`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export const MiniAppsDevDocsTab: React.FC = () => (
  <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-6">
    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
        <Code2 className="w-4 h-4" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900">
          小程式專區規範與調用手冊 (Developer Cheat Sheet)
        </h3>
        <p className="text-xs text-slate-500">
          供所有接手開發其他模組（報價、估驗、合約、發票、人事）之工程師與 AI 直接引入調用
        </p>
      </div>
    </div>

    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
        <h4 className="text-xs font-bold text-slate-900">
          📁 元件與工具函數檔案架構清單：
        </h4>
        <ul className="text-xs text-slate-700 font-mono space-y-1.5 pl-4 list-disc">
          <li>
            <code>src/components/widgets/PartnerSearchSelect.tsx</code> — 商業夥伴即時搜尋與彈窗快建小程式 (支援即打即篩、拆圖分類、甲方/起造人分流、無資料彈窗建檔)
          </li>
          <li>
            <code>src/components/widgets/TaiwanAddressPicker.tsx</code> — 臺灣郵遞地址選單小程式
          </li>
          <li>
            <code>src/components/widgets/TaiwanIdTaxValidatorWidget.tsx</code> — 統編與身分證檢核小程式
          </li>
          <li>
            <code>src/components/widgets/TaiwanBankPickerWidget.tsx</code> — 全國金融機構查詢小程式
          </li>
          <li>
            <code>src/components/widgets/MediaPreviewLightbox.tsx</code> — 高解析圖片/PDF燈箱小程式 (免受 Chrome iframe 封鎖)
          </li>
          <li>
            <code>src/components/widgets/ChequeDetailModal.tsx</code> — 支票完整資訊與備註檢視視窗
          </li>
          <li>
            <code>src/utils/taiwanPostalCodes.ts</code> — 全國 368 鄉鎮市區與郵遞區號資料庫
          </li>
          <li>
            <code>src/utils/taiwanValidation.ts</code> — 統編 (8碼) 與身分證 (10碼) 加權演算法
          </li>
          <li>
            <code>src/components/finance/CustomerStatementMiniApp.tsx</code> — 對外客戶請款／對帳明細表小程式 (與私帳/401隔離，支援送交會計立帳)
          </li>
          <li>
            <code>src/components/finance/CheckRadarMiniApp.tsx</code> — 應收付票據三燈號管理與資金雷達小程式
          </li>
          <li>
            <code>src/components/finance/SuspensePoolMiniApp.tsx</code> — 未知款項暫收池與分批認領小程式
          </li>
          <li>
            <code>src/components/finance/Tax401WorkbookPanel.tsx</code> — 各公司雙月 401 營業稅活頁簿與預計請款模擬小程式
          </li>
          <li>
            <code>src/components/finance/ProjectLedgerAndStatementModal.tsx</code> — 案場對內借貸總帳與補開發票小程式
          </li>
          <li>
            <code>src/components/widgets/UniversalSearchBar.tsx</code> — 正式版通用搜尋與多欄位條件過濾條（預設單行收合、依 PBAC/私帳/401 靜默裁切欄位、無側漏防護）
          </li>
          <li>
            <code>src/utils/universalSearchEngine.ts</code> — 通用搜尋引擎與五大資料 Schema 定義（支援臺灣縣市別名／郵遞區號標準化與四層權限隔離）
          </li>
          <li>
            <code>src/utils/taiwanBanks.ts</code> — 全國 400+ 金融機構代碼資料庫
          </li>
        </ul>
      </div>
    </div>
  </div>
);
