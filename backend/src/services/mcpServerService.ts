/**
 * MCP Server Service
 * 
 * Handles deployment of code agents to MCP (Model Context Protocol) servers.
 * MCP servers allow code agents to be exposed as tools that can be used by AI models.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface MCPDeploymentConfig {
  serverName: string;
  serverPath?: string;
  serverUrl?: string;
  protocol?: 'stdio' | 'http' | 'sse';
}

export interface CodeAgent {
  id: string;
  name: string;
  description?: string;
  code: string;
  language: 'javascript' | 'python' | 'typescript' | 'bash';
  inputSchema?: any;
  outputSchema?: any;
  packages?: string[];
  environment?: Record<string, string>;
}

export interface MCPDeploymentResult {
  success: boolean;
  message: string;
  serverPath?: string;
  toolName?: string;
  error?: string;
}

export class MCPServerService {
  private defaultServerPath: string;
  private defaultProtocol: 'stdio' | 'http' | 'sse';

  constructor() {
    this.defaultServerPath = process.env.MCP_SERVER_PATH || join(process.cwd(), 'mcp-servers');
    this.defaultProtocol = (process.env.MCP_PROTOCOL as 'stdio' | 'http' | 'sse') || 'stdio';
  }

  /**
   * Deploy a code agent to an MCP server
   */
  async deployAgent(
    agent: CodeAgent,
    config?: MCPDeploymentConfig
  ): Promise<MCPDeploymentResult> {
    try {
      const serverName = config?.serverName || agent.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const serverPath = config?.serverPath || join(this.defaultServerPath, serverName);
      const protocol = config?.protocol || this.defaultProtocol;

      // Ensure server directory exists
      await mkdir(serverPath, { recursive: true });

      // Generate MCP server configuration
      const serverConfig = this.generateServerConfig(agent, serverName, protocol);
      const configPath = join(serverPath, 'mcp-config.json');
      await writeFile(configPath, JSON.stringify(serverConfig, null, 2), 'utf-8');

      // Generate server implementation based on protocol
      if (protocol === 'stdio') {
        await this.generateStdioServer(agent, serverPath);
      } else if (protocol === 'http') {
        await this.generateHttpServer(agent, serverPath);
      } else if (protocol === 'sse') {
        await this.generateSSEServer(agent, serverPath);
      }

      // Generate package.json if needed
      await this.generatePackageJson(agent, serverPath);

      // Generate README
      await this.generateREADME(agent, serverPath, serverName);

      return {
        success: true,
        message: `Agent deployed to MCP server at ${serverPath}`,
        serverPath,
        toolName: serverName,
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to deploy agent to MCP server',
        error: error.message,
      };
    }
  }

  /**
   * Generate MCP server configuration
   */
  private generateServerConfig(
    agent: CodeAgent,
    serverName: string,
    protocol: 'stdio' | 'http' | 'sse'
  ): any {
    return {
      name: serverName,
      version: '1.0.0',
      description: agent.description || `MCP server for ${agent.name}`,
      protocol,
      tools: [
        {
          name: agent.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          description: agent.description || `Execute ${agent.name}`,
          inputSchema: agent.inputSchema || {
            type: 'object',
            properties: {},
          },
          outputSchema: agent.outputSchema || {
            type: 'object',
            properties: {
              output: {
                type: 'any',
              },
            },
          },
        },
      ],
    };
  }

  /**
   * Generate stdio-based MCP server
   */
  private async generateStdioServer(agent: CodeAgent, serverPath: string): Promise<void> {
    const serverCode = this.generateServerCode(agent, 'stdio');
    const serverFile = join(serverPath, 'server.js');
    await writeFile(serverFile, serverCode, 'utf-8');
  }

  /**
   * Generate HTTP-based MCP server
   */
  private async generateHttpServer(agent: CodeAgent, serverPath: string): Promise<void> {
    const serverCode = this.generateServerCode(agent, 'http');
    const serverFile = join(serverPath, 'server.js');
    await writeFile(serverFile, serverCode, 'utf-8');
  }

  /**
   * Generate SSE-based MCP server
   */
  private async generateSSEServer(agent: CodeAgent, serverPath: string): Promise<void> {
    const serverCode = this.generateServerCode(agent, 'sse');
    const serverFile = join(serverPath, 'server.js');
    await writeFile(serverFile, serverCode, 'utf-8');
  }

  /**
   * Generate server code based on protocol
   */
  private generateServerCode(
    agent: CodeAgent,
    protocol: 'stdio' | 'http' | 'sse'
  ): string {
    const toolName = agent.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const agentCode = agent.code.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    
    if (protocol === 'stdio') {
      return `#!/usr/bin/env node
/**
 * MCP Server for ${agent.name}
 * Generated automatically from code agent
 */

const { spawn } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

// Agent configuration
const agentConfig = ${JSON.stringify({ language: agent.language }, null, 2)};

// Agent code
const agentCode = ${JSON.stringify(agentCode, null, 2)};

// Execute agent code
async function executeAgent(input) {
  try {
    // Wrap agent code in a function
    const wrappedCode = \`
      (async function() {
        const input = \${JSON.stringify(input)};
        \${agentCode}
      })()
    \`;
    
    // Execute using Node.js VM (for JavaScript/TypeScript)
    if (agentConfig.language === 'javascript' || agentConfig.language === 'typescript') {
      const vm = require('vm');
      const context = { input, console, require, process, Buffer, setTimeout, setInterval, clearTimeout, clearInterval };
      const result = await vm.runInNewContext(wrappedCode, context);
      return { output: result };
    }
    
    // For other languages, would need appropriate runtime
    throw new Error(\`Language \${agentConfig.language} not yet supported in MCP server\`);
  } catch (error) {
    return { error: error.message };
  }
}

// Handle MCP protocol messages
rl.on('line', async (line) => {
  try {
    const message = JSON.parse(line);
    
    if (message.method === 'tools/call' && message.params?.name === '${toolName}') {
      const result = await executeAgent(message.params.arguments || {});
      
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        },
      }) + '\\n');
    } else if (message.method === 'initialize') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: '${agent.name}',
            version: '1.0.0',
          },
        },
      }) + '\\n');
    }
  } catch (error) {
    process.stderr.write(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message,
      },
    }) + '\\n');
  }
});
`;
    } else {
      // HTTP/SSE implementations would use Express server
      return `// HTTP/SSE server implementation for ${agent.name}
// Full implementation requires Express server setup
// Install dependencies: npm install express cors
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// MCP Server endpoints for ${agent.name}
app.post('/mcp/call', async (req, res) => {
  // Handle MCP protocol calls
  res.json({ result: 'MCP Server for ${agent.name} - ${protocol} protocol' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('MCP Server for ${agent.name} running on port', PORT);
});
`;
    }
  }

  /**
   * Generate package.json for the MCP server
   */
  private async generatePackageJson(agent: CodeAgent, serverPath: string): Promise<void> {
    const packageJson = {
      name: agent.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      version: '1.0.0',
      description: agent.description || `MCP server for ${agent.name}`,
      main: 'server.js',
      type: 'module',
      scripts: {
        start: 'node server.js',
      },
      dependencies: {
        // Add dependencies based on agent requirements
      },
    };

    // Add agent-specific packages
    if (agent.packages && agent.packages.length > 0) {
      agent.packages.forEach(pkg => {
        packageJson.dependencies[pkg] = 'latest';
      });
    }

    const packagePath = join(serverPath, 'package.json');
    await writeFile(packagePath, JSON.stringify(packageJson, null, 2), 'utf-8');
  }

  /**
   * Generate README for the MCP server
   */
  private async generateREADME(
    agent: CodeAgent,
    serverPath: string,
    serverName: string
  ): Promise<void> {
    const readme = `# ${agent.name} - MCP Server

${agent.description || `MCP server implementation for ${agent.name} code agent.`}

## Installation

\`\`\`bash
cd ${serverPath}
npm install
\`\`\`

## Usage

### Start the server

\`\`\`bash
npm start
\`\`\`

### Use with MCP client

Add to your MCP client configuration:

\`\`\`json
{
  "mcpServers": {
    "${serverName}": {
      "command": "node",
      "args": ["${serverPath}/server.js"]
    }
  }
}
\`\`\`

## Tool: ${agent.name}

${agent.description || 'Execute the code agent.'}

### Input Schema

\`\`\`json
${JSON.stringify(agent.inputSchema || {}, null, 2)}
\`\`\`

### Output Schema

\`\`\`json
${JSON.stringify(agent.outputSchema || {}, null, 2)}
\`\`\`

## Language

${agent.language}

## Environment Variables

${agent.environment ? Object.entries(agent.environment).map(([key, value]) => `- \`${key}\`: ${value}`).join('\n') : 'None configured'}

---

Generated automatically from code agent: ${agent.id}
`;

    const readmePath = join(serverPath, 'README.md');
    await writeFile(readmePath, readme, 'utf-8');
  }
}

export const mcpServerService = new MCPServerService();

