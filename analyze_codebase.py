#!/usr/bin/env python3
"""
Comprehensive Frontend-Backend Synchronization Analysis
Extracts all API calls, routes, and identifies mismatches
"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict

FRONTEND_DIR = Path("frontend/src")
BACKEND_DIR = Path("backend/src")

def extract_frontend_api_calls():
    """Extract all API calls from frontend"""
    api_calls = []
    
    for file_path in FRONTEND_DIR.rglob("*.{ts,tsx}"):
        try:
            content = file_path.read_text(encoding='utf-8')
            lines = content.split('\n')
            
            for idx, line in enumerate(lines, 1):
                # Match api.get, api.post, etc. - handle various quote styles
                # Pattern: api.METHOD('endpoint') or api.METHOD("endpoint") or api.METHOD(`endpoint${var}`)
                # More flexible pattern that handles quotes and template literals
                patterns = [
                    r"api\.(get|post|put|delete|patch)\(['\"]([^'\"]+)['\"]",  # Single/double quotes
                    r'api\.(get|post|put|delete|patch)\(`([^`]+)`',  # Template literals
                ]
                
                for pattern in patterns:
                    matches = re.finditer(pattern, line)
                    for match in matches:
                        method = match.group(1).upper()
                        endpoint_raw = match.group(2)
                        
                        # Clean up endpoint - remove template variables for base path
                        endpoint = re.sub(r'\$\{[^}]+\}', '', endpoint_raw).strip('/')
                        # Remove query string params for matching
                        endpoint = endpoint.split('?')[0]
                        
                        if endpoint:  # Only add if we have a valid endpoint
                            component = str(file_path.relative_to(FRONTEND_DIR))
                            api_calls.append({
                                'method': method,
                                'endpoint': endpoint,
                                'component': component,
                                'line': idx,
                                'fullLine': line.strip(),
                                'rawEndpoint': endpoint_raw
                            })
                            break  # Only match once per line
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    
    return api_calls

def extract_backend_routes():
    """Extract all routes from backend"""
    routes = []
    route_dir = BACKEND_DIR / "routes"
    
    # Map route files to their base paths
    route_base_map = {
        'auth.ts': '/api/v1/auth',
        'workflows.ts': '/api/v1/workflows',
        'executions.ts': '/api/v1/executions',
        'stats.ts': '/api/v1/stats',
        'templates.ts': '/api/v1/templates',
        'analytics.ts': '/api/v1/analytics',
        'alerts.ts': '/api/v1/alerts',
        'roles.ts': '/api/v1/roles',
        'teams.ts': '/api/v1/teams',
        'invitations.ts': '/api/v1/invitations',
        'users.ts': '/api/v1/users',
        'apiKeys.ts': '/api/v1/api-keys',
        'auditLogs.ts': '/api/v1/audit-logs',
        'emailOAuth.ts': '/api/v1/email-oauth',
        'emailTriggerMonitoring.ts': '/api/v1/email-triggers/monitoring',
        'performanceMonitoring.ts': '/api/v1/monitoring/performance',
        'agents.ts': '/api/v1/agents',
        'observability.ts': '/api/v1/observability',
        'osint.ts': '/api/v1/osint',
        'connectors.ts': '/api/v1/connectors',
        'nango.ts': '/api/v1/nango',
        'earlyAccess.ts': '/api/v1/early-access',
        'contact.ts': '/api/v1/contact',
        'codeAgents.ts': '/api/v1/code-agents',
        'codeExecLogs.ts': '/api/v1/code-exec-logs',
        'policies.ts': '/api/v1/policies',
        'webhooks.ts': '/webhooks',
    }
    
    for file_path in route_dir.glob("*.ts"):
        try:
            content = file_path.read_text(encoding='utf-8')
            base_path = route_base_map.get(file_path.name, '/api/v1')
            lines = content.split('\n')
            
            for idx, line in enumerate(lines, 1):
                # Match router.get, router.post, etc.
                matches = re.finditer(r'router\.(get|post|put|delete|patch)\([\'"`]([^\'"`]+)[\'"`]', line)
                for match in matches:
                    method = match.group(1).upper()
                    endpoint = match.group(2)
                    if not endpoint.startswith('/'):
                        endpoint = '/' + endpoint
                    
                    full_path = f"{base_path}{endpoint}"
                    
                    routes.append({
                        'method': method,
                        'endpoint': endpoint,
                        'fullPath': full_path,
                        'file': str(file_path.relative_to(BACKEND_DIR)),
                        'line': idx,
                        'fullLine': line.strip()
                    })
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    
    return routes

def normalize_endpoint(endpoint):
    """Normalize endpoint for comparison"""
    # Remove leading/trailing slashes and normalize
    endpoint = endpoint.strip('/')
    # Remove query params
    endpoint = endpoint.split('?')[0]
    return endpoint

def analyze_synchronization(frontend_calls, backend_routes):
    """Compare frontend calls with backend routes"""
    # Create lookup maps
    backend_map = {}
    for route in backend_routes:
        key = (route['method'], normalize_endpoint(route['fullPath']))
        if key not in backend_map:
            backend_map[key] = []
        backend_map[key].append(route)
    
    frontend_map = {}
    for call in frontend_calls:
        # Frontend calls use relative paths, need to add /api/v1 prefix
        endpoint = call['endpoint']
        if not endpoint.startswith('/api/v1'):
            endpoint = f"/api/v1{endpoint}" if endpoint.startswith('/') else f"/api/v1/{endpoint}"
        key = (call['method'], normalize_endpoint(endpoint))
        if key not in frontend_map:
            frontend_map[key] = []
        frontend_map[key].append(call)
    
    # Find matches and mismatches
    matched = []
    frontend_unmatched = []
    backend_unused = []
    
    # Check frontend calls
    for key, calls in frontend_map.items():
        if key in backend_map:
            matched.append({
                'frontend': calls,
                'backend': backend_map[key]
            })
        else:
            frontend_unmatched.extend(calls)
    
    # Check backend routes
    for key, routes in backend_map.items():
        if key not in frontend_map:
            backend_unused.extend(routes)
    
    return {
        'matched': matched,
        'frontend_unmatched': frontend_unmatched,
        'backend_unused': backend_unused
    }

if __name__ == '__main__':
    print("🔍 Starting comprehensive codebase analysis...\n")
    
    frontend_calls = extract_frontend_api_calls()
    backend_routes = extract_backend_routes()
    
    print(f"📊 Found {len(frontend_calls)} frontend API calls")
    print(f"📊 Found {len(backend_routes)} backend routes\n")
    
    # Save raw data
    with open('frontend-api-calls.json', 'w') as f:
        json.dump(frontend_calls, f, indent=2)
    
    with open('backend-routes.json', 'w') as f:
        json.dump(backend_routes, f, indent=2)
    
    # Analyze synchronization
    analysis = analyze_synchronization(frontend_calls, backend_routes)
    
    print(f"✅ Matched: {len(analysis['matched'])}")
    print(f"⚠️  Frontend unmatched: {len(analysis['frontend_unmatched'])}")
    print(f"⚠️  Backend unused: {len(analysis['backend_unused'])}\n")
    
    with open('synchronization-analysis.json', 'w') as f:
        json.dump(analysis, f, indent=2)
    
    print("✅ Analysis complete! Results saved to:")
    print("   - frontend-api-calls.json")
    print("   - backend-routes.json")
    print("   - synchronization-analysis.json")

