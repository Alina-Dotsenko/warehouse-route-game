import { icon } from './icons.js';

/**
 * HTML-шаблоны экранов. Держим их отдельно от логики, чтобы разметка не была
 * размазана по обработчикам, и чтобы визуальные правки не требовали трогать
 * игровую механику.
 */

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);

export function nameScreen() {
  return `
    <div class="screen screen-name">
      <main class="name-shell">
        <section class="name-welcome">
          <div class="brand brand-lg">
            <span class="brand-mark">route-lab</span>
            <span class="brand-sub">топология</span>
          </div>
          <div class="intro-kicker">Инженерная игра про склад</div>
          <h1 class="name-title">Найдите ошибку.<br />Сократите маршрут.</h1>
          <p class="name-lead">Помогите сборщику пройти к нужным шкафам без лишних крюков.</p>
          <canvas class="name-goose" data-gosha-showcase aria-hidden="true"></canvas>
        </section>

        <form class="name-form" id="name-form">
          <span class="form-step">Перед началом</span>
          <h2 class="card-title">Как к вам обращаться?</h2>
          <p class="card-hint">Имя нужно только для приветствия и останется в этом браузере.</p>
          <label class="sr-only" for="name-input">Ваше имя</label>
          <input
            class="field"
            type="text"
            id="name-input"
            placeholder="Введите имя"
            autocomplete="name"
            maxlength="40"
            required
          />
          <button class="btn btn-primary btn-block" id="name-submit" type="submit" disabled>
            Продолжить
          </button>
        </form>
      </main>
    </div>
  `;
}

export function startScreen({ playerName, levelCount, progress }) {
  const hasProgress = progress > 0 && progress < levelCount;
  const name = playerName ? escapeHtml(playerName) : '';

  return `
    <div class="screen screen-start">
      <header class="start-hero">
        <div class="start-copy">
          <div class="brand">
            <span class="brand-mark">route-lab</span>
            <span class="brand-sub">топология</span>
          </div>
          <div class="intro-kicker">Инженерная игра · ${levelCount} уровней</div>
          <div class="start-message">
            <div class="start-message-copy">
              <h1 class="start-title">
                <span class="start-title-desktop">Найдите ошибку в маршруте склада</span>
                <span class="start-title-mobile">Исправьте маршрут склада</span>
              </h1>
              <p class="start-lead">
                <span class="start-lead-desktop">Сравните два маршрута, отметьте неверно настроенный шкаф и помогите Гоше пройти без лишнего крюка.</span>
                <span class="start-lead-mobile">Сравните маршруты и найдите неверный шкаф.</span>
              </p>
            </div>
          </div>
          <div class="start-mobile-scene" aria-hidden="true">
            <svg class="start-mobile-route" viewBox="0 0 360 128" fill="none">
              <path d="M8 106 C72 106 70 42 132 42 S204 112 260 86 S294 22 352 22" />
              <circle cx="8" cy="106" r="5" />
              <circle cx="352" cy="22" r="6" />
            </svg>
            <div class="start-mobile-racks">
              <span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
            <canvas class="start-mobile-goose" data-gosha-showcase></canvas>
          </div>
          ${name ? `<p class="start-greeting"><span>С возвращением</span><strong>${name}</strong></p>` : ''}
          <div class="start-actions">
            ${
              hasProgress
                ? `<button class="btn btn-primary btn-lg" id="continue-btn">Продолжить с уровня ${progress + 1}</button>
                   <button class="btn btn-ghost" id="start-btn">Начать сначала</button>`
                : `<button class="btn btn-primary btn-lg" id="start-btn">Начать игру</button>`
            }
          </div>
        </div>

        <div class="start-visual" aria-hidden="true">
          <svg class="start-route" viewBox="0 0 440 360" fill="none">
            <path d="M22 302 C94 302 80 224 154 224 S208 104 286 104 S332 50 418 50" />
            <circle cx="22" cy="302" r="7" />
            <circle cx="418" cy="50" r="9" />
          </svg>
          <div class="mini-racks">
            <span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
          <canvas class="start-goose" data-gosha-showcase></canvas>
          <div class="route-status"><span></span> Маршрут проверяется</div>
        </div>
      </header>

      <section class="start-flow" aria-labelledby="start-flow-title">
        <h2 class="section-label" id="start-flow-title">Всё просто — три шага</h2>
        <div class="flow-grid">
          <article class="flow-card">
            <span class="step-n">1</span>
            <div><h3>Сравните</h3><p>Переключайте маршруты «Как есть» и «Как надо».</p></div>
          </article>
          <article class="flow-card">
            <span class="step-n">2</span>
            <div><h3>Найдите</h3><p>Приблизьте подозрительный участок на карте.</p></div>
          </article>
          <article class="flow-card">
            <span class="step-n">3</span>
            <div><h3>Отметьте</h3><p>Выберите проблемные шкафы и проверьте решение.</p></div>
          </article>
        </div>
      </section>

      <section class="card start-legend" aria-labelledby="legend-title">
        <div class="legend-heading">
          <h2 class="panel-title" id="legend-title">Что будет на карте</h2>
          <p>Розовая грань шкафа показывает сторону подхода.</p>
        </div>
        <ul class="legend">
          <li class="legend-row">
            <span class="swatch swatch-cab"></span>
            <span>Обычный шкаф</span>
          </li>
          <li class="legend-row">
            <span class="swatch swatch-pick"></span>
            <span>Точка отбора</span>
          </li>
          <li class="legend-row">
            <span class="swatch swatch-blind"></span>
            <span>Глухой блок</span>
          </li>
          <li class="legend-row">
            <span class="swatch swatch-route-bad"></span>
            <span>Как есть</span>
          </li>
          <li class="legend-row">
            <span class="swatch swatch-route-good"></span>
            <span>Как надо</span>
          </li>
          <li class="legend-row">
            <span class="swatch swatch-aisle"></span>
            <span>Проход склада</span>
          </li>
        </ul>
      </section>

      <section class="card briefing start-about" aria-labelledby="start-about-title">
        <h2 class="panel-title" id="start-about-title">Зачем это нужно?</h2>
        <div class="briefing-body">
          <p>Система строит кратчайший путь по данным склада. Ошибка в топологии создаёт лишний крюк — в игре вы находите её до того, как она помешает сборщику.</p>
        </div>
      </section>
    </div>
  `;
}

export function gameScreen({ level, levelIndex, levelCount }) {
  const total = level.solutionData.count;

  return `
    <div class="screen screen-game">
      <header class="game-header">
        <div class="game-context">
          <span class="game-mark" aria-hidden="true">e</span>
          <span class="game-context-copy">
            <span class="game-product">route-lab · topology</span>
            <span class="game-level">Уровень ${levelIndex + 1} из ${levelCount}</span>
          </span>
        </div>

        <div class="selection-meter" id="sel-chip" role="status" aria-live="polite">
          <span class="selection-meta">
            <span class="selection-label">Найдите ошибку</span>
            <span class="selection-value"><b id="sel-count">0</b><span>/ ${total}</span></span>
          </span>
          <span class="selection-track" aria-hidden="true">
            <span class="selection-progress" id="selection-progress"></span>
          </span>
        </div>

        <div class="header-tools">
          <div class="route-control">
            <span class="route-control-label">Маршрут</span>
            <div class="segmented" role="tablist" aria-label="Маршрут">
              <button class="seg-btn route-bad is-active" id="btn-route-bad" role="tab" aria-selected="true">
                <span class="dot dot-bad"></span><span class="seg-label">Как есть</span>
              </button>
              <button class="seg-btn route-good" id="btn-route-good" role="tab" aria-selected="false">
                <span class="dot dot-good"></span><span class="seg-label">Как надо</span>
              </button>
            </div>
          </div>
          <button class="icon-btn" id="btn-hint" title="Подсказка" aria-label="Подсказка">${icon('bulb')}</button>
          <button class="icon-btn" id="btn-clear-selection" title="Сбросить выбор" aria-label="Сбросить выбор" disabled>${icon('reset')}</button>
          <button class="icon-btn btn-sound" id="btn-sound" aria-pressed="false">${icon('soundOn', 'icon-sound-on')}${icon('soundOff', 'icon-sound-off')}</button>
        </div>

        <button class="icon-btn btn-quit" id="btn-quit" title="Выйти в меню" aria-label="Выйти в меню">${icon('close')}</button>
      </header>

      <div class="game-body">
        <div class="map-stage" id="map-stage">
          <div class="map-viewport">
            <canvas
              class="map-canvas"
              id="map-canvas"
              tabindex="0"
              aria-label="Карта склада. Перетаскивайте карту, масштабируйте и выбирайте шкафы."
            ></canvas>
          </div>

          <div class="map-toolbar" aria-label="Управление картой">
            <div class="map-tip" aria-hidden="true">
              <span class="map-tip-pulse"></span>
              <span>Нажмите на шкаф, чтобы отметить его</span>
            </div>

            <button
              class="map-navigator"
              id="map-navigator"
              type="button"
              aria-label="Вернуться к обзору всего склада"
            >
              <canvas class="map-navigator-canvas" id="map-navigator-canvas" width="216" height="144" aria-hidden="true"></canvas>
              <span class="map-navigator-caption">
                <b>Весь склад</b>
                <span id="map-zoom-value">100%</span>
              </span>
            </button>

            <div class="map-controls">
              <button class="icon-btn map-ctl" id="btn-zoom-in" title="Приблизить" aria-label="Приблизить">${icon('plus')}</button>
              <button class="icon-btn map-ctl" id="btn-zoom-out" title="Отдалить" aria-label="Отдалить">${icon('minus')}</button>
              <button class="icon-btn map-ctl" id="btn-zoom-fit" title="Показать весь склад" aria-label="Показать весь склад">${icon('fit')}</button>
            </div>

            <div class="map-action">
              <button class="btn btn-primary btn-verify" id="btn-verify" disabled>Проверить решение</button>
            </div>
          </div>
        </div>

      <div class="sheet" id="sheet">
        <button class="sheet-handle" id="sheet-toggle" aria-expanded="false" aria-controls="sheet-body">
          <span class="handle-grip" aria-hidden="true"></span>
          <span class="sheet-peek">
            <span class="complaint-badge">Задача</span>
            <span class="sheet-peek-text">${escapeHtml(level.goal)}</span>
          </span>
          <span class="chevron" aria-hidden="true"></span>
        </button>

        <div class="sheet-body" id="sheet-body">
          <p class="goal-body">${escapeHtml(level.goal)}</p>

          <div class="complaint-heading">
            <span class="complaint-kicker">Сообщение администратора</span>
            <strong>Что случилось на складе</strong>
          </div>
          <p class="complaint-body">${escapeHtml(level.complaint)}</p>

          <div class="hint-box" id="hint-box" hidden>
            ${icon('bulb', 'hint-icon')}
            <p>${escapeHtml(level.hintText)}</p>
          </div>

          <div class="sheet-legend">
            <h3 class="side-legend-title">Обозначения</h3>
            <ul class="legend">
              <li class="legend-row"><span class="swatch swatch-cab"></span><span>Шкаф. Розовая метка — сторона подхода</span></li>
              <li class="legend-row"><span class="swatch swatch-pick"></span><span>Отсюда нужно забрать товар</span></li>
              <li class="legend-row"><span class="swatch swatch-blind"></span><span>Глухой блок — подойти нельзя</span></li>
              <li class="legend-row"><span class="swatch swatch-route-bad"></span><span>Получившийся маршрут</span></li>
              <li class="legend-row"><span class="swatch swatch-route-good"></span><span>Желаемый маршрут</span></li>
              <li class="legend-row"><span class="swatch swatch-aisle"></span><span>Размеченный проход склада</span></li>
            </ul>

            <p class="sheet-controls">
              <span class="ctl-desktop">Колесо или +/− — масштаб, 0 — весь склад, стрелки — сдвиг, клик по шкафу — выбрать.</span>
              <span class="ctl-touch">Два пальца — масштаб, один — сдвиг, касание шкафа — выбрать или снять выбор.</span>
            </p>
          </div>
        </div>
      </div>
      </div>

      <div class="modal-backdrop" id="result-modal">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-text">
          <div class="modal-status">
            <div class="modal-icon" id="modal-icon" aria-hidden="true"></div>
            <span class="modal-kicker" id="modal-kicker"></span>
          </div>
          <div class="modal-signal" aria-hidden="true"><span></span><span></span><span></span></div>
          <h2 class="modal-title" id="modal-title"></h2>
          <p class="modal-text" id="modal-text"></p>
          <button class="btn btn-primary btn-lg btn-block modal-action" id="modal-action"></button>
        </div>
      </div>
    </div>
  `;
}

export function endScreen({ playerName, levelCount }) {
  const name = playerName ? `, ${escapeHtml(playerName)}` : '';
  return `
    <div class="screen screen-end">
      <div class="end-card card">
        <div class="end-emoji" aria-hidden="true">🎉</div>
        <h1 class="end-title">Поздравляем${name}!</h1>
        <p class="end-text">
          Вы разобрали все ${levelCount} ${plural(levelCount, 'кейс', 'кейса', 'кейсов')}
          и нашли каждую ошибку в топологии.
        </p>
        <button class="btn btn-primary btn-lg" id="restart-btn">Сыграть ещё раз</button>
      </div>
    </div>
  `;
}

/** Русское склонение по числу: 1 шкаф, 2 шкафа, 5 шкафов. */
export function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
