const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const rooms = new Map();

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
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

function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ rank, suit, code: rank + suit });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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
    busted: [],
    handNumber: 0,
    lastAction: ""
  };

  rooms.set(code, room);
  return room;
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
    busted: room.busted,
    handNumber: room.handNumber,
    lastAction: room.lastAction,
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
      currentScore: p.id === viewerId && !p.folded && p.hand.length === 2 && room.community.length >= 3
        ? displayScore(evaluateSeven([...p.hand, ...room.community]))
        : null
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
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    const p = room.players[idx];
    if (!p.folded && !p.allIn && p.chips > 0) return idx;
  }
  return -1;
}

function activePlayers(room) {
  return room.players.filter(p => !p.folded);
}

function playersAbleToAct(room) {
  return room.players.filter(p => !p.folded && !p.allIn && p.chips > 0);
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
  room.currentBet = room.bigBlind;
  room.minRaise = room.bigBlind;
  room.actedThisRound = new Set();
  room.winners = [];
  room.busted = [];
  room.lastAction = "";

  for (const p of room.players) {
    p.hand = [];
    p.bet = 0;
    p.totalCommitted = 0;
    p.folded = p.chips <= 0;
    p.allIn = false;
    p.lastScore = null;
  }

  for (let r = 0; r < 2; r++) {
    for (const p of room.players) {
      if (!p.folded) p.hand.push(room.deck.pop());
    }
  }

  room.dealerIndex = room.dealerIndex % room.players.length;
  const sbIndex = nextSeatedWithChips(room, room.dealerIndex);
  const bbIndex = nextSeatedWithChips(room, sbIndex);

  if (sbIndex < 0 || bbIndex < 0 || sbIndex === bbIndex) {
    room.message = "Need at least 2 players with chips.";
    return;
  }

  const sb = room.players[sbIndex];
  const bb = room.players[bbIndex];
  takeChips(sb, room.smallBlind);
  takeChips(bb, room.bigBlind);

  room.currentBet = Math.max(sb.bet, bb.bet);
  room.turnIndex = nextIndex(room, bbIndex);
  if (room.turnIndex < 0) room.turnIndex = bbIndex;

  room.message = `${sb.name} posts small blind, ${bb.name} posts big blind.`;
  room.lastAction = `Hand ${room.handNumber} begins.`;
}

function allBetsMatchedOrAllIn(room) {
  const able = playersAbleToAct(room);
  if (able.length === 0) return true;
  return able.every(p => p.bet === room.currentBet && room.actedThisRound.has(p.id));
}

function endBettingRound(room) {
  for (const p of room.players) {
    room.pot += p.bet;
    p.bet = 0;
  }

  room.currentBet = 0;
  room.minRaise = room.bigBlind;
  room.actedThisRound = new Set();

  if (activePlayers(room).length <= 1) return finishHand(room);

  if (room.phase === "preflop") {
    room.phase = "flop";
    room.community.push(room.deck.pop(), room.deck.pop(), room.deck.pop());
    room.lastAction = "Flop dealt.";
  } else if (room.phase === "flop") {
    room.phase = "turn";
    room.community.push(room.deck.pop());
    room.lastAction = "Turn dealt.";
  } else if (room.phase === "turn") {
    room.phase = "river";
    room.community.push(room.deck.pop());
    room.lastAction = "River dealt.";
  } else if (room.phase === "river") {
    return finishHand(room);
  }

  room.message = room.lastAction;
  room.turnIndex = nextIndex(room, room.dealerIndex);
  if (room.turnIndex < 0) return finishHand(room);
}

function afterAction(room) {
  if (activePlayers(room).length <= 1) return finishHand(room);
  if (allBetsMatchedOrAllIn(room)) return endBettingRound(room);
  const next = nextIndex(room, room.turnIndex);
  if (next >= 0) room.turnIndex = next;
  else endBettingRound(room);
}

function finishHand(room) {
  for (const p of room.players) {
    room.pot += p.bet;
    p.bet = 0;
  }

  room.phase = "showdown";
  const stillIn = room.players.filter(p => !p.folded);
  let winners = [];
  let best = null;

  if (stillIn.length === 1) {
    winners = [stillIn[0]];
    stillIn[0].lastScore = { name: "Fold Win", cn: "弃牌胜利", rank: -1, effect: "foldwin", tiebreak: [] };
    room.message = `${stillIn[0].name} wins because everyone else folded.`;
  } else {
    for (const p of stillIn) {
      const score = evaluateSeven([...p.hand, ...room.community]);
      p.lastScore = score;
      if (!best || compareScore(score, best) > 0) {
        best = score;
        winners = [p];
      } else if (compareScore(score, best) === 0) {
        winners.push(p);
      }
    }
    room.message = `${winners.map(w => w.name).join(", ")} win with ${best.cn}.`;
  }

  const share = Math.floor(room.pot / winners.length);
  for (const w of winners) w.chips += share;

  room.winners = winners.map(w => ({
    id: w.id,
    name: w.name,
    amount: share,
    handName: w.lastScore?.name || "Fold Win",
    handNameCn: w.lastScore?.cn || "弃牌胜利",
    effect: w.lastScore?.effect || "foldwin",
    rank: w.lastScore?.rank ?? -1
  }));

  room.busted = room.players
    .filter(p => p.chips <= 0 && !winners.some(w => w.id === p.id))
    .map(p => ({ id: p.id, name: p.name }));

  room.pot = 0;
  room.lastAction = "Showdown complete.";

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
    room.message = `${p.name}'s stack set to ${amount}.`;
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
      p.folded = false;
      p.allIn = false;
    }
    room.message = `Everyone's stack set to ${amount}.`;
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
    if (room.phase === "lobby" || room.phase === "showdown") return;
    if (room.players[room.turnIndex]?.id !== socket.id) return;
    if (player.folded || player.allIn) return;

    const callAmount = Math.max(0, room.currentBet - player.bet);

    if (type === "fold") {
      player.folded = true;
      room.actedThisRound.add(player.id);
      room.lastAction = `${player.name} folds.`;
    } else if (type === "check") {
      if (callAmount !== 0) return;
      room.actedThisRound.add(player.id);
      room.lastAction = `${player.name} checks.`;
    } else if (type === "call") {
      const paid = takeChips(player, callAmount);
      room.actedThisRound.add(player.id);
      room.lastAction = `${player.name} calls ${paid}.`;
    } else if (type === "raise") {
      amount = Number(amount);
      if (!Number.isFinite(amount)) return;
      const targetBet = Math.floor(amount);
      const raiseBy = targetBet - room.currentBet;
      if (targetBet <= room.currentBet || raiseBy < room.minRaise) return;
      takeChips(player, targetBet - player.bet);
      room.currentBet = player.bet;
      room.minRaise = Math.max(room.minRaise, raiseBy);
      room.actedThisRound = new Set([player.id]);
      room.lastAction = `${player.name} raises to ${room.currentBet}.`;
    } else if (type === "allin") {
      takeChips(player, player.chips);
      if (player.bet > room.currentBet) {
        room.minRaise = Math.max(room.bigBlind, player.bet - room.currentBet);
        room.currentBet = player.bet;
        room.actedThisRound = new Set([player.id]);
      } else {
        room.actedThisRound.add(player.id);
      }
      room.lastAction = `${player.name} goes all-in.`;
    }

    room.message = room.lastAction;
    afterAction(room);
    emitRoom(room);
  });

  socket.on("disconnect", () => {
    const found = findPlayerRoom(socket.id);
    if (!found) return;
    const { room, player } = found;
    player.connected = false;
    room.message = `${player.name} disconnected.`;
    emitRoom(room);
  });
});

server.listen(PORT, () => {
  console.log(`Texas Hold'em v4 premium plus running at http://localhost:${PORT}`);
});