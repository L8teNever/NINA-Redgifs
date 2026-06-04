// Content Script for redgifs.l8tenever.com/Nina/
console.log("RedStream l8tenever content script loaded");

// Safely wrap or polyfill chrome extension APIs to prevent errors in non-extension, restricted, or invalidated contexts
(function() {
  const originalChrome = typeof window !== 'undefined' ? window.chrome : null;
  const originalRuntime = originalChrome ? originalChrome.runtime : null;
  const originalStorage = originalChrome ? originalChrome.storage : null;
  const originalLocal = originalStorage ? originalStorage.local : null;
  const originalOnChanged = originalStorage ? originalStorage.onChanged : null;

  // Setup safe runtime
  const safeRuntime = {
    sendMessage: function(message, callback) {
      try {
        if (originalRuntime && originalRuntime.sendMessage) {
          originalRuntime.sendMessage(message, (response) => {
            if (originalRuntime.lastError) {
              console.warn("[RedStream Polyfill] chrome.runtime.sendMessage lastError:", originalRuntime.lastError.message);
              if (callback) callback({ success: false, error: originalRuntime.lastError.message });
            } else if (callback) {
              callback(response);
            }
          });
          return;
        }
      } catch (e) {
        console.warn("[RedStream Polyfill] chrome.runtime.sendMessage failed, using fallback:", e.message);
      }
      if (callback) {
        setTimeout(() => callback({ success: false, error: "Extension context unavailable" }), 0);
      }
    },
    getURL: function(path) {
      try {
        if (originalRuntime && originalRuntime.getURL) {
          return originalRuntime.getURL(path);
        }
      } catch (e) {}
      return path;
    },
    get lastError() {
      try {
        return originalRuntime ? originalRuntime.lastError : null;
      } catch (e) {
        return null;
      }
    }
  };

  // LocalStorage Fallback helper functions
  function fallbackGet(keys, callback) {
    const res = {};
    const keyList = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys || {}));
    keyList.forEach(key => {
      try {
        const val = localStorage.getItem('redstream_' + key);
        if (val !== null) {
          res[key] = JSON.parse(val);
        } else if (keys && typeof keys === 'object' && !Array.isArray(keys)) {
          res[key] = keys[key];
        }
      } catch (e) {
        console.error("[RedStream Polyfill] Error loading key " + key + " from localStorage:", e);
      }
    });
    if (callback) {
      setTimeout(() => callback(res), 0);
    }
  }

  function fallbackSet(items, callback) {
    for (const key in items) {
      try {
        localStorage.setItem('redstream_' + key, JSON.stringify(items[key]));
      } catch (e) {
        console.error("[RedStream Polyfill] Error saving key " + key + " to localStorage:", e);
      }
    }
    if (callback) {
      setTimeout(() => callback(), 0);
    }
  }

  function fallbackRemove(keys, callback) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    keyList.forEach(key => {
      try {
        localStorage.removeItem('redstream_' + key);
      } catch (e) {
        console.error("[RedStream Polyfill] Error removing key " + key + " from localStorage:", e);
      }
    });
    if (callback) {
      setTimeout(() => callback(), 0);
    }
  }

  const mockListeners = [];

  const safeStorageLocal = {
    get: function(keys, callback) {
      try {
        if (originalLocal && originalLocal.get) {
          originalLocal.get(keys, (res) => {
            if (originalRuntime && originalRuntime.lastError) {
              console.warn("[RedStream Polyfill] chrome.storage.local.get lastError:", originalRuntime.lastError.message);
              fallbackGet(keys, callback);
            } else if (callback) {
              callback(res);
            }
          });
          return;
        }
      } catch (e) {
        console.warn("[RedStream Polyfill] chrome.storage.local.get failed, using fallback:", e.message);
      }
      fallbackGet(keys, callback);
    },
    set: function(items, callback) {
      try {
        if (originalLocal && originalLocal.set) {
          originalLocal.set(items, () => {
            if (originalRuntime && originalRuntime.lastError) {
              console.warn("[RedStream Polyfill] chrome.storage.local.set lastError:", originalRuntime.lastError.message);
              fallbackSet(items, callback);
            } else {
              triggerOnChangedListeners(items);
              if (callback) callback();
            }
          });
          return;
        }
      } catch (e) {
        console.warn("[RedStream Polyfill] chrome.storage.local.set failed, using fallback:", e.message);
      }
      fallbackSet(items, callback);
      triggerOnChangedListeners(items);
    },
    remove: function(keys, callback) {
      try {
        if (originalLocal && originalLocal.remove) {
          originalLocal.remove(keys, () => {
            if (originalRuntime && originalRuntime.lastError) {
              console.warn("[RedStream Polyfill] chrome.storage.local.remove lastError:", originalRuntime.lastError.message);
              fallbackRemove(keys, callback);
            } else if (callback) {
              callback();
            }
          });
          return;
        }
      } catch (e) {
        console.warn("[RedStream Polyfill] chrome.storage.local.remove failed, using fallback:", e.message);
      }
      fallbackRemove(keys, callback);
    }
  };

  function triggerOnChangedListeners(items) {
    const changes = {};
    for (const key in items) {
      changes[key] = { newValue: items[key] };
    }
    mockListeners.forEach(listener => {
      try { listener(changes); } catch (e) { console.error(e); }
    });
  }

  const safeStorage = {
    local: safeStorageLocal,
    onChanged: {
      addListener: function(listener) {
        try {
          if (originalOnChanged && originalOnChanged.addListener) {
            originalOnChanged.addListener(listener);
          }
        } catch (e) {
          console.warn("[RedStream Polyfill] chrome.storage.onChanged.addListener failed:", e.message);
        }
        mockListeners.push(listener);
      },
      removeListener: function(listener) {
        try {
          if (originalOnChanged && originalOnChanged.removeListener) {
            originalOnChanged.removeListener(listener);
          }
        } catch (e) {
          console.warn("[RedStream Polyfill] chrome.storage.onChanged.removeListener failed:", e.message);
        }
        const idx = mockListeners.indexOf(listener);
        if (idx !== -1) mockListeners.splice(idx, 1);
      }
    }
  };

  // Reconstruct window.chrome safely
  if (originalChrome) {
    try {
      Object.defineProperty(originalChrome, 'runtime', {
        value: { ...(originalChrome.runtime || {}), ...safeRuntime },
        writable: true,
        configurable: true
      });
      Object.defineProperty(originalChrome, 'storage', {
        value: { ...(originalChrome.storage || {}), ...safeStorage },
        writable: true,
        configurable: true
      });
    } catch (e) {
      try {
        const mergedChrome = {
          ...originalChrome,
          runtime: { ...(originalChrome.runtime || {}), ...safeRuntime },
          storage: { ...(originalChrome.storage || {}), ...safeStorage, local: safeStorageLocal }
        };
        window.chrome = mergedChrome;
      } catch (err) {
        console.error("[RedStream Polyfill] Failed to write to window.chrome:", err);
      }
    }
  } else {
    try {
      window.chrome = {
        runtime: safeRuntime,
        storage: safeStorage
      };
    } catch (err) {
      console.error("[RedStream Polyfill] Failed to create window.chrome:", err);
    }
  }
})();

// Inject the main world optimization script
try {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('l8tenever_main_world.js');
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => {
    script.remove();
  };
} catch (e) {
  console.error("Failed to inject l8tenever_main_world.js:", e);
}

// State
let hasUserInteracted = false;
function handleUserInteraction() {
  if (hasUserInteracted) return;
  hasUserInteracted = true;
  console.log("[RedStream] User interaction detected, enabling sound unmuting.");
  
  document.removeEventListener('click', handleUserInteraction, { capture: true });
  document.removeEventListener('touchstart', handleUserInteraction, { capture: true });
  document.removeEventListener('keydown', handleUserInteraction, { capture: true });
  
  // Trigger updateUI on all active cards
  const cards = document.querySelectorAll('.video-card');
  cards.forEach(card => {
    const video = card.querySelector('video');
    if (video && card.dataset.overlaysInitialized) {
      video.dispatchEvent(new CustomEvent('user-interacted'));
    }
  });
}
document.addEventListener('click', handleUserInteraction, { capture: true, passive: true });
document.addEventListener('touchstart', handleUserInteraction, { capture: true, passive: true });
document.addEventListener('keydown', handleUserInteraction, { capture: true, passive: true });

let isScraping = false;
let streamPage = 1;
let scrapedVideos = []; // Accumulates scraped video metadata objects
let activeVideoUrls = []; // Accumulates posted direct MP4 URLs
let seenVideos = {};
let settings = { quality: 'sd', muteDefault: true };
let niches = [];
let streamNiches = [];
let catalogNiches = [];

const DEFAULT_NICHES = [
  { tag: "gaming", label: "🎮 Gaming" },
  { tag: "funny", label: "😂 Funny" },
  { tag: "cosplay", label: "🎭 Cosplay" },
  { tag: "anime", label: "🌸 Anime" },
  { tag: "dance", label: "💃 Dance" },
  { tag: "cute", label: "🐱 Cute" },
  { tag: "fail", label: "⚠️ Fail" }
];

// Visual Debug Console Elements
let debugPanel = null;
let debugContent = null;

function createDebugUI() {
  // Create container
  debugPanel = document.createElement('div');
  debugPanel.id = 'redstream-debug-panel';
  debugPanel.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 24px;
    width: 320px;
    max-height: 250px;
    background: rgba(17, 17, 21, 0.95);
    border: 1px solid rgba(255, 42, 95, 0.3);
    border-radius: 12px;
    box-shadow: 0 0 20px rgba(255, 42, 95, 0.2);
    color: #e4e4e7;
    font-family: monospace;
    font-size: 11px;
    z-index: 999999;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    background: linear-gradient(135deg, #ff2a5f, #ff7a00);
    padding: 6px 12px;
    font-weight: bold;
    font-size: 10px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
  `;
  header.innerHTML = '<span>RedStream Debug</span><span id="redstream-debug-toggle">[Minimize]</span>';
  debugPanel.appendChild(header);

  // Content
  debugContent = document.createElement('div');
  debugContent.style.cssText = `
    padding: 8px 12px;
    overflow-y: auto;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  `;
  debugPanel.appendChild(debugContent);

  document.body.appendChild(debugPanel);

  // Toggle Collapse
  let isCollapsed = false;
  
  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    if (isCollapsed) {
      // Collapse to a tiny circular button
      debugContent.style.display = 'none';
      header.style.display = 'none';
      
      debugPanel.style.width = '36px';
      debugPanel.style.height = '36px';
      debugPanel.style.borderRadius = '50%';
      debugPanel.style.background = 'linear-gradient(135deg, #ff2a5f, #ff7a00)';
      debugPanel.style.cursor = 'pointer';
      debugPanel.style.display = 'flex';
      debugPanel.style.alignItems = 'center';
      debugPanel.style.justifyContent = 'center';
      debugPanel.title = 'Klicken zum Maximieren';
      debugPanel.innerHTML = '<span style="font-size: 16px; user-select: none;">🐞</span>';
    } else {
      // Expand back to full panel
      debugPanel.innerHTML = '';
      debugPanel.appendChild(header);
      debugPanel.appendChild(debugContent);
      
      debugContent.style.display = 'flex';
      header.style.display = 'flex';
      
      debugPanel.style.width = '320px';
      debugPanel.style.height = 'auto';
      debugPanel.style.borderRadius = '12px';
      debugPanel.style.background = 'rgba(17, 17, 21, 0.95)';
      debugPanel.style.cursor = '';
      debugPanel.title = '';
      
      // Auto scroll to bottom
      debugContent.scrollTop = debugContent.scrollHeight;
    }
  }

  header.onclick = (e) => {
    e.stopPropagation();
    toggleCollapse();
  };

  debugPanel.onclick = (e) => {
    if (isCollapsed) {
      e.stopPropagation();
      toggleCollapse();
    }
  };

  logDebug("Visual debug console initialized.");
}

function logDebug(message, type = 'info') {
  console.log(`[RedStream Debug] ${message}`);
  if (!debugContent) return;

  const line = document.createElement('div');
  let color = '#e4e4e7';
  if (type === 'error') color = '#ef4444';
  if (type === 'success') color = '#22c55e';
  if (type === 'warn') color = '#eab308';

  line.style.color = color;
  line.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
  line.style.paddingBottom = '2px';
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  
  debugContent.appendChild(line);
  debugContent.scrollTop = debugContent.scrollHeight;
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

async function init() {
  try {
    createDebugUI();
    logDebug("DOM loaded, loading state...");
    
    // Inject no-referrer policy to bypass hotlinking protections on RedGifs CDN
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    logDebug("Injected no-referrer meta tag.");

    // Inject custom CSS to disable the fade-in transition, hide shapes and style custom overlays
    const style = document.createElement('style');
    style.textContent = `
      #videoFeed .video-card, .video-card {
        width: 100% !important;
        height: 100% !important;
        max-width: 100vw !important;
        max-height: 100% !important;
        margin: 0 auto !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        position: relative !important;
      }
      #videoFeed .video-card video, .video-card video, .video-element {
        opacity: 1 !important;
        transition: none !important;
        width: auto !important;
        height: auto !important;
        max-width: 100% !important;
        max-height: 100% !important;
        aspect-ratio: var(--video-aspect, auto) !important;
        object-fit: contain !important;
        display: block !important;
        background: #000 !important;
        border-radius: 24px !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 0, 0, 0.6) !important;
      }
      .video-overlay-wrapper {
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: 100% !important;
        height: 100% !important;
        pointer-events: none !important;
        z-index: 99999 !important;
      }
      .has-aspect .video-overlay-wrapper {
        width: auto !important;
        height: auto !important;
        max-width: 100% !important;
        max-height: 100% !important;
        aspect-ratio: var(--video-aspect, auto) !important;
      }
      .video-overlay-wrapper > * {
        pointer-events: auto !important;
      }
      .shape-container {
        display: none !important;
      }
      .stream-seen-bar {
        position: absolute;
        top: 0;
        left: 0;
        height: 4px;
        background: #3b82f6;
        width: 0%;
        z-index: 50;
        pointer-events: none;
        opacity: 0;
        border-radius: 24px 24px 0 0;
      }
      .video-timeline-container {
        position: absolute;
        bottom: 12px;
        left: 16px;
        right: 16px;
        height: 24px;
        display: flex;
        align-items: center;
        z-index: 45;
        cursor: pointer;
      }
      .video-timeline-track {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.25);
        border-radius: 3px;
        position: relative;
        transition: height 0.15s ease, background-color 0.15s ease;
      }
      .video-timeline-container:hover .video-timeline-track,
      .video-timeline-container.scrubbing .video-timeline-track {
        height: 6px;
        background: rgba(255, 255, 255, 0.35);
      }
      .video-timeline-fill {
        height: 100%;
        background: #3b82f6;
        border-radius: 3px;
        width: 0%;
        box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);
      }
      .video-timeline-handle {
        position: absolute;
        top: 50%;
        left: 0%;
        transform: translate(-50%, -50%) scale(0);
        width: 12px;
        height: 12px;
        background: #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
        transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
      }
      .video-timeline-container:hover .video-timeline-handle,
      .video-timeline-container.scrubbing .video-timeline-handle {
        transform: translate(-50%, -50%) scale(1);
      }
      .stream-speed-badge {
        position: absolute;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(6px);
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: white;
        padding: 4px 14px;
        border-radius: 20px;
        font-family: sans-serif;
        font-size: 1.1rem;
        font-weight: 800;
        z-index: 45;
        pointer-events: none;
        display: none;
        letter-spacing: 0.5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      }
      .video-volume-control {
        position: absolute !important;
        top: 20px !important;
        left: 20px !important;
        right: auto !important;
        display: flex !important;
        align-items: center !important;
        background: rgba(15, 15, 20, 0.75) !important;
        backdrop-filter: blur(12px) !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        padding: 6px !important;
        border-radius: 30px !important;
        z-index: 50 !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1) !important;
        pointer-events: auto !important;
      }
      .video-volume-control:hover {
        background: rgba(20, 20, 25, 0.9) !important;
        border-color: rgba(255, 255, 255, 0.25) !important;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6), 0 0 15px rgba(255, 255, 255, 0.05) !important;
      }
      .video-volume-btn {
        background: none !important;
        border: none !important;
        color: #f4f4f5 !important;
        width: 32px !important;
        height: 32px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        border-radius: 50% !important;
        transition: all 0.2s ease !important;
      }
      .video-volume-btn:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        color: #ffffff !important;
        transform: scale(1.05) !important;
      }
      .video-volume-slider-wrapper {
        width: 0;
        overflow: hidden;
        display: flex;
        align-items: center;
        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s ease;
        padding: 0;
      }
      .video-volume-control:hover .video-volume-slider-wrapper {
        width: 90px;
        padding: 0 10px 0 6px;
      }
      .video-volume-slider {
        width: 90px;
        height: 4px;
        -webkit-appearance: none;
        appearance: none;
        background: rgba(255, 255, 255, 0.2) !important;
        border-radius: 2px;
        outline: none;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .video-volume-slider:hover {
        background: rgba(255, 255, 255, 0.3) !important;
      }
      .video-volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #ffffff !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
        transition: transform 0.15s ease;
      }
      .video-volume-slider::-webkit-slider-thumb:hover {
        transform: scale(1.2) !important;
      }
    `;
    document.head.appendChild(style);
    logDebug("Injected instant-video CSS override.");

    // Optimization script runs via manifest content script in world: MAIN to respect CSP
    logDebug("Main world preloader is running via manifest.json (MAIN world).");
    
    // Add event listener to capture video loading errors
    window.addEventListener('error', (e) => {
      if (e.target && e.target.tagName === 'VIDEO') {
        const errObj = e.target.error;
        const errMsg = errObj ? `Code ${errObj.code}; Message: ${errObj.message}` : 'Network error or blocked hotlinking';
        logDebug(`Video load failed for URL: ${e.target.src || e.target.currentSrc} (Reason: ${errMsg})`, 'error');
      }
    }, true);

    await loadStateFromStorage();
    createNicheSelectorUI();
    setupInfiniteScroll();
    setupSeenObserver();
    
    // Start scanning for card overlays
    setInterval(scanCardsForOverlays, 300);
    
    // Start initial scrape
    triggerScrape(false);
  } catch (err) {
    logDebug(`Error during initialization: ${err.message}`, 'error');
  }
}

// Load configurations from extension storage
async function loadStateFromStorage() {
  return new Promise(resolve => {
    try {
      chrome.storage.local.get([
        'redstream_settings',
        'redstream_niches',
        'redstream_stream_niches',
        'redstream_seen_videos',
        'redstream_catalog_niches'
      ], result => {
        if (chrome.runtime.lastError) {
          logDebug(`Storage load failed: ${chrome.runtime.lastError.message}`, 'error');
          resolve();
          return;
        }

        settings = result.redstream_settings || settings;
        niches = result.redstream_niches || DEFAULT_NICHES;
        streamNiches = result.redstream_stream_niches || niches.map(n => n.tag);
        seenVideos = result.redstream_seen_videos || {};
        catalogNiches = result.redstream_catalog_niches || [];
        
        logDebug(`Storage loaded successfully.`, 'success');
        logDebug(`Active niches: ${streamNiches.join(', ')}`);
        logDebug(`Seen videos database size: ${Object.keys(seenVideos).length}`);
        resolve();
      });
    } catch (e) {
      logDebug(`Storage API access exception: ${e.message}`, 'error');
      resolve();
    }
  });
}

// Main scrape coordinator
async function triggerScrape(isAppend = false) {
  if (isScraping) {
    logDebug("Scrape already in progress, skipping request.");
    return;
  }
  
  if (!streamNiches || streamNiches.length === 0) {
    logDebug("No active stream niches available to scrape. Please check settings.", 'warn');
    return;
  }
  
  isScraping = true;
  
  if (isAppend) {
    streamPage++;
    logDebug(`Scraping next page: ${streamPage}...`);
  } else {
    streamPage = 1;
    scrapedVideos = [];
    activeVideoUrls = [];
    logDebug("Starting fresh scrape (Page 1)...");
  }
  
  const excludeIds = [
    ...scrapedVideos.map(v => v.id),
    ...Object.keys(seenVideos)
  ];
  
  const results = [];
  const batchSize = 2;
  
  logDebug(`Processing ${streamNiches.length} niches in batches of ${batchSize}...`);
  
  for (let i = 0; i < streamNiches.length; i += batchSize) {
    const batch = streamNiches.slice(i, i + batchSize);
    logDebug(`Batch: [${batch.join(', ')}]`);
    
    try {
      const batchResults = await Promise.all(batch.map(tag => new Promise(resolve => {
        chrome.runtime.sendMessage({
          action: "START_SCRAPE",
          query: tag,
          page: streamPage,
          isNiche: true,
          excludeIds: excludeIds
        }, response => {
          if (chrome.runtime.lastError) {
            logDebug(`Message error for niche ${tag}: ${chrome.runtime.lastError.message}`, 'error');
            resolve([]);
            return;
          }
          
          if (response && response.success && response.videos) {
            logDebug(`Scraped ${response.videos.length} videos for niche: ${tag}`, 'success');
            resolve(response.videos);
          } else {
            const err = (response && response.error) ? response.error : 'Unknown background error';
            logDebug(`Background failed for ${tag}: ${err}`, 'warn');
            resolve([]);
          }
        });
      })));
      
      results.push(...batchResults);
    } catch (err) {
      logDebug(`Batch Promise.all failed: ${err.message}`, 'error');
    }
    
    if (i + batchSize < streamNiches.length) {
      await new Promise(r => setTimeout(r, 400));
    }
  }
  
  isScraping = false;
  
  // Interleave and de-duplicate results
  const newVideos = [];
  const existingIds = new Set([
    ...scrapedVideos.map(v => v.id),
    ...Object.keys(seenVideos)
  ]);
  
  const maxLen = Math.max(...results.map(r => r.length));
  for (let i = 0; i < maxLen; i++) {
    for (let j = 0; j < results.length; j++) {
      const video = results[j][i];
      if (video && video.id && !existingIds.has(video.id)) {
        existingIds.add(video.id);
        newVideos.push(video);
      }
    }
  }
  
  logDebug(`De-duplicated scrape results: ${newVideos.length} new video(s) found.`);
  
  if (newVideos.length > 0) {
    scrapedVideos.push(...newVideos);
    
    // Convert to target MP4 URLs
    const newUrls = newVideos.map(v => {
      return settings.quality === 'hd' ? (v.src || v.srcSd) : (v.srcSd || v.src);
    }).filter(url => !!url);
    
    activeVideoUrls.push(...newUrls);
    
    logDebug(`Posting ${activeVideoUrls.length} total URLs to page...`);
    
    // Post to page
    window.postMessage({
      type: 'LOAD_EXT_VIDEOS',
      urls: activeVideoUrls
    }, '*');
    
    setTimeout(reobserveCards, 1000);
  } else {
    logDebug("Scrape complete, but zero new videos found.", 'warn');
  }
}

// Setup Infinite Scrolling Scroll-Event Listener
function setupInfiniteScroll() {
  const feedContainer = document.getElementById('videoFeed');
  if (!feedContainer) {
    logDebug("Infinite scroll setup skipped: #videoFeed not found in DOM.", 'error');
    return;
  }
  
  feedContainer.addEventListener('scroll', () => {
    if (isScraping || activeVideoUrls.length === 0) return;
    
    const scrollBottom = feedContainer.scrollHeight - feedContainer.clientHeight - feedContainer.scrollTop;
    if (scrollBottom < feedContainer.clientHeight * 1.5) {
      logDebug("Scroll boundary reached, loading more...", 'info');
      triggerScrape(true);
    }
  });
  logDebug("Infinite scroll listener attached to #videoFeed.");
}

// Setup Seen tracking observer (Intersection Observer)
let seenTimers = new Map();
let cardObserver = null;

function setupSeenObserver() {
  const feedContainer = document.getElementById('videoFeed');
  if (!feedContainer) return;
  
  cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const indexStr = entry.target.getAttribute('data-index');
      const index = parseInt(indexStr);
      const video = scrapedVideos[index];
      
      if (!video || !video.id) return;
      
      const seenBar = entry.target.querySelector('.stream-seen-bar');
      
      if (entry.isIntersecting) {
        // Animate seen progress bar
        if (seenBar && !seenVideos[video.id]) {
          seenBar.style.transition = 'none';
          seenBar.style.width = '0%';
          seenBar.style.opacity = '1';
          seenBar.offsetHeight; // force reflow
          seenBar.style.transition = 'width 2s linear';
          seenBar.style.width = '100%';
        } else if (seenBar && seenVideos[video.id]) {
          seenBar.style.transition = 'none';
          seenBar.style.width = '100%';
          seenBar.style.opacity = '0.25';
        }

        if (!seenVideos[video.id] && !seenTimers.has(video.id)) {
          const timerId = setTimeout(() => {
            seenVideos[video.id] = true;
            seenTimers.delete(video.id);
            if (seenBar) {
              seenBar.style.transition = 'opacity 0.6s ease';
              seenBar.style.opacity = '0.25';
            }
            
            // Persist seen state
            chrome.storage.local.get(['redstream_seen_videos'], (res) => {
              const currentSeen = res.redstream_seen_videos || {};
              currentSeen[video.id] = true;
              chrome.storage.local.set({ redstream_seen_videos: currentSeen }, () => {
                logDebug(`Video ${video.id} marked as seen in Chrome storage.`, 'success');
              });
            });
          }, 2000);
          
          seenTimers.set(video.id, timerId);
        }
      } else {
        if (seenTimers.has(video.id)) {
          clearTimeout(seenTimers.get(video.id));
          seenTimers.delete(video.id);
        }
        if (seenBar && !seenVideos[video.id]) {
          seenBar.style.transition = 'none';
          seenBar.style.width = '0%';
          seenBar.style.opacity = '0';
        }
      }
    });
  }, { root: feedContainer, threshold: 0.6 });
  logDebug("Seen IntersectionObserver configured.");
}

function reobserveCards() {
  if (!cardObserver) return;
  scanCardsForOverlays();
  const cards = document.querySelectorAll('.video-card');
  cards.forEach(card => cardObserver.observe(card));
  logDebug(`Observing ${cards.length} cards in observer.`, 'info');
}

function createNicheSelectorUI() {
  const controls = document.getElementById('systemControls');
  const appContainer = document.getElementById('appContainer');
  if (!controls || !appContainer) {
    logDebug("Could not find systemControls or appContainer to inject Niche Selector UI.", "error");
    return;
  }

  // 1. Create Niche Selector Button in the controls bar
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'redstream-niche-toggle-btn';
  toggleBtn.className = 'w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center hover:bg-black/75 active:scale-90 transition duration-150 shadow-lg mt-2 pointer-events-auto';
  toggleBtn.title = 'Nischen auswählen';
  toggleBtn.innerHTML = '<span class="material-icons-round text-white text-2xl">tune</span>';
  controls.appendChild(toggleBtn);

  // 2. Create the Niche Checklist Panel
  const panel = document.createElement('div');
  panel.id = 'redstream-niche-panel';
  panel.className = 'hidden absolute top-36 right-6 w-64 bg-zinc-950/95 border border-zinc-800 text-white rounded-2xl shadow-2xl p-4 z-50 backdrop-blur-md flex flex-col pointer-events-auto';
  
  // Header
  const panelHeader = document.createElement('div');
  panelHeader.className = 'flex justify-between items-center mb-2';
  panelHeader.innerHTML = `
    <h3 class="font-bold text-sm tracking-wide text-zinc-200">Nischen-Auswahl</h3>
    <button id="redstream-niche-close" class="text-zinc-400 hover:text-white transition flex items-center justify-center">
      <span class="material-icons-round text-lg">close</span>
    </button>
  `;
  panel.appendChild(panelHeader);

  // Description
  const panelDesc = document.createElement('p');
  panelDesc.className = 'text-[10px] text-zinc-500 mb-3';
  panelDesc.textContent = 'Wähle aus, aus welchen Nischen Videos geladen werden sollen.';
  panel.appendChild(panelDesc);

  // List of Checkboxes
  const listContainer = document.createElement('div');
  listContainer.id = 'redstream-niche-checkboxes';
  listContainer.className = 'flex flex-col gap-2 max-h-48 overflow-y-auto mb-3 pr-1';
  panel.appendChild(listContainer);

  // Divider
  const divider = document.createElement('div');
  divider.className = 'border-t border-zinc-800 my-2';
  panel.appendChild(divider);

  // Add Niche Title
  const addTitle = document.createElement('h4');
  addTitle.className = 'font-bold text-[9px] uppercase tracking-wider text-zinc-400 mb-1.5';
  addTitle.textContent = 'Nische hinzufügen';
  panel.appendChild(addTitle);

  // Add Niche Form Container
  const addForm = document.createElement('div');
  addForm.className = 'flex gap-2 mb-2.5';
  addForm.innerHTML = `
    <input type="text" id="redstream-new-niche-input" placeholder="z.B. cosplay oder memes" class="flex-grow bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1 text-[11px] text-white outline-none focus:border-purple-600">
    <button id="redstream-add-niche-btn" class="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1 rounded-xl text-xs transition active:scale-95 flex items-center justify-center">+</button>
  `;
  panel.appendChild(addForm);

  // Reset Seen Button
  const resetBtn = document.createElement('button');
  resetBtn.id = 'redstream-reset-seen';
  resetBtn.className = 'w-full border border-red-500/20 hover:border-red-500/50 bg-red-950/10 hover:bg-red-950/30 text-red-400 text-[10px] font-bold py-1.5 rounded-xl transition active:scale-95 mb-3';
  resetBtn.textContent = 'Gesehen-Verlauf zurücksetzen';
  panel.appendChild(resetBtn);

  // Apply / Apply & Reload Button
  const applyBtn = document.createElement('button');
  applyBtn.id = 'redstream-niche-apply';
  applyBtn.className = 'w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold py-2 rounded-xl transition active:scale-95 shadow-md';
  applyBtn.textContent = 'Übernehmen & Neu laden';
  panel.appendChild(applyBtn);

  appContainer.appendChild(panel);

  // Populate Checkboxes function
  function populateCheckboxes() {
    listContainer.innerHTML = '';
    niches.forEach(niche => {
      const isChecked = streamNiches.includes(niche.tag);
      const label = document.createElement('label');
      label.className = 'flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-900 transition text-xs';
      label.innerHTML = `
        <span class="text-zinc-300 font-medium">${niche.label}</span>
        <input type="checkbox" value="${niche.tag}" ${isChecked ? 'checked' : ''} class="w-4 h-4 rounded text-purple-600 bg-zinc-950 border-zinc-800 focus:ring-purple-600 focus:ring-offset-zinc-950">
      `;
      listContainer.appendChild(label);
    });
  }

  populateCheckboxes();

  // Wire up Open/Close Logic
  let panelOpen = false;

  function updateControlsLock() {
    if (panelOpen) {
      controls.style.opacity = '1';
      controls.style.transform = 'translateY(0)';
      controls.style.pointerEvents = 'auto';
    } else {
      controls.style.opacity = '';
      controls.style.transform = '';
      controls.style.pointerEvents = '';
    }
  }

  toggleBtn.onclick = (e) => {
    e.stopPropagation();
    panelOpen = !panelOpen;
    if (panelOpen) {
      populateCheckboxes();
      panel.classList.remove('hidden');
      logDebug("Niche selection panel opened.");
    } else {
      panel.classList.add('hidden');
    }
    updateControlsLock();
  };

  const closeBtn = panel.querySelector('#redstream-niche-close');
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    panelOpen = false;
    panel.classList.add('hidden');
    updateControlsLock();
  };

  // Suggestions Dropdown Panel
  const suggestionsBox = document.createElement('div');
  suggestionsBox.id = 'redstream-search-suggestions';
  suggestionsBox.className = 'hidden flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl max-h-32 overflow-y-auto mb-2 text-[11px] text-zinc-300 divide-y divide-zinc-800/50';
  // Insert suggestions below the addForm
  panel.insertBefore(suggestionsBox, resetBtn);

  // Wire up Add Niche action
  const addNicheBtn = addForm.querySelector('#redstream-add-niche-btn');
  const addNicheInput = addForm.querySelector('#redstream-new-niche-input');

  // Trigger background catalog fetch when search input is focused
  addNicheInput.onfocus = () => {
    if (catalogNiches.length === 0) {
      logDebug("Nischen-Katalog ist leer. Starte Hintergrund-Laden...");
      chrome.runtime.sendMessage({
        action: "START_NICHES_SCRAPE",
        page: 1
      }, (response) => {
        if (chrome.runtime.lastError) {
          logDebug("Katalog konnte nicht im Hintergrund geladen werden: " + chrome.runtime.lastError.message, "warn");
          return;
        }
        if (response && response.success && response.niches) {
          catalogNiches = response.niches;
          chrome.storage.local.set({ redstream_catalog_niches: catalogNiches });
          logDebug(`${catalogNiches.length} Nischen aus Katalog geladen.`, "success");
        }
      });
    }
  };

  // Autocomplete search suggestions handler
  addNicheInput.oninput = () => {
    const val = addNicheInput.value.trim().toLowerCase();
    if (!val) {
      suggestionsBox.classList.add('hidden');
      return;
    }

    // Filter catalog for matches, excluding niches that are already active
    const matches = catalogNiches.filter(n => 
      n.label.toLowerCase().includes(val) || 
      n.tag.toLowerCase().includes(val)
    ).filter(n => !niches.some(activeN => activeN.tag === n.tag));

    if (matches.length === 0) {
      suggestionsBox.classList.add('hidden');
      return;
    }

    suggestionsBox.innerHTML = '';
    suggestionsBox.classList.remove('hidden');

    // Show top 5 matches
    matches.slice(0, 5).forEach(n => {
      const row = document.createElement('button');
      row.className = 'w-full text-left px-3 py-1.5 hover:bg-zinc-800 hover:text-white transition flex items-center justify-between pointer-events-auto';
      row.innerHTML = `
        <span>${n.label}</span>
        <span class="text-[9px] text-zinc-500 font-mono">#${n.tag}</span>
      `;
      row.onclick = (e) => {
        e.stopPropagation();
        
        // Add niche
        niches.push(n);
        streamNiches.push(n.tag);
        
        logDebug(`Nische "${n.label}" aus Katalog hinzugefügt.`);
        
        // Save
        chrome.storage.local.set({
          redstream_niches: niches,
          redstream_stream_niches: streamNiches
        });

        addNicheInput.value = '';
        suggestionsBox.classList.add('hidden');
        populateCheckboxes();
      };
      suggestionsBox.appendChild(row);
    });
  };

  // Close suggestions when clicking elsewhere on the page
  document.addEventListener('click', () => {
    suggestionsBox.classList.add('hidden');
  });
  
  addNicheInput.onclick = (e) => e.stopPropagation();

  async function handleAddNiche() {
    const text = addNicheInput.value.trim();
    if (!text) return;

    // Filter emojis and kebab-case
    let cleanTag = text.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
                       .trim()
                       .toLowerCase()
                       .replace(/[^a-z0-9\s-]/g, '')
                       .replace(/\s+/g, '-');

    if (!cleanTag) {
      alert("Ungültiger Nischenname (muss Zahlen oder Buchstaben enthalten).");
      return;
    }

    let label = text;
    if (text.toLowerCase() === cleanTag) {
      label = text.charAt(0).toUpperCase() + text.slice(1);
    }

    if (niches.some(n => n.tag === cleanTag)) {
      alert("Diese Nische existiert bereits!");
      return;
    }

    // Add to active niches
    niches.push({ tag: cleanTag, label: label });
    // Automatically enable it in the stream
    streamNiches.push(cleanTag);

    logDebug(`Adding new niche: ${label} (tag: ${cleanTag})`);

    // Sync to storage
    chrome.storage.local.set({
      redstream_niches: niches,
      redstream_stream_niches: streamNiches
    }, () => {
      logDebug(`Niche "${label}" successfully saved and enabled!`, "success");
    });

    addNicheInput.value = '';
    populateCheckboxes();
  }

  addNicheBtn.onclick = (e) => {
    e.stopPropagation();
    handleAddNiche();
  };

  addNicheInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      handleAddNiche();
    }
  };

  // Wire up Reset Seen action
  resetBtn.onclick = (e) => {
    e.stopPropagation();
    if (confirm("Möchtest du den Gesehen-Verlauf wirklich zurücksetzen? Bisher gesehene Videos werden im Feed wieder vorgeschlagen.")) {
      seenVideos = {};
      chrome.storage.local.set({ redstream_seen_videos: {} }, () => {
        logDebug("Gesehen-Verlauf wurde zurückgesetzt.", "success");
        alert("Gesehen-Verlauf zurückgesetzt! Der Feed wird neu geladen.");
        
        // Close panel and trigger scrape
        panelOpen = false;
        panel.classList.add('hidden');
        updateControlsLock();
        triggerScrape(false);
      });
    }
  };

  // Wire up Apply/Save Selection
  applyBtn.onclick = async (e) => {
    e.stopPropagation();
    
    // Get all checked tags
    const checkedTags = [];
    const checkInputs = listContainer.querySelectorAll('input[type="checkbox"]');
    checkInputs.forEach(input => {
      if (input.checked) {
        checkedTags.push(input.value);
      }
    });

    if (checkedTags.length === 0) {
      alert("Bitte wähle mindestens eine Nische aus!");
      return;
    }

    logDebug(`Saving stream niches: ${checkedTags.join(', ')}`);
    streamNiches = checkedTags;

    // Save in storage
    chrome.storage.local.set({ redstream_stream_niches: streamNiches }, () => {
      logDebug("Niches selection successfully saved to extension storage.", "success");
    });

    // Close panel
    panelOpen = false;
    panel.classList.add('hidden');
    updateControlsLock();

    // Trigger fresh scrape
    triggerScrape(false);
  };

  logDebug("Niche Selector controls injected successfully.", "success");
}

// Scrubbing Helper for video timeline
function setupScrubbing(timelineContainer, video) {
  let isScrubbing = false;

  function updateVideoTime(e) {
    const track = timelineContainer.querySelector('.video-timeline-track');
    const rect = track.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pos = (clientX - rect.left) / rect.width;
    const percentage = Math.max(0, Math.min(1, pos));
    if (video.duration) {
      video.currentTime = percentage * video.duration;
    }
  }

  timelineContainer.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left click
    isScrubbing = true;
    timelineContainer.classList.add('scrubbing');
    updateVideoTime(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (isScrubbing) {
      updateVideoTime(e);
    }
  });

  window.addEventListener('mouseup', () => {
    if (isScrubbing) {
      isScrubbing = false;
      timelineContainer.classList.remove('scrubbing');
    }
  });

  // Touch support for mobile scrubbing
  timelineContainer.addEventListener('touchstart', (e) => {
    isScrubbing = true;
    timelineContainer.classList.add('scrubbing');
    updateVideoTime(e);
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (isScrubbing) {
      updateVideoTime(e);
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (isScrubbing) {
      isScrubbing = false;
      timelineContainer.classList.remove('scrubbing');
    }
  });
}

// Volume Control Helper (volume slider and mute toggle)
function setupVolumeControl(card, video) {
  const container = card.querySelector('.video-overlay-wrapper') || card;
  let volumeControl = container.querySelector('.video-volume-control');
  if (volumeControl) return;

  volumeControl = document.createElement('div');
  volumeControl.className = 'video-volume-control';
  volumeControl.innerHTML = `
    <button class="video-volume-btn">
      <svg class="vol-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <!-- Will be dynamically updated -->
      </svg>
    </button>
    <div class="video-volume-slider-wrapper">
      <input type="range" class="video-volume-slider" min="0" max="1" step="0.05" value="1">
    </div>
  `;

  container.appendChild(volumeControl);

  const volBtn = volumeControl.querySelector('.video-volume-btn');
  const volIcon = volumeControl.querySelector('.vol-icon');
  const volSlider = volumeControl.querySelector('.video-volume-slider');

  const volUpSvg = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
  const volMuteSvg = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;

  let currentVolume = 1.0;
  let isMuted = true;

  function updateUI() {
    volSlider.value = currentVolume;
    video.volume = currentVolume;

    const canUnmute = hasUserInteracted || (typeof navigator !== 'undefined' && navigator.userActivation && navigator.userActivation.hasBeenActive);
    video.muted = !canUnmute || isMuted;

    if (video.muted || currentVolume === 0) {
      volIcon.innerHTML = volMuteSvg;
    } else {
      volIcon.innerHTML = volUpSvg;
    }
  }

  // Load from storage
  chrome.storage.local.get(['redstream_volume', 'redstream_muted'], (res) => {
    if (res.redstream_volume !== undefined) currentVolume = res.redstream_volume;
    if (res.redstream_muted !== undefined) isMuted = res.redstream_muted;
    updateUI();
  });

  // Sync across playing slides
  const storageListener = (changes) => {
    if (changes.redstream_volume) {
      currentVolume = changes.redstream_volume.newValue;
      updateUI();
    }
    if (changes.redstream_muted) {
      isMuted = changes.redstream_muted.newValue;
      updateUI();
    }
  };
  chrome.storage.onChanged.addListener(storageListener);
  video.addEventListener('user-interacted', updateUI);

  // Clean up listener when card/video is removed (prevent memory leak)
  video.addEventListener('remove', () => {
    chrome.storage.onChanged.removeListener(storageListener);
    video.removeEventListener('user-interacted', updateUI);
  }, { once: true });

  // Slider input
  volSlider.addEventListener('input', (e) => {
    e.stopPropagation();
    currentVolume = parseFloat(volSlider.value);
    isMuted = (currentVolume === 0);
    
    chrome.storage.local.set({
      redstream_volume: currentVolume,
      redstream_muted: isMuted
    });
    
    updateUI();
  });

  // Button click
  volBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isMuted = !isMuted;
    if (!isMuted && currentVolume === 0) {
      currentVolume = 0.5;
    }
    
    chrome.storage.local.set({
      redstream_volume: currentVolume,
      redstream_muted: isMuted
    });
    
    updateUI();
  });
}

// Sync wrapper pixel dimensions to video bounds
function syncWrapperSize(card, video) {
  const wrapper = card.querySelector('.video-overlay-wrapper');
  if (!wrapper) return;
  const w = video.offsetWidth || video.clientWidth;
  const h = video.offsetHeight || video.clientHeight;
  if (w && h) {
    wrapper.style.setProperty('width', w + 'px', 'important');
    wrapper.style.setProperty('height', h + 'px', 'important');
  }
}

// Card overlay initializer
function initializeCardDOM(card, video) {
  let overlayWrapper = card.querySelector('.video-overlay-wrapper');
  if (!overlayWrapper) {
    overlayWrapper = document.createElement('div');
    overlayWrapper.className = 'video-overlay-wrapper';
    card.appendChild(overlayWrapper);
  }

  // 1. Seen progress bar at the top
  let seenBar = overlayWrapper.querySelector('.stream-seen-bar');
  if (!seenBar) {
    seenBar = document.createElement('div');
    seenBar.className = 'stream-seen-bar';
    overlayWrapper.appendChild(seenBar);
  }

  // 2. Speed badge for holding indicator
  let speedBadge = overlayWrapper.querySelector('.stream-speed-badge');
  if (!speedBadge) {
    speedBadge = document.createElement('div');
    speedBadge.className = 'stream-speed-badge';
    speedBadge.innerText = '2×';
    overlayWrapper.appendChild(speedBadge);
  }

  // Setup volume slider overlay
  setupVolumeControl(card, video);

  // 3. Timeline container & fill
  let timelineContainer = overlayWrapper.querySelector('.video-timeline-container');
  if (!timelineContainer) {
    timelineContainer = document.createElement('div');
    timelineContainer.className = 'video-timeline-container';
    
    const timelineTrack = document.createElement('div');
    timelineTrack.className = 'video-timeline-track';
    
    const timelineFill = document.createElement('div');
    timelineFill.className = 'video-timeline-fill';
    
    const timelineHandle = document.createElement('div');
    timelineHandle.className = 'video-timeline-handle';
    
    timelineTrack.appendChild(timelineFill);
    timelineTrack.appendChild(timelineHandle);
    timelineContainer.appendChild(timelineTrack);
    overlayWrapper.appendChild(timelineContainer);

    video.addEventListener('timeupdate', () => {
      if (video.duration) {
        const pct = (video.currentTime / video.duration) * 100;
        timelineFill.style.width = pct + '%';
        timelineHandle.style.left = pct + '%';
      }
    });

    setupScrubbing(timelineContainer, video);
  }

  // 4. Hold gesture for 2x playback speed
  let holdTimer = null;
  let isHolding = false;
  let isHoldingTriggered = false;
  let touchStartX = 0;
  let touchStartY = 0;
  const touchThreshold = 10;

  function startHold() {
    holdTimer = setTimeout(() => {
      isHolding = true;
      const currentVideo = card.querySelector('video');
      if (currentVideo) {
        currentVideo.playbackRate = 2.0;
      }
      speedBadge.style.display = 'block';
    }, 200);
  }

  function endHold() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (isHolding) {
      isHolding = false;
      const currentVideo = card.querySelector('video');
      if (currentVideo) {
        currentVideo.playbackRate = 1.0;
      }
      speedBadge.style.display = 'none';
      isHoldingTriggered = true;
    }
  }

  function cancelHold() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (isHolding) {
      isHolding = false;
      const currentVideo = card.querySelector('video');
      if (currentVideo) {
        currentVideo.playbackRate = 1.0;
      }
      speedBadge.style.display = 'none';
    }
  }

  // Mouse hold events
  card.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left click
    if (e.target.closest('.video-volume-control') || e.target.closest('.video-timeline-container') || e.target.closest('#redstream-niche-panel') || e.target.closest('#redstream-niche-toggle-btn')) {
      return;
    }
    startHold();
  });

  card.addEventListener('mouseup', () => {
    endHold();
  });

  card.addEventListener('mouseleave', () => {
    cancelHold();
  });

  // Touch hold events
  card.addEventListener('touchstart', (e) => {
    if (e.target.closest('.video-volume-control') || e.target.closest('.video-timeline-container') || e.target.closest('#redstream-niche-panel') || e.target.closest('#redstream-niche-toggle-btn')) {
      return;
    }
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    startHold();
  }, { passive: true });

  card.addEventListener('touchmove', (e) => {
    if (holdTimer) {
      const touch = e.touches[0];
      const diffX = Math.abs(touch.clientX - touchStartX);
      const diffY = Math.abs(touch.clientY - touchStartY);
      if (diffX > touchThreshold || diffY > touchThreshold) {
        cancelHold();
      }
    }
  }, { passive: true });

  card.addEventListener('touchend', () => {
    endHold();
  });

  card.addEventListener('touchcancel', () => {
    cancelHold();
  });

  // Intercept click events in the capturing phase to prevent native play/pause toggle when holding release
  card.addEventListener('click', (e) => {
    if (isHoldingTriggered) {
      e.stopPropagation();
      e.preventDefault();
      isHoldingTriggered = false;
    }
  }, true);

  // 5. Dynamic Aspect Ratio wrapper
  function updateAspect() {
    if (video.videoWidth && video.videoHeight) {
      card.style.setProperty('--video-aspect', `${video.videoWidth} / ${video.videoHeight}`);
      card.classList.add('has-aspect');
      syncWrapperSize(card, video);
    }
  }
  video.addEventListener('loadedmetadata', updateAspect);
  video.addEventListener('playing', () => syncWrapperSize(card, video));
  window.addEventListener('resize', () => syncWrapperSize(card, video));
  if (video.readyState >= 1) {
    updateAspect();
  }
}

// Scanner loop to identify and initialize newly loaded cards
function scanCardsForOverlays() {
  const cards = document.querySelectorAll('.video-card');
  cards.forEach(card => {
    const video = card.querySelector('video');
    if (!video) return;
    if (!card.dataset.overlaysInitialized) {
      card.dataset.overlaysInitialized = 'true';
      initializeCardDOM(card, video);
    }
    // Always sync wrapper size to handle dynamic changes
    syncWrapperSize(card, video);
  });
}
