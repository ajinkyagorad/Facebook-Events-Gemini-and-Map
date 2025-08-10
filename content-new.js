// Facebook Events Extractor - Reliable Version
(function() {
  'use strict';
  
  console.log('Facebook Events Extension loaded');
  
  let extractionInProgress = false;
  let storedEvents = [];
  
  // Simple storage wrapper
  const storage = {
    set: (data) => {
      return new Promise((resolve, reject) => {
        try {
          if (typeof browser !== 'undefined' && browser.storage) {
            // Firefox
            browser.storage.local.set(data).then(resolve).catch(reject);
          } else if (typeof chrome !== 'undefined' && chrome.storage) {
            // Chrome/Chromium
            chrome.storage.local.set(data, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          } else {
            // Fallback to localStorage
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
            // Firefox
            browser.storage.local.get(['events']).then(resolve).catch(reject);
          } else if (typeof chrome !== 'undefined' && chrome.storage) {
            // Chrome/Chromium
            chrome.storage.local.get(['events'], (result) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(result);
              }
            });
          } else {
            // Fallback to localStorage
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
    // Simple location extraction
    const text = card.innerText || '';
    const locationMatch = text.match(/(?:at|@)\s+([^·\n,]+)/i);
    if (locationMatch) {
      return locationMatch[1].trim();
    }
    
    // Look for address-like patterns
    const addressMatch = text.match(/([A-Za-z\s]+\d+[^·\n,]*)/);
    if (addressMatch) {
      return addressMatch[1].trim();
    }
    
    return '';
  }

  // Create floating UI
  function createFloatingUI() {
    // Remove existing UI
    const existing = document.getElementById('fb-events-ui');
    if (existing) existing.remove();
    
    const container = document.createElement('div');
    container.id = 'fb-events-ui';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Extract button
    const extractBtn = document.createElement('button');
    extractBtn.id = 'extract-btn';
    extractBtn.innerHTML = '📥 Extract Events';
    extractBtn.style.cssText = `
      display: block;
      width: 140px;
      padding: 12px;
      background: #1877f2;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.2s;
    `;
    
    // Map button
    const mapBtn = document.createElement('button');
    mapBtn.id = 'map-btn';
    mapBtn.innerHTML = '🗺️ View Map';
    mapBtn.style.cssText = `
      display: block;
      width: 140px;
      padding: 12px;
      background: #42b883;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.2s;
    `;
    
    // Status display
    const status = document.createElement('div');
    status.id = 'status-display';
    status.style.cssText = `
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      text-align: center;
      margin-bottom: 8px;
    `;
    status.textContent = 'Ready';
    
    container.appendChild(status);
    container.appendChild(extractBtn);
    container.appendChild(mapBtn);
    
    // Event handlers
    extractBtn.addEventListener('click', extractEvents);
    mapBtn.addEventListener('click', openMap);
    
    // Hover effects
    [extractBtn, mapBtn].forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.05)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'scale(1)';
      });
    });
    
    document.body.appendChild(container);
    
    // Update status
    updateStatus();
  }
  
  async function updateStatus() {
    const statusEl = document.getElementById('status-display');
    if (!statusEl) return;
    
    try {
      const result = await storage.get();
      const events = result.events || [];
      storedEvents = events;
      
      const pageEvents = document.querySelectorAll('a[href*="/events/"]').length;
      const mappableEvents = events.filter(e => e.location).length;
      
      statusEl.textContent = `Page: ${pageEvents} | Stored: ${events.length} | Mappable: ${mappableEvents}`;
    } catch (error) {
      statusEl.textContent = 'Storage error';
      console.error('Status update error:', error);
    }
  }
  
  async function extractEvents() {
    if (extractionInProgress) return;
    
    extractionInProgress = true;
    const extractBtn = document.getElementById('extract-btn');
    const statusEl = document.getElementById('status-display');
    
    try {
      extractBtn.disabled = true;
      extractBtn.innerHTML = '⏳ Extracting...';
      statusEl.textContent = 'Starting extraction...';
      
      // Auto-scroll to load more events
      let lastHeight = 0;
      let scrollAttempts = 0;
      const maxScrolls = 20;
      
      while (scrollAttempts < maxScrolls) {
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(1000);
        
        const currentHeight = document.body.scrollHeight;
        if (currentHeight === lastHeight) {
          break;
        }
        
        lastHeight = currentHeight;
        scrollAttempts++;
        statusEl.textContent = `Loading... (${scrollAttempts}/${maxScrolls})`;
      }
      
      window.scrollTo(0, 0);
      statusEl.textContent = 'Processing events...';
      
      // Extract events
      const eventLinks = document.querySelectorAll('a[href*="/events/"]');
      const seen = new Map();
      
      console.log(`Found ${eventLinks.length} event links`);
      
      eventLinks.forEach(link => {
        const match = link.href.match(/\/events\/(\d{5,})/);
        if (!match) return;
        
        const id = match[1];
        if (seen.has(id)) return;
        
        const card = link.closest('[role="article"], div[class*="x1"]') || link.parentElement;
        const title = (link.textContent || link.getAttribute('aria-label') || '').trim();
        const text = (card?.innerText || '').replace(/\s+/g, ' ').trim();
        const location = extractLocation(card);
        
        // Parse time
        const timeMatch = text.match(/(?:Happening now|Today at \d{1,2}(?::\d{2})?\s*[AP]M|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3,}\s+\d{1,2}|\b[A-Za-z]{3,}\s+\d{1,2}\b)/i);
        const timeText = timeMatch ? timeMatch[0] : '';
        const { start, label } = parseTimeLabel(timeText);
        
        const eventData = {
          id,
          title,
          url: `https://www.facebook.com/events/${id}`,
          time_text: label || timeText || '',
          start_ts: start ? start.getTime() : null,
          location: location,
          description: text.substring(0, 200) + (text.length > 200 ? '...' : '')
        };
        
        seen.set(id, eventData);
      });
      
      const events = [...seen.values()].sort((a, b) => {
        if (a.start_ts === null && b.start_ts === null) return 0;
        if (a.start_ts === null) return 1;
        if (b.start_ts === null) return -1;
        return a.start_ts - b.start_ts;
      });
      
      console.log(`Extracted ${events.length} events`);
      
      // Store events
      await storage.set({ events });
      console.log('Events stored successfully');
      
      statusEl.textContent = `Extracted ${events.length} events!`;
      extractBtn.innerHTML = '✅ Extracted!';
      
      // Open map
      setTimeout(() => {
        openMap();
      }, 1000);
      
    } catch (error) {
      console.error('Extraction error:', error);
      statusEl.textContent = 'Extraction failed';
      extractBtn.innerHTML = '❌ Failed';
    } finally {
      extractionInProgress = false;
      setTimeout(() => {
        if (extractBtn) {
          extractBtn.disabled = false;
          extractBtn.innerHTML = '📥 Extract Events';
        }
        updateStatus();
      }, 2000);
    }
  }
  
  function openMap() {
    try {
      let mapUrl;
      
      if (typeof browser !== 'undefined' && browser.runtime) {
        mapUrl = browser.runtime.getURL('map.html');
      } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        mapUrl = chrome.runtime.getURL('map.html');
      } else {
        alert('Extension API not available');
        return;
      }
      
      console.log('Opening map:', mapUrl);
      const newWindow = window.open(mapUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
      
      if (!newWindow) {
        alert('Map window blocked by popup blocker. Please allow popups for Facebook.');
      }
    } catch (error) {
      console.error('Error opening map:', error);
      alert('Error opening map: ' + error.message);
    }
  }
  
  // Initialize
  function init() {
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createFloatingUI);
    } else {
      createFloatingUI();
    }
    
    // Update status periodically
    setInterval(updateStatus, 3000);
  }
  
  // Start
  init();
  
})();
