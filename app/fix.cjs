const fs = require('fs');
let code = fs.readFileSync('C:/Users/Sergei/Documents/route-lab/app/src/main.js', 'utf8');

const oldSvgGen = '  if (activeRoute && activeRoute.length > 0) {';
const oldSvgGenEnd = '  return html;';
const startIdx = code.indexOf(oldSvgGen);
const endIdx = code.indexOf(oldSvgGenEnd, startIdx);

const newSvgLogic = `  const generateSvg = (routeArr, id, isVisible) => {
    if (!routeArr || routeArr.length === 0) return '';
    let pathD = '';
    routeArr.forEach((pt, idx) => {
      if (idx === 0) {
        pathD += \`M \${pt.x} \${pt.y} \`;
      } else {
        let prev = routeArr[idx - 1];
        let dx = pt.x - prev.x;
        let dy = pt.y - prev.y;
        if (Math.abs(dx) < 0.001 || Math.abs(dy) < 0.001 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.001) {
            pathD += \`L \${pt.x} \${pt.y} \`;
        } else {
            if (Math.abs(dx) > Math.abs(dy)) {
                let ix = prev.x + Math.sign(dx) * (Math.abs(dx) - Math.abs(dy));
                pathD += \`L \${ix} \${prev.y} L \${pt.x} \${pt.y} \`;
            } else {
                let iy = prev.y + Math.sign(dy) * (Math.abs(dy) - Math.abs(dx));
                pathD += \`L \${prev.x} \${iy} L \${pt.x} \${pt.y} \`;
            }
        }
      }
    });
    const opacity = isVisible ? '1' : '0';
    return \`
      <svg id="\${id}" class="route-svg" viewBox="0 0 100 100" preserveAspectRatio="none" style="opacity: \${opacity}; transition: opacity 0.3s ease; pointer-events: none;">
        \${(level.hintZone && window.currentHintStep >= 2) ? \`<rect x="\${level.hintZone.x}" y="\${level.hintZone.y}" width="\${level.hintZone.w}" height="\${level.hintZone.h}" fill="rgba(255, 204, 0, 0.15)" stroke="#ffcc00" stroke-width="0.3" stroke-dasharray="0.5 0.5" rx="1" />\` : ''}
        <path d="\${pathD}" class="route-path" pathLength="100" />
        \${routeArr.map(pt => \`<circle cx="\${pt.x}" cy="\${pt.y}" r="0.2" class="route-dot" />\`).join('')}
      </svg>
    \`;
  };

  if (!isEditor && level.badRoute && level.goodRoute) {
     html += generateSvg(level.badRoute, 'svg-route-bad', window.activeRouteType === 'bad');
     html += generateSvg(level.goodRoute, 'svg-route-good', window.activeRouteType === 'good');
  } else if (level.topology.route) {
     html += generateSvg(level.topology.route, 'svg-route-editor', true);
  }

`;

code = code.substring(0, startIdx) + newSvgLogic + code.substring(endIdx);
code = code.replace('let activeRoute = level.topology.route;', '');
code = code.replace("if (!isEditor && window.activeRouteType) {\r\n      activeRoute = window.activeRouteType === 'good' ? level.goodRoute : level.badRoute;\r\n  }", '');
code = code.replace("if (!isEditor && window.activeRouteType) {\n      activeRoute = window.activeRouteType === 'good' ? level.goodRoute : level.badRoute;\n  }", '');
code = code.replace('let hasPickPoint = activeRoute.some(p =>', 'let hasPickPoint = (level.badRoute || []).some(p =>');
fs.writeFileSync('C:/Users/Sergei/Documents/route-lab/app/src/main.js', code);
