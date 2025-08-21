// PagePalAI Content Script - Extracts visible text from web pages
let cachedPageText = null;
let lastExtractionTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Extract visible text from the page, excluding navigation and footer elements
 */
function extractVisibleText() {
  // Skip if we have recent cached content
  const now = Date.now();
  if (cachedPageText && (now - lastExtractionTime) < CACHE_DURATION) {
    return cachedPageText;
  }

  // Elements to exclude from text extraction
  const excludeSelectors = [
    'nav', 'header', 'footer', 'aside', 
    '.nav', '.navbar', '.navigation', '.header', '.footer', '.sidebar',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    'script', 'style', 'noscript', 'meta', 'link'
  ];

  // Create a copy of the document to manipulate
  const doc = document.cloneNode(true);
  
  // Remove excluded elements
  excludeSelectors.forEach(selector => {
    const elements = doc.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });

  // Get main content areas (prioritize main content)
  const mainSelectors = ['main', '[role="main"]', '.main-content', '#main', '.content'];
  let textContent = '';

  // Try to find main content first
  for (const selector of mainSelectors) {
    const mainElement = doc.querySelector(selector);
    if (mainElement) {
      textContent = mainElement.innerText || mainElement.textContent || '';
      break;
    }
  }

  // Fallback to body if no main content found
  if (!textContent.trim()) {
    textContent = doc.body?.innerText || doc.body?.textContent || '';
  }

  // Clean up the text
  textContent = textContent
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .trim();

  // Cache the result
  cachedPageText = textContent;
  lastExtractionTime = now;

  return textContent;
}

/**
 * Listen for messages from popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_PAGE_TEXT') {
    try {
      const pageText = extractVisibleText();
      sendResponse({ 
        success: true, 
        text: pageText,
        length: pageText.length,
        url: window.location.href,
        title: document.title
      });
    } catch (error) {
      console.error('PagePalAI: Error extracting text:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }
  return true; // Keep message channel open for async response
});

console.log("PagePalAI content script loaded");
