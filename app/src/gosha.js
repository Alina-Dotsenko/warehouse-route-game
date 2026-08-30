/**
 * Гоша-дежурный: подходит к выбранному шкафу и либо проходит дальше, либо
 * упирается в него.
 *
 * Спрайт взят из «Гоша Patch-goose» (соседний проект `games`, `gosha-dev.png`
 * — тот, что в наушниках и с бейджем, как раз дежурный). У исходника лапы
 * нарисованы статично, поэтому тело обрезано выше лап, развёрнуто вправо и
 * уменьшено до 128 пикселей, а ноги и рохля рисуются на канвасе — иначе шаг
 * не анимировать.
 *
 * Гоша живёт только во время проверки решения. Постоянно шагающая по всему
 * маршруту фигура на общем плане занимала тридцать пикселей и терялась, а
 * дойти до нужного места ей требовалось секунд двадцать.
 */

import bodyUrl from './assets/gosha/gosha-body.png';

// Сколько единиц мира Гоша проходит перед целью — чтобы был виден разбег.
const RUN_UP = 26;

const RUN_MS = 1100;    // разбег до шкафа
const THROUGH_MS = 700; // проход дальше при верном ответе
const BUMP_MS = 850;    // упор при неверном

const STRIDE = 3.2;     // длина шага в единицах мира

const LEG_RATIO = 0.17;
const BODY_ASPECT = 78 / 128;

const COLORS = {
  leg: '#fec700',
  legDark: '#d9a300',
  steel: '#94a6c4',
  steelDark: '#5d6f8f',
  wheel: '#2b3648',
  cargo: '#c98b4b',
  cargoTop: '#e0a869',
  impact: '#ff2d92',
};

export class Gosha {
  constructor() {
    this.body = new Image();
    this.body.src = bodyUrl;

    this.path = [];
    this.lengths = [];
    this.total = 0;

    this.visible = false;
    this.phase = null;   // 'run' | 'through' | 'bump'
    this.dist = 0;
    this.from = 0;
    this.to = 0;
    this.startedAt = 0;
    this.duration = 0;
    this.pass = false;
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
   * Запускает проход к точке маршрута.
   * @param {{x:number,y:number}[]} points маршрут
   * @param {number} targetDist расстояние по маршруту до выбранного шкафа
   * @param {boolean} pass пройдёт ли он дальше
   * @param {() => void} onDone вызывается, когда сцена доиграна
   */
  start(points, targetDist, pass, onDone) {
    this._measure(points);
    if (this.total === 0) {
      onDone?.();
      return;
    }

    this.to = Math.max(0, Math.min(targetDist, this.total));
    this.from = Math.max(0, this.to - RUN_UP);
    this.dist = this.from;
    this.pass = pass;
    this.onDone = onDone;
    this.phase = 'run';
    this.startedAt = performance.now();
    this.duration = RUN_MS;
    this.visible = true;
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
    if (!this.visible || !this.phase) return;

    const t = Math.min(1, (now - this.startedAt) / this.duration);

    if (this.phase === 'run') {
      const e = 1 - Math.pow(1 - t, 2); // тормозит у самого шкафа
      this.dist = this.from + (this.to - this.from) * e;
      if (t >= 1) {
        if (this.pass) {
          this.phase = 'through';
          this.from = this.to;
          this.to = Math.min(this.total, this.to + RUN_UP * 0.8);
          this.duration = THROUGH_MS;
        } else {
          this.phase = 'bump';
          this.duration = BUMP_MS;
        }
        this.startedAt = now;
      }
      return;
    }

    if (this.phase === 'through') {
      this.dist = this.from + (this.to - this.from) * t;
      if (t >= 1) this._finish();
      return;
    }

    if (this.phase === 'bump' && t >= 1) this._finish();
  }

  _finish() {
    this.phase = null;
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

    const bumping = this.phase === 'bump';
    if (bumping) {
      const k = 1 - (now - this.startedAt) / this.duration;
      px += Math.sin(now / 20) * 4 * Math.max(0, k);
    }

    // Фаза шага привязана к пройденному пути: стоя на месте после удара Гоша
    // не перебирает ногами.
    const stepPhase = (this.dist / STRIDE) * Math.PI * 2;
    const goingLeft = at.dx < 0;

    ctx.save();
    ctx.translate(px, py);
    if (goingLeft) ctx.scale(-1, 1);

    this._drawPallet(ctx, H);
    this._drawLegs(ctx, H, stepPhase);
    this._drawBody(ctx, H, stepPhase);

    ctx.restore();

    if (bumping) this._drawImpact(ctx, px, py - H * 0.45, H, now);
  }

  /** Рохля позади: вилы с колёсами, поддон с коробкой и наклонная рукоять. */
  _drawPallet(ctx, H) {
    const back = -H * 0.44;
    const tail = -H * 1.12;
    const floorY = -H * 0.03;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = COLORS.steelDark;
    ctx.lineWidth = Math.max(1.5, H * 0.035);
    ctx.beginPath();
    ctx.moveTo(-H * 0.16, -H * 0.5);
    ctx.lineTo(back, floorY - H * 0.05);
    ctx.stroke();

    const cw = Math.abs(tail - back) * 0.78;
    const cx = (back + tail) / 2;
    const ch = H * 0.3;
    ctx.fillStyle = COLORS.cargo;
    ctx.fillRect(cx - cw / 2, floorY - H * 0.1 - ch, cw, ch);
    ctx.fillStyle = COLORS.cargoTop;
    ctx.fillRect(cx - cw / 2, floorY - H * 0.1 - ch, cw, Math.max(1.5, ch * 0.16));

    ctx.fillStyle = COLORS.steel;
    ctx.fillRect(tail, floorY - H * 0.1, back - tail, Math.max(1.5, H * 0.06));

    ctx.fillStyle = COLORS.wheel;
    const r = Math.max(1.5, H * 0.045);
    for (const wx of [tail + r * 1.2, back - r * 1.2]) {
      ctx.beginPath();
      ctx.arc(wx, floorY, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Две ноги в противофазе: простой шаг, читаемый даже на 34 пикселях. */
  _drawLegs(ctx, H, phase) {
    const legH = H * LEG_RATIO;
    const hipY = -legH;
    const swing = legH * 0.55;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.8, H * 0.05);

    for (let i = 0; i < 2; i++) {
      const p = phase + i * Math.PI;
      const footX = Math.sin(p) * swing;
      ctx.strokeStyle = i === 0 ? COLORS.legDark : COLORS.leg;
      ctx.beginPath();
      ctx.moveTo(0, hipY);
      ctx.lineTo(footX, 0);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(footX - legH * 0.1, 0);
      ctx.lineTo(footX + legH * 0.42, 0);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawBody(ctx, H, phase) {
    const legH = H * LEG_RATIO;
    const bodyH = H - legH;
    const bodyW = bodyH * BODY_ASPECT;
    const bob = Math.abs(Math.sin(phase)) * H * 0.022;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = H * 0.18;
    ctx.shadowOffsetY = H * 0.05;
    ctx.drawImage(this.body, -bodyW / 2, -legH - bodyH + bob, bodyW, bodyH);
    ctx.restore();
  }

  _drawImpact(ctx, px, py, H, now) {
    const k = 1 - (now - this.startedAt) / this.duration;
    const r = H * (0.3 + (1 - k) * 0.26);
    ctx.save();
    ctx.globalAlpha = Math.max(0, k);
    ctx.strokeStyle = COLORS.impact;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
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
