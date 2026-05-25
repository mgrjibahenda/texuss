# Texas Hold'em Final Clean

## Final Clean 版内容

- 去除复杂 3D / Canvas / 花里胡哨大招特效。
- 移除背景音乐。
- 主菜单保留音效开关：Sound On / Sound Off。
- 保留干净牌型提示和结算特效，避免 display/z-index 问题。
- Preview Effects 进入独立菜单。
- Preview Effects 点击 Exit 会移除所有特效和音效，并返回主菜单。
- 保留 emoji 雨，但只用于破产/预览破产。
- 玩家破产时座位会塌陷、变灰、显示破产观战。
- 保留 final winner、断线踢人、破产观战、房间筹码设置等内容。
- 洗牌使用 Node.js `crypto.randomInt()` + Fisher-Yates，牌型概率和现实一副 52 张牌一致。

## 公平性说明

游戏使用一副 52 张牌，每张牌每局只出现一次，洗牌为公平 Fisher-Yates。

人数减少时，桌上参与玩家变少，所以“至少有一个人拿到强牌”的概率会降低。例如 2 人局总体出现强牌的机会低于 6 人局。这不是通过人为调概率实现的，而是自然由真实发牌规则决定。

## Render 设置

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```

上传覆盖 GitHub 仓库根目录的：

```text
package.json
server.js
README.md
public
```
