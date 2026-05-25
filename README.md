# Texas Hold'em Friends

一个朋友之间玩的线上德州扑克网页项目。  
只使用虚拟筹码，不包含真钱赌博、支付、提现等功能。

## 功能

- 创建房间
- 输入房间码加入
- 最多 6 人
- 每人 1000 虚拟筹码
- 自动发 2 张手牌和 5 张公共牌
- Check / Call / Raise / Fold / All-in
- 自动判断胜负
- 实时同步

## 运行方法

### 1. 安装 Node.js

需要 Node.js 18 或更新版本。

检查是否安装：

```bash
node -v
```

### 2. 安装依赖

进入项目文件夹后运行：

```bash
npm install
```

### 3. 启动

```bash
npm start
```

然后打开：

```text
http://localhost:3000
```

### 4. 和朋友一起玩

如果你们在同一个 Wi-Fi：

1. 房主电脑运行 `npm start`
2. 房主在终端里查自己的局域网 IP
   - Mac: `ifconfig`
   - Windows: `ipconfig`
3. 朋友打开类似这个地址：

```text
http://房主IP:3000
```

例如：

```text
http://192.168.1.8:3000
```

如果想让不在同一网络的朋友玩，可以部署到 Render / Railway / Fly.io 等 Node.js 平台。

## 注意

这是学习和朋友娱乐用的 MVP。真实产品还需要：

- 更完整的边池 side pot
- 断线重连
- 账号系统
- 防作弊
- 更严格的下注规则
- 手机 UI 优化
- 日志和数据库

## v2 新增功能

- 开牌 / showdown 时会出现赢家特效
- 赢家区域会发光
- 赢家手牌会闪光跳动
- 屏幕中央会弹出 WINNER / SPLIT POT
- 会显示赢家牌型，例如 Full House、Flush、Straight


## v3 新增功能

- 玩家进入房间前可以填写自己的 Custom ID，例如 @boss001
- 牌桌上会显示玩家名字和自定义 ID
- 开牌时赢家弹窗会显示赢家 ID，并显示“牛逼”夸奖文案
- 筹码归零的破产玩家会显示 ID，并显示搞笑嘲讽文案
