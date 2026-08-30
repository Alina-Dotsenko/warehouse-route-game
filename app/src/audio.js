/**
 * Звук: короткие сигналы на исход проверки и спокойный фоновый пэд.
 *
 * Всё синтезируется через Web Audio — так же, как в соседнем «Гоша
 * Patch-goose». Файлов нет: бандл не растёт, лицензировать нечего, а для
 * пары сигналов и медленной подложки осцилляторов достаточно.
 *
 * Браузер не даёт запустить звук до действия пользователя, поэтому контекст
 * создаётся лениво — в unlock(), который вызывается на первый клик.
 */

const STORE_MUTED = 'route-lab_muted';

const MUSIC_GAIN = 0.13;
const SFX_GAIN = 0.5;

// Медленная последовательность: Am - F - C - G. Ноты держатся долго, поэтому
// подложка не тянет на себя внимание.
const CHORDS = [
  [220.0, 261.63, 329.63],
  [174.61, 220.0, 261.63],
  [130.81, 164.81, 196.0],
  [196.0, 246.94, 293.66],
];
const CHORD_SEC = 5.2;

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.muted = localStorage.getItem(STORE_MUTED) === '1';

    this._musicOn = false;
    this._timer = null;
    this._nextAt = 0;
    this._chord = 0;
  }

  /** Создаёт контекст. Вызывать только из обработчика действия пользователя. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();

      // Сигналы накладываются друг на друга (в аккорде успеха до трёх нот
      // сразу), поэтому на выходе стоит компрессор: он держит пики и заодно
      // делает звук субъективно громче, чем один только рост усиления.
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

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = MUSIC_GAIN;
      this.musicBus.connect(this.master);
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
   * @param {object} opts тип волны, громкость, задержка, шина
   */
  _note(freq, dur, { type = 'triangle', gain = SFX_GAIN, delay = 0, bus = null, attack = 0.01 } = {}) {
    if (!this.ctx) return;
    const at = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);

    // Экспоненциальная огибающая: нулей она не принимает, поэтому крайние
    // значения ставим малыми, а не нулевыми.
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(env).connect(bus || this.master);
    osc.start(at);
    osc.stop(at + dur + 0.03);
  }

  /**
   * Приглушает подложку на время сигнала. Без этого эффект тонет в пэде: по
   * замерам пик успеха был 0.55 против 0.49 у одной музыки — разницы почти
   * не слышно, и звук воспринимается тихим, сколько усиление ни поднимай.
   */
  _duck(seconds = 0.8) {
    if (!this.musicBus) return;
    const now = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setTargetAtTime(MUSIC_GAIN * 0.2, now, 0.04);
    this.musicBus.gain.setTargetAtTime(MUSIC_GAIN, now + seconds, 0.35);
  }

  /** Успех: восходящее трезвучие. */
  success() {
    if (!this.ctx) return;
    this._duck();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this._note(f, 0.26, { type: 'triangle', gain: SFX_GAIN, delay: i * 0.085 })
    );
  }

  /** Неудача: глухой нисходящий сигнал. */
  fail() {
    if (!this.ctx) return;
    this._duck(0.7);
    this._note(196, 0.22, { type: 'sawtooth', gain: SFX_GAIN * 0.55 });
    this._note(146.83, 0.34, { type: 'sawtooth', gain: SFX_GAIN * 0.5, delay: 0.11 });
  }

  // ------------------------------------------------------------------ музыка

  startMusic() {
    if (!this.ctx || this._musicOn) return;
    this._musicOn = true;
    this._nextAt = this.ctx.currentTime + 0.2;
    this._chord = 0;
    // Планируем аккорды с запасом: setInterval сам по себе слишком неточен,
    // но как источник «пора запланировать следующий» его хватает.
    this._timer = setInterval(() => this._schedule(), 400);
    this._schedule();
  }

  stopMusic() {
    this._musicOn = false;
    clearInterval(this._timer);
    this._timer = null;
  }

  _schedule() {
    if (!this._musicOn || !this.ctx) return;
    while (this._nextAt < this.ctx.currentTime + 1.2) {
      const chord = CHORDS[this._chord % CHORDS.length];
      const at = this._nextAt - this.ctx.currentTime;

      chord.forEach((f, i) =>
        this._note(f, CHORD_SEC * 0.95, {
          type: 'triangle',
          gain: 1,
          delay: at + i * 0.06,
          bus: this.musicBus,
          attack: 0.9,
        })
      );
      // Бас на октаву ниже основания аккорда.
      this._note(chord[0] / 2, CHORD_SEC * 0.9, {
        type: 'sine',
        gain: 0.9,
        delay: at,
        bus: this.musicBus,
        attack: 0.7,
      });

      this._nextAt += CHORD_SEC;
      this._chord++;
    }
  }
}

export const sound = new Sound();
