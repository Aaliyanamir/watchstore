import { apiFetch, displayWatchName, escapeHtml, formatPrice, imageUrl } from './api.js';
import { clearCart, getCart, removeFromCart, setCartQuantity } from './cart.js';

const itemsEl = document.getElementById('cartItems');
const countEl = document.getElementById('cartItemsCount');
const subtotalEl = document.getElementById('cartSubtotal');
const form = document.getElementById('checkoutForm');
const message = document.getElementById('orderMessage');
const submitButton = document.getElementById('submitOrder');
const confirmation = document.getElementById('orderConfirmation');
const cartLayout = document.querySelector('.cart-layout');
let catalog = [];
let busy = false;

function cartLines() {
  const byId = new Map(catalog.map(watch => [String(watch.id), watch]));
  return getCart().map(item => ({ ...item, watch: byId.get(item.watchId) }));
}

function renderCart() {
  const lines = cartLines();
  const itemCount = lines.reduce((total, item) => total + item.quantity, 0);
  const subtotal = lines.reduce((total, item) => total + (item.watch ? Number(item.watch.price) * item.quantity : 0), 0);
  countEl.textContent = itemCount ? `· ${itemCount} ${itemCount === 1 ? 'piece' : 'pieces'}` : '';
  subtotalEl.textContent = formatPrice(subtotal);
  submitButton.disabled = busy || !lines.length || lines.some(item => !item.watch || item.watch.stock < item.quantity);

  if (!lines.length) {
    itemsEl.innerHTML = `<div class="empty-bag"><span class="empty-bag-mark" aria-hidden="true">A</span><h2>A little room for something timeless.</h2><p>Your bag is waiting for its first timepiece.</p><a class="button button-dark" href="./shop.html">Discover the collection <span aria-hidden="true">→</span></a></div>`;
    return;
  }

  itemsEl.innerHTML = lines.map(({ watch, watchId, quantity }) => {
    if (!watch) {
      return `<article class="cart-item cart-item-unavailable"><div class="cart-item-image"><span class="image-monogram">A</span></div><div class="cart-item-details"><p class="product-category">Unavailable</p><h2>This piece is no longer in the collection</h2><button class="remove-item" type="button" data-remove="${escapeHtml(watchId)}">Remove</button></div></article>`;
    }
    const image = imageUrl(watch.photos?.[0]);
    const stock = Number(watch.stock) || 0;
    return `
      <article class="cart-item">
        <div class="cart-item-image">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(displayWatchName(watch))}">` : '<span class="image-monogram" aria-hidden="true">A</span>'}</div>
        <div class="cart-item-details">
          <p class="product-category">${escapeHtml(watch.category || 'AURELUX')}</p>
          <h2>${escapeHtml(displayWatchName(watch))}</h2>
          <p class="cart-unit-price">${formatPrice(watch.price)}</p>
          ${stock < quantity ? `<p class="stock-warning">Only ${stock} available. Adjust the quantity to continue.</p>` : ''}
          <div class="cart-item-controls">
            <div class="quantity-control" aria-label="Quantity">
              <button type="button" data-quantity="-1" data-id="${escapeHtml(watchId)}" aria-label="Decrease quantity" ${quantity <= 1 ? 'disabled' : ''}>−</button>
              <span>${quantity}</span>
              <button type="button" data-quantity="1" data-id="${escapeHtml(watchId)}" aria-label="Increase quantity" ${quantity >= Math.min(50, stock) ? 'disabled' : ''}>+</button>
            </div>
            <button class="remove-item" type="button" data-remove="${escapeHtml(watchId)}">Remove</button>
          </div>
        </div>
        <strong class="cart-line-total">${formatPrice(Number(watch.price) * quantity)}</strong>
      </article>`;
  }).join('');
}

itemsEl.addEventListener('click', event => {
  const remove = event.target.closest('[data-remove]');
  if (remove) {
    removeFromCart(remove.dataset.remove);
    renderCart();
    return;
  }
  const quantity = event.target.closest('[data-quantity]');
  if (!quantity) return;
  const item = getCart().find(entry => entry.watchId === quantity.dataset.id);
  const watch = catalog.find(entry => String(entry.id) === quantity.dataset.id);
  if (!item || !watch) return;
  setCartQuantity(item.watchId, item.quantity + Number(quantity.dataset.quantity));
  renderCart();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || submitButton.disabled) return;
  message.textContent = '';
  message.className = 'order-message';
  busy = true;
  submitButton.disabled = true;
  submitButton.innerHTML = 'Securing your selection…';

  const cart = getCart();
  const requestKey = sessionStorage.getItem('aurelux_order_request') || crypto.randomUUID();
  sessionStorage.setItem('aurelux_order_request', requestKey);
  const body = {
    customerName: form.elements.customerName.value.trim(),
    phone: form.elements.phone.value.trim(),
    address: form.elements.address.value.trim(),
    paymentMethod: 'COD',
    items: cart.map(item => ({ watchId: item.watchId, quantity: item.quantity })),
  };

  try {
    const result = await apiFetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
      body: JSON.stringify(body),
    });
    clearCart();
    sessionStorage.removeItem('aurelux_order_request');
    cartLayout.hidden = true;
    document.querySelector('.cart-hero').hidden = true;
    confirmation.hidden = false;
    document.getElementById('confirmationDetails').textContent =
      `Order ${result.order.id} · ${formatPrice(result.order.totalPrice)} · Our atelier will call ${result.order.phone} to confirm delivery.`;
    confirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    message.textContent = error.message;
    message.classList.add('is-error');
    await refreshCart();
  } finally {
    busy = false;
    submitButton.innerHTML = 'Place your order <span aria-hidden="true">→</span>';
    renderCart();
  }
});

async function refreshCart() {
  try {
    catalog = await apiFetch('/api/watches');
    renderCart();
  } catch (error) {
    message.textContent = error.message;
    message.classList.add('is-error');
  }
}

apiFetch('/api/watches')
  .then(data => {
    if (!Array.isArray(data)) throw new Error('The catalogue is temporarily unavailable.');
    catalog = data;
    renderCart();
  })
  .catch(error => {
    itemsEl.innerHTML = `<div class="empty-state"><h2>Your selection is safe.</h2><p>${escapeHtml(error.message)}</p><button class="button button-outline" id="retryCart" type="button">Try again</button></div>`;
    document.getElementById('retryCart').addEventListener('click', refreshCart, { once: true });
  });
