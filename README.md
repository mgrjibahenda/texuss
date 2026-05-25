# Texas Hold'em v11 Three.js Cinematic

## v11 真 3D 大招升级

这版不是单纯“粒子变多”，而是新增了 Three.js 3D 场景：

- 3D 牌桌模型
- 牌桌旋转
- 镜头 zoom in / zoom out
- 镜头环绕
- 慢动作定格
- 屏幕震动
- 3D 扑克牌飞出并在空中展开
- 3D 筹码喷射和落桌反弹
- 3D 能量环
- 3D 光照和发光材质
- 皇家同花顺有 3D 皇冠
- 顺子 / 同花顺有 3D 电光线
- 破产有红色桌面裂痕和碎片爆炸

同时保留 v10 的 Canvas 粒子层和 CSS 全屏特效，所以现在是三层叠加：

1. Three.js 3D 镜头与物体
2. Canvas 粒子/闪电/筹码
3. CSS 全屏文字/皇冠/裂屏/光柱

## 注意

Three.js 通过 CDN 加载：

```html
https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js
```

如果某些网络环境加载 CDN 失败，游戏仍然能跑，只是会退回 Canvas + CSS 特效。

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
