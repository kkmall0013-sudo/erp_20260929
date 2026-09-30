# 企業級營造工程 ERP - 三層式權限架構與自訂群組矩陣規劃

本規劃方案旨在針對營造工程 ERP 建立嚴謹且具擴充性的「三層式身分權限架構（Superadmin / Admin / User 群組）」與「自訂模組權限矩陣（PBAC）」，確保單一最高管理員防護、多位一般管理員分權維護、以及四大業務群組（工務、財務、採購、業務）與自訂群組的精確權限控管。

## 使用者確認決策摘要 (User Review & Confirmed Decisions)

> [!IMPORTANT]
> 依據前置澄清對話，已確認下列核心架構原則：

- **單一 Superadmin 唯一最高權限**：系統僅設 1 位 Superadmin 擁有無上限審核額度、底層系統參數變更、資料庫完整備份還原與防竄改保護。一般 Admin 無法修改、停用或刪除 Superadmin。
- **Admin 若干位分權治理**：支援建立多位 Admin，可維護一般同仁帳號、指派群組、重設密碼與檢視審計歷程，但受限於憲法級邊界保護。
- **預設四大業務 User 群組**：
  1. **工務組 (Site Engineering)**：案場日誌填報、工區料件點收、估驗草稿、施工進度維護。
  2. **財務會計組 (Finance & Accounting)**：應收應付憑單拆單、支票開立/兌現、發票稅額勾稽、資金水池預測。
  3. **採購發包組 (Procurement & Sourcing)**：材料供應商管理、採購單 PO 開立、原物料詢價與預付款沖銷。
  4. **專案業務組 (Project & Sales / CPQ)**：業主報價單 REV-A/B 維護、工程 WBS 預算節點控管、合約里程碑請款。
- **全動態自訂群組與模組權限矩陣**：支援即時新增/編輯自訂群組，以勾選矩陣設定各模組的「讀取 (Read)」、「修改 (Write)」、「核准 (Approve)」、「匯出 (Export)」與「單筆核准金額上限 (Approval Limit)」。

---

## 1. 系統概述與核心價值 (Overview & Core Concept)

- **核心目標**：建構符合營造工程實務內控稽核的權限管理平台，杜絕一般工程師跨越發包合約、未授權人員匯出業主個資或修改審批限額之風險。
- **適用對象**：
  - **Superadmin (董總高層/稽核主管)**：掌握全盤系統主控權與核心憲法規則。
  - **Admin (各工區所長/資訊主任)**：管理日常工地人員進出、帳號分發與群組授權。
  - **User (各功能同仁)**：依所屬群組獲得最少權限（Principle of Least Privilege），介面自適配屏蔽無權限之操作按鈕。
- **關鍵價值**：透過直觀的權限矩陣表與身分切換沙盒，讓管理人員可在 10 秒內完成群組調整，並具備完整變更審計（Audit Trail）。

---

## 2. 使用者體驗與視覺介面設計 (UX & Visual Design)

遵循 `frontend-design` 及 SaaS 控制台設計規範，採用高密度、無藥丸邊框、清晰標題與清晰層級：

### 關鍵操作流程 (Key User Flows)

1. **三層角色與群組總覽 (Dashboard View)**：
   - 頂部呈現三層階層卡：【唯一 Superadmin】（金金色徽飾、受保護鎖定）、【系統管理員 Admin (N位)】、【業務 User 群組 (4大內建 + 自訂群組)】。
   - 提供「群組權限矩陣視角」與「人員指派清單視角」即時切換。
2. **群組權限矩陣編輯器 (Group Matrix Modal / Drawer)**：
   - 橫軸：讀取 (Read)、建立/編輯 (Write)、單據核准 (Approve)、報表匯出 (Export)。
   - 縱軸：12 大營造工程核心模組（公司法人、專案案場、商業夥伴、報價CPQ、採購發包、下包合約、估驗計價、應付帳款、應收帳款、票據管理、全域參數、審計日誌）。
   - 底部設有核准金額上限設定滑桿/數字輸入框（如工務組 $0、採購專員 $2,000,000、專案經理 $5,000,000）。
3. **人員帳號分派與安全保護 (User Management Flow)**：
   - 建立同仁帳號時，可指定「身分角色」：若選 Admin 則賦予管理介面；若選 User 則下拉指派所屬群組。
   - 列表明確標記：若目標為 Superadmin，禁用「修改角色」、「停用」與「刪除」按鈕，並標註「系統唯一最高保護者」。

### 視覺色彩與排版規範 (Visual Language)

- **基底與背景**：Slate-50 乾淨背景，白底 Slate-200 1px 結構邊框。
- **三層色系區分**：
  - Superadmin：琥珀金調 (`text-amber-800 bg-amber-50 border-amber-200`)
  - Admin：深海藍調 (`text-indigo-800 bg-indigo-50 border-indigo-200`)
  - User Groups：專業青灰調 (`text-slate-800 bg-slate-50 border-slate-200`)
- **表格數字**：所有限額與人數強制採用 `font-mono tabular-nums` 對齊。

---

## 3. 關鍵產品決策與權衡 (Key Product Decisions)

- **決策一：單一 Superadmin 保障防呆**
  - *方案*：資料庫與介面層均實施唯一性約束。不允許指派第二位 Superadmin；若 Superadmin 需換人，必須由當前 Superadmin 親自執行「最高權限交接 (Transfer Superadmin)」，嚴禁直接刪除。
  - *理由*：防止多位同仁誤將他人提升為最高權限，導致稽核破口或不可逆損毀。
- **決策二：群組繼承與 PBAC 矩陣獨立存儲**
  - *方案*：新增 `user_groups` 資料表與 `group_module_permissions` 關聯表，User 帳號直接關聯 `groupId`；Admin 則獨立於業務群組之外，專注帳號審核與系統維運。
  - *理由*：群組異動時，該群組內所有數十位工程師權限即刻全域同步生效，無須逐一重設每位同仁帳號。
- **決策三：前端介面即時權限閘道 (Permission Guard Hook)**
  - *方案*：封裝 `usePermissions()` Hook 與 `<RequirePermission module="xxx" action="write">` 容器元件，依當前登入者身分動態隱藏/唯讀控制項。

---

## 4. 技術架構與資料模型 (Technical Architecture)

### 系統階層與元件架構圖

```
┌────────────────────────────────────────────────────────────────────────┐
│                        應用程式入口 (App.tsx)                          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│  頂部 Header │             │  側邊 Sidebar│             │  業務功能模組 │
│(身分標示/切換)│             │ (依權限過濾) │             │ (依矩陣防呆) │
└──────┬───────┘             └──────┬───────┘             └──────┬───────┘
       │                            │                            │
       └────────────────────────────┼────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             帳號權限管理中心 (UserPermissionModule.tsx)                │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────┐ │
│ │ 階層概覽 (Overview)  │ │ 人員名冊 (Users List)│ │ 群組矩陣 (Groups)│ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     本地 SQLite 資料庫 (sqlite.ts)                     │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────────────┐ │
│  │    users     │───▶│  user_groups │───▶│ group_module_permissions │ │
│  │ (三層身分結構)│    │ (4大內建+自訂)│    │   (12大模組 x 4項操作)    │ │
│  └──────────────┘    └──────────────┘    └───────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 資料模型擴充 (Schema Updates)

1. **`user_groups` (使用者權限群組表)**：
   - `id` TEXT PRIMARY KEY (e.g. `GRP-ENG`, `GRP-ACC`, `GRP-PROC`, `GRP-SALES`, `GRP-CUSTOM-xxx`)
   - `groupCode` TEXT UNIQUE NOT NULL
   - `groupName` TEXT NOT NULL (工務組、財務會計組...)
   - `description` TEXT
   - `isSystem` INTEGER DEFAULT 0 (系統預設群組防誤刪)
   - `approvalLimit` REAL DEFAULT 0 (審核金額上限)
   - `canExport` INTEGER DEFAULT 0 (匯出權限)
   - `createdAt`, `updatedAt`
2. **`group_module_permissions` (群組模組細項權限矩陣)**：
   - `id` TEXT PRIMARY KEY
   - `groupId` TEXT NOT NULL (關聯 `user_groups.id`)
   - `moduleKey` TEXT NOT NULL (e.g. `PROJECTS`, `QUOTATIONS`, `PURCHASE_ORDERS`, `VALUATIONS`, `FINANCE_AP`, `FINANCE_AR`, `BANK_CHECKS`, `SYSTEM_CONFIGS`, `AUDIT_LOGS`)
   - `canRead` INTEGER DEFAULT 0
   - `canWrite` INTEGER DEFAULT 0
   - `canApprove` INTEGER DEFAULT 0
3. **`users` (更新欄位架構)**：
   - `role`: `'SUPERADMIN' | 'ADMIN' | 'USER'` (三層架構)
   - `groupId`: TEXT NULLABLE (當 role === 'USER' 時關聯至 `user_groups.id`)
   - 擴充資料完整性修復器 (`ensureDatabaseIntegrity`)，平滑升級現有資料庫。

---

## 5. 實作步驟與交付檢核清單 (Implementation Steps)

- [ ] **Step 1: SQLite 架構與種子資料升級**
  - 在 `sqlite.ts` 新增 `user_groups` 與 `group_module_permissions` DDL。
  - 預置四大內建群組與 12 大模組權限矩陣。
  - 將既有帳號平滑遷移至 Superadmin、Admin、User 對應群組。
- [ ] **Step 2: 權限查詢與更新 API (Data Access Layer)**
  - 封裝 `getAllUserGroups()`、`createGroup()`、`updateGroupPermissions()`、`assignUserGroup()` 等函式。
  - 加入 Superadmin 防護邏輯（禁止降級或刪除）。
- [ ] **Step 3: 升級 `UserPermissionModule.tsx` UI**
  - 設計三層角色統計卡片（Superadmin 1人 / Admin N人 / User 群組）。
  - 新增「群組權限矩陣 (PBAC Matrix)」視覺化網格編輯器，支援即時勾選各模組權限。
  - 人員清單支援篩選角色、指定群組與一鍵身分模擬（Impersonate）。
- [ ] **Step 4: 全域權限防呆整合**
  - 在 `Sidebar` 與各業務模組中整合權限判斷（無權限時自動呈現遮蔽或唯讀狀態）。
- [ ] **Step 5: 驗證與編譯測試**
  - 執行 `compile_applet` 與 `lint_applet` 確保建置無誤。
