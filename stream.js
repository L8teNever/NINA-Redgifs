// RedStream - Stream Page Controller

const state = {
  bookmarks: {},
  settings: { quality: 'sd', autoplayHover: true, muteDefault: true },
  seenVideos: {},
  streamVideos: [],
  streamNiches: [],
  streamPage: 1,
  isStreamScraping: false,
  niches: []
};

const elements = {
  streamNichesList: document.getElementById('stream-niches-list'),
  streamReloadBtn: document.getElementById('stream-reload-btn'),
  streamContainer: document.getElementById('stream-container'),
  streamEmpty: document.getElementById('stream-empty'),
  streamLoader: document.getElementById('stream-loader')
};

const DEFAULT_NICHES = [
  { tag: "gaming", label: "🎮 Gaming" },
  { tag: "funny", label: "😂 Funny" },
  { tag: "cosplay", label: "🎭 Cosplay" },
  { tag: "anime", label: "🌸 Anime" },
  { tag: "dance", label: "💃 Dance" },
  { tag: "cute", label: "🐱 Cute" },
  { tag: "fail", label: "⚠️ Fail" }
];

document.addEventListener('DOMContentLoaded', async () => {
  await loadBookmarks();
  await loadNiches();
  loadSettings();
  setupEventListeners();
  renderStreamNicheChecklist();
  triggerStreamScrape(false);
});

function loadSettings() {
  const saved = localStorage.getItem('redstream_settings');
  if (saved) {
    try { state.settings = { ...state.settings, ...JSON.parse(saved) }; } catch (e) {}
  }
}

function saveSettings() {
  localStorage.setItem('redstream_settings', JSON.stringify(state.settings));
}

async function loadBookmarks() {
  return new Promise(resolve => {
    chrome.storage.local.get(['redstream_bookmarks'], result => {
      state.bookmarks = result.redstream_bookmarks || {};
      resolve();
    });
  });
}

async function saveBookmarks() {
  return new Promise(resolve => {
    chrome.storage.local.set({ redstream_bookmarks: state.bookmarks }, resolve);
  });
}

async function loadSeenVideos() {
  return new Promise(resolve => {
    chrome.storage.local.get(['redstream_seen_videos'], result => {
      state.seenVideos = result.redstream_seen_videos || {};
      resolve();
    });
  });
}

async function saveSeenVideos() {
  return new Promise(resolve => {
    chrome.storage.local.set({ redstream_seen_videos: state.seenVideos }, resolve);
  });
}

async function loadNiches() {
  return new Promise(resolve => {
    chrome.storage.local.get(['redstream_niches'], result => {
      state.niches = result.redstream_niches || DEFAULT_NICHES;
      resolve();
    });
  });
}

function setupEventListeners() {
  // Nav buttons → navigate to dashboard pages
  document.querySelectorAll('.nav-btn[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = btn.getAttribute('data-nav');
    });
  });

  // Mobile: niche drawer toggle
  const mobileToggle = document.getElementById('stream-mobile-toggle');
  const sidebar = document.querySelector('.stream-sidebar');
  const backdrop = document.getElementById('stream-drawer-backdrop');
  if (mobileToggle && sidebar && backdrop) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = sidebar.classList.contains('mobile-open');
      sidebar.classList.toggle('mobile-open', !isOpen);
      backdrop.classList.toggle('open', !isOpen);
    });
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      backdrop.classList.remove('open');
    });
  }

  elements.streamReloadBtn.addEventListener('click', () => {
    triggerStreamScrape(false);
  });

  // Fullscreen toggle
  const fsBtn     = document.getElementById('stream-fullscreen-btn');
  const videoBox  = document.querySelector('.stream-video-box');
  if (fsBtn && videoBox) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        videoBox.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
    document.addEventListener('fullscreenchange', () => {
      const isFs = !!document.fullscreenElement;
      fsBtn.querySelector('.fs-expand').classList.toggle('hide', isFs);
      fsBtn.querySelector('.fs-compress').classList.toggle('hide', !isFs);
    });
  }

  elements.streamContainer.addEventListener('scroll', () => {
    if (state.isStreamScraping || state.streamVideos.length === 0) return;
    const container = elements.streamContainer;
    const scrollBottom = container.scrollHeight - container.clientHeight - container.scrollTop;
    if (scrollBottom < container.clientHeight * 1.5) {
      triggerStreamScrape(true);
    }
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

  const savedStreamNiches = localStorage.getItem('redstream_stream_niches');
  if (savedStreamNiches) {
    try { state.streamNiches = JSON.parse(savedStreamNiches); } catch (e) {
      state.streamNiches = state.niches.map(n => n.tag);
    }
  } else {
    state.streamNiches = state.niches.map(n => n.tag);
  }

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
        if (!state.streamNiches.includes(niche.tag)) state.streamNiches.push(niche.tag);
      } else {
        item.classList.remove('active');
        state.streamNiches = state.streamNiches.filter(t => t !== niche.tag);
      }
      localStorage.setItem('redstream_stream_niches', JSON.stringify(state.streamNiches));
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
    let streamEndLoader = document.getElementById('stream-end-loader');
    if (!streamEndLoader) {
      streamEndLoader = document.createElement('div');
      streamEndLoader.id = 'stream-end-loader';
      streamEndLoader.className = 'stream-slide';
      streamEndLoader.style.scrollSnapAlign = 'start';
      streamEndLoader.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:15px;color:var(--text-secondary);">
          <div class="spinner" style="width:36px;height:36px;border-width:4px;"></div>
          <span style="font-family:var(--font-display);font-weight:600;font-size:0.95rem;">Lade weitere Videos...</span>
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

  // Batch niches 2 at a time with a pause to avoid rate limiting
  const excludeIds = [
    ...state.streamVideos.map(v => v.id),
    ...Object.keys(state.seenVideos)
  ];
  const results = [];
  const batchSize = 2;
  for (let i = 0; i < state.streamNiches.length; i += batchSize) {
    const batch = state.streamNiches.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(tag => new Promise(resolve => {
      chrome.runtime.sendMessage({
        action: "START_SCRAPE",
        query: tag,
        page: state.streamPage,
        isNiche: true,
        excludeIds: excludeIds
      }, response => {
        if (response && response.success && response.videos) resolve(response.videos);
        else resolve([]);
      });
    })));
    results.push(...batchResults);
    if (i + batchSize < state.streamNiches.length) {
      await new Promise(r => setTimeout(r, 400));
    }
  }
  state.isStreamScraping = false;
  elements.streamLoader.classList.add('hide');

  const endLoader = document.getElementById('stream-end-loader');
  if (endLoader) endLoader.remove();

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
        if (isAppend) state.streamVideos.push(video);
      }
    }
  }

  if (isAppend) {
    if (newVideos.length > 0) {
      newVideos.forEach(video => {
        elements.streamContainer.appendChild(createStreamSlide(video));
      });
      setupStreamObserver();
      showToast(`+${newVideos.length} neue Videos geladen`);
    } else {
      showToast("Keine weiteren neuen Videos gefunden.");
    }
  } else {
    state.streamVideos = newVideos;
    if (newVideos.length > 0) {
      elements.streamEmpty.classList.add('hide');
      newVideos.forEach(video => {
        elements.streamContainer.appendChild(createStreamSlide(video));
      });
      setupStreamObserver();
      playFirstStreamVideo();
      showToast(`${newVideos.length} Videos geladen`);
    } else if (Object.keys(state.seenVideos).length > 0) {
      // All seen in this session → reset and reload fresh
      state.seenVideos = {};
      triggerStreamScrape(false);
    } else {
      elements.streamEmpty.classList.remove('hide');
      elements.streamEmpty.querySelector('h3').textContent = "Keine Videos gefunden";
      elements.streamEmpty.querySelector('p').textContent = "Es wurden keine Videos in den ausgewählten Nischen gefunden.";
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
    <div class="stream-seen-bar"></div>
    <div class="stream-speed-badge hide">2×</div>
    <video loop playsinline muted poster="${video.poster}">
      <source src="${videoSrc}" type="video/mp4">
    </video>
    <div class="stream-slide-loader">
      <div class="spinner" style="width:32px;height:32px;border-width:3px;"></div>
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
      <div class="stream-tags">${tagsHtml}</div>
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

  videoEl.addEventListener('loadstart', () => slideLoader.classList.remove('hide'));
  videoEl.addEventListener('waiting', () => slideLoader.classList.remove('hide'));
  videoEl.addEventListener('playing', () => slideLoader.classList.add('hide'));
  videoEl.addEventListener('canplay', () => slideLoader.classList.add('hide'));
  videoEl.addEventListener('error', () => slideLoader.classList.add('hide'));

  const speedBadge = slide.querySelector('.stream-speed-badge');
  let holdTimer = null;
  let isHolding = false;

  function startHold() {
    holdTimer = setTimeout(() => {
      isHolding = true;
      videoEl.playbackRate = 2.0;
      speedBadge.classList.remove('hide');
    }, 180);
  }

  function endHold() {
    clearTimeout(holdTimer);
    if (isHolding) {
      isHolding = false;
      videoEl.playbackRate = 1.0;
      speedBadge.classList.add('hide');
    } else {
      // Quick tap → toggle play/pause
      if (videoEl.paused) {
        videoEl.play().catch(e => {});
        slide.classList.remove('paused');
      } else {
        videoEl.pause();
        slide.classList.add('paused');
      }
    }
  }

  function cancelHold() {
    clearTimeout(holdTimer);
    if (isHolding) {
      isHolding = false;
      videoEl.playbackRate = 1.0;
      speedBadge.classList.add('hide');
    }
  }

  // Mouse hold
  videoEl.addEventListener('mousedown', startHold);
  videoEl.addEventListener('mouseup', endHold);
  videoEl.addEventListener('mouseleave', cancelHold);

  // Touch hold (mobile)
  videoEl.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(); }, { passive: false });
  videoEl.addEventListener('touchend', endHold);
  videoEl.addEventListener('touchcancel', cancelHold);

  const heartBtn = slide.querySelector('.stream-heart-btn');
  heartBtn.addEventListener('click', () => {
    const isNowBookmarked = toggleBookmark(video);
    if (isNowBookmarked) heartBtn.classList.add('bookmarked');
    else heartBtn.classList.remove('bookmarked');
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

    document.querySelectorAll('.stream-slide video').forEach(v => { v.muted = newMuteState; });
    document.querySelectorAll('.stream-mute-btn').forEach(btn => {
      const onIco = btn.querySelector('.vol-on-icon');
      const offIco = btn.querySelector('.vol-off-icon');
      const lbl = btn.nextElementSibling;
      if (newMuteState) {
        btn.classList.add('active'); onIco.classList.add('hide'); offIco.classList.remove('hide');
        if (lbl) lbl.textContent = 'Muted';
      } else {
        btn.classList.remove('active'); onIco.classList.remove('hide'); offIco.classList.add('hide');
        if (lbl) lbl.textContent = 'Sound';
      }
    });
  });

  slide.querySelector('.stream-share-btn').addEventListener('click', () => {
    copyToClipboard(video.watchUrl, "Link kopiert!");
  });

  slide.querySelectorAll('.stream-tag').forEach(tagEl => {
    tagEl.addEventListener('click', e => {
      e.stopPropagation();
      videoEl.pause();
      window.location.href = 'dashboard.html?q=' + encodeURIComponent(tagEl.getAttribute('data-tag'));
    });
  });

  return slide;
}

let streamObserver = null;
const seenTimers = new Map(); // slideId → timeoutId, cleared if scrolled away before 1s

function setupStreamObserver() {
  if (streamObserver) streamObserver.disconnect();

  streamObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target.querySelector('video');
      const slideId = entry.target.getAttribute('data-id');

      const seenBar = entry.target.querySelector('.stream-seen-bar');

      if (entry.isIntersecting) {
        video.muted = state.settings.muteDefault;
        video.play().catch(e => {});
        entry.target.classList.remove('paused');

        if (slideId && !state.seenVideos[slideId] && !seenTimers.has(slideId)) {
          // Animate bar from 0 → 100% over 5 seconds
          if (seenBar) {
            seenBar.style.transition = 'none';
            seenBar.style.width = '0%';
            seenBar.style.opacity = '1';
            seenBar.offsetWidth; // force reflow so transition fires
            seenBar.style.transition = 'width 2s linear';
            seenBar.style.width = '100%';
          }

          const timerId = setTimeout(() => {
            state.seenVideos[slideId] = true;
            seenTimers.delete(slideId);
            if (seenBar) {
              seenBar.style.transition = 'opacity 0.6s ease';
              seenBar.style.opacity = '0.25';
            }
          }, 2000);
          seenTimers.set(slideId, timerId);

        } else if (slideId && state.seenVideos[slideId] && seenBar) {
          // Already seen: show faint full bar
          seenBar.style.transition = 'none';
          seenBar.style.width = '100%';
          seenBar.style.opacity = '0.25';
        }
      } else {
        video.pause();
        video.currentTime = 0;

        // Scrolled away before 1 second → cancel & reset bar
        if (slideId && seenTimers.has(slideId)) {
          clearTimeout(seenTimers.get(slideId));
          seenTimers.delete(slideId);
          if (seenBar) {
            seenBar.style.transition = 'none';
            seenBar.style.width = '0%';
          }
        }
      }
    });
  }, { root: elements.streamContainer, rootMargin: '0px', threshold: 0.6 });

  elements.streamContainer.querySelectorAll('.stream-slide').forEach(slide => {
    streamObserver.observe(slide);
  });
}

function playFirstStreamVideo() {
  const firstSlide = elements.streamContainer.querySelector('.stream-slide');
  if (!firstSlide) return;
  const video = firstSlide.querySelector('video');
  if (video) {
    video.muted = state.settings.muteDefault;
    video.play().catch(e => {});
  }
  // Seen tracking handled by the observer with 1-second delay
}

function toggleBookmark(video) {
  if (state.bookmarks[video.id]) {
    delete state.bookmarks[video.id];
    saveBookmarks();
    return false;
  } else {
    state.bookmarks[video.id] = video;
    saveBookmarks();
    return true;
  }
}

function formatCount(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:var(--accent-gradient);color:white;padding:10px 24px;border-radius:10px;font-family:var(--font-display);font-weight:600;font-size:0.9rem;box-shadow:var(--glow-shadow);z-index:2000;opacity:0;transition:opacity 0.25s ease';
  document.body.appendChild(toast);
  setTimeout(() => { toast.textContent = message; toast.style.opacity = '1'; }, 10);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 250); }, 2500);
}

function copyToClipboard(text, successMessage) {
  navigator.clipboard.writeText(text).then(() => showToast(successMessage)).catch(err => console.error("Clipboard copy failed:", err));
}
