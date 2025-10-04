// Background script for Smart Search Automator

// Global variables for automation state
let isRunning = false;
let automationTabId = null;
let currentSearchIndex = 0;
let totalSearches = 0;
let searchQueries = [];
let automationInterval = null;
let scheduledAlarmName = 'daily-search-alarm';
let stopRequested = false; // Flag to track if stop was requested

// Listen for messages from popup script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startAutomation':
      startAutomation(message.searchCount, message.selectedTags, message.apiKey)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep the message channel open for async response
      
    case 'stopAutomation':
      stopAutomation()
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'getStatus':
      sendResponse({
        isRunning,
        currentSearchIndex,
        totalSearches
      });
      break;
      
    case 'scheduleSearch':
      scheduleSearch(message.time)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'cancelSchedule':
      cancelSchedule()
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'debugCurrentTab':
      debugCurrentTab()
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
  }
});

// Start automation function
async function startAutomation(searchCount, selectedTags, apiKey) {
  try {
    if (isRunning) {
      return { success: false, error: 'Automation is already running' };
    }
    
    // Reset state
    isRunning = true;
    stopRequested = false; // Reset stop flag
    currentSearchIndex = 0;
    totalSearches = searchCount;
    
    // Notify popup that automation has started
    notifyPopup({
      type: 'automationStarted',
      data: { searchCount, selectedTags }
    });
    
    // Generate search queries using Gemini API
    try {
      searchQueries = await generateSearchQueries(selectedTags, searchCount, apiKey);
      
      if (!searchQueries || searchQueries.length === 0) {
        throw new Error('Failed to generate search queries');
      }
      
      notifyPopup({
        type: 'queriesGenerated',
        data: { count: searchQueries.length }
      });
      
      // Start executing searches
      executeSearches();
      
      return { success: true };
    } catch (error) {
      isRunning = false;
      notifyPopup({
        type: 'automationError',
        data: { message: error.message }
      });
      return { success: false, error: error.message };
    }
  } catch (error) {
    isRunning = false;
    return { success: false, error: error.message };
  }
}

// Stop automation function - This is the key function to fix the issue
async function stopAutomation() {
  try {
    if (!isRunning) {
      return { success: false, error: 'No automation is currently running' };
    }
    
    // Set the stop flag
    stopRequested = true;
    
    // Clear any pending intervals
    if (automationInterval) {
      clearInterval(automationInterval);
      automationInterval = null;
    }
    
    // Close the automation tab if it exists
    if (automationTabId) {
      try {
        await chrome.tabs.remove(automationTabId);
        automationTabId = null;
      } catch (error) {
        console.log('Error closing tab:', error);
        // Tab might already be closed, continue with cleanup
      }
    }
    
    // Reset state
    isRunning = false;
    currentSearchIndex = 0;
    totalSearches = 0;
    searchQueries = [];
    
    // Notify popup that automation has stopped
    notifyPopup({
      type: 'automationStopped'
    });
    
    return { success: true };
  } catch (error) {
    // Even if there's an error, try to reset the state
    isRunning = false;
    stopRequested = true; // Make sure stop flag is set
    currentSearchIndex = 0;
    totalSearches = 0;
    searchQueries = [];
    
    if (automationInterval) {
      clearInterval(automationInterval);
      automationInterval = null;
    }
    
    if (automationTabId) {
      try {
        await chrome.tabs.remove(automationTabId);
        automationTabId = null;
      } catch (tabError) {
        console.log('Error closing tab during error handling:', tabError);
      }
    }
    
    notifyPopup({
      type: 'automationStopped'
    });
    
    return { success: true }; // Return success even if there was an error, as the goal is to stop
  }
}

// Execute searches function
async function executeSearches() {
  if (!isRunning || searchQueries.length === 0) {
    return;
  }
  
  try {
    // Create a new tab for Bing search
    const tab = await chrome.tabs.create({
      url: 'https://www.bing.com',
      active: false
    });
    
    automationTabId = tab.id;
    
    // Wait for the tab to load
    await waitForTabToLoad(tab.id);
    
    // Process each search query
    for (let i = currentSearchIndex; i < searchQueries.length; i++) {
      // Check if stop was requested
      if (stopRequested || !isRunning) {
        console.log('Stop requested, breaking out of search loop');
        break;
      }
      
      currentSearchIndex = i + 1;
      
      try {
        // Execute the search
        await executeSearch(tab.id, searchQueries[i]);
        
        // Check if stop was requested during the search
        if (stopRequested || !isRunning) {
          console.log('Stop requested during search, breaking out of search loop');
          break;
        }
        
        // Notify popup of progress
        const progress = (currentSearchIndex / totalSearches) * 100;
        notifyPopup({
          type: 'searchProgress',
          data: {
            progress,
            current: currentSearchIndex,
            total: totalSearches,
            query: searchQueries[i]
          }
        });
        
        // Wait between searches
        await sleep(getRandomDelay(5000, 10000));
        
        // Check if stop was requested during the wait
        if (stopRequested || !isRunning) {
          console.log('Stop requested during wait, breaking out of search loop');
          break;
        }
        
        // Notify popup of completion - This is where we increment the count
        notifyPopup({
          type: 'searchCompleted',
          data: {
            current: currentSearchIndex,
            total: totalSearches,
            query: searchQueries[i]
          }
        });
        
        // Also increment the daily count from background
        incrementDailySearchCountInBackground();
        
      } catch (error) {
        console.error('Error executing search:', error);
        
        // Notify popup of error
        notifyPopup({
          type: 'searchError',
          data: {
            current: currentSearchIndex,
            total: totalSearches,
            error: error.message
          }
        });
        
        // Continue with next search even if one fails
        continue;
      }
    }
    
    // Close the tab when done
    if (automationTabId) {
      try {
        await chrome.tabs.remove(automationTabId);
        automationTabId = null;
      } catch (error) {
        console.log('Error closing tab after completion:', error);
      }
    }
    
    // Only notify completion if stop wasn't requested
    if (!stopRequested && isRunning) {
      // Notify popup of completion
      notifyPopup({
        type: 'automationCompleted',
        data: {
          executed: currentSearchIndex,
          total: totalSearches
        }
      });
      
      // Reset state
      isRunning = false;
      currentSearchIndex = 0;
      totalSearches = 0;
      searchQueries = [];
    } else {
      // If stop was requested, notify that it was stopped
      notifyPopup({
        type: 'automationStopped'
      });
      
      // Reset state
      isRunning = false;
      currentSearchIndex = 0;
      totalSearches = 0;
      searchQueries = [];
    }
  } catch (error) {
    console.error('Error in executeSearches:', error);
    
    // Clean up on error
    if (automationTabId) {
      try {
        await chrome.tabs.remove(automationTabId);
        automationTabId = null;
      } catch (tabError) {
        console.log('Error closing tab during error handling:', tabError);
      }
    }
    
    // Notify popup of error
    notifyPopup({
      type: 'automationError',
      data: { message: error.message }
    });
    
    // Reset state
    isRunning = false;
    currentSearchIndex = 0;
    totalSearches = 0;
    searchQueries = [];
  }
}

// Function to increment daily search count from background
function incrementDailySearchCountInBackground() {
  const today = new Date().toDateString();
  
  chrome.storage.local.get(['dailyStats'], (result) => {
    let dailyStats = result.dailyStats || {};
    
    // Reset if it's a new day
    if (dailyStats.date !== today) {
      dailyStats = {
        date: today,
        searchCount: 0,
        completed: false
      };
    }
    
    // Increment count
    dailyStats.searchCount = (dailyStats.searchCount || 0) + 1;
    
    // Save
    chrome.storage.local.set({ dailyStats }, () => {
      console.log('Background: Daily search count incremented to:', dailyStats.searchCount);
    });
  });
}

// Execute a single search
async function executeSearch(tabId, query) {
  return new Promise((resolve, reject) => {
    // Inject content script to perform the search
    chrome.scripting.executeScript({
      target: { tabId },
      func: performSearch,
      args: [query]
    }, (results) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (results && results[0] && results[0].success) {
        resolve(results[0].result);
      } else {
        reject(new Error(results[0] ? results[0].error : 'Unknown error'));
      }
    });
  });
}

// Function to be injected into the page
function performSearch(query) {
  return new Promise((resolve, reject) => {
    try {
      // Find the search box
      const searchBox = document.querySelector('input[name="q"]');
      if (!searchBox) {
        reject({ success: false, error: 'Search box not found' });
        return;
      }
      
      // Clear the search box
      searchBox.value = '';
      
      // Type the query with human-like delays
      let charIndex = 0;
      const typeInterval = setInterval(() => {
        if (charIndex < query.length) {
          searchBox.value += query[charIndex];
          charIndex++;
        } else {
          clearInterval(typeInterval);
          
          // Trigger input event
          searchBox.dispatchEvent(new Event('input', { bubbles: true }));
          
          // Wait a bit before submitting
          setTimeout(() => {
            // Find and click the search button
            const searchButton = document.querySelector('button[type="submit"], .search_icon_svg, input[type="submit"]');
            if (searchButton) {
              searchButton.click();
              resolve({ success: true, result: 'Search submitted' });
            } else {
              // Fallback: submit the form
              const form = searchBox.closest('form');
              if (form) {
                form.submit();
                resolve({ success: true, result: 'Form submitted' });
              } else {
                reject({ success: false, error: 'Search button not found' });
              }
            }
          }, 500);
        }
      }, 50 + Math.random() * 100); // Random typing speed
    } catch (error) {
      reject({ success: false, error: error.message });
    }
  });
}

// Generate search queries using Gemini API
async function generateSearchQueries(tags, count, apiKey) {
  try {
    const prompt = `Generate ${count} unique search queries related to the following topics: ${tags.join(', ')}. 
    Each query should be realistic and varied. Return the results as a JSON array of strings.`;
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid API response');
    }
    
    const text = data.candidates[0].content.parts[0].text;
    
    // Try to parse the response as JSON
    try {
      const queries = JSON.parse(text);
      if (Array.isArray(queries) && queries.length > 0) {
        return queries;
      }
    } catch (parseError) {
      // If parsing fails, try to extract queries from the text
      const lines = text.split('\n').filter(line => line.trim());
      return lines;
    }
    
    throw new Error('No valid queries found in API response');
  } catch (error) {
    console.error('Error generating search queries:', error);
    throw error;
  }
}

// Schedule daily search
async function scheduleSearch(time) {
  try {
    // Parse the time (HH:MM format)
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create a date for today at the specified time
    const scheduledDate = new Date();
    scheduledDate.setHours(hours, minutes, 0, 0);
    
    // If the time has already passed today, schedule for tomorrow
    if (scheduledDate <= new Date()) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }
    
    // Calculate the delay in milliseconds
    const delay = scheduledDate.getTime() - Date.now();
    
    // Clear any existing alarm
    chrome.alarms.clear(scheduledAlarmName);
    
    // Create a new alarm
    chrome.alarms.create(scheduledAlarmName, {
      delayInMinutes: delay / 60000,
      periodInMinutes: 24 * 60 // Repeat daily
    });
    
    // Save the scheduled time to storage
    chrome.storage.local.set({ scheduledTime: time });
    
    return { success: true };
  } catch (error) {
    console.error('Error scheduling search:', error);
    return { success: false, error: error.message };
  }
}

// Cancel scheduled search
async function cancelSchedule() {
  try {
    // Clear the alarm
    chrome.alarms.clear(scheduledAlarmName);
    
    // Remove the scheduled time from storage
    chrome.storage.local.remove(['scheduledTime']);
    
    return { success: true };
  } catch (error) {
    console.error('Error canceling schedule:', error);
    return { success: false, error: error.message };
  }
}

// Handle alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === scheduledAlarmName) {
    // Get the saved settings
    chrome.storage.local.get(['searchCount', 'selectedTags', 'apiKey'], (result) => {
      if (result.searchCount && result.selectedTags && result.apiKey) {
        // Start the automation
        startAutomation(result.searchCount, result.selectedTags, result.apiKey);
        
        // Notify the popup
        notifyPopup({
          type: 'scheduledSearchStarted',
          data: { time: new Date().toLocaleTimeString() }
        });
      }
    });
  }
});

// Debug current tab
async function debugCurrentTab() {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      return { success: false, error: 'No active tab found' };
    }
    
    // Inject debug script
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: debugPage
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error debugging tab:', error);
    return { success: false, error: error.message };
  }
}

// Debug function to be injected into the page
function debugPage() {
  console.log('=== Smart Search Automator Debug Info ===');
  console.log('URL:', window.location.href);
  console.log('Title:', document.title);
  
  // Check for search box
  const searchBox = document.querySelector('input[name="q"]');
  console.log('Search box found:', !!searchBox);
  if (searchBox) {
    console.log('Search box ID:', searchBox.id);
    console.log('Search box class:', searchBox.className);
  }
  
  // Check for search button
  const searchButton = document.querySelector('button[type="submit"], .search_icon_svg, input[type="submit"]');
  console.log('Search button found:', !!searchButton);
  if (searchButton) {
    console.log('Search button ID:', searchButton.id);
    console.log('Search button class:', searchButton.className);
  }
  
  // Check for form
  const form = document.querySelector('form');
  console.log('Form found:', !!form);
  if (form) {
    console.log('Form ID:', form.id);
    console.log('Form class:', form.className);
  }
  
  console.log('=== End Debug Info ===');
}

// Helper functions
function notifyPopup(message) {
  // Try to send message to popup
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup might be closed, ignore error
  });
}

function waitForTabToLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
    
    // Set a timeout in case the tab is already loaded
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 3000);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Smart Search Automator installed');
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  // Check if there's a scheduled search
  chrome.storage.local.get(['scheduledTime'], (result) => {
    if (result.scheduledTime) {
      scheduleSearch(result.scheduledTime);
    }
  });
});