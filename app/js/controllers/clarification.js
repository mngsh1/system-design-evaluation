/**
 * ClarificationController - Phase 2: Problem Clarification & Scope Agreement
 */
import { StorageService } from '../services/storage.js';
import { LLMService } from '../services/llm.js';
import { PromptRegistry } from '../services/prompts.js';

export class ClarificationController {
  constructor({ app, showToast }) {
    this.app = app;
    this.showToast = showToast;

    if (typeof document !== 'undefined') {
      // DOM Elements
      this.problemTitleEl = document.getElementById('clarify-problem-title');
      this.problemDescEl = document.getElementById('clarify-problem-desc');
      this.problemLevelEl = document.getElementById('clarify-problem-level');
      this.problemCategoryEl = document.getElementById('clarify-problem-category');

      this.chatMessagesContainer = document.getElementById('clarify-chat-messages');
      this.chatInput = document.getElementById('clarify-chat-input');
      this.btnSend = document.getElementById('btn-send-clarify');
      this.btnBeginDesign = document.getElementById('btn-begin-design');
      this.chipsContainer = document.getElementById('clarify-chips-container');
      this.typingIndicator = document.getElementById('clarify-typing-indicator');

      // Drawer elements
      this.drawerBtn = document.getElementById('btn-toggle-clarify-drawer');
      this.drawerBackdrop = document.getElementById('clarify-drawer-backdrop');
      this.drawerClose = document.getElementById('btn-close-clarify-drawer');
      this.drawerMessages = document.getElementById('clarify-drawer-messages');
      this.drawerInput = document.getElementById('drawer-clarify-input');
      this.drawerBtnSend = document.getElementById('btn-drawer-clarify-send');
      this.drawerTyping = document.getElementById('drawer-typing-indicator');

      this._initEvents();
    }

    this.isResponding = false;
  }

  _initEvents() {
    this.btnSend?.addEventListener('click', () => this.handleSendMessage());
    this.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    this.btnBeginDesign?.addEventListener('click', () => this.handleBeginDesign());

    // Suggestion chips
    this.chipsContainer?.querySelectorAll('.clarify-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.dataset.promptText || chip.textContent;
        if (this.chatInput) {
          this.chatInput.value = text.trim();
          this.chatInput.focus();
        }
      });
    });

    // Drawer toggle & send
    this.drawerBtn?.addEventListener('click', () => this.openDrawer());
    this.drawerClose?.addEventListener('click', () => this.closeDrawer());
    this.drawerBackdrop?.addEventListener('click', (e) => {
      if (e.target === this.drawerBackdrop) this.closeDrawer();
    });

    this.drawerBtnSend?.addEventListener('click', () => this.handleDrawerSendMessage());
    this.drawerInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleDrawerSendMessage();
      }
    });
  }

  async loadSession(session) {
    if (!session || !session.problem) return;

    const problem = session.problem;
    if (this.problemTitleEl) this.problemTitleEl.textContent = problem.title;
    if (this.problemDescEl) this.problemDescEl.textContent = problem.vaguePrompt || problem.shortDescription;
    if (this.problemLevelEl) this.problemLevelEl.textContent = problem.level || 'Senior';
    if (this.problemCategoryEl) this.problemCategoryEl.textContent = problem.category || 'Distributed';

    // If no clarification messages exist yet, generate opening greeting
    if (!session.clarificationMessages || session.clarificationMessages.length === 0) {
      session.clarificationMessages = [
        {
          id: `msg_${Date.now()}`,
          role: 'interviewer',
          content: `Hello! Today we would like you to architect the **${problem.title}**.\n\n${problem.vaguePrompt || problem.shortDescription}\n\nPlease take a few moments to ask any clarifying questions regarding system scope, traffic volume, latency/availability SLAs, or specific edge constraints before you begin your formal design.`,
          timestamp: Date.now()
        }
      ];
      await StorageService.saveActiveSession(session);
      this.app.activeSession = session;
    }

    this.renderChatMessages();
  }

  renderChatMessages() {
    if (!this.chatMessagesContainer) return;
    const messages = this.app.activeSession?.clarificationMessages || [];

    this.chatMessagesContainer.innerHTML = messages.map(m => {
      const isInterviewer = m.role === 'interviewer';
      const avatarLabel = isInterviewer ? 'INT' : 'YOU';
      const roleClass = isInterviewer ? 'interviewer-msg' : 'candidate-msg';
      const formattedContent = this._formatMessageText(m.content);

      return `
        <div class="chat-message ${roleClass}">
          <div class="chat-avatar">${avatarLabel}</div>
          <div class="chat-bubble">
            <div class="chat-bubble-content">${formattedContent}</div>
          </div>
        </div>
      `;
    }).join('');

    // Scroll to bottom
    this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;

    // Also update drawer if open
    this.updateDrawerContent();
  }

  _formatMessageText(text) {
    // Simple markdown helper for bold, lists, and code
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Bold **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Bullet lists
    escaped = escaped.replace(/^\* (.*$)/gim, '<li>$1</li>');
    escaped = escaped.replace(/^- (.*$)/gim, '<li>$1</li>');
    // Wrap consecutive <li> into <ul>
    escaped = escaped.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    // Code ticks
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Line breaks
    escaped = escaped.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');

    return escaped;
  }

  async handleSendMessage() {
    if (this.isResponding) return;
    const text = this.chatInput?.value.trim();
    if (!text) return;

    const session = this.app.activeSession;
    if (!session) return;

    // Add candidate message
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'candidate',
      content: text,
      timestamp: Date.now()
    };

    session.clarificationMessages.push(userMsg);
    if (this.chatInput) this.chatInput.value = '';
    this.renderChatMessages();

    // Show typing indicator
    this.isResponding = true;
    if (this.typingIndicator) this.typingIndicator.classList.remove('hidden');
    if (this.btnSend) this.btnSend.disabled = true;

    try {
      const settings = this.app.settings || {};
      const provider = settings.provider || 'gemini';
      const apiKey = provider === 'gemini' ? settings.geminiKey : settings.openaiKey;
      const model = provider === 'gemini' ? settings.geminiModel : settings.openaiModel;

      if (!apiKey) {
        throw new Error("Please configure your API Key in Settings to chat with the interviewer.");
      }

      const systemPrompt = await PromptRegistry.getClarificationPrompt({
        problem: session.problem,
        level: session.profile?.level || 'Senior',
        critiqueLevel: settings.critiqueLevel || 'standard'
      });

      // Build conversation history for LLM
      const messages = session.clarificationMessages.map(m => ({
        role: m.role === 'interviewer' ? 'assistant' : 'user',
        content: m.content
      }));

      const reply = await LLMService.complete({
        provider,
        apiKey,
        model,
        systemPrompt,
        messages,
        temperature: 0.7
      });

      const interviewerMsg = {
        id: `msg_${Date.now()}`,
        role: 'interviewer',
        content: (typeof reply === 'string' ? reply : JSON.stringify(reply)).trim(),
        timestamp: Date.now()
      };

      session.clarificationMessages.push(interviewerMsg);
      await StorageService.saveActiveSession(session);
      this.renderChatMessages();
    } catch (err) {
      console.error('Clarification chat error:', err);
      this.showToast(`Interviewer connection error: ${err.message}`, 'error', 6000);
      
      // Push explicit error notice into chat
      session.clarificationMessages.push({
        id: `msg_err_${Date.now()}`,
        role: 'interviewer',
        isError: true,
        content: `⚠️ **Interviewer Connection Error:** ${err.message}.\n\nPlease check your API key / model in Settings.`,
        timestamp: Date.now()
      });
      await StorageService.saveActiveSession(session);
      this.renderChatMessages();
    } finally {
      this.isResponding = false;
      if (this.typingIndicator) this.typingIndicator.classList.add('hidden');
      if (this.btnSend) this.btnSend.disabled = false;
    }
  }

  async handleBeginDesign() {
    const session = this.app.activeSession;
    if (!session) return;

    // Start global timer if not started
    this.app.startGlobalTimer();

    // Save session
    session.phase = 2;
    await StorageService.saveActiveSession(session);

    this.showToast('Clarification context saved! Proceeding to Phase 2: Requirements & Math.', 'success');

    // If Phase 2 controller exists, initialize it
    if (this.app.requirementsController) {
      this.app.requirementsController.loadSession(session);
    }

    this.app.navigateToPhase(2);
  }

  // =========================================================================
  // Persistent Clarification Drawer
  // =========================================================================
  openDrawer() {
    this.updateDrawerContent();
    this.drawerBackdrop?.classList.add('open');
    if (this.drawerInput) {
      setTimeout(() => this.drawerInput.focus(), 150);
    }
  }

  closeDrawer() {
    this.drawerBackdrop?.classList.remove('open');
  }

  updateDrawerContent() {
    if (!this.drawerMessages) return;
    const messages = this.app.activeSession?.clarificationMessages || [];
    if (messages.length === 0) {
      this.drawerMessages.innerHTML = `<p style="color: var(--text-muted);">No clarification notes recorded yet.</p>`;
      return;
    }

    this.drawerMessages.innerHTML = messages.map(m => {
      const isInterviewer = m.role === 'interviewer';
      const roleLabel = isInterviewer ? 'Interviewer' : 'Candidate';
      const badgeClass = isInterviewer ? 'badge-cyan' : 'badge-indigo';
      const formatted = this._formatMessageText(m.content);

      return `
        <div class="drawer-msg-card">
          <div class="drawer-msg-header">
            <span class="badge ${badgeClass}">${roleLabel}</span>
            <span style="font-size: 11px; color: var(--text-subtle); font-family: var(--font-mono);">
              ${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div class="drawer-msg-body">${formatted}</div>
        </div>
      `;
    }).join('');

    this.drawerMessages.scrollTop = this.drawerMessages.scrollHeight;
  }

  async handleDrawerSendMessage() {
    if (this.isResponding) return;
    const text = this.drawerInput?.value.trim();
    if (!text) return;

    const session = this.app.activeSession;
    if (!session) return;

    // Add candidate message
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'candidate',
      content: text,
      timestamp: Date.now()
    };

    if (!session.clarificationMessages) session.clarificationMessages = [];
    session.clarificationMessages.push(userMsg);
    if (this.drawerInput) this.drawerInput.value = '';
    this.updateDrawerContent();
    this.renderChatMessages();

    // Show drawer typing indicator
    this.isResponding = true;
    if (this.drawerTyping) this.drawerTyping.classList.remove('hidden');
    if (this.drawerBtnSend) this.drawerBtnSend.disabled = true;

    try {
      const settings = this.app.settings || {};
      const provider = settings.provider || 'gemini';
      const apiKey = provider === 'gemini' ? settings.geminiKey : settings.openaiKey;
      const model = provider === 'gemini' ? settings.geminiModel : settings.openaiModel;

      if (!apiKey) {
        throw new Error("Please configure your API Key in Settings to ask the interviewer clarifying questions.");
      }

      const systemPrompt = await PromptRegistry.getClarificationPrompt({
        problem: session.problem,
        level: session.profile?.level || 'Senior',
        critiqueLevel: settings.critiqueLevel || 'standard'
      });

      // Build conversation history for LLM
      const messages = session.clarificationMessages.map(m => ({
        role: m.role === 'interviewer' ? 'assistant' : 'user',
        content: m.content
      }));

      const reply = await LLMService.complete({
        provider,
        apiKey,
        model,
        systemPrompt,
        messages,
        temperature: 0.7
      });

      const interviewerMsg = {
        id: `msg_${Date.now()}`,
        role: 'interviewer',
        content: (typeof reply === 'string' ? reply : JSON.stringify(reply)).trim(),
        timestamp: Date.now()
      };

      session.clarificationMessages.push(interviewerMsg);
      await StorageService.saveActiveSession(session);
      this.updateDrawerContent();
      this.renderChatMessages();
    } catch (err) {
      console.error('Drawer clarification chat error:', err);
      this.showToast(`Interviewer response error: ${err.message}`, 'error', 5000);

      session.clarificationMessages.push({
        id: `msg_${Date.now()}`,
        role: 'interviewer',
        content: `*Interviewer:* Let's assume standard Tier-1 distributed constraints for ${session.problem.title}: 99.99% availability, p99 < 100ms latency, and standard regional replication. Focus on your high-level component trade-offs.`,
        timestamp: Date.now()
      });
      await StorageService.saveActiveSession(session);
      this.updateDrawerContent();
      this.renderChatMessages();
    } finally {
      this.isResponding = false;
      if (this.drawerTyping) this.drawerTyping.classList.add('hidden');
      if (this.drawerBtnSend) this.drawerBtnSend.disabled = false;
    }
  }
}
