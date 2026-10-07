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
// PGN import: a chess.com export, and lichess-style comments, variations and annotations
const pgn = `[Event "Live Chess"]
[White "notmagnussquared"]
[Black "ehabou"]
[Result "0-1"]
[CurrentPosition "8/p7/2p3p1/1pP3p1/1P3k2/PK5p/8/8 w - - 0 47"]

1. d4 e5 2. c4 exd4 3. Qxd4 Nc6 4. Qd1 Bb4+ 5. Nc3 Qe7 6. Bd2 Nf6 7. Nf3 d6 8.
a3 Bxc3 9. Bxc3 Ne5 10. Bxe5 dxe5 11. e4 Nxe4 12. Bd3 Nc5 13. Bc2 e4 14. Nd2 e3
15. Nf3 exf2+ 16. Kxf2 O-O 17. Re1 Qf6 18. b4 Na6 19. c5 Bg4 20. h3 Bh5 21. g4
Bg6 22. Bxg6 fxg6 23. Kg2 Qb2+ 24. Re2 Qf6 25. Rf2 c6 26. Rc1 Nc7 27. Rc4 Nd5
28. Re4 Nf4+ 29. Kg3 g5 30. Rxf4 Qxf4+ 31. Kg2 Rad8 32. Qe1 Rd3 33. Qe2 Rxf3 34.
Rxf3 Qxf3+ 35. Qxf3 Rxf3 36. Kxf3 Kf7 37. Ke4 Ke6 38. Kd4 b6 39. Ke4 b5 40. Kd4
g6 41. Ke4 Kf6 42. Kf3 h5 43. Ke3 hxg4 44. Kd3 Ke5 45. Kc3 Kf4 46. Kb3 gxh3 0-1`;
const imp = E.parsePGN(pgn);
let ps = E.newGame();
for (const m of imp.moves) ps = E.makeMove(ps, m);
if (imp.moves.length !== 92 || E.toFEN(ps).split(' ')[0] !== '8/p7/2p3p1/1pP3p1/1P3k2/PK5p/8/8' || imp.tags.Black !== 'ehabou') {
  ok = false; console.log('FAIL pgn chess.com', imp.moves.length, E.toFEN(ps));
}
const imp2 = E.parsePGN('1. e4 { [%clk 0:01:00] } 1... e5 (1... c5 2. Nf3) 2. Nf3?! $6 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. 0-0 *');
if (imp2.moves.length !== 9 || !imp2.moves[8].castle) { ok = false; console.log('FAIL pgn lichess', imp2.moves.length); }
let threw = false;
try { E.parsePGN('1. e4 e5 2. Ke3'); } catch (e) { threw = /2\. Ke3/.test(e.message); }
if (!threw) { ok = false; console.log('FAIL pgn illegal move'); }
// Opening book: lichess's list (by position) and chess.com's [ECOUrl] line
require('./openings.js');
const OB = require('./openings-core.js');
const qga = 'd4 d5 c4 dxc4 e4 e5 Nf3 Bb4+ Nc3 exd4 Qxd4'.split(' ');
if (OB.ecoUrlPlies('https://www.chess.com/openings/Queens-Gambit-Accepted-Central-Variation-McDonnell-Defense-4.Nf3-Bb4-5.Nc3-exd4', qga) !== 10
  || OB.ecoUrlPlies('https://www.chess.com/openings/Ruy-Lopez-Opening-3...a6-4.O-O', 'e4 e5 Nf3 Nc6 Bb5 a6 O-O'.split(' ')) !== 7
  || OB.ecoUrlPlies('https://www.chess.com/openings/Sicilian-Defense-2.Nf3', qga) !== 0) { ok = false; console.log('FAIL ecoUrl'); }
let bk = E.newGame(), inBook = [];
for (const s of qga) { bk = E.makeMove(bk, E.legalMoves(bk).find((m) => E.san(bk, m) === s)); inBook.push(OB.inBook(E.toFEN(bk))); }
if (inBook.slice(0, 6).includes(false) || inBook[10]) { ok = false; console.log('FAIL opening book', inBook); }
// Review stats: harmonic-mean accuracy and the chess.com-style game rating
const RS = require('./review-stats.js');
const accMoves = [{ acc: 100, counted: true }, { acc: 50, counted: true }, { acc: 50, counted: true }, { acc: 0, counted: false }];
if (Math.abs(RS.gameAccuracy(null, accMoves, 'w') - 2 / (1 / 100 + 1 / 50)) > 1e-9 || RS.gameAccuracy(null, accMoves, 'b') !== 50) { ok = false; console.log('FAIL accuracy'); }
// Moves in decided positions are left out of the accuracy (they say little about strength)
const decMoves = [{ acc: 100, counted: true }, { acc: 25, counted: true, decided: true }, { acc: 40, counted: true }];
if (Math.abs(RS.gameAccuracy(null, decMoves, 'w') - 2 / (1 / 100 + 1 / 40)) > 1e-9) { ok = false; console.log('FAIL decided accuracy', RS.gameAccuracy(null, decMoves, 'w')); }
// Rating curve: the chess.com anchors hold, and the low end sinks disaster games
// (deliberately throwing still reads 60-75% accuracy — the curve must not read that as club level)
if (RS.gameRating(95.7, 20) !== 2200 || RS.gameRating(82.3, 20) !== 2000 || RS.gameRating(90, 5) !== null) {
  ok = false; console.log('FAIL game rating anchors', RS.gameRating(95.7, 20), RS.gameRating(82.3, 20));
}
if (RS.gameRating(60, 20) !== 600 || RS.gameRating(61.8, 10) !== 650) {
  ok = false; console.log('FAIL game rating low end', RS.gameRating(60, 20), RS.gameRating(61.8, 10));
}
// Notation repair: OCR-style noise (German pieces, 0/O, junk tokens, merged
// half-moves, uppercase) must produce the same game as the clean notation
const NT = require('./notation.js');
const refGame = `1. d4 d5 2. c4 dxc4 3. e4 e5 4. Nf3 Bb4+ 5. Nc3 exd4 6. Qxd4 Qxd4 7. Nxd4 Ne7 8. Bxc4 O-O 9. Bd2 Nbc6
10. Nxc6 Nxc6 11. a3 Bd6 12. O-O Bg4 13. h3 Be6 14. Bxe6 fxe6 15. f4 Nd4 16. e5 Nb3 17. exd6 Nxd2
18. Rfd1 Nb3 19. Rab1 cxd6 20. Rxd6 Rxf4 21. Rxe6 Nd4 22. Re7 b6 23. Rd1 Nc6 24. Rc7 Ne5 25. Re1 Nd3
26. Ree7 Nxb2 27. Rxg7+ Kf8 28. Rxh7 Nd3 29. Rh8# 1-0`;
const ref = E.parsePGN(refGame);
let rs = E.newGame();
for (const m of ref.moves) rs = E.makeMove(rs, m);
const refFEN = E.toFEN(rs).split(' ').slice(0, 4).join(' ');
// The same sheet as OCR would deliver it: German pieces, 0 for O, glued
// half-moves, junk headers, everything uppercased by the reader
const noisy = `TURNIERRUNDE 3
1. d4 d5 2. c4 dxc4 3. e4 e5 4. SF3 Bb4+ 5. Nc3 exd4 6. Qxd4 Qxd4 7. Sxd4 Se7
8. Bxc4 0-0 9. Bd2 NBC6 10. Nxc6 Nxc6 11. a3Bd6 12. 0-0 Lg4 13. h3 Le6
14. Bxe6 fxe6 15. f4 Nd4 16. e5 Nb3 17. exd6 Nxd2 18. Rfd1 Nb3 19. Rab1 cxd6
20. Rxd6 Rxf4 21. Rxe6 Nd4 22. Re7 b6 23. Rd1 Nc6 24. Rc7 Ne5 25. Re1 Nd3
26. Ree7 Nxb2 27. Rxg7+ Kf8 28. Rxh7 Nd3 29. Rh8 1-0`;
const rep = NT.toPGN(noisy, E);
const repPGN = E.parsePGN(rep.pgn);
let rs2 = E.newGame();
for (const m of repPGN.moves) rs2 = E.makeMove(rs2, m);
if (repPGN.moves.length !== 57 || E.toFEN(rs2).split(' ').slice(0, 4).join(' ') !== refFEN
  || repPGN.tags.Result !== '1-0' || !/29\. Rh8# 1-0$/.test(rep.pgn)) {
  ok = false; console.log('FAIL notation repair', repPGN.moves.length, E.toFEN(rs2));
}
// Clean text round-trips, promotion in German style, result tags, junk skipping
const promo = NT.toPGN('1. e4 d5 2. exd5 c6 3. dxc6 Nf6 4. cxb7 Bd7 5. bxa8=D 1-0', E);
if (!/5\. bxa8=Q 1-0$/.test(promo.pgn) || !promo.pgn.includes('[Result "1-0"]')) { ok = false; console.log('FAIL notation promotion', promo.pgn); }
// A real OCR reading of the sheet in a handwriting font: mangled move number
// ("l."), $ for 3, "ey"/"BbY" for e5/Bb5, "Nob" for Nc6, glued "5.0-0"
const marker = NT.toPGN('l.e4 ey 2, Nf$ Nob $.BbY a6 4. Ba4 Nf6 5.0-0 Be7 1-0', E);
if (!/1\. e4 e5 2\. Nf3 Nc6 3\. Bb5 a6 4\. Ba4 Nf6 5\. O-O Be7 1-0$/.test(marker.pgn)) {
  ok = false; console.log('FAIL notation marker felt', marker.pgn);
}
// A larger handwriting font: '¢' junk inside a glued move, z for 3, e for c/6,
// y for 7, a misread result "7-0". The unreadable first move ("1.e4¢e5")
// is skipped with a warning — the game then starts at Nf3, and later moves
// that need the lost e-pawn pushed are correctly rejected.
const bradley = NT.toPGN('1.e4¢e5 2. Nfz Nee 3. Bb5 ae 4. Ba4 Nfe 5. 0-0 Bey 7-0', E);
if (!/1\. Nf3 Nc6 \*$/.test(bradley.pgn) || bradley.warnings.length < 2) {
  ok = false; console.log('FAIL notation bradley', bradley.pgn, bradley.warnings);
}
// Chalkboard-style accents: Nfé for Nf6, ab for a6
const chalk = NT.toPGN('1. e4 e5 2. Nf3 Ncé 3. Bb5 ab 4. Ba4 Nfé 5. 0-0 Be7 1-0', E);
if (!/1\. e4 e5 2\. Nf3 Nc6 3\. Bb5 a6 4\. Ba4 Nf6 5\. O-O Be7 1-0$/.test(chalk.pgn)) {
  ok = false; console.log('FAIL notation chalkboard', chalk.pgn);
}
const lower = NT.toPGN('1. e4 e5 2. nf3 nc6', E);
if (!/1\. e4 e5 2\. Nf3 Nc6 \*$/.test(lower.pgn)) { ok = false; console.log('FAIL notation lowercase', lower.pgn); }
const junk = NT.toPGN('Runde 5 1. e4 e5 White 2. Nf3 Nc6', E);
if (junk.warnings.length !== 2 || !/2\. Nf3 Nc6 \*$/.test(junk.pgn)) { ok = false; console.log('FAIL notation junk', junk.warnings, junk.pgn); }
let notThrow = false;
// Mid-game failure with a later move of the same color still legal: throws.
try { NT.toPGN('1. e4 e5 2. Nf9 Bb5', E); } catch (e) { notThrow = /Nf9/.test(e.message); }
if (!notThrow) { ok = false; console.log('FAIL notation error message'); }
// An unreadable LAST token only stops the parse with a warning (the moves
// before it stay usable); junk after the game (result block) is dropped too.
const tail = NT.toPGN('1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 CROSS CORRECT RESULT', E);
if (!/1\. e4 e5 2\. Nf3 Nc6 3\. Bb5 Nf6 \*$/.test(tail.pgn) || !tail.warnings.length) {
  ok = false; console.log('FAIL notation trailing', tail.pgn, tail.warnings);
}
// Descriptive notation (pre-1980 scoresheets): files named from the mover's
// side, captures by victim piece, OO castling
const dqgd = NT.toPGN('1 NKB3 PQ4 2 PQ4 NKB3 3 PQB4 PK3 4 NQB3 BK2 5 PKN3 OO', E);
if (!/1\. Nf3 d5 2\. d4 Nf6 3\. c4 e6 4\. Nc3 Be7 5\. g3 O-O \*$/.test(dqgd.pgn)) {
  ok = false; console.log('FAIL notation descriptive', dqgd.pgn);
}
// One SAN move that looks descriptive (Qb3 = "queen to bishop 3") must not
// switch the game to descriptive readings.
const qb3 = NT.toPGN('1. e4 e5 2. c3 Nc6 3. Qb3 Nf6', E);
if (!/3\. Qb3 Nf6 \*$/.test(qb3.pgn)) { ok = false; console.log('FAIL notation Qb3 stays SAN', qb3.pgn); }
// Case decides piece vs pawn: Bxc5 is the bishop even when bxc5 is legal; German Dxe5 is the queen.
const bxc5 = NT.toPGN('1. e4 c5 2. b4 Nc6 3. d3 a6 4. Be3 e6 5. Bxc5', E);
if (!/5\. Bxc5 \*$/.test(bxc5.pgn)) { ok = false; console.log('FAIL notation Bxc5 vs bxc5', bxc5.pgn); }
const dxe5 = NT.toPGN('1. e4 e5 2. Dh5 Nc6 3. d4 a6 4. Dxe5', E);
if (!/4\. Qxe5\+? \*$/.test(dxe5.pgn)) { ok = false; console.log('FAIL notation German Dxe5', dxe5.pgn); }
// A repaired (fuzzy) move is reported, not silently changed.
const fix = NT.toPGN('1. e4 e5 2. Nf3 Nc6 3. e4', E);
const caseFix = NT.toPGN('1. b4 e5 2. Ba3 d6 3. e3 c5 4. Bxc5', E); // bishop blocked by b4: becomes bxc5, reported
if (!/4\. bxc5 \*$/.test(caseFix.pgn) || !caseFix.warnings.some((w) => /Read "Bxc5" as bxc5/.test(w))) { ok = false; console.log('FAIL notation case repair warning', caseFix.pgn, caseFix.warnings); }

if (!fix.warnings.some((w) => /Read "e4" as c4/.test(w))) { ok = false; console.log('FAIL notation repair warning', fix.pgn, fix.warnings); }
// Castling written as digits.
const c00 = NT.toPGN('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. 00 Nf6', E);
if (!/4\. O-O Nf6 \*$/.test(c00.pgn)) { ok = false; console.log('FAIL notation 00 castling', c00.pgn); }
const rxr = NT.descriptiveMoves(E.fromFEN('3r3k/8/8/8/8/8/8/3R3K w - - 0 1'), 'RXR', E);
if (rxr.length !== 1 || E.squareName(rxr[0].from) !== 'd1' || E.squareName(rxr[0].to) !== 'd8') {
  ok = false; console.log('FAIL descriptive RXR', rxr);
}
const pxp = NT.descriptiveMoves(E.fromFEN('7k/8/8/3p4/4P3/8/8/7K w - - 0 1'), 'PXP', E);
if (pxp.length !== 1 || E.squareName(pxp[0].to) !== 'd5') { ok = false; console.log('FAIL descriptive PXP', pxp); }
const pkb4 = NT.descriptiveMoves(E.fromFEN('7k/5p2/8/8/8/8/8/7K b - - 0 1'), 'PKB4', E);
if (pkb4.length !== 1 || E.squareName(pkb4[0].to) !== 'f5') { ok = false; console.log('FAIL descriptive black PKB4', pkb4); }
const ooB = NT.descriptiveMoves(E.fromFEN('r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1'), 'OO', E);
if (ooB.length !== 1 || !ooB[0].castle) { ok = false; console.log('FAIL descriptive OO', ooB); }
// two rooks can each take the rook: ambiguous, must refuse
const amb = NT.descriptiveMoves(E.fromFEN('7k/8/8/1R1r1R2/8/8/8/7K w - - 0 1'), 'RXR', E);
if (amb.length !== 2) { ok = false; console.log('FAIL descriptive ambiguity', amb); }
console.log(ok ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
process.exit(ok ? 0 : 1);
