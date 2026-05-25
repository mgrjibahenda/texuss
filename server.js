# Texas Hold'em v8 Final Table

## v8 新增/修复

- 修复 iPad / 手机上“一对”等圆圈特效不在正中央的问题。
- 整体画面更真实：牌桌材质、阴影、牌面、玩家框更立体。
- 所有赢家特效进一步增强，整体更华丽。
- 当只剩一个人还有筹码时，出现 FINAL WINNER 最终赢家结算。
- 最终赢家结算后，dealer 可以点 Back to Room 退回房间。
- 有人断线会被踢出房间。
- 如果断线发生在牌局进行中，会显示断线提示，并取消当前手牌退回 lobby，可以重新开一局。
- 断线取消手牌时，会退回本手已投入筹码，避免莫名损失。
- 主菜单新增 Preview Effects。
- 点击 Preview Effects 后输入密码 `123`，可以查看所有牌型对应的赢家特效。
- 特效预览使用和真牌局一样的画面和声音。
- 保留右侧表情栏、音效、破产观战、破产特效。

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
