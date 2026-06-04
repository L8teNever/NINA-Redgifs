// Injected Page Script (Runs in the MAIN world context of RedGifs)
(function() {
  console.log("RedStream main world hook loaded");

  // Helper to find the token in localStorage
  function getTokenFromLocalStorage() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key);
        if (val && typeof val === 'string') {
          if (val.startsWith('Bearer ')) {
            return val;
          }
          if (val.startsWith('eyJ')) {
            return 'Bearer ' + val;
          }
          if (val.startsWith('{')) {
            try {
              const obj = JSON.parse(val);
              for (let k in obj) {
                if (typeof obj[k] === 'string' && obj[k].startsWith('eyJ')) {
                  return 'Bearer ' + obj[k];
                }
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
    return null;
  }

  // Listen for forced processing requests from isolated script
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "REDGIFS_FORCE_PROCESS_DATA") {
      processAndSend(event.data.data, event.data.url || "");
    }
  });

  // Helper to recursively extract GIF metadata from any JSON payload
  function extractGifsFromObject(obj, results = []) {
    if (!obj || typeof obj !== 'object') return results;
    
    // Check if the object matches RedGifs' GIF structure
    if (obj.id && obj.urls && (obj.urls.sd || obj.urls.hd || obj.urls.poster)) {
      if (!results.some(g => g.id === obj.id)) {
        // Build a cleaned metadata object
        let title = obj.title || obj.description || "";
        if (!title) {
          // Capitalize id as a fallback title
          title = obj.id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }

        results.push({
          id: obj.id,
          title: title,
          src: obj.urls.hd || obj.urls.sd || "",
          srcSd: obj.urls.sd || obj.urls.hd || "",
          poster: obj.urls.poster || obj.urls.thumbnail || "",
          userName: obj.userName || obj.creator || "anonymous",
          views: obj.views || 0,
          likes: obj.likes || 0,
          tags: obj.tags || [],
          watchUrl: `https://www.redgifs.com/watch/${obj.id}`
        });
      }
      return results;
    }
    
    // Recurse through arrays and sub-objects
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          extractGifsFromObject(obj[key], results);
        }
      }
    }
    return results;
  }

  // Process video data and post to isolated world
  function processAndSend(data, url = "") {
    try {
      const extracted = extractGifsFromObject(data);
      if (extracted && extracted.length > 0) {
        console.log(`RedStream hook intercepted ${extracted.length} video(s) for URL: ${url}`);
        window.postMessage({
          type: "REDGIFS_INTERCEPTED_DATA",
          videos: extracted,
          url: url
        }, "*");
      }
    } catch (err) {
      console.error("Error parsing intercepted data:", err);
    }
  }

  // Process niches data and post to isolated world
  function processNichesAndSend(data) {
    try {
      let nichesList = [];
      if (data && typeof data === 'object') {
        if (data.niches) nichesList = data.niches;
        else if (data.tags) nichesList = data.tags;
        else if (Array.isArray(data)) nichesList = data;
        else if (data.items) nichesList = data.items;
      }
      
      if (nichesList && nichesList.length > 0) {
        console.log(`RedStream hook intercepted ${nichesList.length} niche(s)`);
        window.postMessage({
          type: "REDGIFS_INTERCEPTED_NICHES",
          niches: nichesList
        }, "*");
      }
    } catch (err) {
      console.error("Error parsing intercepted niches:", err);
    }
  }

  // 1. Hook Fetch API
  const originalFetch = window.fetch;
  
  async function getTemporaryToken() {
    try {
      const resp = await originalFetch('https://api.redgifs.com/v2/auth/temporary');
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.token) {
          return 'Bearer ' + data.token;
        }
      }
    } catch (e) {}
    return null;
  }

  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' 
        ? args[0] 
        : (args[0] instanceof URL ? args[0].href : (args[0] && args[0].url));
      
      if (url) {
        // Extract Authorization header if present
        let authHeader = null;
        if (args[1] && args[1].headers) {
          const headers = args[1].headers;
          if (typeof headers.get === 'function') {
            authHeader = headers.get('Authorization') || headers.get('authorization');
          } else if (typeof headers === 'object') {
            authHeader = headers['Authorization'] || headers['authorization'];
          }
        }

        // Fallback 1: localStorage
        if (!authHeader) {
          authHeader = getTokenFromLocalStorage();
        }

        // Fallback 2: Fetch temporary token
        if (!authHeader) {
          authHeader = await getTemporaryToken();
        }

        let isVideoFeed = false;
        const isAdOrSponsored = url.includes('/sponsored') || url.includes('/ads') || url.includes('/promoted');
        if (!isAdOrSponsored) {
          if (url.includes('/niches') && url.includes('/gifs')) {
            isVideoFeed = true;
          } else if (url.includes('api.redgifs.com') || url.includes('/gifs') || url.includes('/posts') || url.includes('/search')) {
            if (!url.includes('/niches')) {
              isVideoFeed = true;
            }
          }
        }

        if (isVideoFeed) {
          const clone = response.clone();
          clone.json().then(data => {
            processAndSend(data, url);
            if (authHeader) {
              window.postMessage({
                type: "REDGIFS_AUTH_CAPTURED",
                token: authHeader,
                url: url
              }, "*");
            }
          }).catch(() => {});
        } else if (url.includes('/niches') || url.includes('/tags') || url.includes('/categories')) {
          const clone = response.clone();
          clone.json().then(data => {
            processNichesAndSend(data);
          }).catch(() => {});
        }
      }
    } catch (e) {
      // Fail silently to not impact page functionality
    }
    return response;
  };

  // 2. Hook XMLHttpRequest (as fallback for older calls)
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (header && header.toLowerCase() === 'authorization') {
      this._authHeader = value;
    }
    return originalSetRequestHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', () => {
      try {
        if (this._url) {
          let isVideoFeed = false;
          const isAdOrSponsored = this._url.includes('/sponsored') || this._url.includes('/ads') || this._url.includes('/promoted');
          if (!isAdOrSponsored) {
            if (this._url.includes('/niches') && this._url.includes('/gifs')) {
              isVideoFeed = true;
            } else if (this._url.includes('api.redgifs.com') || this._url.includes('/gifs') || this._url.includes('/posts') || this._url.includes('/search')) {
              if (!this._url.includes('/niches')) {
                isVideoFeed = true;
              }
            }
          }

          if (isVideoFeed) {
            const data = JSON.parse(this.responseText);
            processAndSend(data, this._url);
            
            let authHeader = this._authHeader || getTokenFromLocalStorage();
            if (authHeader) {
              window.postMessage({
                type: "REDGIFS_AUTH_CAPTURED",
                token: authHeader,
                url: this._url
              }, "*");
            }
          } else if (this._url.includes('/niches') || this._url.includes('/tags') || this._url.includes('/categories')) {
            const data = JSON.parse(this.responseText);
            processNichesAndSend(data);
          }
        }
      } catch (e) {
        // Fail silently
      }
    });
    return originalSend.apply(this, arguments);
  };
})();
