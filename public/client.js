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
let musicPulseTimer = null;
let currentMusicMood = "lobby";

const $ = (id) => document.getElementById(id);

function stopAllSounds() {
  try {
    if (musicNodes?.pulse) clearInterval(musicNodes.pulse);
    if (musicPulseTimer) clearInterval(musicPulseTimer);
    musicPulseTimer = null;
    musicNodes = null;
    if (audioCtx && audioCtx.state !== "closed") {
      audioCtx.close();
    }
    audioCtx = null;
  } catch (e) {
    console.warn("Could not stop sounds", e);
  }
}

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



function setMusicMood(mood = "lobby") {
  currentMusicMood = mood;
  if (!musicNodes?.master || !audioCtx) return;
  const ctx = getAudio();
  const target = mood === "royal" ? 0.070 :
    mood === "straightflush" ? 0.060 :
    mood === "bust" ? 0.066 :
    mood === "showdown" ? 0.055 :
    mood === "hand" ? 0.045 :
    0.035;
  musicNodes.master.gain.cancelScheduledValues(ctx.currentTime);
  musicNodes.master.gain.setTargetAtTime(target, ctx.currentTime, 0.25);
}

function startBackgroundMusic() { return; }

function chord(freqs, dur = 0.45, type = "sine", gain = 0.035, delay = 0) {
  freqs.forEach((f, i) => tone(f, dur, type, gain * (0.92 - i * 0.06), delay + i * 0.015));
}

function riser(startFreq, endFreq, dur = 0.9, type = "sawtooth", gain = 0.035, delay = 0) {
  if (!soundEnabled) return;
  const ctx = getAudio();
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime + delay);
  osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + delay + dur);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(700, ctx.currentTime + delay);
  filter.frequency.exponentialRampToValueAtTime(4500, ctx.currentTime + delay + dur);
  vol.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
  vol.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + delay + 0.08);
  vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + dur);
  osc.connect(filter);
  filter.connect(vol);
  vol.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + dur + 0.05);
}

function impact(power = 1, delay = 0) {
  noise(0.18 + power * 0.08, 0.045 + power * 0.018, delay, 420 + power * 140);
  tone(52 + power * 6, 0.22 + power * 0.04, "sawtooth", 0.045 + power * 0.012, delay);
  tone(96 + power * 18, 0.15, "square", 0.025, delay + 0.04);
}

function coinCascade(count = 8, delay = 0) {
  for (let i = 0; i < count; i++) {
    tone(760 + Math.random() * 740, 0.035 + Math.random() * 0.04, "square", 0.010 + Math.random() * 0.012, delay + i * 0.035);
  }
  noise(0.15, 0.018, delay + 0.05, 3600);
}


function playEffectSound(effect, rank = 0, finalWinner = false) {
  if (!soundEnabled) return;
  const r = Math.max(1, rank || 1);
  const base = 260 + r * 45;

  if (effect === "royal") {
    chord([523.25, 659.25, 783.99, 1046.5], 0.75, "sine", 0.040, 0);
    coinCascade(16, 0.20);
    impact(2.4, 0.35);
  } else if (effect === "straightflush") {
    riser(260, 1040, 0.55, "sine", 0.030, 0);
    chord([392, 493.88, 587.33], 0.55, "triangle", 0.032, 0.35);
  } else if (effect === "fourkind") {
    impact(1.9, 0);
    impact(2.1, 0.18);
    chord([196, 246.94, 293.66], 0.45, "triangle", 0.030, 0.35);
  } else if (effect === "fullhouse") {
    chord([220, 277.18, 329.63], 0.50, "triangle", 0.030, 0);
    coinCascade(10, 0.18);
  } else if (effect === "flush") {
    noise(0.28, 0.024, 0, 1600);
    chord([440, 554.37, 659.25], 0.45, "sine", 0.026, 0.08);
  } else if (effect === "straight") {
    for (let i = 0; i < 5; i++) tone(300 + i * 80, 0.07, "triangle", 0.024, i * 0.06);
  } else if (effect === "threekind") {
    impact(1.2, 0);
    impact(1.2, 0.14);
    impact(1.2, 0.28);
  } else if (effect === "twopair") {
    chord([330, 415.30], 0.16, "triangle", 0.026, 0);
    chord([392, 493.88], 0.18, "triangle", 0.026, 0.18);
  } else if (effect === "onepair") {
    tone(392, 0.10, "triangle", 0.024, 0);
    tone(523.25, 0.12, "triangle", 0.020, 0.12);
  } else if (effect === "bust") {
    impact(1.8, 0);
    noise(0.35, 0.055, 0.08, 650);
    tone(90, 0.35, "sawtooth", 0.045, 0.12);
  } else {
    tone(base, 0.12, "triangle", 0.022);
  }

  if (finalWinner) {
    setTimeout(() => {
      chord([392, 523.25, 659.25, 783.99], 0.65, "sine", 0.036, 0);
      coinCascade(14, 0.12);
    }, 450);
  }
}

function playSound(name, rank = 0, effect = null, finalWinner = false) {
  if (!soundEnabled) return;
  try {
    if (name === "deal") {
      noise(0.055, 0.030, 0, 2200);
      tone(560, 0.045, "triangle", 0.020, 0.015);
    } else if (name === "chip") {
      coinCascade(4, 0);
    } else if (name === "fold") {
      tone(190, 0.12, "sawtooth", 0.030);
      noise(0.10, 0.020, 0.02, 650);
    } else if (name === "allin") {
      impact(2.8, 0);
      riser(110, 420, 0.36, "sawtooth", 0.045, 0.02);
      coinCascade(18, 0.18);
    } else if (name === "emote") {
      tone(780, 0.06, "sine", 0.024);
      tone(1040, 0.08, "sine", 0.020, 0.055);
    } else if (name === "bust") {
      playEffectSound("bust", 0);
    } else if (name === "hand") {
      const base = 300 + rank * 70;
      tone(base, 0.09, "triangle", 0.026);
      tone(base * 1.28, 0.12, "triangle", 0.024, 0.08);
      if (rank >= 5) tone(base * 1.62, 0.20, "sine", 0.028, 0.18);
      if (rank >= 7) riser(base * 0.9, base * 2.3, 0.45, "sine", 0.025, 0.20);
    } else if (name === "showdown") {
      playEffectSound(effect || "highcard", rank, finalWinner);
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

function stopCanvasCinematic() {
  const c = document.getElementById("canvasCinematicFx");
  if (c) c.remove();
}

function stopThreeCinematic() {
  const t = document.getElementById("threeCinematicFx");
  if (t) t.remove();
}



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
  openEffectGallery();
};



$("soundToggle").onclick = () => {
  soundEnabled = !soundEnabled;
  $("soundToggle").textContent = soundEnabled ? "🔊 Sound On" : "🔇 Sound Off";
  const menuBtn = $("menuSoundBtn");
  if (menuBtn) menuBtn.textContent = soundEnabled ? "🔊 Sound On" : "🔇 Sound Off";
  if (soundEnabled) {
    getAudio();
    playSound("chip");
  } else {
    stopAllSounds();
  }
};


$("menuSoundBtn").onclick = () => {
  soundEnabled = !soundEnabled;
  const label = soundEnabled ? "🔊 Sound On" : "🔇 Sound Off";
  $("menuSoundBtn").textContent = label;
  const toggle = $("soundToggle");
  if (toggle) toggle.textContent = label.replace("Sound", "Sound");
  if (soundEnabled) {
    getAudio();
    playSound("chip");
  } else {
    stopAllSounds();
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
    if (bustedIds.has(p.id)) { seat.classList.add("busted"); seat.classList.add("seatCollapsed"); }
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
  overlay.className = `handOverlay cleanHandOverlay effect-${score.effect}`;
  overlay.innerHTML = `
    <div class="miniCleanEffect mini-${score.effect}">
      <div class="miniRing"></div>
      <div class="handTitle">你开出了 ${escapeHtml(score.cn)}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.style.animation = "cleanFadeOut .35s ease both";
    setTimeout(() => removeOverlay("handOverlay"), 360);
  }, 1500);
}


function showShowdownEffect(winners, busted, finalWinner = null) {
  removeOverlay("showOverlay");
  if (!winners.length) return;

  const strongest = winners.reduce((a, b) => (b.rank > a.rank ? b : a), winners[0]);
  const effect = strongest.effect || "highcard";
  const title = finalWinner ? "FINAL WINNER" : (winners.length > 1 ? "SPLIT POT" : "SHOWDOWN");
  const winLines = winners
    .map(w => `<div class="cleanWinnerName">${escapeHtml(w.name)}</div><div class="cleanWinnerHand">${escapeHtml(w.handNameCn)} +${w.amount}</div>`)
    .join("<br>");
  const bustLines = busted.length
    ? `<div class="cleanBustedText">${busted.map(b => `${escapeHtml(b.name)} 破产观战`).join("<br>")}</div>`
    : "";
  const finalLine = finalWinner ? `<div class="finalLine">${escapeHtml(finalWinner.name)} 最终赢家 · ${finalWinner.chips}</div>` : "";
  const potBreakdown = (state?.potBreakdown || []).length
    ? `<div class="potBreakdown">${state.potBreakdown.map(p => `${p.amount}: ${p.winners.join(", ")} (${p.handNameCn})`).join("<br>")}</div>`
    : "";

  playSound("showdown", strongest.rank, busted.length ? "bust" : effect, !!finalWinner);

  const overlay = document.createElement("div");
  overlay.id = "showOverlay";
  overlay.className = `showOverlay cleanShowdown effect-${busted.length ? "bust" : effect} ${finalWinner ? "final-winner-mode" : ""}`;
  overlay.innerHTML = `
    ${bigEffectHTML(busted.length ? "bust" : effect)}
    <div class="showModal cleanResultCard">
      <div class="showTitle">${title}</div>
      <div class="showDetails">${winLines}</div>
      ${bustLines}
      ${finalLine}
      ${potBreakdown}
    </div>
  `;

  document.body.appendChild(overlay);
  const duration = finalWinner ? 5200 : busted.length ? 4800 : 3600;
  setTimeout(() => {
    overlay.style.animation = "cleanFadeOut .45s ease both";
    setTimeout(() => removeOverlay("showOverlay"), 460);
  }, duration);
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
  const label = handLines[effect] || "";
  if (effect === "bust") {
    return `<div class="cleanEffect cleanBust">
      <div class="collapseIcon">💥</div>
      <div class="emojiRain">💀 💸 😭 🤡 💀 💸 😭 🤡</div>
    </div>`;
  }
  return `<div class="cleanEffect clean-${effect}">
    <div class="cleanRing"></div>
    <div class="cleanPulse"></div>
    <div class="cleanLabel">${escapeHtml(label)}</div>
  </div>`;
}


function bustedEffectHTML() {
  return `<div class="cleanEffect cleanBust">
    <div class="collapseIcon">💥</div>
    <div class="emojiRain">💀 💸 😭 🤡 💀 💸 😭 🤡</div>
  </div>`;
}


function openEffectGallery() {
  stopAllSounds();
  removeOverlay("showOverlay");
  removeOverlay("handOverlay");
  removeOverlay("previewEffect");
  removeOverlay("galleryOverlay");

  const login = $("login");
  const game = $("game");
  if (login) login.classList.add("hidden");
  if (game) game.classList.add("hidden");

  const overlay = document.createElement("div");
  overlay.id = "galleryOverlay";
  overlay.className = "previewMenu";
  overlay.innerHTML = `
    <div class="previewPanel">
      <h1>Preview Effects</h1>
      <p>独立牌型预览菜单。退出时会清除所有音效和动画并返回主菜单。</p>
      <button class="previewExit" id="galleryClose">Exit to Main Menu</button>
      <div class="previewGrid">
        ${galleryHands.map(h => `<button class="previewHand" data-effect="${h.effect}" data-rank="${h.rank}" data-name="${h.name}">${h.name}</button>`).join("")}
      </div>
      <div class="previewStage" id="previewStage">
        <div class="previewSeat demoSeat">
          <div class="seatAvatar">P</div>
          <div class="seatName">Demo Player</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  $("galleryClose").onclick = () => {
    stopAllSounds();
    removeOverlay("showOverlay");
    removeOverlay("handOverlay");
    removeOverlay("previewEffect");
    removeOverlay("galleryOverlay");
    if (login) login.classList.remove("hidden");
  };

  overlay.querySelectorAll("[data-effect]").forEach(btn => {
    btn.onclick = () => {
      removeOverlay("previewEffect");
      const effect = btn.dataset.effect;
      const rank = Number(btn.dataset.rank);
      const name = btn.dataset.name;
      const stage = $("previewStage");
      if (!stage) return;

      stage.className = `previewStage preview-${effect}`;
      stage.innerHTML = `
        <div id="previewEffect" class="previewEffectBox effect-${effect}">
          ${bigEffectHTML(effect)}
          <div class="previewEffectText">${effect === "bust" ? "玩家破产 · 座位塌陷" : name}</div>
        </div>
        <div class="previewSeat demoSeat ${effect === "bust" ? "seatCollapsed" : ""}">
          <div class="seatAvatar">${effect === "bust" ? "💀" : "P"}</div>
          <div class="seatName">Demo Player</div>
        </div>
      `;

      if (soundEnabled) {
        getAudio();
        playEffectSound(effect, rank, false);
      }
    };
  });
}


function removeOverlay(id) {
  if (id === "showOverlay") { if (typeof stopCanvasCinematic === "function") stopCanvasCinematic(); if (typeof stopThreeCinematic === "function") stopThreeCinematic(); }
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