# 新手教學（Welcome Modal）改版 — 設計文件

日期：2026-07-23
狀態：已定案（依自主執行偏好直接實作）

## 背景

新手教學（`dashboard/index.html` 的 Welcome Modal，首次安裝以 `?welcome=1` 開啟，
或由設定選單「使用教學」重開）目前為 4 頁。多次 dashboard 改版後內容已過時：

- 第一頁右側示意圖仍是舊版 conic 圓餅（實際已改為 SVG stroke 進度環＋分級摘要）
- 第二頁「登入 Canvas」點連結後使用者要手動切回 dashboard
- 第三頁右側 `icons/pin_guide.png`（PNG，非 SVG）內的「✓」不是 DUE 商標
- 拖曳隱藏／還原功能（manualHidden／manualShown）完全沒有教學

改版後共 **5 頁**：歡迎使用 → 登入 Canvas → 釘選 → **拖曳整理（新）** → 一切就緒。

## 各頁設計

### 第 1 頁：歡迎使用 — 右側示意圖更新

現況確認：右側是 **HTML/CSS**（`.welcome-dash-mock`），非 SVG 或圖片。
`.welcome-dash-mock-pie` 為舊版 conic-gradient 圓餅＋三行圖例。

改為鏡射現行「本週概覽」左欄設計（迷你版，靜態示意）：

- **迷你進度環**：inline SVG stroke（track 圓 + 綠色弧 `var(--green)`），中央 `3/5` + 「本週完成」
- **分級摘要列**：仿 `.wk-sum-row`——`1 已逾期`（紅）、`3 7天內`（橘）、`2 8-30天`（暖黃）
- 右側兩張迷你 task card 保留不動
- 文案維持硬編碼中文（與現況一致，mock 本來就不走 i18n）
- 舊 `.welcome-dash-mock-pie`／`-legend` CSS 移除，新增迷你環與摘要列樣式

### 第 2 頁：登入 Canvas — 同步完成自動跳回

現況：`welcome-canvas-link` 點擊 → `chrome.tabs.create({url: canvasBaseUrl})`；
`canvasBaseUrl` 為空（首次安裝、從未造訪 Canvas）時**什麼都不會發生**。

新流程（全部在 dashboard.js，守衛式寫法讓 dev harness 不會炸）：

1. 點連結 → fallback URL：`canvasBaseUrl || 'https://hkust-gz.instructure.com'`
2. `chrome.tabs.getCurrent` 記住 dashboard 自身 tab id；`chrome.tabs.create` 記住開出的 Canvas tab id
3. **武裝回跳監聽**（armed，10 分鐘後自動解除）：
   - 主訊號：`chrome.storage.onChanged` 監聽 `lastSync` 變化（登入完成 → webNavigation 自動同步成功才會寫入；未登入時 API 401、lastSync 不會動，所以不會過早跳回）
   - 輔助訊號：`chrome.tabs.onUpdated` 看到該 Canvas tab `status === 'complete'` 時補發手動 `SYNC`（不受 5 分鐘節流限制，涵蓋「近期已同步過、auto-sync 被節流」的邊角）
4. 回跳（idempotent）：`loadData()` 刷新資料 → 關閉**我們開的那個** Canvas tab → `chrome.tabs.update(dashboardTabId, {active:true})` + `chrome.windows.update(..., {focused:true})` → 連結旁顯示「✓ 已同步」狀態 → 解除武裝
5. 文案更新：li1 改為說明「點一下，同步完成會自動帶你回來」（3 語言），新增 `wCanvasSynced` key

注意：CLAUDE.md 記載 dashboard.js 刻意無 `storage.onChanged` 監聽器（怕打斷完成動畫）。
本監聽**只在武裝期間反應 `lastSync`**，不碰 manualDone 路徑，不違反原設計意圖；實作後更新 CLAUDE.md 註記。

### 第 3 頁：釘選 — pin_guide.png 的 ✓ 換成 DUE 商標

現況確認：右側是 **PNG**（`icons/pin_guide.png`，640×640），非 SVG。圖中下拉選單列為「✓ Due 📌」。
DUE 商標＝`icons/icon128.png`（青藍 #0B7588 環形花紋，icon.py 產生）。

作法：Python + PIL 腳本（scratchpad，不進版控）——取樣 ✓ 周圍的列底色蓋掉 ✓，
把 icon128.png 等比縮至 ✓ 原尺寸、以 alpha 合成貼回原位，輸出覆蓋 `pin_guide.png`。
其餘部分（工具列、箭頭、📌）不動。HTML 不需改。

### 第 4 頁（新增）：拖曳整理作業清單

語義（與現行實作一致）：

- **隱藏**：任何作業列都有 grip 握把（名稱正後方），拖進課程詳情底部「已隱藏 N 項」區 → 寫 `manualHidden`，不再出現在待辦
- **還原**：被自動隱藏（考試／簽到判定）或手動隱藏的項目，從「已隱藏」區拖回作業清單 → 考試/簽到寫 `manualShown`（升級，視同一般作業出現在所有視圖）、手動隱藏者移除 `manualHidden`

頁面結構（沿用 split 版型）：

- 左：標題「拖曳整理作業清單」+ 說明 + 2 條編號指引（隱藏怎麼拖、誤判怎麼拖回）
- 右：**inline SVG 示意圖**（第 5 點需求）——迷你課程詳情：作業清單（含 grip 點）、
  一張浮起的拖曳卡（陰影＋微傾，仿 `.drag-clone`）、下方「已隱藏 2 項」區（含紫色考試列），
  雙向箭頭示意拖下（隱藏）與拖回（還原）。全部用 CSS 變數配色，主題一致
- icon：eye-off 線條圖示；eyebrow `4 / 5`

### 第 5 頁：一切就緒（原第 4 頁改號）

內容不變，只改 id（`wstep-4`→`wstep-5`）與 eyebrow（`5 / 5`）。

## 換頁機制調整（4 頁 → 5 頁）

| 位置 | 現值 | 新值 |
|---|---|---|
| `.welcome-track` width | 400% | 500% |
| `.welcome-step` width | 25% | 20% |
| `welcomeGoStep` translateX | `(n-1)*25%` | `(n-1)*20%` |
| `_welcomeUpdateButtons` 完成頁判斷 | `n === 4` | `n === 5` |
| dots | 4 顆 | 5 顆（`data-wstep="5"`） |
| eyebrow | `N / 4` | `N / 5`（硬編碼文字逐一改） |

## i18n

- 原 `wTitle4`/`wBody4` → 改名 `wTitle5`/`wBody5`（`wDone1-3` 不動）
- 新增：`wTitle4`（拖曳整理）、`wBody4`、`wStep4Li1`、`wStep4Li2`、`wCanvasSynced`
- 三語言（zh-TW / zh-CN / en）齊備；`applyWelcomeTranslations` 對應更新（wstep-5-* ids）

## 測試與驗證

- 純邏輯模組無變動；跑既有 node 測試確認不回歸
- 自動跳回屬 chrome.* 膠水程式碼，無法在 harness 單元驗證：守衛式寫法（`chrome.tabs?.getCurrent` 等）確保 harness 不炸，流程以程式碼審視驗證
- 視覺：dev harness（due-static, port 8765）開 welcome modal 逐頁截圖核對（1、3、4 頁重點）

## 不做的事（YAGNI）

- mock 文案不接 i18n（維持現況硬編碼）
- 同步完成不自動翻到下一頁（只顯示 ✓ 狀態，避免突兀）
- 不重畫 pin_guide.png 整張圖（只換 ✓）
