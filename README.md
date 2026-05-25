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


## 14.4 Hard Fix

- Fixed valid action buttons becoming ineffective after another player acted.
- Removed strict `actionSeq` rejection. The server now relies on the authoritative current-turn check instead of rejecting a real current player because their browser had a stale sequence number.
- Kept duplicate-click protection, but only after an action is valid.
- Reduced Socket.IO ping timeout so disconnects are detected faster.
- Disconnect during a hand still cancels the hand and refunds committed chips to remaining players.
- Added `npm run test:hardfix` static safety test.


## 15.0 Core Fix

这版不是小修补，而是重写了服务器核心行动轮换逻辑。

修复重点：

- 去掉前端/后端 `actionSeq` 依赖，避免按钮明明显示但服务器拒绝。
- 服务器只以 `turnIndex` + `canAct(player)` 判断当前玩家是否能行动。
- 2 人局规则：dealer/button = small blind，preflop 先行动。
- postflop：dealer 左手第一个可行动玩家先行动。
- all-in 后没人能行动时，自动发满 5 张公共牌再 showdown。
- 断线时当前手牌取消，已投入筹码返还，房间回 lobby。
- 前端按钮只短暂锁 250ms，避免卡死。
- 加入 `npm run test:core-static` 静态核心规则检查。

注意：这仍然是朋友局网页游戏，不是赌场级软件。


## v17 Playable Fix

这版目标只有一个：让游戏能玩。

核心改动：

- 按钮显示改成服务器驱动：
  - 服务器给每个玩家返回 `actionState`
  - 前端不再自己猜是不是轮到你
  - dealer 行动后，下一个玩家的按钮应该由服务器直接给出
- 行动按钮改成大号中英双语按钮。
- 非你行动时，按钮区明确显示等待谁。
- emoji 栏固定到底部，z-index 提高，点击时 stopPropagation，避免被牌桌/按钮遮挡。
- 保留 v15 的规则核心：heads-up、side pot、all-in runout、断线取消手牌。

测试：

```bash
npm run test:v17
npm run test:core-static
npm run test:hands
```


## v17.1 No Preview

- Removed Preview Effects button from the main menu.
- Removed Preview Effects click handler and preview menu function.
- Kept all actual gameplay code unchanged:
  - server-driven action buttons
  - fair shuffle
  - side pot
  - all-in board runout
  - emoji system
  - sound toggle
