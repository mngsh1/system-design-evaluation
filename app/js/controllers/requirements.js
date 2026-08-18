/**
 * RequirementsController - Phase 3: Requirements & Back-of-the-Envelope Estimations
 */
import { StorageService } from '../services/storage.js';
import { LLMService } from '../services/llm.js';
import { PromptRegistry } from '../services/prompts.js';

export class RequirementsController {
  constructor({ app, showToast }) {
    this.app = app;
    this.showToast = showToast;
    this.isEvaluating = false;

    if (typeof document !== 'undefined') {
      // Problem header elements
      this.titleEl = document.getElementById('req-problem-title');
      this.levelBadge = document.getElementById('req-problem-level');
      this.categoryBadge = document.getElementById('req-problem-category');

      // Inputs
      this.inputFunctional = document.getElementById('req-functional-input');
      this.inputNonFunctional = document.getElementById('req-nonfunctional-input');
      this.inputEstimations = document.getElementById('req-estimations-input');

      // Action buttons
      this.btnSubmit = document.getElementById('btn-submit-requirements');
      this.btnNext = document.getElementById('btn-next-to-hld');
      this.evalReviewCard = document.getElementById('req-evaluation-card');
      this.evalContent = document.getElementById('req-evaluation-content');

      // Template Inserters
      this.btnTemplateFunc = document.getElementById('btn-template-functional');
      this.btnTemplateNonFunc = document.getElementById('btn-template-nonfunctional');
      this.btnTemplateMath = document.getElementById('btn-template-estimations');

      this._initEvents();
    }
  }

  _initEvents() {
    this.btnSubmit?.addEventListener('click', () => this.handleEvaluate());
    this.btnNext?.addEventListener('click', () => this.handleNext());

    // Autosave on input
    const debouncedSave = this._debounce(() => this.saveDraft(), 800);
    this.inputFunctional?.addEventListener('input', debouncedSave);
    this.inputNonFunctional?.addEventListener('input', debouncedSave);
    this.inputEstimations?.addEventListener('input', debouncedSave);

    // Template inserter handlers
    this.btnTemplateFunc?.addEventListener('click', () => {
      this._insertTemplate(this.inputFunctional, `### Functional Requirements\n1. Users can [Primary Action] with [Key Parameters]\n2. System broadcasts [Event / Update] to [Target Receivers]\n3. API supports [Query / Fetch / Mutation] with pagination\n4. Handle [Edge Case / Failure Mode] gracefully`);
    });

    this.btnTemplateNonFunc?.addEventListener('click', () => {
      this._insertTemplate(this.inputNonFunctional, `### Non-Functional Requirements\n- **High Availability**: 99.99% uptime (fault domain isolation across multi-AZ)\n- **Low Latency**: p99 < 50ms read, p99 < 150ms write\n- **Consistency Model**: Eventual consistency for reads, Strong consistency for critical transactions (CAP Theorem)\n- **Scalability**: Horizontal auto-scaling under 10x traffic spikes\n- **Data Durability**: Zero data loss for stateful records`);
    });

    this.btnTemplateMath?.addEventListener('click', () => {
      this._insertTemplate(this.inputEstimations, `### Back-of-the-Envelope Calculations\n- **Traffic Estimation**:\n  - DAU: 50M users\n  - Avg requests/user/day: 20\n  - Total Requests/day: 50M * 20 = 1 Billion requests/day\n  - Average QPS: 1B / 86,400s ≈ 12,000 QPS\n  - Peak QPS (3x factor): 36,000 QPS\n\n- **Storage Estimation**:\n  - Payload size per record: 500 Bytes\n  - Storage/day: 1B requests * 500 B ≈ 500 GB / day\n  - Storage per 5 years: 500 GB * 365 * 5 ≈ 912.5 TB\n\n- **Bandwidth & Cache**:\n  - Read Ingress/Egress: 36,000 QPS * 500 B ≈ 18 MB/s\n  - 20% Cache Rule (80-20 rule): 20% of 500 GB ≈ 100 GB RAM cache needed`);
    });
  }

  _insertTemplate(inputEl, templateText) {
    if (!inputEl || inputEl.readOnly) return;
    if (inputEl.value.trim().length > 0) {
      inputEl.value += `\n\n${templateText}`;
    } else {
      inputEl.value = templateText;
    }
    inputEl.focus();
    this.saveDraft();
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

    // Populate draft text
    const req = session.requirements || {};
    if (this.inputFunctional) this.inputFunctional.value = req.functional || '';
    if (this.inputNonFunctional) this.inputNonFunctional.value = req.nonFunctional || '';
    if (this.inputEstimations) this.inputEstimations.value = req.estimations || '';

    // Check if already evaluated
    if (req.evaluation) {
      this.lockInputs();
      this.renderEvaluation(req.evaluation);
    } else {
      this.unlockInputs();
      if (this.evalReviewCard) this.evalReviewCard.classList.add('hidden');
    }
  }

  async saveDraft() {
    const session = this.app.activeSession;
    if (!session) return;

    if (!session.requirements) session.requirements = {};
    session.requirements.functional = this.inputFunctional?.value || '';
    session.requirements.nonFunctional = this.inputNonFunctional?.value || '';
    session.requirements.estimations = this.inputEstimations?.value || '';

    await StorageService.saveActiveSession(session);
  }

  lockInputs() {
    if (this.inputFunctional) this.inputFunctional.readOnly = true;
    if (this.inputNonFunctional) this.inputNonFunctional.readOnly = true;
    if (this.inputEstimations) this.inputEstimations.readOnly = true;

    if (this.btnSubmit) {
      this.btnSubmit.disabled = true;
      this.btnSubmit.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Requirements Evaluated & Locked</span>
      `;
    }
  }

  unlockInputs() {
    if (this.inputFunctional) this.inputFunctional.readOnly = false;
    if (this.inputNonFunctional) this.inputNonFunctional.readOnly = false;
    if (this.inputEstimations) this.inputEstimations.readOnly = false;

    if (this.btnSubmit) {
      this.btnSubmit.disabled = false;
      this.btnSubmit.innerHTML = `
        <span>Submit Requirements for Evaluation</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      `;
    }
  }

  async handleEvaluate() {
    if (this.isEvaluating) return;
    const session = this.app.activeSession;
    if (!session) return;

    const func = this.inputFunctional?.value.trim() || '';
    const nonFunc = this.inputNonFunctional?.value.trim() || '';
    const math = this.inputEstimations?.value.trim() || '';

    if (!func || !nonFunc) {
      this.showToast('Please provide both Functional and Non-Functional requirements before submitting.', 'error');
      return;
    }

    // 1. Pause global timer during evaluation & judgment
    this.app.pauseTimer();

    // 2. Lock inputs to read-only (Submission is locked)
    this.lockInputs();

    this.isEvaluating = true;
    if (this.evalReviewCard) {
      this.evalReviewCard.classList.remove('hidden');
      this.evalReviewCard.scrollIntoView({ behavior: 'smooth' });
    }
    if (this.evalContent) {
      this.evalContent.innerHTML = `
        <div class="eval-loading-state">
          <div class="spinner" style="width: 28px; height: 28px;"></div>
          <div>
            <strong>Interviewer is evaluating your requirements & calculations...</strong>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Analyzing completeness, scale math accuracy, and ${session.profile?.level || 'Senior'} level rigor (Timer paused).</p>
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

      const systemPrompt = await PromptRegistry.getRequirementsEvaluationPrompt({
        problem: session.problem,
        level: session.profile?.level || 'Senior',
        critiqueLevel: settings.critiqueLevel || 'standard'
      });

      const userPrompt = `PROBLEM: ${session.problem.title}
TARGET LEVEL: ${session.profile?.level || 'Senior'}
AGREED CLARIFICATIONS:
${(session.clarificationMessages || []).map(m => `${m.role}: ${m.content}`).join('\n')}

CANDIDATE SUBMISSION:
[1. Functional Requirements]:
${func}

[2. Non-Functional Requirements]:
${nonFunc}

[3. Back-of-the-Envelope Calculations]:
${math || '(No calculations provided)'}

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
      session.requirements.evaluation = evaluation;
      session.requirements.submittedAt = Date.now();
      await StorageService.saveActiveSession(session);

      this.renderEvaluation(evaluation);
      this.showToast('Requirements evaluation completed!', 'success');
    } catch (err) {
      console.error('Requirements evaluation error:', err);
      this.showToast(`Evaluation error: ${err.message}`, 'error', 6000);
      
      // Unlock inputs so candidate can revise or retry
      this.unlockInputs();

      // Render graceful error state with Retry & Settings buttons
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
        <h4 style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Evaluation Service Temporarily Unavailable</h4>
        <p style="font-size: 13px; color: var(--text-secondary); max-width: 540px; margin: 0 auto 16px; line-height: 1.5;">
          ${this._formatErrorMessage(errorMessage)}
        </p>
        <div style="display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap;">
          <button id="btn-retry-eval-req" class="btn btn-primary btn-sm" style="padding: 8px 18px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            <span>Retry Evaluation</span>
          </button>
          <button id="btn-settings-eval-req" class="btn btn-secondary btn-sm" style="padding: 8px 16px;">
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
      document.getElementById('btn-retry-eval-req')?.addEventListener('click', () => {
        this.handleEvaluate();
      });
      document.getElementById('btn-settings-eval-req')?.addEventListener('click', () => {
        this.app.settingsController?.open();
      });
    }

    const nextRow = this.evalReviewCard?.querySelector?.('.eval-next-row');
    if (nextRow) nextRow.style.display = 'none';
  }

  _formatErrorMessage(rawError) {
    if (!rawError) return 'The AI model could not be reached. Please verify your internet connection and API key.';
    const err = rawError.toLowerCase();
    if (err.includes('api key') || err.includes('unauthorized') || err.includes('401') || err.includes('403')) {
      return `<strong>API Key Error:</strong> ${rawError}. Please ensure your API key is valid in Settings.`;
    }
    if (err.includes('rate limit') || err.includes('429') || err.includes('quota') || err.includes('resource_exhausted')) {
      return `<strong>Rate Limit / Quota Exceeded:</strong> ${rawError}. Please wait a moment or switch models in Settings.`;
    }
    if (err.includes('model') || err.includes('not found') || err.includes('format')) {
      return `<strong>Model Error:</strong> ${rawError}. Please select a valid model in Settings.`;
    }
    return `<strong>Details:</strong> ${rawError}`;
  }

  renderEvaluation(evalData) {
    if (!this.evalContent || !evalData) return;

    const isPassed = evalData.status === 'Passed' || (evalData.score >= 70);
    const statusBadge = isPassed 
      ? `<span class="badge badge-emerald">Verdict: Passed (${evalData.score || 85}/100)</span>`
      : `<span class="badge badge-amber">Verdict: Needs Improvement (${evalData.score || 60}/100)</span>`;

    const strengthsList = (evalData.strengths || [])
      .map(s => `<li>✔ ${s}</li>`)
      .join('');

    const missingList = (evalData.missingConsiderations || [])
      .map(m => `<li>💡 ${m}</li>`)
      .join('');

    this.evalContent.innerHTML = `
      <div class="eval-header-row">
        <div style="display: flex; align-items: center; gap: 10px;">
          ${statusBadge}
          <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${evalData.verdict || ''}</span>
        </div>
      </div>

      <div class="eval-grid">
        <div class="eval-card-section">
          <h4>Functional Requirements Analysis</h4>
          <p>${evalData.functionalCritique || 'Well covered.'}</p>
        </div>

        <div class="eval-card-section">
          <h4>Non-Functional SLAs & CAP Rigor</h4>
          <p>${evalData.nonFunctionalCritique || 'Appropriate targets.'}</p>
        </div>

        <div class="eval-card-section">
          <h4>Back-of-the-Envelope Math Precision</h4>
          <p>${evalData.estimationsCritique || 'Valid math calculations.'}</p>
        </div>
      </div>

      <div class="eval-footer-grid">
        <div class="eval-pill-box success-box">
          <strong style="color: var(--emerald-400);">Key Strengths:</strong>
          <ul>${strengthsList || '<li>Clear requirements breakdown</li>'}</ul>
        </div>
        <div class="eval-pill-box notice-box">
          <strong style="color: var(--cyan-400);">Accommodate in Next Phase (HLD):</strong>
          <ul>${missingList || '<li>Ensure bottleneck isolation in architecture diagram</li>'}</ul>
        </div>
      </div>
    `;

    if (this.evalReviewCard) {
      this.evalReviewCard.classList.remove('hidden');
    }
  }

  async handleNext() {
    const session = this.app.activeSession;
    if (!session) return;

    // Resume global timer for Phase 3
    this.app.resumeTimer();

    session.phase = 3;
    await StorageService.saveActiveSession(session);

    this.showToast('Proceeding to Phase 3: High-Level Architecture & Schemas (HLD Canvas)', 'info');

    if (this.app.hldController) {
      this.app.hldController.loadSession(session);
    }

    this.app.navigateToPhase(3);
  }
}
