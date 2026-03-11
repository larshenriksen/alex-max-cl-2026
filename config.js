// ╔══════════════════════════════════════════════════════════════╗
// ║  CHAMPIONS LEAGUE 2025/26 — CONFIGURATION                  ║
// ║  Edit this file to update teams, matches, and results.      ║
// ╚══════════════════════════════════════════════════════════════╝

// ─── TEAMS ───
// Each team needs: name, short code, crest ID (from football-data.org), and two brand colors.
// Set crest to null if no logo is available (will show abbreviation instead).
const TEAMS = {
  psg:         { name: 'Paris Saint-Germain', short: 'PSG', crest: '524', colors: ['#004170','#DA291C'] },
  chelsea:     { name: 'Chelsea',             short: 'CHE', crest: '61',  colors: ['#034694','#DBA111'] },
  galatasaray: { name: 'Galatasaray',         short: 'GAL', crest: '548', colors: ['#ED1C24','#FF8C00'] },
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
// The bracket defines all matches and how they connect.
// R16 matches have fixed team arrays. Later rounds get their teams from predictions.
// "next" = which match the winner advances to.  "slot" = position in that next match (0 or 1).
const BRACKET = {
  // Round of 16 — Left side
  r16_1: { teams: ['psg',        'chelsea'],    round: 'r16', next: 'qf_1', slot: 0 },
  r16_2: { teams: ['galatasaray','liverpool'],  round: 'r16', next: 'qf_1', slot: 1 },
  r16_3: { teams: ['real_madrid','man_city'],   round: 'r16', next: 'qf_2', slot: 0 },
  r16_4: { teams: ['atalanta',   'bayern'],     round: 'r16', next: 'qf_2', slot: 1 },
  // Round of 16 — Right side
  r16_5: { teams: ['newcastle',  'barcelona'],  round: 'r16', next: 'qf_3', slot: 0 },
  r16_6: { teams: ['atletico',   'tottenham'],  round: 'r16', next: 'qf_3', slot: 1 },
  r16_7: { teams: ['bodo_glimt', 'sporting'],   round: 'r16', next: 'qf_4', slot: 0 },
  r16_8: { teams: ['leverkusen', 'arsenal'],    round: 'r16', next: 'qf_4', slot: 1 },
  // Quarter-finals
  qf_1:  { teams: [null, null], round: 'qf',    next: 'sf_1',  slot: 0 },
  qf_2:  { teams: [null, null], round: 'qf',    next: 'sf_1',  slot: 1 },
  qf_3:  { teams: [null, null], round: 'qf',    next: 'sf_2',  slot: 0 },
  qf_4:  { teams: [null, null], round: 'qf',    next: 'sf_2',  slot: 1 },
  // Semi-finals
  sf_1:  { teams: [null, null], round: 'sf',    next: 'final', slot: 0 },
  sf_2:  { teams: [null, null], round: 'sf',    next: 'final', slot: 1 },
  // Final
  final: { teams: [null, null], round: 'final', next: null,    slot: 0 },
};

// ─── LAYOUT ───
// Which matches go in each bracket column. Left side reads L→R, right side reads L→R.
const LAYOUT = {
  leftR16:  ['r16_1', 'r16_2', 'r16_3', 'r16_4'],
  leftQF:   ['qf_1', 'qf_2'],
  leftSF:   ['sf_1'],
  rightSF:  ['sf_2'],
  rightQF:  ['qf_3', 'qf_4'],
  rightR16: ['r16_5', 'r16_6', 'r16_7', 'r16_8'],
};

// ─── SCORING ───
// Points awarded per correct prediction in each round.
const POINTS = { r16: 1, qf: 2, sf: 3, final: 5 };

// ─── GROUPS ───
// The age groups available in the selector.
const GROUPS = ['U11', 'U8'];

// ─── ACTUAL RESULTS ───
// Fill in match winners as they happen. Use the team key (e.g., 'liverpool', 'bayern').
// The leaderboard will automatically calculate points based on these.
//
// Example:
//   RESULTS.r16_1 = 'chelsea';    // Chelsea beat PSG
//   RESULTS.r16_4 = 'bayern';     // Bayern beat Atalanta
//
const RESULTS = {
  // Round of 16
  // r16_1: '',   // PSG vs Chelsea
  // r16_2: '',   // Galatasaray vs Liverpool
  // r16_3: '',   // Real Madrid vs Man City
  // r16_4: '',   // Atalanta vs Bayern
  // r16_5: '',   // Newcastle vs Barcelona
  // r16_6: '',   // Atletico vs Tottenham
  // r16_7: '',   // Bodo/Glimt vs Sporting
  // r16_8: '',   // Leverkusen vs Arsenal

  // Quarter-finals
  // qf_1: '',
  // qf_2: '',
  // qf_3: '',
  // qf_4: '',

  // Semi-finals
  // sf_1: '',
  // sf_2: '',

  // Final
  // final: '',
};
