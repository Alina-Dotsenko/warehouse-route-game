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
        <div class="brand">
          <span class="brand-mark">route-lab</span>
          <span class="brand-sub">топология</span>
        </div>
        <div class="game-meta">
          <span class="chip chip-level">Уровень ${levelIndex + 1} / ${levelCount}</span>
          <span class="chip chip-count" id="sel-chip">
            Выбрано <b id="sel-count">0</b> / <span id="sel-total">${total}</span>
          </span>
        </div>
        <button class="btn btn-ghost btn-icon btn-quit" id="btn-quit" title="Выйти в меню" aria-label="Выйти в меню">✕</button>
      </header>

      <details class="complaint" id="complaint" open>
        <summary class="complaint-head">
          <span class="complaint-badge">Жалоба</span>
          <span class="complaint-preview">${escapeHtml(level.complaint)}</span>
          <span class="chevron" aria-hidden="true"></span>
        </summary>
        <p class="complaint-body">${escapeHtml(level.complaint)}</p>
      </details>

      <div class="map-toolbar">
        <div class="segmented" role="tablist" aria-label="Маршрут">
          <button class="seg-btn is-active" id="btn-route-bad" role="tab" aria-selected="true">
            <span class="dot dot-bad"></span><span class="seg-label">Получившийся</span><span class="seg-label-short">Как есть</span>
          </button>
          <button class="seg-btn" id="btn-route-good" role="tab" aria-selected="false">
            <span class="dot dot-good"></span><span class="seg-label">Желаемый</span><span class="seg-label-short">Как надо</span>
          </button>
        </div>

        <div class="toolbar-spacer"></div>

        <button class="btn btn-ghost btn-hint" id="btn-hint">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z"/></svg><span class="btn-label">Подсказка</span>
        </button>

        <button class="btn btn-ghost btn-icon btn-clear" id="btn-clear-selection" title="Сбросить выбор" aria-label="Сбросить выбор">↺</button>
      </div>

      <div class="hint-box" id="hint-box" hidden>
        <svg class="icon hint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z"/></svg>
        <p>${escapeHtml(level.hintText)}</p>
      </div>

      <div class="map-stage" id="map-stage">
        <canvas class="map-canvas" id="map-canvas"></canvas>
        <div class="map-controls">
          <button class="map-ctl" id="btn-zoom-in" title="Приблизить" aria-label="Приблизить">+</button>
          <button class="map-ctl" id="btn-zoom-out" title="Отдалить" aria-label="Отдалить">−</button>
          <button class="map-ctl" id="btn-zoom-fit" title="Показать весь склад" aria-label="Показать весь склад">⤢</button>
        </div>
        <div class="map-tip" id="map-tip">
          <span class="tip-desktop">Колесо мыши — масштаб, перетаскивание — сдвиг, клик — выбор шкафа</span>
          <span class="tip-touch">Двумя пальцами — масштаб, одним — сдвиг, касание — выбор шкафа</span>
        </div>
        <div class="map-scale" id="map-scale" aria-hidden="true"></div>
      </div>

      <div class="game-actions">
        <p class="action-status" id="action-status">Выберите ${total} ${plural(total, 'шкаф', 'шкафа', 'шкафов')} на карте</p>
        <button class="btn btn-primary btn-lg" id="btn-verify" disabled>Проверить решение</button>
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
