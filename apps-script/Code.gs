/**
 * DRSP Orders — Google Apps Script backend
 * ------------------------------------------------------------
 * Paste this whole file into Extensions > Apps Script of your
 * master Google Sheet. Then:
 *   1. Choose the family login below (APP_USERNAME / APP_PASSWORD).
 *   2. Run the `setup` function once (approve the permissions).
 *   3. Deploy > New deployment > Web app
 *        Execute as: Me    |    Who has access: Anyone
 *   4. Copy the Web app URL into public/config.json ("apiUrl").
 *
 * No Google Cloud project is needed. Everyone in the family uses the
 * same username + password. Security is checked here, on Google's side:
 *   - Wrong passwords are counted; after 8 misses login pauses 15 min.
 *   - Changing the password in the app signs out every phone.
 *   - Forgot the password? Edit APP_PASSWORD below, Save, and run
 *     `resetPassword` once. Then log in with the new one.
 */

const APP_USERNAME = 'drsp';
const APP_PASSWORD = 'change-this-password';
const SESSION_DAYS = 90;

const SHEETS = {
  Orders: ['Order_ID', 'Date', 'Customer_Name', 'Customer_Phone', 'Product_Code', 'Product_Name', 'QTY', 'MRP',
    'Discount', 'Sold_Amount', 'Lead_By', 'Prep_Status', 'Payment_Status', 'Delivery_Status',
    'Delivery_Charge', 'Address', 'Notes', 'Due_Date', 'Updated_At', 'Delivered_At', 'Feedback_Sent'],
  Products_Master: ['Product_Code', 'Product_Name', 'MRP', 'Category', 'Active_Status'],
  Expenses: ['Expense_ID', 'Date', 'Category', 'Item_Name', 'Amount', 'Remarks', 'Lead_By'],
  Customers: ['Customer_Phone', 'Customer_Name', 'Total_Orders', 'Total_Spent', 'Last_Order_Date',
    'Favorite_Product', 'Customer_Tier', 'Address'],
  Templates: ['Key', 'Name', 'Type', 'Text'],
};

// Columns stored as plain text so Sheets never turns them into dates/numbers.
const TEXT_COLS = {
  Orders: ['Order_ID', 'Date', 'Customer_Phone', 'Product_Code', 'Due_Date', 'Updated_At', 'Delivered_At'],
  Products_Master: ['Product_Code'],
  Expenses: ['Expense_ID', 'Date'],
  Customers: ['Customer_Phone', 'Last_Order_Date'],
  Templates: ['Key', 'Text'],
};

const SEED_PRODUCTS = [
  ['MNG-250', 'Mango - 250gm', 249, 'Veg Pickle', 'Active'],
  ['MNG-500', 'Mango - 500gm', 449, 'Veg Pickle', 'Active'],
  ['MNG-1000', 'Mango - 1000gm', 799, 'Veg Pickle', 'Active'],
  ['CHK-BL-250', 'Chicken Boneless - 250gm', 399, 'Non-Veg Pickle', 'Active'],
  ['CHK-BL-500', 'Chicken Boneless - 500gm', 749, 'Non-Veg Pickle', 'Active'],
  ['CHK-BL-1000', 'Chicken Boneless - 1000gm', 1399, 'Non-Veg Pickle', 'Active'],
  ['PRW-100', 'Prawns - 100gm', 200, 'Non-Veg Pickle', 'Active'],
  ['PRW-250', 'Prawns - 250gm', 499, 'Non-Veg Pickle', 'Active'],
  ['PRW-500', 'Prawns - 500gm', 899, 'Non-Veg Pickle', 'Active'],
  ['FSH-250', 'Fish - 250gm', 399, 'Non-Veg Pickle', 'Active'],
  ['FSH-500', 'Fish - 500gm', 749, 'Non-Veg Pickle', 'Active'],
  ['CMB-CHK-PRW-250', 'Chicken + Prawns 250g', 849, 'Combo Pack', 'Active'],
  ['MTN-BL-100', 'Mutton Boneless - 100gm', 349, 'Non-Veg Pickle', 'Active'],
  ['PWD-CHK-100', 'Powder - Chicken - 100g', 100, 'Spices / Powders', 'Active'],
];

const PREP = ['Pending', 'In Batch', 'Packed'];
const PAY = ['Unpaid', 'UPI', 'Cash'];
// 'Shipped' is the old name for 'Out for Delivery' and is still accepted.
const DELIVERY = ['Pending', 'Out for Delivery', 'Delivered', 'Shipped'];
const TEMPLATE_TYPES = ['customer', 'order'];
const MAX_FAILS = 8;
// Files uploaded from the app (More → Menu & payment files). Kept in a Drive folder you own.
const FILE_KINDS = ['menu_image', 'menu_pdf', 'upi_qr'];
const MAX_FILE_MB = 10;
const LOCK_MINUTES = 15;

/* ---------------------------------------------------------------- setup */

function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    const existing = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    if (existing.join('') === '') {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      // add any missing columns at the end, never reorder the user's data
      headers.forEach(function (h) {
        if (existing.indexOf(h) === -1) {
          sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
          existing.push(h);
        }
      });
    }
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    const hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    (TEXT_COLS[name] || []).forEach(function (col) {
      const i = hdr.indexOf(col);
      if (i > -1) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
    });
  });

  const products = ss.getSheetByName('Products_Master');
  if (products.getLastRow() < 2) {
    products.getRange(2, 1, SEED_PRODUCTS.length, 5).setValues(SEED_PRODUCTS);
  }

  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  filesFolder_(); // creates the Drive folder for menu / QR files (asks for Drive permission)
  rebuildCustomers_();
  Logger.log('DRSP Orders setup complete. Login: ' + APP_USERNAME + ' / (your APP_PASSWORD). Message templates are added by the app the first time you edit one.');
}

/* --------------------------------------------------------------- routing */

function doGet() {
  return json_({ ok: true, app: 'DRSP Orders API', time: new Date().toISOString() });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'BAD_REQUEST' });
  }
  try {
    if (req.action === 'login') return json_({ ok: true, data: login_(req.username, req.password) });

    const user = auth_(req.session);
    if (req.action === 'logout') {
      PropertiesService.getScriptProperties().deleteProperty('S_' + req.session);
      return json_({ ok: true });
    }
    if (req.action === 'sync') return json_({ ok: true, data: snapshot_(user) });
    if (req.action === 'changePassword') return json_({ ok: true, data: changePassword_(req, user) });
    if (req.action === 'getFile') return json_({ ok: true, data: getFile_(req) });
    if (req.action === 'uploadFile') return json_({ ok: true, data: uploadFile_(req) });
    if (req.action === 'deleteFile') return json_({ ok: true, data: deleteFile_(req) });

    if (!ACTIONS[req.action]) return json_({ ok: false, error: 'UNKNOWN_ACTION' });

    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      const result = ACTIONS[req.action](req, user);
      return json_({ ok: true, data: result });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    const msg = String(err && err.message || err);
    return json_({ ok: false, error: msg });
  }
}

const ACTIONS = {
  addOrder: addOrder_,
  updateOrder: updateOrder_,
  deleteOrder: deleteOrder_,
  addExpense: addExpense_,
  deleteExpense: deleteExpense_,
  updatePrices: updatePrices_,
  saveProduct: saveProduct_,
  saveTemplate: saveTemplate_,
  deleteTemplate: deleteTemplate_,
};

/* ------------------------------------------------------------------ auth */

function hash_(salt, text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + text, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

/** The current login: the one changed in the app, or else the one at the top of this file. */
function credentials_() {
  const p = PropertiesService.getScriptProperties();
  const raw = p.getProperty('LOGIN');
  if (raw) return JSON.parse(raw);
  return { username: APP_USERNAME, salt: '', hash: '', plain: APP_PASSWORD };
}

function checkPassword_(cred, password) {
  return cred.hash ? hash_(cred.salt, password) === cred.hash : String(password) === String(cred.plain);
}

function login_(username, password) {
  const props = PropertiesService.getScriptProperties();
  const now = Date.now();
  const fails = JSON.parse(props.getProperty('FAILS') || '{"n":0,"until":0}');
  if (fails.until > now) throw new Error('LOCKED');

  const cred = credentials_();
  const okUser = String(username || '').trim().toLowerCase() === String(cred.username).trim().toLowerCase();
  if (!okUser || !checkPassword_(cred, password)) {
    fails.n = (fails.n || 0) + 1;
    if (fails.n >= MAX_FAILS) { fails.n = 0; fails.until = now + LOCK_MINUTES * 60000; }
    props.setProperty('FAILS', JSON.stringify(fails));
    throw new Error(fails.until > now ? 'LOCKED' : 'WRONG_LOGIN');
  }
  props.deleteProperty('FAILS');

  // clean up expired sessions
  const all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('S_') === 0) {
      try { if (JSON.parse(all[k]).exp < now) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
    }
  });

  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  props.setProperty('S_' + token, JSON.stringify({ exp: now + SESSION_DAYS * 864e5 }));
  return { session: token, user: { username: cred.username } };
}

function auth_(session) {
  if (!session) throw new Error('NO_SESSION');
  const raw = PropertiesService.getScriptProperties().getProperty('S_' + session);
  if (!raw) throw new Error('SESSION_EXPIRED');
  const s = JSON.parse(raw);
  if (s.exp < Date.now()) throw new Error('SESSION_EXPIRED');
  return { username: credentials_().username };
}

/** Change username/password from the app. Every other phone is signed out. */
function changePassword_(req, user) {
  const cred = credentials_();
  if (!checkPassword_(cred, req.currentPassword)) throw new Error('WRONG_PASSWORD');
  const pw = String(req.newPassword || '');
  if (pw.length < 6) throw new Error('PASSWORD_TOO_SHORT');
  const username = String(req.newUsername || cred.username).trim() || cred.username;
  const salt = Utilities.getUuid();
  const props = PropertiesService.getScriptProperties();
  props.setProperty('LOGIN', JSON.stringify({ username: username, salt: salt, hash: hash_(salt, pw) }));
  const all = props.getProperties();
  Object.keys(all).forEach(function (k) { if (k.indexOf('S_') === 0 && k !== 'S_' + req.session) props.deleteProperty(k); });
  return { username: username };
}

/** Run by hand from the Apps Script editor if the password is forgotten. */
function resetPassword() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('LOGIN');
  props.deleteProperty('FAILS');
  const all = props.getProperties();
  Object.keys(all).forEach(function (k) { if (k.indexOf('S_') === 0) props.deleteProperty(k); });
  Logger.log('Password reset. Log in with ' + APP_USERNAME + ' and the APP_PASSWORD at the top of this file.');
}

/* ------------------------------------------------------------------ data */

function snapshot_(user) {
  return {
    user: user,
    products: readRows_('Products_Master'),
    orders: readRows_('Orders'),
    expenses: readRows_('Expenses'),
    customers: readRows_('Customers'),
    templates: readRows_('Templates'),
    files: filesMeta_(),
    serverTime: new Date().toISOString(),
  };
}

function addOrder_(req) {
  const o = req.order;
  if (!o || !o.orderId || !o.items || !o.items.length) throw new Error('INVALID_ORDER');
  if (!/^[6-9]\d{9}$/.test(String(o.phone))) throw new Error('INVALID_PHONE');
  const sh = sheet_('Orders');
  if (columnValues_(sh, 'Order_ID').indexOf(o.orderId) > -1) return { duplicate: true };

  const hdr = headers_(sh);
  const now = new Date().toISOString();
  const rows = o.items.map(function (it, idx) {
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    const mrp = Number(it.mrp) || 0;
    const disc = Math.max(0, Number(it.discount) || 0);
    const rec = {
      Order_ID: o.orderId,
      Date: o.date,
      Customer_Name: String(o.customerName || '').trim(),
      Customer_Phone: String(o.phone),
      Product_Code: it.code,
      Product_Name: it.name,
      QTY: qty,
      MRP: mrp,
      Discount: disc,
      Sold_Amount: qty * mrp - disc,
      Lead_By: String(o.leadBy || '').slice(0, 40),
      Prep_Status: PREP.indexOf(o.prep) > -1 ? o.prep : 'Pending',
      Payment_Status: PAY.indexOf(o.payment) > -1 ? o.payment : 'Unpaid',
      Delivery_Status: DELIVERY.indexOf(o.delivery) > -1 ? o.delivery : 'Pending',
      Delivery_Charge: idx === 0 ? Math.max(0, Number(o.deliveryCharge) || 0) : 0,
      Address: o.address || '',
      Notes: o.notes || '',
      Due_Date: o.dueDate || '',
      Updated_At: now,
    };
    return hdr.map(function (h) { return rec[h] === undefined ? '' : rec[h]; });
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, hdr.length).setValues(rows);
  rebuildCustomers_();
  return { added: rows.length };
}

function updateOrder_(req) {
  const allowed = { Prep_Status: PREP, Payment_Status: PAY, Delivery_Status: DELIVERY, Notes: null, Due_Date: null, Address: null, Feedback_Sent: ['Yes', ''] };
  const sh = sheet_('Orders');
  const hdr = headers_(sh);
  const ids = columnValues_(sh, 'Order_ID');
  const rowsIdx = [];
  ids.forEach(function (id, i) { if (id === req.orderId) rowsIdx.push(i + 2); });
  if (!rowsIdx.length) throw new Error('ORDER_NOT_FOUND');
  const fields = Object.assign({}, req.fields || {});
  // remember the day an order was delivered (used for the feedback reminder)
  if (fields.Delivery_Status === 'Delivered') {
    fields.Delivered_At = Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    allowed.Delivered_At = null;
  } else if (fields.Delivery_Status) {
    fields.Delivered_At = ''; // moved back from Delivered
    allowed.Delivered_At = null;
  }
  Object.keys(fields).forEach(function (f) {
    if (!(f in allowed)) return;
    if (allowed[f] && allowed[f].indexOf(fields[f]) === -1) return;
    if (f === 'Delivery_Status' && fields[f] === 'Shipped') fields[f] = 'Out for Delivery';
    const c = hdr.indexOf(f) + 1;
    if (c < 1) return; // column missing: re-run setup() to add it
    rowsIdx.forEach(function (r) { sh.getRange(r, c).setValue(fields[f]); });
  });
  const u = hdr.indexOf('Updated_At') + 1;
  const now = new Date().toISOString();
  rowsIdx.forEach(function (r) { sh.getRange(r, u).setValue(now); });
  if ('Address' in fields) rebuildCustomers_();
  return { updated: rowsIdx.length };
}

function deleteOrder_(req) {
  const sh = sheet_('Orders');
  const ids = columnValues_(sh, 'Order_ID');
  for (let i = ids.length - 1; i >= 0; i--) {
    if (ids[i] === req.orderId) sh.deleteRow(i + 2);
  }
  rebuildCustomers_();
  return { deleted: true };
}

function addExpense_(req) {
  const x = req.expense;
  if (!x || !x.expenseId || !(Number(x.amount) > 0) || !String(x.item || '').trim()) throw new Error('INVALID_EXPENSE');
  const sh = sheet_('Expenses');
  if (columnValues_(sh, 'Expense_ID').indexOf(x.expenseId) > -1) return { duplicate: true };
  const hdr = headers_(sh);
  const rec = {
    Expense_ID: x.expenseId, Date: x.date, Category: x.category, Item_Name: String(x.item).trim(),
    Amount: Number(x.amount), Remarks: x.remarks || '', Lead_By: String(x.leadBy || '').slice(0, 40),
  };
  sh.appendRow(hdr.map(function (h) { return rec[h] === undefined ? '' : rec[h]; }));
  return { added: true };
}

function deleteExpense_(req) {
  const sh = sheet_('Expenses');
  const ids = columnValues_(sh, 'Expense_ID');
  for (let i = ids.length - 1; i >= 0; i--) if (ids[i] === req.expenseId) sh.deleteRow(i + 2);
  return { deleted: true };
}

function updatePrices_(req) {
  const sh = sheet_('Products_Master');
  const hdr = headers_(sh);
  const codes = columnValues_(sh, 'Product_Code');
  const mrpCol = hdr.indexOf('MRP') + 1;
  let n = 0;
  (req.updates || []).forEach(function (u) {
    const i = codes.indexOf(u.code);
    const mrp = Number(u.mrp);
    if (i > -1 && mrp > 0) { sh.getRange(i + 2, mrpCol).setValue(mrp); n++; }
  });
  return { updated: n };
}

function saveProduct_(req) {
  const p = req.product;
  if (!p || !p.code || !p.name || !(Number(p.mrp) > 0)) throw new Error('INVALID_PRODUCT');
  const sh = sheet_('Products_Master');
  const hdr = headers_(sh);
  const rec = { Product_Code: p.code, Product_Name: p.name, MRP: Number(p.mrp), Category: p.category || 'Other',
    Active_Status: p.active === false || p.active === 'Inactive' ? 'Inactive' : 'Active' };
  const row = hdr.map(function (h) { return rec[h] === undefined ? '' : rec[h]; });
  const i = columnValues_(sh, 'Product_Code').indexOf(p.code);
  if (i > -1) sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  return { saved: true };
}

function saveTemplate_(req) {
  const t = req.template;
  if (!t || !t.key || !String(t.name || '').trim() || !String(t.text || '').trim()) throw new Error('INVALID_TEMPLATE');
  const rec = { Key: String(t.key), Name: String(t.name).trim(), Type: TEMPLATE_TYPES.indexOf(t.type) > -1 ? t.type : 'customer', Text: String(t.text) };
  const sh = sheet_('Templates');
  const hdr = headers_(sh);
  const row = hdr.map(function (h) { return rec[h] === undefined ? '' : rec[h]; });
  const i = columnValues_(sh, 'Key').indexOf(rec.Key);
  if (i > -1) sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  return { saved: true };
}

function deleteTemplate_(req) {
  const sh = sheet_('Templates');
  const keys = columnValues_(sh, 'Key');
  for (let i = keys.length - 1; i >= 0; i--) if (keys[i] === req.key) sh.deleteRow(i + 2);
  return { deleted: true };
}

/* ------------------------------------------------------------------ files */

function filesFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FILES_FOLDER');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* deleted: make a new one */ }
  }
  const folder = DriveApp.createFolder('DRSP Orders – Files');
  props.setProperty('FILES_FOLDER', folder.getId());
  return folder;
}

function filesMeta_() {
  const props = PropertiesService.getScriptProperties();
  const out = {};
  FILE_KINDS.forEach(function (k) {
    const raw = props.getProperty('FILE_' + k);
    if (raw) { const m = JSON.parse(raw); delete m.id; out[k] = m; }
  });
  return out;
}

function uploadFile_(req) {
  if (FILE_KINDS.indexOf(req.kind) === -1) throw new Error('BAD_FILE_KIND');
  if (!req.data) throw new Error('NO_FILE');
  const bytes = Utilities.base64Decode(req.data);
  if (bytes.length > MAX_FILE_MB * 1048576) throw new Error('FILE_TOO_BIG');
  const props = PropertiesService.getScriptProperties();
  const old = props.getProperty('FILE_' + req.kind);
  const name = String(req.name || req.kind).slice(0, 80);
  const file = filesFolder_().createFile(Utilities.newBlob(bytes, req.mimeType || 'application/octet-stream', name));
  let url = '';
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    url = file.getUrl();
  } catch (e) { /* some accounts block link sharing: the file can still be shared from the app */ }
  if (old) { try { DriveApp.getFileById(JSON.parse(old).id).setTrashed(true); } catch (e) { /* already gone */ } }
  const meta = { id: file.getId(), name: name, mimeType: req.mimeType || '', size: bytes.length, updatedAt: new Date().toISOString(), url: url };
  props.setProperty('FILE_' + req.kind, JSON.stringify(meta));
  delete meta.id;
  return meta;
}

function getFile_(req) {
  const raw = PropertiesService.getScriptProperties().getProperty('FILE_' + req.kind);
  if (!raw) throw new Error('NO_FILE');
  const m = JSON.parse(raw);
  const blob = DriveApp.getFileById(m.id).getBlob();
  return { name: m.name, mimeType: m.mimeType || blob.getContentType(), updatedAt: m.updatedAt, data: Utilities.base64Encode(blob.getBytes()) };
}

function deleteFile_(req) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('FILE_' + req.kind);
  if (raw) {
    try { DriveApp.getFileById(JSON.parse(raw).id).setTrashed(true); } catch (e) { /* already gone */ }
    props.deleteProperty('FILE_' + req.kind);
  }
  return { deleted: true };
}

/* ------------------------------------------------------ customers rollup */

function rebuildCustomers_() {
  const orders = readRows_('Orders');
  const map = {};
  orders.forEach(function (o) {
    const ph = String(o.Customer_Phone || '');
    if (!ph) return;
    const c = map[ph] || (map[ph] = { phone: ph, name: '', ids: {}, spent: 0, last: '', products: {}, address: '', lastSeen: '' });
    c.ids[o.Order_ID] = true;
    c.spent += Number(o.Sold_Amount) || 0;
    const d = String(o.Date || '');
    if (d >= c.lastSeen) {
      c.lastSeen = d;
      if (o.Customer_Name) c.name = o.Customer_Name;
      if (o.Address) c.address = o.Address;
    }
    if (d > c.last) c.last = d;
    c.products[o.Product_Name] = (c.products[o.Product_Name] || 0) + (Number(o.QTY) || 0);
  });
  const rows = Object.keys(map).map(function (ph) {
    const c = map[ph];
    let fav = '', best = -1;
    Object.keys(c.products).forEach(function (p) { if (c.products[p] > best) { best = c.products[p]; fav = p; } });
    const tier = c.spent > 5000 ? 'VIP' : c.spent > 2000 ? 'Regular' : 'New';
    return [c.phone, c.name, Object.keys(c.ids).length, c.spent, c.last, fav, tier, c.address];
  });
  rows.sort(function (a, b) { return b[3] - a[3]; });
  const sh = sheet_('Customers');
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

/* --------------------------------------------------------------- helpers */

function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '". Run setup() first.');
  return sh;
}

function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function columnValues_(sh, header) {
  const c = headers_(sh).indexOf(header) + 1;
  if (!c || sh.getLastRow() < 2) return [];
  return sh.getRange(2, c, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); });
}

function readRows_(name) {
  const sh = sheet_(name);
  if (sh.getLastRow() < 2) return [];
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const hdr = values.shift().map(String);
  return values
    .filter(function (r) { return r.join('') !== ''; })
    .map(function (r) {
      const o = {};
      hdr.forEach(function (h, i) {
        let v = r[i];
        if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
        o[h] = v;
      });
      return o;
    });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
