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

function sanitizePlayerId(raw, fallback) {
  let id = String(raw || "").trim();
  id = id.replace(/[^a-zA-Z0-9_@.-]/g, "");
  if (!id) id = fallback || "player";
  if (!id.startsWith("@")) id = "@" + id;
  return id.slice(0, 18);
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

function createRoom(hostId, hostName, customId) {
  let code;
  do code = makeRoomCode(); while (rooms.has(code));
  const room = {
    code,
    hostId,
    players: [{
      id: hostId,
      name: hostName,
      customId,
      chips: 1000,
      bet: 0,
      totalCommitted: 0,
      hand: [],
      folded: false,
      allIn: false,
      connected: true,
      seat: 0
    }],
    spectators: [],
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
    winners: []
  };
  rooms.set(code, room);
  return room;
}

function publicRoom(room, viewerId) {
  return {
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    community: room.community,
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
    players: room.players.map((p, idx) => ({
      id: p.id,
      name: p.name,
      customId: p.customId,
      chips: p.chips,
      bet: p.bet,
      totalCommitted: p.totalCommitted,
      hand: p.id === viewerId || room.phase === "showdown" ? p.hand : p.hand.map(() => ({ code: "🂠" })),
      folded: p.folded,
      allIn: p.allIn,
      connected: p.connected,
      seat: idx,
      isYou: p.id === viewerId
    }))
  };
}

function emitRoom(room) {
  for (const p of room.players) {
    io.to(p.id).emit("state", publicRoom(room, p.id));
  }
}

function activePlayers(room) {
  return room.players.filter(p => !p.folded && (p.chips > 0 || p.bet > 0 || p.allIn));
}

function playersAbleToAct(room) {
  return room.players.filter(p => !p.folded && !p.allIn && p.chips > 0);
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

function takeChips(player, amount) {
  const actual = Math.max(0, Math.min(player.chips, amount));
  player.chips -= actual;
  player.bet += actual;
  player.totalCommitted += actual;
  if (player.chips === 0) player.allIn = true;
  return actual;
}

function postBlind(room, idx, amount) {
  const p = room.players[idx];
  takeChips(p, amount);
  room.pot += p.bet;
  p.bet = 0;
  p.totalCommitted = amount;
}

function startHand(room) {
  const eligible = room.players.filter(p => p.chips > 0);
  if (eligible.length < 2) {
    room.message = "Need at least 2 players with chips.";
    return;
  }

  room.started = true;
  room.phase = "preflop";
  room.deck = makeDeck();
  room.community = [];
  room.pot = 0;
  room.currentBet = room.bigBlind;
  room.minRaise = room.bigBlind;
  room.actedThisRound = new Set();
  room.winners = [];

  for (const p of room.players) {
    p.hand = [];
    p.bet = 0;
    p.totalCommitted = 0;
    p.folded = p.chips <= 0;
    p.allIn = false;
  }

  for (let r = 0; r < 2; r++) {
    for (const p of room.players) {
      if (!p.folded) p.hand.push(room.deck.pop());
    }
  }

  const n = room.players.length;
  room.dealerIndex = room.dealerIndex % n;
  const sbIndex = nextSeatedWithChips(room, room.dealerIndex);
  const bbIndex = nextSeatedWithChips(room, sbIndex);
  if (sbIndex < 0 || bbIndex < 0 || sbIndex === bbIndex) {
    room.message = "Need at least 2 players with chips.";
    return;
  }

  const sb = room.players[sbIndex];
  const bb = room.players[bbIndex];
  const sbPaid = takeChips(sb, room.smallBlind);
  const bbPaid = takeChips(bb, room.bigBlind);
  room.pot += sbPaid + bbPaid;
  room.currentBet = Math.max(sb.bet, bb.bet);
  room.turnIndex = nextIndex(room, bbIndex);
  if (room.turnIndex < 0) room.turnIndex = bbIndex;
  room.message = `${sb.name} posts small blind, ${bb.name} posts big blind.`;
}

function nextSeatedWithChips(room, fromIndex) {
  const n = room.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    if (room.players[idx].chips > 0) return idx;
  }
  return -1;
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
    room.message = "Flop dealt.";
  } else if (room.phase === "flop") {
    room.phase = "turn";
    room.community.push(room.deck.pop());
    room.message = "Turn dealt.";
  } else if (room.phase === "turn") {
    room.phase = "river";
    room.community.push(room.deck.pop());
    room.message = "River dealt.";
  } else if (room.phase === "river") {
    return finishHand(room);
  }

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
    room.message = `${winners.map(w => w.name).join(", ")} win with ${best.name}.`;
  }

  const share = Math.floor(room.pot / winners.length);
  for (const w of winners) w.chips += share;
  room.winners = winners.map(w => ({ name: w.name, customId: w.customId, amount: share, handName: w.lastScore?.name || "Fold win" }));
  room.pot = 0;

  room.dealerIndex = nextSeatedWithChips(room, room.dealerIndex);
  if (room.dealerIndex < 0) room.dealerIndex = 0;
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
      if (high) {
        return { rank: 8, tiebreak: [high], name: high === 14 ? "Royal Flush" : "Straight Flush" };
      }
    }
  }

  const four = groupEntries.find(g => g.count === 4);
  if (four) {
    const kicker = values.find(v => v !== four.v);
    return { rank: 7, tiebreak: [four.v, kicker], name: "Four of a Kind" };
  }

  const trips = groupEntries.filter(g => g.count === 3);
  const pairs = groupEntries.filter(g => g.count === 2);
  if (trips.length && (pairs.length || trips.length > 1)) {
    const trip = trips[0].v;
    const pair = trips.length > 1 ? trips[1].v : pairs[0].v;
    return { rank: 6, tiebreak: [trip, pair], name: "Full House" };
  }

  for (const suit of Object.keys(suits)) {
    if (suits[suit].length >= 5) {
      return { rank: 5, tiebreak: uniqueDesc(suits[suit]).slice(0, 5), name: "Flush" };
    }
  }

  const straight = straightHigh(values);
  if (straight) return { rank: 4, tiebreak: [straight], name: "Straight" };

  if (trips.length) {
    const trip = trips[0].v;
    const kickers = values.filter(v => v !== trip).slice(0, 2);
    return { rank: 3, tiebreak: [trip, ...kickers], name: "Three of a Kind" };
  }

  if (pairs.length >= 2) {
    const topPairs = pairs.slice(0, 2).map(p => p.v);
    const kicker = values.find(v => !topPairs.includes(v));
    return { rank: 2, tiebreak: [...topPairs, kicker], name: "Two Pair" };
  }

  if (pairs.length === 1) {
    const pair = pairs[0].v;
    const kickers = values.filter(v => v !== pair).slice(0, 3);
    return { rank: 1, tiebreak: [pair, ...kickers], name: "One Pair" };
  }

  return { rank: 0, tiebreak: values.slice(0, 5), name: "High Card" };
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
  socket.on("createRoom", ({ name, customId }, cb) => {
    name = String(name || "Player").slice(0, 16);
    customId = sanitizePlayerId(customId, name);
    const room = createRoom(socket.id, name, customId);
    socket.join(room.code);
    cb?.({ ok: true, code: room.code });
    emitRoom(room);
  });

  socket.on("joinRoom", ({ code, name, customId }, cb) => {
    code = String(code || "").toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return cb?.({ ok: false, error: "Room not found." });
    if (room.started && room.phase !== "showdown") return cb?.({ ok: false, error: "Hand already started. Join after this hand." });
    if (room.players.length >= 6) return cb?.({ ok: false, error: "Room is full." });
    name = String(name || "Player").slice(0, 16);
    customId = sanitizePlayerId(customId, name);
    room.players.push({
      id: socket.id, name, customId, chips: 1000, bet: 0, totalCommitted: 0,
      hand: [], folded: false, allIn: false, connected: true, seat: room.players.length
    });
    socket.join(room.code);
    cb?.({ ok: true, code: room.code });
    emitRoom(room);
  });

  socket.on("startHand", () => {
    const found = findPlayerRoom(socket.id);
    if (!found) return;
    const { room } = found;
    if (room.hostId !== socket.id) return;
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
      room.message = `${player.name} folds.`;
    } else if (type === "check") {
      if (callAmount !== 0) return;
      room.actedThisRound.add(player.id);
      room.message = `${player.name} checks.`;
    } else if (type === "call") {
      const paid = takeChips(player, callAmount);
      room.actedThisRound.add(player.id);
      room.message = `${player.name} calls ${paid}.`;
    } else if (type === "raise") {
      amount = Number(amount);
      if (!Number.isFinite(amount)) return;
      const targetBet = Math.floor(amount);
      const raiseBy = targetBet - room.currentBet;
      if (targetBet <= room.currentBet || raiseBy < room.minRaise) return;
      const need = targetBet - player.bet;
      if (need <= 0) return;
      const paid = takeChips(player, need);
      room.currentBet = player.bet;
      room.minRaise = Math.max(room.minRaise, raiseBy);
      room.actedThisRound = new Set([player.id]);
      room.message = `${player.name} raises to ${room.currentBet}.`;
    } else if (type === "allin") {
      const before = player.bet;
      takeChips(player, player.chips);
      if (player.bet > room.currentBet) {
        room.minRaise = Math.max(room.bigBlind, player.bet - room.currentBet);
        room.currentBet = player.bet;
        room.actedThisRound = new Set([player.id]);
        room.message = `${player.name} goes all-in for ${player.bet}.`;
      } else {
        room.actedThisRound.add(player.id);
        room.message = `${player.name} goes all-in.`;
      }
    }

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
  console.log(`Texas Hold'em Friends running at http://localhost:${PORT}`);
});