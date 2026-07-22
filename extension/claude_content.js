// Isolated world — bridges intercepted data from main world to background.js
window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  if (!e.data) return;
  if (!chrome.runtime?.id) return;  // 擴充已重載，舊 content script 直接放棄

  if (e.data.type === '__DUE_CLAUDE_USAGE__') {
    // Full usage data intercepted
    chrome.runtime.sendMessage({
      type: 'CLAUDE_USAGE_INTERCEPTED',
      orgId: e.data.orgId,
      data: e.data.data,
    }).catch(() => {});
  } else if (e.data.type === '__DUE_CLAUDE_ORG_ID__') {
    // Learned orgId passively from any org API call
    chrome.runtime.sendMessage({
      type: 'CLAUDE_ORG_ID_LEARNED',
      orgId: e.data.orgId,
    }).catch(() => {});
  }
});
