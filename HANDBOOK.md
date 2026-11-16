---
title: "DRSP Orders — Project Handbook & Handover"
subtitle: "Family homemade pickle (achar) business app · last updated 16 Nov 2026"
---

# 1. Restart prompt (paste this into a new chat)

> I'm continuing work on **DRSP Orders**, the PWA for my family's homemade pickle (achar) business. Repo: **https://github.com/Saysee09/drsp-orders** (branch `main`). Live app: **https://saysee09.github.io/drsp-orders/**. Please attach the repo, read `HANDBOOK.md` and `README.md` in it, and continue from the "Status" and "Next steps" sections. Stack: React 19 + Vite 8, Tailwind 4, lucide-react, vite-plugin-pwa, Google Identity Services sign-in, Google Apps Script backend (`apps-script/Code.gs`) over one master Google Sheet, GitHub Pages deploy via GitHub Actions. Always give me the GitHub links when you deliver work. Today I want to: **[write the task here]**

# 2. What the app is

DRSP Orders replaces manual spreadsheet maintenance for the family pickle business. It's a mobile-first Progressive Web App (installable on Android and iPhone) for:

- fast phone-order intake
- one-tap status updates
- a simplified kitchen view for Mother
- expense tracking
- bulk price updates by CSV
- profit and customer analytics

It's built from the original spec document *"DRSP Orders — Full App Specification & AI Builder Blueprint"*. There are no subscription or hosting costs: everything runs on GitHub Pages + Google Sheets + Apps Script.

## Users and roles

| Person | Role | What they can do |
|---|---|---|
| Sasi | Admin | Everything: catalog, CSV price updates, delete expenses, profit dashboard |
| Brother | Ops | New orders, orders (incl. delete), expenses, profit dashboard |
| Mother | Kitchen | Opens straight into Kitchen Mode (big buttons, no money/deleting); can also take orders |
| Helper (optional) | Helper | Orders screen, status updates only |

Roles are set in the **Users** tab of the Google Sheet (Email, Name, Role). Removing a row locks that person out on their next action.

# 3. Decisions we made together

| Topic | Decision | Why |
|---|---|---|
| Backend | **Google Apps Script web app** (not the direct Sheets API) | The allowlist is enforced server-side, so it can't be bypassed. The sheet stays private, and logins last 30 days instead of re-signing in every hour. |
| Hosting | **GitHub Pages** (not Vercel/Netlify) | Free, and fully automated from the repo |
| Orders | **Multi-item cart** | One order holds many products. They're saved as one sheet row per item sharing the same `Order_ID`, and status buttons update the whole order. |
| Extra fields (beyond spec) | Delivery address/area, delivery charge, order notes, delivery due date | All four were chosen |
| Discount | Per item (each line has its own discount) | Matches the spec's `Sold_Amount = QTY × MRP − Discount` per row |
| Order / Expense IDs | `ORD-YYYYMMDD-XXX` / `EXP-YYYYMMDD-XXX`, with XXX a random 3-character code | Phones that are offline at the same time never clash |
| Customers tab | Recomputed by the script after each order (values, not formulas) | Favourite product ("mode") isn't possible with simple formulas. Total_Orders counts distinct orders. |
| Revenue | Gross revenue = item sales + delivery charges. Net profit = gross − expenses. Margin = net ÷ gross. | |
| Tiers | VIP > ₹5,000 lifetime, Regular > ₹2,000, else New | From the spec |
| WhatsApp | Official `wa.me` links only. The user presses Send. | Zero ban risk (spec section 5) |
| UPI payment | WhatsApp message with amount, UPI ID and a `upi://pay` tap-to-pay link | Added 16 Nov. Whether the link is tappable varies by phone, but the UPI ID always works. |
| Feedback | "Ask for Feedback" appears from 1 day after delivery, up to 21 days. Marks `Feedback_Sent = Yes` so it's never asked twice. | Added 16 Nov |

# 4. Features built (all done and tested)

**New Order**

- The phone lookup auto-fills a returning customer's name and address and shows tier, order count and last order date. A **"+ Add usual"** button adds their favourite product.
- Product dropdown grouped by category; quantity steppers; per-item discount.
- Delivery charge, deliver-by date, notes, and payment at intake (Unpaid / UPI / Cash).
- Live totals and a **Save Order to Sheet** button.
- After saving, a sheet appears with **Send receipt on WhatsApp** and **Request ₹ via UPI**.
- **Send Menu** builds the WhatsApp menu from the active products.

**Orders**

- Search by name, phone or order ID.
- Filters: All · Pending Prep · Unpaid · Ready for Delivery · Due ≤ Today · Ask Feedback.
- Color-coded one-tap controls for Prep (Pending / In Batch / Packed), Payment (Unpaid / UPI / Cash) and Delivery (Pending / Shipped / Delivered), with **Undo**.
- Buttons for WhatsApp receipt, call, UPI request and feedback request.
- Admin/Ops can delete an order.

**Kitchen Mode (Mother's Mode)**

- Chef-hat button in the top bar; it's the default for the Kitchen role.
- "To make now" totals per product.
- Cards sorted by due date, in large text, with notes highlighted.
- Giant **START PREP** / **MARK PACKED** buttons with Undo.
- No money, no deleting.

**Expenses**

- Categories: Raw Material, Masala & Oil, Packaging, Equipment, Travel, Other.
- Amount, date, remarks/vendor.
- This-month total with a category breakdown. Admin can delete.

**Catalog (Admin)**

- CSV bulk price update (`Product_Code, Product_Name, MRP`). It shows a side-by-side diff (up / down / unchanged / unknown) and only writes after **Confirm & Overwrite**.
- Past orders keep their old prices.
- Download the current prices as a CSV.
- Add, edit or deactivate products.

**Profit dashboard**

- Ranges: Today / 7 days / This month / Last month / All.
- KPIs: Gross revenue, Expenses, Net profit, Margin %, AOV, Unpaid to collect.
- Product performance ranking and where the money went.
- Lists:
  - Feedback to ask
  - Payments to collect
  - Top customers
  - Reorder nudges (30+ days, with WhatsApp)

**App-wide**

- Google Sign-In, checked against the Users tab.
- Unregistered accounts get *"Access Denied: Unregistered Family Account"* and local data is wiped.
- Offline queue: changes show instantly and save when the phone is back online. The header shows Live / n to save / Offline.
- The app syncs every 30 seconds and when it's reopened.
- Auto-update bar: *"App Update Available — Tap to Install Now"*.
- Demo mode with sample data runs whenever `config.json` has no `apiUrl`.

# 5. Google Sheet structure (created by `setup()`)

- **Orders** – Order_ID, Date, Customer_Name, Customer_Phone, Product_Code, Product_Name, QTY, MRP, Discount, Sold_Amount, Lead_By, Prep_Status, Payment_Status, Delivery_Status, Delivery_Charge, Address, Notes, Due_Date, Updated_At, Delivered_At, Feedback_Sent
- **Products_Master** – Product_Code, Product_Name, MRP, Category, Active_Status. It's pre-loaded with the 14-item May catalog: Mango 250/500/1000, Chicken Boneless 250/500/1000, Prawns 100/250/500, Fish 250/500, Chicken+Prawns combo 250g, Mutton Boneless 100g, Chicken Powder 100g.
- **Expenses** – Expense_ID, Date, Category, Item_Name, Amount, Remarks, Lead_By
- **Customers** – Customer_Phone, Customer_Name, Total_Orders, Total_Spent, Last_Order_Date, Favorite_Product, Customer_Tier, Address (automatic)
- **Users** – Email, Name, Role (the allowlist)

Rules: don't rename the headers. Adding your own columns at the end is fine. Re-run `setup()` at any time to add new columns safely.

# 6. Code map (repo `Saysee09/drsp-orders`)

| Path | What it is |
|---|---|
| `apps-script/Code.gs` | Whole backend: setup, sign-in verification, sessions, permissions, order/expense/price writes, customers rollup |
| `public/config.json` | Live settings: `apiUrl`, `googleClientId`, `businessName`, `businessPhone`, `upiId`, `upiName`, `reviewLink` |
| `src/lib/api.js` | Calls the backend, demo-mode database, shared optimistic-update logic |
| `src/lib/store.jsx` | App state: login, offline queue, sync loop, derived orders/customers |
| `src/lib/utils.js` | Formatting, IDs, order grouping, WhatsApp texts (menu, receipt, nudge, UPI, feedback), CSV |
| `src/screens/` | Login, NewOrder, Orders, Kitchen, Expenses, Admin (Catalog), Dashboard |
| `src/components/` | UI pieces, header, bottom nav, toasts, update bar |
| `.github/workflows/deploy.yml` | Builds and deploys to GitHub Pages on every push to `main` |
| `README.md` | Full setup guide |

Local development: `npm install` → `npm run dev` → open http://localhost:5173/drsp-orders/

# 7. Status (16 Nov 2026)

- ✅ Repo created and code pushed: https://github.com/Saysee09/drsp-orders
- ✅ GitHub Pages enabled; deploy succeeded: https://saysee09.github.io/drsp-orders/
- ✅ Claude GitHub App given access to the repo
- ✅ UPI payment request and after-delivery feedback added
- ⏳ **Not done yet: connecting the real Google Sheet.** The app is in Demo mode until then.

# 8. Next steps: Google setup (about 15 minutes)

1. Create a Google Sheet called **DRSP Orders – Master** → Extensions → Apps Script → paste `apps-script/Code.gs` → Save → run **setup** → approve the permissions.
2. In the **Users** tab, add each family member's Gmail, name and role. You (Sasi) are added automatically as Admin.
3. Set up the Google Cloud Console:
   - Create a project **DRSP-Orders-App**.
   - On the OAuth consent screen, choose External and add the family Gmails as test users.
   - Go to Credentials → OAuth client ID → Web application. Under authorized JavaScript origins, add `https://saysee09.github.io` and `http://localhost:5173`.
   - Copy the Client ID.
4. Paste the Client ID into `GOOGLE_CLIENT_ID` at the top of Code.gs and Save.
5. Click **Deploy → New deployment → Web app**. Set Execute as: **Me** and Who has access: **Anyone**. Copy the `/exec` URL.
   *(After any later change to Code.gs, go to Deploy → Manage deployments → Edit → New version. The URL stays the same.)*
6. Edit `public/config.json` on GitHub: `apiUrl` = the `/exec` URL, `googleClientId`, `upiId` = your UPI ID → Commit. The site redeploys in about a minute.
7. Install it on each phone: Android Chrome → ⋮ → Install app; iPhone Safari → Share → Add to Home Screen.

Or send Claude the Client ID, the web app URL and your UPI ID, and ask it to update `config.json`.

# 9. Future ideas (agreed for later)

- **Separate business WhatsApp number**: planned. Once you have it, set `businessPhone` and consider WhatsApp Business features.
- **Business website**: planned. Link it to the app, e.g. put a review/website link in `reviewLink` so feedback messages carry it, and possibly let the website send orders straight into the sheet.
- Other ideas discussed:
  - Telugu/Hindi labels in Kitchen Mode
  - Printable packing slip
  - Customer list export

# 10. Troubleshooting

| Problem | Fix |
|---|---|
| "Access Denied: Unregistered Family Account" | Add that Gmail to the Users tab (exact spelling) |
| "Setup issue: Client ID … does not match" | `GOOGLE_CLIENT_ID` in Code.gs must equal `googleClientId` in config.json; redeploy the script as a new version |
| Header says "n to save" for a long time | Phone is offline or the script URL is wrong. Changes are kept on the phone until they save. |
| New sheet column not filling | Run `setup()` again, then Deploy → Manage deployments → New version |
| App looks old on a phone | Tap the blue "App Update Available" bar, or close and reopen the app |
| Deploy failed on GitHub | Check the repo's Actions tab. Pages source must be "GitHub Actions". |
| Claude can't push | The Claude GitHub App needs access to `drsp-orders` (github.com/settings/installations → Claude → Configure) |
