# GharKaSwad database (Supabase)

```
supabase/
  migrations/          ← run these (current production schema)
    20260710120000_production_schema.sql
    20260710120100_seed_production_demo.sql
  archive/             ← old incremental SQL (do not run on new projects)
  README.md            ← this file
```

---

## What you do (new organization / new project)

### 1. Create org + project
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Create an **Organization** (or use an existing one)
3. **New project** → pick a name (e.g. `gharkaswad`), region, and DB password  
   Save the DB password somewhere safe.

### 2. Turn on Phone auth
1. Project → **Authentication** → **Providers** → **Phone** → Enable  
2. SMS provider can wait; for now keep app `EXPO_PUBLIC_DEV_AUTH=true` + OTP `654321`

### 3. Apply the database (SQL Editor — easiest)
1. Open **SQL Editor** → **New query**
2. Paste and **Run** all of:  
   `migrations/20260710120000_production_schema.sql`
3. New query → paste and **Run** all of:  
   `migrations/20260710120100_seed_production_demo.sql`
4. New query → paste and **Run** all of:  
   `migrations/20260710130000_upsert_maker_rpc.sql`  
   (needed so approved kitchens like Dixit’s appear on Discover)
5. New query → paste and **Run** all of:  
   `migrations/20260710140000_upsert_thali_component_rpc.sql`  
   (needed so dish customizations sync for customers)
6. New query → paste and **Run** all of:  
   `migrations/20260710150000_live_orders.sql`  
   (cook ↔ customer live order status)
7. Addresses + pickup PIN + place_order updates:  
   `migrations/20260716120000_addresses_and_pickup.sql`
8. Tighten addresses RLS:  
   `migrations/20260716140000_addresses_rls_tighten.sql`
9. Orders RLS + `grant_credit` RPC (decline refunds / wallet):  
   `migrations/20260716150000_orders_rls_and_credits.sql`
10. Confirm in **Table Editor** you see: `profiles`, `maker_profiles`, `menu_items`, `orders`, `addresses`, `credits`, `app_admins`, etc.

### 4. Put keys in `.env`
Project → **Settings** → **API**:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # anon public
```

Keep for local OTP testing:

```
EXPO_PUBLIC_DEV_AUTH=true
EXPO_PUBLIC_DEV_OTP=654321
EXPO_PUBLIC_ADMIN_PHONES=+911234567890
```

### 5. Restart the app
Stop Expo and run again (`npx expo start` / `npm run web`) so it picks up the new env.

---

## Optional: CLI instead of SQL Editor

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

That applies everything in `migrations/` only (not `archive/`).

---

## After DB is live

Tell me when steps 1–4 are done — next we wire the app to read/write this Supabase DB (instead of AsyncStorage-only).

| Seed | UUID |
|------|------|
| Nani Geeta kitchen | `11111111-1111-4111-8111-111111111111` |
| Lunch thali | `22222222-2222-4222-8222-222222222222` |
| Dinner thali | `22222222-2222-4222-8222-222222222223` |
| Admin phone | `+911234567890` |
