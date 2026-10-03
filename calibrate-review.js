// Calibrates the review's rating estimate. Bots of known strength play each other, Stockfish analyzes
// every position, and each side's average centipawn loss and accuracy are printed as JSON lines.
// Usage: node calibrate-review.js <level>[:<level2>] <games> [analysisMovetimeMs] [botMovetimeMs]
//   <level> is a built-in level's Elo (e.g. 1400) or "sf<Elo>" for strength-limited Stockfish (e.g. sf2400).
//   With one level both sides play it; with two, they swap colors every game.
// Each line also carries the game's per-ply scores (side to move's view), so estimators can be refit offline.
const path = require('path');
const E = require('./engine.js');
const AI = require('./ai.js');
const S = require('./review-stats.js');
const { spawn } = require('child_process');

const [levelArg, games = 6, anaMs = 150, botMs = 300] = process.argv.slice(2);
const players = levelArg.split(':').map((name) => {
  const sfElo = name.startsWith('sf') ? +name.slice(2) : null;
  const level = sfElo ? null : AI.LEVELS.find((l) => l.elo === +name);
  if (!sfElo && !level) throw new Error('Unknown level ' + name);
  return { name, sfElo, level };
});
if (players.length === 1) players.push(players[0]);

const OPENINGS = [
  'e2e4 e7e5 g1f3 b8c6', 'e2e4 c7c5 g1f3 d7d6', 'd2d4 d7d5 c2c4 e7e6', 'd2d4 g8f6 c2c4 g7g6',
  'e2e4 e7e6 d2d4 d7d5', 'e2e4 c7c6 d2d4 d7d5', 'c2c4 e7e5 b1c3 g8f6', 'g1f3 d7d5 g2g3 g8f6',
].map((s) => s.split(' '));
const SF = path.join(__dirname, 'stockfish', 'stockfish-19-lite-single.js');

function uciEngine(opts) {
  const proc = spawn('node', [SF]);
  let buf = '', waiter = null;
  proc.stdout.on('data', (d) => { buf += d; if (waiter) waiter(); });
  const send = (s) => proc.stdin.write(s + '\n');
  const waitFor = (re) => new Promise((res) => {
    const chk = () => { const m = buf.match(re); if (m) { const out = buf; buf = ''; waiter = null; res([m, out]); } };
    waiter = chk; chk();
  });
  const ready = (async () => {
    send('uci'); await waitFor(/uciok/);
    for (const [k, v] of Object.entries(opts)) send(`setoption name ${k} value ${v}`);
    send('isready'); await waitFor(/readyok/);
  })();
  return { send, waitFor, ready, quit: () => send('quit') };
}
const uci = (m) => E.squareName(m.from) + E.squareName(m.to) + (m.promo || '');

(async () => {
  const ana = uciEngine({ Hash: 64 });
  for (const p of players) if (p.sfElo && !p.bot) p.bot = uciEngine({ UCI_LimitStrength: true, UCI_Elo: p.sfElo, Hash: 32 });
  await ana.ready;
  for (const p of players) if (p.bot) await p.bot.ready;

  // Score from the side to move's view, in centipawns (mates as ±(MATE - plies)).
  async function analyse(hist, s) {
    const st = E.status(s);
    if (st.over) return st.result === 'checkmate' ? -AI.MATE : 0;
    ana.send(`position startpos moves ${hist.join(' ')}`);
    ana.send(`go movetime ${anaMs}`);
    const [, out] = await ana.waitFor(/bestmove \S+/);
    const infos = out.split('\n').filter((l) => / score (cp|mate) /.test(l));
    const m = infos[infos.length - 1].match(/ score (cp|mate) (-?\d+)/);
    return m[1] === 'cp' ? +m[2] : (+m[2] > 0 ? AI.MATE - 2 * +m[2] : -AI.MATE - 2 * +m[2]);
  }
  async function botMove(p, hist) {
    const { bot, level } = p;
    if (!bot) return AI.think({ fen: E.START_FEN, moves: hist, ...level }).move;
    bot.send(`position startpos moves ${hist.join(' ')}`);
    bot.send(`go movetime ${botMs}`);
    return (await bot.waitFor(/bestmove (\S+)/))[0][1];
  }

  for (let g = 0; g < games; g++) {
    const opening = OPENINGS[g % OPENINGS.length];
    let s = E.newGame();
    const hist = [];
    for (const u of opening) { hist.push(u); s = E.makeMove(s, E.legalMoves(s).find((x) => uci(x) === u)); }
    // Players swap colors every game (the same player both sides when only one level was given).
    const side = { w: players[g % 2], b: players[(g + 1) % 2] };
    ana.send('ucinewgame');
    for (const p of players) if (p.bot) p.bot.send('ucinewgame');
    const scores = [await analyse(hist, s)];
    while (!E.status(s).over && hist.length < 130) {
      const mv = await botMove(side[s.turn], hist);
      hist.push(mv);
      s = E.makeMove(s, E.legalMoves(s).find((x) => uci(x) === mv));
      scores.push(await analyse(hist, s));
    }
    // Index plies from the opening's end; the opening moves are like book moves and aren't counted.
    const base = opening.length;
    const whiteWin = scores.map((sc, k) => S.winPct((base + k) % 2 === 0 ? sc : -sc));
    const moves = [], cpLoss = [];
    for (let k = 0; k + 1 < scores.length; k++) {
      const loss = Math.max(0, S.winPct(scores[k]) - S.winPct(-scores[k + 1]));
      moves.push({ acc: S.moveAccuracy(loss), counted: true });
      const decided = S.decided(S.winPct(scores[k]), S.winPct(-scores[k + 1]));
      cpLoss.push(decided ? null : Math.max(0, S.cpClamp(scores[k]) - S.cpClamp(-scores[k + 1])));
    }
    // The opening has an even number of plies, so ply 0 here is White's.
    for (const c of ['w', 'b']) {
      const n = moves.filter((x, k) => (k % 2 === 0) === (c === 'w')).length;
      console.log(JSON.stringify({
        level: side[c].name, opponent: side[c === 'w' ? 'b' : 'w'].name, game: g, color: c, moves: n,
        acpl: S.acpl(cpLoss, c) === null ? null : +S.acpl(cpLoss, c).toFixed(1), accuracy: +S.gameAccuracy(whiteWin, moves, c).toFixed(1),
        result: E.status(s).result || 'maxlen', scores,
      }));
    }
  }
  ana.quit();
  for (const p of players) if (p.bot) p.bot.quit();
  process.exit(0);
})();
