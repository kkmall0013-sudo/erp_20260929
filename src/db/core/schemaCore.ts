import type { Database } from 'sql.js';

// 核心組織、系統參數、文件金庫、案場與商業夥伴資料表 DDL (Part 1)
export function initializeCoreTables(db: Database): void {
  db.run(`
    -- 0. 三層式帳號架構與自訂群組模組矩陣 (Users, UserGroups, GroupModulePermissions)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      fullName TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL,
      canManageUsers INTEGER DEFAULT 0,
      canManageSystemConfigs INTEGER DEFAULT 0,
      canManageAdmins INTEGER DEFAULT 0,
      canManageAllCompanies INTEGER DEFAULT 0,
      groupId TEXT,
      groupIds TEXT DEFAULT '[]',
      companyGroupAssignments TEXT DEFAULT '[]',
      status TEXT DEFAULT 'ACTIVE',
      title TEXT,
      allowedCompanies TEXT DEFAULT '["COMP-01","COMP-02"]',
      defaultCompanyId TEXT DEFAULT 'COMP-01',
      passwordHash TEXT DEFAULT '888888',
      isPasswordReset INTEGER DEFAULT 0,
      lastLoginAt TEXT,
      deleteStage TEXT DEFAULT 'ACTIVE',
      stageDeletedAt TEXT,
      purgeDueAt TEXT,
      deletedBy TEXT,
      stageNotes TEXT,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS user_groups (
      id TEXT PRIMARY KEY,
      groupCode TEXT UNIQUE NOT NULL,
      groupName TEXT NOT NULL,
      description TEXT,
      isSystem INTEGER DEFAULT 0,
      approvalLimit REAL DEFAULT 0,
      canExport INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS group_module_permissions (
      id TEXT PRIMARY KEY,
      groupId TEXT NOT NULL,
      moduleKey TEXT NOT NULL,
      canRead INTEGER DEFAULT 0,
      canWrite INTEGER DEFAULT 0,
      canApprove INTEGER DEFAULT 0,
      canExport INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      updatedAt TEXT
    );

    -- 1. 公司法人與集團實體 (Company)
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      companyCode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      shortName TEXT,
      entityType TEXT DEFAULT 'CORPORATION',
      parentId TEXT,
      taxId TEXT,
      nationalId TEXT,
      representative TEXT,
      keyPersonnel TEXT DEFAULT '[]',
      documentPrefix TEXT,
      paymentScheduleDays TEXT,
      phones TEXT DEFAULT '[]',
      email TEXT,
      registeredAddress TEXT,
      registeredPostalCode TEXT,
      registeredCity TEXT,
      registeredDistrict TEXT,
      registeredStreetAddress TEXT,
      registeredAddressHistory TEXT DEFAULT '[]',
      contactAddress TEXT,
      contactPostalCode TEXT,
      contactCity TEXT,
      contactDistrict TEXT,
      contactStreetAddress TEXT,
      contactAddressHistory TEXT DEFAULT '[]',
      capitalAmount REAL DEFAULT 0,
      baseCurrency TEXT DEFAULT 'TWD',
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_companies_parent_type ON companies (parentId, entityType, isDeleted);
    CREATE INDEX IF NOT EXISTS idx_companies_code ON companies (companyCode);

    -- 2. 全域參數與審計 (SystemConfig & AuditLog & DocumentSequence & AnnualArchiveSnapshot)
    CREATE TABLE IF NOT EXISTS document_sequences (
      prefix TEXT PRIMARY KEY,
      currentVal INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS document_sequence_rules (
      moduleKey TEXT PRIMARY KEY,
      moduleName TEXT NOT NULL,
      prefix TEXT NOT NULL,
      dateFormat TEXT DEFAULT 'YYYYMM',
      delimiter TEXT DEFAULT '-',
      serialLength INTEGER DEFAULT 3,
      resetFrequency TEXT DEFAULT 'MONTHLY',
      description TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS annual_archive_snapshots (
      id TEXT PRIMARY KEY,
      archiveYear INTEGER NOT NULL,
      archiveFileName TEXT NOT NULL,
      relativePath TEXT NOT NULL,
      recordCount INTEGER DEFAULT 0,
      fileSizeBytes INTEGER DEFAULT 0,
      fileHash TEXT NOT NULL,
      isSealed INTEGER DEFAULT 1,
      sealedAt TEXT NOT NULL,
      sealedBy TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS regulatory_schedules (
      id TEXT PRIMARY KEY,
      configKey TEXT NOT NULL,
      configLabel TEXT NOT NULL,
      scheduledValue TEXT NOT NULL,
      effectiveDate TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SCHEDULED',
      createdBy TEXT,
      createdAt TEXT,
      appliedAt TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS system_files (
      id TEXT PRIMARY KEY,
      targetTable TEXT NOT NULL,
      targetId TEXT NOT NULL,
      fileName TEXT NOT NULL,
      originalName TEXT,
      savedName TEXT,
      fileSizeBytes INTEGER DEFAULT 0,
      mimeType TEXT,
      fileCategory TEXT,
      storagePath TEXT NOT NULL,
      isEncrypted INTEGER DEFAULT 0,
      fileHash TEXT,
      companyId TEXT,
      uploadTime TEXT,
      parentFileId TEXT,
      isObsolete INTEGER DEFAULT 0,
      status TEXT DEFAULT 'NORMAL',
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS external_folder_links (
      id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      projectId TEXT,
      partnerId TEXT,
      targetTable TEXT NOT NULL,
      targetId TEXT NOT NULL,
      nasFolderPath TEXT NOT NULL,
      description TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS file_links (
      id TEXT PRIMARY KEY,
      fileId TEXT NOT NULL,
      companyId TEXT,
      projectId TEXT,
      partnerId TEXT,
      userId TEXT,
      targetTable TEXT NOT NULL,
      targetId TEXT NOT NULL,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_archive_year ON annual_archive_snapshots (archiveYear);
    CREATE INDEX IF NOT EXISTS idx_files_target ON system_files (targetTable, targetId);
    CREATE INDEX IF NOT EXISTS idx_files_hash ON system_files (fileHash);
    CREATE INDEX IF NOT EXISTS idx_file_links_target ON file_links (targetTable, targetId, isDeleted);
    CREATE INDEX IF NOT EXISTS idx_file_links_anchor ON file_links (projectId, partnerId, userId);
    CREATE INDEX IF NOT EXISTS idx_ext_folders_target ON external_folder_links (targetTable, targetId, isDeleted);

    -- 0-1. 軟體程式設定 (AppConfig - Superadmin 專屬)
    CREATE TABLE IF NOT EXISTS app_configs (
      id TEXT PRIMARY KEY,
      configKey TEXT UNIQUE NOT NULL,
      configValue TEXT NOT NULL,
      description TEXT,
      valueType TEXT DEFAULT 'STRING',
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      updatedBy TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS system_configs (
      id TEXT PRIMARY KEY,
      configKey TEXT UNIQUE NOT NULL,
      configValue TEXT NOT NULL,
      description TEXT,
      valueType TEXT DEFAULT 'STRING',
      validFrom TEXT,
      validTo TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      updatedBy TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      userId TEXT,
      userName TEXT,
      action TEXT,
      targetTable TEXT,
      targetId TEXT,
      beforeJson TEXT,
      afterJson TEXT,
      ipAddress TEXT,
      createdAt TEXT
    );

    -- 3. 專案與案場 (Projects, ProjectSites, ProjectWBS)
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      projectCode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      ownerName TEXT NOT NULL,
      ownerTaxId TEXT,
      buildingType TEXT,
      workScope TEXT,
      contractAmount REAL DEFAULT 0,
      budgetAmount REAL DEFAULT 0,
      committedCost REAL DEFAULT 0,
      actualCost REAL DEFAULT 0,
      startDate TEXT,
      endDate TEXT,
      status TEXT DEFAULT 'ACTIVE',
      isLocked INTEGER DEFAULT 0,
      companyId TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS project_sites (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      siteName TEXT NOT NULL,
      address TEXT NOT NULL,
      postalCode TEXT,
      city TEXT,
      district TEXT,
      streetAddress TEXT,
      addressHistory TEXT DEFAULT '[]',
      contactPerson TEXT,
      contactPhone TEXT,
      permitNumber TEXT
    );

    CREATE TABLE IF NOT EXISTS project_wbs (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      nodeCode TEXT NOT NULL,
      nodeName TEXT NOT NULL,
      parentId TEXT,
      budgetAmount REAL DEFAULT 0,
      committedAmount REAL DEFAULT 0,
      actualAmount REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS project_budget_partners (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      partnerId TEXT NOT NULL,
      partnerName TEXT NOT NULL,
      workScope TEXT NOT NULL,
      estimatedAmount REAL DEFAULT 0,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_budget_partners_prj ON project_budget_partners (projectId);

    -- 4. 商業夥伴 (BusinessPartner) 與 料件工項 (Item)
    CREATE TABLE IF NOT EXISTS business_partners (
      id TEXT PRIMARY KEY,
      bpCode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      taxId TEXT NOT NULL,
      entityType TEXT DEFAULT 'CORPORATION',
      type TEXT NOT NULL,
      isCustomer INTEGER DEFAULT 0,
      isVendor INTEGER DEFAULT 1,
      convertedFromVendorId TEXT,
      serviceCategoryMain TEXT,
      serviceCategorySub TEXT,
      serviceCategories TEXT,
      ownerIdNumber TEXT,
      representative TEXT,
      contactPerson TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      bankName TEXT,
      bankCode TEXT,
      bankAccount TEXT,
      bankAccountName TEXT,
      bankFeePayer TEXT DEFAULT 'COMPANY',
      hasInvoice INTEGER DEFAULT 1,
      paymentTermsDays INTEGER DEFAULT 30,
      paymentMethodNotes TEXT,
      isHighRisk INTEGER DEFAULT 0,
      riskReason TEXT,
      currentScore REAL DEFAULT 85,
      status TEXT DEFAULT 'ACTIVE',
      companyId TEXT,
      isDeleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      isIndividual INTEGER DEFAULT 0,
      categoryMain TEXT,
      categorySub TEXT,
      categoryTags TEXT DEFAULT '[]',
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS bp_bank_accounts (
      id TEXT PRIMARY KEY,
      bpId TEXT NOT NULL,
      bankCode TEXT NOT NULL,
      bankName TEXT NOT NULL,
      branchCode TEXT,
      branchName TEXT,
      accountNumber TEXT NOT NULL,
      accountName TEXT NOT NULL,
      isPrimary INTEGER DEFAULT 1,
      passbookFileId TEXT,
      passbookFileData TEXT,
      passbookFiles TEXT,
      isDeleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS partner_addresses (
      id TEXT PRIMARY KEY,
      partnerId TEXT NOT NULL,
      addressType TEXT DEFAULT 'COMMUNICATION',
      label TEXT,
      postalCode TEXT,
      city TEXT,
      district TEXT,
      streetAddress TEXT,
      fullAddress TEXT NOT NULL,
      isHistorical INTEGER DEFAULT 0,
      archivedAt TEXT,
      archiveNote TEXT,
      isDeleted INTEGER DEFAULT 0
    );

    -- 全國郵遞區號縣市主檔 (父層變數：支援縣市更名一鍵連動轄下全部鄉鎮區)
    CREATE TABLE IF NOT EXISTS taiwan_postal_cities (
      id TEXT PRIMARY KEY,
      cityName TEXT UNIQUE NOT NULL,
      aliases TEXT DEFAULT '[]',
      isActive INTEGER DEFAULT 1,
      note TEXT,
      sortOrder INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    -- 全國郵遞區號微型資料庫 (郵局牆上表：支援新增/修改/歷史沿革停用與別名對照)
    CREATE TABLE IF NOT EXISTS taiwan_postal_codes (
      id TEXT PRIMARY KEY,
      cityId TEXT,
      city TEXT NOT NULL,
      district TEXT NOT NULL,
      postalCode TEXT NOT NULL,
      isActive INTEGER DEFAULT 1,
      aliases TEXT DEFAULT '[]',
      replacedByCity TEXT,
      replacedByDistrict TEXT,
      note TEXT,
      sortOrder INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS partner_contacts (
      id TEXT PRIMARY KEY,
      partnerId TEXT NOT NULL,
      contactType TEXT DEFAULT 'PRIMARY',
      name TEXT NOT NULL,
      title TEXT,
      phone TEXT,
      mobile TEXT,
      extension TEXT,
      email TEXT,
      notes TEXT,
      isDeleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS partner_business_cards (
      id TEXT PRIMARY KEY,
      partnerId TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT,
      companyName TEXT,
      phone TEXT,
      mobile TEXT,
      email TEXT,
      address TEXT,
      exchangeDate TEXT,
      cardFrontUrl TEXT,
      cardBackUrl TEXT,
      cardFileType TEXT DEFAULT 'IMAGE',
      notes TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS partner_cheque_records (
      id TEXT PRIMARY KEY,
      partnerId TEXT NOT NULL,
      direction TEXT NOT NULL,
      bankCode TEXT NOT NULL,
      bankName TEXT NOT NULL,
      branchName TEXT,
      accountNumber TEXT NOT NULL,
      checkNumber TEXT NOT NULL,
      receivedDate TEXT,
      issueDate TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      statutoryExpiryDate TEXT,
      amount REAL NOT NULL,
      payeeName TEXT NOT NULL,
      isNonNegotiable INTEGER DEFAULT 1,
      chequeFileId TEXT,
      chequeFileData TEXT,
      chequeFiles TEXT,
      status TEXT DEFAULT 'RECEIVED',
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      itemCode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT,
      unitPrice REAL DEFAULT 0,
      standardCost REAL DEFAULT 0,
      isDeleted INTEGER DEFAULT 0
    );
  `);
}

export function ensureCompanyExtendedColumns(db: Database): void {
  const cols = [
    'paymentScheduleDays TEXT',
    'registeredPostalCode TEXT',
    'registeredCity TEXT',
    'registeredDistrict TEXT',
    'registeredStreetAddress TEXT',
    "registeredAddressHistory TEXT DEFAULT '[]'",
    'contactPostalCode TEXT',
    'contactCity TEXT',
    'contactDistrict TEXT',
    'contactStreetAddress TEXT',
    "contactAddressHistory TEXT DEFAULT '[]'"
  ];
  for (const colDef of cols) {
    try {
      db.run(`ALTER TABLE companies ADD COLUMN ${colDef};`);
    } catch (_) {}
  }
}
