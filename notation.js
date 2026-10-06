// Turns raw chess notation text — typed, or read from a photo of a scoresheet
// by OCR — into a clean PGN. Each token is matched against the legal moves of
// the position it is played in, which absorbs OCR noise (0/O, 1/l, German piece
// letters S/T/L/D, a missing '=' ...) without ever rewriting a legal move.
(function (root) {
  'use strict';

  const RESULTS = /^(1-0|0-1|1\/2-1\/2|½-½|\*)$/i;
  // Characters OCR mixes up, compared case-insensitively (beyond identity).
  const CONFUSABLE = {
    '0': 'o', 'o': '0cq', 'q': '0g', 'g': 'q4', '1': 'li', 'l': '1', 'i': '1',
    '5': 'sy', 's': '5', '8': 'b3', 'b': '86', '3': '8', '6': 'b', '2': 'z', 'z': '2',
    'n': 'h', 'h': 'n', '4': 'gf', 'f': '4', 'c': 'oe', 'e': 'c6', '6': 'be', 'y': '57', '7': 'y', 'z': '23', '3': '8z',
  };

  // Junk OCR that can never be a move (page headers, "e.p.", labels).
  const SKIPPABLE = /^(e\.?p\.?|ep)$/i;

  const clean = (t) => t.replace(/[+#?!]/g, '').replace(/^0-0(-0)?$/, (m) => m.replace(/0/g, 'O'));

  // Strip move numbers, score-sheet punctuation and OCR marks; normalise dashes,
  // accents and the multiplication sign to 'x'. A '$' is read as '3' and a
  // leading lowercase l/i as a mangled move number ('l.e4' → 'e4'). Returns
  // null for tokens that cannot be a move (skipped, not errors). Two bare
  // letters come back as { text, weak: true } — probably junk ("No"), but
  // OCR noise like "ey" for e5 gets a chance to match a legal move first.
  // Letters that survive: files a-h, pieces KQRBN plus German S/T/L/D, castle O.
  function cleanToken(t) {
    let x = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\$/g, '3')
      .replace(/[–—−]/g, '-').replace(/[.,;:!?+#()"'*§×¢€£¥¤]/g, '')
      .replace(/^\d+(?=[a-h0-9koq])/i, '').replace(/^l(?=[a-h0-9])|^i(?=[a-h0-9])/, '');
    if (!x || RESULTS.test(t) || /^\d+$/.test(x) || SKIPPABLE.test(x)) return null;
    if (/^[2-9?]-[0-9?]$|^[0-9?]-[2-9?]$/.test(x)) return null; // misread result ("7-0"), never castling
    if (/[^a-h0-9=xoknqrbstldyz-]/i.test(x)) return null;
    if (/^[a-z]{1,2}$/i.test(x) && !/^[o0]+$/i.test(x)) return { text: x, weak: true };
    return { text: x, weak: false };
  }

  // German piece letters: S(f3)→N, T(a8)→R, L(c4)→B, D(d8)→Q, and the same for
  // a promotion piece. A leading s/t/l/d is only read as a piece when what
  // follows starts like a piece move (a file letter or 'x').
  function germanize(t) {
    let x = t;
    const head = x.match(/^([stld])([a-hx])/i);
    if (head) x = { s: 'N', t: 'R', l: 'B', d: 'Q' }[head[1].toLowerCase()] + x.slice(1);
    return x.replace(/([18])=?([kqrbnstld])$/i, (_, rank, p) => {
      const c = p.toLowerCase();
      if ('kqrbn'.includes(c)) return rank + '=' + p.toUpperCase();
      return rank + '=' + { s: 'N', t: 'R', l: 'B', d: 'Q' }[c];
    });
  }

  // Cost of turning token a into SAN b: 0 for equal or confusable characters
  // (case-insensitive), 1 for other substitutions, insertions and deletions.
  // Returns null when the two are more than one edit apart.
  function editCost(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 1) return null;
    // Short tokens (e4, Nf3) only tolerate character substitutions that OCR
    // actually makes — never a plain flip (e4 vs e5) or a changed length.
    // The cost is the number of differing characters, so the closest reading wins.
    if (Math.min(a.length, b.length) < 4) {
      if (a.length !== b.length) return null;
      let diffs = 0, allConfusable = true;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          diffs++;
          if (!(CONFUSABLE[a[i]] || '').includes(b[i])) allConfusable = false;
        }
      }
      return diffs > 0 && diffs <= 2 && allConfusable ? diffs : null;
    }
    // Otherwise: Levenshtein distance with a confusion-aware substitution cost.
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        const ca = a[i - 1], cb = b[j - 1];
        const sub = prev[j - 1] + (ca === cb || (CONFUSABLE[ca] || '').includes(cb) ? 0 : 1);
        cur[j] = Math.min(sub, prev[j] + 1, cur[j - 1] + 1);
      }
      prev = cur;
    }
    return prev[b.length] <= 1 ? prev[b.length] : null;
  }

  function matchMove(s, token, E) {
    const readings = [...new Set([clean(token).toLowerCase(), clean(germanize(token)).toLowerCase()])];
    const cands = E.legalMoves(s).map((m) => ({ m, sn: clean(E.san(s, m)).toLowerCase() }));
    for (const w of readings) {
      const hit = cands.find((o) => o.sn === w);
      if (hit) return hit.m; // SAN disambiguates, so an exact match is unique
    }
    // No exact match: accept a single unambiguous near neighbour of either reading.
    let best = null, bestCost = 3, ties = 0;
    for (const { m, sn } of cands) {
      let c = null;
      for (const w of readings) {
        const d = editCost(w, sn);
        if (d !== null && (c === null || d < c)) c = d;
      }
      if (c === null) continue;
      if (c < bestCost) { best = m; bestCost = c; ties = 1; }
      else if (c === bestCost) ties++;
    }
    return ties === 1 ? best : null;
  }

  // OCR sometimes glues two half-moves together ("e4e5"). Try every split point.
  function trySplit(s, token, E) {
    if (token.length < 4) return null;
    for (let i = 2; i < token.length - 1; i++) {
      const m1 = matchMove(s, token.slice(0, i), E);
      if (!m1) continue;
      const s2 = E.makeMove(s, m1);
      const m2 = matchMove(s2, token.slice(i), E);
      if (m2) return [m1, s2, m2];
    }
    return null;
  }

  // Reads notation text and returns { pgn, warnings }. Throws with a message
  // naming the first token that is not readable as a legal move.
  function toPGN(text, E) {
    const warnings = [];
    const toks = [];
    let result = '';
    for (const raw of String(text).split(/\s+/)) {
      if (!raw) continue;
      if (RESULTS.test(raw)) { result = raw.replace('½-½', '1/2-1/2'); continue; }
      if (/^(\d+[.)]*|[-–—_=•]+)$/i.test(raw)) continue; // move numbers, stray punctuation
      toks.push(raw);
    }

    let s = E.newGame();
    const sans = [];
    for (const raw of toks) {
      const c = cleanToken(raw);
      if (!c) { warnings.push(`Skipped "${raw}"`); continue; }
      let m = matchMove(s, c.text, E);
      if (!m && c.weak) { warnings.push(`Skipped "${raw}"`); continue; } // "No", "B." junk
      if (m) { sans.push(E.san(s, m)); s = E.makeMove(s, m); continue; }
      const split = trySplit(s, c.text, E);
      if (split) {
        sans.push(E.san(s, split[0]), E.san(split[1], split[2]));
        s = E.makeMove(split[1], split[2]);
        warnings.push(`Split "${raw}" into two moves`);
        continue;
      }
      const n = Math.floor(sans.length / 2) + 1;
      const after = sans.length ? ` after "${sans[sans.length - 1]}"` : '';
      throw new Error(`Move ${n}${sans.length % 2 ? '…' : '.'}: "${raw}" is not readable as a legal move${after}. Fix it in the text and try again.`);
    }
    if (!sans.length) throw new Error('No moves found in the text.');

    const tags = { White: 'White', Black: 'Black', Result: result || '*' };
    let mt = '';
    sans.forEach((sn, i) => {
      if (i % 2 === 0) mt += (i / 2 + 1) + '. ';
      mt += sn + ' ';
    });
    const pgn = Object.entries(tags).map(([k, v]) => `[${k} "${v}"]`).join('\n')
      + '\n\n' + mt.trim() + (result ? ' ' + result : '');
    return { pgn, warnings };
  }

  const api = { toPGN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Notation = api;
})(typeof self !== 'undefined' ? self : this);
