
const fs = require("fs");
const path = require("path");
const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");

const checks = [
  ["canAct helper exists", server.includes("function canAct(player)")],
  ["action handler does not require actionSeq", !server.includes("Number(actionSeq)") && !client.includes("actionSeq:")],
  ["heads-up dealer is small blind", server.includes("Heads-up: dealer/button is small blind")],
  ["all-in runout to 5 cards", server.includes("while (room.community.length < 5")],
  ["postflop starts left of dealer", server.includes("Postflop: first live player left of dealer/button acts first")],
  ["action accepted before afterAction", server.includes("if (!accepted) return") && server.includes("afterAction(room)")],
  ["disconnect cancels hand", server.includes("resetHandToLobbyAfterDisconnect(room, disconnectedName)")],
  ["client unlock timeout short", client.includes("}, 250);")]
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
