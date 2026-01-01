Deployment and sharing checklist

1) Push all repo changes to GitHub

# From project root
git status
# stage all changes
git add -A
# commit
git commit -m "chore: set API_BASE_URL and add render config"
# push
git push origin main

2) Ensure local secrets are not tracked
# remove local backend .env from git if present (keeps file locally)
git rm --cached backend/.env || true
# add to .gitignore if not present
grep -qxF "backend/.env" .gitignore 2>/dev/null || echo "backend/.env" >> .gitignore
git add .gitignore
git commit -m "chore: ignore local backend env" || true

everything pushed? proceed to build APK with EAS

3) Prepare for EAS build (on your machine)
# install CLI if needed
npm install -g eas-cli
# login (choose your Expo account)
eas login

# from frontend folder:
cd frontend
# optional: install dependencies
npm install
# start EAS build for Android (preview profile already in eas.json)
eas build -p android --profile preview

When build completes, download the generated APK and share it with your friend.

Notes:
- The frontend now points to the Render backend at https://chat-app-8e91.onrender.com via `expo.extra.API_BASE_URL` in `frontend/app.json`.
- Cloudinary uploads use an unsigned preset; ensure your Cloudinary preset `chat_app_images` is unsigned if you want client-side uploads to work.
- If you want server-signed uploads (more secure), I can add a signing endpoint to the backend.
