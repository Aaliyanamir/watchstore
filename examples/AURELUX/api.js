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
