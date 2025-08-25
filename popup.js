// PagePalAI Popup Script

// Import constants and utilities
import { CONFIG, PROMPTS } from './constants.js';
import { createAPIError, storage, validateAPIKey, formatErrorMessage, initializeElements } from './utils.js';
import { APIKeyManager } from './api-key-manager.js';

// Base class for AI providers
class AIProvider {
  constructor(name) {
    this.name = name;
  }

  // Abstract methods that each provider must implement
  getEndpoint(model, apiKey) {
    throw new Error(`${this.name}: getEndpoint must be implemented`);
  }

  getHeaders(apiKey) {
    throw new Error(`${this.name}: getHeaders must be implemented`);
  }

  formatRequest(question, context, model, sessionContext) {
    throw new Error(`${this.name}: formatRequest must be implemented`);
  }

  parseResponse(data) {
    throw new Error(`${this.name}: parseResponse must be implemented`);
  }

  handleError(response, model) {
    throw new Error(`${this.name}: handleError must be implemented`);
  }

  // Common method used by all providers
  async askQuestion(question, context, model, apiKey, sessionContext = '') {
    try {
      const endpoint = this.getEndpoint(model, apiKey);
      const headers = this.getHeaders(apiKey);
      const body = this.formatRequest(question, context, model, sessionContext);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        await this.handleError(response, model);
      }

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      throw error;
    }
  }
}

// OpenAI provider implementation
class OpenAIProvider extends AIProvider {
  constructor() {
    super('OpenAI');
  }

  getEndpoint(model, apiKey) {
    return 'https://api.openai.com/v1/chat/completions';
  }

  getHeaders(apiKey) {
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  formatRequest(question, context, model, sessionContext) {
    return {
      model: model,
      messages: [
        {
          role: 'system',
          content: PROMPTS.SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `Please answer this question: "${question}"

${context ? `Here is some webpage content for reference:
${context.substring(0, CONFIG.MAX_CONTEXT_LENGTH)}${sessionContext}` : ''}`
        }
      ],
      max_tokens: CONFIG.DEFAULT_MAX_TOKENS,
      temperature: CONFIG.DEFAULT_TEMPERATURE,
    };
  }

  parseResponse(data) {
    return data.choices[0].message.content;
  }

  async handleError(response, model) {
    throw createAPIError(response, this.name);
  }
}

// Gemini provider implementation
class GeminiProvider extends AIProvider {
  constructor() {
    super('Gemini');
  }

  getEndpoint(model, apiKey) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  }

  getHeaders(apiKey) {
    return {
      'Content-Type': 'application/json',
    };
  }

  formatRequest(question, context, model, sessionContext) {
    return {
      contents: [{
        parts: [{
          text: `${PROMPTS.SYSTEM_PROMPT}

Please answer this question: "${question}"

${context ? `Here is some webpage content for reference:
${context.substring(0, CONFIG.MAX_CONTEXT_LENGTH)}${sessionContext}` : ''}`
        }]
      }],
      generationConfig: {
        maxOutputTokens: CONFIG.DEFAULT_MAX_TOKENS,
        temperature: CONFIG.DEFAULT_TEMPERATURE,
      }
    };
  }

  // Vision-specific request formatting
  formatVisionRequest(question, visualData, model, sessionContext) {
    // Convert images to base64 format for Gemini
    const imageParts = visualData.viewports.map(viewport => ({
      inlineData: {
        mimeType: 'image/png',
        data: viewport.screenshot.split(',')[1] // Remove data:image/png;base64, prefix
      }
    }));

    return {
      contents: [{
        parts: [
          {
            text: `${PROMPTS.VISION_SYSTEM_PROMPT}

Please answer this question: "${question}"

${visualData.viewports.length > 0 ? `I've captured ${visualData.viewports.length} viewport screenshots of this page: ${visualData.pageInfo.title} (${visualData.pageInfo.url})${sessionContext}` : ''}`
          },
          ...imageParts
        ]
      }],
      generationConfig: {
        maxOutputTokens: CONFIG.DEFAULT_MAX_TOKENS,
        temperature: CONFIG.DEFAULT_TEMPERATURE,
      }
    };
  }

  // Vision-specific method
  async askVisionQuestion(question, visualData, model, apiKey, sessionContext = '') {
    try {
      const endpoint = this.getEndpoint(model, apiKey);
      const headers = this.getHeaders(apiKey);
      const body = this.formatVisionRequest(question, visualData, model, sessionContext);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        await this.handleError(response, model);
      }

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      throw error;
    }
  }

  parseResponse(data) {
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('No response generated from Gemini');
    }
    
    return data.candidates[0].content.parts[0].text;
  }

  async handleError(response, model) {
    throw createAPIError(response, this.name);
  }
}

class PagePalAIPopup {
  constructor() {
    // Initialize AI providers and key manager
    this.openaiProvider = new OpenAIProvider();
    this.geminiProvider = new GeminiProvider();
    this.apiKeyManager = new APIKeyManager();
    
    // Initialize DOM elements
    const elementIds = [
      'askQuestionBtn', 'scanPageBtn', 'question', 'model', 'extractionMode2',
      'questionSection', 'casualModeOptions', 'status', 'loading', 'answer',
      'settingsBtn', 'settingsSection', 'apiProvider', 'openaiApiKey', 'geminiApiKey',
      'openaiSettings', 'geminiSettings', 'saveKeyBtn', 'resetCostBtn', 'resetAllDataBtn',
      'backToMainBtn', 'mainSection', 'themeToggle', 'costInfo', 'estimatedCost',
      'cumulativeCost', 'startSessionBtn', 'endSessionBtn', 'activeSession',
      'sessionPages', 'freePlan', 'paidPlan'
    ];
    
    const elements = initializeElements(elementIds);
    
    
    // Map elements to instance properties with fallbacks
    this.askQuestionBtn = elements.askQuestionBtn || document.getElementById('askQuestionBtn');
    this.scanPageBtn = elements.scanPageBtn || document.getElementById('scanPageBtn');
    this.questionInput = elements.question || document.getElementById('question');
    this.modelSelect = elements.model || document.getElementById('model');
    this.extractionModeSelect2 = elements.extractionMode2 || document.getElementById('extractionMode2');
    this.questionSection = elements.questionSection || document.getElementById('questionSection');
    this.casualModeOptions = elements.casualModeOptions || document.getElementById('casualModeOptions');
    this.statusDiv = elements.status || document.getElementById('status');
    this.loadingDiv = elements.loading || document.getElementById('loading');
    this.answerDiv = elements.answer || document.getElementById('answer');
    this.settingsBtn = elements.settingsBtn || document.getElementById('settingsBtn');
    this.settingsSection = elements.settingsSection || document.getElementById('settingsSection');
    this.apiProviderSelect = elements.apiProvider || document.getElementById('apiProvider');
    this.openaiApiKeyInput = elements.openaiApiKey || document.getElementById('openaiApiKey');
    this.geminiApiKeyInput = elements.geminiApiKey || document.getElementById('geminiApiKey');
    this.openaiSettings = elements.openaiSettings || document.getElementById('openaiSettings');
    this.geminiSettings = elements.geminiSettings || document.getElementById('geminiSettings');
    this.saveKeyBtn = elements.saveKeyBtn || document.getElementById('saveKeyBtn');
    this.resetCostBtn = elements.resetCostBtn || document.getElementById('resetCostBtn');
    this.resetAllDataBtn = elements.resetAllDataBtn || document.getElementById('resetAllDataBtn');
    this.backToMainBtn = elements.backToMainBtn || document.getElementById('backToMainBtn');
    this.mainSection = elements.mainSection || document.getElementById('mainSection');
    this.themeToggle = elements.themeToggle || document.getElementById('themeToggle');
    this.costInfo = elements.costInfo || document.getElementById('costInfo');
    this.estimatedCostSpan = elements.estimatedCost || document.getElementById('estimatedCost');
    this.cumulativeCostSpan = elements.cumulativeCost || document.getElementById('cumulativeCost');
    this.startSessionBtn = elements.startSessionBtn || document.getElementById('startSessionBtn');
    this.endSessionBtn = elements.endSessionBtn || document.getElementById('endSessionBtn');
    this.activeSessionDiv = elements.activeSession || document.getElementById('activeSession');
    this.sessionPagesSpan = elements.sessionPages || document.getElementById('sessionPages');
    this.freePlanRadio = elements.freePlan || document.getElementById('freePlan');
    this.paidPlanRadio = elements.paidPlan || document.getElementById('paidPlan');
    
    this.cumulativeCost = 0;
    this.studySession = {
      active: false,
      pages: [],
      startTime: null
    };
    
    // Store scanned content for reuse
    this.scannedContent = null;
    
    this.init();
  }

  init() {
    this.askQuestionBtn.addEventListener('click', () => this.handleAskQuestion());
    this.scanPageBtn.addEventListener('click', () => this.handleScanPage());
    this.settingsBtn.addEventListener('click', () => this.toggleSettings());
    this.saveKeyBtn.addEventListener('click', () => this.saveApiKey());
    this.resetCostBtn.addEventListener('click', () => this.resetCostTracker());
    this.resetAllDataBtn.addEventListener('click', () => this.resetAllData());
    this.backToMainBtn.addEventListener('click', () => this.showMainInterface());
    this.themeToggle.addEventListener('click', () => this.toggleTheme());
    this.startSessionBtn.addEventListener('click', () => this.startStudySession());
    this.endSessionBtn.addEventListener('click', () => this.endStudySession());
    this.apiProviderSelect.addEventListener('change', () => {
      this.toggleProviderSettings();
    });
    this.freePlanRadio.addEventListener('change', () => this.updateModelList());
    this.paidPlanRadio.addEventListener('change', () => this.updateModelList());
    
    // Load saved preferences and check API key
    this.loadPreferences();
    
    // Initialize button states (Ask Question starts disabled)
    this.updateButtonStates();
    
    // Save model preference when changed
    this.modelSelect.addEventListener('change', () => this.saveModelPreference());
  }

  async loadPreferences() {
    try {
      const syncResult = await chrome.storage.sync.get([
        'preferredModel', 'openaiApiKey', 'geminiApiKey', 'apiProvider', 'theme', 'cumulativeCost', 'planType'
      ]);
      const localResult = await chrome.storage.local.get(['studySession']);
      
      // Load plan type preference (default to free)
      const planType = syncResult.planType || 'free';
      if (planType === 'free') {
        this.freePlanRadio.checked = true;
      } else {
        this.paidPlanRadio.checked = true;
      }
      
      // Initialize model list based on plan type
      this.updateModelList();
      
      // Load model preference
      if (syncResult.preferredModel) {
        this.modelSelect.value = syncResult.preferredModel;
      }
      
      // Set provider to first alphabetically available one with valid API key
      const providers = Array.from(this.apiProviderSelect.options).map(option => option.value);
      const sortedProviders = providers.sort(); // Sort alphabetically
      
      let selectedProvider = sortedProviders[0]; // Default to first alphabetically
      
      // Find first provider with valid API key (in alphabetical order)
      for (const provider of sortedProviders) {
        const hasValidKey = await this.apiKeyManager.hasValidAPIKey(provider);
        if (hasValidKey) {
          selectedProvider = provider;
          break;
        }
      }
      
      this.apiProviderSelect.value = selectedProvider;
      this.toggleProviderSettings();
      
      // Load cumulative cost
      this.cumulativeCost = syncResult.cumulativeCost || 0;
      if (this.cumulativeCost > 0 && planType === 'paid') {
        this.cumulativeCostSpan.textContent = `$${this.cumulativeCost.toFixed(4)}`;
        this.costInfo.style.display = 'block';
      }
      
      // Load study session
      if (localResult.studySession) {
        this.studySession = localResult.studySession;
        this.updateSessionUI();
      }
      
      // Load theme preference (default to dark)
      const theme = syncResult.theme || 'dark';
      this.applyTheme(theme);
      
      // Check if API keys exist and show appropriate UI
      const hasOpenAI = syncResult.openaiApiKey;
      const hasGemini = syncResult.geminiApiKey;
      const currentProvider = syncResult.apiProvider || 'gemini';
      
      // Only show main interface if the currently selected provider has a key
      const hasCurrentProviderKey = (currentProvider === 'openai' && hasOpenAI) || 
                                   (currentProvider === 'gemini' && hasGemini);
      
      if (hasCurrentProviderKey) {
        this.showMainInterface();
        // Initialize UI with masked values for all stored keys
        await this.apiKeyManager.initializeUIElement(this.openaiApiKeyInput, 'openai');
        await this.apiKeyManager.initializeUIElement(this.geminiApiKeyInput, 'gemini');
      } else {
        this.showSettings();
      }
      
    } catch (error) {
      this.showSettings();
      // Still apply dark theme as default even if loading fails
      this.applyTheme('dark');
      // Initialize model list even if loading fails
      this.updateModelList();
    }
  }

  async saveModelPreference() {
    try {
      await chrome.storage.sync.set({ preferredModel: this.modelSelect.value });
    } catch (error) {
      // Silently fail - not critical
    }
  }

  async saveApiKey() {
    const provider = this.apiProviderSelect.value;
    const apiKey = this.apiKeyManager.getInputValueForProvider(provider, this.openaiApiKeyInput, this.geminiApiKeyInput);
    
    if (!apiKey || this.apiKeyManager.isMaskedValue(apiKey)) {
      this.showStatus('Please enter a valid API key.', 'error');
      return;
    }

    try {
      await this.apiKeyManager.saveAPIKey(provider, apiKey);
      await this.apiKeyManager.setCurrentProvider(provider);
      
      const providerName = this.apiKeyManager.getProviderDisplayName(provider);
      this.showStatus(`${providerName} API key saved successfully!`, 'success');
      setTimeout(() => {
        this.showMainInterface();
        this.hideStatus();
      }, 1500);
    } catch (error) {
      console.error('Error saving API key:', error);
      this.showStatus(error.message || 'Failed to save API key.', 'error');
    }
  }

  async toggleSettings() {
    if (this.settingsSection.style.display === 'none') {
      this.showSettings();
    } else {
      // Before going back to main interface, ensure current provider has valid API key
      const hasValidKey = await this.apiKeyManager.hasValidCurrentProviderKey();
      if (hasValidKey) {
        this.showMainInterface();
      } else {
        this.showStatus('Please enter your API key first.', 'error');
      }
    }
  }

  async showSettings() {
    this.settingsSection.style.display = 'block';
    this.mainSection.style.display = 'none';
    this.settingsBtn.style.display = 'none'; // Hide settings button when on settings page
    
    // Ensure proper provider settings visibility first
    this.toggleProviderSettings();
    
    // Initialize API key fields properly (scalable)
    const providerElements = {
      'openai': this.openaiApiKeyInput,
      'gemini': this.geminiApiKeyInput
    };
    
    for (const [provider, element] of Object.entries(providerElements)) {
      if (element) {
        await this.apiKeyManager.initializeUIElement(element, provider);
      }
    }
    
    // Show back button if ANY provider has valid key (scalable)
    const providers = Array.from(this.apiProviderSelect.options).map(option => option.value);
    const validKeyChecks = await Promise.all(
      providers.map(provider => this.apiKeyManager.hasValidAPIKey(provider))
    );
    const hasAnyValidKey = validKeyChecks.some(hasKey => hasKey);
    this.backToMainBtn.style.display = hasAnyValidKey ? 'block' : 'none';
    
    // Don't auto-focus - let user click to focus when they want to edit
  }

  toggleProviderSettings() {
    const provider = this.apiProviderSelect.value;
    if (provider === 'openai') {
      this.openaiSettings.style.display = 'block';
      this.geminiSettings.style.display = 'none';
    } else {
      this.openaiSettings.style.display = 'none';
      this.geminiSettings.style.display = 'block';
    }
    
    // Note: Masked values will be handled elsewhere to avoid async issues
  }

  // Helper function to check if extraction mode is visual
  isVisualMode(extractionMode) {
    return extractionMode === 'visual_current_viewport' || extractionMode === 'visual_auto_scroll';
  }

  // Helper function to get visual mode from extraction mode
  getVisualModeFromExtraction(extractionMode) {
    if (extractionMode === 'visual_current_viewport') return 'current_viewport';
    if (extractionMode === 'visual_auto_scroll') return 'auto_scroll';
    return 'current_viewport'; // default
  }

  updateUIForSessionStatus() {
    const isStudySessionActive = this.studySession && this.studySession.active;
    
    if (isStudySessionActive) {
      // Study session mode: Show scan button inside gray box
      this.scanPageBtn.style.display = 'block';
      this.casualModeOptions.style.display = 'block'; // Keep gray box visible
      this.questionSection.classList.add('study-session-mode');
      document.body.classList.add('study-session-active');
    } else {
      // Casual mode: Hide scan button, keep gray box
      this.scanPageBtn.style.display = 'none';
      this.casualModeOptions.style.display = 'block';
      this.questionSection.classList.remove('study-session-mode');
      document.body.classList.remove('study-session-active');
    }
    
    // Update button states
    this.updateButtonStates();
  }

  showMainInterface() {
    this.settingsSection.style.display = 'none';
    this.mainSection.style.display = 'block';
    this.settingsBtn.style.display = 'block'; // Show settings button when on main interface
    this.backToMainBtn.style.display = 'none'; // Hide back button when on main interface
    this.questionInput.focus();
  }

  async handleScanPage() {
    this.setLoading(true, 'Scanning page...', 'scan');
    this.hideStatus();
    this.hideAnswer();

    try {
      // Get page content from content script using gray box extraction mode
      const extractionMode = this.extractionModeSelect2.value;
      const pageData = await this.getPageContent(extractionMode);
      
      if (!pageData.success) {
        throw new Error(pageData.error || 'Failed to extract page content');
      }

      // Store the scanned content for reuse
      this.scannedContent = {
        data: pageData,
        extractionMode: extractionMode,
        timestamp: Date.now()
      };

      // Add page to session if active
      await this.addPageToSession(pageData, extractionMode);
      
      // Show success message
      if (this.isVisualMode(extractionMode)) {
        const visualMode = this.getVisualModeFromExtraction(extractionMode);
        const modeText = visualMode === 'current_viewport' 
          ? `current viewport` 
          : `${pageData.data.viewports.length} viewport screenshots`;
        this.showStatus(`✓ Page scanned: captured ${modeText}`, 'success');
      } else {
        const modeText = 'structured content';
        this.showStatus(`✓ Page scanned: extracted ${pageData.length} characters of ${modeText}`, 'success');
      }

      // Update scan button to show it's been scanned
      this.scanPageBtn.textContent = '✓ Page Scanned - Rescan?';
      
      // Enable the Ask Question button now that we have content
      this.updateButtonStates();

    } catch (error) {
      console.error('Error scanning page:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    } finally {
      this.setLoading(false, '', 'scan');
    }
  }

  async performAutoScan() {
    try {
      this.setLoading(true, 'Scanning page...', 'ask');
      
      // Use casual mode extraction settings and proper content script injection
      const extractionMode = this.extractionModeSelect2.value;
      const pageData = await this.getPageContent(extractionMode);
      
      if (!pageData.success) {
        throw new Error(pageData.error || 'Failed to extract page content');
      }
      
      // Store the scanned content
      this.scannedContent = {
        data: pageData,
        extractionMode: extractionMode,
        timestamp: Date.now()
      };
      
      // Don't add to session or show status during auto-scan to keep it seamless
      
    } catch (error) {
      console.error('Error during auto-scan:', error);
      throw error; // Re-throw so handleAskQuestion can handle it
    }
    // Note: Don't clear loading state here - let handleAskQuestion manage it
  }

  async handleAskQuestion() {
    const question = this.questionInput.value.trim();
    if (!question) {
      this.showStatus('Please enter a question.', 'error');
      return;
    }

    const isStudySessionActive = this.studySession && this.studySession.active;

    // If not in study session, perform auto-scan first
    if (!isStudySessionActive) {
      try {
        await this.performAutoScan();
      } catch (error) {
        console.error('Auto-scan failed:', error);
        this.showStatus(`Error scanning page: ${error.message}`, 'error');
        return;
      }
    }

    // Check if we have scanned content to use (after potential auto-scan)
    if (!this.scannedContent) {
      this.showStatus('Please scan the page first before asking questions.', 'error');
      return;
    }

    // Check if appropriate API key is configured
    const selectedModel = this.modelSelect.value;
    const isGemini = selectedModel.startsWith('gemini');
    
    const apiKey = await this.apiKeyManager.getAPIKeyForModel(selectedModel);
    
    if (!apiKey) {
      const provider = selectedModel.startsWith('gpt') ? 'OpenAI' : 'Gemini';
      this.showStatus(`Please configure your ${provider} API key first.`, 'error');
      this.showSettings();
      return;
    }

    this.setLoading(true, 'Processing question...', 'ask');
    this.hideStatus();
    this.hideAnswer();

    try {
      const sessionContext = this.buildSessionContext();
      const pageData = this.scannedContent.data;
      const extractionMode = this.scannedContent.extractionMode;
      
      let answer;
      let estimatedCost = 0;
      
      if (this.isVisualMode(extractionMode)) {
        // Calculate cost for visual mode
        const visionModel = isGemini ? 'gemini-1.5-vision' : 'gpt-4o-vision';
        const inputText = `Question: ${question}\nPage: ${pageData.data.pageInfo.title}${sessionContext}`;
        estimatedCost = this.calculateCost(visionModel, inputText, '', pageData.data.viewports.length);
        
        // Send question with visual data
        if (isGemini) {
          answer = await this.geminiProvider.askVisionQuestion(question, pageData.data, selectedModel, apiKey, sessionContext);
        } else {
          answer = await this.askQuestionWithVisual(question, pageData.data, selectedModel, apiKey, sessionContext);
        }
      } else {
        // Calculate cost for text mode
        const inputText = `Question: ${question}\nCurrent Page: ${pageData.text}${sessionContext}`;
        estimatedCost = this.calculateCost(selectedModel, inputText, '');
        
        // Send question with text
        if (isGemini) {
          answer = await this.geminiProvider.askQuestion(question, pageData.text, selectedModel, apiKey, sessionContext);
        } else {
          answer = await this.openaiProvider.askQuestion(question, pageData.text, selectedModel, apiKey, sessionContext);
        }
      }
      
      // Update cost with actual answer length and show result
      if (this.isVisualMode(extractionMode)) {
        const finalInputText = `Question: ${question}\nPage: ${pageData.data.pageInfo.title}${sessionContext}`;
        estimatedCost = this.calculateCost(isGemini ? 'gemini-1.5-vision' : 'gpt-4o-vision', finalInputText, answer, pageData.data.viewports.length);
      } else {
        const finalInputText = `Question: ${question}\nContext: ${pageData.text}${sessionContext}`;
        estimatedCost = this.calculateCost(selectedModel, finalInputText, answer);
      }
      
      this.showAnswer(answer);
      await this.showCostInfo(estimatedCost);
      this.hideStatus();

    } catch (error) {
      console.error('Error processing question:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    } finally {
      this.setLoading(false, '', 'ask');
    }
  }

  async getPageContent(extractionMode = 'structured') {
    return new Promise(async (resolve) => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
          resolve({ success: false, error: 'No active tab found' });
          return;
        }

        const tabId = tabs[0].id;

        if (this.isVisualMode(extractionMode)) {
          // Inject visual content script
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content-visual.js']
          });

          // Use the visual mode from extraction mode
          const visualMode = this.getVisualModeFromExtraction(extractionMode);

          // Send message for visual extraction
          chrome.tabs.sendMessage(tabId, { 
            action: 'GET_PAGE_VISUAL',
            mode: visualMode
          }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ 
                success: false, 
                error: chrome.runtime.lastError.message 
              });
            } else {
              resolve(response || { success: false, error: 'No response from content script' });
            }
          });
        } else {
          // Send message with extraction mode (content script already loaded via manifest)
          chrome.tabs.sendMessage(tabId, { 
            action: 'GET_PAGE_TEXT',
            mode: extractionMode
          }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ 
                success: false, 
                error: chrome.runtime.lastError.message 
              });
            } else {
              resolve(response || { success: false, error: 'No response from content script' });
            }
          });
        }
      } catch (error) {
        resolve({ success: false, error: error.message });
      }
    });
  }

  async askQuestionWithVisual(question, visualData, model, apiKey, sessionContext = '') {
    // For visual mode, we'll create a composite image and send to GPT-4 Vision
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Use vision model
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI assistant. You can answer general knowledge questions and also analyze webpage screenshots when provided.
                     When analyzing screenshots, you can see the visual layout, images, text positioning, sidebars, navigation elements, and overall design.
                     For general questions not related to the screenshots, answer normally using your knowledge.
                     Be concise but thorough in your responses.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please answer this question: "${question}"\n\n${visualData.viewports.length > 0 ? `I've captured ${visualData.viewports.length} viewport screenshots of this page: ${visualData.pageInfo.title} (${visualData.pageInfo.url})${sessionContext}` : ''}`
              },
              ...visualData.viewports.map((viewport, index) => ({
                type: 'image_url',
                image_url: {
                  url: viewport.screenshot,
                  detail: 'high'
                }
              }))
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your OpenAI API key.');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (response.status === 402) {
        throw new Error('Insufficient credits. Please check your account billing.');
      }
      
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }


  setLoading(isLoading, message = 'Processing...', buttonType = 'ask') {
    if (buttonType === 'scan') {
      this.scanPageBtn.disabled = isLoading;
      this.scanPageBtn.textContent = isLoading ? message : 'Scan Page';
    } else {
      this.askQuestionBtn.disabled = isLoading;
      this.askQuestionBtn.textContent = isLoading ? message : 'Ask Question';
    }
    this.loadingDiv.style.display = isLoading ? 'block' : 'none';
  }

  updateButtonStates() {
    const isStudySessionActive = this.studySession && this.studySession.active;
    const hasScannedContent = !!this.scannedContent;
    
    if (isStudySessionActive) {
      // Study session mode: Ask Question button disabled until page is scanned
      this.askQuestionBtn.disabled = !hasScannedContent;
      this.askQuestionBtn.style.opacity = hasScannedContent ? '1' : '0.5';
      this.askQuestionBtn.title = hasScannedContent ? 'Ask a question about the scanned content' : 'Please scan the page first';
    } else {
      // Casual mode: Ask Question button always enabled (does scan + ask)
      this.askQuestionBtn.disabled = false;
      this.askQuestionBtn.style.opacity = '1';
      this.askQuestionBtn.title = 'Ask a question (will automatically scan the page)';
    }
  }

  showStatus(message, type = 'info') {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;
    this.statusDiv.style.display = 'block';
  }

  hideStatus() {
    this.statusDiv.style.display = 'none';
  }

  showAnswer(answer) {
    this.answerDiv.textContent = answer;
    this.answerDiv.style.display = 'block';
  }

  hideAnswer() {
    this.answerDiv.style.display = 'none';
  }

  async toggleTheme() {
    try {
      const result = await chrome.storage.sync.get(['theme']);
      const currentTheme = result.theme || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      this.applyTheme(newTheme);
      await this.saveTheme(newTheme);
    } catch (error) {
      // Silently fail
    }
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update theme toggle button icon
    if (theme === 'dark') {
      this.themeToggle.textContent = '☀️'; // Sun icon for switching to light
      this.themeToggle.title = 'Switch to light mode';
    } else {
      this.themeToggle.textContent = '🌙'; // Moon icon for switching to dark
      this.themeToggle.title = 'Switch to dark mode';
    }
  }

  async saveTheme(theme) {
    try {
      await chrome.storage.sync.set({ theme: theme });
    } catch (error) {
      // Silently fail
    }
  }

  // Estimate cost per typical API call (assuming ~1000 input tokens, ~300 output tokens)
  estimateCostPerCall(modelName) {
    if (modelName.startsWith('gemini')) {
      return 0; // Free tier
    }

    const pricing = this.getPricingInfo();
    const modelPricing = pricing[modelName];
    
    if (!modelPricing) return 0;
    
    // Typical API call: ~1000 input tokens, ~300 output tokens
    const typicalInputTokens = 1000;
    const typicalOutputTokens = 300;
    
    const cost = (typicalInputTokens / 1000) * modelPricing.input + 
                 (typicalOutputTokens / 1000) * modelPricing.output;
    
    return cost;
  }

  getAvailableModels() {
    return {
      free: [
        { 
          value: 'gemini-1.5-flash', 
          label: 'Gemini 1.5 Flash (Fast & Free)', 
          group: 'Google Gemini (Free)' 
        }
      ],
      paid: [
        // Gemini Free first
        { 
          value: 'gemini-1.5-flash', 
          label: 'Gemini 1.5 Flash (Fast & Free)', 
          group: 'Google Gemini (Free)' 
        },
        // Gemini Paid second
        { 
          value: 'gemini-1.5-pro', 
          label: 'Gemini 1.5 Pro (Advanced)', 
          group: 'Google Gemini (Paid)' 
        },
        // OpenAI models last, ordered by cost
        { 
          value: 'gpt-4o-mini', 
          label: 'GPT-4o Mini (Fast)', 
          group: 'OpenAI (Paid)' 
        },
        { 
          value: 'gpt-4o', 
          label: 'GPT-4o (Balanced)', 
          group: 'OpenAI (Paid)' 
        },
        { 
          value: 'gpt-4-turbo', 
          label: 'GPT-4 Turbo (Advanced)', 
          group: 'OpenAI (Paid)' 
        }
      ]
    };
  }

  async updateModelList() {
    const isFree = this.freePlanRadio.checked;
    const models = this.getAvailableModels();
    const availableModels = isFree ? models.free : models.paid;
    
    // Save plan type preference
    try {
      await chrome.storage.sync.set({ planType: isFree ? 'free' : 'paid' });
    } catch (error) {
      // Silently fail
    }
    
    // Clear existing options
    this.modelSelect.innerHTML = '';
    
    // Group models by provider in desired order
    const groupedModels = {};
    availableModels.forEach(model => {
      if (!groupedModels[model.group]) {
        groupedModels[model.group] = [];
      }
      groupedModels[model.group].push(model);
    });
    
    // Define the order of groups (by estimated cost)
    const groupOrder = [
      'Google Gemini (Free)',
      'Google Gemini (Paid)', 
      'OpenAI (Paid)'
    ];
    
    // Create optgroups and options in the specified order
    groupOrder.forEach(groupName => {
      if (groupedModels[groupName]) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = groupName;
        
        groupedModels[groupName].forEach(model => {
          const option = document.createElement('option');
          option.value = model.value;
          option.textContent = model.label;
          optgroup.appendChild(option);
        });
        
        this.modelSelect.appendChild(optgroup);
      }
    });
    
    // Update cost info visibility - only hide if free AND no cumulative cost
    if (isFree && this.cumulativeCost === 0) {
      this.hideCostInfo();
    } else if (this.cumulativeCost > 0) {
      this.costInfo.style.display = 'block';
    }
  }

  // AI model pricing (as of current rates)
  getPricingInfo() {
    return {
      // OpenAI pricing
      'gpt-4o-mini': { input: 0.000150, output: 0.000600 }, // per 1K tokens
      'gpt-4o': { input: 0.0025, output: 0.01 }, // per 1K tokens  
      'gpt-4-turbo': { input: 0.01, output: 0.03 }, // per 1K tokens
      'gpt-4o-vision': { input: 0.0025, output: 0.01, image: 0.00765 }, // per image (high detail)
      
      // Gemini pricing (generous free tier)
      'gemini-1.5-flash': { input: 0.000075, output: 0.0003 }, // per 1K tokens (paid tier)
      'gemini-1.5-pro': { input: 0.00125, output: 0.005 }, // per 1K tokens (paid tier)
      'gemini-1.5-vision': { input: 0.00125, output: 0.005, image: 0.0025 } // per image
    };
  }

  estimateTokens(text) {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  calculateCost(model, inputText, outputText, imageCount = 0) {
    // Check if this is a Gemini model (free tier available)
    if (model.startsWith('gemini')) {
      // For Gemini, show $0.00 since free tier is very generous
      // (15 requests/minute, 1M requests/day)
      return 0;
    }

    const pricing = this.getPricingInfo();
    let modelPricing;

    // Handle vision model
    if (imageCount > 0) {
      modelPricing = pricing['gpt-4o-vision'];
    } else {
      modelPricing = pricing[model] || pricing['gpt-4o-mini'];
    }

    const inputTokens = this.estimateTokens(inputText || '');
    const outputTokens = this.estimateTokens(outputText || '');

    let cost = 0;
    cost += (inputTokens / 1000) * modelPricing.input;
    cost += (outputTokens / 1000) * modelPricing.output;
    
    // Add image costs for vision
    if (imageCount > 0 && modelPricing.image) {
      cost += imageCount * modelPricing.image;
    }

    return cost;
  }

  async showCostInfo(estimatedCost) {
    // Don't show cost info in free mode
    if (this.freePlanRadio.checked) {
      return;
    }
    
    this.cumulativeCost += estimatedCost;
    
    // Show "FREE" for zero costs (Gemini free tier)
    if (estimatedCost === 0) {
      this.estimatedCostSpan.textContent = 'FREE';
    } else {
      this.estimatedCostSpan.textContent = `$${estimatedCost.toFixed(4)}`;
    }
    
    this.cumulativeCostSpan.textContent = `$${this.cumulativeCost.toFixed(4)}`;
    this.costInfo.style.display = 'block';
    
    // Save cumulative cost to storage
    try {
      await chrome.storage.sync.set({ cumulativeCost: this.cumulativeCost });
    } catch (error) {
      // Silently fail
    }
  }

  hideCostInfo() {
    this.costInfo.style.display = 'none';
  }

  async resetCostTracker() {
    this.cumulativeCost = 0;
    this.cumulativeCostSpan.textContent = '$0.00';
    this.estimatedCostSpan.textContent = '$0.00';
    this.hideCostInfo();
    
    try {
      await chrome.storage.sync.set({ cumulativeCost: 0 });
      this.showStatus('Cost tracker reset successfully!', 'success');
      setTimeout(() => this.hideStatus(), 2000);
    } catch (error) {
      console.error('Error resetting cost tracker:', error);
      this.showStatus('Failed to reset cost tracker.', 'error');
    }
  }

  async resetAllData() {
    // Create custom confirmation using the status system
    this.showStatus(
      '⚠️ Click the button again to confirm: This will clear ALL data (API keys, preferences, sessions). This cannot be undone!',
      'error'
    );
    
    // Change button to confirmation state
    this.resetAllDataBtn.textContent = '⚠️ Confirm Reset ALL';
    this.resetAllDataBtn.style.background = '#dc2626';
    
    // Replace the event listener with confirmation handler
    this.resetAllDataBtn.removeEventListener('click', this.resetAllData);
    this.resetAllDataBtn.addEventListener('click', this.confirmResetAllData.bind(this), { once: true });
    
    // Reset back to normal after 5 seconds if not clicked
    setTimeout(() => {
      if (this.resetAllDataBtn.textContent.includes('Confirm')) {
        this.resetAllDataBtn.textContent = '🗑️ Reset All Data';
        this.resetAllDataBtn.style.background = '#dc3545';
        this.resetAllDataBtn.removeEventListener('click', this.confirmResetAllData);
        this.resetAllDataBtn.addEventListener('click', this.resetAllData.bind(this));
        this.hideStatus();
      }
    }, 5000);
  }

  async confirmResetAllData() {
    try {
      // Clear all stored data
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
      
      // Reset in-memory state
      this.studySession = null;
      this.scannedContent = null;
      this.cumulativeCost = 0;
      
      // Reset UI elements immediately
      this.updateSessionUI();
      this.updateButtonStates();
      this.hideCostInfo();
      this.hideAnswer();
      this.hideStatus();
      
      // Clear form inputs
      this.questionInput.value = '';
      this.openaiApiKeyInput.value = '';
      this.geminiApiKeyInput.value = '';
      
      // Reset scan button text
      this.scanPageBtn.textContent = 'Scan Page';
      
      this.showStatus('✅ All data reset successfully! Extension will reload...', 'success');
      
      // Reload the popup after a short delay to show fresh state
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error('Error resetting all data:', error);
      this.showStatus('❌ Failed to reset all data: ' + error.message, 'error');
      
      // Reset button back to normal
      this.resetAllDataBtn.textContent = '🗑️ Reset All Data';
      this.resetAllDataBtn.style.background = '#dc3545';
      this.resetAllDataBtn.addEventListener('click', this.resetAllData.bind(this));
    }
  }

  async startStudySession() {
    this.studySession = {
      active: true,
      pages: [],
      startTime: Date.now()
    };

    this.updateSessionUI();
    
    try {
      await chrome.storage.local.set({ studySession: this.studySession });
      this.showStatus('Study session started! Context will be preserved across pages.', 'success');
      setTimeout(() => this.hideStatus(), 3000);
    } catch (error) {
      console.error('Error starting study session:', error);
    }
  }

  async endStudySession() {
    this.studySession = {
      active: false,
      pages: [],
      startTime: null
    };

    this.updateSessionUI();
    
    try {
      await chrome.storage.local.remove('studySession');
      this.showStatus('Study session ended. Context cleared.', 'info');
      setTimeout(() => this.hideStatus(), 2000);
    } catch (error) {
      console.error('Error ending study session:', error);
    }
  }

  updateSessionUI() {
    if (this.studySession && this.studySession.active) {
      this.startSessionBtn.style.display = 'none';
      this.activeSessionDiv.style.display = 'flex';
      this.sessionPagesSpan.textContent = `${this.studySession.pages.length} pages`;
    } else {
      this.startSessionBtn.style.display = 'block';
      this.activeSessionDiv.style.display = 'none';
    }
    
    // Update the adaptive UI based on session status
    this.updateUIForSessionStatus();
  }

  async addPageToSession(pageData, extractionMode) {
    if (!this.studySession || !this.studySession.active) {
      return;
    }

    const currentUrl = pageData.url || 'unknown';
    const pageTitle = pageData.title || 'Unknown Page';
    
    // Check if this page is already in the session
    const existingPageIndex = this.studySession.pages.findIndex(page => page.url === currentUrl);
    
    const pageInfo = {
      url: currentUrl,
      title: pageTitle,
      extractionMode: extractionMode,
      content: pageData,
      timestamp: Date.now()
    };

    if (existingPageIndex >= 0) {
      // Update existing page
      this.studySession.pages[existingPageIndex] = pageInfo;
    } else {
      // Add new page
      this.studySession.pages.push(pageInfo);
    }
    this.updateSessionUI();
    
    try {
      await chrome.storage.local.set({ studySession: this.studySession });
    } catch (error) {
      console.error('Error saving session data:', error);
    }
  }

  buildSessionContext() {
    if (!this.studySession || !this.studySession.active || this.studySession.pages.length === 0) {
      return '';
    }

    let context = `\n\n=== STUDY SESSION CONTEXT ===\n`;
    context += `Session contains ${this.studySession.pages.length} page(s):\n\n`;

    this.studySession.pages.forEach((page, index) => {
      context += `--- PAGE ${index + 1}: ${page.title} ---\n`;
      context += `URL: ${page.url}\n`;
      context += `Extraction Mode: ${page.extractionMode}\n\n`;
      
      if (this.isVisualMode(page.extractionMode)) {
        context += `[Visual content - ${page.content.data?.viewports?.length || 0} screenshots captured]\n`;
        context += `Page Info: ${JSON.stringify(page.content.data?.pageInfo || {}, null, 2)}\n\n`;
      } else {
        context += `Content:\n${page.content.text || 'No content'}\n\n`;
      }
    });

    context += `=== END SESSION CONTEXT ===\n\n`;
    return context;
  }

}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PagePalAIPopup();
});