const fs = require('fs');
let code = fs.readFileSync('C:/Users/Sergei/Documents/route-lab/app/src/main.js', 'utf8');

// 1. In renderTopology, replace the DOM generation with Canvas for game mode
const renderTopologyTarget = `  if (level.topology.bounds) {
    const b = level.topology.bounds;
    html += \`<div class="warehouse-bounds" style="left: \${b.x}%; top: \${b.y}%; width: \${b.w}%; height: \${b.h}%;"></div>\`;
  }

  level.topology.obstacles.forEach(obs => {
    let cls = obs.cssClass ? \`obstacle \${obs.cssClass}\` : 'obstacle obstacle-black';
    html += \`<div class="\${cls}" style="left: \${obs.x}%; top: \${obs.y}%; width: \${obs.w}%; height: \${obs.h}%;"></div>\`;
  });

  
  

  level.topology.cabinets.forEach((cab, idx) => {
    let facingClass = cab.facing ? \`facing-\${cab.facing}\` : 'facing-bottom';
    let extraClass = isEditor ? ' editor-cab' : '';
    
    let hasPickPoint = false;
    let activeRoute = level.badRoute || level.topology.route;
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
    html += \`<div class="cabinet \${facingClass}\${extraClass}" data-idx="\${idx}" style="left: \${cab.x}%; top: \${cab.y}%; width: \${cab.w}%; height: \${cab.h}%;"></div>\`;
  });`;

const renderTopologyReplacement = `  if (!isEditor) {
    html += \`<canvas id="bg-canvas" width="4000" height="2000" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></canvas>\`;
    html += \`<div id="selection-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>\`;
  } else {
    if (level.topology.bounds) {
      const b = level.topology.bounds;
      html += \`<div class="warehouse-bounds" style="left: \${b.x}%; top: \${b.y}%; width: \${b.w}%; height: \${b.h}%;"></div>\`;
    }

    level.topology.obstacles.forEach(obs => {
      let cls = obs.cssClass ? \`obstacle \${obs.cssClass}\` : 'obstacle obstacle-black';
      html += \`<div class="\${cls}" style="left: \${obs.x}%; top: \${obs.y}%; width: \${obs.w}%; height: \${obs.h}%;"></div>\`;
    });

    level.topology.cabinets.forEach((cab, idx) => {
      let facingClass = cab.facing ? \`facing-\${cab.facing}\` : 'facing-bottom';
      let extraClass = ' editor-cab';
      html += \`<div class="cabinet \${facingClass}\${extraClass}" data-idx="\${idx}" style="left: \${cab.x}%; top: \${cab.y}%; width: \${cab.w}%; height: \${cab.h}%;"></div>\`;
    });
  }`;
code = code.replace(renderTopologyTarget, renderTopologyReplacement);

// 2. Add drawCanvasMap and updateSelectionLayer globally
const topLevelAddition = `
window.drawCanvasMap = (level) => {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    if (level.topology.bounds) {
        const b = level.topology.bounds;
        ctx.fillStyle = 'rgba(0, 91, 255, 0.02)';
        ctx.strokeStyle = 'rgba(0, 91, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 10]);
        ctx.fillRect(b.x/100*w, b.y/100*h, b.w/100*w, b.h/100*h);
        ctx.strokeRect(b.x/100*w, b.y/100*h, b.w/100*w, b.h/100*h);
        ctx.setLineDash([]);
    }
    
    level.topology.obstacles.forEach(obs => {
        ctx.fillStyle = obs.cssClass ? 'rgba(0,0,0,0.5)' : '#1e293b';
        ctx.fillRect(obs.x/100*w, obs.y/100*h, obs.w/100*w, obs.h/100*h);
    });
    
    let activeRoute = level.badRoute || level.topology.route;
    
    level.topology.cabinets.forEach((cab, idx) => {
        let isPick = false;
        if (activeRoute) {
            for (let pt of activeRoute) {
                if (pt.x >= cab.x - 0.1 && pt.x <= cab.x + cab.w + 0.1 && 
                    pt.y >= cab.y - 0.1 && pt.y <= cab.y + cab.h + 0.1) {
                    isPick = true;
                    break;
                }
            }
        }
        
        const cx = cab.x/100*w;
        const cy = cab.y/100*h;
        const cw = cab.w/100*w;
        const ch = cab.h/100*h;
        
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(cx, cy, cw, ch);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 4; // Because canvas is 4000x2000, 4px line is roughly 1px on screen
        ctx.strokeRect(cx, cy, cw, ch);
        
        ctx.fillStyle = '#ff1493';
        if (cab.facing === 'bottom' || !cab.facing) ctx.fillRect(cx, cy + ch - 12, cw, 12);
        else if (cab.facing === 'top') ctx.fillRect(cx, cy, cw, 12);
        else if (cab.facing === 'left') ctx.fillRect(cx, cy, 12, ch);
        else if (cab.facing === 'right') ctx.fillRect(cx + cw - 12, cy, 12, ch);
        else if (cab.facing === 'none') {
            ctx.fillStyle = '#334155';
            ctx.fillRect(cx, cy, cw, ch);
        }
        
        if (isPick) {
            ctx.fillStyle = '#f91155';
            ctx.beginPath();
            ctx.arc(cx + cw/2, cy + ch/2, Math.min(cw, ch)*0.3, 0, Math.PI*2);
            ctx.fill();
        }
    });
};

window.updateSelectionLayer = (level) => {
    const layer = document.getElementById('selection-layer');
    if (!layer) return;
    let html = '';
    window.selectedCabinets.forEach(idx => {
        const cab = level.topology.cabinets[idx];
        html += \`<div class="cab-selected" style="position: absolute; left: \${cab.x}%; top: \${cab.y}%; width: \${cab.w}%; height: \${cab.h}%; box-sizing: border-box; border: 2px solid #10b981; box-shadow: 0 0 15px rgba(16, 185, 129, 0.7), inset 0 0 10px rgba(16, 185, 129, 0.5); z-index: 10;"></div>\`;
    });
    layer.innerHTML = html;
};
`;

code = code.replace("const isEditor = window.location.pathname.includes('editor');", "const isEditor = window.location.pathname.includes('editor');\n" + topLevelAddition);

// 3. Add canvas rendering calls
code = code.replace(
  "gameArea.innerHTML = renderTopology(level);", 
  "gameArea.innerHTML = renderTopology(level);\n       window.drawCanvasMap(level);\n       window.updateSelectionLayer(level);"
);
code = code.replace(
  "${renderTopology(level)}", 
  "${renderTopology(level)}\n        <img src=\"empty\" onerror=\"window.drawCanvasMap(levels[currentLevelIndex]); window.updateSelectionLayer(levels[currentLevelIndex]); this.remove();\" style=\"display:none;\"/>"
);

// 4. Update click handler to hit-test canvas
const oldClickHandler = `  gameArea.addEventListener('click', (e) => {
    const cabEl = e.target.closest('.cabinet');
    if (cabEl) {
      if (!isEditor) {
        handleCabClick(cabEl);
      } else {
        if (currentTool === 'delete') {
          const idx = parseInt(cabEl.dataset.idx, 10);
          editorCabs.splice(idx, 1);
          gameArea.innerHTML = renderTopology({topology: {cabinets: editorCabs, bounds: editorTemplate.bounds, obstacles: [], route: editorRoute}}, true);
        }
      }
    } else if (isEditor && currentTool === 'add') {
      const rect = gameArea.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      editorCabs.push({ x: x - 0.5, y: y - 1, w: 1, h: 2, facing: 'bottom' });
      gameArea.innerHTML = renderTopology({topology: {cabinets: editorCabs, bounds: editorTemplate.bounds, obstacles: [], route: editorRoute}}, true);
    }
  });`;

const newClickHandler = `  gameArea.addEventListener('click', (e) => {
    if (e.target.closest('.tab-btn') || e.target.closest('.btn')) return;

    if (!isEditor) {
      const rect = gameArea.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      
      let clickedIdx = -1;
      const level = levels[currentLevelIndex];
      for (let i = level.topology.cabinets.length - 1; i >= 0; i--) {
          const cab = level.topology.cabinets[i];
          if (xPct >= cab.x && xPct <= cab.x + cab.w && yPct >= cab.y && yPct <= cab.y + cab.h) {
              clickedIdx = i;
              break;
          }
      }
      
      if (clickedIdx !== -1) {
          if (window.selectedCabinets.has(clickedIdx)) {
              window.selectedCabinets.delete(clickedIdx);
          } else {
              window.selectedCabinets.add(clickedIdx);
          }
          window.updateSelectionLayer(level);
      }
    } else {
      // Editor logic
      const cabEl = e.target.closest('.cabinet');
      if (cabEl && currentTool === 'delete') {
        const idx = parseInt(cabEl.dataset.idx, 10);
        editorCabs.splice(idx, 1);
        gameArea.innerHTML = renderTopology({topology: {cabinets: editorCabs, bounds: editorTemplate.bounds, obstacles: [], route: editorRoute}}, true);
      } else if (currentTool === 'add') {
        const rect = gameArea.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        editorCabs.push({ x: x - 0.5, y: y - 1, w: 1, h: 2, facing: 'bottom' });
        gameArea.innerHTML = renderTopology({topology: {cabinets: editorCabs, bounds: editorTemplate.bounds, obstacles: [], route: editorRoute}}, true);
      }
    }
  });`;

code = code.replace(oldClickHandler, newClickHandler);

fs.writeFileSync('C:/Users/Sergei/Documents/route-lab/app/src/main.js', code);
