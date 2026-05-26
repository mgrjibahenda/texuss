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
