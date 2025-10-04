let selectedTags = [];
let scheduledTime = null;
let scheduleInterval = null;
let currentTheme = 'light';

// Wait for DOM to be fully loaded before accessing elements
document.addEventListener('DOMContentLoaded', () => {
  // Check if elements exist before adding event listeners
  const elements = {
    searchCount: document.getElementById('searchCount'),
    runBtn: document.getElementById('runBtn'),
    stopBtn: document.getElementById('stopBtn'),
    logTerminal: document.getElementById('logTerminal'),
    clearLogBtn: document.getElementById('clearLogBtn'),
    statusText: document.getElementById('statusText'),
    progressFill: document.getElementById('progressFill'),
    settingsBtn: document.getElementById('settingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    mainPanel: document.getElementById('mainPanel'),
    settingsPanel: document.getElementById('settingsPanel'),
    scrollDuration: document.getElementById('scrollDuration'),
    apiKey: document.getElementById('apiKey'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    debugBtn: document.getElementById('debugBtn'),
    scheduleTime: document.getElementById('scheduleTime'),
    scheduleBtn: document.getElementById('scheduleBtn'),
    cancelScheduleBtn: document.getElementById('cancelScheduleBtn'),
    scheduleStatus: document.getElementById('scheduleStatus'),
    themeOptions: document.querySelectorAll('.theme-option'),
    themeRadios: document.querySelectorAll('input[name="theme"]'),
    // Daily status elements
    todaySearchStatus: document.getElementById('todaySearchStatus'),
    todaySearchCount: document.getElementById('todaySearchCount'),
    scheduledSearchStatus: document.getElementById('scheduledSearchStatus'),
    scheduledTimeDisplay: document.getElementById('scheduledTimeDisplay')
  };

  // Only add event listeners if elements exist
  if (elements.runBtn) {
    elements.runBtn.addEventListener('click', startAutomation);
  }
  
  if (elements.stopBtn) {
    elements.stopBtn.addEventListener('click', stopAutomation);
  }
  
  if (elements.clearLogBtn) {
    elements.clearLogBtn.addEventListener('click', clearLog);
  }
  
  if (elements.settingsBtn) {
    elements.settingsBtn.addEventListener('click', openSettings);
  }
  
  if (elements.closeSettingsBtn) {
    elements.closeSettingsBtn.addEventListener('click', closeSettings);
  }
  
  if (elements.saveSettingsBtn) {
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
  }
  
  if (elements.debugBtn) {
    elements.debugBtn.addEventListener('click', debugCurrentTab);
  }
  
  if (elements.scheduleBtn) {
    elements.scheduleBtn.addEventListener('click', scheduleSearch);
  }
  
  if (elements.cancelScheduleBtn) {
    elements.cancelScheduleBtn.addEventListener('click', cancelSchedule);
  }
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
  
  // Initialize UI and load settings
  initializeUI();
  loadSettings();
  checkBackgroundStatus();
  loadScheduleStatus();
  updateDailyStatus(); // Load daily status
});

function initializeUI() {
  const tags = document.querySelectorAll('.tag');
  tags.forEach(tag => {
    tag.addEventListener('click', () => toggleTag(tag));
  });
  
  // Initialize theme selector
  initializeThemeSelector();
}

// Add theme selector initialization function
function initializeThemeSelector() {
  const themeOptions = document.querySelectorAll('.theme-option');
  themeOptions.forEach(option => {
    option.addEventListener('click', () => {
      const theme = option.dataset.theme;
      applyTheme(theme);
      
      // Update selected state
      themeOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      
      // Update radio button
      document.getElementById(`theme-${theme}`).checked = true;
      
      // Save theme setting
      chrome.storage.local.set({ theme: theme });
    });
  });
}

// Add apply theme function
function applyTheme(theme) {
  // Remove all theme classes
  document.body.classList.remove('dark-theme', 'blue-theme', 'green-theme', 'purple-theme');
  
  // Add new theme class (if not default light theme)
  if (theme !== 'light') {
    document.body.classList.add(`${theme}-theme`);
  }
  
  currentTheme = theme;
}

function handleBackgroundMessage(message) {
  switch (message.type) {
    case 'automationStarted':
      log(`Starting automation: ${message.data.searchCount} searches with tags [${message.data.selectedTags.join(', ')}]`, 'info');
      updateStatus(`Generating ${message.data.searchCount} unique search queries...`);
      break;
      
    case 'queriesGenerated':
      log(`Generated ${message.data.count} search queries`, 'success');
      break;
      
    case 'searchProgress':
      updateProgress(message.data.progress);
      updateStatus(`Executing search ${message.data.current}/${message.data.total}`);
      log(`[${message.data.current}/${message.data.total}] Typing and searching: "${message.data.query}"`, 'info');
      break;
      
    case 'searchCompleted':
      log(`[${message.data.current}/${message.data.total}] Completed: "${message.data.query}"`, 'success');
      // Update daily search count
      incrementDailySearchCount();
      break;
      
    case 'searchError':
      log(`[${message.data.current}/${message.data.total}] Error: ${message.data.error}`, 'error');
      break;
      
    case 'automationCompleted':
      log(`Automation completed! Executed ${message.data.executed}/${message.data.total} searches`, 'success');
      updateStatus('Completed');
      updateProgress(100);
      resetUI();
      // Mark today's search as completed if all searches were successful
      if (message.data.executed >= message.data.total) {
        markTodaySearchCompleted();
      }
      break;
      
    case 'automationStopped':
      log('Automation stopped by user', 'warning');
      updateStatus('Stopped');
      updateProgress(0);
      resetUI();
      break;
      
    case 'automationError':
      log(`Error: ${message.data.message}`, 'error');
      resetUI();
      break;
      
    case 'scheduledSearchStarted':
      log(`Scheduled search started at ${message.data.time}`, 'info');
      break;
      
    case 'scheduledSearchCompleted':
      log(`Scheduled search completed at ${message.data.time}`, 'success');
      markTodaySearchCompleted();
      break;
  }
}

function checkBackgroundStatus() {
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response && response.isRunning) {
      // Automation is running in background, update UI
      const runBtn = document.getElementById('runBtn');
      const stopBtn = document.getElementById('stopBtn');
      const statusText = document.getElementById('statusText');
      const progressFill = document.getElementById('progressFill');
      
      if (runBtn) runBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;
      if (statusText) updateStatus(`Executing search ${response.currentSearchIndex}/${response.totalSearches}`);
      if (progressFill) updateProgress((response.currentSearchIndex / response.totalSearches) * 100);
      log('Automation is running in background', 'info');
    }
  });
}

function loadScheduleStatus() {
  chrome.storage.local.get(['scheduledTime'], (result) => {
    if (result.scheduledTime) {
      scheduledTime = result.scheduledTime;
      updateScheduleUI(true);
      updateScheduleStatus();
    }
  });
}

// Daily status functions
function updateDailyStatus() {
  const today = new Date().toDateString();
  
  chrome.storage.local.get(['dailyStats'], (result) => {
    let dailyStats = result.dailyStats || {};
    
    // Check if we need to reset for a new day
    if (dailyStats.date !== today) {
      dailyStats = {
        date: today,
        searchCount: 0,
        completed: false
      };
      chrome.storage.local.set({ dailyStats });
    }
    
    // Update UI
    updateTodaySearchStatus(dailyStats);
  });
}

function updateTodaySearchStatus(dailyStats) {
  const todaySearchStatus = document.getElementById('todaySearchStatus');
  const todaySearchCount = document.getElementById('todaySearchCount');
  const scheduledSearchStatus = document.getElementById('scheduledSearchStatus');
  const scheduledTimeDisplay = document.getElementById('scheduledTimeDisplay');
  
  if (todaySearchStatus && todaySearchCount) {
    // Update search count
    const count = dailyStats.searchCount || 0;
    todaySearchCount.textContent = `${count} search${count !== 1 ? 'es' : ''}`;
    
    // Update status icon
    if (dailyStats.completed) {
      todaySearchStatus.className = 'status-icon completed';
      todaySearchStatus.innerHTML = '<i class="fas fa-check"></i>';
    } else if (count > 0) {
      todaySearchStatus.className = 'status-icon pending';
      todaySearchStatus.innerHTML = '<i class="fas fa-clock"></i>';
    } else {
      todaySearchStatus.className = 'status-icon incomplete';
      todaySearchStatus.innerHTML = '<i class="fas fa-times"></i>';
    }
  }
  
  // Update scheduled status
  if (scheduledSearchStatus && scheduledTimeDisplay) {
    chrome.storage.local.get(['scheduledTime'], (result) => {
      if (result.scheduledTime) {
        scheduledSearchStatus.className = 'status-icon pending';
        scheduledSearchStatus.innerHTML = '<i class="fas fa-clock"></i>';
        scheduledTimeDisplay.textContent = result.scheduledTime;
      } else {
        scheduledSearchStatus.className = 'status-icon incomplete';
        scheduledSearchStatus.innerHTML = '<i class="fas fa-times"></i>';
        scheduledTimeDisplay.textContent = 'Not set';
      }
    });
  }
}

function incrementDailySearchCount() {
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
    
    // Save and update UI
    chrome.storage.local.set({ dailyStats }, () => {
      updateTodaySearchStatus(dailyStats);
      console.log('Daily search count incremented to:', dailyStats.searchCount);
    });
  });
}

function markTodaySearchCompleted() {
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
    
    // Mark as completed
    dailyStats.completed = true;
    
    // Save and update UI
    chrome.storage.local.set({ dailyStats }, () => {
      updateTodaySearchStatus(dailyStats);
      console.log('Today\'s search marked as completed');
    });
  });
}

function scheduleSearch() {
  const scheduleTimeInput = document.getElementById('scheduleTime');
  if (!scheduleTimeInput) return;
  
  const time = scheduleTimeInput.value;
  if (!time) {
    log('Please select a time for scheduling', 'error');
    return;
  }
  
  // Get current settings
  const searchCount = document.getElementById('searchCount');
  const count = searchCount ? parseInt(searchCount.value) : 10;
  
  if (!count || count < 1 || count > 50) {
    log('Please enter a valid number of searches (1-50)', 'error');
    return;
  }

  if (selectedTags.length === 0) {
    log('Please select at least one topic tag', 'error');
    return;
  }

  chrome.storage.local.get(['apiKey'], (result) => {
    if (!result.apiKey || result.apiKey.trim() === '') {
      log('Please set your Gemini API key in settings', 'error');
      openSettings();
      return;
    }
    
    scheduledTime = time;
    
    // Save all settings to storage
    chrome.storage.local.set({ 
      scheduledTime: time,
      searchCount: count,
      selectedTags: selectedTags,
      apiKey: result.apiKey
    }, () => {
      // Send to background script
      chrome.runtime.sendMessage({
        action: 'scheduleSearch',
        time: time
      }, (response) => {
        if (response && response.success) {
          log(`Search scheduled for ${time} daily`, 'success');
          updateScheduleUI(true);
          updateScheduleStatus();
          updateDailyStatus(); // Update daily status to show scheduled time
        } else {
          log(`Error scheduling search: ${response ? response.error : 'Unknown error'}`, 'error');
        }
      });
    });
  });
}

function cancelSchedule() {
  scheduledTime = null;
  
  // Remove from storage
  chrome.storage.local.remove(['scheduledTime'], () => {
    // Send to background script
    chrome.runtime.sendMessage({
      action: 'cancelSchedule'
    }, (response) => {
      if (response && response.success) {
        log('Schedule cancelled', 'info');
        updateScheduleUI(false);
        updateScheduleStatus();
        updateDailyStatus(); // Update daily status to remove scheduled time
      } else {
        log(`Error cancelling schedule: ${response ? response.error : 'Unknown error'}`, 'error');
      }
    });
  });
}

function updateScheduleUI(isScheduled) {
  const scheduleBtn = document.getElementById('scheduleBtn');
  const cancelScheduleBtn = document.getElementById('cancelScheduleBtn');
  const scheduleTimeInput = document.getElementById('scheduleTime');
  
  if (scheduleBtn) {
    scheduleBtn.style.display = isScheduled ? 'none' : 'block';
  }
  
  if (cancelScheduleBtn) {
    cancelScheduleBtn.style.display = isScheduled ? 'block' : 'none';
  }
  
  if (scheduleTimeInput && scheduledTime) {
    scheduleTimeInput.value = scheduledTime;
  }
}

function updateScheduleStatus() {
  const scheduleStatus = document.getElementById('scheduleStatus');
  if (!scheduleStatus) return;
  
  if (scheduledTime) {
    const now = new Date();
    const [hours, minutes] = scheduledTime.split(':');
    const scheduledDate = new Date();
    scheduledDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    let timeUntil = '';
    if (scheduledDate > now) {
      const diff = scheduledDate - now;
      const hoursUntil = Math.floor(diff / (1000 * 60 * 60));
      const minutesUntil = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hoursUntil > 0) {
        timeUntil = `Next run in ${hoursUntil}h ${minutesUntil}m`;
      } else {
        timeUntil = `Next run in ${minutesUntil}m`;
      }
    } else {
      const tomorrow = new Date(scheduledDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const diff = tomorrow - now;
      const hoursUntil = Math.floor(diff / (1000 * 60 * 60));
      const minutesUntil = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hoursUntil > 0) {
        timeUntil = `Next run in ${hoursUntil}h ${minutesUntil}m`;
      } else {
        timeUntil = `Next run in ${minutesUntil}m`;
      }
    }
    
    scheduleStatus.textContent = `Scheduled for ${scheduledTime} daily. ${timeUntil}`;
    scheduleStatus.style.color = '#28a745';
  } else {
    scheduleStatus.textContent = 'No schedule set';
    scheduleStatus.style.color = '#666';
  }
}

function toggleTag(tagElement) {
  const tag = tagElement.dataset.tag;
  
  if (selectedTags.includes(tag)) {
    selectedTags = selectedTags.filter(t => t !== tag);
    tagElement.classList.remove('selected');
  } else {
    selectedTags.push(tag);
    tagElement.classList.add('selected');
  }
  
  // Save selected tags to storage immediately
  chrome.storage.local.set({ selectedTags: selectedTags });
  
  log(`Tag ${selectedTags.includes(tag) ? 'selected' : 'deselected'}: ${tag}`, 'info');
}

function openSettings() {
  const mainPanel = document.getElementById('mainPanel');
  const settingsPanel = document.getElementById('settingsPanel');
  
  if (mainPanel) mainPanel.classList.add('hidden');
  if (settingsPanel) settingsPanel.classList.remove('hidden');
}

function closeSettings() {
  const mainPanel = document.getElementById('mainPanel');
  const settingsPanel = document.getElementById('settingsPanel');
  
  if (settingsPanel) settingsPanel.classList.add('hidden');
  if (mainPanel) mainPanel.classList.remove('hidden');
}

function loadSettings() {
  chrome.storage.local.get(['scrollDuration', 'apiKey', 'searchCount', 'selectedTags', 'theme'], (result) => {
    const scrollDuration = document.getElementById('scrollDuration');
    const apiKey = document.getElementById('apiKey');
    const searchCount = document.getElementById('searchCount');
    
    if (result.scrollDuration && scrollDuration) {
      scrollDuration.value = result.scrollDuration;
    }
    if (result.apiKey && apiKey) {
      apiKey.value = result.apiKey;
    }
    if (result.searchCount && searchCount) {
      searchCount.value = result.searchCount;
    }
    if (result.selectedTags && Array.isArray(result.selectedTags)) {
      selectedTags = result.selectedTags;
      
      // Update UI to show selected tags
      const tags = document.querySelectorAll('.tag');
      tags.forEach(tag => {
        const tagValue = tag.dataset.tag;
        if (selectedTags.includes(tagValue)) {
          tag.classList.add('selected');
        } else {
          tag.classList.remove('selected');
        }
      });
    }
    
    // Load theme settings
    if (result.theme) {
      applyTheme(result.theme);
      
      // Update theme selector UI
      const themeOptions = document.querySelectorAll('.theme-option');
      themeOptions.forEach(opt => opt.classList.remove('active'));
      document.querySelector(`[data-theme="${result.theme}"]`).classList.add('active');
      document.getElementById(`theme-${result.theme}`).checked = true;
    }
  });
}

function saveSettings() {
  const scrollDuration = document.getElementById('scrollDuration');
  const apiKey = document.getElementById('apiKey');
  
  if (!scrollDuration || !apiKey) return;
  
  const duration = parseInt(scrollDuration.value);
  const key = apiKey.value.trim();

  if (duration < 5 || duration > 30) {
    log('Scroll duration must be between 5 and 30 seconds', 'error');
    return;
  }

  // Get currently selected theme
  const selectedTheme = document.querySelector('input[name="theme"]:checked').value;

  chrome.storage.local.set({ 
    scrollDuration: duration,
    apiKey: key,
    theme: selectedTheme,
    selectedTags: selectedTags  // Make sure selectedTags are saved
  }, () => {
    log('Settings saved successfully!', 'success');
    setTimeout(closeSettings, 1000);
  });
}

async function startAutomation() {
  const searchCount = document.getElementById('searchCount');
  
  if (!searchCount) return;
  
  const count = parseInt(searchCount.value);
  
  if (!count || count < 1 || count > 50) {
    log('Please enter a valid number of searches (1-50)', 'error');
    return;
  }

  if (selectedTags.length === 0) {
    log('Please select at least one topic tag', 'error');
    return;
  }

  chrome.storage.local.get(['apiKey'], (result) => {
    if (!result.apiKey || result.apiKey.trim() === '') {
      log('Please set your Gemini API key in settings', 'error');
      openSettings();
      return;
    }

    const runBtn = document.getElementById('runBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (runBtn) runBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    
    // Send message to background script to start automation
    chrome.runtime.sendMessage({
      action: 'startAutomation',
      searchCount: count,
      selectedTags: selectedTags,
      apiKey: result.apiKey
    }, (response) => {
      if (!response || !response.success) {
        log(`Error: ${response ? response.error : 'Unknown error'}`, 'error');
        resetUI();
      }
    });
  });
}

function stopAutomation() {
  const stopBtn = document.getElementById('stopBtn');
  
  if (stopBtn) stopBtn.disabled = true;
  
  // Send message to background script to stop automation
  chrome.runtime.sendMessage({ action: 'stopAutomation' }, (response) => {
    if (!response || !response.success) {
      log(`Error stopping automation: ${response ? response.error : 'Unknown error'}`, 'error');
    }
  });
}

function debugCurrentTab() {
  log('Debugging current tab...', 'info');
  
  // Send message to background script to debug current tab
  chrome.runtime.sendMessage({ action: 'debugCurrentTab' }, (response) => {
    if (!response || !response.success) {
      log(`Error debugging tab: ${response ? response.error : 'Unknown error'}`, 'error');
    } else {
      log('Debug information sent to console. Check the developer console (F12) on the Bing page.', 'info');
    }
  });
}

function updateProgress(percent) {
  const progressFill = document.getElementById('progressFill');
  if (progressFill) {
    progressFill.style.width = `${percent}%`;
  }
}

function updateStatus(message) {
  const statusText = document.getElementById('statusText');
  if (statusText) {
    statusText.textContent = message;
  }
}

// Replace the existing log function with this updated version
function log(message, type = 'info') {
  const logTerminal = document.getElementById('logTerminal');
  if (!logTerminal) return;
  
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  
  // Add icon based on log type
  let icon = '';
  switch (type) {
    case 'info':
      icon = '<i class="fas fa-info-circle"></i>';
      break;
    case 'success':
      icon = '<i class="fas fa-check-circle"></i>';
      break;
    case 'error':
      icon = '<i class="fas fa-exclamation-circle"></i>';
      break;
    case 'warning':
      icon = '<i class="fas fa-exclamation-triangle"></i>';
      break;
    default:
      icon = '<i class="fas fa-info-circle"></i>';
  }
  
  const timestamp = new Date().toLocaleTimeString();
  entry.innerHTML = `${icon}<span>[${timestamp}] ${message}</span>`;
  logTerminal.appendChild(entry);
  logTerminal.scrollTop = logTerminal.scrollHeight;
}

// Replace the existing clearLog function with this updated version
function clearLog() {
  const logTerminal = document.getElementById('logTerminal');
  if (logTerminal) {
    logTerminal.innerHTML = '<div class="log-entry log-info"><i class="fas fa-info-circle"></i><span>[Ready] Log cleared</span></div>';
  }
}

function resetUI() {
  const runBtn = document.getElementById('runBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  if (runBtn) runBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;
}

// Update schedule status every minute
setInterval(() => {
  if (scheduledTime) {
    updateScheduleStatus();
  }
}, 60000);

// Add a test function to manually increment the count (for debugging)
function testIncrementCount() {
  incrementDailySearchCount();
}

// Make the test function available in console for debugging
window.testIncrementCount = testIncrementCount;