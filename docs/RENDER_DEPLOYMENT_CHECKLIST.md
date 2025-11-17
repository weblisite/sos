# Render Deployment Checklist

## ✅ Code Readiness Status

### 1. GitHub Actions Workflow ✅
- [x] `.github/workflows/render-deploy.yml` exists
- [x] Workflow triggers on `main` branch push
- [x] Workflow can be triggered manually
- [x] Uses `RENDER_DEPLOY_HOOK` secret

### 2. Render Configuration ✅
- [x] `render.yaml` exists and is configured
- [x] Build command: `npm ci --legacy-peer-deps --no-audit --no-fund && npm run build`
- [x] Start command: `npm start` (runs `cd backend && node dist/index.js`)
- [x] Health check path: `/health`
- [x] Redis service configured
- [x] Environment variables defined

### 3. Build Configuration ✅
- [x] `package.json` has correct build scripts
- [x] Backend build handles TypeScript compilation
- [x] Frontend build copies to `backend/public`
- [x] Server binds to `0.0.0.0` (required for Render)

### 4. Required Setup (You Need to Do This)

#### Step 1: Create Render Service
- [ ] Go to [Render Dashboard](https://dashboard.render.com)
- [ ] Create service from Blueprint (using `render.yaml`) OR create manually
- [ ] Service name should match `sos-backend` (or update `render.yaml`)

#### Step 2: Create Deploy Hook
- [ ] Go to your Render service → **Settings** → **Deploy Hooks**
- [ ] Click **"Create Deploy Hook"**
- [ ] Copy the Deploy Hook URL

#### Step 3: Add GitHub Secret
- [ ] Go to GitHub repository → **Settings** → **Secrets and variables** → **Actions**
- [ ] Click **"New repository secret"**
- [ ] Name: `RENDER_DEPLOY_HOOK`
- [ ] Value: Paste the Deploy Hook URL
- [ ] Click **"Add secret"**

#### Step 4: Set Environment Variables in Render
- [ ] Go to Render service → **Environment**
- [ ] Add all required environment variables (see `render.yaml` for list)
- [ ] Required variables:
  - `DATABASE_URL` (Supabase)
  - `CLERK_SECRET_KEY`
  - `CLERK_PUBLISHABLE_KEY`
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `RESEND_API_KEY`
  - `NANGO_SECRET_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

#### Step 5: Create Redis Service
- [ ] Create Redis service on Render (or use `render.yaml` Blueprint)
- [ ] Service name should be `sos-redis` (or update `render.yaml`)

## 🚀 Testing Deployment

### Test 1: Manual Trigger
1. Go to GitHub → **Actions** → **Deploy to Render**
2. Click **"Run workflow"**
3. Select branch: `main`
4. Click **"Run workflow"**
5. Check the workflow logs

### Test 2: Push to Main
1. Make a small change (e.g., update README)
2. Commit and push:
   ```bash
   git add .
   git commit -m "Test Render deployment"
   git push origin main
   ```
3. Check GitHub Actions tab
4. Check Render dashboard for new deployment

## ✅ Verification

After deployment, verify:
- [ ] GitHub Actions workflow completes successfully
- [ ] Render shows new deployment triggered
- [ ] Build completes on Render
- [ ] Health check passes: `https://your-service.onrender.com/health`
- [ ] Application is accessible

## 🐛 Troubleshooting

### Workflow Fails
- Check that `RENDER_DEPLOY_HOOK` secret is set correctly
- Verify the deploy hook URL is valid
- Check GitHub Actions logs for error messages

### Build Fails on Render
- Check Render build logs
- Verify `render.yaml` build command is correct
- Ensure all dependencies are in `package.json`

### Application Not Starting
- Check Render runtime logs
- Verify `backend/dist/index.js` exists after build
- Check that server binds to `0.0.0.0:4000`
- Verify health check endpoint works

## 📝 Notes

- The code is **ready** for deployment
- You just need to complete the setup steps above
- Once `RENDER_DEPLOY_HOOK` secret is added, deployments will trigger automatically
- Both Fly.io and Render can deploy simultaneously from the same push

