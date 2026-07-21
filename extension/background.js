let BASE_URL = '';


// Load stored Canvas URL on startup (service worker may restart)
chrome.storage.local.get(['canvasBaseUrl'], (data) => {
  if (data.canvasBaseUrl) BASE_URL = data.canvasBaseUrl;
});

// 首次安裝時開啟教學頁面
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html?welcome=1') });
  }
});

// 監聽造訪任何 Canvas 頁面，自動偵測學校 URL 並觸發同步
chrome.webNavigation
  ? chrome.webNavigation.onCompleted.addListener(
    (details) => {
      if (details.frameId !== 0) return;
      try {
        const origin = new URL(details.url).origin;
        if (origin !== BASE_URL) {
          BASE_URL = origin;
          chrome.storage.local.set({ canvasBaseUrl: origin });
        }
      } catch (_) { }
      syncAll();
    },
    { url: [{ hostSuffix: '.instructure.com' }] }
  )
  : null;

// Claude usage is now handled passively via content script (claude_injected.js + claude_content.js)
// No webNavigation listener needed for claude.ai

// ── Message handlers ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SYNC') {
    syncAll()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_STATUS') {
    chrome.storage.local.get(['lastSync', 'courses'], (data) => {
      sendResponse({
        lastSync: data.lastSync || null,
        courseCount: (data.courses || []).length,
      });
    });
    return true;
  }

  if (message.type === 'CLAUDE_ORG_ID_LEARNED') {
    // Passively learned orgId from any claude.ai org API call — store for future direct fetches
    chrome.storage.local.set({ claudeOrgId: message.orgId });
    return false;
  }

  if (message.type === 'CLAUDE_USAGE_INTERCEPTED') {
    // Passively received from content script — parse and store
    const record = parseApiUsage(message.data);
    if (record) {
      chrome.storage.local.set({ claudeOrgId: message.orgId, claudeUsage: record });
    }
    return false; // no sendResponse needed
  }

  if (message.type === 'SYNC_CLAUDE_USAGE') {
    fetchClaudeUsageDirect()
      .then((usage) => sendResponse({ success: true, usage }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function fetchJSON(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Claude Usage (API-based) ──

// Parse the /api/organizations/{id}/usage JSON response
function parseApiUsage(data) {
  if (!data || !data.five_hour) return null;
  const { utilization, resets_at } = data.five_hour;
  if (utilization == null) return null;
  return {
    usedPercent: Math.round(Number(utilization)),
    resetAt: resets_at || null,
    lastSync: new Date().toISOString(),
  };
}

// Fetch usage by executing script inside an existing claude.ai tab
// (Cloudflare blocks direct fetch from service worker context)
async function fetchClaudeUsageDirect() {
  // Find any claude.ai tab
  const tabs = await chrome.tabs.query({});
  const claudeTab = tabs.find((t) => {
    try { return t.url && new URL(t.url).hostname === 'claude.ai'; } catch (_) { return false; }
  });

  if (!claudeTab) {
    console.warn('[Due] No claude.ai tab open — cannot fetch usage');
    return null;
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: claudeTab.id },
      func: async () => {
        try {
          // Step 1: get orgId
          const orgRes = await fetch('/api/organizations', { credentials: 'include' });
          if (!orgRes.ok) return { error: `org status ${orgRes.status}` };
          const orgs = await orgRes.json();
          if (!Array.isArray(orgs) || orgs.length === 0 || !orgs[0].uuid) {
            return { error: 'no org found' };
          }
          const orgId = orgs[0].uuid;

          // Step 2: get usage
          const usageRes = await fetch(`/api/organizations/${orgId}/usage`, { credentials: 'include' });
          if (!usageRes.ok) return { error: `usage status ${usageRes.status}` };
          const data = await usageRes.json();

          return { orgId, data };
        } catch (err) {
          return { error: err.message };
        }
      },
    });

    if (!result || !result.result) return null;
    const { orgId, data, error } = result.result;

    if (error) {
      console.warn('[Due] In-tab usage fetch error:', error);
      return null;
    }

    // Store orgId for content script use
    if (orgId) await chrome.storage.local.set({ claudeOrgId: orgId });

    const record = parseApiUsage(data);
    if (record) {
      await chrome.storage.local.set({ claudeUsage: record });
      return record;
    }
  } catch (err) {
    console.warn('[Due] executeScript failed:', err.message);
  }

  return null;
}


// ── Canvas API pagination ──
async function fetchAllPages(url) {
  const results = [];
  let nextUrl = url;
  while (nextUrl) {
    const res = await fetch(nextUrl, { credentials: 'include' });
    if (!res.ok) throw new Error(`Canvas API error: ${res.status} ${res.statusText}`);
    results.push(...(await res.json()));
    nextUrl = parseLinkNext(res.headers.get('Link'));
  }
  return results;
}

function parseLinkNext(linkHeader) {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

// ── Canvas API endpoints ──
async function fetchCourses() {
  return fetchAllPages(`${BASE_URL}/api/v1/courses?enrollment_state=active&per_page=50`);
}

async function fetchAssignments(courseId) {
  return fetchAllPages(
    `${BASE_URL}/api/v1/courses/${courseId}/assignments?per_page=50&include[]=submission`
  );
}

async function fetchAssignmentGroups(courseId) {
  return fetchAllPages(
    `${BASE_URL}/api/v1/courses/${courseId}/assignment_groups?include[]=assignments&include[]=group_weight`
  );
}

function isGenericSchoolName(name) {
  if (!name) return true;
  const n = String(name).trim().toLowerCase();
  return n === 'canvas' || n === 'instructure';
}

function inferSchoolNameFromHost() {
  try {
    const host = new URL(BASE_URL).host; // e.g. hkust-gz.instructure.com
    const sub = host.split('.')[0] || '';
    if (!sub) return 'Canvas';
    const parts = sub.split('-').filter(Boolean).map((p) => p.toUpperCase());
    if (parts.length >= 2) return `${parts[0]}(${parts.slice(1).join('-')})`;
    return parts[0];
  } catch (_) {
    return 'Canvas';
  }
}

async function fetchSchoolName(courses = []) {
  // 1) Try account self first.
  try {
    const account = await fetchJSON(`${BASE_URL}/api/v1/accounts/self`);
    if (account && account.name && !isGenericSchoolName(account.name)) return account.name;
  } catch (_) { }

  // 2) Try course account_id(s), pick first non-generic account name.
  const accountIds = [...new Set((courses || []).map((c) => c.account_id).filter(Boolean))];
  for (const accountId of accountIds) {
    try {
      const account = await fetchJSON(`${BASE_URL}/api/v1/accounts/${accountId}`);
      if (account && account.name && !isGenericSchoolName(account.name)) return account.name;
    } catch (_) { }
  }

  // 3) Fallback from hostname.
  return inferSchoolNameFromHost();
}

// ── Sync ──
async function syncAll() {
  if (!BASE_URL) {
    console.warn('[Due] Canvas URL not yet detected — please visit your Canvas site first.');
    return;
  }
  console.log('[Due] 開始同步...', BASE_URL);

  let courses;
  let schoolName = 'Canvas';
  try {
    courses = await fetchCourses();
    schoolName = await fetchSchoolName(courses);
  } catch (err) {
    console.error('[Due] 拉取課程失敗:', err);
    return;
  }

  courses = courses.filter((c) => c.name && c.workflow_state === 'available');

  const assignments = {};
  const assignmentGroups = {};

  await Promise.all(
    courses.map(async (course) => {
      try {
        const [asgn, groups] = await Promise.all([
          fetchAssignments(course.id),
          fetchAssignmentGroups(course.id),
        ]);
        assignments[course.id] = asgn;
        assignmentGroups[course.id] = groups;
      } catch (err) {
        console.error(`[Due] 課程 ${course.id} 同步失敗:`, err);
        assignments[course.id] = [];
        assignmentGroups[course.id] = [];
      }
    })
  );

  await chrome.storage.local.set({
    lastSync: new Date().toISOString(),
    schoolName,
    courses,
    assignments,
    assignmentGroups,
  });

  console.log(`[Due] 同步完成，共 ${courses.length} 門課程`);
}
