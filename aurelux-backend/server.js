require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const dbFile = path.resolve(process.env.DB_FILE || path.join(__dirname, 'data', 'db.json'));
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'));
const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://127.0.0.1:5190,http://localhost:5190')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

fs.mkdirSync(path.dirname(dbFile), { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const adapter = new FileSync(dbFile);
const db = low(adapter);
db.defaults({ watches: [], orders: [] }).write();

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
}));
app.use(express.json({ limit: '100kb' }));
app.use('/uploads', express.static(uploadDir, { dotfiles: 'deny', index: false, maxAge: '7d' }));

const allowedImageTypes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 12, fieldSize: 10 * 1024 },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedImageTypes.get(extension) !== file.mimetype) {
      return callback(new Error('Upload a JPG, PNG, or WebP image.'));
    }
    callback(null, true);
  },
});

function cleanupUploads(files = []) {
  for (const file of files) {
    if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
  }
}

function verifyImageContent(files = []) {
  for (const file of files) {
    const buffer = Buffer.alloc(12);
    const descriptor = fs.openSync(file.path, 'r');
    let bytesRead;
    try {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
    } finally {
      fs.closeSync(descriptor);
    }
    const header = buffer.subarray(0, bytesRead);
    const valid = file.mimetype === 'image/jpeg'
      ? header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
      : file.mimetype === 'image/png'
        ? header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : file.mimetype === 'image/webp'
          ? header.length >= 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP'
          : false;
    if (!valid) throw new Error('The uploaded file is not a valid JPG, PNG, or WebP image.');
  }
}

function withPhotos(req, res, next) {
  upload.array('photos', 5)(req, res, error => {
    if (error) {
      cleanupUploads(req.files);
      return next(error);
    }
    try {
      verifyImageContent(req.files);
      next();
    } catch (validationError) {
      cleanupUploads(req.files);
      next(validationError);
    }
  });
}

function validateToken(req, res, next) {
  const [scheme, token, ...extra] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token || extra.length || !process.env.JWT_SECRET) {
    return res.status(401).json({ error: 'Please sign in to continue.' });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    res.status(401).json({ error: 'Your session expired. Please sign in again.' });
  }
}

const loginAttempts = new Map();
function limitLoginAttempts(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const current = loginAttempts.get(key);
  if (!current || now - current.startedAt > 15 * 60 * 1000) {
    loginAttempts.set(key, { startedAt: now, count: 0 });
  }
  const attempts = loginAttempts.get(key);
  if (attempts.count >= 10) {
    return res.status(429).json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' });
  }
  attempts.count += 1;
  next();
}

function validPrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 && price <= 100_000_000;
}

function validStock(value) {
  return Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 1_000_000;
}

function normalizeWatchFields(body, partial = false) {
  const updates = {};
  if (!partial || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 120) return { error: 'Watch name is required and must be 120 characters or fewer.' };
    updates.name = name;
  }
  if (!partial || body.price !== undefined) {
    if (!validPrice(body.price)) return { error: 'Enter a valid price greater than zero.' };
    updates.price = Number(Number(body.price).toFixed(2));
  }
  if (!partial || body.description !== undefined) {
    if (body.description !== undefined && typeof body.description !== 'string') return { error: 'Description must be text.' };
    if ((body.description || '').length > 5000) return { error: 'Description must be 5,000 characters or fewer.' };
    updates.description = body.description || '';
  }
  if (!partial || body.category !== undefined) {
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    if (category.length > 60) return { error: 'Category must be 60 characters or fewer.' };
    updates.category = category || 'General';
  }
  if (!partial || body.stock !== undefined) {
    if (body.stock === '' && partial) return { error: 'Enter a valid stock quantity.' };
    const stock = body.stock === undefined && !partial ? 1 : body.stock;
    if (!validStock(stock)) return { error: 'Stock must be a whole number from 0 to 1,000,000.' };
    updates.stock = Number(stock);
  }
  return { updates };
}

function cleanString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function getOrderItems(order) {
  return order.items || (order.watchId ? [{
    watchId: String(order.watchId),
    watchName: order.watchName || 'Timepiece',
    quantity: order.quantity || 1,
  }] : []);
}

app.post('/api/admin/login', limitLoginAttempts, (req, res) => {
  const username = cleanString(req.body?.username, 120);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
    return res.status(503).json({ error: 'Admin sign-in is not configured on this server.' });
  }
  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }
  loginAttempts.delete(req.ip);
  const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '8h', algorithm: 'HS256' });
  res.json({ success: true, token });
});

app.get('/api/watches', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(db.get('watches').value());
});

app.get('/api/watches/:id', (req, res) => {
  const watch = db.get('watches').find({ id: req.params.id }).value();
  if (!watch) return res.status(404).json({ error: 'Watch not found.' });
  res.json(watch);
});

app.post('/api/admin/watches', validateToken, withPhotos, (req, res) => {
  const { updates, error } = normalizeWatchFields(req.body);
  if (error) {
    cleanupUploads(req.files);
    return res.status(400).json({ error });
  }
  const watch = {
    id: crypto.randomUUID(),
    ...updates,
    photos: (req.files || []).map(file => `/uploads/${path.basename(file.filename)}`),
    dateAdded: new Date().toISOString(),
  };
  db.get('watches').push(watch).write();
  res.status(201).json({ success: true, watch });
});

app.put('/api/admin/watches/:id', validateToken, withPhotos, (req, res) => {
  const record = db.get('watches').find({ id: req.params.id });
  const watch = record.value();
  if (!watch) {
    cleanupUploads(req.files);
    return res.status(404).json({ error: 'Watch not found.' });
  }
  const { updates, error } = normalizeWatchFields(req.body, true);
  if (error) {
    cleanupUploads(req.files);
    return res.status(400).json({ error });
  }
  if (req.files?.length) {
    updates.photos = req.files.map(file => `/uploads/${path.basename(file.filename)}`);
  }
  record.assign(updates).write();
  res.json({ success: true, watch: record.value() });
});

app.delete('/api/admin/watches/:id', validateToken, (req, res) => {
  const watch = db.get('watches').find({ id: req.params.id }).value();
  if (!watch) return res.status(404).json({ error: 'Watch not found.' });
  for (const photo of watch.photos || []) {
    const filename = path.basename(String(photo));
    const file = path.resolve(uploadDir, filename);
    if (file.startsWith(`${uploadDir}${path.sep}`) && fs.existsSync(file)) fs.unlinkSync(file);
  }
  db.get('watches').remove({ id: req.params.id }).write();
  res.json({ success: true });
});

app.post('/api/orders', (req, res) => {
  const idempotencyKey = req.get('Idempotency-Key');
  if (idempotencyKey && (idempotencyKey.length > 100 || !/^[\w.-]+$/.test(idempotencyKey))) {
    return res.status(400).json({ error: 'Invalid order request key.' });
  }
  if (idempotencyKey) {
    const existing = db.get('orders').find({ idempotencyKey }).value();
    if (existing) return res.status(200).json({ success: true, order: existing, duplicate: true });
  }

  const customerName = cleanString(req.body?.customerName, 100);
  const phone = cleanString(req.body?.phone, 30);
  const address = cleanString(req.body?.address, 500);
  const paymentMethod = req.body?.paymentMethod || 'COD';
  const items = req.body?.items;
  const digitCount = phone.replace(/\D/g, '').length;

  if (customerName.length < 2 || address.length < 8 || !/^[+\d][\d\s().-]*$/.test(phone) || digitCount < 7 || digitCount > 15) {
    return res.status(400).json({ error: 'Enter a name, valid phone number, and complete delivery address.' });
  }
  if (paymentMethod !== 'COD') return res.status(400).json({ error: 'Cash on delivery is the only available payment method.' });
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    return res.status(400).json({ error: 'Your cart must contain between 1 and 20 items.' });
  }

  const quantities = new Map();
  for (const item of items) {
    const watchId = typeof item?.watchId === 'string' ? item.watchId : '';
    const quantity = Number(item?.quantity);
    if (!watchId || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      return res.status(400).json({ error: 'Each item must have a valid watch and quantity (1–50).' });
    }
    quantities.set(watchId, (quantities.get(watchId) || 0) + quantity);
  }
  for (const quantity of quantities.values()) {
    if (quantity > 50) return res.status(400).json({ error: 'A maximum of 50 units may be ordered per watch.' });
  }

  const watches = db.get('watches').value();
  const orderItems = [];
  for (const [watchId, quantity] of quantities) {
    const watch = watches.find(item => String(item.id) === watchId);
    if (!watch) return res.status(404).json({ error: 'A watch in your cart is no longer available. Please refresh your cart.' });
    if (watch.stock < quantity) {
      return res.status(409).json({ error: `${watch.name} has only ${watch.stock} unit(s) available. Please update your cart.` });
    }
    orderItems.push({
      watchId: String(watch.id),
      watchName: watch.name,
      quantity,
      unitPrice: watch.price,
      totalPrice: Number((watch.price * quantity).toFixed(2)),
    });
  }

  const newOrder = {
    id: `ORD-${crypto.randomUUID()}`,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    customerName,
    phone,
    address,
    items: orderItems,
    quantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
    totalPrice: Number(orderItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)),
    paymentMethod,
    status: 'Pending',
    date: new Date().toISOString(),
  };

  for (const item of orderItems) {
    const watch = watches.find(entry => String(entry.id) === item.watchId);
    watch.stock -= item.quantity;
  }
  db.get('orders').value().push(newOrder);
  db.write();
  res.status(201).json({ success: true, order: newOrder });
});

app.get('/api/admin/orders', validateToken, (_req, res) => {
  res.json(db.get('orders').value());
});

app.patch('/api/admin/orders/:id', validateToken, (req, res) => {
  const status = req.body?.status;
  if (!['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Choose a valid order status.' });
  }
  const order = db.get('orders').find({ id: req.params.id });
  const currentOrder = order.value();
  if (!currentOrder) return res.status(404).json({ error: 'Order not found.' });
  const watches = db.get('watches').value();
  if (currentOrder.status !== 'Cancelled' && status === 'Cancelled') {
    for (const item of getOrderItems(currentOrder)) {
      const watch = watches.find(entry => String(entry.id) === String(item.watchId));
      if (watch) watch.stock += item.quantity;
    }
    db.write();
  } else if (currentOrder.status === 'Cancelled' && status !== 'Cancelled') {
    for (const item of getOrderItems(currentOrder)) {
      const watch = watches.find(entry => String(entry.id) === String(item.watchId));
      if (!watch || watch.stock < item.quantity) {
        return res.status(409).json({ error: `${item.watchName} no longer has enough stock to reopen this order.` });
      }
    }
    for (const item of getOrderItems(currentOrder)) {
      const watch = watches.find(entry => String(entry.id) === String(item.watchId));
      watch.stock -= item.quantity;
    }
    db.write();
  }
  order.assign({ status }).write();
  res.json({ success: true, order: order.value() });
});

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

app.get('/api/admin/orders/export', validateToken, (req, res) => {
  const headers = ['Order ID', 'Customer Name', 'Phone', 'Address', 'Items', 'Quantity', 'Total Price', 'Payment Method', 'Status', 'Date'];
  const rows = db.get('orders').value().map(order => {
    const items = getOrderItems(order).map(item => `${item.watchName} x ${item.quantity}`).join('; ');
    return [
      order.id, order.customerName, order.phone, order.address, items,
      order.quantity, order.totalPrice, order.paymentMethod, order.status, order.date,
    ];
  });
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="AURELUX_Orders.csv"',
    'Cache-Control': 'no-store',
  });
  res.send(`\uFEFF${csv}`);
});

app.use((error, req, res, _next) => {
  cleanupUploads(req.files);
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_FILE_COUNT' ? 400 : 400;
    return res.status(status).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5 MB or smaller.' : 'Invalid upload. Use up to five JPG, PNG, or WebP images.' });
  }
  if (error.message === 'Origin is not allowed') return res.status(403).json({ error: error.message });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  if (error.status === 400 && error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON request.' });
  if (error.message?.startsWith('Upload a ') || error.message?.startsWith('The uploaded file')) {
    return res.status(400).json({ error: error.message });
  }
  console.error(error);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

function assertProductionConfig() {
  const missing = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'JWT_SECRET'].filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Missing required backend configuration: ${missing.join(', ')}`);
  if ([process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD, process.env.JWT_SECRET].some(value => /^(change|replace|your)[-_]/i.test(value))) {
    throw new Error('Replace the example admin credentials and JWT secret before starting the server.');
  }
  if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters long.');
  if (process.env.ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters long.');
}

if (require.main === module) {
  try {
    assertProductionConfig();
    app.listen(PORT, () => console.log(`AURELUX API listening on port ${PORT}`));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { app, assertProductionConfig };
