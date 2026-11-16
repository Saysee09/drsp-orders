/**
 * DRSP Orders — Google Apps Script backend
 * ------------------------------------------------------------
 * Paste this whole file into Extensions > Apps Script of your
 * master Google Sheet. Then:
 *   1. Paste your OAuth Client ID into GOOGLE_CLIENT_ID below.
 *   2. Run the `setup` function once (approve the permissions).
 *   3. Deploy > New deployment > Web app
 *        Execute as: Me    |    Who has access: Anyone
 *   4. Copy the Web app URL into public/config.json ("apiUrl").
 *
 * Security: every request is checked here, on Google's side.
 *   - Sign-in tokens are verified with Google and must be issued
 *     for YOUR client ID.
 *   - The email must be listed in the "Users" tab. Remove a row
 *     there and that person is locked out on their next action.
 */

const GOOGLE_CLIENT_ID = 'PASTE_YOUR_CLIENT_ID.apps.googleusercontent.com';
const SESSION_DAYS = 30;

const SHEETS = {
  Orders: ['Order_ID', 'Date', 'Customer_Name', 'Customer_Phone', 'Product_Code', 'Product_Name', 'QTY', 'MRP',
    'Discount', 'Sold_Amount', 'Lead_By', 'Prep_Status', 'Payment_Status', 'Delivery_Status',
    'Delivery_Charge', 'Address', 'Notes', 'Due_Date', 'Updated_At', 'Delivered_At', 'Feedback_Sent'],
  Products_Master: ['Product_Code', 'Product_Name', 'MRP', 'Category', 'Active_Status'],
  Expenses: ['Expense_ID', 'Date', 'Category', 'Item_Name', 'Amount', 'Remarks', 'Lead_By'],
  Customers: ['Customer_Phone', 'Customer_Name', 'Total_Orders', 'Total_Spent', 'Last_Order_Date',
    'Favorite_Product', 'Customer_Tier', 'Address'],
  Users: ['Email', 'Name', 'Role'],
};

// Columns stored as plain text so Sheets never turns them into dates/numbers.
const TEXT_COLS = {
  Orders: ['Order_ID', 'Date', 'Customer_Phone', 'Product_Code', 'Due_Date', 'Updated_At', 'Delivered_At'],
  Products_Master: ['Product_Code'],
  Expenses: ['Expense_ID', 'Date'],
  Customers: ['Customer_Phone', 'Last_Order_Date'],
  Users: [],
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

const ROLES = ['Admin', 'Ops', 'Kitchen', 'Helper'];
const PERMS = {
  addOrder: ['Admin', 'Ops', 'Kitchen'],
  updateOrder: ROLES,
  deleteOrder: ['Admin', 'Ops'],
  addExpense: ['Admin', 'Ops'],
  deleteExpense: ['Admin'],
  updatePrices: ['Admin'],
  saveProduct: ['Admin'],
};

const PREP = ['Pending', 'In Batch', 'Packed'];
const PAY = ['Unpaid', 'UPI', 'Cash'];
const DELIVERY = ['Pending', 'Shipped', 'Delivered'];

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

  const users = ss.getSheetByName('Users');
  if (users.getLastRow() < 2) {
    const me = Session.getActiveUser().getEmail();
    if (me) users.getRange(2, 1, 1, 3).setValues([[me, 'Sasi', 'Admin']]);
  }
  // Role dropdown for the Users tab
  users.getRange('C2:C50').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ROLES, true).build());

  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  rebuildCustomers_();
  Logger.log('DRSP Orders setup complete. Add family members in the Users tab.');
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
    if (req.action === 'login') return json_({ ok: true, data: login_(req.idToken) });

    const user = auth_(req.session);
    if (req.action === 'logout') {
      PropertiesService.getScriptProperties().deleteProperty('S_' + req.session);
      return json_({ ok: true });
    }
    if (req.action === 'sync') return json_({ ok: true, data: snapshot_(user) });

    const allowed = PERMS[req.action];
    if (!allowed) return json_({ ok: false, error: 'UNKNOWN_ACTION' });
    if (allowed.indexOf(user.role) === -1) return json_({ ok: false, error: 'NOT_ALLOWED' });

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
};

/* ------------------------------------------------------------------ auth */

function login_(idToken) {
  if (!idToken) throw new Error('NO_TOKEN');
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('INVALID_TOKEN');
  const info = JSON.parse(res.getContentText());
  if (info.aud !== GOOGLE_CLIENT_ID) throw new Error('WRONG_CLIENT');
  if (String(info.email_verified) !== 'true') throw new Error('EMAIL_NOT_VERIFIED');

  const user = findUser_(info.email);
  if (!user) throw new Error('ACCESS_DENIED');

  const props = PropertiesService.getScriptProperties();
  // clean up expired sessions
  const all = props.getProperties();
  const now = Date.now();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('S_') === 0) {
      try { if (JSON.parse(all[k]).exp < now) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
    }
  });

  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  props.setProperty('S_' + token, JSON.stringify({ email: user.email, exp: now + SESSION_DAYS * 864e5 }));
  return { session: token, user: { email: user.email, name: user.name, role: user.role, picture: info.picture || '' } };
}

function auth_(session) {
  if (!session) throw new Error('NO_SESSION');
  const raw = PropertiesService.getScriptProperties().getProperty('S_' + session);
  if (!raw) throw new Error('SESSION_EXPIRED');
  const s = JSON.parse(raw);
  if (s.exp < Date.now()) throw new Error('SESSION_EXPIRED');
  const user = findUser_(s.email);
  if (!user) throw new Error('ACCESS_DENIED');
  return user;
}

function findUser_(email) {
  const rows = readRows_('Users');
  const e = String(email || '').trim().toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i].Email).trim().toLowerCase() === e) {
      const role = ROLES.indexOf(rows[i].Role) > -1 ? rows[i].Role : 'Helper';
      return { email: e, name: rows[i].Name || e.split('@')[0], role: role };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ data */

function snapshot_(user) {
  return {
    user: user,
    products: readRows_('Products_Master'),
    orders: readRows_('Orders'),
    expenses: user.role === 'Admin' || user.role === 'Ops' ? readRows_('Expenses') : [],
    customers: readRows_('Customers'),
    serverTime: new Date().toISOString(),
  };
}

function addOrder_(req, user) {
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
      Lead_By: user.name,
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
  }
  Object.keys(fields).forEach(function (f) {
    if (!(f in allowed)) return;
    if (allowed[f] && allowed[f].indexOf(fields[f]) === -1) return;
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

function addExpense_(req, user) {
  const x = req.expense;
  if (!x || !x.expenseId || !(Number(x.amount) > 0) || !String(x.item || '').trim()) throw new Error('INVALID_EXPENSE');
  const sh = sheet_('Expenses');
  if (columnValues_(sh, 'Expense_ID').indexOf(x.expenseId) > -1) return { duplicate: true };
  const hdr = headers_(sh);
  const rec = {
    Expense_ID: x.expenseId, Date: x.date, Category: x.category, Item_Name: String(x.item).trim(),
    Amount: Number(x.amount), Remarks: x.remarks || '', Lead_By: user.name,
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
