
const fs = require("fs");
const path = require("path");

const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "style.css"), "utf8");

const checks = [
  ["add bot server socket", server.includes('socket.on("addBot"') && server.includes("performBotAction")],
  ["remove bot server socket", server.includes('socket.on("removeBot"')],
  ["emit skips bot sockets", server.includes("if (!p.isBot) io.to(p.id).emit")],
  ["add bot button in renderLobby", client.includes('id="addBotBtn"') && client.includes('socket.emit("addBot")')],
  ["remove bot button in renderLobby", client.includes("data-remove-bot") && client.includes('socket.emit("removeBot"')],
  ["bot visible in public state", server.includes("isBot: !!p.isBot")],
  ["history sent and rendered", server.includes("history: room.history || []") && html.includes('id="historyLog"') && client.includes("function renderHistoryLog")],
  ["emote duplicate fixed", client.includes("Server broadcast will show exactly one bubble") && !client.includes('spawnEmoteBubble(btn.dataset.emote, "You")')],
  ["sequential final", client.includes("showBustedThenFinal") && client.includes("setTimeout") && client.includes("showFinalOrShowdown")],
  ["busted wording", server.includes("可以回家种地了") && client.includes("可以回家种地了")],
  ["simple turnIndex retained", client.includes("state.players[state.turnIndex]") && !client.includes("me?.actionState")]
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
