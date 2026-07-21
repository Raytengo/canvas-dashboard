# 雙向完成切換(Canvas 已繳可標回未完成)— 設計文件

- **日期**:2026-07-21
- **狀態**:已與使用者確認,待實作
- **範圍**:`extension/` Chrome 擴充功能
- **取代**:[2026-07-19 手動標記作業完成](2026-07-19-manual-assignment-completion-design.md) §2 的「只加不減」原則

---

## 1. 背景與問題

2026-07-19 的設計刻意把 Canvas 已繳/已評分的作業鎖死(`data-locked`,點擊靜默忽略),
語意是「Canvas 已判定完成的,不能改回未完成」。

實際使用回饋:**這感覺像壞掉**——同一個勾選圈,有的能點、有的點了沒反應,
而且沒有任何視覺回饋。常見的真實需求也被擋住:已繳但被退回重做、想重交、
Canvas 誤判已繳等情境,使用者希望能把它標回「未完成」讓它回到待辦清單。

實作根因(現況):

- `dashboard.js` renderAssignmentRow(約 line 1993):Canvas 已繳 → `data-locked="true"`
- `dashboard.js` 點擊 handler(約 line 1630):`if (btn.dataset.locked === 'true') return;`
- 資料模型只有單向的 `manualDone`(只存 true),沒有「強制未完成」可表達

附帶發現的漂移:`popup.js`(約 line 198)有一份**自己內嵌的**繳交判斷,
與 `completion.js` 的 `isSubmitted` 不一致(popup 多看 `score != null`、少看 `submitted_at`),
本次一併對齊。

---

## 2. 目標與語意(已確認)

**所有作業的完成狀態都可雙向切換,純本地顯示,不動 Canvas 端:**

- Canvas 已繳的作業也能標回「未完成」→ 回到待辦清單(dashboard 與 popup 一致)。
- 再點一次 → 回到「完成」(回歸 Canvas 事實,而不是另外記一筆手動完成)。
- Canvas 繳交**事實**與本地顯示**狀態**分離:「已繳交」badge 照舊跟著 `isSubmitted` 顯示,
  列的灰色樣式、緊急計數、清單歸屬跟著 `isDone`。
- 完成判斷公式:

```
isDone(a, manualDone, manualUndone)
  = (isSubmitted(a) && !manualUndone[String(a.id)]) || manualDone[String(a.id)]
```

**明確不做**(YAGNI):三態 UI、動 Canvas API(重交/退回是 Canvas 的事)、動畫時長調整、
資料遷移(既有 `manualDone` 原樣沿用)。

---

## 3. 資料模型

新增 `chrome.storage.local` key,與 `manualDone` 鏡像對稱:

```jsonc
"manualUndone": { "991004": true }   // = 這筆 Canvas 已繳,但使用者標回未完成
```

- key 一律 `String(assignment.id)`;只存 `true`,取消時**刪除該 key**。
- **獨立於同步**:`syncAll()` 不碰 `manualDone` / `manualUndone`。
- 兩個 map 經 UI 不會同時設值(切換入口依 `isSubmitted` 分流);
  萬一髒資料同時存在,公式讓 `manualDone` 勝出(仍算完成),無害。
- 邊界:若 Canvas 端狀態倒退(已繳 → 未繳,如老師退回),殘留的 `manualUndone[id]`
  不影響結果(`isSubmitted` 已 false),屬無害殘留,不做清理機制。

---

## 4. `completion.js` API 變更(單一真相來源)

```
isSubmitted(assignment)                      // 不變:Canvas 事實
isManualDone(map, id)                        // 不變
isManualUndone(map, id)                      // 新增:鏡像 isManualDone
isDone(assignment, manualDone, manualUndone) // 第三參數新增,可省略(省略=現行為,向後相容)
toggleManualDone(map, id, nextState?)        // 不變:通用 map 切換,manualUndone 直接重用
normalizeManualDone(map)                     // 不變:兩個 map 都可用
```

---

## 5. UI 行為

| 作業狀態 | 圓圈外觀 | 點擊行為 |
|---|---|---|
| 未繳、未手動完成 | 空心 | 標記完成(翻轉 `manualDone`)→ 待辦視圖走 3 秒撤銷 + 碎點爆 |
| 未繳、手動完成 | 綠色實心勾 | 取消完成(翻轉 `manualDone`)→ 即時重繪 |
| **Canvas 已繳** | 綠色實心勾 | **標回未完成(設 `manualUndone[id]`)→ 即時重繪,回到待辦** |
| **Canvas 已繳、已標回未完成** | 空心(列上仍有「已繳交」badge) | **再標完成(刪 `manualUndone[id]`)→ 待辦視圖走 3 秒撤銷 + 碎點爆** |

- 移除 `data-locked` 屬性、點擊早退、`index.html` 對應 CSS。
- `applyFilters` 已走 `isDone`,清單歸屬自動正確,免改。
- 一致性修正:`dashboard.js` 側欄緊急數(約 line 900)、課程卡片列顏色(約 line 1201)
  由 `isSubmitted` 改 `isDone`。
- popup:`popup.html` 引入 `dashboard/completion.js`(UMD),`getUpcomingTasks`
  改用 `DueCompletion.isDone(a, manualDone, manualUndone)` 取代內嵌判斷。
  行為變化:popup 對「有分數但 `workflow_state` 非 submitted/graded 且無 `submitted_at`」
  的邊角資料從「排除」變「顯示」,與 dashboard 一致。

---

## 6. 測試

`completion.test.js` 新增(TDD,先紅後綠):

- `isManualUndone`:命中 / 未命中 / 空 map / null map / 數字 id 正規化。
- `isDone` 三參數:已繳 + undone → **false**;已繳 + undone + manualDone 髒資料 → true(manualDone 勝出);
  未繳 + undone 殘留 → false(無害);省略第三參數 → 與現行為完全相同(回歸)。
- 雙向切換流程:已繳作業 toggle undone → not done → 再 toggle → done(重用 `toggleManualDone` 於 undone map)。

UI 驗證:使用本地 mock data(5 課程 25 筆,其中 10 筆 Canvas 已繳)手動走查上表四種狀態。

---

## 7. 檔案異動清單

| 檔案 | 異動 |
|---|---|
| `extension/dashboard/completion.js` | 新增 `isManualUndone`;`isDone` 第三參數 |
| `extension/dashboard/completion.test.js` | 新增上述測試 |
| `extension/dashboard/dashboard.js` | loadData 讀 `manualUndone`;`isDone` helper 傳三參數;點擊 handler 依 `isSubmitted` 分流;移除 locked;line 900 / 1201 改 `isDone` |
| `extension/dashboard/index.html` | 移除 `.assignment-check[data-locked="true"]` CSS |
| `extension/popup.html` | 引入 `dashboard/completion.js` |
| `extension/popup.js` | 讀 `manualUndone`;改用 `DueCompletion.isDone` |
| `CLAUDE.md` / `AGENTS.md` | 資料格式加 `manualUndone`;功能描述更新 |
