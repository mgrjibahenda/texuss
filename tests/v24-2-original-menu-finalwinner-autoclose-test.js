
const fs = require("fs");
const path = require("path");

const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "style.css"), "utf8");

const forbidden = ["mainMenuPanel", "createPanel", "joinPanel", "createModeBtn", "joinModeBtn", "loginShell", "suitLogo", "goldWide", "outlineWide"];
const checks = [
  ["original uploaded menu kept", html.includes('class="loginCard"') && html.includes('id="name"') && html.includes('id="createBtn"') && html.includes('id="roomCode"')],
  ["room code five", html.includes('maxlength="5"')],
  ["no replit remnants", forbidden.every(x => !html.includes(x) && !client.includes(x) && !css.includes(x))],
  ["add bot", server.includes('socket.on("addBot"') && client.includes('id="addBotBtn"')],
  ["bot thinking 2-5 seconds", server.includes("2000 + Math.floor(Math.random() * 3001)")],
  ["history log", server.includes("history: room.history || []") && html.includes('id="historyLog"') && client.includes("function renderHistoryLog")],
  ["emote duplicate fixed", client.includes("Server state broadcast will show exactly one bubble") && !client.includes('spawnEmoteBubble(btn.dataset.emote, "You")')],
  ["sequential final winner", client.includes("showBustedThenFinal") && client.includes("setTimeout") && client.includes("showFinalOrShowdown")],
  ["final winner auto closes", client.includes("closeDelay = finalWinner ? 6500 : 5200") && client.includes('removeOverlay("showOverlay")')],
  ["stable turnIndex", client.includes("state.players[state.turnIndex]") && !client.includes("me?.actionState")]
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
