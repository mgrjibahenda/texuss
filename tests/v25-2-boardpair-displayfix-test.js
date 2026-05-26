
const fs = require("fs");
const path = require("path");

const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

const checks = [
  ["displayPersonalScore exists", server.includes("function displayPersonalScore")],
  ["public board pair rule exists", server.includes("Public-board made pairs")],
  ["board-only comparison exists", server.includes("compareScore(actual, boardOnly) <= 0")],
  ["currentScore uses personal display", server.includes("displayScore(displayPersonalScore(p.hand, room.community))")],
  ["showdown message uses shownBest", server.includes("const shownBest = winners.length === 1 ? displayPersonalScore")],
  ["winner display uses shownScore", server.includes("const shownScore = displayPersonalScore(w.hand, room.community)")],
  ["high card fallback exists", server.includes('name: "High Card"') && server.includes('cn: "高牌"')],
  ["room code still 4", server.includes("for (let i = 0; i < 4; i++)") && html.includes('maxlength="4"')],
  ["no repeat bust still exists", server.includes("p.activeThisHand && p.chips <= 0")],
  ["effect queue still exists", client.includes("function runEffectQueue")],
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
