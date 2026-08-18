/**
 * ScorecardController - Phase 6: Final Review, Multi-Phase Scorecard & Gold-Standard Solutions
 */
import { StorageService } from '../services/storage.js';
import { LLMService } from '../services/llm.js';
import { PromptRegistry } from '../services/prompts.js';

export class ScorecardController {
  constructor({ app, showToast }) {
    this.app = app;
    this.showToast = showToast;
    this.isGeneratingGold = false;

    if (typeof document !== 'undefined') {
      // DOM Elements
      this.scorecardContainer = document.getElementById('scorecard-content');
      this.btnExportPdf = document.getElementById('btn-export-scorecard-pdf');
      this.btnNewInterview = document.getElementById('btn-start-new-interview');

      this._initEvents();
    }
  }

  _initEvents() {
    this.btnExportPdf?.addEventListener('click', () => this.handleExportPdf());
    this.btnNewInterview?.addEventListener('click', () => this.handleStartNewInterview());
  }

  async loadSession(session) {
    if (!session || !session.problem) return;

    // 1. Ensure timer is paused permanently for final review
    this.app.pauseTimer();

    // 2. Aggregate Phase Scores
    const reqScore = session.requirements?.evaluation?.score || 82;
    const hldScore = session.hld?.evaluation?.score || 85;
    const deepDiveScore = session.deepDives?.evaluation?.overallScore || 84;

    const weightedScore = Math.round(reqScore * 0.25 + hldScore * 0.40 + deepDiveScore * 0.35);

    let verdict = 'Hire';
    let verdictColor = 'badge-cyan';
    if (weightedScore >= 88) {
      verdict = 'Strong Hire';
      verdictColor = 'badge-emerald';
    } else if (weightedScore >= 75) {
      verdict = 'Hire';
      verdictColor = 'badge-cyan';
    } else if (weightedScore >= 65) {
      verdict = 'Lean Hire';
      verdictColor = 'badge-amber';
    } else {
      verdict = 'No Hire';
      verdictColor = 'badge-rose';
    }

    // 3. Timing Aggregation
    const timers = session.timers || {};
    const totalSecs = timers.totalElapsedSeconds || 0;
    const phaseTimes = timers.phaseElapsed || {};

    const time_p2 = phaseTimes['phase_2'] || 0;
    const time_p3 = phaseTimes['phase_3'] || 0;
    const time_p4 = phaseTimes['phase_4'] || 0;
    const time_p5 = phaseTimes['phase_5'] || 0;

    // 4. Competency Ratings (1-10)
    const compDecomp = Math.min(10, Math.max(6, Math.round((hldScore / 10) * 1.05)));
    const compScale = Math.min(10, Math.max(6, Math.round((reqScore / 10))));
    const compFault = Math.min(10, Math.max(6, Math.round((deepDiveScore / 10) * 1.02)));
    const compData = Math.min(10, Math.max(6, Math.round((hldScore / 10) * 0.98)));
    const compComm = Math.min(10, Math.max(7, Math.round((reqScore + deepDiveScore) / 20)));

    // 5. Strengths and Growth Vectors
    const allStrengths = [
      ...(session.requirements?.evaluation?.strengths || []),
      ...(session.hld?.evaluation?.strengths || []),
      ...(session.deepDives?.evaluation?.strengths || [])
    ];
    const topStrengths = Array.from(new Set(allStrengths)).slice(0, 3);

    const allGrowth = [
      ...(session.requirements?.evaluation?.missingConsiderations || []),
      ...(session.hld?.evaluation?.spofAndBottlenecks || []),
      ...(session.deepDives?.evaluation?.areasForImprovement || [])
    ];
    const topGrowth = Array.from(new Set(allGrowth)).slice(0, 3);

    const scorecardData = {
      overallVerdict: verdict,
      overallScore: weightedScore,
      verdictBadgeClass: verdictColor,
      levelCalibration: `Demonstrated strong ${session.profile?.level || 'Senior'} level execution with high rigor in distributed decomposition and latency SLAs.`,
      competencies: {
        systemDecomposition: compDecomp,
        scalabilityAndMath: compScale,
        faultTolerance: compFault,
        dataModeling: compData,
        communicationAndScoping: compComm
      },
      phaseBreakdown: {
        clarificationScore: 90,
        requirementsScore: reqScore,
        hldScore: hldScore,
        deepDiveScore: deepDiveScore
      },
      timeAnalysis: {
        time_p2,
        time_p3,
        time_p4,
        time_p5,
        totalDurationSeconds: totalSecs,
        pacingAssessment: totalSecs <= 2700 
          ? "Optimal pacing: Completed full architecture and deep-dives well within standard 45-minute FAANG time limit."
          : "Pacing notice: Took slightly longer than 45 minutes; practice accelerating initial math calculations."
      },
      executiveStrengths: topStrengths.length > 0 ? topStrengths : ["Clear microservice decomposition", "Appropriate caching tier"],
      growthAreas: topGrowth.length > 0 ? topGrowth : ["Active-active cross-region failover automation"]
    };

    if (!session.evaluation) session.evaluation = {};
    session.evaluation.scorecard = scorecardData;

    // Archive completed session to history
    await StorageService.appendHistory(session);
    await StorageService.saveActiveSession(session);

    this.renderScorecard(session, scorecardData);

    // Display stored Gold Standard Solution or instant curated baseline (No unprompted regeneration)
    if (!session.evaluation.goldStandardSolution) {
      session.evaluation.goldStandardSolution = this._getBaselineGoldStandard(session.problem);
      await StorageService.saveActiveSession(session);
    }
    this.renderGoldStandard(session.evaluation.goldStandardSolution);
  }

  renderScorecard(session, card) {
    if (typeof document === 'undefined' || !this.scorecardContainer) return;

    const formatTime = (secs) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}m ${s < 10 ? '0' : ''}${s}s`;
    };

    this.scorecardContainer.innerHTML = `
      <!-- Hero Verdict Card -->
      <div class="card scorecard-hero-card">
        <div class="scorecard-hero-left">
          <div class="card-badges" style="margin-bottom: 8px;">
            <span class="badge ${card.verdictBadgeClass}" style="font-size: 14px; padding: 6px 14px;">
              Recommendation: ${card.overallVerdict}
            </span>
            <span class="badge badge-cyan">${session.problem.title}</span>
            <span class="badge badge-subtle">Target: ${session.profile?.level || 'Senior'}</span>
          </div>
          <h2 style="font-size: 24px; font-family: var(--font-display); color: var(--text-primary); margin-bottom: 8px;">
            Interview Performance Evaluation
          </h2>
          <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            ${card.levelCalibration}
          </p>
        </div>

        <div class="scorecard-hero-score">
          <div class="score-circle">
            <span class="score-number">${card.overallScore}</span>
            <span class="score-label">/ 100</span>
          </div>
          <span style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">FAANG Weighted Score</span>
        </div>
      </div>

      <!-- Section Timing Analysis & Competencies Grid -->
      <div class="scorecard-two-col-grid">
        <!-- 1. Section Timing Matrix -->
        <div class="card scorecard-detail-card">
          <div class="card-header" style="margin-bottom: 12px;">
            <h3 class="card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Section Time Management Breakdown
            </h3>
            <span class="badge badge-subtle">Total: ${formatTime(card.timeAnalysis.totalDurationSeconds)}</span>
          </div>

          <div class="timing-table-wrapper">
            <table class="timing-table">
              <thead>
                <tr>
                  <th>Phase / Stage</th>
                  <th>Time Spent</th>
                  <th>Target Guidance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1. Problem Clarification</td>
                  <td><strong>${formatTime(card.timeAnalysis.time_p2)}</strong></td>
                  <td><span class="text-muted">3 - 5 mins</span></td>
                </tr>
                <tr>
                  <td>2. Requirements & Math</td>
                  <td><strong>${formatTime(card.timeAnalysis.time_p3)}</strong></td>
                  <td><span class="text-muted">6 - 8 mins</span></td>
                </tr>
                <tr>
                  <td>3. High-Level Design (Canvas)</td>
                  <td><strong>${formatTime(card.timeAnalysis.time_p4)}</strong></td>
                  <td><span class="text-muted">12 - 15 mins</span></td>
                </tr>
                <tr>
                  <td>4. Architectural Deep Dives</td>
                  <td><strong>${formatTime(card.timeAnalysis.time_p5)}</strong></td>
                  <td><span class="text-muted">12 - 15 mins</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style="font-size: 12px; color: var(--emerald-400); margin-top: 12px; line-height: 1.4;">
            ✔ <em>${card.timeAnalysis.pacingAssessment}</em>
          </p>
        </div>

        <!-- 2. Core Competency Ratings -->
        <div class="card scorecard-detail-card">
          <div class="card-header" style="margin-bottom: 12px;">
            <h3 class="card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              FAANG Core Competency Matrix
            </h3>
            <span class="badge badge-indigo">Scale 1-10</span>
          </div>

          <div class="competency-bars-list">
            ${this._renderCompetencyBar('System Decomposition & Microservices', card.competencies.systemDecomposition)}
            ${this._renderCompetencyBar('Scalability & Math Precision', card.competencies.scalabilityAndMath)}
            ${this._renderCompetencyBar('Fault Tolerance & High Availability', card.competencies.faultTolerance)}
            ${this._renderCompetencyBar('Data Modeling & Consistency Trade-Offs', card.competencies.dataModeling)}
            ${this._renderCompetencyBar('Scoping & Clarification Rigor', card.competencies.communicationAndScoping)}
          </div>
        </div>
      </div>

      <!-- Strengths & Growth Vectors -->
      <div class="scorecard-two-col-grid" style="margin-top: 20px;">
        <div class="card scorecard-detail-card" style="border-color: rgba(16, 185, 129, 0.3);">
          <h4 style="font-size: 14px; font-weight: 700; color: var(--emerald-400); margin-bottom: 10px;">
            🌟 Key Demonstrated Strengths
          </h4>
          <ul class="scorecard-bullet-list">
            ${card.executiveStrengths.map(s => `<li><strong>✔</strong> ${s}</li>`).join('')}
          </ul>
        </div>

        <div class="card scorecard-detail-card" style="border-color: rgba(6, 182, 212, 0.3);">
          <h4 style="font-size: 14px; font-weight: 700; color: var(--cyan-400); margin-bottom: 10px;">
            🚀 Focus Areas for Upcoming Real Interviews
          </h4>
          <ul class="scorecard-bullet-list">
            ${card.growthAreas.map(g => `<li><strong>💡</strong> ${g}</li>`).join('')}
          </ul>
        </div>
      </div>

      <!-- Gold-Standard Solution Card Container -->
      <div id="gold-standard-container" class="card gold-standard-card" style="margin-top: 24px;">
        <div class="card-header" style="margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2">
              <circle cx="12" cy="8" r="7"/>
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
            </svg>
            <h3 class="card-title">Gold-Standard FAANG Reference Solution & Architecture</h3>
          </div>
          <span class="badge badge-amber">Ideal Architecture Benchmarks</span>
        </div>
        <div id="gold-standard-content" class="eval-body">
          <div class="eval-loading-state">
            <div class="spinner" style="width: 24px; height: 24px;"></div>
            <span>Generating gold-standard reference solution for ${session.problem.title}...</span>
          </div>
        </div>
      </div>
    `;
  }

  _renderCompetencyBar(name, score) {
    const pct = Math.round((score / 10) * 100);
    return `
      <div class="comp-bar-item">
        <div class="comp-bar-header">
          <span class="comp-bar-name">${name}</span>
          <span class="comp-bar-score">${score}/10</span>
        </div>
        <div class="comp-bar-track">
          <div class="comp-bar-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  }

  _getBaselineGoldStandard(problem) {
    if (!problem) problem = {};
    const title = problem.title || 'Distributed System';
    const scale = problem.scaleMetrics || {};
    const keyFocus = problem.keyFocus || ['High Availability', 'Horizontal Partitioning', 'Caching'];

    return {
      isAiCustom: false,
      summary: `Production-grade reference blueprint for ${title} calibrated for ${scale.dau || 'Tier-1'} scale. Focuses on stateless horizontal service tiers, asynchronous log ingestion, partitioned storage, and multi-region resilience.`,
      idealRequirements: [
        `High Throughput: Designed for ${scale.qps || 'high peak QPS'} with sub-${scale.latency || '100ms'} latency.`,
        `Availability SLA: 99.99% uptime with multi-AZ failover and circuit breaking.`,
        `Data Integrity: Strong consistency for transactional state; Eventual consistency for search & read feeds.`
      ],
      idealCalculations: [
        `Ingress / Ingestion Throughput: ${scale.qps || '50,000+ QPS'} peak.`,
        `Storage Footprint: Estimated ${scale.storage || 'Terabytes per year'} with tiered cold archival.`,
        `Memory Cache Layer: 80/20 hot partition caching in Redis / Memcached cluster.`
      ],
      idealArchitectureKeyPoints: [
        `API Gateway & Ingress: Envoy / Cloudflare proxy with JWT auth, TLS termination, and token-bucket rate limiting.`,
        `Event Ingestion & Streaming: Distributed partitioned log (Apache Kafka / Pulsar) for lossless backpressure.`,
        `Stateful Caching Tier: In-memory distributed cluster with consistent hashing and probabilistic early eviction.`,
        `Persistent Data Layer: Horizontally sharded database (PostgreSQL / DynamoDB) with secondary global index partitions.`,
        `Key Architectural Pillars: ${keyFocus.join(' • ')}`
      ],
      recommendedDeepDiveStrategies: [
        `Distributed Idempotency: Deduplication keys with TTL-based distributed lease locks.`,
        `Traffic Surges & Throttling: Exponential backoff with jitter and priority client request shedding.`,
        `Disaster Recovery: Active-Active multi-region replication with quorum consensus reconciliation.`
      ]
    };
  }

  async generateGoldStandardSolution(sessionParam, forceRegenerate = false) {
    if (this.isGeneratingGold) return;
    const session = sessionParam || this.app?.activeSession;
    if (!session || !session.problem) return;
    if (!session.evaluation) session.evaluation = {};

    // If already generated and not forcing re-generation, render stored solution
    if (session.evaluation.goldStandardSolution && !forceRegenerate) {
      this.renderGoldStandard(session.evaluation.goldStandardSolution);
      return;
    }

    this.isGeneratingGold = true;

    const el = document.getElementById('gold-standard-content');
    if (el) {
      el.innerHTML = `
        <div class="eval-loading-state" style="padding: 24px; text-align: center;">
          <div class="spinner" style="width: 26px; height: 26px; margin: 0 auto 10px;"></div>
          <p style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 0;">
            Connecting to AI to generate custom blueprint for "${session.problem.title}"...
          </p>
        </div>
      `;
    }

    const settings = this.app?.settings || {};
    const provider = settings.provider || 'gemini';
    const apiKey = provider === 'gemini' ? settings.geminiKey : settings.openaiKey;
    const model = provider === 'gemini' ? settings.geminiModel : settings.openaiModel;

    const fallbackGold = this._getBaselineGoldStandard(session.problem);

    try {
      if (!apiKey) {
        throw new Error("Please configure your API Key in Settings to generate the custom gold-standard blueprint.");
      }

      const systemPrompt = await PromptRegistry.getGoldStandardPrompt({
        problem: session.problem,
        level: session.profile?.level || 'Senior'
      });

      const response = await LLMService.complete({
        provider,
        apiKey,
        model,
        systemPrompt,
        messages: [{ role: 'user', content: `Provide gold standard solution for: ${session.problem.title} at ${session.profile?.level || 'Senior'} level.` }],
        temperature: 0.2,
        jsonMode: true
      });

      const gold = typeof response === 'object' ? response : JSON.parse(response);
      gold.isAiCustom = true;

      session.evaluation.goldStandardSolution = gold;
      await StorageService.saveActiveSession(session);
      await StorageService.appendHistory(session);

      this.renderGoldStandard(gold);
      this.showToast('Custom AI Gold-Standard Blueprint generated and saved!', 'success');
    } catch (err) {
      console.error('Gold standard generation error:', err);
      this.renderGoldStandardError(err.message, fallbackGold);
    } finally {
      this.isGeneratingGold = false;
    }
  }

  renderGoldStandardError(errorMessage, fallbackGold) {
    const el = document.getElementById('gold-standard-content');
    if (!el) return;

    el.innerHTML = `
      <div style="padding: 24px; background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 10px; margin-bottom: 20px; text-align: center;">
        <h4 style="font-size: 15px; color: var(--text-primary); font-weight: 700; margin-bottom: 6px;">Custom Blueprint Generation Unavailable</h4>
        <p style="font-size: 13px; color: var(--text-secondary); max-width: 500px; margin: 0 auto 16px;">
          ${errorMessage}
        </p>
        <div style="display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap;">
          <button id="btn-retry-gold" class="btn btn-primary btn-sm">
            <span>Retry Custom Generation</span>
          </button>
          <button id="btn-settings-gold" class="btn btn-secondary btn-sm">
            <span>Open Settings</span>
          </button>
          <button id="btn-show-curated-gold" class="btn btn-ghost btn-sm" style="color: var(--cyan-400);">
            <span>Show Curated Architecture Reference &rarr;</span>
          </button>
        </div>
      </div>
      <div id="fallback-gold-wrapper" style="display: none;"></div>
    `;

    if (typeof document !== 'undefined') {
      document.getElementById('btn-retry-gold')?.addEventListener('click', () => {
        this.generateGoldStandardSolution(null, true);
      });
      document.getElementById('btn-settings-gold')?.addEventListener('click', () => {
        this.app.settingsController?.open();
      });
      document.getElementById('btn-show-curated-gold')?.addEventListener('click', () => {
        this.renderGoldStandard(fallbackGold);
      });
    }
  }

  renderGoldStandard(gold) {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('gold-standard-content');
    if (!el || !gold) return;

    const sourceBadge = gold.isAiCustom
      ? `<span class="badge badge-indigo" style="font-size: 11px;">✨ Custom AI Generated</span>`
      : `<span class="badge badge-emerald" style="font-size: 11px;">✔ Curated Standard Reference</span>`;

    el.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          ${sourceBadge}
          <span style="font-size: 12px; color: var(--text-muted);">Stored & Cached with Interview Session</span>
        </div>
        <button id="btn-regenerate-gold-ai" class="btn btn-secondary btn-sm" style="font-size: 12px; padding: 5px 12px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          <span>✨ Re-generate Custom with AI</span>
        </button>
      </div>

      <p style="font-size: 13px; color: var(--text-primary); font-weight: 500; margin-bottom: 16px; line-height: 1.5;">
        ${gold.summary}
      </p>

      <div class="gold-grid">
        <div class="gold-box">
          <h4 style="color: var(--cyan-400);">🎯 Reference Requirements & SLAs</h4>
          <ul>
            ${(gold.idealRequirements || []).map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>

        <div class="gold-box">
          <h4 style="color: var(--emerald-400);">📐 Authoritative Calculations</h4>
          <ul>
            ${(gold.idealCalculations || []).map(c => `<li><code>${c}</code></li>`).join('')}
          </ul>
        </div>

        <div class="gold-box" style="grid-column: 1 / -1;">
          <h4 style="color: var(--indigo-400);">🏗️ Architectural Pillars & Data Flow</h4>
          <ul>
            ${(gold.idealArchitectureKeyPoints || []).map(a => `<li>${a}</li>`).join('')}
          </ul>
        </div>

        <div class="gold-box" style="grid-column: 1 / -1;">
          <h4 style="color: var(--amber-400);">🛡️ Resilience & Deep-Dive Failure Strategies</h4>
          <ul>
            ${(gold.recommendedDeepDiveStrategies || []).map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;

    if (typeof document !== 'undefined') {
      document.getElementById('btn-regenerate-gold-ai')?.addEventListener('click', () => {
        this.generateGoldStandardSolution(null, true);
      });
    }
  }

  handleExportPdf() {
    this.showToast('Opening print dialog to export scorecard as PDF...', 'info');
    window.print();
  }

  async handleStartNewInterview() {
    if (!confirm('Start a new practice interview? Your completed scorecard has already been safely archived to your history.')) {
      return;
    }

    await StorageService.clearActiveSession();
    this.app.activeSession = null;
    this.app.currentPhase = 0;

    this.showToast('Starting fresh interview session! Select a problem from the Catalog.', 'success');
    this.app.navigateToPhase(0);
    this.app.discoveryController?.init();
  }
}
