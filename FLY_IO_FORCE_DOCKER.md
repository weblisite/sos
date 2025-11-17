# Force Docker Build on Fly.io for GitHub Deployments

## Problem
Fly.io is auto-detecting Node.js from `package.json` and trying to use buildpacks instead of Docker when deploying from GitHub.

## Solution Options

### Option 1: Use Fly.io CLI (Recommended)
If you have access to the Fly.io CLI, run this command to force Docker builds:

```bash
flyctl config save -a sos-xzmmlw
flyctl deploy -a sos-xzmmlw --dockerfile Dockerfile
```

Or set the build configuration:
```bash
flyctl config set -a sos-xzmmlw build.dockerfile Dockerfile
```

### Option 2: Configure in Fly.io Dashboard
1. Go to your Fly.io dashboard
2. Select your app: `sos-xzmmlw`
3. Go to **Settings** → **Build & Deploy**
4. Look for **Build Configuration** or **Build Method**
5. Select **Docker** or **Dockerfile** instead of **Auto-detect** or **Buildpacks**
6. Save the configuration

### Option 3: Disconnect and Reconnect GitHub
1. In Fly.io dashboard, go to your app settings
2. Disconnect the GitHub integration
3. Reconnect it, and when prompted, explicitly select **Docker** as the build method

### Option 4: Use GitHub Actions
Instead of using Fly.io's GitHub integration, you can use GitHub Actions to deploy:

1. Create `.github/workflows/fly-deploy.yml`:
```yaml
name: Fly Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only --dockerfile Dockerfile
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

2. Add `FLY_API_TOKEN` to your GitHub repository secrets

## Current Configuration
- ✅ `Dockerfile` exists in root
- ✅ `fly.toml` has `[build]` section with `dockerfile = "Dockerfile"`
- ✅ `.fly/build.toml` exists with Docker configuration

The issue is that Fly.io's GitHub integration auto-detects Node.js before reading these files.

