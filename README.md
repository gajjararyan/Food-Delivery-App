# GharKaSwad

Home-cooked thali marketplace — Phase 0–1 MVP (customer app + single kitchen).

> **Workspace:** runnable project at `C:\Users\DELL\Projects\Food-Delivery-App`.

## Stack

| Layer | Choice |
|-------|--------|
| Mobile | Expo (managed) + Expo Router + TypeScript strict |
| Backend | Express on Render free tier (OTP rate limit + Razorpay verify) |
| DB / Auth | Supabase free tier + RLS |
| Payments | Razorpay sandbox (signature verified server-side) |
| Maps | Google Maps (`react-native-maps` + Maps JavaScript API on web); simulated driver path until courier GPS is wired |
| Analytics | Soft Firebase Analytics facade (`lib/analytics.ts`) |
| Errors | Soft Sentry hooks (`lib/sentry.ts` + `lib/logger.ts`) |
| Email | Resend (transactional keys in `.env.example`) |

## Setup

```bash
cd C:\Users\DELL\Projects\Food-Delivery-App
cp .env.example .env
npm install --legacy-peer-deps
# Optional API (OTP proxy + payments):
cd backend && npm install && cd ..
npm start
```

Apply Supabase SQL in order from `supabase/migrations/` (see `supabase/README.md`), then seed Nani Geeta.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Expo dev server |
| `npm run api:dev` | Express API on `:3001` (OTP + payments) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest (`pricing`, `jain`, `credits`, `phone`, …) |

## Environment variables

Copy `.env.example` → `.env`. Never commit `.env` or `.cursor/mcp.json`.

**Minimum for browse:** none (seed catalog fallback).  
**For OTP:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` + Phone Auth/SMS.  
**For OTP rate limit:** `EXPO_PUBLIC_API_URL=http://localhost:3001` + `npm run api:dev`.  
**For real Razorpay:** `EXPO_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, API URL.  
Without Razorpay secrets, checkout uses **sandbox confirm** (marks `payment_pending` → `placed` with double-charge guard).

Set `ALLOW_SANDBOX_CONFIRM=true` if you need sandbox confirm even when Razorpay keys are present.

## Happy path

1. Welcome → Login → OTP verify  
2. Discover → Nani Geeta → Customize thali → Cart  
3. Checkout (auth required) → sandbox/Razorpay → Tracking  
4. Orders · Subscription (credits + pause/skip) · Profile (Jain + become-chef)

## Stitch design source

Project: **GharKaSwad Marketplace** (`11845391070777637560`)  
Design system: **Artisanal Kitchen** (Literata + Plus Jakarta Sans)

Screens are referenced in file comments as `Stitch: <title> (<id>)`. HTML snapshots under `.stitch/designs/`.

## Known limitations (not bugs)

- Render free-tier API cold starts (~30–60s)
- No live GPS — order **status steps** only
- Chef / delivery / admin apps are **stubs**
- Single seeded kitchen: Nani Geeta
- Expo Go: no native Razorpay Checkout UI — use sandbox confirm; wire `react-native-razorpay` in a custom/dev client when ready
- Deferred: referrals, AI meal planner, dark mode, multi-language, courier APIs
- `sentry-expo` / Firebase native SDKs are optional — soft-wired; install when EAS credentials exist

## Build order progress

1. ✅ Expo scaffold, routes, theme, UI primitives, pricing tests  
2. ✅ Supabase migrations + RLS + seed (Nani Geeta)  
3. ✅ Auth OTP + session + profile bootstrap  
4. ✅ Discovery → Chef → Thali Builder → Cart  
5. ✅ Checkout / Razorpay create+verify+webhook + payment-failed + pending-order guard  
6. ✅ Subscriptions, meal calendar, pause/skip, credit balance  
7. ✅ Order history, tracking (status steps), rate & review  
8. ✅ Profile, dietary Jain persistence, become-chef → `chef_applications`  
9. ✅ Loading / empty / error states on fetch screens  
10. ✅ Sentry + Analytics soft wiring  
11. ✅ README + env docs final pass  
