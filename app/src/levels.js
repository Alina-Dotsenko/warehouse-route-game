import task1 from '../../example/task1_level.json';
import task2 from '../../example/task2_level.json';
import task3 from '../../example/task3_level.json';
import task4 from '../../example/task4_level.json';
import task5 from '../../example/task5_level.json';

function buildLevel(type) {
  let cabs = [];
  const startX = 3.4, startY = 2.0; 
  const U = 0.84;
  const cabW = 0.84, cabH = 1.68, gapX = 0.17, aisleY = 3.36;
  const cols = 70; 
  const rows = 27; 
  const aisleX = 2.52;

  let obstacles = [];
  // Expanded bounds to ensure far left and right walls are visible
  let bounds = { x: -5, y: 3, w: 115, h: 95 }; 

  let rowYs = [];
  let currentY = startY;
  for (let r = 0; r < rows; r++) {
      rowYs.push(currentY);
      if (r % 2 === 1) { 
          currentY += cabH; // back-to-back
      } else { 
          currentY += cabH + aisleY; // aisle
      }
  }

  // Helper to calculate X for a given column
  const getColX = (c) => {
      let x = startX + c * (cabW + gapX);
      for (let b = 1; b <= Math.floor(c / 10); b++) {
          if (b === 2 || b === 4 || b === 6) {
              x += aisleX + cabW + aisleX; // Extra wide gap for internal walls
          } else {
              x += aisleX; // Normal cross-aisle
          }
      }
      return x;
  };

  // GENERATE MAIN CABINETS
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let x = getColX(c);
      let y = rowYs[r];
      let w = cabW;
      let h = cabH;
      let facing = (r % 2 === 1) ? 'top' : 'bottom';
      
      let skip = false;
      // Mark 1: vertical hole in block 1
      if ((r === 3 || r === 4) && c === 5) skip = true;
      // Mark 2: horizontal hole in zone 2 left block
      if ((r === 11 || r === 12) && c >= 20 && c <= 29) skip = true;
      // Mark 3: horizontal hole in zone 3 right block (top)
      if ((r === 3 || r === 4) && c >= 50 && c <= 59) skip = true;
      // Mark 4: horizontal hole in zone 3 left block (bottom)
      if ((r === 19 || r === 20) && c >= 40 && c <= 49) skip = true;
      // Mark 5: horizontal hole in zone 4 (top row)
      if (r === 0 && c >= 60 && c <= 69) skip = true;

      if (!skip) {
        cabs.push({x, y, w, h, facing});
      }
    }
  }

  // ADD THE PURPLE LINES (SOLID VERTICAL WALLS OF CABINETS)
  const getWallX = (blocks) => {
      let prevC = blocks * 10 - 1;
      return getColX(prevC) + cabW + gapX + aisleX;
  };
  
  let wallXs = [
    startX - aisleX - cabW, // Line 1 (Far left edge)
    getWallX(2),            // Line 2 (After col 19)
    getWallX(4),            // Line 3 (After col 39)
    getWallX(6)             // Line 4 (After col 59)
  ];

  let wallStartY = startY - cabH;
  let wallEndY = rowYs[rows-1] + cabH;
  
  for (let i = 0; i < wallXs.length; i++) {
      let x = wallXs[i];
      let facing = (i === 0 || i === 2) ? 'right' : 'left';
      for (let y = wallStartY; y <= wallEndY; y += cabH) {
          let skip = false;
          // Mark 6: Door in Wall 4
          if (i === 3) {
              let gapTop = rowYs[7] - 0.1;
              let gapBottom = rowYs[10] + cabH + 0.1;
              if (y >= gapTop && y <= gapBottom) skip = true;
          }
          if (!skip) {
              cabs.push({x: x, y: y, w: cabW, h: cabH, facing: facing});
          }
      }
  }

  // ADD THE PURPLE AISLE BLOCKERS (11 Marks)
  const addAisleBlock = (aisleIdx, type, refC) => {
      let x;
      if (type === 'col') {
          // Centered on a specific column
          x = getColX(refC);
      } else if (type === 'before') {
          // Centered in the aisle gap BEFORE a specific column
          x = getColX(refC) - aisleX/2 - cabW/2;
      } else if (type === 'after') {
          // Centered in the aisle gap AFTER a specific column
          x = getColX(refC) + cabW + gapX + aisleX/2 - cabW/2;
      }
      
      let y = rowYs[2 * aisleIdx - 2] + cabH + (aisleY - cabW) / 2;
      // facing: 'none' ensures it doesn't get the default facing-bottom class
      cabs.push({x: x, y: y, w: cabW, h: cabW, facing: 'none'});
  };

  addAisleBlock(1, 'col', 14);
  addAisleBlock(1, 'before', 20);
  addAisleBlock(1, 'before', 30);
  addAisleBlock(1, 'before', 40);
  addAisleBlock(1, 'before', 50);
  
  addAisleBlock(3, 'after', 59);
  addAisleBlock(5, 'before', 30);
  addAisleBlock(6, 'before', 50);
  addAisleBlock(8, 'before', 20);
  addAisleBlock(9, 'before', 40);
  addAisleBlock(12, 'before', 20);

  // GENERATE ROUTE
  let route = [];
  
  // The route will zigzag across the ENTIRE warehouse, 
  // punching through all 4 solid walls on every single row!
  const leftVerticalX = wallXs[0] - aisleX/2; // Outside the far left wall
  const rightVerticalX = getColX(69) + cabW + gapX + aisleX/2; // Outside the far right block

  route.push({x: leftVerticalX, y: startY - aisleY/2});
  let direction = 1;

  const addPick = (cIdx, walkY, walkRow) => {
    let cabX = getColX(cIdx);
    let cabY = rowYs[walkRow] + cabH/2; 
    route.push({x: cabX + cabW/2, y: walkY});
    route.push({x: cabX + cabW/2, y: cabY, isPick: true});
    route.push({x: cabX + cabW/2, y: walkY});
  };

  // MASSIVE ZIGZAG
  for (let walkRow = 0; walkRow < 24; walkRow+=2) { 
    let walkY = rowYs[walkRow] + cabH + aisleY/2;
    
    let startAisleX = direction === 1 ? leftVerticalX : rightVerticalX;
    route.push({x: startAisleX, y: walkY});

    // Pick items across all zones
    for (let p = 1; p <= 4; p++) {
      let fraction = p / 5;
      let colIdx = direction === 1 ? Math.floor(fraction * 65) : Math.floor((1 - fraction) * 65);
      let cabY = (p % 2 === 0) ? rowYs[walkRow] + cabH/2 : rowYs[walkRow+1] + cabH/2; 
      addPick(colIdx, walkY, walkRow);
    }
    let endAisleX = direction === 1 ? rightVerticalX : leftVerticalX;
    route.push({x: endAisleX, y: walkY});
    direction *= -1;
  }

  return { cabinets: cabs, route, obstacles, bounds };
}

function buildBaseTemplate() {
  let cabs = [];
  const startX = 3.4, startY = 2.0; 
  const U = 0.84;
  const cabW = 0.84, cabH = 1.68, gapX = 0.17, aisleY = 3.36;
  const cols = 70; 
  const rows = 27; 
  const aisleX = 2.52;

  let bounds = { x: -5, y: 3, w: 115, h: 95 }; 

  let rowYs = [];
  let currentY = startY;
  for (let r = 0; r < rows; r++) {
      rowYs.push(currentY);
      currentY += (r % 2 === 1) ? cabH : cabH + aisleY;
  }

  const getColX = (c) => {
      let x = startX + c * (cabW + gapX);
      for (let b = 1; b <= Math.floor(c / 10); b++) {
          x += (b === 2 || b === 4 || b === 6) ? (aisleX + cabW + aisleX) : aisleX;
      }
      return x;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Форма буквы "Н": 
      // Левая ножка: колонки 0-19
      // Правая ножка: колонки 50-69
      // Центральная перемычка: ряды 10-15
      let isLeftLeg = (c < 20);
      let isRightLeg = (c >= 50);
      let isConnector = (r >= 10 && r <= 15);
      
      if (isLeftLeg || isRightLeg || isConnector) {
          cabs.push({
            x: getColX(c), 
            y: rowYs[r], 
            w: cabW, h: cabH, 
            facing: (r % 2 === 1) ? 'top' : 'bottom'
          });
      }
    }
  }

  const getWallX = (blocks) => {
      let prevC = blocks * 10 - 1;
      return getColX(prevC) + cabW + gapX + aisleX;
  };
  
  let wallXs = [startX - aisleX - cabW, getWallX(2), getWallX(4), getWallX(6)];
  
  for (let i = 0; i < wallXs.length; i++) {
      let x = wallXs[i];
      let facing = (i === 0 || i === 2) ? 'right' : 'left';
      // Для буквы "Н":
      // Стены 0, 1 и 3 находятся внутри вертикальных ножек и идут до самого низа.
      // Стена 2 (x2, после 39 колонки) попадает на пустое пространство, поэтому она
      // должна быть только там, где есть центральная перемычка (ряды 10-15).
      
      let minY = (i === 2) ? rowYs[10] - cabH : startY - cabH;
      let maxY = (i === 2) ? rowYs[15] + cabH : rowYs[rows - 1] + cabH;
      
      for (let y = minY; y <= maxY; y += cabH) {
          cabs.push({x: x, y: y, w: cabW, h: cabH, facing: facing});
      }
  }

  return { cabinets: cabs, route: [], obstacles: [], bounds };
}

export const levels = [
  { 
      id: 1, 
      complaint: "В правой части маршрут пересекается, мы дважды проходим одно и то же место.", 
      successMessage: "Превосходно! Вы нашли этот заблокированный шкаф.",
      hintText: "Посмотрите на правую часть карты, где линия маршрута образует странную петлю. Ошибка находится где-то внутри этой петли.",
      hintZone: { x: 93, y: 25, w: 7, h: 10 },
      topology: { cabinets: task5.topology, bounds: { x: -5, y: 3, w: 115, h: 95 }, obstacles: [], route: [] },
      badRoute: task5.badRoute,
      goodRoute: task5.goodRoute,
      solutionData: task5.solutionData
  },
  { 
      id: 2, 
      complaint: "У меня была линия из шкафов, которые надо обойти, но один из них был пропущен, и я туда вернулся только в конце маршрута, тем самым пройдя намного бОльшее расстояние.", 
      successMessage: "Прекрасно! Вы вычислили шкаф, который смотрел в другую сторону.",
      hintText: "Обратите внимание на длинный крюк маршрута. Один из целевых шкафов повернут спиной (розовая линия с другой стороны), из-за чего к нему нельзя подойти.",
      hintZone: { x: 73, y: 0, w: 7, h: 10 },
      topology: { cabinets: task4.topology, bounds: { x: -5, y: 3, w: 115, h: 95 }, obstacles: [], route: [] },
      badRoute: task4.badRoute,
      goodRoute: task4.goodRoute,
      solutionData: task4.solutionData
  },
  { 
      id: 3, 
      complaint: "Я несколько раз обходил конвейер по центру, почему система его не видит или она считает что я его перепрыгну?", 
      successMessage: "Отлично! Убрав эти шкафы, мы создадим короткий проход.",
      hintText: "Маршрут вынужден огибать длинную стену в центре. Попробуйте убрать пару шкафов в середине этой стены, чтобы создать проход.",
      hintZone: { x: 56, y: -2, w: 22, h: 8 },
      topology: { cabinets: task2.topology, bounds: { x: -5, y: 3, w: 115, h: 95 }, obstacles: [], route: [] },
      badRoute: task2.badRoute,
      goodRoute: task2.goodRoute,
      solutionData: task2.solutionData
  },
  { 
      id: 4, 
      complaint: "Я несколько раз обходил конвейер по центру, почему система его не видит или она считает что я его перепрыгну?", 
      successMessage: "Великолепно! Вы нашли этот коварный шкаф.",
      hintText: "Обратите внимание на шкаф, к которому сборщику приходится подходить с обратной стороны, делая крюк.",
      hintZone: { x: 59, y: 21, w: 7, h: 10 },
      topology: { cabinets: task3.topology, bounds: { x: -5, y: 3, w: 115, h: 95 }, obstacles: [], route: [] },
      badRoute: task3.badRoute,
      goodRoute: task3.goodRoute,
      solutionData: task3.solutionData
  },
  { 
      id: 5, 
      complaint: "Система телепортировала меня в закуток так, как будто там нет стены из шкафов.<br><br><b>Подсказка:</b> нужно найти препятствия (черные квадраты).", 
      successMessage: "Отличная работа! Вы правильно определили шкафы, из-за которых сборщику приходится делать крюк.",
      hintText: "Маршрут проходит прямо сквозь глухую стену из шкафов! Скорее всего, система не знает, что там стоят шкафы-препятствия (черные квадраты).",
      hintZone: { x: 66, y: 8, w: 7, h: 10 },
      topology: { cabinets: task1.topology, bounds: { x: -5, y: 3, w: 115, h: 95 }, obstacles: [], route: [] },
      badRoute: task1.badRoute,
      goodRoute: task1.goodRoute,
      solutionData: task1.solutionData
  }
];

export const editorTemplate = buildBaseTemplate();
