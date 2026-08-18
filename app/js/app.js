/**
 * System Design Studio - Main Application Controller
 */
import { StorageService } from './services/storage.js';
import { LLMService } from './services/llm.js';
import { TemplateLoader } from './services/templateLoader.js';
import { SettingsController } from './controllers/settings.js';
import { DiscoveryController } from './controllers/discovery.js';
import { ClarificationController } from './controllers/clarification.js';
import { RequirementsController } from './controllers/requirements.js';
import { FloatingAssistantController } from './controllers/floatingAssistant.js';
import { HLDController } from './controllers/hld.js';
import { DeepDiveController } from './controllers/deepDive.js';
import { ScorecardController } from './controllers/scorecard.js';

class AppController {
  constructor() {
    this.currentPhase = 0; // 0 = Discovery / Catalog, 1-5 = Interview Phases
    this.settings = null;
    this.activeSession = null;
    this.timerInterval = null;

    // Controllers
    this.settingsController = null;
    this.discoveryController = null;
    this.clarificationController = null;
    this.requirementsController = null;
    this.floatingAssistant = null;
    this.hldController = null;
    this.deepDiveController = null;
    this.scorecardController = null;

    // Elements (bound after mounting modular views)
    this.headerLevelBadge = null;
    this.headerModelBadge = null;
    this.timerDisplay = null;
    this.timerWidget = null;
    this.btnSettings = null;
    this.btnHeaderCatalog = null;
    this.brandHomeLink = null;
    this.toastContainer = null;
    this.stepItems = [];
    this.stageViews = [];

    this.init();
  }

  async init() {
    // 0. Mount modular views from app/views/
    await TemplateLoader.mountAll();

    // Bind DOM elements after mounting
    this.headerLevelBadge = document.getElementById('header-level-badge');
    this.headerModelBadge = document.getElementById('header-model-badge');
    this.timerDisplay = document.getElementById('global-timer-display');
    this.timerWidget = document.getElementById('global-timer-widget');
    this.btnSettings = document.getElementById('btn-open-settings-modal');
    this.btnHeaderCatalog = document.getElementById('btn-header-catalog');
    this.brandHomeLink = document.getElementById('brand-home-link');
    this.toastContainer = document.getElementById('toast-container');
    this.stepItems = document.querySelectorAll('.step-item');
    this.stageViews = document.querySelectorAll('.stage-view');

    // 1. Initialize Toast System
    this.showToast = this.showToast.bind(this);

    // 2. Initialize Settings Controller & Header Navigation
    this.settingsController = new SettingsController({
      onSettingsSaved: (newSettings) => this.handleSettingsSaved(newSettings),
      showToast: this.showToast
    });

    this.btnSettings?.addEventListener('click', () => this.settingsController.open());
    this.btnHeaderCatalog?.addEventListener('click', (e) => {
      e.preventDefault();
      this.navigateToPhase(0);
    });
    this.brandHomeLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.navigateToPhase(0);
    });

    // 3. Load Settings and Session
    this.settings = await StorageService.getSettings();
    this.updateHeaderBadges();

    // 4. Initialize Discovery Controller (Problem Catalog)
    this.discoveryController = new DiscoveryController({
      app: this,
      showToast: this.showToast,
      openSettings: () => this.settingsController.open()
    });
    await this.discoveryController.init();

    // 5. Initialize Phase 1 Problem & Clarification Controller
    this.clarificationController = new ClarificationController({
      app: this,
      showToast: this.showToast
    });

    // 6. Initialize Phase 2 Requirements Controller
    this.requirementsController = new RequirementsController({
      app: this,
      showToast: this.showToast
    });

    // 7. Initialize Phase 3 HLD Controller
    this.hldController = new HLDController({
      app: this,
      showToast: this.showToast
    });

    // 8. Initialize Phase 4 Deep Dive Controller
    this.deepDiveController = new DeepDiveController({
      app: this,
      showToast: this.showToast
    });

    // 9. Initialize Phase 5 Scorecard Controller
    this.scorecardController = new ScorecardController({
      app: this,
      showToast: this.showToast
    });

    // 10. Initialize Floating Context-Aware Assistant
    this.floatingAssistant = new FloatingAssistantController({
      app: this,
      showToast: this.showToast
    });

    // Quick clarification drawer triggers from Phase 2, 3, 4 headers
    document.getElementById('btn-open-clarify-from-req')?.addEventListener('click', () => {
      this.clarificationController.openDrawer();
    });
    document.getElementById('btn-open-clarify-from-hld')?.addEventListener('click', () => {
      this.clarificationController.openDrawer();
    });
    document.getElementById('btn-open-clarify-from-deepdive')?.addEventListener('click', () => {
      this.clarificationController.openDrawer();
    });

    // Stepper click handlers for past completed phases (Read-Only reference)
    this._initStepperClicks();

    // Check if API key is configured; if not, open settings on first load
    const activeKey = this.settings.provider === 'gemini' ? this.settings.geminiKey : this.settings.openaiKey;
    if (!activeKey) {
      setTimeout(() => {
        this.settingsController.open();
        this.showToast('Please configure your Gemini or OpenAI API Key to begin.', 'info', 6000);
      }, 400);
    }

    // 11. Hydrate Active Session in background
    this.activeSession = await StorageService.getActiveSession();
    if (this.activeSession && this.activeSession.problem) {
      await this.clarificationController.loadSession(this.activeSession);
      await this.requirementsController.loadSession(this.activeSession);
      await this.hldController.loadSession(this.activeSession);
      await this.deepDiveController.loadSession(this.activeSession);
      if (this.activeSession.phase === 5) {
        await this.scorecardController.loadSession(this.activeSession);
      }

      if (this.activeSession.timers?.isRunning) {
        this.startGlobalTimer();
      } else {
        this.updateTimerDisplay(this.activeSession.timers?.totalElapsedSeconds || 0);
      }
    }

    // 12. Landing Phase: Preserve active interview phase on page refresh!
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === 'catalog' || !this.activeSession?.problem) {
      this.currentPhase = 0; // Show Catalog / Discovery when no active interview is running
    } else {
      this.currentPhase = this.activeSession.phase || 1; // Stay on active interview phase on refresh
    }

    this.navigateToPhase(this.currentPhase);
    this.discoveryController?.updateBanner();

    if (urlParams.get('view') === 'settings') {
      this.settingsController.open();
    }
  }

  _initStepperClicks() {
    this.stepItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetPhase = parseInt(item.dataset.phase, 10);
        const session = this.activeSession;
        const isCompleted = Boolean(session?.evaluation?.scorecard || session?.completedAt);
        const maxUnlockedPhase = isCompleted 
          ? 5 
          : Math.max(session?.maxPhase || 1, session?.phase || 1);

        if (session?.problem) {
          if (targetPhase <= maxUnlockedPhase) {
            this.navigateToPhase(targetPhase);
          } else {
            this.showToast(`Complete Phase ${maxUnlockedPhase} first to unlock Phase ${targetPhase}.`, 'info');
          }
        } else {
          this.showToast('Please select or generate a problem from the Catalog first.', 'info');
        }
      });
    });
  }

  _formatModelName(provider, rawModel) {
    if (!rawModel) return provider === 'openai' ? 'GPT-5' : 'Gemini 3.1 Pro';
    const m = rawModel.toLowerCase().trim();
    if (m === 'gemini-3.5-flash-lite') return 'Gemini 3.5 Flash';
    if (m === 'gemini-3.1-pro-preview') return 'Gemini 3.1 Pro';
    if (m === 'gemini-2.5-flash') return 'Gemini 2.5 Flash';
    if (m === 'gemini-2.5-flash-lite') return 'Gemini 2.5 Lite';
    if (m === 'gemini-1.5-pro') return 'Gemini 1.5 Pro';
    if (m === 'gpt-5') return 'GPT-5';
    if (m === 'gpt-4o') return 'GPT-4o';
    if (m === 'gpt-4o-mini') return 'GPT-4o Mini';
    if (m === 'o3-mini') return 'o3-mini';
    return rawModel;
  }

  updateHeaderBadges() {
    if (this.headerLevelBadge) {
      this.headerLevelBadge.textContent = this.settings.profile?.level || 'Senior';
    }
    if (this.headerModelBadge) {
      const provider = this.settings.provider || 'gemini';
      const rawModel = provider === 'gemini' 
        ? (this.settings.geminiModel || 'gemini-3.1-pro-preview')
        : (this.settings.openaiModel || 'gpt-5');
      
      const formatted = this._formatModelName(provider, rawModel);
      this.headerModelBadge.textContent = formatted;
      this.headerModelBadge.title = `Active LLM: ${provider.toUpperCase()} (${rawModel})`;
    }
  }

  handleSettingsSaved(newSettings) {
    this.settings = newSettings;
    this.updateHeaderBadges();
    this.discoveryController?.updateBanner();
  }

  // =========================================================================
  // Stepper & Phase Navigation
  // =========================================================================
  navigateToPhase(phaseNumber) {
    this.currentPhase = phaseNumber;
    const isCatalog = phaseNumber === 0;
    const session = this.activeSession;
    const hasProblem = Boolean(session?.problem);
    const isCompleted = Boolean(session?.evaluation?.scorecard || session?.completedAt);

    // Maintain maxUnlocked monotonically (never decrease when clicking on earlier tabs)
    if (session && phaseNumber > 0) {
      if (isCompleted) {
        session.maxPhase = 5;
      } else {
        session.maxPhase = Math.max(session.maxPhase || 1, session.phase || 1, phaseNumber);
        if (!session.phase || phaseNumber > session.phase) {
          session.phase = phaseNumber;
        }
      }
      session.currentViewPhase = phaseNumber;
      StorageService.saveActiveSession(session);
    }

    const maxUnlocked = isCompleted ? 5 : Math.max(session?.maxPhase || 1, session?.phase || 1);

    // Hide Stepper, Global Timer, AI Assistant and Clarification Drawer on Catalog page
    const headerStepper = document.getElementById('header-stepper') || document.querySelector('.header-stepper');
    const globalTimer = document.getElementById('global-timer-widget');
    const btnCatalog = document.getElementById('btn-header-catalog');
    const assistantWidget = document.getElementById('floating-assistant-widget');
    const clarifyDrawerBtn = document.getElementById('btn-toggle-clarify-drawer');
    const clarifyDrawerBackdrop = document.getElementById('clarify-drawer-backdrop');

    if (headerStepper) {
      headerStepper.style.display = isCatalog ? 'none' : 'flex';
    }
    if (globalTimer) {
      globalTimer.style.display = isCatalog ? 'none' : 'flex';
    }
    if (btnCatalog) {
      btnCatalog.classList.toggle('active', isCatalog);
      btnCatalog.style.borderColor = isCatalog ? 'var(--cyan-400)' : '';
    }
    if (assistantWidget) {
      assistantWidget.style.display = isCatalog ? 'none' : '';
    }
    if (clarifyDrawerBtn) {
      clarifyDrawerBtn.style.display = isCatalog ? 'none' : '';
    }
    if (isCatalog && clarifyDrawerBackdrop) {
      clarifyDrawerBackdrop.classList.remove('open');
    }

    // Update Step items in header & mark clickable
    this.stepItems.forEach(item => {
      const p = parseInt(item.dataset.phase, 10);
      item.classList.toggle('active', p === phaseNumber);
      item.classList.toggle('completed', p <= maxUnlocked && (p < phaseNumber || isCompleted));
      item.classList.toggle('clickable', hasProblem && p <= maxUnlocked);
    });

    // Update Stage Views (0 = discovery, 1 = problem, 2 = requirements, 3 = hld, 4 = deepdive, 5 = scorecard)
    this.stageViews.forEach(view => {
      const p = parseInt(view.dataset.phase, 10);
      view.classList.toggle('active', p === phaseNumber);
    });
  }

  // =========================================================================
  // Global Timer Management
  // =========================================================================
  startGlobalTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    if (!this.activeSession) {
      this.activeSession = {
        id: Date.now().toString(),
        phase: this.currentPhase,
        timers: {
          startedAt: Date.now(),
          isRunning: true,
          totalElapsedSeconds: 0,
          phaseElapsed: {}
        }
      };
    } else {
      if (!this.activeSession.timers) {
        this.activeSession.timers = {
          startedAt: Date.now(),
          isRunning: true,
          totalElapsedSeconds: 0,
          phaseElapsed: {}
        };
      }
      this.activeSession.timers.isRunning = true;
    }

    this.timerWidget?.classList.add('running');

    this.timerInterval = setInterval(() => {
      if (this.activeSession && this.activeSession.timers) {
        this.activeSession.timers.totalElapsedSeconds = (this.activeSession.timers.totalElapsedSeconds || 0) + 1;
        
        // Track per-phase elapsed
        const currentPhaseKey = `phase_${this.currentPhase}`;
        this.activeSession.timers.phaseElapsed[currentPhaseKey] = (this.activeSession.timers.phaseElapsed[currentPhaseKey] || 0) + 1;

        this.updateTimerDisplay(this.activeSession.timers.totalElapsedSeconds);

        // Periodic autosave every 5 seconds
        if (this.activeSession.timers.totalElapsedSeconds % 5 === 0) {
          StorageService.saveActiveSession(this.activeSession);
        }
      }
    }, 1000);
  }

  pauseTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timerWidget?.classList.remove('running');
    if (this.activeSession && this.activeSession.timers) {
      this.activeSession.timers.isRunning = false;
      StorageService.saveActiveSession(this.activeSession);
    }
  }

  resumeTimer() {
    if (!this.timerInterval) {
      this.startGlobalTimer();
    }
  }

  stopGlobalTimer() {
    this.pauseTimer();
  }

  updateTimerDisplay(totalSeconds) {
    if (!this.timerDisplay) return;
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    this.timerDisplay.textContent = `${mins}:${secs}`;
  }

  // =========================================================================
  // Toast Notification System
  // =========================================================================
  showToast(message, type = 'info', duration = 4000) {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
      ${iconSvg}
      <span>${message}</span>
    `;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// Global bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
