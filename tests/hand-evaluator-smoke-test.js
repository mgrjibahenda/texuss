
// Optional local evaluator sanity test.
// Run with: node tests/hand-evaluator-smoke-test.js

const RANK_VALUE = Object.fromEntries(["2","3","4","5","6","7","8","9","T","J","Q","K","A"].map((r, i) => [r, i + 2]));

function cardValues(cards) {
  return cards.map(c => RANK_VALUE[c.rank]).sort((a, b) => b - a);
}

function uniqueDesc(values) {
  return [...new Set(values)].sort((a, b) => b - a);
}

function straightHigh(values) {
  const u = uniqueDesc(values);
  if (u.includes(14)) u.push(1);
  for (let i = 0; i <= u.length - 5; i++) {
    const slice = u.slice(i, i + 5);
    if (slice[0] - slice[4] === 4 && new Set(slice).size === 5) return slice[0] === 1 ? 5 : slice[0];
  }
  return null;
}

function evaluateSeven(cards) {
  const values = cardValues(cards);
  const groups = {};
  for (const v of values) groups[v] = (groups[v] || 0) + 1;
  const groupEntries = Object.entries(groups).map(([v, count]) => ({ v: Number(v), count }))
    .sort((a, b) => b.count - a.count || b.v - a.v);

  const suits = {};
  for (const c of cards) {
    if (!suits[c.suit]) suits[c.suit] = [];
    suits[c.suit].push(RANK_VALUE[c.rank]);
  }

  for (const suit of Object.keys(suits)) {
    if (suits[suit].length >= 5) {
      const high = straightHigh(suits[suit]);
      if (high) return { rank: 8, cn: high === 14 ? "皇家同花顺" : "同花顺", effect: high === 14 ? "royal" : "straightflush", tiebreak: [high] };
    }
  }

  const four = groupEntries.find(g => g.count === 4);
  if (four) return { rank: 7, cn: "四条", effect: "fourkind", tiebreak: [four.v, values.find(v => v !== four.v)] };

  const trips = groupEntries.filter(g => g.count === 3);
  const pairs = groupEntries.filter(g => g.count === 2);

  if (trips.length && (pairs.length || trips.length > 1)) return { rank: 6, cn: "葫芦", effect: "fullhouse", tiebreak: [trips[0].v, trips.length > 1 ? trips[1].v : pairs[0].v] };

  for (const suit of Object.keys(suits)) {
    if (suits[suit].length >= 5) return { rank: 5, cn: "同花", effect: "flush", tiebreak: uniqueDesc(suits[suit]).slice(0, 5) };
  }

  const straight = straightHigh(values);
  if (straight) return { rank: 4, cn: "顺子", effect: "straight", tiebreak: [straight] };

  if (trips.length) {
    const trip = trips[0].v;
    return { rank: 3, cn: "三条", effect: "threekind", tiebreak: [trip, ...values.filter(v => v !== trip).slice(0, 2)] };
  }

  if (pairs.length >= 2) {
    const topPairs = pairs.slice(0, 2).map(p => p.v);
    return { rank: 2, cn: "两对", effect: "twopair", tiebreak: [...topPairs, values.find(v => !topPairs.includes(v))] };
  }

  if (pairs.length === 1) {
    const pair = pairs[0].v;
    return { rank: 1, cn: "一对", effect: "onepair", tiebreak: [pair, ...values.filter(v => v !== pair).slice(0, 3)] };
  }

  return { rank: 0, cn: "高牌", effect: "highcard", tiebreak: values.slice(0, 5) };
}

function displayPersonalScore(holeCards, communityCards) {
  if (!holeCards || holeCards.length !== 2 || !communityCards || communityCards.length < 3) return null;
  const actual = evaluateSeven([...holeCards, ...communityCards]);
  const boardOnly = evaluateSeven(communityCards);
  if (!actual || actual.rank < 1) return null;
  if (actual.rank <= boardOnly.rank) return null;
  return { rank: actual.rank, cn: actual.cn, effect: actual.effect };
}

function card(rank, suit) { return { rank, suit, code: rank + suit }; }

const tests = [
  {
    name: "Board pair should not trigger personal made hand",
    hole: [card("A","♠"), card("K","♦")],
    board: [card("7","♠"), card("7","♥"), card("2","♦")],
    expect: null
  },
  {
    name: "Board two pair should not trigger personal made hand",
    hole: [card("A","♠"), card("K","♦")],
    board: [card("7","♠"), card("7","♥"), card("2","♦"), card("2","♣")],
    expect: null
  },
  {
    name: "Pocket pair should trigger one pair",
    hole: [card("A","♠"), card("A","♦")],
    board: [card("7","♠"), card("9","♥"), card("2","♦")],
    expect: "一对"
  },
  {
    name: "Hole card pairing board should trigger one pair",
    hole: [card("A","♠"), card("K","♦")],
    board: [card("A","♥"), card("9","♥"), card("2","♦")],
    expect: "一对"
  },
  {
    name: "Hole improves board pair to trips",
    hole: [card("7","♦"), card("K","♦")],
    board: [card("7","♠"), card("7","♥"), card("2","♦")],
    expect: "三条"
  },
  {
    name: "No made hand should not trigger",
    hole: [card("A","♠"), card("K","♦")],
    board: [card("7","♠"), card("9","♥"), card("2","♦")],
    expect: null
  }
];

let ok = true;
for (const t of tests) {
  const result = displayPersonalScore(t.hole, t.board);
  const got = result ? result.cn : null;
  if (got !== t.expect) {
    ok = false;
    console.error(`FAIL: ${t.name}. Expected ${t.expect}, got ${got}`);
  } else {
    console.log(`PASS: ${t.name}`);
  }
}

if (!ok) process.exitCode = 1;
