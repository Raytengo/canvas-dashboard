(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.DueDescSanitizer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // ── 白名單標籤（一律小寫比對）：保留並重建乾淨元素 ──
  const ALLOWED_TAGS = new Set([
    'p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 'a',
  ]);

  // ── 危險標籤：整棵子樹移除（連同其文字內容一併丟棄）──
  const DROP_TAGS = new Set([
    'script', 'style', 'iframe', 'img', 'video', 'object', 'embed',
  ]);

  // ── 標題標籤：降級為 <strong>…</strong><br>（Canvas 描述常見 h1-h6）──
  const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

  // ── href 安全判斷：只允許 http/https（大小寫不敏感、去除前後空白後比對）──
  //    javascript:/data:/vbscript:/相對路徑/協定相對(//)/空值 一律拒絕
  function isSafeHref(href) {
    if (typeof href !== 'string') return false;
    const trimmed = href.trim();
    if (!trimmed) return false;
    return /^https?:\/\//i.test(trimmed);
  }

  // ── 遞迴走訪來源節點的子節點，把清理後的節點附加到目標元素 ──
  function sanitizeChildren(srcParent, destParent, doc) {
    const children = srcParent.childNodes;
    for (let i = 0; i < children.length; i++) {
      sanitizeNode(children[i], destParent, doc);
    }
  }

  function sanitizeNode(node, destParent, doc) {
    // 文字節點：原樣複製（createTextNode 自動處理跳脫，無 XSS 風險）
    if (node.nodeType === 3 /* TEXT_NODE */) {
      destParent.appendChild(doc.createTextNode(node.nodeValue));
      return;
    }
    // 非元素節點（註解、CDATA…）一律忽略
    if (node.nodeType !== 1 /* ELEMENT_NODE */) return;

    const tag = (node.tagName || '').toLowerCase();

    // 危險標籤：整棵子樹移除
    if (DROP_TAGS.has(tag)) return;

    // 標題降級：<strong>內容</strong> + 換行
    if (HEADING_TAGS.has(tag)) {
      const strong = doc.createElement('strong');
      sanitizeChildren(node, strong, doc);
      destParent.appendChild(strong);
      destParent.appendChild(doc.createElement('br'));
      return;
    }

    // 白名單標籤：以 createElement 重建，僅複製明確允許的屬性
    if (ALLOWED_TAGS.has(tag)) {
      const clean = doc.createElement(tag);
      if (tag === 'a') {
        const href = node.getAttribute('href');
        if (isSafeHref(href)) {
          clean.setAttribute('href', href.trim());
          clean.setAttribute('target', '_blank');
          clean.setAttribute('rel', 'noopener noreferrer');
        }
        // href 不安全 → 不設任何屬性（style/on*/class/id 等一律不複製）
      }
      sanitizeChildren(node, clean, doc);
      destParent.appendChild(clean);
      return;
    }

    // 其餘未知標籤：unwrap（丟棄標籤本身，保留其文字與合法子元素）
    sanitizeChildren(node, destParent, doc);
  }

  // ── 主入口：回傳安全 HTML 字串 ──
  //    node 環境無 DOMParser → 明確拋錯（isSafeHref 等純函式仍可 require 測試）
  function sanitize(html) {
    if (typeof DOMParser === 'undefined') {
      throw new Error('DueDescSanitizer.sanitize requires DOMParser (browser-only)');
    }
    if (!html || typeof html !== 'string') return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const out = doc.createElement('div');
    // 只走訪 body：DOMParser 會把散落的 <script>/<style> 塞進 head，天然被排除
    sanitizeChildren(doc.body, out, doc);
    return out.innerHTML;
  }

  return {
    sanitize,
    isSafeHref,
    ALLOWED_TAGS,
    DROP_TAGS,
    HEADING_TAGS,
  };
});
