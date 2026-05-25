
const fs = require("fs");
const path = require("path");
const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");

const checks = [
  ["normalizeTurn exists", server.includes("function normalizeTurn(room)")],
  ["actionState normalizes turn", server.includes("normalizeTurn(room);") && server.includes("function playerActionState")],
  ["no lastAction cooldown in action handler", !server.includes("now - player.lastActionAt < 80")],
  ["startHand clears emotes", server.includes("room.emotes = []")],
  ["startHand validates turn", server.includes("playersAbleToAct(room).length === 0")],
  ["client clears overlays on hand phase change", client.includes("lastRenderedHandPhase") && client.includes('removeOverlay("showOverlay")')],
  ["client unlocks buttons each render", client.includes("buttons.querySelectorAll(\"button\").forEach(b => b.disabled = false)")],
  ["server-driven actionState still exists", server.includes("function playerActionState") && server.includes("actionState:")]
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
