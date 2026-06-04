// Background Service Worker for RedStream

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("stream.html") });
});

// ── Scraper state ────────────────────────────────────────────────────────
const activeScrapes      = new Map(); // tabId → state
const activeNichesScrapes = new Map();

// ── Message handler ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  const senderTabId = sender.tab?.id ?? null;
  const scraperTabId = sender.tab ? sender.tab.id : null;

  if (msg.action === 'START_SCRAPE') {
    scrapeTab(msg, respond, senderTabId);
    return true;
  }

  if (msg.action === 'GET_SCRAPE_CONFIG') {
    const s = scraperTabId
      ? (activeScrapes.get(scraperTabId) ?? activeNichesScrapes.get(scraperTabId))
      : null;
    respond(s?.config ?? null);
    return false;
  }

  if (msg.action === 'DATA_CAPTURED') {
    const s = scraperTabId ? activeScrapes.get(scraperTabId) : null;
    if (s && msg.videos) {
      const ids = new Set(s.videos.map(v => v.id));
      msg.videos.forEach(v => {
        if (v?.id && !ids.has(v.id)) { ids.add(v.id); s.videos.push(v); }
      });
    }
    return false;
  }

  if (msg.action === 'SCRAPE_COMPLETE') {
    const s = scraperTabId ? activeScrapes.get(scraperTabId) : null;
    if (s) doneScrape(scraperTabId, s);
    return false;
  }

  if (msg.action === 'START_NICHES_SCRAPE') {
    nichesTab(msg, respond, senderTabId);
    return true;
  }

  if (msg.action === 'NICHES_CAPTURED') {
    const s = scraperTabId ? activeNichesScrapes.get(scraperTabId) : null;
    if (s && msg.niches) {
      const tags = new Set(s.niches.map(n => n.tag));
      msg.niches.forEach(n => {
        if (n?.tag && !tags.has(n.tag)) { tags.add(n.tag); s.niches.push(n); }
      });
    }
    return false;
  }

  if (msg.action === 'SCRAPE_NICHES_COMPLETE') {
    const s = scraperTabId ? activeNichesScrapes.get(scraperTabId) : null;
    if (s) doneNiches(scraperTabId, s);
    return false;
  }

  if (msg.action === 'RESET_TOKEN') {
    respond({ success: true });
    return false;
  }
});

// ── URL builder ───────────────────────────────────────────────────────────

function buildScrapeUrl(query, isNiche) {
  if (!query)      return 'https://www.redgifs.com/';
  if (isNiche)     return 'https://www.redgifs.com/niches/' + encodeURIComponent(query.toLowerCase());
  return 'https://www.redgifs.com/gifs/search?search_text=' + encodeURIComponent(query) + '&order=trending';
}

// ── Video scrape ──────────────────────────────────────────────────────────

function scrapeTab(msg, respond, returnTabId) {
  const { query = '', page = 1, isNiche = false, excludeIds = [] } = msg;

  chrome.tabs.create({ url: buildScrapeUrl(query, isNiche), active: false }, tab => {
    if (chrome.runtime.lastError || !tab) {
      respond({ success: false, error: 'Tab konnte nicht geöffnet werden.' });
      return;
    }

    // Immediately refocus the extension tab so mobile users aren't interrupted
    if (returnTabId) {
      chrome.tabs.update(returnTabId, { active: true }, () => {
        const err = chrome.runtime.lastError;
      });
    }

    activeScrapes.set(tab.id, {
      config: { query, page, isNiche, excludeIds },
      videos: [],
      respond,
      tabId: tab.id,
      timer: setTimeout(() => {
        const s = activeScrapes.get(tab.id);
        if (s) doneScrape(tab.id, s);
      }, 35000)
    });
  });
}

function doneScrape(tabId, s) {
  activeScrapes.delete(tabId);
  clearTimeout(s.timer);
  chrome.tabs.remove(tabId, () => {
    const err = chrome.runtime.lastError;
  });
  const ex = new Set(s.config.excludeIds);
  s.respond({ success: true, videos: s.videos.filter(v => !ex.has(v.id)) });
}

// ── Niches catalog ────────────────────────────────────────────────────────

function nichesTab(msg, respond, returnTabId) {
  const page = msg.page || 1;

  chrome.tabs.create({ url: 'https://www.redgifs.com/niches', active: false }, tab => {
    if (chrome.runtime.lastError || !tab) {
      respond({ success: false, error: 'Tab konnte nicht geöffnet werden.' });
      return;
    }

    if (returnTabId) {
      chrome.tabs.update(returnTabId, { active: true }, () => {
        const err = chrome.runtime.lastError;
      });
    }

    activeNichesScrapes.set(tab.id, {
      config: { page },
      niches: [],
      respond,
      tabId: tab.id,
      timer: setTimeout(() => {
        const s = activeNichesScrapes.get(tab.id);
        if (s) doneNiches(tab.id, s);
      }, 30000)
    });
  });
}

function doneNiches(tabId, s) {
  activeNichesScrapes.delete(tabId);
  clearTimeout(s.timer);
  chrome.tabs.remove(tabId, () => {
    const err = chrome.runtime.lastError;
  });
  s.respond({ success: true, niches: s.niches });
}
