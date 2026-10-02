# Stone Chess

A complete chess game on a stone board with hand-drawn black and white pieces. An optional piece set swaps the knights and rooks for unicorns and Eiffel Towers.

**Play:** open `chess/index.html` in a browser. It needs no build step. Serving the folder over HTTP (for example `python3 -m http.server` inside `chess/`) lets the bot think in a Web Worker. Opened as a local file, it thinks on the page instead.

## Features

- All the rules: castling, en passant, promotion (you pick the piece), check, checkmate, stalemate, the 50-move rule, threefold repetition, and insufficient material
- Computer opponent at seven ratings, from 1000 to 2200, each calibrated against Stockfish (see below)
- Two players on one device
- Resign (click twice to confirm), new game, undo, and board flip
- **Game review** powered by the strongest bot:
  - Eval bar and evaluation graph
  - Accuracy for each player
  - Every move labeled Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, or Blunder
  - An arrow showing the best move whenever you missed it
  - Step through with ◀ ▶, the arrow keys, the move list, or the graph

## Files

| File | What it is |
|---|---|
| `index.html` | The page: board, pieces, game flow, and review |
| `engine.js` | Rules engine used by the page (legal moves, game end, notation) |
| `ai.js` | Search engine for the bot and the review (alpha-beta with a transposition table, null-move pruning, late-move reductions, quiescence, and PeSTO evaluation). Also runs as a Web Worker. |
| `test.js` | `node chess/test.js` checks both move generators against standard perft counts, plus game-end detection and the bot finding mates |
| `calibrate.js` | `node chess/calibrate.js <level> <stockfishElo> <games>` plays a bot level against Stockfish with `UCI_LimitStrength` |

## Bot ratings

Each level is a search depth limit, plus random noise added to move scores at the weaker levels. Each level was measured by playing matches against Stockfish 16 with `UCI_LimitStrength`. The games start from 12 balanced openings, and each opening is played with both colors. The ratings are on Stockfish's Elo scale, which is calibrated against computer engines. They are rough guides to human ratings, not exact equivalents.

| Level | Setting | Measured rating | Games |
|---|---|---|---|
| 1000 | depth 1, noise 90 | ≈ 1000 (pooled over noise 80–100) | 120 vs SF 1320 |
| 1200 | depth 2, noise 150 | ≈ 1250 (≈ 1165 at noise 165) | 32 + 24 vs SF 1320 |
| 1400 | depth 3, noise 75 | ≈ 1410 | 24 vs SF 1500, 24 vs SF 1400 |
| 1600 | depth 3, noise 15 | ≈ 1565 | 40 vs SF 1600 |
| 1800 | depth 4 | ≈ 1825 | 40 vs SF 1800 |
| 2000 | depth 5 | ≈ 2070 | 44 vs SF 2000 |
| 2200 | depth 6 | ≈ 2210 | 44 vs SF 2200 |
| Review engine | 0.7 s per position, no depth limit | ≈ 2400 at 1.5 s per move | 24 vs SF 2200 and 2500 |

Each figure is accurate to about ±70–100 Elo. Stockfish's `UCI_Elo` cannot go below 1320, so the 1000 and 1200 levels are extrapolated from their score against that floor. Stockfish played at 150 ms per move.
