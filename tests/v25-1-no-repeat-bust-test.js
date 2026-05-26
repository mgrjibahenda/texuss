
const fs = require("fs");
const path = require("path");

const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

const checks = [
  ["activeThisHand field exists", server.includes("activeThisHand")],
  ["activeThisHand set at hand start", server.includes("p.activeThisHand = p.chips > 0")],
  ["busted only if active this hand", server.includes("p.activeThisHand && p.chips <= 0")],
  ["comment explains no repeat busted", server.includes("prevents old busted spectators from triggering busted effects again")],
  ["room code still 4", server.includes("for (let i = 0; i < 4; i++)") && html.includes('maxlength="4"')],
  ["effect queue still exists", client.includes("function runEffectQueue")],
  ["stable turnIndex retained", client.includes("state.players[state.turnIndex]") && !client.includes("me?.actionState")]
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
