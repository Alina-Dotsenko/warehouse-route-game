const fs = require('fs');
let code = fs.readFileSync('C:/Users/Sergei/Documents/route-lab/app/src/main.js', 'utf8');

code = code.replace(
  "const opacity = isVisible ? '1' : '0';",
  "const vis = isVisible ? 'visible' : 'hidden';"
);

code = code.replace(
  "style=\"opacity: ${opacity}; transition: opacity 0.3s ease; pointer-events: none;\"",
  "style=\"visibility: ${vis}; opacity: ${isVisible ? 1 : 0}; transition: opacity 0.3s ease, visibility 0.3s ease; pointer-events: none;\""
);

code = code.replace(
  "if (bad) bad.style.opacity = '1';",
  "if (bad) { bad.style.opacity = '1'; bad.style.visibility = 'visible'; }"
);
code = code.replace(
  "if (good) good.style.opacity = '0';",
  "if (good) { good.style.opacity = '0'; good.style.visibility = 'hidden'; }"
);
code = code.replace(
  "if (bad) bad.style.opacity = '0';",
  "if (bad) { bad.style.opacity = '0'; bad.style.visibility = 'hidden'; }"
);
code = code.replace(
  "if (good) good.style.opacity = '1';",
  "if (good) { good.style.opacity = '1'; good.style.visibility = 'visible'; }"
);

fs.writeFileSync('C:/Users/Sergei/Documents/route-lab/app/src/main.js', code);
