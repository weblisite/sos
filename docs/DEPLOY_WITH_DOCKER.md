# Deploy with Docker - Match Local Environment Exactly

This guide shows you how to deploy using Docker so production matches your local environment exactly.

## Why Docker?

- ✅ **Exact same environment** as local development
- ✅ **No build differences** between local and production
- ✅ **Reproducible deployments**
- ✅ **Works the same way locally and in production**

## Local Testing with Docker

### 1. Build and Test Locally

```bash
# Build the Docker image (same as production)
docker build -t sos-platform .

# Run locally (matches production exactly)
docker run -p 4000:4000 --env-file .env sos-platform
```

### 2. Test with Docker Compose

```bash
# Start with docker-compose (matches production)
docker-compose up --build

# Or in background
docker-compose up -d --build
```

### 3. Verify It Works

```bash
# Check health endpoint
curl http://localhost:4000/health

# Check logs
docker-compose logs -f backend
```

## Deploy to Render with Docker

### Option 1: Using render.yaml (Recommended)

The `render.yaml` is already configured to use Docker:

```yaml
- type: web
  name: sos-backend
  env: docker  # Uses Docker instead of native Node.js
  dockerfilePath: ./Dockerfile
  dockerContext: .
```

Just push to GitHub and Render will:
1. Build using your Dockerfile
2. Run exactly as it does locally
3. Use the same environment

### Option 2: Manual Docker Deployment

1. Go to Render Dashboard
2. Create new Web Service
3. Connect GitHub repository
4. Select **"Docker"** as the environment
5. Set Dockerfile path: `./Dockerfile`
6. Set Docker context: `.`
7. Add environment variables
8. Deploy!

## Deploy from Cursor

While there's no direct Cursor extension for deployment, you can:

### Method 1: Use Terminal in Cursor

```bash
# Build and test locally first
docker build -t sos-platform .
docker run -p 4000:4000 --env-file .env sos-platform

# If it works locally, push to GitHub
git add .
git commit -m "Deploy with Docker"
git push all

# Render will automatically deploy using Docker
```

### Method 2: Use GitHub Actions (Already Set Up)

The GitHub Actions workflow will automatically:
1. Trigger on push to `main`
2. Call Render deploy hook
3. Render builds using Dockerfile
4. Deploys with exact same environment

### Method 3: Manual Render Deploy

1. In Cursor terminal, push to GitHub:
   ```bash
   git push all
   ```

2. Go to Render Dashboard
3. Click "Manual Deploy" → "Deploy latest commit"

## Verify Docker Build Locally

Before deploying, always test the Docker build locally:

```bash
# Build
docker build -t sos-platform .

# Run
docker run -p 4000:4000 \
  -e DATABASE_URL="your-db-url" \
  -e REDIS_URL="your-redis-url" \
  -e CLERK_SECRET_KEY="your-key" \
  sos-platform

# Test
curl http://localhost:4000/health
```

If this works locally, it will work in production!

## Troubleshooting

### Build Fails Locally

```bash
# Check Dockerfile
cat Dockerfile

# Build with verbose output
docker build --progress=plain -t sos-platform .

# Check what's in the image
docker run --rm sos-platform ls -la /app/backend/dist
```

### Runtime Errors

```bash
# Check logs
docker logs <container-id>

# Run interactively
docker run -it --rm sos-platform sh

# Check environment variables
docker run --rm sos-platform env
```

### Differences from Local

If Docker works but Render doesn't:
1. Check Render build logs
2. Verify environment variables are set
3. Check Render service logs
4. Compare with local Docker run

## Key Benefits

✅ **Same environment** - Docker ensures consistency
✅ **Test before deploy** - Build locally first
✅ **Reproducible** - Same Dockerfile everywhere
✅ **Easy debugging** - Run same image locally

## Next Steps

1. Test Docker build locally: `docker build -t sos-platform .`
2. Test Docker run locally: `docker run -p 4000:4000 --env-file .env sos-platform`
3. If it works, push to GitHub: `git push all`
4. Render will deploy using the same Dockerfile

