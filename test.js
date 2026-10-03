// Run with: node test.js — verifies move generation against known perft counts.
const E = require('./engine.js');
const cases = [
  [E.START_FEN, [20, 400, 8902, 197281]],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
];
let ok = true;
for (const [fen, counts] of cases) {
  const s = E.fromFEN(fen);
  counts.forEach((want, i) => {
    const got = E.perft(s, i + 1);
    if (got !== want) { ok = false; console.log(`FAIL ${fen} d${i + 1}: got ${got}, want ${want}`); }
  });
}
// Game-end detection
const check = (fen, result) => {
  const st = E.status(E.fromFEN(fen));
  if (st.result !== result) { ok = false; console.log(`FAIL status ${fen}: ${st.result} != ${result}`); }
};
check('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', 'checkmate');
check('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 'stalemate');
check('8/8/4k3/8/8/2B5/4K3/8 w - - 0 1', 'material');
check('8/8/4k3/8/8/8/4K3/7R w - - 100 80', 'fifty');
let g = E.newGame();
const play = (from, to) => { g = E.makeMove(g, E.legalMoves(g).find((m) => E.squareName(m.from) === from && E.squareName(m.to) === to)); };
for (let i = 0; i < 2; i++) { play('g1', 'f3'); play('g8', 'f6'); play('f3', 'g1'); play('f6', 'g8'); }
if (E.status(g).result !== 'repetition') { ok = false; console.log('FAIL repetition'); }
// SAN
g = E.newGame(); play('e2', 'e4');
const m = E.legalMoves(g).find((x) => E.squareName(x.to) === 'f6');
if (E.san(g, m) !== 'Nf6') { ok = false; console.log('FAIL san'); }
// AI returns a legal move and finds mate in one
const mate = E.fromFEN('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
const bm = E.bestMove(mate, 2);
if (E.status(E.makeMove(mate, bm)).result !== 'checkmate') { ok = false; console.log('FAIL ai mate-in-1'); }
// Search engine (ai.js): its own move generator must agree with perft, and it must find mates.
const AI = require('./ai.js');
for (const [fen, counts] of cases) {
  counts.forEach((want, i) => {
    const got = AI.perft(fen, i + 1);
    if (got !== want) { ok = false; console.log(`FAIL ai perft ${fen} d${i + 1}: got ${got}, want ${want}`); }
  });
}
const aiMate = AI.think({ fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', timeMs: 500 });
if (aiMate.move !== 'a1a8') { ok = false; console.log('FAIL ai back-rank mate', aiMate.move); }
const scholar = AI.think({ fen: E.START_FEN, moves: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6'], timeMs: 500 });
if (scholar.move !== 'h5f7') { ok = false; console.log('FAIL ai scholar mate', scholar.move); }
for (const level of AI.LEVELS) {
  const r = AI.think({ fen: E.START_FEN, moves: ['e2e4'], ...level });
  if (!E.legalMoves(E.makeMove(E.newGame(), E.legalMoves(E.newGame()).find((m) => E.squareName(m.to) === 'e4')))
    .some((m) => E.squareName(m.from) + E.squareName(m.to) === r.move)) { ok = false; console.log('FAIL level', level.elo, r.move); }
}
console.log(ok ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
process.exit(ok ? 0 : 1);
