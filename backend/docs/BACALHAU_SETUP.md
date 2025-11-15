# Bacalhau Setup Guide

**Bacalhau** is a distributed compute platform that enables running jobs across a cluster of nodes. It's ideal for long-running tasks, GPU workloads, and distributed processing.

---

## Prerequisites

- **Docker Engine**: Bacalhau requires Docker to be installed and running
- **Node.js**: Version 18+ for the backend service

---

## Installation

### 1. Install Bacalhau CLI

```bash
curl -sL https://get.bacalhau.org/install.sh | bash
```

Verify installation:
```bash
bacalhau version
```

### 2. Set Up Local Devstack (Optional)

For local development and testing, you can run a local Bacalhau cluster:

```bash
bacalhau devstack
```

This will start a local cluster with multiple nodes. Wait for it to initialize.

Verify the cluster is running:
```bash
bacalhau node list
```

You should see a list of nodes indicating a successful setup.

### 3. Backend Dependencies

The backend uses the Bacalhau CLI directly (no additional npm packages required). Ensure your backend dependencies are installed:

```bash
npm install
```

---

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
# Enable Bacalhau runtime
BACALHAU_ENABLED=true

# Optional: Custom Bacalhau CLI path
BACALHAU_PATH=bacalhau

# Optional: API URL (if using remote cluster)
BACALHAU_API_URL=http://localhost:1234

# Optional: API Key (if using remote cluster)
BACALHAU_API_KEY=your-api-key

# Optional: GPU support
BACALHAU_GPU_ENABLED=false
BACALHAU_GPU_COUNT=1

# Optional: Default timeout (5 minutes)
BACALHAU_TIMEOUT=300000
```

---

## GPU Support

### NVIDIA GPUs

1. **Install NVIDIA Container Toolkit:**

```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID) \
  && curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add - \
  && curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list \
  && sudo apt-get update \
  && sudo apt-get install -y nvidia-container-toolkit
```

2. **Restart Docker:**

```bash
sudo systemctl restart docker
```

3. **Verify GPU Access:**

```bash
nvidia-smi
```

4. **Enable GPU in Configuration:**

```env
BACALHAU_GPU_ENABLED=true
BACALHAU_GPU_COUNT=1
```

### AMD GPUs

Ensure `rocm-smi` is installed. Bacalhau will automatically detect AMD GPUs.

### Intel GPUs

Ensure `xpu-smi` is installed. Bacalhau will automatically detect Intel GPUs.

---

## Usage

### In Code Execution

Bacalhau is automatically selected for long-running jobs (jobs with `longJob: true` in the configuration).

You can also explicitly request Bacalhau:

```typescript
const result = await runtimeRouter.route({
  code: 'print("Hello from Bacalhau!")',
  language: 'python',
  input: {},
  requiresSandbox: true,
  longJob: true,
  runtime: 'bacalhau',
  options: {
    gpu: true,
    gpuCount: 1,
    memory: '4GB',
    cpu: '2',
  },
});
```

### Job Monitoring

The runtime automatically monitors job status and polls every 5 seconds until completion or timeout.

---

## Testing

### Test Script

Run the test script to verify Bacalhau integration:

```bash
npm run test:bacalhau
```

### Manual Testing

1. **Submit a test job:**

```bash
bacalhau job run docker run python:3.11-slim python -c "print('Hello Bacalhau!')"
```

2. **Check job status:**

```bash
bacalhau job list
```

3. **Get job results:**

```bash
bacalhau get <job-id>
```

---

## Production Deployment

### Remote Cluster Setup

For production, set up a Bacalhau cluster:

1. **Install Bacalhau on cluster nodes**
2. **Configure networking and storage**
3. **Set up API endpoint**
4. **Configure environment variables:**

```env
BACALHAU_API_URL=https://your-bacalhau-cluster.com
BACALHAU_API_KEY=your-production-api-key
```

### Security Considerations

- **Network Isolation**: Jobs run with `Network.Type: None` by default (no network access)
- **Resource Limits**: Configure memory and CPU limits per job
- **API Authentication**: Use API keys for remote cluster access
- **Job Cleanup**: Implement job cleanup policies to prevent resource exhaustion

---

## Troubleshooting

### Bacalhau Not Found

**Error:** `Bacalhau is not available`

**Solution:**
1. Verify Bacalhau is installed: `bacalhau version`
2. Check `BACALHAU_PATH` environment variable
3. Ensure `BACALHAU_ENABLED=true` is set

### Docker Not Running

**Error:** `Cannot connect to Docker daemon`

**Solution:**
1. Start Docker: `sudo systemctl start docker`
2. Verify Docker is running: `docker ps`

### GPU Not Available

**Error:** GPU jobs fail or don't use GPU

**Solution:**
1. Verify GPU drivers are installed: `nvidia-smi` (for NVIDIA)
2. Install NVIDIA Container Toolkit (see GPU Support section)
3. Restart Docker after installing toolkit
4. Check `BACALHAU_GPU_ENABLED=true` is set

### Job Timeout

**Error:** `Bacalhau job execution timed out`

**Solution:**
1. Increase timeout: `BACALHAU_TIMEOUT=600000` (10 minutes)
2. Check job status manually: `bacalhau job describe <job-id>`
3. Verify cluster has sufficient resources

### Job Submission Fails

**Error:** `Failed to parse job ID`

**Solution:**
1. Check Bacalhau CLI version: `bacalhau version`
2. Verify cluster is running: `bacalhau node list`
3. Check job spec format in logs

---

## Additional Resources

- [Bacalhau Documentation](https://bacalhau.org/docs)
- [Bacalhau GitHub](https://github.com/bacalhau-project/bacalhau)
- [Running Locally with Devstack](https://bacalhau.org/docs/references/developers/running-locally)
- [GPU Support](https://blog.bacalhau.org/p/announcing-bacalhau-12)

---

## Implementation Status

✅ **Completed:**
- CLI-based job submission
- Job status monitoring
- Result retrieval
- GPU support configuration
- Automatic availability detection
- Error handling and fallbacks

⏳ **Future Enhancements:**
- Direct API integration (without CLI)
- Advanced job scheduling
- Multi-node job distribution
- Result streaming
- Job cancellation

