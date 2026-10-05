# 修復「Admin 停用自身帳號後自動切換為 Superadmin」資安防呆漏洞規劃

## 1. 問題根因剖析 (Root Cause Analysis)

這在正常系統中**絕對是不正常的嚴重資安防呆漏洞**。經代碼審查，此問題由兩個連鎖漏洞造成：

1. **第一重漏洞（缺乏自身停權防呆）**：
   在 `src/components/AccountManagementWorkspace.tsx` 的刪除操作有防呆阻止刪除自己 (`user.id === currentUser.id`)，但**切換啟用/停用狀態（Toggle Status）卻漏掉了自身檢查**，使得登入中的 Admin 或同仁可以點擊將自己的狀態切換為 `DISABLED`。
2. **第二重漏洞（AuthContext 靜默回退機制引發特權提升）**：
   在 `src/context/AuthContext.tsx` 判斷當前登入者時，程式碼為：
   ```typescript
   const currentUser = useMemo(() => {
     if (!allUsers.length) return null;
     const found = allUsers.find(u => u.id === currentUserId && u.status === 'ACTIVE');
     return found || allUsers[0] || null;
   }, [allUsers, currentUserId]);
   ```
   當 Admin 把自己停權後，其狀態變成 `DISABLED`，導致 `found` 判定為 `undefined`。此時觸發了預設的 `|| allUsers[0]` 回退機制，而資料庫使用者陣列的第一筆資料恰好是**唯一最高管理者 `USR-001 (Superadmin)`**，進而導致系統在前端直接將目前身分自動竄升為 Superadmin！

---

## 2. 修復方針與架構改造 (Proposed Fixes)

依據共識決策：**「禁止停用自己帳號，且被停用時絕不可回退切換為 Superadmin」**。

### A. 前端介面層防呆 (UI Guard)
- **`handleToggleStatus` 加入自身阻擋**：
  若 `user.id === currentUser?.id`，立即跳出置頂警示視窗（Alert Modal）提示：
  `【操作受限】禁止停用自身帳號：無法將當前正在登入操作的使用者帳號設為停用！`
- **列表狀態開關防呆防護**：
  同仁列表中針對當前登入同仁自己的行（Row），狀態切換按鈕加入禁止符號或防呆提示，防止誤觸。

### B. 資料庫層防呆 (Database Defense)
- **`sqlite.ts` 之 `toggleUserStatus` 函式**：
  傳入 `currentOperatorId`，若 `currentOperatorId === userId && newStatus === 'DISABLED'`，直接拋出例外 `安全防護受阻：系統禁止管理者將當前登入中之自身帳號停權！`，杜絕任何繞過前端的非法狀態變更。

### C. 身分驗證核心修正 (AuthContext Fix)
- **移除靜默升級至 `allUsers[0]` (Superadmin) 的不安全邏輯**：
  重構 `currentUser` 解析邏輯：
  - 若當前帳號存在且為 `ACTIVE`，正常登入。
  - 若當前帳號存在但為 `DISABLED`（例如被其他管理員在其他地方停權），**嚴禁切換為 `allUsers[0]`**。應維持其當前帳號身分（`currentUser.status === 'DISABLED'`），並於系統頂部或畫面中明確呈現「此帳號已被停用，無權操作系統」，提供安全登出按鈕，絕不賦予 Superadmin 權力。
  - 若 `currentUserId` 完全不存在於資料庫（已抹除），則清除本地 `localStorage` 並導回未登入/預設安全登入狀態，而非直接賦予最高權限。

---

## 3. 驗證與測試計畫 (Verification Plan)

1. **自身停權阻擋驗證**：
   - 以一般管理員（如 `admin_chen`）登入帳號管理。
   - 找到自己的那一列，嘗試點擊「啟用中」按鈕切換停用。
   - 預期結果：系統彈出置中警示視窗「禁止停用自身帳號」，狀態不變，無任何異常切換。
2. **Superadmin 自身停權驗證**：
   - 以 Superadmin（`黃副總經理`）登入。
   - 嘗試停用自己帳號。
   - 預期結果：金身防護生效，嚴禁停用自己。
3. **他者停權防提權驗證**：
   - 模擬情境：由 Superadmin 將某一帳號（如 `sales_liu`）設為停權。
   - 測試若切換至該帳號時，系統絕不會自動跳回或竄升為 Superadmin，保障權限隔離性。
