import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface ConnectorManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'communication' | 'data' | 'productivity' | 'ai' | 'custom';
  auth: {
    type: 'oauth2' | 'api_key' | 'basic' | 'none';
    scopes?: string[];
    authUrl?: string;
    tokenUrl?: string;
  };
  actions: Array<{
    id: string;
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
  }>;
  triggers?: Array<{
    id: string;
    name: string;
    description: string;
    outputSchema: Record<string, unknown>;
  }>;
  icon?: string;
}

interface ConnectorCredential {
  id: string;
  connectorId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

interface ConnectorManagerProps {
  onClose: () => void;
  onSelectConnector?: (connectorId: string, actionId: string) => void;
}

export default function ConnectorManager({ onClose, onSelectConnector }: ConnectorManagerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedConnector, setSelectedConnector] = useState<ConnectorManifest | null>(null);
  const queryClient = useQueryClient();

  const { data: connectors, isLoading: loadingConnectors } = useQuery({
    queryKey: ['connectors', selectedCategory],
    queryFn: async () => {
      const params = selectedCategory !== 'all' ? `?category=${selectedCategory}` : '';
      const response = await api.get(`/connectors${params}`);
      return response.data as ConnectorManifest[];
    },
  });

  const { data: credentials } = useQuery({
    queryKey: ['connectors', 'credentials'],
    queryFn: async () => {
      const response = await api.get('/connectors/credentials');
      return response.data as ConnectorCredential[];
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      await api.delete(`/connectors/credentials/${credentialId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectors', 'credentials'] });
    },
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'communication':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'data':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'productivity':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'ai':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const isConnected = (connectorId: string) => {
    return credentials?.some((c) => c.connectorId === connectorId) || false;
  };

  const handleConnect = async (connector: ConnectorManifest) => {
    if (connector.auth.type === 'oauth2') {
      try {
        // Initiate OAuth flow
        const response = await api.post(`/connectors/${connector.id}/connect`);
        const data = response.data;
        
        if (data.authUrl) {
          // Open OAuth flow in popup or redirect
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
              queryClient.invalidateQueries({ queryKey: ['connectors', 'credentials'] });
            }
          }, 1000);
        } else if (data.requiresManualSetup) {
          alert(`Please configure ${connector.name} credentials manually. Auth type: ${data.authType}`);
        }
      } catch (error: any) {
        console.error('Failed to connect:', error);
        alert(`Failed to initiate connection: ${error.response?.data?.error || error.message}`);
      }
    } else if (connector.auth.type === 'api_key') {
      // TODO: Implement API key input modal
      alert(`Please configure ${connector.name} API key manually. This feature is coming soon.`);
    }
  };

  const handleDisconnect = (connectorId: string) => {
    const credential = credentials?.find((c) => c.connectorId === connectorId);
    if (credential && confirm('Are you sure you want to disconnect this connector?')) {
      revokeMutation.mutate(credential.id);
    }
  };

  const categories = ['all', 'communication', 'data', 'productivity', 'ai', 'custom'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Connector Manager</h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>

        {/* Category Filter */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 text-sm rounded ${
                  selectedCategory === category
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loadingConnectors ? (
            <div className="text-center text-gray-500 dark:text-gray-400">Loading connectors...</div>
          ) : !connectors || connectors.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400">No connectors found</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {connectors.map((connector) => (
                <div
                  key={connector.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{connector.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{connector.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(connector.category)}`}>
                          {connector.category}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">v{connector.version}</span>
                      </div>
                    </div>
                    {isConnected(connector.id) ? (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                        Connected
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded">
                        Not Connected
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {connector.actions.length} Action{connector.actions.length !== 1 ? 's' : ''}
                    </div>
                    <div className="space-y-1">
                      {connector.actions.slice(0, 3).map((action) => (
                        <div key={action.id} className="text-xs text-gray-600 dark:text-gray-400">
                          • {action.name}
                        </div>
                      ))}
                      {connector.actions.length > 3 && (
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          +{connector.actions.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    {isConnected(connector.id) ? (
                      <>
                        <button
                          onClick={() => setSelectedConnector(connector)}
                          className="flex-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          View Actions
                        </button>
                        <button
                          onClick={() => handleDisconnect(connector.id)}
                          disabled={revokeMutation.isPending}
                          className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(connector)}
                        className="flex-1 px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connector Details Modal */}
        {selectedConnector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {selectedConnector.name} Actions
                </h3>
                <button
                  onClick={() => setSelectedConnector(null)}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {selectedConnector.actions.map((action) => (
                    <div
                      key={action.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">{action.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{action.description}</p>
                      {onSelectConnector && isConnected(selectedConnector.id) && (
                        <button
                          onClick={() => {
                            onSelectConnector(selectedConnector.id, action.id);
                            setSelectedConnector(null);
                            onClose();
                          }}
                          className="mt-3 px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Use This Action
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

