---
title: "DRSP Orders — Project Handbook & Handover"
subtitle: "Family homemade pickle (achar) business app · last updated 24 Nov 2026"
---

# 1. Restart prompt (paste this into a new chat)

> I'm continuing work on **DRSP Orders**, the PWA for my family's homemade pickle (achar) business. Repo: **https://github.com/Saysee09/drsp-orders** (branch `main`). Live app: **https://saysee09.github.io/drsp-orders/**. Please attach the repo, read `HANDBOOK.md` in it, and continue from the "Status" and "Next steps" sections. Stack: React 19 + Vite 8, Tailwind 4, lucide-react, vite-plugin-pwa, one shared username/password login, Google Apps Script backend (`apps-script/Code.gs`) over one master Google Sheet + a Drive folder for files, GitHub Pages deploy via GitHub Actions. Always give me the GitHub links when you deliver work. Give setup steps and code in chat; only update the handbook when I ask. Today I want to: **[write the task here]**

# 2. What the app is

DRSP Orders replaces manual spreadsheet tracking for the family pickle business. It's a mobile-first Progressive Web App (installable on Android and iPhone). No subscription or hosting costs: GitHub Pages + Google Sheets + Apps Script + Google Drive. Target launch: **December 2026**.

- **Login:** one family username + password. Everyone sees everything. Each phone can save "who uses this phone" (shown on orders as "by Sasi"). Kitchen Mode is remembered per phone (turn it on once on Amma's phone).
- **Live connection:** `public/config.json` → `apiUrl` = `https://script.google.com/macros/s/AKfycbz9WmAX5YrEAg-9wOObk66KURuQN4SHWSFo_CyRzORk70NiOZuMNxij6xt323z7FhceCg/exec` (connected 24 Nov 2026).

# 3. Screens (bottom tabs)

**New order** — 3 steps:

1. Customer: WhatsApp number (returning customers auto-fill name/address, show tier, "+ Add usual"), name, address.
2. Pickles: tap a size button to add (badge shows count), − / + to change, "+ Add discount" per item.
3. Delivery & payment: No date / Today / Tomorrow / pick a date, delivery charge, note for kitchen, Unpaid / Paid UPI / Paid cash.

Slim bar at the bottom shows items + total + **Save order**. After saving: confirmation preview, **Send confirmation on WhatsApp**, **Ask ₹ (UPI)**.

**Orders** — filters (wrap): Not delivered (default) · To make · Packed · On the way · Unpaid · Ask review · All. Each card:

- Stage bar **New → Making → Packed → On the way → Delivered**. Tap any step directly (earlier steps auto-complete, shown with ✓).
- Payment: Unpaid / Paid UPI / Paid cash. Every tap shows a small "Marked … · Undo" note under the header.
- "Tell customer it's on the way", "Ask ₹" (payment message + UPI QR), "Ask review", WhatsApp (message picker), call, delete.

**Send**

- *To one customer:* number + optional name → **Send menu** (1. open chat with message, 2. attach menu photo + PDF), other messages (reorder reminder, your own).
- *Campaigns & offers:* create a campaign — name, type (🎉 Offer, 🪔 Festival, 🏺 New batch, 💛 We miss you, Other), optional photo (e.g. poster made in Gemini), message with `{first_name}` etc., audience (All, Not ordered in 30+ days, VIP, Regular, New, or only pasted numbers; extra pasted numbers can be added to any). Sending is one customer at a time: **1. Open chat with message → 2. Attach photo → Done, next customer**, with "X of Y sent" progress saved to the sheet (no double sending across phones). Shortcut card for customers lapsed 30+ days. Safety note: send to people who know DRSP, ~20–30 a day from a personal number.

**Money** — Profit (ranges, KPIs, product ranking, review to ask, payments to collect, top customers, reorder nudges) and Expenses.

**More**

- Business details: business name, business WhatsApp number, UPI ID & name, **Google review link** (the "Ask review" message sends customers there).
- Messages: edit the 8 built-in WhatsApp messages or add your own; tap-to-insert placeholders; preview; reset.
- Catalog & prices: add/edit products, CSV price update with diff.
- Username & password (changing it logs out other phones).
- Menu & payment files: upload/replace **Menu photo**, **Menu PDF**, **UPI QR (scanner)** — saved in Drive folder "DRSP Orders – Files", cached on each phone.
- This phone's name, log out.

**Kitchen** (chef-hat in header) — "To make now" totals, START PREP / MARK PACKED, big text.

# 4. Decisions we made together

| Topic | Decision |
|---|---|
| Name | Stays **DRSP Orders** |
| Login | One shared username + password (no Google Sign-In, no roles). 8 wrong tries → 15-min pause. 90-day logins. |
| Order status | One stage bar; stored in `Prep_Status` + `Delivery_Status`. "Shipped" renamed **Out for Delivery**. |
| Messages | Editable templates; edits stored in `Templates` tab. Built-ins: Menu (with photo/PDF), Menu (price list text), Order confirmation, Payment request (UPI), Out for delivery, Delivered — thank you, Ask for review, Reorder reminder. |
| Files | Uploaded in the app → Google Drive via Apps Script. No public menu web page (removed by request). |
| Sending files | WhatsApp doesn't allow apps to attach a file to a specific number, so: open chat with text (wa.me) → attach file via phone share menu → pick that chat (top of list). |
| UPI | User will use a UPI QR (scanner) image; UPI ID optional. |
| Reviews | Ask review → Google review link (set in More → Business details). Later: connect Google Business Profile. |
| WhatsApp | Official `wa.me` links only; a person always presses Send. |
| Handbook | Only updated when asked; setup steps/code given in chat. |

# 5. Google Sheet & Drive (created automatically)

- **Orders** – Order_ID, Date, Customer_Name, Customer_Phone, Product_Code, Product_Name, QTY, MRP, Discount, Sold_Amount, Lead_By, Prep_Status, Payment_Status, Delivery_Status (Pending / Out for Delivery / Delivered), Delivery_Charge, Address, Notes, Due_Date, Updated_At, Delivered_At, Feedback_Sent
- **Products_Master** – Product_Code, Product_Name, MRP, Category, Active_Status (14-item catalog pre-loaded)
- **Expenses** – Expense_ID, Date, Category, Item_Name, Amount, Remarks, Lead_By
- **Customers** – automatic rollup (tiers: VIP > ₹5,000, Regular > ₹2,000, else New)
- **Templates** – Key, Name, Type, Text (only edited/added messages)
- **Campaigns** – Campaign_ID, Name, Type, Text, Audience, Numbers, Created_At, Sent (JSON list of phones)
- **Script Properties** (not visible in the sheet): login, sessions, business settings, file records
- **Drive folder** "DRSP Orders – Files": menu photo/PDF, UPI QR, campaign photos

The script creates any missing tabs on its own (or run `setup` manually).

# 6. Code map

| Path | What it is |
|---|---|
| `apps-script/Code.gs` | Backend: setup, login, orders/expenses/prices/templates/campaigns, settings, Drive files, customers rollup, `resetPassword` |
| `public/config.json` | apiUrl + default business details (in-app Business details override) |
| `src/lib/api.js` | Backend calls, demo mode (`drsp` / `demo` when apiUrl is empty), optimistic updates |
| `src/lib/store.jsx` | Login, offline queue (+ keeps saved changes on screen until next pull), sync, settings |
| `src/lib/templates.js` | Built-in messages, placeholder filling |
| `src/lib/campaigns.js` | Campaign types, audiences, recipients |
| `src/lib/files.js` | Upload/download/cache/share of Drive files |
| `src/lib/utils.js` | Formatting, IDs, stages, grouping, UPI, CSV |
| `src/components/Messages.jsx` | Message picker sheet, attach button |
| `src/screens/` | Login, NewOrder, Orders, Send, Campaigns, Money (Dashboard + Expenses), More (+ Admin catalog), Kitchen |

# 7. Status (24 Nov 2026)

- ✅ Sheet + Apps Script deployed and connected; login works
- ✅ Order taking redesign, stage bar fix (no jump-back), small toast, campaigns with photo, Google review link, in-app file uploads
- ⏳ To do by Sasi:
  - Paste the **latest Code.gs** into Apps Script (keep your own `APP_USERNAME` / `APP_PASSWORD`), Save, then **Deploy → Manage deployments → Edit → New version → Deploy** — needed for campaigns and Business details
  - Upload menu photo, menu PDF, UPI QR in More → Menu & payment files
  - Add Google review link in More → Business details
  - Install on family phones; Kitchen Mode on Amma's phone
  - 2–3 test orders end to end, then delete them

# 8. Next ideas

- Connect Google Business Profile (reviews) to the app
- Separate WhatsApp Business number (safer for campaigns)
- DRSP website linked to the app / web orders into the sheet
- Log "menu sent" numbers to follow up non-buyers
- Telugu/Hindi labels in Kitchen Mode; printable packing slip; customer export

# 9. Troubleshooting

| Problem | Fix |
|---|---|
| "Missing tab …" | Run `setup` in Apps Script (or paste the latest Code.gs + new version — it auto-creates tabs) |
| Wrong username/password | Username not case-sensitive, password is |
| Forgot password | Apps Script: change `APP_PASSWORD`, Save, run `resetPassword` |
| Everyone logged out | Password was changed — use the new one |
| Upload fails | Re-run `setup` once to approve Drive permission; check "Who has access: Anyone" |
| New feature "UNKNOWN_ACTION" error | Code.gs not updated / not redeployed as **New version** |
| "n to save" for long | Phone offline; changes are kept and save later |
| App looks old | Tap the blue "App Update Available" bar, or reopen the app |
