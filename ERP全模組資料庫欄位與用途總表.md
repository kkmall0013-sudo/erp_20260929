# ERP 全模組資料庫欄位與用途總表

> 依「模組」資料夾內規格的 Prisma Schema、Zod 與業務需求整理。以下以正式模組名稱為章節，不以 Phase 編號作標題。
>
> **範圍說明：**收錄規格中明確定義的 Prisma 實體純量欄位。`items`、`company` 等 Prisma relation 屬性是 ORM 關聯而非實體資料欄位，因此不列；其外鍵欄位會列出。另有規格提到、但模型範本未定義者，獨立標為「規格提及、模型待補」。

## 全域參數與數據防禦

### DocumentSequence｜單據跳號

| 欄位 | 用途 |
|---|---|
| `prefix` | 單據編號前綴及流水號分組鍵，例如 `PO-202405`。 |
| `currentVal` | 該前綴已使用的流水號，透過列鎖及原子更新避免重號。 |
| `updatedAt` | 流水號最近更新時間。 |

### SystemConfig｜全域參數

| 欄位 | 用途 |
|---|---|
| `id` | 參數資料列識別碼。 |
| `configKey` | 參數鍵名，如 `FIN_TAX_TOLERANCE`、`STAMP_DUTY_RECEIPT`。 |
| `configValue` | 參數值，以字串保存並依型別轉換。 |
| `valueType` | 值型別，例如 `STRING`、`NUMBER`、`BOOLEAN`、`JSON`。 |
| `validFrom` | 參數生效起始時間。 |
| `validTo` | 參數生效結束時間，支援歷史值與時點查詢。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本，防止並行覆寫。 |
| `createdBy` | 建立參數者。 |
| `updatedBy` | 最近更新參數者。 |
| `createdAt` | 建立時間。 |
| `updatedAt` | 最近更新時間。 |

### AuditLog｜全域審計

| 欄位 | 用途 |
|---|---|
| `id` | 審計紀錄識別碼。 |
| `userId` | 執行操作的使用者 ID。 |
| `userName` | 操作者名稱快照。 |
| `action` | 操作類型，如修改銀行帳戶或覆寫容差。 |
| `targetTable` | 被操作的資料表／模型名稱。 |
| `targetId` | 被操作資料列 ID。 |
| `beforeJson` | 操作前資料快照。 |
| `afterJson` | 操作後資料快照。 |
| `ipAddress` | 操作者來源 IP。 |
| `createdAt` | 審計事件時間。 |

### 憲法版 AuditLog｜PaaS 加密審計契約（不同版本）

PaaS 憲法另外定義了以遮蔽及加密內容為核心的審計模型；欄位名稱與上表第零章範本不同，應視為版本差異，不可直接混成單一資料表契約。

| 欄位 | 用途 |
|---|---|
| `id` | 審計紀錄識別碼。 |
| `tableName` | 被操作資料表名稱。 |
| `recordId` | 被操作資料列 ID。 |
| `action` | 操作類型，如 CREATE、UPDATE、DELETE、VIEW。 |
| `maskedPayload` | 遮蔽後的變更內容。 |
| `encryptedPayload` | 加密保存的完整敏感變更內容。 |
| `performedBy` | 操作者 ID。 |
| `createdAt` | 審計事件時間。 |

### SysReportSnapshot｜PaaS 全域報表快照

| 欄位 | 用途 |
|---|---|
| `id` | 快照識別碼。 |
| `reportType` | 報表類型。 |
| `periodYear`、`periodMonth` | 快照所屬年度及月份。 |
| `dimension` | 報表維度，如單一專案或集團總覽。 |
| `isDirty` | 髒標記；資料異動後需重算。 |
| `lastGeneratedAt` | 最近產製時間。 |
| `vaultFileId` | 歷史報表檔案在 Vault 的 ID。 |
| `requestedBy` | 發起產製的使用者 ID。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### AnnualArchiveSnapshot｜年度唯讀封存快照

> **架構定位**：每年底系統結算後產出之獨立 SQLite 唯讀封存切片（如 `ERP_ARCHIVE_2025.sqlite`）。平時主庫保留完整資料，此快照檔案供：① 免啟動主系統之靜態離線查閱；② 新機遷移選擇性載入指定年份；③ 災難復原基底。

| 欄位 | 用途 |
|---|---|
| `id` | 封存紀錄識別碼 (UUID)。 |
| `archiveYear` | 封存之所屬西元年份（例如 `2025`）。 |
| `archiveFileName` | 封存檔案實體名稱（例如 `ERP_ARCHIVE_2025.sqlite`）。 |
| `relativePath` | 檔案存放相對路徑（例如 `archives/ERP_ARCHIVE_2025.sqlite`）。 |
| `recordCount` | 該年度封存之資料總列數（涵蓋案場、單據、發票、支票等）。 |
| `fileSizeBytes` | 封存檔案實體大小（位元組）。 |
| `fileHash` | SHA-256 雜湊碼指紋，用於去重與防止離線檔案遭受竄改。 |
| `isSealed` | 唯讀鎖死標記（固定為 `1`，表示歷史死資料，禁止任何寫入）。 |
| `sealedAt` | 封存鎖死建立完成時間戳記（毫秒級 ISO-8601）。 |
| `sealedBy` | 執行封存授權操作之最高管理員 ID。 |
| `description` | 封存備註說明（如「2025 年度完工驗收與已結算單據封存」）。 |

### 全系統通用實體規範：三柱版本與毫秒時間戳記 (Idempotent Standard)

全系統所有資料表（含單據、主檔、明細）除自身業務欄位外，**強制標配以下底層欄位**：
1. `id`：全域唯一主鍵（UUID v4 或毫秒業務流水碼，如 `TX-20261005095200-832-A1`）。
   - **實體身分獨立防衝突**：同一毫秒內產生的兩筆同額支出（如兩筆 5,000 元），其 `id` 絕對不同，系統視為合法獨立實體，絕不誤判或誤刪。
2. `version`：整數版次號（樂觀鎖，初始為 1，每次更新累加 +1）。
3. `createdAt`：毫秒級時間戳記（ISO-8601，如 `2026-10-05T09:52:00.832Z`）。
4. `updatedAt`：毫秒級最後更新時間戳記。
5. **資料庫還原狀態機判定**：
   - `id` 不存在 ➔ `INSERT` 新增。
   - `id` 已存在且備份檔 `version == 主庫 version` ➔ `SKIP` 跳過不重複寫入。
   - `id` 已存在且備份檔 `version > 主庫 version` ➔ `UPDATE` 覆蓋更新（修正版）。
   - `id` 已存在且備份檔 `version < 主庫 version` ➔ `IGNORE` 略過（主庫資料更新）。

### 憲法 FileUploadMetaSchema｜附件上傳驗證輸入（非持久化模型）

| 欄位 | 用途 |
|---|---|
| `originalName` | 上傳原始檔名。 |
| `mimeType` | 上傳檔案 MIME 類型，用於影像壓縮判斷。 |
| `sizeBytes` | 檔案大小；API 範本限制 50 MB。 |
| `targetTable` | 附件關聯目標模型名稱。 |
| `targetId` | 附件關聯目標資料列 ID。 |
| `requiresWebpCompression` | 驗證後依影像類型計算出的轉檔旗標；不是 SystemFile 欄位。 |

### ExampleTransactionDocument｜交易單據共用範本

| 欄位 | 用途 |
|---|---|
| `id` | 單據識別碼。 |
| `documentCode` | 由跳號引擎產生的單據編號。 |
| `status` | 單據狀態，如草稿、簽核、過帳、作廢。 |
| `companyId` | 單據歸屬法人。 |
| `isIntercompany` | 集團內部交易標記，供合併報表沖銷。 |
| `currency` | 單據幣別，預設新台幣。 |
| `netAmount` | 未稅金額。 |
| `taxAmount` | 稅額。 |
| `totalAmount` | 單據總金額。 |
| `discountAmount` | 折讓額；以正數保存並由公式扣除。 |
| `retentionDeductionAmount` | 本期扣留保留款；以正數保存並依交易公式處理。 |
| `postedTaxRate` | 過帳時稅率快照，避免參數變更改寫舊單。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `createdBy` | 建立者 ID。 |
| `onBehalfOf` | 代理操作所代表的使用者 ID。 |
| `updatedBy` | 最近更新者 ID。 |
| `createdAt` | 建立時間。 |
| `updatedAt` | 最近更新時間。 |

### ExamplePurchaseOrder｜憲法示範採購單

這是全域憲法中的示範交易模型，不等同採購模組的 `PurchaseOrder` Schema；欄位命名與用途應作為共用單據範本參考。

| 欄位 | 用途 |
|---|---|
| `id` | 範例採購單識別碼。 |
| `poNumber` | 採購單編號。 |
| `companyId`、`projectId`、`vendorId` | 法人、專案及供應商識別。 |
| `netAmount`、`taxAmount`、`totalAmount` | 未稅額、稅額及總額。 |
| `discountAmount`、`retentionDeductionAmount` | 折讓及本期保留款扣留額，以正數存放並由公式扣減。 |
| `postedTaxRate` | 過帳時稅率快照。 |
| `counterpartyNameSnapshot`、`counterpartyTaxIdSnapshot` | 過帳時對手方名稱及統編快照。 |
| `projectNameSnapshot` | 過帳時專案名稱快照。 |
| `status` | 草稿、已過帳或作廢狀態。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `createdBy`、`updatedBy` | 建立及最近更新者。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

全域參數字典中列出的鍵名（屬於 `configKey` 值，不是額外欄位）：`FIN_TAX_TOLERANCE`（營業稅容差）、`NHI_RATE`（健保費率）、`STAMP_DUTY_CONTRACT_RATE`（承攬契據稅率）、`STAMP_DUTY_ASSET_SALE`（動產買賣契據稅額）、`STAMP_DUTY_RECEIPT`（銀錢收據稅率）、`TRASH_RETENTION_DAYS`（附件垃圾桶保留天數）、`PROJECT_LOCK_MODE`（專案鎖定模式）、`VALUATION_ATTACHMENT_MODE`（估驗附件要求模式）、`MAINTENANCE_MODE`（系統維護模式）。

## 核心架構與資安防禦

### Company｜公司法人與集團實體

> 支援「集團母體（GROUP）＋子公司法人（CORPORATION）＋老闆私人資金帳戶（PERSONAL）」之母子樹狀架構。
> **個人實體規則：** 
> - 用於內部股東借貸、墊款調度與損益核算。
> - **身分驗證防呆**：個人實體驗證台灣身分證字號（`nationalId`，首字大寫英文字母＋9 碼數字，含縣市碼加權模數 10 防呆檢核）。
> - **欄位自動收折**：個人實體自動收折免填公司法人專屬欄位（統編 `taxId`、工商登記地址 `registeredAddress`、通訊聯絡地址 `contactAddress`、登記資本額 `capitalAmount`、法人代表 `representative` 等）。

| 欄位 | 用途 |
|---|---|
| `id` | 法人／實體識別碼（主鍵）。 |
| `companyCode` | 主體代碼，例如集團 `GRP-01`、公司 `COMP-01`、老闆帳號 `BOSS-01`。 |
| `name` | 主體完整名稱，例如「潤泰營造工程股份有限公司」或「林董事長私人資金帳戶」。 |
| `shortName` | 顯示簡稱，供選單與報表抬頭使用，如「潤泰營造」、「林董」。 |
| `entityType` | 主體類型：`GROUP`（集團母體）、`CORPORATION`（公司法人）、`PERSONAL`（個人實體／老闆私帳）。 |
| `parentId` | 上層母體／所屬集團 ID；拉取集團資料時自動合併彙總其名下所有公司與個人實體。 |
| `taxId` | 法人統一編號（8 碼加權邏輯檢核，公司法人必填；**個人實體免填**）。 |
| `nationalId` | 個人身分證字號（首字大寫英文字母＋9 碼數字加權模數檢核；**個人實體專用，公司法人免填**）。 |
| `representative` | 負責人／法定代表人（重要人物，如董事長姓名；個人實體免填）。 |
| `keyPersonnel` | 公司架構重要人物清單 JSON（如 `[{"title":"董事長","name":"林大巨","phone":"0910-123456"},{"title":"總經理","name":"陳建華","phone":"0920-654321"}]`）。 |
| `documentPrefix` | 表單編號前綴（如 `RT-`、`BOSS-`），供後續採購、估驗、借貸跳號使用。 |
| `phones` | 動態電話列表 JSON（支援多筆區別，如 `[{"type":"市話","number":"02-27001234"},{"type":"傳真","number":"02-27005678"},{"type":"工務專線","number":"0910-123456"}]`）。 |
| `email` | 官方對外電子郵件（具備格式檢核）。個人實體選填。 |
| `registeredAddress` | 公司工商登記地址。個人實體免填。 |
| `contactAddress` | 通訊聯絡／工務總部地址。個人實體免填。 |
| `capitalAmount` | 登記資本額（新台幣，純正數）。個人實體免填。 |
| `baseCurrency` | 法人本位幣，預設新台幣（TWD）。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本，防止並行覆寫。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### User｜使用者

| 欄位 | 用途 |
|---|---|
| `id` | 使用者識別碼。 |
| `employeeId` | 員工編號。 |
| `username` | 登入帳號名稱（唯一不重複）。 |
| `name` / `fullName` | 使用者姓名。 |
| `title` | 職務職稱，如「工務主任」、「財務會計長」。 |
| `email` | 登入或聯絡 Email。 |
| `passwordHash` | 密碼雜湊或加密字串，不存明碼。 |
| `isPasswordReset` | 是否為管理員重設後之初始預設密碼標記（布林值）。 |
| `role` | 三層式身分架構：`SUPERADMIN`（唯一最高）、`ADMIN`（系統管理員）、`USER`（業務同仁）。 |
| `canManageSystemConfigs` | **【Superadmin 特許核心授權】** 是否開放此特定 Admin 帳號修改全域核心參數（布林值，僅最高 Superadmin 有權授予開關，預設 0／false）。 |
| `canManageUsers` | **【Superadmin 特許帳號管理專人授權】** 是否開放此特定 Admin 進入帳號管理模組，並具備同仁帳號維護與重設他人密碼之專人權限（布林值，僅最高 Superadmin 有權授予開關，預設 0／false；未獲授權者選單完全隱藏）。 |
| `canManageAdmins` | **【Superadmin 特許同階管理授權】** 是否開放此特定 Admin 帳號新增、編輯、重設密碼與停用/刪除同階 Admin 帳號（布林值，僅最高 Superadmin 有權授予開關，預設 0／false）。 |
| `groupId` | 主要業務權限群組代碼（對應 `user_groups.id`）。 |
| `groupIds` | 多重業務權限群組矩陣 JSON（例如 `["GRP-ENG","GRP-PROC"]`，採權限聯集）。 |
| `allowedCompanies` | 授權營運法人 ID 清單 JSON（例如 `["COMP-01","COMP-02"]`）。 |
| `defaultCompanyId` | 預設進入之營運法人 ID。 |
| `tokenVersion` | Token 版本；更新後可使既有登入憑證失效。 |
| `maxConcurrentSessions` | 同時允許登入的設備數上限。 |
| `allowedIpRanges` | 此帳號可登入的 IP／網段。 |
| `dailyExportLimit` | 每日報表或資料匯出筆數上限。 |
| `status` | 帳號狀態：`ACTIVE`（正常啟用）、`DISABLED`（停用／離職）。 |
| `isGhost` | 幽靈員工標記；新選單隱藏但保留歷史血緣。 |
| `resignedAt`、`reinstatedAt` | 離職及復職時間。 |
| `delegateToId` | 代理人使用者 ID。 |
| `delegateScope` | 代理可操作的模組／範圍。 |
| `delegateFrom`、`delegateUntil` | 代理權限生效及到期時間。 |
| `deleteStage` | 帳號生命週期狀態：`ACTIVE`（正常在職主檔）、`PENDING_DELETE`（第一階段：7日待刪除冷卻回收站）、`ARCHIVED`（第二階段：Superadmin 深度封存區）。 |
| `stageDeletedAt` | 進入冷卻期或封存狀態之時間戳 (ISO)。 |
| `purgeDueAt` | 7 天冷卻期預計屆滿截止時間 (ISO)。 |
| `deletedBy` | 執行第一階段刪除或移交封存之操作人員姓名。 |
| `stageNotes` | 刪除或封存之事由備註。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

> **三層式權限與特許核心設定規則（憲法補充）：**
> 1. **Superadmin 金身防護**：全系統僅此 1 位，具備絕對最高權限，不可刪除、不可停用、不可被一般 Admin 修改；欲更換最高管理者必須走「最高權限交接程序」。
> 2. **Admin 全域參數特許 (`canManageSystemConfigs`)**：一般 Admin 帳號預設無權修改全域系統核心參數（`SYSTEM_CONFIGS`）；但 **Superadmin 可在帳號管理中個別點擊開放特許權限給特定 Admin**。擁有此特許之 Admin 即可協同維護全域參數，兼顧分權與安全。
> 3. **Admin 帳號管理專人特許 (`canManageUsers`)**：帳號管理非所有 Admin 固有權限，而是**由唯一最高 Superadmin 指定專人 Admin 負責**。未獲指定之 Admin 在左側導航選單中**完全隱藏「帳號管理」入口**，且無權重設他人密碼；他人密碼僅具備此權限之專人能重設。
> 4. **Admin 同階管理特許 (`canManageAdmins`)**：依階層原則，獲指定管理帳號之專人 Admin 預設只能管理下一階層（User），無法新增、修改、重設密碼或刪除同階（Admin）。唯有進一步經 Superadmin 授權開啟 `canManageAdmins` 之專人 Admin，始具備管理同階 Admin 帳號之特許權力（但依然嚴禁異動或刪除唯一最高 Superadmin）。
> 5. **同仁自主密碼維護**：所有同仁（包含一般 User）皆可於頂部個人帳號區自主變更個人密碼，變更時需驗證目前原始密碼，並由系統強制輸入兩次新密碼以資確認。
> 6. **User 業務多重矩陣**：User 身分必須指派至少一個群組，多群組時權限為聯集生效。
> 7. **Admin 降級 User 自動收回特許**：Admin 帳號被調整/降級為 User 時，後端資料庫層級自動執行原子交易收回並歸零所有進階特許項目（`canManageUsers=0, canManageSystemConfigs=0, canManageAdmins=0`），並自動預指派業務群組（如工務組），確保符合「一般同仁必須至少隸屬一個業務群組」之業務檢核。
> 8. **置中防呆刪除確認與 10 秒一鍵復原**：刪除同仁帳號採用系統內建置中防呆確認視窗（Centered Modal），徹底排除沙盒環境攔截阻斷問題；刪除後系統提供 10 秒倒數一鍵復原（Undo Restore）Toast，防止誤刪並即時還原同仁完整資料與權限設定。
> 9. **特許項目預設關閉與非 Superadmin 畫面隱藏**：不論新增或修改帳號，特許項目預設一律為關閉（false／0）。非 Superadmin 操作者之表單中**完全隱藏特許授權區塊**（不可見不可選），且後端強制歸零防竄改，唯有唯一最高 Superadmin 具備檢視並開啟進階特許之專屬權力。
> 10. **階梯式三態刪除與純淨單據血緣保護**：
>     - **第一階段（待刪除回收站，7日冷卻）**：點選刪除後，同仁自主檔移除並停用登入，移入「待刪除回收站」享有 7 天冷卻保護期。管理員可於冷卻期內隨時一鍵復原，或提前手動二次刪除送往封存區。
>     - **第二階段（Superadmin 深度封存區）**：滿 7 天未復原或經提前二次刪除者，自動移交 Superadmin 深度封存區，一般 Admin 視角徹底隱藏。唯有 Superadmin 擁有「終極救回復原」與輸入安全驗證詞（「確認永久物理清除」）進行資料庫實體不可逆抹除之權限。
>     - **純淨單據血緣原則**：歷史專案、合約、發包、計價與審計日誌中，**一律不添加「[已刪除]」或離職等干擾性標籤**，純淨保留當時經辦人姓名純文字快照，即便帳號物理清除亦永不留白、不破壞外鍵血緣。
> 11. **Superadmin 看板隱私與高可讀性操作稽核日誌 (Audit Log)**：
>     - **身分卡片隱私控制**：帳號管理看板三大身分卡片（唯一最高管理者、系統管理員組、業務群組同仁）嚴格限縮為僅 Superadmin 登入時可見；一般 Admin 登入時自動隱藏，守護最高管理權限與組織架構隱私。
>     - **全域操作與登入日誌查詢**：Superadmin 專屬擁有「系統操作與登入稽核日誌」獨立檢視分頁。底層 SQLite 資料庫自動記錄所有帳號之登入、身分切換、帳號增刪改查、階梯式刪除與單據過帳歷程。
>     - **純中文無代號與僅記錄修改差異原則**：審計日誌全面採用「純中文、不顯示英文或系統代號（如不顯示 USR-001、COMP-01、GRP-ENG、UPDATE 等代碼，一律轉譯為中文名稱）」之高可讀性格式；且在修改資料時，系統會自動比對修改前後狀態，**僅記錄有實際發生變更的欄位（修改前 ➔ 修改後）**，未變動的欄位一概不冗餘寫入，讓管理階層一眼掌握關鍵異動。
> 12. **禁止停用自身帳號與停權身分防提權保護**：
>     - **禁止自殺式停權**：無論 Superadmin 或具備帳號維護權限之專人 Admin，系統全面禁止將當前正在登入操作中之自身帳號設為停用（DISABLED）。介面點擊時觸發置頂防呆警示視窗，後端資料庫亦具備不可逾越之操作者身分阻擋檢核。
>     - **停權狀態不可竄升提權**：當同仁帳號遭其他管理員停權時，前端驗證核心嚴禁靜默降級或回退至唯一最高 Superadmin；該帳號將如實維持停權狀態並全面封鎖所有 12 大模組的操作與審批權限，杜絕藉由停權換取最高管理者特權之資安漏洞。

### Role｜權限角色

| 欄位 | 用途 |
|---|---|
| `id` | 角色識別碼。 |
| `roleName` | 角色名稱。 |
| `permissions` | 權限矩陣 JSON，保存讀寫、核准、額度、欄位遮蔽等權限。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### UserCompanyAccess｜使用者法人角色關聯

| 欄位 | 用途 |
|---|---|
| `id` | 權限關聯識別碼。 |
| `userId` | 使用者 ID。 |
| `companyId` | 使用者可操作的法人 ID。 |
| `roleId` | 使用者在該法人的角色 ID。 |

API／權限結構中另有非資料表欄位：`sub`（JWT 使用者 ID）、`act`（代理行為者 ID）、`currentCompanyId`（當前法人）、`canReadOwn`（讀本人／負責資料）、`canReadAll`（讀全法人資料）、`canWrite`（寫入權）、`canApprove`（核准權）、`approvalLimit`（核准金額上限）、`maskedFields`（需遮蔽欄位清單）。

API 回應封裝（非資料表）：`success`（請求是否成功）、`data`（成功資料）、`error.code`／`error.message`（錯誤代碼及訊息）、`error.latestData`（樂觀鎖衝突時的最新資料）。

## 專案與案場管理

### Project｜專案主檔

| 欄位 | 用途 |
|---|---|
| `id` | 專案識別碼。 |
| `projectCode` | 專案代號，依年月與流水號產生。 |
| `contractName` | 合約正式名稱，用於開票及憑證勾稽。 |
| `internalName` | 內部俗稱，供工務及現場溝通。 |
| `status` | 專案狀態：草稿、規劃、執行、保固或結案。 |
| `managementContractAmount` | 管理帳真實合約金額，用於成本與利潤分析。 |
| `taxInvoiceAmount` | 稅務帳官方開票總額；不是稅額本身。 |
| `clientId` | 業主／客戶商業夥伴 ID。 |
| `shipToId` | 收貨方商業夥伴 ID；可與簽約業主不同。 |
| `billToId` | 發票開立方商業夥伴 ID。 |
| `payerId` | 實際付款方商業夥伴 ID。 |
| `referrerName` | 介紹人／推薦人名稱，作為後續分潤追蹤節點。 |
| `retentionMethod` | 保留款計算方式：按期、尾期、手動或不適用。 |
| `retentionRate` | 合約預設保留款比例。 |
| `retentionCapAmount` | 保留款累計上限。 |
| `retentionReleaseDate` | 預計退還保固款日期。 |
| `contractDate` | 合約簽訂日。 |
| `estStartDate`、`actStartDate` | 預計及實際開工日。 |
| `estEndDate`、`actEndDate` | 預計及實際完工日。 |
| `warrantyStartDate`、`warrantyEndDate` | 保固起訖日。 |
| `parentId` | WBS 上層專案 ID，建立主案、期別及 VO 階層。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### ProjectMember｜專案成員

| 欄位 | 用途 |
|---|---|
| `id` | 成員關聯識別碼。 |
| `projectId` | 所屬專案 ID。 |
| `userId` | 成員使用者 ID。 |
| `roleInProject` | 專案職務，如 PM、工地主任、會計。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### ProjectBudget｜專案預算

| 欄位 | 用途 |
|---|---|
| `id` | 預算資料識別碼。 |
| `projectId` | 所屬專案 ID。 |
| `estimatedMaterialCost` | 預估純料成本；採購超支檢核基準。 |
| `estimatedLaborCost` | 預估人工／發包成本。 |
| `estimatedExpenses` | 預估工地管理及雜支。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

**規格提及、模型待補：**資金帳實收／實付與差額歸屬科目尚無本模組模型；`isRetentionOverridden`（實際扣款不同於建議值時供後端稽核）僅出現在估驗 Zod，沒有 Project 欄位；`calcRetentionAmount`、`actualRetentionAmount` 是交易驗證輸入；保固費用 `WARRANTY_EXPENSE` 有分類要求，但沒有費用明細模型承載。

## 合作夥伴、料件與防弊內控

### BusinessPartner｜商業夥伴

| 欄位 | 用途 |
|---|---|
| `id` | 商業夥伴識別碼。 |
| `isCustomer`、`isVendor` | 是否具有客戶及／或供應商身分。 |
| `internalCompanyId` | 集團內部夥伴對應的子公司法人 ID。 |
| `name` | 夥伴名稱；規格要求唯一，廠區可用名稱後綴區分。 |
| `taxId` | 統一編號；可重複以支援多廠區。 |
| `ownerIdNumber` | 負責人身分證字號；防換殼／黑名單比對。 |
| `telephone` | 聯絡電話；防換殼比對。 |
| `hasInvoice` | 是否可開立發票。 |
| `parentBpId` | 母公司／上層商業夥伴 ID。 |
| `bankFeePayer` | 匯費負擔方：公司或廠商。 |
| `status` | 待核准、正常、警告、停權或付款鎖定等狀態。 |
| `isHighRisk` | 高風險關聯標記，供採購及報價警示。 |
| `currentScore` | 廠商評鑑分數快照。 |
| `predecessorId` | 換法人後承接的前一商業夥伴 ID。 |
| `createdBy`、`updatedBy` | 建立者及最近更新者。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### BPCompanyOverride｜法人別夥伴設定

| 欄位 | 用途 |
|---|---|
| `id` | 法人別設定識別碼。 |
| `bpId` | 商業夥伴 ID。 |
| `companyId` | 此設定適用的法人 ID。 |
| `paymentTermsDays` | 此法人約定的付款天數。 |
| `creditLimit` | 此法人給予夥伴的信用額度。 |

### BPBankAccount｜夥伴銀行帳戶

| 欄位 | 用途 |
|---|---|
| `id` | 銀行帳戶識別碼。 |
| `bpId` | 帳戶所屬夥伴 ID。 |
| `bankCode` | 銀行代碼。 |
| `accountNumber` | 銀行帳號；異動觸發付款鎖及雙重覆核。 |
| `accountName` | 銀行帳戶戶名。 |
| `isPrimary` | 是否為主要付款帳戶。 |

### PartnerAddress｜夥伴地址

| 欄位 | 用途 |
|---|---|
| `id` | 地址識別碼。 |
| `partnerId` | 所屬夥伴 ID。 |
| `addressType` | 登記、帳單或送貨等地址類型。 |
| `fullAddress` | 完整地址。 |
| `isDeleted` | 軟刪除標記。 |

### PartnerContact｜夥伴聯絡人

| 欄位 | 用途 |
|---|---|
| `id` | 聯絡人識別碼。 |
| `partnerId` | 所屬夥伴 ID。 |
| `contactType` | 財務、工地或採購等聯絡用途。 |
| `name` | 聯絡人姓名。 |
| `phone`、`email` | 聯絡電話及 Email。 |
| `isDeleted` | 軟刪除標記。 |

### PartnerRelationship｜夥伴關係／介紹分潤

| 欄位 | 用途 |
|---|---|
| `id` | 關係識別碼。 |
| `sourcePartnerId`、`targetPartnerId` | 關係起點及對象夥伴 ID。 |
| `relationType` | 關係類型，如介紹人或保證人。 |
| `commissionRate` | 介紹人抽成比例。 |
| `createdAt` | 關係建立時間。 |

### BPScorecardLog｜廠商缺失記點

| 欄位 | 用途 |
|---|---|
| `id` | 記點紀錄識別碼。 |
| `bpId` | 被評鑑夥伴 ID。 |
| `projectId` | 發生缺失的專案 ID。 |
| `scoreDelta` | 本次評分變化；扣分以負數記錄。 |
| `reason` | 扣分／評鑑原因。 |
| `createdAt` | 記點時間。 |

### Item｜料件及服務工項

| 欄位 | 用途 |
|---|---|
| `id` | 料件／工項識別碼。 |
| `itemCode` | 料件或工項代碼。 |
| `name` | 品名或工項名稱。 |
| `itemType` | 材料或服務，決定庫存處理方式。 |
| `baseUnit` | 基本計量單位。 |
| `expenseCodeId` | 服務工項所屬費用科目碼。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### VendorItemUoM｜供應商專屬單位換算

| 欄位 | 用途 |
|---|---|
| `id` | 換算設定識別碼。 |
| `vendorId` | 供應商 ID。 |
| `itemId` | 料件 ID。 |
| `vendorUomName` | 供應商採購單位，如箱、桶。 |
| `conversionRate` | 供應商單位換算為基本單位的倍率。 |

非資料表驗證欄位：`inputTaxId`、`inputBankAccount` 是智慧洗滌輸入；`isAccountantConfirmed` 是會計確認洗滌結果的畫押狀態。扣繳服務另提及 `calculatedTax`、`netPayableAmount` 及人工覆寫狀態，尚未放進上述模型。

**欄位同步狀態：**Project 模組已加入 `shipToId`、`billToId`、`payerId` 四方欄位，第三篇憲法亦已列出；商業夥伴全域名稱統一為 `BusinessPartner.name`，不另存 `globalName`。`BPCompanyOverride.paymentTermsDays` 已統一為可空，空值時回退全域預設付款條件。

## 報價與銷售

### Quotation｜報價單

| 欄位 | 用途 |
|---|---|
| `id` | 報價單識別碼。 |
| `quotationNumber` | 報價單編號，與版次組成唯一值。 |
| `versionNumber` | 報價版次。 |
| `lockVersion` | 樂觀鎖版本，避免並行修改覆寫。 |
| `projectId` | 所屬專案 ID。 |
| `companyId` | 報價歸屬法人。 |
| `customerId` | 客戶 ID。 |
| `validUntil` | 報價有效期限，逾期阻擋簽約／轉合約。 |
| `pricingMode` | 表頭折讓、單價微調或影子均攤議價模式。 |
| `customDiscountText` | 協議價格等列印用文字。 |
| `agreedTotalAmount` | 影子均攤模式的協議總價。 |
| `netAmount`、`discountAmount`、`taxAmount`、`totalAmount` | 報價未稅額、折讓、稅額及總額。 |
| `lossReasonCode`、`lossRemarks` | 未得標原因代碼及補充說明。 |
| `status` | 草稿、待核准、已核准、被取代、已轉合約或未得標等狀態。 |
| `parentQuotationId` | 上一版報價 ID，建立版本歷史鏈。 |
| `isDeleted` | 軟刪除標記。 |
| `createdBy`、`updatedBy` | 建立及最近更新者。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### QuotationItem｜報價明細

| 欄位 | 用途 |
|---|---|
| `id` | 明細識別碼。 |
| `quotationId` | 所屬報價單 ID。 |
| `itemType` | 一般加項或追減／折讓減項；減項仍存正數。 |
| `isOptional` | 選配項目標記；彙總報價時排除選配項。 |
| `itemName` | 工項名稱。 |
| `quantity` | 報價數量。 |
| `quotedUnitPrice` | 對外列印的報價單價。 |
| `estimatedUnitCost` | 預估成本，簽約時凍結作為成本基準。 |
| `lineAmount` | 明細金額。 |
| `effectiveUnitPrice` | 折讓後有效單價，作為後續追減退款基準。 |
| `isAwarded` | 部分得標時標示是否得標。 |
| `lostReason` | 未得標原因。 |

**非資料表輸入欄位：**Zod 範本中的 `remarks` 是明細備註輸入；目前 Prisma 明細模型未持久化此欄位。

### ProjectContract｜銷售合約

| 欄位 | 用途 |
|---|---|
| `id` | 合約識別碼。 |
| `companyId` | 合約歸屬法人。 |
| `projectId` | 所屬專案 ID。 |
| `contractNumber` | 合約編號。 |
| `originalTotalAmount`、`currentTotalAmount` | 原始簽約總額及已計入核准變更後的目前總額。 |
| `isStampDutyRequired` | 是否需計算／申報印花稅。 |
| `stampDutyRuleId` | 使用的印花稅規則 ID。 |
| `isTaxExclusive` | 合約是否為未稅金額。 |
| `originalCopiesCount` | 合約正本份數。 |
| `stampDutyShare` | 本方負擔印花稅比例。 |
| `stampDutyAmount` | 印花稅金額。 |
| `stampDutyVoucherNo` | 大額總繳銷印憑證號。 |
| `isStampDutyPaid` | 是否已完成印花稅繳納／銷印。 |
| `status` | 草稿、生效、完成或終止狀態。 |
| `overrideReason` | 特權略過驗證的原因。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### SalesChangeOrder｜銷售追加減變更單

| 欄位 | 用途 |
|---|---|
| `id` | 變更單識別碼。 |
| `contractId` | 所屬銷售合約 ID。 |
| `coNumber` | 變更單編號。 |
| `itemType` | 加項／減項類型；減項以正數存放。 |
| `changeAmount` | 變更金額。 |
| `reason` | 變更原因。 |
| `isApproved` | 是否核准。 |
| `createdAt` | 建立時間。 |

**規格提及、模型待補：**`refundUnitPrice`（追減退款單價，不得高於 `effectiveUnitPrice`）有規則要求，但尚未定義為 Prisma 欄位；印花稅特權使用的 `canOverrideValidation` 是權限欄位，不屬於合約資料欄位。

### ClauseTemplate｜動態條款母庫

| 欄位 | 用途 |
|---|---|
| `id` | 條款範本識別碼。 |
| `clauseCode` | 條款代碼。 |
| `title` | 條款標題。 |
| `content` | 條款範本文字。 |
| `triggerTag` | 自動掛載條款的條件標籤。 |
| `isActive` | 範本是否啟用。 |
| `createdAt` | 範本建立時間。 |

### QuotationClause｜報價條款快照

| 欄位 | 用途 |
|---|---|
| `id` | 報價條款快照識別碼。 |
| `quotationId` | 所屬報價 ID。 |
| `clauseCode` | 條款代碼快照。 |
| `title` | 條款標題快照。 |
| `frozenContent` | 過帳時凍結的條款文字，避免範本修改影響舊報價。 |

### QuotationBillingMilestone｜報價請款里程碑

| 欄位 | 用途 |
|---|---|
| `id` | 里程碑識別碼。 |
| `quotationId` | 所屬報價 ID。 |
| `stageIndex` | 里程碑期數順序。 |
| `stageName` | 里程碑名稱，如簽約訂金、進場點收。 |
| `percentage` | 該期請款比例；各期加總應為 100%。 |
| `estimatedDate` | 預計里程碑日期。 |

**欄位同步狀態：**模組與第四篇憲法已統一 `quotationNumber`、`versionNumber`、`lockVersion`、`parentQuotationId`、`quotedUnitPrice`、`estimatedUnitCost`、`isOptional` 及 `lineAmount`。`refundUnitPrice` 仍只有規則敘述，未見 Prisma 欄位。

## 採購與發包

### PurchaseOrder｜採購單

| 欄位 | 用途 |
|---|---|
| `id` | 採購單識別碼。 |
| `poNumber` | 採購單號。 |
| `purchasingCompanyId` | 名義發單法人。 |
| `isIntercompany` | 是否集團內部交易。 |
| `projectId` | 所屬專案；也可由明細指定案場。 |
| `vendorId` | 供應商商業夥伴 ID。 |
| `counterpartyNameSnapshot`、`counterpartyTaxIdSnapshot` | 過帳時供應商名稱及統編快照。 |
| `projectNameSnapshot` | 過帳時專案名稱快照。 |
| `postedAt` | 採購單過帳時間。 |
| `status` | 草稿、待覆核、核准、過帳或作廢狀態。 |
| `netAmount`、`taxAmount`、`totalAmount` | 採購未稅額、稅額及總額。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### PurchaseOrderItem｜採購明細

| 欄位 | 用途 |
|---|---|
| `id` | 明細識別碼。 |
| `purchaseOrderId` | 所屬採購單 ID。 |
| `projectId` | 此列成本所屬專案；專案採購明細必填，同一單多案場時拆成多筆明細。 |
| `productId` | 對應料件／產品 ID。 |
| `description` | 品名或明細說明，亦支援一次性雜項。 |
| `itemType` | 材料或服務；服務免庫存並需指定費用碼。 |
| `expenseCodeId` | 服務明細的費用科目碼。 |
| `quantity` | 採購數量。 |
| `unitPrice` | 單價；可空以支援現場盲收。 |
| `lineAmount` | 明細金額。 |
| `isPrepaidDeduction` | 是否以預付備料扣抵。 |
| `isDeleted` | 軟刪除標記。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### GoodsReceipt｜收貨單

| 欄位 | 用途 |
|---|---|
| `id` | 收貨單識別碼。 |
| `receiptNumber` | 收貨單號。 |
| `purchaseOrderId` | 對應採購單；嚴謹模式下必填。 |
| `isDropShip` | 是否直接送至工地。 |
| `receivedDate` | 實際收貨日期。 |
| `status` | 收貨單狀態。 |
| `isDeleted` | 軟刪除標記。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### GoodsReceiptItem｜收貨明細

| 欄位 | 用途 |
|---|---|
| `id` | 收貨明細識別碼。 |
| `goodsReceiptId` | 所屬收貨單 ID。 |
| `poItemId` | 對應採購明細 ID。 |
| `receivedQuantity` | 現場實收數量。 |
| `unitPrice` | 收貨單價；沿用 PO 價或超交時設為零。 |
| `isOverReceipt` | 是否為超交零成本數量。 |

供應商預付備料不另建 `PrepaidMaterialLedger`；採購端使用財務模組的共用 `PrepaymentLedger`，以 `partnerId`、`itemId`、`unitPrice`、`remainingQty` 及 `balanceAmount` 查詢對應預付批次。

### InternalVirtualCashPool｜內部虛擬資金池

| 欄位 | 用途 |
|---|---|
| `id` | 虛擬資金交易識別碼。 |
| `transactionDate` | 資金交易日期。 |
| `amount` | 收支金額；規格允許正負數表示流入／流出。 |
| `description` | 資金用途說明。 |
| `createdBy` | 操作者 ID，限授權管理者。 |
| `isDeleted` | 軟刪除標記。 |
| `createdAt` | 建立時間。 |

**規格提及、模型待補：**異常暫存的尾差調整額、調整原因及覆核人尚無專用欄位；Landed Cost 分攤模式及金額尚無資料模型。發票法人歸戶由共用 Invoice 的 `taxReportingCompanyId` 負責，不放在採購單；發票勾稽狀態由 `BillingInvoiceMapping` 推導，不在 `GoodsReceipt` 重複存 `isBilled`。

## 發包合約與估驗計價

### Subcontract｜發包合約

| 欄位 | 用途 |
|---|---|
| `id` | 發包合約識別碼。 |
| `companyId` | 合約歸屬法人。 |
| `projectId`、`vendorId` | 所屬專案及下包商 ID。 |
| `contractNumber` | 合約編號。 |
| `contractTitle` | 合約標題。 |
| `contractType` | 總價或單價合約型態。 |
| `isTaxExclusive` | 是否外加稅／有發票。 |
| `isIntercompany` | 是否集團內部交易。 |
| `originalAmount` | 核准後封存的原始合約金額。 |
| `contractCeilingAmount` | 依核准變更單加減後的合約請款天花板。 |
| `retentionMethod` | 保留款模式。 |
| `retentionRate`、`retentionCapAmount` | 保留款比例及累計上限。 |
| 預付／保留款餘額 | 由共用 `PrepaymentLedger`、`RetentionLedger` 彙總，不在合約重複保存。 |
| `status` | 草稿、生效、完成或終止狀態。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### ChangeOrder｜發包變更單

| 欄位 | 用途 |
|---|---|
| `id` | 變更單識別碼。 |
| `subcontractId` | 所屬發包合約 ID。 |
| `coNumber` | 變更單號。 |
| `itemType` | 加項或減項；減項以正數記錄。 |
| `amount` | 變更金額。 |
| `reason` | 變更原因。 |
| `status` | 待核准、核准或退回等簽核狀態。 |
| `createdAt` | 建立時間。 |

### ProgressBilling｜下包估驗單

| 欄位 | 用途 |
|---|---|
| `id` | 估驗單識別碼。 |
| `subcontractId` | 所屬發包合約 ID。 |
| `companyId` | 本期 AP／發票歸戶法人；與所勾稽 Invoice 的 `taxReportingCompanyId` 一致。 |
| `billingPeriod` | 本期估驗日期／期別。 |
| `billingCount` | 估驗期數序號。 |
| `isFinalPeriod` | 是否最後一期；最後期須結清合約餘額。 |
| `isTaxExclusive` | 本期是否外加稅。 |
| `taxAmount` | 本期稅額；免稅情境為零。 |
| `cumulativeAmount` | 本期結算後累計請款額。 |
| `previousAmount` | 本期前歷次請款累計額。 |
| `periodAmount` | 本期實際請款額。 |
| `prepaymentAppliedAmount` | 本期沖抵預付款。 |
| `retentionDeductionAmount` | 本期扣留保留款。 |
| `payableAmount` | 扣除預付及保留款後的應付金額。 |
| `overrideReason` | 超過合約天花板等特批原因。 |
| `status` | 草稿、待核准、待特批、核准或已付款等狀態。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### ProgressBillingItem｜下包估驗明細

| 欄位 | 用途 |
|---|---|
| `id` | 明細識別碼。 |
| `progressBillingId` | 所屬估驗單 ID。 |
| `itemName` | 工項名稱。 |
| `itemType` | 加項或減項；減項以正數存放並視覺標示。 |
| `itemCategory` | 材料、人工或總價分類。 |
| `lineAmount` | 本列估驗金額。 |
| `isPrepaidDeduction` | 原模組標記欄位；預付款扣抵金額與批次來源以 `PrepaymentLedger` 為準。 |

## 財務會計與金流

### PrepaymentLedger｜預付款／預收款共用台帳

| 欄位 | 用途 |
|---|---|
| `id` | 預付款／預收款台帳識別碼。 |
| `companyId` | 資金所屬法人。 |
| `partnerId` | 供應商或客戶商業夥伴 ID。 |
| `advanceDirection` | 區分供應商預付款與客戶預收款。 |
| `sourceDocumentType`、`sourceDocumentId` | 原始付款、收款或合約來源。 |
| `transactionDate` | 預付款／預收款發生日期。 |
| `itemId` | 供應商預購料件；一般客戶預收款可空。 |
| `unitPrice` | 供應商預購價格批次。 |
| `originalQty`、`remainingQty` | 原始預購數量及尚未領用數量。 |
| `originalAmount` | 原始預付／預收金額。 |
| `appliedAmount` | 已沖抵金額。 |
| `balanceAmount` | 尚未沖抵餘額。 |
| `currency` | 資金幣別。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### RetentionLedger｜應收／應付保留款台帳

| 欄位 | 用途 |
|---|---|
| `id` | 保留款事件識別碼。 |
| `companyId` | 保留款所屬法人。 |
| `direction` | `AR` 業主應收或 `AP` 下包應付。 |
| `contractId` | 業主或發包合約 ID。 |
| `sourceDocumentType`、`sourceDocumentId` | 產生扣留／釋放的估驗或來源單據。 |
| `retentionDeductionAmount` | 本次新增扣留額。 |
| `retentionReleaseAmount` | 本次釋放額。 |
| `balanceAmount` | 本事件後尚未釋放餘額。 |
| `transactionDate` | 扣留／釋放事件日期。 |
| `currency` | 保留款幣別。 |
| `createdAt` | 台帳事件建立時間。 |

### Invoice｜共用發票主檔

| 欄位 | 用途 |
|---|---|
| `id` | 發票識別碼。 |
| `invoiceType` | 進項或銷項方向。 |
| `invoiceNumber` | 發票字軌號碼。 |
| `invoiceDate` | 發票開立日期。 |
| `taxReportingCompanyId` | 本系統負責申報／入帳的法人。 |
| `issuerCompanyId`、`issuerPartnerId` | 本集團公司或外部夥伴作為發票開立方。 |
| `buyerCompanyId`、`buyerPartnerId` | 本集團公司或外部夥伴作為發票買受方。 |
| `issuerTaxId`、`buyerTaxId` | 發票開立方及買受方統編快照。 |
| `netAmount`、`taxAmount`、`totalAmount` | 未稅額、稅額及含稅總額。 |
| `currency` | 發票幣別。 |
| `status` | 有效、作廢或折讓等狀態。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### BillingInvoiceMapping｜發票與來源單據勾稽

| 欄位 | 用途 |
|---|---|
| `id` | 勾稽識別碼。 |
| `invoiceId` | 共用 Invoice ID。 |
| `sourceDocumentType`、`sourceDocumentId` | 被勾稽的 AP／AR／估驗等來源單據。 |
| `mappedAmount` | 此發票分配到來源單據的金額，支援多對多及跨月勾稽。 |
| `createdAt` | 勾稽建立時間。 |

### PaymentRecord｜付款／資金收支主檔

| 欄位 | 用途 |
|---|---|
| `id` | 付款紀錄識別碼。 |
| `companyId` | 付款所屬法人。 |
| `currency` | 幣別，預設新台幣。 |
| `paymentNo` | 付款單號。 |
| `bankAccountId` | 出款銀行或虛擬銀行帳戶 ID。 |
| `partnerId` | 收款商業夥伴 ID。 |
| `customVendorName` | 未建檔零星廠商名稱。 |
| `isReversal` | 是否為退匯、退票等迴轉單。 |
| `isIntercompany` | 集團內部交易快照。 |
| `documentDate` | 發票或原始憑證實際發生日。 |
| `postingDate` | 會計入帳日，受期間關帳限制。 |
| `totalAmount` | 付款單總額。 |
| `status` | 草稿、待核准、已過帳或作廢狀態。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `voidReason` | 作廢原因與審計說明。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### PaymentLineItem｜付款沖銷明細

| 欄位 | 用途 |
|---|---|
| `id` | 付款明細識別碼。 |
| `paymentId` | 所屬付款單 ID。 |
| `sourceType` | 來源類型：採購、下包估驗或雜支報銷。 |
| `sourceId` | 來源應付／費用單據 ID。 |
| `itemType` | 一般項或代扣減項；減項輸入正數。 |
| `appliedAmount` | 本次實際沖抵應付金額。 |
| `feeAmount` | 銀行手續費。 |
| `isFeeAbsorbedByCompany` | 手續費由公司外加吸收或由廠商內扣。 |
| `discountAmount` | 廠商尾數折讓／抹零額。 |
| `offsetExpenseId` | 被沖銷的專案代墊費用 ID，用來還原專案成本。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### CheckDetail｜支票明細

| 欄位 | 用途 |
|---|---|
| `id` | 支票明細識別碼。 |
| `paymentId` | 對應付款單 ID。 |
| `checkNumber` | 支票號碼。 |
| `drawerBank` | 付款銀行。 |
| `issueDate` | 開票日期。 |
| `expectedClearanceDate` | 預計兌現日期，供現金流預測。 |
| `actualClearanceDate` | 實際兌現日期，供存摺對帳。 |
| `status` | 已開立、已兌現、退票或作廢狀態。 |

**規格提及、模型待補：**`isVirtualAccount` 用於戰情室隱藏老闆口袋帳戶，但銀行帳戶模型未在此 Prisma 契約定義；匯費對應費用科目／分錄欄位未列；`calculatedTax`、`netPayableAmount` 及扣繳人工覆寫狀態是扣繳服務輸出，未落在 PaymentRecord Schema。

### 憲法版 PaymentRecord｜財務補充欄位

| 欄位 | 用途 |
|---|---|
| `targetBankAccountId` | 內部資金調撥的轉入銀行帳戶。 |
| `isReconciled` | 是否已完成銀行調節。 |
| `reconciledAt` | 銀行調節完成時間。 |
| `reversedByTaskId` | 造成反向／回滾的背景工作 ID。 |

### 憲法版 PaymentLineItem｜付款明細補充欄位

| 欄位 | 用途 |
|---|---|
| `projectId` | 成本實際歸屬專案；支援跨法人代付但成本認列於案場。 |
| `voucherType` | 憑單類型，如常規 AP、貸項通知、代付沖銷、資金調撥或退款。 |
| `isWithoutReceipt` | 無憑證內部費用標記，避免納入外帳稅務申報。 |
| `withholdingTaxAmt` | 本次代扣所得稅金額。 |
| `nhiAmt` | 本次代扣二代健保金額。 |
| `discountCostId` | 折讓轉列的專案內部成本科目 ID。 |
| `discountNote` | 折讓轉列成本的說明。 |

### SuspenseReceipt｜未知款項暫收池

| 欄位 | 用途 |
|---|---|
| `id` | 暫收款紀錄識別碼。 |
| `companyId` | 暫收款歸屬法人。 |
| `bankAccountId` | 實際匯入的銀行帳戶 ID。 |
| `amount` | 暫收金額。 |
| `receivedDate` | 款項入帳日期。 |
| `isAllocated` | 是否已釐清並認領至應收帳款；認領時才觸發發票認列。 |
| `createdAt` | 紀錄建立時間。 |

### 憲法版 OverpaymentPool｜溢付款池補充契約

| 欄位 | 用途 |
|---|---|
| `id` | 溢付款紀錄識別碼。 |
| `partnerId` | 發生溢付的商業夥伴 ID。 |
| `amount` | 溢付金額。 |
| `isResolved` | 是否已退款或轉為貸項通知。 |
| `resolvedBy` | 處理方式，例如 `REFUND` 或 `CREDIT_MEMO`。 |
| `createdAt` | 紀錄建立時間。 |

此憲法簡化模型與業主營運模組的 `OverpaymentPool` 不同：後者另有 `companyId`、`sourceValuationId`、`availableAmount`、`isFullyApplied`、`updatedAt`。兩者需確認是同一資金池的不同版本，還是收款端與業主 AR 的不同用途。

### BillingInvoiceMapping｜發票與請款勾稽

| 欄位 | 用途 |
|---|---|
| `mappedAmount` | 一張發票與請款單之間實際勾稽的金額，支援多對多及分次／跨月勾稽。 |

原憲法最初只明確提到 `mappedAmount` 及發票唯一範圍；模組與第五篇財務憲法現已同步加入 Invoice 與 BillingInvoiceMapping 欄位模型。

財務 Zod 另使用 `invoiceNumber`（發票字軌）、`reasonCode`（差異原因：無、容差沖銷、爭議短付、呆帳沖銷）、`expectedTotalAP`（預期應付總額）作驗證輸入；`CheckVoidSchema.checkId` 是作廢請求中的支票 ID，`voidReason` 對應付款單作廢原因。這些欄位並非全數在 PaymentLineItem 上持久化。

## 業主合約與營運進帳

### OwnerContract｜業主合約

| 欄位 | 用途 |
|---|---|
| `id` | 合約識別碼。 |
| `companyId`、`projectId` | 合約歸屬法人及專案 ID。 |
| `contractNo` | 合約編號。 |
| `contractType` | 主約或 VO 子合約。 |
| `pricingType` | 總價或單價承攬。 |
| `parentId` | VO 所屬主合約 ID。 |
| `currency` | 合約幣別。 |
| `contractAmount` | 合約總額。 |
| `targetMargin` | 目標毛利率警戒線。 |
| `clientId`、`shipToId`、`billToId`、`payerId` | 簽約業主、收貨方、發票方及實際付款方 ID。 |
| `recoupmentMode` | 預付款扣回模式：獨立流或預收池沖抵。 |
| `retentionMethod` | 保留款扣留方式。 |
| `retentionRate`、`retentionCapAmount` | 合約保留款比例及累計上限。 |
| `retentionInvoiceMode` | 保留款發票模式：全額或淨額。 |
| 預收款餘額 | 由共用 `PrepaymentLedger.balanceAmount` 彙總，不在合約重複保存。 |
| `taxToleranceAmount` | 合約層級稅額／平帳容差。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### ContractItem｜合約工項

| 欄位 | 用途 |
|---|---|
| `id` | 工項識別碼。 |
| `contractId` | 所屬合約 ID。 |
| `itemCode` | 工項代碼。 |
| `description` | 工項說明。 |
| `itemType` | 一般加項或追減項；減項以正數保存。 |
| `quantity`、`unitPrice` | 合約數量及單價。 |
| `lineAmount` | 工項合約金額。 |
| `cumulativeBilledQty`、`cumulativeBilledAmount` | 歷次累計計價數量及金額，用於超請檢查。 |

### BillingValuation｜業主估驗計價單

| 欄位 | 用途 |
|---|---|
| `id` | 計價單識別碼。 |
| `companyId`、`contractId` | 本期計價法人及所屬合約 ID。 |
| `periodName` | 估驗期別名稱。 |
| `isFinalPeriod` | 是否最後一期或提早結案期。 |
| `isReversal` | 是否紅字迴轉單，仍以正數輸入。 |
| `documentDate` | 憑證實際發生日。 |
| `postingDate` | 會計入帳日。 |
| `grossAmount` | 本期估驗總額。 |
| `retentionDeductionAmount` | 本期扣留保留款。 |
| `retentionReleaseAmount` | 本期請回／釋放保留款。 |
| `prepaymentAppliedAmount` | 本期沖抵業主預收款。 |
| `adminChargeOffAmt` | 管理者特批壞帳／折讓金額。 |
| `receivableAmount` | 計算後應收金額，供財務承接。 |
| `status` | 草稿、過帳、部分收款、已收款、爭議或作廢等狀態。 |
| `counterpartyNameSnapshot`、`counterpartyTaxIdSnapshot` | 過帳時業主名稱及統編快照，保留歷史憑證內容。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### BillingLineItem｜業主計價明細

| 欄位 | 用途 |
|---|---|
| `id` | 明細識別碼。 |
| `valuationId` | 所屬計價單 ID。 |
| `contractItemId` | 對應合約工項 ID。 |
| `billedQuantity` | 本期計價數量。 |
| `lineAmount` | 本期計價金額。 |

### OverpaymentPool｜業主溢付款池

| 欄位 | 用途 |
|---|---|
| `id` | 溢付款資料識別碼。 |
| `companyId`、`partnerId` | 溢付款法人及業主夥伴 ID；以業主法人為跨專案資金池維度。 |
| `sourceValuationId` | 產生溢付款的來源計價單 ID。 |
| `balanceAmount` | 可跨案場扣抵的溢付款餘額。 |
| `isFullyApplied` | 是否已全數扣抵。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

**規格提及、模型待補：**`taxTolerance` 是驗證輸入，對應資料模型為 `OwnerContract.taxToleranceAmount`；`VALUATION_ATTACHMENT_MODE`、`hasAttachments` 是附件驗證條件而非計價單欄位；未定義溢付款跨案場扣抵明細模型。

## 通用附件與無紙化歸檔

### SystemFile｜Vault 實體檔案

> **檔案與資料庫分離鐵律**：
> - 資料庫內嚴禁以 BLOB 二進位欄位儲存任何大檔案，確保資料庫本體永遠維持數十 MB 極速運行。
> - 資料庫僅存放中繼資料 (Metadata)、SHA-256 完整性雜湊值與**相對存放路徑 (`storagePath`)**。
> - 搬案移機時，僅需複製程式根目錄下之 `storage/` 資料夾，所有相對路徑 100% 保持有效。

| 欄位 | 用途 |
|---|---|
| `id` | 檔案識別碼 (UUID)。 |
| `companyId` | 檔案歸屬法人。 |
| `originalName`、`savedName` | 原始檔名及實體儲存名；後者 UUID 化且唯一。 |
| `fileHash` | SHA-256 指紋，用於防篡改校驗及實體去重（同雜湊檔案不重複佔用空間）。 |
| `mimeType` | 實際 MIME 類型，用於檔案安全檢查。 |
| `sizeBytes` | 檔案大小（位元組）。 |
| `storagePath` | **實體相對路徑**（如 `storage/public_docs/2026/10/uuid.pdf` 或 `storage/secure_vault/2026/10/uuid.enc`）。 |
| `isEncrypted` | **機敏文件加密標記**（`BOOLEAN`；`true` 表示敏感文件，採 AES-256-GCM 實體加密存放，讀取時串流解密；`false` 則依分類存放於公開/非敏感目錄）。 |
| `parentFileId` | 前一版本檔案 ID，建立版本堆疊。 |
| `isObsolete` | 舊版或作廢附件標記。 |
| `status` | 檔案健康狀態，例如正常或遺失。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間（毫秒級 ISO-8601）。 |

### ExternalFolderLink｜Workspace 外部資料夾

| 欄位 | 用途 |
|---|---|
| `id` | 外部資料夾連結識別碼。 |
| `companyId` | 法人隔離欄位。 |
| `projectId`、`partnerId` | 專案及夥伴授權錨點。 |
| `targetTable`、`targetId` | 連結目標模型名稱及資料列 ID。 |
| `nasFolderPath` | NAS 上 CAD／DWG 等外部資料夾路徑。 |
| `description` | 資料夾用途說明。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### FileLink｜多型附件關聯

| 欄位 | 用途 |
|---|---|
| `id` | 附件關聯識別碼。 |
| `fileId` | 關聯的 Vault 檔案 ID。 |
| `projectId`、`partnerId`、`userId` | 專案、廠商及人資資料的授權穿透錨點。 |
| `targetTable`、`targetId` | 附件所屬模型名稱及資料列 ID。 |
| `isDeleted` | 軟刪除標記。 |
| `version` | 樂觀鎖版本。 |

**規格提及、模型待補：**附件授權規則要求 `FileLink` 具備 `companyId` 法人錨點，但模型範本未列出；實作前應確認是否補入，以符合跨法人附件權限檢核。

**路徑名稱差異：**PaaS 規格提及附件路徑欄位 `nasPath`；SystemFile 模型使用 `storagePath`，ExternalFolderLink 使用 `nasFolderPath`。應確認 Vault 實體檔與 Workspace 資料夾是否刻意分欄，或需要統一路徑欄位命名。

上傳／ZIP API 的非持久化輸入欄位：`targetTable`、`targetId`（指定附件目標）、`originalName`（原始檔名）、`mimeType`（上傳格式）、`sizeBytes`（檔案大小，API 限制 50 MB）、`companyId`、`projectId`、`partnerId`（授權條件）、`fileCountEstimate`（ZIP 預估檔數）、`totalSizeEstimateBytes`（ZIP 預估容量）。`sizeBytes` 同時也是 SystemFile 的實體欄位；上傳 schema 的同名值是請求輸入。

## 營運戰情室與決策支援

### CommandDashboardConfig｜個人化戰情看板

| 欄位 | 用途 |
|---|---|
| `id` | 看板設定識別碼。 |
| `companyId`、`userId` | 法人及使用者隔離／歸屬。 |
| `dashboardName` | 看板名稱。 |
| `visibleMetrics` | JSON 指標清單，決定顯示項目。 |
| `refreshInterval` | 背景更新間隔秒數。 |
| `isDeleted` | 軟刪除標記。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

戰情室查詢條件（非持久化欄位）：`companyId`（法人，空值表示集團總覽）、`dateFrom`／`dateTo`（查詢期間）、`projectId`（專案篩選）、`viewMode`（管理視角按 `documentDate`、稅務視角按 `postingDate` 彙總）。

## 商業級報表

### ReportJobTask｜報表背景工作

| 欄位 | 用途 |
|---|---|
| `id` | 報表工作識別碼。 |
| `requestedBy` | 請求者 ID，用於權限、DLP 額度及檔案歸屬。 |
| `reportType` | 專案損益、WIP、帳齡、稅務或年度總表等類型。 |
| `viewMode` | 現場管理或稅務報表視角。 |
| `parameters` | 查詢條件 JSON 快照。 |
| `status` | 待處理、處理中、完成或失敗。 |
| `progress` | 產製進度百分比。 |
| `vaultFileId` | 產出報表在 Vault 的檔案 ID。 |
| `expiresAt` | 下載連結／產出檔案到期時間。 |
| `errorMessage` | 產製失敗訊息。 |
| `createdAt`、`completedAt` | 工作建立及完成時間。 |

### ProjectReportSnapshot｜專案報表快照

| 欄位 | 用途 |
|---|---|
| `projectId` | 快照所屬專案 ID。 |
| `reportType` | 快照對應報表類型。 |
| `isDirty` | 資料變更髒標記；為真時需重算。 |
| `lastGeneratedAt` | 最近產製時間。 |
| `vaultFileId` | 快照檔案在 Vault 的 ID。 |
| `updatedAt` | 快照狀態最近更新時間。 |

### ReportSnapshot｜憲法版期間報表快照

憲法 BI 範本以期間及維度作唯一鍵，與模組中的專案快照 `ProjectReportSnapshot` 互補，並非相同模型。

| 欄位 | 用途 |
|---|---|
| `id` | 期間報表快照識別碼。 |
| `reportType` | 報表類型。 |
| `periodYear`、`periodMonth` | 快照所屬年度及月份。 |
| `dimension` | 報表維度，如全集團或特定專案。 |
| `isDirty` | 是否需重新計算。 |
| `lastGeneratedAt` | 最近計算時間。 |
| `vaultFileId` | 快照報表檔案在 Vault 的 ID。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

### ReportAuditLog｜報表調閱稽核

| 欄位 | 用途 |
|---|---|
| `id` | 報表調閱稽核識別碼。 |
| `userId` | 查詢或匯出的使用者 ID。 |
| `actionType` | 行為類型，如檢視戰情室或匯出 Excel。 |
| `queryParameters` | JSON 查詢條件快照，記錄查詢範圍。 |
| `ipAddress` | 操作者來源 IP。 |
| `createdAt` | 調閱／匯出時間。 |

### BI／財務計算及查詢輸入（非持久化欄位）

| 欄位 | 用途 |
|---|---|
| `v1Budget` | BvA 原始預算輸入。 |
| `approvedVOBudget` | 已核准 VO 追加預算輸入。 |
| `actualCost`、`committedCost` | 已過帳實際成本及已承諾未請款成本輸入。 |
| `dynamicTotalBudget`、`remainingBudget`、`isOverBudget` | 由 BvA 公式計算的總預算、剩餘額及超支旗標。 |
| `currentBankBalance`、`projectedAR`、`projectedAP` | 現有銀行餘額、預測應收及預測應付。 |
| `unclearedChecks` | 尚未兌現票據金額。 |
| `estimatedVAT` | 預測營業稅金額。 |
| `recurringExpenses` | 薪資、租金等固定支出預測。 |
| `projectedNetCash` | 由現金雷達公式算出的預測淨現金。 |
| `dateFrom`、`dateTo`、`companyId` | 報表匯出期間及法人篩選條件。 |
| `isVipBypass` | 是否要求 SuperAdmin 即時串流匯出。 |

報表請求的非持久化欄位：`reportType`、`viewMode`、`isVipBypass`（SuperAdmin 即時串流要求）、`filters.projectId`、`filters.companyId`、`filters.year`、`dailyExportLimit`（從使用者權限讀取的每日匯出上限）。

**快照差異：**PaaS 的 `SysReportSnapshot`、BI 憲法的 `ReportSnapshot`、報表模組的 `ProjectReportSnapshot` 具有不同識別鍵與維度，須決定其責任邊界；不可只因皆有 `isDirty`、`vaultFileId` 就直接合併。

## 共用欄位與命名決議

> 本節是本欄位總表採用的共用欄位契約。前文保留原模型的欄位用途及位置；已決議欄位名稱已同步到對應模組／憲法的 Prisma 範本。此處不代表已執行實際資料庫 migration。

### 法人、交易對象與專案歸屬

| 標準欄位 | 定義與使用規則 | 原欄位／處理 |
|---|---|---|
| `purchasingCompanyId` | 採購單的名義發單法人，記錄由哪家公司向供應商下單。 | 沿用採購模組欄位。 |
| `buyerCompanyId` | 發票買受方為本集團法人時所引用的公司 ID；進項發票通常使用。 | 共用 Invoice 主檔中表達買受方法人；原規格的 `invoiceCompanyId` 在進項情境對應此欄位。 |
| `taxReportingCompanyId` | 本系統負責申報／入帳該張發票的法人；進項通常等於 `buyerCompanyId`，銷項通常等於 `issuerCompanyId`。 | 共用 Invoice 的法人歸戶欄位，不依發票方向改變語意。 |
| `companyId` | 單一法人所屬交易、付款或帳務資料的法人範圍。已歸戶 AP／付款應與所引用發票的 `taxReportingCompanyId` 一致；不可拿來代替採購下單法人。 | 維持既有通用欄位，但各模型需註明所代表的法人角色。 |
| `vendorId` | 供應商／下包商商業夥伴 ID。 | 沿用既有欄位。 |
| `customerId` | 客戶商業夥伴 ID。 | 報價模組沿用；合約角色採更明確的四方欄位。 |
| `clientId` | 簽約業主商業夥伴 ID。 | Project／OwnerContract 的簽約角色。 |
| `shipToId` | 收貨方商業夥伴 ID。 | 保留為獨立交易角色。 |
| `billToId` | 發票抬頭對象 ID。 | 保留為交易對象角色；Invoice 以 `buyerPartnerId` 或 `buyerCompanyId` 表示買受方，申報法人另用 `taxReportingCompanyId`。 |
| `payerId` | 實際付款方商業夥伴 ID。 | 保留為獨立交易角色，不與簽約方合併。 |
| `projectId` | 專案／案場歸屬。採購成本歸屬以採購明細為準。 | 採購單頭可有預設專案；每筆 `PurchaseOrderItem.projectId` 為成本歸屬依據。 |

### 發票主檔與請款勾稽

發票是共用憑證資料，不由付款、採購、估驗等模組各自重複輸入一份。發票主檔記錄發票事實；請款／應付單記錄業務與應付事實；兩者透過勾稽資料連結。

#### Invoice｜共用發票主檔欄位

| 標準欄位 | 用途 |
|---|---|
| `id` | 發票識別碼，供各模組引用。 |
| `invoiceType` | 發票方向／用途，例如進項或銷項。 |
| `invoiceNumber` | 發票字軌號碼。 |
| `invoiceDate` | 發票開立日期。 |
| `taxReportingCompanyId` | 本系統負責申報／入帳該張發票的法人；進項通常等於買受方法人，銷項通常等於開立方法人。 |
| `issuerCompanyId` | 本集團法人為發票開立方時的公司 ID；銷項發票通常使用。 |
| `issuerPartnerId` | 外部供應商等商業夥伴開立發票時的夥伴 ID；與 `issuerCompanyId` 依方向擇用。 |
| `buyerCompanyId` | 本集團法人為發票買受方時的公司 ID；進項發票通常使用。 |
| `buyerPartnerId` | 外部客戶／夥伴為發票買受方時的夥伴 ID；與 `buyerCompanyId` 依方向擇用。 |
| `issuerTaxId` | 開立方統編快照；用於發票查核及唯一性檢查。 |
| `buyerTaxId` | 買受方統編快照；保留發票當時抬頭資料。 |
| `netAmount` | 發票未稅金額。 |
| `taxAmount` | 發票稅額。 |
| `totalAmount` | 發票含稅總額，應等於未稅額加稅額並依稅務規則驗證。 |
| `currency` | 發票幣別。 |
| `status` | 發票狀態，例如有效、作廢或折讓處理中。 |
| `createdAt`、`updatedAt` | 建立及最近更新時間。 |

唯一性建議以 `(taxReportingCompanyId, issuerTaxId, invoiceNumber)` 為範圍，避免不同法人帳務範圍或開立方的號碼混淆。原憲法使用 `(companyId, vendorTaxId, invoiceNumber)`；整理後 `vendorTaxId` 改為較通用的 `issuerTaxId`，Invoice 的法人唯一範圍改為方向中立的 `taxReportingCompanyId`。原規格中的 `invoiceCompanyId` 在進項發票表示買受方法人，對應 `buyerCompanyId`。

#### BillingInvoiceMapping｜發票與來源單據勾稽

| 標準欄位 | 用途 |
|---|---|
| `id` | 勾稽資料識別碼。 |
| `invoiceId` | 共用發票主檔 ID。 |
| `sourceDocumentType` | 來源單據類型，例如 AP 請款、業主 AR 計價或其他憑證。 |
| `sourceDocumentId` | 來源請款／應付／應收單據 ID。 |
| `mappedAmount` | 此發票分配至該來源單據的勾稽金額；一張發票可對多張單據，一張單據亦可由多張發票勾稽。 |
| `createdAt` | 建立勾稽時間。 |

`ProgressBilling.invoiceNumber` 與付款請求中的 `invoiceNumber` 是原規格的輸入方式；整理後應改為引用 `invoiceId` 或透過 `BillingInvoiceMapping` 查詢，不在各模組重複保存一份發票主檔資料。付款記錄沖抵的是 AP／請款單，不直接把發票總額當成付款金額。

### 金額欄位統一命名

下列名稱代表不同財務事實，不可互相覆蓋；各單據依需要使用，不要求所有模型都配置全部欄位。

| 標準欄位 | 固定語意 | 原欄位／需調整處 |
|---|---|---|
| `netAmount` | 單據或發票未稅金額。 | 保留既有名稱；確認均不表示應付／應收淨額。 |
| `managementContractAmount` | Project 管理帳的真實合約總額。 | 對應 Project 原 `managementAmount`。 |
| `taxInvoiceAmount` | Project 稅務帳的官方開票總額。 | 對應 Project 原 `taxAmount`；避免與稅額本身混淆。 |
| `taxAmount` | 稅額本身。 | 發票及交易單據使用；不可用來表示官方開票總額。 |
| `totalAmount` | 該文件本身的含稅／總金額；Invoice 上明確為發票含稅總額。 | 不代表合約上限、付款淨額或單一付款分配額。 |
| `lineAmount` | 一筆明細列的金額。 | 採購 `subtotal`、合約工項 `amount`、收款計價明細等同義用途可採此名；特有歷史欄位可在映射表保留。 |
| `contractAmount` | 合約核定金額。 | `originalAmount` 等原始合約值可保留其原始／目前狀態語意。 |
| `contractCeilingAmount` | 累計變更後可請款的合約天花板。 | Subcontract 的 `currentAmount` 改用此名稱。 |
| `periodAmount` | 本期估驗／請款金額。 | ProgressBilling 的 `currentAmount` 改用此名稱。 |
| `cumulativeAmount` | 截至本期的累計請款金額。 | 保留明確的累計語意，不以 `totalAmount` 代替。 |
| `payableAmount` | 應付供應商／下包商的金額。 | AP 方向使用，不與 AR 共用 `netPayable`。 |
| `receivableAmount` | 應收客戶／業主的金額。 | AR 方向使用，不與 AP 共用 `netPayable`。 |
| `paidAmount` | 已實際支付／收取的累計金額。 | 不等於應付／應收，也不等於單次沖抵。 |
| `balanceAmount` | 仍未清償的餘額。 | 由來源應收付金額及已沖銷交易計算／維護。 |
| `appliedAmount` | 本次付款或收款實際沖抵來源應收付單據的金額。 | 保留 PaymentLineItem 現有明確名稱。 |
| `prepaymentAppliedAmount` | 本張估驗／計價單由預付款台帳扣抵的金額。 | 來源台帳以 `appliedAmount` 記錄已沖抵累計；單據欄位只記錄本次扣回值。 |
| `prepaidAmount` | 預付款／預收款的原始金額。 | 對應 PrepaymentLedger 的 `originalAmount`；供應商品項批次價格與數量存於同一台帳明細。 |
| `retentionDeductionAmount` | 本期扣留的保留款。 | `retentionAmount` 或 `retainageDeduction` 依原模型語意映射至此。 |
| `retentionReleaseAmount` | 本期釋放／請回的保留款。 | BillingValuation 的 `retentionReleaseAmt` 改用此名稱。 |
| `retentionBalanceAmount` | 尚未釋放的累計保留款餘額。 | 不與本期扣留或本期釋放金額混用。 |
| `retentionMethod` | 合約保留款計算方式，統一列舉為 `PER_PERIOD`、`FINAL_MILESTONE`、`MANUAL`、`NONE`。 | Project 原 `retentionType=PERCENTAGE` 映射為 `PER_PERIOD` 並搭配 `retentionRate`；`MANUAL`、`NONE` 原值沿用。不得與 `retentionRate` 比例欄位混用。 |

原模組名稱 `currentAmount` 有兩種完全不同的意思：發包合約的目前上限及估驗單的本期金額。因此不能全域沿用；分別以 `contractCeilingAmount` 和 `periodAmount` 表達。

### 預付款及保留款共用資料

#### PrepaymentLedger｜預付款／預收款交易台帳欄位

| 標準欄位 | 用途 |
|---|---|
| `id` | 預付款交易識別碼。 |
| `companyId` | 該筆預付款所屬法人。 |
| `partnerId` | 收款／付款對象。 |
| `advanceDirection` | 明確區分付給供應商的預付款，或收到客戶的預收款。 |
| `sourceDocumentType`、`sourceDocumentId` | 原始付款、收款或合約來源。 |
| `transactionDate` | 預付款實際發生日期。 |
| `originalAmount` | 原始預付／預收金額。 |
| `appliedAmount` | 已沖抵金額。 |
| `balanceAmount` | 尚未沖抵餘額。 |
| `currency` | 幣別。 |

供應商備料的 `itemId`、`unitPrice`、`remainingQty` 與金額餘額統一存於 PrepaymentLedger 明細，不再另建 VendorItemWallet 或 PrepaidMaterialLedger 維護重複餘額。業主預收款餘額由同一台帳依 `advanceDirection` 彙總，不在 OwnerContract 重複保存。

合約的 `retentionRate` 與 `retentionMethod` 是設定值；各期扣留、釋放事件由共用台帳保存，單據以來源關聯，不另維護互相獨立的累計餘額。

#### RetentionLedger｜應收／應付保留款台帳欄位

| 標準欄位 | 用途 |
|---|---|
| `id` | 保留款事件識別碼。 |
| `companyId` | 該筆保留款所屬法人。 |
| `direction` | `AR` 表示業主應收保留款，`AP` 表示下包應付保留款。 |
| `contractId` | 對應業主合約或發包合約。 |
| `sourceDocumentType`、`sourceDocumentId` | 產生本次扣留或釋放的估驗／付款來源單據。 |
| `retentionDeductionAmount` | 本次新增扣留金額。 |
| `retentionReleaseAmount` | 本次釋放金額。 |
| `balanceAmount` | 本事件後尚未釋放的保留款餘額。 |
| `transactionDate` | 本次扣留／釋放事件日期。 |
| `currency` | 保留款幣別。 |
| `createdAt` | 台帳事件建立時間。 |

來源單據上的原保留款欄位是原規格現況；整理後以單據關聯 RetentionLedger 作為共用記錄來源，避免另外維護一份不一致的總餘額。

### 主檔名稱與歷史快照

| 用途 | 標準欄位 | 使用規則 |
|---|---|---|
| 商業夥伴現行名稱 | `BusinessPartner.name` | 主檔唯一標準名稱；憲法版 `globalName` 視為同一概念，不另存第二份名稱。 |
| 過帳時對象名稱 | `counterpartyNameSnapshot` | 保存該張歷史單據過帳時的對象名稱。 |
| 過帳時對象統編 | `counterpartyTaxIdSnapshot` | 保存該張歷史單據過帳時的對象統編。 |
| 專案歷史名稱 | `projectNameSnapshot` | 若憑證依法需固定列印當時專案名稱，過帳時保存快照。 |

快照是歷史憑證資料，不是另一份可編輯主檔；原 `postedClientName`、`vendorSnapshotName`、`postedClientTaxId`、`vendorSnapshotTaxId` 等欄位歸入快照語意，實際資料表可依交易方角色保留具體欄位名。

### 專案成本歸屬規則

採購案場成本歸屬以 `PurchaseOrderItem.projectId` 為準；專案採購明細過帳時此欄必填，草稿階段可暫缺。若同一品項需供不同案場使用，輸入時拆為多筆明細，例如 20kg 拆成 A 案 15kg、B 案 5kg；數量總和仍為 20kg。`GoodsReceiptItem.poItemId` 關聯回採購明細以承接案場，不在付款明細重複輸入專案。付款沖抵來源 AP 單據後沿來源追溯成本歸屬，因此整理後的付款明細不需要額外 `projectId` 分攤欄位。中央庫存或未指定案場的進貨不在本次既定流程範圍；此階段不建立專案分攤表。

### 日期欄位維持用途區分

| 欄位 | 用途 | 規則 |
|---|---|---|
| `invoiceDate` | 發票開立日期。 | 發票主檔專用。 |
| `documentDate` | 一般交易憑證／來源單據發生日。 | 若已知是發票，優先使用 `invoiceDate`。 |
| `postingDate` | 會計認列入帳日期。 | 供關帳及稅務視角查詢，不與發生日合併。 |
| `receivedDate` | 貨物實際收貨日期。 | 收貨事件日期。 |
| `issueDate` | 支票開立日期。 | 票據生命週期日期。 |
| `expectedClearanceDate` | 預計兌現日期。 | 現金流預測日期。 |
| `actualClearanceDate` | 實際兌現日期。 | 銀行對帳日期。 |

## 跨模組重複欄位索引

下表標示同名欄位的使用位置；同名不代表語意或來源完全相同，應依各模型定義解讀。

| 欄位 | 使用模組／模型 | 用途 |
|---|---|---|
| `id` | 全域參數與數據防禦、核心架構與資安、專案與案場、合作夥伴與料件、報價與銷售、採購與發包、發包合約與估驗、財務會計與金流、業主合約與營運、附件歸檔、營運戰情室、商業級報表 | 各資料列識別碼。 |
| `companyId` | 交易範本、使用者法人關聯、夥伴法人覆寫、Quotation、Subcontract、ProgressBilling、附件檔案／資料夾、戰情看板、付款、暫收款、業主合約／計價、溢付款池、報表篩選 | 法人歸屬；採購下單角色用 `purchasingCompanyId`，發票申報法人用 `taxReportingCompanyId`。已歸戶 AP／付款的 `companyId` 應與所勾稽發票法人一致。 |
| `projectId` | 專案主檔／成員／預算、合作夥伴記點、報價、採購單／明細、發包合約、業主合約／附件、戰情查詢、報表快照 | 專案歸屬、授權及成本／報表彙總；付款沖抵沿來源 AP 追溯，不重複輸入分攤欄位。付款明細版 `projectId` 是憲法候選欄位，不採為本次標準必要欄位。 |
| `taxReportingCompanyId` | Invoice | 本系統負責申報／入帳的法人；進項通常是買受法人，銷項通常是開立法人。 |
| `buyerCompanyId`、`issuerCompanyId` | Invoice | 本集團公司作為發票買受方或開立方時的公司 ID。 |
| `buyerPartnerId`、`issuerPartnerId` | Invoice | 外部商業夥伴作為發票買受方或開立方時的夥伴 ID。 |
| `invoiceCompanyId` | 原採購／進項規格欄位 | 進項情境代表發票買受法人，對應標準 `buyerCompanyId`；不可作為進項與銷項共用的申報法人欄位。 |
| `purchasingCompanyId` | PurchaseOrder | 名義發單法人，可與發票買受法人不同。 |
| `invoiceId` | BillingInvoiceMapping 及引用發票的 AP／AR 單據 | 共用發票主檔識別碼；其他模組引用，不複製發票資料。 |
| `invoiceNumber` | 共用 Invoice；部分 API 仍可能以號碼作查找輸入 | 持久化欄位只在 Invoice；請款／付款單以發票 ID 及勾稽資料關聯，不在單據重複保存。 |
| `invoiceDate` | 共用 Invoice | 發票開立日期；與一般憑證日期及會計入帳日分開。 |
| `issuerTaxId`、`buyerTaxId` | 共用 Invoice | 發票雙方統編快照；`issuerTaxId` 取代僅供供應商方向使用的 `vendorTaxId`。 |
| `mappedAmount` | BillingInvoiceMapping | 發票與 AP／AR 來源單據間的勾稽金額，不等同發票總額或付款額。 |
| `invoiceType` | Invoice | 區分進項／銷項等發票方向。 |
| `userId` | UserCompanyAccess、ProjectMember、AuditLog、FileLink、CommandDashboardConfig、ReportAuditLog | 使用者身分、專案成員歸屬、操作審計或附件權限。 |
| `bpId` | BPCompanyOverride、BPBankAccount、BPScorecardLog | 商業夥伴主檔的覆寫設定、銀行帳戶或評鑑紀錄外鍵。 |
| `vendorId` | 商業夥伴關聯、VendorItemUoM、採購單、預付備料帳、發包合約、廠商錢包 | 供應商或下包商識別。 |
| `partnerId` | 夥伴法人覆寫、附件授權、付款、溢付款池、外部資料夾 | 商業夥伴識別；溢付款池中代表業主法人。 |
| `itemId` | VendorItemUoM、PrepaymentLedger | 供應商單位換算及供應商預購台帳所指向的料件。 |
| `quotationId` | QuotationItem、QuotationClause、QuotationBillingMilestone | 明細、條款快照及請款里程碑所屬的報價單。 |
| `contractId` | SalesChangeOrder、ContractItem、BillingValuation | 銷售變更單或業主合約工項／估驗單所屬合約。各模型的合約類型不同。 |
| `paymentId` | PaymentLineItem、CheckDetail | 付款明細及支票生命週期所屬付款單。 |
| `parentId` | Project、OwnerContract | 分別建立 WBS 專案階層及 VO 主約／子約關係。 |
| `status` | User、BusinessPartner、Project、Quotation、PurchaseOrder、GoodsReceipt、Subcontract、ChangeOrder、ProgressBilling、PaymentRecord、CheckDetail、BillingValuation、SystemFile、ReportJobTask | 各模型各自的狀態機，狀態值不可跨模型直接假設相同。 |
| `isDeleted` | SystemConfig、交易範本、Company、User、Role、Project／成員／預算、BusinessPartner、地址／聯絡人、Item、PO／明細／收貨／預付帳、Quotation、PaymentRecord、OwnerContract、BillingValuation、SystemFile、ExternalFolderLink、FileLink、CommandDashboardConfig | 軟刪除及查詢過濾，不等同單據作廢狀態。 |
| `version` | SystemConfig、交易範本、Company、User、Role、Project／成員／預算、BusinessPartner、Item、PO、預付備料帳、Quotation、PaymentRecord、OwnerContract、BillingValuation、附件模型 | 樂觀鎖；CPQ 憲法版另稱 `lockVersion`；並非每個明細模型都有此欄位。 |
| `createdAt` | 多數主檔、單據及關聯紀錄 | 建立時間。 |
| `updatedAt` | 多數具維護生命週期的主檔、單據、設定及快照 | 最近更新時間；純新增型明細不一定配置。 |
| `createdBy` | SystemConfig、ExampleTransactionDocument、BusinessPartner、Quotation 憲法版、InternalVirtualCashPool | 建立者追蹤。 |
| `updatedBy` | SystemConfig、ExampleTransactionDocument、BusinessPartner、Quotation 憲法版 | 最近更新者追蹤。 |
| `documentDate` | PaymentRecord、BillingValuation、戰情室及報表視角 | 單據實際發生日；管理視角彙總基準。 |
| `postingDate` | PaymentRecord、BillingValuation、戰情室及報表視角 | 會計入帳日；稅務視角及關帳依據。 |
| `isIntercompany` | ExampleTransactionDocument、PurchaseOrder、Subcontract、PaymentRecord | 集團內部交易標記及合併抵銷依據。 |
| `isReversal` | PaymentRecord、BillingValuation | 標示付款迴轉單或業主計價迴轉單。 |
| `isTaxExclusive` | ProjectContract、Subcontract、ProgressBilling | 標示合約或本期估驗金額的稅額計價方式。 |
| `itemType` | QuotationItem、PurchaseOrderItem、ChangeOrder、ProgressBillingItem、ContractItem、PaymentLineItem | 各模型用於區分加減項或材料／服務；列舉語意依模型而異。 |
| `quantity` | QuotationItem、PurchaseOrderItem、ContractItem | 報價、採購及業主合約工項數量；收貨及估驗另保留 `receivedQuantity`、`billedQuantity` 表示各自事件數量。 |
| `unitPrice` | PurchaseOrderItem、PrepaymentLedger、ContractItem | 一單位價格；CPQ 對外報價明確使用 `quotedUnitPrice`，成本使用 `estimatedUnitCost`。 |
| `amount` | ChangeOrder、InternalVirtualCashPool、憲法版 OverpaymentPool | 發包變更額、內部資金收支額或溢付款額，語意依模型而異。 |
| `currency` | ExampleTransactionDocument、PaymentRecord、OwnerContract | 交易單據、付款及業主合約的幣別。 |
| `netAmount` | Invoice、ExampleTransactionDocument、Quotation、PurchaseOrder | 未稅金額；標準語意固定為稅前金額。 |
| `managementContractAmount` | Project | 管理帳真實合約總額；對應原 `managementAmount`。 |
| `taxInvoiceAmount` | Project | 稅務帳官方開票總額；對應原 Project `taxAmount`，與稅額本身分開。 |
| `taxAmount` | Invoice、ExampleTransactionDocument、Quotation、PurchaseOrder、ProgressBilling | 稅額本身；Project 原欄位表示官方開票總額，整理後改稱 `taxInvoiceAmount`。 |
| `totalAmount` | Invoice、ExampleTransactionDocument、Quotation、PurchaseOrder | 文件總額；OwnerContract 使用 `contractAmount`，預付款使用 `originalAmount`／`balanceAmount`。 |
| `lineAmount` | 採購、報價、合約及計價明細 | 單筆明細金額；對照舊 `subtotal`、`amount`、`totalPrice`、`billedAmount` 時須確認同為該列最終金額。 |
| `periodAmount` | ProgressBilling | 本期請款金額；對應原 `currentAmount`。 |
| `contractCeilingAmount` | Subcontract | 已計入變更單的合約請款上限；對應原 `currentAmount`，與本期金額分開。 |
| `payableAmount` | AP／供應商付款來源單據 | 應付方向金額，取代模糊的通用淨額名稱。 |
| `receivableAmount` | AR／業主計價來源單據 | 應收方向金額，取代模糊的通用淨額名稱。 |
| `paidAmount`、`balanceAmount` | 應收付台帳／付款收款彙總 | 分別表示已收付累計及未清償餘額；不與應付／應收原額或單次沖抵額共用。 |
| `appliedAmount` | PaymentLineItem／收款沖銷明細 | 本次實際沖抵金額；保留既有明確語意。 |
| `retentionDeductionAmount` | ProgressBilling、BillingValuation | 本期扣留保留款；合約 `retentionRate` 是規則，不與此交易金額混用。 |
| `retentionReleaseAmount` | BillingValuation 及下包估驗 | 本期釋放／請回保留款；對應原 `retentionReleaseAmt`。 |
| `retentionBalanceAmount` | 保留款台帳／合約彙總 | 累計尚未釋放餘額。 |
| `retentionMethod` | Project／各類合約 | 保留款計算模式；原 `retentionType` 對應統一列舉。 |
| `advanceDirection` | PrepaymentLedger | 區分供應商預付款與客戶預收款方向。 |
| `counterpartyNameSnapshot`、`counterpartyTaxIdSnapshot` | 過帳交易／發票 | 對手方名稱及統編的過帳時快照，不取代可變更的 BusinessPartner 主檔。 |
| `netPayable` | ProgressBilling、BillingValuation | 原模組中 AP 與 AR 共用的名稱；整理後分別採 `payableAmount` 與 `receivableAmount`。 |
| `isFinalPeriod` | ProgressBilling、BillingValuation | 分別代表下包估驗、業主計價的最後一期。 |
| `prepaidAmount`、`appliedAmount`、`balanceAmount` | PrepaymentLedger | 原始預付／預收額、已沖抵額及未沖抵餘額；共用台帳依方向區分供應商預付與客戶預收。 |
| `isPrepaidDeduction` | PurchaseOrderItem、ProgressBillingItem | 原始欄位標記明細是否使用預付款；若有扣抵交易，金額與來源應以台帳勾稽為準，旗標不作餘額來源。 |
| `vaultFileId` | SysReportSnapshot、ReportJobTask、ProjectReportSnapshot、ReportSnapshot | 報表實體檔在 Vault 的識別碼。 |
| `reportType` | SysReportSnapshot、ReportJobTask、ProjectReportSnapshot、ReportSnapshot | 指定快照或背景工作的報表種類。 |
| `isDirty` | SysReportSnapshot、ProjectReportSnapshot、ReportSnapshot | 標示報表快照是否因來源資料異動而需重算。 |
| `periodYear`、`periodMonth` | SysReportSnapshot、ReportSnapshot | 期間型報表快照的年度及月份。 |
| `dimension` | SysReportSnapshot、ReportSnapshot | 快照彙總維度，如個別專案或全集團。 |
| `lastGeneratedAt` | SysReportSnapshot、ProjectReportSnapshot、ReportSnapshot | 快照最近產製時間。 |
| `requestedBy` | SysReportSnapshot、ReportJobTask | 報表快照或背景產製工作的請求者。 |
| `targetTable`、`targetId` | FileLink、ExternalFolderLink、附件上傳／ZIP 請求 | 多型附件或資料夾關聯目標。 |

## 檢查後確認的待建模需求

下列不是已定義的 Prisma 欄位，而是原始需求明確要求、但尚無完整資料模型或欄位契約的項目。建議在正式建表前先確認責任模組及欄位名稱。

| 所屬模組 | 尚未完整落模的資料需求 |
|---|---|
| 專案與案場管理 | 收入 SOV、支出 Cost WBS、兩者的比例映射、預算流用單、資金帳及差額科目、保固成本明細仍待定義模型。保留款欄位已同步至 Project／合約模型並由 RetentionLedger 記錄事件。 |
| 合作夥伴、料件與防弊內控 | 公司別預設付款帳戶／預設帳戶覆寫、替代受款人及拆分付款資料；現有 `BPCompanyOverride` 只有付款天數及信用額度欄位。 |
| 採購與發包 | GR/IR 暫估欠款及發票後轉 AP 的資料模型、尾差人工覆核紀錄、Landed Cost 分攤資料仍待建模。採購列依確認規則以必填 `PurchaseOrderItem.projectId` 歸案並以明細拆分跨案，不建付款分攤表；發票法人由 Invoice 歸戶，收貨狀態以勾稽資料推導。 |
| 財務會計與金流 | Invoice、BillingInvoiceMapping、PrepaymentLedger、RetentionLedger 已加入模組與財務憲法欄位契約。貸／借項通知、分錄、超齡暫估結案、固定支出排程、預測 VAT 與 GR/IR Liability 尚無完整 Prisma 模型；財務及 AR 兩種 OverpaymentPool 欄位形態仍需決定是否合併。 |
| 營運戰情室與決策支援 | 機具內部日租及調度成本、總部管理費分攤、pending CO、各日資金預測事件等需求尚未定義可持久化模型；目前多為計算規則或顯示需求。 |
| 通用附件與無紙化歸檔 | `FileLink.companyId` 被規則要求但 Schema 漏列；Vault 的 `storagePath`、Workspace 的 `nasFolderPath` 與規格中的 `nasPath` 命名／責任邊界待統一。 |
| 報表與快照 | `SysReportSnapshot`、`ReportSnapshot`、`ProjectReportSnapshot` 的主鍵、期間、維度及更新責任不同，需決定是否為三種用途或歷史版本；不應僅憑欄位相似而合併。 |

## 整理範圍備註

1. 前文模型欄位保留原始規格名稱供追溯；「共用欄位與命名決議」列出整理後標準名稱及映射，兩者不可誤認為原始 Prisma 已完成改名。
2. 不推定所有模型都具有 `isDeleted`、`version`、`createdAt` 或 `updatedAt`；僅按原範本實際欄位列出。
3. 業務敘述或 Zod 中出現、但不是 Prisma 實體欄位的驗證輸入，標示為非持久化資料或待補模型欄位。