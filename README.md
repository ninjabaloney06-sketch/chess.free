# Stone Chess

A complete chess game on a stone board with hand-drawn black and white pieces. An optional piece set swaps the knights and rooks for unicorns and Eiffel Towers.

**Play:** double-click `index.html`. Everything runs locally on your computer's CPU, with no internet connection, server, or install needed. The bots and Stockfish run in background Web Workers built from files in this folder, so they work even when the page is opened straight from disk. Serving the folder over HTTP (for example `python3 -m http.server` in the repo folder) also works.

## Features

- All the rules: castling, en passant, promotion (you pick the piece), check, checkmate, stalemate, the 50-move rule, threefold repetition, and insufficient material
- Computer opponent at eight ratings: 1000 to 2200 use the built-in engine, and 2400 uses Stockfish's own strength limiter. All are checked against Stockfish (see below).
- Two players on one device
- Move by dragging (the piece follows your cursor) or by clicking a piece and then a square
- Draw on the board like chess.com or lichess: hold Shift (or use the right mouse button) and click a square to mark it, or drag to draw an arrow. Do it again to remove one; a normal click or the next move clears them all
- Resign (click twice to confirm), new game, undo, and board flip
- Player bars above and below the board with each side's captured pieces and a +N showing who is ahead in material (pawn 1, knight and bishop 3, rook 5, queen 9)
- **Import a game:** paste a PGN from chess.com or lichess and click *Review this game*. Player names and ratings come from the PGN; comments, variations and annotations in it are skipped
- **Game review** powered by Stockfish 19 Lite at full strength (0.5 s per position, ≈3000+):
  - Eval bar and evaluation graph
  - Accuracy for each player. Book moves don't count, and a few blunders pull it down hard instead of hiding behind many easy moves (roughly: no blunders ≈ 94, one ≈ 80–84, three ≈ 67–74)
  - **Rating estimate:** the rating each side played like in this game, from their average centipawn loss (see below)
  - Every move labeled Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, or Blunder
  - An arrow showing the best move whenever you missed it
  - Step through with ◀ ▶, the arrow keys, the move list, or the graph
  - **Variations:** play any move on the board during review to branch off. Variations appear indented in the move list, and each move gets its own label, evaluation, and best line from Stockfish. Click × to delete a variation.
  - **Deep review:** click *Deep review* to re-analyze the game with the full Stockfish 19 (the big-network build, about 99 MB) at 1.5 s per position. It is too big to ship in the repo, so the first deep review downloads it from the npm CDN (unpkg.com), which needs an internet connection. The page then keeps it in the browser's storage (IndexedDB), so later deep reviews work offline. Clearing the site's data removes it. If you serve the folder over HTTP, you can instead run `node stockfish/get-full-engine.js` once, and the page uses that local copy. If the engine can't be loaded, the page says so and shows the normal review. The full engine is somewhat stronger than Lite at the same time per move, but both are far beyond human strength, so most move labels won't change.

## Files

| File | What it is |
|---|---|
| `index.html` | The page: board, pieces, game flow, and review |
| `engine.js` | Rules engine used by the page (legal moves, game end, notation) |
| `ai.js` | Search engine for the bot and the review (alpha-beta with a transposition table, null-move pruning, late-move reductions, quiescence, and PeSTO evaluation). Also runs as a Web Worker. |
| `test.js` | `node test.js` checks both move generators against standard perft counts, plus game-end detection and the bot finding mates |
| `stockfish/` | Stockfish 19 Lite (WebAssembly, GPLv3) and `stockfish-bundle.js`, the same engine packed into one script so it can start from `file://`. Rebuild the bundle with `node stockfish/make-bundle.js`. |
| `stockfish/get-full-engine.js` | Optional: downloads the full Stockfish 19 for offline deep review (git-ignored) |
| `review-stats.js` | Accuracy and rating-estimate formulas, shared by the page and `calibrate-review.js` |
| `calibrate-review.js` | `node calibrate-review.js <level> <games> [analysisMs]` has a bot level play itself and prints each side's average centipawn loss and accuracy, to fit the rating estimate |
| `calibrate.js` | `node calibrate.js <level> <stockfishElo> <games> [refMs]` plays a bot level (built-in, or Stockfish.js via `{"engine":"sfjs",...}`) against native Stockfish with `UCI_LimitStrength` |

## Bot ratings

Levels 1000–2200 are the built-in engine with a search depth limit, plus random noise added to move scores at the weaker levels. The 2400 level is Stockfish with its strength limiter. Each level was measured by playing matches against Stockfish 16 with `UCI_LimitStrength`. The games start from 12 balanced openings, and each opening is played with both colors. The ratings are on Stockfish's Elo scale, which is calibrated against computer engines. They are rough guides to human ratings, not exact equivalents.

| Level | Setting | Measured rating | Games |
|---|---|---|---|
| 1000 | depth 1, noise 90 | ≈ 1000 (pooled over noise 80–100) | 120 vs SF 1320 |
| 1200 | depth 2, noise 150 | ≈ 1250 (≈ 1165 at noise 165) | 32 + 24 vs SF 1320 |
| 1400 | depth 3, noise 75 | ≈ 1410 | 24 vs SF 1500, 24 vs SF 1400 |
| 1600 | depth 3, noise 15 | ≈ 1565 | 40 vs SF 1600 |
| 1800 | depth 4 | ≈ 1825 | 40 vs SF 1800 |
| 2000 | depth 5 | ≈ 2070 | 44 vs SF 2000 |
| 2200 | depth 6 | ≈ 2210 | 44 vs SF 2200 |
| 2400 | Stockfish 19 Lite, `UCI_Elo` 2540, 0.5 s per move | ≈ 2410 | 40 vs SF 2400 |
| Review engine | Stockfish 19 Lite, full strength, 0.5 s per position | ≈ 3400 (26 wins, 3 draws, 1 loss) | 30 vs SF 3000 at 1 s per move |

Each figure is accurate to about ±70–100 Elo. Stockfish's `UCI_Elo` cannot go below 1320, so the 1000 and 1200 levels are extrapolated from their score against that floor. Native Stockfish played at 150 ms per move, except against the review engine, where it had 1 s per move so its 3000 setting could reach full depth. Stockfish Lite's own `UCI_Elo` reads low: set to 2400 it measured ≈ 2310, so the 2400 level uses 2540.

## Rating estimate

Review estimates the rating each side played like from their average centipawn loss (ACPL): each non-book move's drop in evaluation, with evaluations capped at ±10 pawns so moves in already-decided positions don't swamp the average. The formula, rating ≈ 3200 × e^(−0.0134 × ACPL), was fitted to games between bots of the same level (8 games, 16 sides per level, Stockfish 19 Lite analysis at 0.1 s per position, games capped at 130 plies):

| Level | Measured rating | Average ACPL | Estimate |
|---|---|---|---|
| 1000 | 1000 | 85.9 | 1009 |
| 1200 | 1250 | 74.9 | 1171 |
| 1400 | 1410 | 57.2 | 1484 |
| 1600 | 1565 | 49.2 | 1654 |
| 1800 | 1825 | 41.2 | 1841 |
| 2000 | 2070 | 34.0 | 2029 |
| 2200 | 2210 | 25.9 | 2260 |
| Stockfish `UCI_Elo` 2400 | 2310 | 28.8 | 2174 |

Averaged over many games the estimate lands within about 100 of the true rating, but a single game swings a lot: in the calibration games a single side's estimate was off by 265 at the median and by 500 or more one time in five, since one quiet game or one blunder moves ACPL a long way. It needs at least 8 non-book moves. Like the bot ratings, it is on Stockfish's engine Elo scale, not an exact chess.com or FIDE equivalent.

