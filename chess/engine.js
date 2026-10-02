// Chess rules engine. Board squares are indexed 0..63, row 0 = rank 8, col 0 = file a.
// Colors: 'w' = White (moves first), 'b' = Black.
(function (root) {
  'use strict';

  const FILES = 'abcdefgh';
  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const other = (c) => (c === 'w' ? 'b' : 'w');
  const sq = (r, c) => r * 8 + c;
  const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const name = (i) => FILES[i % 8] + (8 - Math.floor(i / 8));

  function fromFEN(fen) {
    const [placement, turn, castle, ep, half, full] = fen.trim().split(/\s+/);
    const board = new Array(64).fill(null);
    placement.split('/').forEach((row, r) => {
      let c = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) c += +ch;
        else {
          board[sq(r, c)] = { t: ch.toLowerCase(), c: ch === ch.toUpperCase() ? 'w' : 'b' };
          c++;
        }
      }
    });
    const state = {
      board,
      turn: turn || 'w',
      castling: {
        wK: castle.includes('K'), wQ: castle.includes('Q'),
        bK: castle.includes('k'), bQ: castle.includes('q'),
      },
      ep: ep && ep !== '-' ? sq(8 - +ep[1], FILES.indexOf(ep[0])) : -1,
      halfmove: +half || 0,
      fullmove: +full || 1,
      positions: {},
    };
    state.positions[positionKey(state)] = 1;
    return state;
  }

  function toFEN(s) {
    let out = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = s.board[sq(r, c)];
        if (!p) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        out += p.c === 'w' ? p.t.toUpperCase() : p.t;
      }
      if (empty) out += empty;
      if (r < 7) out += '/';
    }
    const cs = (s.castling.wK ? 'K' : '') + (s.castling.wQ ? 'Q' : '') +
      (s.castling.bK ? 'k' : '') + (s.castling.bQ ? 'q' : '');
    return `${out} ${s.turn} ${cs || '-'} ${s.ep >= 0 ? name(s.ep) : '-'} ${s.halfmove} ${s.fullmove}`;
  }

  // Key used for threefold repetition: placement, side to move, castling, and en passant
  // only when an en passant capture is actually possible.
  function positionKey(s) {
    const parts = toFEN(s).split(' ');
    let ep = '-';
    if (s.ep >= 0) {
      const dir = s.turn === 'w' ? 1 : -1; // row offset from ep square to capturing pawns
      const r = Math.floor(s.ep / 8) + dir, c = s.ep % 8;
      for (const dc of [-1, 1]) {
        const p = onBoard(r, c + dc) && s.board[sq(r, c + dc)];
        if (p && p.t === 'p' && p.c === s.turn) ep = name(s.ep);
      }
    }
    return `${parts[0]} ${parts[1]} ${parts[2]} ${ep}`;
  }

  function isAttacked(board, i, by) {
    const r = Math.floor(i / 8), c = i % 8;
    const pr = by === 'w' ? r + 1 : r - 1; // attacking pawns sit one row "behind" from their view
    for (const dc of [-1, 1]) {
      if (onBoard(pr, c + dc)) {
        const p = board[sq(pr, c + dc)];
        if (p && p.c === by && p.t === 'p') return true;
      }
    }
    for (const [dr, dc] of KNIGHT) {
      if (onBoard(r + dr, c + dc)) {
        const p = board[sq(r + dr, c + dc)];
        if (p && p.c === by && p.t === 'n') return true;
      }
    }
    for (const [dr, dc] of KING) {
      if (onBoard(r + dr, c + dc)) {
        const p = board[sq(r + dr, c + dc)];
        if (p && p.c === by && p.t === 'k') return true;
      }
    }
    const slide = (dirs, types) => {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (onBoard(rr, cc)) {
          const p = board[sq(rr, cc)];
          if (p) {
            if (p.c === by && types.includes(p.t)) return true;
            break;
          }
          rr += dr; cc += dc;
        }
      }
      return false;
    };
    return slide(ROOK_DIRS, 'rq') || slide(BISHOP_DIRS, 'bq');
  }

  function kingSquare(board, color) {
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (p && p.t === 'k' && p.c === color) return i;
    }
    return -1;
  }

  function inCheck(s, color = s.turn) {
    const k = kingSquare(s.board, color);
    return k >= 0 && isAttacked(s.board, k, other(color));
  }

  function pseudoMoves(s) {
    const moves = [];
    const { board, turn } = s;
    const add = (from, to, extra = {}) => {
      const r = Math.floor(to / 8);
      if (board[from].t === 'p' && (r === 0 || r === 7)) {
        for (const promo of ['q', 'r', 'b', 'n']) moves.push({ from, to, promo, ...extra });
      } else moves.push({ from, to, ...extra });
    };

    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (!p || p.c !== turn) continue;
      const r = Math.floor(i / 8), c = i % 8;

      if (p.t === 'p') {
        const dir = turn === 'w' ? -1 : 1;
        const startRow = turn === 'w' ? 6 : 1;
        if (onBoard(r + dir, c) && !board[sq(r + dir, c)]) {
          add(i, sq(r + dir, c));
          if (r === startRow && !board[sq(r + 2 * dir, c)]) moves.push({ from: i, to: sq(r + 2 * dir, c), double: true });
        }
        for (const dc of [-1, 1]) {
          if (!onBoard(r + dir, c + dc)) continue;
          const t = sq(r + dir, c + dc);
          if (board[t] && board[t].c !== turn) add(i, t);
          else if (t === s.ep) moves.push({ from: i, to: t, enPassant: true });
        }
      } else if (p.t === 'n' || p.t === 'k') {
        for (const [dr, dc] of p.t === 'n' ? KNIGHT : KING) {
          if (!onBoard(r + dr, c + dc)) continue;
          const t = sq(r + dr, c + dc);
          if (!board[t] || board[t].c !== turn) moves.push({ from: i, to: t });
        }
        if (p.t === 'k') {
          const row = turn === 'w' ? 7 : 0;
          const opp = other(turn);
          if (i === sq(row, 4) && !isAttacked(board, i, opp)) {
            const rookAt = (col) => {
              const q = board[sq(row, col)];
              return q && q.t === 'r' && q.c === turn;
            };
            if (s.castling[turn + 'K'] && rookAt(7) && !board[sq(row, 5)] && !board[sq(row, 6)] &&
              !isAttacked(board, sq(row, 5), opp) && !isAttacked(board, sq(row, 6), opp)) {
              moves.push({ from: i, to: sq(row, 6), castle: 'K' });
            }
            if (s.castling[turn + 'Q'] && rookAt(0) && !board[sq(row, 3)] && !board[sq(row, 2)] &&
              !board[sq(row, 1)] && !isAttacked(board, sq(row, 3), opp) && !isAttacked(board, sq(row, 2), opp)) {
              moves.push({ from: i, to: sq(row, 2), castle: 'Q' });
            }
          }
        }
      } else {
        const dirs = p.t === 'r' ? ROOK_DIRS : p.t === 'b' ? BISHOP_DIRS : ROOK_DIRS.concat(BISHOP_DIRS);
        for (const [dr, dc] of dirs) {
          let rr = r + dr, cc = c + dc;
          while (onBoard(rr, cc)) {
            const t = sq(rr, cc);
            if (board[t]) {
              if (board[t].c !== turn) moves.push({ from: i, to: t });
              break;
            }
            moves.push({ from: i, to: t });
            rr += dr; cc += dc;
          }
        }
      }
    }
    return moves;
  }

  // Applies a move without legality checks or repetition bookkeeping.
  function applyRaw(s, m) {
    const board = s.board.slice();
    const piece = board[m.from];
    const captured = m.enPassant ? board[m.to + (s.turn === 'w' ? 8 : -8)] : board[m.to];
    board[m.to] = m.promo ? { t: m.promo, c: piece.c } : piece;
    board[m.from] = null;
    if (m.enPassant) board[m.to + (s.turn === 'w' ? 8 : -8)] = null;
    if (m.castle) {
      const row = Math.floor(m.from / 8);
      const [rf, rt] = m.castle === 'K' ? [7, 5] : [0, 3];
      board[sq(row, rt)] = board[sq(row, rf)];
      board[sq(row, rf)] = null;
    }
    const castling = { ...s.castling };
    if (piece.t === 'k') { castling[piece.c + 'K'] = false; castling[piece.c + 'Q'] = false; }
    const corners = { 63: 'wK', 56: 'wQ', 7: 'bK', 0: 'bQ' };
    if (corners[m.from]) castling[corners[m.from]] = false;
    if (corners[m.to]) castling[corners[m.to]] = false;

    return {
      board,
      turn: other(s.turn),
      castling,
      ep: m.double ? (m.from + m.to) / 2 : -1,
      halfmove: piece.t === 'p' || captured ? 0 : s.halfmove + 1,
      fullmove: s.turn === 'b' ? s.fullmove + 1 : s.fullmove,
      positions: s.positions,
      captured: captured || null,
    };
  }

  function legalMoves(s) {
    return pseudoMoves(s).filter((m) => !inCheck(applyRaw(s, m), s.turn));
  }

  function makeMove(s, m) {
    const next = applyRaw(s, m);
    next.positions = { ...s.positions };
    const key = positionKey(next);
    next.positions[key] = (next.positions[key] || 0) + 1;
    next.lastMove = m;
    return next;
  }

  function insufficientMaterial(board) {
    const minors = [];
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (!p || p.t === 'k') continue;
      if (p.t === 'p' || p.t === 'r' || p.t === 'q') return false;
      minors.push({ t: p.t, color: (Math.floor(i / 8) + (i % 8)) % 2 });
    }
    if (minors.length <= 1) return true;
    // Any number of bishops all on the same square color cannot mate.
    return minors.every((m) => m.t === 'b' && m.color === minors[0].color);
  }

  // Returns { over, result: 'checkmate'|'stalemate'|'fifty'|'repetition'|'material'|null, winner, check }
  function status(s) {
    const check = inCheck(s);
    if (legalMoves(s).length === 0) {
      return check
        ? { over: true, result: 'checkmate', winner: other(s.turn), check }
        : { over: true, result: 'stalemate', winner: null, check };
    }
    if (s.halfmove >= 100) return { over: true, result: 'fifty', winner: null, check };
    if ((s.positions[positionKey(s)] || 0) >= 3) return { over: true, result: 'repetition', winner: null, check };
    if (insufficientMaterial(s.board)) return { over: true, result: 'material', winner: null, check };
    return { over: false, result: null, winner: null, check };
  }

  function san(s, m) {
    const p = s.board[m.from];
    let out;
    if (m.castle) out = m.castle === 'K' ? 'O-O' : 'O-O-O';
    else {
      const capture = !!s.board[m.to] || m.enPassant;
      if (p.t === 'p') {
        out = (capture ? FILES[m.from % 8] + 'x' : '') + name(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
      } else {
        const twins = legalMoves(s).filter((o) => o.to === m.to && o.from !== m.from && s.board[o.from].t === p.t);
        let dis = '';
        if (twins.length) {
          const sameFile = twins.some((o) => o.from % 8 === m.from % 8);
          const sameRank = twins.some((o) => Math.floor(o.from / 8) === Math.floor(m.from / 8));
          if (!sameFile) dis = FILES[m.from % 8];
          else if (!sameRank) dis = name(m.from)[1];
          else dis = name(m.from);
        }
        out = p.t.toUpperCase() + dis + (capture ? 'x' : '') + name(m.to);
      }
    }
    const next = makeMove(s, m);
    if (inCheck(next)) out += legalMoves(next).length ? '+' : '#';
    return out;
  }

  // ---- Simple computer opponent: alpha-beta over material + piece-square bonuses ----
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const CENTER = [0, 1, 2, 3, 3, 2, 1, 0];

  function evaluate(s) {
    let score = 0;
    for (let i = 0; i < 64; i++) {
      const p = s.board[i];
      if (!p) continue;
      const r = Math.floor(i / 8), c = i % 8;
      let v = VALUE[p.t];
      const homeRow = p.c === 'w' ? 7 : 0;
      if (p.t === 'n' || p.t === 'b') v += (CENTER[r] + CENTER[c]) * 5 - (r === homeRow ? 15 : 0);
      if (p.t === 'p') v += (p.c === 'w' ? 6 - r : r - 1) * (2 + CENTER[c] * 4);
      if (p.t === 'q') v += (CENTER[r] + CENTER[c]) * 2;
      score += p.c === 'w' ? v : -v;
    }
    return s.turn === 'w' ? score : -score;
  }

  function orderMoves(s, moves) {
    const score = (m) => {
      const victim = s.board[m.to];
      return (victim ? 10 * VALUE[victim.t] - VALUE[s.board[m.from].t] : 0) + (m.promo === 'q' ? 800 : 0);
    };
    return moves.sort((a, b) => score(b) - score(a));
  }

  function negamax(s, depth, alpha, beta, ply) {
    const moves = legalMoves(s);
    if (!moves.length) return inCheck(s) ? -100000 + ply : 0;
    if (s.halfmove >= 100 || insufficientMaterial(s.board)) return 0;
    if (depth === 0) return quiesce(s, alpha, beta, 4);
    for (const m of orderMoves(s, moves)) {
      const v = -negamax(makeMove(s, m), depth - 1, -beta, -alpha, ply + 1);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function quiesce(s, alpha, beta, depth) {
    const stand = evaluate(s);
    if (stand >= beta || depth === 0) return stand;
    if (stand > alpha) alpha = stand;
    const caps = legalMoves(s).filter((m) => s.board[m.to] || m.enPassant || m.promo === 'q');
    for (const m of orderMoves(s, caps)) {
      const v = -quiesce(applyRaw(s, m), -beta, -alpha, depth - 1);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function bestMove(s, depth = 3) {
    // Shuffle first so equally good moves vary between games (the sort is stable).
    const moves = legalMoves(s);
    for (let i = moves.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [moves[i], moves[j]] = [moves[j], moves[i]];
    }
    orderMoves(s, moves);
    let best = null, bestScore = -Infinity, alpha = -Infinity;
    for (const m of moves) {
      const next = makeMove(s, m);
      // Avoid walking into a repetition draw when ahead.
      const v = (next.positions[positionKey(next)] >= 3) ? 0 : -negamax(next, depth - 1, -Infinity, -alpha, 1);
      if (v > bestScore) { bestScore = v; best = m; }
      if (v > alpha) alpha = v;
    }
    return best;
  }

  function perft(s, depth) {
    if (depth === 0) return 1;
    const moves = legalMoves(s);
    if (depth === 1) return moves.length;
    let n = 0;
    for (const m of moves) n += perft(applyRaw(s, m), depth - 1);
    return n;
  }

  const api = {
    START_FEN, fromFEN, toFEN, newGame: () => fromFEN(START_FEN),
    legalMoves, makeMove, inCheck, status, san, bestMove, perft, squareName: name,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChessEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
