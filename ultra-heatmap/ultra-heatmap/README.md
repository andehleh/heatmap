# Ultra 2026 Heatmap 🎧

A shareable festival heatmap for your crew. Everyone opens the same link, enters their name, picks their must-see sets, and the Results tab shows the group's rankings in real-time.

---

## Deploy in 15 minutes (all free)

### Step 1: Set up Firebase (5 min)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Create a project"** → name it `ultra-heatmap` → Continue
3. Disable Google Analytics (you don't need it) → Create project
4. In the sidebar, click **"Build" → "Realtime Database"**
5. Click **"Create Database"** → choose any region → **"Start in test mode"** → Enable
6. In the sidebar, click the **gear icon** → **"Project settings"**
7. Scroll down to **"Your apps"** → click the **Web icon** (`</>`)
8. Name it `ultra-heatmap` → Register app
9. Copy the `firebaseConfig` object — you'll need it in the next step

### Step 2: Add your Firebase credentials (1 min)

Open `lib/firebase.js` and replace the placeholder config with your values:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",           // from Firebase console
  authDomain: "ultra-heatmap-xxxxx.firebaseapp.com",
  databaseURL: "https://ultra-heatmap-xxxxx-default-rtdb.firebaseio.com",
  projectId: "ultra-heatmap-xxxxx",
  storageBucket: "ultra-heatmap-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
};
```

### Step 3: Push to GitHub (3 min)

1. Create a new repo at [github.com/new](https://github.com/new) — name it `ultra-heatmap`
2. In your terminal:

```bash
cd ultra-heatmap
git init
git add .
git commit -m "Ultra 2026 heatmap"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ultra-heatmap.git
git push -u origin main
```

### Step 4: Deploy to Vercel (3 min)

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click **"Add New..." → "Project"**
3. Select your `ultra-heatmap` repo → **Import**
4. Framework: **Next.js** (auto-detected)
5. Click **Deploy** — wait ~1 min
6. Done! You'll get a URL like `ultra-heatmap.vercel.app`

### Step 5 (optional): Custom domain

1. In Vercel dashboard → your project → **Settings → Domains**
2. Add `ultraheatmap.com` (buy from [Namecheap](https://namecheap.com) or [Cloudflare](https://cloudflare.com) — ~$10/year)
3. Update DNS records as Vercel tells you
4. SSL is automatic

---

## How it works

- **Welcome screen**: Each person enters their name
- **Heatmap tab**: Tap once = interested (yellow), tap again = must see (orange), tap again = clear
- **My Schedule tab**: See your picks organized by day + stage breakdown
- **Results tab**: Group rankings with percentage bars, showing who picked what
- **Real-time**: Firebase syncs everyone's picks live — no refresh needed

---

## Tech stack

- **Next.js 14** — React framework
- **Firebase Realtime Database** — shared storage (free tier: 1GB stored, 10GB/month transfer)
- **Vercel** — hosting (free tier: unlimited deploys)
- **Tailwind CSS** — utility styles

Total cost: **$0** (or ~$10/year if you want a custom domain)
