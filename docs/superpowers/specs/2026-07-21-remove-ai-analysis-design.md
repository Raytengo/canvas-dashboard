# 完全移除 AI 分析 — 設計文件

- **日期**：2026-07-21
- **狀態**：已與使用者確認範圍，待實作
- **決定**：A（逐作業 AI 分析）+ B（syllabus 評分比重 AI 分析）**全砍**；C（popup 的 Claude 用量 chip）**保留**

---

## 0. 範圍摘要

| 代號 | 功能 | 處置 |
|------|------|------|
| A | 逐作業 AI 分析（分析面板、AI 分析鈕、里程碑 checklist、8 家 LLM 後端） | **移除** |
| B | Syllabus 評分比重 AI 分析（含同步時自動偷跑 `autoAnalyzeGradingWeights`） | **移除** |
| C | popup Claude 用量 chip（讀 claude.ai `/usage`，不呼叫 LLM） | **保留，完全不動** |

**鐵則：只砍 A/B 及其專屬附屬物，不得動到任何其他功能。**

---

## 1. 必須保留（KEEP — 動到就是 bug）

- **完成過渡動畫**整套（`beginComplete`/`finishComplete`/`cancelComplete`/`spawnBurstDots`/`rerenderDetailAndNav`、`.assignment-check`、`.completing`/`.bursting`/`.complete-*` CSS、`_completeTimers`、`manualDone`、`completion.js`）
- **評分圓餅圖** `renderWeightPie` 的 **Canvas 分組權重** 路徑 + **手動輸入權重**（`customWeights`）路徑，及手動權重編輯器
- 成績計算器、作業篩選、課程重命名、自訂作業（`customAssignments.js`）、i18n 框架、深色模式、語言切換、7 天待辦 popup
- **C（Claude 用量）**：`fetchClaudeUsageDirect`、`parseApiUsage`、`SYNC_CLAUDE_USAGE`、popup 的 usage chip、`claude_injected.js`、`claude_content.js`、`claude.ai` 權限與 content_scripts、`claudeUsage`/`claudeOrgId` 儲存
- Canvas 同步核心：`fetchCourses`/`fetchAssignments`/`fetchAssignmentGroups`、分頁、學校名稱偵測、`SYNC`/`GET_STATUS`

---

## 2. background.js（~907 → 約 350 行）

**移除訊息處理**：`ANALYZE_ASSIGNMENT`、`GET_ANALYSIS`、`ANALYZE_SYLLABUS`、`GET_SYLLABUS_ANALYSIS`、`FETCH_PDF`

**移除函式**：`resolveAiConfig`、`handleAnalyze`、`fetchSyllabusHtml`、`findSyllabusByKeyword`、`selectSyllabusPdfWithAI`、`handleSyllabusAnalyze`、`extractCanvasFileIds`、`extractAllFileIds`、`selectRelevantFiles`、`selectRelevantAnnouncements`、`tryFetchPdf`、`stripPdfForOpenAICompatible`、`callProvider`、`callGemini`、`callOpenAICompatible`、`arrayBufferToBase64`、`autoAnalyzeGradingWeights`、`fetchFiles`、`fetchAnnouncements`
- 若 `stripHtmlService` / `fetchJSON` 只被上述 AI 函式使用，一併移除；若仍被保留路徑使用則留下（實作時 grep 確認）。

**`syncAll` 修改**：
- 移除 `fetchFiles` / `fetchAnnouncements` 呼叫與 `files`/`announcements` 的組裝與儲存
- 移除結尾的 `await autoAnalyzeGradingWeights(courses)`
- 其餘（courses/assignments/assignmentGroups/schoolName/lastSync）不變

**保留**：C 相關全部（`fetchClaudeUsageDirect`、`parseApiUsage`、`SYNC_CLAUDE_USAGE` handler）、Canvas 同步、`normalizeBaseUrl`、`fetchAllPages`、`parseLinkNext`、學校名稱那組。

---

## 3. dashboard.js

**移除**：
- 分析面板：開啟/關閉/渲染的所有函式與事件（滑入面板、`analysisTitle`、摘要/時數/需求/里程碑/貼士渲染）、里程碑勾選持久化
- 作業列「AI 分析」鈕（`renderAssignmentRow` 內，`btn-analyze` / `analyzeBtn`）與其事件綁定 — **注意：保留同一列的完成勾選圈與其它內容**
- `renderSyllabusSection`、「分析 syllabus」鈕與 `.btn-syllabus-analyze` 事件、`ANALYZE_SYLLABUS` 的兩處 `sendMessage`（line ~1683 課程詳情、line ~2384 手動權重編輯器內的「AI 分析權重」）
  - line 2384 在手動權重編輯流程中：**只移除「用 AI 分析權重」這個動作/按鈕，保留手動輸入權重的編輯器本體**
- `renderWeightPie` 的 **syllabus fallback 分支**（`syllabusData` 那段）；保留 Canvas 分組與 `customWeights` 分支；沒有任何資料時顯示既有的 `noGradeInfo`
  - 連帶：`renderWeightPie` 簽名可移除 `syllabusData` 參數，呼叫端同步調整
- Welcome 畫面的 AI mock（`welcome-ai-mock-*`）改為不宣傳 AI 的內容（保留 welcome 本體，移除 AI 示例區塊）
- 設定選單中選 AI 模型 / 輸入 API key 的項目與子選單邏輯（保留設定選單本體：深色模式、語言等）
- `_currentData` 與 `loadData` 的 `chrome.storage.local.get`：移除 `analysis`、`milestoneChecks`、`syllabusAnalysis`、`files`、`announcements`（若有）
- 所有僅供 A/B 用的 i18n key（三語言都要，含但不限於）：`analyzeWeight`、`analyzeBtn`、`analyzing`、`reanalyzing`、`analyzingShort`、`reanalyze`、`estimatedHoursLabel`、`requirementsLabel`、`milestonesLabel`、`tipsLabel`、`analysisError`、`analysisTitle`、`andConfigure`、`noModelIdShort`、AI 設定/API key/模型相關、welcome AI mock 相關字串
  - **保留** `manualDone` 用的 `markDone`/`markUndone`/`undoComplete`、`submittedBadge`、`noGradeInfo` 等非 AI key

**保留**：完成動畫、篩選、重命名、成績計算器、自訂作業、手動權重、C 無關。

---

## 4. index.html

**移除 CSS + markup**：`.analysis-panel*`、`.milestone*`、`.btn-analyze`、`.welcome-ai-mock-*`、設定選單中 AI 模型/API key 的 markup 與樣式、以及分析面板的 DOM 容器
**保留**：完成動畫 CSS（`.completing`/`.bursting`/`.complete-*`）、評分圓餅 CSS、設定選單殼、其餘全部。

---

## 5. manifest.json

- `host_permissions` 移除：`generativelanguage.googleapis.com`、`dashscope.aliyuncs.com`、`api.deepseek.com`、`canvas-user-content.com`
- 保留：`*.instructure.com`、`claude.ai`（C 需要）、全部 `permissions`、claude 的 `content_scripts`
- `description` 移除「AI analysis」字樣（例如改為 "Canvas LMS Dashboard — auto-sync assignments and deadlines for any Canvas school"）

---

## 6. popup.js / popup.html

- 只保留 C（Claude 用量）與 7 天待辦。**預期不需改動**；若有殘留呼叫已移除的 AI 訊息才需清理（grep 確認）。

---

## 7. CLAUDE.md

- 移除/改寫 AI 分析相關段落（`handleAnalyze`、`handleSyllabusAnalyze`、AI 後端表、分析面板、syllabus 分析、待開發功能中的 AI 項）
- 更新 storage schema：移除 `analysis`、`syllabusAnalysis`、`milestoneChecks`（`manualDone` 保留）、`geminiApiKey`/`aiModel` 等 AI 設定
- 保留 C（Claude 用量）與完成功能的描述

---

## 8. 儲存資料

- 不主動清除舊的 `analysis`/`syllabusAnalysis`/`milestoneChecks`/`files`/`announcements`/`geminiApiKey`/`aiModel` 等 key（殘留無害，不再讀寫即可）。YAGNI。

---

## 9. 副作用（可接受，已知會）

- 評分圓餅只剩 Canvas 分組權重 + 手動輸入；兩者皆無的課顯示「無評分資訊」。
- 同步更快：不再抓 PDF/公告、不再自動跑 syllabus AI。
- popup 的 Claude 用量 chip 照常。

---

## 10. 驗證（暑假無作業）

1. `node --check` 全數通過：`background.js`、`dashboard.js`、`popup.js`、`completion.js`、`customAssignments.js`。
2. 單元測試仍全綠：`completion.test.js`、`customAssignments.test.js`（未回歸）。
3. **無殘留引用** grep（都應為 0 / 無孤兒）：
   - `ANALYZE_ASSIGNMENT|GET_ANALYSIS|ANALYZE_SYLLABUS|GET_SYLLABUS_ANALYSIS|FETCH_PDF`（除了 background 已移除、dashboard 不應再有）
   - `handleAnalyze|handleSyllabusAnalyze|callProvider|callGemini|callOpenAICompatible|autoAnalyzeGradingWeights|selectRelevant|renderSyllabusSection`
   - `analysis-panel|btn-analyze|welcome-ai-mock|milestone-`（index.html/dashboard.js）
   - 被移除的 i18n key 不再被 `tr()` 呼叫
   - manifest 不再含 googleapis/dashscope/deepseek/canvas-user-content
4. **KEEP 清單健檢**：`beginComplete`/`.assignment-check`/`renderWeightPie`(Canvas+customWeights)/成績計算器/`fetchClaudeUsageDirect`/`SYNC_CLAUDE_USAGE` 皆在。
5. 人工驗收（交回使用者）：`chrome://extensions` 重新載入 → 同步正常、作業列有完成勾選但**無** AI 鈕、課程詳情**無** syllabus 鈕、評分圓餅用 Canvas/手動權重、設定選單無 API key/模型、popup 用量 chip 正常。

---

## 11. 影響檔案

`extension/background.js`、`extension/dashboard/dashboard.js`、`extension/dashboard/index.html`、`extension/manifest.json`、`CLAUDE.md`。
（`popup.*`、`completion.js`、`customAssignments.js`、`claude_*.js` 預期不動。）
