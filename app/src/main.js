import './style.css';
import { levels, editorTemplate } from './levels.js';
import { TopologyMap } from './renderer.js';
import { nameScreen, startScreen, gameScreen, endScreen, plural } from './templates.js';
import { sound } from './audio.js';
import { mountGoshaShowcases } from './gosha.js';
import { icon as uiIcon } from './icons.js';

const app = document.querySelector('#app');
const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';

const STORE_NAME = 'route-lab_player';
const STORE_PROGRESS = 'route-lab_progress';

let currentLevelIndex = 0;
let map = null; // активный TopologyMap, если открыт игровой экран

const getPlayer = () => localStorage.getItem(STORE_NAME) || '';

// Браузер запрещает звук до действия пользователя, поэтому контекст создаём
// на первом же клике по странице, а не при загрузке.
document.addEventListener('pointerdown', () => sound.unlock(), { once: true });
const getProgress = () => parseInt(localStorage.getItem(STORE_PROGRESS), 10) || 0;

/** Освобождаем canvas и его слушатели перед сменой экрана. */
function teardownMap() {
  if (map) {
    map.destroy();
    map = null;
  }
}

// ---------------------------------------------------------------- экран имени

function renderNameScreen() {
  teardownMap();
  app.innerHTML = nameScreen();
  mountGoshaShowcases(app);

  const form = document.getElementById('name-form');
  const input = document.getElementById('name-input');
  const submit = document.getElementById('name-submit');

  input.addEventListener('input', () => {
    submit.disabled = input.value.trim().length === 0;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    localStorage.setItem(STORE_NAME, value);
    renderStartScreen();
  });

  input.focus();
}

// -------------------------------------------------------------- стартовый экран

function renderStartScreen() {
  teardownMap();
  app.innerHTML = startScreen({
    playerName: getPlayer(),
    levelCount: levels.length,
    progress: getProgress(),
  });
  mountGoshaShowcases(app);

  document.getElementById('start-btn').addEventListener('click', () => {
    localStorage.setItem(STORE_PROGRESS, '0');
    currentLevelIndex = 0;
    renderGameScreen();
  });

  const continueBtn = document.getElementById('continue-btn');
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      currentLevelIndex = getProgress();
      renderGameScreen();
    });
  }
}

// ---------------------------------------------------------------- игровой экран

function renderGameScreen() {
  teardownMap();
  const level = levels[currentLevelIndex];

  app.innerHTML = gameScreen({
    level,
    levelIndex: currentLevelIndex,
    levelCount: levels.length,
  });

  const total = level.solutionData.count;

  const canvas = document.getElementById('map-canvas');
  const selCount = document.getElementById('sel-count');
  const selChip = document.getElementById('sel-chip');
  const selLabel = selChip.querySelector('.selection-label');
  const selProgress = document.getElementById('selection-progress');
  const mapTip = document.querySelector('.map-tip');
  const btnVerify = document.getElementById('btn-verify');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomFit = document.getElementById('btn-zoom-fit');
  const mapNavigator = document.getElementById('map-navigator');
  const mapNavigatorCanvas = document.getElementById('map-navigator-canvas');
  const mapZoomValue = document.getElementById('map-zoom-value');
  const btnClear = document.getElementById('btn-clear-selection');
  const btnBad = document.getElementById('btn-route-bad');
  const btnGood = document.getElementById('btn-route-good');
  const btnHint = document.getElementById('btn-hint');
  const btnQuit = document.getElementById('btn-quit');
  const btnSound = document.getElementById('btn-sound');
  const hintBox = document.getElementById('hint-box');
  const sheet = document.getElementById('sheet');
  const sheetToggle = document.getElementById('sheet-toggle');
  const modal = document.getElementById('result-modal');

  const setSheetOpen = (open) => {
    sheet.classList.toggle('is-open', open);
    sheetToggle.setAttribute('aria-expanded', String(open));
  };
  sheetToggle.addEventListener('click', () => setSheetOpen(!sheet.classList.contains('is-open')));

  // Кнопка проверки заодно служит индикатором: отдельная строка статуса и
  // постоянная нижняя панель ради неё не нужны.
  const updateSelectionUI = (selected) => {
    const n = selected.size;
    selCount.textContent = String(n);
    selChip.classList.toggle('is-ready', n === total);
    selChip.classList.toggle('is-over', n > total);
    selProgress.style.width = `${Math.min(100, (n / Math.max(1, total)) * 100)}%`;
    mapTip.classList.toggle('is-hidden', n > 0);
    btnClear.disabled = n === 0;

    if (n === total) {
      selLabel.textContent = 'Можно проверять';
      btnVerify.disabled = false;
      btnVerify.textContent = 'Проверить решение';
    } else if (n < total) {
      const left = total - n;
      selLabel.textContent = n === 0 ? 'Найдите ошибку' : 'Отмечено шкафов';
      btnVerify.disabled = true;
      btnVerify.textContent = `Выберите ещё ${left} ${plural(left, 'шкаф', 'шкафа', 'шкафов')}`;
    } else {
      const extra = n - total;
      selLabel.textContent = 'Выбрано слишком много';
      btnVerify.disabled = true;
      btnVerify.textContent = `Снимите ${extra} ${plural(extra, 'лишний', 'лишних', 'лишних')}`;
    }
  };

  const updateViewUI = (view) => {
    btnZoomIn.disabled = !view.canZoomIn;
    btnZoomOut.disabled = !view.canZoomOut;
    mapNavigator.classList.toggle('is-visible', !view.isOverview);
    mapNavigator.setAttribute('aria-hidden', String(view.isOverview));
    mapNavigator.tabIndex = view.isOverview ? -1 : 0;
    mapZoomValue.textContent = `${Math.round(view.zoom * 100)}%`;
    mapTip.classList.toggle('is-viewing', !view.isOverview);
  };

  map = new TopologyMap(canvas, {
    onSelectionChange: updateSelectionUI,
    onViewChange: updateViewUI,
    navigatorCanvas: mapNavigatorCanvas,
  });

  map.setLevel(level);
  map.startAnimation();


  btnZoomIn.addEventListener('click', () => map.zoomIn());
  btnZoomOut.addEventListener('click', () => map.zoomOut());
  btnZoomFit.addEventListener('click', () => map.fitAnimated());
  mapNavigator.addEventListener('click', () => map.fitAnimated());
  btnClear.addEventListener('click', () => map.clearSelection());

  const setRoute = (kind) => {
    map.setActiveRoute(kind);
    btnBad.classList.toggle('is-active', kind === 'bad');
    btnGood.classList.toggle('is-active', kind === 'good');
    btnBad.setAttribute('aria-selected', String(kind === 'bad'));
    btnGood.setAttribute('aria-selected', String(kind === 'good'));
  };
  btnBad.addEventListener('click', () => setRoute('bad'));
  btnGood.addEventListener('click', () => setRoute('good'));

  // Подсказка в два шага: сначала текст в шторке, потом наезд на зону.
  let hintStep = 0;
  btnHint.addEventListener('click', () => {
    hintStep++;
    if (hintStep === 1) {
      hintBox.hidden = false;
      setSheetOpen(true);
      btnHint.classList.add('is-armed');
      btnHint.title = 'Показать зону на карте';
      btnHint.setAttribute('aria-label', 'Показать зону на карте');
    } else {
      setSheetOpen(false);
      map.setHintZoneVisible(true);
      btnHint.disabled = true;
    }
  });

  const syncSoundBtn = () => {
    btnSound.classList.toggle('is-muted', sound.muted);
    btnSound.setAttribute('aria-pressed', String(sound.muted));
    const label = sound.muted ? 'Включить звук' : 'Выключить звук';
    btnSound.title = label;
    btnSound.setAttribute('aria-label', label);
  };
  syncSoundBtn();

  btnSound.addEventListener('click', () => {
    sound.unlock();
    sound.toggleMuted();
    syncSoundBtn();
  });

  btnQuit.addEventListener('click', () => renderStartScreen());

  btnVerify.addEventListener('click', async () => {
    const selection = map.getSelection();
    const isCorrect = await checkSolution(level, selection);

    // Сначала показываем проверку на складе и только потом открываем подробный
    // вердикт: Гоша подходит к выбранному шкафу и сверяет его настройку.
    btnVerify.disabled = true;
    setRoute('good');
    // Сигнал звучит вместе с короткой репликой о результате проверки, а не
    // после всей сцены — иначе он расходится с картинкой.
    await map.playCheck(selection[0], isCorrect, () => {
      if (isCorrect) sound.success();
      else sound.fail();
    });
    btnVerify.disabled = false;

    showResult(modal, level, isCorrect);
  });

  updateSelectionUI(new Set());
}

/**
 * Проверка решения. Схема сверки оставлена без изменений: SHA-256 от списка
 * индексов с солью, затем XOR с той же солью и base64 — ответы в levels.js
 * хранятся уже в таком виде, менять алгоритм нельзя.
 */
async function checkSolution(level, selectedIndices) {
  if (selectedIndices.length !== level.solutionData.count) return false;

  const key = 'ozon_tech_secret_2026';
  const data = new TextEncoder().encode(selectedIndices.join(',') + key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  let xorResult = '';
  for (let i = 0; i < hashHex.length; i++) {
    xorResult += String.fromCharCode(hashHex.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }

  return btoa(xorResult) === level.solutionData.hash;
}

function showResult(modal, level, isCorrect) {
  const statusIcon = document.getElementById('modal-icon');
  const kicker = document.getElementById('modal-kicker');
  const title = document.getElementById('modal-title');
  const text = document.getElementById('modal-text');
  const action = document.getElementById('modal-action');

  modal.classList.toggle('is-success', isCorrect);
  modal.classList.toggle('is-error', !isCorrect);

  const isLast = currentLevelIndex === levels.length - 1;

  if (isCorrect) {
    statusIcon.innerHTML = uiIcon('check');
    kicker.textContent = 'Проверка пройдена';
    title.textContent = 'Маршрут исправлен';
    text.textContent = level.successMessage;
    action.textContent = isLast ? 'Завершить игру' : 'Следующий уровень';

    if (currentLevelIndex + 1 > getProgress()) {
      localStorage.setItem(STORE_PROGRESS, String(currentLevelIndex + 1));
    }

    action.onclick = () => {
      modal.classList.remove('is-open');
      currentLevelIndex++;
      setTimeout(currentLevelIndex < levels.length ? renderGameScreen : renderEndScreen, 260);
    };
  } else {
    statusIcon.innerHTML = uiIcon('retry');
    kicker.textContent = 'Нужна ещё проверка';
    title.textContent = 'Маршруты пока не сходятся';
    text.textContent =
      'Сравните «Как есть» и «Как надо» ещё раз. Ищите шкаф рядом с участком, где линии маршрутов расходятся.';
    action.textContent = 'Вернуться к карте';
    action.onclick = () => {
      modal.classList.remove('is-open');
      map?.clearSelection();
    };
  }

  modal.classList.add('is-open');
  action.focus();
}

// ---------------------------------------------------------------- финальный экран

function renderEndScreen() {
  teardownMap();
  app.innerHTML = endScreen({ playerName: getPlayer(), levelCount: levels.length });
  document.getElementById('restart-btn').addEventListener('click', () => {
    localStorage.setItem(STORE_PROGRESS, '0');
    currentLevelIndex = 0;
    renderStartScreen();
  });
}

// ------------------------------------------------------------------- редактор
// Служебный конструктор топологии для админов (?admin=true). Рисуется через DOM:
// уровней здесь не проходят, а редактирование удобнее делать по элементам.

let editorCabs = [];
let editorRoute = [];
let editorInitialized = false;
let currentBrush = 'bottom';
let isDragging = false;
let lastSnappedPos = null;

const U = 0.84;
const cabW = 0.84;
const cabH = 1.68;
const gapX = 0.17;
const aisleX = 2.52;
const startX = 3.4;
const startY = 2.0;
const cols = 70;
const rows = 27;

const getColX = (c) => {
  let x = startX + c * (cabW + gapX);
  for (let b = 1; b <= Math.floor(c / 10); b++) {
    x += b === 2 || b === 4 || b === 6 ? aisleX + cabW + aisleX : aisleX;
  }
  return x;
};

let validXs = [];
for (let c = 0; c < cols; c++) validXs.push(getColX(c));
for (let b = 1; b <= 6; b++) {
  const prevC = b * 10 - 1;
  const aisleStartX = getColX(prevC) + cabW + gapX;
  const gapAmount = b === 2 || b === 4 || b === 6 ? aisleX + cabW + aisleX : aisleX;
  for (let s = 0; s < Math.round(gapAmount / U); s++) validXs.push(aisleStartX + s * U);
}
const leftWallStart = startX - aisleX - cabW;
for (let s = 0; s < 5; s++) validXs.push(leftWallStart + s * U);
validXs.sort((a, b) => a - b);
validXs = [...new Set(validXs.map((x) => x.toFixed(3)))].map(Number);

let validYs = [];
{
  let currY = startY;
  const raw = [];
  for (let r = 0; r < rows; r++) {
    raw.push(currY);
    if (r === 0) currY += cabH + 3.36;
    else if (r % 2 === 1) currY += cabH;
    else currY += cabH + 3.36;
  }
  const minY = Math.min(...raw) - cabH * 4;
  const maxY = Math.max(...raw) + cabH * 4;
  for (let y = minY; y <= maxY; y += cabH) validYs.push(Number(y.toFixed(3)));
}

const getClosest = (val, arr) =>
  arr.reduce((prev, curr) => (Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev));

/** DOM-разметка топологии — только для редактора. */
function renderEditorTopology() {
  let html = '';
  const b = editorTemplate.bounds;
  if (b) {
    html += `<div class="ed-bounds" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%"></div>`;
  }
  editorCabs.forEach((cab, idx) => {
    const facing = cab.facing ? `facing-${cab.facing}` : 'facing-bottom';
    html += `<div class="ed-cab ${facing}" data-idx="${idx}" style="left:${cab.x}%;top:${cab.y}%;width:${cab.w}%;height:${cab.h}%"></div>`;
  });
  editorRoute.forEach((pt) => {
    html += `<div class="ed-dot" style="left:${pt.x}%;top:${pt.y}%"></div>`;
  });
  return html;
}

function renderEditorScreen() {
  teardownMap();
  if (!editorInitialized) {
    editorCabs = JSON.parse(JSON.stringify(editorTemplate.cabinets));
    editorInitialized = true;
  }

  app.innerHTML = `
    <div class="screen screen-editor">
      <header class="game-header">
        <div class="brand"><span class="brand-mark">route-lab</span><span class="brand-sub">конструктор</span></div>
        <div class="editor-tools">
          <button class="btn btn-ghost btn-sm" id="ed-undo-route">${uiIcon('undo')}Отменить точку</button>
          <button class="btn btn-ghost btn-sm" id="ed-clear-route">${uiIcon('routeClear')}Очистить маршрут</button>
          <button class="btn btn-primary btn-sm" id="ed-export">${uiIcon('download')}Экспорт</button>
          <label class="btn btn-ghost btn-sm">${uiIcon('upload')}Импорт<input type="file" id="ed-import" accept=".json" hidden></label>
          <button class="btn btn-ghost btn-sm" id="ed-clear">${uiIcon('trash')}Очистить склад</button>
          <button class="btn btn-ghost btn-sm" id="ed-exit">${uiIcon('close')}Выйти</button>
        </div>
      </header>

      <div class="map-toolbar" id="brush-selector">
        <button class="btn btn-sm is-active" data-brush="bottom">${uiIcon('arrowDown')}Вниз</button>
        <button class="btn btn-sm" data-brush="left">${uiIcon('arrowLeft')}Влево</button>
        <button class="btn btn-sm" data-brush="top">${uiIcon('arrowUp')}Вверх</button>
        <button class="btn btn-sm" data-brush="right">${uiIcon('arrowRight')}Вправо</button>
        <button class="btn btn-sm" data-brush="none">${uiIcon('block')}Глухой</button>
        <button class="btn btn-sm btn-danger" data-brush="delete">${uiIcon('eraser')}Ластик</button>
        <button class="btn btn-sm btn-accent" data-brush="route-dot">${uiIcon('waypoint')}Точка пути</button>
      </div>

      <div class="map-stage">
        <div class="editor-canvas" id="editor-canvas">${renderEditorTopology()}</div>
      </div>
    </div>
  `;

  const surface = document.getElementById('editor-canvas');
  const repaint = () => {
    surface.innerHTML = renderEditorTopology();
  };

  const brushBar = document.getElementById('brush-selector');
  brushBar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-brush]');
    if (!btn) return;
    currentBrush = btn.dataset.brush;
    brushBar.querySelectorAll('[data-brush]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.brush === currentBrush);
    });
  });

  document.getElementById('ed-exit').addEventListener('click', renderStartScreen);
  document.getElementById('ed-clear').addEventListener('click', () => {
    editorCabs = [];
    repaint();
  });
  document.getElementById('ed-clear-route').addEventListener('click', () => {
    editorRoute = [];
    repaint();
  });
  document.getElementById('ed-undo-route').addEventListener('click', () => {
    editorRoute.pop();
    repaint();
  });

  document.getElementById('ed-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.cabinets) editorCabs = data.cabinets;
        if (data.route) editorRoute = data.route;
        repaint();
      } catch {
        alert('Не удалось прочитать JSON-файл склада.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('ed-export').addEventListener('click', () => {
    const json = JSON.stringify({ cabinets: editorCabs, route: editorRoute });
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(json).catch(() => {});

    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(json);
    a.download = 'warehouse_layout.json';
    document.body.appendChild(a);
    a.click();
    a.remove();

    const btn = document.getElementById('ed-export');
    btn.textContent = 'Готово';
    setTimeout(() => (btn.textContent = 'Экспорт'), 2000);
  });

  const applyBrush = (e) => {
    const rect = surface.getBoundingClientRect();
    const percentX = ((e.clientX - rect.left) / rect.width) * 100;
    const percentY = ((e.clientY - rect.top) / rect.height) * 100;

    const snapX = getClosest(percentX - cabW / 2, validXs);
    const snapY = getClosest(percentY - cabH / 2, validYs);
    const posKey = `${snapX.toFixed(3)},${snapY.toFixed(3)}`;
    if (lastSnappedPos === posKey) return false;
    lastSnappedPos = posKey;

    if (currentBrush === 'route-dot') {
      if (isDragging) return false;
      editorRoute.push({ x: snapX + cabW / 2, y: snapY + cabH / 2 });
      return true;
    }

    let clickedIndex = -1;
    for (let i = editorCabs.length - 1; i >= 0; i--) {
      const c = editorCabs[i];
      if (snapX === Number(c.x.toFixed(3)) && snapY === Number(c.y.toFixed(3))) {
        clickedIndex = i;
        break;
      }
    }

    if (currentBrush === 'delete') {
      if (clickedIndex === -1) return false;
      editorCabs.splice(clickedIndex, 1);
      return true;
    }

    if (clickedIndex !== -1) {
      Object.assign(editorCabs[clickedIndex], { facing: currentBrush, w: cabW, h: cabH });
    } else {
      editorCabs.push({ x: snapX, y: snapY, w: cabW, h: cabH, facing: currentBrush });
    }
    return true;
  };

  surface.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = false;
    lastSnappedPos = null;
    if (applyBrush(e)) repaint();
    isDragging = true;
  });

  surface.addEventListener('mousemove', (e) => {
    if (!isDragging || currentBrush === 'route-dot') return;
    if (applyBrush(e)) repaint();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    lastSnappedPos = null;
  });
}

// ------------------------------------------------------------------------ старт

if (isAdmin) {
  renderEditorScreen();
} else if (!getPlayer()) {
  renderNameScreen();
} else {
  renderStartScreen();
}
