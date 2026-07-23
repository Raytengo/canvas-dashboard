# 側欄雙擊課程名稱 → 就地行內重命名（Design Spec）

- 日期：2026-07-22（2026-07-23 依審閱回饋修訂為「側欄行內編輯」）
- 狀態：已實作、已驗證
- 範圍：`extension/dashboard/dashboard.js`、`extension/dashboard/index.html`

## 問題 / 動機

目前只能在**課程詳情頁**透過鉛筆圖示重命名課程（`courseNames`）。使用者希望在**側欄課程導航**能更快重命名——直覺做法是「在課程名稱上點兩下」。

側欄課程項目前的行為：**單擊即開啟該課程詳情**（`renderNav` 綁定 → `showCourseDetail(id)`）。因此新增「雙擊重命名」必須與既有單擊共存。

## 已定案的決策

1. **編輯位置：就地在側欄行內編輯**（審閱回饋修正）。雙擊側欄課名時，編輯要發生在**左側（側欄）**——把該側欄課程項換成輸入框就地編輯；**不是**「在左邊點擊、卻在右邊詳情頁編輯」。
2. **單擊維持即時開啟**：不加延遲、不動主要導航手感（使用者堅持零延遲）。
3. **套用範圍：僅側欄** `.nav-course-item`。
   - 課程 grid 卡片、週卡片**不做**雙擊重命名：卡片單擊後立即從畫面消失，第二下沒有落點，無法在「不加延遲」前提下可靠偵測雙擊；側欄不受此限（它一直都在）。
4. **雙擊視窗**：`300ms`。
5. 詳情頁鉛筆重命名維持不變。

### 已知且已接受的行為後果

因為「單擊即時開啟」是硬需求，雙擊的**第一下**仍會即時開啟該課程詳情（無法在不加延遲下得知後面還有第二下）。因此雙擊側欄課名時，右側會順帶開啟該課詳情，但**編輯 UI 出現在左側側欄**（符合決策 1）。若日後要「雙擊只編輯、完全不開詳情」，就必須對單擊加約 200ms 延遲——目前不採用。

## 機制（零延遲的關鍵）

側欄單擊呼叫 `showCourseDetail(id)` **不帶 `cardEl`**，走同步 fallback 分支（不觸發 View Transition），第一下點完側欄即**同步重繪**、該課程項按鈕就緒。雙擊計時狀態放**模組層級**（非 listener closure），第一下重繪換掉按鈕後，第二下的新按鈕仍讀得到，判定為雙擊後就地把該側欄項換成輸入框。

## 設計

### 狀態（模組層級，dashboard.js）

```js
const NAV_RENAME_DBLCLICK_MS = 300;   // 側欄同一課程連點視為雙擊的視窗
let _navLastRenameId = null;          // 上一次點擊的課程 id
let _navLastRenameTime = 0;           // 上一次點擊時間（Date.now()）
```

### 綁定（`renderNav` 內 nav 點擊）

```js
btn.addEventListener('click', () => {
  const id = parseInt(btn.dataset.targetCourse, 10);
  const now = Date.now();
  const isDouble = id === _navLastRenameId && (now - _navLastRenameTime) < NAV_RENAME_DBLCLICK_MS;
  _navLastRenameId = id;
  _navLastRenameTime = now;
  if (isDouble) startSidebarRename(id);   // 就地在側欄行內編輯
  else showCourseDetail(id);              // 單擊：維持即時開啟
});
```

### `startSidebarRename(courseId)`

- 找 `.nav-course-item[data-target-course="${courseId}"]`；找不到（如三連點時已是 input）→ early-return。
- 用 `<input class="nav-rename-input">` **取代整個按鈕**（`item.replaceWith(input)`）——避免把 `<input>` 巢狀進 `<button>` 造成事件/焦點問題；`focus()` + `select()`。
- Enter / blur → `commit`；Esc → `cancel`；`committed` 旗標防重入。
- `commit`：`persistCourseName()` 寫入 → `renderNav()` 重繪還原按鈕並套用新名 → 若右側正顯示同一課，順手把 `.detail-name-text` 文字同步為新名（只改文字、不整段重繪，避免打斷成績計算器/捲動）。
- `cancel`：`renderNav()` 直接還原原本按鈕（不寫入）。

### `persistCourseName(courseId, newName, course)`（共用純寫入）

`startCourseRename`（詳情頁鉛筆）與 `startSidebarRename` **共用**同一份寫入邏輯：`newName` 已 trim，空或等於原始課名 → 移除自訂；同時更新 `_currentData.courseNames` 與 `chrome.storage.local.courseNames`。原本 `startCourseRename` 內嵌的寫入區塊改呼叫此函式（去重）。

### CSS（index.html）

- `.nav-course-item` 補 `user-select: none;`（雙擊不選取課名文字）。
- 新增 `.nav-rename-input`：`width:100%` + `box-sizing:border-box`，`padding:6px 9px`、`1px solid var(--orange)` 邊框、`border-radius:5px`、`background:var(--bg)`，字體對齊 `.nav-course-name`（Source Serif 4 / 15px / 400）。

## 邊界情況

- **同 id 才算雙擊**：先點 A 再點 B（<300ms）不會誤判——B≠A 走單擊 `showCourseDetail(B)`。
- **三連點**：第三下 `startSidebarRename` 因該側欄項已被 input 取代（找不到 `.nav-course-item`）而 early-return，進行中的編輯被保留、無副作用。
- **鍵盤**：連按兩次 Enter 也會觸發重命名（附帶好處，不特別處理）。
- **儲存為非同步**（chrome.storage）：`_currentData.courseNames` 同步更新（故側欄/詳情立即顯示新名），`chrome.storage.local.set` 隨後 flush。

## 非目標

- 不改課程卡 / 週卡片。
- 不加 tooltip 或其他探索性提示（鉛筆圖示仍是可發現的入口）。
- 不動 `courseNames` 儲存格式或同步邏輯。

## 測試 / 驗證

依 repo 慣例：`dashboard.js` 為瀏覽器端 monolith、不做單元測試（單元測試只覆蓋抽出的共用純模組）。此功能為 DOM glue，於 dev harness（`dev/harness.html`，due-static）手動驗證，已確認：

1. 側欄**單擊**課程 → 即時開啟詳情（無延遲）。
2. 側欄**雙擊**課程 → 該側欄課名就地變成輸入框（focus + 全選），**編輯在左側**；詳情頁標題為純文字（非輸入框）。
3. 輸入新名 + Enter → 側欄與詳情標題同步顯示新名、輸入框關閉；`chrome.storage.local.courseNames[courseId]` 寫入正確（非同步 flush 後）。
4. Esc 取消還原；三連點不清除進行中的編輯、無報錯。
5. `node --check` 通過；console 無新錯誤。

## 影響的檔案

- `extension/dashboard/dashboard.js`：模組層級計時狀態；`renderNav` nav 綁定雙擊 → `startSidebarRename`；新增 `startSidebarRename`、`persistCourseName`；`startCourseRename` 改用 `persistCourseName`。
- `extension/dashboard/index.html`：`.nav-course-item` 補 `user-select: none;`；新增 `.nav-rename-input`。
