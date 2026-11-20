# MASTER PROMPT — PujaJunction.com: Full Backend + Frontend + User System

(Is prompt ke saath apni HTML file `fix_recent_box_layering_in_search_dropdown.html` attach karein.)

---

## 1. ROLE & GOAL

You are a senior full-stack engineer. I have attached a single-file frontend (`index.html`, ~3600 lines, Tailwind CDN, vanilla JS, Hindi UI) for **PujaJunction.com** — a marketplace for Hindu puja kits (pooja boxes), pandit booking, murti/photo frames, and seva-dakshina (donation) with UPI.

Right now **everything is fake/in-memory**: products live in the `listingsData` JS array, orders in `bookingsHistory`, cart in `cart`, reviews pushed into arrays, vendor panel only changes local state, and there is **no login, no database, no server**. A page refresh loses everything.

**Your job:** convert this into a complete, production-ready web application with a real backend, real database, real user accounts, and a fully wired frontend — without changing the existing look, Hindi text, layout, or UX that already works.

**Must-have login system:**
1. **Sign in / Sign up with Google (Gmail)** — Google OAuth 2.0 / Google Identity Services.
2. **Sign up / Sign in with Email + Password** (own registration system, with email verification and forgot/reset password).

---

## 2. WHAT ALREADY EXISTS IN THE ATTACHED FILE (read it fully first)

**Data structures (move all to database):**
- `CONFIG` → `{ whatsappNumber, upiId, payeeName }` (move to `.env` / settings table)
- `listingsData[]` → fields: `id, category ('pooja_box' | 'pandit' | 'murti'), poojaTag, masterCategories[], tags[], title, image, vendor, location, rating, deliveryTime, isGlobal, expanded, subscriptionEnabled, subscriptionCycle, description, reviews[{author, rating, comment}], basePrice, simpleQty`, plus category-specific: `items[{name, unit, price, qty, checked}]` (kits), `pujaTypes[]` (pandit), `sizes[]` (murti/photo)
- `masterDirectoryData[]` → 17 puja master categories (cat01–cat17)
- `bilingualSearchAliases` → Hindi/English search synonyms
- `bookingsHistory[]` → `{id, type, title, vendor, amount, statusStep 0–3, date, details}`
- Promo codes in `calculatePromoDiscount()` (e.g. `GANESH10`, `PUJA51`)

**Existing functions that must become API-backed** (keep names where possible):
`applyFilters, loadMoreListings, handleMasterSearchInput, renderMasterSearchDropdown, saveRecentSearch, addBoxToCart, addPanditToCart, addVariantToCart, removeFromCart, updateCartUI, applyCartPromo, calculatePromoDiscount, submitFinalOrder, openDirectBoxOrder, applyDirectPromo, submitDirectOrder, shareCartOnWhatsApp, shareDirectOrderWhatsApp, toggleBoxSubscription, changeBoxSubscriptionCycle, submitCustomPujaList, handleCustomListFileChange, generateDonationReceipt, refreshDonationUPI, recordBookingHistory, renderTrackingOrders, openReviewsModal, submitCustomerReview, openVendorDashboardModal, renderVendorOrdersPanel, advanceVendorOrderStep, handleAddVendor, initPanchangStrip, bookInShubhMuhurat, startVoiceSearch`

**Existing modals/sections to keep:** voiceSearchModal, pujaDetailModal, customListModal, vendorDashboardModal, reviewsModal, trackingModal, cart drawer, directOrderModal, receiptModal (seva dakshina), orderSuccessModal, toast, Panchang strip, 17-category master directory, donation section with UPI QR.

---

## 3. TECH STACK (shared-hosting friendly — cPanel/Hostinger compatible)

- **Backend:** PHP 8.1+ (no heavy framework; clean MVC-style structure, PDO prepared statements, Composer allowed for `google/apiclient`, `phpmailer/phpmailer`, `vlucas/phpdotenv`)
- **Database:** MySQL / MariaDB (utf8mb4 — Hindi text must work)
- **Frontend:** keep the existing HTML + Tailwind + vanilla JS. Split inline JS into modules (`/assets/js/api.js`, `auth.js`, `cart.js`, `search.js`, `orders.js`, `vendor.js`, `admin.js`...) and load as `<script type="module">` or plain scripts.
- **Clean URLs** via `.htaccess` (`/api/...`, `/account`, `/product/{slug}`).
- If you think Node.js/Express is better, you may propose it, but default to PHP + MySQL unless I say otherwise.

**Project structure (deliver exactly this or better):**
```
/public_html
  index.html (or index.php)
  /assets/css, /assets/js, /assets/img
  /uploads (vendor images, custom puja lists — protected, validated)
  /api/index.php  (router)
  .htaccess
/app
  /Controllers  /Models  /Middleware  /Services  /Helpers
  /config  (config.php reads .env)
/database
  schema.sql  seed.sql  (seed = all current listingsData, masterDirectoryData, promos)
/.env.example
README.md  (setup, cPanel deploy steps, Google Console steps, SMTP steps)
```

---

## 4. DATABASE SCHEMA (create full `schema.sql` with indexes & foreign keys)

Tables (at minimum):
- `users` (id, name, email UNIQUE, email_verified_at, password_hash NULLABLE, google_id UNIQUE NULLABLE, avatar_url, phone, role ENUM('customer','vendor','admin'), status ENUM('active','blocked'), last_login_at, created_at, updated_at)
- `auth_providers` (user_id, provider, provider_user_id) — so one account can have both Google and password
- `email_verifications` (user_id, token_hash, expires_at)
- `password_resets` (user_id, token_hash, expires_at, used_at)
- `login_attempts` (ip, email, attempted_at, success) — for rate limiting
- `sessions` or secure PHP session / JWT refresh table (your choice, justify it)
- `addresses` (user_id, label, name, phone, address_line, city, pincode, state, is_default)
- `vendors` (id, user_id, shop_name, location, phone, description, is_verified, status, created_at)
- `master_categories` (id like 'cat01', title_hi, title_en, icon)
- `listings` (id, vendor_id, category, pooja_tag, slug, title, image, location, rating_avg, rating_count, delivery_time, is_global, description, base_price, subscription_enabled, subscription_cycle, status, created_at)
- `listing_master_categories` (listing_id, master_category_id)
- `listing_tags` (listing_id, tag)
- `listing_items` (listing_id, name, unit, price, default_qty, is_default_checked) — kit items
- `listing_variants` (listing_id, type ENUM('pooja_type','size'), label, price)
- `search_aliases` (group_key, term)
- `recent_searches` (user_id/session_id, query, created_at)
- `cart_items` (user_id, listing_id, selected_items JSON, variant_id, qty, notes) — server-side cart for logged-in users; guest cart in localStorage, **merged on login**
- `orders` (id like 'GB-xxxx', user_id, type, subtotal, discount, total, promo_code, payment_method, payment_status, status_step 0–3, address_snapshot JSON, customer_name, phone, notes, created_at)
- `order_items` (order_id, listing_id, vendor_id, title_snapshot, details_snapshot, price, qty)
- `order_status_history` (order_id, step, changed_by, created_at)
- `pandit_bookings` (order_id, listing_id, date, muhurat, location, puja_type, status)
- `subscriptions` (user_id, listing_id, cycle, next_delivery_date, status)
- `custom_puja_lists` (user_id, file_path, manual_items JSON, status, quoted_price, created_at)
- `reviews` (listing_id, user_id, order_id, rating, comment, status, created_at) — one review per user per listing
- `promo_codes` (code, type percent/flat, value, min_order, max_discount, valid_from, valid_to, usage_limit, used_count, is_active)
- `donations` (id, user_id NULLABLE, donor_name, cause, amount, upi_txn_ref, receipt_no, status, created_at)
- `wishlist` (user_id, listing_id)
- `notifications` (user_id, title, body, is_read, created_at)
- `settings` (key, value) — whatsapp number, UPI ID, payee name, site name

---

## 5. AUTHENTICATION SYSTEM (most important — build it carefully)

### 5.1 Email + Password
- **Register:** name, email, phone (optional), password (min 8 chars, 1 letter + 1 number), confirm password. Hash with `password_hash(PASSWORD_ARGON2ID)` (or bcrypt cost 12).
- **Email verification:** send a verification link (token stored hashed, expires in 24h). Unverified users can browse but cannot place orders/reviews until verified (show a banner with "Resend verification email").
- **Login:** email + password, "Remember me" option, generic error message ("Email या password गलत है") to avoid user enumeration.
- **Forgot password / Reset password:** emailed one-time token (expires in 1 hour, single-use), set new password, invalidate old sessions.
- **Change password** (inside account page, requires current password).
- **Rate limiting:** max 5 failed logins per 15 min per IP+email; temporary lockout; optional CAPTCHA (Google reCAPTCHA v3 or Cloudflare Turnstile) on register/login/forgot.
- **Email sending:** PHPMailer + SMTP (config in `.env`), HTML email templates in Hindi + English (welcome, verify email, reset password, order confirmation, order status update).

### 5.2 Google (Gmail) Login — "Continue with Google"
- Use **Google Identity Services** button on the frontend → receive ID token (credential) → send to `POST /api/auth/google` → **verify the ID token server-side** with Google's library (check `aud` = our Client ID, `iss`, `exp`, `email_verified`).
- **Logic:**
  1. If `google_id` already exists → log in.
  2. Else if a user with the same verified email exists → **link** Google to that account (add `google_id`), log in.
  3. Else → create a new user (email_verified = now, password_hash = NULL, avatar from Google), log in.
- Users who signed up with Google can later **set a password** from the account page ("Set password"), and users with password can **link/unlink Google**.
- Never trust the frontend-sent email/name — only use verified token claims.
- Provide exact steps in README to create the OAuth Client in Google Cloud Console (authorized JS origins, consent screen, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`).

### 5.3 Session & security
- Secure session cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, session ID regeneration on login, idle + absolute timeout. (If JWT is used, use short-lived access token + refresh token in HttpOnly cookie.)
- **CSRF protection** on all state-changing requests.
- Roles & middleware: `requireAuth`, `requireRole('vendor')`, `requireRole('admin')`, `requireVerifiedEmail`.
- Logout + "logout from all devices".
- Input validation & sanitization on every endpoint, output escaping (fix XSS: current code injects `r.comment`, `title`, etc. via `innerHTML` — all user-generated content must be escaped).
- Security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy), CORS locked to our domain, HTTPS redirect in `.htaccess`.
- File upload security (see §8).

### 5.4 Auth UI (new, matching current design: red/saffron, Hindi labels)
- Navbar: **"लॉगिन / साइन अप"** button when logged out; **avatar + dropdown** (मेरा खाता, मेरी बुकिंग्स, मेरी लिस्ट/Wishlist, वेंडर पैनल (if vendor), एडमिन (if admin), लॉगआउट) when logged in.
- One **Auth modal** with tabs: लॉगिन | नया खाता बनाएं. Contains "Continue with Google" button, email/password fields, show/hide password, "पासवर्ड भूल गए?" link, loading states, inline validation errors in Hindi.
- Pages/modals: verify-email result page, forgot password form, reset password page.
- Login gating: guests can browse + add to cart; at checkout/booking/review/subscription they get the auth modal, and after login the **pending action continues automatically**.

---

## 6. USER FUNCTIONS (customer side) — all must work end-to-end

1. **Account page** (`/account`): profile edit (name, phone, avatar), change/set password, linked Google status, delete account (with confirmation).
2. **Address book:** add/edit/delete/set default; auto-fill in cart and direct-order forms (`custPhone`, `doName`, `doPhone`, `doAddress`, `doPincode`).
3. **Browse & search:** server-side filtering by category, pooja tag, master category (17), price range, location, rating; pagination/"Load more"; **Hindi/English bilingual search** using `search_aliases`; autocomplete dropdown with suggestions, product/category matches; **recent searches saved per user** (and per guest in localStorage); popular searches. Keep the dropdown layering fix from the file name (recent box must not overlap/hide behind other elements — z-index correct).
4. **Product detail modal:** kit items with checkbox + qty (price recalculated), pandit puja type + area, murti size/variant, subscription toggle with cycle.
5. **Cart:** persisted server-side for logged-in users, localStorage for guests, merge on login; quantity edit, remove, promo code apply (server-validated), totals.
6. **Checkout / Direct order:** address selection, notes, payment method (UPI QR/UPI intent, Cash on Delivery for kits, optional Razorpay/PhonePe gateway — implement Razorpay with webhook verification as an optional switch in `.env`), order creation with **server-calculated prices** (never trust client prices), order confirmation email + WhatsApp share link, success modal with order ID.
7. **Pandit booking:** choose pandit, puja type, date + muhurat (`bookInShubhMuhurat`), location, confirm; vendor/pandit gets notified; user can reschedule/cancel (with rules).
8. **My Bookings & Orders (`openTrackingModal`):** real list from DB, 4-step tracker (ऑर्डर प्राप्त → पैकिंग → डिस्पैच → पूर्ण), cancel order (before dispatch), reorder button, invoice/receipt download (printable PDF).
9. **Subscriptions:** monthly/Purnima kit subscriptions — create, pause, resume, cancel, next-delivery date; cron job creates recurring orders and sends reminders.
10. **Custom puja list upload (`customListModal`):** upload image/PDF/Excel or enter items manually → stored → admin/vendor sends a quote → user accepts → converts to order.
11. **Reviews & ratings:** only users who purchased/booked the item (verified buyer) can review, one per item, edit/delete own review, average rating auto-recalculated in DB, optional admin moderation.
12. **Wishlist / Saved items.**
13. **Seva Dakshina / Donation:** dynamic UPI QR (using UPI ID from settings), donor name, cause, amount; save donation record, generate **receipt with unique receipt number**, downloadable/printable, WhatsApp share, email receipt for logged-in users; user's donation history in account page.
14. **Notifications:** in-app bell + email for order updates.
15. **Panchang strip:** keep as is; if possible fetch daily tithi/muhurat from a free API or an admin-editable table with caching.
16. **Voice search:** keep (Web Speech API, hi-IN).

---

## 7. VENDOR PANEL (role = vendor) — replace the fake `vendorDashboardModal`

- Vendor registration/application (shop name, location, phone, documents) → admin approval.
- Vendor dashboard: **only their own** orders/bookings; change order status step-by-step (with status history + customer notification); earnings summary; commission display.
- Add/edit/delete/pause listings (kit with items & prices, pandit with puja types & areas, murti with sizes), upload images (validated), set availability.
- Respond to reviews (optional), view custom list requests and send quotes.

## 8. ADMIN PANEL (role = admin) — `/admin`

- Dashboard: orders, revenue, users, vendors, donations (charts optional).
- Manage users (block/unblock, change role), vendors (approve/reject), listings (approve/feature/remove), orders (all, filter, refund/cancel), reviews (moderate), promo codes (create/edit/limit), master categories, search aliases, site settings (WhatsApp, UPI, payee name), donation records, custom list requests.
- CSV export for orders/users/donations.
- Activity/audit log for admin actions.

---

## 9. REST API (document all in README, JSON, consistent `{success, data, error}` format)

Auth: `POST /api/auth/register`, `/login`, `/logout`, `/google`, `/verify-email`, `/resend-verification`, `/forgot-password`, `/reset-password`, `/change-password`, `GET /api/auth/me`
Catalog: `GET /api/listings` (filters/pagination/search), `GET /api/listings/{id}`, `GET /api/categories`, `GET /api/search/suggest?q=`, `GET/POST /api/recent-searches`
Cart & orders: `GET/POST/PATCH/DELETE /api/cart`, `POST /api/promo/validate`, `POST /api/orders`, `GET /api/orders`, `GET /api/orders/{id}`, `POST /api/orders/{id}/cancel`
Bookings: `POST /api/bookings/pandit`, `PATCH /api/bookings/{id}`
Subscriptions: `GET/POST/PATCH /api/subscriptions`
Custom lists: `POST /api/custom-lists` (multipart)
Reviews: `GET/POST/PATCH/DELETE /api/listings/{id}/reviews`
Account: `GET/PATCH /api/me`, addresses CRUD, wishlist CRUD, notifications
Donations: `POST /api/donations`, `GET /api/donations/{id}/receipt`
Vendor: `/api/vendor/...` (listings CRUD, orders, status update, stats)
Admin: `/api/admin/...`
Payments: `POST /api/payments/create`, `POST /api/payments/webhook`

---

## 10. FRONTEND WIRING RULES

- Replace every in-memory array operation with API calls (`fetch` wrapper in `api.js` with CSRF token, error handling, loading spinners, Hindi toast messages via existing `showToast`).
- Remove hard-coded `listingsData`, `bookingsHistory` and the demo "2" in `ordersBadge`; badge shows real count.
- Keep all existing Tailwind classes, colors (`abhiRed`, `saffron`, `cream`), fonts (Noto Sans Devanagari/Hind), responsive behavior, print CSS for receipts.
- Handle empty states, loading skeletons, network errors, expired sessions (auto-open login modal).
- SEO: proper `<title>/<meta>`, Open Graph, `sitemap.xml`, `robots.txt`, schema.org Product/LocalBusiness JSON-LD, server-rendered or pre-rendered product pages (`/product/{slug}`) if feasible.
- Accessibility: labels, focus trap in modals, ESC to close, keyboard navigation for the search dropdown (already partly present).

## 11. NON-FUNCTIONAL REQUIREMENTS

- Server-side price calculation & promo validation; never trust client totals.
- Transactions for order creation; idempotency for payment webhooks.
- Pagination on all lists; DB indexes on search/filter columns; basic caching for catalog.
- Logging (errors to file, no sensitive data), `.env` for all secrets, nothing hard-coded.
- GDPR/Indian DPDP-friendly: privacy policy + terms pages, cookie notice, account deletion/export.
- Cron jobs documented (subscriptions, cleanup of expired tokens, reminder emails).

## 12. DELIVERABLES & OUTPUT FORMAT

1. Full project tree first.
2. Then **complete code, file by file** — no "...", no placeholders, no "add your code here". Every file must be copy-paste ready.
3. `schema.sql` + `seed.sql` (convert ALL current 19+ listings, 17 master categories, search aliases, promo codes GANESH10 & PUJA51, demo admin user with a one-time password change forced).
4. `.env.example` with every variable (DB, SMTP, GOOGLE_CLIENT_ID/SECRET, RAZORPAY keys, APP_URL, SESSION secret, WhatsApp, UPI).
5. `README.md`: local setup, cPanel deployment, Google OAuth setup, SMTP setup, cron setup, testing guide.
6. Final **testing checklist**: register → verify email → login → forgot/reset → Google login (new + existing email) → add to cart as guest → login & cart merge → checkout → order tracking → vendor status update → review → donation receipt → admin actions.
7. If the response is too long for one message, deliver in numbered parts (Part 1: DB + auth backend, Part 2: catalog/cart/orders APIs, Part 3: frontend modules, Part 4: vendor/admin, Part 5: README) and **wait for me to say "next"** — do not skip or summarize any part.

Start with Part 1 now. Before coding, list any assumptions or questions in max 5 bullet points, then proceed.
