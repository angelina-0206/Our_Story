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

const wait = (ms) => {
  const t = token;
  return new Promise((res, rej) => setTimeout(() => (t === token ? res() : rej(new Cancel())), ms));
};

function say(who, text, narr = false) {
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
  return new Promise((res) => {
    dlg.className = ''; dlg.onclick = null;
    dlg.innerHTML = `<div class="text">${prompt}</div>`;
    ids.forEach((id) => {
      const el = actors[id].el;
      el.classList.add('pickable');
      el.onclick = () => {
        ids.forEach((i) => { actors[i].el.classList.remove('pickable'); actors[i].el.onclick = null; });
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
  }[effect] || '';
  const m = effect === 'flies' ? 'dead' : 'sad';
  overlay.className = 'show ' + effect;
  overlay.innerHTML = `<div class="go-card"><h2>${title}</h2><div class="go-stage"><div class="go-char">${person({ ...CHEESE, mood: m })}</div>${extra}</div><p>${text}</p><button id="retry" class="big">Try again</button></div>`;
  $('#retry').onclick = () => startScene(currentScene);
  return new Promise(() => {}); // never continues: the scene stops here
}

/* scene switching */
function goto(name) { checkpoints[name] = progress; startScene(name); }
function startScene(name) {
  token++;
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
           <path d="M21 62 L22 72 L29 62 Z M79 62 L78 72 L71 62 Z" fill="${hair}"/>`,
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
  }[m];

  const mouth = {
    smile: `<path d="M43 66 Q50 73 57 66" ${line}/>`,
    happy: `<path d="M42 65 Q50 77 58 65 Z" fill="#d9646c" stroke="#7a3b3b" stroke-width="1.5" stroke-linejoin="round"/>`,
    sad:   `<path d="M44 71 Q50 64 56 71" ${line}/>`,
    ew:    `<path d="M42 69 Q46 64 50 69 T58 69" ${line}/>`,
    shock: `<ellipse cx="50" cy="70" rx="4" ry="5" fill="#7a3b3b"/>`,
    dead:  `<path d="M43 70 L57 70" ${line}/>`,
  }[m];

  const blush = o.blush ? '<circle cx="34" cy="64" r="4" fill="#ff9db8" opacity=".5"/><circle cx="66" cy="64" r="4" fill="#ff9db8" opacity=".5"/>' : '';

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
    <circle cx="26" cy="54" r="4.5" fill="${skin}"/><circle cx="74" cy="54" r="4.5" fill="${skin}"/>
    <ellipse cx="50" cy="50" rx="24" ry="25" fill="${skin}"/>
    ${blush}${mole}${eyes}${mouth}${hairFront}
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
  await G('Hmm... I skate in my free time. I play the ukulele. And I do watercolour paintings!');
  mood('cheese', 'happy');
  await C("(She skates?! Ukulele?! Watercolour?! Oh damn she's so cool.)");
  await N('And the two kept walking, talking about everything and nothing...');
  moveTo('geli', 78, 36, 5); moveTo('cheese', 66, 36, 5);
  await wait(1200);
  actors.geli.el.style.opacity = 0; actors.cheese.el.style.opacity = 0;
  await wait(1500);
  await fadeOut();
  goto('tbc');
};

/* END OF WHAT WE'VE BUILT SO FAR */
scenes.tbc = async () => {
  hud.classList.remove('hidden');
  setLevel('Chapter 1 complete');
  stage.innerHTML = nightBG() + fireflies();
  await wait(600);
  overlay.className = 'show';
  overlay.innerHTML = `<div class="go-card"><h2 style="color:#6a4aa3">LEVEL CLEARED 💜</h2>
    <p style="font-size:1.4em;margin:.6em 0 1em">The story is just getting started...<br>To be continued!</p>
    <button id="again" class="big">Play again</button></div>`;
  $('#again').onclick = () => { Object.keys(checkpoints).forEach((k) => delete checkpoints[k]); progress = 0; startScene('title'); };
};

/* ---------- START ---------- */
// Tip for testing: add #lab, #stairs or #tbc to the web address to jump straight to that scene.
const startAt = { bbq: 0, lab: 8, stairs: 24, tbc: 32 };
const hash = location.hash.slice(1);
if (hash && scenes[hash] && hash !== 'title') {
  progress = startAt[hash] || 0;
  hud.classList.remove('hidden');
  goto(hash);
} else {
  startScene('title');
}
})();
