/**
 * SettingsController - Manages Settings Modal, API Credentials, Model Configuration, and User Profile.
 */
import { StorageService } from '../services/storage.js';
import { LLMService } from '../services/llm.js';

export class SettingsController {
  constructor({ onSettingsSaved, showToast }) {
    this.onSettingsSaved = onSettingsSaved;
    this.showToast = showToast;

    // Elements
    this.modal = document.getElementById('settings-modal');
    this.btnClose = document.getElementById('btn-close-settings');
    this.btnSave = document.getElementById('btn-save-settings');
    this.btnTest = document.getElementById('btn-test-connection');
    this.testStatus = document.getElementById('test-connection-status');

    // Provider Tabs
    this.providerTabs = document.querySelectorAll('.provider-tab');
    this.providerPanels = document.querySelectorAll('.provider-panel');

    // Inputs
    this.inputGeminiKey = document.getElementById('setting-gemini-key');
    this.selectGeminiModel = document.getElementById('setting-gemini-model');
    this.inputGeminiCustomModel = document.getElementById('setting-gemini-custom-model');
    this.groupGeminiCustom = document.getElementById('group-gemini-custom-model');

    this.inputOpenAIKey = document.getElementById('setting-openai-key');
    this.selectOpenAIModel = document.getElementById('setting-openai-model');
    this.inputOpenAICustomModel = document.getElementById('setting-openai-custom-model');
    this.groupOpenAICustom = document.getElementById('group-openai-custom-model');

    // Critique Strictness
    this.selectCritiqueLevel = document.getElementById('setting-critique-level');

    // Profile Inputs
    this.selectLevel = document.getElementById('setting-user-level');
    this.inputRole = document.getElementById('setting-user-role');
    this.inputBackground = document.getElementById('setting-user-background');

    this.activeProvider = 'gemini';
    this._initEvents();
  }

  _initEvents() {
    this.btnClose?.addEventListener('click', () => this.close());
    this.btnSave?.addEventListener('click', () => this.save());
    this.btnTest?.addEventListener('click', () => this.testConnection());

    // Toggle custom model input on dropdown changes
    this.selectGeminiModel?.addEventListener('change', () => {
      const isCustom = this.selectGeminiModel.value === 'custom';
      if (this.groupGeminiCustom) {
        this.groupGeminiCustom.style.display = isCustom ? 'block' : 'none';
        if (isCustom && this.inputGeminiCustomModel) this.inputGeminiCustomModel.focus();
      }
    });

    this.selectOpenAIModel?.addEventListener('change', () => {
      const isCustom = this.selectOpenAIModel.value === 'custom';
      if (this.groupOpenAICustom) {
        this.groupOpenAICustom.style.display = isCustom ? 'block' : 'none';
        if (isCustom && this.inputOpenAICustomModel) this.inputOpenAICustomModel.focus();
      }
    });

    // Provider tab switching
    this.providerTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.provider;
        this.setProvider(target);
      });
    });

    // Close on backdrop click
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
  }

  setProvider(provider) {
    this.activeProvider = provider;
    this.providerTabs.forEach(t => t.classList.toggle('active', t.dataset.provider === provider));
    this.providerPanels.forEach(p => p.classList.toggle('active', p.dataset.provider === provider));
    this.clearTestStatus();
  }

  async open() {
    const settings = await StorageService.getSettings();
    
    this.setProvider(settings.provider || 'gemini');
    if (this.inputGeminiKey) this.inputGeminiKey.value = settings.geminiKey || '';

    // Handle Gemini Model (preset vs custom)
    const geminiVal = settings.geminiModel || 'gemini-3.1-pro-preview';
    const isGeminiPreset = Array.from(this.selectGeminiModel?.options || []).some(o => o.value === geminiVal && o.value !== 'custom');
    if (isGeminiPreset) {
      if (this.selectGeminiModel) this.selectGeminiModel.value = geminiVal;
      if (this.groupGeminiCustom) this.groupGeminiCustom.style.display = 'none';
    } else {
      if (this.selectGeminiModel) this.selectGeminiModel.value = 'custom';
      if (this.inputGeminiCustomModel) this.inputGeminiCustomModel.value = geminiVal;
      if (this.groupGeminiCustom) this.groupGeminiCustom.style.display = 'block';
    }

    if (this.inputOpenAIKey) this.inputOpenAIKey.value = settings.openaiKey || '';

    // Handle OpenAI Model (preset vs custom)
    const openAIVal = settings.openaiModel || 'gpt-5';
    const isOpenAIPreset = Array.from(this.selectOpenAIModel?.options || []).some(o => o.value === openAIVal && o.value !== 'custom');
    if (isOpenAIPreset) {
      if (this.selectOpenAIModel) this.selectOpenAIModel.value = openAIVal;
      if (this.groupOpenAICustom) this.groupOpenAICustom.style.display = 'none';
    } else {
      if (this.selectOpenAIModel) this.selectOpenAIModel.value = 'custom';
      if (this.inputOpenAICustomModel) this.inputOpenAICustomModel.value = openAIVal;
      if (this.groupOpenAICustom) this.groupOpenAICustom.style.display = 'block';
    }

    if (this.selectCritiqueLevel) this.selectCritiqueLevel.value = settings.critiqueLevel || 'standard';
    if (this.selectLevel) this.selectLevel.value = settings.profile?.level || 'Senior';
    if (this.inputRole) this.inputRole.value = settings.profile?.targetRole || 'Distributed Systems & Backend Architect';
    if (this.inputBackground) this.inputBackground.value = settings.profile?.background || '';

    this.clearTestStatus();
    this.modal?.classList.add('open');
  }

  close() {
    this.modal?.classList.remove('open');
  }

  clearTestStatus() {
    if (!this.testStatus) return;
    this.testStatus.innerHTML = '';
    this.testStatus.className = 'test-status-box';
  }

  _resolveModel(provider) {
    if (provider === 'gemini') {
      const selectVal = this.selectGeminiModel?.value;
      if (selectVal === 'custom') {
        const raw = this.inputGeminiCustomModel?.value;
        return LLMService._sanitizeGeminiModel(raw);
      }
      return LLMService._sanitizeGeminiModel(selectVal);
    } else {
      const selectVal = this.selectOpenAIModel?.value;
      if (selectVal === 'custom') {
        return (this.inputOpenAICustomModel?.value || 'gpt-5').trim().toLowerCase();
      }
      return (selectVal || 'gpt-5').trim();
    }
  }

  async testConnection() {
    const provider = this.activeProvider;
    const apiKey = provider === 'gemini' 
      ? this.inputGeminiKey?.value.trim() 
      : this.inputOpenAIKey?.value.trim();

    const model = this._resolveModel(provider);

    if (!apiKey) {
      this.showToast(`Please enter an API Key for ${provider.toUpperCase()}`, 'error');
      return;
    }

    this.btnTest.disabled = true;
    this.testStatus.innerHTML = `
      <div class="status-testing">
        <div class="spinner"></div>
        <span>Testing live connection to ${provider.toUpperCase()} (${model})...</span>
      </div>
    `;
    this.testStatus.className = 'test-status-box testing';

    try {
      const result = await LLMService.testConnection(provider, apiKey, model);
      if (result.success) {
        this.testStatus.innerHTML = `
          <div class="status-success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>Connected successfully to ${provider.toUpperCase()} (${model})!</span>
          </div>
        `;
        this.testStatus.className = 'test-status-box success';
        this.showToast(`Connected to ${model}!`, 'success');
      } else {
        this.testStatus.innerHTML = `
          <div class="status-error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span>${result.error}</span>
          </div>
        `;
        this.testStatus.className = 'test-status-box error';
        this.showToast(`Connection failed: ${result.error}`, 'error');
      }
    } catch (err) {
      this.testStatus.innerHTML = `<div class="status-error">Error: ${err.message}</div>`;
      this.testStatus.className = 'test-status-box error';
    } finally {
      this.btnTest.disabled = false;
    }
  }

  async save() {
    const updated = {
      provider: this.activeProvider,
      geminiKey: this.inputGeminiKey?.value.trim() || '',
      geminiModel: this._resolveModel('gemini'),
      openaiKey: this.inputOpenAIKey?.value.trim() || '',
      openaiModel: this._resolveModel('openai'),
      critiqueLevel: this.selectCritiqueLevel?.value || 'standard',
      profile: {
        level: this.selectLevel?.value || 'Senior',
        targetRole: this.inputRole?.value.trim() || 'Distributed Systems & Backend Architect',
        background: this.inputBackground?.value.trim() || ''
      }
    };

    await StorageService.saveSettings(updated);
    this.showToast(`Settings saved! Active model: ${this.activeProvider === 'gemini' ? updated.geminiModel : updated.openaiModel}`, 'success');
    this.close();

    if (this.onSettingsSaved) {
      this.onSettingsSaved(updated);
    }
  }
}
