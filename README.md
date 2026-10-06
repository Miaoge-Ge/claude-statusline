# claude-statusline

Claude Code 用量显示，两种形态显示同样的信息，**二选一**：

```
glm-5.3-flash │ ██░░░░░░░░░░░░ 17% 34.2k/200k │ in 1.2M (cached 1.1M) │ out 45.3k │ ¥0.85 10-07 21:30
```

- 上下文进度条：<50% 绿、<80% 黄、≥80% 红
- 会话累计 token：输入（含缓存写入）/ 缓存命中 / 输出
- 费用按 `PRICES` 表算（¥/百万 tokens），deepseek 按高峰时段（周一至五 9–12、14–18）自动切换两档价；表外模型按美元估算 × `USD_CNY`（默认 7.2）兜底
- 每次交互结束刷新一次，无后台定时器

| | A. [statusline/](statusline/) 底部状态栏 | B. [band/](band/) Band mod |
|---|---|---|
| 位置 | 终端最底部一行 | 输入框上方一行 |
| 安装 | `bash statusline/install.sh` | `bash band/install.sh` |
| 原理 | 原生 `statusLine` 设置 + Node 脚本 | Claude Code 插件（来自本仓库 marketplace） |
| 依赖 | Node.js | Node.js + Claude Code v2.1.286+ |

两个安装脚本都会自动移除另一种形态，随时切换、重复运行即更新。

## 安装

```bash
git clone https://github.com/Miaoge-Ge/claude-statusline && cd claude-statusline

bash statusline/install.sh     # A. 底部状态栏
bash band/install.sh           # B. Band mod（装完重启 Claude Code）
```

## 卸载 / 切换

```bash
# A → 卸载：删 settings.json 里的 "statusLine"（或直接跑 B 的安装脚本完成切换）
# B → 卸载：claude plugin uninstall usage-band（或直接跑 A 的安装脚本完成切换）
```

## 自定义

- **A**：[statusline/statusline.cjs](statusline/statusline.cjs) 顶部 —— `PRICES`（加模型/改价，格式 `[缓存命中, 输入, 输出]`，分时段的写成 `peak => peak ? [...] : [...]`）、`USD_CNY` 汇率、进度条宽度 `W = 14` 和颜色阈值
- **B**：[band/usage-band/hooks/register.tsx](band/usage-band/hooks/register.tsx) 顶部 —— 同一套 `PRICES` 表，两处改动记得同步

改完 A 重跑 `bash statusline/install.sh`（或直接改 `~/.claude/statusline.cjs`）；B 在本仓库改完重跑 `bash band/install.sh`。
