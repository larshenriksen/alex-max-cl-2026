#!/usr/bin/env node

// Fetches Champions League 2025-26 knockout results from football-data.org
// and updates the RESULTS object in config.js.
//
// Usage:
//   FOOTBALL_DATA_API_KEY=your_key node scripts/fetch-results.js
//
// Get a free API key at: https://www.football-data.org/client/register

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.football-data.org/v4';
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const CONFIG_PATH = path.join(__dirname, '..', 'config.js');

if (!API_KEY) {
  console.error('Missing FOOTBALL_DATA_API_KEY environment variable.');
  console.error('Get a free key at https://www.football-data.org/client/register');
  process.exit(1);
}

// ─── Team ID mapping (football-data.org ID → our team key) ───
const TEAM_ID_MAP = {
  524: 'psg', 61: 'chelsea',
  548: 'galatasaray', 610: 'galatasaray',  // 610 in match data, 548 for crests
  64: 'liverpool', 86: 'real_madrid', 65: 'man_city',
  102: 'atalanta', 5: 'bayern', 67: 'newcastle', 81: 'barcelona',
  78: 'atletico', 73: 'tottenham',
  498: 'sporting', 3: 'leverkusen', 57: 'arsenal',
};

// Name-based fallback for teams not in ID map (e.g. Bodø/Glimt)
const TEAM_NAME_PATTERNS = {
  'bodo': 'bodo_glimt', 'bodø': 'bodo_glimt', 'glimt': 'bodo_glimt',
};

function resolveTeamKey(teamId, teamName) {
  if (TEAM_ID_MAP[teamId]) return TEAM_ID_MAP[teamId];
  const lower = (teamName || '').toLowerCase();
  for (const [pattern, key] of Object.entries(TEAM_NAME_PATTERNS)) {
    if (lower.includes(pattern)) return key;
  }
  // Null teams are TBD placeholders for unplayed rounds — expected, not a warning
  if (teamId != null) console.warn(`Unknown team: id=${teamId} name="${teamName}"`);
  return null;
}

// ─── Our bracket structure ───
const R16_PAIRINGS = {
  r16_1: ['psg', 'chelsea'],
  r16_2: ['galatasaray', 'liverpool'],
  r16_3: ['real_madrid', 'man_city'],
  r16_4: ['atalanta', 'bayern'],
  r16_5: ['newcastle', 'barcelona'],
  r16_6: ['atletico', 'tottenham'],
  r16_7: ['bodo_glimt', 'sporting'],
  r16_8: ['leverkusen', 'arsenal'],
};

const BRACKET_FLOW = {
  r16_1: { next: 'qf_1', slot: 0 }, r16_2: { next: 'qf_1', slot: 1 },
  r16_3: { next: 'qf_2', slot: 0 }, r16_4: { next: 'qf_2', slot: 1 },
  r16_5: { next: 'qf_3', slot: 0 }, r16_6: { next: 'qf_3', slot: 1 },
  r16_7: { next: 'qf_4', slot: 0 }, r16_8: { next: 'qf_4', slot: 1 },
  qf_1: { next: 'sf_1', slot: 0 },  qf_2: { next: 'sf_1', slot: 1 },
  qf_3: { next: 'sf_2', slot: 0 },  qf_4: { next: 'sf_2', slot: 1 },
  sf_1: { next: 'final', slot: 0 }, sf_2: { next: 'final', slot: 1 },
};

const MATCH_COMMENTS = {
  r16_1: 'PSG vs Chelsea', r16_2: 'Galatasaray vs Liverpool',
  r16_3: 'Real Madrid vs Man City', r16_4: 'Atalanta vs Bayern',
  r16_5: 'Newcastle vs Barcelona', r16_6: 'Atletico vs Tottenham',
  r16_7: 'Bodo/Glimt vs Sporting', r16_8: 'Leverkusen vs Arsenal',
  qf_1: 'Quarter-final 1', qf_2: 'Quarter-final 2',
  qf_3: 'Quarter-final 3', qf_4: 'Quarter-final 4',
  sf_1: 'Semi-final 1', sf_2: 'Semi-final 2', final: 'Final',
};

// ─── API fetching ───
async function fetchMatches() {
  const url = `${API_BASE}/competitions/CL/matches?season=2025`;
  console.log(`Fetching: ${url}`);
  const res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return (await res.json()).matches || [];
}

// ─── Group API matches into two-legged ties ───
function groupIntoTies(matches) {
  const ties = {};
  for (const match of matches) {
    const homeKey = resolveTeamKey(match.homeTeam.id, match.homeTeam.name);
    const awayKey = resolveTeamKey(match.awayTeam.id, match.awayTeam.name);
    if (!homeKey || !awayKey) continue;

    const tieId = [match.stage, ...[homeKey, awayKey].sort()].join('|');
    if (!ties[tieId]) ties[tieId] = { stage: match.stage, teams: [homeKey, awayKey].sort(), legs: [] };
    ties[tieId].legs.push(match);
  }
  return Object.values(ties);
}

// ─── Determine the winner of a tie ───
function determineTieWinner(tie) {
  const { stage, teams, legs } = tie;
  const finished = legs.filter(m => m.status === 'FINISHED');

  // Final is a single match
  if (stage === 'FINAL') {
    if (finished.length < 1) return null;
    return matchWinner(finished[0]);
  }

  // Two-legged ties need both legs finished
  if (finished.length < 2) return null;

  // Calculate aggregate using regularTime (excludes penalties) if available
  const agg = {};
  teams.forEach(t => agg[t] = 0);

  for (const m of finished) {
    const hk = resolveTeamKey(m.homeTeam.id, m.homeTeam.name);
    const ak = resolveTeamKey(m.awayTeam.id, m.awayTeam.name);
    const score = m.score.regularTime || m.score.fullTime;
    if (!score) continue;
    agg[hk] += score.home;
    agg[ak] += score.away;
  }

  if (agg[teams[0]] !== agg[teams[1]]) {
    return agg[teams[0]] > agg[teams[1]] ? teams[0] : teams[1];
  }

  // Aggregate tied → extra time is in fullTime, recount with fullTime
  const aggFull = {};
  teams.forEach(t => aggFull[t] = 0);
  for (const m of finished) {
    const hk = resolveTeamKey(m.homeTeam.id, m.homeTeam.name);
    const ak = resolveTeamKey(m.awayTeam.id, m.awayTeam.name);
    aggFull[hk] += m.score.fullTime.home;
    aggFull[ak] += m.score.fullTime.away;
  }
  if (aggFull[teams[0]] !== aggFull[teams[1]]) {
    return aggFull[teams[0]] > aggFull[teams[1]] ? teams[0] : teams[1];
  }

  // Still tied → penalties in the second leg
  const secondLeg = finished.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))[1];
  if (secondLeg.score.penalties) {
    const hk = resolveTeamKey(secondLeg.homeTeam.id, secondLeg.homeTeam.name);
    const ak = resolveTeamKey(secondLeg.awayTeam.id, secondLeg.awayTeam.name);
    return secondLeg.score.penalties.home > secondLeg.score.penalties.away ? hk : ak;
  }

  console.warn(`Cannot determine winner for ${teams.join(' vs ')}`);
  return null;
}

function matchWinner(m) {
  const hk = resolveTeamKey(m.homeTeam.id, m.homeTeam.name);
  const ak = resolveTeamKey(m.awayTeam.id, m.awayTeam.name);
  if (m.score.penalties) {
    return m.score.penalties.home > m.score.penalties.away ? hk : ak;
  }
  const s = m.score.fullTime;
  if (s.home > s.away) return hk;
  if (s.away > s.home) return ak;
  return null; // draw — shouldn't happen in a final
}

// ─── Map a tie to our bracket match ID ───
function findBracketMatchId(stage, teamA, teamB, resolvedResults) {
  // R16: match by known pairings
  if (stage === 'LAST_16') {
    for (const [mid, pair] of Object.entries(R16_PAIRINGS)) {
      if (pair.includes(teamA) && pair.includes(teamB)) return mid;
    }
    return null;
  }

  // Later rounds: find which bracket slot these teams landed in
  const stageIds = {
    'QUARTER_FINALS': ['qf_1', 'qf_2', 'qf_3', 'qf_4'],
    'SEMI_FINALS': ['sf_1', 'sf_2'],
    'FINAL': ['final'],
  };
  const candidates = stageIds[stage];
  if (!candidates) return null;

  for (const mid of candidates) {
    const feeders = Object.entries(BRACKET_FLOW).filter(([, v]) => v.next === mid);
    const expected = [null, null];
    for (const [fid, { slot }] of feeders) {
      if (resolvedResults[fid]) expected[slot] = resolvedResults[fid];
    }
    if (expected.includes(teamA) && expected.includes(teamB)) return mid;
  }
  return null;
}

// ─── Calculate aggregate score for a tie, ordered by our bracket pairing ───
function getTieScore(tie, matchId) {
  const finished = tie.legs.filter(m => m.status === 'FINISHED');
  if (finished.length === 0) return null;

  // Get bracket team order
  const bracketTeams = R16_PAIRINGS[matchId] || null;

  // Calculate total goals per team
  const goals = {};
  tie.teams.forEach(t => goals[t] = 0);
  for (const m of finished) {
    const hk = resolveTeamKey(m.homeTeam.id, m.homeTeam.name);
    const ak = resolveTeamKey(m.awayTeam.id, m.awayTeam.name);
    const score = m.score.fullTime;
    if (!score) continue;
    goals[hk] = (goals[hk] || 0) + score.home;
    goals[ak] = (goals[ak] || 0) + score.away;
  }

  // Order by bracket pairing if available, otherwise alphabetical
  const ordered = bracketTeams || tie.teams;
  const result = { agg: [goals[ordered[0]] || 0, goals[ordered[1]] || 0] };

  // Check for penalties
  const secondLeg = finished.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)).pop();
  if (secondLeg && secondLeg.score.penalties) {
    const hk = resolveTeamKey(secondLeg.homeTeam.id, secondLeg.homeTeam.name);
    const ak = resolveTeamKey(secondLeg.awayTeam.id, secondLeg.awayTeam.name);
    const penMap = { [hk]: secondLeg.score.penalties.home, [ak]: secondLeg.score.penalties.away };
    result.pen = [penMap[ordered[0]] || 0, penMap[ordered[1]] || 0];
  }

  return result;
}

// ─── Write results back to config.js ───
function updateConfigFile(results, scores) {
  let content = fs.readFileSync(CONFIG_PATH, 'utf-8');

  // Build RESULTS block
  const lines = ['const RESULTS = {'];
  const rounds = [
    ['Round of 16', ['r16_1','r16_2','r16_3','r16_4','r16_5','r16_6','r16_7','r16_8']],
    ['Quarter-finals', ['qf_1','qf_2','qf_3','qf_4']],
    ['Semi-finals', ['sf_1','sf_2']],
    ['Final', ['final']],
  ];
  for (const [roundName, matchIds] of rounds) {
    lines.push(`  // ${roundName}`);
    for (const mid of matchIds) {
      const comment = MATCH_COMMENTS[mid];
      if (results[mid]) {
        lines.push(`  ${mid}: '${results[mid]}', // ${comment}`);
      } else {
        lines.push(`  // ${mid}: '', // ${comment}`);
      }
    }
  }
  lines.push('};');
  const resultsBlock = lines.join('\n');

  // Build SCORES block
  const sLines = ['const SCORES = {'];
  for (const [mid, sc] of Object.entries(scores)) {
    if (sc.pen) {
      sLines.push(`  ${mid}: { agg: [${sc.agg[0]}, ${sc.agg[1]}], pen: [${sc.pen[0]}, ${sc.pen[1]}] },`);
    } else {
      sLines.push(`  ${mid}: { agg: [${sc.agg[0]}, ${sc.agg[1]}] },`);
    }
  }
  sLines.push('};');
  const scoresBlock = sLines.join('\n');

  // Replace both blocks
  const resultsRegex = /const RESULTS = \{[\s\S]*?\};/;
  const scoresRegex = /const SCORES = \{[\s\S]*?\};/;

  if (!resultsRegex.test(content)) { console.error('Cannot find RESULTS in config.js'); process.exit(1); }
  if (!scoresRegex.test(content)) { console.error('Cannot find SCORES in config.js'); process.exit(1); }

  content = content.replace(resultsRegex, resultsBlock);
  content = content.replace(scoresRegex, scoresBlock);

  fs.writeFileSync(CONFIG_PATH, content);
  console.log('config.js updated.');
}

// ─── Main ───
async function main() {
  console.log('Fetching Champions League 2025-26 knockout results...\n');

  const allMatches = await fetchMatches();
  const knockoutStages = ['LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];
  const knockoutMatches = allMatches.filter(m => knockoutStages.includes(m.stage));

  console.log(`Found ${knockoutMatches.length} knockout-phase matches in API.\n`);

  if (knockoutMatches.length === 0) {
    console.log('No knockout matches found yet. Nothing to update.');
    return;
  }

  const ties = groupIntoTies(knockoutMatches);
  const results = {};
  const scores = {};

  // Process stages in order so later rounds can look up earlier results
  for (const stage of knockoutStages) {
    for (const tie of ties.filter(t => t.stage === stage)) {
      const winner = determineTieWinner(tie);
      if (!winner) continue;
      const mid = findBracketMatchId(stage, tie.teams[0], tie.teams[1], results);
      if (mid) {
        results[mid] = winner;
        const sc = getTieScore(tie, mid);
        if (sc) scores[mid] = sc;
        console.log(`  ${mid}: ${winner} (${tie.teams.join(' vs ')}) ${sc ? sc.agg.join('-') : ''}`);
      } else {
        console.warn(`  Could not map tie to bracket: ${tie.teams.join(' vs ')} (${stage})`);
      }
    }
  }

  if (Object.keys(results).length === 0) {
    console.log('\nNo completed ties yet. config.js unchanged.');
    return;
  }

  console.log(`\nUpdating config.js with ${Object.keys(results).length} result(s)...`);
  updateConfigFile(results, scores);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
