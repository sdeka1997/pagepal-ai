// PagePal AI Visual Content Script - Progressive viewport tracking and screenshot composition

// Import constants
import { CONFIG } from './constants.js';

class ProgressiveViewportTracker {
  constructor() {
    this.viewportHistory = new Map(); // scrollY -> screenshot data
    this.isTracking = false;
    this.lastScrollY = 0;
    this.captureThreshold = CONFIG.CAPTURE_THRESHOLD;
    this.maxViewportHeight = window.innerHeight;
    this.pageHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );
  }

  async startTracking() {
    this.isTracking = true;
    
    // Capture initial viewport
    await this.captureCurrentViewport();
    
    // Set up scroll listener
    window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
    
    return true;
  }

  stopTracking() {
    this.isTracking = false;
    window.removeEventListener('scroll', this.handleScroll.bind(this));
  }

  handleScroll = async () => {
    if (!this.isTracking) return;
    
    const currentScrollY = window.scrollY;
    const scrollDiff = Math.abs(currentScrollY - this.lastScrollY);
    
    // Only capture if we've scrolled enough
    if (scrollDiff >= this.captureThreshold) {
      await this.captureCurrentViewport();
      this.lastScrollY = currentScrollY;
    }
  }

  async captureCurrentViewport() {
    try {
      const scrollY = window.scrollY;
      
      // Skip if we already have this viewport
      if (this.viewportHistory.has(scrollY)) {
        return;
      }

      // Wait a moment for lazy content to load
      await this.waitForLazyContent();

      // Capture screenshot using chrome.tabs.captureVisibleTab
      const screenshot = await this.captureScreenshot();
      
      if (screenshot) {
        this.viewportHistory.set(scrollY, {
          screenshot: screenshot,
          timestamp: Date.now(),
          scrollY: scrollY,
          viewportHeight: window.innerHeight
        });
        
      }
    } catch (error) {
      console.error('PagePal AI: Error capturing viewport:', error);
    }
  }

  async waitForLazyContent(timeout = CONFIG.LAZY_CONTENT_TIMEOUT) {
    // Wait for potential lazy loading
    return new Promise(resolve => {
      let imagesLoaded = 0;
      const images = document.querySelectorAll('img[loading="lazy"], img[data-src]');
      
      if (images.length === 0) {
        setTimeout(resolve, CONFIG.LAZY_LOADING_WAIT); // Short wait even if no lazy images
        return;
      }

      const checkComplete = () => {
        imagesLoaded++;
        if (imagesLoaded >= images.length) {
          resolve();
        }
      };

      images.forEach(img => {
        if (img.complete) {
          checkComplete();
        } else {
          img.addEventListener('load', checkComplete, { once: true });
          img.addEventListener('error', checkComplete, { once: true });
        }
      });

      // Timeout fallback
      setTimeout(resolve, timeout);
    });
  }

  async captureScreenshot() {
    return new Promise((resolve) => {
      // Send message to background script to capture screenshot
      chrome.runtime.sendMessage(
        { action: 'CAPTURE_SCREENSHOT' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Screenshot capture error:', chrome.runtime.lastError);
            resolve(null);
          } else {
            resolve(response?.screenshot || null);
          }
        }
      );
    });
  }

  async generateCompositeImage() {
    if (this.viewportHistory.size === 0) {
      throw new Error('No viewport data captured');
    }


    // Sort viewports by scroll position
    const sortedViewports = Array.from(this.viewportHistory.entries())
      .sort(([a], [b]) => a - b);

    // For now, return the data for composition in background script
    // The actual image stitching would happen in background script or popup
    return {
      viewports: sortedViewports.map(([scrollY, data]) => ({
        scrollY,
        screenshot: data.screenshot,
        viewportHeight: data.viewportHeight
      })),
      pageInfo: {
        totalHeight: this.pageHeight,
        viewportHeight: this.maxViewportHeight,
        title: document.title,
        url: window.location.href
      }
    };
  }

  async autoScrollAndCapture() {
    // Start from top
    window.scrollTo(0, 0);
    await this.captureCurrentViewport();

    const scrollStep = Math.floor(window.innerHeight * CONFIG.VIEWPORT_OVERLAP);
    let currentScroll = 0;

    while (currentScroll < this.pageHeight) {
      currentScroll += scrollStep;
      window.scrollTo(0, Math.min(currentScroll, this.pageHeight - window.innerHeight));
      
      // Wait for scroll and lazy content
      await new Promise(resolve => setTimeout(resolve, CONFIG.SCREENSHOT_WAIT));
      await this.waitForLazyContent();
      await this.captureCurrentViewport();

      // Break if we've reached the bottom
      if (window.scrollY + window.innerHeight >= this.pageHeight) {
        break;
      }
    }

    return this.generateCompositeImage();
  }
}

// Global tracker instance
let viewportTracker = null;

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_PAGE_VISUAL') {
    handleVisualRequest(request, sendResponse);
    return true; // Keep message channel open
  } else if (request.action === 'START_VIEWPORT_TRACKING') {
    startViewportTracking(sendResponse);
    return true;
  } else if (request.action === 'STOP_VIEWPORT_TRACKING') {
    stopViewportTracking(sendResponse);
    return true;
  } else if (request.action === 'GET_COMPOSITE_IMAGE') {
    getCompositeImage(sendResponse);
    return true;
  }
});

async function handleVisualRequest(request, sendResponse) {
  try {
    const mode = request.mode || 'auto_scroll'; // 'auto_scroll', 'tracked', or 'current_viewport'
    
    if (mode === 'auto_scroll') {
      // Create new tracker and auto-capture entire page
      const tracker = new ProgressiveViewportTracker();
      const compositeData = await tracker.autoScrollAndCapture();
      
      sendResponse({
        success: true,
        type: 'visual',
        mode: 'auto_scroll',
        data: compositeData,
        url: window.location.href,
        title: document.title
      });
    } else if (mode === 'current_viewport') {
      // Capture only the current viewport (fast for study sessions)
      const tracker = new ProgressiveViewportTracker();
      await tracker.captureCurrentViewport();
      const compositeData = await tracker.generateCompositeImage();
      
      sendResponse({
        success: true,
        type: 'visual',
        mode: 'current_viewport',
        data: compositeData,
        url: window.location.href,
        title: document.title
      });
    } else if (mode === 'tracked' && viewportTracker) {
      // Use existing tracked viewports
      const compositeData = await viewportTracker.generateCompositeImage();
      
      sendResponse({
        success: true,
        type: 'visual',
        mode: 'tracked',
        data: compositeData,
        url: window.location.href,
        title: document.title
      });
    } else {
      sendResponse({
        success: false,
        error: 'No viewport tracking data available'
      });
    }
  } catch (error) {
    console.error('PagePal AI: Visual request error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function startViewportTracking(sendResponse) {
  try {
    if (!viewportTracker) {
      viewportTracker = new ProgressiveViewportTracker();
    }
    
    await viewportTracker.startTracking();
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

function stopViewportTracking(sendResponse) {
  if (viewportTracker) {
    viewportTracker.stopTracking();
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false, error: 'No active tracking' });
  }
}

async function getCompositeImage(sendResponse) {
  try {
    if (!viewportTracker) {
      throw new Error('No viewport tracker available');
    }
    
    const compositeData = await viewportTracker.generateCompositeImage();
    sendResponse({ success: true, data: compositeData });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

