// Token Radar dashboard: renders window.RADAR (data.js) with no fetch and no network.
// Board (sortable, filterable, detail view) + Live tokens + Method & sandbox.
(function () {
  'use strict';
  var D = window.RADAR;
  var main = document.getElementById('board');
  if (!D || !Array.isArray(D.rows)) {
    main.innerHTML = '<p class="lede">No radar data loaded. Open this page from the output directory so data.js sits beside it.</p>';
    return;
  }

  var WATCH = {};
  (D.watchlist || []).forEach(function (s) { WATCH[s] = true; });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function moneyFull(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(v) {
    if (v == null) return '—';
    var s = (v > 0 ? '+' : '') + v.toFixed(1) + '%';
    return '<span class="' + (v > 0 ? 'up' : v < 0 ? 'down' : '') + '">' + s + '</span>';
  }
  function age(a) { return a == null ? '—' : a + 'd'; }
  function chains(c) {
    if (!c || c.length === 0) return '—';
    return esc(c.slice(0, 3).join(', ') + (c.length > 3 ? ' +' + (c.length - 3) : ''));
  }
  function badge(r) {
    return WATCH[r.slug]
      ? '<span class="badge">Watchlist</span>'
      : '<span class="badge early">Early</span>';
  }

  // ---- header stats + method numbers
  var stats = document.getElementById('stats');
  stats.innerHTML =
    '<div><dt>Ranked</dt><dd>' + D.board_size + '</dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + D.watchlist_size + '</dd></div>' +
    '<div><dt>Early finds</dt><dd>' + D.early_size + '</dd></div>' +
    '<div><dt>Live tokens</dt><dd>' + D.live_size + '</dd></div>';
  var gm = document.getElementById('gm');
  if (gm) gm.textContent = D.global_multiple;
  var gdx = document.getElementById('gm-dex');
  if (gdx && D.categories.Dexs) gdx.textContent = D.categories.Dexs.multiple;
  var gls = document.getElementById('gm-ls');
  if (gls && D.categories['Liquid Staking']) gls.textContent = D.categories['Liquid Staking'].multiple;
  var src = document.getElementById('source');
  if (src) src.textContent = 'Snapshot ' + D.as_of + ' · ' + D.source + ' · watchlist floor ' + moneyFull(D.floor_usd) + ' · ' + D.rows.length + ' rows ranked.';

  // ---- tabs
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs button'));
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabs.forEach(function (b) { b.classList.remove('active'); b.removeAttribute('aria-current'); });
      btn.classList.add('active');
      btn.setAttribute('aria-current', 'page');
      ['board', 'live', 'method'].forEach(function (t) {
        document.getElementById('view-' + t).hidden = t !== btn.getAttribute('data-tab');
      });
    });
  });

  // ---- board: filters, sorting, rendering
  var q = document.getElementById('q');
  var catSel = document.getElementById('cat');
  var chainSel = document.getElementById('chain');
  var wlBox = document.getElementById('wl');
  var countEl = document.getElementById('count');
  var tbody = document.getElementById('rows');
  var detail = document.getElementById('detail');
  var sort = { key: 'rank', dir: 1 };
  var selected = null;

  var cats = {};
  var chainSet = {};
  D.rows.forEach(function (r) {
    if (r.category) cats[r.category] = true;
    (r.chains || []).forEach(function (c) { chainSet[c] = true; });
  });
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o);
  });
  Object.keys(chainSet).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; chainSel.appendChild(o);
  });

  function filtered() {
    var needle = q.value.trim().toLowerCase();
    return D.rows.filter(function (r) {
      if (needle && r.name.toLowerCase().indexOf(needle) < 0 && r.slug.toLowerCase().indexOf(needle) < 0) return false;
      if (catSel.value && r.category !== catSel.value) return false;
      if (chainSel.value && (r.chains || []).indexOf(chainSel.value) < 0) return false;
      if (wlBox.checked && !WATCH[r.slug]) return false;
      return true;
    });
  }
  function cmp(a, b) {
    var k = sort.key;
    var av = a[k], bv = b[k];
    if (k === 'chains') { av = (a.chains || []).length; bv = (b.chains || []).length; }
    if (av == null && bv == null) return a.rank - b.rank;
    if (av == null) return 1;
    if (bv == null) return -1;
    var d = typeof av === 'string' ? (av < bv ? -1 : av > bv ? 1 : 0) : av - bv;
    if (d === 0) d = a.rank - b.rank;
    return d * sort.dir;
  }
  function render() {
    var list = filtered().sort(cmp);
    countEl.textContent = list.length + ' of ' + D.rows.length + ' rows';
    tbody.innerHTML = list.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (selected === r.slug ? ' class="sel"' : '') + '>' +
        '<td>' + r.rank + '</td>' +
        '<td>' + esc(r.name) + badge(r) + '<span class="sub">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + chains(r.chains) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong></td></tr>';
    }).join('');
    Array.prototype.slice.call(document.querySelectorAll('#boardtable th[data-sort]')).forEach(function (th) {
      if (th.getAttribute('data-sort') === sort.key) {
        th.setAttribute('aria-sort', sort.dir === 1 ? 'ascending' : 'descending');
      } else {
        th.removeAttribute('aria-sort');
      }
    });
  }
  Array.prototype.slice.call(document.querySelectorAll('#boardtable th[data-sort]')).forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (sort.key === k) {
        sort.dir = -sort.dir;
      } else {
        sort.key = k;
        sort.dir = (k === 'name' || k === 'category' || k === 'rank') ? 1 : -1;
      }
      render();
    });
  });
  [q, catSel, chainSel, wlBox].forEach(function (el) {
    el.addEventListener('input', function () { render(); });
  });
  tbody.addEventListener('click', function (ev) {
    var tr = ev.target.closest('tr');
    if (!tr) return;
    showDetail(tr.getAttribute('data-slug'));
  });

  function barWidth(v, lo, hi) {
    return Math.max(4, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  }
  function showDetail(slug) {
    var r = null;
    D.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    selected = slug;
    render();
    var f = [
      ['Category multiple', r.category_multiple, '×', barWidth(r.category_multiple, 0, 2.5)],
      ['Growth', r.growth_multiplier, '×', barWidth(r.growth_multiplier, 0.7, 1.6)],
      ['Launch', r.launch_factor, '×', barWidth(r.launch_factor, 0, 1)],
      ['Token-share', r.token_share_factor, '×', barWidth(r.token_share_factor, 0.7, 1.3)],
      ['Chains', r.chain_factor, '×', barWidth(r.chain_factor, 1, 1.1)],
    ];
    detail.hidden = false;
    detail.innerHTML =
      '<button type="button" class="close" id="d-close">Close</button>' +
      '<h2>' + esc(r.name) + badge(r) + '</h2>' +
      '<p class="meta">Rank #' + r.rank + ' · ' + esc(r.slug) + ' · ' + esc(r.category || '—') + ' · ' + chains(r.chains) +
      ' · TVL ' + money(r.tvl_usd) + ' · 7d ' + (r.change_7d == null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') +
      ' · Age ' + age(r.age_days) + '</p>' +
      '<div class="big">Implied value ' + moneyFull(r.implied_value_usd) + '</div>' +
      '<div class="factors-grid">' + f.map(function (x) {
        return '<div class="factor"><b>' + x[0] + '</b><span>' + x[1] + x[2] + '</span><div class="bar"><i style="width:' + x[3].toFixed(0) + '%"></i></div></div>';
      }).join('') + '</div>' +
      '<h3>Farm plan — six steps</h3><ol>' +
      (r.farm_steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '</ol>';
    document.getElementById('d-close').addEventListener('click', function () {
      detail.hidden = true;
      selected = null;
      render();
    });
    detail.scrollIntoView({ block: 'nearest' });
  }

  // ---- live tokens
  var liveBody = document.getElementById('liverows');
  liveBody.innerHTML = D.live.map(function (p) {
    var ratio = p.mcap_usd != null && p.tvl_usd > 0 ? (p.mcap_usd / p.tvl_usd).toFixed(2) + '×' : '—';
    return '<tr><td>' + esc(p.name) + '<span class="sub">' + esc(p.slug) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td><td>' + chains(p.chains) + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + money(p.mcap_usd) + '</td>' +
      '<td class="num">' + ratio + '</td>' +
      '<td class="num">' + pct(p.change_7d) + '</td></tr>';
  }).join('');

  // ---- method: category table + sandbox
  var catBody = document.getElementById('catrows');
  catBody.innerHTML = Object.keys(D.categories).sort(function (a, b) {
    return D.categories[b].multiple - D.categories[a].multiple;
  }).map(function (c) {
    var s = D.categories[c];
    return '<tr><td>' + esc(c) + '</td><td class="num">' + s.multiple + '×</td>' +
      '<td class="num">' + (s.token_share * 100).toFixed(0) + '%</td>' +
      '<td class="num">' + s.priced + '</td></tr>';
  }).join('');

  var sbRows = document.getElementById('sb-rows');
  var sbNote = document.getElementById('sb-note');
  function runSandbox() {
    var gw = parseFloat(document.getElementById('sb-growth').value);
    var prime = parseFloat(document.getElementById('sb-prime').value);
    var scale = parseFloat(document.getElementById('sb-scale').value);
    if (!isFinite(gw) || !isFinite(prime) || !isFinite(scale)) return;
    var scored = D.rows.map(function (r) {
      var launch = r.launch_factor;
      if (r.age_days != null && r.age_days >= 90 && r.age_days <= 730) launch = prime;
      var growthMult = 1 + (r.growth_pct / 100) * gw;
      var implied = Math.max(1, Math.round(r.tvl_usd * r.category_multiple * scale * growthMult * launch * r.token_share_factor * r.chain_factor));
      return { r: r, implied: implied };
    });
    scored.sort(function (a, b) { return b.implied - a.implied || (a.r.slug < b.r.slug ? -1 : 1); });
    var top = scored.slice(0, 10);
    var moved = 0;
    top.forEach(function (s, i) { if (s.r.rank !== i + 1) moved++; });
    sbRows.innerHTML = top.map(function (s, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(s.r.name) + badge(s.r) + '</td>' +
        '<td class="num">' + money(s.r.tvl_usd) + '</td>' +
        '<td class="num"><strong>' + money(s.implied) + '</strong></td>' +
        '<td class="num">#' + s.r.rank + '</td></tr>';
    }).join('');
    sbNote.textContent = 'Sandbox top 10: ' + moved + ' of 10 rows changed rank vs the base board. The sandbox re-ranks in the page only; the board file is untouched.';
  }
  document.getElementById('sb-apply').addEventListener('click', runSandbox);
  document.getElementById('sb-reset').addEventListener('click', function () {
    document.getElementById('sb-growth').value = '0.5';
    document.getElementById('sb-prime').value = '1';
    document.getElementById('sb-scale').value = '1';
    runSandbox();
  });
  runSandbox();
  render();
})();
