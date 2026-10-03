// Game-review statistics: win chances, move and game accuracy, and a performance-rating estimate.
// Shared by index.html and calibrate-review.js, so the in-game numbers are the ones that were calibrated.
(function (root) {
  'use strict';

  const MATE_BOUND = 29000;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  // Win chance (0..100) for the side the centipawn score is from (lichess's curve).
  const winPct = (cp) => (cp >= MATE_BOUND ? 100 : cp <= -MATE_BOUND ? 0 : 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1));
  // Accuracy (0..100) of one move from how much win chance it gave away.
  const moveAccuracy = (loss) => clamp(103.1668 * Math.exp(-0.04354 * loss) - 3.1669, 0, 100);
  // Centipawn score clamped to ±1000 (mates count as 1000) for average centipawn loss.
  const cpClamp = (cp) => clamp(cp, -1000, 1000);

  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const stdev = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

  // Game accuracy for one player.
  //   whiteWin: White's win chance at every position of the game, start included (length = plies + 1)
  //   moves:    per ply, { acc, counted } — counted is false for book moves, which are skipped
  //   color:    'w' or 'b' (White plays the even plies)
  // A plain average hides blunders behind many easy moves, so this blends a volatility-weighted
  // mean (moves in sharp positions count more) with a power mean (p = -2.5) that a few bad moves
  // drag down hard, weighting the power mean most. Each move counts as at least 25 there, so one
  // lost piece can't zero the whole game. Roughly: no blunders ≈ 94, one ≈ 80-84, three ≈ 67-74.
  function gameAccuracy(whiteWin, moves, color) {
    const n = moves.length;
    if (!n) return null;
    const win = Math.round(clamp(n / 10, 2, 8));
    const windows = [];
    for (let k = 0; k < n; k++) {
      const start = clamp(k + 1 - win + 1, 0, Math.max(0, whiteWin.length - win));
      windows.push(whiteWin.slice(start, start + win));
    }
    const P = -2.5;
    let wSum = 0, wAcc = 0, pSum = 0, cnt = 0;
    moves.forEach((m, k) => {
      if (!m || !m.counted || (k % 2 === 0) !== (color === 'w')) return;
      const w = clamp(stdev(windows[k]), 0.5, 12);
      wSum += w; wAcc += w * m.acc;
      pSum += Math.max(m.acc, 25) ** P;
      cnt++;
    });
    if (!cnt) return null;
    const weighted = wAcc / wSum, power = (pSum / cnt) ** (1 / P);
    return clamp(0.25 * weighted + 0.75 * power, 0, 100);
  }

  // Average centipawn loss for one player. cpLoss: per ply, centipawns lost (null = not counted).
  function acpl(cpLoss, color) {
    const xs = cpLoss.filter((x, k) => x !== null && x !== undefined && (k % 2 === 0) === (color === 'w'));
    return xs.length ? mean(xs) : null;
  }

  // Performance rating from average centipawn loss, fitted to games of this app's bots, whose
  // ratings were measured against Stockfish (see calibrate-review.js and the README).
  const ELO_FIT = { a: 2850, b: 0.0115 };
  const MIN_MOVES_FOR_ELO = 8;
  function estimateElo(avgLoss, counted) {
    if (avgLoss === null || counted < MIN_MOVES_FOR_ELO) return null;
    return Math.round(clamp(ELO_FIT.a * Math.exp(-ELO_FIT.b * avgLoss), 100, 3000) / 25) * 25;
  }

  const api = { MATE_BOUND, winPct, moveAccuracy, cpClamp, gameAccuracy, acpl, estimateElo, ELO_FIT, MIN_MOVES_FOR_ELO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReviewStats = api;
})(typeof window !== 'undefined' ? window : globalThis);
