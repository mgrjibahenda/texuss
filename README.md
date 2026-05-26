# Texas Hold'em Public Final

这是基于你上传的、能正常玩的 v8 版本做的最终大众游玩版。

## 设计原则

- 不使用 v17/v18/v19/v20 的复杂 `actionState / needsAction / requestId` 状态机。
- 保留旧版能玩的核心行动逻辑：前端直接按 `turnIndex` 显示按钮。
- 不重写 heads-up 行动规则，避免再次破坏可玩性。
- 移除 Preview Effects，避免大众版出现隐藏密码入口。
- 保留表情系统，但把它放在不挡按钮的位置。
- 修复全员 all-in 后只发 flop 的问题：现在会自动发满 5 张公共牌再 showdown。

## Render 设置

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```

## 本版包含

- 私人房间
- 虚拟筹码
- 发牌 / call / check / raise / fold / all-in
- 自动 showdown
- 最终赢家结算
- 断线取消当前手牌并回 lobby
- 安全表情栏
- sound toggle

## 测试

```bash
npm run test:public-final
```

注意：这是朋友局/大众娱乐版，不是赌场级精确软件。


## v24.2 Original Menu + Final Winner Auto Close

Based strictly on the uploaded original-menu version.

Fixed:
- FINAL WINNER overlay/effect now auto closes after about 6.5 seconds.
- If final elimination also has a busted player:
  - busted effect appears first
  - FINAL WINNER appears after that
  - FINAL WINNER then auto closes
- Original main menu/loginCard is kept.
- No Replit-style menu code.
- Room code remains 5 characters.

Also includes:
- Add Bot / Remove Bot in lobby.
- Bot thinking time 2–5 seconds.
- Left-top LOG.
- Emoji duplicate fix.
- Busted text: `xxx 可以回家种地了`.


## v25 Sequential Effects + 4-character Room Code

Changes:
- Room code changed from 5 characters to 4 characters.
- Effects are now played in a strict queue:
  1. Winner hand/card effect
  2. Busted effect
  3. FINAL WINNER effect
- Effects do not overlap.
- FINAL WINNER still auto closes after its display time.
- Original uploaded main menu is kept; no Replit-style menu.


## v25.1 No Repeat Busted Effect

Fix:
- Old busted players no longer trigger busted effects again in later hands.
- A player only appears in `busted` if:
  1. they had chips at the start of the current hand, and
  2. they ended the current hand with 0 chips.

This keeps the existing effect order:
1. Winner hand/card effect
2. Newly busted players only
3. FINAL WINNER effect


## v25.2 Board Pair Display Fix

Fix:
- If the board itself makes a pair, and the player's hole cards do not improve it,
  the displayed hand becomes High Card instead of One Pair.
- Example:
  - Board: 4♠ 5♣ 8♦ 5♦ J♥
  - Player: Q♥ 3♠
  - Real poker best hand includes board pair 5s
  - Game display: High Card

Important:
- Winner calculation still uses normal poker comparison internally.
- This change only affects displayed hand name/currentScore/showdown text.


## v25.3 Full House Display Fix

Fix:
- A player-made Full House was incorrectly displayed as Two Pair in cases such as:
  - Hand: 3♣ 9♥
  - Board: 9♦ 9♠ 3♦ J♦ K♣
- The display result is now Full House / 葫芦.

Reason:
- The previous personal display function checked personal two-pair before checking large actual hands.
- The new priority is:
  1. If the board alone makes the same/better hand, display High Card under the custom board-pair rule.
  2. If the actual hand is Straight or better, display the actual hand.
  3. Otherwise display personal pair/two-pair/high-card.


## v26 Hide Hand at Showdown + Blind Settings

Added:

### Hide hand at showdown
- During a hand, each human player gets a button:
  - `End: Show My Cards`
  - `End: Hide Cards ON`
- If enabled, at showdown:
  - the player can still see their own cards
  - other players see the hidden player's cards as card backs
- This only affects display.
- Winner calculation and hand evaluation still use the real cards.
- Hide setting resets at the start of each new hand.

### Blind settings
- In lobby, host can set:
  - Small Blind
  - Big Blind
- Big blind is forced to be larger than small blind.
- New values are used when the next hand starts.


## v27 Action Feedback + Winner Reveal + Spectator Share + Chip FX

Added:
- Central action toast for CHECK / CALL / RAISE / ALL-IN / FOLD.
- Current acting player gets stronger highlight.
- Acting seat flashes after each move.
- ALL-IN shakes the table.
- CALL / RAISE / ALL-IN send flying chip animation toward the pot.
- Chip stack changes show floating + / - numbers.
- Biggest hand winner must reveal cards at showdown, even if hide cards is enabled.
- Each player can toggle whether current spectators may see their cards this hand.

Rules:
- Hide at showdown still works for non-winning players.
- Winner calculation always uses real cards.
- Spectator share only affects viewers who are out of the hand / watching.
- Settings reset each hand.


## v27.1 Real Visual Chip Stacks

Fix:
- v27 had chip movement and +/- chip numbers, but not persistent visible chip stacks.
- v27.1 adds real visual chip stacks beside every player and inside the pot.
- Bigger stack values produce taller visible stacks.
- Current bet also shows a mini chip stack.
- Action chip-fly animations now target the visible pot area more reliably.
