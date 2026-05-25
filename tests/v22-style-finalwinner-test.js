
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "style.css"), "utf8");

const checks = [
  ["replit style panels exist", html.includes("mainMenuPanel") && html.includes("createPanel") && html.includes("joinPanel")],
  ["create join mode handlers", client.includes("createModeBtn") && client.includes("joinModeBtn") && client.includes("showLoginPanel")],
  ["preview removed", !html.includes('id="galleryBtn"') && !client.includes('galleryBtn").onclick') && !client.includes("openEffectGallery")],
  ["final winner suppresses busted render", client.includes("state.finalWinner ? [] : (state.busted || [])")],
  ["showShowdownEffect clears busted", client.includes("if (finalWinner) busted = []")],
  ["server clears busted on final winner", server.includes("room.busted = []") && server.includes("is the final winner")],
  ["replit css exists", css.includes("v22 Replit-style public lobby") && css.includes("goldWide") && css.includes("suitLogo")],
  ["core game still present", server.includes('socket.on("action"') && client.includes('socket.emit("action", { type, amount })')]
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
