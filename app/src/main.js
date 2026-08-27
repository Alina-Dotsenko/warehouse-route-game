import './style.css'
import { levels, editorTemplate } from './levels.js'
import panzoom from 'panzoom';

let currentLevelIndex = 0;
const app = document.querySelector('#app');
const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';

function renderStartScreen() {
  app.innerHTML = `
    <div class="start-screen">
      <h1>route-lab <span>[топология]</span></h1>
      <div class="intro-text">
        <p>Есть система, которая решает задачу — как наиболее оптимальным образом собрать клиентские заказы на складе Ozon. Эта система решает множество подзадач, но финальная — построение маршрута, который необходимо пройти работнику склада для сбора клиентских заказов. Этот маршрут должен быть кратчайшим и обходить такие точки, чтобы собрать как можно больше заказов, но не перегрузить работника склада.</p>
        <p>Несмотря на то, что большая часть процессов автоматизирована, и на текущий момент система закрывает бóльшую часть работы, которая раньше была ручной, она всё ещё ориентируется на некоторые данные, которые задает пользователь. В частности, на топологию склада. Администратор склада представляет физическое расположение шкафов с товаром, конвейеров, стен, пожарных шкафов в системе. Система, ориентируясь на это представление, рассчитывает расстояния между шкафами с товаром и строит наиболее оптимальный маршрут.</p>
        <p>Люди могут ошибаться, но наш основной приоритет — клиент. Даже если администратор склада ошибся в переносе топологии в систему и сделал какой-то шкаф с товаром недостижимым, мы должны построить маршрут до этого шкафа и подобрать товар, который ждет клиент. В системе присутствует множество фолбеков и деградаций, которые дают гарантию, что товар будет подобран.</p>
        <p>Но ошибки не проходят бесследно: фолбеки и деградации приводят к не совсем ожидаемым маршрутам.</p>
        <p style="color: var(--primary); font-style: italic; border-left: 3px solid var(--primary); padding-left: 1rem; margin: 1.5rem 0;">Ведь разработка — это не просто написание строчек кода по готовому ТЗ. Настоящая инженерия заключается в умении исследовать нетривиальные проблемы, распутывать сложные краевые случаи и находить логику там, где система ведет себя непредсказуемо из-за человеческого фактора.</p>
        <p><strong>Сегодня ты сможешь побыть в роли дежурного одной из наших команд и помочь администратору склада найти ошибку в топологии, которая приводит к тому, что маршрут отличается от ожидаемого.</strong></p>
      </div>

      <div class="instructions-container">
        <h3>Как играть</h3>
        <ol class="instructions-list">
          <li>В каждом кейсе вы увидите проблему (жалобу) и текущий маршрут с ошибкой.</li>
          <li>Сравните его с <strong>«Желаемым маршрутом»</strong> с помощью кнопок переключения над картой.</li>
          <li>Внимательно изучите топологию склада: ищите шкафы с перекрытым доступом (стороной подхода), лишние препятствия или заблокированные проходы.</li>
          <li><strong>Кликните по проблемному шкафу</strong> (или нескольким шкафам), из-за которого алгоритм ломается.</li>
          <li>Нажмите кнопку <strong>«Проверить»</strong>, чтобы узнать, правильно ли вы нашли ошибку.</li>
        </ol>
      </div>

      <div class="legend-container">
        <h3>Условные обозначения</h3>
        <div class="legend-grid">
          <div class="legend-item">
            <div class="legend-icon cab-icon facing-bottom"></div>
            <span>Шкаф с товаром. Розовая линия - сторона подхода (facing).</span>
          </div>
          <div class="legend-item">
            <div class="legend-icon cab-icon cab-pick facing-bottom"></div>
            <span>Шкаф, из которого нужно забрать товар.</span>
          </div>
          <div class="legend-item">
            <div class="legend-icon obs-icon"></div>
            <span>Препятствие (стена, конвейер, столб). Непроходимая зона.</span>
          </div>
          <div class="legend-item">
            <div class="legend-icon route-icon"></div>
            <span>Маршрут работника.</span>
          </div>
        </div>
      </div>
      <div style="margin-top: 2rem; margin-bottom: 2rem; font-size: 1.2rem; color: var(--text-muted);">
        Добро пожаловать, <strong style="color: white;">${localStorage.getItem('route-lab_player')}</strong>!
      </div>
      
      <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        ${(parseInt(localStorage.getItem('route-lab_progress'), 10) || 0) > 0 && (parseInt(localStorage.getItem('route-lab_progress'), 10) || 0) < levels.length ? 
          `<button class="btn" id="continue-btn">Продолжить с уровня ${(parseInt(localStorage.getItem('route-lab_progress'), 10) || 0) + 1}</button>
           <button class="btn btn-outline" id="start-btn">Начать сначала</button>` : 
          `<button class="btn" id="start-btn">Пройти все по порядку</button>`}
      </div>
    </div>
  `;

  document.getElementById('start-btn').addEventListener('click', () => {
    localStorage.setItem('route-lab_progress', 0);
    currentLevelIndex = 0;
    renderGameScreen();
  });
  
  const continueBtn = document.getElementById('continue-btn');
  if (continueBtn) {
      continueBtn.addEventListener('click', () => {
          currentLevelIndex = parseInt(localStorage.getItem('route-lab_progress'), 10) || 0;
          renderGameScreen();
      });
  }
}

window.selectedCabinets = new Set();
window.activeRouteType = 'bad';

function renderTopology(level, isEditor = false) {
  let html = '';

  if (level.topology.bounds) {
    const b = level.topology.bounds;
    html += `<div class="warehouse-bounds" style="left: ${b.x}%; top: ${b.y}%; width: ${b.w}%; height: ${b.h}%;"></div>`;
  }

  level.topology.obstacles.forEach(obs => {
    let cls = obs.cssClass ? `obstacle ${obs.cssClass}` : 'obstacle obstacle-black';
    html += `<div class="${cls}" style="left: ${obs.x}%; top: ${obs.y}%; width: ${obs.w}%; height: ${obs.h}%;"></div>`;
  });

  
  

  level.topology.cabinets.forEach((cab, idx) => {
    let facingClass = cab.facing ? `facing-${cab.facing}` : 'facing-bottom';
    let extraClass = isEditor ? ' editor-cab' : '';
    
    let hasPickPoint = false;
    if (activeRoute) {
        for (let pt of activeRoute) {
            if (pt.x >= cab.x - 0.1 && pt.x <= cab.x + cab.w + 0.1 && 
                pt.y >= cab.y - 0.1 && pt.y <= cab.y + cab.h + 0.1) {
                hasPickPoint = true;
                break;
            }
        }
    }
    
    if (!isEditor && window.selectedCabinets && window.selectedCabinets.has(idx)) {
        extraClass += ' cab-selected';
    }
    if (hasPickPoint) {
        extraClass += ' cab-pick';
    }
    html += `<div class="cabinet ${facingClass}${extraClass}" data-idx="${idx}" style="left: ${cab.x}%; top: ${cab.y}%; width: ${cab.w}%; height: ${cab.h}%;"></div>`;
  });

  const generateSvg = (routeArr, id, isVisible) => {
    if (!routeArr || routeArr.length === 0) return '';
    let pathD = '';
    routeArr.forEach((pt, idx) => {
      if (idx === 0) {
        pathD += `M ${pt.x} ${pt.y} `;
      } else {
        let prev = routeArr[idx - 1];
        let dx = pt.x - prev.x;
        let dy = pt.y - prev.y;
        if (Math.abs(dx) < 0.001 || Math.abs(dy) < 0.001 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.001) {
            pathD += `L ${pt.x} ${pt.y} `;
        } else {
            if (Math.abs(dx) > Math.abs(dy)) {
                let ix = prev.x + Math.sign(dx) * (Math.abs(dx) - Math.abs(dy));
                pathD += `L ${ix} ${prev.y} L ${pt.x} ${pt.y} `;
            } else {
                let iy = prev.y + Math.sign(dy) * (Math.abs(dy) - Math.abs(dx));
                pathD += `L ${prev.x} ${iy} L ${pt.x} ${pt.y} `;
            }
        }
      }
    });
    const opacity = isVisible ? '1' : '0';
    return `
      <svg id="${id}" class="route-svg" viewBox="0 0 100 100" preserveAspectRatio="none" style="opacity: ${opacity}; transition: opacity 0.3s ease; pointer-events: none;">
        ${(level.hintZone && window.currentHintStep >= 2) ? `<rect x="${level.hintZone.x}" y="${level.hintZone.y}" width="${level.hintZone.w}" height="${level.hintZone.h}" fill="rgba(255, 204, 0, 0.15)" stroke="#ffcc00" stroke-width="0.3" stroke-dasharray="0.5 0.5" rx="1" />` : ''}
        <path d="${pathD}" class="route-path" pathLength="100" />
        ${routeArr.map(pt => `<circle cx="${pt.x}" cy="${pt.y}" r="0.2" class="route-dot" />`).join('')}
      </svg>
    `;
  };

  if (!isEditor && level.badRoute && level.goodRoute) {
     html += generateSvg(level.badRoute, 'svg-route-bad', window.activeRouteType === 'bad');
     html += generateSvg(level.goodRoute, 'svg-route-good', window.activeRouteType === 'good');
  } else if (level.topology.route) {
     html += generateSvg(level.topology.route, 'svg-route-editor', true);
  }

  return html;
}

let editorCabs = [];
let editorRoute = [];
let editorInitialized = false;

let currentBrush = 'bottom';
let isDragging = false;
let lastSnappedPos = null;

// Precalculate perfect grid coordinates
const U = 0.84;
const cabW = 0.84, cabH = 1.68, gapX = 0.17, aisleY = 3.36, aisleX = 2.52;
const startX = 3.4, startY = 2.0;
const cols = 70, rows = 27;

const getColX = (c) => {
    let x = startX + c * (cabW + gapX);
    for (let b = 1; b <= Math.floor(c / 10); b++) {
        x += (b === 2 || b === 4 || b === 6) ? (aisleX + cabW + aisleX) : aisleX;
    }
    return x;
};

let validXs = [];
for (let c = 0; c < cols; c++) {
    validXs.push(getColX(c));
}
for (let b = 1; b <= 6; b++) {
    let prevC = b * 10 - 1;
    let aisleStartX = getColX(prevC) + cabW + gapX;
    let gapAmount = (b === 2 || b === 4 || b === 6) ? (aisleX + cabW + aisleX) : aisleX;
    for (let s = 0; s < Math.round(gapAmount / U); s++) {
        validXs.push(aisleStartX + s * U);
    }
}
let leftWallStart = startX - aisleX - cabW;
for (let s = 0; s < 5; s++) validXs.push(leftWallStart + s * U);
validXs.sort((a,b) => a-b);
validXs = [...new Set(validXs.map(x => x.toFixed(3)))].map(Number);

let validYs = [];
let currY = startY;
for (let r = 0; r < rows; r++) {
    validYs.push(currY);
    if (r === 0) currY += cabH + aisleY;
    else if (r % 2 === 1) currY += cabH;
    else currY += cabH + aisleY;
}
let minY = Math.min(...validYs) - cabH * 4;
let maxY = Math.max(...validYs) + cabH * 4;
let uniformYs = [];
for (let y = minY; y <= maxY; y += cabH) uniformYs.push(y);
validYs = uniformYs.map(y => Number(y.toFixed(3)));

const getClosest = (val, arr) => arr.reduce((prev, curr) => Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev);

function renderEditorScreen() {
  if (!editorInitialized) {
      editorCabs = JSON.parse(JSON.stringify(editorTemplate.cabinets));
      editorInitialized = true;
  }
  
  app.innerHTML = `
    <div class="header">
      <div class="title">route-lab <span>[конструктор]</span></div>
      <div class="progress">
          <button class="btn btn-sm btn-outline" id="ed-undo-route">Отменить точку ↩</button>
          <button class="btn btn-sm btn-outline" id="ed-clear-route">Очистить маршрут</button>
          <button class="btn btn-sm" id="ed-export">Экспорт кода</button>
          <label class="btn btn-sm btn-outline" style="cursor: pointer; margin: 0; display: inline-flex; align-items: center; justify-content: center;">
              Импорт кода
              <input type="file" id="ed-import" accept=".json" style="display: none;">
          </label>
          <button class="btn btn-sm btn-outline" id="ed-clear">Очистить склады</button>
          <button class="btn btn-sm btn-outline" id="ed-exit">Выйти</button>
      </div>
    </div>
    
    <div class="brush-selector" style="display: flex; gap: 5px; margin-bottom: 10px; flex-wrap: wrap;" id="brush-selector">
        <button class="btn btn-sm" data-brush="bottom">⬇️ Вниз</button>
        <button class="btn btn-sm btn-outline" data-brush="left">⬅️ Влево</button>
        <button class="btn btn-sm btn-outline" data-brush="top">⬆️ Вверх</button>
        <button class="btn btn-sm btn-outline" data-brush="right">➡️ Вправо</button>
        <button class="btn btn-sm btn-outline" data-brush="none">⬛ Глухой блок</button>
        <button class="btn btn-sm btn-outline" data-brush="delete" style="color: #ff6b6b; border-color: #ff6b6b;">❌ Ластик</button>
        <span style="margin: 0 10px; border-left: 1px solid #334155;"></span>
        <button class="btn btn-sm btn-outline" data-brush="route-dot" style="color: #00d4ff; border-color: #00d4ff;">🔵 Точка пути</button>
    </div>
    
    <div class="game-area-wrapper">
      <div class="game-area editor-mode" id="game-area">
        ${renderTopology({topology: {cabinets: editorCabs, bounds: editorTemplate.bounds, obstacles: [], route: editorRoute}}, true)}
      </div>
    </div>

  `;

  const gameArea = document.getElementById('game-area');
  
  // Brush Selector Logic
  const updateBrushUI = () => {
      document.querySelectorAll('#brush-selector .btn').forEach(btn => {
          if (btn.dataset.brush === currentBrush) {
              btn.classList.remove('btn-outline');
          } else {
              btn.classList.add('btn-outline');
          }
      });
  };
  updateBrushUI();

  document.getElementById('brush-selector').addEventListener('click', (e) => {
      const btn = e.target.closest('.btn');
      if (btn && btn.dataset.brush) {
          currentBrush = btn.dataset.brush;
          updateBrushUI();
      }
  });

  document.getElementById('ed-exit').addEventListener('click', renderStartScreen);
  
  document.getElementById('ed-clear').addEventListener('click', () => {
      editorCabs = [];
      renderEditorScreen();
  });
  
  document.getElementById('ed-clear-route').addEventListener('click', () => {
      editorRoute = [];
      gameArea.innerHTML = renderTopology({topology: {cabinets: editorCabs, bounds: editorTemplate.bounds, obstacles: [], route: editorRoute}}, true);
  });
  
  document.getElementById('ed-undo-route').addEventListener('click', () => {
      editorRoute.pop();
      gameArea.innerHTML = renderTopology({topology: {cabinets: editorCabs, bounds: editorTemplate.bounds, obstacles: [], route: editorRoute}}, true);
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
              gameArea.innerHTML = renderTopology({topology: {cabinets: editorCabs, bounds: editorTemplate.bounds, obstacles: [], route: editorRoute}}, true);
              alert("Склад успешно импортирован!");
          } catch (err) {
              alert("Ошибка при чтении JSON-файла! Убедитесь, что это правильный файл склада.");
          }
      };
      reader.readAsText(file);
      e.target.value = ''; 
  });
  
  document.getElementById('ed-export').addEventListener('click', () => {
      const json = JSON.stringify({ cabinets: editorCabs, route: editorRoute });
      
      // 1. Copy to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(json).catch(e => console.error(e));
      } else {
          // Fallback legacy copy
          const ta = document.createElement('textarea');
          ta.value = json;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
      }
      
      // 2. Download file
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(json);
      const a = document.createElement('a');
      a.setAttribute("href", dataStr);
      a.setAttribute("download", "warehouse_layout.json");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // 3. UI Feedback
      const btn = document.getElementById('ed-export');
      const oldText = btn.textContent;
      btn.textContent = 'Скопировано и Скачано!';
      setTimeout(() => btn.textContent = oldText, 2500);
  });

  const applyBrush = (e) => {
      const rect = gameArea.getBoundingClientRect();
      const percentX = ((e.clientX - rect.left) / rect.width) * 100;
      const percentY = ((e.clientY - rect.top) / rect.height) * 100;
      
      const snapX = getClosest(percentX - (cabW/2), validXs);
      const snapY = getClosest(percentY - (cabH/2), validYs);
      const posKey = `${snapX.toFixed(3)},${snapY.toFixed(3)}`;
      
      if (lastSnappedPos === posKey) return false;
      lastSnappedPos = posKey;
      
      if (currentBrush === 'route-dot') {
          if (!isDragging) { 
              editorRoute.push({
                  x: snapX + (cabW/2), // center route dots
                  y: snapY + (cabH/2)
              });
              return true;
          }
          return false;
      }
      
      let clickedIndex = -1;
      for (let i = editorCabs.length - 1; i >= 0; i--) {
         let c = editorCabs[i];
         if (snapX === Number(c.x.toFixed(3)) && snapY === Number(c.y.toFixed(3))) {
             clickedIndex = i;
             break;
         }
      }

      if (currentBrush === 'delete') {
          if (clickedIndex !== -1) {
              editorCabs.splice(clickedIndex, 1);
              return true;
          }
      } else {
          let w = 0.84;
          let h = 1.68;
          let facing = currentBrush;
          
          if (clickedIndex !== -1) {
              editorCabs[clickedIndex].facing = facing;
              editorCabs[clickedIndex].w = w;
              editorCabs[clickedIndex].h = h;
          } else {
              editorCabs.push({x: snapX, y: snapY, w: w, h: h, facing: facing});
          }
          return true;
      }
      return false;
  };

  gameArea.addEventListener('mousedown', (e) => {
    if (e.target.closest('.modal-overlay')) return;
    e.preventDefault(); // prevent text selection while dragging
    isDragging = false; // set to false initially for applyBrush to know it's a click
    lastSnappedPos = null;
    if (applyBrush(e)) {
        gameArea.innerHTML = renderTopology({topology: {cabinets: editorCabs, bounds: editorTemplate.bounds, obstacles: [], route: editorRoute}}, true);
    }
    isDragging = true; // after first apply, we are dragging
  });

  gameArea.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    // Don't draw route on drag
    if (currentBrush === 'route-dot' || currentBrush === 'route-pick') return;
    
    if (applyBrush(e)) {
        gameArea.innerHTML = renderTopology({topology: {cabinets: editorCabs, bounds: editorTemplate.bounds, obstacles: [], route: editorRoute}}, true);
    }
  });

  window.addEventListener('mouseup', () => {
      isDragging = false;
      lastSnappedPos = null;
  });
}

function renderGameScreen() {
  const level = levels[currentLevelIndex];
  window.selectedCabinets = new Set();
  window.activeRouteType = 'bad';
  window.currentHintStep = 0;
  
  app.innerHTML = `
    <div class="header">
      <div class="title">route-lab <span>[ошибка в топологии]</span></div>
      <div class="progress">
        Уровень ${currentLevelIndex + 1} / ${levels.length}
        <span style="margin-left: 15px; font-size: 0.9em; color: #94a3b8; background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px;">
          Нужно найти шкафов: <strong style="color: #fff;">${level.solutionData.count}</strong>
        </span>
      </div>
    </div>
    
    <div class="complaint-card" style="display: flex; flex-direction: column; gap: 1rem; align-items: stretch;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center;">
            <div class="complaint-icon">❓</div>
            <div class="complaint-text">"${level.complaint}"</div>
        </div>
        <div style="display: flex; align-items: center; gap: 1.5rem;">
          <button class="btn" id="btn-hint" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.3);">💡 Подсказка</button>
          <div class="route-tabs">
            <button class="tab-btn active" id="btn-route-bad">Получившийся маршрут</button>
            <button class="tab-btn" id="btn-route-good">Желаемый маршрут</button>
          </div>
        </div>
      </div>
      <div id="hint-text-container" style="display: none; padding: 10px 15px; background: rgba(255, 204, 0, 0.1); border-left: 3px solid #ffcc00; color: #ffcc00; border-radius: 4px; font-size: 0.95rem;">
        ${level.hintText}
      </div>
    </div>
    
    <div class="game-area-wrapper">
      <div class="game-area" id="game-area">
        ${renderTopology(level)}
      </div>
    </div>

    <div style="text-align: right; margin-top: 1.5rem; margin-bottom: 2rem;">
      <button class="btn" id="btn-verify" style="background: var(--secondary); font-size: 1.1rem; padding: 0.8rem 2rem; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">Проверить решение</button>
    </div>

    <div class="modal-overlay" id="success-modal">
      <div class="modal">
        <h2 id="modal-title">Отлично! 🎉</h2>
        <p id="modal-text">${level.successMessage}</p>
        <button class="btn" id="next-btn">${currentLevelIndex === levels.length - 1 ? 'Завершить игру' : 'Следующий уровень'}</button>
      </div>
    </div>
  `;

  const gameArea = document.getElementById('game-area');
  const modal = document.getElementById('success-modal');
  const btnBad = document.getElementById('btn-route-bad');
  const btnGood = document.getElementById('btn-route-good');
  const btnVerify = document.getElementById('btn-verify');

  const btnHint = document.getElementById('btn-hint');
  
  if (window.currentHintStep === undefined) {
      window.currentHintStep = 0;
  }
  
  // Re-apply hint state if rendering again (e.g., when route tabs change)
  if (window.currentHintStep >= 1) {
      document.getElementById('hint-text-container').style.display = 'block';
      btnHint.innerText = '💡 Подсветить зону';
  }
  if (window.currentHintStep >= 2) {
      btnHint.style.display = 'none';
  }

  btnHint.addEventListener('click', () => {
    window.currentHintStep++;
    if (window.currentHintStep === 1) {
       document.getElementById('hint-text-container').style.display = 'block';
       btnHint.innerText = '💡 Подсветить зону';
    } else if (window.currentHintStep === 2) {
       btnHint.style.display = 'none';
       gameArea.innerHTML = renderTopology(level);
    }
  });

  const pz = panzoom(gameArea, {
    maxZoom: 20,
    minZoom: 0.5,
    bounds: true,
    boundsPadding: 0.2,
    zoomDoubleClickSpeed: 1 // disable double click zoom to prevent interference
  });

  btnBad.addEventListener('click', () => {
      window.activeRouteType = 'bad';
      btnBad.classList.add('active');
      btnGood.classList.remove('active');
      const bad = document.getElementById('svg-route-bad');
      const good = document.getElementById('svg-route-good');
      if (bad) bad.style.opacity = '1';
      if (good) good.style.opacity = '0';
  });
  
  btnGood.addEventListener('click', () => {
      window.activeRouteType = 'good';
      btnGood.classList.add('active');
      btnBad.classList.remove('active');
      const bad = document.getElementById('svg-route-bad');
      const good = document.getElementById('svg-route-good');
      if (bad) bad.style.opacity = '0';
      if (good) good.style.opacity = '1';
  });

  const handleCabClick = (cabEl) => {
    if (cabEl) {
        const idx = parseInt(cabEl.dataset.idx, 10);
        if (window.selectedCabinets.has(idx)) {
            window.selectedCabinets.delete(idx);
            cabEl.classList.remove('cab-pick');
        } else {
            window.selectedCabinets.add(idx);
            cabEl.classList.add('cab-pick');
        }
    }
  };

  gameArea.addEventListener('click', (e) => {
    handleCabClick(e.target.closest('.cabinet'));
  });

  let touchStartX = 0;
  let touchStartY = 0;
  gameArea.addEventListener('touchstart', (e) => {
      if (e.changedTouches && e.changedTouches.length > 0) {
          touchStartX = e.changedTouches[0].screenX;
          touchStartY = e.changedTouches[0].screenY;
      }
  }, {passive: true});

  gameArea.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches.length > 0) {
          let dx = e.changedTouches[0].screenX - touchStartX;
          let dy = e.changedTouches[0].screenY - touchStartY;
          if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
              handleCabClick(e.target.closest('.cabinet'));
              if (e.cancelable) e.preventDefault();
          }
      }
  });

  btnVerify.addEventListener('click', async () => {
      const selectedIndices = Array.from(window.selectedCabinets).sort((a, b) => a - b);
      
      let isCorrect = false;
      if (selectedIndices.length === level.solutionData.count) {
          const key = 'ozon_tech_secret_2026';
          const encoder = new TextEncoder();
          const data = encoder.encode(selectedIndices.join(',') + key);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          
          let xorResult = '';
          for (let i = 0; i < hashHex.length; i++) {
              xorResult += String.fromCharCode(hashHex.charCodeAt(i) ^ key.charCodeAt(i % key.length));
          }
          const obfuscated = btoa(xorResult);
          
          if (obfuscated === level.solutionData.hash) {
              isCorrect = true;
          }
      }

      const mTitle = document.getElementById('modal-title');
      const mText = document.getElementById('modal-text');
      const nxtBtn = document.getElementById('next-btn');

      if (isCorrect) {
          mTitle.textContent = "Отлично! 🎉";
          mText.textContent = level.successMessage;
          nxtBtn.textContent = currentLevelIndex === levels.length - 1 ? 'Завершить игру' : 'Следующий уровень';
          
          const currentProgress = parseInt(localStorage.getItem('route-lab_progress'), 10) || 0;
          if (currentLevelIndex + 1 > currentProgress) {
              localStorage.setItem('route-lab_progress', currentLevelIndex + 1);
          }

          nxtBtn.onclick = () => {
              modal.classList.remove('active');
              currentLevelIndex++;
              if (currentLevelIndex < levels.length) {
                  setTimeout(renderGameScreen, 300);
              } else {
                  setTimeout(renderEndScreen, 300);
              }
          };
      } else {
          mTitle.textContent = "Ошибка ❌";
          mText.textContent = "Вы выбрали не те шкафы. Посмотрите внимательнее на 'Желаемый маршрут', какие шкафы он пересекает?";
          nxtBtn.textContent = "Попробовать снова";
          nxtBtn.onclick = () => {
              modal.classList.remove('active');
          };
      }
      modal.classList.add('active');
  });

}

function createMarker(container, x, y, isSuccess) {
  const marker = document.createElement('div');
  marker.className = `marker ${isSuccess ? 'success' : 'error'}`;
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  container.appendChild(marker);

  if (!isSuccess) {
    setTimeout(() => {
      marker.style.opacity = '0';
      marker.style.transition = 'opacity 0.5s';
      setTimeout(() => marker.remove(), 500);
    }, 1000);
  }
}

function renderEndScreen() {
  const name = localStorage.getItem('route-lab_player') || '';
  app.innerHTML = `
    <div class="start-screen">
      <h1>Поздравляем${name ? ', ' + name : ''}! 🎉</h1>
      <p>Вы успешно нашли все ошибки в топологии.</p>
      <button class="btn" id="restart-btn" style="margin-top: 2rem;">Сыграть еще раз</button>
    </div>
  `;
  document.getElementById('restart-btn').addEventListener('click', () => {
    localStorage.setItem('route-lab_progress', 0);
    currentLevelIndex = 0;
    renderStartScreen();
  });
}

function renderNameScreen() {
  app.innerHTML = `
    <div class="start-screen" style="justify-content: center; height: 100vh;">
      <h1>route-lab <span>[топология]</span></h1>
      <div class="player-setup" style="margin-top: 2rem; background: var(--bg-card); padding: 3rem 2rem; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1); text-align: center; width: 100%; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <h2 style="margin-bottom: 1.5rem; color: var(--text);">Представьтесь:</h2>
        <input type="text" id="initial-name-input" placeholder="Ваше имя..." style="padding: 1rem; border-radius: 8px; border: 1px solid var(--primary); background: rgba(0,0,0,0.5); color: white; font-size: 1.2rem; width: 100%; margin-bottom: 1.5rem; outline: none; text-align: center;">
        <br>
        <button class="btn" id="save-name-btn" disabled style="opacity: 0.5; width: 100%;">Продолжить</button>
      </div>
    </div>
  `;

  const input = document.getElementById('initial-name-input');
  const btn = document.getElementById('save-name-btn');

  input.addEventListener('input', () => {
    if (input.value.trim().length > 0) {
      btn.disabled = false;
      btn.style.opacity = '1';
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.5';
    }
  });
  
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !btn.disabled) {
      btn.click();
    }
  });

  btn.addEventListener('click', () => {
    localStorage.setItem('route-lab_player', input.value.trim());
    renderStartScreen();
  });
}

if (!localStorage.getItem('route-lab_player')) {
  renderNameScreen();
} else {
  renderStartScreen();
}

