# 帳號刪除復原、降級防呆與特許授權嚴格控管實作規劃方案 (Account Deletion & Privilege Refinement)

本實作規劃方案針對使用者提出的三項核心問題與確認答覆進行完整架構升級：
1. **修正無法刪除帳號問題**：以系統內建置中防呆對話框（Centered Modal）替換在 iframe 環境中失效的 `window.confirm`，並新增「刪除後一鍵復原（Undo Restore）」功能。
2. **修正 Admin 降級 User 失敗問題**：修復 `updateUser` 中因非 Superadmin 帶入特許欄位引發的誤擋防禦，並在 Admin 降級為 User 時由後端原子交易自動收回並歸零所有特許項目（`canManageUsers=0, canManageSystemConfigs=0, canManageAdmins=0`），同時自動預指派業務群組避免檢核失敗。
3. **特許項目預設關閉與嚴格 Superadmin 專屬權限**：
   - 無論新增或修改，特許項目預設一律為關閉狀態。
   - 非 Superadmin 操作者之新增與編輯表單中，**完全隱藏特許授權區塊**。
   - 後端強制防竄改：非 Superadmin 建立或編輯帳號時，後端強制將特許欄位設為 0 或忽略，僅 Superadmin 有權開放。
4. **資料庫與用途總表同步更新**：將降級自動歸零規則與帳號復原機制同步登載於 `/ERP全模組資料庫欄位與用途總表.md`。

---

## 1. 問題成因分析與修復策略 (Root Causes & Solutions)

| 序號 | 使用者反饋問題 | 程式碼深層成因 | 解決修復方案 |
| :--- | :--- | :--- | :--- |
| **1** | **無法刪除帳號** | 原程式碼使用了原生 `window.confirm(...)`。在 AI Studio 的嵌入式 iframe 沙盒環境中，瀏覽器會靜默攔截原生對話框或預設返回 `false`，導致刪除邏輯永遠無法被觸發。 | **移除所有原生 `window.confirm`**，改用系統內建置中防呆確認視窗 `<DeleteUserConfirmModal />` (`z-[80]`)；刪除完成後提供 **10 秒 Toast 一鍵復原 (Undo Restore)** 功能。 |
| **2** | **無法把 Admin 降為 User** | ① 專人 Admin 提交編輯時，前端 payload 仍帶入 `canManageUsers` 等特許欄位，被 `updateUser` 判定為「非 Superadmin 嘗試修改特許」而拋出異常；<br>② 原 Admin 帳號之 `groupIds` 為空，降為 User 時未預選群組導致業務檢核受阻。 | ① 後端 `updateUser` 支援平滑降級：若角色變更為 `USER`，後端**自動歸零收回所有特許項目**，不拋出錯誤；<br>② 前端切換為 User 時自動預選業務群組，並於二次確認 Diff 表中明確標記角色變更與特許歸零。 |
| **3** | **特許項目預設關閉且僅 Superadmin 能開** | 目前表單在 ADMIN 角色下對所有登入者均渲染特許開關（雖然有部分 disabled），且預設值可能繼承原值。 | ① 新增與編輯表單中，**非 Superadmin 操作者完全隱藏特許授權區塊**（不可見不可點）；<br>② 新增同仁時特許預設一律為 `false`；<br>③ 後端嚴格校驗：非 Superadmin 建立或更新時，後端強制將特許欄位歸零防竄改。 |

---

## 2. 後端與 SQLite 資料庫層級更新 (`src/db/sqlite.ts`)

### A. 實作帳號復原功能 (`restoreUser`)
```typescript
// 復原遭刪除之人員帳號 (Undo Restore)
export function restoreUser(
  user: User,
  operatorName: string
): void {
  // 將暫存之同仁帳號資料重新寫入 users 表
  // 記錄審計日誌: RESTORE_USER
}
```

### B. 平滑處理 Admin 降級 User (`updateUser`)
- 檢測 `updateData.role === 'USER'` 且原角色為 `ADMIN`：
  - 自動於更新語句中加入：`canManageUsers = 0, canManageSystemConfigs = 0, canManageAdmins = 0`。
  - 若操作者非 Superadmin，不阻擋降級，只要該操作者具備帳號專人與同階特許即可完成降級。
- 若操作者非 Superadmin 且無意圖提升特許項目時，過濾忽略無實質變更的特許欄位，避免誤觸拋錯。

### C. 新增帳號預設特許防護 (`createUser`)
- 若操作者非 Superadmin，強制寫入 `canManageUsers = 0, canManageSystemConfigs = 0, canManageAdmins = 0`，無論前端傳入何值。

---

## 3. 前端介面與互動設計升級 (`AccountManagementWorkspace.tsx`)

### A. 置中防呆刪除確認彈窗 (Centered Delete Confirm Modal, `z-[80]`)
- 點擊列表之垃圾桶按鈕時：
  - 先通過 `checkCanManageTarget` 權限阻擋檢核（Superadmin 金身防護、專人權限、同階原則）。
  - 通過後彈出置中 `<DeleteConfirmModal />`：
    - 顯示目標人員姓名、帳號、職稱與身分角色。
    - 警示文字：「刪除後該同仁將無法再登入系統，但您可在 10 秒內於右下角提示中點選『一鍵復原』。」
    - 提供「取消」與「確認刪除」按鈕。

### B. 刪除後一鍵復原 Toast (Undo Feature)
- 確認刪除後，帳號資料暫存於 `deletedUserBuffer` 狀態中。
- 右下角彈出 Toast：`🗑️ 已刪除同仁【王工務】帳號。 [↩️ 一鍵復原 (8s)]`。
- 使用者點擊「一鍵復原」時立即呼叫 `restoreUser`，同仁帳號無損還原並重新載入列表。

### C. 角色降級表單互動優化
- 當使用者在編輯視窗中將角色從 `ADMIN` 點選切換為 `USER` 時：
  - 若目前 `formData.groupIds` 為空，自動帶入預設群組 `['GRP-ENG']`（工務組），確保符合「一般同仁必須至少隸屬一個業務群組」之規則。
  - 二次確認對話框明確列出：
    - 「身分層級角色：系統管理員 (ADMIN) ➔ 業務同仁 (USER)」
    - 「特許項目：所有進階特許已自動收回並歸零」

### D. 非 Superadmin 介面完全隱藏特許授權區
- 在表單中加入嚴格條件：
  ```tsx
  {isSuperadmin && formData.role === 'ADMIN' && (
    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-3">
      {/* 唯獨 Superadmin 可以看到並開啟特許項目 */}
    </div>
  )}
  ```
- 當登入者為一般 Admin 或非 Superadmin 時，新增/編輯畫面中**完全不顯示特許區塊**，從根本上杜絕越權或誤設。

---

## 4. 驗證步驟規劃

1. **驗證刪除與一鍵復原**：
   - 點擊一般 User 旁的刪除按鈕，確認彈出置中防呆對話框。
   - 點擊「確認刪除」，確認帳號從表格中消失，右下角出現復原 Toast。
   - 點擊「一鍵復原」，確認同仁帳號立刻恢復於表格中。
2. **驗證 Admin 降級 User**：
   - 以 Superadmin 登入，為特定 Admin 開放專人特許與同階特許。
   - 切換模擬登入為該專人 Admin。
   - 編輯另一位同階 Admin，點選切換為 USER，確認表單自動補足群組，儲存並通過二次確認，成功降級為 USER 且特許自動歸零。
3. **驗證非 Superadmin 畫面完全隱藏特許**：
   - 檢查專人 Admin 新增/編輯同仁時，表單內無特許開關區塊，預設建立之帳號特許全為 0。
4. **編譯與語法檢查**：
   - 執行 `compile_applet` 與 `lint_applet` 確保建置無誤。
