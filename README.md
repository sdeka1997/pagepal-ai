# PagePal AI Browser Extension

A Manifest V3 browser extension that allows you to ask questions about webpage content using your own OpenAI API key.

## Features

- Extract visible text from web pages (excluding navigation, headers, footers)
- Ask questions about page content using GPT-4o Mini, GPT-4o, or GPT-4 Turbo
- Clean, modern popup interface with settings management
- Smart text caching to avoid re-extraction
- Secure local storage of API keys
- Model preference persistence
- No backend server required

## Setup Instructions

### 1. Get an OpenAI API Key

1. Visit [OpenAI's API Keys page](https://platform.openai.com/api-keys)
2. Sign up or log in to your OpenAI account
3. Create a new API key and copy it

### 2. Install the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" and select the extension directory (the root folder containing `manifest.json`)
4. The PagePal AI extension should now appear in your extensions

### 3. Configure Your API Key

1. Click the PagePal AI extension icon in your browser toolbar
2. On first use, you'll see the settings screen
3. Paste your OpenAI API key in the input field
4. Click "Save API Key"

### 4. Usage

1. Navigate to any webpage
2. Click the PagePal AI extension icon
3. Type a question about the page content
4. Select your preferred model (GPT-4o Mini is fastest and cheapest)
5. Click "Ask Question"
6. View the AI-generated answer

**Tip:** Click the gear icon (⚙️) in the header to access settings and change your API key.

## Project Structure

```
paigewise-extension/
├── manifest.json          # Extension manifest (Manifest V3)
├── popup.html            # Extension popup interface
├── popup.js              # Frontend logic with OpenAI integration
├── content.js            # Content script for text extraction
└── README.md            # This file
```

## How It Works

1. **Text Extraction**: The content script extracts visible text from web pages, excluding navigation, headers, and footers
2. **Local Storage**: Your OpenAI API key is stored securely in Chrome's sync storage
3. **Direct API Calls**: The extension calls OpenAI's API directly from the browser
4. **Smart Caching**: Page text is cached for 30 seconds to avoid re-extraction

## Privacy & Security

- **Local Storage**: Your API key is stored locally in Chrome's sync storage and never sent to any third-party servers (except OpenAI)
- **Direct Communication**: The extension communicates directly with OpenAI's API - no intermediary servers
- **No Data Collection**: PagePal AI doesn't collect or store any of your browsing data or questions

## Development Notes

- Uses Manifest V3 for compatibility with modern browsers
- Text extraction excludes navigation, headers, and footers for cleaner context
- Content is cached for 30 seconds to avoid re-extraction on repeated questions
- Context is limited to 15,000 characters to stay within OpenAI's token limits
- API key validation ensures keys start with "sk-"

## Publishing to Chrome Web Store

To publish this extension:

1. **Add Required Assets**:
   - Icons (16x16, 48x48, 128x128 pixels)
   - Screenshots for the store listing
   - Detailed description

2. **Create Privacy Policy** (required if handling user data)

3. **Pay $5 Developer Registration Fee** (one-time)

4. **Submit for Review** (can take 1-7 days)

## Next Steps

- [ ] Safari conversion using Xcode WebExtension converter
- [ ] Add extension icons (16x16, 48x48, 128x128)
- [ ] Implement smart text chunking for very long pages
- [ ] Improve text extraction for complex layouts
- [ ] Add support for PDF and other document types
- [ ] Add usage tracking/token counting

## Troubleshooting

**Extension not loading:**
- Check browser console for errors
- Ensure all files are present
- Verify Manifest V3 syntax

**API key issues:**
- Ensure your OpenAI API key is valid and starts with "sk-"
- Check that you have available credits in your OpenAI account
- Verify your API key has access to the selected model

**Text extraction issues:**
- Check browser console in content script
- Some pages may have unusual layouts that affect extraction
- Try refreshing the page and re-opening the extension
- Ensure the page has loaded completely before asking questions