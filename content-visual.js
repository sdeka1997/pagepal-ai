// Safari compatible visual script with auto-scroll
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'GET_PAGE_VISUAL') {
    var mode = request.mode || 'current_viewport';
    
    if (mode === 'current_viewport') {
      // Single screenshot of current viewport
      captureCurrentViewport(sendResponse);
    } else if (mode === 'auto_scroll') {
      // Auto-scroll through entire page
      captureFullPageScroll(sendResponse);
    } else {
      sendResponse({
        success: false,
        error: 'Unsupported mode: ' + mode
      });
    }
    return true;
  }
});

function captureCurrentViewport(sendResponse) {
  chrome.runtime.sendMessage(
    { action: 'CAPTURE_SCREENSHOT' },
    function(response) {
      if (chrome.runtime.lastError) {
        sendResponse({
          success: false,
          error: 'Screenshot failed: ' + chrome.runtime.lastError.message
        });
      } else if (!response || !response.screenshot) {
        sendResponse({
          success: false,
          error: 'No screenshot received from background'
        });
      } else {
        sendResponse({
          success: true,
          type: 'visual',
          mode: 'current_viewport',
          data: {
            viewports: [{
              scrollY: window.scrollY,
              screenshot: response.screenshot,
              viewportHeight: window.innerHeight
            }],
            pageInfo: {
              title: document.title,
              url: window.location.href,
              totalHeight: getPageHeight()
            }
          }
        });
      }
    }
  );
}

function captureFullPageScroll(sendResponse) {
  var pageHeight = getPageHeight();
  var viewportHeight = window.innerHeight;
  var scrollStep = Math.floor(viewportHeight * 0.8); // 80% overlap
  var screenshots = [];
  var currentScroll = 0;
  
  // Start from top
  window.scrollTo(0, 0);
  
  function captureNextViewport() {
    // Wait a moment for scroll to complete
    setTimeout(function() {
      chrome.runtime.sendMessage(
        { action: 'CAPTURE_SCREENSHOT' },
        function(response) {
          if (response && response.screenshot) {
            screenshots.push({
              scrollY: window.scrollY,
              screenshot: response.screenshot,
              viewportHeight: viewportHeight
            });
          }
          
          // Move to next scroll position
          currentScroll += scrollStep;
          var targetScroll = Math.min(currentScroll, pageHeight - viewportHeight);
          
          if (window.scrollY + viewportHeight >= pageHeight - 10 || screenshots.length > 20) {
            // Done scrolling or safety limit reached
            sendResponse({
              success: true,
              type: 'visual',
              mode: 'auto_scroll',
              data: {
                viewports: screenshots,
                pageInfo: {
                  title: document.title,
                  url: window.location.href,
                  totalHeight: pageHeight,
                  viewportHeight: viewportHeight
                }
              }
            });
          } else {
            // Continue scrolling
            window.scrollTo(0, targetScroll);
            captureNextViewport();
          }
        }
      );
    }, 500); // Wait 500ms between captures
  }
  
  // Start the capture process
  captureNextViewport();
}

function getPageHeight() {
  return Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );
}