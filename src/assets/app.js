// Theme toggle + client-side table filtering. No dependencies, no network.
(function () {
  'use strict';

  var root = document.documentElement;

  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set) return set;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  var toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  // --- filterable tables -------------------------------------------------
  // A table opts in with data-filterable. Controls point at it by id.
  document.querySelectorAll('[data-filter-for]').forEach(function (panel) {
    var table = document.getElementById(panel.getAttribute('data-filter-for'));
    if (!table) return;
    var rows = Array.prototype.slice.call(table.tBodies[0].rows);
    var countEl = document.querySelector('[data-count-for="' + table.id + '"]');
    var controls = Array.prototype.slice.call(panel.querySelectorAll('input, select'));

    function apply() {
      var q = '';
      var facets = {};
      controls.forEach(function (c) {
        if (c.type === 'search' || c.type === 'text') q = c.value.trim().toLowerCase();
        else if (c.value) facets[c.getAttribute('data-facet')] = c.value;
      });

      var shown = 0;
      rows.forEach(function (row) {
        var ok = true;
        for (var key in facets) {
          if ((row.dataset[key] || '') !== facets[key]) { ok = false; break; }
        }
        if (ok && q) ok = (row.dataset.search || row.textContent).toLowerCase().indexOf(q) !== -1;
        row.hidden = !ok;
        if (ok) shown++;
      });

      if (countEl) {
        countEl.textContent =
          shown === rows.length
            ? 'Showing all ' + rows.length + ' records'
            : 'Showing ' + shown + ' of ' + rows.length + ' records';
      }
    }

    controls.forEach(function (c) {
      c.addEventListener('input', apply);
      c.addEventListener('change', apply);
    });
    apply();
  });
})();
