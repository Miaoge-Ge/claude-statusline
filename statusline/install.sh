#!/usr/bin/env bash
# Install the statusline variant: copies statusline.cjs to ~/.claude/ and sets
# statusLine in ~/.claude/settings.json. Requires Node.js. Re-run to update.
set -e
command -v node >/dev/null || { echo "Please install Node.js first: https://nodejs.org"; exit 1; }

claude plugin uninstall usage-band 2>/dev/null || true # drop the old band variant

DIR="$(dirname "$0")"
mkdir -p "$HOME/.claude"
cp "$DIR/statusline.cjs" "$HOME/.claude/statusline.cjs"

node -e '
const fs = require("fs"), os = require("os")
const home = os.homedir().replace(/\\/g, "/")
const settingsPath = os.homedir() + "/.claude/settings.json"
let s = {}
try { s = JSON.parse(fs.readFileSync(settingsPath, "utf8")) } catch {}
s.statusLine = { type: "command", command: `node "${home}/.claude/statusline.cjs"` }
fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2) + "\n")
console.log("Installed. statusLine -> " + settingsPath)
console.log("Restart Claude Code (or send a message) to see it.")'
