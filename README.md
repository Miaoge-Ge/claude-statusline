# claude-statusline

Claude Code 底部状态栏：上下文进度条 + 会话累计 token（输入/缓存/输出）+ 人民币费用。

```
glm-5.3-flash │ ██░░░░░░░░░░░░ 17% 34.2k/200k │ in 1.2M (cached 1.1M) │ out 45.3k │ ¥0.85
```

- 进度条：<50% 绿、<80% 黄、≥80% 红
- 费用按 `statusline.cjs` 顶部 `PRICES` 表计算（¥/百万 tokens），deepseek 按高峰时段（周一至五 9–12、14–18）自动切换两档价
- 表外模型：美元估算 × `USD_CNY`（默认 7.2）

## 安装

需要 Node.js。Mac / Linux / Windows(Git Bash)：

```bash
bash install.sh
```

或者发布到 GitHub 后一行安装：

```bash
curl -fsSL https://raw.githubusercontent.com/<你>/<repo>/main/install.sh | bash
```

## 卸载

删掉 `~/.claude/statusline.cjs`，并从 `~/.claude/settings.json` 移除 `"statusLine"`。

## 自定义

全部在 `statusline.cjs` 顶部：

- `PRICES`：加模型 / 改价格，格式 `[缓存命中价, 输入价, 输出价]`，deepseek 那种分时段的写成 `peak => peak ? [...] : [...]`
- `USD_CNY`：表外模型的兜底汇率
- 进度条宽度改 `W = 14`，颜色阈值改 `< 50 / < 80`
