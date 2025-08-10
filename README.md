# 🗺️ Facebook Events Map Extension

A powerful Firefox browser extension that extracts Facebook events and displays them on an interactive map with AI-powered chat functionality using Google Gemini.

## ✨ Features

- **🔄 Smart Event Extraction**: Automatically scrapes Facebook events with structured field separation
- **🗺️ Geographic Map**: Real geocoding using OpenStreetMap for accurate event positioning
- **🤖 AI Chat Assistant**: Real-time streaming responses with clickable event links
- **📱 Embedded Widget**: Transparent, minimal widget embedded directly in Facebook
- **📋 Structured Data**: Clean separation of date, title, location, interested/going counts
- **🔗 Hyperlinked Responses**: AI provides clickable links to Facebook events
- **🎨 Modern UI**: Clean, responsive design with improved markdown formatting
- **💾 Smart Storage**: Persistent event storage with proper data structure
- **🌍 CORS-Safe Geocoding**: Reliable location mapping with fallback systems

## 🚀 Installation

### Method 1: Temporary Installation (Development)
1. **Download/Clone** this repository to your computer
2. **Open Firefox** and navigate to `about:debugging`
3. **Click "This Firefox"** in the left sidebar
4. **Click "Load Temporary Add-on"**
5. **Navigate** to the extension folder and select `manifest.json`
6. **Done!** The extension is now installed

### Method 2: Permanent Installation
1. **Zip the extension folder** (excluding `.git` if present)
2. **Rename** the zip file to have a `.xpi` extension
3. **Drag and drop** the `.xpi` file into Firefox
4. **Click "Add"** when prompted

## 🔑 Setup Gemini AI (Required for Chat)

1. **Get API Key**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **Create Account**: Sign in with your Google account
3. **Generate Key**: Click "Create API Key" 
4. **Copy Key**: Copy your API key (starts with `AIza...`)
5. **Open Extension**: Click the extension icon in Firefox toolbar
6. **Enter Key**: Paste your API key in the input field
7. **Save**: Click "Save API Key"
8. **Done!** AI chat is now ready to use

## 📖 How to Use

### 🎯 Step 1: Extract Events
1. **Visit Facebook Events**: Go to [facebook.com/events](https://www.facebook.com/events)
2. **Find Widget**: Look for the small bubble in the bottom-right corner
3. **Click Widget**: Click to expand the transparent overlay
4. **Extract Events**: Click the ⬇ button to start extraction
5. **Wait**: The extension will auto-scroll and extract all visible events
6. **View Results**: Switch between Map/List/AI tabs

### 🗺️ Step 2: Explore Map View
- **Red Dots**: Each dot represents an event location
- **Click Dots**: Click any marker to open the event on Facebook
- **Hover Effects**: Markers scale up when you hover over them
- **Event Count**: See total events and mappable events in the corner

### 📋 Step 3: Browse List View
- **Compact Cards**: Clean, readable event cards with icons
- **Event Details**: Title, time (🕒), and location (📍)
- **Click Cards**: Click any card to open the event on Facebook
- **Scrollable**: Scroll through all extracted events

### 🤖 Step 4: Chat with AI
- **Ask Questions**: Type natural language questions about events
- **Streaming Responses**: Watch AI responses appear in real-time
- **Markdown Formatting**: Responses include **bold**, *italic*, and `code` formatting
- **Smart Context**: AI knows about all your extracted events

## 💬 AI Chat Examples

Try asking these questions:

```
"What events are happening today?"
"Show me music events this weekend"
"Any outdoor activities in Helsinki?"
"Find events with free entry"
"What's happening after 6 PM?"
"Recommend events for a date night"
"Which events are at 5pm?"
```

The AI will respond with **clickable links** to Facebook events and properly formatted information including dates, times, locations, and attendance counts.

## 🆕 Latest Improvements (v2.0)

### ✅ **Structured Data Extraction**
- **Field Separation**: Events now properly separated into date, title, location, interested/going counts
- **Clean Titles**: No more jumbled text - titles are clean event names only
- **Accurate Parsing**: Uses Facebook's actual DOM structure for reliable extraction

### ✅ **Real Geographic Mapping**
- **OpenStreetMap Geocoding**: Events positioned by actual geographic coordinates
- **Finnish Address Support**: Recognizes Helsinki addresses, postal codes, and venue names
- **CORS-Safe API**: Uses proxy system for reliable geocoding requests
- **Fallback Systems**: Multiple geocoding strategies with graceful degradation

### ✅ **Enhanced AI Chat**
- **Clickable Links**: AI responses include hyperlinked event URLs
- **Better Formatting**: Improved markdown rendering with proper styling
- **Structured Context**: AI has access to properly separated event data
- **Example Format**: `• **[Event Name](URL)** - Time: Date at Time, Location: Venue`

## 🛠️ Troubleshooting

### Extension Not Working?
- **Reload Extension**: Go to `about:debugging` → Reload
- **Check Permissions**: Ensure Facebook access is granted
- **Clear Storage**: Use "Clear Event Data" button in popup

### AI Chat Not Responding?
- **Check API Key**: Ensure your Gemini API key is saved
- **Verify Key Format**: Key should start with `AIza`
- **Check Internet**: Ensure stable internet connection
- **Try Again**: Click the extension icon and re-enter your key

### Map Not Loading?
- **Extract Events First**: Click ⬇ button to extract events
- **Switch Tabs**: Try switching to List view and back to Map
- **Reload Page**: Refresh the Facebook Events page

## 🔧 Technical Details

- **Manifest Version**: 2 (Firefox compatible)
- **Permissions**: Facebook domains, storage, active tab
- **Content Security Policy**: Configured for external scripts
- **Storage**: Uses `chrome.storage.local` for persistence
- **AI Model**: Google Gemini 2.5 Flash Preview

## 📁 File Structure

```
FbEventExtension/
├── manifest.json          # Extension configuration
├── content-widget.js      # Main widget functionality
├── popup.html            # Extension popup interface
├── popup.js              # Popup logic and API key management
├── map.html              # Standalone map page (legacy)
├── map.js                # Map functionality (legacy)
├── ai-service.js         # AI integration (legacy)
├── styles.css            # Styling for all components
└── README.md             # This file
```

## 🎨 Features in Detail

### Real-time AI Streaming
- Responses appear character by character as AI generates them
- "🤔 Thinking..." indicator while processing
- Automatic fallback to regular API if streaming fails

### Markdown Support
- **Bold text** with `**text**`
- *Italic text* with `*text*`
- `Inline code` with backticks
- Code blocks with triple backticks
- Bullet lists with `-`

### Smart Event Context
- AI has access to all extracted event details
- Includes event names, times, locations, and URLs
- Filters and recommends based on user queries

## 🔒 Privacy & Security

- **Local Storage**: All data stored locally in your browser
- **No Tracking**: Extension doesn't track or collect personal data
- **API Key Security**: Your Gemini API key is stored locally only
- **Facebook Integration**: Only reads public event information

## 🆘 Support

If you encounter issues:

1. **Check Console**: Open browser DevTools → Console for error messages
2. **Reload Extension**: `about:debugging` → Reload
3. **Clear Data**: Use "Clear Event Data" in extension popup
4. **Restart Browser**: Sometimes helps with permission issues

## 🎉 Enjoy!

Your Facebook Events Map Extension is now ready to use! Extract events, explore the map, and chat with AI about your local events. Have fun discovering what's happening around you! 🎊
- **Chronological Sorting**: Events are always properly sorted by time
- **Detailed Information**: Complete event details including time, location, description, and Facebook links

## Technical Details

- **Manifest Version**: 2 (Firefox compatible)
- **Permissions**: Facebook access, storage, maps, and Gemini AI API
- **Map Provider**: OpenStreetMap with Leaflet.js
- **AI Provider**: Google Gemini Pro API
- **Geocoding**: Nominatim (OpenStreetMap)

## File Structure

```
FbEventExtension/
├── manifest.json          # Extension manifest
├── content.js             # Facebook page content script
├── background.js          # Background service worker
├── popup.html/js          # Extension popup interface
├── map.html               # Main map interface
├── map.js                 # Map functionality
├── ai-service.js          # Gemini AI integration
├── styles.css             # All styling
└── README.md              # This file
```

## Privacy & Security

- Events are stored locally in browser storage
- AI queries are sent to Google Gemini API
- No personal data is collected or transmitted
- All Facebook interaction happens locally in your browser

## Troubleshooting

### Events Not Loading
- Make sure you're on the Facebook Events page
- Try refreshing the page and clicking the extract button again
- Check browser console for any errors

### AI Chat Not Working
- Verify internet connection
- The extension uses Google's Gemini AI API
- Check browser console for API errors

### Map Not Displaying
- Ensure internet connection for map tiles
- Check if location services are enabled
- Some events may not have location data

## Development

To modify or extend the extension:

1. Edit the relevant files
2. Reload the extension in `about:debugging`
3. Test on Facebook Events page

## License

This project is for educational and personal use. Please respect Facebook's terms of service when using this extension.
