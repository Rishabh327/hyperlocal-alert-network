# Free Deployment Guide

| Part | Host (free) | Folder |
|---|---|---|
| Database | MongoDB Atlas (M0, 512 MB) | — |
| Backend API + Socket.IO | Render web service | `backend/` |
| AI scoring service | Render web service | `ai-service/` |
| Frontend (React PWA) | Vercel | `frontend/` |

Photos are stored in MongoDB (`photos` collection), so they survive Render restarts.

---

## 1. MongoDB Atlas

1. Create a free **M0** cluster at https://cloud.mongodb.com.
2. **Database Access** → add a database user with a password (avoid special characters like `@ : / ?` or URL-encode them).
3. **Network Access** → **Add IP Address** → `0.0.0.0/0` (Allow access from anywhere).
   Render has no fixed IP — without this the backend cannot connect and exits.
4. **Connect → Drivers** → copy the connection string and add a database name before the `?`:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/hyperlocal?retryWrites=true&w=majority
   ```

## 2. Push the code to GitHub

```bash
git push origin main
```

## 3. Render — backend and AI service

1. Sign in at https://render.com with GitHub.
2. **New → Blueprint** → pick the `hyperlocal-alert-network` repo. Render reads `render.yaml` and creates
   `alertnet-backend` and `alertnet-ai`.
3. Fill the values it asks for (you can leave the URL ones as a placeholder first and fix them in step 5):
   - `MONGO_URI` — the Atlas string from step 1
   - `CLIENT_URL` — your Vercel URL (step 4), e.g. `https://alertnet.vercel.app` (no trailing slash)
   - `AI_SERVICE_URL` — `https://alertnet-ai.onrender.com` (the AI service's URL)
   - `NODE_BACKEND_URL` (on the AI service) — `https://alertnet-backend.onrender.com`
   - `JWT_SECRET` is generated automatically.
4. Wait for both to show **Live**. Check:
   - `https://alertnet-backend.onrender.com/` → `{"message":"Hyperlocal Alert Network API is running"...}`
   - `https://alertnet-ai.onrender.com/health`

> Render may add a suffix to the service URL (e.g. `alertnet-backend-ab12.onrender.com`). Always copy the exact URL from the dashboard.

## 4. Vercel — frontend

1. Sign in at https://vercel.com with GitHub → **Add New → Project** → import the repo.
2. **Root Directory**: `frontend`. Framework preset: **Vite** (build `npm run build`, output `dist`).
3. **Environment Variables** (no trailing slashes):
   - `VITE_API_URL` = `https://alertnet-backend.onrender.com/api`
   - `VITE_SOCKET_URL` = `https://alertnet-backend.onrender.com`
4. Deploy. `frontend/vercel.json` makes page refreshes on `/map`, `/authority`, etc. work.

> `VITE_*` values are baked in at build time. After changing them, **Redeploy** on Vercel.

## 5. Connect them

1. Copy your final Vercel URL (the production one, e.g. `https://alertnet.vercel.app`).
2. On Render → `alertnet-backend` → **Environment** → set `CLIENT_URL` to it. Several origins can be
   comma-separated. Save (Render redeploys).
3. Make sure `AI_SERVICE_URL` and `NODE_BACKEND_URL` hold the exact Render URLs.

## 6. Create the authority account

Run once from your computer against the Atlas database:

```bash
cd backend
MONGO_URI="your-atlas-string" node scripts/seedAuthority.js
```

(On PowerShell: `$env:MONGO_URI="your-atlas-string"; node scripts/seedAuthority.js`.)

## 7. Keep the backend awake (optional, recommended)

Free Render services sleep after 15 minutes without traffic; the first request then takes ~1 minute,
and live alerts/broadcasts don't arrive while it sleeps.

- Create a free monitor on https://cron-job.org or https://uptimerobot.com that requests
  `https://alertnet-backend.onrender.com/` every 10 minutes.
- Ping **only the backend**: Render's free plan gives 750 instance-hours per month in total, which
  covers one always-on service. The AI service wakes up by itself when an alert is scored.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Render log: `MongoDB Connection Error` then exit | Wrong `MONGO_URI`, wrong password, or Atlas Network Access missing `0.0.0.0/0` |
| Browser console: CORS error | `CLIENT_URL` on Render doesn't exactly match the Vercel URL (check `https`, no trailing `/`). Render logs show `CORS blocked origin: ...` |
| Frontend calls `localhost:5000` | `VITE_API_URL` / `VITE_SOCKET_URL` not set on Vercel, or not redeployed after setting them |
| 404 when refreshing a page on Vercel | Vercel Root Directory isn't `frontend` (so `vercel.json` isn't used) |
| Credibility scores never update | `AI_SERVICE_URL` / `NODE_BACKEND_URL` wrong, or AI service still waking up (wait ~1 min) |
| Location / broadcast prompts don't appear | Geolocation only works over `https` — use the Vercel URL, not an IP |
