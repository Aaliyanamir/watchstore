import { API_BASE, apiFetch, escapeHtml, formatPrice, imageUrl } from '../api.js';

const token = localStorage.getItem('aurelux_token');
const watchGrid = document.getElementById('watchGrid');
const orderBody = document.getElementById('ordersBody');
const form = document.getElementById('watchForm');
const preview = document.getElementById('photoPreview');
const toastEl = document.getElementById('adminToast');
const tabs = [...document.querySelectorAll('.admin-tab')];
const panels = [...document.querySelectorAll('.admin-panel')];
const orderStatuses = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
let watches = [];
let orders = [];
let toastTimer;

if (!token) window.location.replace('login.html');

function showToast(message, error = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle('error', error);
  toastEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 3800);
}

async function adminFetch(path, options = {}) {
  try {
    return await apiFetch(path, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    if (/session expired|sign in/i.test(error.message)) {
      localStorage.removeItem('aurelux_token');
      window.location.replace('login.html');
    }
    throw error;
  }
}

function activateTab(id) {
  tabs.forEach(tab => {
    const active = tab.dataset.tab === id;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  panels.forEach(panel => panel.classList.toggle('active', panel.id === id));
  if (id === 'orders') loadOrders();
  if (id === 'inventory') loadWatches();
}

function updateOverview() {
  document.getElementById('watchStat').textContent = String(watches.length);
  document.getElementById('stockStat').textContent = String(watches.reduce((total, watch) => total + (Number(watch.stock) || 0), 0));
  document.getElementById('orderStat').textContent = String(orders.filter(order => !['Delivered', 'Cancelled'].includes(order.status)).length);
}

function watchCard(watch) {
  const image = watch.photos?.[0] ? imageUrl(watch.photos[0]) : '';
  return `
    <article class="watch-card">
      <div class="watch-card-image">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(watch.name)}" loading="lazy">` : '<span class="admin-mark" aria-hidden="true">A</span>'}</div>
      <div class="watch-card-info">
        <p class="product-category">${escapeHtml(watch.category || 'General')}</p>
        <h3>${escapeHtml(watch.name)}</h3>
        <p class="watch-card-price">${formatPrice(watch.price)}</p>
        <p class="watch-card-meta">${Number(watch.stock)} available · ${(watch.photos || []).length} ${(watch.photos || []).length === 1 ? 'image' : 'images'}</p>
        <div class="watch-card-actions">
          <button type="button" data-edit-watch="${escapeHtml(watch.id)}">Edit</button>
          <button class="delete-watch" type="button" data-delete-watch="${escapeHtml(watch.id)}">Remove</button>
        </div>
      </div>
    </article>`;
}

function renderWatches() {
  const query = document.getElementById('inventorySearch').value.trim().toLocaleLowerCase();
  const filtered = watches.filter(watch => `${watch.name} ${watch.category || ''}`.toLocaleLowerCase().includes(query));
  document.getElementById('inventoryCount').textContent = `${filtered.length} ${filtered.length === 1 ? 'timepiece' : 'timepieces'} in the collection`;
  watchGrid.innerHTML = filtered.length
    ? filtered.map(watchCard).join('')
    : '<p class="admin-empty">No timepieces match that search. Try another name or collection.</p>';
}

async function loadWatches() {
  watchGrid.innerHTML = '<p class="admin-loading">Preparing the collection…</p>';
  try {
    const result = await apiFetch('/api/watches');
    if (!Array.isArray(result)) throw new Error('The collection response is invalid.');
    watches = result;
    const categories = [...new Set(watches.map(watch => watch.category).filter(Boolean))];
    document.getElementById('categoryOptions').innerHTML = ["Men's", "Women's", 'Luxury', 'Sport', ...categories]
      .filter((name, index, list) => list.indexOf(name) === index)
      .map(name => `<option value="${escapeHtml(name)}">`).join('');
    renderWatches();
    updateOverview();
  } catch (error) {
    watchGrid.innerHTML = `<p class="admin-empty">${escapeHtml(error.message)} <button class="quiet-button" type="button" data-retry-watches>Try again</button></p>`;
  }
}

function renderOrders() {
  if (!orders.length) {
    orderBody.innerHTML = '<tr><td colspan="6" class="admin-empty">No orders yet. New client orders will appear here.</td></tr>';
    updateOverview();
    return;
  }
  orderBody.innerHTML = orders.map(order => {
    const details = (order.items || []).map(item => `${item.watchName} × ${item.quantity}`).join(', ')
      || `${order.watchName || 'Timepiece'} × ${order.quantity || 1}`;
    const selectedStatus = orderStatuses.includes(order.status) ? order.status : 'Pending';
    const options = orderStatuses.map(status => `<option value="${status}" ${status === selectedStatus ? 'selected' : ''}>${status}</option>`).join('');
    return `<tr>
      <td><strong>${escapeHtml(order.id)}</strong><small>${escapeHtml(order.paymentMethod || 'COD')}</small></td>
      <td><strong>${escapeHtml(order.customerName)}</strong><small>${escapeHtml(order.phone)}</small></td>
      <td><strong>${escapeHtml(details)}</strong><small>${escapeHtml(order.address)}</small></td>
      <td>${formatPrice(order.totalPrice)}</td>
      <td>${escapeHtml(new Date(order.date).toLocaleDateString())}</td>
      <td><label class="sr-only" for="status-${escapeHtml(order.id)}">Order status for ${escapeHtml(order.id)}</label><select class="order-status" id="status-${escapeHtml(order.id)}" data-order-status="${escapeHtml(order.id)}">${options}</select></td>
    </tr>`;
  }).join('');
  updateOverview();
}

async function loadOrders() {
  orderBody.innerHTML = '<tr><td colspan="6" class="admin-loading">Loading client orders…</td></tr>';
  try {
    const result = await adminFetch('/api/admin/orders');
    if (!Array.isArray(result)) throw new Error('The order ledger response is invalid.');
    orders = result;
    renderOrders();
  } catch (error) {
    orderBody.innerHTML = `<tr><td colspan="6" class="admin-empty">${escapeHtml(error.message)}</td></tr>`;
  }
}

function resetForm() {
  form.reset();
  document.getElementById('watchId').value = '';
  document.getElementById('wStock').value = '1';
  document.getElementById('submitWatch').innerHTML = 'Add to the collection <span aria-hidden="true">→</span>';
  document.getElementById('formTitle').innerHTML = 'Introduce a <em>new timepiece.</em>';
  document.getElementById('cancelEdit').hidden = true;
  preview.replaceChildren();
}

function startEditing(watch) {
  activateTab('productForm');
  document.getElementById('watchId').value = watch.id;
  document.getElementById('wName').value = watch.name;
  document.getElementById('wPrice').value = watch.price;
  document.getElementById('wCategory').value = watch.category || '';
  document.getElementById('wStock').value = watch.stock;
  document.getElementById('wDescription').value = watch.description || '';
  document.getElementById('formTitle').innerHTML = 'Refine this <em>timepiece.</em>';
  document.getElementById('submitWatch').innerHTML = 'Save changes <span aria-hidden="true">→</span>';
  document.getElementById('cancelEdit').hidden = false;
  preview.innerHTML = (watch.photos || []).map(photo => `<figure><img src="${escapeHtml(imageUrl(photo))}" alt=""><figcaption>Current image</figcaption></figure>`).join('');
  document.getElementById('wName').focus();
}

function readPreview(file, index) {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const figure = document.createElement('figure');
    const image = document.createElement('img');
    const caption = document.createElement('figcaption');
    image.src = String(reader.result);
    image.alt = '';
    caption.textContent = `New image ${index + 1}`;
    figure.append(image, caption);
    preview.append(figure);
  });
  reader.readAsDataURL(file);
}

document.querySelector('.admin-tabs').addEventListener('click', event => {
  const tab = event.target.closest('[data-tab]');
  if (tab) activateTab(tab.dataset.tab);
});

document.querySelector('[data-open-form]').addEventListener('click', () => {
  resetForm();
  activateTab('productForm');
  document.getElementById('wName').focus();
});

document.getElementById('cancelEdit').addEventListener('click', resetForm);
document.getElementById('inventorySearch').addEventListener('input', renderWatches);
document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('en', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date());
document.getElementById('logoutButton').addEventListener('click', () => {
  localStorage.removeItem('aurelux_token');
  window.location.replace('login.html');
});

document.getElementById('wPhotos').addEventListener('change', event => {
  const files = [...event.target.files];
  if (files.length > 5) {
    event.target.value = '';
    preview.replaceChildren();
    showToast('Choose no more than five images.', true);
    return;
  }
  const invalid = files.find(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024);
  if (invalid) {
    event.target.value = '';
    preview.replaceChildren();
    showToast('Use JPG, PNG or WebP images no larger than 5 MB each.', true);
    return;
  }
  preview.replaceChildren();
  files.forEach(readPreview);
});

watchGrid.addEventListener('click', async event => {
  const retry = event.target.closest('[data-retry-watches]');
  if (retry) return loadWatches();
  const edit = event.target.closest('[data-edit-watch]');
  if (edit) {
    const watch = watches.find(item => String(item.id) === edit.dataset.editWatch);
    if (watch) startEditing(watch);
    return;
  }
  const remove = event.target.closest('[data-delete-watch]');
  if (!remove) return;
  const watch = watches.find(item => String(item.id) === remove.dataset.deleteWatch);
  if (!watch || !window.confirm(`Remove "${watch.name}" from the collection?`)) return;
  try {
    await adminFetch(`/api/admin/watches/${encodeURIComponent(watch.id)}`, { method: 'DELETE' });
    showToast('The timepiece has been removed from the collection.');
    await loadWatches();
  } catch (error) {
    showToast(error.message, true);
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const id = document.getElementById('watchId').value;
  const files = [...document.getElementById('wPhotos').files];
  const body = new FormData(form);
  body.delete('photos');
  files.forEach(file => body.append('photos', file));
  const button = document.getElementById('submitWatch');
  button.disabled = true;
  try {
    const result = await adminFetch(id ? `/api/admin/watches/${encodeURIComponent(id)}` : '/api/admin/watches', {
      method: id ? 'PUT' : 'POST',
      body,
    });
    showToast(id ? 'Timepiece details have been updated.' : `${result.watch.name} has been added to the collection.`);
    resetForm();
    activateTab('inventory');
    loadOrders();
    await loadWatches();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
});

orderBody.addEventListener('change', async event => {
  const select = event.target.closest('[data-order-status]');
  if (!select) return;
  select.disabled = true;
  try {
    await adminFetch(`/api/admin/orders/${encodeURIComponent(select.dataset.orderStatus)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: select.value }),
    });
    showToast('Order progress updated.');
    await Promise.all([loadOrders(), loadWatches()]);
  } catch (error) {
    showToast(error.message, true);
    await loadOrders();
  } finally {
    select.disabled = false;
  }
});

document.getElementById('exportOrders').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/api/admin/orders/export`, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 401) {
      localStorage.removeItem('aurelux_token');
      window.location.replace('login.html');
      return;
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Could not download the order ledger.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'AURELUX_Orders.csv';
    link.click();
    URL.revokeObjectURL(url);
    showToast('Your Excel-ready order ledger has been downloaded.');
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
});

activateTab('inventory');
