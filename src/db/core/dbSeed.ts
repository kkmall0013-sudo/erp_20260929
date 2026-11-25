import type { Database } from 'sql.js';
import { getDbInstance, notifyListeners, saveDatabaseSnapshot } from './dbContext';
import { seedUserPermissionData } from './dbConstants';
import { ensurePostalCatalogSeeded } from '../repositories/postalCatalogRepository';

// 建立營造工程真實範例資料
export function seedInitialData(db: Database): void {
  const tables = [
    'users', 'user_groups', 'group_module_permissions',
    'app_configs', 'companies', 'system_configs', 'taiwan_postal_cities', 'taiwan_postal_codes', 'regulatory_schedules', 'audit_logs', 'system_files', 'external_folder_links', 'file_links', 'projects', 'project_sites',
    'project_wbs', 'business_partners', 'bp_bank_accounts', 'partner_addresses', 'partner_contacts', 'partner_cheque_records', 'items', 'quotations', 'quotation_revisions',
    'quotation_items', 'quotation_billing_milestones', 'purchase_orders',
    'purchase_order_items', 'inbound_receipts', 'inbound_receipt_items', 'subcontracts', 'valuations', 'valuation_items',
    'accounts_payable', 'accounts_receivable', 'bank_checks'
  ];
  tables.forEach(t => db.run(`DELETE FROM ${t};`));

  seedUserPermissionData(db);
  ensurePostalCatalogSeeded(db);

  // 0-1. 軟體程式設定 (AppConfig - Superadmin 專屬)
  db.run(`
    INSERT INTO app_configs (id, configKey, configValue, description, valueType, isDeleted, version, updatedBy, createdAt, updatedAt)
    VALUES
      ('APP-CFG-01', 'APP_BRAND_NAME', '田頭', '軟體品牌主名稱 (頂部主識別)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-02', 'APP_SUB_TITLE', '營造工程管理雲', '軟體副標題與產品代號', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-03', 'APP_VERSION', 'v2.5.0-PRO', '系統版本號標記', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-04', 'APP_HTML_TITLE', '田頭 | 營造工程雲端 ERP 整合系統', '瀏覽器頁籤分頁標題', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-05', 'APP_WELCOME_BANNER', '歡迎登入營造工程 ERP 整合系統，請透過左側選單操作業務功能。', '儀表板首頁歡迎標語', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-06', 'APP_FOOTER_COPYRIGHT', '© 2026 營造工程雲端 ERP 整合系統 · 保留所有權利', '全系統頁腳版權聲明', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-07', 'APP_GLOBAL_ANNOUNCEMENT', '【系統公告】系統固定於每週日 02:00 ~ 04:00 進行資料庫異地冷備份，期間請勿執行巨量批次寫入。', '全域頂欄緊急廣播/公告內容', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-08', 'APP_ANNOUNCEMENT_ENABLED', 'false', '全域頂欄廣播跑馬燈啟用開關', 'BOOLEAN', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-09', 'APP_ENABLED_MODULES', '["PROJECTS","PARTNERS","QUOTATIONS","PURCHASE_ORDERS","SUBCONTRACTS","VALUATIONS","FINANCE_AP","FINANCE_AR","BANK_CHECKS","VAULT","MINI_APPS"]', '全系統開放業務模組授權清單 (Feature Flags)', 'JSON', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-10', 'APP_MAINTENANCE_MODE', 'false', '全系統維護唯讀模式開關', 'BOOLEAN', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-11', 'APP_LOGO_MODE', 'DEFAULT', '標誌顯示模式 (DEFAULT 內建圖示 / IMAGE 自訂圖片網址 / TEXT 自訂字首徽章)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-12', 'APP_PRIMARY_COLOR', '#2d3a4b', '頂欄主視覺識別色碼', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-13', 'APP_LOGO_IMAGE_URL', '', '自訂 Logo 圖片網址 (可貼圖檔 URL 或 Base64 Data URI)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-14', 'APP_LOGO_TEXT', '田', '自訂 Logo 字首徽章文字 (1~2 個中英文字元)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-15', 'APP_LOGO_BG', '#4f46e5', '自訂 Logo 徽章底色色碼', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-16', 'APP_SYSTEM_NAME', '田頭營造工程雲端 ERP 整合系統', '軟體系統完整中文全稱 (全域自訂品牌)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-17', 'APP_CUSTOMER_BILLING_MODE', 'FINANCE_ONLY', '對外客戶請款／對帳明細表權限流程模式 (FINANCE_ONLY 會計統一 / PROJECT_AND_FINANCE 雙軌授權 / PROJECT_FIRST_HANDOFF 工務送交會計)', 'STRING', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01'),
      ('APP-CFG-18', 'APP_TEST_SANDBOX_PUBLIC', 'false', '對全體帳號開放左側「測試區」開關（僅 Superadmin 可切換；關閉時僅 Superadmin 可見）', 'BOOLEAN', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01');
  `);

  // 1. 公司法人、集團與個人實體
  db.run(`
    INSERT INTO companies (id, companyCode, name, shortName, entityType, parentId, taxId, nationalId, representative, keyPersonnel, documentPrefix, phones, email, registeredAddress, contactAddress, capitalAmount, baseCurrency, isDeleted, version, createdAt, updatedAt)
    VALUES 
      ('GRP-01', 'GRP-TW', '大巨營造事業集團', '大巨集團', 'GROUP', NULL, NULL, NULL, '林大巨 創辦人', '[{"id":"kp-0","title":"集團總裁","name":"林大巨","phone":"0910-123-456"}]', 'GRP', '[]', 'group@daju-group.com.tw', '台北市信義區經貿二路100號', '台北市信義區經貿二路100號28樓', 500000000, 'TWD', 0, 1, '2026-01-01', '2026-01-01'),
      ('COMP-01', 'CMP-TW01', '台灣大巨營造工程股份有限公司', '大巨營造', 'CORPORATION', 'GRP-01', '88991234', NULL, '林大巨 董事長', '[{"id":"kp-1","title":"董事長","name":"林大巨","phone":"0910-123-456"},{"id":"kp-2","title":"總經理","name":"陳國安","phone":"0920-654-321"},{"id":"kp-3","title":"工務特助","name":"黃志明","phone":"0933-778-899"}]', 'DJ', '[{"id":"p1","type":"市話","number":"02-2720-8888"},{"id":"p2","type":"傳真","number":"02-2720-9999"},{"id":"p3","type":"工務專線","number":"0910-123-456"}]', 'service@daju-eng.com.tw', '台北市信義區經貿二路100號5樓', '台北市信義區經貿二路100號5樓', 150000000, 'TWD', 0, 1, '2026-01-01', '2026-01-01'),
      ('COMP-02', 'CMP-TW02', '宏達機電工程股份有限公司', '宏達機電', 'CORPORATION', 'GRP-01', '54329876', NULL, '陳總經理', '[{"id":"kp-4","title":"總經理","name":"陳志豪","phone":"0928-888-999"}]', 'HD', '[{"id":"p4","type":"市話","number":"02-8950-6677"}]', 'mep@hongda-eng.com.tw', '新北市板橋區縣民大道二段68號', '新北市板橋區縣民大道二段68號12樓', 50000000, 'TWD', 0, 1, '2026-01-01', '2026-01-01'),
      ('BOSS-01', 'BOSS-01', '林董私人調度資金戶', '林董私帳', 'PERSONAL', 'GRP-01', NULL, 'A123456789', '林大巨', '[]', 'BOSS', '[]', NULL, NULL, NULL, 0, 'TWD', 0, 1, '2026-01-01', '2026-01-01');
  `);

  // 2. 系統全域參數
  db.run(`
    INSERT INTO system_configs (id, configKey, configValue, description, valueType, validFrom, isDeleted, version, updatedBy, createdAt, updatedAt)
    VALUES
      ('CFG-01', 'TAX_RATE', '0.05', '法定營業稅率 (預設 5%)', 'NUMBER', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-02', 'FIN_TAX_TOLERANCE', '5.0', '發票稅額尾差容許值 (新台幣元)', 'NUMBER', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-03', 'DEFAULT_RETENTION_RATE', '10.0', '工程估驗預設保留款扣留比例 (%)', 'NUMBER', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-04', 'PROJECT_LOCK_MODE', 'STRICT', '案場超支預算防呆鎖定模式 (STRICT 嚴格阻擋 / WARN 警示放行)', 'STRING', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-05', 'NHI_RATE', '0.0211', '二代健保補充保費法定扣繳費率', 'NUMBER', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-06', 'PAYMENT_TERM_DAYS', '30', '預設請款票期 / 付款天數 (天)', 'NUMBER', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-07', 'WARRANTY_MONTHS', '12', '預設工程保固期 (月數)', 'NUMBER', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-08', 'MINIMUM_WAGE', '28590', '法定最低月薪基本工資 (新台幣元)', 'NUMBER', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-09', 'PAYMENT_SCHEDULE_DAYS', '7,17,27', '預設每月固定付款日規則 (多日以逗號分隔，如 7,17,27)', 'STRING', '2026-01-01', 0, 1, '黃副總經理', '2026-01-01', '2026-01-01'),
      ('CFG-10', 'BOSS_ACCOUNT_INVOICE_POLICY', 'STRICT_INVOICE_MATCH', '有發票單據是否允許老闆私帳代墊政策 (STRICT_INVOICE_MATCH 做法1嚴格防呆 / ALLOW_BOSS_ADVANCE 做法2可勾選特例代墊)', 'STRING', '2026-01-01', 0, 1, 'SUPERADMIN', '2026-01-01', '2026-01-01');
  `);

  // 法規預約生效排程預設項目
  db.run(`
    INSERT INTO regulatory_schedules (id, configKey, configLabel, scheduledValue, effectiveDate, status, createdBy, createdAt, notes)
    VALUES
      ('SCHED-01', 'MINIMUM_WAGE', '法定最低月薪基本工資', '29500', '2027-01-01 00:00:00', 'SCHEDULED', '系統預排', '2026-01-01 00:00:00', '2027/01/01 法定最低基本工資調整預排 (由 28,590 調升至 29,500 元)');
  `);

  // 3. 商業夥伴 (業主、混凝土下包、鋼構廠、弱電機電)
  db.run(`
    INSERT INTO business_partners (id, bpCode, name, taxId, entityType, type, isCustomer, isVendor, convertedFromVendorId, serviceCategoryMain, serviceCategorySub, ownerIdNumber, representative, contactPerson, phone, email, address, bankName, bankCode, bankAccount, bankAccountName, bankFeePayer, hasInvoice, paymentTermsDays, isHighRisk, riskReason, currentScore, status, companyId, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('BP-01', 'CUST-001', '富鼎置地開發建設股份有限公司', '12345678', 'CORPORATION', 'CUSTOMER', 1, 0, NULL, NULL, NULL, 'A123456789', '陳大為 董事長', '陳大為 總監', '02-2712-8888', 'contact@fuding.com.tw', '台北市信義區松高路100號', '中國信託商業銀行', '822', '123456789012', '富鼎置地開發建設股份有限公司', 'COMPANY', 1, 45, 0, NULL, 92, 'ACTIVE', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01'),
      ('BP-02', 'CUST-002', '國揚高新科技園區開發股份有限公司', '23456789', 'CORPORATION', 'CUSTOMER', 1, 0, NULL, NULL, NULL, 'B120987654', '林志祥 總經理', '林志祥 副總', '03-5712-9999', 'service@guoyang.com.tw', '新竹市東區公道五路二段50號', '國泰世華商業銀行', '013', '234567890123', '國揚高新科技園區開發股份有限公司', 'COMPANY', 1, 60, 0, NULL, 88, 'ACTIVE', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01'),
      ('BP-03', 'VEND-001', '台灣水泥股份有限公司 (台北營業所)', '03754904', 'CORPORATION', 'VENDOR', 0, 1, NULL, '營建材料原物料供料商', '預拌混凝土出料', 'A100987654', '張安平 董事長', '黃經理', '02-2567-8899', 'orders@taiwancement.com', '台北市中山北路二段113號', '臺灣銀行', '004', '004001234567', '台灣水泥股份有限公司', 'COMPANY', 1, 30, 0, NULL, 95, 'ACTIVE', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01'),
      ('BP-04', 'VEND-002', '中鋼結構工程股份有限公司', '86512390', 'CORPORATION', 'VENDOR', 0, 1, NULL, '基礎與結構工程', '鋼骨結構工程 (SC/SRC)', 'E123456780', '陳瑞騰 總經理', '周工程師', '07-616-8800', 'steel@csbc.com.tw', '高雄市小港區中鋼路1號', '兆豐國際商業銀行', '017', '017009876543', '中鋼結構工程股份有限公司', 'COMPANY', 1, 30, 0, NULL, 96, 'ACTIVE', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01'),
      ('BP-05', 'SUB-001', '合眾基礎連續壁深開挖工程行', '78901234', 'CORPORATION', 'SUBCONTRACTOR', 0, 1, NULL, '基礎與結構工程', '連續壁工程', 'F124567891', '張添進 負責人', '張添進 負責人', '0912-345-678', 'hezhong@tunnel.tw', '新北市五股區成泰路三段12號', '第一商業銀行', '007', '007001928374', '合眾基礎連續壁深開挖工程行', 'COMPANY', 1, 15, 0, NULL, 90, 'ACTIVE', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01'),
      ('BP-06', 'SUB-002', '億翔機電弱電工程企業社', '45678901', 'CORPORATION', 'SUBCONTRACTOR', 0, 1, NULL, '水電消防與空調機電', '智慧弱電/網路/監視門禁', 'H123456782', '李文發 負責人', '李文發', '0933-888-777', 'yixiang@mep.tw', '桃園市蘆竹區中正北路88號', '玉山商業銀行', '808', '808006543210', '億翔機電弱電工程企業社', 'COMPANY', 1, 30, 1, '曾有工程逾期爭議紀錄，發包前需副總以上特許核可', 72, 'WARNING', 'COMP-01', 0, 1, '2026-01-01', '2026-01-01');

    INSERT INTO bp_bank_accounts (id, bpId, bankCode, bankName, branchCode, branchName, accountNumber, accountName, isPrimary, isDeleted)
    VALUES
      ('BACC-01', 'BP-01', '822', '中國信託商業銀行', '0822', '松高分行', '123456789012', '富鼎置地開發建設股份有限公司', 1, 0),
      ('BACC-02', 'BP-02', '013', '國泰世華商業銀行', '0135', '新竹分行', '234567890123', '國揚高新科技園區開發股份有限公司', 1, 0),
      ('BACC-03', 'BP-03', '004', '臺灣銀行', '0041', '群賢分行', '004001234567', '台灣水泥股份有限公司', 1, 0),
      ('BACC-04', 'BP-04', '017', '兆豐國際商業銀行', '0178', '小港分行', '017009876543', '中鋼結構工程股份有限公司', 1, 0),
      ('BACC-05', 'BP-05', '007', '第一商業銀行', '0073', '五股分行', '007001928374', '合眾基礎連續壁深開挖工程行', 1, 0),
      ('BACC-06', 'BP-06', '808', '玉山商業銀行', '8082', '蘆竹分行', '808006543210', '億翔機電弱電工程企業社', 1, 0);

    INSERT INTO partner_addresses (id, partnerId, addressType, label, fullAddress, isDeleted)
    VALUES
      ('PADDR-01', 'BP-01', 'COMMUNICATION', '台北總部', '台北市信義區松高路100號18樓', 0),
      ('PADDR-02', 'BP-02', 'COMMUNICATION', '新竹辦公室', '新竹市東區公道五路二段50號6樓', 0),
      ('PADDR-03', 'BP-03', 'COMMUNICATION', '台北營業所', '台北市中山北路二段113號', 0),
      ('PADDR-04', 'BP-03', 'FACTORY', '八里預拌混凝土廠', '新北市八里區中山路三段55號', 0),
      ('PADDR-05', 'BP-04', 'COMMUNICATION', '小港總廠', '高雄市小港區中鋼路1號', 0),
      ('PADDR-06', 'BP-04', 'FACTORY', '燕巢鋼構加工廠', '高雄市燕巢區角宿路120號', 0),
      ('PADDR-07', 'BP-05', 'COMMUNICATION', '工務通訊處', '新北市五股區成泰路三段12號', 0),
      ('PADDR-08', 'BP-06', 'COMMUNICATION', '蘆竹總部', '桃園市蘆竹區中正北路88號', 0);

    INSERT INTO partner_contacts (id, partnerId, contactType, name, title, phone, mobile, extension, email, notes, isDeleted)
    VALUES
      ('PCON-01', 'BP-01', 'PRIMARY', '陳大為', '開發處總監', '02-2712-8888', '0910-888-999', '101', 'contact@fuding.com.tw', '主要商務合約決策人', 0),
      ('PCON-02', 'BP-01', 'FINANCE', '林雅婷', '財務經理', '02-2712-8888', '0922-111-222', '108', 'finance@fuding.com.tw', '請款發票對帳窗口', 0),
      ('PCON-03', 'BP-02', 'PRIMARY', '林志祥', '工程處副總', '03-5712-9999', '0935-777-666', '201', 'service@guoyang.com.tw', '竹科專案負責人', 0),
      ('PCON-04', 'BP-03', 'SALES', '黃經理', '業務部副理', '02-2567-8899', '0918-222-333', '302', 'orders@taiwancement.com', '混凝土調度及磅單核對窗口', 0),
      ('PCON-05', 'BP-04', 'ENGINEERING', '周工程師', '工務處工程師', '07-616-8800', '0921-333-444', '512', 'steel@csbc.com.tw', '鋼構圖面深化審查及吊裝排程', 0),
      ('PCON-06', 'BP-05', 'PRIMARY', '張添進', '負責人', '02-2292-1234', '0912-345-678', '', 'hezhong@tunnel.tw', '連續壁開挖現場工頭指揮', 0),
      ('PCON-07', 'BP-06', 'PRIMARY', '李文發', '負責人', '03-311-2233', '0933-888-777', '', 'yixiang@mep.tw', '弱電工程統籌', 0);

    INSERT INTO partner_cheque_records (id, partnerId, direction, bankCode, bankName, accountNumber, checkNumber, issueDate, dueDate, amount, payeeName, isNonNegotiable, status, notes, createdAt, updatedAt)
    VALUES
      ('PCHK-01', 'BP-01', 'RECEIPT', '013', '國泰世華銀行', '234567890123', 'RC-990011', '2026-02-20', '2026-03-15', 17850000, '台灣大巨營造工程股份有限公司', 1, 'CLEARED', '合約首期訂金票據（已兌現入帳）', '2026-02-20', '2026-03-15'),
      ('PCHK-02', 'BP-03', 'PAYMENT', '822', '中國信託商業銀行', '123456789012', 'CQ-882201', '2026-03-05', '2026-04-30', 10080000, '台灣水泥股份有限公司', 1, 'CLEARED', '南港商辦案 3 月份預拌混凝土貨款（已兌現結清）', '2026-03-05', '2026-04-30'),
      ('PCHK-03', 'BP-04', 'PAYMENT', '004', '臺灣銀行', '004001234567', 'CQ-882203', '2026-04-05', '2026-05-31', 5000000, '中鋼結構工程股份有限公司', 1, 'ISSUED', '鋼構首批吊裝到場期票（未到期）', '2026-04-05', '2026-04-05'),
      ('PCHK-04', 'BP-05', 'PAYMENT', '822', '中國信託商業銀行', '123456789012', 'CQ-882202', '2026-04-01', '2026-05-15', 3727500, '合眾基礎連續壁深開挖工程行', 1, 'ISSUED', '第 1 期估驗尾款開立 45 天期票', '2026-04-01', '2026-04-01');
  `);

  // 4. 專案工程與案場 (Projects, ProjectSites, ProjectWBS)
  db.run(`
    INSERT INTO projects (id, projectCode, name, ownerName, ownerTaxId, buildingType, workScope, contractAmount, budgetAmount, committedCost, actualCost, startDate, endDate, status, isLocked, companyId, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('PRJ-01', 'PRJ-2026-001', '台北南港經貿園區商辦總部新建工程', '富鼎置地開發建設股份有限公司', '12345678', '商辦金融大樓', '統包新建工程', 85000000, 72000000, 48000000, 31500000, '2026-02-01', '2027-12-31', 'ACTIVE', 0, 'COMP-01', 0, 1, '2026-02-01', '2026-02-01'),
      ('PRJ-02', 'PRJ-2026-002', '新竹科技園區精密廠房無塵室機電擴建專案', '國揚高新科技園區開發股份有限公司', '23456789', '廠辦與工業廠房', '室內裝修與機電消防工程', 42000000, 36000000, 29000000, 14200000, '2026-03-15', '2027-06-30', 'ACTIVE', 0, 'COMP-01', 0, 1, '2026-03-15', '2026-03-15'),
      ('PRJ-03', 'PRJ-2026-003', '新北新莊副都心商業住宅地基連續壁基礎工程', '富鼎置地開發建設股份有限公司', '12345678', '集合住宅大樓', '連續壁與擋土排樁工程', 19800000, 17500000, 16000000, 8900000, '2026-01-10', '2026-08-31', 'ACTIVE', 0, 'COMP-01', 0, 1, '2026-01-10', '2026-01-10');

    INSERT INTO project_sites (id, projectId, siteName, address, contactPerson, contactPhone, permitNumber)
    VALUES
      ('SITE-01', 'PRJ-01', '南港總部基地案場', '台北市南港區經貿二路168號工地所', '王志豪 PM', '0921-111-222', '114建字第0888號'),
      ('SITE-02', 'PRJ-02', '竹科三期廠房案場', '新竹科學園區研新四路6號', '陳國慶 工務主任', '0935-333-444', '115竹科建字第0123號');

    INSERT INTO project_wbs (id, projectId, nodeCode, nodeName, parentId, budgetAmount, committedAmount, actualAmount)
    VALUES
      ('WBS-01', 'PRJ-01', 'WBS-100', '地下一至四層開挖及連續壁工程', NULL, 18000000, 16500000, 15000000),
      ('WBS-02', 'PRJ-01', 'WBS-200', '主體SRC鋼骨與混凝土澆置工程', NULL, 34000000, 22500000, 11000000),
      ('WBS-03', 'PRJ-01', 'WBS-300', '機電、消防、弱電智慧控制工程', NULL, 20000000, 9000000, 5500000);
  `);

  // 5. 報價單 (Quotation CPQ Engine)
  db.run(`
    INSERT INTO quotations (id, quoteNumber, projectId, customerId, customerName, companyId, currency, netAmount, taxAmount, totalAmount, discountAmount, currentRevision, status, validityDate, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('QUO-01', 'QT-2026-0018', 'PRJ-01', 'BP-01', '富鼎置地開發建設股份有限公司', 'COMP-01', 'TWD', 85000000, 4250000, 89250000, 500000, 'REV-B', 'ACCEPTED', '2026-04-30', 0, 2, '2026-01-15', '2026-01-28');

    INSERT INTO quotation_revisions (id, quotationId, revisionCode, netAmount, taxAmount, totalAmount, isWinning, lostReason, createdAt)
    VALUES
      ('QREV-01', 'QUO-01', 'REV-A', 88000000, 4400000, 92400000, 0, '業主要求價格回饋 300 萬，修正後發布 REV-B', '2026-01-15'),
      ('QREV-02', 'QUO-01', 'REV-B', 85000000, 4250000, 89250000, 1, NULL, '2026-01-28');

    INSERT INTO quotation_items (id, quotationId, revisionCode, itemType, itemName, spec, quantity, unit, unitPrice, lineTotal, remark)
    VALUES
      ('QIT-01', 'QUO-01', 'REV-B', 'NORMAL', '地下室開挖與連續壁特種工程', '深度35米/厚度100cm', 1, '式', 18000000, 18000000, '含出土運棄'),
      ('QIT-02', 'QUO-01', 'REV-B', 'NORMAL', '高強度 5000psi 預拌混凝土材料澆置', '抗硫耐鹽配比', 15000, '立方米', 2400, 36000000, '台泥指定料源'),
      ('QIT-03', 'QUO-01', 'REV-B', 'NORMAL', '主結構耐震鋼骨 SN490C 加工吊裝', '含超音波銲道檢驗', 650, '噸', 48000, 31200000, '中鋼構直發'),
      ('QIT-04', 'QUO-01', 'REV-B', 'DEDUCTION', '業主首期簽約專案折讓優惠 (粉紅扣款)', '合約議定大額工程折扣', 1, '式', 500000, 500000, '憲法零負數規則：正數保存，底層自動減除');

    INSERT INTO quotation_billing_milestones (id, quotationId, stageIndex, stageName, percentage, estimatedDate, amount)
    VALUES
      ('QMS-01', 'QUO-01', 1, '第一期：簽約訂金與工區點收動員款', 20.0, '2026-02-15', 17850000),
      ('QMS-02', 'QUO-01', 2, '第二期：地下室連續壁完工與土方開挖完成', 30.0, '2026-06-30', 26775000),
      ('QMS-03', 'QUO-01', 3, '第三期：主體結構上樑點收', 30.0, '2027-02-28', 26775000),
      ('QMS-04', 'QUO-01', 4, '第四期：使用執照取得與業主驗收尾款', 20.0, '2027-12-31', 17850000);
  `);

  // 6. 採購單 (PurchaseOrder)
  db.run(`
    INSERT INTO purchase_orders (id, poNumber, companyId, projectId, vendorId, currency, netAmount, taxAmount, totalAmount, discountAmount, retentionDeductionAmount, postedTaxRate, counterpartyNameSnapshot, counterpartyTaxIdSnapshot, projectNameSnapshot, isPrepaidDeduction, prepaidDeductionAmount, status, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('PO-01', 'PO-202603-0001', 'COMP-01', 'PRJ-01', 'BP-03', 'TWD', 9600000, 480000, 10080000, 0, 0, 0.05, '台灣水泥股份有限公司 (台北營業所)', '03754904', '台北南港經貿園區商辦總部新建工程', 0, 0, 'POSTED', 0, 1, '2026-03-01', '2026-03-01'),
      ('PO-02', 'PO-202603-0002', 'COMP-01', 'PRJ-01', 'BP-04', 'TWD', 15600000, 780000, 16380000, 0, 0, 0.05, '中鋼結構工程股份有限公司', '86512390', '台北南港經貿園區商辦總部新建工程', 1, 3000000, 'POSTED', 0, 1, '2026-03-05', '2026-03-05'),
      ('PO-03', 'PO-202604-0003', 'COMP-01', 'PRJ-02', 'BP-03', 'TWD', 4800000, 240000, 5040000, 0, 0, 0.05, '台灣水泥股份有限公司 (台北營業所)', '03754904', '新竹科技園區精密廠房無塵室機電擴建專案', 0, 0, 'DRAFT', 0, 1, '2026-04-10', '2026-04-10');

    INSERT INTO purchase_order_items (id, purchaseOrderId, itemCode, itemName, spec, quantity, unit, unitPrice, lineTotal)
    VALUES
      ('POI-01', 'PO-01', 'MAT-CONC-5000', '5000psi 自充填混凝土', '抗壓強度>350kgf/cm2', 4000, '立方米', 2400, 9600000),
      ('POI-02', 'PO-02', 'MAT-STEEL-SN', 'SN490C 特種耐震 H型鋼', '符合CNS標準合格銲材', 325, '噸', 48000, 15600000);
  `);

  // 6-1. 現場進貨簽收單種子資料
  db.run(`
    INSERT INTO inbound_receipts (id, receiptNumber, companyId, projectId, projectNameSnapshot, vendorId, vendorNameSnapshot, vendorTaxIdSnapshot, deliveryNoteNumber, receivedDate, receivedBy, totalAmount, billingStatus, reconciliationId, reconciliationNumber, purchaseOrderId, status, attachmentFileId, attachmentFileName, notes, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('INB-01', 'INB-202603-0001', 'COMP-01', 'PRJ-01', '台北南港經貿園區商辦總部新建工程', 'BP-03', '台灣水泥股份有限公司 (台北營業所)', '03754904', 'TC-889922', '2026-03-12', '林工務主任', 288000, 'PENDING_BILLING', NULL, NULL, 'PO-01', 'POSTED', 'FILE-01', '台泥送貨簽收單_TC889922.pdf', '南港案B2底板澆置第一批點收無誤，坍度測試 18cm 合格', 0, 1, '2026-03-12 10:30:00', '2026-03-12 10:30:00'),
      ('INB-02', 'INB-202603-0002', 'COMP-01', 'PRJ-01', '台北南港經貿園區商辦總部新建工程', 'BP-03', '台灣水泥股份有限公司 (台北營業所)', '03754904', 'TC-890105', '2026-03-18', '林工務主任', 360000, 'PENDING_BILLING', NULL, NULL, 'PO-01', 'POSTED', NULL, NULL, '南港案B2底板澆置第二批，現場已簽收磅單留存工務所', 0, 1, '2026-03-18 14:15:00', '2026-03-18 14:15:00'),
      ('INB-03', 'INB-202603-0003', 'COMP-01', 'PRJ-01', '台北南港經貿園區商辦總部新建工程', 'BP-04', '中鋼結構工程股份有限公司', '86512390', 'CSC-202603-77', '2026-03-22', '周工務專員', 1200000, 'PENDING_BILLING', NULL, NULL, 'PO-02', 'POSTED', NULL, NULL, '首批地下柱核心構件吊裝進場，附出廠檢驗證明', 0, 1, '2026-03-22 09:00:00', '2026-03-22 09:00:00'),
      ('INB-04', 'INB-202604-0004', 'COMP-01', 'PRJ-02', '新竹科技園區精密廠房無塵室機電擴建專案', 'BP-03', '台灣水泥股份有限公司 (台北營業所)', '03754904', 'TC-910022', '2026-04-10', '張現場監工', 176000, 'PENDING_BILLING', NULL, NULL, 'PO-03', 'DRAFT', NULL, NULL, '無塵室基座地坪填平用，現場初點簽單，待主任覆核', 0, 1, '2026-04-10 11:20:00', '2026-04-10 11:20:00');

    INSERT INTO inbound_receipt_items (id, receiptId, itemCode, itemName, spec, unit, quantity, unitPrice, lineTotal, notes)
    VALUES
      ('INBI-01', 'INB-01', 'MAT-CONC-5000', '5000psi 自充填混凝土', '抗壓強度>350kgf/cm2', '立方米', 120, 2400, 288000, '出料車號 223-AB ~ 235-AB 共 12 車'),
      ('INBI-02', 'INB-02', 'MAT-CONC-5000', '5000psi 自充填混凝土', '抗壓強度>350kgf/cm2', '立方米', 150, 2400, 360000, '連續澆置作業'),
      ('INBI-03', 'INB-03', 'MAT-STEEL-SN', 'SN490C 特種耐震 H型鋼', '符合CNS標準合格銲材', '噸', 25, 48000, 1200000, '進場吊料 4 車'),
      ('INBI-04', 'INB-04', 'MAT-CONC-3000', '3000psi 預拌混凝土', '抗壓強度>210kgf/cm2', '立方米', 80, 2200, 176000, '機房基座回填');
  `);

  // 7. 下包合約與估驗計價
  db.run(`
    INSERT INTO subcontracts (id, contractCode, projectId, subcontractorId, companyId, subcontractorName, projectName, contractName, totalAmount, retentionRate, prepaidAmount, prepaidRemaining, startDate, endDate, status)
    VALUES
      ('SUB-CTR-01', 'SC-2026-008', 'PRJ-01', 'BP-05', 'COMP-01', '合眾基礎連續壁深開挖工程行', '台北南港經貿園區商辦總部新建工程', '連續壁導溝開挖與特密管澆置工程承攬約', 15000000, 10.0, 1500000, 500000, '2026-02-15', '2026-06-30', 'ACTIVE');

    INSERT INTO valuations (id, valuationNumber, subcontractId, projectId, subcontractorId, companyId, periodIndex, periodName, cumulativeProgressPct, grossAmount, retentionDeductionAmount, prepaidDeductionAmount, otherDeductionAmount, netPayableAmount, taxAmount, totalAmount, status, counterpartyNameSnapshot, projectNameSnapshot, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('VAL-01', 'VAL-202603-01', 'SUB-CTR-01', 'PRJ-01', 'BP-05', 'COMP-01', 1, '第 1 期 (導溝施作與出土 30%)', 30.0, 4500000, 450000, 500000, 0, 3550000, 177500, 3727500, 'POSTED', '合眾基礎連續壁深開挖工程行', '台北南港經貿園區商辦總部新建工程', 0, 1, '2026-03-25', '2026-03-28'),
      ('VAL-02', 'VAL-202604-02', 'SUB-CTR-01', 'PRJ-01', 'BP-05', 'COMP-01', 2, '第 2 期 (深開挖特密管澆置 60%)', 60.0, 4500000, 450000, 500000, 50000, 3500000, 175000, 3675000, 'SUBMITTED', '合眾基礎連續壁深開挖工程行', '台北南港經貿園區商辦總部新建工程', 0, 1, '2026-04-20', '2026-04-20');

    INSERT INTO valuation_items (id, valuationId, itemType, itemName, unit, contractQuantity, contractUnitPrice, previousQty, currentQty, currentAmount, remark)
    VALUES
      ('VIT-01', 'VAL-01', 'NORMAL', '地下室連續壁鋼筋籠組裝吊放', '支', 50, 40000, 0, 20, 800000, '第一區完成點收'),
      ('VIT-02', 'VAL-01', 'NORMAL', '特密管水中混凝土澆置', '立方米', 2500, 1480, 0, 2500, 3700000, '經試驗棒取樣合格'),
      ('VIT-03', 'VAL-02', 'DEDUCTION', '工區洗車台廢水未沉澱環保罰鍰扣款 (粉紅扣款)', '式', 1, 50000, 0, 1, 50000, '現場罰單轉嫁下包吸收扣減');
  `);

  // 8. 財務應收付憑單與票據
  db.run(`
    INSERT INTO accounts_payable (id, apNumber, sourceTable, sourceId, companyId, vendorId, vendorName, originalAmount, appliedAmount, remainingAmount, dueDate, invoiceNumber, taxReportingCompanyId, status, createdAt)
    VALUES
      ('AP-01', 'AP-202603-001', 'PURCHASE_ORDER', 'PO-01', 'COMP-01', 'BP-03', '台灣水泥股份有限公司 (台北營業所)', 10080000, 10080000, 0, '2026-04-30', 'AB-88992211', 'COMP-01', 'PAID', '2026-03-01'),
      ('AP-02', 'AP-202603-002', 'VALUATION', 'VAL-01', 'COMP-01', 'BP-05', '合眾基礎連續壁深開挖工程行', 3727500, 0, 3727500, '2026-05-15', 'CD-44556677', 'COMP-01', 'OPEN', '2026-03-28'),
      ('AP-03', 'AP-202604-003', 'PURCHASE_ORDER', 'PO-02', 'COMP-01', 'BP-04', '中鋼結構工程股份有限公司', 16380000, 5000000, 11380000, '2026-05-31', 'EF-99887766', 'COMP-01', 'PARTIAL', '2026-03-05');

    INSERT INTO accounts_receivable (id, arNumber, projectId, customerId, customerName, companyId, amount, appliedAmount, remainingAmount, dueDate, status, createdAt)
    VALUES
      ('AR-01', 'AR-202602-001', 'PRJ-01', 'BP-01', '富鼎置地開發建設股份有限公司', 'COMP-01', 17850000, 17850000, 0, '2026-03-15', 'COLLECTED', '2026-02-15'),
      ('AR-02', 'AR-202604-002', 'PRJ-01', 'BP-01', '富鼎置地開發建設股份有限公司', 'COMP-01', 26775000, 0, 26775000, '2026-06-30', 'OPEN', '2026-04-01');

    INSERT INTO bank_checks (id, checkNumber, type, companyId, counterpartyName, amount, issueDate, dueDate, bankName, status, voidReason, notes)
    VALUES
      ('CHK-01', 'CQ-882201', 'PAYABLE', 'COMP-01', '台灣水泥股份有限公司', 10080000, '2026-03-05', '2026-04-30', '中國信託松高分行', 'CLEARED', NULL, '已於 4/30 兌現結清'),
      ('CHK-02', 'CQ-882202', 'PAYABLE', 'COMP-01', '合眾基礎連續壁深開挖工程行', 3727500, '2026-04-01', '2026-05-15', '中國信託松高分行', 'ISSUED', NULL, '第 1 期估驗尾款開立 45 天期票'),
      ('CHK-03', 'CQ-882203', 'PAYABLE', 'COMP-01', '中鋼結構工程股份有限公司', 5000000, '2026-04-05', '2026-05-31', '台灣銀行群賢分行', 'ISSUED', NULL, '鋼構首批吊裝到場期票'),
      ('CHK-04', 'RC-990011', 'RECEIVABLE', 'COMP-01', '富鼎置地開發建設股份有限公司', 17850000, '2026-02-20', '2026-03-15', '國泰世華銀行', 'CLEARED', NULL, '合約訂金票據已全數兌現入帳');
  `);

  // 9. 審計日誌
  db.run(`
    INSERT INTO audit_logs (id, userId, userName, action, targetTable, targetId, beforeJson, afterJson, ipAddress, createdAt)
    VALUES
      ('LOG-01', '最高管理者', '黃副總經理', '登入系統', '同仁帳號', '黃副總經理', NULL, '{"權限身分":"最高管理者","登入設備":"工務處電腦"}', '公司內網', '2026-03-31 08:30:15'),
      ('LOG-02', '系統管理員', '陳資訊主任', '登入系統', '同仁帳號', '陳資訊主任', NULL, '{"權限身分":"系統管理員","登入設備":"資訊處電腦"}', '公司內網', '2026-03-31 09:05:22'),
      ('LOG-03', '系統管理員', '陳資訊主任', '新增資料', '同仁帳號', '王採購專員', NULL, '{"同仁姓名":"王採購專員","權限角色":"一般同仁","所屬業務群組":"採購發包組"}', '公司內網', '2026-03-31 09:30:00'),
      ('LOG-04', '一般同仁', '林工務主任', '登入系統', '同仁帳號', '林工務主任', NULL, '{"權限身分":"一般同仁","登入設備":"南港工地現場平板"}', '工地內網', '2026-03-31 10:12:00'),
      ('LOG-05', '最高管理者', '黃副總經理', '單據過帳', '採購單', '南港案預拌混凝土採購單', '{"單據狀態":"已核准"}', '{"單據狀態":"已過帳"}', '公司內網', '2026-03-31 10:15:00'),
      ('LOG-06', '一般同仁', '張會計長', '登入系統', '同仁帳號', '張會計長', NULL, '{"權限身分":"一般同仁","登入設備":"財務室電腦"}', '公司內網', '2026-03-31 11:20:00'),
      ('LOG-07', '一般同仁', '張會計長', '單據過帳', '估驗計價單', '連續壁工程第一期估驗單', '{"單據狀態":"已送審"}', '{"單據狀態":"已過帳"}', '公司內網', '2026-03-31 14:40:00'),
      ('LOG-08', '最高管理者', '黃副總經理', '修改資料', '同仁帳號', '陳資訊主任', '{"帳號管理專人特許":"關閉"}', '{"帳號管理專人特許":"開啟"}', '公司內網', '2026-03-31 15:10:00');
  `);

  // 10. 無紙化附件金庫與 NAS 工作桌種子資料
  db.run(`
    INSERT INTO system_files (id, targetTable, targetId, fileName, originalName, savedName, fileSizeBytes, mimeType, fileCategory, storagePath, isEncrypted, fileHash, companyId, uploadTime, parentFileId, isObsolete, status, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('FILE-01', 'subcontracts', 'SUB-CTR-01', '南港商辦連續壁基礎承攬主合約正本.pdf', '連續壁主合約_印鑑用印本.pdf', 'FILE-01', 3421800, 'application/pdf', '正式合約', 'storage/secure_vault/2026/03/FILE-01.enc', 1, 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0', 'COMP-01', '2026-03-01 09:15:00', NULL, 0, 'NORMAL', 0, 1, '2026-03-01', '2026-03-01'),
      ('FILE-02', 'subcontracts', 'SUB-CTR-01', '連續壁基礎承攬主合約補充協議書_RevB.pdf', '補充協議書_經理覆核版.pdf', 'FILE-02', 1542000, 'application/pdf', '補充條款', 'storage/secure_vault/2026/03/FILE-02.enc', 1, 'b2c3d4e5f6a17890123456789abcdef0123456789abcdef0123456789abcdef1', 'COMP-01', '2026-03-15 14:20:00', 'FILE-01', 0, 'NORMAL', 0, 1, '2026-03-15', '2026-03-15'),
      ('FILE-03', 'business_partners', 'BP-05', '合眾基礎工程_公司銀行存摺封面.webp', '合眾基礎_中信松高存摺.jpg', 'FILE-03', 285400, 'image/webp', '存摺影本', 'storage/public_docs/2026/03/FILE-03.webp', 0, 'c3d4e5f6a1b27890123456789abcdef0123456789abcdef0123456789abcdef2', 'COMP-01', '2026-03-02 11:30:00', NULL, 0, 'NORMAL', 0, 1, '2026-03-02', '2026-03-02'),
      ('FILE-04', 'valuations', 'VAL-01', '南港案第一期估驗計價統一發票_CD44556677.pdf', '發票掃描件_CD44556677.pdf', 'FILE-04', 892000, 'application/pdf', '會計發票', 'storage/secure_vault/2026/03/FILE-04.enc', 1, 'd4e5f6a1b2c37890123456789abcdef0123456789abcdef0123456789abcdef3', 'COMP-01', '2026-03-28 16:45:00', NULL, 0, 'NORMAL', 0, 1, '2026-03-28', '2026-03-28'),
      ('FILE-05', 'projects', 'PRJ-01', '南港經貿園區建造執照正本.pdf', '北市建字第11400234號執照.pdf', 'FILE-05', 4120000, 'application/pdf', '官方執照', 'storage/public_docs/2026/02/FILE-05.pdf', 0, 'e5f6a1b2c3d47890123456789abcdef0123456789abcdef0123456789abcdef4', 'COMP-01', '2026-02-10 10:00:00', NULL, 0, 'NORMAL', 0, 1, '2026-02-10', '2026-02-10');

    INSERT INTO external_folder_links (id, companyId, projectId, partnerId, targetTable, targetId, nasFolderPath, description, isDeleted, version, createdAt, updatedAt)
    VALUES
      ('NAS-01', 'COMP-01', 'PRJ-01', NULL, 'projects', 'PRJ-01', '\\\\192.168.1.100\\Drawings\\PRJ-01_南港經貿總部\\01_建築結構_CAD', '南港總部全套建築結構 DWG 圖說庫 (約 45GB，由工務處監管)', 0, 1, '2026-02-10', '2026-02-10'),
      ('NAS-02', 'COMP-01', 'PRJ-01', 'BP-05', 'subcontracts', 'SUB-CTR-01', '\\\\192.168.1.100\\Drawings\\PRJ-01_南港經貿總部\\02_連續壁大樣圖', '合眾工程連續壁導溝配筋與入岩節點施工大樣圖 (DWG 外部工作桌)', 0, 1, '2026-03-01', '2026-03-01');
  `);
}

// 重設資料庫為初始預設種子狀態
export function resetToSeedData(): void {
  const dbInstance = getDbInstance();
  if (!dbInstance) return;
  seedInitialData(dbInstance);
  saveDatabaseSnapshot();
  notifyListeners();
}
