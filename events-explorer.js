// Facebook Events Explorer - Experimental Interface
(function() {
    'use strict';

    // Data model and state
    let rawEvents = [];
    let processedEvents = [];
    let filteredEvents = [];
    let currentFilters = {
        dayBucket: 'all',
        types: new Set(),
        neighbourhoods: new Set(),
        priceRanges: new Set(),
        minPopularity: 0,
        outdoors: false,
        beginner: false,
        liveMusic: false,
        hideCancelled: true,
        search: ''
    };
    let currentSort = 'popularity';
    let currentView = 'grid';

    // Event type mapping and colors
    const eventTypes = {
        dance: { label: 'Dance', color: '#e91e63', keywords: ['salsa', 'bachata', 'zouk', 'tango', 'milonga', 'lambada', 'swing', 'balboa', 'jive', 'dance'] },
        music: { label: 'Music', color: '#9c27b0', keywords: ['live', 'concert', 'duo', 'band', 'festival', 'organ', 'dj', 'set', 'music', 'gig'] },
        festival: { label: 'Festival', color: '#ff9800', keywords: ['festival', 'fest', 'celebration', 'carnival'] },
        market: { label: 'Market/Kirppis', color: '#4caf50', keywords: ['kirppis', 'market', 'myynti', 'outlet', 'fleamarket', 'myyjäiset'] },
        sport: { label: 'Sport', color: '#2196f3', keywords: ['run', 'juoksu', 'sm', 'cup', 'fencing', 'nyrkkeily', 'hockey', 'kalastus', 'skate', 'sport'] },
        family: { label: 'Family/Kids', color: '#ff5722', keywords: ['lasten', 'perhe', 'kids', 'puistojuhla', 'family', 'children'] },
        wellness: { label: 'Wellness/Yoga', color: '#8bc34a', keywords: ['yoga', 'jooga', 'pilates', 'sointukylpy', 'yin', 'acroyoga', 'meditaatio', 'wellness'] },
        theatre: { label: 'Theatre/Film', color: '#795548', keywords: ['teatteri', 'näytös', 'film', 'movie', 'ooppera', 'theatre', 'cinema'] },
        talk: { label: 'Talk/Panel', color: '#607d8b', keywords: ['talk', 'panel', 'discussion', 'lecture', 'seminar', 'workshop'] },
        art: { label: 'Art/Exhibition', color: '#f44336', keywords: ['art', 'exhibition', 'gallery', 'museo', 'näyttely', 'taide'] },
        nightlife: { label: 'Nightlife/Club', color: '#673ab7', keywords: ['club', 'kaiku', 'ääniwalli', 'on the rocks', 'infektio', 'techno', 'nightlife'] },
        religion: { label: 'Religion/Ritual', color: '#3f51b5', keywords: ['church', 'kirkko', 'religion', 'spiritual', 'ritual'] },
        food: { label: 'Food/Drink', color: '#ff9800', keywords: ['food', 'drink', 'restaurant', 'cafe', 'ruoka', 'juoma', 'cooking'] },
        misc: { label: 'Miscellaneous', color: '#9e9e9e', keywords: [] }
    };

    // Helsinki neighbourhoods
    const neighbourhoods = [
        'Kallio', 'Töölö', 'Lauttasaari', 'Herttoniemi', 'Punavuori', 'Kamppi', 'Kruununhaka', 
        'Ullanlinna', 'Eira', 'Katajanokka', 'Sörnäinen', 'Arabianranta', 'Vuosaari', 
        'Mellunkylä', 'Kontula', 'Malmi', 'Jakomäki', 'Pikku Huopalahti', 'Munkkiniemi'
    ];

    // Initialize timeline controls
    function initializeTimelineControls() {
        const compressBtn = document.getElementById('compressBtn');
        const expandBtn = document.getElementById('expandBtn');
        const timelineHours = document.getElementById('timelineHours');

        compressBtn.addEventListener('click', () => {
            timelineHours.classList.add('compressed');
            compressBtn.classList.add('active');
            expandBtn.classList.remove('active');
        });

        expandBtn.addEventListener('click', () => {
            timelineHours.classList.remove('compressed');
            expandBtn.classList.add('active');
            compressBtn.classList.remove('active');
        });
    }

    // Initialize the application
    async function init() {
        await loadEventsFromStorage();
        setupEventListeners();
        populateFilters();
        initializeTimelineControls();
    }

    // Load events from extension storage
    async function loadEventsFromStorage() {
        try {
            let events = [];
            
            console.log('Attempting to load events from storage...');
            
            // Try to get events from extension storage
            if (typeof chrome !== 'undefined' && chrome.storage) {
                console.log('Using Chrome storage API');
                const result = await new Promise((resolve, reject) => {
                    chrome.storage.local.get(['events'], (result) => {
                        if (chrome.runtime.lastError) {
                            console.error('Chrome storage error:', chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(result);
                        }
                    });
                });
                events = result.events || [];
                console.log('Chrome storage result:', result);
            } else if (typeof browser !== 'undefined' && browser.storage) {
                console.log('Using Firefox storage API');
                const result = await browser.storage.local.get(['events']);
                events = result.events || [];
                console.log('Firefox storage result:', result);
            } else {
                console.log('Using localStorage fallback');
                // Fallback to localStorage
                const stored = localStorage.getItem('fb_events');
                events = stored ? JSON.parse(stored) : [];
                console.log('localStorage result:', events);
            }

            rawEvents = events;
            console.log(`Successfully loaded ${events.length} events from storage`);
            
            // Process events immediately after loading
            if (events.length > 0) {
                processEvents();
                applyFilters();
                updateStats();
            } else {
                console.log('No events found, generating sample data');
                rawEvents = generateSampleEvents();
                processEvents();
                applyFilters();
                updateStats();
            }
        } catch (error) {
            console.error('Error loading events:', error);
            console.log('Falling back to sample events');
            rawEvents = generateSampleEvents();
            processEvents();
            applyFilters();
            updateStats();
        }
    }

    // Generate sample events for demonstration
    function generateSampleEvents() {
        const sampleEvents = [
            {
                id: 1,
                title: "Salsa Night at Kaiku",
                description: "Latin dance night with live music and beginner classes",
                time_text: "Tonight 20:00",
                location: "Kaiku, Katajanokka",
                interested_count: 45,
                going_count: 12,
                url: "https://facebook.com/events/123"
            },
            {
                id: 2,
                title: "Kirpputori Kauppatori",
                description: "Flea market at the market square",
                time_text: "Tomorrow 10:00",
                location: "Kauppatori, Kruununhaka",
                interested_count: 23,
                going_count: 8,
                url: "https://facebook.com/events/124"
            },
            {
                id: 3,
                title: "Yoga in Töölönlahti Park",
                description: "Free outdoor yoga session for beginners",
                time_text: "Today 18:00",
                location: "Töölönlahti Park, Töölö",
                interested_count: 67,
                going_count: 34,
                url: "https://facebook.com/events/125"
            },
            {
                id: 4,
                title: "Jazz Concert at Savoy Theatre",
                description: "Evening of smooth jazz with Helsinki Jazz Trio",
                time_text: "Sat, Nov 30 19:30",
                location: "Savoy Theatre, Punavuori",
                interested_count: 156,
                going_count: 89,
                url: "https://facebook.com/events/126"
            },
            {
                id: 5,
                title: "Kids Festival at Suomenlinna",
                description: "Family-friendly activities and games",
                time_text: "Sun, Dec 1 12:00",
                location: "Suomenlinna, Suomenlinna",
                interested_count: 234,
                going_count: 67,
                url: "https://facebook.com/events/127"
            }
        ];
        
        console.log('Using sample events for demonstration');
        return sampleEvents;
    }

    // Process raw events into structured format
    function processEvents() {
        processedEvents = rawEvents.map((event, index) => {
            const processed = {
                id: event.id || index + 1,
                title: event.title || 'Untitled Event',
                type: deriveEventType(event),
                when_label: event.time_text || event.date || 'Time TBD',
                start_dt: parseDateTime(event),
                end_dt: null, // Not available in current data
                day_bucket: deriveDayBucket(event),
                venue: extractVenue(event.location || ''),
                address: event.location || 'Location TBD',
                neighbourhood: deriveNeighbourhood(event.location || ''),
                organizer: event.organizer || '',
                interested: event.interested_count || 0,
                going: event.going_count || 0,
                popularity: calculatePopularity(event.going_count || 0, event.interested_count || 0),
                price: derivePrice(event),
                link: event.url || '',
                notes: event.description || '',
                tags: deriveTags(event),
                cancelled: isCancelled(event),
                score: 0 // Will be calculated later
            };
            
            processed.score = calculateSmartScore(processed);
            return processed;
        });

        console.log(`Processed ${processedEvents.length} events`);
    }

    // Derive event type from content
    function deriveEventType(event) {
        const text = `${event.title || ''} ${event.description || ''} ${event.location || ''}`.toLowerCase();
        
        for (const [type, config] of Object.entries(eventTypes)) {
            if (config.keywords.some(keyword => text.includes(keyword))) {
                return type;
            }
        }
        
        return 'misc';
    }

    // Parse date/time from event
    function parseDateTime(event) {
        if (!event.time_text && !event.date) return null;
        
        const timeText = event.time_text || event.date || '';
        const now = new Date();
        
        // Extract time from various formats
        let timeMatch = null;
        let baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Handle "Today at HH:MM" or "Today at H:MM AM/PM"
        if (timeText.includes('Today')) {
            timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i) || timeText.match(/(\d{1,2})\s*(AM|PM)/i);
            baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        // Handle "Tomorrow at HH:MM"
        else if (timeText.includes('Tomorrow')) {
            timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i) || timeText.match(/(\d{1,2})\s*(AM|PM)/i);
            baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        }
        // Handle specific dates like "Mon, Dec 2 at 18:30"
        else {
            timeMatch = timeText.match(/(\d{1,2}):(\d{2})/i) || timeText.match(/(\d{1,2})\s*(AM|PM)/i);
            // Try to parse the date part
            const dateMatch = timeText.match(/(\w{3}),?\s+(\w{3})\s+(\d{1,2})/i);
            if (dateMatch) {
                const monthName = dateMatch[2].toLowerCase();
                const day = parseInt(dateMatch[3]);
                const monthMap = {
                    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
                };
                const month = monthMap[monthName.substring(0, 3)];
                if (month !== undefined) {
                    baseDate = new Date(now.getFullYear(), month, day);
                }
            }
        }
        
        if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            let minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const ampm = timeMatch[3] || timeMatch[2]; // Handle both "HH:MM AM" and "H AM" formats
            
            // Convert 12-hour to 24-hour format
            if (ampm && ampm.toLowerCase().includes('pm') && hours !== 12) {
                hours += 12;
            } else if (ampm && ampm.toLowerCase().includes('am') && hours === 12) {
                hours = 0;
            }
            
            baseDate.setHours(hours, minutes, 0, 0);
            return baseDate;
        }
        
        // Fallback: try to parse the entire string
        try {
            const parsed = new Date(timeText);
            if (!isNaN(parsed.getTime())) {
                return parsed;
            }
        } catch {
            // Ignore parsing errors
        }
        
        return baseDate; // Return date with 00:00 time if no time found
    }

    // Derive day bucket for event
    function deriveDayBucket(event) {
        const timeText = (event.time_text || event.date || '').toLowerCase();
        
        if (timeText.includes('happening now')) return 'happening_now';
        if (timeText.includes('today')) return 'today';
        if (timeText.includes('tonight')) return 'tonight';
        if (timeText.includes('tomorrow')) return 'tomorrow';
        
        const startDate = parseDateTime(event);
        if (!startDate) return 'later';
        
        const now = new Date();
        const daysDiff = Math.floor((startDate - now) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 0) return 'today';
        if (daysDiff === 1) return 'tomorrow';
        if (daysDiff <= 7) return 'this_week';
        return 'later';
    }

    // Extract venue name from location
    function extractVenue(location) {
        if (!location) return '';
        
        // Split by comma and take first part as venue
        const parts = location.split(',');
        return parts[0].trim();
    }

    // Derive neighbourhood from location
    function deriveNeighbourhood(location) {
        if (!location) return '';
        
        const locationLower = location.toLowerCase();
        
        for (const neighbourhood of neighbourhoods) {
            if (locationLower.includes(neighbourhood.toLowerCase())) {
                return neighbourhood;
            }
        }
        
        return '';
    }

    // Calculate popularity score
    function calculatePopularity(going, interested) {
        return going * 1.0 + interested * 0.2;
    }

    // Derive price information
    function derivePrice(event) {
        const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
        
        if (text.includes('free') || text.includes('ilmainen')) return 'free';
        
        const priceMatch = text.match(/(\d+)\s*€/);
        if (priceMatch) {
            const price = parseInt(priceMatch[1]);
            if (price < 10) return '<10';
            if (price <= 20) return '10-20';
            return '>20';
        }
        
        return 'unknown';
    }

    // Derive tags from event content
    function deriveTags(event) {
        const tags = [];
        const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
        
        // Add type-specific tags
        const type = deriveEventType(event);
        if (eventTypes[type]) {
            tags.push(...eventTypes[type].keywords.filter(keyword => text.includes(keyword)));
        }
        
        // Special tags
        if (text.includes('venetsialaiset') || text.includes('venetian')) tags.push('venetsialaiset');
        if (text.includes('beginner') || text.includes('alkeistaso')) tags.push('beginner');
        if (text.includes('outdoor') || text.includes('ulko') || text.includes('puisto')) tags.push('outdoors');
        if (text.includes('live music') || text.includes('live')) tags.push('live_music');
        
        return [...new Set(tags)]; // Remove duplicates
    }

    // Check if event is cancelled
    function isCancelled(event) {
        const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
        return text.includes('peruttu') || text.includes('cancelled');
    }

    // Calculate smart score for ranking
    function calculateSmartScore(event) {
        const popularityNorm = Math.min(event.popularity / 100, 1); // Normalize to 0-1
        const timeFit = calculateTimeFit(event);
        const typeMatch = 0.5; // Default since we don't have user preferences
        const distanceNorm = 0.5; // Default since we don't have location
        const novelty = 0.5; // Default
        
        return 0.45 * popularityNorm + 0.25 * timeFit + 0.15 * typeMatch + 0.10 * distanceNorm + 0.05 * novelty;
    }

    // Calculate time fit score
    function calculateTimeFit(event) {
        if (!event.start_dt) return 0.5;
        
        const now = new Date();
        const eventTime = new Date(event.start_dt);
        const hoursDiff = Math.abs(eventTime - now) / (1000 * 60 * 60);
        
        // Prefer events happening soon
        if (hoursDiff < 2) return 1;
        if (hoursDiff < 24) return 0.8;
        if (hoursDiff < 72) return 0.6;
        return 0.3;
    }

    // Setup event listeners
    function setupEventListeners() {
        // Search
        document.getElementById('searchBox').addEventListener('input', (e) => {
            currentFilters.search = e.target.value.toLowerCase();
            applyFilters();
        });

        // Sort
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            currentSort = e.target.value;
            renderEvents();
        });

        // View toggles
        document.getElementById('gridView').addEventListener('click', () => setView('grid'));
        document.getElementById('mapView').addEventListener('click', () => setView('map'));
        document.getElementById('timelineView').addEventListener('click', () => setView('timeline'));

        // Popularity slider
        const slider = document.getElementById('popularitySlider');
        const valueDisplay = document.getElementById('popularityValue');
        slider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            currentFilters.minPopularity = value;
            valueDisplay.textContent = `${value}+`;
            applyFilters();
        });

        // Filter checkboxes
        setupFilterCheckboxes();
    }

    // Setup filter checkboxes
    function setupFilterCheckboxes() {
        // Price filters
        ['free', '<10', '10-20', '>20', 'unknown'].forEach(range => {
            const checkbox = document.getElementById(`price-${range.replace(/[<>]/g, '').replace('-', '')}`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        currentFilters.priceRanges.add(range);
                    } else {
                        currentFilters.priceRanges.delete(range);
                    }
                    applyFilters();
                });
            }
        });

        // Special filters
        document.getElementById('outdoors').addEventListener('change', (e) => {
            currentFilters.outdoors = e.target.checked;
            applyFilters();
        });

        document.getElementById('beginner').addEventListener('change', (e) => {
            currentFilters.beginner = e.target.checked;
            applyFilters();
        });

        document.getElementById('liveMusic').addEventListener('change', (e) => {
            currentFilters.liveMusic = e.target.checked;
            applyFilters();
        });

        document.getElementById('hideCancelled').addEventListener('change', (e) => {
            currentFilters.hideCancelled = e.target.checked;
            applyFilters();
        });
    }

    // Populate filter options
    function populateFilters() {
        populateDayTabs();
        populateTypeFilters();
        populateNeighbourhoodFilters();
    }

    // Populate day tabs
    function populateDayTabs() {
        const dayTabs = document.getElementById('dayTabs');
        const buckets = ['all', 'happening_now', 'today', 'tonight', 'tomorrow', 'this_week', 'later'];
        const labels = {
            all: 'All Days',
            happening_now: 'Happening Now',
            today: 'Today',
            tonight: 'Tonight',
            tomorrow: 'Tomorrow',
            this_week: 'This Week',
            later: 'Later'
        };

        dayTabs.innerHTML = buckets.map(bucket => `
            <button class="day-tab ${bucket === 'all' ? 'active' : ''}" data-bucket="${bucket}">
                ${labels[bucket]}
            </button>
        `).join('');

        // Add event listeners
        dayTabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('day-tab')) {
                document.querySelectorAll('.day-tab').forEach(tab => tab.classList.remove('active'));
                e.target.classList.add('active');
                currentFilters.dayBucket = e.target.dataset.bucket;
                applyFilters();
            }
        });
    }

    // Populate type filters
    function populateTypeFilters() {
        const typeFilters = document.getElementById('typeFilters');
        
        typeFilters.innerHTML = Object.entries(eventTypes).map(([type, config]) => `
            <div class="filter-option">
                <input type="checkbox" id="type-${type}" value="${type}">
                <label for="type-${type}">${config.label}</label>
            </div>
        `).join('');

        // Add event listeners
        Object.keys(eventTypes).forEach(type => {
            document.getElementById(`type-${type}`).addEventListener('change', (e) => {
                if (e.target.checked) {
                    currentFilters.types.add(type);
                } else {
                    currentFilters.types.delete(type);
                }
                applyFilters();
            });
        });
    }

    // Populate neighbourhood filters
    function populateNeighbourhoodFilters() {
        const neighbourhoodFilters = document.getElementById('neighbourhoodFilters');
        
        // Get unique neighbourhoods from processed events
        const usedNeighbourhoods = [...new Set(processedEvents.map(e => e.neighbourhood).filter(n => n))];
        
        neighbourhoodFilters.innerHTML = usedNeighbourhoods.map(neighbourhood => `
            <div class="filter-option">
                <input type="checkbox" id="neighbourhood-${neighbourhood.replace(/\s+/g, '')}" value="${neighbourhood}">
                <label for="neighbourhood-${neighbourhood.replace(/\s+/g, '')}">${neighbourhood}</label>
            </div>
        `).join('');

        // Add event listeners
        usedNeighbourhoods.forEach(neighbourhood => {
            const id = `neighbourhood-${neighbourhood.replace(/\s+/g, '')}`;
            document.getElementById(id).addEventListener('change', (e) => {
                if (e.target.checked) {
                    currentFilters.neighbourhoods.add(neighbourhood);
                } else {
                    currentFilters.neighbourhoods.delete(neighbourhood);
                }
                applyFilters();
            });
        });
    }

    // Apply filters to events
    function applyFilters() {
        filteredEvents = processedEvents.filter(event => {
            // Day bucket filter
            if (currentFilters.dayBucket !== 'all' && event.day_bucket !== currentFilters.dayBucket) {
                return false;
            }

            // Type filter
            if (currentFilters.types.size > 0 && !currentFilters.types.has(event.type)) {
                return false;
            }

            // Neighbourhood filter
            if (currentFilters.neighbourhoods.size > 0 && !currentFilters.neighbourhoods.has(event.neighbourhood)) {
                return false;
            }

            // Price filter
            if (currentFilters.priceRanges.size > 0 && !currentFilters.priceRanges.has(event.price)) {
                return false;
            }

            // Popularity filter
            if (event.popularity < currentFilters.minPopularity) {
                return false;
            }

            // Special filters
            if (currentFilters.outdoors && !event.tags.includes('outdoors')) {
                return false;
            }

            if (currentFilters.beginner && !event.tags.includes('beginner')) {
                return false;
            }

            if (currentFilters.liveMusic && !event.tags.includes('live_music')) {
                return false;
            }

            if (currentFilters.hideCancelled && event.cancelled) {
                return false;
            }

            // Search filter
            if (currentFilters.search) {
                const searchText = `${event.title} ${event.notes} ${event.organizer}`.toLowerCase();
                if (!searchText.includes(currentFilters.search)) {
                    return false;
                }
            }

            return true;
        });

        renderEvents();
        updateStats();
    }

    // Set current view
    function setView(view) {
        currentView = view;
        
        // Update toggle buttons
        document.querySelectorAll('.view-toggle').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${view}View`).classList.add('active');
        
        // Show/hide panels
        document.getElementById('eventsGrid').style.display = view === 'grid' ? 'grid' : 'none';
        document.getElementById('mapPanel').classList.toggle('active', view === 'map');
        document.getElementById('timelineStrip').classList.toggle('active', view === 'timeline');
        
        if (view === 'timeline') {
            renderTimeline();
        } else if (view === 'map') {
            renderMap();
        }
    }

    // Render events based on current view and filters
    function renderEvents() {
        if (currentView === 'grid') {
            renderEventGrid();
        } else if (currentView === 'timeline') {
            renderTimeline();
        }
        // Map rendering would go here
    }

    // Render event grid
    function renderEventGrid() {
        const grid = document.getElementById('eventsGrid');
        
        // Sort events
        const sortedEvents = [...filteredEvents].sort((a, b) => {
            switch (currentSort) {
                case 'popularity':
                    return b.popularity - a.popularity;
                case 'time':
                    if (!a.start_dt && !b.start_dt) return 0;
                    if (!a.start_dt) return 1;
                    if (!b.start_dt) return -1;
                    return new Date(a.start_dt) - new Date(b.start_dt);
                case 'score':
                    return b.score - a.score;
                default:
                    return b.popularity - a.popularity;
            }
        });

        grid.innerHTML = sortedEvents.map((event, index) => `
            <div class="event-card ${event.cancelled ? 'cancelled' : ''}" data-event-url="${event.link}" data-card-id="card-${index}">
                <div class="event-type-badge type-${event.type}" style="background: ${eventTypes[event.type]?.color || '#9e9e9e'}">
                    ${eventTypes[event.type]?.label || 'Misc'}
                </div>
                
                <div class="event-title">${event.title}</div>
                
                <div class="event-when">
                    <span>📅</span>
                    <span>${event.when_label}</span>
                </div>
                
                <div class="event-location">
                    <span>📍</span>
                    <span>${event.venue}${event.neighbourhood ? `, ${event.neighbourhood}` : ''}</span>
                </div>
                
                <div class="event-popularity">
                    ${event.interested > 0 ? `<span class="popularity-chip interested">${event.interested} interested</span>` : ''}
                    ${event.going > 0 ? `<span class="popularity-chip going">${event.going} going</span>` : ''}
                </div>
                
                ${event.tags.length > 0 ? `
                <div class="event-tags">
                    ${event.tags.slice(0, 3).map(tag => `<span class="event-tag">${tag}</span>`).join('')}
                </div>
                ` : ''}
                
                ${event.cancelled ? '<div style="color: #e74c3c; font-weight: 600; font-size: 12px;">❌ CANCELLED</div>' : ''}
            </div>
        `).join('');
        
        // Add event listeners for event cards
        grid.querySelectorAll('.event-card').forEach(card => {
            card.addEventListener('click', () => {
                const url = card.dataset.eventUrl;
                if (url) openEvent(url);
            });
        });
    }

    // Render timeline view
    function renderTimeline() {
        const timelineHours = document.getElementById('timelineHours');
        const timelineInfo = document.getElementById('timelineInfo');
        
        // Filter events that have valid time data
        const eventsWithTime = filteredEvents.filter(event => {
            if (!event.start_dt) return false;
            const eventDate = new Date(event.start_dt);
            // Check if it's a valid date and not just defaulted to midnight
            return !isNaN(eventDate.getTime()) && 
                   (eventDate.getHours() !== 0 || eventDate.getMinutes() !== 0 || 
                    event.when_label.includes('12:00 AM') || event.when_label.includes('00:00'));
        });
        
        // Update timeline info
        if (timelineInfo) {
            timelineInfo.textContent = `${eventsWithTime.length} of ${filteredEvents.length} events have time mapping`;
        }
        
        // Generate 24 hour slots
        const hours = Array.from({length: 24}, (_, i) => i);
        
        timelineHours.innerHTML = hours.map(hour => {
            const hourEvents = eventsWithTime.filter(event => {
                const eventHour = new Date(event.start_dt).getHours();
                return eventHour === hour;
            });

            return `
                <div class="timeline-hour">
                    <div class="hour-label">${hour.toString().padStart(2, '0')}:00</div>
                    ${hourEvents.map(event => `
                        <div class="timeline-event type-${event.type}" 
                             data-event-url="${event.link}" 
                             data-event-id="timeline-${event.id}"
                             style="background: ${eventTypes[event.type]?.color || '#9e9e9e'}">
                            <div style="font-weight: 600; margin-bottom: 2px;">${event.title}</div>
                            <div style="font-size: 9px; opacity: 0.9;">${event.venue}</div>
                            <div class="timeline-tooltip">
                                <strong>${event.title}</strong><br>
                                📅 ${event.when_label}<br>
                                📍 ${event.venue}${event.neighbourhood ? `, ${event.neighbourhood}` : ''}<br>
                                ${event.interested > 0 ? `👥 ${event.interested} interested` : ''}
                                ${event.going > 0 ? ` • ${event.going} going` : ''}
                                ${event.tags.length > 0 ? `<br>🏷️ ${event.tags.slice(0, 3).join(', ')}` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }).join('');
        
        // Add event listeners for timeline events
        timelineHours.querySelectorAll('.timeline-event').forEach(element => {
            element.addEventListener('click', () => {
                const url = element.dataset.eventUrl;
                if (url) openEvent(url);
            });

            // Add hover tooltip functionality
            const tooltip = element.querySelector('.timeline-tooltip');
            element.addEventListener('mouseenter', () => {
                tooltip.classList.add('visible');
            });
            
            element.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });
        });
    }

    // Render interactive map
    function renderMap() {
        const mapContainer = document.getElementById('mapContainer');
        if (!mapContainer) return;
        
        // Helsinki coordinates
        const helsinkiLat = 60.1699;
        const helsinkiLng = 24.9384;
        
        // Create a simple coordinate system for events
        const eventsWithCoords = filteredEvents.map((event, index) => {
            // Generate pseudo-coordinates based on neighbourhood or use random positions around Helsinki
            let lat = helsinkiLat + (Math.random() - 0.5) * 0.1; // ±0.05 degrees
            let lng = helsinkiLng + (Math.random() - 0.5) * 0.1;
            
            // Adjust based on known neighbourhoods
            const neighbourhoodCoords = {
                'Kallio': { lat: 60.1841, lng: 24.9501 },
                'Töölö': { lat: 60.1756, lng: 24.9066 },
                'Punavuori': { lat: 60.1595, lng: 24.9310 },
                'Kamppi': { lat: 60.1687, lng: 24.9316 },
                'Kruununhaka': { lat: 60.1719, lng: 24.9525 },
                'Ullanlinna': { lat: 60.1564, lng: 24.9489 },
                'Katajanokka': { lat: 60.1675, lng: 24.9615 },
                'Sörnäinen': { lat: 60.1875, lng: 24.9614 }
            };
            
            if (event.neighbourhood && neighbourhoodCoords[event.neighbourhood]) {
                const coords = neighbourhoodCoords[event.neighbourhood];
                lat = coords.lat + (Math.random() - 0.5) * 0.01;
                lng = coords.lng + (Math.random() - 0.5) * 0.01;
            }
            
            return { ...event, lat, lng };
        });
        
        // Calculate map bounds
        const bounds = {
            minLat: Math.min(...eventsWithCoords.map(e => e.lat)) - 0.01,
            maxLat: Math.max(...eventsWithCoords.map(e => e.lat)) + 0.01,
            minLng: Math.min(...eventsWithCoords.map(e => e.lng)) - 0.01,
            maxLng: Math.max(...eventsWithCoords.map(e => e.lng)) + 0.01
        };
        
        // Convert lat/lng to pixel coordinates
        const mapWidth = mapContainer.offsetWidth;
        const mapHeight = mapContainer.offsetHeight;
        
        const latRange = bounds.maxLat - bounds.minLat;
        const lngRange = bounds.maxLng - bounds.minLng;
        
        mapContainer.innerHTML = `
            <div style="position: absolute; top: 10px; left: 10px; background: rgba(255,255,255,0.9); padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; z-index: 100;">
                📍 Helsinki Events Map (${eventsWithCoords.length} events)
            </div>
            <div style="position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.9); padding: 8px 12px; border-radius: 6px; font-size: 11px; z-index: 100;">
                <div style="margin-bottom: 4px; font-weight: 600;">Legend:</div>
                ${Object.entries(eventTypes).slice(0, 6).map(([type, config]) => `
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                        <div style="width: 12px; height: 12px; background: ${config.color}; border-radius: 50%; border: 2px solid white;"></div>
                        <span>${config.label}</span>
                    </div>
                `).join('')}
            </div>
            ${eventsWithCoords.map((event, index) => {
                const x = ((event.lng - bounds.minLng) / lngRange) * mapWidth;
                const y = ((bounds.maxLat - event.lat) / latRange) * mapHeight;
                
                return `
                    <div class="map-pin" 
                         data-event-url="${event.link}"
                         data-pin-id="map-pin-${index}"
                         style="
                            position: absolute;
                            left: ${x - 8}px;
                            top: ${y - 8}px;
                            width: 16px;
                            height: 16px;
                            background: ${eventTypes[event.type]?.color || '#9e9e9e'};
                            border: 2px solid white;
                            border-radius: 50%;
                            cursor: pointer;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                            transition: all 0.2s ease;
                            z-index: 10;
                         "
                         title="${event.title} - ${event.venue}">
                    </div>
                `;
            }).join('')}
            
            <!-- Neighbourhood labels -->
            ${Object.entries({
                'Kallio': { lat: 60.1841, lng: 24.9501 },
                'Töölö': { lat: 60.1756, lng: 24.9066 },
                'Punavuori': { lat: 60.1595, lng: 24.9310 },
                'Kamppi': { lat: 60.1687, lng: 24.9316 }
            }).map(([name, coords]) => {
                const x = ((coords.lng - bounds.minLng) / lngRange) * mapWidth;
                const y = ((bounds.maxLat - coords.lat) / latRange) * mapHeight;
                
                return `
                    <div style="
                        position: absolute;
                        left: ${x - 30}px;
                        top: ${y + 20}px;
                        background: rgba(0,0,0,0.7);
                        color: white;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 10px;
                        font-weight: 500;
                        pointer-events: none;
                        z-index: 5;
                    ">${name}</div>
                `;
            }).join('')}
        `;
        
        // Add event listeners for map pins
        mapContainer.querySelectorAll('.map-pin').forEach(pin => {
            pin.addEventListener('click', () => {
                const url = pin.dataset.eventUrl;
                if (url) openEvent(url);
            });
            
            pin.addEventListener('mouseenter', () => {
                pin.style.transform = 'scale(1.5)';
                pin.style.zIndex = '20';
            });
            
            pin.addEventListener('mouseleave', () => {
                pin.style.transform = 'scale(1)';
                pin.style.zIndex = '10';
            });
        });
    }

    // Update statistics
    function updateStats() {
        document.getElementById('totalEvents').textContent = processedEvents.length;
        document.getElementById('filteredEvents').textContent = filteredEvents.length;
        
        const avgPopularity = filteredEvents.length > 0 
            ? Math.round(filteredEvents.reduce((sum, e) => sum + e.popularity, 0) / filteredEvents.length)
            : 0;
        document.getElementById('avgPopularity').textContent = avgPopularity;
    }

    // Open event in new tab
    window.openEvent = function(url) {
        if (url) {
            window.open(url, '_blank');
        }
    };

    // Add storage listener for real-time updates
    function setupStorageListener() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'local' && changes.events) {
                    console.log('Storage updated, reloading events...');
                    rawEvents = changes.events.newValue || [];
                    processEvents();
                    applyFilters();
                    updateStats();
                }
            });
        }
    }

    // Initialize timeline controls
    function initializeTimelineControls() {
        const compressBtn = document.getElementById('compressBtn');
        const expandBtn = document.getElementById('expandBtn');
        const timelineHours = document.getElementById('timelineHours');
        const timelineStrip = document.getElementById('timelineStrip');
        const resizeHandle = document.getElementById('timelineResizeHandle');

        if (compressBtn && expandBtn && timelineHours) {
            compressBtn.addEventListener('click', () => {
                timelineHours.classList.add('compressed');
                compressBtn.classList.add('active');
                expandBtn.classList.remove('active');
            });

            expandBtn.addEventListener('click', () => {
                timelineHours.classList.remove('compressed');
                expandBtn.classList.add('active');
                compressBtn.classList.remove('active');
            });
        }

        // Add resize functionality
        if (resizeHandle && timelineStrip) {
            let isResizing = false;
            let startY = 0;
            let startHeight = 0;

            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startY = e.clientY;
                startHeight = parseInt(document.defaultView.getComputedStyle(timelineStrip).height, 10);
                document.addEventListener('mousemove', handleResize);
                document.addEventListener('mouseup', stopResize);
                e.preventDefault();
            });

            function handleResize(e) {
                if (!isResizing) return;
                const height = startHeight + e.clientY - startY;
                const minHeight = 200;
                const maxHeight = 600;
                const constrainedHeight = Math.min(Math.max(height, minHeight), maxHeight);
                timelineStrip.style.height = constrainedHeight + 'px';
            }

            function stopResize() {
                isResizing = false;
                document.removeEventListener('mousemove', handleResize);
                document.removeEventListener('mouseup', stopResize);
            }
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init();
            setupStorageListener();
            initializeTimelineControls();
        });
    } else {
        init();
        setupStorageListener();
        initializeTimelineControls();
    }

})();
