import { preloadImages } from '../utils.js'; // Utility function to preload images before layout

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

// Create a ScrollSmoother instance for smooth scrolling with lag effects
const smoother = ScrollSmoother.create({
  wrapper: '#smooth-wrapper', // Keep the entire storefront in the page's one scroll container
  content: '#smooth-content',
  smooth: 1, // Smoothing factor for scroll (0 = no smoothing, 1 = full smoothing)
  effects: true, // Enable lag/scroll-based effects
  normalizeScroll: true, // Prevents mobile address bar resizing, disables overscroll bounce, and ensures scroll value consistency
});

// Get the grid container
const grid = document.querySelector('.grid');

// Lag configuration constants
const baseLag = 0.2; // Initial lag for the first column
const lagScale = 0.3; // Additional lag per column (applied incrementally)

/**
 * Group grid items into columns based on computed CSS grid-template-columns
 * @returns {Object} An object containing the grouped columns and column count
 */
const groupItemsByColumn = () => {
  const gridStyles = window.getComputedStyle(grid);
  const columnsRaw = gridStyles.getPropertyValue('grid-template-columns');
  const numColumns = columnsRaw.split(' ').filter(Boolean).length;

  const columns = Array.from({ length: numColumns }, () => []); // Initialize column arrays

  // Distribute grid items into column buckets
  grid.querySelectorAll('.grid__item').forEach((item, index) => {
    columns[index % numColumns].push(item);
  });

  return { columns, numColumns };
};

/**
 * Reset the grid
 */
const clearGrid = () => {
  const columns = Array.from(grid.querySelectorAll('.grid__column'));
  const columnSet = new Set(columns);
  smoother.effects().forEach((effect) => {
    if (columnSet.has(effect.trigger)) effect.kill();
  });
  columns.forEach((column) => {
    Array.from(column.querySelectorAll('.grid__item')).forEach((item) => grid.appendChild(item));
    column.remove();
  });
};

/**
 * Build column containers and wrap grid items
 * @param {Array[]} columns - Array of item groups per column
 * @returns {Array} Array of objects with element and lag per column
 */
const buildGrid = (columns) => {
  const fragment = document.createDocumentFragment(); // Efficient batch insertion
  const columnContainers = [];

  // Loop through each column
  columns.forEach((column, i) => {
    const lag = baseLag + (i + 1) * lagScale; // Lag increases linearly per column index

    const columnContainer = document.createElement('div');
    columnContainer.className = 'grid__column';

    // Append items to this column
    column.forEach((item) => columnContainer.appendChild(item));

    fragment.appendChild(columnContainer);
    columnContainers.push({ element: columnContainer, lag });
  });

  grid.appendChild(fragment); // Add all columns at once
  return columnContainers;
};

/**
 * Apply ScrollSmoother lag effects to each column
 * @param {Array} columnContainers - Array of column elements and associated lag values
 */
const applyLagEffects = (columnContainers) => {
  columnContainers.forEach(({ element, lag }) => {
    smoother.effects(element, { speed: 1, lag }); // Apply lag per column
  });
};

/**
 * Initialize layout and scroll effects
 */
const init = () => {
  clearGrid(); // Safely clear grid content
  const items = Array.from(grid.querySelectorAll('.grid__item'));
  if (!items.length) {
    ScrollTrigger.refresh();
    return;
  }
  const { columns, numColumns } = groupItemsByColumn(); // Group items and get count
  currentColumnCount = numColumns; // Store for change detection
  const columnContainers = buildGrid(columns); // Build layout
  applyLagEffects(columnContainers); // Apply scrolling effects
};

/**
 * Helper to get current column count from CSS grid
 * @returns {number} Number of columns
 */
const getColumnCount = () => {
  const styles = getComputedStyle(grid);
  return styles.getPropertyValue('grid-template-columns').split(' ').filter(Boolean).length;
};

// ─────────────── Resize Handling ───────────────

// Track current column count for layout updates
let currentColumnCount = null;

// Rebuild the layout only if the number of columns has changed on window resize
window.addEventListener('resize', () => {
  const newColumnCount = getColumnCount();
  if (newColumnCount !== currentColumnCount) {
    init();
  }
});

window.addEventListener('perkdrop:grid-before-update', clearGrid);
window.addEventListener('perkdrop:grid-updated', () => {
  preloadImages('.grid__item-img').then(init);
});

// ─────────────── Entry Point ───────────────

// Wait for all images to preload before initializing
preloadImages('.grid__item-img').then(() => {
  document.body.classList.remove('loading'); // Remove loading overlay/state
  init(); // Start layout
});
