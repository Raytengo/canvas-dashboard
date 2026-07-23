# 側欄雙擊課程名稱 → 進入重命名（Design Spec）

- 日期：2026-07-22
- 狀態：已核可，進實作
- 範圍：`extension/dashboard/dashboard.js`、`extension/dashboard/index.html`

## 問題 / 動機

目前只能在**課程詳情頁**透過鉛筆圖示重命名課程（`courseNames`）。使用者希望在**側欄課程導航**能更快進入重命名——直覺做法是「在課程名稱上點兩下」。

側欄課程項目前的行為：**單擊即開啟該課程詳情**（`renderNav` 綁定 → `showCourseDetail(id)`）。因此新增「雙擊重命名」必須與既有單擊共存。

## 已定案的決策（brainstorming 收斂）

1. **互動模型**：單擊維持**即時開啟**（不加延遲、不動主要導航手感）；雙擊 = 開啟詳情後在**詳情頁**啟動既有 inline 重命名。雙擊是單擊的超集（先開，再進重命名）。
2. **套用範圍**：**僅側欄** `.nav-course-item`。
   - 課程 grid 卡片、週卡片**不做**雙擊重命名：卡片單擊後立即從畫面消失，第二下沒有落點，無法在「不加延遲」前提下可靠偵測雙擊；側欄不受此限（它一直都在）。
3. **雙擊視窗**：`300ms`。
4. 詳情頁鉛筆重命名維持不變。

## 為何側欄能零延遲支援雙擊

側欄單擊呼叫 `showCourseDetail(id)` **不帶 `cardEl`**，走的是 `showCourseDetail` 的**同步 fallback 分支**（`dashboard.js` 約 L1454，`if (!cardEl || !document.startViewTransition)`），**不觸發 View Transition**。因此第一下點完，詳情（含 `.detail-name .detail-name-text`）**同步渲染完成**、立即就緒；第二下即可直接呼叫 `startCourseRename(id)` 並穩定找到重命名目標。

第一下會 `renderNav` 重繪、換掉被點的按鈕元素；故雙擊計時狀態必須放**模組層級**（非 listener closure），重繪後第二下的新按鈕仍讀得到。

## 設計

### 狀態（模組層級，dashboard.js）

```js
const NAV_RENAME_DBLCLICK_MS = 300;   // 側欄同一課程連點視為雙擊的視窗
let _navLastRenameId = null;          // 上一次點擊的課程 id
let _navLastRenameTime = 0;           // 上一次點擊時間（Date.now()）
```

### 綁定（`renderNav`，取代現有 nav 點擊綁定）

```js
navEl.querySelectorAll('.nav-course-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = parseInt(btn.dataset.targetCourse, 10);
    const now = Date.now();
    const isDouble = id === _navLastRenameId && (now - _navLastRenameTime) < NAV_RENAME_DBLCLICK_MS;
    _navLastRenameId = id;
    _navLastRenameTime = now;
    if (isDouble) {
      startCourseRename(id);   // 第一下已同步渲染詳情，.detail-name-text 已就緒
    } else {
      showCourseDetail(id);    // 單擊：維持即時開啟
    }
  });
});
```

### 重用

完全重用既有 [`startCourseRename(courseId)`](../../../extension/dashboard/dashboard.js)：已處理 Enter 儲存 / Esc 取消 / blur commit / 空值還原 / 寫入 `chrome.storage.local.courseNames` / 重繪側欄。**不新增任何儲存邏輯、不改資料格式。**

### CSS（index.html，`.nav-course-item`）

補 `user-select: none;`，避免雙擊時瀏覽器選取課名文字造成閃爍。

## 邊界情況

- **同 id 才算雙擊**：先點 A 再點 B（<300ms）不會誤判——B≠A 走單擊 `showCourseDetail(B)`。且可證明 `isDouble` 為真時詳情必為該 id（前一下同 id 的非雙擊點擊一定呼叫過 `showCourseDetail(id)`）。
- **三連點**：第三下仍判為雙擊 → 再呼叫 `startCourseRename(id)`，但 `.detail-name-text` 已被 input 取代，函式 early-return（`if (!textSpan) return;`），**進行中的編輯被保留**、無副作用。故**不做 consume/重置**。
- **鍵盤**：連按兩次 Enter 也會觸發重命名（附帶好處，不特別處理）。
- **無 `startViewTransition` 的環境**：本就走同步分支，行為一致。

## 非目標

- 不改課程卡 / 週卡片。
- 不加 tooltip 或其他探索性提示（鉛筆圖示仍是可發現的入口）。
- 不動 `courseNames` 儲存格式或同步邏輯。

## 測試 / 驗證

依 repo 慣例：`dashboard.js` 為瀏覽器端 monolith、不做單元測試（單元測試只覆蓋 `taskRules` / `completion` / `customAssignments` / `descSanitizer` 等抽出的共用純模組）。此功能為 DOM glue + 一行時間判斷，於 dev harness 手動驗證：

在 `dev/harness.html`（`due-static`，port 8765）確認：
1. 側欄**單擊**課程 → 即時開啟詳情（無延遲、與現況相同）。
2. 側欄**雙擊**課程 → 開啟詳情且重命名輸入框出現、focus + 全選。
3. 重命名 Enter 儲存、Esc 取消、blur commit 皆正常，側欄名稱同步更新。
4. **三連點**不清除進行中的編輯、無報錯。
5. 課程卡 / 週卡片雙擊行為不變（仍是開啟詳情）。

（`isDoubleClick` 一行判斷若日後要抽成純函式加測試可再議；目前不過度包裝。）

## 影響的檔案

- `extension/dashboard/dashboard.js`：新增 3 個模組層級宣告；改寫 `renderNav` 內 nav 點擊綁定。
- `extension/dashboard/index.html`：`.nav-course-item` 補 `user-select: none;`。
