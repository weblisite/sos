import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const execAsync = promisify(exec);

/**
 * WASM Compiler Service
 * 
 * Compiles code from various languages to WebAssembly.
 * Supports: AssemblyScript (JS/TS), Pyodide (Python), wasm-pack (Rust), TinyGo (Go)
 */

export interface CompilationResult {
  wasmBinary: Buffer;
  wasmBase64: string;
  compilationTime: number;
  size: number;
}

export class WasmCompiler {
  private cacheDir: string;
  private cacheEnabled: boolean;
  private cacheTTL: number;

  constructor() {
    this.cacheDir = process.env.WASM_CACHE_DIR || join(process.cwd(), '.wasm-cache');
    this.cacheEnabled = process.env.WASM_CACHE_ENABLED !== 'false';
    this.cacheTTL = parseInt(process.env.WASM_CACHE_TTL || '3600', 10); // 1 hour default

    // Ensure cache directory exists
    if (this.cacheEnabled && !existsSync(this.cacheDir)) {
      mkdir(this.cacheDir, { recursive: true }).catch(console.error);
    }
  }

  /**
   * Compile code to WASM based on language
   */
  async compile(
    code: string,
    language: 'javascript' | 'typescript' | 'python' | 'rust' | 'go'
  ): Promise<CompilationResult> {
    const startTime = Date.now();
    const tracer = trace.getTracer('sos-wasm-compiler');
    const span = tracer.startSpan('wasm.compile', {
      attributes: {
        'wasm.language': language,
        'wasm.code_length': code.length,
      },
    });

    try {
      // Check cache first
      if (this.cacheEnabled) {
        const cached = await this.getFromCache(code, language);
        if (cached) {
          span.setAttributes({
            'wasm.cache_hit': true,
            'wasm.compilation_time_ms': Date.now() - startTime,
          });
          span.setStatus({ code: SpanStatusCode.OK });
          return cached;
        }
      }

      let wasmBinary: Buffer;

      switch (language) {
        case 'javascript':
        case 'typescript':
          wasmBinary = await this.compileAssemblyScript(code);
          break;
        case 'python':
          wasmBinary = await this.compilePython(code);
          break;
        case 'rust':
          wasmBinary = await this.compileRust(code);
          break;
        case 'go':
          wasmBinary = await this.compileGo(code);
          break;
        default:
          throw new Error(`Unsupported language for WASM compilation: ${language}`);
      }

      const compilationTime = Date.now() - startTime;
      const result: CompilationResult = {
        wasmBinary,
        wasmBase64: wasmBinary.toString('base64'),
        compilationTime,
        size: wasmBinary.length,
      };

      // Cache result
      if (this.cacheEnabled) {
        await this.saveToCache(code, language, result);
      }

      span.setAttributes({
        'wasm.cache_hit': false,
        'wasm.compilation_time_ms': compilationTime,
        'wasm.binary_size': wasmBinary.length,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return result;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Compile JavaScript/TypeScript using AssemblyScript
   */
  private async compileAssemblyScript(code: string): Promise<Buffer> {
    try {
      // Check if AssemblyScript is installed
      try {
        await execAsync('asc --version');
      } catch {
        throw new Error('AssemblyScript (asc) is not installed. Install with: npm install -g assemblyscript');
      }

      // Create temporary directory
      const tempDir = join(this.cacheDir, 'temp', `as-${Date.now()}-${Math.random().toString(36).substring(7)}`);
      await mkdir(tempDir, { recursive: true });

      try {
        // Write code to file
        const inputFile = join(tempDir, 'index.ts');
        
        // Wrap code in AssemblyScript-compatible format if needed
        // AssemblyScript uses a subset of TypeScript
        let assemblyCode = code;
        
        // If code doesn't have exports, wrap it
        if (!code.includes('export')) {
          assemblyCode = `
            export function main(): i32 {
              ${code}
              return 0;
            }
          `;
        }
        
        await writeFile(inputFile, assemblyCode, 'utf-8');

        // Compile to WASM
        const outputFile = join(tempDir, 'index.wasm');
        const { stderr } = await execAsync(`asc ${inputFile} --target release --outFile ${outputFile} --optimize`, {
          cwd: tempDir,
        });

        // Check if compilation succeeded
        if (!existsSync(outputFile)) {
          throw new Error(`Compilation failed: ${stderr || 'No output file generated'}`);
        }

        // Read WASM binary
        const wasmBinary = await readFile(outputFile);

        return wasmBinary;
      } finally {
        // Cleanup temp directory
        try {
          const { rm } = await import('fs/promises');
          await rm(tempDir, { recursive: true, force: true }).catch(() => {});
        } catch {
          // Fallback cleanup
          try {
            await execAsync(`rm -rf ${tempDir}`);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    } catch (error: any) {
      throw new Error(`AssemblyScript compilation failed: ${error.message}`);
    }
  }

  /**
   * Compile Python using Pyodide
   * Note: Pyodide is typically used at runtime, but we can pre-compile Python to WASM
   * For now, we'll use a Python-to-WASM compiler or Pyodide's compilation
   */
  private async compilePython(code: string): Promise<Buffer> {
    // Pyodide typically runs Python in WASM at runtime
    // For compilation, we could use:
    // 1. Pyodide's Python-to-WASM compilation (complex)
    // 2. MicroPython compiled to WASM (simpler but limited)
    // 3. RustPython compiled to WASM
    
    // Python to WASM compilation options:
    // 1. Pyodide - Python runtime compiled to WASM (best compatibility)
    // 2. MicroPython - Lightweight Python subset compiled to WASM
    // 3. RustPython - Python interpreter written in Rust, compiled to WASM
    
    // For now, provide helpful error with implementation guidance
    throw new Error(
      'Python to WASM compilation requires additional setup. ' +
      'Options: 1) Use Pyodide runtime (npm install pyodide), ' +
      '2) Implement MicroPython compilation, or ' +
      '3) Use RustPython. ' +
      'For immediate use, consider executing Python code via runtime instead of WASM compilation.'
    );
  }

  /**
   * Compile Rust using wasm-pack
   */
  private async compileRust(code: string): Promise<Buffer> {
    try {
      // Check if wasm-pack is installed
      try {
        await execAsync('wasm-pack --version');
      } catch {
        throw new Error('wasm-pack is not installed. Install with: cargo install wasm-pack');
      }

      // Check if Rust is installed
      try {
        await execAsync('rustc --version');
      } catch {
        throw new Error('Rust is not installed. Install from: https://rustup.rs/');
      }

      // Create temporary Rust project
      const tempDir = join(this.cacheDir, 'temp', `rust-${Date.now()}-${Math.random().toString(36).substring(7)}`);
      await mkdir(tempDir, { recursive: true });

      try {
        // Initialize Rust project
        await execAsync('cargo init --name wasm-code --lib', { cwd: tempDir });

        // Write code to lib.rs
        const libFile = join(tempDir, 'src', 'lib.rs');
        await writeFile(libFile, code, 'utf-8');

        // Update Cargo.toml for WASM target
        const cargoToml = join(tempDir, 'Cargo.toml');
        const cargoContent = await readFile(cargoToml, 'utf-8');
        await writeFile(
          cargoToml,
          cargoContent + '\n[lib]\ncrate-type = ["cdylib"]\n',
          'utf-8'
        );

        // Compile to WASM
        await execAsync('wasm-pack build --target wasi --out-dir pkg', { cwd: tempDir });

        // Read WASM binary
        const wasmFile = join(tempDir, 'pkg', 'wasm_code_bg.wasm');
        if (!existsSync(wasmFile)) {
          throw new Error('WASM file not generated');
        }
        const wasmBinary = await readFile(wasmFile);

        return wasmBinary;
      } finally {
        // Cleanup
        try {
          const { rm } = await import('fs/promises');
          await rm(tempDir, { recursive: true, force: true }).catch(() => {});
        } catch {
          // Fallback cleanup
          try {
            await execAsync(`rm -rf ${tempDir}`);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    } catch (error: any) {
      throw new Error(`Rust compilation failed: ${error.message}`);
    }
  }

  /**
   * Compile Go using TinyGo
   */
  private async compileGo(code: string): Promise<Buffer> {
    try {
      // Check if TinyGo is installed
      try {
        await execAsync('tinygo version');
      } catch {
        throw new Error('TinyGo is not installed. Install from: https://tinygo.org/getting-started/');
      }

      // Create temporary directory
      const tempDir = join(this.cacheDir, 'temp', `go-${Date.now()}-${Math.random().toString(36).substring(7)}`);
      await mkdir(tempDir, { recursive: true });

      try {
        // Write code to file
        const inputFile = join(tempDir, 'main.go');
        await writeFile(inputFile, code, 'utf-8');

        // Compile to WASM
        const outputFile = join(tempDir, 'main.wasm');
        await execAsync(`tinygo build -target wasi -o ${outputFile} ${inputFile}`, {
          cwd: tempDir,
        });

        // Check if WASM file was created
        if (!existsSync(outputFile)) {
          throw new Error('WASM file not generated');
        }

        // Read WASM binary
        const wasmBinary = await readFile(outputFile);

        return wasmBinary;
      } finally {
        // Cleanup temp directory
        try {
          const { rm } = await import('fs/promises');
          await rm(tempDir, { recursive: true, force: true }).catch(() => {});
        } catch {
          // Fallback cleanup
          try {
            await execAsync(`rm -rf ${tempDir}`);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    } catch (error: any) {
      throw new Error(`Go compilation failed: ${error.message}`);
    }
  }

  /**
   * Get compiled WASM from cache
   */
  private async getFromCache(
    code: string,
    language: string
  ): Promise<CompilationResult | null> {
    if (!this.cacheEnabled) return null;

    try {
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256').update(code + language).digest('hex');
      const cacheFile = join(this.cacheDir, `${hash}.json`);

      if (!existsSync(cacheFile)) return null;

      const cached = JSON.parse(await readFile(cacheFile, 'utf-8'));
      const age = Date.now() - cached.timestamp;

      // Check if cache is still valid
      if (age > this.cacheTTL * 1000) {
        await unlink(cacheFile).catch(() => {});
        return null;
      }

      return {
        wasmBinary: Buffer.from(cached.wasmBase64, 'base64'),
        wasmBase64: cached.wasmBase64,
        compilationTime: cached.compilationTime,
        size: cached.size,
      };
    } catch {
      return null;
    }
  }

  /**
   * Save compiled WASM to cache
   */
  private async saveToCache(
    code: string,
    language: string,
    result: CompilationResult
  ): Promise<void> {
    if (!this.cacheEnabled) return;

    try {
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256').update(code + language).digest('hex');
      const cacheFile = join(this.cacheDir, `${hash}.json`);

      await writeFile(
        cacheFile,
        JSON.stringify({
          wasmBase64: result.wasmBase64,
          compilationTime: result.compilationTime,
          size: result.size,
          timestamp: Date.now(),
        }),
        'utf-8'
      );
    } catch (error) {
      console.warn('Failed to cache WASM compilation:', error);
    }
  }
}

export const wasmCompiler = new WasmCompiler();

