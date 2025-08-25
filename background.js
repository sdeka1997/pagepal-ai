// PagePal AI Background Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CAPTURE_SCREENSHOT') {
    console.log('PagePal AI Background: Received CAPTURE_SCREENSHOT request');
    captureScreenshot(sender.tab.id)
      .then(screenshot => {
        console.log('PagePal AI Background: Screenshot captured successfully');
        sendResponse({ screenshot: screenshot });
      })
      .catch(error => {
        console.error('PagePal AI Background: Screenshot capture error:', error);
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