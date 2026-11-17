/**
 * The only file that knows whether we're inside the Android app.
 * On Android, MainActivity injects `window.OpenHouseNative`; in a normal
 * browser those calls fall back to web equivalents, so the same app runs in both.
 */
const native = () => globalThis.OpenHouseNative;

export const isNativeApp = () => Boolean(native());

export function saveCsvFile(fileName, csvText) {
  if (native()) {
    native().shareCsv(fileName, csvText);
    return 'shared';
  }
  // Byte-order mark so Excel opens names with accents correctly.
  const blob = new Blob(['\ufeff', csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export function setKioskMode(enabled) {
  native()?.setKioskMode(Boolean(enabled));
}

export function exitApp() {
  native()?.exitApp();
}

export function appVersion() {
  return native()?.appVersion?.() ?? 'web';
}
