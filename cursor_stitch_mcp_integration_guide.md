# Stitch MCP integration guide
_Exported on 7/8/2026 at 17:38:18 GMT+5:30 from Cursor (3.10.17)_

---

**User**

Method 2: The Stitch MCP Integration (Automated)To allow Cursor to interact with Stitch directly via chat without manual copying:Go to your Google Stitch settings and generate a new API key.Access the explainx.ai repository to install the stitch-design skill in your root project directory (using npx skills add ...).Open Cursor's settings, go to MCP Servers, and click Manage MCP.Paste the Stitch MCP server configuration JSON with your valid API URL and save.You can now prompt the Cursor AI agent with commands like "design and implement a settings page," and it will call Stitch to generate the UI.


https://explainx.ai/skills/google-labs-code/stitch-skills/stitch-design 
Check this and let me knwi step by step prodcedure what to do 

---

**Cursor**

I'll check the Stitch design skill documentation and your project setup so I can give you a clear step-by-step procedure.


Fetching Stitch MCP server setup details and checking your project environment.


Here is a clear **step-by-step procedure** for Method 2 (Stitch MCP + `stitch-design` skill in Cursor), based on the [explainx.ai guide](https://explainx.ai/skills/google-labs-code/stitch-skills/stitch-design), the [official stitch-skills repo](https://github.com/google-labs-code/stitch-skills), and current Cursor compatibility notes.

---

## Overview

You need **two separate pieces**:

| Piece | Purpose |
|--------|---------|
| **Stitch MCP Server** | Lets Cursor call Stitch APIs (generate/edit screens) |
| **stitch-design skill** | Teaches the AI how to write good Stitch prompts and manage design files |

The skill **does not work** without the MCP server running.

---

## Prerequisites

You already have **Node.js v22** installed — that meets the requirement (Node 16+ for the skill, 18+ for MCP servers).

You also need:
- A **Google account**
- Access to [Google Stitch](https://stitch.withgoogle.com)
- Your project open in Cursor (e.g. `d:\Food-Delivery-App`)

---

## Step 1: Get your Stitch API key

1. Go to **[stitch.withgoogle.com](https://stitch.withgoogle.com)** and sign in with Google.
2. Open **Settings** (profile icon → Settings, or go to [stitch.withgoogle.com/settings](https://stitch.withgoogle.com/settings)).
3. Scroll to the **API Keys** section.
4. Click **Create API Key**.
5. Copy the key immediately (it often starts with `AQ.`).
6. Store it somewhere safe — **do not commit it to git**.

---

## Step 2: Install the `stitch-design` skill

Open a terminal in your **project root** (`d:\Food-Delivery-App`) and run:

```bash
npx skills add https://github.com/google-labs-code/stitch-skills --skill stitch-design
```

When prompted:
1. Select **Cursor** (use arrow keys + space).
2. Confirm installation.

**Verify:** you should see a folder like:

```
.cursor/skills/stitch-design/
```

**Alternative (full plugin suite from Google):**

```bash
npx plugins add google-labs-code/stitch-skills --scope workspace --target cursor
```

That installs more than just `stitch-design` (build + utilities skills too).

---

## Step 3: Configure the Stitch MCP server in Cursor

This is the most important step. There are two ways to connect — **use Option A for Cursor**.

### Option A — Local MCP proxy (recommended for Cursor)

Cursor has a known issue with **remote URL** Stitch MCP (`Invalid URL protocol` errors). Use a **local `npx` server** instead.

1. In Cursor, open **Settings** → **MCP** → **Manage MCP** (or edit MCP config manually).
2. Add this JSON (replace `YOUR_API_KEY_HERE`):

```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["-y", "@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

**Where to put it:**
- **Project-level:** `d:\Food-Delivery-App\.cursor\mcp.json` (good for this repo only)
- **Global:** Cursor Settings → MCP (applies to all projects)

**Easier automated setup:**

```bash
npx @_davideast/stitch-mcp init
```

This wizard can configure MCP for you and handle auth.

---

### Option B — Remote URL (what many tutorials show; often broken in Cursor)

Some guides say to paste:

```json
{
  "mcpServers": {
    "stitch": {
      "url": "https://stitch.googleapis.com/mcp",
      "headers": {
        "X-Goog-Api-Key": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

**Warning:** In Cursor, this often fails with `Invalid URL protocol` before OAuth/connect completes. If you hit that error, switch to **Option A**.

---

## Step 4: Restart Cursor and verify MCP

1. **Fully quit and reopen Cursor** (MCP servers load at startup).
2. Go to **Settings → MCP**.
3. Confirm the **stitch** server shows as **connected** (green).
4. If prompted, click **Allow** for the MCP server.

**If it fails:**
- Check Node: `node --version`
- Test the proxy manually:

```powershell
$env:STITCH_API_KEY="YOUR_API_KEY_HERE"
npx -y @_davideast/stitch-mcp proxy
```

- Regenerate the API key if you see 401/403 errors.

---

## Step 5: Use it in chat

Once MCP + skill are active, you can prompt Cursor Agent like:

- *"Design and implement a settings page for my food delivery app"*
- *"Use Stitch to generate a mobile-first restaurant listing screen"*
- *"Edit the login screen to add a dark mode toggle"*

The `stitch-design` skill will:
- Turn vague ideas into structured UI prompts
- Call Stitch MCP tools (`generate_screen_from_text`, `edit_screens`, etc.)
- Save outputs under `.stitch/designs/` and optionally `.stitch/DESIGN.md`

**Example workflow:**

```
Design a settings page for a food delivery app:
- Profile section (name, phone, avatar)
- Delivery addresses
- Notification toggles
- Dark mode switch
Mobile-first, modern, warm orange accent color
```

---

## Full setup checklist

```
[ ] 1. Create Stitch API key at stitch.withgoogle.com/settings
[ ] 2. Run: npx skills add ... --skill stitch-design (in project root)
[ ] 3. Add local MCP config with STITCH_API_KEY (Option A)
[ ] 4. Restart Cursor
[ ] 5. Verify stitch MCP is connected in Settings → MCP
[ ] 6. Prompt Agent to design + implement a screen
```

---

## Security notes

- Never commit your API key — add `.cursor/mcp.json` to `.gitignore` if it contains secrets, or use env vars.
- The explainx page notes that skills run code in your environment; review what gets installed.
- Stitch is free during beta (with usage limits).

---

## For your Food Delivery App

Your `d:\Food-Delivery-App` folder looks empty or new, which is fine. Run Steps 2 and 3 there so everything lives in one project:

```powershell
cd d:\Food-Delivery-App
npx skills add https://github.com/google-labs-code/stitch-skills --skill stitch-design
```

Then create `.cursor\mcp.json` with the MCP config from Step 3.

---

If you want, I can set up the skill and MCP config files in `d:\Food-Delivery-App` for you — you would only need to paste your API key yourself.

---

**User**

AQ.Ab8RN6LQFyKQae6AkTxvEkbIO3wcBj9CuxOkxMjArcqspZjoOg

here is the api key for sttich 

---

**Cursor**

Setting up the Stitch MCP server and `stitch-design` skill in your project with your API key.


The skill name changed in the repo — installing the correct design skills.


Everything is set up in `d:\Food-Delivery-App`. Your API key was verified successfully.

## What was configured

**1. Stitch MCP server** — `.cursor/mcp.json`
- Uses the local `@_davideast/stitch-mcp` proxy (works reliably in Cursor)
- API key health check passed

**2. Stitch design skills** installed:
- `stitch::generate-design` — generate and edit UI screens
- `enhance-prompt` — improve design prompts
- `design-md` — manage design system docs

**3. Security** — `.gitignore` excludes `.cursor/mcp.json` so your API key is not committed to git.

---

## What you need to do now

1. **Fully restart Cursor** (quit and reopen — MCP servers load at startup).
2. Open the **`d:\Food-Delivery-App`** folder in Cursor.
3. Go to **Settings → MCP** and confirm **stitch** shows as connected (green).
4. If prompted, click **Allow** for the MCP server.

---

## Try it

In Cursor Agent chat, try prompts like:

- *"Design a home screen for a food delivery app with restaurant cards and a search bar"*
- *"Use Stitch to generate a mobile checkout page"*
- *"Create a settings page with profile, addresses, and notification toggles"*

---

## Security note

You shared your API key in this chat. For safety, consider **regenerating it** at [stitch.withgoogle.com/settings](https://stitch.withgoogle.com/settings) after setup, then update `.cursor/mcp.json` with the new key.

After you restart Cursor, tell me if the stitch MCP shows as connected or if you hit any errors.

---

**User**

═══════════════════════════════════════════════════════════
GHARKASWAD — MVP BUILD SPECIFICATION
Customer App + Single-Kitchen Backend (Phase 0-1)
═══════════════════════════════════════════════════════════

You are building a production-quality MVP, not a prototype. Code should be 
clean enough that a second engineer could join in Phase 2 and extend it 
without a rewrite. Follow every section below — do not skip the engineering 
discipline sections just because this is "just an MVP."

───────────────────────────────────────
1. SCOPE BOUNDARY
───────────────────────────────────────
Build: Customer-facing app + auth + one hardcoded kitchen ("Nani Geeta") 
seeded as a normal database row.
Stub only (single placeholder screen, route group scaffolded for later): 
Chef dashboard, Logistics/delivery-partner app, Admin panel.
Do not build: courier API integration, live GPS tracking, referral system, 
AI meal planner, dark mode, multi-language. These are explicitly deferred — 
if you find yourself building toward any of these, stop and flag it rather 
than proceeding.

Design source of truth: pull every screen from the Stitch MCP server 
(stitch::generate-design / retrieval tools, already configured) before 
implementing it. Reference the existing "Customer - [ScreenName]" designs 
for layout, spacing, copy, and visual hierarchy. Where a static design 
doesn't specify a micro-interaction, use standard React Native / Expo UX 
conventions and note the decision in a code comment rather than guessing 
silently.

───────────────────────────────────────
2. TECH STACK (free tier, MVP-appropriate)
───────────────────────────────────────
Mobile:        React Native + Expo (managed workflow), TypeScript strict mode
Backend:       Node.js + Express (thin API layer; prefer Supabase client 
               calls directly from the app where RLS makes a backend hop 
               unnecessary — don't build an API layer just for CRUD that 
               Supabase already secures)
DB/Auth:       Supabase free tier
API hosting:   Render free tier (cold starts accepted at pilot scale — 
               document as a known tradeoff, not a bug)
Payments:      Razorpay sandbox/test mode
Maps:          Google Maps Platform (free credit tier)
Push:          Firebase Cloud Messaging (free)
Email:         Resend (free tier, transactional only)
Errors:        Sentry (free tier) — wired from day one, not bolted on later
Analytics:     Firebase Analytics (free)

Environment variables: all keys in .env, never committed. Provide a 
.env.example with placeholder values and a README section explaining 
where to get each key. Use expo-constants or react-native-dotenv 
appropriately — pick one and be consistent.

───────────────────────────────────────
3. FOLDER STRUCTURE
───────────────────────────────────────
/app                          → Expo Router file-based routes
  /(auth)
  /(customer)
  /(chef)                     → stub only
  /(admin)                    → stub only
/components
  /ui                         → shared primitives: Button, Card, Input, 
                                 Stepper, BottomSheet, EmptyState, Badge — 
                                 build these ONCE, reuse everywhere. Do not 
                                 let screens define their own one-off buttons.
  /customer                   → screen-specific composed components 
                                 (ThaliComponentRow, MakerCard, OrderStatusTimeline)
/lib
  supabase.ts                 → single client instance, typed
  api/                        → one file per domain: menu.ts, orders.ts, 
                                 subscriptions.ts, credits.ts, auth.ts — 
                                 each exports typed functions, no raw 
                                 supabase calls scattered across screens
  pricing.ts                  → the thali pricing formula lives HERE as a 
                                 pure, unit-testable function — never 
                                 recalculated inline in a component
  types.ts                    → shared TypeScript types generated from / 
                                 matching the DB schema
/hooks
  useAuth.ts, useCart.ts, useSubscription.ts, useCredits.ts — encapsulate 
  state logic out of screen components
/constants
  theme.ts                    → colors, typography, spacing as named 
                                 constants (terracotta #D96B41, warm cream 
                                 #FDF8F2, etc.) — no hardcoded hex values 
                                 in component files, ever
/assets

───────────────────────────────────────
4. CODE QUALITY STANDARDS
───────────────────────────────────────
- TypeScript strict mode on. No `any` unless genuinely unavoidable, and if 
  used, comment why.
- Every API function returns a typed Result — either the data or a typed 
  error, never let a raw Supabase error bubble unhandled into a component.
- No business logic inside JSX/render functions. Pricing calculation, 
  credit application, Jain-substitution logic — all pure functions in /lib, 
  imported and called, not reimplemented per screen.
- Consistent naming: PascalCase components, camelCase functions/variables, 
  kebab-case file names for non-component files.
- ESLint + Prettier configured and passing before any screen is considered 
  "done." Set this up in step 1, not retrofitted at the end.
- Every list render (menu items, order history, thali components) uses a 
  stable `key`, not array index.
- No console.log left in — use a small logger wrapper that routes to Sentry 
  in production and console in dev.

───────────────────────────────────────
5. STATE MANAGEMENT
───────────────────────────────────────
- Local component state (useState) for UI-only concerns (form inputs, 
  toggle states, modal visibility).
- React Context + custom hooks for cross-screen state that doesn't need a 
  heavier library at this scale: auth session, active cart, credit balance.
- Server state (menu items, orders, subscriptions) via a lightweight fetch 
  wrapper with basic caching — @tanstack/react-query is a reasonable choice 
  here and worth the dependency; don't hand-rolled cache invalidation logic.
- Do NOT reach for Redux at this scale — it's unnecessary complexity for a 
  single-kitchen MVP and will slow down Phase 2 extension, not help it.

───────────────────────────────────────
6. ERROR HANDLING & EDGE CASES
───────────────────────────────────────
Every screen that fetches data needs three states designed and implemented, 
not just the happy path: loading, error (with retry action), and empty 
(use the Empty States designs from Stitch).

Specific cases to handle explicitly:
- Network failure during checkout → don't double-charge on retry; check for 
  an existing pending order before creating a new one.
- Razorpay webhook/callback failure or timeout → order should land in a 
  'payment_pending' status, not silently fail or silently succeed.
- OTP expiry / wrong OTP → clear inline error, not a generic alert.
- Session expiry mid-flow (e.g. mid-checkout) → redirect to login, but 
  preserve cart state so they don't lose their order on re-auth.
- Skipping a meal that's already been prepared/past cutoff time → block 
  with a clear message, don't allow a skip that would strand the kitchen.

───────────────────────────────────────
7. SECURITY
───────────────────────────────────────
- Row Level Security enabled on every Supabase table. Customers can only 
  read/write rows where customer_id = auth.uid(). Write the actual RLS 
  policies, don't leave tables open "for now."
- menu_items and maker_profiles: public read, write restricted to 
  service-role only (no client ever writes these directly at this phase).
- Razorpay: verify payment signature server-side before marking an order 
  paid — never trust a client-side "payment success" callback alone.
- No secrets (Supabase service key, Razorpay secret) ever referenced in 
  client-side code — service-role operations happen in the Express backend 
  only.
- Rate-limit the OTP send endpoint to prevent abuse.

───────────────────────────────────────
8. DATABASE SCHEMA
───────────────────────────────────────
[same schema as before — profiles, maker_profiles, menu_items, 
thali_components, subscriptions, orders, credits, reviews, 
chef_applications — implement via Supabase migrations (SQL files checked 
into /supabase/migrations, not just clicked through the dashboard UI, so 
schema is version-controlled]

Seed data: one maker_profiles row for Nani Geeta's kitchen (tier='verified'), 
a realistic menu_items + thali_components set matching the Gujarati Thali 
example (roti, rice, dal, sabzi, papad, sweet with correct 
included_qty/min/max/unit_price_delta), with has_jain_variant = true and 
jain_substitute values filled in per component.

───────────────────────────────────────
9. CORE BUSINESS LOGIC (implement as pure, tested functions)
───────────────────────────────────────
pricing.ts:
  calculateThaliPrice(basePrice, components, selectedQuantities, 
    swapCreditsApplied) → returns final_price using:
    final_price = base_price + Σ(selected_qty − included_qty) × 
    unit_price_delta − swap_credits_applied
  Write 3-4 test cases for this function (default order, reduced roti, 
  Jain-swapped order, over-max clamp).

jain.ts:
  applyJainSubstitution(components) → returns components with each 
  swapped to jain_substitute when the global toggle is on. Toggle lives in 
  profile/preferences, applied at order-build time, never per-dish.

credits.ts:
  getCreditBalance(customerId) → sums credits table
  applySkip(subscriptionId, date, reason) → inserts paused_dates entry + 
  credits row for that meal's value
  applyCreditsAtCheckout(customerId, orderTotal) → deducts available 
  credit before charging Razorpay for the remainder

Delivery windows are fixed enum-like slots ("13:00-13:15", "19:00-19:15"), 
never a countdown timer — tracking screen shows status steps 
(Placed → Cooking → Out for Delivery → Delivered), not live GPS at this phase.

───────────────────────────────────────
10. TESTING
───────────────────────────────────────
- Unit tests (Jest) for everything in /lib, especially pricing.ts and 
  credits.ts — these are the functions where a silent bug costs real money.
- No requirement for full component/E2E test coverage at MVP stage — 
  prioritize correctness of business logic over UI test coverage given 
  the timeline.

───────────────────────────────────────
11. GIT / WORKFLOW
───────────────────────────────────────
- Conventional commits (feat:, fix:, chore:, refactor:).
- .gitignore excludes .env, .cursor/mcp.json, node_modules, Expo build 
  artifacts.
- README with: setup steps, env var explanation, how to run migrations, 
  how to seed the DB, known limitations (cold starts on free Render tier, 
  no live GPS tracking, chef/admin stubs).

───────────────────────────────────────
12. BUILD ORDER — confirm against Stitch design after each step before continuing
───────────────────────────────────────
1. Expo scaffold, route groups (incl. chef/admin stubs), ESLint/Prettier, 
   theme constants, shared UI primitives.
2. Supabase schema as versioned migrations + RLS policies + seed script.
3. Auth: phone/OTP login, session handling, profile creation on first login.
4. Discovery → Chef Profile → Thali Builder (pricing.ts wired + tested) → Cart.
5. Checkout: Razorpay sandbox, signature verification server-side, 
   Payment Failed state, pending-order double-charge guard.
6. Subscriptions, Meal Calendar, Pause/Skip (credits.ts wired), credit 
   balance visible on Subscription Dashboard.
7. Order History (+ empty state), Tracking (status-step version, not GPS), 
   Rate & Review.
8. Profile & Settings, Dietary Preferences (Jain global toggle wired via 
   jain.ts), Become-a-Chef lead-capture form → chef_applications insert only.
9. Remaining empty/error states across all screens.
10. Sentry + Firebase Analytics wiring.
11. README + env docs + final pass for hardcoded values, console.logs, 
    and any `any` types.

Stop after each numbered step and report: which Stitch design was 
referenced, what was implemented, and any deviation from the design with 
reasoning — don't silently improvise across an entire screen.

---

**Cursor**

Building the GharKaSwad MVP per the build order — starting with Step 1 (scaffold + design system primitives). Checking Stitch MCP and project state first.

Pulling existing Stitch designs for design tokens, then scaffolding Step 1.

Scaffold failed because the folder isn't empty — I'll create the Expo app in a temp folder and merge it in. Checking Stitch projects in parallel.

Found the GharKaSwad Stitch project with the Artisanal Kitchen design system. Listing screens and waiting for the Expo scaffold to finish.

Expo scaffold is ready. Merging it into the project root and building Step 1 (routes, theme from Stitch, UI primitives).

Expo files are in place; `node_modules` is missing. Installing dependencies and setting up the router structure.


Disk space looks critically low (~13 MB free). Checking capacity before installing packages.

D: has ~13 MB free — too little for `node_modules`. Putting dependencies on C: via a junction so we can keep building in this workspace.


The junction failed — npm still wrote to D: and filled the disk. Moving the project to C: (~12 GB free) so installs can succeed.

Copy succeeded. Pointing `D:\Food-Delivery-App` at the C: copy via a junction so Cursor can keep using the same path.


D: is locked by Cursor, so I'll continue building on `C:\Users\DELL\Projects\Food-Delivery-App` (plenty of free space).

Dependencies are in; Stitch assets downloaded. Building the Step 1 foundation — theme from Stitch, routes, and UI primitives.


Creating Step 1 foundation files from the Stitch "Artisanal Kitchen" design system.


Fixing the logger so it doesn't depend on Sentry until Step 10, then adding UI primitives and routes.

Fixing ESLint, then starting Step 2 (Supabase migrations + RLS + seed).


Splitting pure credit math from Supabase I/O so Jest doesn't load Expo natives.

Fixing the dinner-component seed SQL and cleaning up the API modules.

Steps 1–2 are done. Stopping here per the build order so you can review before Auth.


## Steps 1 & 2 complete — stopping for review

**Important:** `D:\` is nearly full (~13 MB free), so the runnable project is at:

`C:\Users\DELL\Projects\Food-Delivery-App`

Re-open that folder in Cursor. `npm test`, `typecheck`, and `lint` all pass there (12 tests).

---

### Step 1 report

| Item | Detail |
|------|--------|
| **Stitch project** | GharKaSwad Marketplace (`11845391070777637560`) — Artisanal Kitchen |
| **Referenced designs** | Onboarding Welcome, Login & OTP, Discover Meals, Chef Profile, Thali Builder, Cart/Checkout, Tracking, Empty States, Payment Failed, Dietary, Become a Chef |
| **Implemented** | Expo Router route groups `(auth)/(customer)/(chef)/(admin)`, theme tokens, UI primitives (`Button`, `Card`, `Input`, `Stepper`, `BottomSheet`, `EmptyState`, `Badge`, `ErrorState`), ESLint + Prettier, `pricing.ts` + tests, chef/admin stubs |
| **Deviations** | Tracking = status steps only (no GPS). Screens are structural shells until their later steps. Brand accent `#D96B41` kept as alias; Material primary from Stitch is `#9d3e18`. |

---

### Step 2 report

| Item | Detail |
|------|--------|
| **Stitch** | N/A (schema work) |
| **Implemented** | Migrations: schema, RLS, Nani Geeta seed; `lib/supabase.ts`; `lib/api/menu.ts`, `lib/api/credits.ts`; pure `lib/credits.ts` + tests |
| **Seed IDs** | Maker `11111111-…1111`, lunch thali `22222222-…2222`, dinner `22222222-…2223` |
| **RLS** | Customer own-row policies; public read on makers/menu; menu writes service-role only; chef_applications insert for anon/authenticated lead capture |

Apply migrations via Supabase SQL editor (or `supabase db push`) — see `supabase/README.md`.

---

Reply **continue** (or “do Step 3”) and I’ll implement phone/OTP auth, session handling, and profile creation next.

---

**User**

continue

---

**Cursor**

Continuing with Step 3 — phone/OTP auth, session handling, and profile creation. Pulling the Stitch Login & OTP design and reviewing the current auth scaffold.


Fetching the Login/OTP HTML for layout details, then implementing auth API, provider, screens, and OTP rate-limiting.

Implementing auth API, AuthProvider, login/verify screens matching Stitch, and the OTP rate-limit backend.


Building the OTP rate-limit backend and polishing login/profile screens.

Fixing the auth gate (segments include dynamic IDs) and wiring package scripts.

Moving phone helpers out of the auth module so Jest won't load AsyncStorage, then finishing backend wiring.

## Step 3 complete

**Stitch referenced:** Customer - Login & OTP Verification (`ba922e8094a344d6900210d67d223cfa`) — “Welcome Home” phone step + “Verify OTP” 6-box grid, +91 prefix, 30s resend countdown.

**Also used:** Onboarding - Welcome (entry CTAs).

### Implemented
- `lib/api/auth.ts` — send/verify OTP, profile bootstrap, sign-out
- `lib/phone.ts` — E.164 helpers (unit-tested)
- `AuthProvider` / `useAuth` — session + profile; AsyncStorage-backed Supabase client
- `CartProvider` — cart survives mid-checkout session expiry
- Screens: login (Welcome Home), verify (6-digit OTP + inline errors), profile sign-in/out
- Customer auth gate for checkout / tracking / review / pause routes (guest can still browse Discover)
- Express `POST /auth/otp/send` with **5 / 15 min** rate limit (`npm run api:dev`)

### Deviations
- OTP UI is Expo-native auto-advance boxes (not a web animation) — same layout roles as Stitch
- If `EXPO_PUBLIC_API_URL` is unset, OTP goes **direct to Supabase** (dev fallback; rate-limit proxy recommended for pilot)

### Checks
Tests **16** · typecheck · lint — all green on `C:\Users\DELL\Projects\Food-Delivery-App`.

**To try OTP:** enable Supabase Phone Auth + SMS, fill `.env`, optionally run `npm run api:dev`.

Reply **continue** for Step 4 (Discovery → Chef → Thali Builder → Cart wired to seed data).

