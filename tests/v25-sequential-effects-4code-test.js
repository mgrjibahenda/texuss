
const fs = require("fs");
const path = require("path");

const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

const forbidden = ["mainMenuPanel", "createPanel", "joinPanel", "createModeBtn", "joinModeBtn", "loginShell", "suitLogo", "goldWide", "outlineWide"];

const checks = [
  ["original menu kept", html.includes('class="loginCard"') && html.includes('id="createBtn"') && html.includes('id="roomCode"')],
  ["room code server generates 4", server.includes("for (let i = 0; i < 4; i++)")],
  ["room code html maxlength 4", html.includes('maxlength="4"')],
  ["no replit remnants", forbidden.every(x => !html.includes(x) && !client.includes(x))],
  ["effect queue exists", client.includes("function runEffectQueue")],
  ["winner effect first function exists", client.includes("function showWinnerHandEffect")],
  ["busted effect second function exists", client.includes("function showBustedEffectStep")],
  ["final winner effect last function exists", client.includes("function showFinalWinnerEffect")],
  ["queue order winner busted final", client.indexOf("showWinnerHandEffect") < client.indexOf("showBustedEffectStep") && client.indexOf("showBustedEffectStep") < client.indexOf("showFinalWinnerEffect")],
  ["no overlapping old final helper", !client.includes("showBustedThenFinal") && !client.includes("showFinalOrShowdown")],
  ["bot thinking still 2-5", server.includes("2000 + Math.floor(Math.random() * 3001)")],
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
