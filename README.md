# Expense Tracker

Simple expense tracker app with:

- custom categories
- expense entry form
- weekly dashboard view
- Sunday as the start of each week
- shared database sync across devices

## Run locally

```powershell
cd "C:\Users\Mihir\Coding\Personal Projects\expense-tracker"
npm.cmd start
```

Then open `http://localhost:3000`.

To use the synced backend locally or on Vercel, set one of these environment variables:

- `POSTGRES_URL`
- `DATABASE_URL`

The app creates its tables automatically on first request.

## Vercel database setup

1. Create a Vercel Postgres database in your Vercel project.
2. Make sure the project has `POSTGRES_URL` available.
3. Deploy the app.

The frontend reads and writes through `/api/bootstrap`, `/api/categories`, and `/api/expenses`, so your phone and laptop will stay in sync once the deployed app is using the shared database.

## Install as an app

After deploying over HTTPS, you can install it as a PWA.

- On iPhone: open the site in Safari, tap Share, then tap `Add to Home Screen`.
- On desktop Chrome/Edge: use the install button in the address bar.
