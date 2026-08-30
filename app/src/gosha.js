/**
 * Гоша, шагающий по маршруту.
 *
 * Спрайты взяты из «Гоша Patch-goose» (соседний проект `games`): те же кадры
 * с открытым и закрытым клювом, что и у игрока в аркаде. Здесь они уменьшены
 * до 96 пикселей — на карте Гоша занимает 24–48 CSS-пикселей, больше не нужно.
 */

import openUrl from './assets/gosha/gosha-open.png';
import halfUrl from './assets/gosha/gosha-half.png';
import closedUrl from './assets/gosha/gosha-closed.png';
import blinkUrl from './assets/gosha/gosha-blink.png';

// Порядок кадров: клюв открывается и закрывается, изредка моргание.
const FRAME_URLS = [openUrl, halfUrl, closedUrl, halfUrl];
const BLINK_URL = blinkUrl;

const FRAME_MS = 110; // смена кадра клюва
const BLINK_EVERY_MS = 3400;
const BLINK_MS = 160;

/** Скорость в единицах мира за секунду: маршрут целиком — примерно за 20 с. */
const SPEED = 14;

/**
 * Насколько Гоша отходит от преграды перед новой попыткой. Начинать проход с
 * начала маршрута бессмысленно: до места, где топология ломается, он шагал бы
 * полминуты, а показать надо именно упор.
 */
const RETREAT = 24;

const BUMP_MS = 900; // отскок при упоре в шкаф

export class Gosha {
  constructor() {
    this.images = FRAME_URLS.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });
    this.blinkImage = new Image();
    this.blinkImage.src = BLINK_URL;

    this.path = [];       // точки маршрута в координатах мира
    this.lengths = [];    // длина каждого отрезка
    this.total = 0;

    this.dist = 0;        // пройдено по маршруту
    this.dir = 1;         // 1 — вперёд, -1 — назад после отскока
    this.stopAt = null;   // расстояние, дальше которого не пускает шкаф
    this.bumpUntil = 0;   // время окончания отскока
    this.visible = false;
  }

  get ready() {
    return this.images.every((i) => i.complete && i.naturalWidth > 0);
  }

  /**
   * @param {{x:number,y:number}[]} points точки маршрута
   * @param {number|null} stopAtIndex индекс точки, дальше которой пути нет
   */
  setPath(points, stopAtIndex = null) {
    this.path = points || [];
    this.lengths = [];
    this.total = 0;

    for (let i = 1; i < this.path.length; i++) {
      const dx = this.path[i].x - this.path[i - 1].x;
      // Сжатие по Y здесь не учитываем: Гоша должен идти с постоянной
      // скоростью в координатах мира, а не в экранных.
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

    // Если путь перекрыт — сразу подходим к преграде, а не идём к ней с начала.
    this.dist = this.stopAt !== null ? this.retreatTo : 0;
    this.dir = 1;
    this.bumpUntil = 0;
    this.visible = this.path.length > 1;
  }

  /** Позиция и направление на маршруте по пройденному расстоянию. */
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

  /**
   * @param {number} dtMs прошло времени
   * @param {number} now текущее время
   */
  update(dtMs, now) {
    if (!this.visible || this.total === 0) return;

    if (now < this.bumpUntil) return; // стоит и трясётся после удара

    this.dist += (this.dir * SPEED * dtMs) / 1000;

    // Упёрся в шкаф: отскакивает и идёт обратно.
    if (this.stopAt !== null && this.dir === 1 && this.dist >= this.stopAt) {
      this.dist = this.stopAt;
      this.bumpUntil = now + BUMP_MS;
      this.dir = -1;
      return;
    }

    if (this.dist >= this.total) {
      if (this.stopAt === null) {
        this.dist = 0; // прошёл насквозь — идём заново
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

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} ox @param {number} oy сдвиг холста
   * @param {number} s масштаб по X @param {number} sy масштаб по Y
   * @param {number} now текущее время
   */
  draw(ctx, ox, oy, s, sy, now) {
    if (!this.visible || !this.ready) return;
    const at = this._pointAt(this.dist);
    if (!at) return;

    // Размер держим в разумных пределах: на общем плане Гоша не должен
    // превращаться в точку, на крупном — заслонять пол-экрана.
    const size = Math.max(22, Math.min(64, 3.2 * s));
    let px = ox + at.x * s;
    let py = oy + at.y * sy;

    const bumping = now < this.bumpUntil;
    if (bumping) {
      // Дрожание в момент удара.
      const k = (this.bumpUntil - now) / BUMP_MS;
      px += Math.sin(now / 22) * 3 * k;
    }

    const blinking = now % BLINK_EVERY_MS < BLINK_MS;
    const frame = blinking
      ? this.blinkImage
      : this.images[Math.floor(now / FRAME_MS) % this.images.length];

    // Спрайт нарисован смотрящим вправо — при движении влево отражаем.
    const goingLeft = at.dx * this.dir < 0;

    ctx.save();
    ctx.translate(px, py);
    if (goingLeft) ctx.scale(-1, 1);

    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.25;
    ctx.shadowOffsetY = size * 0.12;
    ctx.drawImage(frame, -size / 2, -size / 2, size, size);
    ctx.restore();

    if (bumping) this._drawImpact(ctx, px, py, size, now);
  }

  /** Вспышка в точке удара — чтобы было видно, обо что именно он упёрся. */
  _drawImpact(ctx, px, py, size, now) {
    const k = (this.bumpUntil - now) / BUMP_MS;
    const r = size * (0.45 + (1 - k) * 0.35);
    ctx.save();
    ctx.globalAlpha = Math.max(0, k);
    ctx.strokeStyle = '#ff2d92';
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
