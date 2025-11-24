#!/usr/bin/env node

/**
 * Comprehensive Frontend-Backend Synchronization Analysis Script
 * Extracts all API calls, routes, and identifies mismatches
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FRONTEND_DIR = path.join(__dirname, 'frontend/src');
const BACKEND_DIR = path.join(__dirname, 'backend/src');

// Extract all frontend API calls
function extractFrontendAPICalls() {
  const apiCalls = [];
  const files = execSync(`find ${FRONTEND_DIR} -type f \\( -name "*.tsx" -o -name "*.ts" \\)`, { encoding: 'utf-8' }).trim().split('\n');
  
  files.forEach(file => {
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Match api.get, api.post, etc.
      const apiMatch = line.match(/api\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/);
      if (apiMatch) {
        const method = apiMatch[1].toUpperCase();
        const endpoint = apiMatch[2];
        const component = path.relative(FRONTEND_DIR, file);
        
        apiCalls.push({
          method,
          endpoint,
          component,
          line: index + 1,
          fullLine: line.trim()
        });
      }
    });
  });
  
  return apiCalls;
}

// Extract all backend routes
function extractBackendRoutes() {
  const routes = [];
  const routeFiles = execSync(`find ${BACKEND_DIR}/routes -name "*.ts"`, { encoding: 'utf-8' }).trim().split('\n');
  
  routeFiles.forEach(file => {
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Match router.get, router.post, etc.
      const routeMatch = line.match(/router\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/);
      if (routeMatch) {
        const method = routeMatch[1].toUpperCase();
        let endpoint = routeMatch[2];
        
        // Check if it's a route file to determine base path
        const routeFile = path.basename(file, '.ts');
        const basePath = `/api/v1/${routeFile === 'index' ? '' : routeFile}`;
        
        routes.push({
          method,
          endpoint: endpoint.startsWith('/') ? endpoint : `/${endpoint}`,
          fullPath: `${basePath}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`,
          file: path.relative(BACKEND_DIR, file),
          line: index + 1,
          fullLine: line.trim()
        });
      }
    });
  });
  
  return routes;
}

// Main analysis
console.log('🔍 Starting comprehensive codebase analysis...\n');

const frontendCalls = extractFrontendAPICalls();
const backendRoutes = extractBackendRoutes();

console.log(`📊 Found ${frontendCalls.length} frontend API calls`);
console.log(`📊 Found ${backendRoutes.length} backend routes\n`);

// Write results to JSON for further processing
fs.writeFileSync('frontend-api-calls.json', JSON.stringify(frontendCalls, null, 2));
fs.writeFileSync('backend-routes.json', JSON.stringify(backendRoutes, null, 2));

console.log('✅ Analysis complete! Results saved to:');
console.log('   - frontend-api-calls.json');
console.log('   - backend-routes.json');

