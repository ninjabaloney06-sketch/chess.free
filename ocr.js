// Reads chess notation from a photo of a paper scoresheet, with Tesseract.js.
// The OCR module (ocr/) is loaded on first use; after that the language data
// comes from the browser's cache and reading works offline. Everything runs in
// the browser — no server, no API key.
(function (root) {
  'use strict';
  let workerP = null;

  // WASM SIMD: shipped since Chrome 91, Firefox 89, Safari 16.4. Older browsers
  // get the plain core.
  const simd = (() => {
    try {
      return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
    } catch (e) { return false; }
  })();

  function loadLib() {
    if (root.Tesseract) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'ocr/tesseract.min.js';
      s.onload = res;
      s.onerror = () => rej(new Error('Could not load the OCR module.'));
      document.head.appendChild(s);
    });
  }

  function getWorker(onProgress) {
    if (workerP) return workerP;
    workerP = loadLib().then(() => root.Tesseract.createWorker('eng', 1, {
      workerPath: 'ocr/worker.min.js',
      corePath: simd ? 'ocr/tesseract-core-simd-lstm.wasm.js' : 'ocr/tesseract-core-lstm.wasm.js',
      langPath: 'ocr/tessdata',
      logger: (m) => { if (onProgress) onProgress(m.status, m.progress); },
    }).then((w) => w.setParameters({ user_defined_dpi: '300' }).then(() => w)));
    workerP.catch(() => { workerP = null; });
    return workerP;
  }

  // Grayscale + gentle contrast stretch. Small photos are scaled up (OCR wants
  // roughly 300 dpi handwriting), huge ones down for speed.
  function preprocess(blob) {
    return createImageBitmap(blob).then((img) => {
      const MAX = 2000, MIN = 1200;
      let sc = 1;
      if (img.width > MAX) sc = MAX / img.width;
      else if (img.width < MIN) sc = Math.min(MIN / img.width, 3);
      const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, w, h);
      if (img.close) img.close();
      const d = ctx.getImageData(0, 0, w, h), p = d.data;
      const hist = new Array(256).fill(0);
      for (let i = 0; i < p.length; i += 4) {
        const g = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) | 0;
        p[i] = p[i + 1] = p[i + 2] = g;
        hist[g]++;
      }
      const n = p.length / 4;
      let lo = 0, hi = 255, acc = 0;
      for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * 0.02) { lo = v; break; } }
      acc = 0;
      for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= n * 0.02) { hi = v; break; } }
      const range = Math.max(1, hi - lo);
      for (let i = 0; i < p.length; i += 4) {
        const v = Math.max(0, Math.min(255, Math.round(((p[i] - lo) / range) * 255)));
        p[i] = p[i + 1] = p[i + 2] = v;
      }
      ctx.putImageData(d, 0, 0);
      return cv.toDataURL('image/png');
    });
  }

  // fileOrBlob: the photo. onProgress(status, 0..1) drives the UI.
  function recognize(fileOrBlob, onProgress) {
    return getWorker(onProgress)
      .then((w) => preprocess(fileOrBlob).then((img) => w.recognize(img)))
      .then((res) => res.data.text || '');
  }

  root.NotationOCR = { recognize };
})(window);
