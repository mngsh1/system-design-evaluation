/**
 * HLDController - Phase 4: Core Components, APIs, Data Schema & Interactive Canvas
 */
import { StorageService } from '../services/storage.js';
import { LLMService } from '../services/llm.js';
import { CanvasEngine } from '../canvas/canvasEngine.js';
import { PromptRegistry } from '../services/prompts.js';

export class HLDController {
  constructor({ app, showToast }) {
    this.app = app;
    this.showToast = showToast;

    this.canvasEngine = null;
    this.isEvaluating = false;

    if (typeof document !== 'undefined') {
      // Problem Header
      this.titleEl = document.getElementById('hld-problem-title');
      this.levelBadge = document.getElementById('hld-problem-level');
      this.categoryBadge = document.getElementById('hld-problem-category');

      // API & Schema Inputs
      this.inputApiSchema = document.getElementById('hld-api-schema-input');
      this.btnTemplateRest = document.getElementById('btn-template-rest');
      this.btnTemplateGrpc = document.getElementById('btn-template-grpc');
      this.btnTemplateDb = document.getElementById('btn-template-dbschema');

      // Canvas element
      this.canvasEl = document.getElementById('hld-drawing-canvas');

      // Action buttons
      this.btnSubmit = document.getElementById('btn-submit-hld');
      this.btnNext = document.getElementById('btn-next-to-deepdive');
      this.evalCard = document.getElementById('hld-evaluation-card');
      this.evalContent = document.getElementById('hld-evaluation-content');

      // Canvas Tool buttons
      this.toolSelect = document.getElementById('tool-select');
      this.toolRect = document.getElementById('tool-add-rect');
      this.toolCylinder = document.getElementById('tool-add-cylinder');
      this.toolCloud = document.getElementById('tool-add-cloud');
      this.toolDiamond = document.getElementById('tool-add-diamond');
      this.toolConnect = document.getElementById('tool-connect');
      this.btnDuplicate = document.getElementById('btn-canvas-duplicate');
      this.btnDelete = document.getElementById('btn-canvas-delete');
      this.btnClear = document.getElementById('btn-canvas-clear');
      this.btnZoomIn = document.getElementById('btn-zoom-in');
      this.btnZoomOut = document.getElementById('btn-zoom-out');
      this.btnZoomFit = document.getElementById('btn-zoom-fit');

      this.colorSwatches = document.querySelectorAll('.canvas-color-swatch');

      this._initCanvas();
      this._initEvents();
    }
  }

  _initCanvas() {
    if (!this.canvasEl) return;
    this.canvasEngine = new CanvasEngine(this.canvasEl);
  }

  _initEvents() {
    this.btnSubmit?.addEventListener('click', () => this.handleEvaluate());
    this.btnNext?.addEventListener('click', () => this.handleNext());

    // Autosave on schema input
    const debouncedSave = this._debounce(() => this.saveDraft(), 800);
    this.inputApiSchema?.addEventListener('input', debouncedSave);

    // Canvas tools
    this.toolSelect?.addEventListener('click', () => this._setActiveTool('select'));
    this.toolRect?.addEventListener('click', () => this.canvasEngine?.addShape('rectangle'));
    this.toolCylinder?.addEventListener('click', () => this.canvasEngine?.addShape('cylinder'));
    this.toolCloud?.addEventListener('click', () => this.canvasEngine?.addShape('cloud'));
    this.toolDiamond?.addEventListener('click', () => this.canvasEngine?.addShape('diamond'));
    this.toolConnect?.addEventListener('click', () => this._setActiveTool('connect'));

    this.btnDuplicate?.addEventListener('click', () => this.canvasEngine?.duplicateSelected());
    this.btnDelete?.addEventListener('click', () => this.canvasEngine?.deleteSelected());
    this.btnClear?.addEventListener('click', () => {
      if (confirm('Clear the entire canvas drawing?')) {
        this.canvasEngine?.clear();
        this.saveDraft();
      }
    });

    this.btnZoomIn?.addEventListener('click', () => this.canvasEngine?.zoomIn());
    this.btnZoomOut?.addEventListener('click', () => this.canvasEngine?.zoomOut());
    this.btnZoomFit?.addEventListener('click', () => this.canvasEngine?.fitToScreen());

    // Color Swatches
    this.colorSwatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = swatch.dataset.color;
        this.colorSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        this.canvasEngine?.setSelectedColor(color);
      });
    });

    // Template inserters
    this.btnTemplateRest?.addEventListener('click', () => {
      this._insertTemplate(`### REST API Endpoints\n- **POST /v1/trips/request**\n  - Headers: \`Idempotency-Key: <uuid>\`, \`Authorization: Bearer <token>\`\n  - Request: \`{ "riderId": "u123", "pickup": {"lat": 37.77, "lng": -122.41}, "dropoff": {"lat": 37.79, "lng": -122.40}, "tier": "standard" }\`\n  - Response: \`202 Accepted { "tripId": "t987", "status": "matching", "estimatedArrivalSec": 240 }\`\n\n- **PUT /v1/drivers/location**\n  - Request: \`{ "driverId": "d555", "lat": 37.7749, "lng": -122.4194, "bearing": 180, "timestamp": 1718000000 }\`\n  - Response: \`200 OK\``);
    });

    this.btnTemplateGrpc?.addEventListener('click', () => {
      this._insertTemplate(`### gRPC Service Protocol\n\`\`\`protobuf\nsyntax = "proto3";\n\nservice DispatchService {\n  rpc MatchRide (RideRequest) returns (MatchResponse);\n  rpc StreamDriverLocation (stream LocationUpdate) returns (LocationAck);\n}\n\nmessage LocationUpdate {\n  string driver_id = 1;\n  double latitude = 2;\n  double longitude = 3;\n  int64 timestamp = 4;\n}\n\`\`\``);
    });

    this.btnTemplateDb?.addEventListener('click', () => {
      this._insertTemplate(`### Database Schema & Storage Modeling\n1. **Active Driver Geospatial State (Redis Cluster)**:\n   - Key: \`drivers:geo:{h3_cell_index}\` -> \`GEOADD / H3 Index\`\n   - TTL: 10 seconds (heartbeat)\n\n2. **Trips Table (PostgreSQL / DynamoDB Partitioned)**:\n   - \`trip_id\` (PK, UUID)\n   - \`rider_id\` (Secondary Index)\n   - \`driver_id\` (Nullable, Indexed)\n   - \`status\` (ENUM: matching, accepted, in_progress, completed, cancelled)\n   - \`pickup_location\`, \`dropoff_location\` (JSONB)\n   - \`created_at\`, \`updated_at\` (Timestamps)`);
    });
  }

  _setActiveTool(toolName) {
    if (!this.canvasEngine) return;
    this.canvasEngine.activeTool = toolName;
    document.querySelectorAll('.canvas-tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });
  }

  _insertTemplate(templateText) {
    if (!this.inputApiSchema || this.inputApiSchema.readOnly) return;
    if (this.inputApiSchema.value.trim().length > 0) {
      this.inputApiSchema.value += `\n\n${templateText}`;
    } else {
      this.inputApiSchema.value = templateText;
    }
    this.inputApiSchema.focus();
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

    // Populate API/Schema text
    const hld = session.hld || {};
    if (this.inputApiSchema) this.inputApiSchema.value = hld.apiAndSchema || '';

    // Load canvas diagram
    if (this.canvasEngine) {
      if (hld.canvasData) {
        this.canvasEngine.loadJSON(hld.canvasData);
      } else {
        // Pre-seed a basic starter template diagram
        this.canvasEngine.clear();
        this.canvasEngine.addShape('cloud', 120, 180, 'Web / Mobile Clients');
        this.canvasEngine.addShape('rectangle', 360, 180, 'API Gateway / Envoy');
        this.canvasEngine.addShape('rectangle', 620, 100, 'Matching Microservice');
        this.canvasEngine.addShape('rectangle', 620, 260, 'Location Ingestion Worker');
        this.canvasEngine.addShape('cylinder', 880, 100, 'Trips DB (Postgres)');
        this.canvasEngine.addShape('cylinder', 880, 260, 'Redis Cluster (Geo Cache)');

        const s = this.canvasEngine.shapes;
        if (s.length >= 6) {
          this.canvasEngine.addConnector(s[0].id, s[1].id, 'HTTPS / WSS');
          this.canvasEngine.addConnector(s[1].id, s[2].id, 'gRPC');
          this.canvasEngine.addConnector(s[1].id, s[3].id, 'Kafka Event');
          this.canvasEngine.addConnector(s[2].id, s[4].id, 'Read/Write');
          this.canvasEngine.addConnector(s[3].id, s[5].id, 'GEOADD');
        }
      }
    }

    // Check if already evaluated
    if (hld.evaluation) {
      this.lockInputs();
      this.renderEvaluation(hld.evaluation);
    } else {
      this.unlockInputs();
      if (this.evalCard) this.evalCard.classList.add('hidden');
    }
  }

  async saveDraft() {
    const session = this.app.activeSession;
    if (!session) return;

    if (!session.hld) session.hld = {};
    session.hld.apiAndSchema = this.inputApiSchema?.value || '';
    if (this.canvasEngine) {
      session.hld.canvasData = this.canvasEngine.exportJSON();
    }

    await StorageService.saveActiveSession(session);
  }

  lockInputs() {
    if (this.inputApiSchema) this.inputApiSchema.readOnly = true;
    if (this.canvasEngine) this.canvasEngine.setReadOnly(true);

    if (this.btnSubmit) {
      this.btnSubmit.disabled = true;
      this.btnSubmit.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Architecture Evaluated & Locked</span>
      `;
    }
  }

  unlockInputs() {
    if (this.inputApiSchema) this.inputApiSchema.readOnly = false;
    if (this.canvasEngine) this.canvasEngine.setReadOnly(false);

    if (this.btnSubmit) {
      this.btnSubmit.disabled = false;
      this.btnSubmit.innerHTML = `
        <span>Submit Architecture & Diagram for Evaluation</span>
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

    const schemaText = this.inputApiSchema?.value.trim() || '';
    if (!schemaText && (!this.canvasEngine || this.canvasEngine.shapes.length === 0)) {
      this.showToast('Please provide your API / Schema definitions and diagram before submitting.', 'error');
      return;
    }

    // 1. Pause global timer during evaluation
    this.app.pauseTimer();

    // 2. Lock inputs to read-only
    this.lockInputs();

    // 3. Export Canvas Base64 PNG image snapshot
    const canvasImageBase64 = this.canvasEngine ? this.canvasEngine.exportImageBase64() : null;
    const canvasJSON = this.canvasEngine ? this.canvasEngine.exportJSON() : null;

    session.hld.canvasImageBase64 = canvasImageBase64;
    session.hld.canvasData = canvasJSON;

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
            <strong>Multimodal Vision Interviewer is analyzing your Architecture Diagram & Schemas...</strong>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Evaluating component decomposition, Single Points of Failure (SPOF), and data flow consistency (Timer paused).</p>
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

      const systemPrompt = await PromptRegistry.getHLDEvaluationPrompt({
        problem: session.problem,
        level: session.profile?.level || 'Senior',
        critiqueLevel: settings.critiqueLevel || 'standard'
      });

      const userPrompt = `PROBLEM: ${session.problem.title}
LEVEL: ${session.profile?.level || 'Senior'}

AGREED REQUIREMENTS:
[Functional]: ${session.requirements?.functional || ''}
[Non-Functional]: ${session.requirements?.nonFunctional || ''}
[Math]: ${session.requirements?.estimations || ''}

CANDIDATE HLD SUBMISSION:
[APIs and Database Schema]:
${schemaText || '(No schema text provided)'}

[Canvas Diagram Component Nodes]:
${JSON.stringify((canvasJSON?.shapes || []).map(s => `${s.type}: ${s.text}`))}
[Canvas Diagram Connectors]:
${JSON.stringify((canvasJSON?.connectors || []).map(c => `From ${c.fromId} to ${c.toId} (${c.label})`))}

Please inspect the attached diagram image and text and provide your structured evaluation.`;

      const response = await LLMService.complete({
        provider,
        apiKey,
        model,
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.2,
        jsonMode: true,
        imageBase64: canvasImageBase64
      });

      const evaluation = typeof response === 'object' ? response : JSON.parse(response);

      // Save evaluation to session
      session.hld.evaluation = evaluation;
      session.hld.submittedAt = Date.now();
      await StorageService.saveActiveSession(session);

      this.renderEvaluation(evaluation);
      this.showToast('High-Level Design evaluation completed!', 'success');
    } catch (err) {
      console.error('HLD evaluation error:', err);
      this.showToast(`HLD evaluation error: ${err.message}`, 'error', 6000);

      // Unlock submit button
      if (this.btnSubmit) {
        this.btnSubmit.disabled = false;
        this.btnSubmit.innerHTML = `
          <span>Submit Architecture & Diagram for Evaluation</span>
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
        <h4 style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Architecture Vision Service Temporarily Unavailable</h4>
        <p style="font-size: 13px; color: var(--text-secondary); max-width: 540px; margin: 0 auto 16px; line-height: 1.5;">
          ${this._formatErrorMessage(errorMessage)}
        </p>
        <div style="display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap;">
          <button id="btn-retry-eval-hld" class="btn btn-primary btn-sm" style="padding: 8px 18px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            <span>Retry Evaluation</span>
          </button>
          <button id="btn-settings-eval-hld" class="btn btn-secondary btn-sm" style="padding: 8px 16px;">
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
      document.getElementById('btn-retry-eval-hld')?.addEventListener('click', () => {
        this.handleEvaluate();
      });
      document.getElementById('btn-settings-eval-hld')?.addEventListener('click', () => {
        this.app.settingsController?.open();
      });
    }

    const nextRow = this.evalCard?.querySelector?.('.eval-next-row');
    if (nextRow) nextRow.style.display = 'none';
  }

  _formatErrorMessage(rawError) {
    if (!rawError) return 'The AI vision and architecture evaluator could not be reached. Please check your API key.';
    const err = rawError.toLowerCase();
    if (err.includes('api key') || err.includes('unauthorized') || err.includes('401') || err.includes('403')) {
      return `<strong>API Key Error:</strong> ${rawError}. Please ensure your API key is configured properly in Settings.`;
    }
    if (err.includes('rate limit') || err.includes('429') || err.includes('quota') || err.includes('resource_exhausted')) {
      return `<strong>Rate Limit / Quota Exceeded:</strong> ${rawError}. Please wait a few seconds or switch models in Settings.`;
    }
    if (err.includes('model') || err.includes('not found') || err.includes('format')) {
      return `<strong>Model Error:</strong> ${rawError}. Please verify model configuration in Settings.`;
    }
    return `<strong>Details:</strong> ${rawError}`;
  }

  renderEvaluation(evalData) {
    if (!this.evalContent || !evalData) return;

    const isPassed = evalData.status === 'Passed' || (evalData.score >= 70);
    const statusBadge = isPassed
      ? `<span class="badge badge-emerald">Architecture: Approved (${evalData.score || 85}/100)</span>`
      : `<span class="badge badge-amber">Architecture: Needs Revision (${evalData.score || 65}/100)</span>`;

    const bottlenecks = (evalData.spofAndBottlenecks || [])
      .map(b => `<li>⚠️ ${b}</li>`)
      .join('');

    const deepDives = (evalData.deepDiveOpportunities || [])
      .map(d => `<li>🎯 ${d}</li>`)
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
          <h4>API & Data Modeling Review</h4>
          <p>${evalData.apiSchemaCritique || 'Appropriately structured.'}</p>
        </div>

        <div class="eval-card-section">
          <h4>Component Flow & Decomposition</h4>
          <p>${evalData.architectureCritique || 'Clean component boundaries.'}</p>
        </div>

        <div class="eval-card-section">
          <h4>Caching & Scaling Strategy</h4>
          <p>${evalData.scalingAndCacheStrategy || 'Solid caching tier.'}</p>
        </div>
      </div>

      <div class="eval-footer-grid">
        <div class="eval-pill-box notice-box" style="background: rgba(244, 63, 94, 0.08); border-color: rgba(244, 63, 94, 0.25);">
          <strong style="color: var(--rose-400);">Identified Bottlenecks & SPOFs:</strong>
          <ul>${bottlenecks || '<li>Evaluate failover mechanisms under peak load.</li>'}</ul>
        </div>

        <div class="eval-pill-box notice-box" style="background: rgba(99, 102, 241, 0.08); border-color: rgba(99, 102, 241, 0.3);">
          <strong style="color: var(--indigo-400);">Deep-Dive Focus Areas for Next Phase:</strong>
          <ul>${deepDives || '<li>Partitioning strategy and traffic spike handling.</li>'}</ul>
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

    // Resume global timer for Phase 4
    this.app.resumeTimer();

    session.phase = 4;
    await StorageService.saveActiveSession(session);

    this.showToast('Proceeding to Phase 4: Architectural Deep Dives', 'info');

    if (this.app.deepDiveController) {
      this.app.deepDiveController.loadSession(session);
    }

    this.app.navigateToPhase(4);
  }
}
