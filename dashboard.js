// RedStream Dashboard Controller

// Global App State
const state = {
  activeTab: 'explore',
  videos: [],
  bookmarks: {},
  settings: {
    quality: 'sd',
    autoplayHover: true,
    muteDefault: true
  },
  currentQuery: '',
  currentQueryIsNiche: false,
  isScraping: false,
  currentPage: 1,
  nicheMode: 'single',
  niches: [],
  catalogNiches: [],
  catalogPage: 1,
  
  // Stream Tab state
  seenVideos: {},
  streamVideos: [],
  streamNiches: [],
  streamPage: 1,
  isStreamScraping: false
};

// DOM Elements
const elements = {
  navButtons: document.querySelectorAll('.nav-btn'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  searchInput: document.getElementById('search-input'),
  clearSearchBtn: document.getElementById('clear-search'),
  fetchBtn: document.getElementById('fetch-btn'),
  videoGrid: document.getElementById('video-grid'),
  exploreEmpty: document.getElementById('explore-empty'),
  statusContainer: document.getElementById('status-container'),
  statusText: document.getElementById('status-text'),
  steps: {
    tab: document.getElementById('step-tab'),
    load: document.getElementById('step-load'),
    scrape: document.getElementById('step-scrape'),
    close: document.getElementById('step-close')
  },
  tagPills: document.querySelectorAll('.tag-pill'),
  tagsScroll: document.querySelector('.tags-scroll'),
  
  // Bookmarks
  bookmarksGrid: document.getElementById('bookmarks-grid'),
  bookmarksEmpty: document.getElementById('bookmarks-empty'),
  bookmarkSearchInput: document.getElementById('bookmark-search-input'),
  
  // Settings
  qualityPref: document.getElementById('quality-pref'),
  autoplayHoverCheck: document.getElementById('autoplay-hover'),
  muteDefaultCheck: document.getElementById('mute-default'),
  clearBookmarksBtn: document.getElementById('clear-bookmarks-btn'),
  clearSeenBtn: document.getElementById('clear-seen-btn'),
  resetTokenBtn: document.getElementById('reset-token-btn'),
  
  // Infinite Scroll Indicator
  loadMoreIndicator: document.getElementById('load-more-indicator'),
  
  // Niche Mode Selector
  modeSingleBtn: document.getElementById('mode-single'),
  modeMultiBtn: document.getElementById('mode-multi'),
  fetchMultiBtn: document.getElementById('fetch-multi-btn'),
  
  // Niche Manager Elements
  tagsScroll: document.getElementById('tags-scroll'),
  settingsNicheList: document.getElementById('settings-niche-list'),
  newNicheInput: document.getElementById('new-niche-input'),
  addNicheBtn: document.getElementById('add-niche-btn'),
  settingsCatalogList: document.getElementById('settings-catalog-list'),
  loadCatalogNewBtn: document.getElementById('load-catalog-new-btn'),
  loadCatalogMoreBtn: document.getElementById('load-catalog-more-btn'),
  
  // Stream Tab Elements
  streamNichesList: document.getElementById('stream-niches-list'),
  streamReloadBtn: document.getElementById('stream-reload-btn'),
  streamContainer: document.getElementById('stream-container'),
  streamEmpty: document.getElementById('stream-empty'),
  streamLoader: document.getElementById('stream-loader'),
  
  // Cinema Modal
  cinemaModal: document.getElementById('cinema-modal'),
  cinemaVideo: document.getElementById('cinema-video'),
  cinemaLoader: document.querySelector('.cinema-loader'),
  cinemaTitle: document.getElementById('cinema-title'),
  cinemaUsername: document.getElementById('cinema-username'),
  cinemaViews: document.getElementById('cinema-views'),
  cinemaLikes: document.getElementById('cinema-likes'),
  cinemaTags: document.getElementById('cinema-tags'),
  cinemaOriginalLink: document.getElementById('cinema-original-link'),
  cinemaDownload: document.getElementById('cinema-download'),
  modalCloseBtn: document.querySelector('.modal-close'),
  
  // Cinema Controls
  playPauseBtn: document.querySelector('.play-pause-btn'),
  playIcon: document.querySelector('.play-icon'),
  pauseIcon: document.querySelector('.pause-icon'),
  muteBtn: document.querySelector('.mute-btn'),
  volOnIcon: document.querySelector('.vol-on-icon'),
  volOffIcon: document.querySelector('.vol-off-icon'),
  volumeSlider: document.querySelector('.volume-slider'),
  progressContainer: document.querySelector('.progress-bar-container'),
  progressFill: document.querySelector('.progress-bar-fill'),
  progressBuffer: document.querySelector('.progress-bar-buffer'),
  progressSlider: document.querySelector('.progress-slider'),
  timeDisplay: document.querySelector('.time-display'),
  bookmarkToggleBtn: document.querySelector('.bookmark-toggle-btn'),
  fullscreenBtn: document.querySelector('.fullscreen-btn')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  console.log("RedStream dashboard initializing...");
  await loadBookmarks();
  await loadSeenVideos();
  await loadNiches();
  loadSettings();
  setupEventListeners();

  // Render dynamic niche lists
  renderTagPills();
  renderSettingsNicheList();

  // Handle navigation back from stream page (tag click or nav button)
  const hash = window.location.hash.replace('#', '');
  if (hash === 'bookmarks' || hash === 'settings') {
    switchTab(hash);
  }

  const urlParams = new URLSearchParams(window.location.search);
  const startQuery = urlParams.get('q');
  if (startQuery) {
    elements.searchInput.value = startQuery;
    elements.clearSearchBtn.classList.remove('hide');
    triggerScrape(startQuery, false, true);
  } else {
    triggerScrape("");
  }
});

// Load Settings from LocalStorage
function loadSettings() {
  const savedSettings = localStorage.getItem('redstream_settings');
  if (savedSettings) {
    try {
      state.settings = { ...state.settings, ...JSON.parse(savedSettings) };
    } catch (e) {
      console.error("Error parsing settings:", e);
    }
  }
  // Sync to chrome.storage.local to make it accessible to content scripts on other domains
  chrome.storage.local.set({ redstream_settings: state.settings });
  
  // Update UI Elements
  elements.qualityPref.value = state.settings.quality;
  elements.autoplayHoverCheck.checked = state.settings.autoplayHover;
  elements.muteDefaultCheck.checked = state.settings.muteDefault;
}

// Save Settings to LocalStorage
function saveSettings() {
  localStorage.setItem('redstream_settings', JSON.stringify(state.settings));
  chrome.storage.local.set({ redstream_settings: state.settings });
}

// Load Bookmarks from chrome.storage
async function loadBookmarks() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['redstream_bookmarks'], (result) => {
      state.bookmarks = result.redstream_bookmarks || {};
      console.log(`Loaded ${Object.keys(state.bookmarks).length} bookmarks`);
      resolve();
    });
  });
}

// Save Bookmarks to chrome.storage
async function saveBookmarks() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ redstream_bookmarks: state.bookmarks }, () => {
      console.log("Bookmarks saved");
      resolve();
    });
  });
}

// Setup Event Listeners
function setupEventListeners() {
  // Tab Switching
  elements.navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // Search Input Actions
  elements.searchInput.addEventListener('input', () => {
    if (elements.searchInput.value.trim().length > 0) {
      elements.clearSearchBtn.classList.remove('hide');
    } else {
      elements.clearSearchBtn.classList.add('hide');
    }
  });

  elements.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = elements.searchInput.value.trim();
      deactivateTagPills();
      const isNiche = state.niches.some(n => n.tag.toLowerCase() === query.toLowerCase());
      triggerScrape(query, false, isNiche);
    }
  });

  elements.clearSearchBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.clearSearchBtn.classList.add('hide');
    elements.searchInput.focus();
  });

  elements.fetchBtn.addEventListener('click', () => {
    const query = elements.searchInput.value.trim();
    deactivateTagPills();
    const isNiche = state.niches.some(n => n.tag.toLowerCase() === query.toLowerCase());
    triggerScrape(query, false, isNiche);
  });

  // Tag Pill Clicks (Event Delegation on tagsScroll for dynamic tags)
  elements.tagsScroll.addEventListener('click', (e) => {
    const pill = e.target.closest('.tag-pill');
    if (!pill || state.isScraping) return;

    const tag = pill.getAttribute('data-tag');

    if (state.nicheMode === 'single') {
      document.querySelectorAll('#tags-scroll .tag-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      elements.searchInput.value = tag;
      if (tag) {
        elements.clearSearchBtn.classList.remove('hide');
      } else {
        elements.clearSearchBtn.classList.add('hide');
      }

      triggerScrape(tag, false, tag !== '');
    } else {
      // Multi-selection mode: toggle selection
      if (tag === '') {
        // "Beliebt" clears and deactivates other tags
        document.querySelectorAll('#tags-scroll .tag-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
      } else {
        // Deselect "Beliebt" first
        const popularPill = document.querySelector('#tags-scroll .tag-pill[data-tag=""]');
        if (popularPill) popularPill.classList.remove('active');

        pill.classList.toggle('active');

        // If no tag is selected now, fallback to "Beliebt"
        const activePills = Array.from(document.querySelectorAll('#tags-scroll .tag-pill.active'));
        if (activePills.length === 0 && popularPill) {
          popularPill.classList.add('active');
        }
      }

      // Update search bar text with active tags list for user feedback
      const activeTags = Array.from(document.querySelectorAll('#tags-scroll .tag-pill.active'))
        .filter(p => p.getAttribute('data-tag') !== '')
        .map(p => p.getAttribute('data-tag'));

      elements.searchInput.value = activeTags.join(', ');
      if (activeTags.length > 0) {
        elements.clearSearchBtn.classList.remove('hide');
      } else {
        elements.clearSearchBtn.classList.add('hide');
      }
    }
  });

  // Niche Mode Selection Toggling
  elements.modeSingleBtn.addEventListener('click', () => {
    if (state.isScraping) return;
    state.nicheMode = 'single';
    elements.modeSingleBtn.classList.add('active');
    elements.modeMultiBtn.classList.remove('active');
    elements.fetchMultiBtn.classList.add('hide');
    
    // Reset to default tag (Popular) and fetch it
    document.querySelectorAll('#tags-scroll .tag-pill').forEach(p => p.classList.remove('active'));
    const popularPill = document.querySelector('#tags-scroll .tag-pill[data-tag=""]');
    if (popularPill) popularPill.classList.add('active');
    
    elements.searchInput.value = '';
    elements.clearSearchBtn.classList.add('hide');
    triggerScrape('');
  });

  elements.modeMultiBtn.addEventListener('click', () => {
    if (state.isScraping) return;
    state.nicheMode = 'multi';
    elements.modeSingleBtn.classList.remove('active');
    elements.modeMultiBtn.classList.add('active');
    elements.fetchMultiBtn.classList.remove('hide');
    
    // Switch tag pill selection but do not auto-fetch
    document.querySelectorAll('#tags-scroll .tag-pill').forEach(p => p.classList.remove('active'));
    const popularPill = document.querySelector('#tags-scroll .tag-pill[data-tag=""]');
    if (popularPill) popularPill.classList.add('active');
    
    elements.searchInput.value = '';
    elements.clearSearchBtn.classList.add('hide');
  });

  // Fetch Multi-Niches Action
  elements.fetchMultiBtn.addEventListener('click', () => {
    const activeTags = Array.from(document.querySelectorAll('#tags-scroll .tag-pill.active'))
      .map(p => p.getAttribute('data-tag'));
    
    triggerScrape(activeTags);
  });

  // Add Custom Niche Action Listeners
  elements.addNicheBtn.addEventListener('click', () => {
    addNiche(elements.newNicheInput.value);
  });

  elements.newNicheInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addNiche(elements.newNicheInput.value);
    }
  });

  // Load Catalog Niche List Action (New / Fresh)
  elements.loadCatalogNewBtn.addEventListener('click', () => {
    fetchNiches(false);
  });

  // Load Catalog Niche List Action (More / Append)
  elements.loadCatalogMoreBtn.addEventListener('click', () => {
    fetchNiches(true);
  });

  // Bookmark Search
  elements.bookmarkSearchInput.addEventListener('input', () => {
    renderBookmarksGrid(elements.bookmarkSearchInput.value.trim());
  });

  // Settings Controls
  elements.qualityPref.addEventListener('change', (e) => {
    state.settings.quality = e.target.value;
    saveSettings();
    // Re-render explore and bookmarks with new quality preference
    renderExploreGrid();
    renderBookmarksGrid();
  });

  elements.autoplayHoverCheck.addEventListener('change', (e) => {
    state.settings.autoplayHover = e.target.checked;
    saveSettings();
  });

  elements.muteDefaultCheck.addEventListener('change', (e) => {
    state.settings.muteDefault = e.target.checked;
    saveSettings();
  });

  elements.clearBookmarksBtn.addEventListener('click', async () => {
    if (confirm("Möchtest du wirklich alle Lesezeichen löschen?")) {
      state.bookmarks = {};
      await saveBookmarks();
      renderBookmarksGrid();
      renderExploreGrid();
      showToast("✓ Alle Bookmarks gelöscht.");
    }
  });

  elements.clearSeenBtn.addEventListener('click', async () => {
    state.seenVideos = {};
    await new Promise(resolve => chrome.storage.local.remove('redstream_seen_videos', resolve));
    showToast("✓ Gesehen-Verlauf wurde zurückgesetzt.");
  });

  // Reset API Token
  elements.resetTokenBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "RESET_TOKEN" }, () => {
      showToast("Token zurückgesetzt — wird beim nächsten Abrufen neu geladen.");
    });
  });

  // Modal Close
  elements.modalCloseBtn.addEventListener('click', closeCinemaModal);
  elements.cinemaModal.querySelector('.modal-backdrop').addEventListener('click', closeCinemaModal);

  // Keyboard controls for modal
  document.addEventListener('keydown', (e) => {
    if (elements.cinemaModal.classList.contains('hide')) return;
    
    if (e.key === 'Escape') {
      closeCinemaModal();
    } else if (e.key === ' ') {
      // Spacebar plays/pauses
      e.preventDefault();
      toggleCinemaPlay();
    }
  });

  // Infinite Scroll on Window Scroll
  window.addEventListener('scroll', () => {
    if (state.activeTab !== 'explore' || state.isScraping || state.videos.length === 0) return;
    
    // Check if user has scrolled near the bottom (200px tolerance)
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200) {
      console.log("Bottom of page reached. Triggering infinite scroll...");
      triggerScrape(state.currentQuery, true);
    }
  });

  // Stream Tab Reload Button (guard: element lives on stream.html, not dashboard.html)
  if (elements.streamReloadBtn) {
    elements.streamReloadBtn.addEventListener('click', () => { triggerStreamScrape(false); });
  }

  // Stream Scroll/Pagination Listener
  if (elements.streamContainer) {
    elements.streamContainer.addEventListener('scroll', () => {
      if (state.isStreamScraping || state.streamVideos.length === 0) return;
      const container = elements.streamContainer;
      const scrollBottom = container.scrollHeight - container.clientHeight - container.scrollTop;
      if (scrollBottom < container.clientHeight * 1.5) {
        triggerStreamScrape(true);
      }
    });
  }
}

// Switch Tab Panels
function switchTab(tabName) {
  if (tabName === 'stream') { window.location.href = 'stream.html'; return; }
  state.activeTab = tabName;
  
  // Navigation tabs active state
  elements.navButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Content panels visibility
  elements.tabPanels.forEach(panel => {
    if (panel.id === `tab-${tabName}`) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });

  if (tabName === 'bookmarks') {
    elements.bookmarkSearchInput.value = '';
    renderBookmarksGrid();
  }

  if (tabName === 'stream') {
    renderStreamNicheChecklist();
    if (state.streamVideos.length === 0) {
      triggerStreamScrape(false);
    } else {
      playFirstStreamVideo();
    }
  } else {
    // Switch away from stream: pause all stream videos
    document.querySelectorAll('.stream-slide video').forEach(v => v.pause());
  }
}

// Deactivate Tag Pills
function deactivateTagPills() {
  elements.tagPills.forEach(p => p.classList.remove('active'));
}

// Scrape Initiation
function triggerScrape(query, isAppend = false, isNiche = null) {
  if (state.isScraping) return;
  
  // Handle Multi-Niche Scrape Array
  if (Array.isArray(query)) {
    triggerMultiScrape(query, isAppend);
    return;
  }
  
  state.isScraping = true;
  
  let queryIsNiche = false;
  if (isAppend) {
    state.currentPage++;
    elements.loadMoreIndicator.classList.remove('hide');
    queryIsNiche = state.currentQueryIsNiche;
    console.log(`Infinite scroll triggered. Requesting page ${state.currentPage} for "${query}" (Niche: ${queryIsNiche})`);
  } else {
    state.currentPage = 1;
    state.currentQuery = query;
    if (isNiche !== null) {
      queryIsNiche = isNiche;
    } else if (query) {
      queryIsNiche = state.niches.some(n => n.tag.toLowerCase() === query.toLowerCase());
    }
    state.currentQueryIsNiche = queryIsNiche;
    elements.videoGrid.innerHTML = '';
    elements.exploreEmpty.classList.add('hide');
    showStatusBox(query);
  }
  
  // Send message to background service worker
  chrome.runtime.sendMessage({
    action: "START_SCRAPE",
    query: query,
    page: state.currentPage,
    isNiche: queryIsNiche,
    excludeIds: state.videos.map(v => v.id)
  }, (response) => {
    state.isScraping = false;
    
    if (chrome.runtime.lastError) {
      console.error("Scraper communication error:", chrome.runtime.lastError);
      hideStatusBox();
      elements.loadMoreIndicator.classList.add('hide');
      showScraperError("Konnte die Erweiterung nicht kontaktieren. Bitte lade das Addon neu.");
      return;
    }
    
    if (response && response.success) {
      if (isAppend) {
        elements.loadMoreIndicator.classList.add('hide');
        const newVideos = response.videos || [];
        const existingIds = new Set(state.videos.map(v => v.id));
        let addedCount = 0;
        
        newVideos.forEach(video => {
          if (video && video.id && !existingIds.has(video.id)) {
            state.videos.push(video);
            existingIds.add(video.id);
            const card = createVideoCard(video);
            elements.videoGrid.appendChild(card);
            addedCount++;
          }
        });
        
        console.log(`Appended ${addedCount} new videos from page ${state.currentPage}. Total: ${state.videos.length}`);
        if (addedCount === 0) {
          showToast("Keine weiteren neuen Videos gefunden.");
        }
      } else {
        updateStatusStep('close', 'done');
        state.videos = response.videos || [];
        console.log("Scraped videos:", state.videos);
        
        setTimeout(() => {
          hideStatusBox();
          renderExploreGrid();
        }, 300);
      }
    } else {
      hideStatusBox();
      elements.loadMoreIndicator.classList.add('hide');
      const errMsg = (response && response.error) ? response.error : "Fehler beim Abrufen der Videos.";
      if (!isAppend) {
        showScraperError(errMsg);
      } else {
        showToast("Keine weiteren Videos gefunden.");
      }
    }
  });
}

// Scrape Multiple Niches in Parallel
async function triggerMultiScrape(tags, isAppend = false) {
  state.isScraping = true;
  
  // Fallback to single scrape if only "Popular" (empty tag) is active
  if (tags.length === 1 && tags[0] === '') {
    state.isScraping = false;
    triggerScrape('', isAppend);
    return;
  }

  // Filter out any default tags if specific niches are selected
  const cleanTags = tags.filter(t => t !== '');
  if (cleanTags.length === 0) {
    state.isScraping = false;
    triggerScrape('', isAppend);
    return;
  }

  state.currentQuery = cleanTags; // Store array as active query
  
  if (isAppend) {
    state.currentPage++;
    elements.loadMoreIndicator.classList.remove('hide');
    console.log(`Infinite scroll triggered. Requesting page ${state.currentPage} for ${cleanTags.length} niches:`, cleanTags);
  } else {
    state.currentPage = 1;
    elements.videoGrid.innerHTML = '';
    elements.exploreEmpty.classList.add('hide');
    
    elements.statusContainer.classList.remove('hide');
    elements.statusText.textContent = `Sammle Videos aus ${cleanTags.length} Nischen...`;
    elements.steps.tab.className = 'step active';
    elements.steps.load.className = 'step';
    elements.steps.scrape.className = 'step';
    elements.steps.close.className = 'step';

    // Simulate active loader checkpoints
    setTimeout(() => updateStatusStep('tab', 'done'), 300);
    setTimeout(() => updateStatusStep('load', 'active'), 400);
  }

  // Fire parallel background scraping tasks
  const scrapePromises = cleanTags.map(tag => {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({
        action: "START_SCRAPE",
        query: tag,
        page: state.currentPage,
        isNiche: true,
        excludeIds: state.videos.map(v => v.id)
      }, response => {
        if (response && response.success && response.videos) {
          resolve(response.videos);
        } else {
          resolve([]);
        }
      });
    });
  });

  const results = await Promise.all(scrapePromises);
  state.isScraping = false;

  // Interleave the results from different categories for a diverse stream
  const newVideos = [];
  const existingIds = new Set(isAppend ? state.videos.map(v => v.id) : []);
  const maxLen = Math.max(...results.map(r => r.length));

  for (let i = 0; i < maxLen; i++) {
    for (let j = 0; j < results.length; j++) {
      const video = results[j][i];
      if (video && video.id && !existingIds.has(video.id)) {
        existingIds.add(video.id);
        newVideos.push(video);
        if (isAppend) {
          state.videos.push(video);
        }
      }
    }
  }

  if (isAppend) {
    elements.loadMoreIndicator.classList.add('hide');
    newVideos.forEach(video => {
      const card = createVideoCard(video);
      elements.videoGrid.appendChild(card);
    });
    
    console.log(`Appended ${newVideos.length} new videos in multi-niche scroll. Total: ${state.videos.length}`);
    if (newVideos.length === 0) {
      showToast("Keine weiteren neuen Videos gefunden.");
    }
  } else {
    updateStatusStep('load', 'done');
    updateStatusStep('scrape', 'active');
    setTimeout(() => updateStatusStep('scrape', 'done'), 800);

    state.videos = newVideos;
    console.log(`Merged ${newVideos.length} interleaved videos from niches:`, cleanTags);

    if (newVideos.length > 0) {
      updateStatusStep('close', 'done');
      setTimeout(() => {
        hideStatusBox();
        renderExploreGrid();
      }, 300);
    } else {
      hideStatusBox();
      showScraperError("Keine Videos in den ausgewählten Nischen gefunden.");
    }
  }
}

// Loader/Status Box Helpers
function showStatusBox(query) {
  elements.statusContainer.classList.remove('hide');
  elements.statusText.textContent = `Sammle Videos für "${query || 'Beliebt'}"...`;
  
  // Set default steps
  elements.steps.tab.className = 'step active';
  elements.steps.load.className = 'step';
  elements.steps.scrape.className = 'step';
  elements.steps.close.className = 'step';
  
  // Simulate active progress checkpoints
  setTimeout(() => updateStatusStep('tab', 'done'), 300);
  setTimeout(() => updateStatusStep('load', 'active'), 400);
  setTimeout(() => updateStatusStep('load', 'done'), 800);
  setTimeout(() => updateStatusStep('scrape', 'active'), 900);
}

function updateStatusStep(stepName, status) {
  const el = elements.steps[stepName];
  if (!el) return;
  
  if (status === 'active') {
    el.className = 'step active';
  } else if (status === 'done') {
    el.className = 'step done';
    // set next step to active
    if (stepName === 'tab') updateStatusStep('load', 'active');
    if (stepName === 'load') updateStatusStep('scrape', 'active');
    if (stepName === 'scrape') updateStatusStep('close', 'active');
  }
}

function hideStatusBox() {
  elements.statusContainer.classList.add('hide');
}

function showScraperError(message) {
  elements.exploreEmpty.classList.remove('hide');
  elements.exploreEmpty.querySelector('h3').textContent = "Fehler aufgetreten";
  elements.exploreEmpty.querySelector('p').textContent = message;
}

// Render Video Grid for Explore Tab
function renderExploreGrid() {
  elements.videoGrid.innerHTML = '';
  
  if (state.videos.length === 0) {
    elements.exploreEmpty.classList.remove('hide');
    elements.exploreEmpty.querySelector('h3').textContent = "Keine Videos gefunden";
    elements.exploreEmpty.querySelector('p').textContent = "Es konnten keine Videos von RedGifs ausgelesen werden. Bitte versuche ein anderes Tag.";
    return;
  }
  
  elements.exploreEmpty.classList.add('hide');
  state.videos.forEach(video => {
    const card = createVideoCard(video);
    elements.videoGrid.appendChild(card);
  });
}

// Render Video Grid for Bookmarks Tab
function renderBookmarksGrid(filterQuery = '') {
  elements.bookmarksGrid.innerHTML = '';
  
  let bookmarkList = Object.values(state.bookmarks);
  
  if (filterQuery) {
    const queryLower = filterQuery.toLowerCase();
    bookmarkList = bookmarkList.filter(video => 
      video.title.toLowerCase().includes(queryLower) || 
      (video.userName && video.userName.toLowerCase().includes(queryLower)) ||
      (video.tags && video.tags.some(t => t.toLowerCase().includes(queryLower)))
    );
  }
  
  if (bookmarkList.length === 0) {
    elements.bookmarksEmpty.classList.remove('hide');
    if (filterQuery) {
      elements.bookmarksEmpty.querySelector('h3').textContent = "Keine passenden Lesezeichen";
      elements.bookmarksEmpty.querySelector('p').textContent = "Es wurden keine Lesezeichen gefunden, die deiner Suche entsprechen.";
    } else {
      elements.bookmarksEmpty.querySelector('h3').textContent = "Deine Sammlung ist leer";
      elements.bookmarksEmpty.querySelector('p').textContent = "Markiere Videos in der Suche mit dem Herz-Symbol, um sie hier zu speichern.";
    }
    return;
  }
  
  elements.bookmarksEmpty.classList.add('hide');
  bookmarkList.forEach(video => {
    const card = createVideoCard(video, true);
    elements.bookmarksGrid.appendChild(card);
  });
}

// Create Card DOM Element
function createVideoCard(video, isBookmarkTab = false) {
  const card = document.createElement('div');
  card.className = 'video-card';
  card.setAttribute('data-id', video.id);
  
  const isBookmarked = !!state.bookmarks[video.id];
  const videoSrc = state.settings.quality === 'hd' ? video.src : video.srcSd;
  
  // Custom video tags rendering
  let tagsHtml = '';
  if (video.tags && video.tags.length > 0) {
    // Show top 3 tags
    video.tags.slice(0, 3).forEach(tag => {
      tagsHtml += `<span class="card-tag" data-tag="${tag}">#${tag}</span>`;
    });
  }

  // Large counts formatting
  const viewCount = video.views ? formatCount(video.views) : '0';
  const likeCount = video.likes ? formatCount(video.likes) : '0';
  
  card.innerHTML = `
    <div class="card-media">
      <video loop playsinline muted poster="${video.poster}">
        <source src="${videoSrc}" type="video/mp4">
      </video>
      <div class="card-overlay-top">
        <span class="overlay-badge">${viewCount} Aufrufe</span>
        <button class="card-heart-btn ${isBookmarked ? 'bookmarked' : ''}" title="${isBookmarked ? 'Lesezeichen entfernen' : 'Lesezeichen speichern'}">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="heart-svg"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </button>
      </div>
      <div class="card-overlay-bottom">
        <div class="card-actions-row">
          <button class="card-action-btn share-btn" title="Link kopieren">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
          </button>
          <a href="${video.src}" class="card-action-btn download-direct-btn" download title="Herunterladen" target="_blank">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          </a>
        </div>
      </div>
    </div>
    <div class="card-details">
      <h3>${video.title || 'RedGifs Video'}</h3>
      <div class="card-meta">
        <span class="card-author">@${video.userName || 'anonymous'}</span>
        <span>❤️ ${likeCount}</span>
      </div>
      <div class="card-tags">
        ${tagsHtml}
      </div>
    </div>
  `;

  // Media Playback events
  const videoEl = card.querySelector('video');
  const mediaContainer = card.querySelector('.card-media');

  mediaContainer.addEventListener('mouseenter', () => {
    if (state.settings.autoplayHover) {
      videoEl.play().catch(err => console.log("Hover play failed:", err));
    }
    videoEl.playbackRate = 2.0;
  });

  mediaContainer.addEventListener('mouseleave', () => {
    videoEl.pause();
    videoEl.currentTime = 0;
    videoEl.playbackRate = 1.0;
  });

  // Open Cinema Mode on card media click
  mediaContainer.addEventListener('click', (e) => {
    // Avoid opening modal if clicking sub-buttons
    if (e.target.closest('.card-heart-btn') || e.target.closest('.card-action-btn')) {
      return;
    }
    openCinemaModal(video);
  });

  // Heart Button Action
  const heartBtn = card.querySelector('.card-heart-btn');
  heartBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isNowBookmarked = toggleBookmark(video);
    
    if (isNowBookmarked) {
      heartBtn.classList.add('bookmarked');
      heartBtn.title = 'Lesezeichen entfernen';
    } else {
      heartBtn.classList.remove('bookmarked');
      heartBtn.title = 'Lesezeichen speichern';
      
      // If we are currently in Bookmarks tab, remove the card from UI immediately
      if (isBookmarkTab) {
        card.style.opacity = 0;
        card.style.transform = 'scale(0.8)';
        setTimeout(() => {
          card.remove();
          // Check if grid is now empty
          if (elements.bookmarksGrid.children.length === 0) {
            elements.bookmarksEmpty.classList.remove('hide');
          }
        }, 200);
      }
    }
  });

  // Share Button Action
  card.querySelector('.share-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    copyToClipboard(video.watchUrl, "Link kopiert!");
  });

  // Tags Clicks
  card.querySelectorAll('.card-tag').forEach(tagEl => {
    tagEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const tagText = tagEl.getAttribute('data-tag');
      
      // Navigate to explore tab, select tag and query
      switchTab('explore');
      elements.searchInput.value = tagText;
      elements.clearSearchBtn.classList.remove('hide');
      
      // Sync tag pill highlights
      document.querySelectorAll('#tags-scroll .tag-pill').forEach(p => {
        if (p.getAttribute('data-tag') === tagText) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });
      
      const isNiche = state.niches.some(n => n.tag.toLowerCase() === tagText.toLowerCase());
      triggerScrape(tagText, false, isNiche);
    });
  });

  return card;
}

// Toggle Bookmark storage
function toggleBookmark(video) {
  const isBookmarked = !!state.bookmarks[video.id];
  if (isBookmarked) {
    delete state.bookmarks[video.id];
    saveBookmarks();
    return false;
  } else {
    state.bookmarks[video.id] = video;
    saveBookmarks();
    return true;
  }
}

// Number formatting (e.g. 15400 -> 15.4K)
function formatCount(num) {
  if (!num) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

// Cinema Player Modal Operations
let activeCinemaVideoObj = null;

function openCinemaModal(video) {
  activeCinemaVideoObj = video;
  elements.cinemaModal.classList.remove('hide');
  elements.cinemaLoader.classList.remove('hide');
  
  // Set meta details
  elements.cinemaTitle.textContent = video.title || 'RedGifs Video';
  elements.cinemaUsername.textContent = video.userName || 'anonymous';
  elements.cinemaViews.textContent = video.views ? video.views.toLocaleString() : '0';
  elements.cinemaLikes.textContent = video.likes ? video.likes.toLocaleString() : '0';
  elements.cinemaOriginalLink.href = video.watchUrl;
  elements.cinemaDownload.href = video.src;
  
  // Tags
  elements.cinemaTags.innerHTML = '';
  if (video.tags && video.tags.length > 0) {
    video.tags.forEach(tag => {
      const pill = document.createElement('span');
      pill.className = 'cinema-tag';
      pill.textContent = `#${tag}`;
      pill.addEventListener('click', () => {
        closeCinemaModal();
        switchTab('explore');
        elements.searchInput.value = tag;
        elements.clearSearchBtn.classList.remove('hide');
        const isNiche = state.niches.some(n => n.tag.toLowerCase() === tag.toLowerCase());
        triggerScrape(tag, false, isNiche);
      });
      elements.cinemaTags.appendChild(pill);
    });
  }

  // Bookmark active state
  const isBookmarked = !!state.bookmarks[video.id];
  if (isBookmarked) {
    elements.bookmarkToggleBtn.classList.add('bookmarked');
    elements.bookmarkToggleBtn.title = 'Aus Lesezeichen entfernen';
  } else {
    elements.bookmarkToggleBtn.classList.remove('bookmarked');
    elements.bookmarkToggleBtn.title = 'In Lesezeichen speichern';
  }

  // Load Source
  const videoSrc = state.settings.quality === 'hd' ? video.src : video.srcSd;
  elements.cinemaVideo.src = videoSrc;
  
  // Muted default sync
  elements.cinemaVideo.muted = state.settings.muteDefault;
  if (state.settings.muteDefault) {
    elements.volOnIcon.classList.add('hide');
    elements.volOffIcon.classList.remove('hide');
    elements.volumeSlider.value = 0;
  } else {
    elements.volOnIcon.classList.remove('hide');
    elements.volOffIcon.classList.add('hide');
    elements.volumeSlider.value = elements.cinemaVideo.volume;
  }
  
  // Reset Progress Fill
  elements.progressFill.style.width = '0%';
  elements.progressSlider.value = 0;
  
  // Listeners for video element
  elements.cinemaVideo.oncanplay = () => {
    elements.cinemaLoader.classList.add('hide');
    elements.cinemaVideo.play().catch(e => console.log("Cinema auto-play blocked:", e));
    updateCinemaPlayIcon(true);
  };

  elements.cinemaVideo.ontimeupdate = updateCinemaProgress;
  elements.cinemaVideo.onprogress = updateCinemaBuffer;
  elements.cinemaVideo.onended = () => {
    updateCinemaPlayIcon(false);
  };
  
  // Setup control listeners
  setupCinemaControls();
}

function closeCinemaModal() {
  elements.cinemaVideo.pause();
  elements.cinemaVideo.src = '';
  elements.cinemaModal.classList.add('hide');
  activeCinemaVideoObj = null;
  
  // Refresh grids to sync heart states
  renderExploreGrid();
  if (state.activeTab === 'bookmarks') {
    renderBookmarksGrid();
  }
}

function setupCinemaControls() {
  // Play/Pause button
  elements.playPauseBtn.onclick = toggleCinemaPlay;
  elements.cinemaVideo.onclick = toggleCinemaPlay;

  // Mute button
  elements.muteBtn.onclick = () => {
    const isMuted = !elements.cinemaVideo.muted;
    elements.cinemaVideo.muted = isMuted;
    
    if (isMuted) {
      elements.volOnIcon.classList.add('hide');
      elements.volOffIcon.classList.remove('hide');
      elements.volumeSlider.value = 0;
    } else {
      elements.volOnIcon.classList.remove('hide');
      elements.volOffIcon.classList.add('hide');
      elements.volumeSlider.value = elements.cinemaVideo.volume || 0.8;
      if (elements.cinemaVideo.volume === 0) elements.cinemaVideo.volume = 0.8;
    }
  };

  // Volume slider
  elements.volumeSlider.oninput = (e) => {
    const vol = parseFloat(e.target.value);
    elements.cinemaVideo.volume = vol;
    
    if (vol === 0) {
      elements.cinemaVideo.muted = true;
      elements.volOnIcon.classList.add('hide');
      elements.volOffIcon.classList.remove('hide');
    } else {
      elements.cinemaVideo.muted = false;
      elements.volOnIcon.classList.remove('hide');
      elements.volOffIcon.classList.add('hide');
    }
  };

  // Progress Seek Slider
  elements.progressSlider.oninput = (e) => {
    const percent = parseFloat(e.target.value);
    if (elements.cinemaVideo.duration) {
      elements.cinemaVideo.currentTime = (percent / 100) * elements.cinemaVideo.duration;
    }
  };

  // Fullscreen button
  elements.fullscreenBtn.onclick = () => {
    if (!document.fullscreenElement) {
      elements.cinemaVideo.requestFullscreen().catch(err => {
        console.error("Fullscreen request failed:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Bookmark Modal Button
  elements.bookmarkToggleBtn.onclick = () => {
    if (!activeCinemaVideoObj) return;
    const isNowBookmarked = toggleBookmark(activeCinemaVideoObj);
    
    if (isNowBookmarked) {
      elements.bookmarkToggleBtn.classList.add('bookmarked');
      elements.bookmarkToggleBtn.title = 'Aus Lesezeichen entfernen';
    } else {
      elements.bookmarkToggleBtn.classList.remove('bookmarked');
      elements.bookmarkToggleBtn.title = 'In Lesezeichen speichern';
    }
  };
}

function toggleCinemaPlay() {
  if (elements.cinemaVideo.paused) {
    elements.cinemaVideo.play().catch(e => {});
    updateCinemaPlayIcon(true);
  } else {
    elements.cinemaVideo.pause();
    updateCinemaPlayIcon(false);
  }
}

function updateCinemaPlayIcon(isPlaying) {
  if (isPlaying) {
    elements.playIcon.classList.add('hide');
    elements.pauseIcon.classList.remove('hide');
  } else {
    elements.playIcon.classList.remove('hide');
    elements.pauseIcon.classList.add('hide');
  }
}

function updateCinemaProgress() {
  const video = elements.cinemaVideo;
  if (!video.duration) return;
  
  const percent = (video.currentTime / video.duration) * 100;
  elements.progressFill.style.width = `${percent}%`;
  elements.progressSlider.value = percent;
  
  // Format Times
  const curTime = formatTime(video.currentTime);
  const durTime = formatTime(video.duration);
  elements.timeDisplay.textContent = `${curTime} / ${durTime}`;
}

function updateCinemaBuffer() {
  const video = elements.cinemaVideo;
  if (!video.duration || video.buffered.length === 0) return;
  
  const bufferedEnd = video.buffered.end(video.buffered.length - 1);
  const percent = (bufferedEnd / video.duration) * 100;
  elements.progressBuffer.style.width = `${percent}%`;
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Clipboard Helper
function copyToClipboard(text, successMessage) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMessage);
  }).catch(err => {
    console.error("Clipboard copy failed:", err);
  });
}

// Custom Toast notification
function showToast(message) {
  let toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '30px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.background = 'var(--accent-gradient)';
  toast.style.color = 'white';
  toast.style.padding = '10px 24px';
  toast.style.borderRadius = '10px';
  toast.style.fontFamily = 'var(--font-display)';
  toast.style.fontWeight = '600';
  toast.style.fontSize = '0.9rem';
  toast.style.boxShadow = 'var(--glow-shadow)';
  toast.style.zIndex = '2000';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.25s ease';
  
  document.body.appendChild(toast);
  
  // Trigger animations
  setTimeout(() => {
    toast.textContent = message;
    toast.style.opacity = '1';
  }, 10);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 2500);
}

// --- Niche Management Helper Functions ---

const DEFAULT_NICHES = [
  { tag: "gaming", label: "🎮 Gaming" },
  { tag: "funny", label: "😂 Funny" },
  { tag: "cosplay", label: "🎭 Cosplay" },
  { tag: "anime", label: "🌸 Anime" },
  { tag: "dance", label: "💃 Dance" },
  { tag: "cute", label: "🐱 Cute" },
  { tag: "fail", label: "⚠️ Fail" }
];

async function loadNiches() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['redstream_niches'], (result) => {
      state.niches = result.redstream_niches || DEFAULT_NICHES;
      console.log(`Loaded ${state.niches.length} niches`);
      resolve();
    });
  });
}

async function saveNiches() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ redstream_niches: state.niches }, () => {
      console.log("Niches saved");
      resolve();
    });
  });
}

function renderTagPills() {
  const container = elements.tagsScroll;
  if (!container) return;
  
  container.innerHTML = '';
  
  // Create "Beliebt" (Popular) pill as baseline
  const popularBtn = document.createElement('button');
  popularBtn.className = 'tag-pill active';
  popularBtn.setAttribute('data-tag', '');
  popularBtn.textContent = '🔥 Beliebt';
  container.appendChild(popularBtn);
  
  // Create user custom niche pills
  state.niches.forEach(niche => {
    const btn = document.createElement('button');
    btn.className = 'tag-pill';
    btn.setAttribute('data-tag', niche.tag);
    btn.textContent = niche.label;
    container.appendChild(btn);
  });
}

function renderSettingsNicheList() {
  const container = elements.settingsNicheList;
  if (!container) return;
  
  container.innerHTML = '';
  
  if (state.niches.length === 0) {
    container.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem; padding: 4px;">Keine aktiven Nischen. Standard wird verwendet.</span>';
    return;
  }
  
  state.niches.forEach(niche => {
    const el = document.createElement('div');
    el.className = 'settings-niche-item';
    el.setAttribute('title', 'Klicken zum Löschen');
    el.innerHTML = `
      <span>${niche.label}</span>
      <span class="remove-niche-icon">
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </span>
    `;
    el.onclick = () => removeNiche(niche.tag);
    container.appendChild(el);
  });
}

async function addNiche(rawText) {
  const text = rawText.trim();
  if (!text) return;
  
  // Determine the search query tag by removing emojis and transforming to kebab-case
  let cleanTag = text.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '') // remove emojis
                     .trim()
                     .toLowerCase()
                     .replace(/[^a-z0-9\s-]/g, '') // keep alphanumeric and dashes
                     .replace(/\s+/g, '-'); // spaces to dashes
                     
  if (!cleanTag) {
    showToast("Ungültiger Nischenname (muss Zahlen oder Buchstaben enthalten).");
    return;
  }
  
  // Determine Label: Capitalize if simple, keep emoji if they typed one
  let label = text;
  if (text.toLowerCase() === cleanTag) {
    label = text.charAt(0).toUpperCase() + text.slice(1);
  }
  
  // Check if niche already exists
  if (state.niches.some(n => n.tag === cleanTag)) {
    showToast("Diese Nische existiert bereits!");
    return;
  }
  
  state.niches.push({ tag: cleanTag, label: label });
  await saveNiches();
  renderTagPills();
  renderSettingsNicheList();
  renderStreamNicheChecklist();
  showToast(`Nische "${label}" hinzugefügt!`);
  
  elements.newNicheInput.value = '';
}

async function removeNiche(tag) {
  state.niches = state.niches.filter(n => n.tag !== tag);
  await saveNiches();
  renderTagPills();
  renderSettingsNicheList();
  renderCatalogNiches(); // Refresh available catalog list
  
  // Also clean streamNiches selection and save
  state.streamNiches = state.streamNiches.filter(t => t !== tag);
  localStorage.setItem('redstream_stream_niches', JSON.stringify(state.streamNiches));
  chrome.storage.local.set({ redstream_stream_niches: state.streamNiches });
  renderStreamNicheChecklist();
  
  showToast("Nische gelöscht.");
}

function renderCatalogNiches() {
  const container = elements.settingsCatalogList;
  if (!container) return;

  container.innerHTML = '';

  // Filter catalog list to show only niches NOT currently in state.niches
  const activeTags = new Set(state.niches.map(n => n.tag));
  const availableNiches = state.catalogNiches.filter(n => !activeTags.has(n.tag));

  if (availableNiches.length === 0) {
    if (state.catalogNiches.length > 0) {
      container.innerHTML = '<span class="catalog-info-text" style="color: var(--success-color); padding: 4px;">Alle geladenen Nischen wurden hinzugefügt!</span>';
    } else {
      container.innerHTML = '<span class="catalog-info-text">Klicke auf "Katalog laden", um offizielle Nischen von RedGifs zu importieren.</span>';
    }
    return;
  }

  availableNiches.forEach(niche => {
    const el = document.createElement('div');
    el.className = 'settings-niche-item catalog-item';
    el.setAttribute('title', 'Klicken zum Hinzufügen');
    el.innerHTML = `
      <span>${niche.label}</span>
      <span class="remove-niche-icon" style="transform: rotate(45deg); display: flex; align-items: center;">
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </span>
    `;
    el.onclick = async () => {
      // Add to active niches
      state.niches.push(niche);
      await saveNiches();
      renderTagPills();
      renderSettingsNicheList();
      renderCatalogNiches(); // Refresh this catalog list
      renderStreamNicheChecklist();
      showToast(`Nische "${niche.label}" hinzugefügt!`);
    };
    container.appendChild(el);
  });
}

function fetchNiches(isAppend = false) {
  if (isAppend) {
    state.catalogPage++;
    // Append a small loading indicator at the bottom of the list
    elements.settingsCatalogList.innerHTML += `
      <div id="catalog-more-loader" style="display: flex; align-items: center; gap: 8px; width: 100%; margin-top: 8px; padding-left: 4px;">
        <div class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></div>
        <span class="catalog-info-text">Lade mehr Nischen (Seite ${state.catalogPage})...</span>
      </div>
    `;
  } else {
    state.catalogPage = 1;
    state.catalogNiches = [];
    elements.settingsCatalogList.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
        <span class="catalog-info-text">Nischen von RedGifs laden... (Bitte warten)</span>
      </div>
    `;
  }

  elements.loadCatalogNewBtn.disabled = true;
  elements.loadCatalogMoreBtn.disabled = true;

  chrome.runtime.sendMessage({
    action: "START_NICHES_SCRAPE",
    page: state.catalogPage
  }, (response) => {
    elements.loadCatalogNewBtn.disabled = false;
    elements.loadCatalogMoreBtn.disabled = false;

    // Remove more-loader if present
    const moreLoader = document.getElementById('catalog-more-loader');
    if (moreLoader) moreLoader.remove();

    if (chrome.runtime.lastError) {
      console.error("Niches scrape error:", chrome.runtime.lastError);
      if (!isAppend) {
        elements.settingsCatalogList.innerHTML = '<span class="catalog-info-text" style="color: var(--danger-color); padding: 4px;">Erweiterung konnte nicht kontaktiert werden.</span>';
      } else {
        showToast("Fehler beim Laden weiterer Nischen.");
      }
      return;
    }

    if (response && response.niches && response.niches.length > 0) {
      if (isAppend) {
        // Merge and deduplicate
        const existingTags = new Set(state.catalogNiches.map(n => n.tag));
        let added = 0;
        response.niches.forEach(n => {
          if (n && n.tag && !existingTags.has(n.tag)) {
            state.catalogNiches.push(n);
            existingTags.add(n.tag);
            added++;
          }
        });
        renderCatalogNiches();
        chrome.storage.local.set({ redstream_catalog_niches: state.catalogNiches });
        showToast(`${added} neue Nischen geladen!`);
        if (added === 0) {
          showToast("Keine weiteren neuen Nischen gefunden.");
        }
      } else {
        state.catalogNiches = response.niches;
        renderCatalogNiches();
        chrome.storage.local.set({ redstream_catalog_niches: state.catalogNiches });
        showToast(`${response.niches.length} Nischen geladen!`);
      }
    } else {
      if (!isAppend) {
        elements.settingsCatalogList.innerHTML = '<span class="catalog-info-text" style="color: var(--danger-color); padding: 4px;">Keine Nischen im Katalog gefunden. Bitte versuche es erneut.</span>';
      } else {
        showToast("Keine weiteren Nischen gefunden.");
      }
    }
  });
}

// --- Stream Tab Helper Functions (TikTok-Style) ---

async function loadSeenVideos() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['redstream_seen_videos'], (result) => {
      state.seenVideos = result.redstream_seen_videos || {};
      console.log(`Loaded ${Object.keys(state.seenVideos).length} seen videos`);
      resolve();
    });
  });
}

async function saveSeenVideos() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ redstream_seen_videos: state.seenVideos }, () => {
      console.log("Seen videos saved");
      resolve();
    });
  });
}

function renderStreamNicheChecklist() {
  const container = elements.streamNichesList;
  if (!container) return;
  
  container.innerHTML = '';
  
  if (state.niches.length === 0) {
    container.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem; padding: 4px; display: block;">Keine Nischen aktiv.</span>';
    return;
  }

  // Load saved stream niches from localStorage if any, or default to all active niches
  const savedStreamNiches = localStorage.getItem('redstream_stream_niches');
  if (savedStreamNiches) {
    try {
      state.streamNiches = JSON.parse(savedStreamNiches);
    } catch (e) {
      state.streamNiches = state.niches.map(n => n.tag);
    }
  } else {
    state.streamNiches = state.niches.map(n => n.tag);
  }
  // Sync stream niches to chrome.storage.local for content script access
  chrome.storage.local.set({ redstream_stream_niches: state.streamNiches });
  
  state.niches.forEach(niche => {
    const isChecked = state.streamNiches.includes(niche.tag);
    
    const item = document.createElement('label');
    item.className = `stream-niche-checkbox-item ${isChecked ? 'active' : ''}`;
    item.innerHTML = `
      <input type="checkbox" value="${niche.tag}" ${isChecked ? 'checked' : ''}>
      <span>${niche.label}</span>
    `;
    
    const checkbox = item.querySelector('input');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        item.classList.add('active');
        if (!state.streamNiches.includes(niche.tag)) {
          state.streamNiches.push(niche.tag);
        }
      } else {
        item.classList.remove('active');
        state.streamNiches = state.streamNiches.filter(t => t !== niche.tag);
      }
      
      // Save selection
      localStorage.setItem('redstream_stream_niches', JSON.stringify(state.streamNiches));
      chrome.storage.local.set({ redstream_stream_niches: state.streamNiches });
    });
    
    container.appendChild(item);
  });
}

async function triggerStreamScrape(isAppend = false) {
  if (state.isStreamScraping) return;
  
  if (state.streamNiches.length === 0) {
    elements.streamEmpty.classList.remove('hide');
    elements.streamContainer.innerHTML = '';
    return;
  }
  
  state.isStreamScraping = true;
  elements.streamEmpty.classList.add('hide');
  elements.streamLoader.classList.remove('hide');
  
  if (isAppend) {
    state.streamPage++;
    console.log(`Stream pagination triggered: loading page ${state.streamPage} for stream niches:`, state.streamNiches);
    
    // Add temporary snapping scroll loader slide at the end of the container
    let streamEndLoader = document.getElementById('stream-end-loader');
    if (!streamEndLoader) {
      streamEndLoader = document.createElement('div');
      streamEndLoader.id = 'stream-end-loader';
      streamEndLoader.className = 'stream-slide';
      streamEndLoader.style.scrollSnapAlign = 'start';
      streamEndLoader.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; color: var(--text-secondary);">
          <div class="spinner" style="width: 36px; height: 36px; border-width: 4px;"></div>
          <span style="font-family: var(--font-display); font-weight: 600; font-size: 0.95rem;">Lade weitere Videos...</span>
        </div>
      `;
      elements.streamContainer.appendChild(streamEndLoader);
      streamEndLoader.scrollIntoView({ behavior: 'smooth' });
    }
  } else {
    state.streamPage = 1;
    state.streamVideos = [];
    elements.streamContainer.innerHTML = '';
  }
  
  // Parallel background scraping tasks for each selected stream niche
  const scrapePromises = state.streamNiches.map(tag => {
    return new Promise(resolve => {
      // Exclude IDs we already have in stream or have seen
      const excludeIds = [
        ...state.streamVideos.map(v => v.id),
        ...Object.keys(state.seenVideos)
      ];
      
      chrome.runtime.sendMessage({
        action: "START_SCRAPE",
        query: tag,
        page: state.streamPage,
        isNiche: true,
        excludeIds: excludeIds
      }, response => {
        if (response && response.success && response.videos) {
          resolve(response.videos);
        } else {
          resolve([]);
        }
      });
    });
  });
  
  const results = await Promise.all(scrapePromises);
  state.isStreamScraping = false;
  elements.streamLoader.classList.add('hide');
  
  // Remove temporary snapping loader slide if present
  const endLoader = document.getElementById('stream-end-loader');
  if (endLoader) {
    endLoader.remove();
  }
  
  // Interleave results from different niches
  const newVideos = [];
  const existingIds = new Set([
    ...state.streamVideos.map(v => v.id),
    ...Object.keys(state.seenVideos)
  ]);
  
  const maxLen = Math.max(...results.map(r => r.length));
  for (let i = 0; i < maxLen; i++) {
    for (let j = 0; j < results.length; j++) {
      const video = results[j][i];
      if (video && video.id && !existingIds.has(video.id)) {
        existingIds.add(video.id);
        newVideos.push(video);
        if (isAppend) {
          state.streamVideos.push(video);
        }
      }
    }
  }
  
  if (isAppend) {
    if (newVideos.length > 0) {
      newVideos.forEach(video => {
        const slide = createStreamSlide(video);
        elements.streamContainer.appendChild(slide);
      });
      console.log(`Appended ${newVideos.length} new unseen videos to stream. Total: ${state.streamVideos.length}`);
      setupStreamObserver();
      
      // Auto-replenish if we got very few new videos in the append
      if (newVideos.length < 8 && state.streamPage < 6) {
        console.log(`Only got ${newVideos.length} new videos in pagination. Auto-fetching next page...`);
        setTimeout(() => triggerStreamScrape(true), 300);
      }
    } else {
      console.log("No new unseen videos found during pagination.");
      showToast("Keine weiteren neuen Videos gefunden.");
    }
  } else {
    state.streamVideos = newVideos;
    if (newVideos.length > 0) {
      elements.streamEmpty.classList.add('hide');
      newVideos.forEach(video => {
        const slide = createStreamSlide(video);
        elements.streamContainer.appendChild(slide);
      });
      console.log(`Rendered initial stream feed with ${newVideos.length} videos`);
      
      setupStreamObserver();
      playFirstStreamVideo();
      
      // Auto-replenish if initial batch has very few unseen videos
      if (newVideos.length < 8 && state.streamPage < 6) {
        console.log(`Only got ${newVideos.length} videos on page 1. Auto-fetching next page...`);
        setTimeout(() => triggerStreamScrape(true), 300);
      }
    } else {
      elements.streamEmpty.classList.remove('hide');
      elements.streamEmpty.querySelector('h3').textContent = "Keine neuen Videos";
      elements.streamEmpty.querySelector('p').textContent = "Alle verfügbaren Videos in diesen Nischen wurden bereits gesehen. Setze deinen Verlauf in den Einstellungen zurück, um sie erneut zu sehen.";
    }
  }
}

function createStreamSlide(video) {
  const slide = document.createElement('div');
  slide.className = 'stream-slide';
  slide.setAttribute('data-id', video.id);
  
  const isBookmarked = !!state.bookmarks[video.id];
  const videoSrc = state.settings.quality === 'hd' ? video.src : video.srcSd;
  
  let tagsHtml = '';
  if (video.tags && video.tags.length > 0) {
    video.tags.slice(0, 3).forEach(tag => {
      tagsHtml += `<span class="stream-tag" data-tag="${tag}">#${tag}</span>`;
    });
  }
  
  const viewCount = video.views ? formatCount(video.views) : '0';
  const likeCount = video.likes ? formatCount(video.likes) : '0';
  
  slide.innerHTML = `
    <video loop playsinline muted poster="${video.poster}">
      <source src="${videoSrc}" type="video/mp4">
    </video>
    
    <div class="stream-slide-loader">
      <div class="spinner" style="width: 32px; height: 32px; border-width: 3px;"></div>
    </div>
    
    <div class="stream-play-overlay">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
    </div>
    
    <div class="stream-overlay-bottom">
      <div class="stream-creator">@${video.userName || 'anonymous'}</div>
      <h3>${video.title || 'RedGifs Video'}</h3>
      <div class="stream-meta">
        <span>👁️ ${viewCount}</span>
        <span>❤️ <span class="stream-like-count">${likeCount}</span></span>
      </div>
      <div class="stream-tags">
        ${tagsHtml}
      </div>
    </div>
    
    <div class="stream-overlay-right">
      <div class="stream-btn-wrapper">
        <button class="stream-circle-btn stream-heart-btn ${isBookmarked ? 'bookmarked' : ''}">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="heart-svg"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </button>
        <span class="stream-btn-label">Save</span>
      </div>
      
      <div class="stream-btn-wrapper">
        <button class="stream-circle-btn stream-mute-btn ${state.settings.muteDefault ? 'active' : ''}">
          <svg class="vol-on-icon ${state.settings.muteDefault ? 'hide' : ''}" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          <svg class="vol-off-icon ${state.settings.muteDefault ? '' : 'hide'}" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
        </button>
        <span class="stream-btn-label">${state.settings.muteDefault ? 'Muted' : 'Sound'}</span>
      </div>

      <div class="stream-btn-wrapper">
        <button class="stream-circle-btn stream-share-btn">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
        </button>
        <span class="stream-btn-label">Link</span>
      </div>

      <div class="stream-btn-wrapper">
        <a href="${video.src}" class="stream-circle-btn stream-download-btn" download target="_blank">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </a>
        <span class="stream-btn-label">Get</span>
      </div>
    </div>
  `;
  
  const videoEl = slide.querySelector('video');
  const slideLoader = slide.querySelector('.stream-slide-loader');
  
  // Media loading & buffering events
  videoEl.addEventListener('loadstart', () => {
    slideLoader.classList.remove('hide');
  });
  
  videoEl.addEventListener('waiting', () => {
    slideLoader.classList.remove('hide');
  });
  
  videoEl.addEventListener('playing', () => {
    slideLoader.classList.add('hide');
  });
  
  videoEl.addEventListener('canplay', () => {
    slideLoader.classList.add('hide');
  });
  
  videoEl.addEventListener('error', () => {
    slideLoader.classList.add('hide');
  });
  
  videoEl.addEventListener('click', () => {
    if (videoEl.paused) {
      videoEl.play().catch(e => {});
      slide.classList.remove('paused');
    } else {
      videoEl.pause();
      slide.classList.add('paused');
    }
  });
  
  const heartBtn = slide.querySelector('.stream-heart-btn');
  heartBtn.addEventListener('click', () => {
    const isNowBookmarked = toggleBookmark(video);
    if (isNowBookmarked) {
      heartBtn.classList.add('bookmarked');
    } else {
      heartBtn.classList.remove('bookmarked');
    }
  });
  
  const muteBtn = slide.querySelector('.stream-mute-btn');
  const volOnIcon = muteBtn.querySelector('.vol-on-icon');
  const volOffIcon = muteBtn.querySelector('.vol-off-icon');
  const muteLabel = muteBtn.nextElementSibling;
  
  muteBtn.addEventListener('click', () => {
    const newMuteState = !videoEl.muted;
    videoEl.muted = newMuteState;
    
    if (newMuteState) {
      muteBtn.classList.add('active');
      volOnIcon.classList.add('hide');
      volOffIcon.classList.remove('hide');
      muteLabel.textContent = 'Muted';
    } else {
      muteBtn.classList.remove('active');
      volOnIcon.classList.remove('hide');
      volOffIcon.classList.add('hide');
      muteLabel.textContent = 'Sound';
    }
    
    state.settings.muteDefault = newMuteState;
    saveSettings();
    const settingsCheck = document.getElementById('mute-default');
    if (settingsCheck) settingsCheck.checked = newMuteState;
    
    document.querySelectorAll('.stream-slide video').forEach(v => {
      v.muted = newMuteState;
    });
    document.querySelectorAll('.stream-mute-btn').forEach(btn => {
      const onIco = btn.querySelector('.vol-on-icon');
      const offIco = btn.querySelector('.vol-off-icon');
      const lbl = btn.nextElementSibling;
      if (newMuteState) {
        btn.classList.add('active');
        onIco.classList.add('hide');
        offIco.classList.remove('hide');
        if (lbl) lbl.textContent = 'Muted';
      } else {
        btn.classList.remove('active');
        onIco.classList.remove('hide');
        offIco.classList.add('hide');
        if (lbl) lbl.textContent = 'Sound';
      }
    });
  });
  
  slide.querySelector('.stream-share-btn').addEventListener('click', () => {
    copyToClipboard(video.watchUrl, "Link kopiert!");
  });
  
  slide.querySelectorAll('.stream-tag').forEach(tagEl => {
    tagEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const tagText = tagEl.getAttribute('data-tag');
      
      videoEl.pause();
      
      switchTab('explore');
      elements.searchInput.value = tagText;
      elements.clearSearchBtn.classList.remove('hide');
      
      document.querySelectorAll('#tags-scroll .tag-pill').forEach(p => {
        if (p.getAttribute('data-tag') === tagText) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });
      
      const isNiche = state.niches.some(n => n.tag.toLowerCase() === tagText.toLowerCase());
      triggerScrape(tagText, false, isNiche);
    });
  });
  
  return slide;
}

let streamObserver = null;

function setupStreamObserver() {
  if (streamObserver) {
    streamObserver.disconnect();
  }
  
  const options = {
    root: elements.streamContainer,
    rootMargin: '0px',
    threshold: 0.6
  };
  
  streamObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target.querySelector('video');
      const slideId = entry.target.getAttribute('data-id');
      
      if (entry.isIntersecting) {
        console.log(`Stream slide entered view: ${slideId}`);
        video.muted = state.settings.muteDefault;
        video.play().catch(e => console.log("Stream play blocked:", e));
        entry.target.classList.remove('paused');
        
        if (slideId && !state.seenVideos[slideId]) {
          state.seenVideos[slideId] = true;
          saveSeenVideos();
        }
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, options);
  
  const slides = elements.streamContainer.querySelectorAll('.stream-slide');
  slides.forEach(slide => streamObserver.observe(slide));
}

function playFirstStreamVideo() {
  const firstSlide = elements.streamContainer.querySelector('.stream-slide');
  if (firstSlide) {
    const video = firstSlide.querySelector('video');
    if (video) {
      video.muted = state.settings.muteDefault;
      video.play().catch(e => {});
    }
    const slideId = firstSlide.getAttribute('data-id');
    if (slideId && !state.seenVideos[slideId]) {
      state.seenVideos[slideId] = true;
      saveSeenVideos();
    }
  }
}
