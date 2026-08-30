/**
 * Гоша-дежурный, идущий по маршруту с рохлей.
 *
 * Спрайт взят из «Гоша Patch-goose» (соседний проект `games`, `gosha-dev.png`
 * — тот, что в наушниках и с бейджем, как раз дежурный). У исходника лапы
 * нарисованы статично, поэтому тело обрезано выше лап, развёрнуто вправо и
 * уменьшено до 128 пикселей, а ноги и рохля рисуются на канвасе — иначе шаг
 * не анимировать.
 */

import bodyUrl from './assets/gosha/gosha-body.png';

/** Скорость в единицах мира за секунду: маршрут целиком — примерно за 20 с. */
const SPEED = 14;

/**
 * Насколько Гоша отходит от преграды перед новой попыткой. Начинать проход с
 * начала маршрута бессмысленно: до места, где топология ломается, он шагал бы
 * полминуты, а показать надо именно упор.
 */
const RETREAT = 24;

const BUMP_MS = 900;

// Длина шага в единицах мира — от неё считается фаза ног.
const STRIDE = 3.2;

const LEG_RATIO = 0.17;   // доля ног в полной высоте
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

    this.dist = 0;
    this.dir = 1;
    this.stopAt = null;
    this.retreatTo = 0;
    this.bumpUntil = 0;
    this.visible = false;
  }

  get ready() {
    return this.body.complete && this.body.naturalWidth > 0;
  }

  setPath(points, stopAtIndex = null) {
    this.path = points || [];
    this.lengths = [];
    this.total = 0;

    for (let i = 1; i < this.path.length; i++) {
      // Сжатие по Y здесь не учитываем: скорость должна быть постоянной в
      // координатах мира, а не в экранных.
      const dx = this.path[i].x - this.path[i - 1].x;
      const dy = this.path[i].y - this.path[i - 1].y;
      const len = Math.hypot(dx, dy);
      this.lengths.push(len);
      this.total += len;
    }

    this.stopAt = null;
    this.retreatTo = 0;
    if (stopAtIndex !== null && stopAtIndex > 0) {
      let acc = 0;
      for (let i = 0; i < Math.min(stopAtIndex, this.lengths.length); i++) {
        acc += this.lengths[i];
      }
      this.stopAt = acc;
      this.retreatTo = Math.max(0, acc - RETREAT);
    }

    this.dist = this.stopAt !== null ? this.retreatTo : 0;
    this.dir = 1;
    this.bumpUntil = 0;
    this.visible = this.path.length > 1;
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

  update(dtMs, now) {
    if (!this.visible || this.total === 0) return;
    if (now < this.bumpUntil) return;

    this.dist += (this.dir * SPEED * dtMs) / 1000;

    if (this.stopAt !== null && this.dir === 1 && this.dist >= this.stopAt) {
      this.dist = this.stopAt;
      this.bumpUntil = now + BUMP_MS;
      this.dir = -1;
      return;
    }

    if (this.dist >= this.total) {
      if (this.stopAt === null) {
        this.dist = 0;
      } else {
        this.dist = this.total;
        this.dir = -1;
      }
    }

    const floor = this.stopAt !== null ? this.retreatTo : 0;
    if (this.dist <= floor) {
      this.dist = floor;
      this.dir = 1;
    }
  }

  draw(ctx, ox, oy, s, sy, now) {
    if (!this.visible || !this.ready) return;
    const at = this._pointAt(this.dist);
    if (!at) return;

    // Полная высота фигуры вместе с ногами. Вместе с рохлей сцена занимает
    // примерно вдвое больше по ширине, поэтому верхнюю границу держим низкой.
    const H = Math.max(30, Math.min(74, 3.6 * s));
    let px = ox + at.x * s;
    const py = oy + at.y * sy;

    const bumping = now < this.bumpUntil;
    if (bumping) {
      const k = (this.bumpUntil - now) / BUMP_MS;
      px += Math.sin(now / 22) * 3 * k;
    }

    // Фаза шага привязана к пройденному пути, а не ко времени: стоя на месте
    // после удара Гоша не перебирает ногами.
    const phase = (this.dist / STRIDE) * Math.PI * 2;
    const goingLeft = at.dx * this.dir < 0;

    ctx.save();
    ctx.translate(px, py);
    if (goingLeft) ctx.scale(-1, 1);

    this._drawPallet(ctx, H);
    this._drawLegs(ctx, H, bumping ? 0 : phase);
    this._drawBody(ctx, H, bumping ? 0 : phase);

    ctx.restore();

    if (bumping) this._drawImpact(ctx, px, py - H * 0.45, H, now);
  }

  /** Рохля позади: вилы с колёсами, поддон с коробкой и наклонная рукоять. */
  _drawPallet(ctx, H) {
    const back = -H * 0.44;   // ближний к Гоше край рохли
    const tail = -H * 1.12;   // дальний край вил
    const floorY = -H * 0.03;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Рукоять от руки Гоши к вилам.
    ctx.strokeStyle = COLORS.steelDark;
    ctx.lineWidth = Math.max(1.5, H * 0.035);
    ctx.beginPath();
    ctx.moveTo(-H * 0.16, -H * 0.5);
    ctx.lineTo(back, floorY - H * 0.05);
    ctx.stroke();

    // Груз на поддоне.
    const cw = Math.abs(tail - back) * 0.78;
    const cx = (back + tail) / 2;
    const ch = H * 0.3;
    ctx.fillStyle = COLORS.cargo;
    ctx.fillRect(cx - cw / 2, floorY - H * 0.1 - ch, cw, ch);
    ctx.fillStyle = COLORS.cargoTop;
    ctx.fillRect(cx - cw / 2, floorY - H * 0.1 - ch, cw, Math.max(1.5, ch * 0.16));

    // Вилы.
    ctx.fillStyle = COLORS.steel;
    ctx.fillRect(tail, floorY - H * 0.1, back - tail, Math.max(1.5, H * 0.06));

    // Колёса.
    ctx.fillStyle = COLORS.wheel;
    const r = Math.max(1.5, H * 0.045);
    for (const wx of [tail + r * 1.2, back - r * 1.2]) {
      ctx.beginPath();
      ctx.arc(wx, floorY, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Две ноги в противофазе: простой шаг, читаемый даже на 30 пикселях. */
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
      // Дальняя нога темнее — так видно, что их две.
      ctx.strokeStyle = i === 0 ? COLORS.legDark : COLORS.leg;
      ctx.beginPath();
      ctx.moveTo(0, hipY);
      ctx.lineTo(footX, 0);
      ctx.stroke();

      // Ступня.
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
    // Лёгкое покачивание в такт шагу.
    const bob = Math.abs(Math.sin(phase)) * H * 0.022;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = H * 0.18;
    ctx.shadowOffsetY = H * 0.05;
    ctx.drawImage(this.body, -bodyW / 2, -legH - bodyH + bob, bodyW, bodyH);
    ctx.restore();
  }

  _drawImpact(ctx, px, py, H, now) {
    const k = (this.bumpUntil - now) / BUMP_MS;
    const r = H * (0.3 + (1 - k) * 0.22);
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
 * Первая точка, где ожидаемый маршрут расходится с получившимся. Именно там
 * топология ломается, и именно туда упирается Гоша, пока ошибка не найдена.
 * Индексы решения захэшированы, так что сам проблемный шкаф отсюда не узнать —
 * а расхождение маршрутов видно из данных уровня.
 */
export function findDivergence(badPoints, goodPoints) {
  if (!badPoints?.length || !goodPoints?.length) return null;
  const n = Math.min(badPoints.length, goodPoints.length);
  for (let i = 0; i < n; i++) {
    const a = badPoints[i];
    const b = goodPoints[i];
    if (Math.hypot(a.x - b.x, a.y - b.y) > 1.5) return i;
  }
  return n > 1 ? n - 1 : null;
}
