// ╔══════════════════════════════════════════════════════════════╗
// ║  CHAMPIONS LEAGUE 2025/26 — CONFIGURATION                  ║
// ║  Edit this file to update teams, matches, and results.      ║
// ╚══════════════════════════════════════════════════════════════╝

// ─── TEAMS ───
const TEAMS = {
  psg:         { name: 'Paris Saint-Germain', short: 'PSG', crest: '524', colors: ['#004170','#DA291C'] },
  chelsea:     { name: 'Chelsea',             short: 'CHE', crest: '61',  colors: ['#034694','#DBA111'] },
  galatasaray: { name: 'Galatasaray',         short: 'GAL', crest: '610', colors: ['#ED1C24','#FF8C00'] },
  liverpool:   { name: 'Liverpool',           short: 'LIV', crest: '64',  colors: ['#C8102E','#00B2A9'] },
  real_madrid: { name: 'Real Madrid',         short: 'RMA', crest: '86',  colors: ['#FEBE10','#00529F'] },
  man_city:    { name: 'Manchester City',     short: 'MCI', crest: '65',  colors: ['#6CABDD','#1C2C5B'] },
  atalanta:    { name: 'Atalanta',            short: 'ATA', crest: '102', colors: ['#1E71B8','#000000'] },
  bayern:      { name: 'Bayern München',      short: 'BAY', crest: '5',   colors: ['#DC052D','#0066B2'] },
  newcastle:   { name: 'Newcastle United',    short: 'NEW', crest: '67',  colors: ['#241F20','#ffffff'] },
  barcelona:   { name: 'FC Barcelona',        short: 'BAR', crest: '81',  colors: ['#A50044','#004D98'] },
  atletico:    { name: 'Atlético Madrid',     short: 'ATM', crest: '78',  colors: ['#CB3524','#272E61'] },
  tottenham:   { name: 'Tottenham Hotspur',   short: 'TOT', crest: '73',  colors: ['#132257','#ffffff'] },
  bodo_glimt:  { name: 'Bodø/Glimt',         short: 'BOD', crest: null,  colors: ['#FFD700','#000000'] },
  sporting:    { name: 'Sporting CP',         short: 'SCP', crest: '498', colors: ['#008848','#ffffff'] },
  leverkusen:  { name: 'Bayer Leverkusen',    short: 'LEV', crest: '3',   colors: ['#E32221','#000000'] },
  arsenal:     { name: 'Arsenal',             short: 'ARS', crest: '57',  colors: ['#EF0107','#063672'] },
};

// ─── BRACKET ───
const BRACKET = {
  r16_1: { teams: ['psg',        'chelsea'],    round: 'r16', next: 'qf_1', slot: 0 },
  r16_2: { teams: ['galatasaray','liverpool'],  round: 'r16', next: 'qf_1', slot: 1 },
  r16_3: { teams: ['real_madrid','man_city'],   round: 'r16', next: 'qf_2', slot: 0 },
  r16_4: { teams: ['atalanta',   'bayern'],     round: 'r16', next: 'qf_2', slot: 1 },
  r16_5: { teams: ['newcastle',  'barcelona'],  round: 'r16', next: 'qf_3', slot: 0 },
  r16_6: { teams: ['atletico',   'tottenham'],  round: 'r16', next: 'qf_3', slot: 1 },
  r16_7: { teams: ['bodo_glimt', 'sporting'],   round: 'r16', next: 'qf_4', slot: 0 },
  r16_8: { teams: ['leverkusen', 'arsenal'],    round: 'r16', next: 'qf_4', slot: 1 },
  qf_1:  { teams: [null, null], round: 'qf',    next: 'sf_1',  slot: 0 },
  qf_2:  { teams: [null, null], round: 'qf',    next: 'sf_1',  slot: 1 },
  qf_3:  { teams: [null, null], round: 'qf',    next: 'sf_2',  slot: 0 },
  qf_4:  { teams: [null, null], round: 'qf',    next: 'sf_2',  slot: 1 },
  sf_1:  { teams: [null, null], round: 'sf',    next: 'final', slot: 0 },
  sf_2:  { teams: [null, null], round: 'sf',    next: 'final', slot: 1 },
  final: { teams: [null, null], round: 'final', next: null,    slot: 0 },
};

// ─── LAYOUT ───
const LAYOUT = {
  leftR16:  ['r16_1', 'r16_2', 'r16_3', 'r16_4'],
  leftQF:   ['qf_1', 'qf_2'],
  leftSF:   ['sf_1'],
  rightSF:  ['sf_2'],
  rightQF:  ['qf_3', 'qf_4'],
  rightR16: ['r16_5', 'r16_6', 'r16_7', 'r16_8'],
};

// ─── SCORING ───
const POINTS = { r16: 1, qf: 2, sf: 3, final: 5 };

// ─── GROUPS ───
const GROUPS = ['U11', 'U8'];

// ─── FIREBASE (delt data på tværs af enheder) ───
// Opret et gratis Firebase-projekt og indsæt URL'en her.
// Se instruktioner i README eller spørg Claude.
// Sæt til null for at bruge localStorage alene (kun lokal).
const FIREBASE_URL = 'https://alex-og-max-cl-2026-default-rtdb.europe-west1.firebasedatabase.app';

// ─── DEADLINE ───
// Predictions lock at this time. Set to null to disable.
// Second legs start 17 March 2026 at 21:00 CET — lock 1 hour before.
const DEADLINE = '2026-03-17T20:00:00+01:00';

// ─── KICKOFF TIMES ───
// Used for LIVE badge. Format: ISO 8601. Each match ~105 min.
// R16 second legs: 17–18 March 2026. QF/SF/Final TBD.
const KICKOFFS = {
  r16_1: '2026-03-17T21:00:00+01:00',
  r16_2: '2026-03-17T21:00:00+01:00',
  r16_3: '2026-03-18T21:00:00+01:00',
  r16_4: '2026-03-18T21:00:00+01:00',
  r16_5: '2026-03-17T21:00:00+01:00',
  r16_6: '2026-03-17T21:00:00+01:00',
  r16_7: '2026-03-18T21:00:00+01:00',
  r16_8: '2026-03-18T21:00:00+01:00',
  // QF, SF, Final — update when scheduled
  // qf_1: '',
  // qf_2: '',
  // qf_3: '',
  // qf_4: '',
  // sf_1: '',
  // sf_2: '',
  // final: '',
};

// ─── ACTUAL RESULTS ───
// Filled in automatically by the GitHub Action, or manually.
// Use team key as value (e.g. 'liverpool', 'bayern').
const RESULTS = {
  // Round of 16
  r16_1: 'psg', // PSG vs Chelsea
  r16_2: 'liverpool', // Galatasaray vs Liverpool
  r16_3: 'real_madrid', // Real Madrid vs Man City
  r16_4: 'bayern', // Atalanta vs Bayern
  r16_5: 'barcelona', // Newcastle vs Barcelona
  r16_6: 'atletico', // Atletico vs Tottenham
  r16_7: 'sporting', // Bodo/Glimt vs Sporting
  r16_8: 'arsenal', // Leverkusen vs Arsenal
  // Quarter-finals
  // qf_1: '', // Quarter-final 1
  // qf_2: '', // Quarter-final 2
  // qf_3: '', // Quarter-final 3
  // qf_4: '', // Quarter-final 4
  // Semi-finals
  // sf_1: '', // Semi-final 1
  // sf_2: '', // Semi-final 2
  // Final
  // final: '', // Final
};

// ─── SCORES ───
// Aggregate scores for display in the bracket. Populated by the fetch script.
// Format: { matchId: { agg: [team1Goals, team2Goals], pen: [t1, t2] } }
// Team order matches the BRACKET teams array order.
const SCORES = {
  r16_2: { agg: [1, 4] },
  r16_4: { agg: [2, 10] },
  r16_5: { agg: [3, 8] },
  r16_6: { agg: [7, 5] },
  r16_8: { agg: [1, 3] },
  r16_1: { agg: [8, 2] },
  r16_3: { agg: [5, 1] },
  r16_7: { agg: [3, 5] },
};
