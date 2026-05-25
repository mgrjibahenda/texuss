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


let threeFx = null;

function stopThreeCinematic() {
  if (threeFx?.raf) cancelAnimationFrame(threeFx.raf);
  if (threeFx?.cleanup) threeFx.cleanup();
  if (threeFx?.container) threeFx.container.remove();
  threeFx = null;
}

function startThreeCinematic(effect, options = {}) {
  stopThreeCinematic();

  if (!window.THREE) {
    console.warn("Three.js not loaded. Falling back to Canvas/CSS effects only.");
    return;
  }

  const THREE = window.THREE;
  const container = document.createElement("div");
  container.id = "threeCinematicFx";
  container.className = `threeCinematicFx three-${effect}`;
  document.body.appendChild(container);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.018);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 220);
  camera.position.set(0, 18, 42);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const clock = new THREE.Clock();
  const objects = [];
  const flyingCards = [];
  const chips = [];
  const shards = [];
  const rings = [];
  let raf = null;

  const palette = {
    royal: [0xffd700, 0xffffff, 0xff8a00, 0xffef8a],
    straightflush: [0x9dfffc, 0x7dff9d, 0xf5d66c, 0xffffff],
    fourkind: [0xd9b3ff, 0xffb3e6, 0xffffff, 0x8d4dff],
    fullhouse: [0xffc46b, 0xfff0a8, 0xff8d8d, 0xffffff],
    flush: [0x64d2ff, 0xd7ffe8, 0xffffff, 0x008cff],
    straight: [0xb8ff7d, 0xffffff, 0xeaff74, 0x66ff33],
    threekind: [0xffb3b3, 0xfff0a8, 0xffffff, 0xff7755],
    twopair: [0xcde2ff, 0xf5d66c, 0xffffff, 0x77aaff],
    onepair: [0xffffff, 0xe8e8e8, 0xf5d66c, 0xbbbbbb],
    bust: [0xff3333, 0x7b0000, 0xffffff, 0xff8800]
  }[effect] || [0xffffff, 0xf5d66c, 0xaaaaaa];

  const power = {
    onepair: 1.0,
    twopair: 1.25,
    threekind: 1.5,
    straight: 1.9,
    flush: 2.05,
    fullhouse: 2.25,
    fourkind: 2.6,
    straightflush: 3.0,
    royal: 3.6,
    bust: 3.0
  }[effect] || 1.4;

  function mat(color, roughness = 0.32, metalness = 0.45, emissive = 0x000000, emissiveIntensity = 0) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive,
      emissiveIntensity,
      transparent: true
    });
  }

  function add(obj) {
    scene.add(obj);
    objects.push(obj);
    return obj;
  }

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const keyLight = new THREE.PointLight(palette[0], 7.5 * power, 120);
  keyLight.position.set(0, 22, 20);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(palette[1], 4.8 * power, 100);
  rimLight.position.set(-18, 10, -15);
  scene.add(rimLight);

  const flashLight = new THREE.PointLight(palette[2], 0, 150);
  flashLight.position.set(0, 8, 0);
  scene.add(flashLight);

  // 3D poker table
  const tableGroup = new THREE.Group();
  scene.add(tableGroup);

  const tableGeo = new THREE.CylinderGeometry(18, 20, 1.7, 96);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x0c6b42,
    roughness: 0.65,
    metalness: 0.08,
    emissive: 0x073d27,
    emissiveIntensity: 0.18
  });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.y = -1.2;
  tableGroup.add(table);

  const railGeo = new THREE.TorusGeometry(19.2, 1.05, 18, 128);
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x6a371a,
    roughness: 0.38,
    metalness: 0.28,
    emissive: 0x201006,
    emissiveIntensity: 0.12
  });
  const rail = new THREE.Mesh(railGeo, railMat);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = -0.35;
  tableGroup.add(rail);

  const innerGlow = new THREE.Mesh(
    new THREE.TorusGeometry(15.8, 0.07, 8, 128),
    new THREE.MeshBasicMaterial({ color: palette[0], transparent: true, opacity: 0.75 })
  );
  innerGlow.rotation.x = Math.PI / 2;
  innerGlow.position.y = -0.22;
  tableGroup.add(innerGlow);

  // Card texture with rank/effect text
  function makeCardTexture(label, color = "#111") {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 448;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 320, 448);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, "#e9e2d3");
    ctx.fillStyle = grad;
    roundRect(ctx, 12, 12, 296, 424, 24);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#111";
    roundRect(ctx, 22, 22, 276, 404, 20);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "bold 56px Arial";
    ctx.textAlign = "left";
    ctx.fillText(label, 38, 76);
    ctx.font = "bold 112px Arial";
    ctx.textAlign = "center";
    ctx.fillText(label.replace("10", "T").slice(0, 2), 160, 235);
    ctx.font = "bold 42px Arial";
    ctx.fillText(effect.toUpperCase().slice(0, 10), 160, 330);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function spawnCard(i, total, special = false) {
    const labelsByEffect = {
      royal: ["A♠", "K♠", "Q♠", "J♠", "10♠"],
      straightflush: ["9♥", "8♥", "7♥", "6♥", "5♥"],
      fourkind: ["A♠", "A♥", "A♦", "A♣"],
      fullhouse: ["K♠", "K♥", "K♦", "9♠", "9♥"],
      flush: ["A♦", "J♦", "8♦", "5♦", "2♦"],
      straight: ["9♠", "8♥", "7♦", "6♣", "5♠"],
      threekind: ["Q♠", "Q♥", "Q♦"],
      twopair: ["J♠", "J♥", "8♦", "8♣"],
      onepair: ["10♠", "10♥"],
      bust: ["2♣", "7♦"]
    };
    const label = (labelsByEffect[effect] || labelsByEffect.onepair)[i % (labelsByEffect[effect] || labelsByEffect.onepair).length];
    const texture = makeCardTexture(label, label.includes("♥") || label.includes("♦") ? "#c40000" : "#111111");
    const geo = new THREE.PlaneGeometry(3.2, 4.45, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.35,
      metalness: 0.05,
      side: THREE.DoubleSide,
      emissive: palette[i % palette.length],
      emissiveIntensity: special ? 0.18 : 0.06
    });
    const card = new THREE.Mesh(geo, material);
    const angle = (i / total) * Math.PI * 2;
    card.position.set(Math.cos(angle) * 1.2, 2 + i * 0.04, Math.sin(angle) * 1.2);
    card.rotation.set(Math.random() * 0.8, angle, Math.random() * 0.4);
    card.userData = {
      target: new THREE.Vector3((i - (total - 1) / 2) * 4.1, 5 + Math.sin(i) * 0.6, -2.5),
      spin: new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.14, (Math.random() - 0.5) * 0.12),
      flyDelay: i * 0.08,
      baseY: 4.5 + Math.sin(i) * 0.7
    };
    add(card);
    flyingCards.push(card);
  }

  const cardCount = effect === "fourkind" ? 4 : effect === "threekind" ? 3 : effect === "twopair" || effect === "onepair" ? 4 : 5;
  for (let i = 0; i < cardCount; i++) spawnCard(i, cardCount, true);

  function spawnChip(i, count) {
    const geo = new THREE.CylinderGeometry(0.62, 0.62, 0.18, 36);
    const material = new THREE.MeshStandardMaterial({
      color: palette[i % palette.length],
      roughness: 0.28,
      metalness: 0.72,
      emissive: palette[i % palette.length],
      emissiveIntensity: 0.12
    });
    const chip = new THREE.Mesh(geo, material);
    chip.position.set(0, 0.8, 0);
    chip.rotation.x = Math.PI / 2;
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.12 + Math.random() * 0.32 * power;
    chip.userData = {
      v: new THREE.Vector3(Math.cos(angle) * speed, 0.18 + Math.random() * 0.28 * power, Math.sin(angle) * speed),
      g: 0.008,
      rot: new THREE.Vector3(Math.random()*0.25, Math.random()*0.25, Math.random()*0.25),
      life: 200 + Math.random() * 100
    };
    add(chip);
    chips.push(chip);
  }

  const chipCount = Math.min(260, Math.floor(45 + power * 46));
  for (let i = 0; i < chipCount; i++) spawnChip(i, chipCount);

  function spawnShard(i, count) {
    const geo = effect === "bust"
      ? new THREE.TetrahedronGeometry(0.25 + Math.random()*0.6)
      : new THREE.SphereGeometry(0.08 + Math.random()*0.22, 12, 8);
    const material = new THREE.MeshBasicMaterial({ color: palette[i % palette.length], transparent: true, opacity: 0.88 });
    const shard = new THREE.Mesh(geo, material);
    shard.position.set((Math.random()-0.5)*5, 2 + Math.random()*2, (Math.random()-0.5)*5);
    const a = Math.random() * Math.PI * 2;
    const speed = 0.15 + Math.random() * 0.55 * power;
    shard.userData = {
      v: new THREE.Vector3(Math.cos(a)*speed, (Math.random()-0.15)*speed, Math.sin(a)*speed),
      rot: new THREE.Vector3(Math.random()*0.18, Math.random()*0.18, Math.random()*0.18),
      life: 140 + Math.random()*120
    };
    add(shard);
    shards.push(shard);
  }

  const shardCount = Math.min(900, Math.floor(160 + power * 150));
  for (let i = 0; i < shardCount; i++) spawnShard(i, shardCount);

  function spawnRing(i) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2 + i * 1.4, 0.05 + i * 0.01, 8, 128),
      new THREE.MeshBasicMaterial({ color: palette[i % palette.length], transparent: true, opacity: 0.75 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2 + i * 0.08;
    ring.userData = { scaleSpeed: 0.012 + i * 0.003, fade: 0.006 + i * 0.001 };
    add(ring);
    rings.push(ring);
  }
  for (let i = 0; i < Math.floor(3 + power); i++) spawnRing(i);

  // Effect-specific 3D objects
  if (effect === "royal") {
    const crown = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.75, 3.2 + (i % 2)*1.2, 24),
        mat(0xffd700, 0.18, 0.95, 0xffd700, 0.35)
      );
      cone.position.set((i-3)*1.05, 10 + Math.abs(i-3)*0.25, 0);
      crown.add(cone);
    }
    const base = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.34, 16, 96), mat(0xffd700, .18, .95, 0xffd700, .28));
    base.rotation.x = Math.PI/2;
    base.position.y = 8.4;
    crown.add(base);
    crown.userData = { royal: true };
    scene.add(crown);
    objects.push(crown);
  }

  if (effect === "straightflush" || effect === "straight") {
    for (let i = 0; i < 9; i++) {
      const boltMat = new THREE.MeshBasicMaterial({ color: effect === "straight" ? 0xb8ff7d : palette[i % palette.length], transparent: true, opacity: 0.88 });
      const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 42), boltMat);
      bolt.position.set((i-4)*2.8, 6 + Math.sin(i)*2, -4 + Math.cos(i)*2);
      bolt.rotation.set(Math.random()*1.6, Math.random()*3.14, Math.random()*1.6);
      bolt.userData = { bolt: true, speed: 0.025 + Math.random()*0.03 };
      add(bolt);
    }
  }

  if (effect === "bust" || options.bust) {
    table.material.color.setHex(0x3d0505);
    table.material.emissive.setHex(0x220000);
    for (let i = 0; i < 18; i++) {
      const crack = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 12 + Math.random()*16),
        new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.9 })
      );
      crack.position.set((Math.random()-0.5)*24, 0.15, (Math.random()-0.5)*18);
      crack.rotation.y = Math.random()*Math.PI;
      crack.userData = { crack: true };
      tableGroup.add(crack);
    }
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", resize, { passive: true });

  function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  function animate() {
    const dt = Math.min(clock.getDelta(), 0.033);
    const elapsed = clock.elapsedTime;
    const intro = Math.min(elapsed / 1.45, 1);
    const climax = Math.min(Math.max((elapsed - 1.2) / 1.1, 0), 1);
    const slowmo = elapsed > 2.05 && elapsed < 3.05;
    const speedMul = slowmo ? 0.18 : 1;

    // Cinematic camera zoom/rotation
    const zoomIn = easeOutCubic(intro);
    const orbit = elapsed * (0.18 + power * 0.015);
    const radius = 42 - zoomIn * 15 + Math.sin(elapsed*1.6) * 1.4;
    camera.position.x = Math.sin(orbit) * (6 + power);
    camera.position.z = radius;
    camera.position.y = 19 - zoomIn * 8 + Math.sin(elapsed * 1.1) * 1.2;
    if (elapsed > 3.15) {
      camera.position.z += Math.sin((elapsed-3.15) * 2.4) * 2.4;
      camera.position.y += Math.sin((elapsed-3.15) * 1.8) * 1.0;
    }
    camera.lookAt(0, 2.3, -2);

    const shake = (effect === "bust" || power >= 2.5) ? Math.sin(elapsed*45) * 0.08 * power : 0;
    camera.position.x += shake;
    camera.position.y += Math.cos(elapsed*39) * 0.04 * power;

    tableGroup.rotation.y += dt * 0.12 * power * speedMul;
    innerGlow.material.opacity = 0.35 + Math.sin(elapsed*5) * 0.25;
    flashLight.intensity = Math.max(0, Math.sin(elapsed * 7) * 4 * power + climax * 10);

    // Flying cards: true 3D fan, then slow-motion hold
    flyingCards.forEach((card, i) => {
      const localT = Math.max(0, Math.min((elapsed - card.userData.flyDelay) / 1.35, 1));
      const e = easeOutCubic(localT);
      card.position.lerp(card.userData.target, e * 0.16);
      card.position.y += Math.sin(elapsed * 3 + i) * 0.015;
      card.rotation.x += card.userData.spin.x * speedMul;
      card.rotation.y += card.userData.spin.y * speedMul;
      card.rotation.z += card.userData.spin.z * speedMul;
      if (elapsed > 1.6) {
        card.rotation.y = Math.sin(elapsed*1.2 + i) * 0.16;
        card.rotation.x = -0.18 + Math.cos(elapsed*1.4+i) * 0.08;
      }
    });

    chips.forEach((chip, idx) => {
      const d = chip.userData;
      chip.position.addScaledVector(d.v, speedMul);
      d.v.y -= d.g * speedMul;
      chip.rotation.x += d.rot.x * speedMul;
      chip.rotation.y += d.rot.y * speedMul;
      chip.rotation.z += d.rot.z * speedMul;
      if (chip.position.y < -0.1 && d.v.y < 0) {
        chip.position.y = -0.1;
        d.v.y *= -0.42;
        d.v.x *= 0.72;
        d.v.z *= 0.72;
      }
      d.life -= speedMul;
      if (d.life < 40) chip.material.opacity = Math.max(0, d.life/40);
    });

    shards.forEach((s) => {
      const d = s.userData;
      s.position.addScaledVector(d.v, speedMul);
      d.v.multiplyScalar(0.992);
      d.v.y -= (effect === "bust" ? 0.009 : 0.002) * speedMul;
      s.rotation.x += d.rot.x * speedMul;
      s.rotation.y += d.rot.y * speedMul;
      s.rotation.z += d.rot.z * speedMul;
      d.life -= speedMul;
      if (s.material.opacity !== undefined && d.life < 55) s.material.opacity = Math.max(0, d.life/55);
    });

    rings.forEach((r, i) => {
      r.scale.multiplyScalar(1 + r.userData.scaleSpeed * speedMul);
      r.rotation.z += dt * (0.4 + i*0.1) * speedMul;
      r.material.opacity = Math.max(0, r.material.opacity - r.userData.fade * speedMul);
      if (r.material.opacity < 0.08) r.material.opacity = 0.75;
    });

    objects.forEach((obj) => {
      if (obj.userData?.royal) {
        obj.rotation.y += dt * 0.7 * speedMul;
        obj.position.y = Math.sin(elapsed*1.5) * 0.5;
      }
      if (obj.userData?.bolt) {
        obj.rotation.y += obj.userData.speed * 3 * speedMul;
        obj.material.opacity = 0.35 + Math.random() * 0.65;
      }
    });

    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
    if (threeFx) threeFx.raf = raf;
  }

  threeFx = {
    container,
    raf,
    cleanup: () => {
      window.removeEventListener("resize", resize);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
        if (obj.material?.map) obj.material.map.dispose();
      });
    }
  };

  animate();

  const duration = options.duration || (options.finalWinner ? 9800 : 8200);
  setTimeout(() => stopThreeCinematic(), duration);
}

function removeOverlay(id) {
  if (id === "showOverlay") { stopCanvasCinematic(); stopThreeCinematic(); }
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