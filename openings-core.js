// Opening book lookups for game review, shared by index.html, make-openings.js and test.js.
// The positions themselves are in openings.js (window.OPENING_CODES), as base-36 32-bit hashes.
(function (root) {
  'use strict';

  // FNV-1a hash of a FEN's piece placement, side to move and castling rights.
  function hash(fen) {
    const key = fen.split(' ').slice(0, 3).join(' ');
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }

  let book = null;
  function inBook(fen) {
    if (!book) book = new Set((root.OPENING_CODES || '').split(',').filter(Boolean).map((c) => parseInt(c, 36)));
    return book.has(hash(fen));
  }

  // chess.com PGNs name the opening they matched in [ECOUrl], ending with the moves past the named
  // line, e.g. ".../Queens-Gambit-Accepted-Central-Variation-McDonnell-Defense-4.Nf3-Bb4-5.Nc3-exd4".
  // Returns how many plies of the game chess.com counts as book (0 if the URL doesn't match sans).
  function ecoUrlPlies(url, sans) {
    if (!url) return 0;
    const slug = decodeURIComponent(String(url).split('/').pop()).replace(/O-O-O/g, 'O_O_O').replace(/O-O/g, 'O_O');
    let ply = -1, last = -1;
    for (const tok of slug.split('-')) {
      const m = tok.match(/^(\d+)\.(\.\.)?(.+)$/);
      if (m) ply = (+m[1] - 1) * 2 + (m[2] ? 1 : 0);
      else if (ply >= 0) ply++;
      else continue;
      const san = (m ? m[3] : tok).replace(/_/g, '-');
      if (ply >= sans.length || sans[ply].replace(/[+#]/g, '') !== san.replace(/[+#]/g, '')) return 0;
      last = ply;
    }
    return last + 1;
  }

  const api = { hash, inBook, ecoUrlPlies };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OpeningBook = api;
})(typeof window !== 'undefined' ? window : globalThis);
