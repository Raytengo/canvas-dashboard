# 手動標記作業完成 — 設計文件

- **日期**：2026-07-19
- **狀態**：已與使用者確認，待實作
- **範圍**：`extension/` Chrome 擴充功能

---

## 1. 背景與問題

目前「作業是否完成」完全由 Canvas 的繳交狀態決定：

- `dashboard.js` 的 `isSubmitted(a)`（約 line 655）只看 `a.submission.submitted_at` /
  `workflow_state === 'submitted' | 'graded'`。
- `applyFilters`（約 line 711）用它來決定待辦清單隱藏/顯示。
- popup 的 `getUpcomingTasks`（`popup.js` 約 line 198）有一段等價的內嵌判斷。

有使用者反饋：希望能**自己決定一個作業算不算完成**，而不是全程只靠 Canvas 判斷。
常見情境：線下交、紙本交、Canvas 沒偵測到繳交、或作業其實已在別處完成，但清單一直顯示未完成。

附帶缺口：未 commit 的「自訂作業」功能（`customAssignments.js`）新增的作業 `submission`
永遠是 `null`，所以**目前自訂作業無法標記完成，只能刪除**。本功能一併補上。

---

## 2. 目標與語意（已確認）

**只做「手動標記完成」——最單純的加法覆蓋：**

- 每個作業列可手動勾選「完成」；勾了就視為完成、從待辦隱藏，不論 Canvas 是否收到繳交。
- **只加不減**：Canvas 已判定已交/已評分的作業，一定算完成，手動勾選**不能**把它改回未完成。
- 手動完成可再次點擊取消（回到未完成）。
- 完成判斷公式：`isDone(a) = isSubmitted(a) || manualDone[String(a.id)]`。

**明確不做**（YAGNI）：三態開關、「略過/不做」狀態、把 Canvas 已交的強制改未完成。

---

## 3. 資料模型

新增 `chrome.storage.local` key：

```jsonc
"manualDone": { "12345": true, "custom-assignment-abc": true }
```

- key 一律用 `String(assignment.id)`（Canvas id 是數字、自訂作業是 `custom-assignment-...` 字串）。
- 只存 `true`；取消完成時**刪除該 key**（不留 `false`），保持 map 乾淨。
- **獨立於同步**：`background.js` 的 `syncAll()` 只覆蓋 `assignments`，不碰 `manualDone`，
  所以重新同步、作業內容更新都不會洗掉手動勾選。

---

## 4. 新增純邏輯模組 `extension/dashboard/completion.js`

比照 `customAssignments.js` 的 UMD 寫法（可被 `require` 於 node 測試，也掛在 `globalThis`）。
**不碰 DOM、不碰 chrome API**，只放純函式：

```
DueCompletion.isSubmitted(assignment)
  → assignment.submission 存在且 (submitted_at | workflow_state==='submitted' | 'graded')
  → 從 dashboard.js 搬過來的同一份邏輯（成為單一真相來源）

DueCompletion.isManualDone(manualDoneMap, id)
  → !!(manualDoneMap || {})[String(id)]

DueCompletion.isDone(assignment, manualDoneMap)
  → isSubmitted(assignment) || isManualDone(manualDoneMap, assignment.id)

DueCompletion.toggleManualDone(manualDoneMap, id, nextState?)
  → 回傳「新的」map（immutable，不 mutate 輸入）
  → nextState 省略時翻轉；true → 設 { [String(id)]: true }；false → 刪除該 key

DueCompletion.normalizeManualDone(map)
  → 回傳乾淨的 { [String(id)]: true }，丟掉 falsy 值
```

`dashboard.js` 內既有的 `isSubmitted` 改為委派 `DueCompletion.isSubmitted`（或直接改用），
避免兩份邏輯漂移。

### 4.1 單元測試 `extension/dashboard/completion.test.js`

比照 `customAssignments.test.js`（純 node、只用 `node:assert/strict`，無外部依賴）。必測案例：

- `isSubmitted`：submitted_at 有值 / workflow_state submitted / graded → true；
  `submission` 為 `null`（**暑假無繳交的常態**）→ false；無 submission 欄位 → false。
- `isManualDone`：數字 id 與字串 id 都能命中（`String(id)` 正規化）；空 map → false。
- `isDone`：Canvas 已交但 manualDone 無 → true；未交但 manualDone 有 → true；
  兩者皆無 → false；**空 map + `submission:null` → false**（暑假空清單情境）。
- `toggleManualDone`：加、取消、指定 nextState；**不 mutate 原 map**（斷言原物件不變）。
- `normalizeManualDone`：丟掉 `false`/`0`/`null` 值。

---

## 5. UI：左側 checkbox 圓圈

在 `renderAssignmentRow`（`dashboard.js` 約 line 1859）產生的 `.assignment-item` 內，
**最左側**加一個可點擊的圓圈，置於 `.assignment-left` 之前。

### 三種視覺狀態

| 狀態 | 外觀 | 可否點擊 |
|------|------|----------|
| 未完成 | `--border` 細線空心圓 | 可，點 → 標記完成 |
| 手動完成 | `--green` 實心 + 白色勾 | 可，點 → 取消完成 |
| Canvas 已繳 | `--green` 實心 + 白色勾（可加 `disabled`/`title="已繳"`） | **否**（維持 Canvas 語意，見 §2） |

- 圓圈約 18px、`border-radius: 50%`、`flex-shrink: 0`，垂直置中對齊標題。
- 完成色用 `--green`（`#788c5d`），符合 CLAUDE.md 設計規範的第三強調色。
- HTML 結構範例（實作可微調）：
  ```html
  <button class="assignment-check" data-assignment-id="..." data-course-id="..."
          data-done="true|false" data-locked="true|false"
          aria-label="標記完成/取消完成"></button>
  ```
- 勾選狀態要用 CSS 呈現（如 `.assignment-check[data-done="true"]`），暗色模式沿用變數自動適配。

### 互動

- 點圓圈 handler 必須 `e.stopPropagation()`：
  - 不可觸發整列展開描述（`.assignment-item` 的 click，line 1516）。
  - 不可觸發作業名稱跳轉 Canvas（`.assignment-title-link`，line 1536）。
- `data-locked="true"`（Canvas 已繳）時點擊直接 return，不寫入。
- 事件綁定比照 `.btn-delete-custom-assignment` 的委派寫法（line 1528），
  在同一個 `bindEvents`/`el.querySelectorAll` 區塊新增 `.assignment-check` 的綁定。

### Toggle handler 行為

1. 讀 `id = String(dataset.assignmentId)`。
2. `const next = DueCompletion.toggleManualDone(_currentData.manualDone || {}, id)`。
3. **就地更新** `_currentData.manualDone = next`（避免閃白，符合 CLAUDE.md 第 6 點）。
4. `chrome.storage.local.set({ manualDone: next })`。
5. 用 `_currentData` 重繪目前視圖（**不呼叫 `loadData()`**）——
   重繪既有頁面（week / grid / course detail）即可，讓剛完成的作業滑出待辦。

---

## 6. 篩選 / 計數 / 圓餅圖串接

`applyFilters`（line 711）是所有清單、緊急計數、環形圓餅圖的**單一入口**
（line 882 nav badge、1002 週圓餅、1143 課程卡、1455 課程詳情、及各 `urgentCount`）。
因此只要改一處即全域連動：

- 把 `applyFilters` 內的 `isSubmitted(a)` 改為 `isDone(a)`，其中
  `isDone(a) = DueCompletion.isDone(a, _currentData.manualDone || {})`
  （比照 `getCourseName` 讀 `_currentData` 的既有模式，line 728）。
- 語意維持：預設隱藏「已完成」（含手動）；勾「查看已繳交」時只顯示「已完成」（含手動）。
- 「查看已繳交」按鈕文案不需改（現在的「已完成」含手動完成，語意仍合理）。

### 6.1 loadData / render 帶上 manualDone

- `loadData` 的 `chrome.storage.local.get([...])`（line 1942）陣列加入 `'manualDone'`。
- `loadData` 呼叫 `render({...})` 的預設物件（line 1961–1970）加入 `manualDone: data.manualDone || {}`。
- `render` 的 `_currentData = { ...data }`（line 821）會自動帶上 `manualDone`，無需額外改。

---

## 7. Popup 一併套用

`popup.js` `getUpcomingTasks`（line 188）的內嵌「已繳」判斷（line 198–202）
需同時排除手動完成的作業，7 天待辦才不會出現已標記完成的項目。

- `popup.js` 頂部 storage 讀取（line 326）的陣列加入 `'manualDone'`。
- `getUpcomingTasks` 增加 `manualDone` 來源（傳參或模組層變數），在既有 `continue` 判斷後
  追加：`if (manualDone && manualDone[String(a.id)]) continue;`。
- **不**在 popup 載入 `completion.js`（跨目錄、且 popup 的 submission 判斷本就略有不同），
  直接內嵌這一行即可，維持 popup 零依賴。
- Popup 目前只讀 `assignments`（Canvas），不顯示自訂作業——維持現狀，不在本次範圍。

---

## 8. 檔案載入

`extension/dashboard/index.html`（line 3519）在 `customAssignments.js` 與 `dashboard.js` 之間
（或 dashboard.js 之前）加入：

```html
<script src="completion.js"></script>
<script src="dashboard.js"></script>
```

確保 `DueCompletion` 在 `dashboard.js` 執行前就存在。

---

## 9. 測試策略（考慮暑假無作業）

> 現在是暑假，Canvas 上基本沒有作業。測試不能依賴真實作業資料，
> 必須明確涵蓋「空清單 / `submission: null` / 空 `manualDone`」等情境。

1. **單元測試（主力）**：
   - `node extension/dashboard/completion.test.js` 全綠（含 §4.1 的空清單/null submission 案例）。
   - `node extension/dashboard/customAssignments.test.js` 仍全綠（確認未回歸）。
2. **語法檢查**：對改動的檔案跑 `node --check`：
   `completion.js`、`customAssignments.js`、`dashboard.js`、`popup.js`。
   （`dashboard.js`/`popup.js` 用到 DOM/chrome API 無法直接執行，但 `--check` 可驗證語法正確。）
3. **邏輯審查**：由獨立 code-review subagent 檢查
   - `applyFilters` 兩個分支都改成 `isDone`；
   - toggle handler 有 `stopPropagation` 且 locked 時 return；
   - `manualDone` 在 loadData/render/popup 三處都正確帶上；
   - 未更動 `customAssignments` 既有行為。
4. **人工驗收（交回使用者）**：在 `chrome://extensions` 重新載入擴充功能後，
   在課程詳情頁勾選任一作業 → 應滑出待辦、勾「查看已繳交」可見、重新同步後仍保持完成。
   （暑假無作業時可用自訂作業新增一筆來驗證整條路徑。）

---

## 10. 邊界情況

- **id 型別**：Canvas 數字 id 與自訂字串 id 統一 `String()`，避免 map key 不一致。
- **考試類**：`applyFilters` 仍先排除 attendance/exam；考試不出現在作業清單，圓圈只在作業列。
- **自訂作業**：現在也吃 `isDone`，可標記完成（滑出待辦）而不必刪除；刪除鈕保留。
- **Canvas 已繳的圓圈**：顯示為完成但 locked 不可點；避免使用者誤以為能「取消繳交」。
- **空狀態**：無課程/無作業時 `loadData` 走既有 early-return，`manualDone` 不影響空畫面。

---

## 11. 影響檔案清單

| 檔案 | 變更 |
|------|------|
| `extension/dashboard/completion.js` | **新增**：純邏輯模組 |
| `extension/dashboard/completion.test.js` | **新增**：單元測試 |
| `extension/dashboard/dashboard.js` | `isSubmitted` 委派模組；新增 `isDone` 包裝；`applyFilters` 改用 `isDone`；`renderAssignmentRow` 加圓圈；新增 toggle handler + 事件綁定；loadData/render 帶 `manualDone` |
| `extension/dashboard/index.html` | 加 `<script src="completion.js">`；`.assignment-check` 三態 CSS |
| `extension/popup.js` | storage 讀 `manualDone`；`getUpcomingTasks` 排除手動完成 |
| `CLAUDE.md` | （選配）資料儲存區塊補上 `manualDone` 說明 |

> 不改動 `background.js`、不改動 `customAssignments.js` 既有行為。
