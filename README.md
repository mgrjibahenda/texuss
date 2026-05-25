# Texas Hold'em v10 Canvas Cinematic

## v10 新增

- 新增全屏 Canvas 粒子特效系统。
- 不是单纯 CSS：现在有真正实时绘制的粒子、筹码、闪电、光环、花色符号。
- 皇家同花顺：金色粒子风暴、陨石、星环、筹码喷射。
- 同花顺：彩色隧道、激光、粒子流。
- 四条：紫色爆炸、能量冲击、筹码喷射。
- 葫芦：金色粒子和筹码喷射。
- 同花：蓝色水波、花色粒子。
- 顺子：全屏闪电 + Canvas 电弧。
- 破产：红色爆炸、闪电、粒子碎裂。
- 保留 v9 的背景音乐、主菜单声音、Preview Effects 顶部选择栏、最终赢家、断线踢人等功能。

## 关于 Three.js

这一版优先用 Canvas 2D 粒子系统，因为：
- 不需要外部 CDN。
- Render/GitHub 上传更简单。
- iPad/手机兼容性更稳。
- 性能更适合你这个网页游戏。

如果后面要继续升级，可以再加 Three.js 3D 扑克牌飞出、3D 筹码塔爆炸、镜头旋转等效果。

## Render 设置

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```

上传覆盖 GitHub 仓库后，Render 会自动重新部署。
