
const fs = require("fs");
const path = require("path");
const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");

const checks = [
  ["no strict actionSeq rejection", !server.includes("Number(actionSeq) !== Number(room.actionSeq")],
  ["server current turn check remains", server.includes("room.players[room.turnIndex]?.id !== socket.id")],
  ["acceptedAction guard exists", server.includes("let acceptedAction = false") && server.includes("if (!acceptedAction) return")],
  ["all-in board runout exists", server.includes("function runOutBoardAndFinish(room)") && server.includes("while (room.community.length < 5")],
  ["socket ping timeout shortened", server.includes("pingTimeout: 7000")],
  ["client re-enables current-turn buttons", client.includes("if (isMyTurn) actionSubmitting = false")]
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
