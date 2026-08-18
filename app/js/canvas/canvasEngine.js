/**
 * CanvasEngine - Lightweight, high-performance HTML5 System Design diagramming engine.
 * Supports basic geometric shapes with direct text labels, connectors, pan/zoom, undo/redo, and PNG export.
 */

export class CanvasEngine {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.options = options;

    this.shapes = [];
    this.connectors = [];
    this.selectedShapeId = null;
    this.selectedConnectorId = null;
    this.hoveredShapeId = null;

    // Viewport Transform (Pan & Zoom)
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    // Interaction Modes: 'select' | 'pan' | 'connect' | 'rectangle' | 'cylinder' | 'cloud' | 'diamond'
    this.activeTool = 'select';
    this.connectSourceId = null;

    // Dragging & Resizing
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.shapeStartProps = null;

    // Color Palette
    this.currentColor = '#06B6D4'; // Cyan default
    this.isReadOnly = false;

    // Undo / Redo
    this.undoStack = [];
    this.redoStack = [];

    // Inline Text Editor Overlay
    this.textEditorOverlay = null;

    this._initDPI();
    this._initOverlay();
    this._initEvents();
    this.render();
  }

  _initDPI() {
    if (!this.canvas) return;
    const rect = (typeof this.canvas.getBoundingClientRect === 'function') 
      ? this.canvas.getBoundingClientRect() 
      : { width: 900, height: 520, left: 0, top: 0 };
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    this.width = rect.width || 900;
    this.height = rect.height || 520;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    if (this.ctx && typeof this.ctx.scale === 'function') {
      this.ctx.scale(dpr, dpr);
    }
  }

  _initOverlay() {
    if (typeof document === 'undefined') return;
    const parent = this.canvas?.parentElement;
    if (!parent) return;

    parent.style.position = 'relative';

    this.textEditorOverlay = document.createElement('textarea');
    this.textEditorOverlay.className = 'canvas-text-editor-overlay';
    this.textEditorOverlay.style.position = 'absolute';
    this.textEditorOverlay.style.display = 'none';
    this.textEditorOverlay.style.zIndex = '50';
    parent.appendChild(this.textEditorOverlay);

    this.textEditorOverlay.addEventListener('blur', () => this._finishTextEditing());
    this.textEditorOverlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._finishTextEditing();
      } else if (e.key === 'Escape') {
        this.textEditorOverlay.style.display = 'none';
      }
    });
  }

  _initEvents() {
    if (!this.canvas || typeof window === 'undefined') return;

    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    window.addEventListener('mousemove', (e) => this._onMouseMove(e));
    window.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('dblclick', (e) => this._onDoubleClick(e));

    // Wheel zoom & pan
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });

    // Window resize
    window.addEventListener('resize', () => {
      this._initDPI();
      this.render();
    });

    // Keyboard Shortcuts (Delete, Undo, Redo, Duplicate)
    window.addEventListener('keydown', (e) => {
      if (this.isReadOnly || (this.textEditorOverlay && this.textEditorOverlay.style.display !== 'none')) return;
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        this.deleteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        this.duplicateSelected();
      }
    });
  }

  // =========================================================================
  // Coordinate Transforms
  // =========================================================================
  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (screenX - rect.left - this.panX) / this.zoom;
    const y = (screenY - rect.top - this.panY) / this.zoom;
    return { x, y };
  }

  worldToScreen(worldX, worldY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = worldX * this.zoom + this.panX + rect.left;
    const y = worldY * this.zoom + this.panY + rect.top;
    return { x, y };
  }

  // =========================================================================
  // Shapes & Connectors CRUD
  // =========================================================================
  addShape(type, x, y, customText = '') {
    if (this.isReadOnly) return;
    this._saveHistory();

    const world = (x === undefined || y === undefined) 
      ? this.screenToWorld(this.width / 2, this.height / 2)
      : { x, y };

    const defaultNames = {
      rectangle: 'App Service / Worker',
      cylinder: 'Database / Cache',
      cloud: 'Clients / Stream Queue',
      diamond: 'Router / DNS / Gateway'
    };

    const newShape = {
      id: `shape_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: type || 'rectangle',
      x: world.x - 70,
      y: world.y - 35,
      w: 140,
      h: 70,
      text: customText || defaultNames[type] || 'Component',
      color: this.currentColor
    };

    this.shapes.push(newShape);
    this.selectedShapeId = newShape.id;
    this.selectedConnectorId = null;
    this.activeTool = 'select';
    this.render();
    return newShape;
  }

  addConnector(fromId, toId, label = 'HTTPS / gRPC') {
    if (this.isReadOnly || fromId === toId) return;
    this._saveHistory();

    const newConn = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      fromId,
      toId,
      label: label || '',
      style: 'solid'
    };

    this.connectors.push(newConn);
    this.selectedConnectorId = newConn.id;
    this.selectedShapeId = null;
    this.activeTool = 'select';
    this.connectSourceId = null;
    this.render();
    return newConn;
  }

  deleteSelected() {
    if (this.isReadOnly) return;
    if (!this.selectedShapeId && !this.selectedConnectorId) return;

    this._saveHistory();
    if (this.selectedShapeId) {
      const id = this.selectedShapeId;
      this.shapes = this.shapes.filter(s => s.id !== id);
      this.connectors = this.connectors.filter(c => c.fromId !== id && c.toId !== id);
      this.selectedShapeId = null;
    } else if (this.selectedConnectorId) {
      this.connectors = this.connectors.filter(c => c.id !== this.selectedConnectorId);
      this.selectedConnectorId = null;
    }
    this.render();
  }

  duplicateSelected() {
    if (this.isReadOnly || !this.selectedShapeId) return;
    const target = this.shapes.find(s => s.id === this.selectedShapeId);
    if (!target) return;

    this._saveHistory();
    const clone = {
      ...target,
      id: `shape_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      x: target.x + 30,
      y: target.y + 30
    };
    this.shapes.push(clone);
    this.selectedShapeId = clone.id;
    this.render();
  }

  setSelectedColor(hexColor) {
    this.currentColor = hexColor;
    if (this.isReadOnly) return;
    if (this.selectedShapeId) {
      const shape = this.shapes.find(s => s.id === this.selectedShapeId);
      if (shape) {
        this._saveHistory();
        shape.color = hexColor;
        this.render();
      }
    }
  }

  clear() {
    if (this.isReadOnly) return;
    this._saveHistory();
    this.shapes = [];
    this.connectors = [];
    this.selectedShapeId = null;
    this.selectedConnectorId = null;
    this.render();
  }

  // =========================================================================
  // Mouse & Touch Interaction Handlers
  // =========================================================================
  _onMouseDown(e) {
    if (e.button === 1 || this.activeTool === 'pan' || e.spaceKey) {
      // Pan start
      this.isPanning = true;
      this.panStartX = e.clientX - this.panX;
      this.panStartY = e.clientY - this.panY;
      return;
    }

    const { x, y } = this.screenToWorld(e.clientX, e.clientY);

    // If in shape creation tool
    if (['rectangle', 'cylinder', 'cloud', 'diamond'].includes(this.activeTool)) {
      this.addShape(this.activeTool, x, y);
      return;
    }

    // Check Resize Handles if a shape is selected
    if (this.selectedShapeId && !this.isReadOnly) {
      const selected = this.shapes.find(s => s.id === this.selectedShapeId);
      if (selected) {
        const handle = this._hitTestHandles(selected, x, y);
        if (handle) {
          this._saveHistory();
          this.isResizing = true;
          this.resizeHandle = handle;
          this.dragStartX = x;
          this.dragStartY = y;
          this.shapeStartProps = { ...selected };
          return;
        }
      }
    }

    // Hit test shapes
    const hitShape = this._hitTestShape(x, y);

    if (this.activeTool === 'connect' && !this.isReadOnly) {
      if (hitShape) {
        if (!this.connectSourceId) {
          this.connectSourceId = hitShape.id;
          this.selectedShapeId = hitShape.id;
        } else {
          this.addConnector(this.connectSourceId, hitShape.id);
        }
      }
      this.render();
      return;
    }

    if (hitShape) {
      this.selectedShapeId = hitShape.id;
      this.selectedConnectorId = null;
      if (!this.isReadOnly) {
        this.isDragging = true;
        this.dragStartX = x;
        this.dragStartY = y;
        this.shapeStartProps = { ...hitShape };
      }
    } else {
      // Hit test connectors
      const hitConn = this._hitTestConnector(x, y);
      if (hitConn) {
        this.selectedConnectorId = hitConn.id;
        this.selectedShapeId = null;
      } else {
        this.selectedShapeId = null;
        this.selectedConnectorId = null;
      }
    }

    this.render();
  }

  _onMouseMove(e) {
    if (this.isPanning) {
      this.panX = e.clientX - this.panStartX;
      this.panY = e.clientY - this.panStartY;
      this.render();
      return;
    }

    const { x, y } = this.screenToWorld(e.clientX, e.clientY);

    if (this.isDragging && this.selectedShapeId && !this.isReadOnly) {
      const shape = this.shapes.find(s => s.id === this.selectedShapeId);
      if (shape && this.shapeStartProps) {
        shape.x = Math.round(this.shapeStartProps.x + (x - this.dragStartX));
        shape.y = Math.round(this.shapeStartProps.y + (y - this.dragStartY));
        this.render();
      }
      return;
    }

    if (this.isResizing && this.selectedShapeId && !this.isReadOnly) {
      const shape = this.shapes.find(s => s.id === this.selectedShapeId);
      if (shape && this.shapeStartProps) {
        const dx = x - this.dragStartX;
        const dy = y - this.dragStartY;
        if (this.resizeHandle === 'se') {
          shape.w = Math.max(60, this.shapeStartProps.w + dx);
          shape.h = Math.max(40, this.shapeStartProps.h + dy);
        } else if (this.resizeHandle === 'sw') {
          const newW = Math.max(60, this.shapeStartProps.w - dx);
          shape.x = this.shapeStartProps.x + (this.shapeStartProps.w - newW);
          shape.w = newW;
          shape.h = Math.max(40, this.shapeStartProps.h + dy);
        } else if (this.resizeHandle === 'ne') {
          shape.w = Math.max(60, this.shapeStartProps.w + dx);
          const newH = Math.max(40, this.shapeStartProps.h - dy);
          shape.y = this.shapeStartProps.y + (this.shapeStartProps.h - newH);
          shape.h = newH;
        } else if (this.resizeHandle === 'nw') {
          const newW = Math.max(60, this.shapeStartProps.w - dx);
          const newH = Math.max(40, this.shapeStartProps.h - dy);
          shape.x = this.shapeStartProps.x + (this.shapeStartProps.w - newW);
          shape.y = this.shapeStartProps.y + (this.shapeStartProps.h - newH);
          shape.w = newW;
          shape.h = newH;
        }
        this.render();
      }
      return;
    }

    // Hover state
    const hitShape = this._hitTestShape(x, y);
    if (hitShape?.id !== this.hoveredShapeId) {
      this.hoveredShapeId = hitShape?.id || null;
      this.canvas.style.cursor = hitShape ? 'move' : 'default';
      this.render();
    }
  }

  _onMouseUp() {
    this.isPanning = false;
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.shapeStartProps = null;
  }

  _onWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.min(2.5, Math.max(0.4, this.zoom * zoomFactor));

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
    this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
    this.zoom = newZoom;
    this.render();
  }

  _onDoubleClick(e) {
    if (this.isReadOnly) return;
    const { x, y } = this.screenToWorld(e.clientX, e.clientY);
    const hitShape = this._hitTestShape(x, y);

    if (hitShape) {
      this._startTextEditing(hitShape);
    } else {
      const hitConn = this._hitTestConnector(x, y);
      if (hitConn) {
        const newLabel = prompt("Enter connector label:", hitConn.label || "");
        if (newLabel !== null) {
          this._saveHistory();
          hitConn.label = newLabel.trim();
          this.render();
        }
      }
    }
  }

  _startTextEditing(shape) {
    if (!this.textEditorOverlay) return;
    const screen = this.worldToScreen(shape.x, shape.y);
    const rect = this.canvas.getBoundingClientRect();

    this.editingShapeId = shape.id;
    this.textEditorOverlay.style.left = `${screen.x - rect.left}px`;
    this.textEditorOverlay.style.top = `${screen.y - rect.top}px`;
    this.textEditorOverlay.style.width = `${shape.w * this.zoom}px`;
    this.textEditorOverlay.style.height = `${shape.h * this.zoom}px`;
    this.textEditorOverlay.style.display = 'block';
    this.textEditorOverlay.value = shape.text || '';
    this.textEditorOverlay.focus();
    this.textEditorOverlay.select();
  }

  _finishTextEditing() {
    if (!this.textEditorOverlay || !this.editingShapeId) return;
    const shape = this.shapes.find(s => s.id === this.editingShapeId);
    if (shape) {
      const newText = this.textEditorOverlay.value.trim();
      if (newText && newText !== shape.text) {
        this._saveHistory();
        shape.text = newText;
      }
    }
    this.textEditorOverlay.style.display = 'none';
    this.editingShapeId = null;
    this.render();
  }

  // =========================================================================
  // Hit Testing
  // =========================================================================
  _hitTestShape(x, y) {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const s = this.shapes[i];
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
        return s;
      }
    }
    return null;
  }

  _hitTestHandles(shape, x, y) {
    const handleSize = 10 / this.zoom;
    const handles = {
      nw: { x: shape.x, y: shape.y },
      ne: { x: shape.x + shape.w, y: shape.y },
      se: { x: shape.x + shape.w, y: shape.y + shape.h },
      sw: { x: shape.x, y: shape.y + shape.h }
    };
    for (const [key, pos] of Object.entries(handles)) {
      if (Math.abs(x - pos.x) <= handleSize && Math.abs(y - pos.y) <= handleSize) {
        return key;
      }
    }
    return null;
  }

  _hitTestConnector(x, y) {
    for (const conn of this.connectors) {
      const from = this.shapes.find(s => s.id === conn.fromId);
      const to = this.shapes.find(s => s.id === conn.toId);
      if (!from || !to) continue;

      const p1 = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
      const p2 = { x: to.x + to.w / 2, y: to.y + to.h / 2 };

      // Distance from point (x,y) to segment p1-p2
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;

      const t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq));
      const projX = p1.x + t * dx;
      const projY = p1.y + t * dy;
      const dist = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);

      if (dist < 10 / this.zoom) return conn;
    }
    return null;
  }

  // =========================================================================
  // History Stack (Undo / Redo)
  // =========================================================================
  _saveHistory() {
    this.undoStack.push(this.exportJSON());
    if (this.undoStack.length > 30) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(this.exportJSON());
    const prev = this.undoStack.pop();
    this.loadJSON(prev);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(this.exportJSON());
    const next = this.redoStack.pop();
    this.loadJSON(next);
  }

  // =========================================================================
  // Zoom Controls
  // =========================================================================
  zoomIn() {
    this.zoom = Math.min(2.5, this.zoom * 1.2);
    this.render();
  }

  zoomOut() {
    this.zoom = Math.max(0.4, this.zoom * 0.8);
    this.render();
  }

  zoomReset() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.render();
  }

  fitToScreen() {
    if (this.shapes.length === 0) {
      this.zoomReset();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.shapes.forEach(s => {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.w);
      maxY = Math.max(maxY, s.y + s.h);
    });

    const padding = 60;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;

    this.zoom = Math.min(1.5, Math.max(0.4, Math.min(this.width / contentW, this.height / contentH)));
    this.panX = (this.width - (maxX + minX) * this.zoom) / 2;
    this.panY = (this.height - (maxY + minY) * this.zoom) / 2;
    this.render();
  }

  // =========================================================================
  // Serialization & Export
  // =========================================================================
  exportJSON() {
    return {
      shapes: JSON.parse(JSON.stringify(this.shapes)),
      connectors: JSON.parse(JSON.stringify(this.connectors))
    };
  }

  loadJSON(data) {
    if (!data) return;
    this.shapes = data.shapes || [];
    this.connectors = data.connectors || [];
    this.selectedShapeId = null;
    this.selectedConnectorId = null;
    this.render();
  }

  setReadOnly(readOnly) {
    this.isReadOnly = !!readOnly;
    this.render();
  }

  /**
   * Generates a clean, high-contrast Base64 PNG image snapshot for Vision LLMs
   */
  exportImageBase64() {
    // Create an offscreen canvas containing only the diagram content with dark background
    const offscreen = document.createElement('canvas');
    offscreen.width = 1280;
    offscreen.height = 720;
    const ctx = offscreen.getContext('2d');

    // Dark canvas background
    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, 1280, 720);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1280; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 720); ctx.stroke();
    }
    for (let y = 0; y < 720; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke();
    }

    // Determine scale to fit in 1280x720
    let minX = 0, minY = 0, maxX = 1000, maxY = 600;
    if (this.shapes.length > 0) {
      minX = Math.min(...this.shapes.map(s => s.x));
      minY = Math.min(...this.shapes.map(s => s.y));
      maxX = Math.max(...this.shapes.map(s => s.x + s.w));
      maxY = Math.max(...this.shapes.map(s => s.y + s.h));
    }

    const margin = 80;
    const scale = Math.min(1.2, Math.max(0.5, Math.min((1280 - margin * 2) / (maxX - minX || 1), (720 - margin * 2) / (maxY - minY || 1))));
    const offsetX = (1280 - (maxX + minX) * scale) / 2;
    const offsetY = (720 - (maxY + minY) * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw Connectors
    this.connectors.forEach(conn => this._drawConnectorOnContext(ctx, conn, false));

    // Draw Shapes
    this.shapes.forEach(shape => this._drawShapeOnContext(ctx, shape, false));

    ctx.restore();

    return offscreen.toDataURL('image/png');
  }

  // =========================================================================
  // Canvas Rendering Loop
  // =========================================================================
  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    // Background
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, this.width, this.height);

    // Grid dots
    this._drawGrid(ctx);

    // Apply Viewport Transform
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // 1. Draw Connectors
    this.connectors.forEach(conn => {
      const isSelected = conn.id === this.selectedConnectorId;
      this._drawConnectorOnContext(ctx, conn, isSelected);
    });

    // 2. Draw Shapes
    this.shapes.forEach(shape => {
      const isSelected = shape.id === this.selectedShapeId;
      const isHovered = shape.id === this.hoveredShapeId;
      this._drawShapeOnContext(ctx, shape, isSelected, isHovered);
    });

    // 3. Draw Selected Shape Handles
    if (this.selectedShapeId && !this.isReadOnly) {
      const selected = this.shapes.find(s => s.id === this.selectedShapeId);
      if (selected) this._drawResizeHandles(ctx, selected);
    }

    ctx.restore();
  }

  _drawGrid(ctx) {
    const gridSize = 24 * this.zoom;
    const startX = this.panX % gridSize;
    const startY = this.panY % gridSize;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = startX; x < this.width; x += gridSize) {
      for (let y = startY; y < this.height; y += gridSize) {
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }
  }

  _drawShapeOnContext(ctx, shape, isSelected, isHovered) {
    const { x, y, w, h, type, color, text } = shape;
    const strokeColor = isSelected ? '#38BDF8' : (color || '#06B6D4');
    const glowColor = isSelected ? 'rgba(56, 189, 248, 0.4)' : 'rgba(6, 182, 212, 0.15)';

    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isSelected ? 16 : 8;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isSelected ? 2.5 : 1.8;

    if (type === 'rectangle') {
      const radius = 10;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();
      ctx.stroke();
    } else if (type === 'cylinder') {
      const ellipseH = Math.min(20, h * 0.25);
      // Main body
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + ellipseH, w / 2, ellipseH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.rect(x, y + ellipseH, w, h - ellipseH * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y + ellipseH);
      ctx.lineTo(x, y + h - ellipseH);
      ctx.moveTo(x + w, y + ellipseH);
      ctx.lineTo(x + w, y + h - ellipseH);
      ctx.stroke();

      // Bottom cap
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h - ellipseH, w / 2, ellipseH, 0, 0, Math.PI);
      ctx.fill();
      ctx.stroke();
    } else if (type === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (type === 'cloud') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 24);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    // Draw Shape Text Label
    ctx.save();
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = (text || '').split('\n');
    const lineHeight = 16;
    const totalTextH = lines.length * lineHeight;
    const startTextY = y + h / 2 - totalTextH / 2 + lineHeight / 2;

    lines.forEach((line, idx) => {
      ctx.fillText(line, x + w / 2, startTextY + idx * lineHeight, w - 16);
    });

    ctx.restore();
  }

  _drawConnectorOnContext(ctx, conn, isSelected) {
    const from = this.shapes.find(s => s.id === conn.fromId);
    const to = this.shapes.find(s => s.id === conn.toId);
    if (!from || !to) return;

    const p1 = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const p2 = { x: to.x + to.w / 2, y: to.y + to.h / 2 };

    const strokeColor = isSelected ? '#38BDF8' : '#94A3B8';

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineWidth = isSelected ? 2.5 : 1.8;

    if (conn.style === 'dashed') {
      ctx.setLineDash([6, 4]);
    }

    // Line
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Arrowhead at p2
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const headLen = 10;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - headLen * Math.cos(angle - Math.PI / 6), p2.y - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(p2.x - headLen * Math.cos(angle + Math.PI / 6), p2.y - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // Text Label on Line
    if (conn.label) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      ctx.font = '500 11px JetBrains Mono, monospace';
      const textMetrics = ctx.measureText(conn.label);
      const bgW = textMetrics.width + 12;
      const bgH = 18;

      ctx.fillStyle = '#0B0F17';
      ctx.fillRect(midX - bgW / 2, midY - bgH / 2, bgW, bgH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.strokeRect(midX - bgW / 2, midY - bgH / 2, bgW, bgH);

      ctx.fillStyle = isSelected ? '#38BDF8' : '#CBD5E1';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(conn.label, midX, midY);
    }

    ctx.restore();
  }

  _drawResizeHandles(ctx, shape) {
    const handleSize = 8;
    const handles = [
      { x: shape.x, y: shape.y },
      { x: shape.x + shape.w, y: shape.y },
      { x: shape.x + shape.w, y: shape.y + shape.h },
      { x: shape.x, y: shape.y + shape.h }
    ];

    ctx.save();
    ctx.fillStyle = '#38BDF8';
    ctx.strokeStyle = '#0B0F17';
    ctx.lineWidth = 1.5;

    handles.forEach(h => {
      ctx.beginPath();
      ctx.rect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }
}
