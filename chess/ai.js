// Search engine for the computer opponent and game review.
// 0x88 board (row 0 = rank 8), make/unmake, Zobrist hashing, transposition table,
// iterative deepening PVS with null-move pruning, late-move reductions and quiescence,
// evaluated with PeSTO's tapered piece-square tables.
// Runs in a Web Worker (message API) or directly (window.ChessAI / module.exports).
// The page can also start a worker from this function's source text (works from file://).
function chessAIModule(root) {
  'use strict';

  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const INF = 32000, MATE = 30000, MATE_BOUND = MATE - 1000, MAXPLY = 96;
  const N_DIRS = [-33, -31, -18, -14, 14, 18, 31, 33];
  const B_DIRS = [-17, -15, 15, 17];
  const R_DIRS = [-16, -1, 1, 16];
  const K_DIRS = [-17, -16, -15, -1, 1, 15, 16, 17];
  const FLAG_EP = 1, FLAG_CASTLE = 2, FLAG_DOUBLE = 4;
  const ORDER_VAL = [0, 100, 320, 330, 500, 900, 2000];

  // ---- PeSTO evaluation tables (white's view, a8 first) ----
  const MG_VAL = [0, 82, 337, 365, 477, 1025, 0];
  const EG_VAL = [0, 94, 281, 297, 512, 936, 0];
  const PHASE_INC = [0, 0, 1, 1, 2, 4, 0];
  const MG_PST = [null,
    [0, 0, 0, 0, 0, 0, 0, 0, 98, 134, 61, 95, 68, 126, 34, -11, -6, 7, 26, 31, 65, 56, 25, -20, -14, 13, 6, 21, 23, 12, 17, -23,
      -27, -2, -5, 12, 17, 6, 10, -25, -26, -4, -4, -10, 3, 3, 33, -12, -35, -1, -20, -23, -15, 24, 38, -22, 0, 0, 0, 0, 0, 0, 0, 0],
    [-167, -89, -34, -49, 61, -97, -15, -107, -73, -41, 72, 36, 23, 62, 7, -17, -47, 60, 37, 65, 84, 129, 73, 44, -9, 17, 19, 53, 37, 69, 18, 22,
      -13, 4, 16, 13, 28, 19, 21, -8, -23, -9, 12, 10, 19, 17, 25, -16, -29, -53, -12, -3, -1, 18, -14, -19, -105, -21, -58, -33, -17, -28, -19, -23],
    [-29, 4, -82, -37, -25, -42, 7, -8, -26, 16, -18, -13, 30, 59, 18, -47, -16, 37, 43, 40, 35, 50, 37, -2, -4, 5, 19, 50, 37, 37, 7, -2,
      -6, 13, 13, 26, 34, 12, 10, 4, 0, 15, 15, 15, 14, 27, 18, 10, 4, 15, 16, 0, 7, 21, 33, 1, -33, -3, -14, -21, -13, -12, -39, -21],
    [32, 42, 32, 51, 63, 9, 31, 43, 27, 32, 58, 62, 80, 67, 26, 44, -5, 19, 26, 36, 17, 45, 61, 16, -24, -11, 7, 26, 24, 35, -8, -20,
      -36, -26, -12, -1, 9, -7, 6, -23, -45, -25, -16, -17, 3, 0, -5, -33, -44, -16, -20, -9, -1, 11, -6, -71, -19, -13, 1, 17, 16, 7, -37, -26],
    [-28, 0, 29, 12, 59, 44, 43, 45, -24, -39, -5, 1, -16, 57, 28, 54, -13, -17, 7, 8, 29, 56, 47, 57, -27, -27, -16, -16, -1, 17, -2, 1,
      -9, -26, -9, -10, -2, -4, 3, -3, -14, 2, -11, -2, -5, 2, 14, 5, -35, -8, 11, 2, 8, 15, -3, 1, -1, -18, -9, 10, -15, -25, -31, -50],
    [-65, 23, 16, -15, -56, -34, 2, 13, 29, -1, -20, -7, -8, -4, -38, -29, -9, 24, 2, -16, -20, 6, 22, -22, -17, -20, -12, -27, -30, -25, -14, -36,
      -49, -1, -27, -39, -46, -44, -33, -51, -14, -14, -22, -46, -44, -30, -15, -27, 1, 7, -8, -64, -43, -16, 9, 8, -15, 36, 12, -54, 8, -28, 24, 14],
  ];
  const EG_PST = [null,
    [0, 0, 0, 0, 0, 0, 0, 0, 178, 173, 158, 134, 147, 132, 165, 187, 94, 100, 85, 67, 56, 53, 82, 84, 32, 24, 13, 5, -2, 4, 17, 17,
      13, 9, -3, -7, -7, -8, 3, -1, 4, 7, -6, 1, 0, -5, -1, -8, 13, 8, 8, 10, 13, 0, 2, -7, 0, 0, 0, 0, 0, 0, 0, 0],
    [-58, -38, -13, -28, -31, -27, -63, -99, -25, -8, -25, -2, -9, -25, -24, -52, -24, -20, 10, 9, -1, -9, -19, -41, -17, 3, 22, 22, 22, 11, 8, -18,
      -18, -6, 16, 25, 16, 17, 4, -18, -23, -3, -1, 15, 10, -3, -20, -22, -42, -20, -10, -5, -2, -20, -23, -44, -29, -51, -23, -15, -22, -18, -50, -64],
    [-14, -21, -11, -8, -7, -9, -17, -24, -8, -4, 7, -12, -3, -13, -4, -14, 2, -8, 0, -1, -2, 6, 0, 4, -3, 9, 12, 9, 14, 10, 3, 2,
      -6, 3, 13, 19, 7, 10, -3, -9, -12, -3, 8, 10, 13, 3, -7, -15, -14, -18, -7, -1, 4, -9, -15, -27, -23, -9, -23, -5, -9, -16, -5, -17],
    [13, 10, 18, 15, 12, 12, 8, 5, 11, 13, 13, 11, -3, 3, 8, 3, 7, 7, 7, 5, 4, -3, -5, -3, 4, 3, 13, 1, 2, 1, -1, 2,
      3, 5, 8, 4, -5, -6, -8, -11, -4, 0, -5, -1, -7, -12, -8, -16, -6, -6, 0, 2, -9, -9, -11, -3, -9, 2, 3, -1, -5, -13, 4, -20],
    [-9, 22, 22, 27, 27, 19, 10, 20, -17, 20, 32, 41, 58, 25, 30, 0, -20, 6, 9, 49, 47, 35, 19, 9, 3, 22, 24, 45, 57, 40, 57, 36,
      -18, 28, 19, 47, 31, 34, 39, 23, -16, -27, 15, 6, 9, 17, 10, 5, -22, -23, -30, -16, -16, -23, -36, -32, -33, -28, -22, -43, -5, -32, -20, -41],
    [-74, -35, -18, -18, -11, 15, 4, -17, -12, 17, 14, 17, 17, 38, 23, 11, 10, 17, 23, 15, 20, 45, 44, 13, -8, 22, 24, 27, 26, 33, 26, 3,
      -18, -4, 21, 24, 27, 23, 9, -11, -19, -3, 11, 21, 23, 16, 7, -9, -27, -11, 4, 13, 14, 4, -5, -17, -53, -34, -21, -11, -28, -14, -24, -43],
  ];
  // Per piece code (type | color<<3) and 0x88 square: material + PST from the owner's view.
  const PST_MG = [], PST_EG = [];
  for (let pc = 0; pc < 16; pc++) {
    PST_MG.push(new Int16Array(128));
    PST_EG.push(new Int16Array(128));
    const t = pc & 7, black = pc & 8;
    if (t < 1 || t > 6) continue;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      let i = (sq >> 4) * 8 + (sq & 7);
      if (black) i ^= 56;
      PST_MG[pc][sq] = MG_VAL[t] + MG_PST[t][i];
      PST_EG[pc][sq] = EG_VAL[t] + EG_PST[t][i];
    }
  }

  // ---- Zobrist keys (deterministic PRNG) ----
  let seed = 0x9e3779b9;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };
  const Z_LO = new Int32Array(16 * 128), Z_HI = new Int32Array(16 * 128);
  for (let i = 0; i < Z_LO.length; i++) { Z_LO[i] = rnd(); Z_HI[i] = rnd(); }
  const Z_SIDE_LO = rnd(), Z_SIDE_HI = rnd();
  const Z_CASTLE_LO = new Int32Array(16), Z_CASTLE_HI = new Int32Array(16);
  for (let i = 0; i < 16; i++) { Z_CASTLE_LO[i] = rnd(); Z_CASTLE_HI[i] = rnd(); }
  const Z_EP_LO = new Int32Array(128), Z_EP_HI = new Int32Array(128);
  for (let i = 0; i < 128; i++) { Z_EP_LO[i] = rnd(); Z_EP_HI[i] = rnd(); }

  const CASTLE_MASK = new Uint8Array(128).fill(15);
  CASTLE_MASK[0x74] = 12; CASTLE_MASK[0x77] = 14; CASTLE_MASK[0x70] = 13;
  CASTLE_MASK[0x04] = 3; CASTLE_MASK[0x07] = 11; CASTLE_MASK[0x00] = 7;

  // ---- Position state ----
  const board = new Int8Array(128);
  const count = new Int8Array(16);
  const kingSq = [0, 0];
  let side = 0, castle = 0, ep = -1, half = 0, hashLo = 0, hashHi = 0;
  let mgW = 0, mgB = 0, egW = 0, egB = 0, phase = 0;

  const STACK = 4096;
  const uCap = new Int8Array(STACK), uCastle = new Int8Array(STACK), uEp = new Int16Array(STACK), uHalf = new Int16Array(STACK);
  const uLo = new Int32Array(STACK), uHi = new Int32Array(STACK);
  const uMgW = new Int32Array(STACK), uMgB = new Int32Array(STACK), uEgW = new Int32Array(STACK), uEgB = new Int32Array(STACK), uPh = new Int16Array(STACK);
  let sp = 0;
  const histLo = new Int32Array(STACK), histHi = new Int32Array(STACK);
  let histPly = 0;

  function addPiece(sq, pc) {
    board[sq] = pc; count[pc]++;
    const k = pc * 128 + sq;
    hashLo ^= Z_LO[k]; hashHi ^= Z_HI[k];
    if (pc & 8) { mgB += PST_MG[pc][sq]; egB += PST_EG[pc][sq]; } else { mgW += PST_MG[pc][sq]; egW += PST_EG[pc][sq]; }
    phase += PHASE_INC[pc & 7];
  }
  function removePiece(sq) {
    const pc = board[sq];
    board[sq] = 0; count[pc]--;
    const k = pc * 128 + sq;
    hashLo ^= Z_LO[k]; hashHi ^= Z_HI[k];
    if (pc & 8) { mgB -= PST_MG[pc][sq]; egB -= PST_EG[pc][sq]; } else { mgW -= PST_MG[pc][sq]; egW -= PST_EG[pc][sq]; }
    phase -= PHASE_INC[pc & 7];
  }

  function setFEN(fen) {
    const [placement, turn, cs, eps, h] = fen.trim().split(/\s+/);
    board.fill(0); count.fill(0);
    hashLo = hashHi = 0; mgW = mgB = egW = egB = phase = 0;
    placement.split('/').forEach((row, r) => {
      let c = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { c += +ch; continue; }
        const t = 'pnbrqk'.indexOf(ch.toLowerCase()) + 1;
        const pc = t | (ch === ch.toUpperCase() ? 0 : 8);
        addPiece(r * 16 + c, pc);
        if (t === K) kingSq[pc & 8 ? 1 : 0] = r * 16 + c;
        c++;
      }
    });
    side = turn === 'b' ? 1 : 0;
    if (side) { hashLo ^= Z_SIDE_LO; hashHi ^= Z_SIDE_HI; }
    castle = (cs.includes('K') ? 1 : 0) | (cs.includes('Q') ? 2 : 0) | (cs.includes('k') ? 4 : 0) | (cs.includes('q') ? 8 : 0);
    hashLo ^= Z_CASTLE_LO[castle]; hashHi ^= Z_CASTLE_HI[castle];
    ep = -1;
    if (eps && eps !== '-') {
      ep = (8 - +eps[1]) * 16 + 'abcdefgh'.indexOf(eps[0]);
      hashLo ^= Z_EP_LO[ep]; hashHi ^= Z_EP_HI[ep];
    }
    half = +h || 0;
    sp = 0; histPly = 0;
    histLo[0] = hashLo; histHi[0] = hashHi;
  }

  function isAttacked(sq, by) {
    const bb = by << 3;
    if (by === 0) {
      let s = sq + 15; if (!(s & 0x88) && board[s] === P) return true;
      s = sq + 17; if (!(s & 0x88) && board[s] === P) return true;
    } else {
      let s = sq - 15; if (!(s & 0x88) && board[s] === (P | 8)) return true;
      s = sq - 17; if (!(s & 0x88) && board[s] === (P | 8)) return true;
    }
    for (let i = 0; i < 8; i++) {
      const s = sq + N_DIRS[i];
      if (!(s & 0x88) && board[s] === (N | bb)) return true;
    }
    for (let i = 0; i < 8; i++) {
      const s = sq + K_DIRS[i];
      if (!(s & 0x88) && board[s] === (K | bb)) return true;
    }
    for (let i = 0; i < 4; i++) {
      const d = R_DIRS[i];
      let s = sq + d;
      while (!(s & 0x88)) {
        const pc = board[s];
        if (pc) { if (pc === (R | bb) || pc === (Q | bb)) return true; break; }
        s += d;
      }
    }
    for (let i = 0; i < 4; i++) {
      const d = B_DIRS[i];
      let s = sq + d;
      while (!(s & 0x88)) {
        const pc = board[s];
        if (pc) { if (pc === (B | bb) || pc === (Q | bb)) return true; break; }
        s += d;
      }
    }
    return false;
  }

  // Move: from | to<<8 | promoType<<16 | flags<<20
  function genMoves(list, capsOnly) {
    let n = 0;
    const us = side, bit = us << 3;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const pc = board[sq];
      if (!pc || (pc & 8) !== bit) continue;
      const t = pc & 7;
      if (t === P) {
        const dir = us === 0 ? -16 : 16, to = sq + dir;
        const lastRow = us === 0 ? 0 : 7;
        if (!(to & 0x88) && !board[to]) {
          if ((to >> 4) === lastRow) {
            list[n++] = sq | (to << 8) | (Q << 16);
            if (!capsOnly) { list[n++] = sq | (to << 8) | (R << 16); list[n++] = sq | (to << 8) | (B << 16); list[n++] = sq | (to << 8) | (N << 16); }
          } else if (!capsOnly) {
            list[n++] = sq | (to << 8);
            const to2 = to + dir;
            if ((sq >> 4) === (us === 0 ? 6 : 1) && !board[to2]) list[n++] = sq | (to2 << 8) | (FLAG_DOUBLE << 20);
          }
        }
        for (let k = -1; k <= 1; k += 2) {
          const c = to + k;
          if (c & 0x88) continue;
          const v = board[c];
          if (v && (v & 8) !== bit) {
            if ((c >> 4) === lastRow) {
              list[n++] = sq | (c << 8) | (Q << 16);
              if (!capsOnly) { list[n++] = sq | (c << 8) | (R << 16); list[n++] = sq | (c << 8) | (B << 16); list[n++] = sq | (c << 8) | (N << 16); }
            } else list[n++] = sq | (c << 8);
          } else if (c === ep) list[n++] = sq | (c << 8) | (FLAG_EP << 20);
        }
      } else if (t === N || t === K) {
        const dirs = t === N ? N_DIRS : K_DIRS;
        for (let i = 0; i < 8; i++) {
          const to = sq + dirs[i];
          if (to & 0x88) continue;
          const v = board[to];
          if (v ? (v & 8) !== bit : !capsOnly) list[n++] = sq | (to << 8);
        }
        if (t === K && !capsOnly) {
          const them = us ^ 1;
          if (us === 0 && sq === 0x74) {
            if ((castle & 1) && !board[0x75] && !board[0x76] && !isAttacked(0x74, them) && !isAttacked(0x75, them) && !isAttacked(0x76, them))
              list[n++] = 0x74 | (0x76 << 8) | (FLAG_CASTLE << 20);
            if ((castle & 2) && !board[0x73] && !board[0x72] && !board[0x71] && !isAttacked(0x74, them) && !isAttacked(0x73, them) && !isAttacked(0x72, them))
              list[n++] = 0x74 | (0x72 << 8) | (FLAG_CASTLE << 20);
          } else if (us === 1 && sq === 0x04) {
            if ((castle & 4) && !board[0x05] && !board[0x06] && !isAttacked(0x04, them) && !isAttacked(0x05, them) && !isAttacked(0x06, them))
              list[n++] = 0x04 | (0x06 << 8) | (FLAG_CASTLE << 20);
            if ((castle & 8) && !board[0x03] && !board[0x02] && !board[0x01] && !isAttacked(0x04, them) && !isAttacked(0x03, them) && !isAttacked(0x02, them))
              list[n++] = 0x04 | (0x02 << 8) | (FLAG_CASTLE << 20);
          }
        }
      } else {
        const dirs = t === B ? B_DIRS : t === R ? R_DIRS : K_DIRS;
        for (let i = 0; i < dirs.length; i++) {
          const d = dirs[i];
          let to = sq + d;
          while (!(to & 0x88)) {
            const v = board[to];
            if (v) { if ((v & 8) !== bit) list[n++] = sq | (to << 8); break; }
            if (!capsOnly) list[n++] = sq | (to << 8);
            to += d;
          }
        }
      }
    }
    return n;
  }

  function make(m) {
    const from = m & 0xff, to = (m >> 8) & 0xff, promo = (m >> 16) & 0xf, flag = m >> 20;
    uCastle[sp] = castle; uEp[sp] = ep; uHalf[sp] = half; uLo[sp] = hashLo; uHi[sp] = hashHi;
    uMgW[sp] = mgW; uMgB[sp] = mgB; uEgW[sp] = egW; uEgB[sp] = egB; uPh[sp] = phase;
    const us = side, pc = board[from];
    let cap = 0;
    if (ep >= 0) { hashLo ^= Z_EP_LO[ep]; hashHi ^= Z_EP_HI[ep]; }
    hashLo ^= Z_CASTLE_LO[castle]; hashHi ^= Z_CASTLE_HI[castle];
    if (flag & FLAG_EP) {
      const capSq = to + (us === 0 ? 16 : -16);
      cap = board[capSq];
      removePiece(capSq);
    } else if (board[to]) {
      cap = board[to];
      removePiece(to);
    }
    removePiece(from);
    addPiece(to, promo ? (promo | (us << 3)) : pc);
    if (flag & FLAG_CASTLE) {
      const rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1;
      const rook = board[rf];
      removePiece(rf); addPiece(rt, rook);
    }
    if ((pc & 7) === K) kingSq[us] = to;
    castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    hashLo ^= Z_CASTLE_LO[castle]; hashHi ^= Z_CASTLE_HI[castle];
    ep = -1;
    if (flag & FLAG_DOUBLE) {
      // Only record an en passant square when a capture is actually possible.
      const enemyPawn = P | ((us ^ 1) << 3);
      if ((!((to - 1) & 0x88) && board[to - 1] === enemyPawn) || (!((to + 1) & 0x88) && board[to + 1] === enemyPawn)) {
        ep = (from + to) >> 1;
        hashLo ^= Z_EP_LO[ep]; hashHi ^= Z_EP_HI[ep];
      }
    }
    half = (pc & 7) === P || cap ? 0 : half + 1;
    side ^= 1;
    hashLo ^= Z_SIDE_LO; hashHi ^= Z_SIDE_HI;
    uCap[sp] = cap;
    sp++;
    histPly++; histLo[histPly] = hashLo; histHi[histPly] = hashHi;
  }

  function unmake(m) {
    sp--; histPly--;
    const from = m & 0xff, to = (m >> 8) & 0xff, promo = (m >> 16) & 0xf, flag = m >> 20;
    side ^= 1;
    const us = side;
    const moved = board[to];
    count[moved]--;
    const orig = promo ? (P | (us << 3)) : moved;
    board[from] = orig; count[orig]++;
    board[to] = 0;
    const cap = uCap[sp];
    if (cap) {
      const capSq = flag & FLAG_EP ? to + (us === 0 ? 16 : -16) : to;
      board[capSq] = cap; count[cap]++;
    }
    if (flag & FLAG_CASTLE) {
      const rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1;
      board[rf] = board[rt]; board[rt] = 0;
    }
    if ((orig & 7) === K) kingSq[us] = from;
    castle = uCastle[sp]; ep = uEp[sp]; half = uHalf[sp]; hashLo = uLo[sp]; hashHi = uHi[sp];
    mgW = uMgW[sp]; mgB = uMgB[sp]; egW = uEgW[sp]; egB = uEgB[sp]; phase = uPh[sp];
  }

  function makeNull() {
    uEp[sp] = ep; uLo[sp] = hashLo; uHi[sp] = hashHi; uHalf[sp] = half;
    if (ep >= 0) { hashLo ^= Z_EP_LO[ep]; hashHi ^= Z_EP_HI[ep]; }
    ep = -1; side ^= 1; half++;
    hashLo ^= Z_SIDE_LO; hashHi ^= Z_SIDE_HI;
    sp++; histPly++; histLo[histPly] = hashLo; histHi[histPly] = hashHi;
  }
  function unmakeNull() {
    sp--; histPly--;
    side ^= 1; ep = uEp[sp]; hashLo = uLo[sp]; hashHi = uHi[sp]; half = uHalf[sp];
  }

  const inCheck = () => isAttacked(kingSq[side], side ^ 1);

  function isRepetition() {
    for (let i = histPly - 2, stop = histPly - half; i >= 0 && i >= stop; i -= 2) {
      if (histLo[i] === hashLo && histHi[i] === hashHi) return true;
    }
    return false;
  }

  function insufficient() {
    if (count[P] || count[P | 8] || count[R] || count[R | 8] || count[Q] || count[Q | 8]) return false;
    return count[N] + count[B] <= 1 && count[N | 8] + count[B | 8] <= 1;
  }

  const hasPieces = (s) => {
    const b = s << 3;
    return count[N | b] + count[B | b] + count[R | b] + count[Q | b] > 0;
  };

  function evaluate() {
    const ph = phase > 24 ? 24 : phase;
    let s = ((mgW - mgB) * ph + (egW - egB) * (24 - ph)) / 24;
    if (count[B] >= 2) s += 30;
    if (count[B | 8] >= 2) s -= 30;
    // Mop-up: with no pawns left, drive the losing king to the edge and bring ours closer.
    if (!count[P] && !count[P | 8] && Math.abs(s) > 300) {
      const strong = s > 0 ? 0 : 1, weak = strong ^ 1;
      const wk = kingSq[weak], sk = kingSq[strong];
      const wr = wk >> 4, wc = wk & 7;
      const centerDist = Math.max(3 - wr, wr - 4) + Math.max(3 - wc, wc - 4);
      const kingDist = Math.abs(wr - (sk >> 4)) + Math.abs(wc - (sk & 7));
      const bonus = centerDist * 10 + (14 - kingDist) * 4;
      s += strong === 0 ? bonus : -bonus;
    }
    s = side === 0 ? s : -s;
    return (s | 0) + 10;
  }

  // ---- Search ----
  const TT_SIZE = 1 << 20, TT_MASK = TT_SIZE - 1;
  const ttLock = new Int32Array(TT_SIZE), ttMove = new Int32Array(TT_SIZE), ttScore = new Int32Array(TT_SIZE);
  const ttDepth = new Int8Array(TT_SIZE), ttFlag = new Uint8Array(TT_SIZE);
  const killers = new Int32Array(MAXPLY * 2);
  const history = new Int32Array(128 * 128);
  const moveLists = [], scoreLists = [];
  for (let i = 0; i < MAXPLY + 1; i++) { moveLists.push(new Int32Array(256)); scoreLists.push(new Int32Array(256)); }
  let nodes = 0, deadline = 0, stopped = false, canStop = false, nodeLimit = Infinity;

  function scoreMoves(list, scores, n, ttm, ply) {
    const k1 = killers[ply * 2], k2 = killers[ply * 2 + 1];
    for (let i = 0; i < n; i++) {
      const m = list[i];
      const from = m & 0xff, to = (m >> 8) & 0xff;
      if (m === ttm) scores[i] = 3000000;
      else if (board[to] || (m >> 20) & FLAG_EP) {
        scores[i] = 2000000 + ORDER_VAL[board[to] & 7 || P] * 10 - ORDER_VAL[board[from] & 7] / 10;
      } else if ((m >> 16) & 0xf) scores[i] = 1900000;
      else if (m === k1) scores[i] = 1800000;
      else if (m === k2) scores[i] = 1700000;
      else scores[i] = history[from * 128 + to];
    }
  }
  function pickNext(list, scores, i, n) {
    let best = i;
    for (let j = i + 1; j < n; j++) if (scores[j] > scores[best]) best = j;
    if (best !== i) {
      const m = list[i]; list[i] = list[best]; list[best] = m;
      const s = scores[i]; scores[i] = scores[best]; scores[best] = s;
    }
  }

  function checkTime() {
    if (canStop && ((nodes & 2047) === 0 && Date.now() > deadline || nodes > nodeLimit)) stopped = true;
  }

  function qsearch(alpha, beta, ply) {
    nodes++; checkTime();
    if (stopped) return 0;
    const stand = evaluate();
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply >= MAXPLY) return stand;
    const list = moveLists[ply], scores = scoreLists[ply];
    const n = genMoves(list, true);
    scoreMoves(list, scores, n, 0, ply);
    for (let i = 0; i < n; i++) {
      pickNext(list, scores, i, n);
      const m = list[i];
      const victim = board[(m >> 8) & 0xff] & 7 || P;
      if (!((m >> 16) & 0xf) && stand + ORDER_VAL[victim] + 200 < alpha) continue;
      make(m);
      if (isAttacked(kingSq[side ^ 1], side)) { unmake(m); continue; }
      const v = -qsearch(-beta, -alpha, ply + 1);
      unmake(m);
      if (stopped) return 0;
      if (v > alpha) { alpha = v; if (v >= beta) return v; }
    }
    return alpha;
  }

  function search(alpha, beta, depth, ply, doNull) {
    const pv = beta - alpha > 1;
    if (ply > 0) {
      if (half >= 100 || isRepetition() || insufficient()) return 0;
      if (alpha < -MATE + ply) alpha = -MATE + ply;
      if (beta > MATE - ply - 1) beta = MATE - ply - 1;
      if (alpha >= beta) return alpha;
    }
    const check = inCheck();
    if (check) depth++;
    if (depth <= 0 || ply >= MAXPLY) return qsearch(alpha, beta, ply);
    nodes++; checkTime();
    if (stopped) return 0;

    const idx = hashLo & TT_MASK;
    let ttm = 0;
    if (ttFlag[idx] && ttLock[idx] === hashHi) {
      ttm = ttMove[idx];
      if (!pv && ttDepth[idx] >= depth) {
        let s = ttScore[idx];
        if (s > MATE_BOUND) s -= ply; else if (s < -MATE_BOUND) s += ply;
        const f = ttFlag[idx];
        if (f === 1 || (f === 2 && s >= beta) || (f === 3 && s <= alpha)) return s;
      }
    }

    if (!pv && !check) {
      const ev = evaluate();
      if (depth <= 3 && ev - 110 * depth >= beta && beta > -MATE_BOUND && beta < MATE_BOUND) return ev;
      if (doNull && depth >= 3 && ev >= beta && hasPieces(side)) {
        makeNull();
        const v = -search(-beta, -beta + 1, depth - 3 - (depth >> 2), ply + 1, false);
        unmakeNull();
        if (stopped) return 0;
        if (v >= beta) return v >= MATE_BOUND ? beta : v;
      }
    }

    const list = moveLists[ply], scores = scoreLists[ply];
    const n = genMoves(list, false);
    scoreMoves(list, scores, n, ttm, ply);
    const origAlpha = alpha;
    let best = -INF, bestMove = 0, legal = 0;
    for (let i = 0; i < n; i++) {
      pickNext(list, scores, i, n);
      const m = list[i];
      const quiet = !board[(m >> 8) & 0xff] && !((m >> 16) & 0xf) && !((m >> 20) & FLAG_EP);
      make(m);
      if (isAttacked(kingSq[side ^ 1], side)) { unmake(m); continue; }
      legal++;
      let v;
      if (legal === 1) v = -search(-beta, -alpha, depth - 1, ply + 1, true);
      else {
        let r = 0;
        if (depth >= 3 && legal > 3 && quiet && !check && !inCheck()) {
          r = 1 + (legal > 8 ? 1 : 0) + (depth >= 7 ? 1 : 0) - (pv ? 1 : 0);
          if (r < 0) r = 0;
        }
        v = -search(-alpha - 1, -alpha, depth - 1 - r, ply + 1, true);
        if (v > alpha && r > 0) v = -search(-alpha - 1, -alpha, depth - 1, ply + 1, true);
        if (v > alpha && v < beta) v = -search(-beta, -alpha, depth - 1, ply + 1, true);
      }
      unmake(m);
      if (stopped) return 0;
      if (v > best) {
        best = v; bestMove = m;
        if (v > alpha) {
          alpha = v;
          if (v >= beta) {
            if (quiet) {
              if (killers[ply * 2] !== m) { killers[ply * 2 + 1] = killers[ply * 2]; killers[ply * 2] = m; }
              const h = (m & 0xff) * 128 + ((m >> 8) & 0xff);
              history[h] = Math.min(history[h] + depth * depth, 1000000);
            }
            break;
          }
        }
      }
    }
    if (legal === 0) return check ? -MATE + ply : 0;

    let s = best;
    if (s > MATE_BOUND) s += ply; else if (s < -MATE_BOUND) s -= ply;
    const flag = best >= beta ? 2 : best > origAlpha ? 1 : 3;
    if (!ttFlag[idx] || ttLock[idx] !== hashHi || depth >= ttDepth[idx] || flag === 1) {
      ttLock[idx] = hashHi; ttMove[idx] = bestMove; ttScore[idx] = s; ttDepth[idx] = depth; ttFlag[idx] = flag;
    }
    return best;
  }

  function legalRootMoves() {
    const list = new Int32Array(256), out = [];
    const n = genMoves(list, false);
    for (let i = 0; i < n; i++) {
      make(list[i]);
      if (!isAttacked(kingSq[side ^ 1], side)) out.push(list[i]);
      unmake(list[i]);
    }
    return out;
  }

  const SQ = (s) => 'abcdefgh'[s & 7] + (8 - (s >> 4));
  const toUci = (m) => SQ(m & 0xff) + SQ((m >> 8) & 0xff) + (((m >> 16) & 0xf) ? ' pnbrqk'[(m >> 16) & 0xf] : '');

  function setPosition(fen, moves) {
    setFEN(fen);
    for (const u of moves || []) {
      const m = legalRootMoves().find((x) => toUci(x) === u);
      if (!m) throw new Error('Illegal move ' + u);
      make(m);
    }
  }

  // Search every root move; moves within `window` of the best get exact scores.
  // Returns root moves sorted best first with their scores (side-to-move view).
  function rootSearch(moves, depth, window) {
    const res = [];
    let bestV = -INF;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      make(m);
      let v;
      if (i === 0) v = -search(-INF, INF, depth - 1, 1, true);
      else {
        const floor = Math.max(bestV - window, -INF + 1);
        v = -search(-floor - 1, -floor, depth - 1, 1, true);
        if (v > floor && !stopped) v = -search(-INF, -floor, depth - 1, 1, true);
      }
      unmake(m);
      if (stopped) return null;
      res.push({ m, v });
      if (v > bestV) bestV = v;
    }
    res.sort((a, b) => b.v - a.v);
    return res;
  }

  // opts: { fen, moves, timeMs, maxDepth, noise, window, nodes }
  // noise: random 0..noise centipawns added to each candidate's score (weakens play).
  function think(opts) {
    setPosition(opts.fen, opts.moves);
    const start = Date.now();
    const timeMs = opts.timeMs || 1000;
    deadline = start + timeMs;
    nodeLimit = opts.nodes || Infinity;
    nodes = 0; stopped = false; canStop = false;
    killers.fill(0);
    for (let i = 0; i < history.length; i++) history[i] >>= 3;
    let moves = legalRootMoves();
    if (!moves.length) return { move: null, score: inCheck() ? -MATE : 0, depth: 0, nodes: 0, lines: [] };
    const noise = opts.noise || 0;
    const window = Math.max(noise, opts.window || 0);
    let result = null, depth = 0;
    const maxDepth = Math.min(opts.maxDepth || 64, MAXPLY - 10);
    for (let d = 1; d <= maxDepth; d++) {
      const r = rootSearch(moves, d, window);
      if (!r) break;
      result = r; depth = d;
      moves = r.map((x) => x.m);
      canStop = true;
      if (Math.abs(r[0].v) > MATE_BOUND && d > 4) break;
      if (Date.now() - start > timeMs * 0.45) break;
    }
    let pick = result[0];
    if (noise > 0) {
      let bestNoisy = -Infinity;
      for (const c of result) {
        if (c.v < result[0].v - window) break;
        const nv = c.v + Math.random() * noise;
        if (nv > bestNoisy) { bestNoisy = nv; pick = c; }
      }
    }
    return {
      move: toUci(pick.m), score: pick.v, best: toUci(result[0].m), bestScore: result[0].v,
      lines: result.slice(0, 5).map((x) => ({ move: toUci(x.m), score: x.v })),
      depth, nodes, ms: Date.now() - start,
    };
  }

  function perft(depth) {
    if (depth === 0) return 1;
    const list = new Int32Array(256);
    const n = genMoves(list, false);
    let total = 0;
    for (let i = 0; i < n; i++) {
      make(list[i]);
      if (!isAttacked(kingSq[side ^ 1], side)) total += perft(depth - 1);
      unmake(list[i]);
    }
    return total;
  }

  // Playing strength presets, calibrated against Stockfish's UCI_Elo (see chess/calibrate.js).
  const LEVELS = [
    { elo: 1000, maxDepth: 1, noise: 90, timeMs: 5000 },
    { elo: 1200, maxDepth: 2, noise: 150, timeMs: 5000 },
    { elo: 1400, maxDepth: 3, noise: 75, timeMs: 5000 },
    { elo: 1600, maxDepth: 3, noise: 15, timeMs: 5000 },
    { elo: 1800, maxDepth: 4, noise: 0, timeMs: 5000 },
    { elo: 2000, maxDepth: 5, noise: 0, timeMs: 5000 },
    { elo: 2200, maxDepth: 6, noise: 0, timeMs: 5000 },
  ];
  const MATE_SCORE = MATE;

  const api = {
    think, LEVELS, MATE: MATE_SCORE, MATE_BOUND,
    perft: (fen, depth) => { setFEN(fen); return perft(depth); },
    play: (fen, moves, level) => think({ fen, moves, ...level }),
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (typeof importScripts === 'function' && typeof window === 'undefined') {
    root.onmessage = (e) => {
      const { id, opts } = e.data;
      let result;
      try { result = think(opts); } catch (err) { result = { error: String(err) }; }
      root.postMessage({ id, result });
    };
  } else {
    root.ChessAI = api;
    root.chessAIModule = chessAIModule;
  }
}
chessAIModule(typeof self !== 'undefined' ? self : globalThis);
