const socket = io();

let state = null;
let lastShowdownKey = "";
let lastPersonalScoreKey = "";
let seenEmoteIds = new Set();
let soundEnabled = false;
let audioCtx = null;
let lastSoundPhaseKey = "";
let lastActionSound = "";
let musicNodes = null;

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


function startBackgroundMusic() {
  if (!soundEnabled || musicNodes) return;
  const ctx = getAudio();
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.035, ctx.currentTime);
  master.connect(ctx.destination);

  const bass = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bass.type = "sine";
  bass.frequency.setValueAtTime(55, ctx.currentTime);
  bassGain.gain.setValueAtTime(0.12, ctx.currentTime);
  bass.connect(bassGain);
  bassGain.connect(master);

  const pad1 = ctx.createOscillator();
  const pad2 = ctx.createOscillator();
  const padGain = ctx.createGain();
  pad1.type = "triangle";
  pad2.type = "sine";
  pad1.frequency.setValueAtTime(220, ctx.currentTime);
  pad2.frequency.setValueAtTime(277.18, ctx.currentTime);
  padGain.gain.setValueAtTime(0.05, ctx.currentTime);
  pad1.connect(padGain);
  pad2.connect(padGain);
  padGain.connect(master);

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.setValueAtTime(0.08, ctx.currentTime);
  lfoGain.gain.setValueAtTime(0.018, ctx.currentTime);
  lfo.connect(lfoGain);
  lfoGain.connect(master.gain);

  bass.start();
  pad1.start();
  pad2.start();
  lfo.start();

  // Soft casino pulse loop.
  const pulse = setInterval(() => {
    if (!soundEnabled || !audioCtx) return;
    tone(440, 0.035, "triangle", 0.012);
    tone(660, 0.04, "sine", 0.009, 0.12);
  }, 3600);

  musicNodes = { master, bass, pad1, pad2, lfo, pulse };
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


const galleryHands = [
  { name: "一对", effect: "onepair", rank: 1, handNameCn: "一对" },
  { name: "两对", effect: "twopair", rank: 2, handNameCn: "两对" },
  { name: "三条", effect: "threekind", rank: 3, handNameCn: "三条" },
  { name: "顺子", effect: "straight", rank: 4, handNameCn: "顺子" },
  { name: "同花", effect: "flush", rank: 5, handNameCn: "同花" },
  { name: "葫芦", effect: "fullhouse", rank: 6, handNameCn: "葫芦" },
  { name: "四条", effect: "fourkind", rank: 7, handNameCn: "四条" },
  { name: "同花顺", effect: "straightflush", rank: 8, handNameCn: "同花顺" },
  { name: "皇家同花顺", effect: "royal", rank: 9, handNameCn: "皇家同花顺" },
  { name: "破产特效", effect: "bust", rank: 0, handNameCn: "破产" }
];


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


$("galleryBtn").onclick = () => {
  const password = prompt("Enter password");
  if (password !== "123") {
    alert("Wrong password");
    return;
  }
  openEffectGallery();
};



$("soundToggle").onclick = () => {
  soundEnabled = !soundEnabled;
  $("soundToggle").textContent = soundEnabled ? "🔊 Sound" : "🔇 Sound";
  if (soundEnabled) {
    getAudio();
    playSound("chip");
    startBackgroundMusic();
  }
};


$("menuSoundBtn").onclick = () => {
  soundEnabled = true;
  getAudio();
  startBackgroundMusic();
  $("menuSoundBtn").textContent = "🔊 Sound + Music On";
  const toggle = $("soundToggle");
  if (toggle) toggle.textContent = "🔊 Sound";
  playSound("showdown", 4);
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

  hostWrap.innerHTML = isHost ? `<button class="primary" id="startHandNow">Start Hand</button>` : "";
  if (isHost) {
    setTimeout(() => {
      const btn = $("startHandNow");
      if (btn) btn.onclick = () => socket.emit("startHand");
    }, 0);
  }

  if (!isHost) {
    controls.innerHTML = `<div class="chipCard">Waiting for dealer to set stacks and start.</div>`;
    return;
  }

  const playerCards = state.players.map(p => `
    <div class="chipCard">
      <label>${escapeHtml(p.name)}</label>
      <input data-chip-player="${p.id}" value="${p.chips}" type="number" min="0" step="10" />
    </div>
  `).join("");

  controls.innerHTML = `
    <div class="setAll">
      <input id="allChipAmount" value="1000" type="number" min="0" step="10" placeholder="Set all stacks to..." />
      <button id="setAllBtn">Set All</button>
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

  $("setAllBtn").onclick = () => {
    socket.emit("setAllChips", { chips: Number($("allChipAmount").value) });
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
      p.isYou ? `<span class="badge">You</span>` : "",
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

function renderActions() {
  const panel = $("actionPanel");
  const buttons = $("actionButtons");
  const me = state.players.find(p => p.isYou);
  const isMyTurn = me && state.players[state.turnIndex]?.id === me.id && !["lobby", "showdown"].includes(state.phase);

  panel.classList.toggle("hidden", !isMyTurn);
  if (!isMyTurn) return;

  const callAmount = Math.max(0, state.currentBet - me.bet);
  $("turnText").textContent = `Your turn. To call: ${callAmount}. Stack: ${me.chips}.`;

  const possible = [];
  if (callAmount === 0) possible.push(`<button data-action="check" class="primary">Check</button>`);
  if (callAmount > 0) possible.push(`<button data-action="call" class="primary">Call ${callAmount}</button>`);
  possible.push(`<button data-action="fold">Fold</button>`);
  possible.push(`<button data-action="allin">All-in</button>`);
  possible.push(`
    <div class="raiseGroup">
      <input id="raiseAmount" type="number" min="${state.currentBet + state.minRaise}" step="10" placeholder="Raise to ${state.currentBet + state.minRaise}+" />
      <button data-action="raise">Raise</button>
    </div>
  `);

  buttons.innerHTML = possible.join("");

  buttons.querySelectorAll("[data-action]").forEach(btn => {
    btn.onclick = () => {
      const type = btn.dataset.action;
      const amount = Number($("raiseAmount")?.value || 0);
      socket.emit("action", { type, amount });
    };
  });
}

function renderEmotes() {
  const bar = $("emoteBar");
  bar.classList.toggle("hidden", !state);
  bar.innerHTML = emotes.map(e => `<button class="emoteBtn" data-emote="${e}">${e}</button>`).join("");
  bar.querySelectorAll("[data-emote]").forEach(btn => {
    btn.onclick = () => { playSound("emote"); socket.emit("sendEmote", { emoji: btn.dataset.emote }); };
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
  if (!winners.length) return;

  const strongest = winners.reduce((a, b) => (b.rank > a.rank ? b : a), winners[0]);
  const effect = strongest.effect || "highcard";
  startCanvasCinematic(effect, { bust: busted.length > 0, duration: finalWinner ? 9000 : 7600 });
  const title = finalWinner ? "FINAL WINNER" : (winners.length > 1 ? "SPLIT POT" : "SHOWDOWN");
  const winLines = winners
    .map(w => `<div class="cleanWinnerName">${escapeHtml(w.name)}</div><div class="cleanWinnerHand">${escapeHtml(w.handNameCn)} +${w.amount}</div>`)
    .join("<br>");
  const bustLines = busted.length
    ? `<div class="roast">${busted.map(b => `${escapeHtml(b.name)} 爆仓观战`).join("<br>")}</div>`
    : "";
  const finalLine = finalWinner ? `<div class="finalLine">${escapeHtml(finalWinner.name)} 统治牌桌 · 最终筹码 ${finalWinner.chips}</div>` : "";

  playSound("showdown", strongest.rank);
  if (busted.length) setTimeout(() => playSound("bust"), 420);
  const overlay = document.createElement("div");
  overlay.id = "showOverlay";
  overlay.className = `showOverlay showdown effect-${effect} ${busted.length ? "has-bust" : ""} ${finalWinner ? "final-winner-mode" : ""}`;
  overlay.innerHTML = `
    <div class="arenaFlash"></div>
    ${bigEffectHTML(effect)}
    ${busted.length ? bustedEffectHTML() : ""}
    <div class="showModal">
      <div class="showTitle">${title}</div>
      <div class="showDetails">${winLines}</div>
      ${bustLines}
      ${finalLine}
    </div>
  `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.animation = "overlayOut .85s ease both";
    setTimeout(() => removeOverlay("showOverlay"), 850);
  }, effect === "royal" ? 7600 : busted.length ? 6500 : 5600);
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
  let html = `<div class="cinemaShake"></div><div class="particleField"></div>`;
  if (effect === "royal") {
    html += `<div class="royalCrown">♛</div><div class="goldStorm ultra"></div><div class="sunBlast ultra"></div><div class="orbit mega"></div><div class="royalThrone"></div>`;
    for (let i = 0; i < 28; i++) html += `<div class="meteor royalMeteor" style="animation-delay:${i * .04}s;top:${8 + (i%9)*8}%"></div>`;
    for (let i = 0; i < 18; i++) html += `<div class="burst goldBurst" style="left:${5 + i * 5.3}%;top:${14 + (i % 5) * 14}%;animation-delay:${i * .07}s"></div>`;
  } else if (effect === "straightflush") {
    html += `<div class="neonTunnel big"></div><div class="rainbowRoad"></div><div class="spaceWarp"></div><div class="orbit mega"></div>`;
    for (let i = 0; i < 22; i++) html += `<div class="laser megaLaser" style="--i:${i};animation-delay:${i * .032}s"></div>`;
  } else if (effect === "fourkind") {
    html += `<div class="quadShock"></div><div class="screenPunch">✦ ✦ ✦ ✦</div><div class="gravityCrush"></div>`;
    for (let i = 0; i < 4; i++) html += `<div class="pillar superPillar" style="left:${10+i*26}%"></div>`;
  } else if (effect === "fullhouse") {
    html += `<div class="mansionFlash"></div><div class="casinoVault"></div><div class="houseDrop">◆</div><div class="houseDrop two">◆</div><div class="houseDrop three">◆</div><div class="houseRing"></div>`;
  } else if (effect === "flush") {
    html += `<div class="waterWave big"></div><div class="suitRain">♥ ♦ ♣ ♠ ♥ ♦ ♣ ♠</div><div class="blueSplash"></div><div class="tidalWall"></div>`;
  } else if (effect === "straight") {
    html += `<div class="straightGrid"></div><div class="lightningLine big"></div><div class="lightningLine big second"></div><div class="lightningLine big third"></div><div class="boltIcon">⚡</div><div class="thunderCloud"></div>`;
  } else if (effect === "threekind") {
    html += `<div class="triplePulse big"></div><div class="tripleText">3 3 3</div><div class="shockRings"></div>`;
  } else if (effect === "twopair") {
    html += `<div class="ring big"></div><div class="ring big second"></div><div class="pairClash">×2</div><div class="dualBlades"></div>`;
  } else if (effect === "onepair") {
    html += `<div class="ring big subtle"></div><div class="pairClash small">PAIR</div><div class="silverPulse"></div>`;
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



function openEffectGallery() {
  removeOverlay("galleryOverlay");
  const overlay = document.createElement("div");
  overlay.id = "galleryOverlay";
  overlay.className = "galleryOverlay";
  overlay.innerHTML = `
    <div class="galleryTopBar">
      <div class="galleryTitle">Effect Preview</div>
      <div class="galleryGrid">
        ${galleryHands.map(h => `<button class="galleryHand" data-effect="${h.effect}" data-rank="${h.rank}" data-name="${h.name}">${h.name}</button>`).join("")}
      </div>
      <button class="galleryClose" id="galleryClose">×</button>
    </div>
    <div class="galleryHelp">点击上方牌型预览。画面和声音与真牌局一致。</div>
  `;
  document.body.appendChild(overlay);
  $("galleryClose").onclick = () => removeOverlay("galleryOverlay");
  overlay.querySelectorAll("[data-effect]").forEach(btn => {
    btn.onclick = () => {
      if (!soundEnabled) {
        soundEnabled = true;
        getAudio();
        startBackgroundMusic();
        const menuBtn = $("menuSoundBtn");
        const toggle = $("soundToggle");
        if (menuBtn) menuBtn.textContent = "🔊 Sound + Music On";
        if (toggle) toggle.textContent = "🔊 Sound";
      }
      const effect = btn.dataset.effect;
      const rank = Number(btn.dataset.rank);
      const name = btn.dataset.name;
      if (effect === "bust") {
        showShowdownEffect(
          [{ id: "demo", name: "Demo Winner", amount: 9999, handNameCn: "四条", effect: "fourkind", rank: 7 }],
          [{ id: "bust", name: "Demo Loser" }],
          null
        );
      } else {
        showShowdownEffect(
          [{ id: "demo", name: "Demo Player", amount: 8888, handNameCn: name, effect, rank }],
          [],
          effect === "royal" ? { id: "demo", name: "Demo Player", chips: 999999 } : null
        );
      }
    };
  });
}


let canvasFx = null;

function stopCanvasCinematic() {
  if (canvasFx?.raf) cancelAnimationFrame(canvasFx.raf);
  if (canvasFx?.canvas) canvasFx.canvas.remove();
  canvasFx = null;
}

function startCanvasCinematic(effect, options = {}) {
  stopCanvasCinematic();

  const canvas = document.createElement("canvas");
  canvas.id = "canvasCinematicFx";
  canvas.className = `canvasCinematicFx canvas-${effect}`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const particles = [];
  const bolts = [];
  const rings = [];
  const chips = [];
  const suits = ["♠", "♥", "♦", "♣"];
  let w = 0;
  let h = 0;
  let t = 0;
  let raf = null;

  const rankPower = {
    foldwin: 1,
    highcard: 1,
    onepair: 2,
    twopair: 3,
    threekind: 4,
    straight: 5,
    flush: 6,
    fullhouse: 7,
    fourkind: 8,
    straightflush: 9,
    royal: 11,
    bust: 9
  }[effect] || 4;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function colorFor(i) {
    const palettes = {
      royal: ["#fff7b0", "#ffd700", "#ff8a00", "#ffffff"],
      straightflush: ["#9dfffc", "#7dff9d", "#f5d66c", "#ffffff"],
      fourkind: ["#d9b3ff", "#ffb3e6", "#ffffff"],
      fullhouse: ["#ffc46b", "#fff0a8", "#ff8d8d"],
      flush: ["#64d2ff", "#d7ffe8", "#ffffff"],
      straight: ["#b8ff7d", "#ffffff", "#eaff74"],
      threekind: ["#ffb3b3", "#fff0a8", "#ffffff"],
      twopair: ["#cde2ff", "#f5d66c", "#ffffff"],
      onepair: ["#ffffff", "#e8e8e8", "#f5d66c"],
      bust: ["#ff3333", "#7b0000", "#ffffff"]
    };
    const p = palettes[effect] || palettes.onepair;
    return p[i % p.length];
  }

  function addParticle(x, y, count, speed, sizeBase, lifeBase, mode = "burst") {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.35 + Math.random());
      const spiral = mode === "spiral" ? i * 0.12 : 0;
      particles.push({
        x, y,
        vx: Math.cos(a + spiral) * sp,
        vy: Math.sin(a + spiral) * sp,
        life: lifeBase * (0.55 + Math.random() * 0.75),
        maxLife: lifeBase,
        size: sizeBase * (0.4 + Math.random() * 1.4),
        color: colorFor(i),
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.22,
        type: Math.random() < 0.18 && rankPower >= 6 ? "suit" : "dot",
        suit: suits[Math.floor(Math.random() * suits.length)]
      });
    }
  }

  function addRing(x, y, color, speed = 10, width = 8) {
    rings.push({ x, y, r: 10, alpha: 1, color, speed, width });
  }

  function addBolt() {
    const y = h * (0.18 + Math.random() * 0.62);
    const points = [];
    const segments = 9 + Math.floor(Math.random() * 6);
    for (let i = 0; i <= segments; i++) {
      points.push({
        x: (w / segments) * i,
        y: y + (Math.random() - 0.5) * h * 0.18
      });
    }
    bolts.push({ points, life: 18 + Math.random() * 18, color: colorFor(0), width: 5 + Math.random() * 8 });
  }

  function addChipSpray(count) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
      const sp = 7 + Math.random() * 12;
      chips.push({
        x: w / 2 + (Math.random() - 0.5) * 80,
        y: h * 0.62,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: 0.28,
        r: 8 + Math.random() * 8,
        life: 120 + Math.random() * 80,
        color: colorFor(i),
        spin: Math.random() * Math.PI
      });
    }
  }

  function initialBurst() {
    const cx = w / 2;
    const cy = h / 2;

    addParticle(cx, cy, 80 + rankPower * 28, 5 + rankPower * 0.8, 3 + rankPower * 0.35, 70 + rankPower * 8, rankPower >= 7 ? "spiral" : "burst");
    addRing(cx, cy, colorFor(0), 8 + rankPower, 6 + rankPower * 0.8);
    addRing(cx, cy, colorFor(1), 12 + rankPower, 4 + rankPower * 0.5);

    if (["royal", "straightflush", "fourkind", "straight"].includes(effect)) {
      for (let i = 0; i < 4 + rankPower; i++) addBolt();
    }

    if (["royal", "straightflush", "fullhouse", "fourkind"].includes(effect)) {
      addChipSpray(40 + rankPower * 8);
    }

    if (effect === "flush") {
      for (let i = 0; i < 9; i++) {
        addRing(cx, h * (0.2 + i * 0.075), "#64d2ff", 7 + i, 5);
      }
    }

    if (effect === "bust" || options.bust) {
      for (let i = 0; i < 10; i++) addRing(cx, cy, "#ff3333", 12 + i * 2, 8);
      addParticle(cx, cy, 260, 13, 5, 92, "burst");
      for (let i = 0; i < 9; i++) addBolt();
    }
  }

  function drawBackground() {
    if (effect === "royal") {
      const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)*0.7);
      grad.addColorStop(0, "rgba(255,215,0,0.20)");
      grad.addColorStop(0.45, "rgba(255,138,0,0.10)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0,0,w,h);
    }
    if (effect === "straightflush") {
      ctx.save();
      ctx.translate(w/2, h/2);
      ctx.rotate(t * 0.018);
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = `hsla(${(i*18+t*4)%360},100%,70%,0.25)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0,0,40+i*24,0,Math.PI*2);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (effect === "straight") {
      ctx.strokeStyle = "rgba(184,255,125,0.16)";
      ctx.lineWidth = 1;
      for (let x = (t*8)%80; x < w; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x,0);
        ctx.lineTo(x,h);
        ctx.stroke();
      }
      for (let y = (t*8)%80; y < h; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0,y);
        ctx.lineTo(w,y);
        ctx.stroke();
      }
    }
  }

  function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life--;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.vy += effect === "bust" ? 0.12 : 0.025;
      p.rot += p.vr;
      const a = Math.max(p.life / p.maxLife, 0);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 16;
      if (p.type === "suit") {
        ctx.font = `${p.size * 4}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.suit, 0, 0);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawRings() {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.r += r.speed;
      r.alpha *= 0.965;
      ctx.save();
      ctx.globalAlpha = r.alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 28;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (r.alpha < 0.03 || r.r > Math.max(w,h)) rings.splice(i, 1);
    }
  }

  function drawBolts() {
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life--;
      ctx.save();
      ctx.globalAlpha = Math.max(b.life / 30, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "white";
      ctx.lineWidth = b.width + 4;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 34;
      ctx.beginPath();
      b.points.forEach((p, idx) => {
        const jitter = (Math.random() - 0.5) * 22;
        if (idx === 0) ctx.moveTo(p.x, p.y + jitter);
        else ctx.lineTo(p.x, p.y + jitter);
      });
      ctx.stroke();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width;
      ctx.stroke();
      ctx.restore();
      if (b.life <= 0) bolts.splice(i, 1);
    }
  }

  function drawChips() {
    for (let i = chips.length - 1; i >= 0; i--) {
      const c = chips[i];
      c.life--;
      c.x += c.vx;
      c.y += c.vy;
      c.vy += c.g;
      c.vx *= 0.992;
      c.spin += 0.22;
      ctx.save();
      ctx.globalAlpha = Math.min(c.life / 35, 1);
      ctx.translate(c.x, c.y);
      ctx.rotate(c.spin);
      ctx.fillStyle = c.color;
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.lineWidth = 3;
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(0,0,c.r,c.r*0.65,0,0,Math.PI*2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      if (c.life <= 0 || c.y > h + 80) chips.splice(i, 1);
    }
  }

  function tick() {
    t++;
    ctx.clearRect(0, 0, w, h);
    drawBackground();

    if (t % Math.max(8, 26 - rankPower * 2) === 0) {
      addParticle(Math.random()*w, Math.random()*h, 10 + rankPower * 2, 2 + rankPower * .25, 2.5, 55, "burst");
    }
    if (["straight", "straightflush", "royal", "bust"].includes(effect) && t % 16 === 0) addBolt();
    if (["royal", "straightflush"].includes(effect) && t % 24 === 0) addRing(w/2, h/2, colorFor(t), 8 + Math.random()*8, 4 + Math.random()*4);
    if (effect === "flush" && t % 20 === 0) addRing(w/2, h * .85, "#64d2ff", 8, 5);

    drawRings();
    drawBolts();
    drawChips();
    drawParticles();

    raf = requestAnimationFrame(tick);
    canvasFx.raf = raf;
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });
  initialBurst();
  canvasFx = { canvas, raf, resize };
  tick();

  setTimeout(() => stopCanvasCinematic(), options.duration || 7600);
}

function removeOverlay(id) {
  if (id === "showOverlay") stopCanvasCinematic();
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