# Stone Chess

A complete chess game on a stone board with hand-drawn black and white pieces.

**Play:** double-click `index.html`. Everything runs locally on your computer's CPU, with no internet connection, server, or install needed. The bots and Stockfish run in background Web Workers built from files in this folder, so they work even when the page is opened straight from disk. Serving the folder over HTTP (for example `python3 -m http.server` in the repo folder) also works.

## Features

- All the rules: castling, en passant, promotion (you pick the piece), check, checkmate, stalemate, the 50-move rule, threefold repetition, and insufficient material
- Computer opponent at eight ratings: 1000 to 2200 use the built-in engine, and 2400 uses Stockfish's own strength limiter. All are checked against Stockfish (see below).
- Two players on one device
- Move by dragging (the piece follows your cursor) or by clicking a piece and then a square
- Draw on the board like chess.com or lichess: hold Shift (or use the right mouse button) and click a square to mark it, or drag to draw an arrow. Do it again to remove one; a normal click or the next move clears them all
- Resign (click twice to confirm), new game, undo, and board flip
- Player bars above and below the board with each side's captured pieces and a +N showing who is ahead in material (pawn 1, knight and bishop 3, rook 5, queen 9)
- A layout modeled on chess.com: dark theme, the board sized to the window, player bars with avatars, and one side panel as tall as the board with Play, Review and Import tabs that scroll inside it
- **Import a game:** open the Import tab, paste a PGN from chess.com or lichess and click *Review this game*. Player names and ratings come from the PGN; comments, variations and annotations in it are skipped
- **My games:** every imported game is saved in the browser (IndexedDB) and listed under My games in the Import tab — review it again, copy its PGN, or delete it. The games never leave the browser
- **Game review** powered by Stockfish 19 Lite at full strength (300k nodes per position, about 0.6 s on a laptop). A fixed node count instead of a time limit means the same game always gets the same review. Tuned to match chess.com's Game Review (see *Matching chess.com* below):
  - A summary first, like chess.com: a coach comment naming the turning point, the evaluation graph, each player's accuracy, move-label counts and game rating. *Start Review* then steps through the moves with a comment on each
  - Eval bar and evaluation graph
  - Accuracy for each player: the harmonic mean of their move accuracies (book moves and moves in decided positions don't count), and the game rating falls fast below the anchored region — accuracy saturates in lost positions, so a deliberately thrown game must not read as club level
  - **Game rating:** the rating each side played like in this game, from their accuracy
  - Every move labeled Brilliant, Great, Book, Best, Excellent, Good, Inaccuracy, Mistake, Miss, or Blunder. Best is only the engine's top move. A Miss is a Mistake or Blunder right after the opponent's own, when the chance to punish it went begging. A move is only Great when it was the one good move *and* not an obvious one: getting out of check, recapturing on the square just taken, or taking an undefended piece count as Best
  - **Opening book:** imported chess.com games use chess.com's own book line from the PGN's `[ECOUrl]` tag; other games use lichess's openings list (about 3,900 named lines, matched by position so transpositions count)
  - An arrow showing the best move whenever you missed it
  - Step through with ◀ ▶, the arrow keys, the move list, or the graph
  - **Variations:** play any move on the board during review to branch off. Variations appear indented in the move list, and each move gets its own label, evaluation, and best line from Stockfish. Click × to delete a variation.
  - **Deep review:** click *Deep review* to re-analyze the game with the full Stockfish 19 (the big-network build, about 99 MB) at 1M nodes per position. It is too big to ship in the repo, so the first deep review downloads it from the npm CDN (unpkg.com), which needs an internet connection. The page then keeps it in the browser's storage (IndexedDB), so later deep reviews work offline. Clearing the site's data removes it. If you serve the folder over HTTP, you can instead run `node stockfish/get-full-engine.js` once, and the page uses that local copy. If the engine can't be loaded, the page says so and shows the normal review. The full engine is somewhat stronger than Lite at the same time per move, but both are far beyond human strength, so most move labels won't change.

## Files

| File | What it is |
|---|---|
| `index.html` | The page: board, pieces, game flow, and review |
| `engine.js` | Rules engine used by the page (legal moves, game end, notation) |
| `ai.js` | Search engine for the bot and the review (alpha-beta with a transposition table, null-move pruning, late-move reductions, quiescence, and PeSTO evaluation). Also runs as a Web Worker. |
| `test.js` | `node test.js` checks both move generators against standard perft counts, plus game-end detection, the bot finding mates, and the opening book |
| `stockfish/` | Stockfish 19 Lite (WebAssembly, GPLv3) and `stockfish-bundle.js`, the same engine packed into one script so it can start from `file://`. Rebuild the bundle with `node stockfish/make-bundle.js`. |
| `stockfish/get-full-engine.js` | Optional: downloads the full Stockfish 19 for offline deep review (git-ignored) |
| `review-stats.js` | Expected points, accuracy and game-rating formulas (plus the older ACPL rating estimate), shared by the page and `calibrate-review.js` |
| `game-db.js` | The My games store (IndexedDB, browser-only) |
| `openings.js` | The opening book: hashes of every position on lichess's named opening lines (CC0). Rebuild with `node make-openings.js` |
| `openings-core.js` | Opening book lookups, and reading chess.com's book line from a PGN's `[ECOUrl]` |
| `calibrate-review.js` | `node calibrate-review.js <level>[:<level2>] <games> [analysisMs]` has a bot level play itself (or another level, swapping colors each game) and prints each side's average centipawn loss, accuracy and per-move scores, to fit the rating estimate |
| `calibrate.js` | `node calibrate.js <level> <stockfishElo> <games> [refMs]` plays a bot level (built-in, or Stockfish.js via `{"engine":"sfjs",...}`) against native Stockfish with `UCI_LimitStrength` |

## Bot ratings

All 8 levels are Stockfish 19 Lite with its strength limiter (`UCI_LimitStrength` / `UCI_Elo`) and a per-level move time. Stockfish's `UCI_Elo` cannot go below 1320, so the 1000 level additionally plays a uniformly random legal move 12% of the time (and 1000–1200 sit at the floor). Each level's rating is measured by playing matches against a reference Stockfish with `UCI_LimitStrength`. The games start from 12 balanced openings, and each opening is played with both colors. The ratings are on Stockfish's Elo scale, which is calibrated against computer engines. They are rough guides to human ratings, not exact equivalents, and measuring against Stockfish's own limiter only shows the levels are consistent with that scale.

Measured against human-style numbers (each level playing itself from 8 openings, 20 sides, every move analysed by full-strength Stockfish), the limiter barely changes how a level plays below about 1800:

| Level | Average centipawn loss | Blunders per game |
|---|---|---|
| 1000 | 92 | 2.9 |
| 1200 | 52 | 1.6 |
| 1400 | 48 | 1.8 |
| 1600 | 45 | 2.6 |
| 1800 | 42 | 1.7 |
| 2000 | 31 | 1.1 |
| 2200 | 32 | 1.2 |
| 2400 | 22.5 | 0.35 |

As a rough rule of thumb (not a measured human baseline), 40–50 centipawns a move is strong-club play, so 1200–1800 play alike, at about that strength, and so do 2000 and 2200. Only the 1000 level, through its random moves, plays like a beginner. Adding random moves to 1200–1600 as well would spread them out; for now every level above 1000 is pure Stockfish.

| Level | Setting | Measured rating | Games |
|---|---|---|---|
| 1000 | Stockfish, `UCI_Elo` 1320, 0.15 s per move, 12% random moves | ≈ 980 | 40 vs SF 1320 |
| 1200 | Stockfish, `UCI_Elo` 1320, 0.15 s per move | ≈ 1290 | 40 vs SF 1320 |
| 1400 | Stockfish, `UCI_Elo` 1490, 0.25 s per move | ≈ 1480 | 40 vs SF 1500 |
| 1600 | Stockfish, `UCI_Elo` 1690, 0.25 s per move | ≈ 1580 | 40 vs SF 1600 |
| 1800 | Stockfish, `UCI_Elo` 1890, 0.25 s per move | ≈ 1780 | 40 vs SF 1800 |
| 2000 | Stockfish, `UCI_Elo` 2090, 0.25 s per move | ≈ 2030 | 40 vs SF 2000 |
| 2200 | Stockfish, `UCI_Elo` 2290, 0.25 s per move | ≈ 2240 | 40 vs SF 2200 |
| 2400 | Stockfish 19 Lite, `UCI_Elo` 2540, 0.5 s per move | ≈ 2400 | 40 vs SF 2400 (JS build; native SF measured ≈ 2410) |
| Review engine | Stockfish 19 Lite, full strength, 0.5 s per position | ≈ 3400 (26 wins, 3 draws, 1 loss) | 30 vs SF 3000 at 1 s per move |

The eight play levels were measured against the same JS build acting as the reference (`node calibrate.js '{"engine":"sfjs",...}' <refElo> 40 stockfish/stockfish-19-lite-single.js`), games from 12 balanced openings with colors reversed. Each level is within ±150 of its label on that scale. Stockfish Lite's own `UCI_Elo` reads about 90–140 low at the top end: set to 2540 it plays at ≈ 2400, so the 2400 level uses 2540.

## Matching chess.com

Review is tuned so its numbers line up with chess.com's Game Review. The reference is a real 29-move game that chess.com reviewed (both players rated about 1400–1650):

```
1. d4 d5 2. c4 dxc4 3. e4 e5 4. Nf3 Bb4+ 5. Nc3 exd4 6. Qxd4 Qxd4 7. Nxd4 Ne7 8. Bxc4 O-O 9. Bd2 Nbc6
10. Nxc6 Nxc6 11. a3 Bd6 12. O-O Bg4 13. h3 Be6 14. Bxe6 fxe6 15. f4 Nd4 16. e5 Nb3 17. exd6 Nxd2
18. Rfd1 Nb3 19. Rab1 cxd6 20. Rxd6 Rxf4 21. Rxe6 Nd4 22. Re7 b6 23. Rd1 Nc6 24. Rc7 Ne5 25. Re1 Nd3
26. Ree7 Nxb2 27. Rxg7+ Kf8 28. Rxh7 Nd3 29. Rh8# 1-0
```

| | chess.com | This app |
|---|---|---|
| Accuracy (White / Black) | 95.7 / 82.3 | 96.1 / 81.9 |
| Game rating | 2200 / 2000 | 2200 / 2000 |
| Book moves | 5 / 5 | 5 / 5 |
| Blunders | 0 / 0 | 0 / 0 |
| Mistakes | 0 / 3 | 0 / 2 |
| Great | 1 / 1 | 1 / 0 |

How:

- **Expected points.** Labels and accuracy use a win-chance curve gentler than lichess's: expected points = 50 + 50 × (2 / (1 + e^(−0.0019 × cp)) − 1), so a pawn is worth about 9.5 points around equality. A move is Excellent if it gives away at most 2 points, Good at most 5, an Inaccuracy at most 10, a Mistake at most 20, and a Blunder beyond that: chess.com's published thresholds. With lichess's steeper curve, 25…Nd3 above was a Blunder; chess.com called it a Mistake. The eval bar and graph still use lichess's curve.
- **Accuracy.** Each move scores 103.17 × e^(−0.055 × loss) − 3.17 (at least 25), and the game accuracy is the harmonic mean of those. The decay rate was fitted to the reference game. Moves in decided positions (win chance ≤ 5% or ≥ 95% before and after) don't count — once the game is gone, blunders barely move the evaluation and would otherwise read as near-perfect — so the app's accuracy can read a little higher than chess.com's on the same game.
- **Game rating** is read off accuracy through a piecewise-linear curve that passes through chess.com's two points (95.7% → 2200, 82.3% → 2000). Below those it falls fast: accuracy saturates in lost positions, so a deliberately thrown game still reads 60–75% and must not land in club-player territory (55% → 450, 65% → 750, 72% → 1100). The average centipawn loss is still shown when you hover over an accuracy.

chess.com's engine runs deeper on its servers and its formulas aren't public, so individual labels will sometimes differ, especially moves near a threshold. One game is also a thin basis for the lower end of the rating curve. More chess.com reviews, with the accuracy and game rating chess.com gave, would let it be refit.

## ACPL rating estimate (calibration tool)

Before the chess.com tuning, the review estimated rating from average centipawn loss. `calibrate-review.js` and `RS.estimateElo` still use it, and the notes below describe that fit.

Review estimates the rating each side played like from their average centipawn loss (ACPL): each non-book move's drop in evaluation, with evaluations capped at ±10 pawns. Moves made after the game is already decided (the mover's win chance stays above 95% or below 5% across the move) are left out, since the easy moves of a won ending or a forced mate would otherwise count as perfect play. It needs at least 8 counted moves.

The formula, rating ≈ 3490 − 463 × ln(ACPL), is a least-squares fit of each side's true rating on its ACPL over 180 games between the bots (358 sides with enough moves): 10 games of each level against itself, plus mixed pairings 1000–1400, 1000–1600, 1200–1600, 1200–1800, 1400–1800, 1400–2000, 1600–2000, 1600–2200, 1800–2200 and 2000–2400 (Stockfish 19 Lite analysis at 0.25 s per position, games capped at 130 plies).

The mixed pairings matter: a player who beats a much weaker opponent gets easy positions and a low ACPL. The previous formula, fitted only on bots playing their own level, rated the 1600 bot ≈2245 on average when it beat the 1000 bot. Fitting rating on ACPL, rather than ACPL on rating, also pulls single-game estimates toward the middle, which is the honest answer for so noisy a measure. The cost is that the scale is compressed: the averages run from about 1300 for the 1000 bot to about 2000 for the 2200 bot.

| Level vs itself | Measured rating | Average ACPL | Average estimate |
|---|---|---|---|
| 1000 | 1000 | 116 | ≈ 1320 |
| 1200 | 1250 | 86 | ≈ 1445 |
| 1400 | 1410 | 70 | ≈ 1570 |
| 1600 | 1565 | 55 | ≈ 1710 |
| 1800 | 1825 | 46 | ≈ 1755 |
| 2000 | 2070 | 34 | ≈ 1910 |
| 2200 | 2210 | 29 | ≈ 1980 |
| Stockfish `UCI_Elo` 2400 | 2310 | 38 | ≈ 1850 |

A single game still swings a lot: over the calibration games a side's estimate was off by 230 at the median (the previous formula: 300) and by 500 or more one time in eight (previously one in four). Like the bot ratings, it is on Stockfish's engine Elo scale, not an exact chess.com or FIDE equivalent.
