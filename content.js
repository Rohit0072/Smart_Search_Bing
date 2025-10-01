let isScrolling = false;
let scrollInterval = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startScrolling') {
    if (!isScrolling) {
      startHumanLikeScrolling(request.duration);
      sendResponse({ status: 'started' });
    } else {
      sendResponse({ status: 'already_scrolling' });
    }
  } else if (request.action === 'stopScrolling') {
    stopScrolling();
    sendResponse({ status: 'stopped' });
  }
  return true;
});

function startHumanLikeScrolling(duration) {
  isScrolling = true;
  const startTime = Date.now();
  const endTime = startTime + duration;
  
  let direction = 1;
  let scrollSpeed = getRandomScrollSpeed();
  let pauseUntil = 0;
  
  scrollInterval = setInterval(() => {
    const now = Date.now();
    
    if (now >= endTime) {
      stopScrolling();
      return;
    }
    
    if (now < pauseUntil) {
      return;
    }
    
    const scrollAmount = scrollSpeed * direction;
    window.scrollBy(0, scrollAmount);
    
    if (Math.random() < 0.15) {
      direction *= -1;
      scrollSpeed = getRandomScrollSpeed();
    }
    
    if (Math.random() < 0.08) {
      pauseUntil = now + getRandomPause();
    }
    
    if (Math.random() < 0.05) {
      scrollSpeed = getRandomScrollSpeed();
    }
    
    const scrollPosition = window.pageYOffset;
    const documentHeight = document.documentElement.scrollHeight;
    const windowHeight = window.innerHeight;
    
    if (scrollPosition + windowHeight >= documentHeight - 10) {
      direction = -1;
      scrollSpeed = getRandomScrollSpeed();
    }
    
    if (scrollPosition <= 10 && direction === -1) {
      direction = 1;
      scrollSpeed = getRandomScrollSpeed();
    }
    
  }, 50);
}

function stopScrolling() {
  isScrolling = false;
  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
  }
}

function getRandomScrollSpeed() {
  return Math.floor(Math.random() * 15) + 5;
}

function getRandomPause() {
  return Math.floor(Math.random() * 1500) + 500;
}

window.addEventListener('beforeunload', () => {
  stopScrolling();
});
