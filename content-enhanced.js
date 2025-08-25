// PagePal AI Enhanced Content Script - Extracts structured content from web pages

// Inline constants for content script (to avoid ES6 import issues in content scripts)
const CONFIG = {
  CACHE_DURATION: 30000,
  MAX_CONTEXT_LENGTH: 12000,
  EXCLUDE_SELECTORS: [
    'nav', 'header', 'footer', 
    '.nav', '.navbar', '.navigation', '.header', '.footer',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    'script', 'style', 'noscript', 'meta', 'link', '.cookie-banner',
    '.advertisement', '.ads', '.social-share'
  ],
  MAIN_CONTENT_SELECTORS: [
    'main', '[role="main"]', '.main-content', '#main', '.content', 'article'
  ],
  TOC_SELECTORS: [
    '[class*="toc"]',
    '[id*="toc"]', 
    '[class*="table-of-contents"]',
    '[class*="contents"]',
    '[class*="outline"]',
    'aside',
    '.right-sidebar',
    '.left-sidebar',
    '.sidebar'
  ]
};

let cachedPageText = null;
let lastExtractionTime = 0;

/**
 * Extract structured content preserving HTML hierarchy and semantic meaning
 */
function extractStructuredContent() {
  // Skip if we have recent cached content
  const now = Date.now();
  if (cachedPageText && (now - lastExtractionTime) < CONFIG.CACHE_DURATION) {
    return cachedPageText;
  }

  // Elements to exclude from text extraction
  const excludeSelectors = CONFIG.EXCLUDE_SELECTORS;

  // Create a copy of the document to manipulate
  const doc = document.cloneNode(true);
  
  // First, extract TOC/sidebar elements before removing anything
  const tocElements = extractTOCElements(document);
  
  // Remove excluded elements (but keep aside and .sidebar for now)
  excludeSelectors.forEach(selector => {
    const elements = doc.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });

  // Get main content areas (prioritize main content)
  const mainSelectors = CONFIG.MAIN_CONTENT_SELECTORS;
  let contentElement = null;

  // Try to find main content first
  for (const selector of mainSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      contentElement = element;
      break;
    }
  }

  // Fallback to body if no main content found
  if (!contentElement) {
    contentElement = doc.body;
  }

  if (!contentElement) {
    return { success: false, error: 'No content found' };
  }

  // Extract structured content
  const structuredContent = extractElementContent(contentElement, tocElements);
  
  // Cache the result
  cachedPageText = structuredContent;
  lastExtractionTime = now;

  return structuredContent;
}

/**
 * Extract TOC/sidebar elements before main processing
 */
function extractTOCElements(doc) {
  const tocElements = [];
  
  // Look for potential TOC selectors
  const tocSelectors = CONFIG.TOC_SELECTORS;

  tocSelectors.forEach(selector => {
    const elements = doc.querySelectorAll(selector);
    elements.forEach(el => {
      const text = el.innerText?.trim() || '';
      if (text.length > 20) { // Filter out very short elements
        // Check if it contains TOC-like content
        if (text.toLowerCase().includes('on this page') || 
            text.toLowerCase().includes('contents') ||
            text.toLowerCase().includes('outline') ||
            text.toLowerCase().includes('in this article') ||
            text.toLowerCase().includes('table of contents') ||
            // Check if it has many links (typical of TOCs)
            el.querySelectorAll('a').length >= 3) {
          
          tocElements.push({
            type: 'table_of_contents',
            content: text,
            selector: selector,
            depth: 0
          });
        }
      }
    });
  });

  // Also check for positioned elements that might be TOCs (use original document for computed styles)
  const allElements = doc.querySelectorAll('*');
  Array.from(allElements).forEach(el => {
    // Try to find the same element in the original document
    let originalEl = null;
    if (el.id) {
      originalEl = document.getElementById(el.id);
    } else if (el.className) {
      // Try to match by class and position
      const candidates = document.getElementsByClassName(el.className);
      for (let candidate of candidates) {
        if (candidate.innerText === el.innerText) {
          originalEl = candidate;
          break;
        }
      }
    }
    
    if (originalEl) {
      const style = window.getComputedStyle(originalEl);
      if (style && (style.position === 'fixed' || style.position === 'absolute')) {
        const text = el.innerText?.trim() || '';
        if (text.length > 50 && 
            (text.toLowerCase().includes('on this page') || 
             text.toLowerCase().includes('contents') ||
             text.toLowerCase().includes('outline'))) {
          
          tocElements.push({
            type: 'table_of_contents',
            content: text,
            selector: 'positioned',
            depth: 0
          });
        }
      }
    }
  });

  return tocElements;
}

/**
 * Recursively extract content while preserving structure
 */
function extractElementContent(element, tocElements = []) {
  const result = {
    sections: [],
    metadata: {
      title: document.title,
      url: window.location.href,
      timestamp: new Date().toISOString()
    }
  };

  // Add pre-extracted TOC elements first
  if (tocElements.length > 0) {
    tocElements.forEach(toc => {
      result.sections.push(toc);
    });
  }

  // Process the element and its children
  processElement(element, result.sections, 0);
  
  return result;
}

/**
 * Process individual elements and extract meaningful content
 */
function processElement(element, sections, depth) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

  const tagName = element.tagName.toLowerCase();
  const textContent = element.innerText?.trim() || '';
  
  // Skip empty elements
  if (!textContent && !isMediaElement(element)) return;

  // Handle different element types
  switch (tagName) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      const level = parseInt(tagName.charAt(1));
      sections.push({
        type: 'heading',
        level: level,
        content: textContent,
        depth: depth
      });
      break;

    case 'p':
      if (textContent.length > 10) { // Filter out very short paragraphs
        sections.push({
          type: 'paragraph',
          content: textContent,
          depth: depth
        });
      }
      break;

    case 'ul':
    case 'ol':
      const listItems = extractListItems(element);
      if (listItems.length > 0) {
        sections.push({
          type: tagName === 'ul' ? 'unordered_list' : 'ordered_list',
          items: listItems,
          depth: depth
        });
      }
      break;

    case 'table':
      const tableData = extractTableData(element);
      if (tableData.rows.length > 0) {
        sections.push({
          type: 'table',
          headers: tableData.headers,
          rows: tableData.rows,
          depth: depth
        });
      }
      break;

    case 'img':
      const imgData = extractImageData(element);
      if (imgData) {
        sections.push(imgData);
      }
      break;

    case 'blockquote':
      sections.push({
        type: 'quote',
        content: textContent,
        depth: depth
      });
      break;

    case 'code':
    case 'pre':
      sections.push({
        type: 'code',
        content: textContent,
        language: element.className.match(/language-(\w+)/)?.[1] || 'text',
        depth: depth
      });
      break;

    case 'div':
    case 'section':
    case 'article':
      // Check if this is a special content section
      const className = element.className || '';
      const id = element.id || '';
      
      // Look for table of contents or navigation within content
      if (className.includes('toc') || className.includes('table-of-contents') || 
          id.includes('toc') || textContent.toLowerCase().includes('on this page')) {
        sections.push({
          type: 'table_of_contents',
          content: textContent,
          depth: depth
        });
      } else {
        // Process children for generic containers
        Array.from(element.children).forEach(child => {
          processElement(child, sections, depth + 1);
        });
      }
      break;

    default:
      // For other elements, process children
      Array.from(element.children).forEach(child => {
        processElement(child, sections, depth + 1);
      });
      break;
  }
}

/**
 * Extract list items with proper nesting
 */
function extractListItems(listElement) {
  const items = [];
  const listItems = listElement.querySelectorAll(':scope > li');
  
  listItems.forEach(li => {
    const text = li.innerText?.trim() || '';
    if (text) {
      const item = { content: text };
      
      // Check for nested lists
      const nestedList = li.querySelector('ul, ol');
      if (nestedList) {
        item.nested = extractListItems(nestedList);
      }
      
      items.push(item);
    }
  });
  
  return items;
}

/**
 * Extract table data with headers and rows
 */
function extractTableData(table) {
  const headers = [];
  const rows = [];
  
  // Extract headers
  const headerCells = table.querySelectorAll('thead th, thead td, tr:first-child th');
  headerCells.forEach(cell => {
    const text = cell.innerText?.trim();
    if (text) headers.push(text);
  });
  
  // Extract rows
  const rowElements = table.querySelectorAll('tbody tr, table > tr');
  rowElements.forEach(row => {
    const cells = [];
    const cellElements = row.querySelectorAll('td, th');
    cellElements.forEach(cell => {
      const text = cell.innerText?.trim();
      if (text) cells.push(text);
    });
    if (cells.length > 0) rows.push(cells);
  });
  
  return { headers, rows };
}

/**
 * Extract image data including alt text and captions
 */
function extractImageData(img) {
  const alt = img.alt?.trim();
  const src = img.src;
  const title = img.title?.trim();
  
  // Look for captions in nearby elements
  let caption = '';
  const parent = img.parentElement;
  if (parent) {
    const captionElement = parent.querySelector('figcaption, .caption, .image-caption');
    if (captionElement) {
      caption = captionElement.innerText?.trim() || '';
    }
  }
  
  if (alt || caption || title) {
    return {
      type: 'image',
      alt: alt || '',
      caption: caption || '',
      title: title || '',
      src: src || '',
      depth: 0
    };
  }
  
  return null;
}

/**
 * Check if element is a media element (img, video, etc.)
 */
function isMediaElement(element) {
  const mediaTypes = ['img', 'video', 'audio', 'canvas', 'svg'];
  return mediaTypes.includes(element.tagName.toLowerCase());
}

/**
 * Convert structured content to readable text format
 */
function formatStructuredContent(structuredData) {
  let formattedText = '';
  
  if (structuredData.metadata) {
    formattedText += `Page: ${structuredData.metadata.title}\n`;
    formattedText += `URL: ${structuredData.metadata.url}\n\n`;
  }
  
  structuredData.sections.forEach(section => {
    const indent = '  '.repeat(section.depth || 0);
    
    switch (section.type) {
      case 'heading':
        formattedText += `${'#'.repeat(section.level)} ${section.content}\n\n`;
        break;
        
      case 'paragraph':
        formattedText += `${indent}${section.content}\n\n`;
        break;
        
      case 'unordered_list':
      case 'ordered_list':
        section.items.forEach((item, index) => {
          const bullet = section.type === 'ordered_list' ? `${index + 1}.` : '•';
          formattedText += `${indent}${bullet} ${item.content}\n`;
          if (item.nested) {
            item.nested.forEach(nestedItem => {
              formattedText += `${indent}  • ${nestedItem.content}\n`;
            });
          }
        });
        formattedText += '\n';
        break;
        
      case 'table':
        if (section.headers.length > 0) {
          formattedText += `${indent}Table Headers: ${section.headers.join(' | ')}\n`;
        }
        section.rows.forEach(row => {
          formattedText += `${indent}${row.join(' | ')}\n`;
        });
        formattedText += '\n';
        break;
        
      case 'image':
        if (section.alt || section.caption) {
          formattedText += `${indent}[Image: ${section.alt || section.caption}]\n\n`;
        }
        break;
        
      case 'quote':
        formattedText += `${indent}> ${section.content}\n\n`;
        break;
        
      case 'code':
        formattedText += `${indent}\`\`\`${section.language}\n${section.content}\n\`\`\`\n\n`;
        break;
        
      case 'table_of_contents':
        formattedText += `${indent}TABLE OF CONTENTS:\n${section.content}\n\n`;
        break;
    }
  });
  
  return formattedText.trim();
}

/**
 * Listen for messages from popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_PAGE_TEXT') {
    try {
      const extractionMode = request.mode || 'structured'; // 'structured' or 'simple'
      
      let result;
      if (extractionMode === 'structured') {
        const structuredData = extractStructuredContent();
        const formattedText = formatStructuredContent(structuredData);
        
        result = {
          success: true,
          text: formattedText,
          structuredData: structuredData,
          mode: 'structured',
          length: formattedText.length,
          url: window.location.href,
          title: document.title
        };
      } else {
        // Fallback to simple extraction
        const simpleText = extractSimpleText();
        result = {
          success: true,
          text: simpleText,
          mode: 'simple',
          length: simpleText.length,
          url: window.location.href,
          title: document.title
        };
      }
      
      sendResponse(result);
    } catch (error) {
      console.error('PagePal AI: Error extracting content:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }
  return true; // Keep message channel open for async response
});

/**
 * Simple text extraction (fallback)
 */
function extractSimpleText() {
  // Fallback to original simple extraction if needed
  const excludeSelectors = [
    'nav', 'header', 'footer', 'aside', 
    '.nav', '.navbar', '.navigation', '.header', '.footer', '.sidebar',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    'script', 'style', 'noscript', 'meta', 'link'
  ];

  const doc = document.cloneNode(true);
  
  excludeSelectors.forEach(selector => {
    const elements = doc.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });

  const mainSelectors = ['main', '[role="main"]', '.main-content', '#main', '.content'];
  let textContent = '';

  for (const selector of mainSelectors) {
    const mainElement = doc.querySelector(selector);
    if (mainElement) {
      textContent = mainElement.innerText || mainElement.textContent || '';
      break;
    }
  }

  if (!textContent.trim()) {
    textContent = doc.body?.innerText || doc.body?.textContent || '';
  }

  return textContent
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

