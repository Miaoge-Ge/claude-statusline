# claude-statusline

中文 | [English](README.md)

Claude Code 用量状态栏，终端最底部一行：

```
glm-5.3-flash │ ██░░░░░░░░░░░░ 17% 34.2k/200k │ in 1.2M (cached 1.1M) │ out 45.3k │ ¥0.85 10-07 21:30
```

- 上下文进度条：<50% 绿、<80% 黄、≥80% 红
- 会话累计 token：输入（含缓存写入）/ 缓存命中 / 输出
- 费用按 `PRICES` 表算（¥/百万 tokens）。deepseek 分两档价：高峰为周一至五 UTC 01:00–04:00、06:00–10:00，其余时间正好半价
- 模型 id 逐字匹配、一个 id 一行，只剥掉 `[1m]` 这个上下文标记。表里没有的模型**完全不显示费用**，而不是猜一个；宁可不显示，也别给个错的数
- 每轮交互结束后重绘一次，另外每分钟刷新一次，保证时间不滞留

## 安装

需要 Node.js。

```bash
git clone https://github.com/Miaoge-Ge/claude-statusline && cd claude-statusline
bash statusline/install.sh
```

重跑即更新。

## 卸载

删掉 `~/.claude/settings.json` 里的 `"statusLine"`，再删 `~/.claude/statusline.cjs`。

## 自定义

改 [statusline/statusline.cjs](statusline/statusline.cjs) 顶部：

- `PRICES` —— `[缓存命中, 未命中, 输出]` 每百万 tokens；分时段定价的行写成 `peak => peak ? [...] : [...]`
- `W` —— 进度条宽度，紧跟其后的两个阈值是颜色分界
- 刷新频率在 `~/.claude/settings.json` 的 `statusLine.refreshInterval`，单位秒

改完重跑 `bash statusline/install.sh`，并跑 `node statusline/test.cjs` 确认每个已知模型 id 都还能命中 `PRICES`。

## 许可证

[MIT](LICENSE)
