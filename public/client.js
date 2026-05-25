const socket = io();

let state = null;
let lastShowdownKey = "";

const $ = (id) => document.getElementById(id);

$("createBtn").onclick = () => {
  const name = $("name").value.trim() || "Player";
  const customId = $("customId").value.trim();
  socket.emit("createRoom", { name, customId }, handleJoinResponse);
};

$("joinBtn").onclick = () => {
  const name = $("name").value.trim() || "Player";
  const customId = $("customId").value.trim();
  const code = $("roomCode").value.trim();
  socket.emit("joinRoom", { name, customId, code }, handleJoinResponse);
};

$("startBtn").onclick = () => socket.emit("startHand");

document.querySelectorAll("[data-action]").forEach(btn => {
  btn.onclick = () => {
    const type = btn.dataset.action;
    const amount = Number($("raiseAmount").value);
    socket.emit("action", { type, amount });
  };
});

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
  $("message").textContent = state.message;
  $("pot").textContent = state.pot;
  $("startBtn").style.display = socket.id === state.hostId ? "inline-block" : "none";

  const community = $("community");
  community.innerHTML = "";
  state.community.forEach(c => community.appendChild(cardEl(c)));

  const winnerIds = new Set((state.winners || []).map(w => w.customId || w.name));
  const winnerNames = new Set((state.winners || []).map(w => w.name));
  const showdownKey = state.phase === "showdown"
    ? `${state.message}|${(state.winners || []).map(w => `${w.customId || w.name}-${w.handName}-${w.amount}`).join("|")}`
    : "";

  const players = $("players");
  players.innerHTML = "";
  state.players.forEach((p, idx) => {
    const playerIdentity = p.customId || p.name;
    const isWinner = state.phase === "showdown" && (winnerIds.has(playerIdentity) || winnerNames.has(p.name));
    const isBroke = state.phase === "showdown" && p.chips <= 0 && !isWinner;

    const div = document.createElement("div");
    div.className = "player";
    if (idx === state.turnIndex && state.phase !== "showdown") div.classList.add("turn");
    if (p.isYou) div.classList.add("you");
    if (p.folded) div.classList.add("folded");
    if (isWinner) div.classList.add("winner");
    if (isBroke) div.classList.add("broke");

    const winnerInfo = (state.winners || []).find(w => (w.customId || w.name) === playerIdentity || w.name === p.name);
    const winnerBadge = winnerInfo
      ? `<div class="winnerBadge">🏆 ${escapeHtml(playerIdentity)} 牛逼！${escapeHtml(winnerInfo.handName)} +${winnerInfo.amount}</div>`
      : "";

    const brokeBadge = isBroke
      ? `<div class="brokeBadge">💀 ${escapeHtml(playerIdentity)} 破产了，菜得离谱</div>`
      : "";

    div.innerHTML = `
      <div class="meta">
        <span class="name">${escapeHtml(p.name)} ${p.isYou ? "(You)" : ""}</span>
        <span class="chips">${p.chips} chips</span>
      </div>
      <div class="customId">${escapeHtml(playerIdentity)}</div>
      <div class="hand"></div>
      ${winnerBadge}
      ${brokeBadge}
      <div class="tags">
        ${p.bet ? `Bet: ${p.bet}` : ""}
        ${p.folded ? " Folded" : ""}
        ${p.allIn ? " All-in" : ""}
        ${idx === state.dealerIndex ? " Dealer" : ""}
      </div>
    `;

    const hand = div.querySelector(".hand");
    p.hand.forEach(c => {
      const card = cardEl(c);
      if (isWinner) card.classList.add("winningCard");
      if (isBroke) card.classList.add("brokeCard");
      hand.appendChild(card);
    });
    players.appendChild(div);
  });

  if (state.phase === "showdown" && showdownKey && showdownKey !== lastShowdownKey) {
    lastShowdownKey = showdownKey;
    showShowdownEffect(state.winners || [], state.players || []);
  }

  if (state.phase !== "showdown") {
    lastShowdownKey = "";
    removeWinnerOverlay();
  }

  const me = state.players.find(p => p.isYou);
  const isMyTurn = me && state.players[state.turnIndex]?.id === me.id && !["lobby", "showdown"].includes(state.phase);
  const callAmount = me ? Math.max(0, state.currentBet - me.bet) : 0;
  $("turnText").textContent = isMyTurn
    ? `Your turn. Current bet: ${state.currentBet}. To call: ${callAmount}.`
    : `Phase: ${state.phase}. ${state.players[state.turnIndex]?.name || ""}${state.phase !== "showdown" ? "'s turn." : ""}`;

  document.querySelectorAll("[data-action]").forEach(btn => {
    btn.disabled = !isMyTurn;
  });
}

function showShowdownEffect(winners, players) {
  removeWinnerOverlay();
  if (!winners.length) return;

  const brokePlayers = players.filter(p => p.chips <= 0 && !winners.some(w => (w.customId || w.name) === (p.customId || p.name) || w.name === p.name));

  const overlay = document.createElement("div");
  overlay.id = "winnerOverlay";
  overlay.className = "winnerOverlay";

  const title = winners.length === 1 ? "WINNER!" : "SPLIT POT!";
  const details = winners
    .map(w => `${escapeHtml(w.customId || w.name)} 牛逼！${escapeHtml(w.handName)} +${w.amount}`)
    .join("<br>");

  const brokeText = brokePlayers.length
    ? `<div class="brokeDetails">${brokePlayers.map(p => `💀 ${escapeHtml(p.customId || p.name)} 破产了，菜得离谱`).join("<br>")}</div>`
    : "";

  overlay.innerHTML = `
    <div class="confetti"></div>
    <div class="winnerModal">
      <div class="winnerTitle">${title}</div>
      <div class="winnerDetails">${details}</div>
      ${brokeText}
    </div>
  `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add("fadeOut");
    setTimeout(removeWinnerOverlay, 900);
  }, 4200);
}

function removeWinnerOverlay() {
  const old = document.getElementById("winnerOverlay");
  if (old) old.remove();
}

function cardEl(c) {
  const div = document.createElement("div");
  div.className = "card";
  const text = c.code || "🂠";
  div.textContent = text;
  if (text === "🂠") div.classList.add("back");
  if (text.includes("♥") || text.includes("♦")) div.classList.add("red");
  return div;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}