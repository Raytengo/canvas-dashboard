# AGENTS.md

> **唯一事實來源是 [`CLAUDE.md`](./CLAUDE.md)**，本檔僅為指向。
> 任何關於專案結構、設計規範、已實作功能、資料格式與開發細節，一律以 `CLAUDE.md` 為準；兩者衝突時以 `CLAUDE.md` 為準。

## 現行專案速覽

Due 是一個 Manifest V3 Chrome 擴充功能，借用瀏覽器的 Canvas 登入狀態（Cookie）呼叫 Canvas API，在 Dashboard 上顯示作業、截止日期與評分比重。

- **結構**：`extension/` 下有 `manifest.json`、`background.js`（Service Worker：Canvas 同步 + Claude 用量）、`popup.*`，以及 `dashboard/`（`index.html`＋`dashboard.js`＋`completion.js`＋`customAssignments.js`＋`descSanitizer.js`）。
- **技術棧**：純 vanilla JS（無框架）、字串模板 + `esc()` 轉義、事件用 `addEventListener`；字體本地打包於 `extension/fonts/`；設計遵循 Anthropic 品牌語言。
- **開發注意（前三條，其餘見 CLAUDE.md）**：
  1. 修改 `extension/` 下的檔案後，需在 `chrome://extensions` 重新載入擴充功能才生效。
  2. `background.js` 是 Service Worker，不能用 `window` 或 `document`。
  3. Canvas API 日期為 ISO 8601，用 `formatDue()` 轉換顯示；部分作業無 `due_at`（`urgencyClass`／`formatDue` 已處理）。

> 註：逐作業 AI 分析與多 LLM 後端等舊功能已於 2026-07 移除，請勿依舊描述開發。
