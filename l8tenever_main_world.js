(function() {
  console.log("RedStream main world optimization script loaded.");
  
  // 1. Hook removeAttribute to prevent the page from unloading adjacent videos
  const originalRemoveAttribute = HTMLVideoElement.prototype.removeAttribute;
  HTMLVideoElement.prototype.removeAttribute = function(attr) {
    if (attr === 'src') {
      const card = this.closest('.video-card');
      if (card) {
        const activeCard = document.querySelector('.video-card[data-active="true"]');
        if (activeCard) {
          const currentIndex = parseInt(activeCard.getAttribute('data-index'));
          const cardIndex = parseInt(card.getAttribute('data-index'));
          // Keep source for up to 3 cards distance (both ahead and behind) to preserve buffers
          if (Math.abs(cardIndex - currentIndex) <= 3) {
            return; 
          }
        }
      }
    }
    return originalRemoveAttribute.apply(this, arguments);
  };

  // 2. Preload the current and next 2 videos in the background EAGERLY
  function preloadNextVideos() {
    let currentIndex = 0;
    const activeCard = document.querySelector('.video-card[data-active="true"]');
    if (activeCard) {
      currentIndex = parseInt(activeCard.getAttribute('data-index')) || 0;
    } else {
      // Find card closest to top of viewport
      const cards = document.querySelectorAll('.video-card');
      let minDiff = Infinity;
      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const diff = Math.abs(rect.top);
        if (diff < minDiff) {
          minDiff = diff;
          currentIndex = index;
        }
      });
    }

    // Preload index 0 (current) and next 2 videos (index+1, index+2)
    for (let i = 0; i <= 2; i++) {
      const targetIndex = currentIndex + i;
      const card = document.querySelector('.video-card[data-index="' + targetIndex + '"]');
      if (card) {
        const v = card.querySelector('video');
        if (v && !v.src && v.dataset.src) {
          v.src = v.dataset.src;
          v.preload = 'auto';
          v.load();
          
          // Mute and play-then-pause to force the browser to decode and show the first frame
          v.muted = true;
          const playPromise = v.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              v.pause();
            }).catch(function(e) {
              console.log("[RedStream] Preload play blocked/failed: " + e.message);
            });
          }
          
          console.log("[RedStream] Actively preloading & decoding video index: " + targetIndex);
        }
      }
    }
  }

  // Attach listeners to trigger prebuffering
  document.addEventListener('scroll', preloadNextVideos, true);
  setInterval(preloadNextVideos, 500);
  // Run immediately on injection
  setTimeout(preloadNextVideos, 200);
})();
