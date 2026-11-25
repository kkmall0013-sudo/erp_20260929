import React from 'react';
import {
  Layers,
  Tag,
  Plus,
  X,
  Landmark,
  CreditCard,
  Upload,
  FileText,
  Trash2,
  Contact
} from 'lucide-react';
import {
  BusinessPartner,
  PartnerBusinessCard,
  PartnerChequeRecord,
  StoredMediaFile
} from '../../../types/erp';
import { TaiwanBankPickerWidget } from '../../widgets/TaiwanBankPickerWidget';
import { MediaPreviewItem } from '../../widgets/MediaPreviewLightbox';
import { HoverMediaPreviewData } from '../../widgets/HoverMediaPopover';
import { MappedCategoryItem } from './PartnerBasicInfoTab';

interface CategoryServiceTabProps {
  editingPartner: BusinessPartner;
  setEditingPartner: React.Dispatch<React.SetStateAction<BusinessPartner>>;
  categoryTree: MappedCategoryItem[];
  showToast: (msg: string) => void;
}

export const PartnerCategoryServiceTab: React.FC<CategoryServiceTabProps> = ({
  editingPartner,
  setEditingPartner,
  categoryTree,
  showToast
}) => {
  const defaultMain = categoryTree[0]?.mainCategory || '泥作裝修工程';
  const currentMain = editingPartner.serviceCategoryMain || defaultMain;
  const subCategories = categoryTree.find(g => g.mainCategory === currentMain)?.subCategories || [];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-1 text-xs">
        <h4 className="font-bold text-indigo-900 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>多元工項服務專業類別 (支援加入多項多元工種)</span>
        </h4>
        <p className="text-indigo-700 text-[11px]">
          廠商工作多元，可從下方選單選取標準工種與細項並加入多元清單中。目前主要分類標籤為：
          <strong className="ml-1">
            {editingPartner.categoryTags?.join('、') || editingPartner.categoryMain || '一般工程'}
          </strong>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div className="md:col-span-5">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            第一階：主要專業工項大類
          </label>
          <select
            value={currentMain}
            onChange={e => {
              const main = e.target.value;
              const group = categoryTree.find(g => g.mainCategory === main);
              setEditingPartner({
                ...editingPartner,
                serviceCategoryMain: main,
                serviceCategorySub: group?.subCategories[0] || ''
              });
            }}
            className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
          >
            {categoryTree.map(g => (
              <option key={g.mainCategory} value={g.mainCategory}>
                {g.mainCategory}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-5">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            第二階：細部專門工種
          </label>
          <select
            value={editingPartner.serviceCategorySub || ''}
            onChange={e => setEditingPartner({ ...editingPartner, serviceCategorySub: e.target.value })}
            className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
          >
            <option value="">（不限 / 通用）</option>
            {subCategories.map(sub => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <button
            type="button"
            onClick={() => {
              const main = editingPartner.serviceCategoryMain || defaultMain;
              const sub = editingPartner.serviceCategorySub || '';
              const list = editingPartner.serviceCategories ? [...editingPartner.serviceCategories] : [];
              if (list.some(c => c.main === main && c.sub === sub)) {
                showToast('⚠️ 該工項已經在清單中');
                return;
              }
              list.push({
                id: `CAT-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                main,
                sub
              });
              setEditingPartner({ ...editingPartner, serviceCategories: list });
              showToast(`✅ 已加入工種：${main}${sub ? ` › ${sub}` : ''}`);
            }}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>加入工種</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-700">已登錄之工種標籤清單：</span>
        {editingPartner.serviceCategories && editingPartner.serviceCategories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {editingPartner.serviceCategories.map((c, idx) => (
              <div
                key={c.id || idx}
                className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Tag className="w-3 h-3 text-indigo-500" />
                <span>
                  {c.main} {c.sub ? `› ${c.sub}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const list = editingPartner.serviceCategories!.filter((_, i) => i !== idx);
                    setEditingPartner({
                      ...editingPartner,
                      serviceCategories: list,
                      serviceCategoryMain: list[0]?.main,
                      serviceCategorySub: list[0]?.sub
                    });
                  }}
                  className="text-slate-400 hover:text-red-600 ml-1 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            尚未加入任何細部工項分類
          </div>
        )}
      </div>
    </div>
  );
};

interface PartnerBankTabProps {
  editingPartner: BusinessPartner;
  setEditingPartner: React.Dispatch<React.SetStateAction<BusinessPartner>>;
  handleProcessFiles: (files: FileList | null, onSuccess: (newFiles: StoredMediaFile[]) => void) => void;
  setLightboxMedia: (media: MediaPreviewItem | null) => void;
  setHoverPreview: (preview: HoverMediaPreviewData | null) => void;
}

export const PartnerBankTab: React.FC<PartnerBankTabProps> = ({
  editingPartner,
  setEditingPartner,
  handleProcessFiles,
  setLightboxMedia,
  setHoverPreview
}) => {
  const passbookFiles = editingPartner.bankAccounts?.[0]?.passbookFiles || [];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <Landmark className="w-4 h-4 text-indigo-600" />
          <span>主要收款/扣款金融機構帳號 (出納匯款標的)</span>
        </h4>

        <TaiwanBankPickerWidget
          bankCode={editingPartner.bankCode || '004'}
          bankName={editingPartner.bankName || '臺灣銀行'}
          onChange={({ bankCode, bankName }) =>
            setEditingPartner({ ...editingPartner, bankCode, bankName })
          }
          label="全國金融機構代碼與機構名稱 (支援 400+ 銀行農漁會信用部)"
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">銀行帳戶戶名</label>
            <input
              type="text"
              value={editingPartner.bankAccountName || editingPartner.name}
              onChange={e => setEditingPartner({ ...editingPartner, bankAccountName: e.target.value })}
              placeholder="戶名 (通常同公司全稱)"
              className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              銀行帳號 (10 ~ 16 碼純數字)
            </label>
            <input
              type="text"
              value={editingPartner.bankAccount || ''}
              onChange={e => setEditingPartner({ ...editingPartner, bankAccount: e.target.value.trim() })}
              placeholder="請輸入無破折號之帳號"
              className="w-full text-xs p-2.5 font-mono font-bold bg-white border border-slate-300 rounded-lg tracking-wider"
            />
          </div>
        </div>
      </div>

      {/* 存摺封面多檔案上傳與預覽 */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>存摺封面 / 印鑑卡 / 匯款同意書 (多檔案支援)</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              支援上傳多個圖檔或 PDF。滑鼠懸停放大預覽，點擊燈箱檢視與下載。
            </p>
          </div>
          <label className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs">
            <Upload className="w-3.5 h-3.5" />
            <span>上傳存摺</span>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e =>
                handleProcessFiles(e.target.files, newFiles => {
                  const bList = [...(editingPartner.bankAccounts || [])];
                  if (bList.length === 0) {
                    bList.push({
                      id: `BACC-${Date.now()}-1`,
                      bpId: editingPartner.id,
                      bankCode: editingPartner.bankCode || '004',
                      bankName: editingPartner.bankName || '臺灣銀行',
                      accountNumber: editingPartner.bankAccount || '',
                      accountName: editingPartner.bankAccountName || editingPartner.name,
                      isPrimary: true,
                      passbookFiles: newFiles
                    });
                  } else {
                    bList[0] = {
                      ...bList[0],
                      passbookFiles: [...(bList[0].passbookFiles || []), ...newFiles]
                    };
                  }
                  setEditingPartner({ ...editingPartner, bankAccounts: bList });
                })
              }
            />
          </label>
        </div>

        {passbookFiles.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {passbookFiles.map((f, idx) => (
              <div key={f.id || idx} className="bg-white p-2 rounded-xl border border-slate-200 space-y-1.5">
                <div
                  className="aspect-4/3 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer relative"
                  onClick={() =>
                    setLightboxMedia({
                      url: f.dataUrl,
                      title: f.name,
                      isPdf: f.fileType === 'PDF'
                    })
                  }
                  onMouseEnter={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoverPreview({
                      url: f.dataUrl,
                      title: f.name,
                      isPdf: f.fileType === 'PDF',
                      x: rect.left - 420,
                      y: rect.top - 80
                    });
                  }}
                  onMouseLeave={() => setHoverPreview(null)}
                >
                  {f.fileType === 'PDF' ? (
                    <div className="text-red-600 flex flex-col items-center">
                      <FileText className="w-8 h-8" />
                      <span className="text-[10px] font-bold">PDF 憑據</span>
                    </div>
                  ) : (
                    <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="truncate max-w-[100px] text-slate-700 font-medium" title={f.name}>
                    {f.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const bList = [...(editingPartner.bankAccounts || [])];
                      bList[0] = {
                        ...bList[0],
                        passbookFiles: bList[0].passbookFiles!.filter((_, i) => i !== idx)
                      };
                      setEditingPartner({ ...editingPartner, bankAccounts: bList });
                    }}
                    className="text-slate-400 hover:text-red-600 p-0.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-400 italic">
            尚未上傳存摺影本照片或 PDF 掃描檔
          </div>
        )}
      </div>
    </div>
  );
};

interface PartnerChequesTabProps {
  editingPartner: BusinessPartner;
  onOpenAddCheque?: (partnerId: string) => void;
  onSelectChequeDetail?: (cheque: PartnerChequeRecord) => void;
  onRequestDeleteCheque?: (cheque: PartnerChequeRecord) => void;
}

export const PartnerChequesTab: React.FC<PartnerChequesTabProps> = ({
  editingPartner,
  onOpenAddCheque,
  onSelectChequeDetail,
  onRequestDeleteCheque
}) => {
  const cheques = editingPartner.chequeRecords || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-900">
            支票收付往來歷程紀錄 ({cheques.length})
          </h4>
          <p className="text-[11px] text-slate-500">
            收受業主期票或開立廠商工程支票。點擊任何一筆可查看完整票面與備註！
          </p>
        </div>
        {onOpenAddCheque && (
          <button
            type="button"
            onClick={() => onOpenAddCheque(editingPartner.id)}
            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>登記新支票</span>
          </button>
        )}
      </div>

      {cheques.length > 0 ? (
        <div className="space-y-2">
          {cheques.map(chk => (
            <div
              key={chk.id}
              onClick={() => onSelectChequeDetail?.(chk)}
              className="p-3 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200 flex items-center justify-between text-xs cursor-pointer transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      chk.direction === 'RECEIPT'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {chk.direction === 'RECEIPT' ? '收受支票' : '開立支票'}
                  </span>
                  <span className="font-mono font-bold text-slate-900">{chk.checkNumber}</span>
                  <span className="font-mono font-extrabold text-indigo-700">
                    NT$ {chk.amount.toLocaleString()}
                  </span>
                  {chk.isNonNegotiable && (
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1 rounded font-semibold">
                      禁背
                    </span>
                  )}
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-bold">
                    {chk.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                  <span>
                    銀行：[{chk.bankCode}] {chk.bankName}
                  </span>
                  <span>發票日：{chk.issueDate}</span>
                  <span className="font-bold text-indigo-700">兌現日：{chk.dueDate}</span>
                  {chk.notes && (
                    <span className="text-amber-800 bg-amber-50 px-1 rounded truncate max-w-[150px]">
                      註: {chk.notes}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                {onSelectChequeDetail && (
                  <button
                    type="button"
                    onClick={() => onSelectChequeDetail(chk)}
                    className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded cursor-pointer"
                  >
                    查看明細
                  </button>
                )}
                {onRequestDeleteCheque && (
                  <button
                    type="button"
                    onClick={() => onRequestDeleteCheque(chk)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">
          {onOpenAddCheque
            ? '尚未登記任何支票收發紀錄'
            : '主檔建立後，可隨時自【聯絡明細】總覽介面記錄收受或開立支票！'}
        </div>
      )}
    </div>
  );
};

interface PartnerCardsTabProps {
  editingPartner: BusinessPartner;
  setEditingPartner: React.Dispatch<React.SetStateAction<BusinessPartner>>;
  handleProcessFiles: (files: FileList | null, onSuccess: (newFiles: StoredMediaFile[]) => void) => void;
  setLightboxMedia: (media: MediaPreviewItem | null) => void;
  setHoverPreview: (preview: HoverMediaPreviewData | null) => void;
  onOpenAddCard?: (partner: BusinessPartner) => void;
  onRequestDeleteCard?: (card: PartnerBusinessCard) => void;
  showToast: (msg: string) => void;
}

export const PartnerCardsTab: React.FC<PartnerCardsTabProps> = ({
  editingPartner,
  setEditingPartner,
  handleProcessFiles,
  setLightboxMedia,
  setHoverPreview,
  onOpenAddCard,
  onRequestDeleteCard,
  showToast
}) => {
  const cards = editingPartner.businessCards || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Contact className="w-4 h-4 text-indigo-600" />
            <span>交換名片存查庫 ({cards.length})</span>
          </h4>
          <p className="text-[11px] text-slate-500">
            廠商或業主拜訪交換名片時，上傳正反面圖檔或 PDF 掃描件，亦可一鍵同步為主要聯絡人。
          </p>
        </div>

        {onOpenAddCard ? (
          <button
            type="button"
            onClick={() => onOpenAddCard(editingPartner)}
            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>上傳/新增名片</span>
          </button>
        ) : (
          <label className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs">
            <Upload className="w-3.5 h-3.5" />
            <span>上傳名片照片</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e =>
                handleProcessFiles(e.target.files, newFiles => {
                  if (newFiles.length > 0) {
                    const f = newFiles[0];
                    const newCard: PartnerBusinessCard = {
                      id: `PBC-${Date.now()}`,
                      partnerId: editingPartner.id,
                      name: editingPartner.contactPerson || editingPartner.name,
                      title: '窗口代表',
                      companyName: editingPartner.name,
                      phone: editingPartner.phone || '',
                      exchangeDate: new Date().toISOString().slice(0, 10),
                      cardFrontUrl: f.dataUrl,
                      cardFileType: f.fileType === 'PDF' ? 'PDF' : 'IMAGE',
                      notes: '建檔建立'
                    };
                    setEditingPartner({
                      ...editingPartner,
                      businessCards: [...cards, newCard]
                    });
                  }
                })
              }
            />
          </label>
        )}
      </div>

      {cards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cards.map((card, idx) => (
            <div
              key={card.id || idx}
              className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">{card.name || '名片'}</span>
                    {card.title && (
                      <span className="text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                        {card.title}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    {card.phone && <div>總機: {card.phone}</div>}
                    {card.mobile && <div className="font-mono">手機: {card.mobile}</div>}
                    {card.email && <div className="font-mono truncate">信箱: {card.email}</div>}
                    {card.exchangeDate && (
                      <div className="text-[10px] text-slate-400">交換日期: {card.exchangeDate}</div>
                    )}
                  </div>
                </div>

                {card.cardFrontUrl && (
                  <div
                    className="w-20 h-14 bg-slate-200 rounded-lg overflow-hidden shrink-0 cursor-pointer border border-slate-300 relative"
                    onClick={() =>
                      setLightboxMedia({
                        url: card.cardFrontUrl!,
                        title: `名片：${card.name}`,
                        isPdf: card.cardFileType === 'PDF'
                      })
                    }
                    onMouseEnter={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoverPreview({
                        url: card.cardFrontUrl!,
                        title: `名片：${card.name}`,
                        isPdf: card.cardFileType === 'PDF',
                        x: rect.left - 420,
                        y: rect.top - 80
                      });
                    }}
                    onMouseLeave={() => setHoverPreview(null)}
                  >
                    {card.cardFileType === 'PDF' ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-red-600 bg-red-50">
                        <FileText className="w-5 h-5" />
                        <span className="text-[8px] font-bold">PDF</span>
                      </div>
                    ) : (
                      <img src={card.cardFrontUrl} alt="名片" className="w-full h-full object-cover" />
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => {
                    setEditingPartner({
                      ...editingPartner,
                      contactPerson: card.name,
                      phone: card.phone || card.mobile || editingPartner.phone,
                      email: card.email || editingPartner.email
                    });
                    showToast(`✅ 已將「${card.name}」設為主要聯絡人`);
                  }}
                  className="text-[11px] text-indigo-600 hover:underline font-bold cursor-pointer"
                >
                  設為主要聯絡人
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onRequestDeleteCard) {
                      onRequestDeleteCard(card);
                    } else {
                      const list = cards.filter((_, i) => i !== idx);
                      setEditingPartner({ ...editingPartner, businessCards: list });
                    }
                  }}
                  className="text-slate-400 hover:text-red-600 text-xs p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400">
          尚未收存任何名片
        </div>
      )}
    </div>
  );
};
