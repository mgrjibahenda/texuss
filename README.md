# Texas Hold'em Stable Pro

这是基于 Final Clean 的规则完善版，重点不是特效，而是真正德州扑克规则稳定。

## 规则升级

- 使用一副 52 张牌。
- 使用 Node.js `crypto.randomInt()` + Fisher-Yates 洗牌。
- 没有人为提高好牌概率。
- 2 人局自然比 6 人局更少出现“有人拿到强牌”的情况，因为参与玩家更少。
- 修复 heads-up 规则：2 人局 dealer/button 是 small blind，preflop 先行动。
- Small blind / Big blind 自动轮换。
- 正确跳过弃牌、all-in、无筹码玩家。
- all-in 后如果没有人还能行动，会自动发完公共牌进入 showdown。
- 支持多人 all-in。
- 支持 side pot 分池。
- 支持 side pot 中不同玩家争夺不同底池。
- 支持平分底池，余数筹码按获胜列表顺序分配。
- 支持弃牌胜利时分池归属。
- 结算时显示 side pot breakdown。
- Final Winner 后返回房间可以重新设置破产玩家筹码并开始下一局。
- 保留干净 UI、音效开关、Preview Effects 独立菜单、破产座位塌陷。

## Render 设置

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```

上传覆盖 GitHub 根目录：

```text
package.json
server.js
README.md
public
```

## 重要说明

这不是赌场软件，也没有เงินจริง功能。它是朋友局虚拟筹码娱乐版。


## 14.1 Bugfix

- Fixed missing `openEffectGallery()` function.
- Fixed missing `stopCanvasCinematic()` / `stopThreeCinematic()` cleanup functions after removing 3D effects.
- Preview Effects button now opens the independent preview menu correctly.
- Exiting preview clears effects/sound and returns to main menu.


## 14.2 Hand Hint Fix

- Fixed the private `你开出了...` hint.
- Board-only hands no longer trigger fake personal hints.
  - Example: board has a pair, but your hole cards do not improve it → no `你开出了一对`.
- The hint now only appears when your hole cards improve the board-only hand.
- The personal made-hand badge is forced to display only on your own seat.
- Added optional local smoke test:

```bash
npm run test:hands
```


## 14.3 Rule Fix

- Fixed full-table all-in only dealing the flop.
- If all remaining players are all-in, the server now automatically runs out flop/turn/river to 5 public cards before showdown.
- Added server-side `actionSeq` to reject stale/double-click actions.
- Added short per-player duplicate action guard.
- Client now sends `actionSeq` and temporarily disables action buttons after a click.
- This targets the bug where one player could appear to check twice because an old click was accepted after the street advanced.
