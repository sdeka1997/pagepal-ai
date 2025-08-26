// PagePal AI - Application Constants

export const CONFIG = {
  // Feature flags
  ENABLE_CONTENT_ANALYSIS_DROPDOWN: false, // Global flag to show/hide content analysis options
  ENABLE_CACHE_MEMORY_MODE: false, // Flag to enable/disable cache memory mode functionality
  
  // Content extraction
  CACHE_DURATION: 30000, // 30 seconds
  MAX_CONTEXT_LENGTH: 12000,
  LAZY_CONTENT_TIMEOUT: 1000,
  
  // AI Provider settings
  DEFAULT_MAX_TOKENS: 1000,
  DEFAULT_TEMPERATURE: 0.7,
  API_TIMEOUT: 120000, // 2 minutes
  
  // Storage keys
  STORAGE_KEYS: {
    OPENAI_API_KEY: 'openaiApiKey',
    GEMINI_API_KEY: 'geminiApiKey',
    SELECTED_MODEL: 'selectedModel'
  },
  
  // DOM selectors
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
  ],
  
  // Error messages
  ERROR_MESSAGES: {
    INVALID_API_KEY: 'Invalid API key. Please check your API key and try again.',
    RATE_LIMIT: 'Rate limit exceeded. Please try again later.',
    BILLING_REQUIRED: 'Rate limit exceeded. This may be because billing is not enabled on your account.',
    ACCESS_FORBIDDEN: 'Access forbidden. If using a paid model, please ensure billing is enabled on your account.',
    INSUFFICIENT_CREDITS: 'Insufficient credits. Please check your account billing.',
    NO_CONTENT_FOUND: 'No content found on this page.',
    NO_RESPONSE_GENERATED: 'No response generated from AI provider.',
    INVALID_REQUEST: 'Invalid request format.'
  },
  
  // API key validation patterns
  API_KEY_PATTERNS: {
    OPENAI: /^sk-[a-zA-Z0-9_-]{20,}$/,
    GEMINI: /^AIza[a-zA-Z0-9_-]{35}$/
  }
};

// Model configurations
export const MODELS = {
  OPENAI: {
    'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo', costPer1k: 0.001 },
    'gpt-4': { name: 'GPT-4', costPer1k: 0.03 },
    'gpt-4-turbo': { name: 'GPT-4 Turbo', costPer1k: 0.01 },
    'gpt-4o': { name: 'GPT-4o', costPer1k: 0.005 },
    'gpt-4o-mini': { name: 'GPT-4o Mini', costPer1k: 0.00015 },
    'gpt-4o-vision': { name: 'GPT-4o Vision', costPer1k: 0.005, isVision: true }
  },
  GEMINI: {
    'gemini-1.5-flash': { name: 'Gemini 1.5 Flash', costPer1k: 0.00075 },
    'gemini-1.5-pro': { name: 'Gemini 1.5 Pro', costPer1k: 0.0035 },
    'gemini-1.5-vision': { name: 'Gemini 1.5 Vision', costPer1k: 0.0035, isVision: true }
  }
};

// System prompts
export const PROMPTS = {
  SYSTEM_PROMPT: `You are a helpful AI assistant. Answer questions directly using your full knowledge, and naturally weave in any provided webpage content when relevant.
                 Don't start by analyzing what the webpage does or doesn't contain - just answer the question and incorporate the webpage content as supporting context when it's useful.
                 Focus on providing comprehensive, direct answers that seamlessly blend your knowledge with any relevant webpage information.
                 Be concise but thorough in your responses.`,
                 
  VISION_SYSTEM_PROMPT: `You are a helpful AI assistant. Answer questions directly using your full knowledge, and naturally weave in any provided webpage screenshots when relevant.
                        Don't start by analyzing what the screenshots do or don't show - just answer the question and incorporate the visual content as supporting context when it's useful.
                        You can see visual layout, images, text positioning, sidebars, navigation elements, and overall design in the screenshots.
                        Focus on providing comprehensive, direct answers that seamlessly blend your knowledge with any relevant visual information.
                        Be concise but thorough in your responses.`
};