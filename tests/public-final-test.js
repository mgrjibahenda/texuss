
const fs = require("fs");
const path = require("path");

const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "style.css"), "utf8");

const checks = [
  ["uses simple turnIndex client buttons", (client.includes("current?.id === me.id") || client.includes("state.players[state.turnIndex]?.id === me.id")) && !client.includes("me?.actionState")],
  ["no preview button", !html.includes('id="galleryBtn"') && !client.includes('galleryBtn").onclick') && !client.includes("function openEffectGallery")],
  ["all-in runout exists", server.includes("function runOutBoardAndFinish") && server.includes("while (room.community.length < 5")],
  ["simple afterAction retained", server.includes("if (allBetsMatchedOrAllIn(room)) return endBettingRound(room)")],
  ["emote system retained", html.includes('id="emoteBar"') && client.includes("function renderEmotes") && server.includes('socket.on("sendEmote"')],
  ["emotes safe click", client.includes("ev.stopPropagation()") && css.includes("emoteBubble") && css.includes("pointer-events: none")],
  ["action buttons above emotes", css.includes("z-index: 5000") && css.includes("z-index: 3000")],
  ["renderActions sends normal action", client.includes('socket.emit("action", { type, amount })')]
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
