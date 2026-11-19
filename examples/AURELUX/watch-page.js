import { addToCart } from './cart.js';
import { apiFetch, displayWatchName, escapeHtml, formatPrice, imageUrl } from './api.js';

const product = document.getElementById('watchProduct');
const watchId = new URLSearchParams(window.location.search).get('id');

function renderError(message) {
  product.innerHTML = `<div class="watch-load-error"><h1>This timepiece is unavailable.</h1><p>${escapeHtml(message)}</p><a href="./shop.html">Return to the collection</a></div>`;
}

function renderWatch(watch) {
  const photos = Array.isArray(watch.photos) ? watch.photos.filter(photo => typeof photo === 'string' && photo) : [];
  const photoUrls = photos.map(imageUrl);
  const inStock = Number(watch.stock) > 0;
  const name = displayWatchName(watch);
  const description = String(watch.description || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const contactUrl = `./appointments.html?watch=${encodeURIComponent(name)}`;

  document.title = `${name} | AURELUX`;
  product.innerHTML = `
    <div class="watch-gallery">
      <div class="watch-gallery-main" aria-label="Timepiece photographs">
        ${photoUrls.length
          ? `<img id="watchMainImage" src="${escapeHtml(photoUrls[0])}" alt="${escapeHtml(name)}" fetchpriority="high">`
          : '<div class="watch-gallery-placeholder"><span aria-hidden="true">A</span><p>Photographs available on request</p></div>'}
      </div>
      <div class="watch-thumbnails" role="group" aria-label="Choose a timepiece photograph">
        ${photoUrls.map((url, index) => `<button class="watch-thumbnail" type="button" data-photo-index="${index}" aria-label="View photograph ${index + 1}" aria-pressed="${index === 0}"><img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async"></button>`).join('')}
      </div>
    </div>
    <div class="watch-product-info">
      <p class="watch-product-kicker">${escapeHtml(watch.category || 'AURELUX')} · Genève</p>
      <h1 class="watch-product-title">${escapeHtml(name)}</h1>
      <p class="watch-product-price">${formatPrice(watch.price)}</p>
      <p class="watch-stock${inStock ? '' : ' is-sold-out'}" role="status">${inStock ? 'Available to order' : 'Currently unavailable'}</p>
      <div class="watch-description">${description.length
        ? description.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('')
        : '<p>Contact the atelier for further information about this timepiece.</p>'}</div>
      <button class="watch-add-button" id="addWatchToBag" type="button" ${inStock ? '' : 'disabled'}>
        <span>${inStock ? 'Add to bag' : 'Sold out'}</span><span aria-hidden="true">→</span>
      </button>
      <p class="watch-add-status" id="watchAddStatus" role="status" aria-live="polite"></p>
      <div class="watch-product-links"><a href="${escapeHtml(contactUrl)}">Ask our atelier about this piece</a><a href="./delivery-returns.html">Delivery &amp; returns</a></div>
    </div>`;

  product.querySelectorAll('[data-photo-index]').forEach(button => {
    button.addEventListener('click', () => {
      const image = product.querySelector('#watchMainImage');
      if (!image) return;
      image.src = photoUrls[Number(button.dataset.photoIndex)];
      image.alt = `${name}, photograph ${Number(button.dataset.photoIndex) + 1}`;
      product.querySelectorAll('[data-photo-index]').forEach(thumbnail => {
        thumbnail.setAttribute('aria-pressed', String(thumbnail === button));
      });
    });
  });

  product.querySelector('#addWatchToBag').addEventListener('click', () => {
    addToCart(String(watch.id));
    product.querySelector('#watchAddStatus').textContent = 'Added to your bag.';
    product.querySelector('#addWatchToBag span:first-child').textContent = 'Added to bag';
  });
}

if (!watchId) {
  renderError('Choose a timepiece from the collection to view its details.');
} else {
  apiFetch(`/api/watches/${encodeURIComponent(watchId)}`)
    .then(watch => {
      if (!watch || String(watch.id) !== watchId) {
        renderError('We could not find this timepiece in the current collection.');
        return;
      }
      renderWatch(watch);
    })
    .catch(error => {
      console.error('Unable to load AURELUX timepiece:', error);
      renderError(error.message || 'Please try again or contact the atelier for assistance.');
    });
}
