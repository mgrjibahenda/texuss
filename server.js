const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 5000,
  pingTimeout: 7000
});
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const rooms = new Map();

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[crypto.randomInt(chars.length)];
  return code;
}

function cleanName(raw) {
  return String(raw || "Player").trim().slice(0, 18) || "Player";
}

function displayCard(card) {
  if (!card || !card.rank) return card;
  return {
    ...card,
    display: (card.rank === "T" ? "10" : card.rank) + card.suit
  };
}

function displayScore(score) {
  if (!score) return null;
  return {
    rank: score.rank,
    name: score.name,
    cn: score.cn,
    effect: score.effect
  };
}


function displayPersonalScore(holeCards, communityCards) {
  // This is only for the private "你开出了..." hint.
  // It deliberately does NOT count board-only hands.
  // Example: if the board is 7♠ 7♥ A♦, everyone technically has one pair,
  // but we should not tell every player "you made a pair".
  if (!holeCards || holeCards.length !== 2 || !communityCards || communityCards.length < 3) return null;

  const actual = evaluateSeven([...holeCards, ...communityCards]);
  const boardOnly = evaluateSeven(communityCards);

  // Only show a made-hand hint if the player's hole cards improve the board-only hand.
  // Same hand category with only better kicker is not enough for a flashy "you made X" message.
  if (!actual || actual.rank < 1) return null;
  if (actual.rank <= boardOnly.rank) return null;

  return displayScore(actual);
}


function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ rank, suit, code: rank + suit });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function createRoom(hostId, hostName) {
  let code;
  do code = makeRoomCode(); while (rooms.has(code));

  const room = {
    code,
    hostId,
    players: [{
      id: hostId,
      name: hostName,
      chips: 1000,
      bet: 0,
      totalCommitted: 0,
      hand: [],
      folded: false,
      allIn: false,
      connected: true,
      lastScore: null
    }],
    started: false,
    deck: [],
    community: [],
    pot: 0,
    dealerIndex: 0,
    turnIndex: 0,
    currentBet: 0,
    minRaise: 20,
    phase: "lobby",
    message: "Waiting for players.",
    smallBlind: 10,
    bigBlind: 20,
    actedThisRound: new Set(),
    winners: [],
    potBreakdown: [],
    busted: [],
    finalWinner: null,
    handNumber: 0,
    lastAction: "",
    actionSeq: 0,
    emotes: []
  };

  rooms.set(code, room);
  return room;
}


function playerActionState(room, player) {
  if (!player) {
    return {
      canAct: false,
      reason: "You are not in this room.",
      callAmount: 0,
      minRaiseTo: 0,
      currentPlayerName: room.players[room.turnIndex]?.name || ""
    };
  }

  const currentPlayer = room.players[room.turnIndex];
  const callAmount = Math.max(0, room.currentBet - player.bet);
  const minRaiseTo = Math.max(room.currentBet + room.minRaise, player.bet + callAmount + room.minRaise);

  if (room.phase === "lobby") {
    return { canAct: false, reason: "等待开始", callAmount, minRaiseTo, currentPlayerName: currentPlayer?.name || "" };
  }
  if (room.phase === "showdown") {
    return { canAct: false, reason: "本局结束", callAmount, minRaiseTo, currentPlayerName: currentPlayer?.name || "" };
  }
  if (player.folded) {
    return { canAct: false, reason: "你已弃牌", callAmount, minRaiseTo, currentPlayerName: currentPlayer?.name || "" };
  }
  if (player.allIn) {
    return { canAct: false, reason: "你已经 All-in，等待开牌", callAmount, minRaiseTo, currentPlayerName: currentPlayer?.name || "" };
  }
  if (player.chips <= 0) {
    return { canAct: false, reason: "你没有筹码", callAmount, minRaiseTo, currentPlayerName: currentPlayer?.name || "" };
  }
  if (!currentPlayer || currentPlayer.id !== player.id) {
    return {
      canAct: false,
      reason: `等待 ${currentPlayer?.name || "其他玩家"} 行动`,
      callAmount,
      minRaiseTo,
      currentPlayerName: currentPlayer?.name || ""
    };
  }

  return {
    canAct: true,
    reason: "轮到你行动",
    callAmount,
    minRaiseTo,
    currentPlayerName: currentPlayer?.name || ""
  };
}

function publicRoom(room, viewerId) {
  return {
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    community: room.community.map(displayCard),
    pot: room.pot,
    dealerIndex: room.dealerIndex,
    turnIndex: room.turnIndex,
    currentBet: room.currentBet,
    minRaise: room.minRaise,
    phase: room.phase,
    message: room.message,
    smallBlind: room.smallBlind,
    bigBlind: room.bigBlind,
    winners: room.winners,
    potBreakdown: room.potBreakdown || [],
    busted: room.busted,
    finalWinner: room.finalWinner,
    handNumber: room.handNumber,
    lastAction: room.lastAction,
    actionSeq: room.actionSeq || 0,
    emotes: room.emotes || [],
    players: room.players.map((p, idx) => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      bet: p.bet,
      totalCommitted: p.totalCommitted,
      hand: p.id === viewerId || room.phase === "showdown"
        ? p.hand.map(displayCard)
        : p.hand.map(() => ({ code: "BACK", display: "🂠" })),
      folded: p.folded,
      allIn: p.allIn,
      connected: p.connected,
      seat: idx,
      isYou: p.id === viewerId,
      currentScore: p.id === viewerId && !p.folded && p.hand.length === 2 && room.community.length >= 3 && room.phase !== "showdown"
        ? displayPersonalScore(p.hand, room.community)
        : null,
      actionState: p.id === viewerId ? playerActionState(room, p) : null
    }))
  };
}

function emitRoom(room) {
  for (const p of room.players) {
    io.to(p.id).emit("state", publicRoom(room, p.id));
  }
}

function nextSeatedWithChips(room, fromIndex) {
  const n = room.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    if (room.players[idx].chips > 0) return idx;
  }
  return -1;
}

function nextIndex(room, fromIndex) {
  const n = room.players.length;
  if (!n) return -1;
  for (let step = 1; step <= n; step++) {
    const idx = (((fromIndex ?? -1) + step) % n + n) % n;
    const p = room.players[idx];
    if (canAct(p)) return idx;
  }
  return -1;
}




function canAct(player) {
  return !!player && !player.folded && !player.allIn && player.chips > 0;
}

function stillInPlayers(room) {
  return room.players.filter(p => !p.folded && p.hand && p.hand.length === 2);
}

function activePlayers(room) {
  return room.players.filter(p => !p.folded);
}

function playersAbleToAct(room) {
  return room.players.filter(canAct);
}



function takeChips(player, amount) {
  const actual = Math.max(0, Math.min(player.chips, amount));
  player.chips -= actual;
  player.bet += actual;
  player.totalCommitted += actual;
  if (player.chips === 0) player.allIn = true;
  return actual;
}

function startHand(room) {
  const eligible = room.players.filter(p => p.chips > 0);
  if (eligible.length < 2) {
    room.message = "Need at least 2 players with chips.";
    return;
  }

  room.handNumber += 1;
  room.started = true;
  room.phase = "preflop";
  room.deck = makeDeck();
  room.community = [];
  room.pot = 0;
  room.currentBet = 0;
  room.minRaise = room.bigBlind;
  room.actedThisRound = new Set();
  room.winners = [];
  room.potBreakdown = [];
  room.busted = [];
  room.finalWinner = null;
  room.lastAction = "";
  room.actionSeq = (room.actionSeq || 0) + 1;

  for (const p of room.players) {
    p.hand = [];
    p.bet = 0;
    p.totalCommitted = 0;
    p.folded = p.chips <= 0;
    p.allIn = false;
    p.lastScore = null;
    p.lastActionAt = 0;
  }

  // Move dealer button to a player who has chips.
  if (room.dealerIndex < 0 || room.dealerIndex >= room.players.length || room.players[room.dealerIndex].chips <= 0) {
    const nextDealer = nextSeatedWithChips(room, room.dealerIndex);
    room.dealerIndex = nextDealer < 0 ? 0 : nextDealer;
  }

  for (let r = 0; r < 2; r++) {
    for (const p of room.players) {
      if (!p.folded) p.hand.push(room.deck.pop());
    }
  }

  const eligibleCount = room.players.filter(p => p.chips > 0).length;
  let sbIndex;
  let bbIndex;

  if (eligibleCount === 2) {
    // Heads-up: dealer/button is small blind and acts first preflop.
    sbIndex = room.dealerIndex;
    bbIndex = nextSeatedWithChips(room, sbIndex);
  } else {
    sbIndex = nextSeatedWithChips(room, room.dealerIndex);
    bbIndex = nextSeatedWithChips(room, sbIndex);
  }

  if (sbIndex < 0 || bbIndex < 0 || sbIndex === bbIndex) {
    room.message = "Need at least 2 players with chips.";
    return;
  }

  const sb = room.players[sbIndex];
  const bb = room.players[bbIndex];
  const sbPaid = takeChips(sb, room.smallBlind);
  const bbPaid = takeChips(bb, room.bigBlind);

  room.currentBet = Math.max(sb.bet, bb.bet);
  room.minRaise = room.bigBlind;

  // Preflop action:
  // 2 players: small blind/dealer acts first.
  // 3+ players: first live player left of big blind acts first.
  room.turnIndex = eligibleCount === 2 ? sbIndex : nextIndex(room, bbIndex);
  if (room.turnIndex < 0) return runOutBoardAndFinish(room);

  room.message = `${sb.name} posts small blind (${sbPaid}), ${bb.name} posts big blind (${bbPaid}).`;
  room.lastAction = `Hand ${room.handNumber} begins.`;
}



function allBetsMatchedOrAllIn(room) {
  const able = playersAbleToAct(room);
  if (able.length === 0) return true;

  for (const p of able) {
    if (p.bet < room.currentBet) return false;
    if (!room.actedThisRound.has(p.id)) return false;
  }
  return true;
}




function dealNextStreet(room) {
  if (room.phase === "preflop") {
    room.phase = "flop";
    while (room.community.length < 3) room.community.push(room.deck.pop());
    room.lastAction = "Flop dealt.";
    return true;
  }

  if (room.phase === "flop") {
    room.phase = "turn";
    while (room.community.length < 4) room.community.push(room.deck.pop());
    room.lastAction = "Turn dealt.";
    return true;
  }

  if (room.phase === "turn") {
    room.phase = "river";
    while (room.community.length < 5) room.community.push(room.deck.pop());
    room.lastAction = "River dealt.";
    return true;
  }

  return false;
}

function runOutBoardAndFinish(room) {
  collectOutstandingBets(room);
  while (room.community.length < 5 && ["preflop", "flop", "turn"].includes(room.phase)) {
    dealNextStreet(room);
  }
  return finishHand(room);
}


function endBettingRound(room) {
  collectOutstandingBets(room);

  if (activePlayers(room).length <= 1) return finishHand(room);

  if (room.phase === "river") {
    return finishHand(room);
  }

  room.currentBet = 0;
  room.minRaise = room.bigBlind;
  room.actedThisRound = new Set();

  dealNextStreet(room);
  room.message = room.lastAction;
  room.actionSeq = (room.actionSeq || 0) + 1;

  // If all remaining players are all-in, deal to river and finish.
  if (playersAbleToAct(room).length === 0) {
    return runOutBoardAndFinish(room);
  }

  // Postflop: first live player left of dealer/button acts first.
  room.turnIndex = nextIndex(room, room.dealerIndex);
  if (room.turnIndex < 0) return runOutBoardAndFinish(room);
}



function afterAction(room) {
  if (activePlayers(room).length <= 1) return finishHand(room);

  if (playersAbleToAct(room).length === 0) {
    return runOutBoardAndFinish(room);
  }

  if (allBetsMatchedOrAllIn(room)) {
    return endBettingRound(room);
  }

  const next = nextIndex(room, room.turnIndex);
  if (next >= 0) {
    room.turnIndex = next;
    return;
  }

  return runOutBoardAndFinish(room);
}




function playersInHand(room) {
  return room.players.filter(p => p.hand && p.hand.length === 2 && p.totalCommitted > 0);
}

function buildSidePots(room) {
  const levels = [...new Set(playersInHand(room)
    .map(p => p.totalCommitted)
    .filter(v => v > 0))]
    .sort((a, b) => a - b);

  const pots = [];
  let lower = 0;

  for (const upper of levels) {
    const contributors = playersInHand(room).filter(p => p.totalCommitted > lower);
    const eligible = contributors.filter(p => !p.folded && p.totalCommitted >= upper);
    const amount = (upper - lower) * contributors.length;

    if (amount > 0 && eligible.length > 0) {
      pots.push({ amount, lower, upper, eligible });
    }

    lower = upper;
  }

  return pots;
}

function evaluateRemainingPlayers(room) {
  for (const p of room.players) p.lastScore = null;

  const remaining = room.players.filter(p => !p.folded && p.hand && p.hand.length === 2);
  if (remaining.length === 1) {
    remaining[0].lastScore = {
      name: "Fold Win",
      cn: "弃牌胜利",
      rank: -1,
      effect: "foldwin",
      tiebreak: []
    };
    return;
  }

  for (const p of remaining) {
    p.lastScore = evaluateSeven([...p.hand, ...room.community]);
  }
}

function winnersForPot(eligible) {
  let best = null;
  let winners = [];

  for (const p of eligible) {
    const score = p.lastScore;
    if (!score) continue;

    if (!best || compareScore(score, best) > 0) {
      best = score;
      winners = [p];
    } else if (compareScore(score, best) === 0) {
      winners.push(p);
    }
  }

  return { winners, best };
}

function awardSidePots(room) {
  evaluateRemainingPlayers(room);

  const pots = buildSidePots(room);
  const awardMap = new Map();
  const potBreakdown = [];

  for (const pot of pots) {
    const { winners, best } = winnersForPot(pot.eligible);
    if (!winners.length) continue;

    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount % winners.length;

    winners.forEach((w, idx) => {
      const amount = share + (idx < remainder ? 1 : 0);
      w.chips += amount;
      awardMap.set(w.id, (awardMap.get(w.id) || 0) + amount);
    });

    potBreakdown.push({
      amount: pot.amount,
      winners: winners.map(w => w.name),
      handNameCn: best?.cn || "弃牌胜利",
      eligible: pot.eligible.map(p => p.name)
    });
  }

  const winners = [...awardMap.entries()]
    .map(([id, amount]) => {
      const player = room.players.find(p => p.id === id);
      return { player, amount };
    })
    .filter(x => x.player)
    .sort((a, b) => b.amount - a.amount);

  return { winners, potBreakdown };
}

function showdownMessage(room, winners) {
  if (!winners.length) return "No winner.";
  if (winners.length === 1) {
    const w = winners[0].player;
    return `${w.name} wins ${winners[0].amount} with ${w.lastScore?.cn || "弃牌胜利"}.`;
  }
  return winners.map(x => `${x.player.name} +${x.amount}`).join(", ");
}


function finishHand(room) {
  collectOutstandingBets(room);
  room.phase = "showdown";

  // If everyone except one player folded, side-pot logic still works:
  // all pots are awarded only to the remaining eligible player(s).
  const active = room.players.filter(p => !p.folded);
  if (active.length === 1) {
    active[0].lastScore = {
      name: "Fold Win",
      cn: "弃牌胜利",
      rank: -1,
      effect: "foldwin",
      tiebreak: []
    };
  }

  const { winners, potBreakdown } = awardSidePots(room);
  room.potBreakdown = potBreakdown;

  room.winners = winners.map(({ player, amount }) => ({
    id: player.id,
    name: player.name,
    amount,
    handName: player.lastScore?.name || "Fold Win",
    handNameCn: player.lastScore?.cn || "弃牌胜利",
    effect: player.lastScore?.effect || "foldwin",
    rank: player.lastScore?.rank ?? -1
  }));

  room.message = showdownMessage(room, winners);

  room.busted = room.players
    .filter(p => p.chips <= 0)
    .map(p => ({ id: p.id, name: p.name }));

  const survivors = room.players.filter(p => p.chips > 0);
  if (survivors.length === 1 && room.players.length > 1) {
    room.finalWinner = {
      id: survivors[0].id,
      name: survivors[0].name,
      chips: survivors[0].chips
    };
    room.message = `${survivors[0].name} is the final winner.`;
  } else {
    room.finalWinner = null;
  }

  room.pot = 0;
  room.currentBet = 0;
  room.minRaise = room.bigBlind;
  room.actedThisRound = new Set();
  room.lastAction = room.finalWinner ? "Final winner decided." : "Showdown complete.";
  room.actionSeq = (room.actionSeq || 0) + 1;

  const nextDealer = nextSeatedWithChips(room, room.dealerIndex);
  room.dealerIndex = nextDealer < 0 ? 0 : nextDealer;
}

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
      if (high) return {
        rank: 8,
        tiebreak: [high],
        name: high === 14 ? "Royal Flush" : "Straight Flush",
        cn: high === 14 ? "皇家同花顺" : "同花顺",
        effect: high === 14 ? "royal" : "straightflush"
      };
    }
  }

  const four = groupEntries.find(g => g.count === 4);
  if (four) return { rank: 7, tiebreak: [four.v, values.find(v => v !== four.v)], name: "Four of a Kind", cn: "四条", effect: "fourkind" };

  const trips = groupEntries.filter(g => g.count === 3);
  const pairs = groupEntries.filter(g => g.count === 2);

  if (trips.length && (pairs.length || trips.length > 1)) {
    return { rank: 6, tiebreak: [trips[0].v, trips.length > 1 ? trips[1].v : pairs[0].v], name: "Full House", cn: "葫芦", effect: "fullhouse" };
  }

  for (const suit of Object.keys(suits)) {
    if (suits[suit].length >= 5) return { rank: 5, tiebreak: uniqueDesc(suits[suit]).slice(0, 5), name: "Flush", cn: "同花", effect: "flush" };
  }

  const straight = straightHigh(values);
  if (straight) return { rank: 4, tiebreak: [straight], name: "Straight", cn: "顺子", effect: "straight" };

  if (trips.length) {
    const trip = trips[0].v;
    return { rank: 3, tiebreak: [trip, ...values.filter(v => v !== trip).slice(0, 2)], name: "Three of a Kind", cn: "三条", effect: "threekind" };
  }

  if (pairs.length >= 2) {
    const topPairs = pairs.slice(0, 2).map(p => p.v);
    return { rank: 2, tiebreak: [...topPairs, values.find(v => !topPairs.includes(v))], name: "Two Pair", cn: "两对", effect: "twopair" };
  }

  if (pairs.length === 1) {
    const pair = pairs[0].v;
    return { rank: 1, tiebreak: [pair, ...values.filter(v => v !== pair).slice(0, 3)], name: "One Pair", cn: "一对", effect: "onepair" };
  }

  return { rank: 0, tiebreak: values.slice(0, 5), name: "High Card", cn: "高牌", effect: "highcard" };
}

function compareScore(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreak[i] || 0;
    const bv = b.tiebreak[i] || 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function findPlayerRoom(socketId) {
  for (const room of rooms.values()) {
    const p = room.players.find(x => x.id === socketId);
    if (p) return { room, player: p };
  }
  return null;
}


function resetHandToLobbyAfterDisconnect(room, disconnectedName) {
  for (const p of room.players) {
    if (p.totalCommitted) p.chips += p.totalCommitted;
    p.bet = 0;
    p.totalCommitted = 0;
    p.hand = [];
    p.folded = p.chips <= 0;
    p.allIn = false;
    p.lastScore = null;
  }
  room.started = false;
  room.deck = [];
  room.community = [];
  room.pot = 0;
  room.currentBet = 0;
  room.minRaise = room.bigBlind;
  room.phase = "lobby";
  room.actedThisRound = new Set();
  room.winners = [];
  room.potBreakdown = [];
  room.busted = [];
  room.finalWinner = null;
  room.message = `${disconnectedName} disconnected and was kicked. Hand cancelled. Start a new hand.`;
  room.lastAction = "Player disconnected. Hand cancelled.";
  room.actionSeq = (room.actionSeq || 0) + 1;
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name }, cb) => {
    const room = createRoom(socket.id, cleanName(name));
    socket.join(room.code);
    cb?.({ ok: true, code: room.code });
    emitRoom(room);
  });

  socket.on("joinRoom", ({ code, name }, cb) => {
    code = String(code || "").toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return cb?.({ ok: false, error: "Room not found." });
    if (room.started && room.phase !== "showdown" && room.phase !== "lobby") return cb?.({ ok: false, error: "Hand already started. Join after this hand." });
    if (room.players.length >= 8) return cb?.({ ok: false, error: "Room is full." });

    room.players.push({
      id: socket.id,
      name: cleanName(name),
      chips: 1000,
      bet: 0,
      totalCommitted: 0,
      hand: [],
      folded: false,
      allIn: false,
      connected: true,
      lastScore: null
    });

    socket.join(room.code);
    cb?.({ ok: true, code: room.code });
    emitRoom(room);
  });

  socket.on("setPlayerChips", ({ playerId, chips }) => {
    const found = findPlayerRoom(socket.id);
    if (!found) return;
    const { room } = found;
    if (room.hostId !== socket.id || room.phase !== "lobby") return;
    const p = room.players.find(x => x.id === playerId);
    const amount = Math.max(0, Math.min(999999, Math.floor(Number(chips))));
    if (!p || !Number.isFinite(amount)) return;

    p.chips = amount;
    p.bet = 0;
    p.totalCommitted = 0;
    p.hand = [];
    p.folded = false;
    p.allIn = false;
    p.lastScore = null;
    p.connected = true;

    room.finalWinner = null;
    room.busted = [];
    room.winners = [];
    room.pot = 0;
    room.currentBet = 0;
    room.message = `${p.name}'s stack set to ${amount}.`;
    room.lastAction = "Stack updated.";
    emitRoom(room);
  });

  socket.on("setAllChips", ({ chips }) => {
    const found = findPlayerRoom(socket.id);
    if (!found) return;
    const { room } = found;
    if (room.hostId !== socket.id || room.phase !== "lobby") return;
    const amount = Math.max(0, Math.min(999999, Math.floor(Number(chips))));
    if (!Number.isFinite(amount)) return;

    for (const p of room.players) {
      p.chips = amount;
      p.bet = 0;
      p.totalCommitted = 0;
      p.hand = [];
      p.folded = false;
      p.allIn = false;
      p.lastScore = null;
      p.connected = true;
    }

    room.finalWinner = null;
    room.busted = [];
    room.winners = [];
    room.pot = 0;
    room.currentBet = 0;
    room.message = `Everyone's stack set to ${amount}.`;
    room.lastAction = "All stacks updated.";
    emitRoom(room);
  });

  socket.on("startHand", () => {
    const found = findPlayerRoom(socket.id);
    if (!found) return;
    const { room } = found;
    if (room.hostId !== socket.id) return;
    if (room.phase !== "lobby" && room.phase !== "showdown") return;
    startHand(room);
    emitRoom(room);
  });

  
socket.on("action", ({ type, amount }) => {
    const found = findPlayerRoom(socket.id);
    if (!found) return;

    const { room, player } = found;
    const actionState = playerActionState(room, player);
    if (!actionState.canAct) {
      socket.emit("actionRejected", { reason: actionState.reason });
      return;
    }

    const now = Date.now();
    if (player.lastActionAt && now - player.lastActionAt < 80) return;

    const callAmount = Math.max(0, room.currentBet - player.bet);
    let accepted = false;

    if (type === "fold") {
      player.folded = true;
      room.actedThisRound.add(player.id);
      room.lastAction = `${player.name} folds.`;
      accepted = true;
    }

    else if (type === "check") {
      if (callAmount !== 0) return;
      room.actedThisRound.add(player.id);
      room.lastAction = `${player.name} checks.`;
      accepted = true;
    }

    else if (type === "call") {
      const paid = takeChips(player, callAmount);
      room.actedThisRound.add(player.id);
      room.lastAction = `${player.name} calls ${paid}.`;
      accepted = true;
    }

    else if (type === "raise") {
      amount = Math.floor(Number(amount));
      if (!Number.isFinite(amount)) return;

      const maxTarget = player.bet + player.chips;
      const targetBet = Math.min(amount, maxTarget);
      if (targetBet <= room.currentBet) return;

      const raiseBy = targetBet - room.currentBet;
      const isAllIn = targetBet === maxTarget;

      // Normal raises must meet minimum raise.
      // Short all-in raises are allowed but do not reopen action.
      if (raiseBy < room.minRaise && !isAllIn) return;

      takeChips(player, targetBet - player.bet);

      if (player.bet > room.currentBet) {
        const fullRaise = raiseBy >= room.minRaise;
        room.currentBet = player.bet;

        if (fullRaise) {
          room.minRaise = raiseBy;
          room.actedThisRound = new Set([player.id]);
        } else {
          room.actedThisRound.add(player.id);
        }
      } else {
        room.actedThisRound.add(player.id);
      }

      room.lastAction = `${player.name} ${player.allIn ? "goes all-in to" : "raises to"} ${player.bet}.`;
      accepted = true;
    }

    else if (type === "allin") {
      const previousBet = room.currentBet;
      takeChips(player, player.chips);

      if (player.bet > previousBet) {
        const raiseBy = player.bet - previousBet;
        const fullRaise = raiseBy >= room.minRaise;
        room.currentBet = player.bet;

        if (fullRaise) {
          room.minRaise = raiseBy;
          room.actedThisRound = new Set([player.id]);
        } else {
          room.actedThisRound.add(player.id);
        }
      } else {
        room.actedThisRound.add(player.id);
      }

      room.lastAction = `${player.name} goes all-in.`;
      accepted = true;
    }

    if (!accepted) return;

    player.lastActionAt = now;
    room.message = room.lastAction;
    room.actionSeq = (room.actionSeq || 0) + 1;
    afterAction(room);
    emitRoom(room);
  });


  socket.on("sendEmote", ({ emoji }) => {
    const found = findPlayerRoom(socket.id);
    if (!found) return;
    const { room, player } = found;
    const allowed = ["😂","😭","😎","🤡","💀","🔥","😡","🙏","💸","👑","🍀","😱"];
    if (!allowed.includes(emoji)) return;
    if (!room.emotes) room.emotes = [];
    room.emotes.push({
      id: Date.now() + "-" + crypto.randomInt(1000000),
      playerId: player.id,
      name: player.name,
      emoji,
      ts: Date.now()
    });
    room.emotes = room.emotes.slice(-12);
    emitRoom(room);
  });


  socket.on("returnToLobbyAfterFinal", () => {
    const found = findPlayerRoom(socket.id);
    if (!found) return;
    const { room } = found;
    if (room.hostId !== socket.id || !room.finalWinner) return;

    for (const p of room.players) {
      p.hand = [];
      p.bet = 0;
      p.totalCommitted = 0;
      p.folded = false;
      p.allIn = false;
      p.lastScore = null;
      p.connected = true;
    }

    room.started = false;
    room.phase = "lobby";
    room.deck = [];
    room.community = [];
    room.pot = 0;
    room.currentBet = 0;
    room.minRaise = room.bigBlind;
    room.actedThisRound = new Set();
    room.winners = [];
    room.potBreakdown = [];
    room.busted = [];
    room.finalWinner = null;
    room.message = "Back to room. Set stacks, then start a new game.";
    room.lastAction = "Returned to lobby.";
    room.actionSeq = (room.actionSeq || 0) + 1;
    emitRoom(room);
  });

  socket.on("disconnect", () => {
    const found = findPlayerRoom(socket.id);
    if (!found) return;

    const { room, player } = found;
    const wasInHand = !["lobby", "showdown"].includes(room.phase);
    const disconnectedName = player.name;
    const idx = room.players.findIndex(p => p.id === socket.id);
    if (idx >= 0) room.players.splice(idx, 1);

    if (room.players.length === 0) {
      rooms.delete(room.code);
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
    }

    if (room.dealerIndex >= room.players.length) room.dealerIndex = 0;
    if (room.turnIndex >= room.players.length) room.turnIndex = 0;

    if (wasInHand) {
      resetHandToLobbyAfterDisconnect(room, disconnectedName);
    } else {
      room.message = `${disconnectedName} disconnected and was kicked.`;
      room.lastAction = "Player disconnected.";
      room.actionSeq = (room.actionSeq || 0) + 1;
      room.players.forEach((p, i) => { p.seat = i; });
    }

    emitRoom(room);
  });
});

server.listen(PORT, () => {
  console.log(`Texas Hold'em v12 gamefeel running at http://localhost:${PORT}`);
});