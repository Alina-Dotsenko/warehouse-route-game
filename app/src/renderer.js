/**
 * Canvas-рендерер топологии склада.
 *
 * Уровень содержит 1200-2200 шкафов. В DOM это столько же абсолютно
 * позиционированных элементов — браузер захлёбывается на пересчёте лэйаута
 * при каждом кадре панорамирования. Здесь всё рисуется в один <canvas>.
 *
 * Система координат:
 *   данные уровня заданы в процентах (x: 0..100, y: 0..96), но карта
 *   отображается в пропорции 2:1, поэтому единица по Y вдвое короче единицы
 *   по X. Проекция мир -> экран:
 *       sx = originX + cx * scale
 *       sy = originY + cy * scale * Y_SQUEEZE
 *   При таком сжатии шкаф 0.84 x 1.68 выглядит квадратом — как и задумано.
 */

import { Gosha, buildApproach } from './gosha.js';

const Y_SQUEEZE = 1;

// Размеры мира в собственных единицах (ширина по X, высота по Y).
const WORLD_W = 100;
const WORLD_H = 100;

const MIN_SCALE_FACTOR = 0.9; // относительно масштаба «вписать в экран»
const MAX_SCALE = 60;

// Ниже этого экранного размера шкафа детали (полоса подхода) не рисуем —
// они всё равно не читаются, а времени отнимают много.
const DETAIL_THRESHOLD_PX = 9;

// Маркеры выбранных и целевых шкафов не сжимаются меньше этого размера,
// иначе на отдалении не видно, что именно ты выбрал.
const MIN_MARKER_PX = 13;
const MIN_PICK_MARKER_PX = 6;

const COLORS = {
  outside: '#070c14',
  floor: '#132038',
  floorLine: 'rgba(255,255,255,0.05)',
  bounds: 'rgba(120,160,255,0.28)',

  // Обычный шкаф: светлый корпус с бликом по верхней грани и тенью по нижней —
  // на общем плане ряды читаются как объём, а не как плоская заливка.
  cabinet: '#9db2d4',
  cabinetTop: '#c2d2ec',
  cabinetShade: '#6d81a6',
  cabinetEdge: 'rgba(10,17,32,0.5)',

  // Глухие блоки — это стены из шкафов, к которым нельзя подойти. Их до
  // половины на уровне, поэтому им нужен и свой тон, и заметный контур:
  // без контура тёмная заливка сливалась с полом.
  blind: '#4d5f83',
  blindEdge: '#7d8fb5',

  facing: '#ff2d92',
  facingGlow: 'rgba(255,45,146,0.35)',

  pick: '#2ee06a',
  pickTop: '#7df3a6',

  selected: '#ef4444',
  selectedFill: 'rgba(239,68,68,0.45)',
  obstacle: 'rgba(8,12,20,0.9)',
  obstacleEdge: '#3a465c',
  routeBad: '#ff8a3d',
  routeGood: '#22d3ee',
  routeStart: '#ffffff',
  hintZone: 'rgba(250,204,21,0.16)',
  hintStroke: '#facc15',
};

/**
 * Диагональная штриховка как CanvasPattern: рисовать её по каждому блоку
 * отдельно слишком дорого (глухих блоков бывает больше восьмисот), а одним
 * паттерном они заливаются за один вызов fill().
 */
let hatchPattern = null;
function getHatch(ctx, base, line) {
  if (hatchPattern) return hatchPattern;
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 8, 8);
  g.strokeStyle = line;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(-2, 6); g.lineTo(6, -2);
  g.moveTo(2, 10); g.lineTo(10, 2);
  g.stroke();
  hatchPattern = ctx.createPattern(c, 'repeat');
  return hatchPattern;
}

/** roundRect есть не везде — на старых движках падаем обратно на прямые углы. */
const HAS_ROUND_RECT =
  typeof CanvasRenderingContext2D !== 'undefined' &&
  typeof CanvasRenderingContext2D.prototype.roundRect === 'function';

/**
 * Строит массив точек маршрута с той же логикой «диагональ + прямая»,
 * что использовалась в исходной SVG-версии: если шаг не по оси и не под 45°,
 * он разбивается на диагональный и прямой отрезки.
 */
function buildRoutePoints(route) {
  const pts = [];
  if (!route || route.length === 0) return pts;

  pts.push({ x: route[0].x, y: route[0].y });

  for (let i = 1; i < route.length; i++) {
    const pt = route[i];
    const prev = route[i - 1];
    const dx = pt.x - prev.x;
    const dy = pt.y - prev.y;

    const axisAligned = Math.abs(dx) < 0.001 || Math.abs(dy) < 0.001;
    const diagonal = Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.001;

    if (axisAligned || diagonal) {
      pts.push({ x: pt.x, y: pt.y });
    } else if (Math.abs(dx) > Math.abs(dy)) {
      const ix = prev.x + Math.sign(dx) * (Math.abs(dx) - Math.abs(dy));
      pts.push({ x: ix, y: prev.y });
      pts.push({ x: pt.x, y: pt.y });
    } else {
      const iy = prev.y + Math.sign(dy) * (Math.abs(dy) - Math.abs(dx));
      pts.push({ x: prev.x, y: iy });
      pts.push({ x: pt.x, y: pt.y });
    }
  }

  return pts;
}

/**
 * Шкафы, через которые проходит маршрут, — это точки отбора товара.
 * Считаем один раз на уровень, а не на каждый кадр.
 */
function computePickSet(cabinets, route) {
  const picks = new Set();
  if (!route || route.length === 0) return picks;

  for (let i = 0; i < cabinets.length; i++) {
    const cab = cabinets[i];
    for (let j = 0; j < route.length; j++) {
      const pt = route[j];
      if (
        pt.x >= cab.x - 0.1 &&
        pt.x <= cab.x + cab.w + 0.1 &&
        pt.y >= cab.y - 0.1 &&
        pt.y <= cab.y + cab.h + 0.1
      ) {
        picks.add(i);
        break;
      }
    }
  }

  return picks;
}

/**
 * Равномерная сетка для hit-testing. Линейный перебор 2200 шкафов на каждый
 * тап отработал бы и так, но сетка нужна для поиска ближайшего шкафа в
 * радиусе — на телефоне палец почти никогда не попадает точно.
 */
class SpatialGrid {
  constructor(cabinets, cellSize = 4) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this.cabinets = cabinets;

    for (let i = 0; i < cabinets.length; i++) {
      const c = cabinets[i];
      const c0 = Math.floor(c.x / cellSize);
      const c1 = Math.floor((c.x + c.w) / cellSize);
      const r0 = Math.floor(c.y / cellSize);
      const r1 = Math.floor((c.y + c.h) / cellSize);
      for (let r = r0; r <= r1; r++) {
        for (let col = c0; col <= c1; col++) {
          const key = r * 100000 + col;
          let bucket = this.cells.get(key);
          if (!bucket) {
            bucket = [];
            this.cells.set(key, bucket);
          }
          bucket.push(i);
        }
      }
    }
  }

  /** Индекс шкафа под точкой мира, либо ближайшего в пределах radius. */
  pick(x, y, radiusX, radiusY) {
    const cs = this.cellSize;
    const span = Math.ceil(Math.max(radiusX, radiusY) / cs) + 1;
    const col0 = Math.floor((x - radiusX) / cs) - 1;
    const col1 = Math.floor((x + radiusX) / cs) + 1;
    const row0 = Math.floor((y - radiusY) / cs) - 1;
    const row1 = Math.floor((y + radiusY) / cs) + 1;

    let best = -1;
    let bestDist = Infinity;
    const seen = new Set();

    for (let r = row0; r <= row1; r++) {
      for (let c = col0; c <= col1; c++) {
        const bucket = this.cells.get(r * 100000 + c);
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
          const idx = bucket[k];
          if (seen.has(idx)) continue;
          seen.add(idx);

          const cab = this.cabinets[idx];
          // Прямое попадание — сразу выигрывает.
          if (x >= cab.x && x <= cab.x + cab.w && y >= cab.y && y <= cab.y + cab.h) {
            return idx;
          }

          // Иначе — расстояние до прямоугольника, нормированное по осям,
          // чтобы сжатие по Y не искажало «ближайший на глаз».
          const dx = Math.max(cab.x - x, 0, x - (cab.x + cab.w)) / radiusX;
          const dy = Math.max(cab.y - y, 0, y - (cab.y + cab.h)) / radiusY;
          const d = dx * dx + dy * dy;
          if (d < bestDist) {
            bestDist = d;
            best = idx;
          }
        }
      }
    }

    void span;
    return bestDist <= 1 ? best : -1;
  }
}

export class TopologyMap {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{onSelectionChange?: (set: Set<number>) => void, onViewChange?: (state: object) => void}} hooks
   */
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.hooks = hooks;

    this.level = null;
    this.cabinets = [];
    this.obstacles = [];
    this.bounds = null;
    this.grid = null;
    this.pickSet = new Set();
    this.selected = new Set();

    this.routes = { bad: [], good: [] };
    this.activeRoute = 'bad';
    this.hintZone = null;
    this.showHintZone = false;

    this.scale = 1;
    this.minScale = 0.5;
    this.originX = 0;
    this.originY = 0;

    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    this._frame = null;
    this._dashPhase = 0;
    this._animating = false;
    this._destroyed = false;

    this._pointers = new Map();
    this._gesture = null;

    this.gosha = new Gosha();
    this._lastTick = 0;

    this._bindEvents();
    this._observeResize();
  }

  // ---------------------------------------------------------------- уровень

  setLevel(level) {
    this.level = level;
    this.cabinets = level.topology.cabinets || [];
    this.obstacles = level.topology.obstacles || [];
    this.bounds = level.topology.bounds || null;
    this.hintZone = level.hintZone || null;
    this.showHintZone = false;

    this.routes = {
      bad: buildRoutePoints(level.badRoute || level.topology.route),
      good: buildRoutePoints(level.goodRoute),
    };

    // Точки отбора определяются «плохим» маршрутом — это фактический маршрут,
    // который система построила, и он проходит через все целевые шкафы.
    this.pickSet = computePickSet(this.cabinets, level.badRoute || level.topology.route);
    this.grid = new SpatialGrid(this.cabinets);

    this.selected = new Set();
    this.gosha.idle(this.routes[this.activeRoute]);

    this.resize();
    this.fit();
    this._emitSelection();
  }

  setActiveRoute(kind) {
    this.activeRoute = kind;
    if (this.gosha.phase === 'idle') this.gosha.idle(this.routes[kind]);
    this.requestDraw();
  }

  /**
   * Сцена проверки: камера наводится на выбранный шкаф, Гоша подходит к нему
   * по маршруту и либо идёт дальше, либо упирается.
   * @param {number} cabIndex выбранный шкаф
   * @param {boolean} pass пройдёт ли он
   * @returns {Promise<void>} завершается, когда сцена доиграна
   */
  playCheck(cabIndex, pass) {
    const cab = this.cabinets[cabIndex];
    const pts = this.routes.good.length > 1 ? this.routes.good : this.routes.bad;
    if (!cab || pts.length < 2) return Promise.resolve();

    const target = { x: cab.x + cab.w / 2, y: cab.y + cab.h / 2 };
    this.focusOn({ x: target.x - 9, y: target.y - 9, w: 18, h: 18 }, 1.1);

    const { path, targetDist } = buildApproach(pts, target);

    return new Promise((resolve) => {
      this.gosha.start(path, targetDist, pass, () => {
        this.gosha.idle(this.routes[this.activeRoute]);
        resolve();
      });
      this.startAnimation();
    });
  }

  setHintZoneVisible(visible) {
    this.showHintZone = visible;
    if (visible && this.hintZone) this.focusOn(this.hintZone);
    this.requestDraw();
  }

  // ------------------------------------------------------------------ выбор

  clearSelection() {
    if (this.selected.size === 0) return;
    this.selected.clear();
    this._emitSelection();
    this.requestDraw();
  }

  toggleCabinet(idx) {
    if (idx < 0) return;
    if (this.selected.has(idx)) this.selected.delete(idx);
    else this.selected.add(idx);
    this._emitSelection();
    this.requestDraw();
  }

  getSelection() {
    return Array.from(this.selected).sort((a, b) => a - b);
  }

  _emitSelection() {
    if (this.hooks.onSelectionChange) this.hooks.onSelectionChange(this.selected);
  }

  // ------------------------------------------------------------- вид/камера

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);

    this.minScale = this._fitScale() * MIN_SCALE_FACTOR;
    if (this.scale < this.minScale) this.scale = this.minScale;
    this._clampOrigin();
    this.requestDraw();
  }

  _fitScale() {
    if (this.width === 0) return 1;
    return Math.min(this.width / WORLD_W, this.height / (WORLD_H * Y_SQUEEZE));
  }

  fit() {
    this.scale = this._fitScale();
    this.minScale = this.scale * MIN_SCALE_FACTOR;
    this.originX = (this.width - WORLD_W * this.scale) / 2;
    this.originY = (this.height - WORLD_H * Y_SQUEEZE * this.scale) / 2;
    this._emitView();
    this.requestDraw();
  }

  /** Плавно приблизиться к прямоугольнику мира (используется подсказкой). */
  focusOn(rect, padding = 1.6) {
    const targetScale = Math.min(
      this.width / (rect.w * padding),
      this.height / (rect.h * Y_SQUEEZE * padding),
      MAX_SCALE
    );
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    this._animateTo(targetScale, cx, cy);
  }

  zoomBy(factor, anchorX, anchorY) {
    const ax = anchorX === undefined ? this.width / 2 : anchorX;
    const ay = anchorY === undefined ? this.height / 2 : anchorY;

    const next = Math.max(this.minScale, Math.min(MAX_SCALE, this.scale * factor));
    if (next === this.scale) return;

    // Точка мира под якорем должна остаться на месте.
    const wx = (ax - this.originX) / this.scale;
    const wy = (ay - this.originY) / (this.scale * Y_SQUEEZE);

    this.scale = next;
    this.originX = ax - wx * this.scale;
    this.originY = ay - wy * this.scale * Y_SQUEEZE;

    this._clampOrigin();
    this._emitView();
    this.requestDraw();
  }

  _animateTo(targetScale, worldCx, worldCy) {
    const startScale = this.scale;
    const startX = this.originX;
    const startY = this.originY;

    const endScale = Math.max(this.minScale, Math.min(MAX_SCALE, targetScale));
    const endX = this.width / 2 - worldCx * endScale;
    const endY = this.height / 2 - worldCy * endScale * Y_SQUEEZE;

    const t0 = performance.now();
    const dur = 420;

    const step = (now) => {
      if (this._destroyed) return;
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      this.scale = startScale + (endScale - startScale) * e;
      this.originX = startX + (endX - startX) * e;
      this.originY = startY + (endY - startY) * e;
      this._clampOrigin();
      this.draw();
      if (t < 1) requestAnimationFrame(step);
      else this._emitView();
    };

    requestAnimationFrame(step);
  }

  /** Не даём утащить карту за пределы экрана. */
  _clampOrigin() {
    const w = WORLD_W * this.scale;
    const h = WORLD_H * Y_SQUEEZE * this.scale;
    const marginX = Math.min(this.width * 0.5, w * 0.5);
    const marginY = Math.min(this.height * 0.5, h * 0.5);

    this.originX = Math.min(this.width - marginX, Math.max(marginX - w, this.originX));
    this.originY = Math.min(this.height - marginY, Math.max(marginY - h, this.originY));
  }

  _emitView() {
    if (this.hooks.onViewChange) {
      this.hooks.onViewChange({
        scale: this.scale,
        minScale: this.minScale,
        maxScale: MAX_SCALE,
        canZoomIn: this.scale < MAX_SCALE - 1e-6,
        canZoomOut: this.scale > this.minScale + 1e-6,
      });
    }
  }

  // ------------------------------------------------------------------ ввод

  _toWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    return {
      x: (px - this.originX) / this.scale,
      y: (py - this.originY) / (this.scale * Y_SQUEEZE),
      px,
      py,
    };
  }

  _bindEvents() {
    const c = this.canvas;

    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this._pointers.size === 1) {
        this._gesture = {
          mode: 'pan',
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          startTime: performance.now(),
          moved: 0,
        };
      } else if (this._pointers.size === 2) {
        const [a, b] = Array.from(this._pointers.values());
        this._gesture = {
          mode: 'pinch',
          startDist: Math.hypot(a.x - b.x, a.y - b.y),
          startScale: this.scale,
          lastMidX: (a.x + b.x) / 2,
          lastMidY: (a.y + b.y) / 2,
          moved: 999, // жест-масштабирование никогда не считается тапом
        };
      }
    });

    c.addEventListener('pointermove', (e) => {
      if (!this._pointers.has(e.pointerId)) return;
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = this._gesture;
      if (!g) return;

      if (g.mode === 'pan' && this._pointers.size === 1) {
        const dx = e.clientX - g.lastX;
        const dy = e.clientY - g.lastY;
        g.lastX = e.clientX;
        g.lastY = e.clientY;
        g.moved += Math.abs(dx) + Math.abs(dy);
        this.originX += dx;
        this.originY += dy;
        this._clampOrigin();
        this.requestDraw();
      } else if (g.mode === 'pinch' && this._pointers.size >= 2) {
        const [a, b] = Array.from(this._pointers.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;

        // Панорамирование за счёт смещения середины между пальцами.
        this.originX += midX - g.lastMidX;
        this.originY += midY - g.lastMidY;
        g.lastMidX = midX;
        g.lastMidY = midY;

        if (g.startDist > 0) {
          const rect = c.getBoundingClientRect();
          const target = g.startScale * (dist / g.startDist);
          const factor = target / this.scale;
          this.zoomBy(factor, midX - rect.left, midY - rect.top);
        } else {
          this._clampOrigin();
          this.requestDraw();
        }
      }
    });

    const endPointer = (e) => {
      const g = this._gesture;
      this._pointers.delete(e.pointerId);

      if (g && g.mode === 'pan' && this._pointers.size === 0) {
        const dt = performance.now() - g.startTime;
        // Короткое касание почти без смещения — это тап по шкафу.
        if (g.moved < 10 && dt < 600) {
          this._handleTap(e.clientX, e.clientY);
        }
      }

      if (this._pointers.size === 0) {
        this._gesture = null;
      } else if (this._pointers.size === 1) {
        const [only] = Array.from(this._pointers.values());
        this._gesture = {
          mode: 'pan',
          startX: only.x,
          startY: only.y,
          lastX: only.x,
          lastY: only.y,
          startTime: performance.now(),
          moved: 999,
        };
      }
    };

    c.addEventListener('pointerup', endPointer);
    c.addEventListener('pointercancel', endPointer);

    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = c.getBoundingClientRect();
        const factor = Math.exp(-e.deltaY * 0.0015);
        this.zoomBy(factor, e.clientX - rect.left, e.clientY - rect.top);
      },
      { passive: false }
    );

    c.addEventListener('dblclick', (e) => {
      const rect = c.getBoundingClientRect();
      this.zoomBy(1.8, e.clientX - rect.left, e.clientY - rect.top);
    });

    // Браузер не должен превращать жесты по карте в скролл страницы.
    c.style.touchAction = 'none';
  }

  _handleTap(clientX, clientY) {
    if (!this.grid) return;
    const w = this._toWorld(clientX, clientY);

    // Радиус захвата: ~22 CSS-пикселя, переведённые в единицы мира.
    // На отдалении это перекрывает несколько шкафов — берём ближайший.
    const radiusX = Math.max(0.6, 22 / this.scale);
    const radiusY = Math.max(1.2, 22 / (this.scale * Y_SQUEEZE));

    const idx = this.grid.pick(w.x, w.y, radiusX, radiusY);
    if (idx >= 0) this.toggleCabinet(idx);
  }

  _observeResize() {
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', () => this.resize());
      return;
    }
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this.canvas);
  }

  // --------------------------------------------------------------- отрисовка

  requestDraw() {
    if (this._frame) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = null;
      this.draw();
    });
  }

  startAnimation() {
    if (this._animating) return;
    this._animating = true;
    this._lastTick = performance.now();
    const tick = () => {
      if (!this._animating || this._destroyed) return;
      const now = performance.now();
      this._dashPhase -= 0.35;
      this.gosha.update(now);
      this.draw();
      this._raf = requestAnimationFrame(tick);
    };
    tick();
  }

  stopAnimation() {
    this._animating = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx || this.width === 0) return;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = COLORS.outside;
    ctx.fillRect(0, 0, this.width, this.height);

    const s = this.scale;
    const sy = s * Y_SQUEEZE;
    const ox = this.originX;
    const oy = this.originY;

    // Видимая область в координатах мира — всё за её пределами не рисуем.
    const viewX0 = -ox / s - 2;
    const viewX1 = (this.width - ox) / s + 2;
    const viewY0 = -oy / sy - 4;
    const viewY1 = (this.height - oy) / sy + 4;

    this._drawBounds(ctx, ox, oy, s, sy);
    this._drawObstacles(ctx, ox, oy, s, sy, viewX0, viewX1, viewY0, viewY1);
    this._drawCabinets(ctx, ox, oy, s, sy, viewX0, viewX1, viewY0, viewY1);

    if (this.showHintZone && this.hintZone) {
      this._drawHintZone(ctx, ox, oy, s, sy);
    }

    this._drawRoute(ctx, ox, oy, s, sy);
    this._drawSelectionMarkers(ctx, ox, oy, s, sy);
    this.gosha.draw(ctx, ox, oy, s, sy, performance.now());
  }

  _drawBounds(ctx, ox, oy, s, sy) {
    if (!this.bounds) return;
    const b = this.bounds;
    const x = ox + b.x * s;
    const y = oy + b.y * sy;
    const w = b.w * s;
    const h = b.h * sy;

    ctx.save();
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(x, y, w, h);

    // Разметка пола: шаг сетки равен шагу колонн стеллажей, поэтому проходы
    // читаются как проходы, а не как пустая заливка.
    const step = 5.04 * s;
    if (step >= 14) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.strokeStyle = COLORS.floorLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = x; gx <= x + w; gx += step) {
        ctx.moveTo(Math.round(gx) + 0.5, y);
        ctx.lineTo(Math.round(gx) + 0.5, y + h);
      }
      const stepY = 5.04 * sy;
      for (let gy = y; gy <= y + h; gy += stepY) {
        ctx.moveTo(x, Math.round(gy) + 0.5);
        ctx.lineTo(x + w, Math.round(gy) + 0.5);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.strokeStyle = COLORS.bounds;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  _drawObstacles(ctx, ox, oy, s, sy, x0, x1, y0, y1) {
    if (this.obstacles.length === 0) return;
    ctx.fillStyle = COLORS.obstacle;
    ctx.beginPath();
    for (const obs of this.obstacles) {
      if (obs.x > x1 || obs.x + obs.w < x0 || obs.y > y1 || obs.y + obs.h < y0) continue;
      ctx.rect(ox + obs.x * s, oy + obs.y * sy, obs.w * s, obs.h * sy);
    }
    ctx.fill();
    ctx.strokeStyle = COLORS.obstacleEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Шкафы рисуются пачками по цвету: накапливаем прямоугольники в один путь
   * и заливаем разом. Смена состояния контекста — самая дорогая операция,
   * поэтому их тут ровно столько, сколько цветов.
   */
  /**
   * Шкафы рисуются пачками по материалу: прямоугольники накапливаются в один
   * путь и заливаются разом. Смена состояния контекста — самая дорогая
   * операция, поэтому их тут ровно столько, сколько материалов.
   *
   * Уровни детализации подобраны по экранному размеру шкафа: на общем плане
   * это просто плитки, ближе появляются контур и объём, ещё ближе — грань
   * подхода и скругления.
   */
  _drawCabinets(ctx, ox, oy, s, sy, x0, x1, y0, y1) {
    const cabs = this.cabinets;
    const cellW = 0.84 * s;
    const cellH = 1.68 * sy;
    const minSide = Math.min(cellW, cellH);

    const showEdges = minSide >= 2.5;
    const showDetail = minSide >= DETAIL_THRESHOLD_PX;
    const showRound = minSide >= 14 && HAS_ROUND_RECT;

    const normal = [];
    const blind = [];
    const picks = [];

    for (let i = 0; i < cabs.length; i++) {
      const c = cabs[i];
      if (c.x > x1 || c.x + c.w < x0 || c.y > y1 || c.y + c.h < y0) continue;
      if (this.pickSet.has(i)) picks.push(i);
      else if (c.facing === 'none') blind.push(i);
      else normal.push(i);
    }

    const radius = showRound ? Math.min(3, minSide * 0.14) : 0;

    const addRect = (c) => {
      const px = ox + c.x * s;
      const py = oy + c.y * sy;
      const pw = Math.max(c.w * s, 1);
      const ph = Math.max(c.h * sy, 1);
      if (radius > 0) ctx.roundRect(px, py, pw, ph, radius);
      else ctx.rect(px, py, pw, ph);
    };

    const fillGroup = (list, color) => {
      if (list.length === 0) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const i of list) addRect(cabs[i]);
      ctx.fill();
    };

    fillGroup(normal, COLORS.cabinet);
    fillGroup(picks, COLORS.pick);

    // Глухие блоки светлее пола, но темнее обычных шкафов, и всегда с контуром:
    // одной заливкой они терялись на фоне.
    if (blind.length > 0) {
      const hatched = minSide >= DETAIL_THRESHOLD_PX;
      ctx.fillStyle = hatched ? getHatch(ctx, COLORS.blind, COLORS.blindEdge) : COLORS.blind;
      ctx.beginPath();
      for (const i of blind) addRect(cabs[i]);
      ctx.fill();
      if (showEdges) {
        ctx.strokeStyle = COLORS.blindEdge;
        ctx.lineWidth = Math.min(1.25, minSide * 0.12);
        ctx.stroke();
      }
    }

    if (!showDetail) {
      this._drawPickMarkers(ctx, ox, oy, s, sy, picks);
      return;
    }

    const bevel = Math.max(1, Math.min(2.5, cellH * 0.1));
    this._detailRacks(ctx, ox, oy, s, sy, normal, picks, bevel);
    this._drawFacings(ctx, ox, oy, s, sy, x0, x1, y0, y1, minSide);
  }

  /**
   * Корпус стеллажа: блик по верхней грани, тень по нижней, контур и полки
   * внутри. Полки появляются только когда между ними остаётся хотя бы
   * несколько пикселей — иначе они сливаются в грязь.
   */
  _detailRacks(ctx, ox, oy, s, sy, normal, picks, bevel) {
    const cabs = this.cabinets;
    const all = normal.concat(picks);

    const strip = (list, color, atBottom) => {
      if (!list.length) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const i of list) {
        const c = cabs[i];
        const y = atBottom ? oy + (c.y + c.h) * sy - bevel : oy + c.y * sy;
        ctx.rect(ox + c.x * s, y, c.w * s, bevel);
      }
      ctx.fill();
    };

    strip(normal, COLORS.cabinetTop, false);
    strip(picks, COLORS.pickTop, false);
    strip(normal, COLORS.cabinetShade, true);

    ctx.strokeStyle = COLORS.cabinetEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const i of all) {
      const c = cabs[i];
      ctx.rect(ox + c.x * s, oy + c.y * sy, c.w * s, c.h * sy);
    }
    ctx.stroke();

    const shelfGap = (1.68 * sy) / 3;
    if (shelfGap < 5) return;

    ctx.strokeStyle = 'rgba(19,32,56,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const i of all) {
      const c = cabs[i];
      const px = ox + c.x * s;
      const pw = c.w * s;
      for (let k = 1; k < 3; k++) {
        const py = Math.round(oy + (c.y + (c.h * k) / 3) * sy) + 0.5;
        ctx.moveTo(px + 1, py);
        ctx.lineTo(px + pw - 1, py);
      }
    }
    ctx.stroke();
  }

  /** Грань подхода — ключевая информация уровня, рисуется поверх любого стиля. */
  _drawFacings(ctx, ox, oy, s, sy, x0, x1, y0, y1, minSide) {
    const cabs = this.cabinets;
    const stripe = Math.max(1.5, Math.min(3.5, minSide * 0.16));
    const facing = [];
    for (let k = 0; k < cabs.length; k++) {
      const c = cabs[k];
      if (c.x > x1 || c.x + c.w < x0 || c.y > y1 || c.y + c.h < y0) continue;
      if (!c.facing || c.facing === 'none') continue;
      facing.push(k);
    }
    if (facing.length === 0) return;

    const rect = (c, thickness, outward) => {
      const px = ox + c.x * s;
      const py = oy + c.y * sy;
      const pw = c.w * s;
      const ph = c.h * sy;
      switch (c.facing) {
        case 'bottom':
          return [px, py + ph - thickness + outward, pw, thickness];
        case 'top':
          return [px, py - outward, pw, thickness];
        case 'left':
          return [px - outward, py, thickness, ph];
        default:
          return [px + pw - thickness + outward, py, thickness, ph];
      }
    };

    if (minSide >= 12) {
      ctx.fillStyle = COLORS.facingGlow;
      ctx.beginPath();
      for (const k of facing) ctx.rect(...rect(cabs[k], stripe * 2.2, stripe));
      ctx.fill();
    }

    ctx.fillStyle = COLORS.facing;
    ctx.beginPath();
    for (const k of facing) ctx.rect(...rect(cabs[k], stripe, 0));
    ctx.fill();
  }

  /**
   * На общем плане шкаф занимает 2-3 пикселя, и цели маршрута теряются.
   * Рисуем их точками фиксированного минимального размера.
   */
  _drawPickMarkers(ctx, ox, oy, s, sy, picks) {
    if (picks.length === 0 || 0.84 * s >= MIN_PICK_MARKER_PX) return;
    const cabs = this.cabinets;
    const r = MIN_PICK_MARKER_PX / 2;
    ctx.fillStyle = COLORS.pick;
    ctx.beginPath();
    for (const i of picks) {
      const c = cabs[i];
      const cx = ox + (c.x + c.w / 2) * s;
      const cy = oy + (c.y + c.h / 2) * sy;
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  _drawHintZone(ctx, ox, oy, s, sy) {
    const z = this.hintZone;
    ctx.save();
    ctx.fillStyle = COLORS.hintZone;
    ctx.strokeStyle = COLORS.hintStroke;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = this._dashPhase;
    const x = ox + z.x * s;
    const y = oy + z.y * sy;
    ctx.fillRect(x, y, z.w * s, z.h * sy);
    ctx.strokeRect(x, y, z.w * s, z.h * sy);
    ctx.restore();
  }

  _drawRoute(ctx, ox, oy, s, sy) {
    const pts = this.routes[this.activeRoute];
    if (!pts || pts.length < 2) return;

    const color = this.activeRoute === 'good' ? COLORS.routeGood : COLORS.routeBad;
    const width = Math.max(2, Math.min(6, s * 0.05));

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(ox + pts[0].x * s, oy + pts[0].y * sy);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(ox + pts[i].x * s, oy + pts[i].y * sy);
    }

    // Тёмная подложка, чтобы линия читалась поверх зелёных целевых шкафов.
    ctx.strokeStyle = 'rgba(3,7,15,0.75)';
    ctx.lineWidth = width + 3;
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();

    // «Бегущие муравьи» показывают направление обхода без ожидания анимации
    // отрисовки — прежняя версия проявляла маршрут 13 секунд.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, width * 0.4);
    ctx.setLineDash([width * 1.5, width * 2.5]);
    ctx.lineDashOffset = this._dashPhase;
    ctx.stroke();
    ctx.setLineDash([]);

    // Точка старта маршрута.
    const start = pts[0];
    const sxp = ox + start.x * s;
    const syp = oy + start.y * sy;
    ctx.fillStyle = COLORS.routeStart;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(sxp, syp, Math.max(4, width * 1.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  _drawSelectionMarkers(ctx, ox, oy, s, sy) {
    if (this.selected.size === 0) return;
    const cabs = this.cabinets;

    ctx.save();

    // Заливка самих шкафов.
    ctx.fillStyle = COLORS.selectedFill;
    ctx.beginPath();
    for (const i of this.selected) {
      const c = cabs[i];
      if (!c) continue;
      ctx.rect(ox + c.x * s, oy + c.y * sy, c.w * s, c.h * sy);
    }
    ctx.fill();

    // Кольцо фиксированного минимального размера — видно при любом зуме.
    ctx.strokeStyle = COLORS.selected;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const i of this.selected) {
      const c = cabs[i];
      if (!c) continue;
      const cx = ox + (c.x + c.w / 2) * s;
      const cy = oy + (c.y + c.h / 2) * sy;
      const r = Math.max(MIN_MARKER_PX / 2, (c.w * s) / 2 + 3);
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.stroke();

    ctx.restore();
  }

  destroy() {
    this._destroyed = true;
    this.stopAnimation();
    if (this._frame) cancelAnimationFrame(this._frame);
    if (this._ro) this._ro.disconnect();
  }
}
