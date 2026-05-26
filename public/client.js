const socket = io();

let state = null;
let lastActionId = null;
let previousChips = new Map();
let lastShowdownKey = "";
let lastPersonalScoreKey = "";
let seenEmoteIds = new Set();
let soundEnabled = false;
let audioCtx = null;
let lastSoundPhaseKey = "";
let lastActionSound = "";

const $ = (id) => document.getElementById(id);

function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq, duration = 0.12, type = "sine", gain = 0.06, delay = 0) {
  if (!soundEnabled) return;
  const ctx = getAudio();
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  vol.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
  vol.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + delay + 0.015);
  vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
  osc.connect(vol);
  vol.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration + 0.03);
}

function noise(duration = 0.18, gain = 0.08, delay = 0, filterFreq = 900) {
  if (!soundEnabled) return;
  const ctx = getAudio();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  const vol = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(filterFreq, ctx.currentTime + delay);
  vol.gain.setValueAtTime(gain, ctx.currentTime + delay);
  vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
  src.buffer = buffer;
  src.connect(filter);
  filter.connect(vol);
  vol.connect(ctx.destination);
  src.start(ctx.currentTime + delay);
  src.stop(ctx.currentTime + delay + duration);
}

function playSound(name, rank = 0) {
  if (!soundEnabled) return;
  try {
    if (name === "deal") {
      noise(0.06, 0.035, 0, 1800);
      tone(520, 0.045, "triangle", 0.025, 0.02);
    } else if (name === "chip") {
      tone(620, 0.055, "square", 0.025);
      tone(920, 0.07, "square", 0.018, 0.045);
      noise(0.08, 0.02, 0.02, 2500);
    } else if (name === "fold") {
      tone(220, 0.13, "sawtooth", 0.035);
      noise(0.09, 0.025, 0.02, 700);
    } else if (name === "allin") {
      tone(85, 0.22, "sawtooth", 0.08);
      tone(150, 0.25, "square", 0.05, 0.05);
      noise(0.24, 0.08, 0.02, 500);
    } else if (name === "emote") {
      tone(780, 0.07, "sine", 0.03);
      tone(1040, 0.08, "sine", 0.025, 0.06);
    } else if (name === "bust") {
      tone(70, 0.35, "sawtooth", 0.09);
      noise(0.45, 0.11, 0.02, 450);
      tone(110, 0.25, "square", 0.05, 0.18);
    } else if (name === "hand") {
      const base = 360 + rank * 55;
      tone(base, 0.10, "triangle", 0.035);
      tone(base * 1.25, 0.12, "triangle", 0.03, 0.08);
      if (rank >= 5) tone(base * 1.5, 0.18, "sine", 0.035, 0.18);
      if (rank >= 7) tone(base * 2, 0.25, "sine", 0.04, 0.28);
    } else if (name === "showdown") {
      const power = Math.max(1, rank);
      tone(180, 0.12, "sawtooth", 0.04);
      tone(260, 0.12, "sawtooth", 0.04, 0.10);
      tone(390, 0.16, "triangle", 0.045, 0.22);
      tone(520 + power * 35, 0.26, "sine", 0.055, 0.38);
      if (power >= 6) {
        tone(780, 0.32, "sine", 0.05, 0.55);
        noise(0.5, 0.06, 0.2, 2200);
      }
      if (power >= 8) {
        tone(1040, 0.5, "sine", 0.06, 0.75);
        tone(1560, 0.6, "sine", 0.045, 0.95);
      }
    }
  } catch (e) {
    console.warn("Sound failed:", e);
  }
}


const praises = [
  "牌桌唯一亲爹，直接把所有人打成背景板。",
  "这把不是赢，是公开处刑。",
  "筹码过来像朝圣，挡都挡不住。",
  "全桌都在打牌，只有你在拍电影。",
  "这手牌一亮，牌桌自动改姓。",
  "已经不是玩家了，是赌场最终 Boss。",
  "操作简单粗暴：看牌，收钱，羞辱全场。",
  "朋友局被你打成个人纪录片。",
  "这一把赢得太没礼貌了。",
  "你不是赢了，你是把他们的尊严一起打包带走了。",
  "这牌开出来，空气都开始叫爸爸。",
  "全桌唯一神，其他人只是气氛组。"
];

const roasts = [
  "筹码清零，智商也被系统暂时托管。",
  "破产了，但至少贡献了节目效果。",
  "从坐下到离场，主打一个丝滑。",
  "牌没看明白，钱先看没了。",
  "成功完成财富转移，掌声鼓励。",
  "这波操作很抽象，筹码很具体地没了。",
  "以一己之力养活全桌。",
  "破产速度快得像开了加速器。",
  "你的筹码已经去更懂牌的人那里了。",
  "输了，但输得很有建设性：建设了别人的筹码塔。",
  "被牌桌教育得很完整。",
  "从此进入观战席进修。"
];

const handLines = {
  royal: "皇家同花顺",
  straightflush: "同花顺",
  fourkind: "四条",
  fullhouse: "葫芦",
  flush: "同花",
  straight: "顺子",
  threekind: "三条",
  twopair: "两对",
  onepair: "一对",
  highcard: "高牌",
  foldwin: "弃牌胜利"
};

const emotes = ["😂","😭","😎","🤡","💀","🔥","😡","🙏","💸","👑","🍀","😱"];




$("createBtn").onclick = () => {
  const name = $("name").value.trim() || "Player";
  socket.emit("createRoom", { name }, handleJoinResponse);
};

$("joinBtn").onclick = () => {
  const name = $("name").value.trim() || "Player";
  const code = $("roomCode").value.trim();
  socket.emit("joinRoom", { name, code }, handleJoinResponse);
};

$("nextHandBtn").onclick = () => {
  if (state?.finalWinner) socket.emit("returnToLobbyAfterFinal");
  else socket.emit("startHand");
};
$("soundToggle").onclick = () => {
  soundEnabled = !soundEnabled;
  $("soundToggle").textContent = soundEnabled ? "🔊 Sound" : "🔇 Sound";
  if (soundEnabled) {
    getAudio();
    playSound("chip");
  }
};

function handleJoinResponse(res) {
  if (!res.ok) {
    $("loginError").textContent = res.error || "Could not join.";
    return;
  }
  $("login").classList.add("hidden");
  $("game").classList.remove("hidden");
}

socket.on("state", (s) => {
  state = s;
  render();
});

function render() {
  $("code").textContent = state.code;
  $("message").textContent = state.message || "";
  $("pot").textContent = state.pot;
  $("phasePill").textContent = phaseName(state.phase);
  $("statusTitle").textContent = statusTitle();

  const isHost = socket.id === state.hostId;
  $("nextHandBtn").classList.toggle("hidden", !(isHost && state.phase === "showdown"));
  $("nextHandBtn").textContent = state.finalWinner ? "Back to Room" : "Next Hand";

  renderLobby(isHost);
  renderCommunity();
  renderPlayers();
  renderPersonalHandHint();
  renderActions();
  renderHideCardsControl();
  renderActionFeedback();
  renderHistoryLog();
  renderEmotes();
  spawnIncomingEmotes();
  playStateSounds();

  const showdownKey = state.phase === "showdown"
    ? `${state.handNumber}|${(state.winners || []).map(w => `${w.id}-${w.handName}-${w.amount}`).join("|")}|${(state.busted || []).map(b=>b.id).join("|")}|${state.finalWinner?.id || ""}`
    : "";

  if (state.phase === "showdown" && showdownKey && showdownKey !== lastShowdownKey) {
    lastShowdownKey = showdownKey;
    showShowdownEffect(state.winners || [], state.busted || [], state.finalWinner);
  }
  if (state.phase !== "showdown") {
    lastShowdownKey = "";
    removeOverlay("showOverlay");
  }
}

function statusTitle() {
  if (!state) return "Waiting";
  if (state.phase === "lobby") return "Set stacks and start";
  if (state.phase === "showdown") return "Hand complete";
  const current = state.players[state.turnIndex];
  return current ? `${current.name}'s turn` : "Playing";
}

function phaseName(phase) {
  return {
    lobby: "Lobby",
    preflop: "Pre-flop",
    flop: "Flop",
    turn: "Turn",
    river: "River",
    showdown: "Showdown"
  }[phase] || phase;
}

function playStateSounds() {
  if (!state) return;
  const phaseKey = `${state.handNumber}|${state.phase}|${state.community.length}`;
  if (phaseKey !== lastSoundPhaseKey) {
    lastSoundPhaseKey = phaseKey;
    if (["preflop", "flop", "turn", "river"].includes(state.phase)) playSound("deal");
  }

  if (state.lastAction && state.lastAction !== lastActionSound) {
    lastActionSound = state.lastAction;
    const lower = state.lastAction.toLowerCase();
    if (lower.includes("fold")) playSound("fold");
    else if (lower.includes("all-in")) playSound("allin");
    else if (lower.includes("call") || lower.includes("raise") || lower.includes("blind")) playSound("chip");
  }
}

function renderLobby(isHost) {
  const panel = $("lobbyPanel");
  const controls = $("chipControls");
  const hostWrap = $("hostStartWrap");
  panel.classList.toggle("hidden", state.phase !== "lobby");
  if (state.phase !== "lobby") return;

  hostWrap.innerHTML = isHost ? `
    <div class="lobbyHostActions">
      <button class="primary" id="startHandNow">Start Hand</button>
      <button id="addBotBtn" class="addBotBtn">Add Bot</button>
    </div>
  ` : "";

  if (isHost) {
    setTimeout(() => {
      const startBtn = $("startHandNow");
      if (startBtn) startBtn.onclick = () => socket.emit("startHand");

      const botBtn = $("addBotBtn");
      if (botBtn) botBtn.onclick = () => socket.emit("addBot");
    }, 0);
  }

  if (!isHost) {
    controls.innerHTML = `
      <div class="chipCard">Waiting for dealer to set stacks, blinds, and start.</div>
      <div class="chipCard">
        <label>Current blinds</label>
        <div class="blindDisplay">Small ${state.smallBlind} / Big ${state.bigBlind}</div>
      </div>
    `;
    return;
  }

  const playerCards = state.players.map(p => `
    <div class="chipCard ${p.isBot ? "botChipCard" : ""}">
      <label>${escapeHtml(p.name)}${p.isBot ? " · BOT" : ""}</label>
      <input data-chip-player="${p.id}" value="${p.chips}" type="number" min="0" step="10" />
      ${p.isBot ? `<button class="removeBotBtn" data-remove-bot="${p.id}">Remove Bot</button>` : ""}
    </div>
  `).join("");

  controls.innerHTML = `
    <div class="setAll">
      <input id="allChipAmount" value="1000" type="number" min="0" step="10" placeholder="Set all stacks to..." />
      <button id="setAllBtn">Set All</button>
    </div>

    <div class="blindSettings">
      <div class="chipCard">
        <label>Small Blind</label>
        <input id="smallBlindInput" value="${state.smallBlind}" type="number" min="1" step="1" />
      </div>
      <div class="chipCard">
        <label>Big Blind</label>
        <input id="bigBlindInput" value="${state.bigBlind}" type="number" min="2" step="1" />
      </div>
      <button id="setBlindsBtn">Set Blinds</button>
    </div>

    ${playerCards}
  `;

  controls.querySelectorAll("[data-chip-player]").forEach(input => {
    input.onchange = () => {
      socket.emit("setPlayerChips", {
        playerId: input.dataset.chipPlayer,
        chips: Number(input.value)
      });
    };
  });

  controls.querySelectorAll("[data-remove-bot]").forEach(btn => {
    btn.onclick = () => socket.emit("removeBot", { botId: btn.dataset.removeBot });
  });

  $("setAllBtn").onclick = () => {
    socket.emit("setAllChips", { chips: Number($("allChipAmount").value) });
  };

  $("setBlindsBtn").onclick = () => {
    socket.emit("setBlinds", {
      smallBlind: Number($("smallBlindInput").value),
      bigBlind: Number($("bigBlindInput").value)
    });
  };
}





function renderCommunity() {
  const community = $("community");
  community.innerHTML = "";
  state.community.forEach(c => community.appendChild(cardEl(c)));
}

function renderPlayers() {
  const box = $("players");
  box.innerHTML = "";
  const n = Math.max(state.players.length, 1);
  const winnerIds = new Set((state.winners || []).map(w => w.id));
  const bustedIds = new Set((state.busted || []).map(b => b.id));

  state.players.forEach((p, idx) => {
    const seat = document.createElement("div");
    seat.className = "playerSeat";
    const angle = n === 2 ? idx * 180 - 90 : idx * (360 / n) - 90;
    seat.style.setProperty("--angle", `${angle}deg`);
    seat.style.setProperty("--radius", "calc(min(36vh, 36vw, 315px))");
    if (idx === state.turnIndex && !["lobby", "showdown"].includes(state.phase)) seat.classList.add("turn");
    if (p.folded) seat.classList.add("folded");
    if (winnerIds.has(p.id)) seat.classList.add("winner");
    if (bustedIds.has(p.id)) seat.classList.add("busted");
    if (p.isYou && p.currentScore && p.currentScore.rank >= 1 && !p.folded && state.phase !== "showdown") seat.classList.add(`made-${p.currentScore.effect}`);

    const hand = p.hand.map(c => cardElHTML(c)).join("");
    const badges = [
      idx === state.dealerIndex ? `<span class="badge dealer">D</span>` : "",
      p.bet ? `<span class="badge bet">Bet ${p.bet}</span>` : "",
      p.allIn ? `<span class="badge allin">All-in</span>` : "",
      p.folded ? `<span class="badge">Fold</span>` : "",
      p.isBot ? `<span class="badge botBadge">BOT</span>` : "",
      p.isYou ? `<span class="badge">You</span>` : "",
      p.isYou && p.hideAtShowdown && !["lobby", "showdown"].includes(state.phase) ? `<span class="badge hideBadge">Hide End</span>` : "",
      p.isYou && p.shareCardsWithSpectators && !["lobby", "showdown"].includes(state.phase) ? `<span class="badge shareBadge">Spectators</span>` : "",
      p.forceRevealWinner && state.phase === "showdown" ? `<span class="badge revealBadge">Must Show</span>` : "",
      p.chips <= 0 ? `<span class="badge bustedBadge">Spectating</span>` : "",
      p.isYou && p.currentScore && p.currentScore.rank >= 1 && !p.folded && state.phase !== "showdown" ? `<span class="badge handmadeBadge">${escapeHtml(p.currentScore.cn)}</span>` : ""
    ].filter(Boolean).join("");

    seat.innerHTML = `
      <div class="playerCard">
        <div class="playerTop">
          <div class="playerName">${escapeHtml(p.name)}</div>
          <div class="chips">${p.chips}</div>
        </div>
        <div class="hand">${hand}</div>
        <div class="badges">${badges}</div>
      </div>
    `;
    box.appendChild(seat);
  });
}

function renderPersonalHandHint() {
  const hint = $("handHint");
  const me = state.players.find(p => p.isYou);
  if (!me || !me.currentScore || me.folded || me.currentScore.rank < 1 || state.phase === "showdown") {
    hint.classList.add("hidden");
    return;
  }

  hint.textContent = `你开出了 ${me.currentScore.cn}`;
  hint.className = `handHint handHint-${me.currentScore.effect}`;

  const key = `${state.handNumber}|${me.currentScore.rank}|${me.currentScore.cn}`;
  if (key !== lastPersonalScoreKey) {
    lastPersonalScoreKey = key;
    showPersonalHandEffect(me.currentScore);
  }
}



function renderHideCardsControl() {
  let panel = $("hideCardsPanel");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "hideCardsPanel";
    panel.className = "hideCardsPanel hidden";
    document.body.appendChild(panel);
  }

  if (!state || ["lobby", "showdown"].includes(state.phase)) {
    panel.classList.add("hidden");
    return;
  }

  const me = state.players.find(p => p.isYou);
  if (!me || me.folded || me.chips <= 0 || me.isBot) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");
  panel.innerHTML = `
    <button id="hideCardsBtn" class="${me.hideAtShowdown ? "hideActive" : ""}">
      ${me.hideAtShowdown ? "🙈 End: Hide Cards ON" : "👁️ End: Show My Cards"}
    </button>
    <button id="spectatorShareBtn" class="${me.shareCardsWithSpectators ? "shareActive" : ""}">
      ${me.shareCardsWithSpectators ? "👀 Spectators: Can See" : "🚫 Spectators: Hidden"}
    </button>
  `;

  const hideBtn = $("hideCardsBtn");
  if (hideBtn) hideBtn.onclick = () => socket.emit("toggleHideAtShowdown");

  const shareBtn = $("spectatorShareBtn");
  if (shareBtn) shareBtn.onclick = () => socket.emit("toggleSpectatorShare");
}





function renderActionFeedback() {
  if (!state) return;

  if (state.lastAction && state.lastAction.id !== lastActionId) {
    lastActionId = state.lastAction.id;
    showActionToast(state.lastAction);
    flashActionSeat(state.lastAction.actorId, state.lastAction.action);
    if (["call", "raise", "allin"].includes(state.lastAction.action)) {
      animateChipsToPot(state.lastAction.actorId, state.lastAction.amount);
    }
    if (state.lastAction.action === "allin") {
      document.body.classList.add("tableShake");
      setTimeout(() => document.body.classList.remove("tableShake"), 520);
    }
  }

  state.players.forEach(p => {
    const prev = previousChips.get(p.id);
    if (prev !== undefined && prev !== p.chips) {
      showChipDelta(p.id, p.chips - prev);
    }
    previousChips.set(p.id, p.chips);
  });
}

function showActionToast(action) {
  let toast = $("actionToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "actionToast";
    toast.className = "actionToast";
    document.body.appendChild(toast);
  }

  toast.className = `actionToast action-${escapeHtml(action.action || "move")}`;
  toast.textContent = action.text || "ACTION";
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1250);
}

function flashActionSeat(playerId, action) {
  if (!playerId) return;
  const seat = document.querySelector(`[data-seat-player="${CSS.escape(playerId)}"]`);
  if (!seat) return;

  seat.classList.remove("seatPulse", "seatFoldPulse", "seatAllinPulse");
  void seat.offsetWidth;
  if (action === "fold") seat.classList.add("seatFoldPulse");
  else if (action === "allin") seat.classList.add("seatAllinPulse");
  else seat.classList.add("seatPulse");

  setTimeout(() => seat.classList.remove("seatPulse", "seatFoldPulse", "seatAllinPulse"), 900);
}

function animateChipsToPot(playerId, amount = 0) {
  const seat = document.querySelector(`[data-seat-player="${CSS.escape(playerId)}"]`);
  const pot = $("potAmount") || document.querySelector(".pot");
  if (!seat || !pot) return;

  const from = seat.getBoundingClientRect();
  const to = pot.getBoundingClientRect();
  const chip = document.createElement("div");
  chip.className = "flyingChip";
  chip.textContent = amount ? `+${amount}` : "●";
  chip.style.left = `${from.left + from.width / 2}px`;
  chip.style.top = `${from.top + from.height / 2}px`;
  chip.style.setProperty("--tx", `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
  chip.style.setProperty("--ty", `${to.top + to.height / 2 - (from.top + from.height / 2)}px`);
  document.body.appendChild(chip);
  setTimeout(() => chip.remove(), 850);
}

function showChipDelta(playerId, delta) {
  if (!delta) return;
  const seat = document.querySelector(`[data-seat-player="${CSS.escape(playerId)}"]`);
  if (!seat) return;
  const badge = document.createElement("div");
  badge.className = `chipDelta ${delta > 0 ? "chipUp" : "chipDown"}`;
  badge.textContent = `${delta > 0 ? "+" : ""}${delta}`;
  seat.appendChild(badge);
  setTimeout(() => badge.remove(), 1300);
}

function renderHistoryLog() {
  const log = $("historyLog");
  if (!log || !state) return;

  const items = (state.history || []).slice(-10).reverse();
  log.classList.toggle("hidden", !items.length);
  log.innerHTML = `
    <div class="historyLogTitle">LOG</div>
    <div class="historyLogItems">
      ${items.map(item => `<div class="historyLogItem history-${item.type || "action"}"><span>#${item.handNumber || 0}</span>${escapeHtml(item.text || "")}</div>`).join("")}
    </div>
  `;
}

function renderActions() {
  const panel = $("actionPanel");
  const buttons = $("actionButtons");
  const me = state.players.find(p => p.isYou);
  const current = state.players[state.turnIndex];
  const isMyTurn = me && current?.id === me.id && !["lobby", "showdown"].includes(state.phase) && !me.folded && !me.allIn && me.chips > 0;

  panel.classList.toggle("hidden", !isMyTurn);
  if (!isMyTurn) {
    buttons.innerHTML = "";
    return;
  }

  const callAmount = Math.max(0, state.currentBet - me.bet);
  $("turnText").textContent = `Your turn · To call: ${callAmount} · Stack: ${me.chips}`;

  const minRaiseTo = Math.max(state.currentBet + state.minRaise, me.bet + callAmount + state.minRaise);
  const possible = [];

  if (callAmount === 0) possible.push(`<button data-action="check" class="primary">Check / 过牌</button>`);
  if (callAmount > 0) possible.push(`<button data-action="call" class="primary">Call / 跟注 ${callAmount}</button>`);
  possible.push(`<button data-action="fold">Fold / 弃牌</button>`);
  possible.push(`<button data-action="allin">All-in / 全下</button>`);
  possible.push(`
    <div class="raiseGroup">
      <input id="raiseAmount" type="number" min="${minRaiseTo}" step="10" placeholder="Raise to ${minRaiseTo}+" />
      <button data-action="raise">Raise / 加注</button>
    </div>
  `);

  buttons.innerHTML = possible.join("");

  buttons.querySelectorAll("[data-action]").forEach(btn => {
    btn.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const type = btn.dataset.action;
      let amount = Number($("raiseAmount")?.value || 0);
      if (type === "raise" && (!amount || amount <= 0)) {
        amount = minRaiseTo;
        const input = $("raiseAmount");
        if (input) input.value = amount;
      }

      buttons.querySelectorAll("button").forEach(b => b.disabled = true);
      $("turnText").textContent = `Sent ${type}...`;

      socket.emit("action", { type, amount });

      setTimeout(() => {
        buttons.querySelectorAll("button").forEach(b => b.disabled = false);
      }, 400);
    };
  });
}



function renderEmotes() {
  const bar = $("emoteBar");
  if (!bar) return;
  bar.classList.toggle("hidden", !state);
  bar.innerHTML = emotes.map(e => `<button type="button" class="emoteBtn" data-emote="${e}">${e}</button>`).join("");

  bar.querySelectorAll("[data-emote]").forEach(btn => {
    btn.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      playSound("emote");
      socket.emit("sendEmote", { emoji: btn.dataset.emote });
      // Server state broadcast will show exactly one bubble.
    };
  });
}





function spawnIncomingEmotes() {
  if (!state || !state.emotes) return;
  state.emotes.forEach(em => {
    if (seenEmoteIds.has(em.id)) return;
    seenEmoteIds.add(em.id);
    spawnEmoteBubble(em.emoji, em.name);
  });
}

function spawnEmoteBubble(emoji, name) {
  const bubble = document.createElement("div");
  bubble.className = "emoteBubble";
  bubble.innerHTML = `<span>${emoji}</span><small>${escapeHtml(name)}</small>`;
  bubble.style.left = `${12 + Math.random() * 76}%`;
  bubble.style.top = `${62 + Math.random() * 20}%`;
  document.body.appendChild(bubble);
  setTimeout(() => bubble.remove(), 2500);
}

function cardEl(c) {
  const div = document.createElement("div");
  div.className = "card";
  const text = c.display || c.code || "🂠";
  div.textContent = text;
  if (text === "🂠") div.classList.add("back");
  if (text.includes("♥") || text.includes("♦")) div.classList.add("red");
  return div;
}

function cardElHTML(c) {
  const text = c.display || c.code || "🂠";
  const classes = ["card"];
  if (text === "🂠") classes.push("back");
  if (text.includes("♥") || text.includes("♦")) classes.push("red");
  return `<div class="${classes.join(" ")}">${escapeHtml(text)}</div>`;
}

function showPersonalHandEffect(score) {
  removeOverlay("handOverlay");
  if (!score || score.rank < 1) return;

  playSound("hand", score.rank);
  const overlay = document.createElement("div");
  overlay.id = "handOverlay";
  overlay.className = `handOverlay hand-only effect-${score.effect}`;
  overlay.innerHTML = `
    ${personalEffectHTML(score.effect)}
    <div class="handModal">
      <div class="handTitle">你开出了 ${escapeHtml(score.cn)}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.style.animation = "overlayOut .45s ease both";
    setTimeout(() => removeOverlay("handOverlay"), 450);
  }, score.rank >= 5 ? 2200 : 1450);
}

function showShowdownEffect(winners, busted, finalWinner = null) {
  removeOverlay("showOverlay");
  winners = winners || [];
  busted = busted || [];

  const steps = [];

  if (winners.length) {
    steps.push(() => showWinnerHandEffect(winners));
  }

  if (busted.length) {
    steps.push(() => showBustedEffectStep(busted));
  }

  if (finalWinner) {
    steps.push(() => showFinalWinnerEffect(finalWinner, winners));
  }

  if (!steps.length) return;

  runEffectQueue(steps);
}

function runEffectQueue(steps, index = 0) {
  if (index >= steps.length) return;

  removeOverlay("showOverlay");
  const duration = steps[index]();

  setTimeout(() => {
    removeOverlay("showOverlay");
    setTimeout(() => runEffectQueue(steps, index + 1), 280);
  }, duration);
}

function showWinnerHandEffect(winners) {
  if (!winners.length) return 0;

  const strongest = winners.reduce((a, b) => (b.rank > a.rank ? b : a), winners[0]);
  const effect = strongest.effect || "highcard";
  const title = winners.length > 1 ? "SPLIT POT" : (strongest.handNameCn || "WINNER");

  const winLines = winners.map(w => `
    <div class="cleanWinnerName">${escapeHtml(w.name)}</div>
    <div class="cleanWinnerHand">${escapeHtml(w.handNameCn || "胜利")} +${w.amount}</div>
  `).join("<br>");

  playSound("showdown", strongest.rank || 1);

  const overlay = document.createElement("div");
  overlay.id = "showOverlay";
  overlay.className = `showOverlay showdown cleanShowOverlay effect-${effect}`;
  overlay.innerHTML = `
    <div class="showModal">
      <div class="showTitle">${title}</div>
      <div class="showDetails">${winLines}</div>
    </div>
    <div class="confetti"></div>
  `;
  document.body.appendChild(overlay);
  return 3600;
}

function showBustedEffectStep(busted) {
  if (!busted.length) return 0;

  playSound("bust");
  const bustLines = busted.map(b => escapeHtml(b.text || `${b.name} 可以回家种地了`)).join("<br>");

  const overlay = document.createElement("div");
  overlay.id = "showOverlay";
  overlay.className = "showOverlay showdown has-bust effect-foldwin";
  overlay.innerHTML = `
    <div class="showModal">
      <div class="showTitle">BUSTED</div>
      <div class="showDetails">${bustLines}</div>
      <div class="roast">${bustLines}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  return 3000;
}

function showFinalWinnerEffect(finalWinner, winners = []) {
  if (!finalWinner) return 0;

  const strongest = winners.length
    ? winners.reduce((a, b) => (b.rank > a.rank ? b : a), winners[0])
    : { rank: 9 };

  playSound("showdown", strongest.rank || 9);

  const overlay = document.createElement("div");
  overlay.id = "showOverlay";
  overlay.className = "showOverlay showdown cleanShowOverlay effect-royal final-winner";
  overlay.innerHTML = `
    <div class="showModal">
      <div class="showTitle">FINAL WINNER</div>
      <div class="showDetails">
        <div class="cleanWinnerName">${escapeHtml(finalWinner.name)}</div>
        <div class="cleanWinnerHand">最终赢家 · ${finalWinner.chips}</div>
      </div>
    </div>
    <div class="confetti"></div>
  `;
  document.body.appendChild(overlay);
  return 6500;
}











function personalEffectHTML(effect) {
  if (effect === "onepair") return `<div class="ring mini"></div>`;
  if (effect === "twopair") return `<div class="ring mini"></div><div class="ring mini second"></div>`;
  if (effect === "threekind") return `<div class="triplePulse"></div>`;
  if (effect === "straight") return `<div class="lightningLine"></div>`;
  if (effect === "flush") return `<div class="waterWave"></div>`;
  if (effect === "fullhouse") return `<div class="houseGlow"></div>`;
  if (effect === "fourkind") return `<div class="quadComets"></div>`;
  if (effect === "straightflush") return `<div class="neonTunnel"></div>`;
  if (effect === "royal") return `<div class="crownRain"></div>`;
  return "";
}


function bigEffectHTML(effect) {
  let html = "";
  if (effect === "royal") {
    html += `<div class="royalCrown">♛</div><div class="goldStorm"></div><div class="sunBlast"></div><div class="orbit mega"></div>`;
    for (let i = 0; i < 18; i++) html += `<div class="meteor royalMeteor" style="animation-delay:${i * .055}s"></div>`;
    for (let i = 0; i < 12; i++) html += `<div class="burst goldBurst" style="left:${8 + i * 8}%;top:${18 + (i % 4) * 16}%;animation-delay:${i * .09}s"></div>`;
  } else if (effect === "straightflush") {
    html += `<div class="neonTunnel big"></div><div class="rainbowRoad"></div><div class="orbit mega"></div>`;
    for (let i = 0; i < 16; i++) html += `<div class="laser megaLaser" style="--i:${i};animation-delay:${i * .04}s"></div>`;
  } else if (effect === "fourkind") {
    html += `<div class="quadShock"></div><div class="screenPunch">✦ ✦ ✦ ✦</div>`;
    for (let i = 0; i < 4; i++) html += `<div class="pillar superPillar" style="left:${14+i*24}%"></div>`;
  } else if (effect === "fullhouse") {
    html += `<div class="mansionFlash"></div><div class="houseDrop">◆</div><div class="houseDrop two">◆</div><div class="houseDrop three">◆</div><div class="houseRing"></div>`;
  } else if (effect === "flush") {
    html += `<div class="waterWave big"></div><div class="suitRain">♥ ♦ ♣ ♠ ♥ ♦ ♣ ♠</div><div class="blueSplash"></div>`;
  } else if (effect === "straight") {
    html += `<div class="straightGrid"></div><div class="lightningLine big"></div><div class="lightningLine big second"></div><div class="lightningLine big third"></div><div class="boltIcon">⚡</div>`;
  } else if (effect === "threekind") {
    html += `<div class="triplePulse big"></div><div class="tripleText">3 3 3</div>`;
  } else if (effect === "twopair") {
    html += `<div class="ring big"></div><div class="ring big second"></div><div class="pairClash">×2</div>`;
  } else if (effect === "onepair") {
    html += `<div class="ring big subtle"></div><div class="pairClash small">PAIR</div>`;
  } else {
    html += `<div class="dustPop"></div>`;
  }
  return html;
}

function bustedEffectHTML() {
  return `
    <div class="bustCrack"></div>
    <div class="skullRain">💀 💸 🤡 💀 💸 🤡</div>
    <div class="redExplosion"></div>
  `;
}






function removeOverlay(id) {
  const old = document.getElementById(id);
  if (old) old.remove();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}