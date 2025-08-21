// PagePalAI Popup Script
class PagePalAIPopup {
  constructor() {
    this.submitBtn = document.getElementById('submitBtn');
    this.questionForm = document.getElementById('questionForm');
    this.questionInput = document.getElementById('question');
    this.modelSelect = document.getElementById('model');
    this.statusDiv = document.getElementById('status');
    this.loadingDiv = document.getElementById('loading');
    this.answerDiv = document.getElementById('answer');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.settingsSection = document.getElementById('settingsSection');
    this.apiKeyInput = document.getElementById('apiKey');
    this.saveKeyBtn = document.getElementById('saveKeyBtn');
    this.mainSection = document.getElementById('mainSection');
    
    this.init();
  }

  init() {
    this.questionForm.addEventListener('submit', (e) => this.handleSubmit(e));
    this.settingsBtn.addEventListener('click', () => this.toggleSettings());
    this.saveKeyBtn.addEventListener('click', () => this.saveApiKey());
    
    // Load saved preferences and check API key
    this.loadPreferences();
    
    // Save model preference when changed
    this.modelSelect.addEventListener('change', () => this.saveModelPreference());
  }

  async loadPreferences() {
    try {
      const result = await chrome.storage.sync.get(['preferredModel', 'openaiApiKey']);
      
      // Load model preference
      if (result.preferredModel) {
        this.modelSelect.value = result.preferredModel;
      }
      
      // Check if API key exists and show appropriate UI
      if (result.openaiApiKey) {
        this.showMainInterface();
        this.apiKeyInput.value = '••••••••••••••••'; // Masked display
      } else {
        this.showSettings();
      }
      
    } catch (error) {
      console.log('Could not load preferences:', error);
      this.showSettings();
    }
  }

  async saveModelPreference() {
    try {
      await chrome.storage.sync.set({ preferredModel: this.modelSelect.value });
    } catch (error) {
      console.log('Could not save model preference:', error);
    }
  }

  async saveApiKey() {
    const apiKey = this.apiKeyInput.value.trim();
    
    if (!apiKey || apiKey === '••••••••••••••••') {
      this.showStatus('Please enter a valid API key.', 'error');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      this.showStatus('API key should start with "sk-".', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ openaiApiKey: apiKey });
      this.showStatus('API key saved successfully!', 'success');
      setTimeout(() => {
        this.showMainInterface();
        this.hideStatus();
      }, 1500);
    } catch (error) {
      console.error('Error saving API key:', error);
      this.showStatus('Failed to save API key.', 'error');
    }
  }

  async toggleSettings() {
    if (this.settingsSection.style.display === 'none') {
      this.showSettings();
    } else {
      // Before going back to main interface, ensure API key exists
      const result = await chrome.storage.sync.get(['openaiApiKey']);
      if (result.openaiApiKey) {
        this.showMainInterface();
      } else {
        this.showStatus('Please enter your API key first.', 'error');
      }
    }
  }

  showSettings() {
    this.settingsSection.style.display = 'block';
    this.mainSection.style.display = 'none';
    this.settingsBtn.style.display = 'none'; // Hide settings button when on settings page
    this.apiKeyInput.focus();
    
    // Clear masked value when showing settings
    if (this.apiKeyInput.value === '••••••••••••••••') {
      this.apiKeyInput.value = '';
    }
  }

  showMainInterface() {
    this.settingsSection.style.display = 'none';
    this.mainSection.style.display = 'block';
    this.settingsBtn.style.display = 'block'; // Show settings button when on main interface
    this.questionInput.focus();
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    const question = this.questionInput.value.trim();
    if (!question) {
      this.showStatus('Please enter a question.', 'error');
      return;
    }

    // Check if API key is configured
    const result = await chrome.storage.sync.get(['openaiApiKey']);
    if (!result.openaiApiKey) {
      this.showStatus('Please configure your OpenAI API key first.', 'error');
      this.showSettings();
      return;
    }

    this.setLoading(true);
    this.hideStatus();
    this.hideAnswer();

    try {
      // Get page text from content script
      const pageData = await this.getPageText();
      
      if (!pageData.success) {
        throw new Error(pageData.error || 'Failed to extract page text');
      }

      this.showStatus(`Extracted ${pageData.length} characters from page`, 'info');

      // Send question to OpenAI directly
      const answer = await this.askQuestionOpenAI(question, pageData.text, this.modelSelect.value, result.openaiApiKey);
      
      this.showAnswer(answer);
      this.hideStatus();

    } catch (error) {
      console.error('Error processing question:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  async getPageText() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_PAGE_TEXT' }, (response) => {
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
          resolve({ success: false, error: 'No active tab found' });
        }
      });
    });
  }

  async askQuestionOpenAI(question, context, model, apiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that answers questions about web page content. 
                     Be concise but thorough. If the question cannot be answered from the provided context, 
                     say so clearly. Focus on information that is directly present in the page content.`
          },
          {
            role: 'user',
            content: `Based on the following webpage content, please answer this question: "${question}"

Webpage content:
${context.substring(0, 15000)}` // Limit context to ~15k chars to stay within token limits
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
        throw new Error('Insufficient credits. Please check your OpenAI account.');
      }
      
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  setLoading(isLoading) {
    this.submitBtn.disabled = isLoading;
    this.loadingDiv.style.display = isLoading ? 'block' : 'none';
    this.submitBtn.textContent = isLoading ? 'Processing...' : 'Ask Question';
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
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PagePalAIPopup();
});