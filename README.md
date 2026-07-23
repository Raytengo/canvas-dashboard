<div align="center">

<img src="icon_design.png" width="120" alt="Due" />

# Due

**A Canvas dashboard that tells you what to do next.**

Due is a Chrome extension that syncs with any Canvas LMS and lays out every
assignment, deadline, and grade weight in one calm, prioritized dashboard —
no API tokens, no account setup, no server.

🌐 **English** · [繁體中文](README.zh-TW.md)

</div>

---

## What it does

Canvas buries what matters under menus and tabs. Due strips it down to a single
question: *what should I do next?*

- Click the toolbar icon for a **7-day popup** — everything due this week, plus a pinned "overdue" list, at a glance.
- Open the **dashboard** for the full picture — every course, every assignment, color-coded by urgency, with grade weights and a live grade calculator.

Due signs in as *you*: it borrows your browser's existing Canvas session, so
there's nothing to configure. Log in to Canvas once and it syncs automatically.

---

## Features

| | |
|---|---|
| **7-day popup** | Instant view of what's due this week, with a pinned overdue section |
| **Urgency colors** | Red overdue · Orange ≤7 days · Yellow 8–30 days · Blue 30+ days |
| **Week progress ring** | How much of this week's work you've cleared, broken down by urgency |
| **Grade weights** | Per-course breakdown of assignment groups and their weights |
| **Grade calculator** | Enter scores for a live weighted total — Canvas grades prefill automatically |
| **Drag to organize** | Exams & attendance auto-hide; drag any hidden item back, or tuck others away |
| **One-tap done** | Mark anything complete (with a 1.5s undo window), independent of Canvas |
| **Custom assignments** | Add your own to-dos that Canvas doesn't know about |
| **Course renaming** | Give any course a friendlier display name — stored locally |
| **Guided onboarding** | A 5-step tour on first run walks you through setup |
| **Claude usage** | Optional: show your Claude plan usage % in the popup |
| **Multi-language** | 繁體中文 · 简体中文 · English |

---

## Works with any Canvas school

Due never asks for an API token or a password. It uses the Canvas session
already in your browser, so any school running Canvas works out of the box —
just be logged in.

> Built for HKUST(GZ), where students can't generate personal access tokens, so
> Due borrows the browser's login instead. Nothing about it is tied to one school.

---

## Install

Due isn't on the Chrome Web Store yet — load it unpacked:

1. **Download** this repo — green **Code** button → *Download ZIP*, then unzip (or `git clone`).
2. Open **`chrome://extensions`** in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the **`extension/`** folder.
5. **Log in to Canvas** — Due syncs automatically on your next visit.
6. Click the Due icon → **Open Dashboard**. 📌 Pin the extension for one-click access.

A short 5-step tour opens the first time to walk you through it.

---

## Privacy

Everything stays on your device. Due has **no backend server, no analytics, and
no telemetry** — all data lives in `chrome.storage.local` and is never sent to
the developer. Read the full [privacy policy](privacy-policy.md).

---

## For developers

Due is plain **vanilla JavaScript** on **Manifest V3** — no framework, no build step.

```
extension/
├── manifest.json      # MV3 config
├── background.js      # service worker: Canvas API sync + Claude usage
├── popup.html / .js   # toolbar popup (7-day view)
└── dashboard/
    ├── index.html     # dashboard markup + styles
    ├── dashboard.js   # rendering + events
    └── *.js           # taskRules · completion · customAssignments · descSanitizer
```

- **Load it:** after editing anything in `extension/`, reload from `chrome://extensions`.
- **Iterate fast:** run `node dev/serve.js` and open <http://localhost:8765/dev/harness.html>
  (or `popup-harness.html`) to work on the dashboard and popup in a normal tab with mock data.
- **Tests:** the shared logic modules are unit-tested with plain Node — e.g.
  `node extension/dashboard/taskRules.test.js`.

For the full architecture, data model, and design system, see [`CLAUDE.md`](CLAUDE.md).

---

## Design

Built on Anthropic's design language — warm off-white surfaces, Source Serif 4
headings, DM Sans body text, DM Mono for labels and numbers. Light mode, with
lots of breathing room.

---

<div align="center">
<sub>Version 2.0.0 · <a href="LICENSE">MIT License</a></sub>
</div>
