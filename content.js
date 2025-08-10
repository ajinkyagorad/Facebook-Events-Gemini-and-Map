// Facebook Events Extractor Content Script
(function() {
  'use strict';
  
  console.log('Facebook Events Extension loaded');

  // --- helpers ---
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

  // Extract location from event card
  function extractLocation(card) {
    const locationSelectors = [
      '[data-testid="event-permalink-details"] span',
      '.x1i10hfl[role="link"]',
      'a[href*="maps"]',
      'span:contains("·")'
    ];
    
    for (const selector of locationSelectors) {
      const elem = card.querySelector(selector);
      if (elem && elem.textContent.trim()) {
        const text = elem.textContent.trim();
        if (text.includes('·')) {
          const parts = text.split('·');
          return parts[parts.length - 1].trim();
        }
        return text;
      }
    }
    
    // Fallback: look for common location patterns in text
    const text = card.innerText || '';
    const locationMatch = text.match(/(?:at|@)\s+([^·\n]+)/i);
    return locationMatch ? locationMatch[1].trim() : '';
  }

  // Create floating action button with counter
  function createFloatingButton() {
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'fb-events-extractor-container';
    buttonContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
    `;

    const button = document.createElement('div');
    button.id = 'fb-events-extractor-btn';
    button.innerHTML = '📥';
    button.style.cssText = `
      width: 60px;
      height: 60px;
      background: #1877f2;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-size: 24px;
      transition: all 0.3s ease;
      position: relative;
    `;

    // Counter bubble
    const counter = document.createElement('div');
    counter.id = 'events-counter';
    counter.style.cssText = `
      position: absolute;
      top: -8px;
      right: -8px;
      background: #ff4757;
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      border: 2px solid white;
      display: none;
    `;

    // Status indicator
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'status-indicator';
    statusIndicator.style.cssText = `
      position: absolute;
      bottom: -5px;
      right: -5px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid white;
      display: none;
    `;

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'events-tooltip';
    tooltip.style.cssText = `
      position: absolute;
      bottom: 70px;
      right: 0;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
    `;
    tooltip.textContent = 'Extract events from this page';

    // Dedicated Map button (same size as main button)
    const mapButton = document.createElement('div');
    mapButton.id = 'map-btn';
    mapButton.innerHTML = '🗺️';
    mapButton.style.cssText = `
      width: 60px;
      height: 60px;
      background: #42b883;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-size: 24px;
      transition: all 0.3s ease;
      position: absolute;
      top: 80px;
      right: 0px;
      display: flex;
    `;

    // Map button counter
    const mapCounter = document.createElement('div');
    mapCounter.id = 'map-counter';
    mapCounter.style.cssText = `
      position: absolute;
      top: -8px;
      right: -8px;
      background: #2ed573;
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      border: 2px solid white;
      display: none;
    `;

    const mapTooltip = document.createElement('div');
    mapTooltip.id = 'map-tooltip';
    mapTooltip.style.cssText = `
      position: absolute;
      bottom: 70px;
      right: 0;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
    `;
    mapTooltip.textContent = 'Open events map';

    buttonContainer.appendChild(button);
    buttonContainer.appendChild(counter);
    buttonContainer.appendChild(statusIndicator);
    buttonContainer.appendChild(tooltip);
    buttonContainer.appendChild(mapButton);
    buttonContainer.appendChild(mapCounter);
    buttonContainer.appendChild(mapTooltip);
    
    // Main extraction button events
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
      tooltip.style.opacity = '1';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      tooltip.style.opacity = '0';
    });

    // Map button events
    mapButton.addEventListener('mouseenter', () => {
      mapButton.style.transform = 'scale(1.1)';
      mapTooltip.style.opacity = '1';
    });
    
    mapButton.addEventListener('mouseleave', () => {
      mapButton.style.transform = 'scale(1)';
      mapTooltip.style.opacity = '0';
    });
    
    // Button click handlers
    button.addEventListener('click', extractAndShowEvents);
    mapButton.addEventListener('click', openStoredEventsMap);
    document.body.appendChild(buttonContainer);

    // Update counter periodically
    updateEventCounter();
    setInterval(updateEventCounter, 2000);
  }

  // Update event counter and status
  function updateEventCounter() {
    const counter = document.getElementById('events-counter');
    const statusIndicator = document.getElementById('status-indicator');
    const tooltip = document.getElementById('events-tooltip');
    
    if (!counter || !statusIndicator || !tooltip) return;

    // Count visible events on page
    const eventLinks = document.querySelectorAll('a[href*="/events/"]');
    const uniqueEvents = new Set();
    
    eventLinks.forEach(link => {
      const match = link.href.match(/\/events\/(\d{5,})/);
      if (match) {
        uniqueEvents.add(match[1]);
      }
    });

    const eventCount = uniqueEvents.size;
    
    if (eventCount > 0) {
      counter.textContent = eventCount;
      counter.style.display = 'flex';
      statusIndicator.style.display = 'block';
      statusIndicator.style.background = '#2ed573'; // Green for events found
      tooltip.textContent = `${eventCount} events found - Click to extract and map them`;
    } else {
      counter.style.display = 'none';
      statusIndicator.style.display = 'block';
      statusIndicator.style.background = '#ffa502'; // Orange for no events
      tooltip.textContent = 'No events found on this page';
    }

    // Check if we have stored events and update map button
    chrome.storage.local.get(['events'], (result) => {
      const storedEvents = result.events || [];
      const mapCounter = document.getElementById('map-counter');
      const mapTooltip = document.getElementById('map-tooltip');
      
      if (storedEvents.length > 0) {
        const mappedEvents = storedEvents.filter(event => event.location).length;
        tooltip.textContent = `${eventCount} events on page | ${storedEvents.length} stored | ${mappedEvents} mappable`;
        
        // Show map counter with stored events count
        if (mapCounter) {
          mapCounter.textContent = storedEvents.length;
          mapCounter.style.display = 'flex';
        }
        
        // Update map tooltip
        if (mapTooltip) {
          mapTooltip.textContent = `View ${storedEvents.length} stored events (${mappedEvents} mappable)`;
        }
      } else {
        // Hide map counter if no stored events
        if (mapCounter) {
          mapCounter.style.display = 'none';
        }
        
        if (mapTooltip) {
          mapTooltip.textContent = 'No events stored yet - extract some first!';
        }
      }
    });
  }

  // Update button status during extraction
  function updateButtonStatus(status, message) {
    const button = document.getElementById('fb-events-extractor-btn');
    const tooltip = document.getElementById('events-tooltip');
    const statusIndicator = document.getElementById('status-indicator');
    
    if (!button || !tooltip || !statusIndicator) return;

    switch (status) {
      case 'extracting':
        button.innerHTML = '⏳';
        button.style.pointerEvents = 'none';
        statusIndicator.style.background = '#3742fa'; // Blue for processing
        tooltip.textContent = message || 'Extracting events...';
        break;
      case 'success':
        button.innerHTML = '✅';
        statusIndicator.style.background = '#2ed573'; // Green for success
        tooltip.textContent = message || 'Events extracted successfully!';
        setTimeout(() => {
          button.innerHTML = '🗺️';
          button.style.pointerEvents = 'auto';
          updateEventCounter();
        }, 2000);
        break;
      case 'error':
        button.innerHTML = '❌';
        statusIndicator.style.background = '#ff4757'; // Red for error
        tooltip.textContent = message || 'Error extracting events';
        setTimeout(() => {
          button.innerHTML = '🗺️';
          button.style.pointerEvents = 'auto';
          updateEventCounter();
        }, 3000);
        break;
      default:
        button.innerHTML = '🗺️';
        button.style.pointerEvents = 'auto';
        updateEventCounter();
    }
  }

  // Main extraction function
  async function extractAndShowEvents() {
    updateButtonStatus('extracting', 'Starting extraction...');

    try {
      // Auto-scroll to load more events
      updateButtonStatus('extracting', 'Loading more events...');
      let lastH = 0, tEnd = Date.now() + 15000;
      let scrollCount = 0;
      
      while (Date.now() < tEnd) {
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(800);
        const h = document.body.scrollHeight;
        if (h === lastH) {
          await sleep(800);
        } else {
          scrollCount++;
          updateButtonStatus('extracting', `Loaded ${scrollCount} sections...`);
        }
        lastH = h;
      }
      window.scrollTo(0, 0);
      
      updateButtonStatus('extracting', 'Processing events...');

      // Extract events
      const seen = new Map();
      const anchors = [...document.querySelectorAll('a[href*="/events/"]')];
      console.log('Found event links:', anchors.length);

      anchors.forEach(a => {
        const m = a.href.match(/\/events\/(\d{5,})/);
        if (!m) return;
        const id = m[1];
        if (seen.has(id)) return;

        const card = a.closest('[role="article"], [role="button"], [class*="x1n2onr6"], [class*="xdt5ytf"]') || a.closest('div') || a.parentElement;
        const title = (a.textContent || a.getAttribute('aria-label') || '').trim();
        const text = (card?.innerText || '').replace(/\s+/g,' ').trim();
        const location = extractLocation(card);

        const timeHit =
          (text.match(/Happening now/i) && text.match(/Happening now.*?(?=$)/i)) ||
          text.match(/Today at\s+\d{1,2}(?::\d{2})?\s*[AP]M/i) ||
          text.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3,}\s+\d{1,2}(?:.*?[AP]M)?/i) ||
          text.match(/\b[A-Za-z]{3,}\s+\d{1,2}\b/);

        const timeText = timeHit ? timeHit[0] : '';
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
        
        console.log('Found event:', eventData);
        seen.set(id, eventData);
      });

      const events = [...seen.values()].sort((a, b) => {
        if (a.start_ts === null && b.start_ts === null) return 0;
        if (a.start_ts === null) return 1;
        if (b.start_ts === null) return -1;
        return a.start_ts - b.start_ts;
      });

      const mappableEvents = events.filter(event => event.location).length;
      
      console.log('About to store events:', events.length);
      
      // Store events and open map
      chrome.storage.local.set({ events }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          updateButtonStatus('error', 'Failed to store events');
          return;
        }
        
        console.log('Events stored successfully:', events.length);
        
        // Verify storage
        chrome.storage.local.get(['events'], (result) => {
          console.log('Verification - stored events:', result.events?.length || 0);
        });
        
        updateButtonStatus('success', `Extracted ${events.length} events (${mappableEvents} mappable)`);
        
        // Update counter to show view map button
        setTimeout(() => {
          updateEventCounter();
        }, 500);
        
        try {
          const mapUrl = chrome.runtime.getURL('map.html');
          console.log('Opening map URL:', mapUrl);
          const newWindow = window.open(mapUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
          
          if (!newWindow) {
            console.error('Failed to open window - popup blocked?');
            alert('Map window was blocked. Please allow popups for this site and try again.');
          } else {
            console.log('Map window opened successfully');
          }
        } catch (error) {
          console.error('Error opening map:', error);
          alert('Error opening map: ' + error.message);
        }
      });

    } catch (error) {
      console.error('Error extracting events:', error);
      updateButtonStatus('error', 'Failed to extract events');
    }
  }

  // Function to open stored events map
  function openStoredEventsMap() {
    console.log('Opening stored events map...');
    
    chrome.storage.local.get(['events'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        alert('Error accessing stored events');
        return;
      }
      
      const events = result.events || [];
      console.log('Found stored events:', events.length);
      console.log('Events data:', events);
      
      if (events.length > 0) {
        try {
          const mapUrl = chrome.runtime.getURL('map.html');
          console.log('Opening map with stored events:', mapUrl);
          const newWindow = window.open(mapUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
          
          if (!newWindow) {
            console.error('Map window blocked by popup blocker');
            alert('Map window was blocked. Please allow popups for Facebook and try again.');
          } else {
            console.log('Map window opened successfully');
          }
        } catch (error) {
          console.error('Error opening map window:', error);
          alert('Error opening map: ' + error.message);
        }
      } else {
        alert('No events stored yet. Click the extraction button (📥) first to extract events from this page!');
      }
    });
  }

  // Initialize when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatingButton);
  } else {
    createFloatingButton();
  }

})();
