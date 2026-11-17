/**
 * Shrinks a camera photo before storing it. Phone cameras produce 12+ MP
 * images; a tablet screen needs about 2400px on the long edge, and smaller
 * files keep the local database fast.
 */
export async function prepareImage(file, { maxEdge = 2400, quality = 0.85 } = {}) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob ? { blob, width, height } : { blob: file, width: 0, height: 0 };
  } catch {
    return { blob: file, width: 0, height: 0 };
  }
}
