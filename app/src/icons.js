/**
 * Иконки интерфейса.
 *
 * Раньше часть кнопок несла типографские знаки (`↺`, `✕`, `⤢`, `+`, `−`).
 * У них разные метрики и базовая линия в разных шрифтах, поэтому в кнопке они
 * стояли вразнобой и вразный размер, а `⤢` на части систем и вовсе рисовался
 * заглушкой. Один набор контурных SVG в общей сетке 24×24 решает и то, и другое:
 * размер задаётся классом, а центрирование — сеткой самой кнопки.
 */

const STATUS_PATHS = {
  check: ['M5 12.5 9.3 16.8 19 7'],
  retry: ['M4 12a8 8 0 1 0 2.35-5.65L4 8.7', 'M4 4v4.7h4.7'],
};

const svgPaths = (paths) => paths.map((d) => `<path d="${d}"/>`).join('');

const PATHS = {
  // Подсказка
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z"/>',
  // Сбросить выбор
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.7 9.7 0 0 0-6.7 2.7L3 8"/><path d="M3 3v5h5"/>',
  // Выйти
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  // Масштаб
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  // Показать весь склад
  fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  // Звук
  soundOn:
    '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  soundOff: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6M21 9l-5 6"/>',
  // Статусы
  check: svgPaths(STATUS_PATHS.check),
  retry: svgPaths(STATUS_PATHS.retry),
  // Инструменты конструктора
  arrowDown: '<path d="M12 4v15M6.5 13.5 12 19l5.5-5.5"/>',
  arrowLeft: '<path d="M20 12H5M10.5 6.5 5 12l5.5 5.5"/>',
  arrowUp: '<path d="M12 20V5M6.5 10.5 12 5l5.5 5.5"/>',
  arrowRight: '<path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5"/>',
  block: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m7 17 10-10M7 10l7 7"/>',
  eraser: '<path d="m4.5 15.5 8.8-8.8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12 18H7l-2.5-2.5Z"/><path d="m10 10 5 5M12 18h8"/>',
  waypoint: '<path d="M5 18c2.5-7 5.5 1 8-6s4.5-2.5 6-6"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/>',
  undo: '<path d="m9 7-5 5 5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/>',
  routeClear: '<path d="M4 17c3-8 6 2 9-6 1-2.7 3.2-3.3 5.5-2.1"/><circle cx="4" cy="17" r="1.7"/><path d="m16 15 5 5m0-5-5 5"/>',
  download: '<path d="M12 3v12m-4.5-4.5L12 15l4.5-4.5M4 20h16"/>',
  upload: '<path d="M12 16V4m-4.5 4.5L12 4l4.5 4.5M4 20h16"/>',
  trash: '<path d="M4 7h16M9 3h6l1 4H8l1-4ZM7 7l1 14h8l1-14M10 11v6m4-6v6"/>',
};

/**
 * @param {keyof PATHS} name
 * @param {string} [extraClass] дополнительный класс, например для состояний
 */
export function icon(name, extraClass = '') {
  const cls = extraClass ? `icon ${extraClass}` : 'icon';
  return (
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    PATHS[name] +
    '</svg>'
  );
}

/**
 * Рисует в canvas тот же статусный контур, который функция icon() отдаёт в
 * SVG. Так сообщение Гоши и модальное окно не расходятся визуально.
 */
export function drawStatusIcon(ctx, name, centerX, centerY, size, lineWidth = 1.8) {
  const paths = STATUS_PATHS[name];
  if (!paths || typeof Path2D === 'undefined') return;

  const scale = size / 24;
  ctx.save();
  ctx.translate(centerX - size / 2, centerY - size / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'transparent';
  ctx.lineWidth = lineWidth / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of paths) ctx.stroke(new Path2D(d));
  ctx.restore();
}
