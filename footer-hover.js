// Next-Gen Interactive ASCII Wordmark Engine with Luminous Physics & Ambient Bloom
(() => {
  const stage = document.querySelector('.footer-hover');
  if (!stage) return;

  let cellSize = 7;
  let cellGap = 1.8;
  let cellStep = cellSize + cellGap;

  // Luminous ASCII gradient: from airy stardust to dense solid block
  const characters = ' ·:;+*#%@8&█';
  const threshold = 0.45;
  const pushRadius = 14; // Wide, satisfying magnetic response
  const pushForce = 38;
  const spring = 0.032;
  const damping = 0.62;

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
  let animationFrameId;
  let time = 0;
  const pointer = { col: -999, row: -999, px: -999, py: -999, moving: false };

  function setupCanvas() {
    const bounds = stage.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    
    // Scale density based on screen width
    cellSize = width < 768 ? 4.5 : (width < 1200 ? 6.5 : 7.5);
    cellGap = width < 768 ? 1.2 : 1.8;
    cellStep = cellSize + cellGap;
    
    columns = Math.ceil(width / cellStep);
    rows = Math.ceil(height / cellStep);
    
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function sampleMark() {
    if (!image.complete || !image.naturalWidth) return;
    const bounds = image.getBoundingClientRect();
    const markColumns = Math.ceil(bounds.width / cellStep);
    const markRows = Math.ceil(bounds.height / cellStep);
    const startColumn = Math.floor((bounds.left - stage.getBoundingClientRect().left) / cellStep);
    const startRow = Math.floor((bounds.top - stage.getBoundingClientRect().top) / cellStep);

    const sample = document.createElement('canvas');
    sample.width = Math.max(1, markColumns);
    sample.height = Math.max(1, markRows);
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
        let brightness = 0;
        let character = ' ';
        
        if (inMark) {
          const index = ((row - startRow) * markColumns + (col - startColumn)) * 4;
          brightness = (pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114) / 255;
          lit = brightness > threshold;
          if (lit) {
            const charIdx = Math.min(characters.length - 1, Math.floor(brightness * (characters.length - 1)));
            character = characters[charIdx];
          }
        }
        
        cells.push({
          col,
          row,
          baseCharacter: character,
          character,
          lit,
          brightness,
          offsetX: 0,
          offsetY: 0,
          velocityX: 0,
          velocityY: 0
        });
      }
    }
    render();
  }

  function render() {
    context.clearRect(0, 0, width, height);

    // Subtle dark matrix background dots
    context.fillStyle = 'rgba(255, 255, 255, 0.025)';
    context.font = `${Math.max(6, cellSize - 1)}px monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Step 1: Draw background grid points lightly
    const step = width < 768 ? 3 : 2;
    for (let r = 0; r < rows; r += step) {
      for (let c = 0; c < columns; c += step) {
        context.fillText('·', c * cellStep + cellSize / 2, r * cellStep + cellSize / 2);
      }
    }

    // Step 2: Draw lit ASCII characters with dynamic bloom and glow
    context.font = `bold ${cellSize + 3}px 'Space Grotesk', -apple-system, monospace`;

    const pointerX = pointer.px;
    const pointerY = pointer.py;

    for (const cell of cells) {
      if (!cell.lit) continue;

      const x = (cell.col + cell.offsetX) * cellStep + cellSize / 2;
      const y = (cell.row + cell.offsetY) * cellStep + cellSize / 2;

      // Distance to pointer for interactive golden bloom
      const distToPointer = Math.hypot(x - pointerX, y - pointerY);

      if (distToPointer < 110) {
        // High-energy golden bloom on hover
        const intensity = 1 - (distToPointer / 110);
        context.shadowColor = `rgba(229, 184, 105, ${0.4 + intensity * 0.5})`;
        context.shadowBlur = 12 + intensity * 8;
        context.fillStyle = intensity > 0.6 ? '#ffffff' : '#ffd98c';
      } else {
        // Ambient luxury titanium with subtle gold aura
        context.shadowColor = 'rgba(229, 184, 105, 0.22)';
        context.shadowBlur = 4;
        context.fillStyle = '#f3efe6';
      }

      context.fillText(cell.character, x, y);
    }

    // Reset shadow
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';
  }

  function updatePhysics() {
    time += 1;
    const idleBreath = Math.sin(time * 0.035) * 0.6;

    for (const cell of cells) {
      if (!cell.lit) continue;

      // Mouse interactive push physics
      if (pointer.moving) {
        const cellX = cell.col + cell.offsetX;
        const cellY = cell.row + cell.offsetY;
        const dx = cellX - pointer.col;
        const dy = cellY - pointer.row;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < pushRadius && distance > 0) {
          const force = ((1 - distance / pushRadius) ** 2) * pushForce;
          cell.velocityX += (dx / distance) * force;
          cell.velocityY += (dy / distance) * force;
        }
      }

      // Gentle ambient breathing wave when resting
      const waveTarget = Math.sin(time * 0.04 + cell.col * 0.16) * 0.8;

      cell.velocityX = (cell.velocityX - (cell.offsetX - waveTarget * 0.1) * spring) * damping;
      cell.velocityY = (cell.velocityY - (cell.offsetY - waveTarget) * spring) * damping;

      cell.offsetX += cell.velocityX;
      cell.offsetY += cell.velocityY;

      if (Math.abs(cell.offsetX) < 0.005 && Math.abs(cell.velocityX) < 0.005) {
        cell.offsetX = 0;
        cell.velocityX = 0;
      }
      if (Math.abs(cell.offsetY) < 0.005 && Math.abs(cell.velocityY) < 0.005) {
        cell.offsetY = 0;
        cell.velocityY = 0;
      }
    }
  }

  function animate() {
    updatePhysics();
    render();
    animationFrameId = requestAnimationFrame(animate);
  }

  function initialize() {
    setupCanvas();
    sampleMark();
  }

  function setPointerPosition(clientX, clientY) {
    const bounds = stage.getBoundingClientRect();
    pointer.px = clientX - bounds.left;
    pointer.py = clientY - bounds.top;
    pointer.col = pointer.px / cellStep;
    pointer.row = pointer.py / cellStep;
    pointer.moving = true;

    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      pointer.moving = false;
    }, 60);
  }

  stage.addEventListener('pointermove', (e) => setPointerPosition(e.clientX, e.clientY));
  stage.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      setPointerPosition(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  stage.addEventListener('pointerleave', () => {
    pointer.col = pointer.row = -999;
    pointer.px = pointer.py = -999;
    pointer.moving = false;
  });

  if ('ResizeObserver' in window) {
    new ResizeObserver(initialize).observe(stage);
  } else {
    window.addEventListener('resize', initialize);
  }

  image.complete ? initialize() : image.addEventListener('load', initialize, { once: true });

  if (!reduceMotion) {
    // Subtle character flicker on hover
    window.setInterval(() => {
      for (const cell of cells) {
        if (cell.lit && Math.random() < 0.08) {
          cell.character = characters[Math.floor(Math.random() * characters.length)];
        } else if (cell.lit) {
          cell.character = cell.baseCharacter;
        }
      }
    }, 80);
    animate();
  }
})();
