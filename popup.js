// Popup JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const openMapBtn = document.getElementById('openMapBtn');
    const clearDataBtn = document.getElementById('clearDataBtn');
    const statusDiv = document.getElementById('status');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
    const apiKeyStatus = document.getElementById('apiKeyStatus');

    console.log('Popup loaded, checking for events...');
    
    // Load saved API key on startup
    loadApiKey();

    // Check for stored events with better error handling
    function checkStoredEvents() {
        try {
            chrome.storage.local.get(['events'], function(result) {
                console.log('Storage result:', result);
                
                if (chrome.runtime.lastError) {
                    console.error('Chrome storage error:', chrome.runtime.lastError);
                    statusDiv.textContent = 'Error accessing storage';
                    statusDiv.className = 'status info';
                    return;
                }

                const events = result.events || [];
                console.log('Found events:', events.length);
                
                if (events.length > 0) {
                    const mappableEvents = events.filter(event => event.location && event.location.trim()).length;
                    statusDiv.textContent = `${events.length} events stored (${mappableEvents} mappable)`;
                    statusDiv.className = 'status success';
                    openMapBtn.textContent = '📍 View Events Map';
                } else {
                    statusDiv.textContent = 'No events stored yet';
                    statusDiv.className = 'status info';
                    openMapBtn.textContent = '📍 Open Events Map';
                }
            });
        } catch (error) {
            console.error('Error checking storage:', error);
            statusDiv.textContent = 'Error checking events';
            statusDiv.className = 'status info';
        }
    }

    // Initial check
    checkStoredEvents();

    // Refresh every 2 seconds
    setInterval(checkStoredEvents, 2000);

    // Open map button
    openMapBtn.addEventListener('click', function() {
        console.log('Opening map...');
        try {
            const mapUrl = chrome.runtime.getURL('map.html');
            console.log('Map URL:', mapUrl);
            chrome.tabs.create({ url: mapUrl }, function(tab) {
                if (chrome.runtime.lastError) {
                    console.error('Error opening tab:', chrome.runtime.lastError);
                } else {
                    console.log('Map opened in tab:', tab.id);
                    window.close();
                }
            });
        } catch (error) {
            console.error('Error opening map:', error);
        }
    });

    // Clear data button
    clearDataBtn.addEventListener('click', function() {
        console.log('Clearing events...');
        chrome.storage.local.remove(['events'], function() {
            if (chrome.runtime.lastError) {
                console.error('Error clearing storage:', chrome.runtime.lastError);
            } else {
                console.log('Events cleared successfully');
                statusDiv.textContent = 'Events cleared';
                statusDiv.className = 'status info';
                openMapBtn.textContent = '📍 Open Events Map';
            }
        });
    });

    // Add widget info
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = `
        margin-top: 15px;
        padding: 10px;
        background: #e3f2fd;
        border-radius: 6px;
        font-size: 12px;
        line-height: 1.4;
        color: #1565c0;
    `;
    infoDiv.innerHTML = `
        <strong>📍 Widget Mode:</strong><br>
        Look for the floating widget in the bottom-right corner of Facebook Events pages!
    `;
    
    clearDataBtn.parentNode.insertBefore(infoDiv, clearDataBtn.nextSibling);
    
    // API Key Management
    saveApiKeyBtn.addEventListener('click', saveApiKey);
    
    async function loadApiKey() {
        try {
            const result = await chrome.storage.local.get('geminiApiKey');
            if (result.geminiApiKey) {
                apiKeyInput.value = result.geminiApiKey;
                apiKeyStatus.textContent = '✅ API Key loaded';
                apiKeyStatus.style.color = '#28a745';
            } else {
                apiKeyStatus.textContent = '⚠️ No API Key found. Please enter your Gemini API key.';
                apiKeyStatus.style.color = '#ffc107';
            }
        } catch (error) {
            console.error('Error loading API key:', error);
            apiKeyStatus.textContent = '❌ Error loading API key';
            apiKeyStatus.style.color = '#dc3545';
        }
    }
    
    async function saveApiKey() {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            apiKeyStatus.textContent = '❌ Please enter an API key';
            apiKeyStatus.style.color = '#dc3545';
            return;
        }
        
        if (!apiKey.startsWith('AIza')) {
            apiKeyStatus.textContent = '❌ Invalid API key format';
            apiKeyStatus.style.color = '#dc3545';
            return;
        }
        
        try {
            await chrome.storage.local.set({ geminiApiKey: apiKey });
            apiKeyStatus.textContent = '✅ API Key saved successfully!';
            apiKeyStatus.style.color = '#28a745';
            
            // Notify content script about new API key
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0] && tabs[0].url.includes('facebook.com/events')) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'apiKeyUpdated',
                        apiKey: apiKey
                    });
                }
            });
        } catch (error) {
            console.error('Error saving API key:', error);
            apiKeyStatus.textContent = '❌ Error saving API key';
            apiKeyStatus.style.color = '#dc3545';
        }
    }
});
