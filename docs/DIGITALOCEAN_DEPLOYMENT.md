# DigitalOcean App Platform Deployment Guide

This guide will help you deploy both the backend and frontend to DigitalOcean App Platform.

## Prerequisites

1. **DigitalOcean Account**: Sign up at https://www.digitalocean.com
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **DigitalOcean CLI (Optional)**: For easier management
   ```bash
   brew install doctl  # macOS
   # or download from https://github.com/digitalocean/doctl/releases
   ```

## Deployment Options

### Option 1: Deploy Both Backend and Frontend Separately (Recommended)

This option deploys:
- **Backend**: Node.js web service (serves API)
- **Frontend**: Static site (served separately)

**Pros:**
- Better separation of concerns
- Can scale independently
- Frontend can use CDN

**Cons:**
- Need to configure CORS
- Two services to manage

### Option 2: Deploy Backend Only (Frontend Served from Backend)

This option deploys:
- **Backend**: Node.js web service (serves both API and frontend)

**Pros:**
- Single service to manage
- No CORS issues
- Simpler deployment

**Cons:**
- Frontend and backend scale together
- Less optimal for static assets

## Step-by-Step Deployment

### Step 1: Prepare Your Repository

1. **Ensure `.do/app.yaml` is committed**:
   ```bash
   git add .do/app.yaml
   git commit -m "Add DigitalOcean App Platform configuration"
   git push origin main
   ```

### Step 2: Create App on DigitalOcean

#### Using DigitalOcean Dashboard:

1. **Go to DigitalOcean Dashboard**: https://cloud.digitalocean.com
2. **Navigate to Apps**: Click "Apps" in the left sidebar
3. **Create App**: Click "Create App"
4. **Connect GitHub**:
   - Select "GitHub" as source
   - Authorize DigitalOcean to access your GitHub account
   - Select repository: `SynthralOS/SynthralOS-core`
   - Select branch: `main`
5. **Configure App**:
   - DigitalOcean will auto-detect `.do/app.yaml`
   - Review the configuration
   - Make sure both `sos-backend` and `sos-frontend` services are detected
6. **Configure Environment Variables**:
   - Update any environment variables that need to be set:
     - `OPENAI_API_KEY` (if using)
     - `ANTHROPIC_API_KEY` (if using)
     - `RESEND_API_KEY` (if using)
     - `NANGO_SECRET_KEY` (required for OAuth)
   - Mark sensitive values as "Encrypted"
7. **Create Resources**:
   - Redis database will be created automatically
   - Review the plan and pricing
8. **Deploy**: Click "Create Resources" to start deployment

#### Using DigitalOcean CLI:

```bash
# Authenticate
doctl auth init

# Create app from app.yaml
doctl apps create --spec .do/app.yaml

# Monitor deployment
doctl apps list
doctl apps get <app-id>
doctl apps logs <app-id>
```

### Step 3: Configure Environment Variables

After creating the app, update environment variables in the DigitalOcean dashboard:

1. Go to your app in DigitalOcean dashboard
2. Click on "Settings" → "App-Level Environment Variables"
3. Add/update the following:

**Required:**
```
OPENAI_API_KEY=your-openai-key (if using)
ANTHROPIC_API_KEY=your-anthropic-key (if using)
RESEND_API_KEY=your-resend-key (if using)
NANGO_SECRET_KEY=your-nango-secret-key (REQUIRED for OAuth)
```

**Optional:**
```
OTEL_EXPORTER_OTLP_ENDPOINT=your-otel-endpoint (if using OpenTelemetry)
POSTHOG_API_KEY=your-posthog-key (if using PostHog)
RUDDERSTACK_WRITE_KEY=your-rudderstack-key (if using RudderStack)
STACKSTORM_API_URL=your-stackstorm-url (if using StackStorm)
STACKSTORM_API_KEY=your-stackstorm-key (if using StackStorm)
```

### Step 4: Wait for Deployment

The deployment process will:
1. Clone your repository
2. Install dependencies (`npm ci`)
3. Build backend (`cd backend && npm run build`)
4. Build frontend (if deploying separately)
5. Start the services

**Expected build time**: 10-15 minutes (first deployment may take longer)

### Step 5: Verify Deployment

1. **Check Backend**:
   - Go to your app dashboard
   - Find the `sos-backend` service URL
   - Visit: `https://your-backend-url.ondigitalocean.app/health`
   - Should return: `{"status":"ok"}`

2. **Check Frontend** (if deployed separately):
   - Find the `sos-frontend` service URL
   - Visit the URL in your browser
   - Should load the frontend application

3. **Check Logs**:
   ```bash
   # Using CLI
   doctl apps logs <app-id> --type run
   
   # Or in dashboard: App → Runtime Logs
   ```

## Configuration Details

### Backend Service

- **Build Command**: `npm ci && cd backend && npm run build`
- **Run Command**: `cd backend && npm start`
- **Port**: 4000
- **Health Check**: `/health`
- **Instance Size**: `basic-xxs` ($5/month) - can upgrade to `basic-xs` ($12/month)

### Frontend Service (if deployed separately)

- **Build Command**: `npm ci && npm run build`
- **Output Directory**: `/frontend/dist`
- **Environment Variables**: 
  - `VITE_API_URL`: Automatically set to backend URL
  - `VITE_CLERK_PUBLISHABLE_KEY`: Set from environment

### Redis Database

- **Engine**: Redis 7
- **Plan**: Development (free tier available)
- **Connection**: Automatically injected via `REDIS_URL` environment variable

## Updating Environment Variables

### Using Dashboard:

1. Go to your app
2. Click "Settings" → "App-Level Environment Variables"
3. Add/edit variables
4. Click "Save" - app will automatically redeploy

### Using CLI:

```bash
# Update environment variable
doctl apps update <app-id> --spec .do/app.yaml

# Or update specific variable
doctl apps update <app-id> --env OPENAI_API_KEY=your-key
```

## Monitoring and Logs

### View Logs:

```bash
# All logs
doctl apps logs <app-id>

# Build logs only
doctl apps logs <app-id> --type build

# Runtime logs only
doctl apps logs <app-id> --type run

# Follow logs
doctl apps logs <app-id> --follow
```

### View Metrics:

- Go to your app dashboard
- Click "Metrics" tab
- View:
  - Request rate
  - Response time
  - Error rate
  - CPU/Memory usage

## Troubleshooting

### Build Fails

1. **Check build logs**:
   ```bash
   doctl apps logs <app-id> --type build
   ```

2. **Common issues**:
   - **npm ci fails**: Check if `package-lock.json` is committed
   - **Build timeout**: Increase instance size or optimize build
   - **Memory issues**: Upgrade to larger instance

### Service Won't Start

1. **Check runtime logs**:
   ```bash
   doctl apps logs <app-id> --type run
   ```

2. **Common issues**:
   - **Port mismatch**: Ensure PORT environment variable matches
   - **Database connection**: Check DATABASE_URL is correct
   - **Missing environment variables**: Verify all required vars are set

### Frontend Can't Connect to Backend

1. **Check CORS settings**:
   - If frontend is separate, ensure CORS_ORIGIN is set correctly
   - Or serve frontend from backend (remove static_sites section)

2. **Check VITE_API_URL**:
   - Should be set to backend URL
   - Format: `https://your-backend-url.ondigitalocean.app`

## Scaling

### Horizontal Scaling:

1. Go to your app dashboard
2. Click on the service (e.g., `sos-backend`)
3. Click "Settings" → "Scaling"
4. Adjust instance count

### Vertical Scaling:

1. Go to your app dashboard
2. Click on the service
3. Click "Settings" → "Resources"
4. Change instance size

## Cost Estimation

**Basic Setup (Development)**:
- Backend: `basic-xxs` = $5/month
- Frontend: Static site = Free
- Redis: Development plan = Free (or $15/month for production)
- **Total**: ~$5-20/month

**Production Setup**:
- Backend: `basic-xs` (2 instances) = $24/month
- Frontend: Static site = Free
- Redis: Production plan = $15/month
- **Total**: ~$39/month

## Custom Domains

1. Go to your app dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Update DNS records as instructed
5. SSL certificate is automatically provisioned

## Continuous Deployment

By default, the app is configured for automatic deployment on push to `main` branch.

To disable:
1. Go to app dashboard
2. Click "Settings" → "GitHub"
3. Toggle "Deploy on Push" off

## Rollback

If a deployment fails:

1. Go to app dashboard
2. Click "Deployments" tab
3. Find the last successful deployment
4. Click "Rollback"

## Additional Resources

- [DigitalOcean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [App Spec Reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [Pricing Calculator](https://www.digitalocean.com/pricing/app-platform)

## Support

- [DigitalOcean Community](https://www.digitalocean.com/community)
- [Support Tickets](https://cloud.digitalocean.com/support)

