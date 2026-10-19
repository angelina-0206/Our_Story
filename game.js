/* =====================================================
   Geli & Cheesecake: The Dating Game
   -----------------------------------------------------
   HOW THIS FILE IS ORGANIZED
   1. Helpers (dialogue, choices, progress bar, etc.)
   2. Characters (drawn with code, so no image files needed)
   3. Backgrounds (also drawn with code)
   4. Scenes: title, bbq, lab, stairs, tbc
   Each scene is a little script: say something, ask a
   question, react to the answer. To add a new chapter,
   copy a scene and change the lines!
   ===================================================== */
(() => {
'use strict';

/* ---------- 1. HELPERS ---------- */
const $ = (s) => document.querySelector(s);
const stage = $('#stage'), dlg = $('#dialogue'), overlay = $('#overlay');
const hud = $('#hud'), fadeEl = $('#fade');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let token = 0;            // changes every time a scene (re)starts, so old scripts stop
let progress = 0;         // the pink bar, 0 to 100
let currentScene = '';
const checkpoints = {};   // progress when each scene was first entered (used by "Try again")
const actors = {};
const scenes = {};
class Cancel extends Error {}
let answers = [], replayQ = [], replaying = false;   // used by 'Try again' to skip straight to the choice
const endReplay = () => { replaying = false; $('#game').classList.remove('replay'); };

const wait = (ms) => {
  const t = token;
  if (replaying) return Promise.resolve();
  return new Promise((res, rej) => setTimeout(() => (t === token ? res() : rej(new Cancel())), ms));
};

function say(who, text, narr = false) {
  if (replaying) return Promise.resolve();
  const t = token;
  return new Promise((res) => {
    dlg.className = narr ? 'narr' : '';
    dlg.innerHTML = `<div class="name">${who}</div><div class="text"></div><div class="next">▼</div>`;
    const el = dlg.querySelector('.text');
    let i = 0, done = false;
    const timer = setInterval(() => {
      if (t !== token) { clearInterval(timer); return; }
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) { clearInterval(timer); done = true; dlg.classList.add('ready'); }
    }, 22);
    dlg.onclick = () => {
      if (t !== token) return;
      if (!done) { clearInterval(timer); el.textContent = text; done = true; dlg.classList.add('ready'); return; }
      dlg.onclick = null;
      res();
    };
  });
}
const N = (t) => say('', t, true);
const G = (t) => say('Geli', t);
const C = (t) => say('Cheesecake', t);
const F = (t) => say('Friend', t);

document.addEventListener('keydown', (e) => {
  if ((e.key === ' ' || e.key === 'Enter') && dlg.onclick && !dlg.classList.contains('hidden') && !dlg.querySelector('.choices')) {
    e.preventDefault(); dlg.onclick();
  }
});

// Ask a multiple-choice question. Returns the number picked (0, 1, 2...), or -1 if time ran out.
// Pass {code:'...'} to show a code question in a big card, {time:25} for a countdown.
function choose(prompt, options, { time = 0, code = '' } = {}) {
  if (replayQ.length) { const a = replayQ.shift(); answers.push(a); return Promise.resolve(a); }
  endReplay();
  const t = token;
  return new Promise((res) => {
    const quiz = !!code;
    const btns = options.map((o, i) => `<button data-i="${i}">${o}</button>`).join('');
    const timer = time ? '<div class="timer"><div></div></div>' : '';
    let root;
    if (quiz) {
      dlg.className = 'hidden';
      overlay.className = 'show quiz';
      overlay.innerHTML = `<div class="quiz-card"><h3>${prompt}</h3><pre class="code">${esc(code)}</pre>${timer}<div class="quiz-opts">${btns}</div></div>`;
      root = overlay;
    } else {
      dlg.className = ''; dlg.onclick = null;
      dlg.innerHTML = `<div class="text">${prompt}</div>${timer}<div class="choices">${btns}</div>`;
      root = dlg;
    }
    let tm;
    const finish = (i) => {
      if (t !== token) return;
      clearTimeout(tm);
      if (quiz) { overlay.className = 'hidden'; overlay.innerHTML = ''; }
      answers.push(i);
      res(i);
    };
    root.querySelectorAll('button').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); finish(+b.dataset.i); };
    });
    if (time) {
      const bar = root.querySelector('.timer div');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        bar.style.transition = `width ${time}s linear`;
        bar.style.width = '0%';
      }));
      tm = setTimeout(() => finish(-1), time * 1000);
    }
  });
}

// Let the player click on a character. Returns that character's id.
function pick(prompt, ids) {
  if (replayQ.length) { const a = replayQ.shift(); answers.push(a); return Promise.resolve(a); }
  endReplay();
  return new Promise((res) => {
    dlg.className = ''; dlg.onclick = null;
    dlg.innerHTML = `<div class="text">${prompt}</div>`;
    ids.forEach((id) => {
      const el = actors[id].el;
      el.classList.add('pickable');
      el.onclick = () => {
        ids.forEach((i) => { actors[i].el.classList.remove('pickable'); actors[i].el.onclick = null; });
        answers.push(id);
        res(id);
      };
    });
  });
}

/* progress bar */
function setProgress(v, instant) {
  progress = Math.max(0, Math.min(100, v));
  $('#bar-fill').style.width = progress + '%';
  $('#bar-heart').style.left = progress + '%';
}
function gain(n) {
  setProgress(progress + n);
  if (replaying) return;
  const h = $('#bar-heart');
  h.classList.remove('beat'); void h.offsetWidth; h.classList.add('beat');
  const f = document.createElement('div');
  f.className = 'floater'; f.textContent = `+${n} 💗`;
  $('#game').appendChild(f);
  setTimeout(() => f.remove(), 1700);
}
const setLevel = (t) => { $('#hud-label').textContent = t; };

/* fading between scenes */
const fadeOut = () => { fadeEl.classList.add('on'); return wait(1300); };

/* characters on stage */
function addActor(id, opts, { x, y = 28, w = 8.5, label = '' }) {
  const el = document.createElement('div');
  el.className = 'actor';
  el.style.cssText = `left:${x}%;bottom:${y}%;width:${w}em`;
  el.innerHTML = `<div class="inner" style="animation-delay:-${(Math.random() * 2).toFixed(2)}s"></div><span class="tag">${label}</span>`;
  stage.appendChild(el);
  actors[id] = { el, o: { ...opts } };
  renderActor(id);
}
function renderActor(id) { actors[id].el.querySelector('.inner').innerHTML = person(actors[id].o); }
function mood(id, m) { actors[id].o.mood = m; renderActor(id); }
function moveTo(id, x, y, w) {
  const e = actors[id].el;
  e.classList.add('walking');
  e.style.left = x + '%';
  if (y != null) e.style.bottom = y + '%';
  if (w != null) e.style.width = w + 'em';
  setTimeout(() => e.classList.remove('walking'), 1600);
}
const walk = async (id, x, y, w) => { moveTo(id, x, y, w); await wait(1700); };
function pop(id, emoji) {
  if (replaying) return;
  const s = document.createElement('span');
  s.className = 'pop'; s.textContent = emoji;
  actors[id].el.appendChild(s);
  setTimeout(() => s.remove(), 1300);
}

/* GAME OVER screen. "Try again" restarts the same scene. */
function gameOver({ title = 'GAME OVER', text, effect = 'tumble' }) {
  dlg.className = 'hidden'; dlg.onclick = null;
  const extra = {
    flies: Array.from({ length: 8 }, () =>
      `<span class="fly" style="--r:${(3.2 + Math.random() * 2.4).toFixed(1)}em;animation-duration:${(1.1 + Math.random() * 1.2).toFixed(2)}s;animation-delay:-${(Math.random() * 2).toFixed(2)}s">🪰</span>`).join(''),
    police: '<span class="siren">🚨</span><span class="cop">🚓</span>',
    reject: '<span class="broken">💔</span><span class="broken b2">💔</span><span class="broken b3">💔</span>',
    snail: '<span class="snail">🐌</span>',
    tumble: '<span class="dizzy">💫</span>',
    girls: '<span class="kiss k1">💋</span><span class="kiss k2">💋</span>',
    purple: '<div class="gooblob"></div><span class="siren">🚨</span><span class="broken">🟣</span><span class="broken b3">🟣</span>',
    nutrient: '<span class="broken">💀</span><span class="broken b2">🥬</span><span class="broken b3">🍎</span>',
  }[effect] || '';
  const m = (effect === 'flies' || effect === 'nutrient') ? 'dead' : 'sad';
  overlay.className = 'show fx-' + effect;
  overlay.innerHTML = `<div class="go-card"><h2>${title}</h2><div class="go-stage">${effect === 'girls' ? girlsTrio() : `<div class="go-char">${person({ ...CHEESE, mood: m })}</div>`}${extra}</div><p>${text}</p><button id="retry" class="big">Try again</button></div>`;
  $('#retry').onclick = () => startScene(currentScene, answers.slice(0, -1));
  return new Promise(() => {}); // never continues: the scene stops here
}

/* scene switching */
function goto(name) { checkpoints[name] = progress; startScene(name); }
function startScene(name, replay) {
  token++;
  answers = []; replayQ = replay ? [...replay] : []; replaying = !!replay;
  $('#game').classList.toggle('replay', replaying);
  currentScene = name;
  overlay.className = 'hidden'; overlay.innerHTML = '';
  dlg.className = 'hidden'; dlg.onclick = null; dlg.innerHTML = '';
  stage.innerHTML = '';
  Object.keys(actors).forEach((k) => delete actors[k]);
  setProgress(checkpoints[name] ?? progress);
  fadeEl.classList.remove('on');
  scenes[name]().catch((e) => { if (!(e instanceof Cancel)) console.error(e); });
}

/* ---------- 2. CHARACTERS ---------- */
const GELI   = { skin: '#f6d7bd', hair: '#80402b', style: 'wolf',  shirt: '#a483d8', pants: '#3d3a5c', blush: true, mole: true };
const CHEESE = { skin: '#f3d2b3', hair: '#15131b', style: 'bowl',  shirt: '#6f8fd8', pants: '#44445c' };
const FRIEND = { skin: '#f1cfae', hair: '#2b2323', style: 'short', shirt: '#e9a76a', pants: '#4a4a6a' };
const GUY1   = { skin: '#f4d4b5', hair: '#232323', style: 'short', shirt: '#6bbf8e', pants: '#3f4a5a' };
const GUY2   = { skin: '#efcaa8', hair: '#4a3426', style: 'short', shirt: '#d97b7b', pants: '#3f3f55' };
const GIRL2  = { skin: '#f1cfae', hair: '#6b2f4a', style: 'long',  shirt: '#7fd1c7', pants: '#4b4468', blush: true };
const girlsTrio = () => `<div class="go-trio"><div class="go-char side l">${person({ ...GIRL1, mood: 'shy' })}</div><div class="go-char">${person({ ...GELI, mood: 'happy' })}</div><div class="go-char side r">${person({ ...GIRL2, mood: 'shy' })}</div></div>`;
const GIRL1  = { skin: '#f6d7bd', hair: '#1d1820', style: 'long',  shirt: '#f2c35c', pants: '#4b4468', blush: true };

function person(o) {
  const skin = o.skin, hair = o.hair, shirt = o.shirt, pants = o.pants || '#444', m = o.mood || 'smile';
  const line = 'stroke="#7a3b3b" stroke-width="2" fill="none" stroke-linecap="round"';
  const ink = '#2d2142';

  const hairBack = {
    wolf: `<path d="M21 56 C14 14 86 14 79 56 L83 88 L76 85 L72 92 L64 86 L57 91 L50 85 L43 91 L36 86 L28 92 L24 85 L17 88 Z" fill="${hair}"/>
           <path d="M24 62 L8 69 L25 75 Z M76 62 L92 69 L75 75 Z" fill="${hair}"/>`,
    long: `<path d="M20 56 C13 12 87 12 80 56 L85 120 Q50 128 15 120 Z" fill="${hair}"/>`,
  }[o.style] || '';

  const hairFront = {
    wolf: `<path d="M22 56 C16 6 84 6 78 56 L76 51 Q50 46 24 51 Z" fill="${hair}"/>
           <path d="M25 38 L34 42 L30 77 Z M75 38 L66 42 L70 77 Z" fill="${hair}"/>`,
    bowl: `<path d="M21 62 C13 6 87 6 79 62 L74 56 Q70 50 64 49 Q57 51 50 48 Q43 51 36 49 Q30 50 26 56 Z" fill="${hair}"/>
           <path d="M22 56 L31 57 L26 70 Z M78 56 L69 57 L74 70 Z" fill="${hair}"/>`,
    short: `<path d="M21 54 C13 8 87 8 79 54 C73 42 62 36 50 36 C38 36 27 42 21 54 Z" fill="${hair}"/>
            <path d="M36 25 L40 13 L48 23 Z M54 22 L63 12 L65 27 Z" fill="${hair}"/>`,
    long: `<path d="M22 52 C16 6 84 6 78 52 L74 40 Q50 30 26 40 Z" fill="${hair}"/>
           <path d="M22 52 L20 80 L31 62 Z M78 52 L80 80 L69 62 Z" fill="${hair}"/>`,
  }[o.style] || '';

  const eyes = {
    smile: `<ellipse class="eye" cx="41" cy="56" rx="2.6" ry="3.3" fill="${ink}"/><ellipse class="eye" cx="59" cy="56" rx="2.6" ry="3.3" fill="${ink}"/>`,
    happy: `<path d="M37 58 Q41 51 45 58 M55 58 Q59 51 63 58" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    sad:   `<ellipse class="eye" cx="41" cy="57" rx="2.6" ry="3.3" fill="${ink}"/><ellipse class="eye" cx="59" cy="57" rx="2.6" ry="3.3" fill="${ink}"/><path d="M36 50 L45 53 M64 50 L55 53" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`,
    ew:    `<path d="M36 55 L46 58 M64 55 L54 58" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`,
    shock: `<circle cx="41" cy="56" r="4.2" fill="#fff" stroke="${ink}" stroke-width="1.4"/><circle cx="59" cy="56" r="4.2" fill="#fff" stroke="${ink}" stroke-width="1.4"/><circle cx="41" cy="56" r="1.6" fill="${ink}"/><circle cx="59" cy="56" r="1.6" fill="${ink}"/>`,
    dead:  `<path d="M37 52 L45 60 M45 52 L37 60 M55 52 L63 60 M63 52 L55 60" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`,
    stress: `<circle cx="41" cy="56" r="4.2" fill="#fff" stroke="${ink}" stroke-width="1.4"/><circle cx="59" cy="56" r="4.2" fill="#fff" stroke="${ink}" stroke-width="1.4"/><circle cx="41" cy="57" r="1" fill="${ink}"/><circle cx="59" cy="57" r="1" fill="${ink}"/><path d="M73 40 Q77 47 73 50 Q69 47 73 40Z" fill="#8fd3ff"/>`,
    sleep: `<path d="M37 56 Q41 61 45 56 M55 56 Q59 61 63 56" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    shy:   `<path d="M37 57 Q41 53 45 57 M55 57 Q59 53 63 57" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    side:   `<circle cx="41" cy="56" r="4.2" fill="#fff" stroke="${ink}" stroke-width="1.4"/><circle cx="59" cy="56" r="4.2" fill="#fff" stroke="${ink}" stroke-width="1.4"/><circle cx="43.4" cy="57" r="1.8" fill="${ink}"/><circle cx="61.4" cy="57" r="1.8" fill="${ink}"/><path d="M36 49 L45 52 M64 49 L55 52" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`,
    relief: `<path d="M37 56 Q41 61 45 56 M55 56 Q59 61 63 56" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M73 40 Q77 47 73 50 Q69 47 73 40Z" fill="#8fd3ff"/>`,
  }[m];

  const mouth = {
    smile: `<path d="M43 66 Q50 73 57 66" ${line}/>`,
    happy: `<path d="M42 65 Q50 77 58 65 Z" fill="#d9646c" stroke="#7a3b3b" stroke-width="1.5" stroke-linejoin="round"/>`,
    sad:   `<path d="M44 71 Q50 64 56 71" ${line}/>`,
    ew:    `<path d="M42 69 Q46 64 50 69 T58 69" ${line}/>`,
    shock: `<ellipse cx="50" cy="70" rx="4" ry="5" fill="#7a3b3b"/>`,
    dead:  `<path d="M43 70 L57 70" ${line}/>`,
    stress: `<path d="M42 69 Q46 64 50 69 T58 69" ${line}/>`,
    sleep: `<path d="M45 68 Q50 71 55 68" ${line}/>`,
    shy:   `<path d="M45 67 Q50 71 55 67" ${line}/>`,
    side:   `<path d="M44 70 Q50 65 56 70" ${line}/>`,
    relief: `<path d="M44 66 Q50 72 56 66" ${line}/>`,
  }[m];

  const sh = m === 'shy';
  const blush = (o.blush || sh) ? `<circle cx="34" cy="64" r="${sh ? 5.5 : 4}" fill="#ff7fa6" opacity="${sh ? 0.85 : 0.5}"/><circle cx="66" cy="64" r="${sh ? 5.5 : 4}" fill="#ff7fa6" opacity="${sh ? 0.85 : 0.5}"/>` : '';

  // ears (for the bowl cut they are drawn on top of the hair, so the hair sits behind them)
  const ears = `<circle cx="26" cy="54" r="4.5" fill="${skin}"/><circle cx="74" cy="54" r="4.5" fill="${skin}"/>`;

  // Geli's beauty mark: just under her left eye (the right one as we look at her), toward the side
  const mole = o.mole ? '<circle cx="65" cy="62.5" r="1.4" fill="#5a3326"/>' : '';

  return `<svg viewBox="0 0 100 180" xmlns="http://www.w3.org/2000/svg">
    ${hairBack}
    <rect x="30" y="128" width="18" height="40" rx="7" fill="${pants}"/>
    <rect x="52" y="128" width="18" height="40" rx="7" fill="${pants}"/>
    <ellipse cx="39" cy="171" rx="12" ry="6" fill="#fff" stroke="#cdb8f0" stroke-width="1.5"/>
    <ellipse cx="61" cy="171" rx="12" ry="6" fill="#fff" stroke="#cdb8f0" stroke-width="1.5"/>
    <path d="M24 132 L26 96 Q28 80 50 80 Q72 80 74 96 L76 132 Z" fill="${shirt}"/>
    <path d="M44 82 L44 100 M56 82 L56 100" stroke="rgba(255,255,255,.55)" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M27 92 Q13 100 15 124" stroke="${shirt}" stroke-width="11" stroke-linecap="round" fill="none"/>
    <path d="M73 92 Q87 100 85 124" stroke="${shirt}" stroke-width="11" stroke-linecap="round" fill="none"/>
    <circle cx="15" cy="127" r="5.5" fill="${skin}"/><circle cx="85" cy="127" r="5.5" fill="${skin}"/>
    <rect x="44" y="70" width="12" height="14" fill="${skin}"/>
    ${o.style === 'bowl' ? '' : ears}
    <ellipse cx="50" cy="50" rx="24" ry="25" fill="${skin}"/>
    ${blush}${mole}${eyes}${mouth}${hairFront}
    ${o.style === 'bowl' ? ears : ''}
  </svg>`;
}

/* ---------- 3. BACKGROUNDS ---------- */
const wins = (x, y, w, h, cols, rows, fill = '#ffe9b0') => {
  let s = '';
  const cw = w / cols, rh = h / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    s += `<rect x="${(x + c * cw + cw * 0.2).toFixed(1)}" y="${(y + r * rh + rh * 0.2).toFixed(1)}" width="${(cw * 0.6).toFixed(1)}" height="${(rh * 0.55).toFixed(1)}" rx=".6" fill="${fill}" opacity=".85"/>`;
  }
  return s;
};
const SVG_OPEN = '<svg class="bg" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">';

const fireflies = () => Array.from({ length: 16 }, () =>
  `<span class="ff" style="left:${(Math.random() * 96).toFixed(0)}%;top:${(10 + Math.random() * 60).toFixed(0)}%;animation-delay:-${(Math.random() * 4).toFixed(1)}s;animation-duration:${(3 + Math.random() * 3).toFixed(1)}s"></span>`).join('');

const nightBG = () => {
  let stars = '';
  for (let i = 0; i < 40; i++) stars += `<circle cx="${(Math.random() * 160).toFixed(0)}" cy="${(Math.random() * 50).toFixed(0)}" r="${(0.2 + Math.random() * 0.4).toFixed(1)}" fill="#fff" opacity=".8"/>`;
  return `${SVG_OPEN}
    <defs><linearGradient id="gN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1f4d"/><stop offset=".6" stop-color="#6a4c93"/><stop offset="1" stop-color="#f2b5d4"/></linearGradient></defs>
    <rect width="160" height="100" fill="url(#gN)"/>${stars}
    <circle cx="132" cy="20" r="9" fill="#fff4d6"/><circle cx="135" cy="18" r="9" fill="#5a3f8c" opacity=".25"/>
    <path d="M0 70 Q30 52 60 68 T120 66 T160 62 V100 H0Z" fill="#4b3a78"/>
    <path d="M0 82 Q40 68 80 80 T160 76 V100 H0Z" fill="#3a2d63"/>
    <g fill="#2b2150"><rect x="20" y="58" width="3" height="14"/><circle cx="21.5" cy="54" r="9"/><rect x="132" y="56" width="3" height="16"/><circle cx="133.5" cy="51" r="10"/></g>
  </svg>`;
};

const bbqBG = () => {
  let bunting = '';
  for (let i = 0; i < 16; i++) bunting += `<path d="M${i * 10 + 1} 6 l8 0 l-4 6 z" fill="${['#ff9cc2', '#fff7ea', '#b79bea', '#ffd9b0'][i % 4]}"/>`;
  return `${SVG_OPEN}
    <defs><linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d6fc7"/><stop offset=".55" stop-color="#f3b6d0"/><stop offset="1" stop-color="#ffd9b0"/></linearGradient></defs>
    <rect width="160" height="100" fill="url(#gB)"/>
    <circle cx="28" cy="24" r="10" fill="#fff1c9" opacity=".85"/>
    <rect x="0" y="16" width="50" height="44" fill="#6a5399"/>${wins(2, 20, 46, 36, 5, 4)}
    <rect x="108" y="10" width="52" height="50" fill="#6a5399"/>${wins(110, 14, 48, 42, 5, 4)}
    <rect x="46" y="30" width="66" height="30" fill="#7d66b0"/>${wins(50, 38, 58, 18, 7, 2)}
    <rect x="62" y="32" width="34" height="6" rx="1" fill="#fff7ea"/>
    <text x="79" y="36.6" text-anchor="middle" font-size="3" fill="#5a3f8c" font-family="sans-serif" font-weight="bold">ENGINEERING STUDENT CENTRE</text>
    <line x1="0" y1="6" x2="160" y2="6" stroke="#fff7ea" stroke-width=".5"/>${bunting}
    <rect y="58" width="160" height="42" fill="#cbb4e0"/>
    <path d="M0 74 H160 M0 88 H160 M40 58 V100 M100 58 V100" stroke="#b79fd1" stroke-width=".4"/>
    <g><rect x="16" y="46" width="3" height="14" fill="#6b4b7a"/><circle cx="17.5" cy="42" r="9" fill="#8fb08a"/><circle cx="22" cy="46" r="6" fill="#7a9f78"/></g>
    <path d="M118 38 H160 V48 Q154 54 148 48 Q142 54 136 48 Q130 54 124 48 Q120 52 118 48 Z" fill="#ff9cc2"/>
    <text x="139" y="45" text-anchor="middle" font-size="4.5" fill="#fff" font-family="sans-serif" font-weight="bold">BBQ!</text>
    <rect x="119" y="48" width="1" height="26" fill="#6b4b7a"/><rect x="158" y="48" width="1" height="26" fill="#6b4b7a"/>
    <rect x="124" y="60" width="30" height="14" rx="1.5" fill="#4a3a6a"/><rect x="122" y="57.5" width="34" height="3.5" rx="1" fill="#2d2142"/>
    <text x="127" y="57" font-size="5">🌭🌭🌭🌭</text>
  </svg>`;
};
const smoke = () => [0, 1.1, 2.2].map((d, i) => `<span class="smoke" style="left:${84 + i * 3}%;bottom:44%;animation-delay:${d}s">☁️</span>`).join('');

const labBG = () => {
  let desks = '';
  [32, 64, 96, 128].forEach((cx, i) => {
    const c = ['#ff9cc2', '#8fe3d2', '#ffd36b', '#b79bea'][i];
    desks += `<rect x="${cx - 13}" y="9" width="26" height="17" rx="1.5" fill="#14102a" stroke="#8c75c9" stroke-width=".6"/>
      <rect x="${cx - 10}" y="12" width="14" height="1.6" fill="${c}"/><rect x="${cx - 10}" y="15.5" width="19" height="1.6" fill="#8c75c9"/>
      <rect x="${cx - 7}" y="19" width="11" height="1.6" fill="${c}"/><rect x="${cx - 10}" y="22" width="8" height="1.6" fill="#8c75c9"/>
      <rect x="${cx - 15}" y="62" width="30" height="5" rx="1" fill="#8a6bbd"/><rect x="${cx - 14}" y="67" width="28" height="8" fill="#6f539f"/>
      <rect x="${cx - 6}" y="56" width="12" height="6" rx=".8" fill="#cfc2ee"/>`;
  });
  return `${SVG_OPEN}
    <rect width="160" height="100" fill="#2e2552"/><rect y="60" width="160" height="40" fill="#3f3470"/>
    <rect y="0" width="160" height="4" fill="#241c44"/>
    <rect x="4" y="40" width="10" height="14" rx="1" fill="#f3ecff"/><rect x="146" y="40" width="10" height="14" rx="1" fill="#f3ecff"/>
    <text x="80" y="6.5" text-anchor="middle" font-size="3" fill="#cdb8f0" font-family="sans-serif">CPSC LAB · ROOM FULL OF MONITORS</text>
    ${desks}
  </svg>`;
};

const stairsBG = () => {
  let steps = '';
  for (let i = 0; i < 6; i++) steps += `<rect y="${50 + i * 9}" width="160" height="9" fill="${i % 2 ? '#c4aee3' : '#d9c8ec'}"/><rect y="${50 + i * 9}" width="160" height="1" fill="#f3ecff"/>`;
  return `${SVG_OPEN}
    <defs><linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b79bea"/><stop offset="1" stop-color="#ffd9e6"/></linearGradient></defs>
    <rect width="160" height="100" fill="url(#gS)"/>
    <circle cx="125" cy="18" r="9" fill="#fff4d6" opacity=".9"/>
    <rect x="0" y="0" width="64" height="52" fill="#8e5f86"/>${wins(4, 6, 56, 40, 4, 3, '#ffe9b0')}
    <rect x="96" y="22" width="64" height="28" fill="#7d66b0"/>${wins(100, 26, 56, 20, 6, 2)}
    <g><rect x="76" y="30" width="3" height="20" fill="#6b4b7a"/><circle cx="77.5" cy="26" r="10" fill="#8fb08a"/></g>
    ${steps}
    <rect x="0" y="48" width="160" height="2" fill="#6a4aa3"/>
  </svg>`;
};

/* ----- stage 2: split-screen bedrooms, clock, phones, chat ----- */
const homeBG = (side, tone) => {
  const night = tone === 'night';
  const wall = side === 'l' ? '#5b4590' : '#46508f', floor = side === 'l' ? '#3d2f6b' : '#2f3a6e';
  let stars = '';
  if (night) for (let i = 0; i < 14; i++) stars += `<circle cx="${(30 + Math.random() * 24).toFixed(0)}" cy="${(13 + Math.random() * 24).toFixed(0)}" r=".4" fill="#fff"/>`;
  const orb = night ? '<circle cx="50" cy="20" r="4" fill="#fff4d6"/>' : '<circle cx="50" cy="20" r="5" fill="#fff1a8"/>';
  const decor = side === 'l'
    ? '<rect x="6" y="14" width="14" height="18" rx="1" fill="#f3ecff"/><path d="M9 28 L13 20 L16 25 L18 22" stroke="#ff6fa5" stroke-width="1" fill="none"/><text x="6" y="56" font-size="7">⛸️</text><text x="64" y="56" font-size="7">🎸</text>'
    : '<rect x="8" y="14" width="14" height="18" rx="1" fill="#f3ecff"/><text x="10.5" y="26" font-size="8">🧀</text><text x="66" y="56" font-size="6">🪴</text>';
  return `<div class="half ${side}"><svg class="bg" viewBox="0 0 80 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="100" fill="${wall}"/><rect y="68" width="80" height="32" fill="${floor}"/>
    <rect x="28" y="10" width="28" height="30" rx="1.5" fill="${night ? '#1d1745' : '#bfe4ff'}" stroke="#e3d6fa" stroke-width="1.2"/>${stars}${orb}
    <path d="M42 10 V40 M28 25 H56" stroke="#e3d6fa" stroke-width=".6" opacity=".6"/>${decor}</svg><div class="dawn"></div></div>`;
};

function home(tone, { laptop = true } = {}) {
  stage.innerHTML = homeBG('l', tone) + homeBG('r', tone) + '<div class="split-line"></div>';
  addActor('geli', { ...GELI, mood: laptop ? 'stress' : 'smile' }, { x: 17, y: 24, w: 10 });
  addActor('cheese', { ...CHEESE, mood: 'smile' }, { x: 67, y: 22, w: 10 });
  stage.insertAdjacentHTML('beforeend', `<div class="desk"></div>
    ${laptop ? '<div class="laptop"><i></i></div>' : '<div class="phone gphone"><div class="scr off"></div></div>'}
    <div class="bed"><i class="pillow"></i></div>
    <div class="phone cphone"><div class="scr feed"></div></div>`);
  feed('.cphone');
}
function feed(sel) {
  const el = $(sel + ' .scr'); if (!el) return;
  const t = token, cols = ['#ffd1e6', '#c9b8ff', '#b8e6ff', '#ffe9a8', '#c8f2d4', '#ffc8a8'];
  el.className = 'scr feed';
  el.innerHTML = '<div class="reel">' + Array.from({ length: 16 }, () => `<div class="fc" style="height:${(1 + Math.random() * 2.2).toFixed(1)}em;background:${cols[Math.floor(Math.random() * cols.length)]}"></div>`).join('') + '</div>';
  const reel = el.firstChild; let i = 0;
  const go = () => {
    if (t !== token || !reel.isConnected) return;
    i = (i + 1) % (reel.children.length - 2);
    reel.style.transition = i === 0 ? 'none' : 'transform .5s ease-in-out';
    reel.style.transform = `translateY(${-reel.children[i].offsetTop}px)`;
    setTimeout(go, 1200 + Math.random() * 1500);
  };
  setTimeout(go, 800);
}
const phoneScr = (sel, mode, html = '') => {
  $(sel).classList.toggle('ring', mode === 'ring');
  if (mode === 'feed') return feed(sel);
  const el = $(sel + ' .scr'); el.className = 'scr ' + mode; el.innerHTML = html;
};

const CLOCK_HTML = `<div id="clock"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#fff7ea" stroke="#6a4aa3" stroke-width="5"/>
  <g id="hh"><line x1="50" y1="50" x2="50" y2="27" stroke="#3b2a5e" stroke-width="5" stroke-linecap="round"/></g>
  <g id="mh"><line x1="50" y1="50" x2="50" y2="14" stroke="#ff6fa5" stroke-width="3" stroke-linecap="round"/></g>
  <circle cx="50" cy="50" r="3.5" fill="#3b2a5e"/></svg><div id="clock-time">11:00 PM</div></div>`;
let clockT = 0;   // minutes since 11:00 PM
const fmtT = (t) => { const m = (1380 + Math.round(t)) % 1440, h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
function setClock(t, ms = 0) {
  const hh = $('#hh'), mh = $('#mh');
  hh.style.transition = mh.style.transition = ms ? `transform ${ms}ms ease-in-out` : 'none';
  hh.style.transform = `rotate(${(1380 + t) * 0.5}deg)`;
  mh.style.transform = `rotate(${t * 6}deg)`;
  $('#clock-time').textContent = fmtT(t);
}
async function clockTo(t, ms = 2400) {
  const from = clockT, tk = token, t0 = Date.now(), lab = $('#clock-time');
  setClock(t, ms);
  const iv = setInterval(() => {
    const p = Math.min(1, (Date.now() - t0) / ms);
    lab.textContent = fmtT(from + (t - from) * p);
    if (p >= 1 || tk !== token) clearInterval(iv);
  }, 50);
  document.querySelectorAll('.dawn').forEach((d) => { d.style.transition = `opacity ${ms}ms linear`; d.style.opacity = (t / 420) * 0.55; });
  await wait(ms + 100); clockT = t;
}

const showChat = () => stage.insertAdjacentHTML('beforeend', '<div class="chat"><div class="chat-h">🧀 Cheesecake</div><div class="chat-b"></div></div>');
function msg(side, text) {
  const b = document.createElement('div'); b.className = 'bub ' + side; b.textContent = text;
  $('.chat-b').appendChild(b); return b;
}
async function typing(side) { const b = msg(side, '• • •'); b.classList.add('typing'); await wait(1300); b.remove(); }

const costcoBG = () => {
  let shelves = '';
  const cols = ['#ff9cc2', '#b79bea', '#ffd9b0', '#8fe3d2', '#fff7ea', '#f2c35c'];
  [20, 33, 46].forEach((y, r) => {
    shelves += `<rect x="0" y="${y + 11}" width="160" height="1.6" fill="#6a4aa3"/>`;
    for (let i = 0; i < 20; i++) shelves += `<rect x="${i * 8 + 1}" y="${y + 11 - 7 - ((i * 7 + r * 3) % 3)}" width="6.5" height="${7 + ((i * 7 + r * 3) % 3)}" rx=".6" fill="${cols[(i + r * 2) % 6]}"/>`;
  });
  return `${SVG_OPEN}<rect width="160" height="100" fill="#d9c8ec"/><rect width="160" height="8" fill="#4b3a78"/>
    <path d="M0 8 H160 M40 0 V8 M80 0 V8 M120 0 V8" stroke="#8c75c9" stroke-width=".6"/>
    <rect x="52" y="9" width="56" height="9" rx="1.5" fill="#ff5f9f"/><text x="80" y="15.8" text-anchor="middle" font-size="5.5" fill="#fff" font-family="sans-serif" font-weight="bold">COSTCO · BULK ZONE</text>
    ${shelves}<rect y="66" width="160" height="34" fill="#efe4fb"/><path d="M0 80 H160 M30 66 L10 100 M80 66 V100 M130 66 L150 100" stroke="#cbb8f0" stroke-width=".5"/></svg>`;
};
function toss(e) {
  const add = () => { const g = $('.cargo'); if (g) g.textContent += e; };
  const c = $('#cart');
  if (!c) return;
  if (replaying) return add();
  const t = document.createElement('span'); t.className = 'toss'; t.textContent = e;
  t.style.left = (parseFloat(c.style.left) + 3) + '%'; stage.appendChild(t);
  setTimeout(() => { t.remove(); add(); }, 1000);
}
// Click a product to put it in the cart. Returns the product's id.
function shop(prompt, items, cls = '') {
  if (replayQ.length) { const a = replayQ.shift(); answers.push(a); return Promise.resolve(a); }
  endReplay();
  const t = token;
  return new Promise((res) => {
    dlg.className = 'hidden'; dlg.onclick = null;
    const w = document.createElement('div'); w.className = 'shelf ' + cls;
    w.innerHTML = `<div class="shelf-h">${prompt}</div><div class="shelf-g">${items.map((it) => `<button data-id="${it.id}"><span>${it.e}</span>${it.n}</button>`).join('')}</div>`;
    stage.appendChild(w);
    w.querySelectorAll('button').forEach((b) => {
      b.onclick = () => { if (t !== token) return; answers.push(b.dataset.id); w.remove(); res(b.dataset.id); };
    });
  });
}

/* ----- stage 3: exam, hallway, dorm kitchen ----- */
const examBG = () => {
  let rows = '';
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
    if (c === 2 || c === 3) continue;
    rows += `<rect x="${10 + c * 24}" y="${44 + r * 10}" width="18" height="5" rx=".8" fill="#8a6bbd"/><circle cx="${19 + c * 24}" cy="${41 + r * 10}" r="3" fill="#c9b8e8"/>`;
  }
  return `${SVG_OPEN}<rect width="160" height="100" fill="#d9cfee"/><rect y="62" width="160" height="38" fill="#b9a6dc"/>
    <rect x="48" y="8" width="64" height="26" rx="1.5" fill="#f3ecff" stroke="#8c75c9" stroke-width="1"/>
    <text x="80" y="18" text-anchor="middle" font-size="4.2" fill="#3b2a5e" font-family="sans-serif" font-weight="bold">CPEN 211 · FINAL EXAM</text>
    <text x="80" y="26" text-anchor="middle" font-size="3" fill="#6a4aa3" font-family="sans-serif">Q4: make the LEDs light up on the FPGA board</text>
    <circle cx="20" cy="18" r="8" fill="#fff7ea" stroke="#6a4aa3" stroke-width="1.2"/><path d="M20 18 V12 M20 18 L24 20" stroke="#3b2a5e" stroke-width="1"/>${rows}</svg>`;
};
const hallBG = () => {
  let lockers = '';
  for (let i = 0; i < 9; i++) lockers += `<rect x="${i * 18 + 1}" y="26" width="16" height="36" rx="1" fill="${i % 2 ? '#8e7bc9' : '#7d6bb8'}"/><rect x="${i * 18 + 4}" y="32" width="10" height="3" fill="#cbb8f0"/>`;
  return `${SVG_OPEN}<rect width="160" height="100" fill="#e3d6fa"/>${lockers}
    <rect x="58" y="14" width="44" height="48" rx="1" fill="#6a4aa3"/><text x="80" y="22" text-anchor="middle" font-size="3.2" fill="#fff" font-family="sans-serif" font-weight="bold">EXAM ROOM</text><rect x="64" y="26" width="32" height="36" fill="#4b3a78"/>
    <rect y="62" width="160" height="38" fill="#cbb4e0"/><path d="M0 80 H160" stroke="#b79fd1" stroke-width=".4"/></svg>`;
};
const dormBG = () => `${SVG_OPEN}<rect width="160" height="100" fill="#f3d9ec"/>
  <circle cx="80" cy="6" r="3" fill="#fff7ea" stroke="#6a4aa3" stroke-width=".6"/>
  <rect x="14" y="14" width="26" height="22" rx="1.5" fill="#bfe4ff" stroke="#fff7ea" stroke-width="1.5"/><path d="M27 14 V36 M14 25 H40" stroke="#fff7ea" stroke-width=".8"/>
  <rect x="112" y="30" width="40" height="2" fill="#8c75c9"/><text x="114" y="29" font-size="6">🫙🫙🫙</text>
  <rect y="60" width="160" height="40" fill="#8a6bbd"/><rect y="58" width="160" height="4" fill="#e3d6fa"/><rect x="62" y="58" width="36" height="3" fill="#2d2142"/></svg>`;

const POT_HTML = '<div class="pot"><i class="ph l"></i><i class="ph r"></i><div class="body"></div><div class="liq"></div><b class="pb pb1"></b><b class="pb pb2"></b><b class="pb pb3"></b></div>';
const FPGA = '<div class="fpga"><b>FPGA board</b><div class="leds">' + '<i></i>'.repeat(10) + '</div></div>';
function squig(id, on = true) {
  const el = actors[id].el, old = el.querySelector('.squig');
  if (old) old.remove();
  if (on) el.insertAdjacentHTML('beforeend', '<svg class="squig" viewBox="0 0 100 40"><path d="M8 32 q6 -26 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 M18 12 l8 -8 l8 10 l8 -10 l8 10 l8 -10 l8 10" fill="none" stroke="#3b2a5e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>');
}
function mind(on = true) {
  const old = stage.querySelector('.mind'); if (old) old.remove();
  if (!on) return;
  const bits = ['hug Cheesecake', 'just friends!!', 'what do I do', '💗', 'PANIC', 'hug him', 'what do I do', '💗💗', 'hug Cheesecake', 'just friends...'];
  stage.insertAdjacentHTML('beforeend', `<div class="mind">${bits.map((b) => `<span style="left:${(Math.random() * 75).toFixed(0)}%;top:${(Math.random() * 70).toFixed(0)}%;animation-delay:-${(Math.random() * 2).toFixed(1)}s;font-size:${(0.9 + Math.random() * 0.7).toFixed(1)}em">${b}</span>`).join('')}<b>I WANNA HUG CHEESECAKE</b></div>`);
}
function dropIn(e) {
  if (replaying) return;
  const d = document.createElement('span'); d.className = 'drop'; d.textContent = e;
  stage.appendChild(d); setTimeout(() => d.remove(), 1000);
}

/* ---------- 4. SCENES ---------- */

/* TITLE SCREEN */
scenes.title = async () => {
  hud.classList.add('hidden');
  stage.innerHTML = nightBG() + fireflies();
  addActor('geli', { ...GELI, mood: 'happy' }, { x: 9, y: 18, w: 11, label: 'Geli' });
  addActor('cheese', { ...CHEESE, mood: 'shock' }, { x: 78, y: 18, w: 11, label: 'Cheesecake' });
  stage.insertAdjacentHTML('beforeend', `
    <div class="title-card">
      <div class="heart">💜</div>
      <h1>Geli &amp; Cheesecake</h1>
      <h2>The Dating Game</h2>
      <p class="q">Cheesecake... are you ready to try to dating me again?</p>
      <button id="start" class="big">Start 💜</button>
    </div>`);
  await new Promise((res) => { $('#start').onclick = res; });
  await fadeOut();
  goto('bbq');
};

/* LEVEL 1: the BBQ */
async function compareSchedules() {
  const A = [1,0,1,0,1,  0,1,0,1,0,  1,1,0,0,1];
  const B = [1,0,0,0,1,  0,1,0,0,1,  1,1,0,1,0];
  const days = ['M', 'T', 'W', 'T', 'F'].map((d) => `<span>${d}</span>`).join('');
  const grid = (a, b) => a.map((v, i) => `<i class="${v ? 'on' : ''} ${v && b[i] ? 'match' : ''}"></i>`).join('');
  const wrap = document.createElement('div');
  wrap.className = 'sched-wrap';
  wrap.innerHTML = `
    <div class="card left"><b>Geli's week</b><div class="days">${days}</div><div class="sched">${grid(A, B)}</div></div>
    <div class="card right"><b>Cheesecake's week</b><div class="days">${days}</div><div class="sched">${grid(B, A)}</div></div>
    <div class="burst hidden">✨ 5 shared time slots! ✨</div>`;
  stage.appendChild(wrap);
  await wait(150); wrap.classList.add('in');
  await wait(1600); wrap.classList.add('merge');
  await wait(900); wrap.querySelector('.burst').classList.remove('hidden');
  await wait(2000); wrap.classList.add('out');
  await wait(700); wrap.remove();
}

scenes.bbq = async () => {
  hud.classList.remove('hidden');
  setLevel('Level 1 · Strangers');
  stage.innerHTML = bbqBG() + smoke();
  addActor('friend', FRIEND, { x: 66, w: 8.5 });
  addActor('cheese', CHEESE, { x: 52, w: 8.5 });
  addActor('geli', GELI, { x: -14, w: 8.5 });
  await wait(900);

  await N('📍 Engineering Student Centre courtyard. Free BBQ day. The hot dog line is looooong.');
  await walk('geli', 34);
  pop('cheese', '🌭');
  await N('Geli joins the line for hot dogs... and just happens to end up right behind two people.');
  moveTo('friend', 68); moveTo('cheese', 54); moveTo('geli', 38);
  await G("(Okay, hot dog line. Hot dog line. ...Why is that guy's hair so messy?)");
  pop('geli', '💬');
  await G("Hi! I'm Angelina, nice to meet you guy! What's your name?");
  mood('cheese', 'shock'); pop('cheese', '❗');
  await C("Oh! Uh... I'm Cheesecake.");
  await F('(whispering) Bro. Is that rizz??.');
  mood('cheese', 'smile');
  await G('Cheesecake? Okay, Cool! I\'m Geli! So... are you in ELEC or CPEN?');

  const major = await choose('Cheesecake, answer very carefully...', ['⚡ ELEC', '💻 CPEN']);
  if (major === 1) {
    mood('cheese', 'happy');
    await C('CPEN!');
    mood('geli', 'ew');
    await G('Ew... stinky. Have you showered this month?');
    await gameOver({ text: 'Cheesecake was defeated by a single sentence. The flies have moved in.', effect: 'flies' });
  }

  await C('Elec!');
  mood('geli', 'happy'); gain(8);
  await G('Oh wow, me too!!');
  await G("What's your schedule like? Let me see yours...");
  await compareSchedules();
  mood('cheese', 'shock');
  await C('Wait... we have the same lab section?!');
  await G('We do! OMG I have not found anyone that CPSC lab yet... Ok gotta go, but see you in class!');
  mood('cheese', 'happy');
  await C('S-see you in class!');
  moveTo('geli', -16);
  await F('Smooth, bro. That is a hot girl damnn.');
  await fadeOut();
  goto('lab');
};

/* LEVEL 2: the CPSC lab */
scenes.lab = async () => {
  hud.classList.remove('hidden');
  setLevel('Level 2 · Classmates');
  stage.innerHTML = labBG();
  addActor('guy1',  GUY1,  { x: 13, w: 8.5, label: 'Guy 1' });
  addActor('girl1', GIRL1, { x: 33, w: 8.5, label: 'Girl 1' });
  addActor('guy2',  GUY2,  { x: 53, w: 8.5, label: 'Guy 2' });
  addActor('geli',  GELI,  { x: 73, w: 8.5, label: 'Geli' });
  addActor('cheese', CHEESE, { x: -14, y: 22, w: 9.5 });
  await wait(900);

  await N('📍 CPSC lab. Today is a partner assignment. Everyone is pairing up. FAST.');
  await walk('cheese', 2, 22);
  await C('(Okay. Okay okay okay. Pick a partner. Be normal.)');

  const who = await pick('Who should Cheesecake ask to be his lab partner? (Click a person!)', ['guy1', 'girl1', 'guy2', 'geli']);
  const px = parseFloat(actors[who].el.style.left);
  await walk('cheese', px - 11, 22);
  mood('cheese', 'smile');

  if (who === 'guy1' || who === 'guy2') {
    await C('Hey... wanna be lab partners?');
    mood(who, 'shock');
    await say(who === 'guy1' ? 'Guy 1' : 'Guy 2', 'Sure bro, meet me at my dorm tonight and we will talk more hehe.');
    await gameOver({ text: 'Cheesecake was never able to walk properly for the next few months...', effect: 'tumble' });
  }
  if (who === 'girl1') {
    await C('Hey... wanna be lab partners?');
    mood('girl1', 'ew');
    await say('Girl 1', "Sorry, I'm working with my bf");
    await gameOver({ text: 'Girl 1 politely refused. Cheesecake is defeated.', effect: 'reject' });
  }

  // chose Geli
  mood('geli', 'happy'); pop('geli', '💜'); gain(8);
  await C('Hey... wanna be lab partners?');
  await G('Oh, You are uhh... Name is not important, the BBQ guy! Sure, sit down.');
  await N('They open the assignment together.');
  await G('Okay, quick warm-up before we start. You have 25 seconds. No pressure. (A little pressure.)');

  const ans = await choose('What does this C code print?', ['4', '10', '24', '15'], {
    time: 25,
    code: 'int sum = 0;\nfor (int i = 1; i <= 4; i++) {\n    sum += i;\n}\nprintf("%d", sum);',
  });
  if (ans !== 1) {
    mood('geli', 'ew');
    await G("...You know what? I'll just do the lab myself.");
    await gameOver({ text: 'Geli decided to do the lab herself since you are too slow.', effect: 'snail' });
  }

  gain(8);
  mood('geli', 'happy');
  await G("Ooh, you actually know C! Okay, I'm keeping you.");
  await N('An hour of semicolons, segfaults, and surprisingly good teamwork later... Lab complete! ✅');
  await fadeOut();
  goto('stairs');
};

/* LEVEL 3: the stairs */
scenes.stairs = async () => {
  hud.classList.remove('hidden');
  setLevel('Level 3 · Lab Partners');
  stage.innerHTML = stairsBG();
  addActor('geli', GELI, { x: 32, y: 44, w: 7.5 });
  addActor('cheese', CHEESE, { x: 18, y: 44, w: 7.5 });
  await wait(800);

  await N('📍 After the lab, Geli and Cheesecake walk down the stairs together.');
  moveTo('geli', 40, 32, 8.5); moveTo('cheese', 26, 32, 8.5);
  await wait(1800);
  await C('(She is RIGHT THERE. Say something. Say SOMETHING.)');

  const c = await choose('What does Cheesecake say?', [
    '"Hey girl, I think you\'re hot. Wanna grab a drink tonight?" 😉',
    '"So... what are your hobbies?"',
    '"Boobies boobies, lemme cop a feel."',
  ]);

  if (c === 0) {
    mood('geli', 'ew');
    await G('Yikes. Okay, playboy.');
    await gameOver({ text: 'Geli thinks you are a playboy.', effect: 'tumble' });
  }
  if (c === 2) {
    mood('geli', 'shock'); mood('cheese', 'shock');
    await G('...Excuse me?!');
    await gameOver({ text: 'Geli reported you. Cheesecake was escorted away by campus security.', effect: 'police' });
  }

  gain(8);
  mood('geli', 'happy');
  await G("Ooh, that's an interesting question!");
  await G('Hmm... I figure skate in my free time. I play the ukulele. And I do watercolour paintings!');
  mood('cheese', 'happy');
  await C("(She figure skates?! Ukulele?! Watercolour?! Oh damn she's so cool.)");
  await N('And the two kept walking, talking about everything and nothing...');
  moveTo('geli', 78, 36, 5); moveTo('cheese', 66, 36, 5);
  await wait(1200);
  actors.geli.el.style.opacity = 0; actors.cheese.el.style.opacity = 0;
  await wait(1500);
  await fadeOut();
  goto('call');
};

/* LEVEL 4: the midnight call (split screen) */
scenes.call = async () => {
  hud.classList.remove('hidden');
  setLevel('Level 4 · Midnight Study');
  clockT = 0;
  home('night');
  stage.insertAdjacentHTML('beforeend', CLOCK_HTML);
  setClock(0);
  await wait(900);

  await N('📍 11:00 PM. Two homes. One very overdue ELEC assignment.');
  await N('Cheesecake is scrolling on his phone in bed, accomplishing absolutely nothing.');
  pop('geli', '💦');
  await G("(It's due soon and I'm SO stressed. I can't do this alone... Okay. Call someone.)");
  stage.insertAdjacentHTML('beforeend', '<div class="callbox">📞 Calling Cheesecake<span class="dots"></span></div>');
  await wait(1800);
  phoneScr('.cphone', 'ring', '<b>📞</b><span>Geli 💜</span>');
  pop('cheese', '❗'); mood('cheese', 'shock');
  await wait(2200);
  await C('(GELI is calling me?! Breathe. Pick up. PICK UP.)');
  phoneScr('.cphone', 'talk', '<b>📞</b><span>on call</span>');
  $('.callbox').innerHTML = '📞 Connected 💜';
  mood('cheese', 'smile');
  await C("Hello? ...Hey Geli. What's up?");
  await G('Help me with this ELEC assignment! It is due soon and I am so stressed. I really wanna finish it before tomorrow... can you help??');
  mood('cheese', 'happy');
  await C('Yeah, for sure.');
  await N('And so the all-nighter begins...');

  async function circuitQ(intro, prompt, code, opts, right) {
    mood('geli', 'smile');
    await G(intro);
    const a = await choose(prompt, opts, { time: 20, code });
    if (a === right) {
      mood('geli', 'happy'); mood('cheese', 'happy'); gain(4);
      await G('Bravo! No way, you actually solved a question!');
    } else {
      await N('Thankfully, Geli is smart enough to solve it herself. 🧠');
    }
    mood('geli', 'stress'); mood('cheese', 'smile');
  }

  await clockTo(60);
  await N('12:00 AM. Resistors. So many resistors.');
  await circuitQ('Okay, warm-up. 20 seconds!', 'What current flows through the resistor?',
    '(12V)--[ R = 4 ohm ]--+\n  |                   |\n  +-------------------+', ['3 A', '48 A', '8 A', '0.33 A'], 0);

  await clockTo(180);
  await N('2:00 AM. Cheesecake yawns. Geli does not notice.');
  await circuitQ('Next one. Two resistors!', 'Total resistance of the series circuit?',
    '(10V)--[ 6 ohm ]--[ 6 ohm ]--+\n  |                          |\n  +--------------------------+', ['3 Ω', '6 Ω', '12 Ω', '36 Ω'], 2);

  await clockTo(300);
  await N('4:00 AM. The coffee is gone. The assignment is not.');
  await circuitQ('Last tough one, I promise. Parallel!', 'Equivalent resistance of the parallel pair?',
    '       +--[ 6 ohm ]--+\n(12V)--+             +--\n       +--[ 3 ohm ]--+', ['9 Ω', '2 Ω', '4.5 Ω', '18 Ω'], 1);

  await clockTo(420, 2800);
  await N('6:00 AM. Birds are chirping. The assignment is... finished. ✅');
  mood('geli', 'sleep');
  await G("Okay, I need to sleep now. Thank you so much for staying up with me!");
  mood('cheese', 'happy');
  await C('Anytime. Sleep well, Geli.');
  phoneScr('.cphone', 'off');
  $('.callbox').remove();
  await N('Click. Geli hangs up the phone.');
  mood('geli', 'shy'); pop('geli', '💜'); mood('cheese', 'sleep'); gain(4);
  await G("(...Wow. That's the first time I've ever called someone for that long.)");
  await N('Geli drifts off to sleep at her desk... 😴');
  dlg.className = 'hidden';
  await wait(800);
  fadeEl.classList.add('on'); await wait(1300);
  const z = document.createElement('div'); z.className = 'zzz'; z.innerHTML = '<span>Z</span><span>z</span><span>Z</span>';
  $('#game').appendChild(z);
  await wait(3400);
  z.remove();
  goto('invite');
};

/* LEVEL 5: the invite */
scenes.invite = async () => {
  hud.classList.remove('hidden');
  setLevel('Level 5 · The Invite');
  home('day', { laptop: false });
  mood('geli', 'smile');
  showChat();
  await wait(900);

  await N('📍 Saturday afternoon. Geli finally woke up. Cheesecake has been staring at an empty chat box for 20 minutes.');
  mood('cheese', 'shock');
  await C('(Okay. Invite her out. Something fun. Something NORMAL.)');

  const opts = ['Yo wanna go out clubbing and hit on some hot girls? 🪩', 'Wanna go on a Costco run together? 🛒', "Let's hang out in your bed 🤤🤤"];
  const c = await choose('What does Cheesecake text Geli?', opts);
  dlg.className = 'hidden';
  mood('cheese', 'smile');
  msg('cheese', opts[c]);
  phoneScr('.gphone', 'ring', '<b>💬</b>');
  await wait(1300);
  phoneScr('.gphone', 'off');
  await typing('geli');

  if (c === 0) {
    msg('geli', 'omg ur right... hot girls are EVERYWHERE 👀 thx for the idea!');
    mood('geli', 'happy');
    await wait(1800);
    await gameOver({ text: 'Geli discovered hot girls and decided to date girls instead.', effect: 'girls' });
  }
  if (c === 2) {
    msg('geli', '...ok that is tooo desperate 💀');
    mood('geli', 'ew');
    await wait(1800);
    await gameOver({ text: 'Geli thinks you are tooo desperate.', effect: 'reject' });
  }

  msg('geli', 'yess for sure, my groceries are running low! 🛒');
  mood('geli', 'happy'); pop('geli', '💜'); gain(8);
  await wait(1200);
  mood('cheese', 'happy'); pop('cheese', '💜');
  await C('(She said YES. SHE SAID YES.)');
  await fadeOut();
  goto('costco');
};

/* LEVEL 5b: Costco run (interactive) */
scenes.costco = async () => {
  hud.classList.remove('hidden');
  setLevel('Level 5 · Costco Run');
  stage.innerHTML = costcoBG();
  addActor('geli', GELI, { x: -16, w: 8.5 });
  addActor('cheese', CHEESE, { x: -30, w: 8.5 });
  stage.insertAdjacentHTML('beforeend', '<div class="prop" id="cart" style="left:-20%;bottom:24%"><span class="cargo"></span>🛒</div>');
  const stroll = async (x) => {
    moveTo('geli', x); moveTo('cheese', x + 13);
    $('#cart').style.left = (x + 24) + '%';
    await wait(1800);
  };
  const shelf = [
    { id: 'chicken', e: '🍗', n: 'Rotisserie chicken', say: 'A giant rotisserie chicken. Good pick!' },
    { id: 'tp', e: '🧻', n: 'Toilet paper', say: '48 rolls of toilet paper... a bit much, but okay.' },
    { id: 'condoms', e: '📦', n: 'Condoms' },
    { id: 'rice', e: '🍚', n: 'Rice (20 lb bag)', say: 'Rice! Finally, a responsible adult.' },
    { id: 'drinks', e: '🥤', n: 'Drinks', say: 'Ooh, drinks. Smart.' },
    { id: 'berries', e: '🍓', n: 'Berries', say: 'Berries! You get me.' },
  ];
  await wait(700);

  await N('📍 Costco. One cart. Two people. Zero self-control.');
  await stroll(16);
  await G('Okay, rules: we only buy what we NEED. You pick three things for the cart!');

  const got = [], spots = [28, 40, 52];
  for (let r = 0; r < 3; r++) {
    await stroll(spots[r]);
    const id = await shop(`Cheesecake, pick item ${r + 1} of 3 for the cart!`, shelf.filter((i) => !got.includes(i.id)));
    const it = shelf.find((i) => i.id === id);
    toss(it.e);
    if (id === 'condoms') {
      mood('geli', 'ew'); mood('cheese', 'shock');
      await G("...Excuse me?? You just wanna crack, don't you?!");
      await gameOver({ text: 'Geli thinks you just wanna crack. She is disgusted.', effect: 'reject' });
    }
    got.push(id); mood('geli', 'happy'); mood('cheese', 'happy'); gain(3);
    await G(it.say);
  }

  await stroll(54);
  pop('geli', '🍡'); pop('cheese', '🍡');
  await G('FREE SAMPLES!!');
  mood('geli', 'shy'); mood('cheese', 'shy'); pop('geli', '💜'); pop('cheese', '💜');
  await N('They both reach for the last sample at the same time...');
  await N('The cart was full. Their wallets were not. 💸');
  await fadeOut();
  goto('exam');
};

/* LEVEL 6: CPEN 211 exam */
scenes.exam = async () => {
  hud.classList.remove('hidden');
  setLevel('Level 6 · CPEN 211 Exam');
  stage.innerHTML = examBG();
  addActor('geli', { ...GELI, mood: 'stress' }, { x: 27, y: 26, w: 9.5 });
  addActor('cheese', { ...CHEESE, mood: 'stress' }, { x: 55, y: 26, w: 9.5 });
  stage.insertAdjacentHTML('beforeend', '<div class="desk wide"></div><div class="laptop" style="left:28.2%"><i></i></div><div class="laptop" style="left:56.2%"><i></i></div>');
  squig('geli'); squig('cheese');
  await wait(900);

  await N('📍 CPEN 211 final exam. Last question: write the code, then run it on the FPGA board. Geli and Cheesecake sit side by side.');
  await N('The room is silent. Pencils scratch. Brains sizzle. 🔥');
  await G("(Okay, okay, okay... just the last line of code. Don't panic, don't panic!)");
  await C('(Why is nothing working?! Do I even know how to Verilog?!)');
  await N('Geli types the very last line of code... and hits RUN.');
  squig('geli', false); mood('geli', 'shock');
  stage.insertAdjacentHTML('beforeend', FPGA);
  for (const l of stage.querySelectorAll('.leds i')) { l.classList.add('on'); await wait(130); }
  mood('geli', 'happy'); pop('geli', '✨'); gain(4);
  await G('THE LEDS LIGHT UP!! It works!! YESSS!!');
  stage.querySelector('.fpga').remove();
  mood('geli', 'side');
  await G('(...Wait. Will Cheesecake finish?)');
  await G('(I really want him to get 100%. I wish he can do it...)');
  await N('Geli peeks at Cheesecake, who is still scribbling away...');
  await wait(1500);
  await N('Shortly after...');
  squig('cheese', false); mood('cheese', 'relief'); pop('cheese', '😮‍💨');
  await C('Done. FINALLY.');
  mood('geli', 'happy'); pop('geli', '💜');
  await G('(He did it!! Yesss!)');
  await fadeOut();
  goto('hall');
};

/* LEVEL 6b: walking out of the exam */
scenes.hall = async () => {
  hud.classList.remove('hidden');
  setLevel('Level 6 · CPEN 211 Exam');
  stage.innerHTML = hallBG();
  addActor('geli', { ...GELI, mood: 'happy' }, { x: -16, w: 8.5 });
  addActor('cheese', { ...CHEESE, mood: 'happy' }, { x: -30, w: 8.5 });
  await wait(700);

  await N('📍 Outside the exam room. Two very tired, very happy engineers.');
  moveTo('geli', 36); moveTo('cheese', 50);
  await wait(1800);
  await C('Ahh... that exam was kinda challenging.');
  await G('Right?! My brain is soup. But we did it!');
  await C("I'm so glad we both passed!");
  mood('geli', 'stress'); mind();
  await G("(HOLY MOLY. I really wanna hug Cheesecake... but I can't, we're just friends! What do I do?! WHAT DO I DO?!)");
  await G('(All I can think about is hugging Cheesecake!!)');
  await C('Hey Geli, what are your plans for today?');
  mind(false); mood('geli', 'shock');
  await G('Uhh... I... am not so sure...');
  mood('cheese', 'smile');
  await C('Wanna go to the gym with me?');
  mood('geli', 'happy'); pop('geli', '💜');
  await G('Yes!! I mean... yeah, sure! Let me go change!');
  moveTo('geli', -16); gain(4);
  await N('Geli hurries off to change... alone... heart pounding. 💓');
  await fadeOut();
  goto('friends');
};

/* LEVEL 6c: Cheesecake and the friends */
scenes.friends = async () => {
  hud.classList.remove('hidden');
  setLevel('Level 6 · After the Exam');
  stage.innerHTML = hallBG();
  addActor('cheese', { ...CHEESE, mood: 'smile' }, { x: 28, w: 8.5 });
  addActor('friend', FRIEND, { x: 50, w: 8.5 });
  addActor('guy1', GUY1, { x: 66, w: 8.5 });
  await wait(800);

  await N('📍 Meanwhile, Cheesecake runs into some friends.');
  await F('Bro! How was the exam?');
  await C('Kinda challenging... but I think I passed. Geli and I both did.');
  mood('cheese', 'shy');
  await say('Guy 1', 'Wait. "Geli and I." And where is Geli right now?');
  await C("She's changing. We're going to the gym.");
  await F('Bro. After the exam. With the BBQ girl. To the gym.');
  await say('Guy 1', 'Smooth. Very smooth.');
  mood('cheese', 'shock');
  await C("It's just a gym trip!! We're friends!!");
  await F('Sure, bro. Sure.');
  await N("Cheesecake's ears turn bright red...");
  await fadeOut();
  goto('dorm');
};

/* LEVEL 7: dorm kitchen, interactive cooking + taste test */
scenes.dorm = async () => {
  hud.classList.remove('hidden');
  setLevel('Level 7 · Dorm Kitchen');
  stage.innerHTML = dormBG();
  addActor('geli', { ...GELI, mood: 'happy' }, { x: 26, w: 8.5 });
  addActor('cheese', CHEESE, { x: 62, w: 8.5 });
  stage.insertAdjacentHTML('beforeend', POT_HTML);
  const liq = ['#bde3ff', '#d2b5f5', '#b17bf0', '#8c4fd6', '#7a3fc4'];
  const setLiq = (n) => { $('.pot .liq').style.backgroundColor = liq[n]; };
  const items = [
    { id: 'banana', e: '🍌', n: 'Banana' },
    { id: 'cabbage', e: '🥬', n: 'Purple cabbage', ok: 1, say: "Purple cabbage! That's what makes it so purple!" },
    { id: 'hotdog', e: '🌭', n: 'Hot dog' },
    { id: 'apple', e: '🍎', n: 'Apple', ok: 1, say: 'Apple, for a little sweetness!' },
    { id: 'choc', e: '🍫', n: 'Chocolate bar' },
    { id: 'potato', e: '🥔', n: 'Potato', ok: 1, say: 'Potato, for the thickness!' },
    { id: 'tomato', e: '🍅', n: 'Tomato' },
    { id: 'spinach', e: '🌿', n: 'Spinach', ok: 1, say: 'And spinach... for the nutrients!' },
  ];
  await wait(900);

  await N("📍 Later that night, Geli's dorm. Something purple is bubbling aggressively on the stove.");
  mood('cheese', 'shock');
  await C('Geli... what IS that?!');
  mood('cheese', 'smile');
  await G('My famous purple soup! Guess what I put in it. Add the right ingredients!');

  const got = [];
  for (let r = 0; r < 4; r++) {
    const id = await shop(`What did Geli add? Pick ingredient ${r + 1} of 4!`, items.filter((i) => !got.includes(i.id)), 'low');
    const it = items.find((i) => i.id === id);
    dropIn(it.e);
    if (!it.ok) {
      mood('geli', 'shock'); mood('cheese', 'shock');
      await wait(900);
      $('.pot').classList.add('boom');
      stage.insertAdjacentHTML('beforeend', '<div class="splat"></div>');
      await wait(1300);
      await gameOver({ text: 'Uh oh, you triggered the fire alarm. Cheesecake is covered in purple goo.', effect: 'purple' });
    }
    got.push(id); setLiq(r + 1); gain(2); mood('geli', 'happy'); mood('cheese', 'smile');
    await G(it.say);
  }

  await N('The soup bubbles proudly. Geli stirs it with great confidence.');
  await G('Perfect! Cheesecake, come sit. Time for the TASTE TEST!');
  $('.pot').remove();
  stage.insertAdjacentHTML('beforeend', '<div class="dtable"><span class="bowl" style="left:26%">🍲</span><span class="bowl" style="left:64%">🍲</span></div>');
  await wait(500);
  await N('Geli serves the purple concoction at the table.');
  await G('Go on, give it a taste! Be honest.');

  const t = await choose('What does Cheesecake do?', ['🥄 Eat it', '🤢 "Ew, this is disgusting."']);
  if (t === 1) {
    mood('cheese', 'ew');
    await C('Ew... this is disgusting.');
    mood('geli', 'shock');
    await G("...Excuse me? Then you won't mind finishing the WHOLE pot.");
    await gameOver({ text: "Geli forced the whole pot of purple goo down Cheesecake's throat. He died from too much nutrients.", effect: 'nutrient' });
  }

  await N('Cheesecake takes one very brave spoonful...');
  mood('cheese', 'shock');
  await wait(900);
  mood('cheese', 'happy');
  await C('Hmm... this is actually edible! Not bad!');
  mood('geli', 'happy'); pop('geli', '💜'); gain(4);
  await G('Yayyyy!');
  await fadeOut();
  goto('tbc');
};

/* END OF WHAT WE'VE BUILT SO FAR */
scenes.tbc = async () => {
  hud.classList.remove('hidden');
  setLevel('Stage 3 complete');
  stage.innerHTML = nightBG() + fireflies();
  await wait(600);
  overlay.className = 'show';
  overlay.innerHTML = `<div class="go-card"><h2 style="color:#6a4aa3">LEVEL CLEARED 💜</h2>
    <p style="font-size:1.4em;margin:.6em 0 1em">The story is just getting started...<br>To be continued!</p>
    <button id="again" class="big">Play again</button></div>`;
  $('#again').onclick = () => { Object.keys(checkpoints).forEach((k) => delete checkpoints[k]); progress = 0; startScene('title'); };
};

/* ---------- START ---------- */
// Tip for testing: add #lab, #stairs, #call, #invite, #costco, #exam, #hall, #friends, #dorm or #tbc to the web address to jump straight to that scene.
const startAt = { bbq: 0, lab: 8, stairs: 24, call: 32, invite: 48, costco: 56, exam: 65, hall: 69, friends: 73, dorm: 73, tbc: 85 };
const hash = location.hash.slice(1);
if (hash && scenes[hash] && hash !== 'title') {
  progress = startAt[hash] || 0;
  hud.classList.remove('hidden');
  goto(hash);
} else {
  startScene('title');
}
})();
