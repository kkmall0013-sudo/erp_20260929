import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Save,
  RefreshCw,
  Building2,
  HardHat
} from 'lucide-react';
import { BusinessPartner } from '../../types/erp';
import { batchImportBusinessPartners } from '../../db/sqlite';

interface PartnerImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser?: any;
}

interface ParsedPartnerRow {
  name: string;
  type: 'CUSTOMER' | 'VENDOR' | 'SUBCONTRACTOR' | 'BOTH';
  isIndividual: boolean;
  taxId: string;
  phone: string;
  contactPerson: string;
  email: string;
  address: string;
  categoryMain: string;
  categorySub: string;
  bankName: string;
  bankCode: string;
  bankAccount: string;
  bankAccountName: string;
  paymentTermsDays: number;
  isValid: boolean;
  error?: string;
}

// 簡單安全 CSV 欄位剖析器 (支援引號內逗號)
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export const PartnerImportModal: React.FC<PartnerImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUser
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedPartnerRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSummary, setImportSummary] = useState<{ imported: number; updated: number; errors: string[] } | null>(null);

  if (!isOpen) return null;

  // 下載標準 CSV 匯入範本
  const handleDownloadTemplate = () => {
    const headers = [
      '夥伴名稱/公司全銜 (必填)',
      '業務型態 (業主/廠商/工班/雙重)',
      '是否為個人 (是/否)',
      '統一編號或身分證號',
      '聯絡電話',
      '主要聯絡人',
      '電子信箱',
      '通訊地址',
      '第一階工料大類 (廠商用: 如鋼材/混凝土/拆圖)',
      '第二階細項工項 (廠商用)',
      '銀行代碼 (3碼)',
      '銀行名稱',
      '銀行帳號',
      '戶名',
      '付款天數 (天)'
    ];

    const sampleRows = [
      [
        '富鼎置地開發建設股份有限公司',
        '業主',
        '否',
        '12345678',
        '02-2788-9900',
        '王經理',
        'contact@fuding.com.tw',
        '臺北市南港區經貿二路100號',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ],
      [
        '林文華 (自建自住地主)',
        '業主',
        '是',
        '', // 個人業主身分證免強制填寫
        '0912-345-678',
        '林文華',
        'lin@gmail.com',
        '新北市板橋區縣民大道二段50號',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ],
      [
        '宏聯結構工程拆圖顧問有限公司',
        '廠商',
        '否',
        '54321678',
        '02-2345-6789',
        '黃宏達 技師',
        'detail@honglian.com.tw',
        '台北市中山區南京東路三段28號',
        '拆圖',
        '結構大樣圖拆圖',
        '012',
        '台北富邦銀行',
        '012001998877',
        '宏聯結構工程拆圖顧問有限公司',
        '30'
      ],
      [
        '東和鋼鐵企業股份有限公司',
        '廠商',
        '否',
        '11223344',
        '02-2500-1122',
        '陳副理',
        'sales@tunghosteel.com',
        '台北市中山區長安東路一段9號',
        '鋼材',
        'H型鋼與鋼板供料',
        '004',
        '臺灣銀行',
        '004001223344',
        '東和鋼鐵企業股份有限公司',
        '60'
      ]
    ];

    const csvContent = '\uFEFF' + [
      headers.map(h => `"${h}"`).join(','),
      ...sampleRows.map(row => row.map(col => `"${col.replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `商業夥伴與通訊錄匯入標準範本_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 處理上傳檔案
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          alert('CSV 檔案內無有效資料行');
          return;
        }

        // 跳過第一行表頭
        const rows: ParsedPartnerRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]);
          const name = cols[0] || '';
          if (!name.trim()) continue;

          const typeStr = (cols[1] || '廠商').trim();
          let type: 'CUSTOMER' | 'VENDOR' | 'SUBCONTRACTOR' | 'BOTH' = 'VENDOR';
          if (typeStr.includes('業主') || typeStr.includes('客戶')) {
            type = 'CUSTOMER';
          } else if (typeStr.includes('工班')) {
            type = 'SUBCONTRACTOR';
          } else if (typeStr.includes('雙重')) {
            type = 'BOTH';
          }

          const isIndStr = (cols[2] || '').trim();
          const isIndividual = isIndStr === '是' || isIndStr.toLowerCase() === 'true' || isIndStr === '1';

          const taxId = (cols[3] || '').trim();
          const phone = (cols[4] || '').trim();
          const contactPerson = (cols[5] || '').trim();
          const email = (cols[6] || '').trim();
          const address = (cols[7] || '').trim();
          const categoryMain = (cols[8] || '').trim();
          const categorySub = (cols[9] || '').trim();
          const bankCode = (cols[10] || '').trim();
          const bankName = (cols[11] || '').trim();
          const bankAccount = (cols[12] || '').trim();
          const bankAccountName = (cols[13] || '').trim() || name;
          const paymentTermsDays = Number(cols[14]) || 30;

          // 驗證檢查
          let isValid = true;
          let error = '';

          // 合作廠商需有工料分類提示
          if (type !== 'CUSTOMER' && !categoryMain) {
            error = '建議填寫第一階工料分類';
          }

          rows.push({
            name,
            type,
            isIndividual,
            taxId,
            phone,
            contactPerson,
            email,
            address,
            categoryMain,
            categorySub,
            bankName,
            bankCode,
            bankAccount,
            bankAccountName,
            paymentTermsDays,
            isValid,
            error
          });
        }

        setParsedRows(rows);
      } catch (err: any) {
        alert('解析 CSV 失敗：' + (err.message || '請確認檔案格式是否正確'));
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // 執行批次匯入
  const handleExecuteImport = () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);

    try {
      const operator = currentUser?.fullName || '系統管理員';
      const partnersToImport: Partial<BusinessPartner>[] = parsedRows.map((r, idx) => {
        const isCust = r.type === 'CUSTOMER' || r.type === 'BOTH';
        const isVend = r.type === 'VENDOR' || r.type === 'SUBCONTRACTOR' || r.type === 'BOTH';

        return {
          id: `BP-IMP-${Date.now().toString().slice(-6)}-${idx + 1}`,
          bpCode: isCust ? `CUST-${Date.now().toString().slice(-4)}-${idx + 1}` : `VEND-${Date.now().toString().slice(-4)}-${idx + 1}`,
          name: r.name,
          taxId: r.taxId,
          entityType: r.isIndividual ? 'NATURAL_PERSON' : 'CORPORATION',
          isIndividual: r.isIndividual,
          type: r.type,
          isCustomer: isCust,
          isVendor: isVend,
          contactPerson: r.contactPerson || r.name,
          phone: r.phone,
          email: r.email,
          address: r.address,
          serviceCategoryMain: r.categoryMain || (isVend ? '一般協力廠商' : undefined),
          serviceCategorySub: r.categorySub || (isVend ? '材料工項' : undefined),
          categoryMain: r.categoryMain,
          categorySub: r.categorySub,
          bankName: r.bankName,
          bankCode: r.bankCode,
          bankAccount: r.bankAccount,
          bankAccountName: r.bankAccountName || r.name,
          paymentTermsDays: r.paymentTermsDays,
          status: 'ACTIVE'
        };
      });

      const result = batchImportBusinessPartners(partnersToImport, operator);
      setImportSummary(result);
      setIsProcessing(false);
      onSuccess();
    } catch (err: any) {
      setIsProcessing(false);
      alert('批次匯入失敗：' + (err.message || '未知錯誤'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">
                  批次匯入聯絡名冊 (CSV 試算表)
                </h2>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  支援業主與廠商批次匯入
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                可快速將營造公司既有成百上千筆客戶與廠商名冊一次性匯入系統
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 內容區塊 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* 下載範本與上傳卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 卡片 1: 下載標準範本 */}
            <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  <span>步驟 1：下載標準 CSV 匯入範本</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  包含業主與合作廠商示範資料，個人自然人業主免強制填寫身分證，廠商則示範第一階工料分類與銀行帳號欄位。
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white text-indigo-700 border border-indigo-300 hover:bg-indigo-50 font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>下載標準 CSV 範本檔案</span>
              </button>
            </div>

            {/* 卡片 2: 選擇/拖曳檔案上傳 */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span>步驟 2：選擇欲匯入的 CSV 檔案</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  請將填寫好的 CSV 檔案上傳（支援 UTF-8 編碼），系統將即時解析預覽。
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-2xs transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>{fileName ? `重新選擇檔案 (${fileName})` : '選擇 CSV 檔案上傳'}</span>
              </button>
            </div>
          </div>

          {/* 匯入完成成功通知 Banner */}
          {importSummary && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>✓ 批次匯入完成！成功匯入 {importSummary.imported} 筆資料</span>
              </div>
              {importSummary.errors.length > 0 && (
                <div className="text-[11px] text-amber-700 pt-1">
                  注意事項：{importSummary.errors.join('、')}
                </div>
              )}
            </div>
          )}

          {/* 預覽解析表格 */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <span>檔案預覽確認：共解析出 <strong className="text-indigo-600">{parsedRows.length}</strong> 筆聯絡名冊</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  請核對資料無誤後點擊右下角「確認批次匯入」
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">名稱 / 公司全銜</th>
                      <th className="py-2 px-3">型態</th>
                      <th className="py-2 px-3">統編 / 身分證</th>
                      <th className="py-2 px-3">電話</th>
                      <th className="py-2 px-3">第一階工料類別</th>
                      <th className="py-2 px-3">銀行帳戶</th>
                      <th className="py-2 px-3 text-center">狀態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-1.5 px-3 font-sans font-bold text-slate-800">
                          {row.name}
                        </td>
                        <td className="py-1.5 px-3 font-sans">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            row.type === 'CUSTOMER'
                              ? 'bg-indigo-50 text-indigo-700'
                              : row.type === 'BOTH'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {row.type === 'CUSTOMER' ? '業主客戶' : row.type === 'BOTH' ? '雙重身分' : '合作廠商'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-slate-600">
                          {row.taxId || (row.isIndividual ? <span className="text-slate-400 italic">個人免填</span> : '-')}
                        </td>
                        <td className="py-1.5 px-3 text-slate-600">
                          {row.phone || '-'}
                        </td>
                        <td className="py-1.5 px-3 font-sans text-slate-700">
                          {row.categoryMain || '-'}
                        </td>
                        <td className="py-1.5 px-3 text-slate-600 truncate max-w-xs">
                          {row.bankAccount ? `${row.bankName || ''} (${row.bankAccount})` : '-'}
                        </td>
                        <td className="py-1.5 px-3 text-center font-sans">
                          {row.error ? (
                            <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded" title={row.error}>
                              ⚠️ 提醒
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 rounded font-bold">
                              ✓ 良好
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <span className="text-[11px] text-slate-400">
            匯入後將自動寫入資料庫並於全模組與案場工程立即可選
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              關閉
            </button>
            <button
              type="button"
              disabled={parsedRows.length === 0 || isProcessing}
              onClick={handleExecuteImport}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 transition-colors shadow-xs cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isProcessing ? '正在匯入中...' : `確認匯入 ${parsedRows.length} 筆資料`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
