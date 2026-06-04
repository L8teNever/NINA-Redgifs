// Content Script (Runs in the ISOLATED world context of RedGifs)

console.log("RedStream isolated content script loaded");

// Inject the main world hook script to intercept fetch and XHR calls
try {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('main_world_hook.js');
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => {
    script.remove();
  };
} catch (e) {
  console.error("Failed to inject main_world_hook.js:", e);
}

// Set to keep track of scraped video IDs to prevent duplicates
const processedIds = new Set();
window._hasFetchedPageDirectly = false;
window._excludeIds = [];
window._hasInterceptedNetworkData = false;

// 1. Listen for messages from the MAIN world hook script
window.addEventListener("message", (event) => {
  if (!event.data) return;

  // Handle intercepted video data
  if (event.data.type === "REDGIFS_INTERCEPTED_DATA") {
    const interceptedVideos = event.data.videos;
    const requestUrl = event.data.url || "";

    if (interceptedVideos && interceptedVideos.length > 0) {
      chrome.runtime.sendMessage({ action: "GET_SCRAPE_CONFIG" }, (config) => {
        if (!config) return;

        // Exclude ads/sponsored videos
        if (requestUrl) {
          const lowerRequestUrl = requestUrl.toLowerCase();
          if (lowerRequestUrl.includes('/sponsored') || lowerRequestUrl.includes('/ads') || lowerRequestUrl.includes('/promoted')) {
            console.log(`Filtering out videos from ad/sponsored API call: ${requestUrl}`);
            return;
          }
        }

        let filteredVideos = interceptedVideos;

        // If we are scraping a specific niche, only accept videos from requests targeting that niche
        if (config.isNiche && config.query) {
          const cleanQuery = config.query.toLowerCase().trim();
          const queryWords = cleanQuery.split(/[\s-_]+/);

          const isNicheUrl = requestUrl.toLowerCase().includes('/niches/');
          const containsQuery = queryWords.every(word => requestUrl.toLowerCase().includes(word));

          if (requestUrl && (!isNicheUrl || !containsQuery)) {
            console.log(`Filtering out videos from unrelated API call: ${requestUrl} (expected niche: ${cleanQuery})`);
            return; // ignore this entire batch!
          }
        }

        // If we are scraping a search query, only accept videos from requests matching that search query
        if (!config.isNiche && config.query && config.query !== "") {
          const cleanQuery = config.query.toLowerCase().trim();
          const queryWords = cleanQuery.split(/[\s-_]+/);
          const decodedUrl = decodeURIComponent(requestUrl).toLowerCase();

          const isSearchUrl = decodedUrl.includes('/search') || decodedUrl.includes('search_text=') || decodedUrl.includes('search=');
          const containsQuery = queryWords.every(word => decodedUrl.includes(word));

          if (requestUrl && (!isSearchUrl || !containsQuery)) {
            console.log(`Filtering out videos from unrelated search API call: ${requestUrl} (expected query: ${cleanQuery})`);
            return; // ignore this entire batch!
          }
        }

        const newVideos = filteredVideos.filter(v => {
          if (v && v.id && !processedIds.has(v.id)) {
            processedIds.add(v.id);
            return true;
          }
          return false;
        });

        if (newVideos.length > 0) {
          window._hasInterceptedNetworkData = true; // Mark that we successfully intercepted network data
          chrome.runtime.sendMessage({
            action: "DATA_CAPTURED",
            videos: newVideos
          });
        }
      });
    }
  }

  // Handle intercepted authentication token to fetch page > 1 programmatically
  if (event.data.type === "REDGIFS_AUTH_CAPTURED") {
    const { token, url } = event.data;
    chrome.runtime.sendMessage({ action: "GET_SCRAPE_CONFIG" }, (config) => {
      if (!config) return;
      const page = config.page || 1;

      // Validate that this URL actually corresponds to the query we are scraping
      if (page > 1 && !window._hasFetchedPageDirectly) {
        const lowerUrl = url.toLowerCase();

        // Exclude ads/sponsored URLs
        if (lowerUrl.includes('/sponsored') || lowerUrl.includes('/ads') || lowerUrl.includes('/promoted')) {
          console.log(`Ignoring auth capture for ad/sponsored URL: ${url}`);
          return;
        }

        // Niche verification
        if (config.isNiche && config.query) {
          const cleanQuery = config.query.toLowerCase().trim();
          const queryWords = cleanQuery.split(/[\s-_]+/);
          const isNicheUrl = lowerUrl.includes('/niches/');
          const containsQuery = queryWords.every(word => lowerUrl.includes(word));

          if (!isNicheUrl || !containsQuery) {
            console.log(`Ignoring auth capture for unrelated niche API: ${url} (expected niche: ${cleanQuery})`);
            return;
          }
        }

        // Search query verification
        if (!config.isNiche && config.query && config.query !== "") {
          const cleanQuery = config.query.toLowerCase().trim();
          const queryWords = cleanQuery.split(/[\s-_]+/);
          const decodedUrl = decodeURIComponent(url).toLowerCase();
          const isSearchUrl = decodedUrl.includes('/search') || decodedUrl.includes('search_text=') || decodedUrl.includes('search=');
          const containsQuery = queryWords.every(word => decodedUrl.includes(word));

          if (!isSearchUrl || !containsQuery) {
            console.log(`Ignoring auth capture for unrelated search API: ${url} (expected search: ${cleanQuery})`);
            return;
          }
        }

        // Popular/Trending feed verification
        if (!config.query || config.query === "") {
          if (lowerUrl.includes('/niches/') || lowerUrl.includes('/users/') || lowerUrl.includes('/me/') || lowerUrl.includes('/favorites') || lowerUrl.includes('/bookmarks')) {
            console.log(`Ignoring auth capture for unrelated feed API: ${url}`);
            return;
          }
        }

        console.log(`Accepted auth capture for target feed URL: ${url}`);
        window._hasFetchedPageDirectly = true; // prevent duplicate fetches
        fetchPageDirectly(url, token, page);
      }
    });
  }

  // Handle intercepted niches catalog data
  if (event.data.type === "REDGIFS_INTERCEPTED_NICHES") {
    const rawNiches = event.data.niches;
    if (rawNiches && rawNiches.length > 0) {
      const formatted = [];
      rawNiches.forEach(item => {
        let tag = item.id || item.tag || item.name || "";
        let label = item.name || item.label || item.id || "";

        if (tag && typeof tag === 'string') {
          tag = tag.toLowerCase().replace('/niches/', '').trim();
          if (tag && tag !== 'niches' && tag !== 'popular') {
            formatted.push({ tag, label });
          }
        }
      });

      if (formatted.length > 0) {
        chrome.runtime.sendMessage({
          action: "NICHES_CAPTURED",
          niches: formatted
        });
      }
    }
  }
});

// Helper to fetch page programmatically using guest credentials
async function fetchPageDirectly(baseUrl, token, targetPage) {
  try {
    const urlObj = new URL(baseUrl);

    // Set page-based parameter to request the correct page and delete conflicting offset params
    urlObj.searchParams.set('page', targetPage);
    urlObj.searchParams.delete('start');

    console.log(`Programmatically fetching page ${targetPage} from RedGifs API: ${urlObj.href}`);

    const headers = {
      'Accept': 'application/json'
    };
    if (token) {
      headers['Authorization'] = token;
    }

    const res = await fetch(urlObj.href, { headers });
    const data = await res.json();

    // Send the captured data back to main world to extract and process, passing the correct URL
    window.postMessage({
      type: "REDGIFS_FORCE_PROCESS_DATA",
      data: data,
      url: urlObj.href
    }, "*");

    // Send complete signal after a short delay
    setTimeout(() => {
      chrome.runtime.sendMessage({
        action: "SCRAPE_COMPLETE",
        videos: []
      });
    }, 1500);
  } catch (err) {
    console.error("Error programmatically fetching page:", err);
  }
}

// Helper to hide existing videos from DOM to force layout updates
function hideExistingVideosFromDOM(excludeIds) {
  if (!excludeIds || excludeIds.length === 0) return;

  excludeIds.forEach(id => {
    // Selector to match video links or elements containing the ID
    const selector = `a[href*="/watch/${id}"], a[href*="/gifs/detail/${id}"]`;
    const links = document.querySelectorAll(selector);
    links.forEach(link => {
      // Find the closest grid card element and hide/remove it
      const card = link.closest('.gif-card, .grid-item, [class*="card"], [class*="item"]');
      if (card) {
        card.style.display = 'none';
        card.remove(); // Remove completely from layout to shrink page height
      }
    });
  });
}

// 2. Perform DOM Scraping for videos (Fallback)
function scrapeDOM() {
  if (window._hasInterceptedNetworkData) {
    return; // Skip DOM scraping fallback completely if network hook is working!
  }
  const domVideos = [];
  const videoElements = document.querySelectorAll("video");

  videoElements.forEach(video => {
    let src = video.src;
    if (!src) {
      const sourceEl = video.querySelector("source");
      if (sourceEl) src = sourceEl.src;
    }

    if (src) {
      // Extract ID from video source (typically thumbs2.redgifs.com/Id-mobile.mp4)
      let id = "";
      const match = src.match(/redgifs\.com\/([a-zA-Z0-9-]+?)(?:-mobile|-large)?\.mp4/);

      if (match) {
        id = match[1];
      } else {
        const filename = src.split('/').pop().split('?')[0];
        id = filename.replace('-mobile.mp4', '').replace('-large.mp4', '').replace('.mp4', '');
      }

      if (id && !processedIds.has(id)) {
        processedIds.add(id);

        let title = id.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        let watchUrl = `https://www.redgifs.com/watch/${id}`;

        const parentLink = video.closest("a");
        if (parentLink && parentLink.href) {
          watchUrl = parentLink.href;
        }

        domVideos.push({
          id: id,
          title: title,
          src: src,
          srcSd: src,
          poster: video.poster || "",
          userName: "anonymous",
          views: 0,
          likes: 0,
          tags: [],
          watchUrl: watchUrl
        });
      }
    }
  });

  if (domVideos.length > 0) {
    chrome.runtime.sendMessage({
      action: "DATA_CAPTURED",
      videos: domVideos
    });
  }
}

// 3. Perform DOM Scraping for Niches catalog (Fallback)
function scrapeNichesDOM() {
  const domNiches = [];
  const links = document.querySelectorAll('a[href*="/niches/"]');

  links.forEach(link => {
    const href = link.getAttribute('href');
    const match = href.match(/\/niches\/([a-zA-Z0-9-]+)/);

    if (match) {
      const tag = match[1];
      if (tag && tag !== 'niches' && tag !== 'popular') {
        const label = link.innerText.trim() || tag.charAt(0).toUpperCase() + tag.slice(1);
        domNiches.push({ tag, label });
      }
    }
  });

  if (domNiches.length > 0) {
    chrome.runtime.sendMessage({
      action: "NICHES_CAPTURED",
      niches: domNiches
    });
  }
}

// 4. Coordinate scrolling and complete signal for videos
function startAutoScroller() {
  chrome.runtime.sendMessage({ action: "GET_SCRAPE_CONFIG" }, (config) => {
    const page = (config && config.page) || 1;
    let scrollCount = 0;
    let done = false;

    // Fewer scrolls, faster interval
    const maxScrolls = 2 + (page - 1) * 3;

    function finish() {
      if (done) return;
      done = true;
      clearInterval(scrollInterval);
      chrome.runtime.sendMessage({ action: "SCRAPE_COMPLETE", videos: [] });
    }

    hideExistingVideosFromDOM(window._excludeIds);
    scrapeDOM();

    // If network data arrives fast, complete after a short settle time
    const networkWatchdog = setInterval(() => {
      if (window._hasInterceptedNetworkData) {
        clearInterval(networkWatchdog);
        setTimeout(finish, 600);
      }
    }, 200);

    // Hard timeout fallback
    setTimeout(finish, 12000);

    const scrollInterval = setInterval(() => {
      if (done) { clearInterval(scrollInterval); return; }

      hideExistingVideosFromDOM(window._excludeIds);
      window.scrollBy(0, 2000);
      window.dispatchEvent(new Event('scroll'));
      document.dispatchEvent(new Event('scroll'));
      scrollCount++;
      scrapeDOM();

      if (scrollCount >= maxScrolls) finish();
    }, 400);
  });
}

// Coordinate Niches scraping flow
function startNichesScroller() {
  chrome.runtime.sendMessage({ action: "GET_SCRAPE_CONFIG" }, (config) => {
    const page = (config && config.page) || 1;
    console.log(`RedStream Niches Scraper starting. Page: ${page}`);

    let scrolls = 0;
    const targetScrolls = (page - 1) * 3;

    if (targetScrolls > 0) {
      scrapeNichesDOM();

      const scrollInterval = setInterval(() => {
        window.scrollBy(0, 1000);
        scrolls++;
        scrapeNichesDOM();

        if (scrolls >= targetScrolls) {
          clearInterval(scrollInterval);
          setTimeout(() => {
            scrapeNichesDOM();
            chrome.runtime.sendMessage({
              action: "SCRAPE_NICHES_COMPLETE"
            });
          }, 1000);
        }
      }, 1000);
    } else {
      // Page 1: wait 3 seconds for initial render and scrape
      setTimeout(() => {
        scrapeNichesDOM();
        chrome.runtime.sendMessage({
          action: "SCRAPE_NICHES_COMPLETE"
        });
      }, 3000);
    }
  });
}

// Main execution switch on DOM Ready
function init() {
  chrome.runtime.sendMessage({ action: "GET_SCRAPE_CONFIG" }, (config) => {
    if (config && config.excludeIds) {
      window._excludeIds = config.excludeIds;
      // Add all loaded IDs to processedIds to filter them out from the results
      config.excludeIds.forEach(id => processedIds.add(id));
    }

    const pathname = window.location.pathname.replace(/\/$/, "");
    if (pathname === "/niches") {
      startNichesScroller();
    } else {
      startAutoScroller();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
