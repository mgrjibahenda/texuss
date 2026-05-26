
const fs = require("fs");
const path = require("path");

const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

const displayStart = server.indexOf("function displayPersonalScore");
const displayEnd = server.indexOf("function makeDeck");
const displayFn = server.slice(displayStart, displayEnd);

const checks = [
  ["displayPersonalScore exists", displayStart >= 0],
  ["actual rank priority comment", displayFn.includes("must be shown before pair/two-pair logic")],
  ["actual rank >=4 before personalMadeRanks", displayFn.indexOf("if (actual.rank >= 4) return actual") < displayFn.indexOf("const personalMadeRanks")],
  ["full house example is documented", displayFn.includes("3♣ 9♥") && displayFn.includes("Full House, not Two Pair")],
  ["board pair high card rule still exists", displayFn.includes("compareScore(actual, boardOnly) <= 0")],
  ["board pair returns high card", displayFn.includes('name: "High Card"') && displayFn.includes('cn: "高牌"')],
  ["showdown winner display uses personal score", server.includes("const shownScore = displayPersonalScore(w.hand, room.community)")],
  ["message display uses personal score", server.includes("const shownBest = winners.length === 1 ? displayPersonalScore")],
  ["room code still 4", server.includes("for (let i = 0; i < 4; i++)") && html.includes('maxlength="4"')],
  ["effect queue still exists", client.includes("function runEffectQueue")],
  ["no repeat bust still exists", server.includes("p.activeThisHand && p.chips <= 0")],
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
