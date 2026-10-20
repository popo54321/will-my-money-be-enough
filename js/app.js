// Will My Money Be Enough? - app logic: inputs, model, rendering, charts, Summary tab.
// Text lives in js/i18n/*.js, class symbols in js/icons.js, styles in css/styles.css.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const STORE = 'paying-in-stop-v4', PLANS = 'paying-in-plans-v1';
  const FONT = '"Nunito", "Noto Sans Thai", "Noto Sans SC", system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  // Live-to slider: ages up to MAX_AGE, then one more step, FOREVER, for "keep going forever".
  // Forever models FH months past retirement, then works out the rest with the long-run maths in foreverOut().
  const MAX_AGE = 120, FOREVER = MAX_AGE + 1, FH = 1200;
  let inForever = false;

  /* ---------- languages ---------- */
  const I18N = window.MMA.i18n;
  let LANG = 'en';
  const HTML_LANG = {en: 'en-GB', th: 'th', zh: 'zh-CN'};
  function t(k, v){
    // in forever mode a key with a '.f' version uses that instead
    if (inForever && (I18N.en[k + '.f'] !== undefined)) k += '.f';
    let s = I18N[LANG] && I18N[LANG][k];
    if (s === undefined) s = I18N.en[k];
    if (s === undefined) return k;
    if (v) s = s.replace(/\{(\w+)\}/g, (m, n) => (v[n] !== undefined && v[n] !== null) ? v[n] : '');
    return s;
  }
  const join = arr => arr.filter(Boolean).join(LANG === 'zh' ? '' : ' ');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function applyStatic(){
    document.documentElement.lang = HTML_LANG[LANG] || 'en-GB';
    document.title = t('title');
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t, el.dataset.n ? {n: el.dataset.n} : null); });
    document.querySelectorAll('label[data-l]').forEach(el => {
      el.innerHTML = esc(t(el.dataset.l)) + (el.dataset.h ? '<span class="hint">' + esc(t(el.dataset.h)) + '</span>' : '');
    });
    document.querySelectorAll('[data-ph]').forEach(el => { el.placeholder = t(el.dataset.ph); });
    $('langSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === LANG)));
  }

  /* ---------- optional rows ---------- */
  function fld(id, l, h, o){
    o = o || {};
    const ph = o.ph ? ' data-ph="' + o.ph + '"' : (o.phRaw ? ' placeholder="' + o.phRaw + '"' : '');
    return '<div class="field' + (o.cls ? ' ' + o.cls : '') + '"><label for="' + id + '" data-l="' + l + '"' + (h ? ' data-h="' + h + '"' : '') + '></label><div class="box"><input id="' + id +
      '" data-save' + (o.money ? ' data-money' : '') + ' inputmode="' + (o.text ? 'text' : (o.int ? 'numeric' : 'decimal')) + '" autocomplete="off"' + ph + '>' +
      (o.suf ? '<span class="suf">' + o.suf + '</span>' : '') + '</div></div>';
  }
  function sel(id, l, opts, cls){
    return '<div class="field' + (cls ? ' ' + cls : '') + '"><label for="' + id + '" data-l="' + l + '"></label><div class="box"><select id="' + id + '" data-save>' +
      opts.map(([v, k]) => '<option value="' + v + '" data-t="' + k + '"></option>').join('') + '</select></div></div>';
  }
  function buildExtras(){
    $('exBasic').innerHTML = fld('fees', 'x.fees', 'x.fees.h', {suf: '%', ph: 'none'}) + fld('tax', 'x.tax', 'x.tax.h', {suf: '%', ph: 'none'}) +
      fld('legacy', 'x.legacy', 'todaysMoney', {money: true, ph: 'none'});
    let s = '';
    for (let i = 1; i <= 2; i++) s += '<div class="xrow"><div class="grid">' + fld('st' + i + 'Age', 'x.fromAge', '', {int: true, phRaw: '–'}) +
      fld('st' + i + 'Amt', 'x.spendMonth', '', {money: true, phRaw: '–'}) + '</div></div>';
    $('exSteps').innerHTML = s;
    buildRows(1, 1);
    $('partner').innerHTML = fld('pAge', 'x.pAge', '', {int: true}) + fld('pRetire', 'x.pRetire', '', {int: true}) +
      fld('pStart', 'x.pStart', '', {money: true, phRaw: '0'}) + fld('pMonthly', 'x.pMonthly', '', {money: true, phRaw: '0'});
  }
  /* ---------- other income and one-off rows: add or remove as many as needed ---------- */
  // The row counts live in two hidden inputs (nInc, nOne) so saves and plans remember them.
  const MAX_ROWS = 10;
  const ROWS = {
    in: {box: 'exInc', count: 'nInc', title: 'x.incN', add: 'x.addInc', fields: ['Name', 'Amt', 'From', 'To', 'Ix', 'Who'],
      html: i => fld('in' + i + 'Name', 'x.what', '', {text: true, ph: 'x.inc.ph'}) +
        fld('in' + i + 'Amt', 'x.amtMonth', '', {money: true, phRaw: '–'}) + fld('in' + i + 'From', 'x.fromAge', '', {int: true, phRaw: '–'}) +
        fld('in' + i + 'To', 'x.until', 'optional', {int: true, ph: 'x.forLife'}) +
        sel('in' + i + 'Ix', 'x.ix', [['fixed', 'x.ix.fixed'], ['real', 'x.ix.real']]) +
        sel('in' + i + 'Who', 'x.who', [['you', 'x.who.you'], ['partner', 'x.who.partner']], 'whose')},
    on: {box: 'exOne', count: 'nOne', title: 'x.oneN', add: 'x.addOne', fields: ['Dir', 'Amt', 'Age', 'Name'],
      html: i => sel('on' + i + 'Dir', 'x.dir', [['out', 'x.out'], ['in', 'x.in']]) +
        fld('on' + i + 'Amt', 'x.amt', '', {money: true, phRaw: '–'}) + fld('on' + i + 'Age', 'x.atAge', '', {int: true, phRaw: '–'}) +
        fld('on' + i + 'Name', 'x.what', 'optional', {text: true, ph: 'x.one.ph'})}
  };
  function buildRows(nInc, nOne){
    [['in', nInc], ['on', nOne]].forEach(([k, n]) => {
      const R = ROWS[k];
      let h = '';
      for (let i = 1; i <= n; i++) h += '<div class="xrow"><div class="xhead"><span data-t="' + R.title + '" data-n="' + i + '"></span>' +
        '<button type="button" class="xrm" data-rm="' + k + '" data-i="' + i + '" data-t="x.rm"></button></div><div class="grid four">' + R.html(i) + '</div></div>';
      if (n < MAX_ROWS) h += '<button type="button" class="btn2 xadd" data-add="' + k + '" data-t="' + R.add + '"></button>';
      $(R.box).innerHTML = h;
      $(R.count).value = n;
    });
  }
  // the saved count, or for older saves (which always had 3 rows) the last row with anything typed in it
  function rowCount(raw, k){
    const n = parseInt(raw && raw[ROWS[k].count], 10);
    if (n >= 0) return clamp(n, 0, MAX_ROWS);
    let last = 1;
    if (raw) for (let i = 1; i <= MAX_ROWS; i++) if (['Name', 'Amt', 'From', 'To', 'Age'].some(f => String(raw[k + i + f] || '').trim())) last = i;
    return last;
  }
  function addRow(k){
    const raw = readRaw(), n = rowCount(raw, k);
    if (n >= MAX_ROWS) return;
    raw[ROWS[k].count] = n + 1;
    writeRaw(raw); render();
    const first = $(k + (n + 1) + ROWS[k].fields[0]); if (first) first.focus();
  }
  function removeRow(k, i){
    const raw = readRaw(), n = rowCount(raw, k), F = ROWS[k].fields;
    // move the rows below up one, then drop the last
    for (let j = i; j < n; j++) F.forEach(f => { raw[k + j + f] = raw[k + (j + 1) + f]; });
    F.forEach(f => { delete raw[k + n + f]; });
    raw[ROWS[k].count] = n - 1;
    writeRaw(raw); render();
  }
  const CORE = {start: '10,000', monthly: '500', raise: '', infl: '3.5', growth: '7', growth2: '5', age: '30', retire: '60', spend: '1,500',
    s1: '25', s2: '5', yield: '2', vol1: '15', vol2: '10', fall: '30', pay: '', two: false};
  function defaults(){
    const d = Object.assign({}, CORE);
    document.querySelectorAll('[data-save]').forEach(el => {
      if (d[el.id] === undefined) d[el.id] = el.tagName === 'SELECT' ? el.options[0].value : (el.type === 'checkbox' ? false : '');
    });
    return d;
  }
  let DEFAULTS = null;
  function readRaw(){
    const o = {};
    document.querySelectorAll('[data-save]').forEach(el => { o[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
    return o;
  }
  function writeRaw(raw){
    const nInc = rowCount(raw, 'in'), nOne = rowCount(raw, 'on');
    buildRows(nInc, nOne);
    applyStatic();
    document.querySelectorAll('[data-save]').forEach(el => {
      const v = (raw && raw[el.id] !== undefined) ? raw[el.id] : DEFAULTS[el.id];
      if (el.type === 'checkbox') el.checked = !!v; else el.value = (v === undefined || v === null) ? '' : v;
      if (el.tagName === 'SELECT' && el.selectedIndex < 0) el.selectedIndex = 0;
    });
    $('nInc').value = nInc; $('nOne').value = nOne;
  }

  /* ---------- UI state ---------- */
  const navLang = (navigator.language || 'en').toLowerCase();
  const ui = {unit: 'cash', unitSet: false, touched: false, stopAge: null, live: 90, answers: {match: null, cash: null, debt: null, life: null},
    look: 'cream', tab: 'calc', hideAmts: false,
    lang: navLang.startsWith('th') ? 'th' : (navLang.startsWith('zh') ? 'zh' : 'en')};
  function loadAll(){
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch(e){ saved = {}; }
    writeRaw(saved.raw || null);
    if (saved.ui){
      // actual future amounts are the default; keep today's prices only for people who picked it themselves
      if (saved.ui.unitSet && (saved.ui.unit === 'real' || saved.ui.unit === 'cash')){ ui.unit = saved.ui.unit; ui.unitSet = true; }
      if (saved.ui.lang && I18N[saved.ui.lang]) ui.lang = saved.ui.lang;
      if (saved.ui.look === 'night') ui.look = 'night';
      if (saved.ui.tab === 'sum') ui.tab = 'sum';
      if (saved.ui.hideAmts === true) ui.hideAmts = true;
      if (saved.ui.touched && typeof saved.ui.stopAge === 'number'){ ui.touched = true; ui.stopAge = saved.ui.stopAge; }
      if (typeof saved.ui.live === 'number') ui.live = saved.ui.live;
      if (saved.ui.answers) ['match', 'cash', 'debt', 'life'].forEach(k => { const v = saved.ui.answers[k]; if (v === 'yes' || v === 'no') ui.answers[k] = v; });
    }
  }
  function saveAll(){ try { localStorage.setItem(STORE, JSON.stringify({raw: readRaw(), ui})); } catch(e){} }

  /* ---------- parsing ---------- */
  function parse(raw){
    const g = (k, fb) => {
      const s = String(raw[k] === undefined || raw[k] === null ? '' : raw[k]).replace(/[^0-9.\-]/g, '');
      if (s === '' || s === '-' || s === '.') return fb;
      const v = parseFloat(s); return isFinite(v) ? v : fb;
    };
    const has = k => g(k, null) !== null;
    const age = Math.round(clamp(g('age', 30), 0, 100));
    const retireIn = Math.round(clamp(g('retire', 60), 1, 105));
    const badRetire = retireIn <= age;
    const years = badRetire ? 1 : Math.min(retireIn - age, 80);
    const retire = age + years;
    const two = !!raw.two;
    const pAge = two ? Math.round(clamp(g('pAge', age), 0, 100)) : age;
    let pRetire = two ? Math.round(clamp(g('pRetire', pAge + years), 0, 110)) : retire;
    const badPartner = two && pRetire < pAge;
    if (pRetire < pAge) pRetire = pAge;
    const steps = [];
    for (let i = 1; i <= 2; i++) if (has('st' + i + 'Age') && has('st' + i + 'Amt')) steps.push({age: g('st' + i + 'Age', 0), amt: Math.max(0, g('st' + i + 'Amt', 0))});
    steps.sort((a, b) => a.age - b.age);
    const incomes = [];
    for (let i = 1; i <= MAX_ROWS; i++){
      const amt = Math.max(0, g('in' + i + 'Amt', 0));
      if (amt <= 0) continue;
      const who = two && raw['in' + i + 'Who'] === 'partner' ? 'partner' : 'you';
      incomes.push({name: String(raw['in' + i + 'Name'] || '').trim(), amt, who, fixed: raw['in' + i + 'Ix'] !== 'real',
        from: g('in' + i + 'From', who === 'partner' ? pRetire : retire), to: has('in' + i + 'To') ? g('in' + i + 'To', 200) : null});
    }
    const oneoffs = [];
    for (let i = 1; i <= MAX_ROWS; i++){
      const amt = Math.max(0, g('on' + i + 'Amt', 0));
      if (amt <= 0 || !has('on' + i + 'Age')) continue;
      oneoffs.push({amt: raw['on' + i + 'Dir'] === 'in' ? amt : -amt, age: g('on' + i + 'Age', 0), name: String(raw['on' + i + 'Name'] || '').trim()});
    }
    return {
      start: Math.max(0, g('start', 0)), X: Math.max(0, g('monthly', 0)), raise: clamp(g('raise', 0), -10, 20) / 100,
      infl: clamp(g('infl', 0), 0, 25) / 100, growth: clamp(g('growth', 0), -20, 40) / 100, growthR: clamp(g('growth2', 0), -20, 40) / 100,
      age, years, retire, badRetire, spend: Math.max(0, g('spend', 0)),
      s1: clamp(g('s1', 25), 0.1, 99) / 100, s2: clamp(g('s2', 5), 0.1, 99) / 100,
      fees: clamp(g('fees', 0), 0, 10) / 100, tax: clamp(g('tax', 0), 0, 90) / 100, legacy: Math.max(0, g('legacy', 0)),
      steps, incomes, oneoffs,
      two, pAge, pRetire, badPartner, pStart: two ? Math.max(0, g('pStart', 0)) : 0, pX: two ? Math.max(0, g('pMonthly', 0)) : 0,
      yld: clamp(g('yield', 0), 0, 30) / 100, vol1: clamp(g('vol1', 15), 0, 60) / 100, vol2: clamp(g('vol2', 10), 0, 60) / 100,
      fall: clamp(g('fall', 30), 0, 95) / 100, pay: Math.max(0, g('pay', 0))
    };
  }
  function extrasCount(p){
    let n = 0;
    if (p.fees > 0) n++; if (p.tax > 0) n++; if (p.legacy > 0) n++;
    n += p.steps.length + p.incomes.length + p.oneoffs.length; if (p.two) n++;
    return n;
  }

  /* ---------- formatting ---------- */
  let unitCash = false;
  const money = v => (Math.round(v) < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString('en-GB');
  const dsp = (p, v, m) => unitCash ? v * Math.pow(1 + p.infl, (m || 0) / 12) : v;
  const mon = (p, v, m) => money(dsp(p, v, m));
  function compact(v){
    const a = Math.abs(v), s = v < 0 ? '−' : '';
    const r = x => String(Math.round(x * 10) / 10);
    if (a >= 1e9) return s + r(a / 1e9) + 'bn';
    if (a >= 1e6) return s + r(a / 1e6) + 'm';
    if (a >= 1e3) return s + r(a / 1e3) + 'k';
    return s + Math.round(a);
  }
  const pct = v => (Math.round(v * 1000) / 10) + '%';
  function dur(m){
    const y = Math.floor(m / 12), mo = m % 12;
    if (LANG === 'th') return [y ? y + ' ปี' : '', mo ? mo + ' เดือน' : ''].filter(Boolean).join(' ') || '0 เดือน';
    if (LANG === 'zh') return ((y ? y + '年' : '') + (mo ? mo + '个月' : '')) || '0个月';
    const parts = [];
    if (y) parts.push(y + (y === 1 ? ' year' : ' years'));
    if (mo) parts.push(mo + (mo === 1 ? ' month' : ' months'));
    return parts.join(' ') || 'no time';
  }
  function ageText(m, p){
    const total = p.age * 12 + m, y = Math.floor(total / 12), mo = total % 12;
    if (LANG === 'th') return 'อายุ ' + y + ' ปี' + (mo ? ' ' + mo + ' เดือน' : '');
    if (LANG === 'zh') return y + '岁' + (mo ? mo + '个月' : '');
    return 'age ' + y + (mo ? ' and ' + mo + (mo === 1 ? ' month' : ' months') : '');
  }
  const capFirst = s => LANG === 'en' ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const ageAt = (m, p) => Math.floor(p.age + m / 12);
  const unitWords = () => t(unitCash ? 'u.words.cash' : 'u.words.real');
  /* ---------- the model ---------- */
  function makeModel(p, forever){
    const H = p.years * 12;
    const accLen = Math.max(H + 12, 1200);
    const len = forever ? Math.max(accLen, H + FH) : Math.max(accLen, (MAX_AGE + 1 - p.age) * 12, H + 12);
    const iEnd = Math.min(len, Math.max(H, (MAX_AGE - p.age) * 12));
    const rA = Math.pow((1 + p.growth) * (1 - p.fees) / (1 + p.infl), 1 / 12) - 1;
    const rB = Math.pow((1 + p.growthR) * (1 - p.fees) / (1 + p.infl), 1 / 12) - 1;
    const rate = new Float64Array(len), u = new Float64Array(len), cP = new Float64Array(len), one = new Float64Array(len);
    const inc = new Float64Array(len), spendA = new Float64Array(len), wd = new Float64Array(len), net = new Float64Array(len);
    for (let m = 0; m < len; m++){
      rate[m] = m < H ? rA : rB;
      u[m] = Math.pow(1 + p.raise, Math.floor(m / 12)) / Math.pow(1 + p.infl, (m + 1) / 12);
      if (p.two) cP[m] = p.pX * u[m];
    }
    p.oneoffs.forEach(o => { const m = Math.round((o.age - p.age) * 12); if (m >= 0 && m < len) one[m] += o.amt; });
    for (let m = H; m < len; m++){
      const a = p.age + m / 12;
      let s = p.spend;
      p.steps.forEach(st => { if (a >= st.age) s = st.amt; });
      spendA[m] = s;
      let x = 0;
      p.incomes.forEach(ic => {
        const oa = ic.who === 'partner' ? p.pAge + m / 12 : a;
        if (oa >= ic.from && (ic.to === null || oa < ic.to)){
          const sm = ((ic.who === 'partner' ? ic.from - p.pAge : ic.from - p.age)) * 12;
          x += ic.fixed ? ic.amt / Math.pow(1 + p.infl, Math.max(0, m - sm) / 12) : ic.amt;
        }
      });
      inc[m] = x;
      net[m] = Math.max(0, s - x);
      wd[m] = net[m] / (1 - p.tax);
    }
    const H2 = p.two ? Math.max(0, (p.pRetire - p.pAge) * 12) : 0;
    return {p, H, H2, len, accLen, iEnd, forever: !!forever, rA, rB, rate, u, cP, one, inc, spendA, wd, net, X: p.X, start: p.start + p.pStart, legacy: p.legacy};
  }
  // o: {stop (month your payments stop), acc (keep paying forever, take nothing out), X, shockAt, shock, len}
  function run(q, o){
    o = o || {};
    const len = o.len || q.len;
    const X = o.X !== undefined ? o.X : q.X;
    const acc = !!o.acc;
    const hasStop = o.stop !== undefined;
    const youStop = acc ? (hasStop ? o.stop : Infinity) : Math.min(hasStop ? o.stop : q.H, q.H);
    const partStop = acc ? (hasStop ? o.stop : Infinity) : ((hasStop && o.stop < q.H) ? Math.min(o.stop, q.H2) : q.H2);
    const pot = new Float64Array(len + 1), gr = new Float64Array(len), co = new Float64Array(len);
    let P = q.start, out = null;
    pot[0] = P;
    for (let m = 0; m < len; m++){
      P += q.one[m]; if (P < 0) P = 0;
      if (o.shockAt === m) P *= (1 - o.shock);
      const g = P * q.rate[m]; P += g;
      const c = (m < youStop ? X * q.u[m] : 0) + (m < partStop ? q.cP[m] : 0);
      P += c;
      if (!acc && m >= q.H){
        const w = q.wd[m];
        if (P >= w) P -= w; else { if (out === null) out = m; P = 0; }
      }
      pot[m + 1] = P; gr[m] = g; co[m] = c;
    }
    if (q.forever && !acc && !o.len && out === null) out = foreverOut(P, q.rate[len - 1], q.wd[len - 1], len);
    return {pot, gr, co, out};
  }
  // After the modelled years nothing changes any more, so each month the pot goes P -> P(1+r) - w.
  // Returns the month it can no longer pay w, or null if it never runs out.
  function foreverOut(P, r, w, m0){
    if (w <= 0 || (r > 0 && P * r >= w)) return null;
    if (P <= 0) return m0;
    const n = Math.abs(r) < 1e-12 ? P / w : Math.log((w / r) / (w / r - P)) / Math.log(1 + r);
    return m0 + Math.max(0, Math.floor(n));
  }
  // true if, at the end of the model, what the pot earns covers what you take out
  const lastsForever = (q, res) => q.wd[q.len - 1] <= 0 || (q.rB > 0 && res.pot[q.len] * q.rB >= q.wd[q.len - 1]);
  function ok(q, res, nL){
    if (q.forever) return res.out === null;
    const end = q.H + nL;
    return (res.out === null || res.out >= end) && res.pot[end] >= q.legacy - 1e-6;
  }
  function needBack(q, res, nL){
    let R = q.legacy;
    if (q.forever){
      // enough at the end to live on what it earns
      const w = q.wd[q.len - 1], r = q.rate[q.len - 1];
      if (w > 0 && r <= 0) return Infinity;
      R = w > 0 ? w / r : 0;
    }
    for (let m = q.H + nL - 1; m >= q.H; m--){
      R = Math.max(0, Math.max(0, (R + q.wd[m] - res.co[m]) / (1 + q.rate[m])) - q.one[m]);
    }
    return R;
  }
  function annuity(P, rm, months){
    if (months <= 0) return 0;
    if (Math.abs(rm) < 1e-10) return P / months;
    return P * rm / (1 - Math.pow(1 + rm, -months));
  }
  function searchX(test){
    if (test(0)) return 0;
    let lo = 0, hi = 100;
    while (!test(hi) && hi < 1e8) { lo = hi; hi *= 2; }
    if (!test(hi)) return null;
    for (let k = 0; k < 40 && hi - lo > 0.5; k++){ const mid = (lo + hi) / 2; if (test(mid)) hi = mid; else lo = mid; }
    return Math.ceil(hi);
  }
  const payToLast = (q, nL) => searchX(X => ok(q, run(q, {X}), nL));
  function lastsTxt(res, q){
    const p = q.p;
    if (res.out !== null) return t('lasts.age', {a: ageAt(res.out, p)});
    return t(q.forever || lastsForever(q, res) ? 'lasts.never' : 'lasts.past');
  }

  function compute(p, N, L){
    const forever = L > MAX_AGE;
    const q = makeModel(p, forever), H = q.H;
    const nL = forever ? FH : (L - p.retire) * 12;
    // scenarios: keep paying in forever, nothing taken out
    const acc = run(q, {acc: true, len: q.accLen});
    const share = new Float64Array(q.accLen);
    let cross = null, m1 = null, m2 = null;
    for (let m = 0; m < q.accLen; m++){
      const c = acc.co[m], g = acc.gr[m];
      const sh = c <= 0 ? 0 : (g <= 0 ? 1 : c / (c + g));
      share[m] = sh;
      if (cross === null && sh < 0.5) cross = m;
      if (m1 === null && sh < p.s1) m1 = m;
      if (m2 === null && sh < p.s2) m2 = m;
    }
    let m3 = null, pot3 = null;
    if (m1 !== null){
      const s3 = run(q, {acc: true, stop: m1, len: q.accLen});
      for (let m = m1; m < q.accLen; m++){
        const hyp = q.X * q.u[m] + q.cP[m], g = s3.gr[m];
        const sh = hyp <= 0 ? 0 : (g <= 0 ? 1 : hyp / (hyp + g));
        if (sh < p.s2){ m3 = m; pot3 = s3.pot[m]; break; }
      }
    }
    const keep = run(q, {stop: H});
    const stopRes = run(q, {stop: N * 12});
    const s3Ret = m1 !== null ? run(q, {stop: Math.min(m1, H)}) : null;
    const need = needBack(q, keep, nL);
    let coast = null;
    if (p.spend > 0 || p.legacy > 0){
      if (ok(q, run(q, {stop: 0}), nL)) coast = 0;
      else if (ok(q, keep, nL)){
        let lo = 0, hi = H;
        while (hi - lo > 1){ const mid = (lo + hi) >> 1; if (ok(q, run(q, {stop: mid}), nL)) hi = mid; else lo = mid; }
        coast = hi;
      }
    }
    const shock = run(q, {stop: H, shockAt: H, shock: p.fall});
    let maxW = 0;
    for (let m = H; m < H + nL; m++) maxW = Math.max(maxW, q.wd[m]);
    const pNever = q.rB > 0 ? maxW / q.rB : null;
    // last age the charts show: in forever mode, a little past the age the money runs out, or 120
    const chartL = !forever ? L : clamp(keep.out !== null ? ageAt(keep.out, p) + 5 : MAX_AGE, MAX_AGE, p.retire + FH / 12);
    return {q, nL, L, N, forever, chartL, acc, share, cross, m1, m2, m3, pot3, keep, stopRes, s3Ret, need, coast, shock, pNever};
  }
  // slower extras, computed once per render
  function computeMore(p, R){
    const q = R.q, nL = R.nL;
    R.payL = payToLast(q, nL);
    const pLow = Object.assign({}, p, {growth: p.growth - 0.02, growthR: p.growthR - 0.02});
    R.qLow = makeModel(pLow, q.forever);
    R.payLow = payToLast(R.qLow, nL);
    R.needLow = needBack(R.qLow, run(R.qLow, {stop: R.qLow.H}), nL);
    R.payNever = R.pNever !== null ? searchX(X => run(q, {X}).pot[q.H] >= R.pNever) : null;
    if (R.m1 !== null) R.lowS1 = run(R.qLow, {stop: Math.min(R.m1, R.qLow.H)});
    R.god = godTest(p);
    // retirement ages
    R.ages = [];
    [p.retire - 5, p.retire, p.retire + 5].forEach(ra => {
      if (ra <= p.age || ra >= R.L || ra > 105){ R.ages.push(null); return; }
      const pa = Object.assign({}, p, {retire: ra, years: ra - p.age});
      const qa = makeModel(pa, q.forever), nLa = q.forever ? FH : (R.L - ra) * 12;
      const res = run(qa, {stop: qa.H});
      R.ages.push({ra, p: pa, q: qa, nL: nLa, res, need: needBack(qa, res, nLa), pay: payToLast(qa, nLa)});
    });
  }

  /* ---------- the next step up on Your future ---------- */
  // The Your future level for a changed plan at the same live-to age (a smaller market test, to stay quick).
  function futureLevel(pp, L){
    const R2 = compute(pp, pp.years, L), q2 = R2.q;
    if (!ok(q2, R2.keep, R2.nL)) return 'bad';
    const c = monteCarlo(q2, R2.nL, 400, false).chance;
    if (c < 0.75) return 'ok';
    if (!(c >= 0.99 && ok(q2, R2.shock, R2.nL))) return 'good';
    const G = godTest(pp);
    return G.ok ? 'dyn' : 'gold';
  }
  // Two ways to reach the next level up: retiring later (up to 15 years), or spending less in retirement.
  function nextStep(p, L, fs){
    const LV = LEVELS.fut, i = LV.indexOf(fs);
    if (i <= 0) return null;
    const target = LV[i - 1], reaches = pp => LV.indexOf(futureLevel(pp, L)) <= i - 1;
    let age = null;
    for (let ra = p.retire + 1; ra <= Math.min(p.retire + 15, 105, L - 1); ra++){
      if (reaches(Object.assign({}, p, {retire: ra, years: ra - p.age}))){ age = ra; break; }
    }
    // spending scaled down (later spending steps too), largest amount that still gets there
    const scaled = f => Object.assign({}, p, {spend: p.spend * f, steps: p.steps.map(st => ({age: st.age, amt: st.amt * f}))});
    let spend = null;
    if (p.spend > 0 && reaches(scaled(0))){
      let lo = 0, hi = 1;
      for (let k = 0; k < 12; k++){ const mid = (lo + hi) / 2; if (reaches(scaled(mid))) lo = mid; else hi = mid; }
      const y = Math.floor(p.spend * lo / 10) * 10;
      if (y > 0 && y < p.spend) spend = y;
    }
    return {target, age, spend};
  }

  /* ---------- God Emperor test ---------- */
  // With steady growth, could the pot pay for 5 times your retirement spending and still never shrink, to 120 and forever after?
  const GOD_X = 5;
  function godModel(p){
    return makeModel(Object.assign({}, p, {spend: p.spend * GOD_X, steps: p.steps.map(st => ({age: st.age, amt: st.amt * GOD_X}))}), true);
  }
  function godOk(q, res){
    if (res.out !== null) return false;
    for (let m = q.H; m < q.len; m++) if (res.pot[m + 1] < res.pot[m] * (1 - 1e-9) - 1e-6) return false;
    return true;
  }
  function godTest(p){
    if (!(p.spend > 0)) return {ok: false, imp: true};
    const q = godModel(p), res = run(q, {stop: q.H});
    return {q, ok: godOk(q, res), spend: p.spend * GOD_X};
  }
  // how much to invest each month to pass it; only worked out when someone is one step away
  function godPay(G){
    if (!G.q) return null;
    if (G.pay === undefined) G.pay = searchX(X => godOk(G.q, run(G.q, {X})));
    return G.pay;
  }

  /* ---------- random markets ---------- */
  const ZP = 1000, ZY = 200;
  let Zm = null;
  function getZ(){
    if (Zm) return Zm;
    let a = 20261019;
    const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    Zm = new Float64Array(ZP * ZY);
    for (let k = 0; k < ZP * ZY; k += 2){
      const u1 = Math.max(rnd(), 1e-12), u2 = rnd(), r = Math.sqrt(-2 * Math.log(u1));
      Zm[k] = r * Math.cos(2 * Math.PI * u2); Zm[k + 1] = r * Math.sin(2 * Math.PI * u2);
    }
    return Zm;
  }
  function monteCarlo(q, nL, paths, wantFan, Xo){
    const X = Xo !== undefined ? Xo : q.X;
    const p = q.p, Z = getZ(), H = q.H, end = H + nL, ny = Math.ceil(end / 12) + 1;
    const pre = new Float64Array(ny), post = new Float64Array(ny);
    const atL = new Float64Array(paths), outs = new Float64Array(paths);
    const fanLen = end / 12 + 1;
    const fan = wantFan ? new Float64Array(paths * fanLen) : null;
    let good = 0;
    const f = (g, z, v) => { let R = g + v * z; if (R < -0.95) R = -0.95; return Math.pow((1 + R) * (1 - p.fees) / (1 + p.infl), 1 / 12) - 1; };
    for (let k = 0; k < paths; k++){
      for (let y = 0; y < ny; y++){ const z = Z[k * ZY + Math.min(y, ZY - 1)]; pre[y] = f(p.growth, z, p.vol1); post[y] = f(p.growthR, z, p.vol2); }
      let P = q.start, out = false, outM = Infinity;
      for (let m = 0; m < end; m++){
        if (fan && m % 12 === 0) fan[k * fanLen + m / 12] = P;
        P += q.one[m]; if (P < 0) P = 0;
        const y = (m / 12) | 0;
        P += P * (m < H ? pre[y] : post[y]);
        P += (m < H ? X * q.u[m] : 0) + (m < q.H2 ? q.cP[m] : 0);
        if (m >= H){ const w = q.wd[m]; if (P >= w) P -= w; else { if (!out) outM = m; out = true; P = 0; } }
      }
      if (q.forever && !out){ const fo = foreverOut(P, q.rB, q.wd[end - 1], end); outM = fo === null ? Infinity : fo; }
      outs[k] = outM;
      if (fan) fan[k * fanLen + fanLen - 1] = P;
      atL[k] = P;
      if (q.forever ? outM === Infinity : (!out && P >= q.legacy - 1e-6)) good++;
    }
    const pctl = (arr, f2) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(f2 * (arr.length - 1))))];
    const sorted = Array.from(atL).sort((a, b) => a - b);
    const so = Array.from(outs).sort((a, b) => a - b);
    const res = {chance: good / paths, p10: pctl(sorted, 0.1), p50: pctl(sorted, 0.5), p90: pctl(sorted, 0.9), o10: pctl(so, 0.1), o50: pctl(so, 0.5), o90: pctl(so, 0.9)};
    if (fan){
      res.f10 = []; res.f50 = []; res.f90 = [];
      const col = new Float64Array(paths);
      for (let y = 0; y < fanLen; y++){
        for (let k = 0; k < paths; k++) col[k] = fan[k * fanLen + y];
        const s = Array.from(col).sort((a, b) => a - b);
        res.f10.push(pctl(s, 0.1)); res.f50.push(pctl(s, 0.5)); res.f90.push(pctl(s, 0.9));
      }
    }
    return res;
  }


  /* ---------- scenario rows ---------- */
  const xTotal = p => p.X + (p.two ? p.pX : 0);
  const hasRetirementGoal = p => p.spend > 0 || p.steps.length > 0 || p.legacy > 0;
  // money to leave doesn't apply in forever mode: there's no end to leave it at
  const leaveTxt = (p, end) => p.legacy > 0 && !inForever ? t('leave', {x: mon(p, p.legacy, end)}) : '';
  // runs out before the live-to age (in forever mode: ever)
  const goneBy = (R, res) => res.out !== null && (R.forever || res.out < R.q.H + R.nL);
  // the pot needed can be endless in forever mode, when growth after retirement doesn't beat inflation
  const monNeed = (p, v, m) => isFinite(v) ? mon(p, v, m) : t('notPossible');
  function setRow(k, fig, cap, text){ $('f' + k).textContent = fig; $('fc' + k).textContent = cap; $('v' + k).textContent = text; }
  function scenRow(k, m, p, R){
    const q = R.q;
    if (xTotal(p) <= 0) return setRow(k, '–', '', t('nothingIn'));
    if (m === null) return setRow(k, t('never'), '', t((q.rA <= 0 && q.rB <= 0) ? 'scen.neverInfl' : 'scen.never100'));
    const P = R.acc.pot[m], g = R.acc.gr[m], c = R.acc.co[m];
    const nom = xTotal(p) * Math.pow(1 + p.raise, Math.floor(m / 12));
    const pre = m === 0 ? t('scen.already') : (m <= q.H ? '' : t('scen.afterRet', {r: p.retire}));
    const body = t('scen.' + (unitCash ? 'cash' : 'real') + (p.two ? '2' : '1'), {g: mon(p, g, m), nom: money(nom), c: money(c), s: pct(k === '1' ? p.s1 : p.s2)});
    setRow(k, mon(p, P, m), m === 0 ? t('cap.today') : t('cap.at', {A: ageText(m, p)}), join([pre, body]));
  }
  function scen3Row(p, R){
    const q = R.q;
    if (xTotal(p) <= 0) return setRow('3', '–', '', t('nothingIn'));
    if (R.m1 === null) return setRow('3', '–', '', t('s3.na'));
    if (R.m3 === null) return setRow('3', t('no2'), '', t('s3.no100'));
    const parts = [];
    if (R.m3 === R.m1) parts.push(t('s3.straight'));
    else {
      parts.push(R.m1 === 0 ? t('s3.yesNow', {A3: ageText(R.m3, p)}) : t('s3.yesAt', {A1: ageText(R.m1, p), A3: ageText(R.m3, p)}));
      if (R.m2 !== null && R.m3 > R.m2) parts.push(t('s3.later', {d: dur(R.m3 - R.m2)}));
      if (R.m3 > q.H) parts.push(t('s3.afterRet', {r: p.retire}));
    }
    if (R.m1 < q.H) parts.push(t('s3.atRet', {r: p.retire, a: mon(p, R.s3Ret.pot[q.H], q.H), b: mon(p, R.keep.pot[q.H], q.H)}));
    setRow('3', mon(p, R.pot3, R.m3), t('cap.at', {A: ageText(R.m3, p)}), join(parts));
  }
  function coastRow(p, R){
    const q = R.q, H = q.H, end = H + R.nL, lv = leaveTxt(p, end);
    if (R.coast === 0) return setRow('C', mon(p, R.keep.pot[0], 0), t('cap.today'), t('coast.now', {r: p.retire, L: R.L, leave: lv}));
    if (R.coast !== null) return setRow('C', mon(p, R.keep.pot[R.coast], R.coast), t('cap.at', {A: ageText(R.coast, p)}),
      t('coast.at', {A: ageText(R.coast, p), r: p.retire, L: R.L, leave: lv}));
    if (!isFinite(R.need)) return setRow('C', t('notReached'), '', t('coast.inf'));
    setRow('C', t('notReached'), '', t('coast.no', {r: p.retire, pot: mon(p, R.keep.pot[H], H), L: R.L, leave: lv, need: mon(p, R.need, H), more: mon(p, R.need - R.keep.pot[H], H)}));
  }
  function renderScen(p, R){
    const q = R.q, x = xTotal(p);
    const pw = t(p.two ? 'pw2' : 'pw1', {x: money(x)});
    let lead;
    if (x <= 0) lead = t('lead.none');
    else if (R.cross === 0) lead = t('lead.already', {pw});
    else if (R.cross === null) lead = t(q.rA <= 0 ? 'lead.neverInfl' : 'lead.never100', {pw});
    else lead = t('lead.at', {pw, A: ageText(R.cross, p)});
    $('lead').textContent = lead;
    $('unitNote').textContent = t(unitCash ? 'unit.cash' : 'unit.real');
    scenRow('1', R.m1, p, R);
    scenRow('2', R.m2, p, R);
    scen3Row(p, R);
    const show = hasRetirementGoal(p);
    $('coastRow').hidden = !show; $('keyNeed').hidden = !show;
    if (show) coastRow(p, R);
  }

  /* ---------- stop slider ---------- */
  function renderStop(p, R){
    const q = R.q, H = q.H, N = R.N, stopAge = p.age + N;
    const full = R.keep.pot[H], stopped = R.stopRes.pot[H], Dl = full - stopped;
    let Sr = 0, Sc = 0;
    for (let m = 0; m < H; m++){ const d = R.keep.co[m] - R.stopRes.co[m]; Sr += d; Sc += d * Math.pow(1 + p.infl, (m + 1) / 12); }
    const S = unitCash ? Sc : Sr;
    $('stopLbl').textContent = t(p.two ? 'stop.lbl2' : 'stop.lbl1');
    $('stopOut').textContent = N === 0 ? t('stop.now', {a: p.age}) : t('stop.at', {a: stopAge});
    $('h-pot').textContent = t('pot.h', {u: unitWords()});
    $('cTitle').textContent = t('cTitle', {r: p.retire, u: unitWords()});
    $('dFull').textContent = t('dFull', {r: p.retire});
    $('dStop').textContent = N === 0 ? t('stopNow') : t('stopAt', {a: stopAge});
    $('cFull').textContent = mon(p, full, H);
    $('cStop').textContent = mon(p, stopped, H);
    $('cCost').textContent = Dl > 0.5 ? t('cost.less', {x: mon(p, Dl, H), p: pct(full > 0 ? Dl / full : 0)}) : t('nothing');
    $('cFree').textContent = money(S);
    let ratio = '';
    if (xTotal(p) > 0){
      if (N >= p.years) ratio = t('ratio.ret');
      else if (S > 0) ratio = t('ratio.cost', {k: Math.round(100 * dsp(p, Dl, H) / S), r: p.retire});
    }
    $('cRatio').textContent = ratio;
  }

  /* ---------- retirement ---------- */
  function outcome(res, q){
    if (res.out !== null) return t('out.at', {a: ageAt(res.out, q.p)});
    if (q.forever) return t('lasts.never');
    return t(res.pot[q.iEnd] >= res.pot[q.H] ? 'out.grow' : (lastsForever(q, res) ? 'lasts.never' : 'out.past'));
  }
  function incStartMonth(ic, p){ return Math.max(0, Math.round(((ic.who === 'partner' ? ic.from - p.pAge : ic.from - p.age)) * 12)); }
  function renderRetirement(p, R){
    const q = R.q, H = q.H, end = H + R.nL;
    $('rStopHead').textContent = R.N === 0 ? t('stopNow') : t('stopAt', {a: p.age + R.N});
    $('rl0').textContent = t('potAt', {a: p.retire});
    $('rrFee').hidden = !(p.fees > 0); $('rrInc').hidden = !(p.incomes.length > 0); $('rrTax').hidden = !(p.tax > 0);
    [{res: R.keep, k: 'k'}, {res: R.stopRes, k: 's'}].forEach(c => {
      const P = c.res.pot[H], tot = c.res.gr[H], div = P * p.yld / 12, val = tot - div, fee = P * p.fees / 12;
      const set = (i, v) => $('r' + c.k + i).textContent = v;
      set(0, mon(p, P, H)); set(1, mon(p, div, H)); set(2, mon(p, val, H)); set(3, fee > 0.5 ? '−' + mon(p, fee, H) : '0');
      set(4, mon(p, tot, H)); set(5, mon(p, q.inc[H], H)); set(6, mon(p, q.wd[H], H)); set(7, mon(p, q.wd[H] - q.net[H], H));
      set(8, P > 0 ? pct(12 * q.wd[H] / P) : '–'); set(9, outcome(c.res, q));
    });
    const P = R.keep.pot[H], tot = R.keep.gr[H], div = P * p.yld / 12, val = tot - div;
    const parts = [t(val >= 0 ? 'r.l1pos' : 'r.l1neg', {r: p.retire, P: mon(p, P, H), g: pct(p.growthR), div: mon(p, div, H), val: mon(p, Math.abs(val), H), fees: p.fees > 0 ? t('r.fees') : ''}),
      t('r.total', {t: mon(p, tot, H)})];
    if (!hasRetirementGoal(p)) parts.push(t('r.noGoal'));
    else {
      parts.push(t('r.spend', {s: mon(p, q.spendA[H], H), inc: q.inc[H] > 0 ? t('r.inc', {i: mon(p, q.inc[H], H)}) : '', w: mon(p, q.wd[H], H), tax: p.tax > 0 ? t('r.tax') : ''}));
      p.incomes.forEach(ic => {
        const sm = incStartMonth(ic, p);
        if (sm > H) parts.push(t(ic.who === 'partner' ? 'r.incLaterP' : 'r.incLater', {name: ic.name || t('otherIncome'), amt: mon(p, ic.amt, sm), a: ic.from}));
      });
      if (q.wd[H] > 0 && q.wd[H] <= div) parts.push(t('r.divCover'));
      if (R.keep.out !== null) parts.push(t('r.out', {A: ageText(R.keep.out, p)}));
      else if (q.forever) parts.push(t('r.lastsF'));
      else parts.push(t(R.keep.pot[q.iEnd] >= P ? 'r.grow' : 'r.shrink'));
    }
    $('rLead').textContent = join(parts);
    $('liveOut').textContent = t('live.out', {L: R.L}) + (p.two && !R.forever ? t('live.partner', {a: p.pAge + R.L - p.age}) : '');
    $('leftTitle').textContent = t('left.title', {L: R.L, u: unitWords()});
    $('leftSLabel').textContent = R.N === 0 ? t('stopNow') : t('stopAt', {a: p.age + R.N});
    const gone = res => goneBy(R, res);
    const leftOf = res => gone(res) ? t('goneAt', {a: ageAt(res.out, p)}) : (R.forever ? t('lasts.never') : mon(p, res.pot[end], end));
    $('leftK').textContent = leftOf(R.keep);
    $('leftS').textContent = leftOf(R.stopRes);
    let note;
    if (gone(R.keep)) note = t('left.gone', {A: ageText(R.keep.out, p), d: R.forever ? '' : dur(end - R.keep.out), L: R.L});
    else if (R.forever) note = t('left.never');
    else {
      const lk = R.keep.pot[end];
      note = join([t(lk >= P ? 'left.bigger' : 'left.smaller', {L: R.L}),
        p.legacy > 0 ? t(lk >= p.legacy ? 'left.legOk' : 'left.legShort', {x: mon(p, p.legacy, end)}) : '']);
    }
    $('leftNote').textContent = note;
    $('h-retc').textContent = t('retc.h', {u: unitWords()});
    let need = '';
    if (hasRetirementGoal(p)){
      need = join([isFinite(R.need) ? t('r.need', {L: R.L, leave: leaveTxt(p, end), n: mon(p, R.need, H), r: p.retire}) : t('r.needInf'),
        // in forever mode "never runs out" and "never shrinks" come to the same amount, so it's said once
        (!R.forever && R.pNever !== null && R.pNever > 0) ? t('r.never', {n: mon(p, R.pNever, H)}) : '']);
    }
    $('rNeed').textContent = need;
  }

  /* ---------- markets ---------- */
  function renderBadStart(p, R){
    const q = R.q, H = q.H, end = H + R.nL, sh = R.shock, kp = R.keep, f = pct(p.fall);
    $('h-mcc').textContent = t('mcc.h', {u: unitWords()});
    let parts;
    const left = t('bs.left', {L: R.L, a: mon(p, sh.pot[end], end), b: mon(p, kp.pot[end], end)});
    if (!hasRetirementGoal(p)) parts = [t('bs.noGoal', {f, L: R.L, a: mon(p, sh.pot[end], end), b: mon(p, kp.pot[end], end)})];
    else {
      if (sh.out === null && kp.out === null) parts = [t('bs.both', {f})];
      else if (kp.out !== null) parts = [t('bs.outOut', {f, A1: ageText(sh.out !== null ? sh.out : kp.out, p), A2: ageText(kp.out, p)})];
      else parts = [t('bs.outLast', {f, A1: ageText(sh.out, p)})];
      if (!R.forever && (sh.out === null || sh.out >= end)) parts.push(left);
    }
    $('bsText').textContent = join(parts);
  }
  function renderMC(p, R, mc){
    const q = R.q, end = q.H + R.nL;
    $('mcChance').textContent = Math.round(mc.chance * 100) + '%';
    $('mcCap').textContent = t('mc.cap', {L: R.L, leave: leaveTxt(p, end)});
    const steady = ok(q, R.keep, R.nL);
    let lead;
    if (!hasRetirementGoal(p)) lead = t('mc.noGoal');
    else lead = join([steady ? t('mc.ok', {L: R.L}) : (R.keep.out !== null ? t('mc.out', {A: ageText(R.keep.out, p)}) : t('mc.short')),
      t('mc.n', {n: Math.round(mc.chance * 1000).toLocaleString('en-GB')})]);
    $('mcLead').textContent = lead;
    // forever mode shows how long each kind of history lasts, not what's left
    const fv = (v, o) => R.forever ? (isFinite(o) ? t('goneAt', {a: ageAt(o, p)}) : t('lasts.never'))
      : ((v <= 0.5 && isFinite(o)) ? t('goneAt', {a: ageAt(o, p)}) : mon(p, v, end));
    $('mcP10').textContent = fv(mc.p10, mc.o10); $('mcP50').textContent = fv(mc.p50, mc.o50); $('mcP90').textContent = fv(mc.p90, mc.o90);
    $('mcFigNote').textContent = t('mc.figNote', {L: R.L});
    $('mcBusy').textContent = '';
    if (mcChart){
      const C = potChart.$colours, a = [], b = [], c = [], d = [];
      for (let y = 0; y < Math.min(mc.f50.length, R.chartL - p.age + 1); y++){
        const x = p.age + y, m = y * 12;
        a.push({x, y: dsp(p, mc.f90[y], m)}); b.push({x, y: dsp(p, mc.f10[y], m)}); c.push({x, y: dsp(p, mc.f50[y], m)}); d.push({x, y: dsp(p, R.keep.pot[m], m)});
      }
      mcChart.data.datasets[0].data = a; mcChart.data.datasets[1].data = b; mcChart.data.datasets[2].data = c; mcChart.data.datasets[3].data = d;
      mcChart.options.scales.x.min = p.age; mcChart.options.scales.x.max = R.chartL;
      mcChart.$mk = {tagText: C.surface, labelBg: C.bg, vlines: [{x: p.retire, label: t('retireTag'), color: C.muted}], hlines: []};
      mcChart.update('none');
    }
  }

  function payFor(q, nL, thr){
    const N = 400, good = X => monteCarlo(q, nL, N, false, X).chance >= thr;
    if (good(q.X)) return {ok: true};
    let lo = q.X, hi = Math.max(200, q.X * 2);
    while (!good(hi) && hi < 1e7){ lo = hi; hi *= 2; }
    if (!good(hi)) return {impossible: true};
    for (let k = 0; k < 16 && hi - lo > 5; k++){ const mid = (lo + hi) / 2; if (good(mid)) hi = mid; else lo = mid; }
    return {X: Math.ceil(hi / 10) * 10};
  }
  function renderRainyFix(p, R, mc){
    const el = $('mcFix');
    if (!hasRetirementGoal(p)){ el.textContent = ''; return; }
    const rp = payFor(R.q, R.nL, 0.9);
    if (rp.ok) el.textContent = t('mc.fixOk', {L: R.L});
    else if (rp.impossible) el.textContent = t('mc.fixNo', {L: R.L});
    else el.textContent = t('mc.fix', {a: isFinite(mc.o10) ? ageAt(mc.o10, p) : R.L, x: money(rp.X), now: money(p.X), L: R.L});
  }

  /* ---------- retirement ages ---------- */
  function renderAges(p, R){
    $('agNeedL').textContent = t('ages.need', {L: R.L});
    $('agPayL').textContent = t('ages.pay', {L: R.L});
    R.ages.forEach((a, i) => {
      const set = (s, v) => $('ag' + i + s).textContent = v;
      if (!a){ set('h', '–'); ['a', 'b', 'c', 'd', 'e'].forEach(s => set(s, '–')); return; }
      set('h', t('ages.at', {a: a.ra}) + (i === 1 ? t('ages.yours') : ''));
      set('a', mon(a.p, a.res.pot[a.q.H], a.q.H));
      set('b', hasRetirementGoal(p) ? monNeed(a.p, a.need, a.q.H) : '–');
      set('c', hasRetirementGoal(p) ? lastsTxt(a.res, a.q) : '–');
      set('d', !hasRetirementGoal(p) ? '–' : (a.pay === null ? t('notPossible') : money(a.pay)));
      set('e', '…');
    });
  }

  /* ---------- how much to pay in ---------- */
  function renderFix(p, R){
    const q = R.q, H = q.H, L = R.L, nL = R.nL, end = H + nL, btn = $('useBtn');
    const show = hasRetirementGoal(p);
    $('fxOpts').hidden = !show; $('fxFigWrap').hidden = !show;
    document.querySelectorAll('.potlbl').forEach(el => el.textContent = t('potAt', {a: p.retire}));
    $('fxNote').textContent = show ? t('fx.note', {each: p.raise > 0 ? t('fx.rises', {r: pct(p.raise)}) : t('fx.fixed')}) + (p.two ? t('fx.partner') : '') : '';
    if (!show){ $('fxIntro').textContent = t('fx.addSpend'); btn.hidden = true; return; }
    const goal = t('fx.goal', {L, leave: leaveTxt(p, end)});
    const fill = (k, X, qq) => {
      if (X === null){ $('o' + k + 'a').textContent = t('notPossible'); $('o' + k + 'b').textContent = '–'; $('o' + k + 'c').textContent = '–'; return; }
      const res = run(qq, {X});
      $('o' + k + 'a').textContent = money(X); $('o' + k + 'b').textContent = mon(p, res.pot[H], H); $('o' + k + 'c').textContent = lastsTxt(res, qq);
    };
    fill(0, p.X, q);
    $('o1l').textContent = t('fx.o1', {goal});
    fill(1, R.payL, q);
    $('o2l').textContent = t('fx.o2', {goal, a: pct(p.growth - 0.02), b: pct(p.growthR - 0.02), c: pct(p.growth), d: pct(p.growthR)});
    fill(2, R.payLow, R.qLow);
    fill(3, R.pNever !== null ? R.payNever : null, q);
    const req = R.payL, enough = ok(q, R.keep, nL);
    let txt;
    if (req === null) txt = t('fx.impossible', {goal});
    else if (enough) txt = req === 0 ? t((p.two && p.pX > 0) ? 'fx.partnerEnough' : 'fx.potEnough', {goal}) : t('fx.enough', {x: money(p.X), goal, req: money(req)});
    else txt = join([goneBy(R, R.keep) ? t('fx.outBefore', {x: money(p.X), A: ageText(R.keep.out, p), L})
      : t('fx.shortLeave', {x: money(p.X), left: mon(p, R.keep.pot[end], end), L}),
      t('fx.payInstead', {goal, req: money(req), more: money(req - p.X), r: p.retire})]);
    $('fxIntro').textContent = txt;
    $('fxFig').textContent = req === null ? '–' : money(req);
    $('fxCap').textContent = req === null ? '' : t(enough ? 'fx.capLeast' : 'fx.capNeed', {goal});
    btn.hidden = !(req !== null && req > 0 && req !== Math.round(p.X));
    btn.textContent = req !== null ? t('fx.use', {x: money(req)}) : '';
    btn.dataset.v = String(req || 0);
  }

  /* ---------- decision ---------- */
  function pill(id, kind, key){
    const el = $(id);
    const col = {keep: 'var(--keep-soft)', spend: 'var(--s1)', save: 'var(--coast)', debt: 'var(--s2)'}[kind];
    el.textContent = key === '–' ? '–' : t(key);
    el.className = 'pill' + (col ? '' : ' neutral');
    el.style.setProperty('--pc', col || 'transparent');
  }
  function renderDecision(p, R){
    const q = R.q, H = q.H, nL = R.nL, L = R.L, end = H + nL, x = xTotal(p), mo = money(x);
    $('dIntro').textContent = t('dec.intro', {x: mo});
    $('qB').textContent = t('q.b', {a: pct(p.growth - 0.02), c: pct(p.growth)});
    $('payLbl').innerHTML = esc(t(p.two ? 'pay.l2' : 'pay.l1')) + '<span class="hint">' + esc(t('optional')) + '</span>';
    const applies = x > 0 && R.m1 !== null, m1 = R.m1;
    const D1 = applies ? R.keep.pot[H] - R.s3Ret.pot[H] : 0;
    const keep = [['k1b', t('k1', {g: pct(p.growth)})], ['k2b', applies && m1 < H ? t('k2a', {x: mon(p, D1, H), r: p.retire}) : t('k2n')], ['k3b', t('k3')], ['k4b', t('k4')], ['k5b', t('k5')]];
    const spend = [['s1b', t('s1', {s: pct(p.s1)})], ['s2b', applies && p.raise <= 0 ? t('s2a', {x: mo, c: money(R.acc.co[m1])}) : t('s2n')], ['s3b', t('s3')], ['s4b', t('s4')], ['s5b', t('s5')]];
    const li = arr => arr.map(([b, tx]) => '<li><b>' + esc(t(b)) + '</b>' + esc(tx) + '</li>').join('');
    $('whyKeep').innerHTML = li(keep);
    $('whySpend').innerHTML = li(spend);

    const stopTxt = m1 === 0 ? t('stopping.now') : (m1 !== null ? t('stopping.at', {A: ageText(m1, p)}) : '');
    const describe = res => {
      if (goneBy(R, res)) return t('desc.out', {A: ageText(res.out, p)});
      if (R.forever) return t('desc.never');
      return p.legacy > 0 ? t('desc.leftLeg', {x: mon(p, res.pot[end], end), L, y: mon(p, p.legacy, end)}) : t('desc.left', {x: mon(p, res.pot[end], end), L});
    };
    let A = 'na';
    if (!applies){ pill('pA', null, '–'); $('aA').textContent = t(x <= 0 ? 'a.nothing' : 'a.s1never'); }
    else if (!hasRetirementGoal(p)){ pill('pA', null, 'p.addSpend'); $('aA').textContent = t('a.addSpend'); }
    else if (ok(q, R.s3Ret, nL)){ A = 'pass'; pill('pA', 'spend', 'p.spend'); $('aA').textContent = join([t('a.yes', {stop: stopTxt, pot: mon(p, R.s3Ret.pot[H], H), r: p.retire, L}), describe(R.s3Ret)]); }
    else { A = 'fail'; pill('pA', 'keep', 'p.keep'); $('aA').textContent = join([t('a.no', {stop: stopTxt, pot: mon(p, R.s3Ret.pot[H], H), r: p.retire, need: monNeed(p, R.need, H)}), describe(R.s3Ret)]); }

    let B = 'na';
    if (A !== 'pass'){ pill('pB', null, 'p.notYet'); $('aB').textContent = t('b.wait'); }
    else {
      const lowV = {a: pct(p.growth - 0.02), b: pct(p.growthR - 0.02), c: pct(p.growth), d: pct(p.growthR)};
      if (ok(R.qLow, R.lowS1, nL)){ B = 'pass'; pill('pB', 'spend', 'p.spend'); $('aB').textContent = t('b.yes', lowV); }
      else { B = 'fail'; pill('pB', 'keep', 'p.keep'); $('aB').textContent = t('b.no', Object.assign({pot: mon(p, R.lowS1.pot[H], H), r: p.retire, desc: describe(R.lowS1)}, lowV)); }
    }
    if (!applies){ pill('pC', null, '–'); $('aC').textContent = ''; }
    else if (m1 >= H){ pill('pC', null, 'p.info'); $('aC').textContent = t('c.noRet', {r: p.retire}); }
    else { pill('pC', null, 'p.info'); $('aC').textContent = t('c.cost', {x: mo, d: dur(H - m1), r: p.retire, m: mon(p, annuity(D1, q.rB, nL), H), L, lump: mon(p, D1, H)}); }
    let lvl = null;
    if (x <= 0){ pill('pD', null, '–'); $('aD').textContent = ''; }
    else if (p.pay <= 0){ pill('pD', null, 'p.addPay'); $('aD').textContent = t('d.addPay'); }
    else {
      const sh = x / p.pay, v = {x: mo, p: pct(sh)};
      if (sh >= 0.15){ lvl = 'big'; pill('pD', 'spend', 'p.spend'); $('aD').textContent = t('d.big', v); }
      else if (sh >= 0.05){ lvl = 'mid'; pill('pD', null, 'p.either'); $('aD').textContent = t('d.mid', v); }
      else { lvl = 'small'; pill('pD', 'keep', 'p.keep'); $('aD').textContent = t('d.small', v); }
    }
    const ans = ui.answers;
    const yn = (pid, aid, val, yesKind, yesPill, yesTxt, noKind, noPill, noTxt) => {
      if (val === 'yes'){ pill(pid, yesKind, yesPill); $(aid).textContent = t(yesTxt); }
      else if (val === 'no'){ pill(pid, noKind, noPill); $(aid).textContent = t(noTxt); }
      else { pill(pid, null, '–'); $(aid).textContent = ''; }
    };
    yn('pE', 'aE', ans.match, 'keep', 'p.keep', 'e.yes', null, 'p.either', 'e.no');
    yn('pF', 'aF', ans.cash, null, 'p.either', 'f.yes', 'save', 'p.save', 'f.no');
    $('qG').textContent = t('q.g', {r: pct(p.growth)});
    yn('pG', 'aG', ans.debt, 'debt', 'p.debt', 'g.yes', null, 'p.either', 'g.no');
    yn('pH', 'aH', ans.life, 'spend', 'p.spend', 'h.yes', 'keep', 'p.keep', 'h.no');
    document.querySelectorAll('.yn').forEach(g => g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(ans[g.dataset.key] === b.dataset.v))));

    let v = 'can', dc = 'var(--s1)', extra = '';
    if (!applies){ v = 'na'; dc = 'var(--muted)'; }
    else if (A === 'na'){ v = 'add'; dc = 'var(--muted)'; }
    else if (A === 'fail'){ v = 'keep'; dc = 'var(--keep-soft)'; if (ans.debt === 'yes') extra = t('v.keep.debt'); }
    else if (ans.debt === 'yes'){ v = 'debt'; dc = 'var(--s2)'; }
    else if (ans.cash === 'no'){ v = 'cash'; dc = 'var(--coast)'; }
    else if (B === 'fail'){ v = 'split'; dc = 'var(--s3)'; }
    else if (ans.match === 'yes'){ v = 'match'; dc = 'var(--s3)'; }
    else if (ans.life === 'yes' || lvl === 'big'){ v = 'spend'; dc = 'var(--s1)'; }
    else if (ans.life === 'no' && lvl === 'small'){ v = 'either'; dc = 'var(--stop)'; }
    $('dHead').textContent = t('v.' + v + '.h');
    $('dText').textContent = v === 'na' ? t(x <= 0 ? 'a.nothing' : 'v.na.s1') : (t('v.' + v + '.t', {L, x: mo}) + (extra ? (LANG === 'zh' ? '' : ' ') + extra.trim() : ''));
    $('decision').style.setProperty('--dc', dc);
  }

  function renderMethod(p, R){
    const x = xTotal(p);
    $('mInfl').textContent = (p.infl > 0 && x > 0 && p.raise <= 0) ? t('m.infl', {x: money(x), y: money(x / Math.pow(1 + p.infl, 10))}) : (p.infl === 0 ? t('m.zero') : '');
    $('mNow').textContent = x > 0 && R.acc.co[0] > 0 ? t('m.now', {g: money(R.acc.gr[0]), c: money(R.acc.co[0]), s: pct(R.share[0])}) : '';
  }


  /* ---------- adventurer symbols (see js/icons.js) ---------- */
  const ICONS = window.MMA.icons;
  const RANKS = [null,
    {r: 1, h: 1, k: 'wanderer'}, {r: 1, h: 2, k: 'smith'}, {r: 2, h: 1, k: 'pirate'}, {r: 1, h: 3, k: 'rat'}, {r: 2, h: 2, k: 'hedge'},
    {r: 3, h: 1, k: 'prince'}, {r: 1, h: 4, k: 'bard'}, {r: 2, h: 3, k: 'squire'}, {r: 3, h: 2, k: 'pilgrim'}, {r: 4, h: 1, k: 'dragon'},
    {r: 1, h: 5, k: 'lord'}, {r: 2, h: 4, k: 'ranger'}, {r: 3, h: 3, k: 'druid'}, {r: 4, h: 2, k: 'monk'}, {r: 2, h: 5, k: 'knight'},
    {r: 3, h: 4, k: 'priest'}, {r: 4, h: 3, k: 'steward'}, {r: 3, h: 5, k: 'king'}, {r: 4, h: 4, k: 'archmage'}, {r: 4, h: 5, k: 'emperor'},
    // level 21 sits above The Emperor and is never reached through the two ladders alone, see renderAdventurer()
    {r: 4, h: 5, k: 'god'}];
  const GOD = RANKS.length - 1, TOP = RANKS.length - 1;
  const rankOf = (r, h) => RANKS.findIndex(x => x && x.r === r && x.h === h);
  const TIER_BG = ['#EFE6D8', '#E3EEDC', '#D6EEDF', '#F6E6B4'], GOD_BG = '#EAE2FA';
  const tierBg = n => n === GOD ? GOD_BG : TIER_BG[Math.min(3, Math.floor((n - 1) / 5))];
  let ITEMS = [], lastQuest;
  function steps(n, total){ let h = ''; for (let i = 1; i <= total; i++) h += '<span' + (i <= n ? ' class="on"' : '') + '></span>'; return h; }
  // the money-today ladder, 1 to 5, from what's left each month and the count of Healthy / Okay / Needs attention
  const healthStep = (left, cnt) => left < 0 ? 1 : (cnt.bad >= 3 ? 2 : (cnt.bad >= 1 ? 3 : (cnt.ok > cnt.good ? 4 : 5)));
  function renderAdventurer(p, R, c){
    const q = R.q, nL = R.nL, L = R.L;
    let rl = null, hl = null;
    if (c.goal){
      if (!c.steadyOk) rl = 1;
      else if (lastChance !== null) rl = lastChance < 0.75 ? 2 : ((lastChance >= 0.99 && ok(q, R.shock, nL)) ? 4 : 3);
    }
    if (c.I !== null && c.S !== null) hl = healthStep(c.left, c.cnt);
    // no adventurer until every question is answered
    let n = (rl && hl && !c.missing.length) ? rankOf(rl, hl) : 0;
    const emperor = rankOf(4, 5);
    if (n === emperor && c.perfect && R.god && R.god.ok) n = GOD;
    $('rpgRetName').textContent = rl ? t('lr.' + rl) : '–';
    $('rpgRetSteps').innerHTML = steps(rl || 0, 4);
    $('rpgHealthName').textContent = hl ? t('lh.' + hl) : '–';
    $('rpgHealthSteps').innerHTML = steps(hl || 0, 5);
    const icon = $('rpgIcon');
    if (!n){
      icon.innerHTML = ICONS.unknown; icon.style.setProperty('--tierbg', '#F3EEE2');
      $('rpgLvl').textContent = '';
      $('rpgName').textContent = t('adv.unknown');
      lastRank = null;
      const need = [];
      if (!c.goal) need.push(t('adv.needRet'));
      if (hl === null) need.push(t('adv.needToday'));
      if (!need.length && c.missing.length){
        const row = $('rw' + c.missing[0]);
        // checklist rows name the question; money rows already say what to add
        need.push(row.querySelector('.ans') ? t('adv.needAll', {n: c.missing.length, item: row.querySelector('.q').textContent}) : row.querySelector('.a').textContent);
      }
      if (!need.length) need.push(t('adv.wait'));
      $('rpgDesc').textContent = join(need);
      $('rpgQuests').innerHTML = '';
    } else {
      const rk = RANKS[n];
      icon.innerHTML = ICONS[rk.k]; icon.style.setProperty('--tierbg', tierBg(n));
      $('rpgLvl').textContent = t('adv.level', {n, total: TOP});
      $('rpgName').textContent = t('rk.' + rk.k);
      lastRank = {n, name: t('rk.' + rk.k)};
      $('rpgDesc').textContent = t('rk.' + rk.k + '.d');
      const quests = [];
      const qOf = it => { const el = $('rw' + it.key); return el ? el.querySelector('.q').textContent : ''; };
      if (n === GOD) quests.push({label: t('quest.final'), top: true, god: true, text: t('quest.godTop')});
      else if (n === emperor){
        // the final quest: everything healthy, and a pot that never shrinks even at 5 times the spending
        const parts = [];
        if (!c.perfect){
          const it = ITEMS.find(i => i.st === 'ok' || i.st === 'bad');
          if (it) parts.push(t('quest.godH', {item: qOf(it)}));
        }
        if (!(R.god && R.god.ok)){
          const x = R.god && R.god.q ? godPay(R.god) : null;
          parts.push(x === null ? t('quest.godRImp', {k: GOD_X}) : t('quest.godR', {k: GOD_X, s: money(R.god.spend), x: money(x), now: money(p.X)}));
        }
        quests.push({label: t('quest.final'), to: RANKS[GOD], text: join(parts)});
      }
      else {
        // retirement quest
        if (rl === 4) quests.push({label: t('quest.ret'), top: true, text: t('quest.retTop')});
        else {
          const to = RANKS[rankOf(rl + 1, hl)];
          let text;
          if (rl === 1) text = R.payL === null ? t('quest.ret1.imp', {L}) : t('quest.ret1', {x: money(R.payL), now: money(p.X), L});
          else if (lastQuest === undefined) text = t('busy');
          else if (!lastQuest || lastQuest.res.impossible) text = t('quest.retImp');
          else if (lastQuest.res.ok || lastQuest.res.X <= p.X) text = t('quest.retClose');
          else text = t(rl === 2 ? 'quest.ret2' : 'quest.ret3', {x: money(lastQuest.res.X), now: money(p.X)});
          quests.push({label: t('quest.ret'), to, text});
        }
        // health quest
        if (hl === 5) quests.push({label: t('quest.health'), top: true, text: t('quest.hTop')});
        else {
          const to = RANKS[rankOf(rl, hl + 1)];
          let text;
          if (hl === 1) text = t('quest.h1', {x: money(-c.left)});
          else if (hl <= 3){ const b = ITEMS.find(i => i.st === 'bad' && i.key !== 'Left'); text = b ? t('quest.h23', {item: qOf(b)}) : t('quest.h1', {x: money(Math.max(0, -c.left))}); }
          else { const o = ITEMS.find(i => i.st === 'ok'); text = o ? t('quest.h4', {item: qOf(o)}) : ''; }
          quests.push({label: t('quest.health'), to, text});
        }
      }
      $('rpgQuests').innerHTML = quests.map(qq => '<div class="quest"><div class="qicon" style="background:' + (qq.to ? tierBg(RANKS.indexOf(qq.to)) : (qq.god ? GOD_BG : '#F6E6B4')) + '">' +
        (qq.to ? ICONS[qq.to.k] : (qq.god ? ICONS.god : ICONS.emperor)) + '</div><div><p class="qt">' + esc(qq.label) + '</p>' +
        (qq.to ? '<p class="qn">' + esc(t('quest.to', {name: t('rk.' + qq.to.k)})) + '</p>' : '') + '<p class="qa">' + esc(qq.text) + '</p></div></div>').join('');
    }
    $('rankGrid').innerHTML = RANKS.slice(1).map((rk, i) => '<button type="button" class="rk' + (i + 1 === n ? ' me' : '') + (i + 1 === GOD ? ' god' : '') + '" data-n="' + (i + 1) + '" aria-pressed="' + (i + 1 === rankSel) + '"><span class="ri" style="background:' + tierBg(i + 1) + '">' + ICONS[rk.k] +
      '</span><span class="rl">' + esc(t('adv.lv', {n: i + 1})) + '</span><span class="rn">' + esc(t('rk.' + rk.k)) + '</span>' + (i + 1 === n ? '<span class="you">' + esc(t('adv.you')) + '</span>' : '') + '</button>').join('');
    renderRankInfo();
    updateSocial();
    return {hl, n};
  }
  // tap any adventurer in the grid to read about it
  let rankSel = null;
  function renderRankInfo(){
    const box = $('rankInfo');
    if (!rankSel){ box.hidden = true; return; }
    const rk = RANKS[rankSel];
    box.hidden = false;
    box.innerHTML = '<div class="ri" style="background:' + tierBg(rankSel) + '">' + ICONS[rk.k] + '</div><div><p class="rl">' + esc(t('adv.level', {n: rankSel, total: TOP})) + '</p><p class="rpgname">' + esc(t('rk.' + rk.k)) +
      '</p><p class="rpgdesc">' + esc(t('rk.' + rk.k + '.d')) + '</p><p class="note" style="margin:6px 0 0">' +
      esc(rankSel === GOD ? t('adv.comboGod') : t('adv.combo', {r: t('lr.' + rk.r), h: t('lh.' + rk.h)})) + '</p></div>';
  }


  /* ---------- save or share the summary as an image ---------- */
  const H2C = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  let DL = null, lastRank = null;
  function loadScript(src){
    return new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = rej; document.head.appendChild(el); });
  }
  // safe: leave out every money amount, whatever the tick box says (used for sharing)
  async function buildImage(safe){
    if (!window.html2canvas) await loadScript(H2C);
    const bg = css('--bg') || '#FBF6EA';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:-12000px;top:0;width:720px;padding:24px 28px 28px;background:' + bg + ';';
    const head = document.createElement('div');
    head.innerHTML = '<div class="hero">' + document.querySelector('.hero').innerHTML + '</div><p class="note" style="margin:6px 0 0">' +
      esc(t('pdf.date', {d: new Date().toLocaleDateString(HTML_LANG[LANG] || 'en-GB', {day: 'numeric', month: 'long', year: 'numeric'})})) + '</p><p class="heads" style="margin:10px 0 0">' + esc(t('heads')) + '</p>';
    wrap.appendChild(head);
    [$('rpg'), $('scFuture').closest('section'), $('smFuture').closest('section')].forEach(el => {
      const c = el.cloneNode(true);
      c.querySelectorAll('details, button').forEach(n => n.remove());
      // keep it shareable: no amounts you'd need to level up
      c.querySelectorAll('.quest').forEach(qq => { if (qq.querySelector('.qn')){ const a = qq.querySelector('.qa'); if (a) a.remove(); } });
      c.querySelectorAll('.privrow').forEach(n => n.remove());
      if (safe || ui.hideAmts) c.querySelectorAll('.amtrow, .allranks').forEach(n => n.remove());
      c.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
      c.removeAttribute('id'); c.style.marginTop = '20px';
      wrap.appendChild(c);
    });
    document.body.appendChild(wrap);
    try {
      const cv = await window.html2canvas(wrap, {scale: 2, backgroundColor: bg, logging: false});
      return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/png'));
    } finally { wrap.remove(); }
  }
  const IMG_NAME = 'my-money-adventure.png';
  // Inside the claude.ai viewer the page can only save files through the `downloads` capability,
  // and the Web Share API is blocked by the frame. Hosted on its own (GitHub Pages, Netlify...),
  // a normal download link and navigator.share both work.
  const IN_CLAUDE = !!(window.claude && typeof window.claude.use === 'function');
  // imgCache follows the tick box (Save as image); imgSafe never shows money amounts (Share and the social buttons)
  let imgCache = null, imgSafe = null, imgTimer = null;
  // navigator.share needs a fresh tap, so the images are built ahead of time while the Summary is open.
  function scheduleImage(){
    imgCache = imgSafe = null;
    clearTimeout(imgTimer);
    if ($('pageSum').hidden) return;
    imgTimer = setTimeout(() => {
      buildImage(true).then(b => { imgSafe = b; if (ui.hideAmts) imgCache = b; else return buildImage(false).then(b2 => { imgCache = b2; }); }).catch(() => {});
    }, 1500);
  }
  async function withBusy(fn){
    const msg = $('pdfMsg'), btns = [$('imgBtn'), $('shareBtn')];
    btns.forEach(b => b.disabled = true); msg.textContent = t('img.making');
    try { await fn(); }
    catch (e){ msg.textContent = (e && (e.code === 'declined' || e.code === 'rate_limited' || e.name === 'AbortError')) ? '' : t('img.fail'); }
    finally { btns.forEach(b => b.disabled = false); }
  }
  async function saveBlob(blob){
    if (DL){ await DL.save({filename: IMG_NAME, data: blob}); return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = IMG_NAME; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function saveImage(){
    return withBusy(async () => { await saveBlob(imgCache || await buildImage(false)); $('pdfMsg').textContent = ''; });
  }
  const shareText = () => lastRank ? t('share.text', {n: lastRank.n, name: lastRank.name}) : t('title');
  const pageUrl = () => /^https?:$/.test(location.protocol) ? location.href.split('#')[0] : '';
  // Opens the phone's share menu with the money-free image, the caption and a link. Must run straight from the tap.
  // Returns true if the menu opened.
  function shareSafe(){
    if (!imgSafe || !navigator.canShare) return false;
    const file = new File([imgSafe], IMG_NAME, {type: 'image/png'}), url = pageUrl();
    if (!navigator.canShare({files: [file]})) return false;
    const data = {files: [file], title: t('title'), text: url ? shareText() + ' ' + url : shareText()};
    navigator.share(data).then(() => { $('pdfMsg').textContent = ''; })
      .catch(e => { if (!e || e.name !== 'AbortError') withBusy(async () => { await saveBlob(imgSafe); $('pdfMsg').textContent = t('share.saved'); }); });
    return true;
  }
  function shareImage(){
    if (shareSafe()) return;
    if (imgSafe) return withBusy(async () => { await saveBlob(imgSafe); $('pdfMsg').textContent = t('share.saved'); });
    return withBusy(async () => { imgSafe = await buildImage(true); $('pdfMsg').textContent = t('share.ready'); });
  }
  // Social buttons: on a phone they open the share menu with the money-free image and a link; elsewhere they save
  // that image and open the app's post window with the link and caption (no app lets a web page attach an image).
  function socialTap(e){
    const a = e.target.closest('a[data-s]'); if (!a) return;
    if (shareSafe()){ e.preventDefault(); return; }
    if (imgSafe){ saveBlob(imgSafe); $('pdfMsg').textContent = t('social.saved'); }
    else $('pdfMsg').textContent = t('social.noImg');
  }
  const SOCIAL = ['fb', 'x'];
  function updateSocial(){
    const box = $('social'), page = pageUrl();
    box.hidden = IN_CLAUDE || !page;
    if (box.hidden) return;
    const text = shareText(), e = encodeURIComponent;
    const href = {x: 'https://x.com/intent/tweet?text=' + e(text) + '&url=' + e(page), fb: 'https://www.facebook.com/sharer/sharer.php?u=' + e(page)};
    box.querySelectorAll('a[data-s]').forEach(a => { a.href = href[a.dataset.s]; a.style.order = SOCIAL.indexOf(a.dataset.s); });
  }
  function showShareBar(){
    const canShare = !!(navigator.share && navigator.canShare);
    $('imgBtn').hidden = IN_CLAUDE ? !DL : false;
    $('shareBtn').hidden = IN_CLAUDE ? true : !canShare;
    $('pdfBar').hidden = $('imgBtn').hidden && $('shareBtn').hidden;
  }

  /* ---------- summary page ---------- */
  let lastChance = null, lastMC = null, life90 = null, nextHelp = null;
  const ST_COL = {dyn: 'var(--dyn)', gold: 'var(--gold)', good: 'var(--keep-soft)', ok: 'var(--s1)', bad: 'var(--s2)'};
  // "See all levels" under each At a glance card: every level, best first, with where you are and how far from the top
  // Your future has one more level at the top: the God Emperor's money test
  const LEVELS = {fut: ['dyn', 'gold', 'good', 'ok', 'bad'], today: ['gold', 'good', 'ok', 'bad']};
  function renderLevels(id, head, desc, cur, vars){
    const LV = LEVELS[head], pos = LV.indexOf(cur);
    $(id).innerHTML = LV.map((st, i) => '<li' + (st === cur ? ' class="here"' : '') + '><span class="lvdot" style="background:' + ST_COL[st] + '"></span><div><p class="lvname">' +
      esc(t(head + '.' + st + '.h')) + (st === cur ? '<span class="lvhere">' + esc(t('lv.here')) + '</span>' : '') + '</p><p class="lvdesc">' + esc(t(desc + (LV.length - i), vars)) + '</p>' +
      // a kind word under Rock solid: from here, money isn't the thing to worry about
      (head === 'fut' && st === 'gold' ? '<p class="lvnote">' + esc(t('lv.f4.note')) + '</p>' : '') + '</div></li>').join('');
    $(id + 'Foot').textContent = pos < 0 ? '' : (pos === 0 ? t('lv.top') : t(pos === 1 ? 'lv.step1' : 'lv.steps', {n: pos}));
  }
  function stPill(id, st){
    const el = $(id);
    el.textContent = t('st.' + st);
    el.className = 'pill' + (ST_COL[st] ? '' : ' neutral');
    el.style.setProperty('--pc', ST_COL[st] || 'transparent');
  }
  function setCheck(key, st, text, show){
    if (show !== false) ITEMS.push({key, st});
    $('rw' + key).hidden = show === false;
    stPill('pt' + key, st); $('at' + key).textContent = text;
    return st;
  }
  function renderSummary(p, R){
    const raw = readRaw(), q = R.q, H = q.H, L = R.L, nL = R.nL, end = H + nL;
    const g = (k) => { const s = String(raw[k] || '').replace(/[^0-9.\-]/g, ''); if (s === '' || s === '-' || s === '.') return null; const v = parseFloat(s); return isFinite(v) ? v : null; };
    const sInc = $('sIncome');
    if (document.activeElement !== sInc) sInc.value = $('pay').value;
    $('sIncome').closest('.field').querySelector('label').innerHTML = esc(t(p.two ? 'pay.l2' : 'pay.l1')) + '<span class="hint">' + esc(t('optional')) + '</span>';
    const I = g('pay'), S = g('sSpend'), DP = g('sDebtPay') || 0, D = g('sDebt') || 0, M = g('sMortgage') || 0, rate = g('sRate') || 0, C = g('sCash') || 0;
    const X = xTotal(p);
    const today = [];
    ITEMS = [];
    // rows still waiting for an answer: the God Emperor needs every one answered and healthy
    const missing = [];
    const miss = (key, text) => { missing.push(key); setCheck(key, 'na', text); };

    // ---- future ----
    const goal = hasRetirementGoal(p), steadyOk = ok(q, R.keep, nL);
    let fs, fh, ft;
    if (!goal){ fs = 'na'; fh = t('fut.noGoal.h'); ft = t('fut.noGoal.t'); }
    else if (!steadyOk){ fs = 'bad'; fh = t('fut.bad.h'); ft = goneBy(R, R.keep) ? t('fut.bad.t', {A: ageText(R.keep.out, p), L}) : t('fut.short.t', {L}); }
    else if (lastChance !== null && lastChance < 0.75){
      // steady growth says it lasts, bumpy markets say often not: say so, with the age it runs out in a bad run
      fs = 'ok'; fh = t('fut.ok.h');
      ft = join([t('fut.ok.t', {L, c: Math.round(lastChance * 100) + '%'}), lastMC && isFinite(lastMC.o10) ? t('fut.rainy', {a: ageAt(lastMC.o10, p)}) : '']);
    }
    else if (lastChance !== null && lastChance >= 0.99 && ok(q, R.shock, nL)){
      if (R.god && R.god.ok){ fs = 'dyn'; fh = t('fut.dyn.h'); ft = t('fut.dyn.t'); }
      else { fs = 'gold'; fh = t('fut.gold.h'); ft = t('fut.gold.t', {L}); }
    }
    else { fs = 'good'; fh = t('fut.good.h'); ft = t('fut.good.t', {L}); }
    $('scFutureH').textContent = fh; $('scFutureT').textContent = ft;
    $('scFuture').style.setProperty('--sc', ST_COL[fs] || 'var(--line)');
    // each row says which kind of market it assumes, so "never runs out" and a low chance don't look like they disagree
    const rainy = !goal ? '–' : (!lastMC ? '…' : (isFinite(lastMC.o10) ? t('goneAt', {a: ageAt(lastMC.o10, p)}) : t('fl.pastL', {L})));
    const rowsF = [
      [t('fl.steady'), t('fl.aim', {L}), goal ? lastsTxt(R.keep, q) : '–'],
      [t('fl.chance'), t('fl.toAge', {L}), goal ? (lastChance === null ? '…' : Math.round(lastChance * 100) + '%') : '–'],
      [t('fl.rainy'), t('fl.rainy.s'), rainy],
      [t('potAtRet'), goal ? t('fl.needed', {n: monNeed(p, R.need, H)}) : '', mon(p, R.keep.pot[H], H), 'amtrow'],
      // what to invest is never shared; amounts can be left out of the image
      [t('fl.need'), t('fl.now', {x: money(p.X)}), !goal ? '–' : (R.payL === null ? t('notPossible') : money(R.payL)), 'privrow'],
      [t('fl.coast'), '', !goal ? '–' : (R.coast !== null ? capFirst(ageText(R.coast, p)) : t('fl.notYet'))],
      [t('fl.s1'), '', (X > 0 && R.m1 !== null) ? capFirst(ageText(R.m1, p)) : t('never')],
      R.forever ? null : [t('fl.left', {L}), '', !goal ? '–' : (goneBy(R, R.keep) ? t('goneAt', {a: ageAt(R.keep.out, p)}) : mon(p, R.keep.pot[end], end)), 'amtrow']
    ].filter(Boolean);
    $('smFuture').innerHTML = rowsF.map(([a, b, c, cls]) => '<div class="rrow' + (cls ? ' ' + cls : '') + '"><span>' + esc(a) + (b ? '<span class="kvsub">' + esc(b) + '</span>' : '') + '</span><span>' + esc(c) + '</span></div>').join('');

    // ---- today ----
    const left = (I !== null && S !== null) ? I - S - DP - X : null;
    if (left === null) miss('Left', t('m.left.na'));
    else if (left < 0) today.push(setCheck('Left', 'bad', t('m.left.bad', {x: money(-left)})));
    else if (left < 0.05 * I) today.push(setCheck('Left', 'ok', t('m.left.ok', {x: money(left)})));
    else today.push(setCheck('Left', 'good', t('m.left.good', {x: money(left)})));
    if (!I) { miss('Rate', t('m.na.pay')); miss('Debt', t('m.na.pay')); }
    else {
      const r = X / I;
      today.push(setCheck('Rate', r >= 0.15 ? 'good' : (r >= 0.10 ? 'ok' : 'bad'), t('m.rate.t', {p: pct(r)})));
      if (DP <= 0) today.push(setCheck('Debt', 'good', t('m.debt.none')));
      else { const d = DP / I; today.push(setCheck('Debt', d < 0.25 ? 'good' : (d <= 0.36 ? 'ok' : 'bad'), t('m.debt.t', {p: pct(d)}))); }
    }
    if (S === null || (S + DP) <= 0) miss('Cash', t('m.cash.na'));
    else { const n = C / (S + DP); today.push(setCheck('Cash', n >= 6 ? 'good' : (n >= 3 ? 'ok' : 'bad'), t('m.cash.t', {n: Math.round(n * 10) / 10}))); }
    const O = Math.max(0, D - M);
    if (O <= 0){ today.push(setCheck('Other', 'good', t('m.exp.none'))); setCheck('Exp', 'na', '', false); }
    else {
      if (!I) miss('Other', t('m.na.pay'));
      else { const n = O / I; today.push(setCheck('Other', n <= 3 ? 'good' : (n <= 12 ? 'ok' : 'bad'), t('m.other.t', {x: money(O), n: Math.round(n * 10) / 10}))); }
      today.push(setCheck('Exp', rate / 100 > p.growth ? 'bad' : 'good', t(rate / 100 > p.growth ? 'm.exp.bad' : 'm.exp.good', {r: pct(rate / 100), g: pct(p.growth)})));
    }

    // ---- today vs tomorrow ----
    if (!goal) miss('Fit', t('fut.noGoal.t'));
    else if (R.payL === null) today.push(setCheck('Fit', 'bad', t('l.fit.imp')));
    else if (steadyOk) today.push(setCheck('Fit', 'good', left !== null && left > 0 ? t('l.fit.onSpare', {l: money(left)}) : t('l.fit.on')));
    else if (left === null) miss('Fit', t('l.fit.na'));
    else { const e = R.payL - p.X; today.push(setCheck('Fit', left >= e ? 'good' : 'bad', t(left >= e ? 'l.fit.yes' : 'l.fit.no', {e: money(e), l: money(Math.max(0, left))}))); }
    const house = raw.sHouse || '';
    if (!(p.spend > 0) || S === null || S <= 0) miss('Sp', t('l.sp.na'));
    else {
      const ratio = p.spend / S, v = {a: money(p.spend), b: money(S)};
      const st = ratio < 0.7 ? 'ok' : 'good';
      today.push(setCheck('Sp', st, join([t(ratio < 0.7 ? 'l.sp.low' : (ratio > 1.1 ? 'l.sp.high' : 'l.sp.good'), v), house === 'rent' ? t('l.sp.rent') : ''])));
    }

    // ---- life checklist ----
    const SEL = {House: 'sHouse', Car: 'sCar', Deps: 'sDeps', Kids: 'sKids', School: 'sSchool', KidCost: 'sKidCost', Big: 'sBig', BigPay: 'sBigPay', Will: 'sWill', Health: 'sHealth', Life: 'sLife', HomeIns: 'sHomeIns', CarIns: 'sCarIns', Income: 'sIncomeIns', Critical: 'sCritical', Accident: 'sAccident'};
    const ck = (key, val, map, txt) => {
      const el = $(SEL[key]), opt = el && el.selectedIndex > 0 ? el.options[el.selectedIndex] : null;
      $('av' + key).textContent = opt ? opt.textContent : '';
      if (!val || !map[val]){ miss(key, t('ck.na')); return; }
      today.push(setCheck(key, map[val], t(txt ? txt(val) : 'ck.' + key.charAt(0).toLowerCase() + key.slice(1) + '.' + val + '.t')));
    };
    const car = raw.sCar || '';
    ck('House', house, {own: 'good', mortgage: 'ok', rent: 'ok', family: 'ok'});
    ck('Car', car, {own: 'good', loan: 'ok', family: 'ok', plan: 'ok', none: 'good'});
    ck('Deps', raw.sDeps || '', {yes: 'na', no: 'good'});
    const kids = raw.sKids || '', hasKids = kids === 'yes' || kids === 'plan';
    ck('Kids', kids, {yes: 'na', plan: 'na', no: 'na'});
    if (kids) $('ptKids').textContent = t('p.info');
    $('rwSchool').hidden = $('fdSchool').hidden = $('rwKidCost').hidden = $('fdKidCost').hidden = !hasKids;
    if (hasKids){
      ck('School', raw.sSchool || '', {no: 'good', maybe: 'ok', yes: 'bad'});
      ck('KidCost', raw.sKidCost || '', {yes: 'good', invest: 'ok', life: 'ok', no: 'bad'});
    }
    if (raw.sDeps === 'yes'){ $('ptDeps').textContent = t('p.info'); }
    const big = raw.sBig || '';
    ck('Big', big, {yes: 'na', no: 'good'});
    if (big === 'yes') $('ptBig').textContent = t('p.info');
    $('rwBigPay').hidden = $('fdBigPay').hidden = big !== 'yes';
    if (big === 'yes') ck('BigPay', raw.sBigPay || '', {saved: 'good', part: 'ok', loan: 'bad'});
    ck('Will', raw.sWill || '', {yes: 'good', no: 'ok'});
    // ---- insurance ----
    ck('Health', raw.sHealth || '', {yes: 'good', public: 'ok', no: 'bad'});
    $('rwLife').hidden = $('fdLife').hidden = raw.sDeps !== 'yes';
    if (raw.sDeps === 'yes') ck('Life', raw.sLife || '', {yes: 'good', no: 'bad'});
    const owns = house === 'own' || house === 'mortgage';
    $('rwHomeIns').hidden = $('fdHomeIns').hidden = !(owns || house === 'rent');
    if (owns) ck('HomeIns', raw.sHomeIns || '', {yes: 'good', contents: 'ok', no: 'bad'},
      v => v === 'yes' ? 'ck.homeIns.yes.t' : (v === 'contents' ? 'ck.homeIns.contentsOwn.t' : 'ck.homeIns.noOwn.t'));
    else if (house === 'rent') ck('HomeIns', raw.sHomeIns || '', {yes: 'good', contents: 'good', no: 'ok'},
      v => v === 'no' ? 'ck.homeIns.noRent.t' : 'ck.homeIns.rent.t');
    $('rwCarIns').hidden = $('fdCarIns').hidden = !(car === 'own' || car === 'loan');
    if (car === 'own' || car === 'loan') ck('CarIns', raw.sCarIns || '', {yes: 'good', no: 'bad'});
    ck('Income', raw.sIncomeIns || '', {yes: 'good', work: 'good', no: 'ok'}, v => v === 'no' ? 'ck.income.no.t' : 'ck.income.yes.t');
    ck('Critical', raw.sCritical || '', {yes: 'good', no: 'ok'});
    ck('Accident', raw.sAccident || '', {yes: 'good', no: 'ok'});
    // a follow-up question waits, greyed out, until the question it follows is answered
    [['fdSchool', 'sKids'], ['fdKidCost', 'sKids'], ['fdBigPay', 'sBig'], ['fdLife', 'sDeps'], ['fdHomeIns', 'sHouse'], ['fdCarIns', 'sCar']].forEach(([fd, parent]) => {
      const f = $(fd), locked = !raw[parent];
      let hint = f.querySelector('.lock');
      if (!hint){ hint = document.createElement('p'); hint.className = 'lock'; f.appendChild(hint); }
      hint.textContent = locked ? t('ck.lock', {q: $(parent).closest('.field').querySelector('label').textContent}) : '';
      f.classList.toggle('locked', locked);
      f.querySelector('select').disabled = locked;
      if (locked) f.hidden = false;
      // answered in a way that doesn't need the follow-up: forget its old answer so it doesn't come back later
      else if (f.hidden) f.querySelector('select').value = '';
    });

    // ---- overall ----
    const cnt = {good: 0, ok: 0, bad: 0};
    today.forEach(s => { if (cnt[s] !== undefined) cnt[s]++; });
    const total = cnt.good + cnt.ok + cnt.bad;
    let th, ts = 'na';
    if (!total || I === null || S === null){ th = t('today.na.h'); $('scTodayT').textContent = t('today.na.t'); }
    else {
      ts = cnt.bad > 0 ? 'bad' : (cnt.ok > cnt.good ? 'ok' : (cnt.ok === 0 && !missing.length ? 'gold' : 'good'));
      th = t('today.' + ts + '.h');
      $('scTodayT').textContent = t('today.t', {g: cnt.good, o: cnt.ok, b: cnt.bad});
    }
    $('scTodayH').textContent = th;
    renderLevels('lvFuture', 'fut', 'lv.f', fs, {f: pct(p.fall)});
    renderLevels('lvToday', 'today', 'lv.t', ts);
    $('scToday').style.setProperty('--sc', ST_COL[ts] || 'var(--line)');
    $('smCounts').innerHTML = (total && I !== null && S !== null) ? ['good', 'ok', 'bad'].map(k => '<span style="background:' + ST_COL[k] + '">' + esc(t('cnt.' + k, {n: cnt[k]})) + '</span>').join('') : '';
    $('hideAmts').checked = ui.hideAmts;
    const perfect = cnt.good > 0 && cnt.ok === 0 && cnt.bad === 0;
    const adv = renderAdventurer(p, R, {goal, steadyOk, I, S, left, cnt, missing, perfect});
    // A very long live-to age (over 100, or forever) is a much harder test and drags the level down.
    // Once the market test has also been run to 90 (life90), name the level and rank the same plan gets at 90,
    // but only when that's actually better, so the note never promises what the slider won't show.
    let lifeNote = '';
    const LV = LEVELS.fut;
    if (life90){
      // "Can you afford what the plan needs?" also depends on the live-to age, so redo that one check at 90
      const cnt90 = Object.assign({}, cnt), fitNow = ITEMS.find(i => i.key === 'Fit');
      if (fitNow && cnt90[fitNow.st] !== undefined) cnt90[fitNow.st]--;
      const fit90 = life90.payL === null ? 'bad' : (life90.steady ? 'good' : (left === null ? 'na' : (left >= life90.payL - p.X ? 'good' : 'bad')));
      if (cnt90[fit90] !== undefined) cnt90[fit90]++;
      const hl90 = (I !== null && S !== null) ? healthStep(left, cnt90) : null;
      let n90 = (hl90 && !missing.length) ? rankOf(life90.rl, hl90) : 0;
      if (n90 === rankOf(4, 5) && cnt90.good > 0 && cnt90.ok === 0 && cnt90.bad === 0 && R.god && R.god.ok) n90 = GOD;
      if (LV.indexOf(life90.fs) < LV.indexOf(fs) || n90 > adv.n)
        lifeNote = join([t('life.note', {L, lvl: t('fut.' + life90.fs + '.h')}), n90 ? t('life.rank', {n: n90, name: t('rk.' + RANKS[n90].k)}) : '', t('life.try')]);
    }
    $('lifeNote').textContent = lifeNote; $('rpgLifeNote').textContent = lifeNote;
    // the next step up, worked out in the background, and a kind word for anyone below On track
    let next = '';
    if (nextHelp && (nextHelp.age || nextHelp.spend)){
      const v = {lvl: t('fut.' + nextHelp.target + '.h'), a: nextHelp.age, y: money(nextHelp.spend || 0)};
      next = t(nextHelp.age && nextHelp.spend ? 'nx.both' : (nextHelp.age ? 'nx.age' : 'nx.spend'), v);
    }
    $('nextNote').textContent = next;
    $('cheerNote').textContent = goal && (fs === 'bad' || fs === 'ok') ? t('cheer.t', {d: dur(p.years * 12)}) : '';
  }
  const applyTab = () => {
    $('pageCalc').hidden = ui.tab !== 'calc'; $('pageSum').hidden = ui.tab !== 'sum';
    $('tabCalc').setAttribute('aria-selected', String(ui.tab === 'calc')); $('tabSum').setAttribute('aria-selected', String(ui.tab === 'sum'));
  };
  function showTab(tab){
    ui.tab = tab; applyTab(); saveAll(); scheduleImage();
    if (tab === 'calc') [potChart, shareChart, retChart, mcChart].forEach(c => c && c.resize());
    const top = $('tabCalc').getBoundingClientRect().top + window.scrollY - 12;
    if (window.scrollY > top) window.scrollTo({top, behavior: 'smooth'});
  }

  /* ---------- plans ---------- */
  function loadPlans(){ try { return JSON.parse(localStorage.getItem(PLANS) || '{}') || {}; } catch(e){ return {}; } }
  function savePlan(k){
    const plans = loadPlans();
    plans[k] = Object.assign(readRaw(), {__live: ui.live});
    try { localStorage.setItem(PLANS, JSON.stringify(plans)); } catch(e){}
    render();
  }
  function planSummary(raw, withMC){
    const p = parse(raw);
    const L = clamp(Math.round(raw.__live || 90), p.retire + 1, FOREVER);
    const R = compute(p, p.years, L), q = R.q, H = q.H, goal = hasRetirementGoal(p);
    // the plan's own live-to age picks the wording, then the page's goes back
    const was = inForever; inForever = R.forever;
    try { return {
      a: money(xTotal(p)), b: String(p.retire), c: goal ? money(p.spend) : t('none'),
      d: mon(p, R.keep.pot[H], H), e: goal ? lastsTxt(R.keep, q) : '–',
      f: withMC ? t('pl.chance', {p: Math.round(monteCarlo(q, R.nL, 300, false).chance * 100) + '%', L}) : '…',
      g: !goal ? '–' : (() => { const v = payToLast(q, R.nL); return v === null ? t('notPossible') : money(v); })(),
      h: (xTotal(p) > 0 && R.m1 !== null) ? capFirst(ageText(R.m1, p)) : t('never')
    }; } finally { inForever = was; }
  }
  function renderPlans(withMC){
    const plans = loadPlans();
    const cols = [plans.A, plans.B, Object.assign(readRaw(), {__live: ui.live})];
    cols.forEach((raw, i) => {
      const s = raw ? planSummary(raw, withMC) : null;
      'abcdefgh'.split('').forEach(k => $('pl' + i + k).textContent = s ? s[k] : '–');
    });
    $('loadA').disabled = !plans.A; $('loadB').disabled = !plans.B;
  }
  function loadPlan(k){
    const plans = loadPlans(); if (!plans[k]) return;
    writeRaw(plans[k]);
    if (typeof plans[k].__live === 'number') ui.live = plans[k].__live;
    ui.touched = false;
    render();
    window.scrollTo({top: 0, behavior: 'smooth'});
  }
  /* ---------- charts ---------- */
  let potChart = null, shareChart = null, retChart = null, mcChart = null;
  function css(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function colours(){
    return {bg: css('--bg'), ink: css('--ink'), muted: css('--muted'), grid: css('--grid'), line: css('--line'), surface: css('--surface'),
      keep: css('--keep'), keepFill: css('--keep-fill'), stop: css('--stop-ink'), s1: css('--s1-ink'), s2: css('--s2-ink'), s3: css('--s3-ink'), coast: css('--coast-ink')};
  }
  function roundRect(ctx, x, y, w, h, rad){
    ctx.beginPath(); ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
  }
  const markerPlugin = {
    id: 'markers',
    afterDatasetsDraw(chart){
      const mk = chart.$mk; if (!mk) return;
      const {ctx, chartArea: a, scales: {x, y}} = chart;
      ctx.save();
      (mk.hlines || []).forEach(h => {
        if (h.y < y.min || h.y > y.max) return;
        const py = Math.round(y.getPixelForValue(h.y)) + 0.5;
        ctx.strokeStyle = h.color; ctx.lineWidth = 1.25; ctx.setLineDash(h.dash || [5, 4]);
        ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
        if (h.label){
          ctx.setLineDash([]);
          ctx.font = '500 11px ' + FONT;
          const tw = ctx.measureText(h.label).width;
          ctx.fillStyle = mk.labelBg; ctx.fillRect(a.left + 2, py - 17, tw + 8, 15);
          ctx.fillStyle = h.color; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
          ctx.fillText(h.label, a.left + 6, py - 3);
        }
      });
      let lastPx = -1e9, lane = 0;
      (mk.vlines || []).slice().sort((p, q) => p.x - q.x).forEach(v => {
        if (v.x < x.min || v.x > x.max) return;
        const px = Math.round(x.getPixelForValue(v.x)) + 0.5;
        lane = (px - lastPx < 46) ? lane + 1 : 0; lastPx = px;
        ctx.font = '600 11px ' + FONT;
        const w = ctx.measureText(v.label).width + 14, hgt = 18;
        const tx = Math.min(Math.max(px - w / 2, a.left), a.right - w);
        const ty = a.top + lane * (hgt + 4);
        ctx.strokeStyle = v.color; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(px, ty + hgt); ctx.lineTo(px, a.bottom); ctx.stroke();
        ctx.setLineDash([]);
        roundRect(ctx, tx, ty, w, hgt, 9); ctx.fillStyle = v.color; ctx.fill();
        ctx.fillStyle = mk.tagText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(v.label, tx + w / 2, ty + hgt / 2 + 0.5);
      });
      ctx.restore();
    }
  };
  let state = null;
  const ageTitle = x => { const yr = Math.round(x); return t((state && yr === state.p.age) ? 'ch.today' : 'ch.ageN', {a: yr}); };
  function buildCharts(){
    [potChart, shareChart, retChart, mcChart].forEach(c => c && c.destroy());
    const C = colours();
    Chart.defaults.font.family = FONT; Chart.defaults.font.size = 12; Chart.defaults.color = C.muted;
    const tip = {backgroundColor: C.ink, titleColor: C.surface, bodyColor: C.surface, borderWidth: 0, padding: 10, cornerRadius: 8, displayColors: false, titleFont: {weight: '600'}};
    const xScale = () => ({type: 'linear', grid: {display: false}, border: {color: C.line}, ticks: {color: C.muted, precision: 0, maxTicksLimit: 8}, title: {display: true, text: t('ch.age'), color: C.muted}});
    const moneyY = () => ({beginAtZero: true, grace: '16%', grid: {color: C.grid}, border: {display: false}, ticks: {color: C.muted, maxTicksLimit: 6, callback: v => compact(v)}});
    const line = (label, color, dash, w) => ({label, data: [], borderColor: color, borderWidth: w || 2.5, borderDash: dash || [], pointRadius: 0, pointHoverRadius: 4,
      pointHoverBackgroundColor: color, pointHitRadius: 8, tension: 0.2, spanGaps: false});
    const base = () => ({responsive: true, maintainAspectRatio: false, animation: false, interaction: {mode: 'index', intersect: false}, layout: {padding: {top: 2, right: 4}}});
    const stopName = () => state && state.R.N === 0 ? t('stopNow') : t('stopAt', {a: state ? state.p.age + state.R.N : ''});

    potChart = new Chart($('potChart'), {type: 'line', data: {datasets: [line('Keep paying in', C.keep), line('Stopped', C.stop, [6, 5], 2)]},
      options: Object.assign(base(), {scales: {x: xScale(), y: moneyY()}, plugins: {legend: {display: false}, tooltip: Object.assign({}, tip, {
        filter: it => it.raw && it.raw.y != null && !(it.datasetIndex === 1 && state && it.raw.x <= state.p.age + state.R.N),
        callbacks: {title: items => items.length ? ageTitle(items[0].raw.x) : '', label: it => (it.datasetIndex === 0 ? t('keepPaying') : stopName()) + t('colon') + money(it.raw.y)}})}}),
      plugins: [markerPlugin]});
    const shareDs = line('Your share', C.keep); shareDs.fill = 'origin'; shareDs.backgroundColor = C.keepFill;
    shareChart = new Chart($('shareChart'), {type: 'line', data: {datasets: [shareDs]},
      options: Object.assign(base(), {scales: {x: xScale(), y: {min: 0, max: 100, grid: {color: C.grid}, border: {display: false}, ticks: {color: C.muted, stepSize: 25, callback: v => v + '%'}}},
        plugins: {legend: {display: false}, tooltip: Object.assign({}, tip, {callbacks: {title: items => items.length ? ageTitle(items[0].raw.x) : '', label: it => t('ch.share') + t('colon') + pct(it.raw.y / 100)}})}}),
      plugins: [markerPlugin]});
    retChart = new Chart($('retChart'), {type: 'line', data: {datasets: [line('Keep paying in', C.keep), line('Stopped', C.stop, [6, 5], 2)]},
      options: Object.assign(base(), {scales: {x: xScale(), y: moneyY()}, plugins: {legend: {display: false}, tooltip: Object.assign({}, tip, {
        callbacks: {title: items => items.length ? ageTitle(items[0].raw.x) : '', label: it => (it.datasetIndex === 0 ? t('keepPaying') : stopName()) + t('colon') + money(it.raw.y)}})}}),
      plugins: [markerPlugin]});
    const top = line('Good run', 'transparent', [], 0), bottom = line('Poor run', 'transparent', [], 0);
    bottom.fill = '-1'; bottom.backgroundColor = C.keepFill;
    mcChart = new Chart($('mcChart'), {type: 'line', data: {datasets: [top, bottom, line('Typical run', C.keep), line('Steady growth', C.stop, [6, 5], 2)]},
      options: Object.assign(base(), {scales: {x: xScale(), y: moneyY()}, plugins: {legend: {display: false}, tooltip: Object.assign({}, tip, {
        callbacks: {title: items => items.length ? ageTitle(items[0].raw.x) : '', label: it => t(['ch.good', 'ch.poor', 'run.typ', 'steady'][it.datasetIndex]) + t('colon') + money(it.raw.y)}})}}),
      plugins: [markerPlugin]});
    potChart.$colours = C;
  }
  function updateCharts(p, R){
    const q = R.q, C = potChart.$colours, H = q.H, N = R.N, end = H + R.nL;
    const keep = [], stop = [], share = [];
    for (let y = 0; y <= p.years; y++){
      const m = y * 12, a = p.age + y;
      keep.push({x: a, y: dsp(p, R.keep.pot[m], m)});
      stop.push({x: a, y: y < N ? null : dsp(p, R.stopRes.pot[m], m)});
      share.push({x: a, y: R.share[m] * 100});
    }
    potChart.data.datasets[0].data = keep;
    potChart.data.datasets[1].data = N >= p.years ? [] : stop;
    potChart.options.scales.x.min = p.age; potChart.options.scales.x.max = p.retire;
    const needD = dsp(p, R.need, H), showNeed = hasRetirementGoal(p) && isFinite(needD);
    potChart.options.scales.y.suggestedMax = showNeed ? needD : undefined;
    const at = m => p.age + m / 12, v = [];
    if (xTotal(p) > 0){
      if (R.m1 !== null && R.m1 <= H) v.push({x: at(R.m1), label: '1', color: C.s1});
      if (R.m2 !== null && R.m2 <= H) v.push({x: at(R.m2), label: '2', color: C.s2});
      if (R.m3 !== null && R.m3 <= H && R.m3 !== R.m1) v.push({x: at(R.m3), label: '3', color: C.s3});
    }
    if (hasRetirementGoal(p) && R.coast !== null) v.push({x: at(R.coast), label: t('coast.tag'), color: C.coast});
    potChart.$mk = {tagText: C.surface, labelBg: C.bg, vlines: v,
      hlines: showNeed ? [{y: needD, color: C.coast, label: t('ch.needed', {r: p.retire, L: R.L}), dash: [2, 4]}] : []};
    potChart.update('none');

    shareChart.data.datasets[0].data = share;
    shareChart.options.scales.x.min = p.age; shareChart.options.scales.x.max = p.retire;
    shareChart.$mk = {tagText: C.surface, labelBg: C.bg, vlines: [], hlines: [
      {y: 50, color: C.muted, label: t('ch.overtake'), dash: [2, 4]},
      {y: p.s1 * 100, color: C.s1, label: t('ch.sc', {n: 1, p: pct(p.s1)})},
      {y: p.s2 * 100, color: C.s2, label: t('ch.sc', {n: 2, p: pct(p.s2)})}]};
    shareChart.update('none');

    const rk = [], rs = [];
    for (let y = 0; y <= R.chartL - p.retire; y++){ const m = H + y * 12; rk.push({x: p.retire + y, y: dsp(p, R.keep.pot[m], m)}); rs.push({x: p.retire + y, y: dsp(p, R.stopRes.pot[m], m)}); }
    retChart.data.datasets[0].data = rk;
    retChart.data.datasets[1].data = N >= p.years ? [] : rs;
    retChart.options.scales.x.min = p.retire; retChart.options.scales.x.max = R.chartL;
    const rv = [];
    if (R.keep.out !== null && (R.forever || R.keep.out <= end)) rv.push({x: at(R.keep.out), label: t('ch.runsOut'), color: C.keep});
    if (N < p.years && R.stopRes.out !== null && (R.forever || R.stopRes.out <= end)) rv.push({x: at(R.stopRes.out), label: t('ch.runsOut'), color: C.stop});
    p.incomes.forEach(ic => { const sm = incStartMonth(ic, p); if (sm > H && sm < end) rv.push({x: at(sm), label: (ic.name || t('otherIncome')).slice(0, 12), color: C.coast}); });
    retChart.$mk = {tagText: C.surface, labelBg: C.bg, vlines: rv,
      hlines: p.legacy > 0 && !R.forever ? [{y: dsp(p, p.legacy, end), color: C.coast, label: t('ch.toLeave'), dash: [2, 4]}] : []};
    retChart.update('none');
  }

  /* ---------- main render ---------- */
  let asyncTimer = null;
  function render(){
    const raw = readRaw(), p = parse(raw);
    unitCash = ui.unit === 'cash';
    $('partner').hidden = !p.two;
    document.querySelectorAll('.whose').forEach(el => el.hidden = !p.two);
    const n = extrasCount(p);
    $('exCount').textContent = n ? t('ex.count', {n}) : '';
    $('unitSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === ui.unit)));
    const msgs = [];
    if (p.badRetire) msgs.push(t('msg.retire'));
    if (p.badPartner) msgs.push(t('msg.partner'));
    if (p.s2 >= p.s1) msgs.push(t('msg.lines'));
    if (p.yld > p.growthR) msgs.push(t('msg.yield'));
    $('msg').textContent = join(msgs);

    const maxL = FOREVER;
    ui.live = clamp(Math.round(ui.live), p.retire + 1, maxL);
    const L = ui.live;
    inForever = L > MAX_AGE;
    const R = compute(p, p.years, L);
    let N;
    if (!ui.touched) N = (xTotal(p) > 0 && R.m1 !== null && R.m1 <= R.q.H) ? Math.round(R.m1 / 12) : Math.round(p.years / 2);
    else N = clamp(Math.round(ui.stopAge - p.age), 0, p.years);
    R.N = N; R.stopRes = run(R.q, {stop: N * 12});
    computeMore(p, R);
    state = {p, R};

    const sl = $('stop'); sl.min = p.age; sl.max = p.retire; sl.value = p.age + N;
    const lv = $('live'); lv.min = p.retire + 1; lv.max = maxL; lv.value = L;

    renderScen(p, R); renderStop(p, R); renderRetirement(p, R); renderBadStart(p, R);
    renderAges(p, R); renderFix(p, R); renderDecision(p, R); renderMethod(p, R);
    renderPlans(false);
    $('unitExplain').textContent = t(unitCash ? 'u.explain.cash' : 'u.explain.real');
    renderSummary(p, R);
    if (potChart) updateCharts(p, R);
    $('mcBusy').textContent = t('busy');
    $('mcFix').textContent = '';
    lastQuest = undefined;
    life90 = null; nextHelp = null;
    clearTimeout(asyncTimer);
    asyncTimer = setTimeout(() => {
      const mcRes = monteCarlo(R.q, R.nL, 1000, true);
      renderMC(p, R, mcRes);
      lastChance = hasRetirementGoal(p) ? mcRes.chance : null;
      lastMC = hasRetirementGoal(p) ? mcRes : null;
      if (hasRetirementGoal(p)){
        const fsNow = !ok(R.q, R.keep, R.nL) ? 'bad' : (mcRes.chance < 0.75 ? 'ok' : (!(mcRes.chance >= 0.99 && ok(R.q, R.shock, R.nL)) ? 'good' : (R.god && R.god.ok ? 'dyn' : 'gold')));
        nextHelp = nextStep(p, R.L, fsNow);
      }
      // the same plan, judged at 90: for the note that explains a level dragged down by a very long live-to age
      if (hasRetirementGoal(p) && R.L > 100 && p.retire < 90){
        const R90 = compute(p, p.years, 90), c90 = monteCarlo(R90.q, R90.nL, 1000, false).chance;
        const steady90 = ok(R90.q, R90.keep, R90.nL), top90 = c90 >= 0.99 && ok(R90.q, R90.shock, R90.nL);
        life90 = {steady: steady90, payL: payToLast(R90.q, R90.nL), rl: !steady90 ? 1 : (c90 < 0.75 ? 2 : (top90 ? 4 : 3)),
          fs: !steady90 ? 'bad' : (c90 < 0.75 ? 'ok' : (top90 ? (R.god && R.god.ok ? 'dyn' : 'gold') : 'good'))};
      }
      renderSummary(p, R);
      R.ages.forEach((a, i) => { if (a) $('ag' + i + 'e').textContent = hasRetirementGoal(p) ? Math.round(monteCarlo(a.q, a.nL, 300, false).chance * 100) + '%' : '–'; });
      renderPlans(true);
      setTimeout(() => {
        renderRainyFix(p, R, mcRes);
        lastQuest = null;
        if (hasRetirementGoal(p) && ok(R.q, R.keep, R.nL)){
          const thr = mcRes.chance < 0.75 ? 0.75 : ((mcRes.chance < 0.99 || !ok(R.q, R.shock, R.nL)) ? 0.99 : null);
          if (thr) lastQuest = {thr, res: payFor(R.q, R.nL, thr)};
        }
        renderSummary(p, R);
        scheduleImage();
      }, 0);
    }, 180);
    saveAll();
    scheduleImage();
  }

  /* ---------- wiring ---------- */
  buildExtras();
  DEFAULTS = defaults();
  loadAll();
  LANG = ui.lang;
  applyStatic();
  const applyLook = () => {
    document.documentElement.dataset.look = ui.look;
    $('lookSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === ui.look)));
  };
  applyLook();
  applyTab();
  if (window.Chart){ try { buildCharts(); } catch(e){ potChart = shareChart = retChart = mcChart = null; } }
  if (!potChart) document.querySelectorAll('.chart').forEach(el => { el.hidden = true; });
  document.addEventListener('input', e => { if (e.target.matches('[data-save]')) render(); });
  document.addEventListener('change', e => { if (e.target.matches('select[data-save], input[type=checkbox][data-save]')) render(); });
  document.addEventListener('focusout', e => {
    const el = e.target;
    if (!el.matches || !el.matches('[data-money]')) return;
    const s = String(el.value).replace(/[^0-9.]/g, '');
    if (s === ''){ if (el.value !== ''){ el.value = ''; render(); } return; }
    const v = parseFloat(s);
    if (isFinite(v)){ const f = Math.round(v).toLocaleString('en-GB'); if (el.dataset.mirror) $(el.dataset.mirror).value = f; if (f !== el.value){ el.value = f; render(); } }
  });
  $('stop').addEventListener('input', () => { ui.touched = true; ui.stopAge = +$('stop').value; render(); });
  $('live').addEventListener('input', () => { ui.live = +$('live').value; render(); });
  $('langSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !I18N[b.dataset.v]) return;
    ui.lang = LANG = b.dataset.v; applyStatic();
    if (window.Chart && potChart) buildCharts();
    render();
  });
  $('tabCalc').addEventListener('click', () => showTab('calc'));
  $('tabSum').addEventListener('click', () => showTab('sum'));
  $('goCalc').addEventListener('click', () => showTab('calc'));
  $('imgBtn').addEventListener('click', saveImage);
  $('extras').addEventListener('click', e => {
    const a = e.target.closest('[data-add]'), r = e.target.closest('[data-rm]');
    if (a) addRow(a.dataset.add); else if (r) removeRow(r.dataset.rm, +r.dataset.i);
  });
  $('hideAmts').addEventListener('change', () => { ui.hideAmts = $('hideAmts').checked; saveAll(); scheduleImage(); });
  $('rankGrid').addEventListener('click', e => {
    const b = e.target.closest('button[data-n]'); if (!b) return;
    const k = +b.dataset.n; rankSel = rankSel === k ? null : k;
    $('rankGrid').querySelectorAll('button[data-n]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.n === rankSel)));
    renderRankInfo();
  });
  $('shareBtn').addEventListener('click', shareImage);
  $('social').addEventListener('click', socialTap);
  showShareBar();
  if (window.claude && typeof window.claude.use === 'function'){
    window.claude.use('downloads').then(d => { DL = d; showShareBar(); }).catch(() => {});
  }
  $('goCalc2').addEventListener('click', () => showTab('calc'));
  $('goSum').addEventListener('click', () => showTab('sum'));
  $('sIncome').addEventListener('input', () => { $('pay').value = $('sIncome').value; render(); });
  $('lookSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    ui.look = b.dataset.v === 'night' ? 'night' : 'cream'; applyLook();
    if (window.Chart && potChart) buildCharts();
    render();
  });
  $('unitSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; ui.unit = b.dataset.v; ui.unitSet = true; render(); });
  document.querySelectorAll('.yn').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = g.dataset.key; ui.answers[k] = ui.answers[k] === b.dataset.v ? null : b.dataset.v; render();
  }));
  $('useBtn').addEventListener('click', () => { const v = +$('useBtn').dataset.v; if (v > 0){ $('monthly').value = v.toLocaleString('en-GB'); render(); } });
  $('saveA').addEventListener('click', () => savePlan('A'));
  $('saveB').addEventListener('click', () => savePlan('B'));
  $('loadA').addEventListener('click', () => loadPlan('A'));
  $('loadB').addEventListener('click', () => loadPlan('B'));
  $('reset').addEventListener('click', () => {
    writeRaw(null); ui.touched = false; ui.live = 90; ui.answers = {match: null, cash: null, debt: null, life: null}; render();
  });
  const rebuild = () => { if (window.Chart && potChart){ buildCharts(); render(); } };
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  if (mq && mq.addEventListener) mq.addEventListener('change', rebuild);
  new MutationObserver(rebuild).observe(document.documentElement, {attributes: true, attributeFilter: ['data-look']});
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { [potChart, shareChart, retChart, mcChart].forEach(c => c && c.update('none')); });
  render();
})();
