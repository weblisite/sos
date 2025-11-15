# WasmEdge Integration Research

**Date:** December 2024  
**Purpose:** Research integration options for WasmEdge runtime in SynthralOS

---

## Executive Summary

WasmEdge is a lightweight, high-performance WebAssembly runtime designed for cloud-native, edge, and decentralized applications. It provides strong security isolation, making it ideal for executing untrusted code. This document outlines integration options for adding WasmEdge support to the SynthralOS code execution system.

---

## 1. Integration Approaches

### Option 1: Embedded SDK (Recommended for Node.js)

**Description:** Embed WasmEdge directly into the Node.js application using the WasmEdge SDK.

**Pros:**
- ✅ No external service required
- ✅ Low latency (no network overhead)
- ✅ Full control over execution environment
- ✅ Can use Node.js bindings

**Cons:**
- ❌ Requires native bindings (C/C++/Rust)
- ❌ More complex setup
- ❌ Platform-specific builds

**Implementation:**
- Use `wasmedge-extensions` npm package (if available)
- Or use Rust SDK with Node.js bindings via `napi-rs` or `neon`
- Or use C SDK with `node-addon-api`

**Resources:**
- npm: `wasmedge-extensions` (https://www.npmjs.com/package/wasmedge-extensions)
- Rust SDK: https://wasmedge.github.io/WasmEdge/wasmedge_sdk/
- C API: https://wasmedge.org/docs/embed/c/

### Option 2: HTTP Service/API

**Description:** Run WasmEdge as a separate HTTP service and communicate via REST API.

**Pros:**
- ✅ Language-agnostic (any language can call HTTP)
- ✅ Easy to scale independently
- ✅ Can use Docker/Kubernetes
- ✅ Simpler integration (just HTTP calls)

**Cons:**
- ❌ Network latency overhead
- ❌ Requires separate service deployment
- ❌ More infrastructure to manage

**Implementation:**
- Deploy WasmEdge as HTTP service (custom or use existing)
- Use HTTP client to send WASM binaries and execute
- Similar pattern to E2B runtime

**Resources:**
- WasmEdge can be wrapped in HTTP service
- Example: https://github.com/second-state/wasmedge-containers-examples

### Option 3: Docker Container

**Description:** Use WasmEdge via Docker containers (WasmEdge supports Docker).

**Pros:**
- ✅ Familiar deployment model
- ✅ Easy to manage with Docker Compose/Kubernetes
- ✅ Isolated execution environment
- ✅ Can use Docker CLI tools

**Cons:**
- ❌ Container startup overhead
- ❌ More resource intensive
- ❌ Requires Docker daemon

**Implementation:**
- Use `docker run` to execute WASM modules
- Or use Docker API to manage containers
- WasmEdge supports Docker natively

**Resources:**
- https://cloudnativenow.com/news/news-releases/wasmedge-brings-cloud-native-tooling-to-webassembly/
- https://medium.com/wasm/manage-webassembly-apps-in-wasmedge-using-docker-tools-bdd25134afcd

### Option 4: Kubernetes Integration

**Description:** Deploy WasmEdge workloads in Kubernetes.

**Pros:**
- ✅ Production-ready orchestration
- ✅ Auto-scaling capabilities
- ✅ Service mesh integration
- ✅ Enterprise-grade deployment

**Cons:**
- ❌ Complex setup
- ❌ Requires Kubernetes cluster
- ❌ Overkill for simple use cases

**Implementation:**
- Use Kubernetes CRDs for WasmEdge
- Deploy as serverless functions
- Use service mesh for networking

---

## 2. Language Compilation Options

### JavaScript/TypeScript → WASM

**Option A: AssemblyScript**
- **Tool:** AssemblyScript (TypeScript-like syntax)
- **Pros:** Familiar syntax, good performance
- **Cons:** Not full TypeScript, limited standard library
- **Install:** `npm install -g assemblyscript`
- **Example:**
  ```typescript
  // Compile AssemblyScript to WASM
  asc code.ts --target release --outFile code.wasm
  ```

**Option B: Emscripten**
- **Tool:** Emscripten (C/C++ → WASM)
- **Pros:** Mature, full C/C++ support
- **Cons:** Requires C/C++ code, not direct JS/TS
- **Use Case:** For performance-critical code

**Option C: JavaScript Runtime in WASM**
- **Tool:** QuickJS compiled to WASM
- **Pros:** Run actual JavaScript
- **Cons:** Larger binary, slower startup
- **Use Case:** When you need full JS compatibility

**Recommendation:** AssemblyScript for most cases, QuickJS for full JS compatibility

### Python → WASM

**Option A: Pyodide**
- **Tool:** Pyodide (Python compiled to WASM)
- **Pros:** Full Python standard library, NumPy, Pandas support
- **Cons:** Large binary size (~10MB+)
- **Install:** `pip install pyodide`
- **Example:**
  ```python
  # Pyodide can run in WasmEdge
  # Compile Python to WASM using Pyodide
  ```

**Option B: MicroPython**
- **Tool:** MicroPython compiled to WASM
- **Pros:** Lightweight, fast startup
- **Cons:** Limited standard library
- **Use Case:** Simple Python scripts

**Option C: RustPython**
- **Tool:** RustPython compiled to WASM
- **Pros:** Good performance, growing compatibility
- **Cons:** Not 100% CPython compatible

**Recommendation:** Pyodide for full Python support, MicroPython for lightweight needs

### Rust → WASM

**Tool:** `wasm-pack`
- **Pros:** Native WASM support, excellent performance
- **Cons:** Requires Rust knowledge
- **Install:** `cargo install wasm-pack`
- **Example:**
  ```bash
  wasm-pack build --target wasm32-wasi
  ```

### Go → WASM

**Tool:** TinyGo
- **Pros:** Small binary size, good performance
- **Cons:** Limited Go standard library
- **Install:** https://tinygo.org/getting-started/
- **Example:**
  ```bash
  tinygo build -target wasi -o code.wasm code.go
  ```

---

## 3. Node.js/TypeScript Integration

### Using wasmedge-extensions (npm package)

**Package:** `wasmedge-extensions`  
**URL:** https://www.npmjs.com/package/wasmedge-extensions

**Installation:**
```bash
npm install wasmedge-extensions
```

**Usage Example:**
```typescript
import { WasmEdge } from 'wasmedge-extensions';

const wasmedge = new WasmEdge();
await wasmedge.loadWasmFile('code.wasm');
const result = await wasmedge.executeFunction('main', [input]);
```

**Pros:**
- ✅ Pure Node.js/TypeScript
- ✅ No native bindings needed
- ✅ Easy to integrate

**Cons:**
- ❌ May have limitations
- ❌ Need to verify package status

### Using Rust SDK with Node.js Bindings

**Approach:** Create Node.js bindings for WasmEdge Rust SDK

**Tools:**
- `napi-rs` - Rust to Node.js bindings
- `neon` - Alternative Rust to Node.js bindings

**Example Structure:**
```rust
// src/lib.rs
use wasmedge_sdk::*;
use napi_derive::napi;

#[napi]
pub fn execute_wasm(wasm_bytes: Vec<u8>, input: String) -> String {
    // WasmEdge execution logic
}
```

**Pros:**
- ✅ Full WasmEdge SDK features
- ✅ High performance
- ✅ Type-safe bindings

**Cons:**
- ❌ Requires Rust knowledge
- ❌ More complex build process
- ❌ Platform-specific builds

### Using C SDK with node-addon-api

**Approach:** Create Node.js addon using WasmEdge C API

**Tools:**
- `node-addon-api` - C++ wrapper for Node.js
- WasmEdge C API

**Pros:**
- ✅ Direct C API access
- ✅ Good performance
- ✅ Official C API

**Cons:**
- ❌ Requires C/C++ knowledge
- ❌ Complex build setup
- ❌ Platform-specific builds

---

## 4. Recommended Approach for SynthralOS

### Phase 1: HTTP Service Approach (Quick Start)

**Rationale:**
- Similar to existing E2B runtime pattern
- Easy to implement and test
- Can be replaced later with embedded SDK
- No native bindings required

**Implementation Steps:**

1. **Set up WasmEdge HTTP Service**
   ```bash
   # Option A: Use existing WasmEdge HTTP wrapper
   # Option B: Create custom HTTP service using WasmEdge SDK
   ```

2. **Create HTTP Client in TypeScript**
   ```typescript
   // Similar to e2bRuntime.ts
   async execute(code: string, language: string, input: any) {
     // 1. Compile code to WASM
     const wasmBinary = await this.compileToWasm(code, language);
     
     // 2. Send to WasmEdge HTTP service
     const response = await fetch(`${this.serviceUrl}/execute`, {
       method: 'POST',
       body: JSON.stringify({
         wasm: wasmBinary.toString('base64'),
         input: input,
       }),
     });
     
     // 3. Return result
     return await response.json();
   }
   ```

3. **WASM Compilation Pipeline**
   - JavaScript/TypeScript → AssemblyScript → WASM
   - Python → Pyodide → WASM
   - Rust → wasm-pack → WASM
   - Go → TinyGo → WASM

### Phase 2: Embedded SDK (Performance Optimization)

**Rationale:**
- Lower latency
- No network overhead
- Better for high-frequency executions

**Implementation:**
- Evaluate `wasmedge-extensions` npm package
- Or create custom Node.js bindings using Rust SDK
- Replace HTTP service calls with direct SDK calls

---

## 5. Comparison with E2B Runtime

| Feature | E2B | WasmEdge |
|---------|-----|----------|
| **Latency** | <50ms P50 | ~10-50ms (depends on approach) |
| **Security** | Sandbox isolation | WASM sandbox isolation |
| **Languages** | Python, JS, Bash | Any (via compilation) |
| **Setup** | API key | Service/container |
| **Cost** | Per execution | Self-hosted (free) |
| **Scalability** | Managed | Self-managed |
| **Best For** | Fast, managed | Secure, self-hosted |

**Recommendation:** Use E2B for fast, managed execution. Use WasmEdge for maximum security and self-hosted requirements.

---

## 6. Implementation Plan

### Step 1: WASM Compilation Pipeline

**Priority:** High  
**Estimated Time:** 2-3 days

1. **AssemblyScript Setup**
   ```bash
   npm install -g assemblyscript
   ```

2. **Create Compilation Service**
   ```typescript
   // backend/src/services/wasmCompiler.ts
   export class WasmCompiler {
     async compileAssemblyScript(code: string): Promise<Buffer> {
       // Compile TypeScript-like code to WASM
     }
     
     async compilePython(code: string): Promise<Buffer> {
       // Use Pyodide to compile Python to WASM
     }
   }
   ```

3. **Integration Points**
   - Add to `wasmEdgeRuntime.ts`
   - Call before execution
   - Cache compiled WASM binaries

### Step 2: WasmEdge HTTP Service

**Priority:** High  
**Estimated Time:** 1-2 days

1. **Option A: Use Existing Service**
   - Research existing WasmEdge HTTP wrappers
   - Deploy as Docker container

2. **Option B: Create Custom Service**
   ```rust
   // wasmedge-service/src/main.rs
   use wasmedge_sdk::*;
   use actix_web::{web, App, HttpServer, Responder};
   
   async fn execute_wasm(req: web::Json<ExecuteRequest>) -> impl Responder {
       // Load WASM module
       // Execute with input
       // Return result
   }
   ```

### Step 3: Integration with Runtime Router

**Priority:** Medium  
**Estimated Time:** 1 day

1. **Update `runtimeRouter.ts`**
   - Already has WasmEdge case (placeholder)
   - Implement actual execution

2. **Update `code.ts` executor**
   - Add WasmEdge as runtime option
   - Handle WASM compilation

### Step 4: Testing

**Priority:** High  
**Estimated Time:** 1-2 days

1. **Unit Tests**
   - Compilation tests
   - Execution tests
   - Error handling tests

2. **Integration Tests**
   - End-to-end execution
   - Performance benchmarks
   - Security tests

---

## 7. Environment Variables

```env
# WasmEdge Configuration
WASMEDGE_ENABLED=true
WASMEDGE_SERVICE_URL=http://localhost:8080
WASMEDGE_TIMEOUT=30000
WASMEDGE_MEMORY_LIMIT=134217728  # 128MB

# WASM Compilation
WASM_COMPILER_ENABLED=true
WASM_CACHE_ENABLED=true
WASM_CACHE_TTL=3600  # 1 hour
```

---

## 8. Dependencies to Add

```json
{
  "dependencies": {
    "assemblyscript": "^0.27.0",
    "pyodide": "^0.24.0"  // For Python compilation
  },
  "devDependencies": {
    "@assemblyscript/loader": "^0.27.0"
  }
}
```

---

## 9. Security Considerations

### WASM Sandbox Benefits
- ✅ Memory isolation
- ✅ No direct system access
- ✅ Controlled host function access
- ✅ Resource limits (memory, CPU)

### Additional Security Measures
- Input validation before compilation
- Output validation after execution
- Timeout enforcement
- Memory limit enforcement
- Rate limiting per user/org

---

## 10. Performance Considerations

### Compilation Caching
- Cache compiled WASM binaries
- Key: code hash + language
- TTL: 1 hour (configurable)

### Execution Optimization
- Reuse WasmEdge instances when possible
- Pool instances for high throughput
- Monitor execution times

### Resource Limits
- Memory: 128MB default (configurable)
- Timeout: 30s default (configurable)
- CPU: Limit via WasmEdge config

---

## 11. Monitoring & Observability

### Metrics to Track
- Compilation time
- Execution time
- Memory usage
- Success/failure rates
- Cache hit rates

### OpenTelemetry Integration
- Already implemented in `wasmEdgeRuntime.ts`
- Track compilation spans
- Track execution spans
- Track errors

---

## 12. Next Steps

1. **Research `wasmedge-extensions` npm package**
   - Check if it's actively maintained
   - Test basic functionality
   - Evaluate for embedded approach

2. **Set up WASM Compilation Pipeline**
   - Start with AssemblyScript
   - Add Pyodide for Python
   - Test compilation process

3. **Create WasmEdge HTTP Service**
   - Choose: existing service or custom
   - Deploy as Docker container
   - Test HTTP API

4. **Implement Full Integration**
   - Complete `wasmEdgeRuntime.ts`
   - Update runtime router
   - Add tests

5. **Performance Testing**
   - Benchmark vs E2B
   - Benchmark vs VM2
   - Optimize based on results

---

## 13. Resources

### Official Documentation
- WasmEdge Docs: https://wasmedge.org/docs/
- Rust SDK: https://wasmedge.github.io/WasmEdge/wasmedge_sdk/
- C API: https://wasmedge.org/docs/embed/c/

### npm Packages
- `wasmedge-extensions`: https://www.npmjs.com/package/wasmedge-extensions
- `assemblyscript`: https://www.npmjs.com/package/assemblyscript
- `@assemblyscript/loader`: https://www.npmjs.com/package/@assemblyscript/loader

### Compilation Tools
- AssemblyScript: https://www.assemblyscript.org/
- Pyodide: https://pyodide.org/
- wasm-pack: https://rustwasm.github.io/wasm-pack/
- TinyGo: https://tinygo.org/

### Examples
- WasmEdge Containers: https://github.com/second-state/wasmedge-containers-examples
- WasmEdge Kubernetes: https://wasmedge.org/docs/kubernetes/

---

## 14. Conclusion

**Recommended Approach:**
1. **Start with HTTP Service** - Quick to implement, similar to E2B pattern
2. **Implement WASM Compilation** - AssemblyScript for JS/TS, Pyodide for Python
3. **Evaluate Embedded SDK** - For performance optimization later

**Key Benefits:**
- Strong security isolation
- Language flexibility (any language via compilation)
- Self-hosted option
- Good performance

**Challenges:**
- WASM compilation complexity
- Service setup and management
- Performance optimization needed

**Timeline Estimate:**
- Phase 1 (HTTP Service): 3-5 days
- Phase 2 (Embedded SDK): 5-7 days (if needed)

---

**Status:** Research Complete - Ready for Implementation  
**Next Action:** Choose integration approach and begin implementation

