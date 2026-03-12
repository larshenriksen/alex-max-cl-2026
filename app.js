// ═══════════════════════════════════════
// Champions League Prediction Game — App Logic
// Config: TEAMS, BRACKET, LAYOUT, POINTS, GROUPS, DEADLINE, RESULTS, SCORES
// ═══════════════════════════════════════

const ALL_MATCHES = Object.keys(BRACKET);
const CREST_BASE = 'https://crests.football-data.org/';

// ─── State ───
let currentUser = { name: '', group: '', avatar: '' };
let predictions = {};
let selectedGroup = '';
let selectedAvatar = '';
let lbTab = GROUPS[0];
let adminClicks = 0;
let hasSubmitted = false;

// ─── Helpers ───
function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function crestURL(id) { return id ? CREST_BASE + id + '.png' : null; }

// ─── Haptic feedback ───
function haptic() {
  if (navigator.vibrate) navigator.vibrate(12);
}

// ─── Live match detection ───
function isMatchLive(matchId) {
  if (typeof KICKOFFS === 'undefined' || !KICKOFFS[matchId]) return false;
  const ko = new Date(KICKOFFS[matchId]).getTime();
  const now = Date.now();
  // Live = between kickoff and ~120 min after (covers extra time)
  return now >= ko && now <= ko + 120 * 60000;
}

// ─── Deadline ───
function isLocked() {
  if (!DEADLINE) return false;
  return Date.now() > new Date(DEADLINE).getTime();
}

// ─── Countdown Timer ───
let _countdownInterval = null;
function updateCountdown() {
  const cdEl = document.getElementById('countdown');
  if (!cdEl || !DEADLINE) return;
  const diff = new Date(DEADLINE).getTime() - Date.now();
  if (diff <= 0) {
    cdEl.textContent = 'Deadline er udløbet!';
    cdEl.classList.add('expired');
    if (_countdownInterval) { clearInterval(_countdownInterval); _countdownInterval = null; }
    return;
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  parts.push(`${h}t`, `${m}m`, `${s}s`);
  cdEl.textContent = parts.join(' ');
}
if (DEADLINE) { updateCountdown(); _countdownInterval = setInterval(updateCountdown, 1000); }

// ─── Derived state ───
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

function getEffectiveResults() {
  const adminResults = _fbResults || loadFromStorage('ucl_results', {});
  return { ...RESULTS, ...adminResults };
}

// ─── Popular picks (% of all submissions that picked each team) ───
function getPopularPicks() {
  const subs = loadSubmissions();
  if (subs.length < 2) return {};
  const picks = {};
  for (const mid of ALL_MATCHES) {
    const counts = {};
    let total = 0;
    for (const s of subs) {
      const p = s.predictions[mid];
      if (p) { counts[p] = (counts[p] || 0) + 1; total++; }
    }
    if (total > 0) {
      picks[mid] = {};
      for (const [tk, cnt] of Object.entries(counts)) {
        picks[mid][tk] = Math.round((cnt / total) * 100);
      }
    }
  }
  return picks;
}

// ═══════════════════════════════════════
// PAGE NAVIGATION
// ═══════════════════════════════════════
let _lbRefreshInterval = null;
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (id === 'bracket') {
    const userEl = document.getElementById('topnav-user');
    if (userEl) userEl.textContent = currentUser.name ? `${currentUser.name} (${currentUser.group})` : '';
    renderBracket();
  }
  // Auto-refresh leaderboard every 30s while viewing it
  if (_lbRefreshInterval) { clearInterval(_lbRefreshInterval); _lbRefreshInterval = null; }
  if (id === 'leaderboard') {
    renderLeaderboard();
    if (useFirebase) {
      refreshFromFirebase().then(() => renderLeaderboard());
      _lbRefreshInterval = setInterval(() => {
        refreshFromFirebase().then(() => renderLeaderboard());
      }, 30000);
    }
  }
  if (id === 'stats') {
    renderStats();
  }
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

function selectAvatar(teamKey) {
  selectedAvatar = teamKey;
  document.querySelectorAll('.avatar-option').forEach(a =>
    a.classList.toggle('selected', a.dataset.team === teamKey)
  );
}

function checkStartReady() {
  const name = document.getElementById('input-name').value.trim();
  document.getElementById('btn-start').disabled = !(name && selectedGroup);
}

async function startPredictions() {
  const name = document.getElementById('input-name').value.trim();
  if (!name || !selectedGroup) return;
  currentUser = { name, group: selectedGroup, avatar: selectedAvatar };
  predictions = {};

  // Refresh from Firebase before loading existing submission
  if (useFirebase) await refreshFromFirebase();

  const existing = getSubmission(name, selectedGroup);
  if (existing) {
    predictions = { ...existing.predictions };
    hasSubmitted = true;
    if (existing.avatar) {
      currentUser.avatar = existing.avatar;
      selectedAvatar = existing.avatar;
    }
  } else {
    hasSubmitted = false;
  }

  // Persist user identity so we can skip welcome on reload
  localStorage.setItem('ucl_current_user', JSON.stringify(currentUser));

  showPage('bracket');
}

// Auto-restore returning user
async function tryRestoreUser() {
  const saved = loadFromStorage('ucl_current_user', null);
  if (!saved || !saved.name || !saved.group) return;

  currentUser = saved;
  selectedGroup = saved.group;
  selectedAvatar = saved.avatar || '';

  if (useFirebase) await refreshFromFirebase();

  const existing = getSubmission(saved.name, saved.group);
  if (existing) {
    predictions = { ...existing.predictions };
    hasSubmitted = true;
    if (existing.avatar) {
      currentUser.avatar = existing.avatar;
      selectedAvatar = existing.avatar;
    }
  } else {
    hasSubmitted = false;
  }

  showPage('bracket');
}

document.getElementById('input-name').addEventListener('input', checkStartReady);

// ═══════════════════════════════════════
// BRACKET RENDERING
// ═══════════════════════════════════════
function renderBracket() {
  const root = document.getElementById('bracket');
  root.innerHTML = '';
  const locked = isLocked() || hasSubmitted;
  const results = getEffectiveResults();
  const popular = getPopularPicks();

  const left = el('div', 'bracket-side left');
  left.append(
    mkRound(LAYOUT.leftR16, true, locked, results, popular),
    mkRound(LAYOUT.leftQF, false, locked, results, popular),
    mkRound(LAYOUT.leftSF, false, locked, results, popular)
  );

  const right = el('div', 'bracket-side right');
  right.append(
    mkRound(LAYOUT.rightSF, false, locked, results, popular),
    mkRound(LAYOUT.rightQF, false, locked, results, popular),
    mkRound(LAYOUT.rightR16, true, locked, results, popular)
  );

  root.append(left, mkFinalCol(locked, results, popular), right);
  updateSubmitButton(locked);

  // Show lock banner only for deadline, not for already-submitted
  const lockBanner = document.getElementById('lock-banner');
  if (lockBanner) lockBanner.style.display = isLocked() ? 'block' : 'none';

  // Also render mobile view
  renderMobileBracket();
}

function mkRound(ids, paired, locked, results, popular) {
  const roundName = BRACKET[ids[0]].round;
  const col = el('div', `bracket-round ${roundName}`);
  if (paired) {
    for (let i = 0; i < ids.length; i += 2) {
      const pair = el('div', 'match-pair');
      pair.append(mkMatch(ids[i], locked, results, popular), mkMatch(ids[i + 1], locked, results, popular));
      col.appendChild(pair);
    }
  } else {
    ids.forEach(id => col.appendChild(mkMatch(id, locked, results, popular)));
  }
  return col;
}

function mkFinalCol(locked, results, popular) {
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
  const card = mkMatch('final', locked, results, popular);
  card.appendChild(el('div', 'connector-right'));
  col.appendChild(card);
  return col;
}

function mkMatch(matchId, locked, results, popular) {
  const card = el('div', 'match-card');
  card.dataset.match = matchId;
  const teams = getMatchTeams(matchId);
  const winner = predictions[matchId];
  const actualWinner = results[matchId];
  const score = typeof SCORES !== 'undefined' ? SCORES[matchId] : null;
  const matchPop = popular[matchId];
  const live = isMatchLive(matchId);

  if (live) card.classList.add('match-live');

  // If there's an actual result, show the score instead of VS
  const hasScore = score && score.agg;

  teams.forEach((tk, i) => {
    const row = el('div', 'team-row');
    if (locked) row.classList.add('locked');

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

      // Winner/loser styling
      if (winner === tk) row.classList.add('winner');
      else if (winner) row.classList.add('loser');

      // If actual result exists, mark correct/wrong
      if (actualWinner && winner) {
        if (winner === tk && winner === actualWinner) row.classList.add('correct');
        else if (winner === tk && winner !== actualWinner) row.classList.add('wrong');
      }

      // Actual winner from results (green indicator)
      if (actualWinner === tk) row.classList.add('actual-winner');

      // Logo
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

      // Score display
      if (hasScore) {
        const sc = el('span', 'score-badge');
        sc.textContent = score.agg[i];
        row.appendChild(sc);
        if (score.pen) {
          const pen = el('span', 'pen-badge');
          pen.textContent = `(${score.pen[i]})`;
          row.appendChild(pen);
        }
      }

      // Popular pick percentage
      if (matchPop && matchPop[tk]) {
        const pct = el('span', 'pop-pct');
        pct.textContent = matchPop[tk] + '%';
        row.appendChild(pct);
      }

      if (!locked) {
        row.onclick = () => pickWinner(matchId, tk);
      }
    }
    card.appendChild(row);
    if (i === 0) {
      const vs = el('div', 'vs-divider');
      if (live) {
        vs.textContent = 'LIVE';
        vs.classList.add('live-badge');
      } else if (hasScore) {
        vs.textContent = '–';
        vs.classList.add('has-score');
      } else {
        vs.textContent = 'VS';
      }
      card.appendChild(vs);
    }
  });
  return card;
}

// ─── Mobile round-by-round view ───
let _mobileRound = 'all';
function setMobileRound(round) {
  _mobileRound = round;
  document.querySelectorAll('.mobile-round-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.round === round)
  );
  renderMobileBracket();
}

let _prevMobileRound = 'all';
function renderMobileBracket() {
  const container = document.getElementById('mobile-matches');
  if (!container) return;
  // On desktop, hide mobile view
  if (window.innerWidth > 700) { container.innerHTML = ''; return; }

  const locked = isLocked() || hasSubmitted;
  const results = getEffectiveResults();
  const popular = getPopularPicks();
  const roundNames = { r16: '1/8-Finale', qf: 'Kvartfinale', sf: 'Semifinale', final: 'Finale' };

  // Animate transition when switching rounds
  const roundChanged = _prevMobileRound !== _mobileRound;
  _prevMobileRound = _mobileRound;
  if (roundChanged) {
    container.classList.remove('mobile-slide-in');
    // Force reflow to restart animation
    void container.offsetWidth;
    container.classList.add('mobile-slide-in');
  }

  container.innerHTML = '';

  const rounds = _mobileRound === 'all' ? ['r16', 'qf', 'sf', 'final'] : [_mobileRound];
  for (const round of rounds) {
    const ids = ALL_MATCHES.filter(m => BRACKET[m].round === round);
    const label = el('div', 'mobile-round-label');
    label.textContent = roundNames[round];
    container.appendChild(label);
    const grid = el('div', 'mobile-matches-grid');
    for (const mid of ids) {
      grid.appendChild(mkMatch(mid, locked, results, popular));
    }
    container.appendChild(grid);
  }

  // Champion display for final
  if (rounds.includes('final') && predictions['final']) {
    const champ = el('div', 'mobile-champion');
    const team = TEAMS[predictions['final']];
    champ.innerHTML = `<span class="trophy-icon" style="font-size:36px">🏆</span>
      <div class="champion-name">${team.name.toUpperCase()}</div>`;
    container.appendChild(champ);
  }
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
  if (isLocked() || hasSubmitted) return;
  const teams = getMatchTeams(matchId);
  if (!teams.includes(teamKey) || teams.includes(null)) return;
  if (predictions[matchId] === teamKey) return;

  haptic();

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

function updateSubmitButton(locked) {
  const count = ALL_MATCHES.filter(id => predictions[id]).length;
  const allPicked = count === ALL_MATCHES.length;
  const btn = document.getElementById('btn-submit');
  const info = document.getElementById('submit-info');
  const progressWrap = document.getElementById('progress-bar-wrap');
  const progressBar = document.getElementById('progress-bar');

  // Update progress bar
  const pct = (count / ALL_MATCHES.length) * 100;
  if (progressBar) progressBar.style.width = pct + '%';
  if (progressWrap) progressWrap.style.display = (hasSubmitted || locked) ? 'none' : 'block';

  if (hasSubmitted) {
    btn.disabled = true;
    btn.textContent = 'ALLEREDE INDSENDT';
    info.textContent = 'Dine forudsigelser er låst — du kan se dem, men ikke ændre';
    info.className = 'submit-info submit-success';
    return;
  }

  if (locked) {
    btn.disabled = true;
    btn.textContent = 'DEADLINE UDLØBET';
    info.textContent = 'Det er ikke længere muligt at ændre forudsigelser';
    info.className = 'submit-info';
    return;
  }

  btn.textContent = 'INDSEND FORUDSIGELSER';
  btn.disabled = !allPicked;
  if (allPicked) {
    info.textContent = `Alle ${count} kampe er valgt — klar til at indsende!`;
    info.className = 'submit-info submit-success';
  } else {
    info.textContent = `${count} af ${ALL_MATCHES.length} kampe valgt`;
    info.className = 'submit-info';
  }
}

// ═══════════════════════════════════════
// PERSISTENCE (localStorage + Firebase)
// ═══════════════════════════════════════
const useFirebase = typeof FIREBASE_URL !== 'undefined' && FIREBASE_URL;

// In-memory cache for Firebase data
let _fbSubmissions = null;
let _fbResults = null;

function loadFromStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

// ─── Firebase REST helpers ───
async function fbPut(path, data) {
  if (!useFirebase) return;
  await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function fbGet(path) {
  if (!useFirebase) return null;
  const res = await fetch(`${FIREBASE_URL}/${path}.json`);
  if (!res.ok) return null;
  return await res.json();
}

// ─── Submissions ───
function subKey(name, group) {
  return (name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '__' + group).substring(0, 80);
}

function loadSubmissions() {
  if (_fbSubmissions) return Object.values(_fbSubmissions);
  return loadFromStorage('ucl_submissions', []);
}

function getSubmission(name, group) {
  return loadSubmissions().find(s =>
    s.name.toLowerCase() === name.toLowerCase() && s.group === group
  );
}

async function refreshFromFirebase() {
  if (!useFirebase) return;
  try {
    const [subs, res] = await Promise.all([
      fbGet('submissions'),
      fbGet('results'),
    ]);
    if (subs) {
      _fbSubmissions = subs;
      // Sync to localStorage as cache
      localStorage.setItem('ucl_submissions', JSON.stringify(Object.values(subs)));
    }
    if (res) {
      _fbResults = res;
      localStorage.setItem('ucl_results', JSON.stringify(res));
    }
    // Flush any queued offline submissions
    flushOfflineQueue();
  } catch (e) {
    console.warn('Firebase sync failed, using localStorage:', e);
  }
  updatePlayerCount();
}

function updatePlayerCount() {
  const el = document.getElementById('player-count');
  if (!el) return;
  const count = loadSubmissions().length;
  if (count > 0) {
    el.textContent = `${count} spiller${count === 1 ? '' : 'e'} har allerede indsendt!`;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function submitPredictions() {
  if (isLocked()) { showToast('Deadline er udløbet!'); return; }
  if (!ALL_MATCHES.every(id => predictions[id])) {
    showToast('Du mangler at vælge vinder i alle kampe!');
    return;
  }
  // Show confirmation dialog
  document.getElementById('confirm-overlay').classList.add('visible');
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('visible');
}

function confirmSubmit() {
  closeConfirm();

  const entry = {
    name: currentUser.name,
    group: currentUser.group,
    avatar: currentUser.avatar,
    predictions: { ...predictions },
    timestamp: Date.now()
  };

  // Save to localStorage
  const subs = loadFromStorage('ucl_submissions', []);
  const idx = subs.findIndex(s =>
    s.name.toLowerCase() === currentUser.name.toLowerCase() && s.group === currentUser.group
  );
  if (idx !== -1) subs.splice(idx, 1);
  subs.push(entry);
  localStorage.setItem('ucl_submissions', JSON.stringify(subs));

  // Save to Firebase (with offline queue fallback)
  if (useFirebase) {
    const key = subKey(currentUser.name, currentUser.group);
    fbPut('submissions/' + key, entry)
      .then(() => {
        // Clear from offline queue on success
        removeFromOfflineQueue(key);
      })
      .catch(e => {
        console.warn('Firebase save failed, queuing for retry:', e);
        addToOfflineQueue(key, entry);
      });
    // Update cache
    if (!_fbSubmissions) _fbSubmissions = {};
    _fbSubmissions[key] = entry;
  }

  hasSubmitted = true;
  spawnConfetti();
  showToast(`${currentUser.name} — dine forudsigelser er gemt!`);
  renderBracket();
}

// ─── Offline Queue ───
function addToOfflineQueue(key, entry) {
  const queue = loadFromStorage('ucl_offline_queue', {});
  queue[key] = entry;
  localStorage.setItem('ucl_offline_queue', JSON.stringify(queue));
}

function removeFromOfflineQueue(key) {
  const queue = loadFromStorage('ucl_offline_queue', {});
  delete queue[key];
  localStorage.setItem('ucl_offline_queue', JSON.stringify(queue));
}

async function flushOfflineQueue() {
  if (!useFirebase) return;
  const queue = loadFromStorage('ucl_offline_queue', {});
  const keys = Object.keys(queue);
  if (!keys.length) return;
  for (const key of keys) {
    try {
      await fbPut('submissions/' + key, queue[key]);
      removeFromOfflineQueue(key);
    } catch (e) {
      // Still offline, stop trying
      break;
    }
  }
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
    const avatarHTML = s.avatar && TEAMS[s.avatar]
      ? (TEAMS[s.avatar].crest
          ? `<img class="lb-avatar" src="${crestURL(TEAMS[s.avatar].crest)}" alt="${TEAMS[s.avatar].short}" onerror="this.style.display='none'">`
          : `<div class="lb-avatar-fb" style="background:linear-gradient(135deg,${TEAMS[s.avatar].colors[0]},${TEAMS[s.avatar].colors[1]})">${TEAMS[s.avatar].short.substring(0,2)}</div>`)
      : '<div class="lb-avatar-fb" style="background:rgba(255,255,255,0.08)">?</div>';

    return `<div class="lb-entry ${rc}" onclick="showUserPicks('${esc(s.name).replace(/'/g, "\\'")}', '${s.group}')" style="cursor:pointer" title="Klik for at se ${esc(s.name)}s forudsigelser">
      <div class="lb-rank">${medal || (i + 1)}</div>
      ${avatarHTML}
      <div class="lb-name">${esc(s.name)}</div>
      <div class="lb-points">
        <span class="lb-points-value" data-target="${s.points}">${hasResults ? 0 : '—'}</span>
        <span class="lb-points-label">${hasResults ? s.correct + ' rigtige' : 'POINT'}</span>
      </div>
    </div>`;
  }).join('');

  document.getElementById('lb-waiting').style.display = hasResults ? 'none' : 'block';

  // Animate points counting up
  if (hasResults) animatePoints();
}

function animatePoints() {
  document.querySelectorAll('.lb-points-value[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target);
    if (isNaN(target) || target === 0) { el.textContent = '0'; return; }
    let current = 0;
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      current = Math.round(eased * target);
      el.textContent = current;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// ═══════════════════════════════════════
// VIEW OTHER USER'S PICKS
// ═══════════════════════════════════════
function showUserPicks(name, group) {
  const sub = getSubmission(name, group);
  if (!sub) { showToast('Ingen forudsigelser fundet'); return; }

  const results = getEffectiveResults();
  const hasResults = Object.values(results).some(v => v);
  let points = 0, correct = 0;
  if (hasResults) {
    for (const mid of ALL_MATCHES) {
      if (results[mid] && sub.predictions[mid] === results[mid]) {
        points += POINTS[BRACKET[mid].round];
        correct++;
      }
    }
  }

  const roundNames = { r16: '1/8-Finale', qf: 'Kvartfinale', sf: 'Semifinale', final: 'Finale' };
  const rounds = ['r16', 'qf', 'sf', 'final'];

  let html = `<div class="picks-modal-overlay" onclick="closePicksModal(event)">
    <div class="picks-modal">
      <button class="picks-close" onclick="closePicksModal(event)">&times;</button>
      <div class="picks-header">
        <h3>${esc(name)}</h3>
        <span class="picks-group">${group}</span>
        ${hasResults ? `<span class="picks-score">${points} point — ${correct} rigtige</span>` : ''}
      </div>
      <div class="picks-list">`;

  for (const round of rounds) {
    const matchIds = ALL_MATCHES.filter(m => BRACKET[m].round === round);
    html += `<div class="picks-round-label">${roundNames[round]}</div>`;
    for (const mid of matchIds) {
      const pick = sub.predictions[mid];
      const actual = results[mid];
      const team = pick && TEAMS[pick] ? TEAMS[pick] : null;
      let cls = '';
      if (actual && pick) {
        cls = pick === actual ? 'pick-correct' : 'pick-wrong';
      }

      // Show matchup context
      let matchup = '';
      const def = BRACKET[mid];
      if (def.round === 'r16') {
        matchup = def.teams.map(t => TEAMS[t].short).join(' vs ');
      } else {
        // For later rounds, show the two possible teams from predictions
        const feeders = Object.entries(BRACKET).filter(([, m]) => m.next === mid);
        const t = [null, null];
        feeders.forEach(([fid, fm]) => { if (sub.predictions[fid]) t[fm.slot] = sub.predictions[fid]; });
        matchup = t.map(tk => tk ? TEAMS[tk].short : '?').join(' vs ');
      }

      // Show actual winner when pick is wrong
      let actualHTML = '';
      if (cls === 'pick-wrong' && actual && TEAMS[actual]) {
        const at = TEAMS[actual];
        const aCrest = at.crest
          ? `<img class="pick-crest" src="${crestURL(at.crest)}" onerror="this.style.display='none'">`
          : `<div class="pick-crest-fb" style="background:linear-gradient(135deg,${at.colors[0]},${at.colors[1]})">${at.short.substring(0,2)}</div>`;
        actualHTML = `<span class="pick-actual">${aCrest} ${at.short}</span>`;
      }

      if (team) {
        const crestImg = team.crest
          ? `<img class="pick-crest" src="${crestURL(team.crest)}" onerror="this.style.display='none'">`
          : `<div class="pick-crest-fb" style="background:linear-gradient(135deg,${team.colors[0]},${team.colors[1]})">${team.short.substring(0,2)}</div>`;
        html += `<div class="pick-row ${cls}">
          <span class="pick-matchup">${matchup}</span>
          <span class="pick-arrow">→</span>
          ${crestImg}
          <span class="pick-team">${team.short}</span>
          ${actualHTML}
        </div>`;
      } else {
        html += `<div class="pick-row pick-empty">
          <span class="pick-matchup">${matchup}</span>
          <span class="pick-arrow">→</span>
          <span class="pick-team">?</span>
        </div>`;
      }
    }
  }

  html += `</div></div></div>`;

  // Remove any existing modal
  document.querySelectorAll('.picks-modal-overlay').forEach(m => m.remove());
  document.body.insertAdjacentHTML('beforeend', html);
}

function showMyPicks() {
  const saved = loadFromStorage('ucl_current_user', null);
  if (!saved || !saved.name) {
    showToast('Log ind først for at se dine picks');
    return;
  }
  showUserPicks(saved.name, saved.group);
}

function closePicksModal(e) {
  if (e.target.classList.contains('picks-modal-overlay') || e.target.classList.contains('picks-close')) {
    document.querySelectorAll('.picks-modal-overlay').forEach(m => m.remove());
  }
}

// ═══════════════════════════════════════
// STATS — WHO PICKED WHAT
// ═══════════════════════════════════════
let _statsRound = 'r16';
function switchStatsRound(round) {
  _statsRound = round;
  document.querySelectorAll('.stats-round-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.round === round)
  );
  renderStats();
}

function renderStats() {
  const container = document.getElementById('stats-container');
  if (!container) return;
  const subs = loadSubmissions();
  const results = getEffectiveResults();
  const roundNames = { r16: '1/8-Finale', qf: 'Kvartfinale', sf: 'Semifinale', final: 'Finale' };

  if (subs.length === 0) {
    container.innerHTML = '<div class="lb-empty">Ingen forudsigelser endnu</div>';
    return;
  }

  const matchIds = ALL_MATCHES.filter(m => BRACKET[m].round === _statsRound);
  let html = '';

  for (const mid of matchIds) {
    const def = BRACKET[mid];
    let teamKeys;
    if (def.round === 'r16') {
      teamKeys = [...def.teams];
    } else {
      // For later rounds, use results to determine teams
      const feeders = Object.entries(BRACKET).filter(([, m]) => m.next === mid);
      teamKeys = [null, null];
      feeders.forEach(([fid, fm]) => { if (results[fid]) teamKeys[fm.slot] = results[fid]; });
    }

    // Count picks per team
    const counts = {};
    let total = 0;
    for (const s of subs) {
      const p = s.predictions[mid];
      if (p) { counts[p] = (counts[p] || 0) + 1; total++; }
    }

    const actual = results[mid];

    // Matchup label
    const t1 = teamKeys[0] && TEAMS[teamKeys[0]] ? TEAMS[teamKeys[0]].short : '?';
    const t2 = teamKeys[1] && TEAMS[teamKeys[1]] ? TEAMS[teamKeys[1]].short : '?';

    html += `<div class="stats-match">
      <div class="stats-matchup">${t1} vs ${t2}</div>`;

    // Show bar for each team that was picked
    const allPicked = Object.keys(counts);
    // Sort: most picked first
    allPicked.sort((a, b) => (counts[b] || 0) - (counts[a] || 0));

    for (const tk of allPicked) {
      if (!TEAMS[tk]) continue;
      const team = TEAMS[tk];
      const cnt = counts[tk];
      const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
      const isActual = actual === tk;
      const barCls = isActual ? 'stats-bar-correct' : '';
      const crestImg = team.crest
        ? `<img class="stats-bar-crest" src="${crestURL(team.crest)}" onerror="this.style.display='none'">`
        : `<div class="stats-bar-crest-fb" style="background:linear-gradient(135deg,${team.colors[0]},${team.colors[1]})">${team.short.substring(0,2)}</div>`;

      html += `<div class="stats-bar-row">
        <div class="stats-bar-team">${crestImg} <span>${team.short}</span></div>
        <div class="stats-bar-track">
          <div class="stats-bar-fill ${barCls}" style="width:${pct}%"></div>
        </div>
        <div class="stats-bar-pct">${pct}% <span class="stats-bar-cnt">(${cnt})</span></div>
      </div>`;
    }

    html += `</div>`;
  }

  container.innerHTML = html;
}

// ═══════════════════════════════════════
// ADMIN
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
        o.value = tk; o.textContent = TEAMS[tk].short;
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

  // Save to Firebase
  if (useFirebase) {
    fbPut('results', results).catch(e => console.warn('Firebase save failed:', e));
    _fbResults = results;
  }

  renderLeaderboard(); renderAdmin();
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
  const t = el('div', 'toast'); t.textContent = msg;
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

// ═══════════════════════════════════════
// AUTO-RESTORE & LOGOUT
// ═══════════════════════════════════════
function logoutUser() {
  localStorage.removeItem('ucl_current_user');
  currentUser = { name: '', group: '', avatar: '' };
  predictions = {};
  hasSubmitted = false;
  selectedGroup = '';
  selectedAvatar = '';
  document.getElementById('input-name').value = '';
  document.querySelectorAll('.group-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.avatar-option').forEach(a => a.classList.remove('selected'));
  checkStartReady();
  showPage('welcome');
}

// Try to restore user on page load
tryRestoreUser().then(() => {
  // If no user was restored, fetch player count for the welcome page
  if (!currentUser.name && useFirebase) {
    refreshFromFirebase().then(() => updatePlayerCount());
  }
});
