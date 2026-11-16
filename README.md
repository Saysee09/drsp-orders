# DRSP Orders 🏺

Mobile-first PWA for the DRSP Homemade Pickles family business: quick phone-order entry, a dispatch grid, Mother's (Kitchen) Mode, expenses, bulk CSV price updates, and profit & customer analytics. Everything is stored in **one Google Sheet that you own**. There are no hosting or database costs.

**Live app:** https://saysee09.github.io/drsp-orders/

Until the Google Sheet is connected, the app runs in **Demo mode** with sample data that stays on the phone, so you can try every screen.

---

## How it works

```
Family phones (PWA on GitHub Pages)
        │  Google Sign-In (ID token)
        ▼
Apps Script Web App  ── verifies token + checks the "Users" tab (allowlist, roles)
        │
        ▼
Master Google Sheet: Orders · Products_Master · Expenses · Customers · Users
```

- **Security is enforced on Google's side.** The Apps Script verifies every sign-in with Google and only lets in emails listed in the `Users` tab. Delete someone's row and they are locked out on their next action. Sessions last 30 days.
- **Offline-safe.** Every change appears on screen instantly and is queued on the phone. If the internet drops, the queue saves to the sheet automatically when the phone is back online. The header shows `Live`, `n to save` or `Offline`.
- **Auto-updates.** Every push to `main` redeploys. Open phones then show *"App Update Available — Tap to Install Now"*.

### Roles (set in the `Users` tab)

| Role | Who | Can use |
|---|---|---|
| `Admin` | Sasi | Everything, including Catalog/CSV prices and deleting expenses |
| `Ops` | Brother | New order, Orders (incl. delete), Expenses, Profit dashboard |
| `Kitchen` | Mother | Opens straight into Kitchen Mode; can also take orders |
| `Helper` | Helper | Orders screen: status updates only |

---

## One-time setup (≈15 minutes)

### 1. Create the Google Sheet + backend

1. Create a new Google Sheet named **DRSP Orders – Master**.
2. **Extensions → Apps Script**. Delete the sample code and paste all of [`apps-script/Code.gs`](apps-script/Code.gs).
3. Leave `GOOGLE_CLIENT_ID` as-is for now (you'll fill it in at step 2). Click **Save**.
4. Choose the `setup` function in the toolbar → **Run** → approve the permissions.
   This creates all the tabs, loads the 14-product May catalog, and adds you to `Users` as **Sasi / Admin**.
5. In the `Users` tab, add the family members:

   | Email | Name | Role |
   |---|---|---|
   | brother@gmail.com | Brother | Ops |
   | mother@gmail.com | Mother | Kitchen |

### 2. Google Sign-In Client ID

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project **DRSP-Orders-App**.
2. **APIs & Services → OAuth consent screen**: External, app name *DRSP Orders*, your email. Add the family Gmails under **Test users**.
3. **Credentials → Create credentials → OAuth client ID → Web application**
   - Authorized JavaScript origins: `https://saysee09.github.io` and `http://localhost:5173`
4. Copy the **Client ID**.
5. Back in Apps Script, paste it into `const GOOGLE_CLIENT_ID = '...'` and **Save**.

> You do **not** need to enable the Sheets API. The Apps Script reads the sheet directly.

### 3. Deploy the backend

In Apps Script: **Deploy → New deployment → Web app**
- Execute as: **Me**
- Who has access: **Anyone** (the script itself blocks anyone not in `Users`)

Copy the **Web app URL** (ends in `/exec`).

> After any later change to `Code.gs`: **Deploy → Manage deployments → Edit → Version: New version**. This keeps the same URL.

### 4. Connect the app

Edit [`public/config.json`](public/config.json) on GitHub (pencil icon) and commit:

```json
{
  "apiUrl": "https://script.google.com/macros/s/XXXX/exec",
  "googleClientId": "1234-abc.apps.googleusercontent.com",
  "businessName": "DRSP Homemade Pickles",
  "businessPhone": ""
}
```

The site redeploys in about a minute. Demo mode switches off and the Google Sign-In button appears.

### 5. Install on phones

- **Android (Chrome):** open the link → ⋮ → *Install app* / *Add to Home screen*
- **iPhone (Safari):** open the link → Share → *Add to Home Screen*

---

## Using it

- **New** – type the 10-digit number. A returning customer's name, address, tier and *"+ Add usual"* fill in automatically. Add several products (each with its own discount), then delivery charge, deliver-by date, notes and payment. **Save Order to Sheet** → **Send receipt on WhatsApp**. **Send Menu** builds the WhatsApp menu from the active products.
- **Orders** – search plus filters (All, Pending Prep, Unpaid, Ready for Delivery, Due ≤ Today). One tap changes Prep / Payment / Delivery for the whole order, with **Undo**.
- **Kitchen** (chef-hat button) – big text, *To make now* totals, cards sorted by due date, giant **START PREP** / **MARK PACKED** buttons with Undo. No deleting or money.
- **Expenses** – category pills, amount, date, vendor; monthly totals by category.
- **Profit** – revenue, expenses, net profit, margin %, AOV, unpaid to collect, product ranking, top customers, and the 30-day **reorder nudge** list with WhatsApp buttons.
- **Catalog** (Admin) – CSV price upload with a side-by-side diff before anything is written. You can also add, edit or deactivate products and download the current price list as a CSV. Past orders never change price.

WhatsApp uses official `wa.me` links only. The app opens WhatsApp with the message pre-filled, and you press Send, so there is no ban risk.

### Sheet notes
- `Orders` has one row per item; items in the same order share an `Order_ID`. Delivery charge is stored on the order's first row.
- `Customers` is rebuilt automatically after each order (Total_Orders counts distinct orders). Tiers: VIP > ₹5,000, Regular > ₹2,000, otherwise New.
- Don't rename the header row. Adding your own extra columns at the end is fine.

---

## Development

```bash
npm install
npm run dev        # http://localhost:5173/drsp-orders/
npm run build
```

Stack: React 19 + Vite, Tailwind CSS 4, lucide-react, vite-plugin-pwa, Google Identity Services, Google Apps Script.
