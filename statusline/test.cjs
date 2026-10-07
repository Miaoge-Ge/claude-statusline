// node test.cjs -- every id seen in a transcript must hit PRICES, and anything
// else must render no cost at all. A missing row used to fall through to the
// client's own USD estimate, which is how the deepseek numbers went wrong: the
// ids never matched the table. The list is read out of PRICES, so a new row
// cannot be added without being covered here.
const { execFileSync } = require('child_process')
const fs = require('fs'), os = require('os'), path = require('path')
const { PRICES } = require('./statusline.cjs')

// every priced id, plus one [1m] case: that marker is stripped before lookup
const IDS = [...Object.keys(PRICES), 'deepseek-flash[1m]']
const t = path.join(os.tmpdir(), 'statusline-test.jsonl')
fs.writeFileSync(t, JSON.stringify({
  message: { usage: { input_tokens: 1e6, output_tokens: 1e6, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
}) + '\n')

const render = id => execFileSync(process.execPath, [path.join(__dirname, 'statusline.cjs')], {
  input: JSON.stringify({ model: { id }, transcript_path: t }), encoding: 'utf8',
}).replace(/\x1b\[[\d;]*m/g, '')

for (const id of IDS) {
  const yen = /¥([\d.]+)/.exec(render(id))
  if (!yen || !(Number(yen[1]) > 0)) throw new Error(`${id}: not priced, no cost rendered`)
  console.log('ok', id, '¥' + yen[1])
}

if (/¥/.test(render('some-model-that-is-not-listed'))) {
  throw new Error('an unlisted model rendered a cost')
}
console.log('ok unlisted model renders no cost')
