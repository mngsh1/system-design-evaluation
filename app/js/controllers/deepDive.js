/**
 * DeepDiveController - Phase 5: Architectural Deep Dives
 * Dynamically generates 3 targeted technical questions based on HLD bottlenecks and evaluates candidate responses.
 */
import { StorageService } from '../services/storage.js';
import { LLMService } from '../services/llm.js';
import { PromptRegistry } from '../services/prompts.js';

export class DeepDiveController {
  constructor({ app, showToast }) {
    this.app = app;
    this.showToast = showToast;

    this.isGeneratingQuestions = false;
    this.isEvaluating = false;

    if (typeof document !== 'undefined') {
      // Header
      this.titleEl = document.getElementById('deepdive-problem-title');
      this.levelBadge = document.getElementById('deepdive-problem-level');
      this.categoryBadge = document.getElementById('deepdive-problem-category');

      // Containers
      this.questionsContainer = document.getElementById('deepdive-questions-container');
      this.loadingState = document.getElementById('deepdive-loading-questions');

      // Action buttons
      this.btnSubmit = document.getElementById('btn-submit-deepdive');
      this.btnNext = document.getElementById('btn-next-to-scorecard');
      this.evalCard = document.getElementById('deepdive-evaluation-card');
      this.evalContent = document.getElementById('deepdive-evaluation-content');

      this._initEvents();
    }
  }

  _initEvents() {
    this.btnSubmit?.addEventListener('click', () => this.handleEvaluate());
    this.btnNext?.addEventListener('click', () => this.handleNext());
  }

  _debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  async loadSession(session) {
    if (!session || !session.problem) return;

    const problem = session.problem;
    if (this.titleEl) this.titleEl.textContent = problem.title;
    if (this.levelBadge) this.levelBadge.textContent = problem.level || 'Senior';
    if (this.categoryBadge) this.categoryBadge.textContent = problem.category || 'Distributed';

    if (!session.deepDives) session.deepDives = { generatedQuestions: [], answers: {} };

    const questions = session.deepDives.generatedQuestions || [];
    if (questions.length === 0) {
      this.renderReadyState(session);
    } else {
      if (this.loadingState) this.loadingState.classList.add('hidden');
      if (this.questionsContainer) this.questionsContainer.classList.remove('hidden');
      this.renderQuestions(session);
    }

    if (session.deepDives.evaluation) {
      this.lockInputs();
      this.renderEvaluation(session.deepDives.evaluation);
    } else {
      this.unlockInputs();
      if (this.evalCard) this.evalCard.classList.add('hidden');
    }
  }

  renderReadyState(session) {
    if (!this.questionsContainer) return;
    if (this.loadingState) this.loadingState.classList.add('hidden');
    this.questionsContainer.classList.remove('hidden');

    this.questionsContainer.innerHTML = `
      <div class="card" style="padding: 36px 24px; text-align: center; background: rgba(99, 102, 241, 0.04); border: 1px dashed rgba(99, 102, 241, 0.3);">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: rgba(99, 102, 241, 0.12); border-radius: 50%; color: #6366F1; margin-bottom: 12px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>
        <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Ready for Architectural Deep Dives</h3>
        <p style="font-size: 13px; color: var(--text-secondary); max-width: 520px; margin: 0 auto 20px; line-height: 1.5;">
          The interviewer will generate 3 customized failure recovery, concurrency, and scaling challenges based on your architecture diagram and schemas.
        </p>
        <div style="display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap;">
          <button id="btn-start-deepdive-gen" class="btn btn-primary btn-lg">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <span>Generate Tailored Deep Dives</span>
          </button>
          <button id="btn-use-baseline-challenges" class="btn btn-secondary">
            <span>Use Standard Topic Challenges &rarr;</span>
          </button>
        </div>
      </div>
    `;

    if (typeof document !== 'undefined') {
      document.getElementById('btn-start-deepdive-gen')?.addEventListener('click', () => {
        this.generateQuestions(session);
      });
      document.getElementById('btn-use-baseline-challenges')?.addEventListener('click', () => {
        this._useFallbackQuestions();
      });
    }
  }

  async generateQuestions(sessionParam) {
    if (this.isGeneratingQuestions) return;
    const session = sessionParam || this.app?.activeSession;
    if (!session || !session.problem) return;
    if (!session.deepDives) session.deepDives = { generatedQuestions: [], answers: {} };

    this.isGeneratingQuestions = true;

    if (this.loadingState) this.loadingState.classList.remove('hidden');
    if (this.questionsContainer) this.questionsContainer.classList.add('hidden');

    try {
      const settings = this.app.settings || {};
      const provider = settings.provider || 'gemini';
      const apiKey = provider === 'gemini' ? settings.geminiKey : settings.openaiKey;
      const model = provider === 'gemini' ? settings.geminiModel : settings.openaiModel;

      if (!apiKey) {
        throw new Error("Please configure your API Key in Settings first.");
      }

      // Extract context from previous phases
      const hldEval = session.hld?.evaluation || {};
      const bottlenecks = hldEval.spofAndBottlenecks || [];
      const deepDiveOpps = hldEval.deepDiveOpportunities || [];
      const canvasShapes = (session.hld?.canvasData?.shapes || []).map(s => `${s.type}: ${s.text}`).join(', ');

      const systemPrompt = await PromptRegistry.getDeepDiveQuestionGenPrompt({
        problem: session.problem,
        level: session.profile?.level || 'Senior',
        canvasShapes,
        bottlenecks,
        opportunities: deepDiveOpps
      });

      const userPrompt = `PROBLEM: ${session.problem.title}
TARGET LEVEL: ${session.profile?.level || 'Senior'}

CANDIDATE'S DIAGRAM COMPONENTS:
${canvasShapes || 'API Gateway, Dispatch Workers, In-memory Redis Cache, Database Cluster'}

IDENTIFIED BOTTLENECKS & FOCUS TOPICS:
- Bottlenecks: ${bottlenecks.join('; ') || 'Peak traffic saturation, single primary DB write pressure'}
- Opportunities: ${deepDiveOpps.join('; ') || 'Partitioning strategy, distributed locks'}

Generate the 3 customized deep-dive questions.`;

      const response = await LLMService.complete({
        provider,
        apiKey,
        model,
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.4,
        jsonMode: true
      });

      const parsed = typeof response === 'object' ? response : JSON.parse(response);
      const generated = parsed.questions || [];

      if (generated.length === 0) throw new Error("No questions returned from LLM");

      session.deepDives.generatedQuestions = generated;
      await StorageService.saveActiveSession(session);

      this.renderQuestions(session);
    } catch (err) {
      console.error('Deep dive question generation error:', err);
      this.showToast(`Question generation error: ${err.message}`, 'error', 6000);
      this.renderQuestionGenError(err.message);
    } finally {
      this.isGeneratingQuestions = false;
    }
  }

  renderQuestionGenError(errorMessage) {
    if (this.loadingState) this.loadingState.classList.add('hidden');
    if (!this.questionsContainer) return;
    this.questionsContainer.classList.remove('hidden');

    this.questionsContainer.innerHTML = `
      <div class="card" style="padding: 32px 24px; text-align: center; background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.25);">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: rgba(239, 68, 68, 0.15); border-radius: 50%; color: #EF4444; margin-bottom: 12px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Failed to Generate Tailored Deep Dives</h3>
        <p style="font-size: 13px; color: var(--text-secondary); max-width: 520px; margin: 0 auto 20px; line-height: 1.5;">
          ${this._formatErrorMessage(errorMessage)}
        </p>
        <div style="display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap;">
          <button id="btn-retry-deepdive-qgen" class="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            <span>Retry Generating Questions</span>
          </button>
          <button id="btn-settings-deepdive-qgen" class="btn btn-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>Open Settings</span>
          </button>
          <button id="btn-fallback-deepdive-qgen" class="btn btn-ghost" style="color: var(--text-muted);">
            <span>Use Standard Topic Challenges &rarr;</span>
          </button>
        </div>
      </div>
    `;

    if (typeof document !== 'undefined') {
      document.getElementById('btn-retry-deepdive-qgen')?.addEventListener('click', () => {
        this.generateQuestions();
      });
      document.getElementById('btn-settings-deepdive-qgen')?.addEventListener('click', () => {
        this.app.settingsController?.open();
      });
      document.getElementById('btn-fallback-deepdive-qgen')?.addEventListener('click', () => {
        this._useFallbackQuestions();
      });
    }
  }

  _useFallbackQuestions() {
    const session = this.app.activeSession;
    if (!session) return;

    const fallbackQuestions = [
      {
        id: "q1",
        category: "Scaling & Bottlenecks",
        prompt: "During a sudden 10x regional spike in user requests, your ingestion worker queue and Redis cache experience massive load and potential memory exhaustion. How do you design backpressure, rate limiting, and shedding to preserve system uptime?",
        focusHint: "Focus on token-bucket throttling, queue auto-scaling, cache eviction policies, and graceful degradation."
      },
      {
        id: "q2",
        category: "Data Consistency & Concurrency",
        prompt: "In a distributed environment with concurrent workers, two distinct dispatch requests attempt to reserve the same stateful resource simultaneously. How do you implement distributed locking, atomic conditional writes, or optimistic locking to guarantee strict idempotency without introducing high lock contention?",
        focusHint: "Walk through Redlock / Redis SETNX with TTL, database conditional updates, or partitioned single-threaded state machine."
      },
      {
        id: "q3",
        category: "Fault Tolerance & Resilience",
        prompt: "If an entire primary Availability Zone experiences a catastrophic network partition or datacenter failure, describe your failover strategy, split-brain mitigation, and data reconciliation process once the partition heals.",
        focusHint: "Address Raft/Paxos quorum health checks, cross-region replication lag, and conflict resolution."
      }
    ];
    session.deepDives.generatedQuestions = fallbackQuestions;
    StorageService.saveActiveSession(session);
    this.renderQuestions(session);
  }

  renderQuestions(session) {
    if (!this.questionsContainer) return;

    if (this.loadingState) this.loadingState.classList.add('hidden');
    this.questionsContainer.classList.remove('hidden');

    const questions = session.deepDives?.generatedQuestions || [];
    const answers = session.deepDives?.answers || {};

    this.questionsContainer.innerHTML = questions.map((q, idx) => {
      const currentAns = answers[q.id] || '';
      return `
        <div class="card deepdive-question-card" data-question-id="${q.id}">
          <div class="deepdive-q-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-indigo">Challenge ${idx + 1}</span>
              <span class="badge badge-subtle">${q.category}</span>
            </div>
            <button type="button" class="btn btn-ghost btn-sm btn-insert-framework" data-target="${q.id}">
              + Add Trade-Off Framework
            </button>
          </div>

          <div class="deepdive-q-body">
            <h4 class="deepdive-q-prompt">${q.prompt}</h4>
            <p class="deepdive-q-hint">💡 <em>Interviewer Focus:</em> ${q.focusHint}</p>
          </div>

          <textarea id="deepdive-ans-${q.id}" class="form-textarea req-textarea deepdive-textarea" style="min-height: 150px;" placeholder="Explain your architectural approach, trade-offs, protocols, and failure handling here...">${currentAns}</textarea>
        </div>
      `;
    }).join('');

    // Attach autosave & framework listeners
    const debouncedSave = this._debounce(() => this.saveDraft(), 800);
    questions.forEach(q => {
      const textarea = document.getElementById(`deepdive-ans-${q.id}`);
      textarea?.addEventListener('input', debouncedSave);
    });

    this.questionsContainer.querySelectorAll('.btn-insert-framework').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = btn.dataset.target;
        const textarea = document.getElementById(`deepdive-ans-${qId}`);
        if (!textarea || textarea.readOnly) return;
        const template = `### Solution Architecture & Trade-Offs\n1. **Core Mechanism & Algorithms**:\n   - Describe the protocol, data structure, or algorithm (e.g. Distributed Lock with Leases / Consistent Hashing / Token Bucket).\n\n2. **Failure Modes & Edge Cases**:\n   - What happens on worker crash, network partition, or clock drift?\n\n3. **Trade-Off Analysis (CAP & Latency)**:\n   - Consistency vs Availability choices and p99 latency impact.`;
        if (textarea.value.trim().length > 0) {
          textarea.value += `\n\n${template}`;
        } else {
          textarea.value = template;
        }
        textarea.focus();
        this.saveDraft();
      });
    });
  }

  async saveDraft() {
    const session = this.app.activeSession;
    if (!session || !session.deepDives) return;

    const questions = session.deepDives.generatedQuestions || [];
    if (!session.deepDives.answers) session.deepDives.answers = {};

    questions.forEach(q => {
      const textarea = document.getElementById(`deepdive-ans-${q.id}`);
      if (textarea) {
        session.deepDives.answers[q.id] = textarea.value;
      }
    });

    await StorageService.saveActiveSession(session);
  }

  lockInputs() {
    const session = this.app.activeSession;
    const questions = session?.deepDives?.generatedQuestions || [];
    questions.forEach(q => {
      const textarea = document.getElementById(`deepdive-ans-${q.id}`);
      if (textarea) textarea.readOnly = true;
    });

    if (this.btnSubmit) {
      this.btnSubmit.disabled = true;
      this.btnSubmit.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Deep Dives Evaluated & Locked</span>
      `;
    }
  }

  unlockInputs() {
    const session = this.app.activeSession;
    const questions = session?.deepDives?.generatedQuestions || [];
    questions.forEach(q => {
      const textarea = document.getElementById(`deepdive-ans-${q.id}`);
      if (textarea) textarea.readOnly = false;
    });

    if (this.btnSubmit) {
      this.btnSubmit.disabled = false;
      this.btnSubmit.innerHTML = `
        <span>Submit Deep Dive Solutions for Evaluation</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      `;
    }
  }

  async handleEvaluate() {
    if (this.isEvaluating) return;
    const session = this.app.activeSession;
    if (!session || !session.deepDives) return;

    await this.saveDraft();
    const answers = session.deepDives.answers || {};
    const questions = session.deepDives.generatedQuestions || [];

    const answeredCount = questions.filter(q => (answers[q.id] || '').trim().length > 0).length;
    if (answeredCount === 0) {
      this.showToast('Please answer the deep dive questions before submitting.', 'error');
      return;
    }

    // 1. Pause global timer during evaluation
    this.app.pauseTimer();

    // 2. Lock inputs to read-only
    this.lockInputs();

    this.isEvaluating = true;
    if (this.evalCard) {
      this.evalCard.classList.remove('hidden');
      this.evalCard.scrollIntoView({ behavior: 'smooth' });
    }
    if (this.evalContent) {
      this.evalContent.innerHTML = `
        <div class="eval-loading-state">
          <div class="spinner" style="width: 28px; height: 28px;"></div>
          <div>
            <strong>Principal Interviewer is evaluating your Deep Dive trade-offs & failure handling...</strong>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Assessing distributed systems depth, resilience against cascade failures, and ${session.profile?.level || 'Senior'} level maturity (Timer paused).</p>
          </div>
        </div>
      `;
    }

    try {
      const settings = this.app.settings || {};
      const provider = settings.provider || 'gemini';
      const apiKey = provider === 'gemini' ? settings.geminiKey : settings.openaiKey;
      const model = provider === 'gemini' ? settings.geminiModel : settings.openaiModel;

      if (!apiKey) {
        throw new Error("Please configure your API Key in Settings first.");
      }

      const systemPrompt = await PromptRegistry.getDeepDiveEvaluationPrompt({
        problem: session.problem,
        level: session.profile?.level || 'Senior',
        critiqueLevel: settings.critiqueLevel || 'standard'
      });

      const userPrompt = `PROBLEM: ${session.problem.title}
LEVEL: ${session.profile?.level || 'Senior'}

QUESTIONS AND CANDIDATE'S ANSWERS:
${questions.map(q => `[${q.category}] ${q.prompt}\nCANDIDATE ANSWER:\n${answers[q.id] || '(No response provided)'}\n`).join('\n---\n')}

Provide your structured JSON evaluation.`;

      const response = await LLMService.complete({
        provider,
        apiKey,
        model,
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.2,
        jsonMode: true
      });

      const evaluation = typeof response === 'object' ? response : JSON.parse(response);

      // Save evaluation to session
      session.deepDives.evaluation = evaluation;
      session.deepDives.submittedAt = Date.now();
      await StorageService.saveActiveSession(session);

      this.renderEvaluation(evaluation);
      this.showToast('Deep Dives evaluation completed!', 'success');
    } catch (err) {
      console.error('Deep dive evaluation error:', err);
      this.showToast(`Deep dive evaluation error: ${err.message}`, 'error', 6000);

      // Unlock submit button
      if (this.btnSubmit) {
        this.btnSubmit.disabled = false;
        this.btnSubmit.innerHTML = `
          <span>Submit Deep Dive Solutions for Evaluation</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        `;
      }

      this.renderEvaluationError(err.message);
    } finally {
      this.isEvaluating = false;
    }
  }

  renderEvaluationError(errorMessage) {
    if (!this.evalContent) return;

    this.evalContent.innerHTML = `
      <div class="eval-error-state" style="padding: 24px 20px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 12px; text-align: center;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: rgba(239, 68, 68, 0.15); border-radius: 50%; color: #EF4444; margin-bottom: 12px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h4 style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Deep Dives Evaluator Temporarily Unavailable</h4>
        <p style="font-size: 13px; color: var(--text-secondary); max-width: 540px; margin: 0 auto 16px; line-height: 1.5;">
          ${this._formatErrorMessage(errorMessage)}
        </p>
        <div style="display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap;">
          <button id="btn-retry-eval-deepdive" class="btn btn-primary btn-sm" style="padding: 8px 18px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            <span>Retry Evaluation</span>
          </button>
          <button id="btn-settings-eval-deepdive" class="btn btn-secondary btn-sm" style="padding: 8px 16px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>Check API Key / Model in Settings</span>
          </button>
        </div>
      </div>
    `;

    if (typeof document !== 'undefined') {
      document.getElementById('btn-retry-eval-deepdive')?.addEventListener('click', () => {
        this.handleEvaluate();
      });
      document.getElementById('btn-settings-eval-deepdive')?.addEventListener('click', () => {
        this.app.settingsController?.open();
      });
    }

    const nextRow = this.evalCard?.querySelector?.('.eval-next-row');
    if (nextRow) nextRow.style.display = 'none';
  }

  _formatErrorMessage(rawError) {
    if (!rawError) return 'The AI evaluation service could not be reached. Please check your API key.';
    const err = rawError.toLowerCase();
    if (err.includes('api key') || err.includes('unauthorized') || err.includes('401') || err.includes('403')) {
      return `<strong>API Key Error:</strong> ${rawError}. Please verify your API key in Settings.`;
    }
    if (err.includes('rate limit') || err.includes('429') || err.includes('quota') || err.includes('resource_exhausted')) {
      return `<strong>Rate Limit / Quota Exceeded:</strong> ${rawError}. Please wait a moment or switch models in Settings.`;
    }
    if (err.includes('model') || err.includes('not found') || err.includes('format')) {
      return `<strong>Model Error:</strong> ${rawError}. Please verify model configuration in Settings.`;
    }
    return `<strong>Details:</strong> ${rawError}`;
  }

  renderEvaluation(evalData) {
    if (!this.evalContent || !evalData) return;

    const isPassed = evalData.status === 'Passed' || (evalData.overallScore >= 70);
    const statusBadge = isPassed
      ? `<span class="badge badge-emerald">Deep Dives: Approved (${evalData.overallScore || 85}/100)</span>`
      : `<span class="badge badge-amber">Deep Dives: Needs Revision (${evalData.overallScore || 65}/100)</span>`;

    const qScores = (evalData.questionScores || []).map((qs, i) => `
      <div class="eval-card-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <h4 style="margin: 0;">Challenge ${i + 1} Breakdown</h4>
          <span class="badge badge-cyan">${qs.score || 80}/100</span>
        </div>
        <p>${qs.critique || 'Solid answer.'}</p>
        ${(qs.unaddressedBlindSpots || []).length > 0 ? `<p style="font-size: 11px; color: var(--amber-400); margin-top: 4px;">⚠️ Blind Spot: ${qs.unaddressedBlindSpots.join(', ')}</p>` : ''}
      </div>
    `).join('');

    this.evalContent.innerHTML = `
      <div class="eval-header-row">
        <div style="display: flex; align-items: center; gap: 10px;">
          ${statusBadge}
          <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${evalData.verdict || ''}</span>
        </div>
      </div>

      <div class="eval-grid">
        ${qScores}
      </div>

      <div class="eval-footer-grid">
        <div class="eval-pill-box success-box">
          <strong style="color: var(--emerald-400);">Key Strengths:</strong>
          <ul>${(evalData.strengths || ['Sound distributed trade-offs']).map(s => `<li>✔ ${s}</li>`).join('')}</ul>
        </div>

        <div class="eval-pill-box notice-box">
          <strong style="color: var(--cyan-400);">Areas for Growth:</strong>
          <ul>${(evalData.areasForImprovement || ['Active-active multi-region failover']).map(a => `<li>💡 ${a}</li>`).join('')}</ul>
        </div>
      </div>
    `;

    if (this.evalCard) {
      this.evalCard.classList.remove('hidden');
    }
  }

  async handleNext() {
    const session = this.app.activeSession;
    if (!session) return;

    // Resume global timer for Phase 5
    this.app.resumeTimer();

    session.phase = 5;
    await StorageService.saveActiveSession(session);

    this.showToast('Proceeding to Phase 5: Final Review, Scorecard & Solutions', 'info');

    if (this.app.scorecardController) {
      this.app.scorecardController.loadSession(session);
    }

    this.app.navigateToPhase(5);
  }
}
