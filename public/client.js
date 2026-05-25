const socket = io();

let state = null;
let lastShowdownKey = "";
let lastPersonalScoreKey = "";
let seenEmoteIds = new Set();

const $ = (id) => document.getElementById(id);

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

$("nextHandBtn").onclick = () => socket.emit("startHand");

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
  $("nextHandBtn").textContent = "Next Hand";

  renderLobby(isHost);
  renderCommunity();
  renderPlayers();
  renderPersonalHandHint();
  renderActions();
  renderEmotes();
  spawnIncomingEmotes();

  const showdownKey = state.phase === "showdown"
    ? `${state.handNumber}|${(state.winners || []).map(w => `${w.id}-${w.handName}-${w.amount}`).join("|")}|${(state.busted || []).map(b=>b.id).join("|")}`
    : "";

  if (state.phase === "showdown" && showdownKey && showdownKey !== lastShowdownKey) {
    lastShowdownKey = showdownKey;
    showShowdownEffect(state.winners || [], state.busted || []);
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
    btn.onclick = () => socket.emit("sendEmote", { emoji: btn.dataset.emote });
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

function showShowdownEffect(winners, busted) {
  removeOverlay("showOverlay");
  if (!winners.length) return;

  const strongest = winners.reduce((a, b) => (b.rank > a.rank ? b : a), winners[0]);
  const effect = strongest.effect || "highcard";
  const title = winners.length > 1 ? "SPLIT POT" : "K.O.";
  const winLines = winners.map(w => `${escapeHtml(w.name)} ${pick(praises)}<br><b>${escapeHtml(w.handNameCn)} +${w.amount}</b>`).join("<br><br>");
  const bustLines = busted.length
    ? `<div class="roast">${busted.map(b => `${escapeHtml(b.name)} ${pick(roasts)}`).join("<br>")}</div>`
    : "";

  const overlay = document.createElement("div");
  overlay.id = "showOverlay";
  overlay.className = `showOverlay showdown effect-${effect} ${busted.length ? "has-bust" : ""}`;
  overlay.innerHTML = `
    <div class="arenaFlash"></div>
    ${bigEffectHTML(effect)}
    ${busted.length ? bustedEffectHTML() : ""}
    <div class="showModal">
      <div class="showTitle">${title}</div>
      <div class="showDetails">${winLines}</div>
      ${bustLines}
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
  let html = "";
  if (effect === "royal") {
    html += `<div class="royalCrown">♛</div><div class="goldStorm"></div><div class="orbit mega"></div>`;
    for (let i = 0; i < 12; i++) html += `<div class="meteor royalMeteor" style="animation-delay:${i * .08}s"></div>`;
    for (let i = 0; i < 8; i++) html += `<div class="burst" style="left:${10 + i * 11}%;top:${22 + (i % 3) * 18}%;animation-delay:${i * .12}s"></div>`;
  } else if (effect === "straightflush") {
    html += `<div class="neonTunnel big"></div><div class="orbit mega"></div>`;
    for (let i = 0; i < 10; i++) html += `<div class="laser" style="--i:${i};animation-delay:${i * .08}s"></div>`;
  } else if (effect === "fourkind") {
    html += `<div class="quadShock"></div>`;
    for (let i = 0; i < 4; i++) html += `<div class="pillar" style="left:${20+i*20}%"></div>`;
  } else if (effect === "fullhouse") {
    html += `<div class="houseDrop">◆</div><div class="houseDrop two">◆</div><div class="houseDrop three">◆</div>`;
  } else if (effect === "flush") {
    html += `<div class="waterWave big"></div><div class="suitRain">♥ ♦ ♣ ♠</div>`;
  } else if (effect === "straight") {
    html += `<div class="lightningLine big"></div><div class="lightningLine big second"></div>`;
  } else if (effect === "threekind") {
    html += `<div class="triplePulse big"></div>`;
  } else if (effect === "twopair") {
    html += `<div class="ring big"></div><div class="ring big second"></div>`;
  } else if (effect === "onepair") {
    html += `<div class="ring big subtle"></div>`;
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