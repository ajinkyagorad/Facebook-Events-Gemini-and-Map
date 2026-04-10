// Facebook Events Extractor - Based on XPath structure
(async () => {
  console.log('🔍 Starting Facebook Events extraction...');

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Scroll to load all events
  console.log('📜 Scrolling to load all events...');
  let lastHeight = 0;
  for (let i = 0; i < 20; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(2000);
    const newHeight = document.body.scrollHeight;
    if (newHeight === lastHeight) break;
    lastHeight = newHeight;
    console.log(`Scroll ${i + 1}/20, height: ${newHeight}`);
  }
  window.scrollTo(0, 0);
  await sleep(1000);

  const events = [];
  const seenIds = new Set();

  // Find all event cards
  const eventCards = document.querySelectorAll('div.x1n2onr6');
  console.log(`Found ${eventCards.length} event cards`);

  for (const card of eventCards) {
    // Find the event link
    const eventLink = card.querySelector('a[href*="/events/"]');
    if (!eventLink) continue;

    const urlMatch = eventLink.href.match(/\/events\/(\d+)/);
    if (!urlMatch) continue;
    const eventId = urlMatch[1];
    if (seenIds.has(eventId)) continue;

    // Get the content div (div[2] in your XPath)
    const contentDiv = eventLink.querySelector('div:nth-of-type(2)');
    if (!contentDiv) continue;

    // === Extract TIME (div[1] inside content div) ===
    let timeText = '';
    const timeDiv = contentDiv.querySelector('div:nth-of-type(1)');
    if (timeDiv) {
      const timeSpan = timeDiv.querySelector('span');
      if (timeSpan) {
        timeText = timeSpan.textContent?.trim() || '';
      }
    }

    // === Extract TITLE (div[2] inside content div) ===
    let title = '';
    const titleDiv = contentDiv.querySelector('div:nth-of-type(2)');
    if (titleDiv) {
      const titleSpan = titleDiv.querySelector('span span');
      if (titleSpan) {
        title = titleSpan.textContent?.trim() || '';
      }
      // Fallback
      if (!title) {
        const allSpans = titleDiv.querySelectorAll('span');
        for (const span of allSpans) {
          const text = span.textContent?.trim() || '';
          if (text.length > 5 && !text.match(/interested|going/i)) {
            title = text;
            break;
          }
        }
      }
    }

    // === Extract ADDRESS (div[3] inside content div) ===
    let address = '';
    const addressDiv = contentDiv.querySelector('div:nth-of-type(3)');
    if (addressDiv) {
      const addressSpan = addressDiv.querySelector('span');
      if (addressSpan) {
        address = addressSpan.textContent?.trim() || '';
      }
    }

    // === Extract ORGANIZER (often appears before or after title) ===
    let organizer = '';
    const allSpans = contentDiv.querySelectorAll('span');
    for (const span of allSpans) {
      const text = span.textContent?.trim() || '';
      if (text && text !== title && text !== timeText && text !== address &&
          !text.match(/\d/) && !text.match(/interested|going/i) &&
          text.length > 2 && text.length < 80) {
        organizer = text;
        break;
      }
    }

    // === Extract ATTENDANCE from full card text ===
    const fullText = card.textContent || '';
    let interested = 0, going = 0;
    const interestedMatch = fullText.match(/(\d+)\s+interested/i);
    if (interestedMatch) interested = parseInt(interestedMatch[1]);
    const goingMatch = fullText.match(/(\d+)\s+going/i);
    if (goingMatch) going = parseInt(goingMatch[1]);

    // === Extract IMAGE ===
    let imageUrl = '';
    const img = card.querySelector('img');
    if (img && img.src && !img.src.includes('emoji')) {
      imageUrl = img.src;
    }

    // === Parse timestamp from timeText ===
    let timestamp = null;
    if (timeText) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const day = now.getDate();

      if (timeText.includes('Today at')) {
        const timeMatch = timeText.match(/(\d{1,2})(?::(\d{2}))?\s*([AP]M)/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const isPM = timeMatch[3].toUpperCase() === 'PM';
          if (isPM && hours !== 12) hours += 12;
          if (!isPM && hours === 12) hours = 0;
          timestamp = new Date(year, month, day, hours, minutes).getTime();
        }
      } else if (timeText.includes('Tomorrow at')) {
        const timeMatch = timeText.match(/(\d{1,2})(?::(\d{2}))?\s*([AP]M)/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const isPM = timeMatch[3].toUpperCase() === 'PM';
          if (isPM && hours !== 12) hours += 12;
          if (!isPM && hours === 12) hours = 0;
          timestamp = new Date(year, month, day + 1, hours, minutes).getTime();
        }
      } else if (timeText.includes('Happening now')) {
        timestamp = Date.now();
      } else if (timeText.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3,}\s+\d{1,2}/i)) {
        // Date without specific time - keep as is
        timestamp = null;
      }
    }

    // === Build location object ===
    const location = {
      query_string: address,
      google_maps_link: address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '',
      components: { street: '', postal_code: '', city: '', country: '' }
    };

    if (address) {
      const streetMatch = address.match(/^([^,]+?)\s*,\s*(\d{5})/);
      if (streetMatch) {
        location.components.street = streetMatch[1].trim();
        location.components.postal_code = streetMatch[2];
      } else {
        const simpleStreet = address.match(/^([A-Za-z]+(?:katu|tie|polku|kuja|tori)\s+\d+)/i);
        if (simpleStreet) location.components.street = simpleStreet[1];
        const postalMatch = address.match(/(\d{5})/);
        if (postalMatch) location.components.postal_code = postalMatch[1];
      }
      if (address.includes('Helsinki')) {
        location.components.city = 'Helsinki';
        location.components.country = 'Finland';
      }
    }

    if (title && title.length > 2) {
      events.push({
        index: events.length + 1,
        id: eventId,
        name: title,
        organizer: organizer,
        date: timeText,
        time_text: timeText,
        start_timestamp: timestamp,
        location: location,
        image_url: imageUrl,
        interested_count: interested,
        going_count: going,
        url: eventLink.href
      });

      seenIds.add(eventId);
      console.log(`✅ ${events.length}. ${title.substring(0, 45)} | ${timeText || 'No time'}`);
    }
  }

  // Sort by timestamp
  events.sort((a, b) => (a.start_timestamp || Infinity) - (b.start_timestamp || Infinity));
  events.forEach((e, i) => e.index = i + 1);

  window.eventsData = {
    total_events: events.length,
    extracted_at: new Date().toISOString(),
    source_url: window.location.href,
    events: events
  };

  console.log(`\n📊 Total events extracted: ${events.length}`);

  // Show sample
  if (events.length > 0) {
    console.log('\n📋 Sample event (first in list):');
    console.log(JSON.stringify(events[0], null, 2));
  }

  console.log('\n📋 Quick summary (first 10 events):');
  console.table(events.slice(0, 10).map(e => ({
    '#': e.index,
    'Event': e.name.substring(0, 35),
    'Time': e.time_text,
    '📍': e.location.components.street || 'No address',
    '👍': e.interested_count,
    '✅': e.going_count
  })));

  // Copy to clipboard
  try {
    await navigator.clipboard.writeText(JSON.stringify(window.eventsData, null, 2));
    console.log('\n📋 Full JSON copied to clipboard!');
    console.log(`💾 File size: ${(JSON.stringify(window.eventsData).length / 1024).toFixed(2)} KB`);
  } catch (err) {
    console.log('\n❌ Could not copy to clipboard');
  }

  console.log('\n🎉 Extraction complete! Type "eventsData" to access the data.');
  return window.eventsData;
})();
