// Measures a bot level's strength by playing it against Stockfish with UCI_LimitStrength.
// Usage: node chess/calibrate.js <levelElo | JSON level> <stockfishElo> <games> [stockfishPath]
// Each opening is played twice with colors reversed. Prints W/D/L and a performance rating.
const E = require('./engine.js');
const AI = require('./ai.js');
const { spawn } = require('child_process');

const [levelArg, sfElo, games = 20, sfPath = '/usr/games/stockfish'] = process.argv.slice(2);
const level = levelArg.startsWith('{') ? JSON.parse(levelArg) : AI.LEVELS.find((l) => l.elo === +levelArg);
if (!level) throw new Error('Unknown level ' + levelArg);

const OPENINGS = [
  'e2e4 e7e5 g1f3 b8c6', 'e2e4 c7c5 g1f3 d7d6', 'd2d4 d7d5 c2c4 e7e6', 'd2d4 g8f6 c2c4 g7g6',
  'e2e4 e7e6 d2d4 d7d5', 'e2e4 c7c6 d2d4 d7d5', 'c2c4 e7e5 b1c3 g8f6', 'g1f3 d7d5 g2g3 g8f6',
  'e2e4 e7e5 f1c4 g8f6', 'd2d4 d7d5 g1f3 g8f6', 'e2e4 d7d5 e4d5 d8d5', 'd2d4 g8f6 g1f3 e7e6',
].map((s) => s.split(' '));

const sf = spawn(sfPath);
let buf = '', waiter = null;
sf.stdout.on('data', (d) => { buf += d; if (waiter) waiter(); });
const send = (s) => sf.stdin.write(s + '\n');
const waitFor = (re) => new Promise((res) => {
  const chk = () => { const m = buf.match(re); if (m) { buf = ''; waiter = null; res(m); } };
  waiter = chk; chk();
});
const uci = (m) => E.squareName(m.from) + E.squareName(m.to) + (m.promo || '');

(async () => {
  send('uci'); await waitFor(/uciok/);
  send('setoption name UCI_LimitStrength value true');
  send(`setoption name UCI_Elo value ${sfElo}`);
  send('isready'); await waitFor(/readyok/);
  let w = 0, d = 0, l = 0;
  const t0 = Date.now();
  for (let g = 0; g < games; g++) {
    const botWhite = g % 2 === 0;
    const opening = OPENINGS[Math.floor(g / 2) % OPENINGS.length];
    let s = E.newGame();
    const hist = [];
    for (const u of opening) { const m = E.legalMoves(s).find((x) => uci(x) === u); hist.push(u); s = E.makeMove(s, m); }
    send('ucinewgame');
    while (!E.status(s).over && hist.length < 400) {
      let mv;
      if ((s.turn === 'w') === botWhite) {
        mv = AI.think({ fen: E.START_FEN, moves: hist, ...level }).move;
      } else {
        send(`position startpos moves ${hist.join(' ')}`);
        send('go movetime 150');
        mv = (await waitFor(/bestmove (\S+)/))[1];
      }
      const m = E.legalMoves(s).find((x) => uci(x) === mv);
      hist.push(mv);
      s = E.makeMove(s, m);
    }
    const st = E.status(s);
    if (st.result === 'checkmate') ((st.winner === 'w') === botWhite ? w++ : l++);
    else d++;
  }
  const score = (w + d / 2) / games;
  const p = Math.min(Math.max(score, 0.03), 0.97);
  const perf = Math.round(+sfElo - 400 * Math.log10(1 / p - 1));
  console.log(JSON.stringify({ level, sfElo: +sfElo, w, d, l, score: +(score * 100).toFixed(1), perf, secs: Math.round((Date.now() - t0) / 1000) }));
  send('quit');
})();
