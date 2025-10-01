chrome.runtime.onInstalled.addListener(() => {
  console.log('Smart Search Automator installed');
  
  chrome.storage.local.get(['scrollDuration'], (result) => {
    if (!result.scrollDuration) {
      chrome.storage.local.set({ scrollDuration: 15 });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'log') {
    console.log(`[Content Script]: ${request.message}`);
  }
  
  sendResponse({ received: true });
  return true;
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log(`Tab ${tabId} closed`);
});
