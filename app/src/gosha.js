/**
 * Гоша-дежурный: подходит к выбранному шкафу и сверяет его настройку с
 * маршрутом. Сцена показывает результат проверки, а не физическое
 * столкновение со стеллажом.
 *
 * Корпус перерисован по Гоше из соседней Pac-Man игры: тот же объёмный стиль,
 * но без гарнитуры и бейджа, в рабочем комбинезоне и сигнальном жилете.
 * Ноги и рохля остаются отдельными Canvas-слоями, чтобы шаг и колёса можно
 * было анимировать независимо от растрового корпуса.
 *
 * Гоша живёт только во время проверки решения. Постоянно шагающая по всему
 * маршруту фигура на общем плане занимала тридцать пикселей и терялась, а
 * дойти до нужного места ей требовалось секунд двадцать.
 */

import bodyUrl from './assets/gosha/gosha-worker-body.png';
import { drawStatusIcon } from './icons.js';

// Подход к шкафу — буквально несколько шагов: камера уже наведена, длинный
// разбег только тянул бы время.
const APPROACH = 11;
const STRIDE = 3.2;      // длина шага в единицах мира, отсюда ~3.5 шага

const APPROACH_MS = 1500; // неспешно, чтобы было видно сами шаги
const RESULT_MS = 1400;   // пауза у шкафа: реплику должно быть легко прочесть

const SAY = {
  correct: 'Ошибка найдена!',
  retry: 'Проверю ещё раз',
};

const LEG_RATIO = 0.22;

const COLORS = {
  leg: '#fec700',
  legShade: '#e7a800',
  pants: '#17355d',
  pantsLight: '#254d7d',
  pantsEdge: '#0d2340',
  jack: '#f5a524',
  jackLight: '#ffc247',
  jackDark: '#b96512',
  steel: '#94a6c4',
  steelDark: '#34445d',
  wheel: '#202a38',
  wheelSide: '#56647a',
  wheelHub: '#dce5ef',
  pallet: '#9b6235',
  palletTop: '#d39a5d',
  palletEdge: '#6f4328',
  cargo: '#3478d4',
  cargoLight: '#72a8ee',
  cargoDark: '#1e4f96',
};

export class Gosha {
  constructor() {
    this.body = new Image();
    this.body.src = bodyUrl;

    this.path = [];
    this.lengths = [];
    this.total = 0;

    this.visible = false;
    this.phase = null;   // 'run' | 'result' | 'idle'
    this.dist = 0;
    this.from = 0;
    this.to = 0;
    this.startedAt = 0;
    this.duration = 0;
    this.correct = false;
    this.onOutcome = null;
    this.onDone = null;
  }

  get ready() {
    return this.body.complete && this.body.naturalWidth > 0;
  }

  _measure(points) {
    this.path = points || [];
    this.lengths = [];
    this.total = 0;
    for (let i = 1; i < this.path.length; i++) {
      // Сжатие по Y не учитываем: скорость должна быть равномерной в
      // координатах мира, а не в экранных.
      const dx = this.path[i].x - this.path[i - 1].x;
      const dy = this.path[i].y - this.path[i - 1].y;
      const len = Math.hypot(dx, dy);
      this.lengths.push(len);
      this.total += len;
    }
  }

  /**
   * Запускает проверку выбранного шкафа.
   * @param {{x:number,y:number}[]} points маршрут
   * @param {number} targetDist расстояние по маршруту до выбранного шкафа
   * @param {boolean} correct верно ли игрок определил проблемный шкаф
   * @param {() => void} [onOutcome] в момент появления результата
   * @param {() => void} onDone вызывается, когда сцена доиграна
   */
  start(points, targetDist, correct, onOutcome, onDone) {
    this._measure(points);
    if (this.total === 0) {
      onDone?.();
      return;
    }

    this.to = Math.max(0, Math.min(targetDist, this.total));
    this.from = Math.max(0, this.to - APPROACH);
    this.dist = this.from;
    this.correct = correct;
    this.onOutcome = onOutcome;
    this.onDone = onDone;
    this.phase = 'run';
    this.startedAt = performance.now();
    this.duration = APPROACH_MS;
    this.visible = true;
  }

  /**
   * Ожидание: Гоша стоит в начале маршрута. Без этого он существовал только
   * три секунды во время проверки, и на карте его было попросту не найти.
   */
  idle(points) {
    this._measure(points);
    this.dist = 0;
    this.phase = 'idle';
    this.onDone = null;
    this.visible = this.total > 0;
  }

  stop() {
    this.visible = false;
    this.phase = null;
    this.onDone = null;
  }

  _pointAt(dist) {
    if (this.path.length < 2) return null;
    let d = Math.max(0, Math.min(dist, this.total));
    for (let i = 0; i < this.lengths.length; i++) {
      if (d <= this.lengths[i] || i === this.lengths.length - 1) {
        const a = this.path[i];
        const b = this.path[i + 1];
        const t = this.lengths[i] > 0 ? d / this.lengths[i] : 0;
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          dx: b.x - a.x,
          dy: b.y - a.y,
        };
      }
      d -= this.lengths[i];
    }
    return null;
  }

  update(now) {
    if (!this.visible || !this.phase || this.phase === 'idle') return;

    const t = Math.min(1, (now - this.startedAt) / this.duration);

    if (this.phase === 'run') {
      const e = 1 - Math.pow(1 - t, 1.5); // чуть притормаживает у шкафа
      this.dist = this.from + (this.to - this.from) * e;
      if (t >= 1) {
        this.phase = 'result';
        this.duration = RESULT_MS;
        this.startedAt = now;
        const outcome = this.onOutcome;
        this.onOutcome = null;
        outcome?.();
      }
      return;
    }

    if (this.phase === 'result' && t >= 1) this._finish();
  }

  /**
   * Сцена доиграна. Гоша остаётся стоять там, где закончил, — не в начале
   * маршрута: камера в этот момент наведена на шкаф, и возврат к началу
   * попросту уносил его за край экрана.
   */
  _finish() {
    this.phase = 'idle';
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  draw(ctx, ox, oy, s, sy, now) {
    if (!this.visible || !this.ready || this.path.length < 2) return;
    const at = this._pointAt(this.dist);
    if (!at) return;

    // Полная высота фигуры. Во время сцены камера уже наведена на шкаф, так
    // что упереться в верхнюю границу — нормально: Гоша должен читаться как
    // персонаж, а не как метка на плане.
    const H = Math.max(42, Math.min(120, 5 * s));
    let px = ox + at.x * s;
    const py = oy + at.y * sy;

    // Фаза шага и оборот колёс привязаны к пройденному пути. При остановке у
    // шкафа ни ноги, ни рохля не продолжают жить своей жизнью.
    const walking = this.phase === 'run';
    const standing = !walking;
    const stepPhase = (this.dist / STRIDE) * Math.PI * 2;
    const wheelPhase = this.dist * 3.4;
    const goingLeft = at.dx < 0;

    ctx.save();
    ctx.translate(px, py);
    if (goingLeft) ctx.scale(-1, 1);

    this._drawPallet(ctx, H, wheelPhase);
    this._drawLegs(ctx, H, stepPhase, standing);
    // Стоя Гоша чуть покачивается — иначе выглядит забытой на карте меткой.
    this._drawBody(ctx, H, standing ? now / 900 : stepPhase);

    ctx.restore();

    if (this.phase === 'result') {
      const t = (now - this.startedAt) / this.duration;
      // Карточка должна читаться всё время паузы. Раньше затухание начиналось
      // слишком рано, и над светлыми шкафами текст выглядел полупрозрачным.
      const alpha = Math.min(1, 0.78 + t * 3);
      this._drawBubble(
        ctx,
        px,
        py - H * 1.05,
        H,
        this.correct ? SAY.correct : SAY.retry,
        this.correct,
        alpha
      );
    }
  }

  /**
   * Промо-сцена для приветственных экранов. Использует те же слои, что и
   * персонаж на карте: корпус, шагающие ноги, рохлю, груз и колёса. Так
   * иллюстрация в меню не расходится с тем, что игрок затем видит в уровне.
   */
  drawShowcase(ctx, x, floorY, H, now) {
    if (!this.ready) return;

    const stepPhase = now / 360;
    const wheelPhase = now / 85;

    ctx.save();
    ctx.translate(x, floorY);
    this._drawPallet(ctx, H, wheelPhase);
    this._drawLegs(ctx, H, stepPhase, false);
    this._drawBody(ctx, H, stepPhase);
    ctx.restore();
  }

  /**
   * Реплика Гоши — компактная статусная карточка в стиле интерфейса игры.
   * Хвост входит в единый контур: нижняя граница не проходит сквозь него и
   * больше не образует две наложенные линии.
   */
  _drawBubble(ctx, px, py, H, text, good, alpha) {
    const fs = Math.max(11, H * 0.15);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const iconR = fs * 0.62;
    const padX = fs * 0.68;
    const gap = fs * 0.55;
    const w = ctx.measureText(text).width + padX * 2 + iconR * 2 + gap;
    const h = Math.max(32, fs * 2.25);
    const r = Math.min(11, h * 0.34);
    const tailHalf = Math.max(4, fs * 0.38);
    const tailH = Math.max(6, fs * 0.5);

    // Canvas хранит физические пиксели, а сцена рисуется в CSS-пикселях.
    // Ограничение по ширине не даёт карточке обрезаться у края карты.
    const transformScale = Math.abs(ctx.getTransform().a) || 1;
    const viewW = ctx.canvas.width / transformScale;
    const margin = 8;
    const centerX = Math.max(w / 2 + margin, Math.min(viewW - w / 2 - margin, px));
    const x = centerX - w / 2;
    const y = Math.max(margin, py - h - tailH);
    const bottom = y + h;
    const tailCenter = Math.max(
      x + r + tailHalf,
      Math.min(x + w - r - tailHalf, px)
    );

    // Скруглённая карточка и хвост — один путь без внутренней границы.
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, bottom - r);
    ctx.quadraticCurveTo(x + w, bottom, x + w - r, bottom);
    ctx.lineTo(tailCenter + tailHalf, bottom);
    ctx.lineTo(px, bottom + tailH);
    ctx.lineTo(tailCenter - tailHalf, bottom);
    ctx.lineTo(x + r, bottom);
    ctx.quadraticCurveTo(x, bottom, x, bottom - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    const accent = good ? '#36d98b' : '#f5a524';
    ctx.fillStyle = '#101d31';
    ctx.shadowColor = 'rgba(0,0,0,0.48)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = good ? 'rgba(54,217,139,0.82)' : 'rgba(245,165,36,0.82)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const iconX = x + padX + iconR;
    const centerY = y + h / 2;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(iconX, centerY, iconR, 0, Math.PI * 2);
    ctx.fill();

    // Ровно тот же вектор используется в модальном окне результата.
    ctx.strokeStyle = '#08111f';
    drawStatusIcon(
      ctx,
      good ? 'check' : 'retry',
      iconX,
      centerY,
      iconR * 1.48,
      Math.max(1.5, fs * 0.13)
    );

    ctx.fillStyle = '#edf4ff';
    ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(text, iconX + iconR + gap, centerY);
    ctx.restore();
  }

  /**
   * Полноценная рохля позади Гоши: вилы, гидроузел, рукоять, поддон и груз.
   * Спицы и светлая метка на шинах вращаются вместе с пройденным расстоянием.
   */
  _drawPallet(ctx, H, wheelPhase) {
    const tail = -H * 1.43;
    const head = -H * 0.54;
    const floorY = -H * 0.025;
    const deckY = floorY - H * 0.13;
    const loadX = tail + H * 0.07;
    const loadW = head - tail - H * 0.15;

    const rounded = (x, y, w, h, r) => {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
    };

    const wheel = (x, y, r, angle) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      ctx.fillStyle = COLORS.wheel;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.wheelSide;
      ctx.lineWidth = Math.max(1, r * 0.24);
      ctx.stroke();

      ctx.strokeStyle = COLORS.wheelHub;
      ctx.lineWidth = Math.max(0.8, r * 0.16);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.24, Math.sin(a) * r * 0.24);
        ctx.lineTo(Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68);
        ctx.stroke();
      }
      ctx.fillStyle = COLORS.jackLight;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Светлая риска делает вращение заметным даже у маленького колеса.
      ctx.strokeStyle = '#f4f7fb';
      ctx.lineWidth = Math.max(1, r * 0.13);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.82, -0.3, 0.42);
      ctx.stroke();
      ctx.restore();
    };

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Мягкая тень связывает мелкие детали рохли с полом.
    const shadow = ctx.createLinearGradient(tail, 0, head, 0);
    shadow.addColorStop(0, 'rgba(0,0,0,0.08)');
    shadow.addColorStop(0.45, 'rgba(0,0,0,0.38)');
    shadow.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse((tail + head) / 2, floorY + H * 0.035, (head - tail) * 0.57, H * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();

    // Коробки: две разнесённые лицевые плоскости лучше читаются на масштабе,
    // чем прежний одноцветный прямоугольник.
    const boxBottom = deckY - H * 0.085;
    const boxH = H * 0.28;
    const cargoGradient = ctx.createLinearGradient(0, boxBottom - boxH, 0, boxBottom);
    cargoGradient.addColorStop(0, COLORS.cargoLight);
    cargoGradient.addColorStop(0.18, COLORS.cargo);
    cargoGradient.addColorStop(1, COLORS.cargoDark);
    ctx.fillStyle = cargoGradient;
    rounded(loadX, boxBottom - boxH, loadW, boxH, H * 0.035);
    ctx.fill();
    ctx.strokeStyle = '#174178';
    ctx.lineWidth = Math.max(1, H * 0.012);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = Math.max(1, H * 0.012);
    ctx.beginPath();
    ctx.moveTo(loadX + loadW * 0.5, boxBottom - boxH + H * 0.025);
    ctx.lineTo(loadX + loadW * 0.5, boxBottom - H * 0.025);
    ctx.stroke();
    ctx.fillStyle = 'rgba(235,244,255,0.78)';
    rounded(loadX + loadW * 0.12, boxBottom - boxH * 0.68, loadW * 0.22, boxH * 0.18, H * 0.012);
    ctx.fill();

    // Деревянный поддон с отдельными верхними планками и тёмными кубиками.
    ctx.fillStyle = COLORS.palletTop;
    rounded(tail, deckY - H * 0.08, head - tail, H * 0.09, H * 0.018);
    ctx.fill();
    ctx.strokeStyle = COLORS.palletEdge;
    ctx.lineWidth = Math.max(1, H * 0.012);
    ctx.stroke();
    ctx.fillStyle = COLORS.pallet;
    for (const x of [tail + H * 0.1, tail + (head - tail) * 0.5, head - H * 0.13]) {
      rounded(x - H * 0.045, deckY, H * 0.09, H * 0.075, H * 0.01);
      ctx.fill();
    }

    // Две вилы под поддоном — ближняя светлее, дальняя темнее.
    ctx.strokeStyle = COLORS.jackDark;
    ctx.lineWidth = Math.max(2, H * 0.045);
    ctx.beginPath();
    ctx.moveTo(head + H * 0.02, deckY + H * 0.085);
    ctx.lineTo(tail - H * 0.025, deckY + H * 0.085);
    ctx.stroke();
    ctx.strokeStyle = COLORS.jack;
    ctx.lineWidth = Math.max(2.5, H * 0.055);
    ctx.beginPath();
    ctx.moveTo(head, deckY + H * 0.035);
    ctx.lineTo(tail, deckY + H * 0.035);
    ctx.stroke();

    // Рулевой и грузовой ролики.
    wheel(head - H * 0.035, floorY, Math.max(2.2, H * 0.072), wheelPhase);
    wheel(tail + H * 0.095, floorY, Math.max(1.7, H * 0.047), wheelPhase * 1.48);

    // Гидроузел и настоящий петлевой хват вместо одной наклонной палочки.
    const gripX = -H * 0.27;
    const gripY = -H * 0.53;
    ctx.fillStyle = COLORS.jackDark;
    rounded(head - H * 0.08, deckY - H * 0.08, H * 0.16, H * 0.18, H * 0.035);
    ctx.fill();
    ctx.fillStyle = COLORS.jackLight;
    rounded(head - H * 0.048, deckY - H * 0.055, H * 0.096, H * 0.11, H * 0.025);
    ctx.fill();

    ctx.strokeStyle = COLORS.steelDark;
    ctx.lineWidth = Math.max(3, H * 0.045);
    ctx.beginPath();
    ctx.moveTo(head, deckY - H * 0.02);
    ctx.quadraticCurveTo(-H * 0.45, -H * 0.33, gripX, gripY);
    ctx.stroke();
    ctx.strokeStyle = COLORS.steel;
    ctx.lineWidth = Math.max(1, H * 0.012);
    ctx.beginPath();
    ctx.moveTo(head + H * 0.008, deckY - H * 0.025);
    ctx.quadraticCurveTo(-H * 0.44, -H * 0.33, gripX + H * 0.006, gripY);
    ctx.stroke();

    ctx.strokeStyle = COLORS.wheel;
    ctx.lineWidth = Math.max(3, H * 0.04);
    ctx.beginPath();
    ctx.ellipse(gripX, gripY, H * 0.13, H * 0.07, -0.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = COLORS.wheelSide;
    ctx.lineWidth = Math.max(1, H * 0.012);
    ctx.stroke();

    ctx.restore();
  }

  /** Две ноги в рабочем комбинезоне идут в противофазе. */
  _drawLegs(ctx, H, phase, standing = false) {
    const legH = H * LEG_RATIO;
    const hipY = -legH * 1.08;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const motion = standing ? 0 : Math.sin(phase + i * Math.PI);
      // У каждой ноги своя половина силуэта. Небольшой ход внутри неё даёт
      // читаемый шаг, но голени больше не могут пересечься крест-накрест.
      const stride = motion * legH * 0.13;
      const lift = standing ? 0 : Math.max(0, motion) * legH * 0.18;
      const hipX = side * H * 0.085;
      const cuffX = side * H * 0.095 + stride * 0.35;
      const cuffY = -legH * 0.56 - lift * 0.25;
      const ankleX = side * H * 0.105 + stride;
      const ankleY = -H * 0.022 - lift;

      // Короткие раздельные штанины повторяют низ комбинезона из исходного
      // Гоши, вместо двух длинных диагоналей, которые раньше образовывали X.
      ctx.strokeStyle = COLORS.pantsEdge;
      ctx.lineWidth = Math.max(4, H * 0.095);
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.quadraticCurveTo(hipX + stride * 0.12, -legH * 0.8, cuffX, cuffY);
      ctx.stroke();
      ctx.strokeStyle = i === 0 ? COLORS.pants : COLORS.pantsLight;
      ctx.lineWidth = Math.max(3, H * 0.069);
      ctx.stroke();

      // Тонкая почти вертикальная голень — как у полноразмерного Гоши из
      // Pac-Man. Дальняя нога чуть темнее, чтобы обе читались раздельно.
      ctx.strokeStyle = i === 0 ? COLORS.legShade : COLORS.leg;
      ctx.lineWidth = Math.max(2, H * 0.038);
      ctx.beginPath();
      ctx.moveTo(cuffX, cuffY + H * 0.012);
      ctx.quadraticCurveTo(
        cuffX + stride * 0.12,
        -legH * 0.24 - lift * 0.55,
        ankleX,
        ankleY - H * 0.015,
      );
      ctx.stroke();

      // Широкая перепончатая лапа. В спокойной стойке и во время шага дальняя
      // направлена назад, ближняя — вперёд, как на исходном полном силуэте.
      const footLen = legH * 0.88;
      const heel = legH * 0.2;
      ctx.save();
      ctx.translate(ankleX, ankleY);
      ctx.scale(side, 1);

      const footGrad = ctx.createLinearGradient(-heel, -H * 0.035, footLen, H * 0.02);
      footGrad.addColorStop(0, i === 0 ? COLORS.legShade : COLORS.leg);
      footGrad.addColorStop(1, '#ffd83b');
      ctx.fillStyle = footGrad;
      ctx.beginPath();
      ctx.moveTo(-heel, -H * 0.018);
      ctx.bezierCurveTo(
        footLen * 0.12,
        -H * 0.045,
        footLen * 0.62,
        -H * 0.035,
        footLen,
        -H * 0.006,
      );
      // Три мягких выступа формируют узнаваемую гусиную перепонку.
      ctx.quadraticCurveTo(footLen * 0.92, H * 0.018, footLen * 0.74, H * 0.014);
      ctx.quadraticCurveTo(footLen * 0.62, H * 0.035, footLen * 0.48, H * 0.015);
      ctx.quadraticCurveTo(footLen * 0.33, H * 0.034, footLen * 0.17, H * 0.012);
      ctx.lineTo(-heel * 0.62, H * 0.007);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(193, 132, 0, 0.48)';
      ctx.lineWidth = Math.max(0.8, H * 0.007);
      for (const toe of [0.42, 0.66]) {
        ctx.beginPath();
        ctx.moveTo(footLen * toe, -H * 0.006);
        ctx.lineTo(footLen * (toe + 0.07), H * 0.012);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  _drawBody(ctx, H, phase) {
    const legH = H * LEG_RATIO;
    const bodyH = H - legH;
    // Пропорции берём у самой картинки: константа разъезжается, как только
    // спрайт заменят или обрежут.
    const aspect = this.body.naturalHeight
      ? this.body.naturalWidth / this.body.naturalHeight
      : 0.8;
    const bodyW = bodyH * aspect;
    const bob = Math.abs(Math.sin(phase)) * H * 0.022;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = H * 0.18;
    ctx.shadowOffsetY = H * 0.05;
    ctx.drawImage(this.body, -bodyW / 2, -legH - bodyH + bob, bodyW, bodyH);
    ctx.restore();
  }

}

/**
 * Запускает лёгкие прозрачные Canvas-превью на текущем экране. Цикл сам
 * завершится после замены DOM, поэтому при переходе в игру ничего чистить не
 * требуется.
 */
export function mountGoshaShowcases(root = document) {
  root.querySelectorAll('[data-gosha-showcase]').forEach((canvas) => {
    const gosha = new Gosha();
    const ctx = canvas.getContext('2d');
    let lastWidth = 0;
    let lastHeight = 0;

    const frame = (now) => {
      if (!canvas.isConnected) return;

      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      if (width !== lastWidth || height !== lastHeight) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        lastWidth = width;
        lastHeight = height;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const H = Math.min(height * 0.9, width / 1.92);
      const x = H * 1.48 + Math.max(0, (width - H * 1.9) * 0.5);
      // Колёса рисуются вокруг линии пола и выступают ниже неё. Оставляем им
      // запас внутри Canvas, чтобы нижняя кромка шины не обрезалась.
      const floorY = height - H * 0.09;
      gosha.drawShowcase(ctx, x, floorY, H, now);

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  });
}

/**
 * Путь Гоши до выбранного шкафа: маршрут, обрезанный по ближайшей к шкафу
 * точке, плюс короткий подход вплотную. Без этого подхода он останавливался
 * на маршруте в стороне от шкафа, и было непонятно, обо что он упёрся.
 *
 * @returns {{path: {x:number,y:number}[], targetDist: number}}
 */
export function buildApproach(points, target) {
  const d = distanceAlongRoute(points, target);

  // Обрезаем маршрут по точке d.
  const path = [];
  let acc = 0;
  let cut = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (path.length === 0) path.push({ x: a.x, y: a.y });
    if (acc + seg >= d) {
      const t = seg > 0 ? (d - acc) / seg : 0;
      cut = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      path.push(cut);
      break;
    }
    path.push({ x: b.x, y: b.y });
    acc += seg;
  }

  if (!cut) {
    const last = points[points.length - 1];
    cut = { x: last.x, y: last.y };
    if (path.length === 0) path.push({ x: points[0].x, y: points[0].y });
    path.push(cut);
  }

  // Короткий подход: встаём вплотную к шкафу, но не поверх него.
  const dx = target.x - cut.x;
  const dy = target.y - cut.y;
  const gap = Math.hypot(dx, dy);
  const STAND_OFF = 1.3;
  if (gap > STAND_OFF + 0.4) {
    const k = (gap - STAND_OFF) / gap;
    path.push({ x: cut.x + dx * k, y: cut.y + dy * k });
  }

  let targetDist = 0;
  for (let i = 1; i < path.length; i++) {
    targetDist += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }

  return { path, targetDist };
}

/**
 * Расстояние по маршруту до точки, ближайшей к заданной. Нужно, чтобы
 * привести выбранный шкаф к позиции на ломаной маршрута.
 */
export function distanceAlongRoute(points, target) {
  if (!points || points.length < 2) return 0;
  let acc = 0;
  let best = 0;
  let bestD = Infinity;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((target.x - a.x) * vx + (target.y - a.y) * vy) / len2)) : 0;
    const cx = a.x + vx * t;
    const cy = a.y + vy * t;
    const d = Math.hypot(target.x - cx, target.y - cy);
    const seg = Math.sqrt(len2);
    if (d < bestD) {
      bestD = d;
      best = acc + seg * t;
    }
    acc += seg;
  }

  return best;
}
