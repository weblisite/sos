# Setup Guide - Supabase + Render

This guide will help you set up and run the SOS Automation Platform using Supabase and Render (no Docker required!).

## Prerequisites

- **Node.js** 18+ and npm 9+
- **Git** account (for Render deployment)
- **Supabase** account (free tier available)
- **Render** account (free tier available)

## Quick Start

### 1. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to be provisioned (takes ~2 minutes)
4. Go to **Settings** → **API** and copy:
   - Project URL (SUPABASE_URL)
   - Anon/Public Key (SUPABASE_ANON_KEY)
   - Service Role Key (SUPABASE_SERVICE_ROLE_KEY) - keep this secret!
5. Go to **Settings** → **Database** and copy the connection string (DATABASE_URL)

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install workspace dependencies
npm install --workspaces
```

### 3. Configure Environment Variables

#### Backend

Create `backend/.env`:

```env
NODE_ENV=development
PORT=4000

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Database (from Supabase Settings → Database)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres

# Redis (local for development, or use Render Redis URL)
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGIN=http://localhost:3000

# AI Providers (optional)
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
```

#### Frontend

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set Up Database Schema

```bash
cd backend

# Push schema to Supabase
npm run db:push

# Or generate and run migrations
npm run db:generate
npm run db:migrate
```

### 5. Set Up Redis (Local Development)

#### Option A: Use Render Redis (Recommended)

1. Create a Redis service on Render (free tier available)
2. Copy the Redis connection URL
3. Use it in `backend/.env`: `REDIS_URL=redis://red-xxxxx:6379`

#### Option B: Install Redis Locally

```bash
# macOS
brew install redis
brew services start redis

# Linux (Ubuntu/Debian)
sudo apt install redis-server
sudo systemctl start redis

# Windows
# Use WSL or download from redis.io
```

### 6. Start Development Servers

```bash
# From root directory - starts both frontend and backend
npm run dev

# Or start separately:
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### 7. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **API Health Check**: http://localhost:4000/health
- **Supabase Dashboard**: https://app.supabase.com

## Deployment to Render

### Step 1: Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/sos-automation.git
git push -u origin main
```

### Step 2: Create Redis Service on Render

1. Go to [render.com](https://render.com) and sign up/login
2. Click **New +** → **Redis**
3. Name it `sos-redis`
4. Select **Starter** plan (free tier)
5. Click **Create Redis**
6. Copy the **Internal Redis URL** (you'll need this)

### Step 3: Deploy Backend

1. Click **New +** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `sos-backend`
   - **Environment**: `Node`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `PORT` = `4000`
   - `DATABASE_URL` = (from Supabase)
   - `REDIS_URL` = (from Render Redis - use Internal URL)
   - `SUPABASE_URL` = (from Supabase)
   - `SUPABASE_ANON_KEY` = (from Supabase)
   - `SUPABASE_SERVICE_ROLE_KEY` = (from Supabase)
   - `CORS_ORIGIN` = (will be your frontend URL)
   - `JWT_SECRET` = (generate a random string)
5. Click **Create Web Service**

### Step 4: Deploy Frontend

1. Click **New +** → **Static Site**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `sos-frontend`
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add Environment Variables:
   - `VITE_API_URL` = (your backend URL from Step 3, e.g., `https://sos-backend.onrender.com`)
   - `VITE_SUPABASE_URL` = (from Supabase)
   - `VITE_SUPABASE_ANON_KEY` = (from Supabase)
5. Click **Create Static Site**

### Step 5: Update CORS

1. Go back to your Backend service on Render
2. Update `CORS_ORIGIN` to your frontend URL (e.g., `https://sos-frontend.onrender.com`)
3. Render will automatically redeploy

### Step 6: Run Database Migrations

After deployment, run migrations on Render:

1. Go to your Backend service
2. Click **Shell** tab
3. Run:
   ```bash
   npm run db:push
   ```

Or use Render's **Manual Deploy** with a one-time command.

## Project Structure

```
SOS/
├── frontend/              # React frontend
│   ├── src/
│   ├── package.json
│   └── render.yaml       # Render config
├── backend/               # Node.js backend
│   ├── src/
│   ├── drizzle/          # Drizzle schema & migrations
│   ├── package.json
│   └── render.yaml       # Render config
├── shared/                # Shared TypeScript types
│   └── src/
├── render.yaml            # Root Render config (optional)
└── package.json
```

## Development Workflow

1. **Make changes** to code
2. **Backend** auto-reloads with `tsx watch`
3. **Frontend** auto-reloads with Vite HMR
4. **Database changes**: Run `npm run db:push` in backend directory

## Database Management

### View Database

```bash
cd backend
npm run db:studio
```

This opens Drizzle Studio in your browser.

### Create Migration

```bash
cd backend
npm run db:generate
```

### Push Schema Changes

```bash
cd backend
npm run db:push
```

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` in `backend/.env` matches Supabase connection string
- Check Supabase project is active (not paused)
- Ensure IP is allowed in Supabase (Settings → Database → Connection Pooling)

### Redis Connection Issues

- Verify `REDIS_URL` in `backend/.env`
- Test connection: `redis-cli -u $REDIS_URL ping`
- For Render Redis, use the **Internal URL** (not external)

### Supabase Auth Issues

- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- Check Supabase project settings
- Ensure email confirmation is disabled for development (Settings → Auth)

### Build Errors on Render

- Check build logs in Render dashboard
- Ensure all environment variables are set
- Verify `package.json` scripts are correct
- Check Node.js version compatibility

### CORS Errors

- Verify `CORS_ORIGIN` in backend matches frontend URL
- Check both URLs include protocol (`https://`)
- For local dev, use `http://localhost:3000`

## Environment Variables Reference

### Backend Required

- `DATABASE_URL` - Supabase PostgreSQL connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `REDIS_URL` - Redis connection URL

### Backend Optional

- `PORT` - Server port (default: 4000)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - Allowed CORS origin
- `OPENAI_API_KEY` - For AI features
- `ANTHROPIC_API_KEY` - For AI features

### Frontend Required

- `VITE_API_URL` - Backend API URL

### Frontend Optional

- `VITE_SUPABASE_URL` - For client-side Supabase features
- `VITE_SUPABASE_ANON_KEY` - For client-side Supabase features

## Next Steps

1. Create your first user account via `/api/v1/auth/register`
2. Create a workflow in the UI
3. Explore the API documentation
4. Check the PRD.md for feature roadmap

## Support

For issues or questions:
- **Supabase Docs**: https://supabase.com/docs
- **Render Docs**: https://render.com/docs
- **Drizzle Docs**: https://orm.drizzle.team/docs/overview
