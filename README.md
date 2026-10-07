# claude-statusline

Claude Code 用量状态栏，终端最底部一行：

```
glm-5.3-flash │ ██░░░░░░░░░░░░ 17% 34.2k/200k │ in 1.2M (cached 1.1M) │ out 45.3k │ ¥0.85 10-07 21:30
```

- 上下文进度条：<50% 绿、<80% 黄、≥80% 红
- 会话累计 token：输入（含缓存写入）/ 缓存命中 / 输出
- 费用按 `PRICES` 表算（¥/百万 tokens），deepseek 按高峰时段（周一至五 UTC 01:00–04:00、06:00–10:00，其余时间半价）自动切换两档价；表外模型按美元估算 × `USD_CNY`（默认 7.2）兜底
- 模型名会剥掉 `[1m]` 和 deepseek 的 `-expires-on-MMDD` 后缀再查表，改名了也不会静默掉到兜底
- 每次交互结束刷新一次，无后台定时器

## 安装

```bash
git clone https://github.com/Miaoge-Ge/claude-statusline && cd claude-statusline
bash statusline/install.sh
```

需要 Node.js。重跑即更新。

## 卸载

删掉 `~/.claude/settings.json` 里的 `"statusLine"`，再删 `~/.claude/statusline.cjs`。

## 自定义

改 [statusline/statusline.cjs](statusline/statusline.cjs) 顶部 —— `PRICES`（格式 `[缓存命中, 输入, 输出]`，分时段的写成 `peak => peak ? [...] : [...]`）、`USD_CNY` 汇率、进度条宽度 `W = 14` 和颜色阈值。改完重跑 `bash statusline/install.sh`，或直接改 `~/.claude/statusline.cjs`。改完跑 `node statusline/test.cjs` 确认每个模型名都还能命中 `PRICES`。
