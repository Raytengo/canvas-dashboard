# 同步 Skeleton 載入畫面 — 設計文件

- **日期**：2026-07-23
- **狀態**：已與使用者確認方向（「同步時要有 skeleton，像真的有課程要 load 進來，載完直接出現在原位」），依自主執行慣例直接實作
- **範圍**：Dashboard 首次同步（無資料狀態）；popup 與背景自動同步不在此次範圍

---

## 1. 目標

目前空狀態點「同步」只有按鈕變三個點，主畫面停在「尚無資料」，看不出系統正在工作。
改為：**無資料時點同步 → 側欄與主區出現課程形狀的 skeleton 佔位（shimmer 微光掃過）→ 同步完成後真實課程直接渲染在同一版面位置**。

## 2. 行為規格

| 情境 | 行為 |
|------|------|
| 無資料（`_currentData.courses` 空）＋點同步 | 渲染 skeleton：側欄 4 列課名佔位、主區 `.courses-grid` 6 張課程卡佔位；`header-meta` 顯示「同步中...」 |
| 同步成功 | `loadData()` 原路渲染真實資料（同一 grid 版面原位替換）；主區內容做一次 0.3s 淡入上浮（`#main-section.arrive`，一次性） |
| 同步失敗 | 先 `loadData()` 還原空狀態（清掉 skeleton），按鈕照舊顯示「同步失敗」2.5 秒 |
| 已有資料＋點同步 | 維持現狀：靜默背景刷新，不出現 skeleton（不能用佔位蓋掉真資料） |

- skeleton 不可互動：`aria-hidden`、無 role/tabindex、`pointer-events: none`。
- 佔位形狀對齊真實卡片結構（`.card-code` 短條、`.card-name` 長條、`.card-bottom` 2–3 列），寬度略作變化避免整齊到假。

## 3. 實作

### dashboard.js
- `renderSyncSkeleton()`：寫入 `#course-nav`（`.skel-nav-row`×4）與 `#main-section`（`.courses-grid` 內 `.course-card-grid.skel-card`×6）；設 `header-meta = tr('syncing')`；標記 `main-section.dataset.skeleton = '1'`。
- 同步按鈕 handler：發 `SYNC` 前，若無資料 → `renderSyncSkeleton()`；失敗分支補呼叫 `loadData()`。
- `render()` 開頭：若 `main-section.dataset.skeleton` 存在 → 刪除標記、掛 `.arrive` class（400ms 後移除）→ 觸發一次性淡入。

### index.html（CSS）
- `.skel`：`var(--border)` 底 + `color-mix(...var(--bg)...)` 高光的 `background-position` shimmer（1.4s 循環），dark mode 自動適配。
- `.skel-card` 內各條的尺寸樣式、`.skel-nav-row`；`#main-section.arrive > *` 的 `content-arrive` 淡入 keyframe。

## 4. 測試

- `node --check`＋既有四個測試檔全綠（純渲染層，不動邏輯模組）。
- Harness 手動驗證：清空 courses → 點同步看 skeleton；stub 延遲後回成功（重新種資料）→ 真卡片原位出現＋淡入；stub 回失敗 → 還原空狀態＋「同步失敗」。dark mode 檢查 shimmer 對比。

## 5. 影響檔案

| 檔案 | 變更 |
|------|------|
| `extension/dashboard/dashboard.js` | `renderSyncSkeleton()`；sync handler 前置渲染與失敗還原；`render()` 的 arrive 一次性淡入 |
| `extension/dashboard/index.html` | `.skel`／`.skel-card`／`.skel-nav-row`／shimmer 與 arrive keyframes |
