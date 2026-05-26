
const fs = require("fs"); const path = require("path");
const server = fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
const client = fs.readFileSync(path.join(__dirname,"..","public","client.js"),"utf8");
const css = fs.readFileSync(path.join(__dirname,"..","public","style.css"),"utf8");
const html = fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
const checks = [
["mandatory winner reveal ids exist", server.includes("revealWinnerIds") && server.includes("room.revealWinnerIds = winners.map(w => w.id)")],
["winner reveal overrides hide", server.includes("(room.revealWinnerIds || []).includes(p.id) || !p.hideAtShowdown")],
["spectator share field exists", server.includes("shareCardsWithSpectators")],
["spectator visibility rule exists", server.includes("viewerIsSpectator && p.shareCardsWithSpectators")],
["spectator share socket exists", server.includes('socket.on("toggleSpectatorShare"')],
["client spectator share button exists", client.includes("spectatorShareBtn") && client.includes('socket.emit("toggleSpectatorShare")')],
["last action server exists", server.includes("function setLastAction") && server.includes("room.lastAction")],
["action feedback client exists", client.includes("function renderActionFeedback") && client.includes("showActionToast")],
["seat flash exists", client.includes("flashActionSeat") && css.includes("seatPulse")],
["chip fly animation exists", client.includes("animateChipsToPot") && css.includes("flyingChip")],
["chip delta exists", client.includes("showChipDelta") && css.includes("chipDelta")],
["all-in shake exists", css.includes("tableShake") && client.includes("tableShake")],
["strong turn highlight exists", css.includes("turnSpotlight")],
["hide hand retained", server.includes('socket.on("toggleHideAtShowdown"') && client.includes("hideCardsBtn")],
["blind settings retained", server.includes('socket.on("setBlinds"') && client.includes("smallBlindInput")],
["room code still 4", server.includes("for (let i = 0; i < 4; i++)") && html.includes('maxlength="4"')],
["fullhouse fix retained", server.includes("must be shown before pair/two-pair logic")],
["stable turnIndex", client.includes("state.players[state.turnIndex]") && !client.includes("me?.actionState")]
];
let ok=true; for (const [n,p] of checks){ if(!p){ok=false; console.error("FAIL:",n)} else console.log("PASS:",n)} if(!ok) process.exit(1);
