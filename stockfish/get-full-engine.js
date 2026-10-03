// Downloads the full Stockfish 19 (stockfish-19-single.js/.wasm, about 99 MB) from npm into this folder,
// so deep review works offline when the page is served over HTTP. Without it, deep review downloads the
// same files from the npm CDN. The files are git-ignored. Run: node stockfish/get-full-engine.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const URL = 'https://registry.npmjs.org/stockfish/-/stockfish-19.0.0.tgz';
const WANT = ['stockfish-19-single.js', 'stockfish-19-single.wasm'];

(async () => {
  console.log('downloading', URL);
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const tar = zlib.gunzipSync(Buffer.from(await res.arrayBuffer()));
  let found = 0;
  for (let off = 0; off + 512 <= tar.length && tar[off];) {
    const name = tar.toString('utf8', off, off + 100).replace(/\0.*$/s, '');
    const size = parseInt(tar.toString('utf8', off + 124, off + 136).replace(/\0.*$/s, '').trim(), 8);
    const base = path.basename(name);
    if (name === 'package/bin/' + base && WANT.includes(base)) {
      fs.writeFileSync(path.join(__dirname, base), tar.subarray(off + 512, off + 512 + size));
      console.log('wrote', base, size, 'bytes');
      found++;
    }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  if (found !== WANT.length) throw new Error('engine files not found in package');
})().catch((e) => { console.error(e.message); process.exit(1); });
