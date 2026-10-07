// Saved games. A small IndexedDB store — everything stays in the browser, no
// server, no account. One record per saved or imported game: { id, savedAt,
// pgn, name (up to 25 characters), white, black, result, moves, source }.
(function () {
  'use strict';
  // 'stone-chess' is taken by the deep-review engine cache, so games live in
  // their own database.
  const NAME = 'stone-chess-games', STORE = 'games';
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const rq = indexedDB.open(NAME, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(STORE, { keyPath: 'id' });
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    return dbp;
  }

  const tx = (mode, fn) => open().then((db) => new Promise((res, rej) => {
    const rq = fn(db.transaction(STORE, mode).objectStore(STORE));
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  }));

  window.GameDB = {
    save: (rec) => tx('readwrite', (st) => st.put(rec)),
    list: () => tx('readonly', (st) => st.getAll()).then((rows) => rows.sort((a, b) => b.savedAt - a.savedAt)),
    get: (id) => tx('readonly', (st) => st.get(id)),
    del: (id) => tx('readwrite', (st) => st.delete(id)),
  };
})();
