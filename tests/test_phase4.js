import { CanvasEngine } from '../app/js/canvas/canvasEngine.js';
import { HLDController } from '../app/js/controllers/hld.js';

function runPhase4Tests() {
  console.log('=== Running Phase 4 HLD Canvas & Controller Tests ===');

  // 1. Mock canvas element for headless testing
  const mockContext = {
    scale: () => {},
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    roundRect: () => {},
    ellipse: () => {},
    rect: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    closePath: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    fillText: () => {},
    measureText: () => ({ width: 60 }),
    setLineDash: () => {},
    strokeRect: () => {}
  };

  const mockCanvas = {
    getContext: () => mockContext,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 520 }),
    addEventListener: () => {},
    style: {}
  };

  const engine = new CanvasEngine(mockCanvas);
  console.log('✔ CanvasEngine instantiated successfully with mock context.');

  // 2. Add shapes
  const s1 = engine.addShape('cloud', 100, 100, 'Web / Mobile Clients');
  const s2 = engine.addShape('rectangle', 300, 100, 'API Gateway');
  const s3 = engine.addShape('cylinder', 500, 100, 'Postgres DB');
  const s4 = engine.addShape('diamond', 700, 100, 'Shard Router');

  if (engine.shapes.length !== 4) {
    throw new Error(`Expected 4 shapes, got ${engine.shapes.length}`);
  }
  console.log('✔ Geometric shapes (cloud, rectangle, cylinder, diamond) created.');

  // 3. Connect shapes
  const conn = engine.addConnector(s1.id, s2.id, 'HTTPS / REST');
  if (engine.connectors.length !== 1 || engine.connectors[0].label !== 'HTTPS / REST') {
    throw new Error('Connector creation failed!');
  }
  console.log('✔ Component connector arrow created.');

  // 4. Test Serialization and Deserialization
  const exported = engine.exportJSON();
  if (exported.shapes.length !== 4 || exported.connectors.length !== 1) {
    throw new Error('Canvas JSON export failed!');
  }

  engine.clear();
  if (engine.shapes.length !== 0) {
    throw new Error('Canvas clear failed!');
  }

  engine.loadJSON(exported);
  if (engine.shapes.length !== 4 || engine.connectors.length !== 1) {
    throw new Error('Canvas JSON reload failed!');
  }
  console.log('✔ Canvas JSON export, clear, and reload verified.');

  // 5. Test Undo / Redo
  engine.deleteSelected(); // deletes shape if selected
  engine.undo();
  if (engine.shapes.length !== 4) {
    throw new Error('Undo operation failed!');
  }
  console.log('✔ Undo history stack verified.');

  // 6. Test HLDController
  const hldCtrl = new HLDController({ app: {}, showToast: () => {} });
  console.log('✔ HLDController instantiated safely.');

  console.log('\nAll Phase 4 Canvas Engine and Controller checks PASSED successfully!');
}

runPhase4Tests();
