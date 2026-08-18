/**
 * FloatingAssistantController - Context-aware interactive assistant widget
 * Reads candidate's live typed text in the active phase to provide targeted coaching.
 */
import { LLMService } from '../services/llm.js';
import { PromptRegistry } from '../services/prompts.js';

export class FloatingAssistantController {
  constructor({ app, showToast }) {
    this.app = app;
    this.showToast = showToast;

    this.isOpen = false;
    this.isResponding = false;
    this.messages = [];

    if (typeof document !== 'undefined') {
      // DOM Elements
      this.widgetContainer = document.getElementById('floating-assistant-widget');
      this.btnToggle = document.getElementById('btn-toggle-assistant');
      this.btnMinimize = document.getElementById('btn-minimize-assistant');
      this.chatMessages = document.getElementById('assistant-chat-messages');
      this.chatInput = document.getElementById('assistant-chat-input');
      this.btnSend = document.getElementById('btn-send-assistant');
      this.typingIndicator = document.getElementById('assistant-typing-indicator');
      this.badgeDot = document.getElementById('assistant-unread-dot');

      this._initEvents();
    }
  }

  _initEvents() {
    this.btnToggle?.addEventListener('click', () => this.toggle());
    this.btnMinimize?.addEventListener('click', () => this.minimize());
    this.btnSend?.addEventListener('click', () => this.handleSendMessage());

    this.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });
  }

  toggle() {
    if (this.isOpen) {
      this.minimize();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.widgetContainer?.classList.add('open');
    this.badgeDot?.classList.add('hidden');
    this.chatInput?.focus();

    if (this.messages.length === 0) {
      this.renderGreeting();
    }
  }

  minimize() {
    this.isOpen = false;
    this.widgetContainer?.classList.remove('open');
  }

  renderGreeting() {
    const session = this.app.activeSession;
    const problemTitle = session?.problem?.title || 'System Design';
    const level = session?.profile?.level || 'Senior';

    const greeting = {
      role: 'assistant',
      content: `👋 Hi! I am your real-time **System Design Copilot**. I am continuously observing your typed requirements and calculations for **${problemTitle}** (${level} level).\n\nAsk me anything! For example:\n* *"Did I use the right formula for peak write QPS?"*\n* *"What are key availability risks for this system?"*\n* *"Is my storage retention estimate realistic?"*`
    };

    this.messages = [greeting];
    this.renderMessages();
  }

  renderMessages() {
    if (!this.chatMessages) return;

    this.chatMessages.innerHTML = this.messages.map(m => {
      const isAssistant = m.role === 'assistant';
      const roleClass = isAssistant ? 'assistant-msg' : 'user-msg';
      const avatarLabel = isAssistant ? 'AI' : 'YOU';
      const formatted = this._formatText(m.content);

      return `
        <div class="assistant-msg-row ${roleClass}">
          <div class="assistant-msg-avatar">${avatarLabel}</div>
          <div class="assistant-msg-bubble">${formatted}</div>
        </div>
      `;
    }).join('');

    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  _formatText(text) {
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/^\* (.*$)/gim, '<li>$1</li>');
    escaped = escaped.replace(/^- (.*$)/gim, '<li>$1</li>');
    escaped = escaped.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    escaped = escaped.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
    return escaped;
  }

  /**
   * Captures live typed context from whichever phase is active
   */
  captureActiveContext() {
    const session = this.app.activeSession || {};
    const problem = session.problem || {};
    const level = session.profile?.level || 'Senior';

    // Phase 3 Context: Read from session, fallback to live DOM input if available
    let functionalText = session.requirements?.functional || '';
    let nonFunctionalText = session.requirements?.nonFunctional || '';
    let mathText = session.requirements?.estimations || '';

    if (typeof document !== 'undefined') {
      const elFunc = document.getElementById('req-functional-input');
      const elNonFunc = document.getElementById('req-nonfunctional-input');
      const elMath = document.getElementById('req-estimations-input');

      if (elFunc && elFunc.value) functionalText = elFunc.value;
      if (elNonFunc && elNonFunc.value) nonFunctionalText = elNonFunc.value;
      if (elMath && elMath.value) mathText = elMath.value;
    }

    return {
      problemTitle: problem.title || 'Untitled',
      level,
      category: problem.category || 'Distributed Systems',
      clarifications: (session.clarificationMessages || []).map(m => `${m.role}: ${m.content}`).join('\n'),
      currentDraft: {
        functionalRequirements: functionalText,
        nonFunctionalRequirements: nonFunctionalText,
        estimations: mathText
      }
    };
  }

  async handleSendMessage() {
    if (this.isResponding) return;
    const text = this.chatInput?.value.trim();
    if (!text) return;

    const userMsg = { role: 'user', content: text };
    this.messages.push(userMsg);
    if (this.chatInput) this.chatInput.value = '';
    this.renderMessages();

    this.isResponding = true;
    if (this.typingIndicator) this.typingIndicator.classList.remove('hidden');
    if (this.btnSend) this.btnSend.disabled = true;

    try {
      const settings = this.app.settings || {};
      const provider = settings.provider || 'gemini';
      const apiKey = provider === 'gemini' ? settings.geminiKey : settings.openaiKey;
      const model = provider === 'gemini' ? settings.geminiModel : settings.openaiModel;

      if (!apiKey) {
        throw new Error("Please configure your API key in Settings first.");
      }

      // Capture active context
      const context = this.captureActiveContext();

      const systemPrompt = await PromptRegistry.getAssistantPrompt({
        problem: { title: context.problemTitle },
        level: context.level || 'Senior',
        phase: this.app.activeSession?.phase || 3
      });

      const promptMessages = this.messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      const reply = await LLMService.complete({
        provider,
        apiKey,
        model,
        systemPrompt,
        messages: promptMessages,
        temperature: 0.6
      });

      const assistantMsg = {
        role: 'assistant',
        content: (typeof reply === 'string' ? reply : JSON.stringify(reply)).trim()
      };

      this.messages.push(assistantMsg);
      this.renderMessages();
    } catch (err) {
      console.error('Assistant error:', err);
      this.showToast(`Assistant error: ${err.message}`, 'error');
      this.messages.push({
        role: 'assistant',
        content: `⚠️ Sorry, I could not connect to the model: ${err.message}. Please verify your API Key in Settings.`
      });
      this.renderMessages();
    } finally {
      this.isResponding = false;
      if (this.typingIndicator) this.typingIndicator.classList.add('hidden');
      if (this.btnSend) this.btnSend.disabled = false;
    }
  }
}
