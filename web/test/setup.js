import 'fake-indexeddb/auto';

// jsdom doesn't implement object URLs; the app only needs them for <img src>.
if (typeof URL.createObjectURL !== 'function') {
  let n = 0;
  URL.createObjectURL = () => `blob:test/${++n}`;
  URL.revokeObjectURL = () => {};
}
