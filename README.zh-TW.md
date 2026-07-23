<div align="center">

<img src="icon_design.png" width="120" alt="Due" />

# Due

**一眼看懂：現在該做哪份作業。**

Due 是一個 Chrome 擴充功能，能同步任何 Canvas LMS，把所有作業、截止日期與
評分比重整理進一個乾淨、依緊急度排序的 Dashboard——不需要 API token、不用
註冊帳號、沒有伺服器。

🌐 [English](README.md) · **繁體中文**

</div>

---

## 它能做什麼

Canvas 把真正重要的事埋在一層層選單與分頁底下。Due 把它收斂成一個問題：
*我接下來該做什麼？*

- 點工具列圖示，打開 **7 天待辦 popup**——本週所有到期作業，加上置頂的「已逾期」清單，一眼掃完。
- 打開 **Dashboard** 看完整全貌——每一門課、每一份作業，依緊急度標色，附評分比重與即時成績計算器。

Due 以「你」的身分登入：它借用瀏覽器裡現成的 Canvas 登入狀態，所以完全不用
設定。登入 Canvas 一次，之後就會自動同步。

---

## 功能

| | |
|---|---|
| **7 天待辦 popup** | 本週到期作業一覽，含置頂「已逾期」區 |
| **緊急度色階** | 逾期紅 · ≤7 天橘 · 8–30 天黃 · 30 天以上藍 |
| **本週進度環** | 本週作業完成了多少，並依緊急度分級呈現 |
| **評分比重** | 每門課的作業分組與各自權重 |
| **成績計算器** | 輸入分數即時算加權總分——Canvas 已評分自動預填 |
| **拖曳整理** | 考試與簽到自動隱藏；可把任何隱藏項拖回，或把其他項收起 |
| **一鍵完成** | 任何項目都可標記完成（附 1.5 秒撤銷窗口），獨立於 Canvas 繳交狀態 |
| **自訂作業** | 加入 Canvas 沒有、但你自己要追蹤的待辦 |
| **課程重新命名** | 給任何課程一個好記的顯示名稱——只存在本機 |
| **新手教學** | 首次開啟有 5 頁導覽帶你完成設定 |
| **Claude 用量** | 選用：在 popup 顯示你的 Claude 方案用量 % |
| **多語言** | 繁體中文 · 简体中文 · English |

---

## 適用任何 Canvas 學校

Due 從不要求 API token 或密碼。它使用瀏覽器裡既有的 Canvas 登入狀態，所以任何
使用 Canvas 的學校都能直接用——只要你已經登入。

> 為 HKUST(GZ) 打造——該校不允許學生自行產生 personal access token，所以 Due
> 改為借用瀏覽器的登入狀態。但它的設計並不綁定任何單一學校。

---

## 安裝

Due 還沒上架 Chrome Web Store，先以「載入未封裝項目」的方式安裝：

1. **下載**本專案——綠色 **Code** 按鈕 → *Download ZIP*，解壓縮（或用 `git clone`）。
2. 在 Chrome 打開 **`chrome://extensions`**。
3. 開啟右上角的 **開發人員模式**。
4. 點 **載入未封裝項目**，選擇 **`extension/`** 資料夾。
5. **登入 Canvas**——下次造訪時 Due 會自動同步。
6. 點 Due 圖示 → **開啟 Dashboard**。📌 建議把擴充功能釘選，方便一鍵開啟。

首次開啟時會有一段 5 頁導覽帶你走一遍。

---

## 隱私

所有資料都留在你的裝置上。Due **沒有後端伺服器、沒有分析追蹤、也沒有任何
遙測**——資料全存在 `chrome.storage.local`，絕不會傳送給開發者。完整說明見
[隱私政策](privacy-policy.md)。

---

## 給開發者

Due 是純 **vanilla JavaScript** 搭 **Manifest V3**——無框架、無建置步驟。

```
extension/
├── manifest.json      # MV3 設定
├── background.js      # service worker：Canvas API 同步 + Claude 用量
├── popup.html / .js   # 工具列 popup（7 天待辦）
└── dashboard/
    ├── index.html     # Dashboard 骨架 + 樣式
    ├── dashboard.js   # 渲染 + 事件
    └── *.js           # taskRules · completion · customAssignments · descSanitizer
```

- **載入：** 修改 `extension/` 下任何檔案後，到 `chrome://extensions` 重新載入。
- **快速迭代：** 執行 `node dev/serve.js`，打開 <http://localhost:8765/dev/harness.html>
  （或 `popup-harness.html`），就能在一般分頁用 mock 資料開發 Dashboard 與 popup。
- **測試：** 共用邏輯模組都有純 Node 單元測試，例如
  `node extension/dashboard/taskRules.test.js`。

完整架構、資料格式與設計規範，見 [`CLAUDE.md`](CLAUDE.md)。

---

## 設計

遵循 Anthropic 品牌設計語言——暖米白底色、Source Serif 4 標題、DM Sans 內文、
DM Mono 標籤與數字。純 light mode，大量留白。

---

<div align="center">
<sub>版本 2.0.0 · <a href="LICENSE">MIT License</a></sub>
</div>
