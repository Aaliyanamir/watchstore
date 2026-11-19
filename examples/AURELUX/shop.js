import { apiFetch, displayWatchName, escapeHtml, formatPrice, imageUrl } from './api.js';

let allWatches = [];
let currentCategory = 'all';

const grid = document.getElementById('shopGrid');
const categoryFilters = document.getElementById('categoryFilters');
const searchInput = document.getElementById('searchInput');
const catalogueStatus = document.getElementById('catalogueStatus');
const retryButton = document.getElementById('retryCatalogue');

const styleReferences = [
  { id: 'reference-classic', name: 'Heritage Automatic', category: 'Heritage', image: '/img/aurelux/style-references/classic.webp' },
  { id: 'reference-pocket', name: 'Open-Face Pocket Watch', category: 'Pocket', image: '/img/aurelux/style-references/pocket.webp' },
  { id: 'reference-chronograph', name: 'Classic Chronograph', category: 'Chronograph', image: '/img/aurelux/style-references/chronograph.webp' },
  { id: 'reference-diver', name: 'Deep Blue Diver', category: 'Diver', image: '/img/aurelux/style-references/diver.webp' },
  { id: 'reference-minimal', name: 'Minimal Dress Watch', category: 'Dress', image: '/img/aurelux/style-references/minimal.webp' },
  { id: 'reference-evening', name: 'Evening Edition', category: 'Dress', image: '/img/aurelux/style-references/evening.webp' },
  { id: 'reference-sport', name: 'Sport Steel Watch', category: 'Sport', image: '/img/aurelux/style-references/sport.webp' },
  { id: 'reference-coastal', name: 'Coastal Field Watch', category: 'Field', image: '/img/aurelux/style-references/coastal.webp' },
  { id: 'reference-digital', name: 'Contemporary Digital', category: 'Digital', image: '/img/aurelux/style-references/digital.webp' },
  { id: 'reference-blue', name: 'Blue Dial Study', category: 'Design study', image: '/img/aurelux/style-references/blue.webp' },
].map(watch => ({
  ...watch,
  isReference: true,
  description: 'Illustrative style reference only. This is not an available AURELUX product.',
}));

async function loadWatches() {
  catalogueStatus.textContent = 'Checking current availability…';
  retryButton.hidden = true;
  grid.innerHTML = '<p class="shop-loading caps" role="status">Loading the collection…</p>';
  try {
    const watches = await apiFetch('/api/watches');
    if (!Array.isArray(watches)) throw new Error('The catalogue returned an unexpected response.');
    allWatches = [...watches, ...styleReferences.slice(0, Math.max(0, 10 - watches.length))];
    catalogueStatus.textContent = '';
    buildCategoryFilters();
    renderGrid();
  } catch (error) {
    console.error('Unable to load AURELUX watches:', error);
    allWatches = styleReferences;
    catalogueStatus.textContent = 'Live availability is temporarily unavailable. Showing illustrative style references instead.';
    retryButton.hidden = false;
    buildCategoryFilters();
    renderGrid();
  }
}

function buildCategoryFilters() {
  const categories = [...new Set(allWatches.map(watch => watch.category).filter(Boolean))];
  categoryFilters.innerHTML = `<button class="filter-chip${currentCategory === 'all' ? ' active' : ''}" data-category="all" type="button">All</button>`
    + categories.map(category => `<button class="filter-chip${currentCategory === category ? ' active' : ''}" data-category="${escapeHtml(category)}" type="button">${escapeHtml(category)}</button>`).join('');

  categoryFilters.querySelectorAll('.filter-chip').forEach(button => {
    button.addEventListener('click', () => {
      currentCategory = button.dataset.category;
      categoryFilters.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip === button);
      });
      renderGrid();
    });
  });
}

function getFilteredWatches() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  return allWatches.filter(watch => {
    const matchesCategory = currentCategory === 'all' || watch.category === currentCategory;
    const searchable = `${watch.name || ''} ${watch.description || ''}`.toLocaleLowerCase();
    return matchesCategory && (!query || searchable.includes(query));
  });
}

function renderGrid() {
  const watches = getFilteredWatches();
  if (!watches.length) {
    grid.innerHTML = '<p class="shop-empty">No timepieces match your search.</p>';
    return;
  }
  grid.innerHTML = watches.map(renderCard).join('');
}

function renderCard(watch) {
  const id = String(watch.id);
  const name = displayWatchName(watch);
  const image = watch.isReference ? watch.image : imageUrl(watch.photos?.[0]);
  const inStock = Number(watch.stock) > 0;
  const description = String(watch.description || '').split(/\r?\n/)[0].slice(0, 110);
  const detailUrl = watch.isReference ? './appointments.html' : `./watch.html?id=${encodeURIComponent(id)}`;
  const media = image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(watch.isReference ? `Illustrative style reference: ${name}` : name)}" loading="lazy" decoding="async">`
    : '<div class="shop-card-placeholder" aria-label="Product photography available on request"><span>A</span><small>Photography available on request</small></div>';

  return `
    <a class="shop-card${watch.isReference ? ' is-reference' : ''}" href="${escapeHtml(detailUrl)}" aria-label="${watch.isReference ? `Ask our atelier about the illustrative style reference ${escapeHtml(name)}` : `View ${escapeHtml(name)}`}">
      <div class="shop-card-img">
        ${media}
        <span class="shop-card-stock-badge${watch.isReference ? ' reference' : inStock ? '' : ' out'}">${watch.isReference ? 'Illustrative' : inStock ? 'Available' : 'Sold out'}</span>
      </div>
      <div class="shop-card-body">
        <p class="caps shop-card-cat">${escapeHtml(watch.isReference ? 'Style reference' : watch.category || 'AURELUX')}</p>
        <h2 class="shop-card-name">${escapeHtml(name)}</h2>
        <p class="shop-card-desc">${escapeHtml(description)}</p>
        <div class="shop-card-footer">
          <p class="shop-card-price">${watch.isReference ? 'Enquire' : formatPrice(watch.price)}</p>
          <span class="shop-card-view">${watch.isReference ? 'Ask atelier' : 'Discover'} <span aria-hidden="true">↗</span></span>
        </div>
      </div>
    </a>`;
}

searchInput.addEventListener('input', renderGrid);
retryButton.addEventListener('click', loadWatches);
loadWatches();
