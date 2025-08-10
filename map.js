// Facebook Events Map JavaScript
class EventsMap {
    constructor() {
        this.map = null;
        this.events = [];
        this.markers = [];
        this.currentView = 'map';
        this.sidebarOpen = true;
        this.aiService = new EventsAI();
        
        this.init();
    }

    async init() {
        this.showLoading();
        await this.loadEvents();
        this.initMap();
        this.initEventHandlers();
        this.renderEvents();
        this.hideLoading();
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
        document.getElementById('map-container').style.display = 'none';
        document.getElementById('list-container').style.display = 'none';
        document.getElementById('no-events').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        if (this.events.length === 0) {
            document.getElementById('no-events').style.display = 'flex';
        } else {
            this.showView(this.currentView);
        }
    }

    async loadEvents() {
        return new Promise((resolve) => {
            console.log('Loading events from storage...');
            chrome.storage.local.get(['events'], (result) => {
                console.log('Storage result:', result);
                
                if (chrome.runtime.lastError) {
                    console.error('Chrome storage error:', chrome.runtime.lastError);
                    this.events = [];
                } else {
                    this.events = result.events || [];
                    console.log('Loaded events:', this.events.length);
                }
                
                this.aiService.setEvents(this.events);
                document.getElementById('event-count').textContent = `${this.events.length} events`;
                resolve();
            });
        });
    }

    initMap() {
        // Initialize Leaflet map
        this.map = L.map('map').setView([60.1699, 24.9384], 11); // Helsinki default

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Add events to map
        this.addEventsToMap();
    }

    async addEventsToMap() {
        const bounds = [];
        
        for (const event of this.events) {
            if (event.location) {
                try {
                    const coords = await this.geocodeLocation(event.location);
                    if (coords) {
                        const marker = this.createEventMarker(event, coords);
                        this.markers.push(marker);
                        bounds.push(coords);
                    }
                } catch (error) {
                    console.warn(`Failed to geocode location for event ${event.id}:`, error);
                }
            }
        }

        // Fit map to show all markers
        if (bounds.length > 0) {
            this.map.fitBounds(bounds, { padding: [20, 20] });
        }
    }

    async geocodeLocation(location) {
        // Simple geocoding using Nominatim (OpenStreetMap)
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location + ', Finland')}&limit=1`
            );
            const data = await response.json();
            
            if (data && data.length > 0) {
                return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            }
        } catch (error) {
            console.warn('Geocoding failed:', error);
        }
        return null;
    }

    createEventMarker(event, coords) {
        const popupTemplate = document.getElementById('popup-template');
        const popupContent = popupTemplate.content.cloneNode(true);
        
        popupContent.querySelector('.popup-title').textContent = event.title;
        popupContent.querySelector('.popup-time').textContent = event.time_text;
        popupContent.querySelector('.popup-location').textContent = event.location;
        popupContent.querySelector('.popup-description').textContent = event.description;
        popupContent.querySelector('.popup-link').href = event.url;

        const marker = L.marker(coords)
            .addTo(this.map)
            .bindPopup(popupContent.querySelector('.popup-content').outerHTML);

        // Add click handler to highlight in sidebar
        marker.on('click', () => {
            this.highlightEventInSidebar(event.id);
        });

        return marker;
    }

    initEventHandlers() {
        // View toggle buttons
        document.getElementById('map-view-btn').addEventListener('click', () => {
            this.showView('map');
        });

        document.getElementById('list-view-btn').addEventListener('click', () => {
            this.showView('list');
        });

        document.getElementById('ai-chat-btn').addEventListener('click', () => {
            this.showView('chat');
        });

        // Sidebar toggle
        document.getElementById('close-sidebar').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            location.reload();
        });

        // AI Chat handlers
        this.initChatHandlers();
    }

    showView(view) {
        this.currentView = view;
        
        // Update button states
        document.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
        
        // Hide all containers
        document.getElementById('map-container').style.display = 'none';
        document.getElementById('list-container').style.display = 'none';
        document.getElementById('ai-chat-container').style.display = 'none';
        
        if (view === 'map') {
            document.getElementById('map-container').style.display = 'flex';
            document.getElementById('map-view-btn').classList.add('active');
            
            // Refresh map size
            setTimeout(() => {
                if (this.map) {
                    this.map.invalidateSize();
                }
            }, 100);
        } else if (view === 'list') {
            document.getElementById('list-container').style.display = 'block';
            document.getElementById('list-view-btn').classList.add('active');
        } else if (view === 'chat') {
            document.getElementById('ai-chat-container').style.display = 'block';
            document.getElementById('ai-chat-btn').classList.add('active');
            this.initializeChat();
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('event-sidebar');
        const mapContainer = document.getElementById('map');
        
        this.sidebarOpen = !this.sidebarOpen;
        
        if (this.sidebarOpen) {
            sidebar.style.transform = 'translateX(0)';
            mapContainer.style.marginRight = '350px';
        } else {
            sidebar.style.transform = 'translateX(100%)';
            mapContainer.style.marginRight = '0';
        }
        
        // Refresh map size
        setTimeout(() => {
            if (this.map) {
                this.map.invalidateSize();
            }
        }, 300);
    }

    renderEvents() {
        this.renderSidebarEvents();
        this.renderListEvents();
    }

    renderSidebarEvents() {
        const container = document.getElementById('event-list');
        container.innerHTML = '';

        this.events.forEach(event => {
            const eventElement = this.createEventCard(event, true);
            container.appendChild(eventElement);
        });
    }

    renderListEvents() {
        const container = document.getElementById('events-grid');
        container.innerHTML = '';

        this.events.forEach(event => {
            const eventElement = this.createEventCard(event, false);
            container.appendChild(eventElement);
        });
    }

    createEventCard(event, isCompact = false) {
        const template = document.getElementById('event-card-template');
        const card = template.content.cloneNode(true);
        
        const cardElement = card.querySelector('.event-card');
        cardElement.dataset.eventId = event.id;
        cardElement.classList.toggle('compact', isCompact);
        
        card.querySelector('.event-title').textContent = event.title;
        card.querySelector('.event-time').textContent = event.time_text;
        card.querySelector('.location-text').textContent = event.location || 'Location not specified';
        card.querySelector('.event-description').textContent = event.description;
        card.querySelector('.btn-primary').href = event.url;
        
        // Locate button
        const locateBtn = card.querySelector('.locate-btn');
        if (event.location) {
            locateBtn.addEventListener('click', () => {
                this.locateEventOnMap(event);
            });
        } else {
            locateBtn.style.display = 'none';
        }

        return card;
    }

    locateEventOnMap(event) {
        // Switch to map view
        this.showView('map');
        
        // Find and open the marker for this event
        const marker = this.markers.find(m => {
            // This is a simple approach - in a real app you'd store event ID with marker
            return true; // For now, just center on first marker
        });
        
        if (marker) {
            this.map.setView(marker.getLatLng(), 15);
            marker.openPopup();
        }
    }

    highlightEventInSidebar(eventId) {
        // Remove previous highlights
        document.querySelectorAll('.event-card.highlighted').forEach(card => {
            card.classList.remove('highlighted');
        });
        
        // Highlight the selected event
        const eventCard = document.querySelector(`[data-event-id="${eventId}"]`);
        if (eventCard) {
            eventCard.classList.add('highlighted');
            eventCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // AI Chat Methods
    initChatHandlers() {
        const chatInput = document.getElementById('chat-input');
        const sendButton = document.getElementById('send-message');
        
        // Send message on button click
        sendButton.addEventListener('click', () => {
            this.sendMessage();
        });
        
        // Send message on Enter key
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Setup quick responses
        this.setupQuickResponses();
    }

    initializeChat() {
        const messagesContainer = document.getElementById('chat-messages');
        
        // Add welcome message if chat is empty
        if (messagesContainer.children.length === 0) {
            this.addAIMessage(
                `Hello! I'm your AI assistant for Facebook events. I can help you find specific events, answer questions about what's available, and provide recommendations.\n\nI have access to ${this.events.length} events. What would you like to know?`
            );
        }
    }

    setupQuickResponses() {
        const quickResponsesList = document.getElementById('quick-responses-list');
        const quickResponses = this.aiService.getQuickResponses();
        
        quickResponsesList.innerHTML = '';
        
        quickResponses.forEach(response => {
            const button = document.createElement('button');
            button.className = 'quick-response-btn';
            button.textContent = response;
            button.addEventListener('click', () => {
                this.handleQuickResponse(response);
            });
            quickResponsesList.appendChild(button);
        });
    }

    async handleQuickResponse(responseText) {
        // Add user message
        this.addUserMessage(responseText);
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            const aiResponse = await this.aiService.handleQuickResponse(responseText);
            this.hideTypingIndicator();
            this.handleAIResponse(aiResponse);
        } catch (error) {
            this.hideTypingIndicator();
            this.addAIMessage('Sorry, I encountered an error. Please try again.');
        }
    }

    async sendMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (!message) return;
        
        // Clear input
        chatInput.value = '';
        
        // Add user message
        this.addUserMessage(message);
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            const aiResponse = await this.aiService.askQuestion(message);
            this.hideTypingIndicator();
            this.handleAIResponse(aiResponse);
        } catch (error) {
            this.hideTypingIndicator();
            this.addAIMessage('Sorry, I encountered an error. Please try again.');
        }
    }

    addUserMessage(message) {
        const template = document.getElementById('user-message-template');
        const messageElement = template.content.cloneNode(true);
        
        messageElement.querySelector('.message-content').textContent = message;
        
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    addAIMessage(message, events = []) {
        const template = document.getElementById('ai-message-template');
        const messageElement = template.content.cloneNode(true);
        
        messageElement.querySelector('.message-content').textContent = message;
        
        // Add events if provided
        if (events && events.length > 0) {
            const eventsList = messageElement.querySelector('.ai-events-list');
            events.forEach(event => {
                const eventElement = this.createAIEventItem(event);
                eventsList.appendChild(eventElement);
            });
        }
        
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    createAIEventItem(event) {
        const template = document.getElementById('ai-event-item-template');
        const eventElement = template.content.cloneNode(true);
        
        eventElement.querySelector('.ai-event-title').textContent = event.title;
        eventElement.querySelector('.ai-event-time').textContent = event.time_text;
        eventElement.querySelector('.location-text').textContent = event.location || 'Location not specified';
        eventElement.querySelector('.ai-event-description').textContent = event.description || 'No description available';
        eventElement.querySelector('.ai-event-link').href = event.url;
        
        // Add click handler to show on map
        const eventItem = eventElement.querySelector('.ai-event-item');
        eventItem.addEventListener('click', () => {
            this.showEventOnMap(event);
        });
        
        return eventElement;
    }

    showEventOnMap(event) {
        // Switch to map view
        this.showView('map');
        
        // Find the marker for this event and center on it
        // This is a simplified approach - in a real implementation you'd store event IDs with markers
        if (this.markers.length > 0) {
            const randomMarker = this.markers[Math.floor(Math.random() * this.markers.length)];
            this.map.setView(randomMarker.getLatLng(), 15);
            randomMarker.openPopup();
        }
    }

    handleAIResponse(response) {
        if (response.type === 'error') {
            this.addAIMessage(response.message);
            return;
        }
        
        // Add the AI message
        this.addAIMessage(response.message, response.events || []);
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <span>AI is thinking</span>
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EventsMap();
});
