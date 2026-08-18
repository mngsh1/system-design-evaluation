/**
 * Popup Launcher Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const noSessionView = document.getElementById('no-session-view');
  const activeSessionView = document.getElementById('active-session-view');
  const sessionProblemTitle = document.getElementById('session-problem-title');
  const sessionPhaseBadge = document.getElementById('session-phase-badge');
  const sessionTime = document.getElementById('session-time');
  const footerProvider = document.getElementById('footer-provider');
  const footerLevel = document.getElementById('footer-level');

  const btnStartNew = document.getElementById('btn-start-new');
  const btnResumeSession = document.getElementById('btn-resume-session');
  const btnDiscardSession = document.getElementById('btn-discard-session');
  const btnOpenSettings = document.getElementById('btn-open-settings');

  const phaseNames = {
    0: 'Catalog & Discovery',
    1: 'Phase 1: Problem & Scope',
    2: 'Phase 2: Requirements & Math',
    3: 'Phase 3: Architecture & Schemas',
    4: 'Phase 4: Deep Dives',
    5: 'Phase 5: Final Scorecard'
  };

  // Helper to open studio in tab
  async function openStudio(param = '') {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      await chrome.runtime.sendMessage({ type: 'OPEN_STUDIO', query: param });
      window.close();
    } else {
      window.open(`../app/index.html${param ? '?' + param : ''}`, '_blank');
    }
  }

  // Load storage state
  async function loadState() {
    let settings = {};
    let session = null;
    let history = [];

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get(['copilot_settings', 'copilot_active_session', 'copilot_history']);
      settings = data.copilot_settings || {};
      session = data.copilot_active_session || null;
      history = data.copilot_history || [];
    } else {
      // Fallback for direct browser preview
      try {
        settings = JSON.parse(localStorage.getItem('copilot_settings') || '{}');
        session = JSON.parse(localStorage.getItem('copilot_active_session') || 'null');
        history = JSON.parse(localStorage.getItem('copilot_history') || '[]');
      } catch (e) {}
    }

    // Update settings footer
    const isGemini = (settings.provider || 'gemini') === 'gemini';
    const rawModel = isGemini ? (settings.geminiModel || 'gemini-3.1-pro-preview') : (settings.openaiModel || 'gpt-5');
    const provider = `${isGemini ? 'Gemini' : 'OpenAI'}: ${rawModel}`;
    const level = settings.profile?.level || 'Senior';
    if (footerProvider) footerProvider.textContent = provider;
    if (footerLevel) footerLevel.textContent = level;

    // Check active session
    if (session && session.problem && session.phase) {
      noSessionView.classList.add('hidden');
      activeSessionView.classList.remove('hidden');

      sessionProblemTitle.textContent = session.problem.title || 'Untitled Problem';
      sessionPhaseBadge.textContent = phaseNames[session.phase] || `Phase ${session.phase}`;
      
      const elapsed = session.timers?.totalElapsedSeconds || 0;
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      sessionTime.textContent = `${mins}:${secs}`;
    } else {
      noSessionView.classList.remove('hidden');
      activeSessionView.classList.add('hidden');

      // Check last completed interview in history
      const lastSummaryBox = document.getElementById('last-interview-summary');
      const lastVerdict = document.getElementById('last-interview-verdict');
      const lastTitle = document.getElementById('last-interview-title');
      const lastMeta = document.getElementById('last-interview-meta');
      const noSessionDesc = document.getElementById('no-session-desc');

      if (history.length > 0 && lastSummaryBox) {
        const latest = history[0];
        const sc = latest.scorecard || {};
        const score = sc.overallScore || 85;
        const verdict = sc.overallVerdict || 'Hire';
        const durationMins = Math.round((latest.totalDurationSeconds || 1800) / 60);

        lastSummaryBox.classList.remove('hidden');
        if (lastTitle) lastTitle.textContent = latest.problemTitle || 'System Design';
        if (lastVerdict) {
          lastVerdict.textContent = verdict;
          lastVerdict.className = `badge ${score >= 88 ? 'badge-emerald' : (score >= 75 ? 'badge-cyan' : 'badge-amber')}`;
        }
        if (lastMeta) lastMeta.textContent = `Score: ${score}/100 • ${durationMins}m active • ${latest.level || 'Senior'}`;
        if (noSessionDesc) noSessionDesc.classList.add('hidden');
      }
    }
  }

  // Event Listeners
  btnStartNew?.addEventListener('click', () => openStudio('view=dashboard'));
  btnResumeSession?.addEventListener('click', () => openStudio('view=session'));
  btnOpenSettings?.addEventListener('click', () => openStudio('view=settings'));

  btnDiscardSession?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm('Discard current interview session?')) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove('copilot_active_session');
      } else {
        localStorage.removeItem('copilot_active_session');
      }
      loadState();
    }
  });

  await loadState();
});
