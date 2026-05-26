
const fs = require("fs");
const path = require("path");

const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "style.css"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

const checks = [
  ["player chip stack helper exists", client.includes("function chipStackHTML")],
  ["pot chip stack helper exists", client.includes("function potChipStackHTML") && client.includes("function renderPotChipStack")],
  ["render calls pot chip stack", client.includes("renderPotChipStack();")],
  ["players render chip stack", client.includes("playerChipArea") && client.includes('chipStackHTML(p.chips, "stack-player")')],
  ["bet mini chip stack exists", client.includes("betChipMini") && client.includes('chipStackHTML(p.bet, "stack-bet")')],
  ["seat player dataset exists", client.includes("seat.dataset.seatPlayer = p.id")],
  ["chip animation target uses pot pill", client.includes('document.querySelector(".potPill") || $("pot")')],
  ["real chip CSS exists", css.includes(".realChipStack") && css.includes(".realChip") && css.includes(".potChipStack")],
  ["chip tiers exist", css.includes(".chipTier1") && css.includes(".chipTier2") && css.includes(".chipTier3")],
  ["v27 action features retained", client.includes("showActionToast") && client.includes("animateChipsToPot") && css.includes("actionToast")],
  ["mandatory winner reveal retained", server.includes("revealWinnerIds") && server.includes("room.revealWinnerIds = winners.map(w => w.id)")],
  ["spectator share retained", server.includes("shareCardsWithSpectators") && client.includes("spectatorShareBtn")],
  ["room code still 4", server.includes("for (let i = 0; i < 4; i++)") && html.includes('maxlength="4"')]
];

let ok = true;
for (const [name, pass] of checks) {
  if (!pass) {
    ok = false;
    console.error("FAIL:", name);
  } else {
    console.log("PASS:", name);
  }
}
if (!ok) process.exit(1);
