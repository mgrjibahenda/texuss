
const fs = require("fs");
const path = require("path");

const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

const checks = [
  ["displayPersonalScore exists", server.includes("function displayPersonalScore")],
  ["currentScore uses displayPersonalScore", server.includes("displayScore(displayPersonalScore(p.hand, room.community))")],
  ["showdown winners use personalScore", server.includes("const personalScore = displayPersonalScore(w.hand, room.community)")],
  ["boardOnly comparison exists", server.includes("compareScore(actual, boardOnly) <= 0")],
  ["public board pair comment exists", server.includes("Public board-made hand should not be shown")]
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
