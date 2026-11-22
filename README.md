# 93 Kitchen

Arabic RTL ordering website for 93 Kitchen in Amman. Built with the repository’s React 19, Vite and Figma Make setup. Cairo, food photography and brand assets are served locally.

[Interface designs](https://www.figma.com/design/1lyrLGHubD9KHHevKfPW4g/93Kitchen-new?node-id=296-2797) · [Design system](https://www.figma.com/design/1lyrLGHubD9KHHevKfPW4g/93Kitchen-new?node-id=304-2797)

## Run

Use Node 22.13 or newer and pnpm. From the repository root:

```sh
pnpm install --frozen-lockfile
# Set DATABASE_URL in the server environment or a private .env file.
pnpm db:migrate
pnpm dev
```

Development uses the port printed by Vite (8443 by default). To run the production website and its order API on the same origin:

```sh
pnpm build
pnpm start
```

On the published 93kitchenn1.figma.site domain, the updated entrypoint forwards the current route to the full-stack Neon storefront. Publish this source in the corresponding Figma Make project to activate the forwarding.

The production server listens on port 3000 by default. The server connects to Neon PostgreSQL with the server-only `DATABASE_URL`. Apply `pnpm db:migrate` when provisioning a new database. Serve this Node process behind HTTPS for customer use. Static hosting of `dist/` alone serves the storefront and requires a separate same-origin `/api/` route for ordering and accounts.

## Customer flows

- Filter the menu, add meals, adjust quantities and order as a guest or a signed-in customer.
- Choose the 3-meal trial (13 JD), 20-meal chicken plan (79 JD), or 20-meal mixed plan (99 JD). Schedule meals by week, copy a week, add notes and request an alternate date.
- Check coverage and review the delivery charge before submitting. The server calculates the final total from its own catalog.
- Pay at the restaurant with a unique reference and QR, or follow the configured CliQ instructions. Staff record receipt of payment. Customers can track their orders and edit eligible subscription schedules from their account.
- The guest cookie grants access to that browser’s guest orders. Signing in claims orders from the current guest session.

## Restaurant configuration

The server reads variables from its environment or a local `.env` file. Amounts in `DELIVERY_ZONES` are hundredths of a dinar. The address picker lists all 12 Jordanian governorates and accepts a detailed address for other localities. Abdali retains its existing zero charge. Unpriced destinations submit a delivery review request and do not show payment instructions until staff confirm coverage and enter the fee. DELIVERY_ZONES overrides fees by locality.

| Variable | Meaning |
| --- | --- |
| PORT, DATABASE_URL | Listening port and private Neon PostgreSQL connection string |
| COOKIE_SECURE | Set to 1 on HTTPS |
| DELIVERY_ZONES | JSON object such as `{"العبدلي":0}` |
| CLIQ_ALIAS, CLIQ_HOLDER, CLIQ_BANK | Verified restaurant transfer details. If the alias is absent, the receipt directs customers to contact the restaurant |
| KITCHEN_PHONE, KITCHEN_WHATSAPP, KITCHEN_FACEBOOK | Optional official contact details. WhatsApp uses the international number with country code |
| OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI | Optional OIDC broker settings for social sign-in. Register the exact callback URL ending in `/api/auth/callback` |
| OIDC_GOOGLE_CONNECTION, OIDC_APPLE_CONNECTION, OIDC_FACEBOOK_CONNECTION | Optional upstream connection names for a broker supporting the Auth0-style `connection` parameter. A configured connection enables its button. Email/password sign-in works independently |

## Staff access

Set `STAFF_PASSWORD` in the shell environment before running `pnpm staff -- manager@example.com "اسم المدير"`. The password must contain at least 12 characters. The default role is admin. To create a regular employee, set `STAFF_ROLE=staff` before running the same command with that employee’s email and name.

Staff sign in at `/#/staff`. A manager can grant or remove finance access for staff. The finance view supports search, status filtering, reconciliation and order progression from pending payment through completion.

## Checks

```sh
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

The integration test runs against a temporary local PostgreSQL-compatible PGlite database and covers guest order ownership, checkout retries, QR references, monthly and trial plan validation, account sign-in and staff reconciliation.

## Neon deployment

The project uses the database `kitchen93` on its `production` branch. Supply a private Neon connection string to a Node deployment. Keep it outside the repository and client-side Vite variables. With Neon Functions, the runtime supplies the connection. Set `COOKIE_SECURE=1` on HTTPS.

The optional same-origin Neon Function serves the React build and order API. On Node 24 with the zip utility available, run `pnpm build` followed by `node scripts/package-function.mjs /tmp/kitchen-function.zip`. Deploy the resulting ZIP as the `kitchen` function. The package includes only bundled server code and built public assets.

Google sign-in uses the managed Neon Auth Google provider and a trusted storefront origin. The Function uses NEON_AUTH_BASE_URL and NEON_AUTH_JWKS_URL, checks the signed identity against the Neon Auth Google account, and issues a first-party kitchen session. Existing password accounts retain their original login.
