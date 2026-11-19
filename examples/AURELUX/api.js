const configuredApi = document.querySelector('meta[name="aurelux-api"]')?.content.trim();
const localHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const API_BASE = (configuredApi || (localHost
  ? `${window.location.protocol}//${window.location.hostname}:5000`
  : window.location.origin)).replace(/\/+$/, '');

export function apiUrl(path) {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiFetch(path, options = {}) {
  const response = await fetch(apiUrl(path), options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function imageUrl(path) {
  return path ? apiUrl(path) : '';
}

export function formatPrice(value) {
  return `Rs. ${Number(value || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 })}`;
}

export function displayWatchName(watch) {
  const rawName = String(watch?.name || 'AURELUX timepiece').replace(/\s+/g, ' ').trim();
  const description = String(watch?.description || '');
  const source = `${rawName} ${description}`;
  const model = rawName.match(/\b[A-Z]{2,}\s?\d{3,}\b/);

  if (model) return `${model[0]}${/\bautomatic\b/i.test(source) ? ' Automatic' : ''} Watch`;
  if (/\bgolden bridge\b/i.test(rawName) && /\bskeleton\b/i.test(rawName)) {
    return `Golden Bridge Skeleton${/\bautomatic\b/i.test(source) ? ' Automatic' : ''} Watch`;
  }

  let name = rawName.split(/\s+(?:for\s+(?:man|men|woman|women)\b|mens?\s+watch\b|women'?s\s+watch\b|reloj\b|montre\b|homme\b|hombre\b|original\s+luxury\s+brand\b|watch\s+box\b)/i)[0]
    .replace(/\bWristwatches\b/gi, 'Wristwatch')
    .replace(/(?:\s+Watches?)+$/i, '')
    .trim();

  if (name.length < 4) name = rawName;
  if (!/\b(?:watch|timepiece)\b/i.test(name)) {
    name += /\bautomatic\b/i.test(description) ? ' Automatic Watch' : ' Watch';
  }
  return name;
}
