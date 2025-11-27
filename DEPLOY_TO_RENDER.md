# 🚀 Deploy to Render - Quick Start Guide

**Status:** ✅ **Codebase is Ready for Deployment**

---

## ✅ Pre-Deployment Verification - COMPLETE

All required files and configurations are in place:

- ✅ `render.yaml` - Render Blueprint configuration
- ✅ `package.json` - Build and start scripts configured
- ✅ `.npmrc` - Legacy peer deps configuration
- ✅ `vite.config.ts` - Frontend build configuration
- ✅ Health check endpoint `/health` - Configured
- ✅ Static file serving - Frontend served from `backend/public`
- ✅ Node.js 20+ - Specified in package.json engines

---

## 🚀 Deployment Steps

### Step 1: Go to Render Dashboard

1. Visit: https://dashboard.render.com
2. Sign in or create account

### Step 2: Create/Update Blueprint

**If creating new:**
1. Click "New +" → "Blueprint"
2. Connect your GitHub repository
3. Render will auto-detect `render.yaml`

**If updating existing:**
1. Go to your existing service
2. Click "Manual Deploy" → "Deploy latest commit"

### Step 3: Set Environment Variables

Go to your service → **Environment** → Add these **REQUIRED** variables:

```
DATABASE_URL=postgresql://user:password@host:5432/database
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
NANGO_SECRET_KEY=nango_sk_...
OPENAI_API_KEY=sk-... (or ANTHROPIC_API_KEY=sk-ant-...)
RESEND_API_KEY=re_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Note:** `REDIS_URL` is automatically set from the Redis service relationship.

### Step 4: Deploy

**Option A: Manual Deploy**
- Click "Manual Deploy" → "Deploy latest commit"

**Option B: Auto Deploy (Recommended)**
- Push to main branch
- Render will automatically deploy

### Step 5: Verify

After deployment (5-10 minutes), test:

1. **Health:** `https://your-service.onrender.com/health`
2. **Frontend:** `https://your-service.onrender.com/`
3. **API Docs:** `https://your-service.onrender.com/api-docs`

---

## 📋 Required Environment Variables

### **MUST SET (10 variables):**

1. `DATABASE_URL` - PostgreSQL connection string
2. `CLERK_SECRET_KEY` - Clerk authentication
3. `CLERK_PUBLISHABLE_KEY` - Clerk frontend key
4. `NANGO_SECRET_KEY` - For OAuth connectors (57+ connectors)
5. `OPENAI_API_KEY` OR `ANTHROPIC_API_KEY` - At least one for AI
6. `RESEND_API_KEY` - Email sending
7. `SUPABASE_URL` - Supabase project URL
8. `SUPABASE_ANON_KEY` - Supabase anonymous key
9. `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
10. `REDIS_URL` - Auto-set from Redis service (no action needed)

### **OPTIONAL (Set if using):**

- `POSTHOG_API_KEY` - Analytics
- `RUDDERSTACK_WRITE_KEY` - Event forwarding
- `PINECONE_API_KEY` - Vector store for RAG
- `SERPAPI_API_KEY` or `BRAVE_API_KEY` - Web search in agents
- `TWITTER_BEARER_TOKEN` - Twitter monitoring
- `E2B_API_KEY` - Fast code execution
- `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` - Gmail triggers
- `OUTLOOK_CLIENT_ID` / `OUTLOOK_CLIENT_SECRET` - Outlook triggers

**See `API_KEYS_COMPLETE_LIST.md` for full list of 112 keys.**

---

## 🔍 Build Process

Render will execute:

1. **Install:** `npm ci --legacy-peer-deps --no-audit --no-fund`
2. **Build:** `npm run build`
   - Builds shared package
   - Builds backend
   - Builds frontend
   - Copies frontend to `backend/public`
3. **Start:** `npm start`
   - Starts server on port 4000
   - Serves API and frontend

**Expected Build Time:** 5-10 minutes

---

## ✅ Verification Checklist

After deployment:

- [ ] Health endpoint responds: `/health`
- [ ] Frontend loads: `/`
- [ ] API docs accessible: `/api-docs`
- [ ] Authentication works (Clerk login)
- [ ] Database connection works
- [ ] Redis connection works
- [ ] AI features work (if API keys set)
- [ ] OAuth connectors work (if Nango key set)

---

## 🎯 **READY TO DEPLOY!**

Everything is configured and ready. Just:

1. Set environment variables in Render dashboard
2. Deploy (manual or auto)
3. Wait 5-10 minutes
4. Test your deployment!

**For detailed troubleshooting, see `RENDER_DEPLOYMENT_CHECKLIST.md`**

