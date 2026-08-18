/**
 * TemplateLoader - Modular HTML View Loader
 * Dynamically loads modular view components from `app/views/*.html`
 * across Chrome Extension runtime and standard browser environments.
 */

export class TemplateLoader {
  static _cache = {};

  /**
   * Loads raw HTML from `app/views/<filename>`
   * @param {string} filename - e.g. 'stage-discovery.html'
   * @returns {Promise<string>}
   */
  static async loadView(filename) {
    if (this._cache[filename]) {
      return this._cache[filename];
    }

    let html = '';

    // 1. Node.js environment (for tests)
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const rootDir = process.cwd();
        const filePath = path.resolve(rootDir, 'app', 'views', filename);
        if (fs.existsSync(filePath)) {
          html = fs.readFileSync(filePath, 'utf-8');
        }
      } catch (err) {
        console.warn(`[TemplateLoader] Node read failed for ${filename}:`, err.message);
      }
    }

    // 2. Browser / Chrome Extension runtime
    if (!html && typeof fetch !== 'undefined') {
      try {
        let url = `views/${filename}`;
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          url = chrome.runtime.getURL(`app/views/${filename}`);
        }
        const res = await fetch(url);
        if (res.ok) {
          html = await res.text();
        }
      } catch (err) {
        console.warn(`[TemplateLoader] Fetch failed for ${filename}:`, err.message);
      }
    }

    if (!html) {
      console.warn(`[TemplateLoader] View not loaded: ${filename}`);
    }

    this._cache[filename] = html;
    return html;
  }

  /**
   * Mounts all modular view files into DOM root containers
   */
  static async mountAll() {
    const stageViewport = document.getElementById('stage-viewport');
    const modalsRoot = document.getElementById('modals-root');
    const floatingToolsRoot = document.getElementById('floating-tools-root');

    // Mount Stages into .stage-viewport
    if (stageViewport && stageViewport.children.length === 0) {
      const [
        discoveryHtml,
        problemScopeHtml,
        requirementsHtml,
        architectureHtml,
        deepdiveHtml,
        scorecardHtml
      ] = await Promise.all([
        this.loadView('stage-discovery.html'),
        this.loadView('stage-problem-scope.html'),
        this.loadView('stage-requirements.html'),
        this.loadView('stage-architecture.html'),
        this.loadView('stage-deepdive.html'),
        this.loadView('stage-scorecard.html')
      ]);

      stageViewport.innerHTML = `
        ${discoveryHtml}
        ${problemScopeHtml}
        ${requirementsHtml}
        ${architectureHtml}
        ${deepdiveHtml}
        ${scorecardHtml}
      `;
    }

    // Mount Modals into #modals-root
    if (modalsRoot && modalsRoot.children.length === 0) {
      const modalsHtml = await this.loadView('modals.html');
      modalsRoot.innerHTML = modalsHtml;
    }

    // Mount Floating Tools (Clarification Drawer & Floating AI Assistant) into #floating-tools-root
    if (floatingToolsRoot && floatingToolsRoot.children.length === 0) {
      const toolsHtml = await this.loadView('floating-tools.html');
      floatingToolsRoot.innerHTML = toolsHtml;
    }
  }
}
