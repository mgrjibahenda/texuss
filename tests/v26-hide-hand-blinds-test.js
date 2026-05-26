
const fs = require("fs");
const path = require("path");

const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "style.css"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

const checks = [
  ["hideAtShowdown property exists", server.includes("hideAtShowdown")],
  ["showdown visibility respects hideAtShowdown", server.includes('room.phase === "showdown" && !p.hideAtShowdown')],
  ["toggle hide socket exists", server.includes('socket.on("toggleHideAtShowdown"')],
  ["hide resets each hand", server.includes("p.hideAtShowdown = false")],
  ["client hide button exists", client.includes("function renderHideCardsControl") && client.includes('socket.emit("toggleHideAtShowdown")')],
  ["hide button not in lobby/showdown", client.includes('["lobby", "showdown"].includes(state.phase)')],
  ["setBlinds socket exists", server.includes('socket.on("setBlinds"') && server.includes("room.smallBlind = sb") && server.includes("room.bigBlind = bb")],
  ["client blinds UI exists", client.includes("smallBlindInput") && client.includes("bigBlindInput") && client.includes('socket.emit("setBlinds"')],
  ["css exists", css.includes(".hideCardsPanel") && css.includes(".blindSettings")],
  ["room code still 4", server.includes("for (let i = 0; i < 4; i++)") && html.includes('maxlength="4"')],
  ["fullhouse fix retained", server.includes("must be shown before pair/two-pair logic")],
  ["effect queue retained", client.includes("function runEffectQueue")],
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
