// Adapted from the Awwwards Motion Pack: Hover Effects / 13,
// Artefakt Interactive ASCII Logo. The original ASCII particle response is
// preserved and scoped to the Perkdrop footer stage.
(() => {
  const stage = document.querySelector('.footer-hover');
  if (!stage) return;

  let cellSize = 8;
  let cellGap = 2;
  let cellStep = cellSize + cellGap;
  const gridColor = '#101112';
  const characterColor = '#e2ded5';
  const characters = '.:+*#%@0369';
  const threshold = 0.5;
  const pushRadius = 5;
  const pushForce = 30;
  const spring = 0.025;
  const damping = 0.5;
  const canvas = stage.querySelector('canvas');
  const context = canvas.getContext('2d', { alpha: true });
  const image = stage.querySelector('img');
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0;
  let height = 0;
  let columns = 0;
  let rows = 0;
  let cells = [];
  let idleTimer;
  const pointer = { col: -999, row: -999, moving: false };

  function setupCanvas() {
    const bounds = stage.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    cellSize = width < 700 ? 3 : 8;
    cellGap = width < 700 ? 1 : 2;
    cellStep = cellSize + cellGap;
    columns = Math.ceil(width / cellStep);
    rows = Math.ceil(height / cellStep);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function sampleMark() {
    const bounds = image.getBoundingClientRect();
    const markColumns = Math.ceil(bounds.width / cellStep);
    const markRows = Math.ceil(bounds.height / cellStep);
    const startColumn = Math.floor((bounds.left - stage.getBoundingClientRect().left) / cellStep);
    const startRow = Math.floor((bounds.top - stage.getBoundingClientRect().top) / cellStep);
    const sample = document.createElement('canvas');
    sample.width = markColumns;
    sample.height = markRows;
    const sampleContext = sample.getContext('2d', { willReadFrequently: true });
    sampleContext.fillStyle = '#000';
    sampleContext.fillRect(0, 0, markColumns, markRows);
    sampleContext.drawImage(image, 0, 0, markColumns, markRows);
    const pixels = sampleContext.getImageData(0, 0, markColumns, markRows).data;
    cells = [];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const inMark = col >= startColumn && col < startColumn + markColumns && row >= startRow && row < startRow + markRows;
        let lit = false;
        let character = ' ';
        if (inMark) {
          const index = ((row - startRow) * markColumns + (col - startColumn)) * 4;
          const brightness = (pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114) / 255;
          lit = brightness > threshold;
          if (lit) character = characters[Math.min(characters.length - 1, Math.floor(brightness * characters.length))];
        }
        cells.push({ col, row, character, lit, offsetX: 0, offsetY: 0, velocityX: 0, velocityY: 0 });
      }
    }
    render();
  }

  function render() {
    context.font = `${cellSize + 2}px monospace`;
    context.textBaseline = 'top';
    context.textAlign = 'center';
    context.clearRect(0, 0, width, height);
    context.fillStyle = gridColor;
    for (const cell of cells) context.fillRect(cell.col * cellStep, cell.row * cellStep, cellSize, cellSize);
    context.fillStyle = characterColor;
    for (const cell of cells) {
      if (!cell.lit) continue;
      const x = (cell.col + Math.round(cell.offsetX)) * cellStep;
      const y = (cell.row + Math.round(cell.offsetY)) * cellStep;
      context.fillText(cell.character, x + cellSize / 2, y);
    }
  }

  function updatePhysics() {
    for (const cell of cells) {
      if (!cell.lit) continue;
      if (pointer.moving) {
        const dx = cell.col + cell.offsetX - pointer.col;
        const dy = cell.row + cell.offsetY - pointer.row;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < pushRadius && distance > 0) {
          const force = (1 - distance / pushRadius) ** 2 * pushForce;
          cell.velocityX += (dx / distance) * force;
          cell.velocityY += (dy / distance) * force;
        }
      }
      cell.velocityX = (cell.velocityX - cell.offsetX * spring) * damping;
      cell.velocityY = (cell.velocityY - cell.offsetY * spring) * damping;
      cell.offsetX += cell.velocityX;
      cell.offsetY += cell.velocityY;
      if (Math.abs(cell.offsetX) < 0.01 && Math.abs(cell.velocityX) < 0.01) cell.offsetX = cell.velocityX = 0;
      if (Math.abs(cell.offsetY) < 0.01 && Math.abs(cell.velocityY) < 0.01) cell.offsetY = cell.velocityY = 0;
    }
  }

  function animate() {
    updatePhysics();
    render();
    requestAnimationFrame(animate);
  }

  function initialize() {
    setupCanvas();
    sampleMark();
  }

  function onPointerMove(event) {
    const bounds = stage.getBoundingClientRect();
    pointer.col = (event.clientX - bounds.left) / cellStep;
    pointer.row = (event.clientY - bounds.top) / cellStep;
    pointer.moving = true;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { pointer.moving = false; }, 50);
  }

  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerleave', () => {
    pointer.col = pointer.row = -999;
    pointer.moving = false;
  });
  if ('ResizeObserver' in window) new ResizeObserver(initialize).observe(stage);
  else window.addEventListener('resize', initialize);

  image.complete ? initialize() : image.addEventListener('load', initialize, { once: true });

  if (!reduceMotion) {
    window.setInterval(() => {
      for (const cell of cells) if (cell.lit) cell.character = characters[Math.floor(Math.random() * characters.length)];
    }, 50);
    animate();
  }
})();
