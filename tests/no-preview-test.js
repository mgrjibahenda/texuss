
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

const checks = [
  ["preview button removed from html", !html.includes('id="galleryBtn"')],
  ["openEffectGallery removed", !client.includes("function openEffectGallery")],
  ["gallery click removed", !client.includes('$("galleryBtn").onclick')],
  ["core action state still exists", server.includes("function playerActionState")],
  ["emoji still exists", client.includes("function renderEmotes") && server.includes('socket.on("sendEmote"')],
  ["action buttons still exist", client.includes("Check / 过牌") && client.includes("Call / 跟注")]
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
