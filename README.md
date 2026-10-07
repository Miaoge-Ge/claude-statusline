# claude-statusline

[中文](README.zh-CN.md) | English

Claude Code usage status line — one line at the bottom of the terminal:

```
glm-5.3-flash │ ██░░░░░░░░░░░░ 17% 34.2k/200k │ in 1.2M (cached 1.1M) │ out 45.3k │ ¥0.85 10-07 21:30
```

- Context progress bar: green under 50%, yellow under 80%, red at or above. Every cell splits into eighths, so the bar advances in ~0.9% steps.
- Session totals: input (including cache writes) / cache hits / output.
- Cost in ¥ from the `PRICES` table (¥ per 1M tokens). DeepSeek has two rate tiers: peak is Mon–Fri 01:00–04:00 and 06:00–10:00 UTC, off-peak is exactly half.
- Model ids are matched literally, one row per id — only the `[1m]` context marker is stripped. A model that is not in the table gets a `?` after its id and **no cost at all**, rather than a guessed one; better nothing than a wrong number.
- Each API call is counted once. Claude Code writes one transcript entry per content block and every one repeats the same usage, so a reply with 9 blocks would otherwise bill 9 times.
- Redraws after every turn, plus once a minute so the clock stays current.
- Fits itself to `COLUMNS`: the cache detail goes first, then bar width, so the line never wraps to a second row.
- Session totals are cached per session under the OS temp directory, keyed on the transcript's size and mtime, so a redraw parses only the newly appended lines.

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
- `MAXW` — cap on bar width (it shrinks below this on a narrow terminal), and the two colour thresholds just above it.
- Refresh cadence lives in `~/.claude/settings.json` as `statusLine.refreshInterval`, in seconds.

Then re-run `bash statusline/install.sh`, and `node statusline/test.cjs` to confirm every known model id still hits `PRICES`.

## License

[MIT](LICENSE)
