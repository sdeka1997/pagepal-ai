// PagePal AI Background Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CAPTURE_SCREENSHOT') {
    captureScreenshot(sender.tab.id)
      .then(screenshot => {
        sendResponse({ screenshot: screenshot });
      })
      .catch(error => {
        console.error('Screenshot capture error:', error);
        sendResponse({ error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});

async function captureScreenshot(tabId) {
  try {
    // Capture the visible area of the tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 90
    });
    
    return dataUrl;
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    throw error;
  }
}