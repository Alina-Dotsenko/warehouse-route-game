/**
 * Звук: короткие сигналы на исход проверки.
 *
 * Синтезируется через Web Audio — так же, как в соседнем «Гоша Patch-goose».
 * Файлов нет: бандл не растёт, лицензировать нечего, а для пары сигналов
 * осцилляторов достаточно.
 *
 * Браузер не даёт запустить звук до действия пользователя, поэтому контекст
 * создаётся лениво — в unlock(), который вызывается на первый клик.
 */

const STORE_MUTED = 'route-lab_muted';

const SFX_GAIN = 0.5;

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem(STORE_MUTED) === '1';
  }

  /** Создаёт контекст. Вызывать только из обработчика действия пользователя. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();

      // В аккорде успеха накладываются до трёх нот сразу, поэтому на выходе
      // стоит компрессор: он держит пики и заодно делает звук субъективно
      // громче, чем один только рост усиления.
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 12;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.004;
      limiter.release.value = 0.18;
      limiter.connect(this.ctx.destination);

      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(limiter);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem(STORE_MUTED, muted ? '1' : '0');
    if (!this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0 : 1, now, 0.05);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Одна нота с мягкой атакой и затуханием.
   * @param {number} freq частота
   * @param {number} dur длительность
   * @param {object} opts тип волны, громкость, задержка
   */
  _note(freq, dur, { type = 'triangle', gain = SFX_GAIN, delay = 0 } = {}) {
    if (!this.ctx) return;
    const at = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);

    // Экспоненциальная огибающая: нулей она не принимает, поэтому крайние
    // значения ставим малыми, а не нулевыми.
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(env).connect(this.master);
    osc.start(at);
    osc.stop(at + dur + 0.03);
  }

  /** Успех: восходящее трезвучие. */
  success() {
    if (!this.ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this._note(f, 0.26, { type: 'triangle', delay: i * 0.085 })
    );
  }

  /** Неудача: глухой нисходящий сигнал. */
  fail() {
    if (!this.ctx) return;
    this._note(196, 0.22, { type: 'sawtooth', gain: SFX_GAIN * 0.55 });
    this._note(146.83, 0.34, { type: 'sawtooth', gain: SFX_GAIN * 0.5, delay: 0.11 });
  }

}

export const sound = new Sound();
