# Railway Deployment Setup Checklist

## ✅ Quick Setup Steps

### Step 1: Create Railway Account
- [ ] Go to [railway.app](https://railway.app)
- [ ] Sign up with GitHub
- [ ] Authorize Railway to access your repositories

### Step 2: Create Project
- [ ] Click **"New Project"**
- [ ] Select **"Deploy from GitHub repo"**
- [ ] Choose repository: `SynthralOS/SynthralOS-core`
- [ ] Railway will auto-detect and create service

### Step 3: Configure Service
- [ ] Railway will use `railway.json` (configured for Docker)
- [ ] Verify build settings:
  - Builder: Dockerfile
  - Dockerfile: `Dockerfile`
  - Port: `4000` (auto-detected)

### Step 4: Add Environment Variables
Go to your service → **Variables** tab and add:

**Required:**
- [ ] `NODE_ENV=production`
- [ ] `PORT=4000` (Railway sets this automatically, but good to have)
- [ ] `HOST=0.0.0.0`
- [ ] `DATABASE_URL` (from Supabase)
- [ ] `REDIS_URL` (if using Railway Redis, auto-set)
- [ ] `CLERK_SECRET_KEY`
- [ ] `CLERK_PUBLISHABLE_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `RESEND_API_KEY`
- [ ] `NANGO_SECRET_KEY`
- [ ] `NANGO_HOST=https://api.nango.dev`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `CORS_ORIGIN` (set to your Railway app URL after deployment)

**Optional:**
- [ ] `OTEL_ENABLED=false`
- [ ] `POSTHOG_API_KEY`
- [ ] `JWT_SECRET` (auto-generated if not set)

### Step 5: Add Redis Service (Optional)
- [ ] Click **"+ New"** → **"Database"** → **"Redis"**
- [ ] Railway will auto-inject `REDIS_URL` environment variable
- [ ] Link Redis service to your backend service

### Step 6: Setup GitHub Actions
- [ ] Go to Railway Dashboard → Account Settings → Tokens
- [ ] Click **"New Token"**
- [ ] Copy the token
- [ ] Go to GitHub → Repository → Settings → Secrets and variables → Actions
- [ ] Add secret: `RAILWAY_TOKEN` = (paste token)
- [ ] (Optional) Add secret: `RAILWAY_SERVICE_ID` = (your service ID)

### Step 7: Test Deployment
- [ ] Push to `main` branch
- [ ] Check GitHub Actions - workflow should run
- [ ] Check Railway dashboard - deployment should start
- [ ] Monitor build logs
- [ ] Verify deployment completes successfully

### Step 8: Verify Application
- [ ] Get your Railway app URL from dashboard
- [ ] Test health endpoint: `https://your-app.railway.app/health`
- [ ] Update `CORS_ORIGIN` to your Railway app URL
- [ ] Test full application functionality

## 🎯 Railway Configuration

### Current Setup
- **Builder**: Dockerfile (matches local environment)
- **Dockerfile**: `Dockerfile` (multi-stage build)
- **Start Command**: `npm start` (runs `cd backend && node dist/index.js`)
- **Port**: `4000` (auto-detected by Railway)

### Auto-Deploy
- ✅ Automatic deployment on push to `main`
- ✅ GitHub Actions workflow triggers Railway CLI deployment
- ✅ Railway dashboard shows deployment status

## 📝 Notes

- Railway uses Docker for builds (same as local)
- Environment variables are set in Railway dashboard
- Redis can be added as a Railway service (auto-linked)
- PostgreSQL can use Railway's or external (Supabase)
- WebSockets are fully supported
- Long-running processes are supported

## 🔄 Migration from Render

If you're migrating from Render:

1. **Export environment variables** from Render
2. **Create Railway project** (steps above)
3. **Import environment variables** to Railway
4. **Update external service URLs:**
   - Nango callbacks → Railway backend URL
   - Clerk redirects → Railway frontend URL
5. **Test deployment**
6. **Update DNS** (if using custom domain)

## ✅ Verification

After setup, verify:
- [ ] Build completes successfully
- [ ] Application starts without errors
- [ ] Health check endpoint works: `/health`
- [ ] WebSocket connections work
- [ ] Database connections work
- [ ] Redis connections work
- [ ] All API endpoints respond correctly

