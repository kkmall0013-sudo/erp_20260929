import type { Database } from 'sql.js';
import { initializeCoreTables } from './schemaCore';

// 營運、採購、現場進貨與財務會計資料表 DDL (Part 2)
export function initializeOperationsTables(db: Database): void {
  db.run(`
    -- 5. 報價與銷售模組 CPQ (Quotation, QuotationRevision, QuotationItem, QuotationBillingMilestone)
    CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      quoteNumber TEXT UNIQUE NOT NULL,
      projectId TEXT NOT NULL,
      customerId TEXT NOT NULL,
      customerName TEXT,
      companyId TEXT NOT NULL,
      currency TEXT DEFAULT 'TWD',
      netAmount REAL DEFAULT 0,
      taxAmount REAL DEFAULT 0,
      totalAmount REAL DEFAULT 0,
      discountAmount REAL DEFAULT 0,
      currentRevision TEXT DEFAULT 'REV-A',
      status TEXT DEFAULT 'DRAFT',
      validityDate TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS quotation_revisions (
      id TEXT PRIMARY KEY,
      quotationId TEXT NOT NULL,
      revisionCode TEXT NOT NULL,
      netAmount REAL DEFAULT 0,
      taxAmount REAL DEFAULT 0,
      totalAmount REAL DEFAULT 0,
      isWinning INTEGER DEFAULT 0,
      lostReason TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS quotation_items (
      id TEXT PRIMARY KEY,
      quotationId TEXT NOT NULL,
      revisionCode TEXT NOT NULL,
      itemType TEXT DEFAULT 'NORMAL',
      itemName TEXT NOT NULL,
      spec TEXT,
      quantity REAL DEFAULT 1,
      unit TEXT,
      unitPrice REAL DEFAULT 0,
      lineTotal REAL DEFAULT 0,
      remark TEXT
    );

    CREATE TABLE IF NOT EXISTS quotation_billing_milestones (
      id TEXT PRIMARY KEY,
      quotationId TEXT NOT NULL,
      stageIndex INTEGER NOT NULL,
      stageName TEXT NOT NULL,
      percentage REAL NOT NULL,
      estimatedDate TEXT,
      amount REAL DEFAULT 0
    );

    -- 6. 採購發包 (PurchaseOrder & PurchaseOrderItem)
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      poNumber TEXT UNIQUE NOT NULL,
      companyId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      vendorId TEXT NOT NULL,
      currency TEXT DEFAULT 'TWD',
      netAmount REAL DEFAULT 0,
      taxAmount REAL DEFAULT 0,
      totalAmount REAL DEFAULT 0,
      discountAmount REAL DEFAULT 0,
      retentionDeductionAmount REAL DEFAULT 0,
      postedTaxRate REAL DEFAULT 0.05,
      counterpartyNameSnapshot TEXT,
      counterpartyTaxIdSnapshot TEXT,
      projectNameSnapshot TEXT,
      isPrepaidDeduction INTEGER DEFAULT 0,
      prepaidDeductionAmount REAL DEFAULT 0,
      status TEXT DEFAULT 'DRAFT',
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY,
      purchaseOrderId TEXT NOT NULL,
      itemCode TEXT,
      itemName TEXT NOT NULL,
      spec TEXT,
      quantity REAL DEFAULT 1,
      unit TEXT,
      unitPrice REAL DEFAULT 0,
      lineTotal REAL DEFAULT 0
    );

    -- 6-1. 現場進貨簽收單與明細 (InboundReceipt & InboundReceiptItem - A模式直入案場成本)
    CREATE TABLE IF NOT EXISTS inbound_receipts (
      id TEXT PRIMARY KEY,
      receiptNumber TEXT UNIQUE NOT NULL,
      companyId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      projectNameSnapshot TEXT,
      projectCodeSnapshot TEXT,
      vendorId TEXT NOT NULL,
      vendorNameSnapshot TEXT,
      vendorTaxIdSnapshot TEXT,
      deliveryNoteNumber TEXT NOT NULL,
      orderNumber TEXT,
      receivedDate TEXT NOT NULL,
      receivedBy TEXT NOT NULL,
      totalAmount REAL DEFAULT 0,
      billingStatus TEXT DEFAULT 'PENDING_BILLING',
      reconciliationId TEXT,
      reconciliationNumber TEXT,
      purchaseOrderId TEXT,
      status TEXT DEFAULT 'DRAFT',
      attachmentFileId TEXT,
      attachmentFileName TEXT,
      notes TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS inbound_receipt_items (
      id TEXT PRIMARY KEY,
      receiptId TEXT NOT NULL,
      itemCode TEXT,
      itemName TEXT NOT NULL,
      spec TEXT,
      unit TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unitPrice REAL DEFAULT 0,
      lineTotal REAL DEFAULT 0,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_inbound_project ON inbound_receipts (projectId, isDeleted);
    CREATE INDEX IF NOT EXISTS idx_inbound_vendor ON inbound_receipts (vendorId, billingStatus, isDeleted);
    CREATE INDEX IF NOT EXISTS idx_inbound_items_receipt ON inbound_receipt_items (receiptId);

    -- 7. 發包合約與估驗計價 (Subcontract & Valuation & ValuationItem)
    CREATE TABLE IF NOT EXISTS subcontracts (
      id TEXT PRIMARY KEY,
      contractCode TEXT UNIQUE NOT NULL,
      projectId TEXT NOT NULL,
      subcontractorId TEXT NOT NULL,
      companyId TEXT NOT NULL,
      subcontractorName TEXT NOT NULL,
      projectName TEXT NOT NULL,
      contractName TEXT NOT NULL,
      totalAmount REAL DEFAULT 0,
      retentionRate REAL DEFAULT 10,
      prepaidAmount REAL DEFAULT 0,
      prepaidRemaining REAL DEFAULT 0,
      startDate TEXT,
      endDate TEXT,
      status TEXT DEFAULT 'ACTIVE'
    );

    CREATE TABLE IF NOT EXISTS valuations (
      id TEXT PRIMARY KEY,
      valuationNumber TEXT UNIQUE NOT NULL,
      subcontractId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      subcontractorId TEXT NOT NULL,
      companyId TEXT NOT NULL,
      periodIndex INTEGER NOT NULL,
      periodName TEXT NOT NULL,
      cumulativeProgressPct REAL DEFAULT 0,
      grossAmount REAL DEFAULT 0,
      retentionDeductionAmount REAL DEFAULT 0,
      prepaidDeductionAmount REAL DEFAULT 0,
      otherDeductionAmount REAL DEFAULT 0,
      netPayableAmount REAL DEFAULT 0,
      taxAmount REAL DEFAULT 0,
      totalAmount REAL DEFAULT 0,
      status TEXT DEFAULT 'DRAFT',
      counterpartyNameSnapshot TEXT,
      projectNameSnapshot TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS valuation_items (
      id TEXT PRIMARY KEY,
      valuationId TEXT NOT NULL,
      itemType TEXT DEFAULT 'NORMAL',
      itemName TEXT NOT NULL,
      unit TEXT,
      contractQuantity REAL DEFAULT 0,
      contractUnitPrice REAL DEFAULT 0,
      previousQty REAL DEFAULT 0,
      currentQty REAL DEFAULT 0,
      currentAmount REAL DEFAULT 0,
      remark TEXT
    );

    -- 8. 財務會計 (AccountPayable, AccountReceivable, BankCheck)
    CREATE TABLE IF NOT EXISTS accounts_payable (
      id TEXT PRIMARY KEY,
      apNumber TEXT UNIQUE NOT NULL,
      sourceTable TEXT NOT NULL,
      sourceId TEXT NOT NULL,
      companyId TEXT NOT NULL,
      vendorId TEXT NOT NULL,
      vendorName TEXT NOT NULL,
      originalAmount REAL DEFAULT 0,
      appliedAmount REAL DEFAULT 0,
      remainingAmount REAL DEFAULT 0,
      dueDate TEXT,
      invoiceNumber TEXT,
      taxReportingCompanyId TEXT,
      status TEXT DEFAULT 'OPEN',
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts_receivable (
      id TEXT PRIMARY KEY,
      arNumber TEXT UNIQUE NOT NULL,
      projectId TEXT NOT NULL,
      projectName TEXT,
      customerId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      companyId TEXT NOT NULL,
      title TEXT,
      netAmount REAL DEFAULT 0,
      taxType TEXT DEFAULT 'TAX_EXCLUSIVE',
      taxAmount REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      appliedAmount REAL DEFAULT 0,
      remainingAmount REAL DEFAULT 0,
      hasInvoice INTEGER DEFAULT 1,
      invoiceNumber TEXT,
      invoiceDate TEXT,
      dueDate TEXT,
      status TEXT DEFAULT 'OPEN',
      notes TEXT,
      bouncedCheckNumber TEXT,
      bouncedReason TEXT,
      bouncedAt TEXT,
      createdBy TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS fin_ar_collections (
      id TEXT PRIMARY KEY,
      arId TEXT NOT NULL,
      arNumber TEXT,
      companyId TEXT NOT NULL,
      collectionMethod TEXT NOT NULL,
      bankAccountId TEXT NOT NULL,
      bankAccountName TEXT,
      amount REAL DEFAULT 0,
      feeAmount REAL DEFAULT 0,
      netReceivedAmount REAL DEFAULT 0,
      checkNumber TEXT,
      checkDueDate TEXT,
      drawerBank TEXT,
      receivedDate TEXT NOT NULL,
      suspenseId TEXT,
      status TEXT DEFAULT 'POSTED',
      notes TEXT,
      createdBy TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS bank_checks (
      id TEXT PRIMARY KEY,
      checkNumber TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      companyId TEXT NOT NULL,
      counterpartyName TEXT NOT NULL,
      amount REAL DEFAULT 0,
      issueDate TEXT,
      dueDate TEXT,
      bankName TEXT,
      drawerBank TEXT,
      paymentId TEXT,
      expectedClearanceDate TEXT,
      actualClearanceDate TEXT,
      status TEXT DEFAULT 'ISSUED',
      voidReason TEXT,
      notes TEXT,
      replacesCheckNumber TEXT,
      reconciledApId TEXT,
      reconciledArId TEXT
    );

    -- 🏛️ 會計廠商應付對帳單 (大水池核心)
    CREATE TABLE IF NOT EXISTS ap_reconciliations (
      id TEXT PRIMARY KEY,
      reconciliationNumber TEXT UNIQUE NOT NULL,
      companyId TEXT NOT NULL,
      vendorId TEXT NOT NULL,
      vendorName TEXT,
      billingPeriod TEXT NOT NULL,
      inboundTotalAmount REAL DEFAULT 0,
      discountAmount REAL DEFAULT 0,
      taxType TEXT DEFAULT 'TAX_EXCLUSIVE',
      taxAmount REAL DEFAULT 0,
      netPayableAmount REAL DEFAULT 0,
      invoiceNumber TEXT,
      hasInvoice INTEGER DEFAULT 1,
      paymentDueDate TEXT NOT NULL,
      status TEXT DEFAULT 'APPROVED',
      reconciledBy TEXT,
      approvedBy TEXT,
      disbursedAt TEXT,
      notes TEXT,
      receiptIds TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT,
      designatedPaymentMethod TEXT DEFAULT 'CHECK',
      designatedBankAccountId TEXT,
      designatedBankAccountName TEXT,
      designatedCheckNumber TEXT,
      paymentTermNotes TEXT,
      isBossAdvance INTEGER DEFAULT 0,
      bouncedCheckNumber TEXT,
      bouncedReason TEXT,
      bouncedAt TEXT,
      returnedReason TEXT,
      returnedBy TEXT,
      returnedAt TEXT
    );

    -- 🏛️ 資金收支主檔 (出金付款單)
    CREATE TABLE IF NOT EXISTS fin_payment_records (
      id TEXT PRIMARY KEY,
      paymentNo TEXT UNIQUE NOT NULL,
      companyId TEXT NOT NULL,
      currency TEXT DEFAULT 'TWD',
      bankAccountId TEXT NOT NULL,
      bankAccountName TEXT,
      targetBankAccountId TEXT,
      partnerId TEXT,
      partnerName TEXT,
      customVendorName TEXT,
      paymentMethod TEXT DEFAULT 'TT',
      isReversal INTEGER DEFAULT 0,
      documentDate TEXT NOT NULL,
      postingDate TEXT NOT NULL,
      totalAmount REAL DEFAULT 0,
      status TEXT DEFAULT 'POSTED',
      isReconciled INTEGER DEFAULT 0,
      reconciledAt TEXT,
      voidReason TEXT,
      notes TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT,
      isBossAdvance INTEGER DEFAULT 0
    );

    -- 🏛️ 動態沖銷明細 (四柱平衡與粉紅代扣款)
    CREATE TABLE IF NOT EXISTS fin_payment_line_items (
      id TEXT PRIMARY KEY,
      paymentId TEXT NOT NULL,
      sourceType TEXT NOT NULL,
      sourceId TEXT NOT NULL,
      sourceNumber TEXT,
      itemType TEXT DEFAULT 'STANDARD',
      appliedAmount REAL DEFAULT 0,
      feeAmount REAL DEFAULT 0,
      isFeeAbsorbedByCompany INTEGER DEFAULT 1,
      discountAmount REAL DEFAULT 0,
      offsetExpenseId TEXT,
      withholdingTaxAmt REAL DEFAULT 0,
      nhiAmt REAL DEFAULT 0,
      projectId TEXT,
      notes TEXT
    );

    -- 🏛️ 共用發票主檔 (內外帳解耦)
    CREATE TABLE IF NOT EXISTS fin_invoices (
      id TEXT PRIMARY KEY,
      invoiceType TEXT DEFAULT 'INPUT',
      invoiceNumber TEXT NOT NULL,
      invoiceDate TEXT NOT NULL,
      taxReportingCompanyId TEXT NOT NULL,
      issuerTaxId TEXT NOT NULL,
      issuerName TEXT,
      buyerTaxId TEXT NOT NULL,
      buyerName TEXT,
      netAmount REAL DEFAULT 0,
      taxAmount REAL DEFAULT 0,
      totalAmount REAL DEFAULT 0,
      status TEXT DEFAULT 'VALID',
      createdAt TEXT,
      updatedAt TEXT,
      UNIQUE(taxReportingCompanyId, issuerTaxId, invoiceNumber)
    );

    -- 🏛️ 發票與請款單多對多勾稽
    CREATE TABLE IF NOT EXISTS fin_billing_invoice_mappings (
      id TEXT PRIMARY KEY,
      invoiceId TEXT NOT NULL,
      sourceDocumentType TEXT NOT NULL,
      sourceDocumentId TEXT NOT NULL,
      mappedAmount REAL DEFAULT 0,
      createdAt TEXT
    );

    -- 🏛️ 未知款項暫收池 (認領時才申報營業稅)
    CREATE TABLE IF NOT EXISTS fin_suspense_receipts (
      id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      bankAccountId TEXT NOT NULL,
      bankAccountName TEXT,
      amount REAL DEFAULT 0,
      receivedDate TEXT NOT NULL,
      payerInfo TEXT NOT NULL,
      isAllocated INTEGER DEFAULT 0,
      allocatedToArId TEXT,
      notes TEXT,
      createdAt TEXT
    );

    -- 🏛️ 溢付款資金池 (轉待扣抵或退款)
    CREATE TABLE IF NOT EXISTS fin_overpayment_pools (
      id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      partnerId TEXT NOT NULL,
      partnerName TEXT,
      amount REAL DEFAULT 0,
      resolvedBy TEXT,
      isResolved INTEGER DEFAULT 0,
      notes TEXT,
      createdAt TEXT
    );

    -- 🏛️ 公司銀行帳戶主檔 (含實體帳戶與老闆口袋專戶)
    CREATE TABLE IF NOT EXISTS company_bank_accounts (
      id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      bankCode TEXT NOT NULL,
      bankName TEXT NOT NULL,
      branchName TEXT,
      accountNumber TEXT NOT NULL,
      accountName TEXT NOT NULL,
      isVirtualAccount INTEGER DEFAULT 0,
      initialBalance REAL DEFAULT 0,
      currentBalance REAL DEFAULT 0,
      currency TEXT DEFAULT 'TWD',
      status TEXT DEFAULT 'ACTIVE',
      checkPrefix TEXT DEFAULT 'CQ',
      nextCheckNumber INTEGER DEFAULT 1001,
      checkDigits INTEGER DEFAULT 6,
      supportsCheck INTEGER DEFAULT 1,
      supportsTransfer INTEGER DEFAULT 1,
      paymentScheduleDays TEXT
    );
  `);

  // 安全增量升級既有 users 表之多階段刪除生命週期欄位
  try { db.run("ALTER TABLE users ADD COLUMN deleteStage TEXT DEFAULT 'ACTIVE';"); } catch (_) {}
  try { db.run("ALTER TABLE users ADD COLUMN stageDeletedAt TEXT;"); } catch (_) {}
  try { db.run("ALTER TABLE users ADD COLUMN purgeDueAt TEXT;"); } catch (_) {}
  try { db.run("ALTER TABLE users ADD COLUMN deletedBy TEXT;"); } catch (_) {}
  try { db.run("ALTER TABLE users ADD COLUMN stageNotes TEXT;"); } catch (_) {}

  // 安全增量升級既有 system_files 表之無紙化版本堆疊與健康狀態欄位
  try { db.run("ALTER TABLE system_files ADD COLUMN parentFileId TEXT;"); } catch (_) {}
  try { db.run("ALTER TABLE system_files ADD COLUMN isObsolete INTEGER DEFAULT 0;"); } catch (_) {}
  try { db.run("ALTER TABLE system_files ADD COLUMN status TEXT DEFAULT 'NORMAL';"); } catch (_) {}
  try { db.run("ALTER TABLE system_files ADD COLUMN isDeleted INTEGER DEFAULT 0;"); } catch (_) {}

  // 🛡️ 安全增量升級 Phase 4 CPQ 報價單三軌議價與影子單價欄位
  try { db.run("ALTER TABLE quotations ADD COLUMN pricingMode TEXT DEFAULT 'HEADER_DISCOUNT';"); } catch (_) {}
  try { db.run("ALTER TABLE quotations ADD COLUMN customDiscountText TEXT;"); } catch (_) {}
  try { db.run("ALTER TABLE quotations ADD COLUMN agreedTotalAmount REAL;"); } catch (_) {}
  try { db.run("ALTER TABLE quotations ADD COLUMN parentQuotationId TEXT;"); } catch (_) {}
  try { db.run("ALTER TABLE quotation_revisions ADD COLUMN pricingMode TEXT DEFAULT 'HEADER_DISCOUNT';"); } catch (_) {}
  try { db.run("ALTER TABLE quotation_revisions ADD COLUMN discountAmount REAL DEFAULT 0;"); } catch (_) {}
  try { db.run("ALTER TABLE quotation_items ADD COLUMN estimatedUnitCost REAL DEFAULT 0;"); } catch (_) {}
  try { db.run("ALTER TABLE quotation_items ADD COLUMN effectiveUnitPrice REAL DEFAULT 0;"); } catch (_) {}
  try { db.run("ALTER TABLE quotation_items ADD COLUMN isAwarded INTEGER DEFAULT 1;"); } catch (_) {}
  try { db.run("ALTER TABLE quotation_items ADD COLUMN lostReason TEXT;"); } catch (_) {}

  // 🛡️ 進貨簽收單專案代碼與訂貨單號安全增量欄位
  try { db.run("ALTER TABLE inbound_receipts ADD COLUMN projectCodeSnapshot TEXT;"); } catch (_) {}
  try { db.run("ALTER TABLE inbound_receipts ADD COLUMN orderNumber TEXT;"); } catch (_) {}
}

// 12 大模組資料表 DDL 入口
export function initializeTables(db: Database): void {
  initializeCoreTables(db);
  initializeOperationsTables(db);
}

// 確保 AR 延伸欄位與收款紀錄表存在
export function ensureArTablesAndColumns(db: Database): void {
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS fin_ar_collections (
        id TEXT PRIMARY KEY,
        arId TEXT NOT NULL,
        arNumber TEXT,
        companyId TEXT NOT NULL,
        collectionMethod TEXT NOT NULL,
        bankAccountId TEXT NOT NULL,
        bankAccountName TEXT,
        amount REAL DEFAULT 0,
        feeAmount REAL DEFAULT 0,
        overpaymentAmount REAL DEFAULT 0,
        netReceivedAmount REAL DEFAULT 0,
        checkNumber TEXT,
        checkDueDate TEXT,
        drawerBank TEXT,
        receivedDate TEXT NOT NULL,
        suspenseId TEXT,
        status TEXT DEFAULT 'POSTED',
        notes TEXT,
        createdBy TEXT,
        createdAt TEXT
      );
    `);
  } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN projectName TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN title TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN lineItemsJson TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN netAmount REAL DEFAULT 0;`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN taxType TEXT DEFAULT 'TAX_EXCLUSIVE';`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN taxAmount REAL DEFAULT 0;`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN hasInvoice INTEGER DEFAULT 1;`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN invoiceFormat TEXT DEFAULT 'THREE_PART';`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN invoiceIssueMode TEXT DEFAULT 'DELIVERED';`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN invoiceNumber TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN invoiceDate TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN notes TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN bouncedCheckNumber TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN bouncedReason TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN bouncedAt TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN createdBy TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE accounts_receivable ADD COLUMN updatedAt TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE fin_ar_collections ADD COLUMN overpaymentAmount REAL DEFAULT 0;`); } catch (_) {}
  try { db.run(`ALTER TABLE bank_checks ADD COLUMN reconciledArId TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE fin_invoices ADD COLUMN invoiceFormat TEXT DEFAULT 'THREE_PART';`); } catch (_) {}
  try { db.run(`ALTER TABLE fin_invoices ADD COLUMN invoiceIssueMode TEXT DEFAULT 'DELIVERED';`); } catch (_) {}
  try { db.run(`ALTER TABLE fin_invoices ADD COLUMN invoiceCategory TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE fin_invoices ADD COLUMN taxPeriod TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE fin_invoices ADD COLUMN presetLabel TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE fin_invoices ADD COLUMN notes TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE fin_invoices ADD COLUMN linkedProjectId TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE fin_invoices ADD COLUMN linkedArId TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE fin_suspense_receipts ADD COLUMN allocatedAmount REAL DEFAULT 0;`); } catch (_) {}
  try { db.run(`ALTER TABLE fin_suspense_receipts ADD COLUMN remainingAmount REAL;`); } catch (_) {}
  try {
    db.run(`
      UPDATE fin_suspense_receipts
      SET allocatedAmount = CASE WHEN isAllocated = 1 THEN amount ELSE COALESCE(allocatedAmount, 0) END,
          remainingAmount = CASE WHEN isAllocated = 1 THEN 0 ELSE COALESCE(remainingAmount, amount - COALESCE(allocatedAmount, 0)) END
      WHERE remainingAmount IS NULL;
    `);
  } catch (_) {}

  // 401 預計請款／預計進項模擬暫估表
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS fin_planned_invoices (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        taxPeriod TEXT NOT NULL,
        invoiceType TEXT DEFAULT 'OUTPUT',
        invoiceCategory TEXT DEFAULT 'SALES_THREE_PART',
        invoiceFormat TEXT DEFAULT 'THREE_PART',
        invoiceIssueMode TEXT DEFAULT 'DELIVERED',
        partnerName TEXT NOT NULL,
        partnerTaxId TEXT,
        linkedProjectId TEXT,
        linkedArId TEXT,
        netAmount REAL DEFAULT 0,
        taxAmount REAL DEFAULT 0,
        totalAmount REAL DEFAULT 0,
        notes TEXT,
        status TEXT DEFAULT 'PLANNED',
        convertedInvoiceId TEXT,
        createdBy TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );
    `);
  } catch (_) {}

  // 各公司年度期初留抵稅額與常用電話門號/台電地址快捷設定
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS fin_company_tax_settings (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        taxYear INTEGER NOT NULL,
        priorYearCreditTax REAL DEFAULT 0,
        phonePresetsJson TEXT,
        electricityPresetsJson TEXT,
        personalVoucherLabel TEXT,
        updatedAt TEXT,
        UNIQUE(companyId, taxYear)
      );
    `);
  } catch (_) {}

  // 已知案場預收款／貸款先撥款／超付溢收直入案場帳表 (不混入未知暫收池)
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS fin_project_advances (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        projectName TEXT,
        customerId TEXT,
        customerName TEXT NOT NULL,
        companyId TEXT NOT NULL,
        bankAccountId TEXT NOT NULL,
        bankAccountName TEXT,
        collectionMethod TEXT DEFAULT 'TT',
        amount REAL DEFAULT 0,
        receivedDate TEXT NOT NULL,
        sourceType TEXT DEFAULT 'EARLY_LOAN',
        sourceArId TEXT,
        sourceCheckNumber TEXT,
        notes TEXT,
        createdBy TEXT,
        createdAt TEXT
      );
    `);
  } catch (_) {}
}
