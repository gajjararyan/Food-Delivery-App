# GharKaSwad mobile screenshots

Viewport: **390×844** @2x (iPhone 12–style mobile frame)

All PNGs are mobile-framed captures of the Expo web app (`npm run web`).

Generated: 2026-07-11

## Folder layout

| Folder | Role |
|--------|------|
| `auth/` | Welcome, login, OTP verify, signup |
| `customer/` | Discover, chef pages, thali builder, cart, checkout, orders, profile, legal, etc. |
| `chef/` | Kitchen overview, menu editor, incoming orders |
| `admin/` | Ops overview, applications, kitchens, all orders |

## auth

- [01-welcome.png](./auth/01-welcome.png)
- [02-login.png](./auth/02-login.png)
- [03-verify.png](./auth/03-verify.png)
- [04-signup.png](./auth/04-signup.png)

## customer

- [01-discover-home.png](./customer/01-discover-home.png)
- [01b-discover-scrolled.png](./customer/01b-discover-scrolled.png)
- [02-chef-detail.png](./customer/02-chef-detail.png) — Gujarati Cafe
- [02b-chef-detail-alt.png](./customer/02b-chef-detail-alt.png) — second kitchen
- [03-thali-builder.png](./customer/03-thali-builder.png)
- [03b-thali-builder-scrolled.png](./customer/03b-thali-builder-scrolled.png)
- [04-cart.png](./customer/04-cart.png)
- [05-checkout.png](./customer/05-checkout.png)
- [05b-checkout-scrolled.png](./customer/05b-checkout-scrolled.png)
- [06-orders.png](./customer/06-orders.png)
- `07-order-tracking.png` / `08-order-review.png` — not captured (no customer order id in session; place an order then re-run `node scripts/capture-tracking.mjs`)
- [09-subscription.png](./customer/09-subscription.png)
- [10-profile.png](./customer/10-profile.png)
- [10b-profile-scrolled.png](./customer/10b-profile-scrolled.png)
- [11-become-chef.png](./customer/11-become-chef.png)
- [12-dietary.png](./customer/12-dietary.png)
- [13-meal-calendar.png](./customer/13-meal-calendar.png)
- [14-pause-skip.png](./customer/14-pause-skip.png)
- [15-legal-hub.png](./customer/15-legal-hub.png) + per-policy detail shots `16`–`38`
- [31-delete-account.png](./customer/31-delete-account.png)
- [32-payment-failed.png](./customer/32-payment-failed.png)

## chef

- [01-overview.png](./chef/01-overview.png) — Anita’s Kitchen dashboard
- [01c-overview-scrolled.png](./chef/01c-overview-scrolled.png)
- [02-menu.png](./chef/02-menu.png) — kitchen profile + menu editor
- [02b-menu-scrolled.png](./chef/02b-menu-scrolled.png)
- [03-orders.png](./chef/03-orders.png) — incoming orders

## admin

- [01-overview.png](./admin/01-overview.png) — marketplace control
- [01c-overview-scrolled.png](./admin/01c-overview-scrolled.png)
- [02-applications.png](./admin/02-applications.png)
- [03-kitchens.png](./admin/03-kitchens.png) — all kitchens list
- [03b-kitchens-scrolled.png](./admin/03b-kitchens-scrolled.png)
- [04-orders.png](./admin/04-orders.png)
- [04b-orders-scrolled.png](./admin/04b-orders-scrolled.png)

## Notes

- Captured via Playwright mobile device profile (iPhone 12).
- Re-run: `node scripts/capture-mobile-screenshots.mjs` (full) or `node scripts/capture-remaining-screenshots.mjs`.
- Tracking / review screens need a customer order in session; none were present in local storage at capture time (admin shows marketplace orders separately).
