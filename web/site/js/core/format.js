export function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? new Intl.NumberFormat('en-US').format(n) : '';
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "2418 Linden Court" -> { number: "2418", street: "Linden Court" } */
export function splitStreet(street) {
  const m = String(street ?? '').trim().match(/^(\d+[A-Za-z]?)\s+(.+)$/);
  return m ? { number: m[1], street: m[2] } : { number: '', street: String(street ?? '').trim() };
}

/** Turns "2.5" baths into "2½". */
export function formatBaths(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  const whole = Math.floor(n);
  return n - whole >= 0.5 ? `${whole}½` : String(whole);
}
