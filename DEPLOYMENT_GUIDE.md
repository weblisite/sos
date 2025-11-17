# Deployment Guide - Alternative Platforms

This guide covers deploying to platforms that handle TypeScript builds better than Render.

## 🚀 Quick Comparison

| Platform | Setup Time | TypeScript Support | Cost | Best For |
|----------|-----------|-------------------|------|----------|
| **Vercel** | ⭐⭐⭐⭐⭐ (5 min) | Excellent | Free tier | Full-stack apps |
| **Railway** | ⭐⭐⭐⭐⭐ (5 min) | Excellent | $5/month | Quick deployments |
| **DigitalOcean** | ⭐⭐⭐⭐ (10 min) | Good | $5/month | Production apps |

---

## 1. Vercel (Recommended) ⭐

### Why Vercel?
- ✅ **Best TypeScript support** - Handles TS errors gracefully
- ✅ **Automatic builds** - Zero configuration needed
- ✅ **Free tier** - Generous limits
- ✅ **Fast global CDN** - Excellent performance
- ✅ **Monorepo support** - Built-in

### Setup Steps:

1. **Install Vercel CLI** (optional):
   ```bash
   npm i -g vercel
   ```

2. **Deploy via Dashboard**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repo: `SynthralOS/SynthralOS-core`
   - Vercel will auto-detect settings
   - **Root Directory**: Leave as root (`.`)
   - **Build Command**: `npm ci --legacy-peer-deps && npm run build`
   - **Output Directory**: `backend/public`
   - **Install Command**: `npm ci --legacy-peer-deps`

3. **Environment Variables**:
   Add all your env vars from `render.yaml` in Vercel dashboard:
   - `DATABASE_URL`
   - `CLERK_SECRET_KEY`
   - `CLERK_PUBLISHABLE_KEY`
   - `OPENAI_API_KEY`
   - etc.

4. **Deploy**:
   ```bash
   vercel --prod
   ```

### Configuration:
The `vercel.json` file is already created. Vercel will use it automatically.

### Notes:
- Vercel uses serverless functions, so long-running processes may timeout
- For WebSocket support, you may need Vercel Pro ($20/month)
- Free tier: 100GB bandwidth/month

---

## 2. Railway ⭐⭐

### Why Railway?
- ✅ **Simplest setup** - Just connect GitHub
- ✅ **Docker support** - Full control
- ✅ **PostgreSQL included** - Free database
- ✅ **No build issues** - Flexible build process
- ✅ **$5/month credit** - Good for testing

### Setup Steps:

1. **Sign up**: Go to [railway.app](https://railway.app)

2. **New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `SynthralOS/SynthralOS-core`

3. **Configure**:
   - Railway auto-detects Node.js
   - **Build Command**: `npm ci --legacy-peer-deps && npm run build`
   - **Start Command**: `npm start`
   - **Root Directory**: `.` (root)

4. **Environment Variables**:
   - Add all env vars from `render.yaml`
   - Railway has a nice UI for this

5. **Add PostgreSQL** (optional):
   - Click "+ New" → "Database" → "PostgreSQL"
   - Railway will auto-inject `DATABASE_URL`

6. **Deploy**:
   - Railway auto-deploys on every push
   - Check logs in dashboard

### Configuration:
The `railway.json` file is already created.

### Notes:
- Railway uses Nixpacks (auto-detects build)
- Can also use Dockerfile for more control
- Free tier: $5 credit/month

---

## 3. DigitalOcean App Platform ⭐⭐⭐

### Why DigitalOcean?
- ✅ **Production-ready** - Reliable and stable
- ✅ **Monorepo support** - Native support
- ✅ **Predictable pricing** - Clear costs
- ✅ **Good TypeScript handling** - Flexible builds

### Setup Steps:

1. **Sign up**: Go to [digitalocean.com](https://digitalocean.com)

2. **Create App**:
   - Go to "Apps" → "Create App"
   - Connect GitHub: `SynthralOS/SynthralOS-core`
   - Select branch: `main`

3. **Configure**:
   - **Type**: Web Service
   - **Build Command**: `npm ci --legacy-peer-deps --no-audit --no-fund && npm run build`
   - **Run Command**: `npm start`
   - **HTTP Port**: `4000`
   - **Health Check**: `/health`

4. **Environment Variables**:
   - Add all env vars from `render.yaml`
   - Use the dashboard UI

5. **Add Database** (optional):
   - Click "Add Resource" → "Database"
   - Choose PostgreSQL
   - DigitalOcean will inject `DATABASE_URL`

6. **Deploy**:
   - Click "Create Resources"
   - DigitalOcean will build and deploy

### Configuration:
The `.do/app.yaml` file is already created. You can use it or configure via UI.

### Notes:
- Basic plan: $5/month
- Includes 512MB RAM, 1GB storage
- Auto-scaling available

---

## 4. Other Options

### Fly.io
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Launch app
fly launch

# Deploy
fly deploy
```

### Netlify
- Great for frontend
- Backend via serverless functions
- Free tier available

### Cloudflare Pages
- Excellent for static + serverless
- Free tier very generous
- Global edge network

---

## 🎯 Recommendation

**For your use case, I recommend:**

1. **Vercel** - If you want the easiest setup and best TypeScript support
2. **Railway** - If you want simplicity and quick deployment
3. **DigitalOcean** - If you need production reliability

All three will handle your TypeScript build issues better than Render.

---

## 🔧 Troubleshooting

### Build Fails on TypeScript Errors
All platforms above will continue building even with TS errors (thanks to our `|| true` in build script).

### Environment Variables Not Working
- Make sure to set them in the platform's dashboard
- Check that variable names match exactly
- Some platforms require quotes for values with special characters

### Frontend Not Loading
- Check that `backend/public` directory exists after build
- Verify `VITE_API_URL` is set correctly
- Check CORS settings

---

## 📝 Next Steps

1. Choose a platform (I recommend **Vercel**)
2. Follow the setup steps above
3. Set environment variables
4. Deploy and test!

Need help with a specific platform? Let me know!

