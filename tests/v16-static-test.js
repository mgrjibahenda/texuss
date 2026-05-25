
const fs = require("fs");
const path = require("path");
const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

const checks = [
  ["debug state builder", server.includes("function buildDebugState(room)")],
  ["history logger", server.includes("function logHistory(room")],
  ["cancel hand helper", server.includes("function cancelHand(room")],
  ["host cancel socket", server.includes('socket.on("cancelHand"')],
  ["kick player socket", server.includes('socket.on("kickPlayer"')],
  ["set dealer socket", server.includes('socket.on("setDealer"')],
  ["set blinds socket", server.includes('socket.on("setBlinds"')],
  ["action rejection reason", server.includes("actionBlockedReason") && client.includes("actionRejected")],
  ["debug panel html", html.includes('id="debugPanel"')],
  ["history panel html", html.includes('id="historyPanel"')],
  ["client renders debug/history", client.includes("function renderDebugAndHistory")],
  ["client action reason", client.includes("function actionReason")]
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
