# DRSP Orders 🏺

Mobile-first PWA for the DRSP Homemade Pickles family business: quick phone-order entry, one-tap order tracking up to delivery, WhatsApp menu & message templates, Kitchen Mode, expenses, bulk CSV price updates, and profit & customer analytics. Everything is stored in **one Google Sheet that you own**. There are no hosting or database costs.

**Live app:** https://saysee09.github.io/drsp-orders/

Until the Google Sheet is connected, the app runs in **Demo mode** with sample data that stays on the phone, so you can try every screen.

---

## How it works

```
Family phones (PWA on GitHub Pages)
        │  one family username + password
        ▼
Apps Script Web App  ── checks the password, keeps 90-day logins
        │
        ▼
Master Google Sheet: Orders · Products_Master · Expenses · Customers · Templates
```

- **One login for the whole family.** No Google accounts or Google Cloud needed. Wrong passwords are counted (8 misses → 15-minute pause). Changing the password in the app logs out every other phone.
- **Offline-safe.** Every change appears on screen instantly and is queued on the phone. It saves to the sheet when the phone is back online. The header shows `Live`, `n to save` or `Offline`.
- **Auto-updates.** Every push to `main` redeploys. Open phones then show *"App Update Available — Tap to Install Now"*.

---

## One-time setup (≈10 minutes)

### 1. Create the Google Sheet + backend

1. Create a new Google Sheet named **DRSP Orders – Master**.
2. **Extensions → Apps Script**. Delete the sample code and paste all of [`apps-script/Code.gs`](apps-script/Code.gs).
3. At the top, set the family login: `APP_USERNAME` (e.g. `drsp`) and `APP_PASSWORD` (pick a strong one). Click **Save**.
4. Choose the `setup` function in the toolbar → **Run** → approve the permissions. This creates all the tabs and loads the 14-product catalog.

### 2. Deploy the backend

**Deploy → New deployment → Web app**
- Execute as: **Me**
- Who has access: **Anyone** (the script itself checks the password)

Copy the **Web app URL** (ends in `/exec`).

> After any later change to `Code.gs`: **Deploy → Manage deployments → Edit → Version: New version**. The URL stays the same.

### 3. Connect the app

Edit [`public/config.json`](public/config.json) on GitHub (pencil icon) and commit:

```json
{
  "apiUrl": "https://script.google.com/macros/s/XXXX/exec",
  "businessName": "DRSP Homemade Pickles",
  "businessPhone": "9XXXXXXXXX",
  "upiId": "yourname@okaxis",
  "upiName": "DRSP Pickles",
  "reviewLink": "",
  "menuUrl": ""
}
```

- `upiId` – the UPI ID customers pay to.
- `businessPhone` – shows an **Order on WhatsApp** button on the customer menu page.
- `reviewLink` – optional; feedback messages include it when set.
- `menuUrl` – leave empty to use the built-in menu page.

### 4. Add the menu photo & PDF

Upload **`menu.jpg`** and **`menu.pdf`** into [`public/menu/`](public/menu/) (GitHub → *Add file → Upload files*). Customers get the link `https://saysee09.github.io/drsp-orders/menu/`, which shows the photo (WhatsApp shows it as the link preview) and a PDF download.

### 5. Install on phones

- **Android (Chrome):** open the link → ⋮ → *Install app*
- **iPhone (Safari):** open the link → Share → *Add to Home Screen*

Log in with the family username + password. Optionally type who uses the phone (shown on orders as "by …"). On Amma's phone, tap the chef-hat once — Kitchen Mode is remembered on that phone.

**Forgot the password?** In Apps Script, change `APP_PASSWORD`, Save, run `resetPassword` once.

---

## Using it

- **New order** – type the number (returning customers fill in automatically, with *"+ Add usual"*). Tap a pickle size to add it, tap again for more. Delivery charge, deliver-by date, notes, payment. **Save order** → **Send confirmation on WhatsApp**.
- **Orders** – one row of steps per order: **New → Making → Packed → On the way → Delivered**, plus **Unpaid / Paid UPI / Paid cash**. Every tap has **Undo**. When an order is *On the way*, a button sends the "out for delivery" message. Filters: Not delivered (default), To make, Packed, On the way, Unpaid, Ask feedback, All.
- **Send** – type any customer's number → **Send menu on WhatsApp** (opens their chat with the menu link), or **Share photo / Share PDF** to attach the actual file. Other messages (reorder reminder, your own offers) are listed below.
- **Money** – Profit dashboard and Expenses.
- **More** – **Messages** (edit any WhatsApp message, add your own; changes reach every phone), Catalog & prices (CSV update with diff), menu file status, username & password, this phone's name.
- **Kitchen** (chef-hat) – big text, *To make now* totals, giant **START PREP / MARK PACKED** buttons.

WhatsApp uses official `wa.me` links only: the app opens WhatsApp with the message ready and you press Send, so there is no ban risk. (WhatsApp does not let any app attach a file to a specific number, so for the actual photo/PDF you pick the chat in the share menu.)

### Message placeholders
Messages can use `{first_name}`, `{name}`, `{business}`, `{menu_link}`, `{menu_text}`, `{order_id}`, `{items}`, `{items_short}`, `{total}`, `{amount_due}`, `{payment_status}`, `{payment_line}`, `{upi_id}`, `{upi_link}`, `{due_date}`, `{address}`, `{favorite}`, `{review_link}`. A line whose placeholder is empty is left out automatically.

### Sheet notes
- `Delivery_Status` is `Pending`, `Out for Delivery` or `Delivered` (old `Shipped` values are read as Out for Delivery).
- `Orders` has one row per item; items in the same order share an `Order_ID`. Delivery charge is on the first row.
- `Customers` is rebuilt after each order. Tiers: VIP > ₹5,000, Regular > ₹2,000, otherwise New.
- `Templates` only holds messages you changed or added; the rest use the built-in wording.
- Don't rename the header row. Extra columns at the end are fine. Re-run `setup` any time to add new columns.

---

## Development

```bash
npm install
npm run dev        # http://localhost:5173/drsp-orders/
npm run build
```

Stack: React 19 + Vite, Tailwind CSS 4, lucide-react, vite-plugin-pwa, Google Apps Script.
