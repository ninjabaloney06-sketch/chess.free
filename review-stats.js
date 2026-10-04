// Game-review statistics: win chances, move and game accuracy, and a performance-rating estimate.
// Shared by index.html and calibrate-review.js, so the in-game numbers are the ones that were calibrated.
(function (root) {
  'use strict';

  const MATE_BOUND = 29000;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  // Win chance (0..100) for the side the centipawn score is from (lichess's curve). Used for the
  // eval bar, the graph and to spot decided positions.
  const winPct = (cp) => (cp >= MATE_BOUND ? 100 : cp <= -MATE_BOUND ? 0 : 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1));
  // Expected points (0..100) for move labels and accuracy: a gentler curve than lichess's, fitted so
  // that labels and accuracy line up with chess.com's review of the same game (see the README).
  // A pawn is worth about 9.5 points around equality, and a move must give away 20 to be a blunder.
  const EP_K = 0.0019;
  const expectedPoints = (cp) => (cp >= MATE_BOUND ? 100 : cp <= -MATE_BOUND ? 0 : 50 + 50 * (2 / (1 + Math.exp(-EP_K * cp)) - 1));
  // Accuracy (0..100) of one move from how many expected points it gave away.
  const moveAccuracy = (loss) => clamp(103.1668 * Math.exp(-0.055 * loss) - 3.1669, 0, 100);
  // Centipawn score clamped to ±1000 (mates count as 1000) for average centipawn loss.
  const cpClamp = (cp) => clamp(cp, -1000, 1000);

  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

  // Game accuracy for one player: the harmonic mean of their move accuracies, so a few bad moves
  // pull it down more than a plain average would, without hiding them behind many easy moves.
  // Each move counts as at least 25, so one lost piece can't zero the whole game.
  //   moves: per ply, { acc, counted } (counted is false for book moves, which are skipped)
  //   color: 'w' or 'b' (White plays the even plies)
  // whiteWin is unused and kept so older callers still work.
  function gameAccuracy(whiteWin, moves, color) {
    if (!moves.length) return null;
    let inv = 0, cnt = 0;
    moves.forEach((m, k) => {
      if (!m || !m.counted || (k % 2 === 0) !== (color === 'w')) return;
      inv += 1 / Math.max(m.acc, 25);
      cnt++;
    });
    return cnt ? clamp(cnt / inv, 0, 100) : null;
  }

  // Game rating from game accuracy, chess.com style: piecewise linear through these points. It is
  // anchored on chess.com's review of a real game (95.7% read as 2200, 82.3% as 2000); the rest of
  // the curve is shaped so beginners' accuracies (50-70%) land in beginner ratings.
  const RATING_CURVE = [[0, 100], [30, 250], [40, 450], [50, 700], [60, 1000], [70, 1400], [77, 1700], [82, 2000],
    [88, 2080], [93, 2150], [96, 2200], [98, 2350], [100, 2700]];
  const MIN_MOVES_FOR_RATING = 8;
  function gameRating(accuracy, counted) {
    if (accuracy === null || counted < MIN_MOVES_FOR_RATING) return null;
    let i = 1;
    while (i < RATING_CURVE.length - 1 && accuracy > RATING_CURVE[i][0]) i++;
    const [x0, y0] = RATING_CURVE[i - 1], [x1, y1] = RATING_CURVE[i];
    return Math.round((y0 + (y1 - y0) * clamp((accuracy - x0) / (x1 - x0), 0, 1)) / 50) * 50;
  }

  // A move made when the game was already decided (the mover's win chance at least DECIDED, or at
  // most 100 - DECIDED, both before and after it) says little about strength: the easy moves of a
  // won ending, or a mating sequence, would otherwise count as perfect. It is left out of the rating.
  const DECIDED = 95;
  const decided = (wpBefore, wpAfter) => (wpBefore >= DECIDED && wpAfter >= DECIDED) || (wpBefore <= 100 - DECIDED && wpAfter <= 100 - DECIDED);

  // Average centipawn loss for one player. cpLoss: per ply, centipawns lost (null = not counted).
  function acpl(cpLoss, color) {
    const xs = cpLoss.filter((x, k) => x !== null && x !== undefined && (k % 2 === 0) === (color === 'w'));
    return xs.length ? mean(xs) : null;
  }

  // Performance rating from average centipawn loss (decided positions left out): a least-squares
  // fit of the true rating on ln(ACPL) over 358 sides of games between this app's bots, same and
  // mixed levels (see calibrate-review.js and the README). Fitting rating on ACPL, rather than the
  // other way round, pulls single-game estimates toward the middle, which is right for so noisy a
  // measure: an easy win over a weak opponent no longer reads as a 2300 performance.
  const ELO_FIT = { a: 3490, b: 463 };
  const MIN_MOVES_FOR_ELO = 8;
  function estimateElo(avgLoss, counted) {
    if (avgLoss === null || counted < MIN_MOVES_FOR_ELO) return null;
    return Math.round(clamp(ELO_FIT.a - ELO_FIT.b * Math.log(Math.max(avgLoss, 5)), 100, 3000) / 25) * 25;
  }

  const api = { MATE_BOUND, winPct, expectedPoints, moveAccuracy, gameRating, MIN_MOVES_FOR_RATING, cpClamp, gameAccuracy, DECIDED, decided, acpl, estimateElo, ELO_FIT, MIN_MOVES_FOR_ELO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReviewStats = api;
})(typeof window !== 'undefined' ? window : globalThis);
