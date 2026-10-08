import { preloadImages } from '../utils.js'; // Utility function to preload images

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

// Create a ScrollSmoother instance for smooth, inertia-style scrolling
const smoother = ScrollSmoother.create({
  smooth: 1, // 0 = no smoothing, 1 = full smoothing
  effects: true, // Enable per-element scroll effects (lag)
  normalizeScroll: true, // Stabilize mobile address bar, disable overscroll bounce, sync scroll values
});

// Reference to the grid container in the DOM
const grid = document.querySelector('.grid');
// Capture original .grid__item order before any DOM changes
const originalItems = Array.from(grid.querySelectorAll('.grid__item'));

// ──────────────── Lag Configuration ────────────────
const baseLag = 0.5; // Base lag value for the center column
const lagScale = 0.13; // Additional lag per column as you move away from center

// ────────────── Scale Configuration ────────────────
const minScaleX = 0.7; // Minimum X-scale at max scroll velocity
const maxScaleY = 1.7; // Maximum Y-scale at max scroll velocity

// ───────── Scroll-to-Animation Sensitivity ─────────
const scrollSensitivity = 4000; // px/sec of scroll required to reach full animation

// ───────────── Optional Dead-Zone ────────────────
const threshold = 700; // Scroll velocity below this has no scaling effect

/**
 * Divide all .grid__item elements into arrays by column index,
 * based on the computed CSS grid-template-columns count.
 * @returns {Object} Columns array and total column count
 */
function groupItemsByColumn() {
  const style = getComputedStyle(grid);
  const colCount = style.getPropertyValue('grid-template-columns').split(' ').filter(Boolean).length;

  const columns = Array.from({ length: colCount }, () => []);

  grid.querySelectorAll('.grid__item').forEach((item, i) => {
    columns[i % colCount].push(item);
  });

  return { columns, colCount };
}

/**
 * Reset the grid
 */
const clearGrid = () => {
  // Remove column wrappers
  grid.querySelectorAll('.grid__column').forEach((col) => col.remove());

  // Restore original .grid__item order
  originalItems.forEach((item) => grid.appendChild(item));
};

/**
 * Build column wrappers (.grid__column), apply lag effects,
 * and append everything back into the DOM in one batch.
 * @param {Array[]} columns - Grouped items per column
 * @param {number} colCount - Number of columns
 * @returns {Array} Column containers with lag metadata
 */
function buildGrid(columns, colCount) {
  const fragment = document.createDocumentFragment();
  const mid = (colCount - 1) / 2; // Center column index
  const containers = [];

  columns.forEach((colItems, i) => {
    const distance = Math.abs(i - mid);
    const lag = baseLag + distance * lagScale;

    const wrapper = document.createElement('div');
    wrapper.className = 'grid__column';

    colItems.forEach((item) => wrapper.appendChild(item));

    fragment.appendChild(wrapper);
    containers.push({ el: wrapper, lag });
  });

  grid.appendChild(fragment);
  return containers;
}

/**
 * Apply ScrollSmoother lag effects to each column
 * @param {Array} containers - Array of column elements with lag values
 */
function applyLagEffects(containers) {
  containers.forEach(({ el, lag }) => {
    smoother.effects(el, { speed: 1, lag });
  });
}

/**
 * Initialize layout and scroll lag effects
 */
function init() {
  clearGrid(); // Remove existing grid content
  const { columns, colCount } = groupItemsByColumn();
  currentColumnCount = colCount;
  const containers = buildGrid(columns, colCount); // Build new layout
  applyLagEffects(containers); // Apply lag effects
}

/**
 * Continuously update scale effects based on scroll velocity
 * Uses CSS variables that .grid__item can access
 */
function updateVisualEffects() {
  const rawVel = smoother.getVelocity(); // px/sec, can be negative
  const absVel = Math.abs(rawVel);

  const vRaw = Math.max(0, absVel - threshold); // Apply dead-zone
  const v = Math.min(vRaw / scrollSensitivity, 1); // Normalize to 0-1

  const si = 1 + (minScaleX - 1) * v; // X scale interpolation
  const sy = 1 + (maxScaleY - 1) * v; // Y scale interpolation

  const to = rawVel < 0 ? '50% 0%' : '50% 100%'; // Origin: up vs down scroll

  // Apply CSS variables to grid
  grid.style.setProperty('--si', si);
  grid.style.setProperty('--sy', sy);
  grid.style.setProperty('--to', to);
}

// Run visual update on every animation frame via GSAP
gsap.ticker.add(updateVisualEffects);

/**
 * Helper to get current column count from CSS grid
 * @returns {number} Column count
 */
function getColumnCount() {
  const styles = getComputedStyle(grid);
  return styles.getPropertyValue('grid-template-columns').split(' ').filter(Boolean).length;
}

// ─────────────── Resize Handling ───────────────

let currentColumnCount = null; // Track layout state

// Rebuild the layout only if the number of columns has changed on window resize
window.addEventListener('resize', () => {
  const newColumnCount = getColumnCount();
  if (newColumnCount !== currentColumnCount) {
    init();
  }
});

// ─────────────── Entry Point ───────────────

// Wait for all grid images to load, then start layout + effects
preloadImages('.grid__item-img').then(() => {
  document.body.classList.remove('loading');
  init();
});
