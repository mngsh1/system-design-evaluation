/**
 * DiscoveryController - Phase 1: Problem Discovery & Topic Selection
 */
import { StorageService } from '../services/storage.js';
import { ProblemEngine, CURATED_PROBLEMS } from '../services/problemEngine.js';

export class DiscoveryController {
  constructor({ app, showToast, openSettings }) {
    this.app = app;
    this.showToast = showToast;
    this.openSettings = openSettings;

    this.problems = [];
    this.history = [];
    this.selectedStatusFilter = 'ALL';
    this.selectedLevelFilter = 'ALL';
    this.selectedCategoryFilter = 'ALL';
    this.searchQuery = '';

    // DOM Elements
    this.gridContainer = document.getElementById('problem-cards-grid');
    this.btnGenerate10 = document.getElementById('btn-generate-problems');
    this.btnGenerateMore = document.getElementById('btn-generate-more');
    this.btnCreateCustom = document.getElementById('btn-open-custom-modal');
    this.filterChips = document.querySelectorAll('.filter-chip');
    this.searchInput = document.getElementById('problem-search-input');
    this.levelBanner = document.getElementById('discovery-level-banner');

    // Custom Modal Elements
    this.customModal = document.getElementById('custom-problem-modal');
    this.btnCloseCustom = document.getElementById('btn-close-custom-modal');
    this.btnSaveCustom = document.getElementById('btn-save-custom-problem');
    this.inputCustomTitle = document.getElementById('custom-prob-title');
    this.inputCustomDesc = document.getElementById('custom-prob-desc');
    this.inputCustomPrompt = document.getElementById('custom-prob-prompt');
    this.selectCustomLevel = document.getElementById('custom-prob-level');
    this.selectCustomCategory = document.getElementById('custom-prob-category');
    this.inputCustomScale = document.getElementById('custom-prob-scale');

    // Solved Problem Modal Elements
    this.solvedModal = document.getElementById('solved-problem-modal');
    this.btnCloseSolved = document.getElementById('btn-close-solved-modal');
    this.btnSolvedInspect = document.getElementById('btn-solved-inspect');
    this.btnSolvedRetake = document.getElementById('btn-solved-retake');
    this.solvedModalTitle = document.getElementById('solved-modal-title');
    this.solvedModalVerdict = document.getElementById('solved-modal-verdict');
    this.solvedModalDate = document.getElementById('solved-modal-date');
    this.currentSolvedTarget = null;

    this._initEvents();
  }

  async init() {
    await this.loadProblems();
    this.updateBanner();
  }

  _initEvents() {
    this.btnGenerate10?.addEventListener('click', () => this.generateAIProblems());
    this.btnGenerateMore?.addEventListener('click', () => this.generateAIProblems(true));
    this.btnCreateCustom?.addEventListener('click', () => this.openCustomModal());
    this.btnCloseCustom?.addEventListener('click', () => this.closeCustomModal());
    this.btnSaveCustom?.addEventListener('click', () => this.handleSaveCustomProblem());

    // Solved modal listeners
    this.btnCloseSolved?.addEventListener('click', () => this.closeSolvedModal());
    this.solvedModal?.addEventListener('click', (e) => {
      if (e.target === this.solvedModal) this.closeSolvedModal();
    });
    this.btnSolvedInspect?.addEventListener('click', () => this.handleInspectSolved());
    this.btnSolvedRetake?.addEventListener('click', () => this.handleRetakeSolved());

    // Search filter
    this.searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.render();
    });

    // Filter chips
    this.filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const filterType = chip.dataset.filterType;
        const filterValue = chip.dataset.filterValue;

        if (filterType === 'status') {
          this.selectedStatusFilter = filterValue;
          document.querySelectorAll('.filter-chip[data-filter-type="status"]').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        } else if (filterType === 'level') {
          this.selectedLevelFilter = filterValue;
          document.querySelectorAll('.filter-chip[data-filter-type="level"]').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        } else if (filterType === 'category') {
          this.selectedCategoryFilter = filterValue;
          document.querySelectorAll('.filter-chip[data-filter-type="category"]').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        }
        this.render();
      });
    });

    // Close modal on backdrop click
    this.customModal?.addEventListener('click', (e) => {
      if (e.target === this.customModal) this.closeCustomModal();
    });
  }

  updateBanner() {
    if (!this.levelBanner) return;
    const settings = this.app.settings || {};
    const level = settings.profile?.level || 'Senior';
    const role = settings.profile?.targetRole || 'Distributed Systems Architect';
    const provider = (settings.provider || 'gemini').toUpperCase();
    const model = settings.provider === 'openai' ? (settings.openaiModel || 'gpt-5') : (settings.geminiModel || 'gemini-3.1-pro-preview');

    const activeSession = this.app.activeSession;
    const hasActiveSession = Boolean(activeSession && activeSession.problem);

    const phaseNames = {
      1: 'Phase 1: Problem & Scope',
      2: 'Phase 2: Requirements & Math',
      3: 'Phase 3: Architecture & Schemas',
      4: 'Phase 4: Deep Dives',
      5: 'Phase 5: Scorecard'
    };

    let activeSessionBannerHtml = '';
    if (hasActiveSession) {
      const activeTitle = activeSession.problem?.title || 'System Design Interview';
      const activePhaseName = phaseNames[activeSession.phase] || `Phase ${activeSession.phase || 1}`;
      activeSessionBannerHtml = `
        <div class="active-session-quickbar" style="margin-top: 10px; padding: 10px 16px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="pulse-dot active-dot"></span>
            <span style="font-weight: 600; font-size: 13px; color: var(--text-primary);">Active Interview in Progress:</span>
            <span style="font-size: 13px; color: var(--color-cyan); font-weight: 500;">${activeTitle}</span>
            <span class="badge badge-indigo" style="font-size: 11px;">${activePhaseName}</span>
          </div>
          <button id="btn-quick-resume-session" class="btn btn-primary btn-sm">
            <span>Resume Interview &rarr;</span>
          </button>
        </div>
      `;
    }

    this.levelBanner.innerHTML = `
      <div class="banner-content">
        <div class="banner-left">
          <span class="badge badge-cyan">${level} Level</span>
          <span class="banner-role">${role}</span>
          <span class="banner-model">&bull; Powered by ${provider} (${model})</span>
        </div>
        <button id="btn-banner-edit-profile" class="btn btn-ghost btn-sm">Edit Profile &rarr;</button>
      </div>
      ${activeSessionBannerHtml}
    `;

    document.getElementById('btn-banner-edit-profile')?.addEventListener('click', () => this.openSettings());
    document.getElementById('btn-quick-resume-session')?.addEventListener('click', () => {
      this.app.navigateToPhase(activeSession.phase || 1);
    });
  }

  _formatTimeAgo(ts) {
    if (!ts) return 'Curated Standard';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / (60 * 1000));
    if (mins < 1) return '⚡ Generated just now';
    if (mins < 60) return `⚡ Generated ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `⚡ Generated ${hours}h ago`;
    return `⚡ Generated ${new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  }

  async loadProblems() {
    let stored = await StorageService.getProblemLibrary();
    if (!stored || stored.length === 0) {
      // Seed initial curated problems into storage
      stored = [...CURATED_PROBLEMS];
      await StorageService.saveProblemLibrary(stored);
    }
    this.problems = stored;
    this.history = await StorageService.getHistory();
    this.render();
  }

  openSolvedModal(problem, historyRecord) {
    this.currentSolvedTarget = { problem, historyRecord };
    if (this.solvedModalTitle) this.solvedModalTitle.textContent = problem.title;
    if (this.solvedModalVerdict) {
      const sc = historyRecord?.evaluation?.scorecard || historyRecord?.scorecard || {};
      const score = sc.overallScore || 85;
      const verdict = sc.overallVerdict || 'Hire';
      this.solvedModalVerdict.textContent = `${verdict} (${score}/100)`;
      this.solvedModalVerdict.className = `badge ${score >= 88 ? 'badge-emerald' : (score >= 75 ? 'badge-cyan' : 'badge-amber')}`;
    }
    if (this.solvedModalDate) {
      const ts = historyRecord?.completedAt || historyRecord?.timers?.startedAt || Date.now();
      this.solvedModalDate.textContent = `Completed on ${new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    }
    this.solvedModal?.classList.add('open');
  }

  closeSolvedModal() {
    this.solvedModal?.classList.remove('open');
    this.currentSolvedTarget = null;
  }

  async handleInspectSolved() {
    if (!this.currentSolvedTarget) return;
    const { historyRecord } = this.currentSolvedTarget;
    this.closeSolvedModal();

    // Load completed session into activeSession & go to Scorecard (Phase 6)
    this.app.activeSession = historyRecord;
    await StorageService.saveActiveSession(historyRecord);

    await this.app.clarificationController?.loadSession(historyRecord);
    await this.app.requirementsController?.loadSession(historyRecord);
    await this.app.hldController?.loadSession(historyRecord);
    await this.app.deepDiveController?.loadSession(historyRecord);
    await this.app.scorecardController?.loadSession(historyRecord);

    this.showToast('Opened completed interview in Read-Only Review mode.', 'info');
    this.app.navigateToPhase(5);
  }

  async handleRetakeSolved() {
    if (!this.currentSolvedTarget) return;
    const { problem } = this.currentSolvedTarget;
    this.closeSolvedModal();

    this.showToast(`Starting fresh interview for "${problem.title}"!`, 'info');
    this.startFreshSession(problem);
  }

  async generateAIProblems(appendMode = false) {
    const settings = this.app.settings || {};
    const provider = settings.provider || 'gemini';
    const apiKey = provider === 'gemini' ? settings.geminiKey : settings.openaiKey;
    const model = provider === 'gemini' ? settings.geminiModel : settings.openaiModel;

    if (!apiKey) {
      this.showToast('Please set your API Key in Settings first to generate AI problems.', 'error');
      this.openSettings();
      return;
    }

    const button = appendMode ? this.btnGenerateMore : this.btnGenerate10;
    const originalText = button ? button.innerHTML : '';
    if (button) {
      button.disabled = true;
      button.innerHTML = `
        <div class="spinner"></div>
        <span>Curating 10 ${settings.profile?.level || 'Senior'} Problems...</span>
      `;
    }

    try {
      this.showToast('Connecting to LLM to generate fresh system design problems...', 'info', 3000);
      const existingTitles = this.problems.map(p => p.title);
      const newProblems = await ProblemEngine.generateProblems({
        provider,
        apiKey,
        model,
        level: settings.profile?.level || 'Senior',
        role: settings.profile?.targetRole || 'Distributed Systems Architect',
        background: settings.profile?.background || '',
        count: 10,
        existingTitles
      });

      await StorageService.addProblemsToLibrary(newProblems);
      await this.loadProblems();
      this.showToast(`Successfully generated 10 new ${settings.profile?.level || 'Senior'} system design problems!`, 'success');
    } catch (err) {
      console.error('Problem generation error:', err);
      this.showToast(`Generation Failed: ${err.message}`, 'error', 6000);
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = originalText;
      }
    }
  }

  openCustomModal() {
    if (this.selectCustomLevel && this.app.settings?.profile?.level) {
      this.selectCustomLevel.value = this.app.settings.profile.level;
    }
    this.customModal?.classList.add('open');
  }

  closeCustomModal() {
    this.customModal?.classList.remove('open');
  }

  async handleSaveCustomProblem() {
    const title = this.inputCustomTitle?.value.trim();
    const shortDescription = this.inputCustomDesc?.value.trim();
    const vaguePrompt = this.inputCustomPrompt?.value.trim();
    const level = this.selectCustomLevel?.value || 'Senior';
    const category = this.selectCustomCategory?.value || 'Custom Design';
    const scale = this.inputCustomScale?.value.trim();

    if (!title) {
      this.showToast('Please provide a problem title.', 'error');
      return;
    }

    try {
      const customProblem = ProblemEngine.createCustomProblem({
        title,
        shortDescription,
        vaguePrompt,
        level,
        category,
        scaleMetrics: scale ? { dau: scale } : {}
      });

      await StorageService.addProblemsToLibrary([customProblem]);
      await this.loadProblems();
      this.closeCustomModal();
      this.showToast(`Custom problem "${title}" saved to your library!`, 'success');

      // Clear inputs
      if (this.inputCustomTitle) this.inputCustomTitle.value = '';
      if (this.inputCustomDesc) this.inputCustomDesc.value = '';
      if (this.inputCustomPrompt) this.inputCustomPrompt.value = '';
      if (this.inputCustomScale) this.inputCustomScale.value = '';
    } catch (err) {
      this.showToast(`Error saving custom problem: ${err.message}`, 'error');
    }
  }

  selectProblem(problem) {
    // Check if this problem was already solved
    const historyMatch = this.history.find(h => h.problem?.id === problem.id || (h.problem?.title && h.problem.title === problem.title) || h.problemTitle === problem.title);
    if (historyMatch) {
      this.openSolvedModal(problem, historyMatch);
    } else {
      this.startFreshSession(problem);
    }
  }

  startFreshSession(problem) {
    const newSession = {
      id: `session_${Date.now()}`,
      problem,
      phase: 2, // Move directly to Phase 2: Clarification
      profile: this.app.settings?.profile || { level: 'Senior' },
      timers: {
        startedAt: null,
        isRunning: false,
        totalElapsedSeconds: 0,
        phaseElapsed: {
          phase_1: 0,
          phase_2: 0,
          phase_3: 0,
          phase_4: 0,
          phase_5: 0
        }
      },
      clarificationMessages: [],
      requirements: {
        functional: '',
        nonFunctional: '',
        estimations: '',
        evaluation: null
      },
      hld: {
        apiAndSchema: '',
        canvasData: null,
        canvasImageBase64: null,
        evaluation: null
      },
      deepDives: {
        generatedQuestions: [],
        answers: {},
        evaluation: null
      },
      evaluation: null
    };

    StorageService.saveActiveSession(newSession);
    this.app.activeSession = newSession;
    this.showToast(`Starting interview for "${problem.title}"`, 'info');
    
    // If Phase 1 controller exists, initialize it
    if (this.app.clarificationController) {
      this.app.clarificationController.loadSession(newSession);
    }

    this.app.navigateToPhase(1);
  }

  render() {
    if (!this.gridContainer) return;

    // Filter problems
    const filtered = this.problems.filter(p => {
      const isSolved = this.history.some(h => h.problem?.id === p.id || (h.problem?.title && h.problem.title === p.title) || h.problemTitle === p.title);
      
      let matchStatus = true;
      if (this.selectedStatusFilter === 'RECENT') {
        matchStatus = Boolean(p.createdAt);
      } else if (this.selectedStatusFilter === 'SOLVED') {
        matchStatus = isSolved;
      }

      const matchLevel = this.selectedLevelFilter === 'ALL' || (p.level || '').toUpperCase() === this.selectedLevelFilter;
      const matchCategory = this.selectedCategoryFilter === 'ALL' || (p.category || '').toLowerCase().includes(this.selectedCategoryFilter.toLowerCase());
      const matchSearch = !this.searchQuery || 
        (p.title || '').toLowerCase().includes(this.searchQuery) ||
        (p.shortDescription || '').toLowerCase().includes(this.searchQuery) ||
        (p.keyFocus || []).some(k => k.toLowerCase().includes(this.searchQuery));

      return matchStatus && matchLevel && matchCategory && matchSearch;
    });

    // If recent sort is selected, order newest first
    if (this.selectedStatusFilter === 'RECENT') {
      filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    if (filtered.length === 0) {
      this.gridContainer.innerHTML = `
        <div class="empty-problems-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <h3>No matching problems found</h3>
          <p>Try clearing your search filters, or click below to generate new AI interview problems.</p>
          <button id="btn-empty-generate" class="btn btn-primary" style="margin-top: 12px;">
            ✨ Generate 10 AI Problems
          </button>
        </div>
      `;
      document.getElementById('btn-empty-generate')?.addEventListener('click', () => this.generateAIProblems());
      return;
    }

    this.gridContainer.innerHTML = filtered.map(p => {
      const levelClass = p.level === 'Principal' ? 'badge-purple' :
                         p.level === 'Staff' ? 'badge-indigo' :
                         p.level === 'Mid-Level' ? 'badge-emerald' : 'badge-cyan';

      const metricsHtml = Object.entries(p.scaleMetrics || {})
        .slice(0, 3)
        .map(([k, v]) => `<span class="metric-pill"><strong>${k.toUpperCase()}:</strong> ${v}</span>`)
        .join('');

      const tagsHtml = (p.keyFocus || [])
        .slice(0, 3)
        .map(tag => `<span class="tag-chip">${tag}</span>`)
        .join('');

      const customBadge = p.isCustom ? `<span class="badge badge-amber">CUSTOM</span>` : '';
      const timeBadge = `<span class="badge badge-subtle" style="font-size: 10px;">${this._formatTimeAgo(p.createdAt)}</span>`;

      // Check solved in history
      const historyMatch = this.history.find(h => h.problem?.id === p.id || (h.problem?.title && h.problem.title === p.title) || h.problemTitle === p.title);
      let solvedBadge = '';
      let btnLabel = 'Start Interview &rarr;';
      let btnClass = 'btn-card-start';

      if (historyMatch) {
        const sc = historyMatch.evaluation?.scorecard || historyMatch.scorecard || {};
        const score = sc.overallScore || 85;
        solvedBadge = `<span class="badge badge-emerald">✔ SOLVED (${score}/100)</span>`;
        btnLabel = 'Review / Retake &rarr;';
        btnClass = 'btn-card-start solved-start';
      }

      return `
        <div class="problem-card ${historyMatch ? 'problem-card-solved' : ''}" data-problem-id="${p.id}">
          <div class="problem-card-top">
            <div class="card-badges" style="flex-wrap: wrap; gap: 6px;">
              <span class="badge ${levelClass}">${p.level || 'Senior'}</span>
              <span class="badge badge-subtle">${p.category || 'Distributed'}</span>
              ${timeBadge}
              ${customBadge}
              ${solvedBadge}
            </div>
            <button class="${btnClass}" title="${historyMatch ? 'Review or Retake Interview' : 'Start System Design Interview'}">
              ${btnLabel}
            </button>
          </div>

          <h3 class="problem-card-title">${p.title}</h3>
          <p class="problem-card-desc">${p.shortDescription}</p>

          ${metricsHtml ? `<div class="metrics-row">${metricsHtml}</div>` : ''}

          <div class="problem-card-bottom">
            <div class="tags-row">${tagsHtml}</div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to cards
    this.gridContainer.querySelectorAll('.problem-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.problemId;
        const problem = this.problems.find(p => p.id === id);
        if (problem) {
          this.selectProblem(problem);
        }
      });
    });
  }
}
