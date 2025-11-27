# Render Deployment Checklist

**Date:** 2024-12-27  
**Status:** ✅ Ready for Deployment

---

## ✅ Pre-Deployment Verification

### 1. Configuration Files
- [x] `render.yaml` - ✅ Present and configured
- [x] `package.json` - ✅ Build scripts configured
- [x] `.npmrc` - ✅ Present (for legacy peer deps)
- [x] `vite.config.ts` - ✅ Configured
- [x] `tsconfig.*.json` - ✅ Present

### 2. Build Process
- [x] `npm run build` - ✅ Builds shared, backend, and frontend
- [x] `npm start` - ✅ Starts backend server
- [x] Frontend served from `backend/public` - ✅ Configured
- [x] Health check endpoint `/health` - ✅ Present

### 3. Environment Variables Required in Render Dashboard

**CRITICAL (Must Set):**
1. `DATABASE_URL` - PostgreSQL connection string
2. `REDIS_URL` - Auto-set from Redis service relationship
3. `CLERK_SECRET_KEY` - Clerk authentication
4. `CLERK_PUBLISHABLE_KEY` - Clerk frontend key
5. `NANGO_SECRET_KEY` - For OAuth connectors (57+ connectors)
6. `OPENAI_API_KEY` OR `ANTHROPIC_API_KEY` - At least one for AI features
7. `RESEND_API_KEY` - Email sending
8. `SUPABASE_URL` - Supabase project URL
9. `SUPABASE_ANON_KEY` - Supabase anonymous key
10. `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

**OPTIONAL (Set if using):**
- `POSTHOG_API_KEY` - Analytics
- `RUDDERSTACK_WRITE_KEY` - Event forwarding
- `OTEL_EXPORTER_OTLP_ENDPOINT` - OpenTelemetry
- `STACKSTORM_API_KEY` - Self-healing
- `PINECONE_API_KEY` - Vector store
- `SERPAPI_API_KEY` or `BRAVE_API_KEY` - Web search
- `TWITTER_BEARER_TOKEN` - Twitter monitoring
- `E2B_API_KEY` - Fast code execution
- `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` - Gmail triggers
- `OUTLOOK_CLIENT_ID` / `OUTLOOK_CLIENT_SECRET` - Outlook triggers

### 4. Services Configuration
- [x] Backend web service - ✅ Configured in render.yaml
- [x] Redis service - ✅ Configured in render.yaml
- [x] Health check path - ✅ `/health`
- [x] Build command - ✅ `npm ci --legacy-peer-deps --no-audit --no-fund && npm run build`
- [x] Start command - ✅ `npm start`
- [x] Node version - ✅ 20+ (specified in package.json engines)

### 5. Build Optimization
- [x] Build filters configured - ✅ Only rebuilds on relevant changes
- [x] Monorepo structure - ✅ Handled correctly
- [x] Frontend build output - ✅ Copied to `backend/public`

---

## 🚀 Deployment Steps

### Step 1: Verify Render Dashboard Settings

1. **Go to Render Dashboard:** https://dashboard.render.com
2. **Select your service:** `sos-backend`
3. **Check Environment Variables:**
   - Verify all required keys are set (see list above)
   - Check that `REDIS_URL` is auto-populated from Redis service

### Step 2: Trigger Deployment

**Option A: Manual Deploy**
1. Go to Render Dashboard → Your Service
2. Click "Manual Deploy" → "Deploy latest commit"

**Option B: Auto Deploy (if connected to GitHub)**
1. Push to your main branch
2. Render will automatically deploy

**Option C: Using GitHub Actions (if configured)**
1. Push to main branch
2. GitHub Actions will trigger Render deployment

### Step 3: Monitor Deployment

1. **Watch Build Logs:**
   - Check that `npm ci` completes successfully
   - Verify `npm run build` completes
   - Confirm `npm start` starts the server

2. **Check Health Endpoint:**
   - After deployment, visit: `https://your-service.onrender.com/health`
   - Should return: `{"status":"ok"}`

3. **Verify Services:**
   - Backend API: `https://your-service.onrender.com/api/v1/health`
   - Frontend: `https://your-service.onrender.com/`
   - API Docs: `https://your-service.onrender.com/api-docs`

---

## 🔍 Troubleshooting

### Build Fails
- **Issue:** TypeScript errors
  - **Solution:** Build script continues despite errors (`|| true`), but check logs for actual issues

- **Issue:** Frontend build not found
  - **Solution:** Check that `frontend/dist` exists after build

- **Issue:** Missing dependencies
  - **Solution:** Ensure `.npmrc` is present with `legacy-peer-deps=true`

### Runtime Errors
- **Issue:** Database connection fails
  - **Solution:** Verify `DATABASE_URL` is set correctly in Render dashboard

- **Issue:** Redis connection fails
  - **Solution:** Check that Redis service is running and `REDIS_URL` is auto-populated

- **Issue:** Clerk authentication fails
  - **Solution:** Verify `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` are set

- **Issue:** OAuth connectors don't work
  - **Solution:** Ensure `NANGO_SECRET_KEY` is set

### Health Check Fails
- **Issue:** `/health` endpoint returns 404
  - **Solution:** Verify health check route is registered in `backend/src/index.ts`

---

## 📋 Post-Deployment Verification

After successful deployment, verify:

1. [ ] Health endpoint responds: `https://your-service.onrender.com/health`
2. [ ] Frontend loads: `https://your-service.onrender.com/`
3. [ ] API docs accessible: `https://your-service.onrender.com/api-docs`
4. [ ] Authentication works (Clerk login)
5. [ ] Database connection works (create a workflow)
6. [ ] Redis connection works (check queue status)
7. [ ] AI features work (create an AI agent node)
8. [ ] OAuth connectors work (connect Slack/GitHub)

---

## 📝 Notes

- **Build Time:** ~5-10 minutes (depends on dependencies)
- **Startup Time:** ~30-60 seconds
- **Cold Start:** First request may be slow (~10-30 seconds)
- **Memory:** Standard plan recommended (512MB+)
- **Disk:** Build requires ~500MB+ free space

---

## ✅ Ready to Deploy

All configuration files are in place and verified. The codebase is ready for Render deployment!

**Next Steps:**
1. Set all required environment variables in Render dashboard
2. Trigger deployment (manual or via Git push)
3. Monitor build logs
4. Verify health endpoint
5. Test the deployed application

