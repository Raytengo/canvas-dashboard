# Due — 項目說明書

## 項目概述

這是一個 Chrome 擴充功能，幫助 HKUST(GZ) 的學生從 Canvas LMS 自動拉取課程資料，
並在一個美觀的 Dashboard 上顯示所有作業、截止日期和評分比重。

目標是讓學生不需要打開 Canvas，就能知道「現在該做什麼、怎麼做、什麼時候要做完」。

---

## 關鍵背景資訊

- **學校 Canvas 網址**：`https://hkust-gz.instructure.com`
- **重要限制**：學校不允許學生自己產生 Personal Access Token，所以必須透過 Chrome 擴充功能借用瀏覽器的登入狀態（Cookie）來呼叫 Canvas API，不能用 Bearer Token 的方式
- **Canvas API** 不需要額外 header，Chrome 擴充功能在使用者已登入的情況下直接 fetch 即可

---

## 專案結構

```
cc/
├── CLAUDE.md
└── extension/
    ├── manifest.json              ← 擴充功能設定（Manifest V3）
    ├── background.js              ← Service worker：Canvas API 同步 + Claude 用量
    ├── popup.html                 ← 點擊擴充功能圖示的小視窗
    ├── popup.js                   ← popup 的邏輯
    └── dashboard/
        ├── index.html             ← Dashboard 頁面（CSS + HTML 骨架）
        └── dashboard.js           ← 所有 Dashboard 渲染邏輯和事件綁定
```

---

## 技術規格

### Chrome 擴充功能

- **Manifest Version**：3（必須用 V3）
- **Permissions**：`storage`、`tabs`、`webNavigation`、`scripting`
- **Host Permissions**：`https://*.instructure.com/*`、`https://claude.ai/*`（後者供 popup 的 Claude 用量顯示與 content script）
- **背景執行**：Service Worker（background.js），不能用 `window` 或 `document`

### Canvas API 端點

```
GET /api/v1/courses?enrollment_state=active&per_page=50
→ 拿所有目前選修的課程（過濾 workflow_state === 'available' 且有名稱）

GET /api/v1/courses/:id/assignments?per_page=50&include[]=submission
→ 拿某門課的所有作業（含繳交狀態）

GET /api/v1/courses/:id/assignment_groups?include[]=assignments&include[]=group_weight
→ 拿評分比重分組
```

注意：Canvas API 有分頁，需要處理 `Link` header 的 `rel="next"`。

### 資料儲存

用 `chrome.storage.local` 存所有資料，格式如下：

```json
{
  "lastSync": "2026-03-06T10:00:00Z",
  "courses": [...],
  "assignments": { "courseId": [...] },
  "assignmentGroups": { "courseId": [...] },
  "scores": { "assignmentId": 85.5 },
  "manualDone": { "assignmentId": true },
  "customWeights": { "courseId": [{ "name": "Homework", "weight": 30 }] },
  "courseNames": { "courseId": "自訂名稱" },
  "darkMode": false,
  "uiLanguage": "zh-TW",
  "showClaudeUsageInPopup": true,
  "claudeUsage": { "usedPercent": 0, "resetAt": "..." }
}
```

---

## 設計規範

嚴格遵守 Anthropic 品牌設計語言：

### 顏色

```css
--bg:       #faf9f5;   /* 暖米白，頁面背景 */
--surface:  #f2f0e8;   /* 稍深的米白，卡片/側欄背景 */
--dark:     #141413;   /* 近黑，主要文字 */
--mid:      #9a9890;   /* 中灰，次要文字 */
--muted:    #7c7a72;   /* 深灰，說明文字 */
--border:   #dedad0;   /* 邊框顏色 */
--orange:   #d97757;   /* 主強調色 */
--blue:     #6a9bcc;   /* 次強調色 */
--green:    #788c5d;   /* 第三強調色 */
--warm:     #b09050;   /* 暖黃 */
--purple:   #a86070;   /* 考試/測驗顏色 */
```

**Dark mode**（`html[data-theme="dark"]` 時覆蓋）：
```css
--bg: #1e1d1b;  --surface: #141312;  --dark: #eeebe4;
--mid: #5c5a56;  --muted: #8e8c88;   --border: #272522;
```

### 字體

```css
標題/課程名稱：'Source Serif 4', Georgia, serif（font-weight: 400）
內文：         'DM Sans', sans-serif（font-weight: 300）
代碼/數字/標籤：'DM Mono', monospace
```

### 風格原則

- 大量留白，不要擁擠
- 邊框用細線（1px），圓角保守（4–8px）
- 整體 light mode，dark mode 為可選
- Section 標題用 DM Mono 小字大寫間距
- 動畫克制：卡片 hover 用 `translateY(-2px)`，轉場用 View Transitions API

### 截止日期顏色規則

- ≤7 天：橘紅 `var(--orange)`（class: `due-urgent`）
- 8–30 天：暖黃 `var(--warm)`（class: `due-soon`）
- 30 天以上：藍色 `var(--blue)`（class: `due-later`）
- 已過期：灰色 `var(--mid)`（class: `due-past`）
- 考試類：紫色 `var(--purple)`（class: `due-exam`）
- 無截止日期：class: `due-none`

---

## 已實作功能

### background.js

- 監聽 `webNavigation.onCompleted` — 使用者造訪 Canvas 時自動觸發同步
- 響應訊息：`SYNC`、`GET_STATUS`、`SYNC_CLAUDE_USAGE`
- `syncAll()`：並行拉取所有課程的作業與評分分組（courses / assignments / assignmentGroups）
- `fetchSchoolName()`：自動偵測學校名稱（優先 Canvas API → hostname 解析）
- `fetchClaudeUsageDirect()`：popup 的 Claude 用量 chip — 找開著的 `claude.ai` 分頁，借該分頁登入狀態讀 `/api/organizations/:id/usage`，**不呼叫任何 LLM**；結果存 `claudeUsage`。搭配注入 claude.ai 的 `claude_injected.js` / `claude_content.js`

> 註：逐作業 AI 分析與 syllabus 評分比重 AI 分析已於 2026-07 移除（見 `docs/superpowers/specs/2026-07-21-remove-ai-analysis-design.md`）。

### popup.html / popup.js

- 7 天待辦快速預覽：顯示所有 7 天內到期的未繳作業清單
- 每筆任務顯示：緊急程度色點、作業名稱、**課程名稱**（支援自訂名稱）、剩餘時間
- 支援 UI 語言（跟隨 Dashboard 設定）
- 開啟 Dashboard 按鈕；顯示上次同步時間

### Dashboard（index.html + dashboard.js）

**整體佈局：**

```
sidebar（300px）+ main-content（flex:1）
│                │
│  品牌標題       │  .page-tabs（學期待辦 / 課程）
│  篩選 pills     │  #main-section（目前頁面）
│  作業/考試/全部  │  #course-detail-container（課程詳情）
│  查看已繳交     │
│  課程導航列     │
│  同步/設定      │
```

**學期待辦頁（Week）：**
- 左側：conic-gradient 環形圓餅圖（orange/warm/blue 分別代表≤7d/8–30d/30+d 的作業數量比例）
- 右側：2 欄 task cards，依緊急程度分三時間區塊顯示
- 點擊任意 task card → View Transitions API morph 展開對應課程詳情

**課程頁（Courses）：**
- 3 欄課程卡片 grid，依最近截止日期排序
- 每張卡片顯示：課程代碼、**課程名稱**、緊急件數 badge、最多 3 筆作業（含分頁）
- 課程卡片點擊 → View Transitions API morph 動畫展開為詳情頁

**課程詳情頁（Course Detail）：**
- 上半：課程代碼、名稱（含鉛筆圖示可 inline 重命名）、緊急 badge
- 左下：評分比重圓餅圖 + 圖例；資料來源優先序：手動輸入權重（`customWeights`）→ Canvas 分組權重（`group_weight`）→ 皆無則顯示「無評分資訊」
- 右下：成績計算器（accordion）+ 作業清單
  - 成績計算器：輸入分數即時計算加權總分
  - 作業列表：點擊行展開描述，點擊作業名稱文字開新分頁跳轉 Canvas
  - 作業列最左有完成勾選圈（見下方「完成標記」）

**課程自訂名稱：**
- 課程詳情頁的課程名稱旁有鉛筆圖示（hover 顯示）
- 點擊鉛筆 → inline 輸入框，Enter 儲存、Escape 取消
- 自訂名稱儲存在 `chrome.storage.local.courseNames`，不影響 Canvas API 資料
- 自訂名稱同步顯示於：sidebar 導航、週待辦卡片、課程 grid 卡片、popup

**完成標記（手動）：**
- 每個作業列最左有一個勾選圈，可手動標記完成，獨立於 Canvas 繳交狀態（`isDone = isSubmitted || manualDone[id]`）
- Canvas 已繳為 locked（綠勾不可取消）；手動完成可再點取消
- 待辦視圖勾選完成 → 該列維持原尺寸 3 秒（底部橘色撤銷倒數條），期間點該列可取消；時間到「碎點爆」後移除、清單收合
- 儲存於 `manualDone`，同步不覆蓋；純邏輯在 `dashboard/completion.js`（含單元測試）

**多語言支援（i18n）：**
- 支援：繁體中文（預設）、简体中文、English
- `I18N` 物件涵蓋 70+ 個 key，透過 `tr(key)` 函式取值
- 語言偏好儲存在 `chrome.storage.local.uiLanguage`
- 切換語言後，`formatDue()`、`formatLastSync()` 等函式也會隨語言調整顯示格式

**全域篩選邏輯（`applyFilters`）：**
- 永遠排除 attendance/簽到類作業（自動偵測關鍵字）
- 按類型篩選：`作業` / `考試` / `全部`
- 按完成狀態篩選：隱藏/顯示已完成（Canvas 已繳 + 手動標記完成，見 completion.js 的 isDone）

**頁面切換動畫：**
- 學期待辦 ↔ 課程：水平 slide（`.page-slider` translateX，470ms）
- 課程卡片 ↔ 詳情：View Transitions API morph（0.28s，命名元素：`course-shell`、`course-code`、`course-name`、`course-badge`、`course-meta`）
- Sidebar 在 morph 期間靜止（`view-transition-name: sidebar`，`animation: none`）
- **注意**：若課程名稱 `div.detail-name` 內有 inline 元素（如鉛筆按鈕），需確保按鈕為 `position: absolute`（不影響 layout box），否則 View Transition 捕捉到不同高度會產生動畫跳動

---

## 資料儲存

見上方「技術規格 → 資料儲存」的 `chrome.storage.local` 格式。
（AI 相關 key：`analysis`、`syllabusAnalysis`、`milestoneChecks`、`aiModel`、`geminiApiKey`、`geminiModel`、`claudeApiKey` 已隨 AI 分析移除；舊資料殘留無害，不主動清除。）

---

## 開發注意事項

1. 每次修改 `extension/` 下的檔案後，需要在 `chrome://extensions` 重新載入擴充功能才會生效
2. `background.js` 是 Service Worker，不能用 `window` 或 `document`（有需要的話用 regex 代替 DOM 操作）
3. Canvas API 回傳的日期格式是 ISO 8601（`2026-03-15T23:59:59Z`）；使用 `formatDue()` 轉換顯示
4. 有些作業沒有截止日期（`due_at` 為 null），`urgencyClass` 和 `formatDue` 都已處理
5. View Transitions API 是 Chrome 111+ 的功能，`showCourseDetail` 有 fallback 處理
6. `_currentData` 是全域快取；頁面切換時用 `_currentData` 同步渲染，不要再呼叫 `loadData()`（避免空白閃爍）
7. `courseNames` 只影響顯示層，Canvas API 呼叫仍使用原始 `course.id`，不受自訂名稱影響
8. `field-sizing: content`（Chrome 123+）用於 inline 重命名輸入框自動縮放
9. 完成標記動畫：勾選後不立即重繪，該列跑 3 秒撤銷窗口＋碎點爆才移除；`dashboard.js` 無 `storage.onChanged` 監聽器，故寫入 `manualDone` 不會打斷動畫（見 `completion.js`）

---

## 待開發功能

- 成績計算器顯示優化（目前 accordion 折疊）
- 多學期 / 歸檔課程過濾
- 完成標記動畫延伸到週待辦卡片（目前僅課程詳情列）
