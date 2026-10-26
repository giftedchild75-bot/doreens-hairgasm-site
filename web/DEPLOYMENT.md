# Deploying the store

The store runs on Vercel with a Postgres database. Everything risky (payments, emails, Google sign-in, the Meta Pixel) stays switched off until its setting is filled in, so the shop can go live first and features can be turned on one at a time.

## 1. One-time setup (owner/account holder)

1. **Connect GitHub to Vercel:** vercel.com → Account Settings → Authentication → connect GitHub. (Without this, Vercel can't link the repository.)
2. **Create the project:** Add New → Project → import `doreens-hairgasm-site`.
   - Root Directory: `web`
   - Production Branch: `ecommerce-platform` (until it is merged into `main` — `main` still holds the old static site).
3. **Add a database:** Project → Storage → create a Postgres database (Neon via the Marketplace works). It sets `DATABASE_URL` for you.

## 2. Environment variables (Project → Settings → Environment Variables)

| Name | Value | Needed |
|---|---|---|
| `DATABASE_URL` | set by the database integration | Yes |
| `SITE_URL` | `https://<your-domain or project>.vercel.app` | Yes |
| `ORDER_LINK_SECRET` | a long random string (e.g. `openssl rand -hex 32`) | Yes |
| `CRON_SECRET` | another long random string | Yes |
| `WHATSAPP_NUMBER` | `2349130213524` | Yes |
| `PAYMENTS_ENABLED` | `false` until Paystack is set up | Yes |
| `PAYSTACK_SECRET_KEY` | `sk_test_…` first, then `sk_live_…` | Later |
| `PAYSTACK_LIVE_APPROVED` | `true` only after a test order works with live keys | Later |
| `RESEND_API_KEY`, `EMAIL_FROM`, `STORE_NOTIFY_EMAIL` | order emails | Later |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | redirect URI `<SITE_URL>/api/auth/google/callback` | Optional |
| `META_PIXEL_ID` | digits from Meta Events Manager | Optional |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store, for admin photo uploads | Recommended |

## 3. Prepare the database (once, from this folder)

```bash
DATABASE_URL="postgres://…" npm run db:migrate
DATABASE_URL="postgres://…" npm run db:seed          # loads the owner's catalogue (only into an empty database)
DATABASE_URL="postgres://…" ADMIN_EMAIL=owner@example.com ADMIN_NAME="Doreen" ADMIN_ROLE=owner ADMIN_PASSWORD="…" npm run admin:create
```

## 4. Deploy and check

Push to the production branch (or click Redeploy). Then check:

- `/api/health` returns `{"ok":true,"db":"up"}`
- Home, Shop, a product, Bag, Wig Guide, About and Contact load on phone and laptop
- Add to bag → the bag offers "order on WhatsApp" (checkout redirects to the bag while payments are off)
- `/admin` accepts the admin login

## 5. Turning features on

- **Payments:** set the Paystack test key + `PAYMENTS_ENABLED=true`, place a test order, then switch to the live key and set `PAYSTACK_LIVE_APPROVED=true`. Add the webhook URL `<SITE_URL>/api/payments/paystack/webhook` in the Paystack dashboard.
- **Emails:** add the Resend key and a verified sender domain.
- **Meta Pixel:** add `META_PIXEL_ID`; visitors see a consent banner and the pixel loads only if they accept.

## Housekeeping

`vercel.json` runs `/api/cron/expire` daily (the free plan's limit). It cancels unpaid orders and releases reserved stock. If stock tracking is turned on and the plan allows it, make it hourly (`0 * * * *`).
