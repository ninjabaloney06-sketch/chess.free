# Unicorn Chess

A complete chess game with blue and pink pieces. Unicorns replace knights and Eiffel Towers replace rooks. Every piece still moves by the normal chess rules.

**Play:** open `chess/index.html` in any browser. It needs no build step or server.

- All the rules: castling, en passant, promotion (you pick the piece), check, checkmate, stalemate, the 50-move rule, threefold repetition, and insufficient material
- Two players on one device, or play against the computer as Blue or Pink (Easy, Medium, or Hard)
- Tap to move or drag and drop, legal-move hints, a move list in standard notation, captured pieces, undo, and board flip
- Works on phones and supports light and dark mode

**Tests:** `node chess/test.js` checks move generation against standard perft counts and checks game-end detection and the computer opponent.
