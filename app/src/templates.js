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
      <div class="brand brand-lg">
        <span class="brand-mark">route-lab</span>
        <span class="brand-sub">топология</span>
      </div>
      <form class="card card-narrow name-form" id="name-form">
        <h2 class="card-title">Представьтесь</h2>
        <p class="card-hint">Имя нужно только для приветствия — оно останется в этом браузере.</p>
        <input
          class="field"
          type="text"
          id="name-input"
          placeholder="Ваше имя"
          autocomplete="name"
          maxlength="40"
          required
        />
        <button class="btn btn-primary btn-block" id="name-submit" type="submit" disabled>
          Продолжить
        </button>
      </form>
    </div>
  `;
}

export function startScreen({ playerName, levelCount, progress }) {
  const hasProgress = progress > 0 && progress < levelCount;
  const name = playerName ? escapeHtml(playerName) : '';

  return `
    <div class="screen screen-start">
      <header class="start-head">
        <div class="brand brand-lg">
          <span class="brand-mark">route-lab</span>
          <span class="brand-sub">топология</span>
        </div>
        <p class="start-lead">
          Маршрут сборщика на складе пошёл не так. Найдите шкаф, из-за которого
          система построила его неправильно.
        </p>
        ${name ? `<p class="start-greeting">Вы играете как <strong>${name}</strong></p>` : ''}
        <div class="start-actions">
          ${
            hasProgress
              ? `<button class="btn btn-primary btn-lg" id="continue-btn">Продолжить с уровня ${progress + 1}</button>
                 <button class="btn btn-ghost" id="start-btn">Начать сначала</button>`
              : `<button class="btn btn-primary btn-lg" id="start-btn">Начать игру</button>`
          }
        </div>
      </header>

      <div class="start-panels">
        <section class="card panel">
          <h3 class="panel-title">Как играть</h3>
          <ol class="steps">
            <li><span class="step-n">1</span><span class="step-text">Сравните <b>получившийся</b> и <b>желаемый</b> маршрут переключателем над картой.</span></li>
            <li><span class="step-n">2</span><span class="step-text">Приблизьте карту и найдите шкаф с неверной стороной подхода или лишним блоком.</span></li>
            <li><span class="step-n">3</span><span class="step-text">Нажмите на проблемные шкафы — они отметятся красным кольцом.</span></li>
            <li><span class="step-n">4</span><span class="step-text">Когда выбрано нужное количество, нажмите <b>«Проверить решение»</b>.</span></li>
          </ol>
        </section>

        <section class="card panel">
          <h3 class="panel-title">Обозначения</h3>
          <ul class="legend">
            <li class="legend-row">
              <span class="swatch swatch-cab"></span>
              <span>Шкаф с товаром. Розовая грань — сторона подхода.</span>
            </li>
            <li class="legend-row">
              <span class="swatch swatch-pick"></span>
              <span>Шкаф, из которого нужно забрать товар.</span>
            </li>
            <li class="legend-row">
              <span class="swatch swatch-blind"></span>
              <span>Глухой блок — подойти нельзя ни с одной стороны.</span>
            </li>
            <li class="legend-row">
              <span class="swatch swatch-route-bad"></span>
              <span>Получившийся маршрут (с ошибкой).</span>
            </li>
            <li class="legend-row">
              <span class="swatch swatch-route-good"></span>
              <span>Желаемый маршрут.</span>
            </li>
          </ul>
        </section>
      </div>

      <details class="card panel briefing">
        <summary class="panel-title">Что это за система <span class="chevron" aria-hidden="true"></span></summary>
        <div class="briefing-body">
          <p>Есть система, которая решает задачу — как наиболее оптимальным образом собрать клиентские заказы на складе Ozon. Финальная её подзадача — построение маршрута, который проходит работник склада. Маршрут должен быть кратчайшим и обходить такие точки, чтобы собрать как можно больше заказов, но не перегрузить сборщика.</p>
          <p>Система ориентируется на данные, которые задаёт человек, — в частности на топологию склада. Администратор переносит в систему физическое расположение шкафов, конвейеров, стен и пожарных шкафов. По этому представлению считаются расстояния и строится маршрут.</p>
          <p>Люди ошибаются, но приоритет — клиент. Даже если администратор сделал какой-то шкаф недостижимым, мы обязаны построить маршрут до него и подобрать товар. В системе есть фолбеки и деградации, которые это гарантируют.</p>
          <p>Но бесследно ошибки не проходят: фолбеки приводят к неожиданным маршрутам.</p>
          <blockquote class="pull-quote">
            Разработка — это не написание строчек кода по готовому ТЗ. Настоящая инженерия — умение исследовать нетривиальные проблемы, распутывать краевые случаи и находить логику там, где система ведёт себя непредсказуемо из-за человеческого фактора.
          </blockquote>
          <p><strong>Сегодня вы — дежурный одной из наших команд. Помогите администратору склада найти ошибку в топологии.</strong></p>
        </div>
      </details>
    </div>
  `;
}

export function gameScreen({ level, levelIndex, levelCount }) {
  const total = level.solutionData.count;

  return `
    <div class="screen screen-game">
      <header class="game-header">
        <div class="hud-pill" id="sel-chip">
          <span class="pill-level">Уровень ${levelIndex + 1}/${levelCount}</span>
          <span class="pill-sep" aria-hidden="true"></span>
          <span class="pill-count">Выбрано <b id="sel-count">0</b>/<span id="sel-total">${total}</span></span>
        </div>

        <div class="header-tools">
          <div class="segmented" role="tablist" aria-label="Маршрут">
            <button class="seg-btn is-active" id="btn-route-bad" role="tab" aria-selected="true">
              <span class="dot dot-bad"></span><span class="seg-label">Как есть</span>
            </button>
            <button class="seg-btn" id="btn-route-good" role="tab" aria-selected="false">
              <span class="dot dot-good"></span><span class="seg-label">Как надо</span>
            </button>
          </div>
          <button class="icon-btn" id="btn-hint" title="Подсказка" aria-label="Подсказка"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z"/></svg></button>
          <button class="icon-btn" id="btn-clear-selection" title="Сбросить выбор" aria-label="Сбросить выбор" disabled>↺</button>
        </div>

        <button class="icon-btn btn-quit" id="btn-quit" title="Выйти в меню" aria-label="Выйти в меню">✕</button>
      </header>

      <div class="game-body">
        <div class="map-stage" id="map-stage">
          <canvas class="map-canvas" id="map-canvas"></canvas>

          <div class="map-controls">
            <button class="icon-btn map-ctl" id="btn-zoom-in" title="Приблизить" aria-label="Приблизить">+</button>
            <button class="icon-btn map-ctl" id="btn-zoom-out" title="Отдалить" aria-label="Отдалить">−</button>
            <button class="icon-btn map-ctl" id="btn-zoom-fit" title="Показать весь склад" aria-label="Показать весь склад">⤢</button>
          </div>

          <div class="map-action">
            <button class="btn btn-primary btn-verify" id="btn-verify" disabled>Проверить решение</button>
          </div>
        </div>

      <div class="sheet" id="sheet">
        <button class="sheet-handle" id="sheet-toggle" aria-expanded="false" aria-controls="sheet-body">
          <span class="handle-grip" aria-hidden="true"></span>
          <span class="sheet-peek">
            <span class="complaint-badge">Жалоба</span>
            <span class="sheet-peek-text">${escapeHtml(level.complaint)}</span>
          </span>
          <span class="chevron" aria-hidden="true"></span>
        </button>

        <div class="sheet-body" id="sheet-body">
          <p class="complaint-body">${escapeHtml(level.complaint)}</p>

          <div class="hint-box" id="hint-box" hidden>
            <svg class="icon hint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z"/></svg>
            <p>${escapeHtml(level.hintText)}</p>
          </div>

          <div class="sheet-legend">
            <h3 class="side-legend-title">Обозначения</h3>
            <ul class="legend">
              <li class="legend-row"><span class="swatch swatch-cab"></span><span>Шкаф. Розовая грань — сторона подхода</span></li>
              <li class="legend-row"><span class="swatch swatch-pick"></span><span>Отсюда нужно забрать товар</span></li>
              <li class="legend-row"><span class="swatch swatch-blind"></span><span>Глухой блок — подойти нельзя</span></li>
              <li class="legend-row"><span class="swatch swatch-route-bad"></span><span>Получившийся маршрут</span></li>
              <li class="legend-row"><span class="swatch swatch-route-good"></span><span>Желаемый маршрут</span></li>
            </ul>

            <p class="sheet-controls">
              <span class="ctl-desktop">Колесо мыши — масштаб, перетаскивание — сдвиг, клик по шкафу — выбрать или снять выбор.</span>
              <span class="ctl-touch">Два пальца — масштаб, один — сдвиг, касание шкафа — выбрать или снять выбор.</span>
            </p>
          </div>
        </div>
      </div>
      </div>

      <div class="modal-backdrop" id="result-modal">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-icon" id="modal-icon" aria-hidden="true"></div>
          <h2 class="modal-title" id="modal-title"></h2>
          <p class="modal-text" id="modal-text"></p>
          <button class="btn btn-primary btn-lg btn-block" id="modal-action"></button>
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
