const socket = io();

let state = null;
let lastShowdownKey = "";
let lastPersonalScoreKey = "";
const $ = (id) => document.getElementById(id);

const praises = [
  "今晚牌桌唯一真神",
  "这手牌打得像开了天眼",
  "全场智商担当，压迫感拉满",
  "牌桌皇帝登基，其他人请鼓掌",
  "这波不是赢，是降维打击",
  "筹码收割机启动成功",
  "打得太狠了，牌桌都在发抖",
  "这一手足够写进朋友局史书",
  "操作像艺术，收钱像呼吸",
  "这不是运气，这是气运之子",
  "直接把牌桌打成个人秀",
  "这一把属于电影级表演"
];

const roasts = [
  "破产了，牌桌慈善家实锤",
  "筹码走得很安详",
  "已被牌桌温柔送走",
  "今晚主打一个贡献经济",
  "输得很有参与感",
  "从入座到破产，一气呵成",
  "成功把筹码托管给别人",
  "牌没看懂，钱先看没了",
  "被现实狠狠 check-raise 了",
  "钱包进入冷却时间",
  "筹码蒸发术练成了",
  "用实力证明了陪跑精神"
];

const handLines = [
  "你开出了",
  "牌型进化：",
  "你的手牌发光了：",
  "检测到牌桌能量：",
  "组合完成：",
  "这一刻牌面开始说话："
];

const effectLabels = {
  royal: "皇家同花顺 · 天神降临",
  straightflush: "同花顺 · 星河贯穿",
  fourkind: "四条 · 核弹级压制",
  fullhouse: "葫芦 · 豪宅落成",
  flush: "同花 · 海浪吞桌",
  straight: "顺子 · 闪电连线",
  threekind: "三条 · 三重暴击",
  twopair: "两对 · 双刀出鞘",
  onepair: "一对 · 稳稳拿下",
  highcard: "高牌 · 朴素但有效",
  foldwin: "弃牌胜利 · 不战而胜"
};

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

  const showdownKey = state.phase === "showdown"
    ? `${state.handNumber}|${(state.winners || []).map(w => `${w.id}-${w.handName}-${w.amount}`).join("|")}`
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
    if (p.isYou && p.currentScore && p.currentScore.rank >= 1 && !p.folded) seat.classList.add("handmade");

    const hand = p.hand.map(c => cardElHTML(c)).join("");
    const badges = [
      idx === state.dealerIndex ? `<span class="badge dealer">D</span>` : "",
      p.bet ? `<span class="badge bet">Bet ${p.bet}</span>` : "",
      p.allIn ? `<span class="badge allin">All-in</span>` : "",
      p.folded ? `<span class="badge">Fold</span>` : "",
      p.isYou ? `<span class="badge">You</span>` : "",
      p.isYou && p.currentScore && p.currentScore.rank >= 1 && !p.folded ? `<span class="badge handmadeBadge">${escapeHtml(p.currentScore.cn)}</span>` : ""
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

  hint.textContent = `You made: ${me.currentScore.cn}`;
  hint.className = `handHint effectText-${me.currentScore.effect}`;

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
  overlay.className = `handOverlay effect-${score.effect}`;
  overlay.innerHTML = `
    ${smallEffectHTML(score.effect)}
    <div class="handModal">
      <div class="handTitle">${escapeHtml(pick(handLines))} ${escapeHtml(score.cn)}</div>
      <div class="handDetails">${escapeHtml(effectLabels[score.effect] || score.cn)}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.style.animation = "overlayOut .45s ease both";
    setTimeout(() => removeOverlay("handOverlay"), 450);
  }, score.rank >= 5 ? 2500 : 1700);
}

function showShowdownEffect(winners, busted) {
  removeOverlay("showOverlay");
  if (!winners.length) return;

  const strongest = winners.reduce((a, b) => (b.rank > a.rank ? b : a), winners[0]);
  const effect = strongest.effect || "highcard";
  const title = winners.length > 1 ? "SPLIT POT" : "WINNER";
  const winLines = winners.map(w => `${escapeHtml(w.name)}：${pick(praises)}<br><b>${escapeHtml(w.handNameCn)} +${w.amount}</b>`).join("<br><br>");
  const bustLines = busted.length
    ? `<div class="roast">${busted.map(b => `${escapeHtml(b.name)}：${pick(roasts)}`).join("<br>")}</div>`
    : "";

  const overlay = document.createElement("div");
  overlay.id = "showOverlay";
  overlay.className = `showOverlay effect-${effect}`;
  overlay.innerHTML = `
    <div class="confetti"></div>
    ${bigEffectHTML(effect)}
    <div class="showModal">
      <div class="showTitle">${title}</div>
      <div class="showDetails">${winLines}</div>
      <div class="showDetails">${escapeHtml(effectLabels[effect] || strongest.handNameCn)}</div>
      ${bustLines}
    </div>
  `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.animation = "overlayOut .7s ease both";
    setTimeout(() => removeOverlay("showOverlay"), 700);
  }, effect === "royal" ? 6200 : 4700);
}

function smallEffectHTML(effect) {
  let html = "";
  if (["royal", "straightflush", "fourkind", "fullhouse", "flush"].includes(effect)) {
    html += `<div class="confetti"></div>`;
  }
  if (["royal", "straightflush", "fourkind"].includes(effect)) {
    html += `<div class="orbit"></div>`;
  }
  return html;
}

function bigEffectHTML(effect) {
  let html = "";
  if (["royal", "straightflush", "fourkind"].includes(effect)) html += `<div class="orbit"></div>`;
  if (["royal", "straightflush", "fourkind", "fullhouse"].includes(effect)) {
    for (let i = 0; i < 7; i++) html += `<div class="meteor" style="animation-delay:${i * 0.12}s"></div>`;
  }
  if (["royal", "straightflush"].includes(effect)) {
    for (let i = 0; i < 4; i++) {
      html += `<div class="burst" style="left:${20 + i * 20}%;top:${26 + (i % 2) * 24}%;animation-delay:${i * .18}s"></div>`;
    }
  }
  return html;
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