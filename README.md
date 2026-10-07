# claude-statusline

[中文](README.zh-CN.md) | English

Claude Code usage status line — one line at the bottom of the terminal:

```
glm-5.3-flash │ ██░░░░░░░░░░░░ 17% 34.2k/200k │ in 1.2M (cached 1.1M) │ out 45.3k │ ¥0.85 10-07 21:30
```

- Context progress bar: green under 50%, yellow under 80%, red at or above.
- Session totals: input (including cache writes) / cache hits / output.
- Cost in ¥ from the `PRICES` table (¥ per 1M tokens). DeepSeek has two rate tiers: peak is Mon–Fri 01:00–04:00 and 06:00–10:00 UTC, off-peak is exactly half. Models that are not in the table fall back to the client's own USD estimate × `USD_CNY` (default 7.2).
- Model ids are matched literally, one row per id — only the `[1m]` context marker is stripped. A renamed id shows up as unpriced rather than quietly borrowing another model's rate.
- Redraws after every turn, plus once a minute so the clock stays current.

## Install

Requires Node.js.

```bash
git clone https://github.com/Miaoge-Ge/claude-statusline && cd claude-statusline
bash statusline/install.sh
```

Re-run it to update.

## Uninstall

Delete `"statusLine"` from `~/.claude/settings.json` and remove `~/.claude/statusline.cjs`.

## Customize

Edit the top of [statusline/statusline.cjs](statusline/statusline.cjs):

- `PRICES` — `[cache-hit, cache-miss, output]` per 1M tokens. A row priced per time tier is written `peak => peak ? [...] : [...]`.
- `USD_CNY` — the fallback conversion rate.
- `W` — bar width, and the two colour thresholds just below it.
- Refresh cadence lives in `~/.claude/settings.json` as `statusLine.refreshInterval`, in seconds.

Then re-run `bash statusline/install.sh`, and `node statusline/test.cjs` to confirm every known model id still hits `PRICES`.
