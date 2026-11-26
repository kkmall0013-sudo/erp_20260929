import { BusinessPartner, Invoice, PaymentRecord } from '../../../types/erp';
import {
  getDefaultOperatorForField,
  SearchCondition,
  SearchFieldDescriptor
} from '../../../utils/universalSearchEngine';

// 純記憶體測試誘餌資料（絕不寫入 SQLite 正式資料庫，刪除測試區即完全移除）
export const MEMORY_BAIT_PARTNER: BusinessPartner = {
  id: 'BAIT-BP-SECRET',
  bpCode: 'BAIT-SEC-01',
  companyId: 'COMP-01',
  name: '測試台北秘密廠商股份有限公司 (記憶體誘餌)',
  type: 'VENDOR',
  isVendor: true,
  isCustomer: false,
  taxId: '24549210',
  categoryMain: '預拌混凝土',
  categoryTags: ['混凝土', '泵浦車'],
  contactPerson: '陳測試',
  phone: '02-2345-6789',
  email: 'test-sec@example.com',
  address: '100 臺北市中正區忠孝西路一段10號',
  addresses: [
    {
      id: 'BAIT-ADDR-1',
      partnerId: 'BAIT-BP-SECRET',
      addressType: 'COMMUNICATION',
      label: '營業處',
      postalCode: '100',
      city: '臺北市',
      district: '中正區',
      streetAddress: '忠孝西路一段10號',
      fullAddress: '100 臺北市中正區忠孝西路一段10號',
      isDeleted: false
    }
  ],
  bankCode: '004',
  bankName: '臺灣銀行',
  bankAccount: 'SECRET-ACCT-998877',
  bankAccountName: '秘密測試戶',
  hasInvoice: true,
  paymentTermsDays: 60,
  status: 'ACTIVE',
  isHighRisk: false,
  isDeleted: false,
  version: 1,
  createdAt: '2026-04-01',
  updatedAt: '2026-04-01'
};

export const MEMORY_BAIT_BOSS_PAYMENT: PaymentRecord = {
  id: 'BAIT-PAY-BOSS-001',
  paymentNo: 'PAY-BOSS-BAIT-999',
  companyId: 'BOSS-01',
  currency: 'TWD',
  partnerId: 'BAIT-BP-SECRET',
  partnerName: '測試台北秘密廠商股份有限公司 (私帳誘餌)',
  documentDate: '2026-04-12',
  postingDate: '2026-04-12',
  paymentMethod: 'TT',
  isReversal: false,
  totalAmount: 88000,
  bankAccountId: 'BANK-BOSS',
  bankAccountName: '林董私人調度戶',
  isBossAdvance: true,
  isReconciled: false,
  status: 'POSTED',
  notes: '純記憶體老闆私帳誘餌，僅 BOSS / Superadmin 可查見',
  createdAt: '2026-04-12',
  updatedAt: '2026-04-12'
};

export const MEMORY_BAIT_INVOICES: Invoice[] = [
  {
    id: 'BAIT-INV-SELF-01',
    taxReportingCompanyId: 'COMP-01',
    invoiceType: 'OUTPUT',
    invoiceNumber: 'ZZ-99887766',
    invoiceDate: '2026-04-10',
    taxPeriod: '2026-03-04',
    issuerTaxId: '88991234',
    issuerName: '台灣大巨營造工程股份有限公司',
    buyerName: '自留不交付業主 (401機密誘餌)',
    buyerTaxId: '24549210',
    netAmount: 100000,
    taxAmount: 5000,
    totalAmount: 105000,
    invoiceCategory: 'SALES_THREE_PART',
    invoiceIssueMode: 'SELF_RETAINED',
    status: 'VALID',
    createdAt: '2026-04-10',
    updatedAt: '2026-04-10'
  },
  {
    id: 'BAIT-INV-COMP02-01',
    taxReportingCompanyId: 'COMP-02',
    invoiceType: 'OUTPUT',
    invoiceNumber: 'AB-11223344',
    invoiceDate: '2026-04-11',
    taxPeriod: '2026-03-04',
    issuerTaxId: '54329876',
    issuerName: '宏達機電工程股份有限公司',
    buyerName: '宏達機電測試客戶 (跨法人誘餌)',
    buyerTaxId: '03795505',
    netAmount: 200000,
    taxAmount: 10000,
    totalAmount: 210000,
    invoiceCategory: 'SALES_THREE_PART',
    invoiceIssueMode: 'DELIVERED',
    status: 'VALID',
    createdAt: '2026-04-11',
    updatedAt: '2026-04-11'
  }
];

export function getQuickDateRange(preset: 'THIS_MONTH' | 'LAST_3M' | 'THIS_YEAR'): { from: string; to: string } {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = (y: number, mZero: number) => new Date(y, mZero + 1, 0).getDate();

  if (preset === 'THIS_MONTH') {
    return {
      from: `${yyyy}-${pad(mm + 1)}-01`,
      to: `${yyyy}-${pad(mm + 1)}-${pad(lastDay(yyyy, mm))}`
    };
  }
  if (preset === 'LAST_3M') {
    const start = new Date(yyyy, mm - 2, 1);
    return {
      from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
      to: `${yyyy}-${pad(mm + 1)}-${pad(lastDay(yyyy, mm))}`
    };
  }
  return {
    from: `${yyyy}-01-01`,
    to: `${yyyy}-12-31`
  };
}

export function hasFieldFormValue(field: SearchFieldDescriptor<any>, val: any): boolean {
  if (val === undefined || val === null) return false;
  switch (field.dataType) {
    case 'SELECT':
      return Array.isArray(val) && val.length > 0;
    case 'NUMBER':
      return Boolean((val.min !== undefined && val.min !== '') || (val.max !== undefined && val.max !== ''));
    case 'DATE':
      return Boolean(val.from || val.to);
    case 'BOOLEAN':
      return val === 'TRUE' || val === 'FALSE';
    default:
      return String(val).trim().length > 0;
  }
}

export function buildConditionsFromFormValues(
  allSchemaFields: SearchFieldDescriptor<any>[],
  formValues: Record<string, any>
): SearchCondition[] {
  const conditions: SearchCondition[] = [];
  for (const field of allSchemaFields) {
    const val = formValues[field.key];
    if (!hasFieldFormValue(field, val)) continue;

    if (field.dataType === 'BOOLEAN') {
      conditions.push({
        id: `FORM-${field.key}`,
        fieldKey: field.key,
        operator: val === 'TRUE' ? 'IS_TRUE' : 'IS_FALSE',
        value: val === 'TRUE'
      });
    } else {
      conditions.push({
        id: `FORM-${field.key}`,
        fieldKey: field.key,
        operator: getDefaultOperatorForField(field.dataType),
        value: val
      });
    }
  }
  return conditions;
}
