// Content script - handles typing and scrolling on Bing search pages
let scrollInterval;
let scrollTimeout;
let typingInterval;
let isTyping = false;
let originalQuery = '';
let searchSubmitted = false;
let searchCompleted = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startTypingAndSearch') {
    typeAndSearch(message.query, message.duration)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  } else if (message.action === 'startScrolling') {
    startScrolling(message.duration);
    sendResponse({ success: true });
  } else if (message.action === 'stopScrolling') {
    stopScrolling();
    sendResponse({ success: true });
  } else if (message.action === 'debugPage') {
    debugPage();
    sendResponse({ success: true });
  }
});

async function typeAndSearch(query, scrollDuration) {
  return new Promise((resolve, reject) => {
    try {
      // Check if we're already on a search results page
      if (window.location.href.includes('bing.com/search')) {
        console.log('Already on search results page, starting scrolling');
        startScrolling(scrollDuration);
        resolve();
        return;
      }
      
      originalQuery = query;
      isTyping = true;
      searchSubmitted = false;
      searchCompleted = false;
      
      // Wait a moment for the page to fully load
      setTimeout(() => {
        // Find the search input field on Bing - try multiple selectors
        let searchInput = document.querySelector('input[name="q"]');
        
        if (!searchInput) {
          searchInput = document.getElementById('sb_form_q');
        }
        
        if (!searchInput) {
          searchInput = document.querySelector('input[type="search"]');
        }
        
        if (!searchInput) {
          reject(new Error('Search input field not found'));
          return;
        }

        // Clear any existing typing
        if (typingInterval) {
          clearInterval(typingInterval);
        }

        // Focus on the search input
        searchInput.focus();
        searchInput.click(); // Click to ensure it's active
        searchInput.value = '';

        // Type the query character by character
        let charIndex = 0;
        const typingSpeed = 80 + Math.random() * 120; // Random typing speed between 80-200ms per character
        
        // Type the first character immediately
        if (query.length > 0) {
          searchInput.value = query[0];
          charIndex = 1;
        }
        
        typingInterval = setInterval(() => {
          if (charIndex < query.length) {
            // Add the next character
            searchInput.value = query.substring(0, charIndex + 1);
            charIndex++;
            
            // Random chance to pause briefly (simulating thinking)
            if (Math.random() < 0.05) {
              clearInterval(typingInterval);
              setTimeout(() => {
                if (!isTyping) return;
                
                typingInterval = setInterval(() => {
                  if (charIndex < query.length) {
                    searchInput.value = query.substring(0, charIndex + 1);
                    charIndex++;
                  } else {
                    clearInterval(typingInterval);
                    submitSearch();
                  }
                }, typingSpeed);
              }, 200 + Math.random() * 300); // Brief pause of 200-500ms
            }
          } else {
            clearInterval(typingInterval);
            submitSearch();
          }
        }, typingSpeed);

        function submitSearch() {
          isTyping = false;
          
          // Immediately submit the search after typing is complete
          setTimeout(() => {
            // Ensure the full query is in the input
            searchInput.value = query;
            
            // Dispatch input event to ensure Bing recognizes the change
            const inputEvent = new Event('input', { bubbles: true });
            searchInput.dispatchEvent(inputEvent);
            
            // Also dispatch change event
            const changeEvent = new Event('change', { bubbles: true });
            searchInput.dispatchEvent(changeEvent);
            
            // Try multiple methods to submit the search
            let searchButton = document.querySelector('#search_icon');
            
            if (searchButton) {
              console.log('Found search button with selector: #search_icon');
              
              // Try multiple click methods
              try {
                // Method 1: Standard click
                console.log('Trying standard click');
                searchButton.click();
                searchSubmitted = true;
                
                // Check if URL changes after a short delay
                setTimeout(() => {
                  if (window.location.href.includes('bing.com/search')) {
                    console.log('Search successful after standard click');
                    searchCompleted = true;
                    setTimeout(() => {
                      startScrolling(scrollDuration);
                      resolve();
                    }, 2000);
                  } else {
                    console.log('Standard click did not work, trying alternative methods');
                    tryAlternativeClickMethods();
                  }
                }, 2000);
              } catch (e) {
                console.log('Standard click failed, trying alternative methods');
                tryAlternativeClickMethods();
              }
            } else {
              console.log('Search button not found, trying alternative methods');
              tryAlternativeMethods();
            }
            
            function tryAlternativeClickMethods() {
              try {
                // Method 2: Create and dispatch a click event
                console.log('Trying event dispatch');
                const clickEvent = new MouseEvent('click', {
                  view: window,
                  bubbles: true,
                  cancelable: true
                });
                searchButton.dispatchEvent(clickEvent);
                searchSubmitted = true;
                
                // Check if URL changes after a short delay
                setTimeout(() => {
                  if (window.location.href.includes('bing.com/search')) {
                    console.log('Search successful after event dispatch');
                    searchCompleted = true;
                    setTimeout(() => {
                      startScrolling(scrollDuration);
                      resolve();
                    }, 2000);
                  } else {
                    console.log('Event dispatch did not work, trying direct DOM manipulation');
                    tryDirectDOMManipulation();
                  }
                }, 2000);
              } catch (e) {
                console.log('Event dispatch failed, trying direct DOM manipulation');
                tryDirectDOMManipulation();
              }
            }
            
            function tryDirectDOMManipulation() {
              try {
                // Method 3: Direct DOM manipulation
                console.log('Trying direct DOM manipulation');
                searchButton.onclick = null; // Remove any existing onclick handlers
                
                // Create a new onclick function
                searchButton.onclick = function() {
                  console.log('Direct onclick triggered');
                  return true;
                };
                
                searchButton.click();
                searchSubmitted = true;
                
                // Check if URL changes after a short delay
                setTimeout(() => {
                  if (window.location.href.includes('bing.com/search')) {
                    console.log('Search successful after direct DOM manipulation');
                    searchCompleted = true;
                    setTimeout(() => {
                      startScrolling(scrollDuration);
                      resolve();
                    }, 2000);
                  } else {
                    console.log('Direct DOM manipulation did not work, trying Enter key');
                    tryEnterKey();
                  }
                }, 2000);
              } catch (e) {
                console.log('Direct DOM manipulation failed, trying Enter key');
                tryEnterKey();
              }
            }
            
            function tryEnterKey() {
              // Fallback: trigger a search by pressing Enter
              console.log('Pressing Enter key');
              
              // Create a more realistic Enter key event
              const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
                view: window
              });
              
              // Also create keyup event for completeness
              const keyupEvent = new KeyboardEvent('keyup', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
                view: window
              });
              
              // Dispatch both events
              searchInput.dispatchEvent(enterEvent);
              searchInput.dispatchEvent(keyupEvent);
              
              // Also try form submission
              const form = searchInput.form;
              if (form) {
                form.submit();
              }
              
              searchSubmitted = true;
              
              // Check if URL changes after a short delay
              setTimeout(() => {
                if (window.location.href.includes('bing.com/search')) {
                  console.log('Search successful after Enter key');
                  searchCompleted = true;
                  setTimeout(() => {
                    startScrolling(scrollDuration);
                    resolve();
                  }, 2000);
                } else {
                  console.log('Enter key did not work, trying direct navigation');
                  tryDirectNavigation();
                }
              }, 2000);
            }
            
            function tryDirectNavigation() {
              // Last resort: navigate directly to the search results page
              console.log('Trying direct navigation');
              const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
              window.location.href = searchUrl;
              
              // This will navigate away, so we can't check the URL here
              // Just assume it worked and resolve after a delay
              setTimeout(() => {
                startScrolling(scrollDuration);
                resolve();
              }, 3000);
            }
            
            // Monitor for URL change to detect when search results page loads
            let currentUrl = window.location.href;
            let attempts = 0;
            const maxAttempts = 10;
            
            const urlCheckInterval = setInterval(() => {
              attempts++;
              
              // Check if URL has changed or if we're already on search results
              if (window.location.href !== currentUrl || window.location.href.includes('bing.com/search')) {
                console.log('Search results page detected');
                clearInterval(urlCheckInterval);
                searchCompleted = true;
                
                // Wait for the page to fully load
                setTimeout(() => {
                  startScrolling(scrollDuration);
                  resolve();
                }, 2000);
              } else if (attempts >= maxAttempts) {
                // If we've tried multiple times and the URL hasn't changed, just proceed with scrolling
                console.log('Search submission may have failed, proceeding with scrolling');
                clearInterval(urlCheckInterval);
                startScrolling(scrollDuration);
                resolve();
              }
            }, 1000);
          }, 500); // Very short delay before submitting
        }
      }, 2000); // Initial delay before starting to type
    } catch (error) {
      isTyping = false;
      reject(error);
    }
  });
}

function startScrolling(duration) {
  console.log(`Starting scrolling for ${duration}ms`);
  stopScrolling(); // Clear any existing scrolling
  
  const endTime = Date.now() + duration;
  
  // Initial scroll
  performScroll(endTime);
  
  // Set up interval for continuous scrolling
  scrollInterval = setInterval(() => {
    if (Date.now() >= endTime) {
      stopScrolling();
      console.log('Scrolling completed');
      return;
    }
    performScroll(endTime);
  }, 1000 + Math.random() * 2000); // Random interval between 1-3 seconds
}

function performScroll(endTime) {
  if (Date.now() >= endTime) {
    stopScrolling();
    return;
  }
  
  // Random scroll behavior
  const scrollBehavior = Math.random();
  
  if (scrollBehavior < 0.15) {
    // 15% chance to scroll up
    window.scrollBy(0, -Math.random() * 300);
  } else if (scrollBehavior < 0.23) {
    // 8% chance to pause (don't scroll)
    return;
  } else {
    // Default: scroll down with variable speed
    const scrollSpeed = Math.random() < 0.05 ? 800 : (300 + Math.random() * 500);
    window.scrollBy(0, scrollSpeed);
  }
  
  // Random chance to scroll to a random position
  if (Math.random() < 0.1) {
    const randomPosition = Math.random() * document.body.scrollHeight;
    window.scrollTo(0, randomPosition);
  }
}

function stopScrolling() {
  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
  }
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
    scrollTimeout = null;
  }
  if (typingInterval) {
    clearInterval(typingInterval);
    typingInterval = null;
  }
  isTyping = false;
}

// Debug function to help identify the search button
function debugPage() {
  console.log('=== DEBUGGING BING SEARCH PAGE ===');
  
  // Find the search input
  let searchInput = document.querySelector('input[name="q"]');
  if (!searchInput) {
    searchInput = document.getElementById('sb_form_q');
  }
  if (!searchInput) {
    searchInput = document.querySelector('input[type="search"]');
  }
  
  if (searchInput) {
    console.log('Search input found:', searchInput);
    console.log('Search input parent:', searchInput.parentElement);
    console.log('Search input form:', searchInput.form);
    
    // Find the search button
    let searchButton = document.querySelector('#search_icon');
    if (searchButton) {
      console.log('Search button found:', searchButton);
      console.log('Search button parent:', searchButton.parentElement);
      console.log('Search button attributes:', searchButton.attributes);
      console.log('Search button onclick:', searchButton.onclick);
      console.log('Search button event listeners:', getEventListeners(searchButton));
    } else {
      console.log('Search button not found');
    }
  } else {
    console.log('Search input not found');
  }
  
  console.log('=== END DEBUGGING ===');
}