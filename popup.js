let selectedTags = [];
let isRunning = false;
let shouldStop = false;
let currentSearchIndex = 0;
let totalSearches = 0;
let generatedQueries = [];

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
  saveSettingsBtn: document.getElementById('saveSettingsBtn')
};

document.addEventListener('DOMContentLoaded', () => {
  initializeUI();
  loadSettings();
});

function initializeUI() {
  const tags = document.querySelectorAll('.tag');
  tags.forEach(tag => {
    tag.addEventListener('click', () => toggleTag(tag));
  });

  elements.runBtn.addEventListener('click', startAutomation);
  elements.stopBtn.addEventListener('click', stopAutomation);
  elements.clearLogBtn.addEventListener('click', clearLog);
  elements.settingsBtn.addEventListener('click', openSettings);
  elements.closeSettingsBtn.addEventListener('click', closeSettings);
  elements.saveSettingsBtn.addEventListener('click', saveSettings);
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
  
  log(`Tag ${selectedTags.includes(tag) ? 'selected' : 'deselected'}: ${tag}`, 'info');
}

function openSettings() {
  elements.mainPanel.classList.add('hidden');
  elements.settingsPanel.classList.remove('hidden');
}

function closeSettings() {
  elements.settingsPanel.classList.add('hidden');
  elements.mainPanel.classList.remove('hidden');
}

function loadSettings() {
  chrome.storage.local.get(['scrollDuration', 'apiKey'], (result) => {
    if (result.scrollDuration) {
      elements.scrollDuration.value = result.scrollDuration;
    }
    if (result.apiKey) {
      elements.apiKey.value = result.apiKey;
    }
  });
}

function saveSettings() {
  const scrollDuration = parseInt(elements.scrollDuration.value);
  const apiKey = elements.apiKey.value.trim();

  if (scrollDuration < 5 || scrollDuration > 30) {
    log('Scroll duration must be between 5 and 30 seconds', 'error');
    return;
  }

  chrome.storage.local.set({ 
    scrollDuration: scrollDuration,
    apiKey: apiKey
  }, () => {
    log('Settings saved successfully!', 'success');
    setTimeout(closeSettings, 1000);
  });
}

async function startAutomation() {
  const searchCount = parseInt(elements.searchCount.value);
  
  if (!searchCount || searchCount < 1 || searchCount > 50) {
    log('Please enter a valid number of searches (1-50)', 'error');
    return;
  }

  if (selectedTags.length === 0) {
    log('Please select at least one topic tag', 'error');
    return;
  }

  chrome.storage.local.get(['apiKey'], async (result) => {
    if (!result.apiKey || result.apiKey.trim() === '') {
      log('Please set your Gemini API key in settings', 'error');
      openSettings();
      return;
    }

    isRunning = true;
    shouldStop = false;
    currentSearchIndex = 0;
    totalSearches = searchCount;
    
    elements.runBtn.disabled = true;
    elements.stopBtn.disabled = false;
    
    log(`Starting automation: ${searchCount} searches with tags [${selectedTags.join(', ')}]`, 'info');
    updateStatus(`Generating ${searchCount} unique search queries...`);
    
    try {
      generatedQueries = await generateSearchQueries(searchCount, selectedTags, result.apiKey);
      log(`Generated ${generatedQueries.length} search queries`, 'success');
      
      await executeSearches(generatedQueries);
      
    } catch (error) {
      log(`Error: ${error.message}`, 'error');
      resetUI();
    }
  });
}

function stopAutomation() {
  shouldStop = true;
  log('Stop requested - finishing current search and stopping...', 'warning');
  elements.stopBtn.disabled = true;
}

async function generateSearchQueries(count, tags, apiKey) {
  try {
    const tagsString = tags.join(', ');
    const prompt = `Generate exactly ${count} unique, diverse, and interesting search queries. Each query should be related to one or more of these topics: ${tagsString}. 

Requirements:
- Each query should be natural and realistic (like what a real person would search)
- Make them varied and creative
- Mix different topics together when appropriate
- Keep queries between 2-6 words
- Return ONLY a JSON array of strings, nothing else
- Example format: ["anime recommendations 2024", "best luxury cars", "tech startup news"]

Generate ${count} queries now:`;

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
        }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    
    log('Raw Gemini response received', 'info');
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }
    
    const queries = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(queries) || queries.length === 0) {
      throw new Error('Invalid response format from Gemini');
    }
    
    return queries.slice(0, count);
    
  } catch (error) {
    throw new Error(`Failed to generate queries: ${error.message}`);
  }
}

async function executeSearches(queries) {
  for (let i = 0; i < queries.length && !shouldStop; i++) {
    currentSearchIndex = i + 1;
    const query = queries[i];
    
    updateProgress((currentSearchIndex / totalSearches) * 100);
    updateStatus(`Executing search ${currentSearchIndex}/${totalSearches}`);
    log(`[${currentSearchIndex}/${totalSearches}] Searching: "${query}"`, 'info');
    
    try {
      await performSearch(query);
      log(`[${currentSearchIndex}/${totalSearches}] Completed: "${query}"`, 'success');
    } catch (error) {
      log(`[${currentSearchIndex}/${totalSearches}] Error: ${error.message}`, 'error');
    }
    
    if (!shouldStop && i < queries.length - 1) {
      await sleep(1000);
    }
  }
  
  if (shouldStop) {
    log('Automation stopped by user', 'warning');
    updateStatus('Stopped');
  } else {
    log(`Automation completed! Executed ${currentSearchIndex}/${totalSearches} searches`, 'success');
    updateStatus('Completed');
    updateProgress(100);
  }
  
  resetUI();
}

async function performSearch(query) {
  return new Promise(async (resolve, reject) => {
    try {
      chrome.storage.local.get(['scrollDuration'], async (result) => {
        const scrollDuration = result.scrollDuration || 15;
        
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        
        const tab = await chrome.tabs.create({ url: searchUrl, active: false });
        
        await sleep(2000);
        
        chrome.tabs.sendMessage(tab.id, { 
          action: 'startScrolling',
          duration: scrollDuration * 1000
        }, (response) => {
          if (chrome.runtime.lastError) {
            log(`Scroll message error (tab may still be loading): ${chrome.runtime.lastError.message}`, 'warning');
          }
        });
        
        await sleep(scrollDuration * 1000 + 1000);
        
        await chrome.tabs.remove(tab.id);
        
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function updateProgress(percent) {
  elements.progressFill.style.width = `${percent}%`;
}

function updateStatus(message) {
  elements.statusText.textContent = message;
}

function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  elements.logTerminal.appendChild(entry);
  elements.logTerminal.scrollTop = elements.logTerminal.scrollHeight;
}

function clearLog() {
  elements.logTerminal.innerHTML = '<div class="log-entry log-info">Log cleared</div>';
}

function resetUI() {
  isRunning = false;
  shouldStop = false;
  elements.runBtn.disabled = false;
  elements.stopBtn.disabled = true;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
