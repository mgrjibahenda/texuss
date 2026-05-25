
const fs = require("fs");
const path = require("path");
const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "style.css"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

const checks = [
  ["preview removed", !html.includes('id="galleryBtn"') && !client.includes("function openEffectGallery")],
  ["server actionState", server.includes("function playerActionState") && server.includes("actionState:")],
  ["client uses actionState", client.includes("me?.actionState")],
  ["core action buttons", client.includes("Check / 过牌") && client.includes("Call / 跟注") && client.includes("All-in / 全下")],
  ["emote system kept", html.includes('id="emoteBar"') && client.includes("function renderEmotes") && server.includes('socket.on("sendEmote"')],
  ["emote does not block core", css.includes("right: 12px") && css.includes("max-width: min(390px, 46vw)")],
  ["emote click safe", client.includes("ev.stopPropagation()") && css.includes("z-index: 13000")],
  ["all-in runout exists", server.includes("while (room.community.length < 5")],
  ["side pot exists", (server.includes("function buildSidePots") || server.includes("function awardSidePots"))]
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
