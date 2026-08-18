/**
 * StorageService - Typed asynchronous storage wrapper around chrome.storage.local
 * with fallback to window.localStorage for browser preview environments.
 */

const STORAGE_KEYS = {
  SETTINGS: 'copilot_settings',
  ACTIVE_SESSION: 'copilot_active_session',
  HISTORY: 'copilot_history',
  PROBLEM_LIBRARY: 'copilot_problem_library'
};

export const DEFAULT_SETTINGS = {
  provider: 'gemini', // 'gemini' | 'openai'
  geminiKey: '',
  geminiModel: 'gemini-3.1-pro-preview',
  openaiKey: '',
  openaiModel: 'gpt-5',
  critiqueLevel: 'standard', // 'constructive' | 'standard' | 'hardcore'
  profile: {
    level: 'Senior', // 'Mid', 'Senior', 'Staff', 'Principal'
    targetRole: 'Distributed Systems Architect',
    background: 'Backend & Cloud Infrastructure'
  }
};

const _memoryStore = {};

export class StorageService {
  /**
   * Check if running within a Chrome Extension context
   */
  static isExtension() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  /**
   * Helper to get item across chrome.storage, localStorage, or in-memory
   */
  static async _getItem(key) {
    if (this.isExtension()) {
      const data = await chrome.storage.local.get(key);
      return data[key];
    } else if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : undefined;
      } catch (e) {
        return undefined;
      }
    } else {
      return _memoryStore[key];
    }
  }

  /**
   * Helper to set item across chrome.storage, localStorage, or in-memory
   */
  static async _setItem(key, value) {
    if (this.isExtension()) {
      await chrome.storage.local.set({ [key]: value });
    } else if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {}
    } else {
      _memoryStore[key] = value;
    }
    return value;
  }

  /**
   * Helper to remove item
   */
  static async _removeItem(key) {
    if (this.isExtension()) {
      await chrome.storage.local.remove(key);
    } else if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    } else {
      delete _memoryStore[key];
    }
  }

  /**
   * Get Settings
   */
  static async getSettings() {
    const data = await this._getItem(STORAGE_KEYS.SETTINGS);
    const settings = { ...DEFAULT_SETTINGS, ...(data || {}) };
    if (settings.geminiModel === 'gemini-2.5-pro') {
      settings.geminiModel = 'gemini-3.1-pro-preview';
    }
    return settings;
  }

  /**
   * Save Settings
   */
  static async saveSettings(settings) {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    await this._setItem(STORAGE_KEYS.SETTINGS, merged);
    return merged;
  }

  /**
   * Get Stored Problem Library (Cached & Custom problems)
   */
  static async getProblemLibrary() {
    const data = await this._getItem(STORAGE_KEYS.PROBLEM_LIBRARY);
    return data || [];
  }

  /**
   * Save entire Problem Library
   */
  static async saveProblemLibrary(problems) {
    await this._setItem(STORAGE_KEYS.PROBLEM_LIBRARY, problems);
    return problems;
  }

  /**
   * Add or Append Problems to the Library (avoiding duplicates by id/title)
   */
  static async addProblemsToLibrary(newProblems) {
    const existing = await this.getProblemLibrary();
    const existingIds = new Set(existing.map(p => p.id || p.title));
    
    const additions = Array.isArray(newProblems) ? newProblems : [newProblems];
    for (const p of additions) {
      const key = p.id || p.title;
      if (!existingIds.has(key)) {
        existing.push(p);
        existingIds.add(key);
      }
    }
    return await this.saveProblemLibrary(existing);
  }

  /**
   * Delete a problem from the library
   */
  static async deleteProblemFromLibrary(problemId) {
    const existing = await this.getProblemLibrary();
    const filtered = existing.filter(p => p.id !== problemId && p.title !== problemId);
    return await this.saveProblemLibrary(filtered);
  }

  /**
   * Get Active Interview Session
   */
  static async getActiveSession() {
    const data = await this._getItem(STORAGE_KEYS.ACTIVE_SESSION);
    return data || null;
  }

  /**
   * Save Active Interview Session
   */
  static async saveActiveSession(session) {
    await this._setItem(STORAGE_KEYS.ACTIVE_SESSION, session);
    return session;
  }

  /**
   * Clear Active Interview Session
   */
  static async clearActiveSession() {
    await this._removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  }

  /**
   * Get Past Interview History
   */
  static async getHistory() {
    const data = await this._getItem(STORAGE_KEYS.HISTORY);
    return data || [];
  }

  /**
   * Append Completed Session to History
   */
  static async appendHistory(session) {
    const history = await this.getHistory();
    const entry = {
      ...session,
      id: session.id || Date.now().toString(),
      problem: session.problem,
      problemTitle: session.problem?.title || 'System Design Interview',
      level: session.profile?.level || 'Senior',
      completedAt: new Date().toISOString(),
      scorecard: session.evaluation?.scorecard || session.scorecard || null,
      totalDurationSeconds: session.timers?.totalElapsedSeconds || 0
    };
    history.unshift(entry);
    // Keep last 30 sessions
    const trimmed = history.slice(0, 30);
    await this._setItem(STORAGE_KEYS.HISTORY, trimmed);
    return trimmed;
  }
}

