---
title: "DRSP Orders — Project Handbook & Handover"
subtitle: "Family homemade pickle (achar) business app · last updated 23 Nov 2026"
---

# 1. Restart prompt (paste this into a new chat)

> I'm continuing work on **DRSP Orders**, the PWA for my family's homemade pickle (achar) business. Repo: **https://github.com/Saysee09/drsp-orders** (branch `main`). Live app: **https://saysee09.github.io/drsp-orders/**. Please attach the repo, read `HANDBOOK.md` and `README.md` in it, and continue from the "Status" and "Next steps" sections. Stack: React 19 + Vite 8, Tailwind 4, lucide-react, vite-plugin-pwa, one shared username/password login, Google Apps Script backend (`apps-script/Code.gs`) over one master Google Sheet, GitHub Pages deploy via GitHub Actions. Always give me the GitHub links when you deliver work. Today I want to: **[write the task here]**

# 2. What the app is

DRSP Orders replaces manual spreadsheet tracking for the family pickle business. It's a mobile-first Progressive Web App (installable on Android and iPhone) for:

- fast phone-order intake (tap a pickle size to add it)
- one-tap order tracking: New → Making → Packed → On the way → Delivered
- sending the menu (photo/PDF link or the file itself) and ready-made WhatsApp messages to any number
- a big-button Kitchen Mode for Amma
- expenses, CSV price updates, profit and customer analytics

No subscription or hosting costs: GitHub Pages + Google Sheets + Apps Script. Target launch: **December 2026**.

## Login

One family **username + password** (set in `Code.gs`, changeable in the app under More → Username & password). Everyone has the same access. Each phone can store "who uses this phone" so orders show "by Sasi" etc. Kitchen Mode is remembered per phone.

# 3. Decisions we made together

| Topic | Decision | Why |
|---|---|---|
| Login | **One shared username + password** (changed 23 Nov; replaced Google Sign-In + per-person roles) | Simpler for the family; no Google Cloud setup. Brute-force pause after 8 wrong tries; password change logs out all other phones; 90-day logins. |
| Order status | **One stage bar: New → Making → Packed → On the way → Delivered** (23 Nov) | Easier than three separate controls. Stored in the same two columns (`Prep_Status`, `Delivery_Status`); "Shipped" renamed **Out for Delivery**. |
| Messages | **Editable templates** with `{placeholders}`; edits stored in a `Templates` tab, so all phones share them. Built-ins can be reset; custom ones can be added. | Change wording once, used everywhere. |
| Menu sending | Menu photo/PDF live in `public/menu/`; customers get a link to a menu page whose preview shows the photo. "Share photo/PDF" attaches the real file via the phone's share menu. | WhatsApp doesn't let apps attach a file to a specific number, so the link is the one-tap way; sharing the file needs picking the chat. |
| Backend | Google Apps Script web app | Password checked server-side; sheet stays private |
| Hosting | GitHub Pages | Free, automatic |
| Orders | Multi-item cart; one sheet row per item sharing `Order_ID` | |
| Discount | Per item | Matches spec `Sold_Amount = QTY × MRP − Discount` |
| IDs | `ORD-YYYYMMDD-XXX` / `EXP-YYYYMMDD-XXX`, random suffix | Offline phones never clash |
| Customers tab | Recomputed by the script after each order | |
| Revenue | Gross = item sales + delivery; Net = gross − expenses; Margin = net ÷ gross | |
| Tiers | VIP > ₹5,000, Regular > ₹2,000, else New | From spec |
| WhatsApp | Official `wa.me` links only; user presses Send | Zero ban risk |
| UPI | Payment message with amount, UPI ID and `upi://pay` link | |
| Feedback | Offered 1–21 days after delivery; marks `Feedback_Sent = Yes` | Never asked twice |

# 4. Screens (bottom tabs)

- **New order** – number lookup (returning customer name/address/tier, "+ Add usual"), tap-to-add size buttons with count badges, per-item qty & discount, delivery charge, deliver-by date, notes, payment. After saving: preview + **Send confirmation on WhatsApp** + **Ask ₹ (UPI)**. "Send menu" button at the top.
- **Orders** – search; filters Not delivered (default) · To make · Packed · On the way · Unpaid · Ask feedback · All. Each card: stage bar, payment (Unpaid / Paid UPI / Paid cash), Undo on every tap, "Tell customer it's on the way" when On the way, Ask ₹, Ask feedback, WhatsApp (message picker with the right message suggested), call, delete.
- **Send** – enter any number (+ optional name) → **Send menu on WhatsApp**, **Share photo / Share PDF**, "Change the words first", and the other customer messages (reorder reminder, custom offers).
- **Money** – Profit dashboard (ranges, KPIs, product ranking, feedback to ask, payments to collect, top customers, reorder nudges) and Expenses.
- **More** – Messages editor (tap-to-insert placeholders, live WhatsApp-style preview, reset/delete), Catalog & prices (CSV with diff, add/edit products), menu photo/PDF status, username & password, this phone's name, log out.
- **Kitchen** (chef-hat in the header) – "To make now" totals, START PREP / MARK PACKED.

Built-in messages: Menu (photo + PDF link), Menu (price list as text), Order confirmation, Payment request (UPI), Out for delivery, Delivered — thank you, Ask for feedback, Reorder reminder.

# 5. Google Sheet structure (created by `setup()`)

- **Orders** – Order_ID, Date, Customer_Name, Customer_Phone, Product_Code, Product_Name, QTY, MRP, Discount, Sold_Amount, Lead_By, Prep_Status, Payment_Status, Delivery_Status (Pending / Out for Delivery / Delivered), Delivery_Charge, Address, Notes, Due_Date, Updated_At, Delivered_At, Feedback_Sent
- **Products_Master** – Product_Code, Product_Name, MRP, Category, Active_Status (14-item catalog pre-loaded)
- **Expenses** – Expense_ID, Date, Category, Item_Name, Amount, Remarks, Lead_By
- **Customers** – automatic rollup
- **Templates** – Key, Name, Type (customer/order), Text — only edited/added messages

An old `Users` tab (from the Google Sign-In version) is no longer used and can be deleted.

# 6. Code map

| Path | What it is |
|---|---|
| `apps-script/Code.gs` | Backend: setup, password login & sessions, order/expense/price/template writes, customers rollup, `resetPassword` |
| `public/config.json` | apiUrl, businessName, businessPhone, upiId, upiName, reviewLink, menuUrl |
| `public/menu/` | Customer menu page (`index.html`) + `menu.jpg` + `menu.pdf` |
| `src/lib/api.js` | Backend calls, demo mode (login `drsp` / `demo`), optimistic update logic |
| `src/lib/store.jsx` | Login, offline queue, sync loop, phone name, templates |
| `src/lib/templates.js` | Built-in messages, placeholder filling |
| `src/lib/menu.js` | Menu file detection and file sharing |
| `src/lib/utils.js` | Formatting, IDs, order stages, grouping, menu text, UPI, CSV |
| `src/components/Messages.jsx` | Message picker sheet / WhatsApp button |
| `src/screens/` | Login, NewOrder, Orders, Send, Money (Dashboard + Expenses), More (+ Admin catalog), Kitchen |

# 7. Status (23 Nov 2026)

- ✅ App live on GitHub Pages (Demo mode until the sheet is connected)
- ✅ 23 Nov: one shared login, simpler order stages incl. **Out for delivery**, Send screen, editable message templates, customer menu page, tap-to-add products, 5-tab layout
- ⏳ Waiting for: menu photo + PDF, Google Sheet connection, UPI ID, business WhatsApp number

# 8. December launch checklist

1. Send Claude (or upload to `public/menu/`) **menu.jpg** and **menu.pdf**.
2. Google Sheet → Apps Script → paste `Code.gs` → set `APP_USERNAME` / `APP_PASSWORD` → run `setup`.
3. Deploy as Web app (Execute as Me, Anyone) → copy the `/exec` URL.
4. Put `apiUrl`, `upiId`, `businessPhone` in `public/config.json` (or send them to Claude).
5. Install on each phone, log in, set "who uses this phone"; turn on Kitchen Mode on Amma's phone.
6. Do 2–3 test orders end to end (New → Delivered, payment, messages), then delete them.
7. Read through More → Messages and adjust the wording.

# 9. Future ideas

- Separate business WhatsApp number (then set `businessPhone`).
- Business website linked to the app / orders straight into the sheet.
- Log "menu sent" numbers to follow up people who haven't ordered.
- Telugu/Hindi labels in Kitchen Mode; printable packing slip; customer list export.

# 10. Troubleshooting

| Problem | Fix |
|---|---|
| "Wrong username or password" | Check spelling; username isn't case-sensitive, password is |
| "Too many wrong tries" | Wait 15 minutes |
| Forgot the password | Apps Script: change `APP_PASSWORD`, Save, run `resetPassword` |
| Everyone got logged out | Someone changed the password — log in with the new one |
| Header says "n to save" for long | Phone offline or wrong `apiUrl`; changes are kept on the phone |
| New sheet column not filling | Run `setup()` again, then Deploy → Manage deployments → New version |
| Menu link shows "coming soon" | `public/menu/menu.jpg` missing or misnamed |
| App looks old | Tap the blue "App Update Available" bar, or close and reopen |
| Deploy failed | Repo Actions tab; Pages source must be "GitHub Actions" |
