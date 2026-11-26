# ARTISAN V2 — Technical Audit & Architecture Readiness Report

**Audit Date:** 2026-11-26  
**Scope:** Audit-only inspection of the complete `Istart_Artisan` repository prior to ARTISAN V2 planning and implementation. No source code, UI, or database files were modified during this audit.  
**Rule Baseline:** Conducted in compliance with [AGENTS.md](./AGENTS.md) (read-only verification, zero secret exposure, verified implementation tracing, free/practical stack preference).

---

## 1. Existing Project Architecture

### 1.1 Frontend Framework & Structure
- **Rendering Stack:** Pure HTML5, CSS3 (Tailwind CSS v4 via `@tailwindcss/vite`), and Vanilla JavaScript/TypeScript DOM manipulation inside a single-document multi-shell SPA ([index.html](./index.html), [src/app.js](./src/app.js), [src/router.ts](./src/router.ts), [src/index.css](./src/index.css)).
- **Unused Dependency Note:** [package.json](./package.json) declares `react`, `react-dom`, `@vitejs/plugin-react`, `lucide-react`, and `motion`, while TypeScript has `"jsx": "react-jsx"` ([tsconfig.json](./tsconfig.json)); however, zero React components or React entrypoints are mounted at runtime.
- **Routing (`src/router.ts`):** Client-side History API router supporting `/`, `/explore`, `/product/:id`, `/artisan/:id`, `/about`, `/contact`, `/login`, `/register`, `/artisan/dashboard`, and `/buyer/dashboard`, with `VITE_BASE_PATH` subpath support and [public/404.html](./public/404.html) `sessionStorage` redirect recovery for GitHub Pages.
- **Two UI Shells (`index.html`):**
  - `#public-site-shell`: Preloader, editorial hero, scrollytelling showcase (`src/services/scrollytelling.ts`), public craft categories, featured products, explore filters, product detail, artisan storefront, about, contact, login, register, and buyer starter dashboard.
  - `#artisan-dashboard-shell`: Protected dashboard views (`view-home`, `view-catalog`, `view-cataloging`, `view-ai-advisor`, `view-pricing-engine`, `view-studio`, `view-inquiries`, `view-artisan-profile`, `view-settings`, `view-help`) and shared modals.

### 1.2 Backend Architecture
- **Runtime & Server:** Express 4 (`^4.21.2`) + TypeScript in [server.ts](./server.ts), run via `tsx server.ts` in development (attaching Vite middleware in SPA mode) and bundled via `esbuild` to `dist/server.cjs` for production (`npm run start`).
- **Persistence Reality (Important Verified Finding):** Although `@supabase/supabase-js` is installed and two SQL migrations exist in `supabase/migrations/`, [server.ts](./server.ts) **never connects to Supabase or any external database**. All Express CRUD, authentication accounts, tokens, artisans, enquiries, and contact messages live in volatile in-memory arrays (`inMemoryProducts`, `inMemoryArtisans`, `inMemoryInquiries`, `registeredAccounts`, `revokedTokens`, `contactMessages`), pre-seeded from [src/catalog-data.js](./src/catalog-data.js). Restarting the Node process erases all runtime changes, accounts, products, and enquiries created on the backend.

### 1.3 External Services, AI & Storage
- **AI Engine (`@google/genai ^2.4.0`):** Server-side Gemini client in [server.ts](./server.ts) querying `GEMINI_MODELS_POOL` (`["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"]`) with timeout fallback (`withTimeout`) across `/api/ai/analyze-product`, `/api/ai/chat`, `/api/ai/pricing`, and `/api/ai/translate`.
- **Supabase Client (`src/services/supabase.ts`):** Browser-side client initialized from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (falling back to non-functional placeholder strings `https://xyzcompany.supabase.co`).
- **Client-Side Persistence:** Browser `localStorage` (`artisan_auth_token_v1`, `artisan_local_products_v1`, `artisan_local_inquiries_v1`, `artisan_local_profile_v1`, `artisan_prefs_v1`) and IndexedDB (`ArtisanHubOfflineDB` via `OfflineStorageQueue` in [src/services/storage.ts](./src/services/storage.ts)).
- **Media Assets & Images:** Two local images (`public/assets/artisan_logo.jpg`, `public/assets/sitadevi_profile.jpg`), external Unsplash image URLs for craft previews, HTML5 Canvas studio/card generation ([src/canvas-tools.js](./src/canvas-tools.js)), and user-uploaded images converted client-side via `FileReader.readAsDataURL()` into raw Base64 strings. No object/blob storage bucket (S3/Supabase Storage/Cloudinary) is configured.
- **External Links & Browser APIs:** `https://wa.me/...` WhatsApp deep links, `tel:` / `mailto:` links, `navigator.mediaDevices.getUserMedia` camera, Web Speech API (`SpeechRecognition` & `SpeechSynthesis`), Web Audio API chimes ([src/services/accessibility.ts](./src/services/accessibility.ts)).

### 1.4 Git, CI/CD & Environment Configuration
- **Git Status:** Branch `main` synced with `origin/main` (`https://github.com/MadhavAgrawal264/Istart_Artisan.git`). Latest commit `fac00b7`. Working tree shows `M index.html` (line-ending diff LF vs CRLF) and untracked `?? AGENTS.md`.
- **CI/CD ([.github/workflows/deploy.yaml](./.github/workflows/deploy.yaml)):** Deploys **static Vite build only** (`npx vite build`) to GitHub Pages on push to `main`. Note: Express backend API routes (`/api/*`) do **not** run on GitHub Pages.
- **Environment Variables:** Only `.env.example` exists in the workspace (`.env` is absent; `GEMINI_API_KEY` and Supabase credentials are unset locally). Referenced env keys across files: `GEMINI_API_KEY`, `APP_URL`, `PORT`, `NODE_ENV`, `AUTH_SECRET`, `VITE_BASE_PATH`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Note [metadata.json](./metadata.json) also declares `camera`, `microphone`, and `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`.

---

## 2. Feature Audit & Status Matrix

| Feature | Current Status | Existing Implementation | Dependencies | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **User Authentication** | **Partially implemented** | Dual `AuthService` (`src/services/auth.ts`): Supabase Auth + `profiles` upsert when configured, otherwise Express `scryptSync` + `HMAC-SHA256` tokens (`/api/auth/register`, `/login`, `/me`, `/logout`, `/account`, `/change-password`). *Gaps:* Express stores accounts in volatile memory; `AUTH_SECRET` regenerates randomly per boot if unset; seeded artisans cannot log in; broken on static GitHub Pages without Supabase. | Supabase Auth or persistent SQL/DB user table, `AUTH_SECRET`, HTTPS cookie/token store | **P0 (Critical)** |
| **Artisan Dashboard** | **Partially implemented** | Complete responsive layout in `index.html` (`#artisan-dashboard-shell`) + `src/app.js` with collapsible sidebar, mobile drawer, top notifications/profile menus, Overview KPIs, Quick Access, Recent Products/Enquiries. *Gap:* Driven by volatile in-memory Express arrays + `localStorage`, not persistent DB. | Persistent DB API, authenticated session scoping | **P0 (Critical)** |
| **Artisan Profiles** | **Partially implemented** | Editable form in `#view-artisan-profile` (`PUT /api/artisans/me`) + public storefront `#public-page-public-artisan` (`/artisan/:id`, `GET /api/artisans/:id`). *Gaps:* Express in-memory + `localStorage` only; Supabase `artisans` table lacks `bio`, `craft_specialty`, `craft_tradition`, `years_experience`, `profile_image`, `is_public`, `email`. | Unified `artisans`/`profiles` schema, object storage for avatar | **P1 (High)** |
| **AI Product Cataloguing** | **Partially implemented** | `#view-cataloging` 3-step flow + `POST /api/ai/analyze-product` using `@google/genai`, returning `503` manual fallback when unconfigured. *Gaps:* Sends only first photo (`rawImageBase64`), `GEMINI_MODELS_POOL` contains questionable model names (`gemini-3.8-flash` / `gemini-3.1-flash-lite`) needing verification, and `/api/ai/*` is unavailable on GitHub Pages static build. | Live Gemini API key, verified stable model IDs, persistent backend or Edge Function | **P1 (High)** |
| **Product Image Upload** | **Partially implemented** | Client `FileReader` (type check + `<=5MB` client validation + up to 5 photos in modal/wizard) + camera capture. *Gaps:* Stored as raw Base64 inside JSON/`localStorage` (hits ~5MB quota fast); no server-side MIME/size/magic-byte check beyond Express `50MB` limit; Supabase `products` schema only accepts single `image_url`. | Supabase Storage / S3 / R2 bucket, signed upload URLs, server image validation | **P0 (Critical)** |
| **Product Descriptions & Storytelling** | **Partially implemented** | Supports `description`, `culturalStory`, AI-generated narrative, multi-language regional fields on seed items (`titleRegional`), Web Speech listen aloud, and PNG stall card generator (`src/canvas-tools.js`). *Gaps:* Manual Add/Edit product modal lacks dedicated `culturalStory`/`careInstructions` inputs; `applyStudioEnhancement` is basic pixel chroma threshold, not AI cutout. | Multilingual schema normalization, canvas/image CDN service | **P2 (Medium)** |
| **Fair Price Calculator** | **Partially implemented** | `calculateFairPriceSummary` (`src/services/pricing.ts`) & `MaterialPricingWizardController` (`src/components/material-pricing-wizard.ts`) compute `Material + Labour + Packaging + Other` and profit margin, and apply price to an existing product (`PUT /api/products/:id`). *Gaps:* `Save as New Listing` posts `/api/sync/products` (dropping granular packaging/other expense fields); `#view-cataloging` quick check uses legacy `overheadCost` field; no saved pricing history or regional benchmarks. | Unified pricing model in DB, `pricing_history` table, regional benchmark data | **P1 (High)** |
| **Material Cost Inputs** | **Partially implemented** | Material select + INR input + `GET /api/material-benchmarks` + Supabase `fetchMaterialBenchmarks()`. *Gaps:* `validateMaterialCost()` (`+/-30%` outlier alert in `src/services/validation.ts`) and `#cost-deviation-modal` are orphaned (not wired into current `MaterialPricingWizardController` UI); benchmarks are 8 flat national static numbers without units/regions/evidence. | Regional benchmark dataset, restored validation UI, cost evidence uploads | **P1 (High)** |
| **Labour Cost Calculation** | **Partially implemented** | Supports `Hours × Rate` OR direct `₹` amount in `MaterialPricingWizardController` + `/api/ai/pricing`. *Gaps:* `POST/PUT /api/products` defaults to `0` if omitted outside wizard; no complexity multiplier, family/co-artisan split, or living-wage regional minimum reference. | Pricing schema alignment across all product forms | **P1 (High)** |
| **AI Advisor** | **Partially implemented** | Conversational UI (`#view-ai-advisor`) with Hindi/English toggle, mic button, suggested chips, calling `POST /api/ai/chat` (last 6 messages). *Gaps:* No persistent chat history; returns hardcoded fallback tip on `500`; unauthenticated endpoint open to abuse if deployed publicly. | Auth guard + rate limit on `/api/ai/chat`, valid `GEMINI_API_KEY`, persistent chat log (optional) | **P2 (Medium)** |
| **Voice & Multilingual** | **Partially implemented** | `TRANSLATIONS` (`src/translations.js`) for 9 languages (`hi`, `en`, `bn`, `mr`, `ta`, `te`, `gu`, `kn`, `od`), Web Speech STT/TTS (`src/app.js`, `src/services/accessibility.ts`), `/api/ai/translate`. *Gaps:* Most public pages & newly redesigned dashboard views lack `data-i18n` tags (remain English); browser SpeechRecognition unsupported on Firefox/some WebViews; `/api/ai/translate` falls back silently to untranslated source when Gemini unavailable. | `data-i18n` coverage audit, persisted language preference on user profile | **P2 (Medium)** |
| **Buyer Enquiries** | **Partially implemented** | Buyer modal + `POST /api/inquiries`, artisan-scoped `GET /api/inquiries`, `PATCH /api/inquiries/:id` (`new`/`responded`/`closed` + reply note), WhatsApp/`mailto:` handoff. *Gaps:* Zero Supabase `inquiries` table (memory + `localStorage` only); no email/SMS notification delivery; buyer replies aren't stored or viewable in buyer dashboard sync across devices. | `inquiries` & `enquiry_messages` DB tables, auth scoping enforcement, transactional email/notification trigger | **P1 (High)** |
| **Product Management** | **Partially implemented** | Add/Edit modal, multi-photo UI, draft vs published filter, search/category filter, delete confirmation modal in `src/app.js` + Express `/api/products` CRUD. *Gaps:* **Schema mismatch**: Express/frontend use `{ title, category, finalPrice, status: draft|published, images[] }`, whereas Supabase `public.products` uses `{ product_name, material_type, calculated_price, status: listed|sold|processing|in_bank_account, image_url }` — dashboard never syncs to Supabase Postgres! | Schema unification migration, persistent CRUD, inventory/stock tracking | **P0 (Critical)** |
| **Admin Functionality** | **Not implemented** | Zero admin routes, UI views, moderation queues, or verification endpoints exist. `profiles.account_type` only permits `'artisan' | 'buyer' | 'organization'`. | Role extension (`'admin'`), server RBAC middleware, admin moderation UI | **P1 (High)** |

---

## 3. Existing Working Features vs. Partial vs. Missing Summary

### Verified Working Today (When Express Node Server Runs Locally)
- Public storefront routing (`/`, `/explore`, `/product/:id`, `/artisan/:id`, `/about`, `/contact`, `/login`, `/register`).
- Scrollytelling hero, preloader, cracking display headings, ambient canvas particles ([src/services/scrollytelling.ts](./src/services/scrollytelling.ts)).
- Password hashing (`scryptSync`), session tokens (`HMAC-SHA256`), account settings/password change in Express memory.
- Product CRUD (`draft` / `published`), search/category filters, enquiry creation & status transitions (`new` / `responded` / `closed`) in Express memory + browser `localStorage`.
- Offline IndexedDB queue (`OfflineStorageQueue`) + `OfflineSyncManager` queueing `/api/sync/products` payloads offline and flushing when online returns.
- Client-side Cost-Based Fair Price calculation (`calculateFairPriceSummary`) and Canvas Stall Card PNG generator.

### Missing Entirely (Required for ARTISAN V2)
- Persistent backend database wiring (Express -> PostgreSQL/Supabase).
- Admin panel & RBAC role checks (`admin`, `verifier`).
- Object/image storage service (instead of Base64 JSON blobs).
- **Commerce & Trust Modules:** Order Management, Checkout/Payments, Delivery Tracking, Dispute Resolution, Verified Buyer Reviews, Artisan Verification (KYC/craft proof), Craft Verification, Cost Evidence Verification, Price Confidence System, Pricing History, Regional Material Price Reference, B2B Bulk Orders, Custom Orders, Wholesale Pricing tiers, Production Capacity Management, Market Intelligence analytics, Data/Catalog Export tools, and ONDC protocol integration.

---

## 4. Database Audit

### 4.1 Existing SQL Migrations (`supabase/migrations/`)
1. **`20260928000000_artisan_marketplace_schema.sql`**:
   - `public.artisans`: `id (UUID PK)`, `name`, `location`, `phone_number`, `created_at`. Seeded with 3 UUID rows (`a000...0001`..`0003`).
   - `public.material_benchmarks`: `id (SERIAL PK)`, `material_name (UNIQUE)`, `average_cost (NUMERIC(10,2))`. Seeded with 8 national baseline costs (`Clay`, `Yarn`, `Wood`, `Silk`, `Brass`, `Bamboo`, `Stone`, `Leather`).
   - `public.products`: `id (UUID PK)`, `artisan_id (FK -> artisans.id ON DELETE CASCADE)`, `product_name`, `material_type`, `calculated_price`, `status CHECK ('listed','sold','processing','in_bank_account')`, `image_url`, `created_at`. Seeded with 2 UUID rows.
2. **`20261126000000_user_profiles_auth.sql`**:
   - `public.profiles`: `id (UUID PK -> auth.users.id ON DELETE CASCADE)`, `full_name`, `email`, `mobile_number`, `account_type CHECK ('artisan','buyer','organization')`, `organization_name`, `created_at`, `updated_at`.

### 4.2 Critical Data Model Discrepancies & Gaps
- **Artisan ID & Profile Split:** `auth.users` / `public.profiles` uses auth user UUIDs; `public.artisans` is an unlinked standalone table with no `user_id` FK back to `auth.users`/`profiles`; `src/catalog-data.js` uses string IDs `"artisan-1".."artisan-4"` and `"prod-1".."prod-6"`.
- **Product Schema Split:** Frontend UI (`src/app.js`) and Express (`server.ts`) expect ~25 fields (`title`, `category`, `materials[]`, `dimensions`, `description`, `culturalStory`, `tags[]`, `keywords[]`, `materialCost`, `laborHours`, `hourlyRate`, `packagingCost`, `overheadCost`, `profitMarginPercent`, `finalPrice`, `images[]`, `status: 'draft'|'published'`, `originState`, `hasGiTag`), while SQL `public.products` only has 8 columns (`product_name`, `material_type`, `calculated_price`, `status: 'listed'|...`, `image_url`).
- **Missing Tables:** No tables exist for `inquiries`, `product_images`, `pricing_history`, `material_evidence`, `regional_benchmarks`, `orders`, `order_items`, `shipments`, `reviews`, `disputes`, `verifications`, `rfqs`/`bulk_orders`, or `production_capacity`.
- **RLS Policy Audit:**
  - `public.profiles`: Secure (`auth.uid() = id` on `SELECT`, `INSERT`, `UPDATE`).
  - `public.artisans` & `public.products`: **Overly permissive** (`INSERT WITH CHECK (true)`, `UPDATE USING (true)` allow anonymous writes across rows).

---

## 5. Security Observations (Verified Code Issues)

> [!CAUTION]
> Several Express endpoints allow unauthenticated or cross-tenant modification when the `Authorization` header is omitted.

1. **Broken Authentication / Missing Enforcement on Express Write & Private Read Routes ([server.ts](./server.ts)):**
   - `PUT /api/products/:id` & `DELETE /api/products/:id`: Ownership checks use `if (authUser && product.artisanId !== authUser.id)`. When `authUser` is `null` (no Bearer token or expired/invalid token), **access is granted** to modify or delete any product!
   - `POST /api/products`: Falls back to `productData.artisanId || "artisan-1"` when `authUser` is `null`, allowing unauthenticated callers to forge listings for any artisan.
   - `PATCH /api/inquiries/:id`: Ownership check is wrapped in `if (authUser)`, allowing unauthenticated callers to alter enquiry status or artisan replies.
   - `GET /api/products?scope=mine&artisanId=...` & `GET /api/inquiries?artisanId=...`: When unauthenticated, trusts the `artisanId` query parameter, exposing private drafts and buyer PII (`buyerPhone`, `buyerEmail`, `buyerLocation`) of arbitrary artisans.
   - `PUT /api/artisans/me` & `POST /api/artisans`: `PUT /api/artisans/me` falls back to `req.body?.id` if unauthenticated (fails only if both missing); `POST /api/artisans` has zero auth and allows overwriting any existing artisan profile by passing `id`.
2. **Permissive Supabase RLS (`20260928000000_artisan_marketplace_schema.sql`):** Anonymous/authenticated Supabase clients can `INSERT`/`UPDATE` any row in `artisans` and `products` (`WITH CHECK (true)` / `USING (true)`). Missing `DELETE` RLS policy.
3. **XSS Injection Surface (`src/components/material-pricing-wizard.ts`):** `refreshProductOptions()` interpolates `p.title` unescaped directly into `selectEl.innerHTML` (unlike `src/app.js`, which uses `escapeHtml`). Product image `src` values and WhatsApp/URL inputs should also validate protocols (`https:` or `data:image/` only).
4. **Ephemeral Signing Secret & Unpersisted Revocation (`server.ts`):** If `AUTH_SECRET` is omitted in `.env`, `crypto.randomBytes(32)` generates a new secret every boot, logging out users; `revokedTokens` Set lives in memory only.
5. **Unbounded File/Payload Surface & DoS Vectors:** Express allows `50MB` JSON bodies across all routes; no image magic-byte check or dimension/compression limit server-side; zero rate limiting on `/api/auth/login`, `/api/auth/register`, `/api/inquiries`, `/api/contact`, or `/api/ai/*` (risking Gemini quota exhaustion).
6. **API Key & Credential Hygiene:** `GEMINI_API_KEY` stays strictly server-side (`server.ts`, verified clean). Supabase client only uses public `VITE_SUPABASE_ANON_KEY`. `.gitignore` ignores `.env*` while keeping `.env.example`.

---

## 6. ARTISAN V2 Compatibility & Gap Analysis

The current codebase's TypeScript services, Express API layer, Supabase schema foundations, and Tailwind/HTML modular architecture **can** evolve cleanly into ARTISAN V2, provided **foundational persistence, authentication enforcement, and media storage** are fixed first. Below is the compatibility evaluation for every requested V2 capability:

| Category | V2 Capability | Architectural Compatibility & Key Challenges |
| :--- | :--- | :--- |
| **Pricing Intelligence** | **Material Price Evidence System** & **Cost Evidence Verification** | Compatible via new `material_cost_evidence` table (receipt photo/supplier note + verification status) backed by real object storage instead of Base64 in JSON. |
| | **Regional Material Price Reference** | Compatible with existing `material_benchmarks` table once extended with `state`/`district`, `unit` (kg/meter/sheet), `min_cost`, `max_cost`, `updated_at`, and `GET /api/material-benchmarks?state=...`. Re-wire orphaned `validateMaterialCost()`. |
| | **Transparent Fair Price Intelligence** & **Price Confidence System** | Needs deterministic confidence scoring (combining evidence presence + regional benchmark variance + hours plausibility) rather than LLM guesses; `calculateFairPriceSummary()` provides a clean base. |
| | **Pricing History** | Requires `product_price_history` audit table recording every cost breakdown change and final price adjustment by artisan. |
| **Trust & Verification** | **Artisan Verification** & **Craft Verification** | Needs `admin`/`verifier` RBAC role, KYC/artisan guild credential table (`artisan_verifications`), and GI/technique review workflow replacing static `isVerified: true` / `hasGiTag` booleans. |
| | **Verified Reviews** | Needs order completion link (`verified_purchase` constraint referencing delivered `orders`) + `product_reviews` / `artisan_reviews` tables; not currently possible without Orders module. |
| **Commerce & Post-Order** | **Order Management** & **Delivery Tracking** | Currently only buyer *enquiries* exist (`MilestoneStatus` in `src/types/artisan.ts` is UI-only). Needs `orders`, `order_items`, state machine (`placed -> confirmed -> packed -> shipped -> delivered`), courier tracking fields, and payment gateway/UPI proof verification. |
| | **Dispute Resolution** | Depends directly on `orders`, buyer/artisan accounts, evidence uploads, and Admin panel (`disputes` + `dispute_messages` tables). |
| **B2B & Scale** | **B2B Bulk Orders**, **Custom Orders**, **Wholesale Pricing** | `account_type: 'organization'` already exists in DB (`profiles`) and `inMemoryInquiries` has `bulk_retail` seed! Needs MOQ / tiered wholesale pricing columns on `products`, custom request / RFQ quotes workflow, and organization onboarding UI. |
| | **Production Capacity Management** | Needs `lead_time_days`, `monthly_capacity_units`, `active_booked_units` on artisan/product records + calendar availability checks before accepting custom/bulk orders. |
| **Market & Ecosystem** | **Market Intelligence** | Depends on persistent historical `products`, `orders`, `inquiries`, and `product_views` telemetry (not possible while Express runs in-memory). |
| | **Offline-First Functionality** | `OfflineStorageQueue` + `OfflineSyncManager` (`IndexedDB`) already exist for single-form submissions! Must extend with Service Worker (PWA app shell cache), IndexedDB sync for product edits/enquiries, auth token inclusion during background flush, and conflict resolution (last-write-wins or version numbers). |
| | **AI Photo Studio** | Current `canvas-tools.js` uses simple corner-color alpha math (fails on textured/wooden/cloth backgrounds). Needs real background removal (e.g., open-source client ONNX/WebGPU segmentation like `@imgly/background-removal` to keep zero paid API cost) + storage upload. |
| | **Advanced Voice Assistant** | Current browser Web Speech API breaks on non-Chromium browsers and noisy village environments. Adding audio recording (`MediaRecorder`) + Gemini multimodal audio transcription (`POST /api/ai/voice-intent` server-side) works within existing `@google/genai` integration without paid third-party STT APIs, gated by auth + rate limit. |
| | **Craft Storytelling** | High compatibility: existing bilingual/`culturalStory`/Canvas QR card/TTS tools need DB storage columns + shareable `/story/:slug` or enhanced `/product/:id` story layout. |
| | **Export Tools** | Simple to add CSV/JSON product catalog, pricing ledger, GST-ready order invoice (client PDF/print CSS), and WhatsApp catalog bundle exports once durable DB queries exist. |
| | **ONDC Integration** | **High architectural complexity.** Beckn/ONDC protocol requires registered Subscriber ID, Ed25519 signing/encryption keys, public webhook endpoints (`/on_search`, `/on_select`, `/on_init`, `/on_confirm`, `/on_status`), strict catalog taxonomy mapping, and hosted Express/backend deployment (impossible on GitHub Pages alone). |

---

## 7. Technical Limitations & Potential Risks

1. **Hosting Split (GitHub Pages vs Node Server):** [deploy.yaml](./.github/workflows/deploy.yaml) only publishes static files; any backend Express routes (`/api/auth/*`, `/api/ai/*`, `/api/products`, `/api/inquiries`) fail on GitHub Pages unless either Express runs on a Node host (Render/Railway/Fly/Cloud Run) OR Supabase Edge Functions + Direct Supabase Postgres/Auth handle API calls.
2. **In-Memory Backend Data Loss:** Any production restart clears all runtime registered users, products, and enquiries until Express or client directly persists to PostgreSQL/Supabase.
3. **Image Size & Quota Collapse:** Storing up to 5 Base64 images inside `localStorage` (`~5–10MB` browser cap) and `inMemoryProducts` will trigger `QuotaExceededError` after 2–4 real smartphone photos.
4. **AI Model Naming & Quota Limits:** Verify `GEMINI_MODELS_POOL` (`gemini-3.1-flash-lite`, `gemini-3.8-flash`) against live Google GenAI API free-tier model availability before V2 launch; rate-limit AI endpoints so unauthenticated bots cannot burn API quota.
5. **Dual Non-Aligned Schemas:** Keeping two incompatible schemas (`src/catalog-data.js` vs `supabase/migrations/20260928...`) guarantees sync bugs until unified under one typed schema.

---

## 8. Recommended ARTISAN V2 Implementation Order & Dependencies

1. **Stage 0 — Security & Persistent Database Foundation (Blocker for all V2 features):**
   - Enforce mandatory JWT/Bearer auth middleware & strict ownership checks on all write/private Express endpoints; remove unauthenticated `artisanId` query/body trust; tighten Supabase RLS policies; add rate limiting & `escapeHtml` sanitization everywhere.
   - Unify Product, Artisan, and Enquiry database schemas in Supabase Postgres (or local SQLite/Postgres + Supabase) and eliminate volatile `inMemory*` drift.
   - Replace Base64 `localStorage` image storage with object storage (e.g., Supabase Storage buckets) + server-side MIME/size validation.
   - Decide single deployment topology (Node backend host + frontend, or Vite static frontend + Supabase + serverless AI functions).
2. **Stage 1 — Trust, Verification & Transparent Pricing Engine:**
   - Add `admin`/`verifier` role & Admin Moderation Dashboard.
   - Implement Artisan Verification & Craft Verification workflows.
   - Build Regional Material Price Reference, Material Price Evidence System + verification, Pricing History, and Price Confidence scoring; re-enable cost deviation modal.
3. **Stage 2 — Order Lifecycle, Reviews & Disputes:**
   - Build Order Management & Delivery Tracking (`orders`, `order_items`, status notifications, payout ledger).
   - Enable Verified Reviews (tied strictly to delivered orders) & Dispute Resolution workflow.
4. **Stage 3 — B2B, Capacity & Workshop Tools:**
   - Enable Wholesale Pricing tiers, B2B Bulk Orders (`organization` accounts), Custom Orders / RFQ workflow, and Production Capacity Management.
   - Add Craft Storytelling enhancements, free open-source AI Photo Studio enhancement, Advanced Voice Assistant (multimodal Gemini audio fallback), and Export Tools (CSV/PDF/catalog cards).
5. **Stage 4 — Intelligence, Full Offline Sync & External Protocol:**
   - Add Market Intelligence dashboards powered by real historical order/enquiry queries.
   - Upgrade PWA + IndexedDB Offline-First sync across products, pricing, and draft edits.
   - Evaluate and implement ONDC / Beckn gateway adapter as a dedicated microservice once backend hosting, signed webhooks, and order fulfillment states are production-stable.

---

## 9. Exact Files Inspected During This Audit

- Rules & Config: `AGENTS.md`, `package.json`, `tsconfig.json`, `vite.config.ts`, `.env.example`, `.gitignore`, `metadata.json`, `.github/workflows/deploy.yaml`, `public/404.html`
- Backend & Data: `server.ts`, `src/catalog-data.js`, `supabase/migrations/20260928000000_artisan_marketplace_schema.sql`, `supabase/migrations/20261126000000_user_profiles_auth.sql`
- Frontend Entry, UI & Styling: `index.html`, `src/index.css`, `src/router.ts`, `src/app.js`, `src/canvas-tools.js`, `src/translations.js`
- Components & Types: `src/types/artisan.ts`, `src/components/material-pricing-wizard.ts`, `src/components/milestone-timeline.ts`
- Services: `src/services/auth.ts`, `src/services/supabase.ts`, `src/services/pricing.ts`, `src/services/validation.ts`, `src/services/storage.ts`, `src/services/accessibility.ts`, `src/services/scrollytelling.ts`
