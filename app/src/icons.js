/**
 * Иконки интерфейса.
 *
 * Раньше часть кнопок несла типографские знаки (`↺`, `✕`, `⤢`, `+`, `−`).
 * У них разные метрики и базовая линия в разных шрифтах, поэтому в кнопке они
 * стояли вразнобой и вразный размер, а `⤢` на части систем и вовсе рисовался
 * заглушкой. Один набор контурных SVG в общей сетке 24×24 решает и то, и другое:
 * размер задаётся классом, а центрирование — сеткой самой кнопки.
 */

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
