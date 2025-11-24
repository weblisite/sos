import { useState, useEffect } from 'react';
import { Node } from 'reactflow';
import { getNodeDefinition } from '../lib/nodes/nodeRegistry';
import api from '../lib/api';
import { CodeEditor } from './CodeEditor';
import { useQuery } from '@tanstack/react-query';
import { useModals } from '../lib/modals';

interface NodeConfigPanelProps {
  node: Node | null;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
}

export default function NodeConfigPanel({ node, onUpdate, onClose, onDelete }: NodeConfigPanelProps) {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [retry, setRetry] = useState<Record<string, unknown>>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const { alert, confirm } = useModals();

  // Fetch code agents for hook selection and AI agent selection
  const { data: codeAgents } = useQuery({
    queryKey: ['code-agents'],
    queryFn: async () => {
      const response = await api.get('/code-agents');
      return response.data;
    },
    enabled: node?.data?.type === 'ai.rag' || node?.data?.type === 'ai.document_ingest' || node?.data?.type === 'ai.agent',
  });

  // Fetch connectors to use as tools for AI agents
  const { data: connectors = [] } = useQuery({
    queryKey: ['connectors'],
    queryFn: async () => {
      try {
        const response = await api.get('/connectors');
        return response.data;
      } catch (error) {
        console.error('Failed to fetch connectors:', error);
        return [];
      }
    },
    enabled: node?.data?.type === 'ai.agent',
  });

  // Check if this is an integration node
  const isIntegrationNode = node?.data?.type?.startsWith('integration.');
  const connectorId = isIntegrationNode ? (node.data.type as string).replace('integration.', '') : null;

  // Fetch connector info and connection status for integration nodes
  const { data: connectorInfo } = useQuery({
    queryKey: ['connector', connectorId],
    queryFn: async () => {
      if (!connectorId) return null;
      const response = await api.get(`/connectors/${connectorId}`);
      return response.data;
    },
    enabled: !!connectorId,
  });

  const { data: connectorCredentials } = useQuery({
    queryKey: ['connectors', 'credentials'],
    queryFn: async () => {
      const response = await api.get('/connectors/credentials');
      return response.data;
    },
    enabled: !!connectorId,
  });

  const isConnectorConnected = connectorId && connectorCredentials?.some(
    (c: any) => c.connectorId === connectorId
  );

  useEffect(() => {
    if (node) {
      setConfig(node.data.config || {});
      setRetry((node.data.retry as Record<string, unknown>) || { enabled: false, maxAttempts: 3, backoff: 'exponential', delay: 1000 });
      
      // Check if email trigger node has credentials
      const nodeType = node.data.type as string;
      if (nodeType?.startsWith('trigger.email.')) {
        const credentials = (config.credentials as Record<string, unknown>) || {};
        if (credentials.accessToken) {
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('idle');
        }
      }
    }
  }, [node, config]);

  if (!node) return null;

  const nodeDef = getNodeDefinition(node.data.type);
  if (!nodeDef || !nodeDef.config) {
    return (
      <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Node Configuration</h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">No configuration available for this node.</p>
      </div>
    );
  }

  const handleChange = (key: string, value: unknown) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onUpdate(node.id, { ...node.data, config: newConfig });
  };

  const handleRetryChange = (key: string, value: unknown) => {
    const newRetry = { ...retry, [key]: value };
    setRetry(newRetry);
    onUpdate(node.id, { ...node.data, retry: newRetry });
  };

  const handleConnectOAuth = async (provider: 'gmail' | 'outlook') => {
    try {
      setIsConnecting(true);
      setConnectionStatus('connecting');

      // Get OAuth authorization URL
      const response = await api.get(`/email-oauth/${provider}/authorize`);
      const { authUrl } = response.data;

      // Store node ID and provider in sessionStorage for callback
      sessionStorage.setItem('oauth_node_id', node.id);
      sessionStorage.setItem('oauth_provider', provider);

      // Open OAuth window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const oauthWindow = window.open(
        authUrl,
        'OAuth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      // Listen for OAuth callback via event and polling
      const handleOAuthEvent = (event: CustomEvent) => {
        if (event.detail.nodeId === node.id && event.detail.provider === provider) {
          clearInterval(checkOAuthCallback);
          window.removeEventListener('oauth-callback', handleOAuthEvent as EventListener);
          sessionStorage.removeItem(`oauth_${provider}_token`);
          handleOAuthCallback(event.detail.token, provider);
          if (oauthWindow) oauthWindow.close();
        }
      };

      window.addEventListener('oauth-callback', handleOAuthEvent as EventListener);

      const checkOAuthCallback = setInterval(() => {
        try {
          const token = sessionStorage.getItem(`oauth_${provider}_token`);
          if (token) {
            clearInterval(checkOAuthCallback);
            window.removeEventListener('oauth-callback', handleOAuthEvent as EventListener);
            sessionStorage.removeItem(`oauth_${provider}_token`);
            handleOAuthCallback(token, provider);
            if (oauthWindow) oauthWindow.close();
          }
        } catch (error) {
          console.error('Error checking OAuth callback:', error);
        }
      }, 500);

      // Cleanup after 10 minutes
      const cleanup = () => {
        clearInterval(checkOAuthCallback);
        window.removeEventListener('oauth-callback', handleOAuthEvent as EventListener);
        if (oauthWindow && !oauthWindow.closed) {
          oauthWindow.close();
        }
        setIsConnecting(false);
        setConnectionStatus('idle');
      };

      setTimeout(cleanup, 10 * 60 * 1000);
    } catch (error: any) {
      console.error('Error initiating OAuth:', error);
      setConnectionStatus('error');
      setIsConnecting(false);
      await alert(`Failed to connect ${provider}: ${error.response?.data?.error || error.message}`, 'Connection Error', 'error');
    }
  };

  const handleOAuthCallback = async (token: string, provider: 'gmail' | 'outlook') => {
    try {
      // Retrieve credentials from backend using secure token
      const response = await api.get(`/email-oauth/retrieve/${token}`);
      const { credentials, email } = response.data;

      // Update node config with credentials and email
      const newConfig = {
        ...config,
        credentials,
        email: email || config.email,
      };

      setConfig(newConfig);
      onUpdate(node.id, { ...node.data, config: newConfig });
      setConnectionStatus('connected');
      setIsConnecting(false);
    } catch (error: any) {
      console.error('Error retrieving OAuth credentials:', error);
      setConnectionStatus('error');
      setIsConnecting(false);
      alert(`Failed to retrieve credentials: ${error.response?.data?.error || error.message}`);
    }
  };

  // Handle connector connection for integration nodes
  const handleConnectConnector = async () => {
    if (!connectorId || !connectorInfo) return;

    try {
      setIsConnecting(true);
      setConnectionStatus('connecting');

      if (connectorInfo.auth?.type === 'oauth2') {
        // Initiate OAuth flow
        const response = await api.post(`/connectors/${connectorId}/connect`);
        const data = response.data;

        if (data.authUrl) {
          // Open OAuth flow in popup
          const width = 600;
          const height = 700;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;

          const oauthWindow = window.open(
            data.authUrl,
            'OAuth',
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
          );

          // Listen for OAuth callback
          const checkOAuthCallback = setInterval(() => {
            if (oauthWindow?.closed) {
              clearInterval(checkOAuthCallback);
              // Refetch credentials
              window.location.reload(); // Simple reload to refresh connection status
            }
          }, 1000);
        } else if (data.requiresManualSetup) {
          await alert(`Please configure ${connectorInfo.name} credentials manually. Auth type: ${data.authType}`, 'Manual Configuration Required', 'warning');
          setIsConnecting(false);
          setConnectionStatus('idle');
        }
      } else if (connectorInfo.auth?.type === 'api_key') {
        // Show API key input modal
        const apiKey = await prompt(`Enter your ${connectorInfo.name} API key:`, 'API Key Required', '', `Enter your ${connectorInfo.name} API key`);
        if (apiKey) {
          try {
            await api.post('/connectors/credentials', {
              connectorId,
              credentials: {
                api_key: apiKey,
              },
            });
            // Refetch credentials
            window.location.reload();
          } catch (error: any) {
            await alert(`Failed to save API key: ${error.response?.data?.error || error.message}`, 'Error', 'error');
            setIsConnecting(false);
            setConnectionStatus('idle');
          }
        } else {
          setIsConnecting(false);
          setConnectionStatus('idle');
        }
      } else if (connectorInfo.auth?.type === 'connection_string') {
        // Show connection string input modal
        const connectionString = await prompt(`Enter your ${connectorInfo.name} connection string:`, 'Connection String Required', '', `Enter your ${connectorInfo.name} connection string`);
        if (connectionString) {
          try {
            await api.post('/connectors/credentials', {
              connectorId,
              credentials: {
                connection_string: connectionString,
              },
            });
            // Refetch credentials
            window.location.reload();
          } catch (error: any) {
            await alert(`Failed to save connection string: ${error.response?.data?.error || error.message}`, 'Error', 'error');
            setIsConnecting(false);
            setConnectionStatus('idle');
          }
        } else {
          setIsConnecting(false);
          setConnectionStatus('idle');
        }
      }
    } catch (error: any) {
      console.error('Failed to connect connector:', error);
      await alert(`Failed to connect: ${error.response?.data?.error || error.message}`, 'Connection Error', 'error');
      setIsConnecting(false);
      setConnectionStatus('error');
    }
  };

  const handleFileUpload = async (file: File, key: string) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (key === 'imageBase64' || key === 'imageUrl') {
          // Convert to base64 data URI
          handleChange(key, result);
        } else {
          handleChange(key, result);
        }
        resolve();
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const renderInput = (key: string, property: any) => {
    const value = config[key] ?? property.default ?? '';
    const nodeType = node?.data?.type as string;

    // Special handling for image file uploads in image analysis nodes
    if ((nodeType === 'ai.image_analyze' || nodeType === 'ai.ocr') && (key === 'imageUrl' || key === 'imageBase64')) {
      return (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileUpload(file, key).catch((error) => {
                  console.error('Error uploading file:', error);
                  alert('Failed to upload image', 'Upload Error', 'error');
                });
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
          />
          {value && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current value:</p>
              {typeof value === 'string' && value.startsWith('data:image') ? (
                <div className="space-y-1">
                  <img src={value} alt="Preview" className="max-w-full h-32 object-contain rounded border border-gray-200 dark:border-gray-700" />
                  <button
                    onClick={() => handleChange(key, '')}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Remove image
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={String(value)}
                  onChange={(e) => handleChange(key, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Or enter image URL"
                  className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-gray-900 dark:text-gray-100"
                />
              )}
            </div>
          )}
          {property.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{property.description}</p>
          )}
        </div>
      );
    }

    // Special handling for hook fields (preIngestHook, postAnswerHook) and agent selection
    if (key === 'preIngestHook' || key === 'postAnswerHook' || key === 'selectedAgent') {
      return (
        <div className="space-y-2">
          <select
            value={value as string || ''}
            onChange={(e) => handleChange(key, e.target.value || undefined)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            <option value="">{key === 'selectedAgent' ? 'Create new agent (use settings below)' : 'None (no hook)'}</option>
            {codeAgents?.map((agent: any) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.language}) - v{agent.version}
              </option>
            ))}
          </select>
          {property.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{property.description}</p>
          )}
        </div>
      );
    }

    switch (property.type) {
      case 'string':
        if (property.enum) {
          // Map agent framework values to display names
          const getDisplayName = (val: string, key: string) => {
            if (key === 'agentType') {
              const frameworkLabels: Record<string, string> = {
                'auto': 'Auto (Intelligent Routing)',
                'one-shot': 'One-Shot Agent',
                'recursive': 'Recursive Agent',
                'multi-role': 'Multi-Role Agent',
                'collaborative': 'Collaborative Agent',
              };
              return frameworkLabels[val] || val;
            }
            return String(val);
          };
          
          return (
            <select
              value={value as string}
              onChange={(e) => handleChange(key, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              {property.enum.map((opt: unknown) => (
                <option key={String(opt)} value={String(opt)}>
                  {getDisplayName(String(opt), key)}
                </option>
              ))}
            </select>
          );
        }
        // Use Monaco editor for code format
        if (property.format === 'code') {
          // Determine language from node type or property
          let language: 'javascript' | 'python' | 'typescript' | 'bash' = 'javascript';
          const nodeType = node?.data?.type as string;
          if (nodeType === 'action.code.python') {
            language = 'python';
          } else if (property.language === 'python') {
            language = 'python';
          } else if (property.language === 'typescript') {
            language = 'typescript';
          } else if (property.language === 'bash') {
            language = 'bash';
          }
          
          // Special handling for while loop condition with documentation
          const isWhileLoop = nodeType === 'logic.loop.while' && key === 'condition';
          
          return (
            <div className="space-y-2">
              {isWhileLoop && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md mb-2">
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">📖 While Loop Documentation</p>
                  <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                    <p><strong>Condition Format:</strong> JavaScript expression that returns a boolean</p>
                    <p><strong>Access Input:</strong> Use <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">input</code> to access current input data</p>
                    <p><strong>Examples:</strong></p>
                    <ul className="list-disc list-inside ml-2 space-y-0.5">
                      <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">input.count &lt; 10</code></li>
                      <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">input.status === 'active'</code></li>
                      <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">input.items.length &gt; 0</code></li>
                    </ul>
                    <p className="mt-1"><strong>Note:</strong> The loop continues while the condition is true. Use maxIterations to prevent infinite loops.</p>
                  </div>
                </div>
              )}
              <div style={{ minHeight: '300px', position: 'relative', zIndex: 10 }}>
                <CodeEditor
                  language={language}
                  value={value as string || ''}
                  onChange={(val) => handleChange(key, val)}
                  height="300px"
                  placeholder={property.description}
                />
              </div>
              {property.description && !isWhileLoop && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{property.description}</p>
              )}
            </div>
          );
        }
        
        // Schema editor for input/output schemas
        if (property.format === 'schema') {
          const schemaValue = typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2);
          const isInputSchema = key === 'inputSchema';
          const nodeType = node?.data?.type as string;
          const defaultSchema = isInputSchema
            ? {
                type: 'object',
                properties: {
                  input: { type: 'any' },
                },
              }
            : {
                type: 'object',
                properties: {
                  output: { type: 'any' },
                },
              };
          
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {isInputSchema ? 'Input Schema' : 'Output Schema'} (JSON)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(schemaValue);
                      handleChange(key, parsed);
                    } catch {
                      // Invalid JSON, use default
                      handleChange(key, defaultSchema);
                    }
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Reset to Default
                </button>
              </div>
              <CodeEditor
                language="json"
                value={schemaValue}
                onChange={(val) => {
                  try {
                    const parsed = JSON.parse(val);
                    handleChange(key, parsed);
                  } catch {
                    // Invalid JSON, store as string for now
                    handleChange(key, val);
                  }
                }}
                height="200px"
                placeholder={JSON.stringify(defaultSchema, null, 2)}
              />
              <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="mt-0.5">💡</span>
                <div>
                  <p className="mb-1">
                    {nodeType === 'action.code.python'
                      ? 'Pydantic schema format (e.g., {"type": "object", "properties": {...}})'
                      : 'Zod schema format (e.g., {"type": "object", "properties": {...}})'}
                  </p>
                  <p>Schema will be used to validate input/output before/after code execution.</p>
                </div>
              </div>
            </div>
          );
        }
        return (
          <textarea
            value={value as string}
            onChange={(e) => handleChange(key, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={property.description}
            rows={3}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
          />
        );

      case 'array':
        // Handle array inputs (e.g., Switch cases, packages, tools)
        if (property.items?.enum && key === 'tools') {
          // Tool selection for agents
          const selectedTools = Array.isArray(value) ? value : [];
          const availableTools = property.items.enum as string[];
          const toolLabels: Record<string, string> = {
            calculator: 'Calculator',
            wikipedia: 'Wikipedia Search',
            serpapi: 'SerpAPI Search',
            duckduckgo: 'DuckDuckGo Search',
            brave: 'Brave Search',
            execute_code: 'Code Execution',
          };
          
          const toolDescriptions: Record<string, string> = {
            calculator: 'Perform mathematical calculations',
            wikipedia: 'Search Wikipedia for information',
            serpapi: 'Search the web using SerpAPI (requires API key)',
            duckduckgo: 'Search the web using DuckDuckGo (free, no API key)',
            brave: 'Search the web using Brave Search (requires API key)',
            execute_code: 'Write and execute custom code in JavaScript or Python',
          };

          // Add connectors as tools (format: app:connectorId or app:connectorId:actionId)
          const connectorTools = connectors
            .filter((connector: any) => connector.actions && connector.actions.length > 0)
            .flatMap((connector: any) => {
              // Add connector as a tool (allows agent to use any action from this connector)
              const connectorTool = {
                id: `app:${connector.id}`,
                name: connector.name,
                description: `Use ${connector.name} integrations (all actions)`,
                icon: connector.icon,
                type: 'connector',
              };
              
              // Also add individual actions as tools
              const actionTools = connector.actions.map((action: any) => ({
                id: `app:${connector.id}:${action.id}`,
                name: `${connector.name}: ${action.name}`,
                description: action.description || `Execute ${action.name} action from ${connector.name}`,
                icon: connector.icon,
                type: 'action',
              }));
              
              return [connectorTool, ...actionTools];
            });
          
          return (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Select tools the agent can use
              </div>
              
              {/* Built-in Tools */}
              {availableTools.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Built-in Tools</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableTools.map((tool) => (
                      <label key={tool} className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedTools.includes(tool)}
                          onChange={(e) => {
                            const newTools = e.target.checked
                              ? [...selectedTools, tool]
                              : selectedTools.filter((t) => t !== tool);
                            handleChange(key, newTools);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {toolLabels[tool] || tool}
                            </span>
                            {tool === 'execute_code' && (
                              <span className="text-xs text-blue-600 dark:text-blue-400" title="Allows agent to write and execute custom code">
                                ⚡
                              </span>
                            )}
                          </div>
                          {toolDescriptions[tool] && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {toolDescriptions[tool]}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* App Integrations as Tools */}
              {connectorTools.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">App Integrations</div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {connectorTools.map((connectorTool: any) => (
                      <label key={connectorTool.id} className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedTools.includes(connectorTool.id)}
                          onChange={(e) => {
                            const newTools = e.target.checked
                              ? [...selectedTools, connectorTool.id]
                              : selectedTools.filter((t) => t !== connectorTool.id);
                            handleChange(key, newTools);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {connectorTool.icon && (
                              <img 
                                src={connectorTool.icon} 
                                alt={connectorTool.name}
                                className="w-4 h-4 rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {connectorTool.name}
                            </span>
                            {connectorTool.type === 'connector' && (
                              <span className="text-xs text-blue-600 dark:text-blue-400" title="All actions from this app">
                                📦
                              </span>
                            )}
                          </div>
                          {connectorTool.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {connectorTool.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }
        if (property.format === 'packages') {
          // Packages: one per line
          const packagesArray = Array.isArray(value) ? value : [];
          const packagesText = packagesArray.join('\n');
          return (
            <div className="space-y-2">
              <textarea
                value={packagesText}
                onChange={(e) => {
                  const lines = e.target.value.split('\n').filter(line => line.trim());
                  handleChange(key, lines);
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="pandas&#10;numpy&#10;requests"
                rows={4}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">Enter one package per line (e.g., pandas, numpy)</p>
            </div>
          );
        }
        // Default: JSON array
        return (
          <div className="space-y-2">
            <textarea
              value={JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleChange(key, parsed);
                } catch {
                  // Invalid JSON, keep as string for now
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={property.description || 'Enter JSON array'}
              rows={6}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">Enter as JSON array</p>
          </div>
        );

      case 'number':
        return (
          <div className="space-y-1">
            <input
              type="number"
              value={value as number}
              onChange={(e) => handleChange(key, parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              min={property.minimum}
              max={property.maximum}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            {property.minimum !== undefined && property.maximum !== undefined && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Range: {property.minimum} - {property.maximum} ms
              </p>
            )}
          </div>
        );

      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => handleChange(key, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
          />
        );

      default:
        return (
          <input
            type="text"
            value={String(value)}
            onChange={(e) => handleChange(key, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        );
    }
  };

  return (
    <div 
      className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Node configuration panel"
      aria-modal="false"
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Configure Node</h3>
          <div className="flex gap-2">
            {onDelete && (
              <button
                onClick={async () => {
                  const confirmed = await confirm(
                    'Are you sure you want to delete this node?',
                    'Delete Node',
                    'danger'
                  );
                  if (confirmed) {
                    onDelete(node.id);
                    onClose();
                  }
                }}
                className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete node"
              >
                🗑️
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close configuration panel"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{nodeDef.name}</p>
        {nodeDef.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{nodeDef.description}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Connector Connection Section for Integration Nodes */}
        {isIntegrationNode && connectorInfo && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {connectorInfo.name} Connection
              </h4>
              {isConnectorConnected ? (
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                  ✓ Connected
                </span>
              ) : (
                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded">
                  Not Connected
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              {connectorInfo.description}
            </p>
            {!isConnectorConnected ? (
              <button
                onClick={handleConnectConnector}
                disabled={isConnecting}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                {isConnecting ? 'Connecting...' : `Connect ${connectorInfo.name}`}
              </button>
            ) : (
              <div className="text-xs text-green-700 dark:text-green-300">
                ✓ This connector is connected. You can configure the action below.
              </div>
            )}
            {connectionStatus === 'error' && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">Connection failed. Please try again.</p>
            )}
          </div>
        )}

        {/* OAuth Connection Section for Email Triggers */}
        {(node.data.type as string)?.startsWith('trigger.email.gmail') && (
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Gmail Connection</h4>
            {connectionStatus === 'connected' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <span>✓</span>
                  <span>Connected to {(config.email as string) || 'Gmail'}</span>
                </div>
                <button
                  onClick={() => handleConnectOAuth('gmail')}
                  className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Reconnect Gmail
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnectOAuth('gmail')}
                disabled={isConnecting}
                className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect Gmail'}
              </button>
            )}
            {connectionStatus === 'error' && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">Connection failed. Please try again.</p>
            )}
          </div>
        )}

        {(node.data.type as string)?.startsWith('trigger.email.outlook') && (
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Outlook Connection</h4>
            {connectionStatus === 'connected' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <span>✓</span>
                  <span>Connected to {(config.email as string) || 'Outlook'}</span>
                </div>
                <button
                  onClick={() => handleConnectOAuth('outlook')}
                  className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Reconnect Outlook
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnectOAuth('outlook')}
                disabled={isConnecting}
                className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect Outlook'}
              </button>
            )}
            {connectionStatus === 'error' && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">Connection failed. Please try again.</p>
            )}
          </div>
        )}

        {/* Web Scrape Node - Grouped Sections */}
        {(node.data.type as string) === 'action.web_scrape' && (
          <>
            {/* Basic Configuration */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Basic Configuration</h4>
              {Object.entries(nodeDef.config.properties)
                .filter(([key]) => ['url', 'selectors', 'extractText', 'extractHtml', 'extractAttributes'].includes(key))
                .map(([key, property]) => {
                  if (key === 'selectors') {
                    const selectors = (config.selectors as Record<string, string>) || {};
                    const selectorEntries = Object.entries(selectors);
                    
                    return (
                      <div key={key} className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {key}
                          {nodeDef.config?.required?.includes(key) && (
                            <span className="text-red-500 dark:text-red-400 ml-1">*</span>
                          )}
                        </label>
                        {property.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{property.description}</p>
                        )}
                        <div className="space-y-2">
                          {selectorEntries.map(([fieldName, selector], index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Field name (e.g., title)"
                                value={fieldName}
                                onChange={(e) => {
                                  const newSelectors = { ...selectors };
                                  delete newSelectors[fieldName];
                                  newSelectors[e.target.value] = selector;
                                  handleChange('selectors', newSelectors);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
                              />
                              <input
                                type="text"
                                placeholder="CSS selector (e.g., h1.title)"
                                value={selector}
                                onChange={(e) => {
                                  const newSelectors = { ...selectors };
                                  newSelectors[fieldName] = e.target.value;
                                  handleChange('selectors', newSelectors);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm font-mono"
                              />
                              <button
                                onClick={() => {
                                  const newSelectors = { ...selectors };
                                  delete newSelectors[fieldName];
                                  handleChange('selectors', newSelectors);
                                }}
                                className="px-2 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                title="Remove selector"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const newSelectors = { ...selectors, '': '' };
                              handleChange('selectors', newSelectors);
                            }}
                            className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                          >
                            + Add Selector
                          </button>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={key} className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {key}
                        {nodeDef.config?.required?.includes(key) && (
                          <span className="text-red-500 dark:text-red-400 ml-1">*</span>
                        )}
                      </label>
                      {property.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{property.description}</p>
                      )}
                      {renderInput(key, property)}
                    </div>
                  );
                })}
            </div>

            {/* JavaScript Rendering (Puppeteer) */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">JavaScript Rendering</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Enable for JavaScript-rendered content (SPAs, React, Vue, Angular). Auto-detected if not set.
              </p>
              {Object.entries(nodeDef.config.properties)
                .filter(([key]) => ['renderJavaScript', 'waitForSelector', 'waitForTimeout', 'executeJavaScript', 'scrollToBottom', 'viewport', 'screenshot'].includes(key))
                .map(([key, property]) => (
                  <div key={key} className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {key}
                    </label>
                    {property.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{property.description}</p>
                    )}
                    {renderInput(key, property)}
                  </div>
                ))}
            </div>

            {/* Proxy Settings */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Proxy Settings</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Use proxy for requests to avoid rate limits and IP bans.
              </p>
              {Object.entries(nodeDef.config.properties)
                .filter(([key]) => ['useProxy', 'proxyOptions', 'proxyId'].includes(key))
                .map(([key, property]) => (
                  <div key={key} className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {key}
                    </label>
                    {property.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{property.description}</p>
                    )}
                    {renderInput(key, property)}
                  </div>
                ))}
            </div>

            {/* Advanced Options */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Advanced Options</h4>
              {Object.entries(nodeDef.config.properties)
                .filter(([key]) => !['url', 'selectors', 'extractText', 'extractHtml', 'extractAttributes', 'renderJavaScript', 'waitForSelector', 'waitForTimeout', 'executeJavaScript', 'scrollToBottom', 'viewport', 'screenshot', 'useProxy', 'proxyOptions', 'proxyId'].includes(key))
                .map(([key, property]) => (
                  <div key={key} className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {key}
                      {nodeDef.config?.required?.includes(key) && (
                        <span className="text-red-500 dark:text-red-400 ml-1">*</span>
                      )}
                    </label>
                    {property.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{property.description}</p>
                    )}
                    {renderInput(key, property)}
                  </div>
                ))}
            </div>
          </>
        )}

        {/* Other Nodes - Standard Configuration */}
        {(node.data.type as string) !== 'action.web_scrape' && (
          <>
            {Object.entries(nodeDef.config.properties).map(([key, property]) => {
              // Skip credentials field for email triggers (handled by OAuth)
              if (key === 'credentials' && (node.data.type as string)?.startsWith('trigger.email.')) {
                return null;
              }

              // Skip credentials field for integration nodes (handled by connector connection)
              if (key === 'credentials' && isIntegrationNode) {
                return null;
              }

              // Show warning if integration node is not connected
              if (isIntegrationNode && !isConnectorConnected && key === 'action') {
                return (
                  <div key={key} className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      ⚠️ Please connect {connectorInfo?.name} above before configuring the action.
                    </p>
                  </div>
                );
              }
              
              // Special handling for RAG pipeline configuration
              const isRAGNode = nodeType === 'ai.rag';
              const isVectorStoreField = isRAGNode && (key === 'vectorStoreProvider' || key === 'indexName');
              const isLLMField = isRAGNode && (key === 'llmProvider' || key === 'model');
              const isQueryField = isRAGNode && key === 'query';
              
              // Show RAG pipeline validation and tips
              if (isRAGNode && key === 'vectorStoreProvider') {
                return (
                  <div key={key} className="mb-4">
                    <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200 font-semibold mb-2">
                        💡 RAG Pipeline Configuration Tips:
                      </p>
                      <ul className="list-disc list-inside text-xs text-blue-700 dark:text-blue-300 space-y-1">
                        <li>Ensure your selected <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">vectorStoreProvider</code> is configured in the backend (e.g., API keys for Pinecone/Weaviate, or a running Chroma/PostgreSQL instance).</li>
                        <li>The <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">indexName</code> must exist in your vector store and contain relevant documents. Use the "Document Ingestion" node to populate it.</li>
                        <li>Verify your LLM provider (e.g., OpenAI, Anthropic) has the necessary API keys configured in your environment variables.</li>
                        <li>For testing, use <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">memory</code> provider. For production, use <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">database</code> or a dedicated vector store.</li>
                      </ul>
                    </div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {key}
                      {nodeDef.config?.required?.includes(key) && (
                        <span className="text-red-500 dark:text-red-400 ml-1">*</span>
                      )}
                    </label>
                    {property.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{property.description}</p>
                    )}
                    {renderInput(key, property)}
                  </div>
                );
              }
              
              return (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {key}
                    {nodeDef.config?.required?.includes(key) && (
                      <span className="text-red-500 dark:text-red-400 ml-1">*</span>
                    )}
                  </label>
                  {property.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{property.description}</p>
                  )}
                  {isRAGNode && isLLMField && !config.llmProvider && key === 'llmProvider' && (
                    <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-200">
                      ⚠️ Warning: Ensure your LLM provider API key is configured in environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
                    </div>
                  )}
                  {isRAGNode && isQueryField && !config.query && (
                    <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-200">
                      ⚠️ Required: The query field must be provided at runtime (via input) or configured here
                    </div>
                  )}
                  {renderInput(key, property)}
                </div>
              );
            })}
          </>
        )}

        {/* Breakpoint Settings */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Debug Settings</h4>
          
          <div className="space-y-3">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={(node.data.breakpoint as boolean) || false}
                  onChange={(e) => onUpdate(node.id, { ...node.data, breakpoint: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Breakpoint</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">Pause execution when this node is reached</p>
            </div>
          </div>
        </div>

        {/* Retry Settings Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Retry Settings</h4>
          
          <div className="space-y-3">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={(retry.enabled as boolean) || false}
                  onChange={(e) => handleRetryChange('enabled', e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Retry</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">Automatically retry failed executions</p>
            </div>

            {(retry.enabled as boolean) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Attempts
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={(retry.maxAttempts as number) || 3}
                    onChange={(e) => handleRetryChange('maxAttempts', parseInt(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum number of retry attempts (1-10)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Backoff Strategy
                  </label>
                  <select
                    value={(retry.backoff as string) || 'exponential'}
                    onChange={(e) => handleRetryChange('backoff', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="exponential">Exponential (delay × 2^attempt)</option>
                    <option value="fixed">Fixed (constant delay)</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How delay increases between retries</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base Delay (ms)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="60000"
                    step="100"
                    value={(retry.delay as number) || 1000}
                    onChange={(e) => handleRetryChange('delay', parseInt(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Initial delay before first retry (100-60000ms)</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

