/* Agent Ops Center — Layout switcher
 *
 * Plain (non-module) script. Reads window.AOC_LAYOUTS (from themes.js), injects
 * a <select> into the top bar, applies the chosen layout to #agentsGrid, and
 * persists the choice in localStorage. Fully defensive: if any expected element
 * or the layouts global is missing, it no-ops without throwing.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'aoc-layout';
  var DEFAULT_LAYOUT = 'mosaic';

  function readStored() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function writeStored(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* storage unavailable (private mode / file://) — ignore */
    }
  }

  function applyLayout(layouts, gridEl, key) {
    var preset = layouts[key];
    if (!preset || typeof preset.apply !== 'function' || !gridEl) return false;
    try {
      preset.apply(gridEl);
      return true;
    } catch (e) {
      return false;
    }
  }

  function init() {
    var layouts = window.AOC_LAYOUTS;
    if (!layouts || typeof layouts !== 'object') return;

    var keys = Object.keys(layouts);
    if (!keys.length) return;

    var topBar = document.querySelector('.top-bar');
    var grid = document.getElementById('agentsGrid');
    if (!topBar || !grid) return;

    // Resolve initial selection: stored value if still valid, else default,
    // else the first available preset.
    var stored = readStored();
    var current =
      (stored && layouts[stored]) ? stored :
      (layouts[DEFAULT_LAYOUT] ? DEFAULT_LAYOUT : keys[0]);

    // Build the select, styled to echo the existing .spawn-btn.
    var select = document.createElement('select');
    select.className = 'layout-select';
    select.setAttribute('aria-label', 'Grid layout');
    select.style.fontSize = '12px';
    select.style.padding = '5px 12px';
    select.style.borderRadius = 'var(--border-radius-md)';
    select.style.border = '0.5px solid var(--color-border-secondary)';
    select.style.background = 'var(--color-background-primary)';
    select.style.color = 'var(--color-text-primary)';
    select.style.cursor = 'pointer';
    select.style.fontFamily = 'inherit';
    select.style.marginRight = '8px';

    keys.forEach(function (key) {
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = (layouts[key] && layouts[key].label) || key;
      if (key === current) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', function () {
      var key = select.value;
      if (applyLayout(layouts, grid, key)) {
        writeStored(key);
      }
    });

    // Insert before the spawn button if present, otherwise append to the bar.
    var spawnBtn = topBar.querySelector('.spawn-btn');
    if (spawnBtn) {
      topBar.insertBefore(select, spawnBtn);
    } else {
      topBar.appendChild(select);
    }

    // Apply once on load.
    applyLayout(layouts, grid, current);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
