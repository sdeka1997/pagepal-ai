// PagePal AI - Centralized API Key Management

import { CONFIG } from './constants.js';
import { storage, validateAPIKey } from './utils.js';

export class APIKeyManager {
  constructor() {
    this.MASKED_VALUE = '••••••••••••••••';
  }

  /**
   * Get the storage key for a provider
   */
  getStorageKey(provider) {
    const keyMap = {
      'openai': CONFIG.STORAGE_KEYS.OPENAI_API_KEY,
      'gemini': CONFIG.STORAGE_KEYS.GEMINI_API_KEY
    };
    return keyMap[provider.toLowerCase()];
  }

  /**
   * Get API key for a provider from storage
   */
  async getAPIKey(provider) {
    const storageKey = this.getStorageKey(provider);
    if (!storageKey) return null;

    const result = await storage.get([storageKey]);
    return result[storageKey] || null;
  }

  /**
   * Save API key for a provider
   */
  async saveAPIKey(provider, apiKey) {
    const storageKey = this.getStorageKey(provider);
    if (!storageKey) return false;

    // Validate the key format
    if (!validateAPIKey(apiKey, provider)) {
      throw new Error(this.getValidationErrorMessage(provider));
    }

    const saveData = {
      apiProvider: provider,
      [storageKey]: apiKey
    };

    return await storage.set(saveData);
  }

  /**
   * Check if a provider has a valid API key stored
   */
  async hasValidAPIKey(provider) {
    const apiKey = await this.getAPIKey(provider);
    return apiKey !== null && validateAPIKey(apiKey, provider);
  }

  /**
   * Get all stored API keys
   */
  async getAllAPIKeys() {
    const keys = [
      CONFIG.STORAGE_KEYS.OPENAI_API_KEY,
      CONFIG.STORAGE_KEYS.GEMINI_API_KEY,
      CONFIG.STORAGE_KEYS.SELECTED_MODEL
    ];
    
    return await storage.get(keys);
  }

  /**
   * Get the current provider from storage
   */
  async getCurrentProvider() {
    const result = await storage.get(['apiProvider']);
    return result.apiProvider || 'gemini'; // default to gemini
  }

  /**
   * Set the current provider
   */
  async setCurrentProvider(provider) {
    return await storage.set({ apiProvider: provider });
  }

  /**
   * Check if the current provider has a valid API key
   */
  async hasValidCurrentProviderKey() {
    const currentProvider = await this.getCurrentProvider();
    return await this.hasValidAPIKey(currentProvider);
  }

  /**
   * Get validation error message for a provider
   */
  getValidationErrorMessage(provider) {
    const messages = {
      'openai': 'OpenAI API key should start with "sk-".',
      'gemini': 'Gemini API key should start with "AIza".'
    };
    return messages[provider.toLowerCase()] || 'Invalid API key format.';
  }

  /**
   * Get the appropriate API key for a model
   */
  async getAPIKeyForModel(modelName) {
    if (modelName.startsWith('gpt')) {
      return await this.getAPIKey('openai');
    } else if (modelName.startsWith('gemini')) {
      return await this.getAPIKey('gemini');
    }
    return null;
  }

  /**
   * Mask an API key for display
   */
  maskAPIKey(apiKey) {
    return apiKey ? this.MASKED_VALUE : '';
  }

  /**
   * Check if a value is the masked placeholder
   */
  isMaskedValue(value) {
    return value === this.MASKED_VALUE;
  }

  /**
   * Initialize UI element with masked value if key exists
   */
  async initializeUIElement(element, provider) {
    if (!element) return;

    const hasKey = await this.hasValidAPIKey(provider);
    if (hasKey) {
      element.value = this.MASKED_VALUE;
      // Force it to stick for OpenAI - something might be clearing it
      if (provider === 'openai') {
        setTimeout(() => {
          if (element.value !== this.MASKED_VALUE) {
            element.value = this.MASKED_VALUE;
          }
        }, 10);
      }
    } else {
      element.value = '';
    }
  }

  /**
   * Handle focus event for API key input (unmask for editing)
   */
  handleInputFocus(element) {
    if (element && this.isMaskedValue(element.value)) {
      element.value = '';
    }
  }

  /**
   * Handle blur event for API key input (mask if valid key exists)
   */
  async handleInputBlur(element, provider) {
    if (!element || element.value.trim()) return; // Don't mask if user is entering a new key

    const hasStoredKey = await this.hasValidAPIKey(provider);
    if (hasStoredKey) {
      element.value = this.MASKED_VALUE;
    }
  }

  /**
   * Get display-ready API key status for all providers
   */
  async getAPIKeyStatus() {
    const openaiKey = await this.hasValidAPIKey('openai');
    const geminiKey = await this.hasValidAPIKey('gemini');
    const currentProvider = await this.getCurrentProvider();

    return {
      openai: {
        hasKey: openaiKey,
        displayValue: openaiKey ? this.MASKED_VALUE : ''
      },
      gemini: {
        hasKey: geminiKey,
        displayValue: geminiKey ? this.MASKED_VALUE : ''
      },
      currentProvider,
      hasValidCurrentKey: (currentProvider === 'openai' && openaiKey) || 
                         (currentProvider === 'gemini' && geminiKey)
    };
  }

  /**
   * Clear all API keys from storage
   */
  async clearAllAPIKeys() {
    const keys = [
      CONFIG.STORAGE_KEYS.OPENAI_API_KEY,
      CONFIG.STORAGE_KEYS.GEMINI_API_KEY
    ];
    return await storage.remove(keys);
  }

  /**
   * Get input value from the appropriate element based on provider
   */
  getInputValueForProvider(provider, openaiInput, geminiInput) {
    if (provider === 'openai') {
      return openaiInput.value.trim();
    } else {
      return geminiInput.value.trim();
    }
  }

  /**
   * Get provider display name
   */
  getProviderDisplayName(provider) {
    return provider === 'openai' ? 'OpenAI' : 'Gemini';
  }

  /**
   * Handle provider-specific input focus and clearing
   */
  handleProviderInputFocus(provider, openaiInput, geminiInput) {
    if (provider === 'openai') {
      this.handleInputFocus(openaiInput);
      openaiInput.focus();
    } else {
      this.handleInputFocus(geminiInput);
      geminiInput.focus();
    }
  }
}