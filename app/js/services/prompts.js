/**
 * Centralized System Design Prompt Registry
 * Dynamically loads and renders prompt templates from markdown files in `prompts/*.md`.
 */

export class PromptRegistry {
  static _cache = {};

  /**
   * Helper to load raw markdown file content from `prompts/<filename>`
   * Works seamlessly across Node.js (test/build) and Browser/Extension environments.
   * @param {string} filename - e.g. 'phase2_requirements_eval.md'
   * @returns {Promise<string>}
   */
  static async loadFile(filename) {
    if (this._cache[filename]) {
      return this._cache[filename];
    }

    let content = '';

    // 1. Environment: Node.js (Tests & CI)
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const rootDir = process.cwd();
        const filePath = path.resolve(rootDir, 'prompts', filename);
        if (fs.existsSync(filePath)) {
          content = fs.readFileSync(filePath, 'utf-8');
        }
      } catch (err) {
        console.warn(`[PromptRegistry] Node.js fs read failed for ${filename}:`, err.message);
      }
    }

    // 2. Environment: Browser / Chrome Extension
    if (!content && typeof fetch !== 'undefined') {
      try {
        let url = `../prompts/${filename}`;
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          url = chrome.runtime.getURL(`prompts/${filename}`);
        }
        const res = await fetch(url);
        if (res.ok) {
          content = await res.text();
        }
      } catch (err) {
        console.warn(`[PromptRegistry] Fetch failed for ${filename}:`, err.message);
      }
    }

    if (!content) {
      throw new Error(`[PromptRegistry] Failed to load prompt file: prompts/${filename}`);
    }

    this._cache[filename] = content;
    return content;
  }

  /**
   * Replaces `{{VARIABLE_NAME}}` placeholders in template with provided data
   * @param {string} template
   * @param {Record<string, any>} variables
   * @returns {string}
   */
  static interpolate(template, variables = {}) {
    return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, key) => {
      const val = variables[key];
      if (val === undefined || val === null) {
        return match;
      }
      if (typeof val === 'object') {
        return JSON.stringify(val);
      }
      return String(val);
    });
  }

  /**
   * Loads critique instruction block from `prompts/critique_instructions.md`
   * @param {'constructive'|'standard'|'hardcore'} [critiqueLevel='standard']
   * @returns {Promise<string>}
   */
  static async getCritiqueInstruction(critiqueLevel = 'standard') {
    const rawMarkdown = await this.loadFile('critique_instructions.md');
    const levelKey = (critiqueLevel || 'standard').toLowerCase().trim();

    // Parse specific section under ## <levelKey>
    const regex = new RegExp(`##\\s*${levelKey}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
    const match = rawMarkdown.match(regex);

    if (match && match[1]) {
      return match[1].trim();
    }

    // Fallback if parsing fails
    return `CRITIQUE STRICTNESS: STANDARD FAANG CALIBRATION.`;
  }

  /**
   * Catalog / Problem Discovery: AI Problem Generator Prompt
   */
  static async getProblemGenerationPrompt({
    level = 'Senior',
    role = 'Distributed Systems Architect',
    background = '',
    count = 10,
    existingTitles = []
  }) {
    let template;
    try {
      template = await this.loadFile('problem_generation.md');
    } catch {
      template = await this.loadFile('phase1_problem_generation.md');
    }
    const formattedExisting = existingTitles.length > 0
      ? existingTitles.slice(0, 15).join(', ')
      : 'None';

    return this.interpolate(template, {
      COUNT: count,
      LEVEL: level,
      ROLE: role,
      BACKGROUND: background || 'Backend / Distributed Systems',
      EXISTING_TITLES: formattedExisting
    });
  }

  /**
   * Phase 1: Problem & Scope Clarification Interviewer Prompt
   */
  static async getClarificationPrompt({ problem, level = 'Senior', critiqueLevel = 'standard' }) {
    let template;
    try {
      template = await this.loadFile('phase1_problem_clarification.md');
    } catch {
      template = await this.loadFile('phase2_clarification.md');
    }
    const critiqueInstruction = await this.getCritiqueInstruction(critiqueLevel);

    return this.interpolate(template, {
      PROBLEM_TITLE: problem?.title || 'System Design Problem',
      LEVEL: level,
      SCALE_METRICS: JSON.stringify(problem?.scaleMetrics || {}),
      VAGUE_PROMPT: problem?.vaguePrompt || problem?.shortDescription || '',
      CRITIQUE_INSTRUCTION: critiqueInstruction
    });
  }

  /**
   * Phase 2: Requirements & Math Evaluation Prompt
   */
  static async getRequirementsEvaluationPrompt({ problem, level = 'Senior', critiqueLevel = 'standard' }) {
    let template;
    try {
      template = await this.loadFile('phase2_requirements_eval.md');
    } catch {
      template = await this.loadFile('phase3_requirements_eval.md');
    }
    const critiqueInstruction = await this.getCritiqueInstruction(critiqueLevel);

    return this.interpolate(template, {
      PROBLEM_TITLE: problem?.title || 'System Design Problem',
      LEVEL: level,
      CRITIQUE_INSTRUCTION: critiqueInstruction
    });
  }

  /**
   * Phase 3: High-Level Architecture (Canvas Vision & Schemas) Evaluation Prompt
   */
  static async getHLDEvaluationPrompt({ problem, level = 'Senior', critiqueLevel = 'standard' }) {
    let template;
    try {
      template = await this.loadFile('phase3_hld_vision_eval.md');
    } catch {
      template = await this.loadFile('phase4_hld_vision_eval.md');
    }
    const critiqueInstruction = await this.getCritiqueInstruction(critiqueLevel);

    return this.interpolate(template, {
      PROBLEM_TITLE: problem?.title || 'System Design Problem',
      LEVEL: level,
      CRITIQUE_INSTRUCTION: critiqueInstruction
    });
  }

  /**
   * Phase 4: Dynamic Deep Dive Question Generator Prompt
   */
  static async getDeepDiveQuestionGenPrompt({
    problem,
    level = 'Senior',
    canvasShapes = '',
    bottlenecks = [],
    opportunities = []
  }) {
    let template;
    try {
      template = await this.loadFile('phase4_deepdive_generation.md');
    } catch {
      template = await this.loadFile('phase5_deepdive_generation.md');
    }

    return this.interpolate(template, {
      PROBLEM_TITLE: problem?.title || 'System Design Problem',
      LEVEL: level
    });
  }

  /**
   * Phase 4: Deep Dive Trade-off Solutions Evaluation Prompt
   */
  static async getDeepDiveEvaluationPrompt({ problem, level = 'Senior', critiqueLevel = 'standard' }) {
    let template;
    try {
      template = await this.loadFile('phase4_deepdive_eval.md');
    } catch {
      template = await this.loadFile('phase5_deepdive_eval.md');
    }
    const critiqueInstruction = await this.getCritiqueInstruction(critiqueLevel);

    return this.interpolate(template, {
      PROBLEM_TITLE: problem?.title || 'System Design Problem',
      LEVEL: level,
      CRITIQUE_INSTRUCTION: critiqueInstruction
    });
  }

  /**
   * Phase 5: Gold-Standard Reference Architecture Prompt
   */
  static async getGoldStandardPrompt({ problem, level = 'Senior' }) {
    let template;
    try {
      template = await this.loadFile('phase5_gold_standard.md');
    } catch {
      template = await this.loadFile('phase6_gold_standard.md');
    }

    return this.interpolate(template, {
      PROBLEM_TITLE: problem?.title || 'System Design Problem',
      LEVEL: level
    });
  }

  /**
   * Floating Context-Aware Assistant Prompt
   */
  static async getAssistantPrompt({ problem, level = 'Senior', phase = 2 }) {
    const template = await this.loadFile('assistant_copilot.md');

    return this.interpolate(template, {
      PROBLEM_TITLE: problem?.title || 'System Design Problem',
      LEVEL: level,
      PHASE: phase
    });
  }
}
