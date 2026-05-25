
const fs = require("fs");
const path = require("path");
const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "style.css"), "utf8");

const checks = [
  ["server actionState included", server.includes("function playerActionState") && server.includes("actionState:")],
  ["action handler uses actionState", server.includes("const actionState = playerActionState(room, player)")],
  ["client uses server actionState", client.includes("me?.actionState")],
  ["Chinese action buttons", client.includes("Check / 过牌") && client.includes("Call / 跟注") && client.includes("All-in / 全下")],
  ["emoji click stop propagation", client.includes("ev.stopPropagation()")],
  ["emoji high z-index", css.includes("z-index: 13000")],
  ["action panel high z-index", css.includes("z-index: 12000")]
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
