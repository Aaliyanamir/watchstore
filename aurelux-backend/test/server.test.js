const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'aurelux-store-test-'));
process.env.DB_FILE = path.join(temporaryDirectory, 'db.json');
process.env.UPLOAD_DIR = path.join(temporaryDirectory, 'uploads');
process.env.ADMIN_USERNAME = 'atelier-test';
process.env.ADMIN_PASSWORD = 'a-test-password-longer-than-twelve';
process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';

fs.writeFileSync(process.env.DB_FILE, JSON.stringify({
  watches: [{ id: 'watch-1', name: 'Midnight Automatic', price: 1250, description: '', category: 'Luxury', stock: 5, photos: [] }],
  orders: [],
}));

const { app, assertProductionConfig } = require('../server');
let server;
let baseUrl;
let token;

async function request(pathname, options = {}) {
  return fetch(`${baseUrl}${pathname}`, options);
}

async function readJson(response) {
  return response.json();
}

before(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const response = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }),
  });
  assert.equal(response.status, 200);
  token = (await readJson(response)).token;
});

after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('admin configuration requires strong credentials and signing secret', () => {
  assert.doesNotThrow(assertProductionConfig);
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'short';
  assert.throws(assertProductionConfig, /32 characters/);
  process.env.JWT_SECRET = secret;
});

test('admin routes reject missing authorization and tokens in the query string', async () => {
  const orders = await request('/api/admin/orders');
  assert.equal(orders.status, 401);
  const exported = await request(`/api/admin/orders/export?token=${token}`);
  assert.equal(exported.status, 401);
});

test('orders use catalogue prices, reserve stock once, and are idempotent', async () => {
  const body = {
    customerName: '=2+2',
    phone: '+94 77 123 4567',
    address: '14 Rue des Granges, Genève',
    items: [{ watchId: 'watch-1', quantity: 2, unitPrice: 1, totalPrice: 1, watchName: 'Forged name' }],
  };
  const headers = { 'Content-Type': 'application/json', 'Idempotency-Key': 'order-test-001' };
  const created = await request('/api/orders', { method: 'POST', headers, body: JSON.stringify(body) });
  assert.equal(created.status, 201);
  const order = (await readJson(created)).order;
  assert.equal(order.totalPrice, 2500);
  assert.equal(order.items[0].watchName, 'Midnight Automatic');
  assert.equal(order.items[0].unitPrice, 1250);

  const duplicate = await request('/api/orders', { method: 'POST', headers, body: JSON.stringify(body) });
  assert.equal(duplicate.status, 200);
  assert.equal((await readJson(duplicate)).order.id, order.id);
  const watch = await request('/api/watches/watch-1');
  assert.equal((await readJson(watch)).stock, 3);
});

test('orders reject invalid quantities and unavailable stock without changing inventory', async () => {
  const headers = { 'Content-Type': 'application/json' };
  const payload = (watchId, quantity) => JSON.stringify({
    customerName: 'A. Client',
    phone: '+94 77 123 4567',
    address: '14 Rue des Granges, Genève',
    items: [{ watchId, quantity }],
  });
  const decimal = await request('/api/orders', { method: 'POST', headers, body: payload('watch-1', 1.5) });
  assert.equal(decimal.status, 400);
  const unknown = await request('/api/orders', { method: 'POST', headers, body: payload('missing', 1) });
  assert.equal(unknown.status, 404);
  const oversell = await request('/api/orders', { method: 'POST', headers, body: payload('watch-1', 4) });
  assert.equal(oversell.status, 409);
  const watch = await request('/api/watches/watch-1');
  assert.equal((await readJson(watch)).stock, 3);
});

test('order cancellation restocks exactly once and reopening reserves stock again', async () => {
  const authorized = { Authorization: `Bearer ${token}` };
  const orders = await request('/api/admin/orders', { headers: authorized });
  const [order] = await readJson(orders);
  const cancel = () => request(`/api/admin/orders/${order.id}`, {
    method: 'PATCH',
    headers: { ...authorized, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Cancelled' }),
  });
  assert.equal((await cancel()).status, 200);
  assert.equal((await cancel()).status, 200);
  let watch = await request('/api/watches/watch-1');
  assert.equal((await readJson(watch)).stock, 5);
  const reopen = await request(`/api/admin/orders/${order.id}`, {
    method: 'PATCH',
    headers: { ...authorized, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Confirmed' }),
  });
  assert.equal(reopen.status, 200);
  watch = await request('/api/watches/watch-1');
  assert.equal((await readJson(watch)).stock, 3);
});

test('CSV export requires a bearer token and protects spreadsheet formulas', async () => {
  const response = await request('/api/admin/orders/export', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/csv/);
  const csv = await response.text();
  assert.match(csv, /'=2\+2/);
  assert.match(csv, /Midnight Automatic x 2/);
});

test('admin can add zero-stock watches and explicitly set existing stock to zero', async () => {
  const headers = { Authorization: `Bearer ${token}` };
  const create = new FormData();
  create.set('name', 'Reserve Reference');
  create.set('price', '85000');
  create.set('stock', '0');
  const created = await request('/api/admin/watches', { method: 'POST', headers, body: create });
  assert.equal(created.status, 201);
  const watch = (await readJson(created)).watch;
  assert.equal(watch.stock, 0);

  const update = new FormData();
  update.set('stock', '0');
  const updated = await request(`/api/admin/watches/${watch.id}`, { method: 'PUT', headers, body: update });
  assert.equal(updated.status, 200);
  assert.equal((await readJson(updated)).watch.stock, 0);
});

test('upload checks both declared type and file signature', async () => {
  const form = new FormData();
  form.set('name', 'Invalid Image Watch');
  form.set('price', '1000');
  form.set('stock', '1');
  form.append('photos', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
  const response = await request('/api/admin/watches', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(response.status, 400);
  assert.deepEqual(fs.readdirSync(process.env.UPLOAD_DIR), []);
});
