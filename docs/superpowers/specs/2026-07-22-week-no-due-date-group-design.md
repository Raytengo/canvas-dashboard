# 學期待辦：新增「無截止日期」區塊

日期：2026-07-22
狀態：設計定案（使用者授權直接實作，不再逐步確認）

## 背景與問題

`renderWeekSection`（學期待辦頁）目前在收集作業時，第一行就把沒有截止日期的作業濾掉：

```js
for (const a of asgns) {
  if (!a.due_at) continue;   // ← 無截止日期的作業完全不出現在學期待辦
  items.push({ ...a, _course: course });
}
```

結果是：一個未完成、非考試/簽到、但老師沒設 due date 的作業（例如 `Term Paper`、`Final Portfolio` 這類「學期任一時間交」的項目），在學期待辦頁**完全看不到**——只能進課程詳情才找得到。使用者希望這類作業在首頁學期待辦也有一個獨立區塊呈現。

## 目標

在學期待辦頁的右側清單，於四個緊急度分組（已逾期 / 7天內 / 8-30天 / 30天以上）**最底部**，新增一個「無截止日期」分組，收納所有未完成、未被隱藏、且 `DueTaskRules.urgency() === 'none'`（`due_at` 為 null 或無效日期）的作業。左側「本週概覽」的分級摘要也對應多一列可點擊捲動的「無截止日期」。

## 設計決策

1. **分組定義**：沿用單一真相來源 `DueTaskRules.urgency(a.due_at)`。它對 `null` 與無效日期都回傳 `'none'`——兩者都併入「無截止日期」組（無效日期等同無可用截止日）。
2. **位置**：排在 `later`（30天以上）之後、清單最底部。無截止＝時間壓力最低，置底最直覺，也與其他視圖「無截止排最後」一致。
3. **篩選**：完全走既有 `applyFilters`（＝ `!isHidden(a)` 且未完成）。考試/簽到（未升級）、手動隱藏、已完成者一律不進此組，與其他組規則一致。
4. **卡片外觀**：重用既有 `renderWeekCard`。`formatDue(null)` 已回傳 `tr('noDueDate')`（「無截止日期」），`urgencyClass(null,…)` 已回傳 `due-none`（灰）。卡片 due 行顯示灰色「無截止日期」，維持三行卡片版面一致（避免 grid 高度參差）。
5. **進度環**：**不改**。環的範圍是「逾期窗 ∪ 未來 7 天」的近期可行動集；無截止日期的作業沒有 deadline，不屬於「本週完成度」，故不計入分子分母。
6. **分級摘要列**：新增一列 `is-nodue`，顯示無截止數量、可點擊捲動到右側對應組（`data-scroll-group="nodue"` ↔ `data-group="nodue"`），與其他列行為一致。
7. **側欄待辦數（`updateSideNav` weekCount）**：**納入無截止項**。既有原則是「側欄數＝週待辦列表一致」；既然無截止項現在進入列表，計數同步納入，維持一致。實作上把 `updateSideNav` 的分組判斷改為鏡射 `renderWeekSection`：`urgency==='none'` → 計入。
8. **配色**：`--mid`（中性灰）。urgency 各組用其強調色（overdue 紅 / urgent 橘 / soon 暖黃 / later 藍）；無截止＝無急迫，用灰最誠實，也對齊 `due-none` 的既有處理。同時涵蓋 light/dark（`--mid` 已定義兩套）。
9. **i18n**：重用既有 `noDueDate` key（繁中「無截止日期」/ 簡中「无截止日期」/ en「No due date」），不新增 key。
10. **popup 不動**：需求明確指向 dashboard 學期待辦頁；popup 是 7 天預覽，維持原樣。

## 變更範圍

- `extension/dashboard/dashboard.js`
  - `renderWeekSection`：移除 `if (!a.due_at) continue;`（改為全收），新增 `noDue` 陣列（switch `default`/'none' push），排序（課程名→作業名），新增 sumRow、新增 renderGroup 於 `later` 之後。
  - `updateSideNav`：weekCount 計數鏡射 renderWeekSection，`urgency==='none'` 計入。
- `extension/dashboard/index.html`
  - CSS：`.week-group-title.color-nodue` 與 `.wk-sum-row.is-nodue .wk-sum-num` → `var(--mid)`。
- `dev/harness.html`（僅驗證用）：追加第二筆無截止作業，讓截圖有 2 張卡片。

## 驗證

dev harness（`due-static` port 8765）載入真實 dashboard + mock：確認學期待辦最底出現「無截止日期 (N)」組、卡片顯示 `Term Paper` 等、左側摘要多一列可點捲動、側欄待辦數含無截止項、深色模式與三語切換無異常。無截止項不影響進度環數字。

## 不做（YAGNI）

- 不新增 i18n key、不改 popup、不改課程詳情/grid（無截止項在那些視圖本就顯示）。
- 不把無截止項算進進度環。
- 不新增排序/收合偏好持久化。
