// PagePal AI - Utility Functions

import { CONFIG } from './constants.js';

/**
 * Centralized error handling for API responses
 */
export function createAPIError(response, provider = 'API') {
  const statusCode = response.status;
  
  // Common HTTP status code mappings
  const errorMappings = {
    400: CONFIG.ERROR_MESSAGES.INVALID_REQUEST,
    401: CONFIG.ERROR_MESSAGES.INVALID_API_KEY,
    402: CONFIG.ERROR_MESSAGES.INSUFFICIENT_CREDITS,
    403: CONFIG.ERROR_MESSAGES.ACCESS_FORBIDDEN,
    429: CONFIG.ERROR_MESSAGES.RATE_LIMIT,
  };

  // Check for billing-related issues for paid models
  if (statusCode === 429) {
    // This could be enhanced with model checking logic
    return new Error(CONFIG.ERROR_MESSAGES.BILLING_REQUIRED);
  }

  const errorMessage = errorMappings[statusCode] || `${provider} API error: ${response.statusText}`;
  return new Error(errorMessage);
}

/**
 * Safe Chrome storage operations with error handling
 */
export const storage = {
  async get(keys, type = 'sync') {
    try {
      return await chrome.storage[type].get(keys);
    } catch (error) {
      console.error('Storage get error:', error);
      return {};
    }
  },

  async set(data, type = 'sync') {
    try {
      await chrome.storage[type].set(data);
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  },

  async remove(keys, type = 'sync') {
    try {
      await chrome.storage[type].remove(keys);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }
};

/**
 * API key validation utility
 */
export function validateAPIKey(apiKey, provider) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  const patterns = CONFIG.API_KEY_PATTERNS;
  
  switch (provider.toLowerCase()) {
    case 'openai':
      return patterns.OPENAI.test(apiKey);
    case 'gemini':
      return patterns.GEMINI.test(apiKey);
    default:
      return false;
  }
}

/**
 * Standardized error message formatter
 */
export function formatErrorMessage(error, prefix = '❌') {
  if (!error) return 'Unknown error occurred';
  
  const message = error.message || error.toString();
  return `${prefix} ${message}`;
}

/**
 * Debounce utility for UI operations
 */
export function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Initialize DOM elements by ID mapping
 */
export function initializeElements(elementIds) {
  const elements = {};
  elementIds.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      elements[id] = element;
    } else {
      console.warn(`Element with ID '${id}' not found`);
    }
  });
  return elements;
}

/**
 * Calculate estimated cost for API calls
 */
export function calculateTokenCost(model, inputLength, outputLength = 0, imageCount = 0) {
  // This would need to be implemented based on current pricing
  // Placeholder implementation
  const baseCost = 0.001; // per 1k tokens
  const tokens = Math.ceil((inputLength + outputLength) / 4); // rough token estimation
  const imageCost = imageCount * 0.01; // placeholder image cost
  
  return (tokens / 1000) * baseCost + imageCost;
}

/**
 * Simple text truncation with ellipsis
 */
export function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Check if a model supports vision capabilities
 */
export function isVisionModel(modelName) {
  return modelName && modelName.toLowerCase().includes('vision');
}

/**
 * Extract provider name from model
 */
export function getProviderFromModel(modelName) {
  if (!modelName) return null;
  
  if (modelName.startsWith('gpt')) return 'openai';
  if (modelName.startsWith('gemini')) return 'gemini';
  
  return null;
}