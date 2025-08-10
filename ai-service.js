// Gemini AI Service for Facebook Events
class EventsAI {
    constructor() {
        this.apiKey = 'AIzaSyAsX93xW9Loe6NXfDTP_EA6HduUv4P9zqU';
        this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
        this.events = [];
    }

    setEvents(events) {
        this.events = events;
    }

    async askQuestion(question) {
        try {
            const eventsContext = this.formatEventsForAI();
            const prompt = this.createPrompt(question, eventsContext);
            
            const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
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
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            const aiResponse = data.candidates[0]?.content?.parts[0]?.text || 'Sorry, I could not process your request.';
            
            return this.parseAIResponse(aiResponse);
        } catch (error) {
            console.error('AI service error:', error);
            return {
                type: 'error',
                message: 'Sorry, I encountered an error while processing your request. Please try again.',
                events: []
            };
        }
    }

    formatEventsForAI() {
        if (this.events.length === 0) {
            return "No events are currently available.";
        }

        return this.events.map((event, index) => {
            const date = event.start_ts ? new Date(event.start_ts).toLocaleString() : 'Date not specified';
            return `Event ${index + 1}:
- Name: ${event.title}
- Time: ${event.time_text} (${date})
- Location: ${event.location || 'Location not specified'}
- Description: ${event.description || 'No description available'}
- URL: ${event.url}
- ID: ${event.id}`;
        }).join('\n\n');
    }

    createPrompt(question, eventsContext) {
        return `You are an AI assistant helping users find and understand Facebook events. 

AVAILABLE EVENTS:
${eventsContext}

USER QUESTION: ${question}

INSTRUCTIONS:
1. Always respond in a helpful and conversational tone
2. When listing events, ALWAYS sort them chronologically (earliest first)
3. Include ALL relevant details: event name, time, location, description, and Facebook URL
4. If user asks for specific types of events, filter accordingly
5. If no events match the criteria, explain what's available instead
6. Format your response as JSON with this structure:
{
  "type": "response|list|error",
  "message": "Your conversational response here",
  "events": [
    {
      "title": "Event Name",
      "time_text": "Time description",
      "formatted_date": "Formatted date and time",
      "location": "Location",
      "description": "Description",
      "url": "Facebook URL",
      "id": "Event ID"
    }
  ]
}

6. For the "events" array, only include events that are relevant to the user's question
7. Always sort events chronologically in the response
8. Keep the message conversational but informative

Please respond in valid JSON format only.`;
    }

    parseAIResponse(response) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                
                // Ensure events are sorted chronologically
                if (parsed.events && Array.isArray(parsed.events)) {
                    parsed.events.sort((a, b) => {
                        const eventA = this.events.find(e => e.id === a.id);
                        const eventB = this.events.find(e => e.id === b.id);
                        
                        if (!eventA || !eventB) return 0;
                        if (eventA.start_ts === null && eventB.start_ts === null) return 0;
                        if (eventA.start_ts === null) return 1;
                        if (eventB.start_ts === null) return -1;
                        return eventA.start_ts - eventB.start_ts;
                    });
                }
                
                return parsed;
            }
        } catch (error) {
            console.error('Failed to parse AI response:', error);
        }

        // Fallback response
        return {
            type: 'response',
            message: response,
            events: []
        };
    }

    // Predefined quick responses for common questions
    getQuickResponses() {
        return [
            "What events are happening today?",
            "Show me all upcoming events",
            "What music events are available?",
            "Find events near me",
            "What's happening this weekend?",
            "Show me free events",
            "What are the most popular events?"
        ];
    }

    // Process quick response
    async handleQuickResponse(responseText) {
        return await this.askQuestion(responseText);
    }
}
