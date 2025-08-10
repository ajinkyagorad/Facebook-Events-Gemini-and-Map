// Background script for Facebook Events Map extension
chrome.runtime.onInstalled.addListener(function() {
    console.log('Facebook Events Map extension installed');
});

// Handle messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'openMap') {
        const mapUrl = chrome.extension.getURL('map.html');
        chrome.tabs.create({ url: mapUrl });
    }
    
    if (request.action === 'storeEvents') {
        chrome.storage.local.set({ events: request.events }, function() {
            console.log('Events stored:', request.events.length);
            sendResponse({ success: true });
        });
        return true; // Keep message channel open for async response
    }
});
