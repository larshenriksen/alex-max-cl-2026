// ═══════════════════════════════════════
// Champions League Prediction Game — App Logic
// Config is loaded from config.js (TEAMS, BRACKET, LAYOUT, POINTS, GROUPS, RESULTS)
// ═══════════════════════════════════════

const ALL_MATCHES = Object.keys(BRACKET);
const CREST_BASE = 'https://crests.football-data.org/';

// ─── State ───
let currentUser = { name: '', group: '' };
let predictions = {};
let selectedGroup = '';
let lbTab = GROUPS[0];
let adminClicks = 0;

// ─── Helpers ───
function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function crestURL(id) { return id ? CREST_BASE + id + '.png' : null; }

// ─── Derived state: get teams for a match based on predictions ───
function getMatchTeams(matchId) {
  const def = BRACKET[matchId];
  if (def.round === 'r16') return [...def.teams];
  const feeders = Object.entries(BRACKET).filter(([, m]) => m.next === matchId);
  const teams = [null, null];
  for (const [fid, fm] of feeders) {
    if (predictions[fid]) teams[fm.slot] = predictions[fid];
  }
  return teams;
}

// ─── Merge config results + admin localStorage results ───
function getEffectiveResults() {
  const adminResults = loadFromStorage('ucl_results', {});
  return { ...RESULTS, ...adminResults };
}

// ═══════════════════════════════════════
// PAGE NAVIGATION
// ═══════════════════════════════════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (id === 'bracket') {
    const userEl = document.getElementById('topnav-user');
    if (userEl) userEl.textContent = currentUser.name ? `${currentUser.name} (${currentUser.group})` : '';
    renderBracket();
  }
  if (id === 'leaderboard') renderLeaderboard();
}

// ═══════════════════════════════════════
// WELCOME
// ═══════════════════════════════════════
function selectGroup(g) {
  selectedGroup = g;
  document.querySelectorAll('.group-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.group === g)
  );
  checkStartReady();
}

function checkStartReady() {
  const name = document.getElementById('input-name').value.trim();
  document.getElementById('btn-start').disabled = !(name && selectedGroup);
}

function startPredictions() {
  const name = document.getElementById('input-name').value.trim();
  if (!name || !selectedGroup) return;
  currentUser = { name, group: selectedGroup };
  predictions = {};
  const existing = getSubmission(name, selectedGroup);
  if (existing) predictions = { ...existing.predictions };
  showPage('bracket');
}

document.getElementById('input-name').addEventListener('input', checkStartReady);

// ═══════════════════════════════════════
// BRACKET RENDERING
// ═══════════════════════════════════════
function renderBracket() {
  const root = document.getElementById('bracket');
  root.innerHTML = '';

  const left = el('div', 'bracket-side left');
  left.append(
    mkRound(LAYOUT.leftR16, true),
    mkRound(LAYOUT.leftQF),
    mkRound(LAYOUT.leftSF)
  );

  const right = el('div', 'bracket-side right');
  right.append(
    mkRound(LAYOUT.rightSF),
    mkRound(LAYOUT.rightQF),
    mkRound(LAYOUT.rightR16, true)
  );

  root.append(left, mkFinalCol(), right);
  updateSubmitButton();
}

function mkRound(ids, paired) {
  const roundName = BRACKET[ids[0]].round;
  const col = el('div', `bracket-round ${roundName}`);
  if (paired) {
    for (let i = 0; i < ids.length; i += 2) {
      const pair = el('div', 'match-pair');
      pair.append(mkMatch(ids[i]), mkMatch(ids[i + 1]));
      col.appendChild(pair);
    }
  } else {
    ids.forEach(id => col.appendChild(mkMatch(id)));
  }
  return col;
}

function mkFinalCol() {
  const col = el('div', 'bracket-round final-round');
  const area = el('div', 'champion-area');

  const trophy = el('span', 'trophy-icon');
  trophy.textContent = '🏆';
  area.appendChild(trophy);

  const champion = predictions['final'] || null;
  const cName = el('div', 'champion-name');
  cName.textContent = champion ? TEAMS[champion].name.toUpperCase() : '';
  area.appendChild(cName);

  if (champion) {
    const cLogo = document.createElement('img');
    cLogo.className = 'champion-logo visible';
    if (TEAMS[champion].crest) {
      cLogo.src = crestURL(TEAMS[champion].crest);
      cLogo.onerror = function () { this.style.display = 'none'; };
    }
    area.appendChild(cLogo);
  }

  col.appendChild(area);
  const card = mkMatch('final');
  card.appendChild(el('div', 'connector-right'));
  col.appendChild(card);
  return col;
}

function mkMatch(matchId) {
  const card = el('div', 'match-card');
  card.dataset.match = matchId;
  const teams = getMatchTeams(matchId);
  const winner = predictions[matchId];

  teams.forEach((tk, i) => {
    const row = el('div', 'team-row');
    if (!tk) {
      row.classList.add('empty');
      const fb = el('div', 'team-logo-fallback');
      fb.textContent = '?';
      fb.style.background = 'rgba(255,255,255,0.05)';
      row.appendChild(fb);
      const n = el('span', 'team-name');
      n.textContent = 'TBD';
      n.style.color = 'var(--text-muted)';
      row.appendChild(n);
    } else {
      const team = TEAMS[tk];
      if (winner === tk) row.classList.add('winner');
      else if (winner) row.classList.add('loser');

      if (team.crest) {
        const img = document.createElement('img');
        img.className = 'team-logo';
        img.src = crestURL(team.crest);
        img.alt = team.short;
        img.loading = 'lazy';
        img.onerror = function () { this.replaceWith(mkFallbackLogo(team)); };
        row.appendChild(img);
      } else {
        row.appendChild(mkFallbackLogo(team));
      }

      const n = el('span', 'team-name');
      n.textContent = team.short;
      row.appendChild(n);
      row.onclick = () => pickWinner(matchId, tk);
    }
    card.appendChild(row);
    if (i === 0) {
      const vs = el('div', 'vs-divider');
      vs.textContent = 'VS';
      card.appendChild(vs);
    }
  });
  return card;
}

function mkFallbackLogo(team) {
  const fb = el('div', 'team-logo-fallback');
  fb.textContent = team.short.substring(0, 3);
  fb.style.background = `linear-gradient(135deg,${team.colors[0]},${team.colors[1]})`;
  return fb;
}

// ═══════════════════════════════════════
// PREDICTION LOGIC
// ═══════════════════════════════════════
function pickWinner(matchId, teamKey) {
  const teams = getMatchTeams(matchId);
  if (!teams.includes(teamKey) || teams.includes(null)) return;
  if (predictions[matchId] === teamKey) return;

  const prev = predictions[matchId];
  predictions[matchId] = teamKey;

  if (prev && prev !== teamKey) {
    cascadeClear(BRACKET[matchId].next, prev);
  }

  renderBracket();
  if (matchId === 'final' && !prev) spawnConfetti();
}

function cascadeClear(matchId, oldTeam) {
  if (!matchId) return;
  if (predictions[matchId] === oldTeam) {
    const next = BRACKET[matchId].next;
    delete predictions[matchId];
    cascadeClear(next, oldTeam);
  }
}

function updateSubmitButton() {
  const count = ALL_MATCHES.filter(id => predictions[id]).length;
  const allPicked = count === ALL_MATCHES.length;
  document.getElementById('btn-submit').disabled = !allPicked;
  const info = document.getElementById('submit-info');
  if (allPicked) {
    info.textContent = `Alle ${count} kampe er valgt — klar til at indsende!`;
    info.className = 'submit-info submit-success';
  } else {
    info.textContent = `${count} af ${ALL_MATCHES.length} kampe valgt`;
    info.className = 'submit-info';
  }
}

// ═══════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════
function loadFromStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

function loadSubmissions() { return loadFromStorage('ucl_submissions', []); }

function getSubmission(name, group) {
  return loadSubmissions().find(s =>
    s.name.toLowerCase() === name.toLowerCase() && s.group === group
  );
}

function submitPredictions() {
  if (!ALL_MATCHES.every(id => predictions[id])) {
    showToast('Du mangler at vælge vinder i alle kampe!');
    return;
  }
  const subs = loadSubmissions();
  const idx = subs.findIndex(s =>
    s.name.toLowerCase() === currentUser.name.toLowerCase() && s.group === currentUser.group
  );
  if (idx !== -1) subs.splice(idx, 1);
  subs.push({
    name: currentUser.name,
    group: currentUser.group,
    predictions: { ...predictions },
    timestamp: Date.now()
  });
  localStorage.setItem('ucl_submissions', JSON.stringify(subs));
  showToast(`${currentUser.name} — dine forudsigelser er gemt!`);
  document.getElementById('submit-info').textContent = 'Forudsigelser gemt!';
  document.getElementById('submit-info').className = 'submit-info submit-success';
}

// ═══════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════
function switchLBTab(group) {
  lbTab = group;
  document.querySelectorAll('.lb-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.group === group)
  );
  renderLeaderboard();
}

function renderLeaderboard() {
  const container = document.getElementById('lb-container');
  const subs = loadSubmissions().filter(s => s.group === lbTab);
  const results = getEffectiveResults();
  const hasResults = Object.values(results).some(v => v);

  if (!subs.length) {
    container.innerHTML = `<div class="lb-empty">Ingen forudsigelser endnu for ${lbTab}</div>`;
    document.getElementById('lb-waiting').style.display = hasResults ? 'none' : 'block';
    return;
  }

  const scored = subs.map(s => {
    let points = 0, correct = 0;
    if (hasResults) {
      for (const mid of ALL_MATCHES) {
        if (results[mid] && s.predictions[mid] === results[mid]) {
          points += POINTS[BRACKET[mid].round];
          correct++;
        }
      }
    }
    return { ...s, points, correct };
  });
  scored.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  container.innerHTML = scored.map((s, i) => {
    const rc = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
    const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
    return `<div class="lb-entry ${rc}">
      <div class="lb-rank">${medal || (i + 1)}</div>
      <div class="lb-name">${esc(s.name)}</div>
      <div class="lb-points">
        ${hasResults ? s.points : '—'}
        <span class="lb-points-label">${hasResults ? s.correct + ' rigtige' : 'POINT'}</span>
      </div>
    </div>`;
  }).join('');

  document.getElementById('lb-waiting').style.display = hasResults ? 'none' : 'block';
}

// ═══════════════════════════════════════
// ADMIN — click leaderboard title 5× to open
// ═══════════════════════════════════════
function adminClick() {
  adminClicks++;
  if (adminClicks >= 5) {
    adminClicks = 0;
    const p = document.getElementById('admin-panel');
    p.classList.toggle('visible');
    if (p.classList.contains('visible')) renderAdmin();
  }
}

function renderAdmin() {
  const c = document.getElementById('admin-matches');
  const results = getEffectiveResults();
  c.innerHTML = '';
  ALL_MATCHES.forEach(mid => {
    const def = BRACKET[mid];
    let teams;
    if (def.round === 'r16') {
      teams = def.teams;
    } else {
      const feeders = Object.entries(BRACKET).filter(([, m]) => m.next === mid);
      teams = [null, null];
      feeders.forEach(([fid, fm]) => { if (results[fid]) teams[fm.slot] = results[fid]; });
    }
    const div = el('div', 'admin-match');
    const lbl = el('label', '');
    const rn = { r16: '1/8', qf: 'KF', sf: 'SF', final: 'Finale' }[def.round];
    lbl.textContent = `${rn}: ${teams[0] ? TEAMS[teams[0]].short : '?'} vs ${teams[1] ? TEAMS[teams[1]].short : '?'}`;
    div.appendChild(lbl);
    const sel = document.createElement('select');
    sel.dataset.match = mid;
    sel.innerHTML = '<option value="">—</option>';
    teams.forEach(tk => {
      if (tk) {
        const o = document.createElement('option');
        o.value = tk;
        o.textContent = TEAMS[tk].short;
        if (results[mid] === tk) o.selected = true;
        sel.appendChild(o);
      }
    });
    div.appendChild(sel);
    c.appendChild(div);
  });
}

function saveAdminResults() {
  const results = {};
  document.querySelectorAll('#admin-matches select').forEach(sel => {
    if (sel.value) results[sel.dataset.match] = sel.value;
  });
  localStorage.setItem('ucl_results', JSON.stringify(results));
  renderLeaderboard();
  renderAdmin();
  showToast('Resultater gemt!');
}

// ═══════════════════════════════════════
// EFFECTS
// ═══════════════════════════════════════
function spawnConfetti() {
  const colors = ['#d4a51a', '#f5d442', '#003899', '#2563eb', '#fff', '#c8102e'];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = (Math.random() * 100) + '%';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDelay = (Math.random() * 1.5) + 's';
    c.style.animationDuration = (Math.random() * 2 + 2) + 's';
    c.style.width = (Math.random() * 6 + 4) + 'px';
    c.style.height = (Math.random() * 8 + 6) + 'px';
    c.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4500);
  }
}

function showToast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = el('div', 'toast');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ═══════════════════════════════════════
// STARFIELD CANVAS
// ═══════════════════════════════════════
const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');
let stars = [];

function initStarfield() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const count = Math.min(180, Math.floor(canvas.width * canvas.height / 6000));
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.3 + 0.3,
    base: Math.random() * 0.4 + 0.15,
    speed: Math.random() * 0.003 + 0.001,
    phase: Math.random() * Math.PI * 2,
    gold: Math.random() < 0.12,
  }));
}

function drawStars(t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const g = ctx.createRadialGradient(
    canvas.width * .5, canvas.height * .3, 0,
    canvas.width * .5, canvas.height * .3, canvas.width * .8
  );
  g.addColorStop(0, 'rgba(0,56,153,0.05)');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const s of stars) {
    const op = s.base + Math.sin(t * s.speed + s.phase) * 0.2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = s.gold
      ? `rgba(212,165,26,${Math.max(0.06, op)})`
      : `rgba(200,210,230,${Math.max(0.04, op * 0.55)})`;
    ctx.fill();
  }
  requestAnimationFrame(drawStars);
}

window.addEventListener('resize', initStarfield);
initStarfield();
requestAnimationFrame(drawStars);
