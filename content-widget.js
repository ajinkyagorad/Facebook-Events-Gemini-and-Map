// Facebook Events Widget - Embedded Version
(function() {
  'use strict';
  
  console.log('Facebook Events Widget loaded');
  
  let extractionInProgress = false;
  let storedEvents = [];
  let widgetOpen = false;
  let map = null;
  
  // Simple storage wrapper
  const storage = {
    set: (data) => {
      return new Promise((resolve, reject) => {
        try {
          if (typeof browser !== 'undefined' && browser.storage) {
            browser.storage.local.set(data).then(resolve).catch(reject);
          } else if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set(data, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          } else {
            localStorage.setItem('fb_events', JSON.stringify(data.events || []));
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
    },
    
    get: () => {
      return new Promise((resolve, reject) => {
        try {
          if (typeof browser !== 'undefined' && browser.storage) {
            browser.storage.local.get(['events']).then(resolve).catch(reject);
          } else if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(['events'], (result) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(result);
              }
            });
          } else {
            const events = JSON.parse(localStorage.getItem('fb_events') || '[]');
            resolve({ events });
          }
        } catch (error) {
          reject(error);
        }
      });
    }
  };
  
  // Helper functions
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const MONTHS = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};

  function parseMeridiem(h, m, ampm) {
    let H = Number(h);
    const M = m ? Number(m) : 0;
    if (/pm/i.test(ampm) && H !== 12) H += 12;
    if (/am/i.test(ampm) && H === 12) H = 0;
    return {H, M};
  }

  function parseTimeLabel(txt) {
    const now = new Date();
    const y = now.getFullYear();
    const t = txt.replace(/\s+/g,' ').trim();

    if (/^Happening now/i.test(t)) {
      return { start: now, label: "Happening now" };
    }

    {
      const m = t.match(/Today at\s+(\d{1,2})(?::(\d{2}))?\s*([AP]M)/i);
      if (m) {
        const {H, M} = parseMeridiem(m[1], m[2], m[3]);
        const d = new Date(y, now.getMonth(), now.getDate(), H, M, 0, 0);
        return { start: d, label: m[0] };
      }
    }

    {
      const r = t.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+([A-Za-z]{3,})\s+(\d{1,2})/i);
      if (r) {
        const mon = (r[1] || '').slice(0,3).toLowerCase();
        const day = Number(r[2]);
        let H = 0, M = 0;
        const time = t.match(/(\d{1,2})(?::(\d{2}))?\s*([AP]M)/i);
        if (time) ({H, M} = parseMeridiem(time[1], time[2], time[3]));
        const d = new Date(y, MONTHS[mon], day, H, M, 0, 0);
        return { start: d, label: r[0] + (time ? ` ${time[0]}` : '') };
      }
    }

    {
      const m = t.match(/\b([A-Za-z]{3,})\s+(\d{1,2})\b/);
      if (m) {
        const mon = m[1].slice(0,3).toLowerCase();
        const day = Number(m[2]);
        const d = new Date(y, MONTHS[mon], day, 0, 0, 0, 0);
        return { start: d, label: m[0] };
      }
    }

    return { start: null, label: "" };
  }

  function extractLocation(card) {
    const text = card.innerText || '';
    const locationMatch = text.match(/(?:at|@)\s+([^·\n,]+)/i);
    if (locationMatch) {
      return locationMatch[1].trim();
    }
    
    const addressMatch = text.match(/([A-Za-z\s]+\d+[^·\n,]*)/);
    if (addressMatch) {
      return addressMatch[1].trim();
    }
    
    return '';
  }

  // Create minimal floating widget
  function createWidget() {
    // Remove existing widget
    const existing = document.getElementById('fb-events-widget');
    if (existing) existing.remove();
    
    const widget = document.createElement('div');
    widget.id = 'fb-events-widget';
    widget.innerHTML = `
      <div class="widget-container">
        <!-- Collapsed state -->
        <div class="widget-collapsed" id="widget-collapsed">
          <div class="widget-trigger" id="widget-trigger">
            <div class="status-indicator" id="status-indicator">
              <span class="event-count" id="event-count">0</span>
            </div>
            <div class="widget-icon">📍</div>
          </div>
        </div>
        
        <!-- Expanded state -->
        <div class="widget-expanded" id="widget-expanded" style="display: none;">
          <div class="widget-header">
            <div class="widget-title">Events Map</div>
            <div class="widget-controls">
              <button class="widget-btn extract-btn" id="extract-btn" title="Extract Events">⬇</button>
              <button class="widget-btn explorer-btn" id="explorer-btn" title="Open Events Explorer (Experimental)">🎯</button>
              <button class="widget-btn ai-btn" id="ai-btn" title="AI Chat">🤖</button>
              <button class="widget-btn close-btn" id="close-btn" title="Close">×</button>
            </div>
          </div>
          
          <div class="widget-content">
            <div class="widget-tabs">
              <button class="tab-btn active" data-tab="map">Map</button>
              <button class="tab-btn" data-tab="list">List</button>
              <button class="tab-btn" data-tab="chat">AI</button>
            </div>
            
            <div class="tab-content">
              <!-- Map tab -->
              <div class="tab-pane active" id="map-tab">
                <div class="map-controls" style="
                  display: flex;
                  gap: 8px;
                  margin-bottom: 8px;
                  justify-content: center;
                ">
                  <button class="map-control-btn" id="show-located-events" style="
                    padding: 6px 12px;
                    background: #1877f2;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 11px;
                    cursor: pointer;
                    font-weight: 500;
                  ">Located Events</button>
                  <button class="map-control-btn" id="show-all-events" style="
                    padding: 6px 12px;
                    background: #42b883;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 11px;
                    cursor: pointer;
                    font-weight: 500;
                  ">Show All Events</button>
                </div>
                <div class="map-container" id="map-container"></div>
                <div class="map-status" id="map-status">Click extract to load events</div>
              </div>
              
              <!-- List tab -->
              <div class="tab-pane" id="list-tab">
                <div class="list-controls" style="
                  display: flex;
                  gap: 8px;
                  margin-bottom: 12px;
                  justify-content: center;
                ">
                  <button class="list-control-btn" id="copy-all-events" style="
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #42b883, #369870);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 12px;
                    cursor: pointer;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(66, 184, 131, 0.3);
                  " title="Copy all events to clipboard">
                    📋 Copy All
                  </button>
                  <button class="list-control-btn" id="clear-all-events" style="
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #e74c3c, #c0392b);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 12px;
                    cursor: pointer;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
                  " title="Clear all events from list">
                    🗑️ Clear All
                  </button>
                </div>
                <div class="events-list" id="events-list"></div>
              </div>
              
              <!-- AI Chat tab -->
              <div class="tab-pane" id="chat-tab">
                <div class="chat-messages" id="chat-messages"></div>
                <div class="chat-input-container">
                  <input type="text" id="chat-input" placeholder="Ask about events..." />
                  <button id="send-chat">→</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #fb-events-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
      }
      
      .widget-container {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        overflow: hidden;
        transition: all 0.3s ease;
      }
      
      .widget-collapsed {
        padding: 12px;
      }
      
      .widget-trigger {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        transition: transform 0.2s;
      }
      
      .widget-trigger:hover {
        transform: scale(1.05);
      }
      
      .status-indicator {
        background: #1877f2;
        color: white;
        border-radius: 20px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 600;
        min-width: 20px;
        text-align: center;
      }
      
      .widget-icon {
        font-size: 20px;
      }
      
      .widget-expanded {
        width: 400px;
        height: 500px;
        display: flex;
        flex-direction: column;
      }
      
      .widget-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: rgba(24, 119, 242, 0.1);
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }
      
      .widget-title {
        font-weight: 600;
        color: #1877f2;
      }
      
      .widget-controls {
        display: flex;
        gap: 4px;
      }
      
      .widget-btn {
        background: none;
        border: none;
        padding: 6px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      }
      
      .widget-btn:hover {
        background: rgba(0, 0, 0, 0.1);
      }
      
      .widget-content {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      
      .widget-tabs {
        display: flex;
        background: rgba(0, 0, 0, 0.05);
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }
      
      .tab-btn {
        flex: 1;
        background: none;
        border: none;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s;
      }
      
      .tab-btn.active {
        background: white;
        color: #1877f2;
        border-bottom: 2px solid #1877f2;
      }
      
      .tab-content {
        flex: 1;
        position: relative;
      }
      
      .tab-pane {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 12px;
        display: none;
      }
      
      .tab-pane.active {
        display: block;
      }
      
      .map-container {
        width: 100%;
        height: 300px;
        background: #f0f2f5;
        border-radius: 8px;
        position: relative;
        overflow: hidden;
      }
      
      .map-status {
        text-align: center;
        color: #65676b;
        font-size: 12px;
        margin-top: 8px;
      }
      
      .events-list {
        height: 100%;
        overflow-y: auto;
      }
      
      .event-item {
        background: white;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .event-item:hover {
        border-color: #1877f2;
        box-shadow: 0 2px 8px rgba(24, 119, 242, 0.1);
      }
      
      .event-title {
        font-weight: 600;
        margin-bottom: 4px;
        font-size: 13px;
      }
      
      .event-details {
        font-size: 11px;
        color: #65676b;
      }
      
      .chat-messages {
        height: 300px;
        overflow-y: auto;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 8px;
        margin-bottom: 8px;
      }
      
      .chat-input-container {
        display: flex;
        gap: 8px;
      }
      
      .chat-input-container input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid rgba(0, 0, 0, 0.2);
        border-radius: 20px;
        outline: none;
        font-size: 12px;
      }
      
      .chat-input-container button {
        background: #1877f2;
        color: white;
        border: none;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .list-control-btn:hover {
        transform: translateY(-2px) scale(1.05);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      }
      
      .list-control-btn:active {
        transform: translateY(0) scale(0.98);
      }
      
      #copy-all-events:hover {
        background: linear-gradient(135deg, #4ecdc4, #44a08d);
        box-shadow: 0 4px 16px rgba(66, 184, 131, 0.4);
      }
      
      #clear-all-events:hover {
        background: linear-gradient(135deg, #ff6b6b, #ee5a52);
        box-shadow: 0 4px 16px rgba(231, 76, 60, 0.4);
      }
      
      .list-control-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none !important;
      }
      
      @media (max-width: 768px) {
        .widget-expanded {
          width: 320px;
          height: 400px;
        }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(widget);
    
    // Initialize event handlers
    initializeWidget();
  }
  
  function initializeWidget() {
    const trigger = document.getElementById('widget-trigger');
    const collapsed = document.getElementById('widget-collapsed');
    const expanded = document.getElementById('widget-expanded');
    const closeBtn = document.getElementById('close-btn');
    const extractBtn = document.getElementById('extract-btn');
    const explorerBtn = document.getElementById('explorer-btn');
    const aiBtn = document.getElementById('ai-btn');
    const chatInput = document.getElementById('chat-input');
    const sendChat = document.getElementById('send-chat');
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    // Toggle widget
    trigger.addEventListener('click', () => {
      widgetOpen = true;
      collapsed.style.display = 'none';
      expanded.style.display = 'flex';
      updateStatus();
      if (storedEvents.length > 0) {
        initializeMap();
      }
    });
    
    closeBtn.addEventListener('click', () => {
      widgetOpen = false;
      collapsed.style.display = 'block';
      expanded.style.display = 'none';
    });
    
    // Extract events
    extractBtn.addEventListener('click', extractEvents);
    
    // Events Explorer functionality
    if (explorerBtn) {
      explorerBtn.addEventListener('click', () => {
        console.log('Events Explorer button clicked');
        try {
          let explorerUrl;
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            explorerUrl = chrome.runtime.getURL('events-explorer.html');
            console.log('Using Chrome runtime URL:', explorerUrl);
          } else if (typeof browser !== 'undefined' && browser.runtime) {
            explorerUrl = browser.runtime.getURL('events-explorer.html');
            console.log('Using Firefox runtime URL:', explorerUrl);
          } else {
            // Fallback for testing
            explorerUrl = './events-explorer.html';
            console.log('Using fallback URL:', explorerUrl);
          }
          
          const newWindow = window.open(explorerUrl, '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');
          if (!newWindow) {
            console.error('Failed to open new window - popup blocked?');
            alert('Please allow popups for this site to open the Events Explorer');
          } else {
            console.log('Events Explorer window opened successfully');
          }
        } catch (error) {
          console.error('Error opening Events Explorer:', error);
          alert('Error opening Events Explorer: ' + error.message);
        }
      });
    } else {
      console.error('Explorer button not found');
    }
    
    // AI Chat functionality
    aiBtn.addEventListener('click', () => {
      // Switch to AI tab
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-tab="chat"]').classList.add('active');
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
      document.getElementById('chat-tab').classList.add('active');
      
      // Focus chat input
      setTimeout(() => chatInput.focus(), 100);
    });
    
    // Send chat message with streaming
    const sendMessage = async () => {
      const message = chatInput.value.trim();
      if (!message) return;
      
      chatInput.value = '';
      addChatMessage('user', message);
      
      // Create streaming response container
      const streamingMsg = addStreamingMessage();
      
      try {
        await streamGeminiResponse(message, streamingMsg);
      } catch (error) {
        console.error('AI Error:', error);
        streamingMsg.remove();
        addChatMessage('ai', `Sorry, I encountered an error: ${error.message}\n\nPlease check your internet connection and try again.`);
      }
    };
    
    sendChat.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });
    
    // List control buttons
    const copyAllBtn = document.getElementById('copy-all-events');
    const clearAllBtn = document.getElementById('clear-all-events');
    
    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', async () => {
        await copyAllEvents();
      });
    }
    
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', async () => {
        await clearAllEvents();
      });
    }
    
    // Tab switching
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // Update active tab button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active tab pane
        document.querySelectorAll('.tab-pane').forEach(pane => {
          pane.classList.remove('active');
        });
        document.getElementById(`${targetTab}-tab`).classList.add('active');
        
        // Initialize content for the active tab with delay to ensure DOM is ready
        setTimeout(async () => {
          if (targetTab === 'map') {
            await initializeMap();
          } else if (targetTab === 'list') {
            initializeList();
          }
        }, 100);
      });
    });
    
    // Map control buttons event handlers
    setTimeout(() => {
      const locatedBtn = document.getElementById('show-located-events');
      const allBtn = document.getElementById('show-all-events');
      
      if (locatedBtn) {
        locatedBtn.addEventListener('click', async () => {
          await initializeMap(false); // Show only located events
        });
      }
      
      if (allBtn) {
        allBtn.addEventListener('click', async () => {
          await initializeMap(true); // Show all events
        });
      }
    }, 300);
    
    // Initialize default tab (map) on widget creation
    setTimeout(() => {
      initializeMap();
      initializeList();
    }, 200);
    
    // Update status
    updateStatus();
    setInterval(updateStatus, 5000);
  }
  
  async function updateStatus() {
    try {
      const result = await storage.get();
      const events = result.events || [];
      storedEvents = events;
      
      const eventCount = document.getElementById('event-count');
      const mapStatus = document.getElementById('map-status');
      
      if (eventCount) {
        eventCount.textContent = events.length;
      }
      
      if (mapStatus) {
        const mappableEvents = events.filter(e => e.location).length;
        mapStatus.textContent = events.length > 0 
          ? `${events.length} events (${mappableEvents} mappable)`
          : 'Click extract to load events';
      }
      
      // Update events list
      updateEventsList();
      
    } catch (error) {
      console.error('Status update error:', error);
    }
  }
  
  function updateEventsList() {
    const eventsList = document.getElementById('events-list');
    if (!eventsList) return;
    
    if (storedEvents.length === 0) {
      eventsList.innerHTML = '<div style="text-align: center; color: #65676b; padding: 20px;">No events yet<br><small>Click extract button</small></div>';
      return;
    }
    
    eventsList.innerHTML = storedEvents.map((event, index) => {
      // Improved data extraction with fallbacks
      let displayTitle = event.title || 'Untitled Event';
      let displayDate = event.date || event.time_text || 'Date TBD';
      let displayTime = event.time || '';
      let displayLocation = event.location || 'Location TBD';
      let displayDescription = '';
      
      // If we have time_text but no separate date/time, parse it better
      if (event.time_text && !event.date && !event.time) {
        displayDate = event.time_text;
      }
      
      // Create a clean description from available data
      if (event.description) {
        displayDescription = event.description.length > 100 ? 
          event.description.substring(0, 100) + '...' : event.description;
      } else {
        // Fallback: create description from other fields
        const parts = [];
        if (displayDate !== 'Date TBD') parts.push(displayDate);
        if (displayTime) parts.push(displayTime);
        if (displayLocation !== 'Location TBD') parts.push(displayLocation);
        displayDescription = parts.join(' • ');
      }
      
      const interestedCount = event.interested_count || 0;
      const goingCount = event.going_count || 0;
      
      return `
        <div class="event-item" data-event-url="${event.url}" data-event-index="${index}" style="
          margin-bottom: 8px;
          padding: 12px;
          background: rgba(255,255,255,0.95);
          border-radius: 8px;
          border-left: 3px solid #1877f2;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 12px;
          line-height: 1.4;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        ">
          <!-- Title Section -->
          <div style="
            font-weight: 600;
            color: #1c1e21;
            margin-bottom: 8px;
            font-size: 14px;
            line-height: 1.3;
            word-wrap: break-word;
          ">${displayTitle}</div>
          
          <!-- Date & Time Section -->
          <div style="
            color: #1877f2;
            font-size: 12px;
            margin-bottom: 6px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 6px;
          ">
            <span>📅</span>
            <span>${displayDate}</span>
            ${displayTime ? `<span style="margin-left: 8px;">🕒 ${displayTime}</span>` : ''}
          </div>
          
          <!-- Location Section -->
          <div style="
            color: #65676b;
            font-size: 11px;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
          ">
            <span>📍</span>
            <span style="word-wrap: break-word;">${displayLocation}</span>
          </div>
          
          <!-- Description Section -->
          ${displayDescription ? `
          <div style="
            color: #65676b;
            font-size: 11px;
            margin-bottom: 6px;
            line-height: 1.3;
            word-wrap: break-word;
            font-style: italic;
          ">${displayDescription}</div>
          ` : ''}
          
          <!-- Engagement Section -->
          ${(interestedCount > 0 || goingCount > 0) ? `
          <div style="
            color: #65676b;
            font-size: 10px;
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px solid #e4e6ea;
            display: flex;
            gap: 12px;
          ">
            ${interestedCount > 0 ? `<span style="display: flex; align-items: center; gap: 3px;">👍 ${interestedCount} interested</span>` : ''}
            ${goingCount > 0 ? `<span style="display: flex; align-items: center; gap: 3px;">✅ ${goingCount} going</span>` : ''}
          </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    // Add click handlers without inline events
    eventsList.querySelectorAll('.event-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.eventUrl;
        if (url) window.open(url, '_blank');
      });
    });
  }
  
  // Copy all events to clipboard
  async function copyAllEvents() {
    const copyBtn = document.getElementById('copy-all-events');
    if (!copyBtn || storedEvents.length === 0) return;
    
    const originalText = copyBtn.innerHTML;
    copyBtn.disabled = true;
    copyBtn.innerHTML = '⏳ Copying...';
    
    try {
      // Format events as readable text
      const eventsText = storedEvents.map((event, index) => {
        const title = event.title || 'Untitled Event';
        const date = event.date || event.time_text || 'Date TBD';
        const time = event.time || '';
        const location = event.location || 'Location TBD';
        const description = event.description || '';
        const url = event.url || '';
        
        let eventText = `${index + 1}. ${title}\n`;
        eventText += `   📅 ${date}${time ? ` at ${time}` : ''}\n`;
        eventText += `   📍 ${location}\n`;
        if (description) {
          eventText += `   📝 ${description.substring(0, 200)}${description.length > 200 ? '...' : ''}\n`;
        }
        if (url) {
          eventText += `   🔗 ${url}\n`;
        }
        
        const interestedCount = event.interested_count || 0;
        const goingCount = event.going_count || 0;
        if (interestedCount > 0 || goingCount > 0) {
          eventText += `   👥 ${interestedCount} interested, ${goingCount} going\n`;
        }
        
        return eventText;
      }).join('\n');
      
      const fullText = `Facebook Events (${storedEvents.length} events)\n${'='.repeat(40)}\n\n${eventsText}\n\nExtracted on ${new Date().toLocaleString()}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(fullText);
      
      copyBtn.innerHTML = '✅ Copied!';
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.disabled = false;
      }, 2000);
      
    } catch (error) {
      console.error('Copy error:', error);
      copyBtn.innerHTML = '❌ Failed';
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.disabled = false;
      }, 2000);
    }
  }
  
  // Clear all events from storage
  async function clearAllEvents() {
    const clearBtn = document.getElementById('clear-all-events');
    if (!clearBtn) return;
    
    // Show confirmation
    if (!confirm(`Are you sure you want to clear all ${storedEvents.length} events? This action cannot be undone.`)) {
      return;
    }
    
    const originalText = clearBtn.innerHTML;
    clearBtn.disabled = true;
    clearBtn.innerHTML = '⏳ Clearing...';
    
    try {
      // Clear from storage
      await storage.set({ events: [] });
      storedEvents = [];
      
      // Update UI
      updateEventsList();
      updateStatus();
      
      clearBtn.innerHTML = '✅ Cleared!';
      setTimeout(() => {
        clearBtn.innerHTML = originalText;
        clearBtn.disabled = false;
      }, 2000);
      
    } catch (error) {
      console.error('Clear error:', error);
      clearBtn.innerHTML = '❌ Failed';
      setTimeout(() => {
        clearBtn.innerHTML = originalText;
        clearBtn.disabled = false;
      }, 2000);
    }
  }
  
  async function extractEvents() {
    if (extractionInProgress) return;
    
    extractionInProgress = true;
    const extractBtn = document.getElementById('extract-btn');
    const mapStatus = document.getElementById('map-status');
    
    try {
      extractBtn.textContent = '⏳';
      extractBtn.disabled = true;
      mapStatus.textContent = 'Extracting events...';
      
      // Auto-scroll to load more events
      let lastHeight = 0;
      let scrollAttempts = 0;
      const maxScrolls = 15;
      
      while (scrollAttempts < maxScrolls) {
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(800);
        
        const currentHeight = document.body.scrollHeight;
        if (currentHeight === lastHeight) {
          break;
        }
        
        lastHeight = currentHeight;
        scrollAttempts++;
        mapStatus.textContent = `Loading... (${scrollAttempts}/${maxScrolls})`;
      }
      
      window.scrollTo(0, 0);
      mapStatus.textContent = 'Processing events...';
      
      // Extract events using working approach with proper field separation
      const seen = new Map();
      const anchors = [...document.querySelectorAll('a[href*="/events/"]')];
      
      console.log(`Found ${anchors.length} event links`);
      
      anchors.forEach((a, index) => {
        const match = a.href.match(/\/events\/(\d{5,})/);
        if (!match) return;
        
        const id = match[1];
        if (seen.has(id)) return;
        
        console.log(`\n=== Processing Event ${index + 1} (ID: ${id}) ===`);
        console.log('Event link:', a.href);
        
        const card = a.closest('[role="article"], [role="button"], [class*="x1n2onr6"], [class*="xdt5ytf"]') || a.closest('div') || a.parentElement;
        if (!card) return;
        
        console.log('Card element:', card);
        
        // Parse structured event data with proper field separation
        const eventData = parseEventCardWithSeparation(card, id, a);
        if (eventData) {
          console.log('Parsed event data:', eventData);
          seen.set(id, eventData);
        }
      });
      
      const events = [...seen.values()].sort((a, b) => {
        if (a.start_ts === null && b.start_ts === null) return 0;
        if (a.start_ts === null) return 1;
        if (b.start_ts === null) return -1;
        return a.start_ts - b.start_ts;
      });
      
      // Store events
      await storage.set({ events });
      storedEvents = events;
      
      mapStatus.textContent = `Extracted ${events.length} events!`;
      extractBtn.textContent = '✓';
      
      // Initialize map
      setTimeout(() => {
        initializeMap();
        updateEventsList();
      }, 500);
      
    } catch (error) {
      console.error('Extraction error:', error);
      mapStatus.textContent = 'Extraction failed';
      extractBtn.textContent = '❌';
    } finally {
      extractionInProgress = false;
      setTimeout(() => {
        if (extractBtn) {
          extractBtn.disabled = false;
          extractBtn.textContent = '⬇';
        }
      }, 2000);
    }
  }
  
  let currentMapMode = 'located'; // 'located' or 'all'
  
  async function initializeMap(showAllEvents = false) {
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer || storedEvents.length === 0) return;
    
    currentMapMode = showAllEvents ? 'all' : 'located';
    
    // Update button states
    const locatedBtn = document.getElementById('show-located-events');
    const allBtn = document.getElementById('show-all-events');
    if (locatedBtn && allBtn) {
      if (showAllEvents) {
        locatedBtn.style.background = '#65676b';
        allBtn.style.background = '#42b883';
      } else {
        locatedBtn.style.background = '#1877f2';
        allBtn.style.background = '#65676b';
      }
    }
    
    const eventsToMap = showAllEvents ? storedEvents : storedEvents.filter(e => e.location);
    const totalEvents = storedEvents.length;
    const mappableEvents = eventsToMap.length;
    
    // Show enhanced loading state with explanation
    mapContainer.innerHTML = `
      <div style="
        width: 100%;
        height: 280px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 8px;
        position: relative;
        overflow: hidden;
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        text-align: center;
        padding: 20px;
      ">
        <div style="font-size: 18px; margin-bottom: 10px;">🗺️ Loading Map...</div>
        <div style="margin-bottom: 8px;">Processing ${mappableEvents} events</div>
        <div style="font-size: 12px; opacity: 0.9; line-height: 1.4;">
          ${showAllEvents ? 'Showing all events (some without locations)' : 'Geocoding event locations...'}<br>
          ${showAllEvents ? '' : 'May be slow due to Facebook security restrictions'}
        </div>
        <div id="open-full-map-loading" style="
          margin-top: 15px;
          padding: 8px 16px;
          background: rgba(255,255,255,0.2);
          border-radius: 20px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s ease;
        ">
          🔗 Open Full Map in New Tab
        </div>
      </div>
    `;
    
    // Geocode events and create map
    const geocodedEvents = await geocodeEvents(eventsToMap);
    const geocodedCount = geocodedEvents.filter(e => e.geocoded).length;
    const gridCount = geocodedEvents.filter(e => !e.geocoded).length;
    
    mapContainer.innerHTML = `
      <div id="real-map" style="
        width: 100%;
        height: 280px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 8px;
        position: relative;
        overflow: hidden;
        margin-bottom: 8px;
      ">
        ${geocodedEvents.map((event, i) => `
          <div class="map-marker" data-event-url="${event.url}" style="
            position: absolute;
            top: ${event.mapY}px;
            left: ${event.mapX}px;
            width: 12px;
            height: 12px;
            background: ${event.geocoded ? 'linear-gradient(45deg, #4285f4, #34a853)' : 'linear-gradient(45deg, #ff9800, #f57c00)'};
            border: 2px solid white;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            transition: all 0.2s ease;
            z-index: 10;
          " title="${event.title} - ${event.location}${event.geocoded ? ' (geocoded)' : ' (grid positioned)'}"></div>
        `).join('')}
        <div style="
          position: absolute;
          top: 8px;
          left: 8px;
          background: rgba(255,255,255,0.95);
          padding: 6px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          color: #1c1e21;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        ">
          📍 Helsinki Events<br>
          <span style="font-weight: 400; color: #65676b;">${geocodedCount} geocoded • ${gridCount} grid</span>
        </div>
        ${gridCount > 0 ? `
          <div style="position: absolute; top: 8px; right: 8px; background: rgba(255,193,7,0.9); padding: 4px 8px; border-radius: 4px; font-size: 10px; color: #333;">
            ⚠️ Some locations estimated (CSP blocked)
          </div>
        ` : ''}
        <div id="open-full-map-corner" style="
          position: absolute;
          top: 8px;
          left: 8px;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        " title="Open full map in new tab">
          🔗 Full Map
        </div>
        <div style="
          position: absolute;
          bottom: 8px;
          right: 8px;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 4px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 500;
        ">
          ${eventsToMap.length} events mapped${showAllEvents ? ' (all events)' : ' (located only)'}
        </div>
      </div>
    `;
    
    // Add click handlers and hover effects for map markers
    mapContainer.querySelectorAll('.map-marker').forEach(marker => {
      marker.addEventListener('click', () => {
        const url = marker.dataset.eventUrl;
        if (url) window.open(url, '_blank');
      });
      
      // Add hover effects
      marker.addEventListener('mouseenter', () => {
        marker.style.transform = 'scale(2)';
        marker.style.zIndex = '20';
        marker.style.background = '#ff6b7a';
      });
      
      marker.addEventListener('mouseleave', () => {
        marker.style.transform = 'scale(1)';
        marker.style.zIndex = '5';
        marker.style.background = '#ff4757';
      });
    });
    
    // Add CSP-safe event handlers for "Open Full Map" buttons
    const openFullMapLoading = document.getElementById('open-full-map-loading');
    const openFullMapCorner = document.getElementById('open-full-map-corner');
    
    const openFullMap = () => {
      try {
        // Method 1: Try extension runtime API
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          const mapUrl = chrome.runtime.getURL('map.html');
          window.open(mapUrl, '_blank');
          return;
        }
        
        // Method 2: Try browser API (Firefox)
        if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getURL) {
          const mapUrl = browser.runtime.getURL('map.html');
          window.open(mapUrl, '_blank');
          return;
        }
        
        // Method 3: Send message to background script to open map
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'openMap' }, (response) => {
            if (chrome.runtime.lastError) {
              console.warn('Background script method failed:', chrome.runtime.lastError);
              showFallbackMessage();
            }
          });
          return;
        }
        
        // Method 4: Fallback message
        showFallbackMessage();
        
      } catch (error) {
        console.warn('Could not open full map:', error);
        showFallbackMessage();
      }
    };
    
    const showFallbackMessage = () => {
      // Create a more user-friendly notification
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #1877f2;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10001;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 300px;
        line-height: 1.4;
      `;
      notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 6px;">🗺️ Open Full Map</div>
        <div style="font-size: 12px;">Click the extension icon in your browser toolbar, then select "View Events Map"</div>
        <div style="margin-top: 8px; text-align: right;">
          <span style="cursor: pointer; font-size: 12px; opacity: 0.8;" onclick="this.parentElement.parentElement.remove()">✕ Close</span>
        </div>
      `;
      
      document.body.appendChild(notification);
      
      // Auto-remove after 8 seconds
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 8000);
    };
    
    if (openFullMapLoading) {
      openFullMapLoading.addEventListener('click', openFullMap);
    }
    
    if (openFullMapCorner) {
      openFullMapCorner.addEventListener('click', openFullMap);
    }
  }
  
  // Proper Field Separation Parser - Extract each field into separate table columns
  function parseEventCardWithSeparation(cardElement, eventId, linkElement) {
    console.log(`\n=== FIELD SEPARATION PARSING EVENT ${eventId} ===`);
    
    // Initialize event data structure
    const eventData = {
      id: eventId,
      title: '',
      url: linkElement.href,
      date: '',
      time: '',
      time_text: '',
      start_ts: null,
      location: '',
      interested_count: 0,
      going_count: 0,
      description: ''
    };
    
    // Get title from link
    const title = (linkElement.textContent || linkElement.getAttribute('aria-label') || '').trim();
    const text = (cardElement?.innerText || '').replace(/\s+/g, ' ').trim();
    
    console.log('Link title:', title);
    console.log('Card text:', text);
    
    // Extract time information first
    const timeHit =
      (text.match(/Happening now/i) && text.match(/Happening now.*?(?=$)/i)) ||
      text.match(/Today at\s+\d{1,2}(?::\d{2})?\s*[AP]M/i) ||
      text.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3,}\s+\d{1,2}(?:.*?[AP]M)?/i) ||
      text.match(/\b[A-Za-z]{3,}\s+\d{1,2}\b/);
    
    const timeText = timeHit ? timeHit[0] : '';
    const { start, label } = parseTimeLabel(timeText);
    
    eventData.time_text = label || timeText || '';
    eventData.start_ts = start ? start.getTime() : null;
    
    // Parse date and time separately
    if (timeText) {
      const dateMatch = timeText.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+[A-Za-z]{3,}\s+\d{1,2}/i);
      if (dateMatch) {
        eventData.date = dateMatch[0];
      }
      
      const timeMatch = timeText.match(/\d{1,2}(?::\d{2})?\s*[AP]M/i);
      if (timeMatch) {
        eventData.time = timeMatch[0];
      }
    }
    
    console.log('Time extracted:', { timeText, date: eventData.date, time: eventData.time });
    
    // Clean title by removing time information and extra text
    let cleanTitle = title;
    if (timeText) {
      cleanTitle = cleanTitle.replace(timeText, '').trim();
    }
    
    // Remove interested/going counts from title
    cleanTitle = cleanTitle.replace(/\d+\s+interested/gi, '').trim();
    cleanTitle = cleanTitle.replace(/\d+\s+going/gi, '').trim();
    cleanTitle = cleanTitle.replace(/\d+\s+went/gi, '').trim();
    cleanTitle = cleanTitle.replace(/·/g, '').trim();
    cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
    
    eventData.title = cleanTitle;
    console.log('Clean title:', cleanTitle);
    
    // Extract interested count
    const interestedMatch = text.match(/(\d+)\s+interested/i);
    if (interestedMatch) {
      eventData.interested_count = parseInt(interestedMatch[1]);
    }
    
    // Extract going count  
    const goingMatch = text.match(/(\d+)\s+(?:going|went)/i);
    if (goingMatch) {
      eventData.going_count = parseInt(goingMatch[1]);
    }
    
    console.log('Counts:', { interested: eventData.interested_count, going: eventData.going_count });
    
    // Extract location by removing known elements from text
    let locationText = text;
    
    // Remove time text
    if (timeText) {
      locationText = locationText.replace(timeText, '');
    }
    
    // Remove title
    if (cleanTitle) {
      locationText = locationText.replace(cleanTitle, '');
    }
    
    // Remove counts
    locationText = locationText.replace(/\d+\s+interested/gi, '');
    locationText = locationText.replace(/\d+\s+(?:going|went)/gi, '');
    locationText = locationText.replace(/·/g, '');
    
    // Remove button text
    locationText = locationText.replace(/View on Facebook/gi, '');
    locationText = locationText.replace(/Show on Map/gi, '');
    locationText = locationText.replace(/Interested/gi, '');
    locationText = locationText.replace(/Share/gi, '');
    
    // Clean up and extract meaningful location
    locationText = locationText.replace(/\s+/g, ' ').trim();
    
    // Look for location patterns in the remaining text
    const locationPatterns = [
      // Finnish addresses with postal codes
      /[A-Za-zäöåÄÖÅ\s]+\d+[a-zA-Z]?,?\s*\d{5}\s+[A-Za-zäöåÄÖÅ]+/,
      // Street addresses
      /[A-Za-zäöåÄÖÅ]+(?:katu|tie|väylä|polku|puistikko)\s+\d+[a-zA-Z]?/i,
      // Venue names (substantial text that remains)
      /[A-Za-zäöåÄÖÅ\s&-]{8,50}/
    ];
    
    for (const pattern of locationPatterns) {
      const locationMatch = locationText.match(pattern);
      if (locationMatch) {
        const candidate = locationMatch[0].trim();
        if (candidate.length > 3) {
          eventData.location = candidate;
          break;
        }
      }
    }
    
    console.log('Location extracted:', eventData.location);
    
    // Create description
    eventData.description = text.substring(0, 150) + (text.length > 150 ? '...' : '');
    
    console.log('✓ Final structured event:', eventData);
    return eventData;
  }

  // Structure-based Event Card Parser - Extract data from predictable Facebook event card structure
  function parseEventCardByStructure(cardElement, eventId, eventUrl) {
    console.log(`\n=== STRUCTURE PARSING EVENT ${eventId} ===`);
    console.log('Card element:', cardElement);
    
    // Initialize event data structure
    const eventData = {
      id: eventId,
      title: '',
      url: eventUrl || `https://www.facebook.com/events/${eventId}`,
      date: '',
      time: '',
      time_text: '',
      start_ts: null,
      location: '',
      interested_count: 0,
      going_count: 0,
      description: ''
    };
    
    // Get all text content from the card in order
    const allTextNodes = [];
    const walker = document.createTreeWalker(
      cardElement,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text && text.length > 0) {
        allTextNodes.push(text);
      }
    }
    
    console.log('All text nodes in order:', allTextNodes);
    
    // Parse text nodes in order (Facebook's predictable structure)
    allTextNodes.forEach((text, index) => {
      console.log(`Text ${index}: "${text}"`);
      
      // Date patterns (Mon, Aug 4 | Fri, Aug 8 | Sat, Aug 9)
      if (!eventData.date && /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+[A-Za-z]{3,}\s+\d{1,2}$/.test(text)) {
        eventData.date = text;
        eventData.time_text = text;
        console.log('✓ Found date:', eventData.date);
        return;
      }
      
      // Time patterns (10 PM, 8:30 PM, etc.)
      if (!eventData.time && /^\d{1,2}(?::\d{2})?\s*[AP]M$/.test(text)) {
        eventData.time = text;
        if (eventData.time_text) {
          eventData.time_text += ' at ' + eventData.time;
        } else {
          eventData.time_text = eventData.time;
        }
        console.log('✓ Found time:', eventData.time);
        return;
      }
      
      // Interested count
      const interestedMatch = text.match(/^(\d+)\s+interested$/);
      if (interestedMatch) {
        eventData.interested_count = parseInt(interestedMatch[1]);
        console.log('✓ Found interested:', eventData.interested_count);
        return;
      }
      
      // Going count  
      const goingMatch = text.match(/^(\d+)\s+going$/);
      if (goingMatch) {
        eventData.going_count = parseInt(goingMatch[1]);
        console.log('✓ Found going:', eventData.going_count);
        return;
      }
      
      // Skip navigation/button text
      if (/^(?:View on Facebook|Show on Map|Happening now|Today at|Home|Your Events|Create|Notifications)$/.test(text)) {
        return;
      }
      
      // Title - usually the first substantial text that's not date/time/counts
      if (!eventData.title && text.length > 5 && text.length < 200 &&
          !/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(text) &&
          !/^\d{1,2}(?::\d{2})?\s*[AP]M$/.test(text) &&
          !/^\d+\s+(?:interested|going)$/.test(text)) {
        eventData.title = text;
        console.log('✓ Found title:', eventData.title);
        return;
      }
      
      // Location - substantial text that's not title/date/time/counts
      if (!eventData.location && text.length > 3 && text.length < 100 &&
          text !== eventData.title &&
          !/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(text) &&
          !/^\d{1,2}(?::\d{2})?\s*[AP]M$/.test(text) &&
          !/^\d+\s+(?:interested|going)$/.test(text)) {
        eventData.location = text;
        console.log('✓ Found location:', eventData.location);
        return;
      }
    });
    
    // Parse timestamp from date/time
    if (eventData.date || eventData.time) {
      const { start, label } = parseTimeLabel(eventData.time_text);
      eventData.start_ts = start ? start.getTime() : null;
    }
    
    // Create description from card text
    const fullText = cardElement.innerText?.replace(/\s+/g, ' ').trim();
    eventData.description = fullText?.substring(0, 150) + (fullText && fullText.length > 150 ? '...' : '') || '';
    
    console.log('✓ Final parsed event:', eventData);
    return eventData;
  }

  // DOM-based Event Card Parser - Extract structured data from Facebook event DOM elements  
  function parseEventCard(cardElement, eventId) {
    console.log(`\n=== DOM PARSING EVENT ${eventId} ===`);
    console.log('Card element:', cardElement);
    
    // Initialize event data structure
    const eventData = {
      id: eventId,
      title: '',
      url: `https://www.facebook.com/events/${eventId}`,
      date: '',
      time: '',
      time_text: '',
      start_ts: null,
      location: '',
      interested_count: 0,
      going_count: 0,
      description: ''
    };
    
    // Extract title from link text or aria-label
    const eventLink = cardElement.querySelector(`a[href*="/events/${eventId}"]`);
    if (eventLink) {
      eventData.title = (eventLink.textContent || eventLink.getAttribute('aria-label') || '').trim();
      console.log('Title from link:', eventData.title);
    }
    
    // Find all text nodes and elements for structured extraction
    const allElements = cardElement.querySelectorAll('*');
    const textElements = Array.from(allElements).filter(el => {
      const text = el.textContent?.trim();
      return text && text.length > 0 && !el.querySelector('*'); // Leaf elements only
    });
    
    console.log('Text elements found:', textElements.length);
    
    // Extract data from individual elements
    textElements.forEach((element, index) => {
      const text = element.textContent?.trim();
      if (!text) return;
      
      console.log(`Element ${index}: "${text}"`);
      
      // Date patterns (Mon, Aug 4 | Fri, Aug 8 | Sat, Aug 9)
      const dateMatch = text.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+[A-Za-z]{3,}\s+\d{1,2}$/i);
      if (dateMatch && !eventData.date) {
        eventData.date = dateMatch[0];
        eventData.time_text = dateMatch[0];
        console.log('✓ Found date:', eventData.date);
        return;
      }
      
      // Time patterns (10 PM, 8:30 PM, etc.)
      const timeMatch = text.match(/^\d{1,2}(?::\d{2})?\s*[AP]M$/i);
      if (timeMatch && !eventData.time) {
        eventData.time = timeMatch[0];
        if (eventData.time_text) {
          eventData.time_text += ' at ' + eventData.time;
        } else {
          eventData.time_text = eventData.time;
        }
        console.log('✓ Found time:', eventData.time);
        return;
      }
      
      // Interested count
      const interestedMatch = text.match(/^(\d+)\s+interested$/i);
      if (interestedMatch) {
        eventData.interested_count = parseInt(interestedMatch[1]);
        console.log('✓ Found interested:', eventData.interested_count);
        return;
      }
      
      // Going count  
      const goingMatch = text.match(/^(\d+)\s+going$/i);
      if (goingMatch) {
        eventData.going_count = parseInt(goingMatch[1]);
        console.log('✓ Found going:', eventData.going_count);
        return;
      }
      
      // Location patterns - venue names, addresses
      if (!eventData.location && text.length > 3 && text.length < 100) {
        // Check if it's likely a location (not a date, time, or count)
        if (!/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(text) &&
            !/^\d{1,2}(?::\d{2})?\s*[AP]M$/i.test(text) &&
            !/^\d+\s+(?:interested|going)$/i.test(text) &&
            !/^(?:View on Facebook|Show on Map|Happening now|Today at)$/i.test(text)) {
          
          // Look for location indicators
          if (/(?:katu|tie|väylä|polku|puistikko|\d{5}|Helsinki|Espoo|Vantaa)/i.test(text) ||
              text.includes(',') || 
              (text.length > 10 && /^[A-Za-zäöåÄÖÅ\s&-]+$/.test(text))) {
            eventData.location = text;
            console.log('✓ Found location:', eventData.location);
            return;
          }
        }
      }
      
      // If it's a substantial text that's not categorized yet, consider it for title
      if (!eventData.title && text.length > 10 && text.length < 200 &&
          !/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(text) &&
          !/^\d{1,2}(?::\d{2})?\s*[AP]M$/i.test(text) &&
          !/^\d+\s+(?:interested|going)$/i.test(text)) {
        eventData.title = text;
        console.log('✓ Found title candidate:', eventData.title);
      }
    });
    
    // Parse timestamp from date/time
    if (eventData.date || eventData.time) {
      const { start, label } = parseTimeLabel(eventData.time_text);
      eventData.start_ts = start ? start.getTime() : null;
    }
    
    // Create description from card text
    const fullText = cardElement.innerText?.replace(/\s+/g, ' ').trim();
    eventData.description = fullText?.substring(0, 150) + (fullText && fullText.length > 150 ? '...' : '') || '';
    
    console.log('✓ Final parsed event:', eventData);
    return eventData;
  }

  // Location Extraction Function
  function extractLocationFromText(text) {
    if (!text) return null;
    
    // Remove time patterns that might be confused with locations
    const timePatterns = [
      /\b\d{1,2}:\d{2}\s*[AP]M\b/gi,
      /\b\d{1,2}\s*[AP]M\b/gi,
      /\bHappening now\b/gi,
      /\bToday at\b/gi,
      /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*/gi,
      /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/gi,
      /\b\d+\s+interested\b/gi,
      /\b\d+\s+going\b/gi
    ];
    
    let cleanText = text;
    timePatterns.forEach(pattern => {
      cleanText = cleanText.replace(pattern, ' ');
    });
    
    // Look for location patterns (addresses, venue names)
    const locationPatterns = [
      // Finnish addresses with street numbers
      /\b[A-Za-zäöåÄÖÅ\s]+\s+\d+[a-zA-Z]?,\s*\d{5}\s+[A-Za-zäöåÄÖÅ]+/,
      // Venue names followed by address
      /\b[A-Za-zäöåÄÖÅ\s]{3,}\s+[A-Za-zäöåÄÖÅ]+\s+\d+/,
      // Just venue names (3+ words, not containing numbers)
      /\b[A-Za-zäöåÄÖÅ\s]{10,}(?=\s|$)/
    ];
    
    for (const pattern of locationPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const location = match[0].trim();
        // Validate it's not just time or number data
        if (!/^\d+\s*[AP]M$/i.test(location) && location.length > 3) {
          console.log(`Extracted location: "${location}" from text: "${text.substring(0, 100)}..."`);
          return location;
        }
      }
    }
    
    console.log(`No location found in text: "${text.substring(0, 100)}..."`);
    return null;
  }
  
  // Geocoding Functions
  async function geocodeEvents(events) {
    const mapWidth = 350; // Map container width minus padding
    const mapHeight = 220; // Map container height minus padding
    
    // Define Helsinki area bounds (approximate)
    const bounds = {
      north: 60.25,
      south: 60.10,
      east: 25.15,
      west: 24.75
    };
    
    console.log(`🗺️ Starting parallel geocoding for ${events.length} events...`);
    
    // Helper function to create grid position
    const createGridPosition = (index, total) => {
      const cols = Math.ceil(Math.sqrt(total));
      const rows = Math.ceil(total / cols);
      const cellWidth = mapWidth / cols;
      const cellHeight = mapHeight / rows;
      
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      // Add some randomness within the grid cell for natural look
      const gridX = col * cellWidth + cellWidth * 0.2 + Math.random() * cellWidth * 0.6;
      const gridY = row * cellHeight + cellHeight * 0.2 + Math.random() * cellHeight * 0.6;
      
      return {
        mapX: Math.max(10, Math.min(mapWidth + 10, gridX + 20)),
        mapY: Math.max(20, Math.min(mapHeight + 20, gridY + 30))
      };
    };
    
    // Process events in parallel with limited concurrency to avoid overwhelming the API
    const BATCH_SIZE = 5; // Process 5 locations at a time
    const geocodedEvents = [];
    let successfulGeocodings = 0;
    let geocodingBlocked = false;
    
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (event, batchIndex) => {
        const globalIndex = i + batchIndex;
        
        try {
          // Skip geocoding attempts if we've detected it's blocked
          if (!geocodingBlocked && event.location) {
            const coords = await Promise.race([
              geocodeLocation(event.location),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Geocoding timeout')), 3000))
            ]);
            
            if (coords) {
              // Convert lat/lng to map pixel coordinates
              const x = ((coords.lng - bounds.west) / (bounds.east - bounds.west)) * mapWidth + 20;
              const y = ((bounds.north - coords.lat) / (bounds.north - bounds.south)) * mapHeight + 30;
              
              // Ensure coordinates are within map bounds
              const mapX = Math.max(10, Math.min(mapWidth + 10, x));
              const mapY = Math.max(20, Math.min(mapHeight + 20, y));
              
              successfulGeocodings++;
              console.log(`✓ Geocoded "${event.location}" (${globalIndex + 1}/${events.length})`);
              
              return {
                ...event,
                lat: coords.lat,
                lng: coords.lng,
                mapX: mapX,
                mapY: mapY,
                geocoded: true
              };
            }
          }
        } catch (error) {
          // Detect if geocoding is being blocked by CSP
          if (error.message && (error.message.includes('NetworkError') || error.message.includes('blocked'))) {
            if (!geocodingBlocked) {
              console.warn('🚫 Geocoding blocked by Facebook CSP - using grid layout for remaining events');
              geocodingBlocked = true;
            }
          }
        }
        
        // Fallback: Use structured grid layout
        const gridPos = createGridPosition(globalIndex, events.length);
        return {
          ...event,
          ...gridPos,
          geocoded: false
        };
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      geocodedEvents.push(...batchResults);
      
      // Update progress if there are more batches
      if (i + BATCH_SIZE < events.length) {
        console.log(`🗺️ Progress: ${Math.min(i + BATCH_SIZE, events.length)}/${events.length} events processed...`);
      }
    }
    
    if (geocodingBlocked) {
      console.log(`🗺️ Geocoding complete: ${successfulGeocodings}/${events.length} geocoded (blocked by Facebook CSP), ${events.length - successfulGeocodings} using grid layout`);
    } else {
      console.log(`🗺️ Geocoding complete: ${successfulGeocodings}/${events.length} successfully geocoded, ${events.length - successfulGeocodings} using fallback positioning`);
    }
    
    return geocodedEvents;
  }
  
  async function geocodeLocation(locationString) {
    if (!locationString) return null;
    
    // Clean location string more thoroughly
    let cleanLocation = locationString
      .replace(/\d+\s+interested.*$/i, '') // Remove "X interested" text
      .replace(/\d+\s+going.*$/i, '') // Remove "X going" text
      .replace(/\s*,\s*Finland\s*$/i, '') // Remove trailing Finland
      .replace(/\s*,\s*Helsinki\s*$/i, '') // Remove trailing Helsinki
      .trim();
    
    // Extract address components
    const addressParts = cleanLocation.split(',').map(part => part.trim());
    const mainLocation = addressParts[0];
    
    console.log(`Geocoding: "${cleanLocation}" (original: "${locationString}")`);
    
    // Try multiple geocoding approaches with better specificity
    const geocoders = [
      // Try exact address first
      () => geocodeWithNominatim(cleanLocation + ', Helsinki, Finland'),
      // Try just the main part with Helsinki
      () => geocodeWithNominatim(mainLocation + ', Helsinki, Finland'),
      // Try with just Finland
      () => geocodeWithNominatim(cleanLocation + ', Finland'),
      // Try exact as-is
      () => geocodeWithNominatim(cleanLocation),
      // Try main location only
      () => geocodeWithNominatim(mainLocation)
    ];
    
    for (const geocoder of geocoders) {
      try {
        const result = await geocoder();
        if (result) {
          console.log(`Geocoded "${cleanLocation}" to:`, result);
          return result;
        }
      } catch (error) {
        continue;
      }
    }
    
    console.log(`Failed to geocode: "${cleanLocation}"`);
    return null;
  }
  
  async function geocodeWithNominatim(query) {
    // Use a CORS proxy to avoid network errors
    const corsProxy = 'https://api.allorigins.win/raw?url=';
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=fi`;
    const url = corsProxy + encodeURIComponent(nominatimUrl);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.log(`Geocoding failed for "${query}": ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      if (data && data.length > 0) {
        const result = data[0];
        const coords = {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon)
        };
        console.log(`Successfully geocoded "${query}" to:`, coords);
        return coords;
      }
    } catch (error) {
      console.error(`Geocoding error for "${query}":`, error);
      // Try direct approach as fallback
      try {
        const directUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=fi`;
        const directResponse = await fetch(directUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; EventsMapExtension/1.0)'
          }
        });
        
        if (directResponse.ok) {
          const directData = await directResponse.json();
          if (directData && directData.length > 0) {
            const result = directData[0];
            return {
              lat: parseFloat(result.lat),
              lng: parseFloat(result.lon)
            };
          }
        }
      } catch (fallbackError) {
        console.error('Fallback geocoding also failed:', fallbackError);
      }
    }
    
    return null;
  }
  
  // AI Chat Functions
  function addChatMessage(type, message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return null;
    
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      margin-bottom: 12px;
      padding: 8px 12px;
      border-radius: 12px;
      max-width: 80%;
      word-wrap: break-word;
      font-size: 12px;
      line-height: 1.4;
    `;
    
    if (type === 'user') {
      messageDiv.style.cssText += `
        background: #1877f2;
        color: white;
        margin-left: auto;
        text-align: right;
      `;
    } else {
      messageDiv.style.cssText += `
        background: #f0f2f5;
        color: #1c1e21;
        margin-right: auto;
      `;
    }
    
    messageDiv.innerHTML = formatMarkdown(message);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageDiv;
  }
  
  function addStreamingMessage() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return null;
    
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      margin-bottom: 12px;
      padding: 8px 12px;
      border-radius: 12px;
      max-width: 80%;
      word-wrap: break-word;
      font-size: 12px;
      line-height: 1.4;
      background: #f0f2f5;
      color: #1c1e21;
      margin-right: auto;
    `;
    
    messageDiv.innerHTML = '<span style="opacity: 0.6;">🤔 Thinking...</span>';
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageDiv;
  }
  
  function formatMarkdown(text) {
    if (!text) return '';
    
    return text
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic text
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Links [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #1877f2; text-decoration: none;">$1</a>')
      // Auto-link URLs
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: #1877f2; text-decoration: none;">$1</a>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre style="background: #f8f9fa; padding: 8px; border-radius: 4px; margin: 4px 0; overflow-x: auto;"><code>$1</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code style="background: #f8f9fa; padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>')
      // Line breaks
      .replace(/\n/g, '<br>')
      // Lists with better styling
      .replace(/^- (.+)$/gm, '<div style="margin: 4px 0; padding-left: 16px; position: relative;"><span style="position: absolute; left: 0;">•</span>$1</div>')
      .replace(/^\d+\. (.+)$/gm, '<div style="margin: 4px 0; padding-left: 20px; position: relative;"><span style="position: absolute; left: 0; font-weight: bold;">$1.</span>$1</div>');
  }
  
  async function streamGeminiResponse(question, messageElement) {
    const apiKey = await getApiKey();
    if (!apiKey) {
      messageElement.innerHTML = '❌ <strong>No API Key Found</strong><br><br>Please set your Gemini API key in the extension popup:<br>1. Click the extension icon<br>2. Enter your API key<br>3. Click "Save API Key"<br><br><a href="https://aistudio.google.com/app/apikey" target="_blank">Get your free API key →</a>';
      return;
    }
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:streamGenerateContent?key=${apiKey}`;
    
    const eventsContext = storedEvents.length > 0 
      ? storedEvents.map((event, index) => {
          const cleanTitle = event.title.split('interested')[0].split('going')[0].trim();
          const date = event.start_ts ? new Date(event.start_ts).toLocaleString() : 'Date not specified';
          return `Event ${index + 1}:
- **${cleanTitle}**
- Time: ${event.time_text} (${date})
- Location: ${event.location || 'Location not specified'}
- URL: ${event.url || 'URL not available'}`;
        }).join('\n\n')
      : 'No events are currently available.';
    
    const prompt = `You are an AI assistant helping users find and understand Facebook events in Helsinki.

**AVAILABLE EVENTS:**
${eventsContext}

**USER QUESTION:** ${question}

Please provide a helpful, well-formatted response about the events. Follow these formatting guidelines:

1. **Use markdown formatting** for better readability
2. **Create clickable links** for events using this format: [Event Name](URL)
3. **Use bullet points** for lists of events
4. **Include key details** like time, location, and attendance when relevant
5. **Be concise but informative** - focus on what the user asked for
6. **Format event information clearly** with proper line breaks and structure

Example format for event recommendations:
• **[Event Name](URL)** - Time: Date at Time, Location: Venue Name, Interest: X interested, Y going

Make your response easy to read and actionable for the user.`;
    
    try {
      const response = await fetch(apiUrl, {
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
        const errorData = await response.json();
        throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.candidates && data.candidates[0] && 
                  data.candidates[0].content && data.candidates[0].content.parts) {
                const newText = data.candidates[0].content.parts[0].text;
                fullText += newText;
                messageElement.innerHTML = formatMarkdown(fullText);
                
                // Auto-scroll to bottom
                const chatMessages = document.getElementById('chat-messages');
                if (chatMessages) {
                  chatMessages.scrollTop = chatMessages.scrollHeight;
                }
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }
      
      // Fallback to non-streaming if no content was streamed
      if (!fullText) {
        const fallbackResponse = await queryGeminiAIFallback(question);
        messageElement.innerHTML = formatMarkdown(fallbackResponse);
      }
      
    } catch (error) {
      console.error('Streaming error, falling back to regular API:', error);
      const fallbackResponse = await queryGeminiAIFallback(question);
      messageElement.innerHTML = formatMarkdown(fallbackResponse);
    }
  }
  
  async function queryGeminiAIFallback(question) {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return '❌ **No API Key Found**\n\nPlease set your Gemini API key in the extension popup:\n1. Click the extension icon\n2. Enter your API key\n3. Click "Save API Key"\n\n[Get your free API key →](https://aistudio.google.com/app/apikey)';
    }
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    
    const eventsContext = storedEvents.length > 0 
      ? storedEvents.map((event, index) => {
          const cleanTitle = event.title.split('interested')[0].split('going')[0].trim();
          const date = event.start_ts ? new Date(event.start_ts).toLocaleString() : 'Date not specified';
          return `Event ${index + 1}:
- **${cleanTitle}**
- Time: ${event.time_text} (${date})
- Location: ${event.location || 'Location not specified'}
- URL: ${event.url || 'URL not available'}`;
        }).join('\n\n')
      : 'No events are currently available.';
    
    const prompt = `You are an AI assistant helping users find and understand Facebook events in Helsinki.

**AVAILABLE EVENTS:**
${eventsContext}

**USER QUESTION:** ${question}

Please provide a helpful response about the events. Use markdown formatting for better readability. If asked about specific types of events, filter and recommend the most relevant ones with bullet points.`;
    
    const response = await fetch(apiUrl, {
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
      const errorData = await response.json();
      throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const responseData = await response.json();
    
    if (responseData.candidates && responseData.candidates.length > 0 &&
        responseData.candidates[0].content && responseData.candidates[0].content.parts &&
        responseData.candidates[0].content.parts.length > 0) {
      return responseData.candidates[0].content.parts[0].text;
    } else {
      return "No content received from API.";
    }
  }
  
  // API Key Management
  async function getApiKey() {
    try {
      const result = await chrome.storage.local.get('geminiApiKey');
      return result.geminiApiKey || null;
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }
  
  // Listen for API key updates from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'apiKeyUpdated') {
      console.log('API key updated:', request.apiKey ? 'Set' : 'Cleared');
      // Refresh welcome message if chat is open
      setTimeout(() => {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages && chatMessages.children.length === 1) {
          chatMessages.innerHTML = '';
          addWelcomeMessage();
        }
      }, 100);
    }
  });
  
  async function addWelcomeMessage() {
    const apiKey = await getApiKey();
    const message = apiKey 
      ? `Hello! I'm your AI assistant for Facebook events. I can help you find specific events, answer questions about what's available, and provide recommendations.\n\nI have access to ${storedEvents.length} events. What would you like to know?`
      : `Hello! I'm your AI assistant for Facebook events.\n\n⚠️ **API Key Required**: Please set your Gemini API key in the extension popup to use AI features.\n\n[Get your free API key →](https://aistudio.google.com/app/apikey)`;
    
    addChatMessage('ai', message);
  }
  
  // Initialize
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createWidget);
    } else {
      createWidget();
    }
    
    // Add welcome message to chat
    setTimeout(() => {
      const chatMessages = document.getElementById('chat-messages');
      if (chatMessages && chatMessages.children.length === 0) {
        addWelcomeMessage();
      }
    }, 1000);
  }
  
  init();
  
})();
