/* Agent Ops Center — Grid layout presets
 *
 * Plain (non-module) script. Exposes `window.AOC_LAYOUTS`, an object whose keys
 * are preset ids and whose values are { label, apply(gridEl) }.
 *
 * Each `apply` is idempotent: it fully resets the relevant inline styles on the
 * grid element and rewrites a single shared <style id="aoc-layout-style"> block,
 * so switching between presets never leaves stale rules behind.
 */
(function () {
  'use strict';

  var STYLE_ID = 'aoc-layout-style';

  // Reset the inline grid props every preset might touch, so presets don't
  // inherit leftovers from a previously-applied one.
  function resetGrid(gridEl) {
    gridEl.style.display = 'grid';
    gridEl.style.gridTemplateColumns = '';
    gridEl.style.gridTemplateRows = '';
    gridEl.style.gridAutoRows = '';
    gridEl.style.gridAutoFlow = '';
    gridEl.style.gridTemplateAreas = '';
    setExtraCss('');
  }

  // Maintain a single <style> block for rules that can't be expressed as inline
  // styles on the grid (e.g. :first-child targeting an .agent-card).
  function setExtraCss(css) {
    var el = document.getElementById(STYLE_ID);
    if (!css) {
      if (el) el.textContent = '';
      return;
    }
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = css;
  }

  var AOC_LAYOUTS = {
    solo: {
      label: 'Solo Focus',
      apply: function (gridEl) {
        resetGrid(gridEl);
        gridEl.style.gridTemplateColumns = '1fr';
      }
    },

    squad: {
      label: 'Squad',
      apply: function (gridEl) {
        resetGrid(gridEl);
        gridEl.style.gridTemplateColumns = 'repeat(2, 1fr)';
      }
    },

    warroom: {
      label: 'War Room',
      apply: function (gridEl) {
        resetGrid(gridEl);
        gridEl.style.gridTemplateColumns = 'repeat(3, 1fr)';
      }
    },

    broadcast: {
      label: 'Broadcast',
      apply: function (gridEl) {
        resetGrid(gridEl);
        // Hero tile (first card) on the left, workers flow in a narrow column.
        gridEl.style.gridTemplateColumns = '2fr 1fr';
        gridEl.style.gridAutoRows = 'minmax(220px, auto)';
        gridEl.style.gridAutoFlow = 'row dense';
        // First card becomes the big hero, spanning the left column for 3 rows.
        setExtraCss(
          '#' + gridEl.id + ' > .agent-card:first-child {' +
          ' grid-column: 1; grid-row: span 3;' +
          ' }'
        );
      }
    },

    mosaic: {
      label: 'Mosaic',
      apply: function (gridEl) {
        resetGrid(gridEl);
        // Current responsive default.
        gridEl.style.gridTemplateColumns = 'repeat(auto-fit, minmax(180px, 1fr))';
      }
    }
  };

  window.AOC_LAYOUTS = AOC_LAYOUTS;
})();
