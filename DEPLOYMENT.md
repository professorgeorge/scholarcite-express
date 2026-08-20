# ScholarCite Express - Web Application & GitHub Pages Deployment Guide

ScholarCite Express includes a **100% standalone, serverless Web Application and Product Landing Page** located in the [`docs/`](file:///c:/Users/babug/.gemini/antigravity/scratch/scholarcite-express/docs) and [`netlify-site/`](file:///c:/Users/babug/.gemini/antigravity/scratch/scholarcite-express/netlify-site) directories.

---

## 🚀 Option 1: Publish on GitHub Pages (Recommended)

GitHub Pages hosts your website directly from your GitHub repository for free with zero setup.

### Step 1: Push the Repository to GitHub
In your terminal / PowerShell:
```bash
git init
git add .
git commit -m "feat: ScholarCite Express v1.2.0 Web Application & Extension"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY_NAME>.git
git push -u origin main
```

### Step 2: Enable GitHub Pages in Repository Settings
1. Open your repository on **GitHub.com**.
2. Click **Settings** (top tabs) &rarr; Click **Pages** (in the left sidebar).
3. Under **Build and deployment** &rarr; **Branch**:
   - Select Branch: `main`
   - Select Folder: `/docs` (Important: Choose `/docs`!)
4. Click **Save**.

🎉 Within 1–2 minutes, your website will be live at:
`https://<YOUR_GITHUB_USERNAME>.github.io/<YOUR_REPOSITORY_NAME>/`

---

## ⚡ Option 2: Publish on Netlify

### Drag & Drop (Instant - 10 Seconds)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag and drop the `docs` (or `netlify-site`) folder from your computer into the browser.
3. Your site is instantly live with a free custom SSL URL!

### Connect to GitHub (Continuous Deployment)
1. Log in to [Netlify](https://app.netlify.com/).
2. Click **Add new site** &rarr; **Import an existing project** &rarr; **GitHub**.
3. Select your repository.
4. Set **Publish directory** to: `docs`
5. Click **Deploy Site**. Every time you push changes to GitHub, Netlify updates your site automatically.

---

## 🌐 Option 3: Publish on Vercel

1. Go to [Vercel](https://vercel.com/) and click **Add New Project**.
2. Import your GitHub repository.
3. In **Root Directory**, select `docs`.
4. Click **Deploy**.

---

## 🧪 Local Testing
To test the web application locally on your computer before publishing:
1. Open [`docs/index.html`](file:///c:/Users/babug/.gemini/antigravity/scratch/scholarcite-express/docs/index.html) directly in any web browser (Chrome, Edge, Firefox, Safari).
2. Or run a lightweight local server:
   ```bash
   npx serve docs
   ```
   and navigate to `http://localhost:3000`.
