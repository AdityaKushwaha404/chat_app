# Deploy backend to Railway (step-by-step)

This guide will deploy the `backend/` service to Railway and configure environment variables so your APK users can connect.

Prerequisites
- GitHub account with the repo pushed.
- Railway account (https://railway.app).
- A MongoDB Atlas cluster (connection string) or another hosted MongoDB.

Required environment variables (set these in Railway project settings):
- `MONGODB_URI` — your MongoDB connection string (include DB name)
- `JWT_SECRET` — a strong random secret (e.g. 32+ chars)
- Optional (if used): Cloudinary keys or other service keys

Railway deploy steps
1. Push your repo to GitHub if not already.
2. Sign in to Railway and create a new project.
3. Choose "Deploy from GitHub" and select this repo's `backend` folder (Railway will detect `package.json`).
4. Under the project settings -> Environment, add the required environment variables listed above.
5. Set the build and start commands (Railway will usually detect them):
   - Build command: `npm run build`
   - Start command: `npm start`
6. Deploy and wait. After deployment completes copy the public domain (e.g. `https://my-chat-backend.up.railway.app`).

Update frontend to point to your backend
1. Edit `frontend/app.json` and set `expo.extra.API_BASE_URL` to your backend URL, for example:

```json
"extra": {
  "API_BASE_URL": "https://my-chat-backend.up.railway.app"
}
```

2. Commit and push the change to GitHub (this is important — EAS will use the repo values at build time).

Build an Android preview APK with EAS
1. Install and login to EAS CLI locally:
```bash
npm install -g eas-cli
eas login
```
2. Ensure `frontend/eas.json` is present (this repo already has a `preview` profile that outputs an `.apk`).
3. Start the build from the `frontend` folder (it will use the `API_BASE_URL` from `app.json`):
```bash
cd frontend
eas build -p android --profile preview
```
4. After the build completes, download the generated `.apk` and share it.

Notes & troubleshooting
- If you need a stable domain for the backend (no downtime), configure Railway's domain settings or use a paid provider.
- If sockets fail, ensure the server URL uses `https://` and Railway exposes websocket support (they do by default for standard setups).
- If you want me to run through these steps interactively, I can prepare the `app.json` (done), create an `eas.json` (done), and provide the exact commands to run locally.

If you want, I can now:
- Deploy to Railway for you (I'll provide exact commands you run locally and what to paste into Railway). 
- Or walk you step-by-step while you deploy.
