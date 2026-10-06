#!/usr/bin/env bash
# Install the mod variant (usage-band): a band above the prompt, loaded as a
# Claude Code plugin from this repo's marketplace. Re-run to update.
# Removes the statusLine setting, so the two variants don't double up.
set -e

node -e '
const fs = require("fs"), p = require("os").homedir() + "/.claude/settings.json"
let s = {}
try { s = JSON.parse(fs.readFileSync(p, "utf8")) } catch {}
if (s.statusLine) {
  delete s.statusLine
  fs.writeFileSync(p, JSON.stringify(s, null, 2) + "\n")
  console.log("Removed statusLine setting")
}'

claude plugin marketplace add Miaoge-Ge/claude-statusline
claude plugin install usage-band@claude-statusline

echo "Installed. Restart Claude Code to see the band above the prompt."
echo "Uninstall anytime: claude plugin uninstall usage-band"
