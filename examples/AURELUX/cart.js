import { apiFetch } from './api.js';

const CART_KEY = 'aurelux_cart_v1';
const CART_EVENT = 'aurelux:cart-change';

export function getCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter(item => item && typeof item.watchId === 'string'
      && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 50);
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: cart }));
}

export function addToCart(watchId, quantity = 1) {
  const cart = getCart();
  const current = cart.find(item => item.watchId === String(watchId));
  if (current) current.quantity = Math.min(50, current.quantity + quantity);
  else cart.push({ watchId: String(watchId), quantity });
  saveCart(cart);
}

export function setCartQuantity(watchId, quantity) {
  const cart = getCart().filter(item => item.watchId !== String(watchId));
  if (quantity > 0) cart.push({ watchId: String(watchId), quantity: Math.min(50, quantity) });
  saveCart(cart);
}

export function removeFromCart(watchId) {
  saveCart(getCart().filter(item => item.watchId !== String(watchId)));
}

export function clearCart() {
  saveCart([]);
}

export function cartCount(cart = getCart()) {
  return cart.reduce((total, item) => total + item.quantity, 0);
}

export function watchCartButton() {
  const link = document.querySelector('[data-cart-link]');
  const count = document.querySelector('[data-cart-count]');
  if (!link || !count) return;
  const update = () => {
    const number = cartCount();
    count.textContent = String(number);
    link.setAttribute('aria-label', `Shopping bag, ${number} ${number === 1 ? 'item' : 'items'}`);
    link.classList.toggle('has-items', number > 0);
  };
  window.addEventListener(CART_EVENT, update);
  update();
}

export async function loadWatches() {
  return apiFetch('/api/watches');
}
