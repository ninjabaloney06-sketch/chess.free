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
- **Import from a photo:** in the Import tab, choose a photo of a paper scoresheet and click *Read notation*. Tesseract.js (in `ocr/`, loaded on first use, about 7 MB the first time) reads the moves offline in the browser — no server, no API key. The recognized text lands in an editable box: fix what the OCR misread, then review. The parser repairs typical OCR noise on its own by matching every token against the legal moves of the position: German piece letters (S, T, L, D), 0 for O in castling, single confusable characters (1/l, 5/S, 8/B, 4/g ...), glued half-moves ("1.e4e5"), missing '=' in promotions, and junk tokens (page headers, "e.p."). A token that cannot be read as a legal move is reported with its move number so it can be fixed in the text. Handwriting works best when the photo is sharp, straight from above, and the notation fills the frame; the editable text is the safety net for whatever the OCR gets wrong
- **My games:** every imported game is saved in the browser (IndexedDB) and listed under My games in the Import tab — review it again, copy its PGN, or delete it. The games never leave the browser
- **Game review** powered by Stockfish 19 Lite at full strength (300k nodes per position, about 0.6 s on a laptop). A fixed node count instead of a time limit means the same game always gets the same review. Tuned to match chess.com's Game Review (see *Matching chess.com* below):
  - A summary first, like chess.com: a coach comment naming the turning point, the evaluation graph, each player's accuracy, move-label counts and game rating. *Start Review* then steps through the moves with a comment on each
  - Eval bar and evaluation graph
  - Accuracy for each player: the harmonic mean of their move accuracies, book moves not counted
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
| `test.js` | `node test.js` checks both move generators against standard perft counts, plus game-end detection, the bot finding mates, notation repair on a noisy OCR sheet, and the opening book |
| `stockfish/` | Stockfish 19 Lite (WebAssembly, GPLv3) and `stockfish-bundle.js`, the same engine packed into one script so it can start from `file://`. Rebuild the bundle with `node stockfish/make-bundle.js`. |
| `stockfish/get-full-engine.js` | Optional: downloads the full Stockfish 19 for offline deep review (git-ignored) |
| `review-stats.js` | Expected points, accuracy and game-rating formulas (plus the older ACPL rating estimate), shared by the page and `calibrate-review.js` |
| `notation.js` | Repairs raw notation text (typed or OCR'd) into a PGN by matching tokens against legal moves; also used by `test.js` |
| `ocr.js` | Scoresheet photo → text: image preprocessing plus the Tesseract.js worker, loaded on first use |
| `game-db.js` | The My games store (IndexedDB, browser-only) |
| `ocr/` | Tesseract.js 7 (Apache-2.0), its LSTM WebAssembly cores, and the English model (`tessdata`, best_int). Everything served from the site itself |
| `openings.js` | The opening book: hashes of every position on lichess's named opening lines (CC0). Rebuild with `node make-openings.js` |
| `openings-core.js` | Opening book lookups, and reading chess.com's book line from a PGN's `[ECOUrl]` |
| `calibrate-review.js` | `node calibrate-review.js <level>[:<level2>] <games> [analysisMs]` has a bot level play itself (or another level, swapping colors each game) and prints each side's average centipawn loss, accuracy and per-move scores, to fit the rating estimate |
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
- **Accuracy.** Each move scores 103.17 × e^(−0.055 × loss) − 3.17 (at least 25), and the game accuracy is the harmonic mean of those. The decay rate was fitted to the reference game.
- **Game rating** is read off accuracy through a piecewise-linear curve that passes through chess.com's two points (95.7% → 2200, 82.3% → 2000), with the lower end shaped so typical beginner accuracies (50–70%) land at beginner ratings (700–1400). The average centipawn loss is still shown when you hover over an accuracy.

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
