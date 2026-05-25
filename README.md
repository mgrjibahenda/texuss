# Texas Hold'em v12 Gamefeel

## 这版修了什么

### 1. 牌不公平/好牌太多的问题

- 发牌逻辑仍然是一副 52 张牌、每张牌只会出现一次。
- 洗牌改成 Node.js `crypto.randomInt()` 的 Fisher-Yates 洗牌。
- 这比 `Math.random()` 更适合做公平随机。
- 概率和现实德州扑克一样，不会人为提高好牌概率。
- 你觉得好牌多，主要原因通常是：玩家少、每局都看到公共牌、preview/短局样本小，会让高牌型更显眼。

### 2. Final winner 回房间卡住的问题

- 修复 `Back to Room` 后破产玩家仍然处在 folded/all-in 状态的问题。
- 现在回房间后 dealer 可以重新设置所有人的筹码。
- 设置破产玩家筹码后可以正常开始下一局。
- `Set All` 也会彻底清理 busted/finalWinner 状态。

### 3. 特效持续时间太短

- 结算特效时间加长：
  - 普通结算约 9.3 秒
  - 破产约 10.5 秒
  - 同花顺约 10.8 秒
  - 皇家同花顺约 11.5 秒
  - Final Winner 约 12.5 秒

### 4. 声音和 BGM

- 背景音乐仍是 Web Audio 实时生成，但比之前更像游戏氛围：
  - 低频 bass
  - pad 和弦
  - 节奏 pulse
  - 结算时音乐强度会切换 mood
- 每个牌型有不同音效：
  - 一对：轻筹码
  - 两对：双击和筹码
  - 三条：三次重击
  - 顺子：riser + 闪电冲击
  - 同花：水波音 + 和弦
  - 葫芦：金色和弦 + 筹码雨
  - 四条：多次重击 + 低频冲击
  - 同花顺：riser + 激光音阶
  - 皇家同花顺：最高级皇冠和弦 + 金色爆炸 + 筹码雨
  - 破产：低频爆炸 + 噪声塌陷

### 5. 真 3D 大招更明显

- 3D 筹码数量提高。
- 3D 碎片数量提高。
- 镜头 zoom 更明显。
- 牌桌旋转更明显。
- 慢动作时间变长。
- 如果 Three.js 没加载成功，会在屏幕顶部提示 `3D engine not loaded`，这样不会再误以为 3D 生效了。

## 关于真正游戏音乐/音效素材

这一版没有内置外部 mp3/wav，因为不能随便打包有版权的游戏音乐。  
建议后续使用 CC0/royalty-free 音效库，例如 Kenney、OpenGameArt、Pixabay 等，然后把音频放进 `public/audio/` 再接入。

## Render 设置

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```
